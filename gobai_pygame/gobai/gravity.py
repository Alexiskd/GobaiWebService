"""Portage de `frontend/src/Car/AstreSolideEngine/gravityMath.jsx`.

Astre dominant : parmi tous les astres, celui dont la gravité est la plus
forte à l'endroit où se trouve la caméra (masse / distance²) — « l'astre le
plus lourd le plus proche ». Près du sol de la Lune c'est la Lune, en orbite
terrestre c'est la Terre, entre deux planètes c'est le Soleil.
"""

import math

BODY_MASS_KG = {
    "sun": 1.9885e30,
    "mercury": 3.3011e23, "venus": 4.8675e24, "earth": 5.9724e24, "mars": 6.4171e23,
    "jupiter": 1.8982e27, "saturn": 5.6834e26, "uranus": 8.681e25, "neptune": 1.02413e26, "pluto": 1.303e22,
    "moon": 7.342e22,
    "io": 8.932e22, "europa": 4.8e22, "ganymede": 1.4819e23, "callisto": 1.0759e23,
    "mimas": 3.75e19, "enceladus": 1.08e20, "tethys": 6.17e20, "dione": 1.095e21,
    "rhea": 2.306e21, "titan": 1.3452e23, "iapetus": 1.806e21,
    "miranda": 6.6e19, "ariel": 1.25e21, "umbriel": 1.28e21, "titania": 3.4e21, "oberon": 3.1e21,
    "triton": 2.139e22, "charon": 1.586e21,
}

EARTH_RADIUS_KM = 6371.0


def body_mass_kg(body_id, radius_km):
    if body_id in BODY_MASS_KG:
        return BODY_MASS_KG[body_id]
    r = max(1.0, radius_km or 1.0) * 1000.0
    return (4.0 / 3.0) * math.pi * r ** 3 * 2000.0


def dominant_body(bodies):
    """`bodies` : [{id, mass_kg, distance}] dans une même unité. Renvoie l'élément gagnant, ou None."""
    best = None
    best_pull = -1.0
    for b in bodies:
        d = max(b["distance"], 1e-9)
        pull = b["mass_kg"] / (d * d)
        if pull > best_pull:
            best_pull = pull
            best = b
    return best


def _fr_number(value, digits):
    s = f"{value:,.{digits}f}"
    return s.replace(",", "\u202f").replace(".", ",")


def format_distance_km(km):
    """Distance toujours en kilomètres : deux décimales sous 10 km, une sous 100 km, puis kilomètres entiers."""
    d = max(0.0, km)
    if d < 10:
        return f"{_fr_number(d, 2)} km"
    if d < 100:
        return f"{_fr_number(d, 1)} km"
    return f"{_fr_number(round(d), 0)} km"
