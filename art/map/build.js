const fs = require('fs'), path = require('path');
const D = process.argv[2], HTML = process.argv[3], OUT = process.argv[4];
const L = f => JSON.parse(fs.readFileSync(path.join(D, f + '.geojson'), 'utf8')).features;
const html = fs.readFileSync(HTML, 'utf8');

// state shapes -> polygons (map coords)
const polys = []; const cmds = new Set();
const re = /^\s+(\w+): \{ name: '[^']+', box: \[[^\]]+\], d: '([^']+)' \}/gm; let m;
while ((m = re.exec(html))) {
  const d = m[2]; (d.match(/[a-zA-Z]/g) || []).forEach(c => cmds.add(c));
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+/g); let i = 0, x = 0, y = 0, cur = null, c = '';
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) { c = toks[i++]; if (c === 'z' || c === 'Z') { cur = null; continue; } }
    const a = +toks[i++], b = +toks[i++];
    if (c === 'M') { x = a; y = b; cur = [[x, y]]; polys.push({ id: m[1], p: cur }); c = 'L'; }
    else if (c === 'm') { x += a; y += b; cur = [[x, y]]; polys.push({ id: m[1], p: cur }); c = 'l'; }
    else if (c === 'L') { x = a; y = b; cur.push([x, y]); }
    else if (c === 'l') { x += a; y += b; cur.push([x, y]); }
    else throw new Error('cmd ' + c);
  }
}
console.error('shapes polys', polys.length, [...cmds].join(''));
const pip = (pt, p) => { let r = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) r = !r; } return r; };
const inside = pt => polys.some(q => pip(pt, q.p));
const proj = c => [218 + 54.19 * (c[0] - 25), 108 + 57.5 * (22 - c[1])];
const flat = g => g.type === 'LineString' ? [g.coordinates] : g.coordinates;
// densify so border clipping is tight
const dens = l => { const o = [l[0]]; for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2); for (let k = 1; k <= n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } return o; };
const clip = l => { const out = []; let cur = null; for (const p of l) { if (inside(p)) { if (!cur) { cur = []; out.push(cur); } cur.push(p); } else cur = null; } return out.filter(s => s.length > 1); };
const dp = (l, t) => {
  if (l.length < 3) return l; let mx = 0, ix = 0; const a = l[0], b = l[l.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1e-9;
  for (let i = 1; i < l.length - 1; i++) { const d = Math.abs(dy * (l[i][0] - a[0]) - dx * (l[i][1] - a[1])) / n; if (d > mx) { mx = d; ix = i; } }
  return mx > t ? dp(l.slice(0, ix + 1), t).slice(0, -1).concat(dp(l.slice(ix), t)) : [a, b];
};
const r1 = v => Math.round(v * 2) / 2; const f = v => String(v).replace(/^(-?)0\./, '$1.');
const enc = lines => lines.map(l => {
  let px = r1(l[0][0]), py = r1(l[0][1]); const s = 'M' + f(px) + ' ' + f(py) + 'l'; const parts = [];
  for (let i = 1; i < l.length; i++) { const x = r1(l[i][0]), y = r1(l[i][1]); if (x === px && y === py) continue; parts.push(f(x - px) + ' ' + f(y - py)); px = x; py = y; }
  return parts.length ? s + parts.join(' ') : '';
}).join('');
const layer = (feats, tol, minLen) => { const lines = []; feats.forEach(ft => flat(ft.geometry).forEach(l => clip(dens(l.map(proj))).forEach(s => { const len = s.reduce((a, p, i) => i ? a + Math.hypot(p[0] - s[i - 1][0], p[1] - s[i - 1][1]) : 0, 0); if (len >= minLen) lines.push(dp(s, tol)); }))); return lines; };
const near = ft => flat(ft.geometry).some(l => l.some(c => c[0] > 21 && c[0] < 39.5 && c[1] > 8 && c[1] < 23.6));
const roadsAll = L('ne_10m_roads').filter(ft => ft.geometry && near(ft));
const hw = layer(roadsAll.filter(ft => ft.properties.type !== 'Unknown'), .5, 3), tr = layer(roadsAll.filter(ft => ft.properties.type === 'Unknown'), .6, 4);
const rail = layer(L('ne_10m_railroads').filter(ft => ft.geometry && near(ft)), .6, 3);
const rivers = layer(L('ne_10m_rivers_lake_centerlines').filter(ft => ft.geometry && near(ft)), .4, 3);
const C = fs.readFileSync(path.join(__dirname, 'cities.tsv'), 'utf8').trim().split(/\r?\n/).map(r => r.split('\t')).map(([lat, lon, rank, ar, en, fr]) => { const p = proj([+lon, +lat]); return { p, rank: +rank, ar, en, fr: fr || en, in: inside(p) }; });
C.filter(c => !c.in).forEach(c => console.error('OUTSIDE', c.en));
const q = s => "'" + s.replace(/'/g, "\\'") + "'";
const out = { hw: enc(hw), tr: enc(tr), rail: enc(rail), rivers: enc(rivers) };
const js = "    detail: {\n" + Object.keys(out).map(k => `      ${k}: '${out[k]}',`).join('\n') + "\n      cities: [\n" +
  C.filter(c => c.in).sort((a, b) => a.rank - b.rank).map(c => `        [${Math.round(c.p[0])}, ${Math.round(c.p[1])}, ${c.rank}, ${q(c.ar)}, ${q(c.en)}, ${q(c.fr)}]`).join(',\n') + "\n      ]\n    },\n";
fs.writeFileSync(OUT, js);
Object.keys(out).forEach(k => console.error(k, out[k].length));
// preview svg
const shapesSvg = polys.map(q => `<path d="M${q.p.map(p => p.join(' ')).join('L')}z" fill="#eadfc4" stroke="#fff"/>`).join('');
fs.writeFileSync(OUT + '.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="30 25 940 850" width="1410" height="1275"><rect x="30" y="25" width="940" height="850" fill="#b7cfca"/>${shapesSvg}<path d="${out.rivers}" fill="none" stroke="#3a8fc4" stroke-width="2"/><path d="${out.tr}" fill="none" stroke="#b08a5a" stroke-width=".8"/><path d="${out.hw}" fill="none" stroke="#c0392b" stroke-width="1.3"/><path d="${out.rail}" fill="none" stroke="#333" stroke-width=".7" stroke-dasharray="3 2"/>${C.map(c => `<circle cx="${c.p[0]}" cy="${c.p[1]}" r="${4 - c.rank}" fill="#fff" stroke="#000"/><text x="${c.p[0] + 4}" y="${c.p[1] - 3}" font-size="9">${c.en}</text>`).join('')}</svg>`);
