//! Moteur képlérien porté en Rust depuis `frontend/src/Car/SystemeEngine/data/astronomy/ephemeris/kepler-orbits.ts`.
//! Même algorithme : anomalie moyenne, équation de Kepler (Newton amorti), rotations ω, i, Ω,
//! puis passage du plan de référence vers l'écliptique J2000.

use crate::catalog::{Astre, KeplerElements, Unit};
use serde::{Deserialize, Serialize};

pub const TT_MINUS_UTC_S: f64 = 69.184;

const DEG: f64 = std::f64::consts::PI / 180.0;
const J2000_MS: f64 = 946_728_000_000.0;
const OBLIQUITY: f64 = 23.439_291_1 * DEG;
const LAPLACE_FAR_KM: f64 = 1_000_000.0;
const GM_SUN_AU3_DAY2: f64 = 0.017_202_098_95 * 0.017_202_098_95;
const DAYS_PER_CENTURY: f64 = 36_525.0;
const MS_PER_DAY: f64 = 86_400_000.0;
const SECONDS_PER_DAY: f64 = 86_400.0;

fn gm_km3_s2(parent: &str) -> Option<f64> {
    let gm = match parent {
        "earth" => 403_503.24,
        "mars" => 42_828.37,
        "jupiter" => 126_686_534.0,
        "saturn" => 37_931_187.0,
        "uranus" => 5_793_939.0,
        "neptune" => 6_836_529.0,
        "pluto" => 975.5,
        _ => return None,
    };
    Some(gm)
}

fn pole(parent: &str) -> Option<(f64, f64)> {
    let pole = match parent {
        "mars" => (317.681, 52.887),
        "jupiter" => (268.057, 64.495),
        "saturn" => (40.589, 83.537),
        "uranus" => (257.311, -15.175),
        "neptune" => (299.36, 43.46),
        "pluto" => (132.993, -6.163),
        _ => return None,
    };
    Some(pole)
}

pub type Vec3 = [f64; 3];

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct OrbitalState {
    pub position: Vec3,
    pub velocity: Vec3,
    pub distance: f64,
    pub eccentric_anomaly: f64,
    pub true_anomaly: f64,
}

#[derive(Debug, Clone, Copy, Serialize)]
pub struct StatePoint {
    pub t: f64,
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug)]
pub enum KeplerError {
    MeanMotionInconnu(String),
    PoleInconnu(String),
    NonConvergence { residu: f64 },
    HorsDomaine(String),
}

impl std::fmt::Display for KeplerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            KeplerError::MeanMotionInconnu(parent) => write!(f, "GM inconnu pour {parent}"),
            KeplerError::PoleInconnu(parent) => write!(f, "Pôle inconnu pour {parent}"),
            KeplerError::NonConvergence { residu } => {
                write!(f, "L'équation de Kepler n'a pas convergé (résidu={residu})")
            }
            KeplerError::HorsDomaine(message) => write!(f, "{message}"),
        }
    }
}

impl std::error::Error for KeplerError {}

/// Moyen mouvement en radians par jour.
pub fn mean_motion(astre: &Astre) -> Result<f64, KeplerError> {
    let k = &astre.kepler;
    if let Some(m_dot) = k.m_dot {
        return Ok((m_dot * DEG) / DAYS_PER_CENTURY);
    }
    if k.unit == Unit::Au {
        return Ok((GM_SUN_AU3_DAY2 / k.a.powi(3)).sqrt());
    }
    let gm = gm_km3_s2(&astre.parent)
        .ok_or_else(|| KeplerError::MeanMotionInconnu(astre.parent.to_string()))?;
    Ok((gm / k.a.powi(3)).sqrt() * SECONDS_PER_DAY)
}

/// Période orbitale en jours.
pub fn period_days(astre: &Astre) -> Result<f64, KeplerError> {
    Ok(2.0 * std::f64::consts::PI / mean_motion(astre)?)
}

/// Résout E − e·sin(E) = M pour une orbite elliptique ; entrées en radians.
pub fn solve_kepler(m: f64, e: f64, tolerance: f64, max_iterations: u32) -> Result<f64, KeplerError> {
    if !m.is_finite() {
        return Err(KeplerError::HorsDomaine("Anomalie moyenne non finie".into()));
    }
    if !e.is_finite() || !(0.0..1.0).contains(&e) {
        return Err(KeplerError::HorsDomaine(
            "L'excentricité elliptique doit être comprise entre 0 inclus et 1 exclu".into(),
        ));
    }
    if !tolerance.is_finite() || tolerance <= 0.0 {
        return Err(KeplerError::HorsDomaine(
            "La tolérance doit être strictement positive".into(),
        ));
    }
    if max_iterations < 1 {
        return Err(KeplerError::HorsDomaine(
            "Le nombre maximal d'itérations doit être un entier positif".into(),
        ));
    }

    let m = m.sin().atan2(m.cos());
    let mut e_anomaly = if e < 0.8 { m } else { m + 0.85 * e * (if m == 0.0 { 1.0 } else { m.signum() }) };

    for _ in 0..max_iterations {
        let denominator = 1.0 - e * e_anomaly.cos();
        let correction = (e_anomaly - e * e_anomaly.sin() - m) / denominator;
        let bounded = correction.clamp(-1.0, 1.0);
        e_anomaly -= bounded;
        if bounded.abs() <= tolerance {
            return Ok(e_anomaly);
        }
    }

    let residu = e_anomaly - e * e_anomaly.sin() - m;
    if residu.abs() <= tolerance * 10.0 {
        return Ok(e_anomaly);
    }
    Err(KeplerError::NonConvergence { residu })
}

fn rotate_orbital_vector(k: &KeplerElements, x: f64, y: f64) -> Vec3 {
    let (o, w, i) = (k.om * DEG, k.w * DEG, k.i * DEG);
    let (c_o, s_o) = (o.cos(), o.sin());
    let (c_w, s_w) = (w.cos(), w.sin());
    let (c_i, s_i) = (i.cos(), i.sin());
    [
        (c_o * c_w - s_o * s_w * c_i) * x + (-c_o * s_w - s_o * c_w * c_i) * y,
        (s_o * c_w + c_o * s_w * c_i) * x + (-s_o * s_w + c_o * c_w * c_i) * y,
        s_w * s_i * x + c_w * s_i * y,
    ]
}

/// État képlérien dans le plan orbital puis tourné dans le repère défini par k.
pub fn orbital_state(k: &KeplerElements, m: f64, n: f64) -> Result<OrbitalState, KeplerError> {
    if !k.a.is_finite() || k.a <= 0.0 {
        return Err(KeplerError::HorsDomaine(
            "Le demi-grand axe doit être positif et fini".into(),
        ));
    }
    if !n.is_finite() || n <= 0.0 {
        return Err(KeplerError::HorsDomaine(
            "Le moyen mouvement doit être positif et fini".into(),
        ));
    }

    let e_anomaly = solve_kepler(m, k.e, 1e-13, 64)?;
    let (cos_e, sin_e) = (e_anomaly.cos(), e_anomaly.sin());
    let beta = (1.0 - k.e * k.e).sqrt();
    let denominator = 1.0 - k.e * cos_e;
    let distance = k.a * denominator;
    let position = rotate_orbital_vector(k, k.a * (cos_e - k.e), k.a * beta * sin_e);
    let velocity_factor = (k.a * n) / denominator;
    let velocity = rotate_orbital_vector(k, -velocity_factor * sin_e, velocity_factor * beta * cos_e);
    let true_anomaly = 2.0
        * ((1.0 + k.e).sqrt() * (e_anomaly / 2.0).sin())
            .atan2((1.0 - k.e).sqrt() * (e_anomaly / 2.0).cos());

    Ok(OrbitalState {
        position,
        velocity,
        distance,
        eccentric_anomaly: e_anomaly,
        true_anomaly,
    })
}

/// Position dans le plan de référence de l'orbite (unités de a).
#[allow(dead_code)]
pub fn orbital_position(k: &KeplerElements, m: f64) -> Result<Vec3, KeplerError> {
    Ok(orbital_state(k, m, 1.0)?.position)
}

fn planet_equator_to_icrf(p: Vec3, parent: &str, pole_override: Option<(f64, f64)>) -> Result<Vec3, KeplerError> {
    let pole = pole_override.or_else(|| pole(parent)).ok_or_else(|| KeplerError::PoleInconnu(parent.to_string()))?;
    let (a, d) = (pole.0 * DEG, pole.1 * DEG);
    let p_axis: Vec3 = [d.cos() * a.cos(), d.cos() * a.sin(), d.sin()];
    let q_axis: Vec3 = [-a.sin(), a.cos(), 0.0];
    let y_axis: Vec3 = [
        p_axis[1] * q_axis[2] - p_axis[2] * q_axis[1],
        p_axis[2] * q_axis[0] - p_axis[0] * q_axis[2],
        p_axis[0] * q_axis[1] - p_axis[1] * q_axis[0],
    ];
    Ok([
        p[0] * q_axis[0] + p[1] * y_axis[0] + p[2] * p_axis[0],
        p[0] * q_axis[1] + p[1] * y_axis[1] + p[2] * p_axis[1],
        p[0] * q_axis[2] + p[1] * y_axis[2] + p[2] * p_axis[2],
    ])
}

fn icrf_to_ecliptic(p: Vec3) -> Vec3 {
    [
        p[0],
        p[1] * OBLIQUITY.cos() + p[2] * OBLIQUITY.sin(),
        -p[1] * OBLIQUITY.sin() + p[2] * OBLIQUITY.cos(),
    ]
}

/// Plan de référence `frame` → écliptique J2000.
pub fn to_ecliptic(p: Vec3, astre: &Astre) -> Result<Vec3, KeplerError> {
    let frame = &astre.kepler.frame;
    if *frame == "ecliptic" {
        return Ok(p);
    }
    let laplace = frame.ends_with("-laplace");
    if laplace {
        if let Some(pole_icrf) = astre.kepler.reference_pole_icrf {
            return Ok(icrf_to_ecliptic(planet_equator_to_icrf(p, &astre.parent, Some(pole_icrf))?));
        }
        if astre.kepler.a > LAPLACE_FAR_KM {
            return Ok(p);
        }
    }
    Ok(icrf_to_ecliptic(planet_equator_to_icrf(p, &astre.parent, None)?))
}

/// État képlérien à un instant UTC (ms). Vitesses dans l'unité de distance par jour.
pub fn state_at(astre: &Astre, ms: f64) -> Result<OrbitalState, KeplerError> {
    if !ms.is_finite() {
        return Err(KeplerError::HorsDomaine("Instant UTC invalide".into()));
    }
    let days = (ms - J2000_MS) / MS_PER_DAY + TT_MINUS_UTC_S / SECONDS_PER_DAY;
    let t = days / DAYS_PER_CENTURY;
    let k = &astre.kepler;
    let n = mean_motion(astre)?;
    let m = match k.m_dot {
        Some(m_dot) => (k.m0 + m_dot * t) * DEG,
        None => k.m0 * DEG + n * days,
    };
    let mut local_elements = k.clone();
    local_elements.om = k.om + k.om_dot.unwrap_or(0.0) * t;
    local_elements.w = k.w + k.w_dot.unwrap_or(0.0) * t;
    let local = orbital_state(&local_elements, m, n)?;
    Ok(OrbitalState {
        position: to_ecliptic(local.position, astre)?,
        velocity: to_ecliptic(local.velocity, astre)?,
        ..local
    })
}

/// Position écliptique J2000 à l'instant ms (UTC), en km ou UA selon l'astre.
pub fn position_at(astre: &Astre, ms: f64) -> Result<Vec3, KeplerError> {
    Ok(state_at(astre, ms)?.position)
}

/// Table de positions au pas régulier ; `from_ms`, `to_ms`, `step` en millisecondes.
pub fn state_table(
    astre: &Astre,
    from_ms: f64,
    to_ms: f64,
    step_ms: f64,
) -> Result<Vec<StatePoint>, KeplerError> {
    let mut out = Vec::new();
    let mut t = from_ms;
    while t <= to_ms {
        let [x, y, z] = position_at(astre, t)?;
        out.push(StatePoint { t, x, y, z });
        t += step_ms;
    }
    Ok(out)
}

#[derive(Debug, Deserialize)]
pub struct PositionsQuery {
    pub ids: Option<String>,
    pub t: Option<f64>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::astres;

    fn find(id: &str) -> &'static Astre {
        astres().iter().find(|a| a.id == id).expect("astre inconnu")
    }

    #[test]
    fn kepler_converge_pour_excentricite_moyenne() {
        let e = solve_kepler(2.5, 0.5, 1e-13, 64).expect("convergence");
        let residu = e - 0.5 * e.sin() - 2.5_f64.sin().atan2(2.5_f64.cos());
        assert!(residu.abs() < 1e-12);
    }

    #[test]
    fn terre_pres_du_perihelie_a_j2000() {
        let terre = find("earth");
        let position = position_at(terre, J2000_MS).expect("position");
        let distance_au = (position[0] * position[0] + position[1] * position[1] + position[2] * position[2]).sqrt();
        assert!((0.982..=0.985).contains(&distance_au), "distance = {distance_au} UA");
    }

    #[test]
    fn periode_terrestre_proche_de_l_annee_sidérale() {
        let periode = period_days(find("earth")).expect("période");
        assert!((365.0..=366.0).contains(&periode), "période = {periode} j");
    }

    #[test]
    fn periode_io_proche_de_la_valeur_jpl() {
        let periode = period_days(find("io")).expect("période");
        assert!((1.76..=1.78).contains(&periode), "période = {periode} j");
    }

    #[test]
    fn mercure_reste_sur_son_orbite_sur_un_siecle() {
        let mercure = find("mercury");
        let a_attendu = mercure.kepler.a;
        for annees in [0.0, 25.0, 50.0, 100.0] {
            let ms = J2000_MS + annees * 365.25 * MS_PER_DAY;
            let etat = state_at(mercure, ms).expect("état");
            assert!(
                (etat.distance - a_attendu * (1.0 - mercure.kepler.e)).abs() < 0.2
                    || etat.distance <= a_attendu * (1.0 + mercure.kepler.e),
                "distance = {}", etat.distance
            );
            assert!(etat.distance <= a_attendu * (1.0 + mercure.kepler.e) + 1e-9);
            assert!(etat.distance >= a_attendu * (1.0 - mercure.kepler.e) - 1e-9);
        }
    }

    #[test]
    fn table_d_etats_respecte_le_pas_demande() {
        let terre = find("earth");
        let table = state_table(terre, J2000_MS, J2000_MS + 3.0 * MS_PER_DAY, MS_PER_DAY).expect("table");
        assert_eq!(table.len(), 4);
        assert_eq!(table[0].t, J2000_MS);
        assert_eq!(table[3].t, J2000_MS + 3.0 * MS_PER_DAY);
    }
}
