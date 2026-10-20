/*
  Ensaio de 20261020150000_detalhe_do_painel_com_espelho.sql (sempre desfeito: begin … rollback).

  Uso (Git Bash), no banco novo:
    source qn.sh
    qn "begin;
    $(sed -E '/^\s*(begin|commit|rollback)\s*;\s*$/Id' supabase/migrations/20261020150000_detalhe_do_painel_com_espelho.sql)
    $(cat supabase/ensaios/20261020150000_detalhe_do_painel_com_espelho.sql)
    rollback;"

  Lê, como a conta do setor (leitora do painel da área Projetos), só leitura:
    - a linha MONITORA do caso da gaveta (Fábio de Oliveira Aquino, 114/2026,
      vaga 182424, nota final 50): "espelho" com ficha CONCLUIDA, APTO, nota 50,
      declarada {FORMACAO 10, CURSOS 5, EXPERIENCIA 35}, regra e documental
      (a mesma entrada de obter_espelhos_de_nota com p_codigos = {163719});
    - uma linha de planilha: "espelho" null, o resto igual ao de antes;
    - uma linha MONITORA eliminada (INAPTO_REQUISITO) e, se houver, uma linha da
      planilha adotada pela ficha (chave sem "monitora|"): "espelho" preenchido;
    - o tempo de cada chamada (alvo: bem abaixo de 150 ms).
  Resultado em 20/10/2026: Fábio 67 ms na primeira chamada (cache frio) e
  6 ms na segunda, 34,5 KB (a configuração da regra é ~31 KB); planilha 5 ms,
  espelho null; eliminado 10 ms; adotada 50 ms (a busca pela regra da adoção).
*/
-- Os casos são escolhidos antes de virar authenticated (que não lê as tabelas).
create temporary table ensaio_casos on commit drop as
select 1 as ordem, 'fabio (monitora)' as caso, '817a6ded-dcb6-4a40-a390-2f90274062ba'::uuid as id
union all
select 2, 'fabio (de novo)', '817a6ded-dcb6-4a40-a390-2f90274062ba'::uuid
union all
(select 3, 'planilha', a.id from public."TB_ANALISE_CURRICULAR" a
  where a."TP_ORIGEM_REGISTRO" = 'PLANILHA' and a."CO_AREA" = 'projetos' limit 1)
union all
(select 4, 'eliminado (monitora)', a.id from public."TB_ANALISE_CURRICULAR" a
   join public."TB_FICHA_ANALISE" f
     on a.chave_natural = 'monitora|' || f."CO_MONITORAMENTO" || '|' || f."CO_EMPREGARE_CANDIDATO"
  where f."TP_SITUACAO" = 'CONCLUIDA' and f."TP_RESULTADO" = 'INAPTO_REQUISITO' limit 1)
union all
(select 5, 'adotada (planilha da ficha)', a.id from public."TB_ANALISE_CURRICULAR" a
  where a."TP_ORIGEM_REGISTRO" = 'MONITORA' and a.chave_natural not like 'monitora|%' limit 1);
create temporary table ensaio (ordem integer, caso text, ms numeric, kb numeric, espelho jsonb) on commit drop;

grant all on ensaio, ensaio_casos to authenticated;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);

do $ensaio$
declare
  t0 timestamptz;
  r jsonb;
  v_caso record;
begin
  for v_caso in select * from ensaio_casos order by ordem loop
    t0 := clock_timestamp();
    r := public.get_analise_detalhe_do_painel(v_caso.id);
    insert into ensaio values (v_caso.ordem, v_caso.caso,
      round((extract(epoch from clock_timestamp() - t0) * 1000)::numeric, 1),
      round(length(r::text) / 1024.0, 1),
      case when r -> 'espelho' = 'null'::jsonb or r -> 'espelho' is null then null
           else (r -> 'espelho') - 'regra' || jsonb_build_object('tem_regra', r #> '{espelho,regra}' is not null) end);
  end loop;
end
$ensaio$;

select caso, ms, kb, espelho from ensaio order by ordem;
