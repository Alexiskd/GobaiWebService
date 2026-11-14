// Points d'ancrage des noms de pays et territoires pour les étiquettes à plat sur l'écran
// (moteur : countryLabels.js). `name` est le nom français ; les pays d'écriture non latine
// sont rendus dans leur alphabet local via countryNativeNames.js.
// Source : Natural Earth 1:10m admin_0_countries (domaine public), LABEL_X/LABEL_Y et LABELRANK ; noms via Intl.DisplayNames.
// Sont retenus les pays et territoires dont le nom apparaît avant le zoom des villes (LABELRANK <= 5, MIN_LABEL <= 4.5).
// Les dépendances inhabitables ou minuscules (îles Heard-et-MacDonald, île Norfolk) sont écartées.
// lon/lat en degrés, rank = importance cartographique (2 = majeur). Ordre = priorité de placement.
// Déclare et exporte la liste des points d'ancrage des noms de pays (début).
export const COUNTRY_LABEL_POINTS = [
  // Chine : longitude 106,337°, latitude 32,498°, rang 2.
  {"name":"Chine","lon":106.337,"lat":32.498,"rank":2},
  // Inde : longitude 79,358°, latitude 22,687°, rang 2.
  {"name":"Inde","lon":79.358,"lat":22.687,"rank":2},
  // États-Unis : longitude −97,483°, latitude 39,538°, rang 2.
  {"name":"États-Unis","lon":-97.483,"lat":39.538,"rank":2},
  // Indonésie : longitude 101,893°, latitude −0,954°, rang 2.
  {"name":"Indonésie","lon":101.893,"lat":-0.954,"rank":2},
  // Brésil : longitude −49,559°, latitude −12,099°, rang 2.
  {"name":"Brésil","lon":-49.559,"lat":-12.099,"rank":2},
  // Nigeria : longitude 7,503°, latitude 9,44°, rang 2.
  {"name":"Nigeria","lon":7.503,"lat":9.44,"rank":2},
  // Russie : longitude 44,686°, latitude 58,249°, rang 2.
  {"name":"Russie","lon":44.686,"lat":58.249,"rank":2},
  // Japon : longitude 138,442°, latitude 36,143°, rang 2.
  {"name":"Japon","lon":138.442,"lat":36.143,"rank":2},
  // Égypte : longitude 29,446°, latitude 26,186°, rang 2.
  {"name":"Égypte","lon":29.446,"lat":26.186,"rank":2},
  // Allemagne : longitude 9,678°, latitude 50,962°, rang 2.
  {"name":"Allemagne","lon":9.678,"lat":50.962,"rank":2},
  // France : longitude 2,552°, latitude 46,696°, rang 2.
  {"name":"France","lon":2.552,"lat":46.696,"rank":2},
  // Royaume-Uni : longitude −2,116°, latitude 54,403°, rang 2.
  {"name":"Royaume-Uni","lon":-2.116,"lat":54.403,"rank":2},
  // Afrique du Sud : longitude 23,666°, latitude −29,709°, rang 2.
  {"name":"Afrique du Sud","lon":23.666,"lat":-29.709,"rank":2},
  // Kenya : longitude 37,908°, latitude 0,549°, rang 2.
  {"name":"Kenya","lon":37.908,"lat":0.549,"rank":2},
  // Canada : longitude −101,911°, latitude 60,324°, rang 2.
  {"name":"Canada","lon":-101.911,"lat":60.324,"rank":2},
  // Arabie saoudite : longitude 44,7°, latitude 23,807°, rang 2.
  {"name":"Arabie saoudite","lon":44.7,"lat":23.807,"rank":2},
  // Australie : longitude 134,05°, latitude −24,13°, rang 2.
  {"name":"Australie","lon":134.05,"lat":-24.13,"rank":2},
  // Chili : longitude −72,319°, latitude −38,152°, rang 2.
  {"name":"Chili","lon":-72.319,"lat":-38.152,"rank":2},
  // Mexique : longitude −102,289°, latitude 23,92°, rang 2.
  {"name":"Mexique","lon":-102.289,"lat":23.92,"rank":2},
  // Éthiopie : longitude 39,089°, latitude 8,033°, rang 2.
  {"name":"Éthiopie","lon":39.089,"lat":8.033,"rank":2},
  // Viêt Nam : longitude 105,387°, latitude 21,715°, rang 2.
  {"name":"Viêt Nam","lon":105.387,"lat":21.715,"rank":2},
  // Congo-Kinshasa : longitude 23,459°, latitude −1,858°, rang 2.
  {"name":"Congo-Kinshasa","lon":23.459,"lat":-1.858,"rank":2},
  // Turquie : longitude 34,508°, latitude 39,345°, rang 2.
  {"name":"Turquie","lon":34.508,"lat":39.345,"rank":2},
  // Italie : longitude 11,077°, latitude 44,732°, rang 2.
  {"name":"Italie","lon":11.077,"lat":44.732,"rank":2},
  // Espagne : longitude −3,465°, latitude 40,091°, rang 2.
  {"name":"Espagne","lon":-3.465,"lat":40.091,"rank":2},
  // Argentine : longitude −64,173°, latitude −33,501°, rang 2.
  {"name":"Argentine","lon":-64.173,"lat":-33.501,"rank":2},
  // Pérou : longitude −72,9°, latitude −12,977°, rang 2.
  {"name":"Pérou","lon":-72.9,"lat":-12.977,"rank":2},
  // Nouvelle-Zélande : longitude 172,787°, latitude −39,759°, rang 2.
  {"name":"Nouvelle-Zélande","lon":172.787,"lat":-39.759,"rank":2},
  // Philippines : longitude 122,465°, latitude 11,198°, rang 2.
  {"name":"Philippines","lon":122.465,"lat":11.198,"rank":2},
  // Iran : longitude 54,931°, latitude 32,166°, rang 2.
  {"name":"Iran","lon":54.931,"lat":32.166,"rank":2},
  // Corée du Sud : longitude 128,13°, latitude 36,385°, rang 2.
  {"name":"Corée du Sud","lon":128.13,"lat":36.385,"rank":2},
  // Papouasie-Nouvelle-Guinée : longitude 143,91°, latitude −5,695°, rang 2.
  {"name":"Papouasie-Nouvelle-Guinée","lon":143.91,"lat":-5.695,"rank":2},
  // Pakistan : longitude 68,546°, latitude 29,328°, rang 2.
  {"name":"Pakistan","lon":68.546,"lat":29.328,"rank":2},
  // Colombie : longitude −73,174°, latitude 3,373°, rang 2.
  {"name":"Colombie","lon":-73.174,"lat":3.373,"rank":2},
  // Portugal : longitude −8,272°, latitude 39,607°, rang 2.
  {"name":"Portugal","lon":-8.272,"lat":39.607,"rank":2},
  // Belgique : longitude 4,8°, latitude 50,785°, rang 2.
  {"name":"Belgique","lon":4.8,"lat":50.785,"rank":2},
  // Groenland : longitude −39,335°, latitude 74,319°, rang 3.
  {"name":"Groenland","lon":-39.335,"lat":74.319,"rank":3},
  // Suède : longitude 19,017°, latitude 65,859°, rang 3.
  {"name":"Suède","lon":19.017,"lat":65.859,"rank":3},
  // Islande : longitude −18,674°, latitude 64,779°, rang 3.
  {"name":"Islande","lon":-18.674,"lat":64.779,"rank":3},
  // Algérie : longitude 2,808°, latitude 27,397°, rang 3.
  {"name":"Algérie","lon":2.808,"lat":27.397,"rank":3},
  // Soudan : longitude 29,261°, latitude 16,331°, rang 3.
  {"name":"Soudan","lon":29.261,"lat":16.331,"rank":3},
  // Pologne : longitude 19,49°, latitude 51,99°, rang 3.
  {"name":"Pologne","lon":19.49,"lat":51.99,"rank":3},
  // Venezuela : longitude −64,599°, latitude 7,182°, rang 3.
  {"name":"Venezuela","lon":-64.599,"lat":7.182,"rank":3},
  // Côte d’Ivoire : longitude −5,569°, latitude 7,491°, rang 3.
  {"name":"Côte d’Ivoire","lon":-5.569,"lat":7.491,"rank":3},
  // Zimbabwe : longitude 29,925°, latitude −18,912°, rang 3.
  {"name":"Zimbabwe","lon":29.925,"lat":-18.912,"rank":3},
  // Thaïlande : longitude 101,073°, latitude 15,46°, rang 3.
  {"name":"Thaïlande","lon":101.073,"lat":15.46,"rank":3},
  // Ukraine : longitude 32,141°, latitude 49,725°, rang 3.
  {"name":"Ukraine","lon":32.141,"lat":49.725,"rank":3},
  // Maroc : longitude −7,187°, latitude 31,651°, rang 3.
  {"name":"Maroc","lon":-7.187,"lat":31.651,"rank":3},
  // Ghana : longitude −1,037°, latitude 7,718°, rang 3.
  {"name":"Ghana","lon":-1.037,"lat":7.718,"rank":3},
  // Madagascar : longitude 46,704°, latitude −18,628°, rang 3.
  {"name":"Madagascar","lon":46.704,"lat":-18.628,"rank":3},
  // Kazakhstan : longitude 68,686°, latitude 49,054°, rang 3.
  {"name":"Kazakhstan","lon":68.686,"lat":49.054,"rank":3},
  // Sénégal : longitude −14,779°, latitude 15,138°, rang 3.
  {"name":"Sénégal","lon":-14.779,"lat":15.138,"rank":3},
  // Cuba : longitude −77,976°, latitude 21,334°, rang 3.
  {"name":"Cuba","lon":-77.976,"lat":21.334,"rank":3},
  // Grèce : longitude 21,726°, latitude 39,493°, rang 3.
  {"name":"Grèce","lon":21.726,"lat":39.493,"rank":3},
  // Bangladesh : longitude 89,685°, latitude 24,215°, rang 3.
  {"name":"Bangladesh","lon":89.685,"lat":24.215,"rank":3},
  // Tanzanie : longitude 34,959°, latitude −6,052°, rang 3.
  {"name":"Tanzanie","lon":34.959,"lat":-6.052,"rank":3},
  // Myanmar : longitude 95,804°, latitude 21,574°, rang 3.
  {"name":"Myanmar","lon":95.804,"lat":21.574,"rank":3},
  // Ouganda : longitude 32,949°, latitude 1,973°, rang 3.
  {"name":"Ouganda","lon":32.949,"lat":1.973,"rank":3},
  // Irak : longitude 43,262°, latitude 33,094°, rang 3.
  {"name":"Irak","lon":43.262,"lat":33.094,"rank":3},
  // Afghanistan : longitude 66,497°, latitude 34,164°, rang 3.
  {"name":"Afghanistan","lon":66.497,"lat":34.164,"rank":3},
  // Ouzbékistan : longitude 64,005°, latitude 41,694°, rang 3.
  {"name":"Ouzbékistan","lon":64.005,"lat":41.694,"rank":3},
  // Malaisie : longitude 113,837°, latitude 2,529°, rang 3.
  {"name":"Malaisie","lon":113.837,"lat":2.529,"rank":3},
  // Angola : longitude 17,984°, latitude −12,183°, rang 3.
  {"name":"Angola","lon":17.984,"lat":-12.183,"rank":3},
  // Mozambique : longitude 37,838°, latitude −13,943°, rang 3.
  {"name":"Mozambique","lon":37.838,"lat":-13.943,"rank":3},
  // Yémen : longitude 45,874°, latitude 15,328°, rang 3.
  {"name":"Yémen","lon":45.874,"lat":15.328,"rank":3},
  // Népal : longitude 83,64°, latitude 28,298°, rang 3.
  {"name":"Népal","lon":83.64,"lat":28.298,"rank":3},
  // Cameroun : longitude 12,473°, latitude 4,585°, rang 3.
  {"name":"Cameroun","lon":12.473,"lat":4.585,"rank":3},
  // Corée du Nord : longitude 126,445°, latitude 39,885°, rang 3.
  {"name":"Corée du Nord","lon":126.445,"lat":39.885,"rank":3},
  // Niger : longitude 9,504°, latitude 17,446°, rang 3.
  {"name":"Niger","lon":9.504,"lat":17.446,"rank":3},
  // Sri Lanka : longitude 80,705°, latitude 7,581°, rang 3.
  {"name":"Sri Lanka","lon":80.705,"lat":7.581,"rank":3},
  // Burkina Faso : longitude −1,364°, latitude 12,673°, rang 3.
  {"name":"Burkina Faso","lon":-1.364,"lat":12.673,"rank":3},
  // Mali : longitude −2,038°, latitude 18,693°, rang 3.
  {"name":"Mali","lon":-2.038,"lat":18.693,"rank":3},
  // Roumanie : longitude 24,973°, latitude 45,733°, rang 3.
  {"name":"Roumanie","lon":24.973,"lat":45.733,"rank":3},
  // Zambie : longitude 26,395°, latitude −14,661°, rang 3.
  {"name":"Zambie","lon":26.395,"lat":-14.661,"rank":3},
  // Équateur : longitude −78,188°, latitude −1,259°, rang 3.
  {"name":"Équateur","lon":-78.188,"lat":-1.259,"rank":3},
  // Syrie : longitude 38,278°, latitude 35,007°, rang 3.
  {"name":"Syrie","lon":38.278,"lat":35.007,"rank":3},
  // Guatemala : longitude −90,497°, latitude 14,982°, rang 3.
  {"name":"Guatemala","lon":-90.497,"lat":14.982,"rank":3},
  // Cambodge : longitude 104,505°, latitude 12,648°, rang 3.
  {"name":"Cambodge","lon":104.505,"lat":12.648,"rank":3},
  // Tchad : longitude 18,645°, latitude 15,143°, rang 3.
  {"name":"Tchad","lon":18.645,"lat":15.143,"rank":3},
  // Guinée : longitude −10,016°, latitude 10,619°, rang 3.
  {"name":"Guinée","lon":-10.016,"lat":10.619,"rank":3},
  // Rwanda : longitude 30,104°, latitude −1,897°, rang 3.
  {"name":"Rwanda","lon":30.104,"lat":-1.897,"rank":3},
  // Tunisie : longitude 9,008°, latitude 33,687°, rang 3.
  {"name":"Tunisie","lon":9.008,"lat":33.687,"rank":3},
  // Bolivie : longitude −64,593°, latitude −16,666°, rang 3.
  {"name":"Bolivie","lon":-64.593,"lat":-16.666,"rank":3},
  // Soudan du Sud : longitude 30,39°, latitude 7,23°, rang 3.
  {"name":"Soudan du Sud","lon":30.39,"lat":7.23,"rank":3},
  // Libye : longitude 18,011°, latitude 26,639°, rang 3.
  {"name":"Libye","lon":18.011,"lat":26.639,"rank":3},
  // Finlande : longitude 27,276°, latitude 63,252°, rang 3.
  {"name":"Finlande","lon":27.276,"lat":63.252,"rank":3},
  // Norvège : longitude 9,68°, latitude 61,357°, rang 3.
  {"name":"Norvège","lon":9.68,"lat":61.357,"rank":3},
  // Irlande : longitude −7,799°, latitude 53,079°, rang 3.
  {"name":"Irlande","lon":-7.799,"lat":53.079,"rank":3},
  // Mauritanie : longitude −9,74°, latitude 19,587°, rang 3.
  {"name":"Mauritanie","lon":-9.74,"lat":19.587,"rank":3},
  // Mongolie : longitude 104,15°, latitude 45,997°, rang 3.
  {"name":"Mongolie","lon":104.15,"lat":45.997,"rank":3},
  // Namibie : longitude 17,108°, latitude −20,575°, rang 3.
  {"name":"Namibie","lon":17.108,"lat":-20.575,"rank":3},
  // Îles Salomon : longitude 159,17°, latitude −8,03°, rang 3.
  {"name":"Îles Salomon","lon":159.17,"lat":-8.03,"rank":3},
  // Taïwan : longitude 120,868°, latitude 23,652°, rang 3.
  {"name":"Taïwan","lon":120.868,"lat":23.652,"rank":3},
  // Biélorussie : longitude 28,418°, latitude 53,822°, rang 4.
  {"name":"Biélorussie","lon":28.418,"lat":53.822,"rank":4},
  // Israël : longitude 34,848°, latitude 30,911°, rang 4.
  {"name":"Israël","lon":34.848,"lat":30.911,"rank":4},
  // Autriche : longitude 14,131°, latitude 47,519°, rang 4.
  {"name":"Autriche","lon":14.131,"lat":47.519,"rank":4},
  // Paraguay : longitude −60,146°, latitude −21,675°, rang 4.
  {"name":"Paraguay","lon":-60.146,"lat":-21.675,"rank":4},
  // Kirghizstan : longitude 74,533°, latitude 41,669°, rang 4.
  {"name":"Kirghizstan","lon":74.533,"lat":41.669,"rank":4},
  // Turkménistan : longitude 58,677°, latitude 39,855°, rang 4.
  {"name":"Turkménistan","lon":58.677,"lat":39.855,"rank":4},
  // Danemark : longitude 9,018°, latitude 55,967°, rang 4.
  {"name":"Danemark","lon":9.018,"lat":55.967,"rank":4},
  // Uruguay : longitude −55,967°, latitude −32,961°, rang 4.
  {"name":"Uruguay","lon":-55.967,"lat":-32.961,"rank":4},
  // Gabon : longitude 11,836°, latitude −0,438°, rang 4.
  {"name":"Gabon","lon":11.836,"lat":-0.438,"rank":4},
  // Samoa : longitude −172,438°, latitude −13,639°, rang 4.
  {"name":"Samoa","lon":-172.438,"lat":-13.639,"rank":4},
  // Polynésie française : longitude −149,462°, latitude −17,628°, rang 4.
  {"name":"Polynésie française","lon":-149.462,"lat":-17.628,"rank":4},
  // Jordanie : longitude 36,376°, latitude 30,805°, rang 4.
  {"name":"Jordanie","lon":36.376,"lat":30.805,"rank":4},
  // Émirats arabes unis : longitude 54,547°, latitude 23,466°, rang 4.
  {"name":"Émirats arabes unis","lon":54.547,"lat":23.466,"rank":4},
  // Tadjikistan : longitude 72,587°, latitude 38,2°, rang 4.
  {"name":"Tadjikistan","lon":72.587,"lat":38.2,"rank":4},
  // Suisse : longitude 7,464°, latitude 46,719°, rang 4.
  {"name":"Suisse","lon":7.464,"lat":46.719,"rank":4},
  // Sierra Leone : longitude −11,764°, latitude 8,617°, rang 4.
  {"name":"Sierra Leone","lon":-11.764,"lat":8.617,"rank":4},
  // Hong Kong : longitude 114,098°, latitude 22,449°, rang 4.
  {"name":"Hong Kong","lon":114.098,"lat":22.449,"rank":4},
  // Laos : longitude 102,534°, latitude 19,432°, rang 4.
  {"name":"Laos","lon":102.534,"lat":19.432,"rank":4},
  // Bulgarie : longitude 25,157°, latitude 42,509°, rang 4.
  {"name":"Bulgarie","lon":25.157,"lat":42.509,"rank":4},
  // Érythrée : longitude 38,286°, latitude 15,787°, rang 4.
  {"name":"Érythrée","lon":38.286,"lat":15.787,"rank":4},
  // Congo-Brazzaville : longitude 15,9°, latitude 0,142°, rang 4.
  {"name":"Congo-Brazzaville","lon":15.9,"lat":0.142,"rank":4},
  // Oman : longitude 57,337°, latitude 22,12°, rang 4.
  {"name":"Oman","lon":57.337,"lat":22.12,"rank":4},
  // Liberia : longitude −9,46°, latitude 6,447°, rang 4.
  {"name":"Liberia","lon":-9.46,"lat":6.447,"rank":4},
  // Centrafrique : longitude 20,907°, latitude 6,99°, rang 4.
  {"name":"Centrafrique","lon":20.907,"lat":6.99,"rank":4},
  // Panama : longitude −80,352°, latitude 8,722°, rang 4.
  {"name":"Panama","lon":-80.352,"lat":8.722,"rank":4},
  // Jamaïque : longitude −77,319°, latitude 18,137°, rang 4.
  {"name":"Jamaïque","lon":-77.319,"lat":18.137,"rank":4},
  // Botswana : longitude 24,179°, latitude −22,103°, rang 4.
  {"name":"Botswana","lon":24.179,"lat":-22.103,"rank":4},
  // Bahreïn : longitude 50,555°, latitude 26,056°, rang 4.
  {"name":"Bahreïn","lon":50.555,"lat":26.056,"rank":4},
  // Guinée équatoriale : longitude 8,99°, latitude 2,333°, rang 4.
  {"name":"Guinée équatoriale","lon":8.99,"lat":2.333,"rank":4},
  // Eswatini : longitude 31,467°, latitude −26,534°, rang 4.
  {"name":"Eswatini","lon":31.467,"lat":-26.534,"rank":4},
  // Guyana : longitude −58,943°, latitude 5,124°, rang 4.
  {"name":"Guyana","lon":-58.943,"lat":5.124,"rank":4},
  // Macao : longitude 113,556°, latitude 22,13°, rang 4.
  {"name":"Macao","lon":113.556,"lat":22.13,"rank":4},
  // Suriname : longitude −55,911°, latitude 4,144°, rang 4.
  {"name":"Suriname","lon":-55.911,"lat":4.144,"rank":4},
  // Cap-Vert : longitude −23,639°, latitude 15,075°, rang 4.
  {"name":"Cap-Vert","lon":-23.639,"lat":15.075,"rank":4},
  // Bahamas : longitude −77,147°, latitude 26,402°, rang 4.
  {"name":"Bahamas","lon":-77.147,"lat":26.402,"rank":4},
  // Vanuatu : longitude 166,909°, latitude −15,372°, rang 4.
  {"name":"Vanuatu","lon":166.909,"lat":-15.372,"rank":4},
  // Tonga : longitude −175,163°, latitude −21,21°, rang 4.
  {"name":"Tonga","lon":-175.163,"lat":-21.21,"rank":4},
  // Samoa américaines : longitude −170,747°, latitude −14,327°, rang 4.
  {"name":"Samoa américaines","lon":-170.747,"lat":-14.327,"rank":4},
  // Îles Cook : longitude −159,786°, latitude −21,216°, rang 4.
  {"name":"Îles Cook","lon":-159.786,"lat":-21.216,"rank":4},
  // Niue : longitude −169,863°, latitude −19,046°, rang 4.
  {"name":"Niue","lon":-169.863,"lat":-19.046,"rank":4},
  // Costa Rica : longitude −84,078°, latitude 10,065°, rang 5.
  {"name":"Costa Rica","lon":-84.078,"lat":10.065,"rank":5},
  // Porto Rico : longitude −66,481°, latitude 18,235°, rang 5.
  {"name":"Porto Rico","lon":-66.481,"lat":18.235,"rank":5},
  // Pays-Bas : longitude 5,611°, latitude 52,422°, rang 5.
  {"name":"Pays-Bas","lon":5.611,"lat":52.422,"rank":5},
  // Bénin : longitude 2,352°, latitude 10,325°, rang 5.
  {"name":"Bénin","lon":2.352,"lat":10.325,"rank":5},
  // Haïti : longitude −72,224°, latitude 19,264°, rang 5.
  {"name":"Haïti","lon":-72.224,"lat":19.264,"rank":5},
  // Tchéquie : longitude 15,378°, latitude 49,882°, rang 5.
  {"name":"Tchéquie","lon":15.378,"lat":49.882,"rank":5},
  // Azerbaïdjan : longitude 47,211°, latitude 40,402°, rang 5.
  {"name":"Azerbaïdjan","lon":47.211,"lat":40.402,"rank":5},
  // Hongrie : longitude 19,448°, latitude 47,087°, rang 5.
  {"name":"Hongrie","lon":19.448,"lat":47.087,"rank":5},
  // Serbie : longitude 20,788°, latitude 44,19°, rang 5.
  {"name":"Serbie","lon":20.788,"lat":44.19,"rank":5},
  // Liban : longitude 35,993°, latitude 34,133°, rang 5.
  {"name":"Liban","lon":35.993,"lat":34.133,"rank":5},
  // Nicaragua : longitude −85,069°, latitude 12,671°, rang 5.
  {"name":"Nicaragua","lon":-85.069,"lat":12.671,"rank":5},
  // Géorgie : longitude 43,736°, latitude 41,87°, rang 5.
  {"name":"Géorgie","lon":43.736,"lat":41.87,"rank":5},
  // Qatar : longitude 51,144°, latitude 25,237°, rang 5.
  {"name":"Qatar","lon":51.144,"lat":25.237,"rank":5},
  // Lituanie : longitude 24,09°, latitude 55,104°, rang 5.
  {"name":"Lituanie","lon":24.09,"lat":55.104,"rank":5},
  // Lettonie : longitude 25,459°, latitude 57,067°, rang 5.
  {"name":"Lettonie","lon":25.459,"lat":57.067,"rank":5},
  // Timor oriental : longitude 125,855°, latitude −8,804°, rang 5.
  {"name":"Timor oriental","lon":125.855,"lat":-8.804,"rank":5},
  // Maurice : longitude 57,566°, latitude −20,3°, rang 5.
  {"name":"Maurice","lon":57.566,"lat":-20.3,"rank":5},
  // Djibouti : longitude 42,499°, latitude 11,976°, rang 5.
  {"name":"Djibouti","lon":42.499,"lat":11.976,"rank":5},
  // Bhoutan : longitude 90,04°, latitude 27,537°, rang 5.
  {"name":"Bhoutan","lon":90.04,"lat":27.537,"rank":5},
  // Maldives : longitude 73,508°, latitude 4,174°, rang 5.
  {"name":"Maldives","lon":73.508,"lat":4.174,"rank":5},
  // Malte : longitude 14,433°, latitude 35,893°, rang 5.
  {"name":"Malte","lon":14.433,"lat":35.893,"rank":5},
  // Rép. dominicaine : longitude −70,654°, latitude 19,104°, rang 5.
  {"name":"Rép. dominicaine","lon":-70.654,"lat":19.104,"rank":5},
  // Honduras : longitude −86,888°, latitude 14,795°, rang 5.
  {"name":"Honduras","lon":-86.888,"lat":14.795,"rank":5},
  // Somaliland : longitude 46,732°, latitude 9,444°, rang 5.
  {"name":"Somaliland","lon":46.732,"lat":9.444,"rank":5},
  // Palestine : longitude 35,291°, latitude 32,047°, rang 5.
  {"name":"Palestine","lon":35.291,"lat":32.047,"rank":5},
  // Bosnie-Herzégovine : longitude 18,068°, latitude 44,091°, rang 5.
  {"name":"Bosnie-Herzégovine","lon":18.068,"lat":44.091,"rank":5},
  // Trinité-et-Tobago : longitude −60,918°, latitude 10,999°, rang 5.
  {"name":"Trinité-et-Tobago","lon":-60.918,"lat":10.999,"rank":5},
  // Chypre : longitude 33,084°, latitude 34,913°, rang 5.
  {"name":"Chypre","lon":33.084,"lat":34.913,"rank":5},
  // Barbade : longitude −59,569°, latitude 13,164°, rang 5.
  {"name":"Barbade","lon":-59.569,"lat":13.164,"rank":5},
  // Îles Malouines : longitude −58,739°, latitude −51,609°, rang 5.
  {"name":"Îles Malouines","lon":-58.739,"lat":-51.609,"rank":5},
// Fin de la liste.
];
