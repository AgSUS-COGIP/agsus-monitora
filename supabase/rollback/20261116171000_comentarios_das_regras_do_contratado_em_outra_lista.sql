/*
  ROLLBACK de 20261116171000_comentarios_das_regras_do_contratado_em_outra_lista: volta os
  comentários de antes da 20261116170000.
*/
begin;

comment on constraint "CK_CONTRATAPROV_ESCOLHA" on public."TB_CONTRATACAO_APROVADO" is 'Ambíguo sem escolha; contratação aponta para si; em outra lista aponta para outra linha; o motivo combina.';
comment on constraint "CK_CONTRATAPROV_TPMOTIVO" on public."TB_CONTRATACAO_APROVADO" is 'Motivos válidos.';

commit;
