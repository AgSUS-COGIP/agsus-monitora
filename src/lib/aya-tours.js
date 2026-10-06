/*
  A educação guiada da Aya, em dados, sem DOM nem estado global: os tours
  "item por item" de cada tela e aba ("Me mostra esta tela") e as trilhas
  ("Aprender"), que juntam telas em sequência. Quem desenha é
  src/modulos/aya/tour/tour.jsx; quem guarda o progresso e os convites no
  navegador, src/modulos/aya/tour/progresso.js.

  Passo: `{ alvo, titulo, texto }`.
  - `alvo`: o elemento da vez, por atributo estável `data-tour="…"` (posto
    nos componentes só para isto; a função `t` monta o seletor) ou, onde o
    componente não tem um, outro seletor estável (id, data-*). Pode ser uma
    lista: vale o primeiro que achar um elemento visível. Sem `alvo`, o
    balão aparece no meio da tela (abertura, fechamento, explicação).
    Elemento ausente (sem permissão, tela vazia, aba fechada) pula o passo.
  - `titulo` e `texto`: curtos (título até 40 caracteres, uma ou duas
    frases), sem regra que não esteja num verbete de docs/aya/.
  - `areas` (opcional): só nessas áreas (a Visão geral muda por área).
  - `exige` (opcional): regra do perfil para o passo (o botão que só quem
    edita vê não entra no tour de quem só lê).
  - `antes` (opcional): a aba ou visão que precisa estar aberta; o tour
    clica nela se ainda não estiver marcada (só muda o que se vê).
  - Nas trilhas, `pagina`: a tela do passo (`recursos`, `config:acessos`);
    o tour navega até ela.

  Tours por aba: a chave é `view:aba` (`entrevistas:conduzir`,
  `classificacao:regra`, `approved:convocacao`); sem tour da aba, vale o da
  tela. Em Configurações, `config:<seção>`.

  O teste tests/aya-tours.test.js confere que cada `data-tour` usado aqui
  existe em algum componente.
*/

import {
  canChangeCandidateStatus,
  canEditClassificacao,
  canEditRecursos,
  canManageAccess,
  canManageEditais,
  isAdminGlobal,
  paginasPermitidas,
  podeUsarChat,
  secaoDeConfiguracaoPermitida,
} from "./access-roles.js";
import { hasResource } from "./permissoes-recursos.js";

const passo = (alvo, titulo, texto, extra = {}) =>
  Object.freeze({ alvo, titulo, texto, ...extra });

/** O seletor de um `data-tour`. */
export const t = (nome) => `[data-tour='${nome}']`;

const editaEntrevistas = (p) => hasResource(p, "entrevistas", 2);
const decideRecursos = (p) => hasResource(p, "recursos_parecer", 2);
const administraRecursos = (p) => hasResource(p, "recursos", 3);
const analisaDocumentos = (p) => hasResource(p, "avaliacao_documental", 2);
const coordenaAvaliacao = (p) => hasResource(p, "avaliacao_documental", 3);

/* ---------- Pedaços repetidos ---------- */

const PASSO_DA_AYA = passo(
  ".aya-arara, .aya-painel",
  "Pergunte à Aya",
  "Dúvida sobre esta tela ou uma regra? Me chame aqui; também digo números, como quantas análises estão pendentes.",
);

const ABA = Object.freeze({
  conduzir: `${t("entrevistas-visoes")} [data-valor='conduzir']`,
  roteiros: `${t("entrevistas-visoes")} [data-valor='roteiros']`,
  resultados: `${t("entrevistas-visoes")} [data-valor='resultados']`,
  listas: `${t("classificacao-abas")} [data-valor='listas']`,
  agenda: `${t("classificacao-abas")} [data-valor='agenda']`,
  regra: `${t("classificacao-abas")} [data-valor='regra']`,
  aprovados: "[data-approved-tab='aprovados']",
  convocacao: "[data-approved-tab='convocacao']",
  pendentes: `${t("acessos-situacao")} [data-valor='pendentes']`,
});

const PUBLICAR = passo(
  t("config-publicar"),
  "Publicar",
  "Nada vale até publicar; a publicação fica no histórico e pode ser restaurada.",
);

/* ---------- Tours de cada tela e aba ---------- */

const TOURS = Object.freeze({
  dashboard: Object.freeze({
    titulo: "Visão geral",
    passos: Object.freeze([
      passo(
        t("visao-geral-boas-vindas"),
        "Resumo da semana",
        "A saudação resume o que acontece nesta semana nos editais da área.",
      ),
      passo(
        t("visao-geral-ver-cronograma"),
        "Ver o cronograma",
        "Leva às etapas da semana no Cronograma.",
      ),
      passo(
        [t("visao-geral-filtros"), "#page-dashboard .visao-geral-filtros"],
        "Filtros",
        "Unidade, Edital e Status ficam à vista; Etapa, Risco e UF, em Mais opções. Cada filtro recorta a página inteira.",
      ),
      passo(
        [t("visao-geral-kpis"), "#page-dashboard .visao-geral-kpis"],
        "Indicadores",
        "Processos, Vagas, Contratações, Vagas ociosas, Críticos e Inscritos, contados nos editais do recorte.",
      ),
      passo(
        t("visao-geral-mapa-saude-indigena"),
        "Mapa dos DSEIs",
        "Escolher um DSEI no mapa recorta a página por ele; voltar ao Brasil tira esse filtro.",
        { areas: ["saude-indigena"] },
      ),
      passo(
        t("visao-geral-mapa-projetos"),
        "Mapa dos projetos",
        "O mapa mostra os municípios das vagas da área, tirados dos PDFs dos editais.",
        { areas: ["projetos"] },
      ),
      passo(
        t("visao-geral-mapa-tela-cheia"),
        "Mapa em tela cheia",
        "Abre o mapa na tela inteira; Esc volta.",
        { areas: ["saude-indigena", "projetos"] },
      ),
      passo(
        t("visao-geral-processos-por-projeto"),
        "Processos por projeto",
        "Quantos processos cada projeto tem no recorte.",
        { areas: ["projetos"] },
      ),
      passo(
        t("visao-geral-fases-e-pos-resultado"),
        "Fases e pós-resultado",
        "Em que fase estão os editais e o que vem depois do resultado: convocados, contratados e desistentes.",
      ),
      passo(
        [t("visao-geral-tabela"), "[aria-labelledby='visaoGeralTabelaTitulo']"],
        "Tabela de processos",
        "Cada linha é um edital, com o prazo e a próxima etapa coloridos pela urgência.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  nucleo: Object.freeze({
    titulo: "Editais",
    passos: Object.freeze([
      passo(
        [t("editais-kpis"), "#nucleoOperationalKpis"],
        "Cronogramas e alertas",
        "Os cartões (ativos, inativos, sem cronograma, próximos 7 dias…) filtram a tabela ao clicar.",
      ),
      passo(
        t("editais-filtro-ativo"),
        "Filtro aplicado",
        "Mostra o cartão que está filtrando a tabela; clique de novo para tirar.",
      ),
      passo("#nucleoSearch", "Busca", "Procure um edital da área atual."),
      passo(
        t("editais-novo"),
        "Novo edital",
        "Cadastra um edital da área atual, com cronograma, anexos em PDF e quadro de vagas.",
        { exige: canManageEditais },
      ),
      passo(
        [t("editais-tabela"), "#nucleoRows"],
        "Tabela de editais",
        "Com o cálculo automático ligado, o status e a etapa saem das datas do cronograma.",
      ),
      passo(
        t("editais-alerta-da-linha"),
        "Alerta do edital",
        "O que falta no edital, como cronograma ou quadro de vagas.",
      ),
      passo(
        t("editais-editar"),
        "Editar",
        "Abre o formulário: dados, cronograma, anexos em PDF e quadro de vagas.",
        { exige: canManageEditais },
      ),
      passo(
        t("editais-linha-do-tempo"),
        "Linha do tempo",
        "As etapas do edital de ponta a ponta e o histórico das mudanças.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  calendario: Object.freeze({
    titulo: "Cronograma",
    passos: Object.freeze([
      passo(
        t("cronograma-barra-do-mes"),
        "Mês",
        "Navegue entre os meses ou volte para hoje. As datas vêm dos cronogramas de Editais.",
      ),
      passo(t("cronograma-legenda"), "Legenda", "A cor de cada tipo de etapa."),
      passo(
        [t("cronograma-filtros"), "#page-calendario .cal-filtros"],
        "Filtros",
        "Recorte por unidade, edital ou tipo de etapa, e esconda as concluídas.",
      ),
      passo(
        [t("cronograma-grade"), "#calGrade"],
        "Calendário",
        "Cada dia mostra quantas etapas há; a etapa conta no dia em que começa e no dia em que termina.",
      ),
      passo(
        [t("cronograma-proximas"), "#calProximas"],
        "Próximas etapas",
        "As etapas que vêm por aí, em ordem de data.",
      ),
      passo(
        [t("cronograma-linha-do-tempo"), "#calTimeline"],
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
        t("analises-topo"),
        "Conferido e atualizar",
        "Quando a carga conferiu os dados e quando algo mudou; Atualizar relê e Exportar baixa o CSV.",
      ),
      passo(
        [t("analises-filtros"), "[aria-labelledby='analisesFiltrosTitulo']"],
        "Filtros",
        "Situação do processo (Ativo, Inativo, Todos), filtros, período e busca recortam a tela.",
      ),
      passo(
        [t("analises-kpis"), "#page-analises .analises-kpis"],
        "Indicadores",
        "Aptos para análise, realizadas, pendentes, em revisão, aprovados e reprovados; cada um filtra a lista.",
      ),
      passo(
        t("analises-pendencias"),
        "Pendências prioritárias",
        "Da mais grave para a menos grave; cada uma tem um atalho que aplica o filtro.",
      ),
      passo(
        "#chartTendencia",
        "Análises por dia",
        "Clicar num dia filtra a tela por ele; clicar em outro estende o período.",
      ),
      passo(
        "#chartResponsavel",
        "Por responsável",
        "A carga de cada responsável por status; clicar numa barra filtra.",
      ),
      passo(
        [t("analises-lista"), "[aria-labelledby='analisesFilaTitulo']"],
        "Lista",
        "As análises vindas das planilhas.",
      ),
      passo(
        t("analises-detalhes"),
        "Detalhes",
        "Abre a análise: parecer, pontuações, experiências e links.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  recursos: Object.freeze({
    titulo: "Recursos",
    passos: Object.freeze([
      passo(
        t("recursos-novo"),
        "Novo recurso",
        "Registra o recurso com os dados do candidato e os anexos.",
        { exige: canEditRecursos },
      ),
      passo(
        t("recursos-modelos"),
        "Modelos de resposta",
        "Os textos prontos das respostas, para o administrador de Recursos.",
        { exige: administraRecursos },
      ),
      passo(
        [t("recursos-filtros"), "[aria-labelledby='recursosFiltrosTitulo']"],
        "Filtros",
        "Recorte por edital, origem, analista, situação ou pendência, ou busque pelo candidato.",
      ),
      passo(
        [t("recursos-kpis"), "#page-recursos .recursos-kpis"],
        "Indicadores",
        "Aguardando parecer, Prazo vencido, Deferidos e Indeferidos; cada um filtra a tela.",
      ),
      passo(
        t("recursos-pendencias"),
        "Pendências prioritárias",
        "O que pede atenção, como prazo não encontrado ou mudança de nota; o atalho aplica o filtro.",
      ),
      passo(
        [t("recursos-fila"), "[aria-labelledby='recursosFilaTitulo']"],
        "Fila de recursos",
        "Cada recurso com situação, prazo e analista.",
      ),
      passo(
        t("recursos-detalhes"),
        "Abrir o recurso",
        "Dados, anexos, etapas, parecer, ajuste da pontuação e resposta ao candidato.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  entrevistas: Object.freeze({
    titulo: "Entrevistas · Resultados",
    passos: Object.freeze([
      passo(
        t("entrevistas-visoes"),
        "Três visões",
        "Resultados (consulta), Conduzir entrevistas e Roteiros. Cada visão tem o próprio tour.",
      ),
      passo(
        t("entrevistas-filtros"),
        "Filtros",
        "Recorte por edital, vaga, parecer e comparecimento.",
        { antes: ABA.resultados },
      ),
      passo(
        [t("entrevistas-kpis"), "#page-entrevistas .entrevistas-kpis"],
        "Indicadores",
        "Vagas com entrevista, candidatos, compareceram, aptos, inaptos e média das notas.",
        { antes: ABA.resultados },
      ),
      passo(
        t("entrevistas-pendencias"),
        "Pendências",
        "Como aprovados na análise sem entrevista e notas que não batem com a soma.",
        { antes: ABA.resultados },
      ),
      passo(
        [
          t("entrevistas-tabela"),
          "[aria-labelledby='entrevistasTabelaTitulo']",
        ],
        "Tabela de resultados",
        "O resultado de cada candidato entrevistado da área atual.",
        { antes: ABA.resultados },
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "entrevistas:conduzir": Object.freeze({
    titulo: "Entrevistas · Conduzir",
    passos: Object.freeze([
      passo(
        [t("entrevistas-conduzir-seletor-edital"), "#entrevistasEdital"],
        "Edital da entrevista",
        "Aparecem os editais dentro da janela da entrevista ou liberados pelo administrador global.",
      ),
      passo(
        t("entrevistas-conduzir-liberacao"),
        "Liberar fora da janela",
        "O administrador global libera um edital fora da janela.",
        { exige: isAdminGlobal },
      ),
      passo(
        [t("entrevistas-conduzir-configuracao"), "[data-passo='configuracao']"],
        "Passo 1 · Configuração",
        "O roteiro preenche a regra de convocação e a banca padrão.",
      ),
      passo(
        t("entrevistas-conduzir-vagas"),
        "Vagas",
        "As vagas do edital, com o quadro de vagas.",
      ),
      passo(
        [t("entrevistas-conduzir-convocacao"), "[data-passo='convocacao']"],
        "Passo 2 · Convocação",
        "A lista de convocação vem da Classificação, na ordem de cada vaga.",
      ),
      passo(
        t("entrevistas-conduzir-convocar"),
        "Convocar",
        "Confirma a convocação dos candidatos marcados.",
        { exige: editaEntrevistas },
      ),
      passo(
        t("entrevistas-conduzir-agenda-do-dia"),
        "Agenda do dia",
        "Os horários das entrevistas de hoje, gerados na agenda da Classificação.",
      ),
      passo(
        [t("entrevistas-conduzir-ficha"), "[data-passo='ficha']"],
        "Passo 3 · Ficha de notas",
        "Abra um convocado para lançar comparecimento e notas; o resultado é recalculado a cada gravação.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "entrevistas:roteiros": Object.freeze({
    titulo: "Entrevistas · Roteiros",
    passos: Object.freeze([
      passo(
        t("entrevistas-roteiros"),
        "Roteiros",
        "Modelos reutilizáveis da entrevista: critérios, pontuação e banca.",
      ),
      passo(
        t("entrevistas-roteiros-novo"),
        "Novo roteiro",
        "Cria um roteiro do zero.",
        { exige: editaEntrevistas },
      ),
      passo(
        t("entrevistas-roteiros-lista"),
        "Lista de roteiros",
        "Editar grava uma versão nova; os editais já configurados continuam na anterior.",
      ),
      passo(
        t("entrevistas-roteiros-pontuacao"),
        "Pontuação",
        "Os critérios e a nota máxima de cada um.",
      ),
      passo(
        t("entrevistas-roteiros-salvar"),
        "Salvar",
        "Grava a nova versão do roteiro.",
        { exige: editaEntrevistas },
      ),
      PASSO_DA_AYA,
    ]),
  }),
  classificacao: Object.freeze({
    titulo: "Classificação · Listas",
    passos: Object.freeze([
      passo(
        [t("classificacao-seletor-edital"), t("classificacao-edital")],
        "Edital",
        "A regra de classificação é de cada edital, decidida pelo gestor dele.",
      ),
      passo(
        t("classificacao-abas"),
        "Listas, Agenda e Regra",
        "Listas mostra a classificação; Agenda, os horários da entrevista; Regra, o que vale no edital.",
      ),
      passo(
        t("classificacao-listas"),
        "Quatro listas",
        "Preliminar, convocação para entrevista, entrevista e resultado final.",
        { antes: ABA.listas },
      ),
      passo(
        t("classificacao-kpis"),
        "Indicadores",
        "Os números da lista escolhida.",
      ),
      passo(
        "#page-classificacao .classificacao-avisos",
        "Avisos",
        "O que falta para a lista ficar certa, como empate esperando sorteio.",
      ),
      passo(
        t("classificacao-empates"),
        "Empates",
        "Empate que os critérios não resolvem vai para o sorteio registrado.",
      ),
      passo(
        t("classificacao-gerar"),
        "Gerar a lista",
        "Registra a lista com a versão da regra.",
        { exige: canEditClassificacao },
      ),
      passo(
        t("classificacao-exportar-lista"),
        "Exportar",
        "A lista sai em PDF, DOCX ou XLSX.",
      ),
      passo(
        t("classificacao-copiar-sei"),
        "Copiar para o SEI",
        "Copia o documento pronto para colar no SEI.",
      ),
      passo(
        t("classificacao-abrir-agenda"),
        "Agenda da entrevista",
        "Na convocação para entrevista, leva à agenda com os horários.",
      ),
      passo(
        t("classificacao-publicar-aprovados"),
        "Publicar como aprovados",
        "O resultado final vira a lista de aprovados do edital.",
        { exige: canEditClassificacao },
      ),
      passo(
        "#page-classificacao .classificacao-vaga",
        "Por vaga",
        "Clique no nome para ver por que o candidato está naquela posição.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "classificacao:agenda": Object.freeze({
    titulo: "Classificação · Agenda",
    passos: Object.freeze([
      passo(
        t("classificacao-agenda-regra"),
        "Regra dos horários",
        "Dias, horários, duração e intervalo das entrevistas.",
      ),
      passo(
        t("classificacao-agenda-salvar-regra"),
        "Salvar a regra",
        "Grava a regra para gerar os horários.",
        { exige: canEditClassificacao },
      ),
      passo(
        t("classificacao-agenda-convocados"),
        "Convocados",
        "Quem está na lista de convocação para entrevista.",
      ),
      passo(
        t("classificacao-agenda-gerar"),
        "Gerar horários",
        "Distribui os convocados pelos horários da regra; depois dá para ajustar.",
        { exige: canEditClassificacao },
      ),
      passo(
        t("classificacao-agenda-tabela"),
        "Agenda",
        "Cada convocado com dia e horário; ajuste aqui antes de salvar.",
      ),
      passo(
        t("classificacao-agenda-salvar"),
        "Salvar a agenda",
        "Grava os horários; eles aparecem na Agenda do dia em Conduzir entrevistas.",
        { exige: canEditClassificacao },
      ),
      passo(
        t("classificacao-agenda-xlsx"),
        "Planilha",
        "Baixa a agenda em XLSX para levar ao documento.",
      ),
      passo(
        t("classificacao-agenda-historico"),
        "Histórico",
        "As versões salvas da agenda.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "classificacao:regra": Object.freeze({
    titulo: "Classificação · Regra",
    passos: Object.freeze([
      passo(
        t("classificacao-regra"),
        "Regra do edital",
        "O que vale na classificação deste edital, com versões.",
      ),
      passo(
        t("classificacao-regra-etapas"),
        "Etapas e pesos",
        "Quais notas entram (análise, entrevista, ART) e o peso de cada uma.",
      ),
      passo(
        t("classificacao-regra-minimos"),
        "Notas mínimas",
        "Abaixo do mínimo, o candidato não classifica.",
      ),
      passo(
        t("classificacao-regra-desempate"),
        "Desempate",
        "A ordem dos critérios de desempate, como 60 anos ou mais.",
      ),
      passo(
        t("classificacao-regra-modalidades"),
        "Modalidades",
        "Ampla concorrência e reservas (PP, PI, PcD…) com os percentuais.",
      ),
      passo(
        t("classificacao-regra-convocacao"),
        "Convocação para entrevista",
        "Quantos candidatos por vaga vão para a entrevista.",
      ),
      passo(
        [
          t("classificacao-regra-botao-salvar"),
          t("classificacao-regra-salvar"),
        ],
        "Salvar a regra",
        "Grava uma versão nova da regra, com motivo.",
        { exige: canEditClassificacao },
      ),
      passo(
        t("classificacao-regra-versoes"),
        "Versões",
        "Cada lista gerada guarda a versão da regra usada.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  approved: Object.freeze({
    titulo: "Lista de aprovados · Aprovados",
    passos: Object.freeze([
      passo(
        t("aprovados-visoes"),
        "Aprovados e Convocação",
        "Aprovados mostra a lista vigente de cada edital; Convocação, a ordem de convocação por vaga.",
      ),
      passo(
        t("aprovados-kpis"),
        "Indicadores",
        "Os números da lista no recorte dos filtros.",
        { antes: ABA.aprovados },
      ),
      passo(
        t("aprovados-origem-das-listas"),
        "Origem da lista",
        "Se a lista veio de planilha importada ou publicada da Classificação.",
      ),
      passo(
        t("aprovados-filtros"),
        "Filtros",
        "Escolha o edital e os demais filtros.",
      ),
      passo(
        t("aprovados-sub-judice"),
        "Sub judice",
        "Inclui candidato por decisão judicial, com o documento.",
        { exige: canChangeCandidateStatus },
      ),
      passo(
        [t("aprovados-tabela"), "#approvedRows"],
        "Candidatos",
        "Cada candidato com classificação, nota, modalidade e status.",
      ),
      passo(
        "[data-approved-action='status']",
        "Status do candidato",
        "Convocado, Contratado, Desistente, Migração ou Documentação rejeitada; status definido só o admin altera, exceto o Convocado.",
        { exige: canChangeCandidateStatus },
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "approved:convocacao": Object.freeze({
    titulo: "Lista de aprovados · Convocação",
    passos: Object.freeze([
      passo(
        t("aprovados-convocacao-kpis"),
        "Indicadores",
        "Os números da convocação no recorte.",
        { antes: ABA.convocacao },
      ),
      passo(
        t("aprovados-convocacao-filtros"),
        "Filtros",
        "Escolha o edital e a vaga.",
      ),
      passo(
        t("aprovados-convocacao-acoes"),
        "Ações",
        "Modelo de convocação, carta e exportação.",
      ),
      passo(
        t("aprovados-escolher-a-convocar"),
        "Escolher quem convocar",
        "Marca os próximos da ordem de convocação de cada vaga.",
        { exige: canChangeCandidateStatus },
      ),
      passo(
        t("aprovados-carta-de-convocacao"),
        "Carta de convocação",
        "Gera a carta dos marcados a partir de um modelo e marca como Convocado.",
        { exige: canChangeCandidateStatus },
      ),
      passo(
        t("aprovados-modelos-da-carta"),
        "Modelos da carta",
        "Os textos das cartas, com os campos que se preenchem sozinhos.",
      ),
      passo(
        t("aprovados-exportar-csv"),
        "Exportar",
        "Baixa a ordem de convocação em CSV.",
      ),
      passo(
        [t("aprovados-tabela-convocacao"), "#convocacaoRows"],
        "Ordem de convocação",
        "A ordem por vaga, alternando ampla concorrência e reservas pela regra.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  selecao: Object.freeze({
    titulo: "Seleção",
    passos: Object.freeze([
      passo(
        [t("selecao-filtros"), "[aria-labelledby='selecaoFiltrosTitulo']"],
        "Filtros",
        "Unidade, edital, cargo e vaga, com várias escolhas em cada um.",
      ),
      passo(
        [t("selecao-kpis"), "#page-selecao .selecao-kpis"],
        "Funil por vaga",
        "Inscritos, aptos, triados, convocados, aprovados e contratados, da planilha Auditoria.",
      ),
      passo(
        "#page-selecao [data-kpi='taxa']",
        "Taxa de contratação",
        "Contratados divididos por aprovados, em porcentagem.",
      ),
      passo(
        "#chartDsei",
        "Ranking de unidades",
        "Clicar numa barra filtra pela unidade; clicar de novo tira.",
      ),
      passo(
        t("selecao-observacoes"),
        "Alertas do recorte",
        "As observações da planilha Auditoria, com quantas vagas têm cada uma.",
      ),
      passo(
        [t("selecao-tabela"), "[aria-labelledby='selecaoTabelaTitulo']"],
        "Tabela de vagas",
        "O funil de cada vaga; a carga roda de hora em hora.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "avaliacao-documental": Object.freeze({
    titulo: "Avaliação documental",
    passos: Object.freeze([
      passo(
        t("avd-seletor-edital"),
        "Edital",
        "Aparecem os editais vigentes da área; a regra, a equipe e a fila são de cada edital.",
      ),
      passo(
        t("avd-todos-editais"),
        "Todos os editais",
        "Marque para ver também os concluídos e os cancelados.",
      ),
      passo(
        t("avd-visoes"),
        "Regra, Equipe, Pré-classificação e Fila",
        "Regra e Equipe preparam o edital; a Pré-classificação ordena pela ART e recorta o lote; a Fila distribui as fichas.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "avaliacao-documental:fila": Object.freeze({
    titulo: "Avaliação documental · Fila",
    passos: Object.freeze([
      passo(
        t("avd-fila-etapas"),
        "Etapas com contadores",
        "Inscritos, no lote, pendentes, em análise, em revisão, concluídas e eliminados; clique numa etapa para filtrar.",
        { antes: `${t("avd-visoes")} [data-valor='fila']` },
      ),
      passo(
        t("avd-fila-filtros"),
        "Filtros",
        "Vaga, responsável, modalidade e a busca por código ou nome; Enter com o código abre a ficha.",
      ),
      passo(
        t("avd-fila-filtros-salvos"),
        "Filtros salvos",
        "Guarde uma combinação com um nome; os filtros salvos são só seus.",
      ),
      passo(
        t("avd-fila-minhas"),
        "Minhas fichas",
        "Mostra só as fichas que estão com você.",
      ),
      passo(
        t("avd-fila-pegar"),
        "Pegar próximo",
        "Dá a próxima ficha na ordem da Provisória e a reserva para você por 15 minutos.",
        { exige: analisaDocumentos },
      ),
      passo(
        t("avd-fila-distribuir-livres"),
        "Distribuir",
        "A coordenação divide as fichas livres entre a equipe, com a prévia antes de gravar.",
        { exige: coordenaAvaliacao },
      ),
      passo(
        t("avd-fila-abrir-fichas"),
        "Abrir fichas do lote",
        "Abre as fichas de quem entrou no lote e ainda não tem.",
        { exige: coordenaAvaliacao },
      ),
      passo(
        t("avd-fila-tabela"),
        "As fichas",
        "Situação, responsável e quem está com a ficha aberta agora; nas concluídas, a nota e o resultado. Abrir mostra a ficha.",
      ),
      passo(
        t("avd-ficha-blocos"),
        "Um cartão por bloco",
        "O que o candidato declarou na Empregare e Conforme, Não conforme ou Não enviado; as teclas 1, 2 e 3 marcam o bloco da vez.",
      ),
      passo(
        t("avd-ficha-itens"),
        "Títulos, cursos e vínculos",
        "Lance os itens comprovados; os pontos são calculados na hora pela regra.",
      ),
      passo(
        t("avd-ficha-nota"),
        "Nota do bloco",
        "Declarado, calculado e apurado; dá para ajustar a nota até o teto do bloco.",
      ),
      passo(
        t("avd-ficha-justificativa"),
        "Justificativa",
        "Nota diferente da declarada pede uma justificativa da lista; ela entra no parecer.",
      ),
      passo(
        t("avd-ficha-comparacao"),
        "Declarado × apurado",
        "A nota ao vivo de cada bloco; a diferença aparece destacada, com a justificativa.",
      ),
      passo(
        t("avd-ficha-empregare"),
        "Empregare",
        "Abra o candidato na Empregare para conferir os documentos; sem o link, copie o código e abra a vaga.",
      ),
      passo(
        t("avd-ficha-parecer"),
        "Parecer",
        "Gerado pela regra a partir dos motivos, das justificativas e da observação.",
      ),
      passo(
        t("avd-ficha-barra"),
        "Salvar e concluir",
        "O rascunho salva sozinho; Concluir e próxima confere o que falta, conclui e abre a próxima.",
      ),
      passo(
        t("avd-ficha-reabrir"),
        "Reabrir",
        "A coordenação reabre uma ficha concluída, com motivo.",
        { exige: coordenaAvaliacao },
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "config:marca": Object.freeze({
    titulo: "Configurações › Marca",
    passos: Object.freeze([
      passo(
        "[data-view='config'][data-secao='marca']",
        "Seções",
        "Cada seção de Configurações fica no menu, embaixo de Configurações.",
      ),
      passo(
        t("config-marca"),
        "Marca",
        "Nomes e identidade que aparecem em todo o sistema.",
      ),
      PUBLICAR,
      PASSO_DA_AYA,
    ]),
  }),
  "config:inicio": Object.freeze({
    titulo: "Configurações › Página inicial",
    passos: Object.freeze([
      passo(
        t("config-inicio"),
        "Página inicial",
        "Título, aviso global e rótulos dos indicadores.",
      ),
      PUBLICAR,
      PASSO_DA_AYA,
    ]),
  }),
  "config:acesso": Object.freeze({
    titulo: "Configurações › Tela de acesso",
    passos: Object.freeze([
      passo(
        t("config-acesso"),
        "Tela de acesso",
        "Saudação, login com Google e domínios que podem entrar.",
      ),
      PUBLICAR,
      PASSO_DA_AYA,
    ]),
  }),
  "config:aparencia": Object.freeze({
    titulo: "Configurações › Aparência",
    passos: Object.freeze([
      passo(
        t("config-aparencia"),
        "Aparência",
        "Arte de fundo, logo e cores, com o contraste de cada uma.",
      ),
      PUBLICAR,
      PASSO_DA_AYA,
    ]),
  }),
  "config:recursos": Object.freeze({
    titulo: "Configurações › Painéis externos",
    passos: Object.freeze([
      passo(
        t("config-recursos"),
        "Painéis externos",
        "Os painéis do menu: título, endereço e situação.",
      ),
      passo(
        t("config-recursos-tabela"),
        "Lista de painéis",
        "Edite, ponha em manutenção ou tire do menu.",
      ),
      PUBLICAR,
      PASSO_DA_AYA,
    ]),
  }),
  "config:operacao": Object.freeze({
    titulo: "Configurações › Operação",
    passos: Object.freeze([
      passo(
        t("config-operacao"),
        "Operação",
        "Versão, atualização em tempo real e Pessoas online.",
      ),
      passo(
        t("config-operacao-historico"),
        "Histórico",
        "As publicações anteriores; restaurar grava uma publicação nova.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "config:modulos": Object.freeze({
    titulo: "Configurações › Módulos e abas",
    passos: Object.freeze([
      passo(
        t("config-modulos"),
        "Módulos e abas",
        "Ativa, desativa ou põe em manutenção o sistema e as áreas.",
      ),
      passo(
        t("config-modulos-abas"),
        "Abas",
        "Cada aba pode ficar ativa, em manutenção ou com selo BETA.",
      ),
      passo(
        t("config-modulos-paineis"),
        "Painéis",
        "A situação de cada painel externo.",
      ),
      passo(
        t("config-modulos-comemoracoes"),
        "Comemorações",
        "Liga ou desliga os avisos de parabéns.",
      ),
      passo(
        [t("config-modulos-revisar"), t("config-modulos-salvar")],
        "Revisar e salvar",
        "Confere o que muda antes de gravar.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "config:cargas": Object.freeze({
    titulo: "Status das atualizações",
    passos: Object.freeze([
      passo(
        t("cargas-resumo"),
        "Resumo",
        "Se alguma atualização de dados falhou ou atrasou.",
      ),
      passo(t("cargas-atualizar"), "Atualizar", "Relê a situação das cargas."),
      passo(
        t("cargas-lista"),
        "Cada carga",
        "Análises, Seleção, Entrevistas, robô da Empregare e tarefas do banco, com a última execução.",
      ),
      passo(
        "[data-carga='selecao'] .saude-rodar, [data-carga='entrevistas'] .saude-rodar",
        "Rodar agora",
        "Dispara a carga fora do horário; Seleção e Entrevistas rodam de hora em hora.",
      ),
      passo(
        [t("cargas-rodar-empregare"), t("cargas-empregare")],
        "Robô da Empregare",
        "Não tem agenda: só roda quando um administrador clica em Rodar agora.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "config:mensagens": Object.freeze({
    titulo: "Configurações › Mensagens",
    passos: Object.freeze([
      passo(
        t("config-mensagens"),
        "Mensagens guardadas",
        "Quantas mensagens do chat estão guardadas.",
      ),
      passo(
        t("config-mensagens-salvar-prazo"),
        "Prazo de retenção",
        "Mensagens mais velhas que o prazo são apagadas toda madrugada.",
      ),
      passo(
        [t("config-mensagens-zerar-botao"), t("config-mensagens-zerar")],
        "Zerar mensagens",
        "Apaga todas as mensagens de uma vez, com confirmação.",
      ),
      passo(
        t("config-mensagens-historico"),
        "Histórico das limpezas",
        "Quem limpou, quando e quantas mensagens saíram.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
  "config:acessos": Object.freeze({
    titulo: "Configurações › Acessos",
    passos: Object.freeze([
      passo(
        [t("acessos-aba-usuarios"), "#acessosApp .acessos-abas"],
        "Usuários, Grupos e Coordenações",
        "Grupos e Coordenações aparecem só para o administrador global.",
      ),
      passo(
        t("acessos-situacao"),
        "Ativos e Pendentes",
        "Em Pendentes ficam os pedidos de acesso de quem entrou sem perfil ativo.",
      ),
      passo(
        t("acessos-adicionar"),
        "Adicionar pessoa",
        "Informe e-mail institucional, nome, grupo, coordenação e motivo. A tela mostra o convite pronto.",
      ),
      passo(t("acessos-filtros"), "Filtros", "Busque por nome, grupo ou área."),
      passo(
        [t("acessos-lista"), t("acessos-por-modulo")],
        "Pessoas",
        "Abra uma pessoa para ver o grupo, a coordenação e como ela vê o menu.",
      ),
      passo(
        t("acessos-salvar"),
        "Salvar com motivo",
        "Alteração pendente se salva aqui, com motivo. Ninguém altera o próprio acesso.",
      ),
      PASSO_DA_AYA,
    ]),
  }),
});

/* ---------- Trilhas ("Aprender") ---------- */

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
        "Eu mostro item por item onde fica cada coisa. Use as setas do teclado ou os botões; Esc sai quando quiser.",
        { pagina: "dashboard" },
      ),
      passo(
        [t("barra-seletor-de-area"), "[data-seletor-de-area]"],
        "Área atual",
        "Saúde Indígena, SEDE e Projetos repetem as mesmas páginas; cada página mostra só a área escolhida aqui.",
        { pagina: "dashboard" },
      ),
      passo(
        [t("barra-menu"), "#nav", "#mobileBottomNav"],
        "Menu",
        "As páginas seguem as etapas do processo seletivo, de Editais à Seleção.",
        { pagina: "dashboard" },
      ),
      passo(
        [t("visao-geral-filtros"), "#page-dashboard .visao-geral-filtros"],
        "Visão geral: filtros",
        "Os filtros recortam os indicadores, o mapa e a tabela.",
        { pagina: "dashboard" },
      ),
      passo(
        [t("visao-geral-kpis"), "#page-dashboard .visao-geral-kpis"],
        "Visão geral: indicadores",
        "Processos, Vagas, Contratações, Vagas ociosas, Críticos e Inscritos do recorte.",
        { pagina: "dashboard" },
      ),
      passo(
        null,
        "Busca rápida",
        "Ctrl+K (ou Cmd+K) abre a busca global por edital, unidade, etapa, responsável e mais.",
        { pagina: "dashboard" },
      ),
      passo(
        t("chat-botao"),
        "Mensagens",
        "Converse com a equipe; cada edital pode ter a própria conversa.",
        { pagina: "dashboard", exige: podeUsarChat },
      ),
      passo(
        [t("barra-tema"), t("barra-rodape")],
        "Tema e saída",
        "Troque entre claro e escuro e saia da conta aqui.",
        { pagina: "dashboard" },
      ),
      passo(
        ".aya-arara, .aya-painel",
        "Peça ajuda à Aya",
        "Em qualquer tela, me chame para explicar, mostrar a tela item por item ou dizer um número.",
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
        [t("editais-kpis"), "#nucleoOperationalKpis"],
        "1. Editais",
        "Tudo começa no edital: cadastro, cronograma, anexos em PDF e quadro de vagas.",
        { pagina: "nucleo" },
      ),
      passo(
        [t("cronograma-grade"), "#calGrade"],
        "2. Cronograma",
        "As etapas salvas nos editais aparecem num calendário, só para consulta.",
        { pagina: "calendario" },
      ),
      passo(
        [t("analises-kpis"), "#page-analises .analises-kpis"],
        "3. Painel das análises",
        "A análise de cada candidato chega das planilhas; acompanhe as pendências e os resultados.",
        { pagina: "analises" },
      ),
      passo(
        [t("recursos-kpis"), "#page-recursos .recursos-kpis"],
        "4. Recursos",
        "Os recursos dos candidatos, do registro ao parecer jurídico e à resposta.",
        { pagina: "recursos" },
      ),
      passo(
        t("classificacao-abas"),
        "5. Classificação",
        "A regra de cada edital gera as listas: convocação para entrevista e resultado final.",
        { pagina: "classificacao" },
      ),
      passo(
        t("entrevistas-visoes"),
        "6. Entrevistas",
        "Configure, convoque e lance as notas em Conduzir; consulte em Resultados.",
        { pagina: "entrevistas" },
      ),
      passo(
        [t("aprovados-visoes"), "#approvedRows"],
        "7. Lista de aprovados",
        "A lista vigente de cada edital, a convocação, a carta e o status de cada candidato.",
        { pagina: "approved" },
      ),
      passo(
        [t("selecao-kpis"), "#page-selecao .selecao-kpis"],
        "8. Seleção",
        "O funil de cada vaga, de inscritos a contratados, e a taxa de contratação.",
        { pagina: "selecao" },
      ),
    ]),
  }),
  Object.freeze({
    id: "conduzir-entrevista",
    titulo: "Conduzir uma entrevista",
    resumo: "Edital, configuração, convocação, agenda e ficha de notas.",
    exige: (perfil) => paginasPermitidas(perfil).entrevistas === true,
    passos: Object.freeze([
      passo(
        ABA.conduzir,
        "Conduzir entrevistas",
        "A condução fica nesta visão; Resultados é só consulta.",
        { pagina: "entrevistas" },
      ),
      passo(
        [t("entrevistas-conduzir-seletor-edital"), "#entrevistasEdital"],
        "Escolha o edital",
        "Só aparecem editais dentro da janela da entrevista (de 7 dias antes a 15 dias depois) ou liberados.",
        { pagina: "entrevistas", antes: ABA.conduzir },
      ),
      passo(
        [t("entrevistas-conduzir-configuracao"), "[data-passo='configuracao']"],
        "Passo 1 · Configuração",
        "Com o edital escolhido, escolha o roteiro e confira a regra de convocação e a banca.",
        { pagina: "entrevistas", antes: ABA.conduzir },
      ),
      passo(
        [t("entrevistas-conduzir-convocacao"), "[data-passo='convocacao']"],
        "Passo 2 · Convocação",
        "A lista de convocação vem da Classificação, na ordem de cada vaga.",
        { pagina: "entrevistas", antes: ABA.conduzir },
      ),
      passo(
        t("entrevistas-conduzir-agenda-do-dia"),
        "Agenda do dia",
        "Os horários gerados na agenda da Classificação.",
        { pagina: "entrevistas", antes: ABA.conduzir },
      ),
      passo(
        [t("entrevistas-conduzir-ficha"), "[data-passo='ficha']"],
        "Passo 3 · Ficha de notas",
        "Abra um convocado e lance comparecimento e notas; Ctrl+Enter salva.",
        { pagina: "entrevistas", antes: ABA.conduzir },
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
    exige: (perfil) => canEditRecursos(perfil) || decideRecursos(perfil),
    passos: Object.freeze([
      passo(
        t("recursos-novo"),
        "Registrar",
        "Quem edita Recursos registra o recurso com os dados do candidato e anexa os documentos.",
        { pagina: "recursos", exige: canEditRecursos },
      ),
      passo(
        [t("recursos-fila"), "[aria-labelledby='recursosFilaTitulo']"],
        "Rascunho e envio",
        "Na fila, abra o recurso, escreva o rascunho da resposta e envie para o parecer jurídico.",
        { pagina: "recursos", exige: canEditRecursos },
      ),
      passo(
        [t("recursos-kpis"), "#page-recursos .recursos-kpis"],
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
        null,
        "Ajuste da pontuação",
        "Recurso que muda nota tem a proposta de ajuste; aprovada, ela entra na Classificação.",
        { pagina: "recursos" },
      ),
      passo(
        t("recursos-pendencias"),
        "Devolvidos e prazos",
        "O devolvido volta a Registrado e fica nas pendências até ser reenviado. O prazo vem do cronograma.",
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
    id: "convocar-e-emitir-carta",
    titulo: "Convocar e emitir carta",
    resumo: "Ordem de convocação, marcar convocados e carta.",
    exige: canChangeCandidateStatus,
    passos: Object.freeze([
      passo(
        t("aprovados-visoes"),
        "Lista de aprovados",
        "A convocação parte da lista vigente de cada edital.",
        { pagina: "approved" },
      ),
      passo(
        ABA.convocacao,
        "Aba Convocação",
        "A ordem de convocação por vaga, pela regra do modelo.",
        { pagina: "approved" },
      ),
      passo(
        t("aprovados-convocacao-filtros"),
        "Edital e vaga",
        "Escolha o edital e a vaga que vai convocar.",
        { pagina: "approved", antes: ABA.convocacao },
      ),
      passo(
        [t("aprovados-tabela-convocacao"), "#convocacaoRows"],
        "Ordem de convocação",
        "Ampla concorrência e reservas alternam pela regra; quem já tem status sai da vez.",
        { pagina: "approved", antes: ABA.convocacao },
      ),
      passo(
        t("aprovados-escolher-a-convocar"),
        "Escolher quem convocar",
        "Marque os próximos da ordem.",
        { pagina: "approved", antes: ABA.convocacao },
      ),
      passo(
        t("aprovados-carta-de-convocacao"),
        "Carta de convocação",
        "Abre a carta dos marcados, a partir de um modelo.",
        { pagina: "approved", antes: ABA.convocacao },
      ),
      passo(
        null,
        "Emitir e marcar",
        "Na carta, confira a prévia, emita e marque os candidatos como Convocado, com a data.",
        { pagina: "approved" },
      ),
      passo(
        t("aprovados-modelos-da-carta"),
        "Modelos da carta",
        "Os textos das cartas ficam aqui, com os campos que se preenchem sozinhos.",
        { pagina: "approved", antes: ABA.convocacao },
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
        [t("acessos-aba-usuarios"), "#acessosApp .acessos-abas"],
        "Configurações › Acessos",
        "Aqui ficam as pessoas, os grupos de permissões e as coordenações.",
        { pagina: "config:acessos" },
      ),
      passo(
        t("acessos-adicionar"),
        "Adicionar pessoa",
        "Informe o e-mail institucional, o nome, o grupo, a coordenação (ou ao menos uma área) e o motivo.",
        { pagina: "config:acessos" },
      ),
      passo(
        null,
        "Convite pronto",
        "A tela mostra a mensagem do convite para copiar ou abrir no e-mail. O link sozinho não dá acesso.",
        { pagina: "config:acessos" },
      ),
      passo(
        ABA.pendentes,
        "Pedidos de acesso",
        "Quem entrou sem perfil ativo aparece em Pendentes, para aprovar com grupo e coordenação ou recusar.",
        { pagina: "config:acessos" },
      ),
      passo(
        [t("acessos-lista"), t("acessos-por-modulo")],
        "Ajustar depois",
        "Abra a pessoa para mudar grupo, coordenação ou áreas; toda alteração pede motivo.",
        { pagina: "config:acessos" },
      ),
    ]),
  }),
]);

/* ---------- Regras puras ---------- */

/* As abas que têm tour próprio, pelo valor que a tela marca. */
const ABAS_COM_TOUR = Object.freeze({
  entrevistas: ["conduzir", "roteiros"],
  classificacao: ["agenda", "regra"],
  approved: ["convocacao"],
  "avaliacao-documental": ["fila"],
});

function normalizarAba(aba) {
  return String(aba || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)[0];
}

/** A chave do tour para o que está aberto (`view`, aba, seção de Configurações). */
export function chaveDoTour({ view = "", secao = "", aba = "" } = {}) {
  const base = String(view || "");
  if (base === "config") return secao ? `config:${secao}` : "config";
  const escolhida = normalizarAba(aba);
  if ((ABAS_COM_TOUR[base] || []).includes(escolhida))
    return `${base}:${escolhida}`;
  return base;
}

const passoPermitido = (p, perfil) => !p.exige || !perfil || p.exige(perfil);

/**
 * O tour da tela aberta (e da aba), recortado pela área e pelo perfil: os
 * passos de botão que a pessoa não vê saem. `null` se a tela não tem tour.
 */
export function tourDaPagina({
  view = "",
  area = "",
  secao = "",
  aba = "",
  perfil = null,
} = {}) {
  const chave = chaveDoTour({ view, secao, aba });
  const tour = TOURS[chave];
  if (!tour) return null;
  const passos = tour.passos.filter(
    (p) =>
      (!p.areas || p.areas.includes(String(area || ""))) &&
      passoPermitido(p, perfil),
  );
  return passos.length ? { ...tour, chave, passos } : null;
}

/** As telas e abas que têm tour. */
export const PAGINAS_COM_TOUR = Object.freeze(Object.keys(TOURS));

const permitida = (perfil, pagina) => {
  const [view, secao] = String(pagina || "").split(":");
  if (view === "config" && secao)
    return secaoDeConfiguracaoPermitida(perfil, secao);
  return paginasPermitidas(perfil)[view] === true;
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

/** "Passo 3 de 9". */
export const rotuloDoPasso = (indice, total) =>
  `Passo ${indice + 1} de ${total}`;

/* ---------- Convite da primeira visita ---------- */

/** As chaves de tour já oferecidas, a partir do que estava guardado. */
export function convitesFeitos(bruto) {
  return Array.isArray(bruto)
    ? [...new Set(bruto.filter((c) => typeof c === "string" && c))]
    : [];
}

/** Convida para o tour desta tela? Só uma vez por tela ou aba, e nunca durante outro tour. */
export function deveConvidar({ chave, feitos = [], ocupado = false }) {
  return Boolean(chave) && !ocupado && !feitos.includes(chave);
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

/* ---------- O holofote: recorte e véu do mesmo retângulo ---------- */

/** A folga em volta do elemento destacado, em pixels. */
export const MARGEM_DO_HOLOFOTE = 6;

/*
  `retangulo`: o getBoundingClientRect do elemento da vez. Devolve o recorte
  (onde fica a moldura) e as quatro faixas escuras em volta dele, todos do
  MESMO retângulo arredondado, para a moldura nunca ficar maior ou menor que
  a área clara. Faixa: { top, left, width?, height?, right?, bottom? }.
*/
export function geometriaDoHolofote(retangulo, margem = MARGEM_DO_HOLOFOTE) {
  if (!retangulo) return null;
  // Não passa da borda de cima nem da esquerda: a moldura fica na tela.
  const top = Math.max(0, Math.round(retangulo.top - margem));
  const left = Math.max(0, Math.round(retangulo.left - margem));
  const right = Math.round(retangulo.left + retangulo.width + margem);
  const bottom = Math.round(retangulo.top + retangulo.height + margem);
  const recorte = { top, left, width: right - left, height: bottom - top };
  return {
    recorte,
    faixas: [
      { top: 0, left: 0, right: 0, height: top },
      { top: bottom, left: 0, right: 0, bottom: 0 },
      { top, left: 0, width: left, height: recorte.height },
      { top, left: right, right: 0, height: recorte.height },
    ],
  };
}
