# Atmosphere Engine — Astres solides

Atmosphères dessinées (diffusion de la lumière) et nuages simulés des planètes solides. Aucune source météo en direct n'est interrogée.

## Cumulonimbus (`cumulonimbus.jsx`)

Tours de convection coiffées d'une enclume, ajoutées aux nuages simulés de la Terre (shader `earthCloudFragmentShader`).
Modèle : processus de Wegener-Bergeron-Findeisen (la « théorie de Gazo » de la vidéo : gouttelettes liquides = boules bleues, cristal de glace = flocon) :
liquide de la base (1,5 km) à l'isotherme 0 °C (4,5 km), phase mixte jusqu'à −38 °C (≈ 10,8 km), glace seule au-dessus, enclume étirée vers l'est au sommet (12 km).
Cellules placées par latitude (zone de convergence intertropicale, rails de dépressions), entraînées par le même vent que la couverture.
`temperatureC`, `cumulonimbusPhase` et `convectiveWeight` sont testées (`cumulonimbus.test.jsx`).
