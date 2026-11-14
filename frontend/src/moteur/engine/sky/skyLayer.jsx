// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe la somme des amplitudes du bruit et la qualité des shaders, depuis powerSaver.
import { fbmNorm, shaderQuality } from '../powerSaver';
// Importe la liste des galaxies, le décodage du catalogue, la base d'une galaxie et le repère galactique, depuis skyMath.
import { DEEP_SKY, decodeStarCatalog, deepSkyBasis, galacticFrame } from './skyMath';

/** Catalogue d'étoiles (Yale Bright Star Catalogue, ~9 100 étoiles, 71 Ko), voir scripts/build-star-catalog.mjs. */
// Déclare et exporte l'adresse du catalogue d'étoiles.
export const STAR_CATALOG_URL = '/data/stars-bsc5.bin';
// Déclare et exporte la mention de la source des étoiles.
export const SKY_ATTRIBUTION = 'Étoiles : Yale Bright Star Catalogue (BSC5)';

// D : le nombre de radians dans un degré.
const D = Math.PI / 180;
// Constante de temps du lissage de l'intensité : 250 ms.
const FADE_MS = 250; // lissage de l'intensité (éblouissement, jour/nuit)

// Bruit de valeur 3D et FBM : la Voie lactée est calculée dans le repère galactique, sans texture.
// Code GLSL du bruit, écrit sur les lignes suivantes jusqu'à l'accent grave fermant.
// hash3 : nombre pseudo-aléatoire entre 0 et 1 à partir d'un point (partie fractionnaire, multiplication par 17, puis partie fractionnaire d'un produit des coordonnées).
// noise3 : bruit lissé ; partie entière et partie fractionnaire du point, courbe de lissage, puis interpolation entre les huit coins du cube.
// Constantes par défaut : 5 octaves et un gain de 1, si le matériau ne les a pas définies.
// fbm : somme des octaves ; à chaque octave le bruit est ajouté avec une amplitude divisée par deux, et le point est multiplié par 2,03 et décalé ; le résultat est multiplié par le gain.
const NOISE_GLSL = /* glsl */`
  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
  }
  // Octaves du bruit, et gain qui garde la luminosité de la version à 5 octaves : réglables par les « defines » du matériau.
  #ifndef SKY_OCTAVES
  #define SKY_OCTAVES 5
  #define SKY_GAIN 1.0
  #endif
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < SKY_OCTAVES; i++) {
      v += a * noise3(p);
      p = p * 2.03 + vec3(17.1, 9.2, 3.7);
      a *= 0.5;
    }
    return v * SKY_GAIN;
  }
`;

// Code GLSL du shader de sommets de la Voie lactée, écrit sur les lignes suivantes jusqu'à l'accent grave fermant.
// Il transmet la position du sommet comme direction (vDir), calcule la position à l'écran, puis remplace sa profondeur par sa composante w : le ciel est toujours au plan lointain.
const MILKY_WAY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // toujours au plan lointain
  }
`;

// Code GLSL du shader de fragments de la Voie lactée, écrit sur les lignes suivantes jusqu'à l'accent grave fermant ; le code du bruit y est inséré après les déclarations.
// Déclarations : la matrice vers le repère galactique, l'intensité, puis pour les trois galaxies proches leur centre, leurs deux axes, leur couleur et leurs éclats, et la direction reçue du shader de sommets.
// Fonction principale : direction unitaire et couleur noire au départ.
// Boucle des trois galaxies : si la direction est proche du centre de la galaxie, ses coordonnées le long des deux axes donnent une distance ; l'éclat est la somme d'un halo large et d'un cœur étroit, modulée par du bruit pour les galaxies grumeleuses, puis ajoutée dans la couleur de la galaxie.
// Voie lactée : direction en coordonnées galactiques, latitude b, cosinus de la longitude, longitude l, et proximité du centre galactique (de 0 à 1) ; largeur du disque de 0,07 à 0,17 radian ; disque, bulbe et halo en fonctions gaussiennes, dont la somme est la base.
// Si la base n'est pas négligeable : point étiré le long du plan, deux bruits (nuages et détail) qui modulent la luminosité du disque et du bulbe ; puis la poussière : bandes sombres le long du plan et Grand Rift vers le centre, qui absorbent jusqu'à 85 % de la lumière ; teinte du bleuté au jaune chaud vers le centre, rougie par la poussière ; ajout à la couleur avec un facteur de 0,22.
// Fin : la couleur est multipliée par l'intensité, un léger tramage est ajouté là où elle n'est pas noire, et le fragment est écrit, opaque.
const MILKY_WAY_FRAG = /* glsl */`
  uniform mat3 uToGal;        // scène → repère galactique (x : centre, z : pôle nord)
  uniform float uIntensity;
  uniform vec3 uGalC[3];      // galaxies proches : centre, axe majeur / demi-axe, axe mineur / demi-axe
  uniform vec3 uGalA[3];
  uniform vec3 uGalB[3];
  uniform vec3 uGalColor[3];
  uniform vec3 uGalLum[3];    // halo, cœur, aspect grumeleux
  varying vec3 vDir;
  ${NOISE_GLSL}

  void main() {
    vec3 dir = normalize(vDir);
    vec3 col = vec3(0.0);

    // Galaxies du ciel austral et Andromède : ellipses gaussiennes à leur position réelle.
    for (int i = 0; i < 3; i++) {
      if (dot(dir, uGalC[i]) > 0.95) {
        float x = dot(dir, uGalA[i]);
        float y = dot(dir, uGalB[i]);
        float r2 = x * x + y * y;
        float g = exp(-r2 * 2.5) * uGalLum[i].x + exp(-r2 * 30.0) * uGalLum[i].y;
        g *= mix(1.0, 0.45 + 1.1 * fbm(dir * 60.0), uGalLum[i].z);
        col += uGalColor[i] * g;
      }
    }

    // Voie lactée : disque mince, plus large et plus clair vers le centre galactique (Sagittaire), bulbe, halo.
    vec3 g = uToGal * dir;
    float b = asin(clamp(g.z, -1.0, 1.0));
    float horiz = max(length(g.xy), 1e-4);
    float cl = g.x / horiz;                 // cos(longitude galactique)
    float l = atan(g.y, g.x);
    float center = 0.5 + 0.5 * cl;
    float width = mix(0.07, 0.17, center * center * center);
    float disk = exp(-(b * b) / (width * width)) * (0.3 + 0.7 * center * center);
    float bulge = exp(-((l * l) / 0.09 + (b * b) / 0.035));
    float halo = exp(-(b * b) / 0.12) * 0.1 * (0.4 + 0.6 * center);
    float base = disk + 0.9 * bulge + halo;

    if (base > 0.003) {
      vec3 gn = vec3(g.x, g.y, g.z * 2.6);  // structures étirées le long du plan galactique
      float clouds = fbm(gn * 3.2);
      float detail = fbm(gn * 13.0 + 5.3);
      float lum = disk * (0.2 + 1.9 * clouds * clouds) * (0.6 + 0.8 * detail) + 0.9 * bulge * (0.7 + 0.6 * clouds) + halo;

      // Nuages de poussière : bandes sombres le long du plan, Grand Rift vers le centre.
      float dust = fbm(gn * 7.0 + 11.3);
      float lanes = smoothstep(0.45, 0.72, dust) * exp(-(b * b) / (width * width * 0.3)) * (0.35 + 0.65 * center);
      float rift = exp(-((b - 0.012) * (b - 0.012)) / (width * width * 0.035))
        * smoothstep(0.25, 0.85, center) * smoothstep(0.3, 0.55, fbm(gn * 4.0 + 3.1));
      float absorb = clamp(lanes + 0.8 * rift, 0.0, 1.0);
      lum *= 1.0 - 0.85 * absorb;

      vec3 tint = mix(vec3(0.66, 0.73, 1.0), vec3(1.0, 0.86, 0.68), clamp(center * center * 0.8 + bulge * 0.6, 0.0, 1.0));
      tint *= mix(vec3(1.0), vec3(1.0, 0.78, 0.6), absorb * 0.6);
      col += tint * lum * 0.22;
    }

    col *= uIntensity;
    // Tramage léger contre les bandes de dégradé sur un fond 8 bits.
    col += (hash3(vec3(gl_FragCoord.xy, 1.0)) - 0.5) / 255.0 * step(0.002, col.r + col.g + col.b);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Code GLSL du shader de sommets des étoiles, écrit sur les lignes suivantes jusqu'à l'accent grave fermant.
// Il reçoit la magnitude et la couleur de l'étoile, la densité de pixels et l'intensité ; il transmet la couleur, calcule une opacité qui croît quand la magnitude diminue (entre 0,3 et 1, multipliée par l'intensité) et une taille de point de 2,5 à 11 pixels multipliée par la densité, puis place le point au plan lointain.
const STARS_VERT = /* glsl */`
  attribute float aMag;
  attribute vec3 aColor;
  uniform float uDpr;
  uniform float uIntensity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    // Plus l'étoile est brillante (magnitude faible), plus le point est grand et opaque.
    vAlpha = clamp(pow(10.0, -0.4 * (aMag - 3.0)), 0.3, 1.0) * uIntensity;
    gl_PointSize = clamp(7.0 - 0.8 * aMag, 2.5, 11.0) * uDpr;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

// Code GLSL du shader de fragments des étoiles, écrit sur les lignes suivantes jusqu'à l'accent grave fermant.
// Coordonnées du point entre −1 et 1 et carré de la distance au centre ; hors du disque le fragment n'est pas dessiné ; sinon l'éclat est la somme d'un halo large et d'un cœur étroit, multipliée par l'opacité de l'étoile.
const STARS_FRAG = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    float a = 0.55 * exp(-r2 * 3.0) + 0.9 * exp(-r2 * 12.0);
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

/**
 * Ciel au-delà du Système solaire, rendu avant la scène dans une scène séparée :
 * sa caméra ne copie que l'orientation de la caméra principale, ce qui le rend indépendant de l'origine
 * flottante, du plan proche dynamique et du tampon de profondeur logarithmique.
 *  - étoiles réelles (positions, magnitudes, couleurs) chargées depuis STAR_CATALOG_URL ;
 *  - Voie lactée procédurale orientée selon le vrai repère galactique ;
 *  - Andromède et les Nuages de Magellan à leur position réelle.
 */
// Déclare et exporte la classe SkyLayer (début).
export class SkyLayer {
  /** `lite` : Voie lactée calculée avec moins d'octaves de bruit (téléphone, voir powerSaver.jsx). */
  // Constructeur : l'adresse du catalogue, la fonction appelée au chargement et l'option d'allègement (début).
  constructor({ url = STAR_CATALOG_URL, onLoad, lite = false } = {}) {
    // Nombre d'octaves du bruit, selon la qualité.
    const octaves = shaderQuality(lite).octaves;
    // Scène séparée du ciel.
    this.scene = new THREE.Scene();
    // Caméra du ciel.
    this.cam = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
    // Visible.
    this.visible = true;
    // Intensité actuelle : 1.
    this.intensity = 1;
    // Intensité visée : 1.
    this.intensityGoal = 1;
    // Pas encore libéré.
    this.disposed = false;

    // Repère galactique.
    const gal = galacticFrame();
    // Lignes de la matrice = axes galactiques : uToGal * dir donne les coordonnées galactiques.
    // Matrice dont les lignes sont les trois axes galactiques.
    const toGal = new THREE.Matrix3().set(...gal.x, ...gal.y, ...gal.z);

    // vecs : un champ de chaque galaxie, sous forme de vecteurs.
    const vecs = (key) => DEEP_SKY.map((o) => new THREE.Vector3(...o[key]));
    // Base de chaque galaxie, avec ses deux demi-axes en radians.
    const bases = DEEP_SKY.map((o) => ({ ...deepSkyBasis(o.ra, o.dec, o.pa), a: o.a * D, b: o.b * D }));
    // Sphère de la Voie lactée (début).
    this.milkyWay = new THREE.Mesh(
      // Géométrie : une sphère de rayon 1.
      new THREE.SphereGeometry(1, 96, 48),
      // Matériau à shader (début).
      new THREE.ShaderMaterial({
        // Ses constantes : le nombre d'octaves et le gain qui garde la luminosité de la version à 5 octaves.
        defines: { SKY_OCTAVES: octaves, SKY_GAIN: (fbmNorm(5) / fbmNorm(octaves)).toFixed(5) },
        // Ses variables uniformes (début).
        uniforms: {
          // La matrice vers le repère galactique.
          uToGal: { value: toGal },
          // L'intensité : 1.
          uIntensity: { value: 1 },
          // Le centre de chaque galaxie.
          uGalC: { value: bases.map((s) => new THREE.Vector3(...s.center)) },
          // Son grand axe, divisé par le demi-grand axe.
          uGalA: { value: bases.map((s) => new THREE.Vector3(...s.major).divideScalar(s.a)) },
          // Son petit axe, divisé par le demi-petit axe.
          uGalB: { value: bases.map((s) => new THREE.Vector3(...s.minor).divideScalar(s.b)) },
          // Sa couleur.
          uGalColor: { value: vecs('color') },
          // Ses éclats de halo et de cœur, multipliés par 0,16, et son aspect grumeleux.
          uGalLum: { value: DEEP_SKY.map((o) => new THREE.Vector3(o.glow * 0.16, o.core * 0.16, o.clumpy)) },
        // Fin des variables uniformes.
        },
        // Le shader de sommets.
        vertexShader: MILKY_WAY_VERT,
        // Le shader de fragments.
        fragmentShader: MILKY_WAY_FRAG,
        // Face intérieure de la sphère.
        side: THREE.BackSide,
        // Sans test de profondeur.
        depthTest: false,
        // Sans écriture de la profondeur.
        depthWrite: false,
      // Fin du matériau.
      })
    // Fin de la sphère.
    );
    // Ordre de dessin : 0.
    this.milkyWay.renderOrder = 0;
    // L'ajoute à la scène du ciel.
    this.scene.add(this.milkyWay);

    // Matériau des étoiles (début).
    this.starMaterial = new THREE.ShaderMaterial({
      // Ses variables uniformes : la densité de pixels et l'intensité.
      uniforms: { uDpr: { value: 1 }, uIntensity: { value: 1 } },
      // Le shader de sommets.
      vertexShader: STARS_VERT,
      // Le shader de fragments.
      fragmentShader: STARS_FRAG,
      // Transparent.
      transparent: true,
      // En mélange additif.
      blending: THREE.AdditiveBlending,
      // Sans test de profondeur.
      depthTest: false,
      // Sans écriture de la profondeur.
      depthWrite: false,
    // Fin du matériau.
    });
    // Points des étoiles : aucun avant le chargement.
    this.stars = null;

    // Contrôleur d'annulation, s'il existe dans l'environnement.
    this.ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    // Télécharge le catalogue.
    fetch(url, { signal: this.ctrl?.signal })
      // Réponse correcte : ses octets ; sinon une erreur avec le code HTTP.
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      // Quand les octets sont arrivés (début).
      .then((buf) => {
        // Ciel déjà libéré : rien à faire.
        if (this.disposed) return;
        // Décode le catalogue et pose les étoiles.
        this.setStars(decodeStarCatalog(buf));
        // Appelle la fonction de chargement.
        onLoad?.();
      // Fin du traitement.
      })
      // Erreur ignorée.
      .catch(() => { /* sans catalogue, la Voie lactée reste affichée */ });
  // Fin du constructeur.
  }

  // setStars : reçoit les positions, les magnitudes et les couleurs (début).
  setStars({ positions, mags, colors }) {
    // Géométrie.
    const geo = new THREE.BufferGeometry();
    // Son attribut de positions.
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    // Son attribut de magnitudes.
    geo.setAttribute('aMag', new THREE.BufferAttribute(mags, 1));
    // Son attribut de couleurs.
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    // Les points des étoiles.
    this.stars = new THREE.Points(geo, this.starMaterial);
    // Jamais écartés par le test de visibilité.
    this.stars.frustumCulled = false;
    // Ordre de dessin : 1.
    this.stars.renderOrder = 1;
    // Les ajoute à la scène du ciel.
    this.scene.add(this.stars);
  // Fin de setStars.
  }

  // setVisible : garde l'état, converti en booléen.
  setVisible(on) { this.visible = Boolean(on); }

  /** Intensité visée (0..1), atteinte en douceur : éblouissement solaire, ciel de jour. */
  // setTargetIntensity : garde l'intensité visée, bornée entre 0 et 1.
  setTargetIntensity(v) { this.intensityGoal = Math.min(1, Math.max(0, v)); }

  /** Rend le ciel avec l'orientation et le champ de `cam`. À appeler après renderer.clear(), avant la scène. */
  // render : le moteur de rendu, la caméra principale et le temps écoulé, 16 ms par défaut (début).
  render(renderer, cam, dt = 16) {
    // Ciel masqué : rien à faire.
    if (!this.visible) return;
    // Rapproche l'intensité de l'intensité visée, selon le temps écoulé (200 ms au plus).
    this.intensity += (this.intensityGoal - this.intensity) * (1 - Math.exp(-Math.min(dt, 200) / FADE_MS));
    // Intensité négligeable : rien n'est dessiné.
    if (this.intensity < 0.005) return;

    // La caméra du ciel.
    const c = this.cam;
    // Si le champ ou les proportions ont changé (début).
    if (c.fov !== cam.fov || c.aspect !== cam.aspect) {
      // Copie le champ.
      c.fov = cam.fov;
      // Copie les proportions.
      c.aspect = cam.aspect;
      // Recalcule la matrice de projection.
      c.updateProjectionMatrix();
    // Fin de ce cas.
    }
    // Copie l'orientation de la caméra principale.
    c.quaternion.copy(cam.quaternion);
    // Met à jour sa matrice.
    c.updateMatrixWorld();

    // Transmet l'intensité à la Voie lactée.
    this.milkyWay.material.uniforms.uIntensity.value = this.intensity;
    // Transmet l'intensité aux étoiles.
    this.starMaterial.uniforms.uIntensity.value = this.intensity;
    // Transmet la densité de pixels aux étoiles.
    this.starMaterial.uniforms.uDpr.value = renderer.getPixelRatio();
    // Dessine la scène du ciel.
    renderer.render(this.scene, c);
  // Fin de render.
  }

  // dispose : libère le ciel (début).
  dispose() {
    // Note qu'il est libéré.
    this.disposed = true;
    // Annule le téléchargement en cours.
    this.ctrl?.abort();
    // Libère la géométrie de la Voie lactée.
    this.milkyWay.geometry.dispose();
    // Libère son matériau.
    this.milkyWay.material.dispose();
    // Libère la géométrie des étoiles.
    this.stars?.geometry.dispose();
    // Libère leur matériau.
    this.starMaterial.dispose();
  // Fin de dispose.
  }
// Fin de la classe SkyLayer.
}
