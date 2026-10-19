/**
 * Odchudza GLB z Blendera do paczki dla przegladarki: tekstury do WebP (teren w pelnej
 * rozdzielczosci, kolory materialow 1024 px, mapy normalnych i chropowatosci 512 px — z daleka
 * ich nie widac), siatki skwantyzowane i skompresowane meshopt. Nazw wezlow nie ruszamy — scena szuka po nich kominow i dzwigow.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { dedup, prune, quantize, reorder, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { statSync } from "node:fs";
import sharp from "sharp";

const [input, output] = process.argv.slice(2);
if (input === undefined || output === undefined) {
  throw new Error("uzycie: node dist/optimize.js <wejscie.glb> <wyjscie.glb>");
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

const document = await io.read(input);
await document.transform(
  dedup(),
  // puste wezly to punkty zaczepienia (komin, brama, tabliczka kursu) — musza zostac
  prune({ keepLeaves: true, keepAttributes: true }), // UV pasa notowan bez tekstury tez zostaja
  weld(),
  textureCompress({ encoder: sharp, targetFormat: "webp", pattern: /^teren/, quality: 85 }),
  textureCompress({ encoder: sharp, targetFormat: "webp", pattern: /^(?!teren)./, slots: /baseColor/, resize: [1024, 1024], quality: 80 }),
  textureCompress({ encoder: sharp, targetFormat: "webp", pattern: /^(?!teren)./, slots: /^(?!baseColor)/, resize: [512, 512], quality: 80 }),
  reorder({ encoder: MeshoptEncoder, target: "size" }),
  // Bez kwantyzacji pozycji: ta wpisuje przesuniecie i skale w wezly, wiec zuraw krecilby sie
  // wokol zlego punktu, a wzorce drzew w InstancedMesh wyszlyby kilka razy za male. Dlatego
  // nie uzywamy gotowego meshopt() z gltf-transform (kwantyzuje wszystko) i kompresje
  // wlaczamy sami.
  quantize({ pattern: /^(?!POSITION$)/ }),
);
document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await io.write(output, document);

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
console.log(`${input} (${mb(statSync(input).size)} MB) -> ${output} (${mb(statSync(output).size)} MB)`);
