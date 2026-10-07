/*
  ENSAIO de 20261008100000_aspectos_da_entrevista.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Aplica a migration e confere
  (cada falha para com "FALHOU En"; o resultado é a última consulta):
    E1  roteiro SI: versão nova com os 3 aspectos, sem eliminatórias, editais
        reais na versão anterior; treinamento no roteiro com aspectos (v2);
        preparar idempotente;
    E2  os casos dourados com aspectos de
        tests/fixtures/entrevistas/casos-de-calculo.json (o mesmo json abaixo,
        conferido pelo vitest) no FC_CALCULAR_ENTREVISTA;
    E3  roteiro sem aspectos continua igual;
    E4  como admin sintético: salvar roteiro com aspectos e lançar notas
        (recusas, média 2,33, histórico, payload, apagar);
    E5  conferência responde;
    E6  reinício do treinamento: volta no roteiro com aspectos.
  Termina em ROLLBACK. Dados fictícios.
*/
begin;

set local lock_timeout = '10s';

-- ── 1. Tabelas ─────────────────────────────────────────────────────────────
create table public."TB_ROTEIRO_ASPECTO" (
  "CO_ASPECTO" uuid not null default gen_random_uuid(),
  "CO_ROTEIRO" uuid not null,
  "NU_ORDEM" smallint not null,
  "NO_ASPECTO" text not null,
  constraint "PK_TB_ROTEIRO_ASPECTO" primary key ("CO_ASPECTO"),
  constraint "UK_ROTEIROASPECTO_ORDEM" unique ("CO_ROTEIRO", "NU_ORDEM"),
  constraint "FK_ROTEIRO_ROTEIROASPECTO" foreign key ("CO_ROTEIRO") references public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO"),
  constraint "CK_ROTEIROASPECTO_ORDEM" check ("NU_ORDEM" between 1 and 10),
  constraint "CK_ROTEIROASPECTO_TAMANHOS" check (length("NO_ASPECTO") between 2 and 60)
);
comment on table public."TB_ROTEIRO_ASPECTO" is 'Aspectos de um roteiro de entrevista (opcional): cada avaliador dá uma nota em cada aspecto, na escala do roteiro, e a nota dele na competência é a média dos aspectos. Valem para todas as competências da versão do roteiro.';
comment on column public."TB_ROTEIRO_ASPECTO"."CO_ASPECTO" is 'Identificador do aspecto.';
comment on column public."TB_ROTEIRO_ASPECTO"."CO_ROTEIRO" is 'Versão do roteiro (TB_ROTEIRO_ENTREVISTA).';
comment on column public."TB_ROTEIRO_ASPECTO"."NU_ORDEM" is 'Ordem na ficha (1 a 10).';
comment on column public."TB_ROTEIRO_ASPECTO"."NO_ASPECTO" is 'Nome do aspecto (ex.: Conceitua, Propriedade, Profundidade).';
comment on constraint "PK_TB_ROTEIRO_ASPECTO" on public."TB_ROTEIRO_ASPECTO" is 'Identificador do aspecto.';
comment on constraint "UK_ROTEIROASPECTO_ORDEM" on public."TB_ROTEIRO_ASPECTO" is 'Um aspecto por posição no roteiro.';
comment on constraint "FK_ROTEIRO_ROTEIROASPECTO" on public."TB_ROTEIRO_ASPECTO" is 'Roteiro do aspecto.';
comment on constraint "CK_ROTEIROASPECTO_ORDEM" on public."TB_ROTEIRO_ASPECTO" is 'Até 10 aspectos.';
comment on constraint "CK_ROTEIROASPECTO_TAMANHOS" on public."TB_ROTEIRO_ASPECTO" is 'Nome de 2 a 60 caracteres.';

create table public."TB_ENTREVISTA_AVALIACAO_ASPECTO" (
  "CO_ENTREVISTA" uuid not null,
  "CO_COMPETENCIA" uuid not null,
  "CO_AVALIADOR" uuid not null,
  "CO_ASPECTO" uuid not null,
  "VL_NOTA" numeric(5,2) not null,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  "CO_USUARIO_ATUALIZACAO" uuid,
  constraint "PK_TB_ENTREVISTA_AVALIACAO_ASPECTO" primary key ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "CO_ASPECTO"),
  constraint "FK_ENTREVISTAAVALIACAO_AVALIACAOASPECTO" foreign key ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR")
    references public."TB_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR") on delete cascade,
  constraint "FK_ROTEIROASPECTO_AVALIACAOASPECTO" foreign key ("CO_ASPECTO") references public."TB_ROTEIRO_ASPECTO" ("CO_ASPECTO"),
  constraint "CK_AVALIACAOASPECTO_VLNOTA" check ("VL_NOTA" >= 0)
);
comment on table public."TB_ENTREVISTA_AVALIACAO_ASPECTO" is 'Nota de um avaliador num aspecto de uma competência (roteiro com aspectos). A nota do avaliador na competência (TB_ENTREVISTA_AVALIACAO) é a média destas; sai junto com ela.';
comment on column public."TB_ENTREVISTA_AVALIACAO_ASPECTO"."CO_ENTREVISTA" is 'Entrevista (TB_ENTREVISTA).';
comment on column public."TB_ENTREVISTA_AVALIACAO_ASPECTO"."CO_COMPETENCIA" is 'Competência (TB_ROTEIRO_COMPETENCIA).';
comment on column public."TB_ENTREVISTA_AVALIACAO_ASPECTO"."CO_AVALIADOR" is 'Membro da banca (TB_ENTREVISTA_AVALIADOR).';
comment on column public."TB_ENTREVISTA_AVALIACAO_ASPECTO"."CO_ASPECTO" is 'Aspecto (TB_ROTEIRO_ASPECTO).';
comment on column public."TB_ENTREVISTA_AVALIACAO_ASPECTO"."VL_NOTA" is 'Nota do aspecto, na escala do roteiro.';
comment on column public."TB_ENTREVISTA_AVALIACAO_ASPECTO"."DT_ATUALIZACAO" is 'Quando foi lançada ou corrigida.';
comment on column public."TB_ENTREVISTA_AVALIACAO_ASPECTO"."CO_USUARIO_ATUALIZACAO" is 'Quem lançou (auth.users.id).';
comment on constraint "PK_TB_ENTREVISTA_AVALIACAO_ASPECTO" on public."TB_ENTREVISTA_AVALIACAO_ASPECTO" is 'Uma nota por aspecto, avaliador e competência.';
comment on constraint "FK_ENTREVISTAAVALIACAO_AVALIACAOASPECTO" on public."TB_ENTREVISTA_AVALIACAO_ASPECTO" is 'Nota do avaliador de que o aspecto faz parte (apagar a nota apaga os aspectos).';
comment on constraint "FK_ROTEIROASPECTO_AVALIACAOASPECTO" on public."TB_ENTREVISTA_AVALIACAO_ASPECTO" is 'Aspecto avaliado.';
comment on constraint "CK_AVALIACAOASPECTO_VLNOTA" on public."TB_ENTREVISTA_AVALIACAO_ASPECTO" is 'Nota não negativa (o teto vem do roteiro).';

create index "IN_FKAVALIACAOASPECTO_AS" on public."TB_ENTREVISTA_AVALIACAO_ASPECTO" ("CO_ASPECTO");
comment on index public."IN_FKAVALIACAOASPECTO_AS" is 'Notas por aspecto (chave estrangeira).';

alter table public."TB_ROTEIRO_ASPECTO" enable row level security;
alter table public."TB_ENTREVISTA_AVALIACAO_ASPECTO" enable row level security;
revoke all on public."TB_ROTEIRO_ASPECTO", public."TB_ENTREVISTA_AVALIACAO_ASPECTO" from public, anon, authenticated;

comment on column public."TH_ENTREVISTA_AVALIACAO"."DS_CAMPO" is 'nota, aspectos (as notas dos aspectos na ordem, ex.: "1; 1; 2"), compareceu, convocacao ou desconvocacao.';

-- ── 2. A nota cabe na escala do roteiro ────────────────────────────────────
create function private."FC_EXIGIR_NOTA_NA_ESCALA"(p_roteiro uuid, p_competencia uuid, p_nota numeric)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_r public."TB_ROTEIRO_ENTREVISTA";
  v_comp public."TB_ROTEIRO_COMPETENCIA";
begin
  select * into v_r from public."TB_ROTEIRO_ENTREVISTA" where "CO_ROTEIRO" = p_roteiro;
  select * into v_comp from public."TB_ROTEIRO_COMPETENCIA" where "CO_COMPETENCIA" = p_competencia;
  if p_nota < 0 or p_nota > v_comp."VL_NOTA_MAXIMA" then
    raise exception 'Nota % fora da faixa de % (0 a %)', p_nota, v_comp."NO_COMPETENCIA", v_comp."VL_NOTA_MAXIMA" using errcode = '22023';
  end if;
  if v_r."TP_ESCALA" = 'FAIXA' and mod(p_nota, v_r."VL_PASSO") <> 0 then
    raise exception 'Nota % não está na escala (de % em %)', p_nota, v_r."VL_PASSO", v_r."VL_PASSO" using errcode = '22023';
  elsif v_r."TP_ESCALA" = 'LISTA' and not exists (select 1 from jsonb_array_elements_text(v_r."DS_NOTAS_PERMITIDAS") n where n::numeric = p_nota) then
    raise exception 'Nota % não está entre as permitidas', p_nota using errcode = '22023';
  elsif v_r."TP_ESCALA" = 'NIVEIS' and not exists (select 1 from public."TB_ROTEIRO_NIVEL" n where n."CO_ROTEIRO" = v_r."CO_ROTEIRO" and n."VL_NOTA" = p_nota) then
    raise exception 'Nota % não é um dos níveis da escala', p_nota using errcode = '22023';
  end if;
end;
$function$;
comment on function private."FC_EXIGIR_NOTA_NA_ESCALA"(uuid, uuid, numeric) is 'Recusa (22023) a nota fora da faixa da competência (0 a VL_NOTA_MAXIMA) ou fora da escala do roteiro (passo, lista ou níveis). Vale para a nota do avaliador e para a de cada aspecto.';
revoke all on function private."FC_EXIGIR_NOTA_NA_ESCALA"(uuid, uuid, numeric) from public, anon, authenticated;

-- ── 3. O roteiro em json, com os aspectos ──────────────────────────────────
create or replace function private."FC_ROTEIRO_JSON"(p_roteiro uuid)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
    'id', r."CO_ROTEIRO", 'origem', r."CO_ROTEIRO_ORIGEM", 'versao', r."NU_VERSAO", 'area', r."CO_AREA",
    'nome', r."NO_ROTEIRO", 'descricao', r."DS_DESCRICAO", 'etapa', r."NO_ETAPA",
    'escala', r."TP_ESCALA", 'passo', r."VL_PASSO", 'notas_permitidas', r."DS_NOTAS_PERMITIDAS",
    'nota_minima_total', r."VL_NOTA_MINIMA_TOTAL", 'notas_eliminatorias', r."DS_NOTAS_ELIMINATORIAS",
    'ausencia_elimina', r."ST_AUSENCIA_ELIMINA" = 'S', 'desempate', r."DS_DESEMPATE",
    'soma_analise', r."ST_SOMA_ANALISE" = 'S', 'convocacao_padrao', r."DS_CONVOCACAO_PADRAO",
    'banca_padrao', r."DS_BANCA_PADRAO", 'ativo', r."ST_ATIVO" = 'S', 'criado_em', r."DT_CRIACAO",
    'competencias', coalesce((select json_agg(json_build_object(
        'id', k."CO_COMPETENCIA", 'ordem', k."NU_ORDEM", 'nome', k."NO_COMPETENCIA", 'descricao', k."DS_DESCRICAO",
        'nota_maxima', k."VL_NOTA_MAXIMA", 'peso', k."VL_PESO", 'minimo', k."VL_MINIMO",
        'tipo_minimo', k."TP_MINIMO", 'avaliacao', k."TP_AVALIACAO") order by k."NU_ORDEM")
      from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = r."CO_ROTEIRO"), '[]'::json),
    'niveis', coalesce((select json_agg(json_build_object('nota', n."VL_NOTA", 'nome', n."NO_NIVEL", 'descricao', n."DS_DESCRICAO") order by n."VL_NOTA")
      from public."TB_ROTEIRO_NIVEL" n where n."CO_ROTEIRO" = r."CO_ROTEIRO"), '[]'::json),
    'aspectos', coalesce((select json_agg(json_build_object('id', s."CO_ASPECTO", 'ordem', s."NU_ORDEM", 'nome', s."NO_ASPECTO") order by s."NU_ORDEM")
      from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = r."CO_ROTEIRO"), '[]'::json),
    'editais_em_uso', (select count(*) from public."TB_ENTREVISTA_EDITAL" e where e."CO_ROTEIRO" = r."CO_ROTEIRO"))
  from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = p_roteiro;
$function$;
comment on function private."FC_ROTEIRO_JSON"(uuid) is 'Um roteiro (versão) em json, com competências, níveis e aspectos (vazio = uma nota por avaliador).';

-- ── 4. Salvar o roteiro, com os aspectos ───────────────────────────────────
create or replace function public.salvar_roteiro_entrevista(p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_origem uuid := nullif(p_dados ->> 'origem', '')::uuid;
  v_versao integer := 1;
  v_id uuid := gen_random_uuid();
  v_area text := nullif(p_dados ->> 'area', '');
  v_escala text := coalesce(nullif(p_dados ->> 'escala', ''), 'FAIXA');
  k jsonb;
  v_ordem integer := 0;
  v_aspectos text[];
begin
  if not private.pode_recurso('entrevistas', 2) then
    raise exception 'Sem permissão para editar roteiros de entrevista' using errcode = '42501';
  end if;
  if v_area is not null and not private."FC_PODE_AREA"(v_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  if jsonb_typeof(p_dados -> 'competencias') is distinct from 'array'
     or jsonb_array_length(p_dados -> 'competencias') not between 1 and 20 then
    raise exception 'Informe de 1 a 20 competências' using errcode = '22023';
  end if;
  if v_escala = 'LISTA' and jsonb_array_length(coalesce(p_dados -> 'notas_permitidas', '[]')) = 0 then
    raise exception 'Escala em lista precisa das notas permitidas' using errcode = '22023';
  end if;
  if v_escala = 'NIVEIS' and jsonb_array_length(coalesce(p_dados -> 'niveis', '[]')) = 0 then
    raise exception 'Escala por níveis precisa dos níveis' using errcode = '22023';
  end if;

  -- Aspectos (opcionais): [{nome}] ou ["nome"], na ordem; nomes únicos.
  if p_dados ? 'aspectos' and jsonb_typeof(p_dados -> 'aspectos') not in ('array', 'null') then
    raise exception 'Aspectos: informe uma lista' using errcode = '22023';
  end if;
  select coalesce(array_agg(btrim(case when jsonb_typeof(a.valor) = 'string' then a.valor #>> '{}' else a.valor ->> 'nome' end)
                            order by a.ordem), '{}')
    into v_aspectos
    from jsonb_array_elements(case when jsonb_typeof(p_dados -> 'aspectos') = 'array' then p_dados -> 'aspectos' else '[]'::jsonb end)
         with ordinality a(valor, ordem);
  if cardinality(v_aspectos) > 10 then
    raise exception 'Informe até 10 aspectos' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_aspectos) n where coalesce(length(n), 0) not between 2 and 60) then
    raise exception 'Nome do aspecto: de 2 a 60 caracteres' using errcode = '22023';
  end if;
  if (select count(distinct lower(n)) from unnest(v_aspectos) n) <> cardinality(v_aspectos) then
    raise exception 'Dois aspectos com o mesmo nome' using errcode = '22023';
  end if;

  if v_origem is not null then
    select coalesce(max(r."NU_VERSAO"), 0) + 1 into v_versao from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO_ORIGEM" = v_origem;
    if v_versao = 1 then raise exception 'Roteiro de origem não encontrado' using errcode = '22023'; end if;
    update public."TB_ROTEIRO_ENTREVISTA" set "ST_ATIVO" = 'N' where "CO_ROTEIRO_ORIGEM" = v_origem and "ST_ATIVO" = 'S';
  else
    v_origem := v_id;
  end if;

  insert into public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO", "CO_ROTEIRO_ORIGEM", "NU_VERSAO", "CO_AREA", "NO_ROTEIRO",
    "DS_DESCRICAO", "NO_ETAPA", "TP_ESCALA", "VL_PASSO", "DS_NOTAS_PERMITIDAS", "VL_NOTA_MINIMA_TOTAL",
    "DS_NOTAS_ELIMINATORIAS", "ST_AUSENCIA_ELIMINA", "DS_DESEMPATE", "ST_SOMA_ANALISE", "DS_CONVOCACAO_PADRAO",
    "DS_BANCA_PADRAO", "CO_USUARIO_CRIACAO")
  values (v_id, v_origem, v_versao, v_area, btrim(p_dados ->> 'nome'), nullif(btrim(coalesce(p_dados ->> 'descricao', '')), ''),
    coalesce(nullif(btrim(coalesce(p_dados ->> 'etapa', '')), ''), 'Entrevista'), v_escala,
    coalesce(nullif(p_dados ->> 'passo', '')::numeric, 0.5), coalesce(p_dados -> 'notas_permitidas', '[]'),
    nullif(p_dados ->> 'nota_minima_total', '')::numeric,
    -- Com aspectos, a eliminação é pelo mínimo da competência: sem notas eliminatórias.
    case when cardinality(v_aspectos) > 0 then '[]'::jsonb else coalesce(p_dados -> 'notas_eliminatorias', '[]') end,
    case when coalesce((p_dados ->> 'ausencia_elimina')::boolean, true) then 'S' else 'N' end,
    coalesce(p_dados -> 'desempate', '[]'),
    case when coalesce((p_dados ->> 'soma_analise')::boolean, true) then 'S' else 'N' end,
    coalesce(p_dados -> 'convocacao_padrao', '{}'), coalesce(p_dados -> 'banca_padrao', '[]'), (select auth.uid()));

  for k in select value from jsonb_array_elements(p_dados -> 'competencias') loop
    v_ordem := v_ordem + 1;
    insert into public."TB_ROTEIRO_COMPETENCIA" ("CO_ROTEIRO", "NU_ORDEM", "NO_COMPETENCIA", "DS_DESCRICAO",
      "VL_NOTA_MAXIMA", "VL_PESO", "VL_MINIMO", "TP_MINIMO", "TP_AVALIACAO")
    values (v_id, v_ordem, btrim(k ->> 'nome'), nullif(btrim(coalesce(k ->> 'descricao', '')), ''),
      (k ->> 'nota_maxima')::numeric, coalesce(nullif(k ->> 'peso', '')::numeric, 1), nullif(k ->> 'minimo', '')::numeric,
      coalesce(nullif(k ->> 'tipo_minimo', ''), 'VALOR'), coalesce(nullif(k ->> 'avaliacao', ''), 'INDIVIDUAL'));
  end loop;

  insert into public."TB_ROTEIRO_NIVEL" ("CO_ROTEIRO", "VL_NOTA", "NO_NIVEL", "DS_DESCRICAO")
  select v_id, (n ->> 'nota')::numeric, btrim(n ->> 'nome'), nullif(btrim(coalesce(n ->> 'descricao', '')), '')
    from jsonb_array_elements(coalesce(p_dados -> 'niveis', '[]')) n;

  insert into public."TB_ROTEIRO_ASPECTO" ("CO_ROTEIRO", "NU_ORDEM", "NO_ASPECTO")
  select v_id, a.ordem, a.nome from unnest(v_aspectos) with ordinality a(nome, ordem);

  return private."FC_ROTEIRO_JSON"(v_id);
end;
$function$;
comment on function public.salvar_roteiro_entrevista(jsonb) is 'Cria um roteiro ou uma versão nova de um roteiro (p_dados.origem); a versão anterior deixa de ser oferecida, mas os editais que a usam continuam nela. p_dados.aspectos (opcional, até 10): cada avaliador dá uma nota por aspecto; com aspectos, as notas eliminatórias gravam vazias. entrevistas >= editor.';

-- ── 5. Cálculo ─────────────────────────────────────────────────────────────
create or replace function private."FC_CALCULAR_ENTREVISTA"(p_entrevista uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_e public."TB_ENTREVISTA";
  v_r public."TB_ROTEIRO_ENTREVISTA";
  v_avaliadores integer;
  v_total numeric := 0;
  v_bruto numeric := 0;
  v_soma numeric;
  v_falta boolean := false;
  v_reprova boolean := false;
  v_qt_aspectos integer;
  c record;
  v_media numeric;
  v_nota numeric;
  v_minimo numeric;
begin
  select * into v_e from public."TB_ENTREVISTA" where "CO_ENTREVISTA" = p_entrevista for update;
  if v_e."CO_ROTEIRO" is null then return; end if;
  select * into v_r from public."TB_ROTEIRO_ENTREVISTA" where "CO_ROTEIRO" = v_e."CO_ROTEIRO";
  select count(*) into v_qt_aspectos from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = v_r."CO_ROTEIRO";

  -- A média é de quem lançou; com aspectos, de quem lançou todos os aspectos.
  for c in
    select k.*, row_number() over (order by k."NU_ORDEM") ord
      from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = v_r."CO_ROTEIRO" order by k."NU_ORDEM"
  loop
    if v_qt_aspectos > 0 then
      -- Nota do avaliador = média dos aspectos, sem arredondar; competência = média dos avaliadores.
      select avg(m.media), count(*) into v_media, v_avaliadores
        from (select avg(x."VL_NOTA") media
                from public."TB_ENTREVISTA_AVALIACAO_ASPECTO" x
                join public."TB_ROTEIRO_ASPECTO" s on s."CO_ASPECTO" = x."CO_ASPECTO" and s."CO_ROTEIRO" = v_r."CO_ROTEIRO"
               where x."CO_ENTREVISTA" = p_entrevista and x."CO_COMPETENCIA" = c."CO_COMPETENCIA"
               group by x."CO_AVALIADOR"
              having count(*) = v_qt_aspectos) m;
    else
      select avg(a."VL_NOTA"), count(*) into v_media, v_avaliadores
        from public."TB_ENTREVISTA_AVALIACAO" a
       where a."CO_ENTREVISTA" = p_entrevista and a."CO_COMPETENCIA" = c."CO_COMPETENCIA";
    end if;
    if v_avaliadores = 0 then
      v_falta := true;
      update public."TB_ENTREVISTA_NOTA" set "VL_NOTA" = null
       where "CO_ENTREVISTA" = p_entrevista and "NU_ORDEM" = c.ord;
      continue;
    end if;
    v_nota := round(v_media * c."VL_PESO", 2);
    v_total := v_total + v_nota;
    v_bruto := v_bruto + v_media * c."VL_PESO";
    insert into public."TB_ENTREVISTA_NOTA" ("CO_ENTREVISTA", "NU_ORDEM", "DS_CRITERIO", "VL_NOTA")
    values (p_entrevista, c.ord, left(c."NO_COMPETENCIA", 600), v_nota)
    on conflict ("CO_ENTREVISTA", "NU_ORDEM") do update set "DS_CRITERIO" = excluded."DS_CRITERIO", "VL_NOTA" = excluded."VL_NOTA";
    if c."VL_MINIMO" is not null then
      v_minimo := case when c."TP_MINIMO" = 'PERCENTUAL'
                       then c."VL_NOTA_MAXIMA" * c."VL_PESO" * c."VL_MINIMO" / 100.0 else c."VL_MINIMO" end;
      if v_nota < v_minimo then v_reprova := true; end if;
    end if;
    -- Notas eliminatórias são valores exatos (ex.: 0 e 1): só sem aspectos (com aspectos vale o mínimo).
    if v_qt_aspectos = 0 and exists (select 1 from jsonb_array_elements_text(v_r."DS_NOTAS_ELIMINATORIAS") x
                where round(v_media, 2) = x::numeric) then
      v_reprova := true;
    end if;
  end loop;

  -- Sem aspectos: soma das competências (2 casas). Com aspectos: soma sem arredondar, 2 casas no fim.
  v_soma := case when v_qt_aspectos > 0 then round(v_bruto, 2) else round(v_total, 2) end;

  update public."TB_ENTREVISTA" set
    "VL_NOTA_TOTAL" = case when "ST_COMPARECEU" = 'N' then 0 when v_falta and v_soma = 0 then null else v_soma end,
    "TP_PARECER" = case
      when "ST_COMPARECEU" = 'N' and v_r."ST_AUSENCIA_ELIMINA" = 'S' then 'INAPTO'
      when "ST_COMPARECEU" is distinct from 'S' or v_falta then 'SEM_PARECER'
      when v_reprova or (v_r."VL_NOTA_MINIMA_TOTAL" is not null and v_soma < v_r."VL_NOTA_MINIMA_TOTAL") then 'INAPTO'
      else 'APTO' end,
    "DT_ATUALIZACAO" = now()
   where "CO_ENTREVISTA" = p_entrevista;
end;
$function$;
comment on function private."FC_CALCULAR_ENTREVISTA"(uuid) is 'Recalcula uma entrevista feita no sistema: média × peso por competência (TB_ENTREVISTA_NOTA), total e parecer pelas regras do roteiro. Com aspectos: nota do avaliador = média dos aspectos (só com todos lançados), total = soma sem arredondar (2 casas no fim) e eliminação só pelo mínimo da competência.';

-- ── 6. Lançar as notas, com os aspectos ────────────────────────────────────
create or replace function public.lancar_notas_entrevista(p_entrevista uuid, p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_e public."TB_ENTREVISTA";
  v_cfg public."TB_ENTREVISTA_EDITAL";
  v_r public."TB_ROTEIRO_ENTREVISTA";
  v_eu uuid;
  v_admin boolean := private.is_master();
  x jsonb;
  y jsonb;
  v_comp public."TB_ROTEIRO_COMPETENCIA";
  v_av public."TB_ENTREVISTA_AVALIADOR";
  v_nota numeric;
  v_ant numeric;
  v_comp_novo text := nullif(p_dados ->> 'compareceu', '');
  v_qt_aspectos integer;
  v_aspectos jsonb;
  v_aspecto uuid;
  v_ant_txt text;
  v_novo_txt text;
begin
  select * into v_e from public."TB_ENTREVISTA" where "CO_ENTREVISTA" = p_entrevista and "TP_ORIGEM" = 'sistema' and "ST_ATIVO" = 'S';
  if v_e."CO_ENTREVISTA" is null then raise exception 'Convocado não encontrado' using errcode = '22023'; end if;
  perform private."FC_EXIGIR_ENTREVISTAS_EDITAL"(v_e."CO_MONITORAMENTO", 2);
  select * into v_cfg from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = v_e."CO_MONITORAMENTO";
  select * into v_r from public."TB_ROTEIRO_ENTREVISTA" where "CO_ROTEIRO" = v_e."CO_ROTEIRO";
  select p.id into v_eu from private.current_profile() p;
  select count(*) into v_qt_aspectos from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = v_e."CO_ROTEIRO";

  -- Banca da entrevista: grava mesmo sem mudar o comparecimento.
  if nullif(p_dados ->> 'banca', '') is not null
     and (p_dados ->> 'banca')::smallint is distinct from v_e."NU_BANCA" then
    update public."TB_ENTREVISTA" set "NU_BANCA" = (p_dados ->> 'banca')::smallint where "CO_ENTREVISTA" = p_entrevista;
  end if;

  if v_comp_novo is not null then
    if v_comp_novo not in ('S', 'N') then raise exception 'Comparecimento inválido' using errcode = '22023'; end if;
    if v_comp_novo is distinct from v_e."ST_COMPARECEU" then
      update public."TB_ENTREVISTA" set "ST_COMPARECEU" = v_comp_novo, "NU_BANCA" = coalesce(nullif(p_dados ->> 'banca', '')::smallint, "NU_BANCA")
       where "CO_ENTREVISTA" = p_entrevista;
      insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
      values (p_entrevista, 'compareceu', v_e."ST_COMPARECEU", v_comp_novo, (select auth.uid()));
    end if;
  end if;

  for x in select value from jsonb_array_elements(coalesce(p_dados -> 'notas', '[]')) loop
    select * into v_comp from public."TB_ROTEIRO_COMPETENCIA" where "CO_COMPETENCIA" = (x ->> 'competencia')::uuid and "CO_ROTEIRO" = v_e."CO_ROTEIRO";
    if v_comp."CO_COMPETENCIA" is null then raise exception 'Competência não é do roteiro deste edital' using errcode = '22023'; end if;
    select * into v_av from public."TB_ENTREVISTA_AVALIADOR" where "CO_AVALIADOR" = (x ->> 'avaliador')::uuid and "CO_MONITORAMENTO" = v_e."CO_MONITORAMENTO" and "ST_ATIVO" = 'S';
    if v_av."CO_AVALIADOR" is null then raise exception 'Avaliador não é da banca deste edital' using errcode = '22023'; end if;
    if v_cfg."TP_LANCAMENTO" = 'AVALIADOR' and not v_admin and v_av."CO_PERFIL_USUARIO" is distinct from v_eu then
      raise exception 'Neste edital cada avaliador lança a própria nota' using errcode = '42501';
    end if;

    if v_qt_aspectos > 0 then
      -- Roteiro com aspectos: {aspectos: [{aspecto, nota}]} com todos os aspectos, ou nulo para apagar.
      if nullif(x ->> 'nota', '') is not null and not (x ? 'aspectos') then
        raise exception 'Este roteiro avalia por aspectos: informe a nota de cada aspecto' using errcode = '22023';
      end if;
      if x ? 'aspectos' and jsonb_typeof(x -> 'aspectos') not in ('array', 'null') then
        raise exception 'Aspectos: informe uma lista' using errcode = '22023';
      end if;
      v_aspectos := case when jsonb_typeof(x -> 'aspectos') = 'array' then x -> 'aspectos' end;
      select string_agg(trim_scale(a."VL_NOTA")::text, '; ' order by s."NU_ORDEM") into v_ant_txt
        from public."TB_ENTREVISTA_AVALIACAO_ASPECTO" a
        join public."TB_ROTEIRO_ASPECTO" s on s."CO_ASPECTO" = a."CO_ASPECTO"
       where a."CO_ENTREVISTA" = p_entrevista and a."CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and a."CO_AVALIADOR" = v_av."CO_AVALIADOR";
      if v_aspectos is null or not exists (select 1 from jsonb_array_elements(v_aspectos) z where nullif(z ->> 'nota', '') is not null) then
        -- Apagar: a nota do avaliador sai e leva as dos aspectos (on delete cascade).
        delete from public."TB_ENTREVISTA_AVALIACAO"
         where "CO_ENTREVISTA" = p_entrevista and "CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and "CO_AVALIADOR" = v_av."CO_AVALIADOR";
        if found then
          insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
          values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", 'aspectos', v_ant_txt, null, (select auth.uid()));
        end if;
        continue;
      end if;
      for y in select value from jsonb_array_elements(v_aspectos) loop
        v_aspecto := nullif(y ->> 'aspecto', '')::uuid;
        if v_aspecto is null or not exists (select 1 from public."TB_ROTEIRO_ASPECTO" s
                                             where s."CO_ASPECTO" = v_aspecto and s."CO_ROTEIRO" = v_e."CO_ROTEIRO") then
          raise exception 'Aspecto não é do roteiro deste edital' using errcode = '22023';
        end if;
        v_nota := nullif(y ->> 'nota', '')::numeric;
        if v_nota is null then
          raise exception 'Informe a nota de todos os aspectos de % (ou apague todas)', v_comp."NO_COMPETENCIA" using errcode = '22023';
        end if;
        perform private."FC_EXIGIR_NOTA_NA_ESCALA"(v_e."CO_ROTEIRO", v_comp."CO_COMPETENCIA", v_nota);
      end loop;
      if jsonb_array_length(v_aspectos) <> v_qt_aspectos
         or (select count(distinct z ->> 'aspecto') from jsonb_array_elements(v_aspectos) z) <> v_qt_aspectos then
        raise exception 'Informe a nota de cada um dos % aspectos de %', v_qt_aspectos, v_comp."NO_COMPETENCIA" using errcode = '22023';
      end if;
      select string_agg(trim_scale((z ->> 'nota')::numeric)::text, '; ' order by s."NU_ORDEM"), round(avg((z ->> 'nota')::numeric), 2)
        into v_novo_txt, v_nota
        from jsonb_array_elements(v_aspectos) z
        join public."TB_ROTEIRO_ASPECTO" s on s."CO_ASPECTO" = (z ->> 'aspecto')::uuid;
      if v_ant_txt is not distinct from v_novo_txt then continue; end if;
      insert into public."TB_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "VL_NOTA", "CO_USUARIO_ATUALIZACAO")
      values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", v_nota, (select auth.uid()))
      on conflict ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR") do update set
        "VL_NOTA" = excluded."VL_NOTA", "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO";
      insert into public."TB_ENTREVISTA_AVALIACAO_ASPECTO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "CO_ASPECTO", "VL_NOTA", "CO_USUARIO_ATUALIZACAO")
      select p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", (z ->> 'aspecto')::uuid, (z ->> 'nota')::numeric, (select auth.uid())
        from jsonb_array_elements(v_aspectos) z
      on conflict ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "CO_ASPECTO") do update set
        "VL_NOTA" = excluded."VL_NOTA", "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO";
      insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
      values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", 'aspectos', v_ant_txt, v_novo_txt, (select auth.uid()));
      continue;
    end if;

    -- Roteiro sem aspectos: uma nota por avaliador (como antes).
    if jsonb_typeof(x -> 'aspectos') = 'array' and jsonb_array_length(x -> 'aspectos') > 0 then
      raise exception 'Este roteiro não avalia por aspectos' using errcode = '22023';
    end if;
    v_nota := nullif(x ->> 'nota', '')::numeric;
    if v_nota is null then
      select "VL_NOTA" into v_ant from public."TB_ENTREVISTA_AVALIACAO"
       where "CO_ENTREVISTA" = p_entrevista and "CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and "CO_AVALIADOR" = v_av."CO_AVALIADOR";
      if found then
        delete from public."TB_ENTREVISTA_AVALIACAO"
         where "CO_ENTREVISTA" = p_entrevista and "CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and "CO_AVALIADOR" = v_av."CO_AVALIADOR";
        insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
        values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", 'nota', v_ant::text, null, (select auth.uid()));
      end if;
      continue;
    end if;
    perform private."FC_EXIGIR_NOTA_NA_ESCALA"(v_e."CO_ROTEIRO", v_comp."CO_COMPETENCIA", v_nota);
    select "VL_NOTA" into v_ant from public."TB_ENTREVISTA_AVALIACAO"
     where "CO_ENTREVISTA" = p_entrevista and "CO_COMPETENCIA" = v_comp."CO_COMPETENCIA" and "CO_AVALIADOR" = v_av."CO_AVALIADOR";
    if v_ant is not distinct from v_nota then continue; end if;
    insert into public."TB_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "VL_NOTA", "CO_USUARIO_ATUALIZACAO")
    values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", v_nota, (select auth.uid()))
    on conflict ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR") do update set
      "VL_NOTA" = excluded."VL_NOTA", "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO";
    insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
    values (p_entrevista, v_comp."CO_COMPETENCIA", v_av."CO_AVALIADOR", 'nota', v_ant::text, v_nota::text, (select auth.uid()));
  end loop;

  perform private."FC_CALCULAR_ENTREVISTA"(p_entrevista);
  return public.obter_entrevistas_do_edital(v_e."CO_MONITORAMENTO");
end;
$function$;
comment on function public.lancar_notas_entrevista(uuid, jsonb) is 'Lança/corrige notas ({notas:[{competencia, avaliador, nota|null}]}; roteiro com aspectos: {competencia, avaliador, aspectos:[{aspecto, nota}]|null}, todos os aspectos) e o comparecimento ({compareceu:S|N, banca}) de um convocado, valida a escala do roteiro, grava o histórico e recalcula o resultado. entrevistas >= editor; no modo AVALIADOR, só a própria nota.';

-- ── 7. Payload do edital: os aspectos de cada avaliação ────────────────────
CREATE OR REPLACE FUNCTION public.obter_entrevistas_do_edital(p_edital uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_cfg public."TB_ENTREVISTA_EDITAL";
  v_eu uuid;
  v_lista uuid := private."FC_LISTA_CONVOCACAO_VIGENTE"(p_edital);
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  select * into v_cfg from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  select p.id into v_eu from private.current_profile() p;
  return json_build_object(
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area,
                               'treinamento', private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO")),
    'pode_editar', private.pode_recurso('entrevistas', 2),
    'pode_gerar_lista', private.pode_recurso('classificacao', 2),
    'admin_global', private.is_master(),
    'meu_perfil', v_eu,
    'configuracao', case when v_cfg."CO_MONITORAMENTO" is null then null else json_build_object(
        'roteiro', private."FC_ROTEIRO_JSON"(v_cfg."CO_ROTEIRO"), 'banca', v_cfg."DS_BANCA",
        'lancamento', v_cfg."TP_LANCAMENTO", 'atualizado_em', v_cfg."DT_ATUALIZACAO") end,
    'regra_classificacao', (
      select json_build_object('versao', r."NU_VERSAO_VIGENTE", 'convocacao', h."DS_CONFIGURACAO" -> 'convocacao')
        from public."TB_REGRA_CLASSIFICACAO" r
        join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
       where r."CO_MONITORAMENTO" = p_edital),
    'lista_convocacao', case when v_lista is null then null else json_build_object(
        'lista', private."FC_LISTA_CLASSIFICACAO_JSON"(v_lista),
        'retrato', (select l."DS_RESULTADO" from public."TB_LISTA_CLASSIFICACAO" l
                     where l."CO_LISTA_CLASSIFICACAO" = v_lista)) end,
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
                      'avaliador', x."CO_AVALIADOR", 'nota', x."VL_NOTA",
                      'aspectos', coalesce((select json_agg(json_build_object('aspecto', y."CO_ASPECTO", 'nota', y."VL_NOTA"))
                          from public."TB_ENTREVISTA_AVALIACAO_ASPECTO" y
                         where y."CO_ENTREVISTA" = x."CO_ENTREVISTA" and y."CO_COMPETENCIA" = x."CO_COMPETENCIA"
                           and y."CO_AVALIADOR" = x."CO_AVALIADOR"), '[]'::json)))
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

-- ── 8. Conferência: com aspectos, a escala de cada aspecto ─────────────────
CREATE OR REPLACE FUNCTION public.conferencia_ler_entrevistas()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with entrevistas as (
    select e."CO_ENTREVISTA", e."CO_MONITORAMENTO", e."CO_AREA", e."CO_ANALISE_CURRICULAR",
           e."TP_ORIGEM", e."VL_NOTA_TOTAL", e."ST_COMPARECEU", e."TP_PARECER", e."DT_ATUALIZACAO"
      from public."TB_ENTREVISTA" e
     where coalesce(e."ST_ATIVO", 'S') = 'S'
       and not private."FC_EDITAL_EH_TREINAMENTO"(e."CO_MONITORAMENTO")
  ),
  editais_do_sistema as (
    select distinct e."CO_MONITORAMENTO" as edital
      from entrevistas e
     where e."TP_ORIGEM" = 'sistema' and e."CO_MONITORAMENTO" is not null
  )
  select jsonb_build_object(
    'schema_version', 1,
    'entrevistas', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', e."CO_ENTREVISTA", 'edital', e."CO_MONITORAMENTO", 'area', e."CO_AREA",
          'analise', e."CO_ANALISE_CURRICULAR", 'origem', e."TP_ORIGEM", 'nota', e."VL_NOTA_TOTAL",
          'compareceu', e."ST_COMPARECEU", 'parecer', e."TP_PARECER")), '[]'::jsonb)
        from entrevistas e
    ),
    'agenda', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', g."CO_AGENDA_ENTREVISTA", 'edital', g."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'analise', g."CO_ANALISE_CURRICULAR", 'codigo', nullif(btrim(a.id_origem), ''),
          'data', g."DT_ENTREVISTA", 'inicio', g."HR_INICIO", 'fim', g."HR_FIM")), '[]'::jsonb)
        from public."TB_AGENDA_ENTREVISTA" g
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = g."CO_MONITORAMENTO"
        left join public."TB_ANALISE_CURRICULAR" a on a.id = g."CO_ANALISE_CURRICULAR"
       where not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
    ),
    'avaliacoes', (
      -- Roteiro com aspectos: confere a nota de cada aspecto (a do avaliador é a média deles).
      select coalesce(jsonb_agg(jsonb_build_object(
          'entrevista', n.entrevista, 'competencia', n.competencia, 'nota', n.nota)), '[]'::jsonb)
        from (
          select v."CO_ENTREVISTA" as entrevista, v."CO_COMPETENCIA" as competencia, v."VL_NOTA" as nota
            from public."TB_ENTREVISTA_AVALIACAO" v
            join entrevistas e on e."CO_ENTREVISTA" = v."CO_ENTREVISTA"
            join public."TB_ROTEIRO_COMPETENCIA" k on k."CO_COMPETENCIA" = v."CO_COMPETENCIA"
           where not exists (select 1 from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = k."CO_ROTEIRO")
          union all
          select y."CO_ENTREVISTA", y."CO_COMPETENCIA", y."VL_NOTA"
            from public."TB_ENTREVISTA_AVALIACAO_ASPECTO" y
            join entrevistas e on e."CO_ENTREVISTA" = y."CO_ENTREVISTA"
        ) n
    ),
    'competencias', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', c."CO_COMPETENCIA", 'roteiro', c."CO_ROTEIRO", 'maxima', c."VL_NOTA_MAXIMA")), '[]'::jsonb)
        from public."TB_ROTEIRO_COMPETENCIA" c
    ),
    'roteiros', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', r."CO_ROTEIRO", 'escala', r."TP_ESCALA", 'passo', r."VL_PASSO",
          'permitidas', r."DS_NOTAS_PERMITIDAS",
          'niveis', (select coalesce(jsonb_agg(n."VL_NOTA" order by n."VL_NOTA"), '[]'::jsonb)
                       from public."TB_ROTEIRO_NIVEL" n where n."CO_ROTEIRO" = r."CO_ROTEIRO"))), '[]'::jsonb)
        from public."TB_ROTEIRO_ENTREVISTA" r
    ),
    'convocacao', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'edital', x.edital, 'lista', x.lista,
          'analises', (select coalesce(jsonb_agg(c), '[]'::jsonb)
                         from private."FC_CONVOCADOS_DA_LISTA"(x.lista) c))), '[]'::jsonb)
        from (select s.edital, private."FC_LISTA_CONVOCACAO_VIGENTE"(s.edital) as lista
                from editais_do_sistema s) x
    )
  );
$function$;
comment on function public.conferencia_ler_entrevistas() is
  'Conferências (job Python): entrevistas ativas (id, edital, análise, origem, nota, comparecimento), a agenda (data e horário por análise, com o código do candidato), as notas de cada avaliador (roteiro com aspectos: a nota de cada aspecto), a escala de cada roteiro e a lista de convocação vigente (análises) dos editais com convocados pelo sistema. Sem nome nem CPF. Só service_role.';

-- ── 9. Edital de treinamento: roteiro de exemplo com os aspectos ───────────
create or replace function private."FC_PREPARAR_EDITAL_TREINAMENTO"(p_area text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_numero constant text := '991/2099';
  c_edital constant text := 'Treinamento – Saúde Indígena (991/2099)';
  c_unidade constant text := 'DSEI Treinamento';
  c_origem constant text := 'treinamento';
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_uid uuid := coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid);
  v_id uuid;
  v_planilha text;
  v_grupo text;
  v_roteiro uuid;
  v_origem_roteiro uuid;
  v_regra_classif uuid;
  v_config_classif jsonb;
  v_modelo public."TB_REGRA_ANALISE_MODELO";
  v_config_analise jsonb;
  v_regra_analise uuid;
  v_resultado jsonb;
begin
  if v_area <> 'saude-indigena' then
    raise exception 'Edital de treinamento disponível só para a Saúde Indígena (por enquanto)' using errcode = '22023';
  end if;
  select a."NO_GRUPO_PLANILHA" into v_grupo from public."TB_AREA" a where a."CO_AREA" = v_area;
  select p."CO_PLANILHA" into v_planilha from public."TB_PLANILHA_ANALISE" p where p."CO_AREA" = v_area;
  if v_grupo is null or v_planilha is null then
    raise exception 'Área sem planilha de análises cadastrada: %', v_area using errcode = '22023';
  end if;

  -- Um edital de treinamento por área; uma preparação por vez.
  perform pg_advisory_xact_lock(hashtextextended('edital_treinamento:' || v_area, 0));

  -- Vagas, candidatos e notas fictícios (nada de dado pessoal real).
  create temporary table if not exists tmp_treino_vaga (
    vaga text primary key, ordem smallint, cargo text, imediatas integer, cr boolean, nivel text
  ) on commit drop;
  truncate tmp_treino_vaga;
  insert into tmp_treino_vaga values
    ('9909910001', 1, 'Enfermeiro', 2, true, 'Superior'),
    ('9909910002', 2, 'Técnico de Enfermagem', 3, true, 'Técnico'),
    ('9909910003', 3, 'Agente Indígena de Saúde (AIS)', 2, false, 'Fundamental');

  create temporary table if not exists tmp_treino_candidato (
    n integer primary key, codigo text, nome text, email text, vaga text, nota numeric,
    modalidade text, indigena boolean, nascimento date
  ) on commit drop;
  truncate tmp_treino_candidato;
  insert into tmp_treino_candidato
  select n, 'TREINO-' || lpad(n::text, 2, '0'), 'Candidato Teste ' || lpad(n::text, 2, '0'),
         'candidato.teste' || lpad(n::text, 2, '0') || '@exemplo.invalid',
         case when n <= 5 then '9909910001' when n <= 11 then '9909910002' else '9909910003' end,
         (array[82.5, 77, 71.25, 64, 58.5, 88, 79.5, 73, 69.75, 61, 55.5, 74, 68.25, 62, 51.5])[n],
         case when n in (3, 8, 12, 14) then 'Indígenas' else 'Ampla Concorrência' end,
         n in (3, 8, 12, 13, 14),
         make_date(1970 + n * 2, 1 + (n % 12), 1 + n)
    from generate_series(1, 15) n;

  -- O edital.
  select m.id into v_id
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m."CO_AREA" = v_area and m."ST_TREINAMENTO" = 'S'
   order by m.created_at, m.id
   limit 1;
  if v_id is null then
    insert into public."TB_MONITORAMENTO_INDIGENA" (
      processo, edital, sigla_unidade, tipo_unidade, unidade, uf, ciclo, cargos, vagas_total, inscritos,
      aptos_analise, data_inicio, data_fim, status, etapa, risco, responsavel, observacoes,
      observacoes_internas, ativo, origem_carga, cronograma_origem, "CO_AREA", "ST_TREINAMENTO")
    values (
      'TREINAMENTO', c_edital, 'TREINO', 'DSEI', c_unidade, 'DF', '2099',
      'Enfermeiro; Técnico de Enfermagem; Agente Indígena de Saúde (AIS)', 7, 15, 15,
      v_hoje - 45, v_hoje + 30, 'Em andamento', 'Entrevistas', 'Baixo', 'Treinamento',
      'Edital de treinamento: dados fictícios, sem valor oficial.',
      'Criado por private."FC_PREPARAR_EDITAL_TREINAMENTO". Reinicie em Editais (admin).',
      true, 'TREINAMENTO', 'MANUAL', v_area, 'S')
    returning id into v_id;
  end if;

  -- Cronograma relativo a hoje: inscrições já passaram, avaliação documental e
  -- entrevistas em andamento (FC_JANELA_ENTREVISTA fica aberta).
  if not exists (select 1 from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = v_id) then
    insert into public."TB_CRONOGRAMA_MONIT_INDIG" (monitoramento_id, ordem, atividade, tipo_atividade, data_inicio, data_fim, origem, observacao)
    select v_id, x.ordem, x.atividade, x.tipo, v_hoje + x.ini, v_hoje + x.fim, 'MANUAL', 'Treinamento'
      from (values
        (1, 'Publicação do Edital', 'PUBLICACAO', -45, -45),
        (2, 'Período de inscrição e Envio dos Documentos Comprobatórios de Requisitos', 'INSCRICAO', -44, -30),
        (3, 'Avaliação Documental e de Títulos', 'ANALISE', -29, 10),
        (4, 'Resultado Preliminar da Avaliação Documental e de Títulos', 'RESULTADO', -12, -12),
        (5, 'Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos', 'RECURSO', -11, -9),
        (6, 'Resultado Final da Avaliação Documental e de Títulos', 'RESULTADO', -7, -7),
        (7, 'Convocação para a Entrevista', 'CONVOCACAO', -5, -5),
        (8, 'Período de Entrevistas', 'ENTREVISTA', -2, 12),
        (9, 'Resultado Preliminar das Entrevistas', 'RESULTADO', 15, 15),
        (10, 'Prazo para recursos referentes ao resultado preliminar das entrevistas', 'RECURSO', 16, 18),
        (11, 'Resultado final da Entrevista', 'RESULTADO', 21, 21),
        (12, 'Resultado final do Processo Seletivo', 'RESULTADO', 25, 25)
      ) x(ordem, atividade, tipo, ini, fim);
  end if;

  -- Quadro de vagas.
  if not exists (select 1 from public."TB_QUADRO_VAGA_EDITAL" q where q."CO_MONITORAMENTO" = v_id and q."ST_REGISTRO_ATIVO" = 'S') then
    insert into public."TB_QUADRO_VAGA_EDITAL" ("CO_MONITORAMENTO", "NU_ORDEM", "NO_CARGO", "NO_LOTACAO",
      "DS_MODALIDADE_VAGA", "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "TP_ORIGEM", "DS_ARQUIVO_ORIGEM", "CO_USUARIO_ATUALIZACAO")
    select v_id, t.ordem, t.cargo, c_unidade,
           jsonb_build_object('Ampla Concorrência', t.imediatas, 'Indígenas', null),
           t.imediatas, case when t.cr then 'S' else 'N' end, 'MANUAL', 'treinamento', v_uid
      from tmp_treino_vaga t;
  end if;

  -- Análises curriculares fictícias (aprovadas): a fonte da Classificação e da convocação.
  insert into public."TB_ANALISE_CURRICULAR" (grupo, unidade, edital, codigo_vaga, nome_vaga, candidato, cpf_hash,
    categoria, modalidade_concorrencia, status_consolidado, etapa, responsavel_analise, data_analise,
    nota_final_ajustada, pontuacao_escolaridade, pontuacao_cursos_aperfeicoamento,
    pontuacao_experiencia_profissional, pontuacao_criterio_etnico, experiencia_saude_indigena_total,
    experiencia_atencao_basica_total, analise, ativo, id_origem, data_nascimento, nota_empregare,
    pcd, origem_planilha, chave_natural, "CO_AREA", "CO_PLANILHA")
  select v_grupo, c_unidade, c_edital, c.vaga, v.cargo, c.nome, null,
         v.nivel, c.modalidade, 'Aprovado', 'Análise concluída', 'Treinamento', v_hoje - 14,
         c.nota, round(c.nota * 0.3, 2), round(c.nota * 0.1, 2), round(c.nota * 0.4, 2),
         case when c.indigena then 14 else 0 end, (c.n % 5) * 6, (c.n % 4) * 9,
         'Análise fictícia do edital de treinamento.', true, c.codigo, c.nascimento, round(c.nota * 0.9, 2),
         'Não', c_origem, c_origem || '|' || v_area || '|' || c.codigo, v_area, v_planilha
    from tmp_treino_candidato c
    join tmp_treino_vaga v on v.vaga = c.vaga
  on conflict (chave_natural) do nothing;

  -- Roteiro de exemplo, com os aspectos (id fixo por área: o reinício reaproveita). É a
  -- versão seguinte do roteiro de exemplo sem aspectos, quando ele já existe.
  v_roteiro := md5('agsus-treinamento-roteiro-aspectos-' || v_area)::uuid;
  if not exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = v_roteiro) then
    v_origem_roteiro := md5('agsus-treinamento-roteiro-' || v_area)::uuid;
    if not exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO_ORIGEM" = v_origem_roteiro) then
      v_origem_roteiro := v_roteiro;
    end if;
    update public."TB_ROTEIRO_ENTREVISTA" set "ST_ATIVO" = 'N'
     where "CO_ROTEIRO_ORIGEM" = v_origem_roteiro and "ST_ATIVO" = 'S';
    insert into public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO", "CO_ROTEIRO_ORIGEM", "NU_VERSAO", "CO_AREA", "NO_ROTEIRO",
      "DS_DESCRICAO", "NO_ETAPA", "TP_ESCALA", "VL_PASSO", "DS_NOTAS_PERMITIDAS", "VL_NOTA_MINIMA_TOTAL",
      "DS_NOTAS_ELIMINATORIAS", "ST_AUSENCIA_ELIMINA", "DS_DESEMPATE", "ST_SOMA_ANALISE",
      "DS_CONVOCACAO_PADRAO", "DS_BANCA_PADRAO", "ST_ATIVO")
    values (v_roteiro, v_origem_roteiro,
      (select coalesce(max(r."NU_VERSAO"), 0) + 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO_ORIGEM" = v_origem_roteiro),
      v_area, 'Treinamento — Entrevista individual (exemplo)',
      'Roteiro de exemplo do edital de treinamento: 4 competências; cada avaliador dá de 0 a 5 em 3 aspectos (Conceitua, Propriedade, Profundidade) e a nota dele é a média; apto com 8 pontos e 2 em cada competência (abaixo de 2 elimina).',
      'Entrevista Individual', 'NIVEIS', 1, '[]'::jsonb, 8, '[]'::jsonb, 'S',
      '["Idade igual ou superior a 60 anos (Estatuto da Pessoa Idosa)", "Maior pontuação na Avaliação Documental e de Títulos", "Maior pontuação na Entrevista"]'::jsonb,
      'S', '{"multiplo_imediatas": 3, "posicao_cadastro_reserva": 5}'::jsonb,
      '[{"origem": "AgSUS", "quantidade": 1}, {"origem": "DSEI", "quantidade": 1}]'::jsonb, 'S');
    insert into public."TB_ROTEIRO_COMPETENCIA" ("CO_ROTEIRO", "NU_ORDEM", "NO_COMPETENCIA", "DS_DESCRICAO", "VL_NOTA_MAXIMA", "VL_PESO", "VL_MINIMO")
    values (v_roteiro, 1, 'Comunicação e escuta', 'Expressa-se com clareza e escuta o outro.', 5, 1, 2),
           (v_roteiro, 2, 'Trabalho em equipe', 'Colabora e compartilha responsabilidades.', 5, 1, 2),
           (v_roteiro, 3, 'Respeito à diversidade cultural', 'Reconhece e respeita os modos de vida dos povos indígenas.', 5, 1, 2),
           (v_roteiro, 4, 'Conhecimento da função', 'Conhece as atribuições do cargo no território.', 5, 1, 2);
    insert into public."TB_ROTEIRO_NIVEL" ("CO_ROTEIRO", "VL_NOTA", "NO_NIVEL", "DS_DESCRICAO")
    values (v_roteiro, 0, 'Não demonstrou', null), (v_roteiro, 1, 'Insuficiente', null),
           (v_roteiro, 2, 'Básico', null), (v_roteiro, 3, 'Adequado', null),
           (v_roteiro, 4, 'Bom', null), (v_roteiro, 5, 'Excelente', null);
    insert into public."TB_ROTEIRO_ASPECTO" ("CO_ROTEIRO", "NU_ORDEM", "NO_ASPECTO")
    values (v_roteiro, 1, 'Conceitua'), (v_roteiro, 2, 'Propriedade'), (v_roteiro, 3, 'Profundidade');
  end if;

  -- Entrevista configurada (roteiro, banca, vagas imediatas e avaliadores fictícios).
  if not exists (select 1 from public."TB_ENTREVISTA_EDITAL" e where e."CO_MONITORAMENTO" = v_id) then
    insert into public."TB_ENTREVISTA_EDITAL" ("CO_MONITORAMENTO", "CO_ROTEIRO", "DS_CONVOCACAO", "DS_BANCA", "TP_LANCAMENTO", "CO_USUARIO_ATUALIZACAO")
    values (v_id, v_roteiro, '{}'::jsonb,
            '[{"origem": "AgSUS", "quantidade": 1}, {"origem": "DSEI", "quantidade": 1}]'::jsonb, 'SECRETARIA', v_uid);
  end if;
  insert into public."TB_ENTREVISTA_VAGA" ("CO_MONITORAMENTO", "CO_VAGA", "QT_VAGA_IMEDIATA")
  select v_id, t.vaga, t.imediatas from tmp_treino_vaga t
   where not exists (select 1 from public."TB_ENTREVISTA_VAGA" x where x."CO_MONITORAMENTO" = v_id and x."CO_VAGA" = t.vaga);
  if not exists (select 1 from public."TB_ENTREVISTA_AVALIADOR" b where b."CO_MONITORAMENTO" = v_id) then
    insert into public."TB_ENTREVISTA_AVALIADOR" ("CO_MONITORAMENTO", "NO_AVALIADOR", "NO_ORIGEM", "NU_BANCA")
    values (v_id, 'Avaliador Teste 1', 'AgSUS', 1), (v_id, 'Avaliador Teste 2', 'DSEI', 1);
  end if;

  -- Regra da classificação (formato de src/lib/classificacao/regra.js) e a lista de convocação.
  select r."CO_REGRA_CLASSIFICACAO" into v_regra_classif
    from public."TB_REGRA_CLASSIFICACAO" r where r."CO_MONITORAMENTO" = v_id;
  if v_regra_classif is null then
    v_config_classif := jsonb_build_object(
      'schema', 1,
      'data_corte', to_char(v_hoje - 30, 'YYYY-MM-DD'),
      'etapas', jsonb_build_object('documental', true, 'entrevista', true),
      'documental', jsonb_build_object('situacoes_aptas', jsonb_build_array('Aprovado'), 'nota_minima', null,
                                       'nota_minima_por_nivel', '{}'::jsonb, 'niveis_por_cargo', '[]'::jsonb,
                                       'nivel_padrao', null, 'parciais', '[]'::jsonb),
      'entrevista', jsonb_build_object('nota_minima', 8, 'nota_minima_competencia', 2, 'nota_eliminatoria_ate', 0,
                                       'competencias', '[]'::jsonb, 'exige_comparecimento', true,
                                       'inapto_elimina', true, 'so_parecer', false),
      'composicao', jsonb_build_object('componentes', jsonb_build_array(
                                         jsonb_build_object('codigo', 'DOCUMENTAL', 'peso', 1),
                                         jsonb_build_object('codigo', 'ENTREVISTA', 'peso', 1)),
                                       'casas', 2, 'arredondamento', 'MEIO_PARA_CIMA'),
      'desempate', '[]'::jsonb,
      'listas', jsonb_build_object('PRELIMINAR', jsonb_build_object('empate', 'MESMA_POSICAO'),
                                   'ENTREVISTA', jsonb_build_object('empate', 'MESMA_POSICAO'),
                                   'FINAL', jsonb_build_object('empate', 'CRITERIOS')),
      'empate_final', jsonb_build_object('metodo', 'MESMA_POSICAO', 'numeracao', 'DENSA'),
      'modalidades', jsonb_build_array(jsonb_build_object(
                       'codigo', 'AC', 'nome', 'Ampla concorrência', 'percentual', null,
                       'arredondamento', 'MEIO_PARA_CIMA', 'lista_propria', false, 'recomeca_posicao', true,
                       'aparece_na_geral', true, 'remanejar_para', '[]'::jsonb, 'agrupa', '[]'::jsonb)),
      'cotas', jsonb_build_object('minimo_vagas_reserva', 0, 'acumulo', 'TODAS'),
      'convocacao', jsonb_build_object('multiplo_vagas', 3, 'posicao_max_cr', 5, 'incluir_empatados', true,
                                       'excecoes', '[]'::jsonb),
      'rodape', 'TREINAMENTO — sem valor oficial.',
      'documento', jsonb_build_object('edital', 'TREINAMENTO ' || c_numero, 'unidade', c_unidade));
    perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(v_config_classif);
    insert into public."TB_REGRA_CLASSIFICACAO" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
    values (v_id, 1, v_uid) returning "CO_REGRA_CLASSIFICACAO" into v_regra_classif;
    insert into public."TH_REGRA_CLASSIFICACAO" ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "DS_CONFIGURACAO", "TP_EMPATE_FINAL", "DS_MOTIVO", "CO_USUARIO")
    values (v_regra_classif, 1, v_config_classif, 'MESMA_POSICAO', 'Edital de treinamento', v_uid);
  end if;

  if not exists (select 1 from public."TB_LISTA_CLASSIFICACAO" l where l."CO_MONITORAMENTO" = v_id and l."TP_LISTA" = 'CONVOCACAO') then
    with ordenados as (
      select a.id, a.candidato, a.nota_final_ajustada as nota, a.codigo_vaga,
             rank() over (partition by a.codigo_vaga order by a.nota_final_ajustada desc) as posicao
        from public."TB_ANALISE_CURRICULAR" a
       where a."CO_AREA" = v_area and a.ativo and private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
         and private."FC_NUMERO_EDITAL"(a.edital) = c_numero
    ),
    vagas as (
      select t.ordem, jsonb_build_object(
               'codigo', t.vaga, 'chave', t.vaga, 'cargo', t.cargo, 'lotacao', c_unidade,
               'cabecalho', 'Vaga ' || t.vaga || ' — ' || t.cargo || ' — ' || c_unidade,
               'total', t.imediatas, 'cadastro_reserva', t.cr, 'origem_das_vagas', 'QUADRO',
               'limite_convocacao', null,
               'geral', coalesce((select jsonb_agg(jsonb_build_object(
                          'analise_id', o.id, 'nome', o.candidato, 'posicao', o.posicao, 'nota', o.nota,
                          'modalidades', '[]'::jsonb, 'situacao', 'Classificado') order by o.posicao, o.candidato)
                          from ordenados o where o.codigo_vaga = t.vaga), '[]'::jsonb),
               'listas', '{}'::jsonb, 'eliminados', '[]'::jsonb) as vaga
        from tmp_treino_vaga t
    )
    select jsonb_build_object(
             'schema', 1, 'tipo', 'CONVOCACAO', 'casas', 2, 'avisos', '[]'::jsonb, 'pendencias', '[]'::jsonb,
             'edital', jsonb_build_object('id', v_id, 'edital', c_edital, 'unidade', c_unidade, 'treinamento', true),
             'rodape', 'TREINAMENTO — sem valor oficial.', 'data_corte', to_char(v_hoje - 30, 'YYYY-MM-DD'),
             'modalidades', '[]'::jsonb, 'empate_final', 'MESMA_POSICAO', 'regra_versao', 1,
             'totais', jsonb_build_object('vagas', (select sum(t.imediatas) from tmp_treino_vaga t),
                                          'avisos', 0, 'elegiveis', (select count(*) from ordenados),
                                          'candidatos', (select count(*) from ordenados), 'eliminados', 0, 'pendencias', 0),
             'vagas', (select jsonb_agg(v.vaga order by v.ordem) from vagas v))
      into v_resultado;
    insert into public."TB_LISTA_CLASSIFICACAO" ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA",
      "DS_RESULTADO", "DS_HASH", "QT_ELEGIVEL", "CO_USUARIO")
    values (v_id, 'CONVOCACAO', v_regra_classif, 1, v_resultado,
            encode(sha256(convert_to(v_resultado::text, 'UTF8')), 'hex'),
            (v_resultado #>> '{totais,elegiveis}')::integer, v_uid);
  end if;

  -- Avaliação documental: inscrições e questionários no formato da Empregare.
  insert into public."TB_EMPREGARE_VAGA" ("CO_VAGA", "CO_MONITORAMENTO", "TP_SITUACAO", "DS_COLUNA", "NO_ARQUIVO",
    "QT_CANDIDATO_ATIVO", "QT_LINHA_ARQUIVO", "QT_RECEBIDA", "DS_MENSAGEM", "DT_ULTIMA_CARGA")
  select t.vaga, v_id, 'GRAVADA',
         jsonb_build_array('CÓDIGO', 'NOME', 'E-MAIL', 'TELEFONE', 'CELULAR', 'GÊNERO', 'PAÍS', 'ESTADO', 'CIDADE', 'PCD',
           'DATA DE NASCIMENTO', 'ETAPA', 'SITUAÇÃO', 'DATA DE CANDIDATURA', 'NÍVEL ÚLTIMA FORMAÇÃO', 'CURSO ÚLTIMA FORMAÇÃO',
           'SITUAÇÃO - ' || upper(t.cargo) || ' - DSEI TREINAMENTO',
           'NOTA - ' || upper(t.cargo) || ' - DSEI TREINAMENTO',
           'DATA DE RESPOSTA - ' || upper(t.cargo) || ' - DSEI TREINAMENTO',
           'RESPOSTAS - ' || upper(t.cargo) || ' - DSEI TREINAMENTO - Pergunta 1 - Nome completo:',
           'Pergunta 2 - Número do CPF:',
           'Pergunta 3 - Indique em qual sistema de concorrência deseja se inscrever:',
           'Pergunta 4 - Você é indígena e mora em aldeia?',
           'Pergunta 5 - Você possui a escolaridade exigida para a vaga?',
           'Pergunta 6 - Selecione sua Experiência Profissional na área/vaga em que concorre:'),
         'treinamento-' || t.vaga || '.xlsx',
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         (select count(*) from tmp_treino_candidato c where c.vaga = t.vaga),
         'Carga fictícia do edital de treinamento.', now()
    from tmp_treino_vaga t
  on conflict ("CO_VAGA") do nothing;

  insert into public."TB_EMPREGARE_CANDIDATO" ("CO_VAGA", "DS_CHAVE_CANDIDATO", "TP_CHAVE", "CO_CANDIDATO_EMPREGARE",
    "NO_CANDIDATO", "DS_EMAIL", "NU_CPF", "NU_TELEFONE", "DT_NASCIMENTO", "DS_SITUACAO_EMPREGARE", "DT_CANDIDATURA",
    "DS_COLUNA_ORIGINAL", "DS_HASH_LINHA")
  select x.vaga, 'cod:' || x.codigo, 'CODIGO', x.codigo, x.nome, x.email, null, '(00) 00000-0000', x.nascimento,
         'Inscrito', x.candidatura, x.original, encode(sha256(convert_to(x.original::text, 'UTF8')), 'hex')
    from (
      select c.*, (v_hoje - 40 + (c.n % 10))::timestamp at time zone 'America/Sao_Paulo' as candidatura,
             jsonb_build_object(
               'CÓDIGO', c.codigo, 'NOME', c.nome, 'E-MAIL', c.email, 'TELEFONE', '(00) 0000-0000',
               'CELULAR', '(00) 00000-0000', 'GÊNERO', 'Não informado', 'PAÍS', 'Brasil', 'ESTADO', 'DF',
               'CIDADE', 'Cidade Fictícia', 'PCD', 'Não', 'DATA DE NASCIMENTO', to_char(c.nascimento, 'DD/MM/YYYY'),
               'ETAPA', 'Inscritos', 'SITUAÇÃO', 'Ativo', 'DATA DE CANDIDATURA', to_char(v_hoje - 40 + (c.n % 10), 'DD/MM/YYYY'),
               'NÍVEL ÚLTIMA FORMAÇÃO', t.nivel, 'CURSO ÚLTIMA FORMAÇÃO', t.cargo,
               'SITUAÇÃO - ' || upper(t.cargo) || ' - DSEI TREINAMENTO', 'Respondido',
               'NOTA - ' || upper(t.cargo) || ' - DSEI TREINAMENTO', replace(to_char(round(c.nota * 0.9, 2), 'FM990.00'), '.', ','),
               'DATA DE RESPOSTA - ' || upper(t.cargo) || ' - DSEI TREINAMENTO', to_char(v_hoje - 40 + (c.n % 10), 'DD/MM/YYYY'),
               'RESPOSTAS - ' || upper(t.cargo) || ' - DSEI TREINAMENTO - Pergunta 1 - Nome completo:', c.nome,
               'Pergunta 2 - Número do CPF:', '000.000.000-00',
               'Pergunta 3 - Indique em qual sistema de concorrência deseja se inscrever:', c.modalidade,
               'Pergunta 4 - Você é indígena e mora em aldeia?', case when c.indigena then 'Sou indígena e moro em aldeia' else 'Não' end,
               'Pergunta 5 - Você possui a escolaridade exigida para a vaga?', 'Sim',
               'Pergunta 6 - Selecione sua Experiência Profissional na área/vaga em que concorre:', ((c.n % 5) * 6)::text || ' meses'
             ) as original
        from tmp_treino_candidato c
        join tmp_treino_vaga t on t.vaga = c.vaga
    ) x
  on conflict ("CO_VAGA", "DS_CHAVE_CANDIDATO") do nothing;

  -- A avaliação documental do edital é feita no MONITORA.
  insert into public."TB_ORIGEM_ANALISE_EDITAL" ("CO_MONITORAMENTO", "TP_ORIGEM")
  values (v_id, 'MONITORA')
  on conflict ("CO_MONITORAMENTO") do nothing;

  -- Regra da avaliação documental copiada de um modelo SI (situação CONFERIR: conferir faz parte do treino).
  if not exists (select 1 from public."TB_REGRA_ANALISE" r where r."CO_MONITORAMENTO" = v_id) then
    select * into v_modelo
      from public."TB_REGRA_ANALISE_MODELO" m
     where m."ST_ATIVO" = 'S' and m."CO_MODELO" like 'SI%'
     order by (m."CO_MODELO" = 'SI26-ALSE') desc, m."CO_MODELO"
     limit 1;
    if v_modelo."CO_MODELO" is not null then
      v_config_analise := v_modelo."DS_CONFIGURACAO"
        || jsonb_build_object('modelo', v_modelo."CO_MODELO", 'edital_rotulo', 'Edital ' || c_numero || ' (TREINAMENTO)');
      perform private."FC_VALIDAR_REGRA_ANALISE"(v_config_analise);
      insert into public."TB_REGRA_ANALISE" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_MODELO_ORIGEM", "CO_USUARIO_ATUALIZACAO")
      values (v_id, 1, v_modelo."CO_MODELO", v_uid)
      returning "CO_REGRA_ANALISE" into v_regra_analise;
      insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO")
      values (v_regra_analise, 1, v_config_analise, encode(sha256(convert_to(v_config_analise::text, 'UTF8')), 'hex'),
              'Edital de treinamento: copiada do modelo ' || v_modelo."CO_MODELO", v_uid);
    end if;
  end if;

  return v_id;
end;
$$;
comment on function private."FC_PREPARAR_EDITAL_TREINAMENTO"(text) is
  'Cria ou completa (idempotente) o edital de treinamento da área: edital com ST_TREINAMENTO = S, cronograma relativo a hoje, quadro de vagas, 15 candidatos fictícios (análise, lista de convocação, inscrição Empregare), roteiro de exemplo (com os aspectos Conceitua, Propriedade e Profundidade), regras da classificação e da avaliação documental. Só a Saúde Indígena por enquanto. Devolve o id do edital.';
revoke all on function private."FC_PREPARAR_EDITAL_TREINAMENTO"(text) from public, anon, authenticated;
grant execute on function private."FC_PREPARAR_EDITAL_TREINAMENTO"(text) to service_role;


-- ── 10. Edital de treinamento: passa para o roteiro com aspectos (se ainda sem nota) ─
do $$
declare
  v_edital uuid;
  v_roteiro uuid := md5('agsus-treinamento-roteiro-aspectos-saude-indigena')::uuid;
begin
  select m.id into v_edital from public."TB_MONITORAMENTO_INDIGENA" m
   where private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO") and m."CO_AREA" = 'saude-indigena' limit 1;
  if v_edital is null then return; end if;
  -- O preparar é idempotente: completa o edital e cria a versão do roteiro com aspectos.
  perform private."FC_PREPARAR_EDITAL_TREINAMENTO"('saude-indigena');
  if exists (select 1 from public."TB_ENTREVISTA_AVALIACAO" x join public."TB_ENTREVISTA" e on e."CO_ENTREVISTA" = x."CO_ENTREVISTA"
              where e."CO_MONITORAMENTO" = v_edital) then
    return; -- com nota: troca no reinício (reiniciar_edital_treinamento).
  end if;
  update public."TB_ENTREVISTA_EDITAL" set "CO_ROTEIRO" = v_roteiro, "DT_ATUALIZACAO" = now()
   where "CO_MONITORAMENTO" = v_edital and "CO_ROTEIRO" is distinct from v_roteiro;
  update public."TB_ENTREVISTA" set "CO_ROTEIRO" = v_roteiro
   where "CO_MONITORAMENTO" = v_edital and "TP_ORIGEM" = 'sistema' and "CO_ROTEIRO" is distinct from v_roteiro;
end;
$$;

-- ── 11. Saúde Indígena: versão nova do roteiro, com os 3 aspectos ──────────
-- Os editais que usam a versão anterior (100/2026 e outros) continuam nela.
do $$
declare
  v_antes public."TB_ROTEIRO_ENTREVISTA";
  v_id uuid := gen_random_uuid();
begin
  select * into v_antes from public."TB_ROTEIRO_ENTREVISTA" r
   where r."CO_AREA" = 'saude-indigena' and r."NO_ROTEIRO" = 'Saúde Indígena 2026 — Entrevista individual' and r."ST_ATIVO" = 'S'
   order by r."NU_VERSAO" desc limit 1;
  if v_antes."CO_ROTEIRO" is null
     or exists (select 1 from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = v_antes."CO_ROTEIRO") then
    return; -- sem o roteiro ou já com aspectos (idempotente)
  end if;
  update public."TB_ROTEIRO_ENTREVISTA" set "ST_ATIVO" = 'N'
   where "CO_ROTEIRO_ORIGEM" = v_antes."CO_ROTEIRO_ORIGEM" and "ST_ATIVO" = 'S';
  insert into public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO", "CO_ROTEIRO_ORIGEM", "NU_VERSAO", "CO_AREA", "NO_ROTEIRO",
    "DS_DESCRICAO", "NO_ETAPA", "TP_ESCALA", "VL_PASSO", "DS_NOTAS_PERMITIDAS", "VL_NOTA_MINIMA_TOTAL",
    "DS_NOTAS_ELIMINATORIAS", "ST_AUSENCIA_ELIMINA", "DS_DESEMPATE", "ST_SOMA_ANALISE", "DS_CONVOCACAO_PADRAO",
    "DS_BANCA_PADRAO", "ST_ATIVO")
  values (v_id, v_antes."CO_ROTEIRO_ORIGEM",
    (select max(r."NU_VERSAO") + 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO_ORIGEM" = v_antes."CO_ROTEIRO_ORIGEM"),
    v_antes."CO_AREA", v_antes."NO_ROTEIRO",
    'Modelo da Saúde Indígena (editais 100/2026, 105/2026, 110/2026 e seguintes): 4 competências; cada avaliador dá de 0 a 5 em 3 aspectos (Conceitua, Propriedade, Profundidade) e a nota dele é a média; competência = média da banca; apto com 8 pontos e 2 em cada competência (abaixo de 2 elimina).',
    v_antes."NO_ETAPA", v_antes."TP_ESCALA", v_antes."VL_PASSO", v_antes."DS_NOTAS_PERMITIDAS", v_antes."VL_NOTA_MINIMA_TOTAL",
    '[]'::jsonb, v_antes."ST_AUSENCIA_ELIMINA", v_antes."DS_DESEMPATE", v_antes."ST_SOMA_ANALISE",
    v_antes."DS_CONVOCACAO_PADRAO", v_antes."DS_BANCA_PADRAO", 'S');
  insert into public."TB_ROTEIRO_COMPETENCIA" ("CO_ROTEIRO", "NU_ORDEM", "NO_COMPETENCIA", "DS_DESCRICAO", "VL_NOTA_MAXIMA",
    "VL_PESO", "VL_MINIMO", "TP_MINIMO", "TP_AVALIACAO")
  select v_id, k."NU_ORDEM", k."NO_COMPETENCIA", k."DS_DESCRICAO", k."VL_NOTA_MAXIMA", k."VL_PESO", k."VL_MINIMO", k."TP_MINIMO", k."TP_AVALIACAO"
    from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = v_antes."CO_ROTEIRO";
  insert into public."TB_ROTEIRO_NIVEL" ("CO_ROTEIRO", "VL_NOTA", "NO_NIVEL", "DS_DESCRICAO")
  select v_id, n."VL_NOTA", n."NO_NIVEL", n."DS_DESCRICAO"
    from public."TB_ROTEIRO_NIVEL" n where n."CO_ROTEIRO" = v_antes."CO_ROTEIRO";
  insert into public."TB_ROTEIRO_ASPECTO" ("CO_ROTEIRO", "NU_ORDEM", "NO_ASPECTO")
  values (v_id, 1, 'Conceitua'), (v_id, 2, 'Propriedade'), (v_id, 3, 'Profundidade');
end;
$$;

notify pgrst, 'reload schema';

-- ═══ Conferências do ensaio ════════════════════════════════════════════════
create temp table ensaio_resultado (passo text primary key, ok boolean, detalhe text) on commit drop;

-- E1. Esquema, roteiro da Saúde Indígena e edital de treinamento.
do $$
declare
  v_si public."TB_ROTEIRO_ENTREVISTA";
  v_treino uuid;
  v json;
begin
  select * into v_si from public."TB_ROTEIRO_ENTREVISTA" r
   where r."CO_AREA" = 'saude-indigena' and r."NO_ROTEIRO" = 'Saúde Indígena 2026 — Entrevista individual' and r."ST_ATIVO" = 'S';
  if v_si."CO_ROTEIRO" is null then raise exception 'FALHOU E1: roteiro SI ativo sumiu'; end if;
  if (select count(*) from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO_ORIGEM" = v_si."CO_ROTEIRO_ORIGEM" and r."ST_ATIVO" = 'S') <> 1 then
    raise exception 'FALHOU E1: mais de uma versão ativa do roteiro SI';
  end if;
  if (select string_agg(s."NO_ASPECTO", ',' order by s."NU_ORDEM") from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = v_si."CO_ROTEIRO")
     is distinct from 'Conceitua,Propriedade,Profundidade' then
    raise exception 'FALHOU E1: versão nova do roteiro SI sem os 3 aspectos';
  end if;
  if v_si."DS_NOTAS_ELIMINATORIAS" <> '[]'::jsonb then raise exception 'FALHOU E1: roteiro SI com aspectos ainda tem notas eliminatórias'; end if;
  if (select count(*) from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = v_si."CO_ROTEIRO") <> 4
     or (select count(*) from public."TB_ROTEIRO_NIVEL" n where n."CO_ROTEIRO" = v_si."CO_ROTEIRO") <> 6 then
    raise exception 'FALHOU E1: competências ou níveis não copiados';
  end if;
  -- Os editais que usavam a versão anterior continuam nela.
  if exists (select 1 from public."TB_ENTREVISTA_EDITAL" e where e."CO_ROTEIRO" = v_si."CO_ROTEIRO") then
    raise exception 'FALHOU E1: edital real passou para a versão nova';
  end if;
  v := private."FC_ROTEIRO_JSON"(v_si."CO_ROTEIRO");
  if json_array_length(v -> 'aspectos') <> 3 then raise exception 'FALHOU E1: FC_ROTEIRO_JSON sem aspectos'; end if;
  -- Roteiro sem aspectos: lista vazia.
  if json_array_length(private."FC_ROTEIRO_JSON"((select r."CO_ROTEIRO" from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_AREA" = 'projetos' limit 1)) -> 'aspectos') <> 0 then
    raise exception 'FALHOU E1: roteiro sem aspectos com aspectos';
  end if;
  -- Treinamento: no roteiro de exemplo com aspectos.
  select m.id into v_treino from public."TB_MONITORAMENTO_INDIGENA" m where m."ST_TREINAMENTO" = 'S' and m."CO_AREA" = 'saude-indigena';
  -- (com nota já lançada, fica no roteiro anterior até o reinício)
  if (select e."CO_ROTEIRO" from public."TB_ENTREVISTA_EDITAL" e where e."CO_MONITORAMENTO" = v_treino)
     is distinct from md5('agsus-treinamento-roteiro-aspectos-saude-indigena')::uuid
     and not exists (select 1 from public."TB_ENTREVISTA_AVALIACAO" x join public."TB_ENTREVISTA" e on e."CO_ENTREVISTA" = x."CO_ENTREVISTA"
                      where e."CO_MONITORAMENTO" = v_treino) then
    raise exception 'FALHOU E1: edital de treinamento sem nota fora do roteiro com aspectos';
  end if;
  if (select r."NU_VERSAO" from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = md5('agsus-treinamento-roteiro-aspectos-saude-indigena')::uuid) <> 2
     or exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = md5('agsus-treinamento-roteiro-saude-indigena')::uuid and r."ST_ATIVO" = 'S') then
    raise exception 'FALHOU E1: roteiro de treinamento com aspectos não é a versão 2 (ou a 1 segue ativa)';
  end if;
  -- O preparar continua idempotente.
  perform private."FC_PREPARAR_EDITAL_TREINAMENTO"('saude-indigena');
  if (select count(*) from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = md5('agsus-treinamento-roteiro-aspectos-saude-indigena')::uuid) <> 3 then
    raise exception 'FALHOU E1: preparar duplicou os aspectos';
  end if;
  perform set_config('ensaio.treino', v_treino::text, true);
  perform set_config('ensaio.si_antigo', (select r."CO_ROTEIRO" from public."TB_ROTEIRO_ENTREVISTA" r
     where r."CO_ROTEIRO_ORIGEM" = v_si."CO_ROTEIRO_ORIGEM" and r."NU_VERSAO" = v_si."NU_VERSAO" - 1)::text, true);
  insert into ensaio_resultado values ('E1', true, 'roteiro SI v' || v_si."NU_VERSAO" || ' com aspectos; treinamento: '
    || (select case when e."CO_ROTEIRO" = md5('agsus-treinamento-roteiro-aspectos-saude-indigena')::uuid then 'roteiro com aspectos'
                    else 'tem nota, fica no anterior até o reinício' end
          from public."TB_ENTREVISTA_EDITAL" e where e."CO_MONITORAMENTO" = v_treino));
end;
$$;

-- E2. Casos dourados com aspectos (tests/fixtures/entrevistas/casos-de-calculo.json) no FC_CALCULAR_ENTREVISTA.
do $$
declare
  v_treino uuid := current_setting('ensaio.treino')::uuid;
  v_roteiro uuid := gen_random_uuid();
  v_casos jsonb := $casos$[{"nome":"aspectos (a): avaliadores 5 e 6 com 2,1,1 na competência 1 = 1,11; final 4,11","roteiro":"aspectos_si","compareceu":"S","aspectos":{"c1":[[1,1,1],[1,1,1],[1,1,1],[1,1,1],[2,1,1],[2,1,1]],"c2":[[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1]],"c3":[[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1]],"c4":[[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1],[1,1,1]]},"esperado":{"notas":[1.11,1,1,1],"total":4.11,"parecer":"INAPTO"}},{"nome":"aspectos (b): avaliador 3 com 2,2,3 na competência 4 = 2,06; final 8,06 APTO","roteiro":"aspectos_si","compareceu":"S","aspectos":{"c1":[[2,2,2],[2,2,2],[2,2,2],[2,2,2],[2,2,2],[2,2,2]],"c2":[[2,2,2],[2,2,2],[2,2,2],[2,2,2],[2,2,2],[2,2,2]],"c3":[[2,2,2],[2,2,2],[2,2,2],[2,2,2],[2,2,2],[2,2,2]],"c4":[[2,2,2],[2,2,2],[2,2,3],[2,2,2],[2,2,2],[2,2,2]]},"esperado":{"notas":[2,2,2,2.06],"total":8.06,"parecer":"APTO"}},{"nome":"aspectos (c): 4,61 + 4,67 + 4,61 + 4,78 = 18,67 APTO","roteiro":"aspectos_si","compareceu":"S","aspectos":{"c1":[[4,4,4],[4,4,5],[4,5,5],[5,5,5],[4,5,5],[5,5,5]],"c2":[[4,4,5],[4,5,5],[4,5,5],[4,5,5],[4,5,5],[5,5,5]],"c3":[[4,4,4],[4,4,5],[4,5,5],[5,5,5],[4,5,5],[5,5,5]],"c4":[[4,5,5],[4,5,5],[4,5,5],[4,5,5],[5,5,5],[5,5,5]]},"esperado":{"notas":[4.61,4.67,4.61,4.78],"total":18.67,"parecer":"APTO"}},{"nome":"aspectos: total arredonda só no fim (4 × 2,0556 = 8,22, não 8,24)","roteiro":"aspectos_si","compareceu":"S","aspectos":{"c1":[[2,2,2],[2,2,2],[2,2,2],[2,2,2],[2,2,2],[2,2,3]],"c2":[[2,2,2],[2,2,2],[2,2,2],[2,2,2],[2,2,2],[2,2,3]],"c3":[[2,2,2],[2,2,2],[2,2,2],[2,2,2],[2,2,2],[2,2,3]],"c4":[[2,2,2],[2,2,2],[2,2,2],[2,2,2],[2,2,2],[2,2,3]]},"esperado":{"notas":[2.06,2.06,2.06,2.06],"total":8.22,"parecer":"APTO"}},{"nome":"aspectos: avaliador com aspecto faltando não conta na média","roteiro":"aspectos_si","compareceu":"S","aspectos":{"c1":[[3,3,3],[5,5,null]],"c2":[[3,3,3]],"c3":[[3,3,3]],"c4":[[3,3,3]]},"esperado":{"notas":[3,3,3,3],"total":12,"parecer":"APTO"}},{"nome":"aspectos: competência sem avaliador completo = SEM_PARECER","roteiro":"aspectos_si","compareceu":"S","aspectos":{"c1":[[3,3,3]],"c2":[[3,3,3]],"c3":[[3,3,3]],"c4":[[2,null,null]]},"esperado":{"notas":[3,3,3,null],"total":9,"parecer":"SEM_PARECER"}},{"nome":"aspectos: eliminação pelo mínimo (1,67 < 2) mesmo com total alto","roteiro":"aspectos_si","compareceu":"S","aspectos":{"c1":[[2,2,1]],"c2":[[5,5,5]],"c3":[[5,5,5]],"c4":[[5,5,5]]},"esperado":{"notas":[1.67,5,5,5],"total":16.67,"parecer":"INAPTO"}},{"nome":"aspectos: competência no mínimo exato (média 2) é APTO","roteiro":"aspectos_si","compareceu":"S","aspectos":{"c1":[[2,2,2],[2,2,2]],"c2":[[3,3,3]],"c3":[[3,3,3]],"c4":[[1,2,3]]},"esperado":{"notas":[2,3,3,2],"total":10,"parecer":"APTO"}}]$casos$::jsonb;
  v_caso jsonb;
  v_e uuid;
  v_av uuid[];
  v_notas jsonb;
  v_total numeric;
  v_parecer text;
  v_i integer := 0;
  c record;
  a record;
  k integer;
begin
  insert into public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO", "CO_ROTEIRO_ORIGEM", "CO_AREA", "NO_ROTEIRO", "TP_ESCALA", "VL_PASSO",
    "VL_NOTA_MINIMA_TOTAL", "DS_NOTAS_ELIMINATORIAS", "ST_ATIVO")
  values (v_roteiro, v_roteiro, 'saude-indigena', 'Ensaio — aspectos', 'NIVEIS', 1, 8, '[0, 1]', 'N');
  insert into public."TB_ROTEIRO_COMPETENCIA" ("CO_ROTEIRO", "NU_ORDEM", "NO_COMPETENCIA", "VL_NOTA_MAXIMA", "VL_PESO", "VL_MINIMO")
  select v_roteiro, g, 'C' || g, 5, 1, 2 from generate_series(1, 4) g;
  insert into public."TB_ROTEIRO_NIVEL" ("CO_ROTEIRO", "VL_NOTA", "NO_NIVEL") select v_roteiro, g, 'Nível ' || g from generate_series(0, 5) g;
  insert into public."TB_ROTEIRO_ASPECTO" ("CO_ROTEIRO", "NU_ORDEM", "NO_ASPECTO")
  values (v_roteiro, 1, 'Conceitua'), (v_roteiro, 2, 'Propriedade'), (v_roteiro, 3, 'Profundidade');
  with novos as (
    insert into public."TB_ENTREVISTA_AVALIADOR" ("CO_MONITORAMENTO", "NO_AVALIADOR", "NO_ORIGEM", "NU_BANCA", "ST_ATIVO")
    select v_treino, 'Avaliador Ensaio ' || g, 'Ensaio', 9, 'N' from generate_series(1, 6) g
    returning "CO_AVALIADOR", "NO_AVALIADOR")
  select array_agg("CO_AVALIADOR" order by "NO_AVALIADOR") into v_av from novos;

  for v_caso in select value from jsonb_array_elements(v_casos) loop
    v_i := v_i + 1;
    insert into public."TB_ENTREVISTA" ("CO_AREA", "CO_MONITORAMENTO", "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO",
      "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_ROTEIRO", "ST_COMPARECEU", "ST_ATIVO")
    values ('saude-indigena', v_treino, 'Ensaio', 'Ensaio', '0', 'Candidato Ensaio ' || v_i,
      'sistema', 'ensaio-aspectos|' || v_i, v_roteiro, v_caso ->> 'compareceu', 'N')
    returning "CO_ENTREVISTA" into v_e;
    for c in select k2."CO_COMPETENCIA", 'c' || k2."NU_ORDEM" chave from public."TB_ROTEIRO_COMPETENCIA" k2 where k2."CO_ROTEIRO" = v_roteiro loop
      k := 0;
      for a in select value from jsonb_array_elements(coalesce(v_caso #> array['aspectos', c.chave], '[]')) loop
        k := k + 1;
        -- Linha do avaliador (a média dos lançados) e os aspectos que vieram (nulo = não lançado).
        insert into public."TB_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "VL_NOTA")
        select v_e, c."CO_COMPETENCIA", v_av[k], round(avg(n::numeric), 2)
          from jsonb_array_elements_text(a.value) n where n is not null;
        insert into public."TB_ENTREVISTA_AVALIACAO_ASPECTO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "CO_ASPECTO", "VL_NOTA")
        select v_e, c."CO_COMPETENCIA", v_av[k], s."CO_ASPECTO", (a.value ->> (s."NU_ORDEM" - 1))::numeric
          from public."TB_ROTEIRO_ASPECTO" s
         where s."CO_ROTEIRO" = v_roteiro and a.value ->> (s."NU_ORDEM" - 1) is not null;
      end loop;
    end loop;
    perform private."FC_CALCULAR_ENTREVISTA"(v_e);
    select e."VL_NOTA_TOTAL", e."TP_PARECER" into v_total, v_parecer from public."TB_ENTREVISTA" e where e."CO_ENTREVISTA" = v_e;
    select jsonb_agg(to_jsonb(n."VL_NOTA") order by k3."NU_ORDEM") into v_notas
      from public."TB_ROTEIRO_COMPETENCIA" k3
      left join public."TB_ENTREVISTA_NOTA" n on n."CO_ENTREVISTA" = v_e and n."NU_ORDEM" = k3."NU_ORDEM"
     where k3."CO_ROTEIRO" = v_roteiro;
    if v_total is distinct from (v_caso #>> '{esperado,total}')::numeric
       or v_parecer is distinct from v_caso #>> '{esperado,parecer}'
       or (select array_agg(x::numeric order by o) from jsonb_array_elements_text(v_notas) with ordinality t(x, o))
          is distinct from (select array_agg(x::numeric order by o) from jsonb_array_elements_text(v_caso #> '{esperado,notas}') with ordinality t(x, o)) then
      raise exception 'FALHOU E2 (%): total %, parecer %, notas % — esperado %', v_caso ->> 'nome', v_total, v_parecer, v_notas, v_caso -> 'esperado';
    end if;
  end loop;
  perform set_config('ensaio.avaliadores', array_to_string(v_av, ','), true);
  insert into ensaio_resultado values ('E2', true, v_i || ' casos dourados com aspectos iguais ao JS e ao Python');
end;
$$;

-- E3. Roteiro sem aspectos continua igual (média eliminatória 1 no roteiro SI anterior).
do $$
declare
  v_treino uuid := current_setting('ensaio.treino')::uuid;
  v_roteiro uuid := current_setting('ensaio.si_antigo')::uuid;
  v_av uuid[] := string_to_array(current_setting('ensaio.avaliadores'), ',')::uuid[];
  v_e uuid;
  r public."TB_ENTREVISTA";
begin
  insert into public."TB_ENTREVISTA" ("CO_AREA", "CO_MONITORAMENTO", "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO",
    "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_ROTEIRO", "ST_COMPARECEU", "ST_ATIVO")
  values ('saude-indigena', v_treino, 'Ensaio', 'Ensaio', '0', 'Candidato Ensaio sem aspectos', 'sistema', 'ensaio-aspectos|sem', v_roteiro, 'S', 'N')
  returning "CO_ENTREVISTA" into v_e;
  insert into public."TB_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR", "VL_NOTA")
  select v_e, k."CO_COMPETENCIA", v_av[g], case when k."NU_ORDEM" = 1 then 1 else 5 end
    from public."TB_ROTEIRO_COMPETENCIA" k cross join generate_series(1, 2) g where k."CO_ROTEIRO" = v_roteiro;
  perform private."FC_CALCULAR_ENTREVISTA"(v_e);
  select * into r from public."TB_ENTREVISTA" where "CO_ENTREVISTA" = v_e;
  if r."VL_NOTA_TOTAL" <> 16 or r."TP_PARECER" <> 'INAPTO' then
    raise exception 'FALHOU E3: sem aspectos mudou (total %, parecer %)', r."VL_NOTA_TOTAL", r."TP_PARECER";
  end if;
  insert into ensaio_resultado values ('E3', true, 'sem aspectos: média eliminatória 1 segue INAPTO, total 16');
end;
$$;

-- E4. RPCs como administrador sintético (claims do JWT; as RPCs decidem pela sessão): salvar roteiro e lançar notas com aspectos.
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-a000-0000000a5e01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.aspectos.admin@ensaio.invalid');
insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo)
select '00000000-0000-4000-a000-0000000a5e01', 'ensaio.aspectos.admin@ensaio.invalid', 'Ensaio Admin',
       (select g."CO_GRUPO_ACESSO" from public."TB_GRUPO_ACESSO" g where g."ST_ADMIN_GLOBAL" order by 1 limit 1), true;

-- O convocado fictício do lançamento (direto na tabela, no edital de treinamento).
insert into public."TB_ENTREVISTA" ("CO_AREA", "CO_MONITORAMENTO", "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO",
  "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_ROTEIRO", "ST_ATIVO")
values ('saude-indigena', current_setting('ensaio.treino')::uuid, 'DSEI Treinamento', 'Treinamento', '9909910001', 'Candidato Ensaio RPC',
  'sistema', 'ensaio-aspectos|rpc', md5('agsus-treinamento-roteiro-aspectos-saude-indigena')::uuid, 'S');

do $$
declare
  v_treino uuid := current_setting('ensaio.treino')::uuid;
  v_roteiro uuid := md5('agsus-treinamento-roteiro-aspectos-saude-indigena')::uuid;
  v_e uuid;
  v_comp uuid;
  v_av uuid;
  v_asp uuid[];
  v json;
  v_item jsonb;
  v_falhou boolean;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-a000-0000000a5e01","role":"authenticated","email":"ensaio.aspectos.admin@ensaio.invalid"}', true);
  if not private.is_master() then raise exception 'ENSAIO: o admin sintético não é admin global'; end if;

  -- salvar_roteiro_entrevista com aspectos (e eliminatórias que gravam vazias); nome repetido recusa.
  v := public.salvar_roteiro_entrevista(jsonb_build_object('nome', 'Ensaio com aspectos', 'area', 'saude-indigena',
         'escala', 'FAIXA', 'passo', 0.5, 'notas_eliminatorias', '[0]'::jsonb,
         'competencias', jsonb_build_array(jsonb_build_object('nome', 'Única', 'nota_maxima', 5)),
         'aspectos', jsonb_build_array(jsonb_build_object('nome', 'Conceitua'), 'Propriedade', jsonb_build_object('nome', 'Profundidade'))));
  if json_array_length(v -> 'aspectos') <> 3 or v #>> '{aspectos,1,nome}' <> 'Propriedade' or json_array_length(v -> 'notas_eliminatorias') <> 0 then
    raise exception 'FALHOU E4: salvar_roteiro_entrevista com aspectos: %', v;
  end if;
  v := public.salvar_roteiro_entrevista(jsonb_build_object('origem', v ->> 'origem', 'nome', 'Ensaio com aspectos', 'area', 'saude-indigena',
         'escala', 'FAIXA', 'competencias', jsonb_build_array(jsonb_build_object('nome', 'Única', 'nota_maxima', 5)),
         'notas_eliminatorias', '[0]'::jsonb));
  if json_array_length(v -> 'aspectos') <> 0 or (v ->> 'versao')::integer <> 2 or json_array_length(v -> 'notas_eliminatorias') <> 1 then
    raise exception 'FALHOU E4: versão sem aspectos: %', v;
  end if;
  begin
    perform public.salvar_roteiro_entrevista(jsonb_build_object('nome', 'Ensaio repetido', 'escala', 'FAIXA',
      'competencias', jsonb_build_array(jsonb_build_object('nome', 'Única', 'nota_maxima', 5)), 'aspectos', '["Conceitua", "conceitua"]'::jsonb));
    raise exception 'FALHOU E4: aceitou aspectos repetidos';
  exception when sqlstate '22023' then null;
  end;

  select e."CO_ENTREVISTA" into v_e from public."TB_ENTREVISTA" e where e."DS_CHAVE_ORIGEM" = 'ensaio-aspectos|rpc';
  select k."CO_COMPETENCIA" into v_comp from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = v_roteiro and k."NU_ORDEM" = 1;
  select b."CO_AVALIADOR" into v_av from public."TB_ENTREVISTA_AVALIADOR" b
   where b."CO_MONITORAMENTO" = v_treino and b."ST_ATIVO" = 'S' order by b."NO_AVALIADOR" limit 1;
  select array_agg(s."CO_ASPECTO" order by s."NU_ORDEM") into v_asp from public."TB_ROTEIRO_ASPECTO" s where s."CO_ROTEIRO" = v_roteiro;

  -- Recusas: só a nota; faltando aspecto; aspecto nulo; fora da escala; aspecto de fora; aspecto repetido.
  for v_item in select value from jsonb_array_elements(jsonb_build_array(
      jsonb_build_object('nota', 3),
      jsonb_build_object('aspectos', jsonb_build_array(jsonb_build_object('aspecto', v_asp[1], 'nota', 2), jsonb_build_object('aspecto', v_asp[2], 'nota', 2))),
      jsonb_build_object('aspectos', jsonb_build_array(jsonb_build_object('aspecto', v_asp[1], 'nota', 2), jsonb_build_object('aspecto', v_asp[2], 'nota', 2), jsonb_build_object('aspecto', v_asp[3], 'nota', null))),
      jsonb_build_object('aspectos', jsonb_build_array(jsonb_build_object('aspecto', v_asp[1], 'nota', 2), jsonb_build_object('aspecto', v_asp[2], 'nota', 2), jsonb_build_object('aspecto', v_asp[3], 'nota', 6))),
      jsonb_build_object('aspectos', jsonb_build_array(jsonb_build_object('aspecto', v_asp[1], 'nota', 2), jsonb_build_object('aspecto', v_asp[2], 'nota', 2), jsonb_build_object('aspecto', gen_random_uuid(), 'nota', 2))),
      jsonb_build_object('aspectos', jsonb_build_array(jsonb_build_object('aspecto', v_asp[1], 'nota', 2), jsonb_build_object('aspecto', v_asp[1], 'nota', 2), jsonb_build_object('aspecto', v_asp[2], 'nota', 2)))))
  loop
    v_falhou := false;
    begin
      perform public.lancar_notas_entrevista(v_e, jsonb_build_object('notas', jsonb_build_array(
        v_item || jsonb_build_object('competencia', v_comp, 'avaliador', v_av))));
    exception when sqlstate '22023' then v_falhou := true;
    end;
    if not v_falhou then raise exception 'FALHOU E4: lancar aceitou %', v_item; end if;
  end loop;

  -- Válido: 2, 2, 3 → nota do avaliador 2,33; histórico "2; 2; 3".
  v := public.lancar_notas_entrevista(v_e, jsonb_build_object('compareceu', 'S', 'notas', jsonb_build_array(jsonb_build_object(
         'competencia', v_comp, 'avaliador', v_av, 'aspectos', jsonb_build_array(
           jsonb_build_object('aspecto', v_asp[3], 'nota', 3), jsonb_build_object('aspecto', v_asp[1], 'nota', 2),
           jsonb_build_object('aspecto', v_asp[2], 'nota', 2))))));
  if (select x."VL_NOTA" from public."TB_ENTREVISTA_AVALIACAO" x where x."CO_ENTREVISTA" = v_e) <> 2.33
     or (select count(*) from public."TB_ENTREVISTA_AVALIACAO_ASPECTO" y where y."CO_ENTREVISTA" = v_e) <> 3
     or (select h."DS_VALOR_NOVO" from public."TH_ENTREVISTA_AVALIACAO" h where h."CO_ENTREVISTA" = v_e and h."DS_CAMPO" = 'aspectos') <> '2; 2; 3' then
    raise exception 'FALHOU E4: lançamento com aspectos não gravou como esperado';
  end if;
  if not exists (select 1 from json_array_elements(v -> 'convocados') c, json_array_elements(c -> 'avaliacoes') a
                  where c ->> 'id' = v_e::text and json_array_length(a -> 'aspectos') = 3) then
    raise exception 'FALHOU E4: obter_entrevistas_do_edital sem os aspectos da avaliação';
  end if;
  if (select e."TP_PARECER" from public."TB_ENTREVISTA" e where e."CO_ENTREVISTA" = v_e) <> 'SEM_PARECER'
     or (select n."VL_NOTA" from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = v_e and n."NU_ORDEM" = 1) <> 2.33 then
    raise exception 'FALHOU E4: cálculo depois do lançamento';
  end if;
  -- Mesmas notas: nada muda; apagar (aspectos nulo) leva os aspectos.
  perform public.lancar_notas_entrevista(v_e, jsonb_build_object('notas', jsonb_build_array(jsonb_build_object(
         'competencia', v_comp, 'avaliador', v_av, 'aspectos', jsonb_build_array(
           jsonb_build_object('aspecto', v_asp[1], 'nota', 2), jsonb_build_object('aspecto', v_asp[2], 'nota', 2),
           jsonb_build_object('aspecto', v_asp[3], 'nota', 3))))));
  if (select count(*) from public."TH_ENTREVISTA_AVALIACAO" h where h."CO_ENTREVISTA" = v_e and h."DS_CAMPO" = 'aspectos') <> 1 then
    raise exception 'FALHOU E4: as mesmas notas gravaram histórico de novo';
  end if;
  perform public.lancar_notas_entrevista(v_e, jsonb_build_object('notas', jsonb_build_array(jsonb_build_object(
         'competencia', v_comp, 'avaliador', v_av, 'aspectos', null))));
  if exists (select 1 from public."TB_ENTREVISTA_AVALIACAO_ASPECTO" y where y."CO_ENTREVISTA" = v_e)
     or exists (select 1 from public."TB_ENTREVISTA_AVALIACAO" x where x."CO_ENTREVISTA" = v_e) then
    raise exception 'FALHOU E4: apagar não levou a nota e os aspectos';
  end if;
  insert into ensaio_resultado values ('E4', true, 'salvar roteiro com aspectos; lançar valida, grava 2,33, histórico, payload e apaga');
end;
$$;

-- E5. Conferência: responde com as avaliações (aspectos no lugar da média do avaliador).
do $$
begin
  if public.conferencia_ler_entrevistas() -> 'avaliacoes' is null then raise exception 'FALHOU E5: conferência sem avaliações'; end if;
  insert into ensaio_resultado values ('E5', true, 'conferencia_ler_entrevistas responde');
end;
$$;

-- E6. Reinício do treinamento (admin): apaga as notas (e os aspectos, em cascata) e volta no roteiro com aspectos.
do $$
declare
  v_treino uuid := current_setting('ensaio.treino')::uuid;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-a000-0000000a5e01","role":"authenticated","email":"ensaio.aspectos.admin@ensaio.invalid"}', true);
  perform public.reiniciar_edital_treinamento(v_treino);
  if (select e."CO_ROTEIRO" from public."TB_ENTREVISTA_EDITAL" e where e."CO_MONITORAMENTO" = v_treino)
     is distinct from md5('agsus-treinamento-roteiro-aspectos-saude-indigena')::uuid then
    raise exception 'FALHOU E6: o reinício não pôs o treinamento no roteiro com aspectos';
  end if;
  if exists (select 1 from public."TB_ENTREVISTA_AVALIACAO_ASPECTO" y join public."TB_ENTREVISTA" e on e."CO_ENTREVISTA" = y."CO_ENTREVISTA"
              where e."CO_MONITORAMENTO" = v_treino) then
    raise exception 'FALHOU E6: aspectos sobreviveram ao reinício';
  end if;
  insert into ensaio_resultado values ('E6', true, 'reinício: treinamento no roteiro com aspectos');
end;
$$;

select json_agg(json_build_object('passo', passo, 'ok', ok, 'detalhe', detalhe) order by passo) as ensaio from ensaio_resultado;

rollback;
