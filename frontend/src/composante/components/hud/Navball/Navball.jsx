// Importe React et les crochets useEffect et useRef.
import React, { useEffect, useRef } from "react";
// Importe drawInstrument, qui dessine l'instrument.
import { drawInstrument } from "./renderer";
// Importe C, la palette de la navball.
import { C } from "./tokens";

// Attitude par défaut (début de l'objet).
const DEFAULT_ATTITUDE = {
  // Cap nul.
  h: 0,
  // Tangage nul.
  p: 0,
  // Roulis nul.
  r: 0
// Fin de l'objet.
};

// Déclare et exporte par défaut le composant Navball (début de la liste des propriétés).
export default function Navball({
  // L'attitude à afficher, celle par défaut si elle manque.
  attitude = DEFAULT_ATTITUDE,
  // La taille en pixels, 300 par défaut.
  size = 300
// Fin de la liste des propriétés.
}) {
  // Référence vers le canvas affiché.
  const canvasRef = useRef(null);
  // Référence vers le canvas hors écran et ses données.
  const offscreenRef = useRef(null);

  // Taille sûre : un nombre d'au moins 1 px, 300 si la valeur est illisible.
  const safeSize = Math.max(1, Number(size) || 300);

  // Cap : si la valeur est un nombre fini…
  const h = Number.isFinite(Number(attitude?.h))
    // … cette valeur…
    ? Number(attitude.h)
    // … sinon 0.
    : 0;

  // Tangage : si la valeur est un nombre fini…
  const p = Number.isFinite(Number(attitude?.p))
    // … cette valeur…
    ? Number(attitude.p)
    // … sinon 0.
    : 0;

  // Roulis : si la valeur est un nombre fini…
  const r = Number.isFinite(Number(attitude?.r))
    // … cette valeur…
    ? Number(attitude.r)
    // … sinon 0.
    : 0;

  // Effet exécuté une seule fois : prépare le canvas hors écran.
  useEffect(() => {
    // Côté de l'image de la boule : 256 pixels.
    const N = 256;

    // Crée un canvas qui n'est pas affiché.
    const offCanvas = document.createElement("canvas");

    // Fixe sa largeur.
    offCanvas.width = N;
    // Fixe sa hauteur.
    offCanvas.height = N;

    // Demande son contexte de dessin 2D (début de l'appel).
    const octx = offCanvas.getContext("2d", {
      // Option : ses pixels seront lus souvent.
      willReadFrequently: true
    // Fin de l'appel.
    });

    // Sans contexte, on abandonne.
    if (!octx) return;

    // Crée le tableau de pixels de l'image.
    const img = octx.createImageData(N, N);

    // Range le tout dans la référence (début de l'objet).
    offscreenRef.current = {
      // Le canvas hors écran.
      offCanvas,
      // Son contexte.
      octx,
      // Son tableau de pixels.
      img,
      // Sa taille.
      N
    // Fin de l'objet.
    };

    // Fonction de nettoyage.
    return () => {
      // Vide la référence.
      offscreenRef.current = null;
    // Fin de la fonction de nettoyage.
    };
  // Fin de l'effet ; aucune dépendance.
  }, []);

  // Effet qui dessine l'instrument.
  useEffect(() => {
    // Récupère le canvas affiché.
    const canvas = canvasRef.current;
    // Récupère le canvas hors écran et ses données.
    const offscreen = offscreenRef.current;

    // Si l'un des deux manque, on abandonne.
    if (!canvas || !offscreen) return;

    // Demande le contexte de dessin 2D du canvas affiché.
    const ctx = canvas.getContext("2d");

    // Sans contexte, on abandonne.
    if (!ctx) return;

    // Densité de pixels de l'écran (début de l'appel).
    const dpr = Math.min(
      // Celle du navigateur, 1 à défaut.
      window.devicePixelRatio || 1,
      // Plafonnée à 3.
      3
    // Fin de l'appel.
    );

    // Taille réelle en pixels physiques.
    const physicalSize = Math.round(safeSize * dpr);

    // Fixe la largeur réelle du canvas.
    canvas.width = physicalSize;
    // Fixe sa hauteur réelle.
    canvas.height = physicalSize;

    // Fixe sa largeur affichée, en pixels CSS.
    canvas.style.width = `${safeSize}px`;
    // Fixe sa hauteur affichée.
    canvas.style.height = `${safeSize}px`;

    // Regroupe le cap, le tangage et le roulis.
    const currentAttitude = { h, p, r };

    // Dessine l'instrument (début de l'appel).
    drawInstrument(
      // Le contexte du canvas affiché.
      ctx,
      // Le canvas hors écran.
      offscreen.offCanvas,
      // Son contexte.
      offscreen.octx,
      // Son tableau de pixels.
      offscreen.img,
      // Sa taille.
      offscreen.N,
      // La taille réelle du canvas affiché.
      physicalSize,
      // La densité de pixels.
      dpr,
      // L'attitude.
      currentAttitude,
      // Dernier argument, fixé à 1.
      1
    // Fin de l'appel.
    );

    // Fonction de nettoyage.
    return () => {
      // Efface le canvas (début de l'appel).
      ctx.clearRect(
        // Depuis le bord gauche.
        0,
        // Depuis le bord haut.
        0,
        // Sur toute la largeur.
        canvas.width,
        // Sur toute la hauteur.
        canvas.height
      // Fin de l'appel.
      );
    // Fin de la fonction de nettoyage.
    };
  // Fin de l'effet ; dépendances : le cap, le tangage, le roulis et la taille.
  }, [h, p, r, safeSize]);

  // Début du rendu.
  return (
    // Conteneur de l'instrument (début de la balise).
    <div
      // Début du style.
      style={{
        // Disposition flexible.
        display: "flex",
        // Contenu centré horizontalement.
        justifyContent: "center",
        // Contenu centré verticalement.
        alignItems: "center",
        // Couleur de fond de la navball.
        background: C.bg,
        // Marge intérieure de 16 px.
        padding: "16px",
        // Toute la largeur.
        width: "100%",
        // La marge est comprise dans la largeur.
        boxSizing: "border-box"
      // Fin du style.
      }}
    // Fin de la balise ouvrante.
    >
      {/* Le canvas (début de la balise). */}
      <canvas
        // Référence pour le dessin.
        ref={canvasRef}
        // Rôle d'image.
        role="img"
        // Nom pour les lecteurs d'écran.
        aria-label="Instrument de navigation Navball"
        // Début du style.
        style={{
          // Affiché en bloc.
          display: "block",
          // Jamais plus large que son conteneur.
          maxWidth: "100%",
          // Hauteur proportionnelle.
          height: "auto"
        // Fin du style.
        }}
      // Fin du canvas.
      />
    {/* Fin du conteneur. */}
    </div>
  // Fin du rendu.
  );
// Fin de Navball.
}
