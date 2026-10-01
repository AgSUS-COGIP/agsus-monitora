-- Desfaz 20261001150000_sub_judice_alteracao: volta incluir/remover_sub_judice e o
-- pacote da lista de aprovados às versões de 20260930200000 e 20260929210000, e
-- apaga alterar/desfazer, o histórico e as colunas da alteração judicial.
-- Recusa enquanto houver candidato com alteração judicial: desfaça antes
-- (desfazer_alteracao_sub_judice), senão a nota alterada ficaria sem o original.
-- A classificação renumerada pelas inclusões/remoções não volta.
begin;

do $$
begin
  if exists (select 1 from public."TB_CANDIDATO_APROVADO" where alterado_judicialmente) then
    raise exception 'Há candidatos com alteração judicial: desfaça antes de reverter a migration';
  end if;
end;
$$;

drop function public.alterar_candidato_sub_judice(uuid, numeric, text, text, text);
drop function public.desfazer_alteracao_sub_judice(uuid, text);
drop function public.incluir_sub_judice(text, text, text, numeric, text, text, text);

CREATE OR REPLACE FUNCTION public.incluir_sub_judice(p_edital_id text, p_cargo text, p_nome text, p_nota numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.papel_recurso('aprovados');
  v_lista public."TB_LISTA_APROVADO"%rowtype;
  v_candidato_id uuid;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital_id);
  if not (private.pode_recurso('aprovados',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_cargo, '')), '') is null then raise exception 'Cargo obrigatorio'; end if;
  if nullif(btrim(coalesce(p_nome, '')), '') is null then raise exception 'Nome obrigatorio'; end if;
  if p_nota is null or p_nota < 0 then raise exception 'Nota invalida'; end if;

  select * into v_lista
  from public."TB_LISTA_APROVADO"
  where edital_id = p_edital_id and vigente is true
  for update;
  if not found then raise exception 'O edital ainda nao possui lista vigente'; end if;
  if not v_lista.ativo then raise exception 'A lista esta inativa e nao permite incluir sub judice'; end if;

  if not exists (
    select 1 from public."TB_CANDIDATO_APROVADO"
    where lista_id = v_lista.id and removido_em is null and cargo = btrim(p_cargo)
  ) then
    raise exception 'Cargo nao pertence a lista vigente deste edital';
  end if;

  insert into public."TB_CANDIDATO_APROVADO"(
    lista_id, cargo, nota, nome, sub_judice, created_by, updated_by
  ) values (
    v_lista.id, btrim(p_cargo), p_nota, btrim(p_nome), true,
    (select auth.uid()), (select auth.uid())
  ) returning id into v_candidato_id;

  return jsonb_build_object('ok', true, 'candidato_id', v_candidato_id, 'lista_id', v_lista.id, 'sub_judice', true);
end;
$function$;

revoke all on function public.incluir_sub_judice(text, text, text, numeric) from public, anon;
grant execute on function public.incluir_sub_judice(text, text, text, numeric) to authenticated;

CREATE OR REPLACE FUNCTION public.remover_sub_judice(p_candidato_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.papel_recurso('aprovados');
  v_lista_id uuid;
  v_ativo boolean;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_CANDIDATO_APROVADO" c join public."TB_LISTA_APROVADO" l on l.id = c.lista_id where c.id = p_candidato_id));
  if not (private.pode_recurso('aprovados',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  select c.lista_id, l.ativo into v_lista_id, v_ativo
  from public."TB_CANDIDATO_APROVADO" c
  join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente is true
  where c.id = p_candidato_id and c.sub_judice is true and c.removido_em is null
  for update of c, l;
  if not found then raise exception 'Candidato sub judice vigente nao encontrado'; end if;
  if not v_ativo then raise exception 'A lista esta inativa e nao permite remover sub judice'; end if;

  update public."TB_CANDIDATO_APROVADO"
  set removido_em = now(), removido_por = (select auth.uid()),
      updated_by = (select auth.uid()), updated_at = now()
  where id = p_candidato_id;

  return jsonb_build_object('ok', true, 'candidato_id', p_candidato_id, 'lista_id', v_lista_id);
end;
$function$;

create or replace function private."FC_MONTAR_APROVADOS_AREA"(
  p_area text,
  p_editais uuid[],
  out p_listas json,
  out p_dicionarios json,
  out p_linhas json,
  out p_total integer
)
 language plpgsql
 stable
 set search_path to ''
 set work_mem to '64MB'
 set jit to 'off'
as $function$
begin
  with listas as (
    select l.id, l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome, l.importado_em,
           (row_number() over (order by m.edital, l.id) - 1)::integer as i
      from public."TB_LISTA_APROVADO" l
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
     where l.vigente is true
       and m."CO_AREA" = p_area
       and (p_editais is null or m.id = any (p_editais))
  ), cand as materialized (
    select c.id, li.i as lista, li.edital, c.cargo, c.classificacao, c.nota, c.nome,
           c.modalidade, c.status, c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga
      from listas li
      join public."TB_CANDIDATO_APROVADO" c on c.lista_id = li.id
     where c.removido_em is null
  ), d_cargo as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct cargo as v from cand where cargo is not null) x
  ), d_modalidade as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct modalidade as v from cand where modalidade is not null) x
  ), d_status as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct status as v from cand where status is not null) x
  ), d_codigo as (
    select x.v, (row_number() over (order by x.v) - 1)::integer as i
      from (select distinct codigo_vaga as v from cand where codigo_vaga is not null) x
  )
  select
    (select coalesce(json_agg(json_build_array(
              li.id, li.edital_id, li.edital, li.unidade, li.ativo, li.arquivo_nome, li.importado_em
            ) order by li.i), '[]'::json)
       from listas li),
    json_build_object(
      'cargo', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_cargo d),
      'modalidade', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_modalidade d),
      'status', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_status d),
      'codigo_vaga', (select coalesce(json_agg(d.v order by d.i), '[]'::json) from d_codigo d)
    ),
    -- A ordem da função antiga; o id só desempata (antes o empate saía em qualquer ordem).
    (select coalesce(json_agg(json_build_array(
              c.id, c.lista, dc.i, c.classificacao, c.nota, c.nome, dm.i,
              ds.i, c.processo_sei, c.matricula, c.sub_judice, dv.i
            ) order by c.edital, c.cargo, c.classificacao nulls last, c.nome, c.id), '[]'::json)
       from cand c
       left join d_cargo dc on dc.v = c.cargo
       left join d_modalidade dm on dm.v = c.modalidade
       left join d_status ds on ds.v = c.status
       left join d_codigo dv on dv.v = c.codigo_vaga)
  into p_listas, p_dicionarios, p_linhas;

  p_total := json_array_length(p_linhas);
end;
$function$;

create or replace function public.listar_candidatos_aprovados_compacto(
  p_area text default null,
  p_versao text default null
)
returns json
language plpgsql
security definer
set search_path to ''
set work_mem to '64MB'
set jit to 'off'
as $function$
declare
  v_listas json;
  v_linhas json;
  v_area text;
  v_visiveis uuid[];
  v_versao text;
  v_cache private."TA_CANDIDATO_APROVADO_AREA";
  v_tem_cache boolean := false;
  v_dicionarios json;
  v_total integer;
  v_gerado_em timestamptz := now();
begin
  if not (private.pode_recurso('aprovados',1)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if private.papel_recurso('aprovados') = '' then
    raise exception 'Perfil sem acesso ao sistema';
  end if;

  -- Sem área: a resposta de antes (formato 1), para o front publicado até o deploy.
  if p_area is null then
    -- Dados da lista vão uma vez por lista (≈110), não repetidos em cada candidato.
    select coalesce(json_object_agg(l.id, json_build_array(
             l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome, l.importado_em
           )), '{}'::json)
      into v_listas
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
    where l.vigente is true
      and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
        and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]));

    select coalesce(json_agg(json_build_array(
             c.id, l.id, c.cargo, c.classificacao, c.nota, c.nome, c.modalidade,
             c.status, c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga
           ) order by m.edital, c.cargo, c.classificacao nulls last, c.nome), '[]'::json)
      into v_linhas
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
    join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
    where l.vigente is true
      and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
        and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
      and c.removido_em is null;

    return json_build_object(
      'colunas_da_lista', json_build_array(
        'edital_id', 'edital', 'unidade', 'lista_ativa', 'arquivo_nome', 'importado_em'
      ),
      'listas', v_listas,
      'colunas', json_build_array(
        'candidato_id', 'lista_id', 'cargo', 'classificacao', 'nota', 'nome',
        'modalidade', 'status', 'processo_sei', 'matricula', 'sub_judice',
        'codigo_vaga'
      ),
      'linhas', v_linhas,
      'total', json_array_length(v_linhas)
    );
  end if;

  -- Área válida e do usuário: 22023/42501 antes de qualquer leitura.
  v_area := lower(btrim(p_area));
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida: %', p_area using errcode = '22023';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para a lista de aprovados desta área' using errcode = '42501';
  end if;

  -- Recorte por coordenação: entra na versão (mudou o recorte, a cópia não vale).
  v_visiveis := private."FC_EDITAIS_VISIVEIS"();
  v_versao := private."FC_VERSAO_APROVADOS_AREA"(v_area)
    || case when v_visiveis is null then ''
            else ':' || md5(array(select x from unnest(v_visiveis) x order by x)::text) end;

  if p_versao is not null and p_versao = v_versao then
    return json_build_object('formato', 2, 'area', v_area, 'versao', v_versao, 'inalterado', true);
  end if;

  if v_visiveis is null then
    select * into v_cache from private."TA_CANDIDATO_APROVADO_AREA" c where c."CO_AREA" = v_area;
    v_tem_cache := found and v_cache."DS_VERSAO_DADOS" = v_versao;
    if not v_tem_cache
       and pg_try_advisory_xact_lock(hashtext('aprovados_area:' || v_area)::bigint) then
      -- Venceu: remonta e grava. Falhou a gravação (transação só de leitura,
      -- trava), monta na hora abaixo.
      perform public.atualizar_cache_aprovados(v_area);
      select * into v_cache from private."TA_CANDIDATO_APROVADO_AREA" c where c."CO_AREA" = v_area;
      v_tem_cache := found and v_cache."DS_VERSAO_DADOS" = v_versao;
    end if;
  end if;

  if v_tem_cache then
    v_listas := v_cache."DS_LISTAS";
    v_dicionarios := v_cache."DS_DICIONARIOS";
    v_linhas := v_cache."DS_LINHAS";
    v_total := v_cache."QT_CANDIDATOS";
    v_gerado_em := v_cache."DT_GERACAO";
  else
    -- Com recorte, ou pronto ainda sem a versão de agora: montada na hora.
    select m.p_listas, m.p_dicionarios, m.p_linhas, m.p_total
      into v_listas, v_dicionarios, v_linhas, v_total
      from private."FC_MONTAR_APROVADOS_AREA"(v_area, v_visiveis) m;
  end if;

  return json_build_object(
    'formato', 2,
    'area', v_area,
    'versao', v_versao,
    'inalterado', false,
    'cache', json_build_object('hit', v_tem_cache, 'gerado_em', v_gerado_em),
    'colunas_da_lista', json_build_array(
      'lista_id', 'edital_id', 'edital', 'unidade', 'lista_ativa', 'arquivo_nome', 'importado_em'
    ),
    'listas', v_listas,
    'colunas', json_build_array(
      'candidato_id', 'lista_id', 'cargo', 'classificacao', 'nota', 'nome',
      'modalidade', 'status', 'processo_sei', 'matricula', 'sub_judice',
      'codigo_vaga'
    ),
    'dicionarios', v_dicionarios,
    'linhas', v_linhas,
    'total', v_total
  );
end;
$function$;

drop function private."FC_RECOLOCAR_NA_CLASSIFICACAO"(uuid, text);
drop table public."TH_CANDIDATO_SUB_JUDICE";
alter table public."TB_CANDIDATO_APROVADO"
  drop column alterado_judicialmente,
  drop column nota_original,
  drop column modalidade_original,
  drop column classificacao_original,
  drop column sub_judice_original;

commit;

select public.atualizar_cache_aprovados();
