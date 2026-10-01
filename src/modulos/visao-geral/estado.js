/*
  Estado da Visão geral (`#page-dashboard`), fora do React: o recorte (seis
  filtros, a busca e o DSEI aberto no mapa), a ordenação e as colunas da
  tabela, e o resumo do servidor. Os componentes leem com
  `useSyncExternalStore`; o legado também importa este arquivo (ele não
  importa React).

  As linhas são as que o legado carrega e publica em
  `dados-do-monitoramento.js` (loadData), recortadas pela área atual. Nada é
  pedido ao banco aqui.

  O MAPA CONTINUA NO LEGADO (Etapa 5, parte 2). A conversa com ele:
  - o legado liga o mapa (`ligarMapa`): a chave do DSEI de cada linha
    (`dseiKey`), sair do território e "voltar ao Brasil" ao limpar tudo;
  - o legado empurra o DSEI aberto (`definirDsei`, a cada `applyFilters` do
    mapa) e o termo que um clique numa CASAI procura (`definirBusca`);
  - o legado assina e lê `obter().filtradas` (as bolhas e a lista dos
    territórios) e `obter().temRecorte`.

  Guardado no navegador, como antes: os filtros (`agsus_monitora_filters_v1`)
  e as colunas visíveis da tabela (`agsus_visible_cols_v1`).
*/
import {
  assinarDadosDoMonitoramento,
  linhasDaArea,
  obterDadosDoMonitoramento,
} from "../../componentes/dados-do-monitoramento.js";
import {
  alternarColuna,
  camposAtivos,
  csvDaVisaoGeral,
  filtroDeRiscoCriticoAtivo,
  filtrosVazios,
  indicadoresDaVisaoGeral,
  nomeDoCsv,
  normalizarColunas,
  normalizarFiltros,
  opcoesDosFiltros,
  podarFiltros,
  podeUsarResumoDoServidor,
  proximaOrdenacao,
  recortar,
  riscosCriticos,
  valoresDoStatus,
} from "../../lib/visao-geral.js";

export const CHAVE_DOS_FILTROS = "agsus_monitora_filters_v1";
export const CHAVE_DAS_COLUNAS = "agsus_visible_cols_v1";

const txt = (valor) => String(valor ?? "").trim();

function lerGuardado(armazenamento, chave) {
  try {
    const bruto = armazenamento?.getItem(chave);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

function guardar(armazenamento, chave, valor) {
  try {
    armazenamento?.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento (janela privada): vale só nesta visita.
  }
}

function baixarNoNavegador(conteudo, nome) {
  const arquivo = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(arquivo);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const mesmaLista = (a = [], b = []) =>
  a.length === b.length && a.every((valor, i) => valor === b[i]);
const mesmosFiltros = (a, b) =>
  Object.keys(a).every((campo) => mesmaLista(a[campo], b[campo]));

const armazenamentoPadrao = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export function criarEstadoDaVisaoGeral({
  dados = {
    assinar: assinarDadosDoMonitoramento,
    obter: obterDadosDoMonitoramento,
  },
  armazenamento = armazenamentoPadrao(),
  agora = () => Date.now(),
  baixar = baixarNoNavegador,
} = {}) {
  const ouvintes = new Set();
  let aviso = (mensagem) => console.info(mensagem);
  let mapa = { chaveDsei: null, sairDoTerritorio: null, aoLimpar: null };

  let proprio = {
    filtros: normalizarFiltros(lerGuardado(armazenamento, CHAVE_DOS_FILTROS)),
    busca: "",
    dsei: { chave: "", nome: "" },
    ordenacao: { campo: "", direcao: "" },
    colunas: normalizarColunas(lerGuardado(armazenamento, CHAVE_DAS_COLUNAS)),
    resumo: null,
    destaque: null,
    carregadoEm: 0,
  };
  let instantaneo = null;
  let fonte = { linhas: null, area: "" };

  /* O que a tela mostra, calculado uma vez por mudança. */
  function calcular() {
    const { linhas, areaAtual, carregado } = dados.obter();
    const daArea = linhasDaArea(linhas, areaAtual);
    const filtradas = recortar(daArea, {
      filtros: proprio.filtros,
      busca: proprio.busca,
      dsei: proprio.dsei.chave,
      chaveDsei: mapa.chaveDsei,
      ordenacao: proprio.ordenacao,
    });
    const quantosFiltros = camposAtivos(proprio.filtros);
    const temRecorte = Boolean(
      quantosFiltros || txt(proprio.busca) || proprio.dsei.chave,
    );
    const resumo = podeUsarResumoDoServidor({
      resumo: proprio.resumo,
      temRecorte,
      linhasDaArea: daArea.length,
      totalDeLinhas: (linhas || []).length,
    })
      ? proprio.resumo
      : null;
    instantaneo = {
      ...proprio,
      area: areaAtual,
      carregado,
      linhasDaArea: daArea,
      opcoes: opcoesDosFiltros(daArea, proprio.filtros),
      filtradas,
      temRecorte,
      quantosFiltros,
      riscoCriticoAtivo: filtroDeRiscoCriticoAtivo(proprio.filtros),
      indicadores: indicadoresDaVisaoGeral(filtradas, resumo),
    };
  }

  function avisarOuvintes() {
    calcular();
    for (const ouvinte of ouvintes) ouvinte();
  }

  /* Muda o estado próprio; filtros novos são podados e guardados. */
  function publicar(mudancas) {
    const anteriores = proprio.filtros;
    proprio = { ...proprio, ...mudancas };
    if (mudancas.filtros) {
      const { linhas, areaAtual, carregado } = dados.obter();
      if (carregado)
        proprio.filtros = podarFiltros(
          linhasDaArea(linhas, areaAtual),
          proprio.filtros,
        );
      if (!mesmosFiltros(anteriores, proprio.filtros))
        guardar(armazenamento, CHAVE_DOS_FILTROS, proprio.filtros);
    }
    avisarOuvintes();
  }

  /*
    Os dados do legado mudaram (carga, recarga ou troca de área). Na troca de
    área o DSEI aberto sai (o legado volta o mapa ao Brasil); filtros sem opção
    na área nova são podados — só com os dados já carregados, para não apagar
    os guardados antes da primeira carga.
  */
  function aoMudarDados() {
    const { linhas, areaAtual, carregado } = dados.obter();
    const mudancas = {};
    if (fonte.linhas !== linhas && carregado) mudancas.carregadoEm = agora();
    if (fonte.area && fonte.area !== areaAtual)
      mudancas.dsei = { chave: "", nome: "" };
    fonte = { linhas, area: areaAtual };
    if (carregado) {
      const podados = podarFiltros(
        linhasDaArea(linhas, areaAtual),
        proprio.filtros,
      );
      if (podados !== proprio.filtros) {
        mudancas.filtros = podados;
        guardar(armazenamento, CHAVE_DOS_FILTROS, podados);
      }
    }
    proprio = { ...proprio, ...mudancas };
    avisarOuvintes();
  }
  dados.assinar(aoMudarDados);
  fonte = { linhas: dados.obter().linhas, area: dados.obter().areaAtual };
  calcular();

  const opcoesDe = (campo) => instantaneo.opcoes[campo] || [];

  function definirFiltro(campo, valores) {
    publicar({
      filtros: {
        ...proprio.filtros,
        [campo]: [...new Set((valores || []).map(txt).filter(Boolean))],
      },
    });
  }

  /*
    Um clique num bloco (etapa do resumo, unidade com mais de um processo):
    filtra só aquele valor; o mesmo clique de novo tira o filtro.
  */
  function alternarFiltroUnico(campo, valor, rotulo) {
    const limpo = txt(valor);
    const atuais = proprio.filtros[campo] || [];
    const tirando = atuais.length === 1 && atuais[0] === limpo;
    definirFiltro(campo, tirando ? [] : [limpo]);
    aviso(tirando ? `${rotulo} removido.` : `${rotulo}: ${limpo}`);
  }

  /* A legenda do gráfico: todos os valores de Status daquele status (canônico). */
  function alternarStatus(status) {
    const valores = valoresDoStatus(status, opcoesDe("status"));
    if (!valores.length) return;
    const atuais = proprio.filtros.status || [];
    const tirando = mesmaLista([...atuais].sort(), [...valores].sort());
    definirFiltro("status", tirando ? [] : valores);
    aviso(
      tirando ? "Filtro de status removido." : `Filtro de status: ${status}`,
    );
  }

  /* O KPI Críticos: risco Médio/Alto; de novo, tira. */
  function alternarRiscoCritico() {
    const ativo = filtroDeRiscoCriticoAtivo(proprio.filtros);
    const existentes = riscosCriticos(opcoesDe("risco"));
    if (!ativo && !existentes.length) {
      aviso("Nenhum processo com risco Médio ou Alto no recorte atual.");
      return;
    }
    definirFiltro("risco", ativo ? [] : existentes);
    aviso(
      ativo
        ? "Filtro de risco removido."
        : "Filtro aplicado: risco Médio/Alto.",
    );
  }

  /*
    "Limpar tudo": zera filtros, busca e o DSEI e volta o mapa ao Brasil (o
    legado avisa "Filtros limpos."). É o único caminho que apaga o recorte.
  */
  function limparTudo() {
    publicar({
      filtros: filtrosVazios(),
      busca: "",
      dsei: { chave: "", nome: "" },
    });
    if (mapa.aoLimpar) mapa.aoLimpar();
    else aviso("Filtros limpos.");
  }

  /* O chip do DSEI: sai do território (o mapa volta ao Brasil), filtros ficam. */
  function tirarDsei() {
    if (mapa.sairDoTerritorio) mapa.sairDoTerritorio();
    else publicar({ dsei: { chave: "", nome: "" } });
  }

  /*
    Busca global (Ctrl+K): a linha escolhida fica à vista — filtros trocados
    pela unidade e pelo edital dela, sem busca, e a linha em destaque.
  */
  function localizar(linha) {
    if (!linha) return;
    const filtros = filtrosVazios();
    if (txt(linha.unidade)) filtros.unidade = [txt(linha.unidade)];
    if (txt(linha.edital)) filtros.edital = [txt(linha.edital)];
    publicar({
      filtros,
      busca: "",
      destaque: { id: String(linha.id), vez: agora() },
    });
  }

  return {
    obter: () => instantaneo,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    definirAviso(funcao) {
      if (typeof funcao === "function") aviso = funcao;
    },
    /* O legado liga o mapa uma vez (ver o comentário do topo). */
    ligarMapa(ligacoes = {}) {
      mapa = { ...mapa, ...ligacoes };
      avisarOuvintes();
    },
    definirFiltro,
    alternarFiltroUnico,
    alternarStatus,
    alternarRiscoCritico,
    limparTudo,
    tirarDsei,
    localizar,
    /* "Voltar à linha" (detalhes do processo): rola até ela e destaca. */
    destacar: (id) => publicar({ destaque: { id: String(id), vez: agora() } }),
    definirBusca: (busca) => publicar({ busca: String(busca ?? "") }),
    /* O DSEI aberto no mapa. Sempre avisa: o legado redesenha a partir daqui. */
    definirDsei: (chave, nome = "") =>
      publicar({ dsei: { chave: txt(chave), nome: txt(nome) } }),
    definirResumoDoServidor: (resumo) => publicar({ resumo: resumo || null }),
    ordenarPor: (campo) =>
      publicar({ ordenacao: proximaOrdenacao(proprio.ordenacao, campo) }),
    alternarColuna(campo, visivel) {
      const colunas = alternarColuna(proprio.colunas, campo, visivel);
      if (colunas === proprio.colunas) return;
      guardar(armazenamento, CHAVE_DAS_COLUNAS, colunas);
      publicar({ colunas });
    },
    exportarCsv() {
      const { filtradas, linhasDaArea: daArea, area } = instantaneo;
      baixar(
        csvDaVisaoGeral(filtradas.length ? filtradas : daArea),
        nomeDoCsv(area, new Date(agora())),
      );
    },
  };
}

/*
  A instância da página: o legado (mapa, carga, busca global, PDF) e o React
  (src/modulos/visao-geral/) falam com ela.
*/
export const estadoDaVisaoGeral = criarEstadoDaVisaoGeral();
