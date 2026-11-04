# Caverns, companions and combat continuation — 2 November 2026

This continuation starts from commit `92ca064df6d92cf6fec7475be419e60d58aec3c9`, retained by tag `backup/pre-expansion-2026-11-02`. It continues the same repository, original quest, collision system, uploaded models and first-/third-person controls.

The earlier **57-test physics/model verification** remains intact in [verification-physics-models-2026-11-02.md](verification-physics-models-2026-11-02.md). The first cavern rebuild has its own [historical record](verification-2026-11-01.md). Their test totals and artifact sizes describe those earlier commits, rather than the current expansion.

## Current behavior

- All three imported blasters use inspected source barrel direction, preserving the 0.72 m length and `(0, 0.055, -0.553)` muzzle contract. Real GLB barrel/chamber/grip anchors are tested across first-/third-person mount headings.
- The supplied combined shot recording starts at launch, with its 90 ms leading silence skipped. A per-shot receipt prevents a second launch playback at transformation and permits cancellation when close cover stops a Protoform. Visual transformation retains the 100 mph / 44.7 m/s threshold; personal transformation overrides use that event.
- Original armored rivals patrol, pursue, search last-seen positions, strafe, reposition and return to their territory. Visible aim tells and recovery preserve counterplay; movement and line of sight use solid scenery.
- Five connected caverns retain the original Haven, Dark Spores and Pyrite and add Quiet Lawn and Snowdance. Their reciprocal routes preserve per-cavern progress, checkpoints and the original Haven quest.
- Nine companion species retain the original six and add Rammstone, Arachnet and Fandango. Their sourced powers inform ramming/knockback, movement binding and a one-shot support boost. Fandango restores up to 14 shield and grants 25% extra damage to the next successful non-energy shot within six seconds; failed shots and renewed support do not consume or stack that bonus incorrectly.
- Auto, 16:9 and 21:9 framing and four render-limit settings persist independently of quality. The 21:9-labelled ultrawide preset uses the requested native 3440:1440 ratio. Fitting centers the view without stretching, and the actual drawing buffer remains at most 3440 × 1440 even on high-density displays.
- The field interface retains mission, map, companion, collection, both-form artwork, services and touch access with the redesigned visual treatment.

Research evidence, confidence limits and the six newly downloaded official companion images are documented in [references/expansion-2026-11-02.md](references/expansion-2026-11-02.md). New cavern names have episode-catalogue evidence; their playable landscapes, atlas concepts, route graph, NPCs and encounters are original designs. Numerical ability tuning remains separate from canonical powers.

## Final validation record

The owner agent fills final results after integration. Test coverage below describes the intended checks and does not claim an unrun full-suite result.

| Command / check | Coverage | Final result |
| --- | --- | --- |
| `npm test` | Existing rules/saves/input/audio/physics; actual-asset blaster direction; display caps; expanded routes, discovery/equipment, support consumption/expiry and settings persistence; new world/slug models and enemy behavior | Passed: 82 tests |
| `npm run verify:models` | Ten unchanged original ZIPs and seven embedded runtime GLBs | Passed: all ten archives and seven GLBs unchanged |
| `npm run test:browser` | Complete original Haven quest, combat, ending, saves, input chords and mobile touch | Passed: original quest, ending, saves and touch controls |
| `npm run test:campaign` | Services, training, collection, transformations, guards, discovery, surveys, routes and imported-audio restore | Passed: services, combat, discoveries, travel, non-Haven reload, equipment and imported-audio restoration |
| `npm run test:collision` | Actual keyboard collision/sliding, geometry support, gate travel and imported models | Passed: keyboard wall sliding, instanced-platform landing/jumping and open gate traversal |
| `npm run test:camera` | P switching, real Eli skin dimensions/feet, aiming, live-projectile continuity and obstruction-safe camera | Passed: P switching, skin bounds, aiming, active-shot continuity and obstruction retraction |
| `npm run test:lifecycle` | Quality/travel state preservation, instance-buffer and skeleton-texture cleanup, shared resource reuse and surfaces | Passed: quality/travel retain state and release owned instance/skeleton resources |
| Production build / portable package | Current built source, embedded assets and offline play | Passed: 22,417,941-byte HTML and 11,834,499-byte ZIP; eighteen images, seven GLBs and MP3 embedded unchanged; offline play passes |
| Expansion browser inspection | Five-region travel/discoveries, new powers, moving rivals, shot timing, redesigned UI and ultrawide settings | Passed: real E gates/discoveries, roaming slingers, launch/morph timing, 3440x1440 cap and mobile UI |

`npm run test:abilities` also passed real input/projectile checks for Fandango shield/support consumption, Arachnet visible binding and stopped movement, and Rammstone stagger/displacement through scene collision.

One initial full-campaign run timed out at the imported-audio reload wait. A focused reload and subsequent complete campaign run restored the saved clip successfully; the complete rerun produced no application errors. Reload diagnostics remain in the browser test for future failures.

Run GPU-heavy browser suites one at a time with software WebGL. Screenshots and local portable artifacts remain in ignored `test-results/` and `.local/downloads/`.

## Preserved assets and practical limits

All ten supplied ZIPs, seven runtime GLBs, supplied attribution, original companion identities and the bundled MP3 are retained. The expected MP3 SHA-256 is `7ae14c8c32011e6b983afdf2d62be18f7e8a0bacc12c071d47c061e7a23703ae`. Existing campaign save migration and browser-local personal audio remain in place. The original Haven ending and earlier discoveries remain available alongside the expansion.

The character capsule collides with selected solid meshes and instances; terrain remains a heightfield. Decorative grass, water effects, glow and small ornaments remain permeable. Shared imported geometry/materials belong to a page-lifetime cache; cloned skeleton bone textures are disposed with replaced instances. Eli uses procedural movement because no authored character-animation clips were supplied.

The portable package embeds runtime data into one HTML file. Managed Chromium requires the documented loopback fallback for file-URL testing; offline play must then make no HTTP requests. Consumer file launching and RTX 5060 Ti performance have not been measured in this environment. Saves and personal audio belong to a browser origin and do not synchronize between devices or hostnames.

## Touchscreen continuation

This update continues commit `6b9a817`, retained by tag `backup/pre-touch-controls-6b9a817`. The earlier expansion results above describe the preceding implementation.

The new pointer controller tracks a thumbstick, a look finger and action fingers independently. It supports analog movement with a dead zone, held fire/aim/sprint, two-thumb fire-drag turning, jump, interaction, scan, Slug Fu, view switching, pause and arsenal access. Companion selection remains available through the existing dock. Separate look input takes priority over fire-drag turning. Touch/pen gestures do not generate duplicate mouse shots, and keyboard/mouse input remains independent.

Held input and pointer captures reset on pause, cavern changes, backgrounding, cancellation and resize/rotation. Touch-capable laptops show the controls even with a fine primary pointer; touch start does not request mouse capture. Phone portrait, phone landscape and tablet controls use at least 44 CSS-pixel targets and safe-area margins. Settings sensitivity adjusts both mouse and touch turning.

| Check | Result |
| --- | --- |
| `npm test` | Passed: 90 tests, including eight new multi-touch/gesture/lifecycle/accessibility cases and existing mouse chord behavior |
| `npm run test:touch` | Passed: four simultaneous native touch contacts, independent releases/cancellation, fire-drag turning, actual jumping/interaction/view/selection/sprint, held-input pause cleanup, rotation, layout bounds and fine-pointer hybrid detection |
| `npm run package:game` | Passed: production build, 22,428,310-byte portable HTML and 11,836,896-byte ZIP |
| `npm run test:browser` | Passed: complete quest, Warden, ending, input chords, saves and real mobile joystick/interaction |
| `npm run test:portable` | Passed: offline WebGL, real joystick gesture/release and touch view switching, collection/atlas, all embedded assets unchanged and no HTTP requests |

Touch browser checks use Chromium's emulated touch device and real WebGL. Physical iOS/Android hardware has not been exercised in this cloud environment. Screenshots remain under ignored `test-results/`; the portable guide includes touchscreen instructions.

## Arsenal shortcut, cartridge fit and elemental effects

This continuation preserves `0f1e53b` with tag `backup/pre-slug-effects-0f1e53b`. **V** opens the arsenal while I/Tab remain available; input fields ignore the shortcut and held V does not repeatedly reopen the panel.

Loaded companions are rotated lengthwise, centered and scaled inside the actual glass mesh of each uploaded blaster. The obsolete floating display location is replaced by per-model cartridge anchors. First- and third-person guns share the same loading controller. The cartridge empties when its companion launches and refills on return, including when switching views.

Infurnus emits flames and burns targets for three seconds at 4 damage/second. Boon Doc retains its healing and adds green healing pulses/crosses. Rammstone has stone-fist artwork and a shockwave alongside its collision-constrained knockback. Frostcrawler encases targets in ice and stops movement/attacks for 2.2 seconds. AquaBeek creates water rings/splashes and extinguishes burning targets. Joules has electrical arcs and stun. These timers and values are original RPG tuning. Temporary particles are capped, expire and dispose their owned resources; scene changes clear active impacts. Existing audio and source models are retained.

Validation: 101 unit tests pass, including all nine companion cartridge fits, actual uploaded glass bounds for all three guns, flight visibility, six distinct elemental visual signatures, effect disposal and status overlays. Real input/projectile browser checks pass for all six companions, healing, burn/freeze overlays, V, and both camera views. Camera and existing web/support/ram ability regressions pass. Native multi-touch and offline production checks pass; camera and offline checks were repeated after routing returning companions to the cartridge. The portable build retains all 18 reference images, seven runtime models and the supplied MP3 unchanged (22,434,607-byte HTML; 11,838,866-byte ZIP).

## Account saves continuation

This update preserves `0011420` in `backup/pre-account-saves-0011420`. The public game retains anonymous play and all existing models, reference artwork and audio. A small Worker adds account identity and D1 progress endpoints around the retained Vite game. The portable/static outputs remain local-only and make no account-service requests.

Direct Google and Microsoft OpenID Connect use Auth.js 0.41.3 with PKCE, state and nonce, validated provider responses, encrypted HttpOnly/Secure/SameSite cookies and same-origin POST sign-out. No ChatGPT account is required. Provider app credentials have not been configured in the hosting runtime. Setup and exact callback URLs are in [the OAuth guide](direct-sign-in-setup.md). Mock provider tests exercise successful Google/Microsoft exchanges, rejected state/nonce, tampered/expired sessions and logout. Browser QA uses encrypted fixture cookies only on loopback; real provider consent requires configured OAuth apps and a player to complete sign-in.

The D1 table uses the provider and stable provider account ID as its key. Matching emails do not link identities, and platform identity headers do not authorize game saves. Save writes require authentication, matching expected account, same-origin requests, the save header, bounded JSON and a valid expedition schema. Canonical game-state validation removes unsupported fields and clamps tuning values. Atomic revision checks reject competing writes. Changing account/session blocks further uploads until reauthentication or reload. Responses containing identity/progress are private and noncacheable.

Each account has its own local namespace. Guest saves are retained and imported only by selecting the import action. Cloud conflicts show both journeys and require a choice; adopting the cloud journey retains the displaced local record. Writes made during an upload remain pending for another upload. Network failures retain pending device data and retry on reconnection or manual retry. Browser storage failures are reported; a memory copy can still upload while the tab remains open. Imported audio is not uploaded with progress.

Validation: 113 unit tests pass, including seven account/API cases using real SQLite statements and five direct OAuth/session protocol cases. The complete original quest, Warden ending, input/audio/save regressions and native touchscreen checks pass. Direct-session hosted-browser checks pass for automatic D1 saving, conflict restoration, a fresh mobile browser and anonymous direct-provider links. The final portable checks pass with all 18 images, seven models and the supplied MP3 unchanged (22,446,574-byte HTML; 11,842,425-byte ZIP). Activation with real providers remains dependent on the OAuth app credentials described above.
