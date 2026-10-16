/*
  Ensaio de 20261016130000_abas_da_coordenacao_no_banco.sql (sempre desfeito: begin … rollback).

  Uso (Git Bash), no banco novo:
    source qn.sh
    qn "begin;
    $(sed -E '/^\s*(begin|commit|rollback)\s*;\s*$/Id' supabase/migrations/20261016130000_abas_da_coordenacao_no_banco.sql)
    $(cat supabase/ensaios/20261016130000_abas_da_coordenacao_no_banco.sql)
    rollback;"

  Lê o 114/2026 (projetos) como o administrador (coordena) e como uma pessoa do
  grupo Avaliador (área Projetos, não coordena) e como um analista do 114.
  Nada é gravado.

  Espera-se:
    - administrador: lista com fichas no 114; pré-classificação, situação, equipe e
      apoio respondem; regra inteira (configuracao, modelos).
    - analista do 114 (RL_ANALISTA_EDITAL ANALISTA, com fichas EM_ANALISE no 93/2026 e
      no treinamento): o mesmo que o avaliador, e minhas_em_analise > 0 nesses editais.
    - avaliador: 42501 nas quatro travadas (e em obter_pre_classificacao_se_mudou);
      regra enxuta (só versao, nome, situacao, versoes {versao, nome}; modelos [];
      aldeias nulo); lista com fichas; fila e ficha respondem como antes (a ficha
      só abre se ele analisa a vaga: obter_ficha_analise não foi tocada).
*/
create temporary table ensaio_saida (passo text, quem text, resultado text) on commit drop;
grant all on ensaio_saida to authenticated;

create temporary table ensaio_ficha on commit drop as
select f."CO_FICHA_ANALISE" as id from public."TB_FICHA_ANALISE" f
 where f."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0' and f."TP_SITUACAO" = 'PENDENTE'
 -- de preferência uma vaga que o avaliador analisa (sem nenhuma, a ficha dá 42501 a ele antes e depois)
 order by private."FC_PODE_ANALISAR_VAGA"(f."CO_MONITORAMENTO", '703ecea8-7401-46ce-82ae-b54ec5b62534', f."CO_VAGA") desc
 limit 1;
grant all on ensaio_ficha to authenticated;

create or replace function pg_temp.ensaio(p_quem text, p_uid uuid) returns void
language plpgsql as $$
declare
  e constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';
  v json;
  r text;
  t timestamptz;
  f text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);

  t := clock_timestamp();
  v := public.listar_editais_avaliacao('projetos');
  insert into ensaio_saida select 'listar', p_quem,
    (select x::text from json_array_elements(v -> 'editais') x where x ->> 'id' = e::text)::json -> 'fichas' ||
    ' papel=' || coalesce((select x ->> 'papel' from json_array_elements(v -> 'editais') x where x ->> 'id' = e::text), 'nulo') ||
    ' ' || round(extract(epoch from clock_timestamp() - t) * 1000) || ' ms';
  insert into ensaio_saida select 'listar (minhas na área)', p_quem,
    coalesce(string_agg(x ->> 'edital' || ': ' || (x -> 'fichas')::text, ' | '), 'nenhuma')
    from json_array_elements(v -> 'editais') x where (x -> 'fichas' ->> 'minhas_em_analise')::int > 0;

  foreach f in array array['obter_pre_classificacao', 'obter_pre_classificacao_se_mudou', 'obter_situacao_pre_classificacao',
                           'obter_equipe_edital', 'obter_apoio_regra_analise'] loop
    begin
      execute format('select public.%I($1)::text', f) into r using e;
      insert into ensaio_saida values (f, p_quem, 'ok ' || length(r) || ' bytes');
    exception when others then
      insert into ensaio_saida values (f, p_quem, 'ERRO ' || sqlstate || ' ' || sqlerrm);
    end;
  end loop;

  begin
    v := public.obter_regra_analise(e);
    insert into ensaio_saida values ('obter_regra_analise', p_quem,
      'papel=' || coalesce(v ->> 'papel', 'nulo') || ' pode_coordenar=' || (v ->> 'pode_coordenar') ||
      ' regra_chaves=' || (select string_agg(k, ',' order by k) from json_object_keys(v -> 'regra') k) ||
      ' versao1=' || coalesce((v -> 'regra' -> 'versoes' -> 0)::text, '-') ||
      ' modelos=' || json_array_length(v -> 'modelos') || ' aldeias=' || coalesce((v -> 'aldeias')::text, 'nulo') ||
      ' tamanho=' || length(v::text));
    r := (public.obter_regra_analise_se_mudou(e, null))::text;
    insert into ensaio_saida values ('obter_regra_analise_se_mudou', p_quem, 'ok ' || length(r) || ' bytes');
  exception when others then
    insert into ensaio_saida values ('obter_regra_analise', p_quem, 'ERRO ' || sqlstate || ' ' || sqlerrm);
  end;

  begin
    r := public.obter_fila_avaliacao(e)::text;
    insert into ensaio_saida values ('obter_fila_avaliacao', p_quem, 'ok ' || length(r) || ' bytes');
  exception when others then
    insert into ensaio_saida values ('obter_fila_avaliacao', p_quem, 'ERRO ' || sqlstate || ' ' || sqlerrm);
  end;
  begin
    r := public.obter_ficha_analise((select id from ensaio_ficha))::text;
    insert into ensaio_saida values ('obter_ficha_analise', p_quem, 'ok ' || length(r) || ' bytes');
  exception when others then
    insert into ensaio_saida values ('obter_ficha_analise', p_quem, 'ERRO ' || sqlstate || ' ' || sqlerrm);
  end;
end;
$$;
grant execute on function pg_temp.ensaio(text, uuid) to authenticated;

set local role authenticated;
select pg_temp.ensaio('administrador', 'a01afddb-f64b-47d9-80e8-476a1ed14e43');
select pg_temp.ensaio('avaliador', '703ecea8-7401-46ce-82ae-b54ec5b62534');
select pg_temp.ensaio('analista', 'df5b852c-f981-4486-94b9-67857fff8f93');
reset role;

select * from ensaio_saida order by quem, passo;
