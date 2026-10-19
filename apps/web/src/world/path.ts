/** Punkt na mapie miasteczka w metrach: x na wschod, z na poludnie (osie three.js), y w gore. */
export type Vec3 = readonly [number, number, number];
export type Vec2 = readonly [number, number];

const dist2 = (a: Vec2, b: Vec2): number => Math.hypot(b[0] - a[0], b[1] - a[1]);
const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/**
 * Zaokragla zakrety lamanej: w kazdym wierzcholku luk (krzywa Beziera drugiego stopnia)
 * zaczyna sie `radius` metrow przed nim i konczy `radius` za nim. Na krotkich odcinkach
 * promien maleje, zeby luki dwoch sasiednich zakretow na siebie nie wchodzily.
 */
export function roundCorners(points: readonly Vec2[], radius: number, segments = 6): Vec2[] {
  if (points.length < 3) return [...points];
  const out: Vec2[] = [points[0] as Vec2];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1] as Vec2;
    const corner = points[i] as Vec2;
    const next = points[i + 1] as Vec2;
    const r = Math.min(radius, dist2(prev, corner) / 2, dist2(corner, next) / 2);
    if (r <= 0) continue;
    const start = lerp2(corner, prev, r / dist2(prev, corner));
    const end = lerp2(corner, next, r / dist2(corner, next));
    for (let k = 0; k <= segments; k++) {
      const u = k / segments;
      const w0 = (1 - u) ** 2;
      const w1 = 2 * u * (1 - u);
      const w2 = u * u;
      out.push([w0 * start[0] + w1 * corner[0] + w2 * end[0], w0 * start[1] + w1 * corner[1] + w2 * end[1]]);
    }
  }
  out.push(points.at(-1) as Vec2);
  return out;
}

/** Punkty co najwyzej co `step` metrow — gesto, zeby wysokosc terenu dalo sie probkowac po drodze. */
export function densify(points: readonly Vec2[], step: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as Vec2;
    const b = points[i + 1] as Vec2;
    const n = Math.max(1, Math.ceil(dist2(a, b) / step));
    for (let k = 0; k < n; k++) out.push(lerp2(a, b, k / n));
  }
  if (points.length > 0) out.push(points.at(-1) as Vec2);
  return out;
}
