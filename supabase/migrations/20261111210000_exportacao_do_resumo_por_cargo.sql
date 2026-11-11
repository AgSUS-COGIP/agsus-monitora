/*
  EXPORTAÇÃO DO RESUMO POR CARGO E STATUS (pedido da CORES)

  A aba "Resumo por cargo" da Lista de aprovados exporta a contagem por cargo,
  regime, jornada, vaga e modalidade (XLSX, CSV, PDF), pelo mesmo caminho da
  exportação da lista: registro no banco ANTES de gerar o arquivo. Para o
  registro dizer o que saiu, esta migration:

    1. acrescenta "TP_CONTEUDO" (LISTA | RESUMO, padrão LISTA) a
       public."TL_EXPORTACAO_APROVADO";
    2. troca public.registrar_exportacao_aprovados por uma versão com o
       parâmetro p_conteudo text default 'LISTA' no fim. O corpo é o de
       20261110190000, com a validação do conteúdo, a gravação e o retorno
       'conteudo'. As mesmas conferências de sessão, papel, área, editais e
       total do recorte valem para o resumo (o resumo é contado sobre a mesma
       lista vigente). Nenhum dado de candidato entra no registro.

  DEPENDE de 20261110190000 aplicada (a guarda recusa sem ela).
  ORDEM: aplicar ANTES do merge do front do resumo; sem ela, a exportação do
  resumo avisa que falta a atualização (PGRST202) e a da lista segue igual.
  O front publicado não manda p_conteudo: continua registrando LISTA.

  Ensaio:   supabase/ensaios/20261111210000_exportacao_do_resumo_por_cargo.sql
  Rollback: supabase/rollback/20261111210000_exportacao_do_resumo_por_cargo.sql
  NÃO APLICADA: para revisão.
*/
begin;

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

commit;
