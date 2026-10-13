/*
  AVALIAÇÃO DOCUMENTAL: DIFERENÇAS POR CARGO NA REGRA

  Por quê: a regra da avaliação documental (TH_REGRA_ANALISE."DS_CONFIGURACAO")
  só variava por NÍVEL (por_nivel dos blocos). O Edital 114/2026 muda por
  CARGO: o Motorista categoria D (cargo 15) tem cursos até 15 pontos, com 5
  do certificado de condução/operação de UMCQA (ou capacitação da
  contratante) além das faixas do nível médio (8.2.6); os cargos 5 a 8 exigem
  Cromatografia Gasosa, os 14 e 15 CNH e direção defensiva, os 12 e 13
  informática, o 9 diploma técnico e registro, o 10 registro "quando
  aplicável" e cada cargo tem a sua área de experiência (Anexo I). Até aqui,
  isso era só texto de motivo (CAPACITACAO_UMCQA) e não somava.

  O QUE MUDA
    - regra.por_cargo (opcional): lista de diferenças, cada uma com quem vale
      (códigos de vaga da Empregare e/ou o começo do nome do cargo, como
      "CARGO 15") e o que muda por bloco: CURSOS teto/faixas/extras, TITULOS
      teto/extras, VINCULOS teto/área exigida, DOCUMENTO requisitos (rótulo,
      motivo da eliminação, termos e "não pontua em" do item 8.2.7).
      Precedência: cargo > nível > padrão. Formato e conta em
      src/lib/avaliacao-documental/regra-por-cargo.ts (o espelho Python em
      python/monitora/avaliacao_documental/pontuacao.py, casos dourados em
      tests/fixtures/avaliacao-documental/casos-de-pontuacao.json).
    - FC_VALIDAR_REGRA_ANALISE valida por_cargo (FC_VALIDAR_POR_CARGO_ANALISE).
    - FC_REGRA_DA_VAGA: a regra que vale para a ficha (a diferença do cargo da
      vaga aplicada a cada bloco; os requisitos viram motivos com ELIMINA).
    - salvar_rascunho_ficha e concluir_ficha gravam no lançamento a vaga e o
      cargo da ficha e validam contra a regra da vaga: o teto do cargo (ex.:
      Cursos 15), os extras (blocos[X].extras = {UMCQA: true}) e os
      requisitos (blocos[X].requisitos = {CNH_D: true}); FC_PENDENCIAS_FICHA
      pede cada requisito do cargo conferido e cada extra marcado.
    - obter_apoio_regra_analise devolve o cargo de cada vaga (Seleção,
      pré-classificação ou o nome do arquivo da carga) e os cargos do quadro.
  Assinaturas das RPCs iguais (src/lib/rpc-contrato.js só muda o resumo).

  Nada de dado muda aqui: a regra do 114/2026 ganha as diferenças pela
  correção supabase/correcoes/20261013-edital-114-regra-por-cargo.sql (nova
  versão, situação CONFERIR). Rollback em
  supabase/rollback/20261013130000_regra_por_cargo.sql; ensaio em
  supabase/ensaios/20261013130000_regra_por_cargo.sql.
*/
begin;

set local lock_timeout = '10s';

-- ── 1. A regra da vaga: a diferença do cargo por cima do nível ──────────────

create or replace function private."FC_TEXTO_DO_CARGO"(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
           translate(lower(coalesce(p_texto, '')),
                     'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
                     'aaaaaaeeeeiiiiooooouuuucnyy'),
           '[^a-z0-9]+', ' ', 'g'));
$$;
comment on function private."FC_TEXTO_DO_CARGO"(text) is
  'O texto do cargo para comparar (textoDoCargo de regra-por-cargo.ts): sem acento, minúsculo, só letras e dígitos separados por um espaço.';
revoke all on function private."FC_TEXTO_DO_CARGO"(text) from public, anon, authenticated, service_role;

create or replace function private."FC_DIFERENCA_DA_VAGA"(p_regra jsonb, p_vaga text, p_cargo text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with diferencas as (
    select d, n
      from jsonb_array_elements(case when jsonb_typeof(p_regra -> 'por_cargo') = 'array'
                                     then p_regra -> 'por_cargo' else '[]'::jsonb end) with ordinality x(d, n)
     where jsonb_typeof(d) = 'object'
  )
  select coalesce(
    (select d from diferencas
      where btrim(coalesce(p_vaga, '')) <> ''
        and exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(d -> 'vagas') = 'array'
                                                                 then d -> 'vagas' else '[]'::jsonb end) v
                     where btrim(v) = btrim(p_vaga))
      order by n limit 1),
    (select d from diferencas
      where private."FC_TEXTO_DO_CARGO"(p_cargo) <> ''
        and exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(d -> 'cargos') = 'array'
                                                                 then d -> 'cargos' else '[]'::jsonb end) s
                     where private."FC_TEXTO_DO_CARGO"(s) <> ''
                       and strpos(' ' || private."FC_TEXTO_DO_CARGO"(p_cargo) || ' ',
                                  ' ' || private."FC_TEXTO_DO_CARGO"(s) || ' ') > 0)
      order by n limit 1));
$$;
comment on function private."FC_DIFERENCA_DA_VAGA"(jsonb, text, text) is
  'A diferença por cargo (regra.por_cargo) que vale para a vaga: a primeira com o código da vaga; sem ela, a primeira cujo cargo casa por palavras inteiras ("CARGO 1" não casa "CARGO 15"). Null = só nível e padrão. Igual a diferencaDaVaga (regra-por-cargo.ts) e diferenca_da_vaga (pontuacao.py).';
revoke all on function private."FC_DIFERENCA_DA_VAGA"(jsonb, text, text) from public, anon, authenticated, service_role;

create or replace function private."FC_BLOCO_DO_CARGO"(p_bloco jsonb, p_sobrescrita jsonb, p_nivel text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_parte jsonb;
  v_bloco jsonb;
begin
  if jsonb_typeof(p_sobrescrita) is distinct from 'object' then
    return p_bloco;
  end if;
  v_parte := p_bloco #> array['por_nivel', coalesce(p_nivel, '')];
  v_bloco := (case when jsonb_typeof(v_parte) = 'object' then p_bloco || v_parte else p_bloco end) - 'por_nivel';
  if p_sobrescrita ? 'teto' then
    v_bloco := v_bloco || jsonb_build_object('teto', p_sobrescrita -> 'teto');
  end if;
  if jsonb_typeof(p_sobrescrita -> 'faixas') = 'array' and jsonb_array_length(p_sobrescrita -> 'faixas') > 0 then
    v_bloco := v_bloco || jsonb_build_object('faixas', p_sobrescrita -> 'faixas');
  end if;
  if jsonb_typeof(p_sobrescrita -> 'extras') = 'array' and jsonb_array_length(p_sobrescrita -> 'extras') > 0 then
    v_bloco := v_bloco || jsonb_build_object('extras', p_sobrescrita -> 'extras');
  end if;
  if jsonb_typeof(p_sobrescrita -> 'area') = 'string' and btrim(p_sobrescrita ->> 'area') <> '' then
    v_bloco := v_bloco || jsonb_build_object('area', btrim(p_sobrescrita ->> 'area'));
  end if;
  if jsonb_typeof(p_sobrescrita -> 'requisitos') = 'array' and jsonb_array_length(p_sobrescrita -> 'requisitos') > 0 then
    v_bloco := v_bloco || jsonb_build_object(
      'requisitos', p_sobrescrita -> 'requisitos',
      'motivos', (case when jsonb_typeof(p_bloco -> 'motivos') = 'array' then p_bloco -> 'motivos' else '[]'::jsonb end)
                 || (select jsonb_agg(jsonb_build_object(
                              'codigo', q -> 'codigo',
                              'texto', q -> 'motivo',
                              'item_edital', coalesce(nullif(q ->> 'item_edital', ''), nullif(p_bloco ->> 'item_edital', ''), ''),
                              'efeito', 'ELIMINA') order by n)
                       from jsonb_array_elements(p_sobrescrita -> 'requisitos') with ordinality x(q, n)));
  end if;
  return v_bloco;
end;
$$;
comment on function private."FC_BLOCO_DO_CARGO"(jsonb, jsonb, text) is
  'O bloco com a diferença do cargo por cima do nível (cargo > nível > padrão): por_nivel do nível por baixo (e sai), teto, faixas, extras, área exigida e requisitos (que viram motivos do bloco com efeito ELIMINA). Igual a blocoDoCargo (regra-por-cargo.ts).';
revoke all on function private."FC_BLOCO_DO_CARGO"(jsonb, jsonb, text) from public, anon, authenticated, service_role;

create or replace function private."FC_REGRA_DA_VAGA"(p_regra jsonb, p_vaga text, p_cargo text, p_nivel text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_diferenca jsonb := private."FC_DIFERENCA_DA_VAGA"(p_regra, p_vaga, p_cargo);
begin
  if v_diferenca is null or jsonb_typeof(p_regra -> 'blocos') is distinct from 'array' then
    return p_regra;
  end if;
  return p_regra || jsonb_build_object(
    'por_cargo', '[]'::jsonb,
    'cargo', jsonb_build_object('codigo', v_diferenca -> 'codigo', 'rotulo', v_diferenca -> 'rotulo'),
    'blocos', coalesce((
      select jsonb_agg(case when jsonb_typeof(b) = 'object'
                            then private."FC_BLOCO_DO_CARGO"(b, v_diferenca #> array['blocos', b ->> 'codigo'], p_nivel)
                            else b end order by n)
        from jsonb_array_elements(p_regra -> 'blocos') with ordinality x(b, n)), '[]'::jsonb));
end;
$$;
comment on function private."FC_REGRA_DA_VAGA"(jsonb, text, text, text) is
  'A regra que vale para a ficha: a diferença do cargo da vaga (regra.por_cargo) aplicada a cada bloco, por_cargo vazio e cargo = {codigo, rotulo}. Sem diferença, a própria regra. Igual a regraDaVaga (regra-por-cargo.ts) e regra_da_vaga (pontuacao.py); salvar_rascunho_ficha e concluir_ficha validam contra ela.';
revoke all on function private."FC_REGRA_DA_VAGA"(jsonb, text, text, text) from public, anon, authenticated, service_role;

-- ── 2. A validação das diferenças por cargo (validarPorCargo) ───────────────

create or replace function private."FC_VALIDAR_POR_CARGO_ANALISE"(p_regra jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_lista jsonb := p_regra -> 'por_cargo';
  v_d record;
  v_s record;
  v_e record;
  v_bloco jsonb;
  v_tipo text;
  v_onde text;
  v_aqui text;
  v_campos text[];
  v_codigos text[] := '{}';
  v_vista text[];
  v_vaga text;
  v_dono jsonb := '{}'::jsonb;
  v_pontuam text[];
begin
  if v_lista is null or jsonb_typeof(v_lista) = 'null' then
    return;
  end if;
  if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 40 then
    raise exception 'Diferenças por cargo: até 40.' using errcode = '22023';
  end if;
  select coalesce(array_agg(b ->> 'codigo'), '{}') into v_pontuam
    from jsonb_array_elements(coalesce(p_regra -> 'blocos', '[]'::jsonb)) b
   where b ->> 'tipo' in ('TITULOS', 'CURSOS');
  for v_d in select x.value, x.ordinality from jsonb_array_elements(v_lista) with ordinality x loop
    v_onde := 'Diferença por cargo ' || v_d.ordinality
              || case when jsonb_typeof(v_d.value -> 'rotulo') = 'string' then ' (' || (v_d.value ->> 'rotulo') || ')' else '' end;
    if jsonb_typeof(v_d.value) <> 'object' then
      raise exception '%: inválida.', v_onde using errcode = '22023';
    end if;
    if coalesce(v_d.value ->> 'codigo', '') !~ '^[A-Z][A-Z0-9_]{1,29}$' then
      raise exception '%: código em maiúsculas (2 a 30, letras, dígitos, _).', v_onde using errcode = '22023';
    end if;
    if (v_d.value ->> 'codigo') = any (v_codigos) then
      raise exception '%: código repetido.', v_onde using errcode = '22023';
    end if;
    v_codigos := v_codigos || (v_d.value ->> 'codigo');
    if not private."FC_JSON_TEXTO_OK"(v_d.value -> 'rotulo', true, 120) or btrim(coalesce(v_d.value ->> 'rotulo', '')) = '' then
      raise exception '% (nome): obrigatório, até 120 caracteres.', v_onde using errcode = '22023';
    end if;
    if coalesce(jsonb_typeof(v_d.value -> 'vagas'), 'null') <> 'null'
       and (jsonb_typeof(v_d.value -> 'vagas') <> 'array' or jsonb_array_length(v_d.value -> 'vagas') > 200
            or exists (select 1 from jsonb_array_elements(v_d.value -> 'vagas') v
                        where jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^[0-9]{1,20}$')) then
      raise exception '%: vagas com o código da Empregare (só dígitos, até 200).', v_onde using errcode = '22023';
    end if;
    for v_vaga in select jsonb_array_elements_text(case when jsonb_typeof(v_d.value -> 'vagas') = 'array'
                                                        then v_d.value -> 'vagas' else '[]'::jsonb end) loop
      if v_dono ? v_vaga and (v_dono ->> v_vaga)::bigint <> v_d.ordinality then
        raise exception '%: a vaga % já está na diferença %.', v_onde, v_vaga, v_dono ->> v_vaga using errcode = '22023';
      end if;
      v_dono := v_dono || jsonb_build_object(v_vaga, v_d.ordinality);
    end loop;
    if coalesce(jsonb_typeof(v_d.value -> 'cargos'), 'null') <> 'null'
       and (jsonb_typeof(v_d.value -> 'cargos') <> 'array' or jsonb_array_length(v_d.value -> 'cargos') > 20
            or exists (select 1 from jsonb_array_elements(v_d.value -> 'cargos') c
                        where jsonb_typeof(c) <> 'string' or btrim(c #>> '{}') = '' or length(c #>> '{}') > 200)) then
      raise exception '% (cargos): lista de até 20 textos de 1 a 200 caracteres.', v_onde using errcode = '22023';
    end if;
    if coalesce(jsonb_array_length(case when jsonb_typeof(v_d.value -> 'vagas') = 'array' then v_d.value -> 'vagas' end), 0)
       + coalesce(jsonb_array_length(case when jsonb_typeof(v_d.value -> 'cargos') = 'array' then v_d.value -> 'cargos' end), 0) = 0 then
      raise exception '%: diga as vagas ou o cargo.', v_onde using errcode = '22023';
    end if;
    if jsonb_typeof(v_d.value -> 'blocos') is distinct from 'object' or not exists (select 1 from jsonb_object_keys(v_d.value -> 'blocos')) then
      raise exception '%: diga o que muda em ao menos um bloco.', v_onde using errcode = '22023';
    end if;

    for v_s in select key, value from jsonb_each(v_d.value -> 'blocos') loop
      v_aqui := v_onde || ', ' || v_s.key;
      select b into v_bloco from jsonb_array_elements(coalesce(p_regra -> 'blocos', '[]'::jsonb)) b where b ->> 'codigo' = v_s.key;
      if v_bloco is null then
        raise exception '%: o bloco % não está na regra.', v_onde, v_s.key using errcode = '22023';
      end if;
      if jsonb_typeof(v_s.value) <> 'object' then
        raise exception '%: diferença inválida.', v_aqui using errcode = '22023';
      end if;
      v_tipo := v_bloco ->> 'tipo';
      v_campos := case v_tipo when 'CURSOS' then array['teto', 'faixas', 'extras']
                              when 'TITULOS' then array['teto', 'extras']
                              when 'VINCULOS' then array['teto', 'area']
                              when 'DOCUMENTO' then array['requisitos'] end;
      if v_campos is null then
        raise exception '%: este tipo de bloco não muda por cargo.', v_aqui using errcode = '22023';
      end if;
      if not exists (select 1 from jsonb_object_keys(v_s.value)) then
        raise exception '%: diga o que muda.', v_aqui using errcode = '22023';
      end if;
      if exists (select 1 from jsonb_object_keys(v_s.value) k where k <> all (v_campos)) then
        raise exception '%: % não muda por cargo neste bloco.', v_aqui,
          (select k from jsonb_object_keys(v_s.value) k where k <> all (v_campos) limit 1) using errcode = '22023';
      end if;
      if v_s.value ? 'teto' and jsonb_typeof(v_s.value -> 'teto') <> 'null'
         and not private."FC_JSON_NUMERO_OBRIGATORIO"(v_s.value -> 'teto', 0, 100) then
        raise exception '%: teto entre 0 e 100.', v_aqui using errcode = '22023';
      end if;
      if v_s.value ? 'faixas' then
        if jsonb_typeof(v_s.value -> 'faixas') <> 'array' or jsonb_array_length(v_s.value -> 'faixas') not between 1 and 10 then
          raise exception '%: de 1 a 10 faixas de carga horária.', v_aqui using errcode = '22023';
        end if;
        if exists (select 1 from jsonb_array_elements(v_s.value -> 'faixas') f
                    where jsonb_typeof(f) <> 'object'
                       or not private."FC_JSON_NUMERO_OBRIGATORIO"(f -> 'min_horas', 0, 20000)
                       or not (jsonb_typeof(f -> 'max_horas') = 'null' or private."FC_JSON_NUMERO_OBRIGATORIO"(f -> 'max_horas', 0, 20000))
                       or (jsonb_typeof(f -> 'max_horas') = 'number' and (f ->> 'max_horas')::numeric < (f ->> 'min_horas')::numeric)
                       or not private."FC_JSON_NUMERO_OBRIGATORIO"(f -> 'pontos', 0, 100)) then
          raise exception '%: faixas com horas de 0 a 20.000 (mínimo ≤ máximo) e pontos de 0 a 100.', v_aqui using errcode = '22023';
        end if;
      end if;
      if v_s.value ? 'area' and (jsonb_typeof(v_s.value -> 'area') <> 'string' or btrim(v_s.value ->> 'area') = ''
                                 or length(v_s.value ->> 'area') > 1000) then
        raise exception '% (área exigida): obrigatório, até 1000 caracteres.', v_aqui using errcode = '22023';
      end if;
      if v_s.value ? 'extras' then
        if jsonb_typeof(v_s.value -> 'extras') <> 'array' or jsonb_array_length(v_s.value -> 'extras') not between 1 and 10 then
          raise exception '%: de 1 a 10 itens extras.', v_aqui using errcode = '22023';
        end if;
        v_vista := '{}';
        for v_e in select x.value, x.ordinality from jsonb_array_elements(v_s.value -> 'extras') with ordinality x loop
          if jsonb_typeof(v_e.value) <> 'object' or coalesce(v_e.value ->> 'codigo', '') !~ '^[A-Z][A-Z0-9_]{1,29}$' then
            raise exception '%, extra %: código em maiúsculas (2 a 30, letras, dígitos, _).', v_aqui, v_e.ordinality using errcode = '22023';
          end if;
          if (v_e.value ->> 'codigo') = any (v_vista) then
            raise exception '%, extra %: código repetido.', v_aqui, v_e.ordinality using errcode = '22023';
          end if;
          v_vista := v_vista || (v_e.value ->> 'codigo');
          if not private."FC_JSON_TEXTO_OK"(v_e.value -> 'rotulo', true, 200) or btrim(coalesce(v_e.value ->> 'rotulo', '')) = ''
             or not private."FC_JSON_NUMERO_OBRIGATORIO"(v_e.value -> 'pontos', 0, 100)
             or not private."FC_JSON_TEXTO_OK"(v_e.value -> 'item_edital', false, 40) then
            raise exception '%, extra %: rótulo (até 200), pontos de 0 a 100 e item do edital até 40.', v_aqui, v_e.ordinality using errcode = '22023';
          end if;
        end loop;
      end if;
      if v_s.value ? 'requisitos' then
        if jsonb_typeof(v_s.value -> 'requisitos') <> 'array' or jsonb_array_length(v_s.value -> 'requisitos') not between 1 and 15 then
          raise exception '%: de 1 a 15 requisitos.', v_aqui using errcode = '22023';
        end if;
        v_vista := '{}';
        for v_e in select x.value, x.ordinality from jsonb_array_elements(v_s.value -> 'requisitos') with ordinality x loop
          if jsonb_typeof(v_e.value) <> 'object' or coalesce(v_e.value ->> 'codigo', '') !~ '^[A-Z][A-Z0-9_]{1,29}$' then
            raise exception '%, requisito %: código em maiúsculas (2 a 30, letras, dígitos, _).', v_aqui, v_e.ordinality using errcode = '22023';
          end if;
          if (v_e.value ->> 'codigo') = any (v_vista) then
            raise exception '%, requisito %: código repetido.', v_aqui, v_e.ordinality using errcode = '22023';
          end if;
          if exists (select 1 from jsonb_array_elements(coalesce(v_bloco -> 'motivos', '[]'::jsonb)) m
                      where m ->> 'codigo' = v_e.value ->> 'codigo') then
            raise exception '%, requisito %: o código % já é um motivo do bloco.', v_aqui, v_e.ordinality, v_e.value ->> 'codigo'
              using errcode = '22023';
          end if;
          v_vista := v_vista || (v_e.value ->> 'codigo');
          if not private."FC_JSON_TEXTO_OK"(v_e.value -> 'rotulo', true, 200) or btrim(coalesce(v_e.value ->> 'rotulo', '')) = ''
             or not private."FC_JSON_TEXTO_OK"(v_e.value -> 'motivo', true, 1000) or btrim(coalesce(v_e.value ->> 'motivo', '')) = ''
             or not private."FC_JSON_TEXTO_OK"(v_e.value -> 'item_edital', false, 40) then
            raise exception '%, requisito %: rótulo (até 200) e motivo (até 1000) obrigatórios; item do edital até 40.', v_aqui, v_e.ordinality
              using errcode = '22023';
          end if;
          if not private."FC_JSON_TEXTOS_OK"(v_e.value -> 'termos', 10)
             or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(v_e.value -> 'termos') = 'array'
                                                                then v_e.value -> 'termos' else '[]'::jsonb end) t
                         where length(t #>> '{}') > 100) then
            raise exception '%, requisito % (termos): lista de até 10 textos de 1 a 100 caracteres.', v_aqui, v_e.ordinality using errcode = '22023';
          end if;
          if coalesce(jsonb_typeof(v_e.value -> 'nao_pontua_em'), 'null') <> 'null'
             and (jsonb_typeof(v_e.value -> 'nao_pontua_em') <> 'array' or jsonb_array_length(v_e.value -> 'nao_pontua_em') > 4
                  or exists (select 1 from jsonb_array_elements(v_e.value -> 'nao_pontua_em') c
                              where jsonb_typeof(c) <> 'string' or (c #>> '{}') <> all (v_pontuam))) then
            raise exception '%, requisito %: "não pontua em" só com blocos de títulos ou cursos da regra.', v_aqui, v_e.ordinality
              using errcode = '22023';
          end if;
        end loop;
      end if;
    end loop;
  end loop;
end;
$$;
comment on function private."FC_VALIDAR_POR_CARGO_ANALISE"(jsonb) is
  'Confere regra.por_cargo (22023 com o primeiro erro), como validarPorCargo de regra-por-cargo.ts: até 40 diferenças com código e nome, vagas (só dígitos, cada vaga numa diferença só) e/ou cargos, e o que muda em cada bloco da regra: CURSOS teto/faixas/extras, TITULOS teto/extras, VINCULOS teto/área exigida, DOCUMENTO requisitos (código fora dos motivos do bloco; termos; não pontua em títulos/cursos).';
revoke all on function private."FC_VALIDAR_POR_CARGO_ANALISE"(jsonb) from public, anon, authenticated, service_role;

-- ── 3. A regra valida as diferenças por cargo ─────────────────────────────

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

  -- Diferenças por cargo (20261013130000).
  perform private."FC_VALIDAR_POR_CARGO_ANALISE"(p_regra);
end;
$function$;
comment on function private."FC_VALIDAR_REGRA_ANALISE"(jsonb) is
  'Confere a configuração de uma regra da avaliação documental (22023 com a mensagem do primeiro erro). As mesmas regras de validarRegraAnalise() em src/lib/avaliacao-documental/regra.js; o lote aceita a base NOTA_MINIMA (com nota_minima e item_edital) desde 20261006120500; a pergunta da nota declarada pode ser uma lista de alternativas desde 20261007100000; o item da nota declarada pode ter pontos_por_nivel (OPCAO e OPCOES_SOMADAS) desde 20261007140000; provisoria.base_da_nota (DECLARADA ou ART; DECLARADA exige nota declarada) desde 20261007170000; as diferenças por cargo (por_cargo, FC_VALIDAR_POR_CARGO_ANALISE) desde 20261013130000.';

-- ── 4. A ficha: lançamento, pendências, rascunho e conclusão pela regra da vaga ──

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
comment on function private."FC_VALIDAR_LANCAMENTO_FICHA"(jsonb, jsonb) is
  'Confere a estrutura do lançamento da ficha contra a regra da vaga (22023): nível, modalidade, blocos e motivos/justificativas da regra, nota ajustada de 0 ao teto do bloco no nível, até 50 títulos/cursos/vínculos com campos válidos, datas e textos limitados; desde 20261013130000, as linhas extras e os requisitos do cargo (extras/requisitos de cada bloco, true ou false, só os da regra da vaga). As recusas dos itens lidos dos arquivos (recusas_lidas) e a origem das linhas aceitas (do_arquivo) vão por FC_VALIDAR_LEITURAS_LANCAMENTO (20261009220000). Não refaz a conta.';

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
comment on function private."FC_PENDENCIAS_FICHA"(jsonb, jsonb, jsonb) is
  'O que falta para concluir (pendenciasDaFicha de ficha.js): situação de cada bloco que se aplica, motivo do Não conforme/Não enviado, cada requisito do cargo conferido no bloco Conforme e cada item extra do cargo marcado na pontuação pelos itens (20261013130000), motivo do item recusado, datas dos vínculos, experiência Conforme abaixo do mínimo da regra pelos vínculos aceitos e justificativa de toda nota diferente da declarada (fora do inapto por requisito). Vazio = pode concluir.';

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
  v_cargo text;
  v_conf jsonb;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  perform private."FC_EXIGIR_GRAVAR_FICHA"(v_f, p_versao);
  select * into v_regra from private."FC_REGRA_VIGENTE_FICHA"(p_ficha);
  -- A vaga e o cargo são os da ficha (o lançamento grava os dois) e a regra é a
  -- da vaga: a diferença do cargo por cima do nível (20261013130000).
  v_cargo := (select pv."NO_CARGO" from public."TB_PRE_CLASSIF_VAGA" pv
               where pv."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and pv."CO_VAGA" = v_f."CO_VAGA");
  if jsonb_typeof(p_lancamento) = 'object' then
    p_lancamento := p_lancamento || jsonb_build_object('vaga', v_f."CO_VAGA", 'cargo', v_cargo);
  end if;
  v_conf := private."FC_REGRA_DA_VAGA"(v_regra.p_configuracao, v_f."CO_VAGA", v_cargo, p_lancamento ->> 'nivel');
  perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_conf, p_lancamento);
  perform private."FC_VALIDAR_RESULTADO_FICHA"(v_conf, p_lancamento, p_resultado,
                                                private."FC_DOCUMENTAL_DO_EDITAL"(v_f."CO_MONITORAMENTO"));
  if length(coalesce(p_parecer, '')) > 8000 then
    raise exception 'Parecer com até 8.000 caracteres.' using errcode = '22023';
  end if;
  v_alt := private."FC_ALTERACOES_FICHA"(v_conf, v_f."DS_LANCAMENTO", v_f."DS_RESULTADO", p_lancamento, p_resultado);
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
comment on function public.salvar_rascunho_ficha(uuid, integer, jsonb, jsonb, text) is
  'Salva o rascunho da ficha (o salvamento automático da tela): lançamento (com a vaga e o cargo da ficha, desde 20261013130000), resultado da conta e parecer gerado, conferidos contra a regra vigente da vaga (a diferença do cargo por cima do nível, FC_REGRA_DA_VAGA; estrutura, limites e coerência do resultado; nada é recalculado). Exige a reserva vigente de quem chama, em análise, e a versão que a tela abriu (40001); renova a reserva; sobe a versão. Alteração de conteúdo vai ao histórico (SALVAR, com o retrato e de quanto para quanto). Devolve a versão nova e a hora.';

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
  v_cargo text;
  v_conf jsonb;
  v_pend text[];
  v_parecer text := btrim(coalesce(p_parecer, ''));
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  perform private."FC_EXIGIR_GRAVAR_FICHA"(v_f, p_versao);
  select * into v_regra from private."FC_REGRA_VIGENTE_FICHA"(p_ficha);
  -- A vaga e o cargo são os da ficha (o lançamento grava os dois) e a regra é a
  -- da vaga: a diferença do cargo por cima do nível (20261013130000).
  v_cargo := (select pv."NO_CARGO" from public."TB_PRE_CLASSIF_VAGA" pv
               where pv."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and pv."CO_VAGA" = v_f."CO_VAGA");
  if jsonb_typeof(p_lancamento) = 'object' then
    p_lancamento := p_lancamento || jsonb_build_object('vaga', v_f."CO_VAGA", 'cargo', v_cargo);
  end if;
  v_conf := private."FC_REGRA_DA_VAGA"(v_regra.p_configuracao, v_f."CO_VAGA", v_cargo, p_lancamento ->> 'nivel');
  if p_versao_regra is distinct from v_regra.p_versao then
    raise exception 'A regra mudou (versão %): a ficha foi recalculada; confira e conclua de novo.', v_regra.p_versao using errcode = '40001';
  end if;
  if v_regra.p_situacao <> 'CONFERIDA' then
    raise exception 'A versão % da regra ainda não foi conferida pela coordenação: dá para salvar o rascunho, mas não concluir.', v_regra.p_versao
      using errcode = '22023';
  end if;
  perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_conf, p_lancamento);
  perform private."FC_VALIDAR_RESULTADO_FICHA"(v_conf, p_lancamento, p_resultado,
                                                private."FC_DOCUMENTAL_DO_EDITAL"(v_f."CO_MONITORAMENTO"));
  v_pend := private."FC_PENDENCIAS_FICHA"(v_conf, p_lancamento, p_resultado);
  if cardinality(v_pend) > 0 then
    raise exception 'Falta para concluir: %.', array_to_string(v_pend[1:5], '; ') using errcode = '22023';
  end if;
  if length(v_parecer) not between 1 and 8000 then
    raise exception 'O parecer é obrigatório (até 8.000 caracteres).' using errcode = '22023';
  end if;
  v_alt := private."FC_ALTERACOES_FICHA"(v_conf, v_f."DS_LANCAMENTO", v_f."DS_RESULTADO", p_lancamento, p_resultado);
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
comment on function public.concluir_ficha(uuid, integer, integer, jsonb, jsonb, text) is
  'Conclui a ficha: confere a reserva, a versão da ficha (40001), a versão da regra (tem de ser a vigente, 40001, e conferida, 22023), a estrutura e a coerência do resultado e o que falta (situação, motivos, requisitos e extras do cargo, itens recusados, datas e justificativa de nota diferente da declarada) contra a regra da vaga (FC_REGRA_DA_VAGA, 20261013130000); grava o lançamento com a vaga e o cargo da ficha, resultado, notas, parecer, a versão da regra usada (AM-2.3), quem e quando (o login, AM-12.6); libera a reserva; histórico CONCLUIR com o retrato. A conta é a da tela, reconferida em lote pelo Python.';

-- ── 5. O assistente: o cargo de cada vaga e os cargos do quadro ────────────

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
               -- O cargo da vaga: a Seleção, a pré-classificação ou, sem elas, o nome
               -- do arquivo da carga da Empregare ("Candidatos da vaga N - <cargo> em Excel").
               'cargo', coalesce(
                 (select s."NO_CARGO" from public."TB_SELECAO_VAGA" s
                   where s."CO_VAGA" = v."CO_VAGA" and s."NO_CARGO" is not null
                   order by s."CO_MONITORAMENTO" = p_edital desc limit 1),
                 (select pv."NO_CARGO" from public."TB_PRE_CLASSIF_VAGA" pv
                   where pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" = v."CO_VAGA" and pv."NO_CARGO" is not null),
                 nullif(btrim(substring(v."NO_ARQUIVO" from '^Candidatos da vaga [0-9]+ - (.+) em Excel')), '')),
               'colunas', coalesce((
                 select json_agg(c.coluna order by c.ordem)
                   from jsonb_array_elements_text(v."DS_COLUNA") with ordinality c(coluna, ordem)
                  where c.coluna ilike 'Pergunta %'), '[]'::json))
             order by v."CO_VAGA")
        from public."TB_EMPREGARE_VAGA" v
       where v."CO_MONITORAMENTO" = p_edital and v."TP_SITUACAO" = 'GRAVADA'), '[]'::json),
    -- Os cargos do quadro de vagas do edital (as diferenças por cargo, 20261013130000).
    'cargos_do_quadro', coalesce((
      select json_agg(q."NO_CARGO" order by q.ordem)
        from (select qv."NO_CARGO", min(qv."NU_ORDEM") as ordem
                from public."TB_QUADRO_VAGA_EDITAL" qv
               where qv."CO_MONITORAMENTO" = p_edital and qv."ST_REGISTRO_ATIVO" = 'S'
               group by qv."NO_CARGO") q), '[]'::json),
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
comment on function public.obter_apoio_regra_analise(uuid) is
  'O que o assistente da regra da avaliação documental lê (json): os nomes das colunas de pergunta da última carga de cada vaga do edital (sem respostas) com o cargo (Seleção, pré-classificação ou o nome do arquivo da carga), os cargos do quadro de vagas (cargos_do_quadro, para as diferenças por cargo, desde 20261013130000), as regras conferidas dos outros editais da área que a pessoa vê (só para a coordenação do edital, para copiar; com o nome da versão) e a regra de classificação vigente (nota mínima, desempate e o nome da versão) para quem lê a Classificação, com pode_editar (Editor na Classificação). Exige avaliacao_documental >= leitor, a área e o recorte da coordenação.';

commit;
