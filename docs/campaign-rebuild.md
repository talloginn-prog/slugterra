# Slugterra campaign rebuild — research and implementation record

Requested 2026-11-01. Research must precede the visual/content rebuild.

## Continuation implemented after repository recovery

The prior development source was pushed to `backup/slugterra-rpg-development-2026-11-01` at `48a720ce10a90731bd4f4b1c2aac0114c6196f22`. All 25 files were verified against their Git blobs before edits, including the supplied MP3 (SHA-256 `7ae14c8c32011e6b983afdf2d62be18f7e8a0bacc12c071d47c061e7a23703ae`). The unchanged baseline passed all 21 tests, the production build and the complete original browser suite.

The continuation retains the original expedition and adds Dark Spores/Pyrite, travel lifecycle and checkpoints, persistent encounters/discoveries/surveys, six companions with three equipped slots, a blaster shop, training and guided Slug Fu, enemy telegraphs/cover/leash behavior, and Ultra/challenge settings. Saves migrate to a separate version-2 key while retaining version-1 recovery data. The audio engine, IndexedDB and supplied recording remain independent of campaign travel.

The current environment has enforced unrestricted HTTP access. The official site, Disney-hosted legacy arsenal and tested source image hosts return HTTP 200. Fandom articles still return HTTP 402; indexed Wiki evidence and directly inspected images are labeled accordingly. See [verified canon](references/verified-canon-2026-11-01.md), [cavern reference board](references/cavern-reference-board.md), and [reference provenance](references/reference-assets.json).

The network restrictions and archive path in the earlier record below describe the previous environment. `.local/backups/pre-campaign-2026-11-01.tar.gz` is ignored and was not pushed; the remote backup branch above is the verified restore point. No claim is made that personal audio clips held in another browser origin were recovered from GitHub.

## Earlier research status (historical)

Application implementation has not started. The running environment permits package-manager destinations but currently denies the reference websites. Read-only HTTPS attempts to the following URLs returned proxy tunnel HTTP 403 errors:

- https://slugterra.fandom.com/wiki/Caverns
- https://slugterra.fandom.com/wiki/Slug_Fu
- https://www.slugterra.com/
- https://en.wikipedia.org/wiki/Slugterra

The original reference websites remain unreachable. Independent publicly hosted GitHub reference projects have now been retrieved and are being audited, including their local images. These are fan-maintained alternatives, not authoritative verification of all show canon. See `network-diagnosis.md` and `references/` for actual access evidence and source confidence. Do not treat remembered lore or generated artwork as completed research.

A saved environment draft adds these exact custom domains, preserving the package-manager preset:

- slugterra.fandom.com
- static.wikia.nocookie.net
- slugterra.com
- www.slugterra.com
- en.wikipedia.org
- upload.wikimedia.org

The image hosts are planned reference destinations, not successfully fetched sources. The draft save does not apply the policy or publish an environment. The user reports public access is already published. Current tools cannot compare this attached source version to the latest published version; do not request another publication without evidence of outdated settings. Diagnosis now establishes proxy CONNECT denial, not origin bot blocking. Continue research using independently hosted, permitted references while recording their limits.

The existing source and supplied transformation MP3 are preserved in the verified archive `.local/backups/pre-campaign-2026-11-01.tar.gz`. Do not restore it over subsequent user changes.

## Research deliverables before content work

1. A source-linked lore digest covering caverns, society/NPCs, factions/enemies, slug species and classification, transformation mechanics, Slug Fu, and blaster equipment. Prefer official references and identify fan-maintained sources explicitly.
2. A cavern reference board with source URLs, picture URLs, and actual visual observations: terrain silhouettes, geology, architecture, vegetation, palette, lighting, travel routes and landmarks. View the images before modeling from them.
3. A species catalog with stable IDs, canonical names, element/class, normal and transformed visual references, and source attribution. Verify whether rarity comes from the show, a particular official game, or this project's design. Mark project balancing choices separately.
4. A concise implementation scope derived from those findings, with canonical facts separated from invented quests, prices, enemy statistics and game mechanics. The current Luminous Deep and its custom story are prior project content, not verified show locations.

## Requested playable behavior

- Several distinct connected caverns with travel gates, checkpoints, persistent per-cavern progress and quests.
- NPC conversations and useful roles such as merchants, trainers and expedition contacts.
- Challenging enemies with observable windups, recovery windows, line-of-sight/cover, leash behavior, counterplay and tunable difficulty. Defeat must remain recoverable.
- Currency, a blaster shop, ownership/equipment rules and meaningful weapon tradeoffs.
- Skill progression including a researched interpretation of Slug Fu, prerequisites, costs and cooldowns.
- Discoverable slugs, a larger owned collection, explicit rarity/classification, distinct species models, and three equipped slots retaining 1/2/3 controls.
- Higher graphical detail and an adjustable high/ultra preset for the user's RTX 5060 Ti 16GB. Hardware-specific frame rates cannot be claimed without measurements on that GPU.

## Integration findings

Keep input.js, physics.js and audio.js stable where possible. Preserve simultaneous aim/fire/turn, C focus, immediate F firing, jump buffering, touch input, fixed 120Hz physics, and recorded-audio override behavior. Preserve the provided MP3 inline import and its 85ms playback offset.

Introduce a shared content catalog, expanded campaign state, a cavern factory and new UI panels. The existing main.js owns one const world and passes its groundHeight function to the character controller; switching caverns must rebind terrain and colliders and dispose old resources. Current models and SVG art assume only three species, so new species require explicit visual archetypes rather than color-only entries.

Store discovered collection separately from the three equipped slots. The current selectedSlug save range and blaster roster capture require updating. Use a tested save migration that keeps legacy progress and settings recoverable until a new save succeeds; keep recorded-audio IndexedDB storage independent.

## Validation after implementation

Retain existing input, physics and audio tests. Add save migration and corruption tests, travel progression, discovery/equip restrictions, currency/ownership/prerequisite rules, skill cooldowns, enemy windup/recovery and reward idempotence. Exercise cavern travel, NPC/shop interaction, discovery, equipment, skills, combat and reload in a real browser. Rebuild and verify the portable package and supplied MP3 playback.
