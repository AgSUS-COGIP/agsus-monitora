/*
  ENSAIO: o mesmo corpo, terminando em rollback.
  COMENTÁRIOS DAS REGRAS DO "CONTRATADO EM OUTRA LISTA" (16/11/2026)

  A migration 20261116170000 trocou CK_CONTRATAPROV_TPMOTIVO e CK_CONTRATAPROV_ESCOLHA por
  drop/add, e o comentário de cada uma saiu junto. Aqui eles voltam, citando o motivo novo.
  Só metadado: nenhuma linha muda.

  Ensaio: supabase/ensaios/20261116171000_comentarios_das_regras_do_contratado_em_outra_lista.sql
  Rollback: supabase/rollback/20261116171000_comentarios_das_regras_do_contratado_em_outra_lista.sql
*/
begin;

set local lock_timeout = '5s';

do $guarda$
begin
  if (select pg_get_constraintdef(oid) from pg_constraint where conname = 'CK_CONTRATAPROV_TPMOTIVO') not like '%ADMISSAO_NO_RH%' then
    raise exception 'Aplique antes a 20261116170000.';
  end if;
end;
$guarda$;

comment on constraint "CK_CONTRATAPROV_ESCOLHA" on public."TB_CONTRATACAO_APROVADO" is 'Ambíguo sem escolha; contratação aponta para si; em outra lista aponta para outra linha; o motivo combina (ADMISSAO_NO_RH só nas decisões: regra v2, 20261116170000).';
comment on constraint "CK_CONTRATAPROV_TPMOTIVO" on public."TB_CONTRATACAO_APROVADO" is 'Motivos válidos (ADMISSAO_NO_RH desde a regra v2, 20261116170000).';

rollback;
