# Regras da Avaliação documental

A tela Avaliação documental (view `avaliacao-documental`) é onde a avaliação documental e de
títulos passa a ser feita dentro do MONITORA, no lugar das planilhas de vaga e do simulador. A tela
mostra só rótulos, números e botões; o porquê fica aqui. Fontes: `src/modulos/avaliacao-documental/`,
`src/lib/avaliacao-documental/` (regra, conta, nota declarada e equipe), as migrations
`20261006090000_avaliacao_documental_permissao_e_menu.sql`, `20261006100000_regra_da_analise.sql` e
`20261006110000_pre_classificacao_e_lote.sql` (pré-classificação),
`20261006120000_fichas_fila_e_reserva.sql` (fila, distribuição e reserva),
`20261006120500_lote_por_nota_minima.sql` (lote pela nota mínima e desempates),
`20261007130000_conteudo_da_ficha.sql` (o conteúdo da ficha), o job Python
`scripts/pre_classificacao/` com a conta em `python/monitora/avaliacao_documental/`,
os modelos em `supabase/correcoes/20261006-modelos-da-regra-da-analise.sql` e o desenho em
`docs/analises-no-monitora/`.

## Tela de Avaliação documental

**perguntas:** avaliacao documental | tela de avaliacao documental | para que serve avaliacao documental | para que serve a avaliacao documental | modulo avaliacao documental | avaliacao documental e de titulos
**resposta:** A Avaliação documental é o módulo de trabalho da etapa "Avaliação Documental e de Títulos": escolhido o edital, a coordenação cadastra a regra da avaliação daquele edital (blocos por documento ou pergunta da Empregare, eliminatórios com o item do edital, critério étnico com aldeias, escolaridade por nível, cursos, experiência, nota declarada, lote, distribuição, revisão e os textos do parecer) e diz quem analisa, quem revisa e quem coordena (aba Equipe). Há a regra, a equipe, a Pré-classificação (a Lista Provisória por ART e o lote de convocação de cada vaga, com as listas oficiais PROVISORIA e LOTE) e a Fila (as fichas de quem está no lote, a distribuição entre os analistas e a reserva da ficha aberta); o conteúdo da ficha (documentos, títulos, vínculos e nota) chega na fase seguinte. O resultado continua aparecendo no Painel das análises.
**fonte:** src/modulos/avaliacao-documental/; docs/analises-no-monitora/plano-de-construcao.md
**abrir:** avaliacao-documental

## Painel das análises e Avaliação documental

**perguntas:** qual a diferenca entre o painel das analises e a avaliacao documental | painel das analises e avaliacao documental | diferenca entre painel e avaliacao | painel ou avaliacao documental | onde analiso o candidato
**resposta:** São duas entradas do menu. O Painel das análises (a tela que antes se chamava Análises curriculares) é só leitura: indicadores, pendências, carga por responsável, evolução e a lista das análises, com a permissão Painel das análises. A Avaliação documental é o trabalho: regra da avaliação, equipe e, nas próximas fases, a Provisória por ART, o lote, a fila e a ficha do candidato, com a permissão própria "Avaliação documental". Quando um edital passar a ser avaliado no MONITORA, a ficha concluída grava na mesma base que o Painel das análises lê.
**fato:** No MONITORA, o Painel das análises é leitura (permissão analises) e a Avaliação documental é o trabalho da avaliação (permissão avaliacao_documental).
**fonte:** docs/analises-no-monitora/README.md; supabase/migrations/20261006090000_avaliacao_documental_permissao_e_menu.sql
**abrir:** avaliacao-documental

## Regra da avaliação documental

**perguntas:** regra da avaliacao documental | como funciona a regra da avaliacao documental | regra da avaliacao | regra da analise | versoes da regra da avaliacao | conferir a regra | regra conferida
**resposta:** Cada edital tem a sua regra da avaliação, e nada fica fixo no sistema: os pesos (por exemplo, indígena +8 e aldeia +6 no 100/2026, +7 e +5 no 28/2026), os títulos por nível, as faixas de cursos, a experiência (por mês ou por período de N meses, com ou sem o mínimo exigido), os efeitos de cada situação e os textos do parecer vêm da regra. A regra nasce de um modelo ou do zero e fica "Conferir"; salvar sempre cria uma versão nova (da segunda em diante com o motivo, de 10 a 2.000 caracteres), as anteriores ficam no histórico e não mudam, e quem coordena marca a versão vigente como "Conferida". Salvar outra versão volta a regra para "Conferir". A nota mínima não fica aqui: é a da regra de classificação do edital.
**fato:** No MONITORA, a regra da avaliação documental é de cada edital, versionada e imutável por versão; a nota mínima é a da regra de classificação.
**fonte:** src/lib/avaliacao-documental/regra.js; supabase/migrations/20261006100000_regra_da_analise.sql
**abrir:** avaliacao-documental

## Modelos da regra

**perguntas:** quais sao os modelos da regra da avaliacao | modelos da regra | modelo da regra da avaliacao | criar a regra a partir do modelo | proj26 curricular | modelo do simulador
**resposta:** Há três modelos para começar: PROJ26-CURRICULAR (Projetos, sem critério étnico, lido do edital 93/2026: titulação 5/8/10, cursos por faixa de horas e experiência a cada 6 meses além do mínimo), SI26-INTERIOR-SUL (o do simulador do DSEI Interior Sul, edital 28/2026: indígena +7 e aldeia da lista +5, cursos 0,5/0,3/0,2, experiência 0,2 por mês com teto 10 e o estágio de indígena) e SI26-100 (o questionário do 100/2026, nível superior: indígena +8 e aldeia +6, e a declaração irregular zera os pontos étnicos sem eliminar). "Criar a partir do modelo" faz a versão 1 do edital; num edital que já tem regra, "Carregar um modelo no formulário" leva o modelo ao formulário para salvar como versão nova, com o motivo.
**fonte:** supabase/correcoes/20261006-modelos-da-regra-da-analise.sql
**abrir:** avaliacao-documental

## Blocos, situações e efeitos

**perguntas:** blocos da ficha | bloco da regra | efeito do bloco | situacoes do bloco | motivos padronizados | o que elimina | eliminatorio
**resposta:** Na regra, cada documento ou pergunta da Empregare vira um bloco: título, item do edital, as perguntas ligadas pelo começo do enunciado (ex.: "Você é indígena e mora em aldeia"), uma condição opcional (só para indígena, só para uma modalidade) e o efeito de cada situação — Conforme, Não conforme, Não enviado (Não se aplica não tem efeito). Os efeitos são: elimina (inapto, nota 0), zera os pontos do bloco, tira só os pontos de aldeia, só registro, encaminha à heteroidentificação ou à perícia, e segue na ampla. Cada bloco tem motivos padronizados com o texto que vai ao parecer e o item do edital; um motivo com efeito próprio vale no lugar do efeito da situação (ex.: "Aldeia fora do DSEI" só tira a aldeia).
**fonte:** src/lib/avaliacao-documental/catalogo.js; src/lib/avaliacao-documental/pontuacao.js
**abrir:** avaliacao-documental

## Perguntas da Empregare e nota declarada

**perguntas:** perguntas da empregare na regra | ligar pergunta ao bloco | nota declarada | divergencia da art | respostas encontradas | pontos por nivel | experiencia por nivel
**resposta:** Para quem coordena, a aba Regra lista as perguntas da última carga do robô da Empregare nas vagas do edital, com as respostas encontradas e quantas vezes cada uma aparece — respostas que aparecem uma vez só não são mostradas, para não expor texto livre. Dali se liga a pergunta a um bloco ou se cria a pontuação da nota declarada: cada resposta vale pontos (ou meses × pontos por mês), por parcial. Quando a mesma resposta vale pontos diferentes conforme o nível da vaga, marque "Pontos por nível" na pergunta: aparece uma coluna de pontos para Superior, Técnico e Médio (no 93/2026, "1 ano" de experiência vale 5 no nível superior e 4 no técnico e no médio). O nível sai do nome do cargo da vaga ("(Nível Superior)", "Técnico de…") ou da regra de classificação do edital. Essa nota recalculada (na tela, "Nota recalculada" na aba Regra e a coluna "Recalculada" na Pré-classificação) só confere a ART, a "Nota declarada (ART)" do questionário da Empregare; se divergir além da tolerância, vira aviso, e a ordem da Provisória continua pela ART.
**fonte:** src/lib/avaliacao-documental/nota-declarada.js; supabase/migrations/20261006100000_regra_da_analise.sql; supabase/migrations/20261007140000_declarada_por_nivel.sql
**abrir:** avaliacao-documental

## Como a regra acha a pergunta da Empregare

**perguntas:** pergunta pelo enunciado | numero da pergunta muda | pergunta 17 | pergunta da experiencia | comeco do enunciado | pergunta ambigua | casa com mais de uma coluna | alternativas da pergunta
**resposta:** No arquivo da Empregare cada pergunta é uma coluna "Pergunta N - enunciado", e o número N da mesma pergunta muda de vaga para vaga no mesmo edital (no 93/2026 a experiência é a Pergunta 10, 11 ou 12, conforme o cargo). Por isso, na regra, escreva o começo do enunciado — por exemplo "Experiência Profissional" —, sem acento ou caixa importando; ele não confunde com "Anexe o comprovante de Experiência Profissional…", que começa diferente. O começo do nome ("Pergunta 15 -") ainda funciona, mas só serve quando o número não muda. Quando o próprio enunciado muda de questionário para questionário, separe as alternativas com ";" (ex.: "Selecione sua Experiência Profissional; Marque a pontuação referente"): vale qualquer uma. Se o texto casar com mais de uma coluna, a regra não usa nenhuma e a Pré-classificação avisa que a pergunta é ambígua; aí escreva um começo que só ela tenha.
**fonte:** src/lib/avaliacao-documental/nota-declarada.js; python/monitora/avaliacao_documental/nota_declarada.py; supabase/correcoes/20261007-perguntas-pelo-texto.sql
**abrir:** avaliacao-documental

## Testar a regra com um candidato fictício

**perguntas:** como testar a regra com um candidato ficticio | testar com um candidato ficticio | previa da regra | simular a regra | candidato ficticio
**resposta:** No fim da aba Regra, "Testar com um candidato fictício" calcula na hora, sobre o formulário (mesmo sem salvar), a nota, as parciais, a situação (Apto, Inapto por requisito, Inapto por nota mínima) e o parecer de um candidato inventado: nível da vaga, modalidade, indígena e aldeia, a situação e o motivo de cada bloco, títulos, cursos, vínculos e observações prontas. Nada é gravado. A nota mínima vem da regra de classificação do edital; sem ela, dá para digitar uma só para a prévia. A conta oficial, em lote, para a Provisória e o lote é feita pela base Python e confere com os mesmos casos de teste.
**fonte:** src/modulos/avaliacao-documental/previa.jsx; tests/fixtures/avaliacao-documental/casos-de-pontuacao.json
**abrir:** avaliacao-documental

## Experiência, títulos e cursos na regra

**perguntas:** experiencia na regra da avaliacao | como conta a experiencia | sobreposicao de vinculos | estagio de indigena | titulos por nivel | cursos por faixa | meses adicionais
**resposta:** A experiência une os vínculos aceitos que se sobrepõem (e emenda o que começa no dia seguinte), conta os dias com o primeiro e o último, e os meses são os dias ÷ 30 (só os inteiros). A pontuação é por mês ou por período completo (ex.: a cada 6 meses além do mínimo exigido), com teto, e pode mudar com o nível da vaga. Abaixo do mínimo exigido, elimina ou só registra, conforme a regra. O estágio de indígena sem experiência vale horas ÷ 8 ÷ 22 meses. Os desempates (saúde indígena, atenção básica…) saem em anos de 365 dias, meses de 30 e dias. Os títulos valem pelo nível da vaga (o maior, ou somados se a regra disser), e os cursos pela faixa de carga horária, com teto.
**fonte:** src/lib/avaliacao-documental/pontuacao.js
**abrir:** avaliacao-documental

## Equipe da avaliação documental

**perguntas:** quem pode entrar na equipe da avaliacao documental | equipe da avaliacao documental | equipe do edital | analista e revisor | coordenacao da avaliacao | gestor do edital na avaliacao | quem coordena a avaliacao
**resposta:** A coordenação de um edital na Avaliação documental é o gestor do edital (grupo Gestor de edital com Administrador em Avaliação documental e acesso ao edital, automaticamente, sem cadastro) ou quem estiver como Coordenação na equipe; o administrador global também coordena. Só a coordenação muda a regra e a equipe. Na aba Equipe entram analistas e revisores (precisam de Editor em Avaliação documental) e coordenadores (precisam de Administrador), no edital todo ou numa vaga, com limite de fichas opcional; a pessoa também precisa ver o edital (área e coordenação). Se faltar a permissão, o sistema diz qual — ela é dada em Configurações › Acessos. Tirar alguém da equipe pede o motivo e só desativa a linha, que fica no histórico.
**fato:** Na Avaliação documental, o gestor do edital coordena automaticamente; analista e revisor precisam de Editor e coordenador de Administrador em Avaliação documental.
**fonte:** src/lib/avaliacao-documental/equipe.js; supabase/migrations/20261006100000_regra_da_analise.sql
**abrir:** avaliacao-documental

## Permissão da Avaliação documental

**perguntas:** permissao da avaliacao documental | quem ve a avaliacao documental | acesso a avaliacao documental | nao vejo a avaliacao documental | niveis da avaliacao documental
**resposta:** A Avaliação documental tem permissão própria, separada do Painel das análises: Leitor vê a regra e a equipe dos editais que enxerga; Editor trabalha nas fichas dos editais em que está na equipe (nas próximas fases); Administrador coordena os editais em que é gestor ou está como coordenação. No começo, o administrador global, o Gestor de edital e o Coordenador têm Administrador e os demais grupos não veem o item — quem vai analisar recebe Editor em Configurações › Acessos. Vale também a área e o recorte da coordenação do edital.
**fonte:** supabase/migrations/20261006090000_avaliacao_documental_permissao_e_menu.sql; src/lib/access-roles.js
**abrir:** config:acessos

## Aldeias do DSEI

**perguntas:** aldeias do dsei | lista de aldeias | aldeia da lista | mora em aldeia | carregar aldeias
**resposta:** O critério étnico só soma os pontos de aldeia quando a aldeia está na lista oficial do DSEI do edital (se a regra pedir a lista). A aba Regra mostra quantas aldeias o DSEI tem; só o administrador global carrega ou atualiza a lista ("Atualizar a lista"), uma por linha, no formato NOME ou NOME-(polo), com a fonte. A lista enviada passa a ser a vigente: as aldeias que saíram são desativadas, não apagadas.
**fonte:** supabase/migrations/20261006100000_regra_da_analise.sql
**abrir:** avaliacao-documental

## Pré-classificação: Provisória por ART

**perguntas:** pre-classificacao | pre classificacao | provisoria por art | lista provisoria | lista geral de classificacao provisoria | ranqueamento eletronico | como e montada a provisoria | ordem da provisoria | aba pre-classificacao
**resposta:** A aba Pré-classificação mostra, por vaga, a Lista Geral de Classificação Provisória (item 8.3.1): os inscritos que o robô da Empregare trouxe, em ordem decrescente da ART (a nota do questionário da Empregare, "24,0/30,0"). Quem não tem ART no arquivo entra pela nota declarada recalculada pela regra, com aviso. Empate na ART segue o desempate da regra (por padrão: idoso de 60 anos ou mais, o mais velho primeiro, e depois a candidatura mais antiga) e, por último, o código do candidato, para a ordem nunca variar. A Provisória tem caráter provisório e classificatório e não valida documentos: a conferência é na ficha, na etapa seguinte. Quem calcula é um job Python que roda no GitHub Actions e grava o resultado pronto; a tela só lê.
**fato:** No MONITORA, a Provisória por ART é calculada pelo job Python da pré-classificação (scripts/pre_classificacao/) e gravada em TB_PRE_CLASSIFICACAO; a tela só lê.
**fonte:** python/monitora/avaliacao_documental/pre_classificacao.py; supabase/migrations/20261006110000_pre_classificacao_e_lote.sql
**abrir:** avaliacao-documental

## Eliminação automática na Provisória

**perguntas:** eliminacao automatica | eliminados automaticos | por que o candidato foi eliminado na provisoria | cancelado na provisoria | reprovado na empregare | recusou o termo | saiu do arquivo da empregare
**resposta:** Antes de ordenar, cada inscrito passa pelas regras de eliminação automática da regra do edital, na ordem em que estão lá: por exemplo, a coluna SITUAÇÃO igual a "Cancelado" (cancelou a inscrição), a situação do questionário diferente de "Finalizado", REPROVADO = "Sim" na Empregare ou a resposta "Não estou de acordo" no termo de responsabilidade. A primeira que vale dá o motivo, que aparece em "Eliminados" na vaga e na lista oficial. O valor é comparado inteiro, sem diferença de acento e de caixa. Se a coluna que a regra cita não vier no arquivo, ninguém é eliminado por ela e a vaga mostra o aviso. Quem estava na lista e sumiu do arquivo da Empregare vira eliminado com o motivo "Saiu do arquivo da Empregare".
**fonte:** src/lib/avaliacao-documental/pre-classificacao.js; python/monitora/avaliacao_documental/pre_classificacao.py
**abrir:** avaliacao-documental

## O que é a ART (nota declarada)

**perguntas:** sigla art | art na avaliacao documental | nota declarada art | nota declarada (art) | sigla art na fila | declarado na ficha | art e declarado
**resposta:** ART é a Autodeclaração de Requisitos e Títulos: a nota que a Empregare calcula a partir das respostas do questionário de inscrição, antes de alguém conferir os documentos. Nas telas da Avaliação documental ela aparece como "Nota declarada (ART)" (ou "Nota declarada", com a sigla na dica, nas colunas estreitas): na Fila, no topo da ficha, na lateral da ficha ("mínima 15 · Nota declarada (ART) 13") e na Pré-classificação. É por ela que sai a Provisória. Na ficha, a coluna "Declarado" de cada bloco é a parte da ART daquele bloco (o que a resposta vale pela regra); somadas, dão a nota declarada. O Apurado é o que vale depois da conferência dos documentos.
**fato:** No MONITORA, ART (Autodeclaração de Requisitos e Títulos) é a nota que a Empregare calcula pelo questionário, antes da conferência; a tela a chama de "Nota declarada (ART)".
**fonte:** src/lib/avaliacao-documental/tela-da-pre-classificacao.js (ROTULO_DA_ART, DICA_DA_ART)
**abrir:** avaliacao-documental

## Divergência entre a ART e a nota declarada

**perguntas:** art diferente da nota declarada | diverge | art x declarada | nota declarada diferente | por que diverge | muitas divergencias | nivel da vaga nao identificado
**resposta:** A ART (Nota da Autodeclaração de Requisitos e Títulos) é a nota que a Empregare calcula com as respostas do questionário. Se a regra tiver a nota declarada configurada (aba Regra), o sistema recalcula a nota pelas mesmas respostas e compara: diferença acima da tolerância da regra aparece como "diverge" na linha do candidato e no contador "ART × recalculada" (na tabela da vaga, a coluna "Recalculada" ao lado da "Nota declarada (ART)"). Só compara quando a nota declarada do candidato está completa: toda pergunta da nota declarada achada sem ambiguidade, a resposta dada mapeada na regra e, na pergunta com pontos por nível, o nível da vaga conhecido (resposta em branco, ou pergunta que não existe no questionário da vaga, vale zero, como na ART). Faltando um pedaço, não conta divergência. Se o nível da vaga não for identificado, a pergunta por nível fica fora da conta e a vaga mostra o aviso para conferir o cargo ou a regra de classificação. Muitas divergências de uma vez costumam indicar que falta uma pergunta na nota declarada da regra (no 93/2026, a experiência). É só um aviso para a coordenação conferir o questionário ou a regra; a ordem da Provisória continua pela ART.
**fonte:** src/lib/avaliacao-documental/nota-declarada.js; python/monitora/avaliacao_documental/nota_declarada.py; src/lib/avaliacao-documental/pre-classificacao.js
**abrir:** avaliacao-documental

## Lote de convocação e linha de corte

**perguntas:** lote de convocacao | tamanho do lote | linha de corte | quem entra no lote | como e calculado o lote | lote por modalidade | empatados no lote | tamanho do lote por vaga | sugerido
**resposta:** Só quem está no lote de convocação (item 8.4) segue para a avaliação documental; o último do lote é a linha de corte. O tamanho de cada vaga vem, nesta ordem: do número definido para a vaga na aba Pré-classificação (campo "Tamanho do lote", que vira versão nova da regra com motivo); do número fixo da regra; ou do múltiplo das vagas imediatas do quadro de vagas, com o cadastro reserva contando como mais uma vaga quando a regra inclui o CR (ex.: 3 × (11 + CR) = 36). Sem quadro de vagas não há como sugerir: a vaga mostra o aviso e ninguém entra até alguém definir o tamanho. No lote por modalidade, a ampla concorrência pega os primeiros de todos e depois cada cota pega os seus, entre os que ainda não entraram. Com "inclui os empatados", quem tem a mesma nota do último do lote também entra.
**fato:** No MONITORA, o tamanho do lote de uma vaga é o definido para a vaga, o número fixo da regra ou o múltiplo das vagas imediatas do quadro (o cadastro reserva conta como mais uma vaga quando a regra inclui o CR).
**fonte:** src/lib/avaliacao-documental/pre-classificacao.js; python/monitora/avaliacao_documental/pre_classificacao.py
**abrir:** avaliacao-documental

## A linha anda: reposição do lote

**perguntas:** a linha anda | reposicao do lote | quem sai do lote | entrou no lote | lote 2 | novo lote | por que o candidato entrou no lote | inscrito novo acima do corte
**resposta:** Quem entrou no lote só sai eliminado (por exemplo, cancelou a inscrição depois). Quando alguém sai e a regra manda repor ("a linha anda"), o próximo da Provisória entra num lote novo (2, 3…), com o motivo gravado: "Entrou no lugar de 7000654 (Cancelou a inscrição)". Sem reposição na regra, o lugar fica aberto e a vaga avisa. Um inscrito que chega depois com a ART maior não tira ninguém do lote: ele fica fora, e a vaga mostra o aviso "Fora do lote com nota acima da linha de corte". Quem já tem ficha não muda por recálculo: a ficha de quem sai eliminado fica na fila como "Fora do lote", com o motivo, e quem entra ganha ficha nova. Antes das fichas, dá para refazer o lote do zero (modo refazer_lote do job, no GitHub); com ficha aberta, o banco recusa tirar a pessoa do lote. Toda entrada e saída fica no histórico.
**fonte:** python/monitora/avaliacao_documental/pre_classificacao.py; supabase/migrations/20261006110000_pre_classificacao_e_lote.sql
**abrir:** avaliacao-documental

## Recalcular a pré-classificação

**perguntas:** recalcular | recalcular a pre-classificacao | quando a provisoria atualiza | botao recalcular | edital sem regra conferida | pre-classificacao nao atualizou | job da pre-classificacao
**resposta:** A pré-classificação roda sozinha no fim de cada carga do robô da Empregare, para os editais das vagas carregadas. A coordenação do edital também pode clicar em "Recalcular" na aba Pré-classificação (o administrador global usa o "Rodar agora" das Configurações › Status das atualizações, para todos os editais). O botão fica travado enquanto a regra não está conferida ou enquanto o job roda. Depois do clique, a aba diz o que aconteceu: "Recálculo pedido às HH:MM" e, quando o job termina, "Pré-classificação recalculada" (a aba relê sozinha enquanto ele roda; o Atualizar também relê a aba aberta). Se o pedido não sai, aparece "Recálculo não pedido:" com o motivo e o botão volta; "Só na versão publicada" quer dizer que o MONITORA está rodando no computador, onde o pedido ao GitHub não existe. Edital sem regra conferida não é calculado: o job explica no resumo e a aba mostra o aviso "Edital sem regra conferida".
**fonte:** scripts/pre_classificacao/pre_classificacao.py; .github/workflows/pre-classificacao.yml; api/rodar-carga.js
**abrir:** avaliacao-documental

## Listas Provisória e Lote de convocação

**perguntas:** lista provisoria oficial | lote de convocacao oficial | registrar a lista provisoria | publicar o lote | copiar para o sei a provisoria | baixar docx da provisoria | publicar cada reposicao | lista lote
**resposta:** Na aba Pré-classificação, quem coordena o edital (ou quem tem Editor na Classificação) registra a "Lista Geral de Classificação Provisória (ART)" e o "Lote de convocação". Registrar grava um retrato com hash na Classificação (tipos PROVISORIA e LOTE), montado no banco a partir da pré-classificação gravada; depois saem "Copiar para o SEI" e "Baixar DOCX", no mesmo modelo das outras listas (por vaga: classificação, nome e a nota da ART; a Provisória também tem a lista dos eliminados com o motivo). Os textos-padrão citam os itens 8.3.1 e 8.4 e podem ser trocados por edital na regra de classificação. Com "publica cada reposição" na regra, cada lote novo aparece para registrar como um novo Lote de Convocação; sem, aparece só o lote inicial e as reposições ficam registradas no histórico. Registrar exige a regra de classificação do edital; marcar como publicada exige Editor na Classificação.
**fonte:** supabase/migrations/20261006110000_pre_classificacao_e_lote.sql; src/lib/classificacao/documento-sei.js
**abrir:** avaliacao-documental

## Seletor de editais da Avaliação documental

**perguntas:** por que o edital nao aparece na avaliacao documental | editais vigentes | ver os editais concluidos na avaliacao documental | edital concluido nao aparece | seletor de edital da avaliacao
**resposta:** O seletor "Edital" da Avaliação documental mostra só os editais vigentes da área: ativos e que não estão concluídos nem cancelados (a mesma regra dos indicadores do monitoramento). Para ver os outros, marque "Mostrar todos os editais da área". O edital já escolhido continua na lista mesmo que deixe de ser vigente.
**fonte:** src/lib/avaliacao-documental/editais.js; supabase/migrations/20261006120500_lote_por_nota_minima.sql
**abrir:** avaliacao-documental

## Lote pela nota mínima

**perguntas:** lote pela nota minima | nota minima do lote | item 8.2.6 | minimo de 15 pontos | so quem tem 15 pontos | nota minima para a analise curricular
**resposta:** Alguns editais não recortam o lote por "N vezes as vagas": avaliam todos os que alcançam uma nota mínima (o 93/2026, item 8.2.6, avalia quem tem pelo menos 15 pontos). Na aba Regra, o tamanho do lote "Todos com a nota mínima" leva a nota (ao escolher, vem a nota mínima da regra de classificação) e o item do edital. Entram no lote todos os não eliminados com a nota da Provisória (a ART) maior ou igual à mínima; quem chega depois com a nota mínima também entra; quem tem menos não entra no lugar de quem sai. Sem a nota na regra, ninguém entra e a vaga avisa.
**fato:** No MONITORA, o lote pela nota mínima põe na avaliação todos os inscritos não eliminados com a ART a partir da nota mínima da regra.
**fonte:** src/lib/avaliacao-documental/pre-classificacao.js; python/monitora/avaliacao_documental/pre_classificacao.py
**abrir:** avaliacao-documental

## Desempate da Provisória

**perguntas:** desempate da provisoria | criterios de desempate da art | empate na art | item 10.1 | maior experiencia declarada | idade igual ou superior a 60 | maior idade no desempate
**resposta:** Com a mesma ART, a Provisória segue os desempates da regra, na ordem escolhida na aba Regra: 60 anos ou mais (o mais velho primeiro), a maior experiência declarada (a faixa respondida na pergunta da experiência do questionário, achada pelo começo do enunciado, e lida em meses pelo limite de baixo — "6 meses obrigatórios" vale 6, "1 ano e 6 meses" vale 18, "De 1 a 2 anos" vale 12; resposta vazia ("--") ou que não dá para ler fica por último), a maior idade e a candidatura mais antiga. Por último vale sempre o código do candidato. O 93/2026 e o 114/2026 (item 10.1) usam 60 anos ou mais, a experiência declarada (pergunta "Experiência Profissional") e a maior idade; a experiência comprovada entra quando houver a ficha.
**fonte:** src/lib/avaliacao-documental/pre-classificacao.js; python/monitora/avaliacao_documental/pre_classificacao.py
**abrir:** avaliacao-documental

## Fila da avaliação documental

**perguntas:** fila da avaliacao documental | aba fila | etapas da fila | contadores da fila | inscritos no lote pendentes | o que e pendente na fila | em revisao na fila | motivo da eliminacao na fila | exportar csv da fila | ordenar a fila | colunas da fila
**resposta:** A aba Fila mostra, no topo, as etapas com contadores — Inscritos, No lote, Pendentes, Em análise, Em revisão, Concluídas e Eliminados — e cada etapa clicada vira filtro da lista. Cada etapa mostra as colunas que fazem sentido nela: em Eliminados, o código, o nome, a vaga, o motivo da eliminação (ex.: "Cancelou a inscrição") e a nota declarada (ART), quando houver; em Concluídas, a nota, o resultado (Apto ou Inapto), o responsável e a data; em Pendentes e Em análise, a posição, a nota declarada (ART), o responsável e a reserva. A lista é a tabela padrão do sistema: o cabeçalho fica preso no alto ao rolar, clicar no nome da coluna ordena (de novo inverte; a terceira vez volta à ordem da Provisória), a busca por código ou nome fica no alto da tabela, "N de M" diz quantos aparecem do total da etapa, as linhas vêm de 50 em 50 ao rolar e "Exportar CSV" baixa a etapa aberta com as colunas e a ordem da tela. Cada inscrito do lote tem uma ficha: Pendente (na fila, livre ou já com um analista), Em análise (o responsável abriu), Em revisão (a coordenação mandou revisar), Concluída ou Fora do lote (saiu eliminado; a ficha fica, com o motivo). As fichas são abertas sozinhas no fim de cada pré-classificação; a coordenação também tem "Abrir fichas do lote". A lista mostra o nome do candidato a quem tem acesso de leitura à Avaliação documental, nunca o CPF.
**fonte:** src/modulos/avaliacao-documental/fila.jsx; supabase/migrations/20261006120000_fichas_fila_e_reserva.sql
**abrir:** avaliacao-documental

## Pegar próximo e Minhas fichas

**perguntas:** pegar proximo | como pego uma ficha | proxima ficha | minhas fichas | busca por codigo na fila | abrir a ficha pelo codigo
**resposta:** O analista do edital (Editor na Avaliação documental e na equipe como Analista) clica em "Pegar próximo" e recebe a próxima ficha na ordem da Provisória: primeiro as suas (a que já está em análise e as que a coordenação distribuiu), depois a primeira livre das vagas que ele analisa. Duas pessoas nunca recebem a mesma ficha. Quando a regra usa a distribuição inicial, as fichas livres não se pegam (a coordenação distribui), a não ser que a regra deixe livres os que entram depois. "Minhas fichas" filtra as que estão com você; digitar o código do candidato na busca e apertar Enter abre a ficha direto.
**fonte:** supabase/migrations/20261006120000_fichas_fila_e_reserva.sql (pegar_proxima_ficha)
**abrir:** avaliacao-documental

## Distribuição das fichas

**perguntas:** distribuir fichas | distribuicao inicial | redistribuir ficha | devolver a fila | ficha para quem tem menos fichas pendentes | partes iguais entre analistas | limite por analista
**resposta:** A coordenação do edital escolhe fichas na Fila (ou usa "Distribuir as livres") e vê a prévia: quantas cada analista recebe e com quantas fica, antes de gravar. A conta segue a regra do edital: cada ficha, na ordem da Provisória, vai para quem analisa a vaga e tem menos fichas pendentes, respeitando o limite da equipe e, no critério "Até um limite", o limite da regra; o que não cabe fica livre na fila. Dá para mandar tudo para uma pessoa ou devolver à fila. Redistribuir e devolver pedem motivo (10 a 2.000 caracteres), ficam no histórico e a reserva cai; ficha concluída ou fora do lote não é mexida. Se alguém mexeu na ficha depois que a tela leu, nada grava e a tela pede para atualizar. Na distribuição inicial, quem entra no lote depois vai sozinho para quem tem menos pendentes.
**fato:** No MONITORA, a distribuição das fichas dá cada ficha, na ordem da Provisória, ao analista da vaga com menos pendentes, dentro do limite.
**fonte:** src/lib/avaliacao-documental/distribuicao.js; python/monitora/avaliacao_documental/distribuicao.py
**abrir:** avaliacao-documental

## Reserva da ficha

**perguntas:** reserva da ficha | em uso por | ficha em uso | liberar a reserva | ficha presa | so leitura na ficha | quanto tempo dura a reserva
**resposta:** Quem abre a própria ficha fica com a reserva por 15 minutos, renovada sozinha enquanto a ficha está aberta e liberada ao fechar; só quem tem a reserva grava. Quem abre uma ficha em uso vê "Em uso por <nome> desde HH:MM", só para leitura. Se a pessoa saiu sem fechar, a reserva vence sozinha; a coordenação pode liberar antes (na ficha ou em lote, em "Liberar reservas"), com motivo, e isso fica no histórico. Mudar a ficha com uma versão velha é recusado ("mudou desde que você abriu").
**fonte:** supabase/migrations/20261006120000_fichas_fila_e_reserva.sql (reservar_ficha, renovar_reserva, liberar_reserva)
**abrir:** avaliacao-documental

## Filtros salvos da fila

**perguntas:** filtros salvos | salvar filtro da fila | guardar combinacao de filtros | excluir filtro salvo
**resposta:** Na Fila, depois de combinar etapa, vaga, responsável, modalidade e busca, "Salvar filtro" guarda a combinação com um nome (até 30 por pessoa; o mesmo nome troca a anterior). Os filtros salvos são só seus e valem em qualquer edital; o último filtro usado também é lembrado neste navegador.
**fonte:** supabase/migrations/20261006120000_fichas_fila_e_reserva.sql (salvar_filtro_fila)
**abrir:** avaliacao-documental

## Ações em lote da coordenação na fila

**perguntas:** acoes em lote da fila | mandar para revisao | selecionar varias fichas | liberar reservas em lote | analista saiu da equipe com fichas
**resposta:** A coordenação marca fichas na lista e escolhe: Distribuir (com a prévia), Liberar reservas ou Mandar para revisão (fichas pendentes ou em análise; motivo obrigatório). Toda ação pede confirmação e fica no histórico da ficha. Um analista com fichas pendentes ou em análise só sai da equipe depois que elas forem redistribuídas ou devolvidas à fila.
**fonte:** supabase/migrations/20261006120000_fichas_fila_e_reserva.sql
**abrir:** avaliacao-documental

## Modo de análise: a ficha em tela cheia

**perguntas:** modo de analise | ficha em tela cheia | voltar a fila | ficha anterior | proxima ficha da lista | anterior e proxima | esc fecha a ficha | recarreguei a pagina e a ficha | atualizar perde a ficha
**resposta:** Ao abrir uma ficha (Abrir, Pegar próximo ou o código na busca + Enter), ela ocupa toda a área de conteúdo — fica só o menu lateral — e a lista some até você voltar. O topo fica preso no alto: "← Voltar à fila", a vaga, o candidato (código e nome), a posição, a nota declarada (ART), a modalidade, a situação, o responsável, a reserva e "Anterior / Próxima", que andam pelas fichas da lista como ela estava filtrada e ordenada na Fila ("2 de 87"). Trocar de ficha ou voltar salva antes o que falta; se não der para salvar, a tela pergunta. Esc também volta à fila. Blocos à esquerda e a lateral com o resultado presa ao lado; no celular, tudo empilha e a barra de ações fica acima do menu inferior. Recarregar a página (ou "Atualizar") volta para a mesma ficha; só "Voltar à fila" esquece.
**fonte:** src/modulos/avaliacao-documental/fila.jsx (ModoDeAnalise); src/modulos/avaliacao-documental/estado-da-fila.js
**abrir:** avaliacao-documental

## Como analisar uma ficha

**perguntas:** como analisar a ficha | analisar candidato | ficha da avaliacao documental | conteudo da ficha | sair das planilhas | como conferir os documentos | ficha mostra inapto ao abrir | em analise requisitos conferidos | nao se aplicam | apurado com traco
**resposta:** A ficha abre na aba Fila (Pegar próximo ou Abrir). Cada bloco da regra vira um cartão, na ordem da regra: o título, o item do edital e o que o candidato DECLAROU na Empregare (a resposta das perguntas ligadas ao bloco: "Anexo", "4 anos ou mais", "Especialização"…). Os documentos ficam na Empregare (entre logado nela): "Abrir candidato na Empregare" abre direto a página do candidato, pelo link que o robô captura. Sem o link, o botão abre a vaga (e copia o código do candidato para a busca das candidaturas) ou, se nem a vaga foi capturada, "Abrir vagas na Empregare" copia o código da vaga para colar na busca de Vagas Anunciadas; "Copiar código" copia o código do candidato. Em cada bloco marque Conforme, Não conforme ou Não enviado; no Não conforme e no Não enviado escolha o motivo na lista. Nos blocos que pontuam, lance os títulos, os cursos (com a carga horária) e os vínculos (com início e fim): os pontos saem na hora pela regra. A lateral mostra a nota ao vivo, o resultado e o parecer. Enquanto falta conferir algum bloco, o resultado fica neutro — "Em análise · 2 de 4 requisitos conferidos" (os requisitos são os blocos que podem eliminar), com a nota parcial — e a coluna Apurado mostra "—" nos blocos ainda não conferidos, sem destacar diferença: a conta trata o bloco não marcado como Conforme e a experiência sem vínculo como abaixo do mínimo, por isso o Inapto só aparece quando um bloco conferido elimina (Não conforme ou Não enviado com efeito eliminatório, ou a experiência conferida abaixo do mínimo). Apto ou Inapto pela nota mínima só com tudo conferido. Marcado, o cartão muda de cor (verde Conforme, vermelho Não conforme, cinza Não enviado), ganha o selo da situação e o botão escolhido fica com o ✓. Cotas e blocos que não valem para o candidato ficam numa linha no fim ("Não se aplicam: …"), que abre ao clicar. Sem resposta na Empregare, o bloco sugere "Não enviado".
**fato:** No MONITORA, a ficha mostra o que o candidato declarou na Empregare e calcula a nota pela regra do edital enquanto o analista confere.
**fonte:** src/modulos/avaliacao-documental/ficha/ficha.jsx; src/lib/avaliacao-documental/ficha.js; src/lib/avaliacao-documental/pontuacao.js
**abrir:** avaliacao-documental

## Atalhos da ficha

**perguntas:** atalhos da ficha | teclas da ficha | tecla 1 2 3 | ctrl enter concluir | ctrl s salvar | j e k na ficha | analisar mais rapido
**resposta:** Na ficha aberta: 1 marca Conforme (e passa ao próximo bloco), 2 marca Não conforme e 3 Não enviado (ficam no bloco para escolher o motivo); J e K vão ao bloco seguinte e ao anterior; Ctrl+S salva o rascunho na hora; Ctrl+Enter confere o que falta, conclui e abre a próxima ficha. Os atalhos não valem enquanto o cursor está num campo de texto. No celular, os botões fazem o mesmo.
**fonte:** src/modulos/avaliacao-documental/ficha/ficha.jsx (aoTeclar); src/lib/avaliacao-documental/ficha.js (situacaoDaTecla)
**abrir:** avaliacao-documental

## Nota declarada × apurada e justificativa

**perguntas:** divergencia na ficha | nota diferente da declarada | justificativa da nota | ajustar a nota | alterar a nota do bloco | nota diminuida | por que pede justificativa | declarado apurado
**resposta:** Em cada bloco que pontua aparecem três números: Declarado (o que a resposta da Empregare vale pela nota declarada da regra), Calculado (o que os itens lançados dão) e Apurado (a nota que vale). O analista pode ajustar o Apurado para menos ou para mais, até o teto do bloco no nível da vaga; "Usar o calculado" volta à conta. Toda nota apurada diferente da declarada pede justificativa: um motivo do bloco ou uma observação pronta da regra (ex.: "Nota de experiência diminuída", "Nota de cursos diminuída", "Experiência anterior à diplomação não é computada") e, se quiser, um complemento. Sem justificativa, o bloco avisa e a ficha não conclui. A lateral destaca a diferença com a justificativa ao lado, e ela entra no parecer. Quem é inapto por requisito não precisa justificar as notas. Bloco sem pergunta mapeada na nota declarada mostra "—" e não pede justificativa. Na pergunta com pontos por nível (a experiência do 93/2026), o Declarado é o do nível da vaga na ficha; mudar o nível muda o Declarado.
**fato:** No MONITORA, nota apurada diferente da declarada na ficha exige justificativa padronizada, que vai para o parecer e para o histórico.
**fonte:** src/lib/avaliacao-documental/ficha.js (pendenciasDaFicha, divergenciaDoBloco); supabase/migrations/20261007130000_conteudo_da_ficha.sql (FC_PENDENCIAS_FICHA)
**abrir:** avaliacao-documental

## Parecer da ficha

**perguntas:** parecer da ficha | parecer automatico | como o parecer e gerado | copiar parecer | observacao da ficha | observacoes prontas na ficha | editar o parecer
**resposta:** O parecer é gerado pela regra do edital: no Apto, a nota total e a distribuição por bloco; no Inapto por requisito, os motivos eliminatórios com o item do edital; no Inapto por nota mínima, a nota obtida e a mínima. Os motivos dos blocos, as justificativas de nota, as observações prontas marcadas e a Observação livre entram em "Observações da análise". O texto não se edita direto: muda-se pelo que foi marcado e pelo campo Observação. "Copiar parecer" copia o texto. Na ficha concluída, vale o parecer gravado na conclusão.
**fonte:** src/lib/avaliacao-documental/pontuacao.js (calcularAvaliacao); src/modulos/avaliacao-documental/ficha/ficha.jsx
**abrir:** avaliacao-documental

## Rascunho, concluir e próxima

**perguntas:** salvar rascunho da ficha | salvo as | rascunho automatico | concluir e proxima | concluir ficha | fechar e liberar | o que falta para concluir | perdi o que fiz | concluir desabilitado | itens conferidos | barra de progresso da ficha
**resposta:** Cada mudança na ficha é salva sozinha em um ou dois segundos; "Salvo às HH:MM" aparece só depois de o banco confirmar, e "Alteração não salva" enquanto falta. "Salvar rascunho" (ou Ctrl+S) salva na hora. A barra mostra "4 de 7 itens conferidos" e, enquanto falta algo, "Falta: Formação Acadêmica, Experiência Profissional (justificativa)…"; "Concluir e próxima" fica travado até não faltar nada — situação de cada bloco, motivo do Não conforme e do Não enviado, motivo do item recusado, datas dos vínculos e justificativa de nota diferente da declarada (pedida só depois de o bloco ser conferido) — e então conclui e já abre a próxima ficha da sua fila. "Fechar e liberar" salva o que falta e solta a reserva; fechar a aba do navegador com alteração não salva pede confirmação. Se outra pessoa ou outra aba mexeu na ficha, o salvamento para com o aviso e nada é sobrescrito. A conclusão grava quem concluiu (o login) e a hora; não há campo para digitar.
**fonte:** src/modulos/avaliacao-documental/ficha/estado-da-ficha.js; supabase/migrations/20261007130000_conteudo_da_ficha.sql (salvar_rascunho_ficha, concluir_ficha)
**abrir:** avaliacao-documental

## Ficha concluída, histórico e reabrir

**perguntas:** ficha concluida | reabrir ficha | historico da ficha | quem mudou a nota | de quanto para quanto | versao da regra na ficha | regra mudou depois de concluir | fichas afetadas
**resposta:** A ficha concluída fica só para leitura, com o resultado, a nota, o parecer gravado e o histórico: cada rascunho com mudança, a conclusão e a reabertura, com quem, quando e o que mudou (situação, motivo, a nota de cada bloco de quanto para quanto e a justificativa). Só a coordenação do edital reabre, com motivo; a ficha volta a Em análise com o mesmo responsável. A ficha é analisada pela versão vigente da regra; ao concluir, guarda a versão usada, e uma versão nova da regra não muda a nota de quem já foi concluído (o banco lista as fichas afetadas ao salvar a regra). Pendentes e em análise passam a seguir a versão nova; concluir exige a versão vigente conferida.
**fonte:** supabase/migrations/20261007130000_conteudo_da_ficha.sql (reabrir_ficha, FC_REGRA_VIGENTE_FICHA, salvar_regra_analise)
**abrir:** avaliacao-documental

## Quem vê e quem grava a ficha

**perguntas:** quem ve a ficha | analista ve so as vagas dele | quem pode gravar a ficha | leitor ve a ficha | dados pessoais na ficha | cpf na ficha
**resposta:** O analista vê, na Fila e na ficha, só as vagas que analisa na equipe do edital; a coordenação e a revisão veem todas; quem só lê a Avaliação documental vê a ficha concluída. Grava só quem está com a reserva da ficha em análise. A ficha recebe da Empregare apenas as respostas das perguntas que a regra liga aos blocos e à nota declarada — nunca CPF, e-mail, telefone ou outra resposta —, e copiar o código ou abrir a Empregare fica registrado.
**fonte:** supabase/migrations/20261007130000_conteudo_da_ficha.sql (FC_EXIGIR_VER_FICHA, FC_RESPOSTAS_DA_FICHA, registrar_acesso_ficha)
**abrir:** avaliacao-documental
