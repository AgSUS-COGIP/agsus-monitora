import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  comporParecer,
  rascunhoInicial,
  type RascunhoDoParecer,
} from "../../../lib/parecer-em-blocos.ts";
import { Aviso, Segmentado, Selo } from "../../../ui/index.ts";
import { dadosFicticios } from "./dados-ficticios.ts";
import { DocumentoDoParecerVisto } from "./documento.tsx";
import { EditorDoParecer } from "./montar-parecer.tsx";
import { linhasVisiveis, preencherOSimulador } from "./simulador.ts";
import "../../../styles/tokens.css";
import "../../../styles/app.css";
import "../../../styles/icones-lucide.css";
import "../../../ui/ui.css";
import "./parecer-em-blocos.css";
import "./prototipo.css";

/*
  Página avulsa do PROTÓTIPO "Montar parecer" (prototipos/parecer-em-blocos/),
  para mostrar à equipe sem entrar no MONITORA: o editor com o caso fictício
  e a comparação lado a lado com o simulador original (o HTML da equipe,
  embutido no build como __SIMULADOR_HTML__ quando SIMULADOR_DE_PARECERES aponta
  para ele; o arquivo não fica no repositório), preenchido com o MESMO caso
  pelos campos dele, conferindo linha a linha que o texto final é igual.
*/

declare const __SIMULADOR_HTML__: string;

type Aba = "montar" | "comparar";
type Tema = "claro" | "escuro";

function aplicarTema(tema: Tema) {
  document.documentElement.setAttribute(
    "data-theme",
    tema === "escuro" ? "dark" : "",
  );
}

function temaInicial(): Tema {
  const pedido = new URLSearchParams(location.search).get("tema");
  if (pedido === "escuro" || pedido === "claro") return pedido;
  return matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "escuro"
    : "claro";
}

function Comparacao({ rascunho }: { rascunho: RascunhoDoParecer }) {
  const quadro = useRef<HTMLIFrameElement>(null);
  const nosso = useRef<HTMLElement>(null);
  const documento = useMemo(() => comporParecer(rascunho), [rascunho]);
  const [resultado, setResultado] = useState<{
    iguais: boolean;
    linhas: number;
    diferencas: string[];
  } | null>(null);

  function conferir() {
    const janela = quadro.current?.contentWindow;
    const pagina = janela?.document.querySelector(".document-page");
    if (!janela || !pagina || !nosso.current) return;
    preencherOSimulador(janela, structuredClone(rascunho));
    const deles = linhasVisiveis(pagina, { corrigir: true });
    const nossas = linhasVisiveis(nosso.current);
    const diferencas: string[] = [];
    for (let i = 0; i < Math.max(deles.length, nossas.length); i++)
      if (deles[i] !== nossas[i])
        diferencas.push(
          `Linha ${i + 1}: simulador “${deles[i] ?? "—"}” × MONITORA “${nossas[i] ?? "—"}”`,
        );
    setResultado({
      iguais: diferencas.length === 0,
      linhas: nossas.length,
      diferencas,
    });
  }

  return (
    <div className="prototipo-comparacao">
      {resultado ? (
        <Aviso
          tom={resultado.iguais ? "info" : "warning"}
          papel="status"
          className="prototipo-resultado"
        >
          {resultado.iguais ? (
            <>
              <i className="fa-solid fa-circle-check" aria-hidden="true" />{" "}
              Texto final idêntico nas {resultado.linhas} linhas (parágrafos,
              itens e títulos), com as correções de inglês do simulador.
            </>
          ) : (
            <>
              <strong>{resultado.diferencas.length} diferença(s):</strong>
              <ul>
                {resultado.diferencas.slice(0, 8).map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </>
          )}
        </Aviso>
      ) : null}
      <div className="prototipo-lado-a-lado">
        <section aria-label="Simulador original">
          <h2>
            Simulador original <Selo tom="neutro">HTML da equipe</Selo>
          </h2>
          <iframe
            ref={quadro}
            title="Simulador original preenchido com o mesmo caso"
            srcDoc={__SIMULADOR_HTML__}
            onLoad={() => setTimeout(conferir, 50)}
          />
        </section>
        <section aria-label="Parecer do MONITORA">
          <h2>
            MONITORA <Selo tom="pendente">Protótipo</Selo>
          </h2>
          <div className="prototipo-folha">
            <DocumentoDoParecerVisto ref={nosso} documento={documento} />
          </div>
        </section>
      </div>
    </div>
  );
}

function PaginaDoPrototipo() {
  const pedido = new URLSearchParams(location.search);
  const [aba, setAba] = useState<Aba>(
    pedido.get("aba") === "comparar" ? "comparar" : "montar",
  );
  const [tema, setTema] = useState<Tema>(temaInicial);
  const [rascunho, setRascunho] = useState<RascunhoDoParecer | null>(null);

  useEffect(() => aplicarTema(tema), [tema]);
  useEffect(() => {
    void dadosFicticios
      .carregar("ficticio-1")
      .then((d) => setRascunho((r) => r ?? rascunhoInicial(d).rascunho));
  }, []);

  return (
    <div className="prototipo-pagina" data-aba={aba}>
      <header className="prototipo-topo">
        <strong>MONITORA · Recursos</strong>
        <Segmentado<Aba>
          rotulo="Visão"
          opcoes={[
            { valor: "montar", rotulo: "Montar parecer" },
            { valor: "comparar", rotulo: "Comparar com o simulador" },
          ]}
          valor={aba}
          aoMudar={setAba}
        />
        <Segmentado<Tema>
          rotulo="Tema"
          className="prototipo-tema"
          opcoes={[
            { valor: "claro", rotulo: "Claro" },
            { valor: "escuro", rotulo: "Escuro" },
          ]}
          valor={tema}
          aoMudar={setTema}
        />
      </header>
      <main className="prototipo-conteudo">
        <div className="prototipo-editor" hidden={aba !== "montar"}>
          <EditorDoParecer
            fonte={dadosFicticios}
            recursoId="ficticio-1"
            prototipo
            aoMudarRascunho={setRascunho}
          />
        </div>
        {aba === "comparar" && rascunho ? (
          __SIMULADOR_HTML__ ? (
            <Comparacao rascunho={rascunho} />
          ) : (
            <Aviso tom="warning" className="prototipo-resultado">
              Build sem o simulador: gere com SIMULADOR_DE_PARECERES apontando
              para o HTML da equipe.
            </Aviso>
          )
        ) : null}
      </main>
    </div>
  );
}

const raiz = document.getElementById("raiz");
if (raiz)
  createRoot(raiz).render(
    <StrictMode>
      <PaginaDoPrototipo />
    </StrictMode>,
  );
