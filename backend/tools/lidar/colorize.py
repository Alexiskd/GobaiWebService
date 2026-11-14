#!/usr/bin/env python3
"""Colorise un nuage de points LiDAR avec une image aérienne ou satellite géoréférencée (RVB), puis l'écrit dans un
format fait pour un affichage fluide.

    python3 colorize.py nuage.laz ortho.tif sortie.copc.laz
    python3 colorize.py nuage.laz ortho.tif sortie.laz --format laz          # très gros fichiers, mémoire constante
    python3 colorize.py nuage.las ortho.tif sortie.copc.laz --crs EPSG:2154  # nuage sans système de coordonnées
    python3 colorize.py nuage.laz ortho.tif sortie.copc.laz --espacement 0.25 --plan   # affiche le pipeline sans l'exécuter

À installer avant (une fois) :
    conda create -n lidar -c conda-forge pdal python-pdal gdal pyproj
    conda activate lidar
  PDAL fait le traitement des points, GDAL lit l'image par blocs, pyproj compare les systèmes de coordonnées.

Ce que fait le script, dans l'ordre :
  1. Inspecte le nuage (`pdal info --summary` : lit l'en-tête, pas les points) et l'image (`gdalinfo -json`).
  2. Vérifie les systèmes de coordonnées (CRS). Nuage sans CRS : `--crs` obligatoire. CRS différents : le nuage est
     reprojeté dans celui de l'image pour lire la couleur, la géométrie écrite reste celle demandée par `--crs-sortie`
     (par défaut : celle de l'image). Vérifie aussi que les deux emprises se recouvrent.
  3. Retire les points de bruit (classes 7 et 18 de l'ASPRS, 65 et 66 du LiDAR HD de l'IGN).
  4. Colorise : chaque point prend la couleur du pixel situé à sa verticale (`filters.colorization`). Les canaux 8 bits
     de l'image sont étendus aux 16 bits du format LAS (× 256). Un point hors de l'image garde 0, 0, 0.
  5. Allège si demandé (`--espacement` en mètres) : un point par cube de ce côté, le plus proche du centre.
  6. Écrit : COPC (LAZ 1.4 avec octree intégré, lu en continu par QGIS, CloudCompare, Potree 2 et les visionneuses
     web : seule la partie regardée est chargée) ou LAZ 1.4 simple (`--format laz`).

Mémoire :
  - L'image n'est jamais chargée en entier : GDAL lit les blocs survolés et les garde dans un cache borné
    (`--cache-image`, 512 Mo par défaut).
  - `--format laz` : PDAL travaille en flux, par paquets de points ; la mémoire reste constante quelle que soit la
    taille du nuage (des milliards de points passent).
  - `--format copc` (défaut) et `--espacement` : PDAL garde les points en mémoire le temps de construire l'octree,
    compter environ 60 octets par point (1 Go pour 16 millions de points, une dalle LiDAR HD). Au-delà de la mémoire
    disponible : découper d'abord (`pdal tile`), ou passer par `--format laz` puis `untwine` pour l'octree.

Ensuite, selon la visionneuse :
  - QGIS, CloudCompare : ouvrir le .copc.laz, choisir le rendu « RVB ».
  - Potree : `PotreeConverter sortie.laz -o dossier` (version 2), ou lecture directe du COPC avec potree-core.
  - Cesium : convertir en 3D Tiles (`py3dtiles convert sortie.laz`, ou Cesium ion).
  - Site Go白 : rien à préparer, le site drape lui-même l'orthophoto de l'IGN sur ses dalles (engine/lidarDrape.jsx).

Ce script n'a pas pu être exécuté dans l'environnement où il a été écrit (PDAL absent) : seule la construction du
pipeline (`build_pipeline`) y a été vérifiée. Premier essai conseillé avec `--plan`.
"""
# Importe argparse, la lecture des options de la commande.
import argparse
# Importe json.
import json
# Importe os.
import os
# Importe shutil, la recherche d'un programme installé.
import shutil
# Importe subprocess, le lancement de commandes.
import subprocess
# Importe sys, pour quitter avec un message.
import sys

# Classes de bruit retirées.
NOISE_CLASSES = (7, 18, 65, 66)


# run_json : lance une commande et lit son JSON (début).
def run_json(cmd):
    # Sa description.
    """Exécute une commande qui écrit du JSON et le renvoie décodé."""
    # Lance la commande et décode sa sortie.
    return json.loads(subprocess.run(cmd, check=True, capture_output=True, text=True).stdout)


# cloud_info : lit l'en-tête du nuage (début).
def cloud_info(path):
    # Sa description.
    """En-tête du nuage : nombre de points, emprise, CRS (WKT, vide s'il n'y en a pas). Ne lit pas les points."""
    # Résumé donné par pdal info.
    summary = run_json(['pdal', 'info', '--summary', path])['summary']
    # Ses bornes.
    b = summary['bounds']
    # Renvoie (début)
    return {
        # le nombre de points,
        'points': summary['num_points'],
        # l'emprise,
        'bounds': (b['minx'], b['miny'], b['maxx'], b['maxy']),
        # le système de coordonnées, vide s'il manque.
        'wkt': (summary.get('srs') or {}).get('wkt') or '',
    # Fin du résultat.
    }


# raster_info : lit la description de l'image (début).
def raster_info(path):
    # Sa description.
    """Image : CRS (WKT), taille du pixel (unités du CRS), emprise, nombre de canaux. Ne lit pas les pixels."""
    # Description donnée par gdalinfo.
    info = run_json(['gdalinfo', '-json', path])
    # Coordonnées des coins.
    c = info['cornerCoordinates']
    # Abscisses des deux coins opposés.
    xs = [c['upperLeft'][0], c['lowerRight'][0]]
    # Ordonnées des deux coins opposés.
    ys = [c['upperLeft'][1], c['lowerRight'][1]]
    # Renvoie (début)
    return {
        # le système de coordonnées, vide s'il manque,
        'wkt': (info.get('coordinateSystem') or {}).get('wkt') or '',
        # la taille du pixel,
        'pixel': abs(info['geoTransform'][1]),
        # l'emprise,
        'bounds': (min(xs), min(ys), max(xs), max(ys)),
        # le nombre de canaux.
        'bands': len(info['bands']),
    # Fin du résultat.
    }


# horizontal : la partie horizontale d'un système de coordonnées (début).
def horizontal(crs):
    # Sa description.
    """CRS horizontal d'un CRS composé (ex. Lambert-93 + altitudes IGN69 → Lambert-93)."""
    # Le premier sous-système d'un système composé, sinon le système lui-même.
    return crs.sub_crs_list[0] if crs.is_compound else crs


# same_crs : deux systèmes désignent-ils la même projection horizontale (début).
def same_crs(a, b):
    # Sa description.
    """Les deux CRS (WKT ou « EPSG:… ») désignent-ils la même projection horizontale ?"""
    # Importe CRS de pyproj, seulement ici.
    from pyproj import CRS
    # Compare leurs parties horizontales, sans tenir compte de l'ordre des axes.
    return horizontal(CRS.from_user_input(a)).equals(horizontal(CRS.from_user_input(b)), ignore_axis_order=True)


# overlap : la part d'une emprise couverte par une autre (début).
def overlap(a, b):
    # Sa description.
    """Part de l'emprise `a` couverte par l'emprise `b` (0 à 1), toutes deux (minx, miny, maxx, maxy)."""
    # Largeur commune.
    w = min(a[2], b[2]) - max(a[0], b[0])
    # Hauteur commune.
    h = min(a[3], b[3]) - max(a[1], b[1])
    # Surface de la première emprise.
    area = (a[2] - a[0]) * (a[3] - a[1])
    # Surface commune divisée par cette surface ; 0 si elle est nulle.
    return max(0.0, w) * max(0.0, h) / area if area > 0 else 0.0


# build_pipeline : construit les étapes du traitement PDAL (début),
def build_pipeline(src, raster, dst, *, fmt='copc', cloud_crs=None, reproject_to=None, out_crs=None, spacing=0.0,
                   # avec le nombre de canaux et le maintien du bruit.
                   bands=3, keep_noise=False):
    # Sa description.
    """Pipeline PDAL (liste d'étapes) : lecture → nettoyage → reprojection → couleur → allègement → écriture."""
    # Lecture du nuage.
    reader = {'type': 'readers.las', 'filename': src}
    # Si un système de coordonnées est imposé (début).
    if cloud_crs:
        # Il remplace celui du fichier.
        reader['override_srs'] = cloud_crs  # nuage sans CRS (ou CRS faux) : celui donné par --crs
    # Étapes : la lecture d'abord.
    stages = [reader]
    # Sauf si le bruit est gardé (début).
    if not keep_noise:
        # Filtre : retire les classes de bruit.
        stages.append({'type': 'filters.expression', 'expression': ' && '.join(f'Classification != {c}' for c in NOISE_CLASSES)})
    # S'il faut reprojeter (début).
    if reproject_to:
        # Reprojection dans le système de l'image.
        stages.append({'type': 'filters.reprojection', 'out_srs': reproject_to})
    # Canal de l'image → dimension du point, × 256 pour passer de 8 à 16 bits. Image à un seul canal : gris.
    dims = 'Red:1:256.0, Green:2:256.0, Blue:3:256.0' if bands >= 3 else 'Red:1:256.0, Green:1:256.0, Blue:1:256.0'
    # Colorisation par l'image.
    stages.append({'type': 'filters.colorization', 'raster': raster, 'dimensions': dims})
    # Si un espacement est demandé (début).
    if spacing > 0:
        # Allègement : un point par cube.
        stages.append({'type': 'filters.voxelcenternearestneighbor', 'cell': spacing})
    # Format COPC (début).
    if fmt == 'copc':
        # Écriture en COPC.
        writer = {'type': 'writers.copc', 'filename': dst, 'forward': 'all'}
    # Sinon (début).
    else:
        # LAS 1.4, format de point 7 (RVB), compressé : écriture en flux.
        writer = {'type': 'writers.las', 'filename': dst, 'forward': 'all', 'minor_version': 4, 'dataformat_id': 7, 'compression': 'laszip'}
    # Si un système de sortie est donné (début).
    if out_crs:
        # Il est écrit dans le fichier.
        writer['a_srs'] = out_crs
    # Ajoute l'écriture.
    stages.append(writer)
    # Renvoie les étapes.
    return stages


# main : le programme (début).
def main():
    # Lecteur des options.
    p = argparse.ArgumentParser(description='Colorise un nuage LiDAR avec une image géoréférencée et l’écrit en COPC ou LAZ.')
    # nuage : le nuage en entrée.
    p.add_argument('nuage', help='nuage en entrée (.las, .laz, .copc.laz)')
    # image : l'image géoréférencée.
    p.add_argument('image', help='image géoréférencée (.tif, .jp2, .vrt…), 3 canaux RVB ou 1 canal')
    # sortie : le fichier écrit.
    p.add_argument('sortie', help='fichier écrit (.copc.laz ou .laz)')
    # --format : copc ou laz.
    p.add_argument('--format', choices=('copc', 'laz'), default='copc', help='copc : octree pour l’affichage (défaut) ; laz : flux, mémoire constante')
    # --crs : le système du nuage s'il n'en déclare pas.
    p.add_argument('--crs', help='CRS du nuage s’il n’en déclare pas, ex. EPSG:2154')
    # --crs-sortie : le système écrit dans le fichier.
    p.add_argument('--crs-sortie', help='CRS écrit dans le fichier (défaut : celui de l’image)')
    # --espacement : l'allègement, en mètres.
    p.add_argument('--espacement', type=float, default=0.0, help='allègement : un point par cube de ce côté (m) ; 0 = tous les points')
    # --garder-bruit : garde les classes de bruit.
    p.add_argument('--garder-bruit', action='store_true', help='garde les classes de bruit (7, 18, 65, 66)')
    # --cache-image : le cache des blocs de l'image, en Mo.
    p.add_argument('--cache-image', type=int, default=512, help='cache des blocs de l’image, en Mo (défaut 512)')
    # --plan : affiche le pipeline et s'arrête.
    p.add_argument('--plan', action='store_true', help='affiche le pipeline et s’arrête')
    # Lit les options.
    a = p.parse_args()

    # Pour chacun des deux programmes nécessaires (début).
    for tool in ('pdal', 'gdalinfo'):
        # S'il est introuvable (début).
        if not shutil.which(tool):
            # Quitte avec la commande d'installation.
            sys.exit(f'« {tool} » introuvable : conda install -c conda-forge pdal python-pdal gdal pyproj')

    # Lit le nuage et l'image.
    cloud, raster = cloud_info(a.nuage), raster_info(a.image)
    # Système du nuage : celui de --crs, sinon celui du fichier.
    cloud_crs = a.crs or cloud['wkt']
    # Aucun (début).
    if not cloud_crs:
        # Quitte avec un message.
        sys.exit('Le nuage ne déclare pas de système de coordonnées : relancer avec --crs (ex. --crs EPSG:2154).')
    # Image sans système de coordonnées (début).
    if not raster['wkt']:
        # Quitte avec un message.
        sys.exit('L’image n’est pas géoréférencée (aucun CRS) : la géoréférencer d’abord (gdal_translate -a_srs, fichier .tfw…).')
    # Affiche le nombre de points, avec des espaces entre les milliers.
    print(f"Nuage : {cloud['points']:,} points".replace(',', ' '))
    # Affiche la taille du pixel et le nombre de canaux.
    print(f"Image : pixel de {raster['pixel']:.3g} unité(s), {raster['bands']} canal(aux)")

    # Même projection : la couleur se lit directement. Sinon le nuage passe dans le CRS de l'image.
    reproject = None if same_crs(cloud_crs, raster['wkt']) else raster['wkt']
    # S'il faut reprojeter (début).
    if reproject:
        # L'annonce.
        print('CRS différents : le nuage est reprojeté dans le CRS de l’image.')
    # Sinon (début).
    else:
        # Part du nuage couverte par l'image.
        part = overlap(cloud['bounds'], raster['bounds'])
        # L'affiche.
        print(f'Emprise du nuage couverte par l’image : {part:.0%}')
        # Aucune (début).
        if part == 0:
            # Quitte avec un message.
            sys.exit('L’image ne recouvre pas le nuage : mauvais fichier, ou mauvais CRS.')

    # Construit les étapes (début) :
    stages = build_pipeline(
        # les fichiers, le format, le système imposé et la reprojection ;
        a.nuage, a.image, a.sortie, fmt=a.format, cloud_crs=a.crs, reproject_to=reproject,
        # le système de sortie, l'espacement, les canaux et le bruit.
        out_crs=a.crs_sortie or (raster['wkt'] if reproject else None), spacing=a.espacement, bands=raster['bands'], keep_noise=a.garder_bruit,
    # Fin de la construction.
    )
    # Pipeline en JSON.
    text = json.dumps({'pipeline': stages}, indent=2, ensure_ascii=False)
    # Avec --plan (début).
    if a.plan:
        # L'affiche.
        print(text)
        # S'arrête là.
        return
    # GDAL ne garde en mémoire que les blocs de l'image récemment lus, dans cette limite.
    env = {**os.environ, 'GDAL_CACHEMAX': str(a.cache_image)}
    # Sans --nostream, PDAL choisit le flux dès que toutes les étapes le permettent (lecture, filtres, écriture LAS).
    subprocess.run(['pdal', 'pipeline', '--stdin'], input=text, text=True, check=True, env=env)
    # Affiche le fichier écrit et sa taille.
    print(f'Écrit : {a.sortie} ({os.path.getsize(a.sortie) / 1e6:.0f} Mo)')


# Si le script est lancé directement (début).
if __name__ == '__main__':
    # Lance le programme.
    main()
