# Slugterra campaign rebuild — research and implementation record

Requested 2026-11-01. Research must precede the visual/content rebuild.

## Current status

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
