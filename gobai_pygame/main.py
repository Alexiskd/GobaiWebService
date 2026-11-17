"""Gobai Pygame — prototype système solaire en vue du dessus (plan de l'écliptique).

Portage 2D pygame du moteur képlérien de Gobai Space (React/Three.js).
Le rendu est simplifié : pas de 3D ni de shaders, les positions sont celles du
modèle à deux corps d'origine (planètes, Lune, satellites).

Lancement : python3 main.py

Commandes :
  molette / + -            zoom
  clic gauche              sélectionner un astre (la caméra le suit)
  clic droit ou glisser    déplacer la vue (libère le suivi)
  espace                   pause / reprise
  ↑ ↓ (ou o / l)           accélérer / ralentir le temps
  r                        revenir à la date actuelle
  f                        recentrer sur l'astre sélectionné
  échap                    quitter
"""

import asyncio
import math
import random
import sys
from datetime import datetime, timezone

import pygame

from gobai.data import MOON, PLANETS, SUN, SATELLITES
from gobai.gravity import body_mass_kg, dominant_body, format_distance_km
from gobai.kepler import AU_KM, EARTH_RADIUS_KM, centuries_tt, period_days
from gobai.scale import scale_level
from gobai.simulation import (compute_state, moon_ecliptic_km,
                              orbit_polylines, satellite_ecliptic_km)

EARTH_RADIUS_AU = EARTH_RADIUS_KM / AU_KM
DAY_MS = 86_400_000.0
AU_LABEL = 149.6e6

WIDTH, HEIGHT = 1280, 800
FPS = 60
EMSCRIPTEN = sys.platform == "emscripten"
MIN_ZOOM = 3.0
MAX_ZOOM = 400_000.0
ZOOM_STEP = 1.25
PLANET_SAMPLES = 180
MIN_PX = 2.5

COLOR_BG = (8, 10, 20)
COLOR_TEXT = (220, 224, 235)
COLOR_DIM = (130, 138, 160)
COLOR_PANEL = (16, 20, 34)
COLOR_ORBIT = (70, 80, 110)
COLOR_SAT_ORBIT = (90, 100, 130)

NAMES = {"sun": SUN["nom"], "moon": MOON["nom"]}
NAMES.update({p["id"]: p["nom"] for p in PLANETS})
NAMES.update({s["id"]: s["nom"] for s in SATELLITES})


def radius_km_of(body_id):
    if body_id == "sun":
        return SUN["radius"] * EARTH_RADIUS_KM
    for p in PLANETS:
        if p["id"] == body_id:
            return p["radius"] * EARTH_RADIUS_KM
    if body_id == "moon":
        return MOON["radiusKm"]
    for s in SATELLITES:
        if s["id"] == body_id:
            return s["radiusKm"]
    return 1.0


class Camera:
    def __init__(self, width, height):
        self.x = 0.0
        self.y = 0.0
        self.zoom = 60.0
        self.follow = "sun"
        self.w = width
        self.h = height

    def resize(self, width, height):
        self.w = width
        self.h = height

    def to_screen(self, x_au, y_au):
        return (int(self.w / 2 + (x_au - self.x) * self.zoom),
                int(self.h / 2 - (y_au - self.y) * self.zoom))

    def to_world(self, sx, sy):
        return ((sx - self.w / 2) / self.zoom + self.x,
                (self.h / 2 - sy) / self.zoom + self.y)


class Simulation:
    def __init__(self):
        self.ms = datetime.now(timezone.utc).timestamp() * 1000.0
        self.speed_days_per_s = 2.0
        self.paused = True

    def advance(self, dt_s):
        if not self.paused:
            self.ms += dt_s * self.speed_days_per_s * DAY_MS

    def date_str(self):
        dt = datetime.fromtimestamp(self.ms / 1000.0, tz=timezone.utc)
        return dt.strftime("%d %m %Y %H:%M UTC")


class App:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT), pygame.RESIZABLE)
        pygame.display.set_caption("Gobai Pygame — Système solaire")
        self.clock = pygame.time.Clock()
        self.font_small = self._font(14)
        self.font = self._font(16)
        self.font_big = self._font(22)
        self.cam = Camera(WIDTH, HEIGHT)
        self.sim = Simulation()
        self.selected = "sun"
        self.stars = [(random.random() * WIDTH, random.random() * HEIGHT,
                       random.uniform(0.4, 1.6), random.randint(120, 220))
                      for _ in range(420)]
        self.dragging = False
        self.drag_start = None
        self.cam_start = None
        self.bodies_screen = {}

    @staticmethod
    def _font(size):
        for name in ("dejavusans", "freesansbold", "arial"):
            try:
                f = pygame.font.SysFont(name, size)
                if f is not None:
                    return f
            except Exception:
                pass
        return pygame.font.Font(None, size + 4)

    def state(self):
        positions = compute_state(self.sim.ms)
        return positions, None

    def draw(self, positions, orbit_lines):
        self.screen.fill(COLOR_BG)
        cam = self.cam
        for sx, sy, r, b in self.stars:
            dx = (sx - cam.w / 2) - (cam.x * cam.zoom * 0.02)
            dy = (sy - cam.h / 2) + (cam.y * cam.zoom * 0.02)
            dx %= cam.w
            dy %= cam.h
            pygame.draw.circle(self.screen, (b, b, b + 20 if b + 20 < 255 else 255), (int(dx), int(dy)), int(r))

        for pid, pts in orbit_lines:
            if not self._orbit_visible(pid):
                continue
            screen_pts = [cam.to_screen(x, y) for x, y in pts]
            color = COLOR_ORBIT if pid != self.selected else (150, 165, 210)
            pygame.draw.lines(self.screen, color, False, screen_pts, 1)

        sun_pos = positions["sun"]
        sun_screen = cam.to_screen(*sun_pos)
        glow = 26
        for i in range(3, 0, -1):
            r = glow * i
            c = (60 + 40 * (3 - i), 40 + 30 * (3 - i), 10)
            pygame.draw.circle(self.screen, c, sun_screen, r)
        pygame.draw.circle(self.screen, SUN["color"], sun_screen, 9)

        for p in PLANETS:
            self._draw_body(p, positions[p["id"]], p["radius"] * EARTH_RADIUS_AU, p["color"], ring=(p["id"] == "saturn"))

        moon = {"id": "moon", "nom": MOON["nom"], "parent": "earth"}
        self._draw_body(moon, positions["moon"], MOON["radiusKm"] / AU_KM, MOON["color"], satellite=True)

        for s in SATELLITES:
            self._draw_body(s, positions[s["id"]], s["radiusKm"] / AU_KM, s["color"], satellite=True)

        self._draw_hud(positions)

    def _orbit_visible(self, pid):
        cam = self.cam
        if pid == "moon":
            return MOON["aKm"] / AU_KM * cam.zoom > 14
        for s in SATELLITES:
            if s["id"] == pid:
                return s["aKm"] / AU_KM * cam.zoom > 14
        return True

    def _draw_body(self, body, pos_au, radius_au, color, satellite=False, ring=False):
        cam = self.cam
        sx, sy = cam.to_screen(*pos_au)
        r_px = max(MIN_PX, radius_au * cam.zoom)
        margin = r_px + 40
        if not (-margin < sx < cam.w + margin and -margin < sy < cam.h + margin):
            return
        if satellite and r_px < 1.2:
            r_px = 1.2
        if ring and r_px > 5:
            pygame.draw.ellipse(self.screen, (200, 190, 150),
                                pygame.Rect(sx - r_px * 2.2, sy - r_px * 0.6, r_px * 4.4, r_px * 1.2), 1)
        pygame.draw.circle(self.screen, color, (int(sx), int(sy)), int(r_px))
        self.bodies_screen[body["id"]] = (sx, sy, max(r_px, 8))
        show_label = (not satellite and r_px >= MIN_PX) or (satellite and cam.zoom * (radius_au) > 1.0) \
            or body["id"] == self.selected
        if show_label:
            label = self.font_small.render(body["nom"], True,
                                           COLOR_TEXT if body["id"] == self.selected else COLOR_DIM)
            self.screen.blit(label, (sx + r_px + 4, sy - label.get_height() / 2))

    def dominant(self, positions):
        bodies = []
        for bid, (x, y) in positions.items():
            r_km = radius_km_of(bid)
            d = math.hypot(self.cam.x - x, self.cam.y - y)
            bodies.append({"id": bid, "mass_kg": body_mass_kg(bid, r_km),
                           "distance": d, "radius_km": r_km})
        best = dominant_body(bodies)
        if best is None:
            return None, 0.0
        altitude_km = max(0.0, best["distance"] * AU_KM - best["radius_km"])
        return best, altitude_km

    def _draw_hud(self, positions):
        sim, cam, sel = self.sim, self.cam, self.selected
        lines = [
            f"Date : {sim.date_str()}",
            f"Temps : {'en pause' if sim.paused else f'{sim.speed_days_per_s:g} j/s'}",
            f"Échelle : {AU_LABEL / cam.zoom:,.0f} km par écran de large".replace(",", " "),
        ]
        dom, alt = self.dominant(positions)
        if dom:
            level = scale_level(alt, earth=dom["id"] == "earth", star=dom["id"] == "sun")
            lines.append(f"Vue : {level}")
            lines.append(f"Altitude : {format_distance_km(alt)} au-dessus de {NAMES[dom['id']]}")
        y = 12
        for line in lines:
            self.screen.blit(self.font.render(line, True, COLOR_TEXT), (12, y))
            y += 22
        y += 8
        names = NAMES
        by_id = {p["id"]: p for p in PLANETS}
        for s in SATELLITES:
            by_id[s["id"]] = s
        if sel in by_id:
            b = by_id[sel]
            px, py = positions[sel]
            r_sun = math.hypot(px, py)
            info = [f"{b['nom']}"]
            if b.get("parent"):
                ppx, ppy = positions[b["parent"]]
                d = math.hypot(px - ppx, py - ppy) * AU_KM
                info.append(f"Distance à {names.get(b['parent'], b['parent'])} : {d:,.0f} km".replace(",", " "))
            else:
                info.append(f"Distance au Soleil : {r_sun:.3f} UA ({r_sun * AU_KM:,.0f} km)".replace(",", " "))
                info.append(f"Période : {period_days((px ** 2 + py ** 2) ** 0.5):.1f} j")
            rot = b.get("rotation")
            if rot:
                info.append(f"Rotation : {abs(rot):g} j{' (rétrograde)' if rot < 0 else ''}")
            info.append(f"Rayon : {b.get('radius', 0)} R⊕" if not b.get("radiusKm")
                        else f"Rayon : {b['radiusKm']:,.0f} km".replace(",", " "))
        elif sel == "sun":
            info = ["Soleil", "Rayon : 109,2 R⊕"]
        else:
            info = []
        panel_h = 26 + 20 * len(info)
        if info:
            pygame.draw.rect(self.screen, COLOR_PANEL, (10, cam.h - panel_h - 10, 360, panel_h), border_radius=8)
            self.screen.blit(self.font_big.render(info[0], True, COLOR_TEXT), (22, cam.h - panel_h + 2))
            yy = cam.h - panel_h + 34
            for line in info[1:]:
                self.screen.blit(self.font.render(line, True, COLOR_DIM), (22, yy))
                yy += 20
        help_lines = [
            "clic : sélectionner — glisser : déplacer",
            "molette : zoom — espace : pause",
            "↑/↓ : vitesse — r : date actuelle",
            "f : suivre l'astre — échap : quitter",
        ]
        y = 12
        for line in help_lines:
            surf = self.font_small.render(line, True, COLOR_DIM)
            self.screen.blit(surf, (cam.w - surf.get_width() - 12, y))
            y += 18

    def pick(self, mx, my):
        best, best_d = None, 18.0
        for bid, (sx, sy, r) in self.bodies_screen.items():
            d = math.hypot(mx - sx, my - sy)
            if d < max(r, 10) and d < best_d + max(r, 10) * 0.2:
                if best is None or d < best_d:
                    best, best_d = bid, d
        return best

    async def run(self):
        orbit_lines = orbit_polylines(self.sim.ms, PLANET_SAMPLES)
        last_orbit_T = centuries_tt(self.sim.ms)
        running = True
        while running:
            if EMSCRIPTEN:
                await asyncio.sleep(0)
                dt_s = self.clock.tick(0) / 1000.0
            else:
                dt_s = self.clock.tick(FPS) / 1000.0
            dt_s = min(dt_s, 0.25)
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    self._on_key(event)
                elif event.type == pygame.VIDEORESIZE:
                    self.cam.resize(event.w, event.h)
                elif event.type == pygame.MOUSEWHEEL:
                    factor = ZOOM_STEP ** event.y
                    self._zoom_at(pygame.mouse.get_pos(), factor)
                elif event.type == pygame.MOUSEBUTTONDOWN:
                    if event.button == 1:
                        bid = self.pick(*event.pos)
                        if bid:
                            self.selected = bid
                            self.cam.follow = bid
                        else:
                            self.dragging = True
                            self.drag_start = event.pos
                            self.cam_start = (self.cam.x, self.cam.y)
                    elif event.button == 3:
                        self.cam.follow = None
                elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
                    self.dragging = False
                elif event.type == pygame.MOUSEMOTION and self.dragging:
                    dx = event.pos[0] - self.drag_start[0]
                    dy = event.pos[1] - self.drag_start[1]
                    self.cam.x = self.cam_start[0] - dx / self.cam.zoom
                    self.cam.y = self.cam_start[1] + dy / self.cam.zoom
                    self.cam.follow = None

            self.sim.advance(dt_s)
            T = centuries_tt(self.sim.ms)
            if abs(T - last_orbit_T) > 0.002:
                orbit_lines = orbit_polylines(self.sim.ms, PLANET_SAMPLES)
                last_orbit_T = T
            positions, _ = self.state()
            if self.cam.follow:
                self.cam.x, self.cam.y = positions[self.cam.follow]
            self.bodies_screen.clear()
            self.draw(positions, orbit_lines)
            pygame.display.flip()
        pygame.quit()

    def _zoom_at(self, pos, factor):
        wx, wy = self.cam.to_world(*pos)
        self.cam.zoom = max(MIN_ZOOM, min(MAX_ZOOM, self.cam.zoom * factor))
        if self.cam.follow is None:
            nx, ny = self.cam.to_world(*pos)
            self.cam.x += wx - nx
            self.cam.y += wy - ny

    def _on_key(self, event):
        key = event.key
        if key == pygame.K_ESCAPE:
            pygame.event.post(pygame.event.Event(pygame.QUIT))
        elif key == pygame.K_SPACE:
            self.sim.paused = not self.sim.paused
        elif key in (pygame.K_UP, pygame.K_PLUS, pygame.K_KP_PLUS):
            self.sim.speed_days_per_s = min(3650.0, self.sim.speed_days_per_s * 2)
            self.sim.paused = False
        elif key in (pygame.K_DOWN, pygame.K_MINUS, pygame.K_KP_MINUS):
            self.sim.speed_days_per_s = max(0.001, self.sim.speed_days_per_s / 2)
        elif key == pygame.K_r:
            self.sim.ms = datetime.now(timezone.utc).timestamp() * 1000.0
        elif key == pygame.K_f:
            self.cam.follow = self.selected
        elif key in (pygame.K_o, pygame.K_l):
            factor = ZOOM_STEP if key == pygame.K_o else 1 / ZOOM_STEP
            self._zoom_at((int(self.cam.w // 2), int(self.cam.h // 2)), factor)


def main():
    asyncio.run(App().run())


if __name__ == "__main__":
    main()
