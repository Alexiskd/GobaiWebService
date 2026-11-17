Gobai Space — emplacement du build KeepTrack

Ce dossier doit contenir le résultat du build d'intégration de KeepTrack, afin qu'il soit servi sur la même
origine que Gobai à l'adresse /keeptrack/index.html.

Depuis un clone officiel https://github.com/thkruz/keeptrack.space :
  1. Respecter les prérequis Node.js 24+ et pnpm 10+ décrits dans son README.
  2. Initialiser son sous-module public OOTK :
       git submodule update --init --recursive -- src/engine/ootk
  3. Installer les dépendances :
       pnpm install --frozen-lockfile
  4. Construire la variante embed :
       pnpm run build:embed
  5. Copier le contenu du dossier dist/ généré dans frontend/public/keeptrack/ de Gobai.

Le chemin peut être changé avec VITE_KEEPTRACK_EMBED_URL au moment du build de Gobai.
Il doit rester de même origine que Gobai : l'API embed officielle KeepTrack refuse les iframes cross-origin.

Le code Gobai configure l'iframe avant son chargement avec __keepTrackEmbedConfig puis utilise
window.keepTrackEmbed (API v1) : setCamera, setLayers et setGroundTracks. Le pavé de zoom Gobai
transmet son facteur à KeepTrack et la commande Réinitialiser remet aussi la caméra KeepTrack à zéro.

Le dépôt KeepTrack est sous licence AGPL-3.0 (voir le dépôt upstream et ses obligations de redistribution).
