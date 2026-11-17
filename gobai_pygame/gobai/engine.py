"""Engine orbital unifié et mutable : un seul modèle pour tous les systèmes.

Fusion des deux chemins de calcul historiques (planètes via éléments JPL avec
dérives, satellites via repli circulaire) en un registre unique :

  - `Body` : un astre, quel que soit son rang (étoile, planète, satellite) ;
    chaque astre référence son parent, donc un sous-système planétaire
    (Jupiter et ses lunes) est représenté par le même engine que le système
    solaire, simplement enraciné ailleurs ;
  - `OrbitalEngine` : registre mutable (`add_body`, `remove_body`) qui calcule
    les positions absolues en remontant la hiérarchie, résout les pérvolumes
    (sphère de Hill, portage de la politique `PerivolumeManager`) et décrit
    quels sous-systèmes sont actifs ;
  - un seul solveur : `kepler_position_from_elements` pour tout le monde.

Deux encodages d'éléments coexistent dans `Body` (documentés, même solveur) :
  - mode « jpl »    : table JPL 1800-2050, [a, a', e, e', I, I', L, L', varpi, varpi', Om, Om'] ;
  - mode « kepler » : a_km, e, i, om, w, M0 (degrés), dérives optionnelles, période en jours.
"""

import math

from .data import MOON, PLANETS, SATELLITES, SUN
from .gravity import BODY_MASS_KG, body_mass_kg
from .kepler import (AU_KM, D, EARTH_RADIUS_KM, centuries_tt, elements_at,
                     kepler_position_from_elements)

J2000_MS = 946_728_000_000.0
DAY_MS = 86_400_000.0


class Body:
    """Un astre du registre : identité, parent, physique, et ses éléments orbitaux."""

    def __init__(self, body_id, nom, parent=None, mass_kg=0.0, radius_km=1.0,
                 color=(200, 200, 200), mode=None, jpl=None, kepler=None):
        if mode not in (None, "jpl", "kepler"):
            raise ValueError(f"Mode d'éléments inconnu : {mode}")
        if mode == "jpl" and (jpl is None or len(jpl) != 12):
            raise ValueError("Le mode jpl attend la table à 12 nombres.")
        if mode == "kepler" and not (kepler or {}).get("a_km"):
            raise ValueError("Le mode kepler exige au moins a_km.")
        if parent is None and mode is not None:
            raise ValueError("Seul l'astre racine (mode None) peut être sans parent.")
        if parent is not None and mode is None:
            raise ValueError("Un astre orbitant doit avoir des éléments.")
        self.id = body_id
        self.nom = nom
        self.parent = parent
        self.mass_kg = mass_kg
        self.radius_km = radius_km
        self.color = color
        self.mode = mode
        self.jpl = tuple(jpl) if jpl is not None else None
        self.kepler = dict(kepler) if kepler else None

    def position(self, ms):
        """Position écliptique (x, y, z) en km, relative au parent."""
        if self.mode is None:
            return (0.0, 0.0, 0.0)
        if self.mode == "jpl":
            T = centuries_tt(ms)
            k = elements_at(self.jpl, T)
            M = (self.jpl[6] - self.jpl[8]) * D + k["n"] * T * 36_525.0
            return kepler_position_from_elements(
                a=k["a"] * AU_KM, e=k["e"], inclination=k["I"],
                ascending_node=k["Om"], argument_periapsis=k["varpi"] * D - k["Om"],
                mean_anomaly=M,
            )
        k = self.kepler
        T = centuries_tt(ms)
        dt_days = (ms - J2000_MS) / DAY_MS
        if k.get("MDot"):
            M = (k["M0"] + k["MDot"] * T) * D
        else:
            M = k["M0"] * D + 2 * math.pi * dt_days / k["period_days"]
        om = k["om"] + k.get("omDot", 0.0) * T
        w = k["w"] + k.get("wDot", 0.0) * T
        return kepler_position_from_elements(
            a=k["a_km"], e=k["e"], inclination=k["i"] * D,
            ascending_node=om * D, argument_periapsis=w * D, mean_anomaly=M,
        )

    def current_orbit_km(self, ms):
        """(a_km, e) courants, pour le pérvolume et les tracés."""
        if self.mode == "jpl":
            k = elements_at(self.jpl, centuries_tt(ms))
            return k["a"] * AU_KM, k["e"]
        k = self.kepler
        return k["a_km"], k["e"]


class OrbitalEngine:
    """Registre mutable des astres : positions hiérarchiques, pérvolumes, systèmes actifs."""

    def __init__(self):
        self.bodies = {}

    def add_body(self, body):
        if body.id in self.bodies:
            raise ValueError(f"Astre déjà enregistré : {body.id}")
        if body.parent is not None and body.parent not in self.bodies:
            raise ValueError(f"Parent inconnu pour {body.id} : {body.parent}")
        self.bodies[body.id] = body
        return body

    def remove_body(self, body_id):
        if body_id not in self.bodies:
            raise ValueError(f"Astre inconnu : {body_id}")
        if self.children(body_id):
            raise ValueError(f"Des satellites dépendent de {body_id} ; les retirer d'abord.")
        return self.bodies.pop(body_id)

    def get(self, body_id):
        return self.bodies.get(body_id)

    def children(self, body_id):
        return [b for b in self.bodies.values() if b.parent == body_id]

    def bodies_with_children(self):
        return [b for b in self.bodies.values() if self.children(b.id)]

    def position_of(self, body_id, ms):
        return self.bodies[body_id].position(ms)

    def state(self, ms):
        """Positions absolues écliptiques (km) : {id: (x, y, z)} ; parents évalués avant enfants."""
        out = {}
        for b in self.bodies.values():
            if b.parent is None:
                out[b.id] = b.position(ms)
            else:
                px, py, pz = out[b.parent]
                x, y, z = b.position(ms)
                out[b.id] = (px + x, py + y, pz + z)
        return out

    def perivolume_radius_km(self, body_id, ms):
        """Rayon du pérvolume : sphère de Hill, élargie pour contenir les satellites."""
        kids = self.children(body_id)
        if not kids:
            return None
        body = self.bodies[body_id]
        max_child_a = max(kids, key=lambda b: b.current_orbit_km(ms)[0]).current_orbit_km(ms)[0]
        if body.parent is None:
            return max_child_a * 1.15
        a_km, e = body.current_orbit_km(ms)
        parent_mass = self.bodies[body.parent].mass_kg
        hill = a_km * (1.0 - e) * (body.mass_kg / (3.0 * parent_mass)) ** (1.0 / 3.0)
        return max(hill, max_child_a * 1.05)

    def active_perivolume(self, positions_km, camera_km, ms):
        """Le pérvolume actif est le plus petit contenant la caméra ; la racine contient toujours."""
        root = next(b.id for b in self.bodies.values() if b.parent is None)
        best, best_radius = root, self.perivolume_radius_km(root, ms)
        for b in self.bodies_with_children():
            if b.id == root:
                continue
            radius = self.perivolume_radius_km(b.id, ms)
            if radius is None:
                continue
            cx, cy, cz = positions_km[b.id]
            d = math.dist(camera_km, (cx, cy, cz))
            if d <= radius and radius < best_radius:
                best, best_radius = b.id, radius
        return best

    @staticmethod
    def is_satellite_visible(satellite_parent, active_parent, hidden=False):
        """Portage de satellitePerivolume.js : visible ssi le pérvolume de son hôte est actif."""
        return bool(active_parent and satellite_parent
                    and satellite_parent == active_parent and not hidden)


def build_engine():
    """Construit le système solaire complet dans l'engine unifié."""
    engine = OrbitalEngine()
    engine.add_body(Body("sun", SUN["nom"], parent=None,
                         mass_kg=BODY_MASS_KG["sun"],
                         radius_km=SUN["radius"] * EARTH_RADIUS_KM,
                         color=SUN["color"]))
    for p in PLANETS:
        engine.add_body(Body(p["id"], p["nom"], parent="sun",
                             mass_kg=body_mass_kg(p["id"], p["radius"] * EARTH_RADIUS_KM),
                             radius_km=p["radius"] * EARTH_RADIUS_KM,
                             color=p["color"], mode="jpl", jpl=p["elements"]))
    engine.add_body(Body("moon", MOON["nom"], parent="earth",
                         mass_kg=body_mass_kg("moon", MOON["radiusKm"]),
                         radius_km=MOON["radiusKm"], color=MOON["color"],
                         mode="kepler",
                         kepler={"a_km": MOON["aKm"], "e": MOON["e"], "i": MOON["i"],
                                 "om": MOON["om"], "w": MOON["w"], "M0": MOON["M0"],
                                 "omDot": MOON["omDot"], "wDot": MOON["wDot"],
                                 "MDot": MOON["MDot"], "period_days": 27.321661}))
    for s in SATELLITES:
        engine.add_body(Body(s["id"], s["nom"], parent=s["parent"],
                             mass_kg=body_mass_kg(s["id"], s["radiusKm"]),
                             radius_km=s["radiusKm"], color=s["color"],
                             mode="kepler",
                             kepler={"a_km": s["aKm"], "e": 0.0, "i": 0.0,
                                     "om": 0.0, "w": 0.0, "M0": 0.0,
                                     "period_days": s["periodDays"]}))
    return engine
