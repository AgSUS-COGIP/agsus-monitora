/*
  ENSAIO de 20261007140000_declarada_por_nivel.sql — begin … rollback.

  PRÉ-REQUISITO: as migrations até 20261007130000 aplicadas; o corpo para se
  faltar.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela), o corpo da correção
  supabase/correcoes/20261007-declarada-experiencia-por-nivel.sql (duas vezes:
  é idempotente) e:
    E1  confere FC_JSON_MAPA_DECLARADA_OK (mapa bom, vazio, resposta vazia,
        número fora do limite, texto no lugar do número, não objeto);
    E2  confere a validação da regra: o modelo PROJ26-CURRICULAR com a
        experiência por nível passa; pontos por nível em FAIXA_EM_MESES, junto
        com pontos, com nível desconhecido, vazio ou com 101 pontos são
        recusados (22023); a regra sem pontos_por_nivel continua igual;
    E3  confere a leitura do job (pre_classificacao_ler_editais): cada vaga do
        93/2026 traz o cargo do quadro e o edital traz o documental da regra
        de classificação;
    E4  confere os modelos depois da correção: um item de experiência só, os
        pontos do técnico ("5 anos e 6 meses ou mais" = 40) e do superior
        ("4 anos ou mais" = 35) no PROJ26-CURRICULAR e, se o modelo existir, os
        pontos simples do PROJ26-RIO-DOCE.
  No fim, rollback: nada fica gravado.
*/
begin;

-- >>> corpo de supabase/migrations/20261007140000_declarada_por_nivel.sql
-- 0. Pré-requisito ----------------------------------------------------------------------
do $$
begin
  if to_regprocedure('private."FC_JSON_PERGUNTA_OK"(jsonb,boolean)') is null
     or to_regprocedure('private."FC_DOCUMENTAL_DO_EDITAL"(uuid)') is null then
    raise exception 'Aplique 20261007130000_conteudo_da_ficha.sql antes.';
  end if;
end;
$$;

-- 1. O mapa resposta → número -----------------------------------------------------------
create or replace function private."FC_JSON_MAPA_DECLARADA_OK"(p_mapa jsonb, p_maximo numeric)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select jsonb_typeof(p_mapa) is not distinct from 'object'
     and (select count(*) from jsonb_object_keys(p_mapa)) <= 50
     and not exists (select 1 from jsonb_each(p_mapa) r
                      where btrim(r.key) = '' or length(r.key) > 200
                         or not private."FC_JSON_NUMERO_OBRIGATORIO"(r.value, 0, p_maximo));
$function$;
comment on function private."FC_JSON_MAPA_DECLARADA_OK"(jsonb, numeric) is
  'O mapa resposta → número de um item da nota declarada (pontos, meses ou o mapa de um nível em pontos_por_nivel): objeto de até 50 respostas, cada uma com texto de 1 a 200 caracteres e número de 0 a p_maximo.';
revoke all on function private."FC_JSON_MAPA_DECLARADA_OK"(jsonb, numeric) from public, anon, authenticated;

-- 2. Validação da regra: pontos por nível na nota declarada ------------------------------
create or replace function private."FC_VALIDAR_REGRA_ANALISE"(p_regra jsonb)
returns void
language plpgsql
stable
set search_path to ''
as $function$
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
comment on function private."FC_VALIDAR_REGRA_ANALISE"(jsonb) is
  'Confere a configuração de uma regra da avaliação documental (22023 com a mensagem do primeiro erro). As mesmas regras de validarRegraAnalise() em src/lib/avaliacao-documental/regra.js; o lote aceita a base NOTA_MINIMA (com nota_minima e item_edital) desde 20261006120500; a pergunta da nota declarada pode ser uma lista de alternativas desde 20261007100000; o item da nota declarada pode ter pontos_por_nivel (OPCAO e OPCOES_SOMADAS) desde 20261007140000.';
revoke all on function private."FC_VALIDAR_REGRA_ANALISE"(jsonb) from public, anon, authenticated;


-- 3. Leitura do job: o cargo da vaga e a regra de classificação do edital ----------------
create or replace function public.pre_classificacao_ler_editais(p_editais text[] default null, p_apos_robo boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_pedidos text[] := array(select btrim(x) from unnest(coalesce(p_editais, '{}')) x where btrim(x) <> '');
  v_ids uuid[];
  v_sync text;
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
     where v."CO_SYNC" = v_sync and v."CO_MONITORAMENTO" is not null;
  else
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
     where coalesce(m.ativo, false);
  end if;

  return jsonb_build_object(
    'hoje', (now() at time zone 'America/Sao_Paulo')::date,
    'sync', v_sync,
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
               'regra', (select jsonb_build_object('versao', r."NU_VERSAO_VIGENTE", 'situacao', r."TP_SITUACAO",
                                                   'configuracao', h."DS_CONFIGURACAO")
                           from public."TB_REGRA_ANALISE" r
                           join public."TH_REGRA_ANALISE" h
                             on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
                          where r."CO_MONITORAMENTO" = m.id),
               'documental', private."FC_DOCUMENTAL_DO_EDITAL"(m.id),
               'refazer_permitido', not exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                                                 where a."CO_MONITORAMENTO" = m.id and a."TP_SITUACAO" = 'ANALISADO'),
               'vagas', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'codigo', v."CO_VAGA",
                          'cargo', q."NO_CARGO",
                          'situacao_carga', v."TP_SITUACAO",
                          'candidatos_ativos', v."QT_CANDIDATO_ATIVO",
                          'ultima_carga', v."DT_ULTIMA_CARGA",
                          'ultimo_lote', coalesce(pv."NU_ULTIMO_LOTE", 0),
                          'quadro', case when q."CO_QUADRO_VAGA" is null then null else jsonb_build_object(
                            'id', q."CO_QUADRO_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
                            'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S', 'modalidades', q."DS_MODALIDADE_VAGA") end)
                        order by v."CO_VAGA")
                   from public."TB_EMPREGARE_VAGA" v
                   left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = m.id and pv."CO_VAGA" = v."CO_VAGA"
                   left join lateral (select * from private."FC_QUADRO_DA_VAGA_EMPREGARE"(m.id, v."CO_VAGA")) q on true
                  where v."CO_MONITORAMENTO" = m.id), '[]'::jsonb))
             order by private."FC_ROTULO_DO_EDITAL"(m.edital), m.id)
        from public."TB_MONITORAMENTO_INDIGENA" m
       where m.id = any (v_ids)), '[]'::jsonb)
  );
end;
$function$;
comment on function public.pre_classificacao_ler_editais(text[], boolean) is
  'Pré-classificação (job Python): os editais a processar — os pedidos (id, número ou nome), os da última carga fechada do robô (p_apos_robo) ou, sem filtro, os ativos com vagas da Empregare — com a regra vigente (versão, situação e configuração), o que a regra de classificação diz do nível da vaga e da nota mínima (FC_DOCUMENTAL_DO_EDITAL, desde 20261007140000), se o lote ainda pode ser refeito e as vagas (cargo do quadro, carga, último lote, linha do quadro com vagas imediatas, cadastro reserva e modalidades). Sem dado pessoal. Só service_role.';
-- <<< fim do corpo da migration

-- >>> corpo de supabase/correcoes/20261007-declarada-experiencia-por-nivel.sql (1ª vez)
update public."TB_REGRA_ANALISE_MODELO" m
   set "DS_CONFIGURACAO" = jsonb_set(m."DS_CONFIGURACAO", '{provisoria,nota_declarada}',
         coalesce((select jsonb_agg(d order by o)
                     from jsonb_array_elements(case when jsonb_typeof(m."DS_CONFIGURACAO" #> '{provisoria,nota_declarada}') = 'array'
                                                    then m."DS_CONFIGURACAO" #> '{provisoria,nota_declarada}' else '[]'::jsonb end)
                          with ordinality t(d, o)
                    where d ->> 'parcial' is distinct from 'EXPERIENCIA'), '[]'::jsonb) || jsonb_build_array(i.item)),
       "DT_ATUALIZACAO" = now()
  from (values
    ('PROJ26-CURRICULAR', $item${"parcial":"EXPERIENCIA","pergunta":"Experiência Profissional","tipo":"OPCAO","pontos_por_nivel":{"superior":{"6 meses obrigatórios":0,"1 ano":5,"1 ano e 6 meses":10,"1 anos e 6 meses":10,"2 anos":15,"2 anos e 6 meses":20,"3 anos":25,"3 anos e 6 meses":30,"4 anos ou mais":35},"tecnico":{"6 meses obrigatórios":0,"1 ano":4,"1 ano e 6 meses":8,"1 anos e 6 meses":8,"2 anos":12,"2 anos e 6 meses":16,"3 anos":20,"3 anos e 6 meses":24,"4 anos":28,"4 anos e 6 meses":32,"5 anos":36,"5 anos e 6 meses ou mais":40},"medio":{"6 meses obrigatórios":0,"1 ano":4,"1 ano e 6 meses":8,"1 anos e 6 meses":8,"2 anos":12,"2 anos e 6 meses":16,"3 anos":20,"3 anos e 6 meses":24,"4 anos":28,"4 anos e 6 meses":32,"5 anos":36,"5 anos e 6 meses ou mais":40}}}$item$::jsonb),
    ('PROJ26-RIO-DOCE', $item${"parcial":"EXPERIENCIA","pergunta":"Experiência Profissional","tipo":"OPCAO","pontos":{"6 meses obrigatórios":0,"1 ano":5,"1 ano e 6 meses":10,"1 anos e 6 meses":10,"2 anos":15,"2 anos e 6 meses":20,"3 anos":25,"3 anos e 6 meses":30,"4 anos ou mais":35}}$item$::jsonb)
  ) as i(codigo, item)
 where m."CO_MODELO" = i.codigo
   and not coalesce(m."DS_CONFIGURACAO" #> '{provisoria,nota_declarada}', '[]'::jsonb) @> jsonb_build_array(i.item);

do $$
declare
  v_modelo record;
begin
  for v_modelo in
    select * from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" in ('PROJ26-CURRICULAR', 'PROJ26-RIO-DOCE')
  loop
    perform private."FC_VALIDAR_REGRA_ANALISE"(v_modelo."DS_CONFIGURACAO");
    if (select count(*) from jsonb_array_elements(v_modelo."DS_CONFIGURACAO" #> '{provisoria,nota_declarada}') d
         where d ->> 'parcial' = 'EXPERIENCIA') <> 1 then
      raise exception 'Modelo %: a nota declarada deveria ter um item de experiência.', v_modelo."CO_MODELO";
    end if;
  end loop;
end;
$$;

select "CO_MODELO",
       jsonb_path_query_array("DS_CONFIGURACAO", '$.provisoria.nota_declarada[*].parcial') as parciais,
       "DS_CONFIGURACAO" #> '{provisoria,nota_declarada}' -> -1 as experiencia
  from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" in ('PROJ26-CURRICULAR', 'PROJ26-RIO-DOCE') order by 1;
-- >>> de novo (idempotente: continua um item de experiência só)
update public."TB_REGRA_ANALISE_MODELO" m
   set "DS_CONFIGURACAO" = jsonb_set(m."DS_CONFIGURACAO", '{provisoria,nota_declarada}',
         coalesce((select jsonb_agg(d order by o)
                     from jsonb_array_elements(case when jsonb_typeof(m."DS_CONFIGURACAO" #> '{provisoria,nota_declarada}') = 'array'
                                                    then m."DS_CONFIGURACAO" #> '{provisoria,nota_declarada}' else '[]'::jsonb end)
                          with ordinality t(d, o)
                    where d ->> 'parcial' is distinct from 'EXPERIENCIA'), '[]'::jsonb) || jsonb_build_array(i.item)),
       "DT_ATUALIZACAO" = now()
  from (values
    ('PROJ26-CURRICULAR', $item${"parcial":"EXPERIENCIA","pergunta":"Experiência Profissional","tipo":"OPCAO","pontos_por_nivel":{"superior":{"6 meses obrigatórios":0,"1 ano":5,"1 ano e 6 meses":10,"1 anos e 6 meses":10,"2 anos":15,"2 anos e 6 meses":20,"3 anos":25,"3 anos e 6 meses":30,"4 anos ou mais":35},"tecnico":{"6 meses obrigatórios":0,"1 ano":4,"1 ano e 6 meses":8,"1 anos e 6 meses":8,"2 anos":12,"2 anos e 6 meses":16,"3 anos":20,"3 anos e 6 meses":24,"4 anos":28,"4 anos e 6 meses":32,"5 anos":36,"5 anos e 6 meses ou mais":40},"medio":{"6 meses obrigatórios":0,"1 ano":4,"1 ano e 6 meses":8,"1 anos e 6 meses":8,"2 anos":12,"2 anos e 6 meses":16,"3 anos":20,"3 anos e 6 meses":24,"4 anos":28,"4 anos e 6 meses":32,"5 anos":36,"5 anos e 6 meses ou mais":40}}}$item$::jsonb),
    ('PROJ26-RIO-DOCE', $item${"parcial":"EXPERIENCIA","pergunta":"Experiência Profissional","tipo":"OPCAO","pontos":{"6 meses obrigatórios":0,"1 ano":5,"1 ano e 6 meses":10,"1 anos e 6 meses":10,"2 anos":15,"2 anos e 6 meses":20,"3 anos":25,"3 anos e 6 meses":30,"4 anos ou mais":35}}$item$::jsonb)
  ) as i(codigo, item)
 where m."CO_MODELO" = i.codigo
   and not coalesce(m."DS_CONFIGURACAO" #> '{provisoria,nota_declarada}', '[]'::jsonb) @> jsonb_build_array(i.item);

do $$
declare
  v_modelo record;
begin
  for v_modelo in
    select * from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" in ('PROJ26-CURRICULAR', 'PROJ26-RIO-DOCE')
  loop
    perform private."FC_VALIDAR_REGRA_ANALISE"(v_modelo."DS_CONFIGURACAO");
    if (select count(*) from jsonb_array_elements(v_modelo."DS_CONFIGURACAO" #> '{provisoria,nota_declarada}') d
         where d ->> 'parcial' = 'EXPERIENCIA') <> 1 then
      raise exception 'Modelo %: a nota declarada deveria ter um item de experiência.', v_modelo."CO_MODELO";
    end if;
  end loop;
end;
$$;

select "CO_MODELO",
       jsonb_path_query_array("DS_CONFIGURACAO", '$.provisoria.nota_declarada[*].parcial') as parciais,
       "DS_CONFIGURACAO" #> '{provisoria,nota_declarada}' -> -1 as experiencia
  from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" in ('PROJ26-CURRICULAR', 'PROJ26-RIO-DOCE') order by 1;
-- <<< fim da correção

-- E1. O mapa resposta → número.
do $$
begin
  if not private."FC_JSON_MAPA_DECLARADA_OK"('{"1 ano": 5, "2 anos": 15}', 100) then raise exception 'FALHOU E1: mapa bom recusado'; end if;
  if not private."FC_JSON_MAPA_DECLARADA_OK"('{}', 100) then raise exception 'FALHOU E1: mapa vazio recusado'; end if;
  if private."FC_JSON_MAPA_DECLARADA_OK"('{" ": 1}', 100) then raise exception 'FALHOU E1: resposta vazia aceita'; end if;
  if private."FC_JSON_MAPA_DECLARADA_OK"('{"a": 101}', 100) then raise exception 'FALHOU E1: 101 aceito'; end if;
  if not private."FC_JSON_MAPA_DECLARADA_OK"('{"a": 1200}', 1200) then raise exception 'FALHOU E1: 1200 meses recusado'; end if;
  if private."FC_JSON_MAPA_DECLARADA_OK"('{"a": "5"}', 100) then raise exception 'FALHOU E1: texto aceito'; end if;
  if private."FC_JSON_MAPA_DECLARADA_OK"('[1]', 100) or private."FC_JSON_MAPA_DECLARADA_OK"(null, 100) then raise exception 'FALHOU E1: não objeto aceito'; end if;
  raise notice 'E1 ok';
end;
$$;

-- E2. A validação da regra.
do $$
declare
  v_regra jsonb := (select "DS_CONFIGURACAO" from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" = 'PROJ26-CURRICULAR');
  v_exp jsonb;
  v_ruins jsonb[];
  v_ruim jsonb;
  v_n integer;
begin
  if v_regra is null then raise exception 'FALHOU E2: sem o modelo PROJ26-CURRICULAR'; end if;
  perform private."FC_VALIDAR_REGRA_ANALISE"(v_regra);
  select d, o::integer - 1 into v_exp, v_n
    from jsonb_array_elements(v_regra #> '{provisoria,nota_declarada}') with ordinality t(d, o)
   where d ->> 'parcial' = 'EXPERIENCIA';
  -- OPCOES_SOMADAS também aceita pontos por nível.
  perform private."FC_VALIDAR_REGRA_ANALISE"(jsonb_set(v_regra, array['provisoria', 'nota_declarada', v_n::text, 'tipo'], '"OPCOES_SOMADAS"'));
  v_ruins := array[
    v_exp || '{"tipo": "FAIXA_EM_MESES", "meses": {"1 ano": 12}, "pontos_por_mes": 1}',
    v_exp || '{"pontos": {"1 ano": 5}}',
    v_exp || '{"pontos_por_nivel": {"doutor": {"1 ano": 5}}}',
    v_exp || '{"pontos_por_nivel": {}}',
    v_exp || '{"pontos_por_nivel": {"superior": {"1 ano": 101}}}',
    v_exp || '{"pontos_por_nivel": {"superior": []}}',
    v_exp || '{"pontos_por_nivel": []}'
  ];
  foreach v_ruim in array v_ruins loop
    begin
      perform private."FC_VALIDAR_REGRA_ANALISE"(jsonb_set(v_regra, array['provisoria', 'nota_declarada', v_n::text], v_ruim));
      raise exception 'FALHOU E2: aceitou %', v_ruim -> 'pontos_por_nivel';
    exception when sqlstate '22023' then null;
    end;
  end loop;
  -- Sem pontos_por_nivel, o de sempre: pontos obrigatórios.
  begin
    perform private."FC_VALIDAR_REGRA_ANALISE"(jsonb_set(v_regra, array['provisoria', 'nota_declarada', v_n::text], v_exp - 'pontos_por_nivel'));
    raise exception 'FALHOU E2: item sem pontos aceito';
  exception when sqlstate '22023' then null;
  end;
  perform private."FC_VALIDAR_REGRA_ANALISE"(jsonb_set(v_regra, array['provisoria', 'nota_declarada', v_n::text],
    (v_exp - 'pontos_por_nivel') || jsonb_build_object('pontos', v_exp #> '{pontos_por_nivel,superior}')));
  raise notice 'E2 ok';
end;
$$;

-- E3. A leitura do job: o cargo de cada vaga e o documental do edital.
do $$
declare
  v_lido jsonb := public.pre_classificacao_ler_editais(array['93/2026'], false);
  v_edital jsonb := v_lido -> 'editais' -> 0;
begin
  if v_edital is null then raise exception 'FALHOU E3: o 93/2026 não veio'; end if;
  if jsonb_typeof(v_edital -> 'documental') <> 'object' or not (v_edital -> 'documental') ? 'niveis_por_cargo' then
    raise exception 'FALHOU E3: sem o documental da regra de classificação';
  end if;
  if exists (select 1 from jsonb_array_elements(v_edital -> 'vagas') v where not v ? 'cargo') then
    raise exception 'FALHOU E3: vaga sem o cargo';
  end if;
  if not exists (select 1 from jsonb_array_elements(v_edital -> 'vagas') v where v ->> 'cargo' ilike 'T_CNICO DE ENFERMAGEM%') then
    raise exception 'FALHOU E3: a vaga de técnico de enfermagem não trouxe o cargo';
  end if;
  raise notice 'E3 ok: % vaga(s)', jsonb_array_length(v_edital -> 'vagas');
end;
$$;

-- E4. Os modelos depois da correção.
do $$
declare
  v_cur jsonb := (select "DS_CONFIGURACAO" from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" = 'PROJ26-CURRICULAR');
  v_rio jsonb := (select "DS_CONFIGURACAO" from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" = 'PROJ26-RIO-DOCE');
  v_exp jsonb;
begin
  select d into v_exp from jsonb_array_elements(v_cur #> '{provisoria,nota_declarada}') d where d ->> 'parcial' = 'EXPERIENCIA';
  if (v_exp #>> '{pontos_por_nivel,tecnico,5 anos e 6 meses ou mais}')::numeric is distinct from 40
     or (v_exp #>> '{pontos_por_nivel,medio,1 ano}')::numeric is distinct from 4
     or (v_exp #>> '{pontos_por_nivel,superior,4 anos ou mais}')::numeric is distinct from 35
     or (v_exp #>> '{pontos_por_nivel,superior,1 anos e 6 meses}')::numeric is distinct from 10 then
    raise exception 'FALHOU E4: pontos da experiência do PROJ26-CURRICULAR';
  end if;
  if not exists (select 1 from jsonb_array_elements(v_cur #> '{provisoria,nota_declarada}') d where d ->> 'parcial' = 'CURSOS') then
    raise exception 'FALHOU E4: a correção apagou os cursos da nota declarada';
  end if;
  if v_rio is not null then
    select d into v_exp from jsonb_array_elements(v_rio #> '{provisoria,nota_declarada}') d where d ->> 'parcial' = 'EXPERIENCIA';
    if (v_exp #>> '{pontos,4 anos ou mais}')::numeric is distinct from 35 or v_exp ? 'pontos_por_nivel' then
      raise exception 'FALHOU E4: pontos da experiência do PROJ26-RIO-DOCE';
    end if;
  end if;
  raise notice 'E4 ok (PROJ26-RIO-DOCE %)', case when v_rio is null then 'ausente' else 'conferido' end;
end;
$$;

select 'ENSAIO OK' as resultado,
       (select jsonb_path_query_array("DS_CONFIGURACAO", '$.provisoria.nota_declarada[*].parcial')
          from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" = 'PROJ26-CURRICULAR') as curricular,
       (select jsonb_path_query_array("DS_CONFIGURACAO", '$.provisoria.nota_declarada[*].parcial')
          from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" = 'PROJ26-RIO-DOCE') as rio_doce,
       (select jsonb_agg(jsonb_build_object('vaga', v ->> 'codigo', 'cargo', v ->> 'cargo'))
          from jsonb_array_elements(public.pre_classificacao_ler_editais(array['93/2026'], false) #> '{editais,0,vagas}') v) as vagas_93;

rollback;
