import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

/** Jasnosc (liniowa, przed tone mappingiem), od ktorej piksel swieci. */
export const BLOOM_THRESHOLD = 3;

export interface Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  render(): void;
}

/**
 * Renderer, kamera i postprocessing. Tone mapping ACES z ekspozycja ponizej 1, bo makieta
 * z jasnymi tynkami latwo sie przepala. Poswiata (bloom) ma prog 3 — powyzej tego, co daje
 * slonce na bialym tynku — wiec swieca tylko powierzchnie z celowo silna emisja: latarnie,
 * pas notowan, latarnia morska.
 */
export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.75;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 2000);
  camera.position.set(-170, 190, 270);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 10);
  controls.enableDamping = true;
  controls.minDistance = 40;
  controls.maxDistance = 520;
  controls.maxPolarAngle = Math.PI * 0.46; // nie zagladamy pod cokol makiety
  controls.screenSpacePanning = false;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.4, BLOOM_THRESHOLD);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  return {
    renderer,
    scene,
    camera,
    controls,
    render: () => {
      controls.update();
      composer.render();
    },
  };
}
