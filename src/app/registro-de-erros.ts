import { obterDadosDoMonitoramento } from "../componentes/dados-do-monitoramento.ts";
import {
  chaveDaRepeticao,
  criarJanelaDaRepeticao,
  criarReferenciaDoErro,
  ehRuido,
  montarPedidoDoRegistro,
  type Ocorrencia,
  type PedidoDoRegistro,
} from "../lib/seguranca/registro-de-erros.ts";
import { getSupabaseClient } from "../lib/sessao/supabaseClient.ts";

/*
  O registro dos erros do navegador (a regra é de
  src/lib/seguranca/registro-de-erros.ts; o banco, migration 20261123150000).

  - `ligarRegistroDeErros()` (src/main.ts, uma vez) escuta `error` e
    `unhandledrejection` em `window`; o ErrorBoundary (src/app/ErrorBoundary.tsx)
    chama `registrarErro` direto e mostra o código à pessoa.
  - Cada erro ganha uma referência na hora (devolvida a quem chamou) e vai, já
    limpo, para `registrar_erro_da_aplicacao`. Só com sessão: sem ela nada sai.
  - O mesmo erro em 30 s não vai de novo (devolve a referência do primeiro);
    no máximo 50 envios por página.
  - Nunca lança nem avisa a pessoa. A RPC ausente (PGRST202: migration ainda
    não aplicada) desliga o envio naquela página, em silêncio, sem repetir.
*/

declare const __VERSAO_DO_BUILD__: string | undefined;

const VERSAO: string | null =
  typeof __VERSAO_DO_BUILD__ === "string" && __VERSAO_DO_BUILD__
    ? __VERSAO_DO_BUILD__
    : null;

export const MAXIMO_DE_ENVIOS_POR_PAGINA = 50;
const FUNCAO_AUSENTE = "PGRST202";

type RespostaDoEnvio = { error?: { code?: unknown } | null } | null | undefined;

export type DependenciasDoRegistro = {
  enviar: (pedido: PedidoDoRegistro) => PromiseLike<RespostaDoEnvio>;
  temSessao: () => Promise<boolean>;
  agora: () => number;
  online: () => boolean;
  rota: () => string;
  area: () => string | null;
  versao: string | null;
  novaReferencia: () => string;
};

export type DadosDoErro = Omit<
  Ocorrencia,
  "rota" | "online" | "versao" | "area"
>;

export function criarRegistroDeErros(deps: DependenciasDoRegistro) {
  const repetido = criarJanelaDaRepeticao();
  let enviados = 0;
  let desligado = false;

  async function enviar(pedido: PedidoDoRegistro): Promise<void> {
    try {
      if (!(await deps.temSessao())) return;
      const resposta = await deps.enviar(pedido);
      if (resposta?.error?.code === FUNCAO_AUSENTE) desligado = true;
    } catch {
      // O registro de erros nunca vira outro erro.
    }
  }

  /** Registra o erro e devolve a referência (a do primeiro, se repetido). */
  function registrarErro(dados: DadosDoErro): string {
    const referencia = deps.novaReferencia();
    try {
      const ocorrencia: Ocorrencia = {
        ...dados,
        rota: deps.rota(),
        online: deps.online(),
        versao: deps.versao,
        area: deps.area(),
      };
      if (ehRuido(ocorrencia)) return referencia;
      const pedido = montarPedidoDoRegistro(ocorrencia, referencia);
      const anterior = repetido(
        chaveDaRepeticao(pedido),
        deps.agora(),
        referencia,
      );
      if (anterior) return anterior;
      if (desligado || enviados >= MAXIMO_DE_ENVIOS_POR_PAGINA)
        return referencia;
      enviados += 1;
      void enviar(pedido);
    } catch {
      // idem
    }
    return referencia;
  }

  type JanelaQueOuve = Pick<Window, "addEventListener" | "removeEventListener">;

  /** Escuta os erros da janela; devolve quem desliga. */
  function ouvir(janela: JanelaQueOuve): () => void {
    const aoErro = (evento: Event) => {
      const e = evento as Partial<ErrorEvent>;
      registrarErro({
        erro: e.error,
        origem: "janela",
        mensagem: typeof e.message === "string" ? e.message : "",
        arquivo: typeof e.filename === "string" ? e.filename : "",
        linha: e.lineno,
        coluna: e.colno,
      });
    };
    const aoRejeitar = (evento: Event) => {
      registrarErro({
        erro: (evento as Partial<PromiseRejectionEvent>).reason,
        origem: "promessa",
      });
    };
    janela.addEventListener("error", aoErro);
    janela.addEventListener("unhandledrejection", aoRejeitar);
    return () => {
      janela.removeEventListener("error", aoErro);
      janela.removeEventListener("unhandledrejection", aoRejeitar);
    };
  }

  return { registrarErro, ouvir };
}

function areaAberta(): string | null {
  try {
    const area = obterDadosDoMonitoramento().areaAtual;
    return typeof area === "string" && area ? area : null;
  } catch {
    return null;
  }
}

const registroDaPagina = criarRegistroDeErros({
  enviar: (pedido) => {
    const cliente = getSupabaseClient();
    return cliente
      ? cliente.rpc("registrar_erro_da_aplicacao", pedido)
      : Promise.resolve(null);
  },
  temSessao: async () => {
    const cliente = getSupabaseClient();
    if (!cliente) return false;
    const { data } = await cliente.auth.getSession();
    return Boolean(data?.session?.user?.id);
  },
  agora: () => Date.now(),
  online: () =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  rota: () => (typeof location === "undefined" ? "" : location.pathname || "/"),
  area: areaAberta,
  versao: VERSAO,
  novaReferencia: () => criarReferenciaDoErro(),
});

/** Registra um erro capturado (o ErrorBoundary); devolve a referência. */
export const registrarErro = registroDaPagina.registrarErro;

let ligado = false;

/** Escuta `error` e `unhandledrejection` da página; uma vez só. */
export function ligarRegistroDeErros(): void {
  if (ligado || typeof window === "undefined") return;
  ligado = true;
  registroDaPagina.ouvir(window);
}
