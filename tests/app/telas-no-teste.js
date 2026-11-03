import { act, createElement, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { ContextoDoApp } from "../../src/app/contexto-do-app.ts";
import { registrarTelas } from "../../src/app/registro-das-telas.ts";
import { Telas } from "../../src/app/telas.tsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/*
  A navegação de verdade (src/app/navegacao.ts) com as telas desenhadas pelo
  React (src/app/telas.tsx), como na raiz do app: as seções, a `.active` e o
  `render()` de cada tela vêm da rota. As telas são falsas (os controladores
  de `telas`, por view: `{ render, abrirVisao, abrirEdital }`), no pacote
  principal (sem `import()`), e o título vai para `#pageTitle`/`#pageSubtitle`
  como no cabeçalho.

  As ações da navegação rodam dentro de `act`: o React desenha na hora e os
  efeitos (o `render()` da tela aberta) correm antes da próxima linha.
*/

function Titulo({ navegacao }) {
  const { titulo, subtitulo } = useSyncExternalStore(
    navegacao.assinar,
    navegacao.obter,
  );
  return createElement(
    "header",
    null,
    createElement("h1", { id: "pageTitle" }, titulo),
    createElement("p", { id: "pageSubtitle" }, subtitulo),
  );
}

const ACOES = [
  "irPara",
  "reabrir",
  "abrirEntrada",
  "abrirSecao",
  "montarMenu",
  "reavaliarTelaAtual",
  "esquecerEditalEVisao",
];

/** Envolve as ações da navegação em `act` (o React acompanha na hora). */
export function comAct(navegacao) {
  const envolvida = { ...navegacao };
  for (const nome of ACOES) {
    const original = navegacao[nome];
    if (typeof original !== "function") continue;
    envolvida[nome] = (...argumentos) => {
      let resultado;
      act(() => {
        resultado = original(...argumentos);
      });
      return resultado;
    };
  }
  return envolvida;
}

/** As telas falsas no registro, como `criar` (sempre montadas). */
export function registrarTelasFalsas(telas) {
  registrarTelas(
    Object.fromEntries(
      Object.entries(telas).map(([view, controlador]) => [
        view,
        {
          criar: () => ({
            nome: `a tela ${view}`,
            conteudo: null,
            render: () => undefined,
            ...controlador,
          }),
        },
      ]),
    ),
  );
}

/**
 * Desenha as telas no `#conteudoPrincipal` (criado se faltar) e o título
 * antes dele. Devolve a navegação com `act` e o desmontar.
 */
export function montarTelasNoTeste(
  navegacao,
  telas = {},
  { avisar = () => {} } = {},
) {
  registrarTelasFalsas(telas);
  let principal = document.getElementById("conteudoPrincipal");
  if (!principal) {
    principal = document.createElement("main");
    principal.id = "conteudoPrincipal";
    document.body.append(principal);
  }
  const cabecalho = document.createElement("div");
  principal.before(cabecalho);
  const raizDoTitulo = createRoot(cabecalho);
  const raiz = createRoot(principal);
  act(() => {
    raizDoTitulo.render(createElement(Titulo, { navegacao }));
    raiz.render(
      createElement(
        ContextoDoApp.Provider,
        { value: { navegacao, avisar } },
        createElement(Telas),
      ),
    );
  });
  return {
    navegacao: comAct(navegacao),
    desmontar() {
      act(() => {
        raiz.unmount();
        raizDoTitulo.unmount();
      });
      registrarTelas({});
      navegacao.desligar?.();
    },
  };
}
