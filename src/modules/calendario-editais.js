/*
  Calendário de Editais — leitura, em calendário, dos cronogramas que a Equipe
  Núcleo cadastra.

  Esta tela não escreve nada. Ela apenas reorganiza, por data, as etapas que já
  existem em `nucleo-cronograma.js`. Quem edita continua a ser a Equipe Núcleo.

  POR QUE O MÊS MOSTRA CONTAGENS E NÃO OS NOMES DAS ETAPAS.
  São perto de 800 etapas em cerca de uma centena de editais — umas doze por dia.
  A primeira versão escrevia o nome de cada uma dentro da célula do dia; o mês
  virava uma parede de cartões cortados a meio, e as etapas isoladas, que são as
  que alguém procura, desapareciam no meio das longas. Agora a célula mostra
  quantas etapas de cada tipo caem naquele dia, e o detalhe abre ao clicar. O mês
  passa a responder "onde é que há movimento" — que é o que uma vista de mês faz
  bem — e o painel de baixo responde "o que é, exatamente".

  Uma etapa com intervalo conta no dia em que COMEÇA e no dia em que TERMINA, não
  nos dias pelo meio. Um recurso de três semanas contado nos vinte e um dias
  empurrava para cima a contagem de todos eles e escondia o que era pontual.

  CUSTO DE REDE — ler antes de mexer no carregamento.
  Não existe RPC que devolva as etapas de todos os editais de uma vez. O que há:

    get_nucleo_cronograma_resumo()                   → 1 linha por edital, sem etapas
    get_monitoramento_cronograma(p_monitoramento_id) → etapas de UM edital

  Então montar o calendário custa 1 + N chamadas. É o motivo de existirem aqui o
  limite de concorrência e o cache por TTL — sem eles a tela dispara uma rajada
  de pedidos a cada abertura. Se o número de editais crescer muito, a correção
  certa não é mexer nestes números: é criar um RPC que devolva tudo achatado e
  trocar `carregarEtapas` por uma chamada só. O resto do ficheiro não precisa de
  saber de onde vieram as etapas.
*/

import { getSupabaseClient } from "../lib/supabaseClient.js";
import { exigirSessao } from "../lib/sessao.js";
import {
  SITUACAO_ETAPA,
  TIPOS_DE_ETAPA,
  TIPO_OUTROS,
  classificarEtapa,
  dataLocal,
  normalizarTexto,
  etapaConcluida,
  situacaoDaEtapa,
} from "../lib/etapas-de-edital.js";

const RPC_RESUMO = "get_nucleo_cronograma_resumo";
const RPC_CRONOGRAMA = "get_monitoramento_cronograma";

/** Pedidos simultâneos ao Supabase. Acima disto o navegador enfileira à toa. */
const CONCORRENCIA = 6;
/** Enquanto fresco, reabrir a tela não repete as N chamadas. */
const CACHE_TTL_MS = 60_000;
/** Etapas listadas no painel quando nenhum dia está escolhido. */
const PROXIMAS_NO_PAINEL = 8;

const escMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};
const esc = (valor) =>
  String(valor ?? "").replace(/[&<>"']/g, (char) => escMap[char]);
const attr = (valor) => esc(valor).replaceAll("`", "&#096;");
const txt = (valor) => String(valor ?? "").trim();
const $ = (id) => document.getElementById(id);

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_EXTENSO = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const chaveDoDia = (data) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
    data.getDate(),
  ).padStart(2, "0")}`;

/**
 * Roda `tarefa` sobre `itens` com no máximo `limite` em voo ao mesmo tempo.
 * Uma falha isolada não derruba o resto — devolve `null` naquela posição.
 */
async function comLimite(itens, limite, tarefa) {
  const resultados = new Array(itens.length);
  let proximo = 0;
  async function trabalhador() {
    while (proximo < itens.length) {
      const indice = proximo++;
      try {
        resultados[indice] = await tarefa(itens[indice], indice);
      } catch {
        resultados[indice] = null;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limite, itens.length) }, trabalhador),
  );
  return resultados;
}

function formatarCurto(data) {
  return data
    ? `${String(data.getDate()).padStart(2, "0")}/${String(
        data.getMonth() + 1,
      ).padStart(2, "0")}`
    : "-";
}

export function createCalendarioEditaisController(opcoes = {}) {
  const sb = opcoes.supabase || getSupabaseClient();
  const toast = opcoes.toast || ((mensagem) => console.info(mensagem));
  const loader = opcoes.loader || (() => {});
  const agora = opcoes.now || (() => new Date());

  const state = {
    etapas: [],
    editais: [],
    carregadoEm: 0,
    carregando: false,
    erro: "",
    /** Primeiro dia do mês mostrado na grade. */
    mes: (() => {
      const hoje = agora();
      return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    })(),
    /** Chave `YYYY-MM-DD` do dia aberto no popup, ou "" quando está fechado. */
    diaSelecionado: "",
    editalSelecionado: "",
    /*
      Concluídas escondidas à partida. São a maior fatia das ~800 etapas e o que
      já passou raramente é o que se vem ver. Continua a um clique de distância,
      pela caixa na barra de filtros — não é uma regra, é um padrão.
    */
    ocultarConcluidas: true,
    filtros: { unidade: "", edital: "", tipo: "", busca: "" },
  };

  /*
    Texto pesquisável de uma etapa, já sem acentos. Guardado na própria etapa no
    momento do carregamento: com ~800 etapas e a busca a correr a cada tecla,
    normalizar três campos por etapa em cada filtragem era trabalho repetido à
    toa.
  */
  function textoDeBusca(etapa) {
    return normalizarTexto(
      `${etapa.atividade} ${etapa.edital} ${etapa.unidade}`,
    );
  }

  // ── Dados ──────────────────────────────────────────────────────────────

  async function carregarEtapas(forcar = false) {
    const fresco = Date.now() - state.carregadoEm < CACHE_TTL_MS;
    if (!forcar && fresco && state.etapas.length) return;
    if (state.carregando) return;
    if (!sb) {
      state.erro = "Supabase indisponível.";
      return;
    }

    state.carregando = true;
    state.erro = "";
    try {
      await exigirSessao(sb);
      const { data, error } = await sb.rpc(RPC_RESUMO);
      if (error) throw error;

      const editais = (Array.isArray(data) ? data : []).filter(
        (linha) => Number(linha?.cronograma_total || 0) > 0,
      );

      const blocos = await comLimite(editais, CONCORRENCIA, async (edital) => {
        const resposta = await sb.rpc(RPC_CRONOGRAMA, {
          p_monitoramento_id: edital.id,
        });
        if (resposta.error) throw resposta.error;
        return Array.isArray(resposta.data?.etapas) ? resposta.data.etapas : [];
      });

      const falhas = blocos.filter((bloco) => bloco === null).length;
      const etapas = [];
      editais.forEach((edital, indice) => {
        for (const etapa of blocos[indice] || []) {
          // `slice(0, 10)` protege o caso de a coluna vir como timestamp: sem
          // isto a data ficaria "2026-09-29T00:00:00" e as comparações de dia,
          // que são por texto, deixariam de casar.
          const inicioTexto = txt(etapa?.data_inicio).slice(0, 10);
          if (!dataLocal(inicioTexto)) continue; // sem data não cabe num calendário
          etapas.push({
            editalId: String(edital.id),
            unidade: txt(edital.unidade) || "Unidade não informada",
            edital: txt(edital.edital) || "Edital sem número",
            atividade: txt(etapa.atividade) || "Etapa sem nome",
            data_inicio: inicioTexto,
            data_fim: txt(etapa.data_fim).slice(0, 10) || inicioTexto,
            ordem: Number(etapa.ordem || 0),
            tipo: classificarEtapa(etapa.atividade),
            busca: "", // preenchido a seguir, já com todos os campos prontos
          });
          const criada = etapas[etapas.length - 1];
          criada.busca = textoDeBusca(criada);
        }
      });

      etapas.sort(
        (a, b) =>
          a.data_inicio.localeCompare(b.data_inicio) || a.ordem - b.ordem,
      );
      state.etapas = etapas;
      state.editais = editais.map((edital) => ({
        id: String(edital.id),
        unidade: txt(edital.unidade) || "Unidade não informada",
        edital: txt(edital.edital) || "Edital sem número",
      }));
      state.carregadoEm = Date.now();

      if (falhas)
        toast(
          `${falhas} edital(is) não puderam ser lidos. O calendário está incompleto.`,
          "warn",
        );
    } catch (erro) {
      state.erro = erro?.message || "Não foi possível carregar os cronogramas.";
    } finally {
      state.carregando = false;
    }
  }

  // ── Filtros ────────────────────────────────────────────────────────────

  function etapasFiltradas() {
    const { unidade, edital, tipo, busca } = state.filtros;
    const hoje = agora();
    // Cada palavra tem de aparecer, em qualquer ordem: "entrevista manaus" acha
    // o que "manaus entrevista" acha.
    const termos = normalizarTexto(busca).split(/\s+/).filter(Boolean);
    return state.etapas.filter((etapa) => {
      if (unidade && etapa.unidade !== unidade) return false;
      if (edital && etapa.editalId !== edital) return false;
      if (tipo && etapa.tipo.id !== tipo) return false;
      if (
        termos.length &&
        !termos.every((termo) => etapa.busca.includes(termo))
      )
        return false;

      if (state.ocultarConcluidas && etapaConcluida(etapa, hoje)) return false;
      return true;
    });
  }

  /*
    Etapas que COMEÇAM ou TERMINAM no dia — não as que apenas o atravessam.
    `marco` fica vazio quando a etapa dura um dia só, que é começo e fim.
  */
  function etapasDoDia(etapas, chave) {
    const doDia = [];
    for (const etapa of etapas) {
      const comeca = etapa.data_inicio === chave;
      const termina = etapa.data_fim === chave;
      if (!comeca && !termina) continue;
      doDia.push({
        etapa,
        marco: comeca && termina ? "" : comeca ? "início" : "fim",
      });
    }
    return doDia;
  }

  /** Editais que ainda têm alguma etapa depois dos filtros, na ordem original. */
  function editaisDoFiltro() {
    const comEtapa = new Set(etapasFiltradas().map((etapa) => etapa.editalId));
    return state.editais.filter((edital) => comEtapa.has(edital.id));
  }

  /** Dias que o intervalo cobre, contando as duas pontas. */
  function duracaoEmDias(etapa) {
    const inicio = dataLocal(etapa.data_inicio);
    const fim = dataLocal(etapa.data_fim);
    if (!inicio || !fim) return 1;
    return Math.round((fim - inicio) / 86400000) + 1;
  }

  function periodoDaEtapa(etapa) {
    const inicio = dataLocal(etapa.data_inicio);
    if (etapa.data_inicio === etapa.data_fim) return formatarCurto(inicio);
    const fim = dataLocal(etapa.data_fim);
    return `${formatarCurto(inicio)} a ${formatarCurto(fim)} (${duracaoEmDias(
      etapa,
    )} dias)`;
  }

  // ── Render: grade do mês ───────────────────────────────────────────────

  function renderGrade(etapas) {
    const alvo = $("calGrade");
    if (!alvo) return;
    const primeiro = state.mes;
    const hojeChave = chaveDoDia(agora());

    // A grade começa no domingo da semana do dia 1 e tem sempre 6 linhas, para
    // a altura não saltar quando se muda de mês.
    const inicio = new Date(primeiro);
    inicio.setDate(1 - primeiro.getDay());

    const celulas = [];
    for (let i = 0; i < 42; i += 1) {
      const dia = new Date(inicio);
      dia.setDate(inicio.getDate() + i);
      const chave = chaveDoDia(dia);
      const doMes = dia.getMonth() === primeiro.getMonth();
      const doDia = etapasDoDia(etapas, chave);

      // Uma bolinha por tipo presente, com o total. É o que substitui a lista
      // de nomes: mostra a natureza e o volume do dia numa linha.
      const porTipo = new Map();
      for (const { etapa } of doDia) {
        const atual = porTipo.get(etapa.tipo.id);
        if (atual) atual.total += 1;
        else porTipo.set(etapa.tipo.id, { tipo: etapa.tipo, total: 1 });
      }
      const pontos = [...porTipo.values()]
        .sort((a, b) => b.total - a.total)
        .map(
          ({ tipo, total }) =>
            `<span class="cal-ponto" data-cor="${attr(tipo.cor)}" title="${attr(
              `${tipo.rotulo}: ${total}`,
            )}"><i aria-hidden="true"></i>${total}</span>`,
        )
        .join("");

      const classes = ["cal-celula"];
      if (!doMes) classes.push("fora-do-mes");
      if (chave === hojeChave) classes.push("hoje");
      if (chave === state.diaSelecionado) classes.push("selecionado");
      if (!doDia.length) classes.push("vazio");

      celulas.push(`
        <button type="button" class="${classes.join(" ")}" data-dia="${attr(chave)}"
                aria-label="${attr(
                  `${dia.getDate()} de ${MESES[dia.getMonth()]}: ${
                    doDia.length
                  } etapa(s)`,
                )}"${chave === state.diaSelecionado ? ' aria-current="true"' : ""}>
          <span class="cal-numero">${dia.getDate()}</span>
          <span class="cal-pontos">${pontos}</span>
        </button>`);
    }

    alvo.innerHTML = `
      <div class="cal-semana">${DIAS_SEMANA.map(
        (dia) => `<span>${dia}</span>`,
      ).join("")}</div>
      <div class="cal-dias">${celulas.join("")}</div>`;

    const titulo = $("calMesTitulo");
    if (titulo)
      titulo.textContent = `${MESES[primeiro.getMonth()]} ${primeiro.getFullYear()}`;
  }

  // ── Render: painel de detalhe ──────────────────────────────────────────

  function linhaDeEtapa({ etapa, marco }, mostrarData) {
    const inicio = dataLocal(etapa.data_inicio);
    return `
      <button type="button" class="cal-item" data-edital-id="${attr(etapa.editalId)}"
              data-cor="${attr(etapa.tipo.cor)}">
        ${
          mostrarData
            ? `<span class="cal-item-data">${esc(formatarCurto(inicio))}</span>`
            : ""
        }
        <span class="cal-item-corpo">
          <strong>${
            /*
              A marca vem ANTES do nome, não depois. O nome é truncado com
              reticências quando é longo — e os nomes reais são longos ("Prazo de
              recurso referente ao resultado preliminar da Avaliação Documental e
              de Títulos"). Depois do nome, a marca era a primeira coisa a
              desaparecer, justamente nas linhas em que ela mais importa.
            */
            marco
              ? `<span class="cal-marco" data-marco="${attr(marco)}">${esc(marco)}</span>`
              : ""
          }${esc(etapa.atividade)}</strong>
          <small>Ed. ${esc(etapa.edital)} • ${esc(etapa.unidade)} • ${esc(
            periodoDaEtapa(etapa),
          )}</small>
        </span>
      </button>`;
  }

  /* Painel fixo do rodapé: o que vem a seguir, independente do dia aberto. */
  function renderProximas(etapas) {
    const alvo = $("calProximas");
    if (!alvo) return;
    const hoje = agora();
    const proximas = etapas
      .filter((etapa) => etapa.data_fim >= chaveDoDia(hoje))
      .slice(0, PROXIMAS_NO_PAINEL);
    alvo.innerHTML = proximas.length
      ? proximas
          .map((etapa) => linhaDeEtapa({ etapa, marco: "" }, true))
          .join("")
      : `<p class="cal-vazio">Nenhuma etapa em aberto para os filtros atuais.</p>`;
  }

  /*
    Detalhe do dia em popup. Fica sobre o calendário em vez de empurrar a página
    para baixo: quem clica num dia quer ler aquelas etapas e voltar, não perder
    a grade de vista nem rolar até ao rodapé.
  */
  function abrirDia(chave) {
    const modal = $("calDiaModal");
    const titulo = $("calDiaTitulo");
    const lista = $("calDiaLista");
    if (!modal || !titulo || !lista) return;

    const hoje = agora();
    const data = dataLocal(chave);
    const doDia = etapasDoDia(etapasFiltradas(), chave);
    titulo.textContent = `${DIAS_EXTENSO[data.getDay()]}, ${data.getDate()} de ${MESES[
      data.getMonth()
    ].toLowerCase()} — ${doDia.length} etapa${doDia.length === 1 ? "" : "s"}`;
    lista.innerHTML = doDia.length
      ? doDia.map((item) => linhaDeEtapa(item, false)).join("")
      : `<p class="cal-vazio">Nenhuma etapa começa ou termina neste dia.</p>`;

    modal.classList.add("show");
    $("calDiaFechar")?.focus();
  }

  function fecharDia() {
    $("calDiaModal")?.classList.remove("show");
    state.diaSelecionado = "";
    // Só a grade precisa de repintar: é lá que a célula deixa de estar marcada.
    renderGrade(etapasFiltradas());
  }

  // ── Render: linha do tempo e apoio ─────────────────────────────────────

  function renderTimeline() {
    const alvo = $("calTimeline");
    if (!alvo) return;
    const id = state.editalSelecionado;
    if (!id) {
      alvo.innerHTML = `<li class="cal-vazio">Selecione um edital, ou clique numa etapa do calendário.</li>`;
      return;
    }
    const hoje = agora();
    const etapas = state.etapas
      .filter((etapa) => etapa.editalId === id)
      .sort(
        (a, b) =>
          a.data_inicio.localeCompare(b.data_inicio) || a.ordem - b.ordem,
      );
    if (!etapas.length) {
      alvo.innerHTML = `<li class="cal-vazio">Este edital não tem etapas com data.</li>`;
      return;
    }

    alvo.innerHTML = etapas
      .map((etapa) => {
        const situacao = situacaoDaEtapa(etapa, hoje);
        return `
        <li class="cal-passo" data-situacao="${attr(situacao)}" data-cor="${attr(
          etapa.tipo.cor,
        )}">
          <span class="cal-passo-marca" aria-hidden="true"></span>
          <strong>${esc(etapa.atividade)}</strong>
          <small>${esc(periodoDaEtapa(etapa))}</small>
        </li>`;
      })
      .join("");
  }

  function renderLegenda() {
    const alvo = $("calLegenda");
    if (!alvo) return;
    alvo.innerHTML = [...TIPOS_DE_ETAPA, TIPO_OUTROS]
      .map(
        (tipo) =>
          `<span class="cal-legenda-item"><i data-cor="${attr(tipo.cor)}"></i>${esc(
            tipo.rotulo,
          )}</span>`,
      )
      .join("");
  }

  function renderSeletores() {
    const unidades = [...new Set(state.etapas.map((e) => e.unidade))].sort(
      (a, b) => a.localeCompare(b, "pt-BR"),
    );
    preencher(
      "calUnidade",
      "Todas as unidades",
      unidades,
      state.filtros.unidade,
    );
    preencher(
      "calEdital",
      "Todos os editais",
      state.editais.map((e) => [e.id, `${e.edital} — ${e.unidade}`]),
      state.filtros.edital,
    );
    preencher(
      "calTipo",
      "Todos os tipos",
      [...TIPOS_DE_ETAPA, TIPO_OUTROS].map((t) => [t.id, t.rotulo]),
      state.filtros.tipo,
    );
    /*
      O seletor da linha do tempo obedece aos filtros, incluindo a busca. Com
      uma centena de editais, procurar um numa lista solta é o passo mais lento
      da tela; escrever "manaus" na busca deixa lá só os de Manaus. Se o edital
      escolhido sair do filtro, passa ao primeiro que restou — em vez de o
      seletor ficar em branco a apontar para algo que já não está na lista.
    */
    const editaisVisiveis = editaisDoFiltro();
    if (
      editaisVisiveis.length &&
      !editaisVisiveis.some((e) => e.id === state.editalSelecionado)
    )
      state.editalSelecionado = editaisVisiveis[0].id;
    preencher(
      "calTimelineEdital",
      "Selecione um edital",
      editaisVisiveis.map((e) => [e.id, `${e.edital} — ${e.unidade}`]),
      state.editalSelecionado,
    );
    const caixa = $("calOcultarConcluidas");
    if (caixa) caixa.checked = state.ocultarConcluidas;
    // Só escreve se divergir: atribuir durante a digitação mandaria o cursor
    // para o fim do campo a cada tecla.
    const busca = $("calBusca");
    if (busca && busca.value !== state.filtros.busca)
      busca.value = state.filtros.busca;
  }

  function preencher(id, rotuloVazio, itens, selecionado) {
    const campo = $(id);
    if (!campo) return;
    const opcoes = itens.map((item) =>
      Array.isArray(item) ? item : [item, item],
    );
    campo.innerHTML = [
      `<option value="">${esc(rotuloVazio)}</option>`,
      ...opcoes.map(
        ([valor, rotulo]) =>
          `<option value="${attr(valor)}"${
            String(valor) === String(selecionado) ? " selected" : ""
          }>${esc(rotulo)}</option>`,
      ),
    ].join("");
  }

  function pintar() {
    if (state.erro) {
      const alvo = $("calGrade");
      if (alvo)
        alvo.innerHTML = `<div class="alert warn">${esc(state.erro)}</div>`;
      return;
    }
    const etapas = etapasFiltradas();
    renderSeletores();
    renderGrade(etapas);
    renderProximas(etapas);
    renderTimeline();
    renderLegenda();
    // Contagem do mês à vista, não do total filtrado: o número fica ao lado do
    // nome do mês e tem de descrever o que está desenhado por baixo dele.
    const prefixo = `${state.mes.getFullYear()}-${String(
      state.mes.getMonth() + 1,
    ).padStart(2, "0")}`;
    const noMes = etapas.filter(
      (etapa) =>
        etapa.data_inicio.startsWith(prefixo) ||
        etapa.data_fim.startsWith(prefixo),
    ).length;
    const contador = $("calContador");
    if (contador)
      contador.textContent = `${noMes} etapa${noMes === 1 ? "" : "s"} no mês`;
  }

  // ── Eventos ────────────────────────────────────────────────────────────

  function moverMes(passo) {
    state.mes = new Date(
      state.mes.getFullYear(),
      state.mes.getMonth() + passo,
      1,
    );
    // O dia aberto era do mês anterior; deixá-lo aberto confundiria.
    state.diaSelecionado = "";
    pintar();
  }

  function irParaHoje() {
    // Volta ao mês corrente sem abrir o popup: "Hoje" é navegação, não consulta.
    const hoje = agora();
    state.mes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    state.diaSelecionado = "";
    pintar();
  }

  function selecionarDia(chave) {
    state.diaSelecionado = chave;
    renderGrade(etapasFiltradas());
    abrirDia(chave);
  }

  function selecionarEdital(id) {
    state.editalSelecionado = String(id || "");
    const seletor = $("calTimelineEdital");
    if (seletor) seletor.value = state.editalSelecionado;
    renderTimeline();
  }

  let ligado = false;
  function ligarEventos() {
    if (ligado) return;
    const pagina = $("page-calendario");
    if (!pagina) return;
    ligado = true;

    $("calMesAnterior")?.addEventListener("click", () => moverMes(-1));
    $("calMesSeguinte")?.addEventListener("click", () => moverMes(1));
    $("calHoje")?.addEventListener("click", irParaHoje);

    for (const [id, chave] of [
      ["calUnidade", "unidade"],
      ["calEdital", "edital"],
      ["calTipo", "tipo"],
    ]) {
      $(id)?.addEventListener("change", (evento) => {
        state.filtros[chave] = evento.target.value;
        pintar();
      });
    }

    $("calBusca")?.addEventListener("input", (evento) => {
      state.filtros.busca = evento.target.value;
      pintar();
    });

    $("calOcultarConcluidas")?.addEventListener("change", (evento) => {
      state.ocultarConcluidas = evento.target.checked;
      pintar();
    });

    $("calLimparFiltros")?.addEventListener("click", () => {
      state.filtros = { unidade: "", edital: "", tipo: "", busca: "" };
      state.ocultarConcluidas = false;
      pintar();
    });

    $("calTimelineEdital")?.addEventListener("change", (evento) =>
      selecionarEdital(evento.target.value),
    );

    pagina.addEventListener("click", (evento) => {
      const celula = evento.target.closest("[data-dia]");
      if (celula) {
        selecionarDia(celula.dataset.dia);
        return;
      }
      // Clicar numa etapa do painel foca aquele edital na linha do tempo.
      const item = evento.target.closest("[data-edital-id]");
      if (item) selecionarEdital(item.dataset.editalId);
    });

    // O popup vive fora de #page-calendario, logo tem os seus próprios ouvintes.
    const modal = $("calDiaModal");
    $("calDiaFechar")?.addEventListener("click", fecharDia);
    modal?.addEventListener("click", (evento) => {
      // Clique no fundo escuro fecha; clique dentro do cartão, não.
      if (evento.target === modal) {
        fecharDia();
        return;
      }
      const item = evento.target.closest("[data-edital-id]");
      if (item) {
        selecionarEdital(item.dataset.editalId);
        fecharDia();
      }
    });
    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape" && modal?.classList.contains("show"))
        fecharDia();
    });

    // O cronograma mudou noutra tela: o cache aqui ficou velho.
    document.addEventListener("agsus:nucleo-cronograma-saved", () => {
      state.carregadoEm = 0;
    });
  }

  async function render() {
    ligarEventos();
    loader(true);
    try {
      await carregarEtapas();
      if (!state.editalSelecionado && state.editais.length)
        state.editalSelecionado = state.editais[0].id;
      pintar();
    } finally {
      loader(false);
    }
  }

  return { render, recarregar: () => carregarEtapas(true).then(pintar), state };
}
