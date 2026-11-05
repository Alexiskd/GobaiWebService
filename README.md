# Gobai

Gobai is a browser-based solar-system scene with a NestJS API and a React/Three.js frontend. User point-cloud contributions are parsed locally and replicated directly between browsers.

## Anonymous point-cloud contributions

Open **Contribuer** in the scene to import a `.laz` file. The panel reads the LAS header, displays the CRS/bounds, and checks file size (256 MiB maximum) and point count (10 million maximum). Set the desired X/Y/Z extents in metres and the WGS84 latitude, longitude, and altitude anchor, then preview and publish. Parsing and chunk generation run in a Web Worker; no source file is uploaded to the API.

The worker creates spatial chunks (up to 100,000 points each, at most 4,096 chunks) and three decimation levels (strides 1/4/16). The scene chooses an LOD from camera altitude and draws chunk bounds with a status-colored shader. LAS coordinates are scaled to the requested dimensions and interpreted as local east/north/up offsets at the supplied anchor.

### Browser storage

- The Ed25519 signing key, chosen pseudo, and event-CID index are kept in `localStorage`. The pseudo is included in signed contributions, votes, and comments and is visible to peers; the signing key remains internal to the panel.
- Content-addressed blocks of at least 1 MiB use the browser Cache API. Smaller blocks use Helia with IndexedDB. Cache eviction, clearing site data, or private-browsing policies can remove local content.
- This is a storage-tiering policy: small, frequently used identity/index data occupy the fast local-storage tier; large point-cloud blocks occupy the browser-cache tier; smaller immutable blocks use IndexedDB. These are browser-managed tiers, not a guarantee of physical NVMe/SATA placement.
- Cookies are deliberately not used: browsers attach them to HTTP requests, which would expose local identity markers to the backend and provide no suitable capacity for content blocks. The private key is stored locally without encryption; protect exported identity files.

### Peer replication

The backend's `/api/p2p/signal` WebSocket endpoint relays only temporary WebRTC offers, answers, and ICE candidates. Contribution blocks, votes, and comments travel over browser-to-browser data channels and are verified by CID and signature before being added to the local journal. The backend does not persist contribution content or votes.

Set `P2P_MAX_PEERS`, `P2P_MAX_ROOMS`, `P2P_STUN_URLS`, and (for networks that require TURN relaying) `P2P_TURN_URL`, `P2P_TURN_USERNAME`, and `P2P_TURN_CREDENTIAL` in the backend environment. TURN relays encrypted WebRTC transport but can observe connection metadata and traffic volume. Without TURN, some NAT combinations cannot connect. Contributions are available only while a peer holding their blocks is reachable; this is not an archival guarantee.

### Voting and integrity

Every contribution, vote, and comment is an append-only Ed25519-signed event with a 10-bit SHA-256 proof of work. One vote per public key and contribution is counted; duplicate keys are resolved deterministically by the lowest event CID. The supplied Hot ranking formula is used. Reliability uses the Wilson lower bound (`z = 1.96`), at least 20 votes, and a 0.75 threshold.

The **Pour vous · voisins** feed is calculated locally from the replicated vote journal; it does not replace the Hot feed. Each pseudonymous key has a sparse profile of `+1`/`-1` votes. The recommender compares profiles using cosine agreement over contributions both keys rated, requires at least two shared ratings, and uses only positively similar peers. Recommendations exclude contributions already rated by the viewer and the viewer's own contributions; neighbor ratings are similarity-weighted and confidence-shrunk. The community feed can be searched by contribution name, pseudo, or CID. Sparse journals, new users, or few shared ratings can produce no recommendations. Similarity is not proof of trust, and Sybil keys can manipulate profiles and recommendations.

The pseudo is a public display name, not authentication: account login and token-based sessions are not implemented yet.

Proof of work raises the cost of automated spam but does **not** prevent Sybil attacks: an attacker can create many keys and devices. Reputation weighting and account-based moderation are not implemented. Votes and comments are pseudonymous, not anonymous to a person who has access to the browser's stored keys.

### Geospatial limitations

The LAS WKT is displayed but there is no general CRS reprojection engine. The file's axes are scaled to the entered model dimensions and aligned to the local ENU frame; confirm the source CRS and orientation before publishing. The anchor placement is WGS84 → ECEF/ENU. Header bounds are checked against decoded bounds, but the application cannot infer real-world metres from an arbitrary or missing CRS.

Corrections are new signed contribution events that reference the prior version CID. Existing versions and their votes remain unchanged.

## Deployment (Render, single web service)

The NestJS API also serves the compiled frontend (`frontend/dist`) on the same origin: one service, one URL, no CORS. Routes under `/api` go to the API (including the `/api/p2p/signal` WebSocket); every other `GET` returns the React app.

From the repository root:

```powershell
npm run build   # installs backend + frontend, builds frontend (Vite) then backend (Nest)
npm start       # node backend/dist/main.js — site on http://localhost:3001/
```

On Render, either use the `render.yaml` Blueprint or create a **Web Service** manually:

| Setting | Value |
| --- | --- |
| Root Directory | *(empty — repository root)* |
| Runtime | Node (version from `.node-version`: 22) |
| Build Command | `npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Render provides `PORT`. Do not set `VITE_API_URL` for the web build (the site calls `/api` on its own origin). Native Capacitor builds still default to `https://gobai-space.onrender.com/api`. Other backend variables are listed in `backend/.env.example`. The tile cache and `pointclouds/` folder live in `backend/` on Render's ephemeral disk.

## Development and checks

Run the API and frontend using the repository's existing scripts. The frontend Vite proxy forwards `/api` (including WebSocket upgrades) to `http://localhost:3001` by default.

```powershell
cd backend
npm run dev

cd frontend
npm run dev
```

Focused contribution checks:

```powershell
cd frontend
npm run typecheck:contributions
npm run test:contributions
npm run build

cd backend
npm run build
npm test -- --runInBand
```
