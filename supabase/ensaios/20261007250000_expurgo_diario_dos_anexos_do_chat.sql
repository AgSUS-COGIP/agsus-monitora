/*
  ENSAIO de 20261007250000_expurgo_diario_dos_anexos_do_chat.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (sem o
  begin/commit dela) e confere:
    E1  as RPCs são SECURITY DEFINER; anon não executa nenhuma; o registro e a
        checagem nova não são executáveis por authenticated; preparar e
        confirmar continuam com authenticated e service_role; o log não é
        legível direto;
    E2  quem não é administrador global continua barrado (42501) em preparar e
        confirmar;
    E3  a service_role (o job) prepara e confirma: confirmar marca um caminho
        de teste que não existe no Storage, e registrar grava CONCLUIDA,
        PARCIAL e FALHOU (mensagem com caminho é omitida), recusa repetição
        (23505), contagem inválida e MONITORA sem usuário (22023);
    E4  como um administrador global de verdade (o primeiro perfil ativo com
        grupo ST_ADMIN_GLOBAL, sem mostrar quem): get_saude_das_cargas traz
        'expurgo_chat' com as execuções do ensaio e sem caminho nenhum.
  Termina em ROLLBACK e só mostra contagens.
*/
begin;

-- Corpo de supabase/migrations/20261007250000_expurgo_diario_dos_anexos_do_chat.sql (sem begin/commit):

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.preparar_expurgo_anexos_chat()') is null
     or to_regprocedure('public.confirmar_expurgo_anexos_chat(text[])') is null
     or to_regclass('public."TB_EXPURGO_ANEXO_CHAT"') is null then
    raise exception 'Aplique antes 20261007210000_chat_v2.sql.';
  end if;
  if to_regprocedure('public."FC_ENCERRAR_SYNC_ANALISE_INATIVO"(text, integer)') is null then
    raise exception 'Aplique antes 20261007170000_sync_de_analises_nao_trava.sql.';
  end if;
end;
$$;

-- 1. Administrador global ou o job (service_role) -----------------------------------------
create function private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"()
returns uuid
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if coalesce((select auth.role()) = 'service_role', false) then
    return null;
  end if;
  return private."FC_CHAT_EXIGIR_ADMIN"();
end;
$function$;
comment on function private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"() is
  'Expurgo dos anexos do chat: deixa passar a service_role (job diário scripts/expurgo_anexos_chat/; devolve nulo) e, para os demais, é FC_CHAT_EXIGIR_ADMIN (28000 sem sessão, 42501 se não for administrador global; devolve auth.uid()).';
revoke all on function private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"() from public, anon, authenticated;

-- 2. As duas RPCs do expurgo aceitam também a service_role --------------------------------
create or replace function public.preparar_expurgo_anexos_chat()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"();
begin
  -- Enviado e nunca anexado (mais de 1 dia): também sai.
  insert into public."TB_EXPURGO_ANEXO_CHAT" ("DS_CAMINHO", "TP_ORIGEM")
  select o.name, 'ORFAO'
    from storage.objects o
   where o.bucket_id = 'chat-anexos'
     and o.created_at < now() - interval '1 day'
     and o.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]{2,5}$'
     and not exists (select 1 from public."TB_ANEXO_MENSAGEM" a where a."DS_CAMINHO" = o.name)
  on conflict on constraint "PK_TB_EXPURGO_ANEXO_CHAT" do nothing;
  return jsonb_build_object(
    'bucket', 'chat-anexos',
    'pendentes', (select count(*) from public."TB_EXPURGO_ANEXO_CHAT" e where e."DT_EXPURGO" is null),
    'caminhos', coalesce((
      select jsonb_agg(x."DS_CAMINHO" order by x."DT_CRIACAO", x."DS_CAMINHO")
        from (
          select e."DS_CAMINHO", e."DT_CRIACAO"
            from public."TB_EXPURGO_ANEXO_CHAT" e
           where e."DT_EXPURGO" is null
             and not exists (select 1 from public."TB_ANEXO_MENSAGEM" a where a."DS_CAMINHO" = e."DS_CAMINHO")
           order by e."DT_CRIACAO", e."DS_CAMINHO"
           limit 100
        ) x), '[]'::jsonb));
end;
$function$;
comment on function public.preparar_expurgo_anexos_chat() is
  'Administrador global (42501) ou service_role (job diário, desde 20261007250000): põe na fila os arquivos enviados e nunca anexados (mais de 1 dia) e devolve até 100 caminhos da fila para remover pela API do Storage (a política de exclusão só aceita o que está na fila; a service_role remove só o que esta função devolveu).';
revoke all on function public.preparar_expurgo_anexos_chat() from public, anon;
grant execute on function public.preparar_expurgo_anexos_chat() to authenticated, service_role;

create or replace function public.confirmar_expurgo_anexos_chat(p_caminhos text[])
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"();
  v_confirmados integer;
begin
  update public."TB_EXPURGO_ANEXO_CHAT" e
     set "DT_EXPURGO" = now()
   where e."DS_CAMINHO" = any (coalesce(p_caminhos, '{}'::text[]))
     and e."DT_EXPURGO" is null
     and not exists (select 1 from storage.objects o
                      where o.bucket_id = 'chat-anexos' and o.name = e."DS_CAMINHO");
  get diagnostics v_confirmados = row_count;
  return jsonb_build_object(
    'confirmados', v_confirmados,
    'pendentes', (select count(*) from public."TB_EXPURGO_ANEXO_CHAT" e where e."DT_EXPURGO" is null));
end;
$function$;
comment on function public.confirmar_expurgo_anexos_chat(text[]) is
  'Administrador global (42501) ou service_role (job diário, desde 20261007250000): marca como expurgados os caminhos da fila que já não existem no Storage (o que ainda existe continua na fila). Devolve {confirmados, pendentes}.';
revoke all on function public.confirmar_expurgo_anexos_chat(text[]) from public, anon;
grant execute on function public.confirmar_expurgo_anexos_chat(text[]) to authenticated, service_role;

-- 3. Log das execuções do job -------------------------------------------------------------
create table public."TL_EXPURGO_ANEXO_CHAT" (
  "CO_EXECUCAO" text not null,
  "DT_INICIO" timestamptz not null,
  "DT_FIM" timestamptz not null default now(),
  "TP_SITUACAO" text not null,
  "TP_DISPARO" text not null,
  "CO_USUARIO_DISPARO" uuid,
  "QT_LOTE" integer not null default 0,
  "QT_REMOVIDO" integer not null default 0,
  "QT_CONFIRMADO" integer not null default 0,
  "QT_FALHA" integer not null default 0,
  "QT_PENDENTE" integer,
  "DS_MENSAGEM" text,
  "DS_URL_EXECUCAO" text,
  constraint "PK_TL_EXPURGO_ANEXO_CHAT" primary key ("CO_EXECUCAO"),
  constraint "CK_EXECEXPURGO_COEXECUCAO" check ("CO_EXECUCAO" ~ '^[A-Za-z0-9_-]{8,80}$'),
  constraint "CK_EXECEXPURGO_TPSITUACAO" check ("TP_SITUACAO" in ('CONCLUIDA', 'PARCIAL', 'FALHOU')),
  constraint "CK_EXECEXPURGO_TPDISPARO" check ("TP_DISPARO" in ('AGENDA', 'MONITORA', 'GITHUB')),
  constraint "CK_EXECEXPURGO_USUARIO" check (("TP_DISPARO" = 'MONITORA') = ("CO_USUARIO_DISPARO" is not null)),
  constraint "CK_EXECEXPURGO_DATAS" check ("DT_FIM" >= "DT_INICIO"),
  constraint "CK_EXECEXPURGO_QT" check (
    "QT_LOTE" >= 0 and "QT_REMOVIDO" >= 0 and "QT_CONFIRMADO" >= 0 and "QT_FALHA" >= 0
    and coalesce("QT_PENDENTE", 0) >= 0
  ),
  constraint "CK_EXECEXPURGO_TAMANHOS" check (
    coalesce(length("DS_MENSAGEM"), 0) <= 500
    and ("DS_URL_EXECUCAO" is null or ("DS_URL_EXECUCAO" ~ '^https://github\.com/' and length("DS_URL_EXECUCAO") <= 300))
  )
);
comment on table public."TL_EXPURGO_ANEXO_CHAT" is
  'Log das execuções do job diário que tira do Storage os arquivos da fila TB_EXPURGO_ANEXO_CHAT (scripts/expurgo_anexos_chat/): uma linha por execução, só contagens (nunca caminho, nome de arquivo ou conteúdo). Escrita só por registrar_expurgo_anexos_chat (service_role); leitura pelo Status das atualizações (get_saude_das_cargas).';
comment on column public."TL_EXPURGO_ANEXO_CHAT"."CO_EXECUCAO" is 'Identificador da execução (gerado pelo job: expurgo-<data>-<sufixo>).';
comment on column public."TL_EXPURGO_ANEXO_CHAT"."DT_INICIO" is 'Início da execução (informado pelo job).';
comment on column public."TL_EXPURGO_ANEXO_CHAT"."DT_FIM" is 'Fim da execução (quando o job registrou).';
comment on column public."TL_EXPURGO_ANEXO_CHAT"."TP_SITUACAO" is 'CONCLUIDA (tudo o que tentou saiu); PARCIAL (algum arquivo ficou na fila); FALHOU (erro geral).';
comment on column public."TL_EXPURGO_ANEXO_CHAT"."TP_DISPARO" is 'Quem disparou: AGENDA (6h30 de Brasília), MONITORA (Rodar agora) ou GITHUB (Run workflow na aba Actions).';
comment on column public."TL_EXPURGO_ANEXO_CHAT"."CO_USUARIO_DISPARO" is 'Usuário do MONITORA (auth.users.id) que clicou em Rodar agora; nulo nos outros disparos.';
comment on column public."TL_EXPURGO_ANEXO_CHAT"."QT_LOTE" is 'Lotes pedidos a preparar_expurgo_anexos_chat (até 100 caminhos cada).';
comment on column public."TL_EXPURGO_ANEXO_CHAT"."QT_REMOVIDO" is 'Arquivos que a API do Storage disse ter removido.';
comment on column public."TL_EXPURGO_ANEXO_CHAT"."QT_CONFIRMADO" is 'Caminhos que confirmar_expurgo_anexos_chat marcou como expurgados (já fora de storage.objects).';
comment on column public."TL_EXPURGO_ANEXO_CHAT"."QT_FALHA" is 'Caminhos tentados que não saíram (continuam na fila para a próxima execução).';
comment on column public."TL_EXPURGO_ANEXO_CHAT"."QT_PENDENTE" is 'Arquivos na fila ao fim da execução; nulo se o job não chegou a ler a fila.';
comment on column public."TL_EXPURGO_ANEXO_CHAT"."DS_MENSAGEM" is 'Erro geral (sem caminho, nome de arquivo nem dado pessoal; o que parecer é omitido).';
comment on column public."TL_EXPURGO_ANEXO_CHAT"."DS_URL_EXECUCAO" is 'Endereço da execução no GitHub Actions.';
comment on constraint "PK_TL_EXPURGO_ANEXO_CHAT" on public."TL_EXPURGO_ANEXO_CHAT" is 'Uma linha por execução.';
comment on constraint "CK_EXECEXPURGO_COEXECUCAO" on public."TL_EXPURGO_ANEXO_CHAT" is 'Identificador de 8 a 80 caracteres seguros.';
comment on constraint "CK_EXECEXPURGO_TPSITUACAO" on public."TL_EXPURGO_ANEXO_CHAT" is 'Situações válidas.';
comment on constraint "CK_EXECEXPURGO_TPDISPARO" on public."TL_EXPURGO_ANEXO_CHAT" is 'Disparos válidos.';
comment on constraint "CK_EXECEXPURGO_USUARIO" on public."TL_EXPURGO_ANEXO_CHAT" is 'Usuário só (e sempre) no disparo pelo MONITORA.';
comment on constraint "CK_EXECEXPURGO_DATAS" on public."TL_EXPURGO_ANEXO_CHAT" is 'O fim não vem antes do início.';
comment on constraint "CK_EXECEXPURGO_QT" on public."TL_EXPURGO_ANEXO_CHAT" is 'Contagens não negativas.';
comment on constraint "CK_EXECEXPURGO_TAMANHOS" on public."TL_EXPURGO_ANEXO_CHAT" is 'Mensagem até 500 caracteres; endereço só do GitHub, até 300.';

create index "IN_EXECEXPURGO_DTINICIO" on public."TL_EXPURGO_ANEXO_CHAT" ("DT_INICIO" desc);
comment on index public."IN_EXECEXPURGO_DTINICIO" is 'As últimas execuções primeiro (Status das atualizações).';

alter table public."TL_EXPURGO_ANEXO_CHAT" enable row level security;
revoke all on public."TL_EXPURGO_ANEXO_CHAT" from public, anon, authenticated;

create function public.registrar_expurgo_anexos_chat(
  p_execucao text,
  p_disparo text,
  p_usuario uuid,
  p_url text,
  p_inicio timestamptz,
  p_contagens jsonb,
  p_erro text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_mensagem text := nullif(left(btrim(coalesce(p_erro, '')), 500), '');
  v_contagens jsonb := coalesce(p_contagens, '{}'::jsonb);
  v_falhas integer;
  v_situacao text;
begin
  if p_execucao is null or p_execucao !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'Identificador de execução inválido' using errcode = '22023';
  end if;
  if p_disparo is null or p_disparo not in ('AGENDA', 'MONITORA', 'GITHUB') then
    raise exception 'Disparo inválido: AGENDA, MONITORA ou GITHUB' using errcode = '22023';
  end if;
  if (p_disparo = 'MONITORA') <> (p_usuario is not null) then
    raise exception 'Usuário só (e sempre) no disparo pelo MONITORA' using errcode = '22023';
  end if;
  if p_inicio is null or p_inicio > now() + interval '5 minutes' or p_inicio < now() - interval '1 day' then
    raise exception 'Início da execução inválido' using errcode = '22023';
  end if;
  if jsonb_typeof(v_contagens) <> 'object'
     or exists (
       select 1 from jsonb_each(v_contagens) c
        where c.key not in ('lotes', 'removidos', 'confirmados', 'falhas', 'pendentes')
           or not (
                (jsonb_typeof(c.value) = 'number'
                 and (c.value #>> '{}')::numeric between 0 and 2147483647
                 and (c.value #>> '{}')::numeric = trunc((c.value #>> '{}')::numeric))
             or (c.key = 'pendentes' and jsonb_typeof(c.value) = 'null'))) then
    raise exception 'Contagens inválidas: lotes, removidos, confirmados, falhas e pendentes (inteiros >= 0)'
      using errcode = '22023';
  end if;
  v_falhas := coalesce((v_contagens ->> 'falhas')::integer, 0);
  -- Mensagem com cara de caminho do bucket (uuid) ou de dado pessoal não entra no log.
  if v_mensagem is not null
     and (v_mensagem ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
          or v_mensagem ~ '@' or v_mensagem ~ '[0-9]{11}') then
    v_mensagem := 'Erro geral (a mensagem foi omitida por trazer caminho ou dado pessoal).';
  end if;
  v_situacao := case
    when v_mensagem is not null then 'FALHOU'
    when v_falhas > 0 then 'PARCIAL'
    else 'CONCLUIDA' end;

  insert into public."TL_EXPURGO_ANEXO_CHAT" (
    "CO_EXECUCAO", "DT_INICIO", "TP_SITUACAO", "TP_DISPARO", "CO_USUARIO_DISPARO",
    "QT_LOTE", "QT_REMOVIDO", "QT_CONFIRMADO", "QT_FALHA", "QT_PENDENTE", "DS_MENSAGEM", "DS_URL_EXECUCAO")
  values (
    p_execucao, least(p_inicio, now()), v_situacao, p_disparo, p_usuario,
    coalesce((v_contagens ->> 'lotes')::integer, 0),
    coalesce((v_contagens ->> 'removidos')::integer, 0),
    coalesce((v_contagens ->> 'confirmados')::integer, 0),
    v_falhas,
    (v_contagens ->> 'pendentes')::integer,
    v_mensagem,
    p_url)
  on conflict on constraint "PK_TL_EXPURGO_ANEXO_CHAT" do nothing;
  if not found then
    raise exception 'Execução % já registrada', p_execucao using errcode = '23505';
  end if;

  return jsonb_build_object('execucao', p_execucao, 'situacao', v_situacao);
end;
$function$;
comment on function public.registrar_expurgo_anexos_chat(text, text, uuid, text, timestamptz, jsonb, text) is
  'Registra em TL_EXPURGO_ANEXO_CHAT uma execução do job diário do expurgo dos anexos do chat: quem disparou (AGENDA, MONITORA com o usuário, GITHUB), o endereço no GitHub, o início e as contagens {lotes, removidos, confirmados, falhas, pendentes}. Com p_erro, FALHOU; com falhas, PARCIAL; senão, CONCLUIDA. Mensagem com caminho (uuid) ou dado pessoal é omitida. 22023 para entrada inválida; 23505 se a execução já foi registrada. Só service_role.';
revoke all on function public.registrar_expurgo_anexos_chat(text, text, uuid, text, timestamptz, jsonb, text) from public, anon, authenticated;
grant execute on function public.registrar_expurgo_anexos_chat(text, text, uuid, text, timestamptz, jsonb, text) to service_role;

-- 4. Status das atualizações: o robô do expurgo -------------------------------------------
CREATE OR REPLACE FUNCTION public.get_saude_das_cargas()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tarefas json;
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global vê a saúde das cargas' using errcode = '42501';
  end if;

  -- pg_cron pode não estar acessível: a seção mostra "indisponível" nessa parte.
  begin
    select coalesce(json_agg(json_build_object(
        'nome', j.jobname,
        'agenda', j.schedule,
        'ativa', j.active,
        'execucoes', (
          select coalesce(json_agg(json_build_object(
              'inicio', d.start_time,
              'fim', d.end_time,
              'situacao', d.status,
              'mensagem', left(d.return_message, 500)
            ) order by d.start_time desc), '[]'::json)
            from (select * from cron.job_run_details r
                   where r.jobid = j.jobid
                   order by r.start_time desc limit 10) d
        )
      ) order by j.jobname), '[]'::json)
      into v_tarefas
      from cron.job j
     where left(j.jobname, 6) = 'agsus_';
  exception when others then
    v_tarefas := null;
  end;

  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'analises', (
      select coalesce(json_agg(json_build_object(
          'origem', o."CO_ORIGEM",
          'area', p."CO_AREA",
          'planilha', p."NO_PLANILHA",
          'tipo', o."TP_CARGA",
          'execucoes', (
            select coalesce(json_agg(json_build_object(
                'inicio', x.j ->> 'started_at',
                'fim', x.j ->> 'finished_at',
                'situacao', x.j ->> 'status',
                'linhas', coalesce(x.j ->> 'total_processados', x.j ->> 'total_lidos', x.j ->> 'linhas_staging'),
                'mensagem', left(coalesce(x.j ->> 'erro', x.j ->> 'mensagem'), 500),
                -- [nao-trava] encerrada por inatividade (20261007170000)
                'encerrada_por_inatividade', coalesce((x.j -> 'resultado' ->> 'encerrada_por_inatividade')::boolean, false)
              ) order by x.inicio desc nulls last), '[]'::json)
              from (select to_jsonb(s) as j, s.started_at as inicio
                      from public."TL_SYNC_ANALISE" s
                     where s.origem = o."CO_ORIGEM"
                     order by s.started_at desc nulls last
                     limit 10) x
          )
        ) order by p."CO_AREA", o."TP_CARGA" desc), '[]'::json)
        from public."TA_ORIGEM_ANALISE" o
        join public."TB_PLANILHA_ANALISE" p on p."CO_PLANILHA" = o."CO_PLANILHA"
    ),
    'entrevistas', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'area', e."CO_AREA"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_ENTREVISTA" t order by t."DT_INICIO" desc limit 10) e
    ),
    'selecao', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_SELECAO" t order by t."DT_INICIO" desc limit 10) e
    ),
    'empregare', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'disparo', e."TP_DISPARO",
          'vagas_pedidas', e."QT_VAGA_PEDIDA",
          'vagas_baixadas', e."QT_VAGA_BAIXADA",
          'vagas_falha', e."QT_VAGA_FALHA",
          'vagas_recusadas', e."QT_VAGA_RECUSADA",
          'desativadas', e."QT_DESATIVADA",
          'execucao', e."DS_URL_EXECUCAO"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_EMPREGARE" t order by t."DT_INICIO" desc limit 10) e
    ),
    'conferencias', (
      select coalesce(json_agg(json_build_object(
          'inicio', c."DT_INICIO",
          'fim', c."DT_FIM",
          'situacao', c."TP_SITUACAO",
          'linhas', c."QT_AVISO_ABERTO",
          'mensagem', c."DS_MENSAGEM",
          'disparo', c."TP_DISPARO",
          'novos', c."QT_AVISO_NOVO",
          'abertos', c."QT_AVISO_ABERTO",
          'resolvidos', c."QT_AVISO_RESOLVIDO",
          'falhas', c."DS_FALHA",
          'execucao', c."DS_URL_EXECUCAO"
        ) order by c."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_CONFERENCIA" t order by t."DT_INICIO" desc limit 10) c
    ),
    'pre_classificacao', (
      select coalesce(json_agg(json_build_object(
          'inicio', p."DT_INICIO",
          'fim', p."DT_FIM",
          'situacao', p."TP_SITUACAO",
          'linhas', p."QT_INSCRITO",
          'mensagem', p."DS_MENSAGEM",
          'disparo', p."TP_DISPARO",
          'editais', p."QT_EDITAL",
          'vagas', p."QT_VAGA",
          'lote', p."QT_LOTE",
          'refazer', p."ST_REFAZER_LOTE" = 'S',
          'execucao', p."DS_URL_EXECUCAO"
        ) order by p."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_PRE_CLASSIFICACAO" t order by t."DT_INICIO" desc limit 10) p
    ),
    -- [expurgo-diario] o job diário do expurgo dos anexos do chat (20261007250000)
    'expurgo_chat', (
      select coalesce(json_agg(json_build_object(
          'inicio', x."DT_INICIO",
          'fim', x."DT_FIM",
          'situacao', x."TP_SITUACAO",
          'linhas', x."QT_CONFIRMADO",
          'mensagem', x."DS_MENSAGEM",
          'disparo', x."TP_DISPARO",
          'lotes', x."QT_LOTE",
          'removidos', x."QT_REMOVIDO",
          'confirmados', x."QT_CONFIRMADO",
          'falhas', x."QT_FALHA",
          'pendentes', x."QT_PENDENTE",
          'execucao', x."DS_URL_EXECUCAO"
        ) order by x."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_EXPURGO_ANEXO_CHAT" t order by t."DT_INICIO" desc limit 10) x
    ),
    'tarefas', v_tarefas
  );
end;
$function$;
comment on function public.get_saude_das_cargas() is
  'Saúde das cargas (Configurações, só administrador global): as últimas 10 execuções de cada carga das análises (por origem, com encerrada_por_inatividade — 20261007170000), das entrevistas, da seleção, do robô da Empregare (com vagas pedidas/baixadas/falhas/recusadas e quem disparou), das conferências de consistência (avisos novos, abertos e resolvidos), da pré-classificação da Avaliação documental (editais, vagas, inscritos e lote), do expurgo diário dos anexos do chat (lotes, removidos, confirmados, falhas e pendentes — 20261007250000) e das tarefas agsus_* do pg_cron (nulas sem acesso ao pg_cron). Só leitura.';



-- E1 ----------------------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.preparar_expurgo_anexos_chat()',
    'public.confirmar_expurgo_anexos_chat(text[])',
    'public.registrar_expurgo_anexos_chat(text, text, uuid, text, timestamptz, jsonb, text)',
    'private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"()'
  ] loop
    if not (select p.prosecdef from pg_proc p where p.oid = to_regprocedure(f)) then
      raise exception 'FALHOU E1: % sem SECURITY DEFINER', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then
      raise exception 'FALHOU E1: anon executa %', f;
    end if;
  end loop;
  foreach f in array array['public.preparar_expurgo_anexos_chat()', 'public.confirmar_expurgo_anexos_chat(text[])'] loop
    if not has_function_privilege('authenticated', f, 'execute') or not has_function_privilege('service_role', f, 'execute') then
      raise exception 'FALHOU E1: % sem authenticated ou service_role', f;
    end if;
  end loop;
  if has_function_privilege('authenticated', 'public.registrar_expurgo_anexos_chat(text, text, uuid, text, timestamptz, jsonb, text)', 'execute')
     or not has_function_privilege('service_role', 'public.registrar_expurgo_anexos_chat(text, text, uuid, text, timestamptz, jsonb, text)', 'execute') then
    raise exception 'FALHOU E1: registrar_expurgo_anexos_chat não é só da service_role';
  end if;
  if has_function_privilege('authenticated', 'private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"()', 'execute') then
    raise exception 'FALHOU E1: authenticated executa a checagem direto';
  end if;
  if has_table_privilege('authenticated', 'public."TL_EXPURGO_ANEXO_CHAT"', 'select')
     or has_table_privilege('anon', 'public."TL_EXPURGO_ANEXO_CHAT"', 'select') then
    raise exception 'FALHOU E1: o log é legível direto';
  end if;
  raise notice 'ok E1';
end;
$$;

-- E2 ----------------------------------------------------------------------------------------
set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-a000-0000000000e2","role":"authenticated","email":"ensaio.expurgo@ensaio.invalid"}', true);
  begin
    perform public.preparar_expurgo_anexos_chat();
    raise exception 'FALHOU E2: quem não é administrador preparou o expurgo';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.confirmar_expurgo_anexos_chat(array[]::text[]);
    raise exception 'FALHOU E2: quem não é administrador confirmou o expurgo';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'ok E2';
end;
$$;
reset role;

-- E3 ----------------------------------------------------------------------------------------
-- Um caminho de teste na fila, que não existe no Storage (como o que o job acabou de remover).
insert into public."TB_EXPURGO_ANEXO_CHAT" ("DS_CAMINHO", "TP_ORIGEM")
values ('00000000-0000-4000-a000-0000000000e3/00000000-0000-4000-a000-0000000000e3.pdf', 'RETENCAO');

set local role service_role;
do $$
declare
  v jsonb;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  v := public.preparar_expurgo_anexos_chat();
  if v ->> 'bucket' <> 'chat-anexos' or jsonb_typeof(v -> 'caminhos') <> 'array'
     or jsonb_array_length(v -> 'caminhos') > 100 or (v ->> 'pendentes')::integer < 1 then
    raise exception 'FALHOU E3: preparar respondeu fora do formato';
  end if;
  v := public.confirmar_expurgo_anexos_chat(array['00000000-0000-4000-a000-0000000000e3/00000000-0000-4000-a000-0000000000e3.pdf']);
  if (v ->> 'confirmados')::integer <> 1 then
    raise exception 'FALHOU E3: confirmar não marcou o caminho de teste';
  end if;

  v := public.registrar_expurgo_anexos_chat('expurgo-ensaio-e3-ok', 'AGENDA', null,
         'https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/1', now() - interval '1 minute',
         '{"lotes": 2, "removidos": 150, "confirmados": 150, "falhas": 0, "pendentes": 0}');
  if v ->> 'situacao' <> 'CONCLUIDA' then raise exception 'FALHOU E3: esperava CONCLUIDA'; end if;
  v := public.registrar_expurgo_anexos_chat('expurgo-ensaio-e3-parcial', 'MONITORA',
         '00000000-0000-4000-a000-0000000000e3', null, now() - interval '2 minutes',
         '{"lotes": 1, "removidos": 90, "confirmados": 90, "falhas": 10, "pendentes": 10}');
  if v ->> 'situacao' <> 'PARCIAL' then raise exception 'FALHOU E3: esperava PARCIAL'; end if;
  v := public.registrar_expurgo_anexos_chat('expurgo-ensaio-e3-falhou', 'GITHUB', null, null, now() - interval '3 minutes',
         '{"lotes": 0, "pendentes": null}',
         'falhou em 00000000-0000-4000-a000-0000000000e3/00000000-0000-4000-a000-0000000000e3.pdf');
  if v ->> 'situacao' <> 'FALHOU' then raise exception 'FALHOU E3: esperava FALHOU'; end if;

  begin
    perform public.registrar_expurgo_anexos_chat('expurgo-ensaio-e3-ok', 'AGENDA', null, null, now(), '{}');
    raise exception 'FALHOU E3: registrou a mesma execução duas vezes';
  exception when sqlstate '23505' then null;
  end;
  begin
    perform public.registrar_expurgo_anexos_chat('expurgo-ensaio-e3-x1', 'AGENDA', null, null, now(), '{"removidos": -1}');
    raise exception 'FALHOU E3: aceitou contagem negativa';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.registrar_expurgo_anexos_chat('expurgo-ensaio-e3-x2', 'AGENDA', null, null, now(), '{"caminhos": 1}');
    raise exception 'FALHOU E3: aceitou chave desconhecida';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.registrar_expurgo_anexos_chat('expurgo-ensaio-e3-x3', 'MONITORA', null, null, now(), '{}');
    raise exception 'FALHOU E3: aceitou MONITORA sem usuário';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok E3';
end;
$$;
reset role;

-- E4 ----------------------------------------------------------------------------------------
select set_config('ensaio.admin', (
  select p.user_id::text from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo is true and a."ST_ADMIN_GLOBAL" and p.user_id is not null
   order by p.user_id limit 1), true);

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('ensaio.admin'), 'role', 'authenticated')::text, true);

with saude as (select public.get_saude_das_cargas() as j)
select
  json_typeof(j -> 'expurgo_chat') as tipo_expurgo,
  (select count(*) from json_array_elements(j -> 'expurgo_chat')) as execucoes_expurgo,
  (select string_agg(e ->> 'situacao', ',' order by e ->> 'inicio' desc) from json_array_elements(j -> 'expurgo_chat') e) as situacoes,
  (select count(*) from json_array_elements(j -> 'expurgo_chat') e
    where e ->> 'mensagem' like 'Erro geral (a mensagem foi omitida%') as mensagens_omitidas,
  (j -> 'expurgo_chat')::text ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' as expurgo_com_caminho,
  json_typeof(j -> 'conferencias') as conferencias_continua,
  json_typeof(j -> 'pre_classificacao') as pre_classificacao_continua
  from saude;

rollback;
