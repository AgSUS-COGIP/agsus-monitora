-- Entrevistas por edital: a ausência de registros nunca significa dispensa.
-- Informação explícita, confirmada por administrador global, com histórico.
create table public."TB_PREVISAO_ENTREVISTA_EDITAL" (
  "CO_MONITORAMENTO" uuid primary key references public."TB_MONITORAMENTO_INDIGENA"(id),
  "TP_PREVISAO" text not null check ("TP_PREVISAO" in ('PREVISTA','NAO_PREVISTA','NAO_INFORMADA')),
  "DS_MOTIVO" varchar(500) not null,
  "CO_USUARIO" uuid not null,
  "DT_ATUALIZACAO" timestamptz not null default now()
);
alter table public."TB_PREVISAO_ENTREVISTA_EDITAL" enable row level security;
revoke all on public."TB_PREVISAO_ENTREVISTA_EDITAL" from public, anon, authenticated, service_role;

create table public."TH_PREVISAO_ENTREVISTA_EDITAL" (
  "CO_HISTORICO" bigint generated always as identity primary key,
  "CO_MONITORAMENTO" uuid not null references public."TB_MONITORAMENTO_INDIGENA"(id),
  "TP_ANTES" text not null,
  "TP_DEPOIS" text not null,
  "DS_MOTIVO" varchar(500) not null,
  "CO_USUARIO" uuid not null,
  "DT_EVENTO" timestamptz not null default now()
);
create index "IN_HIST_PREV_ENT_EDITAL" on public."TH_PREVISAO_ENTREVISTA_EDITAL" ("CO_MONITORAMENTO","DT_EVENTO" desc);
alter table public."TH_PREVISAO_ENTREVISTA_EDITAL" enable row level security;
revoke all on public."TH_PREVISAO_ENTREVISTA_EDITAL" from public, anon, authenticated, service_role;
revoke all on sequence public."TH_PREVISAO_ENTREVISTA_EDITAL_CO_HISTORICO_seq" from public, anon, authenticated, service_role;

create function public.obter_previsao_entrevista_edital(p_edital uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_estado text;
  v_motivo text;
begin
  if p_edital is null or not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id=p_edital) then
    raise exception 'Edital não encontrado' using errcode='22023';
  end if;
  if not (private.is_master() or
       (private.pode_recurso('entrevistas', 1) and coalesce(private."FC_PODE_VER_EDITAL"(p_edital),false))) then
    raise exception 'Sem permissão para consultar a etapa de entrevista' using errcode='42501';
  end if;
  select x."TP_PREVISAO", x."DS_MOTIVO" into v_estado,v_motivo
    from public."TB_PREVISAO_ENTREVISTA_EDITAL" x where x."CO_MONITORAMENTO"=p_edital;
  return jsonb_build_object(
    'situacao',coalesce(v_estado,'NAO_INFORMADA'),
    'motivo',v_motivo,
    'pode_alterar',private.is_master()
  );
end;
$function$;
revoke all on function public.obter_previsao_entrevista_edital(uuid) from public, anon, authenticated;
grant execute on function public.obter_previsao_entrevista_edital(uuid) to authenticated;

create function public.definir_previsao_entrevista_edital(
  p_edital uuid, p_situacao text, p_motivo text
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_antes text;
  v_motivo text:=btrim(coalesce(p_motivo,''));
  v_entrevistados integer;
begin
  if not private.is_master() then
    raise exception 'Apenas administrador global pode confirmar a etapa de entrevista' using errcode='42501';
  end if;
  if p_edital is null or p_situacao is null or
     p_situacao not in ('PREVISTA','NAO_PREVISTA','NAO_INFORMADA') then
    raise exception 'Edital ou situação inválidos' using errcode='22023';
  end if;
  if char_length(v_motivo) < 5 or char_length(v_motivo) > 500 then
    raise exception 'Justificativa obrigatória entre 5 e 500 caracteres' using errcode='22023';
  end if;
  select coalesce(m.entrevistados,0) into v_entrevistados
    from public."TB_MONITORAMENTO_INDIGENA" m where m.id=p_edital for update;
  if not found then raise exception 'Edital não encontrado' using errcode='22023'; end if;
  if p_situacao='NAO_PREVISTA' and (
      v_entrevistados>0
      or exists(select 1 from public."TB_ENTREVISTA" e where e."CO_MONITORAMENTO"=p_edital)
      or exists(select 1 from public."TB_ENTREVISTA_EDITAL" x where x."CO_MONITORAMENTO"=p_edital)
     ) then
    raise exception 'Edital possui entrevistas registradas ou configuração: não pode ser marcado como não previsto'
       using errcode='23514';
  end if;
  select x."TP_PREVISAO" into v_antes
    from public."TB_PREVISAO_ENTREVISTA_EDITAL" x where x."CO_MONITORAMENTO"=p_edital for update;
  v_antes:=coalesce(v_antes,'NAO_INFORMADA');
  if v_antes=p_situacao then
    raise exception 'Situação já registrada; nenhuma alteração necessária' using errcode='22023';
  end if;
  insert into public."TB_PREVISAO_ENTREVISTA_EDITAL"
    ("CO_MONITORAMENTO","TP_PREVISAO","DS_MOTIVO","CO_USUARIO")
  values (p_edital,p_situacao,v_motivo,auth.uid())
  on conflict ("CO_MONITORAMENTO") do update
     set "TP_PREVISAO"=excluded."TP_PREVISAO",
         "DS_MOTIVO"=excluded."DS_MOTIVO",
         "CO_USUARIO"=excluded."CO_USUARIO",
         "DT_ATUALIZACAO"=now();
  insert into public."TH_PREVISAO_ENTREVISTA_EDITAL"
    ("CO_MONITORAMENTO","TP_ANTES","TP_DEPOIS","DS_MOTIVO","CO_USUARIO")
  values (p_edital,v_antes,p_situacao,v_motivo,auth.uid());
  return jsonb_build_object('situacao',p_situacao,'motivo',v_motivo,'pode_alterar',true);
end;
$function$;
revoke all on function public.definir_previsao_entrevista_edital(uuid,text,text) from public, anon, authenticated;
grant execute on function public.definir_previsao_entrevista_edital(uuid,text,text) to authenticated;
