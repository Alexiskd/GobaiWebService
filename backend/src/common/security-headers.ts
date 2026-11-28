/**
 * En-têtes de sécurité de toutes les réponses (API et site), sans dépendance (équivalent minimal de helmet).
 * CSP volontairement réduite à ce qui ne peut rien casser : Cesium, three.js, tuiles externes, workers et
 * iframe LiDAR de l'IGN restent libres ; on interdit seulement l'encadrement par un autre site, les <object>
 * et le détournement de <base>.
 */
// Import des types Express du middleware.
import type { NextFunction, Request, Response } from 'express';

// Politique de contenu : encadrement par le site lui-même seulement, pas de plugin, <base> du site seulement.
export const CONTENT_SECURITY_POLICY = ["frame-ancestors 'self'", "base-uri 'self'", "object-src 'none'"].join('; ');

// Fonctions du navigateur : position, boussole et plein écran pour le site ; caméra, micro, USB… coupés.
export const PERMISSIONS_POLICY = [
  'geolocation=(self)', 'accelerometer=(self)', 'gyroscope=(self)', 'magnetometer=(self)', 'fullscreen=(self)',
  'camera=()', 'microphone=()', 'usb=()', 'serial=()', 'bluetooth=()', 'hid=()', 'interest-cohort=()',
].join(', ');

// Table des en-têtes posés sur chaque réponse.
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  // HTTPS imposé pendant un an (Render sert tout en HTTPS) ; sous-domaines non inclus par prudence.
  'Strict-Transport-Security': 'max-age=31536000',
  // Pas de devinette du type de fichier.
  'X-Content-Type-Options': 'nosniff',
  // Anciens navigateurs : même règle d'encadrement que la CSP.
  'X-Frame-Options': 'SAMEORIGIN',
  // Adresse complète vers le site lui-même, seulement l'origine vers les autres.
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Fenêtres ouvertes (paiement Stripe, IGN) gardées à part, sauf popups qui en ont besoin.
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  // Politique de contenu.
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  // Fonctions du navigateur.
  'Permissions-Policy': PERMISSIONS_POLICY,
};

// Middleware : pose les en-têtes puis passe la main.
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Chaque en-tête de la table.
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  // Suite de la chaîne.
  next();
// Fin du middleware.
}
