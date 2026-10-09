# Regras da Classificação

A tela de Classificação mostra só rótulos, números e botões; o porquê das regras fica aqui, para a
Aya explicar. Fontes: `src/modulos/classificacao/`, `src/lib/classificacao/` (motor, regra,
catálogo, vagas, sorteio, exportação e o documento oficial em `documento-sei.js` e `documento-docx.js`) e as migrations `20261002150000_classificacao.sql` e
`20261002150500_liga_aba_classificacao.sql` e `20261002170000_classificacao_lista_da_entrevista.sql`.
Regras dos editais: `supabase/correcoes/20261002-regras-de-classificacao-83-e-100.sql` (83/2026 e
100/2026) e `supabase/correcoes/20261002-regras-de-classificacao-todos-os-editais.sql` (os demais, lidas
dos PDFs oficiais).

## Tela de Classificação

**perguntas:** tela de classificacao | aba classificacao | para que serve classificacao | para que serve a tela de classificacao | para que serve a classificacao
**resposta:** A Classificação monta as listas de um edital, na ordem das publicações da AgSUS — avaliação documental e de títulos, convocação para entrevista, resultado da entrevista e resultado final — com a regra que o gestor daquele edital decidiu. Cada lista traz a classificação geral e a de cada modalidade, os eliminados com o motivo e, ao abrir um candidato, a explicação da posição. Os avisos do topo apontam dados que faltam (entrevista sem análise, candidato convocado sem entrevista, sem data de nascimento para o critério de 60 anos…). "Gerar" registra a lista; dela sai o documento oficial — "Copiar para o SEI", "Como fica no SEI", "Baixar DOCX" com papel timbrado, PDF — e a planilha XLSX. A tela tem três visões, no topo: Listas, Agenda (a agenda das entrevistas dos convocados) e Regra. Leitor vê; Editor de Classificação muda a regra, gera, publica e registra sorteio ou decisão.
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
**resposta:** O empate é sempre na nota publicada (com as casas decimais da regra). Se a regra manda desempatar naquela lista, valem os critérios escolhidos do catálogo, na ordem em que o gestor os arrumou (arrastando): 60 anos ou mais na data de corte, ser comprovadamente indígena (pontuação étnica validada maior que zero), maior tempo de experiência na saúde indígena, maior tempo na atenção básica, maior nota documental, maior nota da entrevista, maior idade, pontuações por critério, tempo de experiência profissional e PcD. Da leitura de todos os editais entraram mais quatro: tempo em média e alta complexidade, tempo em saúde digital, maior escolaridade e nota de conhecimentos específicos da prova — enquanto a análise não grava esses dados, eles não separam ninguém e a tela avisa. Cada critério tem direção (sim antes de não, maior primeiro…). Quem não tem o dado de um critério fica atrás de quem tem, e isso vira aviso. O que sobra empatado depois de todos os critérios segue o empate final.
**fonte:** src/lib/classificacao/catalogo.js; src/lib/classificacao/motor.js
**abrir:** classificacao

## Desempate da entrevista é na Classificação

**perguntas:** desempate da entrevista na classificacao | empate na nota da entrevista | onde desempato a entrevista | editar na classificacao | criterios de desempate do roteiro sumiram | desempate do roteiro
**resposta:** O desempate de quem empata na nota da entrevista é o da regra de classificação do edital: uma fonte só, aqui em Classificação › Regra (critérios do catálogo, a ordem e o empate final). O Painel de entrevistas marca os empatados e leva para cá; Conduzir entrevistas › Preparar e o editor do roteiro mostram os mesmos critérios só para ler, com "Editar na Classificação". O roteiro não tem mais critérios próprios (o texto antigo ficou guardado, sem uso). Na lista Resultado da entrevista, o empate que sobra fica na mesma posição; o desempate vale no resultado final.
**fato:** O desempate da entrevista se configura em Classificação › Regra; o roteiro só mostra os critérios.
**fonte:** src/lib/convocacao-da-entrevista.js; src/modulos/entrevistas/conducao.jsx; supabase/migrations/20261008130000_conduzir_entrevistas_no_menu.sql
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
**resposta:** A lista de convocação são os primeiros da avaliação documental até o limite da regra: N vezes as vagas imediatas da vaga, ou, na vaga só de cadastro reserva, até a posição definida (ex.: 5 vezes as vagas e até a 10ª no 83/2026; 6 vezes e até a 5ª no 100/2026). Cargos podem ter exceção (Enfermeiro e Técnico de Enfermagem: 10 vezes e até a 20ª). Se houver empate no limite, a regra diz se os empatados entram todos. No resultado final, quem estava dentro do limite e não tem entrevista lançada vira aviso. É a única convocação do sistema: Conduzir entrevistas › Preparar convoca a partir da última lista de convocação gerada aqui, e só quem está nela; por isso, gere a lista antes de convocar e gere de novo quando a regra ou as vagas mudarem.
**fonte:** src/lib/classificacao/motor.js; supabase/migrations/20261005150000_convocacao_unica_da_entrevista.sql
**abrir:** classificacao

## Modalidades e vagas

**perguntas:** modalidades da classificacao | cotista na lista geral | lista por modalidade | remanejamento de vaga | acumulo de cotas
**resposta:** Cada modalidade da regra (PcD, pretos e pardos, indígenas, quilombolas, trans…) tem percentual, lista própria, posição que recomeça em 1º ou mantém a da geral, se o cotista aparece também na geral, para onde vai a vaga reservada sem candidato e, se for uma reserva conjunta (como a PPIQ de 30% dos editais de 2025), quais modalidades ela reúne — quem declarou pretos e pardos, indígena ou quilombola entra nessa lista. Na lista final, as vagas da ampla vão para os primeiros da geral (cotista aprovado na ampla não ocupa vaga reservada); cada reserva vai para os primeiros da modalidade; a reserva que sobra segue o remanejamento da regra e, por fim, a ampla. Com mais de uma cota, a regra diz se o candidato fica em todas, só na de maior percentual ou em PcD e mais uma (vale no resultado final). As vagas por modalidade vêm do quadro de vagas do edital; quando ele só traz o total, da configuração de convocação do edital (Lista de aprovados › Convocação) ou dos percentuais da regra, pela mesma conta da convocação.
**fonte:** src/lib/classificacao/motor.js; src/lib/classificacao/vagas.js
**abrir:** classificacao

## Gerar e publicar a lista

**perguntas:** gerar lista de classificacao | como gerar a lista de classificacao | publicar lista de classificacao | hash da lista
**resposta:** "Gerar" registra a lista no banco: o retrato (por vaga, posição, nome, nota e modalidade; eliminados com motivo; só o nome, sem CPF), a versão da regra usada, quem e quando, e o SHA-256 do retrato, calculado no banco. Se a regra mudou desde que a tela abriu, o banco recusa e pede para gerar de novo. "Marcar como publicada" registra quem e quando publicou; lista com empate esperando sorteio ou decisão não pode ser publicada.
**fonte:** supabase/migrations/20261002150000_classificacao.sql; src/lib/classificacao/exportacao.js
**abrir:** classificacao

## Exportar a lista de classificação

**perguntas:** exportar a lista de classificacao | como exportar a lista de classificacao | exportar classificacao | pdf da classificacao | xlsx da classificacao
**resposta:** Tudo sai de uma lista já gerada (registrada com a versão da regra e o hash). Antes, escolha em "Exportar" o recorte — geral e modalidades no mesmo documento (como o 100/2026), só a geral, só uma modalidade (como o 83/2026, um documento por modalidade) ou só os eliminados — e, em "Publicação", se é o resultado preliminar ou o final (depois dos recursos). Saídas: "Copiar para o SEI" (o principal), "Como fica no SEI" (prévia e textos), "Baixar DOCX" (Word com papel timbrado), PDF (impressão da prévia, "Salvar como PDF") e XLSX (planilhas Classificação e Eliminados, para conferência). Só o nome do candidato, sem CPF, inscrição ou nascimento.
**fonte:** src/lib/classificacao/exportacao.js; src/lib/classificacao/documento-sei.js
**abrir:** classificacao

## Documento oficial da lista (modelo do SEI)

**perguntas:** documento oficial da classificacao | modelo do sei da classificacao | como fica o documento da lista | estrutura do documento da lista | padrao das publicacoes da agsus
**resposta:** O documento segue o Comunicado Externo que a AgSUS publica no SEI (editais 83/2026 e 100/2026): "Brasília, na data da assinatura digital." à direita; o título em caixa alta (ex.: RESULTADO PRELIMINAR - ETAPA DE ANÁLISE CURRICULAR, CONVOCAÇÃO PARA ENTREVISTA, RESULTADO FINAL - ETAPA DE ENTREVISTA, RESULTADO FINAL - PROCESSO SELETIVO); "1. DISPOSIÇÕES PRELIMINARES" com os itens 1.1, 1.2…; uma tabela por vaga, com o cabeçalho "VAGA código - cargo - lotação - unidade - N vagas (x AC + y Pretos e Pardos + CR)" ou "- Cadastro Reserva", todas as vagas, inclusive as vazias ("Não houve candidatos aptos."); e "2. DISPOSIÇÕES FINAIS". Colunas padrão, enxutas: avaliação documental — Classificação, Nome, (Modalidade) e Nota Final (as parciais da regra ficam disponíveis, desmarcadas, na aba Colunas); eliminados — Nome, Nota e Justificativa; convocação — uma tabela Nº, NOME, Vaga, (Modalidade), DATA e HORA, com data e hora da agenda das entrevistas salva (sem agenda, em branco para preencher no SEI); entrevista — Classificação, NOME, NOTA (empate na mesma posição); resultado final — CLASSIFICAÇÃO, NOME, NOTA FINAL, e no fim o rodapé da regra. O timbrado, a assinatura eletrônica e o rodapé "título (nº SEI) SEI processo / pg. N" quem põe é o SEI.
**fato:** No MONITORA, o documento da lista de classificação segue o Comunicado Externo publicado no SEI; timbrado, assinatura e rodapé ficam com o SEI.
**fonte:** src/lib/classificacao/documento-sei.js
**abrir:** classificacao

## Copiar para o SEI

**perguntas:** copiar para o sei | como colar a lista no sei | colar a classificacao no sei | a lista colou sem tabela no sei | numeracao sumiu no sei
**resposta:** Gere a lista, escolha o recorte e a publicação e clique em "Copiar para o SEI". No SEI, crie o documento (Comunicado Externo), abra o editor, clique no corpo e cole (Ctrl+V); depois confira, preencha data e hora na convocação se não houver agenda salva, e assine. O que é copiado: o HTML com as classes de estilo do próprio SEI (Item_Nivel1 e Item_Nivel2 numeram sozinhos "1." e "1.1.", Texto_Centralizado_Maiusculas, Tabela_Texto_Centralizado…) e tabelas com borda e largura em porcentagem, além do texto puro numerado para quem cola fora do SEI. Se o navegador não liberar o formato com tabelas, a cópia vai só como texto e a tela avisa — aí use o DOCX. Se a numeração dos itens não aparecer no SEI, o editor removeu as classes ao colar: aplique o estilo "Item_Nivel1/Item_Nivel2" pelo menu de estilos ou use o DOCX.
**fonte:** src/lib/classificacao/documento-sei.js; src/modulos/classificacao/documento-no-navegador.js
**abrir:** classificacao

## Textos do documento por edital

**perguntas:** textos do documento do sei | editar disposicoes preliminares | mudar o titulo do documento da lista | processo sei da classificacao | como fica no sei
**resposta:** Em "Como fica no SEI" aparecem a prévia (o timbrado simulado, o texto e as tabelas como ficam no SEI) e os textos que o gestor ajusta antes de copiar ou baixar: número do edital, processo SEI (vai no rodapé do Word), unidade por extenso (ex.: "Distrito Sanitário Especial Indígena Xingu (DSEI Xingu)"), autoridade do item 1.1 (ex.: "por intermédio da Diretoria de Atenção Integral à Saúde, no uso das atribuições que lhe foram conferidas pela Designação nº 28/2026/PRES/AgSUS"), local e data (vazia = "na data da assinatura digital"), o título e as disposições preliminares e finais do modelo daquela lista. Cada linha é um item; ">" no começo vira subitem (1.3.1) e ">>" sub-subitem (1.3.3.1); **texto** fica em negrito; campos entre chaves são trocados pelo do edital ({edital}, {unidade}, {fase}, {notas_minimas}…). Os padrões vêm das publicações do 83/2026 e do 100/2026; as notas mínimas do 1.3 vêm da regra. "Salvar no edital" grava na regra (nova versão, motivo "Textos do documento oficial (SEI)"), sem mudar a classificação; "Restaurar o padrão" volta ao texto das publicações.
**fonte:** src/modulos/classificacao/documento.tsx; src/lib/classificacao/regra.js
**abrir:** classificacao

## Prévia "Como fica no SEI" (tela grande, zoom e abas)

**perguntas:** previa do sei pequena | como aumentar a previa do sei | zoom da previa do sei | tela cheia como fica no sei | ocultar textos da previa | abas dados e textos | previa no celular
**resposta:** "Como fica no SEI" abre quase na tela toda, com a folha A4 inteira no centro. Ela começa em "Ajustar" (a folha cabe na largura); − e + mudam o zoom de 50% a 200%, e "Ajustar" volta a caber. O botão de tela cheia, no topo, usa a tela inteira; Esc ou o X fecham. Os ajustes ficam num painel à esquerda, em três abas: "Dados" (número do edital, processo SEI, unidade, autoridade do 1.1, local e data), "Textos" (título e disposições preliminares e finais) e "Colunas" (as colunas da tabela de cada vaga); "Ocultar painel" recolhe o painel e a folha cresce, "Textos e colunas" traz de volta. A prévia muda enquanto você digita. No celular fica uma coluna: os textos em cima e a prévia embaixo. "Restaurar o padrão" e "Salvar no edital" ficam no rodapé, junto de "Baixar DOCX" e "Copiar para o SEI", sempre à vista.
**fonte:** src/modulos/classificacao/documento.tsx; src/lib/classificacao/escala-da-previa.ts
**abrir:** classificacao

## Colunas da tabela no documento do SEI

**perguntas:** colunas do documento do sei | escolher colunas da tabela | tirar coluna formacao academica | tirar cursos de aperfeicoamento | mostrar pontuacoes parciais no sei | mudar a ordem das colunas | personalizar colunas da classificacao | coluna situacao cadastro reserva
**resposta:** Em "Como fica no SEI", a aba "Colunas" escolhe o que aparece na tabela de cada vaga e em que ordem. O padrão é enxuto: Classificação, Nome, Modalidade de Concorrência (só na tabela geral, quando há modalidades) e Nota Final; nos eliminados, Nome, Nota e Justificativa. Em "Outras colunas" ficam as que dá para incluir: as pontuações parciais da avaliação documental que a regra publica (Formação Acadêmica, Cursos de Aperfeiçoamento, Experiência Profissional, Pontuação Étnica) e, no resultado final, a Situação (dentro das vagas ou cadastro reserva). Marque ou desmarque; as setas ou arrastar mudam a ordem. Classificação e Nome (e a Justificativa dos eliminados) têm cadeado: são obrigatórias. A prévia, o "Baixar DOCX" e o "Copiar para o SEI" mudam na hora; "Salvar no edital" grava a escolha daquela publicação na regra do edital (nova versão) e "Restaurar o padrão", com a aba Colunas aberta, volta às colunas padrão. Na convocação para entrevista as colunas são fixas (Nº, NOME, Vaga, DATA e HORA). Não há coluna de inscrição, CPF ou nascimento: o documento é público e leva só o nome.
**fato:** No MONITORA, as colunas das tabelas do documento do SEI são escolhidas por publicação na aba Colunas e gravadas na regra do edital.
**fonte:** src/modulos/classificacao/colunas-do-documento.tsx; src/lib/classificacao/colunas-do-documento.js
**abrir:** classificacao

## DOCX com papel timbrado

**perguntas:** docx da classificacao | word da lista de classificacao | papel timbrado da classificacao | baixar docx
**resposta:** "Baixar DOCX" gera o mesmo documento em Word para anexar ou ajustar: no cabeçalho, o logo da AgSUS e o nome, endereço e site da agência (Configurações › Marca › Documentos oficiais); no corpo, o título, os itens numerados com o recuo do SEI, as tabelas por vaga e a linha final "Brasília, <data por extenso>."; no rodapé, o nome do documento, o processo SEI e o número da página. Não tem bloco de assinatura: quem assina é o SEI.
**fonte:** src/lib/classificacao/documento-docx.js; src/lib/cabecalho-dos-documentos.js
**abrir:** classificacao

## Listas por etapa

**perguntas:** listas da classificacao | quais listas a classificacao gera | resultado da entrevista na classificacao | lista da entrevista | resultado preliminar e final da classificacao
**resposta:** São quatro listas, como a AgSUS publica. 1) Avaliação documental e de títulos: quem passou na documental, por vaga e por modalidade, pela nota documental (com as parciais), e os eliminados com o motivo — a mesma lista vale como resultado preliminar ou final da etapa, antes e depois dos recursos. 2) Convocação para entrevista: os primeiros até o limite da regra (N vezes as vagas, ou até a k-ésima no cadastro reserva), com os empatados no limite se a regra mandar. 3) Resultado da entrevista: os convocados aptos pela nota da entrevista; o empate que sobra fica na mesma posição (o desempate do edital é do resultado final); os eliminados da entrevista com o motivo. 4) Resultado final: documental + entrevista (ou a composição da regra), desempate, vagas imediatas e cadastro reserva.
**fonte:** src/lib/classificacao/motor.js; src/lib/classificacao/exportacao.js
**abrir:** classificacao

## Regras dos editais lidas dos PDFs

**perguntas:** de onde vieram as regras dos editais | modelo do edital | regra lida do edital | conferir a regra do edital
**resposta:** As regras de todos os editais com PDF no site da AgSUS foram lidas dos editais e das retificações oficiais e cadastradas como versão 1, com o motivo "Regra lida do edital (PDF oficial) — conferir". A maioria segue um texto-base (modelo): Saúde Indígena 2026 no padrão do 83/2026, no padrão do 100/2026 (ART e lote) e o do Sanitarista; Saúde Indígena 2025 com entrevista e só curricular; Sede 2025 (entrevista só apto/inapto, barema, prova); e os de Projetos. Em cada regra, "importação" guarda o modelo, os PDFs lidos, a pontuação e o que ficou em aberto. O gestor confere e decide sobretudo o empate depois de todos os critérios (os editais não definem; ficou "mesma posição"). Editais com prova objetiva ainda não têm a prova na nota final.
**fato:** No MONITORA, a regra inicial de cada edital foi lida do PDF oficial e marcada para o gestor conferir; o empate final ficou "mesma posição" até ele decidir.
**fonte:** supabase/correcoes/20261002-regras-de-classificacao-todos-os-editais.sql
**abrir:** classificacao

## Entrevista só com parecer

**perguntas:** entrevista so com parecer | entrevista apto inapto sem nota | entrevista sem nota na classificacao
**resposta:** Nos editais em que a entrevista só diz apto ou inapto (os da Sede de 2025), a regra marca "Entrevista só com parecer": o apto segue sem nota, o inapto é eliminado e quem não tem parecer também sai, com o motivo; a nota final é só a da avaliação documental, e a lista do resultado da entrevista segue a ordem da documental.
**fonte:** src/lib/classificacao/regra.js; src/lib/classificacao/motor.js
**abrir:** classificacao

## Vagas da classificação e a convocação do edital

**perguntas:** vagas por modalidade na classificacao | classificacao e convocacao | configuracao de convocacao na classificacao | de onde vem o numero de vagas da classificacao
**resposta:** A Classificação e a Lista de aprovados › Convocação usam a mesma conta das vagas por modalidade. Vale, nesta ordem: o quadro de vagas do edital quando traz a divisão; senão, a configuração de convocação do edital (quadro manual da vaga ou o total de vagas imediatas pelo modelo de cotas); senão, os percentuais da regra de classificação. A tela mostra de onde vieram as vagas da vaga e avisa quando os percentuais da regra e os do modelo de convocação divergem ou quando o total de vagas não bate. Quem fica em cada lista e para onde vai a vaga reservada sem candidato é da regra de classificação; a ordem de chamada para contratar é da Convocação.
**fonte:** src/lib/classificacao/convocacao-do-edital.js; src/lib/configuracao-de-convocacao.js
**abrir:** classificacao

## Quem pode mudar a classificação

**perguntas:** quem pode mudar a regra de classificacao | quem pode gerar a lista de classificacao | permissao classificacao | nao vejo a aba classificacao
**resposta:** A aba Classificação usa a permissão "Classificação" (Configurações › Acessos): Leitor vê as listas, a regra e as explicações; Editor salva a regra do edital, gera e publica listas e registra sorteio ou decisão. Por padrão, o administrador é Administrador; gestor de edital e coordenador, Editor; contratador, usuário e jurídico, Leitor. Também vale a área e o recorte da coordenação do edital.
**fonte:** supabase/migrations/20261002150000_classificacao.sql; src/lib/access-roles.js
**abrir:** config:acessos

## Nota alterada pelo recurso

**perguntas:** nota alterada pelo recurso | recurso mudou a nota na classificacao | ajuste aprovado na classificacao | ha recursos aprovados depois desta lista | gere de novo a lista | lista desatualizada
**resposta:** No MONITORA, a Classificação aplica os ajustes da pontuação aprovados em recurso por cima da nota da análise (a planilha não muda): o valor novo de cada componente substitui o da análise e o candidato aparece com o selo "Recurso nº X" na tabela; a explicação da posição diz o que mudou ("Nota alterada pelo recurso nº X: …") e o retrato da lista gerada guarda o número do recurso. Se a análise mudar depois do ajuste, a tela avisa e vale o ajuste. Quando há ajuste aprovado (ou cancelado depois de aprovado) depois da última lista gerada, a tela avisa "Há recursos aprovados depois desta lista — gere de novo". O documento do SEI segue o modelo das publicações, sem marca.
**fonte:** src/lib/classificacao/motor.js (aplicarAjustes); src/lib/classificacao/ajustes.js; src/modulos/classificacao/listas.jsx; supabase/migrations/20261005130000_recurso_ajusta_pontuacao.sql
**abrir:** classificacao

## Publicar como lista de aprovados

**perguntas:** botao publicar como lista de aprovados na classificacao | resultado final vira lista de aprovados | classificacao e lista de aprovados | a classificacao alimenta a lista de aprovados
**resposta:** No MONITORA, o resultado final da Classificação é a fonte da Lista de aprovados. Em "Resultado final", o Editor de Classificação gera a lista e clica em "Publicar como lista de aprovados": a confirmação mostra, em relação à lista de aprovados vigente, quantos entram, saem e mudam de posição e o que é preservado (status, matrícula, sub judice, anexos); quem não foi reconhecido aparece para revisão. A lista nova entra em vigor com posição, nota, modalidade, vaga e situação (dentro das vagas ou cadastro reserva) de cada candidato; a anterior fica no histórico. "Marcar como publicada" continua sendo só o registro da publicação no SEI.
**fato:** No MONITORA, o resultado final da Classificação vira a lista de aprovados pelo botão "Publicar como lista de aprovados".
**fonte:** src/modulos/classificacao/publicar-aprovados.jsx; src/lib/publicacao-de-aprovados.js; supabase/migrations/20261005160000_lista_de_aprovados_da_classificacao.sql
**abrir:** classificacao

## Botões Gerar, exportar e publicar desabilitados

**perguntas:** por que nao aparece o botao gerar | botao gerar nao aparece | botao publicar desabilitado | nao consigo publicar a lista de classificacao | copiar para o sei desabilitado | nao consigo exportar a classificacao | publicar como lista de aprovados nao aparece
**resposta:** "Gerar", "Marcar como publicada" e "Publicar como lista de aprovados" só aparecem para quem tem Editor em Classificação, com a área e o edital; "Gerar" fica desabilitado enquanto o edital não tem regra salva. Copiar para o SEI, Como fica no SEI, Baixar DOCX, PDF e XLSX ficam desabilitados até existir uma lista gerada naquela etapa: gere primeiro. "Marcar como publicada" e "Publicar como lista de aprovados" ficam desabilitados enquanto houver empate esperando sorteio ou decisão, e "Publicar como lista de aprovados" só existe na lista Resultado final.
**fonte:** src/modulos/classificacao/listas.jsx; src/lib/access-roles.js (canEditClassificacao)
**abrir:** classificacao

## Siglas das modalidades e cadastro reserva

**perguntas:** siglas das modalidades | o que e ac | ampla concorrencia | o que e pp | pretos e pardos | o que e pi | o que e pq | quilombolas | o que e pcd | pessoa com deficiencia | o que e ppiq | o que e cr | cotas da classificacao
**resposta:** Nas listas e nos documentos, AC é ampla concorrência; PcD, pessoas com deficiência; PP, pretos e pardos; PI, indígenas; PQ, quilombolas; e PPIQ, a reserva conjunta de pretos e pardos, indígenas e quilombolas de alguns editais. CR é cadastro reserva: quem passou, mas ficou além das vagas imediatas, ou a vaga que só tem cadastro reserva (no cabeçalho, "- Cadastro Reserva"). O cotista também concorre na ampla, e quem é chamado pela ampla não gasta a vaga reservada. Percentual, lista própria e remanejamento de cada modalidade são da regra de classificação do edital.
**fonte:** src/lib/classificacao/catalogo.js (MODALIDADES_CONHECIDAS); src/lib/classificacao/motor.js; src/lib/classificacao/vagas.js
**abrir:** classificacao

## Nota da ART e lote de convocação

**perguntas:** o que e art | nota da art | autodeclaracao de requisitos e titulos | lote | triado
**resposta:** ART é a nota da Autodeclaração de Requisitos e Títulos, a nota do questionário da Empregare. Na Classificação ela pode entrar como componente da nota final ("Nota da autodeclaração (ART)") quando a regra do edital usar, e o recurso deferido pode ajustá-la. A lista provisória do ranqueamento pela ART e a linha de corte (o lote de convocação para a avaliação documental) ainda não são geradas pelo MONITORA: a classificação começa na avaliação documental dos candidatos do lote (situação Triado ou Aprovado na análise).
**fonte:** src/lib/classificacao/catalogo.js (COMPONENTES_DA_NOTA); supabase/correcoes/20261002-regras-de-classificacao-todos-os-editais.sql (importacao.em_aberto)
**abrir:** classificacao

## Nome da versão da regra de classificação

**perguntas:** nome da versao da classificacao | nome da regra de classificacao | renomear a regra de classificacao | trocar o nome da versao da classificacao | regra v2 da classificacao | nome desta versao classificacao
**resposta:** A regra de classificação também pode ter um nome por versão (3 a 80 caracteres). Ao salvar na aba Regra da Classificação, o campo "Nome desta versão" vem com a sugestão — "Classificação do edital 93/2026" mais o começo do motivo — editável (vazio grava sem nome). O seletor de editais, a barra do topo, a lista de versões e a linha da lista gerada mostram o nome em destaque e o número discreto ("Decisão CORES · v3"); sem nome, "Versão 3". "Renomear", em cada versão, troca só o nome, com motivo de 10 a 500 caracteres; a configuração não muda e a troca fica no histórico. Renomeia quem tem Editor na Classificação (e o administrador global).
**fato:** No MONITORA, a versão da regra de classificação tem nome opcional, trocável com motivo sem mudar a configuração.
**fonte:** src/lib/nome-da-versao.ts; supabase/migrations/20261008180000_nome_das_versoes_das_regras.sql (salvar_regra_classificacao, renomear_versao_regra_classificacao)
**abrir:** classificacao

## Hora de nascimento no desempate

**perguntas:** hora de nascimento | hora de nascimento no desempate | certidao de nascimento no desempate | 23h59min59s | 23:59:59 | empate na maior idade | nasceram no mesmo dia | onde informo a hora de nascimento
**resposta:** Quando o empate chega ao critério "maior idade" e as pessoas nasceram no mesmo dia, decide a hora de nascimento da certidão enviada na inscrição: quem nasceu mais cedo é mais velho e fica à frente (edital 93/2026, itens 6.11.5 e 6.11.6). Sem certidão, vale 23h59min59s — a pessoa fica como a mais nova daquele dia. A planilha da análise curricular e a Empregare não trazem a hora; quem informa é o analista, na Classificação: abra o candidato na lista e use "Hora de nascimento (certidão)". O campo só aparece para quem está nesse empate (ou já tem hora), e a tela avisa "Empate decidido pela hora de nascimento". "Sem certidão" tira a hora e volta a valer 23h59min59s. Cada mudança fica no histórico (quem, quando, antes e depois); gere a lista de novo depois de informar. Se ainda assim empatar (mesmo dia e mesma hora, ou as duas sem certidão), vale o empate final da regra.
**fato:** Na maior idade, entre quem nasceu no mesmo dia, vale a hora da certidão; sem certidão, 23h59min59s.
**fonte:** src/lib/classificacao/numeros.js; src/lib/classificacao/motor.js; src/modulos/classificacao/hora-de-nascimento.tsx; supabase/migrations/20261009130000_hora_de_nascimento_na_classificacao.sql
**abrir:** classificacao

## Desempate na lista preliminar (edital 93/2026)

**perguntas:** desempate na lista preliminar | empatados na mesma posicao na preliminar | classificacao preliminar do 93 | desempate do edital 93 | avaliacao documental 93 empate | por que todos ficaram em primeiro
**resposta:** Na lista "Avaliação documental — resultado preliminar", o empate na nota segue a regra do edital: "mesma posição" ou "critérios da regra". No 93/2026, cuja análise documental foi feita pela planilha, a lista deixava os empatados na mesma posição — na vaga de Enfermeiro do Trabalho, 8 pessoas com 45 pontos ficavam todas em 1º. O edital manda listar os aprovados pela ordem de classificação (8.2.10.10) e desempatar pelo item 10.1: a) 60 anos ou mais na data de corte (fim das inscrições, 29/09/2026); b) maior tempo de experiência profissional comprovado (os dias da planilha, o mesmo cálculo para todos); c) maior idade, com a hora da certidão. A correção da regra do 93 passa a preliminar para "critérios da regra" (nova versão, com o motivo). A ordem também muda quem entra no limite da convocação (5 × as vagas). Reprovado na planilha sai com o motivo "não habilitado" e, se a nota também ficou abaixo de 15 (8.2.6), a justificativa diz os dois. A lista publica a nota e as parciais (formação, cursos, experiência) lado a lado; quando as colunas de pontuação da planilha não somam a nota — no 93 a nota segue o barema e as colunas não —, a tela avisa "Parciais que não somam a nota documental" por vaga: confira a planilha antes de publicar (a ordem segue a nota).
**fato:** No 93/2026, a lista preliminar desempata pelo item 10.1 (60+, tempo de experiência, maior idade com a hora da certidão).
**fonte:** supabase/correcoes/20261009-classificacao-93-desempate-e-quadro.sql; tests/classificacao-93-desempate.test.js
**abrir:** classificacao
