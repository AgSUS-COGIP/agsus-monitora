/*
  CÁLCULO CONFERIDO NO BANCO E FICHA CONCLUÍDA COM PENDÊNCIA VAI PARA REVISÃO
  (aplicar DEPOIS do fechamento do edital 114/2026)

  1. O banco recalcula a pontuação dos blocos de itens (títulos, cursos e vínculos) a
     partir do DS_LANCAMENTO e da regra da vaga (FC_CALCULADO_DO_BLOCO e
     FC_EXPERIENCIA_DA_FICHA: a mesma conta de calcularAvaliacao em
     src/lib/avaliacao-documental/pontuacao.js e de pontuacao.py). Antes,
     FC_VALIDAR_RESULTADO_FICHA confiava na parcial e no calculado do cliente sempre que
     havia nota_ajustada (o Confere grava a declarada como ajuste). Agora recusa o
     calculado ou a experiência que não são os dos itens, e a parcial ACIMA do calculado
     sem Editar nota com justificativa (abaixo, no Confere, vale a declarada — decisão de
     23/10/2026; os cursos pela nota, sem itens, e o inapto por requisito ficam de fora).
     Só a ficha que está sendo salva ou concluída: validação instantânea. Paridade conferida no ensaio com as 1.517 fichas
     concluídas ou em revisão (calculados e experiência gravados = recalculados).
  2. FC_PENDENCIAS_FICHA: a pontuação Conforme ACIMA do que os itens aceitos dão vale
     também para títulos e cursos com a lista (antes, só a experiência;
     pontuacaoAcimaDoComprovado em ficha.js); a experiência é a do banco.
  3. O mínimo de experiência também com "Não enviou" e os vínculos aceitos cumprindo o
     mínimo; e nenhuma pendência do mínimo quando OUTRO bloco já elimina (decisão de
     22/10/2026: a experiência é só informativa).
  4. Datas dos vínculos: nada antes de 1960 e o fim até hoje (Brasília), ao salvar
     (FC_VALIDAR_LANCAMENTO_FICHA) e ao concluir (FC_PENDENCIAS_FICHA). A experiência conta
     até a data limite do bloco, que, sem data na regra, é o fim das inscrições do
     cronograma do edital (FC_REGRA_COM_DATA_LIMITE, aplicada em FC_REGRA_VIGENTE_FICHA e
     nas RPCs que o Python lê: conferencia_ler_fichas, listar_anexos_para_leitura e
     pre_classificacao_ler_editais).
  5. A ficha CONCLUIDA com pendência pela regra vigente vai para REVISAR pelo job Python de
     conferências (scripts/conferencias, todo dia às 6h; o cálculo em lote é do Python). Aqui
     só as RPCs enxutas de gravação, só service_role: revisar_ficha_concluida_com_pendencia
     (confere de novo FC_PENDENCIAS_FICHA naquela ficha; sem mudar nota nem resultado;
     histórico JOB "Conferência automática: …") e corrigir_experiencia_da_ficha (a correção
     do 114, scripts/correcoes/experiencia_ate_o_fim_das_inscricoes.py). Esta migration não
     muda a situação de nenhuma ficha.
  6. A fila mostra o motivo da revisão (FC_LINHAS_DA_FILA → ficha.motivo_revisao) e o histórico
     ganha a ação CORRIGIR (correção de dados).

  Ensaio: supabase/ensaios/20261023090000_calculo_conferido_no_banco.sql (impacto medido).
  Rollback: supabase/rollback/20261023090000_calculo_conferido_no_banco.sql
*/
begin;

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

commit;
