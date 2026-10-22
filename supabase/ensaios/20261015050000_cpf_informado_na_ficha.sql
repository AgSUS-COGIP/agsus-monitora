/*
  ENSAIO da migration 20261015050000_cpf_informado_na_ficha.sql — begin … rollback.

  NÃO É MIGRATION. Rode depois da migration, na mesma transação (ensaio.sh:
  sem as linhas begin/commit), e desfaça. Leve: só a função, sem tocar tabela.

  Espera: a definição tem cpf_informado; a expressão, para uma ficha qualquer
  com a pergunta do CPF, dá 11 dígitos (sem mostrar o número).
*/
select position('cpf_informado' in pg_get_functiondef('public.obter_ficha_analise(uuid)'::regprocedure)) > 0 as tem_a_chave,
       (select length(regexp_replace(nullif(btrim(e.value), ''), '\D', '', 'g'))
          from (select f."CO_EMPREGARE_CANDIDATO" from public."TB_FICHA_ANALISE" f limit 1) f
          join public."TB_EMPREGARE_CANDIDATO" c using ("CO_EMPREGARE_CANDIDATO"),
               lateral jsonb_each_text(c."DS_COLUNA_ORIGINAL") e
         where e.key ~* '^\s*pergunta' and e.key ~* 'cpf' and nullif(btrim(e.value), '') is not null
         order by (e.key ~* 'identifica') desc, e.key limit 1) as digitos;
