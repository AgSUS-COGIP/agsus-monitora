/*
  ENSAIO de 20261022170000_robos_mais_robustos.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres), com a migration no lugar
  marcado abaixo (sem o begin/commit dela). Nada sai para o GitHub: o nome do
  segredo aponta para um que não existe (agsus.segredo_disparo_robos), então
  FC_DISPARAR_ROBO só grava SEM_TOKEN. Reprova (raise exception 'FALHOU …') se:
    E1  FC_EXECUCAO_PENDENTE_NO_GRUPO existir sem a revogação, a constraint não
        aceitar leitura-de-arquivos.yml ou registrar_disparo_externo aceitar o
        expurgo / recusar a leitura;
    E2  FC_EXECUCAO_PENDENTE_NO_GRUPO: com uma execução do robô rodando e só o
        pedido que a pôs para rodar, disser que há fila; com um pedido mais novo,
        não disser (no robô e na leitura, que dividem o grupo);
    E3  disparar_robo (administrador global): Só anexos do 114/2026 (congelado)
        passar sem a liberação; "só comparar" ou com liberação e motivo ser
        recusado; pedido com execução esperando no grupo passar;
    E4  gravar_anexos_empregare gravar vaga do edital congelado sem o uso da
        liberação registrado na execução, ou recusar com ele;
    E5  gravar_leituras_de_arquivos gravar leitura de arquivo trocado
        (hash_link_arquivo diferente do gravado) ou recusar a do arquivo certo e a
        sem hash_link_arquivo.
  Termina em rollback: nada fica gravado.
*/
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- >>> cole aqui supabase/migrations/20261022170000_robos_mais_robustos.sql (sem o begin/commit) <<<

select set_config('ensaio.edital', 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0', true);
select set_config('ensaio.admin', (
  select p.user_id::text from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo is true and a."ST_ADMIN_GLOBAL" and p.user_id is not null
   order by p.user_id limit 1), true);
select set_config('agsus.segredo_disparo_robos', 'github_disparo_robos_ausente_no_ensaio', true);

-- E1 Estrutura e lista dos workflows ---------------------------------------------------------------
do $$
declare
  v_id bigint;
begin
  if exists (select 1 from vault.secrets where name = 'github_disparo_robos_ausente_no_ensaio') then
    raise exception 'ENSAIO INTERROMPIDO: o nome alternativo existe no Vault.';
  end if;
  if has_function_privilege('authenticated', 'private."FC_EXECUCAO_PENDENTE_NO_GRUPO"(text)', 'execute')
     or has_function_privilege('anon', 'private."FC_EXECUCAO_PENDENTE_NO_GRUPO"(text)', 'execute') then
    raise exception 'FALHOU E1: FC_EXECUCAO_PENDENTE_NO_GRUPO aberta para authenticated/anon';
  end if;
  if has_function_privilege('authenticated', 'public.gravar_anexos_empregare(text, text, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.gravar_leituras_de_arquivos(text, jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.disparar_robo(text, jsonb)', 'execute') then
    raise exception 'FALHOU E1: permissões das RPCs mudaram';
  end if;
  v_id := public.registrar_disparo_externo('leitura-de-arquivos.yml', 'fulano',
    'https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/999000111', 'ensaio');
  if (select "NO_WORKFLOW" || '/' || "TP_SITUACAO" from public."TL_DISPARO_ROBO" where "CO_DISPARO" = v_id)
     <> 'leitura-de-arquivos.yml/INICIADO' then
    raise exception 'FALHOU E1: a leitura devia ser registrada como INICIADO';
  end if;
  begin
    perform public.registrar_disparo_externo('expurgo-anexos-chat.yml', 'fulano',
      'https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/999000112');
    raise exception 'FALHOU E1: o expurgo (workflow que não existe mais) foi aceito';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok E1';
end;
$$;

-- E2 Execução esperando no grupo -------------------------------------------------------------------
do $$
begin
  if private."FC_EXECUCAO_PENDENTE_NO_GRUPO"('robo-empregare.yml') then
    raise exception 'ENSAIO INTERROMPIDO: já há execução do robô esperando no banco; rode de novo depois.';
  end if;
  insert into public."TL_SYNC_EMPREGARE" ("CO_SYNC", "DT_INICIO", "TP_DISPARO")
  values ('ensaio-robos-robustos-1', now() - interval '10 minutes', 'AGENDA');
  insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "DT_DISPARO", "TP_ORIGEM", "CO_PEDIDO_HTTP", "TP_SITUACAO")
  values ('robo-empregare.yml', now() - interval '12 minutes', 'MANUAL', -1, 'ACEITO');
  if private."FC_EXECUCAO_PENDENTE_NO_GRUPO"('robo-empregare.yml') then
    raise exception 'FALHOU E2: o pedido da própria execução foi contado como fila';
  end if;
  raise notice 'ok E2 sem fila';
end;
$$;

-- E3 disparar_robo como administrador global -------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('ensaio.admin'), 'role', 'authenticated')::text, true);
do $$
begin
  begin
    perform public.disparar_robo('empregare', '{"modo": "anexos", "editais": ["114/2026"]}');
    raise exception 'FALHOU E3: Só anexos do edital congelado passou sem a liberação';
  exception when sqlstate '55000' then
    if sqlerrm not like '%só comparar%' then
      raise exception 'FALHOU E3: mensagem do Só anexos congelado: %', sqlerrm;
    end if;
  end;
  begin
    perform public.disparar_robo('empregare', '{"modo": "anexos", "editais": ["114/2026"], "seco": true, "forcar_congelado": true, "motivo": "Ensaio: comparar"}');
    raise exception 'FALHOU E3: forçar com "só comparar" passou';
  exception when sqlstate '22023' then null;
  end;
  -- "Só comparar" não grava: passa sem liberação. Com liberação e motivo, passa e grava a LIBERACAO.
  perform public.disparar_robo('empregare', '{"modo": "anexos", "editais": ["114/2026"], "seco": true}');
  perform public.disparar_robo('empregare', '{"modo": "anexos", "editais": ["114/2026"], "forcar_congelado": true, "motivo": "Ensaio: reler anexos do congelado"}');
  raise notice 'ok E3 só anexos';
end;
$$;
reset role;
do $$
begin
  if not exists (select 1 from public."TH_CONGELAMENTO_INSCRICAO"
                  where "TP_EVENTO" = 'LIBERACAO' and "DS_MOTIVO" = 'Ensaio: reler anexos do congelado'
                    and "CO_MONITORAMENTO" = current_setting('ensaio.edital')::uuid) then
    raise exception 'FALHOU E3: a liberação do Só anexos não foi gravada';
  end if;
  -- Um pedido aceito depois do início da execução que está rodando: é o que espera a vez.
  insert into public."TL_DISPARO_ROBO" ("NO_WORKFLOW", "DT_DISPARO", "TP_ORIGEM", "CO_PEDIDO_HTTP", "TP_SITUACAO")
  values ('robo-empregare.yml', now() - interval '5 minutes', 'MANUAL', -2, 'ACEITO');
  if not private."FC_EXECUCAO_PENDENTE_NO_GRUPO"('robo-empregare.yml')
     or not private."FC_EXECUCAO_PENDENTE_NO_GRUPO"('leitura-de-arquivos.yml') then
    raise exception 'FALHOU E2: o pedido que espera a vez não foi visto (robô e leitura dividem o grupo)';
  end if;
  raise notice 'ok E2 com fila';
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('ensaio.admin'), 'role', 'authenticated')::text, true);
do $$
begin
  begin
    perform public.disparar_robo('empregare', '{"modo": "seco"}');
    raise exception 'FALHOU E3: pedido com execução esperando no grupo passou';
  exception when sqlstate '55006' then
    if sqlerrm not like '%esperando%' then
      raise exception 'FALHOU E3: recusa errada (%): devia ser a da fila do grupo', sqlerrm;
    end if;
  end;
  raise notice 'ok E3 fila';
end;
$$;
reset role;

-- E4 gravar_anexos_empregare com a trava -----------------------------------------------------------
do $$
declare
  v_vaga text := (select v."CO_VAGA" from public."TB_EMPREGARE_VAGA" v
                   where v."CO_MONITORAMENTO" = current_setting('ensaio.edital')::uuid
                   order by v."CO_VAGA" limit 1);
  v_lib uuid := gen_random_uuid();
  v_r jsonb;
begin
  if v_vaga is null then
    raise exception 'ENSAIO INTERROMPIDO: o 114/2026 não tem vaga em TB_EMPREGARE_VAGA.';
  end if;
  begin
    perform public.gravar_anexos_empregare('ensaio-robos-robustos-1', v_vaga,
      '[{"codigo": "ensaio-sem-candidato", "resposta": "1", "anexos": []}]');
    raise exception 'FALHOU E4: anexos do edital congelado gravados sem a liberação';
  exception when sqlstate '55000' then null;
  end;
  insert into public."TH_CONGELAMENTO_INSCRICAO"
         ("CO_MONITORAMENTO", "TP_EVENTO", "DS_MOTIVO", "CO_USUARIO", "CO_LIBERACAO", "DT_VALIDADE")
  values (current_setting('ensaio.edital')::uuid, 'LIBERACAO', 'Ensaio: anexos com liberação',
          current_setting('ensaio.admin')::uuid, v_lib, now() + interval '1 hour');
  perform public.registrar_uso_liberacao_congelamento(v_lib, 'ensaio-robos-robustos-1');
  v_r := public.gravar_anexos_empregare('ensaio-robos-robustos-1', v_vaga,
    '[{"codigo": "ensaio-sem-candidato", "resposta": "1", "anexos": []}]');
  if (v_r ->> 'sem_candidato')::integer <> 1 then
    raise exception 'FALHOU E4: com a liberação registrada a gravação devia seguir (%)', v_r;
  end if;
  raise notice 'ok E4';
end;
$$;

-- E5 gravar_leituras_de_arquivos com arquivo trocado -----------------------------------------------
do $$
declare
  v_a record;
  v_base jsonb;
  v_r jsonb;
begin
  select a."CO_EMPREGARE_RESPOSTA" as resposta, a."CO_PERGUNTA_EMPREGARE" as pergunta, a."NU_ARQUIVO" as arquivo,
         encode(sha256(convert_to(coalesce(private."FC_ARQUIVO_DO_LINK_EMPREGARE"(a."DS_LINK"), a."DS_LINK"), 'UTF8')), 'hex') as hash_link
    into v_a
    from public."TB_EMPREGARE_ANEXO" a
   order by a."CO_EMPREGARE_RESPOSTA", a."CO_PERGUNTA_EMPREGARE", a."NU_ARQUIVO"
   limit 1;
  if v_a is null then
    raise exception 'ENSAIO INTERROMPIDO: nenhum anexo gravado para ensaiar.';
  end if;
  v_base := jsonb_build_object('resposta', v_a.resposta, 'pergunta', v_a.pergunta, 'arquivo', v_a.arquivo,
                               'situacao', 'ERRO', 'erro', 'ensaio', 'versao', 'ensaio', 'resumo', 'Ensaio');
  v_r := public.gravar_leituras_de_arquivos('ensaio-leitura',
    jsonb_build_array(v_base || jsonb_build_object('hash_link_arquivo', repeat('0', 64))));
  if (v_r ->> 'gravadas')::integer <> 0 or (v_r ->> 'trocadas')::integer <> 1 or (v_r ->> 'fora')::integer <> 1 then
    raise exception 'FALHOU E5: leitura de arquivo trocado (%)', v_r;
  end if;
  v_r := public.gravar_leituras_de_arquivos('ensaio-leitura',
    jsonb_build_array(v_base || jsonb_build_object('hash_link_arquivo', v_a.hash_link), v_base));
  if (v_r ->> 'gravadas')::integer <> 2 or (v_r ->> 'trocadas')::integer <> 0 then
    raise exception 'FALHOU E5: a leitura do arquivo certo e a sem hash_link_arquivo deviam gravar (%)', v_r;
  end if;
  raise notice 'ok E5';
end;
$$;

rollback;
