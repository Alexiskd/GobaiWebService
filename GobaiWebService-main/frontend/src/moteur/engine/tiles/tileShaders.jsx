// Shader des tuiles : image du fournisseur + calque optionnel (routes, noms) fondu dans le même passage,
// puis éclairage jour/nuit. `airless` = 1 pour un astre sans atmosphère (Lune) : terminateur net, réflexion de
// Lommel-Seeliger (disque uniformément brillant), nuit éclairée par la lumière cendrée, pas de halo bleu.
// `surfModel` = 1 pour la Terre : modèle d'éclairage physique (surfaceLight.jsx) — lumière du Soleil atténuée par
// l'air, lumière du ciel, relief éclairé par le vrai Soleil, reflet du Soleil sur la mer ; le voile bleu du limbe est
// laissé à la coquille de diffusion de l'atmosphère. Les autres astres gardent le modèle général, inchangé.
// Compatible tampon de profondeur logarithmique.

// Importe les GLSL d'éclairage : modèle général et modèle de la Terre, depuis surfaceLight.
import { EARTH_LIGHT_GLSL, GENERIC_LIGHT_GLSL } from '../surfaceLight';

// Déclare et exporte le shader de sommets des tuiles (début).
export const tileVertexShader = [
  // Inclusion de three.js : fonctions communes.
  '#include <common>',
  // Inclusion de three.js : déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_vertex>',
  // Variables transmises au shader de fragments : coordonnées de texture, normale et direction de la caméra.
  'varying vec2 vUv;varying vec3 vN;varying vec3 vV;',
  // Directions de l'est et du nord au sommet, dans le repère de la caméra : pente du relief éclairée par le Soleil (Terre).
  'varying vec3 vE;varying vec3 vNo;',
  // Relief (voir relief.jsx) : hMap = tuile d'altitude Terrarium, hRect = portion affichée par cette tuile, hHas = 1 quand
  // elle est chargée, hUnit = 1 / rayon de l'astre en mètres, reliefExag = exagération (0 : relief coupé).
  // Le sommet est soulevé le long de sa normale ; le fond des mers (altitudes négatives) reste à 0, sauf avec le fond
  // des océans (oceanOn) : là où la terre est à 0 ou moins, le sommet descend à la profondeur lue dans oMap (tuile de
  // profondeurs, portion oRect, oHas = 1 quand elle est chargée). Même calcul que seaFloorMeters (relief.jsx) ; un
  // pixel sans donnée (noir, −32768 m) vaut 0.
  // Variables uniformes du relief : la tuile d'altitude, sa portion affichée, sa présence, l'unité de hauteur et l'exagération.
  'uniform sampler2D hMap;uniform vec4 hRect;uniform float hHas;uniform float hUnit;uniform float reliefExag;',
  // Variables uniformes du fond des océans : la tuile de profondeurs, sa portion, sa présence et l'interrupteur.
  'uniform sampler2D oMap;uniform vec4 oRect;uniform float oHas;uniform float oceanOn;',
  // tDec : décode une altitude en mètres à partir d'un pixel ; en dessous de −11 500 m, pixel sans donnée, 0.
  'float tDec(vec4 t){float h=t.r*65280.+t.g*255.+t.b*.99609375-32768.;return h<-11500.?0.:h;}',
  // hMeters : altitude d'un point de la tuile ; sans fond des océans, jamais négative ; sur terre, l'altitude lue.
  'float hMeters(vec2 q){float h=tDec(texture2D(hMap,hRect.xy+q*hRect.zw));if(oceanOn<.5)return max(0.,h);if(h>.5)return h;',
  // En mer : la profondeur lue dans la tuile de profondeurs, bornée entre −11 500 et 0, ou à défaut l'altitude négative de la tuile de relief.
  'if(oHas>.5)return clamp(tDec(texture2D(oMap,oRect.xy+q*oRect.zw)),-11500.,0.);return min(0.,h);}',
  // Fonction principale : coordonnées de texture, normale dans le repère de la caméra et position du sommet.
  'void main(){vUv=uv;vN=normalize(normalMatrix*normal);vec3 p=position;',
  // Est : perpendiculaire à l'axe des pôles (+Y) et à la normale ; au pôle, où il n'est pas défini, l'axe x.
  'vec3 ea=vec3(normal.z,0.,-normal.x);float el=length(ea);ea=el>1e-5?ea/el:vec3(1.,0.,0.);',
  // Est et nord (normale × est) passés dans le repère de la caméra.
  'vE=normalize((modelViewMatrix*vec4(ea,0.)).xyz);vNo=normalize((modelViewMatrix*vec4(cross(normal,ea),0.)).xyz);',
  // Avec une tuile d'altitude et une exagération : le sommet est déplacé le long de sa normale.
  'if(hHas>.5&&reliefExag>0.){p+=normal*(hMeters(uv)*hUnit*reliefExag);}',
  // Position dans le repère de la caméra, direction vers la caméra et position à l'écran.
  'vec4 mv=modelViewMatrix*vec4(p,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;',
  // Inclusion de la profondeur logarithmique.
  '#include <logdepthbuf_vertex>',
  // Fin de la fonction principale.
  '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

/**
 * Détail simulé (« zoom modélisé ») pour les astres dont les cartes s'arrêtent tôt : géantes gazeuses (USGS, niveau 5)
 * et satellites naturels. Au-delà de la résolution réelle de l'image, un bruit fractal prend le relais pour que le
 * zoom continue de révéler de la structure au lieu d'un aplat flou. Ce n'est PAS une observation : l'interface le
 * signale (voir TileManager.snapshot, `synthetic`).
 *
 *  detail     (type, force) partagé par toutes les tuiles de l'astre : type 1 = gaz (stries zonales étirées en
 *             longitude), type 2 = sol (grain et petits cratères) ; 0 = désactivé.
 *  tileCoord  (x, y, z) de la tuile.
 *
 * Continuité : le bruit vit sur un treillis absolu de l'astre (cellule = (x + u)·2^(L−z) au niveau L), donc identique
 * d'une tuile à l'autre et d'un niveau à l'autre, sans couture. Les indices de cellule sont réduits modulo 1024 avant
 * d'ajouter la partie fractionnaire : précision intacte en flottants 32 bits jusqu'au niveau 22.
 * Quatre octaves glissent avec la taille du pixel à l'écran (cellules de 64 à 8 px) : zoom fractal sans à-coup.
 * Une octave n'apparaît que si ses cellules sont plus fines que 4 pixels de l'image réelle (poids `smoothstep`) :
 * tant que la carte est nette, rien n'est ajouté.
 */
// Lignes GLSL du détail simulé (début du tableau).
const detailShader = [
  // dHash : nombre pseudo-aléatoire entre 0 et 1 à partir d'une cellule.
  'float dHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
  // Bruit de valeur périodique : `per` cellules en longitude (raccord au méridien ±180°), `pery` en latitude (modulo du treillis).
  // dNoise : bruit lissé et périodique ; partie entière, partie fractionnaire et courbe de lissage.
  'float dNoise(vec2 p,float per,float pery){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
  // Les deux colonnes et les deux lignes voisines, ramenées dans la période.
  'float x0=mod(i.x,per),x1=mod(i.x+1.,per),y0=mod(i.y,pery),y1=mod(i.y+1.,pery);',
  // Interpolation entre les quatre valeurs voisines.
  'return mix(mix(dHash(vec2(x0,y0)),dHash(vec2(x1,y0)),f.x),mix(dHash(vec2(x0,y1)),dHash(vec2(x1,y1)),f.x),f.y);}',
  // Un cratère au plus par cellule (une cellule sur cinq) : fond sombre, rempart clair.
  // dCrater : cratère éventuel d'une cellule ; rien si le tirage de la cellule est inférieur à 0,78.
  'float dCrater(vec2 p,float per,float pery){vec2 i=floor(p),f=fract(p);vec2 c=vec2(mod(i.x,per),mod(i.y,pery));float h=dHash(c+3.7);if(h<.78)return 0.;',
  // Centre du cratère, son rayon et la distance du point au centre, en rayons.
  'vec2 o=.5+.5*(vec2(dHash(c+1.3),dHash(c+2.9))-.5);float r=.1+.22*dHash(c+5.1);float d=length(f-o)/r;',
  // Renvoie un rempart clair autour d'un rayon et un fond sombre à l'intérieur.
  'return (smoothstep(.6,1.,d)-smoothstep(1.,1.5,d))*.32-(1.-smoothstep(0.,.95,d))*.3;}',
  // synthDetail : ajoute le détail simulé à une couleur (début).
  'vec3 synthDetail(vec3 col){',
  // Taille d'un pixel d'écran en coordonnées de texture.
  'float fw=max(max(length(dFdx(vUv)),length(dFdy(vUv))),1e-7);',
  // Niveau du treillis dont une cellule fait un pixel d'écran.
  'float lod=tileCoord.z-log2(fw);',                 // niveau du treillis dont une cellule fait 1 px d'écran
  // Niveau d'un pixel de l'image réelle.
  'float lnat=tileCoord.z+log2(baseRect.w)+8.;',     // niveau d'un pixel de l'image réelle (tuiles de 256 px)
  // Niveau de base des octaves, sa partie entière et sa partie fractionnaire ; somme du bruit à 0.
  'float b=lod-6.;float l0=floor(b),fr=b-l0;float n=0.;',
  // Pour quatre octaves : son niveau et son poids, en cloche, annulé tant que l'image réelle est assez fine.
  'for(int k=0;k<4;k++){float fk=float(k);float L=l0+fk;float w=sin(3.14159265*(fk+1.-fr)*.25);w*=w*smoothstep(lnat-2.,lnat,L);',
  // Octave de poids négligeable : sautée ; sinon, nombre de cellules par tuile et période du bruit.
  'if(w<.001)continue;float s=exp2(L-tileCoord.z);float per=exp2(clamp(L+1.,4.,10.));',
  // Position du point dans le treillis de l'astre, les indices étant réduits modulo 1024.
  'vec2 p=vec2(mod(tileCoord.x*s,1024.)+vUv.x*s,mod(tileCoord.y*s,1024.)+(1.-vUv.y)*s);',
  // Gaz : cellules 4 fois plus longues en longitude (stries le long des bandes), ondulées par l'octave elle-même.
  // Gaz : cellules étirées en longitude et ondulées, bruit ajouté avec le poids de l'octave.
  'if(detail.x<1.5){vec2 q=vec2(p.x*.25,p.y);q.y+=.6*(dNoise(q*.5+17.,per*.125,512.)-.5);n+=w*(dNoise(q,per*.25,1024.)-.5);}',
  // Sol : grain et cratères ajoutés avec le poids de l'octave. Fin de la boucle.
  'else{n+=w*((dNoise(p,per,1024.)-.5)*.7+dCrater(p*.5,per*.5,512.));}}',
  // Renvoie la couleur multipliée par 1 plus la force du détail fois le bruit. Fin de synthDetail.
  'return col*(1.+detail.y*n);}',
// Fin du tableau.
];

// Déclare et exporte le shader de fragments des tuiles (début).
export const tileFragmentShader = [
  // Inclusion de three.js : déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Variables uniformes : l'image, le calque et son interrupteur, la direction du Soleil, l'ombre, l'astre sans air, les portions de l'image et du calque, et le mode du calque.
  'uniform sampler2D map;uniform sampler2D ovMap;uniform float ovOn;uniform vec3 sunV;uniform float shade;uniform float airless;uniform vec4 baseRect;uniform vec4 ovRect;uniform float ovMode;',
  // Variables uniformes : la texture globale des couleurs, son interrupteur, sa portion et le mode d'affinage par le détail.
  'uniform sampler2D colorMap;uniform float colorOn;uniform vec4 globalRect;uniform float panOn;',
  // Variables uniformes : l'image de l'ancêtre, sa portion, le fondu et la lumière cendrée.
  'uniform sampler2D parentMap;uniform vec4 parentRect;uniform float fade;uniform float earthshine;',
  // alpha : opacité de la cellule pendant un fondu entre deux niveaux (voir hexDisplay.jsx). Hors fondu le matériau est
  // opaque et la valeur est ignorée.
  // Variable uniforme : l'opacité de la cellule.
  'uniform float alpha;',
  // Accord des couleurs entre les couches : gain et décalage par canal de la source de l'image (1 et 0 sans correction).
  // Variables uniformes : gain et décalage des couleurs, pour l'image et pour l'ancêtre.
  'uniform vec3 colGain;uniform vec3 colOff;uniform vec3 parGain;uniform vec3 parOff;',
  // Ombrage du relief. Avec altitudes (hHas) : pente lue dans la tuile d'altitude, interpolée entre ses 4 pixels voisins
  // (hSlope = 1 / (2 × taille au sol d'un pixel), en 1/m). Sans altitudes (reliefImg > 0) : pente estimée d'après la
  // luminosité de l'image elle-même. Dans les deux cas un éclairage fixe venu du nord-ouest, comme sur une carte.
  // Variables uniformes de l'ombrage du relief : la tuile d'altitude, sa portion, sa présence, sa pente, sa taille, l'exagération et les deux forces d'ombrage.
  'uniform sampler2D hMap;uniform vec4 hRect;uniform float hHas;uniform float hSlope;uniform float hSize;uniform float reliefExag;uniform float reliefShade;uniform float reliefImg;',
  // hTex : altitude d'un pixel de la tuile d'altitude, jamais négative.
  'float hTex(vec2 q){vec4 t=texture2D(hMap,q);float h=t.r*65280.+t.g*255.+t.b*.99609375-32768.;return oceanOn>.5?(h<-11500.?0.:h):max(0.,h);}',
  // Fond des océans : profondeur (≤ 0) lue dans la tuile de profondeurs, pixel sans donnée à 0 ; oSlope et oSize comme
  // hSlope et hSize, oBoost = accentuation de l'ombrage des fonds (pentes douces).
  // Variables uniformes du fond des océans : la tuile de profondeurs, sa portion, sa présence, l'interrupteur, sa pente, sa taille et son accentuation.
  'uniform sampler2D oMap;uniform vec4 oRect;uniform float oHas;uniform float oceanOn;uniform float oSlope;uniform float oSize;uniform float oBoost;',
  // oTex : profondeur d'un pixel, négative ou nulle ; 0 pour un pixel sans donnée.
  'float oTex(vec2 q){vec4 t=texture2D(oMap,q);float h=t.r*65280.+t.g*255.+t.b*.99609375-32768.;return h<-11500.?0.:min(0.,h);}',
  // reliefLight : éclairement d'une pente par une lumière fixe, rapporté à celui d'un terrain plat et borné entre 0,4 et 1,7.
  'float reliefLight(vec2 s){return clamp(dot(normalize(vec3(-s.x,-s.y,1.)),vec3(-.5025,.5025,.7035))/.7035,.4,1.7);}',
  // Pollution lumineuse (atlas 2025 de David Lorenz en couleurs naturelles, voir nightLights.jsx), continue à toutes
  // les échelles : trois images, de la plus fine à la plus grossière.
  //  - ltMap : la tuile de l'atlas qui couvre la tuile affichée (niveau 6 au plus, ≈ 600 m par pixel), sa portion et sa
  //    présence ; ltFade la fait apparaître en fondu par-dessus la suivante ;
  //  - lpMap : une tuile ancêtre déjà chargée, posée tout de suite en attendant la fine, sa portion et sa présence ;
  //  - lgMap : la mosaïque mondiale (2 048 px), chargée dès que les lumières sont allumées et toujours présente, lue
  //    avec globalRect : jamais de trou pendant les chargements.
  // ltSize / lgSize : côté de ces images en pixels (choix du niveau de détail). ltLinear = 1 : images stockées en sRGB
  // sur la carte graphique, lues en lumière linéaire, si bien que les mipmaps moyennent la lumière et non ses valeurs
  // d'affichage (une petite ville lointaine garde sa lumière, au lieu de s'éteindre).
  // Variables uniformes des lumières : tuile fine, ancêtre, fondu, interrupteur.
  'uniform sampler2D ltMap;uniform vec4 ltRect;uniform float ltHas;uniform sampler2D lpMap;uniform vec4 lpRect;uniform float lpHas;uniform float ltFade;uniform float lightsOn;',
  // Mosaïque mondiale, sa présence, la vue « toute la Terre de nuit », les côtés des images et la lecture linéaire.
  'uniform sampler2D lgMap;uniform float lgOn;uniform float lightView;uniform vec2 ltSize;uniform vec2 lgSize;uniform float ltLinear;',
  // lightLod : niveau de détail isotrope d'une image à ce pixel, d'après les dérivées de la position (log₂ des pixels
  // d'image par pixel d'écran ; négatif = agrandie). Les dérivées sont calculées hors de toute condition.
  'float lightLod(vec2 dx,vec2 dy,vec2 sz){return log2(max(max(length(dx*sz),length(dy*sz)),1e-6));}',
  // lightBase : niveau de détail naturel de la lecture en cours (posé par lightCore et cityHalo), pour le repli ci-dessous.
  'float lightBase=0.;',
  // Lecture avec dérivées imposées possible : WebGL 2 (texture2DGradEXT défini en textureGrad) ou extension de WebGL 1.
  '#if defined(texture2DGradEXT)||defined(GL_EXT_shader_texture_lod)',
  // Notée (agrandissement bicubique permis).
  '#define LIGHT_LOD 1',
  // lightTap : lecture avec les dérivées données, sûre dans une condition, avec le filtrage anisotrope de la carte
  // graphique (vues rasantes nettes) ; dérivées nulles : niveau 0.
  'vec3 lightTap(sampler2D m,vec2 q,vec2 dx,vec2 dy,float l){return texture2DGradEXT(m,q,dx,dy).rgb;}',
  // Sans elle (rare) :
  '#else',
  // lecture avec un biais égal à l'écart entre le niveau voulu et le niveau naturel, même résultat (sans anisotropie).
  'vec3 lightTap(sampler2D m,vec2 q,vec2 dx,vec2 dy,float l){return texture2D(m,q,l-lightBase).rgb;}',
  // Fin du choix.
  '#endif',
  // lightEnc : lumière linéaire ramenée en couleurs d'affichage par la courbe sRGB exacte (partie linéaire près du noir
  // comprise) : aller-retour sans perte, sans éclaircir ni griser les zones les plus sombres de l'atlas.
  'vec3 lightEnc(vec3 c){c=max(c,0.);return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}',
  // lightRead : lecture (dérivées, niveau voulu), ramenée en couleurs d'affichage.
  'vec3 lightRead(sampler2D m,vec2 q,vec2 dx,vec2 dy,float l){vec3 c=lightTap(m,q,dx,dy,l);return ltLinear>.5?lightEnc(c):c;}',
  // lightCore : lumière de l'image. Réduite : moyenne des mipmaps, filtrée selon l'angle de vue (anisotrope). Proche de
  // sa taille réelle : bilinéaire, net. Agrandie plus de 1,4 fois : passage progressif (jusqu'à 2,8 fois) à
  // l'interpolation bicubique (B-spline, quatre lectures bilinéaires, Sigg et Hadwiger), lisse, sans dépassement ni
  // détail inventé, sans pixels agrandis.
  'vec3 lightCore(sampler2D m,vec2 q,vec2 sz,vec2 dx,vec2 dy){float l=lightLod(dx,dy,sz);lightBase=l;if(l>0.)return lightRead(m,q,dx,dy,l);',
  // Lecture bilinéaire au niveau 0.
  'vec3 c=lightRead(m,q,vec2(0.),vec2(0.),0.);',
  // Sans lecture à dérivées imposées : bilinéaire seul (les lectures décalées du bicubique fausseraient le niveau).
  '#ifndef LIGHT_LOD',
  // Lecture simple.
  'return c;',
  // Fin du cas.
  '#endif',
  // Part du bicubique : 0 jusqu'à l = −0,5, 1 dès l = −1,5 ; nulle : la lecture bilinéaire.
  'float s=clamp(-l-.5,0.,1.);if(s<=0.)return c;',
  // Position dans la grille de pixels, partie fractionnaire, et poids cubiques.
  'vec2 t=q*sz-.5;vec2 f=fract(t),i=t-f;vec2 f2=f*f,f3=f2*f;vec2 w0=(1.-3.*f+3.*f2-f3)/6.,w1=(4.-6.*f2+3.*f3)/6.,w2=(1.+3.*f+3.*f2-3.*f3)/6.,w3=f3/6.;',
  // Poids et positions des deux lectures par axe ; dérivées nulles (niveau 0).
  'vec2 g0=w0+w1,g1=w2+w3;vec2 p0=(i-.5+w1/g0)/sz,p1=(i+1.5+w3/g1)/sz;vec2 o=vec2(0.);',
  // Les quatre lectures bilinéaires, pondérées.
  'vec3 b=g0.y*(g0.x*lightRead(m,p0,o,o,0.)+g1.x*lightRead(m,vec2(p1.x,p0.y),o,o,0.))+g1.y*(g0.x*lightRead(m,vec2(p0.x,p1.y),o,o,0.)+g1.x*lightRead(m,p1,o,o,0.));',
  // Mélange progressif du bilinéaire vers le bicubique. Fin de lightCore.
  'return mix(c,b,s);}',
  // lightKnee : courbe d'affichage douce au-dessus de 0,8, composante par composante (comme une pellicule : le rouge
  // s'approche de 1 pendant que le vert et le bleu montent encore, les cœurs passent de l'orangé au blanc) : valeurs
  // plus faibles inchangées, ordre des intensités conservé, zones 6a à 7b de l'atlas distinctes au lieu d'un aplat.
  'vec3 lightKnee(vec3 c){return mix(c,.8+.2*(1.-exp((.8-c)/.2)),step(.8,c));}',
  // Halo des villes, comme sur les photos prises depuis l'ISS (cœurs blancs, halos orangés) : technique du « bloom » de
  // three.js (mrdoob/three.js, MIT : LuminosityHighPassShader puis UnrealBloomPass) appliquée à la chaîne de mipmaps.
  // cityLight : filtre passe-haut sur la luminosité (seuil 0,35) : seules les zones les plus lumineuses (5a et plus) rayonnent.
  'float cityLight(vec3 c){return max(dot(c,vec3(.299,.587,.114))-.35,0.)*1.6;}',
  // cityHalo : quatre niveaux de plus en plus flous de la mosaïque mondiale (une seule image : pas de raccord entre tuiles,
  // ni à l'antiméridien), pondérés comme UnrealBloomPass (facteurs 1 ; 0,8 ; 0,6 ; 0,4 rapprochés avec un rayon de 0,4).
  // Chaque niveau ne compte que s'il floute vraiment à l'écran (niveau l + k > 0) : le halo est celui d'un objectif, fort
  // de loin, il s'efface en zoomant, au lieu d'éclaircir les villes vues de près.
  // haloRead : lecture de la mosaïque au niveau k, ronde (dérivées égales sur les deux axes : halo rond à l'écran).
  'vec3 haloRead(vec2 q,float k){float e=exp2(k);return lightRead(lgMap,q,vec2(e/lgSize.x,0.),vec2(0.,e/lgSize.y),k);}',
  // Niveau de détail de la mosaïque à ce pixel.
  'vec3 cityHalo(vec2 q,vec2 dx,vec2 dy){float l=lightLod(dx,dy,lgSize),h=0.;lightBase=l;',
  // Les quatre niveaux, chacun pesé par le flou qu'il apporte.
  'h+=.68*clamp(l+1.,0.,1.)*cityLight(haloRead(q,max(l+1.,0.)));h+=.64*clamp(l+2.,0.,1.)*cityLight(haloRead(q,max(l+2.,0.)));',
  // Suite.
  'h+=.6*clamp(l+3.,0.,1.)*cityLight(haloRead(q,max(l+3.,0.)));h+=.56*clamp(l+4.,0.,1.)*cityLight(haloRead(q,max(l+4.,0.)));',
  // Halo orangé ×1,2. Fin de cityHalo.
  'return vec3(1.,.7,.4)*h*1.2;}',
  // Variables reçues du shader de sommets.
  'varying vec2 vUv;varying vec3 vN;varying vec3 vV;varying vec3 vE;varying vec3 vNo;',
  // Modèle d'éclairage (0 : général ; 1 : la Terre) ; masque de l'eau (1 = mer), lu avec globalRect, et sa présence.
  'uniform float surfModel;uniform sampler2D wMap;uniform float wOn;',
  // Fonctions d'éclairage partagées : modèle général et modèle de la Terre (surfaceLight.jsx).
  GENERIC_LIGHT_GLSL, EARTH_LIGHT_GLSL,
  // Détail simulé au-delà de la résolution des images (géantes gazeuses, satellites) : voir `synthDetail` plus bas.
  // Variables uniformes du détail simulé : son type et sa force, et les coordonnées de la tuile.
  'uniform vec2 detail;uniform vec3 tileCoord;',
  // Insère les lignes du détail simulé.
  ...detailShader,
  // Début de la fonction principale.
  'void main(){',
  // Cellules hexagonales : le maillage d'une cellule déborde de l'image carrée ; hors de l'image, rien n'est dessiné
  // (une autre image de la cellule s'en charge). Marge d'un demi-pixel de texture : pas de fente entre deux images.
  // Hors de l'image, à 0,002 près : le fragment n'est pas dessiné.
  'if(vUv.x<-.002||vUv.x>1.002||vUv.y<-.002||vUv.y>1.002)discard;',
  // Inclusion de la profondeur logarithmique.
  '#include <logdepthbuf_fragment>',
  // baseRect / ovRect : portion de la texture à afficher (sur-zoom au-delà du niveau natif de la couche).
  // ovMode 0 : calque fondu par transparence (routes, noms). ovMode 1 : relief — l'ombrage (gris) module la luminosité
  // du fond sans en changer les couleurs. Gris 0,71 = terrain plat
  // (soleil de l'ombrage à 45°) → facteur 1 ; pentes éclairées plus claires, pentes à l'ombre plus sombres.
  // Lit l'image, corrige ses couleurs par le gain et le décalage, et lit le calque.
  'vec4 b=texture2D(map,baseRect.xy+vUv*baseRect.zw);vec3 col=clamp(b.rgb*colGain+colOff,0.,1.);vec4 o=texture2D(ovMap,ovRect.xy+vUv*ovRect.zw);',
  // Fondu enchaîné (≈ 180 ms) : la tuile fine apparaît par-dessus la portion agrandie de son ancêtre.
  // Pendant le fondu : mélange avec la portion de l'image de l'ancêtre, corrigée de la même façon.
  'if(fade<.999){col=mix(clamp(texture2D(parentMap,parentRect.xy+vUv*parentRect.zw).rgb*parGain+parOff,0.,1.),col,fade);}',
  // ovMode 2 : Lune « réelle ». Couleur = texture globale des couleurs naturelles (colorMap, lon/lat
  // via globalRect). panOn = 1 : le fond est une image de détail en gris (Kaguya) → « pan-sharpening » par substitution
  // de luminance : teinte et saturation de la couleur naturelle, luminosité fine du détail ; puis le calque (ombrage
  // LOLA) ajoute le relief à mi-force. panOn = 0 : le fond est l'ombrage LOLA lui-même (relief seul sur les couleurs).
  // Poids de la luminosité, et couleur naturelle : la texture globale, ou un gris si elle est coupée.
  'vec3 lw=vec3(.299,.587,.114);vec3 nat=mix(vec3(.55,.54,.52),texture2D(colorMap,globalRect.xy+vUv*globalRect.zw).rgb,colorOn);',
  // Mode 0 : le calque est fondu par transparence.
  'if(ovMode<.5){col=mix(col,o.rgb,o.a*ovOn);}',
  // Mode 1 : la luminosité du calque module celle de l'image.
  'else if(ovMode<1.5){float s=dot(o.rgb,lw);col*=mix(1.,clamp(s/.71,.3,1.7),o.a*ovOn);}',
  // Sans artefacts : (1) trous de la mosaïque Kaguya (transparents ou noirs) comblés par la luminosité naturelle ;
  // (2) teinte à 75 % (les couleurs lunaires sont subtiles : pas de franges colorées là où la carte 2k et le détail
  // ne coïncident pas) ; (3) pas d'écrêtage canal par canal (qui fausse la teinte des zones claires) ; (4) relief LOLA
  // effacé quand il est agrandi au-delà de son niveau natif (z > 6), sinon flou et en escalier sur le détail net.
  // Mode 2 avec image de détail : luminosité naturelle, au moins 0,04, et luminosité du détail.
  'else if(panOn>.5){float nl=max(dot(nat,lw),.04);float kl=dot(col,lw);',
  // Dans les trous du détail, la luminosité naturelle prend sa place ; teinte naturelle à 75 %.
  'kl=mix(nl,kl,step(.5,b.a)*smoothstep(.006,.02,kl));vec3 chroma=mix(vec3(1.),nat/nl,.75);',
  // Couleur : la teinte multipliée par la luminosité, ramenée sous 1 sans écrêter canal par canal.
  'vec3 c=chroma*kl*1.1;c/=max(1.,max(c.r,max(c.g,c.b)));',
  // Poids du relief du calque, réduit quand il est agrandi, et son facteur de luminosité ; couleur finale du mode.
  'float rw=.45*smoothstep(.2,1.,ovRect.z)*o.a*ovOn;float r=clamp(dot(o.rgb,lw)/.71,.3,1.7);col=c*mix(1.,r,rw);}',
  // Mode 2 sans image de détail : la couleur naturelle modulée par la luminosité de l'image.
  'else{col=nat*clamp(dot(col,lw)/.71,.3,1.7);}',
  // Avec le détail simulé actif : l'ajoute à la couleur.
  'if(detail.x>.5){col=synthDetail(col);}',
  // Pente du terrain (rlS, sans unité, x vers l'est, y vers le nord) et force de son ombrage (rlW) : nulles sans relief.
  'vec2 rlS=vec2(0.);float rlW=0.;',
  // hSize : côté de la tuile d'altitude en pixels (256 ou 512 selon la source).
  // Avec une tuile d'altitude et un ombrage actif : position du point dans la tuile, en pixels, partie entière et partie fractionnaire.
  'if(hHas>.5&&reliefShade>0.&&reliefExag>0.){vec2 q=(hRect.xy+vUv*hRect.zw)*hSize-.5;vec2 i=floor(q),f=q-i;',
  // Altitudes des quatre pixels voisins.
  'float h00=hTex((i+vec2(.5,.5))/hSize),h10=hTex((i+vec2(1.5,.5))/hSize),h01=hTex((i+vec2(.5,1.5))/hSize),h11=hTex((i+vec2(1.5,1.5))/hSize);',
  // Pente interpolée entre eux, selon la taille au sol d'un pixel et l'exagération.
  'vec2 s=vec2(mix(h10-h00,h11-h01,f.y),mix(h01-h00,h11-h10,f.x))*2.*hSlope*max(reliefExag,1.);',
  // En mer (les quatre pixels de terre à 0) : pente du fond marin, lue de la même façon dans la tuile de profondeurs.
  // En mer, avec le fond des océans : position du point dans la tuile de profondeurs.
  'if(oceanOn>.5&&oHas>.5&&max(max(h00,h10),max(h01,h11))<=.5){vec2 oq=(oRect.xy+vUv*oRect.zw)*oSize-.5;vec2 oi=floor(oq),ofr=oq-oi;',
  // Profondeurs des quatre pixels voisins.
  'float o00=oTex((oi+vec2(.5,.5))/oSize),o10=oTex((oi+vec2(1.5,.5))/oSize),o01=oTex((oi+vec2(.5,1.5))/oSize),o11=oTex((oi+vec2(1.5,1.5))/oSize);',
  // Pente du fond, calculée de la même façon et accentuée.
  's=vec2(mix(o10-o00,o11-o01,ofr.y),mix(o01-o00,o11-o10,ofr.x))*2.*oSlope*max(reliefExag,1.)*oBoost;}',
  // Garde la pente et la force de l'ombrage. Fin de ce cas.
  'rlS=s;rlW=reliefShade;}',
  // Sans altitudes, avec l'ombrage par l'image : position dans l'image et pas de mesure.
  'else if(reliefImg>0.){vec2 q=baseRect.xy+vUv*baseRect.zw;float e=1.5/256.;',
  // Pente estimée par les différences de luminosité de part et d'autre du point.
  'vec2 s=vec2(dot(texture2D(map,q+vec2(e,0.)).rgb-texture2D(map,q-vec2(e,0.)).rgb,lw),dot(texture2D(map,q+vec2(0.,e)).rgb-texture2D(map,q-vec2(0.,e)).rgb,lw))*4.;',
  // Garde cette pente et sa force. Fin de ce cas.
  'rlS=s;rlW=reliefImg;}',
  // Ombrage de carte (lumière fixe du nord-ouest) : partout dans le modèle général ; sur la Terre, seulement pour la
  // part sans ombre jour/nuit (réglage « Ombre » coupé), le vrai Soleil éclairant la pente sinon.
  'if(rlW>0.)col*=mix(1.,reliefLight(rlS),surfModel>.5?rlW*(1.-shade):rlW);',
  // Normale et direction de la caméra ; cosinus de l'angle avec le Soleil, de l'angle de vue et de l'éclairement.
  'vec3 N=normalize(vN),V=normalize(vV);float d=dot(N,sunV);float mu=max(dot(N,V),0.),m0=max(d,0.);',
  // Part de jour : transition large avec atmosphère, nette sans.
  'float day=dayWeight(d,airless);',
  // Couleur éclairée : simple avec atmosphère, loi de Lommel-Seeliger sans.
  'vec3 lit=litColor(col,m0,mu,airless);',
  // Lumière cendrée (Lune) : la Terre éclaire la face de nuit, d'autant plus qu'elle est « pleine » vue de la Lune.
  // Face nuit très sombre (ombre opaque) : environ le quart de l'ancienne luminosité, avec ou sans atmosphère.
  // Couleur de nuit : bleutée avec atmosphère, très sombre et modulée par la lumière cendrée sans.
  'vec3 night=mix(col*vec3(.024,.034,.06)+vec3(0.,.0015,.004),col*vec3(.012,.014,.017)*(.2+.8*earthshine),airless);',
  // Vue de la pollution lumineuse : toute la Terre de nuit (jour annulé, ombre forcée, sol un peu moins noir).
  'float lv=lightView;float dayV=day*(1.-lv);float sh=max(shade,lv);night*=1.+2.*lv;',
  // Couleur de base : sans ombre l'image brute, avec ombre le mélange nuit/jour.
  'vec3 base=mix(col,mix(night,lit,dayV),sh);',
  // Modèle général : halo bleu au limbe, côté jour, seulement avec atmosphère.
  'if(surfModel<.5){float fr=pow(1.-mu,3.);base+=vec3(.25,.5,1.)*fr*(.04+.96*dayV)*.65*sh*(1.-airless);}',
  // Modèle de la Terre (début) : couleur de la surface en lumière linéaire.
  'else{vec3 cl=pow(col,vec3(2.2));',
  // Normale du terrain : la sphère inclinée par la pente du relief (vers l'est et le nord), selon la force de l'ombrage.
  'vec3 Nt=rlW>0.?normalize(N-(rlS.x*normalize(vE)+rlS.y*normalize(vNo))*rlW):N;',
  // Éclairement : Soleil sur la pente, atténué par l'air, et lumière du ciel ; plus la faible lueur de la nuit.
  'vec3 E=earthIrradiance(d,dot(Nt,sunV))+pow(vec3(.024,.034,.06),vec3(2.2));',
  // Eau : part de mer du point, lue dans le masque mondial.
  'float wm=wOn>.5?texture2D(wMap,globalRect.xy+vUv*globalRect.zw).r:0.;',
  // Lumière renvoyée : la surface éclairée, plus le reflet du Soleil là où il y a de l'eau (rien à calculer sur terre).
  'vec3 o=cl*E;if(wm>.01)o+=oceanGlint(N,V,sunV,d,mu)*wm;',
  // Ramenée à l'écran, avec le léger fond bleuté de la nuit.
  'vec3 eb=pow(o,vec3(.4545))+vec3(0.,.0015,.004)*(1.-smoothstep(-.1,.1,d));',
  // Vue de la pollution lumineuse : la nuit du modèle général, trois fois plus claire.
  'vec3 nv=(col*vec3(.024,.034,.06)+vec3(0.,.0015,.004))*3.;',
  // Couleur de base : sans ombre l'image brute, avec ombre l'éclairage de la Terre, en vue de nuit la nuit. Fin du modèle de la Terre.
  'base=mix(mix(col,eb,shade),nv,lv);}',
  // Lumières de la nuit : elles s'allument quand le Soleil passe sous l'horizon du lieu (d < 0,02) et brillent pleinement
  // à 10° dessous (d < −0,17), en suivant le terminateur. Rien de jour, rien sans ombre. Vue de la pollution lumineuse :
  // allumées partout, moitié plus vives.
  // Positions dans les trois images et leurs dérivées, calculées ici, hors de toute condition.
  'vec2 ltQ=ltRect.xy+vUv*ltRect.zw,lpQ=lpRect.xy+vUv*lpRect.zw,lgQ=globalRect.xy+vUv*globalRect.zw;',
  // Dérivées à l'écran (niveau de détail et filtrage anisotrope).
  'vec2 ltX=dFdx(ltQ),ltY=dFdy(ltQ),lpX=dFdx(lpQ),lpY=dFdy(lpQ),lgX=dFdx(lgQ),lgY=dFdy(lgQ);',
  // Si des lumières sont là et allumées (ou la vue de nuit) : poids de la nuit selon le Soleil, ou toute la Terre en vue de nuit.
  'if((ltHas>.5||lpHas>.5||lgOn>.5)&&(lightsOn>.5||lv>.5)){float lwt=max(1.-smoothstep(-.17,.02,d),lv);',
  // Côté jour (poids nul) : rien à lire, ce qui épargne les lectures de texture sur la moitié éclairée.
  'if(lwt>0.){vec3 core;',
  // Tuile fine arrivée et fondu terminé : elle seule.
  'if(ltHas>.5&&ltFade>.999)core=lightCore(ltMap,ltQ,ltSize,ltX,ltY);',
  // Sinon : l'image de repli (l'ancêtre déjà chargé, sinon la mosaïque mondiale), et la tuile fine en fondu par-dessus.
  'else{vec3 cc=lpHas>.5?lightCore(lpMap,lpQ,ltSize,lpX,lpY):(lgOn>.5?lightCore(lgMap,lgQ,lgSize,lgX,lgY):vec3(0.));core=ltHas>.5?mix(cc,lightCore(ltMap,ltQ,ltSize,ltX,ltY),ltFade):cc;}',
  // Lumière ×1,5 plus le halo de la mosaïque, multipliés par l'intensité, passés par la courbe douce, ajoutés du côté
  // nuit. Fin des deux cas.
  'base+=lightKnee((core*1.5+(lgOn>.5?cityHalo(lgQ,lgX,lgY):vec3(0.)))*(1.+.5*lv))*lwt*sh;}}',
  // Couleur finale, avec l'opacité de la cellule. Fin de la fonction principale.
  'gl_FragColor=vec4(base,alpha);}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');
