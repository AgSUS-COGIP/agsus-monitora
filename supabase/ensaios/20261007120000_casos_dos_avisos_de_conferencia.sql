/*
  ENSAIO de 20261007120000_casos_dos_avisos_de_conferencia.sql — begin … rollback.

  PRÉ-REQUISITO: 20261005210000_conferencias_de_consistencia.sql aplicada.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela) e:
    E1  confere RLS e grants da tabela nova e das funções;
    E2  grava (papel service_role) um aviso sintético ENSAIO_CASOS com três
        casos — uma análise real, o código real do candidato dela e uma
        referência — e confere que o banco recusa nome, CPF, caso vazio e uuid
        inválido nos casos e que aviso sem 'casos' mantém os guardados;
    E3  cria atores sintéticos (leitor das análises na área, pessoa sem a área e
        o administrador global, no grupo 'admin');
    E4  lê como cada um (papel authenticated): total, páginas, busca por código
        e por nome (sem acento), busca geral, quem não tem a área não vê;
    E5  'casos' troca os guardados; E6 confere a tabela.
  Termina em ROLLBACK: nada fica gravado. Resultado: a linha "ENSAIO OK" do
  SELECT final (só contagens). Qualquer "FALHOU …" interrompe e desfaz tudo.

  Mantenha em sincronia: tests/casos-dos-avisos-migration.test.js confere que o
  corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══
-- 0. Pré-requisito ----------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_AVISO_CONFERENCIA"') is null then
    raise exception 'Aplique antes 20261005210000_conferencias_de_consistencia.sql.';
  end if;
end;
$$;

-- 1. Casos dos avisos -------------------------------------------------------------------
create table public."TB_CASO_AVISO_CONFERENCIA" (
  "CO_AVISO_CONFERENCIA" uuid not null,
  "NU_CASO" integer not null,
  "CO_ANALISE_CURRICULAR" uuid,
  "CO_CANDIDATO_EMPREGARE" varchar(80),
  "DS_REFERENCIA" varchar(80),
  "DS_DETALHE" jsonb not null default '{}'::jsonb,
  constraint "PK_TB_CASO_AVISO_CONFERENCIA" primary key ("CO_AVISO_CONFERENCIA", "NU_CASO"),
  constraint "FK_AVISOCONF_CASOAVISO" foreign key ("CO_AVISO_CONFERENCIA")
    references public."TB_AVISO_CONFERENCIA" ("CO_AVISO_CONFERENCIA") on delete cascade,
  constraint "CK_CASOAVISO_NUCASO" check ("NU_CASO" between 1 and 5000),
  constraint "CK_CASOAVISO_IDENTIFICA" check (
    num_nonnulls("CO_ANALISE_CURRICULAR", "CO_CANDIDATO_EMPREGARE", "DS_REFERENCIA") >= 1),
  constraint "CK_CASOAVISO_CODIGOS" check (
    ("CO_CANDIDATO_EMPREGARE" is null
      or ("CO_CANDIDATO_EMPREGARE" ~ '^[A-Za-z0-9._:/-]{1,80}$' and "CO_CANDIDATO_EMPREGARE" !~ '[0-9]{11}'))
    and ("DS_REFERENCIA" is null
      or ("DS_REFERENCIA" ~ '^[A-Za-z0-9._:/-]{1,80}$' and "DS_REFERENCIA" !~ '[0-9]{11}'))),
  constraint "CK_CASOAVISO_DSDETALHE" check (
    jsonb_typeof("DS_DETALHE") = 'object'
    and length("DS_DETALHE"::text) <= 1000
    and "DS_DETALHE"::text !~ '@'
    and "DS_DETALHE"::text !~ '[0-9]{11}')
);
comment on table public."TB_CASO_AVISO_CONFERENCIA" is 'Casos de cada aviso de conferência (job Python scripts/conferencias/): até 5000 por aviso, só ids, códigos e o dado que motivou o aviso. Nome, edital, vaga e responsável vêm da análise na leitura (listar_casos_aviso_conferencia).';
comment on column public."TB_CASO_AVISO_CONFERENCIA"."CO_AVISO_CONFERENCIA" is 'Aviso (TB_AVISO_CONFERENCIA) do caso.';
comment on column public."TB_CASO_AVISO_CONFERENCIA"."NU_CASO" is 'Posição do caso no aviso (1 a 5000), na ordem em que o job achou.';
comment on column public."TB_CASO_AVISO_CONFERENCIA"."CO_ANALISE_CURRICULAR" is 'Análise curricular do caso (TB_ANALISE_CURRICULAR.id), quando o caso é uma análise. Sem chave estrangeira: a análise pode sair na carga das planilhas e o aviso fica até a próxima conferência.';
comment on column public."TB_CASO_AVISO_CONFERENCIA"."CO_CANDIDATO_EMPREGARE" is 'Código do candidato na Empregare (TB_ANALISE_CURRICULAR.id_origem), quando o caso é o candidato (ex.: analisado em dois editais).';
comment on column public."TB_CASO_AVISO_CONFERENCIA"."DS_REFERENCIA" is 'Outro identificador do caso (entrevista, lista, vaga, aprovado), quando não é análise nem candidato.';
comment on column public."TB_CASO_AVISO_CONFERENCIA"."DS_DETALHE" is 'O dado que motivou o aviso (objeto json: data_analise, inscricao, motivo, nota, corte, soma, experiencia, teto…). Sem nome, CPF ou e-mail.';
comment on constraint "FK_AVISOCONF_CASOAVISO" on public."TB_CASO_AVISO_CONFERENCIA" is 'Aviso do caso; os casos saem junto com o aviso.';
comment on constraint "CK_CASOAVISO_NUCASO" on public."TB_CASO_AVISO_CONFERENCIA" is 'Até 5000 casos por aviso.';
comment on constraint "CK_CASOAVISO_IDENTIFICA" on public."TB_CASO_AVISO_CONFERENCIA" is 'O caso aponta para uma análise, um candidato ou outra referência.';
comment on constraint "CK_CASOAVISO_CODIGOS" on public."TB_CASO_AVISO_CONFERENCIA" is 'Código e referência só com caracteres de identificador, sem 11 dígitos seguidos (CPF).';
comment on constraint "CK_CASOAVISO_DSDETALHE" on public."TB_CASO_AVISO_CONFERENCIA" is 'Detalhe em objeto json de até 1000 caracteres, sem @ (e-mail) e sem 11 dígitos seguidos (CPF).';

alter table public."TB_CASO_AVISO_CONFERENCIA" enable row level security;
revoke all on public."TB_CASO_AVISO_CONFERENCIA" from public, anon, authenticated;

-- As análises do candidato pelo código (candidato em dois editais).
create index if not exists "IN_ANALISECURR_IDORIGEM" on public."TB_ANALISE_CURRICULAR" (id_origem)
  where ativo is true;
comment on index public."IN_ANALISECURR_IDORIGEM" is 'Análises ativas pelo código do candidato na Empregare (casos dos avisos de conferência).';

-- 2. Funções de apoio (privadas) --------------------------------------------------------
create function private."FC_PODE_VER_ANALISE_DO_AVISO"(p_area text, p_edital_norm text, p_unidade_norm text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private.is_master()
      or (p_area is not null
          and private."FC_PODE_AREA"(p_area)
          and (private."FC_EDITAIS_VISIVEIS"() is null
               or p_edital_norm = any (coalesce(private."FC_EDITAIS_NORM_VISIVEIS"(), '{}'))
               or p_unidade_norm = any (coalesce(private."FC_UNIDADES_NORM_VISIVEIS"(), '{}'))));
$function$;
comment on function private."FC_PODE_VER_ANALISE_DO_AVISO"(text, text, text) is 'Quem chama vê os dados (nome, vaga, responsável) desta análise num caso de aviso? Administrador global sempre; os demais com a área da análise e, com recorte por coordenação, o edital ou a unidade no recorte (o mesmo do painel das análises).';

create function private."FC_TEXTO_DE_BUSCA"(p_texto text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select regexp_replace(
    translate(lower(btrim(coalesce(p_texto, ''))),
              'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn'),
    '\s+', ' ', 'g');
$function$;
comment on function private."FC_TEXTO_DE_BUSCA"(text) is 'Texto para busca: sem acento, sem caixa e com espaços simples.';

revoke all on function private."FC_PODE_VER_ANALISE_DO_AVISO"(text, text, text) from public, anon, authenticated;
revoke all on function private."FC_TEXTO_DE_BUSCA"(text) from public, anon, authenticated;

-- 3. Gravação: o aviso traz os casos ----------------------------------------------------
create or replace function public.gravar_avisos_conferencia(p_execucao text, p_avisos jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_aviso jsonb;
  v_atual public."TB_AVISO_CONFERENCIA";
  v_id uuid;
  v_conferencia text;
  v_escopo text;
  v_gravidade text;
  v_modulo text;
  v_area text;
  v_edital uuid;
  v_qt integer;
  v_exemplos jsonb;
  v_casos jsonb;
  v_resumo text;
  v_novos integer := 0;
  v_reabertos integer := 0;
  v_mantidos integer := 0;
begin
  perform private."FC_EXIGIR_EXECUCAO_CONFERENCIA"(p_execucao);
  if jsonb_typeof(p_avisos) is distinct from 'array' or jsonb_array_length(p_avisos) > 1000 then
    raise exception 'Envie até 1000 avisos por chamada, em lista' using errcode = '22023';
  end if;

  for v_aviso in select x from jsonb_array_elements(p_avisos) x loop
    v_conferencia := v_aviso ->> 'conferencia';
    v_escopo := v_aviso ->> 'escopo';
    v_gravidade := v_aviso ->> 'gravidade';
    v_modulo := v_aviso ->> 'modulo';
    v_area := nullif(v_aviso ->> 'area', '');
    v_exemplos := coalesce(v_aviso -> 'exemplos', '[]'::jsonb);
    v_casos := v_aviso -> 'casos';
    v_resumo := btrim(coalesce(v_aviso ->> 'resumo', ''));

    if v_conferencia is null or v_conferencia !~ '^[A-Z][A-Z0-9_]{2,59}$' then
      raise exception 'Código de conferência inválido' using errcode = '22023';
    end if;
    if v_escopo is null or v_escopo !~ '^[a-z_]{2,20}:[A-Za-z0-9._:/|-]{1,170}$' then
      raise exception 'Escopo inválido em %', v_conferencia using errcode = '22023';
    end if;
    if v_gravidade is null or v_gravidade not in ('CRITICA', 'ATENCAO', 'INFORMATIVO') then
      raise exception 'Gravidade inválida em %', v_conferencia using errcode = '22023';
    end if;
    if v_modulo is null or v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas') then
      raise exception 'Módulo inválido em %', v_conferencia using errcode = '22023';
    end if;
    if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
      raise exception 'Área inválida em %', v_conferencia using errcode = '22023';
    end if;
    begin
      v_edital := nullif(v_aviso ->> 'edital', '')::uuid;
      v_qt := (v_aviso ->> 'quantidade')::integer;
    exception when others then
      raise exception 'Edital ou quantidade inválidos em %', v_conferencia using errcode = '22023';
    end;
    if v_edital is not null and not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_edital) then
      raise exception 'Edital inexistente em %', v_conferencia using errcode = '22023';
    end if;
    if v_qt is null or v_qt < 1 then
      raise exception 'Quantidade inválida em %', v_conferencia using errcode = '22023';
    end if;
    if jsonb_typeof(v_exemplos) <> 'array' or jsonb_array_length(v_exemplos) > 20
       or exists (select 1 from jsonb_array_elements(v_exemplos) e
                   where jsonb_typeof(e) <> 'string'
                      or (e #>> '{}') !~ '^[A-Za-z0-9._:/-]{1,80}$'
                      or (e #>> '{}') ~ '[0-9]{11}') then
      raise exception 'Exemplos de % só com ids e códigos (até 20, sem espaço, sem @, sem 11 dígitos)', v_conferencia
        using errcode = '22023';
    end if;
    -- Casos: até 5000 objetos, cada um com análise (uuid), código ou referência
    -- (identificadores) e o detalhe (objeto de valores simples, sem dado pessoal).
    if v_casos is not null and (
         jsonb_typeof(v_casos) <> 'array' or jsonb_array_length(v_casos) > 5000
         or exists (
           select 1 from jsonb_array_elements(v_casos) c
            where jsonb_typeof(c) <> 'object'
               or (c ? 'analise' and jsonb_typeof(c -> 'analise') <> 'null'
                   and coalesce(c ->> 'analise', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
               or (c ? 'codigo' and jsonb_typeof(c -> 'codigo') <> 'null'
                   and (coalesce(c ->> 'codigo', '') !~ '^[A-Za-z0-9._:/-]{1,80}$' or (c ->> 'codigo') ~ '[0-9]{11}'))
               or (c ? 'referencia' and jsonb_typeof(c -> 'referencia') <> 'null'
                   and (coalesce(c ->> 'referencia', '') !~ '^[A-Za-z0-9._:/-]{1,80}$' or (c ->> 'referencia') ~ '[0-9]{11}'))
               or num_nonnulls(nullif(c ->> 'analise', ''), nullif(c ->> 'codigo', ''), nullif(c ->> 'referencia', '')) = 0
               or (c ? 'detalhe' and (
                     jsonb_typeof(c -> 'detalhe') <> 'object'
                     or exists (select 1 from jsonb_each(c -> 'detalhe') d
                                 where d.key !~ '^[a-z_]{1,30}$'
                                    or jsonb_typeof(d.value) not in ('string', 'number', 'boolean', 'null')
                                    or (jsonb_typeof(d.value) = 'string' and (d.value #>> '{}') !~ '^[A-Za-z0-9._:/-]{0,40}$')
                                    or (d.value #>> '{}') ~ '[0-9]{11}')
                     or length((c -> 'detalhe')::text) > 1000))
         )) then
      raise exception 'Casos de % só com ids, códigos e detalhe simples (até 5000, sem nome, @ ou 11 dígitos)', v_conferencia
        using errcode = '22023';
    end if;
    if length(v_resumo) not between 3 and 300 or not private."FC_TEXTO_SEGURO_DO_AVISO"(v_resumo) then
      raise exception 'Resumo de % vazio, longo ou com cara de dado pessoal', v_conferencia using errcode = '22023';
    end if;

    select * into v_atual from public."TB_AVISO_CONFERENCIA" a
     where a."CO_CONFERENCIA" = v_conferencia and a."DS_ESCOPO" = v_escopo
     for update;

    if v_atual."CO_AVISO_CONFERENCIA" is null then
      insert into public."TB_AVISO_CONFERENCIA" (
        "CO_CONFERENCIA", "DS_ESCOPO", "TP_GRAVIDADE", "CO_MODULO", "CO_AREA", "CO_MONITORAMENTO",
        "QT_OCORRENCIA", "DS_EXEMPLO", "DS_RESUMO", "CO_EXECUCAO")
      values (v_conferencia, v_escopo, v_gravidade, v_modulo, v_area, v_edital, v_qt, v_exemplos, v_resumo, p_execucao)
      returning "CO_AVISO_CONFERENCIA" into v_id;
      v_novos := v_novos + 1;
    elsif v_atual."TP_SITUACAO" = 'RESOLVIDO'
       or (v_atual."TP_SITUACAO" = 'IGNORADO' and v_qt > v_atual."QT_OCORRENCIA_IGNORADA") then
      v_id := v_atual."CO_AVISO_CONFERENCIA";
      update public."TB_AVISO_CONFERENCIA" set
        "TP_GRAVIDADE" = v_gravidade, "CO_MODULO" = v_modulo, "CO_AREA" = v_area, "CO_MONITORAMENTO" = v_edital,
        "QT_OCORRENCIA" = v_qt, "DS_EXEMPLO" = v_exemplos, "DS_RESUMO" = v_resumo, "CO_EXECUCAO" = p_execucao,
        "TP_SITUACAO" = 'ABERTO', "DT_ULTIMA_VEZ" = now(), "DT_RESOLUCAO" = null,
        "DT_PRIMEIRA_VEZ" = case when v_atual."TP_SITUACAO" = 'RESOLVIDO' then now() else "DT_PRIMEIRA_VEZ" end,
        "CO_USUARIO_IGNORADO" = null, "DT_IGNORADO" = null, "DS_MOTIVO_IGNORADO" = null, "QT_OCORRENCIA_IGNORADA" = null
       where "CO_AVISO_CONFERENCIA" = v_id;
      v_reabertos := v_reabertos + 1;
    else
      v_id := v_atual."CO_AVISO_CONFERENCIA";
      update public."TB_AVISO_CONFERENCIA" set
        "TP_GRAVIDADE" = v_gravidade, "CO_MODULO" = v_modulo, "CO_AREA" = v_area, "CO_MONITORAMENTO" = v_edital,
        "QT_OCORRENCIA" = v_qt, "DS_EXEMPLO" = v_exemplos, "DS_RESUMO" = v_resumo, "CO_EXECUCAO" = p_execucao,
        "DT_ULTIMA_VEZ" = now()
       where "CO_AVISO_CONFERENCIA" = v_id;
      v_mantidos := v_mantidos + 1;
    end if;

    -- Com 'casos', os do aviso são trocados pelos desta execução.
    if v_casos is not null then
      delete from public."TB_CASO_AVISO_CONFERENCIA" k where k."CO_AVISO_CONFERENCIA" = v_id;
      insert into public."TB_CASO_AVISO_CONFERENCIA" (
        "CO_AVISO_CONFERENCIA", "NU_CASO", "CO_ANALISE_CURRICULAR", "CO_CANDIDATO_EMPREGARE", "DS_REFERENCIA", "DS_DETALHE")
      select v_id, x.ordem::integer, nullif(x.caso ->> 'analise', '')::uuid,
             nullif(x.caso ->> 'codigo', ''), nullif(x.caso ->> 'referencia', ''),
             coalesce(case when jsonb_typeof(x.caso -> 'detalhe') = 'object' then x.caso -> 'detalhe' end, '{}'::jsonb)
        from jsonb_array_elements(v_casos) with ordinality as x(caso, ordem);
    end if;
  end loop;

  update public."TL_CONFERENCIA" set "QT_AVISO_NOVO" = "QT_AVISO_NOVO" + v_novos + v_reabertos
   where "CO_EXECUCAO" = p_execucao;
  return jsonb_build_object('novos', v_novos, 'reabertos', v_reabertos, 'mantidos', v_mantidos);
end;
$function$;
comment on function public.gravar_avisos_conferencia(text, jsonb) is
  'Grava até 1000 avisos de uma execução (um por conferência + escopo): novo abre; resolvido reabre; ignorado reabre só se a quantidade passou da ignorada; aberto atualiza quantidade e exemplos. Com ''casos'' (até 5000: análise, código do candidato, referência e o detalhe que motivou), troca os casos do aviso. Recusa (22023) exemplo ou caso que não seja id ou código (espaço, @, 11 dígitos) e resumo com cara de dado pessoal. Só service_role.';
revoke all on function public.gravar_avisos_conferencia(text, jsonb) from public, anon, authenticated;
grant execute on function public.gravar_avisos_conferencia(text, jsonb) to service_role;

-- 4. Leitura dos casos na tela (authenticated) ------------------------------------------
create function public.listar_casos_aviso_conferencia(
  p_aviso uuid default null,
  p_busca text default null,
  p_area text default null,
  p_modulo text default null,
  p_limite integer default 50,
  p_deslocamento integer default 0)
returns json
language plpgsql
stable
security definer
set search_path to ''
set statement_timeout to '15s'
as $function$
declare
  v_area text := nullif(lower(btrim(coalesce(p_area, ''))), '');
  v_modulo text := nullif(lower(btrim(coalesce(p_modulo, ''))), '');
  v_busca text := nullif(private."FC_TEXTO_DE_BUSCA"(left(coalesce(p_busca, ''), 80)), '');
  v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 1000);
  v_deslocamento integer := greatest(coalesce(p_deslocamento, 0), 0);
  v_total integer;
  v_casos json;
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  if v_area is not null and not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if v_modulo is not null and v_modulo not in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas') then
    raise exception 'Módulo inválido' using errcode = '22023';
  end if;
  if p_aviso is null and v_busca is null then
    raise exception 'Informe o aviso ou o que buscar' using errcode = '22023';
  end if;
  if p_aviso is not null and not exists (
       select 1 from public."TB_AVISO_CONFERENCIA" a
        where a."CO_AVISO_CONFERENCIA" = p_aviso
          and a."TP_SITUACAO" in ('ABERTO', 'IGNORADO')
          and private."FC_PODE_VER_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO")) then
    raise exception 'Aviso não encontrado' using errcode = '22023';
  end if;

  with avisos as (
    select a."CO_AVISO_CONFERENCIA" as id, a."CO_CONFERENCIA" as conferencia
      from public."TB_AVISO_CONFERENCIA" a
     where a."TP_SITUACAO" in ('ABERTO', 'IGNORADO')
       and (p_aviso is null or a."CO_AVISO_CONFERENCIA" = p_aviso)
       and (v_area is null or a."CO_AREA" = v_area)
       and (v_modulo is null or a."CO_MODULO" = v_modulo)
       and private."FC_PODE_VER_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO")
  ),
  casos as (
    select av.id as aviso, av.conferencia, k."NU_CASO" as ordem,
           k."CO_ANALISE_CURRICULAR" as analise_do_caso, k."CO_CANDIDATO_EMPREGARE" as codigo_do_caso,
           k."DS_REFERENCIA" as referencia, k."DS_DETALHE" as detalhe,
           an.id as analise_id, nullif(btrim(an.id_origem), '') as id_origem, an.candidato, an.edital,
           an.codigo_vaga, an.nome_vaga, an.responsavel_analise, an.status_consolidado, an.data_analise
      from avisos av
      join public."TB_CASO_AVISO_CONFERENCIA" k on k."CO_AVISO_CONFERENCIA" = av.id
      left join lateral (
        (select x.id, x.id_origem, x.candidato, x.edital, x.codigo_vaga, x.nome_vaga,
                x.responsavel_analise, x.status_consolidado, x.data_analise
           from public."TB_ANALISE_CURRICULAR" x
          where x.id = k."CO_ANALISE_CURRICULAR"
            and private."FC_PODE_VER_ANALISE_DO_AVISO"(x."CO_AREA", x.edital_norm, x.unidade_norm))
        union all
        (select x.id, x.id_origem, x.candidato, x.edital, x.codigo_vaga, x.nome_vaga,
                x.responsavel_analise, x.status_consolidado, x.data_analise
           from public."TB_ANALISE_CURRICULAR" x
          where k."CO_ANALISE_CURRICULAR" is null
            and x.ativo is true
            and x.id_origem = k."CO_CANDIDATO_EMPREGARE"
            and private."FC_PODE_VER_ANALISE_DO_AVISO"(x."CO_AREA", x.edital_norm, x.unidade_norm)
          order by x.edital, x.id
          limit 1)
        limit 1
      ) an on true
  ),
  filtrados as (
    select c.*, coalesce(c.codigo_do_caso, c.id_origem) as codigo
      from casos c
     where v_busca is null
        or private."FC_TEXTO_DE_BUSCA"(coalesce(c.codigo_do_caso, c.id_origem, '')) like '%' || v_busca || '%'
        or private."FC_TEXTO_DE_BUSCA"(coalesce(c.referencia, '')) like '%' || v_busca || '%'
        or private."FC_TEXTO_DE_BUSCA"(coalesce(c.candidato, '')) like '%' || v_busca || '%'
  ),
  numerados as (
    select f.*,
           row_number() over (order by f.candidato is null, private."FC_TEXTO_DE_BUSCA"(f.candidato),
                                       f.codigo, f.conferencia, f.ordem) as posicao,
           count(*) over () as total
      from filtrados f
  ),
  pagina as (
    select n.* from numerados n
     where n.posicao > v_deslocamento and n.posicao <= v_deslocamento + v_limite
  )
  select (select max(n.total) from numerados n)::integer,
         json_agg(json_build_object(
           'aviso_id', p.aviso,
           'conferencia', p.conferencia,
           'ordem', p.ordem,
           'analise_id', p.analise_id,
           'codigo', p.codigo,
           'nome', p.candidato,
           'edital', p.edital,
           'codigo_vaga', p.codigo_vaga,
           'nome_vaga', p.nome_vaga,
           'responsavel', p.responsavel_analise,
           'status', p.status_consolidado,
           'data_analise', p.data_analise,
           'referencia', p.referencia,
           'detalhe', p.detalhe,
           'analises', case when p.analise_do_caso is null and p.codigo_do_caso is not null then (
             select coalesce(json_agg(json_build_object(
                      'id', x.id, 'edital', x.edital, 'codigo_vaga', x.codigo_vaga, 'nome_vaga', x.nome_vaga,
                      'status', x.status_consolidado, 'responsavel', x.responsavel_analise,
                      'data_analise', x.data_analise) order by x.edital, x.codigo_vaga, x.id), '[]'::json)
               from public."TB_ANALISE_CURRICULAR" x
              where x.ativo is true and x.id_origem = p.codigo_do_caso
                and private."FC_PODE_VER_ANALISE_DO_AVISO"(x."CO_AREA", x.edital_norm, x.unidade_norm)) end,
           'fora_do_acesso', case when p.analise_do_caso is null and p.codigo_do_caso is not null then (
             select count(*)::integer
               from public."TB_ANALISE_CURRICULAR" x
              where x.ativo is true and x.id_origem = p.codigo_do_caso
                and not private."FC_PODE_VER_ANALISE_DO_AVISO"(x."CO_AREA", x.edital_norm, x.unidade_norm)) end
         ) order by p.posicao)
    into v_total, v_casos
    from pagina p;

  return json_build_object(
    'schema_version', 1,
    'total', coalesce(v_total, 0),
    'limite', v_limite,
    'deslocamento', v_deslocamento,
    'casos', coalesce(v_casos, '[]'::json));
end;
$function$;
comment on function public.listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer) is
  'Casos (json, em páginas de até 1000) de um aviso de conferência, ou de todos os avisos abertos e ignorados que quem chama vê (área e módulo opcionais; exige p_busca). Busca por código do candidato, referência ou nome (sem acento e sem caixa). Cada caso: código, nome, edital, vaga, responsável, situação e data da análise (só se a análise for da área e do recorte de quem lê), o detalhe que motivou o aviso e, para o candidato em dois editais, as análises ativas dele que a pessoa vê e quantas ficaram de fora. Sem CPF.';
revoke all on function public.listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer) from public, anon;
grant execute on function public.listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer) to authenticated;

-- ═══ CORPO DA MIGRATION (fim) ═══

-- ENSAIO (tudo abaixo corre na mesma transação e é desfeito no rollback final)

-- E1. Tabela com RLS e sem acesso direto; gravar só service_role; ler só authenticated.
do $$
begin
  if not (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relname = 'TB_CASO_AVISO_CONFERENCIA') then
    raise exception 'FALHOU E1: TB_CASO_AVISO_CONFERENCIA sem RLS';
  end if;
  if has_table_privilege('authenticated', 'public."TB_CASO_AVISO_CONFERENCIA"', 'SELECT')
     or has_table_privilege('anon', 'public."TB_CASO_AVISO_CONFERENCIA"', 'SELECT') then
    raise exception 'FALHOU E1: acesso direto aos casos';
  end if;
  if has_function_privilege('authenticated', 'public.gravar_avisos_conferencia(text, jsonb)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.gravar_avisos_conferencia(text, jsonb)', 'EXECUTE') then
    raise exception 'FALHOU E1: gravar_avisos_conferencia fora do service_role';
  end if;
  if has_function_privilege('anon', 'public.listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.listar_casos_aviso_conferencia(uuid, text, text, text, integer, integer)', 'EXECUTE') then
    raise exception 'FALHOU E1: permissão de listar_casos_aviso_conferencia';
  end if;
  if has_function_privilege('authenticated', 'private."FC_PODE_VER_ANALISE_DO_AVISO"(text, text, text)', 'EXECUTE') then
    raise exception 'FALHOU E1: função privada executável';
  end if;
  raise notice 'ok E1: casos com RLS e sem grant; gravar só service_role; ler só authenticated';
end;
$$;

-- Uma análise ativa real, com código do candidato, e um edital da mesma área (nada deles muda).
select set_config('ensaio.analise', (select a.id::text from public."TB_ANALISE_CURRICULAR" a
                                      where a.ativo and nullif(btrim(a.id_origem), '') is not null
                                        and nullif(btrim(a.candidato), '') is not null
                                        and exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                                                     where m."CO_AREA" = a."CO_AREA")
                                      order by a.id limit 1), true);
select set_config('ensaio.area', (select a."CO_AREA" from public."TB_ANALISE_CURRICULAR" a
                                   where a.id = current_setting('ensaio.analise')::uuid), true),
       set_config('ensaio.codigo', (select btrim(a.id_origem) from public."TB_ANALISE_CURRICULAR" a
                                     where a.id = current_setting('ensaio.analise')::uuid), true);
select set_config('ensaio.edital', (select m.id::text from public."TB_MONITORAMENTO_INDIGENA" m
                                     where m."CO_AREA" = current_setting('ensaio.area') order by m.id limit 1), true);

-- E2. O job (papel service_role): casos gravados, recusados e mantidos.
set local role service_role;
do $$
declare
  c_analise constant text := current_setting('ensaio.analise');
  c_codigo constant text := current_setting('ensaio.codigo');
  c_area constant text := current_setting('ensaio.area');
  c_edital constant text := current_setting('ensaio.edital');
  v jsonb;
  v_aviso jsonb;
begin
  if coalesce(c_analise, '') = '' or coalesce(c_edital, '') = '' then
    raise exception 'FALHOU E2: o banco não tem análise ativa com código numa área com edital';
  end if;
  v_aviso := jsonb_build_object(
    'conferencia', 'ENSAIO_CASOS', 'escopo', 'edital:' || c_edital, 'gravidade', 'ATENCAO',
    'modulo', 'analises', 'area', c_area, 'edital', c_edital, 'quantidade', 3,
    'exemplos', jsonb_build_array(c_analise),
    'resumo', '3 casos do ensaio',
    'casos', jsonb_build_array(
      jsonb_build_object('analise', c_analise,
                         'detalhe', jsonb_build_object('data_analise', '2026-01-02', 'inscricao', '2026-01-05',
                                                       'motivo', 'antes_da_inscricao')),
      jsonb_build_object('codigo', c_codigo),
      jsonb_build_object('referencia', '177979', 'detalhe', jsonb_build_object('nota', 7.5, 'corte', 8))));

  perform public.iniciar_conferencia('ensaio-casos-0001', 'GITHUB');
  begin
    perform public.gravar_avisos_conferencia('ensaio-casos-0001', jsonb_build_array(
      v_aviso || jsonb_build_object('casos', jsonb_build_array(jsonb_build_object('codigo', 'Pessoa Fictícia')))));
    raise exception 'FALHOU E2: aceitou nome no código do caso';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.gravar_avisos_conferencia('ensaio-casos-0001', jsonb_build_array(
      v_aviso || jsonb_build_object('casos', jsonb_build_array(
        jsonb_build_object('referencia', 'x', 'detalhe', jsonb_build_object('cpf', '00000000191'))))));
    raise exception 'FALHOU E2: aceitou CPF no detalhe';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.gravar_avisos_conferencia('ensaio-casos-0001', jsonb_build_array(
      v_aviso || jsonb_build_object('casos', jsonb_build_array(
        jsonb_build_object('referencia', 'x', 'detalhe', jsonb_build_object('nome', 'Pessoa Fictícia'))))));
    raise exception 'FALHOU E2: aceitou nome no detalhe';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.gravar_avisos_conferencia('ensaio-casos-0001', jsonb_build_array(
      v_aviso || jsonb_build_object('casos', jsonb_build_array(jsonb_build_object('detalhe', '{}'::jsonb)))));
    raise exception 'FALHOU E2: aceitou caso sem análise, código nem referência';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.gravar_avisos_conferencia('ensaio-casos-0001', jsonb_build_array(
      v_aviso || jsonb_build_object('casos', jsonb_build_array(jsonb_build_object('analise', 'nao-e-uuid')))));
    raise exception 'FALHOU E2: aceitou análise que não é uuid';
  exception when invalid_parameter_value then null;
  end;

  v := public.gravar_avisos_conferencia('ensaio-casos-0001', jsonb_build_array(v_aviso));
  if (v ->> 'novos')::int <> 1 then raise exception 'FALHOU E2: novo %', v; end if;
  -- Sem 'casos' (job antigo): os guardados ficam.
  v := public.gravar_avisos_conferencia('ensaio-casos-0001', jsonb_build_array(v_aviso - 'casos'));
  if (v ->> 'mantidos')::int <> 1 then raise exception 'FALHOU E2: mantido %', v; end if;
  perform public.finalizar_conferencia('ensaio-casos-0001', array['ENSAIO_CASOS']);
  raise notice 'ok E2: casos gravados; nome, CPF, caso vazio e uuid inválido recusados; sem casos mantém';
end;
$$;
reset role;

-- E3. Atores sintéticos (somem no rollback); o administrador fica no grupo 'admin', o único admin global.
do $$
declare
  c_area constant text := current_setting('ensaio.area');
begin
  insert into public."TB_GRUPO_ACESSO" ("CO_GRUPO_ACESSO", "NO_GRUPO_ACESSO", "DS_GRUPO_ACESSO", "ST_SISTEMA", "ST_ADMIN_GLOBAL", "NU_ORDEM")
  values ('ensaio_casos_leitor', 'Ensaio casos (leitor)', 'Grupo do ensaio: análises leitor.', false, false, 995);
  insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL")
  values ('ensaio_casos_leitor', 'analises', 'leitor')
  on conflict ("CO_GRUPO_ACESSO", "NO_RECURSO") do update set "TP_NIVEL" = excluded."TP_NIVEL";

  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-00000000d201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.casos.admin@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000d202', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.casos.leitor@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000d204', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.casos.semarea@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-00000000d201', 'ensaio.casos.admin@ensaio.invalid', 'Ensaio Admin', 'admin', true),
    ('00000000-0000-4000-a000-00000000d202', 'ensaio.casos.leitor@ensaio.invalid', 'Ensaio Leitor', 'ensaio_casos_leitor', true),
    ('00000000-0000-4000-a000-00000000d204', 'ensaio.casos.semarea@ensaio.invalid', 'Ensaio Sem Área', 'ensaio_casos_leitor', true);
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select p.id, c_area from public."TB_PERFIL_USUARIO" p
   where p.user_id = '00000000-0000-4000-a000-00000000d202';
  raise notice 'ok E3: atores criados';
end;
$$;

-- E4. A tela, como cada pessoa (papel authenticated). Contagens pela RPC: a RLS esconde as tabelas.
set local role authenticated;
do $$
declare
  c_area constant text := current_setting('ensaio.area');
  c_analise constant text := current_setting('ensaio.analise');
  c_codigo constant text := current_setting('ensaio.codigo');
  c_admin constant text := '{"sub":"00000000-0000-4000-a000-00000000d201","role":"authenticated"}';
  c_leitor constant text := '{"sub":"00000000-0000-4000-a000-00000000d202","role":"authenticated"}';
  c_semarea constant text := '{"sub":"00000000-0000-4000-a000-00000000d204","role":"authenticated"}';
  v json;
  v_id uuid;
  v_nome text;
  v_pedaco text;
begin
  perform set_config('request.jwt.claims', c_leitor, true);
  select (a ->> 'id')::uuid into v_id
    from json_array_elements(public.listar_avisos_conferencia(c_area, 'analises') -> 'avisos') a
   where a ->> 'conferencia' = 'ENSAIO_CASOS';
  if v_id is null then raise exception 'FALHOU E4: o leitor não vê o aviso do ensaio'; end if;

  v := public.listar_casos_aviso_conferencia(v_id);
  if (v ->> 'total')::int <> 3 or json_array_length(v -> 'casos') <> 3 then
    raise exception 'FALHOU E4: o leitor devia ver os 3 casos';
  end if;
  if exists (select 1 from json_array_elements(v -> 'casos') c where c::text ~* 'cpf') then
    raise exception 'FALHOU E4: caso com cpf';
  end if;
  select c ->> 'nome' into v_nome from json_array_elements(v -> 'casos') c where c ->> 'ordem' = '1';
  if v_nome is null then raise exception 'FALHOU E4: o caso da análise devia trazer o nome'; end if;
  if (select c ->> 'analise_id' from json_array_elements(v -> 'casos') c where c ->> 'ordem' = '1') is distinct from c_analise
     or (select c ->> 'codigo' from json_array_elements(v -> 'casos') c where c ->> 'ordem' = '1') is distinct from c_codigo then
    raise exception 'FALHOU E4: o caso da análise devia trazer a análise e o código do candidato';
  end if;
  if (select c -> 'detalhe' ->> 'motivo' from json_array_elements(v -> 'casos') c where c ->> 'ordem' = '1') <> 'antes_da_inscricao' then
    raise exception 'FALHOU E4: detalhe do caso';
  end if;
  if (select json_array_length(c -> 'analises') from json_array_elements(v -> 'casos') c where c ->> 'ordem' = '2') < 1 then
    raise exception 'FALHOU E4: o caso pelo código devia listar as análises do candidato';
  end if;

  -- Página de 1 e a última página.
  v := public.listar_casos_aviso_conferencia(v_id, null, null, null, 1, 0);
  if (v ->> 'total')::int <> 3 or json_array_length(v -> 'casos') <> 1 then raise exception 'FALHOU E4: página de 1'; end if;
  v := public.listar_casos_aviso_conferencia(v_id, null, null, null, 2, 2);
  if (v ->> 'total')::int <> 3 or json_array_length(v -> 'casos') <> 1 then raise exception 'FALHOU E4: última página'; end if;

  -- Busca por código, por nome (sem acento, maiúsculas) e geral (todos os avisos).
  v := public.listar_casos_aviso_conferencia(v_id, c_codigo);
  if (v ->> 'total')::int < 2 then raise exception 'FALHOU E4: busca pelo código'; end if;
  v_pedaco := upper(translate(left(btrim(v_nome), 6), 'áàâãéêíóôõúç', 'aaaaeeiooouc'));
  v := public.listar_casos_aviso_conferencia(v_id, v_pedaco);
  if (v ->> 'total')::int < 1 then raise exception 'FALHOU E4: busca pelo nome sem acento'; end if;
  v := public.listar_casos_aviso_conferencia(v_id, 'zzzz-nada-ensaio');
  if (v ->> 'total')::int <> 0 then raise exception 'FALHOU E4: busca sem resultado'; end if;
  v := public.listar_casos_aviso_conferencia(null, '177979', c_area, 'analises');
  if (select count(*) from json_array_elements(v -> 'casos') c where c ->> 'aviso_id' = v_id::text) <> 1 then
    raise exception 'FALHOU E4: busca geral';
  end if;
  begin
    perform public.listar_casos_aviso_conferencia(null, '  ');
    raise exception 'FALHOU E4: sem aviso e sem busca';
  exception when invalid_parameter_value then null;
  end;

  -- Sem a área: não lê os casos nem acha pela busca geral.
  perform set_config('request.jwt.claims', c_semarea, true);
  begin
    perform public.listar_casos_aviso_conferencia(v_id);
    raise exception 'FALHOU E4: quem não tem a área leu os casos';
  exception when invalid_parameter_value then null;
  end;
  if (public.listar_casos_aviso_conferencia(null, c_codigo) ->> 'total')::int <> 0 then
    raise exception 'FALHOU E4: quem não tem a área achou casos pela busca geral';
  end if;

  perform set_config('request.jwt.claims', c_admin, true);
  v := public.listar_casos_aviso_conferencia(v_id);
  if (v ->> 'total')::int <> 3
     or (select c ->> 'nome' from json_array_elements(v -> 'casos') c where c ->> 'ordem' = '1') is distinct from v_nome then
    raise exception 'FALHOU E4: o administrador global devia ver os 3 casos com o nome';
  end if;
  raise notice 'ok E4: leitor vê, pagina e busca; sem área não vê; admin vê tudo';
end;
$$;
reset role;
select set_config('request.jwt.claims', '', true);

-- E5. 'casos' troca os guardados (papel service_role).
set local role service_role;
do $$
declare
  c_area constant text := current_setting('ensaio.area');
  c_edital constant text := current_setting('ensaio.edital');
  v jsonb;
begin
  perform public.iniciar_conferencia('ensaio-casos-0002', 'GITHUB');
  v := public.gravar_avisos_conferencia('ensaio-casos-0002', jsonb_build_array(jsonb_build_object(
    'conferencia', 'ENSAIO_CASOS', 'escopo', 'edital:' || c_edital, 'gravidade', 'ATENCAO',
    'modulo', 'analises', 'area', c_area, 'edital', c_edital, 'quantidade', 1,
    'exemplos', '[]'::jsonb, 'resumo', '1 caso do ensaio',
    'casos', jsonb_build_array(jsonb_build_object('referencia', 'ensaio-1')))));
  if (v ->> 'mantidos')::int <> 1 then raise exception 'FALHOU E5: mantido %', v; end if;
  perform public.finalizar_conferencia('ensaio-casos-0002', array['ENSAIO_CASOS']);
  raise notice 'ok E5: casos trocados';
end;
$$;

-- Volta ao papel do SQL Editor antes de ler as tabelas sem grant.
reset role;

-- E6. O que ficou nas tabelas.
do $$
begin
  if (select count(*) from public."TB_CASO_AVISO_CONFERENCIA" k
        join public."TB_AVISO_CONFERENCIA" a on a."CO_AVISO_CONFERENCIA" = k."CO_AVISO_CONFERENCIA"
       where a."CO_CONFERENCIA" = 'ENSAIO_CASOS') <> 1 then
    raise exception 'FALHOU E6: devia sobrar 1 caso (trocado na execução 2)';
  end if;
  raise notice 'ok E6: casos como esperado';
end;
$$;

-- Resumo (só contagens; o que o ensaio gravou, antes do rollback).
select
  'ENSAIO OK' as resultado,
  (select count(*) from public."TB_AVISO_CONFERENCIA" where "CO_CONFERENCIA" = 'ENSAIO_CASOS') as avisos,
  (select count(*) from public."TB_CASO_AVISO_CONFERENCIA" k
     join public."TB_AVISO_CONFERENCIA" a on a."CO_AVISO_CONFERENCIA" = k."CO_AVISO_CONFERENCIA"
    where a."CO_CONFERENCIA" = 'ENSAIO_CASOS') as casos;

rollback;
