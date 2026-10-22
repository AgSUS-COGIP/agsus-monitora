/*
  O RASCUNHO DA FICHA NÃO REPUBLICA O PAINEL

  Por quê: salvar_rascunho_ficha é a função que mais custou ao banco NANO de
  14 a 22/10/2026 (pg_stat_statements: 17.020 chamadas, 140 ms de média, 7,9 s de
  máximo, 2.378 s no total; a fila, a segunda, somou 1.079 s). Medido no banco
  (begin … rollback, 30 fichas, sem dados pessoais), o trabalho dela é ~25 ms, e
  quase metade é o gatilho TG_FICHAANALISE_PUBLICA_UPD: todo rascunho muda
  DS_RESULTADO (e às vezes DS_PARECER), e o gatilho chama
  private."FC_PUBLICAR_FICHA_ANALISE" (11,7 ms de média, 39 ms de máximo) para
  uma linha do Painel que não muda: com a ficha em análise, a linha publicada
  não usa parecer, notas nem parciais (v_com_nota só vale em CONCLUIDA e
  REVISAR) e o UPDATE final dela sai vazio (filtro "is distinct from").

  O QUE MUDA
    O gatilho TG_FICHAANALISE_PUBLICA_UPD continua igual para situação,
    responsável, resultado, notas, conclusão e vaga; a mudança de DS_PARECER ou
    DS_RESULTADO só republica quando a ficha (nova) está em CONCLUIDA ou
    REVISAR — o único caso em que a linha publicada as usa. Concluir, reabrir,
    revisar e redistribuir mudam TP_SITUACAO (ou o responsável) e seguem
    publicando como antes.
    Nada muda em salvar_rascunho_ficha (o PR #519 mexe nela; esta migration não
    conflita com ele).

  Dependentes: public."TB_FICHA_ANALISE", private."FC_TG_PUBLICAR_FICHA_ANALISE".
  Ensaio: supabase/ensaios/20261022160000_rascunho_da_ficha_nao_republica_o_painel.sql
  Rollback: supabase/rollback/20261022160000_rascunho_da_ficha_nao_republica_o_painel.sql
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
        or ((old."DS_PARECER" is distinct from new."DS_PARECER"
             or old."DS_RESULTADO" is distinct from new."DS_RESULTADO")
            and new."TP_SITUACAO"::text in ('CONCLUIDA', 'REVISAR'))
        or old."CO_USUARIO_CONCLUSAO" is distinct from new."CO_USUARIO_CONCLUSAO"
        or old."DT_CONCLUSAO" is distinct from new."DT_CONCLUSAO"
        or old."CO_VAGA"::text is distinct from new."CO_VAGA"::text)
  execute function private."FC_TG_PUBLICAR_FICHA_ANALISE"();

comment on trigger "TG_FICHAANALISE_PUBLICA_UPD" on public."TB_FICHA_ANALISE" is
  'Republica a linha da ficha no Painel das análises quando muda o que ela mostra; parecer e resultado só na ficha concluída ou em revisão: o rascunho não republica (20261022160000).';

commit;
