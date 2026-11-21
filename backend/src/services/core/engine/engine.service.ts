// Service du moteur chiffré : lit le texte en clair du moteur 3D, le chiffre une fois au démarrage (AES-256-GCM), et
// fournit le script `body.js` (bootstrap auto-déchiffrant) ainsi que la clé. Le script est public ; la clé, elle, n'est
// servie qu'aux origines autorisées (voir le contrôleur). Un autre site ne peut donc pas déchiffrer le moteur.
// NodeJS.
import { Injectable, Logger } from '@nestjs/common';
// Chiffrement : AES-256-GCM, empreintes, aléa.
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
// Lecture du fichier en clair.
import { readFileSync } from 'node:fs';
// Chemin du fichier.
import { join } from 'node:path';

// Fichier en clair du moteur : backend/data/engine/gobai-engine.plain.js (même repère que la consigne de l'assistant).
const PLAIN_FILE = join(__dirname, '..', '..', '..', '..', 'data', 'engine', 'gobai-engine.plain.js');

// Service.
@Injectable()
export class EngineService {
  // Journal.
  private readonly logger = new Logger(EngineService.name);
  // Clé AES de 32 octets.
  private readonly key: Buffer;
  // Charge utile chiffrée, en base64 : iv(12) ‖ chiffré ‖ étiquette(16).
  private readonly payloadB64: string;
  // Script body.js, construit une seule fois.
  private readonly script: string;

  // Constructeur : choisit la clé, lit le clair, chiffre.
  constructor() {
    // Clé : ENGINE_KEY (64 hex) si valide ; sinon dérivée de SESSION_SECRET (stable entre instances) ; sinon aléatoire.
    this.key = this.resolveKey();
    // Texte en clair du moteur, ou un moteur de secours minimal si le fichier manque.
    const plain = this.readPlain();
    // iv déterministe (empreinte de clé ‖ clair) : le body.js est identique à chaque démarrage, donc cacheable.
    const iv = createHash('sha256').update(this.key).update(plain).digest().subarray(0, 12);
    // Chiffrement AES-256-GCM.
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    // Chiffré.
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    // Étiquette d'authentification (16 octets).
    const tag = cipher.getAuthTag();
    // Charge utile : iv ‖ chiffré ‖ étiquette, en base64 (ordre attendu par le bootstrap côté navigateur).
    this.payloadB64 = Buffer.concat([iv, enc, tag]).toString('base64');
    // Script servi par /engine/body.js.
    this.script = this.buildScript(this.payloadB64);
  }

  // Clé en hexadécimal, servie aux seules origines autorisées.
  keyHex(): string {
    return this.key.toString('hex');
  }

  // Le script body.js (bootstrap + charge utile chiffrée).
  bodyScript(): string {
    return this.script;
  }

  // Choix de la clé.
  private resolveKey(): Buffer {
    // ENGINE_KEY : 64 caractères hexadécimaux.
    const fromEnv = process.env.ENGINE_KEY?.trim();
    if (fromEnv && /^[0-9a-fA-F]{64}$/.test(fromEnv)) return Buffer.from(fromEnv, 'hex');
    // Sinon, dérivée de SESSION_SECRET : stable, donc toutes les instances servent la même clé.
    const secret = process.env.SESSION_SECRET?.trim();
    if (secret) return createHash('sha256').update('gobai-engine:').update(secret).digest();
    // Sinon, aléatoire (le moteur reste déchiffrable dans cette instance, mais pas entre deux instances).
    this.logger.warn('Ni ENGINE_KEY ni SESSION_SECRET : clé du moteur aléatoire, propre à cette instance.');
    return randomBytes(32);
  }

  // Lecture du texte en clair, avec repli.
  private readPlain(): string {
    try {
      // Le fichier, non vide.
      const text = readFileSync(PLAIN_FILE, 'utf8');
      if (text.trim()) return text;
      // Vide : repli.
      this.logger.warn(`Fichier du moteur vide (${PLAIN_FILE}) : moteur de secours servi.`);
    } catch (e) {
      // Illisible : repli.
      this.logger.warn(`Fichier du moteur illisible (${PLAIN_FILE}) : moteur de secours servi. ${(e as Error).message}`);
    }
    // Moteur de secours : une sphère colorée, pour que le script reste fonctionnel même sans le fichier.
    return "'use strict';\nexports.create=function(THREE,o){o=o||{};var m=new THREE.Mesh(new THREE.SphereGeometry(o.radius||1,48,32),new THREE.MeshBasicMaterial({color:new THREE.Color(o.color||'#ffb300')}));var g=new THREE.Group();g.add(m);g.userData.setBody=function(){};g.userData.setParams=function(){};g.userData.setRegions=function(){};g.userData.dispose=function(){m.geometry.dispose();m.material.dispose();};return g;};\n";
  }

  // Construit le script body.js : bootstrap qui va chercher la clé, déchiffre la charge utile et expose window.GobaiEngine.
  private buildScript(payload: string): string {
    // Le gabarit est du JavaScript de navigateur (Web Crypto). La charge utile est insérée telle quelle.
    return [
      "/* Moteur Go白 — chargé chiffré depuis l'API. Déchiffrement AES-256-GCM via la clé servie aux origines autorisées. */",
      '(function(){',
      "  'use strict';",
      // Charge utile chiffrée (base64 : iv ‖ chiffré ‖ étiquette).
      '  var PAYLOAD=' + JSON.stringify(payload) + ';',
      // Base de l'API, déduite de l'adresse du script, avec un repli.
      "  var base='/api/v1/engine/';",
      "  try{ if(document.currentScript&&document.currentScript.src){ base=new URL('./',document.currentScript.src).href; } }catch(e){}",
      // base64 → octets.
      '  function bytes(b64){ var s=atob(b64),a=new Uint8Array(s.length); for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i); return a; }',
      // Démarrage : clé, import, déchiffrement, évaluation.
      '  async function boot(){',
      // La clé (hex), servie aux seules origines autorisées ; refus => erreur claire.
      "    var res=await fetch(base+'key');",
      "    if(!res.ok) throw new Error('Clé du moteur refusée (HTTP '+res.status+'). Origine non autorisée.');",
      '    var hex=(await res.json()).key;',
      '    var raw=new Uint8Array(hex.match(/.{2}/g).map(function(h){return parseInt(h,16);}));',
      "    var key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);",
      '    var buf=bytes(PAYLOAD), iv=buf.slice(0,12), data=buf.slice(12);',
      "    var plain=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:iv},key,data));",
      // Évalue le moteur déchiffré : il remplit l'objet exports.
      '    var mod={}; (new Function("exports",plain))(mod); return mod;',
      '  }',
      // Expose une promesse résolue en { create }.
      '  window.GobaiEngine={ ready: boot() };',
      '})();',
      '',
    ].join('\n');
  }
}
