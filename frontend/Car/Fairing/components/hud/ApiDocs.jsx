// Onglet « Documentation API » de la fenêtre Node : l'API NestJS de ce dépôt (frontend/Car/Computing/api), son rôle,
// la façon de la lancer et la référence de ses routes, relevée dans les contrôleurs.
// Crochet d'état de React.
import { useState } from 'react';
// Composants MUI.
import { Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';
// Données de la documentation.
import {
  API_DOC_BASE, API_DOC_DIR, API_DOC_ENV, API_DOC_EXAMPLES, API_DOC_GROUPS, API_DOC_RESISTANCE_LEVELS, API_DOC_RULES,
  API_DOC_SOURCES, countDocRoutes, resistanceDuGroupe,
} from './apiDocs.js';
// Adresse de l'API branchée à la construction du site ('' sans API).
import { API_BASE } from '@/Computing/api';
// Briques de style communes de la fenêtre Node.
import { Alerte, Chiffre, Etiquette, Fiche, Formule, GrilleChiffres, MONO, Note, Precision, Section } from './nodeUi.jsx';

/** « 24 000 » plutôt que « 24000 » : plus facile à lire dans un tableau de chiffres journaliers. */
// formateNombre : regroupe les milliers avec une espace fine.
const formateNombre = (n) => (n == null ? '—' : n.toLocaleString('fr-FR'));

/** Étiquette de résistance : couleur et libellé du niveau, posés sur Etiquette. */
// Déclare ResistanceBadge : le niveau (clé de API_DOC_RESISTANCE_LEVELS).
function ResistanceBadge({ niveau }) {
  // Son libellé et sa couleur.
  const { libelle, couleur } = API_DOC_RESISTANCE_LEVELS[niveau];
  // Début du rendu.
  return <Etiquette couleur={couleur}>{libelle}</Etiquette>;
// Fin de ResistanceBadge.
}

/** Copie un texte dans le presse-papiers ; un échec est ignoré (navigateur sans permission). */
// copy : écrit le texte dans le presse-papiers.
const copy = (text) => navigator.clipboard?.writeText(text).catch(() => {});

/** Bloc de code avec un bouton « Copier ». */
// Déclare CodeBlock : reçoit le code.
function CodeBlock({ code }) {
  // État : le code vient-il d'être copié ?
  const [done, setDone] = useState(false);
  // Début du rendu.
  return (
    // Conteneur qui place le bouton dans le coin du bloc.
    <Box sx={{ position: 'relative' }}>
      {/* Le code, avec la place du bouton réservée à droite. */}
      <Formule sx={{ pr: 9 }}>{code}</Formule>
      {/* Le bouton : copie, puis affiche « Copié » une seconde et demie. */}
      <Button
        size="small"
        onClick={() => { copy(code); setDone(true); setTimeout(() => setDone(false), 1500); }}
        sx={{ position: 'absolute', top: 6, right: 6, minWidth: 0, px: 1, py: 0.25, fontSize: '0.72rem' }}
      >
        {done ? 'Copié' : 'Copier'}
      </Button>
    </Box>
  );
// Fin de CodeBlock.
}

/** Une route : méthode, chemin à chasse fixe, description. Les envois (POST) sont teintés autrement que les lectures. */
// Déclare RouteRow : méthode, chemin et texte.
function RouteRow({ method, path, text }) {
  // Début du rendu.
  return (
    // Ligne séparée de la suivante par un trait fin.
    <Box sx={{ display: 'grid', gridTemplateColumns: '52px minmax(0, 1fr)', columnGap: 1, py: 0.9, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      {/* La méthode HTTP. */}
      <Box component="span" sx={{ fontFamily: MONO, fontSize: '0.72rem', fontWeight: 700, color: method === 'GET' ? 'info.main' : 'warning.main', pt: 0.25 }}>{method}</Box>
      {/* Le chemin, puis sa description. */}
      <Box sx={{ minWidth: 0 }}>
        <Box component="code" translate="no" sx={{ fontFamily: MONO, fontSize: '0.82rem', overflowWrap: 'anywhere' }}>{path}</Box>
        <Precision sx={{ mt: 0.25, fontSize: '0.8rem' }}>{text}</Precision>
      </Box>
    </Box>
  );
// Fin de RouteRow.
}

/** Onglet « Documentation API ». */
// Déclare et exporte ApiDocs.
export function ApiDocs() {
  // État : le texte du filtre et l'exemple affiché.
  const [filter, setFilter] = useState('');
  const [example, setExample] = useState(0);
  // Le filtre, sans espaces autour et en minuscules.
  const f = filter.trim().toLowerCase();
  // Les groupes, réduits aux routes qui contiennent le filtre.
  const groups = API_DOC_GROUPS
    .map((g) => ({ ...g, routes: f ? g.routes.filter(([m, p, t]) => `${m} ${p} ${t} ${g.group}`.toLowerCase().includes(f)) : g.routes }))
    .filter((g) => g.routes.length);
  // Nombre de routes de lecture (GET) et d'envoi (POST).
  const lectures = API_DOC_GROUPS.flatMap((g) => g.routes).filter(([m]) => m === 'GET').length;
  // Début du rendu.
  return (
    <Box>
      {/* Chiffres clés de l'API. */}
      <GrilleChiffres>
        <Chiffre libelle="Routes" valeur={countDocRoutes()} detail={`${lectures} lectures (GET) · ${countDocRoutes() - lectures} envois (POST)`} />
        <Chiffre libelle="Contrôleurs NestJS" valeur={API_DOC_GROUPS.length} detail={API_DOC_GROUPS.map((g) => g.group.toLowerCase()).join(', ')} />
        <Chiffre libelle="API branchée sur ce site" valeur={API_BASE ? 'Oui' : 'Non'} detail={API_BASE || 'mode statique : contrats embarqués'} couleur={API_BASE ? 'success.main' : 'text.primary'} />
      </GrilleChiffres>
      <Alerte titre="Une API facultative" couleur="info.main">
        Le site est publié en statique et fonctionne sans serveur. L’API de <Box component="code" translate="no" sx={{ fontFamily: MONO, fontSize: '0.85em' }}>{API_DOC_DIR}</Box>{' '}
        sert les mêmes contrats que ceux embarqués dans le navigateur ; seule la galerie y gagne des données en plus, lues
        dans PostgreSQL. Elle n’a pas d’adresse publique fixe ni de documentation Swagger.
      </Alerte>

      <Section numero={1} titre="Règles">
        {/* Liste de définitions : le libellé à gauche, la règle à droite. */}
        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(90px, 18%) 1fr' }, columnGap: 2, rowGap: { xs: 0, sm: 0.75 } }}>
          {API_DOC_RULES.map(([label, text]) => [
            <Typography key={`${label}-t`} component="dt" variant="body2" sx={{ fontWeight: 700, mt: { xs: 1, sm: 0 } }}>{label}</Typography>,
            <Typography key={`${label}-d`} component="dd" variant="body2" color="text.secondary" sx={{ m: 0, overflowWrap: 'anywhere' }}>{text}</Typography>,
          ])}
        </Box>
      </Section>

      <Section numero={2} titre="Démarrage" sousTitre={`Adresse par défaut : ${API_DOC_BASE} (port réglable par API_PORT).`}>
        {/* Le choix de l'exemple. */}
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ mb: 1, flexWrap: 'wrap' }}>
          {API_DOC_EXAMPLES.map((ex, i) => (
            <Chip key={ex.label} label={ex.label} size="small" clickable color={i === example ? 'primary' : 'default'} onClick={() => setExample(i)} />
          ))}
        </Stack>
        <CodeBlock code={API_DOC_EXAMPLES[example].code} />
        <Note>
          Pour brancher le site sur une API en ligne, donnez son adresse à <code>{API_DOC_ENV}</code> au moment de la
          construction. Cette valeur est écrite dans le JavaScript livré : n’y mettez jamais de secret.
        </Note>
      </Section>

      <Section
        numero={3} titre="Résistance des sources connectées"
        sousTitre="Pour chaque source externe réellement interrogée par ce backend, le nombre de requêtes possibles par jour à l’échelle globale du site (tous les visiteurs confondus) et la résistance qui en découle."
      >
        <Fiche
          label="Résistance des sources externes"
          colonnes={[{ titre: 'Source' }, { titre: 'Requêtes / jour (global)', align: 'right' }, { titre: 'Résistance', align: 'right' }]}
          lignes={API_DOC_SOURCES.filter((s) => s.id !== 'interne').map((s) => [
            <Box key="nom">
              <Box component="span">{s.nom}</Box>
              <Precision brut>{s.hotes}</Precision>
              <Precision sx={{ mt: 0.5 }}>{s.base}</Precision>
            </Box>,
            formateNombre(s.parJour),
            <ResistanceBadge key="r" niveau={s.resistance} />,
          ])}
        />
        <Note>
          Chiffres et politiques publiés par chaque fournisseur (relevés le 20 novembre 2026), pas une mesure sur ce
          dépôt. Sans chiffre publié (« — »), la résistance se juge sur la politique connue : clé exigée, garantie de
          service, ou fragilité d’une page lue plutôt qu’appelée (Smithsonian GVP). Les routes qui ne dépendent que de
          ce dépôt (base interne, calculs locaux) n’apparaissent pas ici : leur résistance est « Interne ».
        </Note>
      </Section>

      <Section numero={4} titre="Référence des routes" sousTitre="Relevée dans les contrôleurs ; un test vérifie qu’elle reste à jour.">
        {/* Le filtre. */}
        <TextField
          size="small" fullWidth placeholder="Filtrer : tuiles, soleil, post…" value={filter}
          onChange={(e) => setFilter(e.target.value)} slotProps={{ htmlInput: { 'aria-label': 'Filtrer les routes' } }} sx={{ mb: 1 }}
        />
        {/* Un bloc par contrôleur, avec la résistance de sa plus fragile source externe. */}
        {groups.map(({ group, controller, routes, sources }) => {
          // Résistance du groupe : celle de sa source externe la plus fragile (ou « interne » si aucune).
          const { resistance, source, parJour } = resistanceDuGroupe(sources);
          // Début du rendu.
          return (
            <Box key={group} component="section" aria-label={group} sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{group}</Typography>
                <ResistanceBadge niveau={resistance} />
              </Box>
              <Precision brut>{controller}</Precision>
              {resistance !== 'interne' && (
                <Precision sx={{ mt: 0.25 }}>
                  Maillon le plus fragile : {source.nom} ({formateNombre(parJour)} requêtes/jour au niveau global).
                </Precision>
              )}
              {routes.map(([method, path, text]) => <RouteRow key={`${method} ${path}`} method={method} path={path} text={text} />)}
            </Box>
          );
        // Fin du rendu d'un groupe.
        })}
        {/* Aucun résultat. */}
        {!groups.length && <Note>Aucune route ne correspond.</Note>}
        <Note>
          Sans API joignable, les lectures rendent le contrat embarqué (listes vides, services « indisponibles ») et les
          envois sont refusés. Les données affichées par l’application viennent alors des calculs locaux et des services
          de l’onglet « API ».
        </Note>
      </Section>
    </Box>
  );
// Fin de ApiDocs.
}
