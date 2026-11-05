// Shader des tuiles : image du fournisseur + calque optionnel (routes, noms) fondu dans le même passage,
// puis éclairage jour/nuit. `airless` = 1 pour un astre sans atmosphère (Lune) : terminateur net, réflexion de
// Lommel-Seeliger (disque uniformément brillant), nuit éclairée par la lumière cendrée, pas de halo bleu.
// Compatible tampon de profondeur logarithmique.
export const tileVertexShader = [
  '#include <common>',
  '#include <logdepthbuf_pars_vertex>',
  'varying vec2 vUv;varying vec3 vN;varying vec3 vV;',
  'void main(){vUv=uv;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;',
  '#include <logdepthbuf_vertex>',
  '}',
].join('\n');

export const tileFragmentShader = [
  '#include <logdepthbuf_pars_fragment>',
  'uniform sampler2D map;uniform sampler2D ovMap;uniform float ovOn;uniform vec3 sunV;uniform float shade;uniform float airless;uniform vec4 baseRect;uniform vec4 ovRect;uniform float ovMode;',
  'uniform sampler2D colorMap;uniform float colorOn;uniform vec4 globalRect;uniform float panOn;',
  'uniform sampler2D parentMap;uniform vec4 parentRect;uniform float fade;uniform float earthshine;',
  'varying vec2 vUv;varying vec3 vN;varying vec3 vV;',
  'void main(){',
  '#include <logdepthbuf_fragment>',
  // baseRect / ovRect : portion de la texture à afficher (sur-zoom au-delà du niveau natif de la couche).
  // ovMode 0 : calque fondu par transparence (routes, noms). ovMode 1 : relief — l'ombrage (gris) module la luminosité
  // du fond sans en changer les couleurs. Gris 0,71 = terrain plat
  // (soleil de l'ombrage à 45°) → facteur 1 ; pentes éclairées plus claires, pentes à l'ombre plus sombres.
  'vec4 b=texture2D(map,baseRect.xy+vUv*baseRect.zw);vec3 col=b.rgb;vec4 o=texture2D(ovMap,ovRect.xy+vUv*ovRect.zw);',
  // Fondu enchaîné (≈ 180 ms) : la tuile fine apparaît par-dessus la portion agrandie de son ancêtre.
  'if(fade<.999){col=mix(texture2D(parentMap,parentRect.xy+vUv*parentRect.zw).rgb,col,fade);}',
  // ovMode 2 : Lune « réelle ». Couleur = texture globale des couleurs naturelles (colorMap, lon/lat
  // via globalRect). panOn = 1 : le fond est une image de détail en gris (Kaguya) → « pan-sharpening » par substitution
  // de luminance : teinte et saturation de la couleur naturelle, luminosité fine du détail ; puis le calque (ombrage
  // LOLA) ajoute le relief à mi-force. panOn = 0 : le fond est l'ombrage LOLA lui-même (relief seul sur les couleurs).
  'vec3 lw=vec3(.299,.587,.114);vec3 nat=mix(vec3(.55,.54,.52),texture2D(colorMap,globalRect.xy+vUv*globalRect.zw).rgb,colorOn);',
  'if(ovMode<.5){col=mix(col,o.rgb,o.a*ovOn);}',
  'else if(ovMode<1.5){float s=dot(o.rgb,lw);col*=mix(1.,clamp(s/.71,.3,1.7),o.a*ovOn);}',
  // Sans artefacts : (1) trous de la mosaïque Kaguya (transparents ou noirs) comblés par la luminosité naturelle ;
  // (2) teinte à 75 % (les couleurs lunaires sont subtiles : pas de franges colorées là où la carte 2k et le détail
  // ne coïncident pas) ; (3) pas d'écrêtage canal par canal (qui fausse la teinte des zones claires) ; (4) relief LOLA
  // effacé quand il est agrandi au-delà de son niveau natif (z > 6), sinon flou et en escalier sur le détail net.
  'else if(panOn>.5){float nl=max(dot(nat,lw),.04);float kl=dot(col,lw);',
  'kl=mix(nl,kl,step(.5,b.a)*smoothstep(.006,.02,kl));vec3 chroma=mix(vec3(1.),nat/nl,.75);',
  'vec3 c=chroma*kl*1.1;c/=max(1.,max(c.r,max(c.g,c.b)));',
  'float rw=.45*smoothstep(.2,1.,ovRect.z)*o.a*ovOn;float r=clamp(dot(o.rgb,lw)/.71,.3,1.7);col=c*mix(1.,r,rw);}',
  'else{col=nat*clamp(dot(col,lw)/.71,.3,1.7);}',
  'vec3 N=normalize(vN),V=normalize(vV);float d=dot(N,sunV);float mu=max(dot(N,V),0.),m0=max(d,0.);',
  'float day=mix(smoothstep(-.12,.22,d),smoothstep(-.02,.04,d),airless);',
  'vec3 lit=mix(col*(.38+.72*m0),col*min(1.4,.04+2.*m0/(m0+mu+.001)),airless);',
  // Lumière cendrée (Lune) : la Terre éclaire la face de nuit, d'autant plus qu'elle est « pleine » vue de la Lune.
  'vec3 night=mix(col*vec3(.1,.14,.24)+vec3(0.,.006,.016),col*vec3(.05,.056,.068)*(.2+.8*earthshine),airless);',
  'vec3 base=mix(col,mix(night,lit,day),shade);',
  'float fr=pow(1.-mu,3.);base+=vec3(.25,.5,1.)*fr*(.15+.85*day)*.65*shade*(1.-airless);',
  'gl_FragColor=vec4(base,1.);}',
].join('\n');
