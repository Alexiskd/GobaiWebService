import { useEffect, useState } from 'react';

import { Box, Dialog, DialogContent, Link, Tab, Table, TableBody, TableCell, TableRow, Tabs, Typography } from '@mui/material';

import { tilesApi } from '@/moteur/api';

import { useHud } from '@/moteur/engine/hudStore';

import { useViewport } from '@/composante/hooks/useViewport';

import { TILED_BODIES } from '@/moteur/engine/tiledBodies';

import { PanelHeader } from '../ui/PanelHeader';

import { SITE_TREE, countPages } from './siteTree';

import { SERVICE_ORGS, formatRepoDate, orgsFromRepos, visibleCredits } from './openSourceCredits';

import { API_GROUPS, countApis } from './apiList';

import { FluxCognitif } from './FluxCognitif';

import { ApiDocs } from './ApiDocs';

const satelliteTiles = () => TILED_BODIES.filter((b) => b.satellite || b.gas);

const ATTRIBUTION_DEBOUNCE_MS = 700;

const splitLabel = (text, fallback) => {

  const i = text.indexOf(' : ');

  return i > 0 && i < 40 ? [text.slice(0, i), text.slice(i + 3)] : [fallback, text];

};

const REPO_ORGS = orgsFromRepos();

const CREDITS = visibleCredits();

const FIT_TABLE = { width: '100%', tableLayout: 'fixed', '& td': { overflowWrap: 'anywhere', wordBreak: 'break-word' } };

const Tag = ({ children }) => (

  <Box component="span" sx={{ display: 'inline-block', maxWidth: '100%', overflowWrap: 'anywhere', font: 'inherit', fontSize: '0.85em', px: 0.75, py: 0.25, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover' }}>

    {children}

  </Box>

);

const SectionTitle = ({ children }) => (

  <Typography component="h3" variant="overline" color="text.secondary" sx={{ display: 'block', lineHeight: 2, mt: 2.5, mb: 0.5 }}>

    {children}

  </Typography>

);

const RepoLink = ({ item }) => (!item.repo ? item.name : (

  <Link href={`https://github.com/${item.repo}`} target="_blank" rel="noopener noreferrer" underline="hover" title={`github.com/${item.repo}`}>

    {item.name}

  </Link>

));

const NameRow = ({ item }) => {

  const date = formatRepoDate(item.updated);

  const url = item.repo && `https://github.com/${item.repo}`;

  return (

    <TableRow>

      <TableCell sx={{ pl: 0, verticalAlign: 'top', width: '50%' }}>

        <RepoLink item={item} />

        <Box component="span" sx={{ display: 'block', fontSize: '0.78em', color: 'text.secondary', wordBreak: 'break-all' }}>

          {url ? <Link href={url} target="_blank" rel="noopener noreferrer" underline="hover" color="inherit">{`github.com/${item.repo}`}</Link> : item.source}

        </Box>

        {date && (

          <Box component="span" sx={{ display: 'block', fontSize: '0.78em', color: 'text.secondary', mt: 0.25 }}>

            Mis à jour le {date}

          </Box>

        )}

        {item.local && (

          <Box component="span" sx={{ display: 'block', fontSize: '0.78em', color: 'text.secondary' }}>Importé dans le projet : {item.local}</Box>

        )}

      </TableCell>

      <TableCell sx={{ pr: 0, verticalAlign: 'top' }}>{item.people.join(', ') || item.org}</TableCell>

    </TableRow>

  );

};

function Credits() {

  return (

    <Box>

      {CREDITS.map(({ group, items }) => {

        const withPeople = items.filter((item) => item.people.length || item.org);

        if (!withPeople.length) return null;

        return (

          <Box key={group} component="section" aria-label={group}>

            <SectionTitle>{group}</SectionTitle>

            <Table size="small">

              <TableBody>

                {withPeople.map((item) => (

                  <NameRow key={item.name} item={item} />

                ))}

              </TableBody>

            </Table>

          </Box>

        );

      })}

    </Box>

  );

}

function SourcesAndCompanies({ rows }) {

  return (

    <Box sx={{ maxWidth: '100%', overflowX: 'hidden' }}>

      <SectionTitle>Sources des données</SectionTitle>

      <Table size="small" sx={FIT_TABLE}>

        <TableBody>

          {rows.map(([label, text]) => (

            <TableRow key={`${label}|${text}`}>

              <TableCell sx={{ pl: 0, verticalAlign: 'top', width: '40%' }}><Tag>{label}</Tag></TableCell>

              <TableCell sx={{ pr: 0 }}>{text}</TableCell>

            </TableRow>

          ))}

        </TableBody>

      </Table>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>

        Seules les sources des cartes actuellement chargées sont listées.

      </Typography>

      <SectionTitle>Données et services</SectionTitle>

      <Table size="small" sx={FIT_TABLE}>

        <TableBody>

          {[...SERVICE_ORGS].sort((a, b) => a.org.localeCompare(b.org, 'fr')).map(({ org, what }) => (

            <TableRow key={org}>

              <TableCell sx={{ pl: 0, verticalAlign: 'top', width: '40%' }}><Tag>{org}</Tag></TableCell>

              <TableCell sx={{ pr: 0 }}>{what.join(' · ')}</TableCell>

            </TableRow>

          ))}

        </TableBody>

      </Table>

      <SectionTitle>Entreprises derrière les logiciels libres</SectionTitle>

      <Table size="small" sx={FIT_TABLE}>

        <TableBody>

          {REPO_ORGS.map(({ org, items }) => (

            <TableRow key={org}>

              <TableCell sx={{ pl: 0, verticalAlign: 'top', width: '40%' }}><Tag>{org}</Tag></TableCell>

              <TableCell sx={{ pr: 0 }}>

                {items.map((item, i) => (

                  <Box component="span" key={item.repo + item.name}>

                    {i > 0 && ' · '}

                    <RepoLink item={item} />

                  </Box>

                ))}

              </TableCell>

            </TableRow>

          ))}

        </TableBody>

      </Table>

    </Box>

  );

}

const API_STATE_NOTE = {

  local: 'Déconnectée sur cet appareil',

  server: 'Déconnectée sur le serveur',

  permanent: 'Déconnectée sur le serveur (réglage permanent)',

};

/**
 * Onglet « API » : inventaire en lecture seule des services externes.
 * Aucun contrôle ne permet de bloquer ou déconnecter une API.
 */
function ApiList() {
  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Inventaire des services externes référencés dans le code de Gobai.
        Les appels dépendent des fonctionnalités utilisées, des données
        demandées et de la configuration du serveur.
      </Typography>

      {API_GROUPS.map(({ group, items }) => (
        <Box key={group} component="section" aria-label={group}>
          <SectionTitle>{group}</SectionTitle>

          <Table size="small" sx={FIT_TABLE}>
            <TableBody>
              {items.map((api) => (
                <TableRow key={api.name}>
                  <TableCell sx={{ pl: 0, pr: 1, verticalAlign: 'top', width: '42%' }}>
                    <Typography variant="body2" fontWeight={600}>
                      {api.name}
                    </Typography>
                    <Box
                      component="span"
                      translate="no"
                      sx={{
                        display: 'block',
                        mt: 0.25,
                        fontSize: '0.78em',
                        color: 'text.secondary',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {api.host}
                    </Box>
                  </TableCell>

                  <TableCell sx={{ pl: 1, pr: 0, verticalAlign: 'top' }}>
                    <Typography variant="body2">{api.use}</Typography>
                    {api.key && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ mt: 0.5 }}
                      >
                        Nécessite une clé API ou un compte configuré sur le serveur.
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ))}

      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        {countApis()} services externes recensés dans l'inventaire de Gobai.
      </Typography>
    </Box>
  );
}

function TreeNode({ item, root = false }) {

  return (

    <Box component="li" sx={{ listStyle: 'none', py: 0.35 }}>

      {item.path ? (

        <Link href={item.path} underline="hover" sx={{ fontWeight: root || item.children.length ? 600 : 400 }}>{item.name}</Link>

      ) : (

        <Box component="span" sx={{ fontWeight: 600 }}>{item.name}</Box>

      )}

      {item.path && (

        <Box component="span" sx={{ ml: 1, fontSize: '0.8em', color: 'text.secondary', wordBreak: 'break-all' }}>{item.path}</Box>

      )}

      {item.children.length > 0 && (

        <Box component="ul" sx={{ m: 0, mt: 0.35, ml: 0.75, pl: 1.75, borderLeft: 1, borderColor: 'divider' }}>

          {item.children.map((child) => <TreeNode key={child.name} item={child} />)}

        </Box>

      )}

    </Box>

  );

}

function SiteTree() {

  return (

    <Box>

      <SectionTitle>Arborescence du site</SectionTitle>

      <Box component="ul" sx={{ m: 0, p: 0 }}>

        <TreeNode item={SITE_TREE} root />

      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>

        {countPages()} pages. Chaque lien ouvre le site directement sur l’astre ou la fenêtre.

      </Typography>

    </Box>

  );

}

export function Attribution({ hud, moonReal = false, extra = '', open = false, onClose }) {

  const { compact } = useViewport();

  const tiles = useHud(hud, (s) => s.tiles);

  const layerId = tiles?.layerId ?? null;

  const b = tiles?.bounds ?? null;

  const [copyright, setCopyright] = useState('');

  const [tab, setTab] = useState('credits');

  const key = b ? `${layerId}|${b.zoom}|${b.north}|${b.south}|${b.east}|${b.west}` : null;

  useEffect(() => {

    if (!layerId || !b) { setCopyright(''); return undefined; }

    const ctrl = new AbortController();

    const t = setTimeout(() => {

      tilesApi.attribution(layerId, b, ctrl.signal).then((r) => setCopyright(r.copyright || '')).catch(() => {});

    }, ATTRIBUTION_DEBOUNCE_MS);

    return () => { clearTimeout(t); ctrl.abort(); };

  }, [key]);

  const moon = useHud(hud, (s) => s.moonTiles);

  const mars = useHud(hud, (s) => s.marsTiles);

  const mercury = useHud(hud, (s) => s.mercuryTiles);

  const venus = useHud(hud, (s) => s.venusTiles);

  const satellites = useHud(hud, (s) => satelliteTiles()

    .map((t) => (s[t.hudKey]?.layerId ? s[t.hudKey].attributionText : ''))

    .filter(Boolean)

    .join('\n'));

  const tileText = tiles?.layerId ? tiles.attributionText : '';

  const moonText = moon?.layerId ? (moonReal ? `${moon.attributionText} · couleurs NASA SVS` : moon.attributionText) : '';

  const rows = [

    tileText && ['Terre', tileText],

    copyright && copyright !== tileText && ['Terre (zone visible)', copyright],

    moonText && ['Lune', moonText],

    mars?.layerId && ['Mars', mars.attributionText],

    mercury?.layerId && ['Mercure', mercury.attributionText],

    venus?.layerId && ['Vénus', venus.attributionText],

    ...(satellites ? satellites.split('\n').map((t) => splitLabel(t, 'Satellites')) : []),

    ...(extra ? extra.split(' · ').map((t) => splitLabel(t, 'Données')) : []),

    ['Éphémérides', 'Orbites de Kepler (calcul local) · USNO'],

    ['Galerie', 'NASA Image and Video Library (images-api.nasa.gov)'],

    ['Phobos et Deimos (modèles 3D)', 'NASA/JPL-Caltech — science.nasa.gov'],

    ['Lunes sphériques', 'JPL SSD, NASA NSSDC · images : NASA Image and Video Library'],

  ].filter(Boolean);

  return (

    <Dialog open={open} onClose={onClose} fullScreen={compact} maxWidth="sm" fullWidth aria-label="Anthropic Node Open Source">

      <PanelHeader title="Anthropic Node Open Source" onClose={onClose} />

      <Tabs

        value={tab}

        onChange={(e, v) => setTab(v)}

        variant="scrollable"

        scrollButtons="auto"

        aria-label="Sections de la fenêtre Anthropic Node Open Source"

        sx={{ flex: 'none', minHeight: 40, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { minHeight: 40 } }}

      >

        <Tab value="credits" label="Générique" id="node-tab-credits" aria-controls="node-panel-credits" />

        <Tab value="sources" label="Sources et Entreprises" id="node-tab-sources" aria-controls="node-panel-sources" />

        <Tab value="apis" label="API" id="node-tab-apis" aria-controls="node-panel-apis" />

        <Tab value="tree" label="Arborescence" id="node-tab-tree" aria-controls="node-panel-tree" />

        <Tab value="docs" label="Documentation API" id="node-tab-docs" aria-controls="node-panel-docs" />

        <Tab value="flux" label="Flux cognitif" id="node-tab-flux" aria-controls="node-panel-flux" />

      </Tabs>

      <DialogContent sx={{ pt: 1 }}>

        <Box role="tabpanel" id={`node-panel-${tab}`} aria-labelledby={`node-tab-${tab}`}>

          {tab === 'docs' ? <ApiDocs /> : tab === 'flux' ? <FluxCognitif /> : tab === 'credits' ? <Credits /> : tab === 'tree' ? <SiteTree /> : tab === 'apis' ? <ApiList /> : <SourcesAndCompanies rows={rows} />}

        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5 }}>

          Touche S pour ouvrir ou fermer cette fenêtre.

        </Typography>

      </DialogContent>

    </Dialog>

  );

}

