/*
  ENSAIO de 20261006120500_lote_por_nota_minima.sql — begin … rollback.

  PRÉ-REQUISITO: as migrations até 20261006120000 aplicadas; o corpo para se
  faltar o gatilho da F2.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e:
    E1  confere a validação da regra com a base NOTA_MINIMA (com nota e item,
        sem nota, item longo, base desconhecida, múltiplo das vagas);
    E2  confere o gatilho da F2 com EXPERIENCIA_DECLARADA (sem a pergunta e
        repetido são recusados) e aplica a correção do modelo PROJ26-CURRICULAR,
        que precisa continuar válido;
    E3  lê os editais como o administrador global (papel authenticated) e
        confere o status de cada um (o seletor mostra só os vigentes).
  Termina em ROLLBACK: nada fica gravado.

  Resultado esperado: "ok E1" … "ok E3" e a linha "ENSAIO OK".

  Mantenha em sincronia: tests/fichas-fila-reserva-migration.test.js confere
  que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('private."FC_TG_REGRA_ANALISE_F2"()') is null then
    raise exception 'Aplique antes 20261006110000_pre_classificacao_e_lote.sql.';
  end if;
end;
$$;

-- 1. Validação da regra: a base NOTA_MINIMA ------------------------------------------------
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
    if not private."FC_JSON_TEXTO_OK"(v_item.value -> 'pergunta', true, 200) then
      raise exception 'Nota declarada % (pergunta): obrigatória, até 200 caracteres.', v_item.ordinality using errcode = '22023';
    end if;
    v_tipo := v_item.value ->> 'tipo';
    if v_tipo is null or v_tipo not in ('OPCAO', 'OPCOES_SOMADAS', 'FAIXA_EM_MESES') then
      raise exception 'Nota declarada %: tipo OPCAO, OPCOES_SOMADAS ou FAIXA_EM_MESES.', v_item.ordinality using errcode = '22023';
    end if;
    v_mapa := case when v_tipo = 'FAIXA_EM_MESES' then v_item.value -> 'meses' else v_item.value -> 'pontos' end;
    if jsonb_typeof(v_mapa) is distinct from 'object'
       or (select count(*) from jsonb_object_keys(v_mapa)) > 50
       or exists (select 1 from jsonb_each(v_mapa) r
                   where btrim(r.key) = '' or length(r.key) > 200
                      or not private."FC_JSON_NUMERO_OBRIGATORIO"(r.value, 0, case when v_tipo = 'FAIXA_EM_MESES' then 1200 else 100 end)) then
      raise exception 'Nota declarada %: % de cada resposta (até 50 respostas).', v_item.ordinality,
        case when v_tipo = 'FAIXA_EM_MESES' then 'meses (0 a 1200)' else 'pontos (0 a 100)' end using errcode = '22023';
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
  'Confere a configuração de uma regra da avaliação documental (22023 com a mensagem do primeiro erro). As mesmas regras de validarRegraAnalise() em src/lib/avaliacao-documental/regra.js; o lote aceita a base NOTA_MINIMA (com nota_minima e item_edital) desde 20261006120500.';
revoke all on function private."FC_VALIDAR_REGRA_ANALISE"(jsonb) from public, anon, authenticated;

-- 2. Gatilho da F2: desempate pela experiência declarada ------------------------------------
create or replace function private."FC_TG_REGRA_ANALISE_F2"()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_desempate jsonb := new."DS_CONFIGURACAO" -> 'provisoria' -> 'desempate';
  v_pergunta jsonb := new."DS_CONFIGURACAO" -> 'provisoria' -> 'pergunta_experiencia';
  v_por_vaga jsonb := new."DS_CONFIGURACAO" -> 'lote' -> 'por_vaga';
begin
  if v_desempate is not null and jsonb_typeof(v_desempate) <> 'null' then
    if jsonb_typeof(v_desempate) <> 'array' or jsonb_array_length(v_desempate) > 5
       or exists (select 1 from jsonb_array_elements(v_desempate) d
                   where jsonb_typeof(d) <> 'string'
                      or d #>> '{}' not in ('IDOSO', 'EXPERIENCIA_DECLARADA', 'MAIOR_IDADE', 'MAIS_VELHO', 'CANDIDATURA'))
       or (select count(distinct d #>> '{}') from jsonb_array_elements(v_desempate) d) <> jsonb_array_length(v_desempate) then
      raise exception 'Desempate da Provisória: IDOSO, EXPERIENCIA_DECLARADA, MAIOR_IDADE, MAIS_VELHO ou CANDIDATURA, sem repetir.' using errcode = '22023';
    end if;
  end if;
  if not private."FC_JSON_TEXTO_OK"(v_pergunta, false, 200) then
    raise exception 'Pergunta da experiência declarada: texto de até 200 caracteres.' using errcode = '22023';
  end if;
  if v_desempate @> '["EXPERIENCIA_DECLARADA"]'::jsonb and not private."FC_JSON_TEXTO_OK"(v_pergunta, true, 200) then
    raise exception 'Desempate pela experiência declarada: informe a pergunta da experiência.' using errcode = '22023';
  end if;
  if v_por_vaga is not null and jsonb_typeof(v_por_vaga) <> 'null' then
    if jsonb_typeof(v_por_vaga) <> 'object'
       or (select count(*) from jsonb_object_keys(v_por_vaga)) > 500
       or exists (select 1 from jsonb_each(v_por_vaga) p
                   where p.key !~ '^[0-9]{1,20}$'
                      or case when jsonb_typeof(p.value) <> 'number' then true
                              else (p.value #>> '{}')::numeric <> trunc((p.value #>> '{}')::numeric)
                                   or (p.value #>> '{}')::numeric not between 1 and 100000 end) then
      raise exception 'Lote por vaga: código da vaga (só dígitos) e tamanho inteiro de 1 a 100.000.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$function$;
comment on function private."FC_TG_REGRA_ANALISE_F2"() is
  'Gatilho de TH_REGRA_ANALISE: confere os campos que FC_VALIDAR_REGRA_ANALISE não conhece — provisoria.desempate (IDOSO, EXPERIENCIA_DECLARADA, MAIOR_IDADE — o mesmo que MAIS_VELHO —, MAIS_VELHO, CANDIDATURA, sem repetir), provisoria.pergunta_experiencia (texto até 200, obrigatório com EXPERIENCIA_DECLARADA) e lote.por_vaga (código da vaga → tamanho inteiro de 1 a 100.000). 22023 com a mensagem do formulário.';
revoke all on function private."FC_TG_REGRA_ANALISE_F2"() from public, anon, authenticated;

-- 3. Os editais da Avaliação documental com o status (a tela mostra os vigentes) -------------
create or replace function public.listar_editais_avaliacao(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_editais uuid[];
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('avaliacao_documental', 1) then
    raise exception 'Sem permissão para a Avaliação documental' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return json_build_object(
    'area', p_area,
    'nivel', private.nivel_recurso('avaliacao_documental'),
    'editais', coalesce((
      select json_agg(json_build_object(
               'id', m.id, 'edital', m.edital, 'unidade', m.unidade, 'ativo', m.ativo, 'status', m.status,
               'numero', private."FC_NUMERO_EDITAL"(m.edital),
               'versao_regra', r."NU_VERSAO_VIGENTE", 'situacao_regra', r."TP_SITUACAO",
               'origem', coalesce(o."TP_ORIGEM", 'PLANILHA'),
               'papel', private."FC_PAPEL_AVALIACAO"(m.id))
             order by m.ativo desc, r."NU_VERSAO_VIGENTE" is null, m.edital)
        from public."TB_MONITORAMENTO_INDIGENA" m
        left join public."TB_REGRA_ANALISE" r on r."CO_MONITORAMENTO" = m.id
        left join public."TB_ORIGEM_ANALISE_EDITAL" o on o."CO_MONITORAMENTO" = m.id
       where m."CO_AREA" = p_area and (v_editais is null or m.id = any (v_editais))), '[]'::json)
  );
end;
$function$;
comment on function public.listar_editais_avaliacao(text) is
  'Editais da área para a Avaliação documental (json): status do edital (a tela mostra só os vigentes, src/lib/avaliacao-documental/editais.js), versão e situação da regra, dono da avaliação (PLANILHA, COMPARACAO, MONITORA) e o papel de quem está logado. Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';

-- ═══ CORPO DA MIGRATION (fim) ═══

-- E1. A validação aceita a base NOTA_MINIMA e recusa o que falta.
do $$
declare
  v_base jsonb;
begin
  select m."DS_CONFIGURACAO" into v_base from public."TB_REGRA_ANALISE_MODELO" m where m."CO_MODELO" = 'PROJ26-CURRICULAR';
  if v_base is null then raise exception 'ENSAIO: modelo PROJ26-CURRICULAR ausente'; end if;
  perform private."FC_VALIDAR_REGRA_ANALISE"(v_base || jsonb_build_object('lote', (v_base -> 'lote')
    || '{"base":"NOTA_MINIMA","nota_minima":15,"item_edital":"8.2.6"}'::jsonb));
  begin
    perform private."FC_VALIDAR_REGRA_ANALISE"(v_base || jsonb_build_object('lote', (v_base -> 'lote') || '{"base":"NOTA_MINIMA","nota_minima":null}'::jsonb));
    raise exception 'FALHOU E1: aceitou NOTA_MINIMA sem a nota';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform private."FC_VALIDAR_REGRA_ANALISE"(v_base || jsonb_build_object('lote', (v_base -> 'lote')
      || jsonb_build_object('base', 'NOTA_MINIMA', 'nota_minima', 15, 'item_edital', repeat('x', 41))));
    raise exception 'FALHOU E1: aceitou item do edital longo';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform private."FC_VALIDAR_REGRA_ANALISE"(v_base || jsonb_build_object('lote', (v_base -> 'lote') || '{"base":"SORTEIO"}'::jsonb));
    raise exception 'FALHOU E1: aceitou base desconhecida';
  exception when sqlstate '22023' then null;
  end;
  perform private."FC_VALIDAR_REGRA_ANALISE"(v_base || jsonb_build_object('lote', (v_base -> 'lote') || '{"base":"MULTIPLO_VAGAS","multiplo":3}'::jsonb));
  raise notice 'ok E1: NOTA_MINIMA com nota e item válida; sem nota, item longo e base desconhecida recusados; múltiplo continua valendo';
end;
$$;

-- E2. O gatilho da F2 aceita EXPERIENCIA_DECLARADA (com a pergunta) e o modelo corrigido vale.
do $$
declare
  v_edital uuid;
  v_regra uuid;
  v_config jsonb;
begin
  select m.id into v_edital from public."TB_MONITORAMENTO_INDIGENA" m
   where not exists (select 1 from public."TB_REGRA_ANALISE" r where r."CO_MONITORAMENTO" = m.id)
   order by m.edital limit 1;
  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-00000000f3b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.f3b.admin@ensaio.invalid');
  insert into public."TB_REGRA_ANALISE" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
  values (v_edital, 1, '00000000-0000-4000-a000-00000000f3b1') returning "CO_REGRA_ANALISE" into v_regra;
  begin
    insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO")
    values (v_regra, 1, '{"provisoria":{"desempate":["IDOSO","EXPERIENCIA_DECLARADA"]}}', repeat('a', 64), null, '00000000-0000-4000-a000-00000000f3b1');
    raise exception 'FALHOU E2: experiência declarada sem a pergunta';
  exception when sqlstate '22023' then null;
  end;
  begin
    insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO")
    values (v_regra, 1, '{"provisoria":{"desempate":["IDOSO","IDOSO"]}}', repeat('a', 64), null, '00000000-0000-4000-a000-00000000f3b1');
    raise exception 'FALHOU E2: desempate repetido';
  exception when sqlstate '22023' then null;
  end;
  insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO")
  values (v_regra, 1, '{"provisoria":{"desempate":["IDOSO","EXPERIENCIA_DECLARADA","MAIOR_IDADE"],"pergunta_experiencia":"Pergunta 17 -"}}',
          repeat('a', 64), null, '00000000-0000-4000-a000-00000000f3b1');

  -- A correção do modelo (supabase/correcoes/20261006-modelo-proj26-nota-minima.sql), aqui dentro.
  update public."TB_REGRA_ANALISE_MODELO"
     set "NO_MODELO" = 'Projetos — análise curricular do 93/2026 (sem critério étnico)',
         "DS_CONFIGURACAO" = "DS_CONFIGURACAO"
           || jsonb_build_object(
                'lote', ("DS_CONFIGURACAO" -> 'lote')
                        || '{"base":"NOTA_MINIMA","nota_minima":15,"item_edital":"8.2.6","publica_reposicao":false}'::jsonb,
                'provisoria', ("DS_CONFIGURACAO" -> 'provisoria')
                        || '{"desempate":["IDOSO","EXPERIENCIA_DECLARADA","MAIOR_IDADE"],"pergunta_experiencia":"Pergunta 17 -"}'::jsonb,
                -- As cotas PI e PQ (itens 5.7.5 e 5.7.6) logo depois da de PcD; a de PP fica como está.
                'blocos', (select jsonb_agg(x.b order by x.ordem)
                             from (select b, o::numeric as ordem
                                     from jsonb_array_elements("DS_CONFIGURACAO" -> 'blocos') with ordinality t(b, o)
                                    where b ->> 'codigo' not in ('COTA_PI', 'COTA_PQ')
                                   union all
                                   select n.b, coalesce((select o from jsonb_array_elements("DS_CONFIGURACAO" -> 'blocos') with ordinality t(b, o)
                                                          where b ->> 'codigo' = 'COTA_PCD'), 1000) + n.o / 10.0
                                     from jsonb_array_elements($cotas$[{"codigo":"COTA_PI","titulo":"Indígenas (documento de pertencimento étnico, Anexo VI)","item_edital":"5.7.5","tipo":"COTA","condicao":"MODALIDADE=PI","perguntas":[],"efeitos":{"CONFORME":"SO_REGISTRO","NAO_CONFORME":"SEGUE_AMPLA","NAO_ENVIADO":"SEGUE_AMPLA"},"motivos":[{"codigo":"SEM_LIDERANCA","texto":"Documento de pertencimento étnico sem a assinatura da liderança local (Anexo VI).","item_edital":"5.7.5","efeito":"SEGUE_AMPLA"},{"codigo":"FORA_DO_MODELO","texto":"Documento de pertencimento étnico fora do modelo do Anexo VI.","item_edital":"5.7.5","efeito":"SEGUE_AMPLA"}]},{"codigo":"COTA_PQ","titulo":"Quilombolas (declaração de pertencimento, Anexo VII, ou certificado da FCP)","item_edital":"5.7.6","tipo":"COTA","condicao":"MODALIDADE=PQ","perguntas":[],"efeitos":{"CONFORME":"SO_REGISTRO","NAO_CONFORME":"SEGUE_AMPLA","NAO_ENVIADO":"SEGUE_AMPLA"},"motivos":[{"codigo":"SEM_LIDERANCA","texto":"Declaração de pertencimento sem a assinatura da liderança ou associação local (Anexo VII).","item_edital":"5.7.6","efeito":"SEGUE_AMPLA"},{"codigo":"FORA_DO_MODELO","texto":"Declaração fora do modelo do Anexo VII e sem certificado da Fundação Cultural Palmares.","item_edital":"5.7.6","efeito":"SEGUE_AMPLA"}]}]$cotas$::jsonb) with ordinality n(b, o)) x)),
         "DT_ATUALIZACAO" = now()
   where "CO_MODELO" = 'PROJ26-CURRICULAR';
  select "DS_CONFIGURACAO" into v_config from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" = 'PROJ26-CURRICULAR';
  perform private."FC_VALIDAR_REGRA_ANALISE"(v_config);
  insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO")
  values (v_regra, 2, v_config, encode(sha256(convert_to(v_config::text, 'UTF8')), 'hex'), 'Modelo corrigido no ensaio', '00000000-0000-4000-a000-00000000f3b1');
  if v_config -> 'lote' ->> 'base' <> 'NOTA_MINIMA' or (v_config -> 'lote' ->> 'nota_minima')::numeric <> 15
     or (select count(*) from jsonb_array_elements(v_config -> 'blocos') b where b ->> 'codigo' in ('COTA_PI', 'COTA_PQ')) <> 2
     or (select string_agg(b ->> 'codigo', ',' order by o) from jsonb_array_elements(v_config -> 'blocos') with ordinality t(b, o)
          where b ->> 'tipo' = 'COTA') <> 'COTA_PP,COTA_PCD,COTA_PI,COTA_PQ' then
    raise exception 'FALHOU E2: modelo corrigido %', v_config -> 'lote';
  end if;
  raise notice 'ok E2: o gatilho exige a pergunta da experiência e recusa repetição; o modelo PROJ26 corrigido (nota mínima 15, item 8.2.6) é válido e grava como versão';
end;
$$;

-- E3. O seletor recebe o status dos editais.
do $$
declare
  v_admin text;
  v_area text;
begin
  select g."CO_GRUPO_ACESSO" into v_admin from public."TB_GRUPO_ACESSO" g where g."ST_ADMIN_GLOBAL" order by g."CO_GRUPO_ACESSO" = 'admin' desc limit 1;
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo)
  values ('00000000-0000-4000-a000-00000000f3b1', 'ensaio.f3b.admin@ensaio.invalid', 'Ensaio F3b Admin', v_admin, true);
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m."CO_AREA" is not null
   order by m."CO_AREA" = 'projetos' desc limit 1;
  perform set_config('ensaio.area', v_area, true);
end;
$$;
set local role authenticated;
do $$
declare
  v json;
begin
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000f3b1","role":"authenticated","email":"ensaio.f3b.admin@ensaio.invalid"}', true);
  v := public.listar_editais_avaliacao(current_setting('ensaio.area'));
  if json_array_length(v -> 'editais') = 0 or not coalesce(((v -> 'editais' -> 0)::jsonb ? 'status'), false) then
    raise exception 'FALHOU E3: editais sem status %', left(v::text, 300);
  end if;
  raise notice 'ok E3: listar_editais_avaliacao devolve % edital(is) com o status', json_array_length(v -> 'editais');
end;
$$;
reset role;

select 'ENSAIO OK' as resultado;

rollback;
