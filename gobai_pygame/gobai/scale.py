"""Portage de `frontend/src/Car/AstreSolideEngine/scaleLevels.jsx`.

Niveau d'échelle de la vue, du pas de la porte au système solaire : un mot
qui dit ce que montre l'écran pendant que le zoom glisse sans coupure d'un
niveau à l'autre. Seuils en km au-dessus de l'astre dominant.
"""

import math

EARTH_LEVELS = [
    (0.4, "Rue"), (3, "Quartier"), (40, "Ville"), (400, "Région"),
    (2500, "Pays"), (9000, "Continent"),
]
OTHER_LEVELS = [(3, "Sol"), (400, "Relief"), (9000, "Région")]
SPACE_LEVELS = [
    (120_000, "Planète"), (3_000_000, "Planète et satellites"),
    (700_000_000, "Système solaire interne"),
]
OUTER_LEVEL = "Système solaire"


def scale_level(altitude_km, earth=False, star=False):
    """
    Niveau montré pour une altitude en km au-dessus de la surface de l'astre dominant.
    `earth` : la Terre (rues et villes) ; `star` : le Soleil (pas de « planète » autour de lui).
    """
    try:
        km = float(altitude_km)
    except (TypeError, ValueError):
        return ""
    if not math.isfinite(km):
        return ""
    if star:
        if km < 3_000_000:
            return "Soleil"
        return "Système solaire interne" if km < 700_000_000 else OUTER_LEVEL
    for seuil, name in (EARTH_LEVELS if earth else OTHER_LEVELS) + SPACE_LEVELS:
        if km < seuil:
            return name
    return OUTER_LEVEL
