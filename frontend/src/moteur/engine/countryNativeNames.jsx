// Noms des pays dans leur écriture locale, pour les étiquettes à plat sur l'écran (countryLabels.js).
// Clé = nom français de countryLabelPoints.js. Les pays d'écriture latine gardent le nom français :
// on ne change ici que l'alphabet, pas la langue des étiquettes.
// `lang` aide le navigateur à choisir la police ; `script` pilote la typographie CSS.
// Déclare et exporte la table des noms de pays en écriture locale (début).
export const COUNTRY_NATIVE_LABELS = {
  // Afghanistan : nom en écriture arabe, langue déclarée : persan (fa).
  "Afghanistan": { text: "افغانستان", lang: "fa", script: "arabic" },
  // Algérie : nom en écriture arabe, langue déclarée : arabe (ar).
  "Algérie": { text: "الجزائر", lang: "ar", script: "arabic" },
  // Arabie saoudite : nom en écriture arabe, langue déclarée : arabe (ar).
  "Arabie saoudite": { text: "السعودية", lang: "ar", script: "arabic" },
  // Bahreïn : nom en écriture arabe, langue déclarée : arabe (ar).
  "Bahreïn": { text: "البحرين", lang: "ar", script: "arabic" },
  // Bangladesh : nom en écriture bengalie, langue déclarée : bengali (bn).
  "Bangladesh": { text: "বাংলাদেশ", lang: "bn", script: "bengali" },
  // Bhoutan : nom en écriture tibétaine, langue déclarée : dzongkha (dz).
  "Bhoutan": { text: "འབྲུག", lang: "dz", script: "tibetan" },
  // Biélorussie : nom en écriture cyrillique, langue déclarée : biélorusse (be).
  "Biélorussie": { text: "Беларусь", lang: "be", script: "cyrillic" },
  // Bulgarie : nom en écriture cyrillique, langue déclarée : bulgare (bg).
  "Bulgarie": { text: "България", lang: "bg", script: "cyrillic" },
  // Cambodge : nom en écriture khmère, langue déclarée : khmer (km).
  "Cambodge": { text: "កម្ពុជា", lang: "km", script: "khmer" },
  // Chine : nom en écriture chinoise, langue déclarée : chinois simplifié (zh-Hans).
  "Chine": { text: "中国", lang: "zh-Hans", script: "chinese" },
  // Chypre : nom en écriture grecque, langue déclarée : grec (el).
  "Chypre": { text: "Κύπρος", lang: "el", script: "greek" },
  // Corée du Nord : nom en écriture coréenne, langue déclarée : coréen (ko).
  "Corée du Nord": { text: "조선", lang: "ko", script: "korean" },
  // Corée du Sud : nom en écriture coréenne, langue déclarée : coréen (ko).
  "Corée du Sud": { text: "대한민국", lang: "ko", script: "korean" },
  // Djibouti : nom en écriture arabe, langue déclarée : arabe (ar).
  "Djibouti": { text: "جيبوتي", lang: "ar", script: "arabic" },
  // Égypte : nom en écriture arabe, langue déclarée : arabe (ar).
  "Égypte": { text: "مصر", lang: "ar", script: "arabic" },
  // Émirats arabes unis : nom en écriture arabe, langue déclarée : arabe (ar).
  "Émirats arabes unis": { text: "الإمارات", lang: "ar", script: "arabic" },
  // Érythrée : nom en écriture éthiopienne, langue déclarée : tigrigna (ti).
  "Érythrée": { text: "ኤርትራ", lang: "ti", script: "ethiopic" },
  // Éthiopie : nom en écriture éthiopienne, langue déclarée : amharique (am).
  "Éthiopie": { text: "ኢትዮጵያ", lang: "am", script: "ethiopic" },
  // Géorgie : nom en écriture géorgienne, langue déclarée : géorgien (ka).
  "Géorgie": { text: "საქართველო", lang: "ka", script: "georgian" },
  // Grèce : nom en écriture grecque, langue déclarée : grec (el).
  "Grèce": { text: "Ελλάδα", lang: "el", script: "greek" },
  // Hong Kong : nom en écriture chinoise, langue déclarée : chinois traditionnel (zh-Hant).
  "Hong Kong": { text: "香港", lang: "zh-Hant", script: "chinese" },
  // Inde : nom en écriture devanagari, langue déclarée : hindi (hi).
  "Inde": { text: "भारत", lang: "hi", script: "devanagari" },
  // Iran : nom en écriture arabe, langue déclarée : persan (fa).
  "Iran": { text: "ایران", lang: "fa", script: "arabic" },
  // Irak : nom en écriture arabe, langue déclarée : arabe (ar).
  "Irak": { text: "العراق", lang: "ar", script: "arabic" },
  // Israël : nom en écriture hébraïque, langue déclarée : hébreu (he).
  "Israël": { text: "ישראל", lang: "he", script: "hebrew" },
  // Japon : nom en écriture japonaise, langue déclarée : japonais (ja).
  "Japon": { text: "日本", lang: "ja", script: "japanese" },
  // Jordanie : nom en écriture arabe, langue déclarée : arabe (ar).
  "Jordanie": { text: "الأردن", lang: "ar", script: "arabic" },
  // Kazakhstan : nom en écriture cyrillique, langue déclarée : kazakh (kk).
  "Kazakhstan": { text: "Қазақстан", lang: "kk", script: "cyrillic" },
  // Kirghizstan : nom en écriture cyrillique, langue déclarée : kirghize (ky).
  "Kirghizstan": { text: "Кыргызстан", lang: "ky", script: "cyrillic" },
  // Laos : nom en écriture laotienne, langue déclarée : lao (lo).
  "Laos": { text: "ລາວ", lang: "lo", script: "lao" },
  // Liban : nom en écriture arabe, langue déclarée : arabe (ar).
  "Liban": { text: "لبنان", lang: "ar", script: "arabic" },
  // Libye : nom en écriture arabe, langue déclarée : arabe (ar).
  "Libye": { text: "ليبيا", lang: "ar", script: "arabic" },
  // Macao : nom en écriture chinoise, langue déclarée : chinois traditionnel (zh-Hant).
  "Macao": { text: "澳門", lang: "zh-Hant", script: "chinese" },
  // Maldives : nom en écriture thâna, langue déclarée : divehi (dv).
  "Maldives": { text: "ދިވެހިރާއްޖެ", lang: "dv", script: "thaana" },
  // Maroc : nom en écriture arabe, langue déclarée : arabe (ar).
  "Maroc": { text: "المغرب", lang: "ar", script: "arabic" },
  // Mauritanie : nom en écriture arabe, langue déclarée : arabe (ar).
  "Mauritanie": { text: "موريتانيا", lang: "ar", script: "arabic" },
  // Mongolie : nom en écriture cyrillique, langue déclarée : mongol (mn).
  "Mongolie": { text: "Монгол улс", lang: "mn", script: "cyrillic" },
  // Myanmar : nom en écriture birmane, langue déclarée : birman (my).
  "Myanmar": { text: "မြန်မာ", lang: "my", script: "myanmar" },
  // Népal : nom en écriture devanagari, langue déclarée : népalais (ne).
  "Népal": { text: "नेपाल", lang: "ne", script: "devanagari" },
  // Oman : nom en écriture arabe, langue déclarée : arabe (ar).
  "Oman": { text: "عمان", lang: "ar", script: "arabic" },
  // Pakistan : nom en écriture arabe, langue déclarée : ourdou (ur).
  "Pakistan": { text: "پاکستان", lang: "ur", script: "arabic" },
  // Palestine : nom en écriture arabe, langue déclarée : arabe (ar).
  "Palestine": { text: "فلسطين", lang: "ar", script: "arabic" },
  // Qatar : nom en écriture arabe, langue déclarée : arabe (ar).
  "Qatar": { text: "قطر", lang: "ar", script: "arabic" },
  // Russie : nom en écriture cyrillique, langue déclarée : russe (ru).
  "Russie": { text: "Россия", lang: "ru", script: "cyrillic" },
  // Serbie : nom en écriture cyrillique, langue déclarée : serbe (sr).
  "Serbie": { text: "Србија", lang: "sr", script: "cyrillic" },
  // Soudan : nom en écriture arabe, langue déclarée : arabe (ar).
  "Soudan": { text: "السودان", lang: "ar", script: "arabic" },
  // Sri Lanka : nom en écriture cingalaise, langue déclarée : cingalais (si).
  "Sri Lanka": { text: "ශ්‍රී ලංකාව", lang: "si", script: "sinhala" },
  // Syrie : nom en écriture arabe, langue déclarée : arabe (ar).
  "Syrie": { text: "سوريا", lang: "ar", script: "arabic" },
  // Tadjikistan : nom en écriture cyrillique, langue déclarée : tadjik (tg).
  "Tadjikistan": { text: "Тоҷикистон", lang: "tg", script: "cyrillic" },
  // Taïwan : nom en écriture chinoise, langue déclarée : chinois traditionnel (zh-Hant).
  "Taïwan": { text: "臺灣", lang: "zh-Hant", script: "chinese" },
  // Thaïlande : nom en écriture thaïe, langue déclarée : thaï (th).
  "Thaïlande": { text: "ประเทศไทย", lang: "th", script: "thai" },
  // Tunisie : nom en écriture arabe, langue déclarée : arabe (ar).
  "Tunisie": { text: "تونس", lang: "ar", script: "arabic" },
  // Ukraine : nom en écriture cyrillique, langue déclarée : ukrainien (uk).
  "Ukraine": { text: "Україна", lang: "uk", script: "cyrillic" },
  // Yémen : nom en écriture arabe, langue déclarée : arabe (ar).
  "Yémen": { text: "اليمن", lang: "ar", script: "arabic" },
// Fin de la table.
};

// Déclare et exporte nativeCountryLabel : le nom français du pays.
export function nativeCountryLabel(name) {
  // Si la table contient ce nom comme propriété propre…
  return Object.prototype.hasOwnProperty.call(COUNTRY_NATIVE_LABELS, name)
    // … renvoie son entrée ;
    ? COUNTRY_NATIVE_LABELS[name]
    // sinon null.
    : null;
// Fin de nativeCountryLabel.
}
