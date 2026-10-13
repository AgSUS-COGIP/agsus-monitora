/*
  Guarda de alterações não salvas do app, para as telas que guardam rascunho
  (o rascunho das regras, src/app/rascunho-da-regra.ts). Cada tela registra o
  que sabe responder:
    comAlteracoes()  há trabalho não salvo como versão (o F5 e o fechar pedem
                     confirmação pelo `beforeunload`);
    naoGuardado()    há mudança que ainda não chegou a lugar durável (banco ou
                     este computador): a versão nova do sistema não recarrega
                     a página enquanto isso (src/app/navegacao.js);
    guardarAgora()   grava já, sem esperar, o que dá para gravar sem rede (a
                     cópia neste computador), chamado no `beforeunload`.
  Acessos, Módulos e abas e Configurações têm a guarda própria de saída
  (confirmarSaida em navegacao.js).
*/

export type GuardaDaTela = {
  comAlteracoes: () => boolean;
  naoGuardado: () => boolean;
  guardarAgora?: () => void;
};

type Janela = Pick<Window, "addEventListener" | "removeEventListener">;

export function criarGuardaDeAlteracoes({
  janela = globalThis.window as Janela | undefined,
}: { janela?: Janela } = {}) {
  const guardas = new Set<GuardaDaTela>();
  let ligada = false;

  function aoSairDaPagina(evento: BeforeUnloadEvent) {
    let pedir = false;
    for (const g of guardas) {
      if (!g.comAlteracoes() && !g.naoGuardado()) continue;
      try {
        g.guardarAgora?.();
      } catch {
        // A cópia local é o melhor esforço: a confirmação vale mesmo sem ela.
      }
      pedir = true;
    }
    if (!pedir) return;
    evento.preventDefault();
    evento.returnValue = "";
  }

  return {
    /** Registra a guarda de uma tela; devolve a função que a tira. */
    registrar(guarda: GuardaDaTela): () => void {
      guardas.add(guarda);
      if (!ligada && janela) {
        janela.addEventListener("beforeunload", aoSairDaPagina);
        ligada = true;
      }
      return () => {
        guardas.delete(guarda);
        if (!guardas.size && ligada && janela) {
          janela.removeEventListener("beforeunload", aoSairDaPagina);
          ligada = false;
        }
      };
    },
    /** Alguma tela tem trabalho não salvo como versão. */
    comAlteracoes: () => [...guardas].some((g) => g.comAlteracoes()),
    /** Recarregar agora perderia alguma mudança (ainda não guardada em lugar nenhum). */
    podeRecarregar: () => ![...guardas].some((g) => g.naoGuardado()),
  };
}

export type GuardaDeAlteracoes = ReturnType<typeof criarGuardaDeAlteracoes>;

/** A guarda do app (uma por página). */
export const guardaDeAlteracoes = criarGuardaDeAlteracoes();
