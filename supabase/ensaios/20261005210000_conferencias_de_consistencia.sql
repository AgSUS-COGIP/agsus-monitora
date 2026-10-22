/*
  ENSAIO de 20261005210000_conferencias_de_consistencia.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela), confere RLS e grants, roda as leituras do
  job nos dados reais (só confere o formato e que não sai nome nem CPF), faz
  quatro execuções do job (papel service_role) com avisos sintéticos
  (ENSAIO_ANALISE ligado a um edital real, ENSAIO_CARGA numa vaga fictícia) —
  abrir, manter, resolver, reabrir, recusar dado pessoal, falha parcial —, lê
  e ignora como leitor, gestor, pessoa sem a área e administrador global
  sintéticos (papel authenticated; o administrador fica no grupo 'admin', o
  único admin global) e termina em ROLLBACK: nada fica gravado.

  Resultado esperado: as mensagens "ok E1" … "ok E6" e a linha "ENSAIO OK" do
  SELECT final. Qualquer "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/conferencias-migration.test.js confere que o
  corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══
-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TL_SYNC_EMPREGARE"') is null then
    raise exception 'Aplique antes 20261005170000_robo_empregare.sql.';
  end if;
  if to_regprocedure('private."FC_LISTA_CONVOCACAO_VIGENTE"(uuid)') is null then
    raise exception 'Aplique antes 20261005150000_convocacao_unica_da_entrevista.sql.';
  end if;
  if to_regclass('public."TB_AGENDA_ENTREVISTA"') is null then
    raise exception 'Aplique antes 20261005120000_agenda_das_entrevistas.sql.';
  end if;
  if to_regclass('public."TB_AJUSTE_PONTUACAO_RECURSO"') is null then
    raise exception 'Aplique antes 20261005130000_recurso_ajusta_pontuacao.sql.';
  end if;
  if to_regclass('public."TH_PUBLICACAO_APROVADO"') is null then
    raise exception 'Aplique antes 20261005160000_lista_de_aprovados_da_classificacao.sql.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'TB_CANDIDATO_APROVADO'
                    and column_name = 'DT_CONVOCACAO') then
    raise exception 'Aplique antes 20261005180000_convocado_e_carta_de_convocacao.sql.';
  end if;
end;
$$;

-- 1. Log das execuções ------------------------------------------------------------------
create table public."TL_CONFERENCIA" (
  "CO_EXECUCAO" text not null,
  "DT_INICIO" timestamptz not null default now(),
  "DT_FIM" timestamptz,
  "TP_SITUACAO" text not null default 'EM_ANDAMENTO',
  "TP_DISPARO" text not null,
  "CO_USUARIO_DISPARO" uuid,
  "DS_CONFERENCIA" jsonb not null default '[]'::jsonb,
  "DS_FALHA" jsonb not null default '[]'::jsonb,
  "QT_AVISO_NOVO" integer not null default 0,
  "QT_AVISO_ABERTO" integer not null default 0,
  "QT_AVISO_RESOLVIDO" integer not null default 0,
  "DS_MENSAGEM" text,
  "DS_URL_EXECUCAO" text,
  constraint "PK_TL_CONFERENCIA" primary key ("CO_EXECUCAO"),
  constraint "CK_CONFER_COEXECUCAO" check ("CO_EXECUCAO" ~ '^[A-Za-z0-9_-]{8,80}$'),
  constraint "CK_CONFER_TPSITUACAO" check ("TP_SITUACAO" in ('EM_ANDAMENTO', 'CONCLUIDA', 'PARCIAL', 'FALHOU')),
  constraint "CK_CONFER_TPDISPARO" check ("TP_DISPARO" in ('AGENDA', 'MONITORA', 'GITHUB')),
  constraint "CK_CONFER_USUARIO" check (("TP_DISPARO" = 'MONITORA') = ("CO_USUARIO_DISPARO" is not null)),
  constraint "CK_CONFER_LISTAS" check (jsonb_typeof("DS_CONFERENCIA") = 'array' and jsonb_typeof("DS_FALHA") = 'array'),
  constraint "CK_CONFER_QT" check ("QT_AVISO_NOVO" >= 0 and "QT_AVISO_ABERTO" >= 0 and "QT_AVISO_RESOLVIDO" >= 0),
  constraint "CK_CONFER_TAMANHOS" check (
    coalesce(length("DS_MENSAGEM"), 0) <= 2000
    and ("DS_URL_EXECUCAO" is null or ("DS_URL_EXECUCAO" ~ '^https://github\.com/' and length("DS_URL_EXECUCAO") <= 300))
  )
);
comment on table public."TL_CONFERENCIA" is 'Log das execuções do job de conferências de consistência (scripts/conferencias/): uma linha por execução.';
comment on column public."TL_CONFERENCIA"."CO_EXECUCAO" is 'Identificador da execução (gerado pelo job: conf-<data>-<sufixo>).';
comment on column public."TL_CONFERENCIA"."DT_INICIO" is 'Início da execução.';
comment on column public."TL_CONFERENCIA"."DT_FIM" is 'Fechamento (finalizar_conferencia). Nulo enquanto roda.';
comment on column public."TL_CONFERENCIA"."TP_SITUACAO" is 'EM_ANDAMENTO; CONCLUIDA (todas as conferências rodaram); PARCIAL (alguma conferência falhou); FALHOU (erro geral).';
comment on column public."TL_CONFERENCIA"."TP_DISPARO" is 'Quem disparou: AGENDA (6h de Brasília), MONITORA (botão Rodar agora) ou GITHUB (Run workflow na aba Actions).';
comment on column public."TL_CONFERENCIA"."CO_USUARIO_DISPARO" is 'Usuário do MONITORA (auth.users.id) que clicou em Rodar agora; nulo nos outros disparos.';
comment on column public."TL_CONFERENCIA"."DS_CONFERENCIA" is 'Códigos das conferências que rodaram até o fim (lista json): só elas resolvem avisos.';
comment on column public."TL_CONFERENCIA"."DS_FALHA" is 'Códigos das conferências que falharam (lista json): os avisos delas ficam como estavam.';
comment on column public."TL_CONFERENCIA"."QT_AVISO_NOVO" is 'Avisos que abriram nesta execução (novos ou reabertos).';
comment on column public."TL_CONFERENCIA"."QT_AVISO_ABERTO" is 'Avisos abertos ao fim da execução (todas as conferências).';
comment on column public."TL_CONFERENCIA"."QT_AVISO_RESOLVIDO" is 'Avisos que esta execução marcou como resolvidos.';
comment on column public."TL_CONFERENCIA"."DS_MENSAGEM" is 'Erro geral ou observação (sem dado pessoal).';
comment on column public."TL_CONFERENCIA"."DS_URL_EXECUCAO" is 'Endereço da execução no GitHub Actions.';
comment on constraint "CK_CONFER_COEXECUCAO" on public."TL_CONFERENCIA" is 'Identificador de 8 a 80 caracteres seguros.';
comment on constraint "CK_CONFER_TPSITUACAO" on public."TL_CONFERENCIA" is 'Situações válidas.';
comment on constraint "CK_CONFER_TPDISPARO" on public."TL_CONFERENCIA" is 'Disparos válidos.';
comment on constraint "CK_CONFER_USUARIO" on public."TL_CONFERENCIA" is 'Usuário só (e sempre) no disparo pelo MONITORA.';
comment on constraint "CK_CONFER_LISTAS" on public."TL_CONFERENCIA" is 'Conferências rodadas e falhas em listas json.';
comment on constraint "CK_CONFER_QT" on public."TL_CONFERENCIA" is 'Contagens não negativas.';
comment on constraint "CK_CONFER_TAMANHOS" on public."TL_CONFERENCIA" is 'Mensagem até 2000 caracteres; endereço só do GitHub, até 300.';

create index "IN_CONFER_INICIO" on public."TL_CONFERENCIA" ("DT_INICIO" desc);
comment on index public."IN_CONFER_INICIO" is 'Últimas execuções (Status das atualizações e tela dos avisos).';

-- 2. Avisos vigentes --------------------------------------------------------------------
create table public."TB_AVISO_CONFERENCIA" (
  "CO_AVISO_CONFERENCIA" uuid not null default gen_random_uuid(),
  "CO_CONFERENCIA" varchar(60) not null,
  "DS_ESCOPO" varchar(200) not null,
  "TP_GRAVIDADE" varchar(12) not null,
  "CO_MODULO" varchar(20) not null,
  "CO_AREA" text,
  "CO_MONITORAMENTO" uuid,
  "QT_OCORRENCIA" integer not null,
  "DS_EXEMPLO" jsonb not null default '[]'::jsonb,
  "DS_RESUMO" varchar(300) not null,
  "TP_SITUACAO" varchar(10) not null default 'ABERTO',
  "DT_PRIMEIRA_VEZ" timestamptz not null default now(),
  "DT_ULTIMA_VEZ" timestamptz not null default now(),
  "DT_RESOLUCAO" timestamptz,
  "CO_USUARIO_IGNORADO" uuid,
  "DT_IGNORADO" timestamptz,
  "DS_MOTIVO_IGNORADO" varchar(500),
  "QT_OCORRENCIA_IGNORADA" integer,
  "CO_EXECUCAO" text not null,
  constraint "PK_TB_AVISO_CONFERENCIA" primary key ("CO_AVISO_CONFERENCIA"),
  constraint "UK_AVISOCONF_CONFESCOPO" unique ("CO_CONFERENCIA", "DS_ESCOPO"),
  constraint "FK_AREA_AVISOCONF" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA"),
  constraint "FK_MONITORAMENTO_AVISOCONF" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "FK_CONFER_AVISOCONF" foreign key ("CO_EXECUCAO") references public."TL_CONFERENCIA" ("CO_EXECUCAO"),
  constraint "CK_AVISOCONF_COCONFERENCIA" check ("CO_CONFERENCIA" ~ '^[A-Z][A-Z0-9_]{2,59}$'),
  constraint "CK_AVISOCONF_DSESCOPO" check ("DS_ESCOPO" ~ '^[a-z_]{2,20}:[A-Za-z0-9._:/|-]{1,170}$'),
  constraint "CK_AVISOCONF_TPGRAVIDADE" check ("TP_GRAVIDADE" in ('CRITICA', 'ATENCAO', 'INFORMATIVO')),
  constraint "CK_AVISOCONF_COMODULO" check ("CO_MODULO" in ('analises', 'entrevistas', 'classificacao', 'aprovados', 'cargas')),
  constraint "CK_AVISOCONF_QT" check ("QT_OCORRENCIA" >= 1 and coalesce("QT_OCORRENCIA_IGNORADA", 1) >= 1),
  constraint "CK_AVISOCONF_EXEMPLO" check (jsonb_typeof("DS_EXEMPLO") = 'array' and jsonb_array_length("DS_EXEMPLO") <= 20),
  constraint "CK_AVISOCONF_TPSITUACAO" check ("TP_SITUACAO" in ('ABERTO', 'RESOLVIDO', 'IGNORADO')),
  constraint "CK_AVISOCONF_RESOLUCAO" check (("TP_SITUACAO" = 'RESOLVIDO') = ("DT_RESOLUCAO" is not null)),
  constraint "CK_AVISOCONF_IGNORADO" check (
    ("TP_SITUACAO" = 'IGNORADO') = ("CO_USUARIO_IGNORADO" is not null)
    and ("CO_USUARIO_IGNORADO" is null) = ("DT_IGNORADO" is null)
    and ("CO_USUARIO_IGNORADO" is null) = ("DS_MOTIVO_IGNORADO" is null)
    and ("CO_USUARIO_IGNORADO" is null) = ("QT_OCORRENCIA_IGNORADA" is null)
  )
);
comment on table public."TB_AVISO_CONFERENCIA" is 'Avisos das conferências de consistência (job Python scripts/conferencias/): um por conferência e escopo, com quantidade e exemplos só com ids e códigos.';
comment on column public."TB_AVISO_CONFERENCIA"."CO_AVISO_CONFERENCIA" is 'Identificador do aviso.';
comment on column public."TB_AVISO_CONFERENCIA"."CO_CONFERENCIA" is 'Código da conferência (catálogo em scripts/conferencias/catalogo.py; ex.: ANALISE_APROVADA_ABAIXO_DO_CORTE).';
comment on column public."TB_AVISO_CONFERENCIA"."DS_ESCOPO" is 'Onde a conferência achou: edital:<uuid>, area:<área> ou vaga:<código da Empregare>. Com a conferência, identifica o aviso.';
comment on column public."TB_AVISO_CONFERENCIA"."TP_GRAVIDADE" is 'CRITICA (resultado errado pode sair), ATENCAO (conferir) ou INFORMATIVO.';
comment on column public."TB_AVISO_CONFERENCIA"."CO_MODULO" is 'Módulo do aviso: analises, entrevistas, classificacao, aprovados ou cargas (o selo de cada tela conta os dele).';
comment on column public."TB_AVISO_CONFERENCIA"."CO_AREA" is 'Área (TB_AREA) do edital ou do escopo; nulo = só o administrador global vê.';
comment on column public."TB_AVISO_CONFERENCIA"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id); nulo quando o escopo é a área ou a vaga sem edital.';
comment on column public."TB_AVISO_CONFERENCIA"."QT_OCORRENCIA" is 'Quantos casos a conferência achou na última vez que viu o aviso.';
comment on column public."TB_AVISO_CONFERENCIA"."DS_EXEMPLO" is 'Até 20 exemplos, só ids e códigos (lista json de textos sem espaço, sem @ e sem 11 dígitos seguidos). Nunca nome, CPF ou e-mail.';
comment on column public."TB_AVISO_CONFERENCIA"."DS_RESUMO" is 'Frase curta montada pelo job a partir do catálogo (contagens e números de edital; sem dado pessoal).';
comment on column public."TB_AVISO_CONFERENCIA"."TP_SITUACAO" is 'ABERTO; RESOLVIDO (a conferência rodou e não achou mais); IGNORADO (com motivo; volta a ABERTO se a quantidade crescer).';
comment on column public."TB_AVISO_CONFERENCIA"."DT_PRIMEIRA_VEZ" is 'Quando o aviso abriu (de novo, se tinha sido resolvido).';
comment on column public."TB_AVISO_CONFERENCIA"."DT_ULTIMA_VEZ" is 'Última execução que achou o caso.';
comment on column public."TB_AVISO_CONFERENCIA"."DT_RESOLUCAO" is 'Quando a conferência deixou de achar (só RESOLVIDO).';
comment on column public."TB_AVISO_CONFERENCIA"."CO_USUARIO_IGNORADO" is 'Quem ignorou (auth.users.id); só IGNORADO.';
comment on column public."TB_AVISO_CONFERENCIA"."DT_IGNORADO" is 'Quando ignorou.';
comment on column public."TB_AVISO_CONFERENCIA"."DS_MOTIVO_IGNORADO" is 'Motivo informado ao ignorar (10 a 500 caracteres).';
comment on column public."TB_AVISO_CONFERENCIA"."QT_OCORRENCIA_IGNORADA" is 'Quantidade no momento em que foi ignorado: se crescer, o aviso volta a ABERTO.';
comment on column public."TB_AVISO_CONFERENCIA"."CO_EXECUCAO" is 'Última execução (TL_CONFERENCIA) que achou o caso.';
comment on constraint "UK_AVISOCONF_CONFESCOPO" on public."TB_AVISO_CONFERENCIA" is 'Um aviso por conferência e escopo.';
comment on constraint "FK_AREA_AVISOCONF" on public."TB_AVISO_CONFERENCIA" is 'Área do aviso.';
comment on constraint "FK_MONITORAMENTO_AVISOCONF" on public."TB_AVISO_CONFERENCIA" is 'Edital do aviso; o aviso sai junto com o edital.';
comment on constraint "FK_CONFER_AVISOCONF" on public."TB_AVISO_CONFERENCIA" is 'Última execução que achou o caso.';
comment on constraint "CK_AVISOCONF_COCONFERENCIA" on public."TB_AVISO_CONFERENCIA" is 'Código em maiúsculas, dígitos e sublinhado.';
comment on constraint "CK_AVISOCONF_DSESCOPO" on public."TB_AVISO_CONFERENCIA" is 'Escopo tipo:identificador, sem espaço.';
comment on constraint "CK_AVISOCONF_TPGRAVIDADE" on public."TB_AVISO_CONFERENCIA" is 'Gravidades válidas.';
comment on constraint "CK_AVISOCONF_COMODULO" on public."TB_AVISO_CONFERENCIA" is 'Módulos válidos.';
comment on constraint "CK_AVISOCONF_QT" on public."TB_AVISO_CONFERENCIA" is 'Quantidades positivas.';
comment on constraint "CK_AVISOCONF_EXEMPLO" on public."TB_AVISO_CONFERENCIA" is 'Exemplos em lista json de até 20.';
comment on constraint "CK_AVISOCONF_TPSITUACAO" on public."TB_AVISO_CONFERENCIA" is 'Situações válidas.';
comment on constraint "CK_AVISOCONF_RESOLUCAO" on public."TB_AVISO_CONFERENCIA" is 'Data de resolução só (e sempre) no aviso resolvido.';
comment on constraint "CK_AVISOCONF_IGNORADO" on public."TB_AVISO_CONFERENCIA" is 'Quem, quando, motivo e quantidade só (e sempre) no aviso ignorado.';

create index "IN_AVISOCONF_VIGENTE" on public."TB_AVISO_CONFERENCIA" ("CO_MODULO", "CO_AREA")
  where "TP_SITUACAO" in ('ABERTO', 'IGNORADO');
create index "IN_FKAVISOCONF_COMONITOR" on public."TB_AVISO_CONFERENCIA" ("CO_MONITORAMENTO");
create index "IN_FKAVISOCONF_COEXECUCAO" on public."TB_AVISO_CONFERENCIA" ("CO_EXECUCAO");
create index "IN_FKAVISOCONF_COAREA" on public."TB_AVISO_CONFERENCIA" ("CO_AREA");
comment on index public."IN_AVISOCONF_VIGENTE" is 'Avisos abertos e ignorados por módulo e área (tela e selos).';
comment on index public."IN_FKAVISOCONF_COMONITOR" is 'Chave estrangeira para TB_MONITORAMENTO_INDIGENA.';
comment on index public."IN_FKAVISOCONF_COEXECUCAO" is 'Chave estrangeira para TL_CONFERENCIA.';
comment on index public."IN_FKAVISOCONF_COAREA" is 'Chave estrangeira para TB_AREA.';

-- A data de inscrição da análise vem da Empregare pelo código do candidato.
create index if not exists "IN_EMPREGCAND_COCANDEMPREG" on public."TB_EMPREGARE_CANDIDATO" ("CO_CANDIDATO_EMPREGARE")
  where "CO_CANDIDATO_EMPREGARE" is not null;
comment on index public."IN_EMPREGCAND_COCANDEMPREG" is 'Data da candidatura pelo código do candidato (conferência das datas das análises).';

-- 3. Acesso: só as funções abaixo -------------------------------------------------------
alter table public."TL_CONFERENCIA" enable row level security;
alter table public."TB_AVISO_CONFERENCIA" enable row level security;
revoke all on public."TL_CONFERENCIA", public."TB_AVISO_CONFERENCIA" from public, anon, authenticated;

-- 4. Funções de apoio (privadas) --------------------------------------------------------
create function private."FC_CONFERENCIA_RECURSO"(p_modulo text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case p_modulo
    when 'analises' then 'analises'
    when 'entrevistas' then 'entrevistas'
    when 'classificacao' then 'classificacao'
    when 'aprovados' then 'aprovados'
  end;
$function$;
comment on function private."FC_CONFERENCIA_RECURSO"(text) is 'Módulo de permissão (pode_recurso) de cada módulo de aviso; cargas não tem: só o administrador global.';

create function private."FC_PODE_VER_AVISO"(p_modulo text, p_area text, p_edital uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_recurso text := private."FC_CONFERENCIA_RECURSO"(p_modulo);
begin
  if private.is_master() then
    return true;
  end if;
  if v_recurso is null or p_area is null or not private.pode_recurso(v_recurso, 1) then
    return false;
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    return false;
  end if;
  if p_edital is null then
    return private."FC_EDITAIS_VISIVEIS"() is null;
  end if;
  return private."FC_PODE_VER_EDITAL"(p_edital);
end;
$function$;
comment on function private."FC_PODE_VER_AVISO"(text, text, uuid) is 'Quem chama vê o aviso? Administrador global sempre; os demais com o módulo (leitor), a área e o edital no recorte (aviso de área inteira: só sem recorte de coordenação). Cargas e avisos sem área: só o administrador global.';

create function private."FC_PODE_IGNORAR_AVISO"(p_modulo text, p_area text, p_edital uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select private.is_master()
      or (private."FC_PODE_VER_AVISO"(p_modulo, p_area, p_edital)
          and private.pode_recurso(
                private."FC_CONFERENCIA_RECURSO"(p_modulo),
                case private."FC_CONFERENCIA_RECURSO"(p_modulo) when 'classificacao' then 2 else 3 end));
$function$;
comment on function private."FC_PODE_IGNORAR_AVISO"(text, text, uuid) is 'Quem chama pode ignorar o aviso? Administrador global, ou quem vê o aviso e administra o módulo (nível admin; na classificação, editor, o nível mais alto dela).';

create function private."FC_TEXTO_SEGURO_DO_AVISO"(p_texto text)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select p_texto is not null and p_texto !~ '@' and p_texto !~ '[0-9]{11}'
     and p_texto !~ '[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}';
$function$;
comment on function private."FC_TEXTO_SEGURO_DO_AVISO"(text) is 'Texto de aviso sem cara de dado pessoal: sem @ (e-mail) e sem CPF (11 dígitos seguidos ou com pontos).';

create function private."FC_EXIGIR_EXECUCAO_CONFERENCIA"(p_execucao text)
returns void
language plpgsql
stable
set search_path to ''
as $function$
begin
  if p_execucao is null or p_execucao !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'Identificador de execução inválido' using errcode = '22023';
  end if;
  if not exists (select 1 from public."TL_CONFERENCIA" c
                  where c."CO_EXECUCAO" = p_execucao and c."TP_SITUACAO" = 'EM_ANDAMENTO') then
    raise exception 'Execução % não encontrada ou já fechada', p_execucao using errcode = '22023';
  end if;
end;
$function$;
comment on function private."FC_EXIGIR_EXECUCAO_CONFERENCIA"(text) is 'Recusa (22023) identificador inválido ou execução de conferências que não está em andamento.';

/*
  O edital de cada análise: as análises não têm chave para o edital; o elo é a
  área + o número do edital (FC_NUMERO_EDITAL), como na Classificação. Havendo
  dois editais com o mesmo número na área, vale o ativo e o mais recente.
*/
create function private."FC_EDITAIS_POR_NUMERO"()
returns table (edital_id uuid, area text, numero text, ativo boolean)
language sql
stable
security definer
set search_path to ''
as $function$
  select x.id, x."CO_AREA", x.numero, x.ativo
    from (
      select m.id, m."CO_AREA", private."FC_NUMERO_EDITAL"(m.edital) as numero, coalesce(m.ativo, false) as ativo,
             row_number() over (partition by m."CO_AREA", private."FC_NUMERO_EDITAL"(m.edital)
                                order by coalesce(m.ativo, false) desc, m.updated_at desc nulls last, m.id) as ordem
        from public."TB_MONITORAMENTO_INDIGENA" m
       where private."FC_NUMERO_EDITAL"(m.edital) is not null
    ) x
   where x.ordem = 1;
$function$;
comment on function private."FC_EDITAIS_POR_NUMERO"() is 'Um edital por área e número (o ativo e mais recente): o elo das análises curriculares com o edital nas conferências.';

revoke all on function private."FC_CONFERENCIA_RECURSO"(text) from public, anon, authenticated;
revoke all on function private."FC_PODE_VER_AVISO"(text, text, uuid) from public, anon, authenticated;
revoke all on function private."FC_PODE_IGNORAR_AVISO"(text, text, uuid) from public, anon, authenticated;
revoke all on function private."FC_TEXTO_SEGURO_DO_AVISO"(text) from public, anon, authenticated;
revoke all on function private."FC_EXIGIR_EXECUCAO_CONFERENCIA"(text) from public, anon, authenticated;
revoke all on function private."FC_EDITAIS_POR_NUMERO"() from public, anon, authenticated;

-- 5. Leitura para o job (service_role) --------------------------------------------------
create function public.conferencia_ler_contexto()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'hoje', (now() at time zone 'America/Sao_Paulo')::date,
    'editais', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', m.id, 'numero', private."FC_NUMERO_EDITAL"(m.edital), 'area', m."CO_AREA",
          'ativo', coalesce(m.ativo, false)) order by m."CO_AREA", m.edital), '[]'::jsonb)
        from public."TB_MONITORAMENTO_INDIGENA" m
    ),
    'regras', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'edital', r."CO_MONITORAMENTO",
          'versao', r."NU_VERSAO_VIGENTE",
          'nota_minima', h."DS_CONFIGURACAO" #> '{documental,nota_minima}',
          'teto_experiencia', h."DS_CONFIGURACAO" #> '{documental,teto_experiencia}')), '[]'::jsonb)
        from public."TB_REGRA_CLASSIFICACAO" r
        join public."TH_REGRA_CLASSIFICACAO" h
          on h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and h."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
    )
  );
$function$;
comment on function public.conferencia_ler_contexto() is
  'Conferências (job Python): editais (id, número, área, ativo), o dia de hoje em Brasília e a regra de classificação vigente de cada edital (nota mínima documental e teto de experiência, quando a regra tiver). Sem dado pessoal. Só service_role.';

create function public.conferencia_ler_analises(p_apos uuid default null, p_limite integer default 5000)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 5000), 1), 10000);
  v_linhas jsonb;
  v_ultimo uuid;
  v_qt integer;
begin
  with pagina as (
    select a.id, a."CO_AREA" as area, private."FC_NUMERO_EDITAL"(a.edital) as numero, a.id_origem,
           a.status_consolidado, a.nota_final_ajustada, a.pontuacao_escolaridade,
           a.pontuacao_cursos_aperfeicoamento, a.pontuacao_experiencia_profissional,
           a.pontuacao_criterio_etnico, a.data_analise, a.updated_at
      from public."TB_ANALISE_CURRICULAR" a
     where a.ativo and (p_apos is null or a.id > p_apos)
     order by a.id
     limit v_limite
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'area', p.area, 'edital', e.edital_id, 'numero', p.numero,
           'codigo', nullif(btrim(p.id_origem), ''), 'status', p.status_consolidado,
           'nota', p.nota_final_ajustada, 'formacao', p.pontuacao_escolaridade,
           'cursos', p.pontuacao_cursos_aperfeicoamento, 'experiencia', p.pontuacao_experiencia_profissional,
           'etnico', p.pontuacao_criterio_etnico, 'data_analise', p.data_analise,
           'inscricao', (select (min(c."DT_CANDIDATURA") at time zone 'America/Sao_Paulo')::date
                           from public."TB_EMPREGARE_CANDIDATO" c
                          where c."CO_CANDIDATO_EMPREGARE" = nullif(btrim(p.id_origem), '')),
           'atualizado', p.updated_at) order by p.id), '[]'::jsonb),
         max(p.id::text)::uuid, count(*)
    into v_linhas, v_ultimo, v_qt
    from pagina p
    left join private."FC_EDITAIS_POR_NUMERO"() e on e.area = p.area and e.numero = p.numero;

  return jsonb_build_object(
    'schema_version', 1,
    'linhas', v_linhas,
    'proximo', case when v_qt = v_limite then v_ultimo end);
end;
$function$;
comment on function public.conferencia_ler_analises(uuid, integer) is
  'Conferências (job Python): uma página (até 10000, pela ordem do id, depois de p_apos) das análises curriculares ativas, só com id, área, edital, código do candidato, status, notas, datas e a data da candidatura na Empregare. Sem nome nem CPF. proximo = cursor da página seguinte (nulo na última). Só service_role.';

create function public.conferencia_ler_entrevistas()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with entrevistas as (
    select e."CO_ENTREVISTA", e."CO_MONITORAMENTO", e."CO_AREA", e."CO_ANALISE_CURRICULAR",
           e."TP_ORIGEM", e."VL_NOTA_TOTAL", e."ST_COMPARECEU", e."TP_PARECER", e."DT_ATUALIZACAO"
      from public."TB_ENTREVISTA" e
     where coalesce(e."ST_ATIVO", 'S') = 'S'
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
    ),
    'avaliacoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'entrevista', v."CO_ENTREVISTA", 'competencia', v."CO_COMPETENCIA", 'nota', v."VL_NOTA")), '[]'::jsonb)
        from public."TB_ENTREVISTA_AVALIACAO" v
        join entrevistas e on e."CO_ENTREVISTA" = v."CO_ENTREVISTA"
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
  'Conferências (job Python): entrevistas ativas (id, edital, análise, origem, nota, comparecimento), a agenda (data e horário por análise, com o código do candidato), as notas de cada avaliador, a escala de cada roteiro e a lista de convocação vigente (análises) dos editais com convocados pelo sistema. Sem nome nem CPF. Só service_role.';

create function public.conferencia_ler_classificacao()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with ultimas as (
    select distinct on (l."CO_MONITORAMENTO", l."TP_LISTA")
           l."CO_LISTA_CLASSIFICACAO", l."CO_MONITORAMENTO", l."TP_LISTA", l."DT_GERACAO",
           l."QT_PENDENCIA", l."ST_PUBLICADA", l."DS_RESULTADO"
      from public."TB_LISTA_CLASSIFICACAO" l
     order by l."CO_MONITORAMENTO", l."TP_LISTA", l."DT_GERACAO" desc, l."CO_LISTA_CLASSIFICACAO" desc
  ),
  analises as (
    select e.edital_id, max(a.updated_at) as alterada_em
      from public."TB_ANALISE_CURRICULAR" a
      join private."FC_EDITAIS_POR_NUMERO"() e
        on e.area = a."CO_AREA" and e.numero = private."FC_NUMERO_EDITAL"(a.edital)
     where a.ativo
     group by e.edital_id
  ),
  vagas as (
    select distinct e.edital_id, m."CO_AREA" as area, nullif(btrim(a.codigo_vaga), '') as codigo, a.nome_vaga
      from public."TB_ANALISE_CURRICULAR" a
      join private."FC_EDITAIS_POR_NUMERO"() e
        on e.area = a."CO_AREA" and e.numero = private."FC_NUMERO_EDITAL"(a.edital)
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = e.edital_id
     where a.ativo and coalesce(m.ativo, false) and nullif(btrim(a.nome_vaga), '') is not null
  )
  select jsonb_build_object(
    'schema_version', 1,
    'listas', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', u."CO_LISTA_CLASSIFICACAO", 'edital', u."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'tipo', u."TP_LISTA", 'gerada_em', u."DT_GERACAO", 'pendencias', u."QT_PENDENCIA",
          'publicada', u."ST_PUBLICADA" = 'S',
          'vagas_pendentes', (select coalesce(jsonb_agg(distinct p ->> 'vaga'), '[]'::jsonb)
                                from jsonb_array_elements(case when jsonb_typeof(u."DS_RESULTADO" -> 'pendencias') = 'array'
                                                               then u."DS_RESULTADO" -> 'pendencias' else '[]'::jsonb end) p
                               where p ->> 'vaga' is not null))), '[]'::jsonb)
        from ultimas u
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = u."CO_MONITORAMENTO"
    ),
    'analises_alteradas', (
      select coalesce(jsonb_agg(jsonb_build_object('edital', a.edital_id, 'alterada_em', a.alterada_em)), '[]'::jsonb)
        from analises a
    ),
    'vagas_sem_quadro', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'edital', v.edital_id, 'area', v.area, 'vaga', coalesce(v.codigo, 'sem-codigo'))), '[]'::jsonb)
        from vagas v
       where private."FC_QUADRO_DA_VAGA"(v.edital_id, v.nome_vaga) is null
    ),
    'ajustes', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', j."CO_AJUSTE_PONTUACAO", 'edital', j."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'tipo', j."TP_LISTA", 'aprovado_em', j."DT_APROVACAO")), '[]'::jsonb)
        from public."TB_AJUSTE_PONTUACAO_RECURSO" j
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = j."CO_MONITORAMENTO"
       where j."TP_SITUACAO" = 'APROVADO'
    )
  );
$function$;
comment on function public.conferencia_ler_classificacao() is
  'Conferências (job Python): a última lista de cada tipo por edital (data, pendências de desempate e as vagas delas), a última alteração das análises de cada edital, as vagas das análises dos editais ativos sem linha no quadro de vagas (FC_QUADRO_DA_VAGA) e os ajustes de recurso aprovados. Sem dado pessoal. Só service_role.';

create function public.conferencia_ler_aprovados()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with vigentes as (
    select l.id, l.edital_id, l."TP_ORIGEM",
           case when l.edital_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then l.edital_id::uuid end as edital
      from public."TB_LISTA_APROVADO" l
     where l.vigente is true and coalesce(l.ativo, true)
  ),
  candidatos as (
    select c.id, c.lista_id, v.edital, m."CO_AREA" as area, c.status, c."DT_CONVOCACAO",
           encode(sha256(convert_to('conferencia:' || coalesce(
             'cod:' || nullif(btrim(a.id_origem), ''),
             'nome:' || lower(regexp_replace(btrim(c.nome), '\s+', ' ', 'g'))), 'UTF8')), 'hex') as pessoa
      from public."TB_CANDIDATO_APROVADO" c
      join vigentes v on v.id = c.lista_id
      left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v.edital
      left join public."TB_ANALISE_CURRICULAR" a on a.id = c."CO_ANALISE_CURRICULAR"
     where c.removido_em is null and c.status in ('Convocado', 'Contratado')
  ),
  publicacoes as (
    select distinct on (h."CO_LISTA_APROVADO") h."CO_LISTA_APROVADO", h."DS_PENDENCIA"
      from public."TH_PUBLICACAO_APROVADO" h
      join vigentes v on v.id = h."CO_LISTA_APROVADO"
     where v."TP_ORIGEM" = 'CLASSIFICACAO'
     order by h."CO_LISTA_APROVADO", h."DT_PUBLICACAO" desc
  )
  select jsonb_build_object(
    'schema_version', 1,
    'candidatos', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id, 'lista', c.lista_id, 'edital', c.edital, 'area', c.area, 'status', c.status,
          'convocado_em', c."DT_CONVOCACAO", 'pessoa', c.pessoa)), '[]'::jsonb)
        from candidatos c
    ),
    'pendencias', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'lista', p."CO_LISTA_APROVADO", 'edital', v.edital, 'area', m."CO_AREA",
          'candidatos', (
            select coalesce(jsonb_agg(o.id order by o.id), '[]'::jsonb)
              from jsonb_array_elements(p."DS_PENDENCIA") x
              join public."TB_CANDIDATO_APROVADO" o
                on o.id::text = x ->> 'candidato_id'
             where o.removido_em is null
               and (o.status is not null or nullif(btrim(coalesce(o.matricula, '')), '') is not null
                    or nullif(btrim(coalesce(o.processo_sei, '')), '') is not null)
               and not exists (select 1 from public."TB_CANDIDATO_APROVADO" n
                                where n.lista_id = p."CO_LISTA_APROVADO" and n.removido_em is null
                                  and n."CO_CANDIDATO_ANTERIOR" = o.id)))), '[]'::jsonb)
        from publicacoes p
        join vigentes v on v.id = p."CO_LISTA_APROVADO"
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v.edital
    )
  );
$function$;
comment on function public.conferencia_ler_aprovados() is
  'Conferências (job Python): convocados e contratados das listas de aprovados vigentes (id, lista, edital, status, data da convocação e um hash da pessoa — código do candidato ou nome normalizado — para achar a mesma pessoa em duas vagas) e, das listas publicadas pela Classificação, as pendências da publicação ainda sem desfecho (ids). Sem nome nem CPF. Só service_role.';

create function public.conferencia_ler_cargas()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'schema_version', 1,
    'vagas', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'vaga', v."CO_VAGA", 'edital', v."CO_MONITORAMENTO", 'area', m."CO_AREA",
          'situacao', v."TP_SITUACAO", 'ativos', v."QT_CANDIDATO_ATIVO", 'arquivo', v."QT_LINHA_ARQUIVO",
          'novos', (select count(*) from public."TB_EMPREGARE_CANDIDATO" c
                     where c."CO_VAGA" = v."CO_VAGA" and c."ST_REGISTRO_ATIVO" = 'S' and c."DT_CRIACAO" >= s."DT_INICIO"),
          'saidas', (select count(*) from public."TB_EMPREGARE_CANDIDATO" c
                      where c."CO_VAGA" = v."CO_VAGA" and c."DT_DESATIVACAO" >= s."DT_INICIO"),
          'carga_em', coalesce(v."DT_ULTIMA_CARGA", v."DT_ATUALIZACAO"))), '[]'::jsonb)
        from public."TB_EMPREGARE_VAGA" v
        join public."TL_SYNC_EMPREGARE" s on s."CO_SYNC" = v."CO_SYNC"
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = v."CO_MONITORAMENTO"
       where v."DT_ATUALIZACAO" >= now() - interval '30 days'
    )
  );
$function$;
comment on function public.conferencia_ler_cargas() is
  'Conferências (job Python): para cada vaga da Empregare carregada nos últimos 30 dias, a situação da última carga, os candidatos ativos, os do arquivo, os que entraram e os que saíram nela (para achar variação brusca). Sem dado pessoal. Só service_role.';

-- 6. Gravação dos avisos (service_role) -------------------------------------------------
create function public.iniciar_conferencia(p_execucao text, p_disparo text, p_usuario uuid default null, p_url text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_interrompidas integer;
begin
  if p_execucao is null or p_execucao !~ '^[A-Za-z0-9_-]{8,80}$' then
    raise exception 'Identificador de execução inválido' using errcode = '22023';
  end if;
  if p_disparo is null or p_disparo not in ('AGENDA', 'MONITORA', 'GITHUB') then
    raise exception 'Disparo inválido: AGENDA, MONITORA ou GITHUB' using errcode = '22023';
  end if;
  if (p_disparo = 'MONITORA') <> (p_usuario is not null) then
    raise exception 'Usuário só (e sempre) no disparo pelo MONITORA' using errcode = '22023';
  end if;

  -- Execução que morreu sem fechar (o workflow tem tempo limite de 20 min) não segura as próximas.
  update public."TL_CONFERENCIA" set
    "TP_SITUACAO" = 'FALHOU', "DT_FIM" = now(),
    "DS_MENSAGEM" = 'Interrompida: a execução terminou sem fechar.'
   where "TP_SITUACAO" = 'EM_ANDAMENTO' and "DT_INICIO" < now() - interval '1 hour';
  get diagnostics v_interrompidas = row_count;

  if exists (select 1 from public."TL_CONFERENCIA" c where c."TP_SITUACAO" = 'EM_ANDAMENTO') then
    raise exception 'Já há uma execução das conferências em andamento' using errcode = '55P03';
  end if;

  insert into public."TL_CONFERENCIA" ("CO_EXECUCAO", "TP_DISPARO", "CO_USUARIO_DISPARO", "DS_URL_EXECUCAO")
  values (p_execucao, p_disparo, p_usuario, p_url);

  return jsonb_build_object('execucao', p_execucao, 'interrompidas', v_interrompidas);
end;
$function$;
comment on function public.iniciar_conferencia(text, text, uuid, text) is
  'Abre uma execução das conferências em TL_CONFERENCIA (quem disparou e o endereço da execução). Fecha como FALHOU a execução esquecida há mais de 1 h e recusa (55P03) se outra estiver em andamento. Só service_role.';

create function public.gravar_avisos_conferencia(p_execucao text, p_avisos jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_aviso jsonb;
  v_atual public."TB_AVISO_CONFERENCIA";
  v_conferencia text;
  v_escopo text;
  v_gravidade text;
  v_modulo text;
  v_area text;
  v_edital uuid;
  v_qt integer;
  v_exemplos jsonb;
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
      values (v_conferencia, v_escopo, v_gravidade, v_modulo, v_area, v_edital, v_qt, v_exemplos, v_resumo, p_execucao);
      v_novos := v_novos + 1;
    elsif v_atual."TP_SITUACAO" = 'RESOLVIDO'
       or (v_atual."TP_SITUACAO" = 'IGNORADO' and v_qt > v_atual."QT_OCORRENCIA_IGNORADA") then
      update public."TB_AVISO_CONFERENCIA" set
        "TP_GRAVIDADE" = v_gravidade, "CO_MODULO" = v_modulo, "CO_AREA" = v_area, "CO_MONITORAMENTO" = v_edital,
        "QT_OCORRENCIA" = v_qt, "DS_EXEMPLO" = v_exemplos, "DS_RESUMO" = v_resumo, "CO_EXECUCAO" = p_execucao,
        "TP_SITUACAO" = 'ABERTO', "DT_ULTIMA_VEZ" = now(), "DT_RESOLUCAO" = null,
        "DT_PRIMEIRA_VEZ" = case when v_atual."TP_SITUACAO" = 'RESOLVIDO' then now() else "DT_PRIMEIRA_VEZ" end,
        "CO_USUARIO_IGNORADO" = null, "DT_IGNORADO" = null, "DS_MOTIVO_IGNORADO" = null, "QT_OCORRENCIA_IGNORADA" = null
       where "CO_AVISO_CONFERENCIA" = v_atual."CO_AVISO_CONFERENCIA";
      v_reabertos := v_reabertos + 1;
    else
      update public."TB_AVISO_CONFERENCIA" set
        "TP_GRAVIDADE" = v_gravidade, "CO_MODULO" = v_modulo, "CO_AREA" = v_area, "CO_MONITORAMENTO" = v_edital,
        "QT_OCORRENCIA" = v_qt, "DS_EXEMPLO" = v_exemplos, "DS_RESUMO" = v_resumo, "CO_EXECUCAO" = p_execucao,
        "DT_ULTIMA_VEZ" = now()
       where "CO_AVISO_CONFERENCIA" = v_atual."CO_AVISO_CONFERENCIA";
      v_mantidos := v_mantidos + 1;
    end if;
  end loop;

  update public."TL_CONFERENCIA" set "QT_AVISO_NOVO" = "QT_AVISO_NOVO" + v_novos + v_reabertos
   where "CO_EXECUCAO" = p_execucao;
  return jsonb_build_object('novos', v_novos, 'reabertos', v_reabertos, 'mantidos', v_mantidos);
end;
$function$;
comment on function public.gravar_avisos_conferencia(text, jsonb) is
  'Grava até 1000 avisos de uma execução (um por conferência + escopo): novo abre; resolvido reabre; ignorado reabre só se a quantidade passou da ignorada; aberto atualiza quantidade e exemplos. Recusa (22023) exemplo que não seja id ou código (espaço, @, 11 dígitos) e resumo com cara de dado pessoal. Só service_role.';

create function public.finalizar_conferencia(
  p_execucao text, p_conferencias text[], p_falhas text[] default '{}', p_erro text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_mensagem text := nullif(left(btrim(coalesce(p_erro, '')), 2000), '');
  v_conferencias text[] := coalesce(p_conferencias, '{}');
  v_falhas text[] := coalesce(p_falhas, '{}');
  v_resolvidos integer := 0;
  v_abertos integer;
  v_situacao text;
begin
  perform private."FC_EXIGIR_EXECUCAO_CONFERENCIA"(p_execucao);
  if exists (select 1 from unnest(v_conferencias || v_falhas) c where c is null or c !~ '^[A-Z][A-Z0-9_]{2,59}$') then
    raise exception 'Código de conferência inválido' using errcode = '22023';
  end if;
  if v_mensagem is not null and not private."FC_TEXTO_SEGURO_DO_AVISO"(v_mensagem) then
    v_mensagem := 'Erro geral (a mensagem foi omitida por parecer ter dado pessoal).';
  end if;

  -- Só conferência que rodou até o fim resolve: a que falhou deixa os avisos como estavam.
  if v_mensagem is null then
    update public."TB_AVISO_CONFERENCIA" set
      "TP_SITUACAO" = 'RESOLVIDO', "DT_RESOLUCAO" = now(),
      "CO_USUARIO_IGNORADO" = null, "DT_IGNORADO" = null, "DS_MOTIVO_IGNORADO" = null, "QT_OCORRENCIA_IGNORADA" = null
     where "CO_CONFERENCIA" = any (v_conferencias)
       and not ("CO_CONFERENCIA" = any (v_falhas))
       and "TP_SITUACAO" in ('ABERTO', 'IGNORADO')
       and "CO_EXECUCAO" <> p_execucao;
    get diagnostics v_resolvidos = row_count;
  end if;

  select count(*) into v_abertos from public."TB_AVISO_CONFERENCIA" a where a."TP_SITUACAO" = 'ABERTO';
  v_situacao := case
    when v_mensagem is not null then 'FALHOU'
    when cardinality(v_falhas) > 0 then 'PARCIAL'
    else 'CONCLUIDA' end;

  update public."TL_CONFERENCIA" set
    "TP_SITUACAO" = v_situacao, "DT_FIM" = now(),
    "DS_CONFERENCIA" = to_jsonb(v_conferencias), "DS_FALHA" = to_jsonb(v_falhas),
    "QT_AVISO_ABERTO" = v_abertos, "QT_AVISO_RESOLVIDO" = v_resolvidos, "DS_MENSAGEM" = v_mensagem
   where "CO_EXECUCAO" = p_execucao;

  return jsonb_build_object(
    'situacao', v_situacao, 'abertos', v_abertos, 'resolvidos', v_resolvidos,
    'novos', (select c."QT_AVISO_NOVO" from public."TL_CONFERENCIA" c where c."CO_EXECUCAO" = p_execucao));
end;
$function$;
comment on function public.finalizar_conferencia(text, text[], text[], text) is
  'Fecha a execução das conferências: os avisos abertos ou ignorados das conferências que rodaram até o fim e não foram achados de novo viram RESOLVIDO; com p_erro, nada é resolvido e a execução FALHOU; com falhas, PARCIAL. Só service_role.';

revoke all on function public.conferencia_ler_contexto() from public, anon, authenticated;
revoke all on function public.conferencia_ler_analises(uuid, integer) from public, anon, authenticated;
revoke all on function public.conferencia_ler_entrevistas() from public, anon, authenticated;
revoke all on function public.conferencia_ler_classificacao() from public, anon, authenticated;
revoke all on function public.conferencia_ler_aprovados() from public, anon, authenticated;
revoke all on function public.conferencia_ler_cargas() from public, anon, authenticated;
revoke all on function public.iniciar_conferencia(text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.gravar_avisos_conferencia(text, jsonb) from public, anon, authenticated;
revoke all on function public.finalizar_conferencia(text, text[], text[], text) from public, anon, authenticated;
grant execute on function public.conferencia_ler_contexto() to service_role;
grant execute on function public.conferencia_ler_analises(uuid, integer) to service_role;
grant execute on function public.conferencia_ler_entrevistas() to service_role;
grant execute on function public.conferencia_ler_classificacao() to service_role;
grant execute on function public.conferencia_ler_aprovados() to service_role;
grant execute on function public.conferencia_ler_cargas() to service_role;
grant execute on function public.iniciar_conferencia(text, text, uuid, text) to service_role;
grant execute on function public.gravar_avisos_conferencia(text, jsonb) to service_role;
grant execute on function public.finalizar_conferencia(text, text[], text[], text) to service_role;

-- 7. Leitura e ação na tela (authenticated) ---------------------------------------------
create function public.listar_avisos_conferencia(p_area text default null, p_modulo text default null)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := nullif(lower(btrim(coalesce(p_area, ''))), '');
  v_modulo text := nullif(lower(btrim(coalesce(p_modulo, ''))), '');
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

  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'ultima_execucao', (
      select json_build_object('inicio', c."DT_INICIO", 'fim', c."DT_FIM", 'situacao', c."TP_SITUACAO")
        from public."TL_CONFERENCIA" c
       where c."TP_SITUACAO" <> 'EM_ANDAMENTO'
       order by c."DT_INICIO" desc
       limit 1
    ),
    'avisos', (
      select coalesce(json_agg(json_build_object(
          'id', a."CO_AVISO_CONFERENCIA",
          'conferencia', a."CO_CONFERENCIA",
          'escopo', a."DS_ESCOPO",
          'gravidade', a."TP_GRAVIDADE",
          'modulo', a."CO_MODULO",
          'area', a."CO_AREA",
          'edital_id', a."CO_MONITORAMENTO",
          'edital', m.edital,
          'quantidade', a."QT_OCORRENCIA",
          'exemplos', a."DS_EXEMPLO",
          'resumo', a."DS_RESUMO",
          'situacao', a."TP_SITUACAO",
          'primeira_vez', a."DT_PRIMEIRA_VEZ",
          'ultima_vez', a."DT_ULTIMA_VEZ",
          'ignorado_em', a."DT_IGNORADO",
          'motivo', a."DS_MOTIVO_IGNORADO",
          'pode_ignorar', a."TP_SITUACAO" = 'ABERTO'
                          and private."FC_PODE_IGNORAR_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO")
        ) order by case a."TP_SITUACAO" when 'ABERTO' then 0 else 1 end,
                   case a."TP_GRAVIDADE" when 'CRITICA' then 0 when 'ATENCAO' then 1 else 2 end,
                   a."DT_PRIMEIRA_VEZ"), '[]'::json)
        from public."TB_AVISO_CONFERENCIA" a
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = a."CO_MONITORAMENTO"
       where a."TP_SITUACAO" in ('ABERTO', 'IGNORADO')
         and (v_area is null or a."CO_AREA" = v_area)
         and (v_modulo is null or a."CO_MODULO" = v_modulo)
         and private."FC_PODE_VER_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO")
    )
  );
end;
$function$;
comment on function public.listar_avisos_conferencia(text, text) is
  'Avisos de conferência abertos e ignorados (json) que quem chama pode ver: o módulo (leitor), a área e o edital no recorte; cargas e avisos sem área, só o administrador global. Filtra por área e módulo (opcionais). pode_ignorar diz se a pessoa pode ignorar cada aviso aberto.';
revoke all on function public.listar_avisos_conferencia(text, text) from public, anon;
grant execute on function public.listar_avisos_conferencia(text, text) to authenticated;

create function public.ignorar_aviso_conferencia(p_id uuid, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_aviso public."TB_AVISO_CONFERENCIA";
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  if length(v_motivo) not between 10 and 500 then
    raise exception 'Escreva o motivo (10 a 500 caracteres)' using errcode = '22023';
  end if;
  select * into v_aviso from public."TB_AVISO_CONFERENCIA" a where a."CO_AVISO_CONFERENCIA" = p_id for update;
  if v_aviso."CO_AVISO_CONFERENCIA" is null
     or not private."FC_PODE_VER_AVISO"(v_aviso."CO_MODULO", v_aviso."CO_AREA", v_aviso."CO_MONITORAMENTO") then
    raise exception 'Aviso não encontrado' using errcode = '22023';
  end if;
  if not private."FC_PODE_IGNORAR_AVISO"(v_aviso."CO_MODULO", v_aviso."CO_AREA", v_aviso."CO_MONITORAMENTO") then
    raise exception 'Só o gestor do módulo ou o administrador global ignora avisos' using errcode = '42501';
  end if;
  if v_aviso."TP_SITUACAO" <> 'ABERTO' then
    raise exception 'Só aviso aberto pode ser ignorado' using errcode = '22023';
  end if;

  update public."TB_AVISO_CONFERENCIA" set
    "TP_SITUACAO" = 'IGNORADO', "CO_USUARIO_IGNORADO" = auth.uid(), "DT_IGNORADO" = now(),
    "DS_MOTIVO_IGNORADO" = v_motivo, "QT_OCORRENCIA_IGNORADA" = "QT_OCORRENCIA"
   where "CO_AVISO_CONFERENCIA" = p_id;

  return json_build_object('id', p_id, 'situacao', 'IGNORADO', 'ignorado_em', now());
end;
$function$;
comment on function public.ignorar_aviso_conferencia(uuid, text) is
  'Ignora um aviso de conferência aberto, com motivo (10 a 500 caracteres): administrador global ou quem vê o aviso e administra o módulo (classificação: editor). O aviso volta a ABERTO se a quantidade crescer.';
revoke all on function public.ignorar_aviso_conferencia(uuid, text) from public, anon;
grant execute on function public.ignorar_aviso_conferencia(uuid, text) to authenticated;

-- 8. Status das atualizações ganha as conferências ---------------------------------------
create or replace function public.get_saude_das_cargas()
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_tarefas json;
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global vê a saúde das cargas' using errcode = '42501';
  end if;

  -- pg_cron pode não estar acessível: a seção mostra "indisponível" nessa parte.
  begin
    select coalesce(json_agg(json_build_object(
        'nome', j.jobname,
        'agenda', j.schedule,
        'ativa', j.active,
        'execucoes', (
          select coalesce(json_agg(json_build_object(
              'inicio', d.start_time,
              'fim', d.end_time,
              'situacao', d.status,
              'mensagem', left(d.return_message, 500)
            ) order by d.start_time desc), '[]'::json)
            from (select * from cron.job_run_details r
                   where r.jobid = j.jobid
                   order by r.start_time desc limit 10) d
        )
      ) order by j.jobname), '[]'::json)
      into v_tarefas
      from cron.job j
     where left(j.jobname, 6) = 'agsus_';
  exception when others then
    v_tarefas := null;
  end;

  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'analises', (
      select coalesce(json_agg(json_build_object(
          'origem', o."CO_ORIGEM",
          'area', p."CO_AREA",
          'planilha', p."NO_PLANILHA",
          'tipo', o."TP_CARGA",
          'execucoes', (
            select coalesce(json_agg(json_build_object(
                'inicio', x.j ->> 'started_at',
                'fim', x.j ->> 'finished_at',
                'situacao', x.j ->> 'status',
                'linhas', coalesce(x.j ->> 'total_processados', x.j ->> 'total_lidos', x.j ->> 'linhas_staging'),
                'mensagem', left(coalesce(x.j ->> 'erro', x.j ->> 'mensagem'), 500)
              ) order by x.inicio desc nulls last), '[]'::json)
              from (select to_jsonb(s) as j, s.started_at as inicio
                      from public."TL_SYNC_ANALISE" s
                     where s.origem = o."CO_ORIGEM"
                     order by s.started_at desc nulls last
                     limit 10) x
          )
        ) order by p."CO_AREA", o."TP_CARGA" desc), '[]'::json)
        from public."TA_ORIGEM_ANALISE" o
        join public."TB_PLANILHA_ANALISE" p on p."CO_PLANILHA" = o."CO_PLANILHA"
    ),
    'entrevistas', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'area', e."CO_AREA"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_ENTREVISTA" t order by t."DT_INICIO" desc limit 10) e
    ),
    'selecao', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_SELECAO" t order by t."DT_INICIO" desc limit 10) e
    ),
    'empregare', (
      select coalesce(json_agg(json_build_object(
          'inicio', e."DT_INICIO",
          'fim', e."DT_FIM",
          'situacao', e."TP_SITUACAO",
          'linhas', e."QT_LINHA",
          'mensagem', e."DS_MENSAGEM",
          'disparo', e."TP_DISPARO",
          'vagas_pedidas', e."QT_VAGA_PEDIDA",
          'vagas_baixadas', e."QT_VAGA_BAIXADA",
          'vagas_falha', e."QT_VAGA_FALHA",
          'vagas_recusadas', e."QT_VAGA_RECUSADA",
          'desativadas', e."QT_DESATIVADA",
          'execucao', e."DS_URL_EXECUCAO"
        ) order by e."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_SYNC_EMPREGARE" t order by t."DT_INICIO" desc limit 10) e
    ),
    'conferencias', (
      select coalesce(json_agg(json_build_object(
          'inicio', c."DT_INICIO",
          'fim', c."DT_FIM",
          'situacao', c."TP_SITUACAO",
          'linhas', c."QT_AVISO_ABERTO",
          'mensagem', c."DS_MENSAGEM",
          'disparo', c."TP_DISPARO",
          'novos', c."QT_AVISO_NOVO",
          'abertos', c."QT_AVISO_ABERTO",
          'resolvidos', c."QT_AVISO_RESOLVIDO",
          'falhas', c."DS_FALHA",
          'execucao', c."DS_URL_EXECUCAO"
        ) order by c."DT_INICIO" desc), '[]'::json)
        from (select * from public."TL_CONFERENCIA" t order by t."DT_INICIO" desc limit 10) c
    ),
    'tarefas', v_tarefas
  );
end;
$function$;
comment on function public.get_saude_das_cargas() is
  'Saúde das cargas (Configurações, só administrador global): as últimas 10 execuções de cada carga das análises (por origem), das entrevistas, da seleção, do robô da Empregare (com vagas pedidas/baixadas/falhas/recusadas e quem disparou), das conferências de consistência (avisos novos, abertos e resolvidos) e das tarefas agsus_* do pg_cron (nulas sem acesso ao pg_cron). Só leitura.';
-- ═══ CORPO DA MIGRATION (fim) ═══

-- ENSAIO (tudo abaixo corre na mesma transação e é desfeito no rollback final)

-- E1. Tabelas com RLS e sem acesso direto; job só service_role; tela só authenticated.
do $$
declare
  v_tabela text;
  v_funcao text;
begin
  foreach v_tabela in array array['TL_CONFERENCIA', 'TB_AVISO_CONFERENCIA'] loop
    if not (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = v_tabela) then
      raise exception 'FALHOU E1: % sem RLS', v_tabela;
    end if;
    if has_table_privilege('authenticated', format('public.%I', v_tabela), 'SELECT')
       or has_table_privilege('anon', format('public.%I', v_tabela), 'SELECT') then
      raise exception 'FALHOU E1: acesso direto a %', v_tabela;
    end if;
  end loop;
  foreach v_funcao in array array[
    'public.conferencia_ler_contexto()',
    'public.conferencia_ler_analises(uuid, integer)',
    'public.conferencia_ler_entrevistas()',
    'public.conferencia_ler_classificacao()',
    'public.conferencia_ler_aprovados()',
    'public.conferencia_ler_cargas()',
    'public.iniciar_conferencia(text, text, uuid, text)',
    'public.gravar_avisos_conferencia(text, jsonb)',
    'public.finalizar_conferencia(text, text[], text[], text)'] loop
    if has_function_privilege('authenticated', v_funcao, 'EXECUTE') or has_function_privilege('anon', v_funcao, 'EXECUTE') then
      raise exception 'FALHOU E1: % executável fora do service_role', v_funcao;
    end if;
    if not has_function_privilege('service_role', v_funcao, 'EXECUTE') then
      raise exception 'FALHOU E1: service_role sem %', v_funcao;
    end if;
  end loop;
  foreach v_funcao in array array[
    'public.listar_avisos_conferencia(text, text)',
    'public.ignorar_aviso_conferencia(uuid, text)'] loop
    if has_function_privilege('anon', v_funcao, 'EXECUTE') or not has_function_privilege('authenticated', v_funcao, 'EXECUTE') then
      raise exception 'FALHOU E1: permissão de %', v_funcao;
    end if;
  end loop;
  raise notice 'ok E1: duas tabelas com RLS e sem grant; job só service_role; tela só authenticated';
end;
$$;

-- Um edital real com área (só para ligar os avisos sintéticos; nada dele muda).
select set_config('ensaio.edital', (select m.id::text from public."TB_MONITORAMENTO_INDIGENA" m
                                     where m."CO_AREA" is not null order by m.id limit 1), true),
       set_config('ensaio.area', (select m."CO_AREA" from public."TB_MONITORAMENTO_INDIGENA" m
                                   where m."CO_AREA" is not null order by m.id limit 1), true);

-- E2. O job (papel service_role): leituras nos dados reais e três execuções com avisos sintéticos.
set local role service_role;
do $$
declare
  c_edital constant text := current_setting('ensaio.edital');
  c_area constant text := current_setting('ensaio.area');
  v jsonb;
  v_aviso_analise jsonb;
  v_aviso_carga jsonb;
begin
  if c_edital is null or c_edital = '' then
    raise exception 'FALHOU E2: o banco não tem edital com área para o ensaio';
  end if;

  -- As leituras do job rodam nos dados de verdade e devolvem o formato esperado.
  v := public.conferencia_ler_contexto();
  if jsonb_typeof(v -> 'editais') <> 'array' or jsonb_typeof(v -> 'regras') <> 'array' or v ->> 'hoje' is null then
    raise exception 'FALHOU E2: contexto %', left(v::text, 300);
  end if;
  v := public.conferencia_ler_analises(null, 50);
  if jsonb_typeof(v -> 'linhas') <> 'array' or jsonb_array_length(v -> 'linhas') > 50 then
    raise exception 'FALHOU E2: página de análises';
  end if;
  if v ->> 'proximo' is not null then
    v := public.conferencia_ler_analises((v ->> 'proximo')::uuid, 50);
    if jsonb_typeof(v -> 'linhas') <> 'array' then raise exception 'FALHOU E2: segunda página'; end if;
  end if;
  if exists (select 1 from jsonb_array_elements(v -> 'linhas') l where l ? 'nome' or l ? 'cpf' or l ? 'candidato') then
    raise exception 'FALHOU E2: a página de análises trouxe dado pessoal';
  end if;
  v := public.conferencia_ler_entrevistas();
  if not (v ?& array['entrevistas', 'agenda', 'avaliacoes', 'competencias', 'roteiros', 'convocacao']) then
    raise exception 'FALHOU E2: entrevistas %', left(v::text, 300);
  end if;
  v := public.conferencia_ler_classificacao();
  if not (v ?& array['listas', 'analises_alteradas', 'vagas_sem_quadro', 'ajustes']) then
    raise exception 'FALHOU E2: classificação %', left(v::text, 300);
  end if;
  v := public.conferencia_ler_aprovados();
  if not (v ?& array['candidatos', 'pendencias'])
     or exists (select 1 from jsonb_array_elements(v -> 'candidatos') c where c ? 'nome' or c ->> 'pessoa' !~ '^[0-9a-f]{64}$') then
    raise exception 'FALHOU E2: aprovados (sem nome, pessoa em hash)';
  end if;
  v := public.conferencia_ler_cargas();
  if jsonb_typeof(v -> 'vagas') <> 'array' then raise exception 'FALHOU E2: cargas'; end if;

  v_aviso_analise := jsonb_build_object(
    'conferencia', 'ENSAIO_ANALISE', 'escopo', 'edital:' || c_edital, 'gravidade', 'CRITICA',
    'modulo', 'analises', 'area', c_area, 'edital', c_edital, 'quantidade', 3,
    'exemplos', jsonb_build_array('00000000-0000-4000-a000-00000000c001', '177979'),
    'resumo', '3 análises do ensaio (edital 1/2026)');
  v_aviso_carga := jsonb_build_object(
    'conferencia', 'ENSAIO_CARGA', 'escopo', 'vaga:999999001', 'gravidade', 'ATENCAO',
    'modulo', 'cargas', 'quantidade', 1, 'exemplos', jsonb_build_array('999999001'),
    'resumo', 'Vaga 999999001 do ensaio');

  -- Execução 1: dois avisos novos.
  perform public.iniciar_conferencia('ensaio-conf-0001', 'GITHUB');
  begin
    perform public.iniciar_conferencia('ensaio-conf-0099', 'GITHUB');
    raise exception 'FALHOU E2: duas execuções ao mesmo tempo';
  exception when lock_not_available then null;
  end;
  v := public.gravar_avisos_conferencia('ensaio-conf-0001', jsonb_build_array(v_aviso_analise, v_aviso_carga));
  if (v ->> 'novos')::int <> 2 then raise exception 'FALHOU E2: novos %', v; end if;
  v := public.finalizar_conferencia('ensaio-conf-0001', array['ENSAIO_ANALISE', 'ENSAIO_CARGA']);
  if v ->> 'situacao' <> 'CONCLUIDA' or (v ->> 'novos')::int <> 2 then raise exception 'FALHOU E2: execução 1 %', v; end if;

  -- Execução 2: o banco recusa dado pessoal; a carga some e é resolvida.
  perform public.iniciar_conferencia('ensaio-conf-0002', 'AGENDA');
  begin
    perform public.gravar_avisos_conferencia('ensaio-conf-0002',
      jsonb_build_array(v_aviso_analise || jsonb_build_object('exemplos', jsonb_build_array('Pessoa Fictícia'))));
    raise exception 'FALHOU E2: aceitou nome nos exemplos';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.gravar_avisos_conferencia('ensaio-conf-0002',
      jsonb_build_array(v_aviso_analise || jsonb_build_object('exemplos', jsonb_build_array('00000000191'))));
    raise exception 'FALHOU E2: aceitou CPF nos exemplos';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.gravar_avisos_conferencia('ensaio-conf-0002',
      jsonb_build_array(v_aviso_analise || jsonb_build_object('resumo', 'contato pessoa@exemplo.invalid')));
    raise exception 'FALHOU E2: aceitou e-mail no resumo';
  exception when invalid_parameter_value then null;
  end;
  v := public.gravar_avisos_conferencia('ensaio-conf-0002', jsonb_build_array(v_aviso_analise));
  if (v ->> 'mantidos')::int <> 1 then raise exception 'FALHOU E2: mantido %', v; end if;
  v := public.finalizar_conferencia('ensaio-conf-0002', array['ENSAIO_ANALISE', 'ENSAIO_CARGA']);
  if (v ->> 'resolvidos')::int <> 1 then raise exception 'FALHOU E2: execução 2 devia resolver a carga %', v; end if;

  -- Execução 3: a carga volta (reabre); a conferência das análises falha e não resolve nada.
  perform public.iniciar_conferencia('ensaio-conf-0003', 'MONITORA', '00000000-0000-4000-a000-00000000c201');
  v := public.gravar_avisos_conferencia('ensaio-conf-0003', jsonb_build_array(v_aviso_carga));
  if (v ->> 'reabertos')::int <> 1 then raise exception 'FALHOU E2: reabertura %', v; end if;
  v := public.finalizar_conferencia('ensaio-conf-0003', array['ENSAIO_CARGA'], array['ENSAIO_ANALISE']);
  if v ->> 'situacao' <> 'PARCIAL' or (v ->> 'resolvidos')::int <> 0 then raise exception 'FALHOU E2: execução 3 %', v; end if;

  raise notice 'ok E2: leituras do job nos dados reais; abrir, manter, resolver, reabrir; dado pessoal recusado';
end;
$$;
reset role;

-- E3. Atores sintéticos (somem no rollback): leitor e gestor das análises na área do edital,
-- uma pessoa sem área e o administrador global (grupo 'admin', o único admin global).
do $$
declare
  c_area constant text := current_setting('ensaio.area');
begin
  insert into public."TB_GRUPO_ACESSO" ("CO_GRUPO_ACESSO", "NO_GRUPO_ACESSO", "DS_GRUPO_ACESSO", "ST_SISTEMA", "ST_ADMIN_GLOBAL", "NU_ORDEM")
  values ('ensaio_conf_leitor', 'Ensaio conferências (leitor)', 'Grupo do ensaio: análises leitor.', false, false, 996),
         ('ensaio_conf_gestor', 'Ensaio conferências (gestor)', 'Grupo do ensaio: análises admin.', false, false, 997);
  insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL")
  values ('ensaio_conf_leitor', 'analises', 'leitor'), ('ensaio_conf_gestor', 'analises', 'admin')
  on conflict ("CO_GRUPO_ACESSO", "NO_RECURSO") do update set "TP_NIVEL" = excluded."TP_NIVEL";

  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-00000000c201', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.conf.admin@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000c202', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.conf.leitor@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000c203', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.conf.gestor@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000c204', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.conf.semarea@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-00000000c201', 'ensaio.conf.admin@ensaio.invalid', 'Ensaio Admin', 'admin', true),
    ('00000000-0000-4000-a000-00000000c202', 'ensaio.conf.leitor@ensaio.invalid', 'Ensaio Leitor', 'ensaio_conf_leitor', true),
    ('00000000-0000-4000-a000-00000000c203', 'ensaio.conf.gestor@ensaio.invalid', 'Ensaio Gestor', 'ensaio_conf_gestor', true),
    ('00000000-0000-4000-a000-00000000c204', 'ensaio.conf.semarea@ensaio.invalid', 'Ensaio Sem Área', 'ensaio_conf_gestor', true);
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select p.id, c_area from public."TB_PERFIL_USUARIO" p
   where p.user_id in ('00000000-0000-4000-a000-00000000c202', '00000000-0000-4000-a000-00000000c203');
  raise notice 'ok E3: atores criados';
end;
$$;

-- E4. A tela, como cada pessoa (papel authenticated). Contagens pela RPC: a RLS esconde as tabelas.
set local role authenticated;
do $$
declare
  c_area constant text := current_setting('ensaio.area');
  c_admin constant text := '{"sub":"00000000-0000-4000-a000-00000000c201","role":"authenticated"}';
  c_leitor constant text := '{"sub":"00000000-0000-4000-a000-00000000c202","role":"authenticated"}';
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-00000000c203","role":"authenticated"}';
  c_semarea constant text := '{"sub":"00000000-0000-4000-a000-00000000c204","role":"authenticated"}';
  v json;
  v_id uuid;
begin
  perform set_config('request.jwt.claims', c_leitor, true);
  v := public.listar_avisos_conferencia(c_area, 'analises');
  if (select count(*) from json_array_elements(v -> 'avisos') a where a ->> 'conferencia' = 'ENSAIO_ANALISE') <> 1 then
    raise exception 'FALHOU E4: o leitor não vê o aviso das análises';
  end if;
  select (a ->> 'id')::uuid into v_id from json_array_elements(v -> 'avisos') a where a ->> 'conferencia' = 'ENSAIO_ANALISE';
  if (select (a ->> 'pode_ignorar')::boolean from json_array_elements(v -> 'avisos') a where a ->> 'conferencia' = 'ENSAIO_ANALISE') then
    raise exception 'FALHOU E4: leitor pode ignorar';
  end if;
  if (select count(*) from json_array_elements(public.listar_avisos_conferencia(null, null) -> 'avisos') a
       where a ->> 'conferencia' = 'ENSAIO_CARGA') <> 0 then
    raise exception 'FALHOU E4: o leitor vê aviso de carga (só o administrador global)';
  end if;
  begin
    perform public.ignorar_aviso_conferencia(v_id, 'Motivo do ensaio, leitor.');
    raise exception 'FALHOU E4: leitor ignorou';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', c_semarea, true);
  if (select count(*) from json_array_elements(public.listar_avisos_conferencia(null, null) -> 'avisos') a
       where a ->> 'conferencia' like 'ENSAIO_%') <> 0 then
    raise exception 'FALHOU E4: quem não tem a área viu avisos dela';
  end if;

  perform set_config('request.jwt.claims', c_gestor, true);
  begin
    perform public.ignorar_aviso_conferencia(v_id, 'curto');
    raise exception 'FALHOU E4: aceitou motivo curto';
  exception when invalid_parameter_value then null;
  end;
  v := public.ignorar_aviso_conferencia(v_id, 'Conferido com a banca: nota revista no recurso.');
  if v ->> 'situacao' <> 'IGNORADO' then raise exception 'FALHOU E4: gestor não ignorou %', v; end if;

  perform set_config('request.jwt.claims', c_admin, true);
  v := public.listar_avisos_conferencia(null, null);
  if (select count(*) from json_array_elements(v -> 'avisos') a where a ->> 'conferencia' like 'ENSAIO_%') <> 2
     or (select a ->> 'situacao' from json_array_elements(v -> 'avisos') a where a ->> 'conferencia' = 'ENSAIO_ANALISE') <> 'IGNORADO'
     or (select a ->> 'motivo' from json_array_elements(v -> 'avisos') a where a ->> 'conferencia' = 'ENSAIO_ANALISE') is null then
    raise exception 'FALHOU E4: o administrador global devia ver os dois avisos (um ignorado, com motivo)';
  end if;
  if json_array_length(public.get_saude_das_cargas() -> 'conferencias') < 3 then
    raise exception 'FALHOU E4: Status das atualizações sem as conferências';
  end if;
  raise notice 'ok E4: leitor vê e não ignora; sem área não vê; gestor ignora com motivo; admin vê tudo e o status';
end;
$$;
reset role;
select set_config('request.jwt.claims', '', true);

-- E5. O ignorado volta a aberto quando a quantidade cresce (papel service_role).
set local role service_role;
do $$
declare
  c_edital constant text := current_setting('ensaio.edital');
  c_area constant text := current_setting('ensaio.area');
  v jsonb;
  v_aviso jsonb := jsonb_build_object(
    'conferencia', 'ENSAIO_ANALISE', 'escopo', 'edital:' || c_edital, 'gravidade', 'CRITICA',
    'modulo', 'analises', 'area', c_area, 'edital', c_edital, 'quantidade', 3,
    'exemplos', '[]'::jsonb, 'resumo', '3 análises do ensaio');
begin
  perform public.iniciar_conferencia('ensaio-conf-0004', 'GITHUB');
  v := public.gravar_avisos_conferencia('ensaio-conf-0004', jsonb_build_array(v_aviso));
  if (v ->> 'mantidos')::int <> 1 then raise exception 'FALHOU E5: o ignorado com a mesma quantidade devia ficar ignorado %', v; end if;
  v := public.gravar_avisos_conferencia('ensaio-conf-0004',
         jsonb_build_array(v_aviso || jsonb_build_object('quantidade', 5, 'resumo', '5 análises do ensaio')));
  if (v ->> 'reabertos')::int <> 1 then raise exception 'FALHOU E5: o ignorado devia reabrir com 5 %', v; end if;
  perform public.finalizar_conferencia('ensaio-conf-0004', array['ENSAIO_ANALISE', 'ENSAIO_CARGA']);
  raise notice 'ok E5: ignorado fica com a mesma quantidade e reabre quando cresce';
end;
$$;

-- Volta ao papel do SQL Editor antes de ler as tabelas sem grant.
reset role;

-- E6. O que ficou nas tabelas.
do $$
begin
  if (select "TP_SITUACAO" || ':' || "QT_OCORRENCIA" from public."TB_AVISO_CONFERENCIA" where "CO_CONFERENCIA" = 'ENSAIO_ANALISE') <> 'ABERTO:5'
     or exists (select 1 from public."TB_AVISO_CONFERENCIA" where "CO_CONFERENCIA" = 'ENSAIO_ANALISE'
                 and ("CO_USUARIO_IGNORADO" is not null or "DS_MOTIVO_IGNORADO" is not null)) then
    raise exception 'FALHOU E6: aviso das análises devia estar ABERTO com 5, sem o ignorado';
  end if;
  if (select "TP_SITUACAO" from public."TB_AVISO_CONFERENCIA" where "CO_CONFERENCIA" = 'ENSAIO_CARGA') <> 'RESOLVIDO' then
    raise exception 'FALHOU E6: a carga devia estar resolvida (a execução 4 não a achou)';
  end if;
  if (select string_agg("TP_SITUACAO", ',' order by "CO_EXECUCAO") from public."TL_CONFERENCIA"
       where "CO_EXECUCAO" like 'ensaio-conf-%') <> 'CONCLUIDA,CONCLUIDA,PARCIAL,CONCLUIDA' then
    raise exception 'FALHOU E6: situações das execuções';
  end if;
  if (select "QT_AVISO_NOVO" from public."TL_CONFERENCIA" where "CO_EXECUCAO" = 'ensaio-conf-0001') <> 2
     or (select "QT_AVISO_RESOLVIDO" from public."TL_CONFERENCIA" where "CO_EXECUCAO" = 'ensaio-conf-0002') <> 1
     or (select "CO_USUARIO_DISPARO" from public."TL_CONFERENCIA" where "CO_EXECUCAO" = 'ensaio-conf-0003')
        <> '00000000-0000-4000-a000-00000000c201'
     or (select "DS_FALHA" from public."TL_CONFERENCIA" where "CO_EXECUCAO" = 'ensaio-conf-0003') <> '["ENSAIO_ANALISE"]'::jsonb then
    raise exception 'FALHOU E6: contagens e falhas do log';
  end if;
  raise notice 'ok E6: avisos e log como esperado';
end;
$$;

-- Resumo (o que o ensaio gravou, antes do rollback).
select
  'ENSAIO OK' as resultado,
  (select count(*) from public."TL_CONFERENCIA" where "CO_EXECUCAO" like 'ensaio-conf-%') as execucoes,
  (select count(*) from public."TB_AVISO_CONFERENCIA" where "CO_CONFERENCIA" like 'ENSAIO_%') as avisos;

rollback;
