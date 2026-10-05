# Análise curricular dentro do MONITORA — desenho

Situação: **desenho para aprovação** (05/10/2026). Nada aqui está implementado; não há migration nem
código. O usuário aprovou começar o desenho com o pedido "pode começar a desenhar a Análise dentro do
MONITORA". As perguntas que ainda dependem de decisão estão no fim (seção 16).

Documentos irmãos:

- [`modelo-de-dados.md`](modelo-de-dados.md): tabelas, view e RPCs propostas, no padrão MAD.
- [`../historias-de-usuario/analises-no-monitora.md`](../historias-de-usuario/analises-no-monitora.md):
  histórias de usuário com critérios de aceite, divididas em MVP e "depois".
- [`prototipo-da-ficha.html`](prototipo-da-ficha.html): protótipo estático da fila e da ficha, com
  dados fictícios, no visual do MONITORA. É só para aprovar o desenho.

---

## 1. Objetivo

Hoje a nota curricular percorre uma cadeia longa, e qualquer elo pode falhar:

```
Empregare ──(robô do MONITORA)──► TB_EMPREGARE_CANDIDATO
   │
   └─(Excel exportado à mão) ► planilha de cada vaga no Drive (aba "APTOS PARA ANÁLISE")
                                   ▲
                                   │ o analista pontua no SIMULADOR (página HTML local, regra fixa
                                   │ de um DSEI/edital), que lê e grava a linha por um web app do Apps Script
                                   ▼
                    planilha central da área (DIM_EDITAIS, DIM_VAGAS, DIM_RESPONSAVEIS)
                                   │  Apps Script "Atualizar base" (de 20 em 20 min, lotes de 2,5 min)
                                   ▼
                    FATO_ANALISES ─► Apps Script FULL/incremental/orquestrador
                                   │  (gatilhos, travas de 30 min, "a planilha mudou", porteiro)
                                   ▼
                    TB_ANALISE_CURRICULAR ─► Classificação ─► Lista de aprovados
```

**Objetivo:** o analista abre a ficha do candidato **no MONITORA**. A ficha já vem com os dados e as
respostas do questionário que o robô trouxe da Empregare, e faz tudo o que o simulador faz:
checklist de admissibilidade, critério étnico com aldeia, escolaridade, cursos, vínculos de
experiência com desempate, nota de corte e parecer automático. A diferença é que a regra vem
**cadastrada por edital**, e não fixa no código. A nota vai direto para a Classificação: sem
simulador, sem planilha de vaga, sem planilha central e sem Apps Script.

O que **não muda**:

- `TB_ANALISE_CURRICULAR` continua sendo a tabela única que a Classificação, o painel de Análises, as
  Entrevistas, os Recursos e a Lista de aprovados leem.
- O `id` da análise continua sendo a chave que liga entrevista, recurso, ajuste e aprovado.
- O painel de Análises curriculares, a regra de classificação versionada e o ajuste de pontuação
  pelo recurso continuam como estão.

## 2. Como é feito hoje (levantamento)

### 2.1 Planilhas e abas

| Onde | O que tem | Quem mexe |
|---|---|---|
| **Planilha de cada vaga** (uma por vaga, numa pasta do Drive por edital; o link da pasta fica em `DIM_EDITAIS.pasta_origem_link`) | as abas da seção 2.1.1 | quem monta a vaga, o simulador e o analista |
| **Planilha central** da área (Saúde Indígena: "Central Monitora Análises - Saúde Indígena"; Projetos: "Central AgSus Monitora Sede e Projetos"; SEDE: planilha própria) | `DIM_EDITAIS` (grupo, unidade, edital, pasta, ativo, janela da análise), `DIM_VAGAS` (vagas lidas dos nomes dos arquivos), `DIM_RESPONSAVEIS` (responsável e coordenação por vaga), `FATO_ANALISES` e `FATO_ANALISES_STG` (a consolidação, com 52 colunas), `LOG_CONSOLIDACAO`, `META_PAINEL`, `REL_PRE_VALIDACAO`, `REL_AUDITORIA_FATO`, `CTRL_SYNC_ORIGENS` | os scripts e a coordenação |
| **Painel web** de Projetos (Google Sites: Script Projetos 3/4/6/7) | leitura da FATO | ninguém edita |

#### 2.1.1 Por dentro de uma planilha de vaga

Levantamento feito numa planilha real (uma vaga de CASAI do edital 100/2026, em 05/10/2026). Os
nomes e os dados dos candidatos ficam fora deste documento.

| Aba | O que faz |
|---|---|
| **IMPORTACAO EMPREGARE** | Recebe o Excel da Empregare colado inteiro: são as mesmas colunas que o robô já grava em `TB_EMPREGARE_CANDIDATO."DS_COLUNA_ORIGINAL"`. Fórmulas calculam a **nota declarada** a partir das respostas: **Escolaridade** pela pergunta 15 (ex.: "Especialização na área à qual concorre" = 1; "Não possuo" = 0), **Experiência** pela pergunta 17 (a faixa "4 anos e 2 meses" vira meses × 0,2, com teto de 10) e **Indígena** pela pergunta 6 ("Sou indígena", "Moro em aldeia"). NOTA = soma. A aba também traz SITUAÇÃO (INSCRITO/CANCELADO), a situação do questionário (FINALIZADO/EM ANDAMENTO), REPROVADO, MARCADORES e a nota da Empregare ("x/30"). |
| **TOTAL DE CANDIDATOS** | Todos os candidatos, ordenados pela nota declarada (no exemplo, 161 ranqueados), com concorrência, nota da Empregare, escolaridade, experiência, critério étnico e nota final. |
| **ELIMINADOS** | Os que cancelaram e os que não finalizaram o questionário, com o MOTIVO DA ELIMINAÇÃO. |
| **APTOS PARA ANÁLISE** | Só os candidatos **até a linha de corte** pela nota declarada (no exemplo, 22 de 161). O cabeçalho mostra INSCRITOS, CANCELADOS/REPROVADOS, TOTAL RANQUEADOS e APTOS PARA ANÁLISE (LINHA DE CORTE). Colunas: NOME, CÓDIGO, nascimento, NOTA EMPREGARE, modalidade, NOTA FINAL AJUSTADA, Escolaridade, Experiência, Indígena, Somatório, experiência na saúde indígena e na atenção básica (anos, meses, dias e total), ETAPA (Triados/Reprovado), DATA DA ANÁLISE, ANÁLISE (o parecer, com o mesmo texto do simulador: "Candidato(a) HABILITADO(A) na Análise Documental com a pontuação total de X pontos… Critério Étnico… Formação Acadêmica… Experiência/Estágio…"), PCD, Responsável pela Análise, ">=60 anos" e "Origem convocação". É **esta** aba que o "Atualizar base" lê. |
| **RANQUEAMENTO** | O resultado depois da análise: código, nome, nota final ajustada e origem da convocação. |
| **DESCLASSIFICADOS** | Os reprovados, com o parecer (ex.: itens 8.11 "b"/"c": escolaridade mínima, experiência mínima de 6 meses). |
| **QUERY** | Auxiliar das fórmulas. |

O que isso ensina:

- A análise **não começa por todos**. Há uma **pré-classificação** pela nota declarada, e só quem
  está até a linha de corte vai para a análise.
- A nota declarada depende do **mapeamento "resposta → pontos"** de cada questionário. Os pesos
  mudam de edital para edital: no 100/2026, indígena vale +8 e aldeia +6 (máx. 14); no simulador do
  28/2026, +7 e +5 (máx. 12). **Nada disso pode ficar fixo no código.**

### 2.2 Scripts (pasta `apps-script/` e o que ficou só no Google)

| Script | Papel |
|---|---|
| **Web app do simulador** (só no Google) | lê a linha do candidato na planilha da vaga e grava a análise de volta |
| `1-atualizar-base.gs` ("Atualizar base") | lê as pastas, monta a `DIM_VAGAS`, abre cada planilha de vaga, acha o cabeçalho por **centenas de apelidos** (`SOURCE_HEADER_ALIASES`) e grava a `FATO_ANALISES`. Calcula `status_consolidado` a partir do texto da ETAPA e da ANÁLISE (`derivarStatusConsolidado_`) e a experiência total em dias (anos × 365 + meses × 30 + dias). Roda em lotes de 2,5 min, com gatilhos de continuação. |
| `2-sincronizar-com-supabase-full.gs` | envio completo da FATO para o banco (`processar_sync_analises_lote`) |
| `3-analises-incremental.gs` | envio só do que mudou (`comparar_analises_incremental`, `processar_sync_analises_incremental_lote`) |
| `4-orquestrador-fato-supabase.gs` | o gatilho de 20 em 20 minutos que encadeia os outros |
| gerador de PDF (só no Google) | gera um PDF por análise no Drive (`link_pdf`, `pdf_status`): 3.707 gerados e 703 com erro na Saúde Indígena; 1.285 gerados em Projetos |

### 2.3 O simulador do analista (o modelo da ficha)

O analista usa uma página HTML local, o "Simulador AgSUS - DSEI Interior Sul" (V6.7, edital
28/2026). Ela **não** fica no repositório, porque contém o endereço do web app que lê e grava nas
planilhas. O que ela faz:

1. **Busca** o candidato pelo **código**, na planilha da vaga cujo **ID** o analista cola. A data da
   análise e o **responsável** são **digitados à mão**.
2. **Checklist de admissibilidade.** Começa todo marcado; o analista desmarca o que o candidato não
   cumpriu. Cada item tem o seu item do edital:
   - ID/CPF legíveis (3.4.1 "c" e "d");
   - escolaridade mínima (3.1.1);
   - experiência mínima de 1 mês na área (3.1.1 "c");
   - comprovação: CTPS sem páginas extras e declarações assinadas (7.5);
   - arquivo único em PDF (7.7);
   - declaração étnica do Anexo VI assinada pelas lideranças (7.3, só se indígena).

   Um item desmarcado basta: o candidato fica **ELIMINADO (INABILITADO)**, com nota 0, e o parecer
   lista os motivos.
3. **Critério étnico.** Indígena vale +7; morar em aldeia, +5 (total 12). Os +5 só valem se a
   aldeia estiver na **lista oficial do DSEI**: são 238 aldeias, no formato "NOME-(código do polo)".
   Se a aldeia não está na lista, os +5 são negados, com aviso. A modalidade "indígena" da planilha
   já marca "indígena".
4. **Escolaridade pelo nível da vaga** (o analista escolhe o nível a cada candidato):
   - superior: graduação 0, especialização +1, mestrado/residência +2, doutorado +3;
   - técnico/médio: médio 0, graduação +3;
   - fundamental: fundamental 0, médio +3.
5. **Cursos**, com contadores: ≥ 81 h vale 0,5; de 41 a 80 h, 0,3; ≤ 40 h, 0,2. Teto de 5.
6. **Experiência** em até **10 vínculos**, cada um com categoria e datas de início e fim:
   - categorias: Saúde Indígena (desempate 1), Atenção Básica (desempate 2), Saúde Geral/Residência;
   - os períodos que se sobrepõem são **unidos** (não somam duas vezes);
   - meses = dias ÷ 30, só os inteiros; 0,2 ponto por mês; teto de 10;
   - os totais de saúde indígena e atenção básica viram anos/meses/dias (÷ 365 e ÷ 30) para o
     desempate;
   - **estágio de candidato indígena sem experiência** (7.5.7.2): horas ÷ 8 ÷ 22 = meses (só os
     inteiros).
7. **Nota de corte de 8,0** (7.13.1). Nota ≥ corte: **HABILITADO** (etapa "Triados"). Abaixo:
   **NÃO HABILITADO** (etapa "Reprovado"). Eliminado: **INABILITADO** (etapa "Reprovado", nota 0).
8. **Parecer automático**, com um texto padrão para cada situação ("Edital 28/2026 — Candidato(a)
   HABILITADO(A)… distribuídos da seguinte forma: Critério Étnico…, Escolaridade…, Cursos…,
   Experiência…"). Abaixo vêm as **observações do analista**, com textos prontos que citam o item
   do edital:
   - sem detalhamento (7.5 "b");
   - sem data de término ou declaração (7.5 "a"/"b");
   - sem vínculo com o SUS (7.2.1);
   - cargo diverso (7.2.1);
   - diploma sem frente ou verso (3.1.1);
   - nota de cursos diminuída;
   - nota de experiência diminuída;
   - CTPS sem identificação (7.5 "a");
   - aldeia fora do DSEI (7.2.2);
   - falta de assinaturas da liderança (7.3 "a").
9. **Grava na planilha**: nota final e somatório, escolaridade, cursos, experiência, étnico, tempo de
   saúde indígena e de atenção básica (anos, meses, dias), etapa, parecer, data e responsável.

Fragilidades que a ficha resolve:

- regra **fixa no código**, para um DSEI e um edital: outro edital exige outra cópia do arquivo;
- o nível da vaga volta para "superior" a cada candidato, e o analista tem de lembrar de trocar;
- responsável e data são digitados (dá erro de digitação e "data no futuro");
- a gravação usa `fetch` em modo `no-cors`, então a página **sempre** diz "Análise salva com
  sucesso", mesmo quando o web app falhou;
- não há histórico (gravar de novo sobrescreve a linha) nem conferência de que o candidato é da vaga
  certa;
- há um risco de exposição de dados no fluxo atual, descrito fora do repositório (R1 na seção 16).

### 2.4 Regras que hoje estão espalhadas

- **Situação** (`derivarStatusConsolidado_`): sem ETAPA, fica **Pendente**; se já há parecer, vira
  **Revisar**. ETAPA com "reprovado/inabilitado/eliminado/indeferido/não habilitado" vira
  **Reprovado**. ETAPA com "triado/aprovado/habilitado/classificado/deferido/apto" vira **Aprovado**.
  Nos dois casos, só quando o parecer é "suficiente" (não vale "ok", "sim", "-", "n/a"…); sem isso,
  vira Revisar. No banco hoje (ativos): 3.950 Aprovados (etapa "Triados"), 6.117 Reprovados, 662
  Pendentes e 15 em Revisar.
- **Banco** (`20260928140000_sync_de_analises_por_planilha.sql` e vizinhas): cada planilha tem um
  `CO_PLANILHA`. Há o "porteiro" do grupo, uma fila por planilha e a remoção de ausentes com trava
  de 2%. A `chave_natural` (grupo|unidade|edital|vaga|código|nome) é única; se um lote traz uma chave
  que já pertence a **outra** planilha, o lote inteiro é recusado.
- **Classificação** (`obter_classificacao_do_edital`, migration `20261005130000`): lê de
  `TB_ANALISE_CURRICULAR` (área, `ativo`, número do edital):
  `nota_final_ajustada` → nota documental; `pontuacao_escolaridade/cursos/experiencia/criterio_etnico`
  → parciais; `experiencia_saude_indigena_total` e `experiencia_atencao_basica_total` → desempates;
  `status_consolidado`/`etapa` → apto ou não pela `situacoes_aptas` da regra (em geral "Aprovado" e
  "Triado"). Os ajustes aprovados em recurso entram por cima (`TB_AJUSTE_PONTUACAO_RECURSO`).
- **Regra do edital** (`TH_REGRA_CLASSIFICACAO`): já guarda as parciais da documental, as **notas
  mínimas** (inclusive por nível) e os máximos lidos do PDF. Mas a pontuação de cada critério existe
  só como texto (`importacao.pontuacao.detalhe`). Exemplo do 30/2026: "titulação não cumulativa
  (especialização 10, mestrado 12, doutorado 15); cursos ≥40h 1/2/3 máx 5; experiência 6 meses 1,
  1 ano 3, +3 por ano, máx 30".

### 2.5 O que a Empregare já entrega (sem dado pessoal; levantamento do banco em 05/10/2026)

O robô grava, por candidato e vaga, **todas** as colunas do Excel em
`TB_EMPREGARE_CANDIDATO."DS_COLUNA_ORIGINAL"`. Na vaga carregada até agora (DSEI Manaus, nível
fundamental, 272 candidatos), as chaves e o formato são estes:

| Grupo | Colunas | Formato observado |
|---|---|---|
| Cadastro | NOME, CÓDIGO, E-MAIL, CELULAR/TELEFONE, CIDADE, ESTADO, PAÍS, GÊNERO, DATA DE NASCIMENTO, PCD (SIM/NÃO), DATA DE CANDIDATURA | texto |
| Processo | ETAPA ("Interessados" 240, "Triados" 32), SITUAÇÃO ("INSCRITO" 243, "CANCELADO" 29), MOTIVO/JUSTIFICATIVA DE CANCELAMENTO, MARCADORES, REPROVADO, MATCH, MATCH - PORCENTAGEM, NOTA FIT COMPORTAMENTAL, PRETENSÃO SALARIAL | texto |
| Questionário | "SITUAÇÃO - <questionário>" (FINALIZADO 159, EM ANDAMENTO 91, PENDENTE 22), "NOTA - <questionário>" (ex.: "6,0/30,0"), "DATA DE RESPOSTA - <questionário>" | texto |
| Última formação | NÍVEL, CURSO e INSTITUIÇÃO DA ÚLTIMA FORMAÇÃO, ÚLTIMA EXPERIÊNCIA | texto livre |
| Perguntas | "Pergunta N - <enunciado>" | múltipla escolha entre aspas (`"Sim"`, `"Sou indígena", "Moro em aldeia"`) ou `--` quando não respondida |

Perguntas do questionário dessa vaga (enunciado resumido):

| Nº | Pergunta | Respostas (contagem) | Uso na ficha |
|---|---|---|---|
| 1–3 | Nome completo, CPF, data de nascimento | texto (dado pessoal) | identificação (CPF mascarado) |
| 4 | Documento de identificação com foto | "Anexo" | checklist "ID/CPF" |
| 5 | Sistema de concorrência | Ampla 135, Indígenas 51, Pretos e pardos 48, PcD 5, sem resposta 33 | modalidade; "Indígenas" marca indígena |
| 6 | É indígena e mora em aldeia? (nessa vaga: indígena 8 pontos, aldeia 6, máx. 14) | Não se aplica 172, Sou indígena 34, Sou indígena + Moro em aldeia 26 | **critério étnico** (declarado) |
| 7 | Declaração de pertencimento étnico / moradia em aldeia | "Anexo" | checklist "declaração étnica" |
| 8–11 | Autodeclaração e foto/vídeo (pretos e pardos), autodeclaração (quilombolas) | "Anexo" | cotas (heteroidentificação) |
| 12 | Laudo médico (PcD) | "Anexo" | cota PcD |
| 13 / 14 | Fundamental completo? / certificado | Sim 212, Não 6 / "Anexo" | checklist "escolaridade mínima" |
| 15 / 16 | Ensino médio completo? / certificado | Certificado 199, Não possuo 6 / "Anexo" | **escolaridade** declarada (fundamental + médio = +3) |
| 17 | Experiência na área/vaga (0,2 ponto por mês, máx. 10; item 8.15) | Não possuo 113, "4 anos e 2 meses" 18, "3 meses" 10, "6 meses" 8… | **experiência** declarada |
| 18 | Comprovante da experiência | "Anexo" | vínculos |
| 19 / 20 | Parente ou conhecido na AgSUS? / nome | Sim 8, Não 189 | sinal para revisão |
| 21 | Contrato ativo na AgSUS ou desligado há menos de 6 meses? | Sim 14, Não 184 | sinal (pode ser impedimento, conforme o edital) |
| 22 | Interesse em outros DSEI | Sim 157, Não 40 | informativo (Lista de aprovados) |
| 23 / 24 | Termo de responsabilidade / LGPD | concorda 191, **não concorda 3** | eliminatório |

Três achados que mudam o desenho:

1. **Os anexos não vêm no Excel.** Nas perguntas de anexo, a célula diz só "Anexo" (1.633) ou
   "Resposta não informada" (131): não há link nem arquivo. Para ver o comprovante, ou o analista
   abre o candidato na Empregare, ou o robô passa a baixar os anexos (seção 10 e pergunta P2).
2. **A ligação com a análise de hoje já existe.** Os 149 candidatos dessa vaga que já estão em
   `TB_ANALISE_CURRICULAR` casam exatamente por `codigo_vaga` = `CO_VAGA` e `id_origem` =
   `CO_CANDIDATO_EMPREGARE`. A ficha pode nascer da Empregare e "adotar" a linha da planilha, sem
   trocar o `id`.
3. **A faixa de experiência vem em texto** ("4 anos e 2 meses"). Dá para converter em meses
   (50 meses × 0,2 = 10, no teto) e mostrar a pontuação **declarada**. O analista confere com os
   vínculos comprovados.

## 3. Fluxo novo, ponta a ponta

```
1 Empregare ──robô (já existe)──► TB_EMPREGARE_CANDIDATO (todas as colunas)
                                         │
2 Pré-classificação  (ao fim de cada carga, só nos editais "no MONITORA" ou em comparação)
   elimina sem ficha quem cancelou ou não finalizou o questionário (com motivo) e ranqueia os
   demais pela NOTA DECLARADA, calculada pela regra do edital a partir das respostas
                                         │
3 Linha de corte ─► abre fichas só para quem está até a linha (por vaga, e por modalidade se a
   regra pedir); "a linha anda": quando alguém da fila sai, o próximo da pré-classificação entra
                                         │
  Fila de análise ─► distribuição escolhida por edital ("Pegar próximo" ou distribuição inicial)
                                         │
4 Ficha ─► checklist, étnico, escolaridade, cursos, vínculos, nota, situação e parecer automático
           (rascunho salvo sozinho) ─► Concluir: Habilitado, Não habilitado ou Inabilitado
                                         │
5 Revisão/validação (configurada por edital) ─► Validada ou Devolvida
                                         │ (cada mudança de situação grava em TB_ANALISE_CURRICULAR)
6 Classificação (sem mudança: lê TB_ANALISE_CURRICULAR, inclusive os desempates) ─► preliminar
                                         │
7 Recurso ─► parecer ─► ajuste de pontuação (já existe; por cima da nota da ficha)
                                         │
8 Classificação final ─► "Publicar como lista de aprovados" (já existe)
```

Detalhes de cada etapa:

1. **Robô da Empregare** (já existe, `docs/robo-empregare.md`). Nada muda, exceto, numa fase
   posterior, baixar os anexos (P2).
2. **Pré-classificação** (substitui as abas IMPORTACAO EMPREGARE, TOTAL DE CANDIDATOS e
   ELIMINADOS). No fim de cada carga, uma função do banco recalcula a pré-classificação dos editais
   "MONITORA" ou "Comparação":
   - **eliminados automáticos**, sem ficha: situação CANCELADO, questionário não FINALIZADO,
     REPROVADO na Empregare ou termo recusado. Ficam registrados com o motivo
     (`TB_PRE_CLASSIFICACAO`) e aparecem na aba "Eliminados", como na planilha;
   - os demais são **ranqueados pela nota declarada**, calculada pela regra do edital (seção 5.1,
     "Nota declarada"). Desempate do ranking: o da regra de classificação (60 anos ou mais, por
     exemplo), e depois a data de candidatura;
   - quem saiu da Empregare (`ST_REGISTRO_ATIVO = N`) não some: fica "Fora da fila", com o motivo.
3. **Linha de corte e "a linha anda"** (substitui a aba APTOS PARA ANÁLISE). A regra do edital diz
   até onde vai a análise em cada vaga:
   - um **múltiplo das vagas** (vagas imediatas × N + cadastro reserva) ou um **número fixo**;
   - **por modalidade**, se a regra pedir (ex.: os N primeiros da ampla e os N de cada cota);
   - com os **empatados na linha** incluídos, se a regra mandar.

   Só quem está até a linha ganha **ficha** e entra na fila. Quando um candidato da fila é
   **inabilitado**, ou não habilitado, ou a nota apurada fica abaixo da nota declarada de quem
   está logo fora, a pré-classificação é recalculada e **o próximo entra na fila sozinho**. A troca
   fica registrada ("entrou porque 7000654 foi inabilitado"), e o painel da fila mostra os
   contadores do cabeçalho da planilha: **Inscritos**, **Cancelados/Reprovados**, **Ranqueados** e
   **Aptos para análise (linha de corte)**.

   As fichas já iniciadas não mudam quando a Empregare muda. Elas mostram o aviso "a inscrição mudou
   na Empregare desde que você abriu", com o que mudou.
   - **Fila e distribuição**: seção 8.
4. **Ficha** (seção 7).
5. **Revisão** (seção 8.3).
6. **Classificação.** Continua lendo `TB_ANALISE_CURRICULAR`. A ficha grava lá a cada mudança de
   situação (seção 11), inclusive os tempos de saúde indígena e atenção básica que a Classificação
   usa no desempate. Por isso, a Classificação não precisa mudar uma linha.
7. **Recurso.** Continua igual, mas a gaveta do recurso ganha "Ver ficha da análise" (só leitura),
   com o checklist, cada critério, os vínculos, o parecer e o histórico. O ajuste de pontuação
   continua sendo o mecanismo de mudar a nota depois da publicação (seção 12).
8. **Lista de aprovados.** Sem mudança.

## 4. Papéis e permissões

Hoje existe o recurso de permissão **"Análises curriculares"** (`analises`), com os níveis Leitor,
Editor e Administrador, valendo por **área** e pelo **recorte da coordenação** do edital (como em
Recursos e Classificação). A proposta usa o mesmo recurso e acrescenta o papel **por edital**:

| Papel | Nível em "Análises curriculares" | Papel no edital (`RL_ANALISTA_EDITAL`) | Pode |
|---|---|---|---|
| **Leitor** | Leitor | — | o painel de Análises (como hoje) e a ficha concluída **sem** CPF e sem anexos |
| **Analista** | Editor | ANALISTA no edital (ou em vagas do edital) | ver a fila do edital, pegar e analisar fichas; editar só as **atribuídas a ele** e ainda não concluídas; ver o CPF mascarado e revelar com registro |
| **Revisor / validador** | Editor | REVISOR no edital | tudo do analista, mais validar ou devolver fichas **de outras pessoas** (nunca as próprias) |
| **Coordenação da análise**: o **gestor do edital ou o coordenador** (qualquer um dos dois; decidido em 05/10/2026) | Administrador | COORDENADOR no edital (o gestor do edital já entra com esse papel) | escolher o modo de distribuição e distribuir ou redistribuir, configurar a revisão, definir a linha de corte, reabrir ficha concluída (com motivo), cadastrar a regra da análise, ver produtividade e a comparação planilha × MONITORA |
| **Administrador global** | — | — | tudo, em todas as áreas, e a **virada** de um edital (planilha → MONITORA) |

Regras:

- O gestor do edital (o responsável cadastrado no edital) tem o papel COORDENADOR automaticamente; o coordenador da área recebe pelo grupo de acesso. Qualquer um dos dois cadastra a regra, distribui e configura a revisão.
- O papel de analista e o de revisor são dados pela coordenação, em "Análises › Equipe do edital". Isso substitui a aba
  `DIM_RESPONSAVEIS`. O analista pode ter o papel no edital inteiro ou só em vagas do edital.
- **Responsável e data vêm do login e do relógio do banco**, nunca digitados: o responsável é quem
  concluiu; a data, a da conclusão (fuso de Brasília).
- O banco confere **tudo** nas RPCs (`SECURITY DEFINER`): área, recorte da coordenação, nível e papel
  no edital. A tela só esconde o que a pessoa não pode usar, sem selo de "somente consulta" (regra
  do MONITORA).
- Quem analisou uma ficha não a valida: o banco recusa.
- Os grupos de acesso padrão (Configurações › Acessos) ficam assim: Gestor, Administrador em
  Análises; Coordenador, Administrador; quem trabalha na análise, Editor; Usuário, Contratador e
  Jurídico, Leitor.

## 5. Regra da análise (por edital, cadastrada e versionada)

O simulador traz a regra **escrita no código**, para um DSEI e um edital. No MONITORA, ela vira a
**regra da análise** de cada edital (`TB_REGRA_ANALISE` / `TH_REGRA_ANALISE`), versionada como a
regra de classificação:

- cada salvamento cria uma versão, com motivo a partir da segunda;
- cada ficha guarda a versão com que foi pontuada;
- se a regra mudar com fichas já concluídas, a tela lista as afetadas e a coordenação decide se
  reabre (nada é recalculado escondido).

A regra da análise e a regra de classificação ficam lado a lado, na mesma aba do edital, porque
tratam de coisas diferentes:

- a **regra da análise** diz como cada candidato é pontuado e quando é eliminado;
- a **regra de classificação** diz quem passa e em que ordem.

A **nota de corte** é uma só. Ela já existe na regra de classificação (`documental.nota_minima` e
`nota_minima_por_nivel`), e a análise lê de lá, para não haver dois números.

### 5.1 O que a regra da análise guarda

| Bloco | Conteúdo | No simulador do 28/2026 |
|---|---|---|
| **Nota declarada** (pré-classificação) | para cada pergunta do questionário que pontua, o mapeamento **resposta declarada → pontos** (ex.: pergunta 15 "Especialização na área à qual concorre" = 1, "Não possuo" = 0; pergunta 17: faixa em meses × 0,2, teto 10; pergunta 6: "Sou indígena" +8, "Moro em aldeia" +6, máx. 14 no 100/2026) e em que parcial cada um soma. O texto exato das respostas muda de questionário para questionário, por isso a regra guarda as respostas como vieram, e a tela da regra lista as respostas encontradas na carga para mapear. | não tinha (era a aba IMPORTACAO EMPREGARE da planilha) |
| **Linha de corte e eliminação automática** | quem é eliminado sem ficha (cancelado, questionário não finalizado, reprovado na Empregare, termo recusado), o tamanho da linha (múltiplo das vagas imediatas + CR, ou número fixo; geral ou por modalidade; com ou sem os empatados na linha) e se "a linha anda" sozinha | não tinha (era a aba APTOS PARA ANÁLISE) |
| **Distribuição e revisão** | o modo de distribuição do edital ("Pegar próximo" ou distribuição inicial) e a revisão (amostra com %, todas, só as inabilitações, combinações; duplo-cego opcional) | não tinha |
| **Níveis da vaga** | como saber o nível de cada vaga (pelo cargo, com termos como "Técnico", ou um padrão), para a ficha **já abrir no nível certo** | o analista escolhia o nível a cada candidato |
| **Checklist de admissibilidade** | lista de itens eliminatórios: rótulo, item do edital, o texto do motivo no parecer, "só se indígena" (ou outra condição), a pergunta da Empregare que serve de comprovante e o sinal automático (ex.: "Não possuo" na escolaridade marca o item como não cumprido, para o analista confirmar) | 6 itens fixos (3.4.1, 3.1.1, 3.1.1 "c", 7.5, 7.7, 7.3) |
| **Critério étnico** | pontos de "indígena" e de "aldeia", teto, a **lista de aldeias válidas** (a do DSEI do edital) e a pergunta da Empregare do declarado | +7 / +5 = 12, lista de 238 aldeias do Interior Sul (no 100/2026: +8 / +6 = 14) |
| **Escolaridade por nível** | para cada nível, as titulações e os pontos; cumulativa ou "vale a maior" | superior 0/+1/+2/+3; técnico/médio 0/+3; fundamental 0/+3 |
| **Cursos** | faixas de carga horária com os pontos de cada certificado, teto e máximo de certificados | ≥81 h 0,5; 41–80 h 0,3; ≤40 h 0,2; teto 5 |
| **Experiência** | categorias de vínculo (quais pontuam, qual é o desempate 1 e o 2), pontos por mês **ou** faixas ("6 meses 1, +3 por ano"), teto, como contar o mês (dias ÷ 30 inteiros), unir sobreposições, data limite (data de corte ou fim das inscrições), máximo de vínculos e a **regra do estágio** (horas ÷ 8 ÷ 22, só para indígena sem experiência) | 0,2 por mês, teto 10, 10 vínculos, estágio 7.5.7.2 |
| **Situações** | rótulos e etapa de cada resultado: habilitado ("Triados"), não habilitado pela nota de corte ("Reprovado") e inabilitado pela admissibilidade ("Reprovado", nota 0) | igual |
| **Modelos do parecer** | um texto por situação, com campos que a ficha preenche: `{edital}`, `{nota}`, `{corte}`, `{item_corte}`, `{distribuicao}`, `{motivos}` e `{observacoes}` | três textos fixos com "Edital 28/2026" |
| **Observações prontas** | botões de texto pronto com o item do edital; cada um pode marcar a "nota diminuída" de um critério | 10 textos fixos |
| **Sinais** | perguntas que só alertam: parentesco, vínculo ativo, termo recusado | — |

Cada critério diz em que **parcial** soma (`FORMACAO`, `CURSOS`, `EXPERIENCIA` e `ETNICO`: as mesmas
da Classificação e do ajuste do recurso) e qual **pergunta** da Empregare traz o declarado. A
ligação é pelo começo do enunciado ("Pergunta 17 - Selecione sua Experiência") e é conferida a cada
carga: se a Empregare mudar o enunciado, a coordenação é avisada.

A **nota** é a soma das parciais, com as casas e o arredondamento da regra de classificação. Quem
calcula e grava é o banco; a tela mostra a mesma conta (mesma lógica pura em `src/lib/` e no banco).

### 5.2 Como cadastrar sem sofrer

- **Modelos de regra**: a regra do 28/2026, tirada do simulador, vira o primeiro modelo ("SI26 —
  Interior Sul"). Os modelos já lidos dos PDFs (SI26-83, SI26-100, PROJ26-CURRICULAR…) viram os
  outros. Edital novo começa copiando um modelo e fica "conferir" até a coordenação confirmar.
- **Lista de aldeias por DSEI**: vira um catálogo (`TD_ALDEIA_DSEI`), cadastrado uma vez por DSEI e
  usado por todos os editais daquele DSEI. A lista do Interior Sul já existe no simulador. As outras
  vêm das listas oficiais de cada DSEI (P13).
- **Prévia**: na tela da regra, "Testar com um candidato fictício" mostra a nota e o parecer que a
  regra daria.

## 6. O que vem pré-preenchido da Empregare

| Na ficha | De onde | O analista |
|---|---|---|
| Nome, código, vaga, modalidade, PcD, nascimento (idade na data de corte e o selo **60 anos ou mais**) | colunas do cadastro e pergunta 5 | só confere |
| **Nota da Empregare** ("x/30") e a **nota declarada** com a posição na pré-classificação | questionário e a regra do edital | só referência; não vira nota |
| **Origem da convocação** | a pré-classificação (ex.: "Ampla", "Cota", "Entrou pela linha que anda") | só confere (P15) |
| "Autodeclarado indígena" e "mora em aldeia" | pergunta 6 (e modalidade "Indígenas") | confirma com a declaração do Anexo; escolhe a aldeia na lista |
| Escolaridade declarada | perguntas de escolaridade (13/15) e "NÍVEL ÚLTIMA FORMAÇÃO" | escolhe a titulação comprovada |
| Experiência declarada | pergunta 17 ("4 anos e 2 meses" = 50 meses = 10 pontos declarados) | lança os vínculos comprovados; a ficha compara com o declarado |
| Checklist | sinais: "Não"/"Não possuo" na escolaridade mínima, anexo "Resposta não informada", termo recusado | confirma ou desmarca |
| Anexos | hoje só "Anexo" (sem link): botão "Abrir na Empregare"; na fase B, os arquivos ao lado | abre e confere |

O declarado **nunca** vira nota sozinho: é referência. A nota é a do que foi comprovado.

## 7. A ficha

A ficha é uma página inteira, que se abre a partir da fila. São duas colunas no computador e uma
no celular:

- **à esquerda**, a análise;
- **à direita**, o resumo fixo (nota, parciais, situação e parecer) e os comprovantes.

Veja o [protótipo](prototipo-da-ficha.html).

### 7.1 Seções (na ordem do trabalho do analista)

1. **Cabeçalho fixo**: nome, código Empregare, vaga (código, cargo, unidade, **nível**), edital,
   modalidade, situação da ficha, versão da regra, a **nota total** e as parciais (Étnico,
   Escolaridade, Cursos, Experiência), sempre visíveis, como no topo do simulador. Botões
   "Anterior" e "Próxima" da fila.
2. **Sinais** (só quando há): termo recusado, escolaridade mínima "Não possuo", anexo não informado,
   parentesco, vínculo ativo, inscrição mudou na Empregare.
3. **Identificação**: CPF **mascarado** (`***.456.789-**`, "Mostrar" fica registrado), idade na data
   de corte, cidade/UF, PcD. E-mail e telefone ficam fora da ficha.
4. **Checklist de admissibilidade**: os itens da regra, todos marcados de início (como no
   simulador), cada um com o item do edital e o botão do comprovante. Desmarcar um item marca o
   cartão em vermelho, zera a nota e muda a situação para **Inabilitado**, com o motivo no parecer.
   Itens condicionais (declaração étnica) só se ativam quando a condição vale.
5. **Critério étnico**: "Autodeclarado indígena" (+pontos) e "Mora em aldeia" (+pontos). Ao marcar
   aldeia, aparece a **busca na lista do DSEI**, com autocompletar. Aldeia da lista: "✓ Aldeia
   confirmada na lista do DSEI". Fora da lista: os pontos da aldeia são negados, com aviso e
   sugestão da observação pronta "Aldeia fora do DSEI".
6. **Escolaridade**: as titulações **do nível da vaga**, com os pontos; o declarado ao lado.
7. **Cursos de aperfeiçoamento**: um contador (– / +) por faixa de carga horária, com os pontos de
   cada um, o subtotal e o teto ("4,3 de 5,0").
8. **Experiência profissional**: a tabela de vínculos (categoria, início, fim, local opcional e
   "aceito?"), com até o máximo da regra. Abaixo, a **análise cronológica**:
   - Saúde Indígena (desempate 1), em anos, meses e dias;
   - Atenção Básica (desempate 2);
   - Saúde Geral;
   - **tempo único validado** (sobreposições unidas), em meses inteiros e pontos.

   Para candidato indígena sem experiência, aparece o campo do **estágio** (horas), com a conta
   "800 h ÷ 8 = 100 dias ÷ 22 = 4,54 → 4 meses". O declarado (faixa da Empregare) fica ao lado, e
   uma diferença grande vira sinal para a revisão.
9. **Observações do analista**: o texto livre e o menu **"Textos prontos"**, com as observações da
   regra (cada uma com o item do edital). As observações entram no parecer.
10. **Resultado** (coluna da direita, fixa): a nota, o selo da situação (**Habilitado** /
    **Não habilitado (nota de corte)** / **Inabilitado (admissibilidade)**), a nota de corte e o
    item do edital, e o **parecer automático**, montado pelo modelo da regra com a distribuição dos
    pontos e as observações. O parecer é gerado de novo a cada mudança. Tem "Copiar parecer".
11. **Histórico** (recolhido): cada versão salva, quem, quando e o que mudou (seção 9).

### 7.2 Regras da ficha

- **Inabilitado** quando qualquer item do checklist está desmarcado: nota 0 (as parciais ficam
  guardadas para consulta, mas a nota publicada é 0) e etapa "Reprovado".
- **Não habilitado** quando a nota é menor que a nota de corte do nível da vaga: etapa "Reprovado".
- **Habilitado** quando a nota é igual ou maior que o corte: etapa "Triados".
- O analista **não escolhe** a situação: ela sai das regras. Ele só pode marcar "Revisar" para pedir
  uma segunda opinião antes de concluir.
- Toda pontuação apurada **abaixo do declarado** pede uma observação (pronta ou livre), como as
  "Nota de cursos diminuída" e "Nota de experiência diminuída" do simulador.
- A experiência conta até a data limite da regra; vínculo em aberto sem data de fim só vale até
  essa data se houver a declaração (a observação "Sem data de término/declaração" está à mão).

### 7.3 Rascunho, salvar e concorrência

- A ficha salva sozinha (rascunho), alguns segundos depois de cada mudança, e também com Ctrl+S.
  O rascunho não muda a situação nem a nota em `TB_ANALISE_CURRICULAR`.
- Cada salvamento leva o **número da versão** que a tela abriu. Se outra pessoa salvou antes, o
  banco recusa e a tela mostra "Esta ficha mudou desde que você abriu", com o botão "Recarregar".
- A tela só diz "salvo" quando o banco confirma (nada de "sucesso" sem resposta, como no `no-cors`
  do simulador).
- **Concluir** confere: o checklist decidido, todos os critérios preenchidos, as observações onde a
  nota ficou abaixo do declarado e o parecer gerado. O que falta aparece no próprio campo. Depois,
  "Concluir e próxima" abre a ficha seguinte da fila, como o simulador fazia ao limpar o código.

## 8. Fila, distribuição e revisão

### 8.1 A fila

É uma tela por área, com o seletor de edital. Logo abaixo do título fica uma **faixa com os
contadores da pré-classificação**, os mesmos do cabeçalho da planilha:

- **Inscritos**;
- **Cancelados/Reprovados**;
- **Ranqueados**;
- **Aptos para análise (linha de corte)**, com "N de M".

Depois vêm os indicadores em card compacto: Na fila, Em análise, Para revisar, Habilitados, Não
habilitados/Inabilitados e Fora da fila. Os filtros são vaga, situação, responsável, modalidade,
sinais e "só as minhas".

A tabela segue a **ordem da pré-classificação** e mostra posição, código, nome, vaga, modalidade,
nota declarada, sinais, situação, responsável e tempo parado. Uma linha tracejada marca a **linha
de corte**. Os primeiros de fora aparecem abaixo dela, esmaecidos, com "Entra se alguém sair".
Quando a linha anda, o candidato que entrou ganha o selo "Entrou na fila", com o motivo. As abas
**Eliminados** (automáticos, com motivo) e **Desclassificados** (inabilitados e não habilitados,
com o parecer) substituem as abas da planilha. A busca pelo **código** abre a ficha direto (o
atalho que o simulador tinha).

### 8.2 Distribuição (personalizável por edital — decidido em 05/10/2026)

O **gestor do edital ou o coordenador** escolhe o modo na regra da análise e pode trocar quando
quiser:

- **Pegar próximo**: o analista clica e o banco entrega a próxima ficha livre das vagas em que ele
  atua, na ordem da pré-classificação. A reserva é **atômica** (`for update skip locked`), então
  duas pessoas nunca pegam a mesma ficha.
- **Distribuição inicial**: assim que as fichas abrem, o banco reparte as da linha de corte entre
  os analistas da equipe, em partes iguais ou até um limite por analista, sempre com prévia antes
  de gravar. Quem entra depois, pela linha que anda, vai para o analista com menos fichas
  pendentes, ou fica livre, conforme a regra.

Nos dois modos, a coordenação pode **atribuir e redistribuir** (a ficha e a pessoa, com motivo; a
troca entra no histórico), e a redistribuição nunca mexe em ficha concluída. Ficha "Em análise"
parada há mais de N dias úteis (padrão 3) aparece como pendência na fila e no painel, e a
coordenação pode **devolver à fila**.

### 8.3 Revisão e validação (personalizável por edital — decidido em 05/10/2026)

O **gestor do edital ou o coordenador** configura a revisão na regra da análise, combinando estas
opções:

- **Amostra**: X% das fichas concluídas de cada analista (o percentual é configurável; mínimo de N
  por analista). O sorteio é reprodutível (semente gravada, como no sorteio da Classificação).
- **Todas as fichas**.
- **Só as inabilitações** (e/ou as não habilitadas).
- **Regras extras**, que se somam à escolha acima:
  - as fichas em que o apurado ficou mais de Y pontos abaixo do declarado;
  - as fichas com sinal de parentesco ou vínculo;
  - as fichas que entraram pela linha que anda.
- **Duplo-cego** (opcional): duas análises independentes da mesma ficha. O revisor só vê as duas
  depois que ambas concluem e, havendo divergência acima do limite, decide qual vale (ou devolve).
- **Sem revisão**, se o edital não pedir.

O revisor **valida** (a ficha fica Concluída) ou **devolve** com motivo (a ficha volta ao analista
como "Revisar"). A configuração é versionada com a regra; mudar o percentual no meio do edital vale
só para as fichas concluídas dali em diante.

### 8.4 Situações e transições

| Situação da ficha | Quando | Grava em `TB_ANALISE_CURRICULAR` (`status_consolidado` / `etapa`) |
|---|---|---|
| *Ranqueado fora da linha* | está na pré-classificação, abaixo da linha de corte (sem ficha) | não grava (como hoje: só a aba APTOS PARA ANÁLISE ia para o banco) |
| *Eliminado automático* | cancelou, questionário não finalizado, reprovado na Empregare, termo recusado (sem ficha) | não grava; fica em `TB_PRE_CLASSIFICACAO` com o motivo |
| **Pendente** | entrou na linha de corte: ficha aberta, sem responsável ou ainda não iniciada | Pendente / nula |
| **Em análise** | o analista pegou ou recebeu e começou | Pendente / nula (o painel mostra "Em análise" pelo campo novo, ver 13) |
| **Revisar** | sorteada para revisão, devolvida pelo revisor ou marcada pelo analista | Revisar / nula |
| **Concluída: Habilitado** | nota ≥ corte, checklist completo, validada (ou não sorteada) | Aprovado / "Triados" |
| **Concluída: Não habilitado** | nota < corte | Reprovado / "Reprovado" |
| **Concluída: Inabilitado** | item do checklist não cumprido (nota 0) | Reprovado / "Reprovado" — e **a linha anda**: o próximo da pré-classificação ganha ficha |
| *Fora da fila* | inscrição cancelada ou questionário incompleto | não grava (ou desativa a linha, se existir) |

```
Pendente ──pegar/atribuir──► Em análise ──concluir──┬─(sorteada)──► Revisar ──validar──► Concluída
    ▲                            │  ▲                 │                │
    └──devolver à fila (coord.)──┘  └──devolver (revisor, com motivo)──┘
                                                      └─(não sorteada)──► Concluída
Concluída ──reabrir (coordenação, motivo; só antes da publicação da preliminar)──► Em análise
```

Depois que a lista **preliminar** da Classificação é publicada, a ficha não reabre: a mudança é por
**recurso** (ajuste de pontuação). Antes da publicação, a coordenação pode reabrir com motivo.

## 9. Auditoria e histórico

- `TH_FICHA_ANALISE` recebe uma linha **imutável** a cada salvamento que muda algo e a cada
  transição. Cada linha guarda quem, quando, a ação (salvar rascunho, concluir, validar, devolver,
  reabrir, atribuir…), o motivo e o **retrato completo** da ficha naquele momento (checklist,
  critérios, vínculos, nota, parecer, situação), em JSON, além do SHA-256 do retrato.
- Um gatilho recusa `update` e `delete` no histórico (como já é feito nos ajustes do recurso). A
  ficha em si nunca é apagada: candidato que saiu fica "Fora da fila".
- A tela mostra o histórico como linha do tempo e permite comparar duas versões, com os campos
  alterados em destaque.

## 10. LGPD

| Dado | Quem vê | Como |
|---|---|---|
| Nome, vaga, modalidade, nota, parecer | quem tem Leitor em Análises (área e recorte) | como hoje no painel |
| CPF | analista, revisor e coordenação do edital | **mascarado** por padrão; "Mostrar" revela por 60 s e registra em `TL_ACESSO_FICHA_ANALISE` |
| Data de nascimento | os mesmos | a idade aparece sempre; a data, só na ficha |
| E-mail e telefone | ninguém na ficha | continuam só onde já estão (Lista de aprovados, convocação) |
| Anexos (documentos, laudo, foto/vídeo da cota) | analista e revisor **da ficha**, e a coordenação | cada abertura registrada em `TL_ACESSO_FICHA_ANALISE`; laudo de PcD e foto/vídeo só para quem tem o papel na ficha |
| Respostas sobre parentesco | analista, revisor e coordenação | só o "Sim/Não"; o nome do parente (pergunta 20) fica mascarado como o CPF |

Anexos: hoje não estão no banco (seção 2.5). Há dois caminhos (P2):

- **A (MVP):** o botão "Abrir na Empregare" leva ao candidato no portal, e o analista usa o próprio
  login da Empregare. Nada de documento novo guardado no MONITORA. A abertura também é registrada.
- **B (depois):** o robô baixa os anexos para um bucket **privado** do Supabase Storage (por vaga e
  candidato, com hash) e a ficha os abre ao lado, por **URL assinada de curta duração** gerada pela
  RPC, que registra o acesso. Exige definir retenção (ex.: até 5 anos depois do fim do edital,
  conforme a política da AgSUS) e o volume de armazenamento.

Os registros de acesso ficam **só para a coordenação e o administrador global**, e o robô continua
sem imprimir dado pessoal no log público do Actions.

**O que melhora em relação a hoje:** há um risco de exposição no fluxo atual, descrito fora do
repositório (R1). Com a análise no MONITORA, todo acesso passa pelo login, pelo papel no edital e
pelo registro, e o simulador e o web app podem ser **desativados** (seção 15).

## 11. Como a nota entra na Classificação

**Proposta: gravar na mesma `TB_ANALISE_CURRICULAR`, como uma "planilha" a mais.**

- Novas linhas em `TB_PLANILHA_ANALISE`: `monitora-saude-indigena`, `monitora-sede` e
  `monitora-projetos`, uma por área. `CO_PLANILHA` já faz o papel de "origem" (o que o pedido chamou
  de `TP_ORIGEM 'MONITORA'`). As cargas das planilhas só desativam e recusam linhas da **própria**
  planilha (`CO_PLANILHA`), então as linhas do MONITORA ficam protegidas.
- A ficha tem as suas tabelas (`TB_FICHA_ANALISE`, itens, checklist e vínculos), e uma função
  privada **publica** o resultado em `TB_ANALISE_CURRICULAR` a cada transição. Vão para lá:
  - situação e etapa;
  - responsável (do login) e data da análise (da conclusão);
  - as parciais e a nota documental (0 se inabilitado);
  - `experiencia_saude_indigena_total` e `experiencia_atencao_basica_total` (desempates 1 e 2) e
    `experiencia_profissional_total`, em **dias** já unidos, a mesma unidade da planilha
    (anos × 365 + meses × 30 + dias);
  - o parecer, a modalidade, o **PcD** e a **data de nascimento** (a Classificação calcula o "60 anos
    ou mais" na data de corte do edital, como já faz hoje; a ficha só mostra o selo).

  A **origem da convocação** e a **nota da Empregare** ficam na ficha (a nota da Empregare vai em `nota_empregare`,
  como a planilha já faz; atenção: a Classificação lê essa coluna como a nota da autodeclaração,
  o componente `ART`, só nos editais cuja regra usa ART — conferir na migration se é isso mesmo que
  se quer). A Classificação **já recebe tudo o que usa**: parciais, nota documental,
  situação/etapa, os desempates de saúde indígena e atenção básica, a experiência total, o PcD e o
  nascimento.

  O `id_origem` recebe o código Empregare, o que deixa a `chave_natural` igual à que a planilha
  geraria.
- **Classificação, painel, Entrevistas, Recursos e Aprovados não mudam**: leem as mesmas colunas e a
  mesma chave (`id`).

Por que não uma tabela nova com uma view unificada: todas as RPCs e os vínculos (entrevista, recurso,
ajuste, aprovado) apontam para `TB_ANALISE_CURRICULAR.id`. Uma view obrigaria a trocar dezenas de
funções e chaves estrangeiras, e haveria dois `id` para o mesmo candidato na transição. Gravar na
mesma tabela mantém um só `id`.

**Regra de ouro da transição:** um edital tem **um dono** por vez. O dono fica em
`TB_ORIGEM_ANALISE_EDITAL`:

- `PLANILHA`: como hoje;
- `COMPARACAO`: o MONITORA analisa em paralelo, mas **não publica** em `TB_ANALISE_CURRICULAR`;
- `MONITORA`: o MONITORA é o dono.

Isso é obrigatório, porque a `chave_natural` é única: se a planilha e o MONITORA gravassem o mesmo
candidato, a próxima carga da planilha seria **recusada inteira**, derrubando também os outros
editais daquela planilha.

## 12. Recurso e ajuste

- Nada novo no mecanismo: o recurso continua ligado a `CO_ANALISE_CURRICULAR` e o ajuste aprovado
  (`TB_AJUSTE_PONTUACAO_RECURSO` / `TB_ITEM_AJUSTE_PONTUACAO`) continua valendo **por cima** da nota,
  sem alterar a ficha.
- O que melhora:
  - a gaveta do recurso mostra a ficha (checklist, critério por critério, vínculos, observações e
    histórico), e o parecer jurídico deixa de pedir "a planilha do analista";
  - ao propor o ajuste, os valores anteriores vêm da ficha;
  - a ficha mostra o selo "Nota alterada pelo recurso nº X" quando há ajuste aprovado.
- Depois da publicação da preliminar, a ficha fica travada; reabrir só por recurso. Os desempates
  (tempo em saúde indígena e atenção básica) não estão hoje entre os itens do ajuste
  (`CK_ITEMAJUSTEPONT_COITEM`); se o recurso precisar mudá-los, o ajuste ganha esses dois itens
  (P14).

## 13. Indicadores

- O **painel de Análises curriculares continua funcionando** sem mudança, porque lê
  `TB_ANALISE_CURRICULAR`, onde a ficha publica. A janela do edital, a validação de data, as
  pendências, a carga por responsável e a evolução diária seguem iguais. A data da análise passa a
  ser a do sistema (acaba o "Data no futuro" por digitação).
- Duas mudanças pequenas no painel (fase 2):
  - mostrar **"Em análise"** separado de Pendente: a ficha publica o detalhe num campo novo
    (`TP_SITUACAO_FICHA`) ou o painel lê a ficha;
  - o link "Abrir ficha" na gaveta da análise, quando a origem é o MONITORA.
- Novos, na própria tela das fichas (coordenação): produtividade por analista (fichas por dia,
  tempo mediano por ficha), taxa de devolução na revisão, motivos de inabilitação mais comuns,
  divergência declarado × apurado e, no piloto, a **concordância planilha × MONITORA**.
- **Status das atualizações**: a linha das cargas das planilhas some quando o último edital virar.
  A abertura das fichas aparece junto do robô da Empregare.

## 14. Plano de transição

| Fase | O que entra | Saída |
|---|---|---|
| **0. Preparação** | escolher o **edital piloto de Projetos** (decidido em 05/10/2026: o piloto é de Projetos, não o 28/2026); cadastrar a regra da análise dele (o modelo PROJ26-CURRICULAR, lido do PDF, mais o mapeamento resposta → pontos do questionário, a linha de corte, a distribuição e a revisão); montar a equipe. Projetos não usa critério étnico nem lista de aldeias, o que deixa o piloto mais simples; o modelo da Saúde Indígena (simulador do 28/2026) é testado em seguida | regra conferida pelo gestor do edital ou pelo coordenador |
| **1. Piloto em comparação** (`COMPARACAO`) | o edital de Projetos com as vagas carregadas pelo robô da Empregare (rodar o robô com `editais` = o número dele). A planilha da área de Projetos continua oficial, e o MONITORA faz em paralelo a pré-classificação, a linha de corte e as fichas, sem publicar. | relatório **planilha × MONITORA**: nota declarada e linha de corte iguais às da aba APTOS PARA ANÁLISE? Por candidato: situação, parciais e nota iguais? Onde divergir, qual estava certo |
| **1b. Segundo piloto** (Saúde Indígena) | um edital da Saúde Indígena, com critério étnico, lista de aldeias e desempates de saúde indígena e atenção básica (o modelo do simulador) | mesma comparação, incluindo os desempates |
| **2. Virada do piloto** (`MONITORA`) | 1) a coordenação marca o edital "inativo" na `DIM_EDITAIS` da planilha (ou tira a linha); 2) espera a carga seguinte confirmar; 3) o administrador global vira o edital: as linhas da planilha desse edital são **adotadas** (o `CO_PLANILHA` passa para `monitora-<área>`, com o mesmo `id`) e as fichas são pré-preenchidas com o que a planilha tinha, marcadas "importada da planilha" | o edital piloto é 100% MONITORA; entrevistas, recursos e aprovados continuam ligados |
| **3. Editais novos** | todo edital **novo** nasce `MONITORA` (padrão do cadastro), com a regra copiada de um modelo | as planilhas e o simulador param de receber editais |
| **4. Editais em andamento** | edital a edital, quando a coordenação quiser: virada como na fase 2, de preferência entre etapas (nunca no meio de um prazo de recurso) | — |
| **5. Desligamento** | sem edital ativo `PLANILHA`: desativar o web app do simulador, desligar os gatilhos, arquivar as planilhas (somente leitura), retirar as RPCs de carga e o staging do banco, apagar `apps-script/` do repositório e os docs | fim da cadeia |

Editais **encerrados** continuam como histórico com `CO_PLANILHA` da planilha (nada é migrado).

## 15. Quais planilhas, abas e scripts deixam de existir

**Deixam de existir** (edital a edital e, no fim, todos):

| Item | Substituído por |
|---|---|
| **Simulador** (HTML local, uma cópia por DSEI/edital) e o **web app** do Apps Script que ele chama | a ficha + a regra da análise do edital |
| Planilhas de vaga no Drive e as pastas por edital, com as abas: **IMPORTACAO EMPREGARE** (nota declarada por fórmula) | pré-classificação pela regra do edital, a partir de `TB_EMPREGARE_CANDIDATO` |
| … **TOTAL DE CANDIDATOS** | a pré-classificação (ordem pela nota declarada), na fila |
| … **ELIMINADOS** | eliminados automáticos com motivo (`TB_PRE_CLASSIFICACAO`), aba "Eliminados" da fila |
| … **APTOS PARA ANÁLISE** | a linha de corte + as fichas ("a linha anda") |
| … **RANQUEAMENTO** e **DESCLASSIFICADOS** | a Classificação (já existe) e a aba "Desclassificados" da fila, com o parecer |
| … **QUERY** | — |
| Exportar o Excel da Empregare à mão para a planilha de vaga | o robô (já existe) + abertura das fichas |
| `DIM_EDITAIS` (edital, pasta, ativo, janela da análise) | cadastro do edital (Editais) + cronograma + `TB_ORIGEM_ANALISE_EDITAL` |
| `DIM_VAGAS` (vagas lidas do nome dos arquivos) | vagas da Seleção / `TB_EMPREGARE_VAGA` |
| `DIM_RESPONSAVEIS` | `RL_ANALISTA_EDITAL` (equipe do edital) |
| `FATO_ANALISES`, `FATO_ANALISES_STG`, `LOG_CONSOLIDACAO`, `META_PAINEL`, `REL_PRE_VALIDACAO`, `REL_AUDITORIA_FATO`, `CTRL_SYNC_ORIGENS` | a ficha publica direto; o histórico fica em `TH_FICHA_ANALISE` |
| `1-atualizar-base.gs`, `2-sincronizar-com-supabase-full.gs`, `3-analises-incremental.gs` e `4-orquestrador-fato-supabase.gs` (Saúde Indígena, Projetos, SEDE), com gatilhos, chaves `service_role` nas Propriedades do Script e "travas" | nada (não há cópia para sincronizar) |
| Gerador de PDF no Drive (`link_pdf`) | "Imprimir / PDF da ficha", gerado na hora (P7) |
| Painel web de Projetos (Google Sites, Script Projetos 3/4/6/7) | o painel de Análises do MONITORA (já existe) |
| No banco, depois do último edital: `TL_SYNC_ANALISE`, `TM_ANALISE_CURRICULAR` (staging), `TA_ORIGEM_ANALISE`, as RPCs `processar_sync_analises*`, `iniciar/preparar/comparar/verificar/finalizar_sync_analises*` e a linha das análises em Status das atualizações | — |

**Continuam:**

- `TB_ANALISE_CURRICULAR`, `TB_EDITAL_ANALISE` (janela da análise; pode migrar para o cronograma
  depois) e `TB_PLANILHA_ANALISE` (com as novas linhas do MONITORA);
- as planilhas **arquivadas**, só para leitura, enquanto houver recurso ou auditoria de editais que
  começaram nelas;
- a planilha **Auditoria** (fonte das vagas da Seleção) e a "[dash] entrevistados", que não fazem
  parte desta mudança;
- o robô da Empregare (com os anexos numa fase posterior).

## 16. Riscos e perguntas em aberto

### Riscos

| Risco | Mitigação |
|---|---|
| **R1.** Há um risco de exposição no fluxo atual, descrito fora do repositório | a análise no MONITORA exige login, papel no edital e registro de acesso; o simulador e o web app são desativados na fase 5 |
| R2. Anexos fora do MONITORA: o analista depende do login da Empregare | MVP com "Abrir na Empregare"; fase B baixa os anexos para um bucket privado (P2) |
| R3. A Empregare muda os enunciados ou a ordem das perguntas e a regra perde a ligação | ligação pelo começo do enunciado, conferida a cada carga, com aviso à coordenação; a ficha mostra "pergunta não encontrada" em vez de pré-preencher errado |
| R4. Planilha e MONITORA gravando o mesmo edital (recusa da carga inteira da planilha) | dono único por edital (`TB_ORIGEM_ANALISE_EDITAL`) e uma virada com passos na ordem (seção 14) |
| R5. Regra da análise mal cadastrada: a nota errada vai direto para a Classificação | começa de um modelo e fica "conferir"; prévia com candidato fictício; piloto em comparação com o simulador; o banco recalcula; mudança de regra lista as fichas afetadas |
| R6. Diferença de conta entre o simulador e o MONITORA (mês = dias ÷ 30, união de períodos com o dia seguinte, ano = 365 dias no desempate) | a lógica do simulador vira teste automatizado (os mesmos casos dão a mesma nota) antes do piloto |
| R7. Volume: milhares de fichas por edital e muita gente salvando ao mesmo tempo | rascunho com debounce, versão otimista, índices por edital/situação/responsável e fila paginada no banco |
| R8. Resistência à mudança (a equipe está acostumada ao simulador) | a ficha mantém o desenho do simulador (cabeçalho com a nota, checklist, contadores, tabela de vínculos, textos prontos), com busca por código e "Concluir e próxima"; o piloto mede o tempo por ficha |
| R9. LGPD: mais pessoas com acesso a documentos | papel por edital, mascaramento, registro de acesso, URL assinada curta |

### Decididas em 05/10/2026

- **P1. Quem entra na fila** — **decidido em 05/10/2026**, pelo modelo da planilha de vaga:
  eliminação automática (cancelado, questionário não finalizado, reprovado na Empregare) com motivo
  e sem ficha; pré-classificação pela nota declarada; ficha só para quem está até a **linha de
  corte** configurável por edital e vaga; "a linha anda" quando alguém da fila sai (seção 3).
- **P3. Revisão** — **decidido em 05/10/2026**: personalizável por edital (amostra com %
  configurável, todas as fichas, só inabilitações, ou combinação; duplo-cego opcional), seção 8.3.
- **P4. Papéis** — **decidido em 05/10/2026**: o **gestor do edital ou o coordenador** (qualquer um
  dos dois) cadastra a regra da análise e distribui, seção 4.
- **P5. Distribuição** — **decidido em 05/10/2026**: personalizável; o gestor ou o coordenador
  escolhe por edital entre "Pegar próximo" e distribuição inicial, e pode redistribuir, seção 8.2.
- **P6. Edital piloto** — **decidido em 05/10/2026**: um edital de **Projetos** (não o 28/2026),
  seção 14. Falta só dizer qual.

### Ainda em aberto

- **P1b. Linha de corte:** qual é o padrão: múltiplo das vagas imediatas + CR (quantas vezes?) ou um
  número fixo? É por modalidade? Os empatados na linha entram?
- **P2. Anexos:** começar com "Abrir na Empregare" (cada analista com login na Empregare) ou já
  pedir que o robô baixe os anexos para o MONITORA? Quanto tempo guardar?
- **P6b. Qual edital de Projetos** será o piloto?
- **P7. PDF da análise:** o PDF no Drive é usado por alguém (jurídico, SEI)? Basta "Imprimir / PDF
  da ficha" gerado na hora?
- **P8. Experiência:** os vínculos ficam como no simulador (categoria + datas, até 10). Precisa
  também do local/empregador de cada vínculo, para a revisão e o recurso?
- **P9. Cotas:** documentação de cota incompleta faz o candidato seguir na ampla (como diz o edital)
  e a análise não inabilita por isso? A heteroidentificação vai ser registrada no MONITORA depois?
- **P10. Vínculo e parentesco** (perguntas 19–21): são só alerta, ou algum edital elimina quem tem
  contrato ativo?
- **P11. Janela da análise:** bloquear "Concluir" fora do período de análise do edital, ou só avisar
  (como o painel faz hoje)?
- **P12. Situação "Revisar" pelo analista:** o analista pode pedir revisão antes de concluir (dúvida),
  ou só o sorteio e o revisor mandam para Revisar?
- **P13. Listas de aldeias:** quem tem as listas oficiais de aldeias dos outros DSEI (no formato
  "NOME-(polo)" do simulador)? Valem para todos os editais do DSEI?
- **P14. Recurso nos desempates:** o recurso pode mudar o tempo em saúde indígena ou em atenção
  básica? Se sim, o ajuste do recurso ganha esses dois itens.
- **P15. "Origem convocação":** o que essa coluna da planilha de vaga guarda (ampla/cota, rodada da
  convocação, entrada pela linha que anda)? Algum lugar além da ficha precisa dela (Classificação,
  Lista de aprovados)?
- **P16. Nota da Empregare ("x/30"):** a planilha manda essa nota para `nota_empregare`, que a
  Classificação lê como a nota da autodeclaração (ART) nos editais que usam ART. É isso mesmo, ou a
  nota do questionário não deve ir para lá?
