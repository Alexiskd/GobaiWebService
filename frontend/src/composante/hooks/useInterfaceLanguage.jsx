// Importe de React les crochets useCallback, useEffect, useMemo et useState.
import { useCallback, useEffect, useMemo, useState } from 'react';
// Importe loadLanguageData, qui charge le référentiel des langues.
import { loadLanguageData } from '@/moteur/i18n/languages';
// Importe plusieurs fonctions et constantes du module i18nMath (début de la liste).
import {
  // Langue du navigateur, langues d'un pays, chaîne de repli, adresse de police, écriture de droite à gauche, langue source, polices Noto.
  browserLanguage, countryLanguages, fallbackChain, fontUrl, isRtl, isSourceLanguage, NOTO_FONTS,
// Fin de la liste ; module d'origine.
} from '@/moteur/i18n/i18nMath';

// Clé du stockage local où est gardé le choix de langue.
const STORAGE_KEY = 'gobai.lang';
// Identifiant de la balise link de la police.
const FONT_LINK_ID = 'i18n-font';
// Identifiant de la balise style du texte bidirectionnel.
const BIDI_STYLE_ID = 'i18n-bidi';

// Déclare readChoice, qui lit le choix de langue enregistré.
const readChoice = () => {
  // Décode le JSON enregistré (null par défaut) ; null si le stockage ou le décodage échoue.
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
// Fin de readChoice.
};
// navLanguages : langues préférées du navigateur ; liste vide hors navigateur, sinon la liste complète, sinon la langue unique.
const navLanguages = () => (typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]);

// Avant le chargement du référentiel : langue du navigateur telle quelle (« en-US » → en), puis l'anglais.
// Déclare quickChain, la chaîne de traduction provisoire.
const quickChain = () => {
  // Première langue du navigateur, « fr » à défaut.
  const tag = String(navLanguages()[0] || 'fr');
  // Sépare l'étiquette sur les tirets ou tirets bas : la langue, puis le reste.
  const [base, ...rest] = tag.split(/[-_]/);
  // Chinois : traditionnel si le reste évoque Hant, Taïwan, Hong Kong ou Macao, simplifié sinon ; autres langues : le code en minuscules.
  const code = base.toLowerCase() === 'zh' ? (/Hant|TW|HK|MO/i.test(rest.join('-')) ? 'zh-TW' : 'zh-CN') : base.toLowerCase();
  // Langue source (français) : rien à traduire.
  if (isSourceLanguage(code)) return [];
  // Anglais seul, sinon la langue puis l'anglais en repli.
  return code === 'en' ? ['en'] : [code, 'en'];
// Fin de quickChain.
};

// Texte bidirectionnel : sens du texte détecté par paragraphe, sans retourner la mise en page de l'application.
// Règle CSS : dans une page en langue de droite à gauche, le sens de chaque texte est détecté par son contenu.
const BIDI_CSS = `.i18n-rtl body :where(p, span, div, li, a, label, button, h1, h2, h3, h4, h5, h6, dt, dd, td, th, strong, small, em) { unicode-bidi: plaintext; }`;

// Déclare applyDocument, qui règle les attributs du document selon la langue et l'écriture.
function applyDocument({ code, script }) {
  // Récupère l'élément html.
  const html = document.documentElement;
  // Fixe la langue du document, « fr » à défaut.
  html.lang = code || 'fr';
  // Écriture de droite à gauche ? Seulement s'il y a un code, d'après l'écriture et la langue de base.
  const rtl = Boolean(code) && isRtl(script, code.split('-')[0]);
  // Ajoute ou retire la classe i18n-rtl.
  html.classList.toggle('i18n-rtl', rtl);
  // Si l'écriture va de droite à gauche et que la feuille de style n'existe pas encore.
  if (rtl && !document.getElementById(BIDI_STYLE_ID)) {
    // Crée une balise style.
    const style = document.createElement('style');
    // Lui donne son identifiant.
    style.id = BIDI_STYLE_ID;
    // Y met la règle CSS bidirectionnelle.
    style.textContent = BIDI_CSS;
    // L'ajoute à l'en-tête du document.
    document.head.appendChild(style);
  // Fin de l'ajout de la feuille de style.
  }
  // Police de l'écriture (Noto), ajoutée en repli à la police du thème via --i18n-font.
  // Adresse de la police de l'écriture, vide s'il n'y a pas de code.
  const url = code ? fontUrl(script) : '';
  // Cherche la balise link de la police, si elle existe déjà.
  let link = document.getElementById(FONT_LINK_ID);
  // Si une police est nécessaire.
  if (url) {
    // Si la balise n'existe pas encore.
    if (!link) {
      // Crée la balise link.
      link = document.createElement('link');
      // Lui donne son identifiant.
      link.id = FONT_LINK_ID;
      // C'est une feuille de style.
      link.rel = 'stylesheet';
      // L'ajoute à l'en-tête du document.
      document.head.appendChild(link);
    // Fin de la création de la balise.
    }
    // Change l'adresse seulement si elle diffère (évite un rechargement inutile).
    if (link.href !== url) link.href = url;
    // Fixe la variable CSS --i18n-font au nom de la police Noto, entre guillemets.
    html.style.setProperty('--i18n-font', `"${NOTO_FONTS[script]}"`);
  // Sinon (aucune police nécessaire).
  } else {
    // Retire la balise, si elle existe.
    link?.remove();
    // Retire la variable CSS.
    html.style.removeProperty('--i18n-font');
  // Fin du choix de la police.
  }
// Fin de applyDocument.
}

/**
 * Langue de l'interface : choix enregistré, sinon langue du navigateur. Pilote la traduction de toute la page.
 * Renvoie la sélection effective, l'état de la traduction, le référentiel (chargé à la demande) et le sélecteur.
 */
// Déclare et exporte le crochet useInterfaceLanguage.
export function useInterfaceLanguage() {
  // État : le choix enregistré, lu au premier rendu.
  const [choice, setChoice] = useState(readChoice); // { code3, country, script } | null (langue du navigateur)
  // État : le référentiel des langues, null tant qu'il n'est pas chargé.
  const [data, setData] = useState(null);
  // État : vrai si le chargement du référentiel a échoué.
  const [dataError, setDataError] = useState(false);
  // L'état de la traduction du DOM : plus de traducteur, donc plus d'état à suivre.
  const status = null;

  // ensureData : charge le référentiel ; début de la fonction mémorisée.
  const ensureData = useCallback(() => {
    // Charge le référentiel, puis l'enregistre ; en cas d'échec, lève le drapeau d'erreur.
    loadLanguageData().then(setData).catch(() => setDataError(true));
  // Fin de ensureData ; fonction stable.
  }, []);

  // Sélection effective (avec le référentiel) : langue, pays, écriture.
  // Calcul mémorisé de la sélection effective.
  const effective = useMemo(() => {
    // Sans référentiel, pas de sélection.
    if (!data) return null;
    // Mode automatique s'il n'y a aucun choix enregistré.
    const auto = !choice;
    // Le choix, sinon la langue du navigateur reconnue dans le référentiel, sinon le français.
    const pick = choice || browserLanguage(navLanguages(), data) || { code3: 'fra', country: '', script: '' };
    // Fiche de la langue, celle du français si le code est inconnu.
    const entry = data.byCode3.get(pick.code3) || data.byCode3.get('fra');
    // Fiche du pays choisi, null s'il n'y en a pas.
    const countryRow = data.countryByCode.get(pick.country) || null;
    // Écriture : celle du choix, sinon celle de la langue dans ce pays, sinon la première écriture de la langue, sinon vide.
    const script = pick.script || countryLanguages(countryRow, data.byCode3).find((l) => l.code3 === entry.code3)?.script || entry.scripts[0] || '';
    // Renvoie le mode automatique, la langue, le code du pays, sa fiche et l'écriture.
    return { auto, entry, country: pick.country || '', countryRow, script };
  // Fin du calcul ; dépendances : le choix et le référentiel.
  }, [choice, data]);

  // Calcul mémorisé de la chaîne de traduction.
  const chain = useMemo(() => {
    // Sans sélection effective, chaîne provisoire.
    if (!effective) return quickChain();
    // Extrait la langue, la fiche du pays et l'écriture.
    const { entry, countryRow, script } = effective;
    // Français : rien à traduire.
    if (entry.code3 === 'fra') return [];
    // Chaîne de repli complète, d'après la langue, l'écriture, les langues du pays et l'index par code court.
    return fallbackChain(entry, script, countryLanguages(countryRow, data.byCode3), data.byShort);
  // Fin du calcul ; dépendances : la sélection effective et le référentiel.
  }, [effective, data]);

  // Traduction de l'interface par réécriture du DOM : désactivée.
  //
  // Le traducteur parcourait tout le corps de la page et remplaçait les nœuds de texte sur place, y compris à
  // l'intérieur de l'arbre React. C'est ce que l'attribut translate="no" posé sur #root interdit désormais :
  // le DOM de l'application n'appartient qu'à React, et personne ne le réécrit — ni les traducteurs du
  // navigateur, ni celui du site.
  //
  // Conséquence assumée : il ne reste rien à traduire. Les étiquettes de la carte et la fiche d'une ville, le
  // seul DOM que le moteur 3D fabrique lui-même, vivent dans #root (le parent du conteneur de la scène) et
  // figuraient déjà dans la liste SKIP du traducteur. Choisir une langue ne change donc plus que les attributs
  // lang et dir du document, ce qui n'écrit dans aucun nœud de l'interface.
  //
  // Pour remettre la traduction : rétablir la création du traducteur ci-dessous et lui donner une racine qui
  // n'est pas marquée translate="no". Le module moteur/i18n reste en place, intact.
  const domTranslation = false;

  // Référentiel chargé tout de suite quand l'interface n'est pas en français (chaîne de repli, écriture).
  // Effet relancé quand le choix change.
  useEffect(() => {
    // Charge le référentiel si la langue choisie n'est pas le français ou, sans choix, si la chaîne provisoire n'est pas vide.
    if (choice ? choice.code3 !== 'fra' : quickChain().length) ensureData();
  // Fin de l'effet ; dépendances : le choix et ensureData.
  }, [choice, ensureData]);

  // Attributs du document (lang, sens d'écriture, police) selon la langue réellement affichée.
  // Sans traduction du DOM, la langue affichée est simplement celle que le visiteur a choisie, en tête de la
  // chaîne de repli : choisir une langue continue donc de régler lang, le sens d'écriture (l'arabe et l'hébreu
  // passent bien de droite à gauche) et la police du document — ce qui n'écrit dans aucun nœud de l'interface.
  const active = status?.active || (domTranslation ? '' : (chain[0] || ''));
  // Effet qui met à jour les attributs du document.
  useEffect(() => {
    // Écriture inconnue par défaut.
    let script = '';
    // S'il y a une langue affichée et une sélection effective.
    if (active && effective) {
      // Si la langue affichée est la première de la chaîne : l'écriture de la sélection.
      script = active === chain[0] ? effective.script
        // Sinon, chinois traditionnel : Hant ; chinois simplifié : Hans.
        : active === 'zh-TW' ? 'Hant' : active === 'zh-CN' ? 'Hans'
          // Sinon, la première écriture de la langue dans le référentiel, vide à défaut.
          : data?.byShort.get(active)?.scripts[0] || '';
    // Fin du calcul de l'écriture.
    }
    // Applique la langue et l'écriture au document.
    applyDocument({ code: active, script });
  // Fin de l'effet ; dépendances : la langue affichée, la sélection, la chaîne et le référentiel.
  }, [active, effective, chain, data]);

  // setLanguage : enregistre le choix de langue ; début de la fonction mémorisée.
  const setLanguage = useCallback((next) => {
    // Met l'état à jour.
    setChoice(next);
    // Début du bloc protégé : le stockage peut être indisponible.
    try {
      // S'il y a un choix, l'enregistre en JSON.
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      // Sinon (retour à la langue du navigateur), supprime l'entrée.
      else localStorage.removeItem(STORAGE_KEY);
    // Une erreur de stockage est ignorée.
    } catch { /* stockage indisponible : choix gardé pour la session */ }
  // Fin de setLanguage ; fonction stable.
  }, []);

  /** Nom affiché d'un code de traduction (« en » → anglais). */
  // nameOf : nom d'une langue à partir de son code ; début de la fonction mémorisée.
  const nameOf = useCallback((code) => {
    // Sans code : le français.
    if (!code) return 'français';
    // Chinois simplifié.
    if (code === 'zh-CN') return 'chinois (simplifié)';
    // Chinois traditionnel.
    if (code === 'zh-TW') return 'chinois (traditionnel)';
    // Nom trouvé dans le référentiel, sinon le code lui-même.
    return data?.byShort.get(code)?.name || code;
  // Fin de nameOf ; dépendance : le référentiel.
  }, [data]);

  // Renvoie le choix, la sélection effective, la chaîne, l'état, le référentiel, le drapeau d'erreur, l'état de
  // la traduction du DOM et les trois fonctions.
  return { choice, effective, chain, status, data, dataError, ensureData, setLanguage, nameOf, domTranslation };
// Fin de useInterfaceLanguage.
}
