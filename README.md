# Slugterra: The Luminous Deep

A browser-playable 3D Slugterra RPG built with Three.js. Explore **five connected caverns**, discover **nine companion species**, equip three slugs, trade blasters and train guided Slug Fu. The original Haven heartshard quest and Hollow Warden ending remain playable. **P** switches between first-person view and the uploaded Eli third-person character.

This continuation fixes the three imported blasters' direction, starts the supplied shot recording when a slug leaves the muzzle, adds moving humanoid rivals, and supports adjustable ultrawide framing up to **3440 × 1440**. The redesigned field interface keeps mission, map, companion and combat information together while retaining keyboard, mouse and touch controls.

The environments and encounters are original playable designs informed by Slugterra references. The collection embeds actual source-linked franchise artwork for both slug forms; new species follow their official arsenal silhouettes. See [the expansion research](docs/references/expansion-2026-11-02.md), [earlier canon verification](docs/references/verified-canon-2026-11-01.md) and [cavern reference board](docs/references/cavern-reference-board.md). Canonical names and powers are distinguished from this project's layouts, routes, numerical balance and original NPCs.

## Run locally

Requirements: Node.js **22.13+** (Node 24 also works), npm, and a modern browser with WebGL 2. Hardware acceleration and a keyboard/mouse are recommended; touch controls are included.

```sh
cd /workspace/slugterra
npm ci
npm run dev
```

Open Vite's printed address, choose **Begin expedition**, and click the world to capture the cursor and unlock audio. Gameplay needs no backend, API keys or external asset downloads after installation. Host `dist/` with a static server for device-local play; account saves require the hosted Worker build described below.

```sh
npm test               # Rules, saves, input, audio, physics, display and assets
npm run test:browser   # Complete original quest, combat, saves and touch controls
npm run test:campaign  # Services, collection, Slug Fu, discoveries and travel saves
npm run test:lifecycle # Live quality changes, GPU cleanup and surface audio
npm run test:collision # Solid scenery, landings, gates and uploaded models
npm run test:touch     # Multi-finger controls, two-thumb combat, cancellation and mobile layouts
npm run test:camera    # P switching, third-person combat and camera obstruction
npm run test:expansion # New regions/discoveries, moving slingers, shot timing and ultrawide UI
npm run test:abilities # Actual support, visible web binding and ramming impacts
npm run verify:models # Hashes of ten original ZIPs and seven runtime GLBs
npm run build         # Static application in dist/
npm run preview       # Preview the production build
npm run package:game  # Build self-contained HTML and a portable ZIP
npm run test:portable # Check the generated production HTML offline
```

Browser suites use Playwright and system Chromium at `/usr/bin/chromium`; set `CHROMIUM_PATH` to use another installation. Run browser suites one at a time with software WebGL. Screenshots go to ignored `test-results/`. Current verification is recorded in [docs/verification-current.md](docs/verification-current.md).

## Controls and field interface

| Input | Action |
| --- | --- |
| **W A S D** / arrows | Move |
| **Mouse** | Look; click the world for cursor capture |
| **Left click** / **F** | Fire; hold to fire again after return and recovery |
| **Right click** / **C** | Hold to aim / toggle focus |
| **P** | Switch first-person / third-person view |
| **Shift** / **Space** | Sprint / jump |
| **E** | Speak, rest, collect, discover or travel |
| **1 / 2 / 3** | Select one of your three equipped companions |
| **Q** | Echo scan and nearby objective guidance |
| **R** | Guided Flight after learning Slug Fu |
| **K** | Disciplines and skill recovery |
| **J** / **M** | Field journal / region map |
| **V** / **I** / **Tab** | Arsenal, companion slots and both form illustrations |
| **Esc** | Pause, release the cursor or close a panel |

Aim and fire work in either button order. Without pointer lock, hold right mouse and drag to turn without firing; left-drag also turns. The HUD supplies touch controls and a view-switch button. The atlas shows cavern connections; the collection equips discovered companions into three slots. Starting a new journey requires confirmation because it replaces saved game progress.

## Touchscreen controls

Phones, tablets and touch-capable laptops automatically show a left movement stick and a right action pad during play. Drag the stick for analog walking, and hold **SPRINT** to run. Swipe the world to look; **drag FIRE** to turn while shooting with two thumbs. A separate look finger takes priority when using more fingers. Hold **AIM** for focus, and use **JUMP**, **USE**, **SCAN**, **SLUG FU**, **VIEW**, **PAUSE** and **SLUGS** for the other actions. Tap a companion in the dock to select it.

Fingers are tracked independently, so movement, looking, aiming and firing can overlap. Pausing, changing cavern, backgrounding the page or rotating the device releases held controls. The layouts support portrait and landscape, with safe-area spacing and buttons at least 44 CSS pixels across. Keyboard and mouse remain available.

## Five connected caverns

| Cavern | Environment and discoveries | Routes |
| --- | --- | --- |
| **The Luminous Deep / Haven** | Original heartshard quest, Ranger Kael, Mira's workshop, Tala's training circle, Eli contact and Frostcrawler rescue | Dark Spores, Pyrite |
| **Dark Spores Cavern** | Red-rimmed turquoise mushroom forest, Boon Doc discovery and guarded survey | Haven, Pyrite, Quiet Lawn |
| **Pyrite Cavern** | Blue stone terraces, waterfall ruins, Phosphoro discovery and cascade survey | Haven, Dark Spores, Snowdance |
| **Quiet Lawn Cavern** | Sheltered green terraces, workshop trails, web-spun cliffs, Arachnet and Fandango discoveries | Dark Spores, Snowdance |
| **Snowdance Cavern** | Glacial passage, blue ice shelves, expedition lights and Rammstone discovery | Pyrite, Quiet Lawn |

Haven's original passage lifts remain at `(20, 30)` for Dark Spores and `(-20, 30)` for Pyrite. Approach marked lifts and press **E**; companions must return before travel. Follow the extended route **Dark Spores ↔ Quiet Lawn ↔ Snowdance ↔ Pyrite** to explore the new regions.

Activate amber checkpoints to restore vitality and set your respawn location. Clear guards before approaching discoveries and surveys. Visits, discoveries, defeated encounters, survey rewards, checkpoints and per-cavern positions persist; rewards are claimed once. Quiet Lawn and Snowdance are sourced show location names, while their playable landscapes, routes and encounter placements are original. Their atlas concepts are labelled accordingly.

## Companions, combat and progression

The original Burpy/Infurnus, Joules/Tazerling and AquaBeek starters remain. Frostcrawler, Boon Doc and Phosphoro retain their existing freezing, healing and light roles. Three new discoveries expand the collection:

- **Rammstone:** a horned earth ram whose heavy hit staggers and pushes enemies.
- **Arachnet:** a purple/lime web companion that binds enemy movement for 2.6 seconds.
- **Fandango:** an energy support companion that restores up to 14 shield and opens a six-second window. The next successful shot from another companion receives **25% extra damage**, consuming the boost once. Fandango refreshes support without strengthening itself; rejected shots do not consume it.

These powers adapt sourced species roles; their timers, damage, shield values and unlock placements are RPG balance. Equip three discovered companions through the arsenal. Recovery timers survive unequipping, and a companion in flight cannot be swapped out.

A shot launches as a Protoform at **18 m/s**, accelerates, and changes to its Velocimorph when speed reaches **100 mph / 44.7 m/s**. A transformed hit deals **1.6× base damage**. On impact or recall the slug returns to the blaster, remaining unavailable until it returns and recovers. Companion ammunition remains unlimited.

Armored rivals patrol their territory, pursue visible targets, search the last seen position, strafe and reposition during recovery. Their aim locks during a visible firing tell, allowing you to dodge or use cover. Movement respects solid scenery; electric, ice, light, web and ramming effects create opportunities to interrupt or control foes. Leashes keep encounters near their territory. Explorer, Slugslinger and Veteran settings adjust challenge. These rivals are original characters inspired by the show's slinger duels.

Mira sells the stronger/slower **Deepcore Breaker** and quicker/lighter **Trailrunner**, alongside the owned **Haven Scout**. Tala teaches **Guided Flight** for 40 gold: **R** guides the selected outward-flying companion toward your aim for four seconds, with a 12-second recovery. **Resonant Focus** requires Guided Flight and temporarily strengthens shots. XP, shards, combat and surveys advance levels; defeat returns you to the saved checkpoint while retaining campaign progress.

## Original Haven quest and physics

Find Ranger Kael at Haven's amber beacon and press **E**. Defeat the guards and collect the heartshards at **Luminous Grove**, **Violet Falls** and **Ancient Roots**, in any order. With all three collected, face the **Hollow Warden** at the northern Heartstone, then return to Kael to complete the ending. Exploration continues afterward.

Movement uses a **120 Hz fixed simulation** with acceleration, friction, jumping, slope handling and capsule collision against actual solid scenery. Rocks, trunks, mushroom structures, shelters, ruins, counters, gate frames and NPC proxies are physical; platforms support the player. Grass, particles, water effects and small ornaments remain scenic. Projectile cover and enemy sight use solid geometry. The third-person camera retracts around scenery and terrain.

## Display and performance

**Settings → Display** stores these independent preferences:

| Control | Options |
| --- | --- |
| Framing | **Auto**, **16:9**, **21:9 ultrawide** |
| Render limit | **Auto**, **1920 × 1080**, **2560 × 1080**, **3440 × 1440** |

The ultrawide preset uses the requested 3440:1440 native ratio. The view fits and centers within the available window without stretching. Render limits cap the drawing resolution; actual GPU dimensions never exceed **3440 × 1440**, including on high-density screens. Auto also adapts to portrait/touch screens. Display preferences survive reloads and a confirmed new journey.

Visual quality remains separate: Performance reduces pixel density and detail; High and Ultra increase resolution, shadows and cavern detail within the display ceiling. Frame rate depends on the device and WebGL implementation. No RTX 5060 Ti hardware benchmark has been performed in this cloud environment.

## Sound and personal recordings

The supplied **`slugterra-metamorphosis-shot.mp3`** remains embedded unchanged. Its combined launch/transformation sequence now starts **when the slug is fired**, skipping approximately **90 ms** of leading silence. The game does not replay the same launch sequence when the slug transforms. Visual transformation still follows the **44.7 m/s** speed threshold. If close cover stops a slug before transformation, the pending sequence is stopped after retaining the launch transient.

Settings accepts personal clips for the existing eight slots: blaster; fire/electric/water transformation; fire/electric/water impact; and reload/return. Imported blaster recordings replace the launch effect; imported transformation recordings trigger at the actual transformation event. Original synthesis supplies ambience, mechanisms, movement, impacts and unavailable effect fallbacks. Additional companion elements reuse these sound families.

Use a browser-supported WAV, MP3, OGG, M4A or similar audio file, **at most 8 MiB and 15 seconds per clip**. Personal clips remain in this browser's IndexedDB (`slugterra-recorded-audio-v1`), rather than being uploaded or included in source packages. Removing imports restores the bundled sequence and synthesized defaults. Muting stops effect tails.

## Assets, saves and portable build

All **ten supplied model ZIPs** remain unchanged in `src/assets/models/originals/`. Seven self-contained runtime GLBs provide Burpy, Joules, three blasters, Eli and a reusable shell. The blasters use inspected per-asset barrel direction and retain the calibrated gameplay muzzle. Procedural fallbacks remain available while imports load. Eli retains the supplied rig with procedural holding/walking motion; no authored animation clips were supplied. Model credits are available from the field guide. Shared geometry/materials survive scene replacement while owned skeleton bone textures are released. See [model import notes](docs/model-imports-2026-11-02.md).

Campaign saves use `slugterra.campaign.v2`, preserving the original `slugterra.luminous-deep.v1` save as a migration recovery copy. Saves include progression, collection, equipped companions and blasters, skills, checkpoint, cavern positions and settings. A new journey resets campaign progress while keeping preferences and personal audio. Guest and portable saves belong to their browser origin. Signed-in online saves also synchronize with the account database, as described below.

`npm run package:game` writes `.local/downloads/Slugterra.html`, `.local/downloads/Slugterra-The-Luminous-Deep.zip` and `START-HERE.txt`. The HTML embeds the production code, styles, reference artwork, runtime models and supplied MP3 for offline play. Python 3 is required only to create the ZIP. Extract and open the HTML in a WebGL 2 browser; if file-URL storage/rendering is restricted, serve the extracted folder with a local static server. Packaging does not publish a site or push GitHub changes.

## Project and recovery points

Core modules are `main.js` (rendering, integration and combat), `game-state.js` (rules/saves), `content.js` (sourced catalog and tuning), `caverns.js`/`world.js` (environments), `enemy-ai.js`/`enemy-models.js` (rivals), `physics.js`/`collision.js` (movement/solid geometry), `display.js` (framing/render limits), `audio.js`, `imported-models.js`/`blaster-alignment.js`, and `ui.js`/`campaign-ui.js`/`style.css`.

Recovery points remain `backup/slugterra-rpg-development-2026-11-01` (recovered original), `backup/pre-physics-2026-11-02` (earlier cavern build) and `backup/pre-expansion-2026-11-02` (physics/model/P-view build at `92ca064`). Historical verification remains in [the original rebuild record](docs/verification-2026-11-01.md) and [the physics/model record](docs/verification-physics-models-2026-11-02.md).

This is a playable vertical slice with a complete quest and five connected regions. Full authored character animation, crafting, mounts, multiplayer and a long campaign remain future work. No Avatar models, textures or music are included.

Special thanks to [Starkster on Sketchfab](https://sketchfab.com/parmaryash2599) for the Slugterra blaster and slug-shell 3D designs. Individual model authors and licenses remain listed in the in-game model credits.

## Accounts and cross-device progress

Open **Account and saved progress** in the header to sign in, check synchronization or bring a guest journey into your account. The online game supports **direct Google and Microsoft sign-in**, using Auth.js for OAuth/OpenID Connect and encrypted HttpOnly session cookies. Provider app credentials must be configured before a provider becomes available; see [the exact setup steps and callbacks](docs/direct-sign-in-setup.md). No ChatGPT account is required. Guest play and the downloadable game keep device-local saves. Imported audio remains on its original device.

Online account saves use a server-side D1 record keyed by the authenticated provider and stable provider account ID. The game keeps a separate local backup for each account. Conflicting updates from another device require an explicit choice; a guest journey is imported only when selected. Displaced local copies are retained for recovery. Account changes stop syncing until the player signs in again or reloads.

`npm run build` and `npm run package:game` retain the existing Vite/portable outputs. `npm run build:hosted` also produces the account API Worker and static asset directory. The tracked D1 schema and generated migrations are in `db/` and `drizzle/`. For local account QA, build the hosted output, apply `drizzle/0000_player_progress.sql` with Wrangler's **local** D1 command using `dist/server/wrangler.json`, then run `npm run test:accounts:browser`. Local QA uses encrypted fixture session cookies only on loopback. Protocol tests use mock Google/Microsoft token endpoints; production requires the real OAuth apps. Google and Microsoft identities are kept separate, even when they share an email address.

## Elemental combat and cartridge loading

Press **V** to open the slug arsenal; I and Tab remain aliases. Infurnus fire burns for three seconds (4 damage/second), Boon Doc heals with green pulses, Rammstone strikes with a stone fist/shockwave and knockback, Frostcrawler encases enemies in ice for 2.2 seconds, AquaBeek splashes water and extinguishes burning targets, and Joules creates electrical arcs and stun. These durations and values are original RPG balance. Loaded companions lie inside the actual glass cartridge on each blaster, in both camera views, and leave it while in flight.
