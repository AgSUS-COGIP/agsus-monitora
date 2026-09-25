/*
  ÁREAS DO SISTEMA (etapa 3 de docs/arquitetura.md)

  O MONITORA passa a atender Saúde Indígena, SEDE e Projetos. Até aqui a área
  não existia no banco: o front decidia com `ehEditalDaSaudeIndigena`
  (responsável CORES ou unidade do CORES = não é Saúde Indígena).

  O QUE ENTRA
    - public."TB_AREA": as áreas. `NO_GRUPO_PLANILHA` é o valor que a planilha
      manda na coluna `grupo` das análises ("Saúde Indígena", "SEDE", "Projetos").
    - public."TA_UNIDADE_AREA": a área de cada unidade do CORES (não estão em
      TD_UNIDADE). Unidade fora desta tabela e responsável que não é CORES =
      Saúde Indígena, a mesma regra do front hoje.
    - "CO_AREA" em TB_MONITORAMENTO_INDIGENA (o edital: fonte da área; lista de
      aprovados, convocação, vagas e cronograma herdam dele) e em
      TB_ANALISE_CURRICULAR (vem do `grupo` da planilha).
    - Gatilhos que preenchem "CO_AREA" sozinhos: o front e o Apps Script não
      mudam nada.

  DECISÕES (25/09/2026, responsável pelo sistema)
    SEDE, Escritório Distrital e Regional, CCE (provisório)        -> sede
    Caminhoneiros, Saúde nas Fronteiras, MFC, Rio Doce             -> projetos

  POR QUE OS GATILHOS SÃO DESLIGADOS NO PREENCHIMENTO
    O UPDATE de preenchimento dispararia:
      - trg_historico_monitoramento: 134 registros falsos em TH_MONITORAMENTO;
      - set_updated_at: "atualizado em" de todas as linhas mudaria (nas análises
        é o que a sincronização incremental compara);
      - trg_bloquear_importacao_analises_configurada: devolve NULL para editais
        bloqueados, e essas linhas ficariam sem área.
    Eles são desligados só dentro desta transação e religados no fim.

  "CO_AREA" do edital é NOT NULL: o gatilho sempre sabe a área. Nas análises é
  nulo quando o `grupo` não é de área conhecida — a sincronização nunca falha
  por causa da área.

  ROLLBACK
    begin;
    drop trigger "TBA_ANALISE_CURRICULAR" on public."TB_ANALISE_CURRICULAR";
    drop trigger "TBA_MONITORAMENTO_INDIGENA" on public."TB_MONITORAMENTO_INDIGENA";
    drop function private."FC_DEFINIR_AREA_ANALISE"();
    drop function private."FC_DEFINIR_AREA_EDITAL"();
    drop function private."FC_AREA_EDITAL"(text, text);
    alter table public."TB_ANALISE_CURRICULAR" drop column "CO_AREA";
    alter table public."TB_MONITORAMENTO_INDIGENA" drop column "CO_AREA";
    drop table public."TA_UNIDADE_AREA";
    drop table public."TB_AREA";
    commit;
*/
begin;

-- Áreas ----------------------------------------------------------------------
create table public."TB_AREA" (
  "CO_AREA" text not null,
  "NO_AREA" text not null,
  "NO_GRUPO_PLANILHA" text not null,
  "NU_ORDEM" smallint not null,
  constraint "PK_TB_AREA" primary key ("CO_AREA"),
  constraint "UK_AREA_GRUPOPLANILHA" unique ("NO_GRUPO_PLANILHA"),
  constraint "CK_AREA_COAREA" check ("CO_AREA" ~ '^[a-z]+(-[a-z]+)*$')
);
comment on table public."TB_AREA" is
  'Áreas atendidas pelo MONITORA. CO_AREA vai no endereço das telas (/saude-indigena/analises).';
comment on column public."TB_AREA"."NO_GRUPO_PLANILHA" is
  'Valor da coluna grupo nas planilhas de análise curricular desta área.';

comment on column public."TB_AREA"."CO_AREA" is 'Código da área (saude-indigena, sede, projetos); usado nas rotas do front.';
comment on column public."TB_AREA"."NO_AREA" is 'Nome da área como aparece na tela.';
comment on column public."TB_AREA"."NU_ORDEM" is 'Ordem de exibição no menu.';

insert into public."TB_AREA" ("CO_AREA", "NO_AREA", "NO_GRUPO_PLANILHA", "NU_ORDEM") values
  ('saude-indigena', 'Saúde Indígena', 'Saúde Indígena', 1),
  ('sede', 'SEDE', 'SEDE', 2),
  ('projetos', 'Projetos', 'Projetos', 3);

-- Unidades do CORES -> área -----------------------------------------------------
create table public."TA_UNIDADE_AREA" (
  "NO_UNIDADE" text not null,
  "CO_AREA" text not null,
  constraint "PK_TA_UNIDADE_AREA" primary key ("NO_UNIDADE"),
  constraint "FK_AREA_UNIDADE_AREA" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA")
);
comment on table public."TA_UNIDADE_AREA" is
  'Área de cada unidade do CORES (UNIDADES_CORES em src/lib/responsavel-do-edital.js). Unidades da USI não entram: são Saúde Indígena.';

comment on column public."TA_UNIDADE_AREA"."NO_UNIDADE" is 'Nome da unidade do CORES como gravado em TB_MONITORAMENTO_INDIGENA.unidade.';
comment on column public."TA_UNIDADE_AREA"."CO_AREA" is 'Área da unidade (TB_AREA).';

insert into public."TA_UNIDADE_AREA" ("NO_UNIDADE", "CO_AREA") values
  ('SEDE', 'sede'),
  ('Escritório Distrital e Regional', 'sede'),
  ('CCE', 'sede'),
  ('Projeto Agora Tem Especialistas Caminhoneiros', 'projetos'),
  ('Saúde nas Fronteiras', 'projetos'),
  ('MFC', 'projetos'),
  ('Rio Doce', 'projetos');

alter table public."TB_AREA" enable row level security;
alter table public."TA_UNIDADE_AREA" enable row level security;
create policy "PL_AREA_LEITURA" on public."TB_AREA" for select to authenticated using (true);
create policy "PL_UNIDADE_AREA_LEITURA" on public."TA_UNIDADE_AREA" for select to authenticated using (true);
revoke all on public."TB_AREA", public."TA_UNIDADE_AREA" from public, anon, authenticated;
grant select on public."TB_AREA", public."TA_UNIDADE_AREA" to authenticated;

-- Regra da área do edital ----------------------------------------------------------
create function private."FC_AREA_EDITAL"(p_responsavel text, p_unidade text)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    (select r."CO_AREA" from public."TA_UNIDADE_AREA" r
      where public.analises_norm_key(r."NO_UNIDADE") = public.analises_norm_key(p_unidade)),
    case when upper(trim(coalesce(p_responsavel, ''))) = 'CORES' then 'sede' else 'saude-indigena' end
  );
$$;
comment on function private."FC_AREA_EDITAL"(text, text) is
  'Área de um edital: unidade do CORES -> TA_UNIDADE_AREA; responsável CORES sem unidade conhecida -> sede; o resto -> saude-indigena.';
revoke all on function private."FC_AREA_EDITAL"(text, text) from public, anon, authenticated;

create function private."FC_DEFINIR_AREA_EDITAL"()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  new."CO_AREA" := private."FC_AREA_EDITAL"(new.responsavel, new.unidade);
  return new;
end;
$$;
revoke all on function private."FC_DEFINIR_AREA_EDITAL"() from public, anon, authenticated;

create function private."FC_DEFINIR_AREA_ANALISE"()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  select a."CO_AREA" into new."CO_AREA"
    from public."TB_AREA" a
   where public.analises_norm_key(a."NO_GRUPO_PLANILHA") = public.analises_norm_key(new.grupo);
  return new;
end;
$$;
revoke all on function private."FC_DEFINIR_AREA_ANALISE"() from public, anon, authenticated;

-- Colunas e preenchimento ---------------------------------------------------------------
alter table public."TB_MONITORAMENTO_INDIGENA" add column "CO_AREA" text;
alter table public."TB_ANALISE_CURRICULAR" add column "CO_AREA" text;

alter table public."TB_MONITORAMENTO_INDIGENA" disable trigger trg_historico_monitoramento;
alter table public."TB_MONITORAMENTO_INDIGENA" disable trigger trg_monitoramento_indigena_updated_at;
alter table public."TB_ANALISE_CURRICULAR" disable trigger trg_analises_curriculares_updated_at;
alter table public."TB_ANALISE_CURRICULAR" disable trigger trg_bloquear_importacao_analises_configurada;

update public."TB_MONITORAMENTO_INDIGENA"
   set "CO_AREA" = private."FC_AREA_EDITAL"(responsavel, unidade);

update public."TB_ANALISE_CURRICULAR" c
   set "CO_AREA" = a."CO_AREA"
  from public."TB_AREA" a
 where public.analises_norm_key(a."NO_GRUPO_PLANILHA") = public.analises_norm_key(c.grupo);

alter table public."TB_MONITORAMENTO_INDIGENA" enable trigger trg_historico_monitoramento;
alter table public."TB_MONITORAMENTO_INDIGENA" enable trigger trg_monitoramento_indigena_updated_at;
alter table public."TB_ANALISE_CURRICULAR" enable trigger trg_analises_curriculares_updated_at;
alter table public."TB_ANALISE_CURRICULAR" enable trigger trg_bloquear_importacao_analises_configurada;

alter table public."TB_MONITORAMENTO_INDIGENA"
  alter column "CO_AREA" set not null,
  add constraint "FK_AREA_MONITORAMENTO_INDIG" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA");
alter table public."TB_ANALISE_CURRICULAR"
  add constraint "FK_AREA_ANALISE_CURRICULAR" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA");

create index "IN_FKMONITORAMENTOINDIG_COAREA" on public."TB_MONITORAMENTO_INDIGENA" ("CO_AREA");
create index "IN_FKANALISECURRICULAR_COAREA" on public."TB_ANALISE_CURRICULAR" ("CO_AREA");

comment on column public."TB_MONITORAMENTO_INDIGENA"."CO_AREA" is
  'Área do edital, calculada por private."FC_AREA_EDITAL" (gatilho "TBA_MONITORAMENTO_INDIGENA").';
comment on column public."TB_ANALISE_CURRICULAR"."CO_AREA" is
  'Área da análise, a partir do grupo da planilha (TB_AREA.NO_GRUPO_PLANILHA). Nulo se o grupo não for de área conhecida.';

-- Gatilhos a partir de agora -----------------------------------------------------------
create trigger "TBA_MONITORAMENTO_INDIGENA"
  before insert or update of responsavel, unidade, "CO_AREA" on public."TB_MONITORAMENTO_INDIGENA"
  for each row execute function private."FC_DEFINIR_AREA_EDITAL"();

create trigger "TBA_ANALISE_CURRICULAR"
  before insert or update of grupo, "CO_AREA" on public."TB_ANALISE_CURRICULAR"
  for each row execute function private."FC_DEFINIR_AREA_ANALISE"();

commit;
