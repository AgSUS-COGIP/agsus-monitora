/*
  Ensaio de 20261015180000_espelhos_de_nota_em_massa.sql (sempre desfeito: begin … rollback).

  Uso (Git Bash), no banco novo:
    source qn.sh
    qn "begin;
    $(sed -E '/^\s*(begin|commit|rollback)\s*;\s*$/Id' supabase/migrations/20261015180000_espelhos_de_nota_em_massa.sql)
    $(cat supabase/ensaios/20261015180000_espelhos_de_nota_em_massa.sql)
    rollback;"

  O 114/2026 não tem ficha concluída: o ensaio cria 1.000 candidatos e fichas
  FICTÍCIOS concluídos no 114 (600 aptos, 250 inaptos por requisito, 150 pela nota;
  códigos 9900001…9901000), com os gatilhos de publicação desligados só nesta
  transação (session_replication_role = replica), e lê tudo como administrador em
  páginas de 200, medindo o tempo e o tamanho de cada página. Nenhuma ficha real é
  tocada; tudo é desfeito no rollback.

  Espera-se: 5 páginas cheias + o fim (proximo nulo), cada uma bem abaixo de 8 s;
  ~1 KB por ficha; a regra só na primeira página; filtro e vagas corretos; com os
  códigos, nao_concluidos lista os códigos reais com ficha não concluída; quem não
  coordena recebe 42501.
*/
set local session_replication_role = replica;

create temporary table ensaio_candidato on commit drop as
select gen_random_uuid() as id, i,
       (array_agg_vagas)[1 + (i % cardinality(array_agg_vagas))] as vaga
  from generate_series(1, 1000) i,
       (select array_agg(distinct f."CO_VAGA") as array_agg_vagas
          from public."TB_FICHA_ANALISE" f
         where f."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0') v;

insert into public."TB_EMPREGARE_CANDIDATO"
  ("CO_EMPREGARE_CANDIDATO", "CO_VAGA", "DS_CHAVE_CANDIDATO", "TP_CHAVE", "DS_COLUNA_ORIGINAL", "DS_HASH_LINHA",
   "CO_CANDIDATO_EMPREGARE", "NO_CANDIDATO")
select e.id, e.vaga, 'cod:ensaio-espelhos-' || e.i, 'CODIGO', '{}'::jsonb, encode(sha256(e.i::text::bytea), 'hex'),
       (9900000 + e.i)::text, 'Candidato(a) Fictício(a) ' || lpad(e.i::text, 4, '0')
  from ensaio_candidato e;

insert into public."TB_FICHA_ANALISE"
  ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "CO_REGRA_ANALISE", "NU_VERSAO_REGRA", "NU_LOTE",
   "TP_SITUACAO", "DS_LANCAMENTO", "DS_RESULTADO", "DS_PARECER", "TP_RESULTADO", "VL_NOTA_APURADA", "VL_NOTA_FINAL",
   "DT_CONCLUSAO", "CO_USUARIO_CONCLUSAO")
select 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0', e.id, e.vaga, r."CO_REGRA_ANALISE", r."NU_VERSAO_REGRA", 1,
       'CONCLUIDA',
       jsonb_build_object(
         'nivel', 'superior', 'modalidade', 'AC', 'indigena', false, 'mora_aldeia', false,
         'observacoes', 'Observação fictícia do ensaio.', 'observacoes_prontas', '[]'::jsonb,
         'blocos', jsonb_build_object(
           'IDENTIDADE', jsonb_build_object('situacao', 'CONFORME', 'motivos', '[]'::jsonb),
           'ESCOLARIDADE', jsonb_build_object('situacao', case when e.i % 4 = 1 then 'NAO_CONFORME' else 'CONFORME' end,
                                              'motivos', '[]'::jsonb,
                                              'motivo_livre', case when e.i % 4 = 1 then 'Diploma ilegível (fictício).' end),
           'CURSOS', jsonb_build_object('situacao', 'CONFORME', 'nota_ajustada', 5, 'justificativas', '[]'::jsonb),
           'EXPERIENCIA', jsonb_build_object('situacao', 'CONFORME', 'nota_ajustada', 15, 'justificativas', '[]'::jsonb)),
         'cursos', jsonb_build_array(jsonb_build_object('nome', 'Curso fictício', 'horas', 120, 'aceito', true)),
         'titulos', '[]'::jsonb,
         'vinculos', jsonb_build_array(
           jsonb_build_object('empregador', 'Empregador fictício A', 'categoria', 'AREA_OU_SUS',
                              'inicio', '2019-01-01', 'fim', '2024-12-31', 'aceito', true),
           jsonb_build_object('empregador', 'Empregador fictício B', 'categoria', 'AREA_OU_SUS',
                              'inicio', '2015-01-01', 'fim', '2018-12-31', 'aceito', true))),
       jsonb_build_object('resultado', case when e.i % 4 = 1 then 'INAPTO_REQUISITO'
                                            when e.i % 20 in (2, 6, 10) then 'INAPTO_NOTA' else 'APTO' end,
                          'declarada', jsonb_build_object('CURSOS', 5, 'FORMACAO', 0, 'EXPERIENCIA', 20),
                          'parciais', jsonb_build_object('CURSOS', 5, 'FORMACAO', 0, 'EXPERIENCIA', 15),
                          'nota_final', 20, 'observacoes', '[]'::jsonb),
       'Parecer fictício.',
       case when e.i % 4 = 1 then 'INAPTO_REQUISITO' when e.i % 20 in (2, 6, 10) then 'INAPTO_NOTA' else 'APTO' end,
       20, case when e.i % 4 = 1 then 0 else 20 - (e.i % 7) end,
       now(), (select p.user_id from public."TB_PERFIL_USUARIO" p join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil where p.ativo and a."ST_ADMIN_GLOBAL" limit 1)
  from ensaio_candidato e,
       (select f."CO_REGRA_ANALISE", f."NU_VERSAO_REGRA" from public."TB_FICHA_ANALISE" f
         where f."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0' and f."NU_VERSAO_REGRA" is not null
         limit 1) r;

set local session_replication_role = origin;

create temporary table ensaio_medida (passo text, ms numeric, fichas int, bytes int, regras int, proximo boolean, extra text)
  on commit drop;
grant insert, select on ensaio_medida to authenticated;
grant select on ensaio_candidato to authenticated;
-- Os códigos colados (lidos antes de trocar de papel): 3 fictícios concluídos, 1 inexistente
-- e 2 reais do 114 com ficha não concluída.
create temporary table ensaio_codigos on commit drop as
select x.codigo, x.ordem
  from unnest(array['9900003', '9900500', '9901000', '0000000']) with ordinality x(codigo, ordem)
union all
select c."CO_CANDIDATO_EMPREGARE"::text, 10 + row_number() over ()
  from (select c."CO_CANDIDATO_EMPREGARE"
          from public."TB_FICHA_ANALISE" f
          join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
         where f."CO_MONITORAMENTO" = 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0' and f."TP_SITUACAO" <> 'CONCLUIDA'
           and c."CO_CANDIDATO_EMPREGARE" is not null
         limit 2) c;
grant select on ensaio_codigos to authenticated;

-- Um administrador global ativo (o papel na avaliação é COORDENADOR em qualquer edital).
select set_config('request.jwt.claims',
                  json_build_object('sub', (select p.user_id from public."TB_PERFIL_USUARIO" p
                                              join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
                                             where p.ativo and a."ST_ADMIN_GLOBAL" limit 1),
                                    'role', 'authenticated')::text, true);
set local role authenticated;

do $ensaio$
declare
  v_apos text;
  v_regras text[];
  v_r json;
  v_t timestamptz;
  v_pagina int := 0;
  v_codigos text[];
begin
  -- Todas as concluídas, em páginas de 200 (a tela manda as regras que já tem).
  loop
    v_pagina := v_pagina + 1;
    v_t := clock_timestamp();
    v_r := public.obter_espelhos_de_nota('bcecfb08-88ef-4e06-8401-bcad6bf88fd0', null, 'TODOS', null, v_apos, 200, v_regras);
    insert into ensaio_medida values ('todas p' || v_pagina,
      round(extract(epoch from clock_timestamp() - v_t)::numeric * 1000, 1),
      json_array_length(v_r -> 'fichas'), length(v_r::text),
      (select count(*) from json_object_keys(v_r -> 'regras')), (v_r ->> 'proximo') is not null, null);
    select coalesce(v_regras, '{}') || coalesce(array_agg(k), '{}') into v_regras from json_object_keys(v_r -> 'regras') k;
    v_apos := v_r ->> 'proximo';
    exit when v_apos is null or v_pagina > 20;
  end loop;

  v_t := clock_timestamp();
  v_r := public.obter_espelhos_de_nota('bcecfb08-88ef-4e06-8401-bcad6bf88fd0', null, 'APTOS', null, null, 200, v_regras);
  insert into ensaio_medida values ('só aptos p1', round(extract(epoch from clock_timestamp() - v_t)::numeric * 1000, 1),
    json_array_length(v_r -> 'fichas'), length(v_r::text), 0, (v_r ->> 'proximo') is not null,
    (select string_agg(distinct x ->> 'resultado', ',') from json_array_elements(v_r -> 'fichas') x));

  v_t := clock_timestamp();
  v_r := public.obter_espelhos_de_nota('bcecfb08-88ef-4e06-8401-bcad6bf88fd0',
           (select array_agg(vaga) from ensaio_candidato where i = 1),
           'INAPTOS', null, null, 200, v_regras);
  insert into ensaio_medida values ('1 vaga, inaptos', round(extract(epoch from clock_timestamp() - v_t)::numeric * 1000, 1),
    json_array_length(v_r -> 'fichas'), length(v_r::text), 0, (v_r ->> 'proximo') is not null,
    (select string_agg(distinct (x ->> 'vaga') || '/' || (x ->> 'resultado'), ',') from json_array_elements(v_r -> 'fichas') x));

  -- Códigos colados: 3 fictícios concluídos, 2 reais do 114 sem ficha concluída e 1 inexistente.
  select array_agg(codigo order by ordem) into v_codigos from ensaio_codigos;
  v_t := clock_timestamp();
  v_r := public.obter_espelhos_de_nota('bcecfb08-88ef-4e06-8401-bcad6bf88fd0', null, 'TODOS', v_codigos, null, 200, v_regras);
  insert into ensaio_medida values ('códigos colados', round(extract(epoch from clock_timestamp() - v_t)::numeric * 1000, 1),
    json_array_length(v_r -> 'fichas'), length(v_r::text), 0, (v_r ->> 'proximo') is not null,
    'nao_concluidos=' || json_array_length(v_r -> 'nao_concluidos'));

  -- Quem não coordena o edital: 42501.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', '00000000-0000-4000-a000-00000000e5f0', 'role', 'authenticated')::text, true);
  begin
    perform public.obter_espelhos_de_nota('bcecfb08-88ef-4e06-8401-bcad6bf88fd0');
    insert into ensaio_medida values ('sem permissão', null, null, null, null, null, 'NÃO RECUSOU');
  exception when others then
    insert into ensaio_medida values ('sem permissão', null, null, null, null, null, sqlstate || ' ' || sqlerrm);
  end;
end;
$ensaio$;

select * from ensaio_medida;
