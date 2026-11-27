# Couverture des 5 000 mots-clés Gobai

- Expressions source : **5000**
- Français : **2578**
- Anglais : **2422**
- Pages cibles : **27**
- Toutes les expressions sont affectées à une page existante.
- Les expressions sans `target_page` sont affectées selon leur catégorie et leur sujet.
- `/iapetus` est normalisé vers la route française existante `/japet`.

## Répartition par page

| Page | Français | Anglais | Total |
|---|---:|---:|---:|
| `/` | 367 | 269 | 636 |
| `/callisto` | 77 | 79 | 156 |
| `/deimos` | 77 | 79 | 156 |
| `/dione` | 77 | 79 | 156 |
| `/encelade` | 77 | 79 | 156 |
| `/europe` | 77 | 79 | 156 |
| `/galerie` | 33 | 27 | 60 |
| `/ganymede` | 77 | 79 | 156 |
| `/io` | 77 | 79 | 156 |
| `/japet` | 77 | 79 | 156 |
| `/jupiter` | 77 | 79 | 156 |
| `/lune` | 103 | 86 | 189 |
| `/mars` | 120 | 103 | 223 |
| `/mercure` | 77 | 79 | 156 |
| `/mimas` | 77 | 79 | 156 |
| `/neptune` | 77 | 79 | 156 |
| `/node` | 52 | 49 | 101 |
| `/phobos` | 77 | 79 | 156 |
| `/pluton` | 77 | 79 | 156 |
| `/rhea` | 77 | 79 | 156 |
| `/saturne` | 117 | 99 | 216 |
| `/soleil` | 82 | 83 | 165 |
| `/terre` | 241 | 205 | 446 |
| `/tethys` | 77 | 79 | 156 |
| `/titan` | 77 | 79 | 156 |
| `/uranus` | 77 | 79 | 156 |
| `/venus` | 77 | 79 | 156 |

## Règle éditoriale

Les 5 000 expressions sont conservées dans `seo/keyword-coverage.json` et affectées à une page dans l’index chargé par le backend. Le rendu HTML sélectionne uniquement des expressions pertinentes pour le contenu visible de chaque page ; il ne publie pas les 5 000 expressions en bloc dans `meta keywords`. Les autres variantes servent à la couverture éditoriale, à la planification des FAQ et aux futures améliorations de contenu. Les volumes de recherche ne sont pas fournis par le JSON source et ne sont donc pas supposés.
