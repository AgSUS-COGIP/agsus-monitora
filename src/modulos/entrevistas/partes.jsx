import { novaOrigemDaBanca } from "../../lib/roteiro-de-entrevista.js";
import { Campo } from "../../ui/index.js";

/*
  Peças que as visões "Conduzir entrevistas" e "Roteiros" repetem: os botões
  pequenos de linha (subir, descer, remover) e o bloco que o roteiro e a
  configuração do edital têm igual — a composição da banca. O campo (`Campo`), o aviso (`Aviso`) e o controle segmentado
  (`Segmentado`) são de src/ui/.
*/

export function BotaoDeLinha({ icone, rotulo, aoClicar, desabilitado }) {
  return (
    <button
      type="button"
      className="btn secondary icon small entrevistas-botao-linha"
      aria-label={rotulo}
      title={rotulo}
      disabled={desabilitado}
      onClick={aoClicar}
    >
      <i className={`fa-solid ${icone}`} aria-hidden="true" />
    </button>
  );
}

/* Troca um campo de um item da lista (achado pela `chave`). */
export const trocarNaLista = (lista, chave, campo, valor) =>
  lista.map((item) =>
    item.chave === chave ? { ...item, [campo]: valor } : item,
  );

/** Composição da banca: origem × quantidade. */
export function ComposicaoDaBanca({
  valor,
  aoMudar,
  erros = {},
  prefixo = "banca",
  somenteLeitura = false,
}) {
  return (
    <div className="entrevistas-sublista" aria-label="Composição da banca">
      {valor.length ? (
        <ul className="entrevistas-linhas">
          {valor.map((b) => (
            <li key={b.chave} className="entrevistas-linha-banca">
              <Campo rotulo="Origem" erro={erros[`${prefixo}.${b.chave}`]}>
                <input
                  type="text"
                  value={b.origem}
                  placeholder="Ex.: AgSUS, CONDISI, DSEI"
                  disabled={somenteLeitura}
                  onChange={(e) =>
                    aoMudar(
                      trocarNaLista(valor, b.chave, "origem", e.target.value),
                    )
                  }
                />
              </Campo>
              <Campo
                rotulo="Quantidade"
                erro={erros[`${prefixo}.${b.chave}.quantidade`]}
              >
                <input
                  type="number"
                  min="1"
                  max="20"
                  step="1"
                  value={b.quantidade}
                  disabled={somenteLeitura}
                  onChange={(e) =>
                    aoMudar(
                      trocarNaLista(
                        valor,
                        b.chave,
                        "quantidade",
                        e.target.value,
                      ),
                    )
                  }
                />
              </Campo>
              {somenteLeitura ? null : (
                <BotaoDeLinha
                  icone="fa-trash"
                  rotulo={`Remover a origem ${b.origem || ""}`.trim()}
                  aoClicar={() =>
                    aoMudar(valor.filter((x) => x.chave !== b.chave))
                  }
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="entrevistas-vazio-linha">Composição não informada.</p>
      )}
      {somenteLeitura ? null : (
        <button
          type="button"
          className="btn secondary small"
          onClick={() => aoMudar([...valor, novaOrigemDaBanca()])}
        >
          <i className="fa-solid fa-plus" aria-hidden="true" /> Origem
        </button>
      )}
    </div>
  );
}

export const numeroBR = (valor) =>
  valor === null || valor === undefined || valor === ""
    ? "—"
    : Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
