import type { Ticker } from "@hossa/economy";
import * as THREE from "three";
import type { Snapshot } from "../sim/protocol.js";
import type { Model } from "./model.js";

/** Zaklady, ktore moga strajkowac (bramy sa punktami zaczepienia w makieta.glb). */
const PLANTS: readonly Ticker[] = ["RUD", "STW", "MTK"];
const PEOPLE = 9;
const RADIUS = 7;

export interface Pickets {
  update(snapshot: Snapshot, now: number): void;
}

/**
 * Pikieta przed brama zakladu, ktory strajkuje: kilkunastu robotnikow w polkolu, przestepuja
 * z nogi na noge. Zaklad naprawde stoi — produkcja zero, komin nie dymi, kola sie nie kreca.
 */
export function createPickets(model: Model, scene: THREE.Scene): Pickets {
  const protos = ["pieszy_1", "pieszy_2", "pieszy_3"].map((n) => model.node(n));
  const centre = model.anchor("rynek");
  const groups = new Map<Ticker, THREE.Group>();
  for (const t of PLANTS) {
    const gate = model.anchor(`${t}_brama`);
    // stoja przed brama, od strony miasta (srodek rynku), zwroceni w strone zakladu
    const out = new THREE.Vector3(centre.x - gate.x, 0, centre.z - gate.z).normalize();
    const group = new THREE.Group();
    group.position.copy(gate).addScaledVector(out, RADIUS);
    for (let i = 0; i < PEOPLE; i++) {
      const angle = Math.atan2(-out.z, -out.x) + ((i / (PEOPLE - 1)) - 0.5) * Math.PI * 0.9;
      const person = (protos[i % protos.length] as THREE.Object3D).clone();
      person.visible = true;
      person.position.set(Math.cos(angle) * RADIUS * 0.6, 0, Math.sin(angle) * RADIUS * 0.6);
      person.lookAt(new THREE.Vector3(-out.x, 0, -out.z).multiplyScalar(RADIUS));
      group.add(person);
    }
    group.visible = false;
    scene.add(group);
    groups.set(t, group);
  }

  return {
    update(snapshot, now) {
      for (const [t, group] of groups) {
        group.visible = snapshot.incidents.some((i) => i.kind === "STRAJK" && i.ticker === t);
        if (!group.visible) continue;
        group.children.forEach((p, i) => {
          p.position.y = Math.max(0, Math.sin(now / 260 + i * 2.1)) * 0.12;
        });
      }
    },
  };
}
