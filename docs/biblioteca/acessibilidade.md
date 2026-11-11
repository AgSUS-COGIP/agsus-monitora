---
tipo: regra
area: front
atualizado: 2026-11-10
---

# Acessibilidade

Meta: **WCAG 2.2 nível AA** em todas as telas. A tabela completa está no
[Design System AgSUS](../design-system-agsus.md), seção 17; as regras locais, em [[design-e-tokens]].

## Regras

| Tema                  | Requisito                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Contraste de texto    | 4,5:1 (normal), 3:1 (grande); use só os pares de fundo e texto do Design System                    |
| Contraste não textual | 3:1 para contornos de campo, ícones essenciais, indicadores de estado e elementos de gráfico      |
| Foco                  | sempre visível (contorno de 2px `focus-ring`, offset 2px); nunca tirar o `outline` sem substituto |
| Foco não encoberto    | cabeçalho e barras fixas não cobrem o elemento em foco (`scroll-padding-top`)                      |
| Teclado               | tudo pelo teclado, em ordem lógica; Esc fecha camadas; foco preso no modal e devolvido à origem    |
| Link de salto         | "Pular para o conteúdo" é o primeiro elemento focável                                              |
| Área de clique        | mínimo 24 × 24px; 36px no desktop e 44px em toque; botão só com ícone tem alvo de 40×40            |
| Rótulos               | todo campo tem rótulo visível associado (`Campo`); botão só com ícone tem `aria-label` + `title`   |
| Semântica             | elementos nativos (`button`, `a`, `table`, `nav`, `main`); nada de `div` clicável                  |
| Cor                   | nenhuma informação só por cor (no mapa, a forma é a informação e a cor é reforço)                  |
| Feedback assíncrono   | `aria-live` em toasts e atualizações, `role="alert"` em erros, `aria-busy` ao carregar             |
| Erros                 | em texto, associados ao campo, com instrução de correção                                           |
| Movimento             | respeitar `prefers-reduced-motion`; animar só `opacity`/`transform`                                |
| Idioma                | `lang="pt-BR"`                                                                                    |

## Como o MONITORA cumpre

- Ícone é decorativo (`aria-hidden`); quem nomeia o controle é o texto ou o `aria-label`
  ([[icones]]).
- Indicador que filtra marca o estado com `aria-pressed` (não só pela cor); tabela ordenável mostra
  `aria-sort` e ícone; `Segmentado` e `Abas` andam com as setas ← →.
- `Modal` e `Gaveta` prendem o foco e fecham com Esc ([[componentes-padrao]]).
- Pesos 400/500/600, nada abaixo de 12px, sentence case ([[design-e-tokens]]).
- Testes: `tests/contraste-dos-temas.spec.js` (Playwright, os dois temas) e
  `tests/cores-so-por-token.test.js`; `src/lib/contraste.ts` calcula o contraste do aviso de
  branding (reutilize em vez de reescrever).

## Relacionadas

- [[mobile]] — alvos de toque e zoom de 200%
- [[textos-da-interface]] — mensagens de erro
- [[testes-de-navegador]] — o teste de contraste
