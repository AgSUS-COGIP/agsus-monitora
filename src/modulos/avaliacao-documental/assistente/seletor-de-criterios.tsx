import { useId, useMemo, useState } from "react";
import {
  catalogoAgrupado,
  type CriterioDeDesempate,
} from "../../../lib/avaliacao-documental/catalogo-de-desempate.ts";

/*
  "Acrescentar critério" do passo 4: TODO o catálogo de desempate, em grupos
  (Prioridade legal · Pontuação · Experiência · Idade · Outros), com busca.
  Os que já estão na lista aparecem marcados com a posição (2º…) e não se
  repetem. Fica aberto para acrescentar vários seguidos.
*/
type Props = {
  catalogo: ReadonlyArray<CriterioDeDesempate>;
  usados: ReadonlyArray<string>;
  aoEscolher: (criterio: CriterioDeDesempate) => void;
  /** Nome curto da lista, para os rótulos acessíveis ("da classificação"). */
  daLista: string;
  tour?: string;
};

export function SeletorDeCriterios({
  catalogo,
  usados,
  aoEscolher,
  daLista,
  tour,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const id = useId();
  const grupos = useMemo(
    () => catalogoAgrupado(catalogo, usados, busca),
    [catalogo, usados, busca],
  );
  const livres = catalogo.filter((c) => !usados.includes(c.codigo)).length;
  return (
    <div className="avd-ast-catalogo" data-tour={tour}>
      <button
        type="button"
        className="btn secondary small"
        data-acao="acrescentar-criterio"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto(!aberto)}
      >
        <i
          className={`fa-solid ${aberto ? "fa-chevron-up" : "fa-plus"}`}
          aria-hidden="true"
        />{" "}
        Acrescentar critério
        <span className="avd-ast-contagem">
          {livres} de {catalogo.length} disponíveis
        </span>
      </button>
      {aberto ? (
        <div
          className="avd-ast-catalogo-painel"
          id={id}
          role="group"
          aria-label={`Catálogo de desempate ${daLista}`}
        >
          <input
            type="search"
            className="avd-ast-catalogo-busca"
            placeholder="Buscar critério"
            aria-label={`Buscar critério de desempate ${daLista}`}
            value={busca}
            onChange={(ev) => setBusca(ev.target.value)}
          />
          {grupos.length ? (
            grupos.map((g) => (
              <section
                key={g.grupo}
                className="avd-ast-catalogo-grupo"
                data-grupo={g.grupo}
                aria-label={g.titulo}
              >
                <h5>{g.titulo}</h5>
                <ul>
                  {g.itens.map((c) => (
                    <li key={c.codigo}>
                      <button
                        type="button"
                        className="avd-ast-catalogo-item"
                        data-criterio={c.codigo}
                        data-usado={c.posicao ? "sim" : undefined}
                        disabled={c.posicao !== null}
                        onClick={() => aoEscolher(c)}
                      >
                        <i
                          className={`fa-solid ${c.posicao ? "fa-check" : "fa-plus"}`}
                          aria-hidden="true"
                        />
                        <span>{c.nome}</span>
                        {c.posicao ? (
                          <span className="avd-ast-catalogo-posicao">
                            {c.posicao}º na lista
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <p className="ui-texto-secundario">
              Nenhum critério com “{busca}”.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
