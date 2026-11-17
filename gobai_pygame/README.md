# Gobai Pygame — prototype système solaire

Portage 2D pygame du moteur képlérien de [Gobai Space](https://github.com/Alexiskd/static-gobai)
(édition statique React/Vite/Three.js). Les positions des astres sont celles du modèle
à deux corps d'origine : éléments moyens JPL (1800–2050) pour les huit planètes et
Pluton, éléments de Meeus avec dérives séculaires pour la Lune, éléments moyens JPL SSD
pour dix-sept satellites naturels.

Le rendu est volontairement simplifié : vue du dessus du plan de l'écliptique, pas de
3D, pas de shaders, pas d'atmosphères ni de textures. L'interface, les données et les
calculs sont en français, comme l'application d'origine.

## Lancement

```bash
pip install pygame-ce   # ou pygame
python3 main.py
```

## Commandes

| Action | Commande |
|---|---|
| Zoom | molette, `+` / `-`, `o` / `l` |
| Sélectionner un astre (la caméra le suit) | clic gauche |
| Déplacer la vue (libère le suivi) | glisser, clic droit |
| Pause / reprise | `espace` |
| Accélérer / ralentir le temps | `↑` / `↓` |
| Revenir à la date actuelle | `r` |
| Recentrer sur l'astre sélectionné | `f` |
| Quitter | `échap` |

## Structure

- `gobai/kepler.py` — portage de `frontend/src/Car/AstreSolideEngine/planetOrbits.jsx` :
  solveur de Kepler (Newton, départ de Danby), éléments à T siècles de J2000,
  position héliocentrique écliptique, tracé d'orbite, troisième loi de Kepler.
- `gobai/data.py` — portage de `frontend/src/Car/SystemeEngine/data/astronomy/data/` :
  planètes (rayon, rotation, couleur, 12 éléments), Lune, Soleil, satellites.
- `gobai/simulation.py` — couche physique pure (espace monde en UA), sans pygame
  ni Django : positions de tous les astres et tracés d'orbites à un instant donné.
- `gobai/gravity.py` — portage de `gravityMath.jsx` : masses (NASA NSSDCA / JPL),
  astre dominant (masse / distance²), formatage français des distances.
- `gobai/scale.py` — portage de `scaleLevels.jsx` : niveau d'échelle de la vue,
  de « Rue » à « Système solaire », affiché dans le HUD selon l'altitude au-dessus
  de l'astre dominant.
- `main.py` — l'application : caméra (zoom à la molette centré sur le curseur, suivi
  de l'astre sélectionné, déplacement au glisser), simulation temporelle (pause,
  vitesse en jours par seconde, retour à la date actuelle), orbites tracées à partir
  des éléments de la date, Lune et satellites visibles en zoomant, anneaux de Saturne,
  panneau d'informations (distances, période, rotation, rayon), fond étoilé.
- `tests/test_kepler.py` — validation numérique : résidu du solveur, position de la
  Terre à J2000, distances ordonnées (Neptune devant Pluton, qui était plus proche en
  2000), bornes de distance lunaire, mouvement lunaire quotidien, satellites
  circulaires, fermeture du tracé d'orbite, troisième loi de Kepler.

```bash
python3 tests/test_kepler.py      # ou : python3 -m pytest tests/
```

## Limites connues

- Le repère de la scène est l'écliptique J2000 projeté à plat : l'inclinaison et le
  nœud n'influencent que la composante z, ignorée au dessin.
- Les satellites sont des orbites circulaires (a + période), comme le repli du modèle
  d'origine ; seuls leurs éléments JPL complets donneraient l'ellipse exacte.
- Pas d'éphémérides Horizons : comme l'édition statique, le prototype reste hors ligne.
