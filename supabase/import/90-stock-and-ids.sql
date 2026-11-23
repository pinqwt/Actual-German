-- Out-of-stock rows (everything else has no stock row = available) and the id sequence.
-- (none out of stock)

select setval(pg_get_serial_sequence('public.expert_products', 'id'), (select max(id) from public.expert_products));
