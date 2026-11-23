// One-off: crawl the Magento staging catalog into scripts/data/magento-products.json.
// Read-only against the Magento site; writes only that JSON file. Plain Node, no deps.
// Usage: node scripts/scrape-magento.js [--limit-pages N]
const fs = require('fs');
const path = require('path');

const BASE = 'https://magento-1523963-5866672.cloudwaysapps.com';
const CATS = ['air-conditioning', 'belts', 'brake-system', 'axle-suspension', 'engine-parts',
  'transmission-parts', 'steering-system', 'fuel-system', 'engine-cooling',
  'electrical-system', 'fluids', 'bulbs'];
const PER = 36;
const maxPages = (() => { const i = process.argv.indexOf('--limit-pages'); return i > 0 ? +process.argv[i + 1] : Infinity; })();

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 catalog-migration' } });
      if (r.ok) return await r.text();
    } catch (e) { /* retry */ }
    await sleep(800 * (t + 1));
  }
  return '';
}
const dec = s => s.replace(/&#x20;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#039;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

function parseList(html, cat) {
  const out = [];
  const parts = html.split('<li class="item product product-item"').slice(1);
  for (const p of parts) {
    const link = /product-item-link"\s+href="([^"]+)"[^>]*>\s*([^<]+)</.exec(p);
    if (!link) continue;
    const img = /product-image-photo"\s+src="([^"]+)"/.exec(p);
    const price = /data-price-amount="([\d.]+)"/.exec(p);
    out.push({
      url: link[1], name: dec(link[2]), cat,
      img: img && !/placeholder/.test(img[1]) ? img[1].replace(/\/cache\/[0-9a-f]+\//, '/') : null,
      price: price ? +price[1] : 0,
    });
  }
  return out;
}

(async () => {
  const seen = new Map();
  for (const cat of CATS) {
    let page = 1, total = null;
    for (;;) {
      const html = await get(`${BASE}/${cat}.html?product_list_limit=${PER}&p=${page}`);
      if (total === null) {
        const nums = [...html.matchAll(/toolbar-number">(\d+)</g)].map(x => +x[1]);
        total = nums.length ? Math.max(...nums) : 0; // largest toolbar-number = total count
      }
      const rows = parseList(html, cat);
      let added = 0;
      for (const r of rows) if (!seen.has(r.url)) { seen.set(r.url, r); added++; }
      console.log(`${cat} p${page}: ${rows.length} rows, ${added} new, total ${seen.size} (cat says ${total})`);
      if (!rows.length || !added || page * PER >= total || page >= maxPages) break;
      page++;
      await sleep(150);
    }
  }
  const out = path.join(__dirname, 'data', 'magento-products.json');
  fs.writeFileSync(out, JSON.stringify([...seen.values()], null, 1));
  console.log('wrote', out, seen.size);
})();
