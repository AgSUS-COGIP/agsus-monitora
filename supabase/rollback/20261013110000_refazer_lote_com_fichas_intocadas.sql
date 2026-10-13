-- ROLLBACK de supabase/migrations/20261013110000_refazer_lote_com_fichas_intocadas.sql
-- Devolve pre_classificacao_ler_editais, gravar_pre_classificacao_vaga, FC_TG_LOTE_COM_FICHA e
-- FC_ABRIR_FICHAS às definições de antes (as que estavam no banco em 13/10/2026), apaga
-- FC_FICHA_INICIADA, FC_FICHAS_INICIADAS e FC_LOTE_REFEITO_EM e tira a ação REFAZER_LOTE das
-- checagens do histórico das fichas (volta à de 20261009160000_reiniciar_fichas_do_edital.sql).
-- Só depois de nenhum lote refeito com ficha: o histórico não se apaga (FC_TG_FICHA_IMUTAVEL),
-- então se já houver linha REFAZER_LOTE o rollback recusa e nada muda — nesse caso, crie uma
-- migration que só volte as funções e deixe a ação na checagem.
begin;

set local lock_timeout = '10s';

do $$
begin
  if exists (select 1 from public."TH_FICHA_ANALISE" where "TP_ACAO" = 'REFAZER_LOTE') then
    raise exception 'Já há lote refeito no histórico das fichas: o rollback não volta a checagem (nada mudou).';
  end if;
end;
$$;

CREATE OR REPLACE FUNCTION public.pre_classificacao_ler_editais(p_editais text[] DEFAULT NULL::text[], p_apos_robo boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pedidos text[] := array(select btrim(x) from unnest(coalesce(p_editais, '{}')) x where btrim(x) <> '');
  v_ids uuid[];
  v_sync text;
begin
  if cardinality(v_pedidos) > 100 then
    raise exception 'Até 100 editais por execução' using errcode = '22023';
  end if;
  if cardinality(v_pedidos) > 0 then
    -- Cada pedido é o id do edital, o número ("93/2026") ou, sem número, o nome ("FCC").
    select coalesce(array_agg(distinct m.id), '{}') into v_ids
      from public."TB_MONITORAMENTO_INDIGENA" m
      join unnest(v_pedidos) p(texto)
        on m.id::text = lower(p.texto)
        or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
        or lower(btrim(m.edital)) = lower(p.texto);
  elsif p_apos_robo then
    -- Os editais das vagas gravadas na última execução fechada do robô.
    select s."CO_SYNC" into v_sync
      from public."TL_SYNC_EMPREGARE" s
     where s."TP_SITUACAO" in ('CONCLUIDA', 'PARCIAL')
     order by s."DT_INICIO" desc limit 1;
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
     where v."CO_SYNC" = v_sync and v."CO_MONITORAMENTO" is not null
       and not private."FC_EDITAL_EH_TREINAMENTO"(v."CO_MONITORAMENTO");
  else
    select coalesce(array_agg(distinct v."CO_MONITORAMENTO"), '{}') into v_ids
      from public."TB_EMPREGARE_VAGA" v
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
     where coalesce(m.ativo, false) and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO");
  end if;

  return jsonb_build_object(
    'hoje', (now() at time zone 'America/Sao_Paulo')::date,
    'sync', v_sync,
    'nao_encontrados', coalesce((
      select jsonb_agg(p.texto order by p.texto)
        from unnest(v_pedidos) p(texto)
       where not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                          where m.id::text = lower(p.texto)
                             or private."FC_NUMERO_EDITAL"(m.edital) = p.texto
                             or lower(btrim(m.edital)) = lower(p.texto))), '[]'::jsonb),
    'editais', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'rotulo', private."FC_ROTULO_DO_EDITAL"(m.edital),
               'area', m."CO_AREA",
               'ativo', coalesce(m.ativo, false),
               'treinamento', private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO"),
               'regra', (select jsonb_build_object('versao', r."NU_VERSAO_VIGENTE", 'situacao', r."TP_SITUACAO",
                                                   'configuracao', h."DS_CONFIGURACAO")
                           from public."TB_REGRA_ANALISE" r
                           join public."TH_REGRA_ANALISE" h
                             on h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
                          where r."CO_MONITORAMENTO" = m.id),
               'documental', private."FC_DOCUMENTAL_DO_EDITAL"(m.id),
               -- O cronograma: o job congela a declarada depois do fim das inscrições.
               'cronograma', coalesce((
                 select jsonb_agg(jsonb_build_object('atividade', c.atividade, 'inicio', c.data_inicio, 'fim', c.data_fim)
                        order by c.ordem)
                   from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = m.id), '[]'::jsonb),
               'refazer_permitido', not exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                                                 where a."CO_MONITORAMENTO" = m.id and a."TP_SITUACAO" = 'ANALISADO'),
               'vagas', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'codigo', v."CO_VAGA",
                          'cargo', q."NO_CARGO",
                          'situacao_carga', v."TP_SITUACAO",
                          'candidatos_ativos', v."QT_CANDIDATO_ATIVO",
                          'ultima_carga', v."DT_ULTIMA_CARGA",
                          'ultimo_lote', coalesce(pv."NU_ULTIMO_LOTE", 0),
                          'quadro', case when q."CO_QUADRO_VAGA" is null then null else jsonb_build_object(
                            'id', q."CO_QUADRO_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
                            'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S', 'modalidades', q."DS_MODALIDADE_VAGA") end)
                        order by v."CO_VAGA")
                   from public."TB_EMPREGARE_VAGA" v
                   left join public."TB_PRE_CLASSIF_VAGA" pv on pv."CO_MONITORAMENTO" = m.id and pv."CO_VAGA" = v."CO_VAGA"
                   left join lateral (select * from private."FC_QUADRO_DA_VAGA_EMPREGARE"(m.id, v."CO_VAGA")) q on true
                  where v."CO_MONITORAMENTO" = m.id), '[]'::jsonb))
             order by private."FC_ROTULO_DO_EDITAL"(m.edital), m.id)
        from public."TB_MONITORAMENTO_INDIGENA" m
       where m.id = any (v_ids)), '[]'::jsonb)
  );
end;
$function$;
comment on function public.pre_classificacao_ler_editais(text[], boolean) is
  'Pré-classificação (job Python): os editais a processar — os pedidos (id, número ou nome), os da última carga fechada do robô (p_apos_robo) ou, sem filtro, os ativos com vagas da Empregare — com a regra vigente (versão, situação e configuração), o que a regra de classificação diz do nível da vaga e da nota mínima (FC_DOCUMENTAL_DO_EDITAL, desde 20261007140000), o cronograma (atividade, início e fim de cada etapa, para o job achar o fim das inscrições e congelar a nota declarada, desde 20261007170000), se o lote ainda pode ser refeito e as vagas (cargo do quadro, carga, último lote, linha do quadro com vagas imediatas, cadastro reserva e modalidades). Sem dado pessoal. Só service_role.';

CREATE OR REPLACE FUNCTION public.gravar_pre_classificacao_vaga(p_execucao text, p_edital uuid, p_vaga text, p_versao_regra integer, p_resumo jsonb, p_linhas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_exec public."TL_PRE_CLASSIFICACAO" := private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(p_execucao);
  v_refazer boolean := v_exec."ST_REFAZER_LOTE" = 'S';
  v_quadro public."TB_QUADRO_VAGA_EDITAL";
  v_qt integer;
  v_erro text;
  v_mudancas integer;
  v_avisos jsonb := coalesce(p_resumo -> 'avisos', '[]'::jsonb);
  v_ant jsonb;
begin
  -- A regra usada é a vigente e está conferida.
  if not exists (select 1 from public."TB_REGRA_ANALISE" r
                  where r."CO_MONITORAMENTO" = p_edital and r."NU_VERSAO_VIGENTE" = p_versao_regra
                    and r."TP_SITUACAO" = 'CONFERIDA') then
    raise exception 'A regra do edital mudou ou não está conferida; rode de novo' using errcode = '40001';
  end if;
  if not exists (select 1 from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga and v."CO_MONITORAMENTO" = p_edital) then
    raise exception 'A vaga % não é do edital', p_vaga using errcode = '22023';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) > 20000 then
    raise exception 'Linhas inválidas (lista de até 20000)' using errcode = '22023';
  end if;
  if jsonb_typeof(p_resumo) is distinct from 'object' or jsonb_typeof(v_avisos) <> 'array' or jsonb_array_length(v_avisos) > 50
     or exists (select 1 from jsonb_array_elements(v_avisos) a where jsonb_typeof(a) <> 'string' or a #>> '{}' !~ '^[A-Z][A-Z0-9_:]{1,59}$')
     or length(coalesce(p_resumo ->> 'descricao', '')) > 200
     or (p_resumo -> 'tamanho' is not null and jsonb_typeof(p_resumo -> 'tamanho') not in ('number', 'null'))
     or (p_resumo -> 'por_modalidade' is not null and jsonb_typeof(p_resumo -> 'por_modalidade') not in ('object', 'null')) then
    raise exception 'Resumo da vaga inválido' using errcode = '22023';
  end if;

  begin
    perform count(*) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas);
  exception when invalid_text_representation or numeric_value_out_of_range or datatype_mismatch then
    raise exception 'Linha com tipo inválido (id, nota, posição ou lote)' using errcode = '22023';
  end;

  -- A forma do resultado (as mesmas regras das CK_, com mensagem clara).
  select case
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.id is null) then 'linha sem id'
    when (select count(*) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas)) <> (select count(distinct t.id) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t) then 'inscrito repetido'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where not exists (select 1 from public."TB_EMPREGARE_CANDIDATO" c
                                     where c."CO_EMPREGARE_CANDIDATO" = t.id and c."CO_VAGA" = p_vaga)) then 'inscrito que não é da vaga'
    when exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                  where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga
                    and not exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.id = a."CO_EMPREGARE_CANDIDATO")) then 'faltam inscritos já pré-classificados'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao is null or t.situacao not in ('ELIMINADO', 'RANQUEADO', 'NO_LOTE', 'ANALISADO')) then 'situação inválida'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where (t.situacao = 'ELIMINADO') <> (t.motivo_codigo is not null)
                     or (t.motivo_codigo is not null and (t.motivo_codigo !~ '^[A-Z][A-Z0-9_]{1,29}$'
                         or coalesce(length(btrim(t.motivo)), 0) not between 1 and 200))) then 'eliminado sem motivo (ou motivo fora de eliminado)'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where (t.situacao = 'ELIMINADO' and (t.posicao is not null or t.posicao_modalidade is not null))
                     or (t.situacao <> 'ELIMINADO' and (coalesce(t.posicao, 0) < 1 or coalesce(t.posicao_modalidade, 0) < 1))) then 'posição inválida'
    when (select count(*) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao <> 'ELIMINADO')
         <> coalesce((select max(t.posicao) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao <> 'ELIMINADO'), 0)
      or (select count(distinct t.posicao) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao <> 'ELIMINADO')
         <> (select count(*) from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t where t.situacao <> 'ELIMINADO') then 'posições não vão de 1 a N sem repetir'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where case when t.situacao in ('NO_LOTE', 'ANALISADO')
                             then coalesce(t.lote, 0) not between 1 and 999
                                  or coalesce(t.lista_lote, '') !~ '^(GERAL|[A-Z]{2,10})$'
                                  or coalesce(t.entrada, '') not in ('INICIAL', 'REPOSICAO', 'AMPLIACAO', 'DECISAO')
                                  or length(coalesce(t.motivo_entrada, '')) > 300
                             else t.lote is not null or t.lista_lote is not null or t.entrada is not null end) then 'lote inválido'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where coalesce(t.origem_nota, 'ART') not in ('ART', 'DECLARADA')
                     or t.modalidade !~ '^[A-Z]{2,10}$'
                     or abs(coalesce(t.art, 0)) > 1000 or abs(coalesce(t.nota, 0)) > 1000 or abs(coalesce(t.declarada, 0)) > 1000
                     or t.sem_mapa not between 0 and 100) then 'nota, origem ou modalidade inválida'
    -- A declarada congelada: completa, com o total igual à declarada da linha.
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where t.declarada_congelada is not null
                    and (jsonb_typeof(t.declarada_congelada -> 'total') is distinct from 'number'
                         or (t.declarada_congelada ->> 'total')::numeric not between 0 and 1000
                         or (t.declarada_congelada ->> 'total')::numeric is distinct from t.declarada
                         or t.declarada_completa is not true
                         or jsonb_typeof(coalesce(t.declarada_congelada -> 'respostas', '[]'::jsonb)) <> 'array'
                         or jsonb_array_length(coalesce(t.declarada_congelada -> 'respostas', '[]'::jsonb)) > 20
                         or length(t.declarada_congelada::text) > 20000)) then 'declarada congelada inválida'
    else null end
    into v_erro;
  if v_erro is not null then
    raise exception 'Resultado da vaga % recusado: %', p_vaga, v_erro using errcode = '22023';
  end if;

  -- A situação de antes de cada inscrito (para as travas e o histórico).
  select coalesce(jsonb_object_agg(a."CO_EMPREGARE_CANDIDATO",
                                   jsonb_build_object('s', a."TP_SITUACAO", 'l', a."NU_LOTE", 'e', a."TP_ENTRADA_LOTE")), '{}'::jsonb)
    into v_ant
    from public."TB_PRE_CLASSIFICACAO" a
   where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga;

  -- As decisões da coordenação (TB_DECISAO_LOTE): toda decisão vigente aplicada (no lote) e só
  -- entra por decisão quem tem decisão vigente, com o mesmo motivo.
  select case
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                   join public."TB_DECISAO_LOTE" d
                     on d."CO_MONITORAMENTO" = p_edital and d."CO_EMPREGARE_CANDIDATO" = t.id and d."ST_ATIVO" = 'S'
                  where t.situacao = 'RANQUEADO'
                     or (t.situacao = 'ELIMINADO' and t.motivo_codigo is distinct from 'SAIU_DA_EMPREGARE')) then 'decisão da coordenação não aplicada'
    when exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
                  where t.entrada = 'DECISAO'
                    and not exists (select 1 from public."TB_DECISAO_LOTE" d
                                     where d."CO_MONITORAMENTO" = p_edital and d."CO_EMPREGARE_CANDIDATO" = t.id and d."ST_ATIVO" = 'S'
                                       and btrim(d."DS_MOTIVO") = btrim(coalesce(t.motivo_entrada, '')))) then 'entrada por decisão sem decisão vigente'
    else null end
    into v_erro;
  if v_erro is not null then
    raise exception 'Resultado da vaga % recusado: %', p_vaga, v_erro using errcode = '22023';
  end if;

  -- A declarada congelada não muda: só a coordenação descongela (descongelar_declarada_pre_classificacao).
  if exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
               join public."TB_PRE_CLASSIFICACAO" a
                 on a."CO_MONITORAMENTO" = p_edital and a."CO_EMPREGARE_CANDIDATO" = t.id
              where a."VL_DECLARADA_CONGELADA" is not null and t.declarada is not null
                and t.declarada is distinct from a."VL_DECLARADA_CONGELADA") then
    raise exception 'Resultado da vaga % recusado: a nota declarada congelada não muda (descongele antes)', p_vaga using errcode = '22023';
  end if;

  -- Quem tem ficha (ANALISADO) não muda; ANALISADO só vem do banco (fase F3).
  if exists (select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
               cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote) h
              where (h.ant_situacao is not distinct from 'ANALISADO') <> (t.situacao = 'ANALISADO')
                 or (h.ant_situacao = 'ANALISADO' and h.ant_lote is distinct from t.lote)) then
    raise exception 'Resultado da vaga % recusado: quem já tem ficha não muda', p_vaga using errcode = '22023';
  end if;
  -- Quem está no lote só sai eliminado (a não ser que a execução refaça o lote); quem entrou
  -- por decisão da coordenação já revogada sai.
  if not v_refazer and exists (
      select 1 from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
       cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote,
                                  v_ant -> t.id::text ->> 'e' as ant_entrada) h
       where h.ant_situacao = 'NO_LOTE'
         and not (t.situacao = 'ELIMINADO' or (t.situacao = 'NO_LOTE' and t.lote = h.ant_lote))
         and not (h.ant_entrada = 'DECISAO'
                  and not exists (select 1 from public."TB_DECISAO_LOTE" d
                                   where d."CO_MONITORAMENTO" = p_edital and d."CO_EMPREGARE_CANDIDATO" = t.id and d."ST_ATIVO" = 'S'))) then
    raise exception 'Resultado da vaga % recusado: quem está no lote só sai eliminado (AM-5.5)', p_vaga using errcode = '22023';
  end if;

  -- Grava o resultado (rodar de novo atualiza a mesma linha: AM-4.2).
  insert into public."TB_PRE_CLASSIFICACAO" as a
    ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "NU_VERSAO_REGRA", "TP_SITUACAO",
     "CO_MOTIVO_ELIMINACAO", "DS_MOTIVO_ELIMINACAO", "VL_ART", "VL_NOTA_ORDEM", "TP_ORIGEM_NOTA",
     "VL_NOTA_DECLARADA", "DS_NOTA_DECLARADA", "ST_DIVERGENTE", "NO_MODALIDADE", "NU_POSICAO",
     "NU_POSICAO_MODALIDADE", "NU_LOTE", "CO_LISTA_LOTE", "TP_ENTRADA_LOTE", "DS_MOTIVO_ENTRADA",
     "DT_ENTRADA_LOTE", "CO_EXECUCAO", "VL_DECLARADA_CONGELADA", "DS_DECLARADA_CONGELADA", "DT_CONGELAMENTO_DECLARADA")
  select p_edital, t.id, p_vaga, p_versao_regra, t.situacao,
         t.motivo_codigo, left(btrim(t.motivo), 200), t.art, t.nota, t.origem_nota,
         t.declarada,
         case when t.declarada is null then null
              else jsonb_build_object('parciais', coalesce(t.declarada_parciais, '{}'::jsonb), 'sem_mapa', t.sem_mapa,
                                      'completa', t.declarada_completa) end,
         case when t.divergente then 'S' else 'N' end, t.modalidade, t.posicao,
         t.posicao_modalidade, t.lote, t.lista_lote, t.entrada, nullif(left(btrim(t.motivo_entrada), 300), ''),
         case when t.lote is not null then now() end, p_execucao,
         (t.declarada_congelada ->> 'total')::numeric,
         case when t.declarada_congelada is not null
              then (t.declarada_congelada - 'total') || jsonb_build_object('versao_regra', p_versao_regra) end,
         case when t.declarada_congelada is not null then now() end
    from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
  on conflict ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO") do update set
    "NU_VERSAO_REGRA" = excluded."NU_VERSAO_REGRA",
    "TP_SITUACAO" = excluded."TP_SITUACAO",
    "CO_MOTIVO_ELIMINACAO" = excluded."CO_MOTIVO_ELIMINACAO",
    "DS_MOTIVO_ELIMINACAO" = excluded."DS_MOTIVO_ELIMINACAO",
    "VL_ART" = excluded."VL_ART",
    "VL_NOTA_ORDEM" = excluded."VL_NOTA_ORDEM",
    "TP_ORIGEM_NOTA" = excluded."TP_ORIGEM_NOTA",
    "VL_NOTA_DECLARADA" = excluded."VL_NOTA_DECLARADA",
    "DS_NOTA_DECLARADA" = excluded."DS_NOTA_DECLARADA",
    "ST_DIVERGENTE" = excluded."ST_DIVERGENTE",
    "NO_MODALIDADE" = excluded."NO_MODALIDADE",
    "NU_POSICAO" = excluded."NU_POSICAO",
    "NU_POSICAO_MODALIDADE" = excluded."NU_POSICAO_MODALIDADE",
    "NU_LOTE" = excluded."NU_LOTE",
    "CO_LISTA_LOTE" = excluded."CO_LISTA_LOTE",
    "TP_ENTRADA_LOTE" = excluded."TP_ENTRADA_LOTE",
    "DS_MOTIVO_ENTRADA" = excluded."DS_MOTIVO_ENTRADA",
    -- Quem continua no mesmo lote guarda a data de entrada.
    "DT_ENTRADA_LOTE" = case when excluded."NU_LOTE" is null then null
                             when a."NU_LOTE" is not distinct from excluded."NU_LOTE" then a."DT_ENTRADA_LOTE"
                             else now() end,
    "CO_EXECUCAO" = excluded."CO_EXECUCAO",
    -- A congelada fica como estava; só entra quando ainda não há.
    "VL_DECLARADA_CONGELADA" = coalesce(a."VL_DECLARADA_CONGELADA", excluded."VL_DECLARADA_CONGELADA"),
    "DS_DECLARADA_CONGELADA" = case when a."VL_DECLARADA_CONGELADA" is not null then a."DS_DECLARADA_CONGELADA"
                                    else excluded."DS_DECLARADA_CONGELADA" end,
    "DT_CONGELAMENTO_DECLARADA" = case when a."VL_DECLARADA_CONGELADA" is not null then a."DT_CONGELAMENTO_DECLARADA"
                                       else excluded."DT_CONGELAMENTO_DECLARADA" end,
    "DT_ATUALIZACAO" = now();

  -- Histórico: entrada na lista, troca de situação ou de lote (com o motivo).
  insert into public."TH_PRE_CLASSIFICACAO"
    ("CO_EXECUCAO", "CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "TP_SITUACAO_ANTERIOR",
     "TP_SITUACAO", "NU_LOTE_ANTERIOR", "NU_LOTE", "NU_POSICAO", "DS_MOTIVO")
  select p_execucao, p_edital, t.id, p_vaga, h.ant_situacao, t.situacao, h.ant_lote, t.lote, t.posicao,
         left(case when t.situacao = 'ELIMINADO' then t.motivo
                   when t.entrada = 'DECISAO' and h.ant_entrada is distinct from 'DECISAO'
                     then 'Incluído no lote por decisão da coordenação: ' || t.motivo_entrada
                   when h.ant_entrada = 'DECISAO' and t.lote is null
                     then 'Saiu do lote: a decisão da coordenação foi revogada'
                   when t.lote is not null and t.lote is distinct from h.ant_lote then t.motivo_entrada
                   when h.ant_situacao = 'NO_LOTE' and t.situacao = 'RANQUEADO' then 'Saiu do lote: o recorte foi refeito'
                   when h.ant_situacao is null then 'Entrou na Provisória'
                   else null end, 300)
    from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
   cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote,
                              v_ant -> t.id::text ->> 'e' as ant_entrada) h
   where h.ant_situacao is null
      or h.ant_situacao is distinct from t.situacao
      or h.ant_lote is distinct from t.lote
      or h.ant_entrada is distinct from t.entrada;
  get diagnostics v_mudancas = row_count;

  -- O resumo da vaga: contagens feitas aqui; quadro lido aqui.
  v_quadro := private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital, p_vaga);
  select count(*) into v_qt from private."FC_LINHAS_PRE_CLASSIF"(p_linhas);
  insert into public."TB_PRE_CLASSIF_VAGA" as pv
    ("CO_MONITORAMENTO", "CO_VAGA", "CO_EXECUCAO", "NU_VERSAO_REGRA", "CO_QUADRO_VAGA", "NO_CARGO", "NO_LOTACAO",
     "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "QT_INSCRITO", "QT_ELIMINADO", "QT_RANQUEADO", "QT_LOTE",
     "QT_TAMANHO_LOTE", "DS_TAMANHO_LOTE", "DS_TAMANHO_MODALIDADE", "VL_ART_CORTE", "QT_DIVERGENCIA", "QT_SEM_ART",
     "QT_ACIMA_CORTE", "NU_ULTIMO_LOTE", "DS_AVISO")
  select p_edital, p_vaga, p_execucao, p_versao_regra, v_quadro."CO_QUADRO_VAGA", v_quadro."NO_CARGO", v_quadro."NO_LOTACAO",
         v_quadro."QT_VAGA_IMEDIATA", coalesce(v_quadro."ST_CADASTRO_RESERVA", 'N'), v_qt,
         count(*) filter (where t.situacao = 'ELIMINADO'),
         count(*) filter (where t.situacao <> 'ELIMINADO'),
         count(*) filter (where t.situacao in ('NO_LOTE', 'ANALISADO')),
         case when jsonb_typeof(p_resumo -> 'tamanho') = 'number'
              then greatest(0, least(100000, (p_resumo ->> 'tamanho')::numeric))::integer end,
         nullif(left(btrim(coalesce(p_resumo ->> 'descricao', '')), 200), ''),
         case when jsonb_typeof(p_resumo -> 'por_modalidade') = 'object' then p_resumo -> 'por_modalidade' end,
         -- A linha de corte só com os da regra (quem entrou por decisão fica fora).
         min(t.nota) filter (where t.situacao in ('NO_LOTE', 'ANALISADO') and t.entrada is distinct from 'DECISAO'),
         count(*) filter (where t.divergente),
         count(*) filter (where t.situacao <> 'ELIMINADO' and t.art is null),
         case when jsonb_typeof(p_resumo -> 'acima_do_corte') = 'number'
              then greatest(0, least(100000, (p_resumo ->> 'acima_do_corte')::numeric))::integer else 0 end,
         coalesce(max(t.lote), 0),
         v_avisos
    from private."FC_LINHAS_PRE_CLASSIF"(p_linhas) t
  on conflict ("CO_MONITORAMENTO", "CO_VAGA") do update set
    "CO_EXECUCAO" = excluded."CO_EXECUCAO",
    "NU_VERSAO_REGRA" = excluded."NU_VERSAO_REGRA",
    "CO_QUADRO_VAGA" = excluded."CO_QUADRO_VAGA",
    "NO_CARGO" = excluded."NO_CARGO",
    "NO_LOTACAO" = excluded."NO_LOTACAO",
    "QT_VAGA_IMEDIATA" = excluded."QT_VAGA_IMEDIATA",
    "ST_CADASTRO_RESERVA" = excluded."ST_CADASTRO_RESERVA",
    "QT_INSCRITO" = excluded."QT_INSCRITO",
    "QT_ELIMINADO" = excluded."QT_ELIMINADO",
    "QT_RANQUEADO" = excluded."QT_RANQUEADO",
    "QT_LOTE" = excluded."QT_LOTE",
    "QT_TAMANHO_LOTE" = excluded."QT_TAMANHO_LOTE",
    "DS_TAMANHO_LOTE" = excluded."DS_TAMANHO_LOTE",
    "DS_TAMANHO_MODALIDADE" = excluded."DS_TAMANHO_MODALIDADE",
    "VL_ART_CORTE" = excluded."VL_ART_CORTE",
    "QT_DIVERGENCIA" = excluded."QT_DIVERGENCIA",
    "QT_SEM_ART" = excluded."QT_SEM_ART",
    "QT_ACIMA_CORTE" = excluded."QT_ACIMA_CORTE",
    "NU_ULTIMO_LOTE" = greatest(pv."NU_ULTIMO_LOTE", excluded."NU_ULTIMO_LOTE"),
    "DS_AVISO" = excluded."DS_AVISO",
    "DT_ATUALIZACAO" = now();

  return jsonb_build_object('vaga', p_vaga, 'inscritos', v_qt, 'mudancas', v_mudancas);
end;
$function$;
comment on function public.gravar_pre_classificacao_vaga(text, uuid, text, integer, jsonb, jsonb) is
  'Grava a pré-classificação PRONTA de uma vaga (calculada pelo job Python): confere a regra vigente e conferida (40001), que os inscritos são da vaga, que nenhum já gravado falta, a forma (eliminado com motivo, posições de 1 a N, lote com número, lista e entrada), que quem tem ficha não muda, que quem está no lote só sai eliminado (salvo execução que refaz o lote ou, desde 20261007200000, quem entrou por decisão já revogada), que a nota declarada congelada não muda e, desde 20261007200000, que toda decisão vigente da coordenação (TB_DECISAO_LOTE) foi aplicada e só entra por decisão (entrada DECISAO, com o motivo da decisão) quem a tem; grava o histórico das mudanças com o motivo e o resumo da vaga (contagens feitas no banco, a linha de corte só com os da regra; quadro lido no banco). 22023 com o motivo da recusa. Só service_role.';

CREATE OR REPLACE FUNCTION private."FC_TG_LOTE_COM_FICHA"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if old."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO') and new."TP_SITUACAO" = 'RANQUEADO'
     and not (old."TP_ENTRADA_LOTE" = 'DECISAO'
              and not exists (select 1 from public."TB_DECISAO_LOTE" d
                               where d."CO_MONITORAMENTO" = new."CO_MONITORAMENTO"
                                 and d."CO_EMPREGARE_CANDIDATO" = new."CO_EMPREGARE_CANDIDATO"
                                 and d."ST_ATIVO" = 'S'))
     and exists (select 1 from public."TB_FICHA_ANALISE" f
                  where f."CO_MONITORAMENTO" = new."CO_MONITORAMENTO"
                    and f."CO_EMPREGARE_CANDIDATO" = new."CO_EMPREGARE_CANDIDATO"
                    and f."TP_SITUACAO" <> 'FORA_LOTE') then
    raise exception 'Resultado da vaga % recusado: quem tem ficha aberta não sai do lote por recálculo (refazer o lote só antes das fichas)', new."CO_VAGA"
      using errcode = '22023';
  end if;
  return new;
end;
$function$;
comment on function private."FC_TG_LOTE_COM_FICHA"() is 'Gatilho de TB_PRE_CLASSIFICACAO: recusa tirar do lote (NO_LOTE → RANQUEADO, o "refazer o lote") quem já tem ficha aberta; sair eliminado continua valendo e, desde 20261007200000, quem entrou por decisão da coordenação já revogada também sai.';

CREATE OR REPLACE FUNCTION private."FC_ABRIR_FICHAS"(p_edital uuid, p_atribuicoes jsonb, p_usuario uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_regra public."TB_REGRA_ANALISE";
  v_atrib jsonb := coalesce(p_atribuicoes, '[]'::jsonb);
  v_item record;
  v_criados uuid[] := '{}';
  v_saem integer := 0;
  v_voltam integer := 0;
  v_atribuidas integer := 0;
  v_regra_nova integer := 0;
  v_ficha public."TB_FICHA_ANALISE";
begin
  -- Uma abertura por edital de cada vez (job e tela não se atropelam).
  perform pg_advisory_xact_lock(hashtextextended('avaliacao-documental:fichas:' || p_edital::text, 0));
  select * into v_regra from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = p_edital;
  if v_regra."CO_REGRA_ANALISE" is null then
    raise exception 'O edital ainda não tem regra da avaliação' using errcode = '22023';
  end if;
  if jsonb_typeof(v_atrib) <> 'array' or jsonb_array_length(v_atrib) > 20000 then
    raise exception 'Atribuições inválidas (lista de até 20.000)' using errcode = '22023';
  end if;

  -- Seguem o último recálculo: a ficha ainda não concluída fica com a versão da regra da
  -- pré-classificação atual; a concluída mantém a versão com que foi analisada.
  update public."TB_FICHA_ANALISE" f
     set "NU_VERSAO_REGRA" = p."NU_VERSAO_REGRA", "DT_ATUALIZACAO" = now()
    from public."TB_PRE_CLASSIFICACAO" p
   where p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
     and f."CO_MONITORAMENTO" = p_edital
     and f."TP_SITUACAO" <> 'CONCLUIDA'
     and f."NU_VERSAO_REGRA" is distinct from p."NU_VERSAO_REGRA";
  get diagnostics v_regra_nova = row_count;

  -- Saem do lote: eliminados (ou fora do recorte) com ficha aberta. A ficha fica, com o motivo.
  for v_item in
    select f."CO_FICHA_ANALISE" as ficha, f."TP_SITUACAO" as situacao, f."CO_USUARIO_RESPONSAVEL" as responsavel,
           left(coalesce(p."DS_MOTIVO_ELIMINACAO", 'Saiu do lote de convocação'), 300) as motivo
      from public."TB_FICHA_ANALISE" f
      join public."TB_PRE_CLASSIFICACAO" p
        on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
     where f."CO_MONITORAMENTO" = p_edital
       and f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE', 'REVISAR')
       and p."TP_SITUACAO" in ('ELIMINADO', 'RANQUEADO')
     order by f."CO_FICHA_ANALISE"
     for update of f
  loop
    update public."TB_FICHA_ANALISE" set
      "TP_SITUACAO" = 'FORA_LOTE', "DS_MOTIVO_SAIDA" = v_item.motivo,
      "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_item.ficha;
    perform private."FC_HISTORICO_FICHA"(v_item.ficha, 'SAIR_LOTE', v_item.situacao, v_item.responsavel, v_item.motivo, p_usuario);
    v_saem := v_saem + 1;
  end loop;

  -- Voltam ao lote: quem saiu e está no lote de novo recomeça livre na fila.
  for v_item in
    select f."CO_FICHA_ANALISE" as ficha, f."CO_USUARIO_RESPONSAVEL" as responsavel,
           coalesce(p."DS_MOTIVO_ENTRADA", 'Voltou ao lote de convocação') as motivo
      from public."TB_FICHA_ANALISE" f
      join public."TB_PRE_CLASSIFICACAO" p
        on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
     where f."CO_MONITORAMENTO" = p_edital and f."TP_SITUACAO" = 'FORA_LOTE'
       and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
     order by f."CO_FICHA_ANALISE"
     for update of f
  loop
    update public."TB_FICHA_ANALISE" set
      "TP_SITUACAO" = 'PENDENTE', "DS_MOTIVO_SAIDA" = null, "CO_USUARIO_RESPONSAVEL" = null, "DT_ATRIBUICAO" = null,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_item.ficha;
    perform private."FC_HISTORICO_FICHA"(v_item.ficha, 'VOLTAR_LOTE', 'FORA_LOTE', v_item.responsavel, v_item.motivo, p_usuario);
    v_voltam := v_voltam + 1;
  end loop;

  -- Entram: quem está no lote e ainda não tem ficha (uma por inscrito; "a linha anda" cria ficha nova).
  for v_item in
    select p."CO_EMPREGARE_CANDIDATO" as candidato, p."CO_VAGA" as vaga, p."NU_VERSAO_REGRA" as versao, p."NU_LOTE" as lote,
           coalesce(p."DS_MOTIVO_ENTRADA", 'Entrou no lote ' || p."NU_LOTE") as motivo
      from public."TB_PRE_CLASSIFICACAO" p
     where p."CO_MONITORAMENTO" = p_edital and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
       and not exists (select 1 from public."TB_FICHA_ANALISE" f
                        where f."CO_MONITORAMENTO" = p_edital and f."CO_EMPREGARE_CANDIDATO" = p."CO_EMPREGARE_CANDIDATO")
     order by p."NU_POSICAO", p."CO_VAGA", p."CO_EMPREGARE_CANDIDATO"
  loop
    insert into public."TB_FICHA_ANALISE"
      ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "CO_REGRA_ANALISE", "NU_VERSAO_REGRA", "NU_LOTE")
    values (p_edital, v_item.candidato, v_item.vaga, v_regra."CO_REGRA_ANALISE", v_item.versao, v_item.lote)
    returning * into v_ficha;
    perform private."FC_HISTORICO_FICHA"(v_ficha."CO_FICHA_ANALISE", 'CRIAR', null, null, v_item.motivo, p_usuario);
    v_criados := v_criados || v_item.candidato;
  end loop;

  -- As fichas novas que já vão para alguém (quem entra depois, para quem tem menos pendentes).
  begin
    for v_item in
      select (a ->> 'candidato')::uuid as candidato, (a ->> 'usuario')::uuid as usuario
        from jsonb_array_elements(v_atrib) a
    loop
      select * into v_ficha from public."TB_FICHA_ANALISE"
       where "CO_MONITORAMENTO" = p_edital and "CO_EMPREGARE_CANDIDATO" = v_item.candidato
       for update;
      if v_item.candidato is null or not (v_item.candidato = any (v_criados)) or v_ficha."CO_USUARIO_RESPONSAVEL" is not null then
        raise exception 'Atribuição recusada: só a ficha aberta agora, uma vez' using errcode = '22023';
      end if;
      if v_item.usuario is null or not private."FC_PODE_ANALISAR_VAGA"(p_edital, v_item.usuario, v_ficha."CO_VAGA") then
        raise exception 'Atribuição recusada: a pessoa não analisa a vaga %', v_ficha."CO_VAGA" using errcode = '22023';
      end if;
      update public."TB_FICHA_ANALISE" set
        "CO_USUARIO_RESPONSAVEL" = v_item.usuario, "DT_ATRIBUICAO" = now(),
        "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
       where "CO_FICHA_ANALISE" = v_ficha."CO_FICHA_ANALISE";
      perform private."FC_HISTORICO_FICHA"(v_ficha."CO_FICHA_ANALISE", 'DISTRIBUIR', 'PENDENTE', null,
                                           'Entrou depois: para quem tem menos pendentes', p_usuario);
      v_atribuidas := v_atribuidas + 1;
    end loop;
  exception when invalid_text_representation then
    raise exception 'Atribuição com id inválido' using errcode = '22023';
  end;

  return jsonb_build_object('criadas', cardinality(v_criados), 'atribuidas', v_atribuidas,
                            'fora_do_lote', v_saem, 'voltaram', v_voltam, 'regra_atualizada', v_regra_nova);
end;
$function$;
comment on function private."FC_ABRIR_FICHAS"(uuid, jsonb, uuid) is
  'Sincroniza as fichas do edital com a pré-classificação gravada: quem saiu do lote (eliminado) fica FORA_LOTE com o motivo e sem reserva; quem voltou ao lote volta PENDENTE e livre; quem está no lote sem ficha ganha uma (PENDENTE); a ficha não concluída segue a versão da regra do último recálculo (a concluída mantém a sua; regra_atualizada conta as que mudaram). p_atribuicoes [{candidato, usuario}] dá responsável só às fichas criadas agora, para analistas da vaga. p_usuario nulo = o job. Histórico de tudo. Devolve as contagens.';

drop function if exists private."FC_FICHAS_INICIADAS"(uuid);
drop function if exists private."FC_FICHA_INICIADA"(public."TB_FICHA_ANALISE");
drop function if exists private."FC_LOTE_REFEITO_EM"(text);

alter table public."TH_FICHA_ANALISE"
  drop constraint "CK_THFICHA_TPACAO",
  drop constraint "CK_THFICHA_MOTIVO",
  add constraint "CK_THFICHA_TPACAO" check ("TP_ACAO" in ('CRIAR', 'PEGAR', 'RESERVAR', 'LIBERAR', 'LIBERAR_RESERVA', 'DISTRIBUIR',
    'REDISTRIBUIR', 'DEVOLVER_FILA', 'REVISAR', 'SAIR_LOTE', 'VOLTAR_LOTE', 'SALVAR', 'CONCLUIR', 'REABRIR', 'REINICIAR')),
  add constraint "CK_THFICHA_MOTIVO" check (
    "TP_ACAO" not in ('REDISTRIBUIR', 'DEVOLVER_FILA', 'LIBERAR_RESERVA', 'REVISAR', 'REABRIR', 'REINICIAR')
    or length(btrim(coalesce("DS_MOTIVO", ''))) between 10 and 2000);
comment on column public."TH_FICHA_ANALISE"."TP_ACAO" is 'CRIAR, PEGAR (Pegar próximo), RESERVAR (abriu), LIBERAR (fechou), LIBERAR_RESERVA (a coordenação liberou a reserva de outra pessoa), DISTRIBUIR, REDISTRIBUIR, DEVOLVER_FILA, REVISAR, SAIR_LOTE, VOLTAR_LOTE, SALVAR (rascunho com alteração), CONCLUIR, REABRIR ou REINICIAR (o administrador global voltou as fichas do edital ao início).';
comment on column public."TH_FICHA_ANALISE"."DS_MOTIVO" is 'Motivo (obrigatório, 10 a 2.000, em redistribuir, devolver à fila, liberar a reserva de outra pessoa, mandar para revisão, reabrir e reiniciar; nas saídas e entradas do lote, o motivo da pré-classificação).';
comment on constraint "CK_THFICHA_TPACAO" on public."TH_FICHA_ANALISE" is 'Ações válidas.';
comment on constraint "CK_THFICHA_MOTIVO" on public."TH_FICHA_ANALISE" is 'Motivo de 10 a 2.000 caracteres nas ações que mexem no trabalho de outra pessoa, na reabertura e no reinício.';

commit;
