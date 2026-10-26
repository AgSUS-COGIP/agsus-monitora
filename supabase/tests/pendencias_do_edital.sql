-- Teste das RPCs das pendências do edital (migration 20261026190000), com dados FICTÍCIOS numa lista
-- vigente real e as identidades que existem: uma pessoa com a permissão "aprovados_pendencias" pelo
-- grupo (o Gestor, valor inicial Editor), um usuário comum (perfil usuario: leitor em Aprovados, sem a
-- permissão) com a mesma área e um administrador global. A permissão vem da matriz de Acessos.
-- Tudo em begin … rollback: nada fica. Reprova (raise exception) no primeiro resultado errado; no fim,
-- um json só com verdadeiro/falso e contagens. O pedido do job fica sem chave (agsus.segredo_disparo_robos).
--   permissão: sem a permissão, recusado (42501); com a permissão concedida (pelo grupo ou pela
--   exceção da pessoa na matriz), decide; com a do grupo tirada pela exceção, recusado; o administrador
--   global decide em todo edital e lê toda área, sem depender do recorte nem da matriz (private.is_master);
--   motivo obrigatório (22023); pendência resolvida não se decide de novo (55000);
--   cada decisão: status pelo histórico do status (autor), histórico da pendência (motivo, autor,
--   antes/depois), pendência resolvida, contratados do edital recalculados e caso do aviso fechado;
--   o job: só service_role; empate confirmado não volta; resolvida antes da leitura reabre.
begin;

set local agsus.segredo_disparo_robos = 'ensaio-sem-chave';

create temporary table t_teste (chave text primary key, valor jsonb) on commit drop;

do $$
declare
  v_admin record;
  v_gestor record;
  v_usuario record;
  v_lista record;
  v_pend uuid;
  v_r jsonb;
  v_aviso uuid;
  v_exec text;

begin
  -- As identidades: o administrador global mais antigo, um Gestor (permissão pelo grupo) e um usuário comum.
  select p.user_id, p.email into v_admin
    from public."TB_PERFIL_USUARIO" p join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo and p.user_id is not null and g."ST_ADMIN_GLOBAL" order by p.created_at limit 1;
  if v_admin.user_id is null then raise exception 'Teste sem administrador global'; end if;

  -- A lista: vigente e ativa de um edital fora do treinamento que um Gestor vê e um usuário comum
  -- também (mesma área).
  for v_gestor in
    select p.user_id, p.email from public."TB_PERFIL_USUARIO" p
     where p.ativo and p.user_id is not null and p.perfil = 'edital_gestor' order by p.created_at
  loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_gestor.user_id, 'email', v_gestor.email, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_gestor.user_id::text, true);
    select l.id, l.edital_id::uuid as edital, m."CO_AREA" as area into v_lista
      from public."TB_LISTA_APROVADO" l
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
     where l.vigente and l.ativo and m.ativo and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
       and private."FC_PODE_DECIDIR_PENDENCIA"(m.id)
     order by l.importado_em desc limit 1;
    exit when v_lista.id is not null;
  end loop;
  if v_lista.id is null then raise exception 'Teste sem Gestor com lista ativa no recorte'; end if;

  for v_usuario in
    select p.user_id, p.email from public."TB_PERFIL_USUARIO" p
     where p.ativo and p.user_id is not null and p.perfil = 'usuario' order by p.created_at
  loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_usuario.user_id, 'email', v_usuario.email, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', v_usuario.user_id::text, true);
    exit when private."FC_PODE_VER_EDITAL"(v_lista.edital);
  end loop;
  if v_usuario.user_id is null or not private."FC_PODE_VER_EDITAL"(v_lista.edital) then
    raise exception 'Teste sem usuário comum com o edital no recorte';
  end if;
  insert into t_teste values ('usuario_le_mas_nao_decide',
    to_jsonb(private.pode_recurso('aprovados', 1) and not private.pode_recurso('aprovados_pendencias', 2)
             and not private."FC_PODE_DECIDIR_PENDENCIA"(v_lista.edital)));

  -- As linhas fictícias (nomes e matrículas inventados), na lista escolhida.
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  insert into public."TB_CANDIDATO_APROVADO" (
    id, lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade, status, matricula,
    "DT_CONVOCACAO", created_by, updated_by)
  select gen_random_uuid(), v_lista.id, x.vaga, 'Cargo fictício', x.pos, 50, x.nome, x.modalidade, x.status, x.mat,
         x.dt, v_admin.user_id, v_admin.user_id
    from (values
      -- 1-2: Contratado em duas listas (mesma matrícula, ampla e cota)
      (1, 'ENSAIO-PEND-1', 7001, 'Pessoa Ficticia Um', 'Ampla Concorrência', 'Contratado', 'ENS-0001', null::date),
      (2, 'ENSAIO-PEND-2', 7001, 'Pessoa Ficticia Um', 'Pessoas Pretas e Pardas', 'Contratado', 'ENS-0001', null),
      -- 3-5: Contratado com duas matrículas (3 e 4 a mesma, 5 outra)
      (3, 'ENSAIO-PEND-3', 7002, 'Pessoa Ficticia Dois', 'Ampla Concorrência', 'Contratado', 'ENS-0002', null),
      (4, 'ENSAIO-PEND-4', 7002, 'Pessoa Ficticia Dois', 'Pessoas Pretas e Pardas', 'Contratado', 'ENS-0002', null),
      (5, 'ENSAIO-PEND-5', 7002, 'Pessoa Ficticia Dois', 'Ampla Concorrência', 'Contratado', 'ENS-0003', null),
      -- 6-7: pessoa repetida (6 com status, 7 sem)
      (6, 'ENSAIO-PEND-6', 7003, 'Pessoa Ficticia Tres', 'Ampla Concorrência', 'Desistente', null, null),
      (7, 'ENSAIO-PEND-6', 7004, 'Pessoa Ficticia Tres', 'Ampla Concorrência', null, null, null),
      -- 8-9: posição repetida
      (8, 'ENSAIO-PEND-8', 7005, 'Pessoa Ficticia Quatro', 'Ampla Concorrência', null, null, null),
      (9, 'ENSAIO-PEND-8', 7005, 'Pessoa Ficticia Cinco', 'Ampla Concorrência', null, null, null),
      -- 10-11: posição repetida (empate previsto)
      (10, 'ENSAIO-PEND-10', 7006, 'Pessoa Ficticia Seis', 'Ampla Concorrência', null, null, null),
      (11, 'ENSAIO-PEND-10', 7006, 'Pessoa Ficticia Sete', 'Ampla Concorrência', null, null, null),
      -- 12: Convocado há 40 dias
      (12, 'ENSAIO-PEND-12', 7007, 'Pessoa Ficticia Oito', 'Ampla Concorrência', 'Convocado', null,
       ((now() at time zone 'America/Sao_Paulo')::date - 40))
    ) as x(n, vaga, pos, nome, modalidade, status, mat, dt)
   order by x.n;
  create temporary table t_linha on commit drop as
    select c.id, c.codigo_vaga, c.classificacao, c.modalidade, c.status, c.matricula, c.nome
      from public."TB_CANDIDATO_APROVADO" c
     where c.lista_id = v_lista.id and c.codigo_vaga like 'ENSAIO-PEND-%';

  -- O AMBIGUO do job "Contratado em outra lista" para 1 e 2 (como o job grava).
  insert into public."TB_CONTRATACAO_APROVADO" (
    "CO_CANDIDATO_APROVADO", "CO_MONITORAMENTO", "DS_VINCULO", "TP_SITUACAO", "TP_MOTIVO", "DS_MOTIVO", "DS_BASE",
    "NU_VERSAO_REGRA", "CO_EXECUCAO")
  select t.id, v_lista.edital, private."FC_VINCULO_DA_MATRICULA"('ENS-0001'), 'AMBIGUO', 'NENHUMA_ALCANCADA',
         'Ensaio.', (select string_agg(y.id::text, ',' order by y.id::text) from t_linha y where y.matricula = 'ENS-0001'),
         1, 'contr-20261026T000000-00000e5a'
    from t_linha t where t.matricula = 'ENS-0001';

  -- Um aviso de conferência aberto com o caso do Convocado (o que a conferência grava).
  select a."CO_EXECUCAO" into v_exec from public."TB_AVISO_CONFERENCIA" a limit 1;
  if v_exec is null then
    v_exec := 'conf-20261026T000000-00000e5a';
    insert into public."TL_CONFERENCIA" ("CO_EXECUCAO", "TP_DISPARO") values (v_exec, 'GITHUB');
  end if;
  insert into public."TB_AVISO_CONFERENCIA" (
    "CO_CONFERENCIA", "DS_ESCOPO", "TP_GRAVIDADE", "CO_MODULO", "CO_AREA", "CO_MONITORAMENTO", "QT_OCORRENCIA",
    "DS_EXEMPLO", "DS_RESUMO", "CO_EXECUCAO")
  values ('APROVADOS_CONVOCADO_SEM_DESFECHO', 'edital:ensaio-pendencias', 'ATENCAO', 'aprovados', v_lista.area,
          v_lista.edital, 1, '[]'::jsonb, 'Ensaio.', v_exec)
  returning "CO_AVISO_CONFERENCIA" into v_aviso;
  insert into public."TB_CASO_AVISO_CONFERENCIA" ("CO_AVISO_CONFERENCIA", "NU_CASO", "DS_REFERENCIA", "TP_REFERENCIA")
  select v_aviso, 1, t.id::text, 'candidato_aprovado' from t_linha t where t.status = 'Convocado';

  -- O job grava o instantâneo (aqui, só as fictícias; as chaves como o Python faz).
  v_r := public.gravar_pendencias_do_edital('pend-20261026T000000-00000e5a', now(), (
    select jsonb_agg(jsonb_build_object('tipo', g.tipo, 'edital', v_lista.edital,
             'chave', left(encode(sha256(convert_to('ensaio|' || g.tipo || '|' || g.k, 'UTF8')), 'hex'), 40),
             'candidatos', g.ids, 'detalhe', g.detalhe))
      from (
        select 'CONTRATADO_EM_DUAS_LISTAS' tipo, 'a' k,
               (select jsonb_agg(id) from t_linha where matricula = 'ENS-0001') ids, '{"motivo": "NENHUMA_ALCANCADA"}'::jsonb detalhe
        union all select 'CONTRATADO_DUAS_MATRICULAS', 'b',
               (select jsonb_agg(id) from t_linha where nome = 'Pessoa Ficticia Dois'), '{"vinculos": 2}'
        union all select 'PESSOA_REPETIDA', 'c', (select jsonb_agg(id) from t_linha where nome = 'Pessoa Ficticia Tres'), '{}'
        union all select 'POSICAO_REPETIDA', 'd', (select jsonb_agg(id) from t_linha where codigo_vaga = 'ENSAIO-PEND-8'), '{"posicao": 7005}'
        union all select 'POSICAO_REPETIDA', 'e', (select jsonb_agg(id) from t_linha where codigo_vaga = 'ENSAIO-PEND-10'), '{"posicao": 7006}'
        union all select 'CONVOCADO_SEM_DESFECHO', 'f', (select jsonb_agg(id) from t_linha where status = 'Convocado'), '{"dias": 40}'
      ) g));
  insert into t_teste values ('job_grava_6_novas', to_jsonb((v_r ->> 'novas')::integer = 6));
  insert into t_teste values ('job_so_service_role', to_jsonb(
    not has_function_privilege('authenticated', 'public.gravar_pendencias_do_edital(text, timestamptz, jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.pendencias_ler_aprovados()', 'execute')
    and has_function_privilege('service_role', 'public.gravar_pendencias_do_edital(text, timestamptz, jsonb)', 'execute')
    and has_function_privilege('service_role', 'public.pendencias_ler_aprovados()', 'execute')
    and not has_function_privilege('anon', 'public.listar_pendencias_do_edital(text, uuid)', 'execute')
    and not has_table_privilege('authenticated', 'public."TB_PENDENCIA_APROVADO"', 'select')
    and not has_table_privilege('authenticated', 'public."TH_PENDENCIA_APROVADO"', 'select')));

  -- ── Usuário comum, sem a permissão: lê, não decide ──
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_usuario.user_id, 'email', v_usuario.email, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_usuario.user_id::text, true);
  v_r := public.listar_pendencias_do_edital(v_lista.area, v_lista.edital);
  insert into t_teste values ('usuario_ve_6_sem_controle', to_jsonb(
    jsonb_array_length(v_r -> 'pendencias') = 6
    and not exists (select 1 from jsonb_array_elements(v_r -> 'pendencias') p where (p ->> 'pode_decidir')::boolean)));
  select p."CO_PENDENCIA_APROVADO" into v_pend from public."TB_PENDENCIA_APROVADO" p
   where p."TP_PENDENCIA" = 'CONTRATADO_EM_DUAS_LISTAS' and p."CO_MONITORAMENTO" = v_lista.edital;
  begin
    perform public.escolher_lista_da_contratacao(v_pend, (select id from t_linha where codigo_vaga = 'ENSAIO-PEND-1'),
                                                 'Decisão de teste');
    raise exception 'Usuário comum decidiu a pendência';
  exception when insufficient_privilege then
    insert into t_teste values ('usuario_recusado_42501', 'true');
  end;

  -- ── Gestor, com a permissão pelo grupo: motivo obrigatório, depois decide ──
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_gestor.user_id, 'email', v_gestor.email, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_gestor.user_id::text, true);
  begin
    perform public.escolher_lista_da_contratacao(v_pend, (select id from t_linha where codigo_vaga = 'ENSAIO-PEND-1'), '  ');
    raise exception 'Decidiu sem motivo';
  exception when invalid_parameter_value then
    insert into t_teste values ('motivo_obrigatorio_22023', 'true');
  end;
  v_r := public.escolher_lista_da_contratacao(v_pend, (select id from t_linha where codigo_vaga = 'ENSAIO-PEND-1'),
                                              'Contratada pela ampla, conforme o processo SEI');
  insert into t_teste values ('gestor_escolhe_lista', to_jsonb(
    (select c.status from public."TB_CANDIDATO_APROVADO" c join t_linha t on t.id = c.id where t.codigo_vaga = 'ENSAIO-PEND-1') = 'Contratado'
    and (select c.status from public."TB_CANDIDATO_APROVADO" c join t_linha t on t.id = c.id where t.codigo_vaga = 'ENSAIO-PEND-2') = 'Contratado em outra lista'
    and (select c.matricula from public."TB_CANDIDATO_APROVADO" c join t_linha t on t.id = c.id where t.codigo_vaga = 'ENSAIO-PEND-2') = 'ENS-0001'
    and exists (select 1 from public."TH_CANDIDATO_APROVADO" h join t_linha t on t.id = h.candidato_id
                 where t.codigo_vaga = 'ENSAIO-PEND-2' and h.status_novo = 'Contratado em outra lista'
                   and h.alterado_por = v_gestor.user_id)
    and not exists (select 1 from public."TB_CONTRATACAO_APROVADO" x join t_linha t on t.id = x."CO_CANDIDATO_APROVADO")
    and (select p."TP_SITUACAO" = 'RESOLVIDA' and p."TP_DECISAO" = 'LISTA_ESCOLHIDA'
                and p."CO_USUARIO_DECISAO" = v_gestor.user_id and p."DS_MOTIVO_DECISAO" like 'Contratada pela ampla%'
           from public."TB_PENDENCIA_APROVADO" p where p."CO_PENDENCIA_APROVADO" = v_pend)
    and (select count(*) = 1 from public."TH_PENDENCIA_APROVADO" h
          where h."CO_PENDENCIA_APROVADO" = v_pend and h."TP_EVENTO" = 'DECISAO' and h."CO_USUARIO" = v_gestor.user_id
            and jsonb_array_length(h."DS_ALTERACAO") = 1 and h."DS_ALTERACAO" -> 0 ->> 'antes' = 'Contratado'
            and h."DS_ALTERACAO" -> 0 ->> 'depois' = 'Contratado em outra lista')
    and (v_r ->> 'contratados')::integer = (
      select count(*) from public."TB_CANDIDATO_APROVADO" c
        join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente
       where l.edital_id = v_lista.edital::text and c.removido_em is null
         and c.status in ('Contratado', 'Migração') and not private."FC_EM_OUTRA_LISTA"(c.id))));
  begin
    perform public.escolher_lista_da_contratacao(v_pend, (select id from t_linha where codigo_vaga = 'ENSAIO-PEND-1'),
                                                 'De novo');
    raise exception 'Decidiu a pendência resolvida';
  exception when object_not_in_prerequisite_state then
    insert into t_teste values ('resolvida_nao_decide_55000', 'true');
  end;

  -- Duas matrículas: a 3 vale; a 4 (mesma matrícula) em outra lista; a 5 (outra) Desistente.
  select p."CO_PENDENCIA_APROVADO" into v_pend from public."TB_PENDENCIA_APROVADO" p
   where p."TP_PENDENCIA" = 'CONTRATADO_DUAS_MATRICULAS' and p."CO_MONITORAMENTO" = v_lista.edital;
  perform public.escolher_vinculo_do_contratado(v_pend, (select id from t_linha where codigo_vaga = 'ENSAIO-PEND-3'),
                                                'Desistente', 'A matrícula ENS-0003 foi digitada por engano');
  insert into t_teste values ('gestor_escolhe_vinculo', to_jsonb(
    (select string_agg(coalesce(c.status, '-') || ':' || coalesce(c.matricula, '-'), ',' order by t.codigo_vaga)
       from public."TB_CANDIDATO_APROVADO" c join t_linha t on t.id = c.id where t.nome = 'Pessoa Ficticia Dois')
    = 'Contratado:ENS-0002,Contratado em outra lista:ENS-0002,Desistente:-'));

  -- ── O administrador global concede a permissão ao usuário comum (exceção da pessoa na matriz) e
  --    tira a do Gestor: o usuário passa a decidir; o Gestor, não. ──
  insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by)
  select p.id, 'aprovados_pendencias', x.nivel, v_admin.user_id
    from public."TB_PERFIL_USUARIO" p
    join (values (v_usuario.user_id, 'editor'), (v_gestor.user_id, 'sem_acesso')) x(usuario, nivel)
      on p.user_id = x.usuario
   where p.ativo
  on conflict (perfil_usuario_id, recurso) do update set nivel = excluded.nivel;
  begin
    perform public.confirmar_empate_da_posicao((select p."CO_PENDENCIA_APROVADO" from public."TB_PENDENCIA_APROVADO" p
                                                 where p."DS_DETALHE" ->> 'posicao' = '7006'
                                                   and p."CO_MONITORAMENTO" = v_lista.edital), 'Sem a permissão');
    raise exception 'Decidiu sem a permissão';
  exception when insufficient_privilege then
    insert into t_teste values ('permissao_tirada_recusa_42501', 'true');
  end;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_usuario.user_id, 'email', v_usuario.email, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_usuario.user_id::text, true);
  insert into t_teste values ('permissao_concedida_decide', to_jsonb(private."FC_PODE_DECIDIR_PENDENCIA"(v_lista.edital)));

  -- Pessoa repetida (pelo usuário com a permissão concedida): não sai a linha com status para ficar a
  -- sem status; depois fica a com status.
  select p."CO_PENDENCIA_APROVADO" into v_pend from public."TB_PENDENCIA_APROVADO" p
   where p."TP_PENDENCIA" = 'PESSOA_REPETIDA' and p."CO_MONITORAMENTO" = v_lista.edital;
  begin
    perform public.manter_linha_da_pessoa_repetida(v_pend, (select id from t_linha where nome = 'Pessoa Ficticia Tres'
                                                             and status is null), 'Duplicada na importação');
    raise exception 'Saiu a linha com status';
  exception when invalid_parameter_value then
    insert into t_teste values ('repetida_protege_o_status', 'true');
  end;
  perform public.manter_linha_da_pessoa_repetida(v_pend, (select id from t_linha where nome = 'Pessoa Ficticia Tres'
                                                          and status is not null), 'Duplicada na importação');
  insert into t_teste values ('repetida_remove_sem_apagar', to_jsonb(
    (select c.removido_em is not null and c.removido_por = v_usuario.user_id from public."TB_CANDIDATO_APROVADO" c
      join t_linha t on t.id = c.id where t.nome = 'Pessoa Ficticia Tres' and t.status is null)
    and (select c.removido_em is null from public."TB_CANDIDATO_APROVADO" c
          join t_linha t on t.id = c.id where t.nome = 'Pessoa Ficticia Tres' and t.status is not null)));

  -- ── Administrador: corrige a posição e confirma o empate ──
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin.user_id, 'email', v_admin.email, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin.user_id::text, true);
  -- O administrador global faz tudo: decide em todo edital e lê toda área, sem depender do recorte.
  insert into t_teste values ('admin_global_pode_tudo', to_jsonb(
    private.is_master()
    and not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where not private."FC_PODE_DECIDIR_PENDENCIA"(m.id))
    and (select bool_and(jsonb_typeof(public.listar_pendencias_do_edital(a."CO_AREA") -> 'pendencias') = 'array')
           from public."TB_AREA" a)
    and (select bool_and((p ->> 'pode_decidir')::boolean)
           from jsonb_array_elements(public.listar_pendencias_do_edital(v_lista.area) -> 'pendencias') p)));
  select p."CO_PENDENCIA_APROVADO" into v_pend from public."TB_PENDENCIA_APROVADO" p
   where p."TP_PENDENCIA" = 'POSICAO_REPETIDA' and p."DS_DETALHE" ->> 'posicao' = '7005';
  v_r := public.corrigir_posicao_da_pendencia(v_pend, (select id from t_linha where nome = 'Pessoa Ficticia Cinco'), 7008,
                                              'Erro de digitação na lista publicada');
  insert into t_teste values ('admin_corrige_posicao', to_jsonb(
    v_r ->> 'situacao' = 'RESOLVIDA'
    and (select c.classificacao from public."TB_CANDIDATO_APROVADO" c join t_linha t on t.id = c.id
          where t.nome = 'Pessoa Ficticia Cinco') = 7008
    and exists (select 1 from public."TH_PENDENCIA_APROVADO" h where h."CO_PENDENCIA_APROVADO" = v_pend
                   and h."DS_ALTERACAO" -> 0 ->> 'antes' = '7005' and h."DS_ALTERACAO" -> 0 ->> 'depois' = '7008')));
  select p."CO_PENDENCIA_APROVADO" into v_pend from public."TB_PENDENCIA_APROVADO" p
   where p."TP_PENDENCIA" = 'POSICAO_REPETIDA' and p."DS_DETALHE" ->> 'posicao' = '7006';
  perform public.confirmar_empate_da_posicao(v_pend, 'Empate previsto no item 9.3 do edital');

  -- Convocado: nova data; o caso do aviso sai e o aviso fica resolvido.
  select p."CO_PENDENCIA_APROVADO" into v_pend from public."TB_PENDENCIA_APROVADO" p
   where p."TP_PENDENCIA" = 'CONVOCADO_SEM_DESFECHO' and p."CO_MONITORAMENTO" = v_lista.edital;
  perform public.registrar_desfecho_da_pendencia(v_pend, 'Convocado', null,
                                                 (now() at time zone 'America/Sao_Paulo')::date - 2, 'Reconvocado por e-mail');
  insert into t_teste values ('desfecho_fecha_o_aviso', to_jsonb(
    (select a."TP_SITUACAO" = 'RESOLVIDO' from public."TB_AVISO_CONFERENCIA" a where a."CO_AVISO_CONFERENCIA" = v_aviso)
    and not exists (select 1 from public."TB_CASO_AVISO_CONFERENCIA" k where k."CO_AVISO_CONFERENCIA" = v_aviso)
    and (select c."DT_CONVOCACAO" = (now() at time zone 'America/Sao_Paulo')::date - 2
           from public."TB_CANDIDATO_APROVADO" c join t_linha t on t.id = c.id where t.status = 'Convocado')));

  -- ── O job de novo, com tudo detectado de novo ──
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  -- Resolvida depois da leitura: fica resolvida (corrida entre o job e a decisão).
  v_r := public.gravar_pendencias_do_edital('pend-20261026T000001-00000e5a', now(), (
    select jsonb_agg(jsonb_build_object('tipo', p."TP_PENDENCIA", 'edital', p."CO_MONITORAMENTO", 'chave', p."DS_CHAVE",
                                        'candidatos', to_jsonb(p."CO_CANDIDATO_APROVADO"), 'detalhe', p."DS_DETALHE"))
      from public."TB_PENDENCIA_APROVADO" p where p."CO_MONITORAMENTO" = v_lista.edital
       and p."TP_PENDENCIA" <> 'PESSOA_REPETIDA'));
  insert into t_teste values ('corrida_nao_reabre', to_jsonb((v_r ->> 'reabertas')::integer = 0
                                                              and (v_r ->> 'permanentes')::integer = 5));
  -- Resolvida antes da leitura: reabre; o empate confirmado não.
  update public."TB_PENDENCIA_APROVADO" set "DT_RESOLUCAO" = now() - interval '1 hour'
   where "CO_MONITORAMENTO" = v_lista.edital and "TP_SITUACAO" = 'RESOLVIDA';
  v_r := public.gravar_pendencias_do_edital('pend-20261026T000002-00000e5a', now() - interval '1 minute', (
    select jsonb_agg(jsonb_build_object('tipo', p."TP_PENDENCIA", 'edital', p."CO_MONITORAMENTO", 'chave', p."DS_CHAVE",
                                        'candidatos', to_jsonb(p."CO_CANDIDATO_APROVADO"), 'detalhe', p."DS_DETALHE"))
      from public."TB_PENDENCIA_APROVADO" p where p."CO_MONITORAMENTO" = v_lista.edital
       and p."TP_PENDENCIA" in ('POSICAO_REPETIDA', 'CONVOCADO_SEM_DESFECHO')));
  insert into t_teste values ('reabre_menos_o_empate', to_jsonb(
    (v_r ->> 'reabertas')::integer = 2 and (v_r ->> 'permanentes')::integer = 1
    and (select p."TP_SITUACAO" from public."TB_PENDENCIA_APROVADO" p where p."DS_DETALHE" ->> 'posicao' = '7006'
          and p."CO_MONITORAMENTO" = v_lista.edital) = 'RESOLVIDA'
    and exists (select 1 from public."TH_PENDENCIA_APROVADO" h join public."TB_PENDENCIA_APROVADO" p using ("CO_PENDENCIA_APROVADO")
                 where p."CO_MONITORAMENTO" = v_lista.edital and h."TP_EVENTO" = 'REABERTA')));
  -- O que não veio na rodada e estava aberto: SANEADA.
  v_r := public.gravar_pendencias_do_edital('pend-20261026T000003-00000e5a', now(), '[]'::jsonb);
  insert into t_teste values ('sumiu_fica_saneada', to_jsonb((v_r ->> 'saneadas')::integer = 2
    and not exists (select 1 from public."TB_PENDENCIA_APROVADO" p where p."TP_SITUACAO" = 'ABERTA')));
end;
$$;

select jsonb_object_agg(chave, valor order by chave) as teste,
       bool_and(valor = 'true'::jsonb) as tudo_certo
  from t_teste;

rollback;
