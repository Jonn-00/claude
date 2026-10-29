const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '.out');

const base = process.argv[2];
const out = (k, v) => console.log((v ? 'PASS ' : 'FAIL ') + k);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(base + '/index.html', { waitUntil: 'networkidle' });
  await p.evaluate((s) => localStorage.setItem('zephyrus:v1', s), JSON.stringify(require(path.join(OUT, 'sample.cjs')).fixture()));
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  out('Today renders', (await p.locator('h2:has-text("Production line")').count()) === 1);
  out('fonts embedded', await p.evaluate(() => document.fonts.check('16px "Onest Variable"') && document.fonts.check('16px "Bricolage Grotesque Variable"')));

  for (const [label, hash, heading] of [['Channels', '#channels', 'Channels'], ['Agency', '#agency', 'Agency'], ['Planner', '#planner', 'Planner'], ['Notes', '#notes', 'Notes'], ['Today', '#today', null]]) {
    await p.locator(`nav a:has-text("${label}")`).first().click();
    await p.waitForTimeout(400);
    const h1 = await p.locator('h1').first().innerText();
    out(`nav to ${label} (${p.url().split('/').pop()})`, p.url().endsWith(hash) && (heading ? h1 === heading : true));
  }

  await p.locator('section:has(h2:has-text("Calls today")) button:has-text("Talked")').click();
  await p.waitForTimeout(1100);
  out('log a dial shows toast', (await p.locator('[data-sonner-toast]:has-text("Logged: Talked")').count()) === 1);

  await p.evaluate(() => scrollTo(0, 0));
  await p.waitForTimeout(100);
  const coffee = p.locator('button[aria-label^="The $5 coffee myth"]');
  const cb = await coffee.boundingBox();
  const target = await p.locator('[data-stage="thumbnail"]').boundingBox();
  await p.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await p.mouse.down();
  await p.mouse.move(cb.x + 30, cb.y + 10, { steps: 4 });
  await p.mouse.move(target.x + target.width / 2, target.y + 60, { steps: 10 });
  await p.mouse.up();
  await p.waitForTimeout(300);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('zephyrus:v1')).videos.find((v) => v.id === 'tv08').stage);
  out('drag video between stages', st === 'thumbnail');

  await p.keyboard.press('Control+k');
  await p.keyboard.type('Gloss');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(500);
  out('search jumps to the lead on Agency', p.url().endsWith('#agency') && (await p.locator('#lead-tl02.bg-raised').count()) === 1);

  await p.goto(base + '/index.html#notes', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  out('direct link to #notes opens Notes', (await p.locator('h1').first().innerText()) === 'Notes');
  await p.goBack().catch(() => {});

  await p.goto(base + '/index.html#today', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  await p.mouse.click(700, 120);
  await p.keyboard.press('a');
  await p.waitForTimeout(300);
  const tabbable = await p.evaluate(() => !document.querySelector('#agenda-body [inert]'));
  out('agenda opens and is focusable', tabbable);
  await p.keyboard.press('a');
  await p.waitForTimeout(300);
  out('folded agenda is inert', await p.evaluate(() => !!document.querySelector('#agenda-body [inert]')));

  const m = await b.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto(base + '/index.html#agency', { waitUntil: 'networkidle' });
  await m.waitForTimeout(500);
  const sw = await m.evaluate(() => document.documentElement.scrollWidth);
  out('phone: no sideways scroll (' + sw + ')', sw <= 390);

  console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 8).join('\n') : 'no console errors');
  await b.close();
})();
