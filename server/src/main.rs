//! Gobai Space — serveur Rust (Axum) : service statique du frontend compilé
//! et API d'éphémérides képlériennes portée depuis le frontend.

mod catalog;
mod kepler;

use axum::extract::Query;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Json, Response};
use axum::routing::get;
use axum::Router;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tower_http::services::{ServeDir, ServeFile};

#[tokio::main]
async fn main() {
    let static_dir: PathBuf = std::env::var("GOBAI_STATIC_DIR")
        .unwrap_or_else(|_| "../frontend/dist".to_string())
        .into();
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);

    let spa = ServeDir::new(&static_dir).fallback(ServeFile::new(static_dir.join("index.html")));
    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/v1/astres", get(astres))
        .route("/api/v1/poles", get(poles))
        .route("/api/v1/positions", get(positions))
        .route("/api/v1/periodes", get(periodes))
        .route("/api/v1/table", get(table))
        .fallback_service(spa);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .unwrap_or_else(|e| panic!("impossible d'écouter sur {addr} : {e}"));
    println!("gobai-server écoute sur http://{addr} (statique : {})", static_dir.display());
    axum::serve(listener, app)
        .await
        .expect("le serveur s'est arrêté anormalement");
}

async fn health() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "service": "gobai-server",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

async fn astres() -> Json<Value> {
    Json(json!({
        "nombre": catalog::astres().len(),
        "astres": catalog::astres(),
    }))
}

async fn poles() -> Json<Value> {
    Json(serde_json::from_str(include_str!("../data/laplace-poles.json")).expect("JSON embarqué invalide"))
}

fn erreur_kepler(e: kepler::KeplerError) -> Response {
    let statut = match e {
        kepler::KeplerError::HorsDomaine(_) => StatusCode::BAD_REQUEST,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    };
    (statut, e.to_string()).into_response()
}

async fn periodes() -> Json<Value> {
    let periodes: Vec<Value> = catalog::astres()
        .iter()
        .filter_map(|astre| {
            kepler::period_days(astre)
                .ok()
                .map(|p| json!({ "id": astre.id, "nom": astre.nom, "periodeJours": p }))
        })
        .collect();
    Json(json!({ "periodes": periodes }))
}

#[derive(Debug, serde::Deserialize)]
pub struct TableQuery {
    pub id: String,
    #[serde(rename = "fromMs")]
    pub from_ms: f64,
    #[serde(rename = "toMs")]
    pub to_ms: f64,
    #[serde(rename = "stepMinutes")]
    pub step_minutes: f64,
}

async fn table(
    Query(requete): Query<TableQuery>,
) -> Result<Json<Value>, Response> {
    let astre = catalog::astre_par_id(&requete.id).ok_or_else(|| {
        (StatusCode::NOT_FOUND, format!("astre inconnu : {}", requete.id)).into_response()
    })?;
    let pas_ms = requete.step_minutes * 60_000.0;
    if !(pas_ms.is_finite() && pas_ms > 0.0) {
        return Err((StatusCode::BAD_REQUEST, "le pas doit être positif".to_string()).into_response());
    }
    if requete.to_ms < requete.from_ms {
        return Err((StatusCode::BAD_REQUEST, "toMs doit être supérieur ou égal à fromMs".to_string()).into_response());
    }
    let points = kepler::state_table(astre, requete.from_ms, requete.to_ms, pas_ms)
        .map_err(erreur_kepler)?;
    Ok(Json(json!({
        "id": astre.id,
        "fromMs": requete.from_ms,
        "toMs": requete.to_ms,
        "stepMinutes": requete.step_minutes,
        "points": points,
    })))
}

async fn positions(
    Query(requete): Query<kepler::PositionsQuery>,
) -> Result<Json<Value>, Response> {
    let t = requete.t.unwrap_or_else(|| {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as f64)
            .unwrap_or(kepler::TT_MINUS_UTC_S.into())
    });
    let selection: Vec<&catalog::Astre> = match requete.ids.as_deref() {
        Some(ids) => ids
            .split(',')
            .map(str::trim)
            .filter(|id| !id.is_empty())
            .filter_map(catalog::astre_par_id)
            .collect(),
        None => catalog::astres().iter().collect(),
    };

    let mut inconnus: Vec<String> = Vec::new();
    if let Some(ids) = requete.ids.as_deref() {
        for id in ids.split(',').map(str::trim).filter(|id| !id.is_empty()) {
            if catalog::astre_par_id(id).is_none() {
                inconnus.push(id.to_string());
            }
        }
    }

    let mut etats = Vec::with_capacity(selection.len());
    for astre in selection {
        let etat = kepler::state_at(astre, t).map_err(erreur_kepler)?;
        let [x, y, z] = etat.position;
        etats.push(json!({
            "id": astre.id,
            "nom": astre.nom,
            "parent": astre.parent,
            "unit": match astre.kepler.unit {
                catalog::Unit::Au => "au",
                catalog::Unit::Km => "km",
            },
            "x": x,
            "y": y,
            "z": z,
            "distance": etat.distance,
            "eccentricAnomaly": etat.eccentric_anomaly,
            "trueAnomaly": etat.true_anomaly,
        }));
    }

    Ok(Json(json!({ "t": t, "astres": etats, "inconnus": inconnus })))
}
