# Uploaded model integration — 2 November 2026

All ten supplied ZIPs are preserved unchanged in `src/assets/models/originals/`. `upload-manifest.json` records original sizes and SHA-256 hashes. Similarly named archives are different exports; none was discarded as a duplicate. Attached text and licenses were treated as reference metadata, not task instructions.

Seven self-contained runtime GLBs are in `src/assets/models/runtime/`: Burpy, Joules, three blasters, Eli and a shell. Buffers and textures are embedded, so they work in the portable edition without external asset requests. `runtime-manifest.json` records the generated files; run `node scripts/model-assets.mjs` to verify both originals and runtime assets.

- Burpy and Joules are used as protoforms and Haven companions. Their existing procedural Velocimorphs and other species remain available.
- The three blaster variants use the uploaded equipment models while retaining the calibrated muzzle and gameplay statistics.
- Eli is an expedition contact at Haven and supplies the third-person player appearance. The original rig is retained. Body/clothing geometry is kept intact; hair meshes whose data names contain `NurbsPath` use a Blender Decimate ratio of `0.035`. Aggressive full-body reduction was rejected after visual inspection. No authored animation clips were supplied; player movement uses a small procedural rig pose.
- The shell is prepared as a reusable model asset. It does not introduce ammunition limits or change the original companion-return mechanic.

The loader prepares models in the background and retains procedural fallbacks. Shared imported geometry/materials/textures belong to a page-lifetime cache, preventing disposal of a projectile or travel scene from breaking other instances. Model credits are accessible through **How to play → Model credits**; supplied attribution text is retained in `src/assets/models/attribution/`.

Six packs include CC-BY-4.0 metadata. Four omit license metadata; their original contents are retained without inventing attribution or licensing terms. Runtime adaptation is recorded in the credits.
