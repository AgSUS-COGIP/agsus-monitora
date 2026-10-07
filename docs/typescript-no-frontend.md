# TypeScript no frontend

Início da migração gradual: 07/10/2026.

O frontend mantém React e Vite. Os componentes `src/ui/aviso.tsx` e
`src/ui/botao-de-acao.tsx` são os primeiros componentes com tipos; o restante segue em
JavaScript/JSX. Não há mudança nas telas, regras de acesso ou chamadas ao banco nesta entrega.

## Verificação

`npm run typecheck` verifica o servidor e o frontend. Também é possível rodar cada um:

```sh
npm run typecheck:servidor
npm run typecheck:frontend
```

O build já chama `typecheck`, então erros nos arquivos migrados bloqueiam o build e o CI.
`tsconfig.frontend.json` inclui os arquivos TypeScript de `src/` e os casos de contrato em
`tests/tipos/`. Usa modo estrito, DOM, JSX do React e resolução de módulos do bundler.
`allowJs` permite importar o código existente; `checkJs` está desligado. Portanto, esta etapa
não verifica os contratos de todos os consumidores JavaScript nem valida respostas de API
em tempo de execução.

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

Seleção começou pela camada de estado em `src/modulos/selecao/estado.ts`, com contratos em
`tipos.ts`. Os componentes desse módulo continuam JSX. O escopo e as limitações estão em
[../src/modulos/selecao/README.md](../src/modulos/selecao/README.md).

Escolher um módulo por entrega, levantar os consumidores e manter o comportamento coberto
pelos testes. Declarar contratos de dados e ações sem `any` ou supressões de erros. Atualizar
os imports quando o arquivo mudar de extensão. Para dados externos, acrescentar validação
em tempo de execução quando necessária: uma anotação TypeScript não valida JSON recebido.

Manter o servidor com seu `tsconfig.json`; configurações de DOM e JSX pertencem ao frontend.
