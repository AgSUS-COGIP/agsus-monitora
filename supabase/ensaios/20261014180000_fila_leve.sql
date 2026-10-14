/*
  ENSAIO da migration 20261014180000_fila_leve.sql — begin … rollback.

  NÃO É MIGRATION. Rode a migration e, na mesma transação, este arquivo
  (ensaio.sh: ensaio_arquivo <migration> "$(cat <este arquivo>)"), e desfaça.
  Antes (a fila de antes, para comparar) rode o bloco "ANTES" no começo da
  transação, ANTES da migration — o arquivo do ensaio completo, montado na
  ordem certa, é:
    1. a parte "ANTES" (até a marca -- FIM DO ANTES);
    2. a migration (o ensaio.sh tira o begin e o fim da transação);
    3. a parte "DEPOIS".

  Confere, como usuário (role authenticated, com as claims de um coordenador do
  114/2026), no 114/2026:
    1. núcleo + todas as páginas de fora do lote = a fila de antes, linha a
       linha (o mesmo JSON por inscrito sem as chaves nulas, ninguém repetido
       nem faltando);
    2. as contagens de fora_do_lote batem com as linhas de fora;
    3. a ordem do núcleo é a de antes (vaga, eliminado por último, posição,
       código);
    4. o filtro do analista por vaga dá o mesmo conjunto da permissão por
       inscrito (FC_PODE_ANALISAR_VAGA linha a linha), para um analista do
       edital;
    5. os tempos e os tamanhos (a última consulta).
*/

-- ANTES ---------------------------------------------------------------------------------
create temporary table t_antes (linha json) on commit drop;
create temporary table t_tempos (o text, ms numeric, kb numeric) on commit drop;
create temporary table t_fora (linha json) on commit drop;
grant all on t_antes, t_tempos, t_fora to authenticated;
grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);
do $$
declare t timestamptz := clock_timestamp(); j json;
begin
  j := public.obter_fila_avaliacao('bcecfb08-88ef-4e06-8401-bcad6bf88fd0');
  insert into t_tempos values ('antes: obter_fila_avaliacao', round(extract(epoch from clock_timestamp() - t)::numeric * 1000), round(octet_length(j::text) / 1024.0));
  insert into t_antes values (j);
end $$;
reset role;
-- FIM DO ANTES

-- DEPOIS --------------------------------------------------------------------------------
grant execute on all functions in schema private to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);

do $$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  t timestamptz;
  j json;
  p json;
  v_apos uuid;
  v_paginas integer := 0;
  v_n integer;
begin
  t := clock_timestamp();
  j := public.obter_fila_avaliacao(v_edital);
  insert into t_tempos values ('depois: obter_fila_avaliacao (núcleo)', round(extract(epoch from clock_timestamp() - t)::numeric * 1000), round(octet_length(j::text) / 1024.0));
  if (j ->> 'schema_version')::integer <> 2 then raise exception 'ENSAIO: schema_version %', j ->> 'schema_version'; end if;
  loop
    t := clock_timestamp();
    p := public.obter_fila_fora_do_lote(v_edital, v_apos, 1000);
    v_paginas := v_paginas + 1;
    insert into t_tempos values ('depois: obter_fila_fora_do_lote página ' || v_paginas, round(extract(epoch from clock_timestamp() - t)::numeric * 1000), round(octet_length(p::text) / 1024.0));
    insert into t_fora select x from json_array_elements(p -> 'candidatos') x;
    v_apos := (p ->> 'proximo')::uuid;
    exit when v_apos is null or v_paginas > 20;
  end loop;

  -- 1. núcleo + fora = antes, linha a linha
  with antes as (select json_strip_nulls(x)::text as l from t_antes, json_array_elements(t_antes.linha -> 'candidatos') x),
       depois as (select x::text as l from json_array_elements(j -> 'candidatos') x
                  union all select linha::text from t_fora)
  select count(*) into v_n from ((select l from antes except all select l from depois)
                                 union all (select l from depois except all select l from antes)) d;
  if v_n > 0 then raise exception 'ENSAIO 1: % linha(s) diferem entre a fila de antes e núcleo + fora', v_n; end if;

  -- 2. contagens de fora do lote
  select count(*) into v_n from t_fora;
  if v_n <> (j -> 'fora_do_lote' ->> 'total')::integer then
    raise exception 'ENSAIO 2: fora_do_lote.total % <> % linhas', j -> 'fora_do_lote' ->> 'total', v_n;
  end if;
  select count(*) into v_n from t_fora where linha ->> 'situacao_pre' = 'ELIMINADO';
  if v_n <> (j -> 'fora_do_lote' ->> 'eliminados')::integer then raise exception 'ENSAIO 2: eliminados'; end if;
  select count(*) into v_n from t_fora where (linha -> 'ficha' ->> 'situacao') is not null and linha -> 'ficha' ->> 'situacao' <> 'FORA_LOTE';
  if v_n > 0 then raise exception 'ENSAIO 2: % ficha(s) viva(s) fora do núcleo', v_n; end if;

  -- 3. a ordem do núcleo é a de antes (a subsequência do núcleo na fila de antes)
  with antes as (select x ->> 'id' as id, row_number() over () as n from t_antes, json_array_elements(t_antes.linha -> 'candidatos') x),
       nucleo as (select x ->> 'id' as id, row_number() over () as n from json_array_elements(j -> 'candidatos') x),
       ordem as (select nu.n, row_number() over (order by a.n) as m from nucleo nu join antes a using (id))
  select count(*) into v_n from ordem where n <> m;
  if v_n > 0 then raise exception 'ENSAIO 3: % linha(s) do núcleo fora da ordem de antes', v_n; end if;
end $$;
reset role;

-- 4. o filtro do analista: por vaga = por inscrito (como postgres; a permissão por inscrito
--    é a conta de antes e, para o analista, passava dos 8 s)
do $$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v_analista uuid;
  v_vagas text[];
  t timestamptz;
  v_n integer;
  v_m integer;
begin
  select r."CO_USUARIO" into v_analista from public."RL_ANALISTA_EDITAL" r
   where r."CO_MONITORAMENTO" = v_edital and r."TP_PAPEL" = 'ANALISTA' and r."ST_ATIVO" = 'S' limit 1;
  if v_analista is null then return; end if;
  t := clock_timestamp();
  select count(*) filter (where private."FC_PODE_ANALISAR_VAGA"(v_edital, v_analista, a."CO_VAGA")) into v_n
    from public."TB_PRE_CLASSIFICACAO" a where a."CO_MONITORAMENTO" = v_edital;
  insert into t_tempos values ('antes: permissão por inscrito (analista)', round(extract(epoch from clock_timestamp() - t)::numeric * 1000), null);
  t := clock_timestamp();
  v_vagas := private."FC_VAGAS_DO_ANALISTA"(v_edital, v_analista);
  select count(*) into v_m from public."TB_PRE_CLASSIFICACAO" a where a."CO_MONITORAMENTO" = v_edital and a."CO_VAGA" = any (v_vagas);
  insert into t_tempos values ('depois: permissão por vaga (analista)', round(extract(epoch from clock_timestamp() - t)::numeric * 1000), null);
  if v_n <> v_m then raise exception 'ENSAIO 4: por inscrito % <> por vaga %', v_n, v_m; end if;
end $$;

-- 5. os tempos e os tamanhos
select json_agg(t) from t_tempos t;
