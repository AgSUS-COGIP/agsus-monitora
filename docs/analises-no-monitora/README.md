# Análise curricular dentro do MONITORA — desenho

Situação: **desenho para aprovação** (05/10/2026). Nada aqui está implementado; não há migration nem
código. O usuário aprovou começar o desenho com o pedido "pode começar a desenhar a Análise dentro do
MONITORA". As perguntas que ainda dependem de decisão estão no fim (seção 15).

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
                                   │  o analista pontua e escreve o parecer na planilha
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
respostas do questionário que o robô trouxe da Empregare. Ele pontua cada critério pela regra do
edital, e a nota vai direto para a Classificação. Sem planilha de vaga, sem planilha central e sem
Apps Script.

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
| **Planilha de cada vaga** (uma por vaga, numa pasta do Drive por edital; o link da pasta fica em `DIM_EDITAIS.pasta_origem_link`) | Aba **APTOS PARA ANÁLISE**: NOME, CÓDIGO, ETAPA, as colunas de pontuação (com nomes diferentes de edital para edital, como "Escolaridade pontuação pergunta 15", "Nota cursos pergunta 17" ou "É indígena e mora em aldeia pontuação pergunta 16"), anos/meses/dias de experiência (profissional, saúde indígena, atenção básica), DATA DA ANÁLISE, ANÁLISE (o parecer), RESPONSÁVEL | o analista, à mão |
| **Planilha central** da área (Saúde Indígena: "Central Monitora Análises - Saúde Indígena"; Projetos: "Central AgSus Monitora Sede e Projetos"; SEDE: planilha própria) | `DIM_EDITAIS` (grupo, unidade, edital, pasta, ativo, janela da análise), `DIM_VAGAS` (vagas lidas dos nomes dos arquivos), `DIM_RESPONSAVEIS` (responsável e coordenação por vaga), `FATO_ANALISES` e `FATO_ANALISES_STG` (a consolidação, com 52 colunas), `LOG_CONSOLIDACAO`, `META_PAINEL`, `REL_PRE_VALIDACAO`, `REL_AUDITORIA_FATO`, `CTRL_SYNC_ORIGENS` | os scripts e a coordenação |
| **Painel web** de Projetos (Google Sites: Script Projetos 3/4/6/7) | leitura da FATO | ninguém edita |

### 2.2 Scripts (pasta `apps-script/` e o que ficou só no Google)

| Script | Papel |
|---|---|
| `1-atualizar-base.gs` ("Atualizar base") | lê as pastas, monta a `DIM_VAGAS`, abre cada planilha de vaga, acha o cabeçalho por **centenas de apelidos** (`SOURCE_HEADER_ALIASES`) e grava a `FATO_ANALISES`. Calcula `status_consolidado` a partir do texto da ETAPA e da ANÁLISE (`derivarStatusConsolidado_`) e a experiência total em dias (anos × 365 + meses × 30 + dias). Roda em lotes de 2,5 min, com gatilhos de continuação. |
| `2-sincronizar-com-supabase-full.gs` | envio completo da FATO para o banco (`processar_sync_analises_lote`) |
| `3-analises-incremental.gs` | envio só do que mudou (`comparar_analises_incremental`, `processar_sync_analises_incremental_lote`) |
| `4-orquestrador-fato-supabase.gs` | o gatilho de 20 em 20 minutos que encadeia os outros |
| gerador de PDF (só no Google) | gera um PDF por análise no Drive (`link_pdf`, `pdf_status`): 3.707 gerados e 703 com erro na Saúde Indígena; 1.285 gerados em Projetos |

### 2.3 Regras que hoje estão espalhadas

- **Situação** (`derivarStatusConsolidado_`): sem ETAPA, fica **Pendente**; se já há parecer, vira
  **Revisar**. ETAPA com "reprovado/inabilitado/eliminado/indeferido/não habilitado" vira
  **Reprovado**. ETAPA com "triado/aprovado/habilitado/classificado/deferido/apto" vira **Aprovado**.
  Nos dois casos, só quando o parecer é "suficiente" (não vale "ok", "sim", "-", "n/a"…); sem isso,
  vira Revisar. No banco hoje (ativos): 3.950 Aprovados (etapa "Triados"), 6.117 Reprovados, 662
  Pendentes e 15 em Revisar.
- **Nota**: o analista digita cada parcial e a nota final (`nota_final_ajustada`), sem conferência
  automática de teto nem de soma. Projetos usa escolaridade, cursos e experiência. A Saúde Indígena
  usa escolaridade, experiência, critério étnico e os totais de experiência em saúde indígena e
  atenção básica (desempate).
- **Banco** (`20260928140000_sync_de_analises_por_planilha.sql` e vizinhas): cada planilha tem um
  `CO_PLANILHA`. Há o "porteiro" do grupo, uma fila por planilha e a remoção de ausentes com trava
  de 2%. A `chave_natural` (grupo|unidade|edital|vaga|código|nome) é única; se um lote traz uma chave
  que já pertence a **outra** planilha, o lote inteiro é recusado.
- **Classificação** (`obter_classificacao_do_edital`, migration `20261005130000`): lê de
  `TB_ANALISE_CURRICULAR` (área, `ativo`, número do edital):
  `nota_final_ajustada` → nota documental; `pontuacao_escolaridade/cursos/experiencia/criterio_etnico`
  → parciais; `experiencia_*_total` → desempates; `status_consolidado`/`etapa` → apto ou não pela
  `situacoes_aptas` da regra (em geral "Aprovado" e "Triado"). Os ajustes aprovados em recurso
  entram por cima (`TB_AJUSTE_PONTUACAO_RECURSO`).
- **Regra do edital** (`TH_REGRA_CLASSIFICACAO`): já guarda as parciais da documental, as notas
  mínimas (inclusive por nível) e os máximos lidos do PDF. Mas a **pontuação de cada critério**
  (o "barema") existe só como texto (`importacao.pontuacao.detalhe`). Exemplo do 30/2026: "titulação
  não cumulativa (especialização 10, mestrado 12, doutorado 15); cursos ≥40h 1/2/3 máx 5;
  experiência 6 meses 1, 1 ano 3, +3 por ano, máx 30".

### 2.4 O que a Empregare já entrega (sem dado pessoal; levantamento do banco em 05/10/2026)

O robô grava, por candidato e vaga, **todas** as colunas do Excel em
`TB_EMPREGARE_CANDIDATO."DS_COLUNA_ORIGINAL"`. Na vaga carregada até agora (DSEI Manaus, nível
fundamental, 272 candidatos), as chaves e o formato são estes:

| Grupo | Colunas | Formato observado |
|---|---|---|
| Cadastro | NOME, CÓDIGO, E-MAIL, CELULAR/TELEFONE, CIDADE, ESTADO, PAÍS, GÊNERO, DATA DE NASCIMENTO, PCD (SIM/NÃO), DATA DE CANDIDATURA | texto |
| Processo | ETAPA ("Interessados" 240, "Triados" 32), SITUAÇÃO ("INSCRITO" 243, "CANCELADO" 29), MOTIVO/JUSTIFICATIVA DE CANCELAMENTO, MARCADORES ("Nenhum Marcador", "Reprovado"…), REPROVADO, MATCH, MATCH - PORCENTAGEM, NOTA FIT COMPORTAMENTAL, PRETENSÃO SALARIAL | texto |
| Questionário | "SITUAÇÃO - <questionário>" (FINALIZADO 159, EM ANDAMENTO 91, PENDENTE 22), "NOTA - <questionário>" (ex.: "6,0/30,0"), "DATA DE RESPOSTA - <questionário>" | texto |
| Última formação | NÍVEL, CURSO e INSTITUIÇÃO DA ÚLTIMA FORMAÇÃO, ÚLTIMA EXPERIÊNCIA | texto livre |
| Perguntas | "Pergunta N - <enunciado>" | múltipla escolha entre aspas (`"Sim"`, `"Sou indígena", "Moro em aldeia"`) ou `--` quando não respondida |

Perguntas do questionário dessa vaga (enunciado resumido):

| Nº | Pergunta | Respostas (contagem) | Uso na ficha |
|---|---|---|---|
| 1–3 | Nome completo, CPF, data de nascimento | texto (dado pessoal) | identificação (CPF mascarado) |
| 4 | Documento de identificação com foto | "Anexo" | comprovante |
| 5 | Sistema de concorrência | Ampla 135, Indígenas 51, Pretos e pardos 48, PcD 5, sem resposta 33 | modalidade |
| 6 | É indígena e mora em aldeia? (indígena 8 pontos, aldeia 6, máx. 14) | Não se aplica 172, Sou indígena 34, Sou indígena + Moro em aldeia 26 | **critério étnico** |
| 7 | Declaração de pertencimento étnico / moradia em aldeia | "Anexo" | comprovante do étnico |
| 8–11 | Autodeclaração e foto/vídeo (pretos e pardos), autodeclaração (quilombolas) | "Anexo" | cotas (heteroidentificação) |
| 12 | Laudo médico (PcD) | "Anexo" | cota PcD |
| 13 / 14 | Fundamental completo? / certificado | Sim 212, Não 6 / "Anexo" | **requisito (eliminatório)** |
| 15 / 16 | Ensino médio completo? / certificado | Certificado 199, Não possuo 6 / "Anexo" | escolaridade |
| 17 | Experiência na área/vaga (0,2 ponto por mês, máx. 10; item 8.15) | Não possuo 113, "4 anos e 2 meses" 18, "3 meses" 10, "6 meses" 8… | **experiência** |
| 18 | Comprovante da experiência | "Anexo" | comprovante |
| 19 / 20 | Parente ou conhecido na AgSUS? / nome | Sim 8, Não 189 | sinal para revisão |
| 21 | Contrato ativo na AgSUS ou desligado há menos de 6 meses? | Sim 14, Não 184 | sinal (pode ser impedimento, conforme o edital) |
| 22 | Interesse em outros DSEI | Sim 157, Não 40 | informativo (Lista de aprovados) |
| 23 / 24 | Termo de responsabilidade / LGPD | concorda 191, **não concorda 3** | **eliminatório** |

Três achados que mudam o desenho:

1. **Os anexos não vêm no Excel.** Nas perguntas de anexo, a célula diz só "Anexo" (1.633) ou
   "Resposta não informada" (131): não há link nem arquivo. Para ver o comprovante, ou o analista
   abre o candidato na Empregare, ou o robô passa a baixar os anexos (seção 9 e pergunta P2).
2. **A ligação com a análise de hoje já existe.** Os 149 candidatos dessa vaga que já estão em
   `TB_ANALISE_CURRICULAR` casam exatamente por `codigo_vaga` = `CO_VAGA` e `id_origem` =
   `CO_CANDIDATO_EMPREGARE`. A ficha pode nascer da Empregare e "adotar" a linha da planilha, sem
   trocar o `id`.
3. **A faixa de experiência vem em texto** ("4 anos e 2 meses"). Dá para converter em meses
   (50 meses × 0,2 = 10, no teto) e pré-calcular a pontuação **declarada**. O analista só confirma
   ou corrige pelo comprovante.

## 3. Fluxo novo, ponta a ponta

```
1 Empregare ──robô (já existe)──► TB_EMPREGARE_CANDIDATO (todas as colunas)
                                         │
2 Abertura das fichas  (ao fim de cada carga, só nos editais "no MONITORA")
   cria uma ficha por candidato apto para análise; a ficha já traz respostas,
   pontuação DECLARADA pré-calculada pelo barema e os sinais (termo recusado, sem requisito…)
                                         │
3 Fila de análise ─► distribuição (atribuir, balancear ou "Pegar próximo")
                                         │
4 Ficha ─► o analista confere cada critério com o comprovante, pontua, escreve o parecer
           (rascunho salvo sozinho) ─► Concluir: Aprovado ou Reprovado
                                         │
5 Revisão/validação (por amostragem ou total, conforme o edital) ─► Validada ou Devolvida
                                         │ (cada mudança de situação grava em TB_ANALISE_CURRICULAR)
6 Classificação (sem mudança: lê TB_ANALISE_CURRICULAR) ─► preliminar ─► publicação
                                         │
7 Recurso ─► parecer ─► ajuste de pontuação (já existe; por cima da nota da ficha)
                                         │
8 Classificação final ─► "Publicar como lista de aprovados" (já existe)
```

Detalhes de cada etapa:

1. **Robô da Empregare** (já existe, `docs/robo-empregare.md`). Nada muda, exceto, numa fase
   posterior, baixar os anexos (P2).
2. **Abertura das fichas.** No fim de cada carga, uma função do banco cria as fichas que faltam dos
   editais marcados "MONITORA" ou "Comparação". Ela também atualiza as fichas **ainda não
   iniciadas** quando a Empregare muda (candidato cancelou, respondeu o questionário). Uma ficha já
   iniciada não é alterada: mostra o aviso "a inscrição mudou na Empregare desde que você abriu",
   com o que mudou. Quem saiu da Empregare (`ST_REGISTRO_ATIVO = N`) não some: a ficha fica
   "Inscrição cancelada", fora da fila.
   - **Quem entra na fila** (proposta, pergunta P1): situação INSCRITO e questionário FINALIZADO.
     Cancelados e questionários incompletos aparecem numa aba à parte ("Fora da fila"), com o motivo.
3. **Fila e distribuição** (seção 7).
4. **Ficha** (seção 6).
5. **Revisão** (seção 7.3).
6. **Classificação.** Continua lendo `TB_ANALISE_CURRICULAR`. A ficha grava lá a cada mudança de
   situação (seção 10), então a Classificação não precisa mudar uma linha.
7. **Recurso.** Continua igual, mas a gaveta do recurso ganha "Ver ficha da análise" (só leitura),
   com cada critério, o comprovante e a justificativa do analista. O ajuste de pontuação continua
   sendo o mecanismo de mudar a nota depois da publicação (seção 11).
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
| **Coordenação da análise** (gestor do edital ou coordenador) | Administrador | COORDENADOR no edital | distribuir e redistribuir, definir a amostragem da revisão, reabrir ficha concluída (com motivo), configurar o barema, ver produtividade e a comparação planilha × MONITORA |
| **Administrador global** | — | — | tudo, em todas as áreas, e a **virada** de um edital (planilha → MONITORA) |

Regras:

- O papel no edital é dado pela coordenação, em "Análises › Equipe do edital". Isso substitui a aba
  `DIM_RESPONSAVEIS`. O analista pode ter o papel no edital inteiro ou só em vagas do edital.
- O banco confere **tudo** nas RPCs (`SECURITY DEFINER`): área, recorte da coordenação, nível e papel
  no edital. A tela só esconde o que a pessoa não pode usar, sem selo de "somente consulta" (regra
  do MONITORA).
- Quem analisou uma ficha não a valida: o banco recusa.
- Os grupos de acesso padrão (Configurações › Acessos) ficam assim: Gestor, Administrador em
  Análises; Coordenador, Administrador; quem trabalha na análise, Editor; Usuário, Contratador e
  Jurídico, Leitor. É proposta; o usuário decide (P4).

## 5. Barema do edital (a regra da análise)

Para pontuar no MONITORA, a pontuação de cada critério precisa sair do texto e virar uma
**configuração estruturada por edital**, versionada como a regra de classificação. A proposta é o
**barema da análise** (`TB_BAREMA_ANALISE` / `TH_BAREMA_ANALISE`). Ele fica ao lado da regra de
classificação (mesma aba do edital), porque são decisões diferentes: o barema diz **quanto vale
cada coisa**; a regra de classificação diz **quem passa e em que ordem**.

Cada edital tem um barema; cada salvamento cria uma versão, com motivo a partir da segunda. Cada
ficha guarda a versão com que foi pontuada. Se o barema mudar com fichas já concluídas, a tela
lista as afetadas e a coordenação decide se reabre (nada é recalculado escondido).

O barema tem **níveis** (fundamental, médio, técnico, superior), porque o mesmo edital pontua de
jeitos diferentes por nível, e cada nível tem **critérios**:

| Tipo de critério | Como pontua | Exemplo do edital | Pré-preenchido da Empregare |
|---|---|---|---|
| `REQUISITO` (eliminatório) | não soma; sem ele, reprova | "nível fundamental completo" (pergunta 13 + certificado 14) | resposta "Não"/"Não possuo" vira **sinal vermelho** |
| `TERMO` (eliminatório) | não soma; recusado, reprova | termo de responsabilidade (pergunta 23) | "não estou de acordo" vira sinal vermelho |
| `OPCOES` | soma os pontos das opções marcadas, até o teto; opções podem ser **não cumulativas** (vale a maior) | étnico: indígena 8 + aldeia 6, máx. 14 (pergunta 6); titulação: especialização 10, mestrado 12, doutorado 15, não cumulativa | opções marcadas pelo candidato |
| `POR_MES` | meses comprovados × pontos por mês, até o teto; pode usar **faixas** ("6 meses 1, 1 ano 3, +3 por ano") | experiência: 0,2 ponto por mês, máx. 10 (item 8.15) | faixa declarada convertida em meses ("4 anos e 2 meses" = 50) |
| `CONTAGEM` | quantidade × pontos (ou tabela 1/2/3), até o teto e até N itens | cursos ≥ 40 h: 1 curso 1, 2 cursos 2, 3 cursos 3, máx. 5 | — (o analista conta os certificados) |
| `SINAL` | não pontua; só mostra um alerta para o analista | parentesco na AgSUS (19/20), vínculo ativo (21) | resposta "Sim" vira sinal amarelo |

Cada critério diz:

- o código da **parcial** em que soma (`FORMACAO`, `CURSOS`, `EXPERIENCIA`, `ETNICO`: as mesmas da
  Classificação e do ajuste do recurso);
- a **pergunta** da Empregare que traz o declarado e a pergunta do **comprovante**, ligadas pelo
  começo do enunciado ("Pergunta 17 - Selecione sua Experiência") e conferidas a cada carga (se a
  Empregare mudar o enunciado, a coordenação é avisada);
- o **item do edital** ("8.15.2.1"), que aparece na ficha ao lado do critério.

A **nota documental** é a soma das parciais, com as casas e o arredondamento da regra de
classificação. O banco recalcula: a tela mostra a conta, mas não é a tela que grava a nota.

Para começar, o barema de cada edital é montado a partir do `importacao.pontuacao` já lido dos
PDFs, marcado "conferir". Os modelos repetidos (SI26-83, SI26-100, PROJ26-CURRICULAR…) viram
**modelos de barema** que se copiam para o edital novo.

## 6. A ficha

A ficha é uma página inteira, que se abre a partir da fila. São duas colunas no computador e uma
no celular:

- **à esquerda**, os dados e a pontuação;
- **à direita**, os comprovantes, abertos ao lado do critério que está sendo conferido.

Veja o [protótipo](prototipo-da-ficha.html).

### 6.1 Seções

1. **Cabeçalho**: nome, código Empregare, vaga (código, cargo, unidade), edital, modalidade
   declarada, situação da ficha, responsável, versão do barema e a nota em tempo real (declarada ×
   apurada). Botões "Anterior" e "Próxima" da fila.
2. **Sinais** (topo, só quando há): eliminatórios automáticos (termo recusado, sem requisito),
   alertas (parentesco, vínculo ativo, PcD sem laudo, cota sem autodeclaração, inscrição mudou na
   Empregare). Cada sinal leva ao critério.
3. **Identificação**: CPF **mascarado** (`***.456.789-**`, com o botão "Mostrar", que fica
   registrado), data de nascimento e idade na data de corte, gênero, cidade/UF, PcD. E-mail e
   telefone ficam fora da ficha (não servem para pontuar).
4. **Requisitos** (eliminatórios): cada um com a resposta, o comprovante e a decisão "Cumpre" /
   "Não cumpre". "Não cumpre" leva a Reprovado e pede o motivo.
5. **Critérios pontuados**, um cartão por critério do barema:
   - o enunciado curto e o item do edital;
   - **declarado** (resposta da Empregare e a pontuação que daria) × **apurado** (o que o analista
     confirma);
   - os controles do tipo: opções, meses (ou períodos, ver 6.2), quantidade de certificados;
   - "Comprovado? Sim / Parcialmente / Não";
   - a pontuação calculada, com o teto;
   - a **justificativa, obrigatória** quando o apurado é diferente do declarado.
6. **Cotas e modalidade**: modalidade declarada, documentos exigidos (autodeclaração, foto e vídeo,
   laudo), "Documentação da cota: completa / incompleta". A heteroidentificação e a perícia são de
   outras comissões; a ficha só registra o que foi entregue e o encaminhamento. Cota com
   documentação incompleta **não reprova** a análise: o candidato segue na ampla, conforme o edital
   (P9).
7. **Experiências para desempate** (Saúde Indígena): totais em saúde indígena e em atenção básica,
   que alimentam `experiencia_saude_indigena_total` e `experiencia_atencao_basica_total`.
8. **Parecer e resultado**: o parecer (texto, mínimo de 20 caracteres) e o resultado "Aprovado" ou
   "Reprovado". Reprovar exige **um ou mais motivos do catálogo** do edital ("Não comprovou o
   requisito de escolaridade (item 8.12)", "Recusou o termo de responsabilidade"…) e o texto.
9. **Histórico** (recolhido): cada versão salva, quem, quando e o que mudou (seção 8).

### 6.2 Experiência por meses, com teto

- **MVP**: o analista informa os **meses comprovados** (inteiro) e o banco calcula
  `min(meses × pontos_por_mes, teto)`. O declarado vem pré-preenchido da faixa ("4 anos e 2 meses" =
  50 meses).
- **Depois** (P8): o analista lança os **períodos** de cada comprovante (início, fim, onde, tipo:
  na área / saúde indígena / atenção básica). O banco junta os períodos que se sobrepõem, conta os
  meses (até a data de corte do edital) e preenche sozinho os totais de desempate. É o que acaba
  com a conta "anos × 365 + meses × 30 + dias" da planilha.

### 6.3 Rascunho, salvar e concorrência

- A ficha salva sozinha (rascunho), alguns segundos depois de cada mudança, e também com Ctrl+S.
  O rascunho não muda a situação nem a nota em `TB_ANALISE_CURRICULAR`.
- Cada salvamento leva o **número da versão** que a tela abriu. Se outra pessoa salvou antes, o
  banco recusa e a tela mostra "Esta ficha mudou desde que você abriu", com o botão "Recarregar".
  Nada é sobrescrito sem aviso.
- **Concluir** confere: todos os critérios preenchidos, justificativas onde o apurado difere,
  parecer, motivo(s) quando é reprovação. O que falta aparece no próprio campo, e só então a ficha
  passa para a revisão (ou direto para Concluída, se não sorteada).

## 7. Fila, distribuição e revisão

### 7.1 A fila

É uma tela por área, com o seletor de edital e os filtros por vaga, situação, responsável,
modalidade, sinais e "só as minhas". No topo ficam os indicadores em card compacto: Na fila, Em
análise, Para revisar, Concluídas, Reprovadas e Fora da fila. A tabela mostra o código, o nome, a
vaga, a modalidade, a nota declarada, os sinais, a situação, o responsável e o tempo parado.

### 7.2 Distribuição

São três jeitos, que podem conviver:

- **Pegar próximo** (o padrão): o analista clica e o banco entrega a próxima ficha livre das vagas
  em que ele atua, na ordem vaga → data de candidatura. A reserva é **atômica** (`for update skip
  locked`), então duas pessoas nunca pegam a mesma ficha.
- **Distribuir** (coordenação): escolhe as vagas ou fichas e os analistas, e o banco reparte em
  partes iguais (ou proporcional a um limite por analista), sem mexer no que já está em análise.
- **Atribuir / redistribuir** (coordenação): escolhe a ficha e a pessoa, com motivo; a troca entra
  no histórico.

Ficha "Em análise" parada há mais de N dias úteis (padrão 3) aparece como pendência na fila e no
painel. A coordenação pode **devolver à fila**.

### 7.3 Revisão e validação

A revisão é configurada por edital (P3):

- **Por amostragem** (o padrão proposto): o banco sorteia X% das fichas concluídas de cada analista
  (padrão 10%, mínimo 5 por analista). Entram também, sempre:
  - as reprovações por requisito;
  - as fichas em que o apurado difere do declarado em mais de Y pontos;
  - as fichas com sinal de parentesco ou vínculo.

  O sorteio é reprodutível (semente gravada, como no sorteio da Classificação).
- **Total**: toda ficha passa por um revisor.
- **Duplo-cego** (opcional, para edital sensível): duas análises independentes da mesma ficha; o
  revisor só vê as duas depois que ambas concluem. Havendo divergência acima do limite, ele decide
  qual vale (ou devolve). É mais caro; a proposta é deixar só como opção.

O revisor **valida** (a ficha fica Concluída) ou **devolve** com motivo (a ficha volta ao analista
como "Revisar").

### 7.4 Situações e transições

| Situação na ficha | Quando | Grava em `TB_ANALISE_CURRICULAR` (`status_consolidado` / `etapa`) |
|---|---|---|
| **Pendente** | ficha aberta, sem responsável ou ainda não iniciada | Pendente / nula |
| **Em análise** | o analista pegou ou recebeu e começou | Pendente / nula (o painel mostra "Em análise" pelo novo campo, ver 12) |
| **Revisar** | sorteada para revisão, ou devolvida pelo revisor | Revisar / nula |
| **Aprovado** | concluída como apta e validada (ou não sorteada) | Aprovado / "Triados" |
| **Reprovado** | concluída como inapta e validada (ou não sorteada) | Reprovado / "Reprovado" |
| *Fora da fila* | inscrição cancelada ou questionário incompleto | não grava (ou desativa a linha, se existir) |

```
Pendente ──pegar/atribuir──► Em análise ──concluir──┬─(sorteada)──► Revisar ──validar──► Aprovado | Reprovado
    ▲                            │  ▲                 │                │
    └──devolver à fila (coord.)──┘  └──devolver (revisor, com motivo)──┘
                                                      └─(não sorteada)──► Aprovado | Reprovado
Aprovado | Reprovado ──reabrir (coordenação, motivo; só antes da publicação da preliminar)──► Em análise
```

Depois que a lista **preliminar** da Classificação é publicada, a ficha não reabre: a mudança é por
**recurso** (ajuste de pontuação). Antes da publicação, a coordenação pode reabrir com motivo.

## 8. Auditoria e histórico

- `TH_FICHA_ANALISE` recebe uma linha **imutável** a cada salvamento que muda algo e a cada
  transição. Cada linha guarda quem, quando, a ação (salvar rascunho, concluir, validar, devolver,
  reabrir, atribuir…), o motivo e o **retrato completo** da ficha naquele momento (critérios, nota,
  parecer, situação), em JSON, além do SHA-256 do retrato.
- Um gatilho recusa `update` e `delete` no histórico (como já é feito nos ajustes do recurso). A
  ficha em si nunca é apagada: candidato que saiu fica "Fora da fila".
- A tela mostra o histórico como linha do tempo e permite comparar duas versões, com os campos
  alterados em destaque.

## 9. LGPD

| Dado | Quem vê | Como |
|---|---|---|
| Nome, vaga, modalidade, nota, parecer | quem tem Leitor em Análises (área e recorte) | como hoje no painel |
| CPF | analista, revisor e coordenação do edital | **mascarado** por padrão; "Mostrar" revela por 60 s e registra em `TL_ACESSO_FICHA_ANALISE` |
| Data de nascimento | os mesmos | a idade aparece sempre; a data, só na ficha |
| E-mail e telefone | ninguém na ficha | continuam só onde já estão (Lista de aprovados, convocação) |
| Anexos (documentos, laudo, foto/vídeo da cota) | analista e revisor **da ficha**, e a coordenação | cada abertura registrada em `TL_ACESSO_FICHA_ANALISE`; laudo de PcD e foto/vídeo só para quem tem o papel na ficha |
| Respostas sobre parentesco | analista, revisor e coordenação | só o "Sim/Não"; o nome do parente (pergunta 20) fica mascarado como o CPF |

Anexos: hoje não estão no banco (seção 2.4). Há dois caminhos (P2):

- **A (MVP):** o botão "Abrir na Empregare" leva ao candidato no portal, e o analista usa o próprio
  login da Empregare. Nada de documento novo guardado no MONITORA. A abertura também é registrada.
- **B (depois):** o robô baixa os anexos para um bucket **privado** do Supabase Storage (por vaga e
  candidato, com hash) e a ficha os abre ao lado, por **URL assinada de curta duração** gerada pela
  RPC, que registra o acesso. Exige definir retenção (ex.: até 5 anos depois do fim do edital,
  conforme a política da AgSUS) e o volume de armazenamento.

Os registros de acesso ficam **só para a coordenação e o administrador global**, e o robô continua
sem imprimir dado pessoal no log público do Actions.

## 10. Como a nota entra na Classificação

**Proposta: gravar na mesma `TB_ANALISE_CURRICULAR`, como uma "planilha" a mais.**

- Novas linhas em `TB_PLANILHA_ANALISE`: `monitora-saude-indigena`, `monitora-sede` e
  `monitora-projetos`, uma por área. `CO_PLANILHA` já faz o papel de "origem" (o que o pedido chamou
  de `TP_ORIGEM 'MONITORA'`). As cargas das planilhas só desativam e recusam linhas da **própria**
  planilha (`CO_PLANILHA`), então as linhas do MONITORA ficam protegidas.
- A ficha tem a sua tabela (`TB_FICHA_ANALISE` e `TB_ITEM_FICHA_ANALISE`) e uma função privada
  **publica** o resultado em `TB_ANALISE_CURRICULAR` a cada transição: situação, etapa, responsável,
  data da análise, parciais, nota documental, totais de experiência, parecer e modalidade. O
  `id_origem` recebe o código Empregare, o que deixa a `chave_natural` igual à que a planilha
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

## 11. Recurso e ajuste

- Nada novo no mecanismo: o recurso continua ligado a `CO_ANALISE_CURRICULAR` e o ajuste aprovado
  (`TB_AJUSTE_PONTUACAO_RECURSO` / `TB_ITEM_AJUSTE_PONTUACAO`) continua valendo **por cima** da nota,
  sem alterar a ficha.
- O que melhora:
  - a gaveta do recurso mostra a ficha (critério por critério, comprovante, justificativa e
    histórico), e o parecer jurídico deixa de pedir "a planilha do analista";
  - ao propor o ajuste, os valores anteriores vêm da ficha;
  - a ficha mostra o selo "Nota alterada pelo recurso nº X" quando há ajuste aprovado.
- Depois da publicação da preliminar, a ficha fica travada; reabrir só por recurso.

## 12. Indicadores

- O **painel de Análises curriculares continua funcionando** sem mudança, porque lê
  `TB_ANALISE_CURRICULAR`, onde a ficha publica. A janela do edital, a validação de data, as
  pendências, a carga por responsável e a evolução diária seguem iguais. A data da análise passa a
  ser a do sistema (acaba o "Data no futuro" por digitação).
- Duas mudanças pequenas no painel (fase 2):
  - mostrar **"Em análise"** separado de Pendente: a ficha publica o detalhe num campo novo
    (`TP_SITUACAO_FICHA`) ou o painel lê a ficha;
  - o link "Abrir ficha" na gaveta da análise, quando a origem é o MONITORA.
- Novos, na própria tela das fichas (coordenação): produtividade por analista (fichas por dia,
  tempo mediano por ficha), taxa de devolução na revisão, divergência declarado × apurado e, no
  piloto, a **concordância planilha × MONITORA**.
- **Status das atualizações**: a linha das cargas das planilhas some quando o último edital virar.
  A abertura das fichas aparece junto do robô da Empregare.

## 13. Plano de transição

| Fase | O que entra | Saída |
|---|---|---|
| **0. Preparação** | barema estruturado para o edital piloto (a partir do PDF), equipe do edital, motivos de reprovação; decisões P1–P12 | barema conferido pela coordenação |
| **1. Piloto em comparação** (`COMPARACAO`) | um edital novo, com a Empregare já carregada (sugestão: o edital da vaga DSEI Manaus nível fundamental, já com 272 candidatos no banco). A planilha continua oficial e o MONITORA analisa em paralelo, sem publicar. | relatório **planilha × MONITORA** por candidato: situação, parciais e nota iguais? Onde divergir, qual estava certo |
| **2. Virada do piloto** (`MONITORA`) | 1) a coordenação marca o edital "inativo" na `DIM_EDITAIS` da planilha (ou tira a linha); 2) espera a carga seguinte confirmar; 3) o administrador global vira o edital: as linhas da planilha desse edital são **adotadas** (o `CO_PLANILHA` passa para `monitora-<área>`, com o mesmo `id`) e as fichas são pré-preenchidas com o que a planilha tinha, marcadas "importada da planilha" | o edital piloto é 100% MONITORA; entrevistas, recursos e aprovados continuam ligados |
| **3. Editais novos** | todo edital **novo** nasce `MONITORA` (padrão do cadastro) | as planilhas param de receber editais |
| **4. Editais em andamento** | edital a edital, quando a coordenação quiser: virada como na fase 2, de preferência entre etapas (nunca no meio de um prazo de recurso) | — |
| **5. Desligamento** | sem edital ativo `PLANILHA`: desligar os gatilhos, arquivar as planilhas (somente leitura), retirar as RPCs de carga e o staging do banco, apagar `apps-script/` do repositório e os docs | fim da cadeia |

Editais **encerrados** continuam como histórico com `CO_PLANILHA` da planilha (nada é migrado).

## 14. Quais planilhas, abas e scripts deixam de existir

**Deixam de existir** (edital a edital e, no fim, todos):

| Item | Substituído por |
|---|---|
| Planilhas de vaga no Drive (aba **APTOS PARA ANÁLISE**) e as pastas por edital | a ficha |
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

## 15. Riscos e perguntas em aberto

### Riscos

| Risco | Mitigação |
|---|---|
| Anexos fora do MONITORA: o analista depende do login da Empregare | MVP com "Abrir na Empregare"; fase B baixa os anexos para um bucket privado (P2) |
| A Empregare muda os enunciados ou a ordem das perguntas e o barema perde a ligação | ligação pelo começo do enunciado, conferida a cada carga, com aviso à coordenação; a ficha mostra "pergunta não encontrada" em vez de pontuar errado |
| Planilha e MONITORA gravando o mesmo edital (recusa da carga inteira da planilha) | dono único por edital (`TB_ORIGEM_ANALISE_EDITAL`) e uma virada com passos na ordem (seção 13) |
| Barema mal configurado: a nota errada vai direto para a Classificação | barema começa "conferir"; piloto em comparação; o banco recalcula a nota; mudança de barema lista as fichas afetadas |
| Volume: milhares de fichas por edital e muita gente salvando ao mesmo tempo | rascunho com debounce, versão otimista, índices por edital/situação/responsável e fila paginada no banco |
| Resistência à mudança (a equipe está acostumada à planilha) | ficha com atalhos de teclado, "Pegar próximo", pré-preenchimento do declarado; o piloto mede o tempo por ficha |
| LGPD: mais pessoas com acesso a documentos | papel por edital, mascaramento, registro de acesso, URL assinada curta |

### Perguntas para o usuário decidir

- **P1. Quem entra na fila?** Proposta: situação INSCRITO **e** questionário FINALIZADO. E os
  "EM ANDAMENTO/PENDENTE": ficam fora, ou entram como reprovados por inscrição incompleta? A etapa
  "Triados" da Empregare significa alguma coisa para a análise?
- **P2. Anexos:** começar com "Abrir na Empregare" (cada analista com login na Empregare) ou já
  pedir que o robô baixe os anexos para o MONITORA? Quanto tempo guardar?
- **P3. Revisão:** amostragem (quanto? 10%?), total ou duplo-cego? Toda reprovação passa por
  revisor?
- **P4. Papéis:** quem distribui as fichas e configura o barema: o gestor do edital, o coordenador
  da área ou os dois? Os analistas são as mesmas pessoas que hoje estão em `DIM_RESPONSAVEIS`?
- **P5. Distribuição:** "Pegar próximo" como padrão, ou a coordenação distribui tudo no começo?
- **P6. Edital piloto:** qual? (Sugestão: o da vaga DSEI Manaus nível fundamental, já carregada pelo
  robô.)
- **P7. PDF da análise:** o PDF no Drive é usado por alguém (jurídico, SEI)? Basta "Imprimir / PDF
  da ficha" gerado na hora?
- **P8. Experiência:** basta o total de meses comprovados (MVP) ou o analista deve lançar cada
  período (início e fim), para o sistema somar sem sobreposição e calcular saúde indígena e atenção
  básica?
- **P9. Cotas:** documentação de cota incompleta faz o candidato seguir na ampla (como diz o edital)
  e a análise não reprova por isso? A heteroidentificação vai ser registrada no MONITORA depois?
- **P10. Vínculo e parentesco** (perguntas 19–21): são só alerta, ou algum edital elimina quem tem
  contrato ativo?
- **P11. Janela da análise:** bloquear "Concluir" fora do período de análise do edital, ou só avisar
  (como o painel faz hoje)?
- **P12. Motivos de reprovação:** usar um catálogo padrão (requisito, termo, documentação, fora do
  perfil) com texto livre, ou o texto livre basta?
