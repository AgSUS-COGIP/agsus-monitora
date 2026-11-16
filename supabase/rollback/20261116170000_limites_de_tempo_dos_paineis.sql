/*
  DESFAZ 20261116170000_limites_de_tempo_dos_paineis.sql: as três RPCs voltam a usar os limites
  do papel (statement_timeout e lock_timeout); o resto da configuração (search_path) fica.
*/
begin;

do $$
begin
  if not exists (select 1 from pg_proc p, unnest(p.proconfig) c
                  where p.oid = to_regprocedure('public.sincronizar_relatorio_do_painel(text, text)')
                    and c = 'statement_timeout=30s') then
    raise exception 'A 20261116170000 não está aplicada (sincronizar_relatorio_do_painel sem statement_timeout=30s).';
  end if;
end;
$$;

alter function public.ler_relatorio_do_painel(text, text, integer, integer) reset statement_timeout;
alter function public.ler_relatorio_do_painel(text, text, integer, integer) reset lock_timeout;
alter function public.sincronizar_relatorio_do_painel(text, text) reset statement_timeout;
alter function public.sincronizar_relatorio_do_painel(text, text) reset lock_timeout;
alter function public.salvar_fonte_da_coluna(text, text, text, text, text, text) reset statement_timeout;
alter function public.salvar_fonte_da_coluna(text, text, text, text, text, text) reset lock_timeout;

commit;
