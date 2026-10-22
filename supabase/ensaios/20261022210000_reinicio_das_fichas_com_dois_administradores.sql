/*
  ENSAIO de 20261022210000_reinicio_das_fichas_com_dois_administradores.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres), com a migration no lugar
  marcado abaixo (sem o begin/commit dela). Nada fica gravado.

  Dados 100% sintéticos, criados dentro da transação (sem gatilhos:
  session_replication_role = replica, para não publicar nada no painel):
    administradores globais A (…2a01) e B (…2a02), analista C (…2a03, sem
    perfil de administrador), e-mails @ensaio.invalid;
    edital E  "Edital 998/2099": 2 CONCLUIDA, 1 EM_ANALISE com lançamento,
              1 PENDENTE intocada, 1 FORA_LOTE;
    edital E2 "Edital 997/2099": 1 EM_ANALISE só atribuída (sem lançamento) e
              1 PENDENTE (nenhuma ficha trabalhada);
    edital E3 "Edital 996/2099": 2 CONCLUIDA, origem MONITORA (encerrado).
  O 114/2026 real não é tocado (confere a contagem antes e depois).

  Reprova (raise exception 'FALHOU …') se:
    R1  a leitura não trouxer o impacto e o número do edital;
    R2  a RPC antiga executar com fichas concluídas, ou não executar no edital
        sem ficha trabalhada;
    R3  o pedido aceitar motivo que não parece texto ou número errado, ou um
        segundo pedido pendente;
    R4  o mesmo administrador aprovar o próprio pedido, ou quem não é
        administrador global aprovar;
    R5  aprovar com o edital congelado (ou a RPC antiga reiniciar congelado);
    R6  aprovar pedido vencido, ou não aceitar novo pedido depois do vencido;
    R7  outro administrador cancelar, ou quem pediu não conseguir;
    R8  a recusa não gravar RECUSADO;
    R9  a aprovação de B não reiniciar o edital E (fichas, pedido EXECUTADO,
        histórico REINICIAR com B e o número do pedido, eventos PEDIR/APROVAR/
        EXECUTAR);
    R10 pedir o reinício de edital encerrado;
    R11 o banco aceitar EXECUTADO aprovado por quem pediu;
    R12 os grants não forem os esperados.
*/
begin;

-- >>> cole aqui a migration 20261022210000 (sem o begin/commit dela) <<<

create temp table r_ensaio (n serial, passo text, saida text) on commit drop;
create temp table r_base on commit drop as
  select count(*) filter (where f."TP_SITUACAO" = 'CONCLUIDA') as concluidas_114, count(*) as fichas_114
    from public."TB_FICHA_ANALISE" f
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id = f."CO_MONITORAMENTO"
   where private."FC_NUMERO_EDITAL"(m.edital) = '114/2026';

create function pg_temp.como(p_usuario text) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', p_usuario, 'role', 'authenticated')::text, true);
$f$;

-- Executa p_sql e exige o erro p_codigo com p_trecho na mensagem.
create function pg_temp.espera_erro(p_passo text, p_sql text, p_codigo text, p_trecho text) returns void
language plpgsql as $f$
begin
  execute p_sql;
  raise exception 'FALHOU %: passou sem erro', p_passo;
exception
  when others then
    if sqlerrm like 'FALHOU%' then raise; end if;
    if sqlstate <> p_codigo or position(p_trecho in sqlerrm) = 0 then
      raise exception 'FALHOU %: esperava % "%", veio % "%"', p_passo, p_codigo, p_trecho, sqlstate, sqlerrm;
    end if;
    insert into r_ensaio (passo, saida) values (p_passo, sqlstate || ' ' || sqlerrm);
end;
$f$;

-- 0. Dados sintéticos -----------------------------------------------------------------------------
set local session_replication_role = replica;
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-4000-a000-000000002a01', 'authenticated', 'authenticated', 'admin-a@ensaio.invalid'),
  ('00000000-0000-4000-a000-000000002a02', 'authenticated', 'authenticated', 'admin-b@ensaio.invalid'),
  ('00000000-0000-4000-a000-000000002a03', 'authenticated', 'authenticated', 'analista-c@ensaio.invalid');
insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
  ('00000000-0000-4000-a000-000000002a01', 'admin-a@ensaio.invalid', 'Ensaio Admin A', 'admin', true),
  ('00000000-0000-4000-a000-000000002a02', 'admin-b@ensaio.invalid', 'Ensaio Admin B', 'admin', true),
  ('00000000-0000-4000-a000-000000002a03', 'analista-c@ensaio.invalid', 'Ensaio Analista C', 'avaliador', true);
insert into public."TB_MONITORAMENTO_INDIGENA" (id, edital, unidade, "CO_AREA") values
  ('00000000-0000-4000-a000-00000000ed01', 'Edital 998/2099 - Ensaio reinício', 'Ensaio', 'projetos'),
  ('00000000-0000-4000-a000-00000000ed02', 'Edital 997/2099 - Ensaio reinício', 'Ensaio', 'projetos'),
  ('00000000-0000-4000-a000-00000000ed03', 'Edital 996/2099 - Ensaio reinício', 'Ensaio', 'projetos');
insert into public."TB_ORIGEM_ANALISE_EDITAL" ("CO_MONITORAMENTO", "TP_ORIGEM") values
  ('00000000-0000-4000-a000-00000000ed01', 'MONITORA'),
  ('00000000-0000-4000-a000-00000000ed03', 'MONITORA');
insert into public."TB_FICHA_ANALISE"
  ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "CO_REGRA_ANALISE", "NU_VERSAO_REGRA", "NU_LOTE", "TP_SITUACAO",
   "CO_USUARIO_RESPONSAVEL", "DT_ATRIBUICAO", "DS_LANCAMENTO", "DS_RESULTADO", "DS_PARECER", "TP_RESULTADO",
   "VL_NOTA_APURADA", "VL_NOTA_FINAL", "CO_USUARIO_CONCLUSAO", "DT_CONCLUSAO", "DS_MOTIVO_SAIDA")
select x.edital::uuid, gen_random_uuid(), '9990001', gen_random_uuid(), 1, 1, x.situacao,
       case when x.situacao in ('CONCLUIDA', 'EM_ANALISE') then '00000000-0000-4000-a000-000000002a03'::uuid end,
       case when x.situacao in ('CONCLUIDA', 'EM_ANALISE') then now() end,
       case when x.situacao = 'CONCLUIDA' or x.lancamento then '{"ensaio": true}'::jsonb end,
       case when x.situacao = 'CONCLUIDA' then '{"ensaio": true}'::jsonb end,
       case when x.situacao = 'CONCLUIDA' then 'Ensaio' end,
       case when x.situacao = 'CONCLUIDA' then 'APTO' end,
       case when x.situacao = 'CONCLUIDA' then 1 end,
       case when x.situacao = 'CONCLUIDA' then 1 end,
       case when x.situacao = 'CONCLUIDA' then '00000000-0000-4000-a000-000000002a03'::uuid end,
       case when x.situacao = 'CONCLUIDA' then now() end,
       case when x.situacao = 'FORA_LOTE' then 'Ensaio' end
  from (values
          ('00000000-0000-4000-a000-00000000ed01', 'CONCLUIDA', false),
          ('00000000-0000-4000-a000-00000000ed01', 'CONCLUIDA', false),
          ('00000000-0000-4000-a000-00000000ed01', 'EM_ANALISE', true),
          ('00000000-0000-4000-a000-00000000ed01', 'PENDENTE', false),
          ('00000000-0000-4000-a000-00000000ed01', 'FORA_LOTE', false),
          ('00000000-0000-4000-a000-00000000ed02', 'EM_ANALISE', false),
          ('00000000-0000-4000-a000-00000000ed02', 'PENDENTE', false),
          ('00000000-0000-4000-a000-00000000ed03', 'CONCLUIDA', false),
          ('00000000-0000-4000-a000-00000000ed03', 'CONCLUIDA', false)) as x(edital, situacao, lancamento);

create temp table r_pedido (nome text primary key, id bigint) on commit drop;

do $$
declare
  c_e constant uuid := '00000000-0000-4000-a000-00000000ed01';
  c_e2 constant uuid := '00000000-0000-4000-a000-00000000ed02';
  c_e3 constant uuid := '00000000-0000-4000-a000-00000000ed03';
  c_a constant text := '00000000-0000-4000-a000-000000002a01';
  c_b constant text := '00000000-0000-4000-a000-000000002a02';
  c_c constant text := '00000000-0000-4000-a000-000000002a03';
  c_motivo constant text := 'A análise foi feita com a regra errada e precisa ser refeita do começo';
  v jsonb;
  v_id bigint;
  v_n integer;
begin
  -- R1. Leitura.
  perform pg_temp.como(c_a);
  v := public.obter_reinicio_fichas_do_edital(c_e)::jsonb;
  if v ->> 'numero' <> '998/2099' or (v -> 'impacto' ->> 'concluidas')::int <> 2
     or (v -> 'impacto' ->> 'com_lancamento')::int <> 1 or (v -> 'impacto' ->> 'iniciadas')::int <> 3
     or not (v -> 'impacto' ->> 'exige_aprovacao')::boolean or v -> 'pedido' <> 'null'::jsonb
     or v -> 'bloqueio' <> 'null'::jsonb then
    raise exception 'FALHOU R1: leitura %', v;
  end if;
  insert into r_ensaio (passo, saida) values ('R1 leitura', v::text);
  perform pg_temp.como(c_c);
  perform pg_temp.espera_erro('R1 leitura sem ser admin', format('select public.obter_reinicio_fichas_do_edital(%L)', c_e), '42501', 'administrador global');

  -- R2. RPC antiga.
  perform pg_temp.como(c_a);
  perform pg_temp.espera_erro('R2 antiga com concluídas',
    format('select public.reiniciar_fichas_do_edital(%L, %L)', c_e, c_motivo), '55000', 'dois administradores');
  v := public.reiniciar_fichas_do_edital(c_e2, c_motivo)::jsonb;
  if (v ->> 'reiniciadas')::int <> 1 then
    raise exception 'FALHOU R2: antiga sem ficha trabalhada %', v;
  end if;
  insert into r_ensaio (passo, saida) values ('R2 antiga sem ficha trabalhada', v::text);

  -- R3. Pedido.
  perform pg_temp.espera_erro('R3 motivo que não parece texto',
    format('select public.pedir_reinicio_fichas_do_edital(%L, %L, %L)', c_e, 'dsdfsdfsfsa fdfdfdfdf', '998/2099'), '22023', '3 palavras');
  perform pg_temp.espera_erro('R3 número errado',
    format('select public.pedir_reinicio_fichas_do_edital(%L, %L, %L)', c_e, c_motivo, '997/2099'), '22023', 'não confere');
  v := public.pedir_reinicio_fichas_do_edital(c_e, c_motivo, '0998 / 2099')::jsonb;
  v_id := (v -> 'pedido' ->> 'id')::bigint;
  if v_id is null or not (v -> 'pedido' ->> 'meu')::boolean or (v -> 'pedido' -> 'impacto' ->> 'concluidas')::int <> 2
     or (v -> 'pedido' -> 'impacto' ->> 'em_analise')::int <> 1 or v -> 'pedido' ->> 'por' <> 'Ensaio Admin A' then
    raise exception 'FALHOU R3: pedido %', v;
  end if;
  if exists (select 1 from public."TB_FICHA_ANALISE" f where f."CO_MONITORAMENTO" = c_e and f."TP_SITUACAO" = 'CONCLUIDA' and f."NU_VERSAO" <> 1)
     or (select count(*) from public."TB_FICHA_ANALISE" f where f."CO_MONITORAMENTO" = c_e and f."TP_SITUACAO" = 'CONCLUIDA') <> 2 then
    raise exception 'FALHOU R3: o pedido mexeu nas fichas';
  end if;
  insert into r_ensaio (passo, saida) values ('R3 pedido', v -> 'pedido' ->> 'id');
  perform pg_temp.espera_erro('R3 segundo pedido',
    format('select public.pedir_reinicio_fichas_do_edital(%L, %L, %L)', c_e, c_motivo, '998/2099'), '55000', 'aguardando aprovação');

  -- R4. Mesmo administrador e quem não é administrador.
  perform pg_temp.espera_erro('R4 mesmo admin aprova',
    format('select public.aprovar_reinicio_fichas_do_edital(%s, %L)', v_id, '998/2099'), '42501', 'outro administrador global');
  perform pg_temp.como(c_c);
  perform pg_temp.espera_erro('R4 não admin aprova',
    format('select public.aprovar_reinicio_fichas_do_edital(%s, %L)', v_id, '998/2099'), '42501', 'administrador global');
  perform pg_temp.como(c_b);
  perform pg_temp.espera_erro('R4 número errado na aprovação',
    format('select public.aprovar_reinicio_fichas_do_edital(%s, %L)', v_id, '114/2026'), '22023', 'não confere');
  v := public.obter_reinicio_fichas_do_edital(c_e)::jsonb;
  if (v -> 'pedido' ->> 'meu')::boolean or v -> 'pedido' ->> 'situacao' <> 'PENDENTE' then
    raise exception 'FALHOU R4: B deveria ver o pedido de A pendente %', v -> 'pedido';
  end if;

  -- R5. Congelado: nem com dois administradores; nem a RPC antiga.
  insert into public."TB_CONGELAMENTO_INSCRICAO" ("CO_MONITORAMENTO", "ST_INSCRICOES_CONGELADAS", "DS_MOTIVO", "CO_USUARIO_ATUALIZACAO")
  values (c_e, 'S', 'Ensaio do reinício congelado', c_a::uuid), (c_e2, 'S', 'Ensaio do reinício congelado', c_a::uuid);
  perform pg_temp.espera_erro('R5 aprovar congelado',
    format('select public.aprovar_reinicio_fichas_do_edital(%s, %L)', v_id, '998/2099'), '55000', 'congeladas');
  perform pg_temp.como(c_a);
  perform pg_temp.espera_erro('R5 antiga congelado',
    format('select public.reiniciar_fichas_do_edital(%L, %L)', c_e2, c_motivo), '55000', 'congeladas');
  if (public.obter_reinicio_fichas_do_edital(c_e)::jsonb ->> 'bloqueio') not like '%congeladas%' then
    raise exception 'FALHOU R5: a leitura não mostra o bloqueio';
  end if;
  delete from public."TB_CONGELAMENTO_INSCRICAO" where "CO_MONITORAMENTO" in (c_e, c_e2);

  -- R6. Vencido.
  update public."TB_PEDIDO_REINICIO_FICHA" set "DT_PEDIDO" = now() - interval '25 hours', "DT_VALIDADE" = now() - interval '1 hour'
   where "CO_PEDIDO_REINICIO" = v_id;
  perform pg_temp.como(c_b);
  perform pg_temp.espera_erro('R6 aprovar vencido',
    format('select public.aprovar_reinicio_fichas_do_edital(%s, %L)', v_id, '998/2099'), '55000', 'venceu');
  if not (public.obter_reinicio_fichas_do_edital(c_e)::jsonb -> 'pedido' ->> 'vencido')::boolean then
    raise exception 'FALHOU R6: a leitura não mostra o vencido';
  end if;
  perform pg_temp.como(c_a);
  v := public.pedir_reinicio_fichas_do_edital(c_e, c_motivo, '998/2099')::jsonb;
  if (select "TP_SITUACAO" from public."TB_PEDIDO_REINICIO_FICHA" where "CO_PEDIDO_REINICIO" = v_id) <> 'VENCIDO'
     or not exists (select 1 from public."TH_PEDIDO_REINICIO_FICHA" h where h."CO_PEDIDO_REINICIO" = v_id and h."TP_EVENTO" = 'VENCER') then
    raise exception 'FALHOU R6: o vencido não foi marcado';
  end if;
  v_id := (v -> 'pedido' ->> 'id')::bigint;
  insert into r_ensaio (passo, saida) values ('R6 novo pedido depois do vencido', v_id::text);

  -- R7. Cancelar.
  perform pg_temp.como(c_b);
  perform pg_temp.espera_erro('R7 outro admin cancela',
    format('select public.cancelar_reinicio_fichas_do_edital(%s)', v_id), '42501', 'Só quem pediu');
  perform pg_temp.como(c_a);
  v := public.cancelar_reinicio_fichas_do_edital(v_id)::jsonb;
  if v -> 'pedido' <> 'null'::jsonb
     or (select "TP_SITUACAO" from public."TB_PEDIDO_REINICIO_FICHA" where "CO_PEDIDO_REINICIO" = v_id) <> 'CANCELADO' then
    raise exception 'FALHOU R7: cancelar %', v;
  end if;
  insert into r_ensaio (passo, saida) values ('R7 cancelado', v_id::text);

  -- R8. Recusar.
  v_id := (public.pedir_reinicio_fichas_do_edital(c_e, c_motivo, '998/2099')::jsonb -> 'pedido' ->> 'id')::bigint;
  perform pg_temp.espera_erro('R8 quem pediu recusa',
    format('select public.recusar_reinicio_fichas_do_edital(%s, %L, null)', v_id, '998/2099'), '42501', 'Cancelar pedido');
  perform pg_temp.como(c_b);
  perform public.recusar_reinicio_fichas_do_edital(v_id, '998/2099', 'Ainda não há decisão da coordenação sobre isso');
  if (select "TP_SITUACAO" || ' ' || "CO_USUARIO_DECISAO" from public."TB_PEDIDO_REINICIO_FICHA" where "CO_PEDIDO_REINICIO" = v_id)
     <> 'RECUSADO ' || c_b then
    raise exception 'FALHOU R8: recusa não gravada';
  end if;
  insert into r_ensaio (passo, saida) values ('R8 recusado', v_id::text);

  -- R9. Outro administrador aprova: executa no edital fictício E.
  perform pg_temp.como(c_a);
  v_id := (public.pedir_reinicio_fichas_do_edital(c_e, c_motivo, '998/2099')::jsonb -> 'pedido' ->> 'id')::bigint;
  perform pg_temp.como(c_b);
  v := public.aprovar_reinicio_fichas_do_edital(v_id, '998/2099')::jsonb;
  if (v -> 'resultado' ->> 'reiniciadas')::int <> 3 or v -> 'reinicio' -> 'pedido' <> 'null'::jsonb
     or (v -> 'reinicio' -> 'impacto' ->> 'iniciadas')::int <> 0 then
    raise exception 'FALHOU R9: aprovar %', v;
  end if;
  select count(*) into v_n from public."TB_FICHA_ANALISE" f
   where f."CO_MONITORAMENTO" = c_e and f."TP_SITUACAO" not in ('PENDENTE', 'FORA_LOTE');
  if v_n <> 0 then raise exception 'FALHOU R9: % ficha(s) não voltaram', v_n; end if;
  if (select "TP_SITUACAO" || ' ' || "CO_USUARIO_DECISAO" || ' ' || "QT_REINICIADAS"
        from public."TB_PEDIDO_REINICIO_FICHA" where "CO_PEDIDO_REINICIO" = v_id) <> 'EXECUTADO ' || c_b || ' 3' then
    raise exception 'FALHOU R9: pedido não ficou EXECUTADO';
  end if;
  select count(*) into v_n from public."TH_FICHA_ANALISE" h
    join public."TB_FICHA_ANALISE" f on f."CO_FICHA_ANALISE" = h."CO_FICHA_ANALISE"
   where f."CO_MONITORAMENTO" = c_e and h."TP_ACAO" = 'REINICIAR' and h."CO_USUARIO" = c_b::uuid
     and h."DS_MOTIVO" like format('Reinício aprovado (pedido nº %s): %%', v_id);
  if v_n <> 3 then raise exception 'FALHOU R9: % histórico(s) REINICIAR', v_n; end if;
  if (select string_agg(h."TP_EVENTO", ',' order by h."CO_EVENTO") from public."TH_PEDIDO_REINICIO_FICHA" h
       where h."CO_PEDIDO_REINICIO" = v_id) <> 'PEDIR,APROVAR,EXECUTAR' then
    raise exception 'FALHOU R9: eventos do pedido';
  end if;
  insert into r_ensaio (passo, saida) values ('R9 aprovado e executado', (v -> 'resultado')::text);

  -- R10. Encerrado.
  perform pg_temp.como(c_a);
  perform pg_temp.espera_erro('R10 pedir encerrado',
    format('select public.pedir_reinicio_fichas_do_edital(%L, %L, %L)', c_e3, c_motivo, '996/2099'), '55000', 'encerrado');

  -- R11. A regra dos dois no próprio dado (gravação direta, fora das RPCs).
  perform pg_temp.espera_erro('R11 EXECUTADO por quem pediu',
    format('insert into public."TB_PEDIDO_REINICIO_FICHA" ("CO_MONITORAMENTO", "TP_SITUACAO", "DS_MOTIVO", "CO_USUARIO_PEDIDO", "DT_VALIDADE", "QT_CONCLUIDAS", "QT_EM_ANALISE", "QT_INICIADAS", "CO_USUARIO_DECISAO", "DT_DECISAO", "QT_REINICIADAS") values (%L, %L, %L, %L, now() + interval %L, 0, 0, 0, %L, now(), 0)',
           c_e2, 'EXECUTADO', c_motivo, c_a, '24 hours', c_a),
    '23514', 'CK_PEDREINFICHA_DECISAO');
end;
$$;

-- R12. Grants.
do $$
declare
  v_f text;
begin
  foreach v_f in array array[
    'public.obter_reinicio_fichas_do_edital(uuid)', 'public.pedir_reinicio_fichas_do_edital(uuid, text, text)',
    'public.aprovar_reinicio_fichas_do_edital(bigint, text)', 'public.recusar_reinicio_fichas_do_edital(bigint, text, text)',
    'public.cancelar_reinicio_fichas_do_edital(bigint)', 'public.reiniciar_fichas_do_edital(uuid, text)'] loop
    if has_function_privilege('anon', v_f, 'execute') or not has_function_privilege('authenticated', v_f, 'execute') then
      raise exception 'FALHOU R12: grant de %', v_f;
    end if;
  end loop;
  foreach v_f in array array[
    'private."FC_REINICIAR_FICHAS_DO_EDITAL"(uuid, text, uuid)', 'private."FC_LER_REINICIO_FICHAS"(uuid, uuid)',
    'private."FC_IMPACTO_REINICIO_FICHAS"(uuid)', 'private."FC_BLOQUEIO_REINICIO_FICHAS"(uuid)',
    'private."FC_CONFIRMACAO_DO_EDITAL"(uuid, text)', 'private."FC_ADMIN_GLOBAL_ATIVO"(uuid)'] loop
    if has_function_privilege('authenticated', v_f, 'execute') or has_function_privilege('anon', v_f, 'execute') then
      raise exception 'FALHOU R12: % não pode ter grant', v_f;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public."TB_PEDIDO_REINICIO_FICHA"', 'select')
     or has_table_privilege('authenticated', 'public."TH_PEDIDO_REINICIO_FICHA"', 'select') then
    raise exception 'FALHOU R12: tabelas abertas a authenticated';
  end if;
  if (select (concluidas_114, fichas_114) from r_base) is distinct from (
        select (count(*) filter (where f."TP_SITUACAO" = 'CONCLUIDA'), count(*))
          from public."TB_FICHA_ANALISE" f
          join public."TB_MONITORAMENTO_INDIGENA" m on m.id = f."CO_MONITORAMENTO"
         where private."FC_NUMERO_EDITAL"(m.edital) = '114/2026') then
    raise exception 'FALHOU: o 114/2026 mudou';
  end if;
  insert into r_ensaio (passo, saida) values ('R12 grants e 114 intacto', (select concluidas_114 || ' concluídas' from r_base));
end;
$$;

select n, passo, saida from r_ensaio order by n;

rollback;
