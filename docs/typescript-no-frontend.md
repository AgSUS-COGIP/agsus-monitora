# TypeScript no frontend

Início da migração gradual: 07/10/2026.

O frontend mantém React e Vite. `Aviso`, `BotaoDeAcao`, Seleção e Cronograma estão em
TypeScript. Seleção inclui estado, componentes, filtros, indicadores, gráficos, tabela
e regras puras em `src/lib/selecao-do-painel.ts`. Cronograma inclui estado, calendário,
filtros, modal do dia, próximas etapas, linha do tempo e regras em
`src/lib/calendario-editais.ts`. O assistente da regra da Avaliação documental
(`src/modulos/avaliacao-documental/assistente/`) já nasceu em TSX, com as regras em
`src/lib/avaliacao-documental/assistente-da-regra.ts`, `resumo-da-regra.ts`, `comparar-regras.ts`
e os contratos da regra em `tipos-da-regra.ts`. O restante segue em JavaScript/JSX.
Componentes e helpers compartilhados consumidos por esses módulos declaram seus contratos em JSDoc.

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
Seleção e Cronograma verificam objetos e listas nas fronteiras de leitura; limites dessa
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

Escolher um módulo por entrega, levantar os consumidores e manter o comportamento coberto
pelos testes. Declarar contratos de dados e ações sem `any` ou supressões de erros. Atualizar
os imports quando o arquivo mudar de extensão. Para dados externos, acrescentar validação
em tempo de execução quando necessária: uma anotação TypeScript não valida JSON recebido.

Manter o servidor com seu `tsconfig.json`; configurações de DOM e JSX pertencem ao frontend.
