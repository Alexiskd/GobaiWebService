// Bibliothèque 3D et contrôles de caméra.
import { useEffect, useRef, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { requestExport } from '@/moteur/api/store';

/**
 * Fenêtre autonome de visualisation : le modèle n'est récupéré qu'après ouverture,
 * et l'appel GLB conserve le jeton d'achat vérifié par le backend.
 */
export function Viewer3DDialog({ open, onClose, body, licenceToken }) {
  const hostRef = useRef(null);
  const [status, setStatus] = useState('Initialisation du moteur 3D…');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !hostRef.current) return undefined;
    let disposed = false;
    let frame = 0;
    let renderer;
    let controls;
    let observer;
    let model;
    const host = hostRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050914');
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000);
    camera.position.set(0, 0.4, 5);
    scene.add(new THREE.HemisphereLight(0xddeaff, 0x182033, 2.0));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(4, 5, 6);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x729dff, 1.1);
    fillLight.position.set(-5, -1, -4);
    scene.add(fillLight);

    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      controls?.update();
      renderer?.render(scene, camera);
    };

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      host.appendChild(renderer.domElement);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.enablePan = true;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.8;
      controls.minDistance = 1.2;
      controls.maxDistance = 18;
      const resize = () => {
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();
      animate();
    } catch (cause) {
      setError(cause?.message || 'WebGL indisponible sur cet appareil.');
      setStatus('');
      return () => { disposed = true; cancelAnimationFrame(frame); observer?.disconnect(); controls?.dispose(); renderer?.dispose(); };
    }

    const load = async () => {
      try {
        setStatus('Vérification de la licence et récupération du modèle…');
        setError('');
        const safeBody = String(body || '').toLowerCase();
        if (!/^[a-z0-9-]+$/.test(safeBody)) throw new Error('Identifiant d’astre invalide.');
        const response = await requestExport(`/export/bodies/${safeBody}/model.glb`, licenceToken, {
          query: { zoom: 4, quality: 'normale' },
        });
        const binary = await response.arrayBuffer();
        if (disposed) return;
        setStatus('Chargement du modèle dans Three.js…');
        const gltf = await new Promise((resolve, reject) => {
          new GLTFLoader().parse(binary, '', resolve, reject);
        });
        if (disposed) return;
        model = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z, 1e-6);
        model.position.sub(center);
        model.scale.multiplyScalar(3.2 / maxDimension);
        scene.add(model);
        camera.position.set(0, 0.25, 5.2);
        camera.near = 0.01;
        camera.far = 100;
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.update();
        setStatus('Moteur actif · rotation automatique');
      } catch (cause) {
        if (disposed) return;
        setStatus('');
        setError(cause?.status === 401
          ? 'Licence refusée ou expirée (401).'
          : cause?.status === 403
            ? 'Cet achat ne donne pas accès à ce modèle (403).'
            : cause?.message || 'Impossible de charger le modèle 3D.');
      }
    };
    void load();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      controls?.dispose();
      if (model) {
        model.traverse((node) => {
          if (!node.isMesh) return;
          node.geometry?.dispose();
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.filter(Boolean).forEach((material) => {
            Object.values(material).forEach((value) => { if (value?.isTexture) value.dispose(); });
            material.dispose();
          });
        });
      }
      renderer?.dispose();
      renderer?.domElement?.remove();
    };
  }, [open, body, licenceToken]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" fullScreen={false}
      aria-labelledby="gobai-model-viewer-title"
      slotProps={{ paper: { sx: { bgcolor: '#080d18', color: '#edf3ff', height: { xs: '88vh', sm: 'min(82vh, 820px)' } } } }}>
      <DialogTitle id="gobai-model-viewer-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="overline" color="primary.light">GOBAI SPACE · MOTEUR 3D</Typography>
          <Typography component="div" variant="h6">{body}</Typography>
        </Box>
        <Button onClick={onClose} color="inherit">Fermer</Button>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 1 }}>
        <Box ref={hostRef} sx={{ flex: 1, minHeight: 280, overflow: 'hidden', borderRadius: 2, border: '1px solid rgba(150,180,230,.2)', touchAction: 'none' }} />
        <Typography variant="caption" color="rgba(220,230,255,.72)">
          Glisser pour faire pivoter · Molette ou pincement pour zoomer
        </Typography>
        {status && <Typography variant="body2" color="rgba(220,230,255,.8)" role="status">{status}</Typography>}
        {error && <Typography variant="body2" color="error.light" role="alert">{error}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">Quitter le visualiseur</Button>
      </DialogActions>
    </Dialog>
  );
}
