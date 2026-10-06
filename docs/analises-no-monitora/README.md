# Avaliação documental dentro do MONITORA — desenho

Situação: **desenho para aprovação** (rodada 3, 05/10/2026). Nada aqui está implementado: não há
migration nem código. O usuário aprovou começar o desenho com o pedido "pode começar a desenhar a
Análise dentro do MONITORA". As decisões já tomadas e as perguntas abertas estão no fim
(seção 17).

Documentos irmãos:

- [`modelo-de-dados.md`](modelo-de-dados.md): tabelas, view e RPCs propostas, no padrão MAD.
- [`../historias-de-usuario/analises-no-monitora.md`](../historias-de-usuario/analises-no-monitora.md):
  histórias de usuário com critérios de aceite, divididas em MVP e "depois".
- [`prototipo-da-ficha.html`](prototipo-da-ficha.html): protótipo estático da fila, do lote e da
  ficha, com dados fictícios, no visual do MONITORA. É só para aprovar o desenho.

Nomes usados aqui:

- **Avaliação documental**: a etapa que o edital chama de "Etapa de Avaliação Documental e de
  Títulos" (nos títulos das publicações, também "Análise Curricular"). É o **módulo novo de
  trabalho**.
- **Painel das análises**: a tela de hoje (`src/modulos/analises/`, hoje chamada "Análises
  curriculares"), que continua como **painel de leitura**.
- **ART**: a "Nota da Autodeclaração de Requisitos e Títulos", que é a **nota do questionário da
  Empregare** ("x/30").

---

## 1. Objetivo

Hoje a nota da avaliação documental percorre uma cadeia longa, e qualquer elo pode falhar:

```
Empregare ──(robô do MONITORA)──► TB_EMPREGARE_CANDIDATO
   │
   └─(Excel exportado à mão) ► planilha de cada vaga no Drive (abas da seção 2.1.1)
                                   ▲  o analista confere os documentos NA EMPREGARE e pontua
                                   │  num simulador (HTML local, regra fixa de um DSEI/edital)
                                   ▼  que grava a linha na planilha por um web app do Apps Script
                    planilha central da área (DIM_EDITAIS, DIM_VAGAS, DIM_RESPONSAVEIS)
                                   │  Apps Script "Atualizar base" (de 20 em 20 min, lotes de 2,5 min)
                                   ▼
                    FATO_ANALISES ─► Apps Script FULL/incremental/orquestrador
                                   ▼
                    TB_ANALISE_CURRICULAR ─► Classificação ─► listas oficiais ─► Lista de aprovados
```

**Objetivo:** o analista trabalha no **módulo Avaliação documental** do MONITORA. O módulo:

- monta a **Lista provisória por ART** e o **lote de convocação** sozinho;
- abre uma **ficha completa** por candidato do lote, com um bloco por documento ou pergunta do
  questionário. Cada bloco mostra o declarado e o atalho "Abrir na Empregare", onde ficam os
  documentos;
- registra a conferência, a pontuação e o parecer;
- grava o resultado direto na base que a Classificação e o Painel das análises já leem.

Saem de cena o simulador, as planilhas de vaga, a planilha central e o Apps Script.

O que **não muda**:

- `TB_ANALISE_CURRICULAR` continua sendo a base que a Classificação, o Painel das análises, as
  Entrevistas, os Recursos e a Lista de aprovados leem.
- O `id` da análise continua ligando entrevista, recurso, ajuste e aprovado.
- A regra de classificação versionada, o ajuste de pontuação pelo recurso, a agenda das entrevistas
  e o documento do SEI continuam como estão (e ganham o que falta; seção 13).

## 2. Como é feito hoje (levantamento)

### 2.1 Planilhas e abas

| Onde | O que tem | Quem mexe |
|---|---|---|
| **Planilha de cada vaga** (uma por vaga, numa pasta do Drive por edital; o link da pasta fica em `DIM_EDITAIS.pasta_origem_link`) | as abas da seção 2.1.1 | quem monta a vaga, o simulador e o analista |
| **Planilha central** da área (Saúde Indígena: "Central Monitora Análises - Saúde Indígena"; Projetos: "Central AgSus Monitora Sede e Projetos"; SEDE: planilha própria) | `DIM_EDITAIS` (grupo, unidade, edital, pasta, ativo, janela da análise), `DIM_VAGAS`, `DIM_RESPONSAVEIS`, `FATO_ANALISES` e `FATO_ANALISES_STG` (52 colunas), `LOG_CONSOLIDACAO`, `META_PAINEL`, `REL_PRE_VALIDACAO`, `REL_AUDITORIA_FATO`, `CTRL_SYNC_ORIGENS` | os scripts e a coordenação |
| **Painel web** de Projetos (Google Sites: Script Projetos 3/4/6/7) | leitura da FATO | ninguém edita |

#### 2.1.1 Por dentro de uma planilha de vaga

Levantamento feito numa planilha real (uma vaga de CASAI do edital 100/2026). Os nomes e os dados
dos candidatos ficam fora deste documento.

| Aba | O que faz |
|---|---|
| **IMPORTACAO EMPREGARE** | Recebe o Excel da Empregare colado inteiro: são as mesmas colunas que o robô já grava em `TB_EMPREGARE_CANDIDATO."DS_COLUNA_ORIGINAL"`. Fórmulas recalculam a nota declarada a partir das respostas: Escolaridade pela pergunta 15 ("Especialização na área à qual concorre" = 1, "Não possuo" = 0), Experiência pela pergunta 17 (faixa em meses × 0,2, com teto de 10) e Indígena pela pergunta 6. Também traz SITUAÇÃO (INSCRITO/CANCELADO), a situação do questionário (FINALIZADO/EM ANDAMENTO), REPROVADO, MARCADORES e a nota da Empregare ("x/30", a ART). |
| **TOTAL DE CANDIDATOS** | Todos os candidatos, ordenados pela nota (no exemplo, 161 ranqueados). |
| **ELIMINADOS** | Os que cancelaram e os que não finalizaram o questionário, com o MOTIVO DA ELIMINAÇÃO. |
| **APTOS PARA ANÁLISE** | Só os candidatos **até a linha de corte** (no exemplo, 22 de 161), ou seja, o **lote de convocação**. O cabeçalho mostra INSCRITOS, CANCELADOS/REPROVADOS, TOTAL RANQUEADOS e APTOS PARA ANÁLISE (LINHA DE CORTE). Colunas: nome, código, nascimento, NOTA EMPREGARE, modalidade, NOTA FINAL AJUSTADA, Escolaridade, Experiência, Indígena, Somatório, experiência na saúde indígena e na atenção básica (anos, meses, dias, total), ETAPA (Triados/Reprovado), DATA DA ANÁLISE, ANÁLISE (o parecer), PCD, Responsável, ">=60 anos" e "Origem convocação". É **esta** aba que o "Atualizar base" lê. |
| **RANQUEAMENTO** / **DESCLASSIFICADOS** | O resultado depois da análise; os reprovados com o parecer (ex.: itens 8.11 "b"/"c": escolaridade mínima, experiência mínima de 6 meses). |
| **QUERY** | Auxiliar das fórmulas. |

### 2.2 Scripts

| Script | Papel |
|---|---|
| Web app do simulador (só no Google) | lê a linha do candidato na planilha da vaga e grava a análise de volta |
| `1-atualizar-base.gs` | monta a `DIM_VAGAS`, abre cada planilha de vaga, acha o cabeçalho por centenas de apelidos e grava a `FATO_ANALISES`; calcula `status_consolidado` pelo texto da ETAPA e do parecer, e a experiência em dias (anos × 365 + meses × 30 + dias) |
| `2-sincronizar-com-supabase-full.gs`, `3-analises-incremental.gs`, `4-orquestrador-fato-supabase.gs` | envio completo, incremental e o gatilho de 20 em 20 minutos |
| Gerador de PDF (só no Google) | um PDF por análise no Drive (`link_pdf`): 3.707 gerados e 703 com erro na Saúde Indígena; 1.285 gerados em Projetos |

### 2.3 O simulador do analista (uma amostra, não o alvo)

O analista usava um simulador em HTML local (DSEI Interior Sul, edital 28/2026), que **não** fica
no repositório. Ele mostrou o mínimo que a ficha precisa ter, mas era só uma amostra. A ficha do
MONITORA vai além (seção 7). O simulador tinha:

- busca por código;
- checklist de admissibilidade com o item do edital (um item desmarcado → INABILITADO, nota 0);
- critério étnico com a lista de 238 aldeias do DSEI (+7 indígena, +5 aldeia);
- escolaridade pelo nível da vaga;
- cursos por faixa de carga horária (teto 5);
- até 10 vínculos de experiência, com sobreposições unidas, dias ÷ 30, 0,2 por mês, teto 10, e o
  estágio de indígena (horas ÷ 8 ÷ 22);
- nota de corte de 8,0;
- parecer automático por situação, com observações prontas citando o item do edital;
- responsável e data digitados.

Fragilidades:

- a regra fica fixa no código;
- o nível volta para "superior" a cada candidato;
- não guarda histórico;
- diz "salvo" mesmo quando falha;
- não registra **por que** cada documento foi aceito ou recusado: só a nota e o texto final.

Há também um risco de exposição de dados no fluxo atual, descrito fora do repositório (R1 na
seção 17).

### 2.4 Regras que hoje estão espalhadas

- **Situação** (`derivarStatusConsolidado_`): ETAPA "Triados/aprovado/habilitado…" com parecer
  suficiente vira **Aprovado**; "reprovado/inabilitado/eliminado…" vira **Reprovado**; sem etapa
  vira **Pendente**; caso contrário, **Revisar**. Ativos hoje: 3.950 Aprovados (etapa "Triados"),
  6.117 Reprovados, 662 Pendentes, 15 Revisar.
- **Banco**:
  - cada planilha tem um `CO_PLANILHA`;
  - a `chave_natural` (grupo|unidade|edital|vaga|código|nome) é única, e um lote que traz uma
    chave de **outra** planilha é recusado inteiro;
  - quem sai da planilha é desativado (trava de 2%).
- **Classificação** (`obter_classificacao_do_edital`): lê `TB_ANALISE_CURRICULAR`:
  - `nota_final_ajustada` → nota documental;
  - as quatro `pontuacao_*` → parciais;
  - `experiencia_saude_indigena_total` e `experiencia_atencao_basica_total` → desempates;
  - `nota_empregare` → `nota_art` (a ART);
  - `data_nascimento` → 60 anos na data de corte;
  - `status_consolidado`/`etapa` → apto pela regra.

  Os ajustes do recurso entram por cima.
- **Regra de classificação** (`TH_REGRA_CLASSIFICACAO`): guarda as parciais, as notas mínimas
  (também por nível), a convocação e os textos do SEI; a pontuação de cada critério está só em
  texto (`importacao.pontuacao.detalhe`).

### 2.5 O que a Empregare entrega

O robô grava, por candidato e vaga, **todas** as colunas do Excel em
`TB_EMPREGARE_CANDIDATO."DS_COLUNA_ORIGINAL"`:

- cadastro: NOME, CÓDIGO, contato, cidade/UF, gênero, nascimento, PCD, data de candidatura;
- processo: ETAPA, SITUAÇÃO, motivo do cancelamento, MARCADORES, REPROVADO, MATCH;
- questionário: situação, "NOTA - …" (a ART, ex.: "6,0/30,0") e data de resposta;
- última formação;
- as respostas "Pergunta N - <enunciado>".

**Os documentos não vêm**: nas perguntas de anexo a célula diz só "Anexo" (ou "Vídeo") ou
"Resposta não informada". A conferência é feita **na Empregare** (a "Empregare documental").

Questionário do edital 100/2026, nível superior (estrutura; enunciados resumidos):

| Nº | Pergunta | Tipo | Na avaliação |
|---|---|---|---|
| P4 | Documento de identidade com foto (frente e verso) | anexo | requisito: identificação |
| P5 | Sistema de concorrência (AC, pretos e pardos, indígenas, quilombolas, PcD) | escolha | modalidade |
| P6 | É indígena e mora em aldeia? | escolha múltipla | critério étnico (pontos) |
| P7 | Declaração de pertencimento étnico / moradia em aldeia (Anexo VI, assinaturas de lideranças) | anexo | comprova P6; sem ela, os pontos não valem |
| P8 | Autodeclaração de pretos e pardos (Anexo IX) | anexo | cota: encaminha à heteroidentificação |
| P9 | Vídeo de pretos e pardos | vídeo | cota: heteroidentificação |
| P10 | Fotos de frente e de perfil | anexo | cota: heteroidentificação |
| P11 | Autodeclaração quilombola (Anexo XI) | anexo | cota quilombola |
| P12 | Laudo médico de PcD (com CRM) | anexo | cota PcD: encaminha à perícia |
| P13 / P14 | Graduação exigida pela vaga / diploma frente e verso (item 8.11.2) | escolha / anexo | requisito: escolaridade mínima |
| P15 / P16 | Outras formações (especialização, mestrado, doutorado) / diplomas | escolha / anexo | formação acadêmica (pontos) |
| P17 / P18 | Experiência declarada (faixa) / comprovantes (item 8.14) | escolha / anexo | requisito de experiência mínima e experiência (pontos), desempates |
| P19 / P20 | Parente ou conhecido na AgSUS / nome | escolha / texto | só registro (alerta) |
| P21 | Contrato ativo ou desligado há menos de 6 meses | escolha | só registro ou impedimento, conforme o edital |
| P22 | Interesse em outros DSEI | escolha | só registro (Lista de aprovados) |
| P23 / P24 | Termo de responsabilidade / LGPD | aceite | recusa elimina |

Na vaga já carregada pelo robô (outro questionário, nível fundamental), a numeração é outra
(ex.: experiência na P17, escolaridade nas P13–P16). Por isso, **o bloco é ligado à pergunta pelo
enunciado**, por edital, e nunca pelo número.

A ligação com a análise de hoje já existe: os candidatos da vaga carregada que estão em
`TB_ANALISE_CURRICULAR` casam 100% por `codigo_vaga` = `CO_VAGA` e `id_origem` =
`CO_CANDIDATO_EMPREGARE`.

## 3. Fluxo novo, ponta a ponta

```
1 Robô da Empregare (já existe) ─► TB_EMPREGARE_CANDIDATO
2 Lista provisória por ART (automática) ─► eliminados automáticos (cancelou, questionário
   incompleto, reprovado na Empregare) + todos os inscritos por vaga, ART decrescente
   ─► [publicação a. "Lista Geral de Classificação Provisória – Ranqueamento Eletrônico"]
3 Lote de convocação (item 8.4) = linha de corte da Provisória ─► fichas só para o lote
   ─► [publicação b. "Lote de Convocação"], quando o edital publica
4 Avaliação documental (módulo novo): fila ─► ficha (um bloco por documento, conferido na
   Empregare) ─► revisão ─► concluída (Apto / Inapto) ─► grava em TB_ANALISE_CURRICULAR
   "a linha anda": inapto sai, o próximo da Provisória entra no lote
5 Classificação (já existe) ─► [c./d. Resultado Preliminar APTOS / INAPTOS]
6 Recursos (já existe; ajuste de pontuação por cima) ─► [f. Resultado Final APTOS / INAPTOS]
7 Convocação para entrevista + agenda (já existem) ─► [g.]
8 Entrevistas ─► Resultado final do processo ─► [h.] ─► Lista de aprovados (já existe)
```

## 4. Dois módulos: Painel das análises e Avaliação documental

O **painel** e o **trabalho** ficam separados no menu (`src/lib/menu-lateral.js`), nas três áreas:

| Menu (rótulo) | Rota / view | Recurso de permissão | Para quê |
|---|---|---|---|
| **Painel das análises** | `analises` (a de hoje; o rótulo muda de "Análises curriculares" para "Painel das análises") | `analises` (o de hoje: Leitor, Editor, Admin) | indicadores, gráficos, pendências, carga por responsável, consulta e CSV. **Só leitura.** |
| **Avaliação documental** | `avaliacao-documental` (módulo novo em `src/modulos/avaliacao-documental/`) | **`avaliacao_documental`** (novo, em `permissoes-recursos.js`, com migration) | Provisória por ART, lote, fila, ficha, revisão, parecer, regra da avaliação e equipe do edital |

Os dois aparecem lado a lado no menu; o painel ganha o atalho "Abrir na Avaliação documental" em
cada análise de origem MONITORA, e a ficha ganha "Ver no painel".

### 4.1 Permissões do recurso `avaliacao_documental`

| Nível | O que libera |
|---|---|
| Sem acesso | o item não aparece no menu |
| **Leitor** | ver a Provisória, o lote, a fila e as fichas **concluídas** (sem CPF e sem abrir documentos) |
| **Editor** | trabalhar nas fichas dos editais em que a pessoa tem papel de analista ou revisor |
| **Administrador** | coordenar os editais em que é gestor ou coordenador: regra da avaliação, linha de corte, distribuição, revisão, equipe, reabertura e comparação com a planilha |

Ficam valendo, como em Recursos e Classificação, a **área** e o **recorte da coordenação** do
edital. Os grupos de acesso padrão propostos são:

- Gestor e Coordenador: Administrador;
- quem analisa: Editor;
- Contratador, Usuário e Jurídico: Leitor.

### 4.2 Papéis por edital (`RL_ANALISTA_EDITAL`)

| Papel | Quem | Pode |
|---|---|---|
| **Analista** | Editor com o papel no edital (ou em vagas dele) | pegar ou receber fichas e analisar só as suas |
| **Revisor** | Editor com o papel | validar ou devolver fichas **de outras pessoas** |
| **Coordenação** | o **gestor do edital** (automaticamente) **ou** o **coordenador** com o papel (decidido em 05/10/2026), com Administrador | regra da avaliação, linha de corte, distribuição, revisão, equipe, reabrir |
| **Administrador global** | — | tudo, e a virada planilha → MONITORA |

Responsável e data vêm **do login e do relógio do banco**, nunca digitados. Quem analisou não
valida. O banco confere tudo nas RPCs (`SECURITY DEFINER`).

### 4.3 Como o painel passa a ler o que a Avaliação documental grava

- O painel continua lendo `TB_ANALISE_CURRICULAR` (pelo cache e pelas RPCs de hoje). A Avaliação
  documental **publica** nessa mesma tabela, com a origem `CO_PLANILHA = 'monitora-<área>'`
  (seção 11). Por isso os indicadores, as pendências, a carga por responsável, a evolução diária e
  o CSV funcionam **sem mudança** para os editais novos e para os antigos.
- Só entram no painel as fichas do **lote**, como hoje (só a aba APTOS PARA ANÁLISE ia para o
  banco). O KPI "Total de aptos p/ análise" continua significando "tamanho do lote".
- Mudanças pequenas no painel (fase 2):
  - mostrar "Em análise" separado de Pendente (campo novo `TP_SITUACAO_FICHA` publicado junto);
  - os contadores da Provisória (inscritos, eliminados, ranqueados, lote) num bloco do painel;
  - o atalho para a ficha.
- O cache do painel (`atualizar_cache_painel_analises`, de 2 em 2 minutos) passa a ser
  **invalidado** também quando uma ficha publica, para o painel não ficar até 2 minutos atrás da
  Avaliação documental.

## 5. Regra da avaliação (por edital, cadastrada e versionada)

Nada fica fixo no código. Cada edital tem a sua **regra da avaliação** (`TB_REGRA_ANALISE` /
`TH_REGRA_ANALISE`), versionada como a regra de classificação:

- salvar cria uma versão (com motivo a partir da segunda);
- cada ficha guarda a versão;
- mudar a regra com fichas concluídas lista as afetadas, e nada é recalculado escondido.

A nota mínima continua **uma só**, a da regra de classificação, e a avaliação lê de lá.

| Bloco | O que guarda |
|---|---|
| **Provisória e lote** | eliminação automática (cancelado, questionário incompleto, reprovado na Empregare, termo recusado); a ordem (ART decrescente, desempate); o tamanho do lote (múltiplo das vagas imediatas + CR ou fixo; geral ou por modalidade; com ou sem os empatados); "a linha anda" |
| **Blocos da ficha** | a lista de blocos, cada um ligado a uma ou mais perguntas da Empregare **pelo enunciado**: título, item do edital, tipo (documento, pontuação, cota, registro, termo), condição ("só se declarou indígena", "só se cota PP"), situações possíveis e o **efeito** de cada situação (seção 7.2) |
| **Motivos padronizados** | por bloco: código, texto que vai ao parecer, item do edital, efeito (ex.: "Diploma sem verso — item 8.11.2 — elimina") |
| **Pontuação** | formação (titulações por nível e pontos, cumulativa ou não); cursos (faixas, teto); experiência (categorias, desempates, pontos por mês ou faixas, teto, dias por mês, unir sobreposições, data limite, máximo de vínculos, estágio de indígena); critério étnico (pontos de indígena e aldeia, teto, lista de aldeias do DSEI). Os pesos variam: no 100/2026, indígena +8 e aldeia +6 (máx. 14); no 28/2026, +7 e +5 (máx. 12). |
| **Nota declarada** | o mapeamento "resposta → pontos" das perguntas, para recalcular a ART e avisar quando ela diverge da nota da Empregare |
| **Situações e parecer** | Apto ("Triados"), Inapto por requisito, Inapto por nota mínima, Inapto por eliminação; um modelo de parecer por situação, com campos (`{edital}`, `{nota}`, `{distribuicao}`, `{motivos}`, `{observacoes}`…), e as observações prontas |
| **Distribuição e revisão** | o modo de distribuição e as opções de revisão (seção 8) |
| **Atalho da Empregare** | os endereços capturados pelo robô (candidaturas da vaga em `TB_EMPREGARE_VAGA."DS_URL_CANDIDATURAS"`, currículo do candidato em `TB_EMPREGARE_CANDIDATO."DS_URL_CURRICULO"`) e o cadastro manual da vaga como alternativa (seção 7.3) |

Modelos para começar:

- o PROJ26-CURRICULAR (Projetos, para o piloto);
- o SI26-100 (o questionário acima);
- o SI26-83;
- o da amostra do simulador (SI26-Interior Sul).

Edital novo copia um modelo e fica "conferir". A tela da regra:

- lista as perguntas que vieram da Empregare e as **respostas encontradas**, para ligar cada uma a
  um bloco e mapear os pontos;
- tem a prévia "testar com um candidato fictício".

## 6. Lista provisória por ART, lote e "a linha anda"

- **Provisória** (item 8.3.1): depois de cada carga do robô, por vaga, todos os inscritos que não
  foram eliminados automaticamente ficam em ordem decrescente da **ART** (a nota da Empregare). Ela
  tem caráter provisório e classificatório e **não valida documentos**.
  - A nota declarada, recalculada pela regra, só confere a ART: divergência vira aviso para a
    coordenação.
  - Os eliminados automáticos ficam registrados com o motivo, sem ficha.
- **Lote de convocação** (item 8.4): a avaliação documental é restrita aos classificados na
  Provisória dentro do limite do lote. O lote é a **linha de corte**. Só o lote ganha ficha
  (decidido: fecha a antiga P1).
  - O tamanho é **personalizável por edital** e por vaga, sem padrão fixo (decidido em 05/10/2026).
    A tela **sugere** um valor (ex.: 3 × vagas imediatas + CR, pelo quadro de vagas), que o gestor
    ou o coordenador edita. Também se escolhe se o lote é geral ou por modalidade e se inclui os
    empatados na linha.
- **"A linha anda"**: quando um candidato do lote é concluído como **Inapto**, ou fica abaixo da
  nota mínima, ou a nota apurada fica abaixo da ART do primeiro de fora, o lote é **reposto** com o
  próximo da Provisória:
  - a troca é registrada ("entrou no lote porque 7000654 ficou inapto");
  - quem já tem ficha não sai do lote por recálculo, só pela conclusão;
  - **publicar cada reposição** é personalizável por edital (decidido em 05/10/2026): "publica
    cada reposição como um novo Lote de Convocação" ou "não publica, só registra".
- A fila mostra os contadores: **Inscritos**, **Eliminados (cancelados/reprovados)**,
  **Ranqueados** e **Lote (aptos para análise)**, com "N de M".

## 7. A ficha (completa)

A ficha é uma página inteira, aberta a partir da fila. Tem três partes:

- o **cabeçalho fixo**: candidato, vaga e nível, modalidade, ART e posição na Provisória, nota em
  tempo real, parciais, situação, "salvo às…", "Anterior/Próxima";
- a **coluna principal**, com os blocos;
- a **coluna lateral fixa**, com o resultado e o parecer.

Veja o [protótipo](prototipo-da-ficha.html).

### 7.1 Blocos por documento ou pergunta

A regra do edital define os blocos; a ficha mostra um **cartão por bloco**, na ordem do
questionário. Cada cartão tem:

1. **Título e item do edital** (ex.: "Diploma da graduação — item 8.11.2").
2. **O que o candidato declarou** (a resposta da Empregare: opção, faixa, "Anexo", "Vídeo",
   "Resposta não informada").
3. **"Abrir na Empregare"**: o atalho para o candidato naquela vaga (seção 7.3), que fica
   registrado.
4. **Situação**: **Conforme** / **Não conforme** / **Não enviado** / **Não se aplica** (atalhos
   de teclado C, N, E, A). "Resposta não informada" sugere "Não enviado"; uma condição falsa
   (ex.: não declarou cota) marca "Não se aplica" sozinha.
5. **Motivo** (obrigatório em Não conforme e Não enviado): **lista de motivos padronizados** do
   bloco, com o item do edital, e mais o **texto livre**.
6. **Efeito**, mostrado ao lado e aplicado pela regra:
   - **elimina** (Inapto, nota 0);
   - **ajusta pontos** (ex.: sem a declaração do Anexo VI, os pontos étnicos não valem);
   - **só registro**;
   - **encaminha** para heteroidentificação ou perícia.

   A ficha resume os efeitos no topo ("2 encaminhamentos, 0 eliminatórios").

Blocos do 100/2026 nível superior:

| Bloco | Situações e efeito |
|---|---|
| Identidade com foto (P4) | Não conforme ou Não enviado → **elimina** |
| Modalidade (P5) | só registro; define que blocos de cota se aplicam |
| Critério étnico (P6 + P7) | declaração do Anexo VI com as assinaturas das lideranças: Conforme → pontos de indígena; aldeia escolhida na **lista do DSEI** → pontos de aldeia; Não conforme → **zera os pontos étnicos** (não elimina) |
| Pretos e pardos (P8 autodeclaração, P9 vídeo, P10 fotos) | completo → **encaminha à heteroidentificação**; incompleto → registro "segue na ampla" (conforme o edital, P9 em aberto) |
| Quilombola (P11) | idem |
| PcD (P12 laudo com CRM) | completo → **encaminha à perícia**; incompleto → segue na ampla |
| Graduação exigida (P13 + diploma P14, item 8.11.2) | Não conforme (ex.: "diploma sem verso", "curso diverso do exigido") → **elimina** |
| Outras formações (P15 + P16) | **lista de títulos** (seção 7.4) → pontos de formação |
| Experiência (P17 + P18, item 8.14) | **tabela de vínculos** (seção 7.5); abaixo do mínimo do edital → **elimina**; o resto → pontos e desempates |
| Parentesco (P19/P20), vínculo ativo (P21), outros DSEI (P22) | só registro (alerta); vínculo ativo pode virar impedimento pela regra |
| Termos (P23/P24) | recusa → **elimina** (já sai na eliminação automática) |

### 7.2 Situação final da ficha

A situação sai da regra: o analista não escolhe.

- **Inapto (requisito)**: algum bloco com efeito "elimina". Nota 0; o parecer lista os motivos com
  os itens do edital.
- **Inapto (nota mínima)**: a nota está abaixo da mínima da regra de classificação (por nível).
- **Apto**: os demais (etapa "Triados").

O analista pode marcar **"Pedir revisão"** em caso de dúvida.

### 7.3 "Abrir na Empregare" (decidido em 05/10/2026, corrigido depois da inspeção do portal)

O portal da Empregare (estrutura vista com login, sem dados pessoais) tem dois endereços úteis.

- **Candidaturas da vaga**: `/empresa/vagas/candidaturas/<token-da-vaga>?m=<etapa>`.
  - O `m` filtra a etapa (as abas Todos, Interessados, Triados, Agendados, Entrevistados…; `m=2` é
    Triados).
  - O token é um identificador codificado da vaga, diferente do código numérico. A página da vaga
    mostra "Código <número da vaga>" junto do token, e é assim que se liga um ao outro.
- **Currículo do candidato**:
  `/empresa/curriculo/detalhes?tokenCandidato=<tk>&id=<id-interno>&candidatura=<token-candidatura>`.
  - Na lista de candidaturas, cada candidato traz no HTML `data-pessoa-id` (o código numérico de 7
    dígitos, o mesmo "CÓDIGO" do Excel, ou seja, `CO_CANDIDATO_EMPREGARE`), `data-tokencandidato`
    e `data-candidatura-id`, e no mesmo bloco o link para essa ficha.
  - O `id` é interno (provavelmente da pessoa), **não** o token da vaga.
  - **Os tokens não saem do código numérico**: o robô precisa capturá-los.

Como fica no desenho:

- **O robô captura os endereços** (fase F7 do plano), a cada execução, porque os tokens podem mudar.
  - Por vaga: o token e o endereço de candidaturas, em `TB_EMPREGARE_VAGA."DS_URL_CANDIDATURAS"`.
    Ele usa a aba **Todos** (valor de `m` a confirmar: provavelmente `-1` ou sem `m`) e percorre a
    lista inteira, que carrega aos poucos.
  - Por candidato (casando `data-pessoa-id` com `CO_CANDIDATO_EMPREGARE`): o endereço completo do
    currículo, em `TB_EMPREGARE_CANDIDATO."DS_URL_CURRICULO"`.
- **Na ficha**, o botão **"Abrir na Empregare"**:
  - abre **direto o currículo do candidato**, quando o endereço já foi capturado;
  - se não, abre as **candidaturas da vaga**, e a ficha mostra o **código do candidato** com o botão
    **"Copiar"**, para colar na busca da Empregare;
  - se a vaga também não tem endereço, o gestor ou o coordenador **cadastra à mão** o de
    candidaturas. Até lá, fica só o "Copiar código".
- **São dados restritos.** Os links só funcionam para quem está logado na Empregare e não expõem
  nada sem login. Mesmo assim:
  - só quem pode ver a ficha recebe os links, pela RPC da ficha; nunca aparecem em lista, CSV nem
    log;
  - cada abertura e cada cópia ficam em `TL_ACESSO_FICHA_ANALISE`;
  - nenhum token real vai para docs, testes ou log do Actions (mascaramento do robô).
- **Os documentos continuam na Empregare** no MVP (sem download). A fase B (documentos num bucket
  privado) fica para depois, se for pedida.

### 7.4 Formação acadêmica: lista de títulos

Cada linha tem:

- nível (graduação, especialização, residência, mestrado, doutorado);
- curso, instituição e carga horária;
- comprovante usado (P14/P16);
- **aceito sim/não** e motivo (padronizado + livre).

Vale a regra do edital: não cumulativa (vale o maior título aceito) ou cumulativa com teto. O
declarado na P15 aparece ao lado. Cursos de aperfeiçoamento, quando o edital pontua, ficam numa
segunda tabela, com faixa de carga horária e teto.

### 7.5 Experiência profissional: tabela de vínculos

Cada linha tem:

- empregador ou órgão;
- cargo;
- **categoria de desempate** (Saúde Indígena = desempate 1, Atenção Básica = desempate 2, outras
  da regra);
- início e fim;
- **comprovante usado** (CTPS, declaração, contrato…);
- **aceito sim/não** e motivo (ex.: "sem data de término — item 8.14 'a'", "cargo diverso",
  "fora do SUS").

O banco calcula:

- a **união das sobreposições** por categoria e no total;
- os **meses** (dias ÷ 30, só os inteiros, até a data limite);
- os **pontos** (por mês ou por faixas, com teto);
- os **tempos de desempate** em anos, meses e dias;
- o **estágio de indígena sem experiência** (horas ÷ 8 ÷ 22, só os inteiros).

O requisito de experiência mínima (ex.: 6 meses) vira o efeito "elimina" quando não é atingido. A
faixa declarada (P17) aparece ao lado, e a diferença pede observação.

### 7.6 Parecer

- O **parecer automático** é montado pelo modelo da situação: a distribuição dos pontos (Formação
  Acadêmica, Experiência Profissional, Critério Étnico…) ou a lista dos motivos de inaptidão, com
  os itens do edital.
- As **observações** do analista entram abaixo, com as observações prontas da regra. Os motivos
  escolhidos nos blocos já entram como frases prontas.
- O parecer é o texto que vai para a lista de **INAPTOS** e para o recurso.

### 7.7 Trabalho rápido e seguro

- **Atalhos de teclado**:
  - C / N / E / A: situação do bloco em foco;
  - J / K: bloco seguinte e anterior;
  - Ctrl+S: salvar;
  - Ctrl+Enter: "Concluir e próxima";
  - Ctrl+E: "Abrir na Empregare";
  - ?: mostra a lista.
- **Rascunho automático**, alguns segundos depois de cada mudança. "Salvo às HH:MM" só aparece
  depois de o banco confirmar.
- **"Concluir e próxima"**: confere o que falta, conclui e abre a próxima da fila.
- **Trava de concorrência**: abrir a ficha cria uma **reserva** de 15 minutos, renovada enquanto a
  tela está aberta. Quem abre depois vê "Em uso por Ana desde 10:15", só para leitura, e a
  coordenação pode liberar. Mesmo assim, cada salvamento leva o número da versão: se outra pessoa
  salvou antes, o banco recusa ("Esta ficha mudou desde que você abriu").
- **Auditoria de cada clique relevante**: abrir, reservar, liberar, "Abrir na Empregare", mudar a
  situação de um bloco, aceitar ou recusar um vínculo ou título, revelar o CPF, concluir, pedir
  revisão, validar, devolver, reabrir. São eventos leves em `TL_EVENTO_FICHA_ANALISE`, e o retrato
  completo vai para `TH_FICHA_ANALISE` a cada salvamento e transição.

## 8. Fila, distribuição e revisão

### 8.1 A fila

- Faixa com os contadores da Provisória e do lote, e a configuração do edital.
- Indicadores em card compacto: No lote, Em análise, Para revisar, Aptos, Inaptos, Fora do lote.
- Filtros: vaga, situação, responsável, modalidade, sinais, "só as minhas".
- Tabela na **ordem da Provisória**, com posição, código, nome, modalidade, ART, nota apurada,
  sinais, situação, responsável, reserva ("em uso por…") e tempo parado. A linha de corte do lote
  é tracejada, e os primeiros de fora aparecem esmaecidos.
- Abas: **Lote**, **Provisória completa**, **Eliminados** (automáticos, com motivo) e **Inaptos**
  (com o parecer).
- Busca por código.

### 8.2 Distribuição (personalizável por edital — decidido em 05/10/2026)

O gestor do edital ou o coordenador escolhe o modo:

- **"Pegar próximo"**: reserva atômica, na ordem da Provisória;
- **"Distribuição inicial"**: reparte o lote entre os analistas, em partes iguais ou até um limite,
  com prévia. Os que entram pela linha que anda vão para quem tem menos pendentes.

Nos dois modos dá para **atribuir e redistribuir** com motivo. Ficha parada há mais de N dias úteis
vira pendência.

### 8.3 Revisão (personalizável por edital — decidido em 05/10/2026)

Pode-se combinar:

- amostra com X% (mínimo por analista, sorteio reprodutível);
- todas as fichas;
- só as inapta (por requisito e/ou por nota);
- as divergentes do declarado acima de Y pontos;
- as com sinal de vínculo ou parentesco;
- as que entraram pela linha que anda;
- duplo-cego (opcional);
- nenhuma.

O revisor valida ou devolve com motivo. Mudar a configuração vale dali em diante.

### 8.4 Situações e o que vai para `TB_ANALISE_CURRICULAR`

| Situação | Grava (`status_consolidado` / `etapa`) |
|---|---|
| *Eliminado automático* (sem ficha) | não grava (fica em `TB_PRE_CLASSIFICACAO`) |
| *Ranqueado fora do lote* (sem ficha) | não grava |
| **Pendente** / **Em análise** (no lote) | Pendente / nula |
| **Revisar** | Revisar / nula |
| **Concluída: Apto** | Aprovado / "Triados" |
| **Concluída: Inapto** (requisito ou nota mínima) | Reprovado / "Reprovado" — e a linha anda |

```
Pendente ──pegar/atribuir──► Em análise ──concluir──┬─(revisão)──► Revisar ──validar──► Concluída
    ▲                            │  ▲                 │                │
    └──devolver à fila───────────┘  └──devolver (revisor, com motivo)──┘
                                                      └─(sem revisão)──► Concluída
Concluída ──reabrir (coordenação, motivo; só antes da publicação da preliminar)──► Em análise
```

Depois da publicação do Resultado Preliminar, a ficha não reabre: a mudança é por recurso.

## 9. Auditoria e histórico

- `TH_FICHA_ANALISE`: retrato **imutável** da ficha (blocos, títulos, vínculos, nota, parecer,
  situação) a cada salvamento e transição, com SHA-256.
- `TL_EVENTO_FICHA_ANALISE`: os cliques relevantes (seção 7.7), também imutáveis.
- Um gatilho recusa `update` e `delete`. A tela mostra uma linha do tempo e a comparação entre duas
  versões.

## 10. LGPD

| Dado | Quem vê | Como |
|---|---|---|
| Nome, vaga, modalidade, nota, parecer | Leitor do painel e da Avaliação documental | como hoje |
| CPF | analista, revisor e coordenação do edital | mascarado; "Mostrar" por 60 s, registrado |
| Nascimento | os mesmos | a idade sempre; a data só na ficha |
| E-mail e telefone | ninguém na ficha | só na Lista de aprovados/convocação |
| Documentos | quem tem o papel na ficha | ficam na Empregare (MVP) ou num bucket privado com URL assinada curta (fase B); cada abertura é registrada |
| Nome do parente (P20) | analista, revisor e coordenação | mascarado como o CPF |

Os registros de acesso ficam só para a coordenação e o administrador global. O robô não imprime
dado pessoal no log público do Actions.

## 11. Como a avaliação grava (sem quebrar a carga das planilhas)

- A gravação vai para a **mesma `TB_ANALISE_CURRICULAR`**, com as novas origens
  `monitora-saude-indigena`, `monitora-sede` e `monitora-projetos` em `TB_PLANILHA_ANALISE`. As
  cargas das planilhas só mexem na própria `CO_PLANILHA`.
- `private."FC_PUBLICAR_FICHA"` grava, a cada transição:
  - situação e etapa;
  - responsável (do login) e data (da conclusão);
  - as parciais e a nota (0 se inapto por requisito);
  - os tempos de saúde indígena, atenção básica e o total (em dias, como a planilha);
  - o parecer, a modalidade, o PcD e o nascimento;
  - a **ART** em `nota_empregare`.

  O `id_origem` recebe o código Empregare, o que deixa a `chave_natural` igual à da planilha.
- A Classificação já recebe tudo o que usa:
  - nota documental e parciais;
  - situação;
  - desempates (saúde indígena, atenção básica, experiência total, 60 anos pela data de
    nascimento, PcD);
  - a ART (`nota_art`), que **é** a nota da Empregare (decidido: fecha a antiga P16).
- **Dono único por edital** (`TB_ORIGEM_ANALISE_EDITAL`: `PLANILHA`, `COMPARACAO` ou `MONITORA`).
  Como a `chave_natural` é única, planilha e MONITORA não podem gravar o mesmo edital. Na
  `COMPARACAO`, o MONITORA não publica nada.
- Uma tabela nova com uma view unificada foi descartada: todos os vínculos apontam para
  `TB_ANALISE_CURRICULAR.id`, e uma view criaria dois `id` para o mesmo candidato.

## 12. Recurso e ajuste

- O mecanismo não muda. O ajuste aprovado (`TB_AJUSTE_PONTUACAO_RECURSO`) vale por cima da nota,
  sem alterar a ficha.
- A gaveta do recurso ganha **"Ver ficha da avaliação"** (só leitura): blocos, motivos, títulos,
  vínculos, parecer e histórico. Ao propor o ajuste, os valores anteriores vêm da ficha.
- Os desempates não estão entre os itens do ajuste; entram se o recurso puder mudá-los (P14).
- **Observação operacional (jurídico):** hoje **nenhum usuário tem o grupo "juridico"**. Na
  prática, só os administradores dão o parecer jurídico nos recursos. Para separar as funções,
  alguém precisa receber o grupo Jurídico (Configurações › Acessos) antes do primeiro prazo de
  recurso de um edital na Avaliação documental.

## 13. Listas oficiais e de onde vem cada uma

Ordem de publicação do edital 100/2026 (vaga de CASAI), da qual se aproveita a **estrutura**:

| # | Publicação | Conteúdo (estrutura) | Item do edital | De onde vem no MONITORA | Existe hoje? |
|---|---|---|---|---|---|
| a | **Lista Geral de Classificação Provisória – Ranqueamento Eletrônico** | por vaga: nome e "Nota da Autodeclaração de Requisitos e Títulos (ART)", em ordem decrescente; provisória, classificatória, não valida documentos | 8.3.1 | **Avaliação documental** (`TB_PRE_CLASSIFICACAO`), gerada como lista da Classificação | **não**: novo tipo de lista `PROVISORIA` |
| b | **Lote de Convocação** | por vaga: os classificados na Provisória dentro do limite do lote, convocados para a avaliação documental | 8.4 | **Avaliação documental** (o lote) | **não**: novo tipo `LOTE` (um por reposição, se o edital publicar) |
| c | **Resultado Preliminar – Etapa de Avaliação Documental e de Títulos – APTOS** | por vaga, com o cabeçalho da vaga e as vagas por modalidade ("2 vagas (1 AC + 1 Pretos e Pardos + CR)"); colunas Classificação Geral, Nome Completo, Modalidade (AC/PP/PI/PcD/Quilombola), Formação Acadêmica, Experiência Profissional, Critério Étnico, Nota na Avaliação Documental e de Títulos, Classificação na Modalidade | 8.5 | **Classificação**, lista `PRELIMINAR`, fase Preliminar, recorte geral + modalidades | **sim** (`PRELIMINAR_PRELIMINAR`); conferir o título e a coluna "Classificação na Modalidade" |
| d | **Resultado Preliminar – INAPTOS** | por vaga: nome, modalidade, notas e o **parecer** da análise | 8.5 "b" | **Classificação**, recorte eliminados; a "Justificativa" passa a ser o **parecer da ficha** | **sim** (`PRELIMINAR_PRELIMINAR_ELIMINADOS`) |
| e | Prazo de recurso | — | — | **Recursos** (já existe) | sim |
| f | **Resultado Final – APTOS** e **– INAPTOS** | as mesmas colunas, depois dos recursos (com os ajustes aprovados) | — | **Classificação**, `PRELIMINAR` fase Final | **sim** (`PRELIMINAR_FINAL`, `PRELIMINAR_FINAL_ELIMINADOS`) |
| g | **Convocação para Entrevista** | Nº (ordem de convocação), Nome, Vaga, Modalidade, Data, Horário, local | — | **Classificação** `CONVOCACAO` + **Agenda das entrevistas** (#273) | **sim** |
| h | **Resultado final do processo** | classificação final, vagas e CR | — | **Classificação** `FINAL` → "Publicar como lista de aprovados" | **sim** |

O que já existe (`src/lib/classificacao/catalogo.js`): `TIPOS_DE_LISTA` = `PRELIMINAR`
(avaliação documental), `CONVOCACAO`, `ENTREVISTA` e `FINAL`, com `FASES_DA_PUBLICACAO`
Preliminar/Final e os modelos do SEI em `documento-sei.js`. O que falta criar:

1. **`PROVISORIA`**: ranking pela ART de todos os inscritos não eliminados, por vaga, sem validar
   documentos. Colunas: Classificação, Nome, ART.
2. **`LOTE`**: o lote de cada vaga (e as reposições), com a ordem e a ART.
3. Na `PRELIMINAR`:
   - o título padrão "RESULTADO PRELIMINAR – ETAPA DE AVALIAÇÃO DOCUMENTAL E DE TÍTULOS" (decidido
     em 05/10/2026; hoje "…ANÁLISE CURRICULAR"), editável por edital pelos textos que já existem;
   - a coluna **Classificação na Modalidade**, se ainda não sair;
   - o **parecer da ficha** como "Justificativa" dos inaptos.

**Modelo de documento do SEI de cada lista**: o padrão das publicações da AgSUS que
`documento-sei.js` já segue.

- **Cabeçalho**: "Brasília, na data da assinatura digital." e o título em caixa alta.
- **"1. DISPOSIÇÕES PRELIMINARES"**, com os itens do edital que fundamentam a lista:
  - 8.3.1 para a Provisória;
  - 8.4 para o Lote;
  - 8.5 para o Preliminar;
  - o prazo de recurso;
  - as notas mínimas.
- **Quadro por vaga**: "VAGA código - cargo - lotação - unidade - N vagas (x AC + y PP + CR)", com
  todas as vagas, inclusive as vazias.
- **"2. DISPOSIÇÕES FINAIS"**.

As duas listas novas ganham modelos próprios (`PROVISORIA`, `LOTE`), com os textos editáveis por
edital, como os demais.

## 14. Indicadores

- O **Painel das análises** continua igual (seção 4.3). A data da análise passa a ser a do sistema.
- Na Avaliação documental, para a coordenação:
  - produtividade por analista e tempo mediano por ficha;
  - devoluções;
  - motivos mais comuns por bloco;
  - divergência entre ART e apurado;
  - encaminhamentos (heteroidentificação, perícia);
  - no piloto, a concordância planilha × MONITORA.

## 15. Plano de transição

| Fase | O que entra | Saída |
|---|---|---|
| **0. Preparação** | o piloto é o **93/2026** (SESMT, Projetos; decidido em 05/10/2026). Antes de tudo: as 5 vagas do edital entram na Seleção, que hoje tem **0** vagas dele, ou o robô roda com `vagas` = os 5 códigos, ligando as vagas ao edital; a regra da avaliação vem do PROJ26-CURRICULAR + os blocos do questionário (lote sugerido 3 × 11 vagas imediatas + CR, editável); a equipe; o recurso `avaliacao_documental` nos grupos | regra conferida pelo gestor ou pelo coordenador; as vagas com candidatos no robô (hoje **0**) |
| **1. Piloto em comparação** | o MONITORA monta a Provisória, o lote e as fichas do 93/2026 em paralelo, sem publicar, enquanto a planilha de Projetos continua oficial | a Provisória e o lote batem com a aba APTOS PARA ANÁLISE (86 linhas em 5 vagas)? A nota declarada bate com a ART? |
| **1b. Segundo piloto** | um edital da Saúde Indígena (critério étnico com aldeias, cotas, desempates) | a mesma comparação |
| **2. Virada do 93/2026** | 1) o 93/2026 fica inativo na `DIM_EDITAIS` da planilha de Projetos; 2) a carga seguinte confirma; 3) o administrador global vira: as **86 linhas ativas** são **adotadas** (o mesmo `id`, e a origem passa para `monitora-projetos`); as **15 em Revisar** viram fichas "importadas da planilha" com o parecer, na situação Revisar, para um revisor validar (P18); as **71 Pendentes** viram fichas Pendentes, pré-preenchidas pela Empregare, na Avaliação documental | o 93/2026 é 100% MONITORA; a Classificação, as entrevistas e os recursos continuam ligados pelo `id` |
| **3. Editais novos** | nascem `MONITORA`, com a regra copiada de um modelo | as planilhas e o simulador param de receber editais |
| **4. Em andamento** | edital a edital, entre etapas (nunca durante um prazo de recurso) | — |
| **5. Desligamento** | desativar o simulador e o web app, desligar os gatilhos, arquivar as planilhas, retirar a carga do banco e `apps-script/` | fim da cadeia |

## 16. O que deixa de existir

| Item | Substituído por |
|---|---|
| Simulador (uma cópia por DSEI/edital) e o web app do Apps Script | a ficha e a regra da avaliação |
| Planilhas de vaga: IMPORTACAO EMPREGARE, TOTAL DE CANDIDATOS, ELIMINADOS | Provisória por ART (`TB_PRE_CLASSIFICACAO`) |
| … APTOS PARA ANÁLISE | lote + fichas ("a linha anda") |
| … RANQUEAMENTO, DESCLASSIFICADOS, QUERY | Classificação (listas c, d, f) e a aba Inaptos |
| Exportar o Excel à mão | o robô (já existe) |
| `DIM_EDITAIS`, `DIM_VAGAS`, `DIM_RESPONSAVEIS` | cadastro do edital, vagas da Seleção/Empregare, `RL_ANALISTA_EDITAL` |
| `FATO_ANALISES`, `FATO_ANALISES_STG`, `LOG_CONSOLIDACAO`, `META_PAINEL`, `REL_PRE_VALIDACAO`, `REL_AUDITORIA_FATO`, `CTRL_SYNC_ORIGENS` | publicação direta + `TH_FICHA_ANALISE` |
| Scripts `1-atualizar-base`, `2-sincronizar-full`, `3-incremental`, `4-orquestrador` (SI, Projetos, SEDE) | nada |
| Gerador de PDF no Drive | "Imprimir a ficha" (P7) |
| Painel web de Projetos (Google Sites) | o Painel das análises |
| No banco, depois do último edital: `TL_SYNC_ANALISE`, `TM_ANALISE_CURRICULAR`, `TA_ORIGEM_ANALISE`, as RPCs de sync | — |

**Continuam:** `TB_ANALISE_CURRICULAR`, `TB_EDITAL_ANALISE`, `TB_PLANILHA_ANALISE` (com as origens
MONITORA), as planilhas arquivadas (só leitura), a planilha Auditoria, a "[dash] entrevistados" e
o robô.

## 17. Riscos, decisões e perguntas

### Riscos

| Risco | Mitigação |
|---|---|
| **R1.** Há um risco de exposição no fluxo atual, descrito fora do repositório | a avaliação no MONITORA exige login, papel no edital e registro; o simulador e o web app são desativados na fase 5 |
| R2. Documentos só na Empregare (o analista precisa do login dela); os tokens dos endereços mudam e a tela do portal pode mudar | o robô recaptura os endereços a cada execução; sem currículo capturado, abre a vaga + "Copiar código"; links tratados como dado restrito; fase B opcional |
| R3. A Empregare muda os enunciados e o bloco perde a pergunta | ligação pelo enunciado, conferida a cada carga; a ficha mostra "pergunta não encontrada" |
| R4. Planilha e MONITORA no mesmo edital (recusa da carga inteira) | dono único por edital e virada em passos |
| R5. Regra mal cadastrada | modelo + "conferir" + prévia + piloto em comparação + o banco recalcula |
| R6. Diferença de conta com o simulador e a planilha (dias ÷ 30, união com o dia seguinte, ano = 365) | os casos do simulador viram teste automatizado |
| R7. Volume e concorrência | reserva da ficha, versão otimista, índices e fila paginada |
| R8. Resistência à mudança | o mesmo jeito do simulador, mais atalhos de teclado e "Concluir e próxima"; o piloto mede o tempo |
| R9. LGPD | papel por edital, mascaramento, registro, URL assinada curta |
| R10. Ninguém com o grupo Jurídico | atribuir o grupo antes do primeiro recurso (seção 12) |

### Decididas em 05/10/2026

- **P1. Quem entra na fila:** o **lote de convocação** (item 8.4), recortado da Provisória por ART;
  "a linha anda" repõe o lote.
- **P3. Revisão:** personalizável por edital.
- **P4. Quem cadastra a regra e distribui:** o gestor do edital ou o coordenador.
- **P5. Distribuição:** personalizável ("Pegar próximo" ou distribuição inicial, com
  redistribuição).
- **P6. Piloto:** um edital de Projetos.
- **P16. ART:** a ART é a nota da Empregare; `nota_empregare` = ART.
- **Separação painel × trabalho:** "Painel das análises" (recurso `analises`) e "Avaliação
  documental" (recurso novo `avaliacao_documental`).

- **P1b. Tamanho do lote** — **decidido em 05/10/2026**: personalizável por edital e vaga, sem
  padrão fixo. A tela sugere um valor (ex.: 3 × vagas imediatas + CR), editável. Publicar ou não
  cada reposição também é personalizável por edital.
- **P2. Empregare** — **decidido em 05/10/2026**: o robô captura, a cada execução, o endereço de
  candidaturas de cada vaga (`DS_URL_CANDIDATURAS`) e o do currículo de cada candidato
  (`DS_URL_CURRICULO`). O botão abre direto o currículo; sem ele, abre a vaga e oferece "Copiar
  código"; sem endereço da vaga, ele é cadastrado à mão. Os links são tratados como dado restrito,
  e os documentos ficam na Empregare no MVP (seção 7.3).
- **P6b. Edital piloto** — **decidido em 05/10/2026**: o **93/2026** (SESMT, área Projetos, ativo).
  Situação no banco em 05/10/2026, só em contagens:
  - 86 análises ativas da planilha de Projetos, em 5 vagas: 71 Pendentes e 15 em **Revisar**
    (essas 15 têm parecer; nenhuma está com etapa Triados/Reprovado);
  - regra de classificação cadastrada;
  - quadro de vagas com 5 vagas e 11 vagas imediatas;
  - **nenhuma vaga na Seleção** e **nenhum candidato no robô da Empregare**.

  O plano está na seção 15 e em [`plano-de-construcao.md`](plano-de-construcao.md).
- **P17. Título das listas** — **decidido em 05/10/2026**: "Avaliação Documental e de Títulos" é o
  título padrão das listas da etapa (editável por edital).

### Em aberto

- **P7.** Alguém usa o PDF no Drive, ou basta imprimir a ficha?
- **P9. Cotas:** documentação de cota incompleta faz o candidato seguir na ampla? A
  heteroidentificação e a perícia vão ser registradas no MONITORA depois?
- **P10.** Vínculo ativo ou parentesco: só alerta, ou impedimento em algum edital?
- **P11.** Bloquear "Concluir" fora da janela da análise, ou só avisar?
- **P13.** Quem tem as listas de aldeias dos outros DSEI?
- **P14.** O recurso pode mudar os desempates?
- **P15.** O que é a coluna "Origem convocação" da planilha (lote, reposição, cota)?
- **P18. As 15 em "Revisar" do 93/2026:** na planilha elas têm parecer, mas não têm etapa. Na
  virada, entram na Avaliação documental como fichas "importadas da planilha", na situação Revisar,
  para um revisor validar. Ou a equipe preenche a etapa na planilha antes da virada?
