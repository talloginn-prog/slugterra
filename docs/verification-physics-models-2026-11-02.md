# Physics, supplied models and camera verification — 2 November 2026

This continuation builds on the existing three-cavern campaign at `5db2aeecd751da90c192d684527057f309db2cdc`. Tag `backup/pre-physics-2026-11-02` preserves that version. The earlier recovered development branch remains available; see `verification-2026-11-01.md` for its historical checks.

## Preserved data and behavior

- All ten supplied model ZIPs are stored unchanged, including distinct exports with similar names. Seven embedded runtime GLBs are verified separately. Hashes and conversion details are recorded in the model manifests and `model-imports-2026-11-02.md`.
- The supplied transformation MP3 remains byte-for-byte identical: SHA-256 `7ae14c8c32011e6b983afdf2d62be18f7e8a0bacc12c071d47c061e7a23703ae`.
- Original quests, equipment statistics, companion return rules, save migration and imported-audio storage are retained. Changing the camera view keeps the live projectile, audio instance and campaign progress.
- The uploaded Eli rig supplies the third-person appearance. No authored animation clips were supplied; the holding pose and walking motion are procedural.

## Focused checks

| Check | Coverage |
| --- | --- |
| `npm test` | **57 passed**: rules, saves, input, audio and fixed-step physics, plus capsule/triangle collision, solid-scene tagging and camera obstruction unit tests |
| `npm run verify:models` | **Passed**: original ZIP sizes/hashes and seven runtime GLBs, including embedded buffers/textures and recorded triangle counts |
| `npm run test:collision` | All seven models load; imported equipment keeps its calibrated muzzle; actual keyboard movement stops at the merchant counter and slides around it; landing and jumping use an instanced stepping stone; gate openings permit real travel in both directions; no application errors |
| `npm run test:camera` | P switches views, repeated keydown does not toggle again, actual deformed Eli geometry measures 1.85 m with grounded feet, movement/aiming work, switching during a live shot preserves companion/audio/progress, rear camera retracts around actual cover and terrain, HUD button switches back; no application errors |
| `npm run test:browser` | **Passed**: complete original quest, all three shard encounters, Hollow Warden and ending, input chords, 100 mph transformation/return, audio import/removal, save restoration and real mobile touch controls; no application errors |
| `npm run test:lifecycle` | **Passed**: live quality changes preserve combat, saves, position and audio; old instance buffers and Eli bone textures are released; replacement Eli reuses shared geometry/materials; travel and current-cavern footstep audio work |
| `npm run package:game` | **Passed**: production build and self-contained HTML/ZIP; final HTML is 21,422,685 bytes and ZIP is 11,112,788 bytes |
| `npm run test:portable` | **Passed**: all twelve reference images, seven runtime GLBs and supplied MP3 are embedded byte-for-byte; offline WebGL play and P switching work; collection/forms/atlas images decode without HTTP requests or development hooks |
| `npm run test:campaign` | **Passed**: purchases/training, Frostcrawler/Doc/Phosphoro discovery and transformation, both new-cavern combat encounters, checkpoints/surveys, gates, persistent rewards, non-Haven reload, imported audio restoration and mobile collection/atlas layouts |

All listed checks passed in system Chromium with software WebGL. Transformation fixtures verify a clear acceleration lane while scene collision remains active. Browser test screenshots are generated under ignored `test-results/`. Run GPU-heavy browser suites one at a time in this environment.

## Physical coverage and limits

The character capsule collides with explicitly selected solid meshes and instances. Terrain remains a separate heightfield. Rocks, trunks, mushroom structures, tents, ruins, counters, gate frames and NPC collision proxies are physical; grass, particles, water effects, glow beams and small ornaments remain decorative. Contact support permits standing on solid geometry instead of snapping through it to terrain. The rear camera checks scene geometry and terrain along its retraction path.

Imported resources are shared through a page-lifetime cache. Scene and projectile cleanup preserve those shared resources while disposing scene-owned geometry, materials and cloned skeleton bone textures. Eli normalization measures deformed skin vertices after updating the rig, preventing stale bind-pose bounds from producing a floating, undersized character. Procedural models remain available while imports load or if a runtime model fails. This work adds no artist-authored character animation or new ammunition rules.

The existing portable packaging embeds all runtime assets into one HTML file. Managed Chromium blocks direct `file://` navigation, so the portable test uses the documented loopback fallback and then disables network access during play. Consumer-browser file launching and RTX 5060 Ti frame rates have not been measured in this cloud environment.
