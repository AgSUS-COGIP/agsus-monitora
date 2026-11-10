-- Ensaio transacional: nenhuma alteracao persiste (termina em rollback).
-- Requer operador do banco, perfis e fichas existentes; nao cria usuarios.
-- 1. Mostra quantos Coordenadores passam a coordenar cada edital e reprova se
--    algum gestor que ja coordenava deixar de coordenar.
-- 2. Reabre, como um coordenador do edital, ate 3 fichas concluidas de um
--    edital e confere situacao, versao e historico; reprova se anon puder chamar.
begin;
set local statement_timeout = '60s';
set local lock_timeout = '3s';

create temporary table ensaio_gestores_antes on commit drop as
select u.id as perfil, m.id as edital
  from public."TB_PERFIL_USUARIO" u
  cross join public."TB_MONITORAMENTO_INDIGENA" m
 where u.ativo and private."FC_GESTOR_DO_EDITAL"(u.id, m.id);

create or replace function private."FC_GESTOR_DO_EDITAL"(p_perfil_usuario uuid, p_edital uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public."TB_PERFIL_USUARIO" u
     where u.id = p_perfil_usuario and u.ativo and u.perfil in ('edital_gestor', 'coordenador')
       and private."FC_NIVEL_AVALIACAO_DO_PERFIL"(u.id) >= 3
       and private."FC_PERFIL_VE_EDITAL"(u.id, p_edital));
$function$;

create or replace function public.reabrir_fichas(
  p_edital uuid,
  p_fichas jsonb,
  p_motivo text,
  p_complemento text default null
)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_item record;
  v_qt integer;
begin
  perform private."FC_EXIGIR_COORD_FICHAS"(p_edital);
  if jsonb_typeof(p_fichas) is distinct from 'array' or jsonb_array_length(p_fichas) not between 1 and 5000 then
    raise exception 'Escolha de 1 a 5.000 fichas.' using errcode = '22023';
  end if;
  begin
    select count(*) into v_qt
      from jsonb_to_recordset(p_fichas) x(ficha uuid, versao integer)
      left join public."TB_FICHA_ANALISE" f on f."CO_FICHA_ANALISE" = x.ficha and f."CO_MONITORAMENTO" = p_edital
     where f."CO_FICHA_ANALISE" is null or f."NU_VERSAO" is distinct from x.versao;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Ficha com id ou versão inválida' using errcode = '22023';
  end;
  if v_qt > 0 then
    raise exception '% ficha(s) mudaram desde que você abriu a fila; atualize e confira.', v_qt using errcode = 'PT409';
  end if;
  -- A regra de cada ficha (situação, motivo da lista, complemento, histórico) é a de reabrir_ficha.
  for v_item in select x.ficha, x.versao from jsonb_to_recordset(p_fichas) x(ficha uuid, versao integer) order by x.ficha loop
    perform public.reabrir_ficha(v_item.ficha, v_item.versao, p_motivo, p_complemento);
  end loop;
  return json_build_object('reabertas', jsonb_array_length(p_fichas));
end;
$function$;
revoke all on function public.reabrir_fichas(uuid, jsonb, text, text) from public, anon;
grant execute on function public.reabrir_fichas(uuid, jsonb, text, text) to authenticated;

do $ensaio$
declare
  v_perdidos integer;
  v_novos integer;
  v_edital uuid;
  v_quem uuid;
  v_lote jsonb;
  v_qt integer;
  v_motivo text;
  v_reabertas integer;
begin
  if has_function_privilege('anon', 'public.reabrir_fichas(uuid, jsonb, text, text)', 'execute') then
    raise exception 'anon pode chamar reabrir_fichas';
  end if;

  select count(*) into v_perdidos from ensaio_gestores_antes a
   where not private."FC_GESTOR_DO_EDITAL"(a.perfil, a.edital);
  if v_perdidos > 0 then
    raise exception '% par(es) gestor x edital deixariam de coordenar', v_perdidos;
  end if;
  select count(*) into v_novos
    from public."TB_PERFIL_USUARIO" u
    cross join public."TB_MONITORAMENTO_INDIGENA" m
   where u.ativo and u.perfil = 'coordenador' and private."FC_GESTOR_DO_EDITAL"(u.id, m.id);
  raise notice 'Coordenador x edital que passam a coordenar: %', v_novos;

  -- Um edital com ficha concluida e alguem que o coordena (administrador global, se houver).
  select f."CO_MONITORAMENTO" into v_edital
    from public."TB_FICHA_ANALISE" f where f."TP_SITUACAO" = 'CONCLUIDA' limit 1;
  if v_edital is null then
    raise notice 'Sem ficha concluida: a reabertura em lote nao foi ensaiada';
    return;
  end if;
  select u.user_id into v_quem
    from public."TB_PERFIL_USUARIO" u
    join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = u.perfil and a."ST_ADMIN_GLOBAL"
   where u.ativo and u.user_id is not null limit 1;
  if v_quem is null then
    raise notice 'Sem administrador global ativo: a reabertura em lote nao foi ensaiada';
    return;
  end if;
  perform set_config('request.jwt.claim.sub', v_quem::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_quem, 'role', 'authenticated')::text, true);

  select jsonb_agg(jsonb_build_object('ficha', f."CO_FICHA_ANALISE", 'versao', f."NU_VERSAO")), count(*)
    into v_lote, v_qt
    from (select * from public."TB_FICHA_ANALISE"
           where "CO_MONITORAMENTO" = v_edital and "TP_SITUACAO" = 'CONCLUIDA' limit 3) f;
  -- Um codigo valido da lista de motivos (o primeiro que FC_MOTIVO_REABERTURA reconhece).
  select c into v_motivo from unnest(array['COORDENACAO','RECURSO','OUTRO']) c
   where private."FC_MOTIVO_REABERTURA"(c) is not null limit 1;
  if v_motivo is null then raise exception 'Nenhum motivo da lista reconhecido: conferir FC_MOTIVO_REABERTURA'; end if;

  execute 'set local role authenticated';
  select (public.reabrir_fichas(v_edital, v_lote, v_motivo,
          case when v_motivo = 'OUTRO' then 'Ensaio da reabertura em lote pela fila' end) ->> 'reabertas')::integer
    into v_reabertas;
  execute 'reset role';

  if v_reabertas <> v_qt then
    raise exception 'Reabertas % de %', v_reabertas, v_qt;
  end if;
  select count(*) into v_qt
    from jsonb_to_recordset(v_lote) x(ficha uuid, versao integer)
    join public."TB_FICHA_ANALISE" f on f."CO_FICHA_ANALISE" = x.ficha
   where f."TP_SITUACAO" in ('EM_ANALISE', 'PENDENTE') and f."NU_VERSAO" = x.versao + 1;
  if v_qt <> v_reabertas then
    raise exception 'Situacao ou versao inesperada depois de reabrir';
  end if;
  raise notice 'Ensaio ok: % ficha(s) reaberta(s) no edital %', v_reabertas, v_edital;
end $ensaio$;

rollback;
