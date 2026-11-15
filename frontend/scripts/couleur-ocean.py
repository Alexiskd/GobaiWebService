"""
Couleur réelle de l'eau du large selon sa chlorophylle : table de couleurs sRGB pour l'app (oceanColourLut.js).

Calcul fait une fois, hors de l'app, avec ocpy (https://github.com/ocean-colour/ocpy, licence BSD-3) :
  - absorption de l'eau pure : ocpy.water.absorption.a_water(…, data='IOCCG') (IOCCG 2018) ;
  - diffusion de l'eau de mer pure : ocpy.water.scattering.betasw_ZHH2009 (Zhang, Hu et He 2009), 20 °C, 35 PSU ;
  - absorption du phytoplancton : ocpy.ph.absorption.load_bricaud1998 (Bricaud et al. 1998) : a_phi = A · Chl^E ;
  - matière dissoute et détritus, liés au phytoplancton (eaux du large) : a_dg(λ) = 0,2 · a_phi(440) · e^(−0,018 (λ − 440)) ;
  - rétrodiffusion des particules : Morel et Maritorena (2001) ;
  - réflectance : rrs = u (0,0949 + 0,0794 u), u = bb / (a + bb) (Gordon et al. 1988),
    Rrs = 0,52 rrs / (1 − 1,7 rrs) (Lee et al. 2002), réflectance R = π · Rrs ;
  - couleur : spectre éclairé par un corps noir à 6 504 K (proche de D65), fonctions colorimétriques CIE 1931
    approchées par Wyman, Sloan et Shirley (2013), sRGB équilibré sur le blanc (R = 1 donne du blanc) ;
  - exposition × 2,5 : l'eau ne renvoie que quelques % de la lumière ; sans elle, toutes les mers seraient presque
    noires et leurs nuances illisibles (choix d'affichage, comme une image satellite en couleurs naturelles).

Usage (depuis frontend/) : PYTHONPATH=<chemin du dépôt ocpy> python3 scripts/couleur-ocean.py
(ou pip install ocpy-ocean). Écrit src/moteur/engine/tiles/oceanColourLut.js (navigateur) et
backend/src/services/export/ocean-colour-lut.ts (modèle 3D de la Terre exporté).
"""

# Importe les outils du système (modules, chemins).
import sys, os, types
# Importe numpy, pour les calculs sur les spectres.
import numpy as np

# ocpy.water.scattering importe ocpy.hydrolight, qui demande xarray ; betasw_ZHH2009 ne s'en sert pas : un module vide suffit s'il manque.
try:
    # Essaie le vrai module.
    import xarray  # noqa: F401
# S'il manque :
except ImportError:
    # un module vide le remplace.
    sys.modules['xarray'] = types.ModuleType('xarray')

# Importe d'ocpy l'absorption de l'eau, sa diffusion et l'absorption du phytoplancton.
from ocpy.water import absorption, scattering
# Importe la table de Bricaud et al. (1998).
from ocpy.ph.absorption import load_bricaud1998

# Longueurs d'onde : de 400 à 700 nm, tous les 2 nm (celles de la table de Bricaud).
WV = np.arange(400.0, 701.0, 2.0)
# Pas en nanomètres.
DW = 2.0
# Chlorophylle : de 0,01 à 31,6 mg/m³, en 64 pas réguliers du logarithme.
LOG_MIN, LOG_MAX, STEPS = -2.0, 1.5, 64
# Exposition de l'affichage (voir l'en-tête).
EXPOSURE = 2.5

# Absorption de l'eau pure (IOCCG 2018), en m⁻¹.
A_W = absorption.a_water(WV, data='IOCCG')
# Rétrodiffusion de l'eau de mer pure : la moitié de sa diffusion totale (20 °C, 35 PSU).
BB_W = scattering.betasw_ZHH2009(WV, 20.0, np.array([90.0]), 35.0)[2] / 2
# Table de Bricaud et al. (1998).
B98 = load_bricaud1998()
# Coefficients A et E du phytoplancton, aux longueurs d'onde du calcul.
A_PHI = np.interp(WV, B98['lambda'], B98['Aphi'])
# Exposant E.
E_PHI = np.interp(WV, B98['lambda'], B98['Ephi'])


# Fonction rrs_spectrum : la réflectance de l'eau (sr⁻¹) pour une chlorophylle donnée (mg/m³).
def rrs_spectrum(chl):
    # Absorption du phytoplancton.
    a_phi = A_PHI * chl ** E_PHI
    # Matière dissoute et détritus, liés au phytoplancton.
    a_dg = 0.2 * np.interp(440.0, WV, a_phi) * np.exp(-0.018 * (WV - 440.0))
    # Absorption totale.
    a = A_W + a_phi + a_dg
    # Diffusion des particules à 550 nm (Morel et Maritorena 2001).
    b_p550 = 0.416 * chl ** 0.766
    # Pente spectrale de la rétrodiffusion : nulle au-delà de 2 mg/m³.
    nu = 0.5 * (np.log10(chl) - 0.3) if chl < 2 else 0.0
    # Rétrodiffusion des particules.
    bb_p = (0.002 + 0.01 * (0.5 - 0.25 * np.log10(chl)) * (WV / 550.0) ** nu) * b_p550
    # Rétrodiffusion totale.
    bb = BB_W + bb_p
    # Rapport u.
    u = bb / (a + bb)
    # Réflectance sous la surface (Gordon et al. 1988).
    rrs = u * (0.0949 + 0.0794 * u)
    # Réflectance au-dessus de la surface (Lee et al. 2002).
    return 0.52 * rrs / (1 - 1.7 * rrs)


# Fonction lobe : une demi-gaussienne de chaque côté du pic (Wyman, Sloan et Shirley 2013).
def lobe(x, mu, s1, s2):
    # Écart réduit, avec la largeur de gauche ou de droite.
    t = (x - mu) / np.where(x < mu, s1, s2)
    # Gaussienne.
    return np.exp(-0.5 * t * t)


# Fonctions colorimétriques CIE 1931 approchées : x̄,
XB = 1.056 * lobe(WV, 599.8, 37.9, 31.0) + 0.362 * lobe(WV, 442.0, 16.0, 26.7) - 0.065 * lobe(WV, 501.1, 20.4, 26.2)
# ȳ,
YB = 0.821 * lobe(WV, 568.8, 46.9, 40.5) + 0.286 * lobe(WV, 530.9, 16.3, 31.1)
# et z̄.
ZB = 1.217 * lobe(WV, 437.0, 11.8, 36.0) + 0.681 * lobe(WV, 459.0, 26.0, 13.8)
# Éclairage : corps noir à 6 504 K (loi de Planck, à un facteur près).
LUX = 1.0 / ((WV * 1e-9) ** 5 * (np.exp(1.4388e-2 / (WV * 1e-9 * 6504.0)) - 1))
# Passage XYZ → sRGB linéaire (blanc D65).
M = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])


# Fonction linear_rgb : le sRGB linéaire d'un spectre de réflectance R(λ).
def linear_rgb(refl):
    # XYZ, normalisé pour que R = 1 donne Y = 1.
    xyz = np.array([np.sum(refl * LUX * cmf) * DW for cmf in (XB, YB, ZB)]) / (np.sum(LUX * YB) * DW)
    # sRGB linéaire.
    return M @ xyz


# Équilibre sur le blanc : un réflecteur parfait (R = 1) donne exactement du blanc.
WHITE = linear_rgb(np.ones_like(WV))


# Fonction encode : sRGB linéaire → composantes de 0 à 255 (courbe sRGB).
def encode(c):
    # Bornée entre 0 et 1.
    c = np.clip(c, 0.0, 1.0)
    # Courbe sRGB.
    s = np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055)
    # En entiers de 0 à 255.
    return [int(round(v * 255)) for v in s]


# Les couleurs, du logarithme minimal au maximal.
colours = []
# Pour chaque pas :
for k in range(STEPS):
    # la chlorophylle ;
    chl = 10 ** (LOG_MIN + (LOG_MAX - LOG_MIN) * k / (STEPS - 1))
    # la réflectance R = π · Rrs, sa couleur équilibrée, exposée et encodée.
    colours.append(encode(EXPOSURE * linear_rgb(np.pi * rrs_spectrum(chl)) / WHITE))

# Fichier de sortie, à côté du moteur des tuiles.
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'moteur', 'engine', 'tiles', 'oceanColourLut.js')
# Lignes du fichier.
lines = [
    '// Fichier produit par scripts/couleur-ocean.py (ne pas modifier à la main) : couleur réelle de l\'eau du large',
    '// selon sa chlorophylle, calculée avec ocpy (https://github.com/ocean-colour/ocpy, BSD-3) — voir ce script.',
    '',
    '/** Logarithme décimal de la chlorophylle (mg/m³) de la première et de la dernière couleur. */',
    '// Bornes du logarithme de la chlorophylle : de −2 (0,01 mg/m³) à 1,5 (31,6 mg/m³).',
    f'export const OCEAN_LOG_CHL = [{LOG_MIN}, {LOG_MAX}];',
    '/** Couleurs sRGB [r, g, b], à intervalles réguliers du logarithme de la chlorophylle. */',
    '// Les 64 couleurs.',
    'export const OCEAN_COLOURS = [',
    *[f'  [{r}, {g}, {b}], // chlorophylle {10 ** (LOG_MIN + (LOG_MAX - LOG_MIN) * k / (STEPS - 1)):.3g} mg/m³'.replace('.', ',') for k, (r, g, b) in enumerate(colours)],
    '// Fin des couleurs.',
    '];',
    '',
]
# Écrit le fichier.
with open(OUT, 'w', encoding='utf-8') as f:
    # Toutes les lignes, séparées par des retours à la ligne.
    f.write('\n'.join(lines))
# Même table pour le serveur (modèle 3D exporté), typée pour TypeScript.
OUT_TS = os.path.join(os.path.dirname(__file__), '..', '..', 'backend', 'src', 'services', 'export', 'ocean-colour-lut.ts')
# Écrit le fichier du serveur : mêmes lignes, avec les types.
with open(OUT_TS, 'w', encoding='utf-8') as f:
    # Les types des deux constantes ajoutés.
    f.write('\n'.join(lines).replace('export const OCEAN_LOG_CHL =', 'export const OCEAN_LOG_CHL: [number, number] =').replace('export const OCEAN_COLOURS =', 'export const OCEAN_COLOURS: Array<[number, number, number]> ='))
# Affiche quelques couleurs, pour contrôle.
print('0,01 :', colours[0], '· 0,1 :', colours[18], '· 1 :', colours[36], '· 10 :', colours[54], '· 31,6 :', colours[-1])
