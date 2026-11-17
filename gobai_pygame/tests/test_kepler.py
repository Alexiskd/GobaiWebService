"""Validation du portage képlérien (portage de planetOrbits.jsx et moonOrbit.test.jsx).

Lancement : python3 -m pytest tests/ ou python3 tests/test_kepler.py
"""

import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from gobai.data import MOON, PLANETS, SATELLITES
from gobai.kepler import (AU_KM, D, centuries_tt, heliocentric_ecliptic,
                          kepler_position_from_elements, orbit_positions,
                          period_days, solve_kepler)

J2000_MS = 946_728_000_000.0


def test_solve_kepler_residual():
    for e in (0.0, 0.05, 0.2056, 0.2488, 0.7):
        for M in (-3.0, -1.0, 0.0, 0.7, 3.0):
            E = solve_kepler(M, e)
            assert abs(E - e * math.sin(E) - M) < 1e-12


def test_earth_position_j2000():
    earth = next(p for p in PLANETS if p["id"] == "earth")
    x, y, z = heliocentric_ecliptic(earth["elements"], centuries_tt(J2000_MS))
    r = math.hypot(x, y)
    assert 0.98 < r < 1.02
    lon = math.degrees(math.atan2(y, x)) % 360
    w = earth["elements"][8]
    M0 = earth["elements"][6] - earth["elements"][8]
    assert abs(((lon - (w + M0)) + 180) % 360 - 180) < 1.0


def test_planet_distances_order():
    T = centuries_tt(J2000_MS)
    radii = [math.hypot(*heliocentric_ecliptic(p["elements"], T)[:2]) for p in PLANETS]
    for i in range(len(radii) - 1):
        if PLANETS[i]["id"] == "neptune" and PLANETS[i + 1]["id"] == "pluto":
            continue
        assert radii[i + 1] > radii[i] * 0.95
    assert radii[0] < 0.5
    assert radii[7] > 30.0


def test_moon_distance_bounds():
    from main import moon_ecliptic_km
    a, e = MOON["aKm"], MOON["e"]
    for ms in (J2000_MS, J2000_MS + 365 * 86_400_000.0, J2000_MS - 4000 * 86_400_000.0):
        x, y, z = moon_ecliptic_km(ms)
        r = math.sqrt(x * x + y * y + z * z)
        assert a * (1 - e) - 2000 < r < a * (1 + e) + 2000


def test_moon_daily_motion():
    from main import moon_ecliptic_km
    ms = J2000_MS
    lon1 = math.degrees(math.atan2(*moon_ecliptic_km(ms)[1::-1]))
    lon2 = math.degrees(math.atan2(*moon_ecliptic_km(ms + 86_400_000.0)[1::-1]))
    step = (lon2 - lon1) % 360
    assert 11.5 < step < 15.5


def test_satellites_circular():
    from main import satellite_ecliptic_km
    for s in SATELLITES:
        x, y, z = satellite_ecliptic_km(s, J2000_MS)
        r = math.sqrt(x * x + y * y + z * z)
        assert abs(r - s["aKm"]) < 1e-6 * s["aKm"]
        p = abs(s["periodDays"])
        x2, y2, _ = satellite_ecliptic_km(s, J2000_MS + p * 86_400_000.0)
        r2 = math.hypot(x2, y2)
        assert abs(r2 - s["aKm"]) < 1e-6 * s["aKm"]


def test_orbit_positions_closed():
    earth = next(p for p in PLANETS if p["id"] == "earth")
    pts = orbit_positions(earth["elements"], 0.0, 64)
    ref = kepler_position_from_elements(
        a=earth["elements"][0], e=earth["elements"][2],
        inclination=earth["elements"][4] * D,
        ascending_node=earth["elements"][10] * D,
        argument_periapsis=(earth["elements"][8] - earth["elements"][10]) * D,
        mean_anomaly=0.0,
    )
    assert math.hypot(pts[0][0] - ref[0], pts[0][1] - ref[1], pts[0][2] - ref[2]) < 1e-9


def test_kepler_third_law():
    assert abs(period_days(1.0) - 365.256898) < 0.01
    assert abs(period_days(5.202887) - 4334.76) < 0.1


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
