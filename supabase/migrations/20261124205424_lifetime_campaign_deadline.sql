-- Midnight after the last sale day, in Asia/Karachi.
update public.product_config
set sale_ends_at = timestamptz '2026-12-17 00:00:00+05'
where product = 'lifetime';
