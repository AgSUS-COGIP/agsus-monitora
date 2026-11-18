---
tipo: modulo
area: modulo
atualizado: 2026-11-17
---

# Módulo: Visão geral

Página `dashboard`, rota `/<área>/visao-geral`, em React/TypeScript em `src/modulos/visao-geral/`.
`criarVisaoGeral` devolve o conteúdo, que a rota (`src/app/telas.tsx`) desenha no pacote principal,
dentro do ErrorBoundary da tela. O bootstrap, a navegação e a carga do monitoramento continuam em
`src/app/`. Liga os mapas: [[modulo-mapa-saude-indigena]] e [[modulo-mapa-de-projetos]].

## Arquivos

- `estado.ts`: recorte por área, filtros, busca, DSEI, atalhos, colunas, ordenação, exportação e
  acompanhamento dos editais. Não importa React.
- `visao-geral.tsx`: composição da tela e integração com os mapas.
- `paineis.tsx`, `tabela.tsx` e `gaveta.tsx`: cabeçalho, filtros, vagas, pede ação, em andamento,
  processos por projeto, tabela e detalhes.
- `boas-vindas.tsx` e `marcos.ts`: os marcos anuais da equipe (só a comemoração, sem card).
- `tipos.ts`: contratos do estado, callbacks, dados de leitura e componentes.
- `src/lib/visao-geral/visao-geral.ts`: normalização, enriquecimento, recorte, ordenação e CSV.
- Filtros do mapa e da tabela: lógica pura em `src/lib/mapas/filtros-do-mapa.ts`; o estado fica aqui;
  o evento é `agsus:filtros-alterados`.

## Layout: painel de decisão (17/11/2026)

Escolhido entre três prévias (A, painel de decisão; B, mapa em primeiro plano; C, semana de
trabalho). De cima para baixo:

- **Cabeçalho** (`Cabecalho`): saudação e "N editais têm etapa nos próximos 7 dias · Ver
  cronograma" à esquerda; hora da carga, "Filtros (n)", Atualizar e Exportar à direita. Substituiu
  o card de boas-vindas, o topo separado e o card "Filtros" quase vazio.
- **Filtros** (`Filtros`): os campos abrem pelo botão; os chips do recorte e "Limpar tudo" ficam à
  vista com o painel fechado.
- **Vagas** (`Vagas`, `.visao-geral-kpis`): as imediatas e as três parcelas, com a porcentagem e a
  barra da divisão; cadastro reserva e inscritos embaixo. Esperam o acompanhamento
  (`aguardandoVagas` no estado, até `ESPERA_MAXIMA_DO_ACOMPANHAMENTO_MS`): antes, a tela mostrava
  as vagas sem o desconto das reabertas e trocava segundos depois.
- **Pede ação** (`PedeAcao`) ao lado de **Em andamento, por fase** (`EmAndamento`,
  `andamentoPorFase` em `src/lib/visao-geral/visao-geral.ts`): críticos e pós-resultado (sem lista e
  lista sem status; contratação abaixo de 50% e desistências saíram em 18/11/2026) numa lista; só as fases
  com edital aberto, sem as vazias, e concluídos e cancelados numa linha.
- **Mapa** mais baixo que na tela do mapa (`--altura-do-mapa-na-visao-geral`), com a altura
  reservada enquanto o módulo baixa (`.visao-geral-mapa-reserva`).
- **Tabela**: a contagem não repete o total; no celular, o cartão mostra só unidade, edital,
  vagas, inscritos, contratados, sem contratação, status e atenção (`data-campo` nas células).

## Dados e carregamento

- As linhas vêm do store compartilhado de `src/componentes/dados-do-monitoramento.ts`. A tela
  valida os campos que usa, aplica o recorte da área e exclui o edital de treinamento. Campos
  adicionais são preservados para os mapas.
- Indicadores, tabela, mapas e CSV usam o mesmo recorte; as regras de críticos e provimento
  continuam nos helpers existentes (`src/lib/visao-geral/criticos-da-visao-geral.ts`).
- **Crítico marcado à mão** (#721, migration `20261110150000`): gestor, coordenador ou
  administrador global marca o edital como crítico, com motivo, no formulário de Editais
  ([[modulo-editais]]). A Visão geral lê `listar_editais_criticos_manuais(p_area)` junto com o
  acompanhamento (falha não derruba a tela; sem mudança, o mesmo objeto) e soma a marcação aos
  motivos automáticos como o mais grave (`marcado`).
- `listar_acompanhamento_da_visao_geral({ p_area })` lê etapas, resumos das listas e, desde a
  migration `20261113210000`, a 1ª e a última admissão de cada edital (`admissoes`, de
  `TB_ADMISSAO_CONCILIADA`: admissões conciliadas com o RH, carregadas por
  `scripts/carregar-admissoes-conciliadas.mjs` a partir da aba "Vínculos conciliados" das
  planilhas de conciliação; sem nome, CPF nem matrícula). O estado
  evita repetir pedidos da mesma carga/área e descarta respostas de cargas ou áreas anteriores.
  Se houver erro, a tela continua com as linhas disponíveis.
- `obter_marcos_da_area({ p_area })` lê os números anuais da equipe. Resposta sem ano inteiro ou
  contagem numérica finita e não negativa não gera comemoração.
- Filtros e colunas são normalizados ao sair do armazenamento; a indisponibilidade do
  armazenamento não impede o uso da página.
- Colunas padrão, para todos (13/11/2026): todas menos Observações. A chave guardada passou a
  `agsus_visible_cols_v3` (Ciclo, 1ª admissão e Última admissão), o que descartou uma vez as
  escolhas antigas. O ciclo é padronizado como "Nº ciclo" (`src/lib/editais/ciclo-do-edital.ts`), é
  filtro em "Mais opções" e voltou ao formulário do edital. Em 1280px a tabela rola de lado; Unidade e Edital ficam presas à esquerda
  (`classe` da coluna na `TabelaInfinita`). No celular, em cartões, rótulo e valor ficam na
  mesma linha e só a página rola.
- O CSV mantém a proteção contra fórmulas e o nome do arquivo usa a data de Brasília.
- **Montador de relatório** (13/11/2026; `montador-de-relatorio.tsx`, lógica em
  `src/lib/visao-geral/relatorio-da-visao-geral.ts`, PDF em `src/lib/visao-geral/relatorio-da-visao-geral-em-pdf.ts`): o
  botão Exportar abre a janela (e, desde 16/11/2026, o "Montar relatório" dos Painéis, com a área
  inteira — [[modulo-paineis-de-dados]]; saiu do menu da conta). Modelo pronto (Resumo
  rápido, Completo, Diretoria) ou escolha das seções (números, tabela dos editais, atenção), das
  colunas e do formato (PDF desenhado com o timbrado de Configurações › Marca, Excel com uma aba por
  seção, ou o CSV de antes). Sai do recorte da tela; a última escolha fica no navegador. Substituiu a
  impressão da tela inteira (o cabeçalho `.print-only` saiu).
- **Relatório da diretoria** (16/11/2026; migration `20261116120000`): o modelo Diretoria leva três
  abas. **Editais** (número, unidade, vagas, divulgação, encerramento e ciclo); **Vagas por cargo**
  (`listar_vagas_por_cargo_da_visao_geral`, recurso dashboard, sem dado pessoal): uma linha por vaga
  com vagas imediatas, inscritos e aprovados; **Aprovados** (`exportar_aprovados_da_diretoria`,
  Aprovados leitor): cargo, nota, classificação, nome, status, matrícula e a admissão conciliada.
  A aba Aprovados só aparece para quem vê a Lista de aprovados (`podeBaixarAprovados`), e o banco
  grava cada download em `TL_EXPORTACAO_APROVADO` (`DIRETORIA`) antes de devolver os nomes. A
  ligação vaga ↔ quadro ↔ lista é feita em `src/lib/visao-geral/relatorio-da-diretoria.ts`: pelo código da
  vaga, pelo número do começo ou pelo texto (Projetos e SEDE guardam o texto no lugar do código);
  as vagas imediatas vêm do quadro do edital (cargo e lotação) ou do texto da vaga ("2 vagas",
  "Cadastro Reserva" = 0), e sem os dois ficam "—". No PDF, acima de 3 mil aprovados, pede o Excel.

- **Vagas reabertas** (16/11/2026, `src/lib/visao-geral/vagas-reabertas.ts`): o mesmo DSEI reabre o mesmo
  posto em editais novos, e a soma das vagas contava a vaga duas vezes. A vaga sem contratação de
  um edital com resultado, reaberta num edital mais novo da mesma unidade (iniciado depois do fim
  do anterior) e do mesmo cargo, conta só no novo: o edital antigo ganha `vagas_reabertas` no
  enriquecimento e perde essas vagas das vagas imediatas e das ociosas (`vagasEfetivas`,
  `vagasSemContratacao`); as contratadas ficam. Os cargos vêm de
  `listar_vagas_por_cargo_da_visao_geral` (vagas da Seleção e quadro), lida junto com o
  acompanhamento; se falhar, as vagas ficam como cada edital publicou. O "mesmo cargo" é o cargo
  oficial (`co_cargo`, TD_CARGO pela grafia com `FC_CARGO_DA_GRAFIA`, migration `20261117130000`)
  quando os dois lados o têm; na SEDE, em Projetos e na grafia sem casamento, o texto
  (`chaveDoCargo`). Em 17/11/2026, dos 544 pares de editais do mesmo DSEI com o mesmo cargo
  oficial, só 3 casavam só pelo código, sem mudar o total. O módulo da regra chega por
  import dinâmico só quando os cargos chegam (`acompanhamento.reaberturas`), fora do pacote de
  entrada (orçamento de bundle). O KPI mostra "sem N
  reabertas", a gaveta diz de qual edital, a tabela e o CSV mantêm a coluna Vagas como o edital
  publicou e a coluna de vagas sem contratação já sem as reabertas. O mapa por DSEI e o relatório
  usam a mesma conta. Conferência de 16/11/2026 (dados reais, status pelo cronograma): −147 vagas na
  Saúde Indígena (2.263 → 2.116, 14 DSEIs), −10 na SEDE, nenhuma em Projetos. O código da vaga não liga os editais (a Empregare dá código
  novo a cada edital). Explicação para quem usa: seção "Vagas reabertas" da Aya.
  Diferença conhecida: os Painéis (Editais por cargo, Resumo dos editais) mostram as vagas de cada
  edital como publicadas (pelo quadro, desde #850), sem o desconto; e o "Montar relatório" dos
  Painéis só traz o desconto se a Visão geral já leu o acompanhamento da área nesta visita.

## Limites da tipagem

- O snapshot e suas coleções de linhas, filtros e colunas têm contratos de leitura; mudanças do
  recorte passam pelas ações do estado. Isso não congela os objetos em tempo de execução.
- Datas continuam como texto, com as regras existentes de calendário.
- Os dados geográficos adicionais seguem como `unknown`: a tipagem não valida todo o schema dos
  mapas nem muda as permissões de edição. `checkJs` segue desligado; JSDoc descreve as
  integrações em JavaScript que ainda restam (ver [[regras-do-codigo]]).

## Verificação

- `tests/telas-com-modulo-simulado-na-tela.test.js` (bloco `modulos/visao-geral`): a tela e o estado, incluindo mapas e troca de área.
- `tests/mapas-e-visao-geral.test.js` (bloco `visao-geral`): as regras.
- `tests/demais-regras.test.ts` (bloco `lib/vagas-reabertas`): a vaga reaberta contada uma vez só.
- `tests/mapas-e-visao-geral.test.js` (bloco `fronteiras-da-visao-geral`): as fronteiras externas.
- `tests/tipos/visao-geral.tsx`: contratos positivos e negativos do compilador.
- Explicações para quem usa: `docs/aya/regras-da-visao-geral.md` (ver [[aya-base-de-conhecimento]]).

## Relacionadas

- [[modulo-mapa-saude-indigena]] — o mapa da área Saúde Indígena, ligado aqui
- [[modulo-mapa-de-projetos]] — o mapa da área Projetos, ligado aqui
- [[mapas-e-leaflet]] — regras comuns dos mapas
- [[arquitetura-do-front]] — rotas do app único, o recorte por área e de onde vêm as linhas do monitoramento
- [regras-da-visao-geral](../aya/regras-da-visao-geral.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)
