-- Edital crítico marcado à mão por gestor, coordenador ou administrador global.
--
-- Motivo (10/11/2026, pedido do usuário): o "crítico" da Visão geral é só
-- calculado (etapa atrasada, parado, sem inscritos, contratação baixa —
-- src/lib/criticos-da-visao-geral.ts). O campo `risco` do edital não conta e
-- qualquer editor do Núcleo o muda. Agora quem responde pelo edital pode
-- marcá-lo como crítico com um motivo; os motivos automáticos continuam.
--
-- Efeito:
-- - TB_EDITAL_CRITICO: a marcação vigente (uma por edital: motivo, quem, quando).
-- - TH_EDITAL_CRITICO: o histórico (marcar, alterar o motivo, desmarcar).
--   As duas só por RPC (RLS ligada, sem policy, sem grant direto).
-- - FC_PODE_MARCAR_CRITICO(edital): administrador global; ou perfil ativo dos
--   grupos edital_gestor ou coordenador que vê o edital (área e coordenação,
--   FC_PODE_VER_EDITAL).
-- - RPCs: listar_editais_criticos_manuais(p_area) (Visão geral),
--   obter_critico_do_edital(p_edital) (formulário do edital, com pode_marcar) e
--   marcar_edital_critico(p_edital, p_critico, p_motivo) (motivo de 10 a 500
--   caracteres, com palavras, também para desmarcar).
--
-- Não muda a view do monitoramento nem nenhuma função existente.
-- Dependentes: src/lib/rpc-contrato.ts, src/modulos/visao-geral/estado.ts,
-- src/modulos/editais/critico-do-edital.tsx.
-- Rollback: supabase/rollback/20261110150000_edital_critico_marcado.sql.
-- Ensaio: supabase/ensaios/20261110150000_edital_critico_marcado.sql.

begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';

create table if not exists public."TB_EDITAL_CRITICO" (
  "CO_MONITORAMENTO" uuid primary key
    references public."TB_MONITORAMENTO_INDIGENA"(id) on delete cascade,
  "DS_MOTIVO" text not null check (length(btrim("DS_MOTIVO")) between 10 and 500),
  "CO_USUARIO" uuid,
  "DT_MARCACAO" timestamptz not null default now()
);
comment on table public."TB_EDITAL_CRITICO" is
  'Edital marcado como crítico à mão (gestor, coordenador ou administrador global), com o motivo. Só por RPC (marcar_edital_critico). 20261110150000.';

create table if not exists public."TH_EDITAL_CRITICO" (
  "CO_HISTORICO" bigint generated always as identity primary key,
  "CO_MONITORAMENTO" uuid not null
    references public."TB_MONITORAMENTO_INDIGENA"(id) on delete cascade,
  "TP_ACAO" text not null check ("TP_ACAO" in ('MARCAR', 'ALTERAR', 'DESMARCAR')),
  "DS_MOTIVO" text not null,
  "CO_USUARIO" uuid,
  "DT_REGISTRO" timestamptz not null default now()
);
create index if not exists "IX_TH_EDITAL_CRITICO_EDITAL"
  on public."TH_EDITAL_CRITICO" ("CO_MONITORAMENTO", "DT_REGISTRO" desc);
comment on table public."TH_EDITAL_CRITICO" is
  'Histórico da marcação manual de edital crítico (MARCAR, ALTERAR, DESMARCAR), com motivo e quem. 20261110150000.';

alter table public."TB_EDITAL_CRITICO" enable row level security;
alter table public."TH_EDITAL_CRITICO" enable row level security;
revoke all on table public."TB_EDITAL_CRITICO" from public, anon, authenticated;
revoke all on table public."TH_EDITAL_CRITICO" from public, anon, authenticated;

create or replace function private."FC_PODE_MARCAR_CRITICO"(p_edital uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_perfil public."TB_PERFIL_USUARIO";
begin
  if (select auth.uid()) is null then return false; end if;
  if private.is_master() then return true; end if;
  v_perfil := private.current_profile();
  return v_perfil.id is not null
     and v_perfil.ativo is true
     and v_perfil.perfil in ('edital_gestor', 'coordenador')
     and private."FC_PODE_VER_EDITAL"(p_edital);
end;
$function$;
comment on function private."FC_PODE_MARCAR_CRITICO"(uuid) is
  'Quem marca o edital como crítico: administrador global, ou perfil ativo dos grupos edital_gestor ou coordenador que vê o edital (área e coordenação). 20261110150000.';
revoke all on function private."FC_PODE_MARCAR_CRITICO"(uuid) from public, anon, authenticated;

-- Quem marcou, legível: nome do perfil, senão o e-mail.
create or replace function private."FC_NOME_DO_USUARIO"(p_usuario uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(nullif(btrim(u.nome), ''), u.email)
    from public."TB_PERFIL_USUARIO" u
   where u.user_id = p_usuario
   limit 1;
$function$;
comment on function private."FC_NOME_DO_USUARIO"(uuid) is
  'Nome legível do usuário (nome do perfil, senão e-mail), para mostrar quem marcou. 20261110150000.';
revoke all on function private."FC_NOME_DO_USUARIO"(uuid) from public, anon, authenticated;

create or replace function public.listar_editais_criticos_manuais(p_area text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
set statement_timeout to '5s'
as $function$
declare
  v_area text := lower(btrim(coalesce(p_area, '')));
begin
  if not private.pode_recurso('dashboard') then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para esta área' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'monitoramento_id', c."CO_MONITORAMENTO",
             'motivo', c."DS_MOTIVO",
             'quem', private."FC_NOME_DO_USUARIO"(c."CO_USUARIO"),
             'quando', c."DT_MARCACAO"
           ) order by c."DT_MARCACAO" desc)
      from public."TB_EDITAL_CRITICO" c
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = c."CO_MONITORAMENTO"
     where m.ativo
       and m."CO_AREA" = v_area
       and ((select private."FC_EDITAIS_VISIVEIS"()) is null
            or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
  ), '[]'::jsonb);
end;
$function$;
comment on function public.listar_editais_criticos_manuais(text) is
  'Visão geral: os editais da área marcados à mão como críticos ([{monitoramento_id, motivo, quem, quando}]), só os que o usuário vê; exige dashboard e a área. 20261110150000.';
revoke all on function public.listar_editais_criticos_manuais(text) from public, anon;
grant execute on function public.listar_editais_criticos_manuais(text) to authenticated;

create or replace function public.obter_critico_do_edital(p_edital uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_c public."TB_EDITAL_CRITICO";
begin
  if not private."FC_PODE_VER_EDITAL"(p_edital) then
    raise exception 'Edital não encontrado ou sem acesso' using errcode = '42501';
  end if;
  select * into v_c from public."TB_EDITAL_CRITICO" where "CO_MONITORAMENTO" = p_edital;
  return jsonb_build_object(
    'marcado', v_c."CO_MONITORAMENTO" is not null,
    'motivo', v_c."DS_MOTIVO",
    'quem', private."FC_NOME_DO_USUARIO"(v_c."CO_USUARIO"),
    'quando', v_c."DT_MARCACAO",
    'pode_marcar', private."FC_PODE_MARCAR_CRITICO"(p_edital)
  );
end;
$function$;
comment on function public.obter_critico_do_edital(uuid) is
  'Formulário do edital: a marcação manual de crítico ({marcado, motivo, quem, quando}) e se o usuário pode mudá-la (pode_marcar). 20261110150000.';
revoke all on function public.obter_critico_do_edital(uuid) from public, anon;
grant execute on function public.obter_critico_do_edital(uuid) to authenticated;

create or replace function public.marcar_edital_critico(p_edital uuid, p_critico boolean, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_motivo text := nullif(regexp_replace(btrim(coalesce(p_motivo, '')), '\s+', ' ', 'g'), '');
  v_antes public."TB_EDITAL_CRITICO";
begin
  if not private."FC_PODE_MARCAR_CRITICO"(p_edital) then
    raise exception 'Só gestor, coordenador ou administrador global marcam o edital como crítico.' using errcode = '42501';
  end if;
  if p_critico is null then
    raise exception 'Diga se o edital é crítico ou não.' using errcode = '22023';
  end if;
  if v_motivo is null or length(v_motivo) not between 10 and 500
     or not private."FC_MOTIVO_PARECE_TEXTO"(v_motivo, 2) then
    raise exception 'Escreva o motivo (10 a 500 caracteres, com pelo menos 2 palavras).' using errcode = '22023';
  end if;

  select * into v_antes from public."TB_EDITAL_CRITICO" where "CO_MONITORAMENTO" = p_edital for update;

  if p_critico then
    insert into public."TB_EDITAL_CRITICO" ("CO_MONITORAMENTO", "DS_MOTIVO", "CO_USUARIO", "DT_MARCACAO")
    values (p_edital, v_motivo, v_uid, now())
    on conflict ("CO_MONITORAMENTO") do update
      set "DS_MOTIVO" = excluded."DS_MOTIVO", "CO_USUARIO" = excluded."CO_USUARIO",
          "DT_MARCACAO" = excluded."DT_MARCACAO";
    insert into public."TH_EDITAL_CRITICO" ("CO_MONITORAMENTO", "TP_ACAO", "DS_MOTIVO", "CO_USUARIO")
    values (p_edital, case when v_antes."CO_MONITORAMENTO" is null then 'MARCAR' else 'ALTERAR' end, v_motivo, v_uid);
  else
    if v_antes."CO_MONITORAMENTO" is null then
      raise exception 'O edital não está marcado como crítico.' using errcode = '22023';
    end if;
    delete from public."TB_EDITAL_CRITICO" where "CO_MONITORAMENTO" = p_edital;
    insert into public."TH_EDITAL_CRITICO" ("CO_MONITORAMENTO", "TP_ACAO", "DS_MOTIVO", "CO_USUARIO")
    values (p_edital, 'DESMARCAR', v_motivo, v_uid);
  end if;

  return public.obter_critico_do_edital(p_edital);
end;
$function$;
comment on function public.marcar_edital_critico(uuid, boolean, text) is
  'Marca (p_critico = true; de novo = altera o motivo) ou desmarca o edital como crítico, sempre com motivo (10 a 500, 2 palavras) e histórico em TH_EDITAL_CRITICO. Só FC_PODE_MARCAR_CRITICO. Devolve obter_critico_do_edital. 20261110150000.';
revoke all on function public.marcar_edital_critico(uuid, boolean, text) from public, anon;
grant execute on function public.marcar_edital_critico(uuid, boolean, text) to authenticated;

notify pgrst, 'reload schema';

commit;
