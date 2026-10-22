/*
  ENTREVISTAS NO MONITORA (FASE 2, PARTE 1): ROTEIROS, CONVOCADOS E NOTAS

  Até aqui a entrevista era feita numa planilha por vaga e só o resultado vinha
  para o banco (TB_ENTREVISTA com TP_ORIGEM 'planilha'). Agora a entrevista
  pode ser conduzida no sistema. Levantado com o usuário e nos editais
  100/2026 (CASAI Brasília), 105/2026 (DSEI Litoral Sul), 110/2026 (DSEI Porto
  Velho) e 93/2026 (SESMT, Projetos), em 30/09/2026.

  DUAS CAMADAS
    Roteiro (modelo reutilizável, com versões) — competências, escala das
    notas, regra de aprovação e desempate. O mesmo roteiro serve a vários
    editais (100, 105 e 110 usam o "Saúde Indígena 2026").
    Configuração do edital — o roteiro escolhido (versão exata), a regra de
    convocação (N× as vagas imediatas, até a posição X do cadastro reserva,
    exceções por cargo como Enfermagem 10×/20ª), a composição da banca e
    quem lança as notas. Vem pré-preenchida pelo roteiro.

  TABELAS
    TB_ROTEIRO_ENTREVISTA     o roteiro (cada edição grava uma versão nova)
    TB_ROTEIRO_COMPETENCIA    competências: nota máxima por avaliador, peso
                              (ex.: 1,5 = "+50%"), mínimo (valor ou %),
                              individual ou em grupo (estudo de caso)
    TB_ROTEIRO_NIVEL          níveis descritos da escala (0 Inexistente …
                              5 Excelente), quando a escala é por níveis
    TB_ENTREVISTA_EDITAL      configuração da entrevista de um edital
    TB_ENTREVISTA_VAGA        vagas imediatas por vaga (para a convocação)
    TB_ENTREVISTA_AVALIADOR   membros da banca do edital (nome, origem, banca)
    TB_ENTREVISTA_AVALIACAO   nota de um avaliador numa competência
    TH_ENTREVISTA_AVALIACAO   histórico de cada nota lançada ou corrigida
    TB_ENTREVISTA             ganha CO_ROTEIRO e NU_BANCA; o convocado no
                              sistema é uma linha com TP_ORIGEM 'sistema'.
                              A nota por competência (média × peso) vai para
                              TB_ENTREVISTA_NOTA, que o painel já lê.

  CÁLCULO (private."FC_CALCULAR_ENTREVISTA")
    competência = média das notas dos avaliadores × peso; total = soma.
    APTO: compareceu, total >= mínimo do roteiro, cada competência >= seu
    mínimo e nenhuma com nota eliminatória. Faltou (e ausência elimina) =
    INAPTO. Faltando nota = SEM_PARECER.

  PERMISSÃO
    Ler: 'entrevistas' >= leitor, área e recorte da coordenação. Gravar
    (roteiros, configuração, convocação, notas): >= editor e o edital.
    Lançamento 'AVALIADOR': cada avaliador só lança a própria nota (o membro
    da banca ligado ao seu perfil); administrador global lança por qualquer.

  Rollback: supabase/rollback/20260930220000_entrevistas_roteiros_e_notas.sql
*/
begin;

-- 1. Roteiro ---------------------------------------------------------------------------
create table public."TB_ROTEIRO_ENTREVISTA" (
  "CO_ROTEIRO" uuid not null default gen_random_uuid(),
  "CO_ROTEIRO_ORIGEM" uuid not null,
  "NU_VERSAO" integer not null default 1,
  "CO_AREA" text,
  "NO_ROTEIRO" text not null,
  "DS_DESCRICAO" text,
  "NO_ETAPA" text not null default 'Entrevista',
  "TP_ESCALA" text not null default 'FAIXA',
  "VL_PASSO" numeric(4,2) not null default 0.5,
  "DS_NOTAS_PERMITIDAS" jsonb not null default '[]'::jsonb,
  "VL_NOTA_MINIMA_TOTAL" numeric(6,2),
  "DS_NOTAS_ELIMINATORIAS" jsonb not null default '[]'::jsonb,
  "ST_AUSENCIA_ELIMINA" varchar(1) not null default 'S',
  "DS_DESEMPATE" jsonb not null default '[]'::jsonb,
  "ST_SOMA_ANALISE" varchar(1) not null default 'S',
  "DS_CONVOCACAO_PADRAO" jsonb not null default '{}'::jsonb,
  "DS_BANCA_PADRAO" jsonb not null default '[]'::jsonb,
  "ST_ATIVO" varchar(1) not null default 'S',
  "DT_CRIACAO" timestamptz not null default now(),
  "CO_USUARIO_CRIACAO" uuid,
  constraint "PK_TB_ROTEIRO_ENTREVISTA" primary key ("CO_ROTEIRO"),
  constraint "UK_ROTEIROENTREVISTA_VERSAO" unique ("CO_ROTEIRO_ORIGEM", "NU_VERSAO"),
  constraint "FK_AREA_ROTEIROENTREVISTA" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA"),
  constraint "CK_ROTEIROENTREVISTA_TPESCALA" check ("TP_ESCALA" in ('FAIXA', 'LISTA', 'NIVEIS')),
  constraint "CK_ROTEIROENTREVISTA_VLPASSO" check ("VL_PASSO" > 0 and "VL_PASSO" <= 5),
  constraint "CK_ROTEIROENTREVISTA_STAUSENCIA" check ("ST_AUSENCIA_ELIMINA" in ('S', 'N')),
  constraint "CK_ROTEIROENTREVISTA_STSOMA" check ("ST_SOMA_ANALISE" in ('S', 'N')),
  constraint "CK_ROTEIROENTREVISTA_STATIVO" check ("ST_ATIVO" in ('S', 'N')),
  constraint "CK_ROTEIROENTREVISTA_JSON" check (
    jsonb_typeof("DS_NOTAS_PERMITIDAS") = 'array' and jsonb_typeof("DS_NOTAS_ELIMINATORIAS") = 'array'
    and jsonb_typeof("DS_DESEMPATE") = 'array' and jsonb_typeof("DS_CONVOCACAO_PADRAO") = 'object'
    and jsonb_typeof("DS_BANCA_PADRAO") = 'array'),
  constraint "CK_ROTEIROENTREVISTA_TAMANHOS" check (
    length("NO_ROTEIRO") between 3 and 150 and length("NO_ETAPA") between 3 and 80
    and coalesce(length("DS_DESCRICAO"), 0) <= 2000)
);
comment on table public."TB_ROTEIRO_ENTREVISTA" is 'Roteiro de entrevista (modelo reutilizável por edital): competências, escala, aprovação e desempate. Editar grava uma versão nova (CO_ROTEIRO_ORIGEM + NU_VERSAO); o edital aponta para a versão exata.';
comment on column public."TB_ROTEIRO_ENTREVISTA"."CO_ROTEIRO" is 'Identificador desta versão do roteiro.';
comment on column public."TB_ROTEIRO_ENTREVISTA"."CO_ROTEIRO_ORIGEM" is 'Roteiro de origem (a primeira versão); agrupa as versões.';
comment on column public."TB_ROTEIRO_ENTREVISTA"."NU_VERSAO" is 'Número da versão (1, 2, …).';
comment on column public."TB_ROTEIRO_ENTREVISTA"."CO_AREA" is 'Área a que o roteiro se destina (nulo = qualquer área).';
comment on column public."TB_ROTEIRO_ENTREVISTA"."NO_ROTEIRO" is 'Nome do roteiro.';
comment on column public."TB_ROTEIRO_ENTREVISTA"."DS_DESCRICAO" is 'Descrição / referência ao edital.';
comment on column public."TB_ROTEIRO_ENTREVISTA"."NO_ETAPA" is 'Nome da etapa no edital (Entrevista, Análise Comportamental…).';
comment on column public."TB_ROTEIRO_ENTREVISTA"."TP_ESCALA" is 'FAIXA (0 até o máximo, de VL_PASSO em VL_PASSO), LISTA (DS_NOTAS_PERMITIDAS) ou NIVEIS (TB_ROTEIRO_NIVEL).';
comment on column public."TB_ROTEIRO_ENTREVISTA"."VL_PASSO" is 'Passo das notas na escala FAIXA (ex.: 0,5).';
comment on column public."TB_ROTEIRO_ENTREVISTA"."DS_NOTAS_PERMITIDAS" is 'Notas aceitas na escala LISTA (array de números).';
comment on column public."TB_ROTEIRO_ENTREVISTA"."VL_NOTA_MINIMA_TOTAL" is 'Nota total mínima para ser apto (nulo = sem mínimo).';
comment on column public."TB_ROTEIRO_ENTREVISTA"."DS_NOTAS_ELIMINATORIAS" is 'Notas de competência (média) que eliminam, ex.: [0, 1].';
comment on column public."TB_ROTEIRO_ENTREVISTA"."ST_AUSENCIA_ELIMINA" is 'S: faltar elimina.';
comment on column public."TB_ROTEIRO_ENTREVISTA"."DS_DESEMPATE" is 'Critérios de desempate do resultado final, em ordem (array de textos).';
comment on column public."TB_ROTEIRO_ENTREVISTA"."ST_SOMA_ANALISE" is 'S: nota final = análise curricular + entrevista.';
comment on column public."TB_ROTEIRO_ENTREVISTA"."DS_CONVOCACAO_PADRAO" is 'Regra de convocação sugerida ao edital: {multiplo_imediatas, posicao_cadastro_reserva, excecoes:[{termo_cargo, multiplo_imediatas, posicao_cadastro_reserva}]}.';
comment on column public."TB_ROTEIRO_ENTREVISTA"."DS_BANCA_PADRAO" is 'Composição da banca sugerida ao edital: [{origem, quantidade}].';
comment on column public."TB_ROTEIRO_ENTREVISTA"."ST_ATIVO" is 'S: versão em uso / oferecida; N: substituída ou arquivada.';
comment on column public."TB_ROTEIRO_ENTREVISTA"."DT_CRIACAO" is 'Quando a versão foi criada.';
comment on column public."TB_ROTEIRO_ENTREVISTA"."CO_USUARIO_CRIACAO" is 'Quem criou a versão (auth.users.id).';
comment on constraint "UK_ROTEIROENTREVISTA_VERSAO" on public."TB_ROTEIRO_ENTREVISTA" is 'Uma linha por versão.';
comment on constraint "FK_AREA_ROTEIROENTREVISTA" on public."TB_ROTEIRO_ENTREVISTA" is 'Área do roteiro.';
comment on constraint "CK_ROTEIROENTREVISTA_TPESCALA" on public."TB_ROTEIRO_ENTREVISTA" is 'Escalas válidas.';
comment on constraint "CK_ROTEIROENTREVISTA_VLPASSO" on public."TB_ROTEIRO_ENTREVISTA" is 'Passo entre 0 e 5.';
comment on constraint "CK_ROTEIROENTREVISTA_STAUSENCIA" on public."TB_ROTEIRO_ENTREVISTA" is 'Flag S/N.';
comment on constraint "CK_ROTEIROENTREVISTA_STSOMA" on public."TB_ROTEIRO_ENTREVISTA" is 'Flag S/N.';
comment on constraint "CK_ROTEIROENTREVISTA_STATIVO" on public."TB_ROTEIRO_ENTREVISTA" is 'Flag S/N.';
comment on constraint "CK_ROTEIROENTREVISTA_JSON" on public."TB_ROTEIRO_ENTREVISTA" is 'Formatos dos campos json.';
comment on constraint "CK_ROTEIROENTREVISTA_TAMANHOS" on public."TB_ROTEIRO_ENTREVISTA" is 'Limites de tamanho dos textos.';

create table public."TB_ROTEIRO_COMPETENCIA" (
  "CO_COMPETENCIA" uuid not null default gen_random_uuid(),
  "CO_ROTEIRO" uuid not null,
  "NU_ORDEM" smallint not null,
  "NO_COMPETENCIA" text not null,
  "DS_DESCRICAO" text,
  "VL_NOTA_MAXIMA" numeric(5,2) not null,
  "VL_PESO" numeric(5,2) not null default 1,
  "VL_MINIMO" numeric(6,2),
  "TP_MINIMO" text not null default 'VALOR',
  "TP_AVALIACAO" text not null default 'INDIVIDUAL',
  constraint "PK_TB_ROTEIRO_COMPETENCIA" primary key ("CO_COMPETENCIA"),
  constraint "UK_ROTEIROCOMPETENCIA_ORDEM" unique ("CO_ROTEIRO", "NU_ORDEM"),
  constraint "FK_ROTEIRO_ROTEIROCOMPETENCIA" foreign key ("CO_ROTEIRO") references public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO"),
  constraint "CK_ROTEIROCOMPETENCIA_NOTAS" check ("VL_NOTA_MAXIMA" > 0 and "VL_NOTA_MAXIMA" <= 100 and "VL_PESO" > 0 and "VL_PESO" <= 10),
  constraint "CK_ROTEIROCOMPETENCIA_TPMINIMO" check ("TP_MINIMO" in ('VALOR', 'PERCENTUAL')),
  constraint "CK_ROTEIROCOMPETENCIA_TPAVALIACAO" check ("TP_AVALIACAO" in ('INDIVIDUAL', 'GRUPO')),
  constraint "CK_ROTEIROCOMPETENCIA_TAMANHOS" check (length("NO_COMPETENCIA") between 2 and 200 and coalesce(length("DS_DESCRICAO"), 0) <= 3000)
);
comment on table public."TB_ROTEIRO_COMPETENCIA" is 'Competências de um roteiro de entrevista.';
comment on column public."TB_ROTEIRO_COMPETENCIA"."CO_COMPETENCIA" is 'Identificador da competência.';
comment on column public."TB_ROTEIRO_COMPETENCIA"."CO_ROTEIRO" is 'Versão do roteiro (TB_ROTEIRO_ENTREVISTA).';
comment on column public."TB_ROTEIRO_COMPETENCIA"."NU_ORDEM" is 'Ordem na ficha.';
comment on column public."TB_ROTEIRO_COMPETENCIA"."NO_COMPETENCIA" is 'Nome da competência.';
comment on column public."TB_ROTEIRO_COMPETENCIA"."DS_DESCRICAO" is 'O que se avalia (texto do edital).';
comment on column public."TB_ROTEIRO_COMPETENCIA"."VL_NOTA_MAXIMA" is 'Nota máxima que cada avaliador dá (ex.: 5 ou 2).';
comment on column public."TB_ROTEIRO_COMPETENCIA"."VL_PESO" is 'Multiplicador da média (1 = normal; 1,5 = "+50%").';
comment on column public."TB_ROTEIRO_COMPETENCIA"."VL_MINIMO" is 'Mínimo da competência para ser apto (nulo = sem mínimo).';
comment on column public."TB_ROTEIRO_COMPETENCIA"."TP_MINIMO" is 'VALOR (pontos) ou PERCENTUAL (da nota máxima × peso).';
comment on column public."TB_ROTEIRO_COMPETENCIA"."TP_AVALIACAO" is 'INDIVIDUAL ou GRUPO (estudo de caso coletivo).';
comment on constraint "UK_ROTEIROCOMPETENCIA_ORDEM" on public."TB_ROTEIRO_COMPETENCIA" is 'Uma competência por posição.';
comment on constraint "FK_ROTEIRO_ROTEIROCOMPETENCIA" on public."TB_ROTEIRO_COMPETENCIA" is 'Roteiro da competência.';
comment on constraint "CK_ROTEIROCOMPETENCIA_NOTAS" on public."TB_ROTEIRO_COMPETENCIA" is 'Faixas válidas de nota e peso.';
comment on constraint "CK_ROTEIROCOMPETENCIA_TPMINIMO" on public."TB_ROTEIRO_COMPETENCIA" is 'Tipos de mínimo.';
comment on constraint "CK_ROTEIROCOMPETENCIA_TPAVALIACAO" on public."TB_ROTEIRO_COMPETENCIA" is 'Individual ou em grupo.';
comment on constraint "CK_ROTEIROCOMPETENCIA_TAMANHOS" on public."TB_ROTEIRO_COMPETENCIA" is 'Limites de tamanho.';

create table public."TB_ROTEIRO_NIVEL" (
  "CO_ROTEIRO" uuid not null,
  "VL_NOTA" numeric(5,2) not null,
  "NO_NIVEL" text not null,
  "DS_DESCRICAO" text,
  constraint "PK_TB_ROTEIRO_NIVEL" primary key ("CO_ROTEIRO", "VL_NOTA"),
  constraint "FK_ROTEIRO_ROTEIRONIVEL" foreign key ("CO_ROTEIRO") references public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO"),
  constraint "CK_ROTEIRONIVEL_TAMANHOS" check (length("NO_NIVEL") between 2 and 80 and coalesce(length("DS_DESCRICAO"), 0) <= 1000)
);
comment on table public."TB_ROTEIRO_NIVEL" is 'Níveis descritos da escala (escala NIVEIS): a nota e o que ela significa, mostrados ao avaliador.';
comment on column public."TB_ROTEIRO_NIVEL"."CO_ROTEIRO" is 'Versão do roteiro.';
comment on column public."TB_ROTEIRO_NIVEL"."VL_NOTA" is 'Nota do nível.';
comment on column public."TB_ROTEIRO_NIVEL"."NO_NIVEL" is 'Nome do nível (ex.: Satisfatório).';
comment on column public."TB_ROTEIRO_NIVEL"."DS_DESCRICAO" is 'Parâmetros observados (texto do edital).';
comment on constraint "FK_ROTEIRO_ROTEIRONIVEL" on public."TB_ROTEIRO_NIVEL" is 'Roteiro do nível.';
comment on constraint "CK_ROTEIRONIVEL_TAMANHOS" on public."TB_ROTEIRO_NIVEL" is 'Limites de tamanho.';

-- 2. Configuração do edital -------------------------------------------------------------
create table public."TB_ENTREVISTA_EDITAL" (
  "CO_MONITORAMENTO" uuid not null,
  "CO_ROTEIRO" uuid not null,
  "DS_CONVOCACAO" jsonb not null default '{}'::jsonb,
  "DS_BANCA" jsonb not null default '[]'::jsonb,
  "TP_LANCAMENTO" text not null default 'SECRETARIA',
  "DT_ATUALIZACAO" timestamptz not null default now(),
  "CO_USUARIO_ATUALIZACAO" uuid,
  constraint "PK_TB_ENTREVISTA_EDITAL" primary key ("CO_MONITORAMENTO"),
  constraint "FK_MONITORAMENTO_ENTREVISTAEDITAL" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_ROTEIRO_ENTREVISTAEDITAL" foreign key ("CO_ROTEIRO") references public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO"),
  constraint "CK_ENTREVISTAEDITAL_TPLANCAMENTO" check ("TP_LANCAMENTO" in ('AVALIADOR', 'SECRETARIA')),
  constraint "CK_ENTREVISTAEDITAL_JSON" check (jsonb_typeof("DS_CONVOCACAO") = 'object' and jsonb_typeof("DS_BANCA") = 'array')
);
comment on table public."TB_ENTREVISTA_EDITAL" is 'Configuração da entrevista de um edital: roteiro (versão exata), convocação, banca e quem lança as notas.';
comment on column public."TB_ENTREVISTA_EDITAL"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TB_ENTREVISTA_EDITAL"."CO_ROTEIRO" is 'Versão do roteiro usada neste edital.';
comment on column public."TB_ENTREVISTA_EDITAL"."DS_CONVOCACAO" is 'Regra de convocação deste edital (mesmo formato de DS_CONVOCACAO_PADRAO).';
comment on column public."TB_ENTREVISTA_EDITAL"."DS_BANCA" is 'Composição da banca deste edital: [{origem, quantidade}].';
comment on column public."TB_ENTREVISTA_EDITAL"."TP_LANCAMENTO" is 'AVALIADOR (cada um lança a sua nota) ou SECRETARIA (uma pessoa passa a limpo a ficha).';
comment on column public."TB_ENTREVISTA_EDITAL"."DT_ATUALIZACAO" is 'Última alteração.';
comment on column public."TB_ENTREVISTA_EDITAL"."CO_USUARIO_ATUALIZACAO" is 'Autor da última alteração.';
comment on constraint "FK_MONITORAMENTO_ENTREVISTAEDITAL" on public."TB_ENTREVISTA_EDITAL" is 'Edital configurado.';
comment on constraint "FK_ROTEIRO_ENTREVISTAEDITAL" on public."TB_ENTREVISTA_EDITAL" is 'Roteiro usado.';
comment on constraint "CK_ENTREVISTAEDITAL_TPLANCAMENTO" on public."TB_ENTREVISTA_EDITAL" is 'Modos de lançamento.';
comment on constraint "CK_ENTREVISTAEDITAL_JSON" on public."TB_ENTREVISTA_EDITAL" is 'Formatos json.';

create table public."TB_ENTREVISTA_VAGA" (
  "CO_MONITORAMENTO" uuid not null,
  "CO_VAGA" text not null,
  "QT_VAGA_IMEDIATA" integer not null default 0,
  constraint "PK_TB_ENTREVISTA_VAGA" primary key ("CO_MONITORAMENTO", "CO_VAGA"),
  constraint "FK_MONITORAMENTO_ENTREVISTAVAGA" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "CK_ENTREVISTAVAGA_QT" check ("QT_VAGA_IMEDIATA" between 0 and 999 and length("CO_VAGA") between 1 and 60)
);
comment on table public."TB_ENTREVISTA_VAGA" is 'Vagas de provimento imediato por vaga de um edital (0 = só cadastro reserva), para sugerir os convocados.';
comment on column public."TB_ENTREVISTA_VAGA"."CO_MONITORAMENTO" is 'Edital.';
comment on column public."TB_ENTREVISTA_VAGA"."CO_VAGA" is 'Código da vaga (codigo_vaga da análise).';
comment on column public."TB_ENTREVISTA_VAGA"."QT_VAGA_IMEDIATA" is 'Vagas de provimento imediato.';
comment on constraint "FK_MONITORAMENTO_ENTREVISTAVAGA" on public."TB_ENTREVISTA_VAGA" is 'Edital da vaga.';
comment on constraint "CK_ENTREVISTAVAGA_QT" on public."TB_ENTREVISTA_VAGA" is 'Quantidade válida.';

create table public."TB_ENTREVISTA_AVALIADOR" (
  "CO_AVALIADOR" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "NO_AVALIADOR" text not null,
  "NO_ORIGEM" text not null,
  "NU_BANCA" smallint not null default 1,
  "CO_PERFIL_USUARIO" uuid,
  "ST_ATIVO" varchar(1) not null default 'S',
  "DT_CRIACAO" timestamptz not null default now(),
  constraint "PK_TB_ENTREVISTA_AVALIADOR" primary key ("CO_AVALIADOR"),
  constraint "FK_MONITORAMENTO_ENTREVISTAAVALIADOR" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_PERFILUSUARIO_ENTREVISTAAVALIADOR" foreign key ("CO_PERFIL_USUARIO") references public."TB_PERFIL_USUARIO" (id),
  constraint "CK_ENTREVISTAAVALIADOR_STATIVO" check ("ST_ATIVO" in ('S', 'N')),
  constraint "CK_ENTREVISTAAVALIADOR_TAMANHOS" check (length("NO_AVALIADOR") between 2 and 150 and length("NO_ORIGEM") between 2 and 80 and "NU_BANCA" between 1 and 20)
);
comment on table public."TB_ENTREVISTA_AVALIADOR" is 'Membros da banca examinadora de um edital.';
comment on column public."TB_ENTREVISTA_AVALIADOR"."CO_AVALIADOR" is 'Identificador do membro.';
comment on column public."TB_ENTREVISTA_AVALIADOR"."CO_MONITORAMENTO" is 'Edital.';
comment on column public."TB_ENTREVISTA_AVALIADOR"."NO_AVALIADOR" is 'Nome do avaliador.';
comment on column public."TB_ENTREVISTA_AVALIADOR"."NO_ORIGEM" is 'Origem (AgSUS, CASAI, DSEI, CONDISI, CDHO…).';
comment on column public."TB_ENTREVISTA_AVALIADOR"."NU_BANCA" is 'Banca (1, 2… quando há bancas simultâneas).';
comment on column public."TB_ENTREVISTA_AVALIADOR"."CO_PERFIL_USUARIO" is 'Perfil no MONITORA do avaliador (quando ele mesmo lança as notas).';
comment on column public."TB_ENTREVISTA_AVALIADOR"."ST_ATIVO" is 'S: na banca; N: saiu (fica para o histórico das notas).';
comment on column public."TB_ENTREVISTA_AVALIADOR"."DT_CRIACAO" is 'Quando entrou na banca.';
comment on constraint "FK_MONITORAMENTO_ENTREVISTAAVALIADOR" on public."TB_ENTREVISTA_AVALIADOR" is 'Edital da banca.';
comment on constraint "FK_PERFILUSUARIO_ENTREVISTAAVALIADOR" on public."TB_ENTREVISTA_AVALIADOR" is 'Perfil do avaliador.';
comment on constraint "CK_ENTREVISTAAVALIADOR_STATIVO" on public."TB_ENTREVISTA_AVALIADOR" is 'Flag S/N.';
comment on constraint "CK_ENTREVISTAAVALIADOR_TAMANHOS" on public."TB_ENTREVISTA_AVALIADOR" is 'Limites.';

alter table public."TB_ENTREVISTA"
  add column "CO_ROTEIRO" uuid,
  add column "NU_BANCA" smallint,
  add constraint "FK_ROTEIRO_ENTREVISTA" foreign key ("CO_ROTEIRO") references public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO");
comment on column public."TB_ENTREVISTA"."CO_ROTEIRO" is 'Roteiro usado (entrevista feita no sistema).';
comment on column public."TB_ENTREVISTA"."NU_BANCA" is 'Banca que entrevistou (quando há bancas simultâneas).';
comment on constraint "FK_ROTEIRO_ENTREVISTA" on public."TB_ENTREVISTA" is 'Roteiro da entrevista.';

create table public."TB_ENTREVISTA_AVALIACAO" (
  "CO_ENTREVISTA" uuid not null,
  "CO_COMPETENCIA" uuid not null,
  "CO_AVALIADOR" uuid not null,
  "VL_NOTA" numeric(5,2) not null,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  "CO_USUARIO_ATUALIZACAO" uuid,
  constraint "PK_TB_ENTREVISTA_AVALIACAO" primary key ("CO_ENTREVISTA", "CO_COMPETENCIA", "CO_AVALIADOR"),
  constraint "FK_ENTREVISTA_ENTREVISTAAVALIACAO" foreign key ("CO_ENTREVISTA") references public."TB_ENTREVISTA" ("CO_ENTREVISTA"),
  constraint "FK_COMPETENCIA_ENTREVISTAAVALIACAO" foreign key ("CO_COMPETENCIA") references public."TB_ROTEIRO_COMPETENCIA" ("CO_COMPETENCIA"),
  constraint "FK_AVALIADOR_ENTREVISTAAVALIACAO" foreign key ("CO_AVALIADOR") references public."TB_ENTREVISTA_AVALIADOR" ("CO_AVALIADOR"),
  constraint "CK_ENTREVISTAAVALIACAO_VLNOTA" check ("VL_NOTA" >= 0)
);
comment on table public."TB_ENTREVISTA_AVALIACAO" is 'Nota de um avaliador numa competência de uma entrevista.';
comment on column public."TB_ENTREVISTA_AVALIACAO"."CO_ENTREVISTA" is 'Entrevista (TB_ENTREVISTA).';
comment on column public."TB_ENTREVISTA_AVALIACAO"."CO_COMPETENCIA" is 'Competência (TB_ROTEIRO_COMPETENCIA).';
comment on column public."TB_ENTREVISTA_AVALIACAO"."CO_AVALIADOR" is 'Membro da banca (TB_ENTREVISTA_AVALIADOR).';
comment on column public."TB_ENTREVISTA_AVALIACAO"."VL_NOTA" is 'Nota dada pelo avaliador.';
comment on column public."TB_ENTREVISTA_AVALIACAO"."DT_ATUALIZACAO" is 'Quando foi lançada ou corrigida.';
comment on column public."TB_ENTREVISTA_AVALIACAO"."CO_USUARIO_ATUALIZACAO" is 'Quem lançou (auth.users.id).';
comment on constraint "FK_ENTREVISTA_ENTREVISTAAVALIACAO" on public."TB_ENTREVISTA_AVALIACAO" is 'Entrevista da nota.';
comment on constraint "FK_COMPETENCIA_ENTREVISTAAVALIACAO" on public."TB_ENTREVISTA_AVALIACAO" is 'Competência da nota.';
comment on constraint "FK_AVALIADOR_ENTREVISTAAVALIACAO" on public."TB_ENTREVISTA_AVALIACAO" is 'Avaliador da nota.';
comment on constraint "CK_ENTREVISTAAVALIACAO_VLNOTA" on public."TB_ENTREVISTA_AVALIACAO" is 'Nota não negativa (o teto vem do roteiro).';

create table public."TH_ENTREVISTA_AVALIACAO" (
  "CO_HISTORICO_AVALIACAO" bigint generated always as identity,
  "CO_ENTREVISTA" uuid not null,
  "CO_COMPETENCIA" uuid,
  "CO_AVALIADOR" uuid,
  "DS_CAMPO" text not null,
  "DS_VALOR_ANTERIOR" text,
  "DS_VALOR_NOVO" text,
  "DT_ALTERACAO" timestamptz not null default now(),
  "CO_USUARIO" uuid,
  constraint "PK_TH_ENTREVISTA_AVALIACAO" primary key ("CO_HISTORICO_AVALIACAO"),
  constraint "FK_ENTREVISTA_HISTAVALIACAO" foreign key ("CO_ENTREVISTA") references public."TB_ENTREVISTA" ("CO_ENTREVISTA")
);
comment on table public."TH_ENTREVISTA_AVALIACAO" is 'Histórico (auditoria) das notas e do comparecimento lançados no sistema.';
comment on column public."TH_ENTREVISTA_AVALIACAO"."CO_HISTORICO_AVALIACAO" is 'Identificador do registro.';
comment on column public."TH_ENTREVISTA_AVALIACAO"."CO_ENTREVISTA" is 'Entrevista.';
comment on column public."TH_ENTREVISTA_AVALIACAO"."CO_COMPETENCIA" is 'Competência (nulo para comparecimento/convocação).';
comment on column public."TH_ENTREVISTA_AVALIACAO"."CO_AVALIADOR" is 'Avaliador (nulo para comparecimento/convocação).';
comment on column public."TH_ENTREVISTA_AVALIACAO"."DS_CAMPO" is 'nota, compareceu, convocacao ou desconvocacao.';
comment on column public."TH_ENTREVISTA_AVALIACAO"."DS_VALOR_ANTERIOR" is 'Valor antes.';
comment on column public."TH_ENTREVISTA_AVALIACAO"."DS_VALOR_NOVO" is 'Valor depois (ou motivo).';
comment on column public."TH_ENTREVISTA_AVALIACAO"."DT_ALTERACAO" is 'Quando.';
comment on column public."TH_ENTREVISTA_AVALIACAO"."CO_USUARIO" is 'Quem (auth.users.id).';
comment on constraint "FK_ENTREVISTA_HISTAVALIACAO" on public."TH_ENTREVISTA_AVALIACAO" is 'Entrevista do registro.';

create index "IN_FKROTEIROCOMPETENCIA_CO" on public."TB_ROTEIRO_COMPETENCIA" ("CO_ROTEIRO");
create index "IN_FKENTREVISTAAVALIADOR_CO" on public."TB_ENTREVISTA_AVALIADOR" ("CO_MONITORAMENTO");
create index "IN_FKENTREVISTAAVALIACAO_AV" on public."TB_ENTREVISTA_AVALIACAO" ("CO_AVALIADOR");
create index "IN_FKHISTAVALIACAO_CO" on public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DT_ALTERACAO" desc);
comment on index public."IN_FKROTEIROCOMPETENCIA_CO" is 'Competências por roteiro.';
comment on index public."IN_FKENTREVISTAAVALIADOR_CO" is 'Banca por edital.';
comment on index public."IN_FKENTREVISTAAVALIACAO_AV" is 'Notas por avaliador.';
comment on index public."IN_FKHISTAVALIACAO_CO" is 'Histórico por entrevista.';

alter table public."TB_ROTEIRO_ENTREVISTA" enable row level security;
alter table public."TB_ROTEIRO_COMPETENCIA" enable row level security;
alter table public."TB_ROTEIRO_NIVEL" enable row level security;
alter table public."TB_ENTREVISTA_EDITAL" enable row level security;
alter table public."TB_ENTREVISTA_VAGA" enable row level security;
alter table public."TB_ENTREVISTA_AVALIADOR" enable row level security;
alter table public."TB_ENTREVISTA_AVALIACAO" enable row level security;
alter table public."TH_ENTREVISTA_AVALIACAO" enable row level security;
revoke all on public."TB_ROTEIRO_ENTREVISTA", public."TB_ROTEIRO_COMPETENCIA", public."TB_ROTEIRO_NIVEL",
  public."TB_ENTREVISTA_EDITAL", public."TB_ENTREVISTA_VAGA", public."TB_ENTREVISTA_AVALIADOR",
  public."TB_ENTREVISTA_AVALIACAO", public."TH_ENTREVISTA_AVALIACAO" from public, anon, authenticated;

-- 3. Funções internas ---------------------------------------------------------------------
create function private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital uuid, p_minimo integer)
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
  if not private.pode_recurso('entrevistas', p_minimo) then
    raise exception 'Sem permissão para Entrevistas' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
  return v_area;
end;
$function$;
comment on function private."FC_EXIGIR_ENTREVISTAS_EDITAL"(uuid, integer) is 'Barra quem não tem entrevistas no nível pedido (1 leitor, 2 editor) ou não tem a área/edital; devolve a área do edital.';
revoke all on function private."FC_EXIGIR_ENTREVISTAS_EDITAL"(uuid, integer) from public, anon, authenticated;

create function private."FC_CALCULAR_ENTREVISTA"(p_entrevista uuid)
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
  v_falta boolean := false;
  v_reprova boolean := false;
  c record;
  v_media numeric;
  v_nota numeric;
  v_minimo numeric;
begin
  select * into v_e from public."TB_ENTREVISTA" where "CO_ENTREVISTA" = p_entrevista for update;
  if v_e."CO_ROTEIRO" is null then return; end if;
  select * into v_r from public."TB_ROTEIRO_ENTREVISTA" where "CO_ROTEIRO" = v_e."CO_ROTEIRO";

  -- Avaliadores da banca da entrevista (ativos) — a média é de quem lançou.
  for c in
    select k.*, row_number() over (order by k."NU_ORDEM") ord
      from public."TB_ROTEIRO_COMPETENCIA" k where k."CO_ROTEIRO" = v_r."CO_ROTEIRO" order by k."NU_ORDEM"
  loop
    select avg(a."VL_NOTA"), count(*) into v_media, v_avaliadores
      from public."TB_ENTREVISTA_AVALIACAO" a
     where a."CO_ENTREVISTA" = p_entrevista and a."CO_COMPETENCIA" = c."CO_COMPETENCIA";
    if v_avaliadores = 0 then
      v_falta := true;
      update public."TB_ENTREVISTA_NOTA" set "VL_NOTA" = null
       where "CO_ENTREVISTA" = p_entrevista and "NU_ORDEM" = c.ord;
      continue;
    end if;
    v_nota := round(v_media * c."VL_PESO", 2);
    v_total := v_total + v_nota;
    insert into public."TB_ENTREVISTA_NOTA" ("CO_ENTREVISTA", "NU_ORDEM", "DS_CRITERIO", "VL_NOTA")
    values (p_entrevista, c.ord, left(c."NO_COMPETENCIA", 600), v_nota)
    on conflict ("CO_ENTREVISTA", "NU_ORDEM") do update set "DS_CRITERIO" = excluded."DS_CRITERIO", "VL_NOTA" = excluded."VL_NOTA";
    if c."VL_MINIMO" is not null then
      v_minimo := case when c."TP_MINIMO" = 'PERCENTUAL'
                       then c."VL_NOTA_MAXIMA" * c."VL_PESO" * c."VL_MINIMO" / 100.0 else c."VL_MINIMO" end;
      if v_nota < v_minimo then v_reprova := true; end if;
    end if;
    if exists (select 1 from jsonb_array_elements_text(v_r."DS_NOTAS_ELIMINATORIAS") x
                where round(v_media, 2) = x::numeric) then
      v_reprova := true;
    end if;
  end loop;

  update public."TB_ENTREVISTA" set
    "VL_NOTA_TOTAL" = case when "ST_COMPARECEU" = 'N' then 0 when v_falta and v_total = 0 then null else round(v_total, 2) end,
    "TP_PARECER" = case
      when "ST_COMPARECEU" = 'N' and v_r."ST_AUSENCIA_ELIMINA" = 'S' then 'INAPTO'
      when "ST_COMPARECEU" is distinct from 'S' or v_falta then 'SEM_PARECER'
      when v_reprova or (v_r."VL_NOTA_MINIMA_TOTAL" is not null and v_total < v_r."VL_NOTA_MINIMA_TOTAL") then 'INAPTO'
      else 'APTO' end,
    "DT_ATUALIZACAO" = now()
   where "CO_ENTREVISTA" = p_entrevista;
end;
$function$;
comment on function private."FC_CALCULAR_ENTREVISTA"(uuid) is 'Recalcula uma entrevista feita no sistema: média × peso por competência (TB_ENTREVISTA_NOTA), total e parecer pelas regras do roteiro.';
revoke all on function private."FC_CALCULAR_ENTREVISTA"(uuid) from public, anon, authenticated;

create function private."FC_ROTEIRO_JSON"(p_roteiro uuid)
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
    'editais_em_uso', (select count(*) from public."TB_ENTREVISTA_EDITAL" e where e."CO_ROTEIRO" = r."CO_ROTEIRO"))
  from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = p_roteiro;
$function$;
comment on function private."FC_ROTEIRO_JSON"(uuid) is 'Um roteiro (versão) em json, com competências e níveis.';
revoke all on function private."FC_ROTEIRO_JSON"(uuid) from public, anon, authenticated;

-- 4. Roteiros (RPCs) -----------------------------------------------------------------------
create function public.listar_roteiros_entrevista(p_area text default null)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not private.pode_recurso('entrevistas', 1) then
    raise exception 'Sem permissão para Entrevistas' using errcode = '42501';
  end if;
  return coalesce((
    select json_agg(private."FC_ROTEIRO_JSON"(r."CO_ROTEIRO") order by r."NO_ROTEIRO")
      from public."TB_ROTEIRO_ENTREVISTA" r
     where r."ST_ATIVO" = 'S'
       and (p_area is null or r."CO_AREA" is null or r."CO_AREA" = p_area)), '[]'::json);
end;
$function$;
comment on function public.listar_roteiros_entrevista(text) is 'Roteiros de entrevista ativos (última versão de cada), da área pedida ou de qualquer área.';
revoke all on function public.listar_roteiros_entrevista(text) from public, anon;
grant execute on function public.listar_roteiros_entrevista(text) to authenticated, service_role;

create function public.salvar_roteiro_entrevista(p_dados jsonb)
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
    nullif(p_dados ->> 'nota_minima_total', '')::numeric, coalesce(p_dados -> 'notas_eliminatorias', '[]'),
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

  return private."FC_ROTEIRO_JSON"(v_id);
end;
$function$;
comment on function public.salvar_roteiro_entrevista(jsonb) is 'Cria um roteiro ou uma versão nova de um roteiro (p_dados.origem); a versão anterior deixa de ser oferecida, mas os editais que a usam continuam nela. entrevistas >= editor.';
revoke all on function public.salvar_roteiro_entrevista(jsonb) from public, anon;
grant execute on function public.salvar_roteiro_entrevista(jsonb) to authenticated, service_role;

-- 5. Edital: configuração, convocação e notas ----------------------------------------------
create function public.obter_entrevistas_do_edital(p_edital uuid)
returns json
language plpgsql
stable
security definer
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
               'vagas_imediatas', coalesce(ev."QT_VAGA_IMEDIATA",
                  (select vi."QT_VAGA_IMEDIATA" from public."TB_VAGA_IMEDIATA" vi
                    where vi."CO_EDITAL" = p_edital::text and (vi."CO_VAGA" = v.codigo_vaga or upper(vi."NO_CARGO") = upper(v.cargo)) limit 1)),
               'vagas_imediatas_salvas', ev."QT_VAGA_IMEDIATA" is not null) order by v.cargo)
        from (select a.codigo_vaga, min(a.nome_vaga) cargo, count(*) filter (where a.status_consolidado = 'Aprovado') aprovados
                from public."TB_ANALISE_CURRICULAR" a
               where a."CO_AREA" = v_area and a.ativo
                 and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)
               group by a.codigo_vaga) v
        left join public."TB_ENTREVISTA_VAGA" ev on ev."CO_MONITORAMENTO" = p_edital and ev."CO_VAGA" = v.codigo_vaga), '[]'::json),
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
comment on function public.obter_entrevistas_do_edital(uuid) is 'Tudo para conduzir a entrevista de um edital: configuração (roteiro, convocação, banca), vagas com vagas imediatas, candidatos aprovados na análise (com posição por vaga), banca e convocados com as notas.';
revoke all on function public.obter_entrevistas_do_edital(uuid) from public, anon;
grant execute on function public.obter_entrevistas_do_edital(uuid) to authenticated, service_role;

create function public.configurar_entrevista_edital(p_edital uuid, p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 2);
  v_roteiro uuid := nullif(p_dados ->> 'roteiro', '')::uuid;
  v jsonb;
  b jsonb;
begin
  if v_roteiro is null or not exists (select 1 from public."TB_ROTEIRO_ENTREVISTA" r where r."CO_ROTEIRO" = v_roteiro) then
    raise exception 'Escolha um roteiro' using errcode = '22023';
  end if;
  if exists (select 1 from public."TB_ENTREVISTA" e join public."TB_ENTREVISTA_AVALIACAO" x on x."CO_ENTREVISTA" = e."CO_ENTREVISTA"
              where e."CO_MONITORAMENTO" = p_edital and e."CO_ROTEIRO" is distinct from v_roteiro) then
    raise exception 'Já há notas lançadas com outro roteiro neste edital; o roteiro não pode mais ser trocado' using errcode = '23514';
  end if;
  insert into public."TB_ENTREVISTA_EDITAL" ("CO_MONITORAMENTO", "CO_ROTEIRO", "DS_CONVOCACAO", "DS_BANCA", "TP_LANCAMENTO", "CO_USUARIO_ATUALIZACAO")
  values (p_edital, v_roteiro, coalesce(p_dados -> 'convocacao', '{}'), coalesce(p_dados -> 'banca', '[]'),
          coalesce(nullif(p_dados ->> 'lancamento', ''), 'SECRETARIA'), (select auth.uid()))
  on conflict ("CO_MONITORAMENTO") do update set
    "CO_ROTEIRO" = excluded."CO_ROTEIRO", "DS_CONVOCACAO" = excluded."DS_CONVOCACAO", "DS_BANCA" = excluded."DS_BANCA",
    "TP_LANCAMENTO" = excluded."TP_LANCAMENTO", "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO";

  update public."TB_ENTREVISTA" set "CO_ROTEIRO" = v_roteiro
   where "CO_MONITORAMENTO" = p_edital and "TP_ORIGEM" = 'sistema' and "CO_ROTEIRO" is distinct from v_roteiro;

  for v in select value from jsonb_array_elements(coalesce(p_dados -> 'vagas', '[]')) loop
    insert into public."TB_ENTREVISTA_VAGA" ("CO_MONITORAMENTO", "CO_VAGA", "QT_VAGA_IMEDIATA")
    values (p_edital, v ->> 'vaga', greatest(coalesce((v ->> 'vagas_imediatas')::integer, 0), 0))
    on conflict ("CO_MONITORAMENTO", "CO_VAGA") do update set "QT_VAGA_IMEDIATA" = excluded."QT_VAGA_IMEDIATA";
  end loop;

  -- Banca: membros enviados (com id = atualiza; sem id = novo); os que não vieram saem (ST_ATIVO N).
  if jsonb_typeof(p_dados -> 'avaliadores') = 'array' then
    update public."TB_ENTREVISTA_AVALIADOR" a set "ST_ATIVO" = 'N'
     where a."CO_MONITORAMENTO" = p_edital and a."ST_ATIVO" = 'S'
       and not exists (select 1 from jsonb_array_elements(p_dados -> 'avaliadores') x where nullif(x ->> 'id', '')::uuid = a."CO_AVALIADOR");
    for b in select value from jsonb_array_elements(p_dados -> 'avaliadores') loop
      if nullif(b ->> 'id', '') is not null then
        update public."TB_ENTREVISTA_AVALIADOR" set "NO_AVALIADOR" = btrim(b ->> 'nome'), "NO_ORIGEM" = btrim(b ->> 'origem'),
               "NU_BANCA" = coalesce(nullif(b ->> 'banca', '')::smallint, 1), "CO_PERFIL_USUARIO" = nullif(b ->> 'perfil', '')::uuid, "ST_ATIVO" = 'S'
         where "CO_AVALIADOR" = (b ->> 'id')::uuid and "CO_MONITORAMENTO" = p_edital;
      else
        insert into public."TB_ENTREVISTA_AVALIADOR" ("CO_MONITORAMENTO", "NO_AVALIADOR", "NO_ORIGEM", "NU_BANCA", "CO_PERFIL_USUARIO")
        values (p_edital, btrim(b ->> 'nome'), btrim(b ->> 'origem'), coalesce(nullif(b ->> 'banca', '')::smallint, 1), nullif(b ->> 'perfil', '')::uuid);
      end if;
    end loop;
  end if;

  return public.obter_entrevistas_do_edital(p_edital);
end;
$function$;
comment on function public.configurar_entrevista_edital(uuid, jsonb) is 'Grava a configuração da entrevista do edital: roteiro, convocação, banca, modo de lançamento, vagas imediatas e membros da banca. entrevistas >= editor e o edital.';
revoke all on function public.configurar_entrevista_edital(uuid, jsonb) from public, anon;
grant execute on function public.configurar_entrevista_edital(uuid, jsonb) to authenticated, service_role;

create function public.convocar_para_entrevista(p_edital uuid, p_analises uuid[])
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 2);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_roteiro uuid;
  v_qt integer;
begin
  select "CO_ROTEIRO" into v_roteiro from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  if v_roteiro is null then raise exception 'Configure a entrevista do edital antes de convocar' using errcode = '23514'; end if;
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  if coalesce(cardinality(p_analises), 0) not between 1 and 2000 then raise exception 'Escolha de 1 a 2000 candidatos' using errcode = '22023'; end if;

  insert into public."TB_ENTREVISTA" as e ("CO_AREA", "CO_MONITORAMENTO", "CO_ANALISE_CURRICULAR", "TP_LIGACAO_ANALISE",
    "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO", "CO_CANDIDATO", "DS_MODALIDADE", "NO_CARGO", "TP_PARECER",
    "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_ROTEIRO", "ST_ATIVO")
  select v_area, p_edital, a.id, 'codigo', left(coalesce(v_m.unidade, ''), 200), left(v_m.edital, 120), left(a.codigo_vaga, 60),
         left(a.candidato, 200), left(a.id_origem, 60), left(a.modalidade_concorrencia, 300), left(a.nome_vaga, 400), 'SEM_PARECER',
         'sistema', 'sistema|' || p_edital || '|' || a.id, v_roteiro, 'S'
    from public."TB_ANALISE_CURRICULAR" a
   where a.id = any (p_analises) and a."CO_AREA" = v_area
     and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)
  on conflict ("DS_CHAVE_ORIGEM") do update set "ST_ATIVO" = 'S', "CO_ROTEIRO" = excluded."CO_ROTEIRO", "DT_ATUALIZACAO" = now();
  get diagnostics v_qt = row_count;

  insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_NOVO", "CO_USUARIO")
  select e."CO_ENTREVISTA", 'convocacao', 'convocado', (select auth.uid())
    from public."TB_ENTREVISTA" e where e."DS_CHAVE_ORIGEM" = any (select 'sistema|' || p_edital || '|' || x from unnest(p_analises) x);

  return json_build_object('convocados', v_qt, 'dados', public.obter_entrevistas_do_edital(p_edital));
end;
$function$;
comment on function public.convocar_para_entrevista(uuid, uuid[]) is 'Convoca candidatos aprovados na análise curricular do edital para a entrevista (TB_ENTREVISTA, TP_ORIGEM sistema). Idempotente. entrevistas >= editor.';
revoke all on function public.convocar_para_entrevista(uuid, uuid[]) from public, anon;
grant execute on function public.convocar_para_entrevista(uuid, uuid[]) to authenticated, service_role;

create function public.desconvocar_da_entrevista(p_entrevista uuid, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_edital uuid;
begin
  select "CO_MONITORAMENTO" into v_edital from public."TB_ENTREVISTA" where "CO_ENTREVISTA" = p_entrevista and "TP_ORIGEM" = 'sistema';
  if v_edital is null then raise exception 'Convocação não encontrada' using errcode = '22023'; end if;
  perform private."FC_EXIGIR_ENTREVISTAS_EDITAL"(v_edital, 2);
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then raise exception 'Informe o motivo (3 a 500 caracteres)' using errcode = '22023'; end if;
  if exists (select 1 from public."TB_ENTREVISTA_AVALIACAO" x where x."CO_ENTREVISTA" = p_entrevista) then
    raise exception 'Este candidato já tem notas lançadas; não pode ser desconvocado' using errcode = '23514';
  end if;
  update public."TB_ENTREVISTA" set "ST_ATIVO" = 'N', "DT_ATUALIZACAO" = now() where "CO_ENTREVISTA" = p_entrevista;
  insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_NOVO", "CO_USUARIO")
  values (p_entrevista, 'desconvocacao', btrim(p_motivo), (select auth.uid()));
  return public.obter_entrevistas_do_edital(v_edital);
end;
$function$;
comment on function public.desconvocar_da_entrevista(uuid, text) is 'Retira um convocado sem notas (exclusão lógica, com motivo). entrevistas >= editor.';
revoke all on function public.desconvocar_da_entrevista(uuid, text) from public, anon;
grant execute on function public.desconvocar_da_entrevista(uuid, text) to authenticated, service_role;

create function public.lancar_notas_entrevista(p_entrevista uuid, p_dados jsonb)
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
  v_comp public."TB_ROTEIRO_COMPETENCIA";
  v_av public."TB_ENTREVISTA_AVALIADOR";
  v_nota numeric;
  v_ant numeric;
  v_comp_novo text := nullif(p_dados ->> 'compareceu', '');
begin
  select * into v_e from public."TB_ENTREVISTA" where "CO_ENTREVISTA" = p_entrevista and "TP_ORIGEM" = 'sistema' and "ST_ATIVO" = 'S';
  if v_e."CO_ENTREVISTA" is null then raise exception 'Convocado não encontrado' using errcode = '22023'; end if;
  perform private."FC_EXIGIR_ENTREVISTAS_EDITAL"(v_e."CO_MONITORAMENTO", 2);
  select * into v_cfg from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = v_e."CO_MONITORAMENTO";
  select * into v_r from public."TB_ROTEIRO_ENTREVISTA" where "CO_ROTEIRO" = v_e."CO_ROTEIRO";
  select p.id into v_eu from private.current_profile() p;

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
    if v_nota < 0 or v_nota > v_comp."VL_NOTA_MAXIMA" then
      raise exception 'Nota % fora da faixa de % (0 a %)', v_nota, v_comp."NO_COMPETENCIA", v_comp."VL_NOTA_MAXIMA" using errcode = '22023';
    end if;
    if v_r."TP_ESCALA" = 'FAIXA' and mod(v_nota, v_r."VL_PASSO") <> 0 then
      raise exception 'Nota % não está na escala (de % em %)', v_nota, v_r."VL_PASSO", v_r."VL_PASSO" using errcode = '22023';
    elsif v_r."TP_ESCALA" = 'LISTA' and not exists (select 1 from jsonb_array_elements_text(v_r."DS_NOTAS_PERMITIDAS") n where n::numeric = v_nota) then
      raise exception 'Nota % não está entre as permitidas', v_nota using errcode = '22023';
    elsif v_r."TP_ESCALA" = 'NIVEIS' and not exists (select 1 from public."TB_ROTEIRO_NIVEL" n where n."CO_ROTEIRO" = v_r."CO_ROTEIRO" and n."VL_NOTA" = v_nota) then
      raise exception 'Nota % não é um dos níveis da escala', v_nota using errcode = '22023';
    end if;
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
comment on function public.lancar_notas_entrevista(uuid, jsonb) is 'Lança/corrige notas ({notas:[{competencia, avaliador, nota|null}]}) e o comparecimento ({compareceu:S|N, banca}) de um convocado, valida a escala do roteiro, grava o histórico e recalcula o resultado. entrevistas >= editor; no modo AVALIADOR, só a própria nota.';
revoke all on function public.lancar_notas_entrevista(uuid, jsonb) from public, anon;
grant execute on function public.lancar_notas_entrevista(uuid, jsonb) to authenticated, service_role;

-- 6. Roteiros iniciais (dos editais de 30/09) ---------------------------------------------
do $$
declare
  v_si uuid := gen_random_uuid();
  v_pj uuid := gen_random_uuid();
begin
  insert into public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO", "CO_ROTEIRO_ORIGEM", "CO_AREA", "NO_ROTEIRO", "DS_DESCRICAO", "NO_ETAPA",
    "TP_ESCALA", "VL_PASSO", "VL_NOTA_MINIMA_TOTAL", "DS_NOTAS_ELIMINATORIAS", "ST_AUSENCIA_ELIMINA", "DS_DESEMPATE",
    "ST_SOMA_ANALISE", "DS_CONVOCACAO_PADRAO", "DS_BANCA_PADRAO")
  values (v_si, v_si, 'saude-indigena', 'Saúde Indígena 2026 — Entrevista individual',
    'Modelo dos editais 100/2026 (CASAI Brasília), 105/2026 (DSEI Litoral Sul) e 110/2026 (DSEI Porto Velho): 4 competências de 0 a 5, média da banca, apto com 8 pontos e 2 em cada competência; nota 0 ou 1 elimina.',
    'Entrevista Individual', 'NIVEIS', 1, 8, '[0, 1]', 'S',
    '["Idade igual ou superior a 60 anos (Estatuto da Pessoa Idosa)", "Ser comprovadamente indígena", "Maior tempo de experiência na saúde indígena", "Maior tempo de experiência na atenção básica", "Maior pontuação na Avaliação Documental e de Títulos", "Maior pontuação na Entrevista"]',
    'S',
    '{"multiplo_imediatas": 5, "posicao_cadastro_reserva": 10, "excecoes": [{"termo_cargo": "Enfermagem", "multiplo_imediatas": 10, "posicao_cadastro_reserva": 20}, {"termo_cargo": "Enfermeiro", "multiplo_imediatas": 10, "posicao_cadastro_reserva": 20}]}',
    '[{"origem": "AgSUS", "quantidade": 1}, {"origem": "CONDISI", "quantidade": 1}, {"origem": "DSEI", "quantidade": 1}]');
  insert into public."TB_ROTEIRO_COMPETENCIA" ("CO_ROTEIRO", "NU_ORDEM", "NO_COMPETENCIA", "DS_DESCRICAO", "VL_NOTA_MAXIMA", "VL_PESO", "VL_MINIMO", "TP_MINIMO") values
    (v_si, 1, 'Conhecimento de políticas públicas', 'No âmbito de políticas e programas, legislação do SUS, SasiSUS, PNASPI, Atenção Primária (estrutura, princípios e abrangência) ou legislação de saúde pública, direitos humanos, direito à saúde e gestão pública.', 5, 1, 2, 'VALOR'),
    (v_si, 2, 'Habilidade intercultural', 'Conhecimentos básicos sobre o Controle Social e sua importância na Saúde Indígena; atuar em área intercultural; respeito aos Povos Indígenas.', 5, 1, 2, 'VALOR'),
    (v_si, 3, 'Habilidade técnica específica da vaga', 'Conhecimento técnico sobre planejamento, monitoramento e avaliação; monitoramento de dados e indicadores; conceitos e protocolos para atuar em área intercultural.', 5, 1, 2, 'VALOR'),
    (v_si, 4, 'Habilidade interpessoal', 'Para se comunicar com clareza e objetividade (fluência, empatia e escuta ativa).', 5, 1, 2, 'VALOR');
  insert into public."TB_ROTEIRO_NIVEL" ("CO_ROTEIRO", "VL_NOTA", "NO_NIVEL", "DS_DESCRICAO") values
    (v_si, 0, 'Inexistente / Não atendeu', 'Não respondeu, desconhecimento absoluto, recusou-se a responder ou postura incompatível. (Eliminação)'),
    (v_si, 1, 'Insuficiente', 'Conhecimento vago, incorreto ou lacunoso; falha em conceituar; falta propriedade e profundidade. (Eliminação)'),
    (v_si, 2, 'Razoável', 'Compreensão elementar; conceitua de forma parcial; propriedade justa e profundidade escassa. Limiar mínimo.'),
    (v_si, 3, 'Satisfatório', 'Atende aos requisitos essenciais; conceitua os pontos centrais; profundidade limitada.'),
    (v_si, 4, 'Muito bom', 'Conhecimento consistente; conceitua corretamente, com propriedade técnica e boa profundidade.'),
    (v_si, 5, 'Excelente', 'Domínio pleno; conceitua com precisão, total propriedade e profundidade analítica exemplar.');

  insert into public."TB_ROTEIRO_ENTREVISTA" ("CO_ROTEIRO", "CO_ROTEIRO_ORIGEM", "CO_AREA", "NO_ROTEIRO", "DS_DESCRICAO", "NO_ETAPA",
    "TP_ESCALA", "VL_PASSO", "VL_NOTA_MINIMA_TOTAL", "DS_NOTAS_ELIMINATORIAS", "ST_AUSENCIA_ELIMINA", "DS_DESEMPATE",
    "ST_SOMA_ANALISE", "DS_CONVOCACAO_PADRAO", "DS_BANCA_PADRAO")
  values (v_pj, v_pj, 'projetos', 'Projetos — Análise Comportamental (SESMT)',
    'Modelo do edital 93/2026 (SESMT, ERD Boa Vista): 4 competências de 0 a 2 (intercultural e comportamental +50%), estudo de caso em grupo; apto com 5 pontos e 50% do máximo em cada.',
    'Análise Comportamental', 'FAIXA', 0.5, 5, '[]', 'S',
    '["Idade igual ou superior a 60 anos (Estatuto da Pessoa Idosa)", "Maior tempo de experiência profissional comprovado", "Maior idade"]',
    'S',
    '{"multiplo_imediatas": 5, "posicao_cadastro_reserva": 10, "excecoes": []}',
    '[{"origem": "CDHO / AgSUS", "quantidade": 1}, {"origem": "SSO / AgSUS", "quantidade": 1}, {"origem": "CONDISI", "quantidade": 1}]');
  insert into public."TB_ROTEIRO_COMPETENCIA" ("CO_ROTEIRO", "NU_ORDEM", "NO_COMPETENCIA", "DS_DESCRICAO", "VL_NOTA_MAXIMA", "VL_PESO", "VL_MINIMO", "TP_MINIMO", "TP_AVALIACAO") values
    (v_pj, 1, 'Habilidade técnica', 'Fundamentos de Saúde e Segurança do Trabalho, normas regulamentadoras, riscos ocupacionais, prevenção, investigação de acidentes e indicadores.', 2, 1, 50, 'PERCENTUAL', 'INDIVIDUAL'),
    (v_pj, 2, 'Habilidade intercultural', 'Atuar em contexto de saúde indígena, atenção diferenciada, SasiSUS e adaptação às características do território.', 2, 1.5, 50, 'PERCENTUAL', 'INDIVIDUAL'),
    (v_pj, 3, 'Habilidade comportamental', 'Comunicação, escuta ativa, trabalho em equipe, ética, tomada de decisão e equilíbrio emocional.', 2, 1.5, 50, 'PERCENTUAL', 'INDIVIDUAL'),
    (v_pj, 4, 'Habilidade situacional (estudo de caso)', 'Aplicar conhecimentos em situações concretas e coletivas; lidar com risco, conflitos e resistência às medidas de saúde e segurança.', 2, 1, 50, 'PERCENTUAL', 'GRUPO');
end;
$$;

commit;
