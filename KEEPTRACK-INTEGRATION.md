# Intégration KeepTrack dans Gobai Space

Gobai affiche KeepTrack à la place du globe quand la Terre est sélectionnée. L'intégration utilise le contrat
Embed API v1 officiel du dépôt `thkruz/keeptrack.space`, et non une iframe distante non contrôlable.

## Déploiement

Le build KeepTrack doit être déployé sur la même origine que Gobai à `/keeptrack/index.html`. Les instructions
de construction et de copie sont dans `frontend/public/keeptrack/README.txt`.

Le chemin par défaut est `/keeptrack/index.html`. Il peut être remplacé par `VITE_KEEPTRACK_EMBED_URL` lors
du build de Gobai, mais doit rester same-origin. Le SDK upstream documente explicitement le refus des URLs
cross-origin, car le parent appelle directement `iframe.contentWindow.keepTrackEmbed`.

## Contrôles raccordés

- La configuration du catalogue KeepTrack est `full` : le catalogue satellite standard de KeepTrack est chargé.
- L'API de caméra reçoit la vue Terre au démarrage.
- Le pavé de zoom de Gobai transmet le facteur à `setCamera({ mode: 'earth', zoom })`.
- La commande Réinitialiser de Gobai remet le zoom et le centre KeepTrack à leur valeur initiale.
- Le réglage Paramètres « Objets trackés — KeepTrack » contrôle les étiquettes du catalogue et les pistes
  orbitales des objets ajoutés par l'hôte (`setGroundTracks('host', ...)`).

La version actuelle du contrat Embed API n'expose pas de getter de pose de caméra (azimut/élévation/centre
courant) ni d'événement de mouvement de caméra. Les rotations/panoramiques effectués à l'intérieur de KeepTrack
ne sont donc pas réinjectés dans le moteur Gobai. Les deux rendus ne partagent pas un même état de caméra.
De plus, `setGroundTracks('host')` vise uniquement les objets que Gobai pousse explicitement dans le catalogue
hôte ; il ne trace pas automatiquement l'intégralité du catalogue NORAD de KeepTrack.

L'absence du build same-origin est détectée et produit un message de configuration, plutôt qu'une page distante
qui semble fonctionner sans être pilotée.

## Licence

Le moteur KeepTrack du dépôt upstream est distribué sous AGPL-3.0. Vérifier les obligations de licence avant de
redistribuer un build KeepTrack avec Gobai.
