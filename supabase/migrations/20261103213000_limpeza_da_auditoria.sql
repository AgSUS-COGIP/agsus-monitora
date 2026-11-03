/*
  LIMPEZA DA AUDITORIA (somente leitura, 03/11/2026)

  1. EXECUTE de PUBLIC/anon em quatro funções de private.
     private."FC_JANELA_ENTREVISTA"(uuid), "FC_QUADRO_DA_VAGA"(uuid, text),
     "FC_TOKENS_VAGA"(text) e "FC_VENCIMENTO_DO_EDITAL"(date, smallint,
     smallint, boolean) nasceram sem revoke: o EXECUTE padrão de PUBLIC valia
     para anon (proacl nulo). Quem chama cada uma (pg_proc, views, policies,
     defaults e checks; repositório; 03/11):
       - FC_JANELA_ENTREVISTA: public.listar_editais_entrevista (SECURITY
         DEFINER da postgres) e private."FC_PREPARAR_TREINAMENTO_SI" (INVOKER,
         só postgres/service_role; chamada por FC_PREPARAR_EDITAL_TREINAMENTO,
         DEFINER da postgres);
       - FC_QUADRO_DA_VAGA: obter_quadro_de_vagas, obter_acompanhamento_inscricoes,
         conferencia_ler_classificacao, gravar_pre_classificacao_vaga,
         pre_classificacao_ler_candidatos e private."FC_DADOS_CLASSIFICACAO_EDITAL"
         (todas DEFINER da postgres); FC_EMPREGARE_VAGAS_DO_QUADRO e
         FC_QUADRO_PELO_TITULO_EMPREGARE (INVOKER, execução só da postgres);
       - FC_TOKENS_VAGA: só FC_QUADRO_DA_VAGA;
       - FC_VENCIMENTO_DO_EDITAL: definir_lista_aprovados_ativa e
         private."FC_INATIVAR_LISTAS_VENCIDAS" (DEFINER da postgres; pg_cron).
     Nenhuma view, policy, default ou check as usa; o Python e o front não as
     chamam (só comentários). Toda chamada legítima roda como postgres: o
     EXECUTE sai de PUBLIC e anon e fica só com a dona. authenticated e
     service_role nunca tiveram grant próprio (e não têm USAGE em private,
     a não ser authenticated, que não precisa delas).

  2. private.is_master() só pelo user_id.
     Aceitava também o e-mail do JWT. TB_PERFIL_USUARIO liga ao auth.users por
     user_id (FK, único); public.link_auth_user_profile (gatilho em auth.users)
     preenche o user_id pelo e-mail quando a conta nasce. Em 03/11: 40 perfis,
     38 com user_id, nenhum órfão nem com e-mail diferente do auth.users; os 6
     administradores globais ativos têm user_id igual ao do auth.users do
     e-mail. Os 2 sem user_id não têm conta no auth.users (nunca entraram):
     1eb88101-f06e-414d-9d98-4777e2aace6a (edital_gestor, inativo) e
     6b334d7a-08d7-42ad-8ab5-c7cf3dc0b0d9 (coordenador, ativo); nenhum é
     administrador e nada muda para eles (o gatilho do auth.users os liga no
     primeiro acesso).
     O caso que ficaria descoberto: perfil criado (adicionar_pessoa_acesso
     grava só o e-mail) para quem JÁ tem conta no auth.users — o gatilho do
     auth.users não roda de novo. Para isso, um gatilho novo em
     TB_PERFIL_USUARIO (antes de inserir ou de trocar o e-mail, com user_id
     nulo) liga o perfil à conta do mesmo e-mail. Com ele, user_id é sempre a
     identidade, e is_master() fica numa leitura pelo índice único de
     user_id. A guarda abaixo recusa a migration se algum perfil sem user_id
     já tiver conta com o mesmo e-mail, ou se algum administrador ativo não
     tiver user_id (ninguém perde o administrador).
     Quem chama is_master(): 51 funções (50 DEFINER), 16 policies (inclusive
     storage.objects) — todas pelo JWT da sessão, onde auth.uid() é o sub. A
     private.current_profile() continua aceitando o e-mail (fora deste
     escopo); com o gatilho, o user_id dela e o daqui são o mesmo.

  3. Motivo de verdade nas chaves da automação.
     alterar_chave_da_automacao aceitava 10 caracteres quaisquer
     ("sadasdsadsadasdas" em 28/10, "testegcgbgfbg" em 23/10). Agora
     private."FC_MOTIVO_COM_SENTIDO": de 15 a 500 caracteres, 3 palavras ou
     mais, ao menos 2 palavras de verdade (3 letras ou mais, com vogal, sem 5
     consoantes nem 3 letras iguais seguidas) e 5 letras diferentes no todo. A
     tela usa a mesma regra (src/lib/chaves-da-automacao.ts, motivoValido).
     Sem CHECK em TB_CHAVE_AUTOMACAO/TH_CHAVE_AUTOMACAO: as duas linhas acima
     não passariam. Só o RPC valida.

  4. Limpeza do cron.job_run_details.
     Ninguém apagava (7.968 linhas desde 15/10, 1,6 MB). Tarefa nova
     agsus_cron_limpar_historico, "52 6 * * *" (3h52 de Brasília, fora dos
     minutos das outras), apaga o que tem mais de 14 dias, menos as 10
     últimas execuções de cada tarefa: get_saude_das_cargas lê as 10 últimas
     e obter_chaves_da_automacao a última (a mensal de acessos não some).

  Fica de fora (relatado, não aplicado): o REINDEX CONCURRENTLY do
  TM_MANIFESTO_ANALISE (não roda em transação) e o TL_DISPARO_ROBO
  (INICIADO é a situação final da origem GITHUB por desenho — CK_DISPROBO_GITHUB
  — e FC_CONFERIR_DISPAROS_ROBO já apaga o que passa de 30 dias).

  Ensaio: supabase/ensaios/20261103213000_limpeza_da_auditoria.sql
  Rollback: supabase/rollback/20261103213000_limpeza_da_auditoria.sql
*/
begin;

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

commit;
