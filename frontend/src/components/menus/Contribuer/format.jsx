// Formats d'affichage et normalisation de recherche du panneau Contributions.

export function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('fr');
}

export const formatNumber = (value, digits) => (Number.isFinite(value) ? value.toFixed(digits) : '—');
export const shortCid = (cid) => (cid && cid.length > 20 ? `${cid.slice(0, 10)}…${cid.slice(-6)}` : cid);
