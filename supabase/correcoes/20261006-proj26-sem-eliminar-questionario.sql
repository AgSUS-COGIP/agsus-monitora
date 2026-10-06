/*
  CORREÇÃO DE DADOS — modelos de Projetos sem a eliminação automática por
  questionário não finalizado.

  Os editais 93/2026 e 114/2026 não eliminam quem deixou o questionário da
  Empregare "Em andamento" ou "Pendente": encerrado o período, as inscrições
  "serão automaticamente efetivadas" (item 6.11.4), e só é eliminado quem não
  comprovar os requisitos da vaga, na análise curricular (item 8.2.1). Fica a
  eliminação automática de quem cancelou a inscrição (e a reprovação manual na
  Empregare).

  Rode DEPOIS de 20261006-modelos-da-regra-da-analise.sql e de
  20261006-modelo-proj26-rio-doce.sql, no SQL Editor (papel postgres).
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
            where e ->> 'codigo' <> 'QUESTIONARIO'
         ), '[]'::jsonb)),
       "DT_ATUALIZACAO" = now()
 where m."CO_MODELO" in ('PROJ26-CURRICULAR', 'PROJ26-RIO-DOCE')
   and exists (
         select 1
           from jsonb_array_elements(m."DS_CONFIGURACAO" -> 'provisoria' -> 'eliminacao_automatica') e
          where e ->> 'codigo' = 'QUESTIONARIO');

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
