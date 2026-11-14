// Importe de React les crochets useEffect, useRef et useState.
import { useEffect, useRef, useState } from 'react';
// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';

/**
 * Plateau noir qui tourne, avec un globe habillé du fond de carte actif de l'astre.
 * Lecture/pause, quarts de tour, glisser avec inertie. `globe` : canvas équirectangulaire 2:1 (ou null).
 * À placer dans un conteneur qui a une hauteur.
 */
// Déclare et exporte le composant PlateauTournant : carte du globe, vitesse (0,35 rad/s par défaut), lecture automatique et styles.
export function PlateauTournant({ globe = null, speed = 0.35, autoPlay = true, style }) {
  // Référence vers le conteneur du canvas.
  const mountRef = useRef(null);
  // Référence de pilotage : lecture en cours et angle visé.
  const ctrl = useRef({ playing: autoPlay, target: null });
  // État : lecture en cours ou non.
  const [playing, setPlaying] = useState(autoPlay);

  // Recopie l'état de lecture dans la référence, pour la boucle d'animation.
  useEffect(() => { ctrl.current.playing = playing; }, [playing]);

  // Déclare turn : demande un quart de tour (dir : -1 ou 1).
  const turn = (dir) => {
    // Récupère la référence de pilotage.
    const c = ctrl.current;
    // L'angle visé avance d'un quart de tour, depuis l'angle déjà visé ou l'angle courant.
    c.target = (c.target ?? c.angle ?? 0) + dir * Math.PI / 2;
  // Fin de turn.
  };

  // Effet qui construit la scène 3D.
  useEffect(() => {
    // Récupère le conteneur.
    const mount = mountRef.current;
    // Récupère la référence de pilotage.
    const c = ctrl.current;
    // Angle de départ du plateau.
    c.angle = 0;
    // Si le système demande moins d'animations, la lecture est mise en pause.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(false);

    // Crée le moteur de rendu WebGL, avec lissage et fond transparent.
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // Densité de pixels : celle de l'écran, plafonnée à 2.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Couleurs de sortie en sRGB.
    renderer.outputEncoding = THREE.sRGBEncoding;
    // Ajoute le canvas au conteneur.
    mount.appendChild(renderer.domElement);

    // Crée la scène.
    const scene = new THREE.Scene();
    // Crée la caméra en perspective : 32 degrés d'ouverture, plans proche et lointain à 0,1 et 100.
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    // Ajoute une lumière ambiante gris-bleu, faible.
    scene.add(new THREE.AmbientLight(0x8090a0, 0.35));
    // Lumière principale, blanche, placée en haut et devant.
    const key = new THREE.PointLight(0xffffff, 1.4, 30); key.position.set(0, 6, 4); scene.add(key);
    // Lumière de contour, bleutée, placée à gauche et derrière.
    const rim = new THREE.PointLight(0xaabbdd, 0.8, 30); rim.position.set(-6, 3, -5); scene.add(rim);

    // ---------- Plateau ----------
    // Crée le groupe du plateau.
    const turntable = new THREE.Group();
    // L'ajoute à la scène.
    scene.add(turntable);
    // Rayon et hauteur du plateau.
    const R = 4.2, H = 0.36;
    // Le disque du plateau (début).
    const base = new THREE.Mesh(
      // Un cylindre très plat, à peine plus large en bas.
      new THREE.CylinderGeometry(R, R * 1.01, H, 128),
      // Matériau sombre, métallique, légèrement brillant.
      new THREE.MeshStandardMaterial({ color: 0x15181d, metalness: 0.85, roughness: 0.32 })
    // Fin du disque.
    );
    // Le place pour que son dessus soit à la hauteur 0.
    base.position.y = -H / 2;
    // L'ajoute au plateau.
    turntable.add(base);

    // Le sillon près du bord (début).
    const groove = new THREE.Mesh(
      // Un anneau très fin.
      new THREE.RingGeometry(R * 0.955, R * 0.962, 160),
      // Gris clair, à 35 % d'opacité.
      new THREE.MeshBasicMaterial({ color: 0x9aa4b2, transparent: true, opacity: 0.35 })
    // Fin du sillon.
    );
    // Le couche à l'horizontale, juste au-dessus du disque.
    groove.rotation.x = -Math.PI / 2; groove.position.y = 0.002;
    // L'ajoute au plateau.
    turntable.add(groove);

    // Bandes lumineuses sur la tranche (fixes).
    // Matériau des bandes : blanc, visible des deux côtés.
    const bandMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    // Matériau du halo : bleu clair translucide, en mélange additif, sans écriture de profondeur.
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    // Deux bandes, chacune d'un demi-tour (angle de départ et longueur, en fractions de π).
    [[-0.78, 0.5], [0.28, 0.5]].forEach(([start, len]) => {
      // La bande : un arc de cylindre ouvert, très fin, juste autour du plateau.
      const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.012, R * 1.012, 0.03, 96, 1, true, Math.PI * start, Math.PI * len), bandMat);
      // La place sur la tranche et l'ajoute à la scène (elle ne tourne pas).
      band.position.y = -H * 0.55; scene.add(band);
      // Son halo : le même arc, plus haut et un peu plus large.
      const halo = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.14, 96, 1, true, Math.PI * start, Math.PI * len), glowMat);
      // Le place au même endroit et l'ajoute à la scène.
      halo.position.y = -H * 0.55; scene.add(halo);
    // Fin des bandes.
    });

    // ---------- Globe ----------
    // Rayon du globe.
    const GR = 1.7;
    // Matériau du globe : gris-bleu sombre, mat, non métallique.
    const globeMat = new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.85, metalness: 0 });
    // Le globe : une sphère finement découpée.
    const globeMesh = new THREE.Mesh(new THREE.SphereGeometry(GR, 128, 96), globeMat);
    // Le place au-dessus du plateau.
    globeMesh.position.y = GR + 0.25;
    // L'ajoute au plateau.
    turntable.add(globeMesh);
    // Halo lumineux (face arrière, additive) : même esprit que les arêtes des blocs.
    // Matériau du halo du globe, écrit en GLSL (début).
    const rimMat = new THREE.ShaderMaterial({
      // Transparent, sans écriture de profondeur, en mélange additif, dessiné sur la face arrière.
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      // Programme de sommets : transmet la normale et la direction de vue.
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      // Programme de fragments : lueur plus forte là où la surface est vue de biais.
      fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(vec3(0.85,0.9,1.0) * f, f); }',
    // Fin du matériau.
    });
    // La sphère du halo, 8 % plus grande que le globe.
    const rimMesh = new THREE.Mesh(new THREE.SphereGeometry(GR * 1.08, 64, 48), rimMat);
    // La place au même endroit que le globe.
    rimMesh.position.copy(globeMesh.position);
    // L'ajoute au plateau.
    turntable.add(rimMesh);
    // Socle : anneau lumineux sous le globe.
    // Le socle : un anneau blanc très fin.
    const foot = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.018, 8, 96), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    // Le couche à l'horizontale, juste au-dessus du disque.
    foot.rotation.x = Math.PI / 2; foot.position.y = 0.02;
    // L'ajoute au plateau.
    turntable.add(foot);
    // Garde le matériau du globe dans la référence.
    c.globeMat = globeMat;
    // Garde le moteur de rendu dans la référence.
    c.renderer = renderer;
    // Applique la carte du globe, si la fonction existe déjà.
    c.applyGlobe?.();

    // ---------- Taille ----------
    // Déclare resize, qui adapte le rendu à la taille du conteneur.
    const resize = () => {
      // Largeur et hauteur du conteneur (hauteur de 1 au moins).
      const w = mount.clientWidth, h = mount.clientHeight || 1;
      // Taille du rendu.
      renderer.setSize(w, h);
      // Proportions de la caméra.
      camera.aspect = w / h;
      // Distance de la caméra : plus loin sur un écran en hauteur.
      const dist = w / h < 1 ? 22 : 15.5;
      // Place la caméra en hauteur et en arrière.
      camera.position.set(0, dist * 0.36, dist);
      // Elle regarde un point situé au-dessus du plateau.
      camera.lookAt(0, 1.6, 0);
      // Met à jour la projection.
      camera.updateProjectionMatrix();
    // Fin de resize.
    };
    // Crée un observateur de taille.
    const ro = new ResizeObserver(resize);
    // Observe le conteneur.
    ro.observe(mount);
    // Première mise à la taille.
    resize();

    // ---------- Glisser ----------
    // Abscisse du glisser (null hors glisser), instant de la dernière mesure et vitesse.
    let dragX = null, lastT = 0, velocity = 0;
    // Le canvas.
    const el = renderer.domElement;
    // Gestes tactiles réservés.
    el.style.touchAction = 'none';
    // Curseur en main.
    el.style.cursor = 'grab';
    // down : début du glisser ; mémorise la position, annule l'angle visé et la vitesse, capture le pointeur.
    const down = (e) => { dragX = e.clientX; lastT = performance.now(); c.target = null; velocity = 0; el.setPointerCapture(e.pointerId); };
    // Déclare move : glisser en cours.
    const move = (e) => {
      // Hors glisser, rien à faire.
      if (dragX === null) return;
      // Angle parcouru (0,008 radian par pixel) et instant présent.
      const dx = (e.clientX - dragX) * 0.008, now = performance.now();
      // Tourne le plateau et calcule la vitesse, en radians par seconde.
      c.angle += dx; velocity = (dx / Math.max(1, now - lastT)) * 1000;
      // Mémorise la position et l'instant.
      dragX = e.clientX; lastT = now;
    // Fin de move.
    };
    // up : fin du glisser.
    const up = () => { dragX = null; };
    // Écoute l'appui.
    el.addEventListener('pointerdown', down);
    // Écoute le mouvement.
    el.addEventListener('pointermove', move);
    // Écoute le relâchement.
    el.addEventListener('pointerup', up);
    // Écoute l'annulation.
    el.addEventListener('pointercancel', up);

    // ---------- Boucle ----------
    // Identifiant de l'image d'animation et instant de l'image précédente.
    let raf, prev = performance.now();
    // Déclare frame, appelée à chaque image.
    const frame = (now) => {
      // Temps écoulé, plafonné à 0,05 s ; mémorise l'instant.
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      // Hors glisser.
      if (dragX === null) {
        // S'il y a un angle visé.
        if (c.target !== null) {
          // S'en rapproche progressivement.
          c.angle += (c.target - c.angle) * Math.min(1, dt * 6);
          // Arrivé à moins de 0,001 radian : s'y cale et oublie l'angle visé.
          if (Math.abs(c.target - c.angle) < 0.001) { c.angle = c.target; c.target = null; }
        // Sinon.
        } else {
          // Poursuit sur l'élan, qui s'amortit rapidement.
          c.angle += velocity * dt; velocity *= Math.pow(0.04, dt);
          // En lecture : ajoute la rotation automatique.
          if (c.playing) c.angle += speed * dt;
        // Fin du choix.
        }
      // Fin du cas.
      }
      // Applique l'angle au plateau.
      turntable.rotation.y = c.angle;
      // Fait tourner lentement le globe sur lui-même.
      globeMesh.rotation.y += dt * 0.05; // rotation propre lente
      // Dessine la scène.
      renderer.render(scene, camera);
      // Programme l'image suivante.
      raf = requestAnimationFrame(frame);
    // Fin de frame.
    };
    // Lance la boucle.
    raf = requestAnimationFrame(frame);

    // Fonction de nettoyage.
    return () => {
      // Arrête la boucle.
      cancelAnimationFrame(raf);
      // Oublie le matériau du globe.
      c.globeMat = null;
      // Libère la texture du globe.
      c.globeTex?.dispose(); c.globeTex = null;
      // Arrête l'observateur de taille.
      ro.disconnect();
      // Retire l'écouteur d'appui.
      el.removeEventListener('pointerdown', down);
      // Retire l'écouteur de mouvement.
      el.removeEventListener('pointermove', move);
      // Retire l'écouteur de relâchement.
      el.removeEventListener('pointerup', up);
      // Retire l'écouteur d'annulation.
      el.removeEventListener('pointercancel', up);
      // Parcourt tous les objets de la scène.
      scene.traverse((o) => {
        // Libère leur géométrie.
        o.geometry?.dispose();
        // Libère leurs matériaux, qu'il y en ait un ou plusieurs.
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      // Fin du parcours.
      });
      // Libère le moteur de rendu.
      renderer.dispose();
      // Retire le canvas du conteneur.
      mount.removeChild(el);
    // Fin de la fonction de nettoyage.
    };
  // Fin de l'effet ; dépendance : la vitesse.
  }, [speed]);

  // Texture du globe : remplacée à chaque nouveau fond, sans recréer la scène.
  // Effet relancé quand la carte du globe change.
  useEffect(() => {
    // Récupère la référence de pilotage.
    const c = ctrl.current;
    // Définit applyGlobe, qui pose la carte sur le globe.
    c.applyGlobe = () => {
      // Le matériau du globe.
      const m = c.globeMat;
      // Sans matériau (scène pas encore construite), rien à faire.
      if (!m) return;
      // Libère l'ancienne texture.
      c.globeTex?.dispose();
      // L'oublie.
      c.globeTex = null;
      // S'il y a une carte.
      if (globe) {
        // Crée une texture à partir du canvas.
        const tex = new THREE.CanvasTexture(globe);
        // Couleurs en sRGB.
        tex.encoding = THREE.sRGBEncoding;
        // Répétition horizontale : pas de couture au méridien de raccord.
        tex.wrapS = THREE.RepeatWrapping;
        // Filtrage anisotrope, jusqu'à 8 si la carte graphique le permet.
        tex.anisotropy = Math.min(8, c.renderer?.capabilities.getMaxAnisotropy() ?? 1);
        // Garde la texture.
        c.globeTex = tex;
        // La pose sur le matériau.
        m.map = tex;
        // Couleur blanche : la texture n'est pas teintée.
        m.color.set(0xffffff);
      // Sinon.
      } else {
        // Aucune texture.
        m.map = null;
        // Couleur gris-bleu sombre.
        m.color.set(0x2a3140);
      // Fin du choix.
      }
      // Demande la mise à jour du matériau.
      m.needsUpdate = true;
    // Fin de applyGlobe.
    };
    // L'applique tout de suite.
    c.applyGlobe();
  // Fin de l'effet ; dépendance : la carte du globe.
  }, [globe]);

  // Début du rendu.
  return (
    // Conteneur : tout l'espace disponible, sur un dégradé radial sombre.
    <div style={{ position: 'relative', width: '100%', height: '100%', background: 'radial-gradient(ellipse at 50% 35%, #161b23 0%, #07090d 70%)', overflow: 'hidden', ...style }}>
      {/* Le conteneur du canvas, qui couvre tout. */}
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
      {/* La barre de commandes. */}
      <div style={S.controls}>
        {/* Bouton « quart de tour à gauche ». */}
        <button style={S.btn} onClick={() => turn(-1)} aria-label="Quart de tour à gauche">
          {/* Son icône : un chevron vers la gauche. */}
          <svg viewBox="0 0 24 24" style={S.icon}><path d="M15 5l-7 7 7 7" /></svg>
        {/* Fin du bouton. */}
        </button>
        {/* Bouton lecture ou pause. */}
        <button style={{ ...S.btn, ...S.play }} onClick={() => setPlaying((v) => !v)} aria-label={playing ? 'Pause' : 'Lecture'}>
          {/* Son icône : deux barres en lecture, un triangle en pause. */}
          <svg viewBox="0 0 24 24" style={S.icon}>{playing ? <path d="M9 6v12M15 6v12" /> : <path d="M8 5.5v13l11-6.5z" />}</svg>
        {/* Fin du bouton. */}
        </button>
        {/* Bouton « quart de tour à droite ». */}
        <button style={S.btn} onClick={() => turn(1)} aria-label="Quart de tour à droite">
          {/* Son icône : un chevron vers la droite. */}
          <svg viewBox="0 0 24 24" style={S.icon}><path d="M9 5l7 7-7 7" /></svg>
        {/* Fin du bouton. */}
        </button>
      {/* Fin de la barre de commandes. */}
      </div>
    {/* Fin du conteneur. */}
    </div>
  // Fin du rendu.
  );
// Fin de PlateauTournant.
}

// Styles des commandes (début de l'objet).
const S = {
  // La barre : centrée en bas, boutons espacés.
  controls: { position: 'absolute', left: '50%', bottom: 28, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 22 },
  // Un bouton : rond de 44 px, sans fond ni bordure, presque blanc.
  btn: { background: 'none', border: 0, color: '#e9eef5', cursor: 'pointer', display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: '50%', opacity: 0.85 },
  // Le bouton central : plus grand, cerclé.
  play: { width: 52, height: 52, border: '1.5px solid rgba(233,238,245,0.55)' },
  // Une icône : tracé de 20 px, sans remplissage, aux extrémités arrondies.
  icon: { width: 20, height: 20, stroke: 'currentColor', fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' },
// Fin de l'objet.
};
