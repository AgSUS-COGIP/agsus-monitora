/*
  ENSAIO de supabase/migrations/20261126190200_marca_das_leituras_sem_o_perfil_dos_outros.sql:
  a mesma mudança e as conferências (só TB_PERFIL_USUARIO sai, e só das duas leituras; as outras
  leituras ficam com as mesmas fontes). Termina em rollback. Sem dado pessoal.
*/

begin;

set local lock_timeout = '5s';

create temp table fontes_antes on commit drop as
  select "NO_LEITURA", "NO_FONTE" from private."TD_FONTE_DA_LEITURA";

do $guarda$
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(boolean)')), E'\r', ''))
       is distinct from 'cf8eb6267f73d966d89619c113cd8680' then
    raise exception 'FC_ATUALIZAR_FONTES_DAS_LEITURAS mudou desde 26/11/2026: refaça a migration a partir do banco' using errcode = '55000';
  end if;
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('private."FC_MARCA_DA_RPC"(text, text, uuid, text, text)')), E'\r', ''))
       is distinct from 'ed4747beef8f3de1309a3a41f6b27a08' then
    raise exception 'FC_MARCA_DA_RPC mudou desde 26/11/2026: refaça a migration a partir do banco' using errcode = '55000';
  end if;
  if (select count(*) from private."TD_LEITURA_POR_MARCA"
       where "NO_LEITURA" in ('acompanhamento_visao_geral', 'selecao_area')) <> 2 then
    raise exception 'As leituras acompanhamento_visao_geral e selecao_area não estão em TD_LEITURA_POR_MARCA' using errcode = '55000';
  end if;
end
$guarda$;

alter table private."TD_LEITURA_POR_MARCA"
  add column "DS_FONTES_PELA_PESSOA" text[] default '{}'::text[] not null;

comment on column private."TD_LEITURA_POR_MARCA"."DS_FONTES_PELA_PESSOA" is
  'Tabelas (esquema.TABELA) que a leitura só lê pela permissão de quem chama (20261126190200): ficam fora de TD_FONTE_DA_LEITURA, e o recorte da pessoa entra na chave da marca (FC_MARCA_DA_RPC). Mudar o perfil de outra pessoa não muda a marca.';

create or replace function private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(p_gatilhos boolean DEFAULT true) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_leitura record;
  v_fontes text[];
  v_tabela text;
  v_rel regclass;
  v_citadas text;
  v_atributos smallint[];
  v_colunas text;
  v_upd record;
  v_gatilho text;
  v_novos text[] := '{}';
  v_contagem jsonb := '{}';
begin
  for v_leitura in select * from private."TD_LEITURA_POR_MARCA" l order by l."NO_LEITURA" loop
    select coalesce(array_agg(distinct x.f order by x.f), '{}') into v_fontes
      from (select f from private."FC_FONTES_PELO_CODIGO"(v_leitura."DS_FUNCOES") f
            union
            select unnest(v_leitura."DS_FONTES_EXTRAS")) x(f)
     -- Fonte lida só pela permissão de quem chama: o recorte da pessoa entra na chave da
     -- marca (FC_MARCA_DA_RPC), e a mudança no perfil de outra pessoa não muda a marca (20261126190200).
     where x.f <> all (v_leitura."DS_FONTES_PELA_PESSOA");
    delete from private."TD_FONTE_DA_LEITURA" f
     where f."NO_LEITURA" = v_leitura."NO_LEITURA" and f."NO_FONTE" <> all (v_fontes);
    insert into private."TD_FONTE_DA_LEITURA" ("NO_LEITURA", "NO_FONTE")
    select v_leitura."NO_LEITURA", u.f from unnest(v_fontes) u(f)
    on conflict do nothing;
    v_contagem := v_contagem || jsonb_build_object(v_leitura."NO_LEITURA", cardinality(v_fontes));

    -- Coluna fora da marca citada no código da leitura: a marca deixaria de mudar
    -- quando ela muda. Recusa (tire a coluna de TD_COLUNA_SEM_MARCA).
    if exists (select 1 from private."TD_COLUNA_SEM_MARCA" c where c."NO_FONTE" = any (v_fontes)) then
      select string_agg(c."NO_FONTE" || '.' || c."NO_COLUNA", ', ' order by c."NO_FONTE", c."NO_COLUNA")
        into v_citadas
        from private."TD_COLUNA_SEM_MARCA" c
       cross join (select private."FC_CODIGO_DA_LEITURA"(v_leitura."DS_FUNCOES") as codigo) x
       where c."NO_FONTE" = any (v_fontes)
         and x.codigo ~ ('\m' || c."NO_COLUNA" || '\M');
      if v_citadas is not null then
        raise exception 'A leitura % cita coluna(s) fora da marca: %. Tire de private."TD_COLUNA_SEM_MARCA".',
          v_leitura."NO_LEITURA", v_citadas using errcode = '22023';
      end if;
    end if;
  end loop;

  if p_gatilhos then
    -- O gatilho antigo (um só, por comando, sem tabela de transição: contava comando de 0 linhas).
    for v_rel in select t.tgrelid::regclass from pg_catalog.pg_trigger t where t.tgname = 'TG_VERSAO_FONTE' loop
      execute format('drop trigger "TG_VERSAO_FONTE" on %s', v_rel);
    end loop;
  end if;

  for v_tabela in select distinct f."NO_FONTE" from private."TD_FONTE_DA_LEITURA" f where p_gatilhos order by 1 loop
    v_rel := to_regclass(format('%I.%I', split_part(v_tabela, '.', 1), split_part(v_tabela, '.', 2)));
    if v_rel is null then
      raise exception 'Fonte inexistente: %', v_tabela using errcode = '42P01';
    end if;

    -- Com coluna fora da marca: UPDATE OF as outras colunas, por linha. Sem: por comando.
    v_atributos := null;
    v_colunas := null;
    if exists (select 1 from private."TD_COLUNA_SEM_MARCA" c
                 join pg_catalog.pg_attribute a
                   on a.attrelid = v_rel and a.attname = c."NO_COLUNA" and a.attnum > 0 and not a.attisdropped
                where c."NO_FONTE" = v_tabela) then
      select array_agg(a.attnum order by a.attnum),
             string_agg(format('%I', a.attname), ', ' order by a.attnum)
        into v_atributos, v_colunas
        from pg_catalog.pg_attribute a
       where a.attrelid = v_rel and a.attnum > 0 and not a.attisdropped
         and not exists (select 1 from private."TD_COLUNA_SEM_MARCA" c
                          where c."NO_FONTE" = v_tabela and c."NO_COLUNA" = a.attname);
    end if;

    -- O gatilho de UPDATE que não é o que devia ser (a lista de colunas mudou) sai e volta.
    select (t.tgtype & 1) = 1 as por_linha,
           array(select x from unnest(t.tgattr::smallint[]) x order by x) as atributos
      into v_upd
      from pg_catalog.pg_trigger t
     where t.tgrelid = v_rel and t.tgname = 'TG_VERSAO_FONTE_UPD';
    if found and (case when v_atributos is null then v_upd.por_linha or cardinality(v_upd.atributos) > 0
                       else not v_upd.por_linha or v_upd.atributos is distinct from v_atributos end) then
      execute format('drop trigger "TG_VERSAO_FONTE_UPD" on %s', v_rel);
    end if;

    foreach v_gatilho in array array['TG_VERSAO_FONTE_INS', 'TG_VERSAO_FONTE_UPD', 'TG_VERSAO_FONTE_DEL', 'TG_VERSAO_FONTE_TRUNC'] loop
      if not exists (select 1 from pg_catalog.pg_trigger t where t.tgrelid = v_rel and t.tgname = v_gatilho) then
        execute format('create trigger %I after %s on %s %s execute function private."FC_TG_VERSAO_FONTE"()',
          v_gatilho,
          case v_gatilho
            when 'TG_VERSAO_FONTE_INS' then 'insert'
            when 'TG_VERSAO_FONTE_DEL' then 'delete'
            when 'TG_VERSAO_FONTE_TRUNC' then 'truncate'
            else case when v_atributos is null then 'update' else 'update of ' || v_colunas end
          end,
          v_rel,
          case v_gatilho
            when 'TG_VERSAO_FONTE_INS' then 'referencing new table as novas for each statement'
            when 'TG_VERSAO_FONTE_DEL' then 'referencing old table as antigas for each statement'
            when 'TG_VERSAO_FONTE_TRUNC' then 'for each statement'
            else case when v_atributos is null then 'referencing new table as novas for each statement'
                      else 'for each row' end
          end);
        if not (v_tabela = any (v_novos)) then
          v_novos := v_novos || v_tabela;
        end if;
      end if;
      -- Vale também com session_replication_role = replica (correções de dados).
      if exists (select 1 from pg_catalog.pg_trigger t
                  where t.tgrelid = v_rel and t.tgname = v_gatilho and t.tgenabled <> 'A') then
        execute format('alter table %s enable always trigger %I', v_rel, v_gatilho);
      end if;
    end loop;
  end loop;

  return jsonb_build_object('leituras', v_contagem, 'gatilhos_novos', to_jsonb(v_novos));
end;
$$;

create or replace function private."FC_MARCA_DA_RPC"(p_rpc text, p_area text DEFAULT NULL::text, p_edital uuid DEFAULT NULL::uuid, p_escopo text DEFAULT NULL::text, p_modulo text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_area text;
  v_escopo text;
  v_modulo text;
  v_pacote text;
  -- O recorte de quem chama (FC_EDITAIS_VISIVEIS: nulo = área inteira), na chave da marca das
  -- leituras com TB_PERFIL_USUARIO em DS_FONTES_PELA_PESSOA (20261126190200).
  v_visiveis uuid[];
begin
  -- A permissão de cada RPC é conferida aqui com os mesmos erros da função de sempre:
  -- a resposta `inalterado` não monta nada, mas também não sai para quem não pode ler.
  case p_rpc
  when 'get_analises_dashboard_payload_v2' then
    v_escopo := lower(btrim(coalesce(p_escopo, 'ativo')));
    v_area := lower(btrim(coalesce(p_area, 'saude-indigena')));
    if not private.pode_recurso('analises') then
      raise exception 'Sem permissão para este recurso' using errcode = '42501';
    end if;
    if v_escopo not in ('ativo', 'inativo', 'desativadas') then
      raise exception 'Escopo invalido. Use ativo, inativo ou desativadas.';
    end if;
    perform private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);
    -- Sem recorte e com pacote de menos de 24 h, a função entrega o pacote e a área.
    if private."FC_EDITAIS_VISIVEIS"() is null then
      select concat_ws('|', (extract(epoch from c."DT_GERACAO") * 1000000)::bigint, c."DS_VERSAO_DADOS")
        into v_pacote
        from private."TA_PAINEL_ANALISE" c
       where c."CO_AREA" = v_area and c."TP_ESCOPO" = v_escopo
         and c."DT_GERACAO" > now() - interval '24 hours';
      if v_pacote is not null
         and not private."FC_CACHE_DESATUALIZADO"('ANALISES', v_area) then
        return private."FC_MARCA_DA_LEITURA"('analises_pacote', concat_ws('|', v_area, v_escopo, v_pacote));
      end if;
    end if;
    return private."FC_MARCA_DA_LEITURA"('analises_painel', concat_ws('|', v_area, v_escopo));

  when 'get_entrevistas_da_area' then
    if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
      raise exception 'Área inválida' using errcode = '22023';
    end if;
    if not private.pode_recurso('entrevistas', 1) then
      raise exception 'Sem permissão para Entrevistas' using errcode = '42501';
    end if;
    if not private."FC_PODE_AREA"(p_area) then
      raise exception 'Sem acesso a esta área' using errcode = '42501';
    end if;
    -- Sem recorte e com pacote, a função entrega o pacote como está (DS_PAYLOAD é not null).
    if private."FC_EDITAIS_VISIVEIS"() is null then
      select concat_ws('|', (extract(epoch from c."DT_GERACAO") * 1000000)::bigint, c."DS_VERSAO_DADOS")
        into v_pacote
        from private."TA_PAINEL_ENTREVISTA" c
       where c."CO_AREA" = p_area;
      if v_pacote is not null then
        return private."FC_MARCA_DA_LEITURA"('entrevistas_pacote', concat_ws('|', p_area, v_pacote));
      end if;
    end if;
    return private."FC_MARCA_DA_LEITURA"('entrevistas_area', p_area);

  when 'get_selecao_da_area' then
    if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
      raise exception 'Área inválida' using errcode = '22023';
    end if;
    if not private.pode_recurso('selecao', 1) then
      raise exception 'Sem permissão para Seleção' using errcode = '42501';
    end if;
    if not private."FC_PODE_AREA"(p_area) then
      raise exception 'Sem acesso a esta área' using errcode = '42501';
    end if;
    v_visiveis := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];
    return private."FC_MARCA_DA_LEITURA"('selecao_area', concat_ws('|', p_area,
      case when v_visiveis is null then 'todos'
           else md5(array(select x from unnest(v_visiveis) x order by x)::text) end));

  when 'listar_acompanhamento_da_visao_geral' then
    v_area := lower(btrim(coalesce(p_area, '')));
    if not private.pode_recurso('dashboard') then
      raise exception 'Sem permissão para este recurso' using errcode = '42501';
    end if;
    if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
      raise exception 'Sem permissão para esta área' using errcode = '42501';
    end if;
    v_visiveis := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];
    return private."FC_MARCA_DA_LEITURA"('acompanhamento_visao_geral', concat_ws('|', v_area,
      case when v_visiveis is null then 'todos'
           else md5(array(select x from unnest(v_visiveis) x order by x)::text) end));

  when 'obter_regra_analise' then
    perform private."FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1);
    return private."FC_MARCA_DA_LEITURA"('regra_analise', p_edital::text);

  when 'obter_classificacao_do_edital' then
    perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 1);
    return private."FC_MARCA_DA_LEITURA"('classificacao_edital', p_edital::text);

  when 'listar_avisos_conferencia' then
    v_area := nullif(lower(btrim(coalesce(p_area, ''))), '');
    v_modulo := nullif(lower(btrim(coalesce(p_modulo, ''))), '');
    if auth.uid() is null then
      raise exception 'Sessão necessária' using errcode = '42501';
    end if;
    if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
      raise exception 'Área inválida' using errcode = '22023';
    end if;
    if v_modulo is not null and v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas', 'editais') then
      raise exception 'Módulo inválido' using errcode = '22023';
    end if;
    return private."FC_MARCA_DA_LEITURA"('avisos_conferencia', concat_ws('|', coalesce(v_area, ''), coalesce(v_modulo, '')));

  else
    raise exception 'RPC sem marca: %', p_rpc using errcode = '22023';
  end case;
end;
$$;

update private."TD_LEITURA_POR_MARCA"
   set "DS_FONTES_PELA_PESSOA" = array['public.TB_PERFIL_USUARIO']
 where "NO_LEITURA" in ('acompanhamento_visao_geral', 'selecao_area');

-- Recalcula as fontes; os gatilhos ficam como estão (TB_PERFIL_USUARIO segue fonte de outras leituras).
select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(false);

do $confere$
begin
  if exists (select 1 from private."TD_FONTE_DA_LEITURA"
              where "NO_LEITURA" in ('acompanhamento_visao_geral', 'selecao_area')
                and "NO_FONTE" = 'public.TB_PERFIL_USUARIO') then
    raise exception 'TB_PERFIL_USUARIO continua fonte das leituras da Visão geral e da Seleção';
  end if;
  if (select count(distinct "NO_LEITURA") from private."TD_FONTE_DA_LEITURA"
       where "NO_LEITURA" in ('acompanhamento_visao_geral', 'selecao_area')) <> 2 then
    raise exception 'Uma das leituras ficou sem fonte (a marca voltaria a montar o pacote a cada chamada)';
  end if;
end
$confere$;

do $ensaio$
declare
  v_sairam text;
  v_entraram text;
begin
  select string_agg(a."NO_LEITURA" || ':' || a."NO_FONTE", ', ' order by a."NO_LEITURA", a."NO_FONTE")
    into v_sairam
    from fontes_antes a
   where not exists (select 1 from private."TD_FONTE_DA_LEITURA" f
                      where f."NO_LEITURA" = a."NO_LEITURA" and f."NO_FONTE" = a."NO_FONTE");
  select string_agg(f."NO_LEITURA" || ':' || f."NO_FONTE", ', ' order by f."NO_LEITURA", f."NO_FONTE")
    into v_entraram
    from private."TD_FONTE_DA_LEITURA" f
   where not exists (select 1 from fontes_antes a
                      where a."NO_LEITURA" = f."NO_LEITURA" and a."NO_FONTE" = f."NO_FONTE");
  if v_entraram is not null then
    raise exception 'Fontes novas inesperadas: %', v_entraram;
  end if;
  if v_sairam is distinct from
     'acompanhamento_visao_geral:public.TB_PERFIL_USUARIO, selecao_area:public.TB_PERFIL_USUARIO' then
    raise exception 'Saíram fontes diferentes das esperadas: %', v_sairam;
  end if;
  raise notice 'Saíram só: %', v_sairam;
end
$ensaio$;

-- As fontes das duas leituras depois da mudança (a última saída do SQL Editor).
select "NO_LEITURA", array_agg("NO_FONTE" order by "NO_FONTE") as fontes
  from private."TD_FONTE_DA_LEITURA"
 where "NO_LEITURA" in ('acompanhamento_visao_geral', 'selecao_area')
 group by 1;

rollback;
