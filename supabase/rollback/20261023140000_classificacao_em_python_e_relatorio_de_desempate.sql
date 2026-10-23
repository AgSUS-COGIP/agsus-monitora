-- ROLLBACK de supabase/migrations/20261023140000_classificacao_em_python_e_relatorio_de_desempate.sql
-- Tira as RPCs, a tabela do relatório de desempate (e os relatórios gravados) e a collation.
-- Nada mais muda: a tela e as listas geradas não dependem destes objetos.
begin;

drop function if exists public.obter_desempate_da_lista(uuid);
drop function if exists public.classificacao_gravar_desempate(text, uuid, text, jsonb, text);
drop function if exists public.classificacao_ler_edital(uuid);
drop table if exists public."TB_RELATORIO_DESEMPATE";
drop collation if exists private."CL_NOME_PT_BR_BASE";

commit;
