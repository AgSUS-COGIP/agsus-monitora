import { nomeDaArea } from "../lib/menu-lateral.js";
import { SECOES_DA_AYA } from "../lib/aya-paginas.js";

/*
  O contexto fixo da página atual, no prompt da IA.

  A ÁREA ATUAL MANDA NO NOME

  A Visão geral é a mesma página (`dashboard`) nas três áreas. Antes, o perfil
  dela se chamava "Saúde Indígena" e falava de DSEIs/CASAIs mesmo com a área
  SEDE ou Projetos aberta. Agora o nome vem da área atual do app
  (`dados-do-monitoramento.js`, enviada pelo painel da Aya no contexto), e os
  conceitos de DSEI só entram quando a área é a Saúde Indígena.

  Este bloco vem DEPOIS dos fatos fixos no prompt (aya-knowledge.js): mudar
  com a página não quebra o prefixo que o llama.cpp reaproveita.
*/

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const congelar = (perfil) =>
  Object.freeze({
    ...perfil,
    concepts: Object.freeze([...(perfil.concepts || [])]),
    rules: Object.freeze([...(perfil.rules || [])]),
  });

const REGRA_DA_AREA =
  "A página mostra só os registros da área atual escolhida no menu; não misture números de outra área.";

const CONCEITOS_DA_SAUDE_INDIGENA = Object.freeze([
  "DSEI é Distrito Sanitário Especial Indígena e representa uma unidade territorial e de gestão da saúde indígena vinculada à SESAI.",
  "CASAI é estrutura de apoio a pessoas indígenas referenciadas para atendimento no SUS e não deve ser tratada como sinônimo de DSEI.",
  "O mapa representa o recorte territorial do MONITORA; trocar Mapa/Satélite muda apenas a camada cartográfica, não os dados do recorte.",
  "DSEI e Terra Indígena são conceitos distintos e seus limites não devem ser tratados como equivalentes.",
]);

const PAGE_CONTEXTS = Object.freeze({
  dashboard: congelar({
    name: "Visão geral",
    purpose:
      "Acompanhar os processos seletivos da área atual: indicadores, filtros, resumo por etapa, status operacional, processos que pedem atenção e a tabela de processos.",
    concepts: [
      "Os indicadores contam os editais do recorte (filtros e busca da página).",
    ],
    rules: [
      REGRA_DA_AREA,
      "Priorize os números, filtros e territórios que estiverem visíveis na tela atual.",
      "Se houver filtros ativos, qualquer contagem ou comparação deve ser descrita como pertencente ao recorte filtrado.",
      "Não deduza vagas, população, ocupação ou situação quando o valor não estiver no contexto recebido.",
    ],
  }),
  nucleo: congelar({
    name: "Editais",
    purpose:
      "Cadastrar e acompanhar os editais da área atual, com cronograma, etapas, status, anexos e quadro de vagas.",
    concepts: [
      "Edital identifica o processo seletivo e deve ser distinguido de etapa, status e cronograma.",
      "Status e etapa do edital são calculados pelas datas do cronograma, salvo status excepcional com motivo.",
    ],
    rules: [
      REGRA_DA_AREA,
      "Não invente prazo, resultado, convocação, candidato ou situação de processo que não esteja carregado.",
      "Quando orientar uma ação, descreva o caminho na interface sem afirmar que a ação já foi executada.",
    ],
  }),
  calendario: congelar({
    name: "Cronograma",
    purpose:
      "Ver no calendário as etapas dos cronogramas dos editais da área atual.",
    concepts: [
      "As datas vêm do cronograma de cada edital, cadastrado em Editais.",
    ],
    rules: [
      REGRA_DA_AREA,
      "Não afirme datas que não estejam carregadas na tela.",
    ],
  }),
  analises: congelar({
    name: "Análises curriculares",
    purpose:
      "Acompanhar a análise curricular dos candidatos da área atual, vinda das planilhas de análise sincronizadas no banco.",
    concepts: [
      "Indicadores e gráficos devem ser interpretados dentro do escopo (Ativo, Inativo ou Todos) e dos filtros ativos.",
      "Picos e quedas são sinais para investigação, sem causa inventada.",
    ],
    rules: [
      REGRA_DA_AREA,
      "Não faça julgamento sobre pessoas ou desempenho individual sem dados explícitos.",
      "Se a pergunta pedir um registro não carregado, informe que ele não está no contexto atual.",
    ],
  }),
  recursos: congelar({
    name: "Recursos",
    purpose:
      "Registrar e acompanhar os recursos dos candidatos da área atual até a decisão com parecer jurídico e a resposta enviada.",
    concepts: [
      "Quem decide o recurso (deferir, deferir parcialmente ou indeferir) é quem tem a permissão Parecer jurídico.",
    ],
    rules: [
      REGRA_DA_AREA,
      "Não afirme a decisão de um recurso que não esteja carregada na tela.",
    ],
  }),
  entrevistas: congelar({
    name: "Entrevistas",
    purpose:
      "Ver os resultados das entrevistas, conduzir as entrevistas dos editais na janela do cronograma e manter os roteiros, na área atual.",
    concepts: [
      "Conduzir entrevistas mostra só os editais na janela das etapas de entrevista do cronograma, liberados pelo administrador global ou com convocado sem parecer.",
    ],
    rules: [
      REGRA_DA_AREA,
      "Não invente nota, comparecimento ou resultado de candidato.",
    ],
  }),
  approved: congelar({
    name: "Lista de aprovados",
    purpose:
      "Gerenciar a lista de aprovados de cada edital da área atual: status dos candidatos, convocação e anexos.",
    concepts: [
      "Listas inativas continuam consultáveis, mas seus candidatos não podem ser alterados.",
    ],
    rules: [REGRA_DA_AREA, "Não invente candidato, classificação ou status."],
  }),
  selecao: congelar({
    name: "Seleção",
    purpose:
      "Ver o funil de cada vaga da área atual, da inscrição à contratação, a partir da planilha Auditoria carregada todo dia.",
    concepts: [
      "A tela de Seleção é só de consulta; a taxa de contratação é contratados dividido por aprovados.",
    ],
    rules: [REGRA_DA_AREA, "Use só os números visíveis no recorte."],
  }),
  config: congelar({
    name: "Configurações",
    purpose:
      "Orientar o uso das configurações administrativas disponíveis ao perfil atual.",
    concepts: [
      "O que aparece nesta área depende das permissões do usuário autenticado.",
      "A Aya pode explicar o efeito de uma configuração, mas não deve assumir que o usuário possui uma permissão que não esteja comprovada na interface.",
    ],
    rules: [
      "Não afirme que uma alteração foi salva, aplicada ou publicada sem uma confirmação real do sistema.",
      "Não exponha credenciais, tokens, chaves, segredos ou dados de autenticação presentes em mensagens ou contexto.",
      "Para ações destrutivas ou de permissão, explique o impacto e mantenha a confirmação sob controle do usuário.",
    ],
  }),
  generic: congelar({
    name: "MONITORA",
    purpose:
      "Explicar a seção atual do MONITORA usando apenas o contexto autorizado e os elementos realmente carregados na tela.",
    concepts: [
      "A seção, o título e o estado visível da interface definem o contexto principal da conversa.",
    ],
    rules: [
      "Não invente a função de um controle ou dado que não esteja identificado no contexto.",
      "Quando a página não tiver um perfil específico, descreva apenas o que estiver visível ou explicitamente informado.",
    ],
  }),
});

/** O nome da área (código de TB_AREA) para a Aya: "Saúde Indígena", "SEDE", "Projetos" ou "". */
export function nomeDaAreaDaAya(area) {
  return nomeDaArea(String(area || "").trim());
}

/** O nome da seção de Configurações (id de config-secoes.js) ou "". */
export function nomeDaSecaoDaAya(secao) {
  return SECOES_DA_AYA[String(secao || "").trim()]?.nome || "";
}

function perfilBase(sectionKey, titleKey) {
  if (sectionKey !== "generic" && Object.hasOwn(PAGE_CONTEXTS, sectionKey))
    return PAGE_CONTEXTS[sectionKey];
  if (sectionKey.startsWith("panel:analises") || /analise/.test(titleKey))
    return PAGE_CONTEXTS.analises;
  if (/configur/.test(titleKey)) return PAGE_CONTEXTS.config;
  return PAGE_CONTEXTS.generic;
}

export function ayaPageContextFor(section = "", title = "", opcoes = {}) {
  const base = perfilBase(normalize(section), normalize(title));
  if (base === PAGE_CONTEXTS.generic) return base;
  if (base === PAGE_CONTEXTS.config) {
    const secao = nomeDaSecaoDaAya(opcoes.secao);
    return secao
      ? congelar({ ...base, name: `Configurações › ${secao}` })
      : base;
  }
  const area = String(opcoes.area || "").trim();
  const nomeDaAreaAtual = nomeDaAreaDaAya(area);
  if (!nomeDaAreaAtual) return base;
  const conceitos =
    base === PAGE_CONTEXTS.dashboard && area === "saude-indigena"
      ? [...base.concepts, ...CONCEITOS_DA_SAUDE_INDIGENA]
      : base.concepts;
  return congelar({
    ...base,
    name: `${base.name} · ${nomeDaAreaAtual}`,
    concepts: conceitos,
  });
}

export function formatAyaPageContext(section = "", title = "", opcoes = {}) {
  const profile = ayaPageContextFor(section, title, opcoes);
  const concepts = profile.concepts.map((item) => `- ${item}`).join("\n");
  const rules = profile.rules.map((item) => `- ${item}`).join("\n");

  return `PÁGINA ATUAL: ${profile.name}\nFinalidade: ${profile.purpose}\nConceitos desta página:\n${concepts}\nRegras específicas desta página:\n${rules}`;
}
