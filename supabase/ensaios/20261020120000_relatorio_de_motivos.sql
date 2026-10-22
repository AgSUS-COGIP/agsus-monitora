/*
  Ensaio de 20261020120000_relatorio_de_motivos.sql (sempre desfeito: begin … rollback).

  Uso (Git Bash), no banco novo:
    source qn.sh
    qn "begin;
    $(sed -E '/^\s*(begin|commit|rollback)\s*;\s*$/Id' supabase/migrations/20261020120000_relatorio_de_motivos.sql)
    $(cat supabase/ensaios/20261020120000_relatorio_de_motivos.sql)
    rollback;"

  Lê as fichas reais do 114/2026 como a conta do setor (coordenação), só
  leitura. Espera-se (20/10/2026):
    - "Outro motivo por critério" com IDENTIDADE (Não confere, motivo OUTRO,
      concluídas): 39 fichas (37 no levantamento à mão da manhã), todas
      INAPTO_REQUISITO, com motivo_livre; bem abaixo de 200 ms;
    - "Pontuação ajustada" (CURSOS + EXPERIENCIA com justificativa): 171 fichas;
    - filtro inválido → 22023.
*/
create temporary table ensaio_tempos (caso text, ms numeric, total integer, primeira json) on commit drop;

grant all on ensaio_tempos to authenticated;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"a01afddb-f64b-47d9-80e8-476a1ed14e43","role":"authenticated"}', true);

do $ensaio$
declare
  t0 timestamptz;
  r json;
begin
  t0 := clock_timestamp();
  r := public.listar_relatorio_de_motivos('bcecfb08-88ef-4e06-8401-bcad6bf88fd0',
         '{"blocos":["IDENTIDADE"],"situacoes":["NAO_CONFORME","NAO_ENVIADO"],"motivo":"OUTRO","situacoes_ficha":["CONCLUIDA"]}');
  insert into ensaio_tempos values ('outro motivo identidade',
    extract(epoch from clock_timestamp() - t0) * 1000, (r ->> 'total')::int, r -> 'fichas' -> 0);

  t0 := clock_timestamp();
  r := public.listar_relatorio_de_motivos('bcecfb08-88ef-4e06-8401-bcad6bf88fd0',
         '{"blocos":["CURSOS","EXPERIENCIA"],"ajustada":true,"situacoes_ficha":["CONCLUIDA"]}');
  insert into ensaio_tempos values ('pontuacao ajustada',
    extract(epoch from clock_timestamp() - t0) * 1000, (r ->> 'total')::int, r -> 'fichas' -> 0);

  t0 := clock_timestamp();
  r := public.listar_relatorio_de_motivos('bcecfb08-88ef-4e06-8401-bcad6bf88fd0', '{}');
  insert into ensaio_tempos values ('sem filtro (pagina de 500)',
    extract(epoch from clock_timestamp() - t0) * 1000, (r ->> 'total')::int, null);

  begin
    perform public.listar_relatorio_de_motivos('bcecfb08-88ef-4e06-8401-bcad6bf88fd0', '{"situacoes":["XX"]}');
    insert into ensaio_tempos values ('filtro invalido NAO barrado', 0, 0, null);
  exception when sqlstate '22023' then
    insert into ensaio_tempos values ('filtro invalido barrado (22023)', 0, 0, null);
  end;
end;
$ensaio$;

select caso, round(ms, 1) as ms, total, primeira from ensaio_tempos;
