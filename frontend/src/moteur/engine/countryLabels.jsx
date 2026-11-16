// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe lonLatToXYZ, la conversion d'une longitude et d'une latitude en point de la sphère, depuis tiles/mercator.
import { lonLatToXYZ } from './tiles/mercator';
// Importe la liste des points d'ancrage des noms de pays.
import { COUNTRY_LABEL_POINTS } from './countryLabelPoints';
// Importe nativeCountryLabel, le nom d'un pays dans son écriture locale.
import { nativeCountryLabel } from './countryNativeNames';
// Importe la hauteur du texte, les deux opacités et la recherche du morceau de pays, depuis countryLabelsMath.
import { countryLabelHeightDeg, countryLabelOpacity, countryLabelSizeAlpha, findCountryPart } from './countryLabelsMath';
// Importe borderLift, la hauteur des frontières au-dessus du sol, depuis bordersGeometry.
import { borderLift } from './bordersGeometry';

// Noms des pays posés à plat sur le globe : chaque nom est une texture plaquée sur un morceau de sphère, orienté
// Est-Ouest, au milieu du pays calculé depuis ses frontières (pôle d'inaccessibilité, envoyé par GET /borders).
// Le style (police, graisse, capitales, interlettrage) est lu dans SceneStyles.jsx (.l.country-label) pour rester modifiable
// au même endroit ; les pays d'écriture non latine gardent leur alphabet local (countryNativeNames.js).

// Taille du texte dans la texture : 64 pixels.
const FONT_PX = 64;          // taille du texte dans la texture
// Marge autour du texte : 0,35 hauteur de police.
const PAD = 0.35;            // marge autour du texte, en hauteurs de police (place pour le contour)
// Nombre de radians dans un degré.
const D2R = Math.PI / 180;
// Axe des pôles.
const Y_AXIS = new THREE.Vector3(0, 1, 0);

// Vecteur de travail.
const v3 = new THREE.Vector3();
// Matrice de travail.
const inv = new THREE.Matrix4();

/** Style CSS d'un nom (lu une fois par élément, puis l'élément est retiré). */
// readStyle : lit le style CSS d'un nom de pays (début).
function readStyle(parent, p, native) {
  // Élément provisoire.
  const el = document.createElement('div');
  // Sa classe CSS.
  el.className = 'l country-label';
  // Son rang, pour le style.
  el.dataset.rank = String(p.rank);
  // Son écriture, pour un nom local.
  if (native) el.dataset.script = native.script;
  // Invisible et hors du flux de la page.
  el.style.cssText = 'position:absolute;visibility:hidden;display:block;left:0;top:0';
  // Son texte : le nom local, sinon le nom.
  el.textContent = native ? native.text : p.name;
  // L'ajoute au parent.
  parent.appendChild(el);
  // Style calculé par le navigateur.
  const cs = getComputedStyle(el);
  // Style gardé (début).
  const style = {
    // La police.
    family: cs.fontFamily || 'sans-serif',
    // La graisse.
    weight: cs.fontWeight || '600',
    // La taille.
    size: parseFloat(cs.fontSize) || 12,
    // L'interlettrage.
    spacing: parseFloat(cs.letterSpacing) || 0,
    // Les capitales.
    upper: cs.textTransform === 'uppercase',
    // La couleur.
    color: cs.color || '#fff',
  // Fin du style.
  };
  // Retire l'élément.
  el.remove();
  // Renvoie le style.
  return style;
// Fin de readStyle.
}

/** Dessine le nom dans un canvas : texte clair cerné de sombre, lisible sur la mer comme sur la terre. */
// drawLabel : dessine un nom dans un canevas (début).
function drawLabel(text, style) {
  // Rapport entre la taille dans la texture et la taille CSS.
  const scale = FONT_PX / style.size;
  // Police du canevas.
  const font = `${style.weight} ${FONT_PX}px ${style.family}`;
  // Interlettrage à cette échelle.
  const spacing = style.spacing * scale;
  // Canevas.
  const canvas = document.createElement('canvas');
  // Son contexte de dessin.
  let ctx = canvas.getContext('2d');
  // Police, pour mesurer.
  ctx.font = font;
  // Interlettrage, si le navigateur le gère.
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  // Largeur du texte.
  const textW = Math.ceil(ctx.measureText(text).width);
  // Marge en pixels.
  const pad = Math.ceil(FONT_PX * PAD);
  // Largeur du canevas.
  canvas.width = textW + 2 * pad;
  // Hauteur du canevas.
  canvas.height = Math.ceil(FONT_PX * 1.25) + 2 * pad;
  // Reprend le contexte.
  ctx = canvas.getContext('2d'); // le redimensionnement remet le contexte à zéro
  // Police.
  ctx.font = font;
  // Interlettrage.
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  // Texte centré horizontalement.
  ctx.textAlign = 'center';
  // Et verticalement.
  ctx.textBaseline = 'middle';
  // De gauche à droite.
  ctx.direction = 'ltr';
  // Angles du contour arrondis.
  ctx.lineJoin = 'round';
  // Centre du canevas.
  const x = canvas.width / 2, y = canvas.height / 2;
  // Couleur du contour : noir à 75 %.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  // Épaisseur du contour.
  ctx.lineWidth = FONT_PX * 0.16;
  // Dessine le contour.
  ctx.strokeText(text, x, y);
  // Couleur du texte.
  ctx.fillStyle = style.color;
  // Dessine le texte.
  ctx.fillText(text, x, y);
  // Renvoie le canevas et ses proportions.
  return { canvas, aspect: canvas.width / canvas.height };
// Fin de drawLabel.
}

/**
 * Maillage du nom : grille posée sur la sphère unité autour de `center`, largeur w et hauteur h en radians,
 * chaque sommet ramené sur la sphère (le texte épouse la courbure, même pour les grands pays).
 */
// buildGeometry : le maillage d'un nom, autour d'un centre, d'une largeur et d'une hauteur en radians (début).
function buildGeometry(center, w, h) {
  // Direction de l'est au centre.
  const east = new THREE.Vector3().crossVectors(Y_AXIS, center);
  // Au pôle : une direction arbitraire.
  if (east.lengthSq() < 1e-12) east.set(0, 0, -1); // pôle : orientation arbitraire
  // Rendue unitaire.
  east.normalize();
  // Direction du nord au centre.
  const north = new THREE.Vector3().crossVectors(center, east).normalize();
  // Segments en largeur : un tous les 2°, deux au moins.
  const nx = Math.max(2, Math.ceil(w / (2 * D2R))); // un segment tous les 2° environ
  // Segments en hauteur : deux.
  const ny = 2;
  // Tableau des positions.
  const pos = new Float32Array((nx + 1) * (ny + 1) * 3);
  // Tableau des coordonnées de texture.
  const uv = new Float32Array((nx + 1) * (ny + 1) * 2);
  // Liste des indices.
  const idx = [];
  // Vecteur de travail.
  const p = new THREE.Vector3();
  // Pour chaque rangée (début).
  for (let j = 0; j <= ny; j++) {
    // Pour chaque sommet (début).
    for (let i = 0; i <= nx; i++) {
      // Avancements horizontal et vertical, de 0 à 1.
      const u = i / nx, v = j / ny;
      // Angles le long de l'Est et du Nord : tan pour une projection gnomonique exacte depuis le centre.
      // Part du centre,
      p.copy(center)
        // avance vers l'est de la tangente de l'angle,
        .addScaledVector(east, Math.tan((u - 0.5) * w))
        // avance vers le nord de la tangente de l'angle,
        .addScaledVector(north, Math.tan((v - 0.5) * h))
        // puis revient sur la sphère.
        .normalize();
      // Numéro du sommet.
      const k = j * (nx + 1) + i;
      // Range sa position.
      pos.set([p.x, p.y, p.z], k * 3);
      // Range ses coordonnées de texture.
      uv.set([u, v], k * 2);
    // Fin de la boucle des sommets.
    }
  // Fin de la boucle des rangées.
  }
  // Pour chaque rangée de cases (début).
  for (let j = 0; j < ny; j++) {
    // Pour chaque case (début).
    for (let i = 0; i < nx; i++) {
      // Ses quatre sommets.
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      // Ses deux triangles.
      idx.push(a, b, d, a, d, c);
    // Fin de la boucle des cases.
    }
  // Fin de la boucle des rangées.
  }
  // Géométrie.
  const g = new THREE.BufferGeometry();
  // Ses positions.
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  // Ses coordonnées de texture.
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  // Ses indices.
  g.setIndex(idx);
  // Calcule sa sphère englobante.
  g.computeBoundingSphere();
  // La renvoie.
  return g;
// Fin de buildGeometry.
}

/**
 * Noms des pays posés sur le globe, dans l'ordre d'importance de countryLabelPoints.js.
 * Avant l'arrivée des frontières, ils sont au point d'ancrage Natural Earth ; ensuite au milieu calculé du pays.
 */
// Déclare et exporte la classe CountryLabels (début).
export class CountryLabels {
  // Constructeur : l'élément parent, la Terre et le moteur de rendu (début).
  constructor({ parent, earthMesh, renderer }) {
    // Garde l'élément parent.
    this.parent = parent;
    // Garde la Terre.
    this.earthMesh = earthMesh;
    // Actif.
    this.enabled = true;
    // Opacité générale : 0.
    this.opacity = 0;
    // Anisotropie maximale de la carte graphique, ou 1.
    this.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() || 1;
    // Même repère que les frontières : groupe de la Terre, rotation du globe recopiée à chaque image.
    // Groupe des noms.
    this.root = new THREE.Group();
    // Son nom.
    this.root.name = 'country-labels';
    // Caché au départ.
    this.root.visible = false;
    // L'ajoute au parent de la Terre, ou à la Terre.
    (earthMesh.parent || earthMesh).add(this.root);

    // Un nom par point d'ancrage (début).
    this.items = COUNTRY_LABEL_POINTS.map((p) => {
      // Son nom local, s'il en a un.
      const native = nativeCountryLabel(p.name);
      // Son texte.
      const text = native ? native.text : p.name;
      // Le nom : le point, son ancrage, son texte, et un état vide.
      return { ...p, anchor: [p.lon, p.lat], text, native, r: null, mesh: null, aspect: 4, alpha: -1 };
    // Fin de la boucle.
    });
    // Dessine les noms.
    this.draw();
    // Les polices système peuvent arriver après le premier rendu : on redessine une fois prêtes.
    // Quand les polices sont prêtes : redessine.
    if (document.fonts?.ready) document.fonts.ready.then(() => this.draw()).catch(() => {});
  // Fin du constructeur.
  }

  /** (Re)dessine les textures et (re)pose les maillages. */
  // draw : dessine les textures et pose les maillages (début).
  draw() {
    // Pour chaque nom (début).
    for (const c of this.items) {
      // Son style CSS.
      const style = readStyle(this.parent, c, c.native);
      // Son dessin, en capitales si le style le demande, dans la langue du nom.
      const label = drawLabel(style.upper ? c.text.toLocaleUpperCase(c.native ? c.native.lang : 'fr') : c.text, style);
      // Garde ses proportions.
      c.aspect = label.aspect;
      // Texture faite à partir du canevas.
      const map = new THREE.CanvasTexture(label.canvas);
      // Son anisotropie.
      map.anisotropy = this.anisotropy;
      // Filtre de réduction avec mipmaps.
      map.minFilter = THREE.LinearMipmapLinearFilter;
      // Si le maillage existe déjà (début).
      if (c.mesh) {
        // Libère l'ancienne texture.
        c.mesh.material.map.dispose();
        // Pose la nouvelle.
        c.mesh.material.map = map;
        // Signale à three.js que le matériau a changé.
        c.mesh.material.needsUpdate = true;
      // Sinon (début).
      } else {
        // Crée le maillage, sans géométrie pour l'instant (début).
        c.mesh = new THREE.Mesh(undefined, new THREE.MeshBasicMaterial({
          // Matériau transparent, sans écriture de la profondeur, deux faces, opacité 0.
          map, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0,
        // Fin du maillage.
        }));
        // Ordre de dessin : 5.
        c.mesh.renderOrder = 5; // après les tuiles et les frontières
        // Caché au départ.
        c.mesh.visible = false;
        // L'ajoute au groupe.
        this.root.add(c.mesh);
      // Fin du choix.
      }
      // Pose le nom.
      this.place(c);
    // Fin de la boucle.
    }
  // Fin de draw.
  }

  /** Pose le nom au milieu de son pays, à une taille qui tient entre ses frontières. */
  // place : pose un nom (début).
  place(c) {
    // Hauteur du texte en degrés.
    const hDeg = countryLabelHeightDeg(c.r, c.aspect, c.rank);
    // En radians.
    c.h = hDeg * D2R;
    // Point du centre sur la sphère.
    const [x, y, z] = lonLatToXYZ(c.lon, c.lat);
    // Le garde comme vecteur.
    c.center = new THREE.Vector3(x, y, z);
    // Libère l'ancienne géométrie.
    c.mesh.geometry?.dispose();
    // Nouvelle géométrie, à cette taille.
    c.mesh.geometry = buildGeometry(c.center, c.h * c.aspect, c.h);
  // Fin de place.
  }

  /**
   * Milieux calculés par le serveur depuis les frontières (GET /borders → countries).
   * Chaque nom garde le morceau de pays (continent, île) qui contient son point d'ancrage.
   */
  // setCountries : reçoit les pays et leurs milieux (début).
  setCountries(countries) {
    // Liste absente ou vide : rien à faire.
    if (!Array.isArray(countries) || !countries.length) return;
    // Pour chaque nom (début).
    for (const c of this.items) {
      // Morceau de pays qui contient son ancrage.
      const part = findCountryPart(c.anchor[0], c.anchor[1], countries);
      // Aucun : inchangé.
      if (!part) continue; // pas de contour (îlot) : on garde l'ancrage Natural Earth
      // Longitude du milieu.
      c.lon = part.lon;
      // Latitude du milieu.
      c.lat = part.lat;
      // Distance à la frontière.
      c.r = part.r;
      // Repose le nom.
      this.place(c);
    // Fin de la boucle.
    }
  // Fin de setCountries.
  }

  /** @param {{ cam, W, H, earthMesh }} s  appelé à chaque image, après le placement de la caméra */
  // update : à chaque image ; reçoit la caméra, la hauteur de l'écran et la Terre (début).
  update({ cam, H, earthMesh }) {
    // Inactif : groupe caché, opacité nulle.
    if (!this.enabled) { this.root.visible = false; this.opacity = 0; return; }
    // Caméra dans le repère du maillage de la Terre (sphère unité, longitudes de lonLatToXYZ).
    // Met à jour la matrice de la Terre.
    earthMesh.updateWorldMatrix(true, false);
    // Position de la caméra dans le repère de la Terre.
    v3.copy(cam.position).applyMatrix4(inv.copy(earthMesh.matrixWorld).invert());
    // Ses trois coordonnées.
    const cx = v3.x, cy = v3.y, cz = v3.z;
    // Sa distance au centre.
    const camDist = Math.hypot(cx, cy, cz);
    // Son altitude.
    const altitude = camDist - 1;
    // Opacité générale à cette altitude.
    const alpha = countryLabelOpacity(altitude);
    // La garde.
    this.opacity = alpha;
    // Négligeable : groupe caché.
    if (alpha <= 0.01) { this.root.visible = false; return; }
    // Groupe visible.
    this.root.visible = true;
    // Il prend la rotation de la Terre.
    this.root.rotation.y = earthMesh.rotation.y;
    // Un peu au-dessus des frontières pour ne jamais passer dessous.
    // Il est agrandi d'une fois et demie la hauteur des frontières.
    this.root.scale.setScalar(1 + borderLift(altitude) * 1.5);

    // Pixels par unité de longueur vue à une distance de 1.
    const pxPerUnit = H / (2 * Math.tan((cam.fov * D2R) / 2));
    // Pour chaque nom (début).
    for (const c of this.items) {
      // Son centre et son maillage.
      const { center, mesh } = c;
      // Face visible : devant l'horizon, avec un fondu en approchant du bord du disque.
      // Orientation face à la caméra : positive devant l'horizon.
      const facing = (center.x * cx + center.y * cy + center.z * cz - 1) / Math.max(1e-6, camDist - 1);
      // Opacité : 0 par défaut.
      let a = 0;
      // Devant l'horizon (début).
      if (facing > 0) {
        // Distance de la caméra au nom.
        const dist = Math.hypot(cx - center.x, cy - center.y, cz - center.z);
        // Opacité : générale, multipliée par celle de sa taille à l'écran et par un fondu près du bord du disque.
        a = alpha * countryLabelSizeAlpha((c.h * pxPerUnit) / dist) * Math.min(1, facing * 6);
      // Fin de ce cas.
      }
      // Opacité négligeable (début).
      if (a <= 0.01) {
        // Cache le maillage.
        if (mesh.visible) mesh.visible = false;
        // Mémorise 0.
        c.alpha = 0;
        // Nom suivant.
        continue;
      // Fin de ce cas.
      }
      // Montre le maillage.
      if (!mesh.visible) mesh.visible = true;
      // Si l'opacité a changé de plus de 0,01 (début).
      if (Math.abs(a - c.alpha) > 0.01) {
        // L'écrit dans le matériau.
        mesh.material.opacity = a;
        // La mémorise.
        c.alpha = a;
      // Fin de ce cas.
      }
    // Fin de la boucle.
    }
  // Fin de update.
  }

  // setVisible : active ou désactive les noms (début).
  setVisible(on) {
    // Garde l'état.
    this.enabled = Boolean(on);
    // Désactivé : groupe caché.
    if (!this.enabled) this.root.visible = false;
  // Fin de setVisible.
  }

  // dispose : libère tout (début).
  dispose() {
    // Pour chaque nom (début).
    for (const c of this.items) {
      // Libère sa géométrie.
      c.mesh?.geometry?.dispose();
      // Libère sa texture.
      c.mesh?.material.map?.dispose();
      // Libère son matériau.
      c.mesh?.material.dispose();
    // Fin de la boucle.
    }
    // Retire le groupe.
    this.root.parent?.remove(this.root);
    // Vide la liste.
    this.items = [];
  // Fin de dispose.
  }
// Fin de la classe CountryLabels.
}
