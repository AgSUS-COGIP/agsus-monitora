-- ENSAIO de supabase/migrations/20261103213000_limpeza_da_auditoria.sql: roda o corpo e desfaz (rollback).
-- Antes do corpo, guarda o is_master() de cada perfil (com o JWT dele) e o de cada perfil só pelo e-mail.
-- Depois:
--   E1. anon (e PUBLIC) não executam as quatro funções privadas; as RPCs que as usam respondem como
--       authenticated (obter_quadro_de_vagas, listar_editais_entrevista);
--   E2. todo administrador global ativo continua master, quem não é continua não sendo; só o e-mail do JWT
--       (sub de outra conta) deixa de bastar; o gatilho liga de novo o perfil sem user_id à conta do e-mail;
--   E3. o motivo recusa "sadasdsadsadasdas" e "testegcgbgfbg" (22023 no RPC) e aceita uma frase normal (o RPC
--       passa da validação e para no 55000 "já está", sem mexer em nada);
--   E4. a tarefa agsus_cron_limpar_historico existe, ativa, às 6h52 UTC, e a função apaga só o que pode.
-- Qualquer conferência que falhe levanta exceção. O resultado (json) traz só números e verdadeiro/falso.
begin;

set local statement_timeout = '120s';

-- ═══ ANTES ═══

create temp table t_master (fase text, id uuid, admin boolean, master boolean, so_email boolean) on commit drop;

create or replace function pg_temp.ensaio_master(p_fase text) returns void
language plpgsql as $$
declare
  u record;
  v_master boolean;
  v_so_email boolean;
begin
  for u in
    select p.id, p.user_id, p.email, (p.ativo is true and a."ST_ADMIN_GLOBAL") as admin
      from public."TB_PERFIL_USUARIO" p
      join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
  loop
    -- A sessão da pessoa: sub = user_id (sem conta, um sub qualquer) e o e-mail dela.
    perform set_config('request.jwt.claims', json_build_object(
      'sub', coalesce(u.user_id, gen_random_uuid()), 'role', 'authenticated', 'email', u.email)::text, true);
    v_master := private.is_master();
    -- Só o e-mail: o sub é de outra conta.
    perform set_config('request.jwt.claims', json_build_object(
      'sub', gen_random_uuid(), 'role', 'authenticated', 'email', u.email)::text, true);
    v_so_email := private.is_master();
    insert into t_master values (p_fase, u.id, u.admin, v_master, v_so_email);
  end loop;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

select pg_temp.ensaio_master('antes');

-- As tarefas que têm execução registrada (a limpeza não pode tirar a última de nenhuma).
create temp table t_cron_tarefas_com_execucao on commit drop as
select distinct d.jobid from cron.job_run_details d;

-- ═══ CORPO DA MIGRATION ═══

set local lock_timeout = '5s';

-- 0. Guardas --------------------------------------------------------------------------------------
do $$
declare
  v_corpo text;
  v_n integer;
begin
  if to_regprocedure('private."FC_JANELA_ENTREVISTA"(uuid)') is null
     or to_regprocedure('private."FC_QUADRO_DA_VAGA"(uuid, text)') is null
     or to_regprocedure('private."FC_TOKENS_VAGA"(text)') is null
     or to_regprocedure('private."FC_VENCIMENTO_DO_EDITAL"(date, smallint, smallint, boolean)') is null then
    raise exception 'Funções privadas da auditoria ausentes.';
  end if;

  v_corpo := pg_get_functiondef('private.is_master()'::regprocedure);
  if position('auth.jwt() ->> ''email''' in v_corpo) = 0 then
    raise exception 'private.is_master() diferente da que esta migration conhece.';
  end if;

  v_corpo := pg_get_functiondef('public.alterar_chave_da_automacao(text, boolean, text)'::regprocedure);
  if position('if length(v_motivo) not between 10 and 500 then' in v_corpo) = 0 then
    raise exception 'alterar_chave_da_automacao diferente da que esta migration conhece.';
  end if;

  if to_regprocedure('private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(boolean)') is null then
    raise exception 'Aplique antes 20261029170000_marca_barata_das_leituras_por_versao.sql.';
  end if;

  if to_regclass('cron.job_run_details') is null then
    raise exception 'pg_cron ausente.';
  end if;

  -- Ninguém perde o administrador global: todo administrador ativo tem user_id ligado ao auth.users.
  select count(*) into v_n
    from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo is true and a."ST_ADMIN_GLOBAL"
     and (p.user_id is null or not exists (select 1 from auth.users u where u.id = p.user_id));
  if v_n > 0 then
    raise exception '% administrador(es) global(is) ativo(s) sem user_id: ligue antes de aplicar.', v_n;
  end if;

  -- Perfil sem user_id cuja conta já existe: o is_master() novo não o reconheceria.
  select count(*) into v_n
    from public."TB_PERFIL_USUARIO" p
   where p.user_id is null
     and exists (select 1 from auth.users u where lower(u.email) = lower(p.email));
  if v_n > 0 then
    raise exception '% perfil(is) sem user_id com conta no auth.users: ligue antes de aplicar.', v_n;
  end if;
end;
$$;

-- 1. EXECUTE só da dona ---------------------------------------------------------------------------
revoke all on function private."FC_JANELA_ENTREVISTA"(uuid) from public, anon;
revoke all on function private."FC_QUADRO_DA_VAGA"(uuid, text) from public, anon;
revoke all on function private."FC_TOKENS_VAGA"(text) from public, anon;
revoke all on function private."FC_VENCIMENTO_DO_EDITAL"(date, smallint, smallint, boolean) from public, anon;

-- 2. Perfil ligado à conta pelo e-mail e is_master() pelo user_id ---------------------------------
create or replace function private."FC_PERFIL_LIGAR_USUARIO_AUTH"()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.user_id is null and nullif(btrim(new.email), '') is not null then
    select u.id into new.user_id
      from auth.users u
     where lower(u.email) = lower(btrim(new.email))
       and not exists (select 1 from public."TB_PERFIL_USUARIO" o where o.user_id = u.id)
     limit 1;
  end if;
  return new;
end;
$function$;

comment on function private."FC_PERFIL_LIGAR_USUARIO_AUTH"() is
  'Gatilho de TB_PERFIL_USUARIO (20261103213000): perfil sem user_id inserido ou com e-mail trocado é ligado à conta do auth.users com o mesmo e-mail (sem conta, fica nulo até o primeiro acesso, que public.link_auth_user_profile liga). Assim private.is_master() identifica só pelo user_id.';
revoke all on function private."FC_PERFIL_LIGAR_USUARIO_AUTH"() from public, anon, authenticated, service_role;

drop trigger if exists "TG_PERFILUSUARIO_AUTH_PELO_EMAIL" on public."TB_PERFIL_USUARIO";
create trigger "TG_PERFILUSUARIO_AUTH_PELO_EMAIL"
  before insert or update of email on public."TB_PERFIL_USUARIO"
  for each row
  when (new.user_id is null)
  execute function private."FC_PERFIL_LIGAR_USUARIO_AUTH"();

create or replace function private.is_master()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
      from public."TB_PERFIL_USUARIO" p
      join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
     where p.user_id = (select auth.uid())
       and p.ativo is true
       and a."ST_ADMIN_GLOBAL"
  );
$function$;

comment on function private.is_master() is
  'Administrador global ativo, pelo user_id da sessão (auth.uid()) — sem o e-mail do JWT desde 20261103213000. Uma leitura pelo índice único de user_id.';

-- is_master() está no fecho das leituras por versão (20261029170000): recalcula as fontes delas.
select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();

-- 3. Motivo de verdade nas chaves da automação ----------------------------------------------------
create or replace function private."FC_MOTIVO_COM_SENTIDO"(p_motivo text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $function$
  with t as (select lower(btrim(coalesce(p_motivo, ''))) as m),
  p as (
    select regexp_replace(w, '[^[:alpha:]]', '', 'g') as letras
      from t, regexp_split_to_table(t.m, '\s+') w
     where w <> ''
  )
  select length(t.m) between 15 and 500
     and (select count(*) from p) >= 3
     and (select count(*) from p
           where length(p.letras) >= 3
             and p.letras ~ '[aeiouyáàâãäéèêëíìîïóòôõöúùûü]'
             and p.letras !~ '[^aeiouyáàâãäéèêëíìîïóòôõöúùûü]{5}'
             and p.letras !~ '(.)\1\1') >= 2
     and (select count(distinct c) from p, regexp_split_to_table(p.letras, '') c where c <> '') >= 5
    from t;
$function$;

comment on function private."FC_MOTIVO_COM_SENTIDO"(text) is
  'Motivo com sentido (20261103213000): 15 a 500 caracteres, 3 palavras ou mais, ao menos 2 palavras de verdade (3+ letras, com vogal, sem 5 consoantes nem 3 letras iguais seguidas) e 5 letras diferentes. Recusa teclado batido. A tela usa a mesma regra (src/lib/chaves-da-automacao.ts).';
revoke all on function private."FC_MOTIVO_COM_SENTIDO"(text) from public, anon, authenticated, service_role;

create or replace function public.alterar_chave_da_automacao(p_chave text, p_ligar boolean, p_motivo text)
returns json
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_atual text;
  v_tarefa record;
  v_tarefas text[] := '{}';
begin
  if v_uid is null then
    raise exception 'Entre no MONITORA de novo.' using errcode = '28000';
  end if;
  if not private.is_master() then
    raise exception 'Só o administrador global liga ou desliga a automação.' using errcode = '42501';
  end if;
  if p_chave is null or p_ligar is null then
    raise exception 'Informe a chave e se ela fica ligada.' using errcode = '22023';
  end if;
  if not private."FC_MOTIVO_COM_SENTIDO"(v_motivo) then
    raise exception 'Escreva o motivo numa frase de verdade: pelo menos 15 caracteres e 3 palavras (até 500).'
      using errcode = '22023';
  end if;

  select c."ST_LIGADA" into v_atual
    from public."TB_CHAVE_AUTOMACAO" c
   where c."CO_CHAVE" = p_chave
     for update;
  if v_atual is null then
    raise exception 'Chave da automação desconhecida.' using errcode = '22023';
  end if;
  if (v_atual = 'S') = p_ligar then
    raise exception 'Esta automação já está %.', case when p_ligar then 'ligada' else 'desligada' end
      using errcode = '55000';
  end if;

  -- As tarefas do pg_cron da chave acompanham (o que já está no estado pedido fica).
  for v_tarefa in
    select j.jobid, j.jobname from cron.job j
     where private."FC_CHAVE_DA_TAREFA"(j.jobname) = p_chave and j.active is distinct from p_ligar
     order by j.jobname
  loop
    perform cron.alter_job(v_tarefa.jobid, active := p_ligar);
    v_tarefas := v_tarefas || v_tarefa.jobname::text;
  end loop;

  update public."TB_CHAVE_AUTOMACAO" set
    "ST_LIGADA" = case when p_ligar then 'S' else 'N' end,
    "DS_MOTIVO" = v_motivo,
    "CO_USUARIO_ATUALIZACAO" = v_uid,
    "DT_ATUALIZACAO" = now()
   where "CO_CHAVE" = p_chave;
  insert into public."TH_CHAVE_AUTOMACAO" ("CO_CHAVE", "ST_LIGADA", "DS_MOTIVO", "CO_USUARIO", "DS_TAREFAS")
  values (p_chave, case when p_ligar then 'S' else 'N' end, v_motivo, v_uid, v_tarefas);

  return public.obter_chaves_da_automacao();
end;
$function$;

comment on function public.alterar_chave_da_automacao(text, boolean, text) is
  'Liga (p_ligar = true) ou desliga uma chave da automação (20261022190000), com motivo de verdade (private."FC_MOTIVO_COM_SENTIDO", 20261103213000: 15 a 500 caracteres, 3 palavras ou mais, sem teclado batido): liga ou desliga junto as tarefas do pg_cron da chave (cron.alter_job active), grava o estado em TB_CHAVE_AUTOMACAO e o evento, com as tarefas mexidas, em TH_CHAVE_AUTOMACAO, e devolve obter_chaves_da_automacao. Só o administrador global. 28000 sem sessão, 42501 sem permissão, 22023 entrada inválida, 55000 já está no estado pedido.';

-- 4. Limpeza diária do histórico do pg_cron -------------------------------------------------------
create or replace function private."FC_LIMPAR_HISTORICO_DO_CRON"(p_dias integer default 14, p_manter integer default 10)
returns integer
language plpgsql
set search_path = ''
as $function$
declare
  v_n integer;
begin
  if p_dias is null or p_dias not between 1 and 90 then
    raise exception 'p_dias deve estar entre 1 e 90' using errcode = '22023';
  end if;
  if p_manter is null or p_manter not between 1 and 100 then
    raise exception 'p_manter deve estar entre 1 e 100' using errcode = '22023';
  end if;

  delete from cron.job_run_details d
   where d.start_time < now() - make_interval(days => p_dias)
     and d.runid not in (
       select x.runid
         from (select r.runid,
                      row_number() over (partition by r.jobid order by r.start_time desc, r.runid desc) as n
                 from cron.job_run_details r) x
        where x.n <= p_manter);
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

comment on function private."FC_LIMPAR_HISTORICO_DO_CRON"(integer, integer) is
  'Apaga de cron.job_run_details o que tem mais de p_dias (1 a 90; padrão 14), menos as p_manter (padrão 10) últimas execuções de cada tarefa (get_saude_das_cargas lê as 10 últimas; obter_chaves_da_automacao, a última). Devolve as linhas apagadas. Chamada pela tarefa agsus_cron_limpar_historico (20261103213000). Só o dono (pg_cron).';
revoke all on function private."FC_LIMPAR_HISTORICO_DO_CRON"(integer, integer) from public, anon, authenticated, service_role;

do $$
declare
  v_comando constant text :=
    'select private."FC_LIMPAR_HISTORICO_DO_CRON"(14, 10) where pg_try_advisory_xact_lock(hashtext(''agsus_cron_limpar_historico''));';
  v_id bigint;
begin
  select jobid into v_id from cron.job where jobname = 'agsus_cron_limpar_historico';
  if v_id is null then
    perform cron.schedule('agsus_cron_limpar_historico', '52 6 * * *', v_comando);
  else
    perform cron.alter_job(v_id, schedule => '52 6 * * *', command => v_comando, active => true);
  end if;
end;
$$;

-- ═══ DEPOIS ═══

-- E1. As quatro funções: sem PUBLIC e sem anon no ACL.
do $$
declare
  v_f regprocedure;
begin
  foreach v_f in array array[
    'private."FC_JANELA_ENTREVISTA"(uuid)'::regprocedure,
    'private."FC_QUADRO_DA_VAGA"(uuid, text)'::regprocedure,
    'private."FC_TOKENS_VAGA"(text)'::regprocedure,
    'private."FC_VENCIMENTO_DO_EDITAL"(date, smallint, smallint, boolean)'::regprocedure]
  loop
    if has_function_privilege('anon', v_f, 'execute') then
      raise exception 'E1: anon ainda executa %.', v_f;
    end if;
    if exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
                where p.oid = v_f and x.grantee = 0) then
      raise exception 'E1: PUBLIC ainda executa %.', v_f;
    end if;
  end loop;
  perform set_config('ensaio.e1_funcoes', '4', true);
end;
$$;

-- anon chamando direto: recusado.
set local role anon;
do $$
begin
  perform private."FC_TOKENS_VAGA"('Analista de dados');
  raise exception 'E1: anon executou FC_TOKENS_VAGA.';
exception when insufficient_privilege then
  perform set_config('ensaio.e1_anon_recusado', 'true', true);
end;
$$;
reset role;

-- As RPCs que usam as funções, como um administrador global (authenticated).
do $$
declare
  v_admin record;
  v_edital uuid;
  v_area text;
begin
  select u.user_id, u.email into v_admin
    from public."TB_PERFIL_USUARIO" u
    join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = u.perfil
   where a."ST_ADMIN_GLOBAL" and u.ativo is true and u.user_id is not null
   order by u.email limit 1;
  select q."CO_MONITORAMENTO", m."CO_AREA" into v_edital, v_area
    from public."TB_QUADRO_VAGA_EDITAL" q
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id = q."CO_MONITORAMENTO"
   where q."ST_REGISTRO_ATIVO" = 'S'
   order by q."DT_CRIACAO" desc limit 1;
  perform set_config('ensaio.admin_sub', v_admin.user_id::text, true);
  perform set_config('ensaio.admin_email', v_admin.email, true);
  perform set_config('ensaio.edital', v_edital::text, true);
  perform set_config('ensaio.area', v_area, true);
  perform set_config('ensaio.manutencao_ligada', (select (c."ST_LIGADA" = 'S')::text
    from public."TB_CHAVE_AUTOMACAO" c where c."CO_CHAVE" = 'manutencao'), true);
end;
$$;

select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('ensaio.admin_sub'), 'role', 'authenticated',
  'email', current_setting('ensaio.admin_email'))::text, true);
set local role authenticated;

do $$
declare
  v_quadro json;
begin
  v_quadro := public.obter_quadro_de_vagas(current_setting('ensaio.edital')::uuid);
  if v_quadro is null then
    raise exception 'E1: obter_quadro_de_vagas não respondeu.';
  end if;
  perform public.listar_editais_entrevista(current_setting('ensaio.area'), true);
  perform set_config('ensaio.e1_vinculos', json_array_length(v_quadro -> 'vinculos')::text, true);
  perform set_config('ensaio.e1_rpcs_ok', 'true', true);
end;
$$;

reset role;
select set_config('request.jwt.claims', '', true);

-- E2. is_master() de cada perfil, depois.
select pg_temp.ensaio_master('depois');

do $$
declare
  v_n integer;
begin
  -- O mesmo resultado com a sessão de cada pessoa.
  select count(*) into v_n
    from t_master a join t_master d on d.id = a.id and d.fase = 'depois'
   where a.fase = 'antes' and a.master is distinct from d.master;
  if v_n > 0 then
    raise exception 'E2: % perfil(is) mudaram de is_master() com a própria sessão.', v_n;
  end if;
  -- Master = administrador global ativo, exatamente.
  select count(*) into v_n from t_master where fase = 'depois' and master is distinct from admin;
  if v_n > 0 then
    raise exception 'E2: % perfil(is) com is_master() diferente do grupo.', v_n;
  end if;
  -- Só o e-mail não basta mais.
  if exists (select 1 from t_master where fase = 'depois' and so_email) then
    raise exception 'E2: o e-mail do JWT ainda basta para is_master().';
  end if;
  perform set_config('ensaio.e2_admins', (select count(*) from t_master where fase = 'depois' and master)::text, true);
  perform set_config('ensaio.e2_nao_admins', (select count(*) from t_master where fase = 'depois' and not master)::text, true);
  perform set_config('ensaio.e2_so_email_antes',
    (select count(*) from t_master where fase = 'antes' and so_email)::text, true);
end;
$$;

-- O gatilho: perfil (não administrador) sem user_id volta a ser ligado ao trocar o e-mail.
do $$
declare
  v_id uuid;
  v_uid uuid;
  v_ligado uuid;
begin
  select p.id, p.user_id into v_id, v_uid
    from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
   where p.user_id is not null and not a."ST_ADMIN_GLOBAL"
   order by p.email limit 1;
  update public."TB_PERFIL_USUARIO" set user_id = null where id = v_id;
  update public."TB_PERFIL_USUARIO" set email = upper(email) where id = v_id;
  select user_id into v_ligado from public."TB_PERFIL_USUARIO" where id = v_id;
  if v_ligado is distinct from v_uid then
    raise exception 'E2: o gatilho não ligou o perfil à conta do e-mail.';
  end if;
  perform set_config('ensaio.e2_gatilho_liga', 'true', true);
end;
$$;

-- E3. O motivo.
do $$
begin
  if private."FC_MOTIVO_COM_SENTIDO"('sadasdsadsadasdas') or private."FC_MOTIVO_COM_SENTIDO"('testegcgbgfbg')
     or private."FC_MOTIVO_COM_SENTIDO"('asdf asdf asdf asdf') or private."FC_MOTIVO_COM_SENTIDO"('teste teste teste') then
    raise exception 'E3: teclado batido aceito.';
  end if;
  if not private."FC_MOTIVO_COM_SENTIDO"('Religar a sincronização da seleção do edital 120/2026')
     or not private."FC_MOTIVO_COM_SENTIDO"('Pausa pedida pela coordenação')
     or not private."FC_MOTIVO_COM_SENTIDO"('  Instrução da COGIP para pausar  ') then
    raise exception 'E3: frase normal recusada.';
  end if;
end;
$$;

select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('ensaio.admin_sub'), 'role', 'authenticated',
  'email', current_setting('ensaio.admin_email'))::text, true);
set local role authenticated;

do $$
declare
  v_lixo text;
  v_recusas integer := 0;
begin
  foreach v_lixo in array array['sadasdsadsadasdas', 'testegcgbgfbg'] loop
    begin
      perform public.alterar_chave_da_automacao('manutencao', false, v_lixo);
      raise exception 'E3: o RPC aceitou "%".', v_lixo;
    exception when invalid_parameter_value then
      v_recusas := v_recusas + 1;
    end;
  end loop;
  -- Frase normal: passa da validação e para no "já está" (pede o estado atual; nada muda).
  begin
    perform public.alterar_chave_da_automacao('manutencao', current_setting('ensaio.manutencao_ligada')::boolean,
      'Conferência do ensaio da limpeza da auditoria');
    raise exception 'E3: o RPC mudou a chave no ensaio.';
  exception when object_not_in_prerequisite_state then
    perform set_config('ensaio.e3_frase_aceita', 'true', true);
  end;
  perform set_config('ensaio.e3_recusas', v_recusas::text, true);
end;
$$;

reset role;
select set_config('request.jwt.claims', '', true);

-- E4. A tarefa do pg_cron e a limpeza.
do $$
declare
  v_job record;
  v_antes integer;
  v_apagadas integer;
  v_sem_ultima integer;
begin
  select * into v_job from cron.job where jobname = 'agsus_cron_limpar_historico';
  if v_job.jobid is null or v_job.schedule <> '52 6 * * *' or not v_job.active
     or position('private."FC_LIMPAR_HISTORICO_DO_CRON"(14, 10)' in v_job.command) = 0 then
    raise exception 'E4: tarefa agsus_cron_limpar_historico ausente ou diferente.';
  end if;
  select count(*) into v_antes from cron.job_run_details;
  v_apagadas := private."FC_LIMPAR_HISTORICO_DO_CRON"(14, 10);
  if exists (select 1 from cron.job_run_details where start_time < now() - interval '14 days'
               and runid not in (select x.runid
                                   from (select r.runid, row_number() over (partition by r.jobid
                                                                            order by r.start_time desc, r.runid desc) n
                                           from cron.job_run_details r) x
                                  where x.n <= 10)) then
    raise exception 'E4: sobrou linha velha.';
  end if;
  -- Toda tarefa que tinha execução continua com a última.
  select count(*) into v_sem_ultima
    from t_cron_tarefas_com_execucao t
   where not exists (select 1 from cron.job_run_details d where d.jobid = t.jobid);
  if v_sem_ultima > 0 then
    raise exception 'E4: % tarefa(s) perderam a última execução.', v_sem_ultima;
  end if;
  perform set_config('ensaio.e4_linhas_antes', v_antes::text, true);
  perform set_config('ensaio.e4_apagadas', v_apagadas::text, true);
end;
$$;

-- ═══ RESULTADO ═══
select json_build_object(
  'e1_funcoes_sem_public_e_anon', current_setting('ensaio.e1_funcoes', true)::int,
  'e1_anon_recusado', current_setting('ensaio.e1_anon_recusado', true)::boolean,
  'e1_rpcs_como_authenticated', current_setting('ensaio.e1_rpcs_ok', true)::boolean,
  'e1_vinculos_do_quadro', current_setting('ensaio.e1_vinculos', true)::int,
  'e2_admins_master', current_setting('ensaio.e2_admins', true)::int,
  'e2_nao_admins_nao_master', current_setting('ensaio.e2_nao_admins', true)::int,
  'e2_so_email_bastava_antes', current_setting('ensaio.e2_so_email_antes', true)::int,
  'e2_gatilho_liga', current_setting('ensaio.e2_gatilho_liga', true)::boolean,
  'e3_recusas_no_rpc', current_setting('ensaio.e3_recusas', true)::int,
  'e3_frase_aceita', current_setting('ensaio.e3_frase_aceita', true)::boolean,
  'e4_linhas_antes', current_setting('ensaio.e4_linhas_antes', true)::int,
  'e4_apagadas', current_setting('ensaio.e4_apagadas', true)::int
) as resultado;

rollback;
