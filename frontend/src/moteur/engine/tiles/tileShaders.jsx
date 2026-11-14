// Shader des tuiles : image du fournisseur + calque optionnel (routes, noms) fondu dans le même passage,
// puis éclairage jour/nuit. `airless` = 1 pour un astre sans atmosphère (Lune) : terminateur net, réflexion de
// Lommel-Seeliger (disque uniformément brillant), nuit éclairée par la lumière cendrée, pas de halo bleu.
// Compatible tampon de profondeur logarithmique.
// Déclare et exporte le shader de sommets des tuiles (début).
export const tileVertexShader = [
  // Inclusion de three.js : fonctions communes.
  '#include <common>',
  // Inclusion de three.js : déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_vertex>',
  // Variables transmises au shader de fragments : coordonnées de texture, normale et direction de la caméra.
  'varying vec2 vUv;varying vec3 vN;varying vec3 vV;',
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
  'float hTex(vec2 q){vec4 t=texture2D(hMap,q);return max(0.,t.r*65280.+t.g*255.+t.b*.99609375-32768.);}',
  // Fond des océans : profondeur (≤ 0) lue dans la tuile de profondeurs, pixel sans donnée à 0 ; oSlope et oSize comme
  // hSlope et hSize, oBoost = accentuation de l'ombrage des fonds (pentes douces).
  // Variables uniformes du fond des océans : la tuile de profondeurs, sa portion, sa présence, l'interrupteur, sa pente, sa taille et son accentuation.
  'uniform sampler2D oMap;uniform vec4 oRect;uniform float oHas;uniform float oceanOn;uniform float oSlope;uniform float oSize;uniform float oBoost;',
  // oTex : profondeur d'un pixel, négative ou nulle ; 0 pour un pixel sans donnée.
  'float oTex(vec2 q){vec4 t=texture2D(oMap,q);float h=t.r*65280.+t.g*255.+t.b*.99609375-32768.;return h<-11500.?0.:min(0.,h);}',
  // reliefLight : éclairement d'une pente par une lumière fixe, rapporté à celui d'un terrain plat et borné entre 0,4 et 1,7.
  'float reliefLight(vec2 s){return clamp(dot(normalize(vec3(-s.x,-s.y,1.)),vec3(-.5025,.5025,.7035))/.7035,.4,1.7);}',
  // Variables reçues du shader de sommets.
  'varying vec2 vUv;varying vec3 vN;varying vec3 vV;',
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
  // Applique l'éclairement de la pente, selon la force de l'ombrage. Fin de ce cas.
  'col*=mix(1.,reliefLight(s),reliefShade);}',
  // Sans altitudes, avec l'ombrage par l'image : position dans l'image et pas de mesure.
  'else if(reliefImg>0.){vec2 q=baseRect.xy+vUv*baseRect.zw;float e=1.5/256.;',
  // Pente estimée par les différences de luminosité de part et d'autre du point.
  'vec2 s=vec2(dot(texture2D(map,q+vec2(e,0.)).rgb-texture2D(map,q-vec2(e,0.)).rgb,lw),dot(texture2D(map,q+vec2(0.,e)).rgb-texture2D(map,q-vec2(0.,e)).rgb,lw))*4.;',
  // Applique l'éclairement de cette pente, selon sa force. Fin de ce cas.
  'col*=mix(1.,reliefLight(s),reliefImg);}',
  // Normale et direction de la caméra ; cosinus de l'angle avec le Soleil, de l'angle de vue et de l'éclairement.
  'vec3 N=normalize(vN),V=normalize(vV);float d=dot(N,sunV);float mu=max(dot(N,V),0.),m0=max(d,0.);',
  // Part de jour : transition large avec atmosphère, nette sans.
  'float day=mix(smoothstep(-.12,.22,d),smoothstep(-.02,.04,d),airless);',
  // Couleur éclairée : simple avec atmosphère, loi de Lommel-Seeliger sans.
  'vec3 lit=mix(col*(.38+.72*m0),col*min(1.4,.04+2.*m0/(m0+mu+.001)),airless);',
  // Lumière cendrée (Lune) : la Terre éclaire la face de nuit, d'autant plus qu'elle est « pleine » vue de la Lune.
  // Face nuit très sombre (ombre opaque) : environ le quart de l'ancienne luminosité, avec ou sans atmosphère.
  // Couleur de nuit : bleutée avec atmosphère, très sombre et modulée par la lumière cendrée sans.
  'vec3 night=mix(col*vec3(.024,.034,.06)+vec3(0.,.0015,.004),col*vec3(.012,.014,.017)*(.2+.8*earthshine),airless);',
  // Couleur de base : sans ombre l'image brute, avec ombre le mélange nuit/jour.
  'vec3 base=mix(col,mix(night,lit,day),shade);',
  // Halo bleu au limbe, côté jour, seulement avec atmosphère.
  'float fr=pow(1.-mu,3.);base+=vec3(.25,.5,1.)*fr*(.04+.96*day)*.65*shade*(1.-airless);',
  // Couleur finale, avec l'opacité de la cellule. Fin de la fonction principale.
  'gl_FragColor=vec4(base,alpha);}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');
