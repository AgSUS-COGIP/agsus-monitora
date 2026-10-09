/*
  Estado da aba Fila (fase F3), fora do React (useSyncExternalStore). Não
  importa React. As regras puras estão em src/lib/avaliacao-documental/fila.js
  e distribuicao.js; aqui, a leitura, as ações e a reserva da ficha aberta.

  RPCs (supabase/migrations/20261006120000_fichas_fila_e_reserva.sql;
  contrato em src/lib/rpc-contrato.js):
    obter_fila_avaliacao(p_edital)                     a fila do edital
    pegar_proxima_ficha(p_edital, p_vaga)              "Pegar próximo"
    reservar_ficha(p_ficha)                            abre (reserva 15 min)
    renovar_reserva(p_ficha)                           a cada 5 min, enquanto aberta
    liberar_reserva(p_edital, p_fichas, p_motivo)      ao fechar; coordenação, com motivo
    distribuir_fichas(p_edital, p_atribuicoes, p_motivo)
    mandar_fichas_revisao(p_edital, p_fichas, p_motivo)
    abrir_fichas_do_edital(p_edital)
    incluir_no_lote_por_decisao / revogar_decisao_lote (20261007200000; decisao-no-banco.js)
    salvar_filtro_fila(p_nome, p_filtro) / excluir_filtro_fila(p_filtro)
  "Exportar CSV" baixa a aba aberta (csvDaFila), sem ir ao banco.
  O último filtro usado fica no navegador só por conveniência (try/catch);
  os filtros salvos com nome ficam no banco, por pessoa. A ficha aberta
  (edital e ficha) fica na sessão da aba (sessionStorage), para recarregar a
  página voltar ao modo de análise; fechar a ficha esquece.
*/
import { isAdminGlobal } from "../../lib/access-roles.js";
import { comTempoLimite } from "../../lib/falha-de-rede.js";
import {
  csvDaFila,
  FILTRO_INICIAL,
  nomeDoCsvDaFila,
  normalizarFiltro,
} from "../../lib/avaliacao-documental/fila.js";
import { decidirNoLote } from "./decisao-no-banco.js";
import { mensagemDoBanco } from "./estado.js";

const RPC_OBTER_FILA = "obter_fila_avaliacao";
const RPC_PEGAR_PROXIMA = "pegar_proxima_ficha";
const RPC_RESERVAR = "reservar_ficha";
const RPC_RENOVAR = "renovar_reserva";
const RPC_LIBERAR = "liberar_reserva";
const RPC_DISTRIBUIR = "distribuir_fichas";
const RPC_REVISAO = "mandar_fichas_revisao";
const RPC_ABRIR_FICHAS = "abrir_fichas_do_edital";
const RPC_REINICIAR_FICHAS = "reiniciar_fichas_do_edital";
const RPC_SALVAR_FILTRO = "salvar_filtro_fila";
const RPC_EXCLUIR_FILTRO = "excluir_filtro_fila";

const TEMPO_LIMITE_MS = 45000;
/* A reserva dura 15 minutos; a tela renova bem antes. */
export const RENOVAR_A_CADA_MS = 5 * 60 * 1000;
const CHAVE_DO_FILTRO = "monitora.avaliacao-documental.fila.filtro";
const CHAVE_DA_FICHA_ABERTA = "monitora.avaliacao-documental.ficha-aberta";

const INICIAL = Object.freeze({
  editalId: "",
  dados: null,
  carregando: false,
  erro: "",
  filtro: FILTRO_INICIAL,
  aberta: null,
  abrindo: false,
  acao: "",
});

function armazenamentoPadrao() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function sessaoPadrao() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** A ficha aberta lembrada na sessão da aba: { edital, ficha } ou null. */
export function lerFichaLembrada(sessao = sessaoPadrao()) {
  try {
    const v = JSON.parse(sessao?.getItem(CHAVE_DA_FICHA_ABERTA) || "null");
    return v && typeof v.edital === "string" && typeof v.ficha === "string"
      ? { edital: v.edital, ficha: v.ficha }
      : null;
  } catch {
    return null;
  }
}

function lembrarFicha(sessao, valor) {
  try {
    if (valor) sessao?.setItem(CHAVE_DA_FICHA_ABERTA, JSON.stringify(valor));
    else sessao?.removeItem(CHAVE_DA_FICHA_ABERTA);
  } catch {
    /* Sem sessão no navegador: recarregar volta à lista. */
  }
}

function lerFiltro(armazenamento) {
  try {
    const texto = armazenamento?.getItem(CHAVE_DO_FILTRO);
    return texto ? normalizarFiltro(JSON.parse(texto)) : FILTRO_INICIAL;
  } catch {
    return FILTRO_INICIAL;
  }
}

function guardarFiltro(armazenamento, filtro) {
  try {
    armazenamento?.setItem(CHAVE_DO_FILTRO, JSON.stringify(filtro));
  } catch {
    /* Sem armazenamento no navegador: o filtro vale só nesta visita. */
  }
}

/* O CSV já vem com o BOM (o Excel abre em UTF-8); o Blob "text/csv" passa pela guarda de csv-security. */
function baixarNoNavegador(conteudo, nome) {
  const url = URL.createObjectURL(
    new Blob([conteudo], { type: "text/csv;charset=utf-8;" }),
  );
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function criarEstadoDaFila({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  armazenamento = armazenamentoPadrao(),
  sessao = sessaoPadrao(),
  agendar = (fn, ms) => setInterval(fn, ms),
  cancelar = (id) => clearInterval(id),
  tempoLimiteMs = TEMPO_LIMITE_MS,
  baixar = baixarNoNavegador,
  getProfile = () => null,
} = {}) {
  let estado = { ...INICIAL, filtro: lerFiltro(armazenamento) };
  let pedido = 0;
  let renovacao = null;
  let restaurou = false;
  const ouvintes = new Set();
  const publicar = (mudancas) => {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  };

  async function rpc(nome, argumentos) {
    if (!supabase) throw new Error("Sem conexão com o banco.");
    const { data, error } = await comTempoLimite(
      supabase.rpc(nome, argumentos),
      tempoLimiteMs,
    );
    if (error) throw error;
    return data;
  }

  function pararRenovacao() {
    if (renovacao !== null) cancelar(renovacao);
    renovacao = null;
  }

  async function carregar(editalId = estado.editalId) {
    const meu = ++pedido;
    if (!editalId) {
      pararRenovacao();
      publicar({ ...INICIAL, filtro: estado.filtro });
      return false;
    }
    publicar(
      editalId !== estado.editalId
        ? { ...INICIAL, filtro: estado.filtro, editalId, carregando: true }
        : { carregando: true, erro: "" },
    );
    try {
      const dados = await rpc(RPC_OBTER_FILA, { p_edital: editalId });
      if (meu !== pedido) return false;
      publicar({ dados, carregando: false, erro: "" });
      // Página recarregada com a ficha aberta: volta a ela (uma vez).
      const lembrada = lerFichaLembrada(sessao);
      if (
        lembrada?.edital === editalId &&
        !estado.aberta &&
        !estado.abrindo &&
        !restaurou
      ) {
        restaurou = true;
        void abrir(lembrada.ficha);
      }
      return true;
    } catch (erro) {
      if (meu !== pedido) return false;
      publicar({ carregando: false, erro: mensagemDoBanco(erro) });
      return false;
    }
  }

  function mudarFiltro(mudancas) {
    const filtro = normalizarFiltro({ ...estado.filtro, ...mudancas });
    guardarFiltro(armazenamento, filtro);
    publicar({ filtro });
  }

  function mostrarFicha(r) {
    pararRenovacao();
    publicar({ aberta: r, abrindo: false });
    lembrarFicha(
      sessao,
      r?.ficha?.id ? { edital: estado.editalId, ficha: r.ficha.id } : null,
    );
    if (r?.reservada && r.ficha?.id) {
      const id = r.ficha.id;
      renovacao = agendar(() => renovar(id), RENOVAR_A_CADA_MS);
    }
  }

  async function abrir(fichaId) {
    if (!fichaId) return false;
    await fechar();
    publicar({ abrindo: true });
    try {
      mostrarFicha(await rpc(RPC_RESERVAR, { p_ficha: fichaId }));
      return true;
    } catch (erro) {
      publicar({ abrindo: false });
      lembrarFicha(sessao, null);
      toast(
        `Não foi possível abrir a ficha: ${mensagemDoBanco(erro)}`,
        "error",
      );
      return false;
    }
  }

  async function pegarProxima(vaga = "") {
    await fechar({ esquecer: true });
    publicar({ abrindo: true });
    try {
      const r = await rpc(RPC_PEGAR_PROXIMA, {
        p_edital: estado.editalId,
        p_vaga: vaga || null,
      });
      if (!r?.ficha) {
        publicar({ abrindo: false });
        toast(r?.motivo || "Nenhuma ficha livre na fila.", "info");
        return false;
      }
      mostrarFicha(r);
      void carregar();
      return true;
    } catch (erro) {
      publicar({ abrindo: false });
      toast(
        `Não foi possível pegar a próxima: ${mensagemDoBanco(erro)}`,
        "error",
      );
      return false;
    }
  }

  async function renovar(fichaId) {
    if (estado.aberta?.ficha?.id !== fichaId) return pararRenovacao();
    try {
      const r = await rpc(RPC_RENOVAR, { p_ficha: fichaId });
      if (estado.aberta?.ficha?.id === fichaId)
        publicar({
          aberta: { ...estado.aberta, ficha: r?.ficha ?? estado.aberta.ficha },
        });
    } catch (erro) {
      pararRenovacao();
      if (estado.aberta?.ficha?.id === fichaId)
        publicar({
          aberta: {
            ...estado.aberta,
            reservada: false,
            somente_leitura: true,
            motivo: mensagemDoBanco(erro),
          },
        });
    }
  }

  /*
    Fecha a ficha aberta e libera a reserva dela (se era sua). Só "Voltar à
    fila" (e Pegar próximo) esquece a ficha lembrada ({ esquecer: true }); ao
    sair da página ou da aba ela continua lembrada para recarregar voltar a ela.
  */
  async function fechar({ esquecer = false } = {}) {
    const aberta = estado.aberta;
    pararRenovacao();
    if (esquecer) lembrarFicha(sessao, null);
    if (!aberta) return true;
    publicar({ aberta: null });
    if (aberta.reservada && aberta.ficha?.id) {
      try {
        await rpc(RPC_LIBERAR, {
          p_edital: estado.editalId,
          p_fichas: [aberta.ficha.id],
          p_motivo: null,
        });
      } catch {
        /* A reserva vence sozinha em 15 minutos. */
      }
      void carregar();
    }
    return true;
  }

  async function executar(nome, chamada, sucesso) {
    publicar({ acao: nome });
    try {
      const r = await chamada();
      if (sucesso) toast(sucesso(r), "success");
      await carregar();
      return { ok: true, resultado: r };
    } catch (erro) {
      const mensagem = mensagemDoBanco(erro);
      if (erro?.code === "40001") void carregar();
      return { ok: false, erro: mensagem };
    } finally {
      publicar({ acao: "" });
    }
  }

  const distribuir = (atribuicoes, motivo) =>
    executar(
      "distribuir",
      () =>
        rpc(RPC_DISTRIBUIR, {
          p_edital: estado.editalId,
          p_atribuicoes: atribuicoes,
          p_motivo: motivo || null,
        }),
      (r) => `${r?.alteradas ?? 0} ficha(s) distribuída(s).`,
    );

  const liberarReservas = (fichas, motivo) =>
    executar(
      "liberar",
      () =>
        rpc(RPC_LIBERAR, {
          p_edital: estado.editalId,
          p_fichas: fichas,
          p_motivo: motivo || null,
        }),
      (r) => `${r?.liberadas ?? 0} reserva(s) liberada(s).`,
    );

  const mandarParaRevisao = (fichas, motivo) =>
    executar(
      "revisao",
      () =>
        rpc(RPC_REVISAO, {
          p_edital: estado.editalId,
          p_fichas: fichas,
          p_motivo: motivo,
        }),
      (r) => `${r?.alteradas ?? 0} ficha(s) mandada(s) para revisão.`,
    );

  const abrirFichasDoLote = () =>
    executar(
      "abrir-fichas",
      () => rpc(RPC_ABRIR_FICHAS, { p_edital: estado.editalId }),
      (r) => `${r?.criadas ?? 0} ficha(s) aberta(s).`,
    );

  /* Só o administrador global (o banco confere): as fichas do lote voltam ao início. */
  const reiniciarFichas = (motivo) =>
    executar(
      "reiniciar",
      () =>
        rpc(RPC_REINICIAR_FICHAS, {
          p_edital: estado.editalId,
          p_motivo: motivo,
        }),
      (r) => `${r?.reiniciadas ?? 0} ficha(s) de volta ao início.`,
    );

  /* Inclusão no lote por decisão da coordenação e revogação ([{ codigo, vaga }], motivo). */
  const incluirPorDecisao = (candidatos, motivo) =>
    executar(
      "decisao",
      () => decidirNoLote(rpc, "incluir", estado.editalId, candidatos, motivo),
      (r) => r.texto,
    );
  const revogarDecisao = (candidatos, motivo) =>
    executar(
      "decisao",
      () => decidirNoLote(rpc, "revogar", estado.editalId, candidatos, motivo),
      (r) => r.texto,
    );

  async function salvarFiltro(nome) {
    try {
      const filtros = await rpc(RPC_SALVAR_FILTRO, {
        p_nome: nome,
        p_filtro: estado.filtro,
      });
      if (estado.dados) publicar({ dados: { ...estado.dados, filtros } });
      toast("Filtro salvo.", "success");
      return true;
    } catch (erro) {
      toast(
        `Não foi possível salvar o filtro: ${mensagemDoBanco(erro)}`,
        "error",
      );
      return false;
    }
  }

  async function excluirFiltro(id) {
    try {
      const filtros = await rpc(RPC_EXCLUIR_FILTRO, { p_filtro: id });
      if (estado.dados) publicar({ dados: { ...estado.dados, filtros } });
      return true;
    } catch (erro) {
      toast(
        `Não foi possível excluir o filtro: ${mensagemDoBanco(erro)}`,
        "error",
      );
      return false;
    }
  }

  /* "Exportar CSV": as linhas da aba, na ordem e nas colunas da tela. */
  function exportarCsv(linhas, etapa) {
    baixar(
      csvDaFila(linhas, etapa, estado.dados?.eu),
      nomeDoCsvDaFila(estado.dados?.edital?.rotulo, etapa),
    );
  }

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    mudarFiltro,
    abrir,
    pegarProxima,
    renovar,
    fechar,
    distribuir,
    liberarReservas,
    mandarParaRevisao,
    abrirFichasDoLote,
    reiniciarFichas,
    ehAdminGlobal: () => isAdminGlobal(getProfile()),
    incluirPorDecisao,
    revogarDecisao,
    salvarFiltro,
    excluirFiltro,
    exportarCsv,
    /* Para o conteúdo da ficha aberta (ficha/estado-da-ficha.js). */
    rpc,
    toast,
  };
}
