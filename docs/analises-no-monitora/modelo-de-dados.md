# Análise no MONITORA — proposta de modelo de dados

**Só proposta.** Não há migration e nada foi aplicado no banco. O desenho funcional está no
[README](README.md). Esta proposta segue o padrão MAD (PDTIC 2026–2027, resumo em
`docs/padronizacao_nomenclatura_*.md`; revisar com a skill `mad-ddl-review` antes de virar
migration):

- identificadores em MAIÚSCULAS entre aspas, com até 30 caracteres;
- prefixos `TB_` (sistema), `TH_` (histórico), `TL_` (log), `RL_` (relacionamento), `TD_`
  (domínio), `VW_` (view), `PK_`/`FK_`/`UK_`/`CK_`/`IN_`;
- colunas `CO_` (código/chave), `NO_` (nome), `DS_` (descrição/JSON), `DT_` (data/hora), `VL_`
  (valor), `QT_` (quantidade), `NU_` (número), `TP_` (tipo/situação), `ST_` (flag S/N);
- `COMMENT` em toda tabela, coluna, restrição e índice (abaixo, só os das tabelas, por brevidade);
- RLS ligado e `revoke all` de `public`, `anon` e `authenticated`: acesso **só por RPC**
  `SECURITY DEFINER` com `set search_path to ''`, conferindo área, recorte da coordenação, nível
  (`private.pode_recurso('analises', n)`) e papel no edital;
- histórico imutável por gatilho (o modelo é o de `TB_AJUSTE_PONTUACAO_RECURSO`, migration
  `20261005130000`).

Tabelas que já existem e são reaproveitadas:

- `TB_ANALISE_CURRICULAR`: destino da publicação;
- `TB_PLANILHA_ANALISE`: ganha as linhas `monitora-*`;
- `TB_EMPREGARE_CANDIDATO` / `TB_EMPREGARE_VAGA`: origem;
- `TB_MONITORAMENTO_INDIGENA`: o edital;
- `TD_UNIDADE`: o DSEI ou a unidade;
- `TH_REGRA_CLASSIFICACAO`: nota de corte, casas e arredondamento;
- `TB_AJUSTE_PONTUACAO_RECURSO`: o recurso.

## Visão geral

```
TB_MONITORAMENTO_INDIGENA (edital)
  ├─ TB_ORIGEM_ANALISE_EDITAL ── TH_ORIGEM_ANALISE_EDITAL      quem é o dono da análise do edital
  ├─ TB_REGRA_ANALISE ────────── TH_REGRA_ANALISE             regra da análise versionada (JSON)
  ├─ RL_ANALISTA_EDITAL                                       equipe: analista, revisor, coordenador
  ├─ TB_PRE_CLASSIFICACAO (1 por candidato × vaga)            nota declarada, posição, linha de corte, eliminação automática
  └─ TB_FICHA_ANALISE  (1 por candidato × vaga; liga TB_EMPREGARE_CANDIDATO e TB_ANALISE_CURRICULAR)
       ├─ TB_ITEM_FICHA_ANALISE          checklist (eliminatórios) e critérios pontuados
       ├─ TB_VINCULO_EXPERIENCIA         vínculos comprovados (categoria, início, fim)
       ├─ TH_FICHA_ANALISE               retrato imutável a cada salvamento/transição
       └─ TL_ACESSO_FICHA_ANALISE        quem revelou CPF / abriu anexo
TD_UNIDADE (DSEI) ── TD_ALDEIA_DSEI                           lista oficial de aldeias do DSEI
TB_REGRA_ANALISE_MODELO                                       modelos de regra para copiar
TB_ANEXO_EMPREGARE (fase B): anexos baixados pelo robô, no Storage privado
```

## 1. `TB_ORIGEM_ANALISE_EDITAL` — o dono da análise de cada edital

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
  'Dono da análise curricular de cada edital: PLANILHA (Apps Script, como antes), COMPARACAO (o MONITORA analisa em paralelo e não publica) ou MONITORA (fichas publicam em TB_ANALISE_CURRICULAR). Edital sem linha = PLANILHA.';

create table public."TH_ORIGEM_ANALISE_EDITAL" (
  "CO_MONITORAMENTO" uuid not null,
  "NU_SEQUENCIA" integer not null,
  "TP_ORIGEM_ANTERIOR" varchar(10),
  "TP_ORIGEM" varchar(10) not null,
  "DS_MOTIVO" varchar(2000) not null,
  "DS_RESULTADO" jsonb,              -- linhas adotadas, fichas criadas, conferências da virada
  "CO_USUARIO" uuid not null,
  "DT_REGISTRO" timestamptz not null default now(),
  constraint "PK_TH_ORIGEM_ANALISE_EDITAL" primary key ("CO_MONITORAMENTO", "NU_SEQUENCIA"),
  constraint "FK_ORIGANALEDT_THORIGANALEDT" foreign key ("CO_MONITORAMENTO")
    references public."TB_ORIGEM_ANALISE_EDITAL" ("CO_MONITORAMENTO"),
  constraint "CK_THORIGANALEDT_MOTIVO" check (length("DS_MOTIVO") between 10 and 2000)
);
comment on table public."TH_ORIGEM_ANALISE_EDITAL" is
  'Histórico imutável das trocas de dono da análise do edital, com o resumo da virada.';
```

Regras no banco:

- `PLANILHA → COMPARACAO → MONITORA`. Voltar de `MONITORA` para `PLANILHA` só com o administrador
  global e só se nenhuma ficha foi concluída depois da virada.
- Virar para `MONITORA` exige que o edital esteja **inativo** em `TB_EDITAL_ANALISE` da planilha (a
  planilha parou de enviar) e que não haja carga em andamento daquela planilha em
  `TL_SYNC_ANALISE`. Senão, recusa com a mensagem do que falta.

## 2. `TB_REGRA_ANALISE` / `TH_REGRA_ANALISE` — regra da análise versionada

Mesmo desenho de `TB_REGRA_CLASSIFICACAO` / `TH_REGRA_CLASSIFICACAO`:

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
comment on table public."TB_REGRA_ANALISE" is
  'Regra da análise curricular de um edital (checklist, critérios, pontos, tetos, textos do parecer). A versão vigente aponta para TH_REGRA_ANALISE.';

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
comment on table public."TH_REGRA_ANALISE" is
  'Versões imutáveis da regra da análise; cada ficha guarda a versão com que foi pontuada.';

create table public."TB_REGRA_ANALISE_MODELO" (
  "CO_MODELO" varchar(30) not null,             -- ex.: SI26-INTERIOR-SUL, SI26-83, PROJ26-CURRICULAR
  "NO_MODELO" varchar(200) not null,
  "DS_CONFIGURACAO" jsonb not null,
  "ST_ATIVO" varchar(1) not null default 'S',
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_REGRA_ANALISE_MODELO" primary key ("CO_MODELO"),
  constraint "CK_REGRAANALMOD_STATIVO" check ("ST_ATIVO" in ('S', 'N'))
);
comment on table public."TB_REGRA_ANALISE_MODELO" is
  'Modelos de regra da análise (textos-base dos editais) para copiar num edital novo.';
```

### 2.1 Formato de `DS_CONFIGURACAO`

O formato é validado por `private."FC_VALIDAR_REGRA_ANALISE"`, com as mesmas regras em
`src/lib/analise/regra-da-analise.js`, para a tela. O exemplo abaixo é a regra do simulador do
28/2026, com textos encurtados e comentários `//` só para leitura. Os blocos de eliminação automática
e nota declarada usam os pesos vistos na planilha de vaga do 100/2026 (indígena +8, aldeia +6), de
propósito diferentes dos do simulador (+7, +5): cada edital tem os seus.

```json
{
  "schema": 1,
  "modelo": "SI26-INTERIOR-SUL",
  "edital_rotulo": "Edital 28/2026",
  "niveis": {
    "por_cargo": [{ "nivel": "tecnico_medio", "termo": "Técnico" }, { "nivel": "fundamental", "termo": "Agente" }],
    "padrao": "superior"
  },
  "corte": { "fonte": "REGRA_CLASSIFICACAO", "item_edital": "7.13.1" },
  "eliminacao_automatica": [
    { "codigo": "CANCELADO", "coluna": "SITUAÇÃO", "quando": ["CANCELADO"], "motivo": "Cancelou a inscrição" },
    { "codigo": "QUESTIONARIO", "coluna_prefixo": "SITUAÇÃO - ", "exceto": ["FINALIZADO"], "motivo": "Não finalizou o questionário" },
    { "codigo": "REPROVADO_EMPREGARE", "coluna": "REPROVADO", "quando": ["SIM"], "motivo": "Reprovado na Empregare" }
  ],
  "nota_declarada": {
    "itens": [
      { "parcial": "FORMACAO", "pergunta": "Pergunta 15 -", "tipo": "OPCAO",
        "pontos": { "Especialização na área à qual concorre": 1, "Não possuo": 0 } },
      { "parcial": "EXPERIENCIA", "pergunta": "Pergunta 17 -", "tipo": "FAIXA_EM_MESES",
        "pontos_por_mes": 0.2, "teto": 10, "sem_experiencia": ["Não possuo"] },
      { "parcial": "ETNICO", "pergunta": "Pergunta 6 -", "tipo": "OPCOES_SOMADAS",
        "pontos": { "Sou indígena": 8, "Moro em aldeia": 6 }, "teto": 14 }
    ],
    "desempate": ["IDADE_60", "DATA_CANDIDATURA"]
  },
  "linha_corte": {
    "base": "MULTIPLO_VAGAS",              // MULTIPLO_VAGAS | FIXO
    "multiplo": 5, "inclui_cr": true, "fixo": null,
    "por_modalidade": false, "inclui_empatados": true,
    "linha_anda": true                     // inabilitado/não habilitado sai → o próximo entra
  },
  "distribuicao": { "modo": "PEGAR_PROXIMO", // PEGAR_PROXIMO | INICIAL
                    "inicial": { "criterio": "PARTES_IGUAIS", "novos": "MENOS_PENDENTES" } },
  "revisao": { "amostra_percentual": 10, "minimo_por_analista": 5, "todas": false,
               "inabilitadas": true, "nao_habilitadas": false, "divergencia_pontos": 2,
               "sinais": ["VINCULO_ATIVO", "PARENTESCO"], "entrou_pela_linha": false, "duplo_cego": false },

  "checklist": [
    { "codigo": "ID_CPF", "rotulo": "ID/CPF: documentos legíveis e válidos", "item_edital": "3.4.1 c/d",
      "motivo": "Item 3.4.1 ('c' e 'd'): Ausência ou irregularidade no Documento de Identidade oficial com foto e/ou CPF.",
      "comprovante": "Pergunta 4 -" },
    { "codigo": "ESCOLARIDADE_MIN", "rotulo": "Escolaridade mínima", "item_edital": "3.1.1",
      "motivo": "Item 3.1.1: Não comprovação da escolaridade mínima exigida.",
      "pergunta": "Pergunta 13 -", "sinal_nao_cumpre": ["\"Não\""] },
    { "codigo": "EXP_MINIMA", "rotulo": "Experiência mínima: 1 mês na área", "item_edital": "3.1.1 c", "motivo": "…" },
    { "codigo": "COMPROVACAO", "rotulo": "CTPS sem páginas extras, declarações assinadas", "item_edital": "7.5", "motivo": "…" },
    { "codigo": "ARQUIVO_UNICO", "rotulo": "Todos os documentos em um único PDF", "item_edital": "7.7", "motivo": "…" },
    { "codigo": "DECL_ETNICA", "rotulo": "Declaração étnica (Anexo VI) assinada pelas lideranças", "item_edital": "7.3",
      "condicao": "INDIGENA", "motivo": "…" }
  ],

  "etnico": {
    "parcial": "ETNICO", "pergunta": "Pergunta 6 -", "modalidade_indigena": ["Indígenas"],
    "indigena": 7, "aldeia": 5, "teto": 12,   // no 100/2026: 8, 6 e 14 — nada fixo no código
    "aldeia_exige_lista": true, "lista_aldeias": "DSEI_DO_EDITAL", "item_edital": "7.2.2"
  },

  "escolaridade": {
    "parcial": "FORMACAO", "cumulativa": false, "pergunta": "Pergunta 15 -",
    "por_nivel": {
      "superior":      [["Graduação", 0], ["Especialização", 1], ["Mestrado/Residência", 2], ["Doutorado", 3]],
      "tecnico_medio": [["Ensino médio/técnico", 0], ["Graduação", 3]],
      "fundamental":   [["Ensino fundamental", 0], ["Ensino médio", 3]]
    }
  },

  "cursos": {
    "parcial": "CURSOS", "teto": 5, "max_certificados": null,
    "faixas": [{ "rotulo": "≥ 81 horas", "pontos": 0.5 }, { "rotulo": "41 a 80 h", "pontos": 0.3 }, { "rotulo": "≤ 40 horas", "pontos": 0.2 }]
  },

  "experiencia": {
    "parcial": "EXPERIENCIA", "pergunta": "Pergunta 17 -",
    "categorias": [
      { "codigo": "SAUDE_INDIGENA", "rotulo": "Saúde Indígena", "pontua": true, "desempate": 1 },
      { "codigo": "ATENCAO_BASICA", "rotulo": "Atenção Básica", "pontua": true, "desempate": 2 },
      { "codigo": "SAUDE_GERAL", "rotulo": "Saúde Geral / Residência", "pontua": true, "desempate": null }
    ],
    "max_vinculos": 10, "unir_sobreposicao": true, "dias_por_mes": 30, "so_meses_inteiros": true,
    "pontos_por_mes": 0.2, "faixas": null, "teto": 10, "conta_ate": "DATA_CORTE",
    "estagio_indigena": { "ativo": true, "item_edital": "7.5.7.2", "horas_por_dia": 8, "dias_por_mes": 22,
                          "so_sem_experiencia": true }
  },

  "situacoes": {
    "HABILITADO":     { "rotulo": "Habilitado",                     "etapa": "Triados" },
    "NAO_HABILITADO": { "rotulo": "Não habilitado (nota de corte)", "etapa": "Reprovado" },
    "INABILITADO":    { "rotulo": "Inabilitado (admissibilidade)",  "etapa": "Reprovado", "nota_zero": true }
  },

  "parecer": {
    "HABILITADO":     "{edital}\nCandidato(a) HABILITADO(A) para a próxima etapa com a pontuação total de {nota} pontos, distribuídos da seguinte forma:\n\n{distribuicao}",
    "NAO_HABILITADO": "{edital}\nCandidato(a) NÃO HABILITADO(A) por não atingir a nota de corte de {corte} pontos estabelecida no edital (Item {item_corte}) para a etapa de Análise Curricular. Nota obtida: {nota} pontos, distribuídos da seguinte forma:\n\n{distribuicao}",
    "INABILITADO":    "{edital}\nCandidato(a) INABILITADO(A) por descumprimento das normativas de admissibilidade, devido ao(s) seguinte(s) motivo(s):\n\n{motivos}",
    "observacoes":    "\n\nObservações da Análise:\n{observacoes}"
  },

  "observacoes_prontas": [
    { "codigo": "SEM_DETALHAMENTO", "rotulo": "Sem detalhamento", "item_edital": "7.5 b", "texto": "Conforme subitem 7.5 ('b'), …" },
    { "codigo": "CURSOS_DIMINUIDA", "rotulo": "Nota de cursos diminuída", "marca_reducao": "CURSOS", "texto": "…" },
    { "codigo": "ALDEIA_FORA_DSEI", "rotulo": "Aldeia fora do DSEI", "item_edital": "7.2.2", "texto": "…{dsei}…" }
  ],

  "sinais": [
    { "codigo": "TERMO_RECUSADO", "pergunta": "Pergunta 23 -", "quando": ["não estou de acordo"], "tom": "perigo" },
    { "codigo": "VINCULO_ATIVO", "pergunta": "Pergunta 21 -", "quando": ["\"Sim\""], "tom": "alerta" },
    { "codigo": "PARENTESCO", "pergunta": "Pergunta 19 -", "quando": ["\"Sim\""], "tom": "alerta" }
  ]
}
```

Notas:

- `parcial` ∈ `FORMACAO | CURSOS | EXPERIENCIA | ETNICO`: as mesmas da Classificação
  (`PARCIAIS_DA_DOCUMENTAL`) e de `CK_ITEMAJUSTEPONT_COITEM`.
- Experiência por **faixas**, como no 30/2026 ("6 meses 1, 1 ano 3, +3 por ano, máx 30"):
  `"faixas": [{ "a_partir_meses": 6, "pontos": 1 }, { "a_partir_meses": 12, "pontos": 3 }],
  "incremento_por_ano": 3`, com `pontos_por_mes: null`.
- Escolaridade e cursos de outros editais (titulação 10/12/15; cursos 1/2/3 por quantidade) cabem no
  mesmo formato: `por_nivel` e `faixas`, ou `por_quantidade: [[1,1],[2,2],[3,3]]`.
- `corte.fonte = "REGRA_CLASSIFICACAO"` lê `documental.nota_minima_por_nivel[nível]` ou
  `documental.nota_minima` da regra de classificação vigente (uma só fonte). Sem nota mínima, não
  há "Não habilitado".

## 3. `TD_ALDEIA_DSEI` — lista oficial de aldeias

```sql
create table public."TD_ALDEIA_DSEI" (
  "CO_ALDEIA_DSEI" uuid not null default gen_random_uuid(),
  "CO_UNIDADE" bigint not null,                 -- o DSEI (TD_UNIDADE); conferir o tipo de id na migration
  "NO_ALDEIA" varchar(200) not null,            -- ex.: "SEDE - JOSÉ BOITEUX"
  "CO_POLO" varchar(20),                        -- o número entre parênteses no simulador, ex.: 1511
  "NO_EXIBICAO" varchar(230) not null,          -- "SEDE - JOSÉ BOITEUX-(1511)", o que o analista busca
  "ST_ATIVO" varchar(1) not null default 'S',
  "DS_FONTE" varchar(300) not null,             -- de onde veio a lista (ofício, planilha do DSEI)
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TD_ALDEIA_DSEI" primary key ("CO_ALDEIA_DSEI"),
  constraint "UK_ALDEIADSEI_NOME" unique ("CO_UNIDADE", "NO_EXIBICAO"),
  constraint "FK_UNIDADE_ALDEIADSEI" foreign key ("CO_UNIDADE") references public."TD_UNIDADE" (id),
  constraint "CK_ALDEIADSEI_STATIVO" check ("ST_ATIVO" in ('S', 'N'))
);
create index "IN_ALDEIADSEI_BUSCA" on public."TD_ALDEIA_DSEI" ("CO_UNIDADE", lower("NO_EXIBICAO"));
comment on table public."TD_ALDEIA_DSEI" is
  'Aldeias oficiais de cada DSEI, para validar o "mora em aldeia" do critério étnico. A primeira carga é a lista do DSEI Interior Sul usada no simulador do edital 28/2026.';
```

A ficha guarda a aldeia escolhida por `CO_ALDEIA_DSEI`. A validade é conferida no banco: aldeia
desativada depois continua valendo nas fichas já concluídas (o retrato guarda o nome).

## 4. `RL_ANALISTA_EDITAL` — equipe do edital

```sql
create table public."RL_ANALISTA_EDITAL" (
  "CO_ANALISTA_EDITAL" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "CO_USUARIO" uuid not null,
  "TP_PAPEL" varchar(12) not null,
  "CO_VAGA" text,                         -- nulo = todas as vagas do edital
  "QT_LIMITE_FICHA" integer,              -- teto na distribuição (nulo = sem teto)
  "ST_ATIVO" varchar(1) not null default 'S',
  "CO_USUARIO_ATUALIZACAO" uuid not null,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_RL_ANALISTA_EDITAL" primary key ("CO_ANALISTA_EDITAL"),
  constraint "FK_MONITORAMENTO_ANALISTAEDT" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_USUARIO_ANALISTAEDT" foreign key ("CO_USUARIO") references auth.users (id),
  constraint "CK_ANALISTAEDT_TPPAPEL" check ("TP_PAPEL" in ('ANALISTA', 'REVISOR', 'COORDENADOR')),
  constraint "CK_ANALISTAEDT_STATIVO" check ("ST_ATIVO" in ('S', 'N')),
  constraint "CK_ANALISTAEDT_LIMITE" check ("QT_LIMITE_FICHA" is null or "QT_LIMITE_FICHA" between 1 and 5000)
);
create unique index "UK_ANALISTAEDT_PAPEL" on public."RL_ANALISTA_EDITAL"
  ("CO_MONITORAMENTO", "CO_USUARIO", "TP_PAPEL", coalesce("CO_VAGA", '')) where "ST_ATIVO" = 'S';
comment on table public."RL_ANALISTA_EDITAL" is
  'Equipe da análise de cada edital (substitui a aba DIM_RESPONSAVEIS): analista, revisor ou coordenador, no edital inteiro ou numa vaga.';
```

Desativar não apaga (guarda quem foi da equipe). O **gestor do edital** (o responsável cadastrado
no edital) é tratado como COORDENADOR por `FC_PAPEL_NO_EDITAL`, sem precisar de linha aqui; o
coordenador da área recebe o papel nesta tabela. Os dois podem cadastrar a regra, distribuir e
configurar a revisão (decidido em 05/10/2026).

## 4b. `TB_PRE_CLASSIFICACAO` — nota declarada, linha de corte e eliminação automática

Substitui as abas IMPORTACAO EMPREGARE, TOTAL DE CANDIDATOS, ELIMINADOS e APTOS PARA ANÁLISE da
planilha de vaga. É recalculada por `private."FC_PRE_CLASSIFICAR_VAGA"` no fim de cada carga do robô
e sempre que uma ficha da vaga é concluída (para "a linha andar").

```sql
create table public."TB_PRE_CLASSIFICACAO" (
  "CO_MONITORAMENTO" uuid not null,
  "CO_VAGA" text not null,
  "CO_EMPREGARE_CANDIDATO" uuid not null,
  "NU_VERSAO_REGRA" integer not null,
  "TP_SITUACAO" varchar(12) not null,           -- ELIMINADO | RANQUEADO | NA_LINHA | ANALISADO
  "CO_MOTIVO_ELIMINACAO" varchar(30),           -- código da eliminação automática da regra
  "VL_NOTA_DECLARADA" numeric(8,4),
  "DS_NOTA_DECLARADA" jsonb,                    -- pontos por parcial e as respostas usadas
  "VL_NOTA_EMPREGARE" numeric(8,4),             -- "x/30" do questionário, só referência
  "NO_MODALIDADE" varchar(60),
  "NU_POSICAO" integer,                         -- posição geral na vaga (nula se eliminado)
  "NU_POSICAO_MODALIDADE" integer,
  "NO_ORIGEM_CONVOCACAO" varchar(40),           -- ex.: AMPLA, COTA, LINHA_ANDOU (P15)
  "DS_MOTIVO_ENTRADA" varchar(300),             -- "entrou porque <código> foi inabilitado"
  "DT_ENTRADA_LINHA" timestamptz,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  constraint "PK_TB_PRE_CLASSIFICACAO" primary key ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO"),
  constraint "FK_MONITORAMENTO_PRECLASSIF" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_EMPREGARECAND_PRECLASSIF" foreign key ("CO_EMPREGARE_CANDIDATO")
    references public."TB_EMPREGARE_CANDIDATO" ("CO_EMPREGARE_CANDIDATO"),
  constraint "CK_PRECLASSIF_TPSITUACAO" check ("TP_SITUACAO" in ('ELIMINADO', 'RANQUEADO', 'NA_LINHA', 'ANALISADO')),
  constraint "CK_PRECLASSIF_ELIMINADO" check (("TP_SITUACAO" = 'ELIMINADO') = ("CO_MOTIVO_ELIMINACAO" is not null)),
  constraint "CK_PRECLASSIF_POSICAO" check ("TP_SITUACAO" = 'ELIMINADO' or "NU_POSICAO" >= 1)
);
create index "IN_PRECLASSIF_VAGA" on public."TB_PRE_CLASSIFICACAO" ("CO_MONITORAMENTO", "CO_VAGA", "TP_SITUACAO", "NU_POSICAO");
comment on table public."TB_PRE_CLASSIFICACAO" is
  'Pré-classificação da vaga pela nota declarada (regra da análise): eliminados automáticos com motivo, ranqueados, os que estão na linha de corte (com ficha) e os já analisados. Os contadores da fila (inscritos, cancelados/reprovados, ranqueados, aptos) saem daqui.';
```

Regras de `FC_PRE_CLASSIFICAR_VAGA`:

- **Ordem**: nota declarada desc, depois o desempate da regra (`IDADE_60`, data de candidatura).
- **Tamanho da linha**: múltiplo × vagas imediatas (+ CR) ou fixo, geral ou por modalidade, com
  empatados se a regra mandar; as vagas vêm do quadro do edital (`TB_QUADRO_VAGA_EDITAL`), pela
  mesma conta da Classificação.
- **A linha anda**: as fichas concluídas como **inabilitado** ou **não habilitado** deixam de ocupar
  lugar na linha. Uma ficha **habilitada** cuja nota apurada ficou abaixo da nota declarada do
  primeiro de fora também libera a vaga na linha. Os que passam a caber viram `NA_LINHA`, e
  `abrir_fichas_do_edital` cria as fichas, com o motivo em `DS_MOTIVO_ENTRADA` e no histórico.
- **Nada volta para trás**: quem já tem ficha não sai da linha por recálculo; só sai pela conclusão.
- A troca da versão da regra (pesos da nota declarada ou tamanho da linha) recalcula as posições, e a
  tela mostra quem entraria e quem sairia antes de confirmar.

## 5. `TB_FICHA_ANALISE` — a ficha

```sql
create table public."TB_FICHA_ANALISE" (
  "CO_FICHA_ANALISE" uuid not null default gen_random_uuid(),
  "CO_MONITORAMENTO" uuid not null,
  "CO_VAGA" text not null,
  "CO_EMPREGARE_CANDIDATO" uuid not null,
  "CO_ANALISE_CURRICULAR" uuid,                 -- linha publicada (ou adotada da planilha)
  "CO_REGRA_ANALISE" uuid not null,
  "NU_VERSAO_REGRA" integer not null,
  "NO_NIVEL" varchar(14) not null,              -- nível da vaga, pela regra (não escolhido a cada candidato)
  "TP_SITUACAO" varchar(12) not null default 'PENDENTE',
  "TP_RESULTADO" varchar(14),                   -- HABILITADO | NAO_HABILITADO | INABILITADO
  "TP_MOTIVO_FORA_FILA" varchar(24),            -- CANCELADO | QUESTIONARIO_INCOMPLETO | SAIU_EMPREGARE
  "CO_USUARIO_RESPONSAVEL" uuid,
  "DT_ATRIBUICAO" timestamptz,
  "CO_USUARIO_REVISOR" uuid,
  "ST_SORTEADA_REVISAO" varchar(1) not null default 'N',
  "ST_INDIGENA" varchar(1) not null default 'N',
  "ST_MORA_ALDEIA" varchar(1) not null default 'N',
  "CO_ALDEIA_DSEI" uuid,
  "VL_NOTA_DECLARADA" numeric(8,4),             -- só pelo que o candidato declarou (da pré-classificação)
  "VL_NOTA_EMPREGARE" numeric(8,4),             -- "x/30" do questionário, só referência
  "NO_ORIGEM_CONVOCACAO" varchar(40),           -- da pré-classificação (P15)
  "VL_NOTA_APURADA" numeric(8,4),               -- soma das parciais (calculada pelo banco)
  "VL_NOTA_FINAL" numeric(8,4),                 -- a publicada: 0 se INABILITADO
  "VL_NOTA_CORTE" numeric(8,4),                 -- o corte aplicado (retrato da regra de classificação)
  "QT_DIAS_SAUDE_INDIGENA" integer,             -- desempate 1, períodos unidos
  "QT_DIAS_ATENCAO_BASICA" integer,             -- desempate 2
  "QT_DIAS_EXPERIENCIA" integer,                -- tempo único validado (todas as categorias que pontuam)
  "QT_HORAS_ESTAGIO" integer,                   -- 7.5.7.2 (indígena sem experiência)
  "NO_MODALIDADE" varchar(60),
  "TP_DOC_COTA" varchar(14),                    -- COMPLETA | INCOMPLETA | NAO_SE_APLICA
  "DS_OBSERVACAO" text,                         -- observações do analista (livres + prontas)
  "DS_OBSERVACOES_USADAS" jsonb,                -- códigos das observações prontas inseridas
  "DS_PARECER" text,                            -- parecer gerado pelo modelo da regra
  "DS_HASH_EMPREGARE" varchar(64),              -- hash da linha Empregare usada ao abrir
  "ST_EMPREGARE_MUDOU" varchar(1) not null default 'N',
  "ST_IMPORTADA_PLANILHA" varchar(1) not null default 'N',
  "NU_VERSAO" integer not null default 1,       -- controle otimista
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  "DT_CONCLUSAO" timestamptz,
  "DT_VALIDACAO" timestamptz,
  constraint "PK_TB_FICHA_ANALISE" primary key ("CO_FICHA_ANALISE"),
  constraint "UK_FICHAANALISE_CANDIDATO" unique ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO"),
  constraint "UK_FICHAANALISE_ANALISE" unique ("CO_ANALISE_CURRICULAR"),
  constraint "FK_MONITORAMENTO_FICHAANALISE" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id),
  constraint "FK_EMPREGARECAND_FICHAANALISE" foreign key ("CO_EMPREGARE_CANDIDATO")
    references public."TB_EMPREGARE_CANDIDATO" ("CO_EMPREGARE_CANDIDATO"),
  constraint "FK_ANALISECURRIC_FICHAANALISE" foreign key ("CO_ANALISE_CURRICULAR")
    references public."TB_ANALISE_CURRICULAR" (id),
  constraint "FK_THREGRAANAL_FICHAANALISE" foreign key ("CO_REGRA_ANALISE", "NU_VERSAO_REGRA")
    references public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO"),
  constraint "FK_ALDEIADSEI_FICHAANALISE" foreign key ("CO_ALDEIA_DSEI")
    references public."TD_ALDEIA_DSEI" ("CO_ALDEIA_DSEI"),
  constraint "CK_FICHAANALISE_TPSITUACAO" check ("TP_SITUACAO" in
    ('PENDENTE', 'EM_ANALISE', 'REVISAR', 'CONCLUIDA', 'FORA_FILA')),
  constraint "CK_FICHAANALISE_TPRESULTADO" check ("TP_RESULTADO" is null
    or "TP_RESULTADO" in ('HABILITADO', 'NAO_HABILITADO', 'INABILITADO')),
  constraint "CK_FICHAANALISE_NIVEL" check ("NO_NIVEL" in ('fundamental', 'tecnico_medio', 'medio', 'tecnico', 'superior')),
  constraint "CK_FICHAANALISE_DOCCOTA" check ("TP_DOC_COTA" is null or "TP_DOC_COTA" in ('COMPLETA', 'INCOMPLETA', 'NAO_SE_APLICA')),
  constraint "CK_FICHAANALISE_FLAGS" check ("ST_SORTEADA_REVISAO" in ('S', 'N') and "ST_EMPREGARE_MUDOU" in ('S', 'N')
    and "ST_IMPORTADA_PLANILHA" in ('S', 'N') and "ST_INDIGENA" in ('S', 'N') and "ST_MORA_ALDEIA" in ('S', 'N')),
  constraint "CK_FICHAANALISE_ALDEIA" check ("ST_MORA_ALDEIA" = 'N' or "ST_INDIGENA" = 'S'),
  constraint "CK_FICHAANALISE_DIAS" check (coalesce("QT_DIAS_SAUDE_INDIGENA", 0) >= 0 and coalesce("QT_DIAS_ATENCAO_BASICA", 0) >= 0
    and coalesce("QT_DIAS_EXPERIENCIA", 0) >= 0 and coalesce("QT_HORAS_ESTAGIO", 0) between 0 and 20000),
  constraint "CK_FICHAANALISE_FLUXO" check (
    ("TP_SITUACAO" <> 'CONCLUIDA' or ("TP_RESULTADO" is not null and "DT_CONCLUSAO" is not null))
    and ("TP_SITUACAO" <> 'FORA_FILA' or "TP_MOTIVO_FORA_FILA" is not null)
    and ("TP_SITUACAO" <> 'EM_ANALISE' or "CO_USUARIO_RESPONSAVEL" is not null)
    and ("TP_RESULTADO" is distinct from 'INABILITADO' or "VL_NOTA_FINAL" = 0)
    and ("CO_USUARIO_REVISOR" is null or "CO_USUARIO_REVISOR" <> "CO_USUARIO_RESPONSAVEL")),
  constraint "CK_FICHAANALISE_TEXTOS" check (coalesce(length("DS_PARECER"), 0) <= 12000
    and coalesce(length("DS_OBSERVACAO"), 0) <= 8000)
);
create index "IN_FICHAANALISE_FILA" on public."TB_FICHA_ANALISE" ("CO_MONITORAMENTO", "TP_SITUACAO", "CO_VAGA");
create index "IN_FICHAANALISE_RESPONSAVEL" on public."TB_FICHA_ANALISE" ("CO_USUARIO_RESPONSAVEL", "TP_SITUACAO");
create index "IN_FKFICHAANALISE_EMPREGARE" on public."TB_FICHA_ANALISE" ("CO_EMPREGARE_CANDIDATO");
comment on table public."TB_FICHA_ANALISE" is
  'Ficha da análise curricular de um candidato numa vaga de edital analisado no MONITORA: situação, resultado (habilitado, não habilitado, inabilitado), nota, desempates, parecer. Publica em TB_ANALISE_CURRICULAR.';
```

Notas:

- O **resultado** não é escolhido: `FC_RESULTADO_DA_FICHA` aplica as regras. Item do checklist não
  cumprido dá `INABILITADO` (nota final 0). Nota abaixo do corte dá `NAO_HABILITADO`. Nos demais
  casos, `HABILITADO`.
- O **responsável** é sempre `auth.uid()` de quem concluiu, e a data da análise é a de
  `DT_CONCLUSAO` em `America/Sao_Paulo`. Nada é digitado.
- A transição é conferida por gatilho (`private."FC_TG_FICHA_ANALISE_FLUXO"`), com as passagens da
  seção 8.4 do README. Quem chama é sempre uma RPC; nenhuma escrita direta.
- `NU_VERSAO` muda a cada salvamento; a RPC recusa se `p_versao` ≠ `NU_VERSAO` (`40001`, "Esta
  ficha mudou desde que você abriu").

## 6. `TB_ITEM_FICHA_ANALISE` — checklist e critérios

```sql
create table public."TB_ITEM_FICHA_ANALISE" (
  "CO_FICHA_ANALISE" uuid not null,
  "CO_ITEM" varchar(30) not null,               -- código do item na regra (ID_CPF, ETNICO, CURSOS…)
  "NU_ORDEM" smallint not null,
  "TP_ITEM" varchar(12) not null,               -- CHECKLIST | ETNICO | ESCOLARIDADE | CURSOS | EXPERIENCIA
  "CO_PARCIAL" varchar(12),                     -- FORMACAO | CURSOS | EXPERIENCIA | ETNICO (nulo no checklist)
  "ST_CUMPRE" varchar(1),                       -- checklist: S cumpre, N não cumpre (nulo = não se aplica)
  "DS_DECLARADO" jsonb,                         -- resposta da Empregare (opção, faixa → meses)
  "VL_DECLARADO" numeric(8,4),                  -- pontuação pelo declarado
  "DS_APURADO" jsonb,                           -- titulação escolhida, contadores por faixa, meses…
  "VL_APURADO" numeric(8,4),                    -- calculado pelo banco (teto aplicado)
  "DS_JUSTIFICATIVA" varchar(2000),
  constraint "PK_TB_ITEM_FICHA_ANALISE" primary key ("CO_FICHA_ANALISE", "CO_ITEM"),
  constraint "FK_FICHAANALISE_ITEMFICHA" foreign key ("CO_FICHA_ANALISE")
    references public."TB_FICHA_ANALISE" ("CO_FICHA_ANALISE"),
  constraint "CK_ITEMFICHA_TPITEM" check ("TP_ITEM" in ('CHECKLIST', 'ETNICO', 'ESCOLARIDADE', 'CURSOS', 'EXPERIENCIA')),
  constraint "CK_ITEMFICHA_COPARCIAL" check ("CO_PARCIAL" is null or "CO_PARCIAL" in ('FORMACAO', 'CURSOS', 'EXPERIENCIA', 'ETNICO')),
  constraint "CK_ITEMFICHA_STCUMPRE" check ("ST_CUMPRE" is null or "ST_CUMPRE" in ('S', 'N')),
  constraint "CK_ITEMFICHA_CHECKLIST" check (("TP_ITEM" = 'CHECKLIST') = ("CO_PARCIAL" is null)),
  constraint "CK_ITEMFICHA_VALORES" check (coalesce("VL_DECLARADO", 0) between 0 and 1000 and coalesce("VL_APURADO", 0) between 0 and 1000)
);
comment on table public."TB_ITEM_FICHA_ANALISE" is
  'Itens da ficha: os do checklist de admissibilidade (cumpre ou não) e os critérios pontuados (declarado × apurado), conforme a versão da regra da análise da ficha.';
```

Exemplos de `DS_APURADO`:

- cursos: `{"faixas": [2, 3, 1]}`, que dá 2 × 0,5 + 3 × 0,3 + 1 × 0,2 = 2,1;
- escolaridade: `{"titulacao": "Especialização"}`;
- experiência: `{"meses": 50, "fonte": "VINCULOS"}` ou `{"meses": 4, "fonte": "ESTAGIO"}`.

A observação obrigatória quando o apurado fica abaixo do declarado é conferida em `concluir_ficha`
(o rascunho pode estar incompleto).

## 7. `TB_VINCULO_EXPERIENCIA` — vínculos comprovados

```sql
create table public."TB_VINCULO_EXPERIENCIA" (
  "CO_VINCULO_EXPERIENCIA" uuid not null default gen_random_uuid(),
  "CO_FICHA_ANALISE" uuid not null,
  "NU_ORDEM" smallint not null,
  "CO_CATEGORIA" varchar(20) not null,          -- código da categoria na regra (SAUDE_INDIGENA…)
  "DT_INICIO" date not null,
  "DT_FIM" date not null,                       -- obrigatório: sem fim não pontua (observação pronta)
  "NO_LOCAL" varchar(200),
  "ST_ACEITO" varchar(1) not null default 'S',
  "DS_JUSTIFICATIVA" varchar(1000),
  constraint "PK_TB_VINCULO_EXPERIENCIA" primary key ("CO_VINCULO_EXPERIENCIA"),
  constraint "UK_VINCULOEXP_ORDEM" unique ("CO_FICHA_ANALISE", "NU_ORDEM"),
  constraint "FK_FICHAANALISE_VINCULOEXP" foreign key ("CO_FICHA_ANALISE")
    references public."TB_FICHA_ANALISE" ("CO_FICHA_ANALISE"),
  constraint "CK_VINCULOEXP_DATAS" check ("DT_FIM" >= "DT_INICIO" and "DT_INICIO" >= date '1950-01-01'),
  constraint "CK_VINCULOEXP_NUORDEM" check ("NU_ORDEM" between 1 and 50),
  constraint "CK_VINCULOEXP_STACEITO" check ("ST_ACEITO" in ('S', 'N')),
  constraint "CK_VINCULOEXP_JUSTIF" check ("ST_ACEITO" = 'S' or length("DS_JUSTIFICATIVA") >= 10)
);
comment on table public."TB_VINCULO_EXPERIENCIA" is
  'Vínculos de experiência comprovados na ficha (categoria, início, fim). O banco une as sobreposições por categoria e no total para a nota e os desempates.';
```

`private."FC_DIAS_SEM_SOBREPOSICAO"(ficha, categorias[], data_limite)`:

- junta os intervalos aceitos com `range_agg(daterange(início, fim, '[]'))`;
- emenda os intervalos encostados (um começa no dia seguinte ao fim do outro), como o simulador;
- corta na data limite da regra e soma os dias.

Com isso, o banco calcula:

- `QT_DIAS_SAUDE_INDIGENA`, `QT_DIAS_ATENCAO_BASICA` e `QT_DIAS_EXPERIENCIA`;
- meses = `floor(dias / dias_por_mes)`;
- pontos = `min(meses × pontos_por_mes, teto)` (ou as faixas);
- o estágio: só quando os meses de experiência são 0 e o candidato é indígena,
  `floor(horas / 8 / 22)` meses.

O número máximo de vínculos (`max_vinculos`) é conferido na RPC.

## 8. `TH_FICHA_ANALISE` — histórico imutável

```sql
create table public."TH_FICHA_ANALISE" (
  "CO_FICHA_ANALISE" uuid not null,
  "NU_VERSAO" integer not null,                 -- = TB_FICHA_ANALISE.NU_VERSAO gravada
  "TP_ACAO" varchar(18) not null,
  "TP_SITUACAO" varchar(12) not null,
  "TP_RESULTADO" varchar(14),
  "VL_NOTA_FINAL" numeric(8,4),
  "DS_RETRATO" jsonb not null,                  -- ficha + itens + vínculos + parecer
  "DS_HASH_RETRATO" varchar(64) not null,       -- SHA-256 calculado no banco
  "DS_MOTIVO" varchar(2000),
  "CO_USUARIO" uuid not null,
  "DT_REGISTRO" timestamptz not null default now(),
  constraint "PK_TH_FICHA_ANALISE" primary key ("CO_FICHA_ANALISE", "NU_VERSAO"),
  constraint "FK_FICHAANALISE_THFICHA" foreign key ("CO_FICHA_ANALISE")
    references public."TB_FICHA_ANALISE" ("CO_FICHA_ANALISE"),
  constraint "CK_THFICHA_TPACAO" check ("TP_ACAO" in ('ABRIR', 'ATUALIZAR_EMPREGARE', 'ATRIBUIR', 'PEGAR',
    'DEVOLVER_FILA', 'SALVAR', 'PEDIR_REVISAO', 'CONCLUIR', 'SORTEAR_REVISAO', 'VALIDAR', 'DEVOLVER', 'REABRIR',
    'FORA_FILA', 'IMPORTAR_PLANILHA')),
  constraint "CK_THFICHA_MOTIVO" check ("TP_ACAO" not in ('DEVOLVER', 'REABRIR', 'DEVOLVER_FILA', 'ATRIBUIR')
    or length("DS_MOTIVO") >= 10)
);
create index "IN_THFICHA_USUARIO_DATA" on public."TH_FICHA_ANALISE" ("CO_USUARIO", "DT_REGISTRO");
comment on table public."TH_FICHA_ANALISE" is
  'Histórico imutável da ficha: cada salvamento com mudança e cada transição, com o retrato completo e o hash.';
```

O gatilho `private."FC_TG_HISTORICO_IMUTAVEL"` recusa `update`/`delete` (`42501`). Para não encher
o histórico de rascunhos, a RPC só grava uma versão nova quando há diferença e, no máximo, uma a cada
60 s por pessoa e ficha (o rascunho intermediário fica só na ficha). Concluir, validar, devolver e
reabrir **sempre** gravam.

## 9. `TL_ACESSO_FICHA_ANALISE` — registro de acesso (LGPD)

```sql
create table public."TL_ACESSO_FICHA_ANALISE" (
  "CO_ACESSO_FICHA" bigint generated always as identity,
  "CO_FICHA_ANALISE" uuid not null,
  "TP_ACESSO" varchar(16) not null,
  "DS_ALVO" varchar(120),                       -- ex.: "Pergunta 18" (nunca o valor revelado)
  "CO_USUARIO" uuid not null,
  "DT_ACESSO" timestamptz not null default now(),
  constraint "PK_TL_ACESSO_FICHA_ANALISE" primary key ("CO_ACESSO_FICHA"),
  constraint "FK_FICHAANALISE_ACESSOFICHA" foreign key ("CO_FICHA_ANALISE")
    references public."TB_FICHA_ANALISE" ("CO_FICHA_ANALISE"),
  constraint "CK_ACESSOFICHA_TPACESSO" check ("TP_ACESSO" in
    ('ABRIR_FICHA', 'REVELAR_CPF', 'REVELAR_PARENTE', 'ABRIR_ANEXO', 'ABRIR_EMPREGARE', 'IMPRIMIR'))
);
create index "IN_ACESSOFICHA_FICHA" on public."TL_ACESSO_FICHA_ANALISE" ("CO_FICHA_ANALISE", "DT_ACESSO");
create index "IN_ACESSOFICHA_USUARIO" on public."TL_ACESSO_FICHA_ANALISE" ("CO_USUARIO", "DT_ACESSO");
comment on table public."TL_ACESSO_FICHA_ANALISE" is
  'Quem abriu a ficha, revelou CPF ou nome de parente, abriu anexo ou imprimiu (LGPD). Imutável; só a coordenação e o administrador global leem.';
```

## 10. `TB_ANEXO_EMPREGARE` — anexos (fase B, depende da P2)

```sql
create table public."TB_ANEXO_EMPREGARE" (
  "CO_ANEXO_EMPREGARE" uuid not null default gen_random_uuid(),
  "CO_EMPREGARE_CANDIDATO" uuid not null,
  "NU_PERGUNTA" smallint not null,
  "DS_CAMINHO_STORAGE" varchar(300) not null,   -- bucket privado; nunca URL pública
  "DS_TIPO_MIME" varchar(80) not null,
  "QT_BYTES" integer not null,
  "DS_HASH" varchar(64) not null,
  "DT_BAIXADO" timestamptz not null default now(),
  "DT_DESCARTE_PREVISTO" date,                  -- política de retenção
  constraint "PK_TB_ANEXO_EMPREGARE" primary key ("CO_ANEXO_EMPREGARE"),
  constraint "UK_ANEXOEMPREGARE_HASH" unique ("CO_EMPREGARE_CANDIDATO", "NU_PERGUNTA", "DS_HASH"),
  constraint "FK_EMPREGARECAND_ANEXOEMPREG" foreign key ("CO_EMPREGARE_CANDIDATO")
    references public."TB_EMPREGARE_CANDIDATO" ("CO_EMPREGARE_CANDIDATO"),
  constraint "CK_ANEXOEMPREG_BYTES" check ("QT_BYTES" between 1 and 52428800)
);
comment on table public."TB_ANEXO_EMPREGARE" is
  'Anexos do questionário baixados da Empregare pelo robô (bucket privado); abertos só por URL assinada curta, com registro.';
```

## 11. Novas linhas em tabelas existentes

```sql
insert into public."TB_PLANILHA_ANALISE" ("CO_PLANILHA", "CO_AREA", "NO_PLANILHA", "DS_PLANILHA_ID") values
  ('monitora-saude-indigena', 'saude-indigena', 'MONITORA (fichas) - Saúde Indígena', null),
  ('monitora-sede',           'sede',           'MONITORA (fichas) - SEDE',            null),
  ('monitora-projetos',       'projetos',       'MONITORA (fichas) - Projetos',        null);
```

Nenhuma linha em `TA_ORIGEM_ANALISE`: o MONITORA não usa `TL_SYNC_ANALISE`. Conferir na migration
se alguma RPC do painel supõe `DS_PLANILHA_ID` não nulo.

## 12. Publicação em `TB_ANALISE_CURRICULAR`

`private."FC_PUBLICAR_FICHA"(p_ficha uuid)`, chamada por toda RPC que muda a situação, **só** quando
o edital é `MONITORA`:

| Coluna de `TB_ANALISE_CURRICULAR` | Valor |
|---|---|
| `id` | o de `CO_ANALISE_CURRICULAR` (adotado) ou novo, que volta para a ficha |
| `CO_PLANILHA` / `CO_AREA` | `monitora-<área>` / área do edital |
| `grupo`, `unidade`, `edital`, `codigo_vaga`, `nome_vaga`, `categoria`, `regime`, `carga_horaria` | do edital e da vaga (Seleção/Empregare), no mesmo formato da planilha |
| `candidato`, `id_origem` | NOME e CÓDIGO da Empregare (`chave_natural` igual à da planilha) |
| `data_nascimento`, `idade`, `pcd`, `modalidade_concorrencia` | Empregare / ficha |
| `status_consolidado` / `etapa` | Pendente, Revisar, ou pelo resultado: HABILITADO → Aprovado/"Triados"; NAO_HABILITADO e INABILITADO → Reprovado/"Reprovado" (etapa vem de `situacoes` da regra) |
| `responsavel_analise` | nome de quem concluiu (do login) |
| `data_analise` | data de `DT_CONCLUSAO` (Brasília) |
| `pontuacao_escolaridade` / `_cursos_aperfeicoamento` / `_experiencia_profissional` / `_criterio_etnico` | soma dos itens por parcial (`FORMACAO`/`CURSOS`/`EXPERIENCIA`/`ETNICO`) |
| `nota_final_ajustada`, `somatorio` | `VL_NOTA_FINAL` (0 se inabilitado), com as casas da regra de classificação |
| `experiencia_saude_indigena_total`, `experiencia_atencao_basica_total`, `experiencia_profissional_total` | `QT_DIAS_*` (dias, a mesma unidade da planilha); `experiencia_profissional_anos/meses/dias` pela decomposição 365/30 do simulador |
| `analise` | `DS_PARECER` (já com as observações) |
| `link_pdf`, `pdf_*`, `origem_*`, `linha_origem`, `hash_registro` | nulos (ou `origem_url` = rota da ficha no MONITORA) |
| `ativo` | `true`; ficha `FORA_FILA` → `false` |

Em `COMPARACAO`, nada é publicado. `obter_comparacao_analise` compara a ficha com a linha da planilha
pela `chave_natural`.

## 13. RPCs (todas `public`, `SECURITY DEFINER`, `set search_path to ''`, no `rpc-contrato.js`)

| RPC | Quem | O que faz |
|---|---|---|
| `obter_fila_analise(p_edital uuid, p_filtros jsonb, p_pagina int)` | Leitor+ | indicadores, fichas paginadas e opções dos filtros; sem CPF |
| `abrir_ficha_por_codigo(p_edital uuid, p_codigo text)` | papel no edital | o atalho do simulador: acha a ficha pelo código Empregare (só no edital e nas vagas da pessoa) |
| `obter_pre_classificacao(p_edital uuid, p_vaga text)` | Leitor+ | os contadores (inscritos, cancelados/reprovados, ranqueados, aptos para análise), a ordem pela nota declarada com a linha de corte, os primeiros de fora e os eliminados com motivo |
| `pegar_proxima_ficha(p_edital uuid, p_vaga text default null)` | analista no edital (só se o modo do edital for `PEGAR_PROXIMO`) | reserva a próxima ficha livre na ordem da pré-classificação (`for update skip locked`), grava `PEGAR` e devolve o id |
| `atribuir_fichas(p_fichas uuid[], p_usuario uuid, p_motivo text)` | coordenador | atribui ou redistribui (não tira ficha concluída) |
| `distribuir_fichas(p_edital uuid, p_config jsonb)` | gestor do edital ou coordenador | no modo `INICIAL`, reparte as pendentes entre analistas (partes iguais ou até o limite); prévia com `p_config.simular = true` |
| `devolver_ficha_a_fila(p_ficha uuid, p_versao int, p_motivo text)` | responsável ou coordenador | volta para Pendente |
| `obter_ficha_analise(p_ficha uuid)` | papel no edital (Leitor: só concluída) | ficha, itens, vínculos, regra da versão, respostas Empregare (CPF e nome do parente mascarados), sinais, histórico resumido, ajustes de recurso; registra `ABRIR_FICHA` |
| `buscar_aldeia_dsei(p_ficha uuid, p_texto text)` | papel no edital | até 20 aldeias da lista do DSEI do edital que contêm o texto |
| `revelar_dado_ficha(p_ficha uuid, p_campo text)` | analista/revisor/coordenador da ficha | devolve o valor e grava em `TL_ACESSO_FICHA_ANALISE` |
| `registrar_acesso_ficha(p_ficha uuid, p_tipo text, p_alvo text)` | idem | "Abrir na Empregare", imprimir |
| `obter_anexo_ficha(p_ficha uuid, p_pergunta int)` (fase B) | idem | URL assinada de 60 s + registro |
| `salvar_ficha(p_ficha uuid, p_versao int, p_dados jsonb)` | responsável | rascunho: checklist, étnico/aldeia, escolaridade, contadores, vínculos, estágio, observações; recalcula itens, desempates, nota, resultado e parecer; devolve tudo e a versão nova |
| `pedir_revisao_ficha(p_ficha uuid, p_versao int, p_motivo text)` | responsável | Em análise → Revisar (se a regra permitir, P12) |
| `concluir_ficha(p_ficha uuid, p_versao int)` | responsável | confere completude e observações obrigatórias, fixa responsável e data, sorteia revisão, publica |
| `validar_ficha(p_ficha uuid, p_versao int)` | revisor (≠ responsável) | Revisar → Concluída, publica |
| `devolver_ficha(p_ficha uuid, p_versao int, p_motivo text)` | revisor | Revisar → Em análise (com o analista), publica Revisar |
| `reabrir_ficha(p_ficha uuid, p_motivo text)` | coordenador | Concluída → Em análise; recusa se a preliminar já foi publicada (`TB_LISTA_CLASSIFICACAO` publicada) |
| `obter_regra_analise(p_edital uuid)` / `salvar_regra_analise(p_edital uuid, p_config jsonb, p_motivo text)` | Leitor / coordenador | versão nova; devolve as fichas concluídas afetadas e as divergências com a regra de classificação (parciais, corte) |
| `simular_regra_analise(p_config jsonb, p_entrada jsonb)` | coordenador | a "prévia com candidato fictício": nota, resultado e parecer, sem gravar |
| `copiar_modelo_regra_analise(p_edital uuid, p_modelo text)` | coordenador | cria a versão 1 a partir de um modelo, "conferir" |
| `salvar_aldeias_dsei(p_unidade bigint, p_aldeias jsonb, p_fonte text)` | administrador global | carga ou atualização da lista de aldeias de um DSEI |
| `salvar_equipe_edital(p_edital uuid, p_equipe jsonb, p_motivo text)` | coordenador | grava `RL_ANALISTA_EDITAL` |
| `definir_origem_analise(p_edital uuid, p_origem text, p_motivo text)` | administrador global | `COMPARACAO`/`MONITORA`; na virada, adota as linhas da planilha e importa as fichas; devolve o resumo |
| `abrir_fichas_do_edital(p_edital uuid)` | coordenador e o robô (fim da carga, via `service_role`) | recalcula a pré-classificação e cria as fichas de quem está `NA_LINHA` (idempotente); no modo `INICIAL`, já atribui |
| `obter_comparacao_analise(p_edital uuid)` | coordenador | planilha × MONITORA por candidato (situação, parciais, desempates, nota, divergência) |
| `obter_produtividade_analise(p_edital uuid, p_de date, p_ate date)` | coordenador | fichas por analista e dia, tempo mediano, devoluções, motivos de inabilitação |

Funções privadas:

- regra: `FC_VALIDAR_REGRA_ANALISE`, `FC_CORTE_DA_FICHA` (lê a regra de classificação);
- pontuação: `FC_PONTUAR_ITEM` (aplica o tipo e o teto), `FC_DIAS_SEM_SOBREPOSICAO`,
  `FC_FAIXA_EM_MESES` ("4 anos e 2 meses" → 50), `FC_NOTA_DA_FICHA`, `FC_RESULTADO_DA_FICHA`;
- parecer e sinais: `FC_PARECER_DA_FICHA` (monta o texto pelo modelo da regra), `FC_SINAIS_DA_FICHA`;
- pré-classificação: `FC_NOTA_DECLARADA` (mapeamento resposta → pontos), `FC_PRE_CLASSIFICAR_VAGA`, `FC_TAMANHO_LINHA_CORTE`;
- fluxo: `FC_SORTEAR_REVISAO` (semente gravada, com as opções combináveis da revisão), `FC_PUBLICAR_FICHA`,
  `FC_PAPEL_NO_EDITAL(edital, usuario)`;
- gatilhos: `FC_TG_FICHA_ANALISE_FLUXO`, `FC_TG_HISTORICO_IMUTAVEL`.

A mesma conta existe em `src/lib/analise/` (pura, com teste) para a tela responder na hora. O banco
é a fonte da verdade, e um teste compartilhado de casos (inclusive os do simulador) garante que as
duas contas dão o mesmo número.

Erros com código e mensagem em português, como no resto do banco: `42501` (sem permissão), `40001`
(a ficha mudou), `22023` (dado inválido ou passagem proibida), `55P03` (ficha reservada por outra
pessoa).

## 14. Ordem sugerida das migrations

1. Origem por edital, regra da análise com modelos, aldeias do DSEI, equipe e a pré-classificação
   (sem fichas): já permite comparar a nota declarada e a linha de corte com a planilha do piloto de
   Projetos.
2. Fichas, itens, vínculos, histórico, acesso, as RPCs da fila e da ficha e a abertura pelo robô:
   piloto em `COMPARACAO`.
3. Publicação e virada (`FC_PUBLICAR_FICHA`, `definir_origem_analise` com a adoção): piloto em
   `MONITORA`.
4. Anexos (fase B) e o campo "Em análise" no painel.
5. Desligamento: retirar a carga das planilhas (`TL_SYNC_ANALISE`, staging e as RPCs de sync).

Cada uma com `ensaios/` e `rollback/`, como as migrations recentes.
