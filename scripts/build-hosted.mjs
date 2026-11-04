import { build } from 'vite';
import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';

// Keep the Vite game and portable package intact; add a small server for account saves.
await build();
await mkdir('dist/client', { recursive: true });
await cp('dist/index.html', 'dist/client/index.html');
await cp('dist/assets', 'dist/client/assets', { recursive: true });
await build({ configFile: false, ssr: { noExternal: true }, build: { target: 'esnext', ssr: 'server/index.js', outDir: 'dist/server', emptyOutDir: true, rollupOptions: { output: { entryFileNames: 'index.js' } } } });
const hosting = JSON.parse(await readFile('.openai/hosting.json', 'utf8'));
await mkdir('dist/.openai', { recursive: true });
await writeFile('dist/.openai/hosting.json', JSON.stringify(hosting, null, 2) + '\n');
await writeFile('dist/server/wrangler.json', JSON.stringify({
  name: 'slugterra-cavern-expeditions', main: 'index.js', compatibility_date: '2026-05-01', compatibility_flags: ['nodejs_compat'],
  assets: { directory: '../client', binding: 'ASSETS', run_worker_first: true },
  d1_databases: [{ binding: 'DB', database_name: 'slugterra-player-progress', migrations_dir: '../../drizzle' }],
}, null, 2) + '\n');
