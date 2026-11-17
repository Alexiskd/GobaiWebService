"""Portage Python de `frontend/src/Car/AstreSolideEngine/planetOrbits.jsx`.

Résolution képlérienne à deux corps : le Soleil est l'origine fixe, chaque
satellite est calculé dans le référentiel de sa planète hôte. Repère écliptique
J2000 : (x, y, z), x vers l'équinoxe de mars, z vers le pôle nord de l'écliptique.
"""

import math

D = math.pi / 180
AU_KM = 149_597_870.7
EARTH_RADIUS_KM = 6371.0
UNIX_EPOCH_JD = 2_440_587.5
J2000_JD = 2_451_545.0
DAY_MS = 86_400_000.0
TT_MINUS_UTC_S = 69.184
GAUSS_K = 0.01720209895


def centuries_tt(ms):
    return (ms / DAY_MS + (UNIX_EPOCH_JD - J2000_JD) + TT_MINUS_UTC_S / 86_400.0) / 36_525.0


def solve_kepler(M, e):
    m = math.atan2(math.sin(M), math.cos(M))
    E = m + 0.85 * e * (1.0 if (m or 1.0) >= 0 else -1.0)
    for _ in range(40):
        d = (E - e * math.sin(E) - m) / (1.0 - e * math.cos(E))
        d = max(-1.0, min(1.0, d))
        E -= d
        if abs(d) < 1e-14:
            break
    return E


def elements_at(el, T):
    a = el[0] + el[1] * T
    return {
        "a": a,
        "e": el[2] + el[3] * T,
        "I": (el[4] + el[5] * T) * D,
        "L": el[6] + el[7] * T,
        "varpi": el[8] + el[9] * T,
        "Om": (el[10] + el[11] * T) * D,
        "n": GAUSS_K / a ** 1.5,
    }


def kepler_position_from_elements(a, e=0.0, inclination=0.0, ascending_node=0.0,
                                  argument_periapsis=0.0, mean_anomaly=0.0):
    if not (math.isfinite(a) and a > 0):
        raise ValueError("Le demi-grand axe doit être positif.")
    if not (math.isfinite(e) and 0 <= e < 1):
        raise ValueError("Le modèle Kepler elliptique exige 0 ≤ e < 1.")
    E = solve_kepler(mean_anomaly, e)
    x = a * (math.cos(E) - e)
    y = a * math.sqrt(1 - e * e) * math.sin(E)
    cw, sw = math.cos(argument_periapsis), math.sin(argument_periapsis)
    cO, sO = math.cos(ascending_node), math.sin(ascending_node)
    cI, sI = math.cos(inclination), math.sin(inclination)
    return (
        (cw * cO - sw * sO * cI) * x + (-sw * cO - cw * sO * cI) * y,
        (cw * sO + sw * cO * cI) * x + (-sw * sO + cw * cO * cI) * y,
        sw * sI * x + cw * sI * y,
    )


def heliocentric_ecliptic(el, T):
    k = elements_at(el, T)
    M = (el[6] - el[8]) * D + k["n"] * T * 36_525.0
    return kepler_position_from_elements(
        a=k["a"], e=k["e"], inclination=k["I"], ascending_node=k["Om"],
        argument_periapsis=k["varpi"] * D - k["Om"], mean_anomaly=M,
    )


def orbit_positions(el, T, n=256):
    k = elements_at(el, T)
    b = k["a"] * math.sqrt(1 - k["e"] * k["e"])
    w = k["varpi"] * D - k["Om"]
    points = []
    for i in range(n):
        E = (i / n) * 2 * math.pi
        points.append(kepler_position_from_elements(
            a=k["a"], e=k["e"], inclination=k["I"], ascending_node=k["Om"],
            argument_periapsis=w, mean_anomaly=E,
        ))
    return points


def period_days(a_au):
    return 2 * math.pi / (GAUSS_K / a_au ** 1.5)
