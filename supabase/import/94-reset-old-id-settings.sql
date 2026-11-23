-- These settings were keyed by the OLD product ids, which no longer exist.
insert into public.expert_settings (key, value) values ('product_keywords', '{}')
on conflict (key) do update set value = excluded.value;
insert into public.expert_settings (key, value) values ('product_variants', '{}')
on conflict (key) do update set value = excluded.value;
insert into public.expert_settings (key, value) values ('qty_limits', '{}')
on conflict (key) do update set value = excluded.value;
insert into public.expert_settings (key, value) values ('hidden_prices', '{}')
on conflict (key) do update set value = excluded.value;
insert into public.expert_settings (key, value) values ('multi_cats', '{}')
on conflict (key) do update set value = excluded.value;
insert into public.expert_settings (key, value) values ('featured_offers', '[]')
on conflict (key) do update set value = excluded.value;
