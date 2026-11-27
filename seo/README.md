# Référencement technique

## Déjà intégré au dépôt

- Canonicalisation HTTP vers `https://www.gobaispace.com`, minuscules et suppression du slash final (301).
- Pages des astres pré-générées par `frontend/scripts/generate-seo-pages.mjs` après compilation backend.
- Sitemap construit depuis `BODY_PAGES` et `WINDOW_PAGES` (source backend), avec `lastmod` issu du dernier commit Git lorsque disponible.
- `robots.txt` autorise les ressources `/assets/` et les robots déclarés, tout en excluant l'API.
- `seo/baseline.md` sert de fiche de mesure initiale ; renseigner les vraies mesures.
- IndexNow : définir `INDEXNOW_KEY` dans Render et dans les secrets GitHub Actions. Le workflow peut être lancé manuellement après le déploiement ; l'événement `deployment_status` est également pris en charge si le fournisseur de déploiement publie cet événement GitHub.

## Commandes

```bash
npm run build
npm run seo:indexnow
```

## Contrôles après déploiement

```bash
curl -I https://gobai-space.onrender.com/jupiter
curl -I https://www.gobaispace.com/Jupiter/
curl -A Googlebot https://www.gobaispace.com/jupiter
curl https://www.gobaispace.com/robots.txt
curl https://www.gobaispace.com/sitemap.xml
```

Les mesures Search Console, PageSpeed, l'indexation réelle, la validation Rich Results et les backlinks ne peuvent pas être fabriqués par le build : les relever dans les outils propriétaires et les consigner dans `baseline.md` puis dans un journal hebdomadaire.
