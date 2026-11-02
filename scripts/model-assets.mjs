import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src/assets/models');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const originals = JSON.parse(await readFile(resolve(root, 'upload-manifest.json')));
for (const asset of originals) {
  const bytes = await readFile(resolve(root, 'originals', asset.archive));
  assert.equal(bytes.length, asset.bytes, asset.archive);
  assert.equal(sha(bytes), asset.sha256, asset.archive);
}
const runtime = JSON.parse(await readFile(resolve(root, 'runtime-manifest.json')));
for (const asset of runtime) {
  const bytes = await readFile(resolve(root, asset.runtimePath));
  assert.equal(bytes.length, asset.bytes, asset.id);
  assert.equal(sha(bytes), asset.sha256, asset.id);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'GLB magic');
  assert.equal(bytes.readUInt32LE(4), 2, 'glTF 2.0');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'GLB total length');
  const jsonLength = bytes.readUInt32LE(12);
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  assert.ok(document.meshes?.length, `${asset.id} contains meshes`);
  assert.ok(document.buffers.every(buffer => !buffer.uri), `${asset.id} embeds its buffers`);
  assert.ok((document.images || []).every(image => image.bufferView !== undefined || image.uri?.startsWith('data:')), `${asset.id} embeds its textures`);
  const triangles = document.meshes.reduce((total, mesh) => total + mesh.primitives.reduce((count, primitive) => count + document.accessors[primitive.indices ?? primitive.attributes.POSITION].count / 3, 0), 0);
  assert.equal(triangles, asset.triangles, `${asset.id} triangle inventory`);
}
console.log(`Verified ${originals.length} unchanged upload archives and ${runtime.length} self-contained runtime models.`);
