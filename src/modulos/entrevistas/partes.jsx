import {
  novaExcecao,
  novaOrigemDaBanca,
} from "../../lib/roteiro-de-entrevista.js";
import { Campo } from "../../ui/index.js";

/*
  Peças que as visões "Conduzir entrevistas" e "Roteiros" repetem: os botões
  pequenos de linha (subir, descer, remover) e os dois blocos que o roteiro e
  a configuração do edital têm iguais — a regra de convocação e a composição
  da banca. O campo (`Campo`), o aviso (`Aviso`) e o controle segmentado
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

/**
 * Regra de convocação: N× as vagas imediatas, até a posição X do cadastro
 * reserva, e as exceções por termo do cargo.
 */
export function RegraDeConvocacao({
  valor,
  aoMudar,
  erros = {},
  prefixo = "convocacao",
  somenteLeitura = false,
}) {
  const mudar = (campo, novo) => aoMudar({ ...valor, [campo]: novo });
  const mudarExcecao = (chave, campo, novo) =>
    mudar("excecoes", trocarNaLista(valor.excecoes, chave, campo, novo));
  return (
    <div className="entrevistas-bloco">
      <div className="entrevistas-grade">
        <Campo
          rotulo="Múltiplo das vagas imediatas"
          dica="N × vagas imediatas"
          erro={erros[`${prefixo}.multiplo`]}
        >
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={valor.multiplo_imediatas}
            disabled={somenteLeitura}
            onChange={(e) => mudar("multiplo_imediatas", e.target.value)}
          />
        </Campo>
        <Campo
          rotulo="Posição do cadastro reserva"
          dica="Sem vaga imediata: até esta posição"
          erro={erros[`${prefixo}.posicao`]}
        >
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={valor.posicao_cadastro_reserva}
            disabled={somenteLeitura}
            onChange={(e) => mudar("posicao_cadastro_reserva", e.target.value)}
          />
        </Campo>
      </div>
      <div className="entrevistas-sublista" aria-label="Exceções por cargo">
        <div className="entrevistas-sublista-topo">
          <strong>Exceções por cargo</strong>
        </div>
        {valor.excecoes.length ? (
          <ul className="entrevistas-linhas">
            {valor.excecoes.map((e) => (
              <li key={e.chave} className="entrevistas-linha-excecao">
                <Campo
                  rotulo="Termo do cargo"
                  erro={erros[`${prefixo}.excecao.${e.chave}`]}
                >
                  <input
                    type="text"
                    value={e.termo_cargo}
                    placeholder="Ex.: Enfermagem"
                    disabled={somenteLeitura}
                    onChange={(ev) =>
                      mudarExcecao(e.chave, "termo_cargo", ev.target.value)
                    }
                  />
                </Campo>
                <Campo
                  rotulo="Múltiplo"
                  erro={erros[`${prefixo}.excecao.${e.chave}.multiplo`]}
                >
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={e.multiplo_imediatas}
                    disabled={somenteLeitura}
                    onChange={(ev) =>
                      mudarExcecao(
                        e.chave,
                        "multiplo_imediatas",
                        ev.target.value,
                      )
                    }
                  />
                </Campo>
                <Campo
                  rotulo="Posição CR"
                  erro={erros[`${prefixo}.excecao.${e.chave}.posicao`]}
                >
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={e.posicao_cadastro_reserva}
                    disabled={somenteLeitura}
                    onChange={(ev) =>
                      mudarExcecao(
                        e.chave,
                        "posicao_cadastro_reserva",
                        ev.target.value,
                      )
                    }
                  />
                </Campo>
                {somenteLeitura ? null : (
                  <BotaoDeLinha
                    icone="fa-trash"
                    rotulo={`Remover a exceção ${e.termo_cargo || ""}`.trim()}
                    aoClicar={() =>
                      mudar(
                        "excecoes",
                        valor.excecoes.filter((x) => x.chave !== e.chave),
                      )
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="entrevistas-vazio-linha">Sem exceções.</p>
        )}
        {somenteLeitura ? null : (
          <button
            type="button"
            className="btn secondary small"
            onClick={() =>
              mudar("excecoes", [...valor.excecoes, novaExcecao()])
            }
          >
            <i className="fa-solid fa-plus" aria-hidden="true" /> Exceção
          </button>
        )}
      </div>
    </div>
  );
}

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
