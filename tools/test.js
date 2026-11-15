// Play the walkthrough (tests/walkthrough.in) on tads3js and compare the
// transcript with tests/walkthrough.out, recorded from the reference
// interpreter (t3run -norand).
// usage: node tools/test.js [--record]
// (Needs korenvliet.t3 - run the build first - and a built tads3js: npm run build there.)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const script = path.join(root, 'tests', 'walkthrough.in');
const expectedFile = path.join(root, 'tests', 'walkthrough.out');
const image = path.join(root, 'korenvliet.t3');
const T3RUN = process.env.T3RUN || 'C:/Program Files (x86)/TADS 3/t3run.exe';

if(process.argv.includes('--record')) {
  // (t3run loses output when stdout is a pipe: write to a file.)
  fs.mkdirSync(path.join(root, 'obj'), { recursive: true });
  fs.copyFileSync(script, path.join(root, 'obj', 'walkthrough.in'));
  execSync(`"${T3RUN}" -plain -norand -cs utf-8 -I walkthrough.in ../korenvliet.t3 > walkthrough.out`,
           { cwd: path.join(root, 'obj'), stdio: 'pipe', timeout: 120000 });
  fs.copyFileSync(path.join(root, 'obj', 'walkthrough.out'), expectedFile);
  console.log('Recorded', expectedFile);
  return;
}

const tads = path.dirname(require.resolve('tads3js/package.json'));
const { Vm } = require(path.join(tads, 'build', 'Vm'));
const { BufferHost } = require(path.join(tads, 'build', 'io', 'Host'));

const vm = Vm.getInstance();
const host = new BufferHost();
vm.host = host;
vm.randomSeed = false;   // (as t3run -norand)
vm.load(image);
vm.console.input.pushScript(fs.readFileSync(script, 'utf8'));
let start = Date.now();
vm.run();

const norm = (s) => s.replace(/\r\n/g, '\n');
const expected = norm(fs.readFileSync(expectedFile, 'utf8'));
if(norm(host.output) == expected) {
  console.log(`Walkthrough OK (${((Date.now() - start) / 1000).toFixed(1)}s)`);
} else {
  fs.writeFileSync(path.join(root, 'obj', 'actual.out'), host.output);
  console.log('Walkthrough FAILED: compare obj/actual.out with tests/walkthrough.out');
  process.exitCode = 1;
}
