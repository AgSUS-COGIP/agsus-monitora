/*
  Rollback de 20261103213000_limpeza_da_auditoria.sql.
  Devolve o EXECUTE de PUBLIC às quatro funções privadas (o padrão de antes),
  o is_master() que aceitava também o e-mail do JWT, o alterar_chave_da_automacao
  com o motivo de 10 a 500 caracteres e tira o gatilho do perfil, a regra do
  motivo e a tarefa de limpeza do cron.job_run_details (o histórico apagado
  não volta).
*/
begin;

set local lock_timeout = '5s';

-- 4. Tarefa e função da limpeza do pg_cron
do $$
begin
  if exists (select 1 from cron.job where jobname = 'agsus_cron_limpar_historico') then
    perform cron.unschedule('agsus_cron_limpar_historico');
  end if;
end;
$$;
drop function if exists private."FC_LIMPAR_HISTORICO_DO_CRON"(integer, integer);

-- 3. alterar_chave_da_automacao como estava (20261022190000)
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
  if length(v_motivo) not between 10 and 500 then
    raise exception 'Informe o motivo (10 a 500 caracteres).' using errcode = '22023';
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
  'Liga (p_ligar = true) ou desliga uma chave da automação (20261022190000), com motivo de 10 a 500 caracteres: liga ou desliga junto as tarefas do pg_cron da chave (cron.alter_job active), grava o estado em TB_CHAVE_AUTOMACAO e o evento, com as tarefas mexidas, em TH_CHAVE_AUTOMACAO, e devolve obter_chaves_da_automacao. Só o administrador global. 28000 sem sessão, 42501 sem permissão, 22023 entrada inválida, 55000 já está no estado pedido.';

drop function if exists private."FC_MOTIVO_COM_SENTIDO"(text);

-- 2. is_master() com o e-mail do JWT; sem o gatilho do perfil
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
     where p.ativo is true
       and a."ST_ADMIN_GLOBAL"
       and (
         p.user_id = (select auth.uid())
         or lower(p.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
       )
  );
$function$;

comment on function private.is_master() is null;

drop trigger if exists "TG_PERFILUSUARIO_AUTH_PELO_EMAIL" on public."TB_PERFIL_USUARIO";
drop function if exists private."FC_PERFIL_LIGAR_USUARIO_AUTH"();

-- 1. EXECUTE de PUBLIC de volta (o padrão de antes)
grant execute on function private."FC_JANELA_ENTREVISTA"(uuid) to public;
grant execute on function private."FC_QUADRO_DA_VAGA"(uuid, text) to public;
grant execute on function private."FC_TOKENS_VAGA"(text) to public;
grant execute on function private."FC_VENCIMENTO_DO_EDITAL"(date, smallint, smallint, boolean) to public;

commit;
