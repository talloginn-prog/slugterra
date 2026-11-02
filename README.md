# Slugterra: The Luminous Deep

> **Updated 2026-11-02 (UTC).** This README documents the campaign rebuild inspected on [`codex/slugterra-campaign-rebuild`](https://github.com/talloginn-prog/slugterra/tree/codex/slugterra-campaign-rebuild), commit [`92ca064df6d92cf6fec7475be419e60d58aec3c9`](https://github.com/talloginn-prog/slugterra/commit/92ca064df6d92cf6fec7475be419e60d58aec3c9). The preserved backup branch contains the earlier one-cavern build. Select the campaign branch to use the features described here.

## Project status

| Area | Implemented in the inspected campaign snapshot |
| --- | --- |
| World | Three connected regions: Luminous Deep/Haven, Dark Spores and Pyrite |
| Quests | Original heartshard/Warden expedition, discoveries and two cavern surveys |
| NPC services | Ranger/rest contacts, Mira’s blaster workshop and Tala’s training circle |
| Slugs | Six species in the catalog; three starter companions plus three discoveries; three equipped slots |
| Equipment | Three blasters with ownership checks and damage/recovery tradeoffs |
| Skills | Guided Flight and prerequisite-gated Resonant Focus |
| Combat | Locked-aim windups, cover, recovery, stagger, leash behavior and three difficulty levels |
| Graphics | Distinct caverns, reactive vegetation, reference artwork, uploaded character/equipment models and Ultra quality |
| Camera / physics | First-/third-person P toggle, obstruction-safe rear camera and capsule collision against actual solid scenery |
| Saves | Version-2 campaign saves with legacy version-1 recovery/migration |
| Audio | Included supplied transformation MP3 and personal audio overrides, preserved across travel |
| Verification | 57 tests, original/runtime model integrity checks and production build independently rerun on 2026-11-02 |

### Contents

- [Run locally](#run-locally)
- [Portable package](#portable-package)
- [Your expedition](#your-expedition)
- [Controls](#controls)
- [Connected cavern expeditions](#connected-cavern-expeditions)
- [Collection and rarity](#collection-and-rarity)
- [Blaster workshop and disciplines](#blaster-workshop-and-disciplines)
- [Companions and progression](#companions-and-progression)
- [Sound and recorded effects](#sound-and-recorded-effects)
- [Supplied 3D models](#supplied-3d-models)
- [Saves and performance](#saves-and-performance)
- [Project layout](#project-layout)
- [Scope](#scope)
- [Roadmap and research](#roadmap-and-research)
- [Troubleshooting](#troubleshooting)
- [Validation and backup](#validation-and-backup)
- [Development log](#development-log)

A playable 3D Slugterra-inspired cavern RPG built with Three.js, with first-person and third-person views. Press **P** during play to switch views. Travel between the original Luminous Deep expedition, Dark Spores Cavern, and Pyrite Cavern. Discover companions, equip three slugs, trade for blasters, train guided Slug Fu, and explore distinct underground environments. The complete Haven heartshard quest and Hollow Warden ending remain playable.

Uploaded Burpy and Joules models now provide their protoforms, three uploaded blasters supply the equipment variants, and Eli appears at Haven and as the third-person player. The existing procedural models remain as loading fallbacks and distinguish the other species and every battle form: Infurnus has an orange body, yellow belly, and flame crest; Tazerling has a blue body with yellow lightning features; AquaBeek has a beak and aquatic fins. At speed they unfold into larger, fiercer Velocimorphs. The Eli-inspired blaster combines orange armor, gunmetal housing, a layered silver barrel and rifled bore, mechanical sights, a trigger guard, and a companion visible inside its protected glass cartridge.

The environments and effects are procedural, with the supplied 3D models integrated alongside the existing procedural characters, companions and weapons. The expanded arsenal and cavern atlas also include actual source-linked Slugterra reference artwork, embedded locally for offline play. See `docs/references/verified-canon-2026-11-01.md` and `docs/references/cavern-reference-board.md` for the research and visual evidence. Audio combines original synthesis with a supplied metamorphosis recording bundled for the original and added slug transformations. The lush atmosphere draws broad inspiration from cinematic exploration games; no Avatar models, textures, music, or other assets are included.

## Run locally

Requirements: Node.js **20.19+ or 22.12+** (Node 24 also works), npm, and a modern browser with WebGL 2 and hardware acceleration enabled. Desktop keyboard and mouse are recommended. Touch movement, looking, firing, and interaction controls are also included.

```sh
git clone --branch codex/slugterra-campaign-rebuild --single-branch https://github.com/talloginn-prog/slugterra.git slugterra
cd slugterra
npm ci
npm run dev
```

For an existing campaign checkout, start with `npm ci` and `npm run dev` from its root. Preserve local changes before switching branches.

Open the address printed by Vite in your browser. Click **Begin expedition** and click the game world to capture the mouse. Browser security requires a user gesture before mouse capture and audio can start.

```sh
npm test              # Game rules, persistence, physics, and mouse-input checks
npm run test:browser  # Original expedition: input, combat, ending, saves, mobile
npm run test:campaign # Gates, services, collection, Slug Fu, discoveries and travel saves
npm run test:lifecycle # Quality changes, travel cleanup and cavern surface audio
npm run test:collision # Solid scenery, platform landings, gates and uploaded assets
npm run test:camera    # P toggle, third-person combat and camera obstruction
npm run verify:models # Original ZIP and self-contained runtime GLB integrity
npm run test:portable # Offline production HTML (run package:game first)
npm run build         # Build the static application into dist/
npm run preview       # Serve the production build locally
npm run package:game  # Build, then refresh portable HTML and ZIP artifacts
```

The browser suite uses Playwright and the system Chromium at `/usr/bin/chromium`. Set `CHROMIUM_PATH` to use another Chromium installation. It starts its own test server and writes screenshots to the ignored `test-results/` directory. Software WebGL can make the complete combat test take several minutes.

The game requires no backend, account, external asset downloads, API keys, or database service. After installing dependencies, rendering and gameplay run locally in the browser. Deploy the generated `dist/` directory with a static web server when you choose to publish it.

## Portable package

`npm run package:game` rebuilds the application and writes these local files:

```text
.local/downloads/Slugterra.html
.local/downloads/Slugterra-The-Luminous-Deep.zip
.local/downloads/START-HERE.txt
```

The HTML embeds the production JavaScript, styles, reference images, seven runtime models and supplied transformation MP3. The ZIP contains that HTML and the startup guide. Extract it and open `Slugterra.html` in a WebGL 2 browser; playing the packaged game needs no Node installation or Internet connection. Python 3 is needed only to create the ZIP. The packaging script uses Python's standard library and requires no additional ZIP dependency.

If a browser restricts file-URL rendering or storage, serve the extracted folder through a local static web server. Local progress and imported audio belong to a browser origin, so changing the server address or file location may use separate storage. Regenerate the package after source changes; it always packages the latest production build. `node scripts/package-game.mjs` can package an existing `dist/` directly without rebuilding.

These are local build artifacts. Creating them does not upload files, create a public download link, push source to GitHub, deploy a website, or publish a cloud-environment snapshot. Source and snapshots are published only through their separate supported workflows when requested.

## Your expedition

Allow roughly **10–20 minutes at an exploratory pace** for the complete quest:

1. Find Ranger Kael at the warm amber beacon in **Haven Outpost**. Approach and press **E** to receive your mission. Returning to the ranger also restores vitality and shield.
2. Follow the beacons to **Luminous Grove**, **Violet Falls**, and **Ancient Roots**. Defeat the corrupted sentinels guarding each site, then press **E** near its heartshard to collect it. The sites can be visited in any order.
3. With all three shards recovered, head north to **The Heartstone**. The **Hollow Warden** has awakened. Keep moving, avoid its projectiles, and alternate companions to use their different strengths.
4. Return to Ranger Kael at Haven to complete the expedition. Continue exploring after the victory screen or start a new expedition from the pause menu.

Use the quest tracker, field journal, map, minimap, landmark labels, and echo scan to find your way. Movement uses a **120 Hz fixed simulation** with acceleration, friction, capsule collision against the actual solid scenery, wall sliding, terrain slope handling, and jumping. Rocks, trunks, mushroom structures, tents, ruins, counters and gate frames provide physical surfaces; visible platforms can support the player. Grass, particles, glow effects and small ornaments remain scenic. Projectile collision and enemy line of sight use the same solid geometry. The third-person camera retracts around scenery and terrain to keep it out of walls.

## Controls

| Input | Action |
| --- | --- |
| **W A S D** / arrow keys | Move |
| **Mouse** | Look around; click the world to capture the cursor |
| **Left click** / **F** | Fire the selected companion; hold to fire again once it has returned and recovered |
| **Right click** | Hold to focus your aim; combine with left click to fire while aiming |
| **C** | Toggle focus without holding a mouse button |
| **P** | Switch first-person / third-person view; touch players can use the HUD view button |
| **Shift** | Sprint |
| **Space** | Jump |
| **E** | Interact when prompted: speak, rest, discover, collect, use services or travel |
| **1 / 2 / 3** | Select equipped slot 1 / 2 / 3; replace its companion through the arsenal |
| **Q** | Echo scan; identify the nearest remaining heartshard |
| **R** | Activate Guided Flight after training Slug Fu |
| **K** | Disciplines and skill recovery |
| **J** | Field journal |
| **M** | Region map |
| **I** / **Tab** | Slug arsenal; inspect Protoform and Velocimorph illustrations |
| **Esc** | Pause, release the cursor, or close a panel |

Right-click aiming and left-click firing work in either press order. If pointer lock is unavailable, **hold right click and drag to turn without firing**; left-drag also turns while firing. These independent controls allow turning, aiming, and shooting together. The header buttons provide sound, settings, arsenal, and journal access. Starting a new expedition requires confirmation because it replaces the saved journey.

## Connected cavern expeditions

Haven has two marked passage lifts near the outpost: **Dark Spores** at `(20, 30)` and **Pyrite** at `(-20, 30)`. Approach a lift and press **E** to travel. Each destination also connects to Haven and the other cavern. Wait for a companion to return before travelling. Use **Cavern atlas** in the navigation or click the current-cavern HUD for routes and reference images.

- **Dark Spores:** layered red-rimmed turquoise mushroom canopies, branching trunks, violet atmospheric depth, winding routes, a Boon Doc discovery and a guarded survey beacon.
- **Pyrite:** blue stone terraces, monumental ruins, waterfall curtains, a Phosphoro discovery and a guarded cascade survey.
- **Haven:** the original quest plus Mira's blaster workshop, Tala's training circle and a rescued Frostcrawler. These NPCs, the rescue placement, expedition layouts, routes and survey objectives are original RPG content.

Rest at an amber checkpoint in either new cavern to restore vitality and set your return point. Defeat returns you to your checkpoint without removing collection, equipment or quest progress. Cavern visits, position, defeated encounters, discoveries and surveys persist independently; encounter and survey rewards can only be claimed once. Approach the discoveries and survey beacons after clearing nearby sentinels.

The **arsenal** now separates the discovered collection from three equipped slots. The original `ember`, `volt`, `tide` companion identities and **1 / 2 / 3** controls remain. Discover Frostcrawler, Boon Doc and Phosphoro, then choose a slot in the collection. Slugs retain their recovery timer when unequipped, and an in-flight companion cannot be swapped out. New species have distinct protoform and Velocimorph models.

Mira sells **Deepcore Breaker** (stronger shots, slower recovery) and **Trailrunner** (quicker recovery, less damage); your original **Haven Scout** remains owned. Tala teaches **Guided Flight** for 40 gold. Press **R** or the touch HUD button to steer the selected outward-flying companion toward your aim for four seconds; recovery takes 12 seconds. **K** opens disciplines. **Resonant Focus** requires Guided Flight and temporarily increases shot power. Prices, cooldowns and RPG prerequisites are original balancing, distinct from the sourced Slug Fu concept.

Sentinels visibly charge before firing at a locked position, then enter a recovery window. Strafe during the windup, use trees and rocks as cover, or interrupt with electric/ice/light attacks. Enemies check line of sight, respect cover and return to their home encounter when pulled too far. Settings offers **Explorer**, **Slugslinger** and **Veteran** challenge levels.

## Collection and rarity

| Companion | Species / classification | Source rarity | How to obtain in this RPG |
| --- | --- | --- | --- |
| Burpy | Infurnus / fire attacker | Ultra Rare | Starter |
| Joules | Tazerling / electric attacker | Common | Starter |
| AquaBeek | AquaBeek / water and sonar | Uncommon | Starter |
| Frostcrawler | Frostcrawler / freezing and ice | Common | Rescue in Haven |
| Doc | Boon Doc / healing; source element Light | Extremely Rare | Discovery in Dark Spores |
| Phosphoro | Phosphoro / illumination and light | Common | Discovery in Pyrite |

Rarity and classification labels are attributed to the legacy official Slug Arsenal in the research catalog. They do **not** specify randomized drop probabilities: this build places its three new discoveries at authored locations. Discovery placement, encounter requirements, rewards and combat numbers are RPG design. Enigmo is researched but is not an implemented collectible in this snapshot.

Open the arsenal, choose a discovered companion and assign one of three equipped slots. A companion cannot occupy two slots, and in-flight companions cannot be swapped out. Recovery belongs to the companion identity, so changing a slot does not reset its cooldown. Ice slows targets, Doc heals on launch, and Phosphoro briefly stuns; the original AquaBeek healing-on-fire behavior remains project balancing rather than a sourced biological ability.

## Blaster workshop and disciplines

A new campaign starts with **100 gold** and the Haven Scout. Visit **Mira** at Haven to buy or equip blasters. Purchases equip the new weapon and cannot be charged twice for an already-owned item.

| Blaster | Cost | Damage multiplier | Recovery-time multiplier |
| --- | --- | --- | --- |
| Haven Scout | Owned at start | 1.00× | 1.00× |
| Deepcore Breaker | 60 gold | 1.30× | 1.28× — slower |
| Trailrunner | 90 gold | 0.82× | 0.70× — faster |

Visit **Tala** to train. **K** opens the disciplines panel; learned skills can be activated there. **R** and the touch skill button activate Guided Flight directly.

| Discipline | Training | Effect | Recovery |
| --- | --- | --- | --- |
| Slug Fu · Guided Flight | 40 gold | Steer the selected outward-flying slug toward your aim for 4 seconds | 12 seconds |
| Resonant Focus | 80 gold; requires Guided Flight | 20% stronger shots for 6 seconds | 20 seconds |

Standard enemy defeats award 12 gold and 35 XP; the Warden awards 60 gold and 180 XP. Each new slug discovery awards 25 gold and 45 XP, and each completed cavern survey awards 50 gold and 75 XP. Recorded encounters and surveys prevent duplicate rewards on travel/reload. Prices, rewards, skill names beyond the sourced Slug Fu concept, prerequisites and timings are original game tuning.

## Companions and progression

- **Burpy — Infurnus / fire:** strong fire shots; his Velocimorph gains a blazing crest, horns, and swept flame wings.
- **Joules — Tazerling / electric:** fast electric shots briefly stagger enemies; his Velocimorph adds jagged lightning fins.
- **AquaBeek — water:** firing restores a little vitality and shield; the Velocimorph unfurls broad aquatic fins around a beaked, streamlined body.

A fired slug starts as a visible **Protoform at 18 m/s**, accelerates, and transforms at **100 mph (44.7 m/s)**. The battle form stays visible until impact or the end of its outward flight, and a morphed hit deals **1.6× base damage**. The flight indicator shows its phase and speed. On impact or recall it returns to the blaster. **Each slug remains busy until it returns**; switch companions to keep fighting while another is in flight. Ammunition is unlimited, and each companion also has a recovery cooldown.

Defeating enemies, recovering shards, and completing the quest award experience. Leveling up increases maximum vitality and shield and replenishes both. Shield also regenerates after a period without damage. Falling in combat returns you to your active checkpoint while preserving quest and collection progress.

## Sound and recorded effects

The supplied **`slugterra-metamorphosis-shot.mp3`** is bundled with the game and plays automatically when any equipped slug transforms. No manual import is needed. The user-supplied recording is 1.824 seconds long; playback starts about 85 milliseconds in to skip its leading silence and synchronize the sound with the transformation.

The remaining soundscape and effects use **original synthesized audio**, including cavern ambience, blaster mechanisms, elemental shots, impacts, movement, and quest cues. No separate exact blaster or impact recordings have been supplied. Synthesis also provides fallback effects when a recorded clip is unavailable.

Open **Settings → Show audio pack** and assign your own recordings to any of eight effect slots:

| Slot | Replaces |
| --- | --- |
| Blaster | Firing sound |
| Infurnus transformation | Fire Velocimorph sound |
| Tazerling transformation | Electric Velocimorph sound |
| AquaBeek transformation | Water Velocimorph sound |
| Fire impact | Fire hit sound |
| Electric impact | Electric hit sound |
| Water impact | Water hit sound |
| Reload / return | Companion return sound |

Use a browser-supported WAV, MP3, OGG, M4A, FLAC, or other decodable audio file, **at most 8 MiB and 15 seconds per clip**. Playback priority is **a matching imported clip → the included transformation recording → the original synthesized effect**. The included recording applies to transformation slots only. Ice uses the original water sound family; healer/light companions use the electric sound family, preserving the eight existing imported override slots.

Local imports stay on the device in the browser's **IndexedDB** (`slugterra-recorded-audio-v1`); that database holds user overrides only. These local imports are not uploaded, copied into source, or added to the portable ZIP. The supplied default transformation MP3 is a separate source asset embedded in the distribution. If persistent browser storage is unavailable, imports work for the current session. **Remove imported clips** restores the bundled transformation recording and the original synthesized effects for the other slots.

## Supplied 3D models

All **ten original model ZIPs** are retained unchanged under `src/assets/models/originals/`, with size and SHA-256 manifests. Seven self-contained runtime GLBs provide Burpy, Joules, three blasters, Eli and a reusable shell. The shell is prepared as an asset; companion ammunition and return behavior are unchanged. Models load in the background while procedural fallbacks remain playable.

Eli retains the supplied rig, body and clothing; dense hair geometry is reduced for runtime use. The supplied file has no authored animation clips, so the player uses a procedural holding pose and walking motion. Model attribution is available through **How to play → Model credits**. See `docs/model-imports-2026-11-02.md` for source preservation and adaptation details.

The seven runtime models are Burpy, Joules, the standard blaster, Renegade, X-Duty, Eli and a reusable shell. Burpy/Joules use uploaded protoforms; the other companions and all battle forms retain procedural models. Eli supplies a Haven contact and the third-person player. Switching view preserves live combat, progress and audio.

Original uploads and generated runtime files have separate manifests. Six packs supply CC-BY-4.0 metadata; four lack license metadata. See the retained credits and attribution before redistributing those assets. Missing metadata is not treated as a blanket license.

## Saves and performance

Progress and settings use this browser's `localStorage`. The original expedition used **`slugterra.luminous-deep.v1`**, save format **1**. Saves include quest progress, collected shards, level, experience, vitality, shield, position, and settings. The game saves periodically, on major events, when pausing, and when leaving. **Continue your journey** restores an existing save. The expanded campaign saves to **`slugterra.campaign.v2`**, importing compatible version-1 progress while keeping the exact original v1 save available as a recovery copy. A malformed campaign save falls back to a valid legacy save. Collection, equipment, skills, per-cavern progress and checkpoints use the new save. A confirmed new expedition resets game progress; it does not clear imported audio. Clearing browser site data removes local progress and imported audio; neither synchronizes across devices. Browsers that deny local storage can still play but cannot retain progress.

Open **Settings → Visual quality → Performance** to reduce rendering resolution on slower devices. High quality caps pixel ratio at 1.5; Performance caps it at 0.85. Ultra raises the cap to 2, uses 4096-pixel shadows and denser new-cavern detail; High uses 2048-pixel shadows. New caverns include animated plants that bend near the player. Ultra is available for the requested RTX 5060 Ti 16GB; frame rate on that GPU has not been measured in this cloud environment. Sound and look sensitivity can be changed in the same panel. The world uses instanced vegetation, crystals, mushrooms, and particles, while companion models batch meshes by material to limit draw calls. Frame rate depends on the device and WebGL implementation.

## Project layout

```text
index.html                 Browser entry and game canvas
src/main.js                Renderer, combat, enemy AI, interactions, effects,
                           minimap, fixed-step simulation and game loop
src/models.js              Species, battle forms, blaster and imported-model fallbacks
src/imported-models.js     Embedded GLB loading and shared resource cache
src/model-registry.js      Runtime model factory registration
src/camera-view.js         First-/third-person view and rear-camera obstruction
src/physics.js             Character movement, terrain and fixed-step collision
src/collision.js           Solid-scene capsule, support and segment queries
src/input.js               Independent mouse buttons and pointer-lock fallback
src/world.js               Preserved original seeded expedition
src/caverns.js             Connected cavern environments, routes and interactables
src/content.js             Sourced species/cavern catalog and separate RPG tuning
src/enemy-ai.js            Telegraphs, recovery, cover, leash and challenge rules
src/campaign-ui.js         Atlas, collection, workshop and training panels
src/game-state.js          Quest rules, companions, XP, vitality and save data
src/ui.js                  Title screen, HUD, arsenal, map, journal and settings
src/style.css              Responsive visual design and touch controls
src/audio.js               Synthesized sound, included recording and local overrides
src/assets/audio/
  slugterra-metamorphosis-shot.mp3
                           Supplied default recording for all transformations
src/assets/models/         Original ZIPs, runtime GLBs, hashes and attribution
scripts/model-assets.mjs   Original/archive and embedded-runtime verification
scripts/package-game.mjs   Self-contained HTML and dependency-free ZIP packaging
tests/                     Game rules, physics, input, audio and browser checks
```

## Scope

This is a self-contained, browser-playable **vertical slice** with a complete quest loop, procedural environments and supplied character/equipment models. It now includes three connected explorable cavern regions. The canonical location/creature references inform original playable layouts; it does not reproduce a definitive show world map. It is not a commercial AAA production or an adaptation of Avatar: Frontiers of Pandora. Further regions, cinematic voice acting, full character animation, crafting, mounts, multiplayer, and a long-form campaign remain future development work. The verified pre-change source and supplied MP3 remain at Git branch `backup/slugterra-rpg-development-2026-11-01`, commit `48a720ce10a90731bd4f4b1c2aac0114c6196f22`. The three-cavern build immediately before the physics/model/view changes is retained by tag `backup/pre-physics-2026-11-02`.
## Roadmap and research

The following requested systems are now implemented in the campaign branch: connected caverns, services/NPCs, three discovery companions with rarity/classification, a blaster workshop, guided Slug Fu and a second discipline, fairer enemy intent, and Ultra graphics. Uploaded-model integration, solid-world physics and first-/third-person switching are now implemented as well. They should no longer be listed as wholly future features.

Remaining expansion opportunities include additional researched caverns and species, deeper NPC stories, a longer campaign, authored animations, crafting, mounts and multiplayer. No completion dates are committed. Ultra settings target stronger desktop hardware; RTX 5060 Ti frame rates remain unmeasured.

Current rebuild evidence:

- [Verified canon and source-edition distinctions](docs/references/verified-canon-2026-11-01.md)
- [Cavern reference board and actual visual observations](docs/references/cavern-reference-board.md)
- [Canonical source catalog](docs/references/canonical-source-catalog.json)
- [Reference image provenance and checksums](docs/references/reference-assets.json)
- [Campaign requirements and implementation record](docs/campaign-rebuild.md)
- [Current physics/model/camera verification report](docs/verification-current.md)
- [Model imports, adaptations and attribution](docs/model-imports-2026-11-02.md)
- [Earlier campaign verification report](docs/verification-2026-11-01.md)

Earlier [network diagnostics](docs/network-diagnosis.md), [alternative visual research](docs/references/alternative-visual-sources.md) and [fan lore audit](docs/references/alternative-lore-sources.md) remain historical research records. The rebuild records newer accessible official/legacy profiles and exact image files. Cavern names attached to Wiki images retain secondary attribution where direct articles could not be inspected. Original layouts, NPCs, quests, prices and skill tuning are distinguished from sourced franchise facts. Research artwork is not a claim of official endorsement or blanket redistribution rights.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Blank canvas or WebGL warning | Use a current browser with WebGL 2 and hardware acceleration; check its developer console for the actual error. |
| Models are still loading | Procedural fallbacks remain playable while embedded runtime models prepare in the background. Check the browser console if a model never appears. |
| Third-person camera moves closer near a wall | This is obstruction avoidance; press P or the HUD view button to return to first person. |
| Low frame rate | Select Settings → Visual quality → Performance, close other GPU-heavy applications, and check browser hardware acceleration. |
| Mouse does not capture | Click the game world. Use right-drag to look if pointer lock is unavailable; Esc releases the cursor. |
| Cannot fire immediately | Wait for that slug to return and recover, or switch to another companion with 1–3. |
| No sound | Enable world audio in Settings or the header, interact with the page, and check browser/tab/system mute. |
| Imported clip fails | Use a browser-supported format within 8 MiB and 15 seconds. The supplied transformation MP3 is already included. |
| Continue/save missing | Use the same browser profile and origin. Private browsing, denied storage, clearing site data or moving the portable file can affect persistence. |
| Browser tests cannot launch Chromium | Install Chromium and set `CHROMIUM_PATH` to its executable. Playwright is installed through `npm ci`. |
| Packaging cannot create a ZIP | Install Python 3 and ensure `python3` is available on PATH. |
| Package looks outdated | Run `npm run package:game` again after source changes. |
| GitHub shows only the initial README | Select `codex/slugterra-campaign-rebuild` for the expanded game; the backup branch holds the earlier build. |
| Cannot travel or equip a replacement slug | Wait until the relevant companions have returned. Travel routes and interaction prompts are shown in the atlas. |
| Cannot purchase/train | Visit Mira/Tala, check gold, ownership and skill prerequisites. |
| Guided Flight does not activate | Learn it at Tala, wait for recovery, and use R while the selected companion is outward-bound. |
| Campaign progress seems missing | Check the same browser/origin and the `slugterra.campaign.v2` save. Keep the version-1 recovery copy before troubleshooting storage. |

Browser saves are separate from the repository. A GitHub backup does not back up a player's browser-local progress or personally imported audio.

## Validation and backup

### Independent README inspection — 2026-11-02

The latest inspected campaign snapshot is [`92ca064`](https://github.com/talloginn-prog/slugterra/commit/92ca064df6d92cf6fec7475be419e60d58aec3c9), “Fix solid-world physics and add uploaded models with third-person view.” It was fetched from GitHub and inspected in an isolated temporary directory. Independently executed checks:

| Command | Result |
| --- | --- |
| `npm test` | **57 passed**: audio, campaign rules, saves, skills, enemy intent, input, fixed-step physics, solid-scene collision and camera obstruction |
| `npm run verify:models` | **Passed**: 10 original archives and 7 self-contained runtime models match their manifests |
| `npm run build` | **Passed**; Vite reports its size advisory because runtime models and artwork are embedded in the single executable bundle |

The [current implementation report](docs/verification-current.md) additionally records passing original-expedition, campaign, collision, camera, lifecycle and offline-portable browser suites. Those browser suites were **not rerun during this documentation-only update**. Its recorded portable HTML is 21,422,685 bytes and ZIP is 11,112,788 bytes; regenerate packages to measure later revisions. Managed Chromium blocks direct file launching, so portable verification used the documented static-server fallback with networking subsequently disabled. No RTX 5060 Ti benchmark is reported.

The earlier `5db2aee` campaign snapshot was independently checked during the first README pass: 38 tests and a production build passed. Preserve that historical result separately from the newer snapshot above.

For later changes, run the applicable commands in [Run locally](#run-locally). Record the tested commit, executed suites, outcomes and limitations rather than carrying historical pass claims forward automatically.

The existing development snapshot was committed and pushed on 2026-11-01:

- Repository: [talloginn-prog/slugterra](https://github.com/talloginn-prog/slugterra)
- Backup branch: [backup/slugterra-rpg-development-2026-11-01](https://github.com/talloginn-prog/slugterra/tree/backup/slugterra-rpg-development-2026-11-01)
- Commit: [`48a720ce10a90731bd4f4b1c2aac0114c6196f22`](https://github.com/talloginn-prog/slugterra/commit/48a720ce10a90731bd4f4b1c2aac0114c6196f22)
- Message: `Save existing Slugterra RPG development`

All 25 project files in that snapshot, including the MP3, were verified through a fresh authenticated Git fetch and checksum comparison. The original `main` branch was preserved. Caches, temporary files, research downloads, generated builds and screenshots were excluded. Sign into GitHub if an anonymous repository link returns 404. Later README or game edits are not part of that historical commit unless committed separately.

## Development log

Dates use UTC. Entries record completed work unless explicitly labelled **planned**. Keep newest entries first, preserve prior history, and add commit links and actual verification results when available. Update this log alongside relevant gameplay, asset, save-format or setup changes.

### 2026-11-02 — README refreshed for physics, uploads and camera view

- Inspected `92ca064df6d92cf6fec7475be419e60d58aec3c9` and documented the P/HUD view toggle, solid scenery, platform support and camera obstruction.
- Documented the uploaded model pipeline, original-archive preservation, runtime fallbacks, attribution and procedural-animation limits.
- Independently passed 57 tests, model integrity verification and a production build.
- Refreshed the complete README while retaining the earlier guides and development history; publication uses a separate README-only documentation commit.

### 2026-11-02 — Uploaded models, solid-world physics and third-person view

Source: [`92ca064`](https://github.com/talloginn-prog/slugterra/commit/92ca064df6d92cf6fec7475be419e60d58aec3c9).

- Retained ten original model ZIPs and integrated seven embedded runtime GLBs for companions, equipment, Eli and a shell asset.
- Added uploaded Burpy/Joules protoforms, imported blasters and Eli as a Haven contact and third-person player; retained procedural fallbacks and battle forms.
- Added P and HUD view switching with rear-camera retraction around solid geometry and terrain.
- Replaced simplified scenery blocking with physical structures, supported platform landings and shared projectile/line-of-sight collision.
- Preserved the uploaded MP3, campaign saves, quests, equipment, skill balance and companion-return mechanics.
- The other agent’s [verification report](docs/verification-current.md) records browser, lifecycle and portable checks. Full authored character animation remains future work.
- Retained the pre-change campaign under tag `backup/pre-physics-2026-11-02`.

### 2026-11-02 — README aligned with the GitHub campaign rebuild

- Inspected remote commit `5db2aeecd751da90c192d684527057f309db2cdc` on `codex/slugterra-campaign-rebuild`.
- Replaced the one-cavern/three-species status with three connected caverns, six species, workshop, skills, enemy difficulty and Ultra quality.
- Documented actual prices, discovery locations, controls, migration/recovery and canonical-source distinctions.
- Independently reran all 38 automated tests and the production build against that snapshot; preserved the separate agent’s browser-test report as attributed historical evidence.
- README-only working-tree change; game implementation remains owned by the other agent.

### 2026-11-02 — Documentation expansion

- Added the status matrix, navigation, rebuild roadmap, troubleshooting and backup details.
- Distinguished current gameplay from the separate agent's planned campaign work.
- Added dated historical validation records and this development log.
- Documentation-only update; no game-code changes or new gameplay validation claimed.

### 2026-11-01 — Connected cavern campaign rebuild

Source: [`5db2aee`](https://github.com/talloginn-prog/slugterra/commit/5db2aeecd751da90c192d684527057f309db2cdc), “Continue Slugterra RPG with connected cavern expeditions.”

- Added Dark Spores and Pyrite, passage gates, checkpoints, surveys and persistent per-cavern encounters.
- Added Frostcrawler, Boon Doc and Phosphoro discoveries, collection management and distinct form models.
- Added Mira’s three-blaster workshop, Tala’s two-discipline progression, currency and ownership rules.
- Added telegraphed attacks, locked aim, cover, leash/recovery behavior and difficulty options.
- Added source-linked reference art, Ultra detail, reactive vegetation and lifecycle cleanup checks.
- Added version-2 campaign saves with recoverable legacy migration, retaining original controls, quest and uploaded audio.
- Other agent’s report records 38 tests and browser/package checks passing; see its verification document for scope and limitations.

### 2026-11-01 — GitHub preservation snapshot

- Committed the existing project as `Save existing Slugterra RPG development` and pushed the dedicated backup branch.
- Verified all 25 files against the source checksums through an independent remote fetch.
- Passed 21 automated tests and a production build; retained local source/Git backup archives outside tracked files.

### 2026-11-01 — Supplied audio and research groundwork

- Bundled the supplied metamorphosis MP3 for all three transformation effects, including the portable build.
- Added bundled-recording decoding, override priority, mute and fallback coverage; verified playback in production and portable builds.
- Inspected reachable alternative cavern imagery and lore references and documented their attribution/confidence limits.
- Diagnosed selective proxy CONNECT denials; did not establish that the attached environment matched the latest published version.
- Recorded the multi-cavern rebuild requirements; the campaign expansion remained planned.

### 2026-10-31 — Playable expedition and combat refinement

- Built the original cavern, NPC briefing, three-shard quest, enemies, Warden encounter and ending.
- Added slug switching, progression, journal/map/arsenal, local saves, responsive UI and procedural audio.
- Redesigned the three species and blaster; added speed-triggered battle forms and returning companions.
- Fixed simultaneous aim/fire/turn controls and added C focus, movement acceleration, jumping, sliding and swept projectile collisions.
- Added local audio imports, automated checks and portable packaging.
