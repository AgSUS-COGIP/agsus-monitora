/*
  Os tours guiados ("Me mostra esta tela") e as trilhas ("Aprender") da Aya,
  em dados, sem DOM nem estado global. Quem desenha é
  src/modulos/aya/tour/tour.jsx; quem guarda o progresso no navegador,
  src/modulos/aya/tour/progresso.js.

  Passo: `{ alvo, titulo, texto }`.
  - `alvo`: seletor CSS estável (id, data-tour, data-*, aria-label fixo) ou
    uma lista deles — vale o primeiro que achar um elemento visível. Sem
    `alvo`, o balão aparece no meio da tela (abertura e fechamento).
    Elemento ausente (sem permissão, tela vazia, outra aba) pula o passo.
  - `titulo` e `texto`: curtos (uma ou duas frases), sem regra que não
    esteja num verbete de docs/aya/.
  - `areas` (opcional): só nessas áreas (a Visão geral muda por área).
  - Nas trilhas, `pagina`: a tela do passo (`recursos`, `config:acessos`);
    o tour navega até ela. `exige` (opcional): regra do perfil para o passo.

  Os seletores `[data-tour="…"]` foram postos nos componentes das telas só
  para isto; os outros já existiam. Trocar um seletor aqui não quebra nada
  (o passo só é pulado), mas o teste tests/aya-tours.test.js confere que cada
  `data-tour` usado existe em algum componente.
*/

import {
  canEditRecursos,
  canManageAccess,
  paginasPermitidas,
} from "./access-roles.js";
import { hasResource } from "./permissoes-recursos.js";

const passo = (alvo, titulo, texto, extra = {}) =>
  Object.freeze({ alvo, titulo, texto, ...extra });

/* ---------- Pedaços repetidos ---------- */

const PASSO_DA_AYA = passo(
  ".aya-arara, .aya-painel",
  "Pergunte à Aya",
  "Quando tiver dúvida sobre esta tela ou sobre uma regra, é só me chamar aqui.",
);

/* ---------- Tours de cada tela ---------- */

const TOURS = Object.freeze({
  dashboard: Object.freeze({
    titulo: "Visão geral",
    passos: Object.freeze([
      passo(
        "#page-dashboard .boas-vindas:not(.marcos-do-ano)",
        "Resumo da semana",
        "A saudação resume o que acontece nesta semana nos editais da área.",
      ),
      passo(
        [
          "#page-dashboard .visao-geral-filtros",
          "[aria-labelledby='visaoGeralFiltrosTitulo']",
        ],
        "Filtros",
        "Unidade, Edital e Status ficam à vista; Etapa, Risco e UF, em Mais opções. Cada filtro aceita vários valores e recorta a página inteira.",
      ),
      passo(
        "#page-dashboard .visao-geral-kpis",
        "Indicadores",
        "Processos, Vagas, Contratações, Vagas ociosas, Críticos e Inscritos, contados nos editais do recorte.",
      ),
      passo(
        "#page-dashboard .visao-geral-mapa:not([hidden])",
        "Mapa dos DSEIs",
        "Escolher um DSEI no mapa recorta a página por ele; voltar ao Brasil tira esse filtro.",
        { areas: ["saude-indigena"] },
      ),
      passo(
        "#page-dashboard .visao-geral-mapa:not([hidden])",
        "Mapa dos projetos",
        "O mapa mostra os municípios das vagas da área, tirados dos PDFs dos editais.",
        { areas: ["projetos"] },
      ),
      passo(
        [
          "[aria-labelledby='visaoGeralTabelaTitulo']",
          "#page-dashboard .visao-geral-tabela-caixa",
        ],
        "Tabela de processos",
        "Cada linha é um edital, com o prazo e a próxima etapa do cronograma coloridos pela urgência.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  nucleo: Object.freeze({
    titulo: "Editais",
    passos: Object.freeze([
      passo(
        "#nucleoOperationalKpis",
        "Cronogramas e alertas",
        "Os indicadores (Editais ativos, Sem cronograma, Próximos 7 dias…) filtram a tabela ao clicar.",
      ),
      passo(
        "#nucleoSearch",
        "Busca",
        "Procure um edital da área atual na tabela.",
      ),
      passo(
        "#newEditalBtn",
        "Novo edital",
        "Cadastra um edital da área atual. Aparece para quem tem nível Editor em Editais ou em Cronograma.",
      ),
      passo(
        ["#page-nucleo .nucleo-page-card", "#nucleoRows"],
        "Tabela de editais",
        "Com o cálculo automático ligado, o status e a etapa saem das datas do cronograma.",
      ),
      passo(
        "#nucleoRows tr:first-child .nucleo-row-actions",
        "Ações do edital",
        "Abra o formulário para editar o cronograma, os anexos em PDF e o quadro de vagas, ou veja a linha do tempo.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  calendario: Object.freeze({
    titulo: "Cronograma",
    passos: Object.freeze([
      passo(
        "#page-calendario .cal-barra",
        "Mês",
        "Navegue entre os meses ou volte para hoje. A tela é só de leitura: as datas vêm dos cronogramas de Editais.",
      ),
      passo(
        "#page-calendario .cal-filtros",
        "Filtros",
        "Recorte por unidade, edital ou tipo de etapa.",
      ),
      passo(
        "#calGrade",
        "Calendário",
        "Cada dia mostra quantas etapas de cada tipo há; a etapa conta no dia em que começa e no dia em que termina.",
      ),
      passo(
        "#calProximas",
        "Próximas etapas",
        "As etapas que vêm por aí, em ordem de data.",
      ),
      passo(
        "#calTimeline",
        "Linha do tempo",
        "Escolha um edital para ver o cronograma dele de ponta a ponta.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  analises: Object.freeze({
    titulo: "Painel das análises",
    passos: Object.freeze([
      passo(
        "#analises-filtro-escopo",
        "Situação do processo",
        "Começa em Ativo (editais ativos). Inativo traz os editais encerrados; Todos junta os dois.",
      ),
      passo(
        "[aria-labelledby='analisesFiltrosTitulo']",
        "Filtros",
        "Recorte a lista e os indicadores pelos filtros ou pela busca.",
      ),
      passo(
        "#page-analises .analises-kpis",
        "Indicadores",
        "Aptos para análise, análises realizadas, pendentes, em revisão, aprovados e reprovados.",
      ),
      passo(
        "[data-tour='analises-pendencias']",
        "Pendências prioritárias",
        "Da mais grave para a menos grave; cada uma tem um atalho que aplica o filtro.",
      ),
      passo(
        "[aria-labelledby='analisesFilaTitulo']",
        "Lista",
        "As análises vindas das planilhas; abra uma linha para ver os detalhes.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  recursos: Object.freeze({
    titulo: "Recursos",
    passos: Object.freeze([
      passo(
        "[data-acao='novo-recurso']",
        "Novo recurso",
        "Quem tem nível Editor em Recursos registra o recurso, anexa documentos e escreve a resposta.",
      ),
      passo(
        "[aria-labelledby='recursosFiltrosTitulo']",
        "Filtros",
        "Recorte a fila pelos filtros ou busque pelo candidato.",
      ),
      passo(
        "#page-recursos .recursos-kpis",
        "Indicadores",
        "Aguardando parecer, Prazo vencido, Deferidos e Indeferidos; cada um filtra a tela.",
      ),
      passo(
        "[data-tour='recursos-pendencias']",
        "Pendências prioritárias",
        "O que pede atenção, como prazo não encontrado no cronograma ou mudança de nota; o atalho aplica o filtro.",
      ),
      passo(
        "[aria-labelledby='recursosFilaTitulo']",
        "Fila de recursos",
        "Abra um recurso para ver dados, anexos, etapas, parecer e resposta.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  entrevistas: Object.freeze({
    titulo: "Entrevistas",
    passos: Object.freeze([
      passo(
        "#page-entrevistas .entrevistas-visoes",
        "Três visões",
        "Resultados (só consulta), Conduzir entrevistas e Roteiros. Escolha a visão aqui no topo.",
      ),
      passo(
        "#page-entrevistas .entrevistas-kpis",
        "Resultados",
        "Vagas com entrevista, candidatos, compareceram, aptos, inaptos e média das notas.",
      ),
      passo(
        "[aria-labelledby='entrevistasTabelaTitulo']",
        "Tabela de resultados",
        "O resultado de cada candidato entrevistado da área atual.",
      ),
      passo(
        "#entrevistasEdital",
        "Edital da entrevista",
        "Aparecem os editais dentro da janela da entrevista ou liberados pelo administrador global.",
      ),
      passo(
        "[data-passo='configuracao']",
        "Passo 1 · Configuração",
        "Escolha o roteiro: ele preenche a regra de convocação e a banca padrão.",
      ),
      passo(
        "[data-passo='convocacao']",
        "Passo 2 · Convocação",
        "Os aprovados na análise curricular, na ordem de cada vaga, com a sugestão da regra.",
      ),
      passo(
        "[data-passo='ficha']",
        "Passo 3 · Ficha de notas",
        "Abra um convocado para lançar comparecimento e notas; o resultado é recalculado a cada gravação.",
      ),
      passo(
        "[aria-labelledby='entrevistasRoteirosTitulo']",
        "Roteiros",
        "Modelos reutilizáveis da entrevista. Editar grava uma versão nova; os editais já configurados continuam na anterior.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  approved: Object.freeze({
    titulo: "Lista de aprovados",
    passos: Object.freeze([
      passo(
        "#approvedTabAprovados",
        "Aprovados e Convocação",
        "Aprovados mostra a lista vigente de cada edital; Convocação, a ordem de convocação por vaga.",
      ),
      passo(
        [
          "#approvedPanelAprovados .approved-kpis",
          "#approvedPanelConvocacao .approved-kpis",
        ],
        "Indicadores",
        "Os números da lista no recorte dos filtros.",
      ),
      passo(
        [
          "#approvedPanelAprovados .approved-filters",
          "#convocacaoFilterEdital",
        ],
        "Filtros",
        "Escolha o edital e os demais filtros para recortar a lista.",
      ),
      passo(
        ["#approvedRows", "#convocacaoRows"],
        "Candidatos",
        "Cada candidato da lista vigente, com classificação, nota, modalidade e status.",
      ),
      passo(
        [
          "[data-approved-action='status']",
          "[data-convocacao-action='status']",
        ],
        "Status do candidato",
        "Convocado, Contratado, Desistente, Migração ou Documentação Rejeitada. Status já definido só o admin de Aprovados altera, exceto o Convocado.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  selecao: Object.freeze({
    titulo: "Seleção",
    passos: Object.freeze([
      passo(
        [
          "#page-selecao .selecao-filtros",
          "[aria-labelledby='selecaoFiltrosTitulo']",
        ],
        "Filtros",
        "Recorte o funil da área atual pelos filtros.",
      ),
      passo(
        "#page-selecao .selecao-kpis",
        "Funil por vaga",
        "Inscritos, aptos, triados, convocados, aprovados e contratados, a partir da planilha Auditoria.",
      ),
      passo(
        "#page-selecao .selecao-kpis [data-kpi='taxa']",
        "Taxa de contratação",
        "Contratados divididos por aprovados, em porcentagem.",
      ),
      passo(
        "[aria-labelledby='selecaoTabelaTitulo']",
        "Tabela de vagas",
        "O funil de cada vaga. A tela é só de consulta e é carregada de hora em hora, das 7h às 19h.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  classificacao: Object.freeze({
    titulo: "Classificação",
    passos: Object.freeze([
      passo(
        "#page-classificacao .classificacao-edital",
        "Edital",
        "Escolha o edital: a regra de classificação é dele, decidida pelo gestor do edital.",
      ),
      passo(
        "#page-classificacao .ui-topo .ui-segmentado",
        "Listas e Regra",
        "Listas mostra a classificação; Regra, o que vale neste edital e as versões.",
      ),
      passo(
        "#page-classificacao .classificacao-tipos",
        "Três listas",
        "Preliminar (documental), convocação para entrevista e resultado final.",
      ),
      passo(
        "#page-classificacao .classificacao-avisos",
        "Avisos",
        "O que falta para a lista ficar certa, como empate esperando sorteio ou entrevista sem análise.",
      ),
      passo(
        "#page-classificacao .classificacao-acoes",
        "Gerar e exportar",
        "Gerar registra a lista com a versão da regra; a exportação sai em PDF, DOCX ou XLSX.",
      ),
      passo(
        "#page-classificacao .classificacao-vaga",
        "Por vaga",
        "Clique no nome para ver por que o candidato está naquela posição.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "config:acessos": Object.freeze({
    titulo: "Configurações › Acessos",
    passos: Object.freeze([
      passo(
        "#acessosApp .acessos-abas",
        "Usuários, Grupos e Coordenações",
        "Grupos e Coordenações aparecem só para o administrador global.",
      ),
      passo(
        "#acessos-painel-usuarios .acessos-segmentado",
        "Ativos e Pendentes",
        "Em Pendentes ficam os pedidos de acesso de quem entrou sem perfil ativo.",
      ),
      passo(
        "[data-tour='acessos-adicionar']",
        "Adicionar pessoa",
        "Informe e-mail institucional, nome, grupo, coordenação (ou área) e motivo. A tela mostra o convite pronto.",
      ),
      passo(
        [
          "[aria-label='Pessoas com acesso']",
          "[aria-label='Permissões por módulo']",
        ],
        "Pessoas",
        "Abra uma pessoa para ver o grupo, a coordenação e como ela vê o menu.",
      ),
      passo(
        ".acessos-salvar",
        "Salvar com motivo",
        "Alteração pendente se salva aqui, com motivo. Ninguém altera o próprio acesso.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
});

/* ---------- Trilhas ("Aprender") ---------- */

const CONDUZIR =
  "#page-entrevistas .entrevistas-visoes [data-valor='conduzir']";
const PENDENTES =
  "#acessos-painel-usuarios .acessos-segmentado [data-valor='pendentes']";

const TRILHAS = Object.freeze([
  Object.freeze({
    id: "primeiros-passos",
    titulo: "Primeiros passos",
    resumo: "Áreas, menu, Visão geral e como pedir ajuda.",
    exige: () => true,
    passos: Object.freeze([
      passo(
        null,
        "Boas-vindas ao MONITORA",
        "Em poucos passos, eu mostro onde fica cada coisa. Use as setas do teclado ou os botões; Esc sai quando quiser.",
        { pagina: "dashboard" },
      ),
      passo(
        "[data-seletor-de-area]",
        "Área atual",
        "Saúde Indígena, SEDE e Projetos repetem as mesmas páginas, e cada página mostra só a área escolhida aqui.",
        { pagina: "dashboard" },
      ),
      passo(
        ["#nav .menu-area__itens", "#nav", "#mobileBottomNav"],
        "Menu",
        "As páginas seguem as etapas do processo seletivo: Editais, Cronograma, Análises, Recursos, Entrevistas, Lista de aprovados e Seleção.",
        { pagina: "dashboard" },
      ),
      passo(
        [
          "#page-dashboard .visao-geral-filtros",
          "[aria-labelledby='visaoGeralFiltrosTitulo']",
        ],
        "Visão geral: filtros",
        "Os filtros recortam os indicadores, o mapa e a tabela desta página.",
        { pagina: "dashboard" },
      ),
      passo(
        "#page-dashboard .visao-geral-kpis",
        "Visão geral: indicadores",
        "Processos, Vagas, Contratações, Vagas ociosas, Críticos e Inscritos dos editais do recorte.",
        { pagina: "dashboard" },
      ),
      passo(
        null,
        "Busca rápida",
        "Ctrl+K (ou Cmd+K) abre a busca global por edital, unidade, etapa, responsável e mais.",
        { pagina: "dashboard" },
      ),
      passo(
        ".aya-arara, .aya-painel",
        "Peça ajuda à Aya",
        "Em qualquer tela, me chame para explicar uma regra ou para mostrar a tela. Em Aprender ficam as outras trilhas.",
        { pagina: "dashboard" },
      ),
    ]),
  }),
  Object.freeze({
    id: "do-edital-ao-aprovado",
    titulo: "Do edital ao aprovado",
    resumo: "As telas na ordem do processo seletivo.",
    exige: (perfil) => paginasPermitidas(perfil).nucleo === true,
    passos: Object.freeze([
      passo(
        "#nucleoOperationalKpis",
        "1. Editais",
        "Tudo começa no edital: cadastro, cronograma, anexos em PDF e quadro de vagas. Os alertas mostram o que falta.",
        { pagina: "nucleo" },
      ),
      passo(
        "#calGrade",
        "2. Cronograma",
        "As etapas salvas nos editais aparecem aqui num calendário, só para consulta.",
        { pagina: "calendario" },
      ),
      passo(
        "#page-analises .analises-kpis",
        "3. Painel das análises",
        "A análise de cada candidato chega das planilhas; acompanhe as pendências e os resultados.",
        { pagina: "analises" },
      ),
      passo(
        "#page-recursos .recursos-kpis",
        "4. Recursos",
        "Os recursos dos candidatos, do registro ao parecer jurídico e à resposta enviada.",
        { pagina: "recursos" },
      ),
      passo(
        "#page-entrevistas .entrevistas-visoes",
        "5. Entrevistas",
        "Configure, convoque e lance as notas em Conduzir entrevistas; consulte em Resultados.",
        { pagina: "entrevistas" },
      ),
      passo(
        ["#approvedTabAprovados", "#approvedRows"],
        "6. Lista de aprovados",
        "A lista vigente de cada edital, a convocação e o status de cada candidato.",
        { pagina: "approved" },
      ),
      passo(
        "#page-selecao .selecao-kpis",
        "7. Seleção",
        "O funil de cada vaga, de inscritos a contratados, e a taxa de contratação.",
        { pagina: "selecao" },
      ),
    ]),
  }),
  Object.freeze({
    id: "conduzir-entrevista",
    titulo: "Conduzir uma entrevista",
    resumo: "Edital, configuração, convocação e ficha de notas.",
    exige: (perfil) => paginasPermitidas(perfil).entrevistas === true,
    passos: Object.freeze([
      passo(
        CONDUZIR,
        "Conduzir entrevistas",
        "A condução fica nesta visão; Resultados é só consulta.",
        { pagina: "entrevistas" },
      ),
      passo(
        "#entrevistasEdital",
        "Escolha o edital",
        "Só aparecem editais dentro da janela da entrevista (de 7 dias antes a 15 dias depois das etapas) ou liberados.",
        { pagina: "entrevistas", antes: CONDUZIR },
      ),
      passo(
        "[data-passo='configuracao']",
        "Passo 1 · Configuração",
        "Com o edital escolhido, escolha o roteiro e confira a regra de convocação e a banca.",
        { pagina: "entrevistas", antes: CONDUZIR },
      ),
      passo(
        "[data-passo='convocacao']",
        "Passo 2 · Convocação",
        "Os aprovados na análise curricular, na ordem de cada vaga; a regra marca a sugestão.",
        { pagina: "entrevistas", antes: CONDUZIR },
      ),
      passo(
        "[data-passo='ficha']",
        "Passo 3 · Ficha de notas",
        "Abra um convocado e lance comparecimento e notas; Ctrl+Enter salva.",
        { pagina: "entrevistas", antes: CONDUZIR },
      ),
      passo(
        null,
        "Resultado",
        "A cada gravação o resultado é recalculado e aparece em Resultados. Lançar notas exige nível Editor em Entrevistas.",
        { pagina: "entrevistas" },
      ),
    ]),
  }),
  Object.freeze({
    id: "registrar-recurso",
    titulo: "Registrar e decidir um recurso",
    resumo: "O que faz quem registra e o que o jurídico decide.",
    exige: (perfil) =>
      canEditRecursos(perfil) || hasResource(perfil, "recursos_parecer", 2),
    passos: Object.freeze([
      passo(
        "[data-acao='novo-recurso']",
        "Registrar",
        "Quem edita Recursos registra o recurso com os dados do candidato e anexa os documentos.",
        { pagina: "recursos", exige: canEditRecursos },
      ),
      passo(
        "[aria-labelledby='recursosFilaTitulo']",
        "Rascunho e envio",
        "Na fila, abra o recurso, escreva o rascunho da resposta e envie para o parecer jurídico.",
        { pagina: "recursos", exige: canEditRecursos },
      ),
      passo(
        "#page-recursos .recursos-kpis",
        "Aguardando parecer",
        "São os recursos enviados ao jurídico e ainda sem decisão. Clicar no indicador filtra a fila.",
        { pagina: "recursos" },
      ),
      passo(
        null,
        "Decisão do jurídico",
        "Quem tem Parecer jurídico defere, defere parcialmente ou indefere, sempre com o texto do parecer, ou devolve para ajuste.",
        { pagina: "recursos" },
      ),
      passo(
        "[data-tour='recursos-pendencias']",
        "Devolvidos e prazos",
        "O devolvido volta a Registrado e fica nas pendências até ser reenviado. O prazo vem do cronograma do edital.",
        { pagina: "recursos" },
      ),
      passo(
        null,
        "Resposta ao candidato",
        "O jurídico aprova o texto da resposta; depois, quem edita marca a resposta como enviada.",
        { pagina: "recursos" },
      ),
    ]),
  }),
  Object.freeze({
    id: "dar-acesso",
    titulo: "Dar acesso a alguém",
    resumo: "Convite, grupo, coordenação e pedidos.",
    exige: canManageAccess,
    passos: Object.freeze([
      passo(
        "#acessosApp .acessos-abas",
        "Configurações › Acessos",
        "Aqui ficam as pessoas, os grupos de permissões e as coordenações.",
        { pagina: "config:acessos" },
      ),
      passo(
        "[data-tour='acessos-adicionar']",
        "Adicionar pessoa",
        "Informe o e-mail institucional, o nome, o grupo, a coordenação (ou ao menos uma área) e o motivo.",
        { pagina: "config:acessos" },
      ),
      passo(
        null,
        "Convite pronto",
        "A tela mostra a mensagem do convite para copiar ou abrir no e-mail. O link sozinho não dá acesso: a pessoa entra com o e-mail convidado.",
        { pagina: "config:acessos" },
      ),
      passo(
        PENDENTES,
        "Pedidos de acesso",
        "Quem entrou sem perfil ativo aparece em Pendentes, para aprovar com grupo e coordenação ou recusar.",
        { pagina: "config:acessos" },
      ),
      passo(
        [
          "[aria-label='Pessoas com acesso']",
          "[aria-label='Permissões por módulo']",
        ],
        "Ajustar depois",
        "Abra a pessoa para mudar grupo, coordenação ou áreas; toda alteração pede motivo.",
        { pagina: "config:acessos" },
      ),
    ]),
  }),
]);

/* ---------- Regras puras ---------- */

/** O tour da página aberta (`view` do legado; em Configurações, `config:<seção>`), já recortado pela área. */
export function tourDaPagina({ view = "", area = "", secao = "" } = {}) {
  const chave =
    view === "config" && secao ? `config:${secao}` : String(view || "");
  const tour = TOURS[chave];
  if (!tour) return null;
  const passos = tour.passos.filter(
    (p) => !p.areas || p.areas.includes(String(area || "")),
  );
  return passos.length ? { ...tour, chave, passos } : null;
}

/** As páginas que têm tour (para o painel saber quando oferecer). */
export const PAGINAS_COM_TOUR = Object.freeze(Object.keys(TOURS));

const permitida = (perfil, pagina) => {
  const [view, secao] = String(pagina || "").split(":");
  const paginas = paginasPermitidas(perfil);
  if (view === "config" && secao === "acessos") return canManageAccess(perfil);
  return paginas[view] === true;
};

/** Os passos da trilha que este perfil faz: só os de páginas que ele abre e cuja regra ele cumpre. */
export function passosDaTrilha(trilha, perfil) {
  return trilha.passos.filter(
    (p) =>
      (!p.pagina || permitida(perfil, p.pagina)) &&
      (!p.exige || p.exige(perfil)),
  );
}

/** As trilhas que o perfil pode fazer (a regra da trilha e ao menos um passo de tela). */
export function trilhasDoPerfil(perfil) {
  if (!perfil || perfil.ativo === false) return [];
  return TRILHAS.filter(
    (trilha) =>
      trilha.exige(perfil) &&
      passosDaTrilha(trilha, perfil).some((p) => p.pagina),
  ).map((trilha) => ({ ...trilha, passos: passosDaTrilha(trilha, perfil) }));
}

/* ---------- Progresso (o que progresso.js guarda) ---------- */

/** `{ [id]: { passo, concluida } }` a partir do que estava guardado, descartando o resto. */
export function progressoDasTrilhas(bruto) {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};
  const limpo = {};
  for (const trilha of TRILHAS) {
    const entrada = bruto[trilha.id];
    if (!entrada || typeof entrada !== "object") continue;
    const passoGuardado = Number(entrada.passo);
    limpo[trilha.id] = {
      passo:
        Number.isInteger(passoGuardado) && passoGuardado >= 0
          ? passoGuardado
          : 0,
      concluida: entrada.concluida === true,
    };
  }
  return limpo;
}

export function comPassoDaTrilha(progresso, id, passoAtual) {
  const anterior = progresso[id] || { passo: 0, concluida: false };
  return {
    ...progresso,
    [id]: { ...anterior, passo: Math.max(0, Number(passoAtual) || 0) },
  };
}

export function comTrilhaConcluida(progresso, id) {
  return { ...progresso, [id]: { passo: 0, concluida: true } };
}

/** "Concluída", "3 de 7" (parou no 3º) ou "7 passos" (não começou). */
export function rotuloDoProgresso(entrada, total) {
  if (entrada?.concluida) return "Concluída";
  if (entrada && entrada.passo > 0)
    return `${Math.min(entrada.passo + 1, total)} de ${total}`;
  return total === 1 ? "1 passo" : `${total} passos`;
}

/** Onde a trilha recomeça: do passo guardado, ou do começo se já foi concluída. */
export function passoParaRetomar(entrada, total) {
  if (!entrada || entrada.concluida || total <= 0) return 0;
  return Math.min(Math.max(0, entrada.passo), total - 1);
}

/* ---------- Onde pôr o balão ---------- */

/*
  `caixa`: o recorte na tela ({ top, left, width, height }) ou null (passo
  sem alvo); `balao`: { largura, altura }; `tela`: { largura, altura }.
  No celular, o balão ocupa a largura da tela, do lado oposto ao elemento
  (`{ modo: "celular", lado: "baixo" | "cima" }`). Fora dele, tenta embaixo,
  em cima, à direita e à esquerda do recorte, nessa ordem; se não couber em
  lugar nenhum, fica no pé da tela. Sempre dentro da tela.
*/
export function posicaoDoBalao({
  caixa,
  balao,
  tela,
  celular = false,
  margem = 12,
}) {
  const largura = balao?.largura || 0;
  const altura = balao?.altura || 0;
  const W = tela?.largura || 0;
  const H = tela?.altura || 0;
  if (celular) {
    const meio = caixa ? caixa.top + caixa.height / 2 : 0;
    return { modo: "celular", lado: caixa && meio > H / 2 ? "cima" : "baixo" };
  }
  const limitar = (valor, tamanho, total) =>
    Math.round(
      Math.min(
        Math.max(margem, valor),
        Math.max(margem, total - tamanho - margem),
      ),
    );
  if (!caixa)
    return {
      modo: "centro",
      top: limitar((H - altura) / 2, altura, H),
      left: limitar((W - largura) / 2, largura, W),
    };
  const baixo = caixa.top + caixa.height;
  const direita = caixa.left + caixa.width;
  const centroX = caixa.left + caixa.width / 2 - largura / 2;
  const centroY = caixa.top + caixa.height / 2 - altura / 2;
  const opcoes = [
    ["baixo", H - baixo >= altura + margem * 2, baixo + margem, centroX],
    [
      "cima",
      caixa.top >= altura + margem * 2,
      caixa.top - altura - margem,
      centroX,
    ],
    ["direita", W - direita >= largura + margem * 2, centroY, direita + margem],
    [
      "esquerda",
      caixa.left >= largura + margem * 2,
      centroY,
      caixa.left - largura - margem,
    ],
  ];
  const escolhida = opcoes.find(([, cabe]) => cabe);
  if (!escolhida)
    return {
      modo: "sobre",
      top: limitar(H - altura - margem, altura, H),
      left: limitar(centroX, largura, W),
    };
  const [lado, , top, left] = escolhida;
  return {
    modo: lado,
    top: limitar(top, altura, H),
    left: limitar(left, largura, W),
  };
}
