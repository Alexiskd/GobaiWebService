import { Fragment } from 'react';
import { useHud } from '@/engine/hudStore';
import { BODY_PLACES, bodyId } from '@/engine/bodyPlaces';
import { FEATURE_TYPES, MOON_FEATURES } from '@/engine/moonFeatures';
import { fmtLat, fmtLon, nf } from '@/lib/format';

// Composantes adaptatives : deux blocs seulement changent d’un astre à l’autre.
// 1. BodyPlacesInfo — recherche de lieux et fiche de la planète ciblée (panneau « en direct »).
// 2. BodyLayersMenu — fonds et réglages de l’astre visualisé (panneau « Informations »).
// Les coquilles de panneaux et tout le reste vivent dans GlobalComponents.jsx.

const EARTH_RADIUS_KM = 6371;

const MOON_PLACES = MOON_FEATURES.map((f) => ({ ...f, kind: FEATURE_TYPES[f.type]?.label || f.type }));

// Navigation par astre : chaque entrée désigne le geste fourni par SolarScene.
const NAVIGATION = { moon: 'onGoMoon', earth: 'onGoPlace', mars: 'onGoMars', mercury: 'onGoMercury', venus: 'onGoVenus' };

// ---------------------------------------------------------------- Lieux et infos

const moonFacts = (m) => [
  { term: 'Phase', value: `${m.phase} · ${m.lit} % éclairée`, note: `${nf(m.ageDays, 1)} j depuis la nouvelle lune` },
  { term: 'Distance', value: `${nf(m.distKm)} km`, note: `lumière : ${nf(m.lightSeconds, 3)} s · position ${m.source}` },
  { term: 'Libration', value: `${fmtLon(m.libration.lon)} · ${fmtLat(m.libration.lat)}`, note: 'point de la Lune vu au centre depuis la Terre' },
  { term: 'Soleil au zénith', value: `${fmtLon(m.subSolar.lon)} · ${fmtLat(m.subSolar.lat)}`, note: 'point subsolaire ; le terminateur est à 90° de là' },
];

const planetFacts = (body, def) => {
  const absRot = Math.abs(def.rotation);
  const rotation = absRot >= 2 ? `${nf(absRot, 2)} j` : `${nf(absRot * 24, 1)} h`;
  const periodYears = Math.pow(def.elements[0], 1.5);
  return [
    { term: 'Diamètre', value: `${nf(2 * def.radius * EARTH_RADIUS_KM)} km`, note: `${nf(def.radius, 3)} rayon terrestre` },
    { term: 'Rotation', value: `${rotation}${def.rotation < 0 ? ' (rétrograde)' : ''}`, note: 'un tour sur elle-même' },
    { term: 'Distance au Soleil', value: `${nf(body.au, 3)} UA`, note: `lumière : ${nf(body.lightMinutes, 1)} min` },
    { term: 'Période orbitale', value: periodYears < 1 ? `${nf(periodYears * 365.25)} j` : `${nf(periodYears, 2)} ans`, note: 'un tour autour du Soleil' },
  ];
};

// Adaptation uniforme : la Lune et la Terre ont leurs particularités, toutes les autres planètes
// partagent la même règle (repères de BODY_PLACES, lecture seule si la surface n’est pas cartographiée).
function adaptBody({ id, name, body, def, moon, data }) {
  if (moon) {
    return { places: MOON_PLACES, placeholder: 'Rechercher un lieu lunaire…', facts: moonFacts(moon) };
  }
  if (id === 'earth') {
    return {
      places: data.cities.map((c) => ({ ...c, kind: 'Ville' })),
      placeholder: 'Rechercher une ville…',
      facts: def ? planetFacts(body, def) : [],
    };
  }
  return {
    places: BODY_PLACES[id] || [],
    placeholder: `Rechercher un lieu sur ${name}…`,
    facts: def ? planetFacts(body, def) : [],
  };
}

/** Résout l’astre ciblé et son contenu adapté, pour que la coquille globale reste identique partout. */
export function useBodyView({ hud, data, phases, handlers }) {
  const moon = useHud(hud, (s) => s.moonLive);
  const body = useHud(hud, (s) => s.bodyLive);

  if (!moon && !body) return null;

  const id = moon ? 'moon' : body.id;
  const name = moon ? data.bodies.moon.name : body.name;
  const def = moon ? null : data.bodies.planets.find((p) => bodyId(p) === id) || null;
  const { places, placeholder, facts } = adaptBody({ id, name, body, def, moon, data });

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
    <dl className="facts">
      {items.map(({ term, value, note }) => (
        <Fragment key={term}>
          <dt>{term}</dt>
          <dd>
            {value}
            {note && <small>{note}</small>}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

const dateLabel = (utc) =>
  new Date(utc).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Sections lunaires : phases, faces, sondes et ShadowCam. Les planètes n’en affichent aucune. */
function MoonExtras({ moon, phases, handlers }) {
  const { onSide, onSelectOrbiter, onGoMoon } = handlers;

  return (
    <>
      {phases?.items?.length > 0 && (
        <>
          <h3>Prochaines phases</h3>
          <ul className="phases">
            {phases.items.map((p) => (
              <li key={p.utc}>
                <span>{p.phase}</span>
                <time dateTime={p.utc}>{dateLabel(p.utc)}</time>
              </li>
            ))}
          </ul>
          <p className="hint">Source : {phases.source}</p>
        </>
      )}

      <div className="side-buttons">
        <button onClick={() => onSide('near')}>Face visible</button>
        <button onClick={() => onSide('far')}>Face cachée</button>
      </div>

      <h3>Sondes en orbite</h3>
      <ul className="orbiters">
        {moon.orbiters.length === 0 && <li className="hint">Chargement des positions (JPL Horizons)…</li>}
        {moon.orbiters.map((o) => (
          <li key={o.id} className={o.selected ? 'selected' : ''}>
            <button className="orbiter" onClick={() => onSelectOrbiter(o.id)} disabled={!o.ok} title={o.description}>
              <span className={`dot ${o.id}`} aria-hidden="true" />
              <strong>{o.name}</strong> <small>{o.agency}</small>
            </button>
            {o.ok ? (
              <p>
                {nf(o.altitudeKm)} km d’altitude · {nf(o.speedKmS, 3)} km/s
                {o.periodMin ? ` · tour en ${o.periodMin < 600 ? `${nf(o.periodMin, 1)} min` : `${nf(o.periodMin / 1440, 2)} j`}` : ''}
                {o.selected && (
                  <small>
                    Survole {fmtLat(o.lat)} {fmtLon(o.lon)} · {o.earthVisible ? 'en vue de la Terre' : 'derrière la Lune (sans contact direct avec la Terre)'}
                  </small>
                )}
              </p>
            ) : (
              <p className="hint">{o.error || 'Pas de position pour l’instant'}</p>
            )}
          </li>
        ))}
      </ul>
      {moon.orbitersSource && <p className="hint">Positions : {moon.orbitersSource}</p>}

      {moon.shadowcam?.length > 0 && (
        <>
          <h3>Pôles vus par Danuri (ShadowCam)</h3>
          <p className="hint">Fond des cratères jamais éclairés par le Soleil, photographié dans la lumière renvoyée par les reliefs voisins.</p>
          {['south', 'north'].map((pole) => {
            const list = moon.shadowcam.filter((s) => s.pole === pole);
            if (!list.length) return null;
            return (
              <div key={pole} className="psr-group">
                <h4>{pole === 'south' ? 'Pôle Sud' : 'Pôle Nord'}</h4>
                <ul className="psr">
                  {list.map((s) => (
                    <li key={s.id}>
                      <button onClick={() => onGoMoon({ lon: s.lon, lat: s.lat }, 30)} title={`${fmtLat(s.lat)} ${fmtLon(s.lon)} · éclairage indirect en ${s.season}`}>
                        {s.name}
                      </button>
                      <small>{s.error ? 'indisponible' : s.loading ? 'chargement…' : s.res ? `${s.res} m/px` : ''}</small>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

/** Composante adaptative : recherche de lieux, fiche et sections du panneau « en direct ». */
export function BodyPlacesInfo({ view, handlers, Search }) {
  const { id, name, places, placeholder, onPick, facts, moon, phases } = view;

  return (
    <>
      <h3>Rechercher un lieu</h3>
      {places.length > 0 ? (
        <Search key={id} places={places} onPick={onPick} placeholder={placeholder} />
      ) : (
        <p className="hint">Aucun lieu répertorié pour {name}.</p>
      )}

      <Facts items={facts} />

      <p className="hint">
        {onPick
          ? 'Choisissez un lieu pour y placer la caméra.'
          : `Repères en lecture seule : la surface de ${name} n’est pas cartographiée dans cette vue.`}
      </p>

      {moon && <MoonExtras moon={moon} phases={phases} handlers={handlers} />}
    </>
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

function Switch({ id, checked, disabled, onChange, label, hint }) {
  return (
    <div className="row">
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>
        {label}
        {hint && <small>{hint}</small>}
      </label>
    </div>
  );
}

function EarthStatus({ hud, provider, listStatus, listError }) {
  const tiles = useHud(hud, (s) => s.tiles);
  let text, tone = 'ok';
  if (listStatus === 'error') { text = `API de tuiles indisponible (${listError})`; tone = 'bad'; }
  else if (tiles?.status === 'error') { text = tiles.error || 'La carte ne répond pas'; tone = 'bad'; }
  else if (tiles?.layerId) {
    text = `${PROVIDER_LABEL[tiles.provider] || tiles.provider}${tiles.experimental ? ' · expérimental' : ''}`;
    if (tiles.status === 'loading') { text += ` · ${tiles.loading} images`; tone = 'busy'; }
  } else {
    text = listStatus === 'loading' ? 'Chargement des fonds…' : 'Aucun fond chargé';
    tone = 'busy';
  }
  return (
    <p className={`status ${tone}`}>
      <span className="dot" aria-hidden="true" />
      {text}
    </p>
  );
}

function MoonStatus({ hud }) {
  const t = useHud(hud, (s) => s.moonTiles);
  if (!t?.layerId && t?.status !== 'error') return null;
  let text = PROVIDER_LABEL[t.provider] || t.provider || 'Carte de la Lune';
  let tone = 'ok';
  if (t.status === 'error') { text = t.error || 'La carte de la Lune ne répond pas'; tone = 'bad'; }
  else if (t.preload?.warmTotal && t.preload.warmDone < t.preload.warmTotal && t.preload.done >= t.preload.total) {
    text = `Lune prête · mise en cache du niveau suivant ${Math.floor((100 * t.preload.warmDone) / t.preload.warmTotal)} %`;
  }
  else if (t.preload?.total && t.preload.done < t.preload.total) {
    text = `Préchargement de la Lune · ${Math.floor((100 * t.preload.done) / t.preload.total)} % (${t.preload.done}/${t.preload.total})`;
    tone = 'busy';
  }
  else if (t.status === 'loading') { text += ` · ${t.loading} images`; tone = 'busy'; }
  else if (t.zoom) text += ` · niveau ${t.zoom}`;
  const c = t.caches;
  const title = c ? `Caches — GPU : ${c.gpu} tuiles · RAM : ${c.ram} · disque du navigateur : ${c.disk} lues, ${c.net} téléchargées` : undefined;
  return (
    <p className={`status ${tone}`} title={title}>
      <span className="dot" aria-hidden="true" />
      {text}
    </p>
  );
}

function PlanetStatus({ hud, source, label }) {
  const t = useHud(hud, (s) => s[source]);
  if (!t?.layerId && t?.status !== 'error') return null;
  let text = PROVIDER_LABEL[t.provider] || t.provider || `Carte de ${label}`;
  let tone = 'ok';
  if (t.status === 'error') { text = t.error || `La carte de ${label} ne répond pas`; tone = 'bad'; }
  else if (t.preload?.total && t.preload.done < t.preload.total) {
    text = `Préchargement de ${label} · ${Math.floor((100 * t.preload.done) / t.preload.total)} % (${t.preload.done}/${t.preload.total})`;
    tone = 'busy';
  }
  else if (t.status === 'loading') { text += ` · ${t.loading} images`; tone = 'busy'; }
  else if (t.zoom) text += ` · niveau ${t.zoom}`;
  const c = t.caches;
  const title = c ? `Caches — GPU : ${c.gpu} tuiles · RAM : ${c.ram} · disque du navigateur : ${c.disk} lues, ${c.net} téléchargées` : undefined;
  return (
    <p className={`status ${tone}`} title={title}>
      <span className="dot" aria-hidden="true" />
      {text}
    </p>
  );
}

/**
 * Composante adaptative : contenu du panneau « Informations » propre à l’astre visualisé.
 * Une planète non cartographiée reçoit le même message que la vue d’ensemble.
 */
export function BodyLayersMenu({
  hud, bodyId = null, bodyName = null, layers, moonRealAvailable, moonColorOk, provider, listStatus, listError,
  baseId, onBase, roads, onRoads, roadsHint, shade, onShade, borders, onBorders, bordersHint, coasts, onCoasts, countryNames, onCountryNames, cityNames, onCityNames, cityNamesHint, cityNamesDisabled,
  moonFeatures, onMoonFeatures, moonOrbiters, onMoonOrbiters, moonModel, onMoonModel, moonModelHint, shadowcam, onShadowcam, shadowcamHint,
  moonLayers = [], moonBaseId = null, onMoonBase,
  marsLayers = [], marsBaseId = null, onMarsBase,
  mercuryLayers = [], mercuryBaseId = null, onMercuryBase,
  venusLayers = [], venusBaseId = null, onVenusBase,
}) {
  const bases = layers.filter((l) => l.kind !== 'overlay');
  const moonBases = moonLayers.filter((l) => l.kind !== 'overlay');
  const marsBases = marsLayers.filter((l) => l.kind !== 'overlay');
  const mercuryBases = mercuryLayers.filter((l) => l.kind !== 'overlay');
  const venusBases = venusLayers.filter((l) => l.kind !== 'overlay');
  const isEarth = bodyId === 'earth';
  const isMoon = bodyId === 'moon';
  const isMars = bodyId === 'mars';
  const isMercury = bodyId === 'mercury';
  const isVenus = bodyId === 'venus';
  const mapped = isEarth || isMoon || isMars || isMercury || isVenus;

  return (
    <>
      {isEarth && (
        <>
          <fieldset>
            <legend>Terre</legend>
            {bases.map((l) => (
              <label className="radio" key={l.id}>
                <input type="radio" name="base" checked={baseId === l.id} onChange={() => onBase(l.id)} />
                <span>
                  {l.label}
                  <small>{l.description}{l.experimental ? ' (expérimental)' : ''}</small>
                </span>
              </label>
            ))}
            {listStatus === 'loading' && <p className="hint">Chargement des fonds…</p>}
          </fieldset>

          <fieldset>
            <legend>Affichage</legend>
            <Switch id="sw-cities" checked={cityNames} disabled={cityNamesDisabled} onChange={onCityNames} label="Noms des villes" hint={cityNamesHint} />
            <Switch id="sw-country-names" checked={countryNames} onChange={onCountryNames} label="Noms des pays" hint="À plat sur l’écran, dans leur alphabet local, visibles en zoomant" />
            <Switch id="sw-borders" checked={borders} onChange={onBorders} label="Frontières des pays" hint={bordersHint} />
            <Switch id="sw-coasts" checked={coasts} onChange={onCoasts} label="Littoraux" hint="Bord de mer, océans et Caspienne" />
            <Switch id="sw-roads" checked={roads} disabled={Boolean(roadsHint)} onChange={onRoads} label="Routes et noms" hint={roadsHint} />
            <Switch id="sw-shade" checked={shade} onChange={onShade} label="Jour et nuit" hint="Assombrit la face cachée du Soleil" />
          </fieldset>

          <EarthStatus hud={hud} provider={provider} listStatus={listStatus} listError={listError} />
        </>
      )}

      {isMoon && (
        <>
          <fieldset>
            <legend>Lune</legend>
            {listStatus === 'loading' ? (
              <p className="hint">Chargement des fonds…</p>
            ) : moonRealAvailable ? (
              <p className="hint">
                <strong>Lune réelle</strong> — couleurs naturelles (NASA SVS) et détail de plus en plus fin en zoomant (Kaguya, jusqu’à ≈ 20 m).
                {moonColorOk === false ? ' Couleurs indisponibles : gris neutre.' : ''}
              </p>
            ) : (
              <p className="hint">Relief de la Lune indisponible : sphère aux couleurs naturelles seule.</p>
            )}
            {moonRealAvailable && (
              <label className="radio">
                <input type="radio" name="moon-base" checked={moonBaseId === 'real'} onChange={() => onMoonBase('real')} />
                <span>
                  Lune réelle
                  <small>Couleurs naturelles NASA SVS · détail Kaguya en zoomant</small>
                </span>
              </label>
            )}
            {moonBases.map((l) => (
              <label className="radio" key={l.id}>
                <input type="radio" name="moon-base" checked={moonBaseId === l.id} onChange={() => onMoonBase(l.id)} />
                <span>
                  {l.label}
                  <small>{l.description}</small>
                </span>
              </label>
            ))}
            <Switch id="sw-moon-model" checked={moonModel} onChange={onMoonModel} label="Modèle 3D NASA" hint={moonModelHint} />
            <Switch id="sw-shadowcam" checked={shadowcam} onChange={onShadowcam} label="Pôles vus par Danuri" hint={shadowcamHint} />
            <Switch id="sw-moon-features" checked={moonFeatures} onChange={onMoonFeatures} label="Lieux de la Lune" hint="Alunissages (Apollo, Chang’e…), mers, cratères" />
            <Switch id="sw-moon-orbiters" checked={moonOrbiters} onChange={onMoonOrbiters} label="Sondes en orbite" hint="LRO, Chandrayaan-2, Danuri, CAPSTONE · JPL Horizons" />
            <MoonStatus hud={hud} />
          </fieldset>

          <fieldset>
            <legend>Affichage</legend>
            <Switch id="sw-shade" checked={shade} onChange={onShade} label="Jour et nuit" hint="Assombrit la face cachée du Soleil" />
          </fieldset>
        </>
      )}

      {isMars && (
        <>
          <fieldset>
            <legend>Mars</legend>
            {marsBases.map((l) => (
              <label className="radio" key={l.id}>
                <input type="radio" name="mars-base" checked={marsBaseId === l.id} onChange={() => onMarsBase(l.id)} />
                <span>
                  {l.label}
                  <small>{l.description}</small>
                </span>
              </label>
            ))}
            {marsBases.length === 0 && listStatus === 'loading' && <p className="hint">Chargement des fonds…</p>}
            {marsBases.length === 0 && listStatus === 'ready' && <p className="hint">Aucune carte de Mars proposée par le fournisseur.</p>}
            <PlanetStatus hud={hud} source="marsTiles" label="Mars" />
          </fieldset>

          <fieldset>
            <legend>Affichage</legend>
            <Switch id="sw-shade" checked={shade} onChange={onShade} label="Jour et nuit" hint="Assombrit la face cachée du Soleil" />
          </fieldset>
        </>
      )}

      {isMercury && (
        <>
          <fieldset>
            <legend>Mercure</legend>
            {mercuryBases.map((l) => (
              <label className="radio" key={l.id}>
                <input type="radio" name="mercury-base" checked={mercuryBaseId === l.id} onChange={() => onMercuryBase(l.id)} />
                <span>
                  {l.label}
                  <small>{l.description}</small>
                </span>
              </label>
            ))}
            {mercuryBases.length === 0 && listStatus === 'loading' && <p className="hint">Chargement des fonds…</p>}
            {mercuryBases.length === 0 && listStatus === 'ready' && <p className="hint">Aucune carte de Mercure proposée par le fournisseur.</p>}
            <PlanetStatus hud={hud} source="mercuryTiles" label="Mercure" />
          </fieldset>

          <fieldset>
            <legend>Affichage</legend>
            <Switch id="sw-shade" checked={shade} onChange={onShade} label="Jour et nuit" hint="Assombrit la face cachée du Soleil" />
          </fieldset>
        </>
      )}

      {isVenus && (
        <>
          <fieldset>
            <legend>Vénus</legend>
            {venusBases.map((l) => (
              <label className="radio" key={l.id}>
                <input type="radio" name="venus-base" checked={venusBaseId === l.id} onChange={() => onVenusBase(l.id)} />
                <span>
                  {l.label}
                  <small>{l.description}</small>
                </span>
              </label>
            ))}
            {venusBases.length === 0 && listStatus === 'loading' && <p className="hint">Chargement des fonds…</p>}
            {venusBases.length === 0 && listStatus === 'ready' && <p className="hint">Aucune carte de Vénus proposée par le fournisseur.</p>}
            <PlanetStatus hud={hud} source="venusTiles" label="Vénus" />
          </fieldset>

          <fieldset>
            <legend>Affichage</legend>
            <Switch id="sw-shade" checked={shade} onChange={onShade} label="Jour et nuit" hint="Assombrit la face cachée du Soleil" />
          </fieldset>
        </>
      )}

      {bodyId === null && (
        <p className="hint">Vue d’ensemble : ciblez la Terre, la Lune, Mars, Mercure ou Vénus pour voir ses informations.</p>
      )}
      {bodyId !== null && !mapped && (
        <p className="hint">Aucune information cartographique disponible pour {bodyName || 'cet astre'}.</p>
      )}
    </>
  );
}
