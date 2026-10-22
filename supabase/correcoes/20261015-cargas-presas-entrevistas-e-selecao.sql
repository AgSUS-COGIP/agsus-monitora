/*
  CORREÇÃO DE DADOS — fecha as 5 cargas de planilha que ficaram EM_ANDAMENTO
  porque o robô parou no meio (estouro de tempo ou cancelamento):
    TL_SYNC_ENTREVISTA: gh-20260930-153337-a8162cda, gh-20260930-153848-e4d2166b,
                        gh-20261013-150514-34820561, gh-20261014-090515-7f2aa9f7
    TL_SYNC_SELECAO:    gh-20260930-153402-0d89d80e
  PRÉ-REQUISITO: 20261015141500 (situação FALHOU). Nada foi aplicado por essas
  cargas (a transação do robô desfez tudo); só a situação muda.
  Feita pela conta do setor Gestão da Informação de Pessoal
  (a01afddb-f64b-47d9-80e8-476a1ed14e43); as tabelas não têm coluna de usuário.
*/
begin;
update public."TL_SYNC_ENTREVISTA"
   set "TP_SITUACAO" = 'FALHOU', "DT_FIM" = coalesce("DT_FIM", now()),
       "DS_MENSAGEM" = concat_ws(' | ', nullif("DS_MENSAGEM", ''), 'Fechada em 15/10/2026 (correção de dados): o robô parou no meio; nada foi aplicado.')
 where "TP_SITUACAO" = 'EM_ANDAMENTO'
   and "CO_SYNC" in ('gh-20260930-153337-a8162cda', 'gh-20260930-153848-e4d2166b',
                     'gh-20261013-150514-34820561', 'gh-20261014-090515-7f2aa9f7');
update public."TL_SYNC_SELECAO"
   set "TP_SITUACAO" = 'FALHOU', "DT_FIM" = coalesce("DT_FIM", now()),
       "DS_MENSAGEM" = concat_ws(' | ', nullif("DS_MENSAGEM", ''), 'Fechada em 15/10/2026 (correção de dados): o robô parou no meio; nada foi aplicado.')
 where "TP_SITUACAO" = 'EM_ANDAMENTO' and "CO_SYNC" = 'gh-20260930-153402-0d89d80e';
commit;

select 'entrevista' tabela, "CO_SYNC", "TP_SITUACAO" from public."TL_SYNC_ENTREVISTA" where "TP_SITUACAO" in ('EM_ANDAMENTO', 'FALHOU')
union all
select 'selecao', "CO_SYNC", "TP_SITUACAO" from public."TL_SYNC_SELECAO" where "TP_SITUACAO" in ('EM_ANDAMENTO', 'FALHOU');
