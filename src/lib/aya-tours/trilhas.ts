/* Tours da Aya: as trilhas ("Aprender") (API pública em ../aya-tours.ts). */

import {
  canChangeCandidateStatus,
  canEditRecursos,
  canManageAccess,
  paginasPermitidas,
} from "../access-roles.ts";
import { ABA, decideRecursos, passo, t } from "./pedacos.ts";
import type { TrilhaDaAya } from "./tipos.ts";

/* ---------- Trilhas ("Aprender") ---------- */

export const TRILHAS: readonly TrilhaDaAya[] = Object.freeze([
  Object.freeze({
    id: "primeiros-passos",
    titulo: "Primeiros passos",
    resumo: "Áreas, menu, Visão geral e como pedir ajuda.",
    exige: () => true,
    passos: Object.freeze([
      passo(
        null,
        "Boas-vindas ao Yeendé",
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
        [t("barra-abrir-menu"), t("barra-menu"), "#nav"],
        "Menu",
        "Em Acompanhamento ficam as páginas de consulta; em Processo seletivo, onde se trabalha, na ordem das etapas.",
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
    exige: (perfil: unknown) => paginasPermitidas(perfil).nucleo === true,
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
        "4. Painel de recursos",
        "Os recursos dos candidatos, do registro ao parecer jurídico e à resposta; analisar é em Analisar recursos.",
        { pagina: "recursos" },
      ),
      passo(
        t("classificacao-abas"),
        "5. Classificação",
        "A regra de cada edital gera as listas: convocação para entrevista e resultado final.",
        { pagina: "classificacao" },
      ),
      passo(
        [t("entrevistas-kpis"), "#page-entrevistas .entrevistas-kpis"],
        "6. Painel de entrevistas",
        "Acompanhe os indicadores, as pendências e os empates.",
        { pagina: "entrevistas" },
      ),
      passo(
        t("conduzir-visoes"),
        "7. Conduzir entrevistas",
        "Prepare o edital, convoque e lance as notas a partir da fila do dia.",
        { pagina: "conduzir-entrevistas" },
      ),
      passo(
        [t("aprovados-visoes"), "#approvedRows"],
        "8. Lista de aprovados",
        "A lista vigente de cada edital, a convocação, a carta e o status de cada candidato.",
        { pagina: "approved" },
      ),
      passo(
        [t("selecao-kpis"), "#page-selecao .selecao-kpis"],
        "9. Seleção",
        "O funil de cada vaga, de inscritos a contratados, e a taxa de contratação.",
        { pagina: "selecao" },
      ),
    ]),
  }),
  Object.freeze({
    id: "conduzir-entrevista",
    titulo: "Conduzir uma entrevista",
    resumo: "Edital, preparar, fila do dia e ficha de notas.",
    exige: (perfil: unknown) =>
      paginasPermitidas(perfil)["conduzir-entrevistas"] === true,
    passos: Object.freeze([
      passo(
        t("conduzir-visoes"),
        "Conduzir entrevistas",
        "A condução tem entrada própria no menu; o Painel de entrevistas é só para acompanhar.",
        { pagina: "conduzir-entrevistas" },
      ),
      passo(
        [t("entrevistas-conduzir-seletor-edital"), "#entrevistasEdital"],
        "Escolha o edital",
        "Só aparecem editais dentro da janela da entrevista (de 7 dias antes a 15 dias depois) ou liberados.",
        { pagina: "conduzir-entrevistas" },
      ),
      passo(
        t("entrevistas-preparar-passos"),
        "Preparar em passos",
        "Roteiro, banca, convocação e agenda, cada um com o que falta; as regras ficam resumidas logo acima.",
        { pagina: "conduzir-entrevistas", antes: ABA.preparar },
      ),
      passo(
        t("entrevistas-conduzir-convocacao"),
        "Preparar · Convocação",
        "A lista de convocação vem da Classificação, na ordem de cada vaga.",
        { pagina: "conduzir-entrevistas", antes: ABA.convocar },
      ),
      passo(
        t("conduzir-fila"),
        "Fila do dia",
        "Abra um cartão e lance comparecimento e notas; Ctrl+Enter salva.",
        { pagina: "conduzir-entrevistas", antes: ABA.fila },
      ),
      passo(
        null,
        "Resultado",
        "A cada gravação o resultado é recalculado e aparece no Painel de entrevistas. Lançar notas exige nível Editor em Entrevistas.",
        { pagina: "entrevistas" },
      ),
    ]),
  }),
  Object.freeze({
    id: "registrar-recurso",
    titulo: "Registrar e decidir um recurso",
    resumo: "O que faz quem registra e o que o jurídico decide.",
    exige: (perfil: unknown) =>
      canEditRecursos(perfil) || decideRecursos(perfil),
    passos: Object.freeze([
      passo(
        t("recursos-novo"),
        "Registrar",
        "Em Analisar recursos, quem edita Recursos registra o recurso com os dados do candidato e anexa os documentos.",
        { pagina: "analisar-recursos", exige: canEditRecursos },
      ),
      passo(
        [
          t("analisar-recursos-fila"),
          "[aria-labelledby='analiseRecursosFilaTitulo']",
        ],
        "Rascunho e envio",
        "Na fila, abra o recurso, escreva o rascunho da resposta e envie para o parecer jurídico.",
        { pagina: "analisar-recursos", exige: canEditRecursos },
      ),
      passo(
        [t("recursos-kpis"), "#page-recursos .recursos-kpis"],
        "Aguardando parecer",
        "No Painel de recursos, são os enviados ao jurídico e ainda sem decisão. Clicar no indicador filtra a fila.",
        { pagina: "recursos" },
      ),
      passo(
        null,
        "Decisão do jurídico",
        "Em Analisar recursos, quem tem Parecer jurídico defere, defere parcialmente ou indefere, sempre com o texto do parecer, ou devolve para ajuste.",
        { pagina: "analisar-recursos" },
      ),
      passo(
        null,
        "Ajuste da pontuação",
        "Recurso que muda nota tem a proposta de ajuste; aprovada, ela entra na Classificação.",
        { pagina: "analisar-recursos" },
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
        { pagina: "analisar-recursos" },
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
