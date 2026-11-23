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
  que a tela entrega (`definirBuscaDoAcompanhamento`) — só com a página
  aberta (`definirAberta`, da navegação): escondida, não pede nada, e ao
  voltar pede o que ficou para trás. Sem ele (erro, banco sem a função), a
  página funciona só com as linhas.

  A aba Mapa (src/modulos/mapa/) lê daqui as linhas da área (`linhasDaArea`,
  sem os filtros desta página) e o `lmap` do banco (`mapa.lmap`: nome,
  população e UFs de cada DSEI; os pontos vêm do SIGEPSI), que a carga
  (src/app/carga.ts, com a cópia da sessão) publica em `definirDadosDoMapa`;
  a CASAI nacional pede `definirBusca`. O recorte por DSEI saiu com o mapa
  (18/11/2026): para ver um DSEI aqui, o filtro Unidade.

  Guardado no navegador, como antes: os filtros (`agsus_monitora_filters_v1`)
  e as colunas visíveis da tabela (`agsus_visible_cols_v2`).
*/
import { colunasDoPreset } from "../../lib/visao-geral/presets-de-colunas.ts";
import { baixarArquivo } from "../../ui/botoes-de-exportacao.tsx";
import { erroDeVersaoNova } from "../../lib/carga/importar-com-recarga.ts";
import { nomeDaArea } from "../../lib/navegacao/menu-lateral.ts";
import {
  assinarDadosDoMonitoramento,
  linhasDaArea,
  obterDadosDoMonitoramento,
} from "../../componentes/dados-do-monitoramento.ts";
import {
  respostaInalterada,
  versaoDoPacote,
} from "../../lib/carga/versao-do-pacote";
import { hojeEmBrasilia } from "../../lib/cronograma/cronograma-do-edital.ts";
import { semTreinamento } from "../../lib/editais/edital-de-treinamento.ts";
import {
  acompanhamentoDaResposta,
  CAMPOS,
  linhasDaResposta,
  alternarColuna,
  camposAtivos,
  enriquecerLinhas,
  filtrosVazios,
  indicadoresDaVisaoGeral,
  normalizarColunas,
  normalizarFiltros,
  opcoesDosFiltros,
  podarFiltros,
  proximaOrdenacao,
  recortar,
  rotuloDoAtalho,
} from "../../lib/visao-geral/visao-geral.ts";

export const CHAVE_DOS_FILTROS = "agsus_monitora_filters_v1";
/*
  v2 (13/11/2026): as colunas do resultado entraram no padrão, para todos; a
  escolha guardada na v1 não as tinha e foi descartada uma vez.
  v3 (13/11/2026): Ciclo, 1ª admissão e Última admissão, pelo mesmo motivo.
*/
export const CHAVE_DAS_COLUNAS = "agsus_visible_cols_v3";
/** Etapas do cronograma e resumo das listas de aprovados da área. */
export const RPC_ACOMPANHAMENTO =
  "listar_acompanhamento_da_visao_geral_se_mudou";
/** Os editais marcados à mão como críticos (gestor, coordenador, admin global). */
export const RPC_CRITICOS_MANUAIS = "listar_editais_criticos_manuais";
/** Cargos das vagas e quadro de cada edital: as vagas reabertas (src/lib/visao-geral/vagas-reabertas.ts). */
export const RPC_VAGAS_POR_CARGO = "listar_vagas_por_cargo_da_visao_geral";
/** Quanto as vagas esperam o acompanhamento antes de aparecer sem o desconto das reabertas. */
export const ESPERA_MAXIMA_DO_ACOMPANHAMENTO_MS = 10_000;

const txt = (valor: unknown) => String(valor ?? "").trim();

/*
  O último acompanhamento de cada área, com a `versao` do banco. Fica fora da
  tela (ela remonta a cada abertura): a volta pergunta só se mudou e, se não,
  o banco responde `{ inalterado: true }` (migration 20261013160000).
*/
const acompanhamentosConhecidos = new Map<string, unknown>();
/*
  O último pacote entregue por área, já com a marcação manual. Sem mudança no
  acompanhamento nem na marcação, volta o MESMO objeto: a tela não recalcula
  nem redesenha (o que o `inalterado` do banco já garantia antes).
*/
const entreguesPorArea = new Map<
  string,
  { pacote: unknown; marcacao: string; cargos: string; entregue: unknown }
>();

/*
  A pessoa saiu (ou ficou sem acesso): nada da Visão geral dela passa para
  quem entrar depois nesta aba — nem o acompanhamento guardado por área, nem
  o recorte (filtros guardados, busca, atalho, DSEI, destaque).
*/
export function esquecerVisaoGeral(
  estado: EstadoDaVisaoGeral = estadoDaVisaoGeral,
) {
  acompanhamentosConhecidos.clear();
  entreguesPorArea.clear();
  estado.esquecer();
}

/** A busca do acompanhamento pelo cliente Supabase da tela. */
export function buscarAcompanhamentoNoSupabase(
  supabase: ClienteDoAcompanhamento,
) {
  return async (area: string, editais: readonly string[] = []) => {
    const conhecido = acompanhamentosConhecidos.get(area) ?? null;
    const [{ data, error }, criticos, cargos] = await Promise.all([
      supabase.rpc(RPC_ACOMPANHAMENTO, {
        p_area: area,
        p_versao: versaoDoPacote(conhecido),
      }),
      supabase.rpc(RPC_CRITICOS_MANUAIS, { p_area: area }),
      /*
        Os cargos de cada edital, para contar uma vez só a vaga reaberta. Se
        falhar, as vagas ficam como cada edital publicou.
      */
      editais.length
        ? Promise.resolve(
            supabase.rpc(RPC_VAGAS_POR_CARGO, {
              p_area: area,
              p_editais: editais.slice(0, 1000),
            }),
          ).catch(() => null)
        : null,
    ]);
    if (error) throw error;
    let pacote = data;
    if (conhecido && respostaInalterada(data)) pacote = conhecido;
    else acompanhamentosConhecidos.set(area, data);
    /*
      A marcação manual vem de outra leitura, sem versão (é pequena e muda na
      hora em que alguém marca). Se falhar, não presume marcações de crítico;
      o restante do acompanhamento continua disponível.
    */
    const marcados =
      !criticos?.error && Array.isArray(criticos?.data) ? criticos.data : [];
    if (!pacote || typeof pacote !== "object" || Array.isArray(pacote))
      return pacote;
    const vagasPorCargo =
      cargos && !cargos.error && cargos.data ? cargos.data : null;
    const marcacao = JSON.stringify(marcados);
    const assinaturaDosCargos = JSON.stringify(vagasPorCargo);
    const anterior = entreguesPorArea.get(area);
    if (
      anterior?.pacote === pacote &&
      anterior.marcacao === marcacao &&
      anterior.cargos === assinaturaDosCargos
    )
      return anterior.entregue;
    const entregue = {
      ...pacote,
      criticos_manuais: marcados,
      ...(vagasPorCargo ? { vagas_por_cargo: vagasPorCargo } : {}),
    };
    entreguesPorArea.set(area, {
      pacote,
      marcacao,
      cargos: assinaturaDosCargos,
      entregue,
    });
    return entregue;
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
  baixar = baixarArquivo,
  aberta = true,
}: OpcoesDoEstado = {}): EstadoDaVisaoGeral {
  const ouvintes = new Set<() => void>();
  let aviso = (mensagem: string) => console.info(mensagem);
  let buscarAcompanhamento: BuscaDoAcompanhamento | null = null;

  let proprio: EstadoProprio = {
    filtros: normalizarFiltros(lerGuardado(armazenamento, CHAVE_DOS_FILTROS)),
    busca: "",
    atalho: "",
    mapa: { lmap: null },
    ordenacao: { campo: "", direcao: "" },
    colunas: normalizarColunas(lerGuardado(armazenamento, CHAVE_DAS_COLUNAS)),
    /* { area, linhas, dados } — o acompanhamento vale para aquela carga. */
    acompanhamento: null,
    destaque: null,
    carregadoEm: 0,
    aberta,
    visitada: aberta,
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
  /* O pedido desta carga falhou ou passou do tempo: as vagas saem sem o desconto. */
  let semAcompanhamento: { linhas: readonly unknown[]; area: string } | null =
    null;

  const hoje = () => hojeEmBrasilia(new Date(agora()));
  /* A linha de onde a pessoa saiu por um número (`sairPelaLinha`). */
  let linhaDeSaida = "";

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
  /*
    Sem o acompanhamento da área, as vagas imediatas e as ociosas ainda não
    têm o desconto das reabertas: por uns segundos a tela mostrava 2.453 e
    790 e depois trocava para 2.092 e 429 (17/11/2026). Agora espera, até a
    resposta, o erro ou o tempo-limite. Numa recarga, o acompanhamento
    anterior da mesma área vale até o novo chegar, e não há espera.
  */
  function aguardandoVagas(linhas: readonly unknown[], area: string) {
    if (!buscarAcompanhamento || !emUso()) return false;
    if (acompanhamentoAtual(area)) return false;
    return !(
      semAcompanhamento?.linhas === linhas && semAcompanhamento?.area === area
    );
  }

  /*
    Sem o desconto: o pedido desta carga falhou ou passou do tempo, ou a
    resposta veio sem os cargos (o módulo das reabertas não montou a conta).
    A tela diz "sem desconto das reabertas" em vez de um número que parece
    final.
  */
  function semDescontoDasReabertas(linhas: readonly unknown[], area: string) {
    if (!buscarAcompanhamento || !emUso()) return false;
    const atual = acompanhamentoAtual(area);
    if (atual) return typeof atual.reaberturas !== "function";
    return (
      semAcompanhamento?.linhas === linhas && semAcompanhamento?.area === area
    );
  }

  function calcular() {
    const { linhas, areaAtual, carregado, erro = "" } = dados.obter();
    const { daArea, acompanhamento, dia } = linhasEnriquecidas();
    const filtradas = recortar(daArea, {
      filtros: proprio.filtros,
      busca: proprio.busca,
      ordenacao: proprio.ordenacao,
      atalho: proprio.atalho,
    });
    const quantosFiltros = camposAtivos(proprio.filtros);
    const temRecorte = Boolean(
      quantosFiltros || txt(proprio.busca) || proprio.atalho,
    );
    instantaneo = {
      ...proprio,
      area: areaAtual,
      carregado,
      erro,
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
      aguardandoVagas: carregado && aguardandoVagas(linhas, areaAtual),
      semDescontoDasReabertas:
        carregado && semDescontoDasReabertas(linhas, areaAtual),
    };
  }

  /*
    Página fechada (montada escondida) não recalcula a cada carga, filtro ou
    troca de área: fica marcado e o cálculo sai quando alguém lê (`obter`) ou
    quando a página abre (`definirAberta`).
  */
  let pendente = false;
  /*
    O Mapa (aba da Saúde Indígena) desenha as linhas da área daqui, com as
    mesmas contas: aberto, o estado calcula e pede o acompanhamento como se a
    Visão geral estivesse aberta, sem montá-la (`visitada` não muda).
  */
  let lidaPeloMapa = false;
  const emUso = () => proprio.aberta || lidaPeloMapa;
  function avisarOuvintes() {
    if (!emUso()) {
      pendente = true;
      return;
    }
    pendente = false;
    calcular();
    for (const ouvinte of ouvintes) ouvinte();
  }
  function obterInstantaneo() {
    if (pendente) {
      pendente = false;
      calcular();
    }
    return instantaneo;
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
    // Página fechada não pede: ao abrir de novo (`definirAberta`), pede o que ficou para trás.
    if (!emUso()) return;
    if (!buscarAcompanhamento || !carregado || !areaAtual) return;
    if (pedido && pedido.linhas === linhas && pedido.area === areaAtual) return;
    if (acompanhamentoEmDia(linhas, areaAtual)) return;
    const buscar = buscarAcompanhamento;
    const este = { linhas, area: areaAtual };
    pedido = este;
    // Demorou demais: as vagas aparecem sem o desconto (e mudam se ele chegar).
    setTimeout(() => {
      if (pedido !== este) return;
      semAcompanhamento = este;
      avisarOuvintes();
    }, ESPERA_MAXIMA_DO_ACOMPANHAMENTO_MS);
    const editais = linhasEnriquecidas()
      .daArea.map((linha) => txt(linha.id))
      .filter(Boolean);
    Promise.resolve()
      .then(() => buscar(areaAtual, editais))
      .then(async (resposta) => {
        const acompanhamento = acompanhamentoDaResposta(resposta);
        /*
          As vagas reabertas: o módulo chega sob demanda, só com os cargos na
          resposta (fora do pacote de entrada). Sem ele, as vagas ficam como
          cada edital publicou.
        */
        const cargos = (resposta as { vagas_por_cargo?: unknown } | null)
          ?.vagas_por_cargo;
        if (acompanhamento && cargos)
          acompanhamento.reaberturas =
            await import("../../lib/visao-geral/vagas-reabertas.ts").then(
              (modulo) => modulo.reaberturasDosCargos(cargos),
              () => undefined,
            );
        return acompanhamento;
      })
      .then(
        (acompanhamento) => {
          if (pedido !== este) return;
          pedido = null;
          const atual = dados.obter();
          if (atual.linhas !== linhas || atual.areaAtual !== areaAtual) return;
          publicar({
            acompanhamento: {
              area: areaAtual,
              linhas,
              dados: acompanhamento,
            },
          });
        },
        (erro) => {
          if (pedido === este) {
            pedido = null;
            semAcompanhamento = este;
            avisarOuvintes();
          }
          console.warn(
            "Acompanhamento da Visão geral indisponível; usando só as linhas:",
            erro?.message || erro,
          );
        },
      );
  }

  /*
    Os dados do legado mudaram (carga, recarga ou troca de área). Na troca de
    área o atalho sai; filtros sem
    opção na área nova são podados — só com os dados já carregados, para não
    apagar os guardados antes da primeira carga.
  */
  function aoMudarDados() {
    const { linhas, areaAtual, carregado } = dados.obter();
    const mudancas: Partial<EstadoProprio> = {};
    if (fonte.linhas !== linhas && carregado) mudancas.carregadoEm = agora();
    if (fonte.area && fonte.area !== areaAtual) mudancas.atalho = "";
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
  if (proprio.aberta) calcular();
  else pendente = true;

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
    "Limpar tudo": zera filtros, busca e atalho. É o único caminho que apaga
    o recorte.
  */
  function limparTudo() {
    publicar({ filtros: filtrosVazios(), busca: "", atalho: "" });
    aviso("Filtros limpos.");
  }

  /*
    Busca global (Ctrl+K): a linha escolhida fica à vista — filtros trocados
    pela unidade e pelo edital dela, sem busca nem atalho, e a linha em
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
      destaque: { id: String(linha.id), vez: agora() },
    });
  }

  return {
    obter: obterInstantaneo,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    definirAviso(funcao) {
      if (typeof funcao === "function") aviso = funcao;
    },
    /* A tela entrega a busca do acompanhamento (com o cliente dela). */
    /*
      A busca chega depois de a tela já estar em uso (o Mapa, sob demanda,
      depois de `definirLidaPeloMapa`): recalcula, para `aguardandoVagas`
      valer já, e não as vagas sem o desconto das reabertas até a resposta.
    */
    definirBuscaDoAcompanhamento(funcao) {
      buscarAcompanhamento = typeof funcao === "function" ? funcao : null;
      pedido = null;
      avisarOuvintes();
      pedirAcompanhamento();
    },
    /*
      A navegação diz se a página está aberta (src/app/pagina-aberta.ts). A
      tela fica montada escondida; fechada, nada é pedido ao banco por ela.
    */
    definirAberta(valor) {
      const nova = Boolean(valor);
      if (nova === proprio.aberta) return;
      // Voltou de uma tela aberta por um número: a linha de onde saiu se destaca.
      const volta = nova && linhaDeSaida ? linhaDeSaida : "";
      if (nova) linhaDeSaida = "";
      publicar({
        aberta: nova,
        visitada: proprio.visitada || nova,
        ...(volta ? { destaque: { id: volta, vez: agora() } } : {}),
      });
      pedirAcompanhamento();
    },
    definirLidaPeloMapa(valor) {
      const nova = Boolean(valor);
      if (nova === lidaPeloMapa) return;
      lidaPeloMapa = nova;
      avisarOuvintes();
      pedirAcompanhamento();
    },
    /*
      Um número da linha levou a outra tela (Lista de aprovados, Seleção):
      a página guarda a linha, e ao voltar (Voltar do navegador ou menu) ela
      rola até a linha e a destaca, com área, filtros e busca como estavam.
    */
    sairPelaLinha(id) {
      linhaDeSaida = txt(id);
    },
    definirFiltro,
    alternarFiltroUnico,
    alternarAtalho,
    alternarCriticos: () => alternarAtalho("criticos"),
    tirarAtalho: () => publicar({ atalho: "" }),
    limparTudo,
    localizar,
    /* "Voltar à linha" (detalhes do processo): rola até ela e destaca. */
    destacar: (id) => publicar({ destaque: { id: String(id), vez: agora() } }),
    definirBusca: (busca) => publicar({ busca: String(busca ?? "") }),
    /* `lmap` de TB_CONFIG_MAPA_SAUDE_INDIG (a carga publica). */
    definirDadosDoMapa: ({ lmap = null } = {}) => publicar({ mapa: { lmap } }),
    ordenarPor: (campo) =>
      publicar({ ordenacao: proximaOrdenacao(proprio.ordenacao, campo) }),
    /* Um conjunto pronto de colunas (Gestão, Prazos, Contratação). */
    aplicarPresetDeColunas(id) {
      const colunas = colunasDoPreset(id);
      if (!colunas) return;
      guardar(armazenamento, CHAVE_DAS_COLUNAS, colunas);
      publicar({ colunas });
    },
    alternarColuna(campo, visivel) {
      const colunas = alternarColuna(proprio.colunas, campo, visivel);
      if (colunas === proprio.colunas) return;
      guardar(armazenamento, CHAVE_DAS_COLUNAS, colunas);
      publicar({ colunas });
    },
    esquecer() {
      pedido = null;
      publicar({
        filtros: filtrosVazios(),
        busca: "",
        atalho: "",
        destaque: null,
        acompanhamento: null,
      });
    },
    /*
      O Exportar: a tabela como está (recorte e colunas à vista), em Excel
      ou PDF (src/lib/visao-geral/tabela-para-exportar.ts, baixado só aqui).
      Sem recorte, ele já é a área inteira; recorte vazio não exporta.
    */
    async exportar(formato) {
      const { filtradas, area, colunas } = obterInstantaneo();
      if (!filtradas.length) return;
      const [
        { tabelaDaVisaoGeral },
        { arquivoDaTabela, nomeDoArquivoExportado },
      ] = await Promise.all([
        import("../../lib/visao-geral/tabela-para-exportar.ts"),
        import("../../lib/base/exportacao-da-tabela.ts"),
      ]).catch((erro: unknown) => {
        throw erroDeVersaoNova(erro);
      });
      const quando = new Date(agora());
      const rotulo = nomeDaArea(area) || area;
      const arquivo = await arquivoDaTabela(
        formato,
        tabelaDaVisaoGeral(filtradas, colunas, rotulo),
        quando,
      );
      baixar(
        arquivo.bytes,
        nomeDoArquivoExportado(
          ["visao-geral", rotulo, hojeEmBrasilia(quando)],
          arquivo.extensao,
        ),
        arquivo.tipo,
      );
    },
  };
}

/*
  A instância da página: o legado (carga, busca global, PDF) e o React
  (src/modulos/visao-geral/) falam com ela. Começa fechada: quem abre é a
  navegação (src/app/pagina-aberta.ts).
*/
export const estadoDaVisaoGeral = criarEstadoDaVisaoGeral({ aberta: false });
