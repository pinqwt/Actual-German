// One-off, stage 2: read each product page listed in scripts/data/magento-products.json and add
// price (AED), sku, oe (OE part number), brand, img (original photo URL or null), stock.
// Read-only against the Magento site; rewrites scripts/data/magento-products.json in place.
// Resumable: rows that already have `done: true` are skipped.  Usage: node scripts/scrape-magento-details.js
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'data', 'magento-products.json');
const rows = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const CONC = 6;

const dec = s => s.replace(/&#x20;/g, ' ').replace(/&#x09;/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#039;|&#x27;/g, "'").replace(/&#x28;/g, '(').replace(/&#x29;/g, ')').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 catalog-migration' } });
      if (r.ok) return await r.text();
    } catch (e) { /* retry */ }
    await sleep(700 * (t + 1));
  }
  return '';
}

function parse(html, row) {
  if (!html) return false;
  const price = /price:amount" content="([\d.]+)"/.exec(html);
  row.price = price ? +price[1] : 0;
  const attrs = {};
  for (const m of html.matchAll(/<th class="col label" scope="row">([^<]*)<\/th><td class="col data"[^>]*>([^<]*)<\/td>/g)) attrs[dec(m[1])] = dec(m[2]);
  row.sku = attrs['SKU'] || null;
  row.oe = attrs['OE Part Number'] || null;
  row.brand = attrs['Brand'] || null;
  row.cond = attrs['Condition'] || null;
  const spec = Object.entries(attrs).filter(([k]) => !/^(SKU|OE Part Number|Brand|Vendor code|Condition|Listing Sells)$/.test(k));
  row.specs = spec.length ? spec.map(([k, v]) => k + ': ' + v).join('; ') : null;
  const full = /"full":"([^"]+)"/.exec(html);
  row.img = full && !/placeholder/.test(full[1])
    ? full[1].replace(/\\\//g, '/').replace(/\/cache\/[0-9a-f]+\//, '/') : null;
  row.stock = /Out of stock/i.test(html) && !/In stock/i.test(html) ? 'out-of-stock' : 'in-stock';
  row.done = true;
  return true;
}

(async () => {
  const todo = rows.filter(r => !r.done);
  console.log('to fetch', todo.length, 'of', rows.length);
  let i = 0, ok = 0, fail = 0;
  async function worker() {
    while (i < todo.length) {
      const row = todo[i++];
      if (parse(await get(row.url), row)) ok++; else fail++;
      if ((ok + fail) % 200 === 0) {
        console.log(ok + fail, 'done,', fail, 'failed');
        fs.writeFileSync(FILE, JSON.stringify(rows, null, 1));
      }
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 1));
  console.log('finished', ok, 'ok', fail, 'failed; with img', rows.filter(r => r.img).length, 'priced', rows.filter(r => r.price > 0).length);
})();
