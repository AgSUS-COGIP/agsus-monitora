/*
  Os avisos do app: a notificação curta (toast, em `#toastBox`) e a tela de
  carregamento dos salvamentos (`#loader`). As telas recebem os dois pela
  montagem (`window.monitoraToast` e `window.monitoraLoader`, publicados por
  src/app/sistema.ts).

  Aqui fica só o estado, sem React: quem chama não depende do DOM pronto. Quem
  desenha é src/app/casca/avisos.tsx (`useSyncExternalStore`).
*/

/** "ok" (padrão), "info", "warn" ou "error"; qualquer outro vira "ok". */
export type TomDaNotificacao = "ok" | "info" | "warn" | "error";

export type Notificacao = {
  id: number;
  texto: string;
  tom: TomDaNotificacao;
};

export type Carregamento = {
  visivel: boolean;
  titulo: string;
  subtitulo: string;
  percentual: number;
  /** Quando apareceu (`Date.now()`), 0 escondido: as etapas de demora contam daqui. */
  desde: number;
};

const TONS: readonly string[] = ["ok", "info", "warn", "error"];

export function normalizarTom(tom: unknown): TomDaNotificacao {
  return TONS.includes(tom as string) ? (tom as TomDaNotificacao) : "ok";
}

function criarLoja<T>(inicial: T) {
  let valor = inicial;
  const ouvintes = new Set<() => void>();
  return {
    obter: () => valor,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    definir(novo: T) {
      valor = novo;
      ouvintes.forEach((ouvinte) => ouvinte());
    },
  };
}

const ESCONDIDO: Carregamento = {
  visivel: false,
  titulo: "Carregando",
  subtitulo: "Aguarde...",
  percentual: 0,
  desde: 0,
};

const lojaDeNotificacoes = criarLoja<readonly Notificacao[]>([]);
const lojaDoCarregamento = criarLoja<Carregamento>(ESCONDIDO);
let proximoId = 1;

/** As notificações à vista, na ordem em que chegaram. */
export const notificacoes = {
  obter: lojaDeNotificacoes.obter,
  assinar: lojaDeNotificacoes.assinar,
  /** Tira da caixa (depois da animação de saída). */
  tirar(id: number) {
    const atuais = lojaDeNotificacoes.obter();
    if (!atuais.some((item) => item.id === id)) return;
    lojaDeNotificacoes.definir(atuais.filter((item) => item.id !== id));
  },
};

export const carregamento = {
  obter: lojaDoCarregamento.obter,
  assinar: lojaDoCarregamento.assinar,
};

/** Notificação curta: `tom` é "ok" (padrão), "info", "warn" ou "error". */
export function avisar(texto: string, tom: string = "ok"): void {
  lojaDeNotificacoes.definir([
    ...lojaDeNotificacoes.obter(),
    { id: proximoId++, texto: String(texto ?? ""), tom: normalizarTom(tom) },
  ]);
}

/** Tela de carregamento de salvamento; não aparece durante a entrada (`config-loading`). */
export function mostrarCarregamento(
  mostrar: boolean,
  titulo: string = "Carregando",
  subtitulo: string = "Aguarde...",
  percentual: number = 0,
): void {
  const documento = globalThis.document;
  if (mostrar && documento?.body.classList.contains("config-loading")) return;
  const anterior = lojaDoCarregamento.obter();
  const visivel = !!mostrar;
  lojaDoCarregamento.definir({
    visivel,
    titulo,
    subtitulo,
    percentual,
    desde: !visivel ? 0 : anterior.visivel ? anterior.desde : Date.now(),
  });
}

/** Volta ao começo (testes). */
export function redefinirAvisos(): void {
  lojaDeNotificacoes.definir([]);
  lojaDoCarregamento.definir(ESCONDIDO);
}
