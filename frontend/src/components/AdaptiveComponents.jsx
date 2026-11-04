import { useMemo } from 'react';
import { GlobalStyles } from '@mui/material';
import { useHud } from '@/engine/hudStore';
import { BODY_PLACES, bodyId } from '@/engine/bodyPlaces';
import { FEATURE_TYPES, MOON_FEATURES } from '@/engine/moonFeatures';
import { fmtLat, fmtLon, nf } from '@/lib/format';

// Composantes adaptatives : deux blocs seulement changent d’un astre à l’autre.
// 1. BodyPlacesInfo — recherche de lieux et fiche de la planète ciblée (panneau « en direct »).
// 2. BodyLayersMenu — fonds et réglages de l’astre visualisé (panneau « Informations »).
// Les coquilles de panneaux et tout le reste vivent dans GlobalComponents.jsx.
//
// Mise en page : sections empilées dans un ordre fixe, chacune avec un titre court en capitales et un contenu en
// « carte » (lignes de même hauteur séparées par un filet). Libellés à gauche, valeurs et interrupteurs alignés à
// droite. Classes préfixées `ac-` et styles MUI (`GlobalStyles`) : la feuille globale ne peut plus les décaler.

const EARTH_RADIUS_KM = 6371;

const MOON_PLACES = MOON_FEATURES.map((f) => ({ ...f, kind: FEATURE_TYPES[f.type]?.label || f.type }));

// Navigation par astre : chaque entrée désigne le geste fourni par SolarScene.
const NAVIGATION = { moon: 'onGoMoon', earth: 'onGoPlace', mars: 'onGoMars', mercury: 'onGoMercury', venus: 'onGoVenus' };

// Mêmes couleurs que les trajectoires des sondes dans la scène (moonOrbiters.js).
const ORBITER_COLORS = { lro: '#ffb347', 'chandrayaan-2': '#ff7eb6', danuri: '#7ee0ff', capstone: '#b6ff7e' };

// ---------------------------------------------------------------- Styles MUI

const ACCENT = '#4fc3f7';
const LINE = 'rgba(255, 255, 255, 0.07)';
const CARD_BG = 'rgba(255, 255, 255, 0.035)';
const CARD_BORDER = 'rgba(255, 255, 255, 0.08)';
const R = 'html .ac'; // portée : uniquement le contenu de ces deux composantes

const card = {
  margin: 0,
  padding: 0,
  background: CARD_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: '10px',
  overflow: 'hidden',
};
const smallCaps = {
  margin: 0,
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.6,
};
const muted = { fontSize: '11px', opacity: 0.55, lineHeight: 1.35 };
const resetButton = {
  appearance: 'none',
  WebkitAppearance: 'none',
  margin: 0,
  border: 0,
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
};

const adaptiveStyles = {
  '@keyframes acPulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.35 } },

  // ------------------------------------------------ Conteneur
  [R]: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    minWidth: 0,
    fontSize: '13px',
    lineHeight: 1.4,
  },
  [`${R} *, ${R} *::before, ${R} *::after`]: { boxSizing: 'border-box' },

  // ------------------------------------------------ Sections et textes
  [`${R} .ac-section, ${R} .ac-group`]: { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, margin: 0, padding: 0 },
  [`${R} .ac-title, ${R} .ac-group-title`]: smallCaps,
  [`${R} .ac-subtitle`]: { margin: '2px 0 0', fontSize: '12px', fontWeight: 600, opacity: 0.8 },
  [`${R} .ac-hint`]: { margin: 0, fontSize: '12px', opacity: 0.6, lineHeight: 1.45, overflowWrap: 'anywhere' },
  [`${R} .ac-hint strong`]: { fontWeight: 600, opacity: 1 },
  [`${R} .ac-card`]: card,

  // ------------------------------------------------ Fiche : libellé à gauche, valeur alignée à droite
  [`${R} .ac-fact`]: {
    display: 'grid',
    gridTemplateColumns: 'minmax(88px, 32%) minmax(0, 1fr)',
    alignItems: 'baseline',
    gap: '12px',
    padding: '9px 12px',
  },
  [`${R} .ac-fact + .ac-fact`]: { borderTop: `1px solid ${LINE}` },
  [`${R} .ac-fact dt`]: { margin: 0, fontSize: '12px', opacity: 0.6 },
  [`${R} .ac-fact dd`]: { margin: 0, minWidth: 0, textAlign: 'right' },
  [`${R} .ac-value`]: { fontWeight: 600, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' },
  [`${R} .ac-fact small`]: { ...muted, display: 'block', marginTop: '2px' },

  // ------------------------------------------------ Lignes simples (phases) : nom à gauche, date à droite
  [`${R} .ac-rows`]: { ...card, listStyle: 'none' },
  [`${R} .ac-row`]: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '8px 12px',
    margin: 0,
  },
  [`${R} .ac-row + .ac-row`]: { borderTop: `1px solid ${LINE}` },
  [`${R} .ac-row-value`]: { opacity: 0.8, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' },

  // ------------------------------------------------ Boutons
  [`${R} .ac-btn`]: {
    ...resetButton,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    height: '36px',
    padding: '0 12px',
    borderRadius: '8px',
    border: `1px solid ${CARD_BORDER}`,
    background: 'rgba(255, 255, 255, 0.05)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 120ms ease, border-color 120ms ease',
  },
  [`${R} .ac-btn:hover:not(:disabled)`]: { background: 'rgba(255, 255, 255, 0.1)' },
  [`${R} .ac-btn:disabled`]: { opacity: 0.4, cursor: 'not-allowed' },
  [`${R} .ac-btn:focus-visible, ${R} .ac-orbiter-head:focus-visible`]: { outline: `2px solid ${ACCENT}`, outlineOffset: '1px' },
  [`${R} .ac-segmented`]: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' },

  // ------------------------------------------------ Sondes : en-tête aligné + 3 colonnes de mesures
  [`${R} .ac-orbiters`]: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' },
  [`${R} .ac-orbiter`]: { ...card, transition: 'border-color 150ms ease, box-shadow 150ms ease' },
  [`${R} .ac-orbiter.is-selected`]: {
    borderColor: 'color-mix(in srgb, var(--c) 55%, transparent)',
    boxShadow: '0 0 18px -8px var(--c)',
  },
  [`${R} .ac-orbiter-head`]: {
    ...resetButton,
    display: 'grid',
    gridTemplateColumns: '10px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px 12px',
    cursor: 'pointer',
  },
  [`${R} .ac-orbiter-head:hover:not(:disabled)`]: { background: 'rgba(255, 255, 255, 0.04)' },
  [`${R} .ac-orbiter-head:disabled`]: { cursor: 'default', opacity: 0.6 },
  [`${R} .ac-dot`]: { width: '10px', height: '10px', borderRadius: '50%', background: 'var(--c)', boxShadow: '0 0 8px var(--c)' },
  [`${R} .ac-orbiter-name`]: { fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  [`${R} .ac-orbiter-agency`]: { ...muted, whiteSpace: 'nowrap' },
  [`${R} .ac-stats`]: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px',
    margin: 0,
    padding: '0 12px 10px 32px',
  },
  [`${R} .ac-stats > div`]: { minWidth: 0 },
  [`${R} .ac-stats dt`]: { ...smallCaps, fontSize: '10px', opacity: 0.5 },
  [`${R} .ac-stats dd`]: {
    margin: '2px 0 0',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  [`${R} .ac-orbiter .ac-hint`]: { padding: '0 12px 10px 32px' },

  // ------------------------------------------------ ShadowCam : tuiles de même taille, 2 colonnes
  [`${R} .ac-tiles`]: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '6px',
  },
  [`${R} .ac-tile`]: {
    height: 'auto',
    minHeight: '46px',
    width: '100%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: '2px',
    padding: '6px 10px',
    textAlign: 'left',
  },
  [`${R} .ac-tile-name`]: { maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  [`${R} .ac-tile small`]: muted,

  // ------------------------------------------------ Groupes de réglages
  [`${R} .ac-group-body`]: { ...card, display: 'flex', flexDirection: 'column' },
  [`${R} .ac-group-body > * + *`]: { borderTop: `1px solid ${LINE}` },
  [`${R} .ac-group-body > .ac-hint`]: { padding: '9px 12px' },

  // Interrupteur : texte à gauche, bouton aligné à droite sur toutes les lignes.
  [`${R} .ac-switch`]: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '12px',
    padding: '9px 12px',
    margin: 0,
    cursor: 'pointer',
  },
  [`${R} .ac-switch:hover`]: { background: 'rgba(255, 255, 255, 0.025)' },
  [`${R} .ac-switch.is-disabled`]: { cursor: 'default', opacity: 0.55 },
  [`${R} .ac-switch-text, ${R} .ac-option-text`]: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  [`${R} .ac-switch-label, ${R} .ac-option-label`]: { fontWeight: 500 },
  [`${R} .ac-switch small, ${R} .ac-option small`]: { ...muted, marginTop: '2px', overflowWrap: 'anywhere' },
  [`${R} .ac-toggle`]: {
    appearance: 'none',
    WebkitAppearance: 'none',
    position: 'relative',
    flex: 'none',
    width: '36px',
    height: '20px',
    margin: 0,
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.18)',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  },
  [`${R} .ac-toggle::before`]: {
    content: '""',
    position: 'absolute',
    top: '2px',
    left: '2px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
    transition: 'transform 150ms ease',
  },
  [`${R} .ac-toggle:checked`]: { background: ACCENT },
  [`${R} .ac-toggle:checked::before`]: { transform: 'translateX(16px)' },
  [`${R} .ac-toggle:disabled`]: { cursor: 'default' },
  [`${R} .ac-toggle:focus-visible, ${R} .ac-radio:focus-visible`]: { outline: `2px solid ${ACCENT}`, outlineOffset: '2px' },

  // Choix de fond : pastille alignée à gauche, texte à droite.
  [`${R} .ac-option`]: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr)',
    alignItems: 'start',
    gap: '10px',
    padding: '9px 12px',
    margin: 0,
    cursor: 'pointer',
    transition: 'background-color 120ms ease',
  },
  [`${R} .ac-option:hover`]: { background: 'rgba(255, 255, 255, 0.025)' },
  [`${R} .ac-option.is-checked`]: { background: 'rgba(79, 195, 247, 0.08)' },
  [`${R} .ac-radio`]: {
    appearance: 'none',
    WebkitAppearance: 'none',
    display: 'grid',
    placeContent: 'center',
    flex: 'none',
    width: '16px',
    height: '16px',
    margin: '2px 0 0',
    borderRadius: '50%',
    border: '1.5px solid rgba(255, 255, 255, 0.4)',
    cursor: 'pointer',
  },
  [`${R} .ac-radio::before`]: {
    content: '""',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: ACCENT,
    transform: 'scale(0)',
    transition: 'transform 120ms ease',
  },
  [`${R} .ac-radio:checked`]: { borderColor: ACCENT },
  [`${R} .ac-radio:checked::before`]: { transform: 'scale(1)' },

  // ------------------------------------------------ État des cartes
  [`${R} .ac-status`]: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: 0,
    padding: '8px 12px',
    borderRadius: '8px',
    background: CARD_BG,
    fontSize: '12px',
    overflowWrap: 'anywhere',
  },
  [`${R} .ac-status-dot`]: { width: '8px', height: '8px', borderRadius: '50%', flex: 'none' },
  [`${R} .ac-status.is-ok .ac-status-dot`]: { background: '#49df8a' },
  [`${R} .ac-status.is-busy .ac-status-dot`]: { background: '#ffc857', animation: 'acPulse 1.2s ease-in-out infinite' },
  [`${R} .ac-status.is-bad`]: { color: '#ffb3ba' },
  [`${R} .ac-status.is-bad .ac-status-dot`]: { background: '#ff5b69' },

  // ================================================ Tactile : lignes d'au moins 44 px
  '@media (pointer: coarse)': {
    [`${R} .ac-switch, ${R} .ac-option, ${R} .ac-row, ${R} .ac-fact`]: { minHeight: '44px' },
    [`${R} .ac-btn`]: { height: '44px' },
    [`${R} .ac-orbiter-head`]: { minHeight: '48px' },
    [`${R} .ac-toggle`]: { width: '42px', height: '24px' },
    [`${R} .ac-toggle::before`]: { width: '20px', height: '20px' },
    [`${R} .ac-toggle:checked::before`]: { transform: 'translateX(18px)' },
    [`${R} .ac-radio`]: { width: '20px', height: '20px', margin: 0 },
    [`${R} .ac-option`]: { alignItems: 'center' },
  },

  // ================================================ Téléphone étroit : fiche sur une colonne
  '@media (max-width: 480px)': {
    [`${R} .ac-fact`]: { gridTemplateColumns: '1fr', gap: '2px' },
    [`${R} .ac-fact dd`]: { textAlign: 'left' },
    [`${R} .ac-stats, ${R} .ac-orbiter .ac-hint`]: { paddingLeft: '12px' },
  },

  '@media (prefers-reduced-motion: reduce)': {
    [`${R} .ac-status.is-busy .ac-status-dot`]: { animation: 'none' },
  },
};

function AdaptiveStyles() {
  return <GlobalStyles styles={adaptiveStyles} />;
}

// ---------------------------------------------------------------- Briques de mise en page

function Section({ title, children }) {
  return (
    <section className="ac-section">
      {title && <h3 className="ac-title">{title}</h3>}
      {children}
    </section>
  );
}

function Group({ title, children }) {
  return (
    <div className="ac-group" role="group" aria-label={title}>
      <div className="ac-group-title">{title}</div>
      <div className="ac-group-body">{children}</div>
    </div>
  );
}

function Hint({ children }) {
  return <p className="ac-hint">{children}</p>;
}

// ---------------------------------------------------------------- Utilitaires

const finite = (value) => Number.isFinite(value);
const percent = (done, total) => (total > 0 ? Math.floor((100 * done) / total) : 0);

// ---------------------------------------------------------------- Lieux et infos

const moonFacts = (m) => [
  { term: 'Phase', value: `${m.phase} · ${m.lit} % éclairée`, note: finite(m.ageDays) ? `${nf(m.ageDays, 1)} j depuis la nouvelle lune` : null },
  { term: 'Distance', value: `${nf(m.distKm)} km`, note: `lumière : ${nf(m.lightSeconds, 3)} s${m.source ? ` · position ${m.source}` : ''}` },
  m.libration && { term: 'Libration', value: `${fmtLon(m.libration.lon)} · ${fmtLat(m.libration.lat)}`, note: 'point de la Lune vu au centre depuis la Terre' },
  m.subSolar && { term: 'Soleil au zénith', value: `${fmtLon(m.subSolar.lon)} · ${fmtLat(m.subSolar.lat)}`, note: 'point subsolaire ; le terminateur est à 90° de là' },
].filter(Boolean);

const planetFacts = (body, def) => {
  const facts = [];
  if (finite(def.radius)) {
    facts.push({ term: 'Diamètre', value: `${nf(2 * def.radius * EARTH_RADIUS_KM)} km`, note: `${nf(def.radius, 3)} rayon terrestre` });
  }
  if (finite(def.rotation) && def.rotation !== 0) {
    const absRot = Math.abs(def.rotation);
    const rotation = absRot >= 2 ? `${nf(absRot, 2)} j` : `${nf(absRot * 24, 1)} h`;
    facts.push({ term: 'Rotation', value: `${rotation}${def.rotation < 0 ? ' (rétrograde)' : ''}`, note: 'un tour sur elle-même' });
  }
  if (finite(body?.au)) {
    facts.push({ term: 'Distance au Soleil', value: `${nf(body.au, 3)} UA`, note: finite(body.lightMinutes) ? `lumière : ${nf(body.lightMinutes, 1)} min` : null });
  }
  // Troisième loi de Kepler (demi-grand axe en UA) ; ignorée si les éléments orbitaux manquent.
  const semiMajor = def.elements?.[0];
  if (finite(semiMajor) && semiMajor > 0) {
    const periodYears = Math.pow(semiMajor, 1.5);
    facts.push({ term: 'Période orbitale', value: periodYears < 1 ? `${nf(periodYears * 365.25)} j` : `${nf(periodYears, 2)} ans`, note: 'un tour autour du Soleil' });
  }
  return facts;
};

// Adaptation uniforme : la Lune et la Terre ont leurs particularités, toutes les autres planètes
// partagent la même règle (repères de BODY_PLACES, lecture seule si la surface n’est pas cartographiée).
function adaptPlaces({ id, name, isMoon, cities }) {
  if (isMoon) return { places: MOON_PLACES, placeholder: 'Rechercher un lieu lunaire…' };
  if (id === 'earth') return { places: cities.map((c) => ({ ...c, kind: 'Ville' })), placeholder: 'Rechercher une ville…' };
  return { places: BODY_PLACES[id] || [], placeholder: `Rechercher un lieu sur ${name}…` };
}

/** Résout l’astre ciblé et son contenu adapté, pour que la coquille globale reste identique partout. */
export function useBodyView({ hud, data, phases, handlers }) {
  const moon = useHud(hud, (s) => s.moonLive);
  const body = useHud(hud, (s) => s.bodyLive);

  const isMoon = Boolean(moon);
  const id = moon ? 'moon' : body?.id ?? null;
  const name = moon ? data.bodies.moon.name : body?.name ?? '';

  // La liste des lieux ne change qu'avec l'astre : elle n'est plus recréée à chaque mise à jour du HUD.
  const { places, placeholder } = useMemo(
    () => (id ? adaptPlaces({ id, name, isMoon, cities: data.cities }) : { places: [], placeholder: '' }),
    [id, name, isMoon, data.cities],
  );
  const def = useMemo(
    () => (id && !isMoon ? data.bodies.planets.find((p) => bodyId(p) === id) || null : null),
    [id, isMoon, data.bodies.planets],
  );

  if (!id) return null;

  const facts = moon ? moonFacts(moon) : def ? planetFacts(body, def) : [];

  return {
    id,
    name,
    moon,
    phases,
    places,
    placeholder,
    facts,
    onPick: handlers[NAVIGATION[id]] || null,
  };
}

function Facts({ items }) {
  if (!items?.length) return null;
  return (
    <dl className="ac-card ac-facts">
      {items.map(({ term, value, note }) => (
        <div className="ac-fact" key={term}>
          <dt>{term}</dt>
          <dd>
            <span className="ac-value">{value}</span>
            {note && <small>{note}</small>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const dateLabel = (utc) => {
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const orbitLabel = (minutes) => (minutes < 600 ? `${nf(minutes, 1)} min` : `${nf(minutes / 1440, 2)} j`);

function Orbiter({ o, onSelect }) {
  const color = ORBITER_COLORS[o.id] || '#ffffff';
  return (
    <li className={o.selected ? 'ac-orbiter is-selected' : 'ac-orbiter'} style={{ '--c': color }}>
      <button
        type="button"
        className="ac-orbiter-head"
        onClick={() => onSelect?.(o.id)}
        disabled={!o.ok}
        title={o.description}
        aria-pressed={Boolean(o.selected)}
      >
        <span className={`ac-dot dot ${o.id}`} aria-hidden="true" />
        <strong className="ac-orbiter-name">{o.name}</strong>
        <small className="ac-orbiter-agency">{o.agency}</small>
      </button>
      {o.ok ? (
        <>
          <dl className="ac-stats">
            <div><dt>Altitude</dt><dd>{nf(o.altitudeKm)} km</dd></div>
            <div><dt>Vitesse</dt><dd>{nf(o.speedKmS, 3)} km/s</dd></div>
            <div><dt>Période</dt><dd>{o.periodMin ? orbitLabel(o.periodMin) : '—'}</dd></div>
          </dl>
          {o.selected && (
            <Hint>
              Survole {fmtLat(o.lat)} {fmtLon(o.lon)} · {o.earthVisible ? 'en vue de la Terre' : 'derrière la Lune, sans contact direct avec la Terre'}
            </Hint>
          )}
        </>
      ) : (
        <Hint>{o.error || 'Pas de position pour l’instant'}</Hint>
      )}
    </li>
  );
}

/** Sections lunaires : phases, faces, sondes et ShadowCam. Les planètes n’en affichent aucune. */
function MoonExtras({ moon, phases, handlers }) {
  const { onSide, onSelectOrbiter, onGoMoon } = handlers;
  const orbiters = moon.orbiters || []; // absent tant que JPL Horizons n'a pas répondu
  const shadowcam = moon.shadowcam || [];

  return (
    <>
      <Section title="Faces de la Lune">
        <div className="ac-segmented" role="group" aria-label="Face de la Lune">
          <button type="button" className="ac-btn" onClick={() => onSide?.('near')}>Face visible</button>
          <button type="button" className="ac-btn" onClick={() => onSide?.('far')}>Face cachée</button>
        </div>
      </Section>

      {phases?.items?.length > 0 && (
        <Section title="Prochaines phases">
          <ol className="ac-rows">
            {phases.items.map((p) => (
              <li className="ac-row" key={p.utc}>
                <span>{p.phase}</span>
                <time className="ac-row-value" dateTime={p.utc}>{dateLabel(p.utc)}</time>
              </li>
            ))}
          </ol>
          {phases.source && <Hint>Source : {phases.source}</Hint>}
        </Section>
      )}

      <Section title="Sondes en orbite">
        {orbiters.length === 0 ? (
          <Hint>Chargement des positions (JPL Horizons)…</Hint>
        ) : (
          <ul className="ac-orbiters">
            {orbiters.map((o) => <Orbiter key={o.id} o={o} onSelect={onSelectOrbiter} />)}
          </ul>
        )}
        {moon.orbitersSource && <Hint>Positions : {moon.orbitersSource}</Hint>}
      </Section>

      {shadowcam.length > 0 && (
        <Section title="Pôles vus par Danuri (ShadowCam)">
          <Hint>Fond des cratères jamais éclairés par le Soleil, photographié dans la lumière renvoyée par les reliefs voisins.</Hint>
          {['south', 'north'].map((pole) => {
            const list = shadowcam.filter((s) => s.pole === pole);
            if (!list.length) return null;
            return (
              <div key={pole} className="ac-section">
                <h4 className="ac-subtitle">{pole === 'south' ? 'Pôle Sud' : 'Pôle Nord'}</h4>
                <ul className="ac-tiles">
                  {list.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="ac-btn ac-tile"
                        onClick={() => onGoMoon?.({ lon: s.lon, lat: s.lat }, 30)}
                        title={`${fmtLat(s.lat)} ${fmtLon(s.lon)}${s.season ? ` · éclairage indirect en ${s.season}` : ''}`}
                      >
                        <span className="ac-tile-name">{s.name}</span>
                        <small>{s.error ? 'indisponible' : s.loading ? 'chargement…' : s.res ? `${s.res} m/px` : fmtLat(s.lat)}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </Section>
      )}
    </>
  );
}

/** Composante adaptative : recherche de lieux, fiche et sections du panneau « en direct ». */
export function BodyPlacesInfo({ view, handlers, Search }) {
  const { id, name, places, placeholder, onPick, facts, moon, phases } = view;

  return (
    <div className="ac">
      <AdaptiveStyles />

      <Section title="Rechercher un lieu">
        {places.length > 0 ? (
          <Search key={id} places={places} onPick={onPick} placeholder={placeholder} />
        ) : (
          <Hint>Aucun lieu répertorié pour {name}.</Hint>
        )}
        {places.length > 0 && (
          <Hint>
            {onPick
              ? 'Choisissez un lieu pour y placer la caméra.'
              : `Repères en lecture seule : la surface de ${name} n’est pas cartographiée dans cette vue.`}
          </Hint>
        )}
      </Section>

      {facts.length > 0 && (
        <Section title="Caractéristiques">
          <Facts items={facts} />
        </Section>
      )}

      {moon && <MoonExtras moon={moon} phases={phases} handlers={handlers} />}
    </div>
  );
}

// ---------------------------------------------------------------- Menu d’informations

const PROVIDER_LABEL = {
  gibs: 'NASA GIBS',
  'nasa-trek': 'NASA Moon Trek',
  'mars-trek': 'NASA Mars Trek',
  'venus-trek': 'NASA Venus Trek',
  'moon-trek': 'NASA Moon Trek (catalogue)',
  'usgs-astro': 'USGS Astrogeology',
  'lroc-lunaserv': 'LROC Lunarserv',
  'usgs-astro-mars': 'USGS Astrogeology',
  'opm-mars': 'OpenPlanetaryMap',
  'murray-lab': 'Caltech Murray Lab',
  'mercury-lunaserv': 'ASU Lunaserv',
  'usgs-astro-mercury': 'USGS Astrogeology',
  'mercury-trek': 'NASA Mercury Trek',
  'mercury-trek-wmts': 'NASA Mercury Trek',
  'mercury-quickmap': 'Mercury QuickMap',
  'opm-mercury': 'OpenPlanetaryMap',
};

/** Interrupteur : toute la ligne est cliquable, le bouton est toujours aligné à droite. */
function Switch({ checked, disabled, onChange, label, hint }) {
  return (
    <label className={disabled ? 'ac-switch is-disabled' : 'ac-switch'}>
      <span className="ac-switch-text">
        <span className="ac-switch-label">{label}</span>
        {hint && <small>{hint}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="ac-toggle"
        checked={Boolean(checked)}
        aria-checked={Boolean(checked)}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
    </label>
  );
}

function Radio({ name, checked, onChange, label, description }) {
  return (
    <label className={checked ? 'ac-option is-checked' : 'ac-option'}>
      <input type="radio" className="ac-radio" name={name} checked={checked} onChange={onChange} />
      <span className="ac-option-text">
        <span className="ac-option-label">{label}</span>
        {description && <small>{description}</small>}
      </span>
    </label>
  );
}

function StatusLine({ text, tone, title }) {
  return (
    <p className={`ac-status is-${tone}`} title={title} role="status">
      <span className="ac-status-dot" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}

function EarthStatus({ hud, listStatus, listError }) {
  const tiles = useHud(hud, (s) => s.tiles);
  let text;
  let tone = 'ok';
  if (listStatus === 'error') { text = `API de tuiles indisponible (${listError})`; tone = 'bad'; }
  else if (tiles?.status === 'error') { text = tiles.error || 'La carte ne répond pas'; tone = 'bad'; }
  else if (tiles?.layerId) {
    text = `${PROVIDER_LABEL[tiles.provider] || tiles.provider}${tiles.experimental ? ' · expérimental' : ''}`;
    if (tiles.status === 'loading') { text += ` · ${tiles.loading} images`; tone = 'busy'; }
  } else {
    text = listStatus === 'loading' ? 'Chargement des fonds…' : 'Aucun fond chargé';
    tone = 'busy';
  }
  return <StatusLine text={text} tone={tone} />;
}

const cachesTitle = (c) => (c
  ? `Caches — GPU : ${c.gpu} tuiles · RAM : ${c.ram} · disque du navigateur : ${c.disk} lues, ${c.net} téléchargées`
  : undefined);

/** État des tuiles de la Lune, de Mars, de Mercure ou de Vénus. */
function TileStatus({ hud, source, label, warmup = false }) {
  const t = useHud(hud, (s) => s[source]);
  if (!t?.layerId && t?.status !== 'error') return null;
  let text = PROVIDER_LABEL[t.provider] || t.provider || `Carte de ${label}`;
  let tone = 'ok';
  const p = t.preload;
  if (t.status === 'error') { text = t.error || `La carte de ${label} ne répond pas`; tone = 'bad'; }
  else if (warmup && p?.warmTotal && p.warmDone < p.warmTotal && p.done >= p.total) {
    text = `${label} prête · mise en cache du niveau suivant ${percent(p.warmDone, p.warmTotal)} %`;
  }
  else if (p?.total && p.done < p.total) {
    text = `Préchargement de ${label} · ${percent(p.done, p.total)} % (${p.done}/${p.total})`;
    tone = 'busy';
  }
  else if (t.status === 'loading') { text += ` · ${t.loading} images`; tone = 'busy'; }
  else if (t.zoom) text += ` · niveau ${t.zoom}`;
  return <StatusLine text={text} tone={tone} title={cachesTitle(t.caches)} />;
}

function DisplayGroup({ shade, onShade }) {
  return (
    <Group title="Affichage">
      <Switch checked={shade} onChange={onShade} label="Jour et nuit" hint="Assombrit la face cachée du Soleil" />
    </Group>
  );
}

/** Fonds d'une planète cartographiée (Mars, Mercure, Vénus) : même structure, une seule implémentation. */
function PlanetBases({ label, groupName, layers, baseId, onBase, listStatus }) {
  const bases = layers.filter((l) => l.kind !== 'overlay');
  return (
    <Group title={`Fond de carte · ${label}`}>
      {bases.map((l) => (
        <Radio key={l.id} name={groupName} checked={baseId === l.id} onChange={() => onBase?.(l.id)} label={l.label} description={l.description} />
      ))}
      {bases.length === 0 && listStatus === 'loading' && <Hint>Chargement des fonds…</Hint>}
      {bases.length === 0 && listStatus === 'ready' && <Hint>Aucune carte de {label} proposée par le fournisseur.</Hint>}
    </Group>
  );
}

/**
 * Composante adaptative : contenu du panneau « Informations » propre à l’astre visualisé.
 * Ordre fixe pour tous les astres : fond de carte → calques → affichage → état du chargement.
 */
export function BodyLayersMenu({
  hud, bodyId: currentId = null, bodyName = null, layers = [], moonRealAvailable, moonColorOk, listStatus, listError,
  baseId, onBase, roads, onRoads, roadsHint, shade, onShade, borders, onBorders, bordersHint, coasts, onCoasts, countryNames, onCountryNames, cityNames, onCityNames, cityNamesHint, cityNamesDisabled,
  moonFeatures, onMoonFeatures, moonOrbiters, onMoonOrbiters, moonModel, onMoonModel, moonModelHint, shadowcam, onShadowcam, shadowcamHint,
  moonLayers = [], moonBaseId = null, onMoonBase,
  marsLayers = [], marsBaseId = null, onMarsBase,
  mercuryLayers = [], mercuryBaseId = null, onMercuryBase,
  venusLayers = [], venusBaseId = null, onVenusBase,
}) {
  const bases = layers.filter((l) => l.kind !== 'overlay');
  const moonBases = moonLayers.filter((l) => l.kind !== 'overlay');

  // Mars, Mercure et Vénus partagent le même rendu.
  const planets = {
    mars: { label: 'Mars', layers: marsLayers, baseId: marsBaseId, onBase: onMarsBase, source: 'marsTiles' },
    mercury: { label: 'Mercure', layers: mercuryLayers, baseId: mercuryBaseId, onBase: onMercuryBase, source: 'mercuryTiles' },
    venus: { label: 'Vénus', layers: venusLayers, baseId: venusBaseId, onBase: onVenusBase, source: 'venusTiles' },
  };
  const isEarth = currentId === 'earth';
  const isMoon = currentId === 'moon';
  const planet = planets[currentId] || null;
  const mapped = isEarth || isMoon || Boolean(planet);

  return (
    <div className="ac">
      <AdaptiveStyles />

      {isEarth && (
        <>
          <Group title="Fond de carte · Terre">
            {bases.map((l) => (
              <Radio
                key={l.id}
                name="earth-base"
                checked={baseId === l.id}
                onChange={() => onBase?.(l.id)}
                label={l.label}
                description={`${l.description || ''}${l.experimental ? ' (expérimental)' : ''}`}
              />
            ))}
            {bases.length === 0 && <Hint>{listStatus === 'loading' ? 'Chargement des fonds…' : 'Aucun fond proposé par le fournisseur.'}</Hint>}
          </Group>

          <Group title="Calques">
            <Switch checked={cityNames} disabled={cityNamesDisabled} onChange={onCityNames} label="Noms des villes" hint={cityNamesHint} />
            <Switch checked={countryNames} onChange={onCountryNames} label="Noms des pays" hint="À plat sur l’écran, dans leur alphabet local, visibles en zoomant" />
            <Switch checked={borders} onChange={onBorders} label="Frontières des pays" hint={bordersHint} />
            <Switch checked={coasts} onChange={onCoasts} label="Littoraux" hint="Bord de mer, océans et Caspienne" />
            <Switch checked={roads} disabled={Boolean(roadsHint)} onChange={onRoads} label="Routes et noms" hint={roadsHint} />
          </Group>

          <DisplayGroup shade={shade} onShade={onShade} />
          <EarthStatus hud={hud} listStatus={listStatus} listError={listError} />
        </>
      )}

      {isMoon && (
        <>
          <Group title="Fond de carte · Lune">
            {listStatus === 'loading' ? (
              <Hint>Chargement des fonds…</Hint>
            ) : moonRealAvailable ? (
              <Hint>
                <strong>Lune réelle</strong> : couleurs naturelles (NASA SVS) et détail de plus en plus fin en zoomant (Kaguya, jusqu’à ≈ 20 m).
                {moonColorOk === false ? ' Couleurs indisponibles : gris neutre.' : ''}
              </Hint>
            ) : (
              <Hint>Relief de la Lune indisponible : sphère aux couleurs naturelles seule.</Hint>
            )}
            {moonRealAvailable && (
              <Radio
                name="moon-base"
                checked={moonBaseId === 'real'}
                onChange={() => onMoonBase?.('real')}
                label="Lune réelle"
                description="Couleurs naturelles NASA SVS · détail Kaguya en zoomant"
              />
            )}
            {moonBases.map((l) => (
              <Radio key={l.id} name="moon-base" checked={moonBaseId === l.id} onChange={() => onMoonBase?.(l.id)} label={l.label} description={l.description} />
            ))}
          </Group>

          <Group title="Calques">
            <Switch checked={moonModel} onChange={onMoonModel} label="Modèle 3D NASA" hint={moonModelHint} />
            <Switch checked={shadowcam} onChange={onShadowcam} label="Pôles vus par Danuri" hint={shadowcamHint} />
            <Switch checked={moonFeatures} onChange={onMoonFeatures} label="Lieux de la Lune" hint="Alunissages (Apollo, Chang’e…), mers, cratères" />
            <Switch checked={moonOrbiters} onChange={onMoonOrbiters} label="Sondes en orbite" hint="LRO, Chandrayaan-2, Danuri, CAPSTONE · JPL Horizons" />
          </Group>

          <DisplayGroup shade={shade} onShade={onShade} />
          <TileStatus hud={hud} source="moonTiles" label="Lune" warmup />
        </>
      )}

      {planet && (
        <>
          <PlanetBases groupName={`${currentId}-base`} listStatus={listStatus} {...planet} />
          <DisplayGroup shade={shade} onShade={onShade} />
          <TileStatus hud={hud} source={planet.source} label={planet.label} />
        </>
      )}

      {currentId === null && (
        <Hint>Vue d’ensemble : ciblez la Terre, la Lune, Mars, Mercure ou Vénus pour voir ses informations.</Hint>
      )}
      {currentId !== null && !mapped && (
        <Hint>Aucune information cartographique disponible pour {bodyName || 'cet astre'}.</Hint>
      )}
    </div>
  );
}
