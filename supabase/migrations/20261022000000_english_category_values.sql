-- Valores do enum de categorias em inglês, como o resto do schema.
-- Os rótulos exibidos continuam em português (CATEGORY_LABELS em src/lib/format.ts).
-- RENAME VALUE só troca o rótulo do enum: as linhas existentes acompanham sem reescrita.

alter type public.category rename value 'moradia' to 'housing';
alter type public.category rename value 'consumo' to 'utilities';
alter type public.category rename value 'assinaturas' to 'subscriptions';
alter type public.category rename value 'alimentacao' to 'food';
alter type public.category rename value 'casa' to 'home';
alter type public.category rename value 'saude' to 'health';
alter type public.category rename value 'educacao' to 'education';
alter type public.category rename value 'transporte' to 'transportation';
alter type public.category rename value 'lazer' to 'leisure';
alter type public.category rename value 'compras' to 'shopping';
alter type public.category rename value 'viagem' to 'travel';
alter type public.category rename value 'impostos' to 'taxes';
alter type public.category rename value 'seguros' to 'insurance';
alter type public.category rename value 'outros' to 'other';
