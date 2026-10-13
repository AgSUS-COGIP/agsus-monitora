/*
  CORREÇÃO DE DADOS — nomes de pessoas fora do resumo das perguntas da carga
  (public."TB_RESUMO_PERGUNTA_EDITAL").

  POR QUÊ (auditoria de 13/10/2026): o resumo guarda até 30 respostas
  repetidas (2+ vezes) de cada pergunta, para a coordenação ligar as
  perguntas aos blocos da regra. As perguntas "Se respondeu SIM na pergunta
  anterior, por gentileza informe o nome completo do trabalhador da AgSUS"
  não eram reconhecidas como dado pessoal, e o resumo de 102/2026, 93/2026,
  101/2026 e 114/2026 passou a guardar NOMES de trabalhadores da AgSUS
  (até 30 por pergunta). A regra de privacidade fica em Python
  (python/monitora/avaliacao_documental/perguntas_da_carga.py,
  pede_dado_pessoal), corrigida nesta mesma branch; o robô só regrava o
  resumo do edital cuja carga mudou, então os resumos já gravados precisam
  desta correção.

  O QUE FAZ: em cada linha, cada pergunta cujo enunciado pede nome de pessoa
  (o mesmo padrão novo do Python: nome completo, nome social, seu nome, nome
  do trabalhador/parente/cônjuge/companheiro/servidor/funcionário/
  colaborador/familiar/empregado) passa a ter respostas [], outras =
  distintas e "dado_pessoal": true — exatamente o que o Python grava para
  pergunta de dado pessoal. A ordem das perguntas e as demais ficam iguais.
  DT_ATUALIZACAO e DS_HASH_VAGA não mudam (o robô recalcula quando a carga
  mudar, já com a regra nova).

  Ensaio (begin … rollback): conte as perguntas afetadas antes e depois
  com a consulta de conferência no fim. Rodar uma vez; rodar de novo não
  muda nada (idempotente).
*/
begin;

with alvo as (
  select r."CO_MONITORAMENTO",
         jsonb_agg(
           case
             when translate(lower(regexp_replace(e.p ->> 'coluna', '^\s*pergunta\s*\d*\s*[-–:.]?\s*', '', 'i')),
                            'áàâãäéêèëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
                  ~ '\y(nome completo|nome social|seu nome|nome d[oa]s? (trabalhador|trabalhadora|parente|conjuge|companheir[oa]|servidor|servidora|funcionari[oa]|colaborador|colaboradora|familiar|empregad[oa]))\y'
             then (e.p - 'respostas' - 'outras' - 'dado_pessoal')
                  || jsonb_build_object('respostas', '[]'::jsonb,
                                        'outras', coalesce((e.p ->> 'distintas')::integer, 0),
                                        'dado_pessoal', true)
             else e.p
           end
           order by e.ordem) as novo
    from public."TB_RESUMO_PERGUNTA_EDITAL" r
    cross join lateral jsonb_array_elements(r."DS_PERGUNTA") with ordinality as e(p, ordem)
   group by r."CO_MONITORAMENTO"
)
update public."TB_RESUMO_PERGUNTA_EDITAL" r
   set "DS_PERGUNTA" = a.novo
  from alvo a
 where a."CO_MONITORAMENTO" = r."CO_MONITORAMENTO"
   and a.novo is distinct from r."DS_PERGUNTA";

-- Conferência: nenhuma pergunta de nome com respostas guardadas (esperado: 0).
select count(*) as perguntas_de_nome_com_respostas
  from public."TB_RESUMO_PERGUNTA_EDITAL" r
 cross join lateral jsonb_array_elements(r."DS_PERGUNTA") e
 where translate(lower(e ->> 'coluna'), 'áàâãäéêèëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
       ~ '\y(nome completo|nome social|seu nome|nome d[oa]s? (trabalhador|trabalhadora|parente|conjuge|companheir[oa]|servidor|servidora|funcionari[oa]|colaborador|colaboradora|familiar|empregad[oa]))\y'
   and jsonb_array_length(e -> 'respostas') > 0;

commit;
