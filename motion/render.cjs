// Renders the composition frame-by-frame in headless Chromium.
//   node render.cjs video [--workers 4] [--sub 6]   → out/video_silent.mkv
//   node render.cjs stills 0.5 2.7 8.3 ...          → out/stills/t_*.png
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const FPS = 60, FRAMES = 900;
const url = 'file://' + path.join(__dirname, 'index.html') + '?render=1';
const out = path.join(__dirname, 'out');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };

async function openPage() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => { console.error('page error:', e); process.exit(1); });
  await page.goto(url);
  await page.evaluate(() => window.__ready);
  return { browser, page };
}

async function stills(times) {
  fs.mkdirSync(path.join(out, 'stills'), { recursive: true });
  const { browser, page } = await openPage();
  for (const t of times) {
    const f = Math.round(t * FPS);
    await page.evaluate(([f, s]) => window.__render(f, s), [f, arg('--sub', 6)]);
    await page.screenshot({ path: path.join(out, 'stills', `t_${t.toFixed(2)}.png`) });
  }
  await browser.close();
}

async function worker(id, from, to, sub) {
  const { browser, page } = await openPage();
  const seg = path.join(out, `seg_${id}.mkv`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'ffv1', '-pix_fmt', 'rgb24', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = from; f < to; f++) {
    await page.evaluate(([f, s]) => window.__render(f, s), [f, sub]);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - from) % 30 === 0) console.log(`worker ${id}: frame ${f} (${from}–${to - 1})`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  return seg;
}

async function video() {
  const workers = arg('--workers', 4), sub = arg('--sub', 6);
  const per = Math.ceil(FRAMES / workers), jobs = [];
  for (let i = 0; i < workers; i++) jobs.push(worker(i, i * per, Math.min(FRAMES, (i + 1) * per), sub));
  const segs = await Promise.all(jobs);
  const list = path.join(out, 'segs.txt');
  fs.writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
  await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-c', 'copy', path.join(out, 'video_silent.mkv')], { stdio: 'inherit' }).on('close', c => c ? rej(c) : res()));
  segs.forEach(s => fs.unlinkSync(s)); fs.unlinkSync(list);
  console.log('wrote out/video_silent.mkv');
}

const mode = process.argv[2];
(mode === 'stills' ? stills(process.argv.slice(3).filter(a => !a.startsWith('--') && !isNaN(a)).map(Number)) : video())
  .catch(e => { console.error(e); process.exit(1); });
