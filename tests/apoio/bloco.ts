import { desmontarRaizesAbertas } from "./raizes-abertas.ts";
import { afterAll, beforeAll, describe, vi } from "vitest";

/*
  Um bloco é o que antes era um arquivo de teste. Os arquivos de teste são poucos
  e grandes (um por assunto), porque cada arquivo custa ao Vitest um processo, um
  ambiente e a carga dos módulos; o bloco devolve o isolamento que o arquivo dava:
  ao fim dele, relógio, globais, espiões e a página voltam ao estado limpo, para
  o bloco seguinte não herdar nada.
*/
export function bloco(nome: string, corpo: () => void | Promise<void>): void {
  describe(nome, () => {
    let globaisDeAntes = new Map<string, unknown>();

    beforeAll(() => {
      globaisDeAntes = lerGlobais();
    });

    afterAll(() => {
      desmontarRaizesAbertas();
      vi.useRealTimers();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
      devolverGlobais(globaisDeAntes, nome);
      if (typeof document === "undefined") return;
      document.body.replaceChildren();
      document.body.removeAttribute("class");
      document.documentElement.removeAttribute("class");
      document.documentElement.removeAttribute("style");
      for (const atributo of [...document.documentElement.attributes]) {
        if (atributo.name.startsWith("data-")) {
          document.documentElement.removeAttribute(atributo.name);
        }
      }
      localStorage.clear();
      sessionStorage.clear();
    });

    return corpo();
  });
}

const globais: Record<string, unknown> = globalThis;

function lerGlobais(): Map<string, unknown> {
  const valores = new Map<string, unknown>();
  for (const nome of Object.getOwnPropertyNames(globais)) {
    try {
      valores.set(nome, globais[nome]);
    } catch {
      // Global que não se deixa ler: fica fora.
    }
  }
  return valores;
}

/*
  Só devolve o global que o bloco trocou (um `window` ou `localStorage` de
  mentira). O que o bloco criou fica: módulo já carregado não roda de novo, e o
  global que ele publicou ao carregar continua sendo esperado pelo bloco seguinte.
  Compara o valor, não o descritor: no jsdom os globais da janela são acessores,
  e a troca fica guardada atrás do mesmo `get`/`set`.
*/
function devolverGlobais(antes: Map<string, unknown>, bloco: string): void {
  for (const [nome, valor] of antes) {
    try {
      if (Object.is(globais[nome], valor)) continue;
      if (process.env.DEPURAR_BLOCO) console.log("DEVOLVE", bloco, nome);
      globais[nome] = valor;
    } catch {
      // Global que o ambiente não deixa redefinir: fica como está.
    }
  }
}
