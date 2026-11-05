// Textes d’aide sous les interrupteurs du panneau Informations.

export const bordersHintText = (bordersInfo) => (bordersInfo ? 'Natural Earth 1:50m' : 'Chargement…');

export const cityNamesHintText = (namesIncluded, cityInfo) => {
  if (namesIncluded) return 'Déjà inclus dans ce fond';
  return cityInfo ? `${cityInfo.count.toLocaleString('fr-FR')} villes · Natural Earth · visibles en zoomant` : 'Chargement…';
};

export const shadowcamHintText = (info) => {
  if (info?.error) return `Indisponible : ${info.error}`;
  return info ? `${info.count} cratères en ombre permanente · ShadowCam (NASA) à bord de Danuri` : 'Chargement du catalogue…';
};

export const moonModelHintText = (info) => {
  if (info === 'loading') return 'Chargement du modèle…';
  if (info?.error) return `Indisponible : ${info.error}`;
  return info ? 'NASA (LRO, couleurs et relief) · vue d’ensemble, tuiles en zoomant' : 'NASA (LRO) · chargé en ciblant la Lune';
};
