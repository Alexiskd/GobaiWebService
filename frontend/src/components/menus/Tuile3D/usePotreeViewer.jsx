import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveApiUrl } from '@/api';

// Cycle de vie du viewer Potree : scène three.js, contrôles, boucle de rendu et libération du contexte WebGL.
export function usePotreeViewer(baseUrl, coarse) {
  const hostRef = useRef(null);
  const viewerRef = useRef(null); // { recenter, fullscreen } exposés par l'effet
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    const host = hostRef.current; // capturé : la ref peut être nulle au démontage
    let active = true;
    let frame = 0;
    let renderer;
    let controls;
    let pointCloud;
    let resizeObserver;
    let onVisibility;

    async function start() {
      try {
        if (!baseUrl) throw new Error('URL du nuage Potree absente du catalogue.');
        const [{ Potree }, THREE, { OrbitControls }] = await Promise.all([
          import('potree-core'),
          import('three'),
          import('three/examples/jsm/controls/OrbitControls.js'),
        ]);
        if (!active || !host) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x080c14);
        const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 1e9);
        renderer = new THREE.WebGLRenderer({
          antialias: !coarse, // l'antialiasing coûte cher sur mobile
          logarithmicDepthBuffer: true,
          powerPreference: 'high-performance',
        });
        // Mobile : densité limitée à 1,5 pour garder un rendu fluide et éviter la surchauffe.
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
        renderer.domElement.className = 'city-pointcloud-canvas';
        renderer.domElement.tabIndex = 0;
        host.replaceChildren(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.screenSpacePanning = true;
        controls.rotateSpeed = coarse ? 0.6 : 1;
        controls.zoomSpeed = coarse ? 0.8 : 1;

        const resize = () => {
          if (!host.clientWidth || !host.clientHeight) return;
          camera.aspect = host.clientWidth / host.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(host.clientWidth, host.clientHeight, false);
        };
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        resize();

        const potree = new Potree();
        if (coarse) potree.pointBudget = Math.min(potree.pointBudget ?? 1_000_000, 1_000_000);
        pointCloud = await potree.loadPointCloud('cloud.js', resolveApiUrl(baseUrl));
        if (!active) return;
        scene.add(pointCloud);

        const bounds = pointCloud.boundingSphere || pointCloud.geometry?.boundingSphere;
        const recenter = () => {
          if (bounds?.center && Number.isFinite(bounds.radius) && bounds.radius > 0) {
            controls.target.copy(bounds.center);
            camera.position.copy(bounds.center).add(new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(bounds.radius * 2.5));
            camera.near = Math.max(bounds.radius / 10000, 0.01);
            camera.far = Math.max(bounds.radius * 100, 1000);
          } else {
            camera.position.set(0, 0, 100);
            controls.target.set(0, 0, 0);
          }
          camera.updateProjectionMatrix();
          controls.update();
        };
        recenter();
        viewerRef.current = {
          recenter,
          fullscreen: () => {
            const el = host.parentElement;
            if (document.fullscreenElement) document.exitFullscreen?.();
            else (el?.requestFullscreen || el?.webkitRequestFullscreen)?.call(el);
          },
        };

        setStatus('ready');
        const render = () => {
          if (!active) return;
          frame = requestAnimationFrame(render);
          controls.update();
          potree.updatePointClouds([pointCloud], camera, renderer);
          renderer.render(scene, camera);
        };
        // Onglet caché : on arrête la boucle (batterie, mobile).
        onVisibility = () => {
          cancelAnimationFrame(frame);
          if (!document.hidden && active) render();
        };
        document.addEventListener('visibilitychange', onVisibility);
        render();
      } catch (cause) {
        if (active) {
          setError(cause?.message || String(cause));
          setStatus('error');
        }
      }
    }

    start();
    return () => {
      active = false;
      viewerRef.current = null;
      cancelAnimationFrame(frame);
      if (onVisibility) document.removeEventListener('visibilitychange', onVisibility);
      resizeObserver?.disconnect();
      controls?.dispose();
      if (pointCloud) {
        pointCloud.parent?.remove(pointCloud);
        pointCloud.dispose?.();
      }
      // Libère vraiment le contexte WebGL : les navigateurs mobiles en limitent le nombre.
      renderer?.forceContextLoss?.();
      renderer?.dispose();
      host?.replaceChildren();
    };
  }, [baseUrl, coarse]);

  const recenter = useCallback(() => viewerRef.current?.recenter(), []);
  const fullscreen = useCallback(() => viewerRef.current?.fullscreen(), []);

  return { hostRef, status, error, recenter, fullscreen };
}
