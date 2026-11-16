# Gobai Space — édition frontend statique

Cette copie est indépendante du dépôt source. Le dossier `backend/` et les scripts NestJS/PostgreSQL ont été retirés.
Le frontend React/Vite, ses composants, styles, assets, données publiques et moteurs 3D sont conservés.

## Développement et build

```bash
npm ci --prefix frontend
npm run dev --prefix frontend
npm run build
npm run preview
```

Le build est généré dans `frontend/dist`. Pour Render, le blueprint publie ce dossier comme site statique.
Le fichier `frontend/public/_redirects` active le fallback SPA.

## Calculs conservés côté navigateur

Les modules de calcul orbital et leurs tables statiques auparavant importés depuis `backend/src/services` ont été
recopiés dans `frontend/src/moteur/data/astronomy`. Les calculs VSOP87A et képlériens utilisés par le moteur 3D
restent locaux au navigateur : ils ne nécessitent pas de serveur.

## Fonctions qui ne peuvent pas être garanties sans backend

La suppression du backend rend indisponibles tant qu'elles ne sont pas réécrites ou raccordées à un service externe :
comptes/contributions, galerie personnelle stockée en base, paiements Stripe, assistant serveur, API de données
(éphémérides serveur, catalogue/lieux, villes, couches et tuiles relayées, météo/atmosphère relayée, LiDAR serveur,
états de disponibilité NASA Trek et autres routes `/api/v1`). Ces appels ne sont pas simulés : les vues qui en dépendent
peuvent afficher une donnée absente ou une erreur réseau.

Les appels vers des fournisseurs publics tiers présents dans le frontend sont distincts du backend Gobai et peuvent
continuer à fonctionner selon leurs CORS, quotas et disponibilité. Le site statique n'offre aucune protection de secret :
aucune clé privée ou clé de serveur ne doit être intégrée au bundle navigateur.

## Limites de cette livraison

- Aucun commit, push, pull request ou déploiement n'a été effectué.
- Le dépôt GitHub d'origine n'a pas été modifié.
- Les fonctionnalités nécessitant une base de données, une session serveur, une clé secrète ou un proxy backend
  nécessitent une migration dédiée avant d'être considérées comme pleinement opérationnelles.
