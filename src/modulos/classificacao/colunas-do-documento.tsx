import { useState, type DragEvent } from "react";
import { Aviso, classes } from "../../ui/index.js";

/*
  Aba "Colunas" de "Como fica no SEI": quais colunas a tabela de cada vaga
  mostra e em que ordem. Em cima, as que estão no documento (na ordem, com
  setas e arrastar para mudar); embaixo, as outras disponíveis, para marcar.
  Classificação, Nome (e Justificativa, nos eliminados) são obrigatórias:
  ficam marcadas, com o cadeado. A prévia, o DOCX e o "Copiar para o SEI"
  mudam na hora; "Salvar no edital" grava a escolha desta publicação.
  As regras (o que existe, o padrão) ficam em
  src/lib/classificacao/colunas-do-documento.js.
*/

export type ColunaDisponivel = {
  id: string;
  rotulo: string;
  obrigatoria: boolean;
  ajuda: string;
};

export function ColunasDoDocumento({
  disponiveis,
  escolhidas,
  aoMudar,
}: {
  disponiveis: ColunaDisponivel[] | null;
  escolhidas: string[];
  aoMudar: (escolhidas: string[]) => void;
}) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);

  if (!disponiveis)
    return (
      <Aviso como="p" className="classificacao-colunas-fixas">
        Na convocação para entrevista as colunas são fixas, como nas
        publicações: Nº, NOME, Vaga, DATA e HORA.
      </Aviso>
    );

  const porId = new Map(disponiveis.map((c) => [c.id, c]));
  const noDocumento = escolhidas
    .map((id) => porId.get(id))
    .filter((c): c is ColunaDisponivel => Boolean(c));
  const outras = disponiveis.filter((c) => !escolhidas.includes(c.id));

  const mover = (id: string, destino: number) => {
    const lista = escolhidas.filter((x) => x !== id);
    lista.splice(Math.max(0, Math.min(destino, lista.length)), 0, id);
    aoMudar(lista);
  };
  const tirar = (id: string) => aoMudar(escolhidas.filter((x) => x !== id));
  const incluir = (id: string) => aoMudar([...escolhidas, id]);

  const soltar = (ev: DragEvent<HTMLLIElement>, id: string) => {
    ev.preventDefault();
    if (arrastando && arrastando !== id)
      mover(arrastando, escolhidas.indexOf(id));
    setArrastando(null);
    setAlvo(null);
  };

  return (
    <div className="classificacao-colunas">
      <p className="ui-texto-secundario classificacao-colunas-ajuda">
        Escolha o que aparece na tabela de cada vaga. Use as setas ou arraste
        para mudar a ordem.
      </p>

      <h3 className="classificacao-colunas-titulo">
        No documento <span>({noDocumento.length})</span>
      </h3>
      <ol
        className="classificacao-colunas-lista"
        aria-label="Colunas no documento"
      >
        {noDocumento.map((c, i) => (
          <li
            key={c.id}
            data-coluna={c.id}
            className={classes(
              "classificacao-colunas-item",
              arrastando === c.id && "is-arrastando",
              alvo === c.id && arrastando !== c.id && "is-alvo",
            )}
            draggable
            onDragStart={(ev) => {
              ev.dataTransfer.effectAllowed = "move";
              ev.dataTransfer.setData("text/plain", c.id);
              setArrastando(c.id);
            }}
            onDragOver={(ev) => {
              ev.preventDefault();
              setAlvo(c.id);
            }}
            onDragLeave={() => setAlvo((a) => (a === c.id ? null : a))}
            onDrop={(ev) => soltar(ev, c.id)}
            onDragEnd={() => {
              setArrastando(null);
              setAlvo(null);
            }}
          >
            <i
              className="fa-solid fa-grip-vertical classificacao-colunas-alca"
              aria-hidden="true"
              title="Arraste para mudar a ordem"
            />
            <span className="classificacao-colunas-ordem" aria-hidden="true">
              {i + 1}
            </span>
            <label className="classificacao-colunas-rotulo">
              <input
                type="checkbox"
                checked
                disabled={c.obrigatoria}
                data-marcar-coluna={c.id}
                onChange={() => tirar(c.id)}
              />
              <span>
                {c.rotulo}
                {c.ajuda ? <small>{c.ajuda}</small> : null}
              </span>
            </label>
            {c.obrigatoria ? (
              <i
                className="fa-solid fa-lock classificacao-colunas-cadeado"
                aria-label="Obrigatória"
                title="Obrigatória"
              />
            ) : null}
            <span className="classificacao-colunas-setas">
              <button
                type="button"
                className="btn secondary small"
                data-acao="subir-coluna"
                aria-label={`Subir ${c.rotulo}`}
                title="Subir"
                disabled={i === 0}
                onClick={() => mover(c.id, i - 1)}
              >
                <i className="fa-solid fa-arrow-up" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn secondary small"
                data-acao="descer-coluna"
                aria-label={`Descer ${c.rotulo}`}
                title="Descer"
                disabled={i === noDocumento.length - 1}
                onClick={() => mover(c.id, i + 1)}
              >
                <i className="fa-solid fa-arrow-down" aria-hidden="true" />
              </button>
            </span>
          </li>
        ))}
      </ol>

      {outras.length ? (
        <>
          <h3 className="classificacao-colunas-titulo">Outras colunas</h3>
          <ul
            className="classificacao-colunas-lista"
            aria-label="Outras colunas disponíveis"
          >
            {outras.map((c) => (
              <li
                key={c.id}
                data-coluna={c.id}
                className="classificacao-colunas-item is-fora"
              >
                <label className="classificacao-colunas-rotulo">
                  <input
                    type="checkbox"
                    checked={false}
                    data-marcar-coluna={c.id}
                    onChange={() => incluir(c.id)}
                  />
                  <span>
                    {c.rotulo}
                    {c.ajuda ? <small>{c.ajuda}</small> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
