# Avaliação documental — proposta de modelo de dados

**Proposta, com a fase F1 já em migration** (`20261006090000` e `20261006100000`, ainda por aplicar): recurso, regra, modelos, equipe, aldeias e dono da avaliação. O formato implementado da regra (`DS_CONFIGURACAO`) está em `src/lib/avaliacao-documental/regra.js` — ele acrescenta ao exemplo da seção 2.1 o tipo de bloco `CURSOS`, os valores por nível (`por_nivel`) e a experiência por período (`pontuacao`, `periodo_meses`, `desconta_minimo`). O resto continua proposta. O desenho funcional está no
[README](README.md). Esta proposta segue o padrão MAD (PDTIC 2026–2027; resumo em
`docs/padronizacao_nomenclatura_*.md`). Antes de virar migration, passa pela skill
`mad-ddl-review`.

O padrão, em resumo:

- identificadores em MAIÚSCULAS e entre aspas, com até 30 caracteres;
- prefixos de tabela `TB_`, `TH_`, `TL_`, `RL_` e `TD_`; de restrição e índice, `PK_`, `FK_`,
  `UK_`, `CK_` e `IN_`;
- colunas `CO_`, `NO_`, `DS_`, `DT_`, `VL_`, `QT_`, `NU_`, `TP_` e `ST_`;
- `COMMENT` em tudo (aqui aparecem só os das tabelas, por brevidade);
- RLS ligado e `revoke all` de `public`, `anon` e `authenticated`: o acesso é **só por RPC**
  `SECURITY DEFINER` com `set search_path to ''`;
- as RPCs conferem a área, o recorte da coordenação, o nível no recurso **`avaliacao_documental`**
  (`private.pode_recurso('avaliacao_documental', n)`) e o papel no edital;
- histórico e log imutáveis por gatilho (o modelo é `TB_AJUSTE_PONTUACAO_RECURSO`, migration
  `20261005130000`).

Tabelas que já existem e são reaproveitadas:

| Tabela | Uso aqui |
|---|---|
| `TB_ANALISE_CURRICULAR` | destino da publicação |
| `TB_PLANILHA_ANALISE` | ganha as origens `monitora-*` |
| `TB_EMPREGARE_CANDIDATO` / `TB_EMPREGARE_VAGA` | origem dos candidatos e das vagas |
| `TB_MONITORAMENTO_INDIGENA` | o edital |
| `TD_UNIDADE` | o DSEI |
| `TB_QUADRO_VAGA_EDITAL` | as vagas por modalidade |
| `TH_REGRA_CLASSIFICACAO` | nota mínima, casas e arredondamento |
| `TB_LISTA_CLASSIFICACAO` | ganha os tipos `PROVISORIA` e `LOTE` |
| `TB_AJUSTE_PONTUACAO_RECURSO` | ajuste de pontuação do recurso |

## Visão geral

```
TB_MONITORAMENTO_INDIGENA (edital)
  ├─ TB_ORIGEM_ANALISE_EDITAL ── TH_ORIGEM_ANALISE_EDITAL   dono da análise: PLANILHA | COMPARACAO | MONITORA
  ├─ TB_REGRA_ANALISE ────────── TH_REGRA_ANALISE           regra da avaliação versionada (JSON)
  ├─ RL_ANALISTA_EDITAL                                     analista, revisor, coordenador
  ├─ TB_PRE_CLASSIFICACAO (candidato × vaga)                Provisória por ART, lote, eliminação automática
  └─ TB_FICHA_ANALISE (candidato do lote)                   reserva, situação, nota, desempates, parecer
       ├─ TB_ITEM_FICHA_ANALISE       um por bloco (documento/pergunta)
       ├─ TB_TITULO_FICHA_ANALISE     formação acadêmica (títulos)
       ├─ TB_VINCULO_EXPERIENCIA      vínculos de experiência
       ├─ TH_FICHA_ANALISE            retrato imutável a cada salvamento/transição
       ├─ TL_EVENTO_FICHA_ANALISE     cliques relevantes (imutável)
       └─ TL_ACESSO_FICHA_ANALISE     revelar CPF, abrir na Empregare, abrir documento (LGPD)
TD_ALDEIA_DSEI                                              aldeias oficiais por DSEI
TB_REGRA_ANALISE_MODELO                                     modelos de regra
TB_ANEXO_EMPREGARE (fase B)                                 documentos baixados pelo robô
```

## 0. Recurso de permissão novo: `avaliacao_documental`

Separado de `analises`, que continua sendo o do **Painel das análises**.

- Entra em `src/lib/permissoes-recursos.js` (`RESOURCES`), no catálogo do menu
  (`src/lib/menu-lateral.js`: id e view `avaliacao-documental`, rótulo "Avaliação documental",
  nas três áreas) e nas restrições `CK_` das tabelas de permissão por recurso e por grupo, com
  migration.
- Os níveis são Leitor, Editor e Administrador (o que cada um libera está no README, seção 4.1).
- O item "Análises curriculares" do menu passa a se chamar **"Painel das análises"**, sem mudar a
  view nem o recurso.

## 1. `TB_ORIGEM_ANALISE_EDITAL` / `TH_ORIGEM_ANALISE_EDITAL` — dono da análise

```sql
create table public."TB_ORIGEM_ANALISE_EDITAL" (
  "CO_MONITORAMENTO" uuid not null,
  "TP_ORIGEM" varchar(10) not null default 'PLANILHA',
  "DT_ATUALIZACAO" timestamptz not null default now(),
  "CO_USUARIO_ATUALIZACAO" uuid not null,
  constraint "PK_TB_ORIGEM_ANALISE_EDITAL" primary key ("CO_MONITORAMENTO"),
  constraint "FK_MONITORAMENTO_ORIGANALEDT" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "CK_ORIGANALEDT_TPORIGEM" check ("TP_ORIGEM" in ('PLANILHA', 'COMPARACAO', 'MONITORA'))
);
comment on table public."TB_ORIGEM_ANALISE_EDITAL" is
  'Dono da avaliação documental do edital: PLANILHA (Apps Script), COMPARACAO (o MONITORA avalia em paralelo e não publica) ou MONITORA (as fichas publicam em TB_ANALISE_CURRICULAR). Edital sem linha = PLANILHA.';

create table public."TH_ORIGEM_ANALISE_EDITAL" (
  "CO_MONITORAMENTO" uuid not null,
  "NU_SEQUENCIA" integer not null,
  "TP_ORIGEM_ANTERIOR" varchar(10),
  "TP_ORIGEM" varchar(10) not null,
  "DS_MOTIVO" varchar(2000) not null,
  "DS_RESULTADO" jsonb,
  "CO_USUARIO" uuid not null,
  "DT_REGISTRO" timestamptz not null default now(),
  constraint "PK_TH_ORIGEM_ANALISE_EDITAL" primary key ("CO_MONITORAMENTO", "NU_SEQUENCIA"),
  constraint "FK_ORIGANALEDT_THORIGANALEDT" foreign key ("CO_MONITORAMENTO")
    references public."TB_ORIGEM_ANALISE_EDITAL" ("CO_MONITORAMENTO"),
  constraint "CK_THORIGANALEDT_MOTIVO" check (length("DS_MOTIVO") between 10 and 2000)
);
comment on table public."TH_ORIGEM_ANALISE_EDITAL" is 'Histórico imutável das trocas de dono, com o resumo da virada.';
```

A ordem é `PLANILHA → COMPARACAO → MONITORA`. Para virar para `MONITORA`, o edital precisa estar
inativo em `TB_EDITAL_ANALISE` da planilha e sem carga em andamento em `TL_SYNC_ANALISE`.

## 2. `TB_REGRA_ANALISE` / `TH_REGRA_ANALISE` / `TB_REGRA_ANALISE_MODELO`

```sql
create table public."TB_REGRA_ANALISE" (
  "CO_REGRA_ANALISE" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "NU_VERSAO_VIGENTE" integer not null,
  "TP_SITUACAO" varchar(10) not null default 'CONFERIR',
  "CO_USUARIO_ATUALIZACAO" uuid not null,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_REGRA_ANALISE" primary key ("CO_REGRA_ANALISE"),
  constraint "UK_REGRAANALISE_EDITAL" unique ("CO_MONITORAMENTO"),
  constraint "FK_MONITORAMENTO_REGRAANALISE" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "CK_REGRAANALISE_TPSITUACAO" check ("TP_SITUACAO" in ('CONFERIR', 'CONFERIDA'))
);
comment on table public."TB_REGRA_ANALISE" is 'Regra da avaliação documental de um edital; a versão vigente aponta para TH_REGRA_ANALISE.';

create table public."TH_REGRA_ANALISE" (
  "CO_REGRA_ANALISE" uuid not null,
  "NU_VERSAO" integer not null,
  "DS_CONFIGURACAO" jsonb not null,
  "DS_MOTIVO" varchar(2000),
  "CO_USUARIO" uuid not null,
  "DT_CRIACAO" timestamptz not null default now(),
  constraint "PK_TH_REGRA_ANALISE" primary key ("CO_REGRA_ANALISE", "NU_VERSAO"),
  constraint "FK_REGRAANALISE_THREGRAANALISE" foreign key ("CO_REGRA_ANALISE")
    references public."TB_REGRA_ANALISE" ("CO_REGRA_ANALISE"),
  constraint "CK_THREGRAANALISE_CONFIG" check (jsonb_typeof("DS_CONFIGURACAO") = 'object'),
  constraint "CK_THREGRAANALISE_MOTIVO" check ("NU_VERSAO" = 1 or length("DS_MOTIVO") >= 10)
);
comment on table public."TH_REGRA_ANALISE" is 'Versões imutáveis da regra da avaliação; cada ficha guarda a versão usada.';

create table public."TB_REGRA_ANALISE_MODELO" (
  "CO_MODELO" varchar(30) not null,             -- PROJ26-CURRICULAR, SI26-100, SI26-83, SI26-INTERIOR-SUL…
  "NO_MODELO" varchar(200) not null,
  "DS_CONFIGURACAO" jsonb not null,
  "ST_ATIVO" varchar(1) not null default 'S',
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_REGRA_ANALISE_MODELO" primary key ("CO_MODELO"),
  constraint "CK_REGRAANALMOD_STATIVO" check ("ST_ATIVO" in ('S', 'N'))
);
comment on table public."TB_REGRA_ANALISE_MODELO" is 'Modelos de regra da avaliação para copiar num edital novo.';
```

### 2.1 Formato de `DS_CONFIGURACAO`

O formato é validado por `private."FC_VALIDAR_REGRA_ANALISE"` e pela mesma lógica pura em
`src/lib/avaliacao-documental/`. O exemplo segue a estrutura do questionário do 100/2026 (nível
superior), com textos encurtados e comentários `//` só para leitura:

```json
{
  "schema": 1,
  "modelo": "SI26-100",
  "edital_rotulo": "Edital 100/2026",

  "provisoria": {
    "ordem": ["ART_DESC", "IDADE_60", "DATA_CANDIDATURA"],
    "eliminacao_automatica": [
      { "codigo": "CANCELADO", "coluna": "SITUAÇÃO", "quando": ["CANCELADO"], "motivo": "Cancelou a inscrição" },
      { "codigo": "QUESTIONARIO", "coluna_prefixo": "SITUAÇÃO - ", "exceto": ["FINALIZADO"], "motivo": "Não finalizou o questionário" },
      { "codigo": "REPROVADO_EMPREGARE", "coluna": "REPROVADO", "quando": ["SIM"], "motivo": "Reprovado na Empregare" },
      { "codigo": "TERMO", "pergunta": "Pergunta 23 -", "quando": ["não estou de acordo"], "motivo": "Recusou o termo de responsabilidade" }
    ],
    "nota_declarada": [                    // só confere a ART; divergência vira aviso
      { "parcial": "FORMACAO", "pergunta": "Pergunta 15 -", "tipo": "OPCAO", "pontos": { "Especialização na área à qual concorre": 1, "Não possuo": 0 } },
      { "parcial": "EXPERIENCIA", "pergunta": "Pergunta 17 -", "tipo": "FAIXA_EM_MESES", "pontos_por_mes": 0.2, "teto": 10 },
      { "parcial": "ETNICO", "pergunta": "Pergunta 6 -", "tipo": "OPCOES_SOMADAS", "pontos": { "Sou indígena": 8, "Moro em aldeia": 6 }, "teto": 14 }
    ]
  },
  "lote": { "base": "MULTIPLO_VAGAS", "multiplo": 3,   // sem padrão fixo: a tela sugere, o gestor/coordenador edita
            "inclui_cr": true, "fixo": null,
            "por_modalidade": false, "inclui_empatados": true, "linha_anda": true,
            "publica_reposicao": false },   // personalizável por edital (decidido em 05/10/2026)
  "distribuicao": { "modo": "PEGAR_PROXIMO", "inicial": { "criterio": "PARTES_IGUAIS", "novos": "MENOS_PENDENTES" } },
  "revisao": { "amostra_percentual": 10, "minimo_por_analista": 5, "todas": false, "inaptos_requisito": true,
               "inaptos_nota": false, "divergencia_pontos": 2, "sinais": ["VINCULO_ATIVO"], "entrou_pela_linha": false,
               "duplo_cego": false },

  "blocos": [
    { "codigo": "IDENTIDADE", "titulo": "Documento de identidade com foto", "item_edital": "6.4 c",
      "perguntas": ["Pergunta 4 -"], "tipo": "DOCUMENTO",
      "efeitos": { "NAO_CONFORME": "ELIMINA", "NAO_ENVIADO": "ELIMINA" },
      "motivos": [{ "codigo": "ILEGIVEL", "texto": "Documento ilegível", "item_edital": "6.4 c", "efeito": "ELIMINA" },
                  { "codigo": "SEM_VERSO", "texto": "Documento sem o verso", "item_edital": "6.4 c", "efeito": "ELIMINA" }] },
    { "codigo": "MODALIDADE", "titulo": "Sistema de concorrência", "perguntas": ["Pergunta 5 -"], "tipo": "REGISTRO" },
    { "codigo": "ETNICO", "titulo": "Critério étnico", "item_edital": "8.13", "perguntas": ["Pergunta 6 -", "Pergunta 7 -"],
      "tipo": "PONTUACAO", "parcial": "ETNICO", "indigena": 8, "aldeia": 6, "teto": 14, "lista_aldeias": "DSEI_DO_EDITAL",
      "efeitos": { "NAO_CONFORME": "ZERA_PONTOS", "NAO_ENVIADO": "ZERA_PONTOS" },
      "motivos": [{ "codigo": "SEM_ASSINATURA", "texto": "Declaração sem as assinaturas das lideranças (Anexo VI)", "item_edital": "7.3 a" },
                  { "codigo": "ALDEIA_FORA", "texto": "Aldeia fora da área do DSEI", "item_edital": "7.2.2", "efeito": "SEM_PONTOS_ALDEIA" }] },
    { "codigo": "COTA_PP", "titulo": "Pretos e pardos", "condicao": "MODALIDADE=PP",
      "perguntas": ["Pergunta 8 -", "Pergunta 9 -", "Pergunta 10 -"], "tipo": "COTA",
      "efeitos": { "CONFORME": "ENCAMINHA_HETEROIDENTIFICACAO", "NAO_CONFORME": "SEGUE_AMPLA", "NAO_ENVIADO": "SEGUE_AMPLA" } },
    { "codigo": "COTA_QUILOMBOLA", "condicao": "MODALIDADE=QUILOMBOLA", "perguntas": ["Pergunta 11 -"], "tipo": "COTA" },
    { "codigo": "COTA_PCD", "condicao": "MODALIDADE=PCD", "perguntas": ["Pergunta 12 -"], "tipo": "COTA",
      "efeitos": { "CONFORME": "ENCAMINHA_PERICIA", "NAO_CONFORME": "SEGUE_AMPLA" } },
    { "codigo": "GRADUACAO", "titulo": "Graduação exigida e diploma (frente e verso)", "item_edital": "8.11.2",
      "perguntas": ["Pergunta 13 -", "Pergunta 14 -"], "tipo": "DOCUMENTO",
      "efeitos": { "NAO_CONFORME": "ELIMINA", "NAO_ENVIADO": "ELIMINA" } },
    { "codigo": "FORMACAO", "titulo": "Outras formações", "perguntas": ["Pergunta 15 -", "Pergunta 16 -"],
      "tipo": "TITULOS", "parcial": "FORMACAO", "cumulativa": false,
      "titulos": [["ESPECIALIZACAO", 1], ["RESIDENCIA", 2], ["MESTRADO", 2], ["DOUTORADO", 3]] },
    { "codigo": "EXPERIENCIA", "titulo": "Experiência profissional", "item_edital": "8.14",
      "perguntas": ["Pergunta 17 -", "Pergunta 18 -"], "tipo": "VINCULOS", "parcial": "EXPERIENCIA",
      "categorias": [{ "codigo": "SAUDE_INDIGENA", "desempate": 1 }, { "codigo": "ATENCAO_BASICA", "desempate": 2 }, { "codigo": "AREA" }],
      "minimo_meses": 6, "efeito_minimo": "ELIMINA", "pontos_por_mes": 0.2, "teto": 10, "dias_por_mes": 30,
      "unir_sobreposicao": true, "conta_ate": "DATA_CORTE", "max_vinculos": 20,
      "estagio_indigena": { "ativo": true, "horas_por_dia": 8, "dias_por_mes": 22, "so_sem_experiencia": true } },
    { "codigo": "PARENTESCO", "perguntas": ["Pergunta 19 -", "Pergunta 20 -"], "tipo": "REGISTRO", "alerta_quando": ["\"Sim\""] },
    { "codigo": "VINCULO_ATIVO", "perguntas": ["Pergunta 21 -"], "tipo": "REGISTRO", "alerta_quando": ["\"Sim\""] },
    { "codigo": "OUTROS_DSEI", "perguntas": ["Pergunta 22 -"], "tipo": "REGISTRO" }
  ],

  "situacoes": {
    "APTO":             { "etapa": "Triados",   "status": "Aprovado" },
    "INAPTO_REQUISITO": { "etapa": "Reprovado", "status": "Reprovado", "nota_zero": true },
    "INAPTO_NOTA":      { "etapa": "Reprovado", "status": "Reprovado" }
  },
  "corte": { "fonte": "REGRA_CLASSIFICACAO", "item_edital": "8.5" },
  "parecer": {
    "APTO": "{edital}\nCandidato(a) HABILITADO(A) na Avaliação Documental e de Títulos com a pontuação total de {nota} pontos, distribuídos da seguinte forma:\n\n{distribuicao}",
    "INAPTO_REQUISITO": "{edital}\nCandidato(a) INABILITADO(A) na Avaliação Documental e de Títulos, pelo(s) seguinte(s) motivo(s):\n\n{motivos}",
    "INAPTO_NOTA": "{edital}\nCandidato(a) NÃO HABILITADO(A) por não atingir a nota mínima de {corte} pontos (item {item_corte}). Nota obtida: {nota}.\n\n{distribuicao}",
    "observacoes": "\n\nObservações da análise:\n{observacoes}"
  },
  "observacoes_prontas": [
    { "codigo": "SEM_DETALHAMENTO", "rotulo": "Sem detalhamento das atividades", "item_edital": "8.14 b", "texto": "…" },
    { "codigo": "EXP_DIMINUIDA", "rotulo": "Nota de experiência diminuída", "texto": "…" }
  ]
}
```

Tipos de bloco:

| Tipo | Conteúdo |
|---|---|
| `DOCUMENTO` | situação + motivo + efeito |
| `PONTUACAO` | situação + pontos |
| `COTA` | situação + encaminhamento |
| `TITULOS` | lista de títulos |
| `VINCULOS` | tabela de vínculos |
| `REGISTRO` | só registro ou alerta |

Efeitos: `ELIMINA`, `ZERA_PONTOS`, `SEM_PONTOS_ALDEIA`, `AJUSTA_PONTOS`, `SO_REGISTRO`,
`ENCAMINHA_HETEROIDENTIFICACAO`, `ENCAMINHA_PERICIA` e `SEGUE_AMPLA`. Os pesos variam por edital:
no 100/2026, indígena +8 e aldeia +6; no 28/2026, +7 e +5. **Nada fica no código.**

## 3. `TD_ALDEIA_DSEI` — aldeias oficiais

```sql
create table public."TD_ALDEIA_DSEI" (
  "CO_ALDEIA_DSEI" uuid not null default gen_random_uuid(),
  "CO_UNIDADE" bigint not null,                 -- o DSEI em TD_UNIDADE (conferir o tipo do id)
  "NO_ALDEIA" varchar(200) not null,
  "CO_POLO" varchar(20),
  "NO_EXIBICAO" varchar(230) not null,          -- "NOME-(polo)", o que o analista busca
  "ST_ATIVO" varchar(1) not null default 'S',
  "DS_FONTE" varchar(300) not null,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TD_ALDEIA_DSEI" primary key ("CO_ALDEIA_DSEI"),
  constraint "UK_ALDEIADSEI_NOME" unique ("CO_UNIDADE", "NO_EXIBICAO"),
  constraint "FK_UNIDADE_ALDEIADSEI" foreign key ("CO_UNIDADE") references public."TD_UNIDADE" (id),
  constraint "CK_ALDEIADSEI_STATIVO" check ("ST_ATIVO" in ('S', 'N'))
);
comment on table public."TD_ALDEIA_DSEI" is 'Aldeias oficiais de cada DSEI, para validar o "mora em aldeia" do critério étnico.';
```

## 4. `RL_ANALISTA_EDITAL` — equipe

```sql
create table public."RL_ANALISTA_EDITAL" (
  "CO_ANALISTA_EDITAL" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "CO_USUARIO" uuid not null,
  "TP_PAPEL" varchar(12) not null,              -- ANALISTA | REVISOR | COORDENADOR
  "CO_VAGA" text,                               -- nulo = todas as vagas
  "QT_LIMITE_FICHA" integer,
  "ST_ATIVO" varchar(1) not null default 'S',
  "CO_USUARIO_ATUALIZACAO" uuid not null,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_RL_ANALISTA_EDITAL" primary key ("CO_ANALISTA_EDITAL"),
  constraint "FK_MONITORAMENTO_ANALISTAEDT" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_USUARIO_ANALISTAEDT" foreign key ("CO_USUARIO") references auth.users (id),
  constraint "CK_ANALISTAEDT_TPPAPEL" check ("TP_PAPEL" in ('ANALISTA', 'REVISOR', 'COORDENADOR')),
  constraint "CK_ANALISTAEDT_STATIVO" check ("ST_ATIVO" in ('S', 'N')),
  constraint "CK_ANALISTAEDT_LIMITE" check ("QT_LIMITE_FICHA" is null or "QT_LIMITE_FICHA" between 1 and 5000)
);
create unique index "UK_ANALISTAEDT_PAPEL" on public."RL_ANALISTA_EDITAL"
  ("CO_MONITORAMENTO", "CO_USUARIO", "TP_PAPEL", coalesce("CO_VAGA", '')) where "ST_ATIVO" = 'S';
comment on table public."RL_ANALISTA_EDITAL" is 'Equipe da avaliação documental do edital (substitui DIM_RESPONSAVEIS).';
```

O **gestor do edital** é COORDENADOR automaticamente (`FC_PAPEL_NO_EDITAL`), sem precisar de uma
linha aqui. O coordenador da área recebe o papel por esta tabela. Os dois cadastram a regra,
distribuem e configuram a revisão (decidido em 05/10/2026).

## 5. `TB_PRE_CLASSIFICACAO` — Provisória por ART e lote

```sql
create table public."TB_PRE_CLASSIFICACAO" (
  "CO_MONITORAMENTO" uuid not null,
  "CO_VAGA" text not null,
  "CO_EMPREGARE_CANDIDATO" uuid not null,
  "NU_VERSAO_REGRA" integer not null,
  "TP_SITUACAO" varchar(12) not null,           -- ELIMINADO | RANQUEADO | NO_LOTE | ANALISADO
  "CO_MOTIVO_ELIMINACAO" varchar(30),
  "VL_ART" numeric(8,4),                        -- nota da Empregare ("x/30") = ART, ordena a Provisória
  "VL_NOTA_DECLARADA" numeric(8,4),             -- recalculada pela regra; só confere a ART
  "DS_NOTA_DECLARADA" jsonb,
  "NO_MODALIDADE" varchar(60),
  "NU_POSICAO" integer,                         -- na Provisória da vaga
  "NU_POSICAO_MODALIDADE" integer,
  "NU_LOTE" smallint,                           -- 1 = lote inicial; 2, 3… = reposições
  "NO_ORIGEM_CONVOCACAO" varchar(40),           -- P15
  "DS_MOTIVO_ENTRADA" varchar(300),             -- "entrou no lote porque <código> ficou inapto"
  "DT_ENTRADA_LOTE" timestamptz,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_PRE_CLASSIFICACAO" primary key ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO"),
  constraint "FK_MONITORAMENTO_PRECLASSIF" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_EMPREGARECAND_PRECLASSIF" foreign key ("CO_EMPREGARE_CANDIDATO")
    references public."TB_EMPREGARE_CANDIDATO" ("CO_EMPREGARE_CANDIDATO"),
  constraint "CK_PRECLASSIF_TPSITUACAO" check ("TP_SITUACAO" in ('ELIMINADO', 'RANQUEADO', 'NO_LOTE', 'ANALISADO')),
  constraint "CK_PRECLASSIF_ELIMINADO" check (("TP_SITUACAO" = 'ELIMINADO') = ("CO_MOTIVO_ELIMINACAO" is not null)),
  constraint "CK_PRECLASSIF_POSICAO" check ("TP_SITUACAO" = 'ELIMINADO' or "NU_POSICAO" >= 1),
  constraint "CK_PRECLASSIF_LOTE" check (("TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')) = ("NU_LOTE" is not null))
);
create index "IN_PRECLASSIF_VAGA" on public."TB_PRE_CLASSIFICACAO" ("CO_MONITORAMENTO", "CO_VAGA", "TP_SITUACAO", "NU_POSICAO");
comment on table public."TB_PRE_CLASSIFICACAO" is
  'Lista provisória por ART (item 8.3.1) e lote de convocação (item 8.4) de cada vaga: eliminados automáticos com motivo, ranqueados, os do lote (com ficha) e os já analisados. Fonte das listas PROVISORIA e LOTE e dos contadores da fila.';
```

Regras de `private."FC_PRE_CLASSIFICAR_VAGA"` (roda no fim de cada carga e a cada conclusão):

- **Ordem**: ART decrescente e depois o desempate da regra. Uma ART ausente usa a nota declarada,
  com aviso.
- **Lote**: múltiplo × vagas imediatas (+ CR) ou um número fixo, geral ou por modalidade, com os
  empatados se a regra mandar. As vagas vêm de `TB_QUADRO_VAGA_EDITAL`, pela conta da
  Classificação.
- **A linha anda**: uma ficha concluída Inapta libera o lugar. Uma Apta com nota apurada abaixo da
  ART do primeiro de fora também libera. Os que passam a caber viram `NO_LOTE` com o próximo
  `NU_LOTE`.
- Quem já tem ficha não sai do lote por recálculo.

## 6. `TB_FICHA_ANALISE` — a ficha

```sql
create table public."TB_FICHA_ANALISE" (
  "CO_FICHA_ANALISE" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "CO_VAGA" text not null,
  "CO_EMPREGARE_CANDIDATO" uuid not null,
  "CO_ANALISE_CURRICULAR" uuid,                 -- linha publicada (ou adotada da planilha)
  "CO_REGRA_ANALISE" uuid not null,
  "NU_VERSAO_REGRA" integer not null,
  "NO_NIVEL" varchar(14) not null,
  "TP_SITUACAO" varchar(12) not null default 'PENDENTE',  -- PENDENTE | EM_ANALISE | REVISAR | CONCLUIDA | FORA_LOTE
  "TP_RESULTADO" varchar(16),                   -- APTO | INAPTO_REQUISITO | INAPTO_NOTA
  "CO_USUARIO_RESPONSAVEL" uuid,
  "DT_ATRIBUICAO" timestamptz,
  "CO_USUARIO_RESERVA" uuid,                    -- trava de concorrência: quem está com a ficha aberta
  "DT_RESERVA_EXPIRA" timestamptz,              -- 15 min, renovada enquanto a tela está aberta
  "CO_USUARIO_REVISOR" uuid,
  "ST_SORTEADA_REVISAO" varchar(1) not null default 'N',
  "ST_INDIGENA" varchar(1) not null default 'N',
  "ST_MORA_ALDEIA" varchar(1) not null default 'N',
  "CO_ALDEIA_DSEI" uuid,
  "VL_ART" numeric(8,4),
  "VL_NOTA_APURADA" numeric(8,4),
  "VL_NOTA_FINAL" numeric(8,4),                 -- 0 se INAPTO_REQUISITO
  "VL_NOTA_CORTE" numeric(8,4),
  "QT_DIAS_SAUDE_INDIGENA" integer,
  "QT_DIAS_ATENCAO_BASICA" integer,
  "QT_DIAS_EXPERIENCIA" integer,
  "QT_HORAS_ESTAGIO" integer,
  "NO_MODALIDADE" varchar(60),
  "DS_ENCAMINHAMENTOS" jsonb,                   -- ["HETEROIDENTIFICACAO"], ["PERICIA"], ["SEGUE_AMPLA"]
  "NO_ORIGEM_CONVOCACAO" varchar(40),
  "DS_OBSERVACAO" text,
  "DS_PARECER" text,
  "DS_HASH_EMPREGARE" varchar(64),
  "ST_EMPREGARE_MUDOU" varchar(1) not null default 'N',
  "ST_IMPORTADA_PLANILHA" varchar(1) not null default 'N',
  "NU_VERSAO" integer not null default 1,
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  "DT_CONCLUSAO" timestamptz,
  "DT_VALIDACAO" timestamptz,
  constraint "PK_TB_FICHA_ANALISE" primary key ("CO_FICHA_ANALISE"),
  constraint "UK_FICHAANALISE_CANDIDATO" unique ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO"),
  constraint "UK_FICHAANALISE_ANALISE" unique ("CO_ANALISE_CURRICULAR"),
  constraint "FK_MONITORAMENTO_FICHAANALISE" foreign key ("CO_MONITORAMENTO") references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_EMPREGARECAND_FICHAANALISE" foreign key ("CO_EMPREGARE_CANDIDATO")
    references public."TB_EMPREGARE_CANDIDATO" ("CO_EMPREGARE_CANDIDATO"),
  constraint "FK_ANALISECURRIC_FICHAANALISE" foreign key ("CO_ANALISE_CURRICULAR") references public."TB_ANALISE_CURRICULAR" (id),
  constraint "FK_THREGRAANAL_FICHAANALISE" foreign key ("CO_REGRA_ANALISE", "NU_VERSAO_REGRA")
    references public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO"),
  constraint "FK_ALDEIADSEI_FICHAANALISE" foreign key ("CO_ALDEIA_DSEI") references public."TD_ALDEIA_DSEI" ("CO_ALDEIA_DSEI"),
  constraint "CK_FICHAANALISE_TPSITUACAO" check ("TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE', 'REVISAR', 'CONCLUIDA', 'FORA_LOTE')),
  constraint "CK_FICHAANALISE_TPRESULTADO" check ("TP_RESULTADO" is null or "TP_RESULTADO" in ('APTO', 'INAPTO_REQUISITO', 'INAPTO_NOTA')),
  constraint "CK_FICHAANALISE_FLAGS" check ("ST_SORTEADA_REVISAO" in ('S', 'N') and "ST_EMPREGARE_MUDOU" in ('S', 'N')
    and "ST_IMPORTADA_PLANILHA" in ('S', 'N') and "ST_INDIGENA" in ('S', 'N') and "ST_MORA_ALDEIA" in ('S', 'N')),
  constraint "CK_FICHAANALISE_RESERVA" check (("CO_USUARIO_RESERVA" is null) = ("DT_RESERVA_EXPIRA" is null)),
  constraint "CK_FICHAANALISE_FLUXO" check (
    ("TP_SITUACAO" <> 'CONCLUIDA' or ("TP_RESULTADO" is not null and "DT_CONCLUSAO" is not null))
    and ("TP_SITUACAO" <> 'EM_ANALISE' or "CO_USUARIO_RESPONSAVEL" is not null)
    and ("TP_RESULTADO" is distinct from 'INAPTO_REQUISITO' or "VL_NOTA_FINAL" = 0)
    and ("CO_USUARIO_REVISOR" is null or "CO_USUARIO_REVISOR" <> "CO_USUARIO_RESPONSAVEL"))
);
create index "IN_FICHAANALISE_FILA" on public."TB_FICHA_ANALISE" ("CO_MONITORAMENTO", "TP_SITUACAO", "CO_VAGA");
create index "IN_FICHAANALISE_RESPONSAVEL" on public."TB_FICHA_ANALISE" ("CO_USUARIO_RESPONSAVEL", "TP_SITUACAO");
comment on table public."TB_FICHA_ANALISE" is
  'Ficha da avaliação documental de um candidato do lote: reserva, situação, resultado (apto, inapto por requisito, inapto por nota), nota, desempates, encaminhamentos e parecer. Publica em TB_ANALISE_CURRICULAR.';
```

Notas:

- O resultado sai de `FC_RESULTADO_DA_FICHA`: um bloco com efeito `ELIMINA` dá
  `INAPTO_REQUISITO`; uma nota abaixo da mínima dá `INAPTO_NOTA`; os demais, `APTO`.
- O responsável é `auth.uid()` e a data vem da conclusão. Nada é digitado.
- A **reserva** é feita por `reservar_ficha` (atômica). Só quem tem a reserva salva. A coordenação
  pode liberar. A versão otimista (`NU_VERSAO`) continua valendo.

## 7. `TB_ITEM_FICHA_ANALISE` — um por bloco

```sql
create table public."TB_ITEM_FICHA_ANALISE" (
  "CO_FICHA_ANALISE" uuid not null,
  "CO_BLOCO" varchar(30) not null,              -- código do bloco na regra (IDENTIDADE, ETNICO, GRADUACAO…)
  "NU_ORDEM" smallint not null,
  "TP_BLOCO" varchar(10) not null,              -- DOCUMENTO | PONTUACAO | COTA | TITULOS | VINCULOS | REGISTRO
  "CO_PARCIAL" varchar(12),                     -- FORMACAO | CURSOS | EXPERIENCIA | ETNICO
  "DS_DECLARADO" jsonb,                         -- as respostas da Empregare das perguntas do bloco
  "TP_SITUACAO_DOC" varchar(14),                -- CONFORME | NAO_CONFORME | NAO_ENVIADO | NAO_SE_APLICA
  "DS_MOTIVOS" jsonb,                           -- códigos dos motivos padronizados escolhidos
  "DS_MOTIVO_LIVRE" varchar(2000),
  "TP_EFEITO" varchar(30),                      -- efeito aplicado (ELIMINA, ZERA_PONTOS, ENCAMINHA_…, SO_REGISTRO…)
  "DS_APURADO" jsonb,                           -- opções confirmadas, aldeia, contadores…
  "VL_DECLARADO" numeric(8,4),
  "VL_APURADO" numeric(8,4),
  constraint "PK_TB_ITEM_FICHA_ANALISE" primary key ("CO_FICHA_ANALISE", "CO_BLOCO"),
  constraint "FK_FICHAANALISE_ITEMFICHA" foreign key ("CO_FICHA_ANALISE") references public."TB_FICHA_ANALISE" ("CO_FICHA_ANALISE"),
  constraint "CK_ITEMFICHA_TPBLOCO" check ("TP_BLOCO" in ('DOCUMENTO', 'PONTUACAO', 'COTA', 'TITULOS', 'VINCULOS', 'REGISTRO')),
  constraint "CK_ITEMFICHA_COPARCIAL" check ("CO_PARCIAL" is null or "CO_PARCIAL" in ('FORMACAO', 'CURSOS', 'EXPERIENCIA', 'ETNICO')),
  constraint "CK_ITEMFICHA_SITUACAO" check ("TP_SITUACAO_DOC" is null
    or "TP_SITUACAO_DOC" in ('CONFORME', 'NAO_CONFORME', 'NAO_ENVIADO', 'NAO_SE_APLICA')),
  constraint "CK_ITEMFICHA_VALORES" check (coalesce("VL_DECLARADO", 0) between 0 and 1000 and coalesce("VL_APURADO", 0) between 0 and 1000)
);
comment on table public."TB_ITEM_FICHA_ANALISE" is
  'Um bloco da ficha por documento ou pergunta do questionário (configurado na regra): o declarado, a situação (conforme, não conforme, não enviado, não se aplica), os motivos padronizados e livres, o efeito e os pontos.';
```

Um motivo é obrigatório em `NAO_CONFORME` e `NAO_ENVIADO`. Isso é conferido em `concluir_ficha`,
não no `check`, porque o rascunho pode estar incompleto.

## 8. `TB_TITULO_FICHA_ANALISE` — formação acadêmica

```sql
create table public."TB_TITULO_FICHA_ANALISE" (
  "CO_TITULO_FICHA" uuid not null default gen_random_uuid(),
  "CO_FICHA_ANALISE" uuid not null,
  "NU_ORDEM" smallint not null,
  "TP_NIVEL" varchar(16) not null,              -- GRADUACAO | ESPECIALIZACAO | RESIDENCIA | MESTRADO | DOUTORADO | CURSO
  "NO_CURSO" varchar(200),
  "NO_INSTITUICAO" varchar(200),
  "QT_CARGA_HORARIA" integer,
  "DS_COMPROVANTE" varchar(60),                 -- ex.: "Pergunta 16 - diploma"
  "ST_ACEITO" varchar(1) not null default 'S',
  "CO_MOTIVO" varchar(30),
  "DS_MOTIVO_LIVRE" varchar(1000),
  constraint "PK_TB_TITULO_FICHA_ANALISE" primary key ("CO_TITULO_FICHA"),
  constraint "UK_TITULOFICHA_ORDEM" unique ("CO_FICHA_ANALISE", "NU_ORDEM"),
  constraint "FK_FICHAANALISE_TITULOFICHA" foreign key ("CO_FICHA_ANALISE") references public."TB_FICHA_ANALISE" ("CO_FICHA_ANALISE"),
  constraint "CK_TITULOFICHA_NIVEL" check ("TP_NIVEL" in ('GRADUACAO', 'ESPECIALIZACAO', 'RESIDENCIA', 'MESTRADO', 'DOUTORADO', 'CURSO')),
  constraint "CK_TITULOFICHA_ACEITO" check ("ST_ACEITO" in ('S', 'N')),
  constraint "CK_TITULOFICHA_MOTIVO" check ("ST_ACEITO" = 'S' or "CO_MOTIVO" is not null or length("DS_MOTIVO_LIVRE") >= 10),
  constraint "CK_TITULOFICHA_CH" check ("QT_CARGA_HORARIA" is null or "QT_CARGA_HORARIA" between 1 and 20000)
);
comment on table public."TB_TITULO_FICHA_ANALISE" is 'Títulos da formação acadêmica (e cursos) lançados na ficha, aceitos ou não com motivo; pontuam pela regra (cumulativa ou o maior).';
```

## 9. `TB_VINCULO_EXPERIENCIA` — vínculos

```sql
create table public."TB_VINCULO_EXPERIENCIA" (
  "CO_VINCULO_EXPERIENCIA" uuid not null default gen_random_uuid(),
  "CO_FICHA_ANALISE" uuid not null,
  "NU_ORDEM" smallint not null,
  "NO_EMPREGADOR" varchar(200),                 -- empregador ou órgão
  "NO_CARGO" varchar(150),
  "CO_CATEGORIA" varchar(20) not null,          -- SAUDE_INDIGENA (desempate 1), ATENCAO_BASICA (2), AREA…
  "DT_INICIO" date not null,
  "DT_FIM" date not null,
  "TP_COMPROVANTE" varchar(20),                 -- CTPS | DECLARACAO | CONTRATO | CERTIDAO | OUTRO
  "ST_ACEITO" varchar(1) not null default 'S',
  "CO_MOTIVO" varchar(30),
  "DS_MOTIVO_LIVRE" varchar(1000),
  constraint "PK_TB_VINCULO_EXPERIENCIA" primary key ("CO_VINCULO_EXPERIENCIA"),
  constraint "UK_VINCULOEXP_ORDEM" unique ("CO_FICHA_ANALISE", "NU_ORDEM"),
  constraint "FK_FICHAANALISE_VINCULOEXP" foreign key ("CO_FICHA_ANALISE") references public."TB_FICHA_ANALISE" ("CO_FICHA_ANALISE"),
  constraint "CK_VINCULOEXP_DATAS" check ("DT_FIM" >= "DT_INICIO" and "DT_INICIO" >= date '1950-01-01'),
  constraint "CK_VINCULOEXP_ACEITO" check ("ST_ACEITO" in ('S', 'N')),
  constraint "CK_VINCULOEXP_MOTIVO" check ("ST_ACEITO" = 'S' or "CO_MOTIVO" is not null or length("DS_MOTIVO_LIVRE") >= 10)
);
comment on table public."TB_VINCULO_EXPERIENCIA" is 'Vínculos de experiência lançados na ficha; o banco une as sobreposições por categoria e no total para a nota, o mínimo exigido e os desempates.';
```

`private."FC_DIAS_SEM_SOBREPOSICAO"` usa `range_agg` de `daterange`, emenda os intervalos
encostados (no dia seguinte, como no simulador) e corta na data limite. A partir dele:

- meses = `floor(dias / dias_por_mes)`;
- pontos = `min(meses × pontos_por_mes, teto)` (ou pelas faixas);
- abaixo de `minimo_meses`, o efeito é `ELIMINA`;
- o estágio de indígena sem experiência vale `floor(horas / 8 / 22)`.

## 10. `TH_FICHA_ANALISE` e `TL_EVENTO_FICHA_ANALISE`

```sql
create table public."TH_FICHA_ANALISE" (
  "CO_FICHA_ANALISE" uuid not null,
  "NU_VERSAO" integer not null,
  "TP_ACAO" varchar(18) not null,               -- ABRIR, ATUALIZAR_EMPREGARE, ATRIBUIR, PEGAR, SALVAR, CONCLUIR, VALIDAR, DEVOLVER, REABRIR…
  "TP_SITUACAO" varchar(12) not null,
  "TP_RESULTADO" varchar(16),
  "VL_NOTA_FINAL" numeric(8,4),
  "DS_RETRATO" jsonb not null,                  -- ficha + blocos + títulos + vínculos + parecer
  "DS_HASH_RETRATO" varchar(64) not null,
  "DS_MOTIVO" varchar(2000),
  "CO_USUARIO" uuid not null,
  "DT_REGISTRO" timestamptz not null default now(),
  constraint "PK_TH_FICHA_ANALISE" primary key ("CO_FICHA_ANALISE", "NU_VERSAO"),
  constraint "FK_FICHAANALISE_THFICHA" foreign key ("CO_FICHA_ANALISE") references public."TB_FICHA_ANALISE" ("CO_FICHA_ANALISE"),
  constraint "CK_THFICHA_MOTIVO" check ("TP_ACAO" not in ('DEVOLVER', 'REABRIR', 'DEVOLVER_FILA', 'ATRIBUIR', 'LIBERAR_RESERVA')
    or length("DS_MOTIVO") >= 10)
);
comment on table public."TH_FICHA_ANALISE" is 'Retrato imutável da ficha a cada salvamento com mudança e a cada transição.';

create table public."TL_EVENTO_FICHA_ANALISE" (
  "CO_EVENTO_FICHA" bigint generated always as identity,
  "CO_FICHA_ANALISE" uuid not null,
  "TP_EVENTO" varchar(24) not null,             -- RESERVAR, LIBERAR, ABRIR_EMPREGARE, SITUACAO_BLOCO, MOTIVO_BLOCO,
                                                -- ACEITAR_VINCULO, RECUSAR_VINCULO, ACEITAR_TITULO, RECUSAR_TITULO,
                                                -- ALDEIA, OBSERVACAO_PRONTA, PEDIR_REVISAO…
  "CO_ALVO" varchar(40),                        -- bloco, vínculo ou título
  "DS_ANTES" jsonb,
  "DS_DEPOIS" jsonb,
  "CO_USUARIO" uuid not null,
  "DT_EVENTO" timestamptz not null default now(),
  constraint "PK_TL_EVENTO_FICHA_ANALISE" primary key ("CO_EVENTO_FICHA"),
  constraint "FK_FICHAANALISE_EVENTOFICHA" foreign key ("CO_FICHA_ANALISE") references public."TB_FICHA_ANALISE" ("CO_FICHA_ANALISE")
);
create index "IN_EVENTOFICHA_FICHA" on public."TL_EVENTO_FICHA_ANALISE" ("CO_FICHA_ANALISE", "DT_EVENTO");
comment on table public."TL_EVENTO_FICHA_ANALISE" is 'Cliques relevantes na ficha (auditoria fina), imutáveis; nunca guarda CPF nem conteúdo de documento.';
```

O gatilho `private."FC_TG_HISTORICO_IMUTAVEL"` recusa `update` e `delete` nas duas tabelas. O
retrato completo vai a cada salvamento com diferença (no máximo um por minuto por pessoa e ficha) e
a cada transição.

## 11. `TL_ACESSO_FICHA_ANALISE` (LGPD) e `TB_ANEXO_EMPREGARE` (fase B)

```sql
create table public."TL_ACESSO_FICHA_ANALISE" (
  "CO_ACESSO_FICHA" bigint generated always as identity,
  "CO_FICHA_ANALISE" uuid not null,
  "TP_ACESSO" varchar(16) not null,             -- ABRIR_FICHA | REVELAR_CPF | REVELAR_PARENTE | ABRIR_EMPREGARE | ABRIR_ANEXO | IMPRIMIR
  "DS_ALVO" varchar(120),
  "CO_USUARIO" uuid not null,
  "DT_ACESSO" timestamptz not null default now(),
  constraint "PK_TL_ACESSO_FICHA_ANALISE" primary key ("CO_ACESSO_FICHA"),
  constraint "FK_FICHAANALISE_ACESSOFICHA" foreign key ("CO_FICHA_ANALISE") references public."TB_FICHA_ANALISE" ("CO_FICHA_ANALISE"),
  constraint "CK_ACESSOFICHA_TPACESSO" check ("TP_ACESSO" in
    ('ABRIR_FICHA', 'REVELAR_CPF', 'REVELAR_PARENTE', 'ABRIR_EMPREGARE', 'ABRIR_ANEXO', 'IMPRIMIR'))
);
comment on table public."TL_ACESSO_FICHA_ANALISE" is 'Acessos a dado pessoal e a documentos (LGPD); imutável; só coordenação e administrador global leem.';
-- TP_ACESSO ganha também COPIAR_CODIGO (o "Copiar" do código do candidato para a busca da Empregare).

create table public."TB_ANEXO_EMPREGARE" (
  "CO_ANEXO_EMPREGARE" uuid not null default gen_random_uuid(),
  "CO_EMPREGARE_CANDIDATO" uuid not null,
  "NU_PERGUNTA" smallint not null,
  "DS_CAMINHO_STORAGE" varchar(300) not null,
  "DS_TIPO_MIME" varchar(80) not null,
  "QT_BYTES" integer not null,
  "DS_HASH" varchar(64) not null,
  "DT_BAIXADO" timestamptz not null default now(),
  "DT_DESCARTE_PREVISTO" date,
  constraint "PK_TB_ANEXO_EMPREGARE" primary key ("CO_ANEXO_EMPREGARE"),
  constraint "UK_ANEXOEMPREGARE_HASH" unique ("CO_EMPREGARE_CANDIDATO", "NU_PERGUNTA", "DS_HASH"),
  constraint "FK_EMPREGARECAND_ANEXOEMPREG" foreign key ("CO_EMPREGARE_CANDIDATO")
    references public."TB_EMPREGARE_CANDIDATO" ("CO_EMPREGARE_CANDIDATO"),
  constraint "CK_ANEXOEMPREG_BYTES" check ("QT_BYTES" between 1 and 52428800)
);
comment on table public."TB_ANEXO_EMPREGARE" is 'Fase B: documentos do questionário baixados pelo robô para um bucket privado; abertos por URL assinada curta, com registro.';
```

## 12. Mudanças em tabelas existentes

```sql
-- endereços da Empregare capturados pelo robô (fase F7): dados restritos, nunca em lista, CSV ou log
alter table public."TB_EMPREGARE_VAGA"
  add column "DS_URL_CANDIDATURAS" varchar(400),        -- /empresa/vagas/candidaturas/<token-da-vaga>?m=<aba Todos>
  add column "TP_ORIGEM_URL" varchar(10),               -- ROBO | MANUAL
  add column "DT_CAPTURA_URL" timestamptz,
  add constraint "CK_EMPREGAREVAGA_ORIGEMURL" check ("TP_ORIGEM_URL" is null or "TP_ORIGEM_URL" in ('ROBO', 'MANUAL')),
  add constraint "CK_EMPREGAREVAGA_URL" check ("DS_URL_CANDIDATURAS" is null
    or "DS_URL_CANDIDATURAS" like 'https://corporate.empregare.com/empresa/vagas/candidaturas/%');
alter table public."TB_EMPREGARE_CANDIDATO"
  add column "DS_URL_CURRICULO" varchar(500),           -- /empresa/curriculo/detalhes?tokenCandidato=…&id=…&candidatura=…
  add column "DT_CAPTURA_URL" timestamptz,
  add constraint "CK_EMPREGARECAND_URL" check ("DS_URL_CURRICULO" is null
    or "DS_URL_CURRICULO" like 'https://corporate.empregare.com/empresa/curriculo/detalhes?%');
-- Os tokens mudam: o robô sobrescreve a cada execução e casa o candidato por data-pessoa-id = CO_CANDIDATO_EMPREGARE.
-- Uma URL MANUAL da vaga só é trocada quando o robô captura uma nova.

-- origens da Avaliação documental
insert into public."TB_PLANILHA_ANALISE" ("CO_PLANILHA", "CO_AREA", "NO_PLANILHA", "DS_PLANILHA_ID") values
  ('monitora-saude-indigena', 'saude-indigena', 'MONITORA (Avaliação documental) - Saúde Indígena', null),
  ('monitora-sede',           'sede',           'MONITORA (Avaliação documental) - SEDE',            null),
  ('monitora-projetos',       'projetos',       'MONITORA (Avaliação documental) - Projetos',        null);

-- as duas listas oficiais novas
alter table public."TB_LISTA_CLASSIFICACAO" drop constraint "CK_LISTACLASSIF_TPLISTA";
alter table public."TB_LISTA_CLASSIFICACAO" add constraint "CK_LISTACLASSIF_TPLISTA"
  check ("TP_LISTA" in ('PROVISORIA', 'LOTE', 'PRELIMINAR', 'CONVOCACAO', 'ENTREVISTA', 'FINAL'));
```

Com isso, `TIPOS_DE_LISTA` (em `src/lib/classificacao/catalogo.js`) ganha `PROVISORIA` ("Lista
provisória por ART") e `LOTE` ("Lote de convocação"), e `documento-sei.js` ganha os modelos
`PROVISORIA` (item 8.3.1) e `LOTE` (item 8.4). A `PRELIMINAR` passa a usar o parecer da ficha
como "Justificativa" dos inaptos.

## 13. Publicação em `TB_ANALISE_CURRICULAR`

`private."FC_PUBLICAR_FICHA"` roda só quando o edital está em `MONITORA`:

| Coluna | Valor |
|---|---|
| `id` | adotado da planilha ou novo |
| `CO_PLANILHA` / `CO_AREA` | `monitora-<área>` / área do edital |
| `grupo`, `unidade`, `edital`, `codigo_vaga`, `nome_vaga`, `categoria`, `regime`, `carga_horaria` | edital e vaga |
| `candidato`, `id_origem` | NOME e CÓDIGO da Empregare (a `chave_natural` fica igual à da planilha) |
| `data_nascimento`, `idade`, `pcd`, `modalidade_concorrencia` | Empregare e ficha |
| `nota_empregare` | **ART** (a Classificação a lê como `nota_art`) |
| `status_consolidado` / `etapa` | pelos `situacoes` da regra (Apto → Aprovado/"Triados"; Inapto → Reprovado/"Reprovado"); Pendente/Revisar durante a avaliação |
| `responsavel_analise`, `data_analise` | do login e da conclusão |
| as quatro `pontuacao_*`, `nota_final_ajustada`, `somatorio` | parciais e nota (0 se inapto por requisito) |
| `experiencia_*_total` (e anos/meses/dias) | `QT_DIAS_*`, na unidade da planilha |
| `analise` | `DS_PARECER` |
| `ativo` | `true`; `FORA_LOTE` → `false` |

Depois de publicar, a função marca o cache do Painel das análises como vencido, para o painel
mostrar a mudança na hora.

## 14. RPCs (todas `public`, `SECURITY DEFINER`, `set search_path to ''`, em `rpc-contrato.js`)

| RPC | Quem | O que faz |
|---|---|---|
| `obter_provisoria(p_edital, p_vaga)` | Leitor+ | contadores, Provisória por ART, lote, primeiros de fora e eliminados com motivo |
| `obter_fila_avaliacao(p_edital, p_filtros, p_pagina)` | Leitor+ | indicadores e fichas do lote (sem CPF) |
| `abrir_ficha_por_codigo(p_edital, p_codigo)` | papel no edital | busca por código Empregare |
| `salvar_url_candidaturas_vaga(p_vaga, p_url)` | gestor ou coordenador do edital da vaga | cadastro manual do endereço de candidaturas (só endereço da Empregare; `TP_ORIGEM_URL = MANUAL`) |
| `gravar_urls_empregare(p_sync, p_lote jsonb)` | robô (`service_role`) | grava `DS_URL_CANDIDATURAS` por vaga e `DS_URL_CURRICULO` por candidato (casando `data-pessoa-id`), com `DT_CAPTURA_URL` |
| `pegar_proxima_ficha(p_edital, p_vaga)` | analista (modo `PEGAR_PROXIMO`) | reserva atômica na ordem da Provisória |
| `distribuir_fichas(p_edital, p_config)` | gestor ou coordenador | distribuição inicial ou redistribuição, com prévia |
| `atribuir_fichas(p_fichas, p_usuario, p_motivo)` | gestor ou coordenador | atribui ou redistribui |
| `reservar_ficha(p_ficha)` / `renovar_reserva(p_ficha)` / `liberar_reserva(p_ficha, p_motivo)` | responsável / coordenação | trava de concorrência (15 min) |
| `obter_ficha(p_ficha)` | papel no edital (Leitor: só concluída) | ficha, blocos com o declarado, títulos, vínculos, regra da versão, sinais, histórico e o link "Abrir na Empregare" (o currículo, se capturado; senão, as candidaturas da vaga, mais o código para copiar); registra `ABRIR_FICHA` |
| `buscar_aldeia_dsei(p_ficha, p_texto)` | papel no edital | autocompletar da aldeia |
| `revelar_dado_ficha(p_ficha, p_campo)` / `registrar_acesso_ficha(p_ficha, p_tipo, p_alvo)` | papel na ficha | LGPD |
| `salvar_ficha(p_ficha, p_versao, p_dados)` | quem tem a reserva | rascunho (blocos, títulos, vínculos, aldeia, estágio, observações); recalcula efeitos, nota, desempates, resultado e parecer; grava os eventos |
| `concluir_ficha(p_ficha, p_versao)` | responsável | confere os motivos obrigatórios, conclui, sorteia a revisão, publica e faz a linha andar |
| `pedir_revisao_ficha`, `validar_ficha`, `devolver_ficha`, `reabrir_ficha` | como no README | transições com motivo |
| `obter_regra_analise` / `salvar_regra_analise` / `simular_regra_analise` / `copiar_modelo_regra_analise` | Leitor / coordenação | regra versionada; lista as perguntas e as respostas encontradas na carga |
| `salvar_aldeias_dsei(p_unidade, p_aldeias, p_fonte)` | administrador global | lista de aldeias |
| `salvar_equipe_edital(p_edital, p_equipe, p_motivo)` | gestor ou coordenador | equipe |
| `definir_origem_analise(p_edital, p_origem, p_motivo)` | administrador global | comparação e virada |
| `abrir_fichas_do_edital(p_edital)` | coordenação e robô (`service_role`) | recalcula a Provisória e o lote e cria as fichas do lote |
| `obter_comparacao_analise(p_edital)` | coordenação | planilha × MONITORA |
| `obter_produtividade_analise(p_edital, p_de, p_ate)` | coordenação | produtividade, motivos e encaminhamentos |
| `gerar_lista_classificacao` (já existe) | Editor de Classificação | passa a aceitar `PROVISORIA` e `LOTE` |

Funções privadas:

- regra: `FC_VALIDAR_REGRA_ANALISE`, `FC_LINK_EMPREGARE` (escolhe currículo, vaga ou só o código);
- Provisória e lote: `FC_NOTA_DECLARADA`, `FC_PRE_CLASSIFICAR_VAGA`, `FC_TAMANHO_LOTE`;
- pontuação: `FC_EFEITO_DO_BLOCO`, `FC_PONTOS_DOS_TITULOS`, `FC_DIAS_SEM_SOBREPOSICAO`,
  `FC_FAIXA_EM_MESES`;
- resultado e parecer: `FC_NOTA_DA_FICHA`, `FC_RESULTADO_DA_FICHA`, `FC_PARECER_DA_FICHA`,
  `FC_SINAIS_DA_FICHA`;
- fluxo: `FC_SORTEAR_REVISAO`, `FC_PUBLICAR_FICHA`, `FC_PAPEL_NO_EDITAL`;
- gatilhos: `FC_TG_FICHA_ANALISE_FLUXO`, `FC_TG_HISTORICO_IMUTAVEL`.

A mesma conta existe em `src/lib/avaliacao-documental/` (pura e testada), e um conjunto de casos
compartilhado, que inclui os do simulador, garante que a tela e o banco dão o mesmo número.

Erros: `42501` (sem permissão), `40001` (a ficha mudou), `55P03` (ficha reservada por outra
pessoa), `22023` (dado ou passagem inválida).

## 15. Ordem sugerida das migrations

1. O recurso `avaliacao_documental` e o menu; origem por edital, regra e modelos, aldeias, equipe e
   `TB_PRE_CLASSIFICACAO`. Com isso, já dá para comparar a Provisória e o lote com a planilha do
   piloto de Projetos.
2. Fichas, blocos, títulos, vínculos, reserva, histórico, eventos, acesso e as RPCs de trabalho:
   piloto em `COMPARACAO`.
3. Publicação e virada: piloto em `MONITORA`.
4. Listas `PROVISORIA` e `LOTE` na Classificação e os modelos do SEI.
5. Anexos (fase B) e "Em análise" no painel.
6. Desligamento da carga das planilhas.

Cada uma com `ensaios/` e `rollback/`.
