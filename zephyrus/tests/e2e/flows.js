const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '.out');

const base = process.argv[2] || 'http://localhost:3000';
const out = (k, v) => console.log((v ? 'PASS ' : 'FAIL ') + k);

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.evaluate((s) => localStorage.setItem('zephyrus:v1', s), JSON.stringify(require(path.join(OUT, 'sample.cjs')).fixture()));
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(600);

  const dials = async () => Number((await p.locator('section:has(h2:has-text("Calls today")) svg[aria-label^="Dials today:"]').first().getAttribute('aria-label')).split(':')[1].replace(/[^0-9]/g, ''));
  const d0 = await dials();
  await p.locator('section:has(h2:has-text("Calls today")) button:has-text("Talked")').click();
  await p.waitForTimeout(1100);
  out('log a dial increments (saved and shown)', (await dials()) === d0 + 1);
  await p.locator('[data-sonner-toast] button:has-text("Undo")').first().click();
  await p.waitForTimeout(1100);
  out('undo removes it', (await dials()) === d0);

  // Drag a video onto another stage, then undo from the toast.
  await p.evaluate(() => scrollTo(0, 0));
  await p.waitForTimeout(100);
  const coffee = p.locator('button[aria-label^="The $5 coffee myth"]');
  const cb = await coffee.boundingBox();
  const target = await p.locator('[data-stage="thumbnail"]').boundingBox();
  await p.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await p.mouse.down();
  await p.mouse.move(cb.x + cb.width / 2 + 20, cb.y + 10, { steps: 4 });
  await p.mouse.move(target.x + target.width / 2, target.y + 60, { steps: 10 });
  await p.mouse.up();
  await p.waitForTimeout(300);
  const st1 = await p.evaluate(() => JSON.parse(localStorage.getItem('zephyrus:v1')).videos.find((v) => v.id === 'tv08').stage);
  out('drag video to Thumbnail', st1 === 'thumbnail');
  out('ghost removed after drop', (await p.locator('body > button[aria-hidden="true"]').count()) === 0);
  await p.locator('[data-sonner-toast] button:has-text("Undo")').first().click();
  await p.waitForTimeout(300);
  const st2 = await p.evaluate(() => JSON.parse(localStorage.getItem('zephyrus:v1')).videos.find((v) => v.id === 'tv08').stage);
  out('undo puts it back in Edit', st2 === 'edit');

  // Delete a reminder and undo it.
  const rem = p.locator('li:has-text("Top up voiceover credits")');
  await rem.hover();
  await rem.locator('button[aria-label^="Delete"]').click();
  await p.waitForTimeout(200);
  out('reminder deleted', (await p.locator('li:has-text("Top up voiceover credits")').count()) === 0);
  await p.locator('[data-sonner-toast]:has-text("Deleted reminder") button:has-text("Undo")').click();
  await p.waitForTimeout(200);
  out('reminder restored by undo', (await p.locator('li:has-text("Top up voiceover credits")').count()) === 1);

  const chip = p.locator('button[aria-label^="The ship that sailed 38 years alone"]');
  await chip.click();
  await p.locator('[role="dialog"] button:has-text("Thumbnail")').click();
  await p.waitForTimeout(300);
  const stage = await p.evaluate(() => JSON.parse(localStorage.getItem('zephyrus:v1')).videos.find((v) => v.id === 'tv03').stage);
  out('move video to next stage', stage === 'thumbnail');

  await p.mouse.click(700, 120);
  await p.keyboard.press('n');
  await p.waitForTimeout(200);
  await p.locator('form[aria-label="Quick add"] input[aria-label="Title"]').fill('Test reminder from flow');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(200);
  await p.keyboard.press('Escape');
  const more = p.locator('section:has(h2:has-text("Reminders")) button:has-text("Show")');
  if (await more.count()) await more.click();
  out('quick add reminder shows on Today', (await p.locator('text=Test reminder from flow').count()) > 0);

  await p.keyboard.press('Control+k');
  await p.waitForTimeout(150);
  await p.keyboard.type('Gloss');
  await p.keyboard.press('Enter');
  await p.waitForURL(/agency\?lead=/, { timeout: 8000 }).catch(() => {});
  out('search jumps to a lead', /agency\?lead=tl02/.test(p.url()));

  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  // Drag in an empty stretch of the hourly planner (scroll to 06:00 first).
  const scroller = p.locator('section:has(h2:has-text("Hourly")) .overflow-y-auto');
  await scroller.evaluate((el) => (el.scrollTop = 0));
  const box = await scroller.boundingBox();
  const x = box.x + box.width * 0.6;
  const y0 = box.y + 8 + 44 * 0.3; // ~06:15
  await p.mouse.move(x, y0);
  await p.mouse.down();
  await p.mouse.move(x, y0 + 44, { steps: 6 });
  await p.mouse.up();
  await p.waitForTimeout(200);
  const ed = p.locator('input[aria-label="Block title"]');
  out('drag opens block editor', (await ed.count()) === 1);
  if (await ed.count()) {
    await ed.fill('Morning test block');
    await ed.press('Enter');
    await p.waitForTimeout(200);
  }
  out('block saved', (await p.locator('button[aria-label^="Morning test block"]').count()) === 1);
  // Drag that block down an hour.
  await p.keyboard.press('Escape');
  const blk = p.locator('button[aria-label^="Morning test block"]');
  const bb = await blk.boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + 6);
  await p.mouse.down();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + 6 + 22, { steps: 3 });
  await p.mouse.move(bb.x + bb.width / 2, bb.y + 6 + 44, { steps: 6 });
  await p.mouse.up();
  await p.waitForTimeout(400);
  const moved = await p.evaluate(() => JSON.parse(localStorage.getItem('zephyrus:v1')).blocks.find((b) => b.title === 'Morning test block'));
  out('drag block one hour later', moved && moved.start === 7 * 60 + 15);

  await p.mouse.click(700, 120);
  await p.keyboard.press('a');
  await p.waitForTimeout(400);
  const ta = p.locator('#agenda-body textarea').first();
  await ta.fill('Shipped the dashboard');
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const saved = await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('zephyrus:v1')).agenda).some((e) => e.shipped === 'Shipped the dashboard'));
  out('agenda persists after reload', saved);
  out('agenda stays open after reload', (await p.locator('button[aria-controls="agenda-body"][aria-expanded="true"]').count()) === 1);

  await p.goto(base + '/channels', { waitUntil: 'networkidle' });
  await p.locator('[role="button"][aria-label^="Channel name:"]').click();
  await p.keyboard.press('Control+a');
  await p.keyboard.type('My First Channel');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(200);
  out('rename channel', (await p.locator('text=My First Channel').count()) > 0);

  await p.goto(base + '/agency', { waitUntil: 'networkidle' });
  await p.locator('select').first().selectOption('tl09');
  await p.locator('#log button:has-text("Demo booked")').click();
  await p.waitForTimeout(200);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('zephyrus:v1')).leads.find((l) => l.id === 'tl09').status);
  out('dial on a lead updates its status', st === 'demo');

  const waveFlat = await p.evaluate(() => {
    const ds = [...document.querySelectorAll('svg[aria-label^="Dials and Reached"] path[d]')].map((x) => x.getAttribute('d'));
    return ds.length === 0 || ds.every((d) => new Set(d.match(/,[\d.]+/g)).size < 3);
  });
  out('pick-up waves are drawn', !waveFlat);

  await p.goto(base + '/planner', { waitUntil: 'networkidle' });
  out('planner shows test block', (await p.locator('button[aria-label^="Morning test block"]').count()) === 1);

  await p.goto(base + '/notes', { waitUntil: 'networkidle' });
  await p.locator('textarea[aria-label="New note"]').fill('A note from the test');
  await p.locator('button:text-is("Save note")').click();
  out('add note', (await p.locator('text=A note from the test').count()) === 1);
  out('agenda entry shows in daily reports', (await p.locator('text=Shipped the dashboard').count()) > 0);

  await p.evaluate(() => localStorage.clear());
  console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.slice(0, 8).join('\n') : 'no console errors');
  await b.close();
})();
