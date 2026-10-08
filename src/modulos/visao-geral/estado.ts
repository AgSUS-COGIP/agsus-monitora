import type {
  Acompanhamento,
  Armazenamento,
  Atalho,
  BuscaDoAcompanhamento,
  CampoDoFiltro,
  ClienteDoAcompanhamento,
  EstadoDaVisaoGeral,
  EstadoProprio,
  FiltrosDaVisaoGeral,
  LinhaDaVisaoGeral,
  LinhaDoMonitoramento,
  OpcoesDoEstado,
  SnapshotDaVisaoGeral,
} from "./tipos.ts";
/*
  Estado da Visão geral (`#page-dashboard`), fora do React: o recorte (cinco
  filtros, a busca, o DSEI aberto no mapa e o atalho — Críticos ou uma
  pendência do Pós-resultado), a ordenação e as colunas da tabela. Os
  componentes leem com `useSyncExternalStore`; o legado também importa este
  arquivo (ele não importa React).

  As linhas são as que o legado carrega e publica em
  `dados-do-monitoramento.ts` (loadData), recortadas pela área atual e
  enriquecidas (`enriquecerLinhas`: fase, motivos de atenção, pendências
  pós-resultado). O único pedido ao banco daqui é o acompanhamento da área
  (`listar_acompanhamento_da_visao_geral`: etapas do cronograma e resumo das
  listas de aprovados), a cada carga das linhas ou troca de área, pela função
  que a tela entrega (`definirBuscaDoAcompanhamento`). Sem ele (erro, banco
  sem a função), a página funciona só com as linhas.

  O mapa da Saúde Indígena (src/modulos/mapa-saude-indigena/) lê daqui: as
  linhas recortadas (`filtradas`), `temRecorte`, o DSEI aberto (`dsei`) e
  os dados do mapa (`mapa.lmap`, `mapa.redeCnes`), que o legado carrega
  (`loadMapaConfig`, com a cópia da sessão) e publica em
  `definirDadosDoMapa`. O DSEI de cada linha é `chaveDoDsei(linha.unidade)`.
  O mapa pede `definirDsei` (bolha, ranking), `tirarDsei` ("Voltar
  ao Brasil" ou Esc) e `definirBusca` (CASAI nacional).

  Guardado no navegador, como antes: os filtros (`agsus_monitora_filters_v1`)
  e as colunas visíveis da tabela (`agsus_visible_cols_v1`).
*/
import {
  assinarDadosDoMonitoramento,
  linhasDaArea,
  obterDadosDoMonitoramento,
} from "../../componentes/dados-do-monitoramento.ts";
import { hojeEmBrasilia } from "../../lib/cronograma-do-edital.js";
import { semTreinamento } from "../../lib/edital-de-treinamento.js";
import { chaveDoDsei } from "../../lib/mapa-saude-indigena/chaves.ts";
import {
  acompanhamentoDaResposta,
  CAMPOS,
  linhasDaResposta,
  alternarColuna,
  camposAtivos,
  csvDaVisaoGeral,
  enriquecerLinhas,
  filtrosVazios,
  indicadoresDaVisaoGeral,
  nomeDoCsv,
  normalizarColunas,
  normalizarFiltros,
  opcoesDosFiltros,
  podarFiltros,
  proximaOrdenacao,
  recortar,
  rotuloDoAtalho,
} from "../../lib/visao-geral.ts";

export const CHAVE_DOS_FILTROS = "agsus_monitora_filters_v1";
export const CHAVE_DAS_COLUNAS = "agsus_visible_cols_v1";
/** Etapas do cronograma e resumo das listas de aprovados da área. */
export const RPC_ACOMPANHAMENTO = "listar_acompanhamento_da_visao_geral";

const txt = (valor: unknown) => String(valor ?? "").trim();

/** A busca do acompanhamento pelo cliente Supabase da tela. */
export function buscarAcompanhamentoNoSupabase(
  supabase: ClienteDoAcompanhamento,
) {
  return async (area: string) => {
    const { data, error } = await supabase.rpc(RPC_ACOMPANHAMENTO, {
      p_area: area,
    });
    if (error) throw error;
    return data;
  };
}

function lerGuardado(
  armazenamento: Armazenamento | null,
  chave: string,
): unknown {
  try {
    const bruto = armazenamento?.getItem(chave);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

function guardar(
  armazenamento: Armazenamento | null,
  chave: string,
  valor: unknown,
) {
  try {
    armazenamento?.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento (janela privada): vale só nesta visita.
  }
}

function baixarNoNavegador(conteudo: string, nome: string) {
  const arquivo = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(arquivo);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const mesmaLista = (a: readonly string[] = [], b: readonly string[] = []) =>
  a.length === b.length && a.every((valor, i) => valor === b[i]);
const mesmosFiltros = (a: FiltrosDaVisaoGeral, b: FiltrosDaVisaoGeral) =>
  CAMPOS.every((campo) => mesmaLista(a[campo], b[campo]));

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
}: OpcoesDoEstado = {}): EstadoDaVisaoGeral {
  const ouvintes = new Set<() => void>();
  let aviso = (mensagem: string) => console.info(mensagem);
  let buscarAcompanhamento: BuscaDoAcompanhamento | null = null;

  let proprio: EstadoProprio = {
    filtros: normalizarFiltros(lerGuardado(armazenamento, CHAVE_DOS_FILTROS)),
    busca: "",
    dsei: { chave: "", nome: "" },
    atalho: "",
    mapa: { lmap: null, redeCnes: null },
    ordenacao: { campo: "", direcao: "" },
    colunas: normalizarColunas(lerGuardado(armazenamento, CHAVE_DAS_COLUNAS)),
    /* { area, linhas, dados } — o acompanhamento vale para aquela carga. */
    acompanhamento: null,
    destaque: null,
    carregadoEm: 0,
  };
  let instantaneo: SnapshotDaVisaoGeral;
  let fonte: { linhas: readonly unknown[] | null; area: string } = {
    linhas: null,
    area: "",
  };
  let enriquecidas: {
    chave: {
      linhas: readonly unknown[];
      area: string;
      acompanhamento: Acompanhamento | null;
      dia: string;
    } | null;
    linhas: LinhaDaVisaoGeral[];
  } = { chave: null, linhas: [] };
  let pedido: { linhas: readonly unknown[]; area: string } | null = null;

  const hoje = () => hojeEmBrasilia(new Date(agora()));

  /*
    O acompanhamento vale para a área de que ele foi pedido; numa recarga, o
    anterior fica até o novo chegar.
  */
  function acompanhamentoAtual(area: string) {
    const a = proprio.acompanhamento;
    return a && a.area === area ? a.dados : null;
  }
  const acompanhamentoEmDia = (linhas: readonly unknown[], area: string) =>
    proprio.acompanhamento?.area === area &&
    proprio.acompanhamento?.linhas === linhas;

  /* As linhas da área, enriquecidas uma vez por carga, área, acompanhamento e dia. */
  function linhasEnriquecidas() {
    const { linhas, areaAtual } = dados.obter();
    const acompanhamento = acompanhamentoAtual(areaAtual);
    const dia = hoje();
    const chave = enriquecidas.chave;
    if (
      !chave ||
      chave.linhas !== linhas ||
      chave.area !== areaAtual ||
      chave.acompanhamento !== acompanhamento ||
      chave.dia !== dia
    )
      enriquecidas = {
        chave: { linhas, area: areaAtual, acompanhamento, dia },
        // O edital de treinamento não entra na Visão geral (indicadores, mapas, tabela).
        linhas: enriquecerLinhas(
          semTreinamento(linhasDaArea(linhasDaResposta(linhas), areaAtual)),
          {
            hoje: dia,
            acompanhamento,
          },
        ),
      };
    return { daArea: enriquecidas.linhas, acompanhamento, dia };
  }

  /* O que a tela mostra, calculado uma vez por mudança. */
  function calcular() {
    const { areaAtual, carregado } = dados.obter();
    const { daArea, acompanhamento, dia } = linhasEnriquecidas();
    const filtradas = recortar(daArea, {
      filtros: proprio.filtros,
      busca: proprio.busca,
      dsei: proprio.dsei.chave,
      chaveDsei: (linha) => chaveDoDsei(linha?.unidade),
      ordenacao: proprio.ordenacao,
      atalho: proprio.atalho,
    });
    const quantosFiltros = camposAtivos(proprio.filtros);
    const temRecorte = Boolean(
      quantosFiltros ||
      txt(proprio.busca) ||
      proprio.dsei.chave ||
      proprio.atalho,
    );
    instantaneo = {
      ...proprio,
      area: areaAtual,
      carregado,
      hoje: dia,
      linhasDaArea: daArea,
      etapasPorEdital: acompanhamento?.etapasPorEdital || null,
      comListas: Boolean(acompanhamento?.listasPorEdital),
      opcoes: opcoesDosFiltros(daArea, proprio.filtros),
      filtradas,
      temRecorte,
      quantosFiltros,
      criticosAtivo: proprio.atalho === "criticos",
      indicadores: indicadoresDaVisaoGeral(filtradas),
    };
  }

  function avisarOuvintes() {
    calcular();
    for (const ouvinte of ouvintes) ouvinte();
  }

  /* Muda o estado próprio; filtros novos são podados e guardados. */
  function publicar(mudancas: Partial<EstadoProprio>) {
    const anteriores = proprio.filtros;
    proprio = { ...proprio, ...mudancas };
    if (mudancas.filtros) {
      const { carregado } = dados.obter();
      if (carregado)
        proprio.filtros = podarFiltros(
          linhasEnriquecidas().daArea,
          proprio.filtros,
        );
      if (!mesmosFiltros(anteriores, proprio.filtros))
        guardar(armazenamento, CHAVE_DOS_FILTROS, proprio.filtros);
    }
    avisarOuvintes();
  }

  /*
    Pede o acompanhamento da área para esta carga das linhas. Resposta de uma
    carga ou área que já passou é descartada; erro deixa a página só com as
    linhas.
  */
  function pedirAcompanhamento() {
    const { linhas, areaAtual, carregado } = dados.obter();
    if (!buscarAcompanhamento || !carregado || !areaAtual) return;
    if (pedido && pedido.linhas === linhas && pedido.area === areaAtual) return;
    if (acompanhamentoEmDia(linhas, areaAtual)) return;
    const buscar = buscarAcompanhamento;
    const este = { linhas, area: areaAtual };
    pedido = este;
    Promise.resolve()
      .then(() => buscar(areaAtual))
      .then(
        (resposta) => {
          if (pedido !== este) return;
          pedido = null;
          const atual = dados.obter();
          if (atual.linhas !== linhas || atual.areaAtual !== areaAtual) return;
          publicar({
            acompanhamento: {
              area: areaAtual,
              linhas,
              dados: acompanhamentoDaResposta(resposta),
            },
          });
        },
        (erro) => {
          if (pedido === este) pedido = null;
          console.warn(
            "Acompanhamento da Visão geral indisponível; usando só as linhas:",
            erro?.message || erro,
          );
        },
      );
  }

  /*
    Os dados do legado mudaram (carga, recarga ou troca de área). Na troca de
    área o DSEI aberto e o atalho saem (o mapa volta ao Brasil); filtros sem
    opção na área nova são podados — só com os dados já carregados, para não
    apagar os guardados antes da primeira carga.
  */
  function aoMudarDados() {
    const { linhas, areaAtual, carregado } = dados.obter();
    const mudancas: Partial<EstadoProprio> = {};
    if (fonte.linhas !== linhas && carregado) mudancas.carregadoEm = agora();
    if (fonte.area && fonte.area !== areaAtual) {
      mudancas.dsei = { chave: "", nome: "" };
      mudancas.atalho = "";
    }
    fonte = { linhas, area: areaAtual };
    proprio = { ...proprio, ...mudancas };
    if (carregado) {
      const podados = podarFiltros(
        linhasEnriquecidas().daArea,
        proprio.filtros,
      );
      if (podados !== proprio.filtros) {
        proprio = { ...proprio, filtros: podados };
        guardar(armazenamento, CHAVE_DOS_FILTROS, podados);
      }
    }
    avisarOuvintes();
    pedirAcompanhamento();
  }
  dados.assinar(aoMudarDados);
  fonte = { linhas: dados.obter().linhas, area: dados.obter().areaAtual };
  calcular();

  function definirFiltro(campo: CampoDoFiltro, valores: readonly string[]) {
    publicar({
      filtros: {
        ...proprio.filtros,
        [campo]: [...new Set((valores || []).map(txt).filter(Boolean))],
      },
    });
  }

  /*
    Um clique num bloco (fase, projeto): filtra só aquele valor; o mesmo
    clique de novo tira o filtro.
  */
  function alternarFiltroUnico(
    campo: CampoDoFiltro,
    valor: string,
    rotulo: string,
  ) {
    const limpo = txt(valor);
    const atuais = proprio.filtros[campo] || [];
    const tirando = atuais.length === 1 && atuais[0] === limpo;
    definirFiltro(campo, tirando ? [] : [limpo]);
    aviso(tirando ? `${rotulo} removido.` : `${rotulo}: ${limpo}`);
  }

  /*
    O KPI Críticos e as pendências do Pós-resultado: um atalho por vez; o
    mesmo clique de novo tira.
  */
  function alternarAtalho(atalho: Atalho) {
    const tirando = proprio.atalho === atalho;
    publicar({ atalho: tirando ? "" : atalho });
    aviso(
      tirando
        ? "Filtro removido."
        : `Filtro aplicado: ${rotuloDoAtalho(atalho)}.`,
    );
  }

  /*
    "Limpar tudo": zera filtros, busca, atalho e o DSEI (o mapa volta ao
    Brasil). É o único caminho que apaga o recorte.
  */
  function limparTudo() {
    publicar({
      filtros: filtrosVazios(),
      busca: "",
      atalho: "",
      dsei: { chave: "", nome: "" },
    });
    aviso("Filtros limpos.");
  }

  /* O chip do DSEI e o "Voltar ao Brasil" do mapa: sai do território, filtros ficam. */
  function tirarDsei() {
    publicar({ dsei: { chave: "", nome: "" } });
  }

  /*
    Busca global (Ctrl+K): a linha escolhida fica à vista — filtros trocados
    pela unidade e pelo edital dela, sem busca, atalho nem DSEI, e a linha em
    destaque.
  */
  function localizar(linha: LinhaDoMonitoramento | null) {
    if (!linha) return;
    const filtros = filtrosVazios();
    if (txt(linha.unidade)) filtros.unidade = [txt(linha.unidade)];
    if (txt(linha.edital)) filtros.edital = [txt(linha.edital)];
    publicar({
      filtros,
      busca: "",
      atalho: "",
      dsei: { chave: "", nome: "" },
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
    /* A tela entrega a busca do acompanhamento (com o cliente dela). */
    definirBuscaDoAcompanhamento(funcao) {
      buscarAcompanhamento = typeof funcao === "function" ? funcao : null;
      pedido = null;
      pedirAcompanhamento();
    },
    definirFiltro,
    alternarFiltroUnico,
    alternarAtalho,
    alternarCriticos: () => alternarAtalho("criticos"),
    tirarAtalho: () => publicar({ atalho: "" }),
    limparTudo,
    tirarDsei,
    localizar,
    /* "Voltar à linha" (detalhes do processo): rola até ela e destaca. */
    destacar: (id) => publicar({ destaque: { id: String(id), vez: agora() } }),
    definirBusca: (busca) => publicar({ busca: String(busca ?? "") }),
    /* O DSEI aberto no mapa (chave do `lmap` ou nome; guarda a chave normalizada). */
    definirDsei: (chave, nome = "") =>
      publicar({ dsei: { chave: chaveDoDsei(chave), nome: txt(nome) } }),
    /* `lmap` e `rede_cnes` de TB_CONFIG_MAPA_SAUDE_INDIG (o legado carrega). */
    definirDadosDoMapa: ({ lmap = null, redeCnes = null } = {}) =>
      publicar({ mapa: { lmap, redeCnes } }),
    ordenarPor: (campo) =>
      publicar({ ordenacao: proximaOrdenacao(proprio.ordenacao, campo) }),
    alternarColuna(campo, visivel) {
      const colunas = alternarColuna(proprio.colunas, campo, visivel);
      if (colunas === proprio.colunas) return;
      guardar(armazenamento, CHAVE_DAS_COLUNAS, colunas);
      publicar({ colunas });
    },
    exportarCsv() {
      // O recorte da tela; sem recorte, ele já é a área inteira.
      const { filtradas, area } = instantaneo;
      if (!filtradas.length) return;
      baixar(csvDaVisaoGeral(filtradas), nomeDoCsv(area, new Date(agora())));
    },
  };
}

/*
  A instância da página: o legado (carga, busca global, PDF) e o React
  (src/modulos/visao-geral/) falam com ela.
*/
export const estadoDaVisaoGeral = criarEstadoDaVisaoGeral();
