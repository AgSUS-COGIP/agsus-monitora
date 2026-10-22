-- ROLLBACK de supabase/migrations/20261013140000_quadro_da_vaga_pelo_titulo.sql
-- Volta FC_QUADRO_DA_VAGA_EMPREGARE ao caminho só da planilha (nome_vaga da
-- análise) e apaga as funções do título. As vagas já gravadas mantêm o cargo e
-- a lotação até a próxima execução do job (que volta a gravar nulo no 114).
-- private."FC_TEXTO_DO_CARGO" fica: é da migration 20261013130000.
begin;

set local lock_timeout = '10s';

create or replace function private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital uuid, p_vaga text)
returns public."TB_QUADRO_VAGA_EDITAL"
language sql
stable
set search_path = ''
as $$
  select q.*
    from private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga) v
    join public."TB_QUADRO_VAGA_EDITAL" q
      on q."CO_QUADRO_VAGA" = v.quadro_id and q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'
   where v.edital_id = p_edital
   limit 1;
$$;

drop function if exists private."FC_QUADRO_PELO_TITULO_EMPREGARE"(uuid, text);
drop function if exists private."FC_UF_DA_LOTACAO"(text);
drop function if exists private."FC_NUMERO_DO_CARGO"(text);
drop function if exists private."FC_TITULO_DA_VAGA_EMPREGARE"(text);

commit;
