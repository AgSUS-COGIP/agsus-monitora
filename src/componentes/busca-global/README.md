# Busca global

O módulo está em React e TypeScript: painel, atalhos, seleção por teclado e mouse,
realce e montagem em `busca-global.tsx`; contratos em `tipos.ts`; regras puras em
`src/lib/busca-global.ts`.

Ctrl+K ou Cmd+K abre a busca com sessão conectada. Ela pesquisa os nove campos do
monitoramento, em todas as áreas, sem diferenciar maiúsculas e acentos. Mantém a
ordem da fonte e para em 12 resultados. O campo começa vazio; setas e Enter escolhem,
Esc e o fundo fecham, e o modal mantém e devolve o foco.

A escolha publica `agsus:busca-global-escolhida` com `detail.id`. A navegação em
`src/app/` continua responsável pelas permissões, pela área e pelos filtros da tela.
A busca não concede acesso a dados que a carga ou a RLS não entregaram.

## Dados compartilhados

`dados-do-monitoramento.ts`, `tipos-do-monitoramento.ts` e `usar-area-atual.ts`
declaram o snapshot compartilhado, sua assinatura e o recorte por área. As listas
são somente para leitura no contrato TypeScript. A publicação valida dados externos
com `src/lib/linhas-do-monitoramento.ts`: aceita registros, ids numéricos finitos ou
texto não vazio e campos textuais conhecidos como texto ou ausentes. Campos nulos
viram ausentes; registros malformados são descartados. Colunas extras permanecem
`unknown`, sem validação específica, e o catálogo só valida o formato de registro.
Essa validação não substitui os contratos das consultas de cada módulo.

Linhas sem id podem alimentar outros indicadores; não viram resultados selecionáveis
nem ids de recorte. A área utiliza `CO_AREA` e mantém a regra de Saúde Indígena para
cache antigo sem essa coluna. Sair limpa linhas e o estado de carga, mantendo a área
da aba. A área é corrigida quando chegam as permissões do próximo perfil.

Testes de comportamento em `tests/busca-global.test.js`,
`tests/componentes/busca-global.test.js`, `tests/componentes/area-atual.test.js` e
`tests/componentes/dados-do-monitoramento.test.js`; contratos positivos e rejeições
esperadas em `tests/tipos/busca-global.tsx`, conferidos pelo typecheck do frontend.
