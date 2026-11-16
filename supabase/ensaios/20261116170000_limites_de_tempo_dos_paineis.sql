/*
  ENSAIO de 20261116170000_limites_de_tempo_dos_paineis.sql

  Roda no banco ANTES de aplicar e termina em rollback: nada fica gravado. Aplica os limites e
  confere que as três RPCs ficaram com statement_timeout=30s e lock_timeout=15s, mantendo o
  search_path vazio.
  Ok = NOTICE "Ensaio 20261116170000 ok", e ROLLBACK.
*/
begin;

do $$
begin
  if to_regprocedure('public.ler_relatorio_do_painel(text, text, integer, integer)') is null then
    raise exception 'Aplique antes 20261116160000_relatorios_dos_paineis_prontos.sql.';
  end if;
  if exists (select 1 from pg_proc p, unnest(p.proconfig) c
              where p.oid = to_regprocedure('public.sincronizar_relatorio_do_painel(text, text)')
                and c like 'statement_timeout=%') then
    raise exception 'sincronizar_relatorio_do_painel já tem statement_timeout: esta migration já foi aplicada?';
  end if;
end;
$$;

alter function public.ler_relatorio_do_painel(text, text, integer, integer)
  set statement_timeout = '30s';
alter function public.ler_relatorio_do_painel(text, text, integer, integer)
  set lock_timeout = '15s';
alter function public.sincronizar_relatorio_do_painel(text, text)
  set statement_timeout = '30s';
alter function public.sincronizar_relatorio_do_painel(text, text)
  set lock_timeout = '15s';
alter function public.salvar_fonte_da_coluna(text, text, text, text, text, text)
  set statement_timeout = '30s';
alter function public.salvar_fonte_da_coluna(text, text, text, text, text, text)
  set lock_timeout = '15s';

do $confere$
begin
  if (select count(*) from pg_proc p
       where p.oid in (to_regprocedure('public.ler_relatorio_do_painel(text, text, integer, integer)'),
                       to_regprocedure('public.sincronizar_relatorio_do_painel(text, text)'),
                       to_regprocedure('public.salvar_fonte_da_coluna(text, text, text, text, text, text)'))
         and p.proconfig @> array['statement_timeout=30s', 'lock_timeout=15s', 'search_path=""']) <> 3 then
    raise exception 'Os limites não ficaram nas três RPCs.';
  end if;
end;
$confere$;

do $ok$ begin raise notice 'Ensaio 20261116170000 ok'; end; $ok$;

rollback;
