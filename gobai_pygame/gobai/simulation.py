"""Couche physique : façade sur l'engine unifié (`gobai.engine`).

Espace monde : positions héliocentriques (x, y) en UA, plan de l'écliptique.
Espace écran : projection de la caméra, seule responsabilité de l'UI.

Les fonctions historiques délèguent désormais à l'engine unique, qui sert
l'application bureau, le build WebAssembly pygbag et tout backend.
"""

from .data import PLANETS
from .engine import build_engine
from .kepler import AU_KM, orbit_positions

_ENGINE = build_engine()


def engine():
    return _ENGINE


def planet_ecliptic_au(planet, ms):
    x, y, _z = _ENGINE.position_of(planet["id"], ms)
    return x / AU_KM, y / AU_KM


def moon_ecliptic_km(ms):
    return _ENGINE.position_of("moon", ms)


def satellite_ecliptic_km(sat, ms):
    return _ENGINE.position_of(sat["id"], ms)


def compute_state(ms):
    """Positions monde (UA) de tous les astres à l'instant ms : {id: (x, y)}."""
    return {bid: (x / AU_KM, y / AU_KM)
            for bid, (x, y, _z) in _ENGINE.state(ms).items()}


def orbit_polylines(ms, n=180):
    """Tracés des orbites planétaires à l'instant ms : [(id, [(x, y), ...])], en UA."""
    from .kepler import centuries_tt
    T = centuries_tt(ms)
    return [(p["id"], [(x, y) for x, y, _z in orbit_positions(p["elements"], T, n)])
            for p in PLANETS]
