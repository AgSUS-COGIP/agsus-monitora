/*
  O banco ANTES de 20261110215930 (fundamento conferido da eliminação), no que
  tests/apoio/banco-do-fundamento.ts usa: as funções de sessão e papéis e a
  conferência dos eliminados, copiadas letra por letra do retrato de produção
  (supabase/esquema-atual.sql) da main de 17/11/2026, o último antes da
  aplicação. A guarda md5 da migration confere que são estes corpos. Não é
  migration: não aplicar.
*/

CREATE FUNCTION private.is_master() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
      from public."TB_PERFIL_USUARIO" p
      join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
     where p.user_id = (select auth.uid())
       and p.ativo is true
       and a."ST_ADMIN_GLOBAL"
  );
$$;

CREATE FUNCTION private.current_profile() RETURNS public."TB_PERFIL_USUARIO"
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth', 'pg_temp'
    AS $$
  select p
  from public."TB_PERFIL_USUARIO" p
  where p.ativo = true
    and (
      p.user_id = auth.uid()
      or lower(p.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
    )
  limit 1;
$$;

CREATE FUNCTION private."FC_MOTIVO_COM_SENTIDO"(p_motivo text) RETURNS boolean
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO ''
    AS $$
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
$$;

CREATE FUNCTION private."FC_GESTOR_DO_EDITAL"(p_perfil_usuario uuid, p_edital uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public."TB_PERFIL_USUARIO" u
     where u.id = p_perfil_usuario and u.ativo and u.perfil in ('edital_gestor', 'coordenador')
       and private."FC_NIVEL_AVALIACAO_DO_PERFIL"(u.id) >= 3
       and private."FC_PERFIL_VE_EDITAL"(u.id, p_edital));
$$;

CREATE FUNCTION private."FC_PAPEL_AVALIACAO"(p_edital uuid) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_perfil public."TB_PERFIL_USUARIO";
  v_nivel integer;
begin
  if (select auth.uid()) is null then return null; end if;
  if private.is_master() then return 'COORDENADOR'; end if;
  v_perfil := private.current_profile();
  if v_perfil.id is null or v_perfil.ativo is not true or not private."FC_PODE_VER_EDITAL"(p_edital) then
    return null;
  end if;
  v_nivel := private."FC_RANK_NIVEL"(private.nivel_recurso('avaliacao_documental'));
  if v_nivel >= 3 and (private."FC_GESTOR_DO_EDITAL"(v_perfil.id, p_edital)
                       or exists (select 1 from public."RL_ANALISTA_EDITAL" r
                                   where r."CO_MONITORAMENTO" = p_edital and r."CO_USUARIO" = v_perfil.user_id
                                     and r."TP_PAPEL" = 'COORDENADOR' and r."ST_ATIVO" = 'S')) then
    return 'COORDENADOR';
  end if;
  if v_nivel >= 2 then
    return (select r."TP_PAPEL" from public."RL_ANALISTA_EDITAL" r
             where r."CO_MONITORAMENTO" = p_edital and r."CO_USUARIO" = v_perfil.user_id
               and r."TP_PAPEL" in ('REVISOR', 'ANALISTA') and r."ST_ATIVO" = 'S'
             order by r."TP_PAPEL" = 'REVISOR' desc limit 1);
  end if;
  return null;
end;
$$;

CREATE FUNCTION private."FC_EXIGIR_COORD_AVALIACAO"(p_edital uuid) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_area text := private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 3);
begin
  if private."FC_PAPEL_AVALIACAO"(p_edital) is distinct from 'COORDENADOR' then
    raise exception 'Só o gestor do edital ou a coordenação da avaliação muda a regra e a equipe' using errcode = '42501';
  end if;
  return v_area;
end;
$$;

CREATE FUNCTION public.conferir_eliminados_pre_classificacao(p_edital uuid, p_chaves text[]) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
begin
  if cardinality(p_chaves) > 10000 then
    raise exception 'No máximo 10.000 por vez.' using errcode = '22023';
  end if;
  return (
    with pedidas as (
      select split_part(k, '|', 1) as vaga, split_part(k, '|', 2) as codigo
        from unnest(coalesce(p_chaves, '{}')) k
    ),
    linhas as (
      select a."CO_VAGA"::text as vaga, c."CO_CANDIDATO_EMPREGARE"::text as codigo, c."NO_CANDIDATO" as nome,
             a."TP_SITUACAO" as situacao, a."DS_MOTIVO_ELIMINACAO" as motivo, a."CO_MOTIVO_ELIMINACAO" as motivo_codigo,
             a."NO_MODALIDADE" as modalidade, a."VL_ART" as art, a."VL_NOTA_DECLARADA" as declarada,
             a."VL_NOTA_ORDEM" as nota, a."TP_ORIGEM_NOTA" as origem_nota
        from pedidas p
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_VAGA" = p.vaga and c."CO_CANDIDATO_EMPREGARE"::text = p.codigo
        join public."TB_PRE_CLASSIFICACAO" a
          on a."CO_MONITORAMENTO" = p_edital and a."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO"
    )
    select json_build_object(
      'schema_version', 1,
      'edital', p_edital,
      'candidatos', coalesce((select json_agg(row_to_json(l)) from linhas l), '[]'::json),
      'vagas', coalesce((
        select json_agg(json_build_object('codigo', pv."CO_VAGA", 'cargo', pv."NO_CARGO"))
          from public."TB_PRE_CLASSIF_VAGA" pv
         where pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" in (select distinct l.vaga from linhas l)), '[]'::json)));
end;
$$;
