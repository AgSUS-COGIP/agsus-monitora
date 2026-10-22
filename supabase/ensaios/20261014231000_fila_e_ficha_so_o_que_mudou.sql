/*
  ENSAIO da migration 20261014231000_fila_e_ficha_so_o_que_mudou.sql — begin … rollback.

  NÃO É MIGRATION. Rode a migration e, na mesma transação, este arquivo, e desfaça:
    source ensaio.sh; ensaio_arquivo supabase/migrations/20261014231000_fila_e_ficha_so_o_que_mudou.sql \
      "$(cat supabase/ensaios/20261014231000_fila_e_ficha_so_o_que_mudou.sql)"

  Confere, como usuário (role authenticated, claims de um coordenador do 114/2026):
    1. sem p_desde, a fila inteira = obter_fila_avaliacao (mais marca e parcial false);
    2. com p_desde e a marca, sem mudança: nenhuma linha, total_nucleo = o núcleo;
    3. mudando duas fichas (DT_ATUALIZACAO, como as RPCs que gravam fazem) e a reserva
       de uma terceira: o parcial traz essas linhas, e a fila antiga com elas trocadas
       = a fila inteira de agora (a junção da tela);
    4. outra marca: a fila inteira;
    5. a ficha leve: sem chave, = obter_ficha_analise com regra.chave; com a chave, a
       configuração vem nula e o resto igual;
    6. os tamanhos (bytes), na última consulta.
*/
create temporary table t_med (o text, bytes bigint, ok boolean) on commit drop;
grant all on t_med to authenticated;

do $$
declare
  v_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v_eu constant text := '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}';
  cheia jsonb; antes jsonb; parcial jsonb; depois jsonb; juntada jsonb;
  f1 json; f2 json; f3 json; fj json;
  v_fichas uuid[];
begin
  perform set_config('request.jwt.claims', v_eu, true);
  execute 'set local role authenticated';

  antes := public.obter_fila_avaliacao(v_edital)::jsonb;
  fj := public.obter_fila_avaliacao_desde(v_edital, null, null); cheia := fj::jsonb;
  insert into t_med values ('fila inteira (desde, sem p_desde)', octet_length(fj::text),
    (cheia - 'marca' - 'parcial' - 'gerado_em') = (antes - 'gerado_em') and cheia ->> 'parcial' = 'false');

  fj := public.obter_fila_avaliacao_desde(v_edital, (cheia ->> 'gerado_em')::timestamptz, cheia ->> 'marca'); parcial := fj::jsonb;
  insert into t_med values ('parcial sem mudança', octet_length(fj::text),
    (parcial ->> 'parcial')::boolean and (parcial ->> 'total_nucleo')::int = jsonb_array_length(antes -> 'candidatos')
    and not parcial ? 'vagas');

  -- Três fichas do núcleo mudam (como dono da tabela: o ensaio desfaz tudo).
  execute 'reset role';
  select array_agg(x.id) into v_fichas
    from (select f."CO_FICHA_ANALISE" id from public."TB_FICHA_ANALISE" f
           where f."CO_MONITORAMENTO" = v_edital and f."TP_SITUACAO" = 'PENDENTE'
           order by f."CO_FICHA_ANALISE" limit 3) x;
  update public."TB_FICHA_ANALISE" set "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
   where "CO_FICHA_ANALISE" = any (v_fichas[1:2]);
  update public."TB_FICHA_ANALISE" set "DT_RESERVA_EXPIRA" = now() + interval '15 minutes', "DT_RESERVA" = now(), "TP_SITUACAO" = 'EM_ANALISE', "DT_ATRIBUICAO" = now(),
         "CO_USUARIO_RESPONSAVEL" = 'a01afddb-f64b-47d9-80e8-476a1ed14e43',
         "CO_USUARIO_RESERVA" = 'a01afddb-f64b-47d9-80e8-476a1ed14e43'
   where "CO_FICHA_ANALISE" = v_fichas[3];
  execute 'set local role authenticated';

  fj := public.obter_fila_avaliacao_desde(v_edital, (cheia ->> 'gerado_em')::timestamptz, cheia ->> 'marca'); parcial := fj::jsonb;
  depois := public.obter_fila_avaliacao(v_edital)::jsonb;
  select jsonb_agg(coalesce(
           (select n from jsonb_array_elements(parcial -> 'candidatos') n where n ->> 'id' = c ->> 'id'), c) order by o)
    into juntada
    from jsonb_array_elements(antes -> 'candidatos') with ordinality x(c, o)
   where not (parcial -> 'saiu') ? (c ->> 'id');
  insert into t_med values ('parcial com 3 fichas mudadas', octet_length(fj::text),
    jsonb_array_length(parcial -> 'candidatos') >= 3 and juntada = depois -> 'candidatos'
    and (parcial ->> 'total_nucleo')::int = jsonb_array_length(depois -> 'candidatos'));

  fj := public.obter_fila_avaliacao_desde(v_edital, (cheia ->> 'gerado_em')::timestamptz, 'outra'); parcial := fj::jsonb;
  insert into t_med values ('outra marca: inteira', octet_length(fj::text), parcial ->> 'parcial' = 'false');

  -- Ficha leve ---------------------------------------------------------------------------
  f1 := public.obter_ficha_analise(v_fichas[1]);
  f2 := public.obter_ficha_analise_leve(v_fichas[1], null);
  f3 := public.obter_ficha_analise_leve(v_fichas[1], f2 -> 'regra' ->> 'chave');
  insert into t_med values ('obter_ficha_analise', octet_length(f1::text), null);
  insert into t_med values ('ficha leve sem chave', octet_length(f2::text),
    (f2::jsonb - 'regra_omitida' - 'gerado_em') #- '{regra,chave}' = (f1::jsonb - 'gerado_em')
    and f2 ->> 'regra_omitida' = 'false');
  insert into t_med values ('ficha leve com a chave', octet_length(f3::text),
    f3 -> 'regra' ->> 'configuracao' is null and f3 ->> 'regra_omitida' = 'true'
    and (f3::jsonb - 'regra_omitida' - 'gerado_em' - 'regra') = (f1::jsonb - 'gerado_em' - 'regra'));
  execute 'reset role';
end $$;

select * from t_med;
