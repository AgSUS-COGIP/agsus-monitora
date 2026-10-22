/*
  Rollback de 20261022160000_rascunho_da_ficha_nao_republica_o_painel.sql:
  o gatilho volta a republicar a cada mudança de DS_PARECER ou DS_RESULTADO,
  em qualquer situação (como em 20261015150000).
*/
begin;

drop trigger if exists "TG_FICHAANALISE_PUBLICA_UPD" on public."TB_FICHA_ANALISE";
create trigger "TG_FICHAANALISE_PUBLICA_UPD"
  after update on public."TB_FICHA_ANALISE"
  for each row
  when (old."TP_SITUACAO"::text is distinct from new."TP_SITUACAO"::text
        or old."CO_USUARIO_RESPONSAVEL" is distinct from new."CO_USUARIO_RESPONSAVEL"
        or old."TP_RESULTADO"::text is distinct from new."TP_RESULTADO"::text
        or old."VL_NOTA_FINAL" is distinct from new."VL_NOTA_FINAL"
        or old."VL_NOTA_APURADA" is distinct from new."VL_NOTA_APURADA"
        or old."DS_PARECER" is distinct from new."DS_PARECER"
        or old."DS_RESULTADO" is distinct from new."DS_RESULTADO"
        or old."CO_USUARIO_CONCLUSAO" is distinct from new."CO_USUARIO_CONCLUSAO"
        or old."DT_CONCLUSAO" is distinct from new."DT_CONCLUSAO"
        or old."CO_VAGA"::text is distinct from new."CO_VAGA"::text)
  execute function private."FC_TG_PUBLICAR_FICHA_ANALISE"();

comment on trigger "TG_FICHAANALISE_PUBLICA_UPD" on public."TB_FICHA_ANALISE" is null;

commit;
