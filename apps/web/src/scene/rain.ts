import * as THREE from "three";

const DROPS = 2500;
const AREA = { x: 420, z: 320, top: 140 }; // nad cala makieta
const FALL = 70; // m/s
const STREAK = 2.2; // dlugosc kreski kropli w metrach
const SLANT = new THREE.Vector3(0.18, -1, 0.1).normalize(); // wiatr od morza znosi krople

export interface Rain {
  update(storm: boolean, dt: number): void;
}

/** Deszcz w sztorm: krotkie kreski spadajace ukosnie nad makieta, jeden obiekt LineSegments. */
export function createRain(scene: THREE.Scene): Rain {
  const positions = new Float32Array(DROPS * 6);
  const heads = Array.from({ length: DROPS }, () => new THREE.Vector3((Math.random() - 0.5) * AREA.x, Math.random() * AREA.top, (Math.random() - 0.5) * AREA.z));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const rain = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x9fb0c4, transparent: true, opacity: 0.35, depthWrite: false }));
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  return {
    update(storm, dt) {
      rain.visible = storm;
      if (!storm) return;
      heads.forEach((h, i) => {
        h.addScaledVector(SLANT, FALL * dt);
        if (h.y < 0) h.set((Math.random() - 0.5) * AREA.x, AREA.top, (Math.random() - 0.5) * AREA.z);
        positions.set([h.x, h.y, h.z, h.x - SLANT.x * STREAK, h.y - SLANT.y * STREAK, h.z - SLANT.z * STREAK], i * 6);
      });
      (geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    },
  };
}
