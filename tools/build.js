// Build the game for the web:
//   1. compile the TADS game (t3make, unless --no-compile) into korenvliet.t3
//   2. list the pictures in web/images in web/images.json (picture key -> file)
//   3. bundle the page (ui/main.ts -> web/korenvliet.js) and tads3js's worker
//      (web/tads3js-worker.js), and copy the game into web/korenvliet.t3
//   --debug: compile the debug build instead (debug verbs FETCH, TELEPORT)
// usage: node tools/build.js [--dev] [--debug] [--no-compile]
const esbuild = require('esbuild');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const web = path.join(root, 'web');
const dev = process.argv.includes('--dev');
const debug = process.argv.includes('--debug');
const image = debug ? 'obj/korenvliet-debug.t3' : 'korenvliet.t3';
const T3MAKE = process.env.T3MAKE || 'C:/Program Files (x86)/TADS 3/t3make.exe';

if(!process.argv.includes('--no-compile')) {
  for(const dir of ['obj', 'objd'])
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  console.log(debug ? 'Compiling the debug build...' : 'Compiling the game...');
  /* -pre: run preinit in the compiler (tads3js doesn't run it) */
  const args = debug ? ['-a', '-d', '-pre', '-f', 'korenvliet-debug.t3m'] : ['-a', '-f', 'korenvliet.t3m'];
  execFileSync(T3MAKE, args, { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
}
fs.copyFileSync(path.join(root, image), path.join(web, 'korenvliet.t3'));

// The pictures: web/images/<key>.<ext>
const PICTURE = /^(.+)\.(jpe?g|png|webp|avif|gif|svg)$/i;
const pictures = {};
const imageDir = path.join(web, 'images');
fs.mkdirSync(imageDir, { recursive: true });
for(const file of fs.readdirSync(imageDir).sort()) {
  const m = PICTURE.exec(file);
  if(m) pictures[m[1]] = 'images/' + file;
}
fs.writeFileSync(path.join(web, 'images.json'), JSON.stringify(pictures, null, 1));
console.log(`${Object.keys(pictures).length} pictures in web/images`);

esbuild.build({
  entryPoints: {
    'korenvliet': path.join(root, 'ui/main.ts'),
    'tads3js-worker': require.resolve('tads3js/src/web/worker.ts'),
  },
  outdir: web,
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2018',
  minify: !dev,
  sourcemap: true,
  logLevel: 'info',
}).catch(() => process.exit(1));
