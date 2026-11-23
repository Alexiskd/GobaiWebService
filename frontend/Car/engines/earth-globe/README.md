# earth-globe — affichage des astres tuilés par profils (méthode « Earth Maps »)

Engine mutable : une table de profils (`earth-globe.profile.js`) règle le seul moteur de tuiles (`TileManager`)
au lieu d'un moteur par astre.

| Fichier | Rôle |
|---|---|
| `earth-globe.profile.js` | Profils par astre : affichage (`quadtree` ou `hex`), plafond d'altitude du relief, relief par défaut. |
| `earth-globe.service.js` | Applique le profil à la description d'un astre (`tiledBodies.jsx`) et répond au moteur de tuiles. |

## Méthode « Earth Maps » (la Terre)

Celle des applis de globe 3D (Earth Maps, Earth 3D Map), avec des sources ouvertes, sans clé ni licence payante :

- arbre de tuiles carrées XYZ (quadtree), choisies par leur erreur à l'écran, horizon et hors-champ exclus ;
- relief Terrarium (Mapterhorn / Copernicus GLO-30, AWS Terrain Tiles) drapé sous les tuiles à toutes les altitudes,
  fond des océans compris, allumé par défaut ;
- imagerie : table de priorité du serveur (orthophotos nationales ouvertes, Sentinel-2 cloudless EOX, NASA GIBS).

Les autres astres gardent les cellules hexagonales.
