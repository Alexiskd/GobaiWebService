// writeFileSync : écrit un fichier d'essai ; mkdtempSync : crée un dossier temporaire ; rmSync : le retire.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// tmpdir : le dossier temporaire du système ; join : assemble un chemin.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Ce qui est testé : la lecture de la consigne et la mise en texte de l'inventaire.
import { loadSystemPrompt, renderInventory } from './assistant.service';

// Groupe de tests de la consigne et de l'inventaire.
describe('consigne de l’assistant et inventaire de l’écran', () => {
  // Premier test : le fichier md est lu.
  it('lit la consigne dans le fichier md', () => {
    // Un dossier temporaire.
    const dir = mkdtempSync(join(tmpdir(), 'consigne-'));
    // Le fichier d'essai, avec des espaces autour pour vérifier qu'ils sont retirés.
    const file = join(dir, 'consigne.md');
    // Écrit la consigne d'essai.
    writeFileSync(file, '\n  # Essai\n\nTu es l’assistant d’essai.\n  \n', 'utf8');
    // La consigne lue vaut le contenu du fichier, sans ses espaces de bord.
    expect(loadSystemPrompt(file)).toBe('# Essai\n\nTu es l’assistant d’essai.');
    // Retire le dossier.
    rmSync(dir, { recursive: true, force: true });
  // Fin du test.
  });

  // Deuxième test : le repli.
  it('retombe sur la consigne de secours quand le fichier manque ou est vide', () => {
    // Un chemin qui n'existe pas : la consigne de secours, qui n'est pas vide.
    const absent = loadSystemPrompt(join(tmpdir(), 'consigne-absente-xyz.md'));
    // Elle n'est pas vide,
    expect(absent.length).toBeGreaterThan(100);
    // et elle dit ce qu'est l'assistant.
    expect(absent).toContain('assistant');
    // Un fichier vide donne la même consigne de secours.
    const dir = mkdtempSync(join(tmpdir(), 'consigne-'));
    // le fichier vide,
    const file = join(dir, 'consigne.md');
    // écrit avec des espaces seulement,
    writeFileSync(file, '   \n  ', 'utf8');
    // donne la consigne de secours.
    expect(loadSystemPrompt(file)).toBe(absent);
    // Retire le dossier.
    rmSync(dir, { recursive: true, force: true });
  // Fin du test.
  });

  // Troisième test : l'inventaire mis en texte.
  it('met l’inventaire en texte, une ligne par élément', () => {
    // Un inventaire de deux éléments, dont un avec un état.
    const text = renderInventory([
      // un bouton sans état,
      { id: 'e1', label: 'Galerie', role: 'button' },
      // une case cochée.
      { id: 'e2', label: 'Orbites', role: 'checkbox', state: 'coché' },
    // Fin de l'inventaire.
    ]);
    // Le bloc porte son titre.
    expect(text).toContain('## Inventaire des éléments actionnables à l’écran');
    // Il rappelle l'outil à utiliser.
    expect(text).toContain('agir_sur_un_element');
    // La première ligne : identifiant, rôle, libellé.
    expect(text).toContain('- e1 · button · Galerie');
    // La seconde ajoute l'état.
    expect(text).toContain('- e2 · checkbox · Orbites · coché');
  // Fin du test.
  });

  // Quatrième test : l'inventaire vide.
  it('n’ajoute rien à la consigne quand l’écran n’a aucun élément relevé', () => {
    // Une liste vide ne donne aucun texte.
    expect(renderInventory([])).toBe('');
    // Un appel sans argument non plus.
    expect(renderInventory()).toBe('');
  // Fin du test.
  });
// Fin du groupe.
});
