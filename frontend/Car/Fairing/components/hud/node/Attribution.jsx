// Fenêtre « Node » (Node Open Source) : tout ce sur quoi l'application repose — sources des données, services
// externes appelés (API), logiciels libres (dépôts et dépendances) et pages du site. Une navigation latérale sur
// ordinateur (onglets horizontaux sur téléphone), les mêmes briques de style dans chaque onglet (nodeUi.jsx).
// Les pages de recherche de l'auteur (flux cognitif, théorie quantique) sont dans la fenêtre « Données ».
// Importe de React les crochets useEffect, useState et useSyncExternalStore.
import { useEffect, useState, useSyncExternalStore } from 'react';
// Importe les composants du kit d'interface (Tailwind CSS et Base UI).
import { Dialog, DialogContent, Link, Switch, Tab, Tabs } from '@/Fairing/kit';
// Importe tilesApi, le client de l'API des tuiles.
import { tilesApi } from '@/Computing/api';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/Engine/AstreSolideEngine/hudStore';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/Fairing/hooks/useViewport';
// Importe la liste des astres tuilés.
import { TILED_BODIES } from '@/Engine/AstreSolideEngine/BodyEngine/tiledBodies';
// Importe l'en-tête commun des fenêtres.
import { PanelHeader } from '../../ui/PanelHeader.jsx';
// Importe l'arborescence du site et son compteur de pages.
import { SITE_TREE, countPages } from './siteTree.js';
// Importe l'arbre 3D des pages du site.
import { SiteTree3D } from './SiteTree3D.jsx';
// Importe les crédits affichés et les organisations des services.
import { SERVICE_ORGS, visibleCredits } from './openSourceCredits.js';
// Importe la liste des API et son compteur.
import { API_GROUPS, countApis } from './apiList.js';
// Importe le blocage des API externes : état, abonnement, relecture et bascule.
import { apiState, getApiBlockState, refreshServerBlocked, setApiBlocked, subscribe } from '@/Engine/shared/lib/app/apiBlock';
// Importe les briques de style communes de la fenêtre.
import { Carte, Chiffre, Etiquette, Fiche, GrilleChiffres, Note, Precision, Section } from './nodeUi.jsx';
import { LiensLegaux } from '../../ui/LiensLegaux.jsx';

// Calculé à chaque lecture : des satellites peuvent être ajoutés après le chargement.
// satelliteTiles : les astres tuilés qui sont des satellites ou des géantes gazeuses.
const satelliteTiles = () => TILED_BODIES.filter((b) => b.satellite || b.gas);

// Attente avant de redemander la mention de la Terre, en millisecondes.
const ATTRIBUTION_DEBOUNCE_MS = 700;

/** « Io : NASA Trek — … » → ['Io', 'NASA Trek — …'] ; sans « : », le libellé par défaut. */
// Déclare splitLabel : sépare un texte en libellé et mention.
const splitLabel = (text, fallback) => {
  // Cherche le séparateur « : » entouré d'espaces.
  const i = text.indexOf(' : ');
  // S'il est trouvé dans les 40 premiers caractères : ce qui précède et ce qui suit ; sinon le libellé par défaut et tout le texte.
  return i > 0 && i < 40 ? [text.slice(0, i), text.slice(i + 3)] : [fallback, text];
// Fin de splitLabel.
};

// Crédits affichés, calculés une seule fois au chargement.
const CREDITS = visibleCredits();
// Toutes les API de la liste, à plat.
const TOUTES_API = API_GROUPS.flatMap((g) => g.items);

/**
 * Les sept onglets de la fenêtre, dans l'ordre : identifiant, libellé et ligne d'aide affichée sous le libellé dans
 * la navigation latérale. Les quatre premiers décrivent le projet, le cinquième son API, les deux derniers sont les
 * pages de recherche de l'auteur.
 */
// Déclare la liste des onglets.
// Dans l'ordre où l'on en a besoin : d'où viennent les données, quels services sont appelés, sur quels logiciels le
// site repose, quelles pages il a. Flux cognitif et Théorie quantique sont dans la fenêtre « Données ».
const ONGLETS = [
  { id: 'settings', label: 'Paramètres', aide: 'Astres affichés, aller à un astre, catalogue' },
  { id: 'sources', label: 'Sources des données', aide: 'Origine des données affichées' },
  { id: 'apis', label: 'Services (API)', aide: 'Services externes appelés' },
  { id: 'credits', label: 'Logiciels libres', aide: 'Dépôts et dépendances' },
  { id: 'tree', label: 'Pages du site', aide: 'Arborescence du site' },
];

/** Les services déclarés, découpés en familles : véritables API, serveurs de tuiles, puis stockage et diffusion de fichiers. */
// Déclare les familles : leur catégorie dans la liste des API (`kind`), leur titre de section, puis leur définition.
const KIND_SECTIONS = [
  { kind: 'api', title: 'API et web services', note: 'Services qui reçoivent des paramètres (coordonnées, requêtes textuelles, SQL/TAP), calculent, et renvoient des données structurées (JSON, XML, tables).' },
  { kind: 'tiles', title: 'Services de tuiles cartographiques', note: 'Serveurs spécialisés qui découpent et délivrent des portions de cartes ou de données géographiques, raster ou vectorielles ; ils ne calculent rien à la demande.' },
  { kind: 'static', title: 'CDN, stockage cloud et fichiers statiques', note: 'Espaces de stockage et réseaux de diffusion : aucun calcul ni requête complexe, seulement des fichiers bruts hébergés (images, polices, scripts, vidéos, archives de tuiles).' },
// Fin de la liste des familles.
];

/** Nom d'un projet : un lien vers son dépôt GitHub, avec l'adresse écrite en dessous. */
// Déclare le composant Depot : reçoit une entrée des crédits.
const Depot = ({ item }) => (
  // Le nom en lien, puis l'adresse en petit.
  <div>
    <Link href={`https://github.com/${item.repo}`} target="_blank" rel="noopener noreferrer" underline="hover" className="font-semibold">{item.name}</Link>
    <Precision brut>github.com/{item.repo}</Precision>
  </div>
// Fin de Depot.
);

/** Onglet « Générique » : chaque dépôt déclaré dans les manifestes du projet, puis les organisations des services. */
// Déclare le composant Credits.
function Credits() {
  // Nombre de paquets crédités et de dépôts distincts.
  const paquets = CREDITS.flatMap((g) => g.items);
  const depots = new Set(paquets.map((p) => p.repo)).size;
  // Début du rendu.
  return (
    <div>
      {/* Chiffres clés. */}
      <GrilleChiffres>
        <Chiffre libelle="Paquets déclarés" valeur={paquets.length} detail="dans les manifestes package.json du dépôt" />
        <Chiffre libelle="Dépôts GitHub" valeur={depots} detail="plusieurs paquets partagent un même dépôt" />
        <Chiffre libelle="Organisations et services" valeur={SERVICE_ORGS.length} detail="dont l’application utilise le travail" />
      </GrilleChiffres>
      {/* Un bloc par groupe de crédits. */}
      {CREDITS.map(({ group, items }, i) => (
        <Section key={group} numero={i + 1} titre={group}>
          <Fiche
            fixe label={group}
            colonnes={[{ largeur: '62%' }, { align: 'right' }]}
            lignes={items.map((item) => [<Depot key={item.name} item={item} />, item.people.join(', ') || item.org || '—'])}
          />
        </Section>
      ))}
      {/* Les organisations dont un service est utilisé, et pourquoi. */}
      <Section numero={CREDITS.length + 1} titre="Organisations et services" sousTitre="Chaque ligne correspond à un usage relevé dans le code.">
        <Fiche
          fixe label="Organisations et services utilisés"
          colonnes={[{ largeur: '34%' }, {}]}
          lignes={SERVICE_ORGS.slice().sort((a, b) => a.org.localeCompare(b.org, 'fr')).map((o) => [<Etiquette key={o.org}>{o.org}</Etiquette>, o.what.join(' · ')])}
        />
      </Section>
      <Note>
        Seuls les paquets présents dans <code>frontend/package.json</code> et <code>frontend/Car/Computing/api/package.json</code>{' '}
        sont listés ; aucun auteur ni date n’est ajouté de mémoire.
      </Note>
    </div>
  );
// Fin de Credits.
}

/** Onglet « Sources et Entreprises » : sources des données affichées, puis services déclarés, par famille. */
// Déclare le composant SourcesAndCompanies : reçoit les lignes des sources.
function SourcesAndCompanies({ rows }) {
  // Début du rendu.
  return (
    <div>
      <Section numero={1} titre="Sources des données" sousTitre="Seules les sources des cartes actuellement chargées sont listées.">
        <Fiche
          fixe label="Sources des données affichées"
          colonnes={[{ largeur: '34%' }, {}]}
          lignes={rows.map(([label, text]) => [<Etiquette key={label}>{label}</Etiquette>, text])}
        />
      </Section>
      {/* Une section par famille de services déclarés. */}
      {KIND_SECTIONS.map(({ kind, title, note }, i) => {
        // Les services de la famille, pris dans la liste des API.
        const list = TOUTES_API.filter((api) => api.kind === kind);
        // Famille vide : rien n'est affiché.
        if (!list.length) return null;
        // La section de la famille.
        return (
          <Section key={kind} numero={i + 2} titre={title} sousTitre={note}>
            <Fiche
              fixe label={title}
              colonnes={[{ largeur: '40%' }, {}]}
              lignes={list.map((api) => [
                <div key={api.name}><Etiquette>{api.name}</Etiquette><Precision brut className="mt-0.5">{api.host}</Precision></div>,
                api.use,
              ])}
            />
          </Section>
        );
      // Fin des familles.
      })}
    </div>
  );
// Fin de SourcesAndCompanies.
}

/** Mention affichée sous l'usage d'une API déconnectée, selon l'endroit où elle l'est. */
// Déclare les mentions, par état.
const API_STATE_NOTE = {
  // Déconnectée dans ce navigateur seulement.
  local: 'Déconnectée sur cet appareil',
  // Déconnectée sur un serveur (sans objet dans l'édition statique, gardé pour une API branchée).
  server: 'Déconnectée sur le serveur',
  // Déconnectée par un réglage permanent du serveur.
  permanent: 'Déconnectée sur le serveur (réglage permanent)',
// Fin des mentions.
};

/**
 * Onglet « API » : toutes les API externes appelées par l'application, avec leur adresse, leur usage et un
 * interrupteur pour déconnecter chacune sur cet appareil. L'édition statique n'a pas de serveur : la clé
 * d'administration et la déconnexion « pour tous les visiteurs » de l'ancienne version n'existent plus.
 * Un service marqué `requis` ne pourrait pas être déconnecté ; plus aucun ne l'est depuis le retrait du verrou d'accès.
 */
// Déclare le composant ApiList.
function ApiList() {
  // État du blocage, relu à chaque changement.
  const block = useSyncExternalStore(subscribe, getApiBlockState);
  // À l'ouverture de l'onglet : marque l'état comme lu (aucun serveur n'est consulté en mode statique).
  useEffect(() => { refreshServerBlocked(); }, []);
  // Nombre d'API déconnectées, tous groupes confondus.
  const off = TOUTES_API.filter((api) => apiState(api, block) !== 'on').length;
  // Nombre d'API qui ne sont appelées que si une clé est saisie.
  const aCle = TOUTES_API.filter((api) => api.key).length;
  // Début du rendu.
  return (
    <div>
      {/* Chiffres clés. */}
      <GrilleChiffres>
        <Chiffre libelle="Services externes" valeur={countApis()} detail="relevés dans le code de l’application" />
        <Chiffre libelle="Déconnectés sur cet appareil" valeur={off} couleur={off ? 'warning.main' : 'text.primary'} detail={off ? 'plus aucun appel ne part vers eux' : 'tous les services sont connectés'} />
        <Chiffre libelle="Appelés avec une clé" valeur={aCle} detail="seulement si l’utilisateur a saisi la sienne" />
      </GrilleChiffres>
      <Note>
        Chaque service peut être déconnecté : le navigateur ne l’appelle alors plus. Le réglage est gardé sur cet appareil ;
        ce qui est déjà affiché reste à l’écran jusqu’au rechargement de la page.
      </Note>
      {/* Un bloc par groupe d'API. */}
      {API_GROUPS.map(({ group, items }, i) => (
        <Section key={group} numero={i + 1} titre={group}>
          <Fiche
            fixe label={group}
            colonnes={[{ largeur: '38%' }, {}, { largeur: 58, align: 'right' }]}
            lignes={items.map((api) => {
              // État de l'API : connectée, ou déconnectée (appareil, serveur, réglage permanent).
              const st = apiState(api, block);
              // Les trois cellules : nom et adresse, usage et mentions, interrupteur.
              return [
                <div key="nom" className={`${st === 'on' ? 'text-ink' : 'text-faint'}`}>
                  <span className="font-semibold">{api.name}</span>
                  <Precision brut>{api.host}</Precision>
                </div>,
                <div key="usage" className={`${st === 'on' ? 'text-ink' : 'text-faint'}`}>
                  {api.use}
                  {api.key && <Precision>Seulement si la clé est saisie</Precision>}
                  {api.requis && <Precision couleur="info.main">Nécessaire à l’ouverture de l’application</Precision>}
                  {st !== 'on' && <Precision couleur="warning.main">{API_STATE_NOTE[st]}</Precision>}
                </div>,
                // Allumé : API connectée. Un service requis ou un réglage permanent ne se change pas d'ici.
                <Switch
                  key="etat" size="small" checked={st === 'on'} disabled={st === 'permanent' || Boolean(api.requis)}
                  onChange={(e) => setApiBlocked(api, !e.target.checked)}
                  slotProps={{ input: { role: 'switch', 'aria-label': `${api.name} : API connectée` } }}
                />,
              ];
            })}
          />
        </Section>
      ))}
    </div>
  );
// Fin de ApiList.
}

/** Branche de l'arborescence : le nom (lien si la page a une adresse), son adresse, puis ses enfants reliés par un trait. */
// Déclare le composant TreeNode : un nœud de l'arborescence et l'indicateur de racine.
function TreeNode({ item, root = false }) {
  // Début du rendu.
  return (
    // Élément de liste sans puce.
    <li className="list-none py-[3.2px]">
      {/* Le nom : en lien si le nœud a une adresse, en demi-gras s'il est la racine ou s'il a des enfants. */}
      {item.path ? (
        <Link href={item.path} underline="hover" className={`${root || item.children.length ? 'font-bold' : 'font-normal'}`}>{item.name}</Link>
      ) : (
        <span className="font-bold">{item.name}</span>
      )}
      {/* L'adresse, à chasse fixe, à côté du nom. */}
      {item.path && <span translate="no" className="ml-2 font-mono text-[0.75em] text-soft [overflow-wrap:anywhere]">{item.path}</span>}
      {/* Les enfants, dans une liste imbriquée bordée à gauche d'un trait vertical. */}
      {item.children.length > 0 && (
        <ul className="m-0 mt-[3.2px] ml-1.5 pl-3.5 border-l border-line">
          {item.children.map((child) => <TreeNode key={child.name} item={child} />)}
        </ul>
      )}
    </li>
  );
// Fin de TreeNode.
}

/** Onglet « Arborescence » : toutes les pages du site, de l'accueil aux satellites et aux planètes naines. */
// Déclare le composant SiteTree.
function SiteTree() {
  // Les astres de l'arborescence : le premier groupe de la racine.
  const astres = countPages(SITE_TREE.children[0]);
  // Début du rendu.
  return (
    <div>
      {/* Chiffres clés. */}
      <GrilleChiffres>
        <Chiffre libelle="Pages" valeur={countPages()} detail="chacune a sa propre adresse" />
        <Chiffre libelle="Astres" valeur={astres} detail="étoile, planètes, planètes naines et satellites" />
        <Chiffre libelle="Fenêtres" valeur={countPages() - astres - 1} detail="Données, Node et Dons" />
      </GrilleChiffres>
      <Section numero={1} titre="Arborescence en 3D" sousTitre="Glisser pour tourner ; cliquer une page pour l’ouvrir. Disposition calculée par la stack @go-/harmonie-3d.">
        <Carte className="bg-transparent p-0">
          <SiteTree3D />
        </Carte>
      </Section>
      <Section numero={2} titre="Arborescence du site" sousTitre="Chaque lien ouvre le site directement sur l’astre ou la fenêtre.">
        <Carte className="bg-transparent">
          <ul className="m-0 p-0"><TreeNode item={SITE_TREE} root /></ul>
        </Carte>
      </Section>
      <Note>
        Le site est une application à page unique : chaque adresse est servie par le même fichier, puis l’application se
        place sur l’astre nommé. Les adresses des astres sont celles du sitemap ; <code>/galerie</code> y désigne la fenêtre
        Données, ouverte aussi par <code>/donnees</code>.
      </Note>
    </div>
  );
// Fin de SiteTree.
}

/**
 * Sources des données affichées (cartes, éphémérides, ciel…), dans une fenêtre comme celle des raccourcis clavier :
 * plus aucune mention en surimpression sur la scène. Ouverte par le bouton « © » de la barre d'outils ou la touche S.
 * La mention de la Terre est redemandée au fournisseur quand la vue se stabilise.
 */
// Déclare et exporte le composant Attribution : HUD, Lune réelle, mentions supplémentaires, ouverture et fermeture.
export function Attribution({ hud, moonReal = false, extra = '', open = false, onClose, settings = null, view = '' }) {
  // Lit le mode compact.
  const { compact } = useViewport();
  // Lit l'état des tuiles de la Terre.
  const tiles = useHud(hud, (s) => s.tiles);
  // Identifiant de la couche de la Terre, null s'il n'y en a pas.
  const layerId = tiles?.layerId ?? null;
  // Limites de la zone visible, null si elles manquent.
  const b = tiles?.bounds ?? null;
  // État : la mention du fournisseur pour la zone visible.
  const [copyright, setCopyright] = useState('');
  // État : l'onglet affiché, « Générique » au départ.
  const [tab, setTab] = useState('sources');
  // À l'ouverture : l'onglet demandé (« settings » depuis les paramètres), sinon celui des sources.
  useEffect(() => { if (open) setTab(view === 'settings' ? 'settings' : 'sources'); }, [open, view]);

  // Clé de la vue : la couche, le zoom et les quatre limites ; null sans limites.
  const key = b ? `${layerId}|${b.zoom}|${b.north}|${b.south}|${b.east}|${b.west}` : null;
  // Effet qui redemande la mention quand la vue change.
  useEffect(() => {
    // Sans couche ou sans limites : efface la mention et s'arrête.
    if (!layerId || !b) { setCopyright(''); return undefined; }
    // Crée un contrôleur d'annulation.
    const ctrl = new AbortController();
    // Programme la demande après l'attente.
    const t = setTimeout(() => {
      // Demande la mention au fournisseur et la garde ; un échec est ignoré.
      tilesApi.attribution(layerId, b, ctrl.signal).then((r) => { if (!ctrl.signal.aborted) setCopyright(r.copyright || ''); }).catch(() => {});
    // Fin de la programmation.
    }, ATTRIBUTION_DEBOUNCE_MS);
    // Nettoyage : annule l'attente et la requête.
    return () => { clearTimeout(t); ctrl.abort(); };
  // Fin de l'effet ; dépendance : la clé de la vue (règle ESLint désactivée par la ligne suivante).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Lit l'état des tuiles de la Lune.
  const moon = useHud(hud, (s) => s.moonTiles);
  // Lit l'état des tuiles de Mars.
  const mars = useHud(hud, (s) => s.marsTiles);
  // Lit l'état des tuiles de Mercure.
  const mercury = useHud(hud, (s) => s.mercuryTiles);
  // Lit l'état des tuiles de Vénus.
  const venus = useHud(hud, (s) => s.venusTiles);
  // Satellites et géantes gazeuses : une seule chaîne (valeur stable pour le store), une mention par astre affiché.
  // Lit les mentions des satellites et des géantes : pour chacun…
  const satellites = useHud(hud, (s) => satelliteTiles()
    // … sa mention si une couche est affichée, vide sinon…
    .map((t) => (s[t.hudKey]?.layerId ? s[t.hudKey].attributionText : ''))
    // … sans les vides…
    .filter(Boolean)
    // … réunies en un seul texte, une par ligne.
    .join('\n'));
  // Mention de la Terre, vide sans couche.
  const tileText = tiles?.layerId ? tiles.attributionText : '';
  // Lune « réelle » : détail Kaguya (fond) coloré par les couleurs naturelles NASA SVS.
  // Mention de la Lune, complétée par les couleurs NASA SVS en Lune réelle ; vide sans couche.
  const moonText = moon?.layerId ? (moonReal ? `${moon.attributionText} · couleurs NASA SVS` : moon.attributionText) : '';

  // Lignes du tableau des sources (début).
  const rows = [
    // La Terre, si elle a une mention.
    tileText && ['Terre', tileText],
    // La zone visible de la Terre, si sa mention diffère de la précédente.
    copyright && copyright !== tileText && ['Terre (zone visible)', copyright],
    // La Lune, si elle a une mention.
    moonText && ['Lune', moonText],
    // Mars, si une couche est affichée.
    mars?.layerId && ['Mars', mars.attributionText],
    // Mercure, si une couche est affichée.
    mercury?.layerId && ['Mercure', mercury.attributionText],
    // Vénus, si une couche est affichée.
    venus?.layerId && ['Vénus', venus.attributionText],
    // Une ligne par satellite, libellée par son nom (« Satellites » à défaut).
    ...(satellites ? satellites.split('\n').map((t) => splitLabel(t, 'Satellites')) : []),
    // Une ligne par mention supplémentaire (« Données » à défaut).
    ...(extra ? extra.split(' · ').map((t) => splitLabel(t, 'Données')) : []),
    // Les éphémérides.
    ['Éphémérides', 'Orbites de Kepler calculées dans le navigateur · éléments moyens JPL SSD'],
    // Les photos des astres, dans le panneau Caractéristiques et informations.
    ['Photos des astres', 'Ma collection (photos et vidéos personnelles, servies par le serveur de Gobai Space)'],
    // Les modèles 3D de Phobos et de Deimos.
    ['Phobos et Deimos (modèles 3D)', 'NASA/JPL-Caltech — science.nasa.gov'],
    // Les lunes sphériques.
    ['Lunes sphériques', 'JPL SSD, NASA NSSDC'],
  // Fin des lignes ; les entrées absentes sont retirées.
  ].filter(Boolean);

  // Le contenu de l'onglet affiché.
  const contenu = tab === 'settings' ? settings : tab === 'credits' ? <Credits /> : tab === 'tree' ? <SiteTree /> : tab === 'apis' ? <ApiList /> : <SourcesAndCompanies rows={rows} />;

  // Début du rendu.
  return (
    // Fenêtre large ; plein écran en mode compact. La hauteur est fixe sur ordinateur : changer d'onglet ne la fait pas sauter.
    <Dialog
      open={open} onClose={onClose} fullScreen={compact} maxWidth="lg" fullWidth aria-label="Node Open Source"
      paperClassName="overflow-hidden" paperStyle={{ height: compact ? '100%' : 'min(88vh, 900px)' }}
    >
      {/* En-tête : surtitre, titre et bouton de fermeture. */}
      <PanelHeader kicker="Go白ناन्टех · Node Open Source" title="Node — sources et outils" onClose={onClose} className="px-5 pt-4 pb-3" />
      {/* Corps : navigation à gauche et contenu à droite sur ordinateur ; navigation au-dessus sur téléphone. */}
      <div className={`flex-1 min-h-0 flex ${compact ? 'flex-col' : 'flex-row'}`}>
        {/* Les onglets : verticaux avec une ligne d'aide sur ordinateur, horizontaux et défilants sur téléphone. */}
        <Tabs
          value={tab}
          onChange={(e, v) => setTab(v)}
          orientation={compact ? 'horizontal' : 'vertical'}
          variant="scrollable"
          scrollButtons={compact ? 'auto' : false}
          aria-label="Sections de la fenêtre Node Open Source"
          className={`${compact ? 'flex-none px-2 border-b border-line' : 'flex-none w-58 py-2 border-r border-line'}`}
        >
          {ONGLETS.map((o, i) => (
            <Tab
              key={o.id} value={o.id} id={`node-tab-${o.id}`} aria-controls={`node-panel-${o.id}`}
              // Sur téléphone, le libellé seul ; sur ordinateur, le numéro, le libellé et la ligne d'aide.
              label={compact ? o.label : (
                <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-2 text-left w-full">
                  <span aria-hidden="true" className="font-mono text-[0.7rem] text-primary pt-[3px]">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0">
                    <span className="block leading-[1.3]">{o.label}</span>
                    <span className="block text-[0.72rem] font-normal text-soft leading-[1.35] mt-0.5">{o.aide}</span>
                  </span>
                </div>
              )}
              className={`${compact ? 'min-w-24' : 'items-start justify-start w-full text-left px-4 py-2 max-w-none aria-selected:bg-hover'}`}
            />
          ))}
        </Tabs>
        {/* Contenu de l'onglet : seul élément qui défile. */}
        <DialogContent className="flex-1 min-w-0 p-3 min-[600px]:p-6">
          {/* Panneau de l'onglet, relié à son onglet pour l'accessibilité, limité en largeur pour la lecture. */}
          <div role="tabpanel" id={`node-panel-${tab}`} aria-labelledby={`node-tab-${tab}`} className="max-w-220 mx-auto min-w-0">
            {contenu}
            {/* Mentions légales et confidentialité : visibles quel que soit l'onglet. */}
            <LiensLegaux className="mt-8 text-soft" />
            {/* Rappel du raccourci clavier, sur ordinateur seulement. */}
            {!compact && <Note className="mt-8 text-[0.78rem]">Touche S pour ouvrir ou fermer cette fenêtre.</Note>}
          </div>
        </DialogContent>
      </div>
    </Dialog>
  // Fin du rendu.
  );
// Fin de Attribution.
}
