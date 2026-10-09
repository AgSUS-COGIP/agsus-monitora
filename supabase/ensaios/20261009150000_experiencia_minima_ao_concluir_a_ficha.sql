/*
  ENSAIO de 20261009150000_experiencia_minima_ao_concluir_a_ficha.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Aplica a migration dentro
  da transação e confere com a ficha TREINO-P02 do treinamento 992/2099
  (dados fictícios; cada falha para com "FALHOU En"; o resultado é a última
  consulta):
    E1  o lançamento e o resultado gravados na conclusão (Experiência
        Conforme, nenhum vínculo, experiencia.meses = 0) dão a pendência da
        experiência mínima;
    E2  com o vínculo de 32 meses (o que a tela tinha na versão 33) não há
        pendência;
    E3  Experiência Não conforme com motivo, abaixo do mínimo, não pede nada
        (conclui Inapto como antes);
    E4  nenhuma ficha concluída muda (a função só é chamada ao concluir).
*/
begin;

set local lock_timeout = '10s';

select set_config('ensaio.concluidas',
  (select md5(string_agg("CO_FICHA_ANALISE"::text || "NU_VERSAO" || coalesce("TP_RESULTADO", ''), ',' order by "CO_FICHA_ANALISE"))
     from public."TB_FICHA_ANALISE" where "TP_SITUACAO" = 'CONCLUIDA'), true);

CREATE OR REPLACE FUNCTION private."FC_PENDENCIAS_FICHA"(p_regra jsonb, p_lanc jsonb, p_res jsonb)
 RETURNS text[]
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_bloco jsonb;
  v_l jsonb;
  v_parcial text;
  v_decl jsonb;
  v_apur jsonb;
  v_tem_opcoes boolean;
  v_itens text;
  v_pend text[] := '{}';
  v_titulo text;
begin
  for v_bloco in select b from jsonb_array_elements(coalesce(p_regra -> 'blocos', '[]'::jsonb)) b loop
    continue when v_bloco ->> 'tipo' = 'REGISTRO' or not private."FC_BLOCO_SE_APLICA"(v_bloco, p_lanc);
    v_l := coalesce(p_lanc #> array['blocos', v_bloco ->> 'codigo'], '{}'::jsonb);
    v_titulo := coalesce(v_bloco ->> 'titulo', v_bloco ->> 'codigo');
    if coalesce(v_l ->> 'situacao', '') = '' then
      v_pend := v_pend || (v_titulo || ': marque a situação');
    end if;
    if v_l ->> 'situacao' in ('NAO_CONFORME', 'NAO_ENVIADO')
       and jsonb_array_length(coalesce(v_l -> 'motivos', '[]'::jsonb)) = 0
       and not (jsonb_array_length(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) = 0 and length(btrim(coalesce(v_l ->> 'motivo_livre', ''))) >= 10) then
      v_pend := v_pend || (v_titulo || ': escolha o motivo');
    end if;
    v_itens := case v_bloco ->> 'tipo' when 'TITULOS' then 'titulos' when 'CURSOS' then 'cursos' when 'VINCULOS' then 'vinculos' end;
    if v_itens is not null and exists (
         select 1 from jsonb_array_elements(coalesce(p_lanc -> v_itens, '[]'::jsonb)) i
          where i -> 'aceito' = 'false'::jsonb and coalesce(i ->> 'motivo', '') = '') then
      v_pend := v_pend || (v_titulo || ': item recusado sem motivo');
    end if;
    if v_itens = 'vinculos' and exists (
         select 1 from jsonb_array_elements(coalesce(p_lanc -> 'vinculos', '[]'::jsonb)) i
          where coalesce(i ->> 'inicio', '') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(i ->> 'fim', '') !~ '^\d{4}-\d{2}-\d{2}$'
             or i ->> 'fim' < i ->> 'inicio') then
      v_pend := v_pend || (v_titulo || ': vínculo com data inválida');
    end if;
    -- Experiência Conforme abaixo do mínimo pelos vínculos aceitos (a conta
    -- que a tela grava em DS_RESULTADO.experiencia) eliminaria em silêncio:
    -- lance os vínculos ou marque Não conforme (pendenciasDaFicha, tipo minimo).
    if v_bloco ->> 'tipo' = 'VINCULOS' and v_l ->> 'situacao' = 'CONFORME'
       and jsonb_typeof(v_bloco -> 'minimo_meses') = 'number' and (v_bloco ->> 'minimo_meses')::numeric > 0
       and coalesce(v_bloco ->> 'efeito_minimo', 'ELIMINA') = 'ELIMINA'
       and coalesce((p_res #>> array['experiencia',
             case when v_bloco -> 'minimo_conta_estagio' = 'true'::jsonb then 'meses_considerados' else 'meses' end])::numeric, 0)
           < (v_bloco ->> 'minimo_meses')::numeric then
      v_pend := v_pend || (v_titulo || ': experiência mínima de ' || (v_bloco ->> 'minimo_meses')
                           || ' meses não comprovada pelos vínculos aceitos');
    end if;
    -- Nota diferente da declarada exige justificativa (fora do inapto por requisito).
    v_parcial := private."FC_PARCIAL_DO_TIPO"(v_bloco ->> 'tipo');
    v_decl := p_res #> array['declarada', coalesce(v_parcial, '')];
    v_apur := p_res #> array['parciais', coalesce(v_parcial, '')];
    if v_parcial is not null and p_res ->> 'resultado' <> 'INAPTO_REQUISITO'
       and jsonb_typeof(v_decl) = 'number' and jsonb_typeof(v_apur) = 'number'
       and abs((v_decl #>> '{}')::numeric - (v_apur #>> '{}')::numeric) > 0.0001 then
      v_tem_opcoes := jsonb_array_length(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) > 0
                      or jsonb_array_length(coalesce(p_regra -> 'observacoes_prontas', '[]'::jsonb)) > 0;
      if jsonb_array_length(coalesce(v_l -> 'justificativas', '[]'::jsonb)) = 0
         and not (v_l ->> 'situacao' in ('NAO_CONFORME', 'NAO_ENVIADO')
                  and (jsonb_array_length(coalesce(v_l -> 'motivos', '[]'::jsonb)) > 0 or length(btrim(coalesce(v_l ->> 'motivo_livre', ''))) >= 10))
         and not (not v_tem_opcoes and length(btrim(coalesce(v_l ->> 'justificativa_livre', ''))) >= 10) then
        v_pend := v_pend || (v_titulo || ': nota diferente da declarada sem justificativa');
      end if;
    end if;
  end loop;
  return v_pend;
end;
$function$
;

comment on function private."FC_PENDENCIAS_FICHA"(jsonb, jsonb, jsonb) is
  'O que falta para concluir (pendenciasDaFicha de ficha.js): situação de cada bloco que se aplica, motivo do Não conforme/Não enviado, motivo do item recusado, datas dos vínculos, experiência Conforme abaixo do mínimo da regra pelos vínculos aceitos e justificativa de toda nota diferente da declarada (fora do inapto por requisito). Vazio = pode concluir.';
;

do $$
declare
  v_ficha constant uuid := 'a4ffcb6a-108b-4ee9-a235-7d2187b2ef75';
  v_regra jsonb;
  v_lanc jsonb;
  v_res jsonb;
  v_pend text[];
begin
  select h."DS_CONFIGURACAO", f."DS_LANCAMENTO", f."DS_RESULTADO" into v_regra, v_lanc, v_res
    from public."TB_FICHA_ANALISE" f
    join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = f."CO_REGRA_ANALISE" and h."NU_VERSAO" = f."NU_VERSAO_REGRA"
   where f."CO_FICHA_ANALISE" = v_ficha;
  if v_regra is null then raise exception 'FALHOU E0: ficha TREINO-P02 não encontrada'; end if;

  -- E1
  v_pend := private."FC_PENDENCIAS_FICHA"(v_regra, v_lanc, v_res);
  if cardinality(v_pend) <> 1 or v_pend[1] not like '%experiência mínima de 6 meses não comprovada%' then
    raise exception 'FALHOU E1: %', v_pend;
  end if;

  -- E2
  v_pend := private."FC_PENDENCIAS_FICHA"(v_regra,
    jsonb_set(v_lanc, '{vinculos}', '[{"empregador":"Ensaio","categoria":"AREA_OU_SUS","inicio":"2024-02-08","fim":"2026-10-01","aceito":true}]'),
    jsonb_set(jsonb_set(jsonb_set(v_res, '{experiencia,meses}', '32'), '{experiencia,meses_considerados}', '32'),
              '{resultado}', '"APTO"'));
  if cardinality(v_pend) <> 0 then raise exception 'FALHOU E2: %', v_pend; end if;

  -- E3
  v_pend := private."FC_PENDENCIAS_FICHA"(v_regra,
    jsonb_set(v_lanc, '{blocos,EXPERIENCIA}', '{"situacao":"NAO_CONFORME","motivos":["ESTAGIO_OU_SIMILAR"],"nota_ajustada":0}'),
    v_res);
  if cardinality(v_pend) <> 0 then raise exception 'FALHOU E3: %', v_pend; end if;

  -- E4
  if (select md5(string_agg("CO_FICHA_ANALISE"::text || "NU_VERSAO" || coalesce("TP_RESULTADO", ''), ',' order by "CO_FICHA_ANALISE"))
        from public."TB_FICHA_ANALISE" where "TP_SITUACAO" = 'CONCLUIDA') is distinct from current_setting('ensaio.concluidas') then
    raise exception 'FALHOU E4: fichas concluídas mudaram';
  end if;
end;
$$;

select 'ENSAIO OK' as resultado;

rollback;
