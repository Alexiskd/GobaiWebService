"""Tables de données portées depuis `frontend/src/Car/SystemeEngine/data/astronomy/data/`.

Éléments képlériens JPL « Keplerian Elements for Approximate Positions of the
Major Planets » (1800–2050) : [a, a', e, e', I, I', L, L', ϖ, ϖ', Ω, Ω']
(a en UA, angles en degrés, dérives par siècle julien). Sources : NASA NSSDCA
et JPL SSD, valeurs arrondies.
"""

SUN = {"id": "sun", "nom": "Soleil", "radius": 109.2, "color": (255, 179, 0)}

PLANETS = [
    {"id": "mercury", "nom": "Mercure", "radius": 0.383, "rotation": 58.65, "color": (181, 181, 181),
     "elements": [0.38709927, 3.7e-7, 0.20563593, 0.00001906, 7.00497902, -0.00594749,
                  252.2503235, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081]},
    {"id": "venus", "nom": "Vénus", "radius": 0.949, "rotation": -243.0, "color": (232, 194, 122),
     "elements": [0.72333566, 0.0000039, 0.00677672, -0.00004107, 3.39467605, -0.0007889,
                  181.9790995, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418]},
    {"id": "earth", "nom": "Terre", "radius": 1.0, "rotation": 0.9973, "color": (61, 139, 255),
     "elements": [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668,
                  100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0.0, 0.0]},
    {"id": "mars", "nom": "Mars", "radius": 0.532, "rotation": 1.026, "color": (224, 85, 58),
     "elements": [1.52371034, 0.00001847, 0.0933941, 0.00007882, 1.84969142, -0.00813131,
                  -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343]},
    {"id": "jupiter", "nom": "Jupiter", "radius": 11.21, "rotation": 0.4135, "color": (217, 160, 102),
     "elements": [5.202887, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714,
                  34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106]},
    {"id": "saturn", "nom": "Saturne", "radius": 9.45, "rotation": 0.444, "color": (240, 220, 154),
     "elements": [9.53667594, -0.0012506, 0.05386179, -0.00050991, 2.48599187, 0.00193609,
                  49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794]},
    {"id": "uranus", "nom": "Uranus", "radius": 4.01, "rotation": -0.718, "color": (127, 227, 238),
     "elements": [19.18916464, -0.00196176, 0.04725744, -0.00004397, 0.77263783, -0.00242939,
                  313.23810451, 428.48202785, 170.9542763, 0.40805281, 74.01692503, 0.0424058]},
    {"id": "neptune", "nom": "Neptune", "radius": 3.88, "rotation": 0.671, "color": (74, 107, 255),
     "elements": [30.06992276, 0.00026291, 0.00859048, 0.00005105, 1.77004347, 0.00035372,
                  -55.12002969, 218.45945325, 44.96476227, -0.32241464, 131.78422574, -0.00508664]},
    {"id": "pluto", "nom": "Pluton", "radius": 0.18647, "rotation": -6.38723, "color": (216, 184, 148),
     "elements": [39.48211675, -0.00031596, 0.2488273, 0.0000517, 17.14001206, 0.00004818,
                  238.92903833, 145.20780515, 224.06891629, -0.04062942, 110.30393684, -0.01183482]},
]

MOON = {
    "id": "moon", "nom": "Lune", "parent": "earth", "radiusKm": 1737.4, "color": (200, 200, 200),
    "aKm": 384_400.0, "e": 0.0549, "i": 5.145, "om": 125.0445479, "w": 318.0634, "M0": 134.9633964,
    "omDot": -1934.1362891, "wDot": 6003.1500178, "MDot": 477198.8675055,
}

SATELLITES = [
    {"id": "phobos", "nom": "Phobos", "parent": "mars", "radiusKm": 11.1, "color": (150, 140, 130), "aKm": 9_375, "periodDays": 0.31891},
    {"id": "deimos", "nom": "Deimos", "parent": "mars", "radiusKm": 6.2, "color": (160, 150, 140), "aKm": 23_457, "periodDays": 1.263},
    {"id": "io", "nom": "Io", "parent": "jupiter", "radiusKm": 1821.49, "color": (217, 196, 92), "aKm": 421_800, "periodDays": 1.769138},
    {"id": "europa", "nom": "Europe", "parent": "jupiter", "radiusKm": 1560.8, "color": (205, 188, 163), "aKm": 671_100, "periodDays": 3.551181},
    {"id": "ganymede", "nom": "Ganymède", "parent": "jupiter", "radiusKm": 2631.2, "color": (142, 132, 118), "aKm": 1_070_400, "periodDays": 7.154553},
    {"id": "callisto", "nom": "Callisto", "parent": "jupiter", "radiusKm": 2410.3, "color": (108, 96, 83), "aKm": 1_882_700, "periodDays": 16.689018},
    {"id": "mimas", "nom": "Mimas", "parent": "saturn", "radiusKm": 198.2, "color": (188, 188, 188), "aKm": 186_000, "periodDays": 0.942422},
    {"id": "enceladus", "nom": "Encelade", "parent": "saturn", "radiusKm": 252.1, "color": (241, 243, 246), "aKm": 238_400, "periodDays": 1.370218},
    {"id": "tethys", "nom": "Téthys", "parent": "saturn", "radiusKm": 531.1, "color": (216, 216, 212), "aKm": 295_000, "periodDays": 1.887802},
    {"id": "dione", "nom": "Dioné", "parent": "saturn", "radiusKm": 561.4, "color": (201, 201, 197), "aKm": 377_700, "periodDays": 2.736915},
    {"id": "rhea", "nom": "Rhéa", "parent": "saturn", "radiusKm": 763.5, "color": (189, 186, 180), "aKm": 527_200, "periodDays": 4.518212},
    {"id": "titan", "nom": "Titan", "parent": "saturn", "radiusKm": 2574.76, "color": (214, 164, 70), "aKm": 1_221_900, "periodDays": 15.945421},
    {"id": "iapetus", "nom": "Japet", "parent": "saturn", "radiusKm": 734.3, "color": (155, 144, 129), "aKm": 3_561_700, "periodDays": 79.3215},
    {"id": "miranda", "nom": "Miranda", "parent": "uranus", "radiusKm": 235.8, "color": (169, 167, 163), "aKm": 129_900, "periodDays": 1.413479},
    {"id": "ariel", "nom": "Ariel", "parent": "uranus", "radiusKm": 578.9, "color": (184, 180, 173), "aKm": 190_900, "periodDays": 2.520379},
    {"id": "umbriel", "nom": "Umbriel", "parent": "uranus", "radiusKm": 584.7, "color": (111, 108, 104), "aKm": 266_000, "periodDays": 4.144176},
    {"id": "titania", "nom": "Titania", "parent": "uranus", "radiusKm": 788.9, "color": (163, 154, 143), "aKm": 436_300, "periodDays": 8.705867},
    {"id": "oberon", "nom": "Obéron", "parent": "uranus", "radiusKm": 761.4, "color": (149, 138, 128), "aKm": 583_500, "periodDays": 13.463234},
    {"id": "triton", "nom": "Triton", "parent": "neptune", "radiusKm": 1352.6, "color": (217, 201, 192), "aKm": 354_760, "periodDays": -5.876854},
    {"id": "charon", "nom": "Charon", "parent": "pluto", "radiusKm": 606.0, "color": (154, 149, 144), "aKm": 19_596, "periodDays": 6.3872},
]
