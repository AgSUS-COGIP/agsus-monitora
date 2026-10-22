/*
  AVALIAÇÃO DOCUMENTAL: BLOCO QUE NÃO SE APLICA AO CARGO (por_cargo)

  Por quê (pedido da COREs, 14/10/2026): no Edital 114/2026 o registro ativo
  no conselho de classe é obrigatório nos cargos 1 a 9, "quando aplicável" no
  10 e NÃO SE APLICA nos cargos 11 a 15 (Anexo I). O bloco REGISTRO_CONSELHO
  valia igual para todos, com Não enviado/Não conforme eliminando: o
  avaliador do Motorista tinha de marcar Confere num item que não existe para
  o cargo. A diferença por cargo (regra.por_cargo, 20261013130000) só sabia
  mudar teto, faixas, extras, área e requisitos.

  O QUE MUDA
    - por_cargo[].blocos.<BLOCO DOCUMENTO> aceita { "nao_se_aplica": true },
      sozinho (FC_VALIDAR_POR_CARGO_ANALISE; validarPorCargo no front).
    - FC_BLOCO_DO_CARGO marca o bloco da regra da vaga com
      nao_se_aplica = true (blocoDoCargo / bloco_do_cargo).
    - FC_BLOCO_SE_APLICA: o bloco marcado não vale (como a condição de
      modalidade fora dela). Daí, sem mudar as RPCs: o lançamento só aceita
      NAO_SE_APLICA nele (FC_VALIDAR_LANCAMENTO_FICHA, 20261013180100), as
      pendências não pedem situação nem requisitos dele (FC_PENDENCIAS_FICHA)
      e a conta não lhe dá efeito (pontuacao.js/.py: NAO_SE_APLICA). A ficha
      mostra "Não se aplica a este cargo".
  Assinaturas iguais. Nada de dado muda aqui: a regra do 114/2026 ganha as
  diferenças pela correção supabase/correcoes/20261014-edital-114-regra-v16-perguntas.sql
  (branch fix/regra-114-v16-perguntas), que depende desta migration.

  Rollback: supabase/rollback/20261014150000_bloco_nao_se_aplica_por_cargo.sql
*/
begin;

set local lock_timeout = '10s';

CREATE OR REPLACE FUNCTION private."FC_BLOCO_SE_APLICA"(p_bloco jsonb, p_lancamento jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
           when p_bloco -> 'nao_se_aplica' = 'true'::jsonb then false
           when coalesce(p_bloco ->> 'condicao', case when p_bloco ->> 'tipo' = 'PONTUACAO' then 'INDIGENA' end) is null then true
           when coalesce(p_bloco ->> 'condicao', 'INDIGENA') = 'INDIGENA' then coalesce((p_lancamento ->> 'indigena')::boolean, false)
           else upper(coalesce(p_lancamento ->> 'modalidade', '')) = upper(split_part(p_bloco ->> 'condicao', '=', 2))
         end;
$function$;
comment on function private."FC_BLOCO_SE_APLICA"(jsonb, jsonb) is
  'O bloco vale para o candidato (condição INDIGENA ou MODALIDADE=…; o critério étnico só para quem se declarou indígena; o bloco marcado nao_se_aplica pela diferença do cargo, FC_BLOCO_DO_CARGO, não vale), como blocoSeAplica (ficha.js).';
revoke all on function private."FC_BLOCO_SE_APLICA"(jsonb, jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private."FC_BLOCO_DO_CARGO"(p_bloco jsonb, p_sobrescrita jsonb, p_nivel text)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_parte jsonb;
  v_bloco jsonb;
begin
  if jsonb_typeof(p_sobrescrita) is distinct from 'object' then
    return p_bloco;
  end if;
  v_parte := p_bloco #> array['por_nivel', coalesce(p_nivel, '')];
  v_bloco := (case when jsonb_typeof(v_parte) = 'object' then p_bloco || v_parte else p_bloco end) - 'por_nivel';
  if p_sobrescrita -> 'nao_se_aplica' = 'true'::jsonb then
    v_bloco := v_bloco || jsonb_build_object('nao_se_aplica', true);
  end if;
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
$function$;
comment on function private."FC_BLOCO_DO_CARGO"(jsonb, jsonb, text) is
  'O bloco com a diferença do cargo por cima do nível (cargo > nível > padrão): por_nivel do nível por baixo (e sai), teto, faixas, extras, área exigida, requisitos (que viram motivos do bloco com efeito ELIMINA) e nao_se_aplica (o bloco não vale para a vaga, 20261014150000). Igual a blocoDoCargo (regra-por-cargo.ts).';
revoke all on function private."FC_BLOCO_DO_CARGO"(jsonb, jsonb, text) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private."FC_VALIDAR_POR_CARGO_ANALISE"(p_regra jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
                              when 'DOCUMENTO' then array['requisitos', 'nao_se_aplica'] end;
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
      if v_s.value ? 'nao_se_aplica' then
        if v_s.value -> 'nao_se_aplica' is distinct from 'true'::jsonb then
          raise exception '%: "não se aplica" só aceita marcado (true).', v_aqui using errcode = '22023';
        end if;
        if (select count(*) from jsonb_object_keys(v_s.value)) > 1 then
          raise exception '%: "não se aplica" não vai com outras mudanças.', v_aqui using errcode = '22023';
        end if;
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
$function$;
comment on function private."FC_VALIDAR_POR_CARGO_ANALISE"(jsonb) is
  'Confere regra.por_cargo (22023 com o primeiro erro), como validarPorCargo de regra-por-cargo.ts: até 40 diferenças com código e nome, vagas (só dígitos, cada vaga numa diferença só) e/ou cargos, e o que muda em cada bloco da regra: CURSOS teto/faixas/extras, TITULOS teto/extras, VINCULOS teto/área exigida, DOCUMENTO requisitos (código fora dos motivos do bloco; termos; não pontua em títulos/cursos) ou nao_se_aplica (true, sozinho; 20261014150000).';
revoke all on function private."FC_VALIDAR_POR_CARGO_ANALISE"(jsonb) from public, anon, authenticated, service_role;

commit;
