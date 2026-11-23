---
tipo: referencia
area: front
atualizado: 2026-11-17
---

# Mapa do repositório

Onde fica cada coisa. Não rode `find`/`ls`/`tree` para descobrir a estrutura: ela está aqui, e
cada pasta com regra própria tem um `CLAUDE.md` curto.

## Pastas

```
index.html              entrada principal: <head>, tela de acesso, skeleton (a casca do app é src/app/casca/)
analises.html           entrada do painel de análises
auth/callback.html      callback OAuth (JS em src/auth/callback.ts)
api/                    funções serverless da Vercel (proxy FUNAI, anexos do edital, API para outro sistema)
src/app/                raiz React única (raiz.tsx), rotas (telas.tsx), navegação, sessão, carga, casca
src/ui/                 design system: Topo, Filtros, Kpi, Gráfico, Tabela, Gaveta, Modal… (ui.css)
src/modulos/            as telas em React, uma pasta por tela
src/componentes/        moldura React: barra lateral, busca global, Status das atualizações, dados compartilhados
src/lib/<assunto>/      lógica pura e testável, uma pasta por assunto (tabela abaixo); solto só rpc-contrato.ts
src/modules/            LEGADO: só encolhe, nada novo
src/styles/             CSS do app principal (ordem de import em main.ts)
src/main.ts             bootstrap: importa CSS e instala módulos, em ordem
python/monitora/        cálculo em lote (Python) executado no GitHub Actions
scripts/                checagens do CI, robôs, geradores e utilitários de banco
supabase/               migrations/, rollback/, ensaios/, tests/ e o retrato esquema-atual.sql
apps-script/            código das planilhas de análises (colado no Google; apps-script/LEIA-ME.md)
public/                 copiado para o site: assets/ e data/ (JSON GERADO por scripts/)
tests/                  Vitest (um *.test.ts/*.test.js por assunto, em blocos), Playwright e pytest
server/servidor.ts      servidor web (TypeScript, Node 24, sem dependências)
prototipos/             protótipos estáticos (ex.: parecer em blocos)
docs/                   biblioteca, documentos longos de referência e base de conhecimento da AYA
.github/workflows/      CI e robôs
```

**Nada em `public/` que não deva ser publicado**: tudo ali vai para o site (e para a Vercel).
`dist/` é saída do build: não editar.

## Assunto → pastas

Procurando algo de uma tela, comece pelo nome dela: a tela está em `src/modulos/<nome>/` e a
lógica em `src/lib/<nome>/`. O que várias telas usam fica numa das pastas técnicas.
`check:lib-por-assunto` impede arquivo solto na raiz de `src/lib/` e pasta com mais de 30 arquivos
diretos ([[ci-e-qualidade]]).

| Assunto                | Tela (`src/modulos/`)                                                 | Lógica (`src/lib/`)                                      |
| ---------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| Acessos                | `acessos/`                                                            | `acessos/`                                               |
| Análises               | `analises/`                                                           | `analises/`                                              |
| Aprovados              | `aprovados/`                                                          | `aprovados/` (+ `carta-de-convocacao/`, `exportacao/`)   |
| Automação e robôs      | `automacao/`                                                          | `automacao/`                                             |
| Avaliação documental   | `avaliacao-documental/`                                               | `avaliacao-documental/`                                  |
| Aya                    | `aya/`                                                                | `aya/` (+ `tours/`)                                      |
| Classificação          | `classificacao/`                                                      | `classificacao/` (+ `motor/`)                            |
| Comemoração            | `comemoracao/`                                                        | `comemoracao/` (fogos, motor de efeitos)                 |
| Conferências           | `conferencias/`                                                       | `conferencias/`                                          |
| Configurações          | `configuracoes/`                                                      | `configuracoes/`                                         |
| Cronograma             | `cronograma/`                                                         | `cronograma/`                                            |
| Editais                | `editais/`                                                            | `editais/`                                               |
| Encerramento do edital | `encerramento-do-edital/`                                             | `encerramento-do-edital/`                                |
| Entrevistas            | `entrevistas/`                                                        | `entrevistas/`                                           |
| Mapas e coordenadas    | `mapa-saude-indigena/`, `mapa-de-projetos/`, `editor-de-coordenadas/` | `mapas/` (+ `mapa-saude-indigena/`, `terras-indigenas/`) |
| Módulos e abas         | `modulos/`                                                            | `navegacao/`                                             |
| Página do edital       | `pagina-do-edital/`                                                   | `pagina-do-edital/`                                      |
| Relatórios e painéis   | `paineis-de-dados/` (Relatórios), `paineis-externos/`               | `paineis/`                                               |
| Recursos               | `recursos/`                                                           | `recursos/` (+ `parecer-em-blocos/`)                     |
| Regras do edital       | `regras-do-edital/`                                                   | `regras-do-edital/`                                      |
| Resumo do dia          | `resumo-do-dia/`                                                      | `resumo-do-dia/`                                         |
| Seleção                | `selecao/`                                                            | `selecao/`                                               |
| Triagem                | `triagem/`                                                            | `triagem/`                                               |
| Visão geral            | `visao-geral/`                                                        | `visao-geral/`                                           |

Pastas técnicas de `src/lib/` (várias telas usam):

| Pasta        | O que guarda                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| `sessao/`    | sessão, cliente Supabase, login, entrar sem rede, novas tentativas, cópia da sessão, `env.ts`            |
| `seguranca/` | `sanitize.ts`, `html-security.ts`, `csv-security.ts`, monitor de CSP, origem da requisição              |
| `entrada/`   | tela de acesso: marca, fundo, boas-vindas, esqueleto e textos de carregamento                            |
| `navegacao/` | rotas, menu lateral, módulos e abas, busca global, páginas desligadas, situação dos módulos              |
| `carga/`     | cópias guardadas (cache de payload, validade, versão, rótulo), carga de telas, falha de rede, recarga    |
| `base/`      | formatadores, contraste, planilhas, novidades, versão, erros, Chart.js, ícones, cabeçalho dos documentos |

Os testes ainda não seguem este desenho (`tests/` tem centenas de arquivos soltos); as próximas
etapas da organização, em `docs/_arquivo/planos/2026-11-17-organizacao-por-assunto-design.md`, os
levam para `tests/lib/<assunto>/` e `tests/modulos/<nome>/`, e agrupam `scripts/` e `src/styles/`.

## Não ler por inteiro (grep -n → sed -n 'A,Bp')

| Arquivo                                       | Tamanho    | Observação                                   |
| --------------------------------------------- | ---------- | -------------------------------------------- |
| `public/data/*.json`                          | até 2,3 MB | gerados                                      |
| `supabase/esquema-atual.sql`                  | 3,6 MB     | retrato do schema: `grep -n 'FUNCTION private."FC_X"'` |
| `src/styles/app.css`                          | 110 KB     | CSS base                                     |
| `index.html`                                  | 24 KB      | `<head>` e entrada                           |
| `src/modules/indigenous-territories-layer.ts` | 41 KB      | partes puras em `src/lib/mapas/terras-indigenas/`  |
| `src/modules/aya-conhecimento-gerado.js`      | 27 KB      | gerado de `docs/aya/`                        |
| `docs/banco-de-dados.md`, `docs/design-system-agsus.md` | longos | leia a seção do assunto              |
| `package-lock.json`, `dist/`, `node_modules/` |            | nunca                                        |

## Relacionadas

- [[arquitetura-do-front]] — como as pastas do front se encaixam
- [[nova-tela-e-legado]] — o que é legado e como sai
- [[regras-do-codigo]] — os arquivos de `src/lib/` que exigem cuidado
- [[comandos-e-ambiente]] — rodar o mínimo
- [[documentacao]] — onde fica a documentação
