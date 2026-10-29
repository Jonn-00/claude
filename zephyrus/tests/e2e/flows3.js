const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '.out');

const base = process.argv[2] || 'http://localhost:3000';
const hash = process.argv[3] === 'hash';
const url = (pg) => (hash ? `${base}/index.html#${pg || 'today'}` : `${base}/${pg}`);
const out = (k, v) => console.log((v ? 'PASS ' : 'FAIL ') + k);
const st = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('zephyrus:v1')));

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url(''), { waitUntil: 'networkidle' });
  await p.evaluate((s) => localStorage.setItem('zephyrus:v1', s), JSON.stringify(require(path.join(OUT, 'sample.cjs')).fixture()));
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(600);

  out('your channels are in', (await p.locator('text=tikktokers').count()) > 0 && (await p.locator('text=CoolioCarZ').count()) > 0);

  // Rename a stage by clicking its name.
  await p.locator('[role="button"][aria-label^="Stage name: Thumbnail"]').click();
  await p.keyboard.press('Control+a');
  await p.keyboard.type('Thumbs');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(150);
  out('rename stage', (await st(p)).stages.some((x) => x.id === 'thumbnail' && x.label === 'Thumbs'));

  // Add a video through the stage menu.
  const idea = p.locator('[data-stage="idea"]');
  await idea.hover();
  await idea.locator('button[aria-label="Options for Idea"]').click();
  await p.locator('button:has-text("Add video here")').click();
  await p.locator('input[aria-label="New video title"]').fill('Fastest cars under 10k');
  await p.locator('input[aria-label="New video title"]').press('Enter');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  out('add video to a stage', (await st(p)).videos.some((v) => v.title === 'Fastest cars under 10k' && v.stage === 'idea'));

  // Edit a video's title and date from its editor.
  await p.locator('button[aria-label^="Lights 4 km down"]').click();
  const dlg = p.locator('[role="dialog"][aria-label^="Edit Lights 4 km down"]');
  await dlg.locator('textarea').fill('Lights 4 km down (final)');
  await dlg.locator('textarea').press('Enter');
  await dlg.locator('input[type="datetime-local"]').fill('2026-11-05T18:30');
  await p.waitForTimeout(150);
  const v12 = (await st(p)).videos.find((v) => v.id === 'tv12');
  out('edit video title', v12.title === 'Lights 4 km down (final)');
  out('edit video date', new Date(v12.publishAt).getHours() === 18 && new Date(v12.publishAt).getMinutes() === 30);
  await p.keyboard.press('Escape');

  // Add a stage, name it, remove it, undo.
  const edit = p.locator('[data-stage="edit"]');
  await edit.hover();
  await edit.locator('button[aria-label="Options for Edit"]').click();
  await p.locator('button:has-text("Add a stage after this")').click();
  await p.waitForTimeout(150);
  await p.keyboard.press('Control+a');
  await p.keyboard.type('Color grade');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(150);
  let s = await st(p);
  const added = s.stages.findIndex((x) => x.label === 'Color grade');
  out('add a stage after Edit', added === s.stages.findIndex((x) => x.id === 'edit') + 1);
  const cg = p.locator(`[data-stage="${s.stages[added].id}"]`);
  await cg.hover();
  await cg.locator('button[aria-label="Options for Color grade"]').click();
  await p.locator('button:has-text("Remove stage")').click();
  await p.waitForTimeout(150);
  out('remove a stage', !(await st(p)).stages.some((x) => x.label === 'Color grade'));
  await p.locator('[data-sonner-toast]:has-text("Removed") button:has-text("Undo")').click();
  await p.waitForTimeout(150);
  out('undo stage removal', (await st(p)).stages.some((x) => x.label === 'Color grade'));

  // Rename a panel title.
  await p.locator('[role="button"][aria-label^="Production line title"]').click();
  await p.keyboard.press('Control+a');
  await p.keyboard.type('Pipeline');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(150);
  out('rename a panel title', (await p.locator('h2:has-text("Pipeline")').count()) === 1);

  // Edit a reminder's text.
  await p.locator('[role="button"][aria-label^="Reminder: Send invoice"]').click();
  await p.keyboard.press('Control+a');
  await p.keyboard.type('Send invoice to Detail Den today');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(150);
  out('edit a reminder', (await st(p)).reminders.some((r) => r.title === 'Send invoice to Detail Den today'));

  // Change the dial target inline.
  await p.locator('[role="button"][aria-label^="Daily dial target"]').click();
  await p.keyboard.press('Control+a');
  await p.keyboard.type('80');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(150);
  out('edit dial target', (await st(p)).settings.dialTarget === 80);

  // Collapse the sidebar; it stays collapsed after reload.
  if (!hash || true) {
    await p.locator('button[aria-label="Collapse sidebar"]').click();
    await p.waitForTimeout(350);
    const w = await p.locator('aside').first().evaluate((e) => e.getBoundingClientRect().width);
    out('collapse sidebar to a rail (' + Math.round(w) + 'px)', w <= 66);
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    const w2 = await p.locator('aside').first().evaluate((e) => e.getBoundingClientRect().width);
    out('rail remembered after reload', w2 <= 66);
    await p.locator('aside a[aria-label="Agency"]').click();
    await p.waitForFunction(() => document.querySelector('h1')?.textContent === 'Agency', null, { timeout: 15000 }).catch(() => {});
    out('rail icons still navigate', (await p.locator('h1').first().innerText()) === 'Agency');
    await p.keyboard.press('[');
    await p.waitForTimeout(350);
    const w3 = await p.locator('aside').first().evaluate((e) => e.getBoundingClientRect().width);
    out('[ expands it again', w3 > 200);
  }

  // Edit a lead's name inline.
  await p.goto(url('agency'), { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  await p.locator('button[aria-pressed]:has-text("All")').last().click();
  await p.locator('li[id="lead-tl11"] > button').click();
  await p.locator('li[id="lead-tl11"] [role="button"][aria-label^="Business: Shine Theory"]').click();
  await p.keyboard.press('Control+a');
  await p.keyboard.type('Shine Theory Detailing');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(150);
  out('edit a lead name', (await st(p)).leads.some((l) => l.business === 'Shine Theory Detailing'));

  // Enter real numbers for a channel; the charts scale to them.
  await p.goto(url('channels'), { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const about = await p.locator('dl').first().innerText();
  out('real YouTube figures shown (1,880 subscribers, 40 uploads)', /Subscribers\s+1,880/.test(about) && /Uploads\s+40/.test(about));
  out('real upload titles in the table', (await p.locator('table a[href^="https://www.youtube.com/watch?v="]').count()) >= 5);
  out('YouTube and Social Blade links', (await p.locator('a[href="https://www.youtube.com/@tikktokers"]').count()) === 1 && (await p.locator('a[href="https://socialblade.com/youtube/handle/tikktokers"]').count()) === 1);

  // Block editor times.
  await p.goto(url('planner'), { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  await p.locator('button[aria-label^="Gym"]').first().click();
  await p.locator('input[aria-label="Starts"]').fill('20:00');
  await p.locator('input[aria-label="Ends"]').fill('21:15');
  await p.locator('button:text-is("Save")').click();
  await p.waitForTimeout(200);
  out('retime a block by typing', (await st(p)).blocks.some((x) => x.title === 'Gym' && x.start === 1200 && x.end === 1275));

  console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 8).join('\n') : 'no console errors');
  await b.close();
})();
