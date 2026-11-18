# Gobai Embed Engine

Le module d’intégration expose le moteur 3D Gobai dans une page indépendante. Il réutilise `SolarEngine` et ses contrôleurs ; il ne duplique pas le moteur.

## Construction et publication

Depuis `frontend/` :

```bash
npm ci
npm run verifie:imports
npm run build
```

Publier **tout le contenu** de `frontend/dist/` sur le même domaine statique. La construction produit notamment :

- `dist/embed.html` : document iframe autonome ;
- `dist/gobai-embed.js` : API JavaScript ES module ;
- `dist/gobai-planet.js` : définition du Web Component ;
- `dist/assets/` : bundles et ressources partagés de l’application et du moteur.

Ne publier pas uniquement les trois fichiers HTML/JS : les chunks importés et les ressources de `assets/` sont nécessaires.

## Iframe directe

```html
<iframe
  src="https://www.gobaispace.com/embed.html?planet=mars&transparent=true&parentOrigin=https%3A%2F%2Fexemple.com"
  title="Mars en 3D"
  allow="fullscreen"
  style="width:420px;height:420px;border:0;background:transparent"
></iframe>
```

`parentOrigin` doit être l’origine exacte du site hôte (schéma + hôte + port éventuel). Le caractère générique `*` est refusé.

## API JavaScript

```html
<div id="mars" style="width:420px;height:420px"></div>
<script type="module">
  import Gobai from 'https://www.gobaispace.com/gobai-embed.js';
  const mars = Gobai.render('mars', '#mars', {
    transparent: true, controls: true, stars: false,
    width: '100%', height: '100%'
  });
  mars.on('embed.ready', () => console.log('Gobai prêt'));
  mars.on('planet.change', (detail) => console.log(detail));
  // mars.focus('terre'); mars.zoom(1.5); mars.rotate(10, 0);
</script>
```

Méthodes : `focus(planet)`, `setPlanet(planet)`, `zoom(factor)`, `rotate(azimuthDegrees, elevationDegrees)`, `pause()`, `resume()`, `command(type, payload)`, `on(type, callback)`, `destroy()`. Événements : `embed.ready`, `embed.error`, `planet.change`.

## Web Component

```html
<script type="module" src="https://www.gobaispace.com/gobai-planet.js"></script>
<gobai-planet
  planet="mars"
  transparent
  controls
  style="display:block;width:420px;height:420px"
></gobai-planet>
```

Le composant expose `focus()`, `setPlanet()`, `zoom()`, `rotate()`, `pause()` et `resume()`. Il émet les événements DOM `embed.ready`, `embed.error` et `planet.change` (avec `detail`). Il encapsule l’iframe dans un Shadow DOM ; le rendu reste donc isolé du CSS de la page hôte.

## Paramètres URL

- `planet` : slug de l’astre, par exemple `terre`, `mars`, `jupiter`.
- `transparent` : `true` par défaut ; `false` rétablit l’effacement opaque.
- `controls` : `true` par défaut ; `false` désactive les entrées locales.
- `stars` : `false` par défaut.
- `parentOrigin` : origine exacte du site hôte, utilisée pour sécuriser `postMessage`.
- `dataUrl` : URL d’un JSON de scène compatible avec le schéma interne Gobai.

## Protocole postMessage

Tous les messages ont la forme `{ namespace: 'gobai', version: 1, type, payload }`. Commandes hôte → iframe : `camera.focus` (`{ planet }`), `planet.change` (`{ planet }`), `camera.zoom` (`{ factor }`), `camera.rotate` (`{ azimuth, elevation }`), `engine.pause`, `engine.resume`. Événements iframe → hôte : `embed.ready`, `embed.error`, `planet.change`. Les messages entrants sont filtrés par `event.source`, `event.origin`, namespace et version.

## Transparence et limites actuelles

Le profil Embed utilise un contexte WebGL avec canal alpha (`alpha: true`), effacement alpha nul et ciel masqué. Les styles globaux du document iframe sont transparents et les overlays DOM historiques du moteur sont masqués ; les interactions canvas restent actives.

**Important : cette livraison ne rend pas encore l’ensemble du moteur autonome sans backend.** Par défaut, `fetchSceneData()` et `tilesApi` continuent d’utiliser l’API de données Gobai. `dataUrl` remplace seulement le chargement initial du JSON ; il ne remplace pas le service de manifestes de tuiles. Pour supprimer le backend, il faudra fournir un catalogue statique complet et un adaptateur de tuiles statiques respectant le contrat `tilesApi`. Les textures peuvent également provenir de fournisseurs externes et restent soumises à leurs règles CORS et conditions d’utilisation.

## Dépannage

- Si l’iframe est vide, vérifier que `embed.html`, `gobai-embed.js`, `gobai-planet.js` et le dossier `assets/` ont tous été publiés.
- Si `embed.error` signale un échec de données, vérifier l’URL de l’API configurée dans `frontend/src/moteur/api/client.jsx` et sa disponibilité depuis le navigateur.
- Si les messages ne circulent pas, vérifier que `parentOrigin` correspond exactement à `window.location.origin`.
- Le navigateur doit autoriser WebGL et les domaines des textures doivent autoriser les requêtes nécessaires.
