# TypeScript no frontend

Início da migração gradual: 07/10/2026.

O frontend mantém React e Vite. `Aviso`, `BotaoDeAcao`, Seleção, Cronograma, Visão geral, Conferências, Status das atualizações e Análises curriculares estão em
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
`fila-do-dia.tsx`, as peças da ficha de notas — cabeçalho, abas, matriz, célula, resultado —, `tipos.ts`,
`src/lib/painel-de-entrevistas.ts`, `src/lib/fila-de-conducao.ts` e `src/lib/digitacao-de-notas.ts`)
já nascem em TypeScript. Os mapas
continuam em JavaScript, com contratos JSDoc na integração com a tela. Outros módulos
combinam JavaScript/JSX com migrações pontuais para TypeScript: a ficha da Avaliação documental
tem os componentes em `src/modulos/avaliacao-documental/ficha/*.tsx` (contratos em `tipos.ts`) e
`Popover` está em `src/ui/popover.tsx`. Em Configurações › Marca, a prévia da barra lateral
(`previa-da-barra-lateral.tsx`) e o quadro das prévias (`moldura-da-previa.tsx`) são TSX. Componentes e helpers
compartilhados consumidos por esses módulos declaram seus contratos em JSDoc.
O assistente da regra da Avaliação documental (`src/modulos/avaliacao-documental/assistente/`)
já nasceu em TSX, com as regras em `src/lib/avaliacao-documental/assistente-da-regra.ts`,
`resumo-da-regra.ts`, `comparar-regras.ts` e os contratos em `tipos-da-regra.ts`.

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

Escolher um módulo por entrega, levantar os consumidores e manter o comportamento coberto
pelos testes. Declarar contratos de dados e ações sem `any` ou supressões de erros. Atualizar
os imports quando o arquivo mudar de extensão. Para dados externos, acrescentar validação
em tempo de execução quando necessária: uma anotação TypeScript não valida JSON recebido.

Manter o servidor com seu `tsconfig.json`; configurações de DOM e JSX pertencem ao frontend.
