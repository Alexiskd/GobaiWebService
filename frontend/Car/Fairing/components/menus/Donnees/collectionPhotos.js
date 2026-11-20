/**
 * Photos et vidéos de Ma collection (GET /galerie) rangées par astre, pour la fiche de chaque astre de la
 * Documentation. Calcul pur, sans React.
 *
 * Un média appartient à un astre si son dossier porte le nom de l'astre (dossier « Jupiter »), ou si son titre
 * contient le nom de l'astre comme mot entier (« Survol de la Lune par Artemis II »). Comparaison sans accents ni
 * majuscules (« Dione » = « Dioné »).
 */
const fold = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escape = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Les médias de l'astre `name`, dans l'ordre de la collection, avec le nom de leur dossier (`folderName`). */
export function photosOf(name, data) {
  const target = fold(name).trim();
  if (!target || !Array.isArray(data?.folders)) return [];
  const word = new RegExp(`(^|[^a-z0-9])${escape(target)}([^a-z0-9]|$)`);
  const out = [];
  for (const folder of data.folders) {
    const wholeFolder = fold(folder.name) === target;
    for (const item of folder.items ?? []) {
      if (wholeFolder || word.test(fold(item.title))) out.push({ ...item, folderName: folder.name });
    }
  }
  return out;
}
