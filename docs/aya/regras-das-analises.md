# Regras do Painel das análises

A tela Painel das análises (view `analises`, antes chamada Análises curriculares) e a sincronização das planilhas de análise. Fontes:
`src/modulos/analises/`, `src/lib/analises-curriculares.js`, `src/lib/data-de-analise.js`,
`apps-script/LEIA-ME.md` e as migrations `20260929150000_analises_lista_enxuta.sql`,
`20260930100000_analises_sem_registro_fantasma.sql`, `20261001140000_incremental_remove_ausentes.sql`
e `20260930234000_cache_sem_atropelo.sql`.

## Painel das análises

**perguntas:** painel das analises | para que serve o painel das analises | analises curriculares | analise curricular | tela de analises curriculares | tela de analises | aba analises curriculares | para que serve analises curriculares | para que serve a tela de analises | painel de analises curriculares
**resposta:** O Painel das análises (antes chamado Análises curriculares) é a tela de leitura da avaliação documental: mostra a análise curricular dos candidatos da área atual, vinda das planilhas de análise: indicadores (Total de aptos p/ análise, Análises realizadas, Pendentes, Em revisão, Aprovados e Reprovados), pendências prioritárias, carga por responsável, evolução diária e a lista. Os filtros são Unidade, Município/UF (só em SEDE e Projetos), Edital, Código da vaga, Status e Responsável, e em "Mais opções" Categoria, Modalidade e Validação da janela; as opções de cada filtro seguem os outros. A taxa de conclusão é aprovados mais reprovados sobre o total.
**fonte:** src/lib/analises-curriculares.js; src/modulos/analises/
**abrir:** analises

## Filtrar por data no gráfico Análises por data

**perguntas:** filtrar por data | filtro por data | filtrar por dia | clicar no grafico de datas | analises por data | linha do tempo das analises | analises de um dia | intervalo de datas nas analises | data da analise de ate
**resposta:** O gráfico Análises por data conta só as análises com decisão (Aprovado, Reprovado ou Revisar) pela data da análise; pendente com data não entra. Nas Análises curriculares, clicar num dia do gráfico Análises por data filtra a tela por aquele dia, pela data da análise: os indicadores, a carga por responsável, as pendências prioritárias, a fila e o CSV passam a mostrar só as análises daquele dia. O filtro aparece como o chip Data no Recorte ativo e nos filtros aplicados, e o ponto escolhido fica destacado; o gráfico continua com todos os dias. Clicar de novo no mesmo dia, no x do chip ou em Limpar tudo tira o filtro; outro dia troca. Shift + clique em outro dia escolhe o intervalo entre os dois. Sem mouse, o mesmo filtro está em Refinar resultados › Mais opções, nos campos Data da análise: de e até. Análise sem data de análise sai do recorte enquanto houver filtro de data.
**fonte:** src/lib/analises-curriculares.js; src/modulos/analises/paineis.jsx; docs/historias-de-usuario/analises-curriculares.md
**abrir:** analises

## Escopo Ativo, Inativo e Todos

**perguntas:** o que e o escopo ativo, inativo e todos | escopo ativo | escopo inativo | situacao do processo | ativo inativo todos
**resposta:** Nas Análises curriculares, o campo Situação do processo começa em Ativo. Ativo são as análises ativas de editais ativos; Inativo são as análises de editais encerrados (inativos); Todos junta os dois e as análises desativadas de editais ainda ativos. Só o Ativo fica pronto num cache do banco, remontado a cada 2 minutos; Inativo e Todos são montados na hora do pedido.
**fonte:** src/lib/analises-curriculares.js; supabase/migrations/20260929150000_analises_lista_enxuta.sql; supabase/migrations/20260930234000_cache_sem_atropelo.sql

## Pendências das análises

**perguntas:** quais sao as pendencias das analises curriculares | pendencias das analises | data no futuro | data fora do periodo | sem responsavel | validacao da janela
**resposta:** Nas Análises curriculares, as pendências prioritárias aparecem da mais grave para a menos grave (até 8): Data no futuro, Data fora do período e Sem responsável; depois Pendentes, Em revisão e Etapa sem data. Cada uma tem um atalho que aplica o filtro. A data da análise é comparada com a janela do edital: Dentro do período, Fora do período, Sem data de análise, Sem janela configurada ou Data no futuro (data depois de hoje, um dado a corrigir na planilha). No gráfico de evolução diária, os dias com análise fora do período ou no futuro ficam em vermelho.
**fonte:** src/lib/analises-curriculares.js; src/lib/data-de-analise.js

## Atualização das análises

**perguntas:** como as analises curriculares sao atualizadas | sincronizacao das analises | de onde vem as analises | quem saiu da planilha | atualizacao das analises
**resposta:** As três planilhas de análise (Saúde Indígena, Projetos e SEDE) enviam para o mesmo banco por Apps Script; em Projetos e SEDE o envio incremental roda a cada 20 minutos. Quem sai da planilha sai do MONITORA: no fim de cada sincronização, as análises ativas daquela planilha (de editais ativos) que não vieram no envio são desativadas, nada é apagado. Há travas: nada é desativado se o envio vier vazio ou incompleto, ou se a remoção passar de 2% das análises ativas da planilha (mínimo de 25). Se o mesmo candidato aparece de novo na mesma vaga e edital, só o registro mais recente fica ativo. Análises de editais encerrados ficam como histórico. O andamento das cargas aparece em Configurações › Status das atualizações.
**fonte:** apps-script/LEIA-ME.md; supabase/migrations/20261001140000_incremental_remove_ausentes.sql; supabase/migrations/20260930100000_analises_sem_registro_fantasma.sql

## Conferido às, no topo da tela

**perguntas:** conferido as | o que e conferido as | o que quer dizer conferido | ultima mudanca | hora no topo da tela | atualizado em | a tela parece parada | dados parados | por que a hora nao muda
**resposta:** No topo de Análises curriculares, Seleção e Entrevistas, "Conferido às 09:32" é a última vez que a carga conferiu os dados (horário de Brasília; se foi em outro dia, aparece a data, como "em 04/10, 13:05"). Nas Análises curriculares, vem junto "última mudança em …": quando os dados mudaram de fato. Se a carga rodou e a planilha não tinha nada novo, o "Conferido" avança e a última mudança fica — os dados não estão parados. Sem registro de conferência, aparece "Atualizado em …". Se suspeitar de carga atrasada ou com falha, o administrador global confere em Configurações › Status das atualizações.
**fonte:** src/lib/texto-da-conferencia.js; src/modulos/analises/analises.jsx; src/modulos/selecao/selecao.tsx; src/modulos/entrevistas/entrevistas.jsx

## Quem vê as Análises curriculares

**perguntas:** quem pode ver as analises curriculares | nao vejo a aba analises | permissao analises | posso editar a analise no monitora | onde corrijo a analise | corrigir nota da analise
**resposta:** A aba usa a permissão "Análises curriculares" (Leitor basta, em Configurações › Acessos) e mostra só a área atual e, com coordenação, os editais dela. Ela é só de consulta: a análise é feita e corrigida nas planilhas de análise, que chegam ao MONITORA pelo Apps Script. Nota alterada por recurso não muda a análise: vale como ajuste aprovado, aplicado na Classificação.
**fonte:** src/lib/access-roles.js; src/lib/permissoes-recursos.js; src/modulos/analises/; apps-script/LEIA-ME.md
**abrir:** analises

## Número das Análises que não bate

**perguntas:** por que o numero das analises nao bate | numero diferente da planilha | total de analises diferente | analise nao aparece | candidato sumiu das analises
**resposta:** Confira primeiro o recorte: a Situação do processo começa em Ativo (editais encerrados ficam em Inativo), os filtros e o filtro de data (chip Data) recortam todos os números, e a tela é só da área atual. O envio das planilhas é esperado a cada 20 minutos e o Ativo vem de um pacote remontado a cada 2 minutos, então uma mudança recente pode demorar um pouco; o "Conferido às" do topo diz quando a carga conferiu. Quem saiu da planilha é desativado no MONITORA, e o mesmo candidato repetido na mesma vaga e edital conta uma vez só (o registro mais recente).
**fonte:** src/lib/analises-curriculares.js; supabase/migrations/20261001140000_incremental_remove_ausentes.sql; supabase/migrations/20260930100000_analises_sem_registro_fantasma.sql
**abrir:** analises

## Avaliação documental no MONITORA (em construção)

**perguntas:** avaliacao documental no monitora | analisar no monitora | fazer a analise curricular no monitora | ficha de analise do candidato | quando vou analisar pelo monitora | simulador da analise
**resposta:** Está em construção. Hoje a análise curricular é feita nas planilhas (com o simulador) e o MONITORA só a lê, nesta tela. O desenho em aprovação prevê o módulo Avaliação documental dentro do MONITORA: a lista provisória pela nota da ART, o lote de convocação montado sozinho e uma ficha por candidato, com um bloco por documento e o atalho para a Empregare, gravando direto na base que a Classificação já lê. A tela de hoje continua como painel de leitura das análises. Ainda não há data.
**fonte:** docs/analises-no-monitora/README.md (desenho, branch docs/analises-no-monitora)
**abrir:** analises
