/**
 * Complétude de la documentation de l'API : chaque contrôleur appartient à un groupe déclaré, et chaque route
 * porte un résumé. Ce contrôle lit les fichiers source plutôt que de démarrer NestJS : il reste rapide et il
 * échoue dès qu'une route est ajoutée sans être documentée.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Dossier des contrôleurs. */
const CONTROLLERS = join(__dirname, '..', 'controllers');
/** Fichier qui déclare les groupes de la documentation. */
const OPENAPI = join(__dirname, 'openapi.ts');

/** Les fichiers de contrôleurs, hors tests. */
const files = readdirSync(CONTROLLERS).filter((f) => f.endsWith('.controller.ts'));

/** Décorateurs de route de NestJS. */
const ROUTE = /^\s*@(Get|Post|Put|Patch|Delete|Head)\(/;

// Groupe de tests.
describe('documentation de l’API', () => {
  // Les groupes déclarés dans le document OpenAPI.
  const declared = new Set([...readFileSync(OPENAPI, 'utf8').matchAll(/\['([^']+)', '/g)].map((m) => m[1]));

  // Test : il y a bien des contrôleurs à vérifier.
  it('trouve les contrôleurs', () => {
    // Une vingtaine de fichiers.
    expect(files.length).toBeGreaterThan(15);
  // Fin du test.
  });

  // Test : chaque contrôleur porte une étiquette déclarée.
  it('range chaque contrôleur dans un groupe déclaré', () => {
    // Parcourt les contrôleurs.
    for (const file of files) {
      // Son contenu.
      const source = readFileSync(join(CONTROLLERS, file), 'utf8');
      // Son étiquette.
      const tag = /@ApiTags\('([^']+)'\)/.exec(source);
      // Elle existe.
      expect(tag ? tag[1] : `${file} : @ApiTags manquant`).toBeTruthy();
      expect(tag).not.toBeNull();
      // Et elle est décrite dans le document : sinon le groupe s'affiche sans explication.
      expect(declared.has(tag![1]) ? tag![1] : `${file} : groupe « ${tag![1]} » non déclaré dans openapi.ts`).toBe(tag![1]);
    // Fin des contrôleurs.
    }
  // Fin du test.
  });

  // Test : chaque route porte un résumé.
  it('donne un résumé à chaque route', () => {
    // Les routes sans résumé.
    const missing: string[] = [];
    // Nombre total de routes.
    let total = 0;
    // Parcourt les contrôleurs.
    for (const file of files) {
      // Ses lignes.
      const lines = readFileSync(join(CONTROLLERS, file), 'utf8').split('\n');
      // Parcourt les lignes.
      lines.forEach((line, i) => {
        // Seules les lignes de route comptent.
        if (!ROUTE.test(line)) return;
        // Une route de plus.
        total += 1;
        // Les décorateurs voisins, avant et après celui de la route.
        const around = lines.slice(Math.max(0, i - 8), i + 8).join('\n');
        // Sans résumé : relevée.
        if (!around.includes('@ApiOperation')) missing.push(`${file}:${i + 1} ${line.trim()}`);
      // Fin des lignes.
      });
    // Fin des contrôleurs.
    }
    // Toutes les routes sont documentées.
    expect(missing).toEqual([]);
    // Et il y en a bien une centaine : le contrôle porte sur l'ensemble de l'API.
    expect(total).toBeGreaterThan(90);
  // Fin du test.
  });

  // Test : les groupes déclarés servent tous.
  it('ne déclare aucun groupe inutilisé', () => {
    // Les étiquettes employées par les contrôleurs.
    const used = new Set(files
      .map((f) => /@ApiTags\('([^']+)'\)/.exec(readFileSync(join(CONTROLLERS, f), 'utf8')))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => m[1]));
    // Aucun groupe déclaré sans contrôleur.
    expect([...declared].filter((t) => !used.has(t))).toEqual([]);
  // Fin du test.
  });
// Fin du groupe.
});
