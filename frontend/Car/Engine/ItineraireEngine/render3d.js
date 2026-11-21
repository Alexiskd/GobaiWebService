/**
 * Rendu 3D de l'itinéraire (three.js) pour les véhicules volants : un globe, la trace au sol, la trajectoire en altitude
 * (altitude exagérée pour rester lisible), des perpendiculaires qui relient les deux, le départ, l'arrivée et le véhicule
 * qui avance. La vue se fait à la souris ou au doigt : glisser = tourner, molette = zoomer.
 */
import * as THREE from 'three';
import { EARTH_R_KM, altitudeScale, latLonToVec, pointAt } from './geo.js';

const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

/** Position 3D (globe de rayon 1) d'un point { lat, lon, alt }. */
export const toWorld = (p, k) => v3(latLonToVec(p.lat, p.lon, 1 + (k * (p.alt ?? 0)) / EARTH_R_KM));

/** Forme du véhicule selon son moteur : dimensions en unités du globe (rayon 1). */
function vehicleMesh(shape, color, size) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
  let geo;
  if (shape === 'fusee') geo = new THREE.CylinderGeometry(size * 0.25, size * 0.35, size * 2.2, 10);
  else if (shape === 'ballon') geo = new THREE.SphereGeometry(size * 0.8, 14, 10);
  else if (shape === 'rotor') geo = new THREE.CylinderGeometry(size * 0.9, size * 0.9, size * 0.25, 12);
  else if (shape === 'planeur') geo = new THREE.ConeGeometry(size * 0.9, size * 1.6, 3);
  else if (shape === 'avion') geo = new THREE.ConeGeometry(size * 0.55, size * 2, 4);
  else geo = new THREE.SphereGeometry(size * 0.7, 10, 8);
  return new THREE.Mesh(geo, mat);
}

/**
 * Crée le rendu 3D d'un canvas. `setTrack(track)` charge un tracé 3D, `setProgress(u)` place le véhicule (0 à 1),
 * `render()` dessine, `resize()` suit la taille du canvas, `dispose()` libère tout.
 */
export function createRenderer3D(canvas, { background = '#0b1220' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(new THREE.Color(background), 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.0002, 100);

  // Globe : sphère sombre et graticule tous les 15°.
  const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshBasicMaterial({ color: 0x0f2a4a }));
  scene.add(globe);
  const grid = [];
  for (let lat = -75; lat <= 75; lat += 15) for (let i = 0; i < 96; i++) grid.push(...latLonToVec(lat, (i / 96) * 360 - 180, 1.0005), ...latLonToVec(lat, ((i + 1) / 96) * 360 - 180, 1.0005));
  for (let lon = -180; lon < 180; lon += 15) for (let i = 0; i < 48; i++) grid.push(...latLonToVec(-90 + (i / 48) * 180, lon, 1.0005), ...latLonToVec(-90 + ((i + 1) / 48) * 180, lon, 1.0005));
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
  scene.add(new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0x2f5f94, transparent: true, opacity: 0.45 })));

  const group = new THREE.Group();
  scene.add(group);

  // État : tracé courant, vue (azimut, élévation, distance), cible.
  let track = null, k = 1, vehicle = null;
  const view = { az: -0.35, el: 0.65, dist: 0.3, target: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) };
  let width = 0, height = 0;

  function clearGroup() {
    for (const child of [...group.children]) {
      group.remove(child);
      child.geometry?.dispose();
      child.material?.dispose();
    }
    vehicle = null;
  }

  /** Charge un tracé : trajectoire, trace au sol, perpendiculaires, repères, véhicule ; cadre la vue sur le tracé. */
  function setTrack(next) {
    clearGroup();
    track = next && next.dimension === '3d' && next.points.length > 1 ? next : null;
    if (!track) return;
    const maxAlt = Math.max(...track.points.map((p) => p.alt ?? 0));
    k = altitudeScale(maxAlt);
    const color = new THREE.Color(track.color);

    const line = (pts, mat) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
    group.add(line(track.points.map((p) => toWorld(p, k)), new THREE.LineBasicMaterial({ color })));
    group.add(line(track.points.map((p) => toWorld({ ...p, alt: 0 }, 1)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 })));
    // Perpendiculaires toutes les ~10 positions : elles montrent l'altitude.
    const drops = [];
    for (let i = 0; i < track.points.length; i += Math.max(1, Math.round(track.points.length / 24))) {
      drops.push(toWorld(track.points[i], k), toWorld({ ...track.points[i], alt: 0 }, 1));
    }
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(drops), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.25 })));

    // Cadrage : centre du tracé sur le globe, distance selon son étendue.
    const center = new THREE.Vector3();
    track.points.forEach((p) => center.add(toWorld({ ...p, alt: 0 }, 1)));
    center.divideScalar(track.points.length);
    if (center.lengthSq() < 1e-9) center.set(0, 0, 1);
    center.normalize();
    let chord = 0;
    track.points.forEach((p) => { chord = Math.max(chord, toWorld({ ...p, alt: 0 }, 1).distanceTo(center)); });
    const altRise = (k * maxAlt) / EARTH_R_KM;
    view.target.copy(center);
    view.up.copy(center);
    view.dist = Math.min(4, Math.max(0.004, chord * 2.6 + altRise * 2.2 + 0.002));
    view.az = -0.35; view.el = 0.65;

    // Repères : A et B ; véhicule à la taille du cadrage.
    const size = Math.max(0.0008, view.dist * 0.035);
    const dot = (p, c) => { const m = new THREE.Mesh(new THREE.SphereGeometry(size * 0.9, 12, 10), new THREE.MeshBasicMaterial({ color: c })); m.position.copy(toWorld({ ...p, alt: 0 }, 1)); return m; };
    group.add(dot(track.points[0], 0x43a047), dot(track.points.at(-1), 0xe53935));
    vehicle = vehicleMesh(track.shape, track.color, size * 1.4);
    group.add(vehicle);
    setProgress(0);
  }

  /** Place le véhicule à la fraction u du tracé, orienté dans le sens de la marche. */
  function setProgress(u) {
    if (!track || !vehicle) return;
    const p = pointAt(track.points, u);
    const q = pointAt(track.points, Math.min(1, u + 0.01));
    const a = toWorld(p, k), b = toWorld(q, k);
    vehicle.position.copy(a);
    const dir = b.clone().sub(a);
    if (dir.lengthSq() > 1e-14) vehicle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  }

  /** Place la caméra autour de la cible : azimut et élévation dans le repère local (Est, Nord, haut). */
  function placeCamera() {
    const up = view.up.clone();
    let east = new THREE.Vector3(0, 1, 0).cross(up);
    if (east.lengthSq() < 1e-8) east = new THREE.Vector3(1, 0, 0);
    east.normalize();
    const north = up.clone().cross(east).normalize();
    const horiz = east.multiplyScalar(Math.sin(view.az)).add(north.multiplyScalar(Math.cos(view.az)));
    const offset = up.multiplyScalar(Math.sin(view.el)).add(horiz.multiplyScalar(Math.cos(view.el))).multiplyScalar(view.dist);
    camera.position.copy(view.target).add(offset);
    camera.up.copy(view.up);
    camera.lookAt(view.target);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(120, Math.round(rect.width || canvas.clientWidth || 320));
    height = Math.max(120, Math.round(rect.height || canvas.clientHeight || 240));
    renderer.setPixelRatio(Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render() {
    if (!width) resize();
    placeCamera();
    renderer.render(scene, camera);
  }

  // Interaction : glisser pour tourner, molette pour zoomer.
  let drag = null;
  const onDown = (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => {
    if (!drag) return;
    view.az -= (e.clientX - drag.x) * 0.008;
    view.el = Math.min(1.5, Math.max(0.05, view.el + (e.clientY - drag.y) * 0.008));
    drag = { x: e.clientX, y: e.clientY };
  };
  const onUp = () => { drag = null; };
  const onWheel = (e) => { e.preventDefault(); view.dist = Math.min(8, Math.max(0.002, view.dist * (e.deltaY > 0 ? 1.12 : 0.89))); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function dispose() {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('wheel', onWheel);
    clearGroup();
    globe.geometry.dispose(); globe.material.dispose(); gridGeo.dispose();
    renderer.dispose();
  }

  return { setTrack, setProgress, resize, render, dispose };
}
