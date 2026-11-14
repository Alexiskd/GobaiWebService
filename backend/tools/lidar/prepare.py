#!/usr/bin/env python3
"""Prépare une dalle LiDAR HD de l'IGN (nuage COPC .copc.laz, Lambert-93) pour l'affichage en points 3D.

Usage :
    gcc -O2 -o lazdec lazdec.c
    python3 prepare.py <dalle.copc.laz> <identifiant> "<nom affiché>" [date du relevé AAAA-MM-JJ]

Écrit backend/data/lidar/<identifiant>/manifest.json et nodes/<niveau>-<x>-<y>-<z>.bin (un fichier gzip par nœud de
l'octree COPC). Format des fichiers : voir backend/src/services/lidar-tiles/lidar-tiles.ts. Au démarrage, le serveur
copie ces fichiers dans PostgreSQL (table lidar_nodes).

Étapes : lecture de l'en-tête LAS et de la hiérarchie COPC → décodage LAZ (lazdec, sans dépendance) → pour chaque
point, classe d'affichage et luminosité (intensité du retour × ombrage du modèle de surface × occlusion) → points de
chaque nœud triés en ordre de Morton, quantifiés à 4 cm, écarts en zigzag rangés par plans d'octets, gzip.
Dépendances : numpy, scipy.
"""
# Importe les modules standard : compression, empreintes, tampons, JSON, mathématiques, fichiers, octets, commandes, système et dossiers temporaires.
import gzip, hashlib, io, json, math, os, struct, subprocess, sys, tempfile
# Importe numpy sous le nom np.
import numpy as np
# Importe ndimage de scipy, les filtres d'image.
from scipy import ndimage

# Pas de quantification : 4 cm.
STEP = 4            # pas de quantification, en unités du fichier (cm)
# Classes écartées.
DROP = (7, 65, 66)  # classes écartées : bruit, artefacts, points virtuels
# Dossier de ce script.
HERE = os.path.dirname(os.path.abspath(__file__))


# read_copc : lit l'en-tête et la hiérarchie d'un fichier COPC (début).
def read_copc(path):
    # Sa description.
    """En-tête LAS 1.4 + VLR « copc info » + hiérarchie → (infos, nœuds [(niveau, x, y, z, offset, taille, points)])."""
    # Ouvre le fichier en binaire.
    with open(path, 'rb') as f:
        # Lit les 589 premiers octets.
        head = f.read(589)
        # Vérifie la signature LASF et la version 1.4.
        assert head[:4] == b'LASF' and head[24:26] == b'\x01\x04', 'fichier LAS 1.4 attendu'
        # Vérifie le format de point 6.
        assert head[104] & 0x3F == 6, 'format de point 6 attendu (LiDAR HD)'
        # Lit les trois échelles et les trois décalages.
        sx, sy, sz, ox, oy, oz = struct.unpack_from('<6d', head, 131)
        # Vérifie l'échelle de 0,01 et le décalage nul.
        assert sx == sy == sz == 0.01 and ox == oy == oz == 0, 'échelle 0,01 et décalage nul attendus'
        # Vérifie la présence de l'enregistrement « copc ».
        assert head[377:381] == b'copc', 'premier VLR « copc info » attendu'
        # Lit le centre, la demi-largeur, l'écart des points et la place de la page racine.
        cx, cy, cz, half, spacing, root_off, root_size = struct.unpack_from('<5d2Q', head, 429)
        # Nœuds.
        nodes = []

        # page : lit une page de la hiérarchie (début).
        def page(offset, size):
            # Va au début de la page.
            f.seek(offset)
            # Lit ses octets.
            data = f.read(size)
            # Pour chaque entrée de 32 octets (début).
            for i in range(0, size, 32):
                # Sa clé, sa place, sa taille et son nombre de points.
                level, x, y, z, off, nbytes, count = struct.unpack_from('<4iQ2i', data, i)
                # Nombre −1 : c'est une autre page, lue à son tour.
                if count == -1: page(off, nbytes)
                # Nombre positif : le nœud est ajouté.
                elif count > 0: nodes.append((level, x, y, z, off, nbytes, count))
        # Lit la page racine.
        page(root_off, root_size)
    # Trie les nœuds.
    nodes.sort()
    # cm : convertit des mètres en centimètres entiers.
    cm = lambda v: int(round(v * 100))
    # Renvoie le coin, le côté et l'écart des points, puis les nœuds.
    return {'x0': cm(cx - half), 'y0': cm(cy - half), 'z0': cm(cz - half), 'side': cm(2 * half), 'spacing': spacing}, nodes


# lambert93 : convertit des coordonnées Lambert-93 en latitude et longitude (début).
def lambert93(x, y):
    # Sa description.
    """Lambert-93 (m) → (latitude, longitude) en degrés, ellipsoïde GRS80."""
    # Constantes de la projection : exposant, constante, origine, méridien central et excentricité.
    n, c, xs, ys, l0, e = 0.7256077650532670, 11754255.426096, 700000.0, 12655612.049876, math.radians(3), 0.0818191910428158
    # Distance au pôle de la projection.
    r = math.hypot(x - xs, y - ys)
    # Longitude, en radians.
    lon = l0 + math.atan((x - xs) / (ys - y)) / n
    # Latitude isométrique.
    li = -math.log(abs(r / c)) / n
    # Première estimation de la latitude.
    phi = 2 * math.atan(math.exp(li)) - math.pi / 2
    # Douze itérations (début).
    for _ in range(12):
        # Affine la latitude.
        phi = 2 * math.atan(((1 + e * math.sin(phi)) / (1 - e * math.sin(phi))) ** (e / 2) * math.exp(li)) - math.pi / 2
    # Renvoie la latitude et la longitude en degrés.
    return math.degrees(phi), math.degrees(lon)


# spread : écarte les bits d'un entier de 21 bits, un sur trois (début).
def spread(v):
    # Garde 21 bits, en 64 bits.
    v = v.astype(np.uint64) & np.uint64(0x1fffff)
    # Cinq étapes de décalage et de masque (début).
    for s, m in ((32, 0x1f00000000ffff), (16, 0x1f0000ff0000ff), (8, 0x100f00f00f00f00f), (4, 0x10c30c30c30c30c3), (2, 0x1249249249249249)):
        # Décale et masque.
        v = (v | (v << np.uint64(s))) & np.uint64(m)
    # Renvoie le résultat.
    return v


# zigzag_planes : écarts successifs en zigzag, rangés par plans d'octets (début).
def zigzag_planes(v):
    # Écarts entre valeurs successives.
    d = np.diff(v, prepend=0).astype(np.int64)
    # Zigzag : les petits écarts, positifs ou négatifs, deviennent de petits nombres.
    u = ((d << 1) ^ (d >> 63)).astype(np.uint16)
    # Renvoie les octets faibles, puis les octets forts.
    return (u & 255).astype(np.uint8).tobytes() + (u >> 8).astype(np.uint8).tobytes()


# main : le programme (début).
def main():
    # Moins de trois arguments (début).
    if len(sys.argv) < 4:
        # Affiche l'usage et quitte.
        sys.exit(__doc__)
    # Le fichier, l'identifiant et le nom.
    laz, tile_id, name = sys.argv[1:4]
    # La date du relevé, facultative.
    acquired = sys.argv[4] if len(sys.argv) > 4 else ''
    # Lit l'en-tête et les nœuds.
    info, nodes = read_copc(laz)
    # Coin et côté du cube racine, en centimètres.
    X0, Y0, Z0, SIDE = info['x0'], info['y0'], info['z0'], info['side']
    # Dossier de sortie de la dalle.
    out = os.path.join(HERE, '..', '..', 'data', 'lidar', tile_id)
    # Crée le dossier des nœuds.
    os.makedirs(os.path.join(out, 'nodes'), exist_ok=True)

    # ---- décodage : un bloc LAZ par nœud, 16 octets par point en sortie
    with tempfile.TemporaryDirectory() as tmp:
        # Chemins de la liste des nœuds et des points décodés.
        listing, raw = os.path.join(tmp, 'nodes.txt'), os.path.join(tmp, 'points.bin')
        # Ouvre la liste.
        with open(listing, 'w') as f:
            # Pour chaque nœud (début).
            for level, x, y, z, off, nbytes, count in nodes:
                # Côté de son cube.
                side = SIDE >> level
                # Écrit sa ligne : niveau, place, taille, points, coin et côté.
                f.write(f'{level} {off} {nbytes} {count} {X0 + x * side} {Y0 + y * side} {Z0 + z * side} {side}\n')
        # Lance lazdec.
        subprocess.run([os.path.join(HERE, 'lazdec'), laz, listing, raw], check=True)
        # Lit les points décodés : X, Y, Z, intensité, classe et niveau.
        a = np.fromfile(raw, dtype=np.dtype([('X', '<i4'), ('Y', '<i4'), ('Z', '<i4'), ('I', '<u2'), ('C', 'u1'), ('L', 'u1')]))
    # Vérifie le nombre de points.
    assert len(a) == sum(n[6] for n in nodes)

    # ---- modèle de surface à 0,5 m : ombrage (lumière du nord-ouest, comme le relief des tuiles) et occlusion
    keep = ~np.isin(a['C'], DROP)
    # Taille d'une cellule : 50 cm.
    CELL = 50
    # Nombre de cellules par côté.
    G = SIDE // CELL
    # Colonne de chaque point.
    cx = np.clip((a['X'] - X0) // CELL, 0, G - 1).astype(np.int64)
    # Ligne de chaque point.
    cy = np.clip((a['Y'] - Y0) // CELL, 0, G - 1).astype(np.int64)
    # Numéro de sa cellule.
    cell = cy * G + cx
    # Altitude des points gardés ; très basse pour les autres.
    zs = np.where(keep, a['Z'], -10**6).astype(np.int64)
    # Ordre des points par cellule.
    order = np.argsort(cell, kind='stable')
    # Cellules dans cet ordre.
    cs = cell[order]
    # Début de chaque cellule.
    starts = np.flatnonzero(np.r_[True, cs[1:] != cs[:-1]])
    # Modèle de surface, vide.
    dsm = np.full(G * G, np.nan)
    # Altitude maximale de chaque cellule, en mètres.
    dsm[cs[starts]] = np.maximum.reduceat(zs[order], starts) / 100.0
    # Cellules sans point gardé : vides.
    dsm[dsm < -1000] = np.nan
    # En grille.
    dsm = dsm.reshape(G, G)
    # Chaque cellule vide prend la valeur de la plus proche.
    dsm = dsm[tuple(ndimage.distance_transform_edt(np.isnan(dsm), return_distances=False, return_indices=True))]
    # Pentes du modèle légèrement lissé.
    gy, gx = np.gradient(ndimage.gaussian_filter(dsm, 0.8), 0.5)  # axe 0 = nord, axe 1 = est
    # Direction de la lumière.
    lx, ly, lz = -0.5025, 0.5025, 0.7035
    # Ombrage.
    hill = ((-gx) * lx + (-gy) * ly + lz) / np.sqrt(gx * gx + gy * gy + 1.0) / lz  # 1 = surface plate
    # Hauteur moyenne aux alentours.
    around = ndimage.gaussian_filter(dsm, 16)                                       # hauteur moyenne à ≈ 8 m à la ronde

    # Altitude des points, en mètres.
    z = a['Z'] / 100.0
    # Point au sommet de sa cellule, à 75 cm près.
    is_top = z >= dsm.reshape(-1)[cell] - 0.75
    # Ombrage du point, borné.
    shade = np.clip(hill.reshape(-1)[cell], 0.42, 1.30)
    # Occlusion : plus sombre sous la hauteur moyenne des alentours.
    occlusion = 1.0 - 0.42 * np.clip((around.reshape(-1)[cell] - z) / 14.0, 0, 1)
    # Intensité du retour, ramenée entre 0,25 et 1,12.
    intensity = np.clip(np.sqrt(a['I'].astype(np.float32) / 2200.0), 0.25, 1.12)
    # Luminosité, sur un octet.
    lum = np.clip((0.48 + 0.52 * intensity) * shade * occlusion * 170.0, 0, 255).astype(np.uint8)  # 170 = neutre

    # ---- classes d'affichage : 0 divers, 1 sol, 2-4 végétation, 5 toit, 6 façade, 7 eau, 8 pont, 9 sursol
    C = a['C']
    # Classes d'affichage, à zéro.
    cls = np.zeros(len(a), np.uint8)
    # Pour chaque correspondance de classe (début).
    for src, dst in ((2, 1), (3, 2), (4, 3), (5, 4), (9, 7), (17, 8), (64, 9)):
        # L'applique.
        cls[C == src] = dst
    # Points du bâti.
    built = (C == 6) | (C == 67)
    # Au sommet : toit.
    cls[built & is_top] = 5
    # Dessous : façade.
    cls[built & ~is_top] = 6

    # ---- un fichier par nœud
    off, items, total, total_bytes = 0, [], 0, 0
    # Pour chaque nœud (début).
    for level, kx, ky, kz, _o, _s, count in nodes:
        # Tranche de ses points.
        p = slice(off, off + count)
        # Avance dans les points.
        off += count
        # Points gardés.
        k = keep[p]
        # Côté de son cube.
        side = SIDE >> level
        # X dans le cube, en pas de 4 cm.
        x = ((a['X'][p][k] - (X0 + kx * side)) // STEP).astype(np.int64)
        # Y dans le cube.
        y = ((a['Y'][p][k] - (Y0 + ky * side)) // STEP).astype(np.int64)
        # Z depuis le bas de la dalle.
        zq = ((a['Z'][p][k] - Z0) // STEP).astype(np.int64)
        # Nombre de points.
        n = len(x)
        # Aucun (début).
        if n == 0:
            # Nœud suivant.
            continue
        # Ordre de Morton.
        o = np.argsort(spread(x) | (spread(y) << np.uint64(1)) | (spread(zq) << np.uint64(2)), kind='stable')
        # Octets du nœud : X, Y, Z en plans, puis les classes et les luminosités.
        raw = zigzag_planes(x[o]) + zigzag_planes(y[o]) + zigzag_planes(zq[o]) + cls[p][k][o].tobytes() + lum[p][k][o].tobytes()
        # Vérifie la taille et les bornes.
        assert len(raw) == 8 * n and x.min() >= 0 and y.min() >= 0 and zq.min() >= 0 and max(x.max(), y.max(), zq.max()) < 32768
        # Tampon en mémoire.
        buf = io.BytesIO()
        # Compression gzip maximale, sans date.
        with gzip.GzipFile(fileobj=buf, mode='wb', compresslevel=9, mtime=0) as g:
            # Écrit les octets.
            g.write(raw)
        # Octets compressés.
        data = buf.getvalue()
        # Clé du nœud.
        key = f'{level}-{kx}-{ky}-{kz}'
        # Ouvre son fichier.
        with open(os.path.join(out, 'nodes', key + '.bin'), 'wb') as f:
            # L'écrit.
            f.write(data)
        # Note sa clé, ses points, sa taille et son empreinte.
        items.append({'k': key, 'n': int(n), 'b': len(data), 'h': hashlib.sha256(data).hexdigest()[:16]})
        # Compte les points.
        total += n
        # Compte les octets.
        total_bytes += len(data)

    # ---- calage GPS : centre de l'emprise, bas du nuage ; cap = angle de l'axe Y de la grille avec le nord vrai
    xm, ym = (X0 + SIDE / 2) / 100, (Y0 + SIDE / 2) / 100
    # Latitude et longitude du centre.
    lat, lon = lambert93(xm, ym)
    # Les mêmes, 200 m plus au nord sur la grille.
    lat2, lon2 = lambert93(xm, ym + 200)
    # Déplacement vers l'est, en mètres.
    east = math.radians(lon2 - lon) * math.cos(math.radians(lat)) * 6378137
    # Déplacement vers le nord, en mètres.
    north = math.radians(lat2 - lat) * 6378137
    # Manifeste (début).
    manifest = {
        # Identifiant, nom et nom de la dalle.
        'id': tile_id, 'name': name, 'tile': os.path.basename(laz).split('.')[0],
        # Source, licence et date du relevé.
        'source': 'IGN – LiDAR HD', 'license': 'Licence Ouverte 2.0 (Etalab)', 'acquired': acquired,
        # Système de coordonnées.
        'crs': 'EPSG:2154 — RGF93 / Lambert-93, altitudes NGF-IGN69',
        # Points, octets, format, pas et écart des points.
        'points': int(total), 'bytes': int(total_bytes), 'format': 1, 'step': STEP / 100, 'spacing': round(info['spacing'], 4),
        # Bornes en mètres,
        'bounds': {'minX': X0 / 100, 'minY': Y0 / 100, 'minZ': Z0 / 100, 'maxX': (X0 + SIDE) / 100, 'maxY': (Y0 + SIDE) / 100,
                   # avec l'altitude maximale des points gardés.
                   'maxZ': float(a['Z'][keep].max()) / 100},
        # Calage : latitude, longitude, altitude et cap.
        'anchor': {'lat': round(lat, 7), 'lon': round(lon, 7), 'alt': Z0 / 100, 'heading': round(math.degrees(math.atan2(east, north)), 4)},
        # Nœuds.
        'nodes': items,
    # Fin du manifeste.
    }
    # Ouvre manifest.json.
    with open(os.path.join(out, 'manifest.json'), 'w') as f:
        # Y écrit le manifeste, sans espaces.
        json.dump(manifest, f, ensure_ascii=False, separators=(',', ':'))
    # Affiche le bilan.
    print(f"{tile_id} : {total} points, {len(items)} nœuds, {total_bytes / 1e6:.1f} Mo, calage {manifest['anchor']}")


# Si le script est lancé directement (début).
if __name__ == '__main__':
    # Lance le programme.
    main()
