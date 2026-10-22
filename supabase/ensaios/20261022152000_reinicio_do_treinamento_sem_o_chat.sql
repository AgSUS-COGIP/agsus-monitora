/*
  ENSAIO de 20261022152000_reinicio_do_treinamento_sem_o_chat.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Confere:
    1. ANTES: a função de hoje falha com 42P01 num edital de treinamento
       (a conversa está no schema "arquivo");
    2. a migration recriada: os editais de treinamento são reiniciados sem
       erro (a função apaga de verdade dentro da transação — o rollback do fim
       devolve tudo), e nenhum edital real é tocado (42501);
    3. privilégios iguais (só postgres e service_role) e o comentário sem a
       conversa.
  Termina em rollback: nada fica gravado.
*/
begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- 1. Antes.
do $ensaio$
declare
  v_edital uuid;
  v_estado text;
begin
  select id into v_edital from public."TB_MONITORAMENTO_INDIGENA"
   where "ST_TREINAMENTO" = 'S' order by id limit 1;
  assert v_edital is not null, 'sem edital de treinamento para ensaiar';
  begin
    perform private."FC_APAGAR_DADOS_DO_TREINAMENTO"(v_edital);
    v_estado := 'ok';
  exception when others then
    v_estado := sqlstate;
  end;
  raise notice 'antes da migration: %', v_estado;
  assert v_estado = '42P01', 'esperava 42P01 antes da migration, veio ' || v_estado;
end;
$ensaio$;

-- 2. A migration (corpo de supabase/migrations/20261022152000_…).

CREATE OR REPLACE FUNCTION private."FC_APAGAR_DADOS_DO_TREINAMENTO"(p_edital uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_numero text;
  v_qt jsonb := '{}'::jsonb;
  v_n integer;
begin
  -- A trava: a linha travada TEM de ser de treinamento. Nada é apagado antes disto.
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital for update;
  if v_m.id is null then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  if v_m."ST_TREINAMENTO" is distinct from 'S' then
    raise exception 'Só o edital de treinamento pode ser reiniciado: este edital é real e nada foi apagado'
      using errcode = '42501';
  end if;
  -- Vaga que veio do robô da Empregare (CO_SYNC) não é do treinamento: recusa.
  if exists (select 1 from public."TB_EMPREGARE_VAGA" v where v."CO_MONITORAMENTO" = p_edital and v."CO_SYNC" is not null) then
    raise exception 'O edital de treinamento tem vaga carregada pelo robô da Empregare; nada foi apagado' using errcode = '23514';
  end if;
  v_numero := private."FC_NUMERO_EDITAL"(v_m.edital);

  perform set_config('agsus.reinicio_treinamento', p_edital::text, true);

  -- Lista de aprovados, cartas e convocação.
  create temporary table if not exists tmp_treino_listas (id uuid primary key) on commit drop;
  truncate tmp_treino_listas;
  insert into tmp_treino_listas select l.id from public."TB_LISTA_APROVADO" l where l.edital_id = p_edital::text;
  delete from public."RL_CARTA_CANDIDATO" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_CANDIDATO_APROVADO" where lista_id in (select id from tmp_treino_listas);
  delete from public."TH_CANDIDATO_SUB_JUDICE" where "CO_LISTA" in (select id from tmp_treino_listas);
  delete from public."TH_CARTA_CONVOCACAO" h using public."TB_MODELO_CARTA_CONVOCACAO" m
   where h."CO_MODELO_CARTA" = m."CO_MODELO_CARTA" and m."CO_MONITORAMENTO" = p_edital;
  delete from public."TH_MODELO_CARTA_CONVOCACAO" h using public."TB_MODELO_CARTA_CONVOCACAO" m
   where h."CO_MODELO_CARTA" = m."CO_MODELO_CARTA" and m."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_MODELO_CARTA_CONVOCACAO" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_PUBLICACAO_APROVADO"
   where "CO_MONITORAMENTO" = p_edital
      or "CO_LISTA_APROVADO" in (select id from tmp_treino_listas)
      or "CO_LISTA_APROVADO_ANTERIOR" in (select id from tmp_treino_listas);
  delete from public."TB_CANDIDATO_APROVADO" where lista_id in (select id from tmp_treino_listas);
  delete from public."TB_LISTA_APROVADO" where id in (select id from tmp_treino_listas);
  get diagnostics v_n = row_count; v_qt := v_qt || jsonb_build_object('listas_aprovados', v_n);
  delete from public."TB_CONVOCACAO_EDITAL" where "CO_EDITAL" = p_edital::text;

  -- Recursos.
  delete from public."TH_ANEXO_RECURSO" h using public."TB_ANEXO_RECURSO" a, public."TB_RECURSO_CANDIDATO" r
   where h."CO_ANEXO_RECURSO" = a."CO_ANEXO_RECURSO" and a."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO"
     and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ANEXO_RECURSO" a using public."TB_RECURSO_CANDIDATO" r
   where a."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO" and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TH_RESPOSTA_RECURSO" h using public."TB_RESPOSTA_RECURSO" s, public."TB_RECURSO_CANDIDATO" r
   where h."CO_RESPOSTA_RECURSO" = s."CO_RESPOSTA_RECURSO" and s."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO"
     and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_RESPOSTA_RECURSO" s using public."TB_RECURSO_CANDIDATO" r
   where s."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO" and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ITEM_AJUSTE_PONTUACAO" i using public."TB_AJUSTE_PONTUACAO_RECURSO" j
   where i."CO_AJUSTE_PONTUACAO" = j."CO_AJUSTE_PONTUACAO" and j."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_AJUSTE_PONTUACAO_RECURSO" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_RECURSO_CANDIDATO" h using public."TB_RECURSO_CANDIDATO" r
   where h."CO_RECURSO_CANDIDATO" = r."CO_RECURSO_CANDIDATO" and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_RECURSO_CANDIDATO" where "CO_MONITORAMENTO" = p_edital;
  get diagnostics v_n = row_count; v_qt := v_qt || jsonb_build_object('recursos', v_n);

  -- Entrevistas e agenda.
  delete from public."TB_AGENDA_ENTREVISTA" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_AGENDA_ENTREVISTA" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_REGRA_AGENDA_ENTREVISTA" h using public."TB_REGRA_AGENDA_ENTREVISTA" r
   where h."CO_REGRA_AGENDA" = r."CO_REGRA_AGENDA" and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_REGRA_AGENDA_ENTREVISTA" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ENTREVISTA_AVALIACAO" x using public."TB_ENTREVISTA" e
   where x."CO_ENTREVISTA" = e."CO_ENTREVISTA" and e."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ENTREVISTA_NOTA" x using public."TB_ENTREVISTA" e
   where x."CO_ENTREVISTA" = e."CO_ENTREVISTA" and e."CO_MONITORAMENTO" = p_edital;
  delete from public."TH_ENTREVISTA_AVALIACAO" x using public."TB_ENTREVISTA" e
   where x."CO_ENTREVISTA" = e."CO_ENTREVISTA" and e."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ENTREVISTA" where "CO_MONITORAMENTO" = p_edital;
  get diagnostics v_n = row_count; v_qt := v_qt || jsonb_build_object('entrevistas', v_n);
  delete from public."TB_ENTREVISTA_AVALIADOR" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ENTREVISTA_VAGA" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ENTREVISTA_LIBERACAO" where "CO_MONITORAMENTO" = p_edital;

  -- Classificação.
  delete from public."TB_DESEMPATE_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_LISTA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  get diagnostics v_n = row_count; v_qt := v_qt || jsonb_build_object('listas_classificacao', v_n);
  delete from public."RL_REGRA_CRITERIO_DESEMPATE" x using public."TB_REGRA_CLASSIFICACAO" r
   where x."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TH_REGRA_CLASSIFICACAO" h using public."TB_REGRA_CLASSIFICACAO" r
   where h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;

  -- Avaliação documental (gatilhos de imutabilidade: liberados só para este edital).
  delete from public."TL_ACESSO_FICHA_ANALISE" x using public."TB_FICHA_ANALISE" f
   where x."CO_FICHA_ANALISE" = f."CO_FICHA_ANALISE" and f."CO_MONITORAMENTO" = p_edital;
  delete from public."TH_FICHA_ANALISE" x using public."TB_FICHA_ANALISE" f
   where x."CO_FICHA_ANALISE" = f."CO_FICHA_ANALISE" and f."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_FICHA_ANALISE" where "CO_MONITORAMENTO" = p_edital;
  get diagnostics v_n = row_count; v_qt := v_qt || jsonb_build_object('fichas', v_n);
  delete from public."TH_DECISAO_LOTE" x using public."TB_DECISAO_LOTE" d
   where x."CO_DECISAO_LOTE" = d."CO_DECISAO_LOTE" and d."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_DECISAO_LOTE" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_PRE_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_PRE_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  get diagnostics v_n = row_count; v_qt := v_qt || jsonb_build_object('pre_classificacao', v_n);
  delete from public."TB_PRE_CLASSIF_VAGA" where "CO_MONITORAMENTO" = p_edital;
  delete from public."RL_ANALISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_REGRA_ANALISE" h using public."TB_REGRA_ANALISE" r
   where h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and r."CO_MONITORAMENTO" = p_edital;
  delete from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_ORIGEM_ANALISE_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_ORIGEM_ANALISE_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_EMPREGARE_CANDIDATO" c using public."TB_EMPREGARE_VAGA" v
   where c."CO_VAGA" = v."CO_VAGA" and v."CO_MONITORAMENTO" = p_edital and v."CO_SYNC" is null;
  get diagnostics v_n = row_count; v_qt := v_qt || jsonb_build_object('inscricoes', v_n);
  delete from public."TB_EMPREGARE_VAGA" where "CO_MONITORAMENTO" = p_edital and "CO_SYNC" is null;

  -- Avisos de conferência, quadro, cronograma (e o histórico dele).
  delete from public."TB_AVISO_CONFERENCIA" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_QUADRO_VAGA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TB_LOCAL_VAGA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  delete from public."TH_CRONOGRAMA_MONIT_INDIG" where monitoramento_id = p_edital;
  delete from public."TB_CRONOGRAMA_MONIT_INDIG" where monitoramento_id = p_edital;

  -- As análises fictícias: só as de origem 'treinamento', da área e do número deste edital.
  delete from public."TB_ANALISE_CURRICULAR" a
   where private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
     and a."CO_AREA" = v_m."CO_AREA"
     and private."FC_NUMERO_EDITAL"(a.edital) = v_numero;
  get diagnostics v_n = row_count; v_qt := v_qt || jsonb_build_object('analises', v_n);

  perform set_config('agsus.reinicio_treinamento', '', true);
  return v_qt;
end;
$function$;

comment on function private."FC_APAGAR_DADOS_DO_TREINAMENTO"(uuid) is
  $comentario$EXCEÇÃO à exclusão lógica (docs/banco-de-dados.md, seção 16): apaga fisicamente os dados do edital de TREINAMENTO (entrevistas, classificação, avaliação documental, inscrições fictícias, aprovados, recursos, cronograma, análises de origem treinamento). Trava a linha do edital e recusa (42501) se ST_TREINAMENTO não for S: nunca apaga dado de edital real. A linha do edital fica (mesmo id).$comentario$;

do $ensaio$
declare
  r record;
  v_ok integer := 0;
  v_qt jsonb;
  v_real uuid;
begin
  for r in select id from public."TB_MONITORAMENTO_INDIGENA" where "ST_TREINAMENTO" = 'S' loop
    begin
      v_qt := private."FC_APAGAR_DADOS_DO_TREINAMENTO"(r.id);
      assert v_qt ? 'fichas' and v_qt ? 'analises', 'retorno sem as contagens';
      v_ok := v_ok + 1;
    exception
      when sqlstate '23514' then
        raise notice 'treinamento com vaga do robô (recusa esperada): pulado';
    end;
  end loop;
  assert v_ok > 0, 'nenhum edital de treinamento foi reiniciado';

  select id into v_real from public."TB_MONITORAMENTO_INDIGENA"
   where "ST_TREINAMENTO" is distinct from 'S' limit 1;
  begin
    perform private."FC_APAGAR_DADOS_DO_TREINAMENTO"(v_real);
    assert false, 'apagou edital real';
  exception when sqlstate '42501' then
    null;
  end;
end;
$ensaio$;

-- 3. Privilégios e comentário.
do $ensaio$
declare
  v_oid oid := 'private."FC_APAGAR_DADOS_DO_TREINAMENTO"(uuid)'::regprocedure;
begin
  assert (select proacl::text from pg_proc where oid = v_oid)
         = '{postgres=X/postgres,service_role=X/postgres}', 'privilégios mudaram';
  assert not has_function_privilege('authenticated', v_oid, 'execute'), 'authenticated executa';
  assert obj_description(v_oid, 'pg_proc') not like '%conversa%', 'comentário ainda cita a conversa';
  assert (select prosrc from pg_proc where oid = v_oid) not like '%TB_CONVERSA%', 'corpo ainda cita TB_CONVERSA';
end;
$ensaio$;

select 'ensaio ok' as resultado;

rollback;
