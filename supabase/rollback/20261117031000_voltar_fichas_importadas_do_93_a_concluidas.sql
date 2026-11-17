/*
  ROLLBACK de supabase/migrations/20261117031000_voltar_fichas_importadas_do_93_a_concluidas.sql

  Devolve a REVISAR as fichas do 93/2026 que a migration voltou a CONCLUIDA (as que têm, como
  última ação, o CORRIGIR com o motivo dela), com o histórico REVISAR. Atenção: em REVISAR a ficha
  republica a linha do Painel das análises pelo caminho comum (situação Revisar; modalidade, PcD e
  parciais pela ficha vazia) — o mesmo estado ruim que a migration desfez. Só rode se for mesmo
  para voltar a esse estado.
*/

begin;

set local lock_timeout = '5s';

do $voltar$
declare
  v_f record;
  v_n integer := 0;
begin
  for v_f in
    select f."CO_FICHA_ANALISE", f."CO_USUARIO_RESPONSAVEL"
      from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" = 'f57d77e1-7f6b-416c-9f9e-6e40c6d5bded'
       and f."TP_SITUACAO" = 'CONCLUIDA'
       and (select h."TP_ACAO" || '|' || coalesce(h."DS_MOTIVO", '') from public."TH_FICHA_ANALISE" h
             where h."CO_FICHA_ANALISE" = f."CO_FICHA_ANALISE"
             order by h."DT_REGISTRO" desc, h."CO_HISTORICO_FICHA" desc limit 1)
           like 'CORRIGIR|Volta a concluída: a conferência automática%'
  loop
    update public."TB_FICHA_ANALISE" set
      "TP_SITUACAO" = 'REVISAR', "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_f."CO_FICHA_ANALISE";
    perform private."FC_HISTORICO_FICHA"(v_f."CO_FICHA_ANALISE", 'REVISAR', 'CONCLUIDA', v_f."CO_USUARIO_RESPONSAVEL",
      'Rollback de 20261117031000: de volta a revisão.', null);
    v_n := v_n + 1;
  end loop;
  raise notice '% ficha(s) de volta a REVISAR', v_n;
end
$voltar$;

commit;
