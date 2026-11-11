/*
  ENSAIO de 20261111210000_exportacao_do_resumo_por_cargo.sql

  Roda no SQL Editor (papel postgres) ANTES de aplicar e depois de
  20261110190000. Termina em rollback: nada fica no banco. Nenhum dado de
  candidato aparece no resultado: só contagens, códigos de erro e o NOTICE final.

  O que confere:
    A. Aplica o corpo da migration, igual ao arquivo.
    B. Estrutura: a coluna com padrão LISTA; a assinatura antiga saiu; a nova é
       SECURITY DEFINER com search_path vazio, execute só para authenticated.
    C. Sem sessão: 28000 (com p_conteudo RESUMO).
    D. Como um administrador global (simulado pelo JWT só nesta transação), na
       área com mais candidatos vigentes: registra LISTA sem p_conteudo e
       RESUMO com ele; recusa conteúdo inválido (22023).
  Ok = termina com NOTICE "Ensaio 20261111210000 ok" e ROLLBACK.
*/
begin;

-- A. O corpo da migration ------------------------------------------------------------------
set local lock_timeout = '5s';

-- 0. Guardas ---------------------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TL_EXPORTACAO_APROVADO"') is null
     or to_regprocedure('public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer)') is null then
    raise exception 'Falta a migration 20261110190000 (exportação da Lista de aprovados): aplique-a antes.';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'TL_EXPORTACAO_APROVADO' and column_name = 'TP_CONTEUDO'
  ) then
    raise exception 'A migration 20261111210000 já foi aplicada (TL_EXPORTACAO_APROVADO.TP_CONTEUDO existe).';
  end if;
end;
$$;

-- 1. O que foi exportado: a lista nominal ou o resumo por cargo e status ---------------------
alter table public."TL_EXPORTACAO_APROVADO"
  add column "TP_CONTEUDO" character varying(6) default 'LISTA' not null,
  add constraint "CK_EXPAPROV_TPCONTEUDO" check ("TP_CONTEUDO" in ('LISTA', 'RESUMO'));

comment on column public."TL_EXPORTACAO_APROVADO"."TP_CONTEUDO" is 'O que saiu no arquivo: LISTA (nominal, aba Aprovados) ou RESUMO (contagem por cargo e status, sem dado de candidato).';
comment on constraint "CK_EXPAPROV_TPCONTEUDO" on public."TL_EXPORTACAO_APROVADO" is 'Conteúdos válidos da exportação.';
comment on table public."TL_EXPORTACAO_APROVADO" is 'Cada exportação da Lista de aprovados (XLSX, CSV ou PDF, gerada no navegador): área, formato, conteúdo (lista ou resumo), filtros, total do recorte no banco, registros exportados, quem e quando. Sem dado de candidato. Grava só registrar_exportacao_aprovados.';

-- 2. A RPC com p_conteudo (padrão LISTA: o front publicado continua igual) -------------------
drop function public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer);

create function public.registrar_exportacao_aprovados(
  p_area text,
  p_formato text,
  p_editais uuid[],
  p_cargos text[] default '{}'::text[],
  p_modalidades text[] default '{}'::text[],
  p_situacoes text[] default '{}'::text[],
  p_recorte_do_aviso boolean default false,
  p_total_na_tela integer default null,
  p_registros integer default null,
  p_conteudo text default 'LISTA'
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
  v_conteudo text := upper(btrim(coalesce(p_conteudo, 'LISTA')));
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
  if v_conteudo not in ('LISTA', 'RESUMO') then
    raise exception 'Conteúdo inválido: LISTA ou RESUMO.' using errcode = '22023';
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
    "CO_AREA", "TP_FORMATO", "TP_CONTEUDO", "DS_FILTRO", "QT_EDITAL", "QT_RECORTE", "QT_REGISTRO",
    "CO_USUARIO", "NO_USUARIO", "DS_EMAIL_USUARIO"
  ) values (
    v_area, v_formato, v_conteudo,
    jsonb_build_object(
      'editais', to_jsonb(v_editais), 'cargos', to_jsonb(v_cargos),
      'modalidades', to_jsonb(v_modalidades), 'situacoes', to_jsonb(v_situacoes),
      'recorte_do_aviso', coalesce(p_recorte_do_aviso, false)),
    cardinality(v_editais), v_recorte, p_registros,
    (select auth.uid()), v_autor.nome, v_autor.email
  ) returning "CO_EXPORTACAO_APROVADO", "DT_EMISSAO" into v_id, v_emitida;

  return json_build_object(
    'exportacao_id', v_id, 'emitida_em', v_emitida,
    'recorte', v_recorte, 'registros', p_registros, 'conteudo', v_conteudo);
end;
$$;

revoke all on function public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer, text) from public, anon;
grant execute on function public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer, text) to authenticated;

comment on function public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer, text) is 'Registra a exportação da Lista de aprovados antes de o navegador gerar o arquivo: sessão, aprovados >= leitor, área do usuário, editais só da área com lista vigente, sem treinamento e visíveis à coordenação; recalcula o total da lista vigente nos editais, cargos e modalidades e recusa (40001) se a tela tem outro número. p_conteudo: LISTA (padrão) ou RESUMO (Resumo por cargo e status). Grava TL_EXPORTACAO_APROVADO e devolve exportacao_id, emitida_em e conteudo.';

do $ensaio$
declare
  v_sql text := 'select public.registrar_exportacao_aprovados($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)';
  v_sql_antigo text := 'select public.registrar_exportacao_aprovados(p_area => $1, p_formato => $2, p_editais => $3, p_total_na_tela => $4, p_registros => $5)';
  v_admin uuid;
  v_email text;
  v_area text;
  v_editais uuid[];
  v_total integer;
  v_r json;
begin
  -- B. Estrutura.
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'TL_EXPORTACAO_APROVADO'
       and column_name = 'TP_CONTEUDO' and is_nullable = 'NO' and column_default like '%LISTA%'
  ) then
    raise exception 'Ensaio: TP_CONTEUDO ausente, nulo ou sem o padrão LISTA.';
  end if;
  if to_regprocedure('public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer)') is not null then
    raise exception 'Ensaio: a assinatura antiga continua lá (ambiguidade no PostgREST).';
  end if;
  if has_function_privilege('anon', 'public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer, text)', 'execute')
     or not has_function_privilege('authenticated', 'public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer, text)', 'execute') then
    raise exception 'Ensaio: execute da RPC errado (anon não pode, authenticated pode).';
  end if;
  if not exists (
    select 1 from pg_proc p
     where p.oid = 'public.registrar_exportacao_aprovados(text, text, uuid[], text[], text[], text[], boolean, integer, integer, text)'::regprocedure
       and p.prosecdef and 'search_path=""' = any (p.proconfig)
  ) then
    raise exception 'Ensaio: a RPC não é SECURITY DEFINER com search_path vazio.';
  end if;

  -- C. Sem sessão.
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    execute v_sql using 'saude-indigena', 'CSV', array[gen_random_uuid()], '{}'::text[], '{}'::text[], '{}'::text[], false, 0, 0, 'RESUMO';
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
    raise notice 'Ensaio 20261111210000: sem administrador global ativo; parte D pulada.';
    raise notice 'Ensaio 20261111210000 ok';
    return;
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'email', v_email, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  select m."CO_AREA" into v_area
    from public."TB_LISTA_APROVADO" l
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
    join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
   where l.vigente is true and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
   group by m."CO_AREA"
   order by count(*) desc
   limit 1;
  if v_area is null then
    raise notice 'Ensaio 20261111210000: nenhuma lista vigente; parte D pulada.';
    raise notice 'Ensaio 20261111210000 ok';
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

  -- Sem p_conteudo (o front publicado): LISTA.
  execute v_sql_antigo into v_r using v_area, 'CSV', v_editais, v_total, v_total;
  if (v_r ->> 'conteudo') <> 'LISTA' or not exists (
    select 1 from public."TL_EXPORTACAO_APROVADO"
     where "CO_EXPORTACAO_APROVADO" = (v_r ->> 'exportacao_id')::uuid and "TP_CONTEUDO" = 'LISTA'
  ) then
    raise exception 'Ensaio: sem p_conteudo, não registrou LISTA.';
  end if;

  -- O resumo.
  execute v_sql into v_r using v_area, 'pdf', v_editais, '{}'::text[], '{}'::text[], '{}'::text[], false, v_total, v_total, 'resumo';
  if (v_r ->> 'conteudo') <> 'RESUMO' or not exists (
    select 1 from public."TL_EXPORTACAO_APROVADO"
     where "CO_EXPORTACAO_APROVADO" = (v_r ->> 'exportacao_id')::uuid
       and "TP_CONTEUDO" = 'RESUMO' and "TP_FORMATO" = 'PDF' and "QT_RECORTE" = v_total
  ) then
    raise exception 'Ensaio: o resumo não ficou registrado como RESUMO.';
  end if;

  -- Conteúdo inválido.
  begin
    execute v_sql using v_area, 'CSV', v_editais, '{}'::text[], '{}'::text[], '{}'::text[], false, v_total, v_total, 'NOMES';
    raise exception 'Ensaio: conteúdo inválido passou.';
  exception when sqlstate '22023' then null;
  end;

  raise notice 'Ensaio 20261111210000 ok (área com % candidatos vigentes em % editais)', v_total, cardinality(v_editais);
end;
$ensaio$;

rollback;
