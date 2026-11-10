---
tipo: referencia
area: front
atualizado: 2026-11-10
---

# TypeScript no front

A migração de JavaScript para TypeScript começou em 07/10/2026 e está praticamente concluída:
693 arquivos `.ts`/`.tsx` × 4 `.js` em `src/` (04/11/2026), entre eles o contrato de RPC e um
arquivo gerado. **Código novo só em TypeScript/TSX.** O estado por módulo, os contratos e as
próximas migrações estão em [docs/typescript-no-frontend.md](../typescript-no-frontend.md). O
servidor também é TypeScript ([[servidor-web]]).

## O que já está em TypeScript

- Seleção, Cronograma, Visão geral, Conferências, Status das atualizações, Análises curriculares,
  Módulos e abas, barra lateral, Busca global, dados compartilhados do monitoramento e os
  componentes de `src/ui/`.
- O Mapa de Projetos, incluindo carga, lista, balões e integração do editor; o editor compartilhado
  pelos dois mapas (fila, sugestões, histórico, modo de edição e regras comuns); a base
  compartilhada dos mapas (painel, legenda, tela cheia, retorno ao Brasil e hooks).
- As telas principal, nacional e por DSEI da Saúde Indígena, em TSX, com dados de entrada
  validados; as regras nacionais e distritais, com contratos JSDoc na fronteira da reconciliação
  compartilhada; a integração comum com o Leaflet, com contratos em `tipos-do-leaflet.ts`.
- O Painel de entrevistas (entrada, estado, normalização e apresentação), com contratos em
  `tipos-do-painel.ts`.
- A Avaliação documental (módulo e lib), com contratos em `tipos-do-estado.ts` e
  `tipos-da-ficha.ts`.
- O app (`src/app/`, incluindo a entrada), `src/main.ts` e o retorno do OAuth
  (`src/auth/callback.ts`).
- Os módulos não visuais de `src/modules/` (sessão, IndexedDB, catálogo e situação, Aya, guardas
  do mapa, PWA, comemorações e ícones). O legado já não tem JavaScript escrito à mão e só encolhe
  ([[codigo-legado]]).

## Regras

- **Não converter o front para TypeScript sem pedido explícito** quando o arquivo não está sendo
  mudado; o legado que precise mudar vira `.ts` (a checagem do legado exige).
- Resposta de RPC e de cache entra como `unknown` e passa por normalizador que verifica objetos e
  listas antes de ler campos (padrão de todos os módulos migrados).
- `npm run typecheck` roda os três: `typecheck:servidor` (`tsconfig.json`), `typecheck:frontend`
  (`tsconfig.frontend.json`) e `typecheck:testes` (`tsconfig.tests.json`, strict). Casos de tipo
  compilados ficam em `tests/tipos/`.
- Teste novo é `.ts` ([[testes]]): sem `any`, `@ts-ignore`/`@ts-nocheck` nem `as unknown as`.

## Relacionadas

- [[arquitetura-do-front]] — o app React para onde tudo migra
- [[nova-tela-react]] — tela nova já nasce em TSX
- [[ci-e-qualidade]] — onde o typecheck roda
