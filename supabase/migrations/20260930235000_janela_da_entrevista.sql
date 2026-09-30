/*
  "Conduzir entrevistas" mostra só os editais na janela da entrevista.

  A lista trazia todo edital ativo da área (97 na Saúde Indígena), quase todos
  fora da fase de entrevista. Agora um edital aparece quando:

    - está na JANELA, calculada pelo cronograma: de 7 dias antes da primeira
      etapa de entrevista (convocação, período, realização, análise
      comportamental) até 15 dias depois da última (resultado e recursos);
    - o administrador global o LIBEROU até uma data, com motivo
      (TB_ENTREVISTA_LIBERACAO); a liberação vence sozinha;
    - ou tem convocado ainda sem parecer — ninguém perde uma entrevista no
      meio porque o cronograma mudou.

  Edital sem etapa de entrevista no cronograma fica fora até ser liberado: é
  o empurrão para cadastrar o cronograma (a importação do PDF de anexos ajuda).
  O administrador global vê todos com p_todos = true.

  1. TB_ENTREVISTA_LIBERACAO + liberar_entrevista_edital(p_edital, p_ate,
     p_motivo) — p_ate nulo encerra a liberação vigente.
  2. private.FC_JANELA_ENTREVISTA(p_edital) → (inicio, fim).
  3. listar_editais_entrevista(p_area, p_todos) devolve
     {admin_global, editais:[{…, janela_inicio, janela_fim, na_janela,
     liberado_ate, motivo_liberacao, pendentes, visivel_por}]}.

  Rollback: supabase/rollback/20260930235000_janela_da_entrevista.sql
*/
begin;

-- ---------------------------------------------------------------------------
-- 1. Liberação pelo administrador global
-- ---------------------------------------------------------------------------
create table public."TB_ENTREVISTA_LIBERACAO" (
  "CO_LIBERACAO" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "DT_LIBERADO_ATE" date not null,
  "DS_MOTIVO" varchar(500) not null,
  "CO_USUARIO" uuid,
  "DT_CRIACAO" timestamptz not null default now(),
  "ST_REGISTRO_ATIVO" varchar(1) not null default 'S',
  "DT_DESATIVACAO" timestamptz,
  "CO_USUARIO_DESATIVACAO" uuid,
  constraint "PK_TB_ENTREVISTA_LIBERACAO" primary key ("CO_LIBERACAO"),
  constraint "FK_MONITORAMENTO_ENTRLIBERACAO" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "CK_ENTRLIBERACAO_MOTIVO" check (length(btrim("DS_MOTIVO")) between 3 and 500),
  constraint "CK_ENTRLIBERACAO_STATIVO" check ("ST_REGISTRO_ATIVO" in ('S', 'N'))
);
create unique index "IN_ENTRLIBERACAO_VIGENTE" on public."TB_ENTREVISTA_LIBERACAO" ("CO_MONITORAMENTO")
  where "ST_REGISTRO_ATIVO" = 'S';

comment on table public."TB_ENTREVISTA_LIBERACAO" is 'Liberação, pelo administrador global, de um edital fora da janela da entrevista para aparecer em "Conduzir entrevistas". Uma vigente por edital; as anteriores ficam desativadas.';
comment on column public."TB_ENTREVISTA_LIBERACAO"."CO_LIBERACAO" is 'Identificador da liberação.';
comment on column public."TB_ENTREVISTA_LIBERACAO"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA).';
comment on column public."TB_ENTREVISTA_LIBERACAO"."DT_LIBERADO_ATE" is 'Último dia (Brasília) em que o edital aparece por esta liberação.';
comment on column public."TB_ENTREVISTA_LIBERACAO"."DS_MOTIVO" is 'Por que o edital foi liberado fora da janela.';
comment on column public."TB_ENTREVISTA_LIBERACAO"."CO_USUARIO" is 'Administrador (auth.users) que liberou.';
comment on column public."TB_ENTREVISTA_LIBERACAO"."DT_CRIACAO" is 'Quando foi liberado.';
comment on column public."TB_ENTREVISTA_LIBERACAO"."ST_REGISTRO_ATIVO" is 'S: vigente (até DT_LIBERADO_ATE). N: substituída ou encerrada.';
comment on column public."TB_ENTREVISTA_LIBERACAO"."DT_DESATIVACAO" is 'Quando foi substituída ou encerrada.';
comment on column public."TB_ENTREVISTA_LIBERACAO"."CO_USUARIO_DESATIVACAO" is 'Quem substituiu ou encerrou.';

alter table public."TB_ENTREVISTA_LIBERACAO" enable row level security;
revoke all on public."TB_ENTREVISTA_LIBERACAO" from anon, authenticated;
grant all on public."TB_ENTREVISTA_LIBERACAO" to service_role;

create function public.liberar_entrevista_edital(p_edital uuid, p_ate date, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not private.is_master() then
    raise exception 'Só o administrador global libera editais fora da janela' using errcode = '42501';
  end if;
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital) then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then
    raise exception 'Informe o motivo (3 a 500 caracteres)' using errcode = '22023';
  end if;
  if p_ate is not null and p_ate not between v_hoje and v_hoje + 180 then
    raise exception 'A liberação vai de hoje até no máximo 180 dias' using errcode = '22023';
  end if;

  update public."TB_ENTREVISTA_LIBERACAO"
     set "ST_REGISTRO_ATIVO" = 'N', "DT_DESATIVACAO" = now(), "CO_USUARIO_DESATIVACAO" = (select auth.uid())
   where "CO_MONITORAMENTO" = p_edital and "ST_REGISTRO_ATIVO" = 'S';
  if p_ate is not null then
    insert into public."TB_ENTREVISTA_LIBERACAO" ("CO_MONITORAMENTO", "DT_LIBERADO_ATE", "DS_MOTIVO", "CO_USUARIO")
    values (p_edital, p_ate, btrim(p_motivo), (select auth.uid()));
  end if;
  return json_build_object('edital', p_edital, 'liberado_ate', p_ate);
end;
$function$;
comment on function public.liberar_entrevista_edital(uuid, date, text) is 'Administrador global: libera o edital em "Conduzir entrevistas" até p_ate (máx. 180 dias), com motivo; p_ate nulo encerra a liberação vigente.';
revoke all on function public.liberar_entrevista_edital(uuid, date, text) from public, anon;
grant execute on function public.liberar_entrevista_edital(uuid, date, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Janela pelo cronograma
-- ---------------------------------------------------------------------------
create function private."FC_JANELA_ENTREVISTA"(p_edital uuid, out inicio date, out fim date)
language sql
stable
set search_path to ''
as $function$
  select min(c.data_inicio) - 7, max(coalesce(c.data_fim, c.data_inicio)) + 15
    from public."TB_CRONOGRAMA_MONIT_INDIG" c
   where c.monitoramento_id = p_edital
     and (c.atividade ilike '%entrevista%' or c.atividade ilike '%comportamental%');
$function$;
comment on function private."FC_JANELA_ENTREVISTA"(uuid) is 'Janela da entrevista do edital pelo cronograma: 7 dias antes da primeira etapa de entrevista até 15 dias depois da última. Nula sem etapa de entrevista.';

-- ---------------------------------------------------------------------------
-- 3. Lista de editais para conduzir
-- ---------------------------------------------------------------------------
drop function if exists public.listar_editais_entrevista(text);

create function public.listar_editais_entrevista(p_area text, p_todos boolean default false)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_editais uuid[];
  v_admin boolean := private.is_master();
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('entrevistas', 1) then
    raise exception 'Sem permissão para Entrevistas' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];
  return json_build_object(
    'admin_global', v_admin,
    'hoje', v_hoje,
    'editais', coalesce((
      select json_agg(json_build_object(
          'id', x.id, 'edital', x.edital, 'unidade', x.unidade,
          'configurado', x.configurado, 'convocados', x.convocados, 'pendentes', x.pendentes,
          'janela_inicio', x.inicio, 'janela_fim', x.fim, 'na_janela', x.na_janela,
          'liberado_ate', x.liberado_ate, 'motivo_liberacao', x.motivo,
          'visivel_por', case when x.na_janela then 'janela' when x.liberado_ate is not null then 'liberado'
                              when x.pendentes > 0 then 'convocados' else 'admin' end)
          order by x.edital)
        from (
          select m.id, m.edital, m.unidade, j.inicio, j.fim,
                 coalesce(v_hoje between j.inicio and j.fim, false) na_janela,
                 exists (select 1 from public."TB_ENTREVISTA_EDITAL" c where c."CO_MONITORAMENTO" = m.id) configurado,
                 (select count(*) from public."TB_ENTREVISTA" e
                   where e."CO_MONITORAMENTO" = m.id and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S') convocados,
                 (select count(*) from public."TB_ENTREVISTA" e
                   where e."CO_MONITORAMENTO" = m.id and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S'
                     and e."TP_PARECER" = 'SEM_PARECER') pendentes,
                 l."DT_LIBERADO_ATE" liberado_ate, l."DS_MOTIVO" motivo
            from public."TB_MONITORAMENTO_INDIGENA" m
            cross join lateral private."FC_JANELA_ENTREVISTA"(m.id) j
            left join public."TB_ENTREVISTA_LIBERACAO" l
              on l."CO_MONITORAMENTO" = m.id and l."ST_REGISTRO_ATIVO" = 'S' and l."DT_LIBERADO_ATE" >= v_hoje
           where m."CO_AREA" = p_area and m.ativo
             and (v_editais is null or m.id = any (v_editais))
        ) x
       where (p_todos and v_admin) or x.na_janela or x.liberado_ate is not null or x.pendentes > 0), '[]'::json)
  );
end;
$function$;
comment on function public.listar_editais_entrevista(text, boolean) is 'Editais da área (recorte da coordenação) para conduzir entrevistas: na janela do cronograma, liberados pelo administrador global ou com convocado sem parecer; p_todos (só administrador global) traz todos. entrevistas >= leitor.';
revoke all on function public.listar_editais_entrevista(text, boolean) from public, anon;
grant execute on function public.listar_editais_entrevista(text, boolean) to authenticated, service_role;

commit;
