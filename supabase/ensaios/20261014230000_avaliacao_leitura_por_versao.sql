/*
  ENSAIO da migration 20261014230000_avaliacao_leitura_por_versao.sql — begin … rollback.

  NÃO É MIGRATION. Rode a migration e, na mesma transação, este arquivo, e desfaça:
    source ensaio.sh; ensaio_arquivo supabase/migrations/20261014230000_avaliacao_leitura_por_versao.sql \
      "$(cat supabase/ensaios/20261014230000_avaliacao_leitura_por_versao.sql)"

  Confere, como usuário (role authenticated, claims de um coordenador do 114/2026):
    1. os inscritos refeitos das colunas = os de obter_pre_classificacao, objeto a objeto
       (mesmas chaves, nulos incluídos; mesma ordem);
    2. o mesmo para os candidatos da Classificação;
    3. a segunda chamada com a versão devolvida responde { inalterado } (as três);
    4. a situação leve tem as mesmas em_andamento e ultima_execucao (sem "edital");
    5. os tamanhos (bytes do JSON) antes e depois, na última consulta.
*/
create temporary table t_med (o text, bytes bigint, ms numeric, ok boolean) on commit drop;
grant all on t_med to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);

do $$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  t timestamptz;
  a jsonb; n jsonb; s jsonb; nj json;
  v_ok boolean;
begin
  -- Pré-classificação ------------------------------------------------------------------
  t := clock_timestamp();
  nj := public.obter_pre_classificacao(v_edital); a := nj::jsonb;
  insert into t_med values ('obter_pre_classificacao', octet_length(nj::text), round(extract(epoch from clock_timestamp() - t)::numeric * 1000), null);
  t := clock_timestamp();
  nj := public.obter_pre_classificacao_se_mudou(v_edital, null); n := nj::jsonb;
  insert into t_med values ('obter_pre_classificacao_se_mudou (cheio)', octet_length(nj::text), round(extract(epoch from clock_timestamp() - t)::numeric * 1000), null);
  with p as (select n -> 'candidatos_em_colunas' as p),
       refeitos as (
         select o, (select jsonb_object_agg(c.k, case when p.p -> 'dicionarios' ? c.k
                                                     then p.p -> 'dicionarios' -> c.k -> ((l.linha ->> (c.n - 1)::int)::int)
                                                     else l.linha -> (c.n - 1)::int end)
                      from jsonb_array_elements_text(p.p -> 'colunas') with ordinality c(k, n)) as obj
           from p, jsonb_array_elements(p.p -> 'linhas') with ordinality l(linha, o)),
       originais as (select o, e as obj from jsonb_array_elements(a -> 'candidatos') with ordinality x(e, o))
  select count(*) = 0 into v_ok
    from originais full join refeitos using (o)
   where originais.obj is distinct from refeitos.obj;
  insert into t_med values ('pre: inscritos refeitos = originais', null, null, v_ok
    and (a - 'candidatos' - 'gerado_em') = (n - 'candidatos_em_colunas' - 'versao' - 'gerado_em'));
  t := clock_timestamp();
  s := public.obter_pre_classificacao_se_mudou(v_edital, n ->> 'versao')::jsonb;
  insert into t_med values ('obter_pre_classificacao_se_mudou (inalterado)', octet_length(s::text), round(extract(epoch from clock_timestamp() - t)::numeric * 1000),
                            (s ->> 'inalterado')::boolean);

  -- Situação leve -------------------------------------------------------------------------
  s := public.obter_situacao_pre_classificacao(v_edital)::jsonb;
  insert into t_med values ('obter_situacao_pre_classificacao', octet_length(s::text), null,
    (s -> 'em_andamento') = (a -> 'em_andamento') and (s -> 'ultima_execucao') is not distinct from ((a -> 'ultima_execucao') - 'edital'));

  -- Regra -------------------------------------------------------------------------------
  t := clock_timestamp();
  n := public.obter_regra_analise_se_mudou(v_edital, null);
  insert into t_med values ('obter_regra_analise_se_mudou (cheio)', octet_length(n::text), round(extract(epoch from clock_timestamp() - t)::numeric * 1000),
                            (n - 'versao') = public.obter_regra_analise(v_edital)::jsonb);
  s := public.obter_regra_analise_se_mudou(v_edital, n ->> 'versao');
  insert into t_med values ('obter_regra_analise_se_mudou (inalterado)', octet_length(s::text), null, (s ->> 'inalterado')::boolean);

  -- Classificação ---------------------------------------------------------------------------
  t := clock_timestamp();
  nj := public.obter_classificacao_do_edital(v_edital); a := nj::jsonb;
  insert into t_med values ('obter_classificacao_do_edital', octet_length(nj::text), round(extract(epoch from clock_timestamp() - t)::numeric * 1000), null);
  t := clock_timestamp();
  nj := public.obter_classificacao_do_edital_se_mudou(v_edital, null); n := nj::jsonb;
  insert into t_med values ('obter_classificacao_do_edital_se_mudou (cheio)', octet_length(nj::text), round(extract(epoch from clock_timestamp() - t)::numeric * 1000), null);
  with p as (select n -> 'candidatos_em_colunas' as p),
       refeitos as (
         select o, (select jsonb_object_agg(c.k, case when p.p -> 'dicionarios' ? c.k
                                                     then p.p -> 'dicionarios' -> c.k -> ((l.linha ->> (c.n - 1)::int)::int)
                                                     else l.linha -> (c.n - 1)::int end)
                      from jsonb_array_elements_text(p.p -> 'colunas') with ordinality c(k, n)) as obj
           from p, jsonb_array_elements(p.p -> 'linhas') with ordinality l(linha, o)),
       originais as (select o, e as obj from jsonb_array_elements(a -> 'candidatos') with ordinality x(e, o))
  select count(*) = 0 into v_ok
    from originais full join refeitos using (o)
   where originais.obj is distinct from refeitos.obj;
  insert into t_med values ('classificacao: candidatos refeitos = originais', null, null, v_ok);
  s := public.obter_classificacao_do_edital_se_mudou(v_edital, n ->> 'versao')::jsonb;
  insert into t_med values ('obter_classificacao_do_edital_se_mudou (inalterado)', octet_length(s::text), null, (s ->> 'inalterado')::boolean);
end $$;

reset role;
select * from t_med;
