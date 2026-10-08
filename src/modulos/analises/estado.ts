import type {
  SnapshotDasAnalises,
  DependenciasDasAnalises,
  EstadoDasAnalises,
  LeituraDasAnalises,
  DetalheDaAnalise,
} from "./tipos.ts";
/*
  Estado da tela de Análises curriculares (`#page-analises`), fora do React:
  as linhas da área atual do app no escopo escolhido ("Situação do processo"),
  o registro aberto na gaveta (com o detalhamento sob demanda), os pareceres
  em lote (busca geral e CSV) e as ações. Os componentes leem com
  `useSyncExternalStore`. Este arquivo não importa React.

  - Sem tela de carregamento: antes da primeira carga a tela é o skeleton
    (`carregado` falso); falha nela vira `erroAoCarregar`, com "Tentar
    novamente". Com a cópia do navegador, ela aparece na hora (`daCopia`) e a
    versão nova chega por trás, sem skeleton e sem perder os filtros.
  - Sessão vencida: `semSessao`. Sem acesso (o porteiro diz não, ou a lista
    devolve 42501): `semAcesso`. Outro usuário entrou na mesma aba: tudo volta
    ao início e o guardado é esquecido.
  - "Atualizar" pede a lista ao servidor (sem a cópia) e esquece detalhes e
    pareceres já trazidos.
  - Comemorações (marcos.js): a cada carga do escopo "Ativo".
*/
import {
  ESCOPO_PADRAO,
  csvDasAnalises,
  normalizarEscopo,
  comIndicesDeBusca,
  prepararLinhas,
} from "../../lib/analises-curriculares.ts";
import {
  nomeDoCsvDeAnalises,
  rotuloDaAreaDoPainel,
} from "../../lib/area-do-painel-de-analises.js";
import { chavesDoCacheAntigo } from "../../lib/cache-do-painel-de-analises.js";
import { editaisDasLinhas } from "../../lib/editais-das-linhas.js";
import { ehErroDeAcesso } from "../../lib/cache-de-payload.js";
import { mensagemDeFalha } from "../../lib/falha-de-rede.js";
import { formatNumberBR } from "../../lib/formatters.js";
import { linhaSemDetalhe } from "../../lib/lista-do-painel-de-analises.js";
import {
  haLinhasSemParecer,
  linhaSemParecer,
  mesclarTextos,
} from "../../lib/textos-do-painel-de-analises.js";
import { criarConsultasDasAnalises } from "./consultas.ts";
import { avaliarMarcosDasAnalises } from "./marcos.ts";

export const MENSAGEM_SEM_SESSAO =
  "Sessão não localizada. Entre de novo no MONITORA.";
export const MENSAGEM_SEM_ACESSO = "Sem acesso ao Painel das análises.";

/* Reabrir a tela na mesma área depois disto relê por trás. */
export const VALIDADE_DA_CARGA_MS = 5 * 60 * 1000;

const ESTADO_INICIAL: SnapshotDasAnalises = Object.freeze({
  area: "",
  escopo: ESCOPO_PADRAO,
  linhas: [],
  payload: null,
  carregado: false,
  atualizando: false,
  erroAoCarregar: "",
  semSessao: false,
  semAcesso: false,
  /** As linhas na tela vieram da cópia do navegador (revalidando). */
  daCopia: false,
  carregadoEm: 0,
  conferidoEm: null,
  /** Chave (`__chave`) do registro aberto na gaveta, ou `null`. */
  gaveta: null,
  /** chave → `{ situacao: "carregando" | "pronto" | "erro", dados }`. */
  detalhes: new Map(),
  /** Pareceres em lote: "" (não pedidos), "carregando", "prontos" ou "erro". */
  textos: "",
});

function mensagemDaCarga(erro: unknown) {
  const codigo = codigoDoErro(erro);
  if (codigo === "PGRST202")
    return "A lista de análises ainda não foi publicada no banco.";
  if (codigo === "42501") return MENSAGEM_SEM_ACESSO;
  if (codigo === "22023") return "Área sem análises configuradas.";
  return mensagemDeFalha(erro);
}

function baixarNoNavegador(conteudo: string, nome: string) {
  // O BOM faz o Excel abrir em UTF-8.
  const arquivo = new Blob(["﻿" + conteudo], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(arquivo);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/*
  O cache antigo do painel ficava no localStorage (agsus_analises_cache_*):
  grande demais para ele e falhava calado. Sai na primeira carga.
*/
function limparCacheAntigo() {
  try {
    const chaves = [];
    for (let i = 0; i < window.localStorage.length; i += 1)
      chaves.push(window.localStorage.key(i));
    chavesDoCacheAntigo(chaves).forEach((chave) =>
      window.localStorage.removeItem(chave),
    );
  } catch {
    /* Sem localStorage: nada a limpar. */
  }
}

export function criarEstadoDasAnalises({
  supabase = null,
  toast = (mensagem: string) => console.info(mensagem),
  baixar = baixarNoNavegador,
  consultas = supabase ? criarConsultasDasAnalises({ supabase }) : null,
  comemoracoesLigadas = () => false,
  avaliarMarcos = avaliarMarcosDasAnalises,
  agora = () => Date.now(),
}: DependenciasDasAnalises = {}): EstadoDasAnalises {
  let estado = ESTADO_INICIAL;
  let pedido = 0;
  let usuarioDaCarga = "";
  let cacheAntigoLimpo = false;
  const ouvintes = new Set<() => void>();

  function publicar(mudancas: Partial<SnapshotDasAnalises>) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  /*
    Outro usuário na mesma aba (ou saiu da conta): o que era do anterior sai e
    um pedido em curso deixa de valer. A próxima abertura recarrega.
  */
  function reiniciar() {
    pedido += 1;
    consultas?.esquecer();
    publicar({ ...ESTADO_INICIAL, detalhes: new Map() });
  }
  let identidade: string | null | undefined;
  supabase?.auth?.onAuthStateChange?.((_evento, sessao) => {
    const atual = sessao?.user?.id || null;
    if (atual === identidade) return;
    if (identidade !== undefined || !atual) reiniciar();
    identidade = atual;
  });

  function mostrar(
    { payload, linhas }: LeituraDasAnalises,
    extra: Partial<SnapshotDasAnalises> = {},
  ) {
    const editais =
      Array.isArray(payload?.editais) && payload.editais.length
        ? payload.editais
        : editaisDasLinhas(linhas);
    publicar({
      linhas: prepararLinhas(linhas, { editais, area: estado.area }),
      payload,
      carregado: true,
      erroAoCarregar: "",
      semAcesso: false,
      atualizando: false,
      daCopia: false,
      carregadoEm: agora(),
      textos: "",
      ...extra,
    });
    void avaliarMarcos?.({
      ligadas: comemoracoesLigadas(),
      usuarioId: usuarioDaCarga,
      area: estado.area,
      nomeDaArea: rotuloDaAreaDoPainel(estado.area),
      escopo: estado.escopo,
      linhas: estado.linhas,
    });
  }

  function perderAcesso(erro: unknown) {
    const codigo = codigoDoErro(erro);
    publicar({
      ...ESTADO_INICIAL,
      area: estado.area,
      escopo: estado.escopo,
      detalhes: new Map(),
      semAcesso: codigo === "42501",
      erroAoCarregar: mensagemDaCarga(erro),
    });
  }

  /* O id do usuário da sessão; `null` sem sessão. */
  async function usuarioDaSessao() {
    if (!supabase?.auth?.getSession) return "";
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao?.session) return null;
    return String(sessao.session.user?.id ?? "");
  }

  /**
   * Carrega a área no escopo. Outra área: tudo recomeça (skeleton, escopo
   * "Ativo"). Outro escopo: as linhas saem (skeleton). O mesmo: relê por trás.
   * Resposta de um pedido antigo é ignorada.
   */
  async function carregar(
    area = estado.area,
    opcoes: { escopo?: string; forcarRede?: boolean } = {},
  ) {
    if (!area) return false;
    const outraArea = area !== estado.area;
    const escopo = normalizarEscopo(
      opcoes.escopo ?? (outraArea ? ESCOPO_PADRAO : estado.escopo),
    );
    const meu = ++pedido;
    if (!cacheAntigoLimpo) {
      cacheAntigoLimpo = true;
      limparCacheAntigo();
    }
    if (outraArea || escopo !== estado.escopo || !estado.carregado)
      // `atualizando`: uma segunda abertura no meio da carga não pede de novo.
      publicar({
        ...ESTADO_INICIAL,
        area,
        escopo,
        detalhes: new Map(),
        atualizando: true,
      });
    else publicar({ atualizando: true, erroAoCarregar: "" });

    if (!supabase || !consultas) {
      publicar({
        erroAoCarregar: "Sem conexão com o banco.",
        atualizando: false,
      });
      return false;
    }
    try {
      const usuarioId = await usuarioDaSessao();
      if (meu !== pedido) return false;
      if (usuarioId === null) {
        publicar({
          erroAoCarregar: MENSAGEM_SEM_SESSAO,
          semSessao: true,
          atualizando: false,
        });
        return false;
      }
      usuarioDaCarga = usuarioId;

      const pode = await consultas.podeLer();
      if (meu !== pedido) return false;
      if (pode === false) {
        perderAcesso({ code: "42501" });
        return false;
      }

      // A hora da última conferência vem à parte e não segura a carga.
      void consultas.ultimaConferencia?.(area).then((conferidoEm) => {
        if (meu === pedido) publicar({ conferidoEm });
      });

      const resultado = await consultas.carregarEscopo({
        area,
        escopo,
        usuarioId,
        forcarRede: opcoes.forcarRede === true,
        aoMudar: (novo) => {
          if (meu === pedido) mostrar(novo);
        },
        aoPerderAcesso: (erro) => {
          if (meu === pedido) perderAcesso(erro);
        },
      });
      if (meu !== pedido) return false;
      mostrar(
        resultado,
        resultado.daCopia ? { atualizando: true, daCopia: true } : {},
      );
      if (resultado.daCopia) {
        await resultado.revalidacao;
        if (meu === pedido && estado.daCopia)
          publicar({ atualizando: false, daCopia: false });
      }
      return true;
    } catch (erro) {
      if (meu !== pedido) return false;
      if (ehErroDeAcesso(erro)) {
        void consultas.apagarCopias();
        perderAcesso(erro);
      } else if (estado.carregado) {
        publicar({ atualizando: false });
        toast(
          `Não foi possível atualizar as análises: ${mensagemDaCarga(erro)}`,
          "error",
        );
      } else {
        publicar({ erroAoCarregar: mensagemDaCarga(erro), atualizando: false });
      }
      return false;
    }
  }

  /*
    A tela foi aberta (`render()` do controlador): outra área, ou sem dados,
    carrega; a mesma área carregada há mais de 5 minutos relê por trás; senão
    fica como está (o quadro antigo também não recarregava ao voltar).
  */
  function abrir(area: string) {
    if (!area) return Promise.resolve(false);
    if (area !== estado.area || (!estado.carregado && !estado.atualizando))
      return carregar(area);
    if (
      !estado.atualizando &&
      agora() - estado.carregadoEm > VALIDADE_DA_CARGA_MS
    )
      return carregar(area);
    return Promise.resolve(true);
  }

  async function atualizar() {
    consultas?.esquecer();
    const ok = await carregar(estado.area, { forcarRede: true });
    if (ok)
      toast(
        `Análises atualizadas: ${formatNumberBR(estado.linhas.length)} registros.`,
        "info",
      );
    return ok;
  }

  const trocarEscopo = (escopo: string) => carregar(estado.area, { escopo });

  /*
    Os pareceres (e o link do PDF e a experiência) de todas as linhas, em
    lote, para a busca geral, a busca da fila e o CSV. Devolve se as linhas
    estão completas.
  */
  async function garantirTextos() {
    if (!haLinhasSemParecer(estado.linhas)) return true;
    if (!consultas) return false;
    if (estado.textos === "carregando") return false;
    const meu = pedido;
    const { area, escopo } = estado;
    publicar({ textos: "carregando" });
    try {
      const mapa = await consultas.textos(area, escopo);
      if (meu !== pedido) return false;
      const copia = estado.linhas.map((linha) => ({ ...linha }));
      mesclarTextos(copia, mapa);
      publicar({ linhas: copia.map(comIndicesDeBusca), textos: "prontos" });
      return true;
    } catch (erro) {
      console.warn("Não foi possível trazer os pareceres:", erro);
      if (meu === pedido) publicar({ textos: "erro" });
      return false;
    }
  }

  /** CSV do recorte: `selecionar(linhas)` refaz o recorte com as linhas completas. */
  async function exportarCsv(
    selecionar: Parameters<EstadoDasAnalises["exportarCsv"]>[0],
  ) {
    if (haLinhasSemParecer(selecionar(estado.linhas))) {
      toast("Preparando o CSV com os pareceres...", "info");
      if (!(await garantirTextos())) {
        toast(
          "Não foi possível trazer os pareceres para o CSV. Tente novamente.",
          "error",
        );
        return false;
      }
    }
    const linhas = selecionar(estado.linhas);
    baixar(
      csvDasAnalises(linhas, estado.area),
      nomeDoCsvDeAnalises(estado.area),
    );
    toast(
      `Exportados ${formatNumberBR(linhas.length)} registros do recorte atual.`,
      "info",
    );
    return true;
  }

  function definirDetalhe(id: string, valor: DetalheDaAnalise) {
    const detalhes = new Map(estado.detalhes);
    detalhes.set(id, valor);
    publicar({ detalhes });
  }

  /*
    Abre a gaveta. A lista enxuta não traz pontuações, links, datas nem o
    parecer: o detalhamento vem do servidor (uma vez por registro).
  */
  async function abrirDetalhe(chave: string) {
    publicar({ gaveta: chave });
    const linha = estado.linhas.find((l) => l.__chave === chave);
    if (
      !consultas ||
      !linha?.id ||
      (!linhaSemDetalhe(linha) && !linhaSemParecer(linha))
    )
      return;
    if (estado.detalhes.get(chave)?.situacao === "pronto") return;
    const meu = pedido;
    definirDetalhe(chave, { situacao: "carregando", dados: null });
    try {
      const dados = await consultas.detalhe(linha.id);
      if (meu === pedido) definirDetalhe(chave, { situacao: "pronto", dados });
    } catch (erro) {
      console.warn(
        "Não foi possível carregar o detalhamento da análise:",
        erro,
      );
      if (meu === pedido)
        definirDetalhe(chave, { situacao: "erro", dados: null });
    }
  }

  return {
    obter: () => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    abrir,
    atualizar,
    trocarEscopo,
    garantirTextos,
    exportarCsv,
    abrirDetalhe,
    fecharDetalhe: () => publicar({ gaveta: null }),
  };
}

function codigoDoErro(erro: unknown): unknown {
  return erro && typeof erro === "object" && "code" in erro ? erro.code : null;
}
