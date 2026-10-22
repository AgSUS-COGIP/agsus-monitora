import { NOVIDADES, type Novidade } from "../lib/novidades.ts";
import {
  ARQUIVO_DA_VERSAO,
  EVENTO_TELA_ANTIGA,
  lerVersaoPublicada,
  novidadeParaMostrar,
} from "../lib/versao-do-sistema.ts";
import { guardaDeAlteracoes } from "./guarda-de-alteracoes.ts";

/*
  Aviso de versão nova publicada (o desenho é de
  src/componentes/aviso-de-versao/).

  Detecção: a página compara a versão gravada no próprio JS no build
  (`__VERSAO_DO_BUILD__`, o commit) com `/versao.json`, um arquivo estático de
  ~200 bytes que o mesmo build publica (vite.config.js). É um GET à Vercel sem
  cache, nunca ao banco: a cada 5 minutos com a aba visível, ao voltar para a
  aba e ao voltar o foco (no máximo uma vez por minuto). Aba oculta: o relógio
  para. Sem versão gravada (npm run dev:frontend, testes) não confere nada.

  A pessoa decide quando atualizar: nada recarrega sozinho. "Atualizar agora"
  com rascunho ou mudança não salva (src/app/guarda-de-alteracoes.ts) não
  recarrega e pede para salvar antes. Fechar o aviso vale só para aquela
  versão: uma mais nova o traz de volta.

  Tela antiga: uma RPC falhou como só falha a versão anterior (evento de
  src/lib/supabaseClient.js). Confere a versão na hora e, se há mesmo uma nova,
  o aviso vira "Atualize para continuar" (sem fechar). Sem versão nova
  confirmada não muda nada: o PGRST202 também aparece quando o front chega
  antes da migration, e aí recarregar não resolve.

  A recarga de src/lib/importar-com-recarga.js (pedaço antigo que sumiu)
  continua sendo o último recurso.
*/

declare const __VERSAO_DO_BUILD__: string | undefined;

export const VERSAO_DESTE_BUILD: string | null =
  typeof __VERSAO_DO_BUILD__ === "string" && __VERSAO_DO_BUILD__
    ? __VERSAO_DO_BUILD__
    : null;

export const INTERVALO_DA_CONFERENCIA_MS = 5 * 60_000;
/* Voltar para a aba ou o foco confere de novo, no máximo uma vez por minuto. */
export const CONFERENCIA_MINIMA_MS = 60_000;
export const CHAVE_DO_FECHAMENTO = "monitora:aviso-de-versao-fechado";

export const AVISO_DE_PENDENCIA =
  "Salve o que estiver fazendo antes de atualizar.";

export type EstadoDoAviso = {
  /** A versão publicada, quando é outra (null: esta é a vigente). */
  versaoNova: string | null;
  /** "motivo padronizado na reabertura": a novidade que esta versão não tem. */
  novidade: string | null;
  /** Uma chamada ao banco falhou por ser da versão anterior. */
  telaAntiga: boolean;
  /** Fechado pela pessoa (para esta versão nova). */
  fechado: boolean;
  /** Pediu para atualizar com algo por salvar. */
  pendencia: boolean;
};

type Documento = Pick<
  Document,
  "visibilityState" | "addEventListener" | "removeEventListener"
>;
type Janela = Pick<Window, "addEventListener" | "removeEventListener">;
type Armazenamento = Pick<Storage, "getItem" | "setItem">;

export type DependenciasDoAviso = {
  versaoAtual?: string | null;
  buscar?: (endereco: string) => Promise<unknown>;
  documento?: Documento;
  janela?: Janela;
  armazenamento?: () => Armazenamento | undefined;
  novidadesDesteBuild?: readonly Novidade[];
  /** Há algo que recarregar agora perderia. */
  temPendencia?: () => boolean;
  /** Guardas de saída com pergunta (Acessos, Módulos e abas, Configurações). */
  confirmarSaida?: () => boolean;
  recarregar?: () => void;
  agora?: () => number;
  intervaloMs?: number;
};

async function buscarVersaoPublicada(endereco: string): Promise<unknown> {
  const resposta = await fetch(`${endereco}?t=${Date.now()}`, {
    cache: "no-store",
    credentials: "omit",
  });
  if (!resposta.ok) return null;
  return resposta.json();
}

function lerFechamento(armazenamento: () => Armazenamento | undefined) {
  try {
    return armazenamento()?.getItem(CHAVE_DO_FECHAMENTO) ?? null;
  } catch {
    return null;
  }
}

export function criarAvisoDeVersao({
  versaoAtual = VERSAO_DESTE_BUILD,
  buscar = buscarVersaoPublicada,
  documento = globalThis.document,
  janela = globalThis.window,
  armazenamento = () => globalThis.localStorage,
  novidadesDesteBuild = NOVIDADES,
  temPendencia = () =>
    guardaDeAlteracoes.comAlteracoes() || !guardaDeAlteracoes.podeRecarregar(),
  confirmarSaida = () => true,
  recarregar = () => globalThis.location?.reload(),
  agora = Date.now,
  intervaloMs = INTERVALO_DA_CONFERENCIA_MS,
}: DependenciasDoAviso = {}) {
  let estado: EstadoDoAviso = Object.freeze({
    versaoNova: null,
    novidade: null,
    telaAntiga: false,
    fechado: false,
    pendencia: false,
  });
  const ouvintes = new Set<() => void>();
  let relogio: ReturnType<typeof setInterval> | null = null;
  let ultimaConferencia = 0;
  let emCurso: Promise<boolean> | null = null;
  let ligado = false;

  function mudar(parcial: Partial<EstadoDoAviso>) {
    estado = Object.freeze({ ...estado, ...parcial });
    for (const ouvinte of ouvintes) ouvinte();
  }

  const visivel = () => documento?.visibilityState !== "hidden";

  /** Lê o versao.json agora; true quando há versão nova publicada. */
  function conferir(): Promise<boolean> {
    if (!versaoAtual) return Promise.resolve(false);
    if (emCurso) return emCurso;
    ultimaConferencia = agora();
    emCurso = buscar(ARQUIVO_DA_VERSAO)
      .then((dados) => {
        const publicada = lerVersaoPublicada(dados);
        if (!publicada) return estado.versaoNova !== null;
        if (publicada.versao === versaoAtual) return false;
        if (publicada.versao !== estado.versaoNova)
          mudar({
            versaoNova: publicada.versao,
            novidade: novidadeParaMostrar(
              publicada.novidades,
              novidadesDesteBuild,
            ),
            fechado: lerFechamento(armazenamento) === publicada.versao,
            pendencia: false,
          });
        return true;
      })
      // Sem rede ou arquivo fora do ar: tenta de novo na próxima vez.
      .catch(() => estado.versaoNova !== null)
      .finally(() => {
        emCurso = null;
      });
    return emCurso;
  }

  function pararRelogio() {
    if (relogio !== null) clearInterval(relogio);
    relogio = null;
  }

  function ligarRelogio() {
    pararRelogio();
    relogio = setInterval(() => {
      if (visivel()) void conferir();
    }, intervaloMs);
  }

  function conferirSeFazTempo() {
    if (agora() - ultimaConferencia >= CONFERENCIA_MINIMA_MS) void conferir();
  }

  function aoMudarVisibilidade() {
    if (!visivel()) {
      pararRelogio();
      return;
    }
    conferirSeFazTempo();
    ligarRelogio();
  }

  function aoFocar() {
    if (visivel()) conferirSeFazTempo();
  }

  async function aoSinalDeTelaAntiga() {
    if (estado.telaAntiga) return;
    const haNova = estado.versaoNova !== null || (await conferir());
    if (haNova) mudar({ telaAntiga: true });
  }

  function aoEventoDeTelaAntiga() {
    void aoSinalDeTelaAntiga();
  }

  return {
    obter: () => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    conferir,
    aoSinalDeTelaAntiga,
    /** Liga a conferência periódica e os eventos (uma vez; sem versão gravada, nada). */
    iniciar() {
      if (ligado || !versaoAtual) return;
      ligado = true;
      documento?.addEventListener("visibilitychange", aoMudarVisibilidade);
      janela?.addEventListener("focus", aoFocar);
      janela?.addEventListener(EVENTO_TELA_ANTIGA, aoEventoDeTelaAntiga);
      if (visivel()) ligarRelogio();
    },
    parar() {
      if (!ligado) return;
      ligado = false;
      pararRelogio();
      documento?.removeEventListener("visibilitychange", aoMudarVisibilidade);
      janela?.removeEventListener("focus", aoFocar);
      janela?.removeEventListener(EVENTO_TELA_ANTIGA, aoEventoDeTelaAntiga);
    },
    /** Fecha o aviso só para a versão nova de agora. */
    fechar() {
      if (!estado.versaoNova || estado.telaAntiga) return;
      try {
        armazenamento()?.setItem(CHAVE_DO_FECHAMENTO, estado.versaoNova);
      } catch {
        // Sem localStorage: fecha só nesta página.
      }
      mudar({ fechado: true, pendencia: false });
    },
    /** Recarrega, se nada se perde; senão, pede para salvar antes. true = recarregou. */
    atualizarAgora(): boolean {
      if (temPendencia()) {
        mudar({ pendencia: true });
        return false;
      }
      if (!confirmarSaida()) return false;
      mudar({ pendencia: false });
      recarregar();
      return true;
    },
  };
}

export type AvisoDeVersao = ReturnType<typeof criarAvisoDeVersao>;
