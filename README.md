# Slugterra: The Luminous Deep

A playable, first-person 3D Slugterra-inspired cavern RPG built with Three.js. Explore a bioluminescent underworld, team up with Burpy, Joules, and AquaBeek, recover the lost heartshards, and defeat the Hollow Warden to bring the light back to Haven.

The handmade procedural models distinguish each species and its battle form: Infurnus has an orange body, yellow belly, and flame crest; Tazerling has a blue body with yellow lightning features; AquaBeek has a beak and aquatic fins. At speed they unfold into larger, fiercer Velocimorphs. The Eli-inspired blaster combines orange armor, gunmetal housing, a layered silver barrel and rifled bore, mechanical sights, a trigger guard, and a companion visible inside its protected glass cartridge.

The environment, characters, companions, weapon, effects, and interface artwork are built in code. Audio combines original synthesis with a supplied metamorphosis recording bundled for all three slug transformations. The lush atmosphere draws broad inspiration from cinematic exploration games; no Avatar models, textures, music, or other assets are included.

## Run locally

Requirements: Node.js **20.19+ or 22.12+** (Node 24 also works), npm, and a modern browser with WebGL 2 and hardware acceleration enabled. Desktop keyboard and mouse are recommended. Touch movement, looking, firing, and interaction controls are also included.

```sh
cd /workspace/slugterra
npm ci
npm run dev
```

Open the address printed by Vite in your browser. Click **Begin expedition** and click the game world to capture the mouse. Browser security requires a user gesture before mouse capture and audio can start.

```sh
npm test              # Game rules, persistence, physics, and mouse-input checks
npm run test:browser  # WebGL, input, combat, ending, save restore, mobile layout
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

The HTML embeds the production JavaScript, styles, and supplied transformation MP3. The ZIP contains that HTML and the startup guide. Extract it and open `Slugterra.html` in a WebGL 2 browser; playing the packaged game needs no Node installation or Internet connection. Python 3 is needed only to create the ZIP. The packaging script uses Python's standard library and requires no additional ZIP dependency.

If a browser restricts file-URL rendering or storage, serve the extracted folder through a local static web server. Local progress and imported audio belong to a browser origin, so changing the server address or file location may use separate storage. Regenerate the package after source changes; it always packages the latest production build. `node scripts/package-game.mjs` can package an existing `dist/` directly without rebuilding.

These are local build artifacts. Creating them does not upload files, create a public download link, push source to GitHub, deploy a website, or publish a cloud-environment snapshot. Source and snapshots are published only through their separate supported workflows when requested.

## Your expedition

Allow roughly **10–20 minutes at an exploratory pace** for the complete quest:

1. Find Ranger Kael at the warm amber beacon in **Haven Outpost**. Approach and press **E** to receive your mission. Returning to the ranger also restores vitality and shield.
2. Follow the beacons to **Luminous Grove**, **Violet Falls**, and **Ancient Roots**. Defeat the corrupted sentinels guarding each site, then press **E** near its heartshard to collect it. The sites can be visited in any order.
3. With all three shards recovered, head north to **The Heartstone**. The **Hollow Warden** has awakened. Keep moving, avoid its projectiles, and alternate companions to use their different strengths.
4. Return to Ranger Kael at Haven to complete the expedition. Continue exploring after the victory screen or start a new expedition from the pause menu.

Use the quest tracker, field journal, map, minimap, landmark labels, and echo scan to find your way. Movement uses a **120 Hz fixed simulation** with acceleration, friction, swept collision checks, sliding around trunks and obstacles, terrain slope handling, and jumping. Smaller decorations are scenic rather than individually collidable. Projectile collision is swept between simulation positions to reduce missed hits at high speed.

## Controls

| Input | Action |
| --- | --- |
| **W A S D** / arrow keys | Move |
| **Mouse** | Look around; click the world to capture the cursor |
| **Left click** / **F** | Fire the selected companion; hold to fire again once it has returned and recovered |
| **Right click** | Hold to focus your aim; combine with left click to fire while aiming |
| **C** | Toggle focus without holding a mouse button |
| **Shift** | Sprint |
| **Space** | Jump |
| **E** | Speak, rest, or collect a nearby heartshard |
| **1 / 2 / 3** | Equip Burpy / Joules / AquaBeek |
| **Q** | Echo scan; identify the nearest remaining heartshard |
| **J** | Field journal |
| **M** | Region map |
| **I** / **Tab** | Slug arsenal; inspect Protoform and Velocimorph illustrations |
| **Esc** | Pause, release the cursor, or close a panel |

Right-click aiming and left-click firing work in either press order. If pointer lock is unavailable, **hold right click and drag to turn without firing**; left-drag also turns while firing. These independent controls allow turning, aiming, and shooting together. The header buttons provide sound, settings, arsenal, and journal access. Starting a new expedition requires confirmation because it replaces the saved journey.

## Companions and progression

- **Burpy — Infurnus / fire:** strong fire shots; his Velocimorph gains a blazing crest, horns, and swept flame wings.
- **Joules — Tazerling / electric:** fast electric shots briefly stagger enemies; his Velocimorph adds jagged lightning fins.
- **AquaBeek — water:** firing restores a little vitality and shield; the Velocimorph unfurls broad aquatic fins around a beaked, streamlined body.

A fired slug starts as a visible **Protoform at 18 m/s**, accelerates, and transforms at **100 mph (44.7 m/s)**. The battle form stays visible until impact or the end of its outward flight, and a morphed hit deals **1.6× base damage**. The flight indicator shows its phase and speed. On impact or recall it returns to the blaster. **Each slug remains busy until it returns**; switch companions to keep fighting while another is in flight. Ammunition is unlimited, and each companion also has a recovery cooldown.

Defeating enemies, recovering shards, and completing the quest award experience. Leveling up increases maximum vitality and shield and replenishes both. Shield also regenerates after a period without damage. Falling in combat returns you to Haven while preserving quest progress.

## Sound and recorded effects

The supplied **`slugterra-metamorphosis-shot.mp3`** is bundled with the game and plays automatically when any of the three slugs transforms. No manual import is needed. The user-supplied recording is 1.824 seconds long; playback starts about 85 milliseconds in to skip its leading silence and synchronize the sound with the transformation.

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

Use a browser-supported WAV, MP3, OGG, M4A, FLAC, or other decodable audio file, **at most 8 MiB and 15 seconds per clip**. Playback priority is **a matching imported clip → the included transformation recording → the original synthesized effect**. The included recording applies to transformation slots only.

Local imports stay on the device in the browser's **IndexedDB** (`slugterra-recorded-audio-v1`); that database holds user overrides only. These local imports are not uploaded, copied into source, or added to the portable ZIP. The supplied default transformation MP3 is a separate source asset embedded in the distribution. If persistent browser storage is unavailable, imports work for the current session. **Remove imported clips** restores the bundled transformation recording and the original synthesized effects for the other slots.

## Saves and performance

Progress and settings are stored in this browser's `localStorage` under **`slugterra.luminous-deep.v1`**, using save format version **1**. Saves include quest progress, collected shards, level, experience, vitality, shield, position, and settings. The game saves periodically, on major events, when pausing, and when leaving. **Continue your journey** restores an existing save. Clearing browser site data removes local progress and imported audio; neither synchronizes across devices. Browsers that deny local storage can still play but cannot retain progress.

Open **Settings → Visual quality → Performance** to reduce rendering resolution on slower devices. High quality caps pixel ratio at 1.5; Performance caps it at 0.85. Sound and look sensitivity can be changed in the same panel. The world uses instanced vegetation, crystals, mushrooms, and particles, while companion models batch meshes by material to limit draw calls. Frame rate depends on the device and WebGL implementation.

## Project layout

```text
index.html                 Browser entry and game canvas
src/main.js                Renderer, combat, enemy AI, interactions, effects,
                           minimap, fixed-step simulation and game loop
src/models.js              Procedural Protoform/Velocimorph species and blaster
src/physics.js             Character movement, terrain and swept collision
src/input.js               Independent mouse buttons and pointer-lock fallback
src/world.js               Seeded terrain, river, flora, outpost and landmarks
src/game-state.js          Quest rules, companions, XP, vitality and save data
src/ui.js                  Title screen, HUD, arsenal, map, journal and settings
src/style.css              Responsive visual design and touch controls
src/audio.js               Synthesized sound, included recording and local overrides
src/assets/audio/
  slugterra-metamorphosis-shot.mp3
                           Supplied default recording for all three transformations
scripts/package-game.mjs   Self-contained HTML and dependency-free ZIP packaging
tests/                     Game rules, physics, input, audio and browser checks
```

## Scope

This is a self-contained, browser-playable **vertical slice** with a complete quest loop and original procedural presentation. Its world is one explorable cavern region. It is not a commercial AAA production or an adaptation of Avatar: Frontiers of Pandora. Expanded regions, cinematic voice acting, full character animation, crafting, mounts, multiplayer, and a long-form campaign remain future development work.
