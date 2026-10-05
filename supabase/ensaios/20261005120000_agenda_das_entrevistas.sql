/*
  ENSAIO de 20261005120000_agenda_das_entrevistas.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela), confere RLS e validação da regra e
  percorre o fluxo com três pessoas sintéticas — gestor (edital_gestor, com a
  área), leitor (usuario, com a área) e outro (usuario, sem área) — num edital
  real com três análises ativas: regra em duas versões, agenda gerada,
  conflitos recusados, ajuste manual com histórico — e termina em ROLLBACK:
  nada fica gravado.

  Resultado esperado: as mensagens "ok E1" … "ok E6" e a linha "ENSAIO OK" do
  SELECT final. Qualquer "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/agenda-das-entrevistas-migration.test.js confere
  que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══
-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_LISTA_CLASSIFICACAO"') is null then
    raise exception 'Aplique antes 20261002150000_classificacao.sql.';
  end if;
  if to_regclass('public."TB_ENTREVISTA_AVALIADOR"') is null then
    raise exception 'Aplique antes 20260930220000_entrevistas_roteiros_e_notas.sql.';
  end if;
end;
$$;

-- 1. Regra da agenda por edital e versões ---------------------------------------------------
create table public."TB_REGRA_AGENDA_ENTREVISTA" (
  "CO_REGRA_AGENDA" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "NU_VERSAO_VIGENTE" integer not null,
  "CO_USUARIO_ATUALIZACAO" uuid,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_REGRA_AGENDA_ENTREVISTA" primary key ("CO_REGRA_AGENDA"),
  constraint "UK_REGRAAGENDA_COMONITOR" unique ("CO_MONITORAMENTO"),
  constraint "FK_MONITORAMENTO_REGRAAGENDA" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "CK_REGRAAGENDA_NUVERSAO" check ("NU_VERSAO_VIGENTE" >= 1)
);
comment on table public."TB_REGRA_AGENDA_ENTREVISTA" is
  'Regra da agenda das entrevistas de um edital (uma por edital), escolhida pelo gestor. A configuração fica em cada versão (TH_REGRA_AGENDA_ENTREVISTA); aqui, a versão vigente.';
comment on column public."TB_REGRA_AGENDA_ENTREVISTA"."CO_REGRA_AGENDA" is 'Identificador da regra da agenda.';
comment on column public."TB_REGRA_AGENDA_ENTREVISTA"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TB_REGRA_AGENDA_ENTREVISTA"."NU_VERSAO_VIGENTE" is 'Versão vigente (TH_REGRA_AGENDA_ENTREVISTA.NU_VERSAO). Salvar cria a próxima.';
comment on column public."TB_REGRA_AGENDA_ENTREVISTA"."CO_USUARIO_ATUALIZACAO" is 'Quem salvou a versão vigente (auth.users.id).';
comment on column public."TB_REGRA_AGENDA_ENTREVISTA"."DT_CRIACAO" is 'Primeira versão.';
comment on column public."TB_REGRA_AGENDA_ENTREVISTA"."DT_ATUALIZACAO" is 'Última versão salva.';
comment on constraint "UK_REGRAAGENDA_COMONITOR" on public."TB_REGRA_AGENDA_ENTREVISTA" is 'Uma regra de agenda por edital.';
comment on constraint "FK_MONITORAMENTO_REGRAAGENDA" on public."TB_REGRA_AGENDA_ENTREVISTA" is 'Edital da regra.';
comment on constraint "CK_REGRAAGENDA_NUVERSAO" on public."TB_REGRA_AGENDA_ENTREVISTA" is 'Versões começam em 1.';

create table public."TH_REGRA_AGENDA_ENTREVISTA" (
  "CO_REGRA_AGENDA" uuid not null,
  "NU_VERSAO" integer not null,
  "DS_CONFIGURACAO" jsonb not null,
  "DS_MOTIVO" varchar(500),
  "CO_USUARIO" uuid,
  "DT_CRIACAO" timestamptz not null default now(),
  constraint "PK_TH_REGRA_AGENDA_ENTREVISTA" primary key ("CO_REGRA_AGENDA", "NU_VERSAO"),
  constraint "FK_REGRAAGENDA_HISTREGRAAGENDA" foreign key ("CO_REGRA_AGENDA") references public."TB_REGRA_AGENDA_ENTREVISTA" ("CO_REGRA_AGENDA"),
  constraint "CK_HISTREGRAAGENDA_NUVERSAO" check ("NU_VERSAO" >= 1),
  constraint "CK_HISTREGRAAGENDA_CONFIG" check (jsonb_typeof("DS_CONFIGURACAO") = 'object'),
  constraint "CK_HISTREGRAAGENDA_MOTIVO" check ("DS_MOTIVO" is null or length("DS_MOTIVO") between 3 and 500)
);
comment on table public."TH_REGRA_AGENDA_ENTREVISTA" is
  'Versões da regra da agenda das entrevistas de um edital. Cada alteração cria uma linha (nada é sobrescrito); a gravação da agenda guarda a versão usada.';
comment on column public."TH_REGRA_AGENDA_ENTREVISTA"."CO_REGRA_AGENDA" is 'Regra (TB_REGRA_AGENDA_ENTREVISTA).';
comment on column public."TH_REGRA_AGENDA_ENTREVISTA"."NU_VERSAO" is 'Número da versão (1, 2, 3…).';
comment on column public."TH_REGRA_AGENDA_ENTREVISTA"."DS_CONFIGURACAO" is 'Configuração inteira da regra: datas (intervalo com dias úteis ou lista; dias excluídos), períodos do dia, duração e intervalo (minutos), pausa, bancas e nomes, ordem, agrupar por cargo, reservar o primeiro horário, fuso (formato de normalizarRegraDaAgenda em src/lib/agenda-das-entrevistas.js; validada por FC_VALIDAR_REGRA_AGENDA).';
comment on column public."TH_REGRA_AGENDA_ENTREVISTA"."DS_MOTIVO" is 'Por que a regra mudou (obrigatório a partir da versão 2).';
comment on column public."TH_REGRA_AGENDA_ENTREVISTA"."CO_USUARIO" is 'Quem salvou a versão (auth.users.id).';
comment on column public."TH_REGRA_AGENDA_ENTREVISTA"."DT_CRIACAO" is 'Quando a versão foi salva.';
comment on constraint "FK_REGRAAGENDA_HISTREGRAAGENDA" on public."TH_REGRA_AGENDA_ENTREVISTA" is 'Regra da versão.';
comment on constraint "CK_HISTREGRAAGENDA_NUVERSAO" on public."TH_REGRA_AGENDA_ENTREVISTA" is 'Versões começam em 1.';
comment on constraint "CK_HISTREGRAAGENDA_CONFIG" on public."TH_REGRA_AGENDA_ENTREVISTA" is 'Configuração é um objeto json.';
comment on constraint "CK_HISTREGRAAGENDA_MOTIVO" on public."TH_REGRA_AGENDA_ENTREVISTA" is 'Motivo entre 3 e 500 caracteres.';

-- 2. A agenda e o histórico ---------------------------------------------------------------------
create table public."TB_AGENDA_ENTREVISTA" (
  "CO_AGENDA_ENTREVISTA" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "CO_ANALISE_CURRICULAR" uuid not null,
  "DT_ENTREVISTA" date not null,
  "HR_INICIO" time not null,
  "HR_FIM" time not null,
  "NU_BANCA" smallint not null,
  "TP_ORIGEM" varchar(10) not null,
  "NU_VERSAO_REGRA" integer,
  "CO_LISTA_CLASSIFICACAO" uuid,
  "CO_USUARIO_ATUALIZACAO" uuid,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_AGENDA_ENTREVISTA" primary key ("CO_AGENDA_ENTREVISTA"),
  constraint "UK_AGENDAENTREV_ANALISE" unique ("CO_MONITORAMENTO", "CO_ANALISE_CURRICULAR"),
  constraint "UK_AGENDAENTREV_HORARIO" unique ("CO_MONITORAMENTO", "DT_ENTREVISTA", "HR_INICIO", "NU_BANCA"),
  constraint "FK_MONITORAMENTO_AGENDAENTREV" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_ANALISECURRIC_AGENDAENTREV" foreign key ("CO_ANALISE_CURRICULAR") references public."TB_ANALISE_CURRICULAR" (id),
  constraint "FK_LISTACLASSIF_AGENDAENTREV" foreign key ("CO_LISTA_CLASSIFICACAO") references public."TB_LISTA_CLASSIFICACAO" ("CO_LISTA_CLASSIFICACAO"),
  constraint "CK_AGENDAENTREV_HORARIO" check ("HR_INICIO" < "HR_FIM"),
  constraint "CK_AGENDAENTREV_NUBANCA" check ("NU_BANCA" between 1 and 20),
  constraint "CK_AGENDAENTREV_TPORIGEM" check ("TP_ORIGEM" in ('GERADA', 'MANUAL'))
);
create index "IN_FKAGENDAENTREV_ANALISE" on public."TB_AGENDA_ENTREVISTA" ("CO_ANALISE_CURRICULAR");
create index "IN_FKAGENDAENTREV_LISTA" on public."TB_AGENDA_ENTREVISTA" ("CO_LISTA_CLASSIFICACAO");
comment on table public."TB_AGENDA_ENTREVISTA" is
  'Agenda das entrevistas de um edital: um horário por convocado (análise curricular), com dia, hora (Brasília) e banca. Substituída inteira a cada gravação; o que mudou fica em TH_AGENDA_ENTREVISTA.';
comment on column public."TB_AGENDA_ENTREVISTA"."CO_AGENDA_ENTREVISTA" is 'Identificador do horário.';
comment on column public."TB_AGENDA_ENTREVISTA"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TB_AGENDA_ENTREVISTA"."CO_ANALISE_CURRICULAR" is 'Convocado (TB_ANALISE_CURRICULAR.id), o mesmo da lista de convocação.';
comment on column public."TB_AGENDA_ENTREVISTA"."DT_ENTREVISTA" is 'Dia da entrevista (calendário de Brasília).';
comment on column public."TB_AGENDA_ENTREVISTA"."HR_INICIO" is 'Hora de início (Brasília, America/Sao_Paulo).';
comment on column public."TB_AGENDA_ENTREVISTA"."HR_FIM" is 'Hora de fim (Brasília).';
comment on column public."TB_AGENDA_ENTREVISTA"."NU_BANCA" is 'Banca (1, 2… quando há bancas simultâneas; a mesma numeração de TB_ENTREVISTA_AVALIADOR.NU_BANCA).';
comment on column public."TB_AGENDA_ENTREVISTA"."TP_ORIGEM" is 'GERADA (pelo motor, a partir da regra) ou MANUAL (ajustada pelo gestor).';
comment on column public."TB_AGENDA_ENTREVISTA"."NU_VERSAO_REGRA" is 'Versão da regra da agenda vigente na gravação.';
comment on column public."TB_AGENDA_ENTREVISTA"."CO_LISTA_CLASSIFICACAO" is 'Lista de convocação registrada usada (TB_LISTA_CLASSIFICACAO); nula quando a agenda saiu do cálculo atual, sem lista gerada.';
comment on column public."TB_AGENDA_ENTREVISTA"."CO_USUARIO_ATUALIZACAO" is 'Quem gravou (auth.users.id).';
comment on column public."TB_AGENDA_ENTREVISTA"."DT_ATUALIZACAO" is 'Quando gravou.';
comment on constraint "UK_AGENDAENTREV_ANALISE" on public."TB_AGENDA_ENTREVISTA" is 'Um horário por convocado no edital.';
comment on constraint "UK_AGENDAENTREV_HORARIO" on public."TB_AGENDA_ENTREVISTA" is 'Uma entrevista por banca, dia e hora de início.';
comment on constraint "FK_MONITORAMENTO_AGENDAENTREV" on public."TB_AGENDA_ENTREVISTA" is 'Edital da agenda.';
comment on constraint "FK_ANALISECURRIC_AGENDAENTREV" on public."TB_AGENDA_ENTREVISTA" is 'Convocado.';
comment on constraint "FK_LISTACLASSIF_AGENDAENTREV" on public."TB_AGENDA_ENTREVISTA" is 'Lista de convocação usada.';
comment on constraint "CK_AGENDAENTREV_HORARIO" on public."TB_AGENDA_ENTREVISTA" is 'Início antes do fim.';
comment on constraint "CK_AGENDAENTREV_NUBANCA" on public."TB_AGENDA_ENTREVISTA" is 'Bancas de 1 a 20.';
comment on constraint "CK_AGENDAENTREV_TPORIGEM" on public."TB_AGENDA_ENTREVISTA" is 'Origens válidas.';
comment on index public."IN_FKAGENDAENTREV_ANALISE" is 'Chave estrangeira para TB_ANALISE_CURRICULAR.';
comment on index public."IN_FKAGENDAENTREV_LISTA" is 'Chave estrangeira para TB_LISTA_CLASSIFICACAO.';

create table public."TH_AGENDA_ENTREVISTA" (
  "CO_HISTORICO_AGENDA" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "TP_ACAO" varchar(10) not null,
  "NU_VERSAO_REGRA" integer,
  "CO_LISTA_CLASSIFICACAO" uuid,
  "QT_ITEM" integer not null default 0,
  "QT_ALTERACAO" integer not null default 0,
  "DS_ALTERACAO" jsonb not null default '[]'::jsonb,
  "DS_MOTIVO" varchar(500),
  "CO_USUARIO" uuid not null,
  "DT_REGISTRO" timestamptz not null default now(),
  constraint "PK_TH_AGENDA_ENTREVISTA" primary key ("CO_HISTORICO_AGENDA"),
  constraint "FK_MONITORAMENTO_HISTAGENDA" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_LISTACLASSIF_HISTAGENDA" foreign key ("CO_LISTA_CLASSIFICACAO") references public."TB_LISTA_CLASSIFICACAO" ("CO_LISTA_CLASSIFICACAO"),
  constraint "CK_HISTAGENDA_TPACAO" check ("TP_ACAO" in ('GERAR', 'AJUSTAR', 'LIMPAR')),
  constraint "CK_HISTAGENDA_QUANTIDADES" check ("QT_ITEM" >= 0 and "QT_ALTERACAO" >= 0),
  constraint "CK_HISTAGENDA_ALTERACAO" check (jsonb_typeof("DS_ALTERACAO") = 'array'),
  constraint "CK_HISTAGENDA_MOTIVO" check ("DS_MOTIVO" is null or length("DS_MOTIVO") between 3 and 500)
);
create index "IN_HISTAGENDA_EDITAL_DATA" on public."TH_AGENDA_ENTREVISTA" ("CO_MONITORAMENTO", "DT_REGISTRO" desc);
create index "IN_FKHISTAGENDA_LISTA" on public."TH_AGENDA_ENTREVISTA" ("CO_LISTA_CLASSIFICACAO");
comment on table public."TH_AGENDA_ENTREVISTA" is
  'Histórico das gravações da agenda das entrevistas: gerar, ajustar ou limpar; quem, quando, a versão da regra, a lista usada e o que mudou de cada candidato. Nada é apagado.';
comment on column public."TH_AGENDA_ENTREVISTA"."CO_HISTORICO_AGENDA" is 'Identificador da gravação.';
comment on column public."TH_AGENDA_ENTREVISTA"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TH_AGENDA_ENTREVISTA"."TP_ACAO" is 'GERAR (agenda nova pelo motor), AJUSTAR (ajuste manual) ou LIMPAR (agenda esvaziada).';
comment on column public."TH_AGENDA_ENTREVISTA"."NU_VERSAO_REGRA" is 'Versão da regra da agenda vigente na gravação.';
comment on column public."TH_AGENDA_ENTREVISTA"."CO_LISTA_CLASSIFICACAO" is 'Lista de convocação registrada usada; nula quando foi o cálculo atual.';
comment on column public."TH_AGENDA_ENTREVISTA"."QT_ITEM" is 'Convocados com horário depois da gravação.';
comment on column public."TH_AGENDA_ENTREVISTA"."QT_ALTERACAO" is 'Candidatos que entraram, saíram ou mudaram de horário ou banca.';
comment on column public."TH_AGENDA_ENTREVISTA"."DS_ALTERACAO" is 'O que mudou (array json, até 500): {analise, nome, antes: {data, inicio, fim, banca} ou null, depois: idem ou null}. Só o nome, sem CPF.';
comment on column public."TH_AGENDA_ENTREVISTA"."DS_MOTIVO" is 'Motivo informado (opcional).';
comment on column public."TH_AGENDA_ENTREVISTA"."CO_USUARIO" is 'Quem gravou (auth.users.id).';
comment on column public."TH_AGENDA_ENTREVISTA"."DT_REGISTRO" is 'Quando gravou.';
comment on constraint "FK_MONITORAMENTO_HISTAGENDA" on public."TH_AGENDA_ENTREVISTA" is 'Edital da gravação.';
comment on constraint "FK_LISTACLASSIF_HISTAGENDA" on public."TH_AGENDA_ENTREVISTA" is 'Lista de convocação usada.';
comment on constraint "CK_HISTAGENDA_TPACAO" on public."TH_AGENDA_ENTREVISTA" is 'Ações válidas.';
comment on constraint "CK_HISTAGENDA_QUANTIDADES" on public."TH_AGENDA_ENTREVISTA" is 'Quantidades não negativas.';
comment on constraint "CK_HISTAGENDA_ALTERACAO" on public."TH_AGENDA_ENTREVISTA" is 'Alterações são um array json.';
comment on constraint "CK_HISTAGENDA_MOTIVO" on public."TH_AGENDA_ENTREVISTA" is 'Motivo entre 3 e 500 caracteres.';
comment on index public."IN_HISTAGENDA_EDITAL_DATA" is 'Gravações por edital, da mais recente.';
comment on index public."IN_FKHISTAGENDA_LISTA" is 'Chave estrangeira para TB_LISTA_CLASSIFICACAO.';

-- 3. Acesso: só as funções abaixo ------------------------------------------------------------
alter table public."TB_REGRA_AGENDA_ENTREVISTA" enable row level security;
alter table public."TH_REGRA_AGENDA_ENTREVISTA" enable row level security;
alter table public."TB_AGENDA_ENTREVISTA" enable row level security;
alter table public."TH_AGENDA_ENTREVISTA" enable row level security;
revoke all on public."TB_REGRA_AGENDA_ENTREVISTA", public."TH_REGRA_AGENDA_ENTREVISTA",
  public."TB_AGENDA_ENTREVISTA", public."TH_AGENDA_ENTREVISTA"
  from public, anon, authenticated;

-- 4. Porteiro, validação e leitura ----------------------------------------------------------------
create function private."FC_EXIGIR_AGENDA_ENTREVISTA"(p_edital uuid, p_minimo integer)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text;
begin
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  if v_area is null then raise exception 'Edital não encontrado' using errcode = '22023'; end if;
  if not (private.pode_recurso('entrevistas', p_minimo) or private.pode_recurso('classificacao', p_minimo)) then
    raise exception 'Sem permissão para a agenda das entrevistas' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(v_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
  return v_area;
end;
$function$;
comment on function private."FC_EXIGIR_AGENDA_ENTREVISTA"(uuid, integer) is
  'Barra (42501) quem não tem entrevistas nem classificacao no nível pedido (1 leitor, 2 editor), a área ou o recorte da coordenação do edital; edital inexistente = 22023. Devolve a área do edital.';
revoke all on function private."FC_EXIGIR_AGENDA_ENTREVISTA"(uuid, integer) from public, anon, authenticated;

create function private."FC_VALIDAR_REGRA_AGENDA"(p_regra jsonb)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_modo text;
  v_inicio date;
  v_fim date;
  v_uteis boolean;
  v_dias integer;
  v_periodos jsonb;
  v_pausa jsonb;
  v_hora constant text := '^([01][0-9]|2[0-3]):[0-5][0-9]$';
  v_data constant text := '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';
begin
  if jsonb_typeof(p_regra) is distinct from 'object' then
    raise exception 'Regra inválida: envie um objeto.' using errcode = '22023';
  end if;
  if pg_column_size(p_regra) > 50000 then
    raise exception 'Regra grande demais.' using errcode = '22023';
  end if;
  if p_regra ->> 'schema' is distinct from '1' then
    raise exception 'Regra inválida: versão do formato (schema) deve ser 1.' using errcode = '22023';
  end if;

  -- Datas: intervalo (com ou sem dias úteis) ou lista; dias excluídos.
  v_modo := coalesce(p_regra #>> '{datas,modo}', 'INTERVALO');
  if v_modo not in ('INTERVALO', 'LISTA') then
    raise exception 'Modo das datas inválido.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_regra #> '{datas,dias}', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_regra #> '{datas,excluir}', '[]'::jsonb)) <> 'array'
     or exists (select 1
                  from (select jsonb_array_elements_text(coalesce(p_regra #> '{datas,dias}', '[]'::jsonb)) as d
                        union all
                        select jsonb_array_elements_text(coalesce(p_regra #> '{datas,excluir}', '[]'::jsonb))) x
                 where x.d !~ v_data) then
    raise exception 'Há dia inválido na lista.' using errcode = '22023';
  end if;
  begin
    perform d::date from jsonb_array_elements_text(coalesce(p_regra #> '{datas,dias}', '[]'::jsonb)) d;
    perform d::date from jsonb_array_elements_text(coalesce(p_regra #> '{datas,excluir}', '[]'::jsonb)) d;
    if v_modo = 'INTERVALO' then
      if coalesce(p_regra #>> '{datas,inicio}', '') !~ v_data or coalesce(p_regra #>> '{datas,fim}', '') !~ v_data then
        raise exception 'Informe a data de início e a de fim.' using errcode = '22023';
      end if;
      v_inicio := (p_regra #>> '{datas,inicio}')::date;
      v_fim := (p_regra #>> '{datas,fim}')::date;
    end if;
  exception
    when sqlstate '22023' then raise;
    when others then raise exception 'Há dia inválido na lista.' using errcode = '22023';
  end;
  if v_modo = 'INTERVALO' then
    if v_inicio > v_fim then
      raise exception 'A data de fim vem antes da de início.' using errcode = '22023';
    end if;
    if v_fim - v_inicio > 400 then
      raise exception 'Intervalo de datas longo demais.' using errcode = '22023';
    end if;
    v_uteis := coalesce(p_regra #>> '{datas,so_dias_uteis}', 'true') <> 'false';
    select count(*) into v_dias
      from generate_series(v_inicio::timestamp, v_fim::timestamp, interval '1 day') g(d)
     where (not v_uteis or extract(isodow from g.d) < 6)
       and not (to_char(g.d, 'YYYY-MM-DD') in (select jsonb_array_elements_text(coalesce(p_regra #> '{datas,excluir}', '[]'::jsonb))));
  else
    select count(distinct d) into v_dias
      from jsonb_array_elements_text(coalesce(p_regra #> '{datas,dias}', '[]'::jsonb)) d
     where not (d in (select jsonb_array_elements_text(coalesce(p_regra #> '{datas,excluir}', '[]'::jsonb))));
  end if;
  if v_dias = 0 then
    raise exception 'Nenhum dia sobra para as entrevistas.' using errcode = '22023';
  end if;
  if v_dias > 60 then
    raise exception 'Até 60 dias de entrevista.' using errcode = '22023';
  end if;

  -- Períodos: de 1 a 6, HH:MM, início antes do fim, sem sobreposição.
  v_periodos := coalesce(p_regra -> 'periodos', '[]'::jsonb);
  if jsonb_typeof(v_periodos) <> 'array' or jsonb_array_length(v_periodos) not between 1 and 6 then
    raise exception 'De 1 a 6 períodos por dia.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_periodos) p
              where case when coalesce(p ->> 'inicio', '') !~ v_hora or coalesce(p ->> 'fim', '') !~ v_hora then true
                         else (p ->> 'inicio')::time >= (p ->> 'fim')::time end) then
    raise exception 'Cada período precisa de início antes do fim (HH:MM).' using errcode = '22023';
  end if;
  if exists (select 1 from (
               select (p ->> 'inicio')::time as inicio,
                      lag((p ->> 'fim')::time) over (order by (p ->> 'inicio')::time) as fim_anterior
                 from jsonb_array_elements(v_periodos) p) s
              where s.inicio < s.fim_anterior) then
    raise exception 'Os períodos não podem se sobrepor.' using errcode = '22023';
  end if;

  if case when jsonb_typeof(p_regra -> 'duracao_min') is distinct from 'number' then true
          else (p_regra ->> 'duracao_min')::numeric not between 5 and 240 end then
    raise exception 'Duração de cada entrevista entre 5 e 240 minutos.' using errcode = '22023';
  end if;
  if not private."FC_JSON_NUMERO_ENTRE"(p_regra -> 'intervalo_min', 0, 120) then
    raise exception 'Intervalo entre entrevistas entre 0 e 120 minutos.' using errcode = '22023';
  end if;
  v_pausa := p_regra -> 'pausa';
  if case when coalesce(jsonb_typeof(v_pausa), 'null') = 'null' then false
          when jsonb_typeof(v_pausa) <> 'object'
            or coalesce(v_pausa ->> 'inicio', '') !~ v_hora or coalesce(v_pausa ->> 'fim', '') !~ v_hora then true
          else (v_pausa ->> 'inicio')::time >= (v_pausa ->> 'fim')::time end then
    raise exception 'A pausa precisa de início antes do fim (HH:MM).' using errcode = '22023';
  end if;
  if case when jsonb_typeof(p_regra -> 'bancas') is distinct from 'number' then true
          else (p_regra ->> 'bancas')::numeric not between 1 and 20 end then
    raise exception 'De 1 a 20 bancas simultâneas.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_regra -> 'nomes_das_bancas', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_regra -> 'nomes_das_bancas', '[]'::jsonb)) > 20
     or exists (select 1 from jsonb_array_elements(coalesce(p_regra -> 'nomes_das_bancas', '[]'::jsonb)) n
                 where jsonb_typeof(n) <> 'string' or length(n #>> '{}') > 60) then
    raise exception 'Nome da banca com até 60 caracteres.' using errcode = '22023';
  end if;
  if coalesce(p_regra ->> 'ordem', 'CLASSIFICACAO') not in ('CLASSIFICACAO', 'VAGA', 'ALFABETICA', 'MODALIDADE') then
    raise exception 'Ordem dos candidatos inválida.' using errcode = '22023';
  end if;
  if coalesce(p_regra ->> 'fuso', 'America/Sao_Paulo') <> 'America/Sao_Paulo' then
    raise exception 'A agenda é no horário de Brasília.' using errcode = '22023';
  end if;
end;
$function$;
comment on function private."FC_VALIDAR_REGRA_AGENDA"(jsonb) is
  'Confere a configuração da regra da agenda das entrevistas (22023 com a mensagem do que está errado). As mesmas regras de validarRegraDaAgenda() em src/lib/agenda-das-entrevistas.js.';
revoke all on function private."FC_VALIDAR_REGRA_AGENDA"(jsonb) from public, anon, authenticated;

create function private."FC_REGRA_AGENDA_JSON"(p_edital uuid)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
           'versao', r."NU_VERSAO_VIGENTE",
           'configuracao', v."DS_CONFIGURACAO",
           'atualizado_em', v."DT_CRIACAO",
           'por', coalesce(p.nome, p.email),
           'versoes', coalesce((
             select json_agg(json_build_object(
                      'versao', h."NU_VERSAO", 'em', h."DT_CRIACAO", 'por', coalesce(pu.nome, pu.email),
                      'motivo', h."DS_MOTIVO")
                    order by h."NU_VERSAO" desc)
               from public."TH_REGRA_AGENDA_ENTREVISTA" h
               left join public."TB_PERFIL_USUARIO" pu on pu.user_id = h."CO_USUARIO"
              where h."CO_REGRA_AGENDA" = r."CO_REGRA_AGENDA"), '[]'::json))
    from public."TB_REGRA_AGENDA_ENTREVISTA" r
    join public."TH_REGRA_AGENDA_ENTREVISTA" v
      on v."CO_REGRA_AGENDA" = r."CO_REGRA_AGENDA" and v."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
    left join public."TB_PERFIL_USUARIO" p on p.user_id = v."CO_USUARIO"
   where r."CO_MONITORAMENTO" = p_edital;
$function$;
comment on function private."FC_REGRA_AGENDA_JSON"(uuid) is
  'Regra da agenda vigente do edital (versão, configuração, quem e quando) e o histórico de versões; null sem regra.';
revoke all on function private."FC_REGRA_AGENDA_JSON"(uuid) from public, anon, authenticated;

create function private."FC_AGENDA_ENTREVISTA_JSON"(p_edital uuid)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
    'edital', (select json_build_object('id', m.id, 'edital', m.edital, 'unidade', m.unidade, 'area', m."CO_AREA")
                 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital),
    'pode_editar', private.pode_recurso('entrevistas', 2) or private.pode_recurso('classificacao', 2),
    'regra', private."FC_REGRA_AGENDA_JSON"(p_edital),
    'itens', coalesce((
      select json_agg(json_build_object(
               'analise_id', g."CO_ANALISE_CURRICULAR", 'nome', a.candidato, 'vaga', a.codigo_vaga,
               'cargo', a.nome_vaga, 'modalidade', a.modalidade_concorrencia,
               'data', g."DT_ENTREVISTA", 'inicio', to_char(g."HR_INICIO", 'HH24:MI'),
               'fim', to_char(g."HR_FIM", 'HH24:MI'), 'banca', g."NU_BANCA", 'origem', g."TP_ORIGEM",
               'atualizado_em', g."DT_ATUALIZACAO")
             order by g."DT_ENTREVISTA", g."HR_INICIO", g."NU_BANCA")
        from public."TB_AGENDA_ENTREVISTA" g
        join public."TB_ANALISE_CURRICULAR" a on a.id = g."CO_ANALISE_CURRICULAR"
       where g."CO_MONITORAMENTO" = p_edital), '[]'::json),
    'bancas', coalesce((
      select json_agg(json_build_object('banca', b.banca, 'membros', b.membros) order by b.banca)
        from (select v."NU_BANCA" as banca,
                     json_agg(json_build_object('nome', v."NO_AVALIADOR", 'origem', v."NO_ORIGEM")
                              order by v."NO_ORIGEM", v."NO_AVALIADOR") as membros
                from public."TB_ENTREVISTA_AVALIADOR" v
               where v."CO_MONITORAMENTO" = p_edital and v."ST_ATIVO" = 'S'
               group by v."NU_BANCA") b), '[]'::json),
    'ultimo_registro', (select h."CO_HISTORICO_AGENDA" from public."TH_AGENDA_ENTREVISTA" h
                         where h."CO_MONITORAMENTO" = p_edital
                         order by h."DT_REGISTRO" desc, h."CO_HISTORICO_AGENDA" limit 1),
    'historico', coalesce((
      select json_agg(json_build_object(
               'id', h."CO_HISTORICO_AGENDA", 'acao', h."TP_ACAO", 'em', h."DT_REGISTRO",
               'por', coalesce(p.nome, p.email), 'versao_regra', h."NU_VERSAO_REGRA",
               'lista', h."CO_LISTA_CLASSIFICACAO", 'itens', h."QT_ITEM", 'alteracoes', h."QT_ALTERACAO",
               'motivo', h."DS_MOTIVO")
             order by h."DT_REGISTRO" desc)
        from (select * from public."TH_AGENDA_ENTREVISTA" x
               where x."CO_MONITORAMENTO" = p_edital
               order by x."DT_REGISTRO" desc limit 20) h
        left join public."TB_PERFIL_USUARIO" p on p.user_id = h."CO_USUARIO"), '[]'::json)
  );
$function$;
comment on function private."FC_AGENDA_ENTREVISTA_JSON"(uuid) is
  'A agenda do edital (json): regra vigente e versões, horários (com nome, vaga, cargo e modalidade da análise; sem CPF), membros ativos de cada banca, a última gravação e as 20 mais recentes. Sem checagem de permissão: só as RPCs chamam.';
revoke all on function private."FC_AGENDA_ENTREVISTA_JSON"(uuid) from public, anon, authenticated;

-- 5. RPCs -----------------------------------------------------------------------------------------
create function public.obter_agenda_entrevista(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  perform private."FC_EXIGIR_AGENDA_ENTREVISTA"(p_edital, 1);
  return private."FC_AGENDA_ENTREVISTA_JSON"(p_edital);
end;
$function$;
comment on function public.obter_agenda_entrevista(uuid) is
  'A agenda das entrevistas do edital (json): regra vigente e versões, horários por convocado, bancas, histórico; pode_editar. Exige entrevistas ou classificacao >= leitor, a área e o recorte da coordenação.';
revoke all on function public.obter_agenda_entrevista(uuid) from public, anon;
grant execute on function public.obter_agenda_entrevista(uuid) to authenticated, service_role;

create function public.salvar_regra_agenda_entrevista(p_edital uuid, p_configuracao jsonb, p_versao_atual integer, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AGENDA_ENTREVISTA"(p_edital, 2);
  v_regra public."TB_REGRA_AGENDA_ENTREVISTA";
  v_nova integer;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_uid uuid := (select auth.uid());
begin
  perform private."FC_VALIDAR_REGRA_AGENDA"(p_configuracao);
  if v_motivo is not null and length(v_motivo) not between 3 and 500 then
    raise exception 'Motivo da alteração entre 3 e 500 caracteres.' using errcode = '22023';
  end if;

  select * into v_regra from public."TB_REGRA_AGENDA_ENTREVISTA" where "CO_MONITORAMENTO" = p_edital for update;
  if v_regra."CO_REGRA_AGENDA" is null then
    if coalesce(p_versao_atual, 0) <> 0 then
      raise exception 'A regra da agenda mudou desde que você abriu; recarregue.' using errcode = '40001';
    end if;
    insert into public."TB_REGRA_AGENDA_ENTREVISTA" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
    values (p_edital, 1, v_uid)
    returning * into v_regra;
    v_nova := 1;
  else
    if p_versao_atual is distinct from v_regra."NU_VERSAO_VIGENTE" then
      raise exception 'A regra da agenda mudou desde que você abriu (versão %); recarregue.', v_regra."NU_VERSAO_VIGENTE" using errcode = '40001';
    end if;
    if v_motivo is null then
      raise exception 'Informe o motivo da alteração.' using errcode = '22023';
    end if;
    v_nova := v_regra."NU_VERSAO_VIGENTE" + 1;
    update public."TB_REGRA_AGENDA_ENTREVISTA"
       set "NU_VERSAO_VIGENTE" = v_nova, "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = v_uid
     where "CO_REGRA_AGENDA" = v_regra."CO_REGRA_AGENDA";
  end if;

  insert into public."TH_REGRA_AGENDA_ENTREVISTA" ("CO_REGRA_AGENDA", "NU_VERSAO", "DS_CONFIGURACAO", "DS_MOTIVO", "CO_USUARIO")
  values (v_regra."CO_REGRA_AGENDA", v_nova, p_configuracao, v_motivo, v_uid);

  return private."FC_REGRA_AGENDA_JSON"(p_edital);
end;
$function$;
comment on function public.salvar_regra_agenda_entrevista(uuid, jsonb, integer, text) is
  'Salva a regra da agenda das entrevistas do edital como versão nova (a anterior fica no histórico). p_versao_atual = a versão que a tela abriu (0 sem regra; outra = 40001). Motivo obrigatório a partir da versão 2. Exige entrevistas ou classificacao >= editor, a área e o recorte da coordenação.';
revoke all on function public.salvar_regra_agenda_entrevista(uuid, jsonb, integer, text) from public, anon;
grant execute on function public.salvar_regra_agenda_entrevista(uuid, jsonb, integer, text) to authenticated, service_role;

create function public.salvar_agenda_entrevista(p_edital uuid, p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_AGENDA_ENTREVISTA"(p_edital, 2);
  v_acao text := upper(coalesce(p_dados ->> 'acao', ''));
  v_itens jsonb := coalesce(p_dados -> 'itens', '[]'::jsonb);
  v_motivo text := nullif(btrim(coalesce(p_dados ->> 'motivo', '')), '');
  v_lista uuid;
  v_regra public."TB_REGRA_AGENDA_ENTREVISTA";
  v_numero text;
  v_ultimo uuid;
  v_n integer;
  v_alteracoes jsonb;
  v_qt_alteracao integer;
  v_uid uuid := (select auth.uid());
  v_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_hora constant text := '^([01][0-9]|2[0-3]):[0-5][0-9]$';
begin
  if v_acao not in ('GERAR', 'AJUSTAR', 'LIMPAR') then
    raise exception 'Ação inválida (GERAR, AJUSTAR ou LIMPAR).' using errcode = '22023';
  end if;
  if jsonb_typeof(v_itens) is distinct from 'array' or jsonb_array_length(v_itens) > 3000 then
    raise exception 'Agenda inválida (até 3.000 horários).' using errcode = '22023';
  end if;
  if v_acao = 'LIMPAR' and jsonb_array_length(v_itens) > 0 then
    raise exception 'Limpar não leva horários.' using errcode = '22023';
  end if;
  if v_motivo is not null and length(v_motivo) not between 3 and 500 then
    raise exception 'Motivo entre 3 e 500 caracteres.' using errcode = '22023';
  end if;

  -- Uma gravação por vez no edital; a tela tem de estar na última.
  perform pg_advisory_xact_lock(hashtextextended('agenda_entrevista:' || p_edital::text, 0));
  select h."CO_HISTORICO_AGENDA" into v_ultimo from public."TH_AGENDA_ENTREVISTA" h
   where h."CO_MONITORAMENTO" = p_edital
   order by h."DT_REGISTRO" desc, h."CO_HISTORICO_AGENDA" limit 1;
  if nullif(p_dados ->> 'ultimo_registro', '') is distinct from v_ultimo::text then
    raise exception 'A agenda mudou desde que você abriu; recarregue.' using errcode = '40001';
  end if;

  select * into v_regra from public."TB_REGRA_AGENDA_ENTREVISTA" where "CO_MONITORAMENTO" = p_edital;
  if v_acao <> 'LIMPAR' then
    if v_regra."CO_REGRA_AGENDA" is null then
      raise exception 'Salve a regra da agenda antes de gerar.' using errcode = '22023';
    end if;
    if (p_dados ->> 'versao_regra') is distinct from v_regra."NU_VERSAO_VIGENTE"::text then
      raise exception 'A regra da agenda mudou (versão %); gere de novo.', v_regra."NU_VERSAO_VIGENTE" using errcode = '40001';
    end if;
  end if;

  if nullif(p_dados ->> 'lista', '') is not null then
    if p_dados ->> 'lista' !~ v_uuid then
      raise exception 'Lista de convocação inválida.' using errcode = '22023';
    end if;
    v_lista := (p_dados ->> 'lista')::uuid;
    if not exists (select 1 from public."TB_LISTA_CLASSIFICACAO" l
                    where l."CO_LISTA_CLASSIFICACAO" = v_lista and l."CO_MONITORAMENTO" = p_edital
                      and l."TP_LISTA" = 'CONVOCACAO') then
      raise exception 'A lista não é uma convocação deste edital.' using errcode = '22023';
    end if;
  end if;

  -- Cada horário: análise, dia, início e fim (HH:MM, Brasília), banca e origem.
  if exists (select 1 from jsonb_array_elements(v_itens) e
              where case
                      when jsonb_typeof(e) <> 'object'
                        or coalesce(e ->> 'analise', '') !~ v_uuid
                        or coalesce(e ->> 'data', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                        or coalesce(e ->> 'inicio', '') !~ v_hora
                        or coalesce(e ->> 'fim', '') !~ v_hora
                        or coalesce(e ->> 'banca', '') !~ '^[0-9]{1,2}$'
                        or coalesce(e ->> 'origem', 'GERADA') not in ('GERADA', 'MANUAL') then true
                      else (e ->> 'banca')::integer not between 1 and 20
                        or (e ->> 'inicio')::time >= (e ->> 'fim')::time
                    end) then
    raise exception 'Horário inválido: análise, dia (AAAA-MM-DD), início antes do fim (HH:MM) e banca de 1 a 20.' using errcode = '22023';
  end if;
  begin
    perform (e ->> 'data')::date from jsonb_array_elements(v_itens) e;
  exception when others then
    raise exception 'Horário com dia inválido.' using errcode = '22023';
  end;

  create temporary table "TM_AGENDA_NOVA" on commit drop as
  select (e ->> 'analise')::uuid as analise, (e ->> 'data')::date as data,
         (e ->> 'inicio')::time as inicio, (e ->> 'fim')::time as fim,
         (e ->> 'banca')::smallint as banca, coalesce(e ->> 'origem', 'GERADA') as origem
    from jsonb_array_elements(v_itens) e;

  if (select count(*) from pg_temp."TM_AGENDA_NOVA") <> (select count(distinct analise) from pg_temp."TM_AGENDA_NOVA") then
    raise exception 'Candidato repetido na agenda.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp."TM_AGENDA_NOVA" a join pg_temp."TM_AGENDA_NOVA" b
               on a.data = b.data and a.banca = b.banca and a.analise < b.analise
              and a.inicio < b.fim and b.inicio < a.fim) then
    raise exception 'Conflito: dois candidatos na mesma banca com horários que se sobrepõem.' using errcode = '22023';
  end if;

  -- Os candidatos são análises ativas deste edital e desta área.
  select private."FC_NUMERO_EDITAL"(m.edital) into v_numero from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  select count(*) into v_n
    from pg_temp."TM_AGENDA_NOVA" t
    join public."TB_ANALISE_CURRICULAR" a on a.id = t.analise
   where a."CO_AREA" = v_area and a.ativo and private."FC_NUMERO_EDITAL"(a.edital) = v_numero;
  if v_n <> (select count(*) from pg_temp."TM_AGENDA_NOVA") then
    raise exception 'Há candidato fora deste edital.' using errcode = '22023';
  end if;

  -- O que mudou: entrou, saiu ou trocou de dia, hora ou banca.
  with antes as (
    select g."CO_ANALISE_CURRICULAR" as analise, g."DT_ENTREVISTA" as data, g."HR_INICIO" as inicio,
           g."HR_FIM" as fim, g."NU_BANCA" as banca
      from public."TB_AGENDA_ENTREVISTA" g where g."CO_MONITORAMENTO" = p_edital
  ),
  mudou as (
    select coalesce(n.analise, a.analise) as analise,
           case when a.analise is null then null else json_build_object(
             'data', a.data, 'inicio', to_char(a.inicio, 'HH24:MI'), 'fim', to_char(a.fim, 'HH24:MI'), 'banca', a.banca) end as antes,
           case when n.analise is null then null else json_build_object(
             'data', n.data, 'inicio', to_char(n.inicio, 'HH24:MI'), 'fim', to_char(n.fim, 'HH24:MI'), 'banca', n.banca) end as depois
      from pg_temp."TM_AGENDA_NOVA" n
      full join antes a on a.analise = n.analise
     where a.analise is null or n.analise is null
        or (a.data, a.inicio, a.fim, a.banca) is distinct from (n.data, n.inicio, n.fim, n.banca)
  )
  select count(*)::integer,
         coalesce((select jsonb_agg(jsonb_build_object('analise', x.analise, 'nome', an.candidato,
                                                       'antes', x.antes, 'depois', x.depois))
                     from (select * from mudou order by analise limit 500) x
                     left join public."TB_ANALISE_CURRICULAR" an on an.id = x.analise), '[]'::jsonb)
    into v_qt_alteracao, v_alteracoes
    from mudou;

  delete from public."TB_AGENDA_ENTREVISTA" where "CO_MONITORAMENTO" = p_edital;
  insert into public."TB_AGENDA_ENTREVISTA"
    ("CO_MONITORAMENTO", "CO_ANALISE_CURRICULAR", "DT_ENTREVISTA", "HR_INICIO", "HR_FIM", "NU_BANCA",
     "TP_ORIGEM", "NU_VERSAO_REGRA", "CO_LISTA_CLASSIFICACAO", "CO_USUARIO_ATUALIZACAO")
  select p_edital, t.analise, t.data, t.inicio, t.fim, t.banca, t.origem, v_regra."NU_VERSAO_VIGENTE", v_lista, v_uid
    from pg_temp."TM_AGENDA_NOVA" t;

  insert into public."TH_AGENDA_ENTREVISTA"
    ("CO_MONITORAMENTO", "TP_ACAO", "NU_VERSAO_REGRA", "CO_LISTA_CLASSIFICACAO", "QT_ITEM", "QT_ALTERACAO",
     "DS_ALTERACAO", "DS_MOTIVO", "CO_USUARIO")
  values (p_edital, v_acao, v_regra."NU_VERSAO_VIGENTE", v_lista, (select count(*) from pg_temp."TM_AGENDA_NOVA"),
          v_qt_alteracao, v_alteracoes, v_motivo, v_uid);

  drop table pg_temp."TM_AGENDA_NOVA";
  return private."FC_AGENDA_ENTREVISTA_JSON"(p_edital);
end;
$function$;
comment on function public.salvar_agenda_entrevista(uuid, jsonb) is
  'Grava a agenda das entrevistas do edital inteira (substitui a anterior) e registra no histórico o que mudou. p_dados: {acao: GERAR|AJUSTAR|LIMPAR, itens: [{analise, data, inicio, fim, banca, origem}], versao_regra (a vigente, senão 40001), lista (convocação registrada, opcional), ultimo_registro (a última gravação que a tela viu, senão 40001), motivo?}. Recusa candidato repetido, fora do edital e mesma banca com horários sobrepostos (22023). Exige entrevistas ou classificacao >= editor, a área e o recorte da coordenação.';
revoke all on function public.salvar_agenda_entrevista(uuid, jsonb) from public, anon;
grant execute on function public.salvar_agenda_entrevista(uuid, jsonb) to authenticated, service_role;
-- ═══ CORPO DA MIGRATION (fim) ═══

-- ENSAIO (tudo abaixo corre na mesma transação e é desfeito no rollback final)

-- E1. Tabelas com RLS e sem acesso direto.
do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['TB_REGRA_AGENDA_ENTREVISTA', 'TH_REGRA_AGENDA_ENTREVISTA', 'TB_AGENDA_ENTREVISTA', 'TH_AGENDA_ENTREVISTA'] loop
    if not (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = v_tabela) then
      raise exception 'FALHOU E1: % sem RLS', v_tabela;
    end if;
    if has_table_privilege('authenticated', format('public.%I', v_tabela), 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', v_tabela), 'INSERT') then
      raise exception 'FALHOU E1: authenticated com acesso direto a %', v_tabela;
    end if;
  end loop;
  raise notice 'ok E1: quatro tabelas com RLS e sem grant para authenticated';
end;
$$;

-- E2. Validação da regra (só a função).
do $$
declare
  v_boa jsonb := '{"schema":1,"datas":{"modo":"INTERVALO","inicio":"2026-10-05","fim":"2026-10-09","so_dias_uteis":true,"dias":[],"excluir":["2026-10-07"]},"periodos":[{"inicio":"08:00","fim":"12:00"},{"inicio":"14:00","fim":"18:00"}],"duracao_min":30,"intervalo_min":10,"pausa":{"inicio":"10:00","fim":"10:15"},"bancas":2,"nomes_das_bancas":["Sala A",""],"ordem":"CLASSIFICACAO","agrupar_por_cargo":true,"reservar_primeiro_horario":false,"fuso":"America/Sao_Paulo"}';
  v_ruins jsonb[];
  v_ruim jsonb;
  v_recusadas integer := 0;
begin
  v_ruins := array[
    v_boa || '{"schema":2}',
    v_boa || '{"periodos":[{"inicio":"12:00","fim":"08:00"}]}',
    v_boa || '{"periodos":[{"inicio":"08:00","fim":"12:00"},{"inicio":"11:00","fim":"13:00"}]}',
    v_boa || '{"periodos":[{"inicio":"8h","fim":"12:00"}]}',
    v_boa || '{"duracao_min":2}',
    v_boa || '{"duracao_min":"trinta"}',
    v_boa || '{"bancas":30}',
    v_boa || '{"pausa":{"inicio":"13:00","fim":"12:00"}}',
    v_boa || '{"fuso":"UTC"}',
    v_boa || '{"ordem":"SORTEIO"}',
    v_boa || '{"datas":{"modo":"LISTA","dias":[]}}',
    v_boa || '{"datas":{"modo":"LISTA","dias":["2026-02-30"]}}',
    v_boa || '{"datas":{"modo":"INTERVALO","inicio":"2026-10-09","fim":"2026-10-05"}}',
    v_boa || '{"datas":{"modo":"INTERVALO","inicio":"2026-10-10","fim":"2026-10-11","so_dias_uteis":true}}'
  ];
  perform private."FC_VALIDAR_REGRA_AGENDA"(v_boa);
  perform private."FC_VALIDAR_REGRA_AGENDA"(v_boa || '{"pausa":null,"datas":{"modo":"LISTA","dias":["2026-10-10"]}}');
  foreach v_ruim in array v_ruins loop
    begin
      perform private."FC_VALIDAR_REGRA_AGENDA"(v_ruim);
      raise notice 'aceita indevidamente: %', v_ruim;
    exception when sqlstate '22023' then
      v_recusadas := v_recusadas + 1;
    end;
  end loop;
  if v_recusadas <> cardinality(v_ruins) then
    raise exception 'FALHOU E2: só % de % regras ruins recusadas', v_recusadas, cardinality(v_ruins);
  end if;
  perform set_config('ensaio.regra', v_boa::text, true);
  raise notice 'ok E2: regras boas aceitas; % regras ruins recusadas (22023)', v_recusadas;
end;
$$;

-- E3. Atores sintéticos (somem no rollback) e um edital com três análises ativas.
do $$
declare
  v_edital uuid;
  v_area text;
  v_ids text;
begin
  select m.id, m."CO_AREA" into v_edital, v_area
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m."CO_AREA" is not null
     and (select count(*) from public."TB_ANALISE_CURRICULAR" a
           where a."CO_AREA" = m."CO_AREA" and a.ativo
             and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(m.edital)) >= 3
   order by m.ativo desc, m.edital
   limit 1;
  if v_edital is null then raise exception 'ENSAIO: nenhum edital com três análises ativas'; end if;
  select string_agg(s.id::text, ',' order by s.id::text collate "C") into v_ids
    from (select a.id from public."TB_ANALISE_CURRICULAR" a, public."TB_MONITORAMENTO_INDIGENA" m
           where m.id = v_edital and a."CO_AREA" = v_area and a.ativo
             and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(m.edital)
           order by a.id limit 3) s;
  perform set_config('ensaio.edital', v_edital::text, true);
  perform set_config('ensaio.area', v_area, true);
  perform set_config('ensaio.ids', v_ids, true);

  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-00000000e101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.gestor@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.leitor@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000e103', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.outro@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-00000000e101', 'ensaio.gestor@ensaio.invalid', 'Ensaio Gestor', 'edital_gestor', true),
    ('00000000-0000-4000-a000-00000000e102', 'ensaio.leitor@ensaio.invalid', 'Ensaio Leitor', 'usuario', true),
    ('00000000-0000-4000-a000-00000000e103', 'ensaio.outro@ensaio.invalid', 'Ensaio Outro', 'usuario', true);
  -- Gestor e leitor com a área do edital; o "outro" sem área nenhuma.
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select u.id, v_area from public."TB_PERFIL_USUARIO" u
   where u.email in ('ensaio.gestor@ensaio.invalid', 'ensaio.leitor@ensaio.invalid');
  raise notice 'ok E3: atores criados; edital % (área %), 3 análises', v_edital, v_area;
end;
$$;

-- E4. O fluxo pelas RPCs, como cada pessoa (papel authenticated).
set local role authenticated;
do $$
declare
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-00000000e101","role":"authenticated","email":"ensaio.gestor@ensaio.invalid"}';
  c_leitor constant text := '{"sub":"00000000-0000-4000-a000-00000000e102","role":"authenticated","email":"ensaio.leitor@ensaio.invalid"}';
  c_outro constant text := '{"sub":"00000000-0000-4000-a000-00000000e103","role":"authenticated","email":"ensaio.outro@ensaio.invalid"}';
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v_ids text[] := string_to_array(current_setting('ensaio.ids'), ',');
  v_regra jsonb := current_setting('ensaio.regra')::jsonb;
  v json;
  v_ultimo text;
  v_itens jsonb;
begin
  v_itens := jsonb_build_array(
    jsonb_build_object('analise', v_ids[1], 'data', '2026-10-05', 'inicio', '08:00', 'fim', '08:30', 'banca', 1, 'origem', 'GERADA'),
    jsonb_build_object('analise', v_ids[2], 'data', '2026-10-05', 'inicio', '08:00', 'fim', '08:30', 'banca', 2, 'origem', 'GERADA'),
    jsonb_build_object('analise', v_ids[3], 'data', '2026-10-05', 'inicio', '08:40', 'fim', '09:10', 'banca', 1, 'origem', 'GERADA'));

  -- Leitor: lê, não salva.
  perform set_config('request.jwt.claims', c_leitor, true);
  v := public.obter_agenda_entrevista(v_edital);
  if (v->>'pode_editar')::boolean or json_typeof(v->'regra') <> 'null' or json_array_length(v->'itens') <> 0 then
    raise exception 'FALHOU E4: leitura inicial do leitor %', v;
  end if;
  begin
    perform public.salvar_regra_agenda_entrevista(v_edital, v_regra, 0, null);
    raise exception 'FALHOU E4: leitor salvou a regra';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.salvar_agenda_entrevista(v_edital, jsonb_build_object('acao', 'GERAR', 'itens', v_itens, 'versao_regra', 1));
    raise exception 'FALHOU E4: leitor salvou a agenda';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'ok E4.1: leitor lê e não salva regra nem agenda (42501)';

  -- Outro (sem a área): nem lê.
  perform set_config('request.jwt.claims', c_outro, true);
  begin
    perform public.obter_agenda_entrevista(v_edital);
    raise exception 'FALHOU E4: sem a área leu a agenda';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'ok E4.2: sem a área do edital não lê (42501)';

  -- Gestor: regra v1, v2 só com motivo, concorrência.
  perform set_config('request.jwt.claims', c_gestor, true);
  begin
    perform public.salvar_agenda_entrevista(v_edital, jsonb_build_object('acao', 'GERAR', 'itens', v_itens, 'versao_regra', 1));
    raise exception 'FALHOU E4: gerou sem regra';
  exception when sqlstate '22023' then null;
  end;
  v := public.salvar_regra_agenda_entrevista(v_edital, v_regra, 0, null);
  if (v->>'versao')::int <> 1 then raise exception 'FALHOU E4: regra versão 1'; end if;
  begin
    perform public.salvar_regra_agenda_entrevista(v_edital, v_regra, 1, null);
    raise exception 'FALHOU E4: versão 2 sem motivo';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.salvar_regra_agenda_entrevista(v_edital, v_regra, 0, 'tentativa velha');
    raise exception 'FALHOU E4: versão velha da regra passou';
  exception when sqlstate '40001' then null;
  end;
  begin
    perform public.salvar_regra_agenda_entrevista(v_edital, v_regra || '{"bancas":0}', 1, 'Banca zerada');
    raise exception 'FALHOU E4: regra inválida passou';
  exception when sqlstate '22023' then null;
  end;
  v := public.salvar_regra_agenda_entrevista(v_edital, v_regra || '{"intervalo_min":0}', 1, 'Sem intervalo entre entrevistas');
  if (v->>'versao')::int <> 2 or json_array_length(v->'versoes') <> 2 then raise exception 'FALHOU E4: regra versão 2'; end if;
  raise notice 'ok E4.3: regra v1 e v2 (motivo obrigatório, 40001 na versão velha, 22023 na inválida)';

  -- Gerar: a versão vigente; conflitos e candidatos de fora recusados.
  begin
    perform public.salvar_agenda_entrevista(v_edital, jsonb_build_object('acao', 'GERAR', 'itens', v_itens, 'versao_regra', 1));
    raise exception 'FALHOU E4: agenda com regra velha';
  exception when sqlstate '40001' then null;
  end;
  begin
    perform public.salvar_agenda_entrevista(v_edital, jsonb_build_object('acao', 'GERAR', 'versao_regra', 2,
      'itens', v_itens || jsonb_build_array(jsonb_build_object('analise', v_ids[1], 'data', '2026-10-06', 'inicio', '08:00', 'fim', '08:30', 'banca', 1))));
    raise exception 'FALHOU E4: candidato repetido passou';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.salvar_agenda_entrevista(v_edital, jsonb_build_object('acao', 'GERAR', 'versao_regra', 2,
      'itens', jsonb_set(v_itens, '{2,inicio}', '"08:15"')));
    raise exception 'FALHOU E4: mesma banca com horário sobreposto passou';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.salvar_agenda_entrevista(v_edital, jsonb_build_object('acao', 'GERAR', 'versao_regra', 2,
      'itens', jsonb_set(v_itens, '{0,analise}', to_jsonb(gen_random_uuid()::text))));
    raise exception 'FALHOU E4: candidato de fora do edital passou';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.salvar_agenda_entrevista(v_edital, jsonb_build_object('acao', 'GERAR', 'versao_regra', 2,
      'itens', jsonb_set(v_itens, '{0,fim}', '"07:00"')));
    raise exception 'FALHOU E4: fim antes do início passou';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.salvar_agenda_entrevista(v_edital, jsonb_build_object('acao', 'GERAR', 'versao_regra', 2,
      'itens', jsonb_set(v_itens, '{0,data}', '"2026-02-30"')));
    raise exception 'FALHOU E4: dia inexistente passou';
  exception when sqlstate '22023' then null;
  end;
  v := public.salvar_agenda_entrevista(v_edital, jsonb_build_object('acao', 'GERAR', 'itens', v_itens, 'versao_regra', 2));
  if json_array_length(v->'itens') <> 3 or json_array_length(v->'historico') <> 1
     or v->'historico'->0->>'acao' <> 'GERAR' or (v->'historico'->0->>'alteracoes')::int <> 3
     or v->'itens'->0->>'inicio' <> '08:00' or (v->'itens'->0)::jsonb ? 'cpf' then
    raise exception 'FALHOU E4: agenda gerada %', v;
  end if;
  v_ultimo := v->>'ultimo_registro';
  raise notice 'ok E4.4: agenda gerada (3 horários), regra velha = 40001, repetido/sobreposto/de fora/horário inválido = 22023';

  -- Ajustar: tela desatualizada = 40001; troca de dois candidatos.
  begin
    perform public.salvar_agenda_entrevista(v_edital, jsonb_build_object('acao', 'AJUSTAR', 'itens', v_itens, 'versao_regra', 2));
    raise exception 'FALHOU E4: gravação sobre agenda desatualizada';
  exception when sqlstate '40001' then null;
  end;
  v_itens := jsonb_set(jsonb_set(v_itens, '{0,analise}', to_jsonb(v_ids[3])), '{2,analise}', to_jsonb(v_ids[1]));
  v_itens := jsonb_set(jsonb_set(v_itens, '{0,origem}', '"MANUAL"'), '{2,origem}', '"MANUAL"');
  v := public.salvar_agenda_entrevista(v_edital, jsonb_build_object('acao', 'AJUSTAR', 'itens', v_itens, 'versao_regra', 2,
         'ultimo_registro', v_ultimo, 'motivo', 'Troca pedida pela banca'));
  if json_array_length(v->'historico') <> 2 or (v->'historico'->0->>'alteracoes')::int <> 2
     or v->'historico'->0->>'motivo' <> 'Troca pedida pela banca' then
    raise exception 'FALHOU E4: ajuste %', v->'historico';
  end if;

  -- Leitor vê o ajuste.
  perform set_config('request.jwt.claims', c_leitor, true);
  v := public.obter_agenda_entrevista(v_edital);
  if (select count(*) from json_array_elements(v->'itens') i where i->>'origem' = 'MANUAL') <> 2
     or (v->'regra'->>'versao')::int <> 2 then
    raise exception 'FALHOU E4: leitura depois do ajuste';
  end if;
  raise notice 'ok E4.5: ajuste manual (troca) registrado com motivo; leitor vê 2 horários manuais';
end;
$$;

-- E5. Ninguém acessa as tabelas direto.
do $$
begin
  begin
    perform 1 from public."TB_AGENDA_ENTREVISTA" limit 1;
    raise exception 'FALHOU E5: authenticated leu a tabela';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public."TH_AGENDA_ENTREVISTA";
    raise exception 'FALHOU E5: authenticated apagou o histórico';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok E5: tabelas sem acesso direto (só as funções)';
end;
$$;

-- Volta ao papel do SQL Editor antes de ler as tabelas sem grant.
reset role;
select set_config('request.jwt.claims', '', true);

-- E6. O histórico guardou o antes e o depois.
do $$
declare
  v_edital uuid := current_setting('ensaio.edital')::uuid;
begin
  if (select count(*) from public."TH_AGENDA_ENTREVISTA" where "CO_MONITORAMENTO" = v_edital) <> 2 then
    raise exception 'FALHOU E6: duas gravações no histórico';
  end if;
  if not exists (select 1 from public."TH_AGENDA_ENTREVISTA" h, jsonb_array_elements(h."DS_ALTERACAO") a
                  where h."CO_MONITORAMENTO" = v_edital and h."TP_ACAO" = 'AJUSTAR'
                    and a -> 'antes' ->> 'inicio' = '08:00' and a -> 'depois' ->> 'inicio' = '08:40') then
    raise exception 'FALHOU E6: alteração sem antes e depois';
  end if;
  if (select count(*) from public."TB_AGENDA_ENTREVISTA" where "CO_MONITORAMENTO" = v_edital and "TP_ORIGEM" = 'MANUAL') <> 2 then
    raise exception 'FALHOU E6: origem MANUAL';
  end if;
  raise notice 'ok E6: histórico com antes e depois de cada troca';
end;
$$;

-- Resumo (o que o ensaio gravou, antes do rollback).
select
  'ENSAIO OK' as resultado,
  (select count(*) from public."TH_REGRA_AGENDA_ENTREVISTA" h join public."TB_REGRA_AGENDA_ENTREVISTA" r using ("CO_REGRA_AGENDA")
    where r."CO_MONITORAMENTO" = current_setting('ensaio.edital')::uuid) as versoes_da_regra,
  (select count(*) from public."TB_AGENDA_ENTREVISTA" where "CO_MONITORAMENTO" = current_setting('ensaio.edital')::uuid) as horarios,
  (select count(*) from public."TB_AGENDA_ENTREVISTA" where "CO_MONITORAMENTO" = current_setting('ensaio.edital')::uuid and "TP_ORIGEM" = 'MANUAL') as manuais,
  (select count(*) from public."TH_AGENDA_ENTREVISTA" where "CO_MONITORAMENTO" = current_setting('ensaio.edital')::uuid) as gravacoes;

rollback;
