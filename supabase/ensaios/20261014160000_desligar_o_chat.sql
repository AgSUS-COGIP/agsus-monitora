/*
  Ensaio de 20261014160000_desligar_o_chat.sql: execute logo depois da
  migration, na mesma transação, num banco de desenvolvimento. Termina em
  rollback. Confere que o que rodava sozinho parou e que nada foi apagado.
*/
begin;

do $$
declare
  v_rpc text;
  v_tabela text;
begin
  -- pg_cron
  if exists (select 1 from cron.job
              where jobname in ('agsus_robo_expurgo_anexos_chat', 'agsus_chat_retencao_diaria')) then
    raise exception 'As tarefas do chat continuam no pg_cron';
  end if;

  -- Realtime: só o chat sai da publicação
  if exists (select 1 from pg_publication_tables
              where pubname = 'supabase_realtime' and schemaname = 'public'
                and tablename in ('TB_MENSAGEM', 'RL_CONVERSA_PARTICIPANTE', 'RL_MENSAGEM_REACAO', 'TB_CONVERSA')) then
    raise exception 'Tabela do chat continua na publicação supabase_realtime';
  end if;
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and tablename = 'TB_MONITORAMENTO_INDIGENA') then
    raise exception 'TB_MONITORAMENTO_INDIGENA não pode sair da publicação';
  end if;
  if exists (select 1 from pg_policies
              where policyname in ('PL_CHAT_REALTIME_LEITURA', 'PL_CHAT_REALTIME_ENVIO',
                                   'chat_anexos_storage_insert', 'chat_anexos_storage_delete')) then
    raise exception 'Política do chat (Realtime ou envio/remoção de anexo) continua';
  end if;
  if not exists (select 1 from pg_policies where policyname = 'chat_anexos_storage_select') then
    raise exception 'A leitura dos anexos guardados deveria ficar';
  end if;

  -- RPCs: fora do alcance de authenticated/anon; a service_role e as funções ficam
  for v_rpc in
    select p.oid::regprocedure::text
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like '%\_chat'
  loop
    if has_function_privilege('authenticated', v_rpc, 'execute')
       or has_function_privilege('anon', v_rpc, 'execute') then
      raise exception 'authenticated/anon ainda executa %', v_rpc;
    end if;
    if not has_function_privilege('service_role', v_rpc, 'execute') then
      raise exception 'A service_role perdeu %', v_rpc;
    end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname like '%\_chat') < 27 then
    raise exception 'Alguma RPC do chat sumiu (as funções ficam)';
  end if;

  -- Dados e armazenamento ficam
  foreach v_tabela in array array['TB_CONVERSA', 'TB_MENSAGEM', 'RL_CONVERSA_PARTICIPANTE',
                                  'RL_MENSAGEM_REACAO', 'TB_RETENCAO_CHAT', 'TH_LIMPEZA_CHAT',
                                  'TB_EXPURGO_ANEXO_CHAT', 'TL_EXPURGO_ANEXO_CHAT'] loop
    if to_regclass(format('public.%I', v_tabela)) is null then
      raise exception 'Tabela % sumiu', v_tabela;
    end if;
  end loop;
  if not exists (select 1 from storage.buckets where id = 'chat-anexos') then
    raise exception 'O bucket chat-anexos sumiu';
  end if;

  -- Robôs: o expurgo saiu da lista fixa, do "Rodar agora" e do Status
  begin
    perform private."FC_DISPARAR_ROBO"('expurgo-anexos-chat.yml', '{"modo": "normal"}');
    raise exception 'FC_DISPARAR_ROBO ainda aceita o expurgo';
  exception when sqlstate '22023' then null;
  end;
  if pg_get_functiondef('public.get_saude_das_cargas()'::regprocedure) ilike '%expurgo%'
     or pg_get_functiondef('public.disparar_robo(text, jsonb)'::regprocedure) ilike '%expurgo%' then
    raise exception 'get_saude_das_cargas ou disparar_robo ainda citam o expurgo';
  end if;
  if pg_get_functiondef('private."FC_DISPARAR_ROBO"(text, jsonb, uuid)'::regprocedure) not ilike '%conferencias.yml%'
     or pg_get_functiondef('public.disparar_robo(text, jsonb)'::regprocedure) not ilike '%pre-classificacao.yml%' then
    raise exception 'Os outros robôs deveriam continuar na lista';
  end if;
  raise notice 'chat desligado: agendas, Realtime, RPCs, anexos e robôs conferidos; dados intactos';
end;
$$;

rollback;
