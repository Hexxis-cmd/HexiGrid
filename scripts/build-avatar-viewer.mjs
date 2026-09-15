import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
await build({
  stdin: { contents: "import '@google/model-viewer';", resolveDir: root, sourcefile: 'avatar-viewer-entry.js' },
  outfile: path.join(root, 'public', 'vendor', 'model-viewer.js'),
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: false,
  legalComments: 'external'
});
