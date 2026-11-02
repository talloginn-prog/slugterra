// Asset-free bridge keeps world generation and physics usable in Node tests.
let factories = {};
export function registerImportedModels(next) { factories = next || {}; }
export function applyImportedSlug(...args) { return factories.slug?.(...args) || null; }
export function createImportedBlaster(...args) { return factories.blaster?.(...args) || null; }
