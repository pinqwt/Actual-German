// One-off: turn scripts/data/magento-products.json into SQL files the OWNER runs in the Supabase SQL
// editor (Claude must not write to the live DB). Writes supabase/import/*.sql. Never connects anywhere.
//   node scripts/magento-to-sql.js
// Files are numbered; run them in order. 01 wipes the old catalog, 02-NN insert products, 90+ set the
// per-product settings (part numbers, brands, fitment) and reset the leftovers keyed by old product ids.
const fs = require('fs');
const path = require('path');

const rows = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'magento-products.json'), 'utf8'));
const OUT = path.join(__dirname, '..', 'supabase', 'import');
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (/\.sql$/.test(f)) fs.rmSync(path.join(OUT, f));

const START_ID = 1001;
const CAT = {
  'air-conditioning': 'cooling', belts: 'engine', 'brake-system': 'brakes', 'axle-suspension': 'suspension',
  'engine-parts': 'engine', 'transmission-parts': 'transmission', 'steering-system': 'suspension',
  'fuel-system': 'engine', 'engine-cooling': 'cooling', 'electrical-system': 'electrical',
  fluids: 'oils-fluids', bulbs: 'body-lights',
};
// Vehicle makes that appear as the product's brand / first words of its name (OEM parts) -> fitment slug.
const MAKES = [
  [/^mercedes/i, 'mercedes'], [/^bmw/i, 'bmw'], [/^audi/i, 'audi'], [/^(vw|volkswagen)/i, 'volkswagen'],
  [/^porsche/i, 'porsche'], [/^mini\b/i, 'mini'], [/^land rover|^range rover/i, 'landrover'],
  [/^jaguar/i, 'jaguar'], [/^bentley/i, 'bentley'], [/^rolls/i, 'rollsroyce'], [/^(skoda|škoda)/i, 'skoda'],
];
const q = s => s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'";
const jsonLit = o => "'" + JSON.stringify(o).replace(/'/g, "''") + "'";

const products = rows.filter(r => r.name && r.done).map((r, i) => {
  const id = START_ID + i;
  let cat = CAT[r.cat] || 'accessories';
  if (/\bfilter\b/i.test(r.name)) cat = 'filters';
  let make = null;
  for (const [re, slug] of MAKES) if (re.test(r.brand || '') || re.test(r.name)) { make = slug; break; }
  const desc = [r.oe ? 'OE part number: ' + r.oe : null, r.brand ? 'Brand: ' + r.brand : null, r.cond ? 'Condition: ' + r.cond : null, r.specs]
    .filter(Boolean).join('. ');
  return { id, name: r.name, cat, price: Math.round((r.price || 0) * 100) / 100, img: r.img, desc, part: r.oe || r.sku, brand: r.brand, make, out: r.stock === 'out-of-stock' };
});

let files = 0;
function write(name, text) { fs.writeFileSync(path.join(OUT, name), text); files++; }

const BATCH = 400;
for (let b = 0; b * BATCH < products.length; b++) {
  const chunk = products.slice(b * BATCH, (b + 1) * BATCH);
  let sql = '-- Magento import: products ' + chunk[0].id + '-' + chunk[chunk.length - 1].id + '\n';
  if (b === 0) {
    sql += `-- WIPES the whole old catalog first. Run files in order; stop if any errors.
begin;
delete from public.expert_stock;
delete from public.expert_photos;
delete from public.expert_hidden;
delete from public.expert_products;
commit;

`;
  }
  sql += 'insert into public.expert_products (id, name, category, subcategory, price, img_url, hidden, description) overriding system value values\n';
  sql += chunk.map(p => `(${p.id}, ${q(p.name)}, ${q(p.cat)}, null, ${p.price}, ${q(p.img)}, false, ${q(p.desc)})`).join(',\n') + ';\n';
  write(`${String(b + 1).padStart(2, '0')}-products-${b + 1}.sql`, sql);
}

const outOfStock = products.filter(p => p.out);
const sku = {}, brand = {}, fit = {};
for (const p of products) {
  if (p.part) sku[p.id] = p.part;
  if (p.brand) brand[p.id] = p.brand;
  if (p.make) fit[p.id] = [p.make];
}
const upsert = (key, val) => `insert into public.expert_settings (key, value) values ('${key}', ${jsonLit(val)})\non conflict (key) do update set value = excluded.value;\n`;

write('90-stock-and-ids.sql', `-- Out-of-stock rows (everything else has no stock row = available) and the id sequence.
${outOfStock.length ? 'insert into public.expert_stock (product_id, status, qty) values\n' + outOfStock.map(p => `(${p.id}, 'out-of-stock', 0)`).join(',\n') + ';\n' : '-- (none out of stock)\n'}
select setval(pg_get_serial_sequence('public.expert_products', 'id'), (select max(id) from public.expert_products));
`);
write('91-sku-map.sql', '-- Part numbers shown as "Part No: ..."\n' + upsert('sku_map', sku));
write('92-brand-map.sql', '-- Brand per product\n' + upsert('brand_map', brand));
write('93-fitment-map.sql', '-- Car make each OEM product fits\n' + upsert('fitment_map', fit));
write('94-reset-old-id-settings.sql', `-- These settings were keyed by the OLD product ids, which no longer exist.
${['product_keywords', 'product_variants', 'qty_limits', 'hidden_prices', 'multi_cats'].map(k => upsert(k, {})).join('')}${upsert('featured_offers', [])}`);

console.log('products', products.length, '| files', files, '| with photo', products.filter(p => p.img).length,
  '| priced', products.filter(p => p.price > 0).length, '| fitment', Object.keys(fit).length, '| out of stock', outOfStock.length);
const bycat = {}; products.forEach(p => bycat[p.cat] = (bycat[p.cat] || 0) + 1); console.log(bycat);
