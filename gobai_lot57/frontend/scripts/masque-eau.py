# Masque mondial de l'eau de la Terre, pour le reflet du Soleil sur la mer (shader des tuiles, modèle de la Terre).
# Source : les pays de Natural Earth 1:50 m (backend/data/vendor/natural-earth, domaine public) ; tout ce qui n'est
# dans aucun pays est de l'eau. Projection Web Mercator (±85,05°, comme les tuiles de la Terre), 2 048 × 2 048 px
# (≈ 20 km par pixel à l'équateur), côtes adoucies : dessiné à 4 096 px puis réduit. Blanc = mer, noir = terre.
# Les lacs intérieurs, compris dans les pays, comptent comme de la terre (pas de reflet).
# Usage : python3 frontend/scripts/masque-eau.py (depuis la racine du dépôt) ; nécessite Pillow.

# Importe la lecture du JSON, les fonctions mathématiques et les chemins.
import json, math, pathlib
# Importe le dessin d'images de Pillow.
from PIL import Image, ImageDraw

# Racine du dépôt : deux dossiers au-dessus de ce script.
RACINE = pathlib.Path(__file__).resolve().parents[2]
# Fichier des pays de Natural Earth.
SOURCE = RACINE / 'backend/data/vendor/natural-earth/ne_50m_admin_0_countries-v4.1.0.geojson'
# Image produite, servie par le site.
SORTIE = RACINE / 'frontend/public/data/earth-water-mask.png'
# Taille du dessin (avant réduction) et taille finale.
GRAND, TAILLE = 4096, 2048
# Latitude limite de Web Mercator, en degrés.
LAT_MAX = 85.0511287798066

# Point de l'image (x, y) d'une longitude et d'une latitude, en projection de Mercator.
def point(lon, lat):
    # Latitude bornée à celle de Mercator, en radians.
    la = math.radians(max(-LAT_MAX, min(LAT_MAX, lat)))
    # Abscisse : la longitude ramenée de 0 à la taille ; ordonnée : la formule de Mercator, 0 au nord.
    return ((lon + 180) / 360 * GRAND, (1 - math.asinh(math.tan(la)) / math.pi) / 2 * GRAND)

# Image du dessin : tout en mer (blanc).
image = Image.new('L', (GRAND, GRAND), 255)
# Outil de dessin.
dessin = ImageDraw.Draw(image)
# Les pays.
pays = json.loads(SOURCE.read_text(encoding='utf-8'))['features']
# Pour chaque pays (début).
for p in pays:
    # Sa géométrie.
    g = p['geometry']
    # Ses polygones : un seul ou plusieurs.
    polygones = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
    # Chaque contour extérieur peint en terre (noir) ; les trous (enclaves) sont d'autres pays, peints à leur tour.
    for anneaux in polygones: dessin.polygon([point(lon, lat) for lon, lat in anneaux[0]], fill=0)
# Fin des pays.

# Réduction adoucie à la taille finale, puis enregistrement optimisé.
image.resize((TAILLE, TAILLE), Image.LANCZOS).save(SORTIE, optimize=True)
# Message de fin.
print(f'{SORTIE} : {SORTIE.stat().st_size} octets')
