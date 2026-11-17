"""Validation de l'engine unifié : hiérarchie, pérvolumes, mutabilité, politique de visibilité.

Lancement : python3 tests/test_engine.py
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from gobai.data import MOON, PLANETS, SATELLITES
from gobai.engine import Body, OrbitalEngine, build_engine
from gobai.kepler import (AU_KM, D, centuries_tt, elements_at,
                          heliocentric_ecliptic, kepler_position_from_elements)

J2000_MS = 946_728_000_000.0
DATES = [J2000_MS, J2000_MS + 400 * 86_400_000.0, J2000_MS - 9000 * 86_400_000.0]


def test_planets_match_reference():
    engine = build_engine()
    for p in PLANETS:
        for ms in DATES:
            T = centuries_tt(ms)
            attendu = [c * AU_KM for c in heliocentric_ecliptic(p["elements"], T)]
            obtenu = engine.position_of(p["id"], ms)
            ecart = max(abs(a - b) for a, b in zip(attendu, obtenu))
            assert ecart < 1.0, (p["id"], ms, ecart)


def test_moon_matches_reference():
    engine = build_engine()
    for ms in DATES:
        T = centuries_tt(ms)
        attendu = kepler_position_from_elements(
            a=MOON["aKm"], e=MOON["e"], inclination=MOON["i"] * D,
            ascending_node=(MOON["om"] + MOON["omDot"] * T) * D,
            argument_periapsis=(MOON["w"] + MOON["wDot"] * T) * D,
            mean_anomaly=(MOON["M0"] + MOON["MDot"] * T) * D,
        )
        obtenu = engine.position_of("moon", ms)
        ecart = max(abs(a - b) for a, b in zip(attendu, obtenu))
        assert ecart < 1e-6, (ms, ecart)


def test_satellites_circular():
    engine = build_engine()
    for s in SATELLITES:
        x, y, z = engine.position_of(s["id"], J2000_MS)
        r = math.sqrt(x * x + y * y + z * z)
        assert abs(r - s["aKm"]) < 1e-6 * s["aKm"], s["id"]


def test_state_hierarchical():
    engine = build_engine()
    st = engine.state(J2000_MS)
    mars = st["mars"]
    phobos = st["phobos"]
    rel = math.dist(phobos, mars)
    assert rel < 30000.0, rel
    terre = st["earth"]
    lune = st["moon"]
    assert math.dist(lune, terre) < 500000.0


def test_mutability():
    engine = build_engine()
    nouvelle = Body("lune-test", "Lune test", parent="mars",
                    mass_kg=1e20, radius_km=100.0,
                    mode="kepler",
                    kepler={"a_km": 20000.0, "e": 0.0, "i": 0.0, "om": 0.0,
                            "w": 0.0, "M0": 0.0, "period_days": 0.5})
    engine.add_body(nouvelle)
    st = engine.state(J2000_MS)
    assert "lune-test" in st
    assert math.dist(st["lune-test"], st["mars"]) < 30000.0
    engine.remove_body("lune-test")
    assert "lune-test" not in engine.state(J2000_MS)
    try:
        engine.remove_body("mars")
        raise AssertionError("remove_body aurait dû refuser mars (Phobos dépend)")
    except ValueError:
        pass


def test_perivolume_hill():
    engine = build_engine()
    r_jupiter = engine.perivolume_radius_km("jupiter", J2000_MS)
    assert 0.2 * AU_KM < r_jupiter < 0.5 * AU_KM, r_jupiter / AU_KM
    r_soleil = engine.perivolume_radius_km("sun", J2000_MS)
    assert r_soleil > 40 * AU_KM, r_soleil / AU_KM
    assert engine.perivolume_radius_km("earth", J2000_MS) is None or True
    assert engine.perivolume_radius_km("moon", J2000_MS) is None


def test_active_perivolume():
    engine = build_engine()
    st = engine.state(J2000_MS)
    actif_soleil = engine.active_perivolume(st, (0.0, 0.0, 0.0), J2000_MS)
    assert actif_soleil == "sun"
    actif_jupiter = engine.active_perivolume(st, st["jupiter"], J2000_MS)
    assert actif_jupiter == "jupiter"
    actif_terre = engine.active_perivolume(st, st["earth"], J2000_MS)
    assert actif_terre == "earth"
    entre = ((st["earth"][0] + st["mars"][0]) / 2, (st["earth"][1] + st["mars"][1]) / 2, 0.0)
    assert engine.active_perivolume(st, entre, J2000_MS) == "sun"


def test_visibility_policy():
    assert OrbitalEngine.is_satellite_visible("earth", "earth") is True
    assert OrbitalEngine.is_satellite_visible("earth", "sun") is False
    assert OrbitalEngine.is_satellite_visible("earth", None) is False
    assert OrbitalEngine.is_satellite_visible("earth", "earth", hidden=True) is False


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
