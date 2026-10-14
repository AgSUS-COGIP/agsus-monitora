# TypeScript no frontend

Início da migração gradual: 07/10/2026.

O frontend mantém React e Vite. `Aviso`, `BotaoDeAcao`, Seleção, Cronograma, Visão geral, Conferências, Status das atualizações, Análises curriculares, Módulos e abas, barra lateral, Busca global e os dados compartilhados do monitoramento estão em
TypeScript. Seleção inclui estado, componentes, filtros, indicadores, gráficos, tabela
e regras puras em `src/lib/selecao-do-painel.ts`. Cronograma inclui estado, calendário,
filtros, modal do dia, próximas etapas, linha do tempo e regras em
`src/lib/calendario-editais.ts`. Visão geral inclui estado, filtros, indicadores, tabela,
gaveta, boas-vindas, leitura dos marcos e regras em `src/lib/visao-geral.ts`. Conferências inclui
estado, cartão, selos, gaveta, busca e paginação dos casos, CSV, ação de ignorar com motivo,
navegação e regras em `src/lib/avisos-de-conferencia.ts`. Status das atualizações inclui
saúde das cargas, agenda, histórico, acompanhamento, formulário de opções, estado e regras em
`src/lib/saude-das-cargas.ts` e `src/lib/painel-dos-robos.ts`. A validação das opções em
`src/lib/robos-de-carga.js` continua compartilhada com a Avaliação documental, com contratos JSDoc.
Em Entrevistas, as peças novas do Painel e de Conduzir (`agenda-e-empates.tsx`, `conduzir.tsx`,
`fila-do-dia.tsx`, as peças da ficha de notas — cabeçalho, abas, matriz, célula, resultado —, o resumo das
regras e as competências de cada membro da banca (`resumo-das-regras.tsx`, `competencias-do-membro.tsx`), o seletor do
edital, Preparar em passos, a configuração do edital, o parecer pronto e as seções do editor do roteiro
(`seletor-do-edital.tsx`, `preparar.tsx`, `configuracao-do-edital.tsx`, `parecer-pronto.tsx`, `secoes-do-roteiro.tsx`), `tipos.ts`,
`src/lib/painel-de-entrevistas.ts`, `src/lib/fila-de-conducao.ts`, `src/lib/digitacao-de-notas.ts`,
`src/lib/resumo-da-entrevista.ts`, `src/lib/passos-do-preparar.ts`, `src/lib/pendencias-do-roteiro.ts` e
`src/lib/parecer-da-entrevista.ts`)
já nascem em TypeScript. A apresentação dos resultados do Painel de entrevistas foi migrada:
`paineis.tsx` (filtros, indicadores, recorte, gráficos e pendências), `tabela.tsx` e `gaveta.tsx`,
com contratos em `tipos-do-painel.ts`. A entrada `entrevistas.tsx`, o estado em `estado.ts` e as regras de leitura, filtros,
indicadores, gráficos e CSV em `src/lib/entrevistas-do-painel.ts` também estão migrados.
O normalizador recebe `unknown`, verifica objetos e listas e tipa notas e vínculos ausentes.
A agenda também passa por normalização; respostas anteriores à troca de área ou de sessão
não voltam ao cache. O cliente só declara as duas RPCs de leitura consumidas pelo painel. Identificadores externos preservados do JSON
continuam como `unknown`, e notas e vínculos ausentes são anuláveis. Os casos compilados
estão em `tests/tipos/painel-de-entrevistas.tsx`. O Mapa de Projetos está em TypeScript, incluindo carregador,
cache, mapa, lista, balões, integração do editor e regras em `src/lib/visao-geral-da-area.ts`.
O editor compartilhado pelos dois mapas também está em TypeScript: fila, sugestões, histórico,
prévia, gravação, modo de edição e regras em `src/lib/editor-de-coordenadas.ts`. As telas principal, nacional e por DSEI da Saúde Indígena também estão em TSX.
As regras nacionais e distritais de contagens, bolhas, CASAIs, unidades, vínculos,
resumos e enquadramento estão em `src/lib/mapa-saude-indigena/chaves.ts`, `mapa-nacional.ts`
e `mapa-do-dsei.ts`. A integração comum com o Leaflet também está em TypeScript (`leaflet.ts`), incluindo
criação, fundo com recurso, tamanho, contornos, enquadramento, leque, ícones e balões.
A reconciliação, as guardas globais e o recuo dos tiles permanecem em JavaScript,
com contratos JSDoc na integração. Painel, lista, legenda, tela cheia, retorno ao Brasil e hooks dos
mapas já estão em TypeScript, com contratos em `tipos-do-painel.ts`; formas e cores
em `src/lib/mapa-saude-indigena/formas.ts`. Outros módulos
combinam JavaScript/JSX com migrações pontuais para TypeScript: a ficha da Avaliação documental
tem os componentes em `src/modulos/avaliacao-documental/ficha/*.tsx` (contratos em `tipos.ts`) e
`Popover` está em `src/ui/popover.tsx`. Em Configurações › Marca, a prévia da barra lateral
(`previa-da-barra-lateral.tsx`) e o quadro das prévias (`moldura-da-previa.tsx`) são TSX. Componentes e helpers
compartilhados consumidos por esses módulos declaram seus contratos em JSDoc.
O assistente da regra da Avaliação documental (`src/modulos/avaliacao-documental/assistente/`)
já nasceu em TSX, com as regras em `src/lib/avaliacao-documental/assistente-da-regra.ts`,
`resumo-da-regra.ts`, `comparar-regras.ts`, `catalogo-de-desempate.ts`, `pendencias-do-salvar.ts` e os
contratos em `tipos-da-regra.ts`; a prévia "Testar com um candidato fictício" está em `previa.tsx`.
Na ficha, as escolhas de cada item (Confere, Não confere, Editar nota) e o que gravam estão em `apurado-da-ficha.ts`.

A ficha de notas de Conduzir entrevistas está em `src/modulos/entrevistas/ficha.tsx`,
com contratos do estado local e do salvamento em `tipos-da-ficha.ts`. As regras de cálculo e de configuração em
`src/lib/conducao-de-entrevista.ts` também estão tipadas. O editor (`roteiros.tsx`) e a composição da banca
(`partes.tsx`) também estão migrados: cartões, criação, edição, duplicação, leitura,
renomeação, seções, níveis e salvamento. Os contratos do rascunho e dos dados enviados
ao banco estão em `src/lib/tipos-do-roteiro-de-entrevista.ts`; os de abertura e ações,
em `tipos-do-editor-de-roteiro.ts`. O estado da condução também está em TypeScript, incluindo ações, cliente RPC,
normalização dos campos usados na tela e proteção contra gravações obsoletas após
troca de área ou sessão. `src/lib/roteiro-de-entrevista.ts` também está migrado: escalas, pesos, mínimos,
conversão do rascunho, validação e dados enviados ao banco. A convocação (`conducao.tsx`) e suas regras (`src/lib/convocacao-da-entrevista.ts`)
também estão em TypeScript, com fonte discriminada, lista, seleção, desconvocação,
liberação, vagas e desempate. A entrada normaliza os campos usados dos retratos e
calcula grupos sem recalcular a ordem da Classificação. O módulo não tem arquivos
JS/JSX; `marcos.ts` também tipa a integração do painel com as comemorações compartilhadas.
Os limites de validação estão no README de Entrevistas.

## Verificação

`npm run typecheck` verifica o servidor e o frontend. Também é possível rodar cada um:

```sh
npm run typecheck:servidor
npm run typecheck:frontend
```

O build já chama `typecheck`, então erros nos arquivos migrados bloqueiam o build e o CI.
`tsconfig.frontend.json` inclui os arquivos TypeScript de `src/` e os casos de contrato em
`tests/tipos/`. Usa modo estrito, DOM, JSX do React e resolução de módulos do bundler.
`allowJs` permite importar o código existente; `checkJs` está desligado. Portanto, o compilador
não verifica todos os consumidores JavaScript nem valida JSON em tempo de execução.
Os módulos migrados verificam objetos e listas nas fronteiras de leitura; limites dessa
verificação estão nos READMEs dos módulos.

Lint e formatação incrementais incluem `.ts` e `.tsx`. O ESLint usa o parser TypeScript;
nomes e redeclarações nesses arquivos são verificados pelo compilador. Tipos do React e o
parser são dependências de desenvolvimento e não entram no bundle de produção.

## Contratos iniciais

- `Aviso`: tons `info`, `warning` e `danger`; papel `alert` ou `status`; elemento `div` ou `p`;
  filhos React e classe opcional.
- `BotaoDeAcao`: atributos de botão HTML e estado externo com `assinar`/`obter`.
  O snapshot tem `acao: { tipo, rotulo } | null`. Quando o store declara uma união de ações,
  o botão aceita apenas os valores dessa união. `NoInfer` impede que o nome passado ao botão
  amplie a união declarada pelo store.

`tests/tipos/ui.tsx` confere usos válidos e rejeições esperadas pelo compilador. Os testes
existentes de `tests/ui/ui.test.js` continuam conferindo a renderização, os rótulos, os
atributos acessíveis e o bloqueio do botão durante ações.

## Próximas migrações

Seleção está migrada em `src/modulos/selecao/`, com contratos em `tipos.ts`.
O escopo e as limitações estão em
[../src/modulos/selecao/README.md](../src/modulos/selecao/README.md).
Cronograma também está migrado; carga, contratos e limites estão em
[../src/modulos/cronograma/README.md](../src/modulos/cronograma/README.md).

Visão geral também está migrada; contratos e integração com os mapas estão em
[../src/modulos/visao-geral/README.md](../src/modulos/visao-geral/README.md).

Conferências também está migrado; contratos, normalização, paginação e limites estão em
[../src/modulos/conferencias/README.md](../src/modulos/conferencias/README.md).

Status das atualizações também está migrado; contratos e limites estão em
[../src/componentes/saude-das-cargas/README.md](../src/componentes/saude-das-cargas/README.md).

Análises curriculares também está migrado: estado, consultas, marcos, filtros,
indicadores, gráficos, tabela, gaveta e regras em `src/lib/analises-curriculares.ts`.
Contratos e limites estão em
[../src/modulos/analises/README.md](../src/modulos/analises/README.md).

Módulos e abas também está migrado: tela de Configurações, estado, revisão, histórico e
regras do rascunho em `src/lib/modulos-e-abas.ts`. Contratos, validação da resposta e limites
estão em [../src/modulos/modulos/README.md](../src/modulos/modulos/README.md).

A barra lateral também está migrada: estado, menu por área, seletor, painéis flutuantes,
rodapé, recolhimento e hooks, com as regras em `src/lib/menu-lateral.ts`. Contratos e limites
estão em [../src/componentes/barra-lateral/README.md](../src/componentes/barra-lateral/README.md).

A Busca global também está migrada: painel, atalhos, realce, seleção, montagem e regras
em `src/lib/busca-global.ts`. Inclui o snapshot compartilhado do monitoramento, validação
das linhas e unidades e o hook de área atual. Contratos e limites estão em
[../src/componentes/busca-global/README.md](../src/componentes/busca-global/README.md).

O Mapa de Projetos também está migrado; contratos, normalização dos municípios e limites
da integração com as peças comuns estão em
[../src/modulos/mapa-de-projetos/README.md](../src/modulos/mapa-de-projetos/README.md).

O editor de coordenadas também está migrado; contratos e limites estão em
[../src/modulos/editor-de-coordenadas/README.md](../src/modulos/editor-de-coordenadas/README.md).

Escolher um módulo por entrega, levantar os consumidores e manter o comportamento coberto
pelos testes. Declarar contratos de dados e ações sem `any` ou supressões de erros. Atualizar
os imports quando o arquivo mudar de extensão. Para dados externos, acrescentar validação
em tempo de execução quando necessária: uma anotação TypeScript não valida JSON recebido.

Manter o servidor com seu `tsconfig.json`; configurações de DOM e JSX pertencem ao frontend.

As regras de coordenadas dos dois mapas e o adaptador do editor da Saúde Indígena
também estão migrados. Os contratos dos alvos indígenas estão em
`src/lib/tipos-das-coordenadas-do-mapa.ts`; o catálogo editável valida entradas
externas sem alterar os índices conferidos pelo banco. As telas recebem a entrada geográfica validada por `dados-do-mapa.ts`; a edição conserva
os dados originais para preservar os alvos usados pelo banco.

O painel de Recursos também está migrado: filtros, indicadores, gráficos, recorte e fila,
com regras de prazos, enriquecimento, busca e CSV em TypeScript. Os contratos incluem etapas,
filtros, rascunho e os campos calculados; usos válidos e rejeições estão em
`tests/tipos/painel-de-recursos.tsx`. Entrada, estado e cadastro/edição também estão tipados,
com validação dos campos do painel/formulário e descarte de respostas após troca de contexto.
Os contratos desses fluxos são conferidos em `tests/tipos/estado-dos-recursos.tsx`. Gaveta, parecer e anexos também estão em TSX; regras jurídicas e botões em
`src/lib/parecer-do-recurso.ts`, com validação de histórico e metadados dos anexos.
Os contratos estão em `tests/tipos/gaveta-dos-recursos.tsx`. Resposta e modelos também estão
em TSX, com regras de marcadores e revisão em TypeScript, validação de versões, escopo e
histórico e contratos em `tests/tipos/resposta-e-modelos-dos-recursos.tsx`. O
componente de ajuste também está em TSX: itens, proposta, validação e prévia estão em
TypeScript, com contratos em `tests/tipos/ajuste-dos-recursos.tsx`. A pasta Recursos já tem
todos os componentes e o estado tipados; o motor compartilhado de Classificação também
está em TypeScript, com contratos na entrada e na saída. Contratos e limites em
[../src/modulos/recursos/README.md](../src/modulos/recursos/README.md).

A entrada e o estado de Classificação também estão migrados: seletor de edital, carga,
versões de regra, registros e publicação de listas, desempate, hora de nascimento e
exportação. Dados usados pelo estado são validados; respostas antigas não atualizam
dados, avisos ou flags após troca de edital, área ou usuário. Os contratos estão em
`tests/tipos/tela-estado-da-classificacao.tsx`; utilitários de impressão e área de transferência no navegador
também estão em TypeScript. Contratos e limites em
[../src/modulos/classificacao/README.md](../src/modulos/classificacao/README.md).

A publicação do resultado final como lista de aprovados também está em TypeScript/TSX:
modal de confirmação, extração dos candidatos do retrato, casamento por análise, nome ou
vaga, revisão manual, comparação de posições e resumo das origens. Os contratos ficam em
`tests/tipos/publicacao-da-classificacao.tsx`. A prévia valida a lista vigente inteira e
recusa candidatos sem identidade, duplicados ou coleções malformadas; uma resposta incompleta
não permite publicar com uma revisão parcial. Status, matrícula e sub judice continuam
preservados pelos vínculos conferidos pelo banco. A publicação só é confirmada na tela com
uma resposta válida do banco.

A visão Listas também está em TSX: indicadores, filtros, tabelas por vaga, eliminados,
gaveta de explicações, sorteio/decisão manual, geração, publicação e exportação. As regras
de recorte, avisos agrupados, inscrições e fase inicial ficam em `classificacao/dados.ts`.
O contrato público da saída do motor fica em `classificacao/tipos-do-resultado.ts`, usado
pelo motor em TypeScript. Metadados de geração, versões e desempates são normalizados
para os campos usados na tela. Ordens incompletas ou duplicadas e contagens inválidas de
pendências são recusadas. Contratos da tela em `tests/tipos/listas-da-classificacao.tsx`.

A visão Regra está em TSX, incluindo notas, critérios ordenáveis, modalidades, convocação,
versões e retomada do rascunho guardado. Normalização, validação e textos do documento estão
em `classificacao/regra.ts`; conversão de entradas e alterações imutáveis do formulário,
em `classificacao/edicao-da-regra.ts`. O rascunho admite texto durante a edição dos números;
a regra normalizada mantém valores numéricos. O histórico preserva configuração, autoria,
motivo e renomeações; versões inválidas são recusadas. A modalidade padrão tem listas
independentes por edital. Contratos em `tests/tipos/regra-da-classificacao.tsx`.

A Agenda está em TypeScript/TSX: formulário da regra, distribuição, conflitos, trocas
manuais, gravação, histórico, XLSX e horários do documento da convocação. As regras puras
ficam em `agenda-das-entrevistas.ts`, com contratos em `tipos-da-agenda.ts`; a entrada do
banco é validada em `dados-da-agenda.ts`. A carga do mesmo edital preserva os dados após
falha; respostas de gravação antigas não alteram dados, flags ou avisos após troca de
edital ou usuário, inclusive ao sair e voltar ao mesmo edital. Convocação inválida impede
gerar uma agenda parcial. Contratos da tela e ações em `tests/tipos/agenda-da-classificacao.tsx`.

Números, arredondamento/escala das notas, datas, idade e hora de nascimento, catálogo de
critérios/modalidades e sorteios da Classificação também estão em TypeScript:
`classificacao/numeros.ts`, `catalogo.ts` e `sorteio.ts`. O catálogo tem contratos para os
campos já normalizados do candidato e a data de corte. O sorteio preserva a ordem por
SHA-256 da semente e identidade, conferida contra o Node nos testes. Bigints que excedem
a representação numérica finita retornam `null`. Contratos em
`tests/tipos/calculos-e-desempates.tsx`; a orquestração do motor também está em TypeScript.

A montagem das vagas e a ponte com a convocação do edital também estão em TypeScript:
`classificacao/vagas.ts` e `convocacao-do-edital.ts`, com contratos em
`tipos-das-vagas.ts`. A precedência continua sendo quadro explícito, configuração de
convocação compatível com o total e percentuais da regra. A distribuição reutiliza a
mesma conta da Lista de aprovados, preservando cadastro de reserva, vagas sem candidatos
e avisos de divergência das cotas. Contratos em `tests/tipos/vagas-da-classificacao.tsx`.

O motor completo está em `classificacao/motor.ts`: preparação de candidatos, vínculo das
entrevistas, aplicação de ajustes aprovados, elegibilidade, composição de notas,
desempates, cotas, convocação e explicações das quatro listas. Os contratos internos
ficam em `tipos-do-motor.ts`; `dados-do-motor.ts` valida a ponte de convocação antes do
cálculo. Configurações incompletas são recusadas. Uma convocação sem limite conserva
`limite: null`. Contratos em `tests/tipos/motor-da-classificacao.tsx`.

Retrato das listas, exportação XLSX, seleção de colunas e geração SEI/DOCX também estão
em TypeScript: `classificacao/exportacao.ts`, `colunas-do-documento.ts`,
`documento-sei.ts` e `documento-docx.ts`. Os contratos compartilhados ficam em
`tipos-dos-documentos.ts`; `dados-dos-documentos.ts` verifica todas as linhas antes da
exportação, recusando coleções malformadas e notas não numéricas. São preservados os
XML dos arquivos, texto público, timbrado, numeração, notas de rodapé e horários da agenda.
Contratos em `tests/tipos/documentos-da-classificacao.tsx`.

As cartas de convocação estão em TypeScript/TSX, incluindo estado, modelos, versões,
emissão, histórico e documentos SEI/DOCX/ZIP. Os contratos ficam em
`src/lib/tipos-da-carta.ts` e `tests/tipos/cartas-e-navegador.tsx`. Modelos malformados
interrompem a carga com aviso. Uma confirmação incompleta da emissão impede a saída
e a repetição automática do registro; o usuário deve conferir o histórico. O cache
do logo considera URL e largura e permite nova tentativa após falha. Testes em
`tests/modulos/carta-confirmacao-e-modelos.test.js` e
`tests/modulos/documentos-no-navegador.test.js`.

A configuração de convocação em Aprovados também está em TypeScript/TSX: catálogo e
normalização dos modelos, categorias, cascata, edição imutável, formulário e prévia
da ordem de chamada. `src/lib/tipos-da-configuracao-de-convocacao.ts` compartilha os
contratos com a Classificação. Coleções malformadas, identidades ausentes e chaves
duplicadas impedem atualizar a configuração; os mapas anteriores são preservados.
Contratos em `tests/tipos/configuracao-da-convocacao.tsx` e testes de recuperação em
`tests/lib/configuracao-da-convocacao-dados.test.js`.

O cálculo e a aba de Convocação em Aprovados estão em TypeScript/TSX: cotas,
cascatas, ordenação, agrupamento, indicadores, filtros, paginação, seleção para
cartas e CSV. Os contratos preservam os campos adicionais dos candidatos durante
a ordenação e o cálculo. A associação do sub judice ao cargo fica restrita ao
próprio edital; múltiplas vagas no mesmo edital continuam sem escolha automática.
Contratos em `tests/tipos/lista-de-convocacao.tsx` e regressão em
`tests/lib/convocacao-sub-judice-por-edital.test.js`.
