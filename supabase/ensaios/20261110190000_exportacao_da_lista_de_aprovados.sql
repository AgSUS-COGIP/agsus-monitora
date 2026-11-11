/*
  ENSAIO de 20261110190000_exportacao_da_lista_de_aprovados.sql

  Roda no SQL Editor (papel postgres) ANTES de aplicar. Termina em rollback:
  nada fica no banco. Nenhum dado de candidato aparece no resultado: só
  contagens, códigos de erro e o NOTICE final.

  O que confere:
    A. Aplica o corpo da migration, igual ao arquivo (o teste
       tests/exportacao-de-aprovados-no-banco.test.ts confere).
    B. Estrutura: a tabela com RLS e sem privilégio para anon/authenticated; a
       RPC SECURITY DEFINER com search_path vazio, sem execute para anon.
    C. Sem sessão: 28000.
    D. Como um administrador global de verdade (o primeiro ativo, simulado pelo
       JWT só dentro desta transação), na área com mais candidatos vigentes:
       - o total da lista vigente que a RPC conta é o mesmo de
         listar_candidatos_aprovados (a fonte da tela), por área;
       - registra com o total certo e devolve exportacao_id e emitida_em;
       - recusa: total diferente (40001), edital de outra área (42501), formato
         inválido (22023), situação inválida (22023), registros acima do recorte
         e recorte incompleto sem filtro de situação (22023).
  Ok = termina com NOTICE "Ensaio 20261110190000 ok" e ROLLBACK.
*/
begin;

-- A. O corpo da migration ------------------------------------------------------------------
set local lock_timeout = '5s';

-- 0. Guardas ---------------------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TL_EXPORTACAO_APROVADO"') is not null then
    raise exception 'A migration 20261110190000 já foi aplicada (TL_EXPORTACAO_APROVADO existe).';
  end if;
  if to_regclass('public."TB_AREA"') is null
     or to_regclass('public."TB_LISTA_APROVADO"') is null
     or to_regclass('public."TB_CANDIDATO_APROVADO"') is null
     or to_regclass('public."TB_MONITORAMENTO_INDIGENA"') is null
     or to_regprocedure('private.pode_recurso(text, integer)') is null
     or to_regprocedure('private."FC_AREAS_USUARIO"()') is null
     or to_regprocedure('private."FC_EDITAIS_VISIVEIS"()') is null
     or to_regprocedure('private."FC_EH_TREINAMENTO"(text)') is null
     or to_regprocedure('private.autor_da_sessao()') is null then
    raise exception 'Faltam objetos da Lista de aprovados ou das permissões; confira o banco antes de aplicar.';
  end if;
end;
$$;

-- 1. O registro das exportações -----------------------------------------------------------
create table public."TL_EXPORTACAO_APROVADO" (
  "CO_EXPORTACAO_APROVADO" uuid default gen_random_uuid() not null,
  "CO_AREA" text not null,
  "TP_FORMATO" character varying(4) not null,
  "DS_FILTRO" jsonb not null,
  "QT_EDITAL" integer not null,
  "QT_RECORTE" integer not null,
  "QT_REGISTRO" integer not null,
  "CO_USUARIO" uuid not null,
  "NO_USUARIO" character varying(255),
  "DS_EMAIL_USUARIO" character varying(320),
  "DT_EMISSAO" timestamp with time zone default now() not null,
  constraint "PK_TL_EXPORTACAO_APROVADO" primary key ("CO_EXPORTACAO_APROVADO"),
  constraint "FK_AREA_EXPAPROV" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA"),
  constraint "CK_EXPAPROV_TPFORMATO" check ("TP_FORMATO" in ('XLSX', 'CSV', 'PDF')),
  constraint "CK_EXPAPROV_DSFILTRO" check (jsonb_typeof("DS_FILTRO") = 'object'),
  constraint "CK_EXPAPROV_QUANTIDADES" check (
    "QT_EDITAL" >= 1 and "QT_RECORTE" >= 0 and "QT_REGISTRO" >= 0 and "QT_REGISTRO" <= "QT_RECORTE"
  )
);

create index "IN_EXPAPROV_AREA_DATA" on public."TL_EXPORTACAO_APROVADO" using btree ("CO_AREA", "DT_EMISSAO" desc);
create index "IN_EXPAPROV_USUARIO_DATA" on public."TL_EXPORTACAO_APROVADO" using btree ("CO_USUARIO", "DT_EMISSAO" desc);

alter table public."TL_EXPORTACAO_APROVADO" enable row level security;
revoke all on table public."TL_EXPORTACAO_APROVADO" from public, anon, authenticated;

comment on table public."TL_EXPORTACAO_APROVADO" is 'Cada exportação da Lista de aprovados (XLSX, CSV ou PDF, gerada no navegador): área, formato, filtros, total do recorte no banco, registros exportados, quem e quando. Sem dado de candidato. Grava só registrar_exportacao_aprovados.';
comment on column public."TL_EXPORTACAO_APROVADO"."CO_EXPORTACAO_APROVADO" is 'Identificador da exportação (sai no arquivo).';
comment on column public."TL_EXPORTACAO_APROVADO"."CO_AREA" is 'Área da lista exportada.';
comment on column public."TL_EXPORTACAO_APROVADO"."TP_FORMATO" is 'Formato do arquivo: XLSX, CSV ou PDF.';
comment on column public."TL_EXPORTACAO_APROVADO"."DS_FILTRO" is 'Filtros da exportação: editais (ids), cargos, modalidades, situações e se veio do recorte de um aviso. Sem dado de candidato.';
comment on column public."TL_EXPORTACAO_APROVADO"."QT_EDITAL" is 'Quantos editais entraram na exportação.';
comment on column public."TL_EXPORTACAO_APROVADO"."QT_RECORTE" is 'Candidatos da lista vigente nos editais, cargos e modalidades pedidos, contados pelo banco na hora.';
comment on column public."TL_EXPORTACAO_APROVADO"."QT_REGISTRO" is 'Registros que saíram no arquivo (com o filtro de situação e o recorte do aviso).';
comment on column public."TL_EXPORTACAO_APROVADO"."CO_USUARIO" is 'Quem exportou (auth.uid()).';
comment on column public."TL_EXPORTACAO_APROVADO"."NO_USUARIO" is 'Nome de quem exportou, no momento.';
comment on column public."TL_EXPORTACAO_APROVADO"."DS_EMAIL_USUARIO" is 'E-mail de quem exportou, no momento.';
comment on column public."TL_EXPORTACAO_APROVADO"."DT_EMISSAO" is 'Data e hora da emissão (do servidor; sai no arquivo).';
comment on constraint "FK_AREA_EXPAPROV" on public."TL_EXPORTACAO_APROVADO" is 'Área da exportação.';
comment on constraint "CK_EXPAPROV_TPFORMATO" on public."TL_EXPORTACAO_APROVADO" is 'Formatos válidos.';
comment on constraint "CK_EXPAPROV_DSFILTRO" on public."TL_EXPORTACAO_APROVADO" is 'Os filtros são um objeto JSON.';
comment on constraint "CK_EXPAPROV_QUANTIDADES" on public."TL_EXPORTACAO_APROVADO" is 'Ao menos um edital; os registros exportados não passam do recorte.';
comment on index public."IN_EXPAPROV_AREA_DATA" is 'Exportações da área, das mais novas.';
comment on index public."IN_EXPAPROV_USUARIO_DATA" is 'Exportações de cada usuário, das mais novas.';

-- 2. A RPC ---------------------------------------------------------------------------------------
create function public.registrar_exportacao_aprovados(
  p_area text,
  p_formato text,
  p_editais uuid[],
  p_cargos text[] default '{}'::text[],
  p_modalidades text[] default '{}'::text[],
  p_situacoes text[] default '{}'::text[],
  p_recorte_do_aviso boolean default false,
  p_total_na_tela integer default null,
  p_registros integer default null
) returns json
language plpgsql
security definer
set search_path to ''
set statement_timeout to '15s'
as $$
declare
  c_situacoes constant text[] := array[
    '__sem_status__', 'Convocado', 'Contratado', 'Contratado em outra lista',
    'Desistente', 'Migração', 'Documentação Rejeitada'];
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_formato text := upper(btrim(coalesce(p_formato, '')));
  v_editais uuid[];
  v_cargos text[];
  v_modalidades text[];
  v_situacoes text[];
  v_visiveis uuid[];
  v_recorte integer;
  v_autor record;
  v_id uuid;
  v_emitida timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão não localizada.' using errcode = '28000';
  end if;
  if not private.pode_recurso('aprovados', 1) then
    raise exception 'Sem permissão para exportar a lista de aprovados.' using errcode = '42501';
  end if;
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida.' using errcode = '22023';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para a lista de aprovados desta área.' using errcode = '42501';
  end if;
  if v_formato not in ('XLSX', 'CSV', 'PDF') then
    raise exception 'Formato inválido: escolha XLSX, CSV ou PDF.' using errcode = '22023';
  end if;

  -- Os filtros: sem nulos, sem repetir, com limite de tamanho (nada de texto livre longo).
  select coalesce(array_agg(distinct e), '{}') into v_editais
    from unnest(coalesce(p_editais, '{}'::uuid[])) e where e is not null;
  select coalesce(array_agg(distinct btrim(x)), '{}') into v_cargos
    from unnest(coalesce(p_cargos, '{}'::text[])) x where nullif(btrim(x), '') is not null;
  select coalesce(array_agg(distinct btrim(x)), '{}') into v_modalidades
    from unnest(coalesce(p_modalidades, '{}'::text[])) x where nullif(btrim(x), '') is not null;
  select coalesce(array_agg(distinct btrim(x)), '{}') into v_situacoes
    from unnest(coalesce(p_situacoes, '{}'::text[])) x where nullif(btrim(x), '') is not null;

  if cardinality(v_editais) = 0 then
    raise exception 'Nenhum edital para exportar.' using errcode = '22023';
  end if;
  if cardinality(v_editais) > 1000 or cardinality(v_cargos) > 1000 or cardinality(v_modalidades) > 200 then
    raise exception 'Filtros demais para uma exportação.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_cargos || v_modalidades) x where length(x) > 300) then
    raise exception 'Cargo ou modalidade com mais de 300 caracteres.' using errcode = '22023';
  end if;
  if not (v_situacoes <@ c_situacoes) then
    raise exception 'Situação inválida.' using errcode = '22023';
  end if;
  if p_total_na_tela is null or p_total_na_tela < 0 or p_registros is null or p_registros < 0 then
    raise exception 'Informe o total da tela e os registros exportados.' using errcode = '22023';
  end if;

  -- Cada edital: da área, com lista vigente, fora de treinamento e visível para a coordenação.
  v_visiveis := private."FC_EDITAIS_VISIVEIS"();
  if exists (
    select 1 from unnest(v_editais) e
     where not exists (
       select 1
         from public."TB_MONITORAMENTO_INDIGENA" m
         join public."TB_LISTA_APROVADO" l on l.edital_id = m.id::text and l.vigente is true
        where m.id = e
          and m."CO_AREA" = v_area
          and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
          and (v_visiveis is null or m.id = any (v_visiveis))
     )
  ) then
    raise exception 'Há edital fora da área, sem lista vigente ou sem permissão.' using errcode = '42501';
  end if;

  -- O total da lista vigente no recorte, contado aqui (o da tela pode estar velho).
  select count(*)::integer into v_recorte
    from public."TB_LISTA_APROVADO" l
    join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
   where l.vigente is true
     and l.edital_id = any (array(select e::text from unnest(v_editais) e))
     and (cardinality(v_cargos) = 0 or btrim(coalesce(c.cargo, '')) = any (v_cargos))
     and (cardinality(v_modalidades) = 0 or btrim(coalesce(c.modalidade, '')) = any (v_modalidades));

  if v_recorte <> p_total_na_tela then
    raise exception 'A lista mudou desde que a tela foi carregada (% na tela, % no banco). Clique em Atualizar e exporte de novo.',
      p_total_na_tela, v_recorte using errcode = '40001';
  end if;
  if p_registros > v_recorte then
    raise exception 'Mais registros que o total da lista vigente.' using errcode = '22023';
  end if;
  if cardinality(v_situacoes) = 0 and not coalesce(p_recorte_do_aviso, false) and p_registros <> v_recorte then
    raise exception 'Sem filtro de situação, a exportação leva a lista vigente inteira do recorte.' using errcode = '22023';
  end if;

  select * into v_autor from private.autor_da_sessao();
  insert into public."TL_EXPORTACAO_APROVADO" (
    "CO_AREA", "TP_FORMATO", "DS_FILTRO", "QT_EDITAL", "QT_RECORTE", "QT_REGISTRO",
    "CO_USUARIO", "NO_USUARIO", "DS_EMAIL_USUARIO"
  ) values (
    v_area, v_formato,
    jsonb_build_object(
      'editais', to_jsonb(v_editais), 'cargos', to_jsonb(v_cargos),
      'modalidades', to_jsonb(v_modalidades), 'situacoes', to_jsonb(v_situacoes),
      'recorte_do_aviso', coalesce(p_recorte_do_aviso, false)),
    cardinality(v_editais), v_recorte, p_registros,
    (select auth.uid()), v_autor.nome, v_autor.email
  ) returning "CO_EXPORTACAO_APROVADO", "DT_EMISSAO" into v_id, v_emitida;

  return json_build_object(
    'exportacao_id', v_id, 'emitida_em', v_emitida,
    'recorte', v_recorte, 'registros', p_registros);
end;
$$;

revoke all on function public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer) from public, anon;
grant execute on function public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer) to authenticated;

comment on function public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer) is 'Registra a exportação da Lista de aprovados antes de o navegador gerar o arquivo: sessão, aprovados >= leitor, área do usuário, editais só da área com lista vigente, sem treinamento e visíveis à coordenação; recalcula o total da lista vigente nos editais, cargos e modalidades e recusa (40001) se a tela tem outro número. Grava TL_EXPORTACAO_APROVADO e devolve exportacao_id e emitida_em.';

-- B, C e D ---------------------------------------------------------------------------------
do $ensaio$
declare
  v_admin uuid;
  v_email text;
  v_area text;
  v_outra uuid;
  v_editais uuid[];
  v_total integer;
  v_pela_tela integer;
  v_r json;
  v_estado text;
  v_n integer;

  -- Chama a RPC e devolve o SQLSTATE ('ok' quando passa).
  v_sql text := 'select public.registrar_exportacao_aprovados($1, $2, $3, $4, $5, $6, $7, $8, $9)';
begin
  -- B. Estrutura.
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public."TL_EXPORTACAO_APROVADO"'::regclass) then
    raise exception 'Ensaio: TL_EXPORTACAO_APROVADO sem RLS.';
  end if;
  if has_table_privilege('authenticated', 'public."TL_EXPORTACAO_APROVADO"', 'select')
     or has_table_privilege('anon', 'public."TL_EXPORTACAO_APROVADO"', 'select')
     or has_table_privilege('authenticated', 'public."TL_EXPORTACAO_APROVADO"', 'insert') then
    raise exception 'Ensaio: TL_EXPORTACAO_APROVADO com privilégio para anon/authenticated.';
  end if;
  if has_function_privilege('anon', 'public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer)', 'execute')
     or not has_function_privilege('authenticated', 'public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer)', 'execute') then
    raise exception 'Ensaio: execute da RPC errado (anon não pode, authenticated pode).';
  end if;
  if not exists (
    select 1 from pg_proc p
     where p.oid = 'public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer)'::regprocedure
       and p.prosecdef and 'search_path=""' = any (p.proconfig)
  ) then
    raise exception 'Ensaio: a RPC não é SECURITY DEFINER com search_path vazio.';
  end if;

  -- C. Sem sessão.
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    execute v_sql using 'saude-indigena', 'CSV', array[gen_random_uuid()], '{}'::text[], '{}'::text[], '{}'::text[], false, 0, 0;
    raise exception 'Ensaio: sem sessão, a RPC registrou.';
  exception when sqlstate '28000' then null;
  end;

  -- D. Como um administrador global.
  select p.user_id, lower(p.email) into v_admin, v_email
    from public."TB_PERFIL_USUARIO" p
    join public."TB_GRUPO_ACESSO" a on a."CO_GRUPO_ACESSO" = p.perfil
   where p.ativo is true and a."ST_ADMIN_GLOBAL" and p.user_id is not null
   order by p.updated_at desc nulls last
   limit 1;
  if v_admin is null then
    raise notice 'Ensaio 20261110190000: sem administrador global ativo; parte D pulada.';
    raise notice 'Ensaio 20261110190000 ok';
    return;
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'email', v_email, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  -- A área com mais candidatos vigentes (fora de treinamento).
  select m."CO_AREA" into v_area
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
    join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
   where l.vigente is true and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
   group by m."CO_AREA"
   order by count(*) desc
   limit 1;
  if v_area is null then
    raise notice 'Ensaio 20261110190000: nenhuma lista vigente; parte D pulada.';
    raise notice 'Ensaio 20261110190000 ok';
    return;
  end if;

  select array_agg(distinct m.id) into v_editais
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
   where l.vigente is true and m."CO_AREA" = v_area
     and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO");
  select count(*) into v_total
    from public."TB_LISTA_APROVADO" l
    join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
   where l.vigente is true and l.edital_id = any (array(select e::text from unnest(v_editais) e));

  -- A fonte da tela conta o mesmo nos editais da área.
  select count(*) into v_pela_tela
    from public.listar_candidatos_aprovados() t
   where t.edital_id = any (array(select e::text from unnest(v_editais) e));
  if v_pela_tela <> v_total then
    raise exception 'Ensaio: a RPC contaria % e listar_candidatos_aprovados dá %.', v_total, v_pela_tela;
  end if;

  -- Registra com o total certo.
  execute v_sql into v_r using v_area, 'xlsx', v_editais, '{}'::text[], '{}'::text[], '{}'::text[], false, v_total, v_total;
  if (v_r ->> 'exportacao_id') is null or (v_r ->> 'emitida_em') is null or (v_r ->> 'recorte')::integer <> v_total then
    raise exception 'Ensaio: resposta incompleta da RPC.';
  end if;
  select count(*) into v_n from public."TL_EXPORTACAO_APROVADO"
   where "CO_EXPORTACAO_APROVADO" = (v_r ->> 'exportacao_id')::uuid
     and "TP_FORMATO" = 'XLSX' and "QT_RECORTE" = v_total and "CO_USUARIO" = v_admin;
  if v_n <> 1 then
    raise exception 'Ensaio: a exportação não ficou registrada como pedida.';
  end if;

  -- As recusas.
  select m.id into v_outra
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m."CO_AREA" is distinct from v_area
   limit 1;
  for v_estado in
    select x from (values
      ('40001'), ('42501'), ('22023'), ('22023s'), ('22023r'), ('22023i')) t(x)
  loop
    begin
      case v_estado
        when '40001' then
          execute v_sql using v_area, 'CSV', v_editais, '{}'::text[], '{}'::text[], '{}'::text[], false, v_total + 1, v_total + 1;
        when '42501' then
          if v_outra is null then continue; end if;
          execute v_sql using v_area, 'CSV', v_editais || v_outra, '{}'::text[], '{}'::text[], '{}'::text[], false, v_total, v_total;
        when '22023' then
          execute v_sql using v_area, 'XLS', v_editais, '{}'::text[], '{}'::text[], '{}'::text[], false, v_total, v_total;
        when '22023s' then
          execute v_sql using v_area, 'PDF', v_editais, '{}'::text[], '{}'::text[], array['Aprovado'], false, v_total, 0;
        when '22023r' then
          execute v_sql using v_area, 'PDF', v_editais, '{}'::text[], '{}'::text[], array['Contratado'], false, v_total, v_total + 1;
        when '22023i' then
          if v_total = 0 then continue; end if;
          execute v_sql using v_area, 'PDF', v_editais, '{}'::text[], '{}'::text[], '{}'::text[], false, v_total, v_total - 1;
      end case;
      raise exception 'Ensaio: o caso % passou.', v_estado;
    exception
      when sqlstate '40001' or sqlstate '42501' or sqlstate '22023' then
        if left(v_estado, 5) <> sqlstate then
          raise exception 'Ensaio: o caso % deu %.', v_estado, sqlstate;
        end if;
    end;
  end loop;

  raise notice 'Ensaio 20261110190000 ok (área com % candidatos vigentes em % editais)', v_total, cardinality(v_editais);
end;
$ensaio$;

rollback;
