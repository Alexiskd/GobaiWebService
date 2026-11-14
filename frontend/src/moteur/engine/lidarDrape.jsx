// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe fillTemplate, qui remplit l'adresse d'une tuile, depuis tiles/mercator.
import { fillTemplate } from './tiles/mercator';
// Importe le chargement d'une image, direct ou avec cache, depuis tiles/tileSource.
import { loadImage, loadImageCached } from './tiles/tileSource';
// Importe l'ouverture du cache sur disque et le suivi de ses écritures, depuis tiles/diskCache.
import { diskWritten, openDisk } from './tiles/diskCache';
// Importe la liste des tuiles à charger et le rectangle d'une tuile, depuis lidarDrapeMath.
import { drapeTiles, tileRect } from './lidarDrapeMath';

// Atlas de l'orthophoto d'une dalle LiDAR (drapage, voir lidarDrapeMath.jsx) : les tuiles de la photo aérienne qui
// couvrent la dalle sont dessinées dans une seule image, lue par le shader des points. Un aperçu grossier arrive en
// premier (toute la dalle en quelques tuiles), puis les tuiles fines le remplacent, du centre vers les bords.
// Tant qu'une zone n'a pas reçu sa photo, l'image y reste transparente et les points gardent leur couleur de classe.

// Nombre de tuiles fines chargées en même temps : 8.
const PARALLEL = 8;
// Délai entre deux envois de l'image à la carte graphique : 350 ms.
const FLUSH_MS = 350;          // l'image est renvoyée à la carte graphique au plus 3 fois par seconde
// Nom du cache sur disque.
const DISK = 'lidar-drape-v1'; // photos déjà chargées : gardées sur le disque du navigateur
// Nombre maximal d'images gardées dans ce cache : 400.
const DISK_MAX = 400;

// Déclare et exporte la classe LidarDrape (début).
export class LidarDrape {
  /**
   * @param {object} plan plan de drapage (drapePlan)
   * @param {string} template adresse des tuiles de l'orthophoto ({z}, {x}, {y})
   */
  // Constructeur : le plan de drapage et l'adresse des tuiles (début).
  constructor(plan, template) {
    // Garde le plan.
    this.plan = plan;
    // Garde l'adresse.
    this.template = template;
    // Crée le canevas de l'atlas.
    this.canvas = document.createElement('canvas');
    // Sa largeur : celle du plan.
    this.canvas.width = plan.width;
    // Sa hauteur : celle du plan.
    this.canvas.height = plan.height;
    // Son contexte de dessin 2D.
    this.ctx = this.canvas.getContext('2d');
    // Texture three.js faite à partir du canevas.
    this.texture = new THREE.CanvasTexture(this.canvas);
    // Pas de retournement vertical de l'image.
    this.texture.flipY = false;          // v vers le sud, comme l'image
    // Pas de mipmaps.
    this.texture.generateMipmaps = false;
    // Filtre de réduction linéaire.
    this.texture.minFilter = THREE.LinearFilter;
    // Filtre d'agrandissement linéaire.
    this.texture.magFilter = THREE.LinearFilter;
    // Les tuiles grossières et les tuiles fines du plan.
    const { coarse, fine } = drapeTiles(plan);
    // Garde les tuiles grossières.
    this.coarse = coarse;
    // Garde les tuiles fines : la file d'attente.
    this.fine = fine;
    // Nombre total de tuiles fines.
    this.total = fine.length;
    // Tuiles fines dessinées : 0.
    this.done = 0;                       // tuiles fines dessinées
    // Tuiles dessinées en tout : 0.
    this.drawn = 0;                      // tuiles dessinées, aperçu compris
    // Chargements de tuiles fines en cours : 0.
    this.active = 0;
    // Tuiles grossières encore attendues.
    this.coarsePending = coarse.length;
    // Pas encore libéré.
    this.disposed = false;
    // Aucune minuterie d'envoi en attente.
    this.timer = null;
    // Ouvre le cache sur disque.
    this.disk = openDisk(DISK);
    // Compteurs des images venues du réseau et du disque.
    this.stats = { network: 0, disk: 0 };
    // Lance le chargement de chaque tuile grossière.
    for (const tile of coarse) this.fetch(tile, true);
    // Sans tuile grossière : lance tout de suite les tuiles fines.
    if (!coarse.length) this.pump();
  // Fin du constructeur.
  }

  /** Vrai dès qu'une photo (même grossière) couvre la dalle. */
  // ready : vrai dès qu'une tuile au moins est dessinée.
  get ready() { return this.drawn > 0; }

  // load : charge l'image d'une adresse (début).
  load(url) {
    // Sans cache sur disque : chargement direct.
    if (!this.disk) return loadImage(url);
    // Sinon, chargement par le cache, avec le suivi des écritures ; en cas d'échec, chargement direct.
    return loadImageCached(url, this.disk, this.stats, false, () => diskWritten(DISK, this.disk, DISK_MAX)).catch(() => loadImage(url));
  // Fin de load.
  }

  // fetch : charge et dessine une tuile, grossière ou fine (début).
  fetch(tile, coarse) {
    // Tuile fine : un chargement en cours de plus.
    if (!coarse) this.active++;
    // Charge l'image à l'adresse de la tuile.
    this.load(fillTemplate(this.template, tile))
      // Quand l'image est arrivée (début).
      .then((img) => {
        // Atlas déjà libéré : rien à faire.
        if (this.disposed) return;
        // Rectangle de la tuile dans l'atlas.
        const r = tileRect(this.plan, tile);
        // Dessine l'image dans ce rectangle.
        this.ctx.drawImage(img, r.x, r.y, r.size, r.size);
        // Une tuile dessinée de plus.
        this.drawn++;
        // Tuile fine : une tuile fine dessinée de plus.
        if (!coarse) this.done++;
        // Demande l'envoi de l'image à la carte graphique.
        this.touch();
      // Fin du traitement de l'image.
      })
      // Échec du chargement : ignoré.
      .catch(() => {}) // tuile manquante : la zone garde l'aperçu grossier, ou la couleur de classe
      // Dans tous les cas, à la fin (début).
      .finally(() => {
        // Pour une tuile grossière (début).
        if (coarse) {
          // Les tuiles fines attendent la fin de l'aperçu : il ne doit jamais les recouvrir.
          // Une tuile grossière attendue de moins ; à la dernière, lance les tuiles fines.
          if (--this.coarsePending === 0) this.pump();
        // Pour une tuile fine (début).
        } else {
          // Un chargement en cours de moins.
          this.active--;
          // Lance les tuiles suivantes.
          this.pump();
        // Fin du cas d'une tuile fine.
        }
      // Fin du traitement de fin.
      });
  // Fin de fetch.
  }

  // pump : lance des tuiles fines (début).
  pump() {
    // Tant que l'atlas n'est pas libéré, qu'il reste de la place et des tuiles : charge la première de la file.
    while (!this.disposed && this.active < PARALLEL && this.fine.length) this.fetch(this.fine.shift(), false);
  // Fin de pump.
  }

  /** Regroupe les envois à la carte graphique : une grande image coûte quelques dizaines de millisecondes. */
  // touch : programme l'envoi de l'image à la carte graphique (début).
  touch() {
    // Un envoi est déjà programmé : rien à faire.
    if (this.timer !== null) return;
    // Programme l'envoi (début).
    this.timer = setTimeout(() => {
      // Plus de minuterie en attente.
      this.timer = null;
      // Si l'atlas n'est pas libéré : signale à three.js que la texture a changé.
      if (!this.disposed) this.texture.needsUpdate = true;
    // Fin : après le délai d'envoi.
    }, FLUSH_MS);
  // Fin de touch.
  }

  // dispose : libère l'atlas (début).
  dispose() {
    // Note qu'il est libéré.
    this.disposed = true;
    // Annule la minuterie en attente.
    if (this.timer !== null) clearTimeout(this.timer);
    // Libère la texture.
    this.texture.dispose();
    // Ramène le canevas à une taille nulle.
    this.canvas.width = this.canvas.height = 0; // rend la mémoire de l'image tout de suite
  // Fin de dispose.
  }
// Fin de la classe LidarDrape.
}
