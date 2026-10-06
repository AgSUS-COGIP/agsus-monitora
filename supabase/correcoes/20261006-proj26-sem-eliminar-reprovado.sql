/*
  CORREÇÃO DE DADOS — modelos de Projetos sem a eliminação automática por
  "Reprovado na Empregare".

  A reprovação marcada pela equipe na Empregare é o RESULTADO da análise
  curricular (item 8.2.1 dos editais 93/2026 e 114/2026), não motivo para a
  pessoa ficar fora do lote: quem tem a nota mínima (8.2.6) segue no lote e a
  reprovação aparece como resultado da análise dela. Fica só a eliminação
  automática de quem cancelou a inscrição.

  Rode DEPOIS de 20261006-proj26-sem-eliminar-questionario.sql, no SQL Editor
  (papel postgres).
  Idempotente. Não muda a regra já copiada para um edital: a coordenação
  recarrega o modelo na aba Regra e salva uma versão nova, com motivo.
*/
begin;

update public."TB_REGRA_ANALISE_MODELO" m
   set "DS_CONFIGURACAO" = jsonb_set(
         m."DS_CONFIGURACAO",
         '{provisoria,eliminacao_automatica}',
         coalesce((
           select jsonb_agg(e order by o)
             from jsonb_array_elements(m."DS_CONFIGURACAO" -> 'provisoria' -> 'eliminacao_automatica') with ordinality as x(e, o)
            where e ->> 'codigo' <> 'REPROVADO_EMPREGARE'
         ), '[]'::jsonb)),
       "DT_ATUALIZACAO" = now()
 where m."CO_MODELO" in ('PROJ26-CURRICULAR', 'PROJ26-RIO-DOCE')
   and exists (
         select 1
           from jsonb_array_elements(m."DS_CONFIGURACAO" -> 'provisoria' -> 'eliminacao_automatica') e
          where e ->> 'codigo' = 'REPROVADO_EMPREGARE');

do $$
declare
  v_modelo record;
begin
  for v_modelo in
    select * from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" in ('PROJ26-CURRICULAR', 'PROJ26-RIO-DOCE')
  loop
    perform private."FC_VALIDAR_REGRA_ANALISE"(v_modelo."DS_CONFIGURACAO");
  end loop;
end;
$$;

select "CO_MODELO",
       (select jsonb_agg(e ->> 'codigo') from jsonb_array_elements("DS_CONFIGURACAO" -> 'provisoria' -> 'eliminacao_automatica') e) as eliminacoes
  from public."TB_REGRA_ANALISE_MODELO"
 where "CO_MODELO" in ('PROJ26-CURRICULAR', 'PROJ26-RIO-DOCE')
 order by 1;

commit;
