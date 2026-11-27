#!/usr/bin/env python3
"""
Images de partage (Open Graph, 1200×630) d'une page par astre : frontend/public/og/<slug>.jpg.

Illustration simple (sphère éclairée, bandes des géantes, anneaux de Saturne et d'Uranus), le nom de
l'astre et « Système solaire 3D · gobaispace.com ». Lancé à la main (Pillow requis), les images sont
versionnées dans le dépôt : le build Render n'a pas besoin de Python.

    python3 seo/tools/generate-og-images.py
"""
# Bibliothèques : chemins, maths, et Pillow pour dessiner.
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# Dossier de sortie : frontend/public/og, servi tel quel par le site (https://www.gobaispace.com/og/<slug>.jpg).
OUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "og"
# Taille recommandée par Facebook, X et LinkedIn.
W, H = 1200, 630
# Polices : DejaVu (accents français), grasse pour le nom, normale pour le reste.
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# slug → (nom affiché, sous-titre, couleur claire, couleur sombre, style) ; style : plain, bands, ring, sun.
BODIES = {
    "soleil": ("Soleil", "L'étoile du système solaire", (255, 214, 90), (230, 90, 20), "sun"),
    "mercure": ("Mercure", "Planète", (190, 180, 170), (80, 74, 70), "plain"),
    "venus": ("Vénus", "Planète", (240, 215, 160), (150, 110, 60), "plain"),
    "terre": ("Terre", "Planète", (110, 170, 240), (20, 50, 120), "plain"),
    "lune": ("Lune", "Satellite de la Terre", (215, 215, 210), (90, 90, 90), "plain"),
    "mars": ("Mars", "Planète", (230, 120, 70), (110, 40, 20), "plain"),
    "ceres": ("Cérès", "Planète naine", (200, 195, 185), (80, 76, 70), "plain"),
    "phobos": ("Phobos", "Satellite de Mars", (170, 150, 130), (70, 60, 50), "plain"),
    "deimos": ("Deimos", "Satellite de Mars", (185, 170, 150), (80, 70, 60), "plain"),
    "jupiter": ("Jupiter", "Géante gazeuse", (235, 200, 160), (140, 90, 60), "bands"),
    "saturne": ("Saturne", "Géante gazeuse", (240, 220, 170), (150, 120, 70), "ring"),
    "uranus": ("Uranus", "Géante de glace", (170, 230, 235), (60, 140, 160), "ringthin"),
    "neptune": ("Neptune", "Géante de glace", (90, 140, 240), (20, 40, 130), "bands"),
    "pluton": ("Pluton", "Planète naine", (225, 200, 175), (110, 85, 70), "plain"),
    "io": ("Io", "Satellite de Jupiter", (245, 225, 120), (170, 120, 40), "plain"),
    "europe": ("Europe", "Satellite de Jupiter", (235, 225, 210), (150, 120, 100), "plain"),
    "ganymede": ("Ganymède", "Satellite de Jupiter", (190, 180, 165), (85, 75, 65), "plain"),
    "callisto": ("Callisto", "Satellite de Jupiter", (150, 135, 120), (55, 48, 42), "plain"),
    "mimas": ("Mimas", "Satellite de Saturne", (210, 210, 205), (100, 100, 100), "plain"),
    "encelade": ("Encelade", "Satellite de Saturne", (245, 250, 255), (150, 170, 190), "plain"),
    "tethys": ("Téthys", "Satellite de Saturne", (230, 230, 225), (120, 120, 120), "plain"),
    "dione": ("Dioné", "Satellite de Saturne", (215, 215, 212), (105, 105, 105), "plain"),
    "rhea": ("Rhéa", "Satellite de Saturne", (220, 218, 212), (110, 108, 104), "plain"),
    "titan": ("Titan", "Satellite de Saturne", (240, 180, 90), (150, 90, 30), "plain"),
    "japet": ("Japet", "Satellite de Saturne", (215, 205, 190), (60, 45, 35), "plain"),
    "miranda": ("Miranda", "Satellite d'Uranus", (200, 200, 200), (95, 95, 95), "plain"),
    "ariel": ("Ariel", "Satellite d'Uranus", (210, 205, 200), (100, 95, 90), "plain"),
    "umbriel": ("Umbriel", "Satellite d'Uranus", (140, 135, 130), (50, 48, 46), "plain"),
    "titania": ("Titania", "Satellite d'Uranus", (200, 190, 180), (90, 82, 76), "plain"),
    "oberon": ("Obéron", "Satellite d'Uranus", (190, 175, 165), (80, 70, 64), "plain"),
    "triton": ("Triton", "Satellite de Neptune", (230, 215, 210), (120, 100, 100), "plain"),
    "charon": ("Charon", "Satellite de Pluton", (190, 185, 180), (80, 76, 74), "plain"),
}


def lerp(a, b, t):
    """Mélange de deux couleurs RVB, t entre 0 (a) et 1 (b)."""
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def sphere(size, light, dark, style):
    """Sphère éclairée en haut à gauche, sur fond transparent, avec bandes éventuelles."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = img.load()
    r = size / 2
    for y in range(size):
        for x in range(size):
            # Coordonnées sur le disque, de -1 à 1.
            dx, dy = (x - r) / r, (y - r) / r
            d2 = dx * dx + dy * dy
            if d2 > 1:
                continue
            # Normale de la sphère et éclairage (lumière venant d'en haut à gauche).
            dz = math.sqrt(1 - d2)
            shade = max(0.0, -0.55 * dx - 0.45 * dy + 0.7 * dz)
            base = light
            # Bandes horizontales des géantes.
            if style in ("bands", "ring"):
                band = 0.5 + 0.5 * math.sin(dy * 14 + math.sin(dx * 3) * 0.6)
                base = lerp(light, dark, 0.35 * band)
            col = lerp(dark, base, min(1.0, shade ** 0.8))
            # Bord doux (anti-crénelage).
            alpha = int(255 * min(1.0, (1 - d2) * 40))
            px[x, y] = col + (alpha,)
    return img


def render(slug, name, subtitle, light, dark, style):
    """Fabrique et enregistre l'image d'un astre."""
    # Fond : dégradé bleu nuit, couleurs de l'interface.
    bg = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(bg)
    for y in range(H):
        d.line([(0, y), (W, y)], fill=lerp((6, 10, 28), (14, 30, 70), y / H))
    # Étoiles fixes (même tirage pour toutes les images).
    for i in range(140):
        x = (i * 7919) % W
        y = (i * 104729) % H
        v = 120 + (i * 37) % 120
        d.point((x, y), fill=(v, v, v))

    # Astre à droite ; halo pour le Soleil.
    size = 440
    cx, cy = 860, H // 2
    if style == "sun":
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(glow).ellipse([cx - 300, cy - 300, cx + 300, cy + 300], fill=light + (110,))
        bg.paste(glow.filter(ImageFilter.GaussianBlur(60)), (0, 0), glow.filter(ImageFilter.GaussianBlur(60)))
    ball = sphere(size, light, dark, style)

    # Anneaux : moitié arrière, puis la planète, puis moitié avant.
    if style in ("ring", "ringthin"):
        rw = 1.6 if style == "ring" else 1.5
        ring = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        rd = ImageDraw.Draw(ring)
        for k, (inner, alpha) in enumerate([(1.25, 150), (1.45, 120), (1.65, 90)] if style == "ring" else [(1.3, 110)]):
            box = [cx - size / 2 * inner * rw / 1.6, cy - size / 2 * inner * 0.28, cx + size / 2 * inner * rw / 1.6, cy + size / 2 * inner * 0.28]
            rd.ellipse(box, outline=lerp(light, dark, 0.2 + 0.15 * k) + (alpha,), width=16 if style == "ring" else 6)
        # Arrière (moitié haute), sous la planète.
        back = ring.crop((0, 0, W, cy))
        bg.paste(back, (0, 0), back)
        bg.paste(ball, (cx - size // 2, cy - size // 2), ball)
        front = ring.crop((0, cy, W, H))
        bg.paste(front, (0, cy), front)
    else:
        bg.paste(ball, (cx - size // 2, cy - size // 2), ball)

    # Textes à gauche : nom, nature, puis mot-clé et adresse.
    d = ImageDraw.Draw(bg)
    big = ImageFont.truetype(BOLD, 96 if len(name) <= 8 else 80)
    d.text((70, 190), name, font=big, fill=(255, 255, 255))
    d.text((74, 310), subtitle, font=ImageFont.truetype(REGULAR, 38), fill=(170, 200, 255))
    d.text((74, 420), "Système solaire 3D en direct", font=ImageFont.truetype(BOLD, 34), fill=(61, 139, 255))
    d.text((74, 468), "www.gobaispace.com", font=ImageFont.truetype(REGULAR, 30), fill=(200, 210, 230))

    # JPEG progressif, assez léger pour les réseaux sociaux.
    bg.save(OUT / f"{slug}.jpg", "JPEG", quality=82, optimize=True, progressive=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for slug, args in BODIES.items():
        render(slug, *args)
    print(f"{len(BODIES)} images écrites dans {OUT}")
