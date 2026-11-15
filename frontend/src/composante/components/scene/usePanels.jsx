// Importe de React les crochets useCallback, useEffect et useState.
import { useCallback, useEffect, useState } from 'react';

/**
 * Panneaux ouverts : recherche, aide, informations et Node (un seul à la fois).
 * Raccourcis : Ctrl K ou / (recherche), ? (aide), S (Node), L (informations), Échap (fermer).
 * La barre d'outils n'a plus de bouton Informations : les cartes de l'astre sont rendues avec ses caractéristiques,
 * et la touche L reste le moyen de déplier le panneau et d'y descendre (ou d'ouvrir celui du Soleil, sans astre visé).
 */
// Déclare et exporte le crochet usePanels : reçoit le mode compact.
export function usePanels({ compact }) {
  // État : le panneau ouvert, aucun au départ.
  const [panel, setPanel] = useState(null); // 'layers' | 'search' | 'help' | 'sources' | 'donate' | null

  // Vrai si le panneau d'informations est ouvert.
  const layersOpen = panel === 'layers'; // sans astre ciblé : Informations sur le Soleil
  // closePanel : ferme le panneau ouvert ; fonction stable.
  const closePanel = useCallback(() => setPanel(null), []);


  // Effet exécuté une seule fois : les raccourcis clavier.
  useEffect(() => {
    // Déclare onKey, appelé à chaque touche enfoncée.
    const onKey = (e) => {
      // La cible de la frappe.
      const t = e.target;
      // Vrai si l'on tape dans un champ, une zone de texte ou un élément éditable.
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      // Ctrl K ou Cmd K : ouvre la recherche, sans laisser agir le navigateur.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPanel('search'); return; }
      // Échap : ferme le panneau.
      if (e.key === 'Escape') { setPanel(null); return; }
      // Pendant la saisie, ou avec Ctrl, Cmd ou Alt : aucun autre raccourci.
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      // Barre oblique : ouvre la recherche.
      if (e.key === '/') { e.preventDefault(); setPanel('search'); }
      // Point d'interrogation : ouvre ou ferme l'aide.
      else if (e.key === '?') setPanel((p) => (p === 'help' ? null : 'help'));
      // S : ouvre ou ferme les sources.
      else if (e.key.toLowerCase() === 's') setPanel((p) => (p === 'sources' ? null : 'sources'));
      // L : ouvre ou ferme les informations.
      else if (e.key.toLowerCase() === 'l') setPanel((p) => (p === 'layers' ? null : 'layers'));
    // Fin de onKey.
    };
    // Écoute les touches sur toute la fenêtre.
    window.addEventListener('keydown', onKey);
    // Nettoyage : retire l'écouteur.
    return () => window.removeEventListener('keydown', onKey);
  // Fin de l'effet ; aucune dépendance.
  }, []);

  // Début de l'objet renvoyé.
  return {
    // Le panneau, sa fonction de mise à jour, la fermeture et l'état des informations.
    panel, setPanel, closePanel, layersOpen,
  // Fin de l'objet renvoyé.
  };
// Fin de usePanels.
}
