/*
  ENSAIO da migration 20261014110000_pre_classificacao_ler_em_partes.sql — begin … rollback.

  NÃO É MIGRATION. Rode depois da migration, na mesma transação (ensaio.sh:
  ensaio_arquivo <migration> "$(cat <este arquivo>)"), e desfaça.

  Confere, no 114/2026 (30 vagas, ~7.160 inscritos ativos):
    1. pre_classificacao_ler_editais traz as 30 vagas só com os metadados (sem
       cargo nem quadro) e o resto do edital (regra, documental, cronograma,
       refazer_permitido);
    2. a primeira parte de cada vaga traz {cargo, quadro} igual à linha de
       FC_QUADRO_DA_VAGA_EMPREGARE (o que ler_editais trazia antes);
    3. a vaga lida em partes de 500 (p_apos = último id) é igual à lida de uma
       vez (sem p_limite) — inscritos, ordem, anterior e decisões — na maior
       vaga (182493), numa média (182444) e na vazia (182432);
    4. p_limite fora de 1..5000 é recusado; anon e authenticated não executam;
    5. o tempo de cada chamada (a última linha mostra: ler_editais e a
       primeira parte de cada vaga, em ms).
*/
create temporary table t_tempos (chamada text, ms numeric) on commit drop;

do $$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v_t timestamptz;
  v_lido jsonb;
  v_parte jsonb;
  v_todos jsonb;
  v_junto jsonb;
  v_vaga record;
  v_esperada jsonb;
  v_codigo text;
  v_n integer;
begin
  perform set_config('request.jwt.claims', '{"role": "service_role"}', true);

  -- 1. Os editais: só metadados.
  v_t := clock_timestamp();
  v_lido := public.pre_classificacao_ler_editais(array['114/2026'], false) -> 'editais' -> 0;
  insert into t_tempos values ('ler_editais', extract(epoch from clock_timestamp() - v_t) * 1000);
  if jsonb_array_length(v_lido -> 'vagas') <> 30 then
    raise exception 'ENSAIO 1: o 114 não veio com 30 vagas: %', jsonb_array_length(v_lido -> 'vagas');
  end if;
  if exists (select 1 from jsonb_array_elements(v_lido -> 'vagas') x where x ? 'quadro' or x ? 'cargo') then
    raise exception 'ENSAIO 1: ler_editais ainda traz o cargo ou o quadro';
  end if;
  if exists (select 1 from jsonb_array_elements(v_lido -> 'vagas') x
              where not (x ?& array['codigo', 'situacao_carga', 'candidatos_ativos', 'ultima_carga', 'ultimo_lote'])) then
    raise exception 'ENSAIO 1: vaga sem os metadados';
  end if;
  if not (v_lido ?& array['id', 'rotulo', 'area', 'ativo', 'treinamento', 'regra', 'documental', 'cronograma',
                          'fichas_iniciadas', 'refazer_permitido']) then
    raise exception 'ENSAIO 1: o edital perdeu chaves: %', (select jsonb_agg(k) from jsonb_object_keys(v_lido) k);
  end if;

  -- 2. A vaga (cargo e quadro) na primeira parte, igual à linha do quadro de antes.
  for v_vaga in select x ->> 'codigo' as codigo from jsonb_array_elements(v_lido -> 'vagas') x loop
    v_t := clock_timestamp();
    v_parte := public.pre_classificacao_ler_candidatos(v_edital, v_vaga.codigo, null, 500);
    insert into t_tempos values ('vaga ' || v_vaga.codigo, extract(epoch from clock_timestamp() - v_t) * 1000);
    select jsonb_build_object(
             'cargo', q."NO_CARGO",
             'quadro', case when q."CO_QUADRO_VAGA" is null then null else jsonb_build_object(
               'id', q."CO_QUADRO_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
               'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S', 'modalidades', q."DS_MODALIDADE_VAGA") end)
      into v_esperada
      from (select 1) x
      left join lateral (select * from private."FC_QUADRO_DA_VAGA_EMPREGARE"(v_edital, v_vaga.codigo)) q on true;
    if v_parte -> 'vaga' is distinct from v_esperada or v_esperada ->> 'cargo' is null then
      raise exception 'ENSAIO 2: vaga % com cargo/quadro diferente: % ≠ %', v_vaga.codigo, v_parte -> 'vaga', v_esperada;
    end if;
    if not (v_parte ?& array['candidatos', 'mais', 'anterior', 'decisoes']) then
      raise exception 'ENSAIO 2: a primeira parte da vaga % não traz anterior e decisões', v_vaga.codigo;
    end if;
  end loop;

  -- 3. Em partes = de uma vez.
  foreach v_codigo in array array['182493', '182444', '182432'] loop
    v_todos := public.pre_classificacao_ler_candidatos(v_edital, v_codigo);
    v_parte := public.pre_classificacao_ler_candidatos(v_edital, v_codigo, null, 500);
    v_junto := v_parte -> 'candidatos';
    v_n := 1;
    while (v_parte ->> 'mais')::boolean loop
      v_parte := public.pre_classificacao_ler_candidatos(
        v_edital, v_codigo, (v_junto -> (jsonb_array_length(v_junto) - 1) ->> 'id')::uuid, 500);
      if v_parte ? 'anterior' or v_parte ? 'vaga' then
        raise exception 'ENSAIO 3: parte seguinte com anterior ou vaga';
      end if;
      v_junto := v_junto || (v_parte -> 'candidatos');
      v_n := v_n + 1;
    end loop;
    if v_junto is distinct from v_todos -> 'candidatos' then
      raise exception 'ENSAIO 3: vaga % em partes (%) ≠ de uma vez (%)', v_codigo,
        jsonb_array_length(v_junto), jsonb_array_length(v_todos -> 'candidatos');
    end if;
    if (v_todos ->> 'mais')::boolean
       or v_todos -> 'anterior' is distinct from public.pre_classificacao_ler_candidatos(v_edital, v_codigo, null, 1) -> 'anterior'
       or v_todos -> 'decisoes' is distinct from public.pre_classificacao_ler_candidatos(v_edital, v_codigo, null, 1) -> 'decisoes' then
      raise exception 'ENSAIO 3: vaga % com anterior/decisões diferentes', v_codigo;
    end if;
    if v_codigo = '182493' and (v_n < 4 or jsonb_array_length(v_junto) < 1500) then
      raise exception 'ENSAIO 3: a 182493 devia vir em 4+ partes (% partes, % inscritos)', v_n, jsonb_array_length(v_junto);
    end if;
    raise notice 'vaga %: % inscritos em % partes', v_codigo, jsonb_array_length(v_junto), v_n;
  end loop;

  -- 4. Limite e permissões.
  begin
    perform public.pre_classificacao_ler_candidatos(v_edital, '182493', null, 5001);
    raise exception 'ENSAIO 4: p_limite 5001 aceito';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.pre_classificacao_ler_candidatos(v_edital, '182493', null, 0);
    raise exception 'ENSAIO 4: p_limite 0 aceito';
  exception when sqlstate '22023' then null;
  end;
  if has_function_privilege('anon', 'public.pre_classificacao_ler_candidatos(uuid, text, uuid, integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.pre_classificacao_ler_candidatos(uuid, text, uuid, integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.pre_classificacao_ler_candidatos(uuid, text, uuid, integer)', 'EXECUTE') then
    raise exception 'ENSAIO 4: permissões erradas em pre_classificacao_ler_candidatos';
  end if;
  if to_regprocedure('public.pre_classificacao_ler_candidatos(uuid, text)') is not null then
    raise exception 'ENSAIO 4: a assinatura antiga (uuid, text) ficou';
  end if;
end;
$$;

-- 5. Os tempos (ms): ler_editais, a maior primeira parte e a soma das 30.
select jsonb_build_object(
         'ler_editais_ms', round((select ms from t_tempos where chamada = 'ler_editais')),
         'maior_parte_ms', round((select max(ms) from t_tempos where chamada like 'vaga %')),
         'maior_parte', (select chamada from t_tempos where chamada like 'vaga %' order by ms desc limit 1),
         'soma_das_vagas_ms', round((select sum(ms) from t_tempos where chamada like 'vaga %'))) as tempos;
