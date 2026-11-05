// Étapes du Trek de la Terre : un tour du monde de sites remarquables vus d'en haut.
// altitudeKm : hauteur de vue conseillée ; layer : fond qui met le mieux le site en valeur.

export interface EarthTrekStop {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  altitudeKm: number;
  layer: string;
  blurb: string;
}

export const EARTH_TREK_STOPS: EarthTrekStop[] = [
  { id: 'paris', name: 'Paris', country: 'France', lat: 48.8584, lon: 2.2945, altitudeKm: 3, layer: 'mapbox-satellite-streets', blurb: 'Le Champ-de-Mars et la tour Eiffel, au bord de la Seine.' },
  { id: 'mont-saint-michel', name: 'Mont-Saint-Michel', country: 'France', lat: 48.6361, lon: -1.5115, altitudeKm: 4, layer: 'esri-world-imagery', blurb: 'L’abbaye sur son îlot, au milieu de la baie aux grandes marées.' },
  { id: 'venise', name: 'Venise', country: 'Italie', lat: 45.434, lon: 12.3388, altitudeKm: 5, layer: 'esri-world-imagery', blurb: 'La ville sur la lagune, traversée par le Grand Canal.' },
  { id: 'santorin', name: 'Santorin', country: 'Grèce', lat: 36.4618, lon: 25.3753, altitudeKm: 12, layer: 'maxar-vivid', blurb: 'La caldeira d’un volcan effondré, bordée de falaises blanches.' },
  { id: 'gizeh', name: 'Pyramides de Gizeh', country: 'Égypte', lat: 29.9792, lon: 31.1342, altitudeKm: 3, layer: 'maxar-vivid', blurb: 'Khéops, Khéphren et Mykérinos, à la lisière du désert et du Caire.' },
  { id: 'petra', name: 'Pétra', country: 'Jordanie', lat: 30.3285, lon: 35.4444, altitudeKm: 4, layer: 'esri-world-imagery', blurb: 'La cité nabatéenne taillée dans les grès roses.' },
  { id: 'palm-jumeirah', name: 'Palm Jumeirah', country: 'Émirats arabes unis', lat: 25.1124, lon: 55.139, altitudeKm: 12, layer: 'mapbox-satellite', blurb: 'L’île artificielle en forme de palmier, au large de Dubaï.' },
  { id: 'taj-mahal', name: 'Taj Mahal', country: 'Inde', lat: 27.1751, lon: 78.0421, altitudeKm: 3, layer: 'esri-world-imagery', blurb: 'Le mausolée de marbre et ses jardins, sur la rive de la Yamuna.' },
  { id: 'everest', name: 'Mont Everest', country: 'Népal / Chine', lat: 27.9881, lon: 86.925, altitudeKm: 25, layer: 'esri-world-imagery', blurb: 'Le plus haut sommet du monde et les glaciers du Khumbu.' },
  { id: 'grande-muraille', name: 'Grande Muraille (Mutianyu)', country: 'Chine', lat: 40.4319, lon: 116.5704, altitudeKm: 5, layer: 'esri-world-imagery', blurb: 'La muraille suit les crêtes boisées au nord de Pékin.' },
  { id: 'tokyo', name: 'Tokyo', country: 'Japon', lat: 35.6595, lon: 139.7005, altitudeKm: 4, layer: 'mapbox-satellite-streets', blurb: 'Le carrefour de Shibuya, au cœur de la plus grande agglomération du monde.' },
  { id: 'sydney', name: 'Sydney', country: 'Australie', lat: -33.8568, lon: 151.2153, altitudeKm: 4, layer: 'mapbox-satellite', blurb: 'L’Opéra et le Harbour Bridge, sur la baie de Port Jackson.' },
  { id: 'whitehaven', name: 'Whitehaven Beach', country: 'Australie', lat: -20.2823, lon: 149.0389, altitudeKm: 10, layer: 'maxar-vivid', blurb: 'Sable de silice et eaux turquoise des îles Whitsunday.' },
  { id: 'uluru', name: 'Uluru', country: 'Australie', lat: -25.3444, lon: 131.0369, altitudeKm: 12, layer: 'esri-world-imagery', blurb: 'Le monolithe de grès rouge au centre du continent.' },
  { id: 'kilimandjaro', name: 'Kilimandjaro', country: 'Tanzanie', lat: -3.0674, lon: 37.3556, altitudeKm: 30, layer: 'esri-world-imagery', blurb: 'Le volcan isolé et son cratère enneigé au-dessus de la savane.' },
  { id: 'victoria', name: 'Chutes Victoria', country: 'Zambie / Zimbabwe', lat: -17.9243, lon: 25.8572, altitudeKm: 6, layer: 'esri-world-imagery', blurb: 'Le Zambèze plonge dans une gorge longue de près de deux kilomètres.' },
  { id: 'le-cap', name: 'Le Cap', country: 'Afrique du Sud', lat: -33.9628, lon: 18.4098, altitudeKm: 15, layer: 'mapbox-satellite', blurb: 'La montagne de la Table domine la ville et la baie.' },
  { id: 'rio', name: 'Rio de Janeiro', country: 'Brésil', lat: -22.9486, lon: -43.1566, altitudeKm: 10, layer: 'mapbox-satellite', blurb: 'Le Pain de Sucre, Copacabana et la baie de Guanabara.' },
  { id: 'machu-picchu', name: 'Machu Picchu', country: 'Pérou', lat: -13.1631, lon: -72.545, altitudeKm: 4, layer: 'esri-world-imagery', blurb: 'La cité inca accrochée à une crête des Andes.' },
  { id: 'perito-moreno', name: 'Glacier Perito Moreno', country: 'Argentine', lat: -50.4967, lon: -73.1377, altitudeKm: 18, layer: 'maxar-vivid', blurb: 'Un front de glace de cinq kilomètres sur le lac Argentino.' },
  { id: 'grand-canyon', name: 'Grand Canyon', country: 'États-Unis', lat: 36.0544, lon: -112.1401, altitudeKm: 20, layer: 'esri-world-imagery', blurb: 'Le Colorado a creusé plus d’un kilomètre de couches géologiques.' },
  { id: 'new-york', name: 'New York', country: 'États-Unis', lat: 40.7829, lon: -73.9654, altitudeKm: 8, layer: 'mapbox-satellite-streets', blurb: 'Central Park, rectangle vert au milieu de la grille de Manhattan.' },
  { id: 'jokulsarlon', name: 'Jökulsárlón', country: 'Islande', lat: 64.0784, lon: -16.2306, altitudeKm: 10, layer: 'esri-world-imagery', blurb: 'Une lagune où dérivent les icebergs du Vatnajökull.' },
  { id: 'lofoten', name: 'Îles Lofoten', country: 'Norvège', lat: 67.9323, lon: 13.0889, altitudeKm: 12, layer: 'esri-world-imagery', blurb: 'Villages de pêcheurs et sommets plongeant dans la mer de Norvège.' },
];
