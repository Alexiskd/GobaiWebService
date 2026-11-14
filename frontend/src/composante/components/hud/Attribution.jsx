// Importe de React les crochets useEffect, useState et useSyncExternalStore.
import { useEffect, useState, useSyncExternalStore } from 'react';
// Importe de MUI Box, la boîte de dialogue, Link, les onglets, les éléments de tableau et Typography.
import { Box, Button, Dialog, DialogContent, Link, Switch as MuiSwitch, Tab, Table, TableBody, TableCell, TableRow, Tabs, TextField, Typography } from '@mui/material';
// Importe tilesApi, le client de l'API des tuiles.
import { tilesApi } from '@/moteur/api';
// Importe useHud, qui lit une valeur du magasin du HUD.
import { useHud } from '@/moteur/engine/hudStore';
// Importe useViewport, qui donne la catégorie d'écran.
import { useViewport } from '@/composante/hooks/useViewport';
// Importe la liste des astres tuilés.
import { TILED_BODIES } from '@/moteur/engine/tiledBodies';
// Importe l'en-tête commun des fenêtres.
import { PanelHeader } from '../ui/PanelHeader';
// Importe l'arborescence du site et son compteur de pages.
import { SITE_TREE, countPages } from './siteTree';
// Importe les organisations, la mise en forme des dates, les organisations des dépôts et les crédits affichés.
import { SERVICE_ORGS, formatRepoDate, orgsFromRepos, visibleCredits } from './openSourceCredits';
// Importe la liste des API et son compteur.
import { API_GROUPS, countApis } from './apiList';
// Importe le blocage des API externes : état, abonnement, bascule et clé d'administration.
import { apiState, getAdminToken, getApiBlockState, refreshServerBlocked, setAdminToken, setApiBlocked, subscribe } from '@/moteur/lib/apiBlock';
// Importe l'onglet du flux cognitif.
import { FluxCognitif } from './FluxCognitif';

// Calculé à chaque lecture : des satellites peuvent être ajoutés après le test Horizons + Trek.
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

// Organisations des dépôts, calculées une seule fois au chargement.
const REPO_ORGS = orgsFromRepos();
// Crédits affichés, calculés une seule fois au chargement.
const CREDITS = visibleCredits();

/**
 * Tableau qui tient toujours dans la largeur de la fenêtre : colonnes de largeur fixe, textes longs coupés à la ligne.
 * Évite tout défilement horizontal, y compris sur téléphone.
 */
// Style des tableaux qui tiennent dans la largeur : colonnes fixes et textes coupés au besoin.
const FIT_TABLE = { width: '100%', tableLayout: 'fixed', '& td': { overflowWrap: 'anywhere', wordBreak: 'break-word' } };

/** Étiquette à bordure, comme dans la table des sources. */
// Déclare le composant Tag : reçoit un contenu.
const Tag = ({ children }) => (
  // Balise span à bordure fine et fond léger, un peu plus petite, coupée au besoin.
  <Box component="span" sx={{ display: 'inline-block', maxWidth: '100%', overflowWrap: 'anywhere', font: 'inherit', fontSize: '0.85em', px: 0.75, py: 0.25, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover' }}>
    {/* Le contenu. */}
    {children}
  {/* Fin de la balise. */}
  </Box>
// Fin de Tag.
);

// Déclare le composant SectionTitle : reçoit un contenu.
const SectionTitle = ({ children }) => (
  // Titre de niveau 3 au style overline, couleur secondaire, avec ses marges.
  <Typography component="h3" variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2, mt: 2.5, mb: 0.5 }}>
    {/* Le contenu. */}
    {children}
  {/* Fin du titre. */}
  </Typography>
// Fin de SectionTitle.
);

// Déclare le composant RepoLink : sans dépôt, le nom seul ; sinon (début).
const RepoLink = ({ item }) => (!item.repo ? item.name : (
  // Lien vers le dépôt GitHub, ouvert dans un nouvel onglet, avec l'adresse en infobulle.
  <Link href={`https://github.com/${item.repo}`} target="_blank" rel="noopener noreferrer" underline="hover" title={`github.com/${item.repo}`}>
    {/* Le nom du projet. */}
    {item.name}
  {/* Fin du lien. */}
  </Link>
// Fin de RepoLink.
));

/**
 * Ligne de tableau : projet, lien vers son dépôt et date de dernière mise à jour à gauche, créateurs à droite.
 */
// Déclare le composant NameRow : reçoit une entrée des crédits.
const NameRow = ({ item }) => {
  // Date de dernière mise à jour, écrite en français.
  const date = formatRepoDate(item.updated);
  // Adresse du dépôt, s'il y en a un.
  const url = item.repo && `https://github.com/${item.repo}`;
  // Début du rendu.
  return (
    // Ligne du tableau.
    <TableRow>
      {/* Cellule de gauche, alignée en haut, sur la moitié de la largeur. */}
      <TableCell sx={{ pl: 0, verticalAlign: 'top', width: '50%' }}>
        {/* Le nom du projet, avec son lien. */}
        <RepoLink item={item} />
        {/* Sous le nom, en petit, couleur secondaire. */}
        <Box component="span" sx={{ display: 'block', fontSize: '0.78em', color: 'text.secondary', wordBreak: 'break-all' }}>
          {/* Le lien écrit en toutes lettres s'il y a un dépôt, la source publiée sinon. */}
          {url ? <Link href={url} target="_blank" rel="noopener noreferrer" underline="hover" color="inherit">{`github.com/${item.repo}`}</Link> : item.source}
        {/* Fin de cette ligne. */}
        </Box>
        {/* S'il y a une date (début). */}
        {date && (
          // Ligne de la date, en petit.
          <Box component="span" sx={{ display: 'block', fontSize: '0.78em', color: 'text.secondary', mt: 0.25 }}>
            {/* « Mis à jour le », suivi de la date. */}
            Mis à jour le {date}
          {/* Fin de la ligne de la date. */}
          </Box>
        // Fin du cas.
        )}
        {/* Si des fichiers sont importés dans le projet (début). */}
        {item.local && (
          // Ligne qui dit ce qui est importé.
          <Box component="span" sx={{ display: 'block', fontSize: '0.78em', color: 'text.secondary' }}>Importé dans le projet : {item.local}</Box>
        // Fin du cas.
        )}
      {/* Fin de la cellule de gauche. */}
      </TableCell>
      {/* Cellule de droite : les créateurs séparés par des virgules, l'organisation à défaut. */}
      <TableCell sx={{ pr: 0, verticalAlign: 'top' }}>{item.people.join(', ') || item.org}</TableCell>
    {/* Fin de la ligne du tableau. */}
    </TableRow>
  // Fin du rendu.
  );
// Fin de NameRow.
};

/** Dates des dépôts chargés en direct, demandées une seule fois par visite (le serveur les garde six heures). */
/** Onglet « Générique » : chaque dépôt utilisé, son lien, sa dernière mise à jour et ses créateurs. */
// Déclare le composant Credits, l'onglet « Générique ».
function Credits() {
  // Début du rendu.
  return (
    // Conteneur de l'onglet.
    <Box>
      {/* Un bloc par groupe de crédits (début). */}
      {CREDITS.map(({ group, items }) => {
        // Un dépôt sans créateur nommé est crédité à son organisation.
        // Ne garde que les entrées qui ont des créateurs ou une organisation.
        const withPeople = items.filter((item) => item.people.length || item.org);
        // Groupe vide : rien n'est affiché.
        if (!withPeople.length) return null;
        // Début du rendu du groupe.
        return (
          // Section nommée par le groupe.
          <Box key={group} component="section" aria-label={group}>
            {/* Le titre du groupe. */}
            <SectionTitle>{group}</SectionTitle>
            {/* Petit tableau. */}
            <Table size="small">
              {/* Corps du tableau. */}
              <TableBody>
                {/* Une ligne par entrée (début). */}
                {withPeople.map((item) => (
                  // La ligne de l'entrée.
                  <NameRow key={item.name} item={item} />
                // Fin des lignes.
                ))}
              {/* Fin du corps du tableau. */}
              </TableBody>
            {/* Fin du tableau. */}
            </Table>
          {/* Fin de la section. */}
          </Box>
        // Fin du rendu du groupe.
        );
      // Fin des blocs.
      })}
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de Credits.
}

/** Onglet « Sources et Entreprises » : sources des données affichées, puis organisations et ce qu'elles fournissent. */
// Déclare le composant SourcesAndCompanies : reçoit les lignes des sources.
function SourcesAndCompanies({ rows }) {
  // Début du rendu.
  return (
    // Conteneur sans débordement horizontal.
    <Box sx={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Premier titre. */}
      <SectionTitle>Sources des données</SectionTitle>
      {/* Tableau des sources, ajusté à la largeur. */}
      <Table size="small" sx={FIT_TABLE}>
        {/* Corps du tableau. */}
        <TableBody>
          {/* Une ligne par source (début). */}
          {rows.map(([label, text]) => (
            // La ligne, de clé unique.
            <TableRow key={`${label}|${text}`}>
              {/* Le libellé, en étiquette, sur 40 % de la largeur. */}
              <TableCell sx={{ pl: 0, verticalAlign: 'top', width: '40%' }}><Tag>{label}</Tag></TableCell>
              {/* La mention de la source. */}
              <TableCell sx={{ pr: 0 }}>{text}</TableCell>
            {/* Fin de la ligne. */}
            </TableRow>
          // Fin des lignes.
          ))}
        {/* Fin du corps du tableau. */}
        </TableBody>
      {/* Fin du tableau. */}
      </Table>
      {/* Note sous le tableau. */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {/* Son texte. */}
        Seules les sources des cartes actuellement chargées sont listées.
      {/* Fin de la note. */}
      </Typography>

      {/* Deuxième titre. */}
      <SectionTitle>Données et services</SectionTitle>
      {/* Tableau des organisations, ajusté à la largeur. */}
      <Table size="small" sx={FIT_TABLE}>
        {/* Corps du tableau. */}
        <TableBody>
          {/* Une ligne par organisation, triées par nom sur une copie de la liste (début). */}
          {[...SERVICE_ORGS].sort((a, b) => a.org.localeCompare(b.org, 'fr')).map(({ org, what }) => (
            // La ligne.
            <TableRow key={org}>
              {/* Le nom de l'organisation, en étiquette. */}
              <TableCell sx={{ pl: 0, verticalAlign: 'top', width: '40%' }}><Tag>{org}</Tag></TableCell>
              {/* Ce qu'elle fournit, séparé par des points médians. */}
              <TableCell sx={{ pr: 0 }}>{what.join(' · ')}</TableCell>
            {/* Fin de la ligne. */}
            </TableRow>
          // Fin des lignes.
          ))}
        {/* Fin du corps du tableau. */}
        </TableBody>
      {/* Fin du tableau. */}
      </Table>

      {/* Troisième titre. */}
      <SectionTitle>Entreprises derrière les logiciels libres</SectionTitle>
      {/* Tableau des entreprises, ajusté à la largeur. */}
      <Table size="small" sx={FIT_TABLE}>
        {/* Corps du tableau. */}
        <TableBody>
          {/* Une ligne par organisation de dépôts (début). */}
          {REPO_ORGS.map(({ org, items }) => (
            // La ligne.
            <TableRow key={org}>
              {/* Le nom de l'organisation, en étiquette. */}
              <TableCell sx={{ pl: 0, verticalAlign: 'top', width: '40%' }}><Tag>{org}</Tag></TableCell>
              {/* Cellule des dépôts. */}
              <TableCell sx={{ pr: 0 }}>
                {/* Un élément par dépôt (début). */}
                {items.map((item, i) => (
                  // Balise span de clé unique.
                  <Box component="span" key={item.repo + item.name}>
                    {/* Un point médian avant chaque dépôt, sauf le premier. */}
                    {i > 0 && ' · '}
                    {/* Le lien du dépôt. */}
                    <RepoLink item={item} />
                  {/* Fin de la balise span. */}
                  </Box>
                // Fin des dépôts.
                ))}
              {/* Fin de la cellule. */}
              </TableCell>
            {/* Fin de la ligne. */}
            </TableRow>
          // Fin des lignes.
          ))}
        {/* Fin du corps du tableau. */}
        </TableBody>
      {/* Fin du tableau. */}
      </Table>
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de SourcesAndCompanies.
}

/** Mention affichée sous l'usage d'une API déconnectée, selon l'endroit où elle l'est. */
// Déclare les mentions, par état.
const API_STATE_NOTE = {
  // Déconnectée dans ce navigateur seulement.
  local: 'Déconnectée sur cet appareil',
  // Déconnectée sur le serveur, pour tous les visiteurs.
  server: 'Déconnectée sur le serveur',
  // Déconnectée par le réglage permanent du serveur.
  permanent: 'Déconnectée sur le serveur (réglage permanent)',
// Fin des mentions.
};

/**
 * Onglet « API » : toutes les API externes appelées par l'application, avec leur adresse, leur usage et un
 * interrupteur pour déconnecter chacune. Sans clé d'administration, la déconnexion vaut pour cet appareil ;
 * avec la clé, elle vaut aussi pour le serveur, donc pour tous les visiteurs.
 */
// Déclare le composant ApiList, l'onglet « API ».
function ApiList() {
  // État du blocage, relu à chaque changement.
  const block = useSyncExternalStore(subscribe, getApiBlockState);
  // Clé d'administration en cours de saisie.
  const [token, setToken] = useState(getAdminToken);
  // Message du dernier essai sur le serveur ('' si aucun).
  const [message, setMessage] = useState('');
  // À l'ouverture de l'onglet : relit l'état du serveur.
  useEffect(() => {
    // Contrôleur d'annulation.
    const ctrl = new AbortController();
    // Lance la lecture.
    refreshServerBlocked(ctrl.signal);
    // À la fermeture : annule.
    return () => ctrl.abort();
  // Une seule fois.
  }, []);
  // toggle : connecte ou déconnecte une API.
  const toggle = async (api, connected) => {
    // Efface l'ancien message.
    setMessage('');
    // Applique le choix (appareil, et serveur si la clé est saisie).
    const result = await setApiBlocked(api, !connected);
    // Le serveur a refusé ou n'a pas répondu : le dit.
    if (result.message) setMessage(`${api.name} : ${result.message} Le réglage vaut pour cet appareil seulement.`);
  // Fin de toggle.
  };
  // saveToken : garde la clé saisie pour la durée de l'onglet.
  const saveToken = () => {
    // Garde la clé, sans espaces autour.
    setAdminToken(token.trim());
    // Confirme.
    setMessage(token.trim() ? 'Clé gardée pour cet onglet du navigateur.' : 'Clé effacée.');
  // Fin de saveToken.
  };
  // Nombre d'API déconnectées, tous groupes confondus.
  const off = API_GROUPS.reduce((n, g) => n + g.items.filter((api) => apiState(api, block) !== 'on').length, 0);
  // Début du rendu.
  return (
    // Conteneur de l'onglet.
    <Box>
      {/* Explication de l'interrupteur. */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {/* Le texte. */}
        Chaque API peut être déconnectée : elle n’est alors plus appelée. Ce qui est déjà affiché reste à l’écran jusqu’au rechargement de la page.
      {/* Fin de l'explication. */}
      </Typography>
      {/* Un bloc par groupe d'API (début). */}
      {API_GROUPS.map(({ group, items }) => (
        // Section nommée par le groupe.
        <Box key={group} component="section" aria-label={group}>
          {/* Le titre du groupe. */}
          <SectionTitle>{group}</SectionTitle>
          {/* Petit tableau. */}
          <Table size="small">
            {/* Corps du tableau. */}
            <TableBody>
              {/* Une ligne par API (début). */}
              {items.map((api) => {
                // État de l'API : connectée, ou déconnectée (appareil, serveur, réglage permanent).
                const st = apiState(api, block);
                // La ligne.
                return (
                  // Ligne atténuée quand l'API est déconnectée.
                  <TableRow key={api.name} sx={st === 'on' ? undefined : { '& td': { color: 'text.disabled' } }}>
                    {/* Cellule de gauche. */}
                    <TableCell sx={{ pl: 0, verticalAlign: 'top', width: '44%' }}>
                      {/* Le nom de l'API. */}
                      {api.name}
                      {/* Son adresse, en petit, jamais traduite. */}
                      <Box component="span" translate="no" sx={{ display: 'block', fontSize: '0.78em', color: 'text.secondary', wordBreak: 'break-all' }}>{api.host}</Box>
                    {/* Fin de la cellule de gauche. */}
                    </TableCell>
                    {/* Cellule du milieu. */}
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      {/* L'usage de l'API. */}
                      {api.use}
                      {/* Si l'API dépend d'une clé : la mention « Si la clé est configurée ». */}
                      {api.key && <Box component="span" sx={{ display: 'block', fontSize: '0.78em', color: 'text.secondary' }}>Si la clé est configurée</Box>}
                      {/* Si l'API est déconnectée : où elle l'est. */}
                      {st !== 'on' && <Box component="span" sx={{ display: 'block', fontSize: '0.78em', color: 'warning.main' }}>{API_STATE_NOTE[st]}</Box>}
                    {/* Fin de la cellule du milieu. */}
                    </TableCell>
                    {/* Cellule de droite : l'interrupteur. */}
                    <TableCell sx={{ pr: 0, pl: 0, verticalAlign: 'top', width: 46 }} align="right">
                      {/* Allumé : API connectée. Le réglage permanent du serveur ne se change pas d'ici. */}
                      <MuiSwitch
                        size="small"
                        checked={st === 'on'}
                        disabled={st === 'permanent'}
                        onChange={(e) => toggle(api, e.target.checked)}
                        slotProps={{ input: { role: 'switch', 'aria-label': `${api.name} : API connectée` } }}
                      />
                    {/* Fin de la cellule de droite. */}
                    </TableCell>
                  {/* Fin de la ligne. */}
                  </TableRow>
                // Fin du rendu de la ligne.
                );
              // Fin des lignes.
              })}
            {/* Fin du corps du tableau. */}
            </TableBody>
          {/* Fin du tableau. */}
          </Table>
        {/* Fin de la section. */}
        </Box>
      // Fin des blocs.
      ))}
      {/* Note de bas d'onglet. */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {/* Le nombre total d'API, et le nombre d'API déconnectées. */}
        {countApis()} API externes, relevées dans le code de l’application{off ? ` ; ${off} déconnectée${off > 1 ? 's' : ''}` : ''}.
      {/* Fin de la note. */}
      </Typography>
      {/* Section de la clé d'administration. */}
      <Box component="section" aria-label="Administration">
        {/* Le titre. */}
        <SectionTitle>Administration</SectionTitle>
        {/* L'explication. */}
        <Typography variant="body2" color="text.secondary">
          {/* Le texte, selon que le serveur accepte ou non une clé. */}
          {block.editable
            ? 'Sans clé, une API est déconnectée sur cet appareil : le navigateur ne l’appelle plus. Avec la clé d’administration, elle l’est aussi sur le serveur, pour tous les visiteurs, jusqu’au redémarrage du serveur.'
            : 'Une API est déconnectée sur cet appareil : le navigateur ne l’appelle plus. Pour la déconnecter aussi sur le serveur, renseignez BLOCKED_API_HOSTS (permanent) ou API_ADMIN_TOKEN (clé pour cet onglet) dans le tableau de bord de l’hébergeur.'}
        {/* Fin de l'explication. */}
        </Typography>
        {/* Si le serveur accepte une clé : le champ et son bouton. */}
        {block.editable && (
          // Champ et bouton côte à côte.
          <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
            {/* Champ de la clé, masqué comme un mot de passe. */}
            <TextField
              size="small"
              type="password"
              autoComplete="off"
              label="Clé d’administration"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              sx={{ flex: 1 }}
            />
            {/* Bouton qui garde la clé. */}
            <Button variant="outlined" size="small" onClick={saveToken}>Valider</Button>
          {/* Fin du champ et du bouton. */}
          </Box>
        )}
        {/* Message du dernier essai. */}
        {message && <Typography variant="body2" role="status" sx={{ mt: 1 }}>{message}</Typography>}
      {/* Fin de la section. */}
      </Box>
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de ApiList.
}

/** Branche de l'arborescence : le nom (lien si la page a une adresse), puis ses enfants reliés par un trait vertical. */
// Déclare le composant TreeNode : un nœud de l'arborescence et l'indicateur de racine.
function TreeNode({ item, root = false }) {
  // Début du rendu.
  return (
    // Élément de liste sans puce.
    <Box component="li" sx={{ listStyle: 'none', py: 0.35 }}>
      {/* Si le nœud a une adresse (début). */}
      {item.path ? (
        // Son nom en lien ; en demi-gras pour la racine et les nœuds qui ont des enfants.
        <Link href={item.path} underline="hover" sx={{ fontWeight: root || item.children.length ? 600 : 400 }}>{item.name}</Link>
      // Sinon (début).
      ) : (
        // Son nom seul, en demi-gras.
        <Box component="span" sx={{ fontWeight: 600 }}>{item.name}</Box>
      // Fin du choix.
      )}
      {/* Si le nœud a une adresse (début). */}
      {item.path && (
        // L'adresse, en petit, à côté du nom.
        <Box component="span" sx={{ ml: 1, fontSize: '0.8em', color: 'text.secondary', wordBreak: 'break-all' }}>{item.path}</Box>
      // Fin du cas.
      )}
      {/* S'il a des enfants (début). */}
      {item.children.length > 0 && (
        // Liste imbriquée, bordée à gauche d'un trait vertical.
        <Box component="ul" sx={{ m: 0, mt: 0.35, ml: 0.75, pl: 1.75, borderLeft: 1, borderColor: 'divider' }}>
          {/* Un nœud par enfant (appel récursif). */}
          {item.children.map((child) => <TreeNode key={child.name} item={child} />)}
        {/* Fin de la liste imbriquée. */}
        </Box>
      // Fin du cas.
      )}
    {/* Fin de l'élément de liste. */}
    </Box>
  // Fin du rendu.
  );
// Fin de TreeNode.
}

/** Onglet « Arborescence » : toutes les pages du site, de l'accueil aux satellites. */
// Déclare le composant SiteTree, l'onglet « Arborescence ».
function SiteTree() {
  // Début du rendu.
  return (
    // Conteneur de l'onglet.
    <Box>
      {/* Le titre. */}
      <SectionTitle>Arborescence du site</SectionTitle>
      {/* Liste racine, sans marge. */}
      <Box component="ul" sx={{ m: 0, p: 0 }}>
        {/* Le nœud racine de l'arborescence. */}
        <TreeNode item={SITE_TREE} root />
      {/* Fin de la liste racine. */}
      </Box>
      {/* Note de bas d'onglet. */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {/* Le nombre de pages et l'explication des liens. */}
        {countPages()} pages. Chaque lien ouvre le site directement sur l’astre ou la fenêtre.
      {/* Fin de la note. */}
      </Typography>
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de SiteTree.
}

/**
 * Sources des données affichées (cartes, éphémérides, ciel…), dans une fenêtre comme celle des raccourcis clavier :
 * plus aucune mention en surimpression sur la scène. Ouverte par le bouton « © » de la barre d'outils ou la touche S.
 * La mention de la Terre est redemandée au fournisseur quand la vue se stabilise.
 */
// Déclare et exporte le composant Attribution : HUD, Lune réelle, mentions supplémentaires, ouverture et fermeture.
export function Attribution({ hud, moonReal = false, extra = '', open = false, onClose }) {
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
  const [tab, setTab] = useState('credits');

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
      tilesApi.attribution(layerId, b, ctrl.signal).then((r) => setCopyright(r.copyright || '')).catch(() => {});
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
    ['Éphémérides', 'Orbites de Kepler (calcul local) · USNO'],
    // La galerie.
    ['Galerie', 'NASA Image and Video Library (images-api.nasa.gov)'],
    // Les modèles 3D de Phobos et de Deimos.
    ['Phobos et Deimos (modèles 3D)', 'NASA/JPL-Caltech — science.nasa.gov'],
    // Les lunes sphériques.
    ['Lunes sphériques', 'JPL SSD, NASA NSSDC · images : NASA Image and Video Library'],
  // Fin des lignes ; les entrées absentes sont retirées.
  ].filter(Boolean);

  // Début du rendu.
  return (
    // Boîte de dialogue : plein écran en mode compact, petite largeur sinon.
    <Dialog open={open} onClose={onClose} fullScreen={compact} maxWidth="sm" fullWidth aria-label="Anthropic Node Open Source">
      {/* L'en-tête, avec le titre et la fermeture. */}
      <PanelHeader title="Anthropic Node Open Source" onClose={onClose} />
      {/* La barre d'onglets (début de la balise). */}
      <Tabs
        // Onglet affiché.
        value={tab}
        // Au changement : affiche l'onglet choisi.
        onChange={(e, v) => setTab(v)}
        // Cinq onglets : défilement horizontal.
        // Défilement horizontal.
        variant="scrollable"
        // Boutons de défilement affichés au besoin.
        scrollButtons="auto"
        // Nom pour les lecteurs d'écran.
        aria-label="Sections de la fenêtre Anthropic Node Open Source"
        // Hauteur de 40 px, filet en bas.
        sx={{ flex: 'none', minHeight: 40, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { minHeight: 40 } }}
      // Fin de la balise ouvrante.
      >
        {/* Onglet « Générique ». */}
        <Tab value="credits" label="Générique" id="node-tab-credits" aria-controls="node-panel-credits" />
        {/* Onglet « Sources et Entreprises ». */}
        <Tab value="sources" label="Sources et Entreprises" id="node-tab-sources" aria-controls="node-panel-sources" />
        {/* Onglet « API ». */}
        <Tab value="apis" label="API" id="node-tab-apis" aria-controls="node-panel-apis" />
        {/* Onglet « Arborescence ». */}
        <Tab value="tree" label="Arborescence" id="node-tab-tree" aria-controls="node-panel-tree" />
        {/* Onglet « Flux cognitif ». */}
        <Tab value="flux" label="Flux cognitif" id="node-tab-flux" aria-controls="node-panel-flux" />
      {/* Fin de la barre d'onglets. */}
      </Tabs>
      {/* Contenu de la boîte de dialogue. */}
      <DialogContent sx={{ pt: 1 }}>
        {/* Panneau de l'onglet, relié à son onglet pour les lecteurs d'écran. */}
        <Box role="tabpanel" id={`node-panel-${tab}`} aria-labelledby={`node-tab-${tab}`}>
          {/* Le contenu de l'onglet affiché ; « Sources et Entreprises » par défaut. */}
          {tab === 'flux' ? <FluxCognitif /> : tab === 'credits' ? <Credits /> : tab === 'tree' ? <SiteTree /> : tab === 'apis' ? <ApiList /> : <SourcesAndCompanies rows={rows} />}
        {/* Fin du panneau. */}
        </Box>
        {/* Note de bas de fenêtre. */}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5 }}>
          {/* Le raccourci clavier. */}
          Touche S pour ouvrir ou fermer cette fenêtre.
        {/* Fin de la note. */}
        </Typography>
      {/* Fin du contenu. */}
      </DialogContent>
    {/* Fin de la boîte de dialogue. */}
    </Dialog>
  // Fin du rendu.
  );
// Fin de Attribution.
}
