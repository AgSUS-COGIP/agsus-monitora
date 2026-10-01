/*
  Busca global (Ctrl+K / Cmd+K), React. Lógica pura em src/lib/busca-global.js.

  O que o legado fazia e continua aqui:
  - Ctrl+K / Cmd+K em qualquer tela abre (só com usuário conectado) e, aberta, fecha.
  - Esc, clique no fundo e o botão "Esc" fecham; a rolagem da página trava enquanto está aberta.
  - Ao abrir: campo vazio e com foco, nada listado. Cada letra filtra de novo e
    desmarca a escolha.
  - Procura em edital, unidade, etapa, status, UF, risco, ciclo, responsável e
    observações de todas as linhas do monitoramento; até 12, na ordem do banco.
  - Resultado: "edital — unidade", "etapa · UF" e selo de risco (Alto, Médio, Baixo).
  - Setas movem a escolha (sem passar das pontas, rolando até ela); Enter escolhe
    a marcada; passar o mouse marca; clique escolhe.
  - Escolher fecha e avisa o legado (EVENTO_ESCOLHA_DA_BUSCA): sem permissão do
    painel, aviso; senão limpa os filtros, filtra unidade e edital, abre o painel
    e destaca a linha na tabela.
  Novo: o termo aparece realçado; o foco fica preso no diálogo e volta a quem abriu.
*/

import {
  StrictMode,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import {
  buscarLinhas,
  ehAtalhoDaBusca,
  EVENTO_ESCOLHA_DA_BUSCA,
  partesRealcadas,
  proximoIndice,
  seloDoRisco,
  subtituloDoResultado,
  tituloDoResultado,
} from "../../lib/busca-global.js";
import {
  assinarDadosDoMonitoramento,
  obterDadosDoMonitoramento,
} from "../dados-do-monitoramento.js";
import { Modal } from "../modal.jsx";

function Realce({ valor, termo }) {
  return partesRealcadas(valor, termo).map((parte, i) =>
    parte.realce ? (
      <mark key={i} className="search-result-realce">
        {parte.texto}
      </mark>
    ) : (
      parte.texto
    ),
  );
}

function PainelDaBusca({ aoFechar, aoEscolher }) {
  const { linhas } = useSyncExternalStore(
    assinarDadosDoMonitoramento,
    obterDadosDoMonitoramento,
  );
  const [termo, setTermo] = useState("");
  const [indice, setIndice] = useState(-1);
  const rolarAteEscolhido = useRef(false);
  const base = useId();
  const idDaLista = `${base}-resultados`;
  const idDoItem = (i) => `${base}-resultado-${i}`;
  const resultados = buscarLinhas(linhas, termo);

  // Só as setas rolam a lista: com o mouse, o item já está à vista.
  useEffect(() => {
    if (!rolarAteEscolhido.current || indice < 0) return;
    rolarAteEscolhido.current = false;
    document
      .getElementById(idDoItem(indice))
      ?.scrollIntoView?.({ block: "nearest" });
  });

  function escolher(linha) {
    aoFechar();
    aoEscolher(linha);
  }

  function aoTeclar(evento) {
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      rolarAteEscolhido.current = true;
      setIndice((atual) => proximoIndice(atual, evento.key, resultados.length));
      return;
    }
    if (evento.key === "Enter" && indice >= 0 && resultados[indice])
      escolher(resultados[indice]);
  }

  const procurando = Boolean(termo.trim());

  return (
    <Modal
      className="search-modal"
      cartaoClassName="search-modal-card"
      rotulo="Busca global"
      aoFechar={aoFechar}
    >
      <div className="search-modal-input-wrap">
        <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <input
          type="text"
          role="combobox"
          aria-label="Campo de busca global"
          aria-autocomplete="list"
          aria-expanded={resultados.length > 0}
          aria-controls={idDaLista}
          aria-activedescendant={indice >= 0 ? idDoItem(indice) : undefined}
          placeholder="Buscar edital, unidade, etapa, UF..."
          autoComplete="off"
          data-foco-inicial
          value={termo}
          onChange={(evento) => {
            setTermo(evento.target.value);
            setIndice(-1);
          }}
          onKeyDown={aoTeclar}
        />
        <button
          type="button"
          className="search-modal-fechar"
          aria-label="Fechar busca"
          onClick={aoFechar}
        >
          <kbd>Esc</kbd>
        </button>
      </div>
      <ul
        id={idDaLista}
        className="search-results"
        role="listbox"
        aria-label="Resultados da busca"
      >
        {resultados.map((linha, i) => {
          const selo = seloDoRisco(linha.risco);
          return (
            <li
              key={`${linha.id}-${i}`}
              id={idDoItem(i)}
              role="option"
              aria-selected={i === indice}
              className={`search-result-item${i === indice ? " active" : ""}`}
              onMouseEnter={() => setIndice(i)}
              onClick={() => escolher(linha)}
            >
              <span className="search-result-icon" aria-hidden="true">
                <i className="fa-solid fa-folder-open"></i>
              </span>
              <span className="search-result-body">
                <span className="search-result-title">
                  <Realce valor={tituloDoResultado(linha)} termo={termo} />
                </span>
                <span className="search-result-sub">
                  <Realce valor={subtituloDoResultado(linha)} termo={termo} />
                </span>
              </span>
              <span className={`search-result-chip risco-${selo.tom}`}>
                {selo.texto}
              </span>
            </li>
          );
        })}
      </ul>
      {procurando && !resultados.length ? (
        <p className="search-results-vazio" role="status">
          Nenhum resultado encontrado
        </p>
      ) : null}
    </Modal>
  );
}

/* Trava a rolagem da página enquanto a busca está aberta. */
function useRolagemTravada(ativa) {
  useEffect(() => {
    if (!ativa) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [ativa]);
}

export function BuscaGlobal({ estaConectado, aoEscolher }) {
  const [aberta, setAberta] = useState(false);
  useRolagemTravada(aberta);

  useEffect(() => {
    function aoTeclar(evento) {
      if (!ehAtalhoDaBusca(evento)) return;
      evento.preventDefault();
      setAberta((atual) => (atual ? false : Boolean(estaConectado())));
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [estaConectado]);

  if (!aberta) return null;
  return (
    <PainelDaBusca aoFechar={() => setAberta(false)} aoEscolher={aoEscolher} />
  );
}

/* O legado é dono dos filtros e da navegação: recebe o id da linha por evento. */
function avisarEscolha(linha) {
  document.dispatchEvent(
    new CustomEvent(EVENTO_ESCOLHA_DA_BUSCA, { detail: { id: linha?.id } }),
  );
}

export function montarBuscaGlobal({
  raizDaTela = document.getElementById("buscaGlobalApp"),
  estaConectado = () => false,
  aoEscolher = avisarEscolha,
} = {}) {
  let raiz = null;
  if (raizDaTela) {
    raiz = createRoot(raizDaTela);
    raiz.render(
      <StrictMode>
        <BuscaGlobal estaConectado={estaConectado} aoEscolher={aoEscolher} />
      </StrictMode>,
    );
  }
  return { raiz };
}
