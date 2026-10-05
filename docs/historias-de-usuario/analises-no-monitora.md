# Histórias de usuário — Análise curricular no MONITORA

Pedido de 05/10/2026: "pode começar a desenhar a Análise dentro do MONITORA". O analista pontua
numa ficha do MONITORA, e não mais no simulador e nas planilhas. Desenho completo:
[`docs/analises-no-monitora/README.md`](../analises-no-monitora/README.md); dados:
[`modelo-de-dados.md`](../analises-no-monitora/modelo-de-dados.md). **Nada implementado ainda.**
Quando cada história for feita, os testes recebem o mesmo código (`AM-n.m`).

Papéis:

- **analista**: Editor em Análises curriculares, com o papel ANALISTA no edital;
- **revisor**: Editor, com o papel REVISOR no edital;
- **coordenação**: o **gestor do edital ou o coordenador** da área, qualquer um dos dois (decidido em
  05/10/2026): Administrador em Análises, com o papel COORDENADOR no edital;
- **admin**: administrador global;
- **leitor**: quem só consulta o painel.

Prioridade:

- **MVP**: o mínimo para o edital piloto rodar em comparação e virar;
- **Depois**: o que vem depois do piloto.

---

## MVP

### AM-1. Cadastrar a regra da análise do edital

Como **coordenação**, quero cadastrar a regra da análise do edital (checklist, étnico, escolaridade
por nível, cursos, experiência, textos do parecer e observações prontas), copiando de um modelo,
para não depender de um simulador com a regra fixa no código.

- **AM-1.1** — **Dado** um edital sem regra da análise, **quando** escolho o modelo "SI26 —
  Interior Sul", **então** a versão 1 é criada com os itens do modelo e fica "Conferir".
- **AM-1.2** — **Dado** a regra aberta, **quando** mudo um ponto (ex.: cursos ≥ 81 h de 0,5 para
  0,6) e salvo, **então** o banco pede um motivo (mínimo de 10 caracteres), cria a versão 2 e a 1
  fica no histórico.
- **AM-1.3** — **Dado** fichas já concluídas com a versão 1, **quando** salvo a versão 2,
  **então** a tela lista as fichas afetadas, e nenhuma nota muda sozinha.
- **AM-1.4** — **Dado** um item do checklist sem item do edital ou sem texto de motivo, **quando**
  salvo, **então** o banco recusa e aponta o item.
- **AM-1.5** — **Dado** a regra de classificação do edital sem nota mínima, **quando** abro a regra
  da análise, **então** aparece o aviso "Sem nota de corte: ninguém fica Não habilitado", com o link
  para a Classificação.
- **AM-1.6** — **Dado** a regra pronta, **quando** uso "Testar com um candidato fictício",
  **então** vejo a nota, a situação e o parecer que ela daria, sem gravar nada.

### AM-2. Lista de aldeias do DSEI

Como **admin**, quero carregar a lista oficial de aldeias de um DSEI, para que o "mora em aldeia" só
pontue com aldeia válida, em todos os editais daquele DSEI.

- **AM-2.1** — **Dado** a lista do Interior Sul (238 aldeias, "NOME-(polo)"), **quando** carrego,
  **então** cada aldeia fica com o nome, o polo e a fonte, sem duplicar.
- **AM-2.2** — **Dado** uma aldeia retirada da lista depois, **quando** abro uma ficha concluída
  que a usou, **então** a ficha continua mostrando a aldeia e os pontos da época.

### AM-3. Equipe do edital

Como **coordenação**, quero dizer quem analisa e quem revisa em cada edital (ou vaga), para que só
essas pessoas peguem fichas dele.

- **AM-3.1** — **Dado** uma pessoa com Editor em Análises, **quando** a incluo como ANALISTA no
  edital, **então** ela passa a ver a fila desse edital.
- **AM-3.2** — **Dado** uma pessoa sem Editor em Análises, **quando** tento incluí-la, **então** o
  banco recusa e diz qual permissão falta.
- **AM-3.3** — **Dado** um analista removido da equipe, **quando** ele tinha fichas "Em análise",
  **então** a tela pede para devolvê-las à fila ou redistribuí-las antes de confirmar.

### AM-4. Pré-classificação pela nota declarada e linha de corte

Como **coordenação**, quero que, depois de cada carga do robô, o sistema elimine os inscritos que
não podem seguir, ranqueie os demais pela nota declarada e abra ficha só para quem está até a linha
de corte, para não montar as abas IMPORTACAO EMPREGARE, TOTAL DE CANDIDATOS, ELIMINADOS e APTOS PARA
ANÁLISE da planilha.

- **AM-4.1** — **Dado** um edital em "Comparação" ou "MONITORA" e uma carga do robô concluída,
  **quando** a pré-classificação roda, **então**:
  - os CANCELADOS, os com questionário não FINALIZADO e os REPROVADOS na Empregare ficam
    "Eliminados", com o motivo e sem ficha;
  - os demais são ranqueados pela nota declarada;
  - rodar de novo não duplica nada.
- **AM-4.2** — **Dado** a regra do edital com o mapeamento "Especialização na área à qual
  concorre" = 1, a faixa "4 anos e 2 meses" (0,2 por mês, teto 10) e "Sou indígena" + "Moro em
  aldeia" = 8 + 6, **então** a nota declarada desse candidato é 1 + 10 + 14 = 25.
- **AM-4.3** — **Dado** outro edital com indígena +7 e aldeia +5, **então** as mesmas respostas
  dão 12 no étnico: os pesos vêm da regra do edital, nunca do código.
- **AM-4.4** — **Dado** uma resposta que a regra não mapeia, **então** a tela da regra a lista como
  "resposta sem pontuação", para a coordenação decidir, e ela vale 0 até lá.
- **AM-4.5** — **Dado** a linha de corte "5 × vagas imediatas + CR" e 4 vagas, **então** os 20
  primeiros (mais os empatados na 20ª posição, se a regra mandar) ganham ficha Pendente e os outros
  ficam "Ranqueados".
- **AM-4.6** — **Dado** a regra com a linha **por modalidade**, **então** a linha é contada
  separadamente na ampla e em cada cota.
- **AM-4.7** — **Dado** a fila, **então** a faixa do topo mostra Inscritos, Cancelados/Reprovados,
  Ranqueados e "Aptos para análise (linha de corte)" com "N de M", e a aba Eliminados lista o motivo
  de cada um.
- **AM-4.8** — **Dado** uma ficha já iniciada e uma mudança do candidato na Empregare, **quando** a
  carga roda, **então** a ficha não muda e mostra "A inscrição mudou na Empregare", com o que mudou.
- **AM-4.9** — **Dado** a modalidade "Indígenas" ou a resposta "Sou indígena", **então** a ficha
  já abre com "Autodeclarado indígena" marcado e o item "Declaração étnica" do checklist ativo.

### AM-4b. "A linha anda"

Como **coordenação**, quero que, quando alguém da linha de corte sai, o próximo da
pré-classificação entre sozinho na fila, para não deixar vaga sem candidato analisado nem controlar
isso à mão.

- **AM-4b.1** — **Dado** um candidato da linha concluído como Inabilitado ou Não habilitado,
  **então** o primeiro de fora ganha ficha Pendente, com o selo "Entrou na fila" e o motivo
  "entrou porque 7000654 foi inabilitado" no histórico.
- **AM-4b.2** — **Dado** um candidato habilitado cuja nota apurada ficou abaixo da nota declarada
  do primeiro de fora, **então** esse primeiro de fora também entra.
- **AM-4b.3** — **Dado** um recálculo, **então** ninguém que já tem ficha sai da linha; só sai pela
  conclusão.
- **AM-4b.4** — **Dado** o modo de distribuição inicial, **então** quem entra vai para o analista
  com menos fichas pendentes (ou fica livre, conforme a regra).

### AM-5. Fila e "Pegar próximo"

Como **analista**, quero clicar em "Pegar próximo" e receber a próxima ficha livre das minhas vagas,
para não disputar candidato com colegas nem procurar código em planilha.

- **AM-5.1** — **Dado** o edital no modo "Pegar próximo" e fichas Pendentes nas minhas vagas,
  **quando** clico em "Pegar próximo", **então** recebo a primeira livre na ordem da
  pré-classificação, ela fica "Em análise" no meu nome e a ficha abre.
- **AM-5.2** — **Dado** dois analistas clicando ao mesmo tempo, **então** cada um recebe uma ficha
  diferente.
- **AM-5.3** — **Dado** a fila, **quando** digito um código Empregare na busca, **então** a ficha
  abre direto, se for do edital e das minhas vagas; se não for, aparece "Código não encontrado neste
  edital".
- **AM-5.4** — **Dado** a fila, **então** vejo os indicadores (Na fila, Em análise, Para revisar,
  Habilitados, Não habilitados/Inabilitados, Fora da fila) e posso filtrar por vaga, situação,
  responsável, modalidade, sinais e "só as minhas".

### AM-6. Checklist de admissibilidade

Como **analista**, quero desmarcar o item do checklist que o candidato não cumpriu, para que ele fique
Inabilitado com o motivo e o item do edital no parecer.

- **AM-6.1** — **Dado** uma ficha nova, **então** todos os itens do checklist da regra aparecem
  marcados, cada um com o item do edital.
- **AM-6.2** — **Dado** que desmarco "Arquivo único (7.7)", **então** o cartão fica vermelho, a
  nota vira 0,0, a situação vira "Inabilitado (admissibilidade)" e o parecer lista "Item 7.7:
  Documentação enviada de forma fracionada…".
- **AM-6.3** — **Dado** um candidato não indígena, **então** o item "Declaração étnica (7.3)" fica
  inativo e não elimina.
- **AM-6.4** — **Dado** a resposta "Não" à escolaridade mínima na Empregare, **então** o item
  aparece com o sinal "O candidato declarou não ter", para eu confirmar.

### AM-7. Critério étnico com aldeia da lista

Como **analista**, quero marcar "indígena" e "mora em aldeia" e escolher a aldeia na lista do DSEI,
para que os pontos da aldeia só valham com aldeia válida.

- **AM-7.1** — **Dado** "indígena" marcado, **então** soma os pontos de indígena da regra (+7 no
  28/2026).
- **AM-7.2** — **Dado** "mora em aldeia" marcado, **quando** digito parte do nome, **então** a busca
  sugere as aldeias da lista do DSEI do edital.
- **AM-7.3** — **Dado** uma aldeia da lista, **então** soma os pontos de aldeia (+5) e mostra
  "✓ Aldeia confirmada na lista do DSEI".
- **AM-7.4** — **Dado** aldeia não escolhida ou fora da lista, **então** os pontos de aldeia não
  entram, aparece o aviso e o atalho para a observação pronta "Aldeia fora do DSEI".

### AM-8. Escolaridade e cursos

Como **analista**, quero escolher a titulação comprovada entre as do nível da vaga e contar os cursos
por faixa de carga horária, para a nota sair sem conta de cabeça.

- **AM-8.1** — **Dado** uma vaga de nível técnico/médio, **então** a escolaridade oferece só
  "Ensino médio/técnico (0)" e "Graduação (+3)"; o nível vem da vaga, não é escolhido a cada
  candidato.
- **AM-8.2** — **Dado** os contadores ≥ 81 h = 4, 41–80 h = 6 e ≤ 40 h = 5, **então** os cursos
  somam min(4 × 0,5 + 6 × 0,3 + 5 × 0,2; 5) = 4,8.
- **AM-8.3** — **Dado** os cursos acima do teto, **então** aparece "5,0 de 5,0 (teto)".

### AM-9. Vínculos de experiência e desempate

Como **analista**, quero lançar os vínculos comprovados (categoria, início e fim) e ver os meses, os
pontos e os tempos de desempate, para que a sobreposição não conte duas vezes e o desempate chegue à
Classificação.

- **AM-9.1** — **Dado** dois vínculos que se sobrepõem, **então** o tempo único validado conta os
  dias uma vez só, e os meses são os dias ÷ 30, só os inteiros.
- **AM-9.2** — **Dado** 55 meses validados, **então** a experiência vale min(55 × 0,2; 10) = 10,0.
- **AM-9.3** — **Dado** vínculos de Saúde Indígena e de Atenção Básica, **então** a análise
  cronológica mostra cada um em anos, meses e dias (desempates 1 e 2).
- **AM-9.4** — **Dado** um vínculo com fim antes do início, **então** a linha fica com erro e não
  conta.
- **AM-9.5** — **Dado** um candidato indígena sem nenhum mês de experiência e 800 h de estágio,
  **então** o estágio vale floor(800 ÷ 8 ÷ 22) = 4 meses = 0,8 ponto, com a conta à mostra. Com
  experiência, o estágio aparece como "não pontuado (só para quem não tem experiência)".
- **AM-9.6** — **Dado** uma ficha concluída, **então** `TB_ANALISE_CURRICULAR` recebe os dias
  de saúde indígena e de atenção básica, e a Classificação passa a desempatar por eles.

### AM-10. Nota, situação e parecer automático

Como **analista**, quero ver a nota, a situação e o parecer se atualizarem enquanto preencho, e
inserir observações prontas, para não redigir o parecer à mão.

- **AM-10.1** — **Dado** a nota ≥ corte da regra de classificação (8,0 no 28/2026) e o checklist
  completo, **então** o selo é "Habilitado" e o parecer começa por "Candidato(a) HABILITADO(A)…",
  com a distribuição dos pontos.
- **AM-10.2** — **Dado** a nota abaixo do corte, **então** o selo é "Não habilitado (nota de
  corte)" e o parecer cita o corte e o item do edital.
- **AM-10.3** — **Dado** que escolho "Textos prontos › Sem vínculo com o SUS", **então** o texto
  com o item do edital entra nas observações e no parecer.
- **AM-10.4** — **Dado** uma nota apurada abaixo da declarada, **quando** tento concluir sem
  observação, **então** a ficha pede a observação naquele critério.
- **AM-10.5** — **Dado** o parecer, **quando** clico em "Copiar parecer", **então** o texto vai
  para a área de transferência.

### AM-11. Rascunho, concluir e próxima

Como **analista**, quero que a ficha salve sozinha e que "Concluir e próxima" grave e abra a seguinte,
para trabalhar em sequência sem perder nada.

- **AM-11.1** — **Dado** uma mudança na ficha, **então** em alguns segundos aparece "Salvo às
  HH:MM", só depois de o banco confirmar.
- **AM-11.2** — **Dado** que outra pessoa salvou a mesma ficha antes, **quando** salvo, **então** o
  banco recusa e aparece "Esta ficha mudou desde que você abriu", com o botão "Recarregar".
- **AM-11.3** — **Dado** que concluo, **então** o responsável é quem está logado e a data é a de
  hoje (Brasília); não há campo para digitar nenhum dos dois.
- **AM-11.4** — **Dado** uma ficha concluída e não sorteada para revisão, **então** ela fica
  Concluída e, com o edital em "MONITORA", `TB_ANALISE_CURRICULAR` recebe a situação, a etapa, as
  parciais, a nota, os desempates e o parecer.
- **AM-11.5** — **Dado** o edital em "Comparação", **então** nada é gravado em
  `TB_ANALISE_CURRICULAR`.

### AM-12. Revisão configurável por edital

Como **coordenação**, quero escolher como as fichas do edital são revisadas, e como **revisor**,
quero validar ou devolver as que me cabem, para equilibrar qualidade e esforço em cada edital.

- **AM-12.1** — **Dado** a regra do edital, **quando** configuro a revisão, **então** posso
  combinar: amostra com X% (o percentual que eu escolher, com mínimo por analista), todas as fichas,
  só as inabilitações (e/ou as não habilitadas), as divergentes do declarado, as com sinal de
  vínculo ou parentesco, as que entraram pela linha que anda, duplo-cego, ou nenhuma revisão.
- **AM-12.2** — **Dado** amostra de 10% + inabilitações, **então** pelo menos 10% das fichas de
  cada analista e todas as inabilitadas vão para "Para revisar"; o sorteio guarda a semente.
- **AM-12.3** — **Dado** que mudo o percentual no meio do edital, **então** a mudança vale só para
  as fichas concluídas dali em diante, e a versão da regra registra.
- **AM-12.4** — **Dado** uma ficha que eu mesmo analisei, **então** não consigo validá-la.
- **AM-12.5** — **Dado** que devolvo, **então** o motivo é obrigatório, a ficha volta ao analista
  como "Revisar" e o painel conta "Em revisão".

### AM-12b. Distribuição configurável por edital

Como **coordenação**, quero escolher por edital entre "Pegar próximo" e a distribuição inicial, e
poder redistribuir, para organizar a equipe do jeito de cada edital.

- **AM-12b.1** — **Dado** o modo "Pegar próximo", **então** os analistas pegam as fichas na ordem
  da pré-classificação, e o botão "Distribuir" fica só para redistribuir.
- **AM-12b.2** — **Dado** o modo "Distribuição inicial" e 300 fichas na linha com 3 analistas,
  **quando** distribuo em partes iguais, **então** a prévia mostra 100 para cada um e só grava ao
  confirmar; o botão "Pegar próximo" não aparece para os analistas.
- **AM-12b.3** — **Dado** qualquer modo, **quando** redistribuo uma ficha com motivo, **então** a
  troca entra no histórico, e fichas "Em análise" ou concluídas não são mexidas sem a minha escolha.
- **AM-12b.4** — **Dado** que troco o modo no meio do edital, **então** as fichas já atribuídas
  continuam com quem estão.

### AM-13. Histórico imutável

Como **coordenação**, quero ver quem mudou o quê em cada ficha, sem poder apagar, para responder a
recursos e auditorias.

- **AM-13.1** — **Dado** uma ficha, **então** o histórico mostra cada versão (ação, quem, quando,
  motivo) e permite comparar duas.
- **AM-13.2** — **Dado** qualquer tentativa de alterar ou apagar o histórico no banco, **então** é
  recusada (`42501`).

### AM-14. CPF mascarado e registro de acesso

Como **coordenação**, quero que o CPF apareça mascarado e que todo "Mostrar" e toda abertura de
anexo fiquem registrados, para cumprir a LGPD.

- **AM-14.1** — **Dado** uma ficha, **então** o CPF aparece como `***.456.789-**`.
- **AM-14.2** — **Dado** que clico em "Mostrar", **então** o CPF aparece por 60 s e o acesso fica
  em `TL_ACESSO_FICHA_ANALISE` (quem, quando, o quê; nunca o valor).
- **AM-14.3** — **Dado** um leitor, **então** ele não vê CPF nem anexos, só a ficha concluída.
- **AM-14.4** — **Dado** "Abrir na Empregare", **então** o acesso também é registrado.

### AM-15. Piloto em comparação e virada

Como **admin**, quero rodar um edital (o piloto é de **Projetos**, decidido em 05/10/2026) em comparação com a planilha e depois virá-lo para o MONITORA
sem perder entrevistas, recursos e aprovados, para trocar o processo com segurança.

- **AM-15.0** — **Dado** o edital em "Comparação", **então** a nota declarada e a linha de corte do
  MONITORA são comparadas com as da aba APTOS PARA ANÁLISE da planilha da vaga.
- **AM-15.1** — **Dado** o edital em "Comparação", **então** a coordenação vê o relatório planilha ×
  MONITORA por candidato (situação, parciais, desempates, nota) e as divergências.
- **AM-15.2** — **Dado** que o edital ainda está ativo na `DIM_EDITAIS` da planilha, **quando**
  tento virar, **então** o banco recusa e diz o que fazer primeiro.
- **AM-15.3** — **Dado** a virada, **então** as linhas da planilha do edital passam para a origem do
  MONITORA **com o mesmo id**, e entrevistas, recursos e aprovados continuam ligados.
- **AM-15.4** — **Dado** a virada, **então** as fichas são pré-preenchidas com o que a planilha
  tinha e marcadas "importada da planilha".

### AM-16. Painel de Análises continua

Como **leitor**, quero que o painel de Análises curriculares continue igual, para acompanhar o
edital, venha a análise da planilha ou do MONITORA.

- **AM-16.1** — **Dado** um edital em "MONITORA", **então** os indicadores, as pendências, a carga
  por responsável e a evolução diária contam as fichas publicadas como contam as da planilha.
- **AM-16.2** — **Dado** uma análise do MONITORA, **então** não existe "Data no futuro" (a data é a
  do sistema).
- **AM-16.3** — **Dado** uma ficha concluída, **então** a Classificação recebe as parciais, a nota,
  a situação, os tempos em saúde indígena e atenção básica, o PcD e a data de nascimento (para o
  "60 anos ou mais" na data de corte), e a ficha mostra a nota da Empregare e a origem da convocação
  só como referência.

---

## Depois

(A antiga AM-17, "Distribuir em lote", entrou no MVP como AM-12b.)

### AM-18. Reabrir antes da publicação

Como **coordenação**, quero reabrir uma ficha concluída, com motivo, enquanto a preliminar não foi
publicada, para corrigir erros antes do resultado.

- **AM-18.1** — **Dado** a preliminar não publicada, **quando** reabro com motivo, **então** a
  ficha volta a "Em análise" e o histórico registra.
- **AM-18.2** — **Dado** a preliminar publicada, **então** o banco recusa e indica o recurso.

### AM-19. Ficha no recurso

Como **parecerista do recurso**, quero abrir a ficha da análise na gaveta do recurso, para fundamentar
o parecer sem pedir a planilha.

- **AM-19.1** — **Dado** um recurso, **quando** clico em "Ver ficha da análise", **então** vejo a
  ficha (checklist, critérios, vínculos, observações, histórico), só para leitura.
- **AM-19.2** — **Dado** um ajuste aprovado, **então** a ficha mostra "Nota alterada pelo recurso
  nº X".

### AM-20. Anexos dentro do MONITORA

Como **analista**, quero abrir os comprovantes ao lado da ficha, sem entrar na Empregare, para
analisar mais rápido.

- **AM-20.1** — **Dado** os anexos baixados pelo robô, **quando** clico no comprovante de um item,
  **então** ele abre ao lado, por um link que vale 60 s, e o acesso é registrado.
- **AM-20.2** — **Dado** a data de descarte prevista vencida, **então** o anexo some do
  armazenamento e a ficha mostra "Anexo descartado em DD/MM/AAAA".

### AM-21. "Em análise" no painel e indicadores da equipe

Como **coordenação**, quero ver "Em análise" separado de Pendente no painel, e a produtividade por
analista, para acompanhar o andamento.

- **AM-21.1** — **Dado** fichas em análise, **então** o painel mostra o indicador "Em análise".
- **AM-21.2** — **Dado** um período, **então** vejo, por analista, as fichas por dia, o tempo
  mediano por ficha, as devoluções na revisão e os motivos de inabilitação mais comuns.

### AM-22. Duplo-cego

Como **coordenação**, quero, num edital sensível, duas análises independentes de cada ficha, para
reduzir o viés.

- **AM-22.1** — **Dado** a regra em duplo-cego, **então** cada ficha recebe dois analistas, e um
  não vê a análise do outro.
- **AM-22.2** — **Dado** uma divergência acima do limite, **então** a ficha vai ao revisor, que
  escolhe qual vale ou devolve.

### AM-23. Imprimir a ficha

Como **coordenação**, quero imprimir ou salvar em PDF a ficha concluída, para anexar ao processo
quando preciso.

- **AM-23.1** — **Dado** uma ficha concluída, **quando** clico em "Imprimir", **então** sai a ficha
  com o parecer, sem CPF completo, e a impressão é registrada.

### AM-24. Desligar as planilhas

Como **admin**, quero desligar o simulador, o web app, os gatilhos e as cargas das planilhas quando
não houver mais edital nelas, para acabar com a cadeia frágil.

- **AM-24.1** — **Dado** nenhum edital ativo em "PLANILHA", **então** a tela de Status das
  atualizações mostra que as cargas das planilhas podem ser desligadas, com o passo a passo.
- **AM-24.2** — **Dado** o desligamento feito, **então** as RPCs de carga e o staging saem do banco
  numa migration, e `apps-script/` sai do repositório.
