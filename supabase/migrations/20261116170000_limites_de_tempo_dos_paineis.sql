/*
  LIMITES DE TEMPO DAS RPCs QUE RECALCULAM OS PAINÉIS (16/11/2026)

  POR QUE
  ler_relatorio_do_painel (quando ainda não há cálculo), sincronizar_relatorio_do_painel e
  salvar_fonte_da_coluna recalculam um relatório dentro do pedido (medição de 16/11: ~3 s).
  No minuto 17 de cada hora, o cron agsus_paineis_recalcular_relatorios recalcula tudo numa
  transação (~6 s) e segura o lock de cada área e relatório até o fim. O papel authenticated tem
  statement_timeout de 8 s e lock_timeout de 3 s: quem sincroniza ou troca uma fonte nessa hora
  pode cair no limite de espera, e a troca de fonte seria desfeita.

  O QUE MUDA
    As três RPCs ganham statement_timeout = 30s e lock_timeout = 15s próprios (como outras RPCs
    pesadas do projeto). O corpo não muda.

  GUARDA: as três existem (20261116160000) e ainda não têm statement_timeout próprio.
  DESFAZER: supabase/rollback/20261116170000_limites_de_tempo_dos_paineis.sql.
  ENSAIO:   supabase/ensaios/20261116170000_limites_de_tempo_dos_paineis.sql.
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

commit;
