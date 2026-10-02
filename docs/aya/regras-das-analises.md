# Regras das Análises curriculares

A tela Análises curriculares (view `analises`) e a sincronização das planilhas de análise. Fontes:
`src/modulos/analises/`, `src/lib/analises-curriculares.js`, `src/lib/data-de-analise.js`,
`apps-script/LEIA-ME.md` e as migrations `20260929150000_analises_lista_enxuta.sql`,
`20260930100000_analises_sem_registro_fantasma.sql`, `20261001140000_incremental_remove_ausentes.sql`
e `20260930234000_cache_sem_atropelo.sql`.

## Tela de Análises curriculares

**perguntas:** analises curriculares | analise curricular | tela de analises curriculares | tela de analises | aba analises curriculares | para que serve analises curriculares | para que serve a tela de analises | painel de analises curriculares
**resposta:** Análises curriculares mostra a análise curricular dos candidatos da área atual, vinda das planilhas de análise: indicadores (Total de aptos p/ análise, Análises realizadas, Pendentes, Em revisão, Aprovados e Reprovados), pendências prioritárias, carga por responsável, evolução diária e a lista. Os filtros são Unidade, Município/UF (só em SEDE e Projetos), Edital, Código da vaga, Status e Responsável, e em "Mais opções" Categoria, Modalidade e Validação da janela; as opções de cada filtro seguem os outros. A taxa de conclusão é aprovados mais reprovados sobre o total.
**fonte:** src/lib/analises-curriculares.js; src/modulos/analises/
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
