#!/usr/bin/env python3
"""Télécharge sur cet ordinateur les images de la carte d'une zone : calques LiDAR HD de l'IGN (PNG), relief (PNG)
et, sur demande, orthophotos (JPEG). Rien à installer : Python 3.8 ou plus suffit.

    python3 telecharger_tuiles.py                                # dalle de Paris (Beaubourg – Hôtel de Ville), tous les PNG
    python3 telecharger_tuiles.py --plan                         # compte les fichiers sans rien télécharger
    python3 telecharger_tuiles.py --sortie ~/Images/tuiles       # dossier de destination (défaut : ./tuiles)
    python3 telecharger_tuiles.py --couches mns relief ortho     # choix des couches
    python3 telecharger_tuiles.py --bbox 2.33 48.85 2.37 48.87   # autre zone : lon_min lat_min lon_max lat_max
    python3 telecharger_tuiles.py --zoom 12 16                   # niveaux de zoom (défaut : ceux de chaque couche)

Couches :
    mns     LiDAR HD, ombrage du modèle de surface (bâtiments et arbres)   PNG, IGN, niveaux 12 à 18
    mnt     LiDAR HD, ombrage du sol nu                                    PNG, IGN, niveaux 12 à 18
    mnh     LiDAR HD, hauteurs au-dessus du sol                            PNG, IGN, niveaux 12 à 18
    relief  altitudes codées en couleurs (Terrarium)                       PNG, AWS, niveaux 10 à 15
    ortho   photo aérienne, celle qui colore le nuage de points            JPEG, IGN, niveaux 14 à 18
  Par défaut : mns, mnt, mnh et relief (les PNG). `--perso nom=adresse` ajoute une couche à l'adresse de son choix,
  avec {z}, {x} et {y} à la place du zoom, de la colonne et de la ligne.

Fichiers écrits : <sortie>/<couche>/<zoom>/<colonne>/<ligne>.png (ou .jpg), plus <sortie>/index.json (zone, couches,
nombre de fichiers). Les tuiles suivent le découpage Web Mercator habituel (celui d'OpenStreetMap) : QGIS les ouvre
comme une couche « XYZ » avec l'adresse file:///…/<couche>/{z}/{x}/{y}.png.

Garde-fous : un fichier déjà présent n'est pas retéléchargé (le script reprend où il s'était arrêté) ; pas plus de
`--max` fichiers par lancement (5 000 par défaut) ; 4 téléchargements à la fois, pour rester léger sur les serveurs
de l'IGN. Données de l'IGN sous Licence Ouverte 2.0 : citer « IGN » en cas de réutilisation.
"""
# Importe argparse, la lecture des options de la commande.
import argparse
# Importe json.
import json
# Importe math.
import math
# Importe os, les chemins et les dossiers.
import os
# Importe sys, pour quitter avec un message.
import sys
# Importe time, pour les pauses.
import time
# Importe les erreurs de téléchargement.
import urllib.error
# Importe les requêtes HTTP.
import urllib.request
# Importe ThreadPoolExecutor, les téléchargements en parallèle.
from concurrent.futures import ThreadPoolExecutor

# Dossier de ce script.
HERE = os.path.dirname(os.path.abspath(__file__))
# Adresse de base du service de tuiles de l'IGN.
IGN = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&STYLE=normal'
# Modèle d'adresse des calques LiDAR HD : le type (MNS, MNT, MNH) reste à remplir.
LIDAR = IGN + '&LAYER=IGNF_LIDAR-HD_{kind}_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW&TILEMATRIXSET=PM_0_18&FORMAT=image/png&TILEMATRIX={{z}}&TILEROW={{y}}&TILECOL={{x}}'

# nom → (adresse, extension, zoom minimal, zoom maximal)
LAYERS = {
    # mns : ombrage du modèle de surface, PNG, niveaux 12 à 18.
    'mns': (LIDAR.format(kind='MNS'), 'png', 12, 18),
    # mnt : ombrage du sol nu, PNG, niveaux 12 à 18.
    'mnt': (LIDAR.format(kind='MNT'), 'png', 12, 18),
    # mnh : hauteurs au-dessus du sol, PNG, niveaux 12 à 18.
    'mnh': (LIDAR.format(kind='MNH'), 'png', 12, 18),
    # relief : altitudes Terrarium, PNG, niveaux 10 à 15.
    'relief': ('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png', 'png', 10, 15),
    # ortho : photo aérienne, JPEG, niveaux 14 à 18.
    'ortho': (IGN + '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}', 'jpg', 14, 18),
# Fin des couches.
}
# Couches téléchargées par défaut : les quatre en PNG.
DEFAULT_LAYERS = ('mns', 'mnt', 'mnh', 'relief')
# Emprise des dalles connues : le script marche aussi seul, sans le dépôt à côté.
KNOWN_TILES = {'paris-0652-6863': (2.345699, 48.856248, 2.359440, 48.865315)}


# lambert93 : convertit des coordonnées Lambert-93 en longitude et latitude (début).
def lambert93(x, y):
    # Sa description.
    """Lambert-93 (m) → (longitude, latitude) en degrés."""
    # Constantes de la projection : exposant, constante, origine, méridien central et excentricité.
    n, c, xs, ys, l0, e = 0.7256077650532670, 11754255.426096, 700000.0, 12655612.049876, math.radians(3), 0.0818191910428158
    # Longitude, en radians.
    lon = l0 + math.atan((x - xs) / (ys - y)) / n
    # Latitude isométrique.
    li = -math.log(math.hypot(x - xs, y - ys) / c) / n
    # Première estimation de la latitude.
    phi = 2 * math.atan(math.exp(li)) - math.pi / 2
    # Douze itérations (début).
    for _ in range(12):
        # Affine la latitude.
        phi = 2 * math.atan(((1 + e * math.sin(phi)) / (1 - e * math.sin(phi))) ** (e / 2) * math.exp(li)) - math.pi / 2
    # Renvoie la longitude et la latitude en degrés.
    return math.degrees(lon), math.degrees(phi)


# tile_bbox : l'emprise d'une dalle LiDAR du dépôt (début).
def tile_bbox(tile_id):
    # Sa description.
    """Emprise (lon_min, lat_min, lon_max, lat_max) d'une dalle LiDAR du dépôt, d'après son manifeste."""
    # Chemin du manifeste de la dalle.
    path = os.path.join(HERE, '..', '..', 'data', 'lidar', tile_id, 'manifest.json')
    # S'il n'existe pas (début).
    if not os.path.exists(path):
        # Dalle connue du script (début).
        if tile_id in KNOWN_TILES:
            # Son emprise.
            return KNOWN_TILES[tile_id]
        # Dalle inconnue : quitte avec un message.
        sys.exit(f'Dalle « {tile_id} » inconnue : donner la zone avec --bbox.')
    # Ouvre le manifeste.
    with open(path, encoding='utf-8') as f:
        # Lit ses bornes.
        b = json.load(f)['bounds']
    # Convertit les quatre coins.
    corners = [lambert93(x, y) for x in (b['minX'], b['maxX']) for y in (b['minY'], b['maxY'])]
    # Renvoie les extrêmes en longitude et en latitude.
    return min(c[0] for c in corners), min(c[1] for c in corners), max(c[0] for c in corners), max(c[1] for c in corners)


# tile_range : les tuiles d'un niveau qui couvrent une emprise (début).
def tile_range(bbox, z):
    # Sa description.
    """Tuiles Web Mercator du niveau `z` qui couvrent l'emprise : (x_min, y_min, x_max, y_max), bornes comprises."""
    # Nombre de tuiles par côté à ce niveau.
    n = 2 ** z
    # col : la colonne d'une longitude (début).
    def col(lon):
        # Bornée entre 0 et n − 1.
        return min(n - 1, max(0, int((lon + 180) / 360 * n)))
    # row : la ligne d'une latitude (début).
    def row(lat):
        # Sinus de la latitude, bornée à ±85,0511°.
        s = math.sin(math.radians(max(-85.0511, min(85.0511, lat))))
        # Ligne par la formule de Mercator, bornée entre 0 et n − 1.
        return min(n - 1, max(0, int((0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n)))
    # Renvoie les colonnes et les lignes extrêmes.
    return col(bbox[0]), row(bbox[3]), col(bbox[2]), row(bbox[1])


# plan : la liste des fichiers à avoir (début).
def plan(bbox, layers, zoom=None):
    # Sa description.
    """Liste des fichiers à avoir : (couche, z, x, y, adresse, chemin relatif)."""
    # Liste vide.
    jobs = []
    # Pour chaque couche (début).
    for name, (template, ext, zmin, zmax) in layers.items():
        # Niveaux : ceux de la couche, restreints par --zoom s'il est donné.
        lo, hi = (max(zmin, zoom[0]), min(zmax, zoom[1])) if zoom else (zmin, zmax)
        # Pour chaque niveau (début).
        for z in range(lo, hi + 1):
            # Tuiles qui couvrent l'emprise.
            x0, y0, x1, y1 = tile_range(bbox, z)
            # Pour chaque colonne (début).
            for x in range(x0, x1 + 1):
                # Pour chaque ligne (début).
                for y in range(y0, y1 + 1):
                    # Adresse de la tuile.
                    url = template.replace('{z}', str(z)).replace('{x}', str(x)).replace('{y}', str(y))
                    # Ajoute le fichier, avec son chemin relatif.
                    jobs.append((name, z, x, y, url, os.path.join(name, str(z), str(x), f'{y}.{ext}')))
    # Renvoie la liste.
    return jobs


# fetch : télécharge un fichier, en trois essais au plus (début).
def fetch(url, dest, tries=3):
    # Sa description.
    """Télécharge un fichier. Renvoie 'present', 'ok', 'absent' (pas d'image à cet endroit) ou 'erreur'."""
    # Fichier déjà présent et non vide (début).
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        # Rien à faire.
        return 'present'
    # Pour chaque essai (début).
    for attempt in range(tries):
        # Essai (début).
        try:
            # Requête, avec le nom du script.
            req = urllib.request.Request(url, headers={'User-Agent': 'gobai-tuiles/1.0 (script personnel)'})
            # Ouvre l'adresse, 30 secondes au plus.
            with urllib.request.urlopen(req, timeout=30) as res:
                # Si la réponse n'est pas une image (début).
                if not res.headers.get('Content-Type', '').startswith('image/'):
                    # Pas d'image à cet endroit.
                    return 'absent'  # le serveur a répondu par un message, pas par une image
                # Lit les octets.
                data = res.read()
            # Crée le dossier s'il manque.
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            # Fichier provisoire.
            tmp = dest + '.part'  # écrit à côté puis renommé : jamais de fichier à moitié écrit
            # L'ouvre en écriture.
            with open(tmp, 'wb') as f:
                # Y écrit les octets.
                f.write(data)
            # Le renomme à sa place.
            os.replace(tmp, dest)
            # Réussi.
            return 'ok'
        # Erreur HTTP (début).
        except urllib.error.HTTPError as e:
            # Codes 400 ou 404 (début).
            if e.code in (400, 404):
                # Pas d'image à cet endroit.
                return 'absent'  # hors de la couverture de la couche
            # Autre code : pause, plus longue à chaque essai.
            time.sleep(1 + attempt)
        # Erreur de réseau ou de fichier (début).
        except (urllib.error.URLError, TimeoutError, OSError):
            # Pause, plus longue à chaque essai.
            time.sleep(1 + attempt)
    # Tous les essais ont échoué.
    return 'erreur'


# main : le programme (début).
def main():
    # Lecteur des options.
    p = argparse.ArgumentParser(description='Télécharge les tuiles (PNG) d’une zone sur cet ordinateur.')
    # --dalle : la dalle LiDAR dont on veut la zone.
    p.add_argument('--dalle', default='paris-0652-6863', help='dalle LiDAR du dépôt dont on veut la zone (défaut : Paris)')
    # --bbox : une zone libre, en degrés.
    p.add_argument('--bbox', type=float, nargs=4, metavar=('LON_MIN', 'LAT_MIN', 'LON_MAX', 'LAT_MAX'), help='zone libre, en degrés')
    # --couches : les couches à télécharger.
    p.add_argument('--couches', nargs='+', choices=sorted(LAYERS), default=list(DEFAULT_LAYERS))
    # --perso : une couche à une autre adresse.
    p.add_argument('--perso', action='append', default=[], metavar='NOM=ADRESSE', help='couche à une autre adresse, avec {z} {x} {y}')
    # --zoom : les niveaux de zoom.
    p.add_argument('--zoom', type=int, nargs=2, metavar=('MIN', 'MAX'), help='niveaux de zoom, bornes comprises')
    # --sortie : le dossier de destination.
    p.add_argument('--sortie', default='tuiles', help='dossier de destination (défaut : ./tuiles)')
    # --parallele : le nombre de téléchargements simultanés.
    p.add_argument('--parallele', type=int, default=4, help='téléchargements simultanés (défaut 4, 8 au plus)')
    # --max : le nombre maximal de fichiers.
    p.add_argument('--max', type=int, default=5000, help='nombre maximal de fichiers par lancement (défaut 5000)')
    # --plan : compte les fichiers et s'arrête.
    p.add_argument('--plan', action='store_true', help='compte les fichiers et s’arrête')
    # Lit les options.
    a = p.parse_args()

    # Zone : celle de --bbox, sinon celle de la dalle.
    bbox = tuple(a.bbox) if a.bbox else tile_bbox(a.dalle)
    # Zone vide ou mal ordonnée (début).
    if not (bbox[0] < bbox[2] and bbox[1] < bbox[3]):
        # Quitte avec un message.
        sys.exit('Zone vide : attendu lon_min lat_min lon_max lat_max, dans cet ordre.')
    # Avec --perso seul, on ne télécharge que la couche perso ; avec --couches en plus, les deux.
    only_custom = bool(a.perso) and a.couches == list(DEFAULT_LAYERS)
    # Couches choisies ; aucune avec --perso seul.
    layers = {} if only_custom else {name: LAYERS[name] for name in a.couches}
    # Pour chaque couche perso (début).
    for item in a.perso:
        # Sépare le nom et l'adresse.
        name, _, template = item.partition('=')
        # Nom vide, ou adresse sans {z}, {x} ou {y} (début).
        if not name or not all(k in template for k in ('{z}', '{x}', '{y}')):
            # Quitte avec un message.
            sys.exit(f'--perso « {item} » : attendu nom=adresse avec {{z}}, {{x}} et {{y}}.')
        # Extension : jpg si l'adresse parle de JPEG, sinon png.
        ext = 'jpg' if '.jp' in template.lower() or 'jpeg' in template.lower() else 'png'
        # Ajoute la couche, niveaux 0 à 22.
        layers[name] = (template, ext, 0, 22)
    # Couche perso sans --zoom (début).
    if a.perso and not a.zoom:
        # Quitte avec un message.
        sys.exit('Avec --perso, préciser --zoom MIN MAX.')

    # Liste des fichiers.
    jobs = plan(bbox, layers, a.zoom)
    # Dossier de destination, en chemin absolu.
    out = os.path.abspath(os.path.expanduser(a.sortie))
    # Nombre de fichiers par couche.
    counts = {}
    # Pour chaque fichier (début).
    for job in jobs:
        # Compte sa couche.
        counts[job[0]] = counts.get(job[0], 0) + 1
    # Affiche la zone.
    print(f'Zone : {bbox[0]:.5f}, {bbox[1]:.5f} → {bbox[2]:.5f}, {bbox[3]:.5f}')
    # Pour chaque couche (début).
    for name, n in counts.items():
        # Affiche son nombre de fichiers.
        print(f'  {name:8s} {n:5d} fichiers')
    # Affiche le total et le dossier.
    print(f'Total : {len(jobs)} fichiers → {out}')
    # Avec --plan (début).
    if a.plan:
        # S'arrête là.
        return
    # Plus de fichiers que la limite (début).
    if len(jobs) > a.max:
        # Quitte avec un message.
        sys.exit(f'{len(jobs)} fichiers, plus que la limite de {a.max} : réduire la zone ou les niveaux de zoom, ou relever --max.')

    # Compteurs des résultats.
    result = {'ok': 0, 'present': 0, 'absent': 0, 'erreur': 0}
    # Fichiers traités.
    done = 0
    # Téléchargements en parallèle, entre 1 et 8.
    with ThreadPoolExecutor(max_workers=max(1, min(8, a.parallele))) as pool:
        # Pour chaque résultat, dans l'ordre (début).
        for status in pool.map(lambda j: fetch(j[4], os.path.join(out, j[5])), jobs):
            # Compte le résultat.
            result[status] += 1
            # Un fichier de plus.
            done += 1
            # Tous les 50 fichiers, et à la fin (début).
            if done % 50 == 0 or done == len(jobs):
                # Affiche l'avancement sur la même ligne.
                print(f'\r{done}/{len(jobs)}', end='', flush=True)
    # Passe à la ligne.
    print()
    # Crée le dossier de destination s'il manque.
    os.makedirs(out, exist_ok=True)
    # Ouvre index.json.
    with open(os.path.join(out, 'index.json'), 'w', encoding='utf-8') as f:
        # Y écrit la zone, les couches et les résultats,
        json.dump({'bbox': bbox, 'couches': {n: {'adresse': layers[n][0], 'fichiers': c} for n, c in counts.items()}, 'resultat': result,
                   # avec la source des données.
                   'source': 'IGN – Géoplateforme (Licence Ouverte 2.0) ; relief : Terrarium, AWS Open Data'}, f, ensure_ascii=False, indent=2)
    # Affiche le bilan.
    print(f"Téléchargés : {result['ok']} · déjà là : {result['present']} · sans image à cet endroit : {result['absent']} · en erreur : {result['erreur']}")
    # S'il y a des erreurs (début).
    if result['erreur']:
        # Quitte avec un message.
        sys.exit('Certains fichiers n’ont pas pu être téléchargés : relancer la même commande, elle reprend où elle s’est arrêtée.')


# Si le script est lancé directement (début).
if __name__ == '__main__':
    # Lance le programme.
    main()
