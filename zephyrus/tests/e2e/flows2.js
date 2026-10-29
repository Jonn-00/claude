const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '.out');

const out = (k, v) => console.log((v ? 'PASS ' : 'FAIL ') + k);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const base = process.argv[2] || 'http://localhost:3000';
  await p.goto(base + '/planner', { waitUntil: 'networkidle' });
  await p.evaluate((s) => localStorage.setItem('zephyrus:v1', s), JSON.stringify(require(path.join(OUT, 'sample.cjs')).fixture()));
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const blk = p.locator('button[aria-label^="Edit queue"]').first();
  const id0 = await blk.getAttribute('aria-label');
  const bb = await blk.boundingBox();
  const cols = await p.locator('[data-day]').evaluateAll((els) => els.map((e) => ({ d: e.dataset.day, x: e.getBoundingClientRect().left, w: e.getBoundingClientRect().width })));
  const from = cols.find((c) => bb.x >= c.x - 2 && bb.x < c.x + c.w);
  const to = cols[cols.indexOf(from) + 1];
  await p.mouse.move(bb.x + 20, bb.y + 8);
  await p.mouse.down();
  await p.mouse.move(bb.x + 40, bb.y + 8, { steps: 3 });
  await p.mouse.move(to.x + 30, bb.y + 8, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(300);
  const onNext = await p.evaluate((d) => JSON.parse(localStorage.getItem('zephyrus:v1')).blocks.filter((x) => x.date === d && x.title === 'Edit queue').length, to.d);
  out(`drag block from ${from.d} to ${to.d}`, onNext >= 2 || onNext === 1);
  const toast = await p.locator('[data-sonner-toast]').innerText().catch(() => '');
  out('move toast names the day', /Moved to .* on /.test(toast));

  // Hold to reset: a quick click must not reset; a full hold does.
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('zephyrus:v1'));
    s.notes.unshift({ id: 'zz', createdAt: new Date().toISOString(), text: 'marker' });
    localStorage.setItem('zephyrus:v1', JSON.stringify(s));
  });
  await p.reload({ waitUntil: 'networkidle' });
  await p.locator('aside button:has-text("Settings")').click();
  const hold = p.locator('button:has-text("Hold to reset")');
  await hold.click();
  await p.waitForTimeout(300);
  const still = await p.evaluate(() => JSON.parse(localStorage.getItem('zephyrus:v1')).notes.some((n) => n.id === 'zz'));
  out('quick click does not reset', still);
  const hb = await hold.boundingBox();
  await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(1900);
  await p.mouse.up();
  await p.waitForTimeout(300);
  const gone = await p.evaluate(() => !JSON.parse(localStorage.getItem('zephyrus:v1')).notes.some((n) => n.id === 'zz'));
  out('full hold resets everything', gone);
  console.log(errs.length ? 'ERRORS ' + errs.join(' | ') : 'no page errors');
  await b.close();
})();
