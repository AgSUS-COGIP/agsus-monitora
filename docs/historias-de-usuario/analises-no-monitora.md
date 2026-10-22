# Histórias de usuário — Avaliação documental no MONITORA

Pedido de 05/10/2026: "pode começar a desenhar a Análise dentro do MONITORA". O trabalho de
avaliação vai para um módulo novo, **Avaliação documental**. A tela de hoje vira o **Painel das
análises**, só de leitura.

- Desenho: [`docs/analises-no-monitora/README.md`](../analises-no-monitora/README.md).
- Dados: [`modelo-de-dados.md`](../analises-no-monitora/modelo-de-dados.md).

**Implementadas (fase F1, 06/10/2026):** AM-1.1, AM-1.2, AM-2.1, AM-2.2, AM-2.4 a AM-2.7, AM-3.1 e
AM-3.2 (`src/modulos/avaliacao-documental/`, `supabase/migrations/20261006090000…` e `…100000…`).
AM-2.3 e AM-3.3 dependem das fichas (F3). Os testes levam o mesmo código (`AM-n.m`).

**Implementadas (fase F2, 06/10/2026):** AM-4.1 a AM-4.4, AM-5.0 a AM-5.2, AM-5.5, AM-5.6 e AM-16.1
a AM-16.3 (`supabase/migrations/20261006110000…`, job `scripts/pre_classificacao/`, aba
Pré-classificação). AM-5.3 e AM-5.4 ("a linha anda" pela conclusão da ficha) esperam as fichas
(F3/F4); nesta fase o lote é reposto quando alguém do lote é eliminado na carga seguinte.

**Implementadas (fase F3, 06/10/2026):** AM-6.1 a AM-6.4, AM-12.2 e AM-3.3
(`supabase/migrations/20261006120000…` e `…120500…`, aba Fila). O lote pela nota mínima (93/2026,
item 8.2.6) e o desempate do item 10.1 entram em AM-5.0 e AM-4.2.

**Implementadas (fase F4, 07/10/2026):** AM-2.3 (a ficha guarda a versão da regra da conclusão;
versão nova lista as concluídas afetadas), AM-7.1, AM-7.2 (com "Copiar código" e a vaga na
Empregare; o currículo direto é da F7), AM-7.3 a AM-7.7, AM-8.1 a AM-8.3 (indígena, aldeia e "aldeia
na lista" marcados pelo analista; a busca da aldeia no DSEI fica para depois), AM-9.1, AM-9.2,
AM-10.1 a AM-10.6, AM-11.1 a AM-11.3, AM-12.1, AM-12.3 a AM-12.6 (atalhos 1/2/3, J/K, Ctrl+S e
Ctrl+Enter) e AM-14.1 (histórico com o que mudou) (`supabase/migrations/20261007110000…`,
`src/modulos/avaliacao-documental/ficha/`). Pedido de 07/10/2026: em cada bloco que pontua o
analista ajusta a nota apurada (até o teto) e **toda nota diferente da declarada exige justificativa**
padronizada (motivo do bloco ou observação pronta, com complemento opcional), que vai para a
lateral, o parecer e o histórico (de quanto para quanto). Ficam para depois: AM-14.2 (comparar duas
versões), AM-14.3 (CPF mascarado com "Mostrar": a ficha não traz CPF), AM-15 (publicação em
`TB_ANALISE_CURRICULAR`, com a virada da F8) e AM-5.3/5.4 (a linha anda pela conclusão).

Papéis:

- **analista**: Editor em `avaliacao_documental`, com o papel ANALISTA no edital;
- **revisor**: Editor, com o papel REVISOR;
- **coordenação**: o **gestor do edital ou o coordenador** (qualquer um dos dois; decidido em
  05/10/2026), com Administrador em `avaliacao_documental`;
- **admin**: o administrador global;
- **leitor**: Leitor do painel ou da Avaliação documental;
- **gestor da Classificação**: Editor em Classificação.

Prioridades: **MVP** é o mínimo para o piloto de Projetos rodar em comparação e virar; **Depois**
vem em seguida.

---

## MVP

### AM-1. Dois itens no menu: painel e trabalho

Como **pessoa da equipe**, quero o "Painel das análises" (leitura) separado da "Avaliação
documental" (trabalho), para cada um abrir o que precisa sem misturar consulta e edição.

- **AM-1.1** — **Dado** o menu de uma área, **então** aparecem "Painel das análises" (a tela de
  hoje, view `analises`, recurso `analises`) e "Avaliação documental" (view
  `avaliacao-documental`, recurso `avaliacao_documental`).
- **AM-1.2** — **Dado** alguém sem acesso a `avaliacao_documental`, **então** o item não aparece,
  e as RPCs recusam (`42501`).
- **AM-1.3** — **Dado** uma análise de origem MONITORA no painel, **então** a gaveta tem "Abrir na
  Avaliação documental"; a ficha tem "Ver no painel".
- **AM-1.4** — **Dado** uma ficha que publica, **então** o painel mostra a mudança sem esperar o
  ciclo de 2 minutos do cache.

### AM-2. Regra da avaliação do edital

Como **coordenação**, quero cadastrar a regra da avaliação do edital a partir de um modelo, para
não depender de planilha nem de simulador com a regra fixa no código. A regra tem os blocos por
documento, os motivos padronizados, a pontuação, o lote, a distribuição, a revisão, os textos do
parecer e o atalho da Empregare.

- **AM-2.1** — **Dado** um edital sem regra, **quando** escolho o modelo PROJ26-CURRICULAR,
  **então** a versão 1 é criada e fica "Conferir".
- **AM-2.2** — **Dado** a regra, **quando** salvo uma mudança, **então** o motivo é obrigatório e
  a versão anterior fica no histórico.
- **AM-2.3** — **Dado** fichas já concluídas, **quando** salvo uma versão nova, **então** a tela
  lista as afetadas, e nenhuma nota muda sozinha.
- **AM-2.4** — **Dado** as perguntas da última carga da Empregare, **então** a tela da regra as
  lista com as respostas encontradas, para eu ligar cada pergunta a um bloco (pelo enunciado) e
  mapear os pontos declarados.
- **AM-2.5** — **Dado** um bloco "Graduação exigida (item 8.11.2)", **então** consigo definir as
  situações, os motivos padronizados (com o item do edital) e o efeito de cada um (elimina, ajusta
  pontos, só registro, encaminha).
- **AM-2.6** — **Dado** dois editais com pesos diferentes (indígena +8/aldeia +6 e +7/+5),
  **então** cada um pontua com os seus: nada fica fixo no código.
- **AM-2.7** — **Dado** a regra pronta, **quando** uso "Testar com um candidato fictício",
  **então** vejo a nota, a situação e o parecer, sem gravar.

### AM-3. Equipe do edital

Como **coordenação**, quero dizer quem analisa e quem revisa em cada edital ou vaga.

- **AM-3.1** — **Dado** o gestor cadastrado no edital, **então** ele já tem o papel de coordenação,
  sem cadastro à parte.
- **AM-3.2** — **Dado** uma pessoa sem Editor em `avaliacao_documental`, **quando** tento incluí-la
  como analista, **então** o banco recusa e diz qual permissão falta.
- **AM-3.3** — **Dado** um analista removido com fichas em análise, **então** a tela pede para
  devolvê-las ou redistribuí-las antes.

### AM-4. Lista provisória por ART (ranqueamento eletrônico)

Como **coordenação**, quero que, depois de cada carga do robô, o sistema monte a Lista Geral de
Classificação Provisória por vaga, pela ART em ordem decrescente, com os eliminados automáticos à
parte, para não montar planilha (item 8.3.1).

- **AM-4.1** — **Dado** uma carga concluída, **então** os CANCELADOS, os com questionário não
  FINALIZADO, os REPROVADOS na Empregare e os que recusaram o termo ficam "Eliminados", com o motivo
  e sem ficha.
- **AM-4.2** — **Dado** os demais, **então** ficam ordenados pela ART (a nota da Empregare "x/30")
  decrescente, com o desempate da regra; rodar de novo não duplica.
- **AM-4.3** — **Dado** uma ART diferente da nota declarada recalculada pela regra, **então** a
  coordenação vê o aviso de divergência, e a ordem segue a ART.
- **AM-4.4** — **Dado** a fila, **então** a faixa do topo mostra Inscritos, Eliminados,
  Ranqueados e "Lote (aptos para análise)" com "N de M".

### AM-5. Lote de convocação e "a linha anda"

Como **coordenação**, quero que só o lote de convocação (item 8.4) ganhe ficha, e que o lote seja
reposto quando alguém sai, para avaliar só quem o edital manda e não deixar vaga sem candidato.

- **AM-5.0** — **Dado** a regra do edital, **quando** abro a configuração do lote, **então** a tela
  **sugere** um tamanho (ex.: 3 × vagas imediatas + CR, pelo quadro de vagas) e eu edito à vontade,
  sem padrão fixo, por edital e por vaga.
- **AM-5.1** — **Dado** o lote "5 × vagas imediatas + CR" e 4 vagas, **então** os 20 primeiros da
  Provisória (mais os empatados na 20ª, se a regra mandar) ganham ficha Pendente.
- **AM-5.2** — **Dado** o lote por modalidade, **então** ele é contado separadamente na ampla e em
  cada cota.
- **AM-5.3** — **Dado** um candidato do lote concluído como Inapto (por requisito ou por nota
  mínima), **então** o primeiro de fora entra no lote, com o selo "Entrou no lote" e o motivo no
  histórico.
- **AM-5.4** — **Dado** um Apto com nota apurada abaixo da ART do primeiro de fora, **então** esse
  primeiro de fora também entra.
- **AM-5.5** — **Dado** um recálculo, **então** quem já tem ficha não sai do lote.
- **AM-5.6** — **Dado** a regra "publica cada reposição", **então** cada reposição gera um novo
  Lote de Convocação para publicar; com "não publica", a reposição só fica registrada.

### AM-6. Fila e distribuição configurável

Como **coordenação**, quero escolher por edital entre "Pegar próximo" e a distribuição inicial, e
redistribuir quando precisar.

- **AM-6.1** — **Dado** o modo "Pegar próximo", **quando** um analista clica, **então** recebe a
  primeira ficha livre na ordem da Provisória, e duas pessoas nunca recebem a mesma.
- **AM-6.2** — **Dado** o modo "Distribuição inicial" e 300 fichas para 3 analistas, **então** a
  prévia mostra 100 para cada um e só grava ao confirmar; os que entram depois vão para quem tem
  menos pendentes.
- **AM-6.3** — **Dado** qualquer modo, **quando** redistribuo com motivo, **então** fica no
  histórico, e ficha concluída não é mexida.
- **AM-6.4** — **Dado** a busca por código Empregare, **então** a ficha abre direto (se for do
  edital e das minhas vagas).

### AM-7. Ficha: um bloco por documento ou pergunta

Como **analista**, quero conferir cada documento do questionário num bloco próprio da ficha, com o
que o candidato declarou e o atalho para a Empregare, e registrar a situação e o motivo, para que a
decisão fique explicada item por item.

- **AM-7.1** — **Dado** a regra do 100/2026 nível superior, **então** a ficha mostra os blocos:
  identidade (P4), modalidade (P5), critério étnico (P6+P7), pretos e pardos (P8–P10), quilombola
  (P11), PcD (P12), graduação e diploma (P13/P14), outras formações (P15/P16), experiência
  (P17/P18), parentesco (P19/P20), vínculo ativo (P21), outros DSEI (P22) e termos (P23/P24).
- **AM-7.2** — **Dado** um bloco, **então** vejo a resposta declarada ("Anexo", "Vídeo", a opção
  ou "Resposta não informada") e o botão "Abrir na Empregare":
  - com o endereço do currículo capturado pelo robô, ele abre **direto o currículo do candidato**;
  - sem ele, abre as **candidaturas da vaga**, e a ficha mostra o código do candidato com
    **"Copiar"**;
  - cada abertura e cada cópia ficam registradas.
- **AM-7.2b** — **Dado** alguém que não pode ver a ficha, **então** os endereços da Empregare
  nunca chegam a essa pessoa: não aparecem em lista, CSV nem log.
- **AM-7.3** — **Dado** um bloco, **quando** escolho Conforme, Não conforme, Não enviado ou Não se
  aplica (também pelas teclas C, N, E, A), **então** o efeito do bloco aparece ao lado.
- **AM-7.4** — **Dado** "Não conforme" ou "Não enviado", **quando** tento concluir sem motivo,
  **então** o bloco pede um motivo padronizado (com o item do edital) ou um texto livre.
- **AM-7.5** — **Dado** "Resposta não informada" na Empregare, **então** o bloco já sugere "Não
  enviado"; um bloco de cota que não se aplica à modalidade marca "Não se aplica" sozinho.
- **AM-7.6** — **Dado** a graduação "Não conforme — diploma sem verso (item 8.11.2)", **então** a
  situação vira "Inapto (requisito)", a nota publicada é 0 e o parecer lista o motivo.
- **AM-7.7** — **Dado** pretos e pardos Conforme, **então** a ficha registra o encaminhamento para
  a heteroidentificação; PcD Conforme, para a perícia.

### AM-8. Critério étnico com aldeia da lista

Como **analista**, quero validar a declaração do Anexo VI e a aldeia na lista do DSEI, para que os
pontos só valham com o documento e a aldeia corretos.

- **AM-8.1** — **Dado** a declaração Conforme, **então** soma os pontos de indígena da regra.
- **AM-8.2** — **Dado** "mora em aldeia" e uma aldeia escolhida na lista do DSEI, **então** soma os
  pontos de aldeia; fora da lista, os pontos de aldeia não entram e o motivo "Aldeia fora do DSEI
  (7.2.2)" é sugerido.
- **AM-8.3** — **Dado** a declaração Não conforme (ex.: "sem as assinaturas das lideranças"),
  **então** os pontos étnicos zeram, mas o candidato não é eliminado.

### AM-9. Formação: lista de títulos

Como **analista**, quero lançar cada título (nível, curso, instituição, carga horária, comprovante)
e aceitar ou recusar com motivo, para a formação pontuar pela regra.

- **AM-9.1** — **Dado** especialização e mestrado aceitos, numa regra não cumulativa, **então**
  vale o maior (mestrado).
- **AM-9.2** — **Dado** um título recusado sem motivo, **então** não consigo concluir.

### AM-10. Experiência: tabela de vínculos

Como **analista**, quero lançar os vínculos (empregador, cargo, categoria, início, fim,
comprovante) e aceitar ou recusar cada um com motivo, para que o sistema una as sobreposições,
conte os meses, aplique o teto e calcule os desempates.

- **AM-10.1** — **Dado** dois vínculos sobrepostos, **então** os dias contam uma vez, e os meses
  são os dias ÷ 30, só os inteiros.
- **AM-10.2** — **Dado** 55 meses aceitos, **então** a experiência vale min(55 × 0,2; 10) = 10.
- **AM-10.3** — **Dado** menos meses que o mínimo do edital (ex.: 6), **então** a situação vira
  "Inapto (requisito)", com o motivo e o item do edital.
- **AM-10.4** — **Dado** um vínculo recusado ("sem data de término — item 8.14"), **então** ele não
  conta, e o motivo entra no parecer.
- **AM-10.5** — **Dado** vínculos de Saúde Indígena e Atenção Básica, **então** os desempates 1 e
  2 aparecem em anos, meses e dias e vão para a Classificação.
- **AM-10.6** — **Dado** um indígena sem experiência e 800 h de estágio, **então** o estágio vale
  floor(800 ÷ 8 ÷ 22) = 4 meses.

### AM-11. Parecer automático e observações

Como **analista**, quero o parecer gerado pela regra (distribuição dos pontos ou motivos de
inaptidão) e as observações prontas, para não redigir à mão.

- **AM-11.1** — **Dado** Apto, **então** o parecer diz "HABILITADO(A) na Avaliação Documental e de
  Títulos com a pontuação total de X…", com Formação Acadêmica, Experiência Profissional e Critério
  Étnico.
- **AM-11.2** — **Dado** Inapto por requisito, **então** o parecer lista os motivos escolhidos nos
  blocos, com os itens do edital.
- **AM-11.3** — **Dado** uma observação pronta, **então** o texto entra no parecer; "Copiar
  parecer" copia.

### AM-12. Rascunho, reserva, atalhos e "Concluir e próxima"

Como **analista**, quero trabalhar rápido e sem perder nada nem sobrescrever o colega.

- **AM-12.1** — **Dado** uma mudança, **então** o rascunho salva sozinho, e "Salvo às HH:MM" só
  aparece depois de o banco confirmar.
- **AM-12.2** — **Dado** uma ficha aberta por mim, **quando** outra pessoa a abre, **então** ela vê
  "Em uso por <nome> desde HH:MM", só para leitura; a coordenação pode liberar.
- **AM-12.3** — **Dado** um salvamento de outra pessoa no meio, **então** o banco recusa ("Esta
  ficha mudou desde que você abriu").
- **AM-12.4** — **Dado** Ctrl+Enter, **então** a ficha confere o que falta, conclui e abre a
  próxima.
- **AM-12.5** — **Dado** "?", **então** aparece a lista de atalhos (C/N/E/A, J/K, Ctrl+S, Ctrl+E).
- **AM-12.6** — **Dado** a conclusão, **então** o responsável é quem está logado e a data é a de
  hoje; não há campo para digitar.

### AM-13. Revisão configurável

Como **coordenação**, quero combinar as opções de revisão por edital, e como **revisor**, validar
ou devolver.

- **AM-13.1** — **Dado** a regra, **então** posso combinar: amostra com X%, todas, só inaptos,
  divergentes, com sinal, os que entraram pela linha que anda, duplo-cego ou nenhuma.
- **AM-13.2** — **Dado** amostra de 10% + inaptos, **então** pelo menos 10% das fichas de cada
  analista e todos os inaptos vão para revisão, com a semente gravada.
- **AM-13.3** — **Dado** uma ficha que eu mesmo analisei, **então** não consigo validá-la.
- **AM-13.4** — **Dado** que devolvo, **então** o motivo é obrigatório e a ficha volta como
  "Revisar".

### AM-14. Auditoria e LGPD

Como **coordenação**, quero cada clique relevante registrado, o CPF mascarado e o acesso aos
documentos registrado.

- **AM-14.1** — **Dado** que mudo a situação de um bloco, recuso um vínculo ou abro na Empregare,
  **então** fica um evento (quem, quando, antes e depois) que não pode ser alterado nem apagado.
- **AM-14.2** — **Dado** o histórico, **então** vejo cada versão salva e comparo duas.
- **AM-14.3** — **Dado** a ficha, **então** o CPF aparece mascarado, e "Mostrar" fica registrado.

### AM-15. Gravação para a Classificação e o painel

Como **gestor da Classificação**, quero que a ficha concluída chegue à Classificação com tudo o que
as listas usam.

- **AM-15.1** — **Dado** o edital em "MONITORA", **então** `TB_ANALISE_CURRICULAR` recebe:
  situação e etapa, parciais, nota (0 se inapto por requisito), desempates, PcD, nascimento,
  parecer e a ART em `nota_empregare`.
- **AM-15.2** — **Dado** o edital em "Comparação", **então** nada é gravado lá.
- **AM-15.3** — **Dado** o painel, **então** os indicadores contam o lote e as fichas como contavam
  a aba APTOS PARA ANÁLISE.

### AM-16. Listas oficiais novas: Provisória por ART e Lote

Como **gestor da Classificação**, quero gerar e publicar a Lista Geral de Classificação Provisória
(ART) e o Lote de Convocação, como as outras listas, para publicar tudo pelo MONITORA.

- **AM-16.1** — **Dado** a Provisória da Avaliação documental, **quando** gero a lista
  `PROVISORIA`, **então** sai, por vaga, Classificação, Nome e "Nota da Autodeclaração de
  Requisitos e Títulos (ART)" em ordem decrescente, com as disposições do item 8.3.1 ("não valida
  documentos").
- **AM-16.2** — **Dado** o lote, **quando** gero a lista `LOTE`, **então** sai, por vaga, a
  relação dos convocados para a avaliação documental (item 8.4); uma reposição gera um lote novo,
  se o edital publicar.
- **AM-16.3** — **Dado** as duas listas, **então** "Copiar para o SEI" e "Baixar DOCX" seguem o
  modelo da AgSUS (cabeçalho, "1. DISPOSIÇÕES PRELIMINARES" com os itens do edital, quadro por
  vaga, "2. DISPOSIÇÕES FINAIS"), com textos editáveis por edital.

### AM-17. Resultado preliminar e final: aptos e inaptos

Como **gestor da Classificação**, quero os resultados da Avaliação Documental e de Títulos com as
colunas e o parecer certos.

- **AM-17.1** — **Dado** a lista `PRELIMINAR`, fase Preliminar, **então** os APTOS saem por vaga,
  com o cabeçalho "N vagas (x AC + y PP + CR)" e as colunas Classificação Geral, Nome Completo,
  Modalidade, Formação Acadêmica, Experiência Profissional, Critério Étnico, Nota na Avaliação
  Documental e de Títulos e Classificação na Modalidade.
- **AM-17.2** — **Dado** o recorte de eliminados, **então** os INAPTOS saem com o parecer da ficha
  na coluna de justificativa (item 8.5 "b").
- **AM-17.3** — **Dado** os recursos julgados, **quando** gero a fase Final, **então** saem os
  APTOS e INAPTOS finais, com os ajustes aprovados.
- **AM-17.4** — **Dado** qualquer edital, **então** o título padrão das listas da etapa é
  "Avaliação Documental e de Títulos" (decidido em 05/10/2026), editável por edital.

### AM-18. Piloto em comparação e virada

Como **admin**, quero rodar o piloto, o **edital 93/2026** (SESMT, Projetos), em comparação e
depois virar.

- **AM-18.0** — **Dado** que o 93/2026 não tem vagas na Seleção nem candidatos no robô, **quando**
  preparo o piloto, **então** as 5 vagas dele são ligadas ao edital e o robô carrega os candidatos
  delas antes de tudo.

- **AM-18.1** — **Dado** "Comparação", **então** vejo a Provisória e o lote comparados com a aba
  APTOS PARA ANÁLISE, e cada candidato (situação, parciais, nota) comparado com a planilha.
- **AM-18.2** — **Dado** o edital ainda ativo na `DIM_EDITAIS`, **quando** tento virar, **então** o
  banco recusa e diz o que fazer.
- **AM-18.3** — **Dado** a virada, **então** as linhas da planilha são adotadas com o mesmo `id`, e
  entrevistas, recursos e aprovados continuam ligados.
- **AM-18.4** — **Dado** as 86 linhas ativas do 93/2026 (71 Pendentes, 15 em Revisar com parecer),
  **então**:
  - as 15 viram fichas "importadas da planilha", na situação Revisar, com o parecer;
  - as 71 viram fichas Pendentes, pré-preenchidas pela Empregare;
  - todas passam para a origem `monitora-projetos`.

### AM-18b. Robô captura os endereços da Empregare

Como **analista**, quero que o robô guarde o endereço das candidaturas de cada vaga e o do currículo
de cada candidato, para abrir o candidato na Empregare com um clique.

- **AM-18b.1** — **Dado** uma execução do robô, **então** cada vaga ganha o endereço de
  candidaturas (aba Todos, lista percorrida até o fim) e cada candidato, casado pelo
  `data-pessoa-id` = código, ganha o endereço do currículo, com a data da captura.
- **AM-18b.2** — **Dado** que um token mudou, **então** a execução seguinte sobrescreve o endereço.
- **AM-18b.3** — **Dado** uma vaga sem endereço capturado, **então** o gestor ou o coordenador
  cadastra o endereço de candidaturas à mão (só endereço da Empregare).
- **AM-18b.4** — **Dado** o log público do Actions, **então** nenhum token ou endereço aparece
  (mascaramento).

---

## Depois

### AM-19. Reabrir antes da publicação

- **AM-19.1** — **Dado** o Resultado Preliminar não publicado, **quando** a coordenação reabre com
  motivo, **então** a ficha volta a "Em análise".
- **AM-19.2** — **Dado** o Resultado Preliminar publicado, **então** o banco recusa e indica o
  recurso.

### AM-20. Ficha no recurso

- **AM-20.1** — **Dado** um recurso, **então** a gaveta tem "Ver ficha da avaliação" (só
  leitura), com blocos, motivos, títulos, vínculos e parecer.
- **AM-20.2** — **Dado** um ajuste aprovado, **então** a ficha mostra "Nota alterada pelo recurso
  nº X".

### AM-21. Documentos dentro do MONITORA (fase B)

- **AM-21.1** — **Dado** os documentos baixados pelo robô, **quando** abro um bloco, **então** o
  documento abre ao lado, por um link de 60 s, registrado.

### AM-22. Painel com "Em análise" e os contadores do lote

- **AM-22.1** — **Dado** o painel, **então** mostra "Em análise" separado de Pendente e os
  contadores da Provisória e do lote.

### AM-23. Indicadores da equipe

- **AM-23.1** — **Dado** um período, **então** a coordenação vê, por analista, as fichas por dia,
  o tempo mediano, as devoluções, os motivos mais comuns por bloco e os encaminhamentos.

### AM-24. Duplo-cego

- **AM-24.1** — **Dado** a revisão em duplo-cego, **então** cada ficha recebe dois analistas, que
  não veem o trabalho um do outro; a divergência vai ao revisor.

### AM-25. Imprimir a ficha

- **AM-25.1** — **Dado** uma ficha concluída, **quando** imprimo, **então** sai a ficha com o
  parecer, sem CPF completo, e a impressão fica registrada.

### AM-26. Desligar as planilhas

- **AM-26.1** — **Dado** nenhum edital ativo em "PLANILHA", **então** a carga das planilhas, o
  simulador e o web app são desligados, e `apps-script/` sai do repositório.

### AM-27. Jurídico separado dos administradores

- **AM-27.1** — **Dado** que hoje nenhum usuário tem o grupo "juridico" e só os administradores
  dão o parecer jurídico nos recursos, **quando** um edital da Avaliação documental chegar ao prazo
  de recurso, **então** pelo menos uma pessoa deve ter o grupo Jurídico (observação operacional, sem
  código).
