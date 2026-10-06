# Histórias de usuário — Conferências de consistência

Job Python diário (`scripts/conferencias/`, workflow `.github/workflows/conferencias.yml`) que lê o
banco e grava **avisos**; banco em `supabase/migrations/20261005210000_conferencias_de_consistencia.sql`;
tela em `src/modulos/conferencias/` (regras em `src/lib/avisos-de-conferencia.js`). Pedido do
usuário: _"pode usar mais o Python, incluir em análises, entrevistas, lista de classificação, etc."_
Arquitetura: [../python-no-monitora.md](../python-no-monitora.md).

Cada critério tem o mesmo código (`CF-n.m`) num teste: `tests/python/test_conferencias.py` (regras
e fluxo do job), `tests/avisos-de-conferencia.test.js` e `tests/componentes/avisos-de-conferencia.test.js`
(tela), `tests/conferencias-migration.test.js` (invariantes da migration) ou o ensaio
`supabase/ensaios/20261005210000_conferencias_de_consistencia.sql` (banco).

## CF-1 — Conferir o sistema todo dia

**Como** gestor de seleção, **quero** que o MONITORA confira sozinho as regras que atravessam os
módulos, **para** achar o erro antes que ele saia numa lista publicada.

### Critérios de aceite

- **CF-1.1** — **Dado** o workflow agendado, **quando** são 6h de Brasília, **então** o job roda,
  registra a execução (`TL_CONFERENCIA`, disparo AGENDA) e aparece na linha "Conferências de
  consistência" do Status das atualizações; depois de 26 h sem execução concluída, a linha fica
  "Atrasada".
- **CF-1.2** — **Dado** que sou administrador global, **quando** clico em "Rodar agora" na linha das
  conferências, **então** o workflow roda com disparo MONITORA e meu id; o botão fica desabilitado
  enquanto roda.
- **CF-1.3** — **Dado** uma execução, **quando** um módulo falha (por exemplo, a leitura das
  cargas), **então** os outros rodam, a execução fica PARCIAL e os avisos do módulo que falhou ficam
  como estavam (nem gravados, nem resolvidos).
- **CF-1.4** — **Dado** um erro geral, **quando** o job para, **então** a execução fica FALHOU com a
  mensagem mascarada e nenhum aviso é resolvido.
- **CF-1.5** — **Dado** o modo seco, **quando** o job roda, **então** confere e mostra o resumo, sem
  gravar nada.
- **CF-1.6** — **Dado** outra execução em andamento, **quando** uma nova começa, **então** o banco
  recusa (55P03); a esquecida há mais de 1 h é fechada como FALHOU.

## CF-2 — Um aviso por problema, sem dado pessoal

**Como** responsável pela proteção de dados, **quero** que os avisos só tragam códigos, **para**
que nada pessoal vaze no log público do GitHub nem na tela de quem não deveria ver.

- **CF-2.1** — **Dado** vários casos da mesma conferência no mesmo edital, **quando** o job grava,
  **então** vira um aviso só, com a quantidade e até 20 exemplos.
- **CF-2.2** — **Dado** um exemplo com espaço, `@` ou 11 dígitos seguidos (nome, e-mail, CPF),
  **quando** o job tenta gravar, **então** o job descarta o exemplo e o banco recusa (22023).
- **CF-2.3** — **Dado** as leituras do job, **quando** devolvem candidatos, **então** vêm só ids,
  códigos e números; a mesma pessoa em duas listas de aprovados é achada por hash.
- **CF-2.4** — **Dado** qualquer mensagem do job, **quando** vai para o log, **então** passa pelo
  mascaramento (e-mail, CPF, telefone, token e segredos viram marcadores).

## CF-3 — Ciclo do aviso

- **CF-3.1** — **Dado** um problema novo, **quando** a conferência o acha, **então** o aviso abre
  (ABERTO), com a data da primeira vez.
- **CF-3.2** — **Dado** um aviso aberto, **quando** a conferência roda até o fim e não o acha mais,
  **então** ele vira RESOLVIDO e some da tela.
- **CF-3.3** — **Dado** um aviso resolvido, **quando** o problema volta, **então** ele reabre com
  nova data da primeira vez.

## CF-4 — Ver os avisos onde trabalho

**Como** analista, entrevistador, quem classifica ou quem cuida dos aprovados, **quero** ver no
topo da minha tela quantos avisos há, **para** corrigir sem procurar.

- **CF-4.1** — **Dado** avisos abertos do módulo na minha área, **quando** abro Análises,
  Entrevistas, Classificação ou Lista de aprovados, **então** vejo o selo "N avisos" com a cor do
  mais grave; sem aviso, o selo não aparece.
- **CF-4.2** — **Dado** o selo, **quando** clico, **então** a gaveta lista os avisos do módulo:
  gravidade, título, onde (edital, área ou vaga), resumo, desde quando, quantidade e os exemplos.
- **CF-4.3** — **Dado** que sou administrador global, **quando** abro Configurações › Status das
  atualizações, **então** vejo o cartão "Avisos de conferência" com todos os avisos e o filtro por
  módulo (com a contagem de cada um).
- **CF-4.4** — **Dado** que não tenho o módulo, a área ou o edital no meu recorte, **quando** peço
  os avisos, **então** não os vejo; avisos das cargas e sem área, só o administrador global.

## CF-5 — Ignorar com motivo

- **CF-5.1** — **Dado** que administro o módulo (na Classificação, edito) ou sou administrador
  global, **quando** clico em "Ignorar", **então** escrevo o motivo (10 a 500 caracteres) e o aviso
  vai para "Ignorados", com data e motivo.
- **CF-5.2** — **Dado** que só leio o módulo, **quando** vejo o aviso, **então** não há botão
  "Ignorar" e o banco recusa (42501).
- **CF-5.3** — **Dado** um aviso ignorado, **quando** a quantidade de casos cresce, **então** ele
  volta a ABERTO; com a mesma quantidade, continua ignorado.

## CF-6 — As conferências

| Código                                    | Módulo        | Gravidade   | Confere                                                                  |
| ----------------------------------------- | ------------- | ----------- | ------------------------------------------------------------------------ |
| `ANALISE_APROVADA_ABAIXO_DO_CORTE`        | Análises      | Crítico     | aprovada com nota abaixo da nota mínima documental da regra vigente      |
| `ANALISE_NOTA_DIFERENTE_DA_SOMA`          | Análises      | Atenção     | nota final ≠ formação + cursos + experiência + étnico (±0,01)            |
| `ANALISE_EXPERIENCIA_ACIMA_DO_TETO`       | Análises      | Atenção     | experiência acima de `documental.teto_experiencia` (se a regra tiver)    |
| `ANALISE_DATA_INVALIDA`                   | Análises      | Atenção     | data da análise no futuro ou antes da candidatura na Empregare           |
| `ANALISE_EM_DOIS_EDITAIS`                 | Análises      | Informativo | mesmo código de candidato em dois editais ativos                         |
| `ENTREVISTA_SEM_NOTA_APOS_DATA`           | Entrevistas   | Atenção     | data da agenda passou, sem nota e sem ausência marcada                   |
| `ENTREVISTA_NOTA_FORA_DA_ESCALA`          | Entrevistas   | Crítico     | nota do avaliador fora da faixa/passo, lista ou níveis do roteiro        |
| `ENTREVISTA_FORA_DA_CONVOCACAO`           | Entrevistas   | Crítico     | convocado pelo sistema fora da lista de convocação vigente               |
| `ENTREVISTA_HORARIO_DUPLICADO`            | Entrevistas   | Atenção     | duas entrevistas no edital, ou horários que se cruzam em dois editais    |
| `CLASSIFICACAO_LISTA_FINAL_DESATUALIZADA` | Classificação | Crítico     | lista FINAL gerada antes da última mudança nas análises do edital        |
| `CLASSIFICACAO_EMPATE_PENDENTE`           | Classificação | Atenção     | última lista com empate sem desempate registrado                         |
| `CLASSIFICACAO_VAGA_SEM_QUADRO`           | Classificação | Atenção     | vaga das análises de edital ativo sem linha no quadro (ex.: 101/2026)    |
| `CLASSIFICACAO_AJUSTE_APOS_LISTA`         | Classificação | Atenção     | ajuste de recurso aprovado depois da última lista do mesmo tipo          |
| `APROVADOS_CONTRATADO_DUPLICADO`          | Aprovados     | Crítico     | a mesma pessoa Contratada em duas vagas                                  |
| `APROVADOS_CONVOCADO_SEM_DESFECHO`        | Aprovados     | Atenção     | Convocado há mais de N dias (padrão 15; `CONFERENCIA_DIAS_CONVOCADO`)    |
| `APROVADOS_PENDENCIA_DA_PUBLICACAO`       | Aprovados     | Atenção     | pendência da publicação vinda da Classificação ainda sem desfecho        |
| `CARGA_VARIACAO_BRUSCA`                   | Cargas        | Atenção     | candidatos de uma vaga da Empregare variaram 50% ou mais na última carga |

- **CF-6.1** — **Dado** o catálogo, **quando** os testes rodam, **então** o do job e o da tela são
  iguais ao caso dourado `tests/fixtures/conferencias/catalogo.json`.
