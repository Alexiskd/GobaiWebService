// Onglet « Documentation API » de la fenêtre Node : documentation de l'API gratuite de Go白ناन्टех.
// Hook d'état de React.
import { useState } from 'react';
// Composants MUI.
import { Box, Button, Chip, Link, Stack, TextField, Typography } from '@mui/material';
// Contenu de la documentation.
import { API_DOC_BASE, API_DOC_EXAMPLES, API_DOC_GROUPS, API_DOC_OPENAPI, API_DOC_RULES, API_DOC_SWAGGER, countDocRoutes } from './apiDocs';

// Titre de section, au même style que les autres onglets de Node.
const SectionTitle = ({ children }) => (
  // Titre de niveau 3, style overline, couleur secondaire.
  <Typography component="h3" variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2, mt: 2.5, mb: 0.5 }}>
    {children}
  </Typography>
);

// Style des blocs de code : police à chasse fixe, coupure à la ligne, fond léger.
const CODE_SX = {
  m: 0, p: 1.25, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'action.hover',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.8rem',
  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
};

/** Copie un texte dans le presse-papiers ; un échec est ignoré (navigateur sans permission). */
const copy = (text) => navigator.clipboard?.writeText(text).catch(() => {});

/** Bloc de code avec un bouton « Copier ». */
function CodeBlock({ code }) {
  // Vrai juste après une copie, pour afficher « Copié ».
  const [done, setDone] = useState(false);
  // Rendu.
  return (
    <Box sx={{ position: 'relative' }}>
      {/* Le code. */}
      <Box component="pre" sx={CODE_SX}>{code}</Box>
      {/* Le bouton de copie, en haut à droite. */}
      <Button
        size="small"
        onClick={() => { copy(code); setDone(true); setTimeout(() => setDone(false), 1500); }}
        sx={{ position: 'absolute', top: 4, right: 4, minWidth: 0, px: 1, py: 0, fontSize: '0.7rem' }}
      >
        {done ? 'Copié' : 'Copier'}
      </Button>
    </Box>
  );
}

/** Une route : méthode, chemin à chasse fixe, description. */
function RouteRow({ method, path, text }) {
  // Rendu.
  return (
    <Box sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
      {/* Méthode et chemin sur une ligne. */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        {/* La méthode HTTP. */}
        <Chip label={method} size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, flex: 'none' }} />
        {/* Le chemin. */}
        <Box component="code" sx={{ fontFamily: CODE_SX.fontFamily, fontSize: '0.8rem', overflowWrap: 'anywhere', minWidth: 0 }}>{path}</Box>
      </Stack>
      {/* La description. */}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{text}</Typography>
    </Box>
  );
}

/** Onglet « Documentation API ». */
export function ApiDocs() {
  // Filtre de recherche dans les routes.
  const [filter, setFilter] = useState('');
  // Exemple de code affiché (index dans API_DOC_EXAMPLES).
  const [example, setExample] = useState(0);
  // Filtre normalisé, en minuscules.
  const f = filter.trim().toLowerCase();
  // Groupes filtrés : seules les routes dont le chemin ou la description contient le filtre.
  const groups = API_DOC_GROUPS
    .map(({ group, routes }) => ({ group, routes: f ? routes.filter(([, p, t]) => `${p} ${t} ${group}`.toLowerCase().includes(f)) : routes }))
    .filter((g) => g.routes.length);
  // Rendu.
  return (
    <Box>
      {/* Présentation. */}
      <Typography variant="h6" component="h2" sx={{ mt: 1 }}>API gratuite</Typography>
      <Typography variant="body2" color="text.secondary">
        Toutes les données de l’app (astres, orbites, Soleil en direct, tuiles, LiDAR, lieux) sont ouvertes à tous.
        Aucune clé, aucun compte : {countDocRoutes()} routes prêtes à l’emploi.
      </Typography>

      {/* Adresse de base. */}
      <SectionTitle>Adresse de base</SectionTitle>
      <CodeBlock code={API_DOC_BASE} />

      {/* Règles d'usage. */}
      <SectionTitle>Règles</SectionTitle>
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'minmax(70px, 25%) 1fr', columnGap: 1.5, rowGap: 0.5 }}>
        {API_DOC_RULES.map(([label, text]) => [
          <Typography key={`${label}-t`} component="dt" variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>,
          <Typography key={`${label}-d`} component="dd" variant="body2" color="text.secondary" sx={{ m: 0 }}>{text}</Typography>,
        ])}
      </Box>

      {/* Démarrage rapide. */}
      <SectionTitle>Démarrage rapide</SectionTitle>
      <Stack direction="row" spacing={0.75} sx={{ mb: 1 }}>
        {API_DOC_EXAMPLES.map((ex, i) => (
          <Chip key={ex.label} label={ex.label} size="small" clickable color={i === example ? 'primary' : 'default'} onClick={() => setExample(i)} />
        ))}
      </Stack>
      <CodeBlock code={API_DOC_EXAMPLES[example].code} />

      {/* Référence des routes. */}
      <SectionTitle>Référence des routes</SectionTitle>
      <TextField
        size="small" fullWidth placeholder="Filtrer : soleil, tuiles, lidar…" value={filter}
        onChange={(e) => setFilter(e.target.value)} inputProps={{ 'aria-label': 'Filtrer les routes' }} sx={{ mb: 1 }}
      />
      {groups.map(({ group, routes }) => (
        <Box key={group} component="section" aria-label={group}>
          <Typography variant="subtitle2" sx={{ mt: 1.5 }}>{group}</Typography>
          {routes.map(([method, path, text]) => <RouteRow key={path} method={method} path={path} text={text} />)}
        </Box>
      ))}
      {!groups.length && <Typography variant="body2" color="text.secondary">Aucune route ne correspond.</Typography>}

      {/* Documentation complète. */}
      <SectionTitle>Documentation complète</SectionTitle>
      <Typography variant="body2" color="text.secondary">
        Paramètres, schémas de réponse et essais en direct : <Link href={API_DOC_SWAGGER} target="_blank" rel="noopener">Swagger</Link>
        {' · '}document OpenAPI pour générer un client : <Link href={API_DOC_OPENAPI} target="_blank" rel="noopener">docs-json</Link>.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Les données viennent de sources tierces (NASA, IGN, NOAA, OpenStreetMap…) : affichez leur mention, donnée par
        /tiles/layers/{'{layerId}'}/attribution et listée dans l’onglet « Sources et Entreprises ».
      </Typography>
    </Box>
  );
}
