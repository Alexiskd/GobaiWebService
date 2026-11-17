//! Catalogue des astres porté en Rust depuis `frontend/src/Car/SystemeEngine/data/astronomy/data/kepler-elements.ts`.
//! Éléments képlériens moyens (source : JPL SSD Planetary Satellite Mean Elements).

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Unit {
    Au,
    Km,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Type {
    Planet,
    Satellite,
}

#[derive(Debug, Clone, Serialize)]
pub struct KeplerElements {
    pub a: f64,
    pub e: f64,
    pub i: f64,
    pub om: f64,
    pub w: f64,
    #[serde(rename = "M0")]
    pub m0: f64,
    pub unit: Unit,
    pub frame: &'static str,
    #[serde(rename = "referencePoleIcrf", skip_serializing_if = "Option::is_none")]
    pub reference_pole_icrf: Option<(f64, f64)>,
    #[serde(rename = "sourceReference", skip_serializing_if = "Option::is_none")]
    pub source_reference: Option<&'static str>,
    #[serde(rename = "epochTdb", skip_serializing_if = "Option::is_none")]
    pub epoch_tdb: Option<&'static str>,
    #[serde(rename = "omDot", skip_serializing_if = "Option::is_none")]
    pub om_dot: Option<f64>,
    #[serde(rename = "wDot", skip_serializing_if = "Option::is_none")]
    pub w_dot: Option<f64>,
    #[serde(rename = "MDot", skip_serializing_if = "Option::is_none")]
    pub m_dot: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Astre {
    pub id: &'static str,
    pub nom: &'static str,
    #[serde(rename = "type")]
    pub kind: Type,
    pub parent: &'static str,
    pub horizons: bool,
    pub trek: bool,
    pub ready: bool,
    pub kepler: KeplerElements,
}

const fn elements(
    a: f64,
    e: f64,
    i: f64,
    om: f64,
    w: f64,
    m0: f64,
    unit: Unit,
    frame: &'static str,
) -> KeplerElements {
    KeplerElements {
        a,
        e,
        i,
        om,
        w,
        m0,
        unit,
        frame,
        reference_pole_icrf: None,
        source_reference: None,
        epoch_tdb: None,
        om_dot: None,
        w_dot: None,
        m_dot: None,
    }
}

const fn satellite(parent: &'static str, id: &'static str, nom: &'static str, kepler: KeplerElements) -> Astre {
    Astre {
        id,
        nom,
        kind: Type::Satellite,
        parent,
        horizons: true,
        trek: false,
        ready: false,
        kepler,
    }
}

const fn with_pole(mut k: KeplerElements, pole: (f64, f64)) -> KeplerElements {
    k.reference_pole_icrf = Some(pole);
    k
}

const fn with_source(mut k: KeplerElements, source: &'static str, epoch: &'static str) -> KeplerElements {
    k.source_reference = Some(source);
    k.epoch_tdb = Some(epoch);
    k
}

/// Table des astres : les neuf planètes, puis les satellites.
pub fn astres() -> &'static [Astre] {
    &ASTRES
}

pub fn astre_par_id(id: &str) -> Option<&'static Astre> {
    astres().iter().find(|a| a.id == id)
}

static ASTRES: &[Astre] = &[
    Astre {
        id: "mercury",
        nom: "Mercure",
        kind: Type::Planet,
        parent: "",
        horizons: true,
        trek: true,
        ready: true,
        kepler: elements(0.38709927, 0.20563593, 7.00497902, 48.33076593, 29.12703035, 174.79252722, Unit::Au, "ecliptic"),
    },
    Astre {
        id: "venus",
        nom: "Vénus",
        kind: Type::Planet,
        parent: "",
        horizons: true,
        trek: true,
        ready: true,
        kepler: elements(0.72333566, 0.00677672, 3.39467605, 76.67984255, 54.92262463, 50.37663232, Unit::Au, "ecliptic"),
    },
    Astre {
        id: "earth",
        nom: "Terre",
        kind: Type::Planet,
        parent: "",
        horizons: true,
        trek: true,
        ready: true,
        kepler: elements(1.00000261, 0.01671123, -0.00001531, 0.0, 102.93768193, 357.52688973, Unit::Au, "ecliptic"),
    },
    Astre {
        id: "mars",
        nom: "Mars",
        kind: Type::Planet,
        parent: "",
        horizons: true,
        trek: true,
        ready: true,
        kepler: elements(1.52371034, 0.09339410, 1.84969142, 49.55953891, 286.49683150, 19.39019754, Unit::Au, "ecliptic"),
    },
    Astre {
        id: "jupiter",
        nom: "Jupiter",
        kind: Type::Planet,
        parent: "",
        horizons: false,
        trek: false,
        ready: false,
        kepler: elements(5.20288700, 0.04838624, 1.30439695, 100.47390909, 274.25457074, 19.66796068, Unit::Au, "ecliptic"),
    },
    Astre {
        id: "saturn",
        nom: "Saturne",
        kind: Type::Planet,
        parent: "",
        horizons: true,
        trek: false,
        ready: false,
        kepler: elements(9.53667594, 0.05386179, 2.48599187, 113.66242448, 338.93645383, 317.35536592, Unit::Au, "ecliptic"),
    },
    Astre {
        id: "uranus",
        nom: "Uranus",
        kind: Type::Planet,
        parent: "",
        horizons: false,
        trek: false,
        ready: false,
        kepler: elements(19.18916464, 0.04725744, 0.77263783, 74.01692503, 96.93735127, 142.28382821, Unit::Au, "ecliptic"),
    },
    Astre {
        id: "neptune",
        nom: "Neptune",
        kind: Type::Planet,
        parent: "",
        horizons: false,
        trek: false,
        ready: false,
        kepler: elements(30.06992276, 0.00859048, 1.77004347, 131.78422574, 273.18053653, 259.91520804, Unit::Au, "ecliptic"),
    },
    Astre {
        id: "pluto",
        nom: "Pluton",
        kind: Type::Planet,
        parent: "",
        horizons: true,
        trek: false,
        ready: false,
        kepler: elements(39.571, 0.24944850, 17.23565302, 110.03993995, 115.17866598, 14.14365454, Unit::Au, "ecliptic"),
    },
    satellite("jupiter", "io", "Io", with_pole(elements(421800.0, 0.004, 0.0, 0.0, 49.1, 330.9, Unit::Km, "jupiter-laplace"), (268.1, 64.5))),
    satellite("jupiter", "europa", "Europe", with_pole(elements(671100.0, 0.009, 0.5, 184.0, 45.0, 345.4, Unit::Km, "jupiter-laplace"), (268.1, 64.5))),
    satellite("jupiter", "ganymede", "Ganymède", with_pole(elements(1070400.0, 0.001, 0.2, 58.5, 198.3, 324.8, Unit::Km, "jupiter-laplace"), (268.1, 64.5))),
    satellite("jupiter", "callisto", "Callisto", with_pole(elements(1882700.0, 0.007, 0.3, 309.1, 43.8, 87.4, Unit::Km, "jupiter-laplace"), (268.1, 64.5))),
    satellite("saturn", "mimas", "Mimas", with_pole(elements(186000.0, 0.020, 1.6, 66.2, 160.4, 275.3, Unit::Km, "saturn-laplace"), (40.6, 83.5))),
    satellite("saturn", "enceladus", "Encelade", with_pole(elements(238400.0, 0.005, 0.0, 0.0, 119.5, 57.0, Unit::Km, "saturn-laplace"), (40.6, 83.5))),
    satellite("saturn", "tethys", "Téthys", with_pole(elements(295000.0, 0.001, 1.1, 273.0, 335.3, 0.0, Unit::Km, "saturn-laplace"), (40.6, 83.5))),
    satellite("saturn", "dione", "Dioné", with_pole(elements(377700.0, 0.002, 0.0, 0.0, 116.0, 212.0, Unit::Km, "saturn-laplace"), (40.6, 83.5))),
    satellite("saturn", "rhea", "Rhéa", with_pole(elements(527200.0, 0.001, 0.3, 133.7, 44.3, 31.5, Unit::Km, "saturn-laplace"), (40.6, 83.5))),
    satellite("saturn", "titan", "Titan", with_pole(elements(1221900.0, 0.029, 0.3, 78.6, 78.3, 11.7, Unit::Km, "saturn-laplace"), (36.4, 84.0))),
    satellite("saturn", "iapetus", "Japet", with_pole(elements(3561700.0, 0.028, 7.6, 86.5, 254.5, 74.8, Unit::Km, "saturn-laplace"), (288.7, 78.9))),
    satellite("uranus", "miranda", "Miranda", elements(129872.0, 0.00150980, 175.572234, 259.171287, 344.673011, 62.061891, Unit::Km, "uranus-equatorial")),
    satellite("uranus", "ariel", "Ariel", elements(190941.0, 0.00152081, 179.997279, 150.621428, 21.036938, 152.794368, Unit::Km, "uranus-equatorial")),
    satellite("uranus", "umbriel", "Umbriel", elements(266012.0, 0.00417017, 179.943636, 166.348704, 326.360127, 271.223379, Unit::Km, "uranus-equatorial")),
    satellite("uranus", "titania", "Titania", elements(436293.0, 0.00247900, 179.899284, 11.436396, 38.615690, 74.416776, Unit::Km, "uranus-equatorial")),
    satellite("uranus", "oberon", "Obéron", elements(583550.0, 0.00055232, 179.811951, 319.956156, 39.006728, 93.496291, Unit::Km, "uranus-equatorial")),
    satellite("neptune", "triton", "Triton", with_source(elements(354800.0, 0.000, 157.3, 177.7, 0.0, 63.0, Unit::Km, "neptune-equatorial"), "JPL NEP098", "2000-01-01.5")),
    satellite("pluto", "charon", "Charon", with_source(elements(19600.0, 0.000, 0.0, 0.0, 0.0, 304.1, Unit::Km, "pluto-equatorial"), "JPL PLU060", "2000-01-01.5")),
    satellite("mars", "phobos", "Phobos", with_pole(elements(9375.0, 0.015, 1.1, 169.2, 216.3, 189.7, Unit::Km, "mars-laplace"), (317.7, 52.9))),
    satellite("mars", "deimos", "Deimos", with_pole(elements(23457.0, 0.000, 1.8, 54.3, 0.0, 205.0, Unit::Km, "mars-laplace"), (316.6, 53.5))),
    satellite("jupiter", "amalthea", "Amalthée", with_pole(elements(181400.0, 0.003, 0.4, 282.9, 180.1, 310.6, Unit::Km, "jupiter-laplace"), (268.1, 64.5))),
    satellite("jupiter", "himalia", "Himalia", elements(11439000.0, 0.160, 28.4, 64.2, 321.1, 78.3, Unit::Km, "ecliptic")),
    satellite("jupiter", "thebe", "Thébé", with_pole(elements(221900.0, 0.018, 1.1, 340.4, 26.6, 182.1, Unit::Km, "jupiter-laplace"), (268.1, 64.5))),
    satellite("saturn", "hyperion", "Hypérion", with_pole(elements(1481500.0, 0.105, 0.6, 87.1, 214.0, 122.9, Unit::Km, "saturn-laplace"), (40.2, 83.6))),
    satellite("saturn", "phoebe", "Phœbé", with_pole(elements(12929400.0, 0.164, 175.2, 192.7, 240.3, 308.0, Unit::Km, "saturn-laplace"), (276.0, 67.5))),
    satellite("saturn", "janus", "Janus", with_pole(elements(151500.0, 0.007, 0.2, 159.9, 11.1, 111.7, Unit::Km, "saturn-laplace"), (40.6, 83.5))),
    satellite("saturn", "epimetheus", "Épiméthée", with_pole(elements(151400.0, 0.020, 0.3, 189.8, 96.3, 197.2, Unit::Km, "saturn-laplace"), (40.6, 83.5))),
    satellite("uranus", "puck", "Puck", with_source(elements(86004.0, 0.000, 0.3, 216.1, 0.0, 50.1, Unit::Km, "uranus-equatorial"), "JPL URA182", "2000-01-01.5")),
    satellite("neptune", "proteus", "Protée", with_source(elements(117700.0, 0.001, 0.6, 355.5, 357.2, 297.4, Unit::Km, "neptune-equatorial"), "JPL NEP098", "2000-01-01.5")),
    satellite("neptune", "nereid", "Néréide", with_source(elements(5513900.0, 0.751, 5.1, 319.5, 296.8, 318.5, Unit::Km, "ecliptic"), "JPL NEP105", "2020-01-01.0")),
    satellite("pluto", "nix", "Nix", with_source(elements(49300.0, 0.015, 0.0, 0.0, 31.4, 338.2, Unit::Km, "pluto-equatorial"), "JPL PLU060", "2000-01-01.5")),
    satellite("pluto", "hydra", "Hydra", with_source(elements(65200.0, 0.009, 0.3, 114.3, 139.3, 335.0, Unit::Km, "pluto-equatorial"), "JPL PLU060", "2000-01-01.5")),
    satellite("pluto", "kerberos", "Kerberos", with_source(elements(58300.0, 0.010, 0.4, 314.3, 32.1, 276.1, Unit::Km, "pluto-equatorial"), "JPL PLU060", "2000-01-01.5")),
    satellite("pluto", "styx", "Styx", with_source(elements(43200.0, 0.025, 0.0, 0.0, 322.5, 358.1, Unit::Km, "pluto-equatorial"), "JPL PLU060", "2000-01-01.5")),
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn le_catalogue_contient_les_neuf_planetes() {
        let planetes = astres().iter().filter(|a| a.kind == Type::Planet).count();
        assert_eq!(planetes, 9);
    }

    #[test]
    fn chaque_satellite_a_un_parent_connu() {
        for astre in astres().iter().filter(|a| a.kind == Type::Satellite) {
            assert!(
                astre_par_id(astre.parent).is_some(),
                "parent inconnu : {} pour {}",
                astre.parent,
                astre.id
            );
        }
    }

    #[test]
    fn les_identifiants_sont_uniques() {
        let mut ids: Vec<&str> = astres().iter().map(|a| a.id).collect();
        let total = ids.len();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), total);
    }

    #[test]
    fn chaque_satellite_laplace_a_un_pole_reference() {
        for astre in astres().iter().filter(|a| a.kepler.frame.ends_with("-laplace")) {
            assert!(
                astre.kepler.reference_pole_icrf.is_some() || astre.kepler.a > 1_000_000.0,
                "pôle de Laplace manquant pour {}",
                astre.id
            );
        }
    }

    #[test]
    fn les_poles_de_laplace_correspondent_au_catalogue_json() {
        let json: serde_json::Value = serde_json::from_str(
            include_str!("../data/laplace-poles.json"),
        )
        .expect("laplace-poles.json invalide");
        for astre in astres().iter().filter(|a| a.kepler.reference_pole_icrf.is_some()) {
            let attendu = &json["polesLaplace"][astre.parent][astre.id];
            assert!(attendu.is_array(), "pôle absent du JSON pour {}", astre.id);
            let pole = astre.kepler.reference_pole_icrf.unwrap();
            assert_eq!(pole.0, attendu[0].as_f64().unwrap());
            assert_eq!(pole.1, attendu[1].as_f64().unwrap());
        }
    }
}
