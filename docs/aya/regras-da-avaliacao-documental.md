# Regras da Avaliação documental

A tela Avaliação documental (view `avaliacao-documental`) é onde a avaliação documental e de
títulos passa a ser feita dentro do MONITORA, no lugar das planilhas de vaga e do simulador. A tela
mostra só rótulos, números e botões; o porquê fica aqui. Fontes: `src/modulos/avaliacao-documental/`,
`src/lib/avaliacao-documental/` (regra, conta, nota declarada e equipe), as migrations
`20261006090000_avaliacao_documental_permissao_e_menu.sql`, `20261006100000_regra_da_analise.sql` e
`20261006110000_pre_classificacao_e_lote.sql` (pré-classificação), o job Python
`scripts/pre_classificacao/` com a conta em `python/monitora/avaliacao_documental/`,
os modelos em `supabase/correcoes/20261006-modelos-da-regra-da-analise.sql` e o desenho em
`docs/analises-no-monitora/`.

## Tela de Avaliação documental

**perguntas:** avaliacao documental | tela de avaliacao documental | para que serve avaliacao documental | para que serve a avaliacao documental | modulo avaliacao documental | avaliacao documental e de titulos
**resposta:** A Avaliação documental é o módulo de trabalho da etapa "Avaliação Documental e de Títulos": escolhido o edital, a coordenação cadastra a regra da avaliação daquele edital (blocos por documento ou pergunta da Empregare, eliminatórios com o item do edital, critério étnico com aldeias, escolaridade por nível, cursos, experiência, nota declarada, lote, distribuição, revisão e os textos do parecer) e diz quem analisa, quem revisa e quem coordena (aba Equipe). Há a regra, a equipe e a Pré-classificação (a Lista Provisória por ART e o lote de convocação de cada vaga, com as listas oficiais PROVISORIA e LOTE); a fila e a ficha do candidato chegam nas fases seguintes. O resultado continua aparecendo no Painel das análises.
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

## Divergência entre a ART e a nota declarada

**perguntas:** art diferente da nota declarada | diverge | art x declarada | nota declarada diferente | por que diverge
**resposta:** A ART (Nota da Autodeclaração de Requisitos e Títulos) é a nota que a Empregare calcula com as respostas do questionário. Se a regra tiver a nota declarada configurada (aba Regra), o sistema recalcula a nota pelas mesmas respostas e compara: diferença acima da tolerância da regra aparece como "diverge" na linha do candidato e no contador "ART × declarada". É só um aviso para a coordenação conferir o questionário ou a regra; a ordem da Provisória continua pela ART.
**fonte:** src/lib/avaliacao-documental/nota-declarada.js; python/monitora/avaliacao_documental/nota_declarada.py
**abrir:** avaliacao-documental

## Lote de convocação e linha de corte

**perguntas:** lote de convocacao | tamanho do lote | linha de corte | quem entra no lote | como e calculado o lote | lote por modalidade | empatados no lote | tamanho do lote por vaga | sugerido
**resposta:** Só quem está no lote de convocação (item 8.4) segue para a avaliação documental; o último do lote é a linha de corte. O tamanho de cada vaga vem, nesta ordem: do número definido para a vaga na aba Pré-classificação (campo "Tamanho do lote", que vira versão nova da regra com motivo); do número fixo da regra; ou do múltiplo das vagas imediatas do quadro de vagas, com o cadastro reserva contando como mais uma vaga quando a regra inclui o CR (ex.: 3 × (11 + CR) = 36). Sem quadro de vagas não há como sugerir: a vaga mostra o aviso e ninguém entra até alguém definir o tamanho. No lote por modalidade, a ampla concorrência pega os primeiros de todos e depois cada cota pega os seus, entre os que ainda não entraram. Com "inclui os empatados", quem tem a mesma nota do último do lote também entra.
**fato:** No MONITORA, o tamanho do lote de uma vaga é o definido para a vaga, o número fixo da regra ou o múltiplo das vagas imediatas do quadro (o cadastro reserva conta como mais uma vaga quando a regra inclui o CR).
**fonte:** src/lib/avaliacao-documental/pre-classificacao.js; python/monitora/avaliacao_documental/pre_classificacao.py
**abrir:** avaliacao-documental

## A linha anda: reposição do lote

**perguntas:** a linha anda | reposicao do lote | quem sai do lote | entrou no lote | lote 2 | novo lote | por que o candidato entrou no lote | inscrito novo acima do corte
**resposta:** Quem entrou no lote só sai eliminado (por exemplo, cancelou a inscrição depois). Quando alguém sai e a regra manda repor ("a linha anda"), o próximo da Provisória entra num lote novo (2, 3…), com o motivo gravado: "Entrou no lugar de 7000654 (Cancelou a inscrição)". Sem reposição na regra, o lugar fica aberto e a vaga avisa. Um inscrito que chega depois com a ART maior não tira ninguém do lote: ele fica fora, e a vaga mostra o aviso "Fora do lote com nota acima da linha de corte". Quem já tem ficha não muda por recálculo. Antes das fichas, dá para refazer o lote do zero (modo refazer_lote do job, no GitHub). Toda entrada e saída fica no histórico.
**fonte:** python/monitora/avaliacao_documental/pre_classificacao.py; supabase/migrations/20261006110000_pre_classificacao_e_lote.sql
**abrir:** avaliacao-documental

## Recalcular a pré-classificação

**perguntas:** recalcular | recalcular a pre-classificacao | quando a provisoria atualiza | botao recalcular | edital sem regra conferida | pre-classificacao nao atualizou | job da pre-classificacao
**resposta:** A pré-classificação roda sozinha no fim de cada carga do robô da Empregare, para os editais das vagas carregadas. A coordenação do edital também pode clicar em "Recalcular" na aba Pré-classificação (o administrador global usa o "Rodar agora" das Configurações › Status das atualizações, para todos os editais). O botão fica travado enquanto a regra não está conferida ou enquanto o job roda; a lista atualiza quando o job termina (a tela relê sozinha depois de alguns segundos, ou use Atualizar). Edital sem regra conferida não é calculado: o job explica no resumo e a aba mostra o aviso "Edital sem regra conferida".
**fonte:** scripts/pre_classificacao/pre_classificacao.py; .github/workflows/pre-classificacao.yml; api/rodar-carga.js
**abrir:** avaliacao-documental

## Listas Provisória e Lote de convocação

**perguntas:** lista provisoria oficial | lote de convocacao oficial | registrar a lista provisoria | publicar o lote | copiar para o sei a provisoria | baixar docx da provisoria | publicar cada reposicao | lista lote
**resposta:** Na aba Pré-classificação, quem coordena o edital (ou quem tem Editor na Classificação) registra a "Lista Geral de Classificação Provisória (ART)" e o "Lote de convocação". Registrar grava um retrato com hash na Classificação (tipos PROVISORIA e LOTE), montado no banco a partir da pré-classificação gravada; depois saem "Copiar para o SEI" e "Baixar DOCX", no mesmo modelo das outras listas (por vaga: classificação, nome e a nota da ART; a Provisória também tem a lista dos eliminados com o motivo). Os textos-padrão citam os itens 8.3.1 e 8.4 e podem ser trocados por edital na regra de classificação. Com "publica cada reposição" na regra, cada lote novo aparece para registrar como um novo Lote de Convocação; sem, aparece só o lote inicial e as reposições ficam registradas no histórico. Registrar exige a regra de classificação do edital; marcar como publicada exige Editor na Classificação.
**fonte:** supabase/migrations/20261006110000_pre_classificacao_e_lote.sql; src/lib/classificacao/documento-sei.js
**abrir:** avaliacao-documental
