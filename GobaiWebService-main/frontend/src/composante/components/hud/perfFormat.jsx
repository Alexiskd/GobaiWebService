// Écriture des mesures du moniteur de performance (voir PerfMonitor.jsx). Fonctions pures, testées dans perfFormat.test.jsx.

/** 2 412 ms → « 2,4 s » ; null → « … » (pas encore mesuré). */
// Déclare et exporte seconds : une durée en millisecondes, écrite en secondes avec une décimale.
export const seconds = (v) => (Number.isFinite(v) ? `${(v / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s` : '…');

/** 3 355 443 octets → « 3,2 Mo », 54 321 → « 53 ko ». */
// Déclare et exporte bytes : un nombre d'octets, en ko ou en Mo (0 ko si la valeur manque).
export const bytes = (n) => (n >= 1048576 ? `${(n / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo` : `${Math.round((n || 0) / 1024)} ko`);
