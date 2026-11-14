// Importe React.
import React from 'react';
// Importe le démontage de la racine React : avant de quitter la page, on efface ce que React affiche.
import { unmountApp } from './appRoot';

// Domaine de secours facultatif, configurable au build avec VITE_FAILOVER_URL.
// Sans configuration, les deux domaines publics Gobai sont alternés automatiquement.
function getFallbackUrl() {
  // Domaine de secours donné à la construction, sans espaces autour.
  const configured = import.meta.env.VITE_FAILOVER_URL?.trim();
  // S'il y en a un (début).
  if (configured) {
    // Essai (début).
    try {
      // L'adresse.
      const target = new URL(configured);
      // En http ou en https : c'est elle.
      if (target.protocol === 'https:' || target.protocol === 'http:') return target;
    // Adresse illisible (début).
    } catch {
      // Une URL invalide est ignorée : on essaie la correspondance des domaines Gobai.
    }
  // Fin de ce cas.
  }

  // Adresse de la page.
  const current = new URL(window.location.href);
  // Son domaine, en minuscules.
  const host = current.hostname.toLowerCase();
  // Sur gobaispace.com, avec ou sans www (début).
  if (host === 'www.gobaispace.com' || host === 'gobaispace.com') {
    // Même domaine en .fr.
    current.hostname = host.startsWith('www.') ? 'www.gobaispace.fr' : 'gobaispace.fr';
    // Renvoie l'adresse.
    return current;
  // Fin de ce cas.
  }
  // Sur gobaispace.fr, avec ou sans www (début).
  if (host === 'www.gobaispace.fr' || host === 'gobaispace.fr') {
    // Même domaine en .com.
    current.hostname = host.startsWith('www.') ? 'www.gobaispace.com' : 'gobaispace.com';
    // Renvoie l'adresse.
    return current;
  // Fin de ce cas.
  }
  // Autre domaine : aucun secours.
  return null;
// Fin de getFallbackUrl.
}

// Évite les redirections en boucle et conserve le chemin de la page demandée.
export function redirectToFailover(reason = 'application-error') {
  // Hors navigateur : faux.
  if (typeof window === 'undefined') return false;

  // Adresse de la page.
  const current = new URL(window.location.href);
  // Page déjà arrivée par une redirection de secours : faux.
  if (current.searchParams.get('__gobai_failover') === '1') return false;

  // Adresse de secours.
  const target = getFallbackUrl();
  // Aucune, ou le même site : faux.
  if (!target || target.origin === current.origin) return false;

  // Garde le chemin.
  target.pathname = current.pathname;
  // Garde les paramètres.
  target.search = current.search;
  // Garde l'ancre.
  target.hash = current.hash;
  // Marque la redirection.
  target.searchParams.set('__gobai_failover', '1');
  // Note sa raison, 80 caractères au plus.
  target.searchParams.set('__gobai_reason', String(reason).slice(0, 80));

  // Efface ce que React affiche dans le DOM avant de partir : ses effets (minuteries, écouteurs, boucle du
  // moteur 3D) s'arrêtent, et la page de secours ne démarre pas pendant que l'ancienne tourne encore.
  unmountApp();
  // Remplace la page par l'adresse de secours.
  window.location.replace(target.toString());
  // Vrai.
  return true;
// Fin de redirectToFailover.
}

// Intercepte les erreurs de rendu React (composants, rendu 3D déclenché pendant le rendu).
export class FailoverBoundary extends React.Component {
  // Constructeur (début).
  constructor(props) {
    // Appelle le constructeur de React.Component.
    super(props);
    // État : pas d'erreur.
    this.state = { hasError: false };
  // Fin du constructeur.
  }

  // getDerivedStateFromError : à une erreur de rendu (début).
  static getDerivedStateFromError() {
    // État : en erreur.
    return { hasError: true };
  // Fin de getDerivedStateFromError.
  }

  // componentDidCatch : une fois l'erreur attrapée (début).
  componentDidCatch(error) {
    // Redirige vers le secours, avec le nom de l'erreur pour raison.
    redirectToFailover(error?.name || 'react-render-error');
  // Fin de componentDidCatch.
  }

  // render (début).
  render() {
    // En erreur (début).
    if (this.state.hasError) {
      // Renvoie un élément (début) :
      return React.createElement(
        // une balise main,
        'main',
        // en alerte, plein écran, centrée, sur fond sombre,
        { role: 'alert', style: { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', background: '#050914', color: '#fff', fontFamily: 'Arial, sans-serif', textAlign: 'center' } },
        // avec un paragraphe qui annonce la tentative de secours.
        React.createElement('p', null, 'Une erreur est survenue. Tentative de connexion au service Gobai de secours…'),
      // Fin de l'élément.
      );
    // Fin de ce cas.
    }
    // Sinon : les enfants.
    return this.props.children;
  // Fin de render.
  }
// Fin de la classe FailoverBoundary.
}
