-- End new quotes while keeping issued quotes and subscriber invoices payable.
update public.product_config
set sale_ends_at = now()
where product = 'monthly';
