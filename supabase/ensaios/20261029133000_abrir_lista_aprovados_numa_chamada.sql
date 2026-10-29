-- ENSAIO de supabase/migrations/20261029133000_abrir_lista_aprovados_numa_chamada.sql: roda o corpo e desfaz (rollback).
-- Compara cada parte de abrir_lista_aprovados com a RPC de sempre (recortada pela área), como
-- administrador global (Saúde Indígena e SEDE) e como Gestor na área dele; mede o tempo das sete
-- chamadas e o da uma; confere área inválida (22023 nas partes) e a versão que continua valendo
-- (pacote inalterado). O resultado (json) traz só números e verdadeiro/falso.
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.listar_candidatos_aprovados_compacto(text, text)') is null
     or to_regprocedure('public.listar_modelos_convocacao()') is null
     or to_regprocedure('public.listar_configuracao_convocacao()') is null
     or to_regprocedure('public.listar_convocacoes_aprovados(text)') is null
     or to_regprocedure('public.listar_pendencias_do_edital(text, uuid)') is null
     or to_regclass('private."TA_CANDIDATO_APROVADO_AREA"') is null then
    raise exception 'Faltam as RPCs da Lista de aprovados (pacote por área, convocação, pendências).';
  end if;
end;
$$;

create or replace function public.abrir_lista_aprovados(
  p_area text,
  p_versao text default null,
  p_com_candidatos boolean default true
)
 returns json
 language plpgsql
 security definer
 set search_path to ''
 set statement_timeout to '20s'
as $function$
declare
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_pacote json;
  v_listas json;
  v_modelos json;
  v_configs json;
  v_anexos json;
  v_convocacoes json;
  v_pendencias jsonb;
  v_erros jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sessao nao localizada.' using errcode = '28000';
  end if;

  -- Cada parte com a permissão e o erro de sempre: a falha de uma não derruba as outras.

  -- 1. Os candidatos da área: o pacote do instantâneo (private."TA_CANDIDATO_APROVADO_AREA").
  if p_com_candidatos then
    begin
      v_pacote := public.listar_candidatos_aprovados_compacto(v_area, p_versao);
    exception when others then
      v_erros := v_erros || jsonb_build_object('pacote', jsonb_build_object('code', sqlstate, 'message', sqlerrm));
    end;
  end if;

  -- 2. As listas da área (as colunas de listar_listas_aprovados, só os editais da área).
  begin
    if not (private.pode_recurso('aprovados') or private.pode_recurso('importacao', 2)) then
      raise exception 'Sem permissão para este recurso' using errcode = '42501';
    end if;
    select coalesce(json_agg(json_build_object(
             'lista_id', x.id, 'edital_id', x.edital_id, 'edital', x.edital,
             'unidade', x.unidade, 'ativo', x.ativo, 'arquivo_nome', x.arquivo_nome,
             'arquivo_path', x.arquivo_path, 'importado_em', x.importado_em,
             'total_candidatos', x.total, 'importado_por_email', x.email,
             'importado_por_nome', x.nome, 'origem', x.origem,
             'lista_classificacao_id', x.classificacao)
           order by x.edital, x.unidade), '[]'::json)
      into v_listas
      from (
        select l.id, l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome,
               l.arquivo_path, l.importado_em,
               (select count(*) from public."TB_CANDIDATO_APROVADO" c
                 where c.lista_id = l.id and c.removido_em is null) as total,
               l."DS_EMAIL_IMPORTACAO"::text as email, l."NO_USUARIO_IMPORTACAO"::text as nome,
               l."TP_ORIGEM"::text as origem, l."CO_LISTA_CLASSIFICACAO" as classificacao
          from public."TB_LISTA_APROVADO" l
          join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
         where l.vigente is true
           and m."CO_AREA" = v_area
           and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
           and ((select private."FC_EDITAIS_VISIVEIS"()) is null
                or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
      ) x;
  exception when others then
    v_erros := v_erros || jsonb_build_object('listas', jsonb_build_object('code', sqlstate, 'message', sqlerrm));
  end;

  -- 3. A configuração de convocação (modelos e editais), como as duas RPCs a devolvem.
  begin
    select coalesce(json_agg(m), '[]'::json) into v_modelos from public.listar_modelos_convocacao() m;
    select coalesce(json_agg(c), '[]'::json) into v_configs from public.listar_configuracao_convocacao() c;
  exception when others then
    v_modelos := null;
    v_configs := null;
    v_erros := v_erros || jsonb_build_object('configuracao', jsonb_build_object('code', sqlstate, 'message', sqlerrm));
  end;

  if p_com_candidatos then
    -- 4. Os anexos dos candidatos da área (as colunas de listar_anexos_candidatos_aprovados).
    begin
      if not private.pode_recurso('aprovados', 1) then
        raise exception 'Sem permissão para este recurso' using errcode = '42501';
      end if;
      select coalesce(json_agg(json_build_object(
               'anexo_id', a."CO_ANEXO", 'candidato_id', a."CO_CANDIDATO",
               'arquivo_nome', a."NO_ARQUIVO", 'tamanho', a."QT_TAMANHO_BYTES",
               'incluido_em', a."DT_INCLUSAO")
             order by a."CO_CANDIDATO", a."DT_INCLUSAO"), '[]'::json)
        into v_anexos
        from public."TB_ANEXO_CANDIDATO_APROVADO" a
        join public."TB_CANDIDATO_APROVADO" c on c.id = a."CO_CANDIDATO"
        join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
       where l.vigente is true
         and c.removido_em is null
         and m."CO_AREA" = v_area
         and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
         and ((select private."FC_EDITAIS_VISIVEIS"()) is null
              or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]));
    exception when others then
      v_erros := v_erros || jsonb_build_object('anexos', jsonb_build_object('code', sqlstate, 'message', sqlerrm));
    end;

    -- 5. A data da convocação e as cartas de cada candidato da área.
    begin
      v_convocacoes := public.listar_convocacoes_aprovados(v_area);
    exception when others then
      v_erros := v_erros || jsonb_build_object('convocacoes', jsonb_build_object('code', sqlstate, 'message', sqlerrm));
    end;
  end if;

  -- 6. As pendências da área (o selo da aba Pendências).
  begin
    v_pendencias := public.listar_pendencias_do_edital(v_area, null);
  exception when others then
    v_erros := v_erros || jsonb_build_object('pendencias', jsonb_build_object('code', sqlstate, 'message', sqlerrm));
  end;

  return json_build_object(
    'formato', 1,
    'area', v_area,
    'pacote', v_pacote,
    'listas', v_listas,
    'modelos', v_modelos,
    'configs', v_configs,
    'anexos', v_anexos,
    'convocacoes', v_convocacoes,
    'pendencias', v_pendencias,
    'erros', v_erros
  );
end;
$function$;

comment on function public.abrir_lista_aprovados(text, text, boolean) is
  'A abertura da Lista de aprovados numa chamada: o pacote da área (listar_candidatos_aprovados_compacto, do instantâneo private."TA_CANDIDATO_APROVADO_AREA"), as listas da área, a configuração de convocação, os anexos e as convocações da área e as pendências. Cada parte com a permissão e o erro de sempre, em erros.<parte>; a falha de uma não derruba as outras.';

revoke all on function public.abrir_lista_aprovados(text, text, boolean) from public, anon;
grant execute on function public.abrir_lista_aprovados(text, text, boolean) to authenticated;

-- ═══ CORPO DA MIGRATION (fim) ═══

create temp table t_ensaio (chave text primary key, valor jsonb) on commit drop;
grant all on t_ensaio to authenticated;

-- Quem conferir: um administrador global e um Gestor (edital_gestor).
create temp table t_pessoas on commit drop as
select tipo, user_id, email from (
  select 'admin_global' tipo, p.user_id, p.email,
         row_number() over (order by p.updated_at desc nulls last) n
    from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo and p.user_id is not null and g."ST_ADMIN_GLOBAL"
  union all
  select 'gestor', p.user_id, p.email,
         row_number() over (order by p.updated_at desc nulls last)
    from public."TB_PERFIL_USUARIO" p
   where p.ativo and p.user_id is not null and p.perfil = 'edital_gestor'
) x where n = 1;
grant select on t_pessoas to authenticated;

-- Compara cada parte com a RPC de sempre (recortada pela área, onde a de sempre traz todas).
create or replace function pg_temp.conferir(p_tipo text, p_area text) returns void language plpgsql as $f$
declare
  v_inicio timestamptz;
  v_r json;
  v_ms numeric;
  v_ms_antes numeric;
  v_versao text;
  v_antes json;
begin
  v_inicio := clock_timestamp();
  v_antes := public.listar_candidatos_aprovados_compacto(p_area, null);
  perform count(*) from public.listar_listas_aprovados();
  perform count(*) from public.listar_modelos_convocacao();
  perform count(*) from public.listar_configuracao_convocacao();
  perform count(*) from public.listar_anexos_candidatos_aprovados();
  perform public.listar_convocacoes_aprovados(p_area);
  perform public.listar_pendencias_do_edital(p_area, null);
  v_ms_antes := round(extract(epoch from clock_timestamp() - v_inicio) * 1000);

  v_inicio := clock_timestamp();
  v_r := public.abrir_lista_aprovados(p_area, null);
  v_ms := round(extract(epoch from clock_timestamp() - v_inicio) * 1000);
  v_versao := v_r -> 'pacote' ->> 'versao';

  insert into t_ensaio values (p_tipo || '_' || p_area, jsonb_build_object(
    'ms_sete_chamadas', v_ms_antes,
    'ms_uma_chamada', v_ms,
    'bytes', octet_length(v_r::text),
    'erros', v_r -> 'erros',
    'pacote_igual', ((v_r -> 'pacote')::jsonb - 'cache') = (v_antes::jsonb - 'cache'),
    'listas_iguais', (select coalesce(jsonb_agg(e order by e ->> 'lista_id'), '[]') from jsonb_array_elements((v_r -> 'listas')::jsonb) e)
       = (select coalesce(jsonb_agg(to_jsonb(l) order by l.lista_id::text), '[]') from public.listar_listas_aprovados() l
           join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id where m."CO_AREA" = p_area),
    'listas', json_array_length(v_r -> 'listas'),
    'modelos_iguais', (v_r -> 'modelos')::jsonb = (select coalesce(jsonb_agg(to_jsonb(m)), '[]') from public.listar_modelos_convocacao() m),
    'configs_iguais', (v_r -> 'configs')::jsonb = (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.listar_configuracao_convocacao() c),
    'anexos_iguais', (v_r -> 'anexos')::jsonb = (select coalesce(jsonb_agg(to_jsonb(a) order by a.candidato_id, a.incluido_em), '[]')
           from public.listar_anexos_candidatos_aprovados() a
           join public."TB_CANDIDATO_APROVADO" c on c.id = a.candidato_id
           join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
           join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
          where m."CO_AREA" = p_area),
    'convocacoes_iguais', (v_r -> 'convocacoes')::jsonb = public.listar_convocacoes_aprovados(p_area)::jsonb,
    'pendencias_iguais', ((v_r -> 'pendencias')::jsonb - 'gerado_em') = (public.listar_pendencias_do_edital(p_area, null) - 'gerado_em'),
    'inalterado_com_versao', (public.abrir_lista_aprovados(p_area, v_versao) -> 'pacote' ->> 'inalterado')::boolean));
end;
$f$;
grant execute on function pg_temp.conferir(text, text) to authenticated;

select set_config('request.jwt.claims', json_build_object('sub', user_id, 'email', email, 'role', 'authenticated')::text, true),
       set_config('request.jwt.claim.sub', user_id::text, true)
  from t_pessoas where tipo = 'admin_global';
set local role authenticated;
select pg_temp.conferir('admin_global', 'saude-indigena');
select pg_temp.conferir('admin_global', 'sede');
-- Área inválida: o pacote e as convocações devolvem o 22023 de sempre, em erros.
insert into t_ensaio select 'area_invalida', (public.abrir_lista_aprovados('nao-existe', null) -> 'erros')::jsonb;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', user_id, 'email', email, 'role', 'authenticated')::text, true),
       set_config('request.jwt.claim.sub', user_id::text, true)
  from t_pessoas where tipo = 'gestor';
-- A primeira área do Gestor (FC_AREAS_USUARIO lê a sessão simulada acima).
create temp table t_area_do_gestor on commit drop as select (private."FC_AREAS_USUARIO"())[1] as area;
grant select on t_area_do_gestor to authenticated;
set local role authenticated;
select pg_temp.conferir('gestor', (select area from t_area_do_gestor));
reset role;

select jsonb_object_agg(chave, valor order by chave) as ensaio from t_ensaio;

rollback;
