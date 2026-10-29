const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, '.out');
const base = process.argv[2] || 'http://localhost:3000'; const hash = process.argv[3] === 'hash';
const url = (pg) => (hash ? `${base}/index.html#${pg}` : `${base}/${pg}`);
const out = (k, v) => console.log((v ? 'PASS ' : 'FAIL ') + k);
// A stand-in for Claude's db capability: in-memory collections with live snapshots.
const mock = () => {
  const store = (window.__db = { leads: new Map(), dials: new Map() });
  const subs = { leads: [], dials: [] };
  const snap = (c) => ({ empty: store[c].size === 0, docs: [...store[c]].map(([id, d]) => ({ id, data: () => d })) });
  const fire = (c) => setTimeout(() => subs[c].forEach((f) => f(snap(c))), 5);
  window.__remote = (c, id, d) => { d ? store[c].set(id, d) : store[c].delete(id); fire(c); };
  const db = { collection: (c) => ({
    doc: (id) => ({ set: async (d) => { store[c].set(id, JSON.parse(JSON.stringify(d))); fire(c); }, delete: async () => { store[c].delete(id); fire(c); } }),
    onSnapshot: (next) => { subs[c].push(next); setTimeout(() => next(snap(c)), 5); return () => {}; },
  }) };
  window.claude = { use: async (n) => (n === 'db' ? db : null) };
};
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.addInitScript(mock);
await p.goto(url('agency'), { waitUntil: 'networkidle' });
const leads = require(path.join(OUT, 'agents.cjs')).agents().slice(0, 3);
// A lead added in this browser before the database existed
await p.evaluate((ls) => { const s = JSON.parse(localStorage.getItem('zephyrus:v1')); s.leads = ls; s.calls = []; localStorage.setItem('zephyrus:v1', JSON.stringify(s)); }, leads);
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
let n = await p.evaluate(() => window.__db.leads.size);
out('first run uploads this browser\'s leads to the empty database (' + n + ')', n === 3);
out('status shows Saved to Claude', (await p.locator('text=Saved to Claude').count()) === 1);
const doc = await p.evaluate(() => window.__db.leads.get('cara-ridge') ?? [...window.__db.leads.values()][0]);
out('documents keep the tracker\'s shape (status to_call, area, notes)', doc.status === 'to_call' && 'area' in doc && 'notes' in doc);
const id = leads[0].id;
await p.locator(`li[id="lead-${id}"] > button`).click();
await p.locator(`li[id="lead-${id}"] button:has-text("Call back")`).click(); await p.waitForTimeout(300);
const after = await p.evaluate((id) => ({ lead: window.__db.leads.get(id), days: [...window.__db.dials.keys()], items: [...window.__db.dials.values()][0]?.items }), id);
out('logging writes the lead (status callback + followUp + log)', after.lead.status === 'callback' && !!after.lead.followUp && after.lead.log.length === 1);
out('and one dial into today\'s day document', after.days.length === 1 && after.items.length === 1 && after.items[0].leadId === id);
// Another device adds a lead in the tracker's format
await p.evaluate(() => window.__remote('leads', 'new-agent', { business: 'New Agent From Research', phone: '(416) 555-0199', score: 'Hot', status: 'to_call', area: 'Etobicoke', followUp: '', notes: '', log: [] }));
await p.waitForTimeout(300);
out('a lead written elsewhere appears live', (await p.locator('li[id="lead-new-agent"]').count()) === 1);
const local = await p.evaluate(() => JSON.parse(localStorage.getItem('zephyrus:v1')).leads.length);
out('and is cached in this browser too (' + local + ')', local === 4);
await p.evaluate(() => window.__remote('leads', 'new-agent', null)); await p.waitForTimeout(300);
out('a lead deleted elsewhere disappears', (await p.locator('li[id="lead-new-agent"]').count()) === 0);
// Undo removes the dial from the day document
await p.locator(`li[id="lead-${id}"] button:has-text("No answer")`).click(); await p.waitForTimeout(200);
await p.locator('[data-sonner-toast] button:has-text("Undo")').first().click(); await p.waitForTimeout(300);
const items = await p.evaluate(() => [...window.__db.dials.values()][0].items.length);
out('undo removes the dial from the database (' + items + ' left)', items === 1);
console.log(errs.length ? errs.slice(0,5).join('\n') : 'no errors'); await b.close(); })();
