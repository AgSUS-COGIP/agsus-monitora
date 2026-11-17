/*
  O ROTEIRO DO 93/2026 ACEITA NOTA COM DUAS CASAS (17/11/2026)

  POR QUE
  As bancas do 93/2026 (SESMT) dão notas quebradas em cada habilidade (1,29; 1,67; 0,88: o
  edital, item 8.3.11, manda cada examinador dar de 0,0 a 2,0 "considerando a avaliação integrada
  dos critérios de Conceituação, Propriedade e Profundidade"). O roteiro "Projetos — Análise
  Comportamental (SESMT)" estava com a escala de 0,5 em 0,5: as notas importadas da planilha
  valem (a ficha aceita a gravada, #847), mas trocar uma nota por outra quebrada era recusado
  ("Nota fora da escala"). Pedido: "o sistema precisa aceitar colocar números quebrados também".

  O QUE MUDA
  O passo das notas desse roteiro (TB_ROTEIRO_ENTREVISTA."VL_PASSO") vai de 0,50 para 0,01: a
  ficha e o banco (FC_EXIGIR_NOTA_NA_ESCALA) aceitam qualquer nota de 0 a 2,0 com até duas casas.
  As notas de 0,5 em 0,5 continuam valendo. O roteiro é do 93/2026 e do 96/2025 (concluído, sem
  entrevista lançada no sistema). Outros roteiros: o passo se escolhe em Preparar › Roteiro
  ("Passo das notas", 0,01 aceita duas casas).

  GUARDA: o roteiro existe com passo 0,50 e nenhum outro edital tem entrevista lançada nele.
  Ensaio: supabase/ensaios/20261117040000_roteiro_do_93_aceita_nota_com_duas_casas.sql
  Rollback: supabase/rollback/20261117040000_roteiro_do_93_aceita_nota_com_duas_casas.sql
*/

begin;

set local lock_timeout = '5s';

do $passo$
declare
  v_roteiro constant uuid := 'a153cace-9188-4b54-8328-a69979f895ec';
  v_passo numeric;
begin
  select "VL_PASSO" into v_passo from public."TB_ROTEIRO_ENTREVISTA" where "CO_ROTEIRO" = v_roteiro;
  if v_passo is distinct from 0.50 then
    raise exception 'Roteiro do 93/2026 com passo % (esperado 0,50): confira antes', v_passo using errcode = '55000';
  end if;
  if exists (select 1 from public."TB_ENTREVISTA" e
              where e."CO_ROTEIRO" = v_roteiro and e."ST_ATIVO" = 'S'
                and e."CO_MONITORAMENTO" <> 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded') then
    raise exception 'Outro edital tem entrevista lançada neste roteiro: confira antes' using errcode = '55000';
  end if;
  update public."TB_ROTEIRO_ENTREVISTA" set "VL_PASSO" = 0.01 where "CO_ROTEIRO" = v_roteiro;
end
$passo$;

commit;
