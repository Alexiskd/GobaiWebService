# Gobai Space — application Rust déployable sur Render

L'application est désormais servie par un **serveur web écrit en Rust** (Axum) : ce serveur publie le frontend React/Vite compilé et expose une API d'éphémérides képlériennes portée en Rust depuis `frontend/src/Car/SystemeEngine/data/astronomy/ephemeris/kepler-orbits.ts`.

## Structure

```text
server/                 Application Rust (Axum)
├── src/main.rs         Routes HTTP, service statique SPA, API JSON
├── src/kepler.rs       Moteur képlérien (équation de Kepler, rotations, écliptique J2000)
├── src/catalog.rs      Catalogue des 43 astres (9 planètes + 34 satellites)
└── data/laplace-poles.json  Pôles de Laplace et pôles UAI (structure JSON)
frontend/               Frontend React/Vite inchangé (Three.js, MUI, moteurs 3D)
Dockerfile              Build multi-étapes : Node 22 (frontend) → Rust (serveur) → image minimale
render.yaml             Blueprint Render (runtime docker)
```

## API

| Route | Description |
|---|---|
| `GET /api/health` | Sonde de santé (health check Render). |
| `GET /api/v1/astres` | Catalogue complet : éléments képlériens, pôles de Laplace, sources JPL. |
| `GET /api/v1/poles` | Pôles de Laplace et pôles UAI en degrés ICRF J2000 (`server/data/laplace-poles.json`). |
| `GET /api/v1/positions?ids=earth,io&t=<ms>` | Positions écliptiques J2000 (UA ou km) ; `t` par défaut : maintenant. |
| `GET /api/v1/periodes` | Périodes orbitales en jours. |
| `GET /api/v1/table?id=earth&fromMs=<ms>&toMs=<ms>&stepMinutes=<min>` | Table de positions au pas régulier. |
| Toute autre route | Fallback SPA vers `index.html` (équivalent de `frontend/public/_redirects`). |

## Configuration Render

Le fichier `render.yaml` décrit un service `web` avec `runtime: docker` :

| Paramètre Render | Valeur |
|---|---|
| Type | Web Service (Docker) |
| Dockerfile Path | `./Dockerfile` |
| Docker Context | `.` |
| Health Check Path | `/api/health` |
| Port | `PORT` (vaut 10000 par défaut, lu par le serveur) |
| Auto-Deploy | désactivé (`autoDeploy: false`) |

Dans Render, créer un **New + → Web Service**, connecter le dépôt et reprendre ces valeurs si le Blueprint n'est pas utilisé. Aucune variable secrète n'est requise.

## Commandes locales

```bash
npm ci --prefix frontend && npm run build --prefix frontend   # build du frontend (frontend/dist)
cargo test --manifest-path server/Cargo.toml                  # tests Rust (11 tests)
cargo run --release --manifest-path server/Cargo.toml         # serveur sur http://localhost:8080
docker build -t gobai-server . && docker run -p 10000:10000 gobai-server   # image de production
```

Par défaut le serveur sert `../frontend/dist` (variable `GOBAI_STATIC_DIR` pour la surcharger).

## Validation scientifique

Les tests Rust vérifient la convergence de l'équation de Kepler, la période sidérale terrestre (~365,26 j), la période d'Io (~1,77 j), la distance Terre–Soleil à J2000 (~0,9833 UA, proche du périhélie) et la cohérence des pôles de Laplace entre le catalogue Rust et `laplace-poles.json`.

## Limites

Le frontend reste l'interface 3D complète ; les fonctionnalités qui dépendaient d'un backend (authentification, contributions, galerie personnelle, PostgreSQL, paiements, proxys) restent absentes de cette édition. Ne jamais placer de clé privée ou secret dans une variable `VITE_*` : ces valeurs sont incorporées au JavaScript livré au navigateur.

## Déploiement manuel

`autoDeploy: false` est conservé : le déploiement doit être déclenché manuellement dans Render.
