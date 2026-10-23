/*
  Rollback de 20261023090000_calculo_conferido_no_banco.sql: devolve as funções como estavam
  (definições vivas de 22/10/2026: FC_VALIDAR_RESULTADO_FICHA, FC_PENDENCIAS_FICHA, FC_LINHAS_DA_FILA, FC_REGRA_VIGENTE_FICHA, conferencia_ler_fichas, listar_anexos_para_leitura, pre_classificacao_ler_editais, FC_VALIDAR_LANCAMENTO_FICHA),
  tira a ação CORRIGIR do histórico e apaga as funções novas. Rode ANTES o rollback de 20261023091000
  (ele usa FC_ANOS_MESES_DIAS).

  As fichas que o job de conferências mandou para revisão continuam em REVISAR (o histórico
  guarda cada uma, com TP_ORIGEM JOB e "Conferência automática: …").
*/
begin;

-- Sem a ação CORRIGIR (falha se já houver correção registrada: o histórico não se apaga).
alter table public."TH_FICHA_ANALISE" drop constraint if exists "CK_THFICHA_TPACAO";
alter table public."TH_FICHA_ANALISE" add constraint "CK_THFICHA_TPACAO" check ("TP_ACAO"::text = any (array[
  'CRIAR', 'PEGAR', 'RESERVAR', 'LIBERAR', 'LIBERAR_RESERVA', 'DISTRIBUIR', 'REDISTRIBUIR', 'DEVOLVER_FILA', 'REVISAR',
  'SAIR_LOTE', 'VOLTAR_LOTE', 'SALVAR', 'CONCLUIR', 'REABRIR', 'REINICIAR', 'REFAZER_LOTE', 'MODALIDADE']));

CREATE OR REPLACE FUNCTION private."FC_VALIDAR_RESULTADO_FICHA"(p_regra jsonb, p_lanc jsonb, p_res jsonb, p_documental jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_resultado text := p_res ->> 'resultado';
  v_nivel text := p_lanc ->> 'nivel';
  v_apurada numeric;
  v_final numeric;
  v_soma numeric := 0;
  v_minima numeric;
  v_item record;
  v_bloco jsonb;
  v_lancado jsonb;
  v_teto numeric;
  v_elimina boolean := false;
  v_informativa jsonb := p_res -> 'pontos_informativos';
  v_mostra boolean := coalesce((p_regra #> '{parecer,mostrar_pontos_quando_inapto}') = 'true'::jsonb, false);
begin
  if jsonb_typeof(p_res) is distinct from 'object' or length(p_res::text) > 100000 then
    raise exception 'Resultado da ficha inválido.' using errcode = '22023';
  end if;
  if v_resultado is null or v_resultado not in ('APTO', 'INAPTO_REQUISITO', 'INAPTO_NOTA') then
    raise exception 'Resultado inválido.' using errcode = '22023';
  end if;
  if not private."FC_JSON_NUMERO_OBRIGATORIO"(p_res -> 'nota_apurada', 0, 1000) or not private."FC_JSON_NUMERO_OBRIGATORIO"(p_res -> 'nota_final', 0, 1000) then
    raise exception 'Notas de 0 a 1.000.' using errcode = '22023';
  end if;
  v_apurada := (p_res ->> 'nota_apurada')::numeric;
  v_final := (p_res ->> 'nota_final')::numeric;
  if jsonb_typeof(coalesce(p_res -> 'parciais', '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_res -> 'eliminatorios', '[]'::jsonb)) <> 'array' then
    raise exception 'Parciais ou motivos inválidos.' using errcode = '22023';
  end if;

  -- Cada parcial é de um bloco da regra, de 0 ao teto; a nota ajustada vale (ou o bloco zerou).
  for v_item in select key, value from jsonb_each(coalesce(p_res -> 'parciais', '{}'::jsonb)) loop
    select b into v_bloco from jsonb_array_elements(coalesce(p_regra -> 'blocos', '[]'::jsonb)) b
     where private."FC_PARCIAL_DO_TIPO"(b ->> 'tipo') = v_item.key limit 1;
    if v_bloco is null then
      raise exception 'A parcial % não é de um bloco da regra.', v_item.key using errcode = '22023';
    end if;
    v_teto := coalesce(private."FC_TETO_DO_BLOCO"(v_bloco, v_nivel), 1000);
    if not private."FC_JSON_NUMERO_OBRIGATORIO"(v_item.value, 0, v_teto) then
      raise exception 'A parcial % passa do teto de % pontos.', v_item.key, v_teto using errcode = '22023';
    end if;
    -- O bloco que não se aplica (condição do candidato ou cargo da vaga) vale 0,
    -- mesmo com o ajuste que ficou de antes (20261014191000; calcularAvaliacao).
    if not private."FC_BLOCO_SE_APLICA"(v_bloco, p_lanc) and (v_item.value #>> '{}')::numeric <> 0 then
      raise exception 'A parcial % é de um bloco que não se aplica a este candidato: vale 0.', v_item.key using errcode = '22023';
    end if;
    v_lancado := p_lanc #> array['blocos', v_bloco ->> 'codigo'];
    if jsonb_typeof(v_lancado -> 'nota_ajustada') = 'number'
       and (v_item.value #>> '{}')::numeric <> 0
       and abs((v_item.value #>> '{}')::numeric - least((v_lancado ->> 'nota_ajustada')::numeric, v_teto)) > 0.0001 then
      raise exception 'A parcial % não é a nota ajustada do bloco.', v_item.key using errcode = '22023';
    end if;
    v_soma := v_soma + (v_item.value #>> '{}')::numeric;
  end loop;
  if abs(v_soma - v_apurada) > 0.001 then
    raise exception 'A nota apurada não é a soma das parciais.' using errcode = '22023';
  end if;
  if abs(v_final - case when v_resultado = 'INAPTO_REQUISITO' then 0 else v_apurada end) > 0.001 then
    raise exception 'A nota final não confere com o resultado.' using errcode = '22023';
  end if;
  if (v_resultado = 'INAPTO_REQUISITO') <> (jsonb_array_length(coalesce(p_res -> 'eliminatorios', '[]'::jsonb)) > 0) then
    raise exception 'Inapto por requisito exige o motivo eliminatório (e só ele).' using errcode = '22023';
  end if;

  -- A pontuação informativa do inapto por requisito (parecer.mostrar_pontos_quando_inapto,
  -- 20261014170000): só com a opção, e é a nota apurada com as parciais; a nota final continua 0.
  if coalesce(jsonb_typeof(v_informativa), 'null') = 'null' then
    if v_mostra and v_resultado = 'INAPTO_REQUISITO' then
      raise exception 'A regra mostra a pontuação dos títulos no inapto por requisito: falta a pontuação informativa.' using errcode = '22023';
    end if;
  else
    if not v_mostra or v_resultado <> 'INAPTO_REQUISITO' then
      raise exception 'Pontuação informativa só no inapto por requisito, com a opção da regra.' using errcode = '22023';
    end if;
    if jsonb_typeof(v_informativa) <> 'object'
       or not private."FC_JSON_NUMERO_OBRIGATORIO"(v_informativa -> 'nota', 0, 1000)
       or abs((v_informativa ->> 'nota')::numeric - v_apurada) > 0.001
       or (v_informativa -> 'parciais') is distinct from coalesce(p_res -> 'parciais', '{}'::jsonb) then
      raise exception 'A pontuação informativa é a nota apurada, com as mesmas parciais.' using errcode = '22023';
    end if;
  end if;

  -- Bloco eliminatório (pela situação, sem motivo mais brando) exige Inapto por requisito.
  for v_bloco in select b from jsonb_array_elements(coalesce(p_regra -> 'blocos', '[]'::jsonb)) b loop
    v_lancado := p_lanc #> array['blocos', v_bloco ->> 'codigo'];
    continue when v_lancado is null or not private."FC_BLOCO_SE_APLICA"(v_bloco, p_lanc)
               or coalesce(v_lancado ->> 'situacao', '') not in ('NAO_CONFORME', 'NAO_ENVIADO');
    if exists (select 1 from jsonb_array_elements_text(coalesce(v_lancado -> 'motivos', '[]'::jsonb)) m
                 join jsonb_array_elements(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) x on x ->> 'codigo' = m
                where coalesce(x ->> 'efeito', '') <> '') then
      v_elimina := v_elimina or exists (
        select 1 from jsonb_array_elements_text(coalesce(v_lancado -> 'motivos', '[]'::jsonb)) m
          join jsonb_array_elements(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) x on x ->> 'codigo' = m
         where x ->> 'efeito' = 'ELIMINA');
    else
      v_elimina := v_elimina or (v_bloco #>> array['efeitos', v_lancado ->> 'situacao']) = 'ELIMINA';
    end if;
  end loop;
  if v_elimina and v_resultado <> 'INAPTO_REQUISITO' then
    raise exception 'Há bloco eliminatório: o resultado é Inapto por requisito.' using errcode = '22023';
  end if;

  -- Nota mínima da regra de classificação (por nível, se houver).
  v_minima := case when jsonb_typeof(p_documental #> array['nota_minima_por_nivel', v_nivel]) = 'number'
                   then (p_documental #>> array['nota_minima_por_nivel', v_nivel])::numeric
                   when jsonb_typeof(p_documental -> 'nota_minima') = 'number' then (p_documental ->> 'nota_minima')::numeric end;
  if v_resultado = 'APTO' and v_minima is not null and v_apurada < v_minima then
    raise exception 'Nota abaixo da mínima (%): o resultado é Inapto por nota.', v_minima using errcode = '22023';
  end if;
  if v_resultado = 'INAPTO_NOTA' and (v_minima is null or v_apurada >= v_minima) then
    raise exception 'Inapto por nota só abaixo da nota mínima.' using errcode = '22023';
  end if;
end;
$function$;

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
  v_outro boolean;
  v_livre boolean;
begin
  for v_bloco in select b from jsonb_array_elements(coalesce(p_regra -> 'blocos', '[]'::jsonb)) b loop
    continue when v_bloco ->> 'tipo' = 'REGISTRO' or not private."FC_BLOCO_SE_APLICA"(v_bloco, p_lanc);
    v_l := coalesce(p_lanc #> array['blocos', v_bloco ->> 'codigo'], '{}'::jsonb);
    v_titulo := coalesce(v_bloco ->> 'titulo', v_bloco ->> 'codigo');
    if coalesce(v_l ->> 'situacao', '') = '' then
      v_pend := v_pend || (v_titulo || ': marque a situação');
    end if;
    -- "Outro motivo (descrever)" (20261015010000): OUTRO em motivos (Não confere,
    -- Não enviou) ou em justificativas (Conforme) pede o texto em motivo_livre, que
    -- vale como o motivo; no bloco sem motivos na regra, o texto é o motivo.
    v_livre := length(btrim(coalesce(v_l ->> 'motivo_livre', ''))) >= 10;
    v_outro := case
      when v_l ->> 'situacao' in ('NAO_CONFORME', 'NAO_ENVIADO') then coalesce(v_l -> 'motivos', '[]'::jsonb) ? 'OUTRO'
      when v_l ->> 'situacao' = 'CONFORME' then coalesce(v_l -> 'justificativas', '[]'::jsonb) ? 'OUTRO'
      else false end;
    if v_outro and not v_livre then
      v_pend := v_pend || (v_titulo || ': descreva o outro motivo (10 caracteres ou mais)');
    elsif v_l ->> 'situacao' in ('NAO_CONFORME', 'NAO_ENVIADO')
       and not exists (select 1 from jsonb_array_elements_text(coalesce(v_l -> 'motivos', '[]'::jsonb)) m where m <> 'OUTRO')
       and not v_outro
       and not (jsonb_array_length(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) = 0 and v_livre) then
      v_pend := v_pend || (v_titulo || ': escolha o motivo');
    end if;
    -- Diferenças por cargo (20261013130000; faltasDoCargo em regra-por-cargo.ts).
    if v_l ->> 'situacao' = 'CONFORME' and jsonb_typeof(v_bloco -> 'requisitos') = 'array'
       and exists (select 1 from jsonb_array_elements(v_bloco -> 'requisitos') q
                    where (v_l #> array['requisitos', q ->> 'codigo']) is distinct from 'true'::jsonb) then
      v_pend := v_pend || (v_titulo || ': confira cada requisito do cargo');
    end if;
    if v_l ->> 'situacao' = 'CONFORME' and jsonb_typeof(v_l -> 'nota_ajustada') is distinct from 'number'
       and jsonb_typeof(v_bloco -> 'extras') = 'array' then
      v_pend := v_pend || coalesce((
        select array_agg(v_titulo || ': confira ' || (e ->> 'rotulo') order by n)
          from jsonb_array_elements(v_bloco -> 'extras') with ordinality x(e, n)
         where jsonb_typeof(v_l #> array['extras', e ->> 'codigo']) is distinct from 'boolean'), '{}'::text[]);
    end if;
    v_itens := case v_bloco ->> 'tipo' when 'TITULOS' then 'titulos' when 'CURSOS' then 'cursos' when 'VINCULOS' then 'vinculos' end;
    if v_itens is not null and exists (
         select 1 from jsonb_array_elements(coalesce(p_lanc -> v_itens, '[]'::jsonb)) i
          where i -> 'aceito' = 'false'::jsonb and coalesce(i ->> 'motivo', '') = '') then
      v_pend := v_pend || (v_titulo || ': item recusado sem motivo');
    end if;
    if v_itens = 'vinculos' and exists (
         select 1 from jsonb_array_elements(coalesce(p_lanc -> 'vinculos', '[]'::jsonb)) i
          where coalesce(i -> 'aceito', 'true'::jsonb) <> 'false'::jsonb -- o recusado não conta: não pede as datas
            and (coalesce(i ->> 'inicio', '') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(i ->> 'fim', '') !~ '^\d{4}-\d{2}-\d{2}$'
                 or i ->> 'fim' < i ->> 'inicio')) then
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
    -- Experiência Não conforme com os vínculos aceitos cumprindo o mínimo
    -- (20261020100000): o mínimo é pelos vínculos aceitos, então não
    -- eliminaria, só zeraria a experiência. Desmarque os vínculos não aceitos
    -- ou marque Confere (pendenciasDaFicha, tipo minimo).
    if v_bloco ->> 'tipo' = 'VINCULOS' and v_l ->> 'situacao' = 'NAO_CONFORME'
       and jsonb_typeof(v_bloco -> 'minimo_meses') = 'number' and (v_bloco ->> 'minimo_meses')::numeric > 0
       and coalesce(v_bloco ->> 'efeito_minimo', 'ELIMINA') = 'ELIMINA'
       and coalesce((p_res #>> array['experiencia',
             case when v_bloco -> 'minimo_conta_estagio' = 'true'::jsonb then 'meses_considerados' else 'meses' end])::numeric, 0)
           >= (v_bloco ->> 'minimo_meses')::numeric then
      v_pend := v_pend || (v_titulo || ': marcada como Não confere, mas os vínculos aceitos somam '
                           || (p_res #>> array['experiencia',
                                case when v_bloco -> 'minimo_conta_estagio' = 'true'::jsonb then 'meses_considerados' else 'meses' end])
                           || ' meses (mínimo ' || (v_bloco ->> 'minimo_meses')
                           || '): desmarque os vínculos não aceitos ou marque Confere');
    end if;
    -- Experiência Conforme com a pontuação acima do que os vínculos aceitos
    -- comprovam (20261020180000): no Confere, a parcial é a declarada
    -- (nota_ajustada) e não a conta dos vínculos (DS_RESULTADO.calculados).
    -- Só vale com Editar nota (edita_nota) e justificativa; abaixo do mínimo,
    -- a falta já é a do mínimo (pendenciasDaFicha, tipo acima).
    -- Fora do inapto por requisito (20261021090000): eliminado por outro critério,
    -- a pontuação é só informativa e não vai à nota nem ao desempate.
    if v_bloco ->> 'tipo' = 'VINCULOS' and v_l ->> 'situacao' = 'CONFORME'
       and coalesce(p_res ->> 'resultado', '') <> 'INAPTO_REQUISITO'
       and jsonb_typeof(p_res #> array['parciais', private."FC_PARCIAL_DO_TIPO"('VINCULOS')]) = 'number'
       and jsonb_typeof(p_res #> array['calculados', private."FC_PARCIAL_DO_TIPO"('VINCULOS')]) = 'number'
       and (p_res #>> array['parciais', private."FC_PARCIAL_DO_TIPO"('VINCULOS')])::numeric
           - (p_res #>> array['calculados', private."FC_PARCIAL_DO_TIPO"('VINCULOS')])::numeric > 0.0001
       and not (jsonb_typeof(v_bloco -> 'minimo_meses') = 'number' and (v_bloco ->> 'minimo_meses')::numeric > 0
                and coalesce(v_bloco ->> 'efeito_minimo', 'ELIMINA') = 'ELIMINA'
                and coalesce((p_res #>> array['experiencia',
                      case when v_bloco -> 'minimo_conta_estagio' = 'true'::jsonb then 'meses_considerados' else 'meses' end])::numeric, 0)
                    < (v_bloco ->> 'minimo_meses')::numeric)
       and not (v_l -> 'edita_nota' = 'true'::jsonb
                and (exists (select 1 from jsonb_array_elements_text(coalesce(v_l -> 'justificativas', '[]'::jsonb)) j where j <> 'OUTRO')
                     or (coalesce(v_l -> 'justificativas', '[]'::jsonb) ? 'OUTRO' and v_livre)
                     or (jsonb_array_length(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) = 0
                         and jsonb_array_length(coalesce(p_regra -> 'observacoes_prontas', '[]'::jsonb)) = 0
                         and length(btrim(coalesce(v_l ->> 'justificativa_livre', ''))) >= 10))) then
      v_pend := v_pend || (v_titulo || ': experiência confirmada com '
                           || (p_res #>> array['parciais', private."FC_PARCIAL_DO_TIPO"('VINCULOS')])
                           || ' pontos, mas os vínculos aceitos comprovam '
                           || coalesce(p_res #>> '{experiencia,meses_considerados}', p_res #>> '{experiencia,meses}', '0')
                           || ' meses (' || (p_res #>> array['calculados', private."FC_PARCIAL_DO_TIPO"('VINCULOS')])
                           || ' pontos): lance os vínculos que comprovam o período declarado ou ajuste a pontuação em Editar nota, com justificativa');
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
      if not exists (select 1 from jsonb_array_elements_text(coalesce(v_l -> 'justificativas', '[]'::jsonb)) j where j <> 'OUTRO')
         and not (coalesce(v_l -> 'justificativas', '[]'::jsonb) ? 'OUTRO' and v_livre)
         and not (v_outro and not v_livre) -- já pediu a descrição: uma falta só
         and not (v_l ->> 'situacao' in ('NAO_CONFORME', 'NAO_ENVIADO')
                  and (jsonb_array_length(coalesce(v_l -> 'motivos', '[]'::jsonb)) > 0 or length(btrim(coalesce(v_l ->> 'motivo_livre', ''))) >= 10))
         and not (not v_tem_opcoes and length(btrim(coalesce(v_l ->> 'justificativa_livre', ''))) >= 10) then
        v_pend := v_pend || (v_titulo || ': nota diferente da declarada sem justificativa');
      end if;
    end if;
  end loop;
  return v_pend;
end;
$function$;

CREATE OR REPLACE FUNCTION private."FC_LINHAS_DA_FILA"(p_edital uuid, p_vagas text[], p_nucleo boolean, p_apos uuid, p_limite integer, p_candidatos uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(id uuid, vaga text, eliminado boolean, posicao integer, codigo text, linha json)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Consulta dinâmica (EXECUTE … USING): planejada a cada chamada com os valores, e não num
  -- plano genérico. Com p_candidatos, o filtro vira condição da chave (PK) e a leitura vai só
  -- nesses inscritos; sem ele, o "p_candidatos is null or …" some e o plano é o do edital todo.
  -- (Num plano genérico, o OR obrigava a varrer o edital; um UNION ALL levou a fila inteira de
  -- 0,15 s a 0,7 s no ensaio.)
  return query execute $sql$
  -- $2 (p_vagas) nulo = todas as vagas; $5 (p_limite) nulo = sem limite (o núcleo vem
  -- inteiro); $6 (p_candidatos) nulo = todos os inscritos do edital.
  select a."CO_EMPREGARE_CANDIDATO",
         a."CO_VAGA"::text,
         a."TP_SITUACAO" = 'ELIMINADO',
         a."NU_POSICAO",
         c."CO_CANDIDATO_EMPREGARE"::text,
         -- Sem as chaves nulas (a tela trata ausente como nulo): o JSON do lote cai pela metade.
         json_strip_nulls(json_build_object(
           'id', a."CO_EMPREGARE_CANDIDATO", 'vaga', a."CO_VAGA", 'codigo', c."CO_CANDIDATO_EMPREGARE",
           'nome', c."NO_CANDIDATO", 'situacao_pre', a."TP_SITUACAO", 'motivo_eliminacao', a."DS_MOTIVO_ELIMINACAO",
           'posicao', a."NU_POSICAO", 'lote', a."NU_LOTE", 'art', a."VL_ART", 'nota', a."VL_NOTA_ORDEM",
           'modalidade', a."NO_MODALIDADE", 'motivo_codigo', a."CO_MOTIVO_ELIMINACAO", 'entrada', a."TP_ENTRADA_LOTE",
           'decisao', case when a."TP_ENTRADA_LOTE" = 'DECISAO' then a."DS_MOTIVO_ENTRADA" end,
           'ficha', case when f."CO_FICHA_ANALISE" is null then null else json_build_object(
             'id', f."CO_FICHA_ANALISE", 'versao', f."NU_VERSAO", 'situacao', f."TP_SITUACAO",
             'responsavel', f."CO_USUARIO_RESPONSAVEL", 'responsavel_nome', coalesce(ur.nome, ur.email),
             'atribuida_em', f."DT_ATRIBUICAO", 'motivo_saida', f."DS_MOTIVO_SAIDA", 'lote', f."NU_LOTE",
             'resultado', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."TP_RESULTADO" end,
             'nota_final', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."VL_NOTA_FINAL" end,
             'concluida_em', case when f."TP_SITUACAO" = 'CONCLUIDA' then f."DT_CONCLUSAO" end,
             'rascunho_em', f."DT_RASCUNHO",
             'reserva', case when f."DT_RESERVA_EXPIRA" > now() then json_build_object(
               'usuario', f."CO_USUARIO_RESERVA", 'nome', coalesce(uv.nome, uv.email),
               'desde', f."DT_RESERVA", 'expira', f."DT_RESERVA_EXPIRA") end) end))
    from public."TB_PRE_CLASSIFICACAO" a
    join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
    left join public."TB_FICHA_ANALISE" f
      on f."CO_MONITORAMENTO" = a."CO_MONITORAMENTO" and f."CO_EMPREGARE_CANDIDATO" = a."CO_EMPREGARE_CANDIDATO"
    left join public."TB_PERFIL_USUARIO" ur on ur.user_id = f."CO_USUARIO_RESPONSAVEL"
    left join public."TB_PERFIL_USUARIO" uv on uv.user_id = f."CO_USUARIO_RESERVA"
   where a."CO_MONITORAMENTO" = $1
     and ($2 is null or a."CO_VAGA" = any ($2))
     and private."FC_NO_NUCLEO_DA_FILA"(a."TP_SITUACAO", f."TP_SITUACAO") = $3
     and ($4 is null or a."CO_EMPREGARE_CANDIDATO" > $4)
     and ($6 is null or a."CO_EMPREGARE_CANDIDATO" = any ($6))
   order by a."CO_EMPREGARE_CANDIDATO"
   limit $5
  $sql$ using p_edital, p_vagas, p_nucleo, p_apos, p_limite, p_candidatos;
end;
$function$;

CREATE OR REPLACE FUNCTION private."FC_REGRA_VIGENTE_FICHA"(p_ficha uuid, OUT p_versao integer, OUT p_situacao text, OUT p_configuracao jsonb)
 RETURNS record
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select h."NU_VERSAO", case when h."NU_VERSAO" = r."NU_VERSAO_VIGENTE" then r."TP_SITUACAO" else 'CONFERIDA' end, h."DS_CONFIGURACAO"
    from public."TB_FICHA_ANALISE" f
    join public."TB_REGRA_ANALISE" r on r."CO_REGRA_ANALISE" = f."CO_REGRA_ANALISE"
    join public."TH_REGRA_ANALISE" h
      on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE"
     and h."NU_VERSAO" = case when f."TP_SITUACAO" = 'CONCLUIDA' then f."NU_VERSAO_REGRA" else r."NU_VERSAO_VIGENTE" end
   where f."CO_FICHA_ANALISE" = p_ficha;
$function$;

CREATE OR REPLACE FUNCTION public.conferencia_ler_fichas(p_apos uuid DEFAULT NULL::uuid, p_limite integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 500), 1), 1000);
  v_linhas jsonb;
  v_regras jsonb;
  v_ultimo uuid;
  v_qt integer;
begin
  with pagina as (
    select f."CO_FICHA_ANALISE" as ficha, f."CO_MONITORAMENTO" as edital, f."CO_EMPREGARE_CANDIDATO" as candidato,
           f."CO_REGRA_ANALISE" as regra, f."NU_VERSAO_REGRA" as versao,
           f."DS_LANCAMENTO" as lancamento, f."DS_RESULTADO" as resultado, f."DS_PARECER" as parecer
      from public."TB_FICHA_ANALISE" f
     where f."TP_SITUACAO" = 'CONCLUIDA'
       and (p_apos is null or f."CO_FICHA_ANALISE" > p_apos)
       and not private."FC_EDITAL_EH_TREINAMENTO"(f."CO_MONITORAMENTO")
     order by f."CO_FICHA_ANALISE"
     limit v_limite
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'ficha', p.ficha,
           'analise', (select a.id from public."TB_ANALISE_CURRICULAR" a
                        where a.chave_natural = 'monitora|' || p.edital || '|' || p.candidato),
           'edital', p.edital, 'area', m."CO_AREA",
           'regra', p.regra, 'versao_regra', p.versao,
           'lancamento', p.lancamento, 'resultado', p.resultado, 'parecer', p.parecer,
           'documental', private."FC_DOCUMENTAL_DO_EDITAL"(p.edital)) order by p.ficha), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('regra', h."CO_REGRA_ANALISE", 'versao', h."NU_VERSAO",
                                                       'configuracao', h."DS_CONFIGURACAO"))
                     from public."TH_REGRA_ANALISE" h
                    where (h."CO_REGRA_ANALISE", h."NU_VERSAO") in (select distinct x.regra, x.versao from pagina x)), '[]'::jsonb),
         max(p.ficha::text)::uuid, count(*)
    into v_linhas, v_regras, v_ultimo, v_qt
    from pagina p
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id = p.edital;

  return jsonb_build_object(
    'schema_version', 1,
    'linhas', v_linhas,
    'regras', v_regras,
    'proximo', case when v_qt = v_limite then v_ultimo end);
end;
$function$;

CREATE OR REPLACE FUNCTION public.listar_anexos_para_leitura(p_editais text[], p_versao text, p_forcar boolean, p_limite integer, p_sal text, p_so_relidos boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pedidos text[] := array(select btrim(x) from unnest(coalesce(p_editais, '{}')) x where btrim(x) <> '');
  v_ids uuid[];
begin
  if cardinality(v_pedidos) > 100 then
    raise exception 'Até 100 editais por execução' using errcode = '22023';
  end if;
  if coalesce(p_versao, '') !~ '^[0-9A-Za-z._-]{1,20}$' then
    raise exception 'Versão do extrator inválida' using errcode = '22023';
  end if;
  if p_limite is null or p_limite not between 1 and 2000 then
    raise exception 'Limite de 1 a 2.000 anexos' using errcode = '22023';
  end if;
  -- O sal é sorteado pelo robô a cada execução: o hash do CPF não serve fora dela.
  if coalesce(p_sal, '') !~ '^[A-Za-z0-9_-]{16,128}$' then
    raise exception 'Sal inválido' using errcode = '22023';
  end if;
  if cardinality(v_pedidos) > 0 then
    -- Cada pedido é o id do edital, o número ("93/2026") ou, sem número, o nome.
    select coalesce(array_agg(distinct m.id), '{}') into v_ids
      from public."TB_MONITORAMENTO_INDIGENA" m
      join unnest(v_pedidos) p(texto)
        on m.id::text = lower(p.texto)
        or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
        or lower(btrim(m.edital)) = lower(p.texto);
  else
    -- Sem pedido: os editais ativos (fora os de treinamento) com vagas da Empregare e regra.
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
      join public."TB_REGRA_ANALISE" r on r."CO_MONITORAMENTO" = m.id
     where coalesce(m.ativo, false) and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO");
  end if;

  return (
    with anexos as (
      select a."CO_EMPREGARE_RESPOSTA" as resposta, a."CO_PERGUNTA_EMPREGARE" as pergunta, a."NU_ARQUIVO" as arquivo,
             a."NU_ORDEM" as ordem, a."DS_ENUNCIADO" as enunciado, a."DS_COLUNA" as coluna, a."DS_LINK" as link,
             v."CO_MONITORAMENTO" as edital, v."CO_VAGA" as vaga, c."CO_EMPREGARE_CANDIDATO" as candidato,
             c."NO_CANDIDATO" as nome,
             -- O CPF do cadastro ou, sem ele, a resposta à pergunta do CPF no Excel (só dígitos).
             coalesce(nullif(regexp_replace(coalesce(c."NU_CPF", ''), '\D', '', 'g'), ''),
                      (select regexp_replace(e.value #>> '{}', '\D', '', 'g')
                         from jsonb_each(c."DS_COLUNA_ORIGINAL") e
                        where e.key ~* 'cpf' and jsonb_typeof(e.value) = 'string'
                        order by e.key limit 1)) as cpf,
             exists (select 1 from public."TB_FICHA_ANALISE" f
                      where f."CO_MONITORAMENTO" = v."CO_MONITORAMENTO"
                        and f."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO") as com_ficha,
             l."TP_SITUACAO" as situacao, l."NU_VERSAO_EXTRATOR" as versao
        from public."TB_EMPREGARE_VAGA" v
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_VAGA" = v."CO_VAGA" and c."ST_REGISTRO_ATIVO" = 'S'
        join public."TB_EMPREGARE_ANEXO" a
          on a."CO_EMPREGARE_RESPOSTA" = private."FC_RESPOSTA_VIGENTE_EMPREGARE"(c."CO_EMPREGARE_CANDIDATO")
        left join public."TB_LEITURA_ARQUIVO" l
          on l."CO_EMPREGARE_RESPOSTA" = a."CO_EMPREGARE_RESPOSTA" and l."CO_PERGUNTA_EMPREGARE" = a."CO_PERGUNTA_EMPREGARE"
         and l."NU_ARQUIVO" = a."NU_ARQUIVO"
       where v."CO_MONITORAMENTO" = any (v_ids)
    ),
    pendentes as (
      select * from anexos
       where (coalesce(p_forcar, false) or situacao is null or versao <> p_versao or situacao = 'ERRO')
         -- Só relidos: o que já foi lido (com outra versão, com erro ou, com p_forcar, todos); nunca o novo.
         and (not coalesce(p_so_relidos, false) or situacao is not null)
    )
    select jsonb_build_object(
      'nao_encontrados', coalesce((
        select jsonb_agg(p.texto order by p.texto)
          from unnest(v_pedidos) p(texto)
         where not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                            where m.id::text = lower(p.texto)
                               or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
                               or lower(btrim(m.edital)) = lower(p.texto))), '[]'::jsonb),
      'editais', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'rotulo', private."FC_ROTULO_DO_EDITAL"(m.edital),
                                            'regra', h."DS_CONFIGURACAO") order by m.id)
          from public."TB_MONITORAMENTO_INDIGENA" m
          left join public."TB_REGRA_ANALISE" r on r."CO_MONITORAMENTO" = m.id
          left join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
         where m.id = any (v_ids)), '[]'::jsonb),
      'total', (select count(*) from anexos),
      'pendentes', (select count(*) from pendentes),
      -- Primeiro o já lido com extrator de outra versão (a releitura troca o dado antigo), depois quem
      -- tem ficha, o que nunca foi lido e, por último, erro.
      'anexos', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'resposta', x.resposta, 'pergunta', x.pergunta, 'arquivo', x.arquivo, 'ordem', x.ordem,
                 'enunciado', x.enunciado, 'coluna', x.coluna, 'link', x.link, 'edital', x.edital, 'vaga', x.vaga,
                 'candidato', x.candidato, 'com_ficha', x.com_ficha, 'nome', x.nome,
                 'cpf', case when length(coalesce(x.cpf, '')) between 9 and 11
                             then encode(sha256(convert_to(p_sal || lpad(x.cpf, 11, '0'), 'UTF8')), 'hex')
                        end)
               order by x.n)
          from (select pd.*, row_number() over (
                         order by coalesce(pd.situacao <> 'ERRO' and pd.versao <> p_versao, false) desc,
                                  pd.com_ficha desc, (pd.situacao is null) desc, (pd.situacao = 'ERRO'),
                                  pd.candidato, pd.ordem nulls last, pd.pergunta, pd.arquivo) as n
                  from pendentes pd) x
         where x.n <= p_limite), '[]'::jsonb)
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.pre_classificacao_ler_editais(p_editais text[] DEFAULT NULL::text[], p_apos_robo boolean DEFAULT false, p_incluir_congelados boolean DEFAULT false, p_liberacao uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pedidos text[] := array(select btrim(x) from unnest(coalesce(p_editais, '{}')) x where btrim(x) <> '');
  v_ids uuid[];
  v_sync text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_congelados uuid[] := '{}';
begin
  if cardinality(v_pedidos) > 100 then
    raise exception 'Até 100 editais por execução' using errcode = '22023';
  end if;
  if cardinality(v_pedidos) > 0 then
    -- Cada pedido é o id do edital, o número ("93/2026") ou, sem número, o nome ("FCC").
    select coalesce(array_agg(distinct m.id), '{}') into v_ids
      from public."TB_MONITORAMENTO_INDIGENA" m
      join unnest(v_pedidos) p(texto)
        on m.id::text = lower(p.texto)
        or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
        or lower(btrim(m.edital)) = lower(p.texto);
  elsif p_apos_robo then
    -- Os editais das vagas gravadas na última execução fechada do robô.
    select s."CO_SYNC" into v_sync
      from public."TL_SYNC_EMPREGARE" s
     where s."TP_SITUACAO" in ('CONCLUIDA', 'PARCIAL')
     order by s."DT_INICIO" desc limit 1;
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
     where v."CO_SYNC" = v_sync and v."CO_MONITORAMENTO" is not null
       and not private."FC_EDITAL_EH_TREINAMENTO"(v."CO_MONITORAMENTO");
  else
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
     where coalesce(m.ativo, false) and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO");
  end if;

  -- [congeladas] Edital com inscrições congeladas (20261020170000): fica fora (após robô,
  -- normal e refazer lote), salvo liberação válida; o modo seco pede p_incluir_congelados.
  if not coalesce(p_incluir_congelados, false) then
    select coalesce(array_agg(x), '{}') into v_congelados
      from unnest(v_ids) x
     where private."FC_INSCRICOES_CONGELADAS"(x)
       and not private."FC_LIBERACAO_CONGELAMENTO_VALIDA"(p_liberacao, x);
    v_ids := array(select x from unnest(v_ids) x where not x = any (v_congelados));
  end if;

  return jsonb_build_object(
    'hoje', v_hoje,
    'sync', v_sync,
    'congelados', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'rotulo', private."FC_ROTULO_DO_EDITAL"(m.edital), 'pedido', cardinality(v_pedidos) > 0)
             order by private."FC_ROTULO_DO_EDITAL"(m.edital), m.id)
        from public."TB_MONITORAMENTO_INDIGENA" m
       where m.id = any (v_congelados)), '[]'::jsonb),
    'nao_encontrados', coalesce((
      select jsonb_agg(p.texto order by p.texto)
        from unnest(v_pedidos) p(texto)
       where not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                          where m.id::text = lower(p.texto)
                             or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
                             or lower(btrim(m.edital)) = lower(p.texto))), '[]'::jsonb),
    'editais', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'rotulo', private."FC_ROTULO_DO_EDITAL"(m.edital),
               'area', m."CO_AREA",
               'ativo', coalesce(m.ativo, false),
               'treinamento', private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO"),
               'congelado', private."FC_INSCRICOES_CONGELADAS"(m.id),
               'regra', (select jsonb_build_object('versao', r."NU_VERSAO_VIGENTE", 'situacao', r."TP_SITUACAO",
                                                   'configuracao', h."DS_CONFIGURACAO")
                           from public."TB_REGRA_ANALISE" r
                           join public."TH_REGRA_ANALISE" h
                             on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
                          where r."CO_MONITORAMENTO" = m.id),
               'documental', private."FC_DOCUMENTAL_DO_EDITAL"(m.id),
               -- O cronograma: o job congela a declarada depois do fim das inscrições.
               'cronograma', coalesce((
                 select jsonb_agg(jsonb_build_object('atividade', c.atividade, 'inicio', c.data_inicio, 'fim', c.data_fim)
                        order by c.ordem)
                   from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = m.id), '[]'::jsonb),
               -- Refazer o lote do zero: ninguém analisado e TODAS as fichas do edital intocadas
               -- (FC_FICHAS_INICIADAS = 0); fichas_iniciadas vai para a mensagem da recusa (20261013110000).
               'fichas_iniciadas', fi.n,
               'refazer_permitido', fi.n = 0
                                    and not exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                                                     where a."CO_MONITORAMENTO" = m.id and a."TP_SITUACAO" = 'ANALISADO'),
               -- [sem-mudanca] Só no fim do robô: nada mudou desde a última pré-classificação
               -- CONCLUÍDA de hoje que processou o edital (o job pula o edital).
               'sem_mudanca', p_apos_robo and cardinality(v_pedidos) = 0 and exists (
                 select 1
                   from public."TL_PRE_CLASSIFICACAO" l
                  where l."TP_SITUACAO" = 'CONCLUIDA'
                    and (l."DT_INICIO" at time zone 'America/Sao_Paulo')::date = v_hoje
                    and l."DS_EDITAL" @> jsonb_build_array(jsonb_build_object('edital', m.id, 'situacao', 'PROCESSADO'))
                    and l."DT_INICIO" > coalesce((
                          select max(c."DT_ATUALIZACAO")
                            from public."TB_EMPREGARE_VAGA" v
                            join public."TB_EMPREGARE_CANDIDATO" c on c."CO_VAGA" = v."CO_VAGA"
                           where v."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)
                    and l."DT_INICIO" > coalesce((
                          select max(greatest(d."DT_CRIACAO", d."DT_ATUALIZACAO", d."DT_REVOGACAO"))
                            from public."TB_DECISAO_LOTE" d where d."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)
                    and l."DT_INICIO" > coalesce((
                          select greatest(r."DT_CRIACAO", r."DT_ATUALIZACAO", r."DT_CONFERENCIA")
                            from public."TB_REGRA_ANALISE" r where r."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)
                    and l."DT_INICIO" > coalesce((
                          select max(greatest(q."DT_CRIACAO", q."DT_DESATIVACAO"))
                            from public."TB_QUADRO_VAGA_EDITAL" q where q."CO_MONITORAMENTO" = m.id), '-infinity'::timestamptz)),
               -- Só os metadados da vaga: o cargo e a linha do quadro vêm com os inscritos
               -- (pre_classificacao_ler_candidatos, uma vaga por chamada, desde 20261014110000).
               'vagas', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'codigo', v."CO_VAGA",
                          'situacao_carga', v."TP_SITUACAO",
                          'candidatos_ativos', v."QT_CANDIDATO_ATIVO",
                          'ultima_carga', v."DT_ULTIMA_CARGA",
                          'ultimo_lote', coalesce(pv."NU_ULTIMO_LOTE", 0))
                        order by v."CO_VAGA")
                   from public."TB_EMPREGARE_VAGA" v
                   left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = m.id and pv."CO_VAGA" = v."CO_VAGA"
                  where v."CO_MONITORAMENTO" = m.id), '[]'::jsonb))
             order by private."FC_ROTULO_DO_EDITAL"(m.edital), m.id)
        from public."TB_MONITORAMENTO_INDIGENA" m
       cross join lateral (select private."FC_FICHAS_INICIADAS"(m.id) as n) fi
       where m.id = any (v_ids)), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private."FC_VALIDAR_LANCAMENTO_FICHA"(p_regra jsonb, p_lanc jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_blocos jsonb := case when jsonb_typeof(p_regra -> 'blocos') = 'array' then p_regra -> 'blocos' else '[]'::jsonb end;
  v_nivel text := p_lanc ->> 'nivel';
  v_item record;
  v_bloco jsonb;
  v_teto numeric;
  v_codigo text;
  v_lista jsonb;
  v_campo text;
begin
  if jsonb_typeof(p_lanc) is distinct from 'object' or length(p_lanc::text) > 200000 then
    raise exception 'Lançamento da ficha inválido.' using errcode = '22023';
  end if;
  if v_nivel is null or v_nivel not in ('superior', 'tecnico', 'medio', 'fundamental') then
    raise exception 'Escolha o nível da vaga.' using errcode = '22023';
  end if;
  if p_lanc ? 'modalidade' and coalesce(p_lanc ->> 'modalidade', '') !~ '^[A-Z]{2,10}$' then
    raise exception 'Modalidade inválida.' using errcode = '22023';
  end if;
  foreach v_campo in array array['indigena', 'mora_aldeia', 'aldeia_na_lista'] loop
    if p_lanc ? v_campo and jsonb_typeof(p_lanc -> v_campo) not in ('boolean', 'null') then
      raise exception 'Campo % inválido.', v_campo using errcode = '22023';
    end if;
  end loop;
  if p_lanc ? 'estagio_horas' and not private."FC_JSON_NUMERO_ENTRE"(p_lanc -> 'estagio_horas', 0, 20000) then
    raise exception 'Horas de estágio de 0 a 20.000.' using errcode = '22023';
  end if;
  if length(coalesce(p_lanc ->> 'observacoes', '')) > 4000 then
    raise exception 'Observações com até 4.000 caracteres.' using errcode = '22023';
  end if;
  if p_lanc ? 'observacoes_prontas' and (jsonb_typeof(p_lanc -> 'observacoes_prontas') <> 'array'
     or exists (select 1 from jsonb_array_elements_text(p_lanc -> 'observacoes_prontas') o
                 where not exists (select 1 from jsonb_array_elements(coalesce(p_regra -> 'observacoes_prontas', '[]'::jsonb)) r
                                    where r ->> 'codigo' = o))) then
    raise exception 'Observação pronta que não está na regra.' using errcode = '22023';
  end if;

  -- Blocos: só os da regra, com situação, motivos e justificativas da regra e nota até o teto.
  if p_lanc ? 'blocos' and jsonb_typeof(p_lanc -> 'blocos') <> 'object' then
    raise exception 'Blocos da ficha inválidos.' using errcode = '22023';
  end if;
  for v_item in select key, value from jsonb_each(coalesce(p_lanc -> 'blocos', '{}'::jsonb)) loop
    select b into v_bloco from jsonb_array_elements(v_blocos) b where b ->> 'codigo' = v_item.key;
    if v_bloco is null then
      raise exception 'O bloco % não está na regra.', v_item.key using errcode = '22023';
    end if;
    if jsonb_typeof(v_item.value) <> 'object' then
      raise exception 'Bloco % inválido.', v_item.key using errcode = '22023';
    end if;
    if coalesce(v_item.value ->> 'situacao', 'CONFORME') not in ('CONFORME', 'NAO_CONFORME', 'NAO_ENVIADO', 'NAO_SE_APLICA') then
      raise exception 'Situação inválida no bloco %.', v_item.key using errcode = '22023';
    end if;
    -- "Não se aplica" só vem da condição do bloco (modalidade, indígena): no bloco que vale
    -- para o candidato, a situação é Conforme, Não conforme ou Não enviado (20261013180100).
    if v_item.value ->> 'situacao' = 'NAO_SE_APLICA' and coalesce(v_bloco ->> 'tipo', '') <> 'REGISTRO'
       and private."FC_BLOCO_SE_APLICA"(v_bloco, p_lanc) then
      raise exception 'O bloco % vale para este candidato: a situação é Conforme, Não conforme ou Não enviado.', v_item.key
        using errcode = '22023';
    end if;
    v_lista := coalesce(v_item.value -> 'motivos', '[]'::jsonb);
    if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 30
       or exists (select 1 from jsonb_array_elements_text(v_lista) m
                   where m <> 'OUTRO' -- "Outro motivo (descrever)": o texto vai em motivo_livre
                     and not exists (select 1 from jsonb_array_elements(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) x
                                      where x ->> 'codigo' = m)) then
      raise exception 'Motivo que não está na regra no bloco %.', v_item.key using errcode = '22023';
    end if;
    v_lista := coalesce(v_item.value -> 'justificativas', '[]'::jsonb);
    if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 10
       or exists (select 1 from jsonb_array_elements_text(v_lista) j
                   where j <> 'OUTRO'
                     and not exists (select 1 from jsonb_array_elements(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) x where x ->> 'codigo' = j)
                     and not exists (select 1 from jsonb_array_elements(coalesce(p_regra -> 'observacoes_prontas', '[]'::jsonb)) x where x ->> 'codigo' = j)) then
      raise exception 'Justificativa que não está na regra no bloco %.', v_item.key using errcode = '22023';
    end if;
    -- Diferenças por cargo (20261013130000): as linhas extras e os requisitos
    -- do cargo da vaga (a regra da vaga, FC_REGRA_DA_VAGA), marcados true/false.
    foreach v_campo in array array['extras', 'requisitos'] loop
      continue when coalesce(jsonb_typeof(v_item.value -> v_campo), 'null') = 'null';
      if jsonb_typeof(v_item.value -> v_campo) <> 'object'
         or exists (select 1 from jsonb_each(v_item.value -> v_campo) e
                     where jsonb_typeof(e.value) <> 'boolean'
                        or not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(v_bloco -> v_campo) = 'array'
                                                                               then v_bloco -> v_campo else '[]'::jsonb end) x
                                        where x ->> 'codigo' = e.key)) then
        raise exception '% que não está na regra da vaga no bloco %.',
          case v_campo when 'extras' then 'Item extra' else 'Requisito do cargo' end, v_item.key using errcode = '22023';
      end if;
    end loop;
    if length(coalesce(v_item.value ->> 'motivo_livre', '')) > 2000 or length(coalesce(v_item.value ->> 'justificativa_livre', '')) > 2000 then
      raise exception 'Texto do bloco % com até 2.000 caracteres.', v_item.key using errcode = '22023';
    end if;
    -- Observação do avaliador (20261015010000): texto opcional em qualquer bloco e situação.
    if coalesce(jsonb_typeof(v_item.value -> 'observacao'), 'null') not in ('string', 'null')
       or length(coalesce(v_item.value ->> 'observacao', '')) > 2000 then
      raise exception 'Observação do avaliador no bloco % com até 2.000 caracteres.', v_item.key using errcode = '22023';
    end if;
    if jsonb_typeof(v_item.value -> 'nota_ajustada') is not null and jsonb_typeof(v_item.value -> 'nota_ajustada') <> 'null' then
      if private."FC_PARCIAL_DO_TIPO"(v_bloco ->> 'tipo') is null then
        raise exception 'O bloco % não pontua: não tem nota.', v_item.key using errcode = '22023';
      end if;
      v_teto := coalesce(private."FC_TETO_DO_BLOCO"(v_bloco, v_nivel), 100);
      if not private."FC_JSON_NUMERO_OBRIGATORIO"(v_item.value -> 'nota_ajustada', 0, v_teto) then
        raise exception 'Nota do bloco % de 0 a %.', v_item.key, v_teto using errcode = '22023';
      end if;
    end if;
  end loop;

  -- Itens: títulos, cursos e vínculos.
  foreach v_campo in array array['titulos', 'cursos', 'vinculos'] loop
    v_lista := coalesce(p_lanc -> v_campo, '[]'::jsonb);
    if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 50 then
      raise exception 'Lista de % inválida (até 50).', v_campo using errcode = '22023';
    end if;
    for v_item in select value from jsonb_array_elements(v_lista) loop
      if jsonb_typeof(v_item.value) <> 'object'
         or jsonb_typeof(coalesce(v_item.value -> 'aceito', 'true'::jsonb)) <> 'boolean'
         or length(coalesce(v_item.value ->> 'nome', '')) > 200 or length(coalesce(v_item.value ->> 'empregador', '')) > 200
         or coalesce(v_item.value ->> 'motivo', 'OK') !~ '^[A-Z][A-Z0-9_]{1,29}$' then
        raise exception 'Item de % inválido.', v_campo using errcode = '22023';
      end if;
      if v_campo = 'titulos' and coalesce(v_item.value ->> 'titulo', '') not in
         ('ENSINO_MEDIO', 'TECNICO', 'GRADUACAO', 'ESPECIALIZACAO', 'RESIDENCIA', 'MESTRADO', 'DOUTORADO') then
        raise exception 'Título acadêmico inválido.' using errcode = '22023';
      end if;
      if v_campo = 'cursos' and not private."FC_JSON_NUMERO_ENTRE"(coalesce(v_item.value -> 'horas', '0'::jsonb), 0, 20000) then
        raise exception 'Carga horária do curso de 0 a 20.000.' using errcode = '22023';
      end if;
      if v_campo = 'vinculos' then
        if coalesce(v_item.value ->> 'categoria', '') !~ '^[A-Z][A-Z0-9_]{1,29}$' then
          raise exception 'Categoria do vínculo inválida.' using errcode = '22023';
        end if;
        if coalesce(v_item.value ->> 'inicio', '') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(v_item.value ->> 'fim', '') !~ '^\d{4}-\d{2}-\d{2}$' then
          continue; -- rascunho com data incompleta: não conta; concluir pede a data
        end if;
        begin
          if (v_item.value ->> 'inicio')::date < date '1950-01-01' or (v_item.value ->> 'fim')::date > current_date + 3660 then
            raise exception 'Datas do vínculo fora do intervalo.' using errcode = '22023';
          end if;
        exception when datetime_field_overflow or invalid_datetime_format then
          raise exception 'Data do vínculo inválida.' using errcode = '22023';
        end;
      end if;
    end loop;
  end loop;
  -- O que o robô leu dos arquivos (20261009220000): as recusas e a origem das linhas aceitas.
  perform private."FC_VALIDAR_LEITURAS_LANCAMENTO"(p_lanc);
end;
$function$;

drop function if exists public.revisar_ficha_concluida_com_pendencia(uuid, integer);
drop function if exists public.corrigir_experiencia_da_ficha(uuid, integer, jsonb, text, uuid);
drop function if exists private."FC_REGRA_COM_DATA_LIMITE"(jsonb, uuid);
drop function if exists private."FC_FIM_DAS_INSCRICOES"(uuid);
drop function if exists private."FC_AJUSTE_JUSTIFICADO"(jsonb, jsonb, jsonb);
drop function if exists private."FC_BLOCO_PELA_NOTA"(jsonb, jsonb);
drop function if exists private."FC_CALCULADO_DO_BLOCO"(jsonb, jsonb);
drop function if exists private."FC_EXPERIENCIA_DA_FICHA"(jsonb, jsonb);
drop function if exists private."FC_BLOCO_NO_NIVEL"(jsonb, text);
drop function if exists private."FC_NUMERO_OU_ZERO"(jsonb);
drop function if exists private."FC_EFEITO_DO_BLOCO"(jsonb, jsonb);
drop function if exists private."FC_ANOS_MESES_DIAS"(integer);
drop function if exists private."FC_DIAS_DOS_INTERVALOS"(jsonb, boolean, date);
drop function if exists private."FC_DATA_DO_TEXTO"(text);

commit;
