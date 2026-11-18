# Organização por assunto, etapa 1 (`src/lib/`): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar os 242 arquivos soltos da raiz de `src/lib/` e colocá-los em pastas por assunto, sem mudar comportamento.

**Architecture:** Um mapa (JSON) diz o destino de cada arquivo. Um script descartável, guiado pelo mapa, faz `git mv` e reescreve todo caminho que aponta para o que se moveu (imports relativos e caminhos em texto), um lote por vez. Cada lote termina com as checagens do projeto verdes e um commit.

**Tech Stack:** Node 24 (script `.mjs` sem dependências), git, TypeScript, Vitest.

**Spec:** `docs/_arquivo/planos/2026-11-17-organizacao-por-assunto-design.md` (leia inteiro, em especial "O que a reescrita de caminhos tem de cobrir").

**Mapa de destinos:** `docs/_arquivo/planos/2026-11-17-organizacao-etapa-1-destinos.json` (já conferido: cobre os 242 arquivos, sem falta, sobra ou repetição).

## Global Constraints

- **É só mover e ajustar caminho.** Nenhum arquivo é renomeado, dividido, juntado ou tem lógica alterada. Em arquivo movido, o diff só pode ter linhas de caminho.
- Mover sempre com `git mv` (o histórico tem de seguir o arquivo).
- Fica solto em `src/lib/`: só `rpc-contrato.ts` e `CLAUDE.md`.
- Nenhuma pasta de assunto com mais de 30 arquivos diretos.
- Não se reescrevem: `docs/superpowers/`, `docs/_arquivo/`, `dist/`, `node_modules/`, `supabase/`, `public/data/`, `package-lock.json`.
- Não se mexe em `src/modulos/`, `src/ui/`, `src/app/`, `tests/` (lugar dos arquivos), `scripts/` (lugar dos arquivos) além de corrigir caminhos dentro deles.
- O script de mover **não entra no repositório**: fica em `.superpowers/organizacao/` (já ignorada por `.git/info/exclude`).
- Regras do projeto: `CLAUDE.md` da raiz e `docs/biblioteca/fluxo-git-e-prs.md` (ramo, mensagem de commit em português, PR). Leia antes da Tarefa 1.
- Nada de `git push` nem PR sem o João pedir.

## Review Focus

1. **Caminho em texto que o TypeScript não vê** (`readFileSync("src/lib/x.ts")`, `readdirSync("src/lib/aya-tours")`, listas de permitidos em `scripts/check-*.mjs`): espera-se que continuem achando o arquivo. Pinado na Tarefa 2, passo 5 (`grep` de caminhos antigos vazio) e em cada lote por `npm test` + `npm run check:architecture`.
2. **Import dinâmico ou caminho montado em tempo de execução** (`import(variavel)`, `import.meta.glob`, template string com `lib/`): o script não resolve. Pinado na Tarefa 1, passo 5 (relatório) e na Tarefa 6 (`npm run build` + abrir o app).
3. **Arquivo gerado cujo gerador escreve em caminho fixo** (`mapa-de-icones-lucide.ts` por `npm run icones`; conhecimento da Aya por `npm run aya:conhecimento`): rodar o gerador depois de mover não pode recriar o arquivo no lugar antigo. Pinado na Tarefa 2, passo 6 e na Tarefa 5.
4. **Funções da Vercel** (`api/*.ts` importa `../src/lib/*.js`; `includeFiles`/`excludeFiles`): o pacote tem de continuar achando e continuar leve. Pinado nos lotes pelo teste `tests/funcoes-da-vercel-leves.test.js` e na Tarefa 6 pelo build.
5. **Ordem ou fatiamento do bundle preso a caminho** (`vite.config.js`, `sw.js`, `cache-do-service-worker`): o build tem de gerar os mesmos pedaços. Pinado na Tarefa 6 (`check:bundle-size` e comparação da lista de arquivos de `dist/assets` antes × depois).

---

### Task 1: Ramo, script de mover e conferência do mapa

**Files:**
- Create: `.superpowers/organizacao/mover.mjs` (fora do git)
- Modify: `docs/_arquivo/planos/2026-11-17-organizacao-etapa-1-destinos.json` (só se a conferência mandar trocar destino)

**Interfaces:**
- Produces: `node .superpowers/organizacao/mover.mjs <mapa.json> --lote <nome> [--simular]`, onde `<nome>` é uma chave de `lotes` no mapa (`tecnicas`, `telas-a-e`, `telas-m-v`) ou `pastas` (as de `pastas_que_mudam`). `--simular` não altera nada e imprime o relatório. `node … --conferir` imprime a conferência do mapa (passo 4). `node … --antigos` lista toda menção restante a caminho antigo já movido.

- [ ] **Step 1: Criar o ramo a partir da `main` atualizada**

```bash
git fetch origin
git switch -c organizacao/lib-por-assunto origin/main
```

Os dois documentos novos em `docs/superpowers/` (spec e plano, ainda não versionados) vêm junto. Se o `fetch` falhar por rede, pare e avise: não comece de uma `main` velha.

- [ ] **Step 2: Guardar a linha de base**

Rode `npm run typecheck`, `npm run check:architecture`, `npm test` e `npm run build`. Anote o que já falha hoje (se algo falhar) e salve `ls dist/assets` em `.superpowers/organizacao/dist-antes.txt`. Falha que já existia não é desta etapa, mas tem de estar anotada antes de mover.

- [ ] **Step 3: Escrever `mover.mjs`**

O que ele faz para um lote, nesta ordem:

1. Monta a tabela `antigo → novo` a partir do mapa: `src/lib/<nome>.ts → src/lib/<destino>/<nome>.ts` para cada nome das pastas do lote; para `pastas`, cada arquivo sob `src/lib/<pasta>/` → `src/lib/<novo>/…`.
2. `git mv` de cada um (criando a pasta).
3. **Imports relativos.** Em todo `.ts`, `.tsx`, `.js`, `.mjs` versionado (fora das pastas excluídas nas Global Constraints): para cada literal de string que começa com `./` ou `../`, resolve contra o lugar **antigo** do arquivo que o contém, tentando: exato, `+.ts`, `+.tsx`, `+.js`, e `.js` no lugar de `.ts`. Se o alvo ou o próprio arquivo se moveu, recalcula o relativo do lugar **novo** para o alvo **novo**, mantendo o estilo de extensão do original (sem extensão, `.ts` ou `.js`) e o prefixo `./` quando ficar na mesma pasta. Isso cobre `import`, `export … from`, `import()`, `vi.mock()` e `new URL("…", import.meta.url)`.
4. **Caminhos em texto.** Em todo arquivo de texto versionado (inclui `.md`, `.py`, `.yml`, `.json`, `.html`), troca `src/lib/<antigo>` por `src/lib/<novo>` quando a ocorrência termina em `.ts`, `.js`, ou em fim de palavra (não seguida de letra, dígito ou `-`). Casa do nome mais longo para o mais curto (`fogos-show` antes de `fogos`). Para `pastas`, troca o prefixo `src/lib/<pasta>` (seguido de `/`, aspas, crase ou fim de palavra).
5. Imprime o relatório: arquivos movidos, arquivos reescritos, e a lista de **avisos**: arquivo movido que contém `import.meta.url`, `__dirname` ou `process.cwd`; `import(` com argumento não literal; `import.meta.glob`; string com `lib/` montada por template.

- [ ] **Step 4: Conferir o mapa pelo grafo de imports**

`--conferir` imprime, para cada nome em `duvidas` e para qualquer arquivo cujo destino de tela não bate, a contagem de quem o importa por pasta de `src/modulos/<x>/`, `src/componentes/<x>/` e `src/app/`. Regra do spec: o dono é quem mais importa; usado por três ou mais assuntos vai para pasta técnica (`base/` ou `carga/` só nesse caso). Ajuste o JSON onde a regra mandar e registre cada troca em uma lista "trocas de destino" no fim deste plano. Depois, confira no JSON: 242 nomes, nenhuma pasta com mais de 30.

Expected: `--conferir` termina com `242 arquivos, 0 sem destino, 0 repetidos, maior pasta ≤ 30`.

- [ ] **Step 5: Simular tudo e ler os avisos**

Run: `node .superpowers/organizacao/mover.mjs docs/_arquivo/planos/2026-11-17-organizacao-etapa-1-destinos.json --lote tecnicas --simular` (e o mesmo para `telas-a-e`, `telas-m-v`, `pastas`).

Expected: nenhuma alteração no `git status`. Para cada aviso, abra o arquivo e decida: ou o script passa a tratar o caso, ou ele entra numa lista de "ajuste à mão" do lote. Não siga com aviso sem destino.

- [ ] **Step 6: Confirmar que `git mv` não parece "arquivo novo" para as checagens**

Leia `scripts/check-no-new-patch-layers.mjs` e `scripts/check-legado-so-encolhe.mjs`: confirme que nenhum dos dois reprova arquivo de `src/lib/` movido (o primeiro filtra por nome; o segundo só olha `src/modules/`). Se algum reprovar, pare e avise antes de mover.

- [ ] **Step 7: Commit**

```bash
git add docs/_arquivo/planos/2026-11-17-organizacao-por-assunto-design.md docs/_arquivo/planos/2026-11-17-organizacao-etapa-1-src-lib.md docs/_arquivo/planos/2026-11-17-organizacao-etapa-1-destinos.json
git commit -m "Organização por assunto: desenho, plano e mapa de destinos da etapa 1"
```

---

### Task 2: Lote das pastas técnicas

`sessao/`, `seguranca/`, `entrada/`, `navegacao/`, `carga/`, `base/`. É o lote com mais arquivos dependentes (quase tudo importa `sessao` e `formatters`), por isso vem primeiro: se o script erra, erra aqui.

**Files:**
- Move: os arquivos das seis pastas, conforme o mapa.
- Modify (caminhos): tudo o que os importa ou cita; em especial `scripts/check-supabase-auth-architecture.mjs` (lista de permitidos com `src/lib/supabaseClient.ts`), `scripts/gerar-icones-lucide.mjs` (escreve `mapa-de-icones-lucide.ts`), `vite.config.js` (`html-security`, `cache-do-service-worker`, `novidades.ts`), `api/*.ts`, `server/servidor.ts` (comentário sobre `rotas.ts`).

**Interfaces:**
- Consumes: `mover.mjs` da Tarefa 1.

- [ ] **Step 1: Mover**

Run: `node .superpowers/organizacao/mover.mjs docs/_arquivo/planos/2026-11-17-organizacao-etapa-1-destinos.json --lote tecnicas`, depois os ajustes à mão que a Tarefa 1 listou para este lote.

- [ ] **Step 2: Tipos**

Run: `npm run typecheck`
Expected: sem erro novo em relação à linha de base. Erro de "módulo não encontrado" é caminho que o script não pegou: corrija o **script** e rode de novo, não o arquivo à mão (o mesmo caso volta nos próximos lotes).

- [ ] **Step 3: Checagens de arquitetura**

Run: `npm run check:architecture`
Expected: passa. Atenção a `check:auth-architecture`: a lista de permitidos tem de citar `src/lib/sessao/supabaseClient.ts`.

- [ ] **Step 4: Testes**

Run: `npm test`
Expected: mesmo resultado da linha de base.

- [ ] **Step 5: Nenhum caminho antigo sobrou**

Run: `node .superpowers/organizacao/mover.mjs <mapa> --antigos`
Expected: lista vazia fora de `docs/superpowers/` e `docs/_arquivo/`.

- [ ] **Step 6: Gerador de ícones escreve no lugar novo**

Run: `npm run icones` e depois `git status --short src/lib`
Expected: nenhum `src/lib/mapa-de-icones-lucide.ts` recriado na raiz; nenhum diff em `src/lib/base/mapa-de-icones-lucide.ts`.

- [ ] **Step 7: O diff dos movidos é só caminho**

Run: `git diff --cached -M --stat -- src/lib` (depois de `git add -A`)
Expected: cada arquivo aparece como renomeado (`=>`), com poucas linhas alteradas. Abra três ao acaso com `git diff --cached -M -- <arquivo>` e confirme que só linhas de import mudaram.

- [ ] **Step 8: Lint, formato e commit**

```bash
npm run lint && npm run format:check
git commit -m "Organização por assunto: src/lib ganha sessao, seguranca, entrada, navegacao, carga e base"
```

---

### Task 3: Lote das telas de A a E

`acessos/`, `analises/`, `aprovados/` (com `carta-de-convocacao/` e `exportacao/`), `automacao/`, `aya/`, `comemoracao/`, `conferencias/`, `configuracoes/`, `cronograma/`, `editais/`, `encerramento-do-edital/`, `entrevistas/`.

**Files:**
- Move: conforme o mapa.
- Modify (caminhos): em especial `api/aprovados.ts`, `api/cronograma.ts`, `api/editais.ts` (importam `../src/lib/*.js`), `scripts/sincronizar-entrevistas.mjs`, `scripts/compilar-conhecimento-aya.mjs`, comentários em `python/monitora/**` que citam `modelo-de-convocacao.ts`.

- [ ] **Step 1: Mover** — `--lote telas-a-e`, mais os ajustes à mão listados.
- [ ] **Step 2: `npm run typecheck`** — sem erro novo.
- [ ] **Step 3: `npm run check:architecture`** — passa.
- [ ] **Step 4: `npm test`** — igual à linha de base (inclui `tests/funcoes-da-vercel-leves.test.js`).
- [ ] **Step 5: `--antigos`** — vazio fora da história.
- [ ] **Step 6: Diff dos movidos é só caminho** — como na Tarefa 2, passo 7.
- [ ] **Step 7: Lint, formato e commit**

```bash
npm run lint && npm run format:check
git commit -m "Organização por assunto: src/lib de acessos a entrevistas vai para a pasta da tela"
```

---

### Task 4: Lote das telas de M a V e das pastas que mudam de lugar

`mapas/`, `paineis/`, `recursos/`, `regras-do-edital/`, `resumo-do-dia/`, `selecao/`, `visao-geral/`; e as pastas `aya-tours/ → aya/tours/`, `mapa-saude-indigena/ → mapas/mapa-saude-indigena/`, `terras-indigenas/ → mapas/terras-indigenas/`, `parecer-em-blocos/ → recursos/parecer-em-blocos/`.

**Files:**
- Move: conforme o mapa (`lotes.telas-m-v` e `pastas_que_mudam`).
- Modify (caminhos): em especial `tests/aya-tours.test.js` e `tests/app/gaveta-do-celular.test.ts` (`readdirSync("src/lib/aya-tours")`), `scripts/compilar-contornos-dos-dseis.mjs` e `scripts/compilar-terras-indigenas.mjs` (importam e escrevem sob `src/lib/mapa-saude-indigena/` e `terras-indigenas/`), `api/dseis.ts`, `api/funai-geodata.ts`, `scripts/sincronizar-selecao.mjs`.

- [ ] **Step 1: Mover** — `--lote telas-m-v` e depois `--lote pastas`, mais os ajustes à mão.
- [ ] **Step 2: `npm run typecheck`** — sem erro novo.
- [ ] **Step 3: `npm run check:architecture`** — passa.
- [ ] **Step 4: `npm test`** — igual à linha de base.
- [ ] **Step 5: `--antigos`** — vazio fora da história.
- [ ] **Step 6: Geradores de mapa escrevem no lugar novo**

Leia em `scripts/compilar-contornos-dos-dseis.mjs` e `scripts/compilar-terras-indigenas.mjs` para onde escrevem; se for sob `src/lib/`, confirme que o caminho de saída agora é o novo. **Não rode** se dependerem de rede ou de fonte externa (veja `scripts/CLAUDE.md`); a leitura do caminho basta.

- [ ] **Step 7: A raiz está limpa**

Run: `git ls-files src/lib | grep -vE '^src/lib/[^/]+/'` (arquivos diretos de `src/lib/`)
Expected: exatamente `src/lib/CLAUDE.md` e `src/lib/rpc-contrato.ts`.

- [ ] **Step 8: Diff dos movidos é só caminho, lint, formato e commit**

```bash
npm run lint && npm run format:check
git commit -m "Organização por assunto: src/lib de mapas a visão geral; raiz fica só com o contrato de RPC"
```

---

### Task 5: Checagem que impede a volta, documentação e Aya

**Files:**
- Create: `scripts/check-lib-sem-arquivo-solto.mjs`
- Test: `tests/scripts/check-lib-sem-arquivo-solto.test.ts`
- Modify: `package.json` (script `check:lib-por-assunto`, incluído em `check:architecture`), `src/lib/CLAUDE.md`, `CLAUDE.md` (raiz), `docs/biblioteca/mapa-do-repositorio.md`, `docs/biblioteca/logica-em-src-lib.md`, `docs/biblioteca/arquitetura-do-front.md`, `docs/biblioteca/scripts-e-checagens.md`, `docs/aya/*.md` (só caminhos), `src/modules/aya-conhecimento-gerado.js` (regenerado).

**Interfaces:**
- Produces: `conferirLib(arquivos: string[]): string[]` exportada pelo script: recebe caminhos relativos à raiz do repositório (saída de `git ls-files src/lib`) e devolve as mensagens de problema (vazio = tudo certo). Executado direto, imprime as mensagens e sai com código 1 se houver alguma.

- [ ] **Step 1: Escrever o teste que falha**

Siga o modelo de um teste de script que já exista (procure em `tests/` por um que importe de `../scripts/check-…`). Casos, com estes valores:

```ts
expect(conferirLib(["src/lib/CLAUDE.md", "src/lib/rpc-contrato.ts", "src/lib/aya/busca-da-aya.ts"])).toEqual([]);
expect(conferirLib(["src/lib/rpc-contrato.ts", "src/lib/formatters.ts"])).toEqual([
  "src/lib/formatters.ts está solto em src/lib/: coloque na pasta do assunto",
]);
// 31 arquivos diretos em src/lib/aya/ → uma mensagem citando "src/lib/aya/" e "31"
// 30 arquivos diretos em src/lib/aya/ e 5 em src/lib/aya/tours/ → []
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/scripts/check-lib-sem-arquivo-solto.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar `conferirLib`** em `scripts/check-lib-sem-arquivo-solto.mjs`, no estilo dos outros `check-*.mjs` (leia `scripts/CLAUDE.md`). Permitidos soltos: `CLAUDE.md` e `rpc-contrato.ts`. Limite: 30 arquivos diretos por pasta.
- [ ] **Step 4: Rodar e ver passar** — mesmo comando → PASS.
- [ ] **Step 5: Ligar no build**

Em `package.json`: `"check:lib-por-assunto": "node scripts/check-lib-sem-arquivo-solto.mjs"` e acrescentar `&& npm run check:lib-por-assunto` ao fim de `check:architecture`.

Run: `npm run check:architecture` → passa.

- [ ] **Step 6: Documentação**

- `src/lib/CLAUDE.md`: os nomes soltos citados (`sessao.ts`, `sanitize.ts`, `planilhas.ts`…) ganham a pasta; a regra "arquivo novo" vira "na pasta do assunto, nunca solto na raiz (`check:lib-por-assunto` quebra o build)"; o comando de teste continua valendo.
- `CLAUDE.md` da raiz: `src/lib/sanitize.ts` → `src/lib/seguranca/sanitize.ts`, `src/lib/planilhas.ts` → `src/lib/base/planilhas.ts` (ou o destino final do mapa); `src/lib/rpc-contrato.ts` fica.
- `docs/biblioteca/mapa-do-repositorio.md`: na árvore, `src/lib/` passa a dizer "uma pasta por assunto"; nova seção **"Assunto → pastas"** com uma linha por assunto: tela (`src/modulos/x/`), lógica (`src/lib/x/`), e as seis pastas técnicas com o que guardam. Atualize o campo `atualizado:`.
- `docs/biblioteca/logica-em-src-lib.md`, `arquitetura-do-front.md`, `scripts-e-checagens.md` (a checagem nova): caminhos e a regra.
- Nomes de arquivo citados **sem** `src/lib/` na frente (o script não pega): `grep -rn` em `docs/biblioteca/` e nos `CLAUDE.md` pelos nomes do mapa precedidos de crase e corrija os que ficaram enganosos.

Run: `npm run check:docs` → passa.

- [ ] **Step 7: Aya**

Os caminhos em `docs/aya/*.md` já foram trocados pelo script nos lotes. Confira com `git diff origin/main --stat -- docs/aya` que só linhas com caminho mudaram, e regenere:

Run: `npm run aya:conhecimento` e depois `npx vitest run tests/aya-conhecimento-md.test.js tests/aya-knowledge.test.js`
Expected: PASS; `src/modules/aya-conhecimento-gerado.js` muda só nos caminhos.

- [ ] **Step 8: Lint, formato e commit**

```bash
npm run lint && npm run format:check
git commit -m "Organização por assunto: checagem que impede arquivo solto em src/lib e documentação"
```

---

### Task 6: Verificação final da etapa

- [ ] **Step 1: Tudo, do zero**

Run: `npm run typecheck && npm run check:architecture && npm test && npm run build`
Expected: tudo passa (ou igual à linha de base anotada na Tarefa 1).

- [ ] **Step 2: O bundle é o mesmo**

Compare `ls dist/assets` com `.superpowers/organizacao/dist-antes.txt`: a mesma quantidade de pedaços e os mesmos nomes sem o hash. `check:bundle-size` (já roda no build) passa.

- [ ] **Step 3: O app abre**

Run: `npm run dev`, abrir `http://127.0.0.1:8000`. Confira que a tela de acesso carrega sem erro no console e, se houver sessão disponível, abra Visão geral, Entrevistas, Aprovados e o Mapa da Saúde Indígena (cobrem `carga-de-telas`, import dinâmico e os mapas). Sem sessão, rode `npm run test:smoke`.

- [ ] **Step 4: Histórico seguiu os arquivos**

Run: `git log --follow --oneline -3 -- src/lib/sessao/sessao.ts`
Expected: aparecem commits anteriores a esta etapa.

- [ ] **Step 5: Entregar ao João**

Resumo com: quantos arquivos movidos por pasta, as "trocas de destino" da Tarefa 1, o que já falhava antes (se algo), e o que foi conferido no navegador. Pergunte se quer o push e o PR (regras em `docs/biblioteca/fluxo-git-e-prs.md`); não abra por conta própria.

---

## Trocas de destino (preenchido na Tarefa 1)

Pelo grafo de imports (`--conferir`): quem mais importa é o dono; o que várias telas usam por
igual vai para `base/`.

| Arquivo                       | Era                          | Ficou         | Por quê                                   |
| ----------------------------- | ---------------------------- | ------------- | ----------------------------------------- |
| `pagina-desligada`            | `entrada`                    | `navegacao`   | só `src/app` usa, junto das rotas          |
| `atalhos-de-filtro`           | `navegacao`                  | `visao-geral` | só a Visão geral importa                  |
| `modalidades-de-concorrencia` | `aprovados`                  | `analises`    | só `analises-curriculares` importa        |
| `cabecalho-dos-documentos`    | `aprovados/carta-de-convocacao` | `base`     | cinco telas usam                          |
| `conflito-de-versao`          | `configuracoes`              | `base`        | seis telas usam                           |
| `nome-da-versao`              | `configuracoes`              | `base`        | avaliação, entrevistas, classificação, ui |
| `fases-do-processo`           | `editais`                    | `visao-geral` | só a lógica da Visão geral importa        |
| `relatorio-da-diretoria`      | `paineis`                    | `visao-geral` | só a Visão geral importa                  |
| `demandas-internas`           | `resumo-do-dia`              | `cronograma`  | Cronograma importa 7 de 10                |
| `anexos-do-candidato`         | `selecao`                    | `aprovados`   | só Aprovados importa                      |
| `telas-com-linhas`            | `visao-geral`                | `navegacao`   | só `src/app` usa                          |
| `pendencias-do-edital`        | `encerramento-do-edital`     | `aprovados`   | só Aprovados importa                      |
| `vagas-reabertas`             | `aprovados`                  | `visao-geral` | só a Visão geral importa                  |
| `aprovados-por-edital`        | `aprovados`                  | `editais`     | só Editais importa                        |

Ficaram pelo nome, embora outra tela importe mais (o conceito é da tela do nome):
`agenda-das-entrevistas`, `dados-da-agenda`, `tipos-da-agenda`, `entrevista-vigente`
(Classificação importa), `dados-dos-recursos`, `documento-da-resposta`, `cronograma-do-edital`,
`edital-de-treinamento`, `etapas-de-edital`, `texto-da-conferencia`, `filtro-da-aya`,
`tema-do-painel`, `visao-geral-da-area`, `marca-da-barra-lateral`, `access-background-storage`.

## Recomeço sobre a main de 17/11 à tarde

A main recebeu 21 commits durante a primeira execução (modo offline, comemorações, responsivo e a
reorganização da documentação, que moveu `docs/superpowers/` para `docs/_arquivo/planos/`). O merge
deu 78 conflitos; como a parte mecânica é feita pelo script, o trabalho foi refeito do zero sobre a
main atual (a primeira execução ficou no ramo local `organizacao/lib-por-assunto-v1`). Os arquivos
novos da main ganharam destino pela mesma regra:

| Arquivo                 | Ficou          | Por quê                                              |
| ----------------------- | -------------- | ---------------------------------------------------- |
| `conducao-para-o-campo` | `entrevistas`  | só a condução de entrevistas importa                 |
| `perfil-sem-rede`       | `sessao`       | entrar sem rede é regra da sessão                    |
| `sessao-sem-rede`       | `sessao`       | idem; importado por `supabaseClient`                 |
| `rotulo-da-copia`       | `carga`        | quatro telas usam; data da cópia guardada            |
| `validade-das-copias`   | `carga`        | `cache-de-payload` e a varredura das cópias          |
| `versao-do-pacote`      | `carga`        | cópias guardadas; cinco lugares usam                 |
| `rotulo-em-linhas`      | `selecao`      | só os painéis da Seleção importam                    |
