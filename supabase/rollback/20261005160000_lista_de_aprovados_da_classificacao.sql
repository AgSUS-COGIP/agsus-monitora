-- Desfaz 20261005160000_lista_de_aprovados_da_classificacao: a publicação da lista de aprovados
-- a partir do resultado final da Classificação.
-- ATENÇÃO: apaga o histórico das publicações (TH_PUBLICACAO_APROVADO) e as colunas novas
-- (origem da lista, análise, situação e candidato anterior). As listas publicadas da
-- Classificação CONTINUAM como listas de aprovados (com os candidatos, status e anexos),
-- mas passam a parecer listas sem arquivo: substitua por XLSX se precisar do arquivo.
-- importar_lista_aprovados volta ao corpo de 20260928180000 (sem p_motivo) e
-- listar_listas_aprovados ao de 20260929121200 (sem origem).
begin;

drop function if exists public.publicar_lista_aprovados_da_classificacao(uuid, uuid, jsonb);
drop function if exists public.obter_publicacao_lista_aprovados(uuid, boolean);

drop function if exists public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean, text);
create or replace function public.importar_lista_aprovados(
  p_edital_id text,
  p_ativo boolean,
  p_arquivo_nome text,
  p_arquivo_path text,
  p_candidatos jsonb,
  p_substituir boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := private.papel_recurso('importacao');
  v_autor record;
  v_lista_id uuid;
  v_lista_atual uuid;
  v_ja_teve_lista boolean;
  v_total integer;
  v_edital text;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital_id);
  if not (private.pode_recurso('importacao',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if (select auth.uid()) is null then raise exception 'Usuario nao autenticado'; end if;
  if v_role not in ('edital_gestor', 'contratador', 'admin') then
    raise exception 'Perfil sem permissao para importar lista de aprovados';
  end if;
  if p_edital_id is null then raise exception 'Edital nao informado'; end if;
  if nullif(btrim(p_arquivo_nome), '') is null or nullif(btrim(p_arquivo_path), '') is null then
    raise exception 'Arquivo XLSX nao informado';
  end if;
  if jsonb_typeof(p_candidatos) <> 'array' or jsonb_array_length(p_candidatos) = 0 then
    raise exception 'A lista precisa conter pelo menos um candidato';
  end if;

  select m.edital into v_edital from public."TB_MONITORAMENTO_INDIGENA" m where m.id::text = p_edital_id;
  if not found then raise exception 'Edital nao encontrado na Equipe Nucleo'; end if;

  select exists(select 1 from public."TB_LISTA_APROVADO" where edital_id = p_edital_id)
    into v_ja_teve_lista;
  select id into v_lista_atual
  from public."TB_LISTA_APROVADO"
  where edital_id = p_edital_id and vigente is true
  for update;

  if v_ja_teve_lista and v_role <> 'admin' then
    raise exception 'Somente admin pode substituir ou importar novamente uma lista ja cadastrada';
  end if;
  if v_lista_atual is not null and not coalesce(p_substituir, false) then
    raise exception 'Este edital ja possui lista. Use a opcao de substituicao administrativa';
  end if;
  if coalesce(p_substituir, false) and v_role <> 'admin' then
    raise exception 'Somente admin pode substituir lista de aprovados';
  end if;

  select * into v_autor from private.autor_da_sessao();

  if v_lista_atual is not null then
    update public."TB_LISTA_APROVADO"
    set vigente = false, ativo = false, substituido_por = (select auth.uid()),
        substituido_em = now(), updated_at = now(),
        "DS_EMAIL_SUBSTITUICAO" = v_autor.email,
        "NO_USUARIO_SUBSTITUICAO" = v_autor.nome
    where id = v_lista_atual;
  end if;

  insert into public."TB_LISTA_APROVADO"(
    edital_id, ativo, vigente, arquivo_nome, arquivo_path, importado_por,
    "DS_EMAIL_IMPORTACAO", "NO_USUARIO_IMPORTACAO"
  ) values (
    p_edital_id, coalesce(p_ativo, true), true, btrim(p_arquivo_nome),
    btrim(p_arquivo_path), (select auth.uid()),
    v_autor.email, v_autor.nome
  ) returning id into v_lista_id;

  insert into public."TB_CANDIDATO_APROVADO"(
    lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade,
    sub_judice, created_by, updated_by
  )
  select v_lista_id,
         nullif(btrim(x.codigo_vaga), ''),
         nullif(btrim(x.cargo), ''),
         x.classificacao,
         x.nota,
         nullif(btrim(x.nome), ''),
         nullif(btrim(x.modalidade), ''),
         false,
         (select auth.uid()),
         (select auth.uid())
  from jsonb_to_recordset(p_candidatos) as x(
    codigo_vaga text,
    cargo text,
    classificacao integer,
    nota numeric,
    nome text,
    modalidade text
  );

  get diagnostics v_total = row_count;
  if v_total <> jsonb_array_length(p_candidatos) then
    raise exception 'Nem todos os candidatos puderam ser importados';
  end if;

  return jsonb_build_object(
    'ok', true, 'lista_id', v_lista_id, 'edital_id', p_edital_id,
    'edital', v_edital, 'total', v_total, 'ativo', coalesce(p_ativo, true),
    'importado_por_email', v_autor.email, 'importado_por_nome', v_autor.nome
  );
end;
$function$;
revoke all on function public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean) from public, anon;
grant execute on function public.importar_lista_aprovados(text, boolean, text, text, jsonb, boolean) to authenticated;

drop function if exists public.listar_listas_aprovados();
create function public.listar_listas_aprovados()
returns table (
  lista_id uuid,
  edital_id text,
  edital text,
  unidade text,
  ativo boolean,
  arquivo_nome text,
  arquivo_path text,
  importado_em timestamptz,
  total_candidatos bigint,
  importado_por_email text,
  importado_por_nome text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not ((private.pode_recurso('aprovados') or private.pode_recurso('importacao',2))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  return query
  select l.id, l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome,
         l.arquivo_path, l.importado_em,
         count(c.id) filter (where c.removido_em is null),
         l."DS_EMAIL_IMPORTACAO"::text, l."NO_USUARIO_IMPORTACAO"::text
  from public."TB_LISTA_APROVADO" l
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
  left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
  where l.vigente is true
    and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
  group by l.id, m.edital, m.unidade
  order by m.edital, m.unidade;
end;
$function$;
revoke all on function public.listar_listas_aprovados() from public, anon;
grant execute on function public.listar_listas_aprovados() to authenticated;

drop table if exists public."TH_PUBLICACAO_APROVADO";

alter table public."TB_CANDIDATO_APROVADO"
  drop constraint if exists "FK_CANDAPROVADO_CANDANTERIOR",
  drop constraint if exists "FK_ANALISECURRIC_CANDAPROVADO",
  drop constraint if exists "CK_CANDAPROVADO_TPSITUACAO",
  drop column if exists "CO_CANDIDATO_ANTERIOR",
  drop column if exists "TP_SITUACAO_CLASSIFICACAO",
  drop column if exists "CO_ANALISE_CURRICULAR";

alter table public."TB_LISTA_APROVADO"
  drop constraint if exists "FK_LISTACLASSIF_LISTAAPROVADO",
  drop constraint if exists "CK_LISTAAPROVADO_ORIGEM",
  drop constraint if exists "CK_LISTAAPROVADO_TPORIGEM",
  drop column if exists "CO_LISTA_CLASSIFICACAO",
  drop column if exists "TP_ORIGEM";

commit;
