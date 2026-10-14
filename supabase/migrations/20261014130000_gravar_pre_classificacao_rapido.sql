/*
  PRÉ-CLASSIFICAÇÃO: GRAVAR A VAGA E ABRIR AS FICHAS SEM ESTOURAR O TEMPO

  Por quê: em 14/10 o refazer do lote do 114/2026 (run 38560938212, 7.160
  inscritos em 30 vagas) terminou PARCIAL: "gravar_pre_classificacao_vaga
  respondeu 500: 57014: canceling statement due to statement timeout" (8 s do
  service_role) na vaga 182514; 27 vagas gravadas, 3 não, e as fichas não
  foram abertas (abrir_fichas só roda no fim, com todas as vagas gravadas).
  Medido em ensaio (tempo de cada trecho, vaga 182514, 864 inscritos; o banco
  oscila de 2 a 3x entre execuções):
    - a linha do quadro (private."FC_QUADRO_DA_VAGA_EMPREGARE", o título da
      Empregare com a UF dos inscritos das vagas irmãs): 0,1 a 1,8 s por
      vaga — a mesma linha que o job já leu nesta execução
      (pre_classificacao_ler_candidatos, 20261014110000);
    - as conferências da forma: cada uma relia o p_linhas inteiro
      (private."FC_LINHAS_PRE_CLASSIF", 25 leituras do JSON por chamada);
    - a trava do refazer (private."FC_FICHAS_INICIADAS"): uma chamada de
      FC_FICHA_INICIADA, com 2 subconsultas no histórico, por ficha do edital,
      em toda vaga gravada (90 a 250 ms);
    - FC_ABRIR_FICHAS: um UPDATE/INSERT, um FC_LOTE_REFEITO_EM e um
      FC_HISTORICO_FICHA por ficha (~4 ms por ficha, além da publicação).

  O QUE MUDA (o resultado gravado é o mesmo)
    gravar_pre_classificacao_vaga   lê o p_linhas uma vez (tabela temporária
                                    da transação) e todas as conferências e
                                    gravações usam essa leitura; a linha do
                                    quadro vem do job (p_resumo.quadro: o id
                                    lido em ler_candidatos, ou nulo = vaga sem
                                    quadro), conferida aqui (do edital e
                                    ativa); sem a chave, o banco acha a linha
                                    como antes.
    private."FC_FICHAS_INICIADAS"   uma consulta de conjunto no edital (o
                                    histórico agregado uma vez), com a mesma
                                    definição de FC_FICHA_INICIADA.
    private."FC_ABRIR_FICHAS"       sai/volta/entra em comandos de conjunto
                                    (UPDATE/INSERT … RETURNING e o histórico no
                                    mesmo comando); mesmas regras, motivos,
                                    ações e contagens. A publicação em
                                    TB_ANALISE_CURRICULAR segue pelo gatilho.
  Atomicidade do refazer (não muda): o job grava vaga a vaga e só chama
  abrir_fichas_pre_classificacao com TODAS as vagas gravadas; se uma falhar, o
  edital fica FALHOU, as fichas não mudam e a próxima execução refaz o lote do
  zero (o cálculo do refazer não depende do lote anterior).

  Ensaio: supabase/ensaios/20261014130000_gravar_pre_classificacao_rapido.sql
  Rollback: supabase/rollback/20261014130000_gravar_pre_classificacao_rapido.sql
*/
begin;

set local lock_timeout = '10s';

-- 1. Fichas iniciadas do edital numa consulta de conjunto --------------------------------
create or replace function private."FC_FICHAS_INICIADAS"(p_edital uuid)
returns integer
language sql
stable
security definer
set search_path to ''
as $function$
  -- A mesma definição de private."FC_FICHA_INICIADA", sem chamá-la por ficha: o histórico de
  -- cada ficha agregado uma vez (a última ação além das do lote depois do último REINICIAR).
  with h as (
    select h."CO_FICHA_ANALISE" as ficha,
           max(h."NU_VERSAO") filter (where h."TP_ACAO" not in ('CRIAR', 'SAIR_LOTE', 'VOLTAR_LOTE', 'REFAZER_LOTE', 'REINICIAR')) as ultima_acao,
           coalesce(max(h."NU_VERSAO") filter (where h."TP_ACAO" = 'REINICIAR'), 0) as reinicio
      from public."TH_FICHA_ANALISE" h
      join public."TB_FICHA_ANALISE" f on f."CO_FICHA_ANALISE" = h."CO_FICHA_ANALISE"
     where f."CO_MONITORAMENTO" = p_edital
     group by h."CO_FICHA_ANALISE"
  )
  select count(*)::integer
    from public."TB_FICHA_ANALISE" f
    left join h on h.ficha = f."CO_FICHA_ANALISE"
   where f."CO_MONITORAMENTO" = p_edital
     and (f."TP_SITUACAO" not in ('PENDENTE', 'FORA_LOTE')
          or f."CO_USUARIO_RESPONSAVEL" is not null or f."DT_ATRIBUICAO" is not null
          or f."CO_USUARIO_RESERVA" is not null
          or f."DS_LANCAMENTO" is not null or f."DS_RESULTADO" is not null or f."DS_PARECER" is not null
          or f."TP_RESULTADO" is not null or f."VL_NOTA_APURADA" is not null or f."VL_NOTA_FINAL" is not null
          or f."CO_USUARIO_RASCUNHO" is not null or f."CO_USUARIO_CONCLUSAO" is not null
          or h.ultima_acao > h.reinicio);
$function$;
comment on function private."FC_FICHAS_INICIADAS"(uuid) is
  'Quantas fichas do edital já foram tocadas (a definição de FC_FICHA_INICIADA, numa consulta de conjunto desde 20261014130000). 0 = o lote pode ser refeito do zero (20261013110000).';
revoke all on function private."FC_FICHAS_INICIADAS"(uuid) from public, anon, authenticated, service_role;

-- 2. Gravar a vaga: o p_linhas lido uma vez e o quadro que o job leu ------------------------
create or replace function public.gravar_pre_classificacao_vaga(p_execucao text, p_edital uuid, p_vaga text, p_versao_regra integer, p_resumo jsonb, p_linhas jsonb)
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
  v_iniciadas integer;
  v_quadro_id uuid;
begin
  -- A regra usada é a vigente e está conferida.
  if not exists (select 1 from public."TB_REGRA_ANALISE" r
                  where r."CO_MONITORAMENTO" = p_edital and r."NU_VERSAO_VIGENTE" = p_versao_regra
                    and r."TP_SITUACAO" = 'CONFERIDA') then
    raise exception 'A regra do edital mudou ou não está conferida; rode de novo' using errcode = '40001';
  end if;
  -- Refazer o lote do zero só com TODAS as fichas do edital intocadas: PENDENTE (ou FORA_LOTE),
  -- nunca atribuídas, reservadas, salvas nem concluídas, e no histórico só as ações do lote
  -- (FC_FICHA_INICIADA). A trava é a mesma da abertura das fichas (20261013110000).
  if v_refazer then
    perform pg_advisory_xact_lock(hashtextextended('avaliacao-documental:fichas:' || p_edital::text, 0));
    v_iniciadas := private."FC_FICHAS_INICIADAS"(p_edital);
    if v_iniciadas > 0 then
      raise exception 'Lote não refeito: o lote já está em análise: % fichas iniciadas', v_iniciadas
        using errcode = '55000';
    end if;
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
     or (p_resumo -> 'por_modalidade' is not null and jsonb_typeof(p_resumo -> 'por_modalidade') not in ('object', 'null'))
     or (p_resumo ? 'quadro' and jsonb_typeof(p_resumo -> 'quadro') not in ('string', 'null')) then
    raise exception 'Resumo da vaga inválido' using errcode = '22023';
  end if;

  -- As linhas lidas do JSON UMA vez (antes, cada conferência relia o p_linhas inteiro).
  drop table if exists pg_temp.t_linhas_vaga;
  begin
    create temporary table t_linhas_vaga on commit drop as
      select * from private."FC_LINHAS_PRE_CLASSIF"(p_linhas);
  exception when invalid_text_representation or numeric_value_out_of_range or datatype_mismatch then
    raise exception 'Linha com tipo inválido (id, nota, posição ou lote)' using errcode = '22023';
  end;
  analyze pg_temp.t_linhas_vaga;

  -- A forma do resultado (as mesmas regras das CK_, com mensagem clara).
  select case
    when exists (select 1 from pg_temp.t_linhas_vaga t where t.id is null) then 'linha sem id'
    when (select count(*) from pg_temp.t_linhas_vaga) <> (select count(distinct t.id) from pg_temp.t_linhas_vaga t) then 'inscrito repetido'
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where not exists (select 1 from public."TB_EMPREGARE_CANDIDATO" c
                                     where c."CO_EMPREGARE_CANDIDATO" = t.id and c."CO_VAGA" = p_vaga)) then 'inscrito que não é da vaga'
    when exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                  where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga
                    and not exists (select 1 from pg_temp.t_linhas_vaga t where t.id = a."CO_EMPREGARE_CANDIDATO")) then 'faltam inscritos já pré-classificados'
    when exists (select 1 from pg_temp.t_linhas_vaga t where t.situacao is null or t.situacao not in ('ELIMINADO', 'RANQUEADO', 'NO_LOTE', 'ANALISADO')) then 'situação inválida'
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where (t.situacao = 'ELIMINADO') <> (t.motivo_codigo is not null)
                     or (t.motivo_codigo is not null and (t.motivo_codigo !~ '^[A-Z][A-Z0-9_]{1,29}$'
                         or coalesce(length(btrim(t.motivo)), 0) not between 1 and 200))) then 'eliminado sem motivo (ou motivo fora de eliminado)'
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where (t.situacao = 'ELIMINADO' and (t.posicao is not null or t.posicao_modalidade is not null))
                     or (t.situacao <> 'ELIMINADO' and (coalesce(t.posicao, 0) < 1 or coalesce(t.posicao_modalidade, 0) < 1))) then 'posição inválida'
    when (select count(*) from pg_temp.t_linhas_vaga t where t.situacao <> 'ELIMINADO')
         <> coalesce((select max(t.posicao) from pg_temp.t_linhas_vaga t where t.situacao <> 'ELIMINADO'), 0)
      or (select count(distinct t.posicao) from pg_temp.t_linhas_vaga t where t.situacao <> 'ELIMINADO')
         <> (select count(*) from pg_temp.t_linhas_vaga t where t.situacao <> 'ELIMINADO') then 'posições não vão de 1 a N sem repetir'
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where case when t.situacao in ('NO_LOTE', 'ANALISADO')
                             then coalesce(t.lote, 0) not between 1 and 999
                                  or coalesce(t.lista_lote, '') !~ '^(GERAL|[A-Z]{2,10})$'
                                  or coalesce(t.entrada, '') not in ('INICIAL', 'REPOSICAO', 'AMPLIACAO', 'DECISAO')
                                  or length(coalesce(t.motivo_entrada, '')) > 300
                             else t.lote is not null or t.lista_lote is not null or t.entrada is not null end) then 'lote inválido'
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where coalesce(t.origem_nota, 'ART') not in ('ART', 'DECLARADA')
                     or t.modalidade !~ '^[A-Z]{2,10}$'
                     or abs(coalesce(t.art, 0)) > 1000 or abs(coalesce(t.nota, 0)) > 1000 or abs(coalesce(t.declarada, 0)) > 1000
                     or t.sem_mapa not between 0 and 100) then 'nota, origem ou modalidade inválida'
    -- A declarada congelada: completa, com o total igual à declarada da linha.
    when exists (select 1 from pg_temp.t_linhas_vaga t
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
    when exists (select 1 from pg_temp.t_linhas_vaga t
                   join public."TB_DECISAO_LOTE" d
                     on d."CO_MONITORAMENTO" = p_edital and d."CO_EMPREGARE_CANDIDATO" = t.id and d."ST_ATIVO" = 'S'
                  where t.situacao = 'RANQUEADO'
                     or (t.situacao = 'ELIMINADO' and t.motivo_codigo is distinct from 'SAIU_DA_EMPREGARE')) then 'decisão da coordenação não aplicada'
    when exists (select 1 from pg_temp.t_linhas_vaga t
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
  if exists (select 1 from pg_temp.t_linhas_vaga t
               join public."TB_PRE_CLASSIFICACAO" a
                 on a."CO_MONITORAMENTO" = p_edital and a."CO_EMPREGARE_CANDIDATO" = t.id
              where a."VL_DECLARADA_CONGELADA" is not null and t.declarada is not null
                and t.declarada is distinct from a."VL_DECLARADA_CONGELADA") then
    raise exception 'Resultado da vaga % recusado: a nota declarada congelada não muda (descongele antes)', p_vaga using errcode = '22023';
  end if;

  -- Quem tem ficha (ANALISADO) não muda; ANALISADO só vem do banco (fase F3).
  if exists (select 1 from pg_temp.t_linhas_vaga t
               cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote) h
              where (h.ant_situacao is not distinct from 'ANALISADO') <> (t.situacao = 'ANALISADO')
                 or (h.ant_situacao = 'ANALISADO' and h.ant_lote is distinct from t.lote)) then
    raise exception 'Resultado da vaga % recusado: quem já tem ficha não muda', p_vaga using errcode = '22023';
  end if;
  -- Quem está no lote só sai eliminado (a não ser que a execução refaça o lote); quem entrou
  -- por decisão da coordenação já revogada sai.
  if not v_refazer and exists (
      select 1 from pg_temp.t_linhas_vaga t
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
    from pg_temp.t_linhas_vaga t
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
    from pg_temp.t_linhas_vaga t
   cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote,
                              v_ant -> t.id::text ->> 'e' as ant_entrada) h
   where h.ant_situacao is null
      or h.ant_situacao is distinct from t.situacao
      or h.ant_lote is distinct from t.lote
      or h.ant_entrada is distinct from t.entrada;
  get diagnostics v_mudancas = row_count;

  -- O resumo da vaga: contagens feitas aqui. A linha do quadro é a que o job leu nesta execução
  -- (pre_classificacao_ler_candidatos, p_resumo.quadro; nula = vaga sem quadro), conferida aqui
  -- (do edital e ativa); sem a chave, o banco acha a linha (FC_QUADRO_DA_VAGA_EMPREGARE, até 1,8 s).
  if p_resumo ? 'quadro' then
    if jsonb_typeof(p_resumo -> 'quadro') = 'string' then
      begin
        v_quadro_id := (p_resumo ->> 'quadro')::uuid;
      exception when invalid_text_representation then
        raise exception 'Resumo da vaga inválido (quadro)' using errcode = '22023';
      end;
      select * into v_quadro from public."TB_QUADRO_VAGA_EDITAL" q
       where q."CO_QUADRO_VAGA" = v_quadro_id and q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S';
      if not found then
        raise exception 'Resumo da vaga % recusado: a linha do quadro não é do edital (ou não está ativa)', p_vaga
          using errcode = '22023';
      end if;
    end if;
  else
    v_quadro := private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital, p_vaga);
  end if;
  select count(*) into v_qt from pg_temp.t_linhas_vaga;
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
    from pg_temp.t_linhas_vaga t
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
  'Grava a pré-classificação PRONTA de uma vaga (calculada pelo job Python): confere a regra vigente e conferida (40001), que os inscritos são da vaga, que nenhum já gravado falta, a forma (eliminado com motivo, posições de 1 a N, lote com número, lista e entrada), que quem tem ficha não muda, que quem está no lote só sai eliminado (salvo execução que refaz o lote — desde 20261013110000 só com todas as fichas do edital intocadas, senão 55000 "o lote já está em análise: N fichas iniciadas" — ou, desde 20261007200000, quem entrou por decisão já revogada), que a nota declarada congelada não muda e, desde 20261007200000, que toda decisão vigente da coordenação (TB_DECISAO_LOTE) foi aplicada e só entra por decisão (entrada DECISAO, com o motivo da decisão) quem a tem; grava o histórico das mudanças com o motivo e o resumo da vaga (contagens feitas no banco, a linha de corte só com os da regra). Desde 20261014130000 o p_linhas é lido uma vez e a linha do quadro vem do job (p_resumo.quadro: id lido em pre_classificacao_ler_candidatos, conferido do edital e ativo; nulo = sem quadro; sem a chave, lida no banco). 22023 com o motivo da recusa. Só service_role.';

-- 3. As fichas do lote em comandos de conjunto (antes, um UPDATE/INSERT e um histórico por ficha) --
create or replace function private."FC_ABRIR_FICHAS"(p_edital uuid, p_atribuicoes jsonb, p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
  v_origem constant text := case when p_usuario is null then 'JOB' else 'TELA' end;
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
  -- Fora do lote refeito (a execução da linha refez o lote): "Lote refeito em dd/mm", ação REFAZER_LOTE.
  -- O histórico (o mesmo de FC_HISTORICO_FICHA) sai no mesmo comando, com a ficha já atualizada.
  with alvo as (
    select f."CO_FICHA_ANALISE" as ficha, f."TP_SITUACAO" as situacao, f."CO_USUARIO_RESPONSAVEL" as responsavel,
           left(case when p."TP_SITUACAO" = 'RANQUEADO' and t."CO_EXECUCAO" is not null
                     then 'Lote refeito em ' || to_char(t."DT_INICIO" at time zone 'America/Sao_Paulo', 'DD/MM')
                     else coalesce(p."DS_MOTIVO_ELIMINACAO", 'Saiu do lote de convocação') end, 300) as motivo,
           case when p."TP_SITUACAO" = 'RANQUEADO' and t."CO_EXECUCAO" is not null
                then 'REFAZER_LOTE' else 'SAIR_LOTE' end as acao
      from public."TB_FICHA_ANALISE" f
      join public."TB_PRE_CLASSIFICACAO" p
        on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
      left join public."TL_PRE_CLASSIFICACAO" t on t."CO_EXECUCAO" = p."CO_EXECUCAO" and t."ST_REFAZER_LOTE" = 'S'
     where f."CO_MONITORAMENTO" = p_edital
       and f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE', 'REVISAR')
       and p."TP_SITUACAO" in ('ELIMINADO', 'RANQUEADO')
  ),
  saiu as (
    update public."TB_FICHA_ANALISE" f set
      "TP_SITUACAO" = 'FORA_LOTE', "DS_MOTIVO_SAIDA" = a.motivo,
      "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "NU_VERSAO" = f."NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
      from alvo a
     where f."CO_FICHA_ANALISE" = a.ficha
    returning f."CO_FICHA_ANALISE" as ficha, f."NU_VERSAO" as versao, f."TP_SITUACAO" as situacao,
              f."CO_USUARIO_RESPONSAVEL" as responsavel, a.acao, a.situacao as situacao_anterior,
              a.responsavel as responsavel_anterior, a.motivo
  )
  insert into public."TH_FICHA_ANALISE"
    ("CO_FICHA_ANALISE", "NU_VERSAO", "TP_ACAO", "TP_SITUACAO_ANTERIOR", "TP_SITUACAO", "CO_USUARIO_RESP_ANTERIOR",
     "CO_USUARIO_RESPONSAVEL", "DS_MOTIVO", "TP_ORIGEM", "CO_USUARIO")
  select s.ficha, s.versao, s.acao, s.situacao_anterior, s.situacao, s.responsavel_anterior, s.responsavel,
         nullif(left(btrim(coalesce(s.motivo, '')), 2000), ''), v_origem, p_usuario
    from saiu s;
  get diagnostics v_saem = row_count;

  -- Voltam ao lote: quem saiu e está no lote de novo recomeça livre na fila.
  with alvo as (
    select f."CO_FICHA_ANALISE" as ficha, f."CO_USUARIO_RESPONSAVEL" as responsavel,
           coalesce('Voltou ao lote refeito em ' || to_char(t."DT_INICIO" at time zone 'America/Sao_Paulo', 'DD/MM'),
                    p."DS_MOTIVO_ENTRADA", 'Voltou ao lote de convocação') as motivo
      from public."TB_FICHA_ANALISE" f
      join public."TB_PRE_CLASSIFICACAO" p
        on p."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and p."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
      left join public."TL_PRE_CLASSIFICACAO" t on t."CO_EXECUCAO" = p."CO_EXECUCAO" and t."ST_REFAZER_LOTE" = 'S'
     where f."CO_MONITORAMENTO" = p_edital and f."TP_SITUACAO" = 'FORA_LOTE'
       and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
  ),
  voltou as (
    update public."TB_FICHA_ANALISE" f set
      "TP_SITUACAO" = 'PENDENTE', "DS_MOTIVO_SAIDA" = null, "CO_USUARIO_RESPONSAVEL" = null, "DT_ATRIBUICAO" = null,
      "NU_VERSAO" = f."NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
      from alvo a
     where f."CO_FICHA_ANALISE" = a.ficha
    returning f."CO_FICHA_ANALISE" as ficha, f."NU_VERSAO" as versao, f."TP_SITUACAO" as situacao,
              f."CO_USUARIO_RESPONSAVEL" as responsavel, a.responsavel as responsavel_anterior, a.motivo
  )
  insert into public."TH_FICHA_ANALISE"
    ("CO_FICHA_ANALISE", "NU_VERSAO", "TP_ACAO", "TP_SITUACAO_ANTERIOR", "TP_SITUACAO", "CO_USUARIO_RESP_ANTERIOR",
     "CO_USUARIO_RESPONSAVEL", "DS_MOTIVO", "TP_ORIGEM", "CO_USUARIO")
  select v.ficha, v.versao, 'VOLTAR_LOTE', 'FORA_LOTE', v.situacao, v.responsavel_anterior, v.responsavel,
         nullif(left(btrim(coalesce(v.motivo, '')), 2000), ''), v_origem, p_usuario
    from voltou v;
  get diagnostics v_voltam = row_count;

  -- Entram: quem está no lote e ainda não tem ficha (uma por inscrito; "a linha anda" cria ficha nova).
  with entra as (
    select p."CO_EMPREGARE_CANDIDATO" as candidato, p."CO_VAGA" as vaga, p."NU_VERSAO_REGRA" as versao,
           p."NU_LOTE" as lote, p."NU_POSICAO" as posicao,
           coalesce('Entrou no lote refeito em ' || to_char(t."DT_INICIO" at time zone 'America/Sao_Paulo', 'DD/MM'),
                    p."DS_MOTIVO_ENTRADA", 'Entrou no lote ' || p."NU_LOTE") as motivo
      from public."TB_PRE_CLASSIFICACAO" p
      left join public."TL_PRE_CLASSIFICACAO" t on t."CO_EXECUCAO" = p."CO_EXECUCAO" and t."ST_REFAZER_LOTE" = 'S'
     where p."CO_MONITORAMENTO" = p_edital and p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')
       and not exists (select 1 from public."TB_FICHA_ANALISE" f
                        where f."CO_MONITORAMENTO" = p_edital and f."CO_EMPREGARE_CANDIDATO" = p."CO_EMPREGARE_CANDIDATO")
  ),
  nova as (
    insert into public."TB_FICHA_ANALISE"
      ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "CO_REGRA_ANALISE", "NU_VERSAO_REGRA", "NU_LOTE")
    select p_edital, e.candidato, e.vaga, v_regra."CO_REGRA_ANALISE", e.versao, e.lote
      from entra e
     order by e.posicao, e.vaga, e.candidato
    returning *
  ),
  historico as (
    insert into public."TH_FICHA_ANALISE"
      ("CO_FICHA_ANALISE", "NU_VERSAO", "TP_ACAO", "TP_SITUACAO_ANTERIOR", "TP_SITUACAO", "CO_USUARIO_RESP_ANTERIOR",
       "CO_USUARIO_RESPONSAVEL", "DS_MOTIVO", "TP_ORIGEM", "CO_USUARIO")
    select n."CO_FICHA_ANALISE", n."NU_VERSAO", 'CRIAR', null, n."TP_SITUACAO", null, n."CO_USUARIO_RESPONSAVEL",
           nullif(left(btrim(coalesce(e.motivo, '')), 2000), ''), v_origem, p_usuario
      from nova n
      join entra e on e.candidato = n."CO_EMPREGARE_CANDIDATO"
    returning 1
  )
  select coalesce(array_agg(n."CO_EMPREGARE_CANDIDATO"), '{}') into v_criados from nova n;

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
  'Sincroniza as fichas do edital com a pré-classificação gravada: quem saiu do lote (eliminado) fica FORA_LOTE com o motivo e sem reserva — desde 20261013110000, quem ficou fora do lote refeito do zero fica FORA_LOTE com "Lote refeito em dd/mm" e histórico REFAZER_LOTE; quem voltou ao lote volta PENDENTE e livre; quem está no lote sem ficha ganha uma (PENDENTE); a ficha não concluída segue a versão da regra do último recálculo (a concluída mantém a sua; regra_atualizada conta as que mudaram). p_atribuicoes [{candidato, usuario}] dá responsável só às fichas criadas agora, para analistas da vaga. p_usuario nulo = o job. Histórico de tudo. Em comandos de conjunto desde 20261014130000 (sai, volta e entra, cada um com o histórico no mesmo comando). Devolve as contagens.';

commit;
