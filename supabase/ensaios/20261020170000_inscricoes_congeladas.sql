/*
  Ensaio de 20261020170000 (inscrições congeladas e o registro de todos os
  disparos). Sempre termina em rollback; nunca dispara HTTP (a função procura,
  só nesta transação, um nome de segredo que não existe) nem grava candidatos.
  Cole a migration no ponto marcado.

  Reprova se:
    E1  faltar tabela, coluna ou restrição; as tarefas agsus_* que chamam
        FC_DISPARAR_ROBO não passarem p_origem => 'AGENDA';
    E2  FC_DISPARAR_ROBO chamado direto, sem usuário, não gravar MANUAL; com
        p_origem = 'AGENDA' não gravar AGENDA; origem estranha não der 22023;
    E3  com o 114/2026 congelado (como a correção faria): a carga padrão ou
        explícita do robô incluir vaga do 114; o explícito não voltar em
        "congeladas" com pedido; o modo "só anexos" não trouxer as vagas;
    E4  a pré-classificação (pedido, após robô) trouxer o 114; o seco
        (p_incluir_congelados) não o trouxer marcado;
    E5  FC_EMPREGARE_ABRIR_VAGA não recusar a vaga do 114 sem liberação, ou
        recusar com o uso de uma liberação registrado;
    E6  disparar_robo (administrador global) aceitar normal/forçar/refazer lote
        do 114 sem forçar; forçar sem motivo; não gravar a LIBERACAO com o
        CO_DISPARO; recusar o modo anexos ou o seco do 114; quem não coordena
        mudar a trava;
    E7  alterar/obter_congelamento_inscricoes não funcionarem para o
        administrador global (congelar → 55000 repetido → liberar);
    E8  registrar_disparo_externo não gravar GITHUB/INICIADO com o ator, duplicar
        a mesma execução, aceitar endereço estranho; get_saude_das_cargas não
        trouxer o ator.
*/
begin;

-- >>> cole aqui supabase/migrations/20261020170000_inscricoes_congeladas.sql (sem o begin/commit) <<<

select set_config('ensaio.edital', 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0', true);
select set_config('ensaio.admin', (
  select p.user_id::text from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo is true and a."ST_ADMIN_GLOBAL" and p.user_id is not null
   order by p.user_id limit 1), true);
select set_config('agsus.segredo_disparo_robos', 'github_disparo_robos_ausente_no_ensaio', true);

-- E1 Estrutura e tarefas -------------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_CONGELAMENTO_INSCRICAO"') is null or to_regclass('public."TH_CONGELAMENTO_INSCRICAO"') is null then
    raise exception 'FALHOU E1: faltam as tabelas da trava';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_name = 'TL_DISPARO_ROBO' and column_name = 'NO_ATOR_GITHUB') then
    raise exception 'FALHOU E1: falta NO_ATOR_GITHUB';
  end if;
  if exists (select 1 from cron.job where command like '%private."FC_DISPARAR_ROBO"(%' and command not like '%p_origem => ''AGENDA''%') then
    raise exception 'FALHOU E1: tarefa sem p_origem';
  end if;
  if has_function_privilege('authenticated', 'public.registrar_disparo_externo(text, text, text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.registrar_uso_liberacao_congelamento(uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.obter_congelamento_inscricoes(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.alterar_congelamento_inscricoes(uuid, boolean, text)', 'execute')
     or not has_function_privilege('service_role', 'public.listar_vagas_empregare(text[], text[], integer, text, uuid)', 'execute') then
    raise exception 'FALHOU E1: permissões';
  end if;
  if exists (select 1 from vault.secrets where name = 'github_disparo_robos_ausente_no_ensaio') then
    raise exception 'ENSAIO INTERROMPIDO: o nome alternativo existe no Vault.';
  end if;
  raise notice 'ok E1';
end;
$$;

-- E2 Origem dos pedidos ---------------------------------------------------------------------------
do $$
declare
  v_id bigint;
  v_antes bigint := (select count(*) from net.http_request_queue);
begin
  v_id := private."FC_DISPARAR_ROBO"('conferencias.yml', '{"modo": "seco"}');
  if (select "TP_ORIGEM" || '/' || "TP_SITUACAO" from public."TL_DISPARO_ROBO" where "CO_DISPARO" = v_id) <> 'MANUAL/SEM_TOKEN' then
    raise exception 'FALHOU E2: SQL direto devia ser MANUAL';
  end if;
  v_id := private."FC_DISPARAR_ROBO"('conferencias.yml', '{"modo": "seco"}', p_origem => 'AGENDA');
  if (select "TP_ORIGEM" from public."TL_DISPARO_ROBO" where "CO_DISPARO" = v_id) <> 'AGENDA' then
    raise exception 'FALHOU E2: a tarefa devia ser AGENDA';
  end if;
  begin
    perform private."FC_DISPARAR_ROBO"('conferencias.yml', '{}', null, 'MONITORA');
    raise exception 'FALHOU E2: origem estranha passou';
  exception when sqlstate '22023' then null;
  end;
  if (select count(*) from net.http_request_queue) <> v_antes then
    raise exception 'FALHOU E2: houve pedido HTTP';
  end if;
  raise notice 'ok E2';
end;
$$;

-- O 114/2026 congelado, como a correção faz.
insert into public."TB_CONGELAMENTO_INSCRICAO" ("CO_MONITORAMENTO", "ST_INSCRICOES_CONGELADAS", "DS_MOTIVO", "CO_USUARIO_ATUALIZACAO")
values (current_setting('ensaio.edital')::uuid, 'S', 'Ensaio: inscrições encerradas em 14/10.', 'a01afddb-f64b-47d9-80e8-476a1ed14e43');

-- E3 Robô: carga e só anexos -----------------------------------------------------------------------
do $$
declare
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v jsonb;
  t0 timestamptz := clock_timestamp();
begin
  v := public.listar_vagas_empregare(null, null, 500);
  if exists (select 1 from jsonb_array_elements(v -> 'vagas') x where (x ->> 'edital_id')::uuid = v_edital) then
    raise exception 'FALHOU E3: a carga padrão trouxe vaga do 114';
  end if;
  raise notice 'E3 padrão: % vagas, congeladas %, % ms', jsonb_array_length(v -> 'vagas'), v -> 'congeladas',
    round(extract(epoch from clock_timestamp() - t0) * 1000);
  v := public.listar_vagas_empregare(array['114/2026'], null, 60);
  if jsonb_array_length(v -> 'vagas') <> 0
     or not coalesce((v #>> '{congeladas,0,pedido}')::boolean, false)
     or (v #>> '{congeladas,0,vagas}')::int < 1 then
    raise exception 'FALHOU E3: o explícito do 114 devia voltar só em congeladas: %', v - 'vagas';
  end if;
  v := public.listar_vagas_empregare(null, array[(select "CO_VAGA" from public."TB_EMPREGARE_VAGA" where "CO_MONITORAMENTO" = v_edital order by 1 limit 1)], 60);
  if jsonb_array_length(v -> 'vagas') <> 0 or jsonb_array_length(v -> 'congeladas') <> 1 then
    raise exception 'FALHOU E3: a vaga explícita do 114 devia ser recusada';
  end if;
  v := public.listar_vagas_empregare(array['114/2026'], null, 60, 'anexos');
  if jsonb_array_length(v -> 'vagas') < 1 or jsonb_array_length(v -> 'congeladas') <> 0
     or not coalesce((v #>> '{vagas,0,congelada}')::boolean, false) then
    raise exception 'FALHOU E3: o modo só anexos devia trazer as vagas do 114';
  end if;
  begin
    perform public.listar_vagas_empregare(null, null, 60, 'outra');
    raise exception 'FALHOU E3: finalidade estranha passou';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok E3';
end;
$$;

-- E4 Pré-classificação ----------------------------------------------------------------------------
do $$
declare
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v jsonb;
begin
  v := public.pre_classificacao_ler_editais(array[v_edital::text]);
  if jsonb_array_length(v -> 'editais') <> 0
     or (v #>> '{congelados,0,id}')::uuid is distinct from v_edital
     or not (v #>> '{congelados,0,pedido}')::boolean then
    raise exception 'FALHOU E4: o 114 pedido devia voltar em congelados';
  end if;
  v := public.pre_classificacao_ler_editais(null, false);
  if exists (select 1 from jsonb_array_elements(v -> 'editais') x where (x ->> 'id')::uuid = v_edital) then
    raise exception 'FALHOU E4: os ativos trouxeram o 114';
  end if;
  v := public.pre_classificacao_ler_editais(array['114/2026'], false, true);
  if not coalesce((v #>> '{editais,0,congelado}')::boolean, false) or jsonb_array_length(v -> 'congelados') <> 0 then
    raise exception 'FALHOU E4: o seco devia trazer o 114 marcado';
  end if;
  raise notice 'ok E4';
end;
$$;

-- E5 A trava de raiz na gravação ------------------------------------------------------------------
do $$
declare
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v_vaga text := (select "CO_VAGA" from public."TB_EMPREGARE_VAGA" where "CO_MONITORAMENTO" = v_edital order by 1 limit 1);
  v_lib uuid := gen_random_uuid();
  v_sit text;
  v jsonb;
begin
  insert into public."TL_SYNC_EMPREGARE" ("CO_SYNC", "TP_SITUACAO", "TP_DISPARO", "ST_FORCADA", "DS_FILTRO",
         "QT_VAGA_PEDIDA", "QT_VAGA_BAIXADA", "QT_VAGA_FALHA", "QT_VAGA_RECUSADA", "QT_LINHA", "QT_DESATIVADA")
  values ('ensaio-congelada-1', 'EM_ANDAMENTO', 'GITHUB', 'N', '{}', 1, 0, 0, 0, 0, 0),
         ('ensaio-congelada-2', 'EM_ANDAMENTO', 'GITHUB', 'N', '{}', 1, 0, 0, 0, 0, 0);
  v_sit := private."FC_EMPREGARE_ABRIR_VAGA"('ensaio-congelada-1', v_vaga, 100000);
  if v_sit <> 'RECUSADA'
     or (select "DS_MENSAGEM" from public."TB_EMPREGARE_VAGA" where "CO_VAGA" = v_vaga) not like 'Inscrições congeladas%'
     or (select "QT_VAGA_RECUSADA" from public."TL_SYNC_EMPREGARE" where "CO_SYNC" = 'ensaio-congelada-1') <> 1 then
    raise exception 'FALHOU E5: a vaga do 114 devia ser RECUSADA (veio %)', v_sit;
  end if;
  -- Com a liberação usada pela execução: abre (p_total grande para não cair na trava da metade).
  insert into public."TH_CONGELAMENTO_INSCRICAO" ("CO_MONITORAMENTO", "TP_EVENTO", "DS_MOTIVO", "CO_USUARIO", "CO_LIBERACAO", "DT_VALIDADE")
  values (v_edital, 'LIBERACAO', 'Ensaio: override do administrador.', current_setting('ensaio.admin')::uuid, v_lib, now() + interval '1 hour');
  v := public.registrar_uso_liberacao_congelamento(v_lib, 'ensaio-congelada-2');
  if v -> 'editais' ->> 0 <> '114/2026' then
    raise exception 'FALHOU E5: uso da liberação não registrado: %', v;
  end if;
  perform public.registrar_uso_liberacao_congelamento(v_lib, 'ensaio-congelada-2');
  if (select count(*) from public."TH_CONGELAMENTO_INSCRICAO" where "CO_EXECUCAO" = 'ensaio-congelada-2') <> 1 then
    raise exception 'FALHOU E5: o uso duplicou';
  end if;
  v_sit := private."FC_EMPREGARE_ABRIR_VAGA"('ensaio-congelada-2', v_vaga, 100000);
  if v_sit <> 'EM_CARGA' then
    raise exception 'FALHOU E5: com a liberação a vaga devia abrir (veio %)', v_sit;
  end if;
  if jsonb_array_length(public.listar_vagas_empregare(array['114/2026'], null, 60, 'carga', v_lib) -> 'vagas') < 1
     or jsonb_array_length(public.pre_classificacao_ler_editais(array['114/2026'], false, false, v_lib) -> 'editais') <> 1 then
    raise exception 'FALHOU E5: a liberação devia incluir o 114 na lista';
  end if;
  raise notice 'ok E5';
end;
$$;

-- E6 disparar_robo como administrador global ------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('ensaio.admin'), 'role', 'authenticated')::text, true);
do $$
declare
  v_id bigint;
begin
  foreach v_id in array array[1, 2, 3] loop
    begin
      perform public.disparar_robo(
        case v_id when 3 then 'pre_classificacao' else 'empregare' end,
        case v_id
          when 1 then '{"modo": "normal", "editais": ["114/2026"]}'
          when 2 then '{"modo": "forcar", "editais": "114/2026"}'
          else jsonb_build_object('modo', 'refazer_lote', 'editais', jsonb_build_array(current_setting('ensaio.edital')))
        end::jsonb);
      raise exception 'FALHOU E6: pedido % do 114 passou sem forçar', v_id;
    exception when sqlstate '55000' then null;
    end;
  end loop;
  begin
    perform public.disparar_robo('empregare', '{"modo": "normal", "editais": ["114/2026"], "forcar_congelado": true}');
    raise exception 'FALHOU E6: forçar sem motivo passou';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.disparar_robo('empregare', '{"modo": "seco", "editais": ["114/2026"], "forcar_congelado": true, "motivo": "Ensaio do override"}');
    raise exception 'FALHOU E6: forçar no seco passou';
  exception when sqlstate '22023' then null;
  end;
  -- O modo anexos e o seco do 114 continuam.
  perform public.disparar_robo('empregare', '{"modo": "anexos", "editais": ["114/2026"]}');
  perform public.disparar_robo('pre_classificacao', jsonb_build_object('modo', 'seco', 'editais', jsonb_build_array(current_setting('ensaio.edital'))));
  raise notice 'ok E6 recusas';
end;
$$;
reset role;
-- O override (o duplo clique de 2 min só conta PEDIDO/ACEITO; aqui é SEM_TOKEN).
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('ensaio.admin'), 'role', 'authenticated')::text, true);
create temp table t_override as
select public.disparar_robo('empregare',
  '{"modo": "normal", "editais": ["114/2026"], "forcar_congelado": true, "motivo": "Ensaio: recarga autorizada"}') as id;
reset role;
do $$
declare
  v_id bigint := (select id from t_override);
begin
  if not exists (select 1 from public."TH_CONGELAMENTO_INSCRICAO"
                  where "TP_EVENTO" = 'LIBERACAO' and "CO_DISPARO" = v_id
                    and "CO_USUARIO" = current_setting('ensaio.admin')::uuid
                    and "DT_VALIDADE" > now() + interval '11 hours') then
    raise exception 'FALHOU E6: a LIBERACAO devia ter o CO_DISPARO %', v_id;
  end if;
  if (select "TP_ORIGEM" from public."TL_DISPARO_ROBO" where "CO_DISPARO" = v_id) <> 'MONITORA' then
    raise exception 'FALHOU E6: origem do Rodar agora devia ser MONITORA';
  end if;
  raise notice 'ok E6 override';
end;
$$;

-- Quem não é administrador global nem coordena: não muda a trava.
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-a000-0000000000e6', 'role', 'authenticated')::text, true);
do $$
begin
  begin
    perform public.alterar_congelamento_inscricoes(current_setting('ensaio.edital')::uuid, false, 'Ensaio: quem não pode');
    raise exception 'FALHOU E6: quem não coordena mudou a trava';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'ok E6 permissão';
end;
$$;
reset role;

-- E7 Ler e mudar a trava (administrador global) ---------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('ensaio.admin'), 'role', 'authenticated')::text, true);
do $$
declare
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v json;
begin
  v := public.obter_congelamento_inscricoes(v_edital);
  if not (v ->> 'congelado')::boolean or not (v ->> 'pode_alterar')::boolean then
    raise exception 'FALHOU E7: obter devia dizer congelado e pode_alterar: %', v;
  end if;
  begin
    perform public.alterar_congelamento_inscricoes(v_edital, true, 'Ensaio: congelar de novo');
    raise exception 'FALHOU E7: congelar o congelado passou';
  exception when sqlstate '55000' then null;
  end;
  begin
    perform public.alterar_congelamento_inscricoes(v_edital, false, 'curto');
    raise exception 'FALHOU E7: motivo curto passou';
  exception when sqlstate '22023' then null;
  end;
  v := public.alterar_congelamento_inscricoes(v_edital, false, 'Ensaio: liberar as inscrições');
  if (v ->> 'congelado')::boolean or v -> 'historico' -> 0 ->> 'tipo' <> 'DESCONGELAR' then
    raise exception 'FALHOU E7: liberar não gravou: %', v;
  end if;
  v := public.alterar_congelamento_inscricoes(v_edital, true, 'Ensaio: congelar de novo');
  if not (v ->> 'congelado')::boolean then
    raise exception 'FALHOU E7: congelar não gravou';
  end if;
  raise notice 'ok E7';
end;
$$;
reset role;

-- E8 Execução iniciada direto no GitHub ------------------------------------------------------------
do $$
declare
  v_id bigint;
  v_url constant text := 'https://github.com/AgSUS-COGIP/agsus-monitora/actions/runs/123456789';
begin
  v_id := public.registrar_disparo_externo('robo-empregare.yml', 'fulano-da-silva', v_url, 'modo normal · editais 114/2026');
  if (select "TP_ORIGEM" || '/' || "TP_SITUACAO" || '/' || "NO_ATOR_GITHUB" from public."TL_DISPARO_ROBO" where "CO_DISPARO" = v_id)
     <> 'GITHUB/INICIADO/fulano-da-silva' then
    raise exception 'FALHOU E8: registro externo';
  end if;
  if public.registrar_disparo_externo('robo-empregare.yml', 'fulano-da-silva', v_url) <> v_id then
    raise exception 'FALHOU E8: a mesma execução duplicou';
  end if;
  if (select "NO_ATOR_GITHUB" from public."TL_DISPARO_ROBO"
       where "CO_DISPARO" = public.registrar_disparo_externo('pre-classificacao.yml', 'x; drop', v_url || '0')) is not null then
    raise exception 'FALHOU E8: ator estranho devia virar nulo';
  end if;
  begin
    perform public.registrar_disparo_externo('robo-empregare.yml', 'a', 'https://example.com/x');
    raise exception 'FALHOU E8: endereço estranho passou';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok E8 registro';
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('ensaio.admin'), 'role', 'authenticated')::text, true);
do $$
declare
  v json := public.get_saude_das_cargas();
begin
  if not exists (select 1 from json_array_elements(v -> 'agenda_dos_robos' -> 'disparos') d
                  where d ->> 'ator' = 'fulano-da-silva' and d ->> 'origem' = 'GITHUB' and d ->> 'execucao' like 'https://github.com/%') then
    raise exception 'FALHOU E8: get_saude_das_cargas sem o ator';
  end if;
  raise notice 'ok E8 status';
end;
$$;
reset role;

rollback;
