-- Desfaz 20261110150000 (edital crítico marcado à mão).
-- Tira as três RPCs e as duas funções privadas. As tabelas só saem vazias:
-- com marcação ou histórico gravados, ficam (dado não se desfaz) e o
-- rollback avisa. Nenhuma função existente foi trocada pela migration.
-- ATENÇÃO: com a tela nova publicada, a marcação some e a Visão geral volta a
-- contar só os motivos automáticos; voltar o front antes, ou junto.
begin;
set local lock_timeout = '3s';
do $guarda$
begin
  if to_regprocedure('public.marcar_edital_critico(uuid, boolean, text)') is null then
    raise exception 'Migration 20261110150000 nao aplicada: nada a desfazer';
  end if;
end $guarda$;

drop function if exists public.marcar_edital_critico(uuid, boolean, text);
drop function if exists public.obter_critico_do_edital(uuid);
drop function if exists public.listar_editais_criticos_manuais(text);
drop function if exists private."FC_PODE_MARCAR_CRITICO"(uuid);
drop function if exists private."FC_NOME_DO_USUARIO"(uuid);

do $tabelas$
begin
  if exists (select 1 from public."TB_EDITAL_CRITICO") or exists (select 1 from public."TH_EDITAL_CRITICO") then
    raise notice 'TB_EDITAL_CRITICO/TH_EDITAL_CRITICO têm dados: ficam no banco (dado não se desfaz).';
  else
    drop table public."TH_EDITAL_CRITICO";
    drop table public."TB_EDITAL_CRITICO";
  end if;
end $tabelas$;

notify pgrst, 'reload schema';
commit;
