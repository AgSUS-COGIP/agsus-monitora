import { sessaoDoApp } from "../sessao.ts";
import { estadoDasConfiguracoes } from "../../modulos/configuracoes/estado.ts";

/*
  O Sair confirmado, fora do React. Era o legado `src/modules/nielsen-shell-ux.js`
  (diálogo por `insertAdjacentHTML`); o diálogo agora é
  `confirmacao-de-saida.tsx`, nos avisos da casca, e lê este estado.

  O Sair da barra lateral (rodapé, React) chama `sairDoSistema()`: pergunta
  primeiro e só então encerra a sessão (`sessaoDoApp.sair()`), com a tela de
  "Saindo do sistema…" enquanto isso. Um Sair por vez.
*/

export interface EstadoDaSaida {
  /** O diálogo "Deseja realmente sair?" está aberto. */
  perguntando: boolean;
  /** Há alterações não salvas em Configurações (lidas ao abrir o diálogo). */
  comRascunho: boolean;
  /** A sessão está sendo encerrada. */
  saindo: boolean;
}

const PARADO: EstadoDaSaida = Object.freeze({
  perguntando: false,
  comRascunho: false,
  saindo: false,
});

let estado: EstadoDaSaida = PARADO;
const ouvintes = new Set<() => void>();
let responder: ((confirmou: boolean) => void) | null = null;

function definir(parte: Partial<EstadoDaSaida>) {
  estado = { ...estado, ...parte };
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarSaida(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function obterSaida() {
  return estado;
}

interface EstadoComRascunho {
  temAlteracoes?: () => boolean;
}

/* Alterações não salvas vêm do estado das Configurações (React), o mesmo que o navigate consulta. */
export function temConfiguracaoNaoSalva(
  configuracoes: EstadoComRascunho | null | undefined = estadoDasConfiguracoes,
) {
  return Boolean(configuracoes?.temAlteracoes?.());
}

/** Abre o diálogo e resolve com a resposta. Já aberto: a segunda pergunta é "não". */
export function perguntarSeSai(): Promise<boolean> {
  if (responder) return Promise.resolve(false);
  return new Promise((resolver) => {
    responder = resolver;
    definir({ perguntando: true, comRascunho: temConfiguracaoNaoSalva() });
  });
}

/** A resposta do diálogo (Sair, Continuar no sistema, o fundo ou Esc). */
export function responderASaida(confirmou: boolean) {
  const resolver = responder;
  responder = null;
  if (estado.perguntando) definir({ perguntando: false });
  resolver?.(Boolean(confirmou));
}

function avisarFalha() {
  const mensagem = "Não foi possível encerrar esta sessão. Tente novamente.";
  if (typeof window.monitoraToast === "function") {
    window.monitoraToast(mensagem, "error");
    return;
  }
  window.alert(mensagem);
}

export interface OpcoesDaSaida {
  /** Quem encerra a sessão (nos testes, um falso). */
  encerrar?: () => unknown;
}

/** O Sair da barra lateral: confirma e, só então, encerra a sessão. */
export async function sairDoSistema({
  encerrar = () => sessaoDoApp.sair(),
}: OpcoesDaSaida = {}): Promise<boolean> {
  if (estado.saindo) return false;

  const confirmou = await perguntarSeSai();
  if (!confirmou || estado.saindo) return false;

  document.getElementById("topUserMenu")?.removeAttribute("open");
  definir({ saindo: true });
  try {
    await encerrar();
    return true;
  } catch (erro) {
    console.error("Falha ao encerrar a sessão:", erro);
    avisarFalha();
    return false;
  } finally {
    definir({ saindo: false });
  }
}

/* Só para os testes: diálogo fechado e nenhuma saída em curso. */
export function redefinirSaida() {
  responder = null;
  estado = PARADO;
  for (const ouvinte of ouvintes) ouvinte();
}
