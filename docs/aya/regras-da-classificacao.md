# Regras da Classificação

A tela de Classificação mostra só rótulos, números e botões; o porquê das regras fica aqui, para a
Aya explicar. Fontes: `src/modulos/classificacao/`, `src/lib/classificacao/` (motor, regra,
catálogo, vagas, sorteio e exportação) e as migrations `20261002150000_classificacao.sql` e
`20261002150500_liga_aba_classificacao.sql`. Regras de exemplo dos editais 83/2026 e 100/2026:
`supabase/correcoes/20261002-regras-de-classificacao-83-e-100.sql`.

## Tela de Classificação

**perguntas:** tela de classificacao | aba classificacao | para que serve classificacao | para que serve a tela de classificacao | para que serve a classificacao
**resposta:** A Classificação monta as listas de um edital — preliminar (avaliação documental), convocação para entrevista e resultado final — com a regra que o gestor daquele edital decidiu. Cada lista traz a classificação geral e a de cada modalidade, os eliminados com o motivo e, ao abrir um candidato, a explicação da posição. Os avisos do topo apontam dados que faltam (entrevista sem análise, candidato convocado sem entrevista, sem data de nascimento para o critério de 60 anos…). "Gerar" registra a lista; "Exportar" sai em PDF, DOCX ou XLSX. Leitor vê; Editor de Classificação muda a regra, gera, publica e registra sorteio ou decisão.
**fonte:** src/modulos/classificacao/; supabase/migrations/20261002150000_classificacao.sql
**abrir:** classificacao

## Regra de classificação do edital

**perguntas:** regra de classificacao | como funciona a regra de classificacao | como funciona a regra de classificacao do edital | versao da regra | versoes da regra | regra do edital
**resposta:** No MONITORA não há regra de classificação fixa: cada edital tem a sua, decidida pelo gestor do edital na aba Classificação › Regra. Ela define as etapas consideradas, a composição da nota (componentes, pesos, casas decimais e arredondamento), as notas mínimas e eliminatórias (documental, por nível da vaga, total da entrevista e por competência), os critérios de desempate e a ordem deles, o empate final, as modalidades, a convocação para entrevista e o rodapé das listas. Salvar sempre cria uma versão nova (da segunda em diante, com o motivo); as anteriores ficam no histórico e podem voltar ao formulário. Cada lista gerada guarda a versão usada.
**fato:** No MONITORA, a regra de classificação é de cada edital, versionada: salvar cria versão nova e a lista gerada guarda a versão usada.
**fonte:** src/lib/classificacao/regra.js; supabase/migrations/20261002150000_classificacao.sql
**abrir:** classificacao

## Critérios de desempate

**perguntas:** criterios de desempate | como funcionam os criterios de desempate | desempate da classificacao | catalogo de criterios | ordem do desempate
**resposta:** O empate é sempre na nota publicada (com as casas decimais da regra). Se a regra manda desempatar naquela lista, valem os critérios escolhidos do catálogo, na ordem em que o gestor os arrumou (arrastando): 60 anos ou mais na data de corte, ser comprovadamente indígena (pontuação étnica validada maior que zero), maior tempo de experiência na saúde indígena, maior tempo na atenção básica, maior nota documental, maior nota da entrevista, maior idade, pontuações por critério, tempo de experiência profissional e PcD. Cada critério tem direção (sim antes de não, maior primeiro…). Quem não tem o dado de um critério fica atrás de quem tem, e isso vira aviso. O que sobra empatado depois de todos os critérios segue o empate final.
**fonte:** src/lib/classificacao/catalogo.js; src/lib/classificacao/motor.js
**abrir:** classificacao

## Empate final e sorteio

**perguntas:** empate final | como funciona o empate final | como funciona o empate final e o sorteio | sorteio do empate | semente do sorteio | decisao manual do empate
**resposta:** Quando o empate continua depois de todos os critérios, vale o que o gestor escolheu na regra: sorteio registrado, ordem de inscrição (código menor primeiro), mesma posição (1º, 2º, 2º, 3º ou 1º, 2º, 2º, 4º) ou decisão manual com justificativa. No sorteio, a semente é gerada no servidor ou informada pelo gestor; a ordem é a crescente do SHA-256 de "semente:id da análise", e ficam gravados semente, ordem, quem e quando — qualquer pessoa com a semente refaz a conta. Refazer um sorteio exige justificativa e guarda o anterior. Enquanto um empate espera sorteio ou decisão, a lista mostra os empatados na mesma posição, o aviso pede o registro e a lista não pode ser marcada como publicada.
**fato:** No MONITORA, o empate final é escolha do gestor do edital (sorteio registrado e reprodutível, ordem de inscrição, mesma posição ou decisão manual justificada).
**fonte:** src/lib/classificacao/sorteio.js; supabase/migrations/20261002150000_classificacao.sql
**abrir:** classificacao

## 60 anos ou mais

**perguntas:** 60 anos ou mais | como e calculado o criterio de 60 anos | como e calculado o criterio de 60 anos ou mais | idoso no desempate | data de corte da idade
**resposta:** O critério "60 anos ou mais" usa a idade na data de corte — o último dia de inscrição, como mandam os editais (Estatuto da Pessoa Idosa) —, não a idade de hoje. A data de corte é a da regra do edital; sem ela, o fim do período de inscrição no cronograma do edital. Quem faz 60 anos no último dia de inscrição conta; no dia seguinte, não. Sem data de nascimento, o candidato fica atrás de quem tem e a tela avisa; sem data de corte, a tela avisa que o critério não pode ser aplicado.
**fonte:** src/lib/classificacao/catalogo.js; src/lib/classificacao/dados.js
**abrir:** classificacao

## Nota final e eliminação

**perguntas:** nota final da classificacao | como e calculada a nota final da classificacao | motivo da eliminacao | eliminados da classificacao | por que o candidato foi eliminado
**resposta:** A nota final é a soma dos componentes da regra (nota documental, nota da entrevista e, se o edital usar, a nota da autodeclaração), cada um com o seu peso, arredondada nas casas da regra. A entrevista é ligada à análise do candidato só pelo identificador da análise — nunca pelo nome, como fazia a planilha antiga, que perdia candidatos sem avisar; nota com vírgula é lida como número. Fica fora da lista, com o motivo: não habilitado na análise, sem nota documental, abaixo da nota mínima documental (inclusive por nível da vaga), fora do limite de convocação, sem entrevista, ausente, inapto, sem nota da entrevista, abaixo do mínimo da entrevista, competência abaixo do mínimo ou nota eliminatória numa competência.
**fonte:** src/lib/classificacao/motor.js
**abrir:** classificacao

## Convocação para entrevista

**perguntas:** convocacao para entrevista da classificacao | limite da convocacao | como funciona o limite da convocacao | quantos candidatos sao convocados
**resposta:** A lista de convocação são os primeiros da lista preliminar até o limite da regra: N vezes as vagas imediatas da vaga, ou, na vaga só de cadastro reserva, até a posição definida (ex.: 5 vezes as vagas e até a 10ª no 83/2026; 6 vezes e até a 5ª no 100/2026). Cargos podem ter exceção (Enfermeiro e Técnico de Enfermagem: 10 vezes e até a 20ª). Se houver empate no limite, a regra diz se os empatados entram todos. No resultado final, quem estava dentro do limite e não tem entrevista lançada vira aviso.
**fonte:** src/lib/classificacao/motor.js
**abrir:** classificacao

## Modalidades e vagas

**perguntas:** modalidades da classificacao | cotista na lista geral | lista por modalidade | remanejamento de vaga | acumulo de cotas
**resposta:** Cada modalidade da regra (PcD, pretos e pardos, indígenas, quilombolas…) tem percentual, lista própria, posição que recomeça em 1º ou mantém a da geral, se o cotista aparece também na geral e para onde vai a vaga reservada sem candidato. Na lista final, as vagas da ampla vão para os primeiros da geral (cotista aprovado na ampla não ocupa vaga reservada); cada reserva vai para os primeiros da modalidade; a reserva que sobra segue o remanejamento da regra e, por fim, a ampla. Com mais de uma cota, a regra diz se o candidato fica em todas, só na de maior percentual ou em PcD e mais uma (vale no resultado final). As vagas por modalidade vêm do quadro de vagas do edital.
**fonte:** src/lib/classificacao/motor.js; src/lib/classificacao/vagas.js
**abrir:** classificacao

## Gerar e publicar a lista

**perguntas:** gerar lista de classificacao | como gerar a lista de classificacao | publicar lista de classificacao | hash da lista
**resposta:** "Gerar" registra a lista no banco: o retrato (por vaga, posição, nome, nota e modalidade; eliminados com motivo; só o nome, sem CPF), a versão da regra usada, quem e quando, e o SHA-256 do retrato, calculado no banco. Se a regra mudou desde que a tela abriu, o banco recusa e pede para gerar de novo. "Marcar como publicada" registra quem e quando publicou; lista com empate esperando sorteio ou decisão não pode ser publicada.
**fonte:** supabase/migrations/20261002150000_classificacao.sql; src/lib/classificacao/exportacao.js
**abrir:** classificacao

## Exportar a lista de classificação

**perguntas:** exportar a lista de classificacao | como exportar a lista de classificacao | exportar classificacao | pdf da classificacao | docx da classificacao
**resposta:** A exportação sai de uma lista já gerada, no padrão das publicações: por vaga, o cabeçalho "VAGA código - cargo - lotação - N vagas (x AC + y Pretos e Pardos + CR)" e as colunas Classificação, Nome e Nota (com Modalidade na geral quando as sublistas vêm no mesmo documento); vaga sem candidato traz "Não houve candidatos aptos."; no fim, o rodapé da regra. Só o nome do candidato, sem CPF. Formatos: PDF (pela impressão do navegador, "Salvar como PDF"), DOCX e XLSX (planilhas Classificação e Eliminados). Dá para exportar tudo ou só a geral ou uma modalidade.
**fonte:** src/lib/classificacao/exportacao.js
**abrir:** classificacao

## Quem pode mudar a classificação

**perguntas:** quem pode mudar a regra de classificacao | quem pode gerar a lista de classificacao | permissao classificacao
**resposta:** A aba Classificação usa a permissão "Classificação" (Configurações › Acessos): Leitor vê as listas, a regra e as explicações; Editor salva a regra do edital, gera e publica listas e registra sorteio ou decisão. Por padrão, o administrador é Administrador; gestor de edital e coordenador, Editor; contratador, usuário e jurídico, Leitor. Também vale a área e o recorte da coordenação do edital.
**fonte:** supabase/migrations/20261002150000_classificacao.sql; src/lib/access-roles.js
**abrir:** config:acessos
