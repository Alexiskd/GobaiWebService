// ---------------------------------------------------------------- Utilitaires

const numberFormat = new Intl.NumberFormat('fr-FR');

// BigInt() plantait sur un nombre décimal ou une chaîne mal formée.
export const formatPointCount = (value) => {
  if (value === null || value === undefined || value === '') return 'Nombre de points inconnu';
  try {
    const text = String(value).trim();
    const formatted = /^\d+$/.test(text) ? numberFormat.format(BigInt(text)) : numberFormat.format(Math.round(Number(text)));
    return formatted === 'NaN' ? 'Nombre de points inconnu' : `${formatted} points`;
  } catch {
    return 'Nombre de points inconnu';
  }
};

export const fixed = (value, digits) => (Number.isFinite(value) ? value.toFixed(digits) : '—');

// URL de base du nuage : `potreeBaseUrl`, sinon dossier de `potreeUrl` (…/cloud.js).
export const cloudBaseUrl = (cloud) => cloud.potreeBaseUrl
  || (cloud.potreeUrl ? cloud.potreeUrl.replace(/\/?cloud\.js(\?.*)?$/i, '/') : null);
