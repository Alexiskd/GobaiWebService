/**
 * Vérifie que chaque import nommé d'un module du projet correspond bien à un export de ce module.
 *
 * Pourquoi ce contrôle existe : un nom retiré d'un module alors qu'un autre fichier l'importe encore ne se voit
 * ni à la lecture, ni dans les tests (qui ne chargent pas toute l'interface) — mais Rollup refuse de construire
 * le site, et le déploiement échoue. Le contrôle est instantané et attrape cette erreur avant le build.
 *
 * Il ne regarde que les modules du projet (chemins relatifs et alias « @/ ») : les paquets installés sont
 * l'affaire de npm et de Vite.
 *
 * Emploi : node scripts/verifie-imports.mjs src
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// Dossier à parcourir, donné en argument (« src » par défaut).
const ROOT = resolve(process.argv[2] || 'src');

// Tous les fichiers de code du dossier.
const files = [];
// walk : parcourt un dossier et ses sous-dossiers.
(function walk(dir) {
  // Chaque entrée.
  for (const entry of readdirSync(dir)) {
    // Son chemin complet.
    const path = join(dir, entry);
    // Un dossier : on descend ; un fichier de code : on le garde.
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(jsx?|tsx?)$/.test(path)) files.push(path);
  // Fin des entrées.
  }
// Fin de walk, lancée tout de suite sur la racine.
})(ROOT);

/** Retire les commentaires : un commentaire entre accolades d'import ne doit pas passer pour un nom. */
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** Chemin réel d'un import du projet (relatif ou « @/ ») : essaie les extensions et les index. Null sinon. */
function resolveLocal(from, spec) {
  // Un paquet installé : hors sujet.
  if (!spec.startsWith('.') && !spec.startsWith('@/')) return null;
  // La base du chemin : l'alias « @/ » désigne la racine parcourue.
  const base = spec.startsWith('@/') ? join(ROOT, spec.slice(2)) : resolve(dirname(from), spec);
  // Les formes possibles du fichier.
  for (const candidate of [base, `${base}.jsx`, `${base}.js`, `${base}.ts`, `${base}.tsx`,
    join(base, 'index.jsx'), join(base, 'index.js'), join(base, 'index.ts')]) {
    // La première qui existe.
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  // Fin des formes.
  }
  // Introuvable : laissé à Vite, qui le dira mieux.
  return null;
// Fin de resolveLocal.
}

/** Les noms exportés par un fichier, réexports « export * from » compris. */
function exportsOf(file, seen = new Set()) {
  // Un cycle de réexports : on s'arrête.
  if (seen.has(file)) return new Set();
  // Fichier vu.
  seen.add(file);
  // Son contenu, sans commentaires.
  const source = strip(readFileSync(file, 'utf8'));
  // Les noms trouvés.
  const names = new Set();
  // export const / let / var / function / class.
  for (const m of source.matchAll(/export\s+(?:const|let|var|function|async function|class)\s+(\w+)/g)) names.add(m[1]);
  // export { a, b as c }.
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    // Chaque nom de la liste.
    for (const part of m[1].split(',')) {
      // Le nom, après un éventuel « as ».
      const bits = part.trim().split(/\s+as\s+/);
      // Le nom exporté est le dernier morceau.
      if (bits[bits.length - 1]) names.add(bits[bits.length - 1].trim());
    // Fin de la liste.
    }
  // Fin des accolades.
  }
  // export default.
  if (/export\s+default/.test(source)) names.add('default');
  // export * from './x' : les noms de la cible comptent aussi.
  for (const m of source.matchAll(/export\s*\*\s*from\s*'([^']+)'/g)) {
    // La cible, si c'est un module du projet.
    const target = resolveLocal(file, m[1]);
    // Ses noms.
    if (target) for (const n of exportsOf(target, seen)) names.add(n);
  // Fin des réexports.
  }
  // Les noms.
  return names;
// Fin de exportsOf.
}

// Les problèmes trouvés, et le nombre d'imports examinés.
const problems = [];
let checked = 0;
// Chaque fichier.
for (const file of files) {
  // Son contenu, sans commentaires.
  const source = strip(readFileSync(file, 'utf8'));
  // Chaque import nommé.
  for (const m of source.matchAll(/import\s*(?:\w+\s*,\s*)?\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    // Le module visé, s'il est du projet.
    const target = resolveLocal(file, m[2]);
    // Un paquet installé : rien à vérifier ici.
    if (!target) continue;
    // Ses exports.
    const have = exportsOf(target);
    // Un import de plus examiné.
    checked += 1;
    // Chaque nom importé.
    for (const part of m[1].split(',')) {
      // Le nom, avant un éventuel « as ».
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      // Vide, ou un import de type TypeScript : ignoré.
      if (!name || name.startsWith('type ')) continue;
      // Absent des exports : c'est le problème que ce contrôle cherche.
      if (!have.has(name)) problems.push(`${file.replace(`${ROOT}/`, '')} importe « ${name} » de « ${m[2]} », qui ne l’exporte pas`);
    // Fin des noms.
    }
  // Fin des imports.
  }
// Fin des fichiers.
}

// Le compte rendu.
console.log(`Imports : ${files.length} fichiers, ${checked} imports du projet vérifiés.`);
// Les problèmes, ou un mot rassurant.
console.log(problems.length ? problems.map((p) => `  ✗ ${p}`).join('\n') : '  Tous les noms importés existent.');
// Sortie en échec s'il y a un problème : le build s'arrête avant Rollup.
process.exit(problems.length ? 1 : 0);
