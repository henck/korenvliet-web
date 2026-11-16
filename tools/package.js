// Package the game for a web server: builds the release version, then zips the
// files the page needs (no source maps, no debug build) into
// dist/korenvliet-<version>.zip, with index.html at the top of the zip.
// Unzip it into the site's folder on any static web host.
// usage: node tools/package.js [--no-build]
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const web = path.join(root, 'web');
const version = require('../package.json').version;

if(!process.argv.includes('--no-build'))
  execFileSync(process.execPath, [path.join(__dirname, 'build.js')], { cwd: root, stdio: 'inherit' });

// The files: the page, its script and style, the VM's worker, the game, the pictures.
// (.htaccess: settings for Apache servers; other servers ignore it.)
const files = ['index.html', '.htaccess', 'modern.css', 'korenvliet.js', 'tads3js-worker.js', 'korenvliet.t3', 'images.json'];
for(const file of fs.readdirSync(path.join(web, 'images')).sort())
  if(!file.startsWith('.')) files.push('images/' + file);

const entries = files.map((name) => {
  let data = fs.readFileSync(path.join(web, name));
  // (The source maps aren't shipped, so drop the references to them.)
  if(name.endsWith('.js')) data = Buffer.from(data.toString('utf8').replace(/\n\/\/# sourceMappingURL=\S+\s*$/, '\n'));
  return { name, data };
});

const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
const zipPath = path.join(dist, `korenvliet-${version}.zip`);
fs.writeFileSync(zipPath, zip(entries));
const size = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
console.log(`${path.relative(root, zipPath)}: ${entries.length} files, ` +
  `${size(entries.reduce((n, e) => n + e.data.length, 0))} (${size(fs.statSync(zipPath).size)} zipped)`);

/** A zip archive of the entries (deflated, or stored when that's smaller). */
function zip(entries) {
  const parts = [], central = [];
  let offset = 0;
  // DOS date and time of now
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for(const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const stored = deflated.length >= data.length;
    const body = stored ? data : deflated;
    const crc = zlib.crc32(data);
    const header = (sig, extra) => {
      const h = Buffer.alloc(extra ? 46 : 30);
      let p = 0;
      const u32 = (v) => { h.writeUInt32LE(v >>> 0, p); p += 4; };
      const u16 = (v) => { h.writeUInt16LE(v, p); p += 2; };
      u32(sig);
      if(extra) u16(20);                    // version made by
      u16(20); u16(0x0800);                 // version needed; flags: UTF-8 names
      u16(stored ? 0 : 8); u16(time); u16(date);
      u32(crc); u32(body.length); u32(data.length);
      u16(nameBuf.length); u16(0);          // name length, extra length
      if(extra) { u16(0); u16(0); u16(0); u32(0); u32(offset); }  // comment, disk, attributes, offset
      return h;
    };
    const local = header(0x04034b50, false);
    parts.push(local, nameBuf, body);
    central.push(header(0x02014b50, true), nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBuf, end]);
}
