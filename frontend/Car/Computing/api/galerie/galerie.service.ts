// Service du domaine galerie : lit la collection personnelle dans PostgreSQL (Render Postgres).
// La connexion passe par DATABASE_URL ; la table par GALERIE_TABLE (galerie_items par défaut).
import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { TABLE, itemOf, folderOf } from './normalize';

// Déclare et exporte le service Galerie.
@Injectable()
export class GalerieService {
  // Le vivier de connexions, créé au premier appel puis réutilisé (début de la propriété).
  private pool: Pool | null = null;

  // getPool : le vivier, ou null sans DATABASE_URL (le site statique n'a alors rien à servir).
  private getPool(): Pool | null {
    // L'adresse de connexion, fournie par Render (Internal Database URL ou External Database URL).
    const url = process.env.DATABASE_URL;
    // Sans adresse : aucun service de base de données.
    if (!url) return null;
    // Création différée du vivier (début).
    if (!this.pool) {
      this.pool = new Pool({
        // L'adresse de la base.
        connectionString: url,
        // Les instances managées (Render, et tout hôte distant) exigent TLS ; localhost, non.
        ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
        // Quelques connexions suffisent pour un site vitrine.
        max: 5,
      });
    // Fin de la création.
    }
    // Le vivier prêt.
    return this.pool;
  // Fin de getPool.
  }

  // collection : la réponse du contrat GET /galerie : { total, folders }.
  async collection() {
    // Le vivier, ou le contrat vide sans base configurée.
    const pool = this.getPool();
    // Sans base : la réponse vide, consommée comme une collection ancienne et vide par le site statique.
    if (!pool) return { total: 0, folders: [] };
    // Début du bloc protégé : la moindre panne SQL donne une réponse vide plutôt qu'une page cassée.
    try {
      // Toutes les lignes de la table de la collection, les plus récentes d'abord.
      const result = await pool.query(`SELECT * FROM ${TABLE}`);
      // Chaque ligne devient un média normalisé (dans normalize.ts).
      const rows = (result.rows ?? []).map((row) => itemOf(row));
      // Un dossier Représente chaque valeur de colonne dossier ; sans colonne, un seul dossier « Ma collection ».
      // Regroupe par dossier (début du calcul).
      const byFolder = new Map();
      for (const row of result.rows ?? []) {
        // Le nom du dossier de la ligne, avec un repli unique.
        const name = String(row.folder ?? row.dossier ?? row.album ?? 'Ma collection');
        // La clé du dossier, en minuscules.
        const id = name.toLowerCase().replace(/\s+/g, '-');
        // Crée le dossier au premier média (début).
        if (!byFolder.has(id)) {
          // La catégorie de la galerie : planètes, géantes, naines ou satellites ; satellites par défaut.
          const category = /^plan[eè]tes$|^planetes$/i.test(name) ? 'planetes'
            : /^g[eé]antes$/i.test(name) ? 'geantes'
            : /^naines$|^nain[e]s$/i.test(name) ? 'naines'
            : 'satellites';
          // Enregistre le dossier créé.
          byFolder.set(id, folderOf(id, name, category, []));
        // Fin de la création.
        }
        // Ajoute le média au dossier.
        byFolder.get(id).items.push(itemOf(row));
      // Fin du regroupement.
      }
      // La liste des dossiers et le total.
      const folders = [...byFolder.entries()].map(([, f]) => f);
      // La réponse complète du contrat.
      return { total: rows.length, folders };
    // En cas de panne SQL.
    } catch {
      // Réponse vide : le site statique reste utilisable.
      return { total: 0, folders: [] };
    // Fin du bloc protégé.
    }
  // Fin de collection.
  }
}
