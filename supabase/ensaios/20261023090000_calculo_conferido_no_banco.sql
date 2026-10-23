/*
  ENSAIO de 20261023090000_calculo_conferido_no_banco.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres) ou rode pela API. Aplica as funções
  novas dentro da transação e mede, sem gravar nada:
  A. a paridade do cálculo do banco com o que a tela gravou (calculados e experiência
     das fichas concluídas ou em revisão; esperado 0 divergências) e o que a data limite
     padrão (fim das inscrições) muda;
  B. quantas concluídas seriam recusadas por FC_VALIDAR_RESULTADO_FICHA se re-salvas;
  C. que aplicar não muda a situação de nenhuma ficha e as pendências das concluídas pela
     regra nova (o que o job Python de conferências mandaria para revisão);
  D. o tempo da validação ao salvar/concluir, ficha a ficha;
  E. a RPC do job (revisar_ficha_concluida_com_pendencia) numa ficha com pendência e na
     6cb75e98 (eliminada pela identidade: sem pendência, não muda);
  F. a RPC da correção (corrigir_experiencia_da_ficha) numa ficha do 114 com dias depois de
     14/10: só a experiência muda, com o histórico CORRIGIR;
  e os casos dourados de tests/fixtures/avaliacao-documental/casos-do-calculo-no-banco.json
  (a mesma conta e as mesmas pendências da tela e do Python;
  tests/calculo-conferido-no-banco-migration.test.js confere que o JSON abaixo é o do arquivo).
  Termina em rollback: nenhuma ficha nem função fica.
*/
begin;

-- A situação de cada ficha antes de aplicar (aplicar não pode mudar nenhuma).
create temp table ensaio_situacao_antes on commit drop as
select "CO_FICHA_ANALISE" as id, "TP_SITUACAO" as s from public."TB_FICHA_ANALISE";

set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- 1. A data AAAA-MM-DD de verdade, ou nulo (diaUtc em pontuacao.js; _dia em pontuacao.py).
CREATE OR REPLACE FUNCTION private."FC_DATA_DO_TEXTO"(p_texto text)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  -- Sem bloco de exceção (caro numa varredura): o dia é conferido contra o último do mês.
  select case when p_texto is null or p_texto !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
                   or substr(p_texto, 1, 4) = '0000'
              then null
              when substr(p_texto, 9, 2)::integer <= extract(day from (make_date(substr(p_texto, 1, 4)::integer,
                     substr(p_texto, 6, 2)::integer, 1) + interval '1 month - 1 day'))::integer
              then make_date(substr(p_texto, 1, 4)::integer, substr(p_texto, 6, 2)::integer, substr(p_texto, 9, 2)::integer) end;
$function$;

-- 2. Dias de intervalos [inicio, fim] inclusivos (diasDosIntervalos; dias_dos_intervalos):
--    com p_unir, as sobreposições contam uma vez e o dia seguinte emenda; p_limite corta o fim.
CREATE OR REPLACE FUNCTION private."FC_DIAS_DOS_INTERVALOS"(p_itens jsonb, p_unir boolean, p_limite date)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  with brutos as (
    select private."FC_DATA_DO_TEXTO"(i ->> 'inicio') as a, private."FC_DATA_DO_TEXTO"(i ->> 'fim') as b
      from jsonb_array_elements(case when jsonb_typeof(p_itens) = 'array' then p_itens else '[]'::jsonb end) i
     where jsonb_typeof(i) = 'object'),
  d as (
    select a, least(b, coalesce(p_limite, b)) as b
      from brutos
     where a is not null and b is not null and b >= a),
  validos as (select a, b from d where b >= a),
  marcados as (
    select a, b,
           case when a <= max(b) over (order by a, b rows between unbounded preceding and 1 preceding) + 1
                then 0 else 1 end as novo
      from validos),
  grupos as (select a, b, sum(novo) over (order by a, b rows unbounded preceding) as g from marcados),
  ilhas as (select min(a) as a, max(b) as b from grupos group by g)
  select case when p_unir then (select coalesce(sum(b - a + 1), 0)::integer from ilhas)
              else (select coalesce(sum(b - a + 1), 0)::integer from validos) end;
$function$;

-- 3. Anos (365), meses (30, no máximo 11) e dias: 364 dias = 0 anos, 11 meses e 34 dias
--    (antes, "12 meses e 4 dias"). anosMesesDias em pontuacao.js; anos_meses_dias em pontuacao.py.
CREATE OR REPLACE FUNCTION private."FC_ANOS_MESES_DIAS"(p_dias integer)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select jsonb_build_object('anos', t / 365, 'meses', least((t % 365) / 30, 11),
                            'dias', (t % 365) - least((t % 365) / 30, 11) * 30)
    from (select greatest(coalesce(p_dias, 0), 0) as t) x;
$function$;

-- 4. O efeito do bloco lançado (avaliarBlocos; _avaliar_blocos): o da situação (sem
--    situação, Conforme) ou, com motivo escolhido que tem efeito, o mais forte deles.
CREATE OR REPLACE FUNCTION private."FC_EFEITO_DO_BLOCO"(p_bloco jsonb, p_lancado jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  with s as (select coalesce(nullif(p_lancado ->> 'situacao', ''), 'CONFORME') as situacao),
  m as (
    select x ->> 'efeito' as efeito, n
      from s
      cross join jsonb_array_elements_text(case when jsonb_typeof(p_lancado -> 'motivos') = 'array'
                                                then p_lancado -> 'motivos' else '[]'::jsonb end) with ordinality c(codigo, n)
      cross join lateral (
        select x from jsonb_array_elements(case when jsonb_typeof(p_bloco -> 'motivos') = 'array'
                                                then p_bloco -> 'motivos' else '[]'::jsonb end) x
         where x ->> 'codigo' = c.codigo limit 1) y
     where s.situacao in ('NAO_CONFORME', 'NAO_ENVIADO') and coalesce(y.x ->> 'efeito', '') <> '')
  select coalesce(
    (select efeito from m
      order by coalesce(array_position(array['ELIMINA', 'ZERA_PONTOS', 'SEM_PONTOS_ALDEIA', 'AJUSTA_PONTOS',
                                             'ENCAMINHA_HETEROIDENTIFICACAO', 'ENCAMINHA_PERICIA', 'SEGUE_AMPLA',
                                             'SO_REGISTRO'], efeito), 8), n
      limit 1),
    (select coalesce(p_bloco #>> array['efeitos', s.situacao],
                     case when s.situacao = 'CONFORME' then null else 'SO_REGISTRO' end) from s));
$function$;

-- 5. O número do JSON ou 0 (numero() em pontuacao.js).
CREATE OR REPLACE FUNCTION private."FC_NUMERO_OU_ZERO"(p_valor jsonb)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case when jsonb_typeof(p_valor) = 'number' then (p_valor #>> '{}')::numeric else 0 end;
$function$;

-- 6. O bloco no nível da vaga: por_nivel[nivel] por cima do bloco (doNivel; do_nivel).
CREATE OR REPLACE FUNCTION private."FC_BLOCO_NO_NIVEL"(p_bloco jsonb, p_nivel text)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case when jsonb_typeof(p_bloco #> array['por_nivel', coalesce(p_nivel, '')]) = 'object'
              then p_bloco || (p_bloco #> array['por_nivel', p_nivel]) else p_bloco end;
$function$;

-- 7. A experiência pelos vínculos aceitos (apurarExperiencia; apurar_experiencia): dias por
--    categoria, total unido, meses, estágio de indígena, pontos e o mínimo.
CREATE OR REPLACE FUNCTION private."FC_EXPERIENCIA_DA_FICHA"(p_bloco jsonb, p_lanc jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_unir boolean := coalesce(p_bloco -> 'unir_sobreposicao', 'true'::jsonb) <> 'false'::jsonb;
  v_limite date := private."FC_DATA_DO_TEXTO"(nullif(p_bloco ->> 'data_limite', ''));
  v_max integer := case when jsonb_typeof(p_bloco -> 'max_vinculos') = 'number'
                        then floor((p_bloco ->> 'max_vinculos')::numeric)::integer else 20 end;
  v_aceitos jsonb;
  v_cat jsonb;
  v_por_categoria jsonb := '{}'::jsonb;
  v_dias integer;
  v_total integer;
  v_dias_por_mes numeric := case when jsonb_typeof(p_bloco -> 'dias_por_mes') = 'number'
                                 then (p_bloco ->> 'dias_por_mes')::numeric else 30 end;
  v_meses integer;
  v_estagio jsonb := case when jsonb_typeof(p_bloco -> 'estagio_indigena') = 'object' then p_bloco -> 'estagio_indigena' else '{}'::jsonb end;
  v_horas numeric := private."FC_NUMERO_OU_ZERO"(p_lanc -> 'estagio_horas');
  v_meses_estagio integer := 0;
  v_considerados integer;
  v_nivel jsonb := private."FC_BLOCO_NO_NIVEL"(p_bloco, p_lanc ->> 'nivel');
  v_minimo numeric := private."FC_NUMERO_OU_ZERO"(p_bloco -> 'minimo_meses');
  v_que_pontuam numeric;
  v_periodo numeric;
  v_bruto numeric;
  v_pontos numeric;
  v_teto numeric := case when jsonb_typeof(v_nivel -> 'teto') = 'number' then (v_nivel ->> 'teto')::numeric end;
begin
  select coalesce(jsonb_agg(i order by n), '[]'::jsonb) into v_aceitos
    from (select i, n
            from jsonb_array_elements(case when jsonb_typeof(p_lanc -> 'vinculos') = 'array' then p_lanc -> 'vinculos' else '[]'::jsonb end)
                 with ordinality x(i, n)
           where jsonb_typeof(i) = 'object' and coalesce(i -> 'aceito', 'true'::jsonb) <> 'false'::jsonb
           order by n
           limit greatest(v_max, 0)) a;
  for v_cat in select c from jsonb_array_elements(case when jsonb_typeof(p_bloco -> 'categorias') = 'array'
                                                       then p_bloco -> 'categorias' else '[]'::jsonb end) c loop
    v_dias := private."FC_DIAS_DOS_INTERVALOS"(
      (select coalesce(jsonb_agg(i), '[]'::jsonb) from jsonb_array_elements(v_aceitos) i where i ->> 'categoria' = v_cat ->> 'codigo'),
      v_unir, v_limite);
    v_por_categoria := v_por_categoria || jsonb_build_object(v_cat ->> 'codigo',
      jsonb_build_object('dias_total', v_dias) || private."FC_ANOS_MESES_DIAS"(v_dias)
        || jsonb_build_object('desempate', coalesce(v_cat -> 'desempate', 'null'::jsonb)));
  end loop;
  v_total := private."FC_DIAS_DOS_INTERVALOS"(
    (select coalesce(jsonb_agg(i), '[]'::jsonb) from jsonb_array_elements(v_aceitos) i
      where exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_bloco -> 'categorias') = 'array'
                                                             then p_bloco -> 'categorias' else '[]'::jsonb end) c
                     where c ->> 'codigo' = i ->> 'categoria' and coalesce(c -> 'pontua', 'true'::jsonb) <> 'false'::jsonb)),
    v_unir, v_limite);
  v_meses := floor(v_total / v_dias_por_mes)::integer;
  if v_estagio -> 'ativo' = 'true'::jsonb and coalesce(p_lanc -> 'indigena', 'false'::jsonb) = 'true'::jsonb and v_horas > 0 then
    if not (v_estagio -> 'so_sem_experiencia' = 'true'::jsonb) or v_meses = 0 then
      v_meses_estagio := floor(v_horas
        / case when jsonb_typeof(v_estagio -> 'horas_por_dia') = 'number' then (v_estagio ->> 'horas_por_dia')::numeric else 8 end
        / case when jsonb_typeof(v_estagio -> 'dias_por_mes') = 'number' then (v_estagio ->> 'dias_por_mes')::numeric else 22 end)::integer;
    end if;
  end if;
  v_considerados := case when v_estagio -> 'so_sem_experiencia' = 'false'::jsonb then v_meses + v_meses_estagio
                         when v_meses > 0 then v_meses else v_meses_estagio end;
  v_que_pontuam := greatest(0, v_considerados - case when p_bloco -> 'desconta_minimo' = 'true'::jsonb then v_minimo else 0 end);
  if coalesce(p_bloco ->> 'pontuacao', 'POR_MES') = 'POR_PERIODO' then
    v_periodo := nullif(private."FC_NUMERO_OU_ZERO"(p_bloco -> 'periodo_meses'), 0);
    v_bruto := floor(v_que_pontuam / coalesce(v_periodo, 1)) * private."FC_NUMERO_OU_ZERO"(v_nivel -> 'pontos_por_periodo');
  else
    v_bruto := v_que_pontuam * private."FC_NUMERO_OU_ZERO"(v_nivel -> 'pontos_por_mes');
  end if;
  v_pontos := round(v_bruto, 4);
  if v_teto is not null then
    v_pontos := least(v_pontos, v_teto);
  end if;
  return jsonb_build_object(
    'dias_total', v_total, 'meses', v_meses, 'meses_estagio', v_meses_estagio, 'meses_considerados', v_considerados,
    'por_categoria', v_por_categoria, 'pontos', v_pontos,
    'abaixo_do_minimo', v_minimo > 0 and
      (case when p_bloco -> 'minimo_conta_estagio' = 'true'::jsonb then v_considerados else v_meses end) < v_minimo);
end;
$function$;

-- 8. A pontuação dos itens do bloco (títulos, cursos, vínculos), sem o ajuste e sem o efeito
--    (pontosDosTitulos, pontosDosCursos, apurarExperiencia; os _pontos_* do Python).
CREATE OR REPLACE FUNCTION private."FC_CALCULADO_DO_BLOCO"(p_bloco jsonb, p_lanc jsonb)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_nivel text := p_lanc ->> 'nivel';
  v_lancado jsonb := p_lanc #> array['blocos', coalesce(p_bloco ->> 'codigo', '')];
  v_extras numeric;
  v_valores numeric[];
  v_total numeric;
  v_b jsonb;
begin
  if p_bloco ->> 'tipo' = 'VINCULOS' then
    return (private."FC_EXPERIENCIA_DA_FICHA"(p_bloco, p_lanc) ->> 'pontos')::numeric;
  end if;
  v_b := case when p_bloco ->> 'tipo' = 'CURSOS' then private."FC_BLOCO_NO_NIVEL"(p_bloco, v_nivel) else p_bloco end;
  -- As linhas extras do cargo marcadas (pontosDosExtras, regra-por-cargo.ts).
  select coalesce(sum(private."FC_NUMERO_OU_ZERO"(e -> 'pontos')), 0) into v_extras
    from jsonb_array_elements(case when jsonb_typeof(v_b -> 'extras') = 'array' then v_b -> 'extras' else '[]'::jsonb end) e
   where jsonb_typeof(e) = 'object' and v_lancado #> array['extras', coalesce(e ->> 'codigo', '')] = 'true'::jsonb;
  if p_bloco ->> 'tipo' = 'TITULOS' then
    select array_agg(coalesce((
             select private."FC_NUMERO_OU_ZERO"(x -> 'pontos')
               from jsonb_array_elements(case when jsonb_typeof(p_bloco #> array['pontos_por_nivel', coalesce(v_nivel, '')]) = 'array'
                                              then p_bloco #> array['pontos_por_nivel', v_nivel] else '[]'::jsonb end) with ordinality y(x, k)
              where x ->> 'titulo' = t ->> 'titulo'
              order by k limit 1), 0) order by n)
      into v_valores
      from jsonb_array_elements(case when jsonb_typeof(p_lanc -> 'titulos') = 'array' then p_lanc -> 'titulos' else '[]'::jsonb end)
           with ordinality z(t, n)
     where jsonb_typeof(t) = 'object' and coalesce(t -> 'aceito', 'true'::jsonb) <> 'false'::jsonb;
    if coalesce(cardinality(v_valores), 0) = 0 and v_extras = 0 then
      return 0;
    end if;
    v_total := case when coalesce(cardinality(v_valores), 0) = 0 then 0
                    when p_bloco -> 'cumulativa' = 'true'::jsonb then (select sum(v) from unnest(v_valores) v)
                    else (select max(v) from unnest(v_valores) v) end + v_extras;
  elsif p_bloco ->> 'tipo' = 'CURSOS' then
    select coalesce(sum(coalesce((
             select private."FC_NUMERO_OU_ZERO"(f -> 'pontos')
               from jsonb_array_elements(case when jsonb_typeof(v_b -> 'faixas') = 'array' then v_b -> 'faixas' else '[]'::jsonb end)
                    with ordinality y(f, k)
              where private."FC_NUMERO_OU_ZERO"(c -> 'horas') >= private."FC_NUMERO_OU_ZERO"(f -> 'min_horas')
                and (jsonb_typeof(f -> 'max_horas') is distinct from 'number'
                     or private."FC_NUMERO_OU_ZERO"(c -> 'horas') <= (f ->> 'max_horas')::numeric)
              order by k limit 1), 0)), 0) + v_extras
      into v_total
      from jsonb_array_elements(case when jsonb_typeof(p_lanc -> 'cursos') = 'array' then p_lanc -> 'cursos' else '[]'::jsonb end) c
     where jsonb_typeof(c) = 'object' and coalesce(c -> 'aceito', 'true'::jsonb) <> 'false'::jsonb;
    v_total := round(v_total, 4);
  else
    return null;
  end if;
  if jsonb_typeof(v_b -> 'teto') = 'number' then
    v_total := least(v_total, (v_b ->> 'teto')::numeric);
  end if;
  return round(v_total, 4);
end;
$function$;

-- 9. Os cursos que se decidem pela nota, sem a lista (decidePelaNota em ficha.js): a ficha
--    sem curso lançado à mão, completo e aceito. Nesses, a nota é a decisão (Confere ou Editar).
CREATE OR REPLACE FUNCTION private."FC_BLOCO_PELA_NOTA"(p_bloco jsonb, p_lanc jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select p_bloco ->> 'tipo' = 'CURSOS'
     and not exists (
       select 1 from jsonb_array_elements(case when jsonb_typeof(p_lanc -> 'cursos') = 'array' then p_lanc -> 'cursos' else '[]'::jsonb end) i
        where jsonb_typeof(i) = 'object'
          and coalesce(i ->> 'do_arquivo', '') in ('', 'false')
          and coalesce(i -> 'aceito', 'true'::jsonb) <> 'false'::jsonb
          and private."FC_NUMERO_OU_ZERO"(i -> 'horas') > 0);
$function$;

-- 10. O ajuste com justificativa (blocoJustificado/acimaDoComprovadoJustificado em ficha.js):
--     Editar nota (edita_nota) com um motivo do bloco ou observação pronta, o "Outro motivo"
--     descrito (10+) ou, sem opções na regra, o texto livre (10+).
CREATE OR REPLACE FUNCTION private."FC_AJUSTE_JUSTIFICADO"(p_regra jsonb, p_bloco jsonb, p_lancado jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(p_lancado -> 'edita_nota' = 'true'::jsonb, false)
     and (exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(p_lancado -> 'justificativas') = 'array'
                                                               then p_lancado -> 'justificativas' else '[]'::jsonb end) j where j <> 'OUTRO')
          or (coalesce(p_lancado -> 'justificativas', '[]'::jsonb) ? 'OUTRO'
              and length(btrim(coalesce(p_lancado ->> 'motivo_livre', ''))) >= 10)
          or (jsonb_array_length(case when jsonb_typeof(p_bloco -> 'motivos') = 'array' then p_bloco -> 'motivos' else '[]'::jsonb end) = 0
              and jsonb_array_length(case when jsonb_typeof(p_regra -> 'observacoes_prontas') = 'array' then p_regra -> 'observacoes_prontas' else '[]'::jsonb end) = 0
              and length(btrim(coalesce(p_lancado ->> 'justificativa_livre', ''))) >= 10));
$function$;

revoke all on function private."FC_DATA_DO_TEXTO"(text) from public, anon, authenticated;
revoke all on function private."FC_DIAS_DOS_INTERVALOS"(jsonb, boolean, date) from public, anon, authenticated;
revoke all on function private."FC_ANOS_MESES_DIAS"(integer) from public, anon, authenticated;
revoke all on function private."FC_EFEITO_DO_BLOCO"(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private."FC_NUMERO_OU_ZERO"(jsonb) from public, anon, authenticated;
revoke all on function private."FC_BLOCO_NO_NIVEL"(jsonb, text) from public, anon, authenticated;
revoke all on function private."FC_EXPERIENCIA_DA_FICHA"(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private."FC_CALCULADO_DO_BLOCO"(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private."FC_BLOCO_PELA_NOTA"(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private."FC_AJUSTE_JUSTIFICADO"(jsonb, jsonb, jsonb) from public, anon, authenticated;

-- 11. O resultado da ficha: as parciais dos blocos de itens recalculadas pelo banco.
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
  v_efeito text;
  v_calc numeric;
  v_ajuste numeric;
  v_esperada numeric;
  v_exp jsonb;
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
    -- Títulos, cursos e vínculos (20261023090000): o banco recalcula a pontuação dos itens
    -- registrados (FC_CALCULADO_DO_BLOCO, a conta de calcularAvaliacao) e não confia na
    -- parcial nem no calculado do cliente. A parcial é 0 no bloco que zera; senão, o ajuste
    -- (nota_ajustada, até o teto) ou o calculado. O ajuste ACIMA do calculado só vale com
    -- Editar nota e justificativa (FC_AJUSTE_JUSTIFICADO); abaixo, no Confere, vale a
    -- declarada (decisão de 23/10/2026). Ficam de fora os cursos pela nota (sem itens: a
    -- nota é a decisão), o Não confere/Não enviou (o 0 é a decisão) e o inapto por
    -- requisito (pontuação só informativa).
    if v_bloco ->> 'tipo' in ('TITULOS', 'CURSOS', 'VINCULOS') and private."FC_BLOCO_SE_APLICA"(v_bloco, p_lanc) then
      v_efeito := private."FC_EFEITO_DO_BLOCO"(v_bloco, v_lancado);
      v_calc := case when v_efeito in ('ELIMINA', 'ZERA_PONTOS') then 0
                     else coalesce(private."FC_CALCULADO_DO_BLOCO"(v_bloco, p_lanc), 0) end;
      if jsonb_typeof(p_res #> array['calculados', v_item.key]) = 'number'
         and abs((p_res #>> array['calculados', v_item.key])::numeric - v_calc) > 0.0001 then
        raise exception 'O calculado da parcial % (%) não é o dos itens registrados (%): recarregue a ficha.',
          v_item.key, (p_res #>> array['calculados', v_item.key]), trim_scale(v_calc) using errcode = '22023';
      end if;
      v_ajuste := case when jsonb_typeof(v_lancado -> 'nota_ajustada') = 'number'
                       then least(greatest((v_lancado ->> 'nota_ajustada')::numeric, 0), v_teto) end;
      v_esperada := case when v_efeito in ('ELIMINA', 'ZERA_PONTOS') then 0 else coalesce(v_ajuste, v_calc) end;
      if abs((v_item.value #>> '{}')::numeric - v_esperada) > 0.0001 then
        raise exception 'A parcial % (%) não confere com o lançamento (%).',
          v_item.key, (v_item.value #>> '{}'), trim_scale(v_esperada) using errcode = '22023';
      end if;
      -- Só no Conforme (Confere ou Editar nota): no Não confere/Não enviou o 0 é a decisão.
      if coalesce(v_lancado ->> 'situacao', 'CONFORME') = 'CONFORME'
         and v_efeito is distinct from 'ELIMINA' and v_efeito is distinct from 'ZERA_PONTOS'
         and v_ajuste is not null and v_ajuste - v_calc > 0.0001
         and v_resultado <> 'INAPTO_REQUISITO'
         and not private."FC_BLOCO_PELA_NOTA"(v_bloco, p_lanc)
         and not private."FC_AJUSTE_JUSTIFICADO"(p_regra, v_bloco, v_lancado) then
        raise exception 'A parcial % (%) está acima do que os itens registrados dão (%): ajuste em Editar nota, com justificativa.',
          v_item.key, trim_scale(v_ajuste), trim_scale(v_calc) using errcode = '22023';
      end if;
    end if;
    v_soma := v_soma + (v_item.value #>> '{}')::numeric;
  end loop;
  -- Todo bloco de itens que vale para o candidato tem a parcial (a tela grava todas).
  if exists (select 1 from jsonb_array_elements(coalesce(p_regra -> 'blocos', '[]'::jsonb)) b
              where b ->> 'tipo' in ('TITULOS', 'CURSOS', 'VINCULOS')
                and private."FC_BLOCO_SE_APLICA"(b, p_lanc)
                and jsonb_typeof(p_res #> array['parciais', private."FC_PARCIAL_DO_TIPO"(b ->> 'tipo')]) is distinct from 'number') then
    raise exception 'Falta a parcial de um bloco de títulos, cursos ou vínculos.' using errcode = '22023';
  end if;
  -- A experiência gravada (o desempate e o painel leem) é a dos vínculos aceitos.
  select private."FC_EXPERIENCIA_DA_FICHA"(b, p_lanc) into v_exp
    from jsonb_array_elements(coalesce(p_regra -> 'blocos', '[]'::jsonb)) with ordinality x(b, n)
   where b ->> 'tipo' = 'VINCULOS' and private."FC_BLOCO_SE_APLICA"(b, p_lanc)
   order by n desc limit 1;
  if v_exp is not null and (
       jsonb_typeof(p_res -> 'experiencia') is distinct from 'object'
       or (p_res #> '{experiencia,dias_total}') is distinct from (v_exp -> 'dias_total')
       or (p_res #> '{experiencia,meses}') is distinct from (v_exp -> 'meses')
       or (p_res #> '{experiencia,meses_considerados}') is distinct from (v_exp -> 'meses_considerados')) then
    raise exception 'A experiência gravada não é a dos vínculos aceitos (% dias, % meses): recarregue a ficha.',
      v_exp ->> 'dias_total', v_exp ->> 'meses_considerados' using errcode = '22023';
  end if;
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

-- 12. O que falta para concluir: experiência e itens do banco, mínimo, datas e pontuação acima do comprovado.
CREATE OR REPLACE FUNCTION private."FC_PENDENCIAS_FICHA"(p_regra jsonb, p_lanc jsonb, p_res jsonb)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE
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
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_exp jsonb;
  v_meses numeric;
  v_minimo_pend boolean;
  v_elimina_outro boolean;
  v_calc numeric;
  v_valor numeric;
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
    -- Datas dos vínculos aceitos (20261023090000; faltaNasDatasDoVinculo em
    -- datas-do-vinculo.ts): AAAA-MM-DD, fim depois do início, nada antes de 1960 e o fim
    -- até hoje (Brasília). A data limite da regra não recusa a linha: só corta a conta.
    if v_itens = 'vinculos' and exists (
         select 1 from jsonb_array_elements(coalesce(p_lanc -> 'vinculos', '[]'::jsonb)) i
          where coalesce(i -> 'aceito', 'true'::jsonb) <> 'false'::jsonb -- o recusado não conta: não pede as datas
            and (private."FC_DATA_DO_TEXTO"(i ->> 'inicio') is null or private."FC_DATA_DO_TEXTO"(i ->> 'fim') is null
                 or i ->> 'fim' < i ->> 'inicio')) then
      v_pend := v_pend || (v_titulo || ': vínculo com data inválida');
    elsif v_itens = 'vinculos' and exists (
         select 1 from jsonb_array_elements(coalesce(p_lanc -> 'vinculos', '[]'::jsonb)) i
          where coalesce(i -> 'aceito', 'true'::jsonb) <> 'false'::jsonb
            and private."FC_DATA_DO_TEXTO"(i ->> 'inicio') < date '1960-01-01') then
      v_pend := v_pend || (v_titulo || ': vínculo com data antes de 1960');
    elsif v_itens = 'vinculos' and exists (
         select 1 from jsonb_array_elements(coalesce(p_lanc -> 'vinculos', '[]'::jsonb)) i
          where coalesce(i -> 'aceito', 'true'::jsonb) <> 'false'::jsonb
            and private."FC_DATA_DO_TEXTO"(i ->> 'fim') > v_hoje) then
      v_pend := v_pend || (v_titulo || ': vínculo com fim depois de hoje');
    end if;
    -- A experiência e a pontuação dos itens são as do banco (20261023090000:
    -- FC_EXPERIENCIA_DA_FICHA e FC_CALCULADO_DO_BLOCO, a conta de calcularAvaliacao),
    -- não as que o cliente gravou em DS_RESULTADO.
    v_exp := null;
    v_meses := null;
    v_minimo_pend := false;
    if v_bloco ->> 'tipo' = 'VINCULOS' then
      v_exp := private."FC_EXPERIENCIA_DA_FICHA"(v_bloco, p_lanc);
      v_meses := (v_exp ->> case when v_bloco -> 'minimo_conta_estagio' = 'true'::jsonb
                                  then 'meses_considerados' else 'meses' end)::numeric;
    end if;
    -- Eliminado por OUTRO bloco (identidade, escolaridade, requisito…), a experiência é só
    -- informativa e o resultado não muda: o mínimo não pede nada (decisão de 22/10/2026).
    -- Continua valendo quando a única eliminação é a da própria experiência.
    v_elimina_outro := v_bloco ->> 'tipo' = 'VINCULOS' and exists (
      select 1 from jsonb_array_elements(coalesce(p_regra -> 'blocos', '[]'::jsonb)) o
       where o ->> 'codigo' is distinct from v_bloco ->> 'codigo'
         -- O efeito primeiro (barato); a aplicação só de quem elimina.
         and case when private."FC_EFEITO_DO_BLOCO"(o, p_lanc #> array['blocos', coalesce(o ->> 'codigo', '')]) = 'ELIMINA'
                  then private."FC_BLOCO_SE_APLICA"(o, p_lanc) else false end);
    -- Experiência Conforme abaixo do mínimo pelos vínculos aceitos eliminaria em silêncio:
    -- lance os vínculos ou marque Não conforme (pendenciasDaFicha, tipo minimo).
    if v_bloco ->> 'tipo' = 'VINCULOS' and v_l ->> 'situacao' = 'CONFORME' and not v_elimina_outro
       and jsonb_typeof(v_bloco -> 'minimo_meses') = 'number' and (v_bloco ->> 'minimo_meses')::numeric > 0
       and coalesce(v_bloco ->> 'efeito_minimo', 'ELIMINA') = 'ELIMINA'
       and v_meses < (v_bloco ->> 'minimo_meses')::numeric then
      v_minimo_pend := true;
      v_pend := v_pend || (v_titulo || ': experiência mínima de ' || (v_bloco ->> 'minimo_meses')
                           || ' meses não comprovada pelos vínculos aceitos');
    end if;
    -- Experiência Não conforme ou Não enviou com os vínculos aceitos cumprindo o mínimo
    -- (20261020100000; Não enviou em 20261023090000): o mínimo é pelos vínculos aceitos,
    -- então não eliminaria, só zeraria a experiência. Desmarque os vínculos não aceitos ou
    -- marque Confere (pendenciasDaFicha, tipo minimo).
    if v_bloco ->> 'tipo' = 'VINCULOS' and v_l ->> 'situacao' in ('NAO_CONFORME', 'NAO_ENVIADO') and not v_elimina_outro
       and jsonb_typeof(v_bloco -> 'minimo_meses') = 'number' and (v_bloco ->> 'minimo_meses')::numeric > 0
       and coalesce(v_bloco ->> 'efeito_minimo', 'ELIMINA') = 'ELIMINA'
       and v_meses >= (v_bloco ->> 'minimo_meses')::numeric then
      v_minimo_pend := true;
      v_pend := v_pend || (v_titulo || ': marcada como '
                           || case when v_l ->> 'situacao' = 'NAO_ENVIADO' then 'Não enviou' else 'Não confere' end
                           || ', mas os vínculos aceitos somam ' || trim_scale(v_meses)
                           || ' meses (mínimo ' || (v_bloco ->> 'minimo_meses')
                           || '): desmarque os vínculos não aceitos ou marque Confere');
    end if;
    -- Pontuação Conforme ACIMA do que os itens aceitos dão (20261020180000 para a
    -- experiência; 20261023090000: também títulos e cursos com a lista —
    -- pontuacaoAcimaDoComprovado em ficha.js). No Confere, a parcial é a declarada
    -- (nota_ajustada); abaixo dos itens não é falta (vale a declarada, decisão de
    -- 23/10/2026). Só vale com Editar nota e justificativa. Fora do inapto por requisito
    -- (pontuação só informativa, 20261021090000), dos cursos pela nota (sem itens) e
    -- quando a falta já é a do mínimo.
    v_parcial := private."FC_PARCIAL_DO_TIPO"(v_bloco ->> 'tipo');
    if v_itens is not null and v_l ->> 'situacao' = 'CONFORME' and not v_minimo_pend
       and coalesce(p_res ->> 'resultado', '') <> 'INAPTO_REQUISITO'
       and not private."FC_BLOCO_PELA_NOTA"(v_bloco, p_lanc)
       and jsonb_typeof(p_res #> array['parciais', v_parcial]) = 'number'
       and not private."FC_AJUSTE_JUSTIFICADO"(p_regra, v_bloco, v_l) then
      v_calc := coalesce(case when v_itens = 'vinculos' then (v_exp ->> 'pontos')::numeric
                              else private."FC_CALCULADO_DO_BLOCO"(v_bloco, p_lanc) end, 0);
      v_valor := (p_res #>> array['parciais', v_parcial])::numeric;
      if v_valor - v_calc > 0.0001 then
        v_pend := v_pend || (v_titulo || ': pontuação confirmada com ' || trim_scale(v_valor)
                             || ' pontos, acima do que '
                             || case v_itens when 'vinculos' then 'os vínculos aceitos comprovam ('
                                                    || coalesce(v_exp ->> 'meses_considerados', '0') || ' meses, '
                                             when 'titulos' then 'os títulos aceitos dão ('
                                             else 'os cursos aceitos dão (' end
                             || trim_scale(v_calc) || ' pontos): lance os itens que comprovam o declarado ou ajuste a pontuação em Editar nota, com justificativa');
      end if;
    end if;
    -- Nota diferente da declarada exige justificativa (fora do inapto por requisito).
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

-- 13. A ficha concluída que passou a ter pendência pela regra vigente vai para Em revisão
--     (pedido de 22/10/2026: não dar a falsa sensação de finalizado). A varredura é do job
--     Python de conferências (scripts/conferencias, todo dia às 6h, com a chave
--     "Conferências" da automação), que acha as fichas com a conta de
--     python/monitora/avaliacao_documental/pendencias_da_ficha.py. Esta RPC só grava, uma
--     ficha por vez, e confere de novo no banco (FC_PENDENCIAS_FICHA com a regra vigente):
--     sem pendência aqui, não move. Sem mudar nota nem resultado: só a situação (REVISAR,
--     como mandar_fichas_revisao) e o histórico, de origem JOB (usuário nulo), com o motivo
--     "Conferência automática: …". Não é a decisão de uma pessoa nem do setor. Só service_role.
CREATE OR REPLACE FUNCTION public.revisar_ficha_concluida_com_pendencia(p_ficha uuid, p_versao integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_cargo text;
  v_lanc jsonb;
  v_pend text[];
  v_motivo text;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  if v_f."CO_FICHA_ANALISE" is null then
    return jsonb_build_object('alterada', false, 'motivo', 'ficha não encontrada');
  end if;
  if v_f."TP_SITUACAO" <> 'CONCLUIDA' or v_f."NU_VERSAO" is distinct from p_versao then
    return jsonb_build_object('alterada', false, 'motivo', 'a ficha mudou desde a leitura');
  end if;
  if jsonb_typeof(v_f."DS_LANCAMENTO") is distinct from 'object' or jsonb_typeof(v_f."DS_RESULTADO") is distinct from 'object' then
    return jsonb_build_object('alterada', false, 'motivo', 'ficha sem lançamento ou resultado');
  end if;
  v_cargo := (select pv."NO_CARGO" from public."TB_PRE_CLASSIF_VAGA" pv
               where pv."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and pv."CO_VAGA" = v_f."CO_VAGA");
  v_lanc := v_f."DS_LANCAMENTO" || jsonb_build_object('vaga', v_f."CO_VAGA", 'cargo', v_cargo);
  select private."FC_PENDENCIAS_FICHA"(
           private."FC_REGRA_DA_VAGA"(r.p_configuracao, v_f."CO_VAGA", v_cargo, v_lanc ->> 'nivel'), v_lanc, v_f."DS_RESULTADO")
    into v_pend
    from private."FC_REGRA_VIGENTE_FICHA"(p_ficha) r;
  if coalesce(cardinality(v_pend), 0) = 0 then
    return jsonb_build_object('alterada', false, 'motivo', 'sem pendência no banco');
  end if;
  v_motivo := left('Conferência automática: a ficha concluída tem pendência pela regra vigente — '
                   || array_to_string(v_pend[1:5], '; ')
                   || case when cardinality(v_pend) > 5 then format(' (e mais %s)', cardinality(v_pend) - 5) else '' end
                   || '.', 2000);
  update public."TB_FICHA_ANALISE" set
    "TP_SITUACAO" = 'REVISAR', "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
    "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
   where "CO_FICHA_ANALISE" = p_ficha;
  perform private."FC_HISTORICO_FICHA"(p_ficha, 'REVISAR', 'CONCLUIDA', v_f."CO_USUARIO_RESPONSAVEL", v_motivo, null);
  return jsonb_build_object('alterada', true, 'versao', v_f."NU_VERSAO" + 1, 'pendencias', to_jsonb(v_pend));
end;
$function$;
revoke all on function public.revisar_ficha_concluida_com_pendencia(uuid, integer) from public, anon, authenticated;
grant execute on function public.revisar_ficha_concluida_com_pendencia(uuid, integer) to service_role;
comment on function public.revisar_ficha_concluida_com_pendencia(uuid, integer) is
  'Job de conferências (service_role): passa para REVISAR a ficha CONCLUIDA (na versão lida) que tem pendência pela regra vigente (FC_PENDENCIAS_FICHA, conferida de novo aqui), sem mudar nota nem resultado; histórico TP_ORIGEM JOB com "Conferência automática: …". Devolve {alterada, versao | motivo}.';

-- 14. A correção da experiência de uma ficha concluída (scripts/correcoes/
--     experiencia_ate_o_fim_das_inscricoes.py): só DS_RESULTADO.experiencia, que precisa ser a
--     que o banco calcula pelos vínculos aceitos com a regra vigente (a data limite padrão
--     incluída) e com a mesma pontuação já gravada (a nota e o resultado não mudam). Histórico
--     CORRIGIR com a conta de quem assina e republicação no painel. Só service_role.
CREATE OR REPLACE FUNCTION public.corrigir_experiencia_da_ficha(p_ficha uuid, p_versao integer, p_experiencia jsonb,
                                                                p_motivo text, p_usuario uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_cargo text;
  v_lanc jsonb;
  v_exp jsonb;
  v_novo jsonb;
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if length(v_motivo) not between 10 and 2000 then
    raise exception 'Motivo da correção com 10 a 2.000 caracteres.' using errcode = '22023';
  end if;
  if not exists (select 1 from public."TB_PERFIL_USUARIO" u where u.user_id = p_usuario) then
    raise exception 'Quem assina a correção não tem cadastro.' using errcode = '22023';
  end if;
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  if v_f."CO_FICHA_ANALISE" is null or v_f."TP_SITUACAO" <> 'CONCLUIDA' then
    raise exception 'Só a ficha concluída tem a experiência corrigida.' using errcode = '22023';
  end if;
  if v_f."NU_VERSAO" is distinct from p_versao then
    raise exception 'A ficha mudou desde a leitura; rode de novo.' using errcode = 'PT409';
  end if;
  v_cargo := (select pv."NO_CARGO" from public."TB_PRE_CLASSIF_VAGA" pv
               where pv."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and pv."CO_VAGA" = v_f."CO_VAGA");
  v_lanc := v_f."DS_LANCAMENTO" || jsonb_build_object('vaga', v_f."CO_VAGA", 'cargo', v_cargo);
  select private."FC_EXPERIENCIA_DA_FICHA"(x.b, v_lanc) into v_exp
    from private."FC_REGRA_VIGENTE_FICHA"(p_ficha) r
    cross join lateral jsonb_array_elements(
      private."FC_REGRA_DA_VAGA"(r.p_configuracao, v_f."CO_VAGA", v_cargo, v_lanc ->> 'nivel') -> 'blocos')
      with ordinality x(b, n)
   where x.b ->> 'tipo' = 'VINCULOS'
   order by x.n desc limit 1;
  if v_exp is null then
    raise exception 'A regra da ficha não tem bloco de vínculos.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_experiencia) is distinct from 'object'
     or (p_experiencia -> 'dias_total') is distinct from (v_exp -> 'dias_total')
     or (p_experiencia -> 'meses') is distinct from (v_exp -> 'meses')
     or (p_experiencia -> 'meses_considerados') is distinct from (v_exp -> 'meses_considerados') then
    raise exception 'A experiência enviada (% dias) não é a que o banco calcula (% dias).',
      p_experiencia ->> 'dias_total', v_exp ->> 'dias_total' using errcode = '22023';
  end if;
  if (v_f."DS_RESULTADO" #> '{calculados,EXPERIENCIA}') is distinct from (v_exp -> 'pontos') then
    raise exception 'Com a experiência corrigida a pontuação mudaria (% → %): a ficha vai para revisão, não para correção.',
      v_f."DS_RESULTADO" #>> '{calculados,EXPERIENCIA}', v_exp ->> 'pontos' using errcode = '22023';
  end if;
  v_novo := v_f."DS_RESULTADO" || jsonb_build_object('experiencia', coalesce(v_f."DS_RESULTADO" -> 'experiencia', '{}'::jsonb)
    || jsonb_build_object('dias_total', v_exp -> 'dias_total', 'meses', v_exp -> 'meses',
                          'meses_considerados', v_exp -> 'meses_considerados', 'por_categoria', v_exp -> 'por_categoria'));
  update public."TB_FICHA_ANALISE" set
    "DS_RESULTADO" = v_novo, "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
   where "CO_FICHA_ANALISE" = p_ficha;
  perform private."FC_HISTORICO_CONTEUDO_FICHA"(p_ficha, 'CORRIGIR', 'CONCLUIDA', v_motivo, p_usuario,
    jsonb_build_array(jsonb_build_object('campo', 'experiencia_dias', 'rotulo', 'Experiência (dias)',
      'de', v_f."DS_RESULTADO" #> '{experiencia,dias_total}', 'para', v_exp -> 'dias_total')),
    jsonb_build_object('resultado', v_novo));
  -- O painel (experiencia_profissional_total): a publicação só roda sozinha quando muda a nota ou a situação.
  perform private."FC_PUBLICAR_FICHA_ANALISE"(p_ficha);
  return jsonb_build_object('versao', v_f."NU_VERSAO" + 1,
                            'dias_antes', v_f."DS_RESULTADO" #> '{experiencia,dias_total}', 'dias_depois', v_exp -> 'dias_total');
end;
$function$;
revoke all on function public.corrigir_experiencia_da_ficha(uuid, integer, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.corrigir_experiencia_da_ficha(uuid, integer, jsonb, text, uuid) to service_role;
comment on function public.corrigir_experiencia_da_ficha(uuid, integer, jsonb, text, uuid) is
  'Correção de dados (service_role): troca só DS_RESULTADO.experiencia da ficha CONCLUIDA pela que o banco calcula (a enviada precisa bater), se a pontuação não muda; histórico CORRIGIR assinado por p_usuario e republicação no painel.';

-- 15. A fila mostra o motivo da revisão.
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
             -- O motivo da revisão (o último REVISAR do histórico: a coordenação ou a conferência
             -- automática, 20261023090000), só na ficha em revisão.
             'motivo_revisao', case when f."TP_SITUACAO" = 'REVISAR' then (
               select h."DS_MOTIVO" from public."TH_FICHA_ANALISE" h
                where h."CO_FICHA_ANALISE" = f."CO_FICHA_ANALISE" and h."TP_ACAO" = 'REVISAR'
                order by h."DT_REGISTRO" desc limit 1) end,
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

-- 16. O fim das inscrições do cronograma do edital (fim_das_inscricoes em
--     python/monitora/avaliacao_documental/pre_classificacao.py; dataDeCorteDoCronograma no JS):
--     a etapa de inscrição (sem resultado, recurso, homologação, deferimento ou validação no
--     nome); com prorrogação, o fim mais tarde; sem fim, o início.
CREATE OR REPLACE FUNCTION private."FC_FIM_DAS_INSCRICOES"(p_edital uuid)
 RETURNS date
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select max(coalesce(c.data_fim, c.data_inicio))::date
    from public."TB_CRONOGRAMA_MONIT_INDIG" c
   where c.monitoramento_id = p_edital
     and translate(lower(coalesce(c.atividade, '')), 'áàâãéêíóôõúç', 'aaaaeeiooouc') ~ 'inscri'
     and translate(lower(coalesce(c.atividade, '')), 'áàâãéêíóôõúç', 'aaaaeeiooouc') !~ '(resultado|recurso|homolog|deferid|valida)';
$function$;
revoke all on function private."FC_FIM_DAS_INSCRICOES"(uuid) from public, anon, authenticated;

-- 17. A experiência conta até o fim das inscrições (decisão de 22/10/2026): o bloco de
--     vínculos sem data_limite na regra recebe a do cronograma do edital (a regra pode
--     definir outra). É a regra que a tela recebe (obter_ficha_analise), que o banco confere
--     (concluir_ficha, salvar_rascunho_ficha, FC_PENDENCIAS_FICHA) e que o Python usa
--     (conferências, robô de leitura e sugestões da ficha): a mesma conta nos três lados.
CREATE OR REPLACE FUNCTION private."FC_REGRA_COM_DATA_LIMITE"(p_configuracao jsonb, p_edital uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_fim date;
begin
  if jsonb_typeof(p_configuracao -> 'blocos') is distinct from 'array'
     or not exists (select 1 from jsonb_array_elements(p_configuracao -> 'blocos') b
                     where b ->> 'tipo' = 'VINCULOS' and coalesce(b ->> 'data_limite', '') = '') then
    return p_configuracao;
  end if;
  v_fim := private."FC_FIM_DAS_INSCRICOES"(p_edital);
  if v_fim is null then
    return p_configuracao;
  end if;
  return jsonb_set(p_configuracao, '{blocos}', (
    select jsonb_agg(case when b ->> 'tipo' = 'VINCULOS' and coalesce(b ->> 'data_limite', '') = ''
                          then b || jsonb_build_object('data_limite', to_char(v_fim, 'YYYY-MM-DD')) else b end order by n)
      from jsonb_array_elements(p_configuracao -> 'blocos') with ordinality x(b, n)));
end;
$function$;
revoke all on function private."FC_REGRA_COM_DATA_LIMITE"(jsonb, uuid) from public, anon, authenticated;

-- 18. A regra da ficha já com a data limite (17).
CREATE OR REPLACE FUNCTION private."FC_REGRA_VIGENTE_FICHA"(p_ficha uuid, OUT p_versao integer, OUT p_situacao text, OUT p_configuracao jsonb)
 RETURNS record
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select h."NU_VERSAO", case when h."NU_VERSAO" = r."NU_VERSAO_VIGENTE" then r."TP_SITUACAO" else 'CONFERIDA' end,
         private."FC_REGRA_COM_DATA_LIMITE"(h."DS_CONFIGURACAO", f."CO_MONITORAMENTO")
    from public."TB_FICHA_ANALISE" f
    join public."TB_REGRA_ANALISE" r on r."CO_REGRA_ANALISE" = f."CO_REGRA_ANALISE"
    join public."TH_REGRA_ANALISE" h
      on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE"
     and h."NU_VERSAO" = case when f."TP_SITUACAO" = 'CONCLUIDA' then f."NU_VERSAO_REGRA" else r."NU_VERSAO_VIGENTE" end
   where f."CO_FICHA_ANALISE" = p_ficha;
$function$;

-- 19. As regras que o Python lê, já com a data limite (17): conferências (com a versão da ficha, para o job
--     mandar para revisão só a que não mudou), robô de leitura e sugestões.
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
           f."CO_REGRA_ANALISE" as regra, f."NU_VERSAO_REGRA" as versao, f."NU_VERSAO" as versao_ficha,
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
           -- A versão da ficha: o job de conferências manda para revisão só a que não mudou (20261023090000).
           'versao', p.versao_ficha,
           'lancamento', p.lancamento, 'resultado', p.resultado, 'parecer', p.parecer,
           'documental', private."FC_DOCUMENTAL_DO_EDITAL"(p.edital)) order by p.ficha), '[]'::jsonb),
         coalesce((select jsonb_agg(jsonb_build_object('regra', h."CO_REGRA_ANALISE", 'versao', h."NU_VERSAO",
                                                       'configuracao', private."FC_REGRA_COM_DATA_LIMITE"(h."DS_CONFIGURACAO", rg."CO_MONITORAMENTO")))
                     from public."TH_REGRA_ANALISE" h
                     join public."TB_REGRA_ANALISE" rg on rg."CO_REGRA_ANALISE" = h."CO_REGRA_ANALISE"
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
                                            'regra', private."FC_REGRA_COM_DATA_LIMITE"(h."DS_CONFIGURACAO", m.id)) order by m.id)
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
                                                   'configuracao', private."FC_REGRA_COM_DATA_LIMITE"(h."DS_CONFIGURACAO", m.id))
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

-- 20. Datas dos vínculos ao salvar (rascunho e conclusão): nada antes de 1960 nem fim depois de hoje.
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
          -- 20261023090000: antes de 1960 é erro de leitura ou digitação; o fim depois de hoje
          -- (Brasília) é previsão, não experiência (o vínculo atual vai até a data limite).
          if (v_item.value ->> 'inicio')::date < date '1960-01-01' then
            raise exception 'Vínculo com data antes de 1960: confira o início.' using errcode = '22023';
          end if;
          if (v_item.value ->> 'fim')::date > (now() at time zone 'America/Sao_Paulo')::date then
            raise exception 'Vínculo com fim depois de hoje: o tempo comprovado vai até a data do documento.' using errcode = '22023';
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


-- 21. A correção de dados registrada como tal no histórico da ficha (TP_ACAO 'CORRIGIR'):
--     a de supabase/correcoes/20261023-114-experiencia-ate-o-fim-das-inscricoes.sql e as
--     próximas. Antes, só havia as ações da tela e dos jobs.
alter table public."TH_FICHA_ANALISE" drop constraint if exists "CK_THFICHA_TPACAO";
alter table public."TH_FICHA_ANALISE" add constraint "CK_THFICHA_TPACAO" check ("TP_ACAO"::text = any (array[
  'CRIAR', 'PEGAR', 'RESERVAR', 'LIBERAR', 'LIBERAR_RESERVA', 'DISTRIBUIR', 'REDISTRIBUIR', 'DEVOLVER_FILA', 'REVISAR',
  'SAIR_LOTE', 'VOLTAR_LOTE', 'SALVAR', 'CONCLUIR', 'REABRIR', 'REINICIAR', 'REFAZER_LOTE', 'MODALIDADE', 'CORRIGIR']));


-- ── E. Casos dourados (tests/fixtures/avaliacao-documental/casos-do-calculo-no-banco.json) ──
create temp table ensaio_fixture on commit drop as
select $dourados${"sobre":"Casos dourados do cálculo dos itens e das pendências da ficha nos três lados: a tela (calcularFicha e pendenciasDaFicha em src/lib/avaliacao-documental/ficha.js, com hoje = 2026-10-22), o Python (calcular_avaliacao em python/monitora/avaliacao_documental/pontuacao.py: calculados e experiência) e o banco (FC_CALCULADO_DO_BLOCO, FC_EXPERIENCIA_DA_FICHA, FC_VALIDAR_RESULTADO_FICHA e FC_PENDENCIAS_FICHA, conferidos no ensaio de supabase/ensaios/20261023090000_calculo_conferido_no_banco.sql, que leva este JSON). `data_limite` (opcional) vai no bloco de vínculos da regra (a data limite que o banco põe pelo fim das inscrições, FC_REGRA_COM_DATA_LIMITE). `resultado` é o DS_RESULTADO que a tela grava (resumoParaGravar). `banco.pendencias`: um trecho de cada pendência que o banco devolve, na ordem; `banco.recusa`: o trecho do erro de FC_VALIDAR_RESULTADO_FICHA (null = aceita). Dados fictícios. Mudou a regra, mude aqui e nos três lados.","hoje":"2026-10-22","documental":{"nota_minima":15,"nota_minima_por_nivel":{}},"regra":{"schema":1,"modelo":"PROJ26-CURRICULAR","titulo_etapa":"Avaliação Documental e de Títulos","edital_rotulo":"","casas_parecer":1,"provisoria":{"eliminacao_automatica":[{"codigo":"CANCELADO","coluna":"SITUAÇÃO","quando":["CANCELADO"],"motivo":"Cancelou a inscrição"}],"nota_declarada":[],"divergencia_tolerancia":0,"desempate":["IDOSO","EXPERIENCIA_DECLARADA","MAIOR_IDADE"],"pergunta_experiencia":"Pergunta 17 -"},"lote":{"base":"NOTA_MINIMA","multiplo":3,"fixo":null,"inclui_cr":true,"por_modalidade":false,"inclui_empatados":true,"linha_anda":true,"publica_reposicao":false,"nota_minima":15,"item_edital":"8.2.6"},"distribuicao":{"modo":"PEGAR_PROXIMO","criterio":"PARTES_IGUAIS","limite_por_analista":null,"novos":"MENOS_PENDENTES","dias_parada":3},"revisao":{"amostra_percentual":10,"minimo_por_analista":0,"todas":false,"inaptos_requisito":true,"inaptos_nota":false,"divergencia_pontos":null,"sinais":[],"entrou_pela_linha":false,"duplo_cego":false},"blocos":[{"codigo":"IDENTIDADE","titulo":"Documento de identificação oficial com foto","item_edital":"6.5","tipo":"DOCUMENTO","perguntas":[],"efeitos":{"NAO_CONFORME":"ELIMINA","NAO_ENVIADO":"ELIMINA"},"motivos":[{"codigo":"NAO_ACEITO","texto":"Documento de identificação fora da lista do subitem 6.5 (ex.: certidão, CPF, título de eleitor, carteira de estudante).","item_edital":"6.5.1","efeito":"ELIMINA"},{"codigo":"ILEGIVEL","texto":"Documento de identificação ilegível, não identificável ou danificado.","item_edital":"6.5.1","efeito":"ELIMINA"}]},{"codigo":"ESCOLARIDADE","titulo":"Formação exigida pela vaga (diploma ou certificado, frente e verso)","item_edital":"8.2.1","tipo":"DOCUMENTO","perguntas":[],"efeitos":{"NAO_CONFORME":"ELIMINA","NAO_ENVIADO":"ELIMINA"},"motivos":[{"codigo":"NAO_COMPROVADA","texto":"Não comprovou a formação acadêmica exigida para a vaga.","item_edital":"8.2.1","efeito":"ELIMINA"},{"codigo":"SEM_FRENTE_VERSO","texto":"Diploma ou certificado sem frente ou verso.","item_edital":"6.6.1","efeito":"ELIMINA"},{"codigo":"CURSO_DIVERSO","texto":"Curso diverso do exigido para a vaga.","item_edital":"8.2.1","efeito":"ELIMINA"}]},{"codigo":"REGISTRO_CONSELHO","titulo":"Registro ativo no conselho de classe, quando exigido","item_edital":"6.4","tipo":"DOCUMENTO","perguntas":[],"efeitos":{"NAO_CONFORME":"ELIMINA","NAO_ENVIADO":"ELIMINA"},"motivos":[{"codigo":"SEM_REGISTRO","texto":"Não apresentou registro ativo no conselho de classe exigido para a vaga.","item_edital":"6.4","efeito":"ELIMINA"}]},{"codigo":"COTA_PP","titulo":"Pretos e pardos (autodeclaração)","item_edital":"","tipo":"COTA","condicao":"MODALIDADE=PP","perguntas":[],"efeitos":{"CONFORME":"ENCAMINHA_HETEROIDENTIFICACAO","NAO_CONFORME":"SEGUE_AMPLA","NAO_ENVIADO":"SEGUE_AMPLA"},"motivos":[]},{"codigo":"COTA_PCD","titulo":"Pessoa com deficiência (laudo)","item_edital":"","tipo":"COTA","condicao":"MODALIDADE=PCD","perguntas":[],"efeitos":{"CONFORME":"ENCAMINHA_PERICIA","NAO_CONFORME":"SEGUE_AMPLA","NAO_ENVIADO":"SEGUE_AMPLA"},"motivos":[]},{"codigo":"COTA_PI","titulo":"Indígenas (documento de pertencimento étnico, Anexo VI)","item_edital":"5.7.5","tipo":"COTA","condicao":"MODALIDADE=PI","perguntas":[],"efeitos":{"CONFORME":"SO_REGISTRO","NAO_CONFORME":"SEGUE_AMPLA","NAO_ENVIADO":"SEGUE_AMPLA"},"motivos":[{"codigo":"SEM_LIDERANCA","texto":"Documento de pertencimento étnico sem a assinatura da liderança local (Anexo VI).","item_edital":"5.7.5","efeito":"SEGUE_AMPLA"},{"codigo":"FORA_DO_MODELO","texto":"Documento de pertencimento étnico fora do modelo do Anexo VI.","item_edital":"5.7.5","efeito":"SEGUE_AMPLA"}]},{"codigo":"COTA_PQ","titulo":"Quilombolas (declaração de pertencimento, Anexo VII, ou certificado da FCP)","item_edital":"5.7.6","tipo":"COTA","condicao":"MODALIDADE=PQ","perguntas":[],"efeitos":{"CONFORME":"SO_REGISTRO","NAO_CONFORME":"SEGUE_AMPLA","NAO_ENVIADO":"SEGUE_AMPLA"},"motivos":[{"codigo":"SEM_LIDERANCA","texto":"Declaração de pertencimento sem a assinatura da liderança ou associação local (Anexo VII).","item_edital":"5.7.6","efeito":"SEGUE_AMPLA"},{"codigo":"FORA_DO_MODELO","texto":"Declaração fora do modelo do Anexo VII e sem certificado da Fundação Cultural Palmares.","item_edital":"5.7.6","efeito":"SEGUE_AMPLA"}]},{"codigo":"FORMACAO","titulo":"Titulação acadêmica (a maior)","item_edital":"8.2.6","tipo":"TITULOS","parcial":"FORMACAO","perguntas":[],"cumulativa":false,"teto":10,"pontos_por_nivel":{"superior":[{"titulo":"ESPECIALIZACAO","pontos":5},{"titulo":"MESTRADO","pontos":8},{"titulo":"DOUTORADO","pontos":10}]},"efeitos":{},"motivos":[{"codigo":"LATO_SENSU_SEM_CH","texto":"Certificado de pós-graduação lato sensu sem a carga horária mínima de 360h não foi pontuado.","item_edital":"8.2.10.4"}]},{"codigo":"CURSOS","titulo":"Cursos de aperfeiçoamento na área da vaga (mínimo 40h)","item_edital":"8.2.6","tipo":"CURSOS","parcial":"CURSOS","perguntas":[],"teto":5,"faixas":[{"min_horas":40,"max_horas":60,"pontos":1},{"min_horas":61,"max_horas":119,"pontos":2},{"min_horas":120,"max_horas":null,"pontos":3}],"por_nivel":{"tecnico":{"teto":10,"faixas":[{"min_horas":40,"max_horas":60,"pontos":2},{"min_horas":61,"max_horas":119,"pontos":4},{"min_horas":120,"max_horas":null,"pontos":6}]},"medio":{"teto":10,"faixas":[{"min_horas":40,"max_horas":60,"pontos":2},{"min_horas":61,"max_horas":119,"pontos":4},{"min_horas":120,"max_horas":null,"pontos":6}]}},"efeitos":{},"motivos":[{"codigo":"EVENTO","texto":"Eventos acadêmicos, palestras, workshops, simpósios, seminários, congressos e afins não são pontuados.","item_edital":"6.4"}]},{"codigo":"EXPERIENCIA","titulo":"Experiência na área ou no SUS","item_edital":"8.2.6","tipo":"VINCULOS","parcial":"EXPERIENCIA","perguntas":[],"categorias":[{"codigo":"AREA_OU_SUS","rotulo":"Na área ou no SUS","desempate":null,"pontua":true}],"minimo_meses":6,"efeito_minimo":"ELIMINA","item_minimo":"1.1.1 c","pontuacao":"POR_PERIODO","pontos_por_mes":0,"periodo_meses":6,"pontos_por_periodo":5,"desconta_minimo":true,"teto":35,"por_nivel":{"tecnico":{"pontos_por_periodo":4,"teto":40},"medio":{"pontos_por_periodo":4,"teto":40}},"dias_por_mes":30,"unir_sobreposicao":true,"data_limite":null,"max_vinculos":20,"minimo_conta_estagio":false,"estagio_indigena":{"ativo":false,"horas_por_dia":8,"dias_por_mes":22,"so_sem_experiencia":true},"efeitos":{},"motivos":[{"codigo":"ANTES_DO_DIPLOMA","texto":"Experiência anterior à data de diplomação não é computada.","item_edital":"8.2.9"},{"codigo":"ESTAGIO_OU_SIMILAR","texto":"Estágio curricular, monitoria, tutoria, docência, bolsa ou voluntariado não comprovam experiência profissional.","item_edital":"8.2.5"}]}],"corte":{"fonte":"REGRA_CLASSIFICACAO","item_edital":"8.2.6"},"parecer":{"APTO":"{edital}\nCandidato(a) HABILITADO(A) na {titulo_etapa} com a pontuação total de {nota} pontos, distribuídos da seguinte forma:\n\n{distribuicao}","INAPTO_REQUISITO":"{edital}\nCandidato(a) INABILITADO(A) na {titulo_etapa}, pelo(s) seguinte(s) motivo(s):\n\n{motivos}","INAPTO_NOTA":"{edital}\nCandidato(a) NÃO HABILITADO(A) por não atingir a nota mínima de {corte} pontos (item {item_corte}). Nota obtida: {nota} pontos, distribuídos da seguinte forma:\n\n{distribuicao}","observacoes":"\n\nObservações da análise:\n{observacoes}"},"observacoes_prontas":[{"codigo":"ALTERACAO_DE_NOME","rotulo":"Alteração de nome sem documento","item_edital":"8.2.10.7","texto":"O candidato(a) não anexou o documento da alteração de nome; títulos e experiências em outro nome foram desconsiderados (subitem 8.2.10.7)."},{"codigo":"EXPERIENCIA_DIMINUIDA","rotulo":"Nota de experiência diminuída","item_edital":"8.2.3","texto":"Nota de experiência profissional diminuída em decorrência do tempo de serviço comprovado: só contam blocos completos de 6 meses além do mínimo exigido (subitens 8.2.2 a 8.2.4)."},{"codigo":"CURSOS_DIMINUIDA","rotulo":"Nota de cursos diminuída","item_edital":"6.4","texto":"Nota de cursos de aperfeiçoamento diminuída: certificados sem relação direta com a área da vaga, abaixo de 40h ou de eventos não foram contabilizados."}]},"casos":[{"nome":"tudo confere com os itens","lancamento":{"nivel":"superior","modalidade":"AC","modalidades":[],"indigena":false,"mora_aldeia":false,"aldeia_na_lista":false,"estagio_horas":0,"blocos":{"IDENTIDADE":{"situacao":"CONFORME","motivos":[]},"ESCOLARIDADE":{"situacao":"CONFORME","motivos":[]},"REGISTRO_CONSELHO":{"situacao":"CONFORME","motivos":[]},"FORMACAO":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":5,"motivos":[]},"CURSOS":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":3,"motivos":[]},"EXPERIENCIA":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":15,"motivos":[]}},"titulos":[{"titulo":"ESPECIALIZACAO","nome":"Especialização fictícia","aceito":true}],"cursos":[],"vinculos":[{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"2023-01-01","fim":"2024-12-31","aceito":true}],"observacoes_prontas":[]},"declarada":{"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15}},"resultado":{"resultado":"APTO","modalidade_final":"AC","modalidades_confirmadas":[],"nota_apurada":23,"nota_final":23,"nota_minima":15,"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"ajustes":{"FORMACAO":{"calculado":5,"ajustado":5},"CURSOS":{"calculado":0,"ajustado":3},"EXPERIENCIA":{"calculado":15,"ajustado":15}},"declarada":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"eliminatorios":[],"encaminhamentos":[],"observacoes":[],"experiencia":{"dias_total":731,"meses":24,"meses_considerados":24,"por_categoria":{"AREA_OU_SUS":{"dias_total":731,"anos":2,"meses":0,"dias":1,"desempate":null}}}},"esperado":{"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"resultado":"APTO","experiencia":{"dias_total":731,"meses":24,"meses_considerados":24},"pendencias":[],"banco":{"pendencias":[],"recusa":null}}},{"nome":"Confere da titulação com Doutorado declarado e só a Especialização registrada: acima","lancamento":{"nivel":"superior","modalidade":"AC","modalidades":[],"indigena":false,"mora_aldeia":false,"aldeia_na_lista":false,"estagio_horas":0,"blocos":{"IDENTIDADE":{"situacao":"CONFORME","motivos":[]},"ESCOLARIDADE":{"situacao":"CONFORME","motivos":[]},"REGISTRO_CONSELHO":{"situacao":"CONFORME","motivos":[]},"FORMACAO":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":10,"motivos":[]},"CURSOS":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":3,"motivos":[]},"EXPERIENCIA":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":15,"motivos":[]}},"titulos":[{"titulo":"ESPECIALIZACAO","nome":"Especialização fictícia","aceito":true}],"cursos":[],"vinculos":[{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"2023-01-01","fim":"2024-12-31","aceito":true}],"observacoes_prontas":[]},"declarada":{"parciais":{"FORMACAO":10,"CURSOS":3,"EXPERIENCIA":15}},"resultado":{"resultado":"APTO","modalidade_final":"AC","modalidades_confirmadas":[],"nota_apurada":28,"nota_final":28,"nota_minima":15,"parciais":{"FORMACAO":10,"CURSOS":3,"EXPERIENCIA":15},"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"ajustes":{"FORMACAO":{"calculado":5,"ajustado":10},"CURSOS":{"calculado":0,"ajustado":3},"EXPERIENCIA":{"calculado":15,"ajustado":15}},"declarada":{"FORMACAO":10,"CURSOS":3,"EXPERIENCIA":15},"eliminatorios":[],"encaminhamentos":[],"observacoes":[],"experiencia":{"dias_total":731,"meses":24,"meses_considerados":24,"por_categoria":{"AREA_OU_SUS":{"dias_total":731,"anos":2,"meses":0,"dias":1,"desempate":null}}}},"esperado":{"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"parciais":{"FORMACAO":10,"CURSOS":3,"EXPERIENCIA":15},"resultado":"APTO","experiencia":{"dias_total":731,"meses":24,"meses_considerados":24},"pendencias":[{"bloco":"FORMACAO","tipo":"acima"}],"banco":{"pendencias":["acima do que"],"recusa":"acima do que os itens registrados dão"}}},{"nome":"Editar nota da titulação acima dos itens, com justificativa: aceito","lancamento":{"nivel":"superior","modalidade":"AC","modalidades":[],"indigena":false,"mora_aldeia":false,"aldeia_na_lista":false,"estagio_horas":0,"blocos":{"IDENTIDADE":{"situacao":"CONFORME","motivos":[]},"ESCOLARIDADE":{"situacao":"CONFORME","motivos":[]},"REGISTRO_CONSELHO":{"situacao":"CONFORME","motivos":[]},"FORMACAO":{"situacao":"CONFORME","edita_nota":true,"nota_ajustada":10,"justificativas":["LATO_SENSU_SEM_CH"],"motivos":[]},"CURSOS":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":3,"motivos":[]},"EXPERIENCIA":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":15,"motivos":[]}},"titulos":[{"titulo":"ESPECIALIZACAO","nome":"Especialização fictícia","aceito":true}],"cursos":[],"vinculos":[{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"2023-01-01","fim":"2024-12-31","aceito":true}],"observacoes_prontas":[]},"declarada":{"parciais":{"FORMACAO":10,"CURSOS":3,"EXPERIENCIA":15}},"resultado":{"resultado":"APTO","modalidade_final":"AC","modalidades_confirmadas":[],"nota_apurada":28,"nota_final":28,"nota_minima":15,"parciais":{"FORMACAO":10,"CURSOS":3,"EXPERIENCIA":15},"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"ajustes":{"FORMACAO":{"calculado":5,"ajustado":10},"CURSOS":{"calculado":0,"ajustado":3},"EXPERIENCIA":{"calculado":15,"ajustado":15}},"declarada":{"FORMACAO":10,"CURSOS":3,"EXPERIENCIA":15},"eliminatorios":[],"encaminhamentos":[],"observacoes":["Item 8.2.10.4: Certificado de pós-graduação lato sensu sem a carga horária mínima de 360h não foi pontuado."],"experiencia":{"dias_total":731,"meses":24,"meses_considerados":24,"por_categoria":{"AREA_OU_SUS":{"dias_total":731,"anos":2,"meses":0,"dias":1,"desempate":null}}}},"esperado":{"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"parciais":{"FORMACAO":10,"CURSOS":3,"EXPERIENCIA":15},"resultado":"APTO","experiencia":{"dias_total":731,"meses":24,"meses_considerados":24},"pendencias":[],"banco":{"pendencias":[],"recusa":null}}},{"nome":"Confere da experiência abaixo do que os vínculos comprovam: vale a declarada, sem pendência","lancamento":{"nivel":"superior","modalidade":"AC","modalidades":[],"indigena":false,"mora_aldeia":false,"aldeia_na_lista":false,"estagio_horas":0,"blocos":{"IDENTIDADE":{"situacao":"CONFORME","motivos":[]},"ESCOLARIDADE":{"situacao":"CONFORME","motivos":[]},"REGISTRO_CONSELHO":{"situacao":"CONFORME","motivos":[]},"FORMACAO":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":5,"motivos":[]},"CURSOS":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":3,"motivos":[]},"EXPERIENCIA":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":5,"motivos":[]}},"titulos":[{"titulo":"ESPECIALIZACAO","nome":"Especialização fictícia","aceito":true}],"cursos":[],"vinculos":[{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"2023-01-01","fim":"2024-12-31","aceito":true}],"observacoes_prontas":[]},"declarada":{"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":5}},"resultado":{"resultado":"INAPTO_NOTA","modalidade_final":"AC","modalidades_confirmadas":[],"nota_apurada":13,"nota_final":13,"nota_minima":15,"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":5},"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"ajustes":{"FORMACAO":{"calculado":5,"ajustado":5},"CURSOS":{"calculado":0,"ajustado":3},"EXPERIENCIA":{"calculado":15,"ajustado":5}},"declarada":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":5},"eliminatorios":[],"encaminhamentos":[],"observacoes":[],"experiencia":{"dias_total":731,"meses":24,"meses_considerados":24,"por_categoria":{"AREA_OU_SUS":{"dias_total":731,"anos":2,"meses":0,"dias":1,"desempate":null}}}},"esperado":{"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":5},"resultado":"INAPTO_NOTA","experiencia":{"dias_total":731,"meses":24,"meses_considerados":24},"pendencias":[],"banco":{"pendencias":[],"recusa":null}}},{"nome":"Editar nota pelo calculado (sem ajuste): aceito, com a justificativa da declarada","lancamento":{"nivel":"superior","modalidade":"AC","modalidades":[],"indigena":false,"mora_aldeia":false,"aldeia_na_lista":false,"estagio_horas":0,"blocos":{"IDENTIDADE":{"situacao":"CONFORME","motivos":[]},"ESCOLARIDADE":{"situacao":"CONFORME","motivos":[]},"REGISTRO_CONSELHO":{"situacao":"CONFORME","motivos":[]},"FORMACAO":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":5,"motivos":[]},"CURSOS":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":3,"motivos":[]},"EXPERIENCIA":{"situacao":"CONFORME","edita_nota":true,"nota_ajustada":null,"justificativas":["ANTES_DO_DIPLOMA"],"motivos":[]}},"titulos":[{"titulo":"ESPECIALIZACAO","nome":"Especialização fictícia","aceito":true}],"cursos":[],"vinculos":[{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"2023-01-01","fim":"2024-12-31","aceito":true}],"observacoes_prontas":[]},"declarada":{"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":5}},"resultado":{"resultado":"APTO","modalidade_final":"AC","modalidades_confirmadas":[],"nota_apurada":23,"nota_final":23,"nota_minima":15,"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"ajustes":{"FORMACAO":{"calculado":5,"ajustado":5},"CURSOS":{"calculado":0,"ajustado":3}},"declarada":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":5},"eliminatorios":[],"encaminhamentos":[],"observacoes":["Item 8.2.9: Experiência anterior à data de diplomação não é computada."],"experiencia":{"dias_total":731,"meses":24,"meses_considerados":24,"por_categoria":{"AREA_OU_SUS":{"dias_total":731,"anos":2,"meses":0,"dias":1,"desempate":null}}}},"esperado":{"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"resultado":"APTO","experiencia":{"dias_total":731,"meses":24,"meses_considerados":24},"pendencias":[],"banco":{"pendencias":[],"recusa":null}}},{"nome":"Não enviou a experiência com os vínculos aceitos cumprindo o mínimo: pendência do mínimo","lancamento":{"nivel":"superior","modalidade":"AC","modalidades":[],"indigena":false,"mora_aldeia":false,"aldeia_na_lista":false,"estagio_horas":0,"blocos":{"IDENTIDADE":{"situacao":"CONFORME","motivos":[]},"ESCOLARIDADE":{"situacao":"CONFORME","motivos":[]},"REGISTRO_CONSELHO":{"situacao":"CONFORME","motivos":[]},"FORMACAO":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":5,"motivos":[]},"CURSOS":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":3,"motivos":[]},"EXPERIENCIA":{"situacao":"NAO_ENVIADO","motivos":["ESTAGIO_OU_SIMILAR"],"nota_ajustada":0}},"titulos":[{"titulo":"ESPECIALIZACAO","nome":"Especialização fictícia","aceito":true}],"cursos":[],"vinculos":[{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"2023-01-01","fim":"2024-12-31","aceito":true}],"observacoes_prontas":[]},"declarada":{"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15}},"resultado":{"resultado":"INAPTO_NOTA","modalidade_final":"AC","modalidades_confirmadas":[],"nota_apurada":8,"nota_final":8,"nota_minima":15,"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":0},"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"ajustes":{"FORMACAO":{"calculado":5,"ajustado":5},"CURSOS":{"calculado":0,"ajustado":3},"EXPERIENCIA":{"calculado":15,"ajustado":0}},"declarada":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"eliminatorios":[],"encaminhamentos":[],"observacoes":["Item 8.2.5: Estágio curricular, monitoria, tutoria, docência, bolsa ou voluntariado não comprovam experiência profissional."],"experiencia":{"dias_total":731,"meses":24,"meses_considerados":24,"por_categoria":{"AREA_OU_SUS":{"dias_total":731,"anos":2,"meses":0,"dias":1,"desempate":null}}}},"esperado":{"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":0},"resultado":"INAPTO_NOTA","experiencia":{"dias_total":731,"meses":24,"meses_considerados":24},"pendencias":[{"bloco":"EXPERIENCIA","tipo":"minimo"}],"banco":{"pendencias":["marcada como"],"recusa":null}}},{"nome":"Não confere a experiência com o mínimo, mas eliminado pela identidade: sem pendência","lancamento":{"nivel":"superior","modalidade":"AC","modalidades":[],"indigena":false,"mora_aldeia":false,"aldeia_na_lista":false,"estagio_horas":0,"blocos":{"IDENTIDADE":{"situacao":"NAO_CONFORME","motivos":["ILEGIVEL"]},"ESCOLARIDADE":{"situacao":"CONFORME","motivos":[]},"REGISTRO_CONSELHO":{"situacao":"CONFORME","motivos":[]},"FORMACAO":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":5,"motivos":[]},"CURSOS":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":3,"motivos":[]},"EXPERIENCIA":{"situacao":"NAO_CONFORME","motivos":["ESTAGIO_OU_SIMILAR"],"nota_ajustada":0}},"titulos":[{"titulo":"ESPECIALIZACAO","nome":"Especialização fictícia","aceito":true}],"cursos":[],"vinculos":[{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"2023-01-01","fim":"2024-12-31","aceito":true}],"observacoes_prontas":[]},"declarada":{"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15}},"resultado":{"resultado":"INAPTO_REQUISITO","modalidade_final":"AC","modalidades_confirmadas":[],"nota_apurada":8,"nota_final":0,"nota_minima":15,"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":0},"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"ajustes":{"FORMACAO":{"calculado":5,"ajustado":5},"CURSOS":{"calculado":0,"ajustado":3},"EXPERIENCIA":{"calculado":15,"ajustado":0}},"declarada":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"eliminatorios":["Item 6.5.1: Documento de identificação ilegível, não identificável ou danificado."],"encaminhamentos":[],"observacoes":["Item 8.2.5: Estágio curricular, monitoria, tutoria, docência, bolsa ou voluntariado não comprovam experiência profissional."],"experiencia":{"dias_total":731,"meses":24,"meses_considerados":24,"por_categoria":{"AREA_OU_SUS":{"dias_total":731,"anos":2,"meses":0,"dias":1,"desempate":null}}}},"esperado":{"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":0},"resultado":"INAPTO_REQUISITO","experiencia":{"dias_total":731,"meses":24,"meses_considerados":24},"pendencias":[],"banco":{"pendencias":[],"recusa":null}}},{"nome":"Não confere a experiência com o mínimo e nada mais elimina: pendência do mínimo","lancamento":{"nivel":"superior","modalidade":"AC","modalidades":[],"indigena":false,"mora_aldeia":false,"aldeia_na_lista":false,"estagio_horas":0,"blocos":{"IDENTIDADE":{"situacao":"CONFORME","motivos":[]},"ESCOLARIDADE":{"situacao":"CONFORME","motivos":[]},"REGISTRO_CONSELHO":{"situacao":"CONFORME","motivos":[]},"FORMACAO":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":5,"motivos":[]},"CURSOS":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":3,"motivos":[]},"EXPERIENCIA":{"situacao":"NAO_CONFORME","motivos":["ESTAGIO_OU_SIMILAR"],"nota_ajustada":0}},"titulos":[{"titulo":"ESPECIALIZACAO","nome":"Especialização fictícia","aceito":true}],"cursos":[],"vinculos":[{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"2023-01-01","fim":"2024-12-31","aceito":true}],"observacoes_prontas":[]},"declarada":{"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15}},"resultado":{"resultado":"INAPTO_NOTA","modalidade_final":"AC","modalidades_confirmadas":[],"nota_apurada":8,"nota_final":8,"nota_minima":15,"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":0},"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"ajustes":{"FORMACAO":{"calculado":5,"ajustado":5},"CURSOS":{"calculado":0,"ajustado":3},"EXPERIENCIA":{"calculado":15,"ajustado":0}},"declarada":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"eliminatorios":[],"encaminhamentos":[],"observacoes":["Item 8.2.5: Estágio curricular, monitoria, tutoria, docência, bolsa ou voluntariado não comprovam experiência profissional."],"experiencia":{"dias_total":731,"meses":24,"meses_considerados":24,"por_categoria":{"AREA_OU_SUS":{"dias_total":731,"anos":2,"meses":0,"dias":1,"desempate":null}}}},"esperado":{"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":0},"resultado":"INAPTO_NOTA","experiencia":{"dias_total":731,"meses":24,"meses_considerados":24},"pendencias":[{"bloco":"EXPERIENCIA","tipo":"minimo"}],"banco":{"pendencias":["marcada como"],"recusa":null}}},{"nome":"Vínculo com o fim depois de hoje: pendência das datas","lancamento":{"nivel":"superior","modalidade":"AC","modalidades":[],"indigena":false,"mora_aldeia":false,"aldeia_na_lista":false,"estagio_horas":0,"blocos":{"IDENTIDADE":{"situacao":"CONFORME","motivos":[]},"ESCOLARIDADE":{"situacao":"CONFORME","motivos":[]},"REGISTRO_CONSELHO":{"situacao":"CONFORME","motivos":[]},"FORMACAO":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":5,"motivos":[]},"CURSOS":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":3,"motivos":[]},"EXPERIENCIA":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":15,"motivos":[]}},"titulos":[{"titulo":"ESPECIALIZACAO","nome":"Especialização fictícia","aceito":true}],"cursos":[],"vinculos":[{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"2023-01-01","fim":"2024-12-31","aceito":true},{"empregador":"Contrato fictício","categoria":"AREA_OU_SUS","inicio":"2025-01-01","fim":"2099-12-31","aceito":true}],"observacoes_prontas":[]},"declarada":{"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":35}},"resultado":{"resultado":"APTO","modalidade_final":"AC","modalidades_confirmadas":[],"nota_apurada":23,"nota_final":23,"nota_minima":15,"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":35},"ajustes":{"FORMACAO":{"calculado":5,"ajustado":5},"CURSOS":{"calculado":0,"ajustado":3},"EXPERIENCIA":{"calculado":35,"ajustado":15}},"declarada":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":35},"eliminatorios":[],"encaminhamentos":[],"observacoes":[],"experiencia":{"dias_total":28124,"meses":937,"meses_considerados":937,"por_categoria":{"AREA_OU_SUS":{"dias_total":28124,"anos":77,"meses":0,"dias":19,"desempate":null}}}},"esperado":{"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":35},"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"resultado":"APTO","experiencia":{"dias_total":28124,"meses":937,"meses_considerados":937},"pendencias":[{"bloco":"EXPERIENCIA","tipo":"datas"},{"bloco":"EXPERIENCIA","tipo":"justificativa"}],"banco":{"pendencias":["vínculo com","nota diferente da declarada"],"recusa":null}}},{"nome":"Vínculo antes de 1960: pendência das datas","lancamento":{"nivel":"superior","modalidade":"AC","modalidades":[],"indigena":false,"mora_aldeia":false,"aldeia_na_lista":false,"estagio_horas":0,"blocos":{"IDENTIDADE":{"situacao":"CONFORME","motivos":[]},"ESCOLARIDADE":{"situacao":"CONFORME","motivos":[]},"REGISTRO_CONSELHO":{"situacao":"CONFORME","motivos":[]},"FORMACAO":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":5,"motivos":[]},"CURSOS":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":3,"motivos":[]},"EXPERIENCIA":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":15,"motivos":[]}},"titulos":[{"titulo":"ESPECIALIZACAO","nome":"Especialização fictícia","aceito":true}],"cursos":[],"vinculos":[{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"1950-01-01","fim":"1951-12-31","aceito":true},{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"2023-01-01","fim":"2024-12-31","aceito":true}],"observacoes_prontas":[]},"declarada":{"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15}},"resultado":{"resultado":"APTO","modalidade_final":"AC","modalidades_confirmadas":[],"nota_apurada":23,"nota_final":23,"nota_minima":15,"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":35},"ajustes":{"FORMACAO":{"calculado":5,"ajustado":5},"CURSOS":{"calculado":0,"ajustado":3},"EXPERIENCIA":{"calculado":35,"ajustado":15}},"declarada":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"eliminatorios":[],"encaminhamentos":[],"observacoes":[],"experiencia":{"dias_total":1461,"meses":48,"meses_considerados":48,"por_categoria":{"AREA_OU_SUS":{"dias_total":1461,"anos":4,"meses":0,"dias":1,"desempate":null}}}},"esperado":{"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":35},"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"resultado":"APTO","experiencia":{"dias_total":1461,"meses":48,"meses_considerados":48},"pendencias":[{"bloco":"EXPERIENCIA","tipo":"datas"}],"banco":{"pendencias":["vínculo com"],"recusa":null}}},{"nome":"Cursos pela nota (sem a lista): o Confere vale a declarada","lancamento":{"nivel":"superior","modalidade":"AC","modalidades":[],"indigena":false,"mora_aldeia":false,"aldeia_na_lista":false,"estagio_horas":0,"blocos":{"IDENTIDADE":{"situacao":"CONFORME","motivos":[]},"ESCOLARIDADE":{"situacao":"CONFORME","motivos":[]},"REGISTRO_CONSELHO":{"situacao":"CONFORME","motivos":[]},"FORMACAO":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":5,"motivos":[]},"CURSOS":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":3,"motivos":[]},"EXPERIENCIA":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":15,"motivos":[]}},"titulos":[{"titulo":"ESPECIALIZACAO","nome":"Especialização fictícia","aceito":true}],"cursos":[],"vinculos":[{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"2023-01-01","fim":"2024-12-31","aceito":true}],"observacoes_prontas":[]},"declarada":{"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15}},"resultado":{"resultado":"APTO","modalidade_final":"AC","modalidades_confirmadas":[],"nota_apurada":23,"nota_final":23,"nota_minima":15,"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"ajustes":{"FORMACAO":{"calculado":5,"ajustado":5},"CURSOS":{"calculado":0,"ajustado":3},"EXPERIENCIA":{"calculado":15,"ajustado":15}},"declarada":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"eliminatorios":[],"encaminhamentos":[],"observacoes":[],"experiencia":{"dias_total":731,"meses":24,"meses_considerados":24,"por_categoria":{"AREA_OU_SUS":{"dias_total":731,"anos":2,"meses":0,"dias":1,"desempate":null}}}},"esperado":{"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"resultado":"APTO","experiencia":{"dias_total":731,"meses":24,"meses_considerados":24},"pendencias":[],"banco":{"pendencias":[],"recusa":null}}},{"nome":"Cursos com a lista (ficha antiga) e Confere acima dos cursos aceitos: acima","lancamento":{"nivel":"superior","modalidade":"AC","modalidades":[],"indigena":false,"mora_aldeia":false,"aldeia_na_lista":false,"estagio_horas":0,"blocos":{"IDENTIDADE":{"situacao":"CONFORME","motivos":[]},"ESCOLARIDADE":{"situacao":"CONFORME","motivos":[]},"REGISTRO_CONSELHO":{"situacao":"CONFORME","motivos":[]},"FORMACAO":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":5,"motivos":[]},"CURSOS":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":3,"motivos":[]},"EXPERIENCIA":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":15,"motivos":[]}},"titulos":[{"titulo":"ESPECIALIZACAO","nome":"Especialização fictícia","aceito":true}],"cursos":[{"nome":"Curso fictício","horas":45,"aceito":true}],"vinculos":[{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"2023-01-01","fim":"2024-12-31","aceito":true}],"observacoes_prontas":[]},"declarada":{"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15}},"resultado":{"resultado":"APTO","modalidade_final":"AC","modalidades_confirmadas":[],"nota_apurada":23,"nota_final":23,"nota_minima":15,"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"calculados":{"FORMACAO":5,"CURSOS":1,"EXPERIENCIA":15},"ajustes":{"FORMACAO":{"calculado":5,"ajustado":5},"CURSOS":{"calculado":1,"ajustado":3},"EXPERIENCIA":{"calculado":15,"ajustado":15}},"declarada":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"eliminatorios":[],"encaminhamentos":[],"observacoes":[],"experiencia":{"dias_total":731,"meses":24,"meses_considerados":24,"por_categoria":{"AREA_OU_SUS":{"dias_total":731,"anos":2,"meses":0,"dias":1,"desempate":null}}}},"esperado":{"calculados":{"FORMACAO":5,"CURSOS":1,"EXPERIENCIA":15},"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"resultado":"APTO","experiencia":{"dias_total":731,"meses":24,"meses_considerados":24},"pendencias":[{"bloco":"CURSOS","tipo":"acima"}],"banco":{"pendencias":["acima do que"],"recusa":"acima do que os itens registrados dão"}}},{"nome":"Sobreposição e emenda do dia seguinte contam uma vez","lancamento":{"nivel":"superior","modalidade":"AC","modalidades":[],"indigena":false,"mora_aldeia":false,"aldeia_na_lista":false,"estagio_horas":0,"blocos":{"IDENTIDADE":{"situacao":"CONFORME","motivos":[]},"ESCOLARIDADE":{"situacao":"CONFORME","motivos":[]},"REGISTRO_CONSELHO":{"situacao":"CONFORME","motivos":[]},"FORMACAO":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":5,"motivos":[]},"CURSOS":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":3,"motivos":[]},"EXPERIENCIA":{"situacao":"CONFORME","edita_nota":true,"nota_ajustada":null,"motivos":[]}},"titulos":[{"titulo":"ESPECIALIZACAO","nome":"Especialização fictícia","aceito":true}],"cursos":[],"vinculos":[{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"2020-01-01","fim":"2020-12-31","aceito":true},{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"2020-06-01","fim":"2021-06-30","aceito":true},{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"2021-07-01","fim":"2021-12-31","aceito":true},{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"2019-01-01","fim":"2019-03-31","aceito":false,"motivo":"FORA_DA_AREA"}],"observacoes_prontas":[]},"declarada":{"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15}},"resultado":{"resultado":"APTO","modalidade_final":"AC","modalidades_confirmadas":[],"nota_apurada":23,"nota_final":23,"nota_minima":15,"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"ajustes":{"FORMACAO":{"calculado":5,"ajustado":5},"CURSOS":{"calculado":0,"ajustado":3}},"declarada":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"eliminatorios":[],"encaminhamentos":[],"observacoes":[],"experiencia":{"dias_total":731,"meses":24,"meses_considerados":24,"por_categoria":{"AREA_OU_SUS":{"dias_total":731,"anos":2,"meses":0,"dias":1,"desempate":null}}}},"esperado":{"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":15},"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"resultado":"APTO","experiencia":{"dias_total":731,"meses":24,"meses_considerados":24},"pendencias":[],"banco":{"pendencias":[],"recusa":null}}},{"nome":"Data limite do bloco (fim das inscrições) corta os dias depois dela","data_limite":"2024-06-30","lancamento":{"nivel":"superior","modalidade":"AC","modalidades":[],"indigena":false,"mora_aldeia":false,"aldeia_na_lista":false,"estagio_horas":0,"blocos":{"IDENTIDADE":{"situacao":"CONFORME","motivos":[]},"ESCOLARIDADE":{"situacao":"CONFORME","motivos":[]},"REGISTRO_CONSELHO":{"situacao":"CONFORME","motivos":[]},"FORMACAO":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":5,"motivos":[]},"CURSOS":{"situacao":"CONFORME","edita_nota":false,"nota_ajustada":3,"motivos":[]},"EXPERIENCIA":{"situacao":"CONFORME","edita_nota":true,"nota_ajustada":null,"justificativas":["ANTES_DO_DIPLOMA"],"motivos":[]}},"titulos":[{"titulo":"ESPECIALIZACAO","nome":"Especialização fictícia","aceito":true}],"cursos":[],"vinculos":[{"empregador":"Empresa fictícia","categoria":"AREA_OU_SUS","inicio":"2023-01-01","fim":"2024-12-31","aceito":true}],"observacoes_prontas":[]},"declarada":{"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15}},"resultado":{"resultado":"APTO","modalidade_final":"AC","modalidades_confirmadas":[],"nota_apurada":18,"nota_final":18,"nota_minima":15,"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":10},"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":10},"ajustes":{"FORMACAO":{"calculado":5,"ajustado":5},"CURSOS":{"calculado":0,"ajustado":3}},"declarada":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":15},"eliminatorios":[],"encaminhamentos":[],"observacoes":["Item 8.2.9: Experiência anterior à data de diplomação não é computada."],"experiencia":{"dias_total":547,"meses":18,"meses_considerados":18,"por_categoria":{"AREA_OU_SUS":{"dias_total":547,"anos":1,"meses":6,"dias":2,"desempate":null}}}},"esperado":{"calculados":{"FORMACAO":5,"CURSOS":0,"EXPERIENCIA":10},"parciais":{"FORMACAO":5,"CURSOS":3,"EXPERIENCIA":10},"resultado":"APTO","experiencia":{"dias_total":547,"meses":18,"meses_considerados":18},"pendencias":[],"banco":{"pendencias":[],"recusa":null}}}]}$dourados$::jsonb as f;

create function pg_temp.erro_dourado(p_regra jsonb, p_lanc jsonb, p_res jsonb, p_doc jsonb) returns text
language plpgsql as $$
begin
  perform private."FC_VALIDAR_RESULTADO_FICHA"(p_regra, p_lanc, p_res, p_doc);
  return null;
exception when others then
  return sqlerrm;
end $$;

create temp table ensaio_dourados on commit drop as
with casos as (
  select c ->> 'nome' as nome, c -> 'lancamento' as l, c -> 'resultado' as r, c -> 'esperado' as e,
         private."FC_REGRA_DA_VAGA"(
           case when c ? 'data_limite'
                then jsonb_set(x.f -> 'regra', '{blocos}', (
                       select jsonb_agg(case when b ->> 'tipo' = 'VINCULOS' then b || jsonb_build_object('data_limite', c -> 'data_limite') else b end order by n)
                         from jsonb_array_elements(x.f #> '{regra,blocos}') with ordinality y(b, n)))
                else x.f -> 'regra' end,
           'DOURADO', null, c #>> '{lancamento,nivel}') as regra, x.f -> 'documental' as doc
    from ensaio_fixture x cross join lateral jsonb_array_elements(x.f -> 'casos') c),
conta as (
  select casos.*,
         (select coalesce(jsonb_object_agg(private."FC_PARCIAL_DO_TIPO"(b ->> 'tipo'),
                   case when private."FC_EFEITO_DO_BLOCO"(b, l #> array['blocos', b ->> 'codigo']) in ('ELIMINA', 'ZERA_PONTOS') then 0
                        else private."FC_CALCULADO_DO_BLOCO"(b, l) end), '{}'::jsonb)
            from jsonb_array_elements(regra -> 'blocos') b where b ->> 'tipo' in ('TITULOS', 'CURSOS', 'VINCULOS')) as calculados,
         (select private."FC_EXPERIENCIA_DA_FICHA"(b, l) from jsonb_array_elements(regra -> 'blocos') b
           where b ->> 'tipo' = 'VINCULOS' limit 1) as exp,
         pg_temp.erro_dourado(regra, l, r, doc) as erro,
         private."FC_PENDENCIAS_FICHA"(regra, l, r) as pend
    from casos)
select nome,
       array_remove(array[
         case when exists (select 1 from jsonb_each(e -> 'calculados') k
                            where abs((k.value #>> '{}')::numeric - (calculados ->> k.key)::numeric) > 0.0001)
              then 'calculados ' || calculados::text end,
         case when (exp -> 'dias_total') is distinct from (e #> '{experiencia,dias_total}')
                or (exp -> 'meses') is distinct from (e #> '{experiencia,meses}')
                or (exp -> 'meses_considerados') is distinct from (e #> '{experiencia,meses_considerados}')
              then 'experiência ' || (exp - 'por_categoria')::text end,
         case when (e #>> '{banco,recusa}') is null and erro is not null then 'recusou: ' || erro
              when (e #>> '{banco,recusa}') is not null and coalesce(erro, '') not like '%' || (e #>> '{banco,recusa}') || '%'
              then 'devia recusar (' || (e #>> '{banco,recusa}') || '): ' || coalesce(erro, 'aceitou') end,
         case when cardinality(pend) <> jsonb_array_length(e #> '{banco,pendencias}')
                or exists (select 1 from jsonb_array_elements_text(e #> '{banco,pendencias}') with ordinality t(trecho, i)
                            where pend[i] not like '%' || t.trecho || '%')
              then 'pendências: ' || array_to_string(pend, ' | ') end], null) as falhas
  from conta;

-- ── Conferências do ensaio (nada fica: termina em rollback) ──────────────────────────

-- A. Paridade com a tela: o calculado e a experiência gravados por calcularAvaliacao nas
--    fichas concluídas ou em revisão são os que o banco recalcula com a regra como estava
--    (sem a data limite padrão; esperado: 0 divergências). A2: o que a data limite padrão
--    (fim das inscrições) muda na experiência e nos pontos.
create temp table ensaio_fichas on commit drop as
select f."CO_FICHA_ANALISE" as id, f."TP_SITUACAO" as situacao, f."TP_RESULTADO" as res,
       f."VL_NOTA_FINAL" as nota, f."NU_VERSAO" as versao, f."DS_RESULTADO" as r, f."CO_MONITORAMENTO" as m,
       f."DS_LANCAMENTO" || jsonb_build_object('vaga', f."CO_VAGA", 'cargo', pv."NO_CARGO") as l,
       private."FC_REGRA_DA_VAGA"(rv.p_configuracao, f."CO_VAGA", pv."NO_CARGO", f."DS_LANCAMENTO" ->> 'nivel') as conf,
       private."FC_REGRA_DA_VAGA"(h."DS_CONFIGURACAO", f."CO_VAGA", pv."NO_CARGO", f."DS_LANCAMENTO" ->> 'nivel') as conf_bruta
  from public."TB_FICHA_ANALISE" f
  join public."TH_REGRA_ANALISE" h on h."CO_REGRA_ANALISE" = f."CO_REGRA_ANALISE" and h."NU_VERSAO" = f."NU_VERSAO_REGRA"
  left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and pv."CO_VAGA" = f."CO_VAGA"
  cross join lateral private."FC_REGRA_VIGENTE_FICHA"(f."CO_FICHA_ANALISE") rv
 where f."TP_SITUACAO" in ('CONCLUIDA', 'REVISAR')
   and jsonb_typeof(f."DS_RESULTADO") = 'object' and jsonb_typeof(f."DS_LANCAMENTO") = 'object';

create temp table ensaio_paridade on commit drop as
select b.id, b.parcial,
       abs(coalesce((b.r #>> array['calculados', b.parcial])::numeric, -1)
           - case when private."FC_EFEITO_DO_BLOCO"(b.bloco, b.l #> array['blocos', b.bloco ->> 'codigo']) in ('ELIMINA', 'ZERA_PONTOS')
                  then 0 else private."FC_CALCULADO_DO_BLOCO"(b.bloco, b.l) end) > 0.0001 as calculado_diverge,
       b.bloco ->> 'tipo' = 'VINCULOS' and (
         (b.r #> '{experiencia,dias_total}') is distinct from (e.x -> 'dias_total')
         or (b.r #> '{experiencia,meses}') is distinct from (e.x -> 'meses')
         or (b.r #> '{experiencia,meses_considerados}') is distinct from (e.x -> 'meses_considerados')) as experiencia_diverge
  from (select f.*, x as bloco, private."FC_PARCIAL_DO_TIPO"(x ->> 'tipo') as parcial
          from ensaio_fichas f cross join lateral jsonb_array_elements(f.conf_bruta -> 'blocos') x
         where x ->> 'tipo' in ('TITULOS', 'CURSOS', 'VINCULOS') and private."FC_BLOCO_SE_APLICA"(x, f.l)) b
  cross join lateral (select private."FC_EXPERIENCIA_DA_FICHA"(b.bloco, b.l) as x) e;

create temp table ensaio_data_limite on commit drop as
select f.id, f.situacao, f.res, (a.x ->> 'dias_total')::integer as dias_antes, (d.x ->> 'dias_total')::integer as dias_depois,
       (a.x ->> 'pontos')::numeric as pontos_antes, (d.x ->> 'pontos')::numeric as pontos_depois
  from ensaio_fichas f
  cross join lateral (select y as bloco from jsonb_array_elements(f.conf_bruta -> 'blocos') y where y ->> 'tipo' = 'VINCULOS' limit 1) vb
  cross join lateral (select y as bloco from jsonb_array_elements(f.conf -> 'blocos') y where y ->> 'tipo' = 'VINCULOS' limit 1) vc
  cross join lateral (select private."FC_EXPERIENCIA_DA_FICHA"(vb.bloco, f.l) as x) a
  cross join lateral (select private."FC_EXPERIENCIA_DA_FICHA"(vc.bloco, f.l) as x) d
 where (a.x -> 'dias_total') is distinct from (d.x -> 'dias_total');

-- (foto da situação logo depois do corpo da migration, antes da RPC do item E)
create temp table ensaio_situacao_depois on commit drop as
select "CO_FICHA_ANALISE" as id, "TP_SITUACAO" as s from public."TB_FICHA_ANALISE";

-- B. Quantas concluídas seriam recusadas por FC_VALIDAR_RESULTADO_FICHA se re-salvas.
create function pg_temp.erro_ao_validar(p_regra jsonb, p_lanc jsonb, p_res jsonb, p_doc jsonb) returns text
language plpgsql as $$
begin
  perform private."FC_VALIDAR_RESULTADO_FICHA"(p_regra, p_lanc, p_res, p_doc);
  return null;
exception when others then
  return regexp_replace(regexp_replace(sqlerrm, '\(.*?\)', '(n)', 'g'), 'parcial [A-Z]+', 'parcial ' || coalesce(substring(sqlerrm from 'parcial ([A-Z]+)'), ''));
end $$;
create temp table ensaio_validar on commit drop as
select f.id, f.res, pg_temp.erro_ao_validar(f.conf, f.l, f.r, private."FC_DOCUMENTAL_DO_EDITAL"(f.m)) as erro
  from ensaio_fichas f where f.situacao = 'CONCLUIDA';

-- C. Aplicar não muda a situação de nenhuma ficha (a foto é de antes do corpo da migration).
--    As pendências das concluídas pela regra nova são o que o job Python mandaria para revisão.
create temp table ensaio_pendencias on commit drop as
select f.id, f.m, f.res, x as pendencia
  from ensaio_fichas f cross join lateral unnest(private."FC_PENDENCIAS_FICHA"(f.conf, f.l, f.r)) x
 where f.situacao = 'CONCLUIDA';

-- D. O tempo da validação ao salvar/concluir, ficha a ficha (FC_VALIDAR_LANCAMENTO_FICHA,
--    FC_VALIDAR_RESULTADO_FICHA e FC_PENDENCIAS_FICHA, como em concluir_ficha).
create temp table ensaio_tempo (ms numeric) on commit drop;
do $tempo$
declare
  v record;
  t0 timestamptz;
begin
  for v in select f.* from ensaio_fichas f where f.situacao = 'CONCLUIDA' loop
    t0 := clock_timestamp();
    begin
      perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v.conf, v.l);
    exception when others then null;
    end;
    perform pg_temp.erro_ao_validar(v.conf, v.l, v.r, private."FC_DOCUMENTAL_DO_EDITAL"(v.m));
    perform private."FC_PENDENCIAS_FICHA"(v.conf, v.l, v.r);
    insert into ensaio_tempo values (extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
end
$tempo$;

-- E. A RPC do job (revisar_ficha_concluida_com_pendencia) numa ficha com pendência e numa
--    sem: só a primeira muda (REVISAR, histórico JOB), sem mudar nota nem resultado.
create temp table ensaio_rpc on commit drop as
select (select public.revisar_ficha_concluida_com_pendencia(t."CO_FICHA_ANALISE", t."NU_VERSAO")
          from public."TB_FICHA_ANALISE" t where t."CO_FICHA_ANALISE" = (select min(id::text)::uuid from ensaio_pendencias)) as com_pendencia,
       (select public.revisar_ficha_concluida_com_pendencia(t."CO_FICHA_ANALISE", t."NU_VERSAO")
          from public."TB_FICHA_ANALISE" t where t."CO_FICHA_ANALISE" = '6cb75e98-fe35-49a2-a2cd-d1fb2dc6cdb5') as ficha_6cb75e98;

-- F. A RPC da correção (corrigir_experiencia_da_ficha) numa ficha do 114 com dias depois de 14/10
--    e a mesma pontuação: troca só a experiência, grava o histórico CORRIGIR e republica.
create temp table ensaio_correcao on commit drop as
select d.id,
       public.corrigir_experiencia_da_ficha(d.id, t."NU_VERSAO",
         (select private."FC_EXPERIENCIA_DA_FICHA"(x.b, f.l) from jsonb_array_elements(f.conf -> 'blocos') x(b)
           where x.b ->> 'tipo' = 'VINCULOS' limit 1),
         'Correção de dados: experiência contada até o fim das inscrições (14/10/2026); ensaio.',
         'a01afddb-f64b-47d9-80e8-476a1ed14e43') as r
  from (select id from ensaio_data_limite
         where situacao = 'CONCLUIDA' and pontos_antes = pontos_depois
           and id in (select id from ensaio_fichas where m = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0')
         order by id limit 1) d
  join ensaio_fichas f on f.id = d.id
  join public."TB_FICHA_ANALISE" t on t."CO_FICHA_ANALISE" = d.id;

select jsonb_build_object(
  'paridade', jsonb_build_object(
    'blocos', (select count(*) from ensaio_paridade),
    'calculado_diverge', (select count(*) from ensaio_paridade where calculado_diverge),
    'experiencia_diverge', (select count(*) from ensaio_paridade where experiencia_diverge)),
  'data_limite_padrao', jsonb_build_object(
    'fim_das_inscricoes_114', private."FC_FIM_DAS_INSCRICOES"('bcecfb08-88ef-4e06-8401-bcad6bf88fd0'),
    'fichas_com_dias_cortados', (select count(*) from ensaio_data_limite),
    'por_situacao_resultado', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
        select situacao || ' · ' || coalesce(res, '-') as k, count(*) as n from ensaio_data_limite group by 1) z),
    'dias_cortados_max', (select max(dias_antes - dias_depois) from ensaio_data_limite),
    'pontos_mudam', (select count(*) from ensaio_data_limite where pontos_antes <> pontos_depois)),
  'recusadas_se_re_salvas', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
      select res || ' · ' || erro as k, count(*) as n from ensaio_validar where erro is not null group by 1) v),
  'pendencias_por_tipo', (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (
      select res || ' ·' || regexp_replace(regexp_replace(pendencia, '[0-9]+([.,][0-9]+)?', 'n', 'g'), '^[^:]*:', '') as k,
             count(distinct id) as n
        from ensaio_pendencias group by 1) p),
  'situacao_mudou_ao_aplicar', (select count(*) from ensaio_situacao_antes a join ensaio_fichas f on f.id = a.id
       join public."TB_FICHA_ANALISE" t on t."CO_FICHA_ANALISE" = a.id
       where a.s is distinct from (select x.s from ensaio_situacao_depois x where x.id = a.id)),
  'fichas_com_pendencia', (select count(distinct id) from ensaio_pendencias),
  'fichas_com_pendencia_114', (select count(distinct id) from ensaio_pendencias where m = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0'),
  'tempo_da_validacao_ms', (select jsonb_build_object('fichas', count(*), 'media', round(avg(ms), 1),
       'p95', round((percentile_cont(0.95) within group (order by ms))::numeric, 1), 'maximo', round(max(ms), 1)) from ensaio_tempo),
  'rpc_do_job', (
select jsonb_build_object('com_pendencia', com_pendencia, 'ficha_6cb75e98', ficha_6cb75e98) from ensaio_rpc),
  'rpc_da_correcao', (select jsonb_build_object('resposta', c.r, 'historico', (select count(*) from public."TH_FICHA_ANALISE" h
       where h."CO_FICHA_ANALISE" = c.id and h."TP_ACAO" = 'CORRIGIR'), 'situacao', (select t."TP_SITUACAO" from public."TB_FICHA_ANALISE" t
       where t."CO_FICHA_ANALISE" = c.id)) from ensaio_correcao c),
  'nota_ou_resultado_mudou', (select count(*) from ensaio_fichas f join public."TB_FICHA_ANALISE" t on t."CO_FICHA_ANALISE" = f.id
       where t."TP_RESULTADO" is distinct from f.res or t."VL_NOTA_FINAL" is distinct from f.nota),
  'ficha_6cb75e98_foi', (select t."TP_SITUACAO" from public."TB_FICHA_ANALISE" t
       where t."CO_FICHA_ANALISE" = '6cb75e98-fe35-49a2-a2cd-d1fb2dc6cdb5'),
  'dourados', (select count(*) from ensaio_dourados),
  'dourados_com_falha', (select coalesce(jsonb_object_agg(nome, falhas), '{}'::jsonb) from ensaio_dourados where cardinality(falhas) > 0)
) as ensaio;

rollback;
