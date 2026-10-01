-- Desfaz 20261001120000_saude_das_cargas: só leitura, nada de dado a desfazer.
begin;
drop function if exists public.get_saude_das_cargas();
drop index if exists public."IN_SYNCANALISE_ORIGEM";
commit;
