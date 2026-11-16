// Couche Babylon.js indépendante, transparente, synchronisée avec la caméra Three.js.
// Elle ajoute une couronne de particules incandescentes autour du Soleil sans remplacer le moteur principal.
import {
  Engine as BabylonEngine,
  Scene as BabylonScene,
  Color4,
  Vector3,
  Quaternion,
  UniversalCamera,
  ParticleSystem,
  Texture,
} from '@babylonjs/core';

const MAX_DPR = 1.5;
const PARTICLE_CAPACITY = 2200;

function createRadialSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.16, 'rgba(255,245,220,0.95)');
  gradient.addColorStop(0.42, 'rgba(255,180,70,0.45)');
  gradient.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return canvas;
}

export class BabylonSunParticles {
  constructor(container, sunRadius) {
    this.container = container;
    this.sunRadius = sunRadius;
    this.sunWorld = new Vector3();
    this.forward = new Vector3();
    this.toSun = new Vector3();
    this.lastWidth = 0;
    this.lastHeight = 0;
    this.disposed = false;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';
    canvas.style.background = 'transparent';
    this.canvas = canvas;

    try {
      this.engine = new BabylonEngine(canvas, true, {
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        stencil: false,
        powerPreference: 'low-power',
      }, false);
      this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, MAX_DPR));
      this.scene = new BabylonScene(this.engine);
      this.scene.useRightHandedSystem = true;
      this.scene.clearColor = new Color4(0, 0, 0, 0);
      this.scene.autoClear = true;
      this.scene.skipPointerMovePicking = true;
      this.scene.skipPointerDownPicking = true;
      this.scene.skipPointerUpPicking = true;

      this.camera = new UniversalCamera('gobai-sun-particles-camera', new Vector3(0, 0, 10), this.scene);
      this.camera.rotationQuaternion = Quaternion.Identity();
      this.camera.fov = Math.PI / 4;
      this.camera.minZ = 0.00001;
      this.camera.maxZ = 1e10;
      this.scene.activeCamera = this.camera;

      const sprite = createRadialSprite();
      this.texture = new Texture(sprite, this.scene, true, false, Texture.BILINEAR_SAMPLINGMODE);
      this.texture.hasAlpha = true;

      this.emitter = Vector3.Zero();
      this.particles = new ParticleSystem('gobai-sun-corona', PARTICLE_CAPACITY, this.scene);
      this.particles.particleTexture = this.texture;
      this.particles.emitter = this.emitter;
      // Émission depuis la surface sphérique, dans la direction de la normale.
      this.particles.createSphereEmitter(sunRadius * 1.012, 0.015);
      this.particles.minEmitPower = sunRadius * 0.035;
      this.particles.maxEmitPower = sunRadius * 0.42;
      this.particles.minLifeTime = 0.22;
      this.particles.maxLifeTime = 1.55;
      this.particles.minSize = sunRadius * 0.006;
      this.particles.maxSize = sunRadius * 0.038;
      this.particles.minAngularSpeed = -Math.PI;
      this.particles.maxAngularSpeed = Math.PI;
      this.particles.minEmitBox = new Vector3(-sunRadius * 0.012, -sunRadius * 0.012, -sunRadius * 0.012);
      this.particles.maxEmitBox = new Vector3(sunRadius * 0.012, sunRadius * 0.012, sunRadius * 0.012);
      this.particles.color1 = new Color4(1, 0.82, 0.34, 0.95);
      this.particles.color2 = new Color4(1, 0.34, 0.055, 0.82);
      this.particles.colorDead = new Color4(0.55, 0.08, 0.015, 0);
      this.particles.gravity = Vector3.Zero();
      this.particles.blendMode = ParticleSystem.BLENDMODE_ADD;
      this.particles.updateSpeed = 0.012;
      this.particles.emitRate = 650;
      this.particles.start();

      container.appendChild(canvas);
      this.resize();
    } catch (error) {
      // Babylon est une couche décorative : une indisponibilité WebGL ne doit jamais bloquer Gobai.
      console.warn('[Gobai] Babylon.js sun particles unavailable:', error);
      this.dispose();
    }
  }

  resize() {
    if (!this.engine || this.disposed) return;
    const width = Math.max(1, window.innerWidth || this.container.clientWidth || 1);
    const height = Math.max(1, window.innerHeight || this.container.clientHeight || 1);
    if (width === this.lastWidth && height === this.lastHeight) return;
    this.lastWidth = width;
    this.lastHeight = height;
    this.engine.resize();
  }

  render(threeCamera, sunMesh) {
    if (!this.engine || !this.scene || this.disposed || !threeCamera || !sunMesh) return;
    this.resize();

    threeCamera.updateMatrixWorld();
    sunMesh.updateMatrixWorld();
    sunMesh.getWorldPosition(this.sunWorld);
    this.emitter.copyFrom(this.sunWorld);

    this.camera.position.copyFromFloats(threeCamera.position.x, threeCamera.position.y, threeCamera.position.z);
    const q = threeCamera.quaternion;
    this.camera.rotationQuaternion.copyFromFloats(q.x, q.y, q.z, q.w);
    this.camera.fov = threeCamera.fov * Math.PI / 180;
    this.camera.minZ = Math.max(0.00001, threeCamera.near);
    this.camera.maxZ = Math.min(1e10, threeCamera.far);
    this.camera.getProjectionMatrix(true);
    this.camera.getViewMatrix(true);

    this.toSun.copyFrom(this.sunWorld).subtractInPlace(this.camera.position);
    const distance = this.toSun.length();
    threeCamera.getWorldDirection(this.forward);
    const inFront = distance > 0 && this.toSun.dot(this.forward) > 0;
    const pixelsPerUnit = window.innerHeight / (2 * Math.tan(this.camera.fov / 2));
    const apparentRadius = distance > 0 ? this.sunRadius * pixelsPerUnit / distance : 0;
    const visible = inFront && apparentRadius >= 5;
    this.canvas.style.display = visible ? 'block' : 'none';
    if (!visible) return;

    // Le débit augmente légèrement avec la taille apparente, sans dépasser le budget mobile.
    this.particles.emitRate = Math.max(160, Math.min(850, apparentRadius * 5.5));
    this.scene.render();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    try { this.particles?.stop(); this.particles?.dispose(); } catch {}
    try { this.texture?.dispose(); } catch {}
    try { this.scene?.dispose(); } catch {}
    try { this.engine?.dispose(); } catch {}
    if (this.canvas?.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.engine = null;
    this.scene = null;
  }
}
