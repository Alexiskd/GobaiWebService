// Gobai Space — Kepler solver using the host Périvolume as the local frame.
const G = 6.67430e-11;
function solveKepler(M,e,iterations=20){let E=M;for(let k=0;k<iterations;k++){const d=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));E-=d;if(Math.abs(d)<1e-13)break;}return E;}
export function calculateOrbitFromPerivolume({perivolume,orbit,timeSeconds,orbitingMassKg=0}){
 const gm=perivolume?.centralGM_m3_s2??(perivolume?.massKg>0?G*perivolume.massKg:null);
 if(!(gm>0))throw new Error("Périvolume: centralGM_m3_s2 ou massKg requis");
 const a=orbit?.semiMajorAxis_m,e=orbit?.eccentricity;
 if(!(a>0)||!(e>=0&&e<1))throw new Error("Éléments orbitaux incomplets ou invalides");
 const mu=gm+G*Math.max(0,orbitingMassKg),epoch=orbit.epochSeconds??0;
 const M0=(orbit.meanAnomaly_deg??0)*Math.PI/180,n=Math.sqrt(mu/a**3);
 const E=solveKepler(M0+n*(timeSeconds-epoch),e);
 const xo=a*(Math.cos(E)-e),yo=a*Math.sqrt(1-e*e)*Math.sin(E);
 const i=(orbit.inclination_deg??0)*Math.PI/180,O=(orbit.ascendingNode_deg??0)*Math.PI/180,w=(orbit.argumentOfPeriapsis_deg??0)*Math.PI/180;
 const cO=Math.cos(O),sO=Math.sin(O),ci=Math.cos(i),si=Math.sin(i),cw=Math.cos(w),sw=Math.sin(w);
 const x=(cO*cw-sO*sw*ci)*xo+(-cO*sw-sO*cw*ci)*yo;
 const y=(sO*cw+cO*sw*ci)*xo+(-sO*sw+cO*cw*ci)*yo;
 const z=sw*si*xo+cw*si*yo;
 const center=perivolume.center??{x:0,y:0,z:0},radius=perivolume.radius_m??null,r=Math.hypot(x,y,z);
 return {relativePosition_m:{x,y,z},position_m:{x:center.x+x,y:center.y+y,z:center.z+z},distanceFromCenter_m:r,insidePerivolume:radius==null?null:r<=radius,meanMotion_rad_s:n,period_s:2*Math.PI/n,periapsis_m:a*(1-e),apoapsis_m:a*(1+e),gravitationalParameter_m3_s2:mu};
}
export function calculateKeplerPeriod({semiMajorAxis_m,centralGM_m3_s2,orbitingMassKg=0}){
 if(!(semiMajorAxis_m>0)||!(centralGM_m3_s2>0))throw new Error("a et GM requis");
 return 2*Math.PI*Math.sqrt(semiMajorAxis_m**3/(centralGM_m3_s2+G*Math.max(0,orbitingMassKg)));
}
