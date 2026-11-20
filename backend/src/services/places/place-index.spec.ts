// Tests du moteur de recherche de lieux interne.
import { PlaceIndex, editDistance, fold, foldQuery, searchLoose } from './place-index';

// Petite base : nom, lat, lon, pays, région, comté, population, nom français, autres noms.
const TSV = [
  'Paris\t48.8534\t2.3488\tFR\tÎle-de-France\tParis\t9904000\t\tПариж|パリ',
  'Paris\t33.6609\t-95.5555\tUS\tTexas\tLamar County\t25171\t\t',
  'Paris\t43.2\t-80.3833\tCA\tOntario\tBrant\t12310\t\t',
  'London\t51.5085\t-0.1257\tGB\tEngland\tGreater London\t8567000\tLondres\tロンドン',
  'Conflans-Sainte-Honorine\t48.9992\t2.0983\tFR\tÎle-de-France\tYvelines\t36358\t\t',
  'Conflans-en-Jarnisy\t49.1667\t5.85\tFR\tGrand Est\tMeurthe et Moselle\t2619\t\t',
  'Saint-Étienne\t45.4339\t4.39\tFR\tAuvergne-Rhône-Alpes\tLoire\t172565\t\t',
  'Marseille\t43.2965\t5.3698\tFR\tProvence-Alpes-Côte d\'Azur\tBouches-du-Rhône\t870018\t\t',
  'ligne illisible',
].join('\n');

const countries: Record<string, string> = { FR: 'France', US: 'États-Unis', CA: 'Canada', GB: 'Royaume-Uni' };
const index = new PlaceIndex(TSV, (c) => countries[c] ?? c);
const names = (q: string, limit = 8) => index.search(q, limit).map((h) => `${h.name} (${h.context})`);

describe('PlaceIndex', () => {
  it('lit la base et ignore les lignes illisibles', () => {
    expect(index.size).toBe(8);
  });

  it('classe la ville homonyme la plus peuplée en premier', () => {
    expect(names('Paris')[0]).toBe('Paris (Île-de-France, France)');
    expect(names('Paris')).toHaveLength(3);
  });

  it('comprend une précision après une virgule, ou sans virgule', () => {
    expect(names('Paris, Texas')).toEqual(['Paris (Lamar County, Texas, États-Unis)']);
    expect(names('paris texas')).toEqual(['Paris (Lamar County, Texas, États-Unis)']);
    expect(names('Paris, Canada')).toEqual(['Paris (Brant, Ontario, Canada)']);
    expect(names('Paris, US')).toEqual(['Paris (Lamar County, Texas, États-Unis)']);
  });

  it('trouve un début de nom et n’importe quel mot du nom', () => {
    expect(names('conf')[0]).toBe('Conflans-Sainte-Honorine (Yvelines, Île-de-France, France)');
    expect(names('honorine')).toEqual(['Conflans-Sainte-Honorine (Yvelines, Île-de-France, France)']);
  });

  it('ignore accents, tirets et abréviations', () => {
    expect(names('st etienne')[0]).toBe('Saint-Étienne (Loire, Auvergne-Rhône-Alpes, France)');
    expect(names('SAINT ETIENNE')[0]).toBe('Saint-Étienne (Loire, Auvergne-Rhône-Alpes, France)');
  });

  it('affiche et trouve le nom français et les noms locaux', () => {
    expect(names('Londres')[0]).toBe('Londres (Greater London, England, Royaume-Uni)');
    expect(names('London')[0]).toBe('Londres (Greater London, England, Royaume-Uni)');
    expect(names('ロンドン')[0]).toBe('Londres (Greater London, England, Royaume-Uni)');
    expect(names('Париж')[0]).toBe('Paris (Île-de-France, France)');
  });

  it('tolère une faute de frappe', () => {
    expect(names('Marseile')[0]).toBe('Marseille (Bouches-du-Rhône, Provence-Alpes-Côte d\'Azur, France)');
    expect(names('Mraseille')[0]).toBe('Marseille (Bouches-du-Rhône, Provence-Alpes-Côte d\'Azur, France)');
  });

  it('respecte la limite et renvoie les coordonnées', () => {
    expect(index.search('Paris', 1)).toEqual([{ name: 'Paris', context: 'Île-de-France, France', lon: 2.3488, lat: 48.8534 }]);
  });

  it('ne renvoie rien pour un texte vide ou sans correspondance', () => {
    expect(index.search('   ')).toEqual([]);
    expect(index.search('zzzzqqq')).toEqual([]);
  });
});

describe('searchLoose', () => {
  it('ramène une adresse à sa localité', () => {
    expect(searchLoose(index, '12 rue de Rivoli, 75001 Paris', 1)[0].context).toBe('Île-de-France, France');
    expect(searchLoose(index, 'Paris', 8)).toHaveLength(3);
  });
});

describe('outils', () => {
  it('plie les textes', () => {
    expect(fold('Saint-Étienne-du-Rouvray')).toBe('saint etienne du rouvray');
    expect(fold("L'Haÿ-les-Roses")).toBe('l hay les roses');
    expect(foldQuery('St Ste Mt')).toBe('saint sainte mont');
  });

  it('mesure la distance d’édition, transpositions comprises', () => {
    expect(editDistance('marseille', 'marseille', 1)).toBe(0);
    expect(editDistance('marseile', 'marseille', 1)).toBe(1);
    expect(editDistance('mraseille', 'marseille', 1)).toBe(1);
    expect(editDistance('abc', 'xyz', 1)).toBe(2);
  });
});
