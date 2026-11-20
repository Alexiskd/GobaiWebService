/**
 * Données du « tableau hypothétique » de l'onglet « Théorie quantique » : les systèmes stellaires et substellaires
 * situés à moins de 16,3 années-lumière du Soleil — le Système solaire (rang 0, le « Solarium ») plus les 48 systèmes
 * voisins (rangs 1 à 48) — avec, pour chaque composante individuelle, son type spectral, sa distance et sa masse
 * (en masses solaires M☉ pour les étoiles, en masses joviennes M_J pour les naines brunes les plus légères).
 *
 * Repères : 1 M☉ ≈ 1,989 × 10^30 kg (≈ 333 000 masses terrestres) ; 1 M_J ≈ 1,898 × 10^27 kg (≈ 318 masses terrestres).
 */

// Un système : rang, nom, code court affiché dans la case, et ses composantes (nom, type spectral, distance en a.l., masse).
// systeme : fabrique un système à partir de son rang, de son nom, de son code et de ses composantes.
const systeme = (rang, nom, code, composantes) => ({ rang, nom, code, composantes });

// Une composante : nom, type spectral, distance (a.l., chaîne telle que publiée) et masse (chaîne telle que publiée).
// composante : fabrique une composante.
const composante = (nom, type, distance, masse) => ({ nom, type, distance, masse });

/** Les 49 systèmes (rang 0 = Système solaire, rangs 1 à 48 = les 48 voisins à moins de 16,3 a.l.), triés par distance. */
// SYSTEMES : le tableau hypothétique complet.
export const SYSTEMES = [
  systeme(0, 'Système solaire', 'Sol', [
    composante('Soleil', 'G2V (naine jaune)', '0,000016', '1,00 M☉'),
  ]),
  systeme(1, 'Alpha Centauri', 'αCen', [
    composante('Proxima Centauri (C)', 'M5.5Ve (naine rouge)', '4,25', '0,122 M☉'),
    composante('Alpha Centauri A', 'G2V (naine jaune)', '4,34', '1,079 M☉'),
    composante('Alpha Centauri B', 'K1V (naine orange)', '4,34', '0,909 M☉'),
  ]),
  systeme(2, 'Étoile de Barnard', 'Bar', [
    composante('Étoile de Barnard', 'M4.0Ve (naine rouge)', '5,96', '0,162 M☉'),
  ]),
  systeme(3, 'Luhman 16', 'Luh16', [
    composante('Luhman 16 A', 'L8 (naine brune)', '6,51', '0,032 M☉ (~33,5 M_J)'),
    composante('Luhman 16 B', 'T1 (naine brune)', '6,51', '0,027 M☉ (~28,6 M_J)'),
  ]),
  systeme(4, 'WISE 0855−0714', 'W0855', [
    composante('WISE 0855−0714', 'Y4 (sous-naine brune)', '7,43', '0,003 – 0,010 M☉ (~3 à 10 M_J)'),
  ]),
  systeme(5, 'Wolf 359', 'W359', [
    composante('Wolf 359 (CN Leonis)', 'M6.0V (naine rouge)', '7,86', '0,110 M☉'),
  ]),
  systeme(6, 'Lalande 21185', 'Lal21', [
    composante('Lalande 21185', 'M2.0V (naine rouge)', '8,30', '0,389 M☉'),
  ]),
  systeme(7, 'Sirius', 'Sir', [
    composante('Sirius A', 'A1V (étoile blanche)', '8,71', '2,063 M☉'),
    composante('Sirius B', 'DA2 (naine blanche)', '8,71', '1,018 M☉'),
  ]),
  systeme(8, 'Luyten 726-8', 'L726', [
    composante('BL Ceti (A)', 'M5.5Ve (naine rouge)', '8,77', '0,122 M☉'),
    composante('UV Ceti (B)', 'M6.0Ve (naine rouge)', '8,77', '0,120 M☉'),
  ]),
  systeme(9, 'Ross 154', 'R154', [
    composante('Ross 154', 'M3.5Ve (naine rouge)', '9,71', '0,177 M☉'),
  ]),
  systeme(10, 'Ross 248', 'R248', [
    composante('Ross 248', 'M5.5Ve (naine rouge)', '10,31', '0,136 M☉'),
  ]),
  systeme(11, 'Epsilon Eridani', 'εEri', [
    composante('Epsilon Eridani (Ran)', 'K2V (naine orange)', '10,47', '0,820 M☉'),
  ]),
  systeme(12, 'Lacaille 9352', 'L9352', [
    composante('Lacaille 9352', 'M0.5V (naine rouge)', '10,72', '0,486 M☉'),
  ]),
  systeme(13, 'Ross 128', 'R128', [
    composante('Ross 128', 'M4.0Vn (naine rouge)', '11,01', '0,168 M☉'),
  ]),
  systeme(14, 'EZ Aquarii', 'EZAqr', [
    composante('EZ Aquarii A', 'M5.0Ve (naine rouge)', '11,11', '0,118 M☉'),
    composante('EZ Aquarii B', 'M (naine rouge)', '11,11', '0,114 M☉'),
    composante('EZ Aquarii C', 'M (naine rouge)', '11,11', '0,093 M☉'),
  ]),
  systeme(15, '61 Cygni', '61Cyg', [
    composante('61 Cygni A', 'K5V (naine orange)', '11,40', '0,700 M☉'),
    composante('61 Cygni B', 'K7V (naine orange)', '11,40', '0,630 M☉'),
  ]),
  systeme(16, 'Procyon', 'Pro', [
    composante('Procyon A', 'F5IV-V (sous-géante)', '11,40', '1,499 M☉'),
    composante('Procyon B', 'DA (naine blanche)', '11,40', '0,602 M☉'),
  ]),
  systeme(17, 'Struve 2398', 'Str24', [
    composante('Gliese 725 A', 'M3.0V (naine rouge)', '11,49', '0,334 M☉'),
    composante('Gliese 725 B', 'M3.5V (naine rouge)', '11,49', '0,248 M☉'),
  ]),
  systeme(18, 'Groombridge 34', 'Gro34', [
    composante('Gliese 15 A', 'M1.5V (naine rouge)', '11,62', '0,380 M☉'),
    composante('Gliese 15 B', 'M3.5V (naine rouge)', '11,62', '0,150 M☉'),
  ]),
  systeme(19, 'DX Cancri', 'DXCnc', [
    composante('DX Cancri', 'M6.5Ve (naine rouge)', '11,68', '0,090 M☉'),
  ]),
  systeme(20, 'Epsilon Indi', 'εInd', [
    composante('Epsilon Indi A', 'K5V (naine orange)', '11,87', '0,754 M☉'),
    composante('Epsilon Indi Ba', 'T1.5 (naine brune)', '11,87', '0,072 M☉ (~75 M_J)'),
    composante('Epsilon Indi Bb', 'T6 (naine brune)', '11,87', '0,067 M☉ (~70 M_J)'),
  ]),
  systeme(21, 'Tau Ceti', 'τCet', [
    composante('Tau Ceti', 'G8.5V (naine jaune)', '11,88', '0,783 M☉'),
  ]),
  systeme(22, 'GJ 1061', 'GJ1061', [
    composante('GJ 1061', 'M5.5V (naine rouge)', '11,98', '0,125 M☉'),
  ]),
  systeme(23, 'YZ Ceti', 'YZCeti', [
    composante('YZ Ceti', 'M4.5V (naine rouge)', '12,12', '0,130 M☉'),
  ]),
  systeme(24, 'Étoile de Luyten', 'Luy', [
    composante('Étoile de Luyten', 'M3.5Vn (naine rouge)', '12,35', '0,290 M☉'),
  ]),
  systeme(25, 'Étoile de Teegarden', 'Tee', [
    composante('Étoile de Teegarden', 'M7V (naine rouge)', '12,50', '0,097 M☉'),
  ]),
  systeme(26, 'Étoile de Kapteyn', 'Kap', [
    composante('Étoile de Kapteyn', 'sdM1 (sous-naine rouge)', '12,83', '0,281 M☉'),
  ]),
  systeme(27, 'Lacaille 8760', 'L8760', [
    composante('Lacaille 8760', 'M0Ve (naine rouge)', '12,95', '0,600 M☉'),
  ]),
  systeme(28, 'Kruger 60', 'Kru60', [
    composante('Kruger 60 A', 'M3.0V (naine rouge)', '13,07', '0,271 M☉'),
    composante('Kruger 60 B', 'M4.0V (naine rouge)', '13,07', '0,176 M☉'),
  ]),
  systeme(29, 'DENIS J1048−3956', 'DJ1048', [
    composante('DENIS J1048−3956', 'M8.5V (naine rouge/brune)', '13,19', '0,075 M☉ (~78 M_J)'),
  ]),
  systeme(30, 'Ross 614', 'R614', [
    composante('Ross 614 A', 'M4.5V (naine rouge)', '13,34', '0,223 M☉'),
    composante('Ross 614 B', 'M8V (naine rouge)', '13,34', '0,111 M☉'),
  ]),
  systeme(31, 'UGPS J0722−0540', 'UG0722', [
    composante('UGPS J0722−0540', 'T9 (naine brune)', '13,43', '0,010 – 0,025 M☉ (~10 à 26 M_J)'),
  ]),
  systeme(32, 'Wolf 1061', 'W1061', [
    composante('Wolf 1061', 'M3.0V (naine rouge)', '14,05', '0,294 M☉'),
  ]),
  systeme(33, 'Étoile de Van Maanen', 'vMaa', [
    composante('Étoile de Van Maanen', 'DZ7 (naine blanche)', '14,07', '0,680 M☉'),
  ]),
  systeme(34, 'Gliese 1', 'GJ1', [
    composante('Gliese 1', 'M1.5V (naine rouge)', '14,17', '0,330 M☉'),
  ]),
  systeme(35, 'TZ Arietis', 'TZAri', [
    composante('TZ Arietis', 'M4.5V (naine rouge)', '14,58', '0,150 M☉'),
  ]),
  systeme(36, 'Wolf 424', 'W424', [
    composante('Wolf 424 A', 'M5.5Ve (naine rouge)', '14,60', '0,143 M☉'),
    composante('Wolf 424 B', 'M7Ve (naine rouge)', '14,60', '0,131 M☉'),
  ]),
  systeme(37, 'Gliese 687', 'GJ687', [
    composante('Gliese 687', 'M3.0V (naine rouge)', '14,84', '0,401 M☉'),
  ]),
  systeme(38, 'Gliese 674', 'GJ674', [
    composante('Gliese 674', 'M3.0V (naine rouge)', '14,85', '0,350 M☉'),
  ]),
  systeme(39, 'LHS 292', 'L292', [
    composante('LHS 292', 'M6.5V (naine rouge)', '14,87', '0,083 M☉'),
  ]),
  systeme(40, 'LP 145-141', 'LP145', [
    composante('LP 145-141', 'DQ6 (naine blanche)', '15,12', '0,750 M☉'),
  ]),
  systeme(41, 'GJ 1245', 'GJ1245', [
    composante('GJ 1245 A', 'M5.5V (naine rouge)', '15,20', '0,111 M☉'),
    composante('GJ 1245 B', 'M6.0V (naine rouge)', '15,20', '0,101 M☉'),
    composante('GJ 1245 C', 'M8V (naine rouge)', '15,20', '0,074 M☉'),
  ]),
  systeme(42, 'Gliese 876', 'GJ876', [
    composante('Gliese 876', 'M3.5V (naine rouge)', '15,24', '0,346 M☉'),
  ]),
  systeme(43, 'LHS 288', 'L288', [
    composante('LHS 288', 'M5.5V (naine rouge)', '15,76', '0,110 M☉'),
  ]),
  systeme(44, 'Gliese 1002', 'GJ1002', [
    composante('Gliese 1002', 'M5.5V (naine rouge)', '15,81', '0,120 M☉'),
  ]),
  systeme(45, 'DENIS J0255−4700', 'DJ0255', [
    composante('DENIS J0255−4700', 'L7.5V (naine brune)', '15,88', '0,025 – 0,065 M☉ (~26 à 68 M_J)'),
  ]),
  systeme(46, 'Groombridge 1618', 'Gro1618', [
    composante('Groombridge 1618', 'K7.5Ve (naine orange)', '15,89', '0,670 M☉'),
  ]),
  systeme(47, 'AD Leonis', 'ADLeo', [
    composante('AD Leonis', 'M3.0V (naine rouge)', '16,19', '0,420 M☉'),
  ]),
  systeme(48, '40 Eridani', '40Eri', [
    composante('40 Eridani A', 'K0.5V (naine orange)', '16,33', '0,780 M☉'),
    composante('40 Eridani B', 'DA4 (naine blanche)', '16,33', '0,573 M☉'),
    composante('40 Eridani C', 'M4.5e (naine rouge)', '16,33', '0,204 M☉'),
  ]),
];

/** Nombre de systèmes du tableau hypothétique (le Système solaire + les 48 voisins). */
// countSystemes : le nombre de systèmes.
export const countSystemes = () => SYSTEMES.length;

/** Nombre total de composantes individuelles de tous les systèmes. */
// countComposantes : la somme des composantes de chaque système.
export const countComposantes = () => SYSTEMES.reduce((n, s) => n + s.composantes.length, 0);

/** Le système Alpha Centauri, qui contient Proxima Centauri (le « Proximium » de la théorie). */
// ALPHA_CENTAURI : le système rang 1.
export const ALPHA_CENTAURI = SYSTEMES.find((s) => s.rang === 1);
