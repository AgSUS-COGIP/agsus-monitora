/*
  ENTREVISTAS REPETIDAS: A LINHA DA PLANILHA AO LADO DA DO SISTEMA (22/10/2026)

  Correção de dados única, depois de supabase/migrations/20261022200000_funil_do_edital_de_uma_fonte_so.sql.
  NÃO RODAR SEM AUTORIZAÇÃO DO USUÁRIO.

  Por quê: a mesma análise curricular tinha duas entrevistas ativas em
  TB_ENTREVISTA — a da planilha (chave área|edital|vaga|código) e a do sistema
  (convocar_para_entrevista, chave sistema|edital|análise). O Painel de
  entrevistas contava as duas (aptos + inaptos > candidatos), e o KPI
  entrevistados do edital também. A migration passa a impedir o par em cada
  convocação e em cada fechamento da carga de entrevistas; esta correção
  desfaz os pares que já existem, uma vez, em todas as áreas.

  O que faz: private."FC_DESATIVAR_ENTREVISTAS_REPETIDAS"(área, null, autor)
  em cada área — desativa (ST_ATIVO = 'N') a linha da PLANILHA cuja análise
  tem linha do SISTEMA ativa, quando a da planilha não é a vigente pela regra
  única (parecer, nota, sistema, mais recente). A do sistema nunca é
  desativada; quando só a planilha tem o parecer, as duas ficam (as leituras
  usam a da planilha). Cada linha desativada ganha o histórico "repetida" em
  TH_ENTREVISTA_AVALIACAO, assinado pela conta do setor "Gestão da Informação
  de Pessoal" (a01afddb-f64b-47d9-80e8-476a1ed14e43), que precisa estar ativa.
  Nada é apagado.

  Ensaio: supabase/ensaios/20261022-entrevistas-repetidas-planilha-e-sistema.sql
  Desfazer: as linhas com histórico "repetida" desta execução voltam com
    update public."TB_ENTREVISTA" e set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now()
      from public."TH_ENTREVISTA_AVALIACAO" h
     where h."CO_ENTREVISTA" = e."CO_ENTREVISTA" and h."DS_CAMPO" = 'repetida'
       and h."CO_USUARIO" = 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
  (a próxima carga da planilha também as reativa, e o fechamento as desativa de novo).
*/
begin;

set local lock_timeout = '10s';

do $correcao$
declare
  c_autor constant uuid := 'a01afddb-f64b-47d9-80e8-476a1ed14e43';
  v_area text;
  v_qt integer;
  v_total integer := 0;
begin
  if to_regprocedure('private."FC_DESATIVAR_ENTREVISTAS_REPETIDAS"(text, uuid, uuid)') is null then
    raise exception 'Aplique antes 20261022200000_funil_do_edital_de_uma_fonte_so.sql.';
  end if;
  if not exists (select 1 from public."TB_PERFIL_USUARIO" u where u.user_id = c_autor and u.ativo) then
    raise exception 'A conta do setor (%) não está ativa: a correção não tem quem assine.', c_autor;
  end if;
  for v_area in select a."CO_AREA" from public."TB_AREA" a order by 1 loop
    v_qt := private."FC_DESATIVAR_ENTREVISTAS_REPETIDAS"(v_area, null, c_autor);
    v_total := v_total + v_qt;
    raise notice 'Área %: % entrevista(s) da planilha desativada(s) como repetida(s).', v_area, v_qt;
  end loop;
  raise notice 'Total: %.', v_total;
end;
$correcao$;

-- Os KPIs e o pacote com as linhas que ficaram (o pacote remonta pela marca do gatilho).
select private."FC_ATUALIZAR_KPIS_PELA_SELECAO"();

commit;
