"""Validation du portage de gravityMath.jsx et scaleLevels.jsx.

Lancement : python3 tests/test_scale.py
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from gobai.gravity import (BODY_MASS_KG, body_mass_kg, dominant_body,
                           format_distance_km)
from gobai.scale import OUTER_LEVEL, scale_level


def test_scale_levels_earth():
    attendu = [(0.2, "Rue"), (1.0, "Quartier"), (20.0, "Ville"), (100.0, "Région"),
               (1000.0, "Pays"), (5000.0, "Continent"), (20_000.0, "Planète"),
               (1.0e6, "Planète et satellites"), (1.0e8, "Système solaire interne"),
               (1.0e10, OUTER_LEVEL)]
    for km, niveau in attendu:
        assert scale_level(km, earth=True) == niveau, (km, scale_level(km, earth=True))


def test_scale_levels_other_and_star():
    assert scale_level(1.0) == "Sol"
    assert scale_level(100.0) == "Relief"
    assert scale_level(5000.0) == "Région"
    assert scale_level(100.0, star=True) == "Soleil"
    assert scale_level(1.0e7, star=True) == "Système solaire interne"
    assert scale_level(1.0e9, star=True) == OUTER_LEVEL


def test_scale_level_invalid():
    assert scale_level(float("nan")) == ""
    assert scale_level(None) == ""


def test_dominant_body():
    assert dominant_body([]) is None
    camera_proche_lune = [
        {"id": "sun", "mass_kg": BODY_MASS_KG["sun"], "distance": 1.0},
        {"id": "earth", "mass_kg": BODY_MASS_KG["earth"], "distance": 0.00257},
        {"id": "moon", "mass_kg": BODY_MASS_KG["moon"], "distance": 1e-5},
    ]
    assert dominant_body(camera_proche_lune)["id"] == "moon"
    entre_planetes = [
        {"id": "earth", "mass_kg": BODY_MASS_KG["earth"], "distance": 1.0},
        {"id": "mars", "mass_kg": BODY_MASS_KG["mars"], "distance": 1.5},
        {"id": "sun", "mass_kg": BODY_MASS_KG["sun"], "distance": 1.2},
    ]
    assert dominant_body(entre_planetes)["id"] == "sun"


def test_body_mass_fallback():
    assert body_mass_kg("earth", 6371) == BODY_MASS_KG["earth"]
    r = 1000.0
    attendu = (4.0 / 3.0) * math.pi * (r * 1000) ** 3 * 2000
    assert abs(body_mass_kg("inconnu", r) - attendu) < 1e-6 * attendu


def test_format_distance_km():
    assert format_distance_km(3.456) == "3,46 km"
    assert format_distance_km(42.31) == "42,3 km"
    assert format_distance_km(1234.0) == "1\u202f234 km"
    assert format_distance_km(-5.0) == "0,00 km"


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"OK   {name}")
            except AssertionError as exc:
                failures += 1
                print(f"FAIL {name}: {exc}")
    sys.exit(1 if failures else 0)
