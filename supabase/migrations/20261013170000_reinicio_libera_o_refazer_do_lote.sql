/*
  REINICIAR AS FICHAS LIBERA O REFAZER DO LOTE

  Por quê: o refazer do lote (20261013110000) só vale com todas as fichas do
  edital intocadas, e "intocada" olhava o histórico inteiro da ficha. Depois de
  um teste seguido de "Reiniciar as fichas do edital" (20261009160000), a ficha
  volta ao estado inicial (PENDENTE, sem responsável, reserva, lançamento,
  resultado, notas, rascunho nem conclusão), mas o histórico guarda o teste — e
  o refazer ficava recusado para sempre. O histórico não se apaga (auditoria).

  Agora: só conta o que aconteceu DEPOIS do último REINICIAR da ficha
  (NU_VERSAO maior). Sem REINICIAR, nada muda. Os campos da própria ficha
  continuam valendo (o reinício já os limpa).

  Rollback: supabase/rollback/20261013170000_reinicio_libera_o_refazer_do_lote.sql
*/
begin;

create or replace function private."FC_FICHA_INICIADA"(p_f public."TB_FICHA_ANALISE")
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_f."TP_SITUACAO" not in ('PENDENTE', 'FORA_LOTE')
      or p_f."CO_USUARIO_RESPONSAVEL" is not null or p_f."DT_ATRIBUICAO" is not null
      or p_f."CO_USUARIO_RESERVA" is not null
      or p_f."DS_LANCAMENTO" is not null or p_f."DS_RESULTADO" is not null or p_f."DS_PARECER" is not null
      or p_f."TP_RESULTADO" is not null or p_f."VL_NOTA_APURADA" is not null or p_f."VL_NOTA_FINAL" is not null
      or p_f."CO_USUARIO_RASCUNHO" is not null or p_f."CO_USUARIO_CONCLUSAO" is not null
      or exists (
        select 1 from public."TH_FICHA_ANALISE" h
         where h."CO_FICHA_ANALISE" = p_f."CO_FICHA_ANALISE"
           and h."TP_ACAO" not in ('CRIAR', 'SAIR_LOTE', 'VOLTAR_LOTE', 'REFAZER_LOTE', 'REINICIAR')
           and h."NU_VERSAO" > coalesce((
                 select max(r."NU_VERSAO") from public."TH_FICHA_ANALISE" r
                  where r."CO_FICHA_ANALISE" = p_f."CO_FICHA_ANALISE" and r."TP_ACAO" = 'REINICIAR'), 0));
$$;

comment on function private."FC_FICHA_INICIADA"(public."TB_FICHA_ANALISE") is
  'Ficha iniciada (trava o refazer do lote): situação fora de PENDENTE/FORA_LOTE, algum campo de análise preenchido ou, no histórico, ação que não é do lote depois do último REINICIAR.';

commit;
