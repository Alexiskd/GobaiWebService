// Arborescence du site en 3D (onglet « Pages du site » de la fenêtre Node) : les pages sont disposées par la stack
// @go-/harmonie-3d (voir Engine/shared/lib/harmonie3d.js) et dessinées sur un canevas 2D, sans moteur 3D : une simple
// projection en perspective qui tourne lentement. Glisser fait tourner l'arbre ; cliquer une page l'ouvre.
// Importe de React les crochets useEffect, useMemo et useRef.
import { useEffect, useMemo, useRef } from 'react';
// Importe Box, le conteneur de MUI.
import { Box } from '@mui/material';
// Importe la disposition harmonieuse.
import { harmoniser } from '@/Engine/shared/lib/harmonie3d';
// Importe l'arborescence du site.
import { SITE_TREE } from './siteTree.js';

// Réglages de la disposition : étages et couronnes plus serrés que par défaut, l'arbre du site étant petit.
const REGLAGES_SITE = { layer: 3.4, dirSize: 1.2, minRadius: 2.4, gap: 0.6 };
// Durée minimale entre deux images : 30 images par seconde suffisent pour une rotation lente.
const FRAME_MS = 1000 / 30;

/** Liste à plat des nœuds, avec leur parent et leur position. */
// aplatir : parcourt l'arborescence (début).
function aplatir(positions) {
  // Liste produite.
  const out = [];
  // Parcours en profondeur.
  const visite = (item, parent) => {
    // Le nœud, son parent et sa position.
    const entry = { item, parent, p: positions.get(item) };
    // L'ajoute.
    out.push(entry);
    // Puis ses enfants.
    item.children.forEach((c) => visite(c, entry));
  // Fin de visite.
  };
  // Depuis la racine.
  visite(SITE_TREE, null);
  // Renvoie la liste.
  return out;
// Fin de aplatir.
}

/** Arbre 3D des pages du site. */
// Déclare et exporte le composant SiteTree3D.
export function SiteTree3D() {
  // Référence du canevas.
  const ref = useRef(null);
  // Nœuds placés, calculés une seule fois.
  const nodes = useMemo(() => aplatir(harmoniser(SITE_TREE, REGLAGES_SITE)), []);

  // Boucle de dessin et interactions.
  useEffect(() => {
    // Le canevas et son contexte.
    const canvas = ref.current;
    // Contexte 2D.
    const ctx = canvas.getContext('2d');
    // Sans contexte (tests, navigateur ancien) : rien.
    if (!ctx) return undefined;
    // Hauteur et rayon de l'arbre, pour le cadrer.
    const top = Math.max(...nodes.map((n) => n.p[1]));
    // Rayon horizontal.
    const wide = Math.max(...nodes.map((n) => Math.hypot(n.p[0], n.p[2])));
    // Angle de rotation, inclinaison et état du glissement.
    let angle = 0.6, tilt = 0.32, drag = null, moved = 0, hover = null, last = 0, raf = 0;
    // Rotation automatique, sauf si l'utilisateur demande moins d'animations.
    const auto = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // projeter : position 3D → point de l'écran (début).
    const projeter = (p, w, h) => {
      // Rotation autour de l'axe vertical.
      const x = p[0] * Math.cos(angle) - p[2] * Math.sin(angle);
      // Profondeur après rotation.
      const z0 = p[0] * Math.sin(angle) + p[2] * Math.cos(angle);
      // Hauteur centrée sur le milieu de l'arbre.
      const y0 = p[1] - top / 2;
      // Inclinaison de la caméra.
      const y = y0 * Math.cos(tilt) - z0 * Math.sin(tilt);
      // Profondeur finale.
      const z = y0 * Math.sin(tilt) + z0 * Math.cos(tilt);
      // Distance de la caméra : trois fois la plus grande dimension de l'arbre, pour une perspective douce.
      const dist = Math.max(top, wide) * 3;
      // Échelle qui fait tenir l'arbre dans le canevas, en largeur comme en hauteur (marge pour les noms).
      const fit = Math.min((w * 0.44) / wide, (h * 0.34) / (top / 2 + wide * Math.sin(Math.abs(tilt)) + 0.01));
      // Facteur de perspective : l'échelle de cadrage, réduite avec l'éloignement.
      const k = (fit * dist) / (dist + z);
      // Point de l'écran, profondeur et échelle.
      return { x: w / 2 + x * k, y: h * 0.54 - y * k, z, k };
    // Fin de projeter.
    };

    // dessiner : une image (début).
    const dessiner = (now) => {
      // Demande l'image suivante.
      raf = requestAnimationFrame(dessiner);
      // Onglet caché ou image trop rapprochée : rien.
      if (document.hidden || now - last < FRAME_MS) return;
      // Temps écoulé, borné.
      const dt = Math.min(100, now - last);
      // Retient l'instant.
      last = now;
      // Rotation lente, sauf pendant un glissement.
      if (auto && !drag) angle += dt * 0.00018;
      // Taille affichée et densité de pixels.
      const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Ajuste la taille interne du canevas.
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      // Dessine en pixels CSS.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Efface.
      ctx.clearRect(0, 0, w, h);
      // Couleurs du thème : accent (couleur du canevas) et texte (couleur du conteneur).
      const accent = getComputedStyle(canvas).color, texte = getComputedStyle(canvas.parentElement).color;
      // Projette chaque nœud.
      for (const n of nodes) n.s = projeter(n.p, w, h);
      // Branches : du parent vers l'enfant.
      ctx.strokeStyle = accent; ctx.lineCap = 'round';
      // Chaque nœud ayant un parent.
      for (const n of nodes) {
        // La racine n'a pas de branche.
        if (!n.parent) continue;
        // Plus épaisse près de la racine.
        ctx.lineWidth = Math.max(0.6, 0.05 * n.s.k * (n.item.children.length ? 1.6 : 1));
        // Atténuée.
        ctx.globalAlpha = 0.45;
        // Trait.
        ctx.beginPath(); ctx.moveTo(n.parent.s.x, n.parent.s.y); ctx.lineTo(n.s.x, n.s.y); ctx.stroke();
      // Fin des branches.
      }
      // Nœuds, du plus loin au plus proche.
      for (const n of [...nodes].sort((a, b) => b.s.z - a.s.z)) {
        // Rayon : plus gros pour la racine et les groupes.
        const r = Math.max(2.5, n.s.k * (n.parent ? (n.item.children.length ? 0.3 : 0.2) : 0.42));
        // Retient le rayon pour le clic.
        n.r = r;
        // Survolé : opaque ; sinon légèrement atténué.
        ctx.globalAlpha = hover === n ? 1 : 0.9;
        // Disque.
        ctx.fillStyle = n.item.path ? accent : texte;
        // Trace et remplit.
        ctx.beginPath(); ctx.arc(n.s.x, n.s.y, r * (hover === n ? 1.3 : 1), 0, Math.PI * 2); ctx.fill();
        // Nom : gras pour la racine et les groupes.
        ctx.font = `${n.item.children.length || !n.parent ? 700 : 400} ${Math.max(10, Math.min(13, 0.42 * n.s.k))}px system-ui, sans-serif`;
        // Centré sous le disque.
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        // Couleur du texte.
        ctx.fillStyle = texte;
        // Nom court de la page.
        ctx.fillText(n.item.name.length > 22 ? `${n.item.name.slice(0, 21)}…` : n.item.name, n.s.x, n.s.y + r + 3);
      // Fin des nœuds.
      }
      // Opacité rétablie.
      ctx.globalAlpha = 1;
    // Fin de dessiner.
    };

    // viser : nœud sous le pointeur, le plus proche d'abord.
    const viser = (e) => {
      // Position dans le canevas.
      const box = canvas.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
      // Du plus proche au plus loin.
      return [...nodes].sort((a, b) => a.s.z - b.s.z).find((n) => n.s && Math.hypot(n.s.x - x, n.s.y - y) <= Math.max(n.r || 0, 12)) || null;
    // Fin de viser.
    };
    // Appui : début du glissement.
    const down = (e) => { drag = { x: e.clientX, y: e.clientY }; moved = 0; canvas.setPointerCapture?.(e.pointerId); };
    // Déplacement : rotation pendant le glissement, survol sinon.
    const move = (e) => {
      // Sans glissement : met à jour le survol et le curseur.
      if (!drag) { hover = viser(e); canvas.style.cursor = hover?.item.path ? 'pointer' : 'grab'; return; }
      // Écart depuis le dernier point.
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      // Tourne et incline, l'inclinaison restant bornée.
      angle -= dx * 0.008; tilt = Math.max(-0.2, Math.min(1.1, tilt + dy * 0.005));
      // Distance parcourue, pour distinguer un clic d'un glissement.
      moved += Math.abs(dx) + Math.abs(dy);
      // Nouveau point de référence.
      drag = { x: e.clientX, y: e.clientY };
    // Fin de move.
    };
    // Relâchement : un clic sans glissement ouvre la page visée.
    const up = (e) => {
      // Était-ce un glissement en cours ?
      const wasDrag = drag;
      // Fin du glissement.
      drag = null;
      // Clic franc sur une page : ouvre son adresse.
      if (wasDrag && moved < 6) { const n = viser(e); if (n?.item.path) window.location.assign(n.item.path); }
    // Fin de up.
    };
    // Sortie du canevas : plus de survol.
    const leave = () => { hover = null; };
    // Branche les écouteurs.
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
    // Relâchement, annulation et sortie.
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', leave); canvas.addEventListener('pointerleave', leave);
    // Lance la boucle.
    raf = requestAnimationFrame(dessiner);
    // Nettoyage : arrête la boucle et retire les écouteurs.
    return () => {
      // Arrête la boucle.
      cancelAnimationFrame(raf);
      // Retire les écouteurs.
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      // Relâchement, annulation et sortie.
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', leave); canvas.removeEventListener('pointerleave', leave);
    // Fin du nettoyage.
    };
  // Une seule fois : les nœuds ne changent pas.
  }, [nodes]);

  // Début du rendu.
  return (
    // Conteneur : donne la couleur du texte au canevas.
    <Box sx={{ color: 'text.primary' }}>
      {/* Canevas : couleur d'accent du thème, hauteur fixe, glissement au doigt réservé à la rotation. */}
      <Box component="canvas" ref={ref} role="img" aria-label="Arborescence du site en 3D : glisser pour tourner, cliquer une page pour l’ouvrir"
        sx={{ display: 'block', width: '100%', height: { xs: 300, sm: 380 }, color: 'primary.main', touchAction: 'none', cursor: 'grab' }} />
    {/* Fin du conteneur. */}
    </Box>
  // Fin du rendu.
  );
// Fin de SiteTree3D.
}
