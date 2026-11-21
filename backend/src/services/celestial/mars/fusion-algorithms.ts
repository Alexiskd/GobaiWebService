// Très petite valeur, pour éviter les divisions par zéro.
const EPS = 1e-6;

// Type FusionPlanes : trois plans de nombres, un par couleur.
export type FusionPlanes = [Float32Array, Float32Array, Float32Array];

// Forme des statistiques d'un plan.
export interface FusionStats {
  // mean : la moyenne.
  mean: number;
  // std : l'écart type.
  std: number;
// Fin de FusionStats.
}

// Forme de la référence, mesurée une fois sur les mosaïques entières.
export interface FusionReference {
  // pan : statistiques de la luminance CTX.
  pan: FusionStats;
  // intensity : statistiques de l'intensité Viking.
  intensity: FusionStats;
  // rgbMean : moyenne de chaque couleur Viking.
  rgbMean: [number, number, number];
  // pcaVector : direction de la première composante principale.
  pcaVector: [number, number, number];
  // pca : statistiques de cette composante.
  pca: FusionStats;
  // gramSchmidtGains : gain de chaque couleur pour Gram–Schmidt.
  gramSchmidtGains: [number, number, number];
// Fin de FusionReference.
}

// Forme des options d'un algorithme.
export interface FusionOptions {
  // weights : poids des trois couleurs dans l'intensité (facultatif).
  weights?: [number, number, number];
  // radius : rayon des flous (facultatif).
  radius?: number;
  // gain : force des détails (facultatif).
  gain?: number;
  // proportional : injection proportionnelle à la couleur (facultatif).
  proportional?: boolean;
  // levels : nombre de niveaux (facultatif).
  levels?: number;
  // eps : régularisation du filtre guidé (facultatif).
  eps?: number;
  // reference : la référence (facultatif).
  reference?: FusionReference;
// Fin de FusionOptions.
}

// Type FusionAlgorithm : un algorithme de fusion, qui prend
export type FusionAlgorithm = (
  // la luminance fine (CTX),
  pan: Float32Array,
  // les trois couleurs (Viking),
  ms: FusionPlanes,
  // la largeur,
  width: number,
  // la hauteur,
  height: number,
  // et des options ;
  options?: FusionOptions,
// il rend les trois couleurs fusionnées.
) => FusionPlanes;

// Fonction stats : moyenne et écart type d'un plan.
export function stats(values: Float32Array): FusionStats {
  // Plan vide :
  if (values.length === 0) {
    // erreur.
    throw new Error('Impossible de calculer les statistiques d’une image vide.');
  // Fin du cas.
  }
  // Somme.
  let sum = 0;
  // Somme des carrés.
  let squaredSum = 0;
  // Pour chaque valeur :
  for (let i = 0; i < values.length; i += 1) {
    // l'ajoute à la somme ;
    sum += values[i];
    // ajoute son carré.
    squaredSum += values[i] * values[i];
  // Fin de la boucle.
  }
  // Moyenne.
  const mean = sum / values.length;
  // Renvoie
  return {
    // la moyenne ;
    mean,
    // l'écart type, jamais nul.
    std: Math.sqrt(Math.max(squaredSum / values.length - mean * mean, EPS * EPS)),
  // Fin de l'objet.
  };
// Fin de stats.
}

// Fonction covariance de deux plans.
export function covariance(a: Float32Array, b: Float32Array): number {
  // Tailles différentes, ou plans vides :
  if (a.length !== b.length || a.length === 0) {
    // erreur.
    throw new Error('Les plans de fusion doivent avoir la même taille non nulle.');
  // Fin du cas.
  }
  // Somme du premier.
  let sumA = 0;
  // Somme du second.
  let sumB = 0;
  // Somme des produits.
  let productSum = 0;
  // Pour chaque position :
  for (let i = 0; i < a.length; i += 1) {
    // ajoute la valeur du premier ;
    sumA += a[i];
    // ajoute celle du second ;
    sumB += b[i];
    // ajoute leur produit.
    productSum += a[i] * b[i];
  // Fin de la boucle.
  }
  // Renvoie la moyenne des produits moins le produit des moyennes.
  return productSum / a.length - (sumA / a.length) * (sumB / a.length);
// Fin de covariance.
}

// Fonction correlation de deux plans.
export function correlation(a: Float32Array, b: Float32Array): number {
  // Produit des deux écarts types.
  const denominator = stats(a).std * stats(b).std;
  // Renvoie 0 s'il est presque nul, sinon la covariance divisée par ce produit.
  return denominator <= EPS ? 0 : covariance(a, b) / denominator;
// Fin de correlation.
}

// Fonction matchStats : donne à un plan la moyenne et l'écart type d'un autre ; ses paramètres :
export function matchStats(
  // le plan à ajuster ;
  source: Float32Array,
  // le plan modèle ;
  target: Float32Array,
  // les statistiques déjà connues du premier (facultatif) ;
  sourceReference?: FusionStats,
  // celles du second (facultatif).
  targetReference?: FusionStats,
// Elle renvoie le plan ajusté.
): Float32Array {
  // Statistiques du plan à ajuster.
  const sourceStats = sourceReference ?? stats(source);
  // Statistiques du plan modèle.
  const targetStats = targetReference ?? stats(target);
  // Rapport des écarts types.
  const scale = targetStats.std / sourceStats.std;
  // Plan de sortie.
  const output = new Float32Array(source.length);
  // Pour chaque valeur :
  for (let i = 0; i < source.length; i += 1) {
    // l'écart à sa moyenne, mis à l'échelle, plus la moyenne du modèle.
    output[i] = (source[i] - sourceStats.mean) * scale + targetStats.mean;
  // Fin de la boucle.
  }
  // Renvoie le plan.
  return output;
// Fin de matchStats.
}

// Fonction intensity : l'intensité des trois couleurs ; ses paramètres :
export function intensity(
  // les trois couleurs ;
  ms: FusionPlanes,
  // leurs poids, un tiers chacun par défaut.
  weights: [number, number, number] = [1 / 3, 1 / 3, 1 / 3],
// Elle renvoie le plan d'intensité.
): Float32Array {
  // Plan de sortie, à zéro.
  const output = new Float32Array(ms[0].length);
  // Pour chaque couleur,
  for (let band = 0; band < ms.length; band += 1) {
    // et chaque position :
    for (let i = 0; i < output.length; i += 1) {
      // ajoute la valeur pondérée.
      output[i] += weights[band] * ms[band][i];
    // Fin des positions.
    }
  // Fin des couleurs.
  }
  // Renvoie le plan.
  return output;
// Fin de intensity.
}

// Fonction subtract : la différence de deux plans.
export function subtract(a: Float32Array, b: Float32Array): Float32Array {
  // Tailles différentes :
  if (a.length !== b.length) {
    // erreur.
    throw new Error('Les plans de fusion doivent avoir la même taille.');
  // Fin du cas.
  }
  // Plan de sortie.
  const output = new Float32Array(a.length);
  // Pour chaque position : le premier moins le second.
  for (let i = 0; i < output.length; i += 1) output[i] = a[i] - b[i];
  // Renvoie le plan.
  return output;
// Fin de subtract.
}

// Fonction inject : ajoute un plan de détails aux trois couleurs ; ses paramètres :
export function inject(
  // les trois couleurs ;
  ms: FusionPlanes,
  // les détails ;
  delta: Float32Array,
  // le gain de chaque couleur, 1 par défaut.
  gains: [number, number, number] = [1, 1, 1],
// Elle renvoie les trois couleurs.
): FusionPlanes {
  // Pour chaque couleur :
  return ms.map((band, channel) => {
    // plan de sortie ;
    const output = new Float32Array(band.length);
    // pour chaque position :
    for (let i = 0; i < output.length; i += 1) {
      // la couleur plus les détails multipliés par son gain.
      output[i] = band[i] + gains[channel] * delta[i];
    // Fin de la boucle.
    }
    // Rend le plan.
    return output;
  // Fin des couleurs.
  }) as FusionPlanes;
// Fin de inject.
}

// Fonction injectProportional : ajoute les détails en proportion de chaque couleur ; ses paramètres :
export function injectProportional(
  // les trois couleurs ;
  ms: FusionPlanes,
  // les détails ;
  delta: Float32Array,
  // l'intensité.
  intensityPlane: Float32Array,
// Elle renvoie les trois couleurs.
): FusionPlanes {
  // Pour chaque couleur :
  return ms.map((band) => {
    // plan de sortie ;
    const output = new Float32Array(band.length);
    // pour chaque position :
    for (let i = 0; i < output.length; i += 1) {
      // la valeur de sortie :
      output[i] =
        // la couleur, plus les détails multipliés par la part de cette couleur dans l'intensité.
        band[i] + delta[i] * (band[i] / (intensityPlane[i] + EPS));
    // Fin de la boucle.
    }
    // Rend le plan.
    return output;
  // Fin des couleurs.
  }) as FusionPlanes;
// Fin de injectProportional.
}

// Fonction boxBlur : moyenne en boîte ; ses paramètres :
export function boxBlur(
  // le plan ;
  source: Float32Array,
  // sa largeur ;
  width: number,
  // sa hauteur ;
  height: number,
  // le rayon.
  radius: number,
// Elle renvoie le plan lissé.
): Float32Array {
  // Rayon nul ou négatif : une copie du plan.
  if (radius <= 0) return Float32Array.from(source);
  // Vérifie les dimensions.
  assertDimensions(source, width, height);
  // Largeur d'une ligne de l'image intégrale.
  const stride = width + 1;
  // Image intégrale : chaque case vaut la somme de tout ce qui est au-dessus et à gauche.
  const integral = new Float64Array(stride * (height + 1));
  // Pour chaque ligne :
  for (let y = 0; y < height; y += 1) {
    // somme de la ligne, à zéro ;
    let rowSum = 0;
    // pour chaque colonne :
    for (let x = 0; x < width; x += 1) {
      // ajoute la valeur à la somme de la ligne ;
      rowSum += source[y * width + x];
      // case de l'image intégrale :
      integral[(y + 1) * stride + x + 1] =
        // celle du dessus, plus la somme de la ligne.
        integral[y * stride + x + 1] + rowSum;
    // Fin des colonnes.
    }
  // Fin des lignes.
  }

  // Plan de sortie.
  const output = new Float32Array(width * height);
  // Pour chaque ligne :
  for (let y = 0; y < height; y += 1) {
    // haut de la fenêtre, sans sortir de l'image ;
    const y0 = Math.max(0, y - radius);
    // bas de la fenêtre ;
    const y1 = Math.min(height - 1, y + radius) + 1;
    // pour chaque colonne :
    for (let x = 0; x < width; x += 1) {
      // gauche de la fenêtre ;
      const x0 = Math.max(0, x - radius);
      // droite de la fenêtre ;
      const x1 = Math.min(width - 1, x + radius) + 1;
      // moyenne de la fenêtre :
      output[y * width + x] =
        // le coin bas droit,
        (integral[y1 * stride + x1] -
          // moins le coin haut droit,
          integral[y0 * stride + x1] -
          // moins le coin bas gauche,
          integral[y1 * stride + x0] +
          // plus le coin haut gauche,
          integral[y0 * stride + x0]) /
        // divisé par le nombre de pixels de la fenêtre.
        ((y1 - y0) * (x1 - x0));
    // Fin des colonnes.
    }
  // Fin des lignes.
  }
  // Renvoie le plan.
  return output;
// Fin de boxBlur.
}

// Fonction smooth : lissage doux ; ses paramètres :
export function smooth(
  // le plan ;
  source: Float32Array,
  // sa largeur ;
  width: number,
  // sa hauteur ;
  height: number,
  // le rayon.
  radius: number,
// Elle renvoie le plan lissé.
): Float32Array {
  // Deux moyennes en boîte de suite.
  return boxBlur(boxBlur(source, width, height, radius), width, height, radius);
// Fin de smooth.
}

// Fonction atrousBlur : flou « à trous » ; ses paramètres :
export function atrousBlur(
  // le plan ;
  source: Float32Array,
  // sa largeur ;
  width: number,
  // sa hauteur ;
  height: number,
  // l'écart entre les points du filtre.
  step: number,
// Elle renvoie le plan flouté.
): Float32Array {
  // Les cinq poids du filtre B3-spline.
  const kernel = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16];
  // Plan intermédiaire.
  const temporary = new Float32Array(width * height);
  // Plan de sortie.
  const output = new Float32Array(width * height);
  // Fonction clamp : garde une position
  const clamp = (value: number, max: number) =>
    // entre 0 et le maximum.
    Math.max(0, Math.min(max, value));

  // Premier passage, pour chaque ligne,
  for (let y = 0; y < height; y += 1) {
    // et chaque colonne :
    for (let x = 0; x < width; x += 1) {
      // somme à zéro ;
      let sum = 0;
      // pour les cinq points du filtre :
      for (let k = -2; k <= 2; k += 1) {
        // ajoute le voisin horizontal, pondéré.
        sum += kernel[k + 2] * source[y * width + clamp(x + k * step, width - 1)];
      // Fin des points.
      }
      // Range la somme.
      temporary[y * width + x] = sum;
    // Fin des colonnes.
    }
  // Fin du premier passage (horizontal).
  }
  // Second passage, pour chaque ligne,
  for (let y = 0; y < height; y += 1) {
    // et chaque colonne :
    for (let x = 0; x < width; x += 1) {
      // somme à zéro ;
      let sum = 0;
      // pour les cinq points du filtre :
      for (let k = -2; k <= 2; k += 1) {
        // ajoute
        sum +=
          // le poids, multiplié par
          kernel[k + 2] *
          // le voisin vertical.
          temporary[clamp(y + k * step, height - 1) * width + x];
      // Fin des points.
      }
      // Range la somme.
      output[y * width + x] = sum;
    // Fin des colonnes.
    }
  // Fin du second passage (vertical).
  }
  // Renvoie le plan.
  return output;
// Fin de atrousBlur.
}

// Fonction resizeBilinear : change la taille d'un plan ; ses paramètres :
export function resizeBilinear(
  // le plan ;
  source: Float32Array,
  // sa largeur ;
  width: number,
  // sa hauteur ;
  height: number,
  // la largeur voulue ;
  targetWidth: number,
  // la hauteur voulue.
  targetHeight: number,
// Elle renvoie le plan à la nouvelle taille.
): Float32Array {
  // Vérifie les dimensions.
  assertDimensions(source, width, height);
  // Plan de sortie.
  const output = new Float32Array(targetWidth * targetHeight);
  // Rapport des largeurs.
  const scaleX = width / targetWidth;
  // Rapport des hauteurs.
  const scaleY = height / targetHeight;
  // Pour chaque ligne de sortie :
  for (let y = 0; y < targetHeight; y += 1) {
    // position verticale dans la source, sans sortir de l'image ;
    const fy = Math.max(0, Math.min(height - 1, (y + 0.5) * scaleY - 0.5));
    // ligne du dessus ;
    const y0 = Math.floor(fy);
    // ligne du dessous ;
    const y1 = Math.min(y0 + 1, height - 1);
    // part de la ligne du dessous.
    const ty = fy - y0;
    // Pour chaque colonne de sortie :
    for (let x = 0; x < targetWidth; x += 1) {
      // position horizontale dans la source ;
      const fx = Math.max(0, Math.min(width - 1, (x + 0.5) * scaleX - 0.5));
      // colonne de gauche ;
      const x0 = Math.floor(fx);
      // colonne de droite ;
      const x1 = Math.min(x0 + 1, width - 1);
      // part de la colonne de droite.
      const tx = fx - x0;
      // Valeur sur la ligne du dessus :
      const top =
        // le pixel de gauche, pondéré,
        source[y0 * width + x0] * (1 - tx) +
        // plus celui de droite.
        source[y0 * width + x1] * tx;
      // Valeur sur la ligne du dessous :
      const bottom =
        // le pixel de gauche, pondéré,
        source[y1 * width + x0] * (1 - tx) +
        // plus celui de droite.
        source[y1 * width + x1] * tx;
      // Mélange des deux lignes.
      output[y * targetWidth + x] = top * (1 - ty) + bottom * ty;
    // Fin des colonnes.
    }
  // Fin des lignes.
  }
  // Renvoie le plan.
  return output;
// Fin de resizeBilinear.
}

// Forme d'un niveau de pyramide.
interface PyramidLevel {
  // data : ses valeurs.
  data: Float32Array;
  // width : sa largeur.
  width: number;
  // height : sa hauteur.
  height: number;
// Fin de PyramidLevel.
}

// Fonction gaussDown : le niveau suivant, deux fois plus petit.
export function gaussDown(level: PyramidLevel): PyramidLevel {
  // Largeur : la moitié, arrondie vers le haut, au moins 1.
  const width = Math.max(1, Math.ceil(level.width / 2));
  // Hauteur : de même.
  const height = Math.max(1, Math.ceil(level.height / 2));
  // Renvoie
  return {
    // les valeurs : le niveau réduit, après
    data: resizeBilinear(
      // un flou,
      atrousBlur(level.data, level.width, level.height, 1),
      // de sa largeur
      level.width,
      // et de sa hauteur,
      level.height,
      // à la nouvelle largeur
      width,
      // et à la nouvelle hauteur ;
      height,
    // fin de la réduction ;
    ),
    // la largeur ;
    width,
    // la hauteur.
    height,
  // Fin de l'objet.
  };
// Fin de gaussDown.
}

// Fonction buildLaplacian : construit une pyramide laplacienne ; ses paramètres :
export function buildLaplacian(
  // le plan ;
  source: Float32Array,
  // sa largeur ;
  width: number,
  // sa hauteur ;
  height: number,
  // le nombre de niveaux.
  levels: number,
// Elle renvoie les niveaux.
): PyramidLevel[] {
  // Pyramide.
  const pyramid: PyramidLevel[] = [];
  // Niveau courant : le plan entier.
  let current = { data: source, width, height };
  // Boucle :
  for (
    // part du niveau 0 ;
    let level = 0;
    // continue tant qu'il reste des niveaux à faire et que le niveau courant fait plus de 4 pixels de côté ;
    level < levels && current.width > 4 && current.height > 4;
    // avance d'un niveau.
    level += 1
  // Corps de la boucle :
  ) {
    // niveau réduit ;
    const down = gaussDown(current);
    // le même, ragrandi
    const up = resizeBilinear(
      // depuis ses valeurs,
      down.data,
      // sa largeur
      down.width,
      // et sa hauteur,
      down.height,
      // à la largeur
      current.width,
      // et à la hauteur du niveau courant.
      current.height,
    // Fin de l'agrandissement.
    );
    // Ajoute à la pyramide
    pyramid.push({
      // les détails perdus par la réduction,
      data: subtract(current.data, up),
      // avec la largeur
      width: current.width,
      // et la hauteur du niveau courant.
      height: current.height,
    // Fin de l'ajout.
    });
    // Le niveau réduit devient le niveau courant.
    current = down;
  // Fin de la boucle.
  }
  // Ajoute le dernier niveau, le plus petit.
  pyramid.push(current);
  // Renvoie la pyramide.
  return pyramid;
// Fin de buildLaplacian.
}

// Fonction collapseLaplacian : reconstruit un plan à partir de sa pyramide.
export function collapseLaplacian(pyramid: PyramidLevel[]): Float32Array {
  // Part du niveau le plus petit.
  let current = pyramid[pyramid.length - 1];
  // Remonte les niveaux :
  for (let level = pyramid.length - 2; level >= 0; level -= 1) {
    // niveau à atteindre ;
    const target = pyramid[level];
    // agrandit le niveau courant
    const up = resizeBilinear(
      // depuis ses valeurs,
      current.data,
      // sa largeur
      current.width,
      // et sa hauteur,
      current.height,
      // à la largeur
      target.width,
      // et à la hauteur du niveau à atteindre.
      target.height,
    // Fin de l'agrandissement.
    );
    // Y ajoute les détails de ce niveau.
    for (let i = 0; i < up.length; i += 1) up[i] += target.data[i];
    // Le résultat devient le niveau courant.
    current = { data: up, width: target.width, height: target.height };
  // Fin de la boucle.
  }
  // Renvoie les valeurs.
  return current.data;
// Fin de collapseLaplacian.
}

// Fonction eigenSymmetric3 : valeurs et vecteurs propres d'une matrice 3 × 3 symétrique ; elle renvoie
export function eigenSymmetric3(matrix: number[][]): {
  // les trois valeurs propres,
  values: [number, number, number];
  // et les trois vecteurs propres.
  vectors: [[number, number, number], [number, number, number], [number, number, number]];
// Fin du type rendu.
} {
  // Copie de la matrice.
  const values = matrix.map((row) => row.slice());
  // Vecteurs : la matrice identité au départ :
  const vectors = [
    // première ligne,
    [1, 0, 0],
    // deuxième ligne,
    [0, 1, 0],
    // troisième ligne.
    [0, 0, 1],
  // Fin de la matrice.
  ];
  // Cinquante passes au plus (méthode de Jacobi) :
  for (let sweep = 0; sweep < 50; sweep += 1) {
    // somme des carrés hors de la diagonale, à zéro ;
    let offDiagonal = 0;
    // pour chaque ligne,
    for (let p = 0; p < 3; p += 1) {
      // et chaque colonne au-dessus de la diagonale :
      for (let q = p + 1; q < 3; q += 1) {
        // ajoute le carré de la case.
        offDiagonal += values[p][q] ** 2;
      // Fin des colonnes.
      }
    // Fin des lignes.
    }
    // Presque nulle : la matrice est diagonale, on s'arrête.
    if (offDiagonal < 1e-20) break;
    // Pour chaque ligne,
    for (let p = 0; p < 3; p += 1) {
      // et chaque colonne au-dessus de la diagonale :
      for (let q = p + 1; q < 3; q += 1) {
        // case déjà nulle : suivante.
        if (Math.abs(values[p][q]) < 1e-30) continue;
        // Angle de la rotation qui annule cette case.
        const theta = (values[q][q] - values[p][p]) / (2 * values[p][q]);
        // Sa tangente :
        const t =
          // le signe de l'angle, divisé par
          Math.sign(theta || 1) /
          // sa valeur absolue plus une racine.
          (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        // Cosinus.
        const c = 1 / Math.sqrt(t * t + 1);
        // Sinus.
        const s = t * c;
        // Applique la rotation aux colonnes p et q :
        for (let k = 0; k < 3; k += 1) {
          // ancienne valeur de la colonne p ;
          const akp = values[k][p];
          // ancienne valeur de la colonne q ;
          const akq = values[k][q];
          // nouvelle colonne p ;
          values[k][p] = c * akp - s * akq;
          // nouvelle colonne q.
          values[k][q] = s * akp + c * akq;
        // Fin de la boucle.
        }
        // Applique la rotation aux lignes p et q :
        for (let k = 0; k < 3; k += 1) {
          // ancienne valeur de la ligne p ;
          const apk = values[p][k];
          // ancienne valeur de la ligne q ;
          const aqk = values[q][k];
          // nouvelle ligne p ;
          values[p][k] = c * apk - s * aqk;
          // nouvelle ligne q.
          values[q][k] = s * apk + c * aqk;
        // Fin de la boucle.
        }
        // Applique la rotation aux vecteurs :
        for (let k = 0; k < 3; k += 1) {
          // ancienne valeur de la colonne p ;
          const vkp = vectors[k][p];
          // ancienne valeur de la colonne q ;
          const vkq = vectors[k][q];
          // nouvelle colonne p ;
          vectors[k][p] = c * vkp - s * vkq;
          // nouvelle colonne q.
          vectors[k][q] = s * vkp + c * vkq;
        // Fin de la boucle.
        }
      // Fin des colonnes.
      }
    // Fin des lignes.
    }
  // Fin des passes.
  }
  // Diagonale : les valeurs propres.
  const diagonal = [values[0][0], values[1][1], values[2][2]];
  // Ordre : de la plus grande à la plus petite.
  const order = [0, 1, 2].sort((a, b) => diagonal[b] - diagonal[a]);
  // Renvoie
  return {
    // les valeurs propres, dans cet ordre ;
    values: order.map((index) => diagonal[index]) as [number, number, number],
    // les vecteurs propres, dans cet ordre :
    vectors: order.map(
      // pour chacun,
      (index) =>
        // ses trois composantes, typées comme
        [vectors[0][index], vectors[1][index], vectors[2][index]] as [
          // un nombre,
          number,
          // un nombre,
          number,
          // un nombre ;
          number,
        // fin du type ;
        ],
    // fin des vecteurs.
    ) as [[number, number, number], [number, number, number], [number, number, number]],
  // Fin de l'objet.
  };
// Fin de eigenSymmetric3.
}

// Algorithme simpleMean :
export const simpleMean: FusionAlgorithm = (_pan, ms) =>
  // pour chaque couleur, la moyenne de la couleur et de la luminance CTX.
  ms.map((band) => Float32Array.from(band, (value, i) => (value + _pan[i]) / 2)) as FusionPlanes;

// Algorithme brovey.
export const brovey: FusionAlgorithm = (pan, ms, _width, _height, options = {}) => {
  // Référence.
  const reference = options.reference;
  // Intensité des couleurs.
  const currentIntensity = intensity(ms);
  // Luminance CTX ramenée à l'intensité, avec
  const matchedPan = matchStats(
    // la luminance,
    pan,
    // l'intensité,
    currentIntensity,
    // les statistiques connues de la luminance,
    reference?.pan,
    // et celles de l'intensité.
    reference?.intensity,
  // Fin de l'ajustement.
  );
  // Pour chaque couleur,
  return ms.map((band) =>
    // un plan fait
    Float32Array.from(
      // de la couleur,
      band,
      // multipliée par le rapport entre la luminance ajustée et l'intensité.
      (value, i) => (value * matchedPan[i]) / (currentIntensity[i] + EPS),
    // Fin du plan.
    ),
  // Fin des couleurs.
  ) as FusionPlanes;
// Fin de brovey.
};

// Algorithme ihs.
export const ihs: FusionAlgorithm = (pan, ms, _width, _height, options = {}) => {
  // Intensité des couleurs.
  const currentIntensity = intensity(ms);
  // Luminance CTX ramenée à l'intensité, avec
  const matchedPan = matchStats(
    // la luminance,
    pan,
    // l'intensité,
    currentIntensity,
    // les statistiques connues de la luminance,
    options.reference?.pan,
    // et celles de l'intensité.
    options.reference?.intensity,
  // Fin de l'ajustement.
  );
  // Ajoute aux couleurs l'écart entre la luminance ajustée et l'intensité.
  return inject(ms, subtract(matchedPan, currentIntensity));
// Fin de ihs.
};

// Algorithme esri :
export const esri: FusionAlgorithm = (_pan, ms, _width, _height, options = {}) =>
  // ajoute aux couleurs l'écart entre la luminance CTX et l'intensité pondérée.
  inject(ms, subtract(_pan, intensity(ms, options.weights)));

// Algorithme pca.
export const pca: FusionAlgorithm = (pan, ms, _width, _height, options = {}) => {
  // Nombre de pixels.
  const n = pan.length;
  // Référence.
  const reference = options.reference;
  // Moyennes des trois couleurs.
  let means: [number, number, number];
  // Direction de la première composante.
  let vector: [number, number, number];
  // Statistiques de cette composante.
  let principalStats: FusionStats;

  // Avec une référence :
  if (reference) {
    // ses moyennes ;
    means = reference.rgbMean;
    // sa direction ;
    vector = reference.pcaVector;
    // ses statistiques.
    principalStats = reference.pca;
  // Sans référence :
  } else {
    // moyennes calculées sur la zone ;
    means = ms.map((band) => stats(band).mean) as [number, number, number];
    // matrice de covariance des trois couleurs :
    const matrix = [0, 1, 2].map((i) =>
      // chaque case est la covariance de deux couleurs.
      [0, 1, 2].map((j) => covariance(ms[i], ms[j])),
    // Fin de la matrice.
    );
    // Ses valeurs et vecteurs propres.
    const eigen = eigenSymmetric3(matrix);
    // Direction : le premier vecteur propre.
    vector = eigen.vectors[0];
    // S'il pointe vers le sombre,
    if (vector[0] + vector[1] + vector[2] < 0) {
      // on l'inverse.
      vector = vector.map((value) => -value) as [number, number, number];
    // Fin du cas.
    }
    // Statistiques : moyenne nulle, écart type tiré de la première valeur propre.
    principalStats = { mean: 0, std: Math.sqrt(Math.max(eigen.values[0], EPS * EPS)) };
  // Fin du choix.
  }

  // Première composante de chaque pixel.
  const principal = new Float32Array(n);
  // Pour chaque pixel :
  for (let i = 0; i < n; i += 1) {
    // sa composante :
    principal[i] =
      // la part du rouge,
      vector[0] * (ms[0][i] - means[0]) +
      // plus celle du vert,
      vector[1] * (ms[1][i] - means[1]) +
      // plus celle du bleu.
      vector[2] * (ms[2][i] - means[2]);
  // Fin de la boucle.
  }
  // Ajoute
  return inject(
    // aux couleurs
    ms,
    // l'écart entre la luminance CTX ajustée à la composante et la composante,
    subtract(matchStats(pan, principal, reference?.pan, principalStats), principal),
    // avec la direction comme gains.
    vector,
  // Fin de l'ajout.
  );
// Fin de pca.
};

// Algorithme gramSchmidt.
export const gramSchmidt: FusionAlgorithm = (pan, ms, _width, _height, options = {}) => {
  // Intensité des couleurs.
  const currentIntensity = intensity(ms);
  // Référence.
  const reference = options.reference;
  // Variance de l'intensité :
  const variance = reference
    // celle de la référence,
    ? reference.intensity.std ** 2
    // sinon celle de la zone.
    : stats(currentIntensity).std ** 2;
  // Gains des trois couleurs :
  const gains =
    // ceux de la référence, sinon
    reference?.gramSchmidtGains ??
    // la covariance de chaque couleur avec l'intensité, divisée par la variance, typée comme
    (ms.map((band) => covariance(band, currentIntensity) / variance) as [
      // un nombre,
      number,
      // un nombre,
      number,
      // un nombre.
      number,
    // Fin du type.
    ]);
  // Luminance CTX ramenée à l'intensité, avec
  const matchedPan = matchStats(
    // la luminance,
    pan,
    // l'intensité,
    currentIntensity,
    // les statistiques connues de la luminance,
    reference?.pan,
    // et celles de l'intensité.
    reference?.intensity,
  // Fin de l'ajustement.
  );
  // Ajoute aux couleurs l'écart entre la luminance ajustée et l'intensité, avec ces gains.
  return inject(ms, subtract(matchedPan, currentIntensity), gains);
// Fin de gramSchmidt.
};

// Algorithme hpf (passe-haut).
export const hpf: FusionAlgorithm = (pan, ms, width, height, options = {}) => {
  // Rayon : 4 par défaut.
  const radius = options.radius ?? 4;
  // Intensité des couleurs.
  const currentIntensity = intensity(ms);
  // Luminance CTX ramenée à l'intensité, avec
  const matchedPan = matchStats(
    // la luminance,
    pan,
    // l'intensité,
    currentIntensity,
    // les statistiques connues de la luminance,
    options.reference?.pan,
    // et celles de l'intensité.
    options.reference?.intensity,
  // Fin de l'ajustement.
  );
  // Luminance lissée.
  const detail = smooth(matchedPan, width, height, radius);
  // Pour chaque pixel :
  for (let i = 0; i < detail.length; i += 1) {
    // détail : la luminance moins sa version lissée, multiplié par le gain.
    detail[i] = (matchedPan[i] - detail[i]) * (options.gain ?? 1);
  // Fin de la boucle.
  }
  // Si l'injection proportionnelle est coupée :
  return options.proportional === false
    // ajout simple des détails ;
    ? inject(ms, detail)
    // sinon ajout proportionnel à chaque couleur.
    : injectProportional(ms, detail, currentIntensity);
// Fin de hpf.
};

// Algorithme wavelet (ondelettes).
export const wavelet: FusionAlgorithm = (pan, ms, width, height, options = {}) => {
  // Intensité des couleurs.
  const currentIntensity = intensity(ms);
  // Luminance CTX ramenée à l'intensité, avec
  let current = matchStats(
    // la luminance,
    pan,
    // l'intensité,
    currentIntensity,
    // les statistiques connues de la luminance,
    options.reference?.pan,
    // et celles de l'intensité.
    options.reference?.intensity,
  // Fin de l'ajustement.
  );
  // Détails, à zéro.
  const detail = new Float32Array(current.length);
  // Pour chaque niveau (3 par défaut) :
  for (let level = 0; level < (options.levels ?? 3); level += 1) {
    // flou à trous, avec un écart qui double à chaque niveau ;
    const next = atrousBlur(current, width, height, 1 << level);
    // pour chaque pixel :
    for (let i = 0; i < current.length; i += 1) {
      // ajoute aux détails ce que le flou a retiré.
      detail[i] += current[i] - next[i];
    // Fin de la boucle.
    }
    // Le plan flouté devient le plan courant.
    current = next;
  // Fin des niveaux.
  }
  // Si l'injection proportionnelle est coupée :
  return options.proportional === false
    // ajout simple des détails ;
    ? inject(ms, detail)
    // sinon ajout proportionnel à chaque couleur.
    : injectProportional(ms, detail, currentIntensity);
// Fin de wavelet.
};

// Algorithme laplacian (pyramide laplacienne).
export const laplacian: FusionAlgorithm = (pan, ms, width, height, options = {}) => {
  // Intensité des couleurs.
  const currentIntensity = intensity(ms);
  // Luminance CTX ramenée à l'intensité, avec
  const matchedPan = matchStats(
    // la luminance,
    pan,
    // l'intensité,
    currentIntensity,
    // les statistiques connues de la luminance,
    options.reference?.pan,
    // et celles de l'intensité.
    options.reference?.intensity,
  // Fin de l'ajustement.
  );
  // Pyramide de l'intensité, avec
  const intensityPyramid = buildLaplacian(
    // l'intensité,
    currentIntensity,
    // la largeur,
    width,
    // la hauteur,
    height,
    // et 5 niveaux par défaut.
    options.levels ?? 5,
  // Fin de la construction.
  );
  // Pyramide de la luminance, avec
  const panPyramid = buildLaplacian(
    // la luminance ajustée,
    matchedPan,
    // la largeur,
    width,
    // la hauteur,
    height,
    // et 5 niveaux par défaut.
    options.levels ?? 5,
  // Fin de la construction.
  );
  // Pyramide fusionnée, niveau par niveau :
  const fusedPyramid = intensityPyramid.map((level, index) => {
    // le dernier niveau (le plus petit) reste celui de l'intensité ;
    if (index === intensityPyramid.length - 1) return level;
    // pour les autres, chaque valeur est
    const details = Float32Array.from(level.data, (value, i) =>
      // si le détail de la luminance est le plus fort,
      Math.abs(panPyramid[index].data[i]) >= Math.abs(value)
        // ce détail,
        ? panPyramid[index].data[i]
        // sinon celui de l'intensité.
        : value,
    // Fin du choix.
    );
    // Rend le niveau avec ces détails.
    return { ...level, data: details };
  // Fin de la fusion.
  });
  // Ajoute aux couleurs l'écart entre l'intensité reconstruite et l'intensité d'origine.
  return inject(ms, subtract(collapseLaplacian(fusedPyramid), currentIntensity));
// Fin de laplacian.
};

// Algorithme guided (filtre guidé).
export const guided: FusionAlgorithm = (pan, ms, width, height, options = {}) => {
  // Rayon : 4 par défaut.
  const radius = options.radius ?? 4;
  // Régularisation : 0,001 par défaut.
  const epsilon = options.eps ?? 1e-3;
  // Fonction box : moyenne en boîte d'un plan.
  const box = (plane: Float32Array) => boxBlur(plane, width, height, radius);
  // Moyenne locale de la luminance.
  const meanPan = box(pan);
  // Luminance au carré.
  const squaredPan = Float32Array.from(pan, (value) => value * value);
  // Sa moyenne locale.
  const meanSquaredPan = box(squaredPan);

  // Pour chaque couleur :
  return ms.map((band) => {
    // sa moyenne locale ;
    const meanBand = box(band);
    // son produit avec la luminance ;
    const product = Float32Array.from(pan, (value, i) => value * band[i]);
    // la moyenne locale de ce produit ;
    const meanProduct = box(product);
    // coefficient a ;
    const a = new Float32Array(pan.length);
    // coefficient b ;
    const b = new Float32Array(pan.length);
    // pour chaque pixel :
    for (let i = 0; i < pan.length; i += 1) {
      // a :
      a[i] =
        // la covariance locale de la luminance et de la couleur,
        (meanProduct[i] - meanPan[i] * meanBand[i]) /
        // divisée par la variance locale de la luminance, régularisée ;
        (meanSquaredPan[i] - meanPan[i] * meanPan[i] + epsilon);
      // b : ce qui reste de la moyenne de la couleur.
      b[i] = meanBand[i] - a[i] * meanPan[i];
    // Fin de la boucle.
    }
    // Moyenne locale de a.
    const meanA = box(a);
    // Moyenne locale de b.
    const meanB = box(b);
    // Plan de sortie.
    const output = new Float32Array(pan.length);
    // Pour chaque pixel :
    for (let i = 0; i < pan.length; i += 1) {
      // la luminance multipliée par a, plus b.
      output[i] = meanA[i] * pan[i] + meanB[i];
    // Fin de la boucle.
    }
    // Rend le plan.
    return output;
  // Fin des couleurs.
  }) as FusionPlanes;
// Fin de guided.
};

// Table des algorithmes, par nom :
export const FUSION_ALGORITHMS: Record<string, FusionAlgorithm> = {
  // moyenne simple ;
  simpleMean,
  // Brovey ;
  brovey,
  // IHS ;
  ihs,
  // Esri ;
  esri,
  // composantes principales ;
  pca,
  // Gram–Schmidt ;
  gramSchmidt,
  // passe-haut ;
  hpf,
  // ondelettes ;
  wavelet,
  // pyramide laplacienne ;
  laplacian,
  // filtre guidé.
  guided,
// Fin de la table.
};

// Fonction qualityIndex : deux notes de qualité d'une fusion ; ses paramètres :
export function qualityIndex(
  // les couleurs fusionnées ;
  output: FusionPlanes,
  // la luminance CTX ;
  pan: Float32Array,
  // les couleurs d'origine ;
  ms: FusionPlanes,
  // la largeur ;
  width: number,
  // la hauteur ;
  height: number,
  // le rayon, 2 par défaut.
  radius = 2,
// Elle renvoie la fidélité des couleurs et celle des détails.
): { spectral: number; spatial: number } {
  // Fonction high : les détails d'un plan,
  const high = (plane: Float32Array) =>
    // soit le plan moins sa version lissée.
    subtract(plane, smooth(plane, width, height, radius));
  // Détails de la luminance.
  const highPan = high(pan);
  // Note des couleurs.
  let spectral = 0;
  // Note des détails.
  let spatial = 0;
  // Pour chaque couleur :
  for (let channel = 0; channel < 3; channel += 1) {
    // corrélation entre la couleur fusionnée et la couleur d'origine ;
    spectral += correlation(output[channel], ms[channel]);
    // corrélation entre ses détails et ceux de la luminance.
    spatial += correlation(high(output[channel]), highPan);
  // Fin de la boucle.
  }
  // Renvoie les deux moyennes.
  return { spectral: spectral / 3, spatial: spatial / 3 };
// Fin de qualityIndex.
}

// Fonction computeFusionReference ; ses paramètres :
export function computeFusionReference(
  // la luminance CTX, en octets ;
  pan: Uint8Array,
  // les couleurs Viking, 3 octets par pixel ;
  rgb: Uint8Array,
  // la largeur ;
  width: number,
  // la hauteur ;
  height: number,
  // le pas d'échantillonnage, 4 par défaut ;
  sampleStep = 4,
  // le test « ce pixel compte-t-il ? », toujours oui par défaut.
  isValid: (x: number, y: number) => boolean = () => true,
// Elle renvoie la référence.
): FusionReference {
  // Nombre de pixels comptés.
  let count = 0;
  // Somme de la luminance.
  let sumPan = 0;
  // Somme de ses carrés.
  let sumPanSquared = 0;
  // Somme de chaque couleur.
  const sums = [0, 0, 0];
  // Sommes des produits des couleurs deux à deux :
  const products = [
    // première ligne,
    [0, 0, 0],
    // deuxième ligne,
    [0, 0, 0],
    // troisième ligne.
    [0, 0, 0],
  // Fin du tableau.
  ];
  // Somme de l'intensité.
  let sumIntensity = 0;
  // Somme de ses carrés.
  let sumIntensitySquared = 0;
  // Somme des produits de chaque couleur par l'intensité.
  const panIntensity = [0, 0, 0];

  // Pour une ligne sur quatre,
  for (let y = 0; y < height; y += sampleStep) {
    // et une colonne sur quatre :
    for (let x = 0; x < width; x += sampleStep) {
      // pixel qui ne compte pas : suivant.
      if (!isValid(x, y)) continue;
      // Position du pixel.
      const pixel = y * width + x;
      // Position de ses couleurs.
      const offset = pixel * 3;
      // Ses trois couleurs, de 0 à 1 :
      const values = [
        // rouge,
        rgb[offset] / 255,
        // vert,
        rgb[offset + 1] / 255,
        // bleu.
        rgb[offset + 2] / 255,
      // Fin des couleurs.
      ];
      // Sa luminance, de 0 à 1.
      const p = pan[pixel] / 255;
      // Son intensité : la moyenne des trois couleurs.
      const i = (values[0] + values[1] + values[2]) / 3;
      // Un pixel de plus.
      count += 1;
      // Ajoute la luminance.
      sumPan += p;
      // Ajoute son carré.
      sumPanSquared += p * p;
      // Ajoute l'intensité.
      sumIntensity += i;
      // Ajoute son carré.
      sumIntensitySquared += i * i;
      // Pour chaque couleur :
      for (let a = 0; a < 3; a += 1) {
        // ajoute sa valeur ;
        sums[a] += values[a];
        // ajoute son produit par l'intensité ;
        panIntensity[a] += values[a] * i;
        // pour chaque couleur :
        for (let b = 0; b < 3; b += 1) {
          // ajoute le produit des deux couleurs.
          products[a][b] += values[a] * values[b];
        // Fin de la boucle.
        }
      // Fin de la boucle.
      }
    // Fin des colonnes.
    }
  // Fin des lignes.
  }

  // Aucun pixel :
  if (count === 0) {
    // erreur.
    throw new Error('Aucun pixel disponible pour les statistiques de fusion.');
  // Fin du cas.
  }
  // Moyenne de chaque couleur, typée comme
  const rgbMean = sums.map((sum) => sum / count) as [
    // un nombre,
    number,
    // un nombre,
    number,
    // un nombre.
    number,
  // Fin du type.
  ];
  // Matrice de covariance des couleurs :
  const covarianceMatrix = products.map((row, a) =>
    // chaque case est la moyenne du produit moins le produit des moyennes.
    row.map((sum, b) => sum / count - rgbMean[a] * rgbMean[b]),
  // Fin de la matrice.
  );
  // Moyenne de la luminance.
  const panMean = sumPan / count;
  // Statistiques de la luminance :
  const panStats = {
    // sa moyenne ;
    mean: panMean,
    // son écart type, jamais nul.
    std: Math.sqrt(Math.max(sumPanSquared / count - panMean ** 2, EPS * EPS)),
  // Fin des statistiques.
  };
  // Moyenne de l'intensité.
  const intensityMean = sumIntensity / count;
  // Statistiques de l'intensité :
  const intensityStats = {
    // sa moyenne ;
    mean: intensityMean,
    // son écart type :
    std: Math.sqrt(
      // la racine de sa variance, jamais nulle.
      Math.max(sumIntensitySquared / count - intensityMean ** 2, EPS * EPS),
    // Fin du calcul.
    ),
  // Fin des statistiques.
  };
  // Valeurs et vecteurs propres de la matrice.
  const eigen = eigenSymmetric3(covarianceMatrix);
  // Direction de la première composante.
  let pcaVector = eigen.vectors[0];
  // Si elle pointe vers le sombre,
  if (pcaVector[0] + pcaVector[1] + pcaVector[2] < 0) {
    // on l'inverse ; elle est typée comme
    pcaVector = pcaVector.map((value) => -value) as [
      // un nombre,
      number,
      // un nombre,
      number,
      // un nombre.
      number,
    // Fin du type.
    ];
  // Fin du cas.
  }
  // Variance le long de cette direction :
  const pcaVariance =
    // la part du rouge,
    pcaVector[0] ** 2 * covarianceMatrix[0][0] +
    // plus celle du vert,
    pcaVector[1] ** 2 * covarianceMatrix[1][1] +
    // plus celle du bleu,
    pcaVector[2] ** 2 * covarianceMatrix[2][2] +
    // plus deux fois
    2 *
      // la part rouge-vert,
      (pcaVector[0] * pcaVector[1] * covarianceMatrix[0][1] +
        // la part rouge-bleu,
        pcaVector[0] * pcaVector[2] * covarianceMatrix[0][2] +
        // et la part vert-bleu.
        pcaVector[1] * pcaVector[2] * covarianceMatrix[1][2]);
  // Écart type de la composante, jamais nul.
  const pcaStd = Math.sqrt(Math.max(pcaVariance, EPS * EPS));
  // Variance de l'intensité, jamais nulle.
  const varianceIntensity = Math.max(intensityStats.std ** 2, EPS * EPS);

  // Renvoie
  return {
    // les statistiques de la luminance ;
    pan: panStats,
    // celles de l'intensité ;
    intensity: intensityStats,
    // les moyennes des couleurs ;
    rgbMean,
    // la direction de la première composante ;
    pcaVector,
    // ses statistiques ;
    pca: { mean: 0, std: pcaStd },
    // les gains de Gram–Schmidt :
    gramSchmidtGains: panIntensity.map(
      // pour chaque couleur,
      (product, channel) =>
        // sa covariance avec l'intensité,
        (product / count - rgbMean[channel] * intensityMean) /
        // divisée par la variance de l'intensité.
        varianceIntensity,
    // Fin des gains.
    ) as [number, number, number],
  // Fin de l'objet.
  };
// Fin de computeFusionReference.
}

// Fonction assertDimensions ; ses paramètres :
function assertDimensions(
  // le plan ;
  values: Float32Array,
  // la largeur ;
  width: number,
  // la hauteur.
  height: number,
// Elle ne renvoie rien.
): void {
  // Si
  if (
    // la largeur n'est pas entière,
    !Number.isInteger(width) ||
    // ou inférieure à 1,
    width < 1 ||
    // ou la hauteur non entière,
    !Number.isInteger(height) ||
    // ou inférieure à 1,
    height < 1 ||
    // ou si le plan n'a pas la bonne taille :
    values.length !== width * height
  // alors
  ) {
    // erreur.
    throw new Error('Dimensions invalides pour le plan de fusion.');
  // Fin du cas.
  }
// Fin de assertDimensions.
}
