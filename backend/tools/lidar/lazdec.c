// Décodeur LAZ 1.4, format de point 6 (POINT14 v3, compression par couches), écrit pour convertir une dalle
// COPC du LiDAR HD de l'IGN sans dépendance. Couches décodées : retours + XY, Z, classification, intensité.
// Chaque nœud de l'octree COPC est un bloc indépendant. Sortie : 16 octets par point (X, Y, Z entiers, intensité,
// classe, niveau). Chaque point décodé est vérifié contre le cube de son nœud : le programme sort en erreur si un
// seul point en déborde (flux désynchronisé). Utilisé par prepare.py.
//
// Compilation : gcc -O2 -o lazdec lazdec.c
//
// Limite connue : pour les couples (nombre de retours, numéro de retour) invalides (numéro nul ou plus grand que le
// nombre), le contexte des médianes XY n'a pas pu être vérifié sur des données ; la dalle de Paris n'en contient
// aucun (« retours invalides 0 » en fin d'exécution). Si ce compteur n'est pas nul, contrôler le résultat.
#include <stdint.h>
// Inclut les entrées et sorties standard.
#include <stdio.h>
// Inclut l'allocation de mémoire.
#include <stdlib.h>
// Inclut les fonctions sur les blocs de mémoire.
#include <string.h>

// Noms courts des types entiers : 8, 16, 32 et 64 bits.
typedef uint8_t U8; typedef uint16_t U16; typedef uint32_t U32; typedef int32_t I32; typedef uint64_t U64;

// ---------------------------------------------------------------- décodeur arithmétique (FastAC, Amir Said)
#define AC_MIN_LENGTH 0x01000000u
// Décalage de la précision d'un modèle de bit : 13.
#define BM_LENGTH_SHIFT 13
// Compte maximal d'un modèle de bit.
#define BM_MAX_COUNT (1u << BM_LENGTH_SHIFT)
// Décalage de la précision d'un modèle de symboles : 15.
#define DM_LENGTH_SHIFT 15
// Compte maximal d'un modèle de symboles.
#define DM_MAX_COUNT (1u << DM_LENGTH_SHIFT)

// Dec : l'état du décodeur arithmétique (position, fin, valeur, longueur de l'intervalle, lectures au-delà de la fin).
typedef struct { const U8 *p, *end; U32 value, length; int overrun; } Dec;
// getb : lit l'octet suivant ; au-delà de la fin, compte le dépassement et renvoie 0.
static inline U32 getb(Dec *d) { if (d->p < d->end) return *d->p++; d->overrun++; return 0; }
// dec_init : démarre le décodeur sur un tampon (début).
static void dec_init(Dec *d, const U8 *buf, size_t n) {
  // Position, fin, compteur à zéro et intervalle entier.
  d->p = buf; d->end = buf + n; d->overrun = 0; d->length = 0xFFFFFFFFu;
  // Lit les quatre premiers octets dans la valeur.
  d->value = getb(d) << 24; d->value |= getb(d) << 16; d->value |= getb(d) << 8; d->value |= getb(d);
// Fin de dec_init.
}
// renorm : lit des octets tant que l'intervalle est trop court.
static inline void renorm(Dec *d) { do { d->value = (d->value << 8) | getb(d); } while ((d->length <<= 8) < AC_MIN_LENGTH); }

// BitModel : le modèle adaptatif d'un bit.
typedef struct { U32 update_cycle, bits_until_update, bit_0_prob, bit_0_count, bit_count; } BitModel;
// bm_init : départ à probabilités égales.
static void bm_init(BitModel *m) { m->bit_0_count = 1; m->bit_count = 2; m->bit_0_prob = 1u << (BM_LENGTH_SHIFT - 1); m->update_cycle = m->bits_until_update = 4; }
// bm_update : recalcule la probabilité du bit 0 (début).
static void bm_update(BitModel *m) {
  // Si le compte dépasse le maximum (début).
  if ((m->bit_count += m->update_cycle) > BM_MAX_COUNT) {
    // Divise les deux comptes par deux.
    m->bit_count = (m->bit_count + 1) >> 1; m->bit_0_count = (m->bit_0_count + 1) >> 1;
    // Le compte du bit 0 reste sous le compte total.
    if (m->bit_0_count == m->bit_count) ++m->bit_count;
  // Fin de ce cas.
  }
  // Échelle : 2³¹ divisé par le compte total.
  U32 scale = 0x80000000u / m->bit_count;
  // Probabilité du bit 0.
  m->bit_0_prob = (m->bit_0_count * scale) >> (31 - BM_LENGTH_SHIFT);
  // Cycle de mise à jour allongé d'un quart, 64 au plus.
  m->update_cycle = (5 * m->update_cycle) >> 2; if (m->update_cycle > 64) m->update_cycle = 64;
  // Prochaine mise à jour dans un cycle.
  m->bits_until_update = m->update_cycle;
// Fin de bm_update.
}
// dec_bit : décode un bit (début).
static inline U32 dec_bit(Dec *d, BitModel *m) {
  // Seuil de l'intervalle pour le bit 0.
  U32 x = m->bit_0_prob * (d->length >> BM_LENGTH_SHIFT);
  // Le bit : 1 si la valeur atteint le seuil.
  U32 sym = (d->value >= x);
  // Bit 0 : l'intervalle se réduit au seuil ; bit 1 : la valeur et l'intervalle sont décalés du seuil.
  if (sym == 0) { d->length = x; ++m->bit_0_count; } else { d->value -= x; d->length -= x; }
  // Intervalle trop court : renormalise.
  if (d->length < AC_MIN_LENGTH) renorm(d);
  // Mise à jour du modèle quand son cycle est écoulé.
  if (--m->bits_until_update == 0) bm_update(m);
  // Renvoie le bit.
  return sym;
// Fin de dec_bit.
}

// Model : le modèle adaptatif d'un symbole (distribution, comptes, table de décodage et cycle de mise à jour).
typedef struct { U32 symbols, *distribution, *symbol_count, *decoder_table, total_count, update_cycle, symbols_until_update, last_symbol, table_size, table_shift; } Model;
// model_update : recalcule la distribution (début).
static void model_update(Model *m) {
  // Si le compte total dépasse le maximum (début).
  if ((m->total_count += m->update_cycle) > DM_MAX_COUNT) {
    // Compte total à zéro.
    m->total_count = 0;
    // Divise chaque compte par deux et refait le total.
    for (U32 n = 0; n < m->symbols; n++) m->total_count += (m->symbol_count[n] = (m->symbol_count[n] + 1) >> 1);
  // Fin de ce cas.
  }
  // Variables de travail et échelle : 2³¹ divisé par le compte total.
  U32 k, sum = 0, s = 0, scale = 0x80000000u / m->total_count;
  // Sans table de décodage (début).
  if (m->table_size == 0) {
    // Distribution cumulée de chaque symbole.
    for (k = 0; k < m->symbols; k++) { m->distribution[k] = (scale * sum) >> (31 - DM_LENGTH_SHIFT); sum += m->symbol_count[k]; }
  // Avec une table (début).
  } else {
    // Pour chaque symbole (début).
    for (k = 0; k < m->symbols; k++) {
      // Sa distribution cumulée.
      m->distribution[k] = (scale * sum) >> (31 - DM_LENGTH_SHIFT); sum += m->symbol_count[k];
      // Sa case dans la table.
      U32 w = m->distribution[k] >> m->table_shift;
      // Remplit la table jusqu'à cette case.
      while (s < w) m->decoder_table[++s] = k - 1;
    // Fin de la boucle.
    }
    // Première case : symbole 0.
    m->decoder_table[0] = 0;
    // Fin de la table : dernier symbole.
    while (s <= m->table_size) m->decoder_table[++s] = m->symbols - 1;
  // Fin du choix.
  }
  // Cycle de mise à jour allongé d'un quart.
  m->update_cycle = (5 * m->update_cycle) >> 2;
  // Cycle maximal : 8 × (symboles + 6).
  U32 max_cycle = (m->symbols + 6) << 3;
  // Borné à ce maximum.
  if (m->update_cycle > max_cycle) m->update_cycle = max_cycle;
  // Prochaine mise à jour dans un cycle.
  m->symbols_until_update = m->update_cycle;
// Fin de model_update.
}
// model_new : crée un modèle pour un nombre de symboles (début).
static Model *model_new(U32 symbols) {
  // Alloue le modèle, à zéro.
  Model *m = calloc(1, sizeof(Model));
  // Nombre de symboles et dernier symbole.
  m->symbols = symbols; m->last_symbol = symbols - 1;
  // Plus de 16 symboles (début).
  if (symbols > 16) {
    // Nombre de bits de la table de décodage.
    U32 table_bits = 3; while (symbols > (1u << (table_bits + 2))) ++table_bits;
    // Taille et décalage de la table.
    m->table_size = 1u << table_bits; m->table_shift = DM_LENGTH_SHIFT - table_bits;
    // Alloue la distribution, les comptes et la table d'un seul bloc.
    m->distribution = calloc(2 * symbols + m->table_size + 2, sizeof(U32));
    // La table suit les comptes.
    m->decoder_table = m->distribution + 2 * symbols;
  // Sinon : distribution et comptes seulement.
  } else { m->distribution = calloc(2 * symbols, sizeof(U32)); }
  // Les comptes suivent la distribution.
  m->symbol_count = m->distribution + symbols;
  // Compte total à zéro ; cycle égal au nombre de symboles.
  m->total_count = 0; m->update_cycle = symbols;
  // Chaque symbole part avec un compte de 1.
  for (U32 k = 0; k < symbols; k++) m->symbol_count[k] = 1;
  // Première distribution.
  model_update(m);
  // Cycle de départ : (symboles + 6) / 2.
  m->symbols_until_update = m->update_cycle = (symbols + 6) >> 1;
  // Renvoie le modèle.
  return m;
// Fin de model_new.
}
// model_free : libère un modèle.
static void model_free(Model *m) { if (m) { free(m->distribution); free(m); } }
// dec_symbol : décode un symbole (début).
static inline U32 dec_symbol(Dec *d, Model *m) {
  // Variables de travail ; y part de la longueur de l'intervalle.
  U32 n, sym, x, y = d->length;
  // Avec une table de décodage (début).
  if (m->decoder_table) {
    // Valeur ramenée à la précision de la distribution.
    U32 dv = d->value / (d->length >>= DM_LENGTH_SHIFT);
    // Case de la table.
    U32 t = dv >> m->table_shift;
    // Bornes du symbole, d'après la table.
    sym = m->decoder_table[t]; n = m->decoder_table[t + 1] + 1;
    // Recherche du symbole par moitiés entre ces bornes.
    while (n > sym + 1) { U32 k = (sym + n) >> 1; if (m->distribution[k] > dv) n = k; else sym = k; }
    // Bas de son intervalle.
    x = m->distribution[sym] * d->length;
    // Haut de son intervalle, sauf pour le dernier symbole.
    if (sym != m->last_symbol) y = m->distribution[sym + 1] * d->length;
  // Sans table (début).
  } else {
    // Départ à zéro ; l'intervalle est ramené à la précision.
    x = sym = 0; d->length >>= DM_LENGTH_SHIFT;
    // Milieu des symboles.
    U32 k = (n = m->symbols) >> 1;
    // Recherche par moitiés sur tous les symboles.
    do { U32 z = d->length * m->distribution[k]; if (z > d->value) { n = k; y = z; } else { sym = k; x = z; } } while ((k = (sym + n) >> 1) != sym);
  // Fin du choix.
  }
  // Réduit la valeur et l'intervalle à celui du symbole.
  d->value -= x; d->length = y - x;
  // Intervalle trop court : renormalise.
  if (d->length < AC_MIN_LENGTH) renorm(d);
  // Compte le symbole.
  ++m->symbol_count[sym];
  // Mise à jour du modèle quand son cycle est écoulé.
  if (--m->symbols_until_update == 0) model_update(m);
  // Renvoie le symbole.
  return sym;
// Fin de dec_symbol.
}
// dec_short : décode 16 bits bruts.
static inline U32 dec_short(Dec *d) { U32 sym = d->value / (d->length >>= 16); d->value -= d->length * sym; if (d->length < AC_MIN_LENGTH) renorm(d); return sym; }
// dec_bits : décode un nombre de bits bruts (début).
static U32 dec_bits(Dec *d, U32 bits) {
  // Plus de 19 bits : 16 bits d'abord, puis le reste.
  if (bits > 19) { U32 tmp = dec_short(d); bits -= 16; U32 tmp1 = dec_bits(d, bits) << 16; return tmp1 | tmp; }
  // Symbole lu directement dans l'intervalle.
  U32 sym = d->value / (d->length >>= bits); d->value -= d->length * sym;
  // Intervalle trop court : renormalise.
  if (d->length < AC_MIN_LENGTH) renorm(d);
  // Renvoie la valeur.
  return sym;
// Fin de dec_bits.
}

// ---------------------------------------------------------------- compresseur d'entiers
typedef struct { U32 k, contexts, bits_high, corr_bits, corr_range; I32 corr_min; Model **mBits; BitModel corr0; Model *corr[33]; } IC;
// ic_new : crée un décompresseur d'entiers, pour un nombre de bits et de contextes (début).
static IC *ic_new(U32 bits, U32 contexts) {
  // L'alloue, à zéro.
  IC *ic = calloc(1, sizeof(IC));
  // Contextes ; 8 bits forts.
  ic->contexts = contexts; ic->bits_high = 8;
  // Moins de 32 bits : plage et minimum de la correction.
  if (bits && bits < 32) { ic->corr_bits = bits; ic->corr_range = 1u << bits; ic->corr_min = -((I32)(ic->corr_range / 2)); }
  // 32 bits : plage entière.
  else { ic->corr_bits = 32; ic->corr_range = 0; ic->corr_min = INT32_MIN; }
  // Un modèle du nombre de bits par contexte.
  ic->mBits = calloc(contexts, sizeof(Model *));
  // Les crée.
  for (U32 i = 0; i < contexts; i++) ic->mBits[i] = model_new(ic->corr_bits + 1);
  // Modèle du bit de correction nulle.
  bm_init(&ic->corr0);
  // Un modèle de correction par nombre de bits.
  for (U32 i = 1; i <= ic->corr_bits; i++) ic->corr[i] = model_new(i <= ic->bits_high ? (1u << i) : (1u << ic->bits_high));
  // Le renvoie.
  return ic;
// Fin de ic_new.
}
// ic_free : libère un décompresseur d'entiers (début).
static void ic_free(IC *ic) {
  // Absent : rien.
  if (!ic) return;
  // Libère les modèles des contextes.
  for (U32 i = 0; i < ic->contexts; i++) model_free(ic->mBits[i]);
  // Libère les modèles de correction.
  for (U32 i = 1; i <= ic->corr_bits; i++) model_free(ic->corr[i]);
  // Libère le tableau et le décompresseur.
  free(ic->mBits); free(ic);
// Fin de ic_free.
}
// ic_decompress : décode un entier à partir d'une prédiction, dans un contexte (début).
static I32 ic_decompress(IC *ic, Dec *d, I32 pred, U32 context) {
  // Correction.
  I32 c;
  // Nombre de bits de la correction.
  U32 k = ic->k = dec_symbol(d, ic->mBits[context]);
  // S'il n'est pas nul (début).
  if (k) {
    // Moins de 32 bits (début).
    if (k < 32) {
      // Jusqu'à 8 bits : la correction est un symbole.
      if (k <= ic->bits_high) c = (I32)dec_symbol(d, ic->corr[k]);
      // Au-delà : un symbole pour les bits forts, des bits bruts pour le reste.
      else { U32 k1 = k - ic->bits_high; c = (I32)dec_symbol(d, ic->corr[k]); U32 c1 = dec_bits(d, k1); c = (I32)(((U32)c << k1) | c1); }
      // Rétablit le signe de la correction.
      if (c >= (I32)(1u << (k - 1))) c += 1; else c -= (I32)((1u << k) - 1);
    // 32 bits : correction minimale.
    } else c = ic->corr_min;
  // Zéro bit : la correction vaut 0 ou 1.
  } else c = (I32)dec_bit(d, &ic->corr0);
  // Valeur : prédiction plus correction.
  I32 real = (I32)((U32)pred + (U32)c);
  // Ramène la valeur dans la plage.
  if (real < 0) real = (I32)((U32)real + ic->corr_range); else if ((U32)real >= ic->corr_range) real = (I32)((U32)real - ic->corr_range);
  // La renvoie.
  return real;
// Fin de ic_decompress.
}

// ---------------------------------------------------------------- médiane glissante de 5 valeurs
typedef struct { I32 v[5]; int high; } Med5;
// med_init : médiane à zéro.
static void med_init(Med5 *m) { memset(m->v, 0, sizeof(m->v)); m->high = 1; }
// med_add : ajoute une valeur aux cinq gardées, triées (début).
static void med_add(Med5 *m, I32 v) {
  // Les cinq valeurs.
  I32 *a = m->v;
  // Tour « haut » (début).
  if (m->high) {
    // Valeur sous la médiane : insérée dans la moitié basse, les grandes décalées.
    if (v < a[2]) { a[4] = a[3]; a[3] = a[2]; if (v < a[0]) { a[2] = a[1]; a[1] = a[0]; a[0] = v; } else if (v < a[1]) { a[2] = a[1]; a[1] = v; } else a[2] = v; }
    // Sinon : insérée dans la moitié haute ; tour suivant « bas ».
    else { if (v < a[3]) { a[4] = a[3]; a[3] = v; } else a[4] = v; m->high = 0; }
  // Tour « bas » (début).
  } else {
    // Valeur au-dessus de la médiane : insérée dans la moitié haute, les petites décalées.
    if (a[2] < v) { a[0] = a[1]; a[1] = a[2]; if (a[4] < v) { a[2] = a[3]; a[3] = a[4]; a[4] = v; } else if (a[3] < v) { a[2] = a[3]; a[3] = v; } else a[2] = v; }
    // Sinon : insérée dans la moitié basse ; tour suivant « haut ».
    else { if (a[1] < v) { a[0] = a[1]; a[1] = v; } else a[0] = v; m->high = 1; }
  // Fin du choix.
  }
// Fin de med_add.
}

// ---------------------------------------------------------------- POINT14 v3
static const U8 MAP6[16][16] = {
  // Lignes 0 à 3 de la table.
  {0,1,2,3,4,5,3,4,4,5,5,5,5,5,5,5},{1,0,1,3,4,3,3,4,4,4,5,5,5,5,5,5},{2,1,2,4,4,4,4,4,4,4,4,5,5,5,5,5},{3,3,4,5,4,4,4,4,4,4,4,4,5,5,5,5},
  // Lignes 4 à 7.
  {4,4,4,4,4,4,4,4,4,4,4,4,4,5,5,5},{5,3,4,4,4,4,4,4,4,4,4,4,4,4,5,5},{3,3,4,4,4,4,4,4,4,4,4,4,4,4,4,5},{4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4},
  // Lignes 8 à 11.
  {4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4},{5,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4},{5,5,4,4,4,4,4,4,4,4,4,4,4,4,4,4},{5,5,5,4,4,4,4,4,4,4,4,4,4,4,4,4},
  // Lignes 12 à 15.
  {5,5,5,5,4,4,4,4,4,4,4,4,4,4,4,4},{5,5,5,5,5,4,4,4,4,4,4,4,4,4,4,4},{5,5,5,5,5,5,4,4,4,4,4,4,4,4,4,4},{5,5,5,5,5,5,5,4,4,4,4,4,4,4,4,4}};
// level8 : écart entre le nombre de retours et le numéro de retour, 7 au plus.
static inline U32 level8(U32 n, U32 r) { U32 d = n > r ? n - r : r - n; return d > 7 ? 7 : d; }

// P14 : un point (coordonnées, intensité, numéro de retour, nombre de retours, classe, canal, changement de temps GPS).
typedef struct { I32 X, Y, Z; U16 intensity; U8 r, n, classification, channel, gps_change; } P14;
// Ctx : le contexte de décodage d'un canal (début).
typedef struct {
  // Inutilisé ou non ; dernier point.
  int unused; P14 last;
  // Modèles des changements, du canal, du nombre de retours, du numéro de retour et de la classe.
  Model *changed[8], *channel, *nret[16], *rn_gps_same, *rn[16], *cls[64];
  // Décompresseurs de X, Y, Z et de l'intensité.
  IC *dX, *dY, *icZ, *icI;
  // Médianes de X et de Y ; derniers Z et dernières intensités.
  Med5 mx[12], my[12]; I32 lastZ[8]; U16 lastI[8];
// Fin de Ctx.
} Ctx;
// ctx_init : prépare un contexte à partir d'un point (début).
static void ctx_init(Ctx *c, const P14 *p) {
  // Huit modèles de changements.
  for (int i = 0; i < 8; i++) c->changed[i] = model_new(128);
  // Modèle du canal.
  c->channel = model_new(3);
  // Modèle du numéro de retour à temps GPS inchangé.
  c->rn_gps_same = model_new(13);
  // Décompresseurs de X, Y, Z et de l'intensité.
  c->dX = ic_new(32, 2); c->dY = ic_new(32, 22); c->icZ = ic_new(32, 20); c->icI = ic_new(16, 4);
  // Médianes à zéro.
  for (int i = 0; i < 12; i++) { med_init(&c->mx[i]); med_init(&c->my[i]); }
  // Derniers Z et intensités : ceux du point.
  for (int i = 0; i < 8; i++) { c->lastZ[i] = p->Z; c->lastI[i] = p->intensity; }
  // Dernier point ; contexte utilisé.
  c->last = *p; c->last.gps_change = 0; c->unused = 0;
// Fin de ctx_init.
}
// ctx_free : libère un contexte (début).
static void ctx_free(Ctx *c) {
  // Inutilisé : rien.
  if (c->unused) return;
  // Libère les modèles des changements.
  for (int i = 0; i < 8; i++) model_free(c->changed[i]);
  // Ceux du nombre et du numéro de retour.
  for (int i = 0; i < 16; i++) { model_free(c->nret[i]); model_free(c->rn[i]); }
  // Ceux de la classe.
  for (int i = 0; i < 64; i++) model_free(c->cls[i]);
  // Ceux du canal et du temps GPS inchangé.
  model_free(c->channel); model_free(c->rn_gps_same);
  // Les quatre décompresseurs.
  ic_free(c->dX); ic_free(c->dY); ic_free(c->icZ); ic_free(c->icI);
// Fin de ctx_free.
}
// rd32 : lit un entier de 32 bits, octet de poids faible en premier.
static inline U32 rd32(const U8 *p) { return p[0] | (p[1] << 8) | (p[2] << 16) | ((U32)p[3] << 24); }

// Structures sans remplissage (début).
#pragma pack(push, 1)
// Out : un point écrit en sortie, 16 octets.
typedef struct { I32 X, Y, Z; U16 intensity; U8 classification, level; } Out;
// Fin des structures sans remplissage.
#pragma pack(pop)

// Décode un bloc (un nœud COPC). Renvoie le nombre de points écrits dans `out`, ou -1.
static unsigned long long odd_returns = 0;
// decode_chunk : décode un bloc (début).
static long decode_chunk(const U8 *buf, size_t size, U32 count, Out *out, U8 level) {
  // Bloc trop court, ou sans point : échec.
  if (size < 30 + 4 + 36 || count == 0) return -1;
  // Premier point, à zéro.
  P14 first; memset(&first, 0, sizeof(first));
  // Ses coordonnées, lues telles quelles.
  first.X = (I32)rd32(buf); first.Y = (I32)rd32(buf + 4); first.Z = (I32)rd32(buf + 8);
  // Son intensité.
  first.intensity = (U16)(buf[12] | (buf[13] << 8));
  // Son numéro et son nombre de retours, son canal et sa classe.
  first.r = buf[14] & 15; first.n = buf[14] >> 4; first.channel = (buf[15] >> 4) & 3; first.classification = buf[16];
  // Après les 30 octets du premier point.
  const U8 *p = buf + 30;
  // Saute le nombre de points.
  p += 4; // nombre de points du bloc
  // Tailles des neuf couches.
  U32 sz[9]; for (int i = 0; i < 9; i++) { sz[i] = rd32(p); p += 4; }
  // Leur total.
  U64 total = 0; for (int i = 0; i < 9; i++) total += sz[i];
  // Couches plus longues que le bloc : échec.
  if ((size_t)(p - buf) + total > size) { fprintf(stderr, "couches plus longues que le bloc (%llu > %zu)\n", (unsigned long long)total, size - (p - buf)); return -1; }
  // Décodeurs de XY, Z, classe et intensité.
  Dec dXY, dZ, dC, dI;
  // Début des couches.
  const U8 *q = p;
  // Couche XY.
  dec_init(&dXY, q, sz[0]); q += sz[0];
  // Couche Z, si elle existe.
  int hasZ = sz[1] > 0; if (hasZ) dec_init(&dZ, q, sz[1]); q += sz[1];
  // Couche des classes, si elle existe.
  int hasC = sz[2] > 0; if (hasC) dec_init(&dC, q, sz[2]); q += sz[2];
  // Saute la couche des drapeaux.
  q += sz[3];
  // Couche des intensités, si elle existe.
  int hasI = sz[4] > 0; if (hasI) dec_init(&dI, q, sz[4]);

  // Quatre contextes, un par canal, inutilisés.
  Ctx ctx[4]; memset(ctx, 0, sizeof(ctx)); for (int i = 0; i < 4; i++) ctx[i].unused = 1;
  // Canal courant : celui du premier point.
  U32 cur = first.channel;
  // Prépare son contexte.
  ctx_init(&ctx[cur], &first);
  // Écrit le premier point.
  out[0].X = first.X; out[0].Y = first.Y; out[0].Z = first.Z; out[0].intensity = first.intensity; out[0].classification = first.classification; out[0].level = level;

  // Pour chaque point suivant (début).
  for (U32 i = 1; i < count; i++) {
    // Contexte du canal et dernier point.
    Ctx *c = &ctx[cur]; P14 *L = &c->last;
    // Contexte du dernier point : retour unique, dernier retour, changement de temps GPS.
    U32 lpr = (L->r == 1 ? 1 : 0) + (L->r >= L->n ? 2 : 0) + (L->gps_change ? 4 : 0);
    // Ce qui change par rapport au dernier point.
    U32 changed = dec_symbol(&dXY, c->changed[lpr]);
    // Si le canal change (début).
    if (changed & (1 << 6)) {
      // Écart de canal.
      U32 diff = dec_symbol(&dXY, c->channel);
      // Nouveau canal.
      U32 ch = (cur + diff + 1) % 4;
      // Son contexte est préparé au besoin.
      if (ctx[ch].unused) ctx_init(&ctx[ch], &c->last);
      // Bascule sur ce canal.
      cur = ch; c = &ctx[cur]; L = &c->last; L->channel = (U8)ch;
    // Fin de ce cas.
    }
    // Changement de temps GPS.
    U32 gps_change = (changed & (1 << 4)) ? 1 : 0;
    // Dernier nombre et dernier numéro de retour.
    U32 last_n = L->n, last_r = L->r, n, r;
    // Si le nombre de retours change (début).
    if (changed & (1 << 2)) {
      // Modèle créé au besoin.
      if (!c->nret[last_n]) c->nret[last_n] = model_new(16);
      // Décode le nouveau nombre.
      n = dec_symbol(&dXY, c->nret[last_n]); L->n = (U8)n;
    // Sinon : le même.
    } else n = last_n;
    // Façon dont le numéro de retour change.
    U32 how = changed & 3;
    // 0 : le même.
    if (how == 0) r = last_r;
    // 1 : le suivant.
    else if (how == 1) r = (last_r + 1) % 16;
    // 2 : le précédent.
    else if (how == 2) r = (last_r + 15) % 16;
    // Autre, à temps GPS changé (début).
    else if (gps_change) {
      // Modèle créé au besoin.
      if (!c->rn[last_r]) c->rn[last_r] = model_new(16);
      // Décode le numéro.
      r = dec_symbol(&dXY, c->rn[last_r]);
    // Autre, à temps GPS inchangé : décode un écart d'au moins 2.
    } else { U32 sym = dec_symbol(&dXY, c->rn_gps_same); r = (last_r + (sym + 2)) % 16; }
    // Garde le numéro de retour.
    L->r = (U8)r;
    // Contexte des médianes XY (number_return_map_6ctx) : retour unique 0 ; premier de deux 1 ; dernier de deux 2 ;
    // premier de trois ou plus 3 ; dernier 5 ; intermédiaire 4. Cas invalides (r = 0, r > n) : table d'origine.
    U32 m = (n >= 1 && r >= 1 && r <= n) ? (n == 1 ? 0 : n == 2 ? r : r == 1 ? 3 : r == n ? 5 : 4) : MAP6[n][r];
    // Niveau pour Z.
    U32 l = level8(n, r);
    // Couple invalide : compté.
    if (!(n >= 1 && r >= 1 && r <= n)) odd_returns++;
    // Contexte : premier retour, dernier retour.
    U32 cpr = (r == 1 ? 2 : 0) + (r >= n ? 1 : 0);
    // Indice des médianes.
    U32 mi = (m << 1) | gps_change;
    // Médiane des écarts en X.
    I32 median = c->mx[mi].v[2];
    // Décode l'écart en X.
    I32 diff = ic_decompress(c->dX, &dXY, median, n == 1);
    // Nouveau X ; l'écart entre dans la médiane.
    L->X = (I32)((U32)L->X + (U32)diff); med_add(&c->mx[mi], diff);
    // Médiane des écarts en Y.
    median = c->my[mi].v[2];
    // Nombre de bits utilisé pour X.
    U32 kb = c->dX->k;
    // Décode l'écart en Y.
    diff = ic_decompress(c->dY, &dXY, median, (n == 1) + (kb < 20 ? (kb & ~1u) : 20));
    // Nouveau Y ; l'écart entre dans la médiane.
    L->Y = (I32)((U32)L->Y + (U32)diff); med_add(&c->my[mi], diff);
    // S'il y a une couche Z (début).
    if (hasZ) {
      // Moyenne des bits utilisés pour X et Y.
      kb = (c->dX->k + c->dY->k) / 2;
      // Décode Z à partir du dernier Z du même niveau.
      L->Z = ic_decompress(c->icZ, &dZ, c->lastZ[l], (n == 1) + (kb < 18 ? (kb & ~1u) : 18));
      // Garde ce Z.
      c->lastZ[l] = L->Z;
    // Fin de ce cas.
    }
    // S'il y a une couche des classes (début).
    if (hasC) {
      // Contexte : la dernière classe et le retour unique.
      U32 ccc = ((L->classification & 0x1F) << 1) + (cpr == 3 ? 1 : 0);
      // Modèle créé au besoin.
      if (!c->cls[ccc]) c->cls[ccc] = model_new(256);
      // Décode la classe.
      L->classification = (U8)dec_symbol(&dC, c->cls[ccc]);
    // Fin de ce cas.
    }
    // S'il y a une couche des intensités (début).
    if (hasI) {
      // Contexte de l'intensité.
      U32 ii = (cpr << 1) | gps_change;
      // Décode l'intensité à partir de la dernière du même contexte.
      U16 v = (U16)ic_decompress(c->icI, &dI, c->lastI[ii], cpr);
      // La garde.
      c->lastI[ii] = v; L->intensity = v;
    // Fin de ce cas.
    }
    // Garde le changement de temps GPS.
    L->gps_change = (U8)gps_change;
    // Écrit le point.
    out[i].X = L->X; out[i].Y = L->Y; out[i].Z = L->Z; out[i].intensity = L->intensity; out[i].classification = L->classification; out[i].level = level;
  // Fin de la boucle.
  }
  // Octets lus au-delà des couches.
  int over = dXY.overrun + (hasZ ? dZ.overrun : 0) + (hasC ? dC.overrun : 0) + (hasI ? dI.overrun : 0);
  // Libère les quatre contextes.
  for (int i = 0; i < 4; i++) ctx_free(&ctx[i]);
  // Plus de 8 octets lus en trop : échec.
  if (over > 8) { fprintf(stderr, "lecture au-delà des couches (%d octets)\n", over); return -1; }
  // Renvoie le nombre de points.
  return (long)count;
// Fin de decode_chunk.
}

// Usage : lazdec fichier.copc.laz liste.txt sortie.bin   — liste : « niveau offset taille points minx miny minz cote » par ligne (entiers, cm)
int main(int argc, char **argv) {
  // Moins de trois arguments : usage et code 2.
  if (argc < 4) { fprintf(stderr, "usage: lazdec <laz> <liste> <sortie>\n"); return 2; }
  // Ouvre le fichier LAZ, la liste et la sortie.
  FILE *f = fopen(argv[1], "rb"), *list = fopen(argv[2], "r"), *o = fopen(argv[3], "wb");
  // Échec d'ouverture : code 2.
  if (!f || !list || !o) { perror("ouverture"); return 2; }
  // Champs d'une ligne de la liste.
  unsigned level; unsigned long long offset; unsigned size, count; long long minx, miny, minz, side;
  // Compteurs : points, points hors de leur nœud, blocs et échecs.
  unsigned long long total = 0, outside = 0, chunks = 0, failed = 0;
  // Pour chaque ligne de la liste (début).
  while (fscanf(list, "%u %llu %u %u %lld %lld %lld %lld", &level, &offset, &size, &count, &minx, &miny, &minz, &side) == 8) {
    // Alloue le bloc et les points.
    U8 *buf = malloc(size); Out *out = malloc(sizeof(Out) * (size_t)count);
    // Va au début du bloc.
    fseek(f, (long)offset, SEEK_SET);
    // Lit le bloc ; lecture incomplète : code 1.
    if (fread(buf, 1, size, f) != size) { fprintf(stderr, "lecture impossible\n"); return 1; }
    // Décode le bloc.
    long n = decode_chunk(buf, size, count, out, (U8)level);
    // Un bloc de plus.
    chunks++;
    // Échec : compté.
    if (n < 0) { failed++; }
    // Sinon (début).
    else {
      // Points hors du cube du nœud.
      unsigned long long bad = 0;
      // Pour chaque point (début).
      for (long i = 0; i < n; i++) {
        // Hors du cube : compté.
        if (out[i].X < minx || out[i].X > minx + side || out[i].Y < miny || out[i].Y > miny + side || out[i].Z < minz || out[i].Z > minz + side) bad++;
      // Fin de la boucle.
      }
      // Ajoute aux compteurs.
      outside += bad; total += (unsigned long long)n;
      // Écrit les points.
      fwrite(out, sizeof(Out), (size_t)n, o);
    // Fin du « sinon ».
    }
    // Libère le bloc et les points.
    free(buf); free(out);
  // Fin de la boucle.
  }
  // Affiche le bilan.
  fprintf(stderr, "blocs %llu (échecs %llu), points %llu, hors de leur nœud %llu, retours invalides %llu\n", chunks, failed, total, outside, odd_returns);
  // Ferme la sortie.
  fclose(o);
  // Code 1 s'il y a un échec ou un point hors de son nœud, sinon 0.
  return failed || outside ? 1 : 0;
// Fin de main.
}
