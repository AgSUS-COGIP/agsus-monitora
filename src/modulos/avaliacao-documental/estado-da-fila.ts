/*
  Estado da aba Fila (fase F3), fora do React (useSyncExternalStore). Não
  importa React. As regras puras estão em src/lib/avaliacao-documental/fila.ts
  e distribuicao.ts; aqui, a leitura, as ações e a reserva da ficha aberta.

  RPCs (supabase/migrations/20261006120000_fichas_fila_e_reserva.sql;
  contrato em src/lib/rpc-contrato.js):
    obter_fila_avaliacao_desde(p_edital, p_desde, p_marca)
                                                       (20261014231000) a fila do edital: a
                                                       primeira leitura inteira; as seguintes
                                                       só com as linhas que mudaram desde a
                                                       anterior (fila-por-mudancas.ts). Banco
                                                       sem ela:
    obter_fila_avaliacao(p_edital)                     a fila do edital: o núcleo (no lote ou com
                                                       ficha viva) e as contagens de fora do lote
    obter_fila_fora_do_lote(p_edital, p_apos, p_limite) os de fora do lote, sob demanda e em
                                                       páginas (20261014180000_fila_leve.sql)
    pegar_proxima_ficha(p_edital, p_vaga)              "Pegar próximo"
    reservar_ficha(p_ficha)                            abre (reserva 15 min)
    renovar_reserva(p_ficha)                           a cada 5 min, enquanto aberta
    liberar_reserva(p_edital, p_fichas, p_motivo)      ao fechar; coordenação, com motivo
    distribuir_fichas(p_edital, p_atribuicoes, p_motivo)
    mandar_fichas_revisao(p_edital, p_fichas, p_motivo)
    abrir_fichas_do_edital(p_edital)
    incluir_no_lote_por_decisao / revogar_decisao_lote (20261007200000; decisao-no-banco.ts)
    salvar_filtro_fila(p_nome, p_filtro) / excluir_filtro_fila(p_filtro)
  "Exportar CSV" baixa a aba aberta (csvDaFila), sem ir ao banco.
  O último filtro usado fica no navegador só por conveniência (try/catch);
  os filtros salvos com nome ficam no banco, por pessoa. A lista de fora do
  lote (eliminados e ranqueados) só vem quando a tela pede (carregarForaDoLote:
  abas Inscritos e Eliminados, "Incluir por decisão") e fica guardada até a
  versão dela (fora_do_lote.versao) mudar numa releitura da fila. A ficha aberta
  (edital e ficha) fica na sessão da aba (sessionStorage), para recarregar a
  página voltar ao modo de análise; fechar a ficha esquece.
  No modo de análise a lista não aparece: passar de uma ficha a outra (Pegar
  próximo, Anterior / Próxima, "Concluir e próxima") não relê a fila; ela fica
  marcada como desatualizada e é relida ao voltar à lista ("Voltar à fila",
  remontar a aba).
*/
import { isAdminGlobal } from "../../lib/access-roles.ts";
import { comTempoLimite } from "../../lib/falha-de-rede";
import { ehConflitoDeVersao } from "../../lib/conflito-de-versao.ts";
import { lerFilaComRecuperacao } from "../../lib/avaliacao-documental/repetir-leitura-da-fila.ts";
import {
  csvDaFila,
  FILTRO_INICIAL,
  nomeDoCsvDaFila,
  normalizarFiltro,
} from "../../lib/avaliacao-documental/fila.ts";
import {
  lerForaDoLote,
  resumoForaDoLote,
} from "../../lib/avaliacao-documental/fila-fora-do-lote.ts";
import {
  aplicarMudancasDaFila,
  argumentosDaFilaDesde,
  RPC_FILA_DESDE,
} from "../../lib/avaliacao-documental/fila-por-mudancas.ts";
import { funcaoAusente } from "../../lib/avaliacao-documental/leitura-por-versao.ts";
import { decidirNoLote } from "./decisao-no-banco.ts";
import { mensagemDoBanco } from "./estado.ts";
import type { CandidatoDaDecisao } from "./decisao-no-banco.ts";
import type {
  AtribuicaoNoPlano,
  InscritoNaFila,
} from "../../lib/avaliacao-documental/fila.ts";
import type {
  Armazenamento,
  ContagemDaAcao,
  DadosDaFilaNaTela,
  FichaAberta,
  FichaDaFila,
  FichaLembrada,
  FiltroDaFila,
  FiltroSalvo,
  ForaDoLote,
  OpcoesDaFila,
  Registro,
  ResultadoDaAcao,
  SnapshotDaFila,
} from "./tipos-do-estado.ts";

export type { SnapshotDaFila } from "./tipos-do-estado.ts";

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

/* As linhas de fora do lote: null = ainda não lidas (ou a versão mudou). */
const FORA_INICIAL: Readonly<ForaDoLote> = Object.freeze({
  linhas: null,
  versao: "",
  carregando: false,
  erro: "",
});

const INICIAL: Readonly<SnapshotDaFila> = Object.freeze({
  editalId: "",
  dados: null,
  fora: FORA_INICIAL,
  carregando: false,
  erro: "",
  filtro: FILTRO_INICIAL,
  aberta: null,
  abrindo: false,
  acao: "",
});

function armazenamentoPadrao(): Armazenamento | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function sessaoPadrao(): Armazenamento | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** A ficha aberta lembrada na sessão da aba: { edital, ficha } ou null. */
export function lerFichaLembrada(
  sessao: Armazenamento | null = sessaoPadrao(),
): FichaLembrada | null {
  try {
    const v = JSON.parse(sessao?.getItem(CHAVE_DA_FICHA_ABERTA) || "null") as {
      edital?: unknown;
      ficha?: unknown;
    } | null;
    return v && typeof v.edital === "string" && typeof v.ficha === "string"
      ? { edital: v.edital, ficha: v.ficha }
      : null;
  } catch {
    return null;
  }
}

function lembrarFicha(
  sessao: Armazenamento | null,
  valor: FichaLembrada | null,
) {
  try {
    if (valor) sessao?.setItem(CHAVE_DA_FICHA_ABERTA, JSON.stringify(valor));
    else sessao?.removeItem(CHAVE_DA_FICHA_ABERTA);
  } catch {
    /* Sem sessão no navegador: recarregar volta à lista. */
  }
}

function lerFiltro(armazenamento: Armazenamento | null): FiltroDaFila {
  try {
    const texto = armazenamento?.getItem(CHAVE_DO_FILTRO);
    return texto ? normalizarFiltro(JSON.parse(texto)) : FILTRO_INICIAL;
  } catch {
    return FILTRO_INICIAL;
  }
}

function guardarFiltro(
  armazenamento: Armazenamento | null,
  filtro: FiltroDaFila,
) {
  try {
    armazenamento?.setItem(CHAVE_DO_FILTRO, JSON.stringify(filtro));
  } catch {
    /* Sem armazenamento no navegador: o filtro vale só nesta visita. */
  }
}

/* O CSV já vem com o BOM (o Excel abre em UTF-8); o Blob "text/csv" passa pela guarda de csv-security. */
function baixarNoNavegador(conteudo: BlobPart, nome: string) {
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
  cancelar = (id) => clearInterval(id as ReturnType<typeof setInterval>),
  tempoLimiteMs = TEMPO_LIMITE_MS,
  baixar = baixarNoNavegador,
  getProfile = () => null,
}: OpcoesDaFila = {}) {
  let estado: SnapshotDaFila = { ...INICIAL, filtro: lerFiltro(armazenamento) };
  let pedido = 0;
  let renovacao: unknown = null;
  let restaurou = false;
  let leituraDeFora: {
    editalId: string;
    versao: string;
    promessa: Promise<boolean>;
  } | null = null;
  let semFilaDesde = false;
  /* A lista mudou desde a última leitura e ninguém a está vendo (modo de análise). */
  let desatualizada = false;
  /* O salvamento da ficha aberta (ficha.tsx): fechar espera por ele antes de liberar. */
  const salvamentos = new Map<string | undefined, () => unknown>();
  const ouvintes = new Set<() => void>();
  const publicar = (mudancas: Partial<SnapshotDaFila>) => {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  };

  async function rpc(nome: string, argumentos?: Registro): Promise<unknown> {
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

  /*
    A fila do edital: só o que mudou desde a leitura anterior (do mesmo
    edital), ou inteira quando não dá para juntar; banco sem a RPC nova, a de
    sempre.
  */
  async function lerFila(editalId: string): Promise<DadosDaFilaNaTela> {
    const anterior = estado.editalId === editalId ? estado.dados : null;
    if (!semFilaDesde) {
      try {
        const r = await rpc(
          RPC_FILA_DESDE,
          argumentosDaFilaDesde(editalId, anterior),
        );
        const junta = aplicarMudancasDaFila(anterior, r);
        if (junta) return junta as DadosDaFilaNaTela;
        if (r && typeof r === "object") {
          const inteira = aplicarMudancasDaFila(
            null,
            await rpc(RPC_FILA_DESDE, argumentosDaFilaDesde(editalId, null)),
          );
          if (inteira) return inteira as DadosDaFilaNaTela;
        }
      } catch (erro) {
        if (!funcaoAusente(erro)) throw erro;
        semFilaDesde = true;
      }
    }
    return rpc(RPC_OBTER_FILA, {
      p_edital: editalId,
    }) as Promise<DadosDaFilaNaTela>;
  }

  async function carregar(editalId = estado.editalId): Promise<boolean> {
    const meu = ++pedido;
    desatualizada = false;
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
      const dados = await lerFilaComRecuperacao(() => lerFila(editalId));
      if (meu !== pedido) return false;
      const versao = resumoForaDoLote(dados).versao;
      const foraMudou =
        estado.fora.linhas !== null && estado.fora.versao !== versao;
      publicar({
        dados,
        carregando: false,
        erro: "",
        ...(foraMudou ? { fora: { ...estado.fora, linhas: null } } : {}),
      });
      // Quem já abriu a lista de fora do lote recebe a versão nova.
      if (foraMudou) void carregarForaDoLote();
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

  /*
    As linhas de fora do lote (eliminados e ranqueados), em páginas. Já lidas
    na versão atual: não vai ao banco. Uma leitura por vez (quem pede durante
    a leitura espera a mesma).
  */
  function carregarForaDoLote(): Promise<boolean> {
    const editalId = estado.editalId;
    const versao = resumoForaDoLote(estado.dados).versao;
    if (!editalId || !estado.dados) return Promise.resolve(false);
    // Banco sem a fila leve (sem fora_do_lote): "candidatos" já traz todos.
    if (!estado.dados.fora_do_lote) {
      if (estado.fora.linhas === null)
        publicar({ fora: { ...FORA_INICIAL, linhas: [] } });
      return Promise.resolve(true);
    }
    if (estado.fora.linhas !== null && estado.fora.versao === versao)
      return Promise.resolve(true);
    if (leituraDeFora?.editalId === editalId && leituraDeFora.versao === versao)
      return leituraDeFora.promessa;
    publicar({ fora: { ...estado.fora, carregando: true, erro: "" } });
    const promessa: Promise<boolean> = lerForaDoLote(rpc, editalId)
      .then((linhas) => {
        // Outro edital ou outra versão no meio da leitura: vale a leitura mais nova.
        if (
          estado.editalId !== editalId ||
          resumoForaDoLote(estado.dados).versao !== versao
        )
          return false;
        publicar({ fora: { linhas, versao, carregando: false, erro: "" } });
        return true;
      })
      .catch((erro) => {
        if (leituraDeFora?.promessa === promessa)
          publicar({
            fora: {
              ...estado.fora,
              carregando: false,
              erro: mensagemDoBanco(erro),
            },
          });
        return false;
      })
      .finally(() => {
        if (leituraDeFora?.promessa === promessa) leituraDeFora = null;
      });
    leituraDeFora = { editalId, versao, promessa };
    return promessa;
  }

  function mudarFiltro(mudancas: Partial<FiltroDaFila>) {
    const filtro = normalizarFiltro({ ...estado.filtro, ...mudancas });
    guardarFiltro(armazenamento, filtro);
    publicar({ filtro });
  }

  function mostrarFicha(r: FichaAberta | null) {
    pararRenovacao();
    publicar({ aberta: r, abrindo: false });
    lembrarFicha(
      sessao,
      r?.ficha?.id ? { edital: estado.editalId, ficha: r.ficha.id } : null,
    );
    if (r?.reservada && r.ficha?.id) {
      // A reserva mudou a linha da ficha: a lista é relida ao voltar a ela.
      desatualizada = true;
      const id = r.ficha.id;
      renovacao = agendar(() => renovar(id), RENOVAR_A_CADA_MS);
    }
  }

  async function abrir(fichaId: string): Promise<boolean> {
    if (!fichaId) return false;
    await fechar({ reler: false });
    publicar({ abrindo: true });
    try {
      mostrarFicha(
        (await rpc(RPC_RESERVAR, { p_ficha: fichaId })) as FichaAberta | null,
      );
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

  async function pegarProxima(vaga = ""): Promise<boolean> {
    await fechar({ esquecer: true, reler: false });
    publicar({ abrindo: true });
    try {
      const r = (await rpc(RPC_PEGAR_PROXIMA, {
        p_edital: estado.editalId,
        p_vaga: vaga || null,
      })) as FichaAberta | null;
      if (!r?.ficha) {
        publicar({ abrindo: false });
        toast(r?.motivo || "Nenhuma ficha livre na fila.", "info");
        // A lista volta à tela: relê o que mudou.
        if (desatualizada) void carregar();
        return false;
      }
      mostrarFicha(r);
      return true;
    } catch (erro) {
      publicar({ abrindo: false });
      if (desatualizada) void carregar();
      toast(
        `Não foi possível pegar a próxima: ${mensagemDoBanco(erro)}`,
        "error",
      );
      return false;
    }
  }

  async function renovar(fichaId: string): Promise<void> {
    if (estado.aberta?.ficha?.id !== fichaId) return pararRenovacao();
    try {
      const r = (await rpc(RPC_RENOVAR, { p_ficha: fichaId })) as {
        ficha?: FichaDaFila | null;
      } | null;
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
    { reler: false }: outra ficha vai abrir em seguida (ou a página está
    saindo) e a lista não aparece; ela fica desatualizada até voltar à tela.
  */
  async function fechar({
    esquecer = false,
    reler = true,
  }: { esquecer?: boolean; reler?: boolean } = {}): Promise<boolean> {
    const aberta = estado.aberta;
    pararRenovacao();
    if (esquecer) lembrarFicha(sessao, null);
    if (aberta) {
      const salvar = salvamentos.get(aberta.ficha?.id);
      salvamentos.delete(aberta.ficha?.id);
      publicar({ aberta: null });
      if (aberta.reservada && aberta.ficha?.id) {
        // O rascunho pendente vai antes: sem a reserva, o banco o recusaria.
        try {
          await salvar?.();
        } catch {
          /* O aviso da falha é da ficha. */
        }
        try {
          await rpc(RPC_LIBERAR, {
            p_edital: estado.editalId,
            p_fichas: [aberta.ficha.id],
            p_motivo: null,
          });
        } catch {
          /* A reserva vence sozinha em 15 minutos. */
        }
        desatualizada = true;
      }
    }
    if (reler && desatualizada && estado.editalId) void carregar();
    return true;
  }

  async function executar<T>(
    nome: string,
    chamada: () => Promise<T>,
    sucesso?: (r: T) => string,
  ): Promise<ResultadoDaAcao<T>> {
    publicar({ acao: nome });
    try {
      const r = await chamada();
      if (sucesso) toast(sucesso(r), "success");
      await carregar();
      return { ok: true, resultado: r };
    } catch (erro) {
      const mensagem = mensagemDoBanco(erro);
      if (ehConflitoDeVersao(erro)) void carregar();
      return { ok: false, erro: mensagem };
    } finally {
      publicar({ acao: "" });
    }
  }

  const distribuir = (
    atribuicoes: ReadonlyArray<AtribuicaoNoPlano>,
    motivo?: string | null,
  ) =>
    executar(
      "distribuir",
      () =>
        rpc(RPC_DISTRIBUIR, {
          p_edital: estado.editalId,
          p_atribuicoes: atribuicoes,
          p_motivo: motivo || null,
        }) as Promise<ContagemDaAcao | null>,
      (r) => `${r?.alteradas ?? 0} ficha(s) distribuída(s).`,
    );

  const liberarReservas = (
    fichas: ReadonlyArray<string>,
    motivo?: string | null,
  ) =>
    executar(
      "liberar",
      () =>
        rpc(RPC_LIBERAR, {
          p_edital: estado.editalId,
          p_fichas: fichas,
          p_motivo: motivo || null,
        }) as Promise<ContagemDaAcao | null>,
      (r) => `${r?.liberadas ?? 0} reserva(s) liberada(s).`,
    );

  const mandarParaRevisao = (
    fichas: ReadonlyArray<{ ficha: string; versao: number | null | undefined }>,
    motivo: string,
  ) =>
    executar(
      "revisao",
      () =>
        rpc(RPC_REVISAO, {
          p_edital: estado.editalId,
          p_fichas: fichas,
          p_motivo: motivo,
        }) as Promise<ContagemDaAcao | null>,
      (r) => `${r?.alteradas ?? 0} ficha(s) mandada(s) para revisão.`,
    );

  const abrirFichasDoLote = () =>
    executar(
      "abrir-fichas",
      () =>
        rpc(RPC_ABRIR_FICHAS, {
          p_edital: estado.editalId,
        }) as Promise<ContagemDaAcao | null>,
      (r) => `${r?.criadas ?? 0} ficha(s) aberta(s).`,
    );

  /* Só o administrador global e só em edital sem ficha trabalhada (o banco confere; com
     ficha concluída ou em análise, o pedido com dois administradores: reinicio-das-fichas.tsx). */
  const reiniciarFichas = (motivo: string) =>
    executar(
      "reiniciar",
      () =>
        rpc(RPC_REINICIAR_FICHAS, {
          p_edital: estado.editalId,
          p_motivo: motivo,
        }) as Promise<ContagemDaAcao | null>,
      (r) => `${r?.reiniciadas ?? 0} ficha(s) de volta ao início.`,
    );

  /* Inclusão no lote por decisão da coordenação e revogação ([{ codigo, vaga }], motivo). */
  const incluirPorDecisao = (
    candidatos: ReadonlyArray<CandidatoDaDecisao>,
    motivo: string,
  ) =>
    executar(
      "decisao",
      () => decidirNoLote(rpc, "incluir", estado.editalId, candidatos, motivo),
      (r) => r.texto,
    );
  const revogarDecisao = (
    candidatos: ReadonlyArray<CandidatoDaDecisao>,
    motivo: string,
  ) =>
    executar(
      "decisao",
      () => decidirNoLote(rpc, "revogar", estado.editalId, candidatos, motivo),
      (r) => r.texto,
    );

  async function salvarFiltro(nome: string): Promise<boolean> {
    try {
      const filtros = (await rpc(RPC_SALVAR_FILTRO, {
        p_nome: nome,
        p_filtro: estado.filtro,
      })) as FiltroSalvo[] | null;
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

  async function excluirFiltro(id: string): Promise<boolean> {
    try {
      const filtros = (await rpc(RPC_EXCLUIR_FILTRO, { p_filtro: id })) as
        FiltroSalvo[] | null;
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
  function exportarCsv(linhas: ReadonlyArray<InscritoNaFila>, etapa: string) {
    baixar(
      csvDaFila(linhas, etapa, estado.dados?.eu),
      nomeDoCsvDaFila(estado.dados?.edital?.rotulo, etapa),
    );
  }

  return {
    /** A ficha aberta diz como salvar o que falta (fechar espera antes de liberar). */
    registrarSalvamento(fichaId: string, salvar: () => unknown) {
      if (fichaId) salvamentos.set(fichaId, salvar);
    },
    obter: () => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    /* A lista mudou no modo de análise e ainda não foi relida. */
    estaDesatualizada: () => desatualizada,
    carregarForaDoLote,
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
    /* Para o conteúdo da ficha aberta (ficha/estado-da-ficha.ts). */
    rpc,
    toast,
  };
}

/** A loja da fila (o que criarEstadoDaFila devolve). */
export type LojaDaFila = ReturnType<typeof criarEstadoDaFila>;
