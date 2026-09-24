import { useEffect, useMemo, useRef, useState } from "react";

/*
  Select com busca e escolha múltipla — o único do app principal (Análises usa
  Tom Select; DESIGN.md, seção 4). Controlado: a tela guarda a seleção e a
  recebe de volta por `aoMudar`.

  O padrão vem da tela de Análises (`src/analises/analises-app.js`). As classes
  são as de `src/styles/multi-select-busca.css`.

  - O `id` vai no botão que abre o menu, para o `<label htmlFor>` da linha
    apontar para ele.
  - A seleção sai sempre ordenada pelo rótulo, com número em ordem numérica.
  - Opção que deixou de existir não aparece marcada; quem troca as opções é
    quem decide tirá-la da seleção (`manterSoAsOpcoes`).
*/

const text = (value) => String(value ?? "").trim();

/*
  Busca sem acento e sem caixa: quem procura "migracao" espera encontrar
  "Migração".
*/
const norm = (value) =>
  text(value).normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

const compara = (a, b) =>
  String(a ?? "").localeCompare(String(b ?? ""), "pt-BR", { numeric: true });

const classes = (...lista) => lista.filter(Boolean).join(" ");

export function normalizarOpcoes(lista) {
  return (lista || [])
    .map((item) =>
      typeof item === "object" && item !== null
        ? {
            value: text(item.value),
            label: text(item.label) || text(item.value),
          }
        : { value: text(item), label: text(item) },
    )
    .filter((item) => item.value);
}

export function MultiSelectBusca({
  id,
  opcoes = [],
  selecionados = [],
  placeholder = "Todos",
  aoMudar = () => {},
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const raiz = useRef(null);
  const gatilho = useRef(null);
  const campoDeBusca = useRef(null);
  const lista = useRef(null);
  /* O que focar quando o menu acabar de abrir: a busca, ou a primeira opção. */
  const focoAoAbrir = useRef("busca");

  const todas = useMemo(() => normalizarOpcoes(opcoes), [opcoes]);
  const rotuloDe = (valor) =>
    todas.find((opcao) => opcao.value === valor)?.label || valor;
  const escolhidos = selecionados.filter((valor) =>
    todas.some((opcao) => opcao.value === valor),
  );
  const marcados = new Set(escolhidos);

  const termo = norm(busca);
  const visiveis = termo
    ? todas.filter(
        (opcao) =>
          norm(opcao.label).includes(termo) ||
          norm(opcao.value).includes(termo),
      )
    : todas;

  const ordenar = (valores) =>
    [...new Set(valores)].sort((a, b) => compara(rotuloDe(a), rotuloDe(b)));

  function focarOpcao(indice) {
    const caixas = [...(lista.current?.querySelectorAll("input") || [])];
    if (!caixas.length) return;
    caixas[Math.max(0, Math.min(indice, caixas.length - 1))].focus();
  }

  useEffect(() => {
    if (!aberto) return undefined;
    if (focoAoAbrir.current === "opcao") focarOpcao(0);
    else campoDeBusca.current?.focus();

    /*
      Fecha com clique fora e com `Esc`. Só o menu aberto escuta, então o custo
      não cresce com o número de filtros na tela — e abrir outro fecha este,
      porque o clique no outro é um clique fora.
    */
    function aoClicar(evento) {
      if (!raiz.current?.contains(evento.target)) setAberto(false);
    }
    function aoTeclar(evento) {
      if (evento.key !== "Escape") return;
      setAberto(false);
      gatilho.current?.focus();
    }
    document.addEventListener("click", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("click", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  function abrir(foco) {
    focoAoAbrir.current = foco;
    setAberto(true);
  }

  const rotulo = !escolhidos.length
    ? placeholder
    : escolhidos.length <= 2
      ? escolhidos.map(rotuloDe).join(", ")
      : `${escolhidos.length} selecionados`;

  return (
    <div
      ref={raiz}
      /*
        `multi-select-busca` separa este componente do filtro legado da Saúde
        Indígena, que usa as mesmas classes mas abre por `.open`, não por
        `hidden`: sem ela, `.multi-select-menu { display: grid }` valia para
        os dois, e os filtros da Saúde Indígena ficavam abertos ao mesmo
        tempo, empilhados uns sobre os outros.
      */
      className={classes(
        "multi-select",
        "multi-select-busca",
        escolhidos.length && "is-filled",
      )}
    >
      <button
        ref={gatilho}
        id={id}
        type="button"
        className="multi-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => (aberto ? setAberto(false) : abrir("busca"))}
        onKeyDown={(evento) => {
          if (evento.key !== "ArrowDown") return;
          evento.preventDefault();
          if (aberto) focarOpcao(0);
          else abrir("opcao");
        }}
      >
        <span
          className="multi-select-label"
          title={escolhidos.length ? escolhidos.map(rotuloDe).join(", ") : ""}
        >
          {rotulo}
        </span>
        <span className="multi-select-count" hidden={!escolhidos.length}>
          {escolhidos.length}
        </span>
        <i className="fa-solid fa-chevron-down" aria-hidden="true" />
      </button>
      <div className="multi-select-menu" hidden={!aberto}>
        <input
          ref={campoDeBusca}
          type="search"
          className="multi-select-search"
          placeholder="Buscar..."
          autoComplete="off"
          aria-label="Buscar opções"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key !== "ArrowDown") return;
            evento.preventDefault();
            focarOpcao(0);
          }}
        />
        <div className="multi-select-actions">
          <button
            type="button"
            className="multi-select-link"
            data-acao="visiveis"
            onClick={() =>
              aoMudar(
                ordenar([
                  ...escolhidos,
                  ...visiveis.map((opcao) => opcao.value),
                ]),
              )
            }
          >
            Selecionar visíveis
          </button>
          <button
            type="button"
            className="multi-select-link"
            data-acao="limpar"
            onClick={() => aoMudar([])}
          >
            Limpar
          </button>
        </div>
        <div
          ref={lista}
          className="multi-select-options"
          role="listbox"
          aria-multiselectable="true"
          onKeyDown={(evento) => {
            if (evento.key !== "ArrowDown" && evento.key !== "ArrowUp") return;
            const caixas = [...lista.current.querySelectorAll("input")];
            const atual = caixas.indexOf(evento.target);
            evento.preventDefault();
            if (evento.key === "ArrowDown") focarOpcao(atual + 1);
            else if (atual <= 0) campoDeBusca.current?.focus();
            else focarOpcao(atual - 1);
          }}
        >
          {visiveis.length ? (
            visiveis.map((opcao) => {
              const marcado = marcados.has(opcao.value);
              return (
                <label
                  key={opcao.value}
                  className="multi-select-option"
                  role="option"
                  aria-selected={marcado}
                  title={opcao.label}
                >
                  <input
                    type="checkbox"
                    value={opcao.value}
                    checked={marcado}
                    onChange={(evento) =>
                      aoMudar(
                        evento.target.checked
                          ? ordenar([...escolhidos, opcao.value])
                          : escolhidos.filter((item) => item !== opcao.value),
                      )
                    }
                  />
                  <span>{opcao.label}</span>
                </label>
              );
            })
          ) : (
            <div className="multi-select-empty">Nenhuma opção encontrada.</div>
          )}
        </div>
      </div>
    </div>
  );
}
