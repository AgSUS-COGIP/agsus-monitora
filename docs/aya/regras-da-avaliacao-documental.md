# Regras da Avaliação documental

A tela Avaliação documental (view `avaliacao-documental`) é onde a avaliação documental e de
títulos passa a ser feita dentro do MONITORA, no lugar das planilhas de vaga e do simulador. A tela
mostra só rótulos, números e botões; o porquê fica aqui. Fontes: `src/modulos/avaliacao-documental/`,
`src/lib/avaliacao-documental/` (regra, conta, nota declarada e equipe), as migrations
`20261006090000_avaliacao_documental_permissao_e_menu.sql` e `20261006100000_regra_da_analise.sql`,
os modelos em `supabase/correcoes/20261006-modelos-da-regra-da-analise.sql` e o desenho em
`docs/analises-no-monitora/`.

## Tela de Avaliação documental

**perguntas:** avaliacao documental | tela de avaliacao documental | para que serve avaliacao documental | para que serve a avaliacao documental | modulo avaliacao documental | avaliacao documental e de titulos
**resposta:** A Avaliação documental é o módulo de trabalho da etapa "Avaliação Documental e de Títulos": escolhido o edital, a coordenação cadastra a regra da avaliação daquele edital (blocos por documento ou pergunta da Empregare, eliminatórios com o item do edital, critério étnico com aldeias, escolaridade por nível, cursos, experiência, nota declarada, lote, distribuição, revisão e os textos do parecer) e diz quem analisa, quem revisa e quem coordena (aba Equipe). Nesta primeira fase há a regra e a equipe; a Provisória por ART, o lote, a fila e a ficha do candidato chegam nas fases seguintes. O resultado continua aparecendo no Painel das análises.
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
**resposta:** Na regra, cada documento ou pergunta da Empregare vira um bloco: título, item do edital, as perguntas ligadas pelo começo do enunciado (ex.: "Pergunta 15 -"), uma condição opcional (só para indígena, só para uma modalidade) e o efeito de cada situação — Conforme, Não conforme, Não enviado (Não se aplica não tem efeito). Os efeitos são: elimina (inapto, nota 0), zera os pontos do bloco, tira só os pontos de aldeia, só registro, encaminha à heteroidentificação ou à perícia, e segue na ampla. Cada bloco tem motivos padronizados com o texto que vai ao parecer e o item do edital; um motivo com efeito próprio vale no lugar do efeito da situação (ex.: "Aldeia fora do DSEI" só tira a aldeia).
**fonte:** src/lib/avaliacao-documental/catalogo.js; src/lib/avaliacao-documental/pontuacao.js
**abrir:** avaliacao-documental

## Perguntas da Empregare e nota declarada

**perguntas:** perguntas da empregare na regra | ligar pergunta ao bloco | nota declarada | divergencia da art | art | respostas encontradas
**resposta:** Para quem coordena, a aba Regra lista as perguntas da última carga do robô da Empregare nas vagas do edital, com as respostas encontradas e quantas vezes cada uma aparece — respostas que aparecem uma vez só não são mostradas, para não expor texto livre. Dali se liga a pergunta a um bloco ou se cria a pontuação da nota declarada: cada resposta vale pontos (ou meses × pontos por mês), por parcial. A nota declarada só confere a ART (a nota do questionário da Empregare); se divergir além da tolerância, vira aviso, e a ordem da Provisória continua pela ART.
**fonte:** src/lib/avaliacao-documental/nota-declarada.js; supabase/migrations/20261006100000_regra_da_analise.sql
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
