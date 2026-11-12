---
tipo: regra
area: front
atualizado: 2026-11-10
---

# Código legado

O legado é o código antigo, sem React, em `src/modules/` (o do `index.html`; `src/analises/` já foi
esvaziada e removida). Ele **só encolhe**, e sai inteiro quando a mudança que o substitui é
confirmada. O sistema ainda está em desenvolvimento: não há camada de compatibilidade "por via
das dúvidas".

## O legado só encolhe

- **Nada novo em `src/modules/` nem em `src/analises/`.** `scripts/check-legado-so-encolhe.mjs`
  quebra o build e o CI com arquivo novo ali. Editar e apagar podem.
- **Sem JavaScript escrito à mão**: a pasta é só TypeScript, fora o gerado da Aya
  (`aya-conhecimento-gerado.js`). Qualquer `.js`/`.jsx` ali quebra o build (nem editar um antigo):
  módulo que precise mudar vira `.ts`.
- Os módulos são features de UI sem framework, instaladas por `src/main.ts` (a ordem importa).
  Grupos: `aya-*` (assistente) · `map-*`, `indigenous-*` (seletor de fundo e Terras Indígenas) ·
  `icones.ts` (registro único de ícones Lucide, usado também pelo React; [[icones]]).
- Regras de quem ainda mexe ali: sem `innerHTML` cru (`src/lib/sanitize.ts`); nenhum
  `MutationObserver` novo; dados só por RPC; marcação nova segue os componentes do Design System
  (seção 11: `.btn`, `.card`, `.table-card`, `.modal`) em vez de inventar classe; teste em `tests/`
  ou `tests/modules/`.
- O legado fica onde está (`src/modules/`): não se move para outra pasta aos poucos, porque mover
  arquivo gera conflito com quem trabalha em paralelo. Uma pasta própria para ele só nasce numa
  mudança em bloco, combinada antes.

## Sai quando a mudança é confirmada

Quando o usuário confirmar que uma mudança está ok (por exemplo, uma página migrada para React),
**remova todo o código legado que ela substituiu**:

- módulos de `src/modules/`, marcação do `index.html` e funções expostas em `window` que só o
  código antigo usava;
- CSS sem seletor vivo, testes do comportamento antigo e arquivos ou pastas sem uso (build antigo,
  workflow temporário, protótipo abandonado);
- as referências nos docs, nas notas e nos `CLAUDE.md`.

Antes de apagar, confirme com `grep` que nada mais usa; depois, rode os testes afetados e o
`npm run build`. O histórico do git guarda o que saiu.

## Ao migrar uma tela

Levante tudo o que a antiga faz (checklist), cumpra com testes, confira no navegador e só então
apague o legado. Remendos existentes (`*-fix`, `post-N…`) se absorvem na fonte e se apagam
([[regras-do-codigo]]).

## Relacionadas

- [[arquitetura-do-front]] — para onde o código vai
- [[legado-fala-com-react]] — o contrato enquanto os dois convivem
- [[nova-tela-react]] — onde fica o código novo
- [[mapa-do-repositorio]] — arquivos do legado que não se leem inteiros
