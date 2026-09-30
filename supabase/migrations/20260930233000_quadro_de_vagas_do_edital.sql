/*
  Quadro de vagas do edital (Anexo II), importado do PDF de anexos.

  O formulário do edital manda o PDF para /api/anexos-do-edital (Python), a
  pessoa confere o cronograma e o quadro e salva. O cronograma continua indo
  por salvar_monitoramento_com_cronograma_v2; o quadro vem para cá.

  1. TB_QUADRO_VAGA_EDITAL: uma linha por cargo × lotação, com as vagas por
     modalidade (jsonb: as modalidades mudam de edital para edital — Projetos
     não tem nenhuma, a SI tem cinco), o total de vagas imediatas e se há
     cadastro reserva. Salvar de novo desativa o quadro anterior (fica o
     histórico) e grava o novo inteiro.
  2. private.FC_QUADRO_DA_VAGA liga a vaga da análise (nome_vaga, que vem da
     planilha: "Enfermeiro - Polo Base Leonardo em Excel (questionário…") à
     linha do quadro pelas palavras do cargo e da lotação. Sem ligação única
     (cargo em várias lotações e a vaga não diz qual), não liga.
  3. obter_entrevistas_do_edital: as vagas imediatas vêm, nesta ordem, do que
     foi digitado na entrevista, do quadro do edital e da lista de convocação;
     'vagas_imediatas_origem' diz de onde veio.
  4. RPCs obter_quadro_de_vagas / salvar_quadro_de_vagas (Núcleo ou
     Calendário; salvar exige editor).

  Rollback: supabase/rollback/20260930233000_quadro_de_vagas_do_edital.sql
*/
begin;

-- ---------------------------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------------------------
create table public."TB_QUADRO_VAGA_EDITAL" (
  "CO_QUADRO_VAGA" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "NU_ORDEM" smallint not null,
  "NO_CARGO" varchar(300) not null,
  "NO_LOTACAO" varchar(300),
  "DS_MODALIDADE_VAGA" jsonb not null default '{}'::jsonb,
  "QT_VAGA_IMEDIATA" integer not null default 0,
  "ST_CADASTRO_RESERVA" varchar(1) not null default 'N',
  "TP_ORIGEM" varchar(10) not null default 'PDF',
  "DS_ARQUIVO_ORIGEM" varchar(300),
  "ST_REGISTRO_ATIVO" varchar(1) not null default 'S',
  "CO_USUARIO_ATUALIZACAO" uuid,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_DESATIVACAO" timestamptz,
  constraint "PK_TB_QUADRO_VAGA_EDITAL" primary key ("CO_QUADRO_VAGA"),
  constraint "FK_MONITORAMENTO_QUADROVAGA" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "CK_QUADROVAGA_CARGO" check (length(btrim("NO_CARGO")) between 1 and 300),
  constraint "CK_QUADROVAGA_MODALIDADE" check (jsonb_typeof("DS_MODALIDADE_VAGA") = 'object'),
  constraint "CK_QUADROVAGA_QT" check ("QT_VAGA_IMEDIATA" between 0 and 9999),
  constraint "CK_QUADROVAGA_STCR" check ("ST_CADASTRO_RESERVA" in ('S', 'N')),
  constraint "CK_QUADROVAGA_TPORIGEM" check ("TP_ORIGEM" in ('PDF', 'MANUAL')),
  constraint "CK_QUADROVAGA_STATIVO" check ("ST_REGISTRO_ATIVO" in ('S', 'N'))
);
create index "IN_QUADROVAGA_EDITAL" on public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NU_ORDEM")
  where "ST_REGISTRO_ATIVO" = 'S';

comment on table public."TB_QUADRO_VAGA_EDITAL" is 'Quadro de vagas publicado no edital (Anexo II): cargo, lotação, vagas por modalidade e cadastro reserva. Linha desativada = quadro substituído.';
comment on column public."TB_QUADRO_VAGA_EDITAL"."CO_QUADRO_VAGA" is 'Identificador da linha do quadro.';
comment on column public."TB_QUADRO_VAGA_EDITAL"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA).';
comment on column public."TB_QUADRO_VAGA_EDITAL"."NU_ORDEM" is 'Posição da linha no quadro do edital.';
comment on column public."TB_QUADRO_VAGA_EDITAL"."NO_CARGO" is 'Cargo como publicado ("Enfermeiro").';
comment on column public."TB_QUADRO_VAGA_EDITAL"."NO_LOTACAO" is 'Lotação ("Polo Base Leonardo"); nulo quando o edital não separa por lotação.';
comment on column public."TB_QUADRO_VAGA_EDITAL"."DS_MODALIDADE_VAGA" is 'Vagas imediatas por modalidade, na ordem do edital: {"Ampla Concorrência": 1, "PcD": null, …}; null = só cadastro reserva.';
comment on column public."TB_QUADRO_VAGA_EDITAL"."QT_VAGA_IMEDIATA" is 'Total de vagas de provimento imediato (0 = só cadastro reserva).';
comment on column public."TB_QUADRO_VAGA_EDITAL"."ST_CADASTRO_RESERVA" is 'S: a linha tem cadastro reserva (CR).';
comment on column public."TB_QUADRO_VAGA_EDITAL"."TP_ORIGEM" is 'PDF (importado dos anexos) ou MANUAL.';
comment on column public."TB_QUADRO_VAGA_EDITAL"."DS_ARQUIVO_ORIGEM" is 'Nome do PDF de onde a linha foi lida.';
comment on column public."TB_QUADRO_VAGA_EDITAL"."ST_REGISTRO_ATIVO" is 'S: quadro vigente. N: substituído por uma importação posterior.';
comment on column public."TB_QUADRO_VAGA_EDITAL"."CO_USUARIO_ATUALIZACAO" is 'Usuário (auth.users) que gravou o quadro.';
comment on column public."TB_QUADRO_VAGA_EDITAL"."DT_CRIACAO" is 'Quando o quadro foi gravado.';
comment on column public."TB_QUADRO_VAGA_EDITAL"."DT_DESATIVACAO" is 'Quando o quadro foi substituído.';

alter table public."TB_QUADRO_VAGA_EDITAL" enable row level security;
revoke all on public."TB_QUADRO_VAGA_EDITAL" from anon, authenticated;
grant all on public."TB_QUADRO_VAGA_EDITAL" to service_role;

-- ---------------------------------------------------------------------------
-- 2. Ligação vaga da análise → linha do quadro
-- ---------------------------------------------------------------------------
create function private."FC_TOKENS_VAGA"(p_texto text)
returns text[]
language sql
immutable
set search_path to ''
as $function$
  select coalesce(array_agg(distinct t), '{}')
    from regexp_split_to_table(
           regexp_replace(
             translate(lower(regexp_replace(coalesce(p_texto, ''), '\s+em\s+excel.*$', '', 'i')),
                       'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
             '[^a-z0-9]+', ' ', 'g'),
           ' ') t
   where t <> '' and t not in ('a', 'as', 'o', 'os', 'e', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'para');
$function$;
comment on function private."FC_TOKENS_VAGA"(text) is 'Palavras de um nome de cargo/lotação para comparar a vaga da análise com o quadro do edital: minúsculas, sem acento, sem "em Excel (questionário…" e sem artigos/preposições.';

create function private."FC_QUADRO_DA_VAGA"(p_edital uuid, p_nome_vaga text)
returns uuid
language sql
stable
set search_path to ''
as $function$
  with n as (select private."FC_TOKENS_VAGA"(p_nome_vaga) t),
  q as (
    select c."CO_QUADRO_VAGA" id, private."FC_TOKENS_VAGA"(c."NO_CARGO") tc, private."FC_TOKENS_VAGA"(c."NO_LOTACAO") tl
      from public."TB_QUADRO_VAGA_EDITAL" c
     where c."CO_MONITORAMENTO" = p_edital and c."ST_REGISTRO_ATIVO" = 'S'
  ),
  -- Cargo inteiro contido no nome da vaga; fica o cargo mais específico.
  cargo as (
    select q.id, cardinality(q.tc) nc, cardinality(q.tl) nl, cardinality(q.tl) > 0 and q.tl <@ n.t lotacao,
           -- O que sobra do nome além do cargo ("polo base bauru") não pode contradizer a lotação da linha.
           cardinality(q.tl) = 0 or array(
             select t from unnest(n.t) t
              where not t = any (q.tc) and t !~ '^\d+$' and t not in ('vaga', 'vagas', 'cadastro', 'reserva', 'cr')
           ) <@ q.tl compativel
      from q, n where cardinality(q.tc) > 0 and q.tc <@ n.t
  ),
  melhor as (select * from cargo where nc = (select max(nc) from cargo)),
  -- A lotação no nome decide entre as linhas do mesmo cargo.
  com_lotacao as (select * from melhor where lotacao and nl = (select max(nl) from melhor where lotacao))
  select case
           when (select count(*) from com_lotacao) = 1 then (select id from com_lotacao)
           when (select count(*) from com_lotacao) = 0 and (select count(*) from melhor) = 1
            and (select compativel from melhor) then (select id from melhor)
         end;
$function$;
comment on function private."FC_QUADRO_DA_VAGA"(uuid, text) is 'Linha do quadro de vagas do edital que corresponde à vaga da análise (pelo cargo e, havendo mais de uma lotação, pela lotação no nome). Nula quando não há correspondência única.';

-- ---------------------------------------------------------------------------
-- 3. Leitura e gravação do quadro
-- ---------------------------------------------------------------------------
create function public.obter_quadro_de_vagas(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_m public."TB_MONITORAMENTO_INDIGENA";
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  if v_m.id is null then raise exception 'Edital não encontrado' using errcode = '22023'; end if;
  if not (private.pode_recurso('nucleo', 1) or private.pode_recurso('calendario', 1) or private.pode_recurso('entrevistas', 1)) then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
  return json_build_object(
    'edital', p_edital,
    'linhas', coalesce((
      select json_agg(json_build_object('id', q."CO_QUADRO_VAGA", 'ordem', q."NU_ORDEM", 'cargo', q."NO_CARGO",
               'lotacao', q."NO_LOTACAO", 'modalidades', q."DS_MODALIDADE_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
               'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S') order by q."NU_ORDEM")
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'), '[]'::json),
    'origem', (select json_build_object('tipo', q."TP_ORIGEM", 'arquivo', q."DS_ARQUIVO_ORIGEM", 'gravado_em', q."DT_CRIACAO")
                 from public."TB_QUADRO_VAGA_EDITAL" q
                where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S' limit 1),
    'vinculos', coalesce((
      select json_agg(json_build_object('vaga', v.codigo_vaga, 'cargo', v.cargo,
               'quadro', private."FC_QUADRO_DA_VAGA"(p_edital, v.cargo)) order by v.cargo)
        from (select a.codigo_vaga, min(a.nome_vaga) cargo
                from public."TB_ANALISE_CURRICULAR" a
               where a."CO_AREA" = v_m."CO_AREA" and a.ativo
                 and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)
               group by a.codigo_vaga) v), '[]'::json)
  );
end;
$function$;
comment on function public.obter_quadro_de_vagas(uuid) is 'Quadro de vagas vigente do edital, de onde veio e a que linha cada vaga da análise se liga. Núcleo, Calendário ou Entrevistas (leitor) e o edital.';
revoke all on function public.obter_quadro_de_vagas(uuid) from public, anon;
grant execute on function public.obter_quadro_de_vagas(uuid) to authenticated, service_role;

create function public.salvar_quadro_de_vagas(p_edital uuid, p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_linhas jsonb := coalesce(p_dados -> 'linhas', '[]'::jsonb);
  v_origem text := coalesce(nullif(upper(p_dados ->> 'origem'), ''), 'PDF');
  v_arquivo text := left(nullif(btrim(p_dados ->> 'arquivo'), ''), 300);
begin
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital) then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  if not (private.pode_recurso('nucleo', 2) or private.pode_recurso('calendario', 2)) then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
  if jsonb_typeof(v_linhas) <> 'array' or jsonb_array_length(v_linhas) > 500 then
    raise exception 'Quadro de vagas inválido (até 500 linhas)' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_linhas) l
              where length(btrim(coalesce(l ->> 'cargo', ''))) not between 1 and 300
                 or coalesce(nullif(l ->> 'vagas_imediatas', '')::integer, 0) not between 0 and 9999
                 or jsonb_typeof(coalesce(l -> 'modalidades', '{}'::jsonb)) <> 'object') then
    raise exception 'Há linha do quadro sem cargo ou com quantidade inválida' using errcode = '22023';
  end if;

  update public."TB_QUADRO_VAGA_EDITAL"
     set "ST_REGISTRO_ATIVO" = 'N', "DT_DESATIVACAO" = now()
   where "CO_MONITORAMENTO" = p_edital and "ST_REGISTRO_ATIVO" = 'S';

  insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NU_ORDEM", "NO_CARGO", "NO_LOTACAO", "DS_MODALIDADE_VAGA",
    "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "TP_ORIGEM", "DS_ARQUIVO_ORIGEM", "CO_USUARIO_ATUALIZACAO")
  select p_edital, l.ordem, btrim(l.valor ->> 'cargo'), left(nullif(btrim(l.valor ->> 'lotacao'), ''), 300),
         coalesce(l.valor -> 'modalidades', '{}'::jsonb), coalesce(nullif(l.valor ->> 'vagas_imediatas', '')::integer, 0),
         case when (l.valor ->> 'cadastro_reserva')::boolean then 'S' else 'N' end,
         v_origem, v_arquivo, (select auth.uid())
    from jsonb_array_elements(v_linhas) with ordinality l(valor, ordem);

  return public.obter_quadro_de_vagas(p_edital);
end;
$function$;
comment on function public.salvar_quadro_de_vagas(uuid, jsonb) is 'Substitui o quadro de vagas do edital (o anterior fica desativado). p_dados: {origem PDF|MANUAL, arquivo, linhas:[{cargo, lotacao, modalidades, vagas_imediatas, cadastro_reserva}]}. Núcleo ou Calendário (editor) e o edital.';
revoke all on function public.salvar_quadro_de_vagas(uuid, jsonb) from public, anon;
grant execute on function public.salvar_quadro_de_vagas(uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Entrevista: vagas imediatas também do quadro do edital
-- ---------------------------------------------------------------------------
create or replace function public.obter_entrevistas_do_edital(p_edital uuid)
 returns json
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_cfg public."TB_ENTREVISTA_EDITAL";
  v_eu uuid;
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  select * into v_cfg from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  select p.id into v_eu from private.current_profile() p;
  return json_build_object(
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area),
    'pode_editar', private.pode_recurso('entrevistas', 2),
    'admin_global', private.is_master(),
    'meu_perfil', v_eu,
    'configuracao', case when v_cfg."CO_MONITORAMENTO" is null then null else json_build_object(
        'roteiro', private."FC_ROTEIRO_JSON"(v_cfg."CO_ROTEIRO"), 'convocacao', v_cfg."DS_CONVOCACAO",
        'banca', v_cfg."DS_BANCA", 'lancamento', v_cfg."TP_LANCAMENTO", 'atualizado_em', v_cfg."DT_ATUALIZACAO") end,
    'vagas', coalesce((
      select json_agg(json_build_object('vaga', v.codigo_vaga, 'cargo', v.cargo, 'aprovados', v.aprovados,
               'vagas_imediatas', coalesce(v.manual, v.do_quadro, v.da_lista),
               'vagas_imediatas_origem', case when v.manual is not null then 'manual' when v.do_quadro is not null then 'quadro'
                                              when v.da_lista is not null then 'lista' end,
               'lotacao_quadro', v.lotacao_quadro,
               'vagas_imediatas_salvas', v.manual is not null) order by v.cargo)
        from (select x.*, ev."QT_VAGA_IMEDIATA" manual, qv."QT_VAGA_IMEDIATA" do_quadro,
                     nullif(concat_ws(' — ', qv."NO_CARGO", qv."NO_LOTACAO"), '') lotacao_quadro,
                     (select vi."QT_VAGA_IMEDIATA" from public."TB_VAGA_IMEDIATA" vi
                       where vi."CO_EDITAL" = p_edital::text and (vi."CO_VAGA" = x.codigo_vaga or upper(vi."NO_CARGO") = upper(x.cargo)) limit 1) da_lista
                from (select a.codigo_vaga, min(a.nome_vaga) cargo, count(*) filter (where a.status_consolidado = 'Aprovado') aprovados
                        from public."TB_ANALISE_CURRICULAR" a
                       where a."CO_AREA" = v_area and a.ativo
                         and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)
                       group by a.codigo_vaga) x
                left join public."TB_ENTREVISTA_VAGA" ev on ev."CO_MONITORAMENTO" = p_edital and ev."CO_VAGA" = x.codigo_vaga
                left join public."TB_QUADRO_VAGA_EDITAL" qv on qv."CO_QUADRO_VAGA" = private."FC_QUADRO_DA_VAGA"(p_edital, x.cargo)) v), '[]'::json),
    'candidatos', coalesce((
      select json_agg(json_build_object('analise_id', c.id, 'candidato', c.candidato, 'codigo', c.id_origem,
               'vaga', c.codigo_vaga, 'cargo', c.nome_vaga, 'nota_analise', c.nota_final_ajustada,
               'modalidade', c.modalidade_concorrencia, 'pcd', c.pcd, 'posicao', c.posicao)
             order by c.codigo_vaga, c.posicao)
        from (select a.*, row_number() over (partition by a.codigo_vaga
                                             order by a.nota_final_ajustada desc nulls last, a.candidato) posicao
                from public."TB_ANALISE_CURRICULAR" a
               where a."CO_AREA" = v_area and a.ativo and a.status_consolidado = 'Aprovado'
                 and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)) c), '[]'::json),
    'avaliadores', coalesce((
      select json_agg(json_build_object('id', b."CO_AVALIADOR", 'nome', b."NO_AVALIADOR", 'origem', b."NO_ORIGEM",
               'banca', b."NU_BANCA", 'perfil', b."CO_PERFIL_USUARIO", 'ativo', b."ST_ATIVO" = 'S') order by b."NU_BANCA", b."NO_ORIGEM", b."NO_AVALIADOR")
        from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'convocados', coalesce((
      select json_agg(json_build_object('id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR",
               'candidato', e."NO_CANDIDATO", 'codigo', e."CO_CANDIDATO", 'vaga', e."CO_VAGA", 'cargo', e."NO_CARGO",
               'modalidade', e."DS_MODALIDADE", 'banca', e."NU_BANCA", 'compareceu', e."ST_COMPARECEU",
               'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'nota_analise', a.nota_final_ajustada,
               'avaliacoes', coalesce((select json_agg(json_build_object('competencia', x."CO_COMPETENCIA",
                      'avaliador', x."CO_AVALIADOR", 'nota', x."VL_NOTA"))
                   from public."TB_ENTREVISTA_AVALIACAO" x where x."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json),
               'notas', coalesce((select json_agg(json_build_array(n."NU_ORDEM", n."VL_NOTA") order by n."NU_ORDEM")
                   from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
        left join public."TB_ANALISE_CURRICULAR" a on a.id = e."CO_ANALISE_CURRICULAR"
       where e."CO_MONITORAMENTO" = p_edital and e."TP_ORIGEM" = 'sistema' and e."ST_ATIVO" = 'S'), '[]'::json)
  );
end;
$function$;

commit;
