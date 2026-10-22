/*
  EXPURGO DIÁRIO DOS ANEXOS DO CHAT (SEM DEPENDER DA TELA)

  Pedido do usuário (07/10/2026): uma rotina diária que apaga do Storage os
  arquivos dos anexos de mensagens já removidas (fila TB_EXPURGO_ANEXO_CHAT),
  sem depender de um administrador abrir Configurações › Mensagens (chat).

  Até aqui (20261007210000_chat_v2.sql), quem tirava os arquivos era só a
  seção da tela: preparar_expurgo_anexos_chat → remove pela API do Storage →
  confirmar_expurgo_anexos_chat, as duas RPCs barrando quem não fosse
  administrador global pelo auth.uid() (FC_CHAT_EXIGIR_ADMIN). Agora o job
  Python scripts/expurgo_anexos_chat/ (GitHub Actions, todo dia às 6h30 de
  Brasília: .github/workflows/expurgo-anexos-chat.yml) faz o mesmo com a
  service_role.

  O QUE MUDA
    1. private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"(): deixa passar a service_role
       (auth.role() = 'service_role', o mesmo critério de
       private.pode_recurso) e, para todo o resto, é o FC_CHAT_EXIGIR_ADMIN de
       sempre (28000 sem sessão, 42501 se não for administrador global).
       Ninguém mais entra: anon continua sem execute, authenticated continua
       só com o administrador global.
    2. preparar_expurgo_anexos_chat() e confirmar_expurgo_anexos_chat(text[]):
       o mesmo corpo, com a checagem nova. Assinaturas iguais; o execute para
       service_role já existia.
    3. public."TL_EXPURGO_ANEXO_CHAT": uma linha por execução do job (como
       TL_CONFERENCIA): quem disparou, lotes, arquivos removidos, confirmados,
       que falharam e os que ficaram na fila. Só contagens: nunca caminho,
       nome de arquivo ou conteúdo. Escrita só por
       registrar_expurgo_anexos_chat (service_role).
    4. get_saude_das_cargas(): ganha 'expurgo_chat' (as 10 últimas execuções),
       para o Status das atualizações mostrar o robô. Corpo de
       20261007170000_sync_de_analises_nao_trava.sql + a chave nova.

  O Storage continua sem DELETE pelo SQL: o job remove pela API (a service_role
  passa por cima das políticas do bucket, por isso ele só remove o que
  preparar_expurgo_anexos_chat devolveu) e confirmar_expurgo_anexos_chat só
  marca o que de fato saiu de storage.objects. O que falhar fica na fila para
  a próxima execução (ou para a tela).

  PRÉ-REQUISITOS: 20261007210000_chat_v2.sql e
  20261007170000_sync_de_analises_nao_trava.sql aplicadas (a migration para se
  não estiverem).

  Ensaio: supabase/ensaios/20261007250000_expurgo_diario_dos_anexos_do_chat.sql
  Rollback: supabase/rollback/20261007250000_expurgo_diario_dos_anexos_do_chat.sql
*/
begin;

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


notify pgrst, 'reload schema';

commit;
