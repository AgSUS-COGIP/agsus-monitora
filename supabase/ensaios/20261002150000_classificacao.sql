/*
  ENSAIO de 20261002150000_classificacao.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela), confere catálogo, permissão e aba, valida
  regras boas e ruins e percorre o fluxo com duas pessoas sintéticas (gestor =
  edital_gestor, leitor = usuario) num edital real que tenha duas análises na
  mesma vaga — regra em duas versões, lista gerada com hash, sorteio
  reprodutível e decisão manual — e termina em ROLLBACK: nada fica gravado.

  Resultado esperado: as mensagens "ok E1" … "ok E6" e "ENSAIO OK". Qualquer
  "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/classificacao-migration.test.js confere que o
  corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

-- 0. Pré-requisitos ---------------------------------------------------------------------
do $$
begin
  if not ('recursos_parecer' = any (private."FC_RECURSOS_MODULO"())) then
    raise exception 'Aplique antes 20261001170000_recursos_parecer_juridico.sql (lista de módulos sem recursos_parecer).';
  end if;
  if to_regclass('public."TB_QUADRO_VAGA_EDITAL"') is null then
    raise exception 'Aplique antes 20260930233000_quadro_de_vagas_do_edital.sql.';
  end if;
end;
$$;

-- 1. Permissão: recurso 'classificacao' --------------------------------------------------
create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos','entrevistas','selecao','recursos_parecer','classificacao']::text[];
$function$;

insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL")
select g."CO_GRUPO_ACESSO", 'classificacao',
       case
         when g."ST_ADMIN_GLOBAL" then 'admin'
         when g."CO_GRUPO_ACESSO" in ('edital_gestor', 'coordenador') then 'editor'
         when g."CO_GRUPO_ACESSO" in ('contratador', 'usuario', 'juridico') then 'leitor'
         else 'sem_acesso'
       end
  from public."TB_GRUPO_ACESSO" g
on conflict ("CO_GRUPO_ACESSO", "NO_RECURSO") do nothing;

-- 2. Catálogo de critérios ----------------------------------------------------------------
create table public."TB_CRITERIO_CLASSIFICACAO" (
  "CO_CRITERIO" varchar(40) not null,
  "NO_CRITERIO" varchar(200) not null,
  "TP_VALOR" varchar(10) not null,
  "TP_DIRECAO_PADRAO" varchar(20) not null,
  "DS_ORIGEM" varchar(300) not null,
  "NU_ORDEM" smallint not null,
  "ST_ATIVO" varchar(1) not null default 'S',
  constraint "PK_TB_CRITERIO_CLASSIFICACAO" primary key ("CO_CRITERIO"),
  constraint "CK_CRITERIOCLASSIF_COCRITERIO" check ("CO_CRITERIO" ~ '^[A-Z0-9_]{2,40}$'),
  constraint "CK_CRITERIOCLASSIF_TPVALOR" check ("TP_VALOR" in ('BOOLEANO', 'NUMERO')),
  constraint "CK_CRITERIOCLASSIF_TPDIRECAO" check ("TP_DIRECAO_PADRAO" in ('SIM_PRIMEIRO', 'NAO_PRIMEIRO', 'MAIOR_PRIMEIRO', 'MENOR_PRIMEIRO')),
  constraint "CK_CRITERIOCLASSIF_STATIVO" check ("ST_ATIVO" in ('S', 'N'))
);
comment on table public."TB_CRITERIO_CLASSIFICACAO" is
  'Catálogo dos critérios de desempate que a regra de classificação de um edital pode escolher e ordenar. Espelho de CATALOGO_DE_CRITERIOS (src/lib/classificacao/catalogo.js), que sabe ler cada valor do candidato.';
comment on column public."TB_CRITERIO_CLASSIFICACAO"."CO_CRITERIO" is 'Código do critério (ex.: IDOSO_60, INDIGENA_COMPROVADO).';
comment on column public."TB_CRITERIO_CLASSIFICACAO"."NO_CRITERIO" is 'Nome do critério como aparece na tela e na explicação.';
comment on column public."TB_CRITERIO_CLASSIFICACAO"."TP_VALOR" is 'BOOLEANO (sim/não) ou NUMERO.';
comment on column public."TB_CRITERIO_CLASSIFICACAO"."TP_DIRECAO_PADRAO" is 'Direção sugerida ao escolher o critério: SIM_PRIMEIRO, NAO_PRIMEIRO, MAIOR_PRIMEIRO ou MENOR_PRIMEIRO. A regra pode trocar.';
comment on column public."TB_CRITERIO_CLASSIFICACAO"."DS_ORIGEM" is 'De onde vem o valor (campo da análise, da entrevista ou cálculo).';
comment on column public."TB_CRITERIO_CLASSIFICACAO"."NU_ORDEM" is 'Ordem no catálogo da tela.';
comment on column public."TB_CRITERIO_CLASSIFICACAO"."ST_ATIVO" is 'S: pode ser escolhido em regra nova.';
comment on constraint "CK_CRITERIOCLASSIF_COCRITERIO" on public."TB_CRITERIO_CLASSIFICACAO" is 'Código em maiúsculas, dígitos e sublinhado.';
comment on constraint "CK_CRITERIOCLASSIF_TPVALOR" on public."TB_CRITERIO_CLASSIFICACAO" is 'Tipos de valor válidos.';
comment on constraint "CK_CRITERIOCLASSIF_TPDIRECAO" on public."TB_CRITERIO_CLASSIFICACAO" is 'Direções válidas.';
comment on constraint "CK_CRITERIOCLASSIF_STATIVO" on public."TB_CRITERIO_CLASSIFICACAO" is 'Flag S/N.';

insert into public."TB_CRITERIO_CLASSIFICACAO" ("CO_CRITERIO", "NO_CRITERIO", "TP_VALOR", "TP_DIRECAO_PADRAO", "DS_ORIGEM", "NU_ORDEM") values
  ('IDOSO_60', '60 anos ou mais na data de corte', 'BOOLEANO', 'SIM_PRIMEIRO', 'data_nascimento + data de corte (fim das inscrições)', 1),
  ('INDIGENA_COMPROVADO', 'Ser comprovadamente indígena', 'BOOLEANO', 'SIM_PRIMEIRO', 'pontuacao_criterio_etnico > 0 (validada na análise)', 2),
  ('EXP_SAUDE_INDIGENA', 'Maior tempo de experiência na saúde indígena', 'NUMERO', 'MAIOR_PRIMEIRO', 'experiencia_saude_indigena_total', 3),
  ('EXP_ATENCAO_BASICA', 'Maior tempo de experiência na atenção básica', 'NUMERO', 'MAIOR_PRIMEIRO', 'experiencia_atencao_basica_total', 4),
  ('NOTA_DOCUMENTAL', 'Maior pontuação na avaliação documental (curricular)', 'NUMERO', 'MAIOR_PRIMEIRO', 'nota_final_ajustada', 5),
  ('NOTA_ENTREVISTA', 'Maior pontuação na entrevista', 'NUMERO', 'MAIOR_PRIMEIRO', 'TB_ENTREVISTA.VL_NOTA_TOTAL', 6),
  ('MAIOR_IDADE', 'Maior idade', 'NUMERO', 'MAIOR_PRIMEIRO', 'data_nascimento (dias de vida na data de corte)', 7),
  ('PONTUACAO_ETNICA', 'Maior pontuação no critério étnico', 'NUMERO', 'MAIOR_PRIMEIRO', 'pontuacao_criterio_etnico', 8),
  ('PONTUACAO_EXPERIENCIA', 'Maior pontuação de experiência profissional', 'NUMERO', 'MAIOR_PRIMEIRO', 'pontuacao_experiencia_profissional', 9),
  ('PONTUACAO_FORMACAO', 'Maior pontuação de formação acadêmica', 'NUMERO', 'MAIOR_PRIMEIRO', 'pontuacao_escolaridade', 10),
  ('PONTUACAO_CURSOS', 'Maior pontuação em cursos de aperfeiçoamento', 'NUMERO', 'MAIOR_PRIMEIRO', 'pontuacao_cursos_aperfeicoamento', 11),
  ('EXP_PROFISSIONAL_TEMPO', 'Maior tempo de experiência profissional', 'NUMERO', 'MAIOR_PRIMEIRO', 'experiencia_profissional_total', 12),
  ('PCD', 'Ser pessoa com deficiência', 'BOOLEANO', 'SIM_PRIMEIRO', 'pcd', 13);

-- 3. Regra por edital e versões -------------------------------------------------------------
create table public."TB_REGRA_CLASSIFICACAO" (
  "CO_REGRA_CLASSIFICACAO" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "NU_VERSAO_VIGENTE" integer not null,
  "CO_USUARIO_ATUALIZACAO" uuid,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_REGRA_CLASSIFICACAO" primary key ("CO_REGRA_CLASSIFICACAO"),
  constraint "UK_REGRACLASSIF_COMONITOR" unique ("CO_MONITORAMENTO"),
  constraint "FK_MONITORAMENTO_REGRACLASSIF" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "CK_REGRACLASSIF_NUVERSAO" check ("NU_VERSAO_VIGENTE" >= 1)
);
comment on table public."TB_REGRA_CLASSIFICACAO" is
  'Regra de classificação de um edital (uma por edital), decidida pelo gestor do edital. A configuração fica em cada versão (TH_REGRA_CLASSIFICACAO); aqui, a versão vigente.';
comment on column public."TB_REGRA_CLASSIFICACAO"."CO_REGRA_CLASSIFICACAO" is 'Identificador da regra.';
comment on column public."TB_REGRA_CLASSIFICACAO"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TB_REGRA_CLASSIFICACAO"."NU_VERSAO_VIGENTE" is 'Versão vigente (TH_REGRA_CLASSIFICACAO.NU_VERSAO). Salvar cria a próxima.';
comment on column public."TB_REGRA_CLASSIFICACAO"."CO_USUARIO_ATUALIZACAO" is 'Quem salvou a versão vigente (auth.users.id).';
comment on column public."TB_REGRA_CLASSIFICACAO"."DT_CRIACAO" is 'Primeira versão.';
comment on column public."TB_REGRA_CLASSIFICACAO"."DT_ATUALIZACAO" is 'Última versão salva.';
comment on constraint "UK_REGRACLASSIF_COMONITOR" on public."TB_REGRA_CLASSIFICACAO" is 'Uma regra por edital.';
comment on constraint "FK_MONITORAMENTO_REGRACLASSIF" on public."TB_REGRA_CLASSIFICACAO" is 'Edital da regra. Sem cascata: as listas geradas são registro de auditoria.';
comment on constraint "CK_REGRACLASSIF_NUVERSAO" on public."TB_REGRA_CLASSIFICACAO" is 'Versões começam em 1.';

create table public."TH_REGRA_CLASSIFICACAO" (
  "CO_REGRA_CLASSIFICACAO" uuid not null,
  "NU_VERSAO" integer not null,
  "DS_CONFIGURACAO" jsonb not null,
  "TP_EMPATE_FINAL" varchar(20) not null,
  "DS_MOTIVO" varchar(500),
  "CO_USUARIO" uuid,
  "DT_CRIACAO" timestamptz not null default now(),
  constraint "PK_TH_REGRA_CLASSIFICACAO" primary key ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO"),
  constraint "FK_REGRACLASSIF_HISTREGRACLASSIF" foreign key ("CO_REGRA_CLASSIFICACAO") references public."TB_REGRA_CLASSIFICACAO" ("CO_REGRA_CLASSIFICACAO"),
  constraint "CK_HISTREGRACLASSIF_NUVERSAO" check ("NU_VERSAO" >= 1),
  constraint "CK_HISTREGRACLASSIF_CONFIG" check (jsonb_typeof("DS_CONFIGURACAO") = 'object'),
  constraint "CK_HISTREGRACLASSIF_EMPATE" check ("TP_EMPATE_FINAL" in ('SORTEIO', 'ORDEM_INSCRICAO', 'MESMA_POSICAO', 'DECISAO_MANUAL')),
  constraint "CK_HISTREGRACLASSIF_MOTIVO" check ("DS_MOTIVO" is null or length("DS_MOTIVO") between 3 and 500)
);
comment on table public."TH_REGRA_CLASSIFICACAO" is
  'Versões da regra de classificação de um edital. Cada alteração cria uma linha (nada é sobrescrito); a lista gerada guarda a versão usada.';
comment on column public."TH_REGRA_CLASSIFICACAO"."CO_REGRA_CLASSIFICACAO" is 'Regra (TB_REGRA_CLASSIFICACAO).';
comment on column public."TH_REGRA_CLASSIFICACAO"."NU_VERSAO" is 'Número da versão (1, 2, 3…).';
comment on column public."TH_REGRA_CLASSIFICACAO"."DS_CONFIGURACAO" is 'Configuração inteira da regra (formato de normalizarRegra em src/lib/classificacao/regra.js; validada por FC_VALIDAR_REGRA_CLASSIFICACAO).';
comment on column public."TH_REGRA_CLASSIFICACAO"."TP_EMPATE_FINAL" is 'Método do empate que sobra depois de todos os critérios: SORTEIO, ORDEM_INSCRICAO, MESMA_POSICAO ou DECISAO_MANUAL (cópia da configuração, para consulta).';
comment on column public."TH_REGRA_CLASSIFICACAO"."DS_MOTIVO" is 'Por que a regra mudou (obrigatório a partir da versão 2).';
comment on column public."TH_REGRA_CLASSIFICACAO"."CO_USUARIO" is 'Quem salvou a versão (auth.users.id). Nulo: carga inicial (seed).';
comment on column public."TH_REGRA_CLASSIFICACAO"."DT_CRIACAO" is 'Quando a versão foi salva.';
comment on constraint "FK_REGRACLASSIF_HISTREGRACLASSIF" on public."TH_REGRA_CLASSIFICACAO" is 'Regra da versão.';
comment on constraint "CK_HISTREGRACLASSIF_NUVERSAO" on public."TH_REGRA_CLASSIFICACAO" is 'Versões começam em 1.';
comment on constraint "CK_HISTREGRACLASSIF_CONFIG" on public."TH_REGRA_CLASSIFICACAO" is 'Configuração é um objeto json.';
comment on constraint "CK_HISTREGRACLASSIF_EMPATE" on public."TH_REGRA_CLASSIFICACAO" is 'Métodos de empate final válidos.';
comment on constraint "CK_HISTREGRACLASSIF_MOTIVO" on public."TH_REGRA_CLASSIFICACAO" is 'Motivo entre 3 e 500 caracteres.';

create table public."RL_REGRA_CRITERIO_DESEMPATE" (
  "CO_REGRA_CLASSIFICACAO" uuid not null,
  "NU_VERSAO" integer not null,
  "NU_ORDEM" smallint not null,
  "CO_CRITERIO" varchar(40) not null,
  "TP_DIRECAO" varchar(20) not null,
  constraint "PK_RL_REGRA_CRITERIO_DESEMPATE" primary key ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "NU_ORDEM"),
  constraint "UK_REGRACRITERIO_CRITERIO" unique ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "CO_CRITERIO"),
  constraint "FK_HISTREGRACLASSIF_REGRACRITERIO" foreign key ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO")
    references public."TH_REGRA_CLASSIFICACAO" ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO"),
  constraint "FK_CRITERIOCLASSIF_REGRACRITERIO" foreign key ("CO_CRITERIO") references public."TB_CRITERIO_CLASSIFICACAO" ("CO_CRITERIO"),
  constraint "CK_REGRACRITERIO_NUORDEM" check ("NU_ORDEM" between 1 and 20),
  constraint "CK_REGRACRITERIO_TPDIRECAO" check ("TP_DIRECAO" in ('SIM_PRIMEIRO', 'NAO_PRIMEIRO', 'MAIOR_PRIMEIRO', 'MENOR_PRIMEIRO'))
);
create index "IN_FKREGRACRITERIO_COCRITERIO" on public."RL_REGRA_CRITERIO_DESEMPATE" ("CO_CRITERIO");
comment on table public."RL_REGRA_CRITERIO_DESEMPATE" is
  'Critérios de desempate de cada versão da regra, na ordem em que valem, com a direção. Espelho relacional de DS_CONFIGURACAO.desempate, ligado ao catálogo.';
comment on column public."RL_REGRA_CRITERIO_DESEMPATE"."CO_REGRA_CLASSIFICACAO" is 'Regra.';
comment on column public."RL_REGRA_CRITERIO_DESEMPATE"."NU_VERSAO" is 'Versão da regra.';
comment on column public."RL_REGRA_CRITERIO_DESEMPATE"."NU_ORDEM" is 'Ordem do critério (1 = primeiro a desempatar).';
comment on column public."RL_REGRA_CRITERIO_DESEMPATE"."CO_CRITERIO" is 'Critério do catálogo (TB_CRITERIO_CLASSIFICACAO).';
comment on column public."RL_REGRA_CRITERIO_DESEMPATE"."TP_DIRECAO" is 'SIM_PRIMEIRO, NAO_PRIMEIRO, MAIOR_PRIMEIRO ou MENOR_PRIMEIRO.';
comment on constraint "UK_REGRACRITERIO_CRITERIO" on public."RL_REGRA_CRITERIO_DESEMPATE" is 'Um critério uma vez só por versão.';
comment on constraint "FK_HISTREGRACLASSIF_REGRACRITERIO" on public."RL_REGRA_CRITERIO_DESEMPATE" is 'Versão da regra.';
comment on constraint "FK_CRITERIOCLASSIF_REGRACRITERIO" on public."RL_REGRA_CRITERIO_DESEMPATE" is 'Critério do catálogo.';
comment on constraint "CK_REGRACRITERIO_NUORDEM" on public."RL_REGRA_CRITERIO_DESEMPATE" is 'Até 20 critérios.';
comment on constraint "CK_REGRACRITERIO_TPDIRECAO" on public."RL_REGRA_CRITERIO_DESEMPATE" is 'Direções válidas.';
comment on index public."IN_FKREGRACRITERIO_COCRITERIO" is 'Chave estrangeira para TB_CRITERIO_CLASSIFICACAO.';

-- 4. Listas geradas -------------------------------------------------------------------------
create table public."TB_LISTA_CLASSIFICACAO" (
  "CO_LISTA_CLASSIFICACAO" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "TP_LISTA" varchar(20) not null,
  "CO_REGRA_CLASSIFICACAO" uuid not null,
  "NU_VERSAO_REGRA" integer not null,
  "DS_RESULTADO" jsonb not null,
  "DS_HASH" varchar(64) not null,
  "QT_ELEGIVEL" integer not null default 0,
  "QT_ELIMINADO" integer not null default 0,
  "QT_AVISO" integer not null default 0,
  "QT_PENDENCIA" integer not null default 0,
  "CO_USUARIO" uuid not null,
  "DT_GERACAO" timestamptz not null default now(),
  "ST_PUBLICADA" varchar(1) not null default 'N',
  "CO_USUARIO_PUBLICACAO" uuid,
  "DT_PUBLICACAO" timestamptz,
  constraint "PK_TB_LISTA_CLASSIFICACAO" primary key ("CO_LISTA_CLASSIFICACAO"),
  constraint "FK_MONITORAMENTO_LISTACLASSIF" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_HISTREGRACLASSIF_LISTACLASSIF" foreign key ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA")
    references public."TH_REGRA_CLASSIFICACAO" ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO"),
  constraint "CK_LISTACLASSIF_TPLISTA" check ("TP_LISTA" in ('PRELIMINAR', 'CONVOCACAO', 'FINAL')),
  constraint "CK_LISTACLASSIF_RESULTADO" check (jsonb_typeof("DS_RESULTADO") = 'object'),
  constraint "CK_LISTACLASSIF_DSHASH" check ("DS_HASH" ~ '^[0-9a-f]{64}$'),
  constraint "CK_LISTACLASSIF_QUANTIDADES" check ("QT_ELEGIVEL" >= 0 and "QT_ELIMINADO" >= 0 and "QT_AVISO" >= 0 and "QT_PENDENCIA" >= 0),
  constraint "CK_LISTACLASSIF_STPUBLICADA" check ("ST_PUBLICADA" in ('S', 'N')),
  constraint "CK_LISTACLASSIF_PUBLICACAO" check (
    ("ST_PUBLICADA" = 'S') = ("DT_PUBLICACAO" is not null)
    and ("DT_PUBLICACAO" is null) = ("CO_USUARIO_PUBLICACAO" is null)
    and ("ST_PUBLICADA" = 'N' or "QT_PENDENCIA" = 0))
);
create index "IN_LISTACLASSIF_EDITAL_TIPO" on public."TB_LISTA_CLASSIFICACAO" ("CO_MONITORAMENTO", "TP_LISTA", "DT_GERACAO" desc);
create index "IN_FKLISTACLASSIF_REGRA" on public."TB_LISTA_CLASSIFICACAO" ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA");
comment on table public."TB_LISTA_CLASSIFICACAO" is
  'Cada lista de classificação gerada (preliminar, convocação para entrevista, resultado final): versão da regra usada, quem, quando, o retrato da lista e o hash. Nada é apagado; publicar marca a lista.';
comment on column public."TB_LISTA_CLASSIFICACAO"."CO_LISTA_CLASSIFICACAO" is 'Identificador da geração.';
comment on column public."TB_LISTA_CLASSIFICACAO"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA.id).';
comment on column public."TB_LISTA_CLASSIFICACAO"."TP_LISTA" is 'PRELIMINAR (avaliação documental), CONVOCACAO (para entrevista) ou FINAL (resultado final).';
comment on column public."TB_LISTA_CLASSIFICACAO"."CO_REGRA_CLASSIFICACAO" is 'Regra usada.';
comment on column public."TB_LISTA_CLASSIFICACAO"."NU_VERSAO_REGRA" is 'Versão da regra usada na geração.';
comment on column public."TB_LISTA_CLASSIFICACAO"."DS_RESULTADO" is 'Retrato da lista: por vaga, as listas (geral e por modalidade) com posição, nome e nota, os eliminados com motivo, os avisos e o rodapé. Só nome — sem CPF, nascimento ou contato.';
comment on column public."TB_LISTA_CLASSIFICACAO"."DS_HASH" is 'SHA-256 (hex) do texto de DS_RESULTADO, calculado no banco na gravação.';
comment on column public."TB_LISTA_CLASSIFICACAO"."QT_ELEGIVEL" is 'Candidatos nas listas.';
comment on column public."TB_LISTA_CLASSIFICACAO"."QT_ELIMINADO" is 'Candidatos eliminados ou fora da lista, com motivo.';
comment on column public."TB_LISTA_CLASSIFICACAO"."QT_AVISO" is 'Avisos da geração (dados faltando, entrevista sem análise…).';
comment on column public."TB_LISTA_CLASSIFICACAO"."QT_PENDENCIA" is 'Empates que esperavam sorteio ou decisão na geração. Com pendência, não publica.';
comment on column public."TB_LISTA_CLASSIFICACAO"."CO_USUARIO" is 'Quem gerou (auth.users.id).';
comment on column public."TB_LISTA_CLASSIFICACAO"."DT_GERACAO" is 'Quando gerou.';
comment on column public."TB_LISTA_CLASSIFICACAO"."ST_PUBLICADA" is 'S: marcada como publicada.';
comment on column public."TB_LISTA_CLASSIFICACAO"."CO_USUARIO_PUBLICACAO" is 'Quem marcou como publicada.';
comment on column public."TB_LISTA_CLASSIFICACAO"."DT_PUBLICACAO" is 'Quando foi marcada como publicada.';
comment on constraint "FK_MONITORAMENTO_LISTACLASSIF" on public."TB_LISTA_CLASSIFICACAO" is 'Edital da lista.';
comment on constraint "FK_HISTREGRACLASSIF_LISTACLASSIF" on public."TB_LISTA_CLASSIFICACAO" is 'Versão da regra usada.';
comment on constraint "CK_LISTACLASSIF_TPLISTA" on public."TB_LISTA_CLASSIFICACAO" is 'Tipos de lista válidos.';
comment on constraint "CK_LISTACLASSIF_RESULTADO" on public."TB_LISTA_CLASSIFICACAO" is 'Retrato é um objeto json.';
comment on constraint "CK_LISTACLASSIF_DSHASH" on public."TB_LISTA_CLASSIFICACAO" is 'SHA-256 em hexadecimal minúsculo.';
comment on constraint "CK_LISTACLASSIF_QUANTIDADES" on public."TB_LISTA_CLASSIFICACAO" is 'Quantidades não negativas.';
comment on constraint "CK_LISTACLASSIF_STPUBLICADA" on public."TB_LISTA_CLASSIFICACAO" is 'Flag S/N.';
comment on constraint "CK_LISTACLASSIF_PUBLICACAO" on public."TB_LISTA_CLASSIFICACAO" is 'Publicada tem quando e quem; lista com empate pendente não é publicada.';
comment on index public."IN_LISTACLASSIF_EDITAL_TIPO" is 'Gerações por edital e tipo, da mais recente.';
comment on index public."IN_FKLISTACLASSIF_REGRA" is 'Chave estrangeira para TH_REGRA_CLASSIFICACAO.';

-- 5. Empate final: sorteio e decisão manual ------------------------------------------------
create table public."TB_DESEMPATE_CLASSIFICACAO" (
  "CO_DESEMPATE_CLASSIFICACAO" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "TP_LISTA" varchar(20) not null,
  "CO_VAGA" varchar(60) not null,
  "DS_CHAVE_GRUPO" text not null,
  "TP_METODO" varchar(10) not null,
  "DS_SEMENTE" varchar(200),
  "TP_ORIGEM_SEMENTE" varchar(10),
  "DS_ORDEM" jsonb not null,
  "DS_JUSTIFICATIVA" varchar(2000),
  "ST_ATIVO" varchar(1) not null default 'S',
  "CO_USUARIO" uuid not null,
  "DT_REGISTRO" timestamptz not null default now(),
  "CO_USUARIO_DESATIVACAO" uuid,
  "DT_DESATIVACAO" timestamptz,
  constraint "PK_TB_DESEMPATE_CLASSIFICACAO" primary key ("CO_DESEMPATE_CLASSIFICACAO"),
  constraint "FK_MONITORAMENTO_DESEMPATECLASSIF" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "CK_DESEMPATECLASSIF_TPLISTA" check ("TP_LISTA" in ('PRELIMINAR', 'FINAL')),
  constraint "CK_DESEMPATECLASSIF_TPMETODO" check ("TP_METODO" in ('SORTEIO', 'MANUAL')),
  constraint "CK_DESEMPATECLASSIF_SORTEIO" check (
    ("TP_METODO" = 'SORTEIO') = ("DS_SEMENTE" is not null)
    and ("DS_SEMENTE" is null) = ("TP_ORIGEM_SEMENTE" is null)
    and ("TP_ORIGEM_SEMENTE" is null or "TP_ORIGEM_SEMENTE" in ('SERVIDOR', 'INFORMADA'))
    and ("DS_SEMENTE" is null or length("DS_SEMENTE") between 4 and 200)),
  constraint "CK_DESEMPATECLASSIF_MANUAL" check (
    "TP_METODO" <> 'MANUAL' or length(coalesce("DS_JUSTIFICATIVA", '')) between 10 and 2000),
  constraint "CK_DESEMPATECLASSIF_ORDEM" check (jsonb_typeof("DS_ORDEM") = 'array' and jsonb_array_length("DS_ORDEM") between 2 and 200),
  constraint "CK_DESEMPATECLASSIF_STATIVO" check ("ST_ATIVO" in ('S', 'N')),
  constraint "CK_DESEMPATECLASSIF_DESATIVACAO" check (
    ("ST_ATIVO" = 'N') = ("DT_DESATIVACAO" is not null)
    and ("DT_DESATIVACAO" is null) = ("CO_USUARIO_DESATIVACAO" is null))
);
create unique index "UK_DESEMPATECLASSIF_GRUPO_ATIVO" on public."TB_DESEMPATE_CLASSIFICACAO" ("CO_MONITORAMENTO", "TP_LISTA", "DS_CHAVE_GRUPO")
  where "ST_ATIVO" = 'S';
comment on table public."TB_DESEMPATE_CLASSIFICACAO" is
  'Empate que sobra depois de todos os critérios da regra, resolvido por SORTEIO registrado (reprodutível: ordem crescente de sha256(semente || '':'' || id da análise)) ou por DECISÃO MANUAL com justificativa. Refazer desativa o anterior (fica o histórico).';
comment on column public."TB_DESEMPATE_CLASSIFICACAO"."CO_DESEMPATE_CLASSIFICACAO" is 'Identificador do registro.';
comment on column public."TB_DESEMPATE_CLASSIFICACAO"."CO_MONITORAMENTO" is 'Edital.';
comment on column public."TB_DESEMPATE_CLASSIFICACAO"."TP_LISTA" is 'PRELIMINAR (vale também para a convocação) ou FINAL.';
comment on column public."TB_DESEMPATE_CLASSIFICACAO"."CO_VAGA" is 'Código da vaga do empate.';
comment on column public."TB_DESEMPATE_CLASSIFICACAO"."DS_CHAVE_GRUPO" is 'Lista | vaga | ids das análises empatadas em ordem. Se o grupo mudar, a chave muda e o registro deixa de valer.';
comment on column public."TB_DESEMPATE_CLASSIFICACAO"."TP_METODO" is 'SORTEIO ou MANUAL.';
comment on column public."TB_DESEMPATE_CLASSIFICACAO"."DS_SEMENTE" is 'Semente do sorteio (gerada no servidor ou informada pelo gestor).';
comment on column public."TB_DESEMPATE_CLASSIFICACAO"."TP_ORIGEM_SEMENTE" is 'SERVIDOR (gen_random_uuid) ou INFORMADA.';
comment on column public."TB_DESEMPATE_CLASSIFICACAO"."DS_ORDEM" is 'Ids das análises na ordem decidida (array json).';
comment on column public."TB_DESEMPATE_CLASSIFICACAO"."DS_JUSTIFICATIVA" is 'Justificativa (obrigatória na decisão manual e ao refazer um sorteio).';
comment on column public."TB_DESEMPATE_CLASSIFICACAO"."ST_ATIVO" is 'S: vale; N: substituído.';
comment on column public."TB_DESEMPATE_CLASSIFICACAO"."CO_USUARIO" is 'Quem registrou (auth.users.id).';
comment on column public."TB_DESEMPATE_CLASSIFICACAO"."DT_REGISTRO" is 'Quando registrou.';
comment on column public."TB_DESEMPATE_CLASSIFICACAO"."CO_USUARIO_DESATIVACAO" is 'Quem substituiu o registro.';
comment on column public."TB_DESEMPATE_CLASSIFICACAO"."DT_DESATIVACAO" is 'Quando foi substituído.';
comment on constraint "FK_MONITORAMENTO_DESEMPATECLASSIF" on public."TB_DESEMPATE_CLASSIFICACAO" is 'Edital do empate.';
comment on constraint "CK_DESEMPATECLASSIF_TPLISTA" on public."TB_DESEMPATE_CLASSIFICACAO" is 'Listas com empate próprio.';
comment on constraint "CK_DESEMPATECLASSIF_TPMETODO" on public."TB_DESEMPATE_CLASSIFICACAO" is 'Métodos registrados.';
comment on constraint "CK_DESEMPATECLASSIF_SORTEIO" on public."TB_DESEMPATE_CLASSIFICACAO" is 'Sorteio tem semente e origem; decisão manual não.';
comment on constraint "CK_DESEMPATECLASSIF_MANUAL" on public."TB_DESEMPATE_CLASSIFICACAO" is 'Decisão manual exige justificativa de 10 a 2.000 caracteres.';
comment on constraint "CK_DESEMPATECLASSIF_ORDEM" on public."TB_DESEMPATE_CLASSIFICACAO" is 'Ordem com 2 a 200 candidatos.';
comment on constraint "CK_DESEMPATECLASSIF_STATIVO" on public."TB_DESEMPATE_CLASSIFICACAO" is 'Flag S/N.';
comment on constraint "CK_DESEMPATECLASSIF_DESATIVACAO" on public."TB_DESEMPATE_CLASSIFICACAO" is 'Desativado tem quando e quem.';
comment on index public."UK_DESEMPATECLASSIF_GRUPO_ATIVO" is 'Um registro ativo por grupo de empate.';

-- 6. Acesso: só as funções abaixo ------------------------------------------------------------
alter table public."TB_CRITERIO_CLASSIFICACAO" enable row level security;
alter table public."TB_REGRA_CLASSIFICACAO" enable row level security;
alter table public."TH_REGRA_CLASSIFICACAO" enable row level security;
alter table public."RL_REGRA_CRITERIO_DESEMPATE" enable row level security;
alter table public."TB_LISTA_CLASSIFICACAO" enable row level security;
alter table public."TB_DESEMPATE_CLASSIFICACAO" enable row level security;
revoke all on public."TB_CRITERIO_CLASSIFICACAO", public."TB_REGRA_CLASSIFICACAO", public."TH_REGRA_CLASSIFICACAO",
  public."RL_REGRA_CRITERIO_DESEMPATE", public."TB_LISTA_CLASSIFICACAO", public."TB_DESEMPATE_CLASSIFICACAO"
  from public, anon, authenticated;

-- 7. Porteiro, validação e leitura da regra -------------------------------------------------------
create function private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital uuid, p_minimo integer)
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
  if not private.pode_recurso('classificacao', p_minimo) then
    raise exception 'Sem permissão para Classificação' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(v_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
  return v_area;
end;
$function$;
comment on function private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(uuid, integer) is
  'Barra (42501) quem não tem classificacao no nível pedido (1 leitor, 2 editor), a área ou o recorte da coordenação do edital; edital inexistente = 22023. Devolve a área do edital.';
revoke all on function private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(uuid, integer) from public, anon, authenticated;

create function private."FC_JSON_NUMERO_ENTRE"(p_valor jsonb, p_min numeric, p_max numeric)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select p_valor is null or jsonb_typeof(p_valor) = 'null'
      or (jsonb_typeof(p_valor) = 'number' and (p_valor #>> '{}')::numeric between p_min and p_max);
$function$;
comment on function private."FC_JSON_NUMERO_ENTRE"(jsonb, numeric, numeric) is
  'Valor json ausente, nulo ou número entre os limites (validação da regra de classificação).';
revoke all on function private."FC_JSON_NUMERO_ENTRE"(jsonb, numeric, numeric) from public, anon, authenticated;

create function private."FC_VALIDAR_REGRA_CLASSIFICACAO"(p_regra jsonb)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_cods text[];
  v_item jsonb;
  v_lista jsonb;
  v_n integer;
begin
  if jsonb_typeof(p_regra) is distinct from 'object' then
    raise exception 'Regra inválida: envie um objeto.' using errcode = '22023';
  end if;
  if pg_column_size(p_regra) > 200000 then
    raise exception 'Regra grande demais.' using errcode = '22023';
  end if;
  if p_regra ->> 'schema' is distinct from '1' then
    raise exception 'Regra inválida: versão do formato (schema) deve ser 1.' using errcode = '22023';
  end if;

  -- Data de corte e etapas.
  if jsonb_typeof(p_regra -> 'data_corte') = 'string' then
    if p_regra ->> 'data_corte' !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'Data de corte inválida.' using errcode = '22023';
    end if;
    begin
      perform (p_regra ->> 'data_corte')::date;
    exception when others then
      raise exception 'Data de corte inválida.' using errcode = '22023';
    end;
  elsif coalesce(jsonb_typeof(p_regra -> 'data_corte'), 'null') <> 'null' then
    raise exception 'Data de corte inválida.' using errcode = '22023';
  end if;
  if coalesce(p_regra #>> '{etapas,documental}', 'true') = 'false'
     and coalesce(p_regra #>> '{etapas,entrevista}', 'true') = 'false' then
    raise exception 'Escolha ao menos uma etapa.' using errcode = '22023';
  end if;

  -- Documental.
  if not private."FC_JSON_NUMERO_ENTRE"(p_regra #> '{documental,nota_minima}', 0, 1000) then
    raise exception 'Nota mínima documental entre 0 e 1000.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_regra #> '{documental,nota_minima_por_nivel}', '{}'::jsonb)) <> 'object'
     or exists (select 1 from jsonb_each(coalesce(p_regra #> '{documental,nota_minima_por_nivel}', '{}'::jsonb)) n
                 where n.key not in ('superior', 'tecnico', 'medio', 'fundamental')
                    or not private."FC_JSON_NUMERO_ENTRE"(n.value, 0, 1000)) then
    raise exception 'Nota mínima por nível inválida.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_regra #> '{documental,situacoes_aptas}', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_regra #> '{documental,situacoes_aptas}', '[]'::jsonb)) > 10 then
    raise exception 'Até 10 situações aptas na documental.' using errcode = '22023';
  end if;

  -- Entrevista.
  if not (private."FC_JSON_NUMERO_ENTRE"(p_regra #> '{entrevista,nota_minima}', 0, 1000)
          and private."FC_JSON_NUMERO_ENTRE"(p_regra #> '{entrevista,nota_minima_competencia}', 0, 1000)
          and private."FC_JSON_NUMERO_ENTRE"(p_regra #> '{entrevista,nota_eliminatoria_ate}', 0, 1000)) then
    raise exception 'Notas da entrevista entre 0 e 1000.' using errcode = '22023';
  end if;
  v_lista := coalesce(p_regra #> '{entrevista,competencias}', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 20
     or exists (select 1 from jsonb_array_elements(v_lista) c
                 where not private."FC_JSON_NUMERO_ENTRE"(c -> 'ordem', 1, 20)
                    or not private."FC_JSON_NUMERO_ENTRE"(c -> 'minimo', 0, 1000))
     or (select count(*) from jsonb_array_elements(v_lista)) <> (select count(distinct c ->> 'ordem') from jsonb_array_elements(v_lista) c) then
    raise exception 'Competências da entrevista inválidas (até 20, sem repetir).' using errcode = '22023';
  end if;

  -- Composição da nota.
  v_lista := coalesce(p_regra #> '{composicao,componentes}', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) not between 1 and 3
     or exists (select 1 from jsonb_array_elements(v_lista) c
                 where coalesce(c ->> 'codigo', '') not in ('DOCUMENTAL', 'ENTREVISTA', 'ART')
                    or not private."FC_JSON_NUMERO_ENTRE"(c -> 'peso', 0, 100))
     or (select count(distinct c ->> 'codigo') from jsonb_array_elements(v_lista) c) <> jsonb_array_length(v_lista) then
    raise exception 'De 1 a 3 componentes na nota (DOCUMENTAL, ENTREVISTA, ART), sem repetir, peso entre 0 e 100.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_lista) c where c ->> 'codigo' = 'ENTREVISTA')
     and coalesce(p_regra #>> '{etapas,entrevista}', 'true') = 'false' then
    raise exception 'A entrevista entra na nota, mas a etapa não.' using errcode = '22023';
  end if;
  if not private."FC_JSON_NUMERO_ENTRE"(p_regra #> '{composicao,casas}', 0, 4)
     or coalesce(p_regra #>> '{composicao,arredondamento}', 'MEIO_PARA_CIMA') not in ('MEIO_PARA_CIMA', 'TRUNCAR', 'NENHUM') then
    raise exception 'Casas decimais (0 a 4) ou arredondamento inválidos.' using errcode = '22023';
  end if;

  -- Desempate: critérios do catálogo, sem repetir, direção válida.
  v_lista := coalesce(p_regra -> 'desempate', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 20 then
    raise exception 'Até 20 critérios de desempate.' using errcode = '22023';
  end if;
  for v_item in select * from jsonb_array_elements(v_lista) loop
    if not exists (select 1 from public."TB_CRITERIO_CLASSIFICACAO" k
                    where k."CO_CRITERIO" = upper(coalesce(v_item ->> 'criterio', '')) and k."ST_ATIVO" = 'S') then
      raise exception 'Critério fora do catálogo: %.', coalesce(v_item ->> 'criterio', '(vazio)') using errcode = '22023';
    end if;
    if coalesce(v_item ->> 'direcao', '') not in ('SIM_PRIMEIRO', 'NAO_PRIMEIRO', 'MAIOR_PRIMEIRO', 'MENOR_PRIMEIRO') then
      raise exception 'Direção inválida no critério %.', v_item ->> 'criterio' using errcode = '22023';
    end if;
  end loop;
  if (select count(distinct upper(d ->> 'criterio')) from jsonb_array_elements(v_lista) d) <> jsonb_array_length(v_lista) then
    raise exception 'Critério de desempate repetido.' using errcode = '22023';
  end if;

  -- Empate nas listas e empate final.
  if coalesce(p_regra #>> '{listas,PRELIMINAR,empate}', 'MESMA_POSICAO') not in ('CRITERIOS', 'MESMA_POSICAO')
     or coalesce(p_regra #>> '{listas,FINAL,empate}', 'CRITERIOS') not in ('CRITERIOS', 'MESMA_POSICAO') then
    raise exception 'Empate das listas inválido.' using errcode = '22023';
  end if;
  if coalesce(p_regra #>> '{empate_final,metodo}', '') not in ('SORTEIO', 'ORDEM_INSCRICAO', 'MESMA_POSICAO', 'DECISAO_MANUAL') then
    raise exception 'Escolha o empate final: sorteio, ordem de inscrição, mesma posição ou decisão manual.' using errcode = '22023';
  end if;
  if coalesce(p_regra #>> '{empate_final,numeracao}', 'DENSA') not in ('DENSA', 'SALTANDO') then
    raise exception 'Numeração dos empatados inválida.' using errcode = '22023';
  end if;

  -- Modalidades e cotas.
  v_lista := coalesce(p_regra -> 'modalidades', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) not between 1 and 12 then
    raise exception 'De 1 a 12 modalidades.' using errcode = '22023';
  end if;
  select array_agg(m ->> 'codigo') into v_cods from jsonb_array_elements(v_lista) m;
  if exists (select 1 from unnest(v_cods) c where c is null or c !~ '^[A-Z]{2,8}$')
     or cardinality(v_cods) <> (select count(distinct c) from unnest(v_cods) c)
     or not ('AC' = any (v_cods)) then
    raise exception 'Modalidades inválidas: códigos de 2 a 8 letras maiúsculas, sem repetir, com a ampla (AC).' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(v_lista) m
              where not private."FC_JSON_NUMERO_ENTRE"(m -> 'percentual', 0, 100)
                 or jsonb_typeof(coalesce(m -> 'remanejar_para', '[]'::jsonb)) <> 'array'
                 or exists (select 1 from jsonb_array_elements_text(coalesce(m -> 'remanejar_para', '[]'::jsonb)) d
                             where not (d = any (v_cods)))) then
    raise exception 'Modalidade com percentual (0 a 100) ou remanejamento inválido.' using errcode = '22023';
  end if;
  if not private."FC_JSON_NUMERO_ENTRE"(p_regra #> '{cotas,minimo_vagas_reserva}', 0, 1000)
     or coalesce(p_regra #>> '{cotas,acumulo}', 'TODAS') not in ('MAIOR_PERCENTUAL', 'PCD_MAIS_UMA', 'TODAS') then
    raise exception 'Regras de cota inválidas.' using errcode = '22023';
  end if;

  -- Convocação.
  if not private."FC_JSON_NUMERO_ENTRE"(p_regra #> '{convocacao,multiplo_vagas}', 0, 100)
     or not private."FC_JSON_NUMERO_ENTRE"(p_regra #> '{convocacao,posicao_max_cr}', 0, 10000) then
    raise exception 'Convocação: múltiplo (0 a 100) ou posição (0 a 10000) inválidos.' using errcode = '22023';
  end if;
  v_lista := coalesce(p_regra #> '{convocacao,excecoes}', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' or jsonb_array_length(v_lista) > 10
     or exists (select 1 from jsonb_array_elements(v_lista) e
                 where not private."FC_JSON_NUMERO_ENTRE"(e -> 'multiplo_vagas', 0, 100)
                    or not private."FC_JSON_NUMERO_ENTRE"(e -> 'posicao_max_cr', 0, 10000)) then
    raise exception 'Exceções da convocação inválidas (até 10).' using errcode = '22023';
  end if;

  v_n := length(coalesce(p_regra ->> 'rodape', ''));
  if v_n > 1000 then
    raise exception 'Rodapé com até 1000 caracteres.' using errcode = '22023';
  end if;
end;
$function$;
comment on function private."FC_VALIDAR_REGRA_CLASSIFICACAO"(jsonb) is
  'Confere a configuração de uma regra de classificação (22023 com a mensagem do que está errado). As mesmas regras de validarRegra() em src/lib/classificacao/regra.js.';
revoke all on function private."FC_VALIDAR_REGRA_CLASSIFICACAO"(jsonb) from public, anon, authenticated;

create function private."FC_REGRA_CLASSIFICACAO_JSON"(p_edital uuid)
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
                      'motivo', h."DS_MOTIVO", 'empate_final', h."TP_EMPATE_FINAL", 'configuracao', h."DS_CONFIGURACAO")
                    order by h."NU_VERSAO" desc)
               from public."TH_REGRA_CLASSIFICACAO" h
               left join public."TB_PERFIL_USUARIO" pu on pu.user_id = h."CO_USUARIO"
              where h."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO"), '[]'::json))
    from public."TB_REGRA_CLASSIFICACAO" r
    join public."TH_REGRA_CLASSIFICACAO" v
      on v."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO" and v."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
    left join public."TB_PERFIL_USUARIO" p on p.user_id = v."CO_USUARIO"
   where r."CO_MONITORAMENTO" = p_edital;
$function$;
comment on function private."FC_REGRA_CLASSIFICACAO_JSON"(uuid) is
  'Regra de classificação vigente do edital (versão, configuração, quem e quando) e o histórico de versões; null sem regra.';
revoke all on function private."FC_REGRA_CLASSIFICACAO_JSON"(uuid) from public, anon, authenticated;

create function private."FC_LISTA_CLASSIFICACAO_JSON"(p_lista uuid)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
           'id', l."CO_LISTA_CLASSIFICACAO", 'tipo', l."TP_LISTA", 'versao_regra', l."NU_VERSAO_REGRA",
           'hash', l."DS_HASH", 'gerada_em', l."DT_GERACAO", 'por', coalesce(p.nome, p.email),
           'elegiveis', l."QT_ELEGIVEL", 'eliminados', l."QT_ELIMINADO", 'avisos', l."QT_AVISO",
           'pendencias', l."QT_PENDENCIA", 'publicada', l."ST_PUBLICADA" = 'S',
           'publicada_em', l."DT_PUBLICACAO", 'publicada_por', coalesce(pp.nome, pp.email))
    from public."TB_LISTA_CLASSIFICACAO" l
    left join public."TB_PERFIL_USUARIO" p on p.user_id = l."CO_USUARIO"
    left join public."TB_PERFIL_USUARIO" pp on pp.user_id = l."CO_USUARIO_PUBLICACAO"
   where l."CO_LISTA_CLASSIFICACAO" = p_lista;
$function$;
comment on function private."FC_LISTA_CLASSIFICACAO_JSON"(uuid) is 'Metadados de uma lista gerada (sem o retrato).';
revoke all on function private."FC_LISTA_CLASSIFICACAO_JSON"(uuid) from public, anon, authenticated;

create function private."FC_DESEMPATE_CLASSIFICACAO_JSON"(p_desempate uuid)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
           'id', d."CO_DESEMPATE_CLASSIFICACAO", 'tipo_lista', d."TP_LISTA", 'vaga', d."CO_VAGA",
           'chave', d."DS_CHAVE_GRUPO", 'metodo', d."TP_METODO", 'semente', d."DS_SEMENTE",
           'origem_semente', d."TP_ORIGEM_SEMENTE", 'ordem', d."DS_ORDEM", 'justificativa', d."DS_JUSTIFICATIVA",
           'em', d."DT_REGISTRO", 'por', coalesce(p.nome, p.email))
    from public."TB_DESEMPATE_CLASSIFICACAO" d
    left join public."TB_PERFIL_USUARIO" p on p.user_id = d."CO_USUARIO"
   where d."CO_DESEMPATE_CLASSIFICACAO" = p_desempate;
$function$;
comment on function private."FC_DESEMPATE_CLASSIFICACAO_JSON"(uuid) is 'Um sorteio ou decisão manual registrado (para a tela).';
revoke all on function private."FC_DESEMPATE_CLASSIFICACAO_JSON"(uuid) from public, anon, authenticated;

-- 8. RPCs -------------------------------------------------------------------------------------
create function public.listar_editais_classificacao(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_editais uuid[];
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('classificacao', 1) then
    raise exception 'Sem permissão para Classificação' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return json_build_object(
    'area', p_area,
    'pode_editar', private.pode_recurso('classificacao', 2),
    'editais', (
      with m as (
        select m.id, m.edital, m.unidade, m.ativo, private."FC_NUMERO_EDITAL"(m.edital) as numero
          from public."TB_MONITORAMENTO_INDIGENA" m
         where m."CO_AREA" = p_area and (v_editais is null or m.id = any (v_editais))
      ),
      an as (
        select private."FC_NUMERO_EDITAL"(a.edital) as numero, count(*)::integer as qt
          from public."TB_ANALISE_CURRICULAR" a
         where a."CO_AREA" = p_area and a.ativo
         group by 1
      )
      select coalesce(json_agg(json_build_object(
               'id', m.id, 'edital', m.edital, 'unidade', m.unidade, 'ativo', m.ativo,
               'candidatos', coalesce(an.qt, 0),
               'versao_regra', r."NU_VERSAO_VIGENTE",
               'ultima_lista', (
                 select json_build_object('tipo', l."TP_LISTA", 'em', l."DT_GERACAO", 'publicada', l."ST_PUBLICADA" = 'S')
                   from public."TB_LISTA_CLASSIFICACAO" l
                  where l."CO_MONITORAMENTO" = m.id
                  order by l."DT_GERACAO" desc limit 1))
             order by m.ativo desc, coalesce(an.qt, 0) = 0, m.edital), '[]'::json)
        from m
        left join an on an.numero = m.numero
        left join public."TB_REGRA_CLASSIFICACAO" r on r."CO_MONITORAMENTO" = m.id
    )
  );
end;
$function$;
comment on function public.listar_editais_classificacao(text) is
  'Editais da área para a aba Classificação (json): candidatos nas análises, versão da regra e a última lista gerada. Exige classificacao >= leitor, a área e o recorte da coordenação.';
revoke all on function public.listar_editais_classificacao(text) from public, anon;
grant execute on function public.listar_editais_classificacao(text) to authenticated, service_role;

create function public.obter_classificacao_do_edital(p_edital uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 1);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_numero text;
begin
  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  v_numero := private."FC_NUMERO_EDITAL"(v_m.edital);
  return json_build_object(
    'schema_version', 1,
    'gerado_em', now(),
    'edital', json_build_object('id', v_m.id, 'edital', v_m.edital, 'unidade', v_m.unidade, 'area', v_area, 'numero', v_numero),
    'pode_editar', private.pode_recurso('classificacao', 2),
    'regra', private."FC_REGRA_CLASSIFICACAO_JSON"(p_edital),
    'catalogo', (
      select json_agg(json_build_object('codigo', k."CO_CRITERIO", 'nome', k."NO_CRITERIO", 'tipo', k."TP_VALOR",
               'direcao', k."TP_DIRECAO_PADRAO", 'ativo', k."ST_ATIVO" = 'S') order by k."NU_ORDEM")
        from public."TB_CRITERIO_CLASSIFICACAO" k),
    'cronograma', coalesce((
      select json_agg(json_build_object('ordem', c.ordem, 'atividade', c.atividade, 'inicio', c.data_inicio, 'fim', c.data_fim)
             order by c.ordem)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c where c.monitoramento_id = p_edital), '[]'::json),
    'quadro', coalesce((
      select json_agg(json_build_object('id', q."CO_QUADRO_VAGA", 'ordem', q."NU_ORDEM", 'cargo', q."NO_CARGO",
               'lotacao', q."NO_LOTACAO", 'modalidades', q."DS_MODALIDADE_VAGA", 'vagas_imediatas', q."QT_VAGA_IMEDIATA",
               'cadastro_reserva', q."ST_CADASTRO_RESERVA" = 'S') order by q."NU_ORDEM")
        from public."TB_QUADRO_VAGA_EDITAL" q
       where q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S'), '[]'::json),
    'candidatos', coalesce((
      with a as (
        select a.* from public."TB_ANALISE_CURRICULAR" a
         where a."CO_AREA" = v_area and a.ativo and private."FC_NUMERO_EDITAL"(a.edital) = v_numero
      ),
      vq as (
        select n.nome_vaga, private."FC_QUADRO_DA_VAGA"(p_edital, n.nome_vaga) as quadro
          from (select distinct a.nome_vaga from a) n
      )
      select json_agg(json_build_object(
               'analise_id', a.id, 'codigo', a.id_origem, 'nome', a.candidato, 'vaga', a.codigo_vaga,
               'cargo', a.nome_vaga, 'categoria', a.categoria, 'modalidade', a.modalidade_concorrencia, 'pcd', a.pcd,
               'data_nascimento', a.data_nascimento, 'nota_documental', a.nota_final_ajustada, 'nota_art', a.nota_empregare,
               'pontuacao_formacao', a.pontuacao_escolaridade, 'pontuacao_cursos', a.pontuacao_cursos_aperfeicoamento,
               'pontuacao_experiencia', a.pontuacao_experiencia_profissional, 'pontuacao_etnica', a.pontuacao_criterio_etnico,
               'exp_saude_indigena', a.experiencia_saude_indigena_total, 'exp_atencao_basica', a.experiencia_atencao_basica_total,
               'exp_profissional', a.experiencia_profissional_total, 'status', a.status_consolidado, 'etapa', a.etapa,
               'quadro', vq.quadro)
             order by a.codigo_vaga, a.candidato)
        from a left join vq on vq.nome_vaga is not distinct from a.nome_vaga), '[]'::json),
    'entrevistas', coalesce((
      select json_agg(json_build_object(
               'id', e."CO_ENTREVISTA", 'analise_id', e."CO_ANALISE_CURRICULAR", 'nome', e."NO_CANDIDATO",
               'vaga', e."CO_VAGA", 'nota', e."VL_NOTA_TOTAL", 'parecer', e."TP_PARECER", 'compareceu', e."ST_COMPARECEU",
               'ligacao', e."TP_LIGACAO_ANALISE", 'origem', e."TP_ORIGEM",
               'notas', coalesce((select json_agg(json_build_object('ordem', n."NU_ORDEM", 'criterio', n."DS_CRITERIO", 'nota', n."VL_NOTA")
                                         order by n."NU_ORDEM")
                                    from public."TB_ENTREVISTA_NOTA" n where n."CO_ENTREVISTA" = e."CO_ENTREVISTA"), '[]'::json))
             order by e."CO_VAGA", e."NO_CANDIDATO")
        from public."TB_ENTREVISTA" e
       where e."ST_ATIVO" = 'S'
         and (e."CO_MONITORAMENTO" = p_edital
              or (e."CO_MONITORAMENTO" is null and e."CO_AREA" = v_area
                  and private."FC_NUMERO_EDITAL"(e."DS_EDITAL") = v_numero))), '[]'::json),
    'listas', coalesce((
      select json_agg(private."FC_LISTA_CLASSIFICACAO_JSON"(l."CO_LISTA_CLASSIFICACAO") order by l."DT_GERACAO" desc)
        from (select l."CO_LISTA_CLASSIFICACAO", l."DT_GERACAO"
                from public."TB_LISTA_CLASSIFICACAO" l
               where l."CO_MONITORAMENTO" = p_edital
               order by l."DT_GERACAO" desc limit 60) l), '[]'::json),
    'desempates', coalesce((
      select json_agg(private."FC_DESEMPATE_CLASSIFICACAO_JSON"(d."CO_DESEMPATE_CLASSIFICACAO") order by d."DT_REGISTRO")
        from public."TB_DESEMPATE_CLASSIFICACAO" d
       where d."CO_MONITORAMENTO" = p_edital and d."ST_ATIVO" = 'S'), '[]'::json)
  );
end;
$function$;
comment on function public.obter_classificacao_do_edital(uuid) is
  'Tudo o que o motor de classificação precisa de um edital (json): regra vigente e versões, catálogo de critérios, cronograma (data de corte), quadro de vagas, análises (sem CPF), entrevistas com notas por competência (ligadas por CO_ANALISE_CURRICULAR), listas geradas e desempates registrados; pode_editar. Exige classificacao >= leitor, a área e o recorte da coordenação.';
revoke all on function public.obter_classificacao_do_edital(uuid) from public, anon;
grant execute on function public.obter_classificacao_do_edital(uuid) to authenticated, service_role;

create function public.salvar_regra_classificacao(p_edital uuid, p_configuracao jsonb, p_versao_atual integer, p_motivo text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_nova integer;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_uid uuid := (select auth.uid());
begin
  perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(p_configuracao);
  if v_motivo is not null and length(v_motivo) not between 3 and 500 then
    raise exception 'Motivo da alteração entre 3 e 500 caracteres.' using errcode = '22023';
  end if;

  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital for update;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    if coalesce(p_versao_atual, 0) <> 0 then
      raise exception 'A regra mudou desde que você abriu; recarregue.' using errcode = '40001';
    end if;
    insert into public."TB_REGRA_CLASSIFICACAO" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
    values (p_edital, 1, v_uid)
    returning * into v_regra;
    v_nova := 1;
  else
    if p_versao_atual is distinct from v_regra."NU_VERSAO_VIGENTE" then
      raise exception 'A regra mudou desde que você abriu (versão %); recarregue.', v_regra."NU_VERSAO_VIGENTE" using errcode = '40001';
    end if;
    if v_motivo is null then
      raise exception 'Informe o motivo da alteração.' using errcode = '22023';
    end if;
    v_nova := v_regra."NU_VERSAO_VIGENTE" + 1;
  end if;

  insert into public."TH_REGRA_CLASSIFICACAO"
    ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "DS_CONFIGURACAO", "TP_EMPATE_FINAL", "DS_MOTIVO", "CO_USUARIO")
  values (v_regra."CO_REGRA_CLASSIFICACAO", v_nova, p_configuracao, p_configuracao #>> '{empate_final,metodo}', v_motivo, v_uid);

  insert into public."RL_REGRA_CRITERIO_DESEMPATE"
    ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "NU_ORDEM", "CO_CRITERIO", "TP_DIRECAO")
  select v_regra."CO_REGRA_CLASSIFICACAO", v_nova, d.ordem, upper(d.valor ->> 'criterio'), d.valor ->> 'direcao'
    from jsonb_array_elements(coalesce(p_configuracao -> 'desempate', '[]'::jsonb)) with ordinality d(valor, ordem);

  update public."TB_REGRA_CLASSIFICACAO"
     set "NU_VERSAO_VIGENTE" = v_nova, "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = v_uid
   where "CO_REGRA_CLASSIFICACAO" = v_regra."CO_REGRA_CLASSIFICACAO";

  return private."FC_REGRA_CLASSIFICACAO_JSON"(p_edital);
end;
$function$;
comment on function public.salvar_regra_classificacao(uuid, jsonb, integer, text) is
  'Salva a regra de classificação do edital como versão nova (a anterior fica no histórico). p_versao_atual = a versão que a tela abriu (0 sem regra; outra = 40001). Motivo obrigatório a partir da versão 2. Exige classificacao >= editor, a área e o recorte da coordenação.';
revoke all on function public.salvar_regra_classificacao(uuid, jsonb, integer, text) from public, anon;
grant execute on function public.salvar_regra_classificacao(uuid, jsonb, integer, text) to authenticated, service_role;

create function public.registrar_lista_classificacao(p_edital uuid, p_tipo text, p_versao integer, p_resultado jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_id uuid;
  v_totais jsonb := coalesce(p_resultado -> 'totais', '{}'::jsonb);
  v_qt integer[];
begin
  if p_tipo is null or p_tipo not in ('PRELIMINAR', 'CONVOCACAO', 'FINAL') then
    raise exception 'Tipo de lista inválido' using errcode = '22023';
  end if;
  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    raise exception 'Salve a regra do edital antes de gerar a lista.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_regra."NU_VERSAO_VIGENTE" then
    raise exception 'A regra mudou (versão %); gere de novo.', v_regra."NU_VERSAO_VIGENTE" using errcode = '40001';
  end if;
  if jsonb_typeof(p_resultado) is distinct from 'object' or jsonb_typeof(p_resultado -> 'vagas') is distinct from 'array'
     or p_resultado ->> 'tipo' is distinct from p_tipo then
    raise exception 'Lista inválida.' using errcode = '22023';
  end if;
  if pg_column_size(p_resultado) > 8000000 then
    raise exception 'Lista grande demais para registrar.' using errcode = '22023';
  end if;
  select array_agg(case when jsonb_typeof(v_totais -> k) = 'number'
                        then greatest(0, least(1000000, (v_totais ->> k)::numeric))::integer else 0 end order by o)
    into v_qt
    from unnest(array['elegiveis', 'eliminados', 'avisos', 'pendencias']) with ordinality t(k, o);

  insert into public."TB_LISTA_CLASSIFICACAO"
    ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA", "DS_RESULTADO", "DS_HASH",
     "QT_ELEGIVEL", "QT_ELIMINADO", "QT_AVISO", "QT_PENDENCIA", "CO_USUARIO")
  values (p_edital, p_tipo, v_regra."CO_REGRA_CLASSIFICACAO", v_regra."NU_VERSAO_VIGENTE", p_resultado,
          encode(sha256(convert_to(p_resultado::text, 'UTF8')), 'hex'),
          v_qt[1], v_qt[2], v_qt[3], v_qt[4], (select auth.uid()))
  returning "CO_LISTA_CLASSIFICACAO" into v_id;

  return private."FC_LISTA_CLASSIFICACAO_JSON"(v_id);
end;
$function$;
comment on function public.registrar_lista_classificacao(uuid, text, integer, jsonb) is
  'Registra uma lista gerada (PRELIMINAR, CONVOCACAO ou FINAL): retrato, versão da regra (tem de ser a vigente, senão 40001), quem, quando e o hash SHA-256 calculado aqui. Exige classificacao >= editor, a área e o recorte da coordenação.';
revoke all on function public.registrar_lista_classificacao(uuid, text, integer, jsonb) from public, anon;
grant execute on function public.registrar_lista_classificacao(uuid, text, integer, jsonb) to authenticated, service_role;

create function public.publicar_lista_classificacao(p_lista uuid)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_l public."TB_LISTA_CLASSIFICACAO";
begin
  select * into v_l from public."TB_LISTA_CLASSIFICACAO" where "CO_LISTA_CLASSIFICACAO" = p_lista for update;
  if v_l."CO_LISTA_CLASSIFICACAO" is null then
    raise exception 'Lista não encontrada' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(v_l."CO_MONITORAMENTO", 2);
  if v_l."ST_PUBLICADA" = 'S' then
    return private."FC_LISTA_CLASSIFICACAO_JSON"(p_lista);
  end if;
  if v_l."QT_PENDENCIA" > 0 then
    raise exception 'A lista tem empate pendente de sorteio ou decisão; resolva e gere de novo.' using errcode = '22023';
  end if;
  update public."TB_LISTA_CLASSIFICACAO"
     set "ST_PUBLICADA" = 'S', "DT_PUBLICACAO" = now(), "CO_USUARIO_PUBLICACAO" = (select auth.uid())
   where "CO_LISTA_CLASSIFICACAO" = p_lista;
  return private."FC_LISTA_CLASSIFICACAO_JSON"(p_lista);
end;
$function$;
comment on function public.publicar_lista_classificacao(uuid) is
  'Marca uma lista gerada como publicada (quem e quando). Lista com empate pendente não publica (22023). Exige classificacao >= editor no edital da lista.';
revoke all on function public.publicar_lista_classificacao(uuid) from public, anon;
grant execute on function public.publicar_lista_classificacao(uuid) to authenticated, service_role;

create function public.obter_lista_classificacao(p_lista uuid)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_l public."TB_LISTA_CLASSIFICACAO";
begin
  select * into v_l from public."TB_LISTA_CLASSIFICACAO" where "CO_LISTA_CLASSIFICACAO" = p_lista;
  if v_l."CO_LISTA_CLASSIFICACAO" is null then
    raise exception 'Lista não encontrada' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(v_l."CO_MONITORAMENTO", 1);
  return json_build_object('lista', private."FC_LISTA_CLASSIFICACAO_JSON"(p_lista), 'resultado', v_l."DS_RESULTADO");
end;
$function$;
comment on function public.obter_lista_classificacao(uuid) is
  'Uma lista gerada com o retrato (para exportar de novo). Exige classificacao >= leitor no edital da lista.';
revoke all on function public.obter_lista_classificacao(uuid) from public, anon;
grant execute on function public.obter_lista_classificacao(uuid) to authenticated, service_role;

create function public.registrar_desempate_classificacao(p_edital uuid, p_dados jsonb)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  v_tipo text := upper(coalesce(p_dados ->> 'tipo_lista', ''));
  v_vaga text := btrim(coalesce(p_dados ->> 'vaga', ''));
  v_metodo text := upper(coalesce(p_dados ->> 'metodo', ''));
  v_just text := nullif(btrim(coalesce(p_dados ->> 'justificativa', '')), '');
  v_refazer boolean := coalesce(p_dados ->> 'refazer', 'false') = 'true';
  v_numero text;
  v_ids text[];
  v_chave text;
  v_semente text;
  v_origem text;
  v_ordem jsonb;
  v_atual public."TB_DESEMPATE_CLASSIFICACAO";
  v_id uuid;
  v_uid uuid := (select auth.uid());
begin
  if v_tipo not in ('PRELIMINAR', 'FINAL') then
    raise exception 'Lista inválida (PRELIMINAR ou FINAL)' using errcode = '22023';
  end if;
  if v_metodo not in ('SORTEIO', 'MANUAL') then
    raise exception 'Método inválido (SORTEIO ou MANUAL)' using errcode = '22023';
  end if;
  if length(v_vaga) not between 1 and 60 then
    raise exception 'Vaga inválida' using errcode = '22023';
  end if;
  if jsonb_typeof(p_dados -> 'candidatos') is distinct from 'array' then
    raise exception 'Informe os candidatos empatados' using errcode = '22023';
  end if;
  select array_agg(x order by x collate "C") into v_ids
    from (select distinct jsonb_array_elements_text(p_dados -> 'candidatos') x) s;
  if coalesce(cardinality(v_ids), 0) not between 2 and 200 then
    raise exception 'O empate tem de 2 a 200 candidatos' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_ids) x where x !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'Candidato inválido' using errcode = '22023';
  end if;

  -- Os empatados são análises deste edital, desta área e desta vaga.
  select private."FC_NUMERO_EDITAL"(m.edital) into v_numero from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  if (select count(*) from public."TB_ANALISE_CURRICULAR" a
       where a.id = any (v_ids::uuid[]) and a."CO_AREA" = v_area and a.ativo
         and a.codigo_vaga = v_vaga and private."FC_NUMERO_EDITAL"(a.edital) = v_numero) <> cardinality(v_ids) then
    raise exception 'Há candidato fora deste edital ou desta vaga' using errcode = '22023';
  end if;

  v_chave := v_tipo || '|' || v_vaga || '|' || array_to_string(v_ids, ',');
  if p_dados ? 'chave' and p_dados ->> 'chave' is distinct from v_chave then
    raise exception 'O grupo de empate mudou; recarregue.' using errcode = '40001';
  end if;

  select * into v_atual from public."TB_DESEMPATE_CLASSIFICACAO"
   where "CO_MONITORAMENTO" = p_edital and "TP_LISTA" = v_tipo and "DS_CHAVE_GRUPO" = v_chave and "ST_ATIVO" = 'S'
   for update;

  if v_metodo = 'SORTEIO' then
    if v_atual."CO_DESEMPATE_CLASSIFICACAO" is not null and v_atual."TP_METODO" = 'SORTEIO' then
      if not v_refazer then
        raise exception 'Já há sorteio registrado para este empate.' using errcode = '23505';
      end if;
      if v_just is null or length(v_just) not between 10 and 2000 then
        raise exception 'Para refazer o sorteio, justifique (10 a 2.000 caracteres).' using errcode = '22023';
      end if;
    end if;
    v_semente := nullif(btrim(coalesce(p_dados ->> 'semente', '')), '');
    if v_semente is null then
      v_semente := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      v_origem := 'SERVIDOR';
    else
      if length(v_semente) not between 4 and 200 or v_semente ~ '[[:cntrl:]]' then
        raise exception 'Semente de 4 a 200 caracteres.' using errcode = '22023';
      end if;
      v_origem := 'INFORMADA';
    end if;
    select jsonb_agg(x order by encode(sha256(convert_to(v_semente || ':' || x, 'UTF8')), 'hex') collate "C")
      into v_ordem
      from unnest(v_ids) x;
  else
    if v_just is null or length(v_just) not between 10 and 2000 then
      raise exception 'A decisão manual exige justificativa (10 a 2.000 caracteres).' using errcode = '22023';
    end if;
    v_ordem := p_dados -> 'ordem';
    if jsonb_typeof(v_ordem) is distinct from 'array' or jsonb_array_length(v_ordem) <> cardinality(v_ids)
       or (select array_agg(x order by x collate "C") from jsonb_array_elements_text(v_ordem) x) is distinct from v_ids then
      raise exception 'A ordem tem de trazer cada empatado uma vez.' using errcode = '22023';
    end if;
  end if;

  if v_atual."CO_DESEMPATE_CLASSIFICACAO" is not null then
    update public."TB_DESEMPATE_CLASSIFICACAO"
       set "ST_ATIVO" = 'N', "DT_DESATIVACAO" = now(), "CO_USUARIO_DESATIVACAO" = v_uid
     where "CO_DESEMPATE_CLASSIFICACAO" = v_atual."CO_DESEMPATE_CLASSIFICACAO";
  end if;
  insert into public."TB_DESEMPATE_CLASSIFICACAO"
    ("CO_MONITORAMENTO", "TP_LISTA", "CO_VAGA", "DS_CHAVE_GRUPO", "TP_METODO", "DS_SEMENTE", "TP_ORIGEM_SEMENTE",
     "DS_ORDEM", "DS_JUSTIFICATIVA", "CO_USUARIO")
  values (p_edital, v_tipo, v_vaga, v_chave, v_metodo, v_semente, v_origem, v_ordem, v_just, v_uid)
  returning "CO_DESEMPATE_CLASSIFICACAO" into v_id;

  return private."FC_DESEMPATE_CLASSIFICACAO_JSON"(v_id);
end;
$function$;
comment on function public.registrar_desempate_classificacao(uuid, jsonb) is
  'Registra o empate final de um grupo: SORTEIO (semente do servidor ou informada; ordem = sha256(semente || '':'' || id) crescente; refazer exige justificativa) ou MANUAL (ordem + justificativa). p_dados: {tipo_lista, vaga, chave, metodo, candidatos, semente?, ordem?, justificativa?, refazer?}. Exige classificacao >= editor, a área e o recorte da coordenação; os candidatos têm de ser da vaga e do edital.';
revoke all on function public.registrar_desempate_classificacao(uuid, jsonb) from public, anon;
grant execute on function public.registrar_desempate_classificacao(uuid, jsonb) to authenticated, service_role;

-- 9. Catálogo de abas -----------------------------------------------------------------------
-- A aba entra DESLIGADA (ST_ATIVO = 'N'): o front publicado ainda não tem a
-- view 'classificacao'. Liga junto com o merge do front
-- (20261002150500_liga_aba_classificacao.sql).
insert into public."TB_ABA" ("CO_ABA", "NO_ABA", "DS_ICONE", "NU_ORDEM", "CO_VIEW", "CO_RECURSO", "TP_ABA", "ST_ATIVO", "ST_BETA")
values ('classificacao', 'Classificação', 'list-ordered', 7, 'classificacao', 'classificacao', 'nativa', 'N', 'S');
insert into public."RL_ABA_AREA" ("CO_ABA", "CO_AREA", "ST_ATIVO")
select 'classificacao', a."CO_AREA", 'S' from public."TB_AREA" a
on conflict do nothing;
update public."TB_ABA" set "NU_ORDEM" = 8, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'aprovados';
update public."TB_ABA" set "NU_ORDEM" = 9, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'selecao';

-- ═══ CORPO DA MIGRATION (fim) ═══

-- ENSAIO (tudo abaixo corre na mesma transação e é desfeito no rollback final)

-- E1. Catálogo, permissão e aba.
do $$
begin
  if (select count(*) from public."TB_CRITERIO_CLASSIFICACAO") <> 13 then
    raise exception 'FALHOU E1: catálogo de critérios com % linhas', (select count(*) from public."TB_CRITERIO_CLASSIFICACAO");
  end if;
  if not ('classificacao' = any (private."FC_RECURSOS_MODULO"())) then
    raise exception 'FALHOU E1: classificacao fora da lista de módulos';
  end if;
  if private."FC_NIVEL_DO_GRUPO"('edital_gestor', 'classificacao') <> 'editor'
     or private."FC_NIVEL_DO_GRUPO"('usuario', 'classificacao') <> 'leitor' then
    raise exception 'FALHOU E1: semente dos grupos';
  end if;
  if not exists (select 1 from public."TB_ABA" where "CO_ABA" = 'classificacao' and "NU_ORDEM" = 7 and "ST_ATIVO" = 'N' and "ST_BETA" = 'S')
     or (select "NU_ORDEM" from public."TB_ABA" where "CO_ABA" = 'aprovados') <> 8
     or (select "NU_ORDEM" from public."TB_ABA" where "CO_ABA" = 'selecao') <> 9
     or (select count(*) from public."RL_ABA_AREA" where "CO_ABA" = 'classificacao') <> (select count(*) from public."TB_AREA") then
    raise exception 'FALHOU E1: catálogo de abas';
  end if;
  raise notice 'ok E1: catálogo (13 critérios), permissão (gestor editor, usuário leitor) e aba desligada na ordem 7';
end;
$$;

-- E2. Validação da regra (só a função).
do $$
declare
  v_boa jsonb := '{"schema":1,"etapas":{"documental":true,"entrevista":true},"composicao":{"componentes":[{"codigo":"DOCUMENTAL","peso":1},{"codigo":"ENTREVISTA","peso":1}],"casas":2,"arredondamento":"MEIO_PARA_CIMA"},"desempate":[{"criterio":"IDOSO_60","direcao":"SIM_PRIMEIRO"},{"criterio":"INDIGENA_COMPROVADO","direcao":"SIM_PRIMEIRO"}],"empate_final":{"metodo":"SORTEIO","numeracao":"DENSA"},"modalidades":[{"codigo":"AC","remanejar_para":[]},{"codigo":"PP","percentual":25,"remanejar_para":["AC"]}],"convocacao":{"multiplo_vagas":5,"posicao_max_cr":10,"excecoes":[]},"rodape":"Item 10.4."}';
  v_ruins jsonb[];
  v_ruim jsonb;
  v_recusadas integer := 0;
begin
  v_ruins := array[
    v_boa || '{"schema":2}',
    v_boa || '{"desempate":[{"criterio":"INVENTADO","direcao":"SIM_PRIMEIRO"}]}',
    v_boa || '{"desempate":[{"criterio":"IDOSO_60","direcao":"SIM_PRIMEIRO"},{"criterio":"IDOSO_60","direcao":"SIM_PRIMEIRO"}]}',
    v_boa || '{"empate_final":{"metodo":"ALFABETICA"}}',
    v_boa || '{"modalidades":[{"codigo":"PP"}]}',
    v_boa || '{"modalidades":[{"codigo":"AC"},{"codigo":"PP","remanejar_para":["PI"]}]}',
    v_boa || '{"data_corte":"2026-02-30"}',
    v_boa || '{"convocacao":{"multiplo_vagas":500}}',
    v_boa || '{"etapas":{"documental":true,"entrevista":false}}'
  ];
  perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(v_boa);
  foreach v_ruim in array v_ruins loop
    begin
      perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(v_ruim);
    exception when sqlstate '22023' then
      v_recusadas := v_recusadas + 1;
    end;
  end loop;
  if v_recusadas <> cardinality(v_ruins) then
    raise exception 'FALHOU E2: só % de % regras ruins recusadas', v_recusadas, cardinality(v_ruins);
  end if;
  perform set_config('ensaio.regra', v_boa::text, true);
  raise notice 'ok E2: regra boa aceita; % regras ruins recusadas (22023)', v_recusadas;
end;
$$;

-- E3. Atores sintéticos (somem no rollback) e um edital com duas análises na mesma vaga.
do $$
declare
  v_edital uuid;
  v_area text;
  v_vaga text;
  v_ids text;
begin
  select m.id, m."CO_AREA", x.codigo_vaga into v_edital, v_area, v_vaga
    from public."TB_MONITORAMENTO_INDIGENA" m
    join lateral (
      select a.codigo_vaga from public."TB_ANALISE_CURRICULAR" a
       where a."CO_AREA" = m."CO_AREA" and a.ativo and a.codigo_vaga is not null
         and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(m.edital)
       group by a.codigo_vaga having count(*) >= 2 limit 1) x on true
   where m."CO_AREA" is not null
   order by m.ativo desc, m.edital
   limit 1;
  if v_edital is null then raise exception 'ENSAIO: nenhum edital com duas análises na mesma vaga'; end if;
  select string_agg(s.id::text, ',' order by s.id::text collate "C") into v_ids
    from (select a.id from public."TB_ANALISE_CURRICULAR" a, public."TB_MONITORAMENTO_INDIGENA" m
           where m.id = v_edital and a."CO_AREA" = v_area and a.ativo and a.codigo_vaga = v_vaga
             and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(m.edital)
           order by a.id limit 2) s;
  perform set_config('ensaio.edital', v_edital::text, true);
  perform set_config('ensaio.area', v_area, true);
  perform set_config('ensaio.vaga', v_vaga, true);
  perform set_config('ensaio.ids', v_ids, true);

  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-00000000c101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.gestor@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000c102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.leitor@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-00000000c101', 'ensaio.gestor@ensaio.invalid', 'Ensaio Gestor', 'edital_gestor', true),
    ('00000000-0000-4000-a000-00000000c102', 'ensaio.leitor@ensaio.invalid', 'Ensaio Leitor', 'usuario', true);
  insert into public."RL_PERFIL_USUARIO_AREA" ("CO_PERFIL_USUARIO", "CO_AREA")
  select u.id, v_area from public."TB_PERFIL_USUARIO" u where u.email like 'ensaio.%@ensaio.invalid';
  raise notice 'ok E3: atores criados; edital % (área %), vaga % com 2 análises', v_edital, v_area, v_vaga;
end;
$$;

-- E4. O fluxo pelas RPCs, como cada pessoa (papel authenticated).
set local role authenticated;
do $$
declare
  c_gestor constant text := '{"sub":"00000000-0000-4000-a000-00000000c101","role":"authenticated","email":"ensaio.gestor@ensaio.invalid"}';
  c_leitor constant text := '{"sub":"00000000-0000-4000-a000-00000000c102","role":"authenticated","email":"ensaio.leitor@ensaio.invalid"}';
  v_edital uuid := current_setting('ensaio.edital')::uuid;
  v_area text := current_setting('ensaio.area');
  v_vaga text := current_setting('ensaio.vaga');
  v_ids text[] := string_to_array(current_setting('ensaio.ids'), ',');
  v_regra jsonb := current_setting('ensaio.regra')::jsonb;
  v json;
  v_lista uuid;
  v_ordem jsonb;
  v_semente text;
begin
  -- Leitor: lê, não salva.
  perform set_config('request.jwt.claims', c_leitor, true);
  v := public.listar_editais_classificacao(v_area);
  if (v->>'pode_editar')::boolean then raise exception 'FALHOU E4: leitor com pode_editar'; end if;
  v := public.obter_classificacao_do_edital(v_edital);
  if json_array_length(v->'candidatos') < 2 then raise exception 'FALHOU E4: candidatos do edital'; end if;
  if (v->'candidatos'->0)::jsonb ? 'cpf' then raise exception 'FALHOU E4: CPF na leitura'; end if;
  begin
    perform public.salvar_regra_classificacao(v_edital, v_regra, 0, null);
    raise exception 'FALHOU E4: leitor salvou a regra';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'ok E4.1: leitor lê (sem CPF) e não salva (42501)';

  -- Gestor: versão 1, versão 2 só com motivo, concorrência.
  perform set_config('request.jwt.claims', c_gestor, true);
  v := public.salvar_regra_classificacao(v_edital, v_regra, 0, null);
  if (v->>'versao')::int <> 1 then raise exception 'FALHOU E4: versão 1'; end if;
  begin
    perform public.salvar_regra_classificacao(v_edital, v_regra, 1, null);
    raise exception 'FALHOU E4: versão 2 sem motivo';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.salvar_regra_classificacao(v_edital, v_regra, 0, 'tentativa velha');
    raise exception 'FALHOU E4: versão desatualizada passou';
  exception when sqlstate '40001' then null;
  end;
  v := public.salvar_regra_classificacao(v_edital, v_regra || '{"empate_final":{"metodo":"DECISAO_MANUAL","numeracao":"DENSA"}}', 1, 'Comissão decidiu decisão manual');
  if (v->>'versao')::int <> 2 or json_array_length(v->'versoes') <> 2 then raise exception 'FALHOU E4: versão 2'; end if;
  raise notice 'ok E4.2: versões 1 e 2 (motivo obrigatório, 40001 na versão velha)';

  -- Gerar a lista: versão vigente e hash do banco.
  begin
    perform public.registrar_lista_classificacao(v_edital, 'FINAL', 1, '{"tipo":"FINAL","vagas":[]}');
    raise exception 'FALHOU E4: lista com versão velha';
  exception when sqlstate '40001' then null;
  end;
  v := public.registrar_lista_classificacao(v_edital, 'FINAL', 2, '{"tipo":"FINAL","vagas":[],"totais":{"elegiveis":3,"eliminados":1,"avisos":0,"pendencias":1}}');
  v_lista := (v->>'id')::uuid;
  if v->>'hash' <> encode(sha256(convert_to('{"tipo":"FINAL","vagas":[],"totais":{"elegiveis":3,"eliminados":1,"avisos":0,"pendencias":1}}'::jsonb::text, 'UTF8')), 'hex')
     or (v->>'versao_regra')::int <> 2 or (v->>'pendencias')::int <> 1 then
    raise exception 'FALHOU E4: registro da lista %', v;
  end if;
  begin
    perform public.publicar_lista_classificacao(v_lista);
    raise exception 'FALHOU E4: publicou lista com pendência';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok E4.3: lista registrada com a versão vigente e hash SHA-256 do banco; com pendência não publica';

  -- Sorteio: semente do servidor, ordem reprodutível, não repete sem justificativa.
  v := public.registrar_desempate_classificacao(v_edital, jsonb_build_object(
         'tipo_lista', 'FINAL', 'vaga', v_vaga, 'metodo', 'SORTEIO', 'candidatos', to_jsonb(v_ids)));
  v_semente := v->>'semente';
  select jsonb_agg(x order by encode(sha256(convert_to(v_semente || ':' || x, 'UTF8')), 'hex') collate "C") into v_ordem from unnest(v_ids) x;
  if v->>'origem_semente' <> 'SERVIDOR' or length(v_semente) <> 64 or (v->'ordem')::jsonb <> v_ordem
     or v->>'chave' <> 'FINAL|' || v_vaga || '|' || array_to_string(v_ids, ',') then
    raise exception 'FALHOU E4: sorteio %', v;
  end if;
  begin
    perform public.registrar_desempate_classificacao(v_edital, jsonb_build_object(
      'tipo_lista', 'FINAL', 'vaga', v_vaga, 'metodo', 'SORTEIO', 'candidatos', to_jsonb(v_ids)));
    raise exception 'FALHOU E4: sorteio repetido';
  exception when sqlstate '23505' then null;
  end;
  v := public.registrar_desempate_classificacao(v_edital, jsonb_build_object(
         'tipo_lista', 'FINAL', 'vaga', v_vaga, 'metodo', 'SORTEIO', 'candidatos', to_jsonb(v_ids),
         'semente', 'ata-da-sessao-publica-01', 'refazer', true, 'justificativa', 'Sorteio público em sessão aberta.'));
  if v->>'origem_semente' <> 'INFORMADA' then raise exception 'FALHOU E4: semente informada'; end if;
  begin
    perform public.registrar_desempate_classificacao(v_edital, jsonb_build_object(
      'tipo_lista', 'FINAL', 'vaga', v_vaga, 'metodo', 'MANUAL', 'candidatos', to_jsonb(v_ids), 'ordem', to_jsonb(v_ids), 'justificativa', 'curta'));
    raise exception 'FALHOU E4: decisão manual sem justificativa';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.registrar_desempate_classificacao(v_edital, jsonb_build_object(
      'tipo_lista', 'FINAL', 'vaga', v_vaga || '0', 'metodo', 'SORTEIO', 'candidatos', to_jsonb(v_ids)));
    raise exception 'FALHOU E4: candidatos de outra vaga';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok E4.4: sorteio reprodutível (sha256), repetido = 23505, refazer com justificativa; manual exige justificativa; candidato de outra vaga recusado';

  -- Leitor não sorteia; a leitura traz listas e desempates.
  perform set_config('request.jwt.claims', c_leitor, true);
  begin
    perform public.registrar_desempate_classificacao(v_edital, jsonb_build_object(
      'tipo_lista', 'PRELIMINAR', 'vaga', v_vaga, 'metodo', 'SORTEIO', 'candidatos', to_jsonb(v_ids)));
    raise exception 'FALHOU E4: leitor sorteou';
  exception when sqlstate '42501' then null;
  end;
  v := public.obter_classificacao_do_edital(v_edital);
  if json_array_length(v->'listas') <> 1 or json_array_length(v->'desempates') <> 1 or (v->'regra'->>'versao')::int <> 2 then
    raise exception 'FALHOU E4: leitura depois do fluxo';
  end if;
  v := public.obter_lista_classificacao(v_lista);
  if v->'resultado'->>'tipo' <> 'FINAL' then raise exception 'FALHOU E4: obter lista'; end if;
  raise notice 'ok E4.5: leitor não sorteia (42501) e lê regra, listas e desempates';
end;
$$;

-- E5. Ninguém acessa as tabelas direto; o histórico ficou.
do $$
begin
  begin
    perform 1 from public."TB_REGRA_CLASSIFICACAO" limit 1;
    raise exception 'FALHOU E5: authenticated leu a tabela';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok E5: tabelas sem acesso direto (só as funções)';
end;
$$;

reset role;
do $$
declare
  v_edital uuid := current_setting('ensaio.edital')::uuid;
begin
  if (select count(*) from public."RL_REGRA_CRITERIO_DESEMPATE" r
        join public."TB_REGRA_CLASSIFICACAO" g on g."CO_REGRA_CLASSIFICACAO" = r."CO_REGRA_CLASSIFICACAO"
       where g."CO_MONITORAMENTO" = v_edital) <> 4 then
    raise exception 'FALHOU E6: critérios por versão (2 por versão)';
  end if;
  if (select count(*) from public."TB_DESEMPATE_CLASSIFICACAO" where "CO_MONITORAMENTO" = v_edital and "ST_ATIVO" = 'S') <> 1
     or (select count(*) from public."TB_DESEMPATE_CLASSIFICACAO" where "CO_MONITORAMENTO" = v_edital) <> 2 then
    raise exception 'FALHOU E6: histórico dos sorteios';
  end if;
  raise notice 'ok E6: critérios de cada versão ligados ao catálogo; sorteio refeito guardou o anterior';
  raise notice 'ENSAIO OK';
end;
$$;

rollback;
