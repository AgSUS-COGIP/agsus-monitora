/*
  ROLLBACK de 20261024120000_contratado_em_outra_lista.sql.

  Volta o status, as contagens de contratados, a leitura da conferência, o pacote da Lista de
  aprovados, a lista fixa de FC_DISPARAR_ROBO e a chave dos workflows ao que estão no banco antes
  da migration (as definições abaixo são as de 24/10/2026, com 20261024090000 aplicada), e tira o
  instantâneo TB_CONTRATACAO_APROVADO, as RPCs do job e os gatilhos. Para se ainda houver linha
  com o status "Contratado em outra lista": troque cada uma pela tela antes. O histórico
  (TH_CANDIDATO_APROVADO) guarda o valor e fica como está.
*/
begin;

set local lock_timeout = '5s';

do $$
declare
  v_qt integer;
begin
  select count(*) into v_qt from public."TB_CANDIDATO_APROVADO" where status = 'Contratado em outra lista';
  if v_qt > 0 then
    raise exception '% linha(s) com o status Contratado em outra lista: troque-as pela tela antes do rollback.', v_qt;
  end if;
end;
$$;

drop trigger if exists "TG_HISTCANDAPROV_CONTRATACAO" on public."TH_CANDIDATO_APROVADO";
drop trigger if exists "TG_HISTPUBLICAPROV_CONTRATACAO" on public."TH_PUBLICACAO_APROVADO";
drop function if exists private."FC_TG_CONTRATACAO_BASE_MUDOU"();
drop function if exists private."FC_TG_CONTRATACAO_LISTA_NOVA"();
drop function if exists private."FC_PEDIR_CONTRATACAO_DOS_APROVADOS"();
drop function if exists public.gravar_contratacao_dos_aprovados(text, jsonb, uuid[]);
drop function if exists public.contratacao_ler_aprovados();

-- Os pedidos já registrados do workflow novo ficam (NOT VALID): o histórico não se apaga.
alter table public."TL_DISPARO_ROBO" drop constraint "CK_DISPROBO_NOWORKFLOW";
alter table public."TL_DISPARO_ROBO" add constraint "CK_DISPROBO_NOWORKFLOW" check ("NO_WORKFLOW" = any (array[
  'sincronizar-entrevistas.yml', 'sincronizar-selecao.yml', 'conferencias.yml', 'expurgo-anexos-chat.yml',
  'robo-empregare.yml', 'pre-classificacao.yml', 'leitura-de-arquivos.yml', 'classificacao.yml'])) not valid;
comment on constraint "CK_DISPROBO_NOWORKFLOW" on public."TL_DISPARO_ROBO" is null;

CREATE OR REPLACE FUNCTION private."FC_DISPARAR_ROBO"(p_workflow text, p_inputs jsonb DEFAULT '{}'::jsonb, p_usuario uuid DEFAULT NULL::uuid, p_origem text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  -- Lista fixa: workflow → inputs que ele aceita (além de disparado_por).
  c_aceitos constant jsonb := jsonb_build_object(
    'sincronizar-entrevistas.yml', jsonb_build_array('modo'),
    'sincronizar-selecao.yml', jsonb_build_array('modo'),
    'conferencias.yml', jsonb_build_array('modo'),
    'robo-empregare.yml', jsonb_build_array('modo', 'editais', 'vagas', 'limite', 'anexos', 'candidatos', 'seco', 'forcar_congelado'),
    'pre-classificacao.yml', jsonb_build_array('modo', 'editais', 'forcar_congelado'),
    'classificacao.yml', jsonb_build_array('modo', 'listas'));
  v_inputs jsonb := coalesce(p_inputs, '{}'::jsonb);
  -- AGENDA só do pg_cron: as tarefas passam p_origem = 'AGENDA' (e a sessão do pg_cron
  -- se chama pg_cron); MONITORA com o usuário da tela; MANUAL = SQL direto, sem usuário.
  v_origem constant text := case
    when p_usuario is not null then 'MONITORA'
    when p_origem = 'AGENDA' or current_setting('application_name', true) = 'pg_cron' then 'AGENDA'
    else 'MANUAL' end;
  v_disparado_por constant text := case v_origem
    when 'MONITORA' then p_usuario::text
    when 'AGENDA' then 'AGENDA'
    else 'manual' end;
  v_chave text;
  v_pedido bigint;
  v_disparo bigint;
begin
  if p_workflow is null or not (c_aceitos ? p_workflow) then
    raise exception 'Workflow fora da lista fixa dos robôs' using errcode = '22023';
  end if;
  if p_origem is not null and p_origem <> 'AGENDA' then
    raise exception 'Origem inválida (só AGENDA, nas tarefas do pg_cron)' using errcode = '22023';
  end if;
  if jsonb_typeof(v_inputs) <> 'object'
     or exists (
       select 1 from jsonb_each(v_inputs) i
        where not ((c_aceitos -> p_workflow) ? i.key)
           or jsonb_typeof(i.value) <> 'string'
           or length(i.value #>> '{}') > 20000) then
    raise exception 'Inputs inválidos para %', p_workflow using errcode = '22023';
  end if;

  -- [chaves-da-automacao] Chave desligada (20261022190000): a agenda não pede nada.
  -- O Rodar agora (MONITORA) e o SQL direto (MANUAL) seguem.
  if v_origem = 'AGENDA'
     and not private."FC_AUTOMACAO_LIGADA"(private."FC_CHAVE_DO_WORKFLOW"(p_workflow)) then
    return null;
  end if;

  -- O nome do segredo é sempre github_disparo_robos; a configuração da sessão
  -- agsus.segredo_disparo_robos só existe para o ensaio simular a chave ausente
  -- (set local) sem tocar no Vault nem ler o valor.
  select nullif(btrim(s.decrypted_secret), '')
    into v_chave
    from vault.decrypted_secrets s
   where s.name = coalesce(nullif(current_setting('agsus.segredo_disparo_robos', true), ''), 'github_disparo_robos')
   order by s.updated_at desc nulls last
   limit 1;

  if v_chave is null then
    insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "DS_MENSAGEM")
    values (p_workflow, v_origem, p_usuario, 'SEM_TOKEN', 'Sem a chave github_disparo_robos no Vault.')
    returning "CO_DISPARO" into v_disparo;
    return v_disparo;
  end if;

  begin
    v_pedido := net.http_post(
      url := 'https://api.github.com/repos/AgSUS-COGIP/agsus-monitora/actions/workflows/' || p_workflow || '/dispatches',
      body := jsonb_build_object(
        'ref', 'main',
        'inputs', v_inputs || jsonb_build_object('disparado_por', v_disparado_por)),
      headers := jsonb_build_object(
        'Accept', 'application/vnd.github+json',
        'Authorization', 'Bearer ' || v_chave,
        'X-GitHub-Api-Version', '2022-11-28',
        'User-Agent', 'agsus-monitora-agenda',
        'Content-Type', 'application/json'),
      timeout_milliseconds := 10000);
  exception when others then
    -- Só o código do erro: a mensagem poderia citar o pedido.
    v_chave := null;
    insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "TP_SITUACAO", "DT_RESPOSTA", "DS_MENSAGEM")
    values (p_workflow, v_origem, p_usuario, 'FALHOU', now(), 'O pg_net recusou o pedido (' || sqlstate || ').')
    returning "CO_DISPARO" into v_disparo;
    return v_disparo;
  end;
  v_chave := null;

  insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "TP_ORIGEM", "CO_USUARIO", "CO_PEDIDO_HTTP", "TP_SITUACAO")
  values (p_workflow, v_origem, p_usuario, v_pedido, 'PEDIDO')
  returning "CO_DISPARO" into v_disparo;
  return v_disparo;
end;
$function$;

CREATE OR REPLACE FUNCTION private."FC_CHAVE_DO_WORKFLOW"(p_workflow text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case p_workflow
    when 'sincronizar-entrevistas.yml' then 'entrevistas'
    when 'sincronizar-selecao.yml' then 'selecao'
    when 'conferencias.yml' then 'conferencias'
    when 'robo-empregare.yml' then 'robo_de_inscricoes'
    when 'pre-classificacao.yml' then 'pre_classificacao'
    when 'classificacao.yml' then 'classificacao'
  end;
$function$;

CREATE OR REPLACE FUNCTION private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(p_edital uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_qt integer;
begin
  if p_edital is null
     or not exists (select 1 from public."TB_LISTA_APROVADO" l where l.edital_id = p_edital::text and l.vigente is true) then
    return 0;
  end if;
  update public."TB_MONITORAMENTO_INDIGENA" m
     set contratados = n.qt, updated_at = now()
    from (select (count(c.id) filter (where c.status in ('Contratado', 'Migração')))::integer qt
            from public."TB_LISTA_APROVADO" l
            left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
           where l.edital_id = p_edital::text and l.vigente is true) n
   where m.id = p_edital and m.ativo and m.contratados is distinct from n.qt;
  get diagnostics v_qt = row_count;
  return v_qt;
end;
$function$;

CREATE OR REPLACE FUNCTION private."FC_ATUALIZAR_KPIS_PELA_SELECAO"()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_qt integer;
  v_carga_selecao timestamptz;
begin
  select max(t."DT_FIM") into v_carga_selecao
    from public."TL_SYNC_SELECAO" t where t."TP_SITUACAO" = 'CONCLUIDA';

  with ed as materialized (
    select m.id, m."CO_AREA",
           coalesce(private."FC_NUMERO_EDITAL"(m.edital),
                    nullif('nome:' || private."FC_TEXTO_BUSCA_RECURSO"(m.edital), 'nome:')) as chave,
           exists (select 1 from public."TB_ORIGEM_ANALISE_EDITAL" o
                    where o."CO_MONITORAMENTO" = m.id and o."TP_ORIGEM" = 'MONITORA') as no_monitora
      from public."TB_MONITORAMENTO_INDIGENA" m
     where m.ativo
  ),
  -- A chave da análise só vale quando aponta para um edital só na área.
  chave_unica as (
    select e."CO_AREA", e.chave, min(e.id::text)::uuid as id
      from ed e
     where e.chave is not null
     group by 1, 2
    having count(*) = 1
  ),
  -- Fonte 1: avaliação documental nativa (resumo da última execução de cada vaga).
  pre as (
    select pv."CO_MONITORAMENTO" id,
           sum(pv."QT_INSCRITO")::integer inscritos,
           sum(pv."QT_LOTE" + pv."QT_ACIMA_CORTE")::integer aptos,
           sum(pv."QT_ELIMINADO")::integer total_eliminados,
           max(pv."DT_ATUALIZACAO") em
      from public."TB_PRE_CLASSIF_VAGA" pv
     where pv."CO_MONITORAMENTO" in (select id from ed)
     group by 1
  ),
  pre_cancelados as (
    select p."CO_MONITORAMENTO" id, count(*)::integer qt
      from public."TB_PRE_CLASSIFICACAO" p
     where p."CO_MONITORAMENTO" in (select id from pre)
       and p."TP_SITUACAO" = 'ELIMINADO' and p."CO_MOTIVO_ELIMINACAO" = 'CANCELADO'
     group by 1
  ),
  -- Fonte 1 sem resumo: o último retrato das inscrições de cada vaga.
  retrato as (
    select r."CO_MONITORAMENTO" id,
           sum(r."QT_INSCRITO")::integer inscritos,
           case when count(*) = count(r."QT_APTO") then sum(r."QT_APTO")::integer end aptos,
           case when count(*) = count(r."QT_ELIMINADO") then sum(r."QT_ELIMINADO")::integer end total_eliminados,
           max(r."DT_ATUALIZACAO") em
      from (select distinct on (t."CO_MONITORAMENTO", t."CO_VAGA") t.*
              from public."TH_INSCRICAO_VAGA_EDITAL" t
             where t."CO_MONITORAMENTO" in (select id from ed)
               and t."CO_MONITORAMENTO" not in (select id from pre)
             order by t."CO_MONITORAMENTO", t."CO_VAGA", t."DT_RETRATO" desc) r
     group by 1
  ),
  -- Avaliação no MONITORA: o resultado das fichas, pelo id do edital.
  fichas as (
    select f."CO_MONITORAMENTO" id,
           (count(*) filter (where f."TP_SITUACAO" = 'CONCLUIDA' and f."TP_RESULTADO" = 'APTO'))::integer aprovados,
           (count(*) filter (where f."TP_SITUACAO" = 'CONCLUIDA' and f."TP_RESULTADO" is distinct from 'APTO'))::integer reprovados
      from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" in (select id from ed where no_monitora)
     group by 1
  ),
  -- Fonte 2: a Seleção, só quando coerente (aptos <= inscritos).
  sel as (
    select s."CO_MONITORAMENTO" id,
           sum(coalesce(s."QT_INSCRITO", 0))::integer inscritos,
           sum(coalesce(s."QT_APTO_ANALISE", 0))::integer aptos,
           sum(coalesce(s."QT_CANCELADO", 0))::integer cancelados,
           sum(coalesce(s."QT_ELIMINADO_NOTA", 0))::integer eliminados_nota,
           sum(coalesce(s."QT_REPROVADO_ANALISE", 0))::integer reprovados,
           sum(coalesce(s."QT_TOTAL_ELIMINADO", 0))::integer total_eliminados
      from public."TB_SELECAO_VAGA" s
     where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_MONITORAMENTO" in (select id from ed)
     group by 1
    having sum(coalesce(s."QT_APTO_ANALISE", 0)) <= sum(coalesce(s."QT_INSCRITO", 0))
  ),
  -- Fonte 3: as análises do edital (número ou nome único na área).
  aprov as (
    select u.id,
           (count(*) filter (where a.status_consolidado = 'Aprovado'))::integer qt,
           (count(*) filter (where a.status_consolidado = 'Reprovado'))::integer reprovados,
           count(*)::integer candidatos,
           max(a.updated_at) em
      from chave_unica u
      join public."TB_ANALISE_CURRICULAR" a
        on a."CO_AREA" = u."CO_AREA" and a.ativo
       and coalesce(private."FC_NUMERO_EDITAL"(a.edital),
                    nullif('nome:' || private."FC_TEXTO_BUSCA_RECURSO"(a.edital), 'nome:')) = u.chave
     group by 1
  ),
  -- Entrevistados: pessoas distintas (a entrevista vigente) que compareceram.
  entr as (
    select e."CO_MONITORAMENTO" id,
           (count(*) filter (where e."ST_COMPARECEU" = 'S'
                               or (e."ST_COMPARECEU" is null and e."TP_PARECER" in ('APTO', 'INAPTO'))))::integer qt
      from public."TB_ENTREVISTA" e
     where e."CO_ENTREVISTA" in (select v from private."FC_ENTREVISTAS_VIGENTES"(null) v)
       and e."CO_MONITORAMENTO" in (select id from ed)
     group by 1
  ),
  contr as (
    select l.edital_id::uuid id,
           (count(c.id) filter (where c.status in ('Contratado', 'Migração')))::integer qt
      from public."TB_LISTA_APROVADO" l
      left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
     where l.vigente is true and l.edital_id in (select id::text from ed)
     group by 1
  ),
  fonte as (
    select t.id, t.no_monitora,
           case when p.id is not null or r.id is not null then 'AVALIACAO_DOCUMENTAL'
                when s.id is not null then 'SELECAO'
                when a.id is not null then 'ANALISES' end as fonte
      from ed t
      left join pre p on p.id = t.id
      left join retrato r on r.id = t.id
      left join sel s on s.id = t.id
      left join aprov a on a.id = t.id
  ),
  novo as (
    select t.id, t.fonte,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then coalesce(p.inscritos, r.inscritos)
                        when 'SELECAO' then s.inscritos end inscritos,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then coalesce(p.aptos, r.aptos)
                        when 'SELECAO' then s.aptos
                        when 'ANALISES' then a.candidatos end aptos,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then case when p.id is not null then coalesce(pc.qt, 0) end
                        when 'SELECAO' then s.cancelados end cancelados,
           case t.fonte when 'SELECAO' then s.eliminados_nota end eliminados_nota,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then coalesce(p.total_eliminados, r.total_eliminados)
                        when 'SELECAO' then s.total_eliminados end total_eliminados,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then
                          case when t.no_monitora then coalesce(f.reprovados, 0) else a.reprovados end
                        when 'SELECAO' then s.reprovados
                        when 'ANALISES' then a.reprovados end reprovados,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then coalesce(p.em, r.em)
                        when 'SELECAO' then v_carga_selecao
                        when 'ANALISES' then a.em end em,
           case when t.no_monitora then coalesce(f.aprovados, 0) else a.qt end aprovados,
           (a.id is not null or t.no_monitora) tem_aprovados,
           e.qt entrevistados, c.qt contratados
      from fonte t
      left join pre p on p.id = t.id
      left join pre_cancelados pc on pc.id = t.id
      left join retrato r on r.id = t.id
      left join fichas f on f.id = t.id
      left join sel s on s.id = t.id
      left join aprov a on a.id = t.id
      left join entr e on e.id = t.id
      left join contr c on c.id = t.id
     where t.fonte is not null or t.no_monitora or e.id is not null or c.id is not null
  ),
  -- Com fonte, todo campo do funil vem dela (ou nulo); sem fonte, o funil não muda.
  final as (
    select n.id,
           case when n.fonte is null then m.inscritos else n.inscritos end inscritos,
           case when n.fonte is null then m.aptos_analise else n.aptos end aptos_analise,
           case when n.fonte is null then m.cancelados else n.cancelados end cancelados,
           case when n.fonte is null then m.eliminados_nota else n.eliminados_nota end eliminados_nota,
           case when n.fonte is null then m.total_eliminados else n.total_eliminados end total_eliminados,
           case when n.fonte is null then m.reprovados_analise else n.reprovados end reprovados_analise,
           case when n.fonte is null then m."TP_FONTE_FUNIL" else n.fonte end fonte,
           case when n.fonte is null then m."DT_FONTE_FUNIL" else n.em end em,
           case when n.tem_aprovados then n.aprovados else m.aprovados_analise end aprovados_analise,
           coalesce(n.entrevistados, m.entrevistados) entrevistados,
           coalesce(n.contratados, m.contratados) contratados
      from novo n
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = n.id
  )
  update public."TB_MONITORAMENTO_INDIGENA" m
     set inscritos = f.inscritos,
         aptos_analise = f.aptos_analise,
         cancelados = f.cancelados,
         eliminados_nota = f.eliminados_nota,
         total_eliminados = f.total_eliminados,
         reprovados_analise = f.reprovados_analise,
         "TP_FONTE_FUNIL" = f.fonte,
         "DT_FONTE_FUNIL" = f.em,
         aprovados_analise = f.aprovados_analise,
         entrevistados = f.entrevistados,
         contratados = f.contratados,
         updated_at = now()
    from final f
   where m.id = f.id
     and (m.inscritos, m.aptos_analise, m.cancelados, m.eliminados_nota, m.total_eliminados,
          m.reprovados_analise, m."TP_FONTE_FUNIL", m."DT_FONTE_FUNIL", m.aprovados_analise,
          m.entrevistados, m.contratados)
         is distinct from
         (f.inscritos, f.aptos_analise, f.cancelados, f.eliminados_nota, f.total_eliminados,
          f.reprovados_analise, f.fonte, f.em, f.aprovados_analise, f.entrevistados, f.contratados);
  get diagnostics v_qt = row_count;
  return v_qt;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_selecao_da_area(p_area text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_editais uuid[];
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('selecao', 1) then
    raise exception 'Sem permissão para Seleção' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return (
    with s as (
      select s.*, private."FC_NUMERO_EDITAL"(s."DS_EDITAL") as numero
        from public."TB_SELECAO_VAGA" s
       where s."CO_AREA" = p_area and s."ST_REGISTRO_ATIVO" = 'S'
         and (v_editais is null or s."CO_MONITORAMENTO" = any (v_editais))
    ),
    -- Convocados: a entrevista vigente de cada pessoa (FC_ENTREVISTAS_VIGENTES) por edital e vaga.
    convocados as (
      select private."FC_NUMERO_EDITAL"(e."DS_EDITAL") as numero, e."CO_VAGA" as vaga, count(*)::integer as qt
        from public."TB_ENTREVISTA" e
       where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
         and e."CO_ENTREVISTA" in (select v from private."FC_ENTREVISTAS_VIGENTES"(p_area) v)
       group by 1, 2
    ),
    editais_com_entrevista as (
      select distinct c.numero from convocados c where c.numero is not null
    ),
    -- Lista de aprovados vigente dos editais ligados.
    listas as (
      select l.id, l.edital_id
        from public."TB_LISTA_APROVADO" l
       where l.vigente is true
         and l.edital_id in (select s."CO_MONITORAMENTO"::text from s where s."CO_MONITORAMENTO" is not null)
    ),
    aprovados as (
      select l.edital_id, regexp_replace(coalesce(c.codigo_vaga, ''), '[^0-9]', '', 'g') as vaga,
             count(*)::integer as total,
             (count(*) filter (where c.status in ('Contratado', 'Migração')))::integer as contratados
        from listas l
        join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
       group by 1, 2
    ),
    -- Outras bancas (CESPE, FGV…): sem código numérico, o "id da vaga" da lista é
    -- o nome do cargo. Chave: o texto sem acento, caixa nem pontuação.
    aprovados_por_cargo as (
      select l.edital_id,
             btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(c.codigo_vaga), '[^a-z0-9]+', ' ', 'g')) as cargo,
             count(*)::integer as total,
             (count(*) filter (where c.status in ('Contratado', 'Migração')))::integer as contratados
        from listas l
        join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
       group by 1, 2
    ),
    linhas as (
      select s.*,
             m.edital as edital_cadastrado,
             (s.numero is not null and s.numero in (select x.numero from editais_com_entrevista x)) as usa_entrevistas,
             cv.qt as qt_convocado_entrevistas,
             exists (select 1 from listas l where l.edital_id = s."CO_MONITORAMENTO"::text) as tem_lista,
             coalesce(ap.total, apc.total) as qt_aprovado,
             coalesce(ap.contratados, apc.contratados) as qt_contratado
        from s
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = s."CO_MONITORAMENTO"
        left join convocados cv on cv.numero = s.numero and cv.vaga = s."CO_VAGA"
        -- A 2ª vaga de mesmo código (chave com #2…) não recebe de novo os mesmos aprovados (20261022200000).
        left join aprovados ap
          on ap.edital_id = s."CO_MONITORAMENTO"::text and ap.vaga = s."CO_VAGA"
         and s."DS_CHAVE_ORIGEM" !~ '#[0-9]+$'
        -- Vaga sem código (outra banca): pelo nome do cargo; a 2ª vaga de mesmo nome
        -- (chave com #2…) não recebe de novo os mesmos aprovados.
        left join aprovados_por_cargo apc
          on s."CO_VAGA" is null
         and s."DS_CHAVE_ORIGEM" !~ '#[0-9]+$'
         and apc.edital_id = s."CO_MONITORAMENTO"::text
         and apc.cargo = btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(s."DS_VAGA_PLANILHA"), '[^a-z0-9]+', ' ', 'g'))
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'gerado_em', now(),
      'ultima_carga', (
        select json_build_object('em', t."DT_FIM", 'linhas', t."QT_LINHA", 'sem_edital', t."QT_SEM_EDITAL")
          from public."TL_SYNC_SELECAO" t
         where t."TP_SITUACAO" = 'CONCLUIDA'
         order by t."DT_FIM" desc limit 1
      ),
      'vagas', (
        select coalesce(json_agg(json_build_object(
            'id', l."CO_SELECAO_VAGA",
            'edital_id', l."CO_MONITORAMENTO",
            'edital', coalesce(l.edital_cadastrado, l."DS_EDITAL"),
            'edital_planilha', l."DS_EDITAL",
            'unidade', l."NO_UNIDADE",
            'vaga', l."CO_VAGA",
            'vaga_planilha', l."DS_VAGA_PLANILHA",
            'cargo', l."NO_CARGO",
            'inscritos', l."QT_INSCRITO",
            'aptos', l."QT_APTO_ANALISE",
            'cancelados', l."QT_CANCELADO",
            'reprovados_questionario', l."QT_REPROVADO_QUESTIONARIO",
            'eliminados_nota', l."QT_ELIMINADO_NOTA",
            'reprovados_analise', l."QT_REPROVADO_ANALISE",
            'triados', l."QT_TRIADO",
            'total_eliminados', l."QT_TOTAL_ELIMINADO",
            'observacao', l."DS_OBSERVACAO",
            'convocados', case when l.usa_entrevistas then coalesce(l.qt_convocado_entrevistas, 0)
                               else l."QT_CONVOCADO_PLANILHA" end,
            'origem_convocados', case when l.usa_entrevistas then 'entrevistas' else 'planilha' end,
            'aprovados', case when l.tem_lista then coalesce(l.qt_aprovado, 0) end,
            'contratados', case when l.tem_lista then coalesce(l.qt_contratado, 0) end,
            'nao_contratados', case when l.tem_lista then coalesce(l.qt_aprovado, 0) - coalesce(l.qt_contratado, 0) end
          ) order by coalesce(l.edital_cadastrado, l."DS_EDITAL"), l."NO_UNIDADE", l."NO_CARGO", l."CO_VAGA"), '[]'::json)
          from linhas l
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.listar_acompanhamento_da_visao_geral(p_area text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '5s'
AS $function$
declare
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_editais uuid[];
begin
  if not private.pode_recurso('dashboard') then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para esta área' using errcode = '42501';
  end if;

  select coalesce(array_agg(m.id), '{}') into v_editais
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.ativo
     and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
     and m."CO_AREA" = v_area
     and ((select private."FC_EDITAIS_VISIVEIS"()) is null
          or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]));

  return jsonb_build_object(
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', c.monitoramento_id,
               'ordem', c.ordem,
               'atividade', c.atividade,
               'data_inicio', c.data_inicio,
               'data_fim', c.data_fim
             ) order by c.monitoramento_id, c.data_inicio, c.ordem)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c
       where c.monitoramento_id = any (v_editais)
    ), '[]'::jsonb),
    'listas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', r.edital_id,
               'aprovados', r.aprovados,
               'com_status', r.com_status,
               'contratados', r.contratados,
               'desistentes', r.desistentes
             ) order by r.edital_id)
        from (
          select l.edital_id,
                 count(c.id)::integer as aprovados,
                 (count(c.id) filter (where nullif(btrim(c.status), '') is not null))::integer as com_status,
                 (count(c.id) filter (where c.status in ('Contratado', 'Migração')))::integer as contratados,
                 (count(c.id) filter (where c.status = 'Desistente'))::integer as desistentes
            from public."TB_LISTA_APROVADO" l
            left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
           where l.vigente is true
             and l.edital_id = any (select unnest(v_editais)::text)
           group by l.edital_id
        ) r
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.conferencia_ler_aprovados()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with vigentes as (
    select l.id, l.edital_id, l."TP_ORIGEM",
           case when l.edital_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then l.edital_id::uuid end as edital
      from public."TB_LISTA_APROVADO" l
     where l.vigente is true and coalesce(l.ativo, true)
       and not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" t
                        where t.id::text = l.edital_id and private."FC_EH_TREINAMENTO"(t."ST_TREINAMENTO"))
  ),
  candidatos as (
    select c.id, c.lista_id, v.edital, m."CO_AREA" as area, c.status, c."DT_CONVOCACAO",
           encode(sha256(convert_to('conferencia:' || coalesce(
             'cod:' || nullif(btrim(a.id_origem), ''),
             'nome:' || lower(regexp_replace(btrim(c.nome), '\s+', ' ', 'g'))), 'UTF8')), 'hex') as pessoa,
           -- O vínculo é a matrícula (uma por contratação), em hash: a matrícula não sai do banco.
           encode(sha256(convert_to('vinculo:' || nullif(ltrim(upper(
             regexp_replace(coalesce(c.matricula, ''), '[^0-9A-Za-z]', '', 'g')), '0'), ''), 'UTF8')), 'hex') as vinculo
      from public."TB_CANDIDATO_APROVADO" c
      join vigentes v on v.id = c.lista_id
      left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v.edital
      left join public."TB_ANALISE_CURRICULAR" a on a.id = c."CO_ANALISE_CURRICULAR"
     where c.removido_em is null and c.status in ('Convocado', 'Contratado')
  ),
  publicacoes as (
    select distinct on (h."CO_LISTA_APROVADO") h."CO_LISTA_APROVADO", h."DS_PENDENCIA"
      from public."TH_PUBLICACAO_APROVADO" h
      join vigentes v on v.id = h."CO_LISTA_APROVADO"
     where v."TP_ORIGEM" = 'CLASSIFICACAO'
     order by h."CO_LISTA_APROVADO", h."DT_PUBLICACAO" desc
  )
  select jsonb_build_object(
    'schema_version', 1,
    'candidatos', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id, 'lista', c.lista_id, 'edital', c.edital, 'area', c.area, 'status', c.status,
          'convocado_em', c."DT_CONVOCACAO", 'pessoa', c.pessoa, 'vinculo', c.vinculo)), '[]'::jsonb)
        from candidatos c
    ),
    'pendencias', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'lista', p."CO_LISTA_APROVADO", 'edital', v.edital, 'area', m."CO_AREA",
          'candidatos', (
            select coalesce(jsonb_agg(o.id order by o.id), '[]'::jsonb)
              from jsonb_array_elements(p."DS_PENDENCIA") x
              join public."TB_CANDIDATO_APROVADO" o
                on o.id::text = x ->> 'candidato_id'
             where o.removido_em is null
               and (o.status is not null or nullif(btrim(coalesce(o.matricula, '')), '') is not null
                    or nullif(btrim(coalesce(o.processo_sei, '')), '') is not null)
               and not exists (select 1 from public."TB_CANDIDATO_APROVADO" n
                                where n.lista_id = p."CO_LISTA_APROVADO" and n.removido_em is null
                                  and n."CO_CANDIDATO_ANTERIOR" = o.id)))), '[]'::jsonb)
        from publicacoes p
        join vigentes v on v.id = p."CO_LISTA_APROVADO"
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v.edital
    )
  );
$function$;

CREATE OR REPLACE FUNCTION private."FC_MONTAR_APROVADOS_AREA"(p_area text, p_editais uuid[], OUT p_listas json, OUT p_dicionarios json, OUT p_linhas json, OUT p_total integer)
 RETURNS record
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
 SET work_mem TO '64MB'
 SET jit TO 'off'
AS $function$
begin
  with listas as (
    select l.id, l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome, l.importado_em,
           (row_number() over (order by m.edital, l.id) - 1)::integer as i
      from public."TB_LISTA_APROVADO" l
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
     where l.vigente is true
       and m."CO_AREA" = p_area
       and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
       and (p_editais is null or m.id = any (p_editais))
  ), cand as materialized (
    select c.id, li.i as lista, li.edital, c.cargo, c.classificacao, c.nota, c.nome,
           c.modalidade, c.status, c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga,
           c.alterado_judicialmente, c.nota_original, c.modalidade_original, c.classificacao_original
      from listas li
      join public."TB_CANDIDATO_APROVADO" c on c.lista_id = li.id
     where c.removido_em is null
  ), d_cargo as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct cargo as v from cand where cargo is not null) x
  ), d_modalidade as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct modalidade as v from cand where modalidade is not null) x
  ), d_status as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct status as v from cand where status is not null) x
  ), d_codigo as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct codigo_vaga as v from cand where codigo_vaga is not null) x
  )
  select
    (select coalesce(json_agg(json_build_array(
              li.id, li.edital_id, li.edital, li.unidade, li.ativo, li.arquivo_nome, li.importado_em
            ) order by li.i), '[]'::json)
       from listas li),
    json_build_object(
      'cargo', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_cargo d),
      'modalidade', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_modalidade d),
      'status', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_status d),
      'codigo_vaga', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_codigo d)
    ),
    -- A ordem da função antiga; o id só desempata (antes o empate saía em qualquer ordem).
    (select coalesce(json_agg(
              case when c.alterado_judicialmente then json_build_array(
                c.id, c.lista, dc.i, c.classificacao, c.nota, c.nome, dm.i,
                ds.i, c.processo_sei, c.matricula, c.sub_judice, dv.i,
                true, c.nota_original, c.modalidade_original, c.classificacao_original
              ) else json_build_array(
                c.id, c.lista, dc.i, c.classificacao, c.nota, c.nome, dm.i,
                ds.i, c.processo_sei, c.matricula, c.sub_judice, dv.i
              ) end
            order by c.edital, c.cargo, c.classificacao nulls last, c.nome, c.id), '[]'::json)
       from cand c
       left join d_cargo dc on dc.v = c.cargo
       left join d_modalidade dm on dm.v = c.modalidade
       left join d_status ds on ds.v = c.status
       left join d_codigo dv on dv.v = c.codigo_vaga)
  into p_listas, p_dicionarios, p_linhas;

  p_total := json_array_length(p_linhas);
end;
$function$;

drop function if exists private."FC_EM_OUTRA_LISTA"(uuid);
drop table if exists public."TB_CONTRATACAO_APROVADO";
drop function if exists private."FC_VINCULO_DA_MATRICULA"(text);

alter table public."TB_CANDIDATO_APROVADO"
  drop constraint if exists "CK_CANDIDATO_APROVADO_STATUS";
alter table public."TB_CANDIDATO_APROVADO"
  add constraint "CK_CANDIDATO_APROVADO_STATUS" check (
    status is null
    or status in ('Convocado', 'Contratado', 'Desistente', 'Migração', 'Documentação Rejeitada')
  );
comment on constraint "CK_CANDIDATO_APROVADO_STATUS" on public."TB_CANDIDATO_APROVADO" is
  'Status válidos (Fim de Fila saiu em 20261005180000).';
comment on column public."TB_CANDIDATO_APROVADO".status is
  'Situação do candidato: Convocado (chamado para a contratação, aguardando apresentação e documentos; leva DT_CONVOCACAO), Contratado, Desistente, Migração ou Documentação Rejeitada. Nulo = sem status. Contratados (Seleção e KPIs) são só Contratado e Migração.';

create or replace function public.alterar_status_candidato_aprovado(
  p_candidato_id uuid,
  p_status text,
  p_processo_sei text default null,
  p_matricula text default null,
  p_data_convocacao date default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_candidato public."TB_CANDIDATO_APROVADO"%rowtype;
  v_lista public."TB_LISTA_APROVADO"%rowtype;
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_matricula text := nullif(btrim(coalesce(p_matricula, '')), '');
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_data date;
begin
  -- Quem edita a Lista de aprovados (grupo ou exceção) e tem a área/edital.
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_CANDIDATO_APROVADO" c
                                             join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
                                            where c.id = p_candidato_id));
  if not private.pode_recurso('aprovados', 2) then
    raise exception 'Perfil sem permissao para alterar status' using errcode = '42501';
  end if;

  if v_status is not null and v_status not in (
    'Convocado', 'Contratado', 'Desistente', 'Migração', 'Documentação Rejeitada'
  ) then
    raise exception 'Status invalido' using errcode = '22023';
  end if;

  if v_status in ('Contratado', 'Migração') and v_matricula is null then
    raise exception 'Matricula obrigatoria para Contratado ou Migracao';
  end if;

  if p_data_convocacao is not null and v_status is distinct from 'Convocado' then
    raise exception 'A data da convocação só vale para o status Convocado' using errcode = '22023';
  end if;
  if p_data_convocacao > v_hoje then
    raise exception 'A data da convocação não pode ser futura' using errcode = '22023';
  end if;

  select * into v_candidato
  from public."TB_CANDIDATO_APROVADO"
  where id = p_candidato_id and removido_em is null
  for update;
  if not found then raise exception 'Candidato nao encontrado'; end if;

  -- Status já definido só o admin muda; do Convocado, quem edita segue o fluxo
  -- (ou corrige a data), mas voltar a "sem status" continua sendo do admin.
  if not private.pode_recurso('aprovados', 3) and v_candidato.status is not null
     and not (v_candidato.status = 'Convocado' and v_status is not null) then
    raise exception 'O status deste candidato ja foi definido. Somente admin pode altera-lo';
  end if;

  select * into v_lista
  from public."TB_LISTA_APROVADO"
  where id = v_candidato.lista_id and vigente is true
  for update;
  if not found then raise exception 'Lista vigente nao encontrada'; end if;
  if not v_lista.ativo then
    raise exception 'A lista esta inativa e nao permite alterar candidatos';
  end if;

  if v_status = 'Convocado' then
    v_data := coalesce(p_data_convocacao,
                       (case when v_candidato.status = 'Convocado' then v_candidato."DT_CONVOCACAO" end),
                       v_hoje);
  elsif v_status is null then
    v_data := null;
  else
    v_data := v_candidato."DT_CONVOCACAO";
  end if;

  insert into public."TH_CANDIDATO_APROVADO"(
    candidato_id, lista_id, status_anterior, status_novo,
    processo_sei, matricula, alterado_por, "DT_CONVOCACAO"
  ) values (
    v_candidato.id, v_candidato.lista_id, v_candidato.status, v_status,
    nullif(btrim(coalesce(p_processo_sei, '')), ''), v_matricula,
    (select auth.uid()), v_data
  );

  update public."TB_CANDIDATO_APROVADO"
  set status = v_status,
      processo_sei = nullif(btrim(coalesce(p_processo_sei, '')), ''),
      matricula = case
        when v_status in ('Contratado', 'Migração') then v_matricula
        else null
      end,
      "DT_CONVOCACAO" = v_data,
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = v_candidato.id;

  -- O KPI de contratados do edital já com o status novo (20261006070000).
  if v_lista.edital_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    perform private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(v_lista.edital_id::uuid);
  end if;

  return jsonb_build_object(
    'ok', true,
    'candidato_id', v_candidato.id,
    'status', v_status,
    'matricula', v_matricula,
    'data_convocacao', v_data
  );
end;
$function$;

comment on function public.alterar_status_candidato_aprovado(uuid, text, text, text, date) is
  'Altera o status de um candidato da lista vigente e ativa (Convocado, Contratado, Desistente, Migração, Documentação Rejeitada ou nulo), com processo SEI, matrícula (Contratado e Migração) e a data da convocação (Convocado; padrão hoje, nunca futura). Aprovados >= editor na área/edital; status já definido só o admin muda, exceto do Convocado para outro status. Grava TH_CANDIDATO_APROVADO.';

-- Os contratados dos editais voltam a contar todas as linhas Contratado.
select private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(m.id) from public."TB_MONITORAMENTO_INDIGENA" m where m.ativo;

commit;
