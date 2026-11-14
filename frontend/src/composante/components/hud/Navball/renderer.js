// ======================================================
// NAVBALL RENDERER
// Rendu Canvas indépendant de React
// ======================================================

// Exporte D2R, le facteur de conversion des degrés en radians.
export const D2R = Math.PI / 180;
// Exporte R2D, le facteur de conversion des radians en degrés.
export const R2D = 180 / Math.PI;

// Exporte wrap360, qui ramène un angle…
export const wrap360 = (a) =>
  // … entre 0 (inclus) et 360 degrés (exclu), même s'il est négatif.
  ((a % 360) + 360) % 360;

// Exporte wrap180, qui ramène un angle…
export const wrap180 = (a) =>
  // … entre -180 (inclus) et 180 degrés (exclu).
  ((((a + 180) % 360) + 360) % 360) - 180;

// Exporte clamp, qui borne une valeur…
export const clamp = (v, a, b) =>
  // … entre un minimum a et un maximum b.
  Math.max(a, Math.min(b, v));

// dot : produit scalaire de deux vecteurs à trois composantes…
const dot = (a, b) =>
  // … produit des premières composantes…
  a[0] * b[0] +
  // … plus celui des deuxièmes…
  a[1] * b[1] +
  // … plus celui des troisièmes.
  a[2] * b[2];

// Exporte fmt, qui écrit un angle avec son signe.
export const fmt = (v) => {
  // Arrondit à l'entier.
  const n = Math.round(v);

  // Renvoie le texte (début).
  return (
    // Le signe : plus, ou le signe moins typographique…
    (n >= 0 ? "+" : "−") +
    // … suivi de la valeur absolue sur deux chiffres au moins.
    String(Math.abs(n)).padStart(2, "0")
  // Fin du texte.
  );
// Fin de fmt.
};

// ======================================================
// REPERE MONDE -> REPERE CORPS
// ======================================================

// Déclare basis : construit les axes de la vue à partir du cap h, du tangage p et du roulis r, en degrés.
function basis(h, p, r) {
  // Cosinus du cap.
  const ch = Math.cos(h * D2R);
  // Sinus du cap.
  const sh = Math.sin(h * D2R);

  // Cosinus du tangage.
  const cp = Math.cos(p * D2R);
  // Sinus du tangage.
  const sp = Math.sin(p * D2R);

  // Cosinus du roulis.
  const cr = Math.cos(r * D2R);
  // Sinus du roulis.
  const sr = Math.sin(r * D2R);

  // Axe avant f, dans le repère (nord, est, haut) (début).
  const f = [
    // Composante nord.
    cp * ch,
    // Composante est.
    cp * sh,
    // Composante verticale.
    sp
  // Fin de l'axe avant.
  ];

  // Axe droit sans roulis r0 (début).
  const r0 = [
    // Composante nord.
    -sh,
    // Composante est.
    ch,
    // Composante verticale, nulle : l'axe est horizontal.
    0
  // Fin de l'axe droit sans roulis.
  ];

  // Axe haut sans roulis u0 (début).
  const u0 = [
    // Composante nord.
    -sp * ch,
    // Composante est.
    -sp * sh,
    // Composante verticale.
    cp
  // Fin de l'axe haut sans roulis.
  ];

  // Axe droit après roulis, composante par composante (début).
  const rr = [0, 1, 2].map(
    // r0 par le cosinus du roulis moins u0 par son sinus.
    (i) => r0[i] * cr - u0[i] * sr
  // Fin de l'axe droit.
  );

  // Axe haut après roulis, composante par composante (début).
  const uu = [0, 1, 2].map(
    // u0 par le cosinus du roulis plus r0 par son sinus.
    (i) => u0[i] * cr + r0[i] * sr
  // Fin de l'axe haut.
  );

  // Renvoie les trois axes (début de l'objet).
  return {
    // L'axe avant.
    f,
    // L'axe droit.
    r: rr,
    // L'axe haut.
    u: uu
  // Fin de l'objet.
  };
// Fin de basis.
}

// ======================================================
// PROJECTION SPHERIQUE
// ======================================================

// Déclare project : projette un point de la sphère (latitude et longitude en degrés) dans le repère de la vue B.
function project(B, latDeg, lonDeg) {
  // Cosinus de la latitude.
  const cl = Math.cos(latDeg * D2R);

  // Vecteur du point dans le repère (nord, est, haut) (début).
  const w = [
    // Composante nord.
    cl * Math.cos(lonDeg * D2R),
    // Composante est.
    cl * Math.sin(lonDeg * D2R),
    // Composante verticale.
    Math.sin(latDeg * D2R)
  // Fin du vecteur.
  ];

  // Renvoie ses coordonnées dans la vue (début de l'objet).
  return {
    // x : vers la droite.
    x: dot(w, B.r),
    // y : vers le haut.
    y: dot(w, B.u),
    // z : vers l'observateur (positif sur la face visible).
    z: dot(w, B.f)
  // Fin de l'objet.
  };
// Fin de project.
}

// ======================================================
// GENERATION DE LA SPHERE
// ======================================================

// Déclare renderSphere : remplit l'image img, de côté N pixels, avec la boule vue selon B.
function renderSphere(img, N, B) {
  // Le tableau des pixels (quatre valeurs par pixel : rouge, vert, bleu, opacité).
  const d = img.data;

  // Extrait les trois axes de la vue.
  const { f, r, u } = B;

  // Taille d'un pixel dans le carré de -1 à 1.
  const inv = 2 / N;
  // Taille d'un pixel en degrés, au centre de la boule.
  const pxDeg = inv * R2D;

  // Parcourt les lignes de l'image.
  for (let py = 0; py < N; py++) {
    // Ordonnée du centre du pixel, de 1 en haut à -1 en bas.
    const y = 1 - (py + 0.5) * inv;

    // Parcourt les colonnes.
    for (let px = 0; px < N; px++) {
      // Abscisse du centre du pixel, de -1 à gauche à 1 à droite.
      const x = (px + 0.5) * inv - 1;

      // Carré de la distance au centre.
      const d2 = x * x + y * y;
      // Position du pixel dans le tableau.
      const i = (py * N + px) * 4;

      // Si le pixel est hors du disque.
      if (d2 > 1) {
        // Il est transparent.
        d[i + 3] = 0;
        // Passe au pixel suivant.
        continue;
      // Fin du cas.
      }

      // Profondeur du point sur la sphère.
      const z = Math.sqrt(1 - d2);

      // Composante nord du point (début)…
      const wN =
        // … part de l'axe droit…
        x * r[0] +
        // … part de l'axe haut…
        y * u[0] +
        // … part de l'axe avant.
        z * f[0];

      // Composante est du point (début)…
      const wE =
        // … part de l'axe droit…
        x * r[1] +
        // … part de l'axe haut…
        y * u[1] +
        // … part de l'axe avant.
        z * f[1];

      // Composante verticale du point (début)…
      const wU =
        // … part de l'axe droit…
        x * r[2] +
        // … part de l'axe haut…
        y * u[2] +
        // … part de l'axe avant.
        z * f[2];

      // Latitude du point, en degrés…
      const lat =
        // … l'arc sinus de la composante verticale, bornée entre -1 et 1.
        Math.asin(clamp(wU, -1, 1)) * R2D;

      // Longitude du point, en degrés…
      const lon =
        // … l'angle de sa direction horizontale.
        Math.atan2(wE, wN) * R2D;

      // Largeur d'un trait en degrés : plus grande vers le bord de la boule (profondeur plancher de 0,08).
      const lw = pxDeg / Math.max(z, 0.08);

      // Hémisphère haut (ciel) ou bas (sol).
      const sky = wU >= 0;

      // Gris de base : sombre pour le ciel, moyen pour le sol.
      let c = sky ? 22 : 112;

      // Écart au parallèle le plus proche, tous les 15 degrés (début)…
      const dl = Math.abs(
        // … la latitude moins le multiple de 15 le plus proche.
        lat - Math.round(lat / 15) * 15
      // Fin de l'écart.
      );

      // Intensité du trait du parallèle (début)…
      let g = clamp(
        // … maximale sur le trait, décroissante avec l'écart…
        1 - dl / (lw * 0.9),
        // … jamais sous 0…
        0,
        // … jamais au-dessus de 1.
        1
      // Fin de l'intensité.
      );

      // Hors des pôles (latitude de moins de 82 degrés) : les méridiens.
      if (Math.abs(lat) < 82) {
        // Écart au méridien le plus proche, tous les 15 degrés (début)…
        const dm =
          // … en valeur absolue…
          Math.abs(
            // … la longitude moins le multiple de 15 le plus proche…
            lon - Math.round(lon / 15) * 15
          // … ramené à la distance réelle par le cosinus de la latitude.
          ) * Math.cos(lat * D2R);

        // Méridien principal ?…
        const major =
          // … un sur six, soit tous les 90 degrés.
          Math.round(lon / 15) % 6 === 0;

        // Garde le trait le plus fort (début)…
        g = Math.max(
          // … entre celui du parallèle…
          g,
          // … et celui du méridien (début)…
          clamp(
            // … plus épais pour un méridien principal…
            1 - dm / (lw * (major ? 1.3 : 0.9)),
            // … jamais sous 0…
            0,
            // … jamais au-dessus de 1…
            1
          // … atténué à 80 % pour un méridien secondaire.
          ) * (major ? 1 : 0.8)
        // Fin du choix.
        );
      // Fin des méridiens.
      }

      // Éclaircit le gris selon l'intensité du trait.
      c += g * (sky ? 95 : 85);

      // Intensité de la ligne d'horizon (début)…
      const hz = clamp(
        // … maximale près de la latitude 0…
        1 - (Math.abs(lat) - 0.6) / (lw * 1.1),
        // … jamais sous 0…
        0,
        // … jamais au-dessus de 1.
        1
      // Fin de l'intensité.
      );

      // Mélange avec un gris presque blanc sur la ligne d'horizon.
      c = c * (1 - hz) + 245 * hz;

      // Ombrage de la sphère…
      const shade =
        // … plus sombre vers le bord, plus clair au centre.
        0.42 + 0.58 * Math.pow(z, 0.7);

      // Reflet spéculaire (début)…
      const spec =
        // … une puissance élevée…
        Math.pow(
          // … de l'alignement avec la lumière (début)…
          clamp(
            // … qui vient du haut à gauche, devant…
            -x * 0.45 + y * 0.55 + z * 0.7,
            // … jamais sous 0…
            0,
            // … jamais au-dessus de 1…
            1
          // … fin de l'alignement…
          ),
          // … exposant 28 : un reflet étroit…
          28
        // … d'intensité 55.
        ) * 55;

      // Applique l'ombrage et ajoute le reflet.
      c = c * shade + spec;

      // Écrit la composante rouge.
      d[i] = c;
      // Écrit la composante verte, à peine plus forte.
      d[i + 1] = c + 1;
      // Écrit la composante bleue, un peu plus forte : une teinte froide.
      d[i + 2] = c + 3;

      // Écrit l'opacité (début)…
      d[i + 3] =
        // … bornée…
        clamp(
          // … d'après la distance au bord, en pixels : le bord est adouci…
          (1 - Math.sqrt(d2)) * N * 0.5,
          // … jamais sous 0…
          0,
          // … jamais au-dessus de 1…
          1
        // … puis ramenée sur 255.
        ) * 255;
    // Fin du parcours des colonnes.
    }
  // Fin du parcours des lignes.
  }
// Fin de renderSphere.
}

// ======================================================
// RENDU PRINCIPAL
// ======================================================

// Déclare et exporte drawInstrument, qui dessine tout l'instrument (début de la liste des paramètres).
export function drawInstrument(
  // Le contexte du canvas affiché.
  ctx,
  // Le canvas hors écran.
  off,
  // Son contexte.
  octx,
  // Son tableau de pixels.
  img,
  // Le côté de l'image de la boule, en pixels.
  N,
  // Le côté du canvas affiché, en pixels physiques.
  W,
  // La densité de pixels.
  dpr,
  // L'attitude : cap, tangage et roulis.
  st,
  // Le facteur de détail, 1 par défaut.
  detail = 1
// Fin de la liste des paramètres.
) {
  // Si l'un des éléments nécessaires manque.
  if (!ctx || !off || !octx || !img || !st) {
    // Rien n'est dessiné.
    return;
  // Fin du cas.
  }

  // Cap : la valeur si c'est un nombre fini, 0 sinon.
  const h = Number.isFinite(st.h) ? st.h : 0;
  // Tangage : la valeur si c'est un nombre fini, 0 sinon.
  const p = Number.isFinite(st.p) ? st.p : 0;
  // Roulis : la valeur si c'est un nombre fini, 0 sinon.
  const r = Number.isFinite(st.r) ? st.r : 0;

  // Remplace l'attitude par ces trois valeurs sûres.
  st = { h, p, r };

  // Multiplie la densité par le facteur de détail : les épaisseurs et les textes suivent.
  dpr *= detail;

  // Centre du canvas.
  const c = W / 2;
  // Rayon de la boule : 34 % du côté.
  const R = W * 0.34;

  // Rayon extérieur de la bague de cap : 47 % du côté.
  const ringO = W * 0.47;
  // Rayon intérieur de la bague : juste autour de la boule.
  const ringI = R * 1.035;

  // Remet la transformation du canvas à l'identité.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Efface tout le canvas.
  ctx.clearRect(0, 0, W, W);

  // Calcule les axes de la vue.
  const B = basis(st.h, st.p, st.r);

  // Dessine la boule dans le tableau de pixels.
  renderSphere(img, N, B);

  // Copie les pixels dans le canvas hors écran.
  octx.putImageData(img, 0, 0);

  // ----------------------------------------------------
  // BAGUE DE CAP
  // ----------------------------------------------------

  // Sauvegarde l'état du contexte.
  ctx.save();
  // Place l'origine au centre du canvas.
  ctx.translate(c, c);

  // Commence un tracé : l'anneau de la bague.
  ctx.beginPath();

  // Cercle extérieur.
  ctx.arc(0, 0, ringO, 0, Math.PI * 2);

  // Cercle intérieur (début de l'appel).
  ctx.arc(
    // Centre, abscisse.
    0,
    // Centre, ordonnée.
    0,
    // Rayon intérieur.
    ringI,
    // Angle de départ.
    0,
    // Tour complet.
    Math.PI * 2,
    // Tracé dans le sens inverse.
    true
  // Fin de l'appel.
  );

  // Couleur de remplissage : presque noir.
  ctx.fillStyle = "#0b0c0d";
  // Remplit entre les deux cercles (règle pair-impair).
  ctx.fill("evenodd");

  // Épaisseur du trait.
  ctx.lineWidth = 2 * dpr;
  // Couleur du trait : gris clair.
  ctx.strokeStyle = "#bfc3c6";

  // Commence un tracé.
  ctx.beginPath();
  // Cercle extérieur.
  ctx.arc(0, 0, ringO, 0, Math.PI * 2);
  // Le trace.
  ctx.stroke();

  // Trait plus fin.
  ctx.lineWidth = 1.5 * dpr;
  // Gris moyen.
  ctx.strokeStyle = "#8a8f93";

  // Commence un tracé.
  ctx.beginPath();
  // Second cercle (début de l'appel).
  ctx.arc(
    // Centre, abscisse.
    0,
    // Centre, ordonnée.
    0,
    // À 4 pixels à l'intérieur du premier.
    ringO - 4 * dpr,
    // Angle de départ.
    0,
    // Tour complet.
    Math.PI * 2
  // Fin de l'appel.
  );
  // Le trace.
  ctx.stroke();

  // Couleur presque blanche.
  ctx.strokeStyle = "#e9ebec";
  // Trait plus épais.
  ctx.lineWidth = 2.5 * dpr;

  // Commence un tracé.
  ctx.beginPath();
  // Cercle intérieur, au bord de la boule.
  ctx.arc(0, 0, ringI, 0, Math.PI * 2);
  // Le trace.
  ctx.stroke();

  // Graduations de la bague : une tous les 5 degrés.
  for (let b = 0; b < 360; b += 5) {
    // Angle de la graduation sur le canvas (début)…
    const a =
      // … décalé du cap, le cap courant étant en haut.
      (b - st.h) * D2R - Math.PI / 2;

    // Graduation principale : tous les 30 degrés.
    const major = b % 30 === 0;
    // Graduation moyenne : tous les 10 degrés.
    const mid = b % 10 === 0;

    // Départ du trait, à 10 pixels du bord extérieur.
    const r1 = ringO - 10 * dpr;

    // Fin du trait (début)…
    const r2 =
      // … longueur de 18, 11 ou 6 pixels selon l'importance.
      r1 - (major ? 18 : mid ? 11 : 6) * dpr;

    // Couleur du trait (début)…
    ctx.strokeStyle =
      // … plus claire pour une graduation principale.
      major ? "#f2f4f5" : "#a7acb0";

    // Épaisseur du trait (début)…
    ctx.lineWidth =
      // … plus forte pour une graduation principale.
      (major ? 3 : 1.6) * dpr;

    // Commence un tracé.
    ctx.beginPath();

    // Va au départ du trait (début de l'appel).
    ctx.moveTo(
      // Abscisse.
      Math.cos(a) * r1,
      // Ordonnée.
      Math.sin(a) * r1
    // Fin de l'appel.
    );

    // Trace jusqu'à la fin du trait (début de l'appel).
    ctx.lineTo(
      // Abscisse.
      Math.cos(a) * r2,
      // Ordonnée.
      Math.sin(a) * r2
    // Fin de l'appel.
    );

    // Dessine le trait.
    ctx.stroke();

    // Tous les 90 degrés : une étiquette chiffrée.
    if (b % 90 === 0) {
      // Rayon de l'étiquette (début)…
      const rt =
        // … au milieu de la bague, légèrement vers l'intérieur.
        (ringO + ringI) / 2 - 4 * dpr;

      // Sauvegarde l'état du contexte.
      ctx.save();

      // Place l'origine sur l'étiquette (début de l'appel).
      ctx.translate(
        // Abscisse.
        Math.cos(a) * rt,
        // Ordonnée.
        Math.sin(a) * rt
      // Fin de l'appel.
      );

      // Couleur du fond de l'étiquette : presque noir.
      ctx.fillStyle = "#0b0c0d";

      // Rectangle qui masque les graduations sous le texte (début de l'appel).
      ctx.fillRect(
        // Bord gauche.
        -26 * dpr,
        // Bord haut.
        -11 * dpr,
        // Largeur.
        52 * dpr,
        // Hauteur.
        22 * dpr
      // Fin de l'appel.
      );

      // Couleur du texte : presque blanc.
      ctx.fillStyle = "#f2f4f5";

      // Police du texte (début)…
      ctx.font =
        // … Chakra Petch grasse, de 15 pixels.
        `700 ${15 * dpr}px "Chakra Petch", sans-serif`;

      // Texte centré horizontalement.
      ctx.textAlign = "center";
      // Texte centré verticalement.
      ctx.textBaseline = "middle";

      // Écrit la valeur (début de l'appel).
      ctx.fillText(
        // Le cap sur trois chiffres, suivi du signe degré.
        String(b).padStart(3, "0") + "°",
        // Au centre de l'étiquette.
        0,
        // Décalé d'un pixel vers le bas.
        dpr
      // Fin de l'appel.
      );

      // Restaure l'état du contexte.
      ctx.restore();
    // Fin de l'étiquette.
    }
  // Fin des graduations.
  }

  // Restaure l'état du contexte.
  ctx.restore();

  // ----------------------------------------------------
  // SPHERE
  // ----------------------------------------------------

  // Dessine la boule depuis le canvas hors écran (début de l'appel).
  ctx.drawImage(
    // L'image source.
    off,
    // Bord gauche.
    c - R,
    // Bord haut.
    c - R,
    // Largeur : le diamètre de la boule.
    2 * R,
    // Hauteur : le diamètre de la boule.
    2 * R
  // Fin de l'appel.
  );

  // Sauvegarde l'état du contexte.
  ctx.save();
  // Place l'origine au centre du canvas.
  ctx.translate(c, c);

  // ----------------------------------------------------
  // ECHELLE DE TANGAGE
  // ----------------------------------------------------

  // Cap courant.
  const hc = st.h;

  // Direction horizontale située à droite du cap, dans le repère (nord, est, haut) (début).
  const tE = [
    // Composante nord.
    -Math.sin(hc * D2R),
    // Composante est.
    Math.cos(hc * D2R),
    // Composante verticale, nulle.
    0
  // Fin du vecteur.
  ];

  // Sa composante horizontale à l'écran.
  const tx = dot(tE, B.r);
  // Sa composante verticale à l'écran.
  const ty = dot(tE, B.u);

  // Police des graduations de tangage (début)…
  ctx.font =
    // … Chakra Petch demi-grasse, de 12 pixels.
    `600 ${12 * dpr}px "Chakra Petch", sans-serif`;

  // Texte centré verticalement.
  ctx.textBaseline = "middle";

  // Une graduation tous les 15 degrés, de -75 à +75.
  for (let p = -75; p <= 75; p += 15) {
    // Sauf à 0 : c'est la ligne d'horizon.
    if (p === 0) continue;

    // Projette le point du méridien du cap à cette latitude.
    const q = project(B, p, hc);

    // Trop près du bord ou derrière la boule : graduation ignorée.
    if (q.z < 0.15) continue;

    // Abscisse à l'écran.
    const X = q.x * R;
    // Ordonnée à l'écran (l'axe du canvas descend).
    const Y = -q.y * R;

    // Demi-longueur du trait, réduite vers le bord.
    const L = R * 0.11 * q.z;

    // Opacité (début)…
    ctx.globalAlpha =
      // … qui s'estompe vers le bord.
      clamp((q.z - 0.15) * 3, 0, 1);

    // Couleur (début)…
    const col =
      // … claire dans le ciel, sombre vers le sol.
      p > 0 ? "#f2f4f5" : "#0d0e0f";

    // Couleur du trait.
    ctx.strokeStyle = col;
    // Couleur du texte.
    ctx.fillStyle = col;

    // Épaisseur du trait.
    ctx.lineWidth = 2.2 * dpr;

    // Commence un tracé.
    ctx.beginPath();

    // Va à une extrémité du trait (début de l'appel).
    ctx.moveTo(
      // Abscisse.
      X - tx * L,
      // Ordonnée.
      Y + ty * L
    // Fin de l'appel.
    );

    // Trace jusqu'à l'autre extrémité (début de l'appel).
    ctx.lineTo(
      // Abscisse.
      X + tx * L,
      // Ordonnée.
      Y - ty * L
    // Fin de l'appel.
    );

    // Dessine le trait.
    ctx.stroke();

    // Texte aligné à droite.
    ctx.textAlign = "right";

    // Écrit la valeur (début de l'appel).
    ctx.fillText(
      // Le tangage avec son signe, suivi du signe degré.
      (p > 0 ? "+" : "") + p + "°",
      // À gauche du trait, à 6 pixels.
      X - tx * L - 6 * dpr,
      // À la hauteur de cette extrémité.
      Y + ty * L
    // Fin de l'appel.
    );
  // Fin des graduations de tangage.
  }

  // ----------------------------------------------------
  // REPERES CARDINAUX
  // ----------------------------------------------------

  // Points cardinaux et intermédiaires, par cap en degrés (début de l'objet).
  const card = {
    // Nord.
    0: "N",
    // Nord-est.
    45: "NE",
    // Est.
    90: "E",
    // Sud-est.
    135: "SE",
    // Sud.
    180: "S",
    // Sud-ouest.
    225: "SO",
    // Ouest.
    270: "O",
    // Nord-ouest.
    315: "NO"
  // Fin de l'objet.
  };

  // Police des repères cardinaux (début)…
  ctx.font =
    // … Chakra Petch grasse, de 14 pixels.
    `700 ${14 * dpr}px "Chakra Petch", sans-serif`;

  // Texte centré horizontalement.
  ctx.textAlign = "center";

  // Parcourt les repères (k : le cap, en texte).
  for (const k in card) {
    // Projette le point situé à 5 degrés au-dessus de l'horizon, à ce cap.
    const q = project(B, 5, +k);

    // Trop près du bord ou derrière la boule : repère ignoré.
    if (q.z < 0.2) continue;

    // Opacité (début)…
    ctx.globalAlpha =
      // … qui s'estompe vers le bord.
      clamp((q.z - 0.2) * 2.5, 0, 1);

    // Couleur claire.
    ctx.fillStyle = "#f2f4f5";

    // Écrit la lettre du repère (début de l'appel).
    ctx.fillText(
      // La lettre.
      card[k],
      // Abscisse à l'écran.
      q.x * R,
      // Ordonnée à l'écran.
      -q.y * R
    // Fin de l'appel.
    );

    // Projette le point situé à 5 degrés sous l'horizon, à ce cap.
    const g = project(B, -5, +k);

    // Couleur sombre.
    ctx.fillStyle = "#16181a";

    // Écrit le cap en chiffres (début de l'appel).
    ctx.fillText(
      // Sur trois chiffres.
      String(k).padStart(3, "0"),
      // Abscisse à l'écran.
      g.x * R,
      // Ordonnée à l'écran.
      -g.y * R
    // Fin de l'appel.
    );
  // Fin des repères cardinaux.
  }

  // Remet l'opacité à 1 pour la suite du dessin.
  ctx.globalAlpha = 1;

  // ----------------------------------------------------
  // EFFET DE VERRE
  // ----------------------------------------------------

  // Crée un dégradé radial pour l'effet de verre (début de l'appel).
  const grd = ctx.createRadialGradient(
    // Centre du premier cercle : à gauche…
    -R * 0.3,
    // … et en haut du centre de la boule.
    -R * 0.35,
    // Rayon du premier cercle : 10 % de celui de la boule.
    R * 0.1,
    // Centre du second cercle, abscisse.
    0,
    // Centre du second cercle, ordonnée.
    0,
    // Rayon du second cercle : celui de la boule.
    R
  // Fin de l'appel.
  );

  // Première couleur du dégradé (début de l'appel).
  grd.addColorStop(
    // Au départ.
    0,
    // Blanc à 10 % d'opacité : un léger reflet.
    "rgba(255,255,255,0.10)"
  // Fin de l'appel.
  );

  // Deuxième couleur du dégradé (début de l'appel).
  grd.addColorStop(
    // À 60 % du rayon.
    0.6,
    // Blanc transparent : le reflet s'éteint.
    "rgba(255,255,255,0)"
  // Fin de l'appel.
  );

  // Troisième couleur du dégradé (début de l'appel).
  grd.addColorStop(
    // Au bord.
    1,
    // Noir à 35 % d'opacité : le bord est assombri.
    "rgba(0,0,0,0.35)"
  // Fin de l'appel.
  );

  // Utilise le dégradé comme remplissage.
  ctx.fillStyle = grd;

  // Commence un tracé.
  ctx.beginPath();
  // Disque de la boule.
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  // Le remplit avec le dégradé.
  ctx.fill();

  // ----------------------------------------------------
  // MAQUETTE AVION
  // ----------------------------------------------------

  // Échelle des dessins : la densité de pixels.
  const s = dpr;

  // Couleur de remplissage : presque noir.
  ctx.fillStyle = "#0b0c0d";
  // Couleur du trait : presque blanc.
  ctx.strokeStyle = "#f2f4f5";

  // Épaisseur du trait.
  ctx.lineWidth = 2.5 * s;
  // Angles arrondis.
  ctx.lineJoin = "round";

  // Déclare wing, qui dessine une aile (side : -1 à gauche, 1 à droite).
  const wing = (side) => {
    // Commence un tracé.
    ctx.beginPath();

    // Bout de l'aile, bord supérieur (début de l'appel).
    ctx.moveTo(
      // À 60 % du rayon, du côté demandé.
      side * R * 0.6,
      // À 4 pixels au-dessus du centre.
      -4 * s
    // Fin de l'appel.
    );

    // Vers l'intérieur, bord supérieur (début de l'appel).
    ctx.lineTo(
      // À 24 % du rayon.
      side * R * 0.24,
      // À la même hauteur.
      -4 * s
    // Fin de l'appel.
    );

    // Descente de la jambe (début de l'appel).
    ctx.lineTo(
      // À la même abscisse.
      side * R * 0.24,
      // À 20 pixels sous le centre.
      20 * s
    // Fin de l'appel.
    );

    // Largeur de la jambe (début de l'appel).
    ctx.lineTo(
      // 8 pixels vers l'intérieur.
      side * R * 0.24 - side * 8 * s,
      // À la même hauteur.
      20 * s
    // Fin de l'appel.
    );

    // Remontée de la jambe (début de l'appel).
    ctx.lineTo(
      // À la même abscisse.
      side * R * 0.24 - side * 8 * s,
      // À 4 pixels sous le centre.
      4 * s
    // Fin de l'appel.
    );

    // Retour au bout de l'aile, bord inférieur (début de l'appel).
    ctx.lineTo(
      // À 60 % du rayon.
      side * R * 0.6,
      // À 4 pixels sous le centre.
      4 * s
    // Fin de l'appel.
    );

    // Ferme le contour.
    ctx.closePath();

    // Remplit l'aile.
    ctx.fill();
    // Trace son contour.
    ctx.stroke();
  // Fin de wing.
  };

  // Dessine l'aile gauche.
  wing(-1);
  // Dessine l'aile droite.
  wing(1);

  // Déclare halo, qui trace le chemin courant en deux passes.
  const halo = () => {
    // Première passe : trait large.
    ctx.lineWidth = 7 * s;
    // Presque noir.
    ctx.strokeStyle = "#0b0c0d";
    // Le trace : un liseré sombre.
    ctx.stroke();

    // Seconde passe : trait plus fin.
    ctx.lineWidth = 3 * s;
    // Presque blanc.
    ctx.strokeStyle = "#f2f4f5";
    // Le trace par-dessus.
    ctx.stroke();
  // Fin de halo.
  };

  // Commence un tracé.
  ctx.beginPath();
  // Cercle central, de rayon 10 % de celui de la boule.
  ctx.arc(0, 0, R * 0.1, 0, Math.PI * 2);
  // Le trace avec son liseré.
  halo();

  // Commence un tracé.
  ctx.beginPath();

  // Trait vertical du réticule : du haut…
  ctx.moveTo(0, -R * 0.17);
  // … vers le bas.
  ctx.lineTo(0, R * 0.17);

  // Trait horizontal du réticule : de la gauche…
  ctx.moveTo(-R * 0.17, 0);
  // … vers la droite.
  ctx.lineTo(R * 0.17, 0);

  // Trace le réticule avec son liseré.
  halo();

  // Commence un tracé.
  ctx.beginPath();
  // Petit point central.
  ctx.arc(0, 0, 3.5 * s, 0, Math.PI * 2);

  // Couleur presque blanche.
  ctx.fillStyle = "#f2f4f5";
  // Le remplit.
  ctx.fill();

  // ----------------------------------------------------
  // INDEX DE ROULIS
  // ----------------------------------------------------

  // Sauvegarde l'état du contexte.
  ctx.save();

  // Tourne le repère de l'opposé du roulis.
  ctx.rotate(-st.r * D2R);

  // Commence un tracé : le triangle de l'index.
  ctx.beginPath();

  // Pointe du triangle (début de l'appel).
  ctx.moveTo(
    // Sur l'axe vertical.
    0,
    // À 4 pixels sous le haut de la boule.
    -R + 4 * s
  // Fin de l'appel.
  );

  // Coin gauche de la base (début de l'appel).
  ctx.lineTo(
    // À 7 pixels à gauche.
    -7 * s,
    // À 16 pixels sous le haut de la boule.
    -R + 16 * s
  // Fin de l'appel.
  );

  // Coin droit de la base (début de l'appel).
  ctx.lineTo(
    // À 7 pixels à droite.
    7 * s,
    // À la même hauteur.
    -R + 16 * s
  // Fin de l'appel.
  );

  // Ferme le triangle.
  ctx.closePath();

  // Couleur ambre.
  ctx.fillStyle = "#e8b44a";
  // Le remplit.
  ctx.fill();

  // Restaure l'état d'avant la rotation.
  ctx.restore();
  // Restaure l'état d'avant le centrage.
  ctx.restore();

  // ----------------------------------------------------
  // FENETRE DE CAP
  // ----------------------------------------------------

  // Sauvegarde l'état du contexte.
  ctx.save();

  // Place l'origine en haut de la bague de cap.
  ctx.translate(c, c - ringO);

  // Largeur de la fenêtre de cap.
  const bw = 120 * dpr;
  // Hauteur de la fenêtre de cap.
  const bh = 46 * dpr;

  // Commence un tracé.
  ctx.beginPath();

  // Si le navigateur sait tracer un rectangle arrondi.
  if (ctx.roundRect) {
    // Rectangle arrondi (début de l'appel).
    ctx.roundRect(
      // Bord gauche : centré.
      -bw / 2,
      // Bord haut : décalé vers le haut.
      -bh * 0.62,
      // Largeur.
      bw,
      // Hauteur.
      bh,
      // Rayon des coins.
      10 * dpr
    // Fin de l'appel.
    );
  // Sinon.
  } else {
    // Rectangle simple (début de l'appel).
    ctx.rect(
      // Bord gauche.
      -bw / 2,
      // Bord haut.
      -bh * 0.62,
      // Largeur.
      bw,
      // Hauteur.
      bh
    // Fin de l'appel.
    );
  // Fin du choix.
  }

  // Couleur de remplissage : presque noir.
  ctx.fillStyle = "#0b0c0d";
  // Remplit la fenêtre.
  ctx.fill();

  // Épaisseur du trait.
  ctx.lineWidth = 2.5 * dpr;
  // Couleur du trait : gris très clair.
  ctx.strokeStyle = "#d6d9db";
  // Trace le contour.
  ctx.stroke();

  // Couleur du texte : presque blanc.
  ctx.fillStyle = "#f2f4f5";

  // Police du cap (début)…
  ctx.font =
    // … Chakra Petch grasse, de 30 pixels.
    `700 ${30 * dpr}px "Chakra Petch", sans-serif`;

  // Texte centré horizontalement.
  ctx.textAlign = "center";
  // Texte centré verticalement.
  ctx.textBaseline = "middle";

  // Écrit le cap (début de l'appel).
  ctx.fillText(
    // Le cap arrondi, ramené entre 0 et 359…
    String(Math.round(wrap360(st.h)) % 360)
      // … sur trois chiffres, suivi du signe degré.
      .padStart(3, "0") + "°",
    // Au centre de la fenêtre.
    0,
    // Légèrement au-dessus de l'origine.
    bh * -0.1
  // Fin de l'appel.
  );

  // Commence un tracé : le triangle indicateur.
  ctx.beginPath();

  // Coin gauche de la base (début de l'appel).
  ctx.moveTo(
    // À 14 pixels à gauche.
    -14 * dpr,
    // Juste sous le bord intérieur de la bague.
    ringO - ringI + 2 * dpr
  // Fin de l'appel.
  );

  // Coin droit de la base (début de l'appel).
  ctx.lineTo(
    // À 14 pixels à droite.
    14 * dpr,
    // À la même hauteur.
    ringO - ringI + 2 * dpr
  // Fin de l'appel.
  );

  // Pointe du triangle (début de l'appel).
  ctx.lineTo(
    // Sur l'axe vertical.
    0,
    // 24 pixels plus bas, sur la boule.
    ringO - ringI + 26 * dpr
  // Fin de l'appel.
  );

  // Ferme le triangle.
  ctx.closePath();

  // Couleur presque blanche.
  ctx.fillStyle = "#f2f4f5";
  // Le remplit.
  ctx.fill();

  // Restaure l'état du contexte.
  ctx.restore();
// Fin de drawInstrument.
}
