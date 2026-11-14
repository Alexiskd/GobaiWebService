// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe la table des atmosphères, le rayon des nuages, les paramètres de diffusion et le fondu des nuages simulés, depuis atmosphereData.
import { ATMOSPHERES, cloudRadiusFactor, scatterParams, simCloudFade } from './atmosphereData';
// Importe les cinq shaders des nuages et de la coquille, depuis atmosphereShaders.
import { cloudVertexShader, earthCloudFragmentShader, shellFragmentShader, shellVertexShader, venusCloudFragmentShader } from './atmosphereShaders';
// Importe la somme des amplitudes du bruit et la qualité des shaders, depuis powerSaver.
import { fbmNorm, shaderQuality } from './powerSaver';
// Importe la taille de la texture de vent, l'état de l'animation, le contrôle d'une grille et la construction de la texture, depuis weatherFlow.
import { WIND_TEXTURE_HEIGHT, WIND_TEXTURE_WIDTH, flowState, isWindGrid, windTexels } from './weatherFlow';

// Atmosphère d'une planète solide (voir atmosphereData.jsx) :
//  - une coquille au sommet de l'atmosphère, dont le shader calcule la lumière du Soleil diffusée par l'air le long de
//    chaque rayon de vue (Rayleigh + Mie, atmosphereScatter.jsx) et l'ajoute à l'image : liseré au limbe, voile sur
//    le disque, ciel vu du sol ;
//  - pour Vénus, la couche de nuages opaque qui cache le sol ; pour la Terre, des nuages simulés semi-transparents
//    (motifs calculés, atmosphereClouds.jsx) ou réels (image satellite, grille de couverture) ;
//  - le mouvement de la météo : les nuages de la Terre suivent le vent (weatherFlow.jsx), ceux de Vénus font le tour
//    de la planète (super-rotation), tous deux en accéléré.
// Même direction du Soleil (`sunV`, repère caméra) et même réglage « Ombre » (`shade`) que les cartes de l'astre.

// Intensité du Soleil dans le calcul de diffusion : 14.
const SUN_INTENSITY = 14;   // éclat du Soleil dans le calcul de diffusion
// Part du voile gardée devant le sol : 0,15.
const DISC_GAIN = 0.15;     // part du voile gardée devant le sol, pour ne pas délaver les cartes
// Accélération de la super-rotation de Vénus : 2880 fois.
const SUPER_ROTATION_ACCELERATION = 2880; // Vénus : un tour de nuages (4 jours) en 2 minutes d'écran
// Distance, en rayons de l'astre, au-delà de laquelle la coquille n'est plus dessinée : 400.
const MAX_VIEW_RADII = 400; // au-delà, l'astre ne fait que quelques pixels : la coquille n'est plus dessinée

// Vecteur de travail.
const tmp = new THREE.Vector3();

/** Texture du champ de vent (weatherFlow.jsx) : grille réelle si elle est valide, sinon modèle. */
// windTexture : la texture du champ de vent à partir d'une grille (début).
function windTexture(grid) {
  // Texture de données RGBA, un octet par composante, à la taille de la texture de vent.
  const texture = new THREE.DataTexture(windTexels(grid), WIND_TEXTURE_WIDTH, WIND_TEXTURE_HEIGHT, THREE.RGBAFormat, THREE.UnsignedByteType);
  // Répétition horizontale : la longitude boucle.
  texture.wrapS = THREE.RepeatWrapping;
  // Pas de répétition verticale.
  texture.wrapT = THREE.ClampToEdgeWrapping;
  // Filtre d'agrandissement linéaire.
  texture.magFilter = THREE.LinearFilter;
  // Filtre de réduction linéaire.
  texture.minFilter = THREE.LinearFilter;
  // Signale à three.js que la texture est à envoyer.
  texture.needsUpdate = true;
  // La renvoie.
  return texture;
// Fin de windTexture.
}

/** Octets de la grille de nuages { width, height, cover (base64) }, ou null si elle est incohérente. */
// Déclare et exporte decodeCover : la grille de couverture nuageuse.
export function decodeCover(grid) {
  // Grille absente, ou largeur et hauteur qui ne sont pas des entiers d'au moins 2 : null.
  if (!grid || !Number.isInteger(grid.width) || !Number.isInteger(grid.height) || grid.width < 2 || grid.height < 2) return null;
  // Couverture qui n'est pas une chaîne : null.
  if (typeof grid.cover !== 'string') return null;
  // Chaîne binaire décodée.
  let binary;
  // Décode le base64 ; en cas d'erreur : null.
  try { binary = atob(grid.cover); } catch { return null; }
  // Longueur différente de largeur × hauteur : null.
  if (binary.length !== grid.width * grid.height) return null;
  // Tableau d'octets de la même longueur.
  const bytes = new Uint8Array(binary.length);
  // Copie le code de chaque caractère.
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  // Renvoie les octets.
  return bytes;
// Fin de decodeCover.
}

/**
 * Atmosphère de l'astre `id` (rayon `radius` en unités de la scène), à ajouter au groupe de l'astre.
 * `uniforms` : uniforms partagés de ses cartes (TileManager.uniforms). Renvoie null si l'astre n'en a pas de modélisée.
 * `getSpin` : rotation propre de l'astre (radians), pour que les nuages tournent avec lui.
 * `lite` : shaders allégés pour téléphone (voir powerSaver.jsx).
 * `group.userData.track(cameraPosition)` est à appeler à chaque image (voir plus bas).
 */
// Déclare et exporte createAtmosphere : l'identifiant, le rayon, les variables uniformes partagées, la rotation propre et l'option d'allègement.
export function createAtmosphere(id, radius, uniforms, getSpin = null, { lite = false } = {}) {
  // La description de l'atmosphère de l'astre.
  const spec = ATMOSPHERES[id];
  // Ses paramètres de diffusion.
  const p = scatterParams(id);
  // L'un des deux manque : null.
  if (!spec || !p) return null;
  // Qualité des shaders, complète ou allégée.
  const q = shaderQuality(lite);
  // Constantes des shaders de nuages : le nombre d'octaves et la somme de leurs amplitudes.
  const cloudDefines = { CLOUD_OCTAVES: q.octaves, CLOUD_NORM: fbmNorm(q.octaves).toFixed(5) };
  // Groupe de l'atmosphère.
  const group = new THREE.Group();

  // Couches de nuages qui tournent avec l'astre.
  const cloudLayers = []; // tournent avec l'astre
  // Rayon de la couche de nuages opaque, s'il y en a une.
  const cloudFactor = cloudRadiusFactor(id);
  // Avec une couche opaque (début).
  if (cloudFactor) {
    // Sphère des nuages (début).
    const clouds = new THREE.Mesh(
      // Géométrie : une sphère au rayon des nuages.
      new THREE.SphereGeometry(radius * cloudFactor, 96, 72),
      // Matériau à shader (début).
      new THREE.ShaderMaterial({
        // Ses constantes.
        defines: cloudDefines,
        // Ses variables uniformes : la direction du Soleil et l'ombre, partagées.
        uniforms: { sunV: uniforms.sunV, shade: uniforms.shade },
        // Les shaders des nuages de Vénus, les deux faces dessinées.
        vertexShader: cloudVertexShader, fragmentShader: venusCloudFragmentShader, side: THREE.DoubleSide,
      // Fin du matériau.
      }),
    // Fin de la sphère.
    );
    // Autorise le shader à écrire la profondeur du fragment.
    clouds.material.extensions = { fragDepth: true };
    // L'ajoute au groupe.
    group.add(clouds);
    // L'ajoute aux couches qui tournent.
    cloudLayers.push(clouds);
  // Fin du cas avec couche opaque.
  }

  // Nuages simulés : aucun pour l'instant.
  let simClouds = null;
  // Si l'astre en a (début).
  if (spec.simClouds) {
    // Sphère des nuages simulés (début).
    simClouds = new THREE.Mesh(
      // Géométrie : une sphère à l'altitude des nuages.
      new THREE.SphereGeometry(radius * (1 + spec.simClouds.altitudeKm / spec.radiusKm), 96, 72),
      // Matériau à shader (début).
      new THREE.ShaderMaterial({
        // Ses constantes.
        defines: cloudDefines,
        // Ses variables uniformes (début).
        uniforms: {
          // Le Soleil et l'ombre partagés, le fondu à 1 et l'opacité de la description.
          sunV: uniforms.sunV, shade: uniforms.shade, fade: { value: 1 }, opacity: { value: spec.simClouds.opacity },
          // La carte de couverture, vide, et son mode à 0.
          coverMap: { value: null }, coverOn: { value: 0 },
          // La carte du vent du modèle, l'état de l'animation et son interrupteur à 1.
          windMap: { value: windTexture(null) }, flow: { value: new THREE.Vector3(0, 0, 0) }, flowOn: { value: 1 },
        // Fin des variables uniformes.
        },
        // Les shaders des nuages de la Terre.
        vertexShader: cloudVertexShader, fragmentShader: earthCloudFragmentShader,
        // Transparent, sans écriture de la profondeur, face avant seulement.
        transparent: true, depthWrite: false, side: THREE.FrontSide,
      // Fin du matériau.
      }),
    // Fin de la sphère.
    );
    // Autorise le shader à écrire la profondeur du fragment.
    simClouds.material.extensions = { fragDepth: true };
    // Ordre de dessin : 1.
    simClouds.renderOrder = 1; // après les cartes, avant la coquille de diffusion
    // L'ajoute au groupe.
    group.add(simClouds);
    // L'ajoute aux couches qui tournent.
    cloudLayers.push(simClouds);
    // Nuages réels : la grille reçue de l'API devient la carte de couverture (lignes du sud au nord, depuis -180°).
    // setCloudCover : reçoit la grille de couverture réelle (début).
    group.userData.setCloudCover = (grid) => {
      // Ses octets.
      const bytes = decodeCover(grid);
      // Grille incohérente : refusée.
      if (!bytes) return false;
      // Les variables uniformes des nuages.
      const u = simClouds.material.uniforms;
      // Libère la carte précédente.
      u.coverMap.value?.dispose();
      // Texture de données à un canal, à la taille de la grille.
      const texture = new THREE.DataTexture(bytes, grid.width, grid.height, THREE.LuminanceFormat, THREE.UnsignedByteType);
      // Alignement d'un octet.
      texture.unpackAlignment = 1; // un octet par case : les lignes ne sont pas alignées sur 4 octets
      // Répétition horizontale.
      texture.wrapS = THREE.RepeatWrapping;
      // Pas de répétition verticale.
      texture.wrapT = THREE.ClampToEdgeWrapping;
      // Filtre d'agrandissement linéaire.
      texture.magFilter = THREE.LinearFilter;
      // Filtre de réduction linéaire.
      texture.minFilter = THREE.LinearFilter;
      // Signale à three.js que la texture est à envoyer.
      texture.needsUpdate = true;
      // La pose comme carte de couverture.
      u.coverMap.value = texture;
      // Mode 1 : grille de couverture.
      u.coverOn.value = 1;
      // Acceptée.
      return true;
    // Fin de setCloudCover.
    };
    // Vents réels du moment (GET /tiles/earth-wind) à la place du modèle de circulation générale.
    // setWind : reçoit la grille de vent réelle (début).
    group.userData.setWind = (grid) => {
      // Grille inutilisable : refusée.
      if (!isWindGrid(grid)) return false;
      // Les variables uniformes des nuages.
      const u = simClouds.material.uniforms;
      // Libère la carte du vent précédente.
      u.windMap.value?.dispose();
      // Pose la nouvelle carte du vent.
      u.windMap.value = windTexture(grid);
      // Acceptée.
      return true;
    // Fin de setWind.
    };
    // Nuages réels vus par satellite : mosaïque mondiale en projection de Mercator (earthCloudMosaic.jsx).
    // setCloudMosaic : reçoit le canevas de la mosaïque satellite (début).
    group.userData.setCloudMosaic = (canvas) => {
      // Canevas absent ou vide : refusé.
      if (!canvas || !canvas.width || !canvas.height) return false;
      // Les variables uniformes des nuages.
      const u = simClouds.material.uniforms;
      // Libère la carte précédente.
      u.coverMap.value?.dispose();
      // Texture faite à partir du canevas.
      const texture = new THREE.CanvasTexture(canvas);
      // Répétition horizontale.
      texture.wrapS = THREE.RepeatWrapping;
      // Pas de répétition verticale.
      texture.wrapT = THREE.ClampToEdgeWrapping;
      // Pas de mipmaps.
      texture.generateMipmaps = false;
      // Filtre de réduction linéaire.
      texture.minFilter = THREE.LinearFilter;
      // Filtre d'agrandissement linéaire.
      texture.magFilter = THREE.LinearFilter;
      // La pose comme carte de couverture.
      u.coverMap.value = texture;
      // Mode 2 : mosaïque satellite.
      u.coverOn.value = 2;
      // Acceptée.
      return true;
    // Fin de setCloudMosaic.
    };
  // Fin du cas des nuages simulés.
  }

  // Rayon de la coquille : le sommet de l'atmosphère.
  const shellRadius = radius * p.top;
  // Matériau de la coquille (début).
  const material = new THREE.ShaderMaterial({
    // Ses constantes : le nombre de pas de diffusion et de pas vers le Soleil.
    defines: { SCATTER_STEPS: q.scatterSteps, LIGHT_STEPS: q.lightSteps },
    // Ses variables uniformes (début).
    uniforms: {
      // La direction du Soleil, partagée, et le rayon de l'astre.
      sunV: uniforms.sunV, planetR: { value: radius },
      // Les coefficients et la hauteur d'échelle de Rayleigh.
      betaR: { value: new THREE.Vector3(...p.betaR) }, hR: { value: p.hR },
      // Les coefficients de Mie et d'extinction.
      betaM: { value: new THREE.Vector3(...p.betaM) }, betaE: { value: new THREE.Vector3(...p.betaE) },
      // La hauteur d'échelle et l'asymétrie de Mie.
      hM: { value: p.hM }, gM: { value: p.g },
      // Le niveau de référence et le sommet de l'atmosphère.
      rGround: { value: p.ground }, rTop: { value: p.top },
      // L'intensité du Soleil et la part du voile devant le sol.
      sunI: { value: SUN_INTENSITY }, discGain: { value: DISC_GAIN },
    // Fin des variables uniformes.
    },
    // Les shaders de la coquille.
    vertexShader: shellVertexShader, fragmentShader: shellFragmentShader,
    // Transparent, en mélange additif, sans écriture de la profondeur, face avant.
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
  // Fin du matériau.
  });
  // Autorise le shader à écrire la profondeur du fragment.
  material.extensions = { fragDepth: true };
  // La coquille : une sphère au rayon du sommet.
  const shell = new THREE.Mesh(new THREE.SphereGeometry(shellRadius, 96, 72), material);
  // Ordre de dessin : 2.
  shell.renderOrder = 2; // après les cartes et les nuages de l'astre
  // L'ajoute au groupe.
  group.add(shell);

  // De dehors, on dessine la face avant de la coquille (les astres placés devant la masquent normalement). Quand la
  // caméra entre dans l'atmosphère, cette face disparaît : on passe à la face arrière, sans test de profondeur,
  // pour que le ciel et le voile restent dessinés par-dessus le sol.
  // La caméra est-elle dans l'atmosphère : non au départ.
  let inside = false;
  // track : à appeler à chaque image avec la position de la caméra (début).
  group.userData.track = (cameraPosition) => {
    // Distance de la caméra au centre de l'astre.
    const dist = group.getWorldPosition(tmp).distanceTo(cameraPosition);
    // La coquille n'est visible qu'en dessous de la distance maximale.
    shell.visible = dist < radius * MAX_VIEW_RADII;
    // Temps en secondes.
    const seconds = performance.now() / 1000;
    // Vénus : la haute atmosphère fait le tour de la planète en quelques jours, dans le sens de sa rotation
    // (rétrograde), en accéléré.
    // Dérive de la super-rotation : un tour en sens rétrograde par période, accélérée ; nulle sans super-rotation.
    const drift = spec.superRotationDays ? -(seconds * SUPER_ROTATION_ACCELERATION / (spec.superRotationDays * 86400)) * 2 * Math.PI : 0;
    // Avec une rotation propre ou une dérive : toutes les couches de nuages prennent leur somme.
    if (getSpin || drift) { const spin = (getSpin ? getSpin() : 0) + drift; for (const layer of cloudLayers) layer.rotation.y = spin; }
    // Avec des nuages simulés (début).
    if (simClouds) {
      // État de l'animation du vent.
      const f = flowState(seconds);
      // Le transmet au shader.
      simClouds.material.uniforms.flow.value.set(f.s0, f.s1, f.weight1);
      // Fondu selon l'altitude de la caméra en kilomètres.
      const fade = simCloudFade(id, (dist / radius - 1) * spec.radiusKm);
      // Le transmet au shader.
      simClouds.material.uniforms.fade.value = fade;
      // Les nuages ne sont dessinés que si le fondu n'est pas nul.
      simClouds.visible = fade > 0;
    // Fin de ce cas.
    }
    // La caméra est-elle maintenant sous le sommet de l'atmosphère, à 0,2 % près.
    const now = dist < shellRadius * 1.002;
    // Pas de changement : terminé.
    if (now === inside) return;
    // Mémorise le nouvel état.
    inside = now;
    // Dedans : face arrière ; dehors : face avant.
    material.side = inside ? THREE.BackSide : THREE.FrontSide;
    // Dedans : sans test de profondeur.
    material.depthTest = !inside;
    // Signale à three.js que le matériau a changé.
    material.needsUpdate = true;
  // Fin de track.
  };
  // Renvoie le groupe.
  return group;
// Fin de createAtmosphere.
}
