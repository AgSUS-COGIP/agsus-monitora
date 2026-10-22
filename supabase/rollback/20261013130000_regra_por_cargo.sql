-- ROLLBACK de supabase/migrations/20261013130000_regra_por_cargo.sql
-- Volta as seis funções às definições de antes (validação da regra, do
-- lançamento e das pendências, rascunho, conclusão e apoio do assistente) e
-- apaga as funções da regra da vaga. Antes, tire as diferenças por cargo das
-- regras vigentes (uma versão nova sem por_cargo): sem a validação nova, o
-- banco não as recusa, mas a ficha deixa de aplicá-las e os rascunhos com
-- extras/requisitos continuam aceitos (as chaves só são ignoradas).
begin;

set local lock_timeout = '10s';

CREATE OR REPLACE FUNCTION private."FC_VALIDAR_REGRA_ANALISE"(p_regra jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_lista jsonb;
  v_obj jsonb;
  v_item record;
  v_codigos text[] := '{}';
  v_mapa jsonb;
  v_por_nivel jsonb;
  v_tipo text;
begin
  if jsonb_typeof(p_regra) is distinct from 'object' then
    raise exception 'Regra inválida: envie um objeto.' using errcode = '22023';
  end if;
  if length(p_regra::text) > 200000 then
    raise exception 'Regra grande demais.' using errcode = '22023';
  end if;
  if (p_regra -> 'schema') is distinct from '1'::jsonb then
    raise exception 'Versão do formato (schema) deve ser 1.' using errcode = '22023';
  end if;
  if not private."FC_JSON_TEXTO_OK"(p_regra -> 'modelo', false, 30)
     or not private."FC_JSON_TEXTO_OK"(p_regra -> 'titulo_etapa', true, 200)
     or not private."FC_JSON_TEXTO_OK"(p_regra -> 'edital_rotulo', false, 120) then
    raise exception 'Modelo (até 30), título da etapa (obrigatório, até 200) ou rótulo do edital (até 120) inválidos.' using errcode = '22023';
  end if;
  if not private."FC_JSON_NUMERO_ENTRE"(p_regra -> 'casas_parecer', 0, 4) then
    raise exception 'Casas decimais do parecer entre 0 e 4.' using errcode = '22023';
  end if;

  -- Provisória: eliminação automática e nota declarada.
  v_obj := coalesce(p_regra -> 'provisoria', '{}'::jsonb);
  if jsonb_typeof(v_obj) <> 'object' then
    raise exception 'Provisória inválida.' using errcode = '22023';
  end if;
  v_lista := coalesce(v_obj -> 'eliminacao_automatica', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 20 then
    raise exception 'Eliminação automática: até 20 regras.' using errcode = '22023';
  end if;
  for v_item in select e.value, e.ordinality from jsonb_array_elements(v_lista) with ordinality e loop
    if jsonb_typeof(v_item.value) <> 'object' or coalesce(v_item.value ->> 'codigo', '') !~ '^[A-Z][A-Z0-9_]{1,29}$' then
      raise exception 'Eliminação automática %: código em maiúsculas.', v_item.ordinality using errcode = '22023';
    end if;
    if (v_item.value ->> 'codigo') = any (v_codigos) then
      raise exception 'Eliminação automática %: código repetido.', v_item.ordinality using errcode = '22023';
    end if;
    v_codigos := v_codigos || (v_item.value ->> 'codigo');
    if (select count(*) from unnest(array['coluna', 'coluna_prefixo', 'pergunta']) k
         where jsonb_typeof(v_item.value -> k) = 'string' and btrim(v_item.value ->> k) <> '') <> 1 then
      raise exception 'Eliminação automática %: diga uma coluna, um prefixo de coluna ou uma pergunta.', v_item.ordinality using errcode = '22023';
    end if;
    if not private."FC_JSON_TEXTOS_OK"(v_item.value -> 'quando', 20) or not private."FC_JSON_TEXTOS_OK"(v_item.value -> 'exceto', 20) then
      raise exception 'Eliminação automática %: quando/exceto com até 20 textos.', v_item.ordinality using errcode = '22023';
    end if;
    if coalesce(jsonb_array_length(case when jsonb_typeof(v_item.value -> 'quando') = 'array' then v_item.value -> 'quando' end), 0)
       + coalesce(jsonb_array_length(case when jsonb_typeof(v_item.value -> 'exceto') = 'array' then v_item.value -> 'exceto' end), 0) = 0 then
      raise exception 'Eliminação automática %: diga os valores que eliminam (quando) ou os que passam (exceto).', v_item.ordinality using errcode = '22023';
    end if;
    if not private."FC_JSON_TEXTO_OK"(v_item.value -> 'motivo', true, 200) then
      raise exception 'Eliminação automática % (motivo): obrigatório, até 200 caracteres.', v_item.ordinality using errcode = '22023';
    end if;
  end loop;
  v_lista := coalesce(v_obj -> 'nota_declarada', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 20 then
    raise exception 'Nota declarada: até 20 perguntas.' using errcode = '22023';
  end if;
  for v_item in select d.value, d.ordinality from jsonb_array_elements(v_lista) with ordinality d loop
    if jsonb_typeof(v_item.value) <> 'object' then
      raise exception 'Nota declarada %: inválida.', v_item.ordinality using errcode = '22023';
    end if;
    if coalesce(v_item.value ->> 'parcial', '') not in ('ETNICO', 'FORMACAO', 'CURSOS', 'EXPERIENCIA') then
      raise exception 'Nota declarada %: parcial ETNICO, FORMACAO, CURSOS ou EXPERIENCIA.', v_item.ordinality using errcode = '22023';
    end if;
    if not private."FC_JSON_PERGUNTA_OK"(v_item.value -> 'pergunta', true) then
      raise exception 'Nota declarada % (pergunta): obrigatória, texto ou lista de 1 a 10 textos de até 200 caracteres.', v_item.ordinality using errcode = '22023';
    end if;
    v_tipo := v_item.value ->> 'tipo';
    if v_tipo is null or v_tipo not in ('OPCAO', 'OPCOES_SOMADAS', 'FAIXA_EM_MESES') then
      raise exception 'Nota declarada %: tipo OPCAO, OPCOES_SOMADAS ou FAIXA_EM_MESES.', v_item.ordinality using errcode = '22023';
    end if;
    v_por_nivel := v_item.value -> 'pontos_por_nivel';
    if coalesce(jsonb_typeof(v_por_nivel), 'null') <> 'null' then
      -- Pontos por nível da vaga: {"superior": {resposta: pontos}, "tecnico": {…}} no lugar de pontos.
      if v_tipo = 'FAIXA_EM_MESES' then
        raise exception 'Nota declarada %: pontos por nível só em OPCAO ou OPCOES_SOMADAS.', v_item.ordinality using errcode = '22023';
      end if;
      if coalesce(jsonb_typeof(v_item.value -> 'pontos'), 'null') <> 'null' then
        raise exception 'Nota declarada %: pontos ou pontos por nível, não os dois.', v_item.ordinality using errcode = '22023';
      end if;
      if jsonb_typeof(v_por_nivel) <> 'object'
         or not exists (select 1 from jsonb_object_keys(v_por_nivel))
         or exists (select 1 from jsonb_each(v_por_nivel) n
                     where n.key not in ('superior', 'tecnico', 'medio', 'fundamental')
                        or not private."FC_JSON_MAPA_DECLARADA_OK"(n.value, 100)) then
        raise exception 'Nota declarada %: pontos por nível (superior, tecnico, medio, fundamental), de 0 a 100 em cada resposta (até 50 respostas).', v_item.ordinality using errcode = '22023';
      end if;
    else
      v_mapa := case when v_tipo = 'FAIXA_EM_MESES' then v_item.value -> 'meses' else v_item.value -> 'pontos' end;
      if not private."FC_JSON_MAPA_DECLARADA_OK"(v_mapa, case when v_tipo = 'FAIXA_EM_MESES' then 1200 else 100 end) then
        raise exception 'Nota declarada %: % de cada resposta (até 50 respostas).', v_item.ordinality,
          case when v_tipo = 'FAIXA_EM_MESES' then 'meses (0 a 1200)' else 'pontos (0 a 100)' end using errcode = '22023';
      end if;
    end if;
    if v_tipo = 'FAIXA_EM_MESES' and not private."FC_JSON_NUMERO_OBRIGATORIO"(v_item.value -> 'pontos_por_mes', 0, 100) then
      raise exception 'Nota declarada %: pontos por mês entre 0 e 100.', v_item.ordinality using errcode = '22023';
    end if;
    if not private."FC_JSON_NUMERO_ENTRE"(v_item.value -> 'teto', 0, 100) then
      raise exception 'Nota declarada %: teto entre 0 e 100.', v_item.ordinality using errcode = '22023';
    end if;
  end loop;
  if not private."FC_JSON_NUMERO_ENTRE"(v_obj -> 'divergencia_tolerancia', 0, 30) then
    raise exception 'Tolerância da divergência entre 0 e 30 pontos.' using errcode = '22023';
  end if;
  -- A nota do corte e da ordem do lote (sem ela: DECLARADA com nota declarada, senão ART).
  if coalesce(jsonb_typeof(v_obj -> 'base_da_nota'), 'null') <> 'null' then
    if jsonb_typeof(v_obj -> 'base_da_nota') <> 'string' or (v_obj ->> 'base_da_nota') not in ('DECLARADA', 'ART') then
      raise exception 'Base da nota do lote: DECLARADA ou ART.' using errcode = '22023';
    end if;
    if v_obj ->> 'base_da_nota' = 'DECLARADA' and jsonb_array_length(v_lista) = 0 then
      raise exception 'Base da nota do lote pela declarada: configure a nota declarada.' using errcode = '22023';
    end if;
  end if;

  -- Lote.
  v_obj := coalesce(p_regra -> 'lote', '{}'::jsonb);
  if jsonb_typeof(v_obj) <> 'object' then
    raise exception 'Lote inválido.' using errcode = '22023';
  end if;
  if coalesce(v_obj ->> 'base', '') not in ('MULTIPLO_VAGAS', 'FIXO', 'NOTA_MINIMA') then
    raise exception 'Lote: múltiplo das vagas, número fixo ou nota mínima.' using errcode = '22023';
  end if;
  if v_obj ->> 'base' = 'MULTIPLO_VAGAS' and not private."FC_JSON_NUMERO_OBRIGATORIO"(v_obj -> 'multiplo', 1, 100) then
    raise exception 'Lote: múltiplo de 1 a 100.' using errcode = '22023';
  end if;
  if v_obj ->> 'base' = 'FIXO' and not private."FC_JSON_NUMERO_OBRIGATORIO"(v_obj -> 'fixo', 1, 100000) then
    raise exception 'Lote: número fixo de 1 a 100.000.' using errcode = '22023';
  end if;
  if v_obj ->> 'base' = 'NOTA_MINIMA' and not private."FC_JSON_NUMERO_OBRIGATORIO"(v_obj -> 'nota_minima', 0, 1000) then
    raise exception 'Lote: nota mínima de 0 a 1.000.' using errcode = '22023';
  end if;
  if not private."FC_JSON_TEXTO_OK"(v_obj -> 'item_edital', false, 40) then
    raise exception 'Lote: item do edital com até 40 caracteres.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(array['inclui_cr', 'por_modalidade', 'inclui_empatados', 'linha_anda', 'publica_reposicao']) k
              where not private."FC_JSON_SIM_NAO_OK"(v_obj, k)) then
    raise exception 'Lote: as opções são sim ou não.' using errcode = '22023';
  end if;

  -- Distribuição e revisão.
  v_obj := coalesce(p_regra -> 'distribuicao', '{}'::jsonb);
  if jsonb_typeof(v_obj) <> 'object' then
    raise exception 'Distribuição inválida.' using errcode = '22023';
  end if;
  if coalesce(v_obj ->> 'modo', '') not in ('PEGAR_PROXIMO', 'DISTRIBUICAO_INICIAL') then
    raise exception 'Distribuição: Pegar próximo ou Distribuição inicial.' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(v_obj -> 'criterio'), 'null') <> 'null' and coalesce(v_obj ->> 'criterio', '') not in ('PARTES_IGUAIS', 'LIMITE') then
    raise exception 'Distribuição: partes iguais ou até um limite.' using errcode = '22023';
  end if;
  if not private."FC_JSON_NUMERO_ENTRE"(v_obj -> 'limite_por_analista', 1, 5000) then
    raise exception 'Distribuição: limite por analista de 1 a 5.000.' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(v_obj -> 'novos'), 'null') <> 'null' and coalesce(v_obj ->> 'novos', '') not in ('MENOS_PENDENTES', 'PEGAR_PROXIMO') then
    raise exception 'Distribuição: destino dos que entram depois inválido.' using errcode = '22023';
  end if;
  if not private."FC_JSON_NUMERO_ENTRE"(v_obj -> 'dias_parada', 1, 60) then
    raise exception 'Distribuição: ficha parada de 1 a 60 dias úteis.' using errcode = '22023';
  end if;
  v_obj := coalesce(p_regra -> 'revisao', '{}'::jsonb);
  if jsonb_typeof(v_obj) <> 'object' then
    raise exception 'Revisão inválida.' using errcode = '22023';
  end if;
  if not private."FC_JSON_NUMERO_ENTRE"(v_obj -> 'amostra_percentual', 0, 100)
     or not private."FC_JSON_NUMERO_ENTRE"(v_obj -> 'minimo_por_analista', 0, 1000)
     or not private."FC_JSON_NUMERO_ENTRE"(v_obj -> 'divergencia_pontos', 0, 1000) then
    raise exception 'Revisão: amostra de 0 a 100%%, mínimo por analista e divergência de 0 a 1.000.' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(v_obj -> 'sinais'), 'null') <> 'null'
     and (jsonb_typeof(v_obj -> 'sinais') <> 'array'
          or exists (select 1 from jsonb_array_elements(v_obj -> 'sinais') s
                      where coalesce(s #>> '{}', '') not in ('VINCULO_ATIVO', 'PARENTESCO') or jsonb_typeof(s) <> 'string')) then
    raise exception 'Revisão: sinais desconhecidos.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(array['todas', 'inaptos_requisito', 'inaptos_nota', 'entrou_pela_linha', 'duplo_cego']) k
              where not private."FC_JSON_SIM_NAO_OK"(v_obj, k)) then
    raise exception 'Revisão: as opções são sim ou não.' using errcode = '22023';
  end if;

  -- Blocos.
  v_lista := p_regra -> 'blocos';
  if jsonb_typeof(v_lista) is distinct from 'array' or jsonb_array_length(v_lista) not between 1 and 40 then
    raise exception 'De 1 a 40 blocos.' using errcode = '22023';
  end if;
  for v_item in select b.value, b.ordinality from jsonb_array_elements(v_lista) with ordinality b loop
    perform private."FC_VALIDAR_BLOCO_ANALISE"(v_item.value, v_item.ordinality::integer);
  end loop;
  if (select count(distinct b ->> 'codigo') from jsonb_array_elements(v_lista) b) <> jsonb_array_length(v_lista) then
    raise exception 'Código de bloco repetido.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_lista) b
              where b ->> 'tipo' in ('PONTUACAO', 'TITULOS', 'CURSOS', 'VINCULOS')
              group by b ->> 'tipo' having count(*) > 1) then
    raise exception 'Só um bloco de cada tipo que pontua (uma parcial por regra).' using errcode = '22023';
  end if;

  -- Nota mínima, parecer e observações prontas.
  if coalesce(jsonb_typeof(p_regra -> 'corte'), 'null') <> 'null' then
    if jsonb_typeof(p_regra -> 'corte') <> 'object' or (p_regra #> '{corte,fonte}') is distinct from '"REGRA_CLASSIFICACAO"'::jsonb then
      raise exception 'A nota mínima vem da regra de classificação (REGRA_CLASSIFICACAO).' using errcode = '22023';
    end if;
    if not private."FC_JSON_TEXTO_OK"(p_regra #> '{corte,item_edital}', false, 40) then
      raise exception 'Item da nota mínima: até 40 caracteres.' using errcode = '22023';
    end if;
  end if;
  v_obj := coalesce(p_regra -> 'parecer', '{}'::jsonb);
  if jsonb_typeof(v_obj) <> 'object'
     or exists (select 1 from unnest(array['APTO', 'INAPTO_REQUISITO', 'INAPTO_NOTA', 'observacoes']) k
                 where not private."FC_JSON_TEXTO_OK"(v_obj -> k, true, 4000)) then
    raise exception 'Modelos de parecer: APTO, INAPTO_REQUISITO, INAPTO_NOTA e observacoes, cada um com até 4.000 caracteres.' using errcode = '22023';
  end if;
  v_lista := coalesce(p_regra -> 'observacoes_prontas', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 40 then
    raise exception 'Até 40 observações prontas.' using errcode = '22023';
  end if;
  v_codigos := '{}';
  for v_item in select o.value, o.ordinality from jsonb_array_elements(v_lista) with ordinality o loop
    if jsonb_typeof(v_item.value) <> 'object' or coalesce(v_item.value ->> 'codigo', '') !~ '^[A-Z][A-Z0-9_]{1,29}$' then
      raise exception 'Observação pronta %: código em maiúsculas.', v_item.ordinality using errcode = '22023';
    end if;
    if (v_item.value ->> 'codigo') = any (v_codigos) then
      raise exception 'Observação pronta %: código repetido.', v_item.ordinality using errcode = '22023';
    end if;
    v_codigos := v_codigos || (v_item.value ->> 'codigo');
    if not private."FC_JSON_TEXTO_OK"(v_item.value -> 'rotulo', true, 100)
       or not private."FC_JSON_TEXTO_OK"(v_item.value -> 'texto', true, 1000)
       or not private."FC_JSON_TEXTO_OK"(v_item.value -> 'item_edital', false, 40) then
      raise exception 'Observação pronta %: rótulo (até 100) e texto (até 1000) obrigatórios; item até 40.', v_item.ordinality using errcode = '22023';
    end if;
  end loop;
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
$function$;

CREATE OR REPLACE FUNCTION public.salvar_rascunho_ficha(p_ficha uuid, p_versao integer, p_lancamento jsonb, p_resultado jsonb, p_parecer text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_uid uuid := (select auth.uid());
  v_regra record;
  v_alt jsonb;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  perform private."FC_EXIGIR_GRAVAR_FICHA"(v_f, p_versao);
  select * into v_regra from private."FC_REGRA_VIGENTE_FICHA"(p_ficha);
  perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_regra.p_configuracao, p_lancamento);
  perform private."FC_VALIDAR_RESULTADO_FICHA"(v_regra.p_configuracao, p_lancamento, p_resultado,
                                                private."FC_DOCUMENTAL_DO_EDITAL"(v_f."CO_MONITORAMENTO"));
  if length(coalesce(p_parecer, '')) > 8000 then
    raise exception 'Parecer com até 8.000 caracteres.' using errcode = '22023';
  end if;
  v_alt := private."FC_ALTERACOES_FICHA"(v_regra.p_configuracao, v_f."DS_LANCAMENTO", v_f."DS_RESULTADO", p_lancamento, p_resultado);
  update public."TB_FICHA_ANALISE" set
    "DS_LANCAMENTO" = p_lancamento, "DS_RESULTADO" = p_resultado, "DS_PARECER" = nullif(btrim(coalesce(p_parecer, '')), ''),
    "CO_USUARIO_RASCUNHO" = v_uid, "DT_RASCUNHO" = now(),
    "DT_RESERVA_EXPIRA" = now() + private."FC_PRAZO_RESERVA_FICHA"(),
    "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
   where "CO_FICHA_ANALISE" = p_ficha;
  if jsonb_array_length(v_alt) > 0 then
    perform private."FC_HISTORICO_CONTEUDO_FICHA"(p_ficha, 'SALVAR', v_f."TP_SITUACAO", null, v_uid, v_alt,
      jsonb_build_object('lancamento', p_lancamento, 'resultado', p_resultado, 'versao_regra', v_regra.p_versao));
  end if;
  return json_build_object('versao', v_f."NU_VERSAO" + 1, 'salvo_em', now(), 'alteracoes', jsonb_array_length(v_alt),
                           'versao_regra', v_regra.p_versao);
end;
$function$;

CREATE OR REPLACE FUNCTION public.concluir_ficha(p_ficha uuid, p_versao integer, p_versao_regra integer, p_lancamento jsonb, p_resultado jsonb, p_parecer text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_uid uuid := (select auth.uid());
  v_regra record;
  v_alt jsonb;
  v_pend text[];
  v_parecer text := btrim(coalesce(p_parecer, ''));
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  perform private."FC_EXIGIR_GRAVAR_FICHA"(v_f, p_versao);
  select * into v_regra from private."FC_REGRA_VIGENTE_FICHA"(p_ficha);
  if p_versao_regra is distinct from v_regra.p_versao then
    raise exception 'A regra mudou (versão %): a ficha foi recalculada; confira e conclua de novo.', v_regra.p_versao using errcode = '40001';
  end if;
  if v_regra.p_situacao <> 'CONFERIDA' then
    raise exception 'A versão % da regra ainda não foi conferida pela coordenação: dá para salvar o rascunho, mas não concluir.', v_regra.p_versao
      using errcode = '22023';
  end if;
  perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_regra.p_configuracao, p_lancamento);
  perform private."FC_VALIDAR_RESULTADO_FICHA"(v_regra.p_configuracao, p_lancamento, p_resultado,
                                                private."FC_DOCUMENTAL_DO_EDITAL"(v_f."CO_MONITORAMENTO"));
  v_pend := private."FC_PENDENCIAS_FICHA"(v_regra.p_configuracao, p_lancamento, p_resultado);
  if cardinality(v_pend) > 0 then
    raise exception 'Falta para concluir: %.', array_to_string(v_pend[1:5], '; ') using errcode = '22023';
  end if;
  if length(v_parecer) not between 1 and 8000 then
    raise exception 'O parecer é obrigatório (até 8.000 caracteres).' using errcode = '22023';
  end if;
  v_alt := private."FC_ALTERACOES_FICHA"(v_regra.p_configuracao, v_f."DS_LANCAMENTO", v_f."DS_RESULTADO", p_lancamento, p_resultado);
  update public."TB_FICHA_ANALISE" set
    "TP_SITUACAO" = 'CONCLUIDA', "NU_VERSAO_REGRA" = v_regra.p_versao,
    "DS_LANCAMENTO" = p_lancamento, "DS_RESULTADO" = p_resultado, "DS_PARECER" = v_parecer,
    "TP_RESULTADO" = p_resultado ->> 'resultado',
    "VL_NOTA_APURADA" = (p_resultado ->> 'nota_apurada')::numeric, "VL_NOTA_FINAL" = (p_resultado ->> 'nota_final')::numeric,
    "CO_USUARIO_CONCLUSAO" = v_uid, "DT_CONCLUSAO" = now(),
    "CO_USUARIO_RASCUNHO" = v_uid, "DT_RASCUNHO" = now(),
    "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
    "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
   where "CO_FICHA_ANALISE" = p_ficha;
  perform private."FC_HISTORICO_CONTEUDO_FICHA"(p_ficha, 'CONCLUIR', v_f."TP_SITUACAO", null, v_uid, v_alt,
    jsonb_build_object('lancamento', p_lancamento, 'resultado', p_resultado, 'parecer', v_parecer, 'versao_regra', v_regra.p_versao));
  return json_build_object('versao', v_f."NU_VERSAO" + 1, 'resultado', p_resultado ->> 'resultado',
                           'nota_final', (p_resultado ->> 'nota_final')::numeric, 'versao_regra', v_regra.p_versao);
end;
$function$;

CREATE OR REPLACE FUNCTION public.obter_apoio_regra_analise(p_edital uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
  v_coordena boolean := coalesce(private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR', false);
  v_le_classificacao boolean := private.pode_recurso('classificacao', 1);
begin
  return json_build_object(
    'schema_version', 1,
    -- Só os nomes das colunas de pergunta, por vaga (nenhuma resposta de candidato).
    'perguntas_por_vaga', coalesce((
      select json_agg(json_build_object(
               'vaga', v."CO_VAGA",
               'cargo', (select s."NO_CARGO" from public."TB_SELECAO_VAGA" s
                          where s."CO_VAGA" = v."CO_VAGA" and s."NO_CARGO" is not null
                          order by s."CO_MONITORAMENTO" = p_edital desc limit 1),
               'colunas', coalesce((
                 select json_agg(c.coluna order by c.ordem)
                   from jsonb_array_elements_text(v."DS_COLUNA") with ordinality c(coluna, ordem)
                  where c.coluna ilike 'Pergunta %'), '[]'::json))
             order by v."CO_VAGA")
        from public."TB_EMPREGARE_VAGA" v
       where v."CO_MONITORAMENTO" = p_edital and v."TP_SITUACAO" = 'GRAVADA'), '[]'::json),
    'regras_da_area', case when v_coordena then coalesce((
      select json_agg(json_build_object(
               'id', m.id, 'edital', m.edital, 'numero', private."FC_NUMERO_EDITAL"(m.edital), 'unidade', m.unidade,
               'versao', r."NU_VERSAO_VIGENTE", 'nome', h."NO_VERSAO", 'conferida_em', r."DT_CONFERENCIA",
               'configuracao', h."DS_CONFIGURACAO")
             order by r."DT_CONFERENCIA" desc, m.edital)
        from public."TB_REGRA_ANALISE" r
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = r."CO_MONITORAMENTO"
        join public."TH_REGRA_ANALISE" h
          on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       where r."TP_SITUACAO" = 'CONFERIDA' and m."CO_AREA" = v_area and m.id <> p_edital
         and private."FC_PODE_VER_EDITAL"(m.id)), '[]'::json) else '[]'::json end,
    'classificacao', json_build_object(
      'pode_ler', v_le_classificacao,
      'pode_editar', v_le_classificacao and private.pode_recurso('classificacao', 2),
      'regra', case when v_le_classificacao then (
        select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'nome', h."NO_VERSAO", 'configuracao', h."DS_CONFIGURACAO",
                                 'atualizado_em', h."DT_CRIACAO", 'por', coalesce(p.nome, p.email))
          from public."TB_REGRA_CLASSIFICACAO" r
          join public."TH_REGRA_CLASSIFICACAO" h
            on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
          left join public."TB_PERFIL_USUARIO" p on p.user_id = h."CO_USUARIO"
         where r."CO_MONITORAMENTO" = p_edital) end)
  );
end;
$function$;

drop function if exists private."FC_VALIDAR_POR_CARGO_ANALISE"(jsonb);
drop function if exists private."FC_REGRA_DA_VAGA"(jsonb, text, text, text);
drop function if exists private."FC_BLOCO_DO_CARGO"(jsonb, jsonb, text);
drop function if exists private."FC_DIFERENCA_DA_VAGA"(jsonb, text, text);
drop function if exists private."FC_TEXTO_DO_CARGO"(text);

commit;
