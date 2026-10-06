/*
  AVISOS DE CONFERÊNCIA: TODOS OS CASOS, PARA CONFERIR

  Até aqui cada aviso (TB_AVISO_CONFERENCIA, 20261005210000) guardava só a
  quantidade e até 20 exemplos em ids soltos (o UUID da análise ou o código do
  candidato): não dava para conferir quem estava errado nem procurar um
  candidato. Agora o job guarda TODOS os casos (até 5000 por aviso) e a tela
  lê cada caso já resolvido: código do candidato, nome, edital, vaga,
  responsável e o dado que motivou o aviso.

    1. TB_CASO_AVISO_CONFERENCIA  um caso por linha: a análise (id), o código
       do candidato na Empregare, outra referência (entrevista, lista, vaga) e
       o detalhe que motivou o aviso (datas, notas, corte, teto — sem nome,
       CPF ou e-mail: o banco recusa @ e 11 dígitos seguidos).
       Nome, edital, vaga e responsável NÃO ficam aqui: a RPC de leitura busca
       na análise na hora, com a permissão de quem lê.
    2. gravar_avisos_conferencia (mesma assinatura): cada aviso pode trazer
       'casos'; trazendo, os casos do aviso são trocados pelos novos. Sem
       'casos' (job antigo), os guardados ficam como estão.
    3. listar_casos_aviso_conferencia(p_aviso, p_busca, p_area, p_modulo,
       p_limite, p_deslocamento): os casos de um aviso, ou de todos os avisos
       que a pessoa vê (com p_busca), em páginas, buscando por código ou nome
       (sem acento e sem caixa). Quem vê o aviso (FC_PODE_VER_AVISO) vê os
       casos; o nome e os dados da análise só saem se a análise for da área e
       do recorte de coordenação de quem lê (FC_PODE_VER_ANALISE_DO_AVISO).
       Candidato em dois editais: as análises ativas dele que a pessoa pode
       ver, com edital, vaga e situação, e quantas ficaram de fora.
    4. Índice pelo código do candidato nas análises ativas (a leitura acha as
       análises do candidato pelo código).

  Nada de CPF: a análise tem cpf_hash, que não sai.

  Ensaio: supabase/ensaios/20261007120000_casos_dos_avisos_de_conferencia.sql
  Rollback: supabase/rollback/20261007120000_casos_dos_avisos_de_conferencia.sql
*/
begin;

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

commit;
