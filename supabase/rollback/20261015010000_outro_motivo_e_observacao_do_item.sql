/*
  ROLLBACK da migration 20261015010000_outro_motivo_e_observacao_do_item.sql:
  volta FC_VALIDAR_LANCAMENTO_FICHA (20261013180100) e FC_PENDENCIAS_FICHA
  (20261014191000) ao que eram (definição lida do banco em 14/10/2026). Os
  lançamentos gravados com OUTRO ou observacao passam a ser recusados no
  próximo rascunho: limpe-os antes, se houver.
*/
begin;

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
                   where not exists (select 1 from jsonb_array_elements(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) x
                                      where x ->> 'codigo' = m)) then
      raise exception 'Motivo que não está na regra no bloco %.', v_item.key using errcode = '22023';
    end if;
    v_lista := coalesce(v_item.value -> 'justificativas', '[]'::jsonb);
    if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 10
       or exists (select 1 from jsonb_array_elements_text(v_lista) j
                   where not exists (select 1 from jsonb_array_elements(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) x where x ->> 'codigo' = j)
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
$function$;

comment on function private."FC_VALIDAR_LANCAMENTO_FICHA"(jsonb, jsonb) is
  'Confere a estrutura do lançamento da ficha contra a regra da vaga (22023): nível, modalidade, blocos e motivos/justificativas da regra, nota ajustada de 0 ao teto do bloco no nível, até 50 títulos/cursos/vínculos com campos válidos, datas e textos limitados; desde 20261013130000, as linhas extras e os requisitos do cargo (extras/requisitos de cada bloco, true ou false, só os da regra da vaga). As recusas dos itens lidos dos arquivos (recusas_lidas) e a origem das linhas aceitas (do_arquivo) vão por FC_VALIDAR_LEITURAS_LANCAMENTO (20261009220000). Desde 20261013180100, NAO_SE_APLICA só em bloco cuja condição não vale para o candidato. Não refaz a conta.';
revoke all on function private."FC_VALIDAR_LANCAMENTO_FICHA"(jsonb, jsonb) from public, anon, authenticated;
comment on function private."FC_PENDENCIAS_FICHA"(jsonb, jsonb, jsonb) is
  'O que falta para concluir (pendenciasDaFicha de ficha.js): situação de cada bloco que se aplica, motivo do Não conforme/Não enviado, cada requisito do cargo conferido no bloco Conforme e cada item extra do cargo marcado na pontuação pelos itens (20261013130000), motivo do item recusado, datas dos vínculos, experiência Conforme abaixo do mínimo da regra pelos vínculos aceitos e justificativa de toda nota diferente da declarada (fora do inapto por requisito). Vazio = pode concluir. Desde 20261014191000, as datas só dos vínculos aceitos.';
revoke all on function private."FC_PENDENCIAS_FICHA"(jsonb, jsonb, jsonb) from public, anon, authenticated;

commit;
