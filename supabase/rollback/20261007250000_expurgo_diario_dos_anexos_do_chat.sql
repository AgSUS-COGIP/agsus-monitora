-- ROLLBACK de supabase/migrations/20261007250000_expurgo_diario_dos_anexos_do_chat.sql
-- Volta preparar_expurgo_anexos_chat e confirmar_expurgo_anexos_chat a "só administrador
-- global" (corpo de 20261007210000_chat_v2.sql), get_saude_das_cargas à versão de
-- 20261007170000_sync_de_analises_nao_trava.sql (sem 'expurgo_chat') e apaga o log das
-- execuções do job (TL_EXPURGO_ANEXO_CHAT, só contagens), a RPC que grava nele e a checagem
-- nova. A fila TB_EXPURGO_ANEXO_CHAT não muda: o que o job já confirmou continua confirmado
-- e o resto continua saindo pela seção Configurações › Mensagens (chat).
-- Antes, desligue o workflow .github/workflows/expurgo-anexos-chat.yml (sem a migration, as
-- RPCs recusam a service_role com 28000 e o job falha todo dia).
begin;

create or replace function public.preparar_expurgo_anexos_chat()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR_ADMIN"();
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
  'Só administrador global (42501): põe na fila os arquivos enviados e nunca anexados (mais de 1 dia) e devolve até 100 caminhos da fila para a tela remover pela API do Storage (a política de exclusão só aceita o que está na fila).';
revoke all on function public.preparar_expurgo_anexos_chat() from public, anon;
grant execute on function public.preparar_expurgo_anexos_chat() to authenticated, service_role;

create or replace function public.confirmar_expurgo_anexos_chat(p_caminhos text[])
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := private."FC_CHAT_EXIGIR_ADMIN"();
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
  'Só administrador global (42501): marca como expurgados os caminhos da fila que já não existem no Storage (o que ainda existe continua na fila). Devolve {confirmados, pendentes}.';
revoke all on function public.confirmar_expurgo_anexos_chat(text[]) from public, anon;
grant execute on function public.confirmar_expurgo_anexos_chat(text[]) to authenticated, service_role;

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
    'tarefas', v_tarefas
  );
end;
$function$;
comment on function public.get_saude_das_cargas() is
  'Saúde das cargas (Configurações, só administrador global): as últimas 10 execuções de cada carga das análises (por origem, com encerrada_por_inatividade — 20261007170000), das entrevistas, da seleção, do robô da Empregare (com vagas pedidas/baixadas/falhas/recusadas e quem disparou), das conferências de consistência (avisos novos, abertos e resolvidos), da pré-classificação da Avaliação documental (editais, vagas, inscritos e lote) e das tarefas agsus_* do pg_cron (nulas sem acesso ao pg_cron). Só leitura.';

drop function if exists public.registrar_expurgo_anexos_chat(text, text, uuid, text, timestamptz, jsonb, text);
drop table if exists public."TL_EXPURGO_ANEXO_CHAT";
drop function if exists private."FC_CHAT_EXIGIR_ADMIN_OU_SERVICO"();

notify pgrst, 'reload schema';

commit;
