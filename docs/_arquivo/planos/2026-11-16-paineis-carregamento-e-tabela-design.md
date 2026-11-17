# Painéis: carregamento rápido, largura das colunas e origem dos dados

Data: 16/11/2026 · Módulo: Painéis (bloco Dados) · Antecede: [[modulo-paineis-de-dados]],
`docs/_arquivo/planos/2026-11-13-fontes-das-colunas-dos-paineis-design.md`.

## Por que

Os três relatórios dos Painéis servem para conferir dados. Hoje eles abrem devagar. Medição de
16/11/2026, feita com o usuário administrador, só leitura, no banco de produção:

| Área | Relatório | Tempo no banco | Resposta |
|---|---|---|---|
| Saúde indígena | Aprovados | 4,3 s | 4,8 MB |
| Projetos | Aprovados | 5,5 s | 5,7 MB |
| Saúde indígena | Editais por cargo | 2,6 s | 726 KB |

Cada RPC refaz todo o cálculo a cada leitura e devolve todas as linhas (até 13 mil). A tela,
porém, só mostra 50. Também foi pedido que a pessoa possa ajustar a largura das colunas e que
cada tabela explique de onde vêm os dados.

## Objetivos

1. **Abrir rápido.** A página visível de qualquer relatório chega em menos de 1 s, em
   condições normais.
2. **Largura das colunas.** A pessoa arrasta a borda do cabeçalho e a coluna alarga ou estreita.
   Ao recarregar a página, as larguras voltam ao padrão.
3. **Origem dos dados.** Um ⓘ ao lado do nome de cada relatório explica de onde vêm os dados e
   quais colunas usam, na área, uma fonte diferente da padrão.

## Fora do escopo

- **Melhorias da gaveta "Fontes dos dados"** e colunas novas da planilha da Auditoria. Ficam
  para depois, por decisão do usuário.
- **Busca, ordenação e filtro na tabela.** Não existem hoje e não entram agora.
- **Pendências da revisão do PR #829.** Ficam para outra rodada, exceto onde este trabalho
  passa pelo mesmo código.

## Anti-objetivos

- **Nenhum vazamento de visibilidade.** Quem hoje não vê um edital (recorte da coordenação,
  `FC_EDITAIS_VISIVEIS`) não pode passar a vê-lo porque o resultado ficou pronto.
- **Downloads completos.** O CSV e o XLSX continuam levando todas as linhas.
- **Data honesta.** A tela não pode esconder que o dado é de um cálculo anterior: a data
  mostrada é a do cálculo.

## Abordagens consideradas

- **A. Resultado pronto no banco + paginação no servidor (escolhida pelo usuário, 16/11).**
  O cálculo de hoje roda fora do caminho da leitura e grava as linhas prontas. A tela lê só a
  página visível. Custo: o dado pode estar até 1 h atrasado, a menos que alguém sincronize.
- **B. Só paginação no servidor.** A resposta fica pequena, mas cada página refaz o cálculo
  pesado. Continuaria levando de 2 a 5 s por página.
- **C. Otimizar o SQL e enxugar a resposta.** O dado fica sempre atual, mas o ganho estimado é
  de só 2 a 3 vezes, e a resposta continua com megabytes.

## Desenho

### Banco

1. **Tabela de resultado pronto.** Nome MAD a decidir na implementação, por exemplo
   `public."TB_LINHA_RELATORIO_PAINEL"`. Uma linha por linha de relatório, com:
   - área, relatório e posição (a ordem de hoje);
   - `CO_MONITORAMENTO` (o edital, para o filtro de visibilidade);
   - a linha em jsonb, já com as fontes aplicadas.

   Uma segunda tabela, por área e relatório, guarda a data do cálculo, as `fontes`, os
   `avisos` e quem pediu o cálculo. Ambas têm RLS ligado, sem policy e sem grant: só as funções
   SECURITY DEFINER as tocam.
2. **Cálculo.** Uma função privada roda, para uma área e um relatório, o mesmo SQL das RPCs de
   hoje (inclusive `FC_APLICAR_FONTES_DO_PAINEL`), **sem** o filtro de visibilidade do usuário.
   Depois troca as linhas daquela área e relatório na mesma transação. As três RPCs atuais
   continuam iguais por fora: viram leitoras do resultado pronto ou ficam como estão para o
   download; a escolha é do construtor (ver "O que fica para o construtor").
3. **Leitura paginada.** Uma nova RPC recebe área, relatório, página e tamanho. Ela:
   - aplica a mesma guarda de hoje (`FC_EXIGIR_PAINEIS_DA_AREA`);
   - filtra por `FC_EDITAIS_VISIVEIS()` sobre `CO_MONITORAMENTO`;
   - devolve as linhas da página, o total filtrado, a data do cálculo, `fontes` e `avisos`.

   O download usa a mesma leitura sem paginação, com todas as linhas visíveis ao usuário.
4. **Quando recalcula:**
   - **De hora em hora (decisão do usuário, 16/11):** uma tarefa do pg_cron recalcula todas
     as áreas e relatórios. Medição de 16/11: cerca de 16 s no total. O atraso máximo de um
     dado novo vindo de robô ou carga é de 1 h. As cargas não disparam o recálculo.
   - **Sincronizar:** recalcula o relatório aberto na área. Qualquer pessoa com acesso de
     leitura aos Painéis na área pode pedir, no máximo uma vez por minuto por área e relatório.
     - Dentro desse minuto, devolve em silêncio o que está pronto. A data do cálculo aparece
       na tela, como sempre.
     - Pedidos simultâneos da mesma área e relatório não calculam em dobro: um lock
       transacional (advisory lock) faz o segundo esperar e receber o resultado novo.
       (Decisão do autor.)
   - **Trocar ou voltar a fonte de uma coluna:** `salvar_fonte_da_coluna` recalcula o
     relatório daquela área **na mesma transação**. Se o recálculo falhar, a troca é desfeita
     e o erro aparece na gaveta. (Decisão do autor.)
   - **Na migration:** ela calcula tudo, uma vez, para ninguém pegar o resultado vazio.
     (Decisão do autor.) Se ainda assim faltar o resultado de uma área e relatório, a
     primeira leitura calcula na hora.
   - **Visibilidade nos avisos:** `fontes` e `avisos` são guardados por área e relatório e
     mostrados a quem lê. Eles citam só a coluna e quantidades, nunca um edital, então não
     revelam nada fora do recorte de quem vê. Toda linha dos três relatórios tem
     `CO_MONITORAMENTO`, inclusive a de "edital sem vaga", então nenhuma linha escapa do
     filtro. O total é contado depois do filtro.
5. **Migration** nova, com ensaio e rollback guardados conforme
   `docs/biblioteca/banco-e-migrations.md`. Ela é aplicada no banco do `.env.local` com a
   mesma autorização do trabalho anterior: ensaio, aplicação e registro na mesma transação.

### Tela

- **Paginação.** A tela pede ao banco a página visível. Trocar de página ou de tamanho pede de
  novo, e as setas ficam travadas enquanto carrega. O total vem do banco.
- **Cache na memória da aba (decisão do usuário, 16/11).** As páginas já lidas ficam no
  estado da tela, por área, relatório, página e tamanho, junto com a data do cálculo.
  - Voltar a uma página ou relatório já lido não chama o banco.
  - O cache é trocado quando uma leitura traz data de cálculo diferente. O Sincronizar e a
    troca de fonte limpam o cache daquele relatório e área. Sair do sistema, recarregar ou
    fechar a aba apaga tudo.
  - **Nada vai para o disco do computador.** Não se usa localStorage, IndexedDB, Cache API nem
    service worker. O relatório de Aprovados tem nome e matrícula de cerca de 13 mil pessoas
    (dado pessoal, LGPD), e o computador pode ser compartilhado.
  - Também não haveria ganho real: com a paginação no servidor, a leitura de uma página já é
    uma consulta pequena, e conferir se o cache em disco está atualizado custaria uma
    consulta do mesmo jeito.
- **Data.** "Sincronizado em …" passa a mostrar a data do cálculo. O botão Sincronizar
  recalcula e relê.
- **Downloads.** Baixar CSV/XLSX busca todas as linhas no momento do clique e mostra "Gerando…"
  enquanto busca.
- **Largura das colunas (item 1).** Uma alça na borda direita de cada `th` (cursor ↔).
  - Arrastar muda a largura, com mínimo de cerca de 60 px.
  - A largura fica no estado da tela, por relatório. Não vai para o localStorage nem para o
    banco, então recarregar volta ao padrão. Trocar de página ou de aba mantém a largura
    enquanto a página estiver aberta.
  - Teclado: a alça é focável, e as setas ←/→ mudam a largura.
- **Origem dos dados (item 2).** Um ⓘ ao lado do título do relatório abre uma dica, por hover e
  por foco, com:
  - um texto fixo por relatório, mantido em `src/lib/relatorios-dos-paineis.ts`, por exemplo:
    "Uma linha por vaga. Vagas e inscritos: Seleção (planilha da Auditoria, aba Resultado).
    Aprovados: lista de aprovados vigente. Vagas imediatas: título da vaga.";
  - quando houver, a linha "Fonte trocada nesta área: <coluna> → <fonte>", montada de `fontes`.

  O texto do Resumo e dos Aprovados segue o mesmo modelo, a partir do que
  `docs/biblioteca/modulo-paineis-de-dados.md` descreve.

## Restrições

- Supabase só por RPC SECURITY DEFINER com `set search_path to ''`.
- Nomes MAD.
- Migration manual com md5 nas funções trocadas.
- Componentes de `src/ui`.
- Testes: Vitest e PGlite no núcleo do banco, como em `tests/fontes-dos-paineis-no-banco.test.ts`.
- `npm run aya:conhecimento` se a Aya mudar.

## O que fica para o construtor

- Os nomes MAD das tabelas e das funções.
- Se as três RPCs antigas viram leitoras do resultado pronto (devolvem tudo) ou são
  aposentadas em favor da nova RPC.
- O minuto da tarefa horária no cron.
- Como medir "menos de 1 s": uma medição só leitura antes e depois, como a desta página.
