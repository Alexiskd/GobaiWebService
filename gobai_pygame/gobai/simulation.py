"""Couche physique pure : positions et orbites dans l'espace monde (écliptique, UA).

Séparation des espaces :
  - espace physique : éléments képlériens, temps en ms depuis l'époque Unix ;
  - espace monde    : positions héliocentriques (x, y) en UA, plan de l'écliptique ;
  - espace écran    : projection de la caméra, seule responsabilité de l'UI.

Ce module ne dépend ni de pygame ni de Django : il est utilisé par l'application
bureau, le build WebAssembly pygbag et peut l'être côté Django sans requête HTTP.
"""

import math

from .data import MOON, PLANETS, SATELLITES
from .kepler import AU_KM, D, centuries_tt, heliocentric_ecliptic, orbit_positions, kepler_position_from_elements

J2000_MS = 946_728_000_000.0
DAY_MS = 86_400_000.0


def planet_ecliptic_au(planet, ms):
    x, y, _z = heliocentric_ecliptic(planet["elements"], centuries_tt(ms))
    return x, y


def moon_ecliptic_km(ms):
    return kepler_moon(centuries_tt(ms))


def kepler_moon(T):
    return kepler_position_from_elements(
        a=MOON["aKm"], e=MOON["e"], inclination=MOON["i"] * D,
        ascending_node=(MOON["om"] + MOON["omDot"] * T) * D,
        argument_periapsis=(MOON["w"] + MOON["wDot"] * T) * D,
        mean_anomaly=(MOON["M0"] + MOON["MDot"] * T) * D,
    )


def satellite_ecliptic_km(sat, ms):
    dt_days = (ms - J2000_MS) / DAY_MS
    M = 2 * math.pi * dt_days / sat["periodDays"]
    return kepler_position_from_elements(a=sat["aKm"], mean_anomaly=M)


def compute_state(ms):
    """Positions monde (UA) de tous les astres à l'instant ms : {id: (x, y)}."""
    positions = {"sun": (0.0, 0.0)}
    for p in PLANETS:
        positions[p["id"]] = planet_ecliptic_au(p, ms)
    ex, ey = positions["earth"]
    mx, my, _z = kepler_moon(centuries_tt(ms))
    positions["moon"] = (ex + mx / AU_KM, ey + my / AU_KM)
    for s in SATELLITES:
        px, py = positions[s["parent"]]
        sx, sy, _z = satellite_ecliptic_km(s, ms)
        positions[s["id"]] = (px + sx / AU_KM, py + sy / AU_KM)
    return positions


def orbit_polylines(ms, n=180):
    """Tracés des orbites planétaires à l'instant ms : [(id, [(x, y), ...])], en UA."""
    T = centuries_tt(ms)
    return [(p["id"], [(x, y) for x, y, _z in orbit_positions(p["elements"], T, n)])
            for p in PLANETS]
