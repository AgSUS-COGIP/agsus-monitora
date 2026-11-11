# Acabamento visual: o sistema cumprindo a própria norma

Data: 2026-11-11 · Status: proposta, aguardando aprovação

## Intenção

Melhorar a experiência de quem usa o Monitora (Yeendé) pelo **acabamento**: a interface tem que
parecer uma só, calma e precisa, em todas as telas. O ponto de partida foi a skill externa
"high-end-visual-design" (`Leonxlnx/taste-skill`, MIT). Decidiu-se que **a norma AgSUS
(`docs/design-system-agsus.md`) prevalece** sobre ela. Lida a skill inteira, quase tudo que ela tem
de compatível a norma já pede, e o resto a norma proíbe. O trabalho, portanto, é fazer o sistema
cumprir a norma que já existe, tela por tela, e travar para não regredir.

## Objetivos

1. Toda tela em `src/modulos/` e todo componente de `src/ui/` aderem à norma AgSUS (seções 2 a 17
   e checklist da seção 21).
2. Os desvios detectáveis por máquina viram checagem no `check:architecture`, no modelo "só
   encolhe" do `check-legado-so-encolhe`: o número de ocorrências por arquivo nunca aumenta.
3. Cada lote é entregue como PR próprio, conferido no navegador (claro, escuro, 375px e 1280px).

## Não objetivos

- Trocar fonte (Geist fica), ícones (Lucide fica) ou a paleta institucional.
- Mudar o que cada tela faz (regras, dados, permissões) ou mexer em RPC ou banco. Estrutura visual,
  ação principal, estados e textos **entram**, corrigidos direto no PR do lote (decisão do
  usuário); quando o texto muda, a página da Aya em `docs/aya/` muda junto
  (`npm run aya:conhecimento`).
- Mexer nas planilhas do Apps Script ou nos PDFs gerados (espelhos, cartas).
- Migrar o legado de `src/modules/` (segue o próprio ritmo). Só se corrige ali o que for trivial.

## Antiobjetivos (falhou mesmo se "funcionar")

- Qualquer item que a norma proíbe e a skill pede: animação de entrada em seção, cascata, vidro,
  pílula em botão ou badge, cartão com borda dupla, respiro de agência (96–160px), uma "vibe" por
  tela.
- Tela mais lenta, mais animada ou menos densa para o trabalho diário (filas, tabelas).
- Mudança visual que quebre o `prefers-reduced-motion`, o foco visível ou o contraste AA.
- PR gigante "de tudo", difícil de revisar e de reverter.

## Restrições

- Regras do `CLAUDE.md`: token em vez de hex, sem `!important` ou `#id` novos, sem dependência
  nova, sem `MutationObserver` nem remendo, HTML só pelos sanitizadores.
- `main` é produção: um assunto por PR, CI verde, sem mover arquivos em massa
  (`docs/biblioteca/fluxo-git-e-prs.md`).
- Mudança que o usuário percebe ganha nota em `src/lib/novidades.ts`.

## Abordagens consideradas

| Abordagem | Troca | Decisão |
|---|---|---|
| 1. Auditoria de acabamento tela por tela contra a norma, com trava "só encolhe" | Trabalho longo, mas cada PR é pequeno e o usuário sente o resultado | **Escolhida** |
| 2. Skill própria "acabamento-agsus" para telas novas | Previne, mas não corrige o que existe | Fica para depois |
| 3. Instalar a skill externa com aviso "a norma prevalece" | Conflito permanente (ícones, fontes, layout a cada uso) | Descartada |

## Lista de verificação (por tela)

Sai da norma, mais três práticas da skill que não a contrariam (marcadas com *).

**Por máquina (vira checagem):**

- Cor só por token: nenhum hex, `rgb()` ou `hsl()` fora de `src/styles/tokens.css`.
- Raio só por `--radius-*`, sombra só por `--shadow-*`, z-index só pelos tokens da tabela 7.2,
  duração e curva só por `--duration-*` e `--ease-*` (nenhum `ease-in-out`, `ease` ou `linear` em
  transição).
- `!important` não aumenta.
- Transição não anima `width`, `height`, `top` ou `left` (exceto a sidebar).
- `backdrop-filter` só em camada fixa ou sobreposta*.

**Por olho (conferido no navegador):**

- Hierarquia e espaço antes de borda e card (2.1, 2.2, 9.1, 9.4); uma ação principal por tela (2.4).
- Tipografia na escala 4.2, com algarismos tabulares nos números.
- Espaçamento na escala 5.1 e 5.2, com densidade de 9.5.
- Componentes conforme a seção 11 (botões, campos, tabelas, badges, menus, modais, toasts).
- Estados de vazio, carregamento e erro projetados (12).
- Movimento só para mostrar o que mudou, com `prefers-reduced-motion` respeitado (7.1).
  Nenhuma mudança de estado visível sem interpolação*. Botão "afunda" de leve ao pressionar
  (`transform: scale(.98)`, `--duration-fast`)*.
- Modo escuro (3.6), 375px (16), teclado, foco e contraste (17).
- Textos conforme 15 e `textos-da-interface`.

## Ordem dos lotes

0. **Trava:** script `check-acabamento-so-encolhe.mjs`, com a linha de base atual, ligado ao
   `check:architecture`. Linha de base medida em 2026-11-11 nos 58 CSS: ~275 hex (parte delas em
   `tokens.css`, permitidas), 166 `!important`, 93 raios fixos, 42 z-index numéricos, 32 sombras à
   mão.
1. **Base:** `src/styles/` (unificar `--shadow` e `--z-*` de `app.css` com `tokens.css`) e
   `src/ui/`. É onde uma correção conserta mais telas.
2. **Estrutura:** sidebar, header, page header, abas e breadcrumb (`src/app/`).
3. **Processo seletivo, na ordem do fluxo:** editais e regras-do-edital → triagem e seleção →
   avaliacao-documental → recursos → entrevistas → classificacao → aprovados e
   encerramento-do-edital.
4. **Acompanhar:** visao-geral, analises, cronograma, conferencias, resumo-do-dia,
   paineis-externos, mapas (mapa-saude-indigena, mapa-de-projetos, editor-de-coordenadas).
5. **Administração e demais:** acessos, configuracoes, automacao, modulos, aya, comemoracao.

Cada lote: auditar → corrigir → baixar a linha de base da trava → conferir no navegador → testes
em Docker → PR.

## Conferência antes do PR (decisões do usuário)

1. **Navegador, com sessão simulada:** build com `VITE_SUPABASE_URL=https://teste.supabase.co` e
   as telas do lote abertas com as RPCs respondidas por `page.route`
   (`tests/sessao-simulada.spec.js`). As respostas simuladas incluem casos de tabela cheia, texto
   longo, vazio e erro, para não esconder problemas. Capturas em claro, escuro, 375px e 1280px vão
   na descrição do PR.
2. **Docker:** `docker compose up --build -d` (ou `docker build` + `docker run`, conforme
   `docs/biblioteca/servidor-web.md`), depois o smoke e a sessão simulada do Playwright contra
   `127.0.0.1:8000`, como o CI faz. Só abre PR com isso verde.

## Decisões tomadas por quem escreveu este documento (corrigíveis)

- **Trava por arquivo, sobre todo CSS de `src/` e os `style`/cores literais em `.tsx`:** a contagem
  de cada arquivo só pode cair. Arquivo apagado (tela migrada) sai da linha de base sozinho. CSS que
  estiliza legado entra na contagem; só se corrige ali o que for trivial.
- **Critério de saída do lote:** os arquivos do lote chegam a zero em hex, raio, sombra, z-index,
  curva e `!important`. Exceção legítima (sobrepor CSS do Leaflet, círculo `50%`, z-index local
  dentro de contexto de empilhamento, barra de progresso, cores de mapa, gráfico, marca e PDF) leva
  o marcador `/* acabamento: permitido — <motivo> */` na linha, e o script aceita.
- **Tokens divergentes:** valem os do projeto (`src/styles/tokens.css`), como manda a
  precedência da norma (seção 0). Duplicatas em `app.css` passam a apontar para eles, e a diferença
  em relação à norma fica registrada em `docs/biblioteca/design-e-tokens.md`. Mudança de valor que
  altere o app inteiro vai em PR próprio.
- **Novidades:** só PR com diferença visível ganha nota em `src/lib/novidades.ts`, redigida no
  tom de `textos-da-interface`.
- **Linha de base:** remedida ao escrever o script. Os números acima são aproximados.

## Fica a critério de quem executa

- O agrupamento exato dos módulos em PRs dentro de cada lote.
- O formato do script de trava e do arquivo de linha de base.
- Corrigir ou só registrar desvios no legado (`src/modules/`) caso a caso.
- Quando um desvio revela regra que a norma não cobre: seguir a 19.3 (decidir, registrar e propor
  a nota), sem inventar padrão novo.
