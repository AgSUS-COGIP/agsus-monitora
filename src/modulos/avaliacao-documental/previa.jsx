import { useMemo, useState } from "react";
import {
  NIVEIS,
  PARCIAIS,
  PARCIAL_DO_TIPO,
  RESULTADOS,
  rotuloDe,
  SITUACOES_DO_BLOCO,
  TITULOS_ACADEMICOS,
} from "../../lib/avaliacao-documental/catalogo.js";
import {
  calcularAvaliacao,
  numeroDoParecer,
} from "../../lib/avaliacao-documental/pontuacao.js";
import { Campo, Selo } from "../../ui/index.js";
import {
  BotaoMais,
  BotaoTirar,
  Caixa,
  CampoNumero,
  comValor,
  Escolha,
} from "./campos.jsx";

/*
  "Testar com um candidato fictício": a conta pura de
  src/lib/avaliacao-documental/pontuacao.js sobre o rascunho da regra, na
  hora e sem gravar nada. A nota mínima é a da regra de classificação do
  edital; sem ela, vale a que for digitada aqui (só na prévia). A conta
  oficial em lote (Provisória, lote) é da base Python, na fase F2.
*/

const CANDIDATO_INICIAL = Object.freeze({
  nivel: "superior",
  modalidade: "AC",
  indigena: false,
  mora_aldeia: false,
  aldeia_na_lista: false,
  blocos: {},
  titulos: [],
  cursos: [],
  vinculos: [],
  estagio_horas: 0,
  observacoes: "",
  observacoes_prontas: [],
});

const TOM_DO_RESULTADO = {
  APTO: "aprovado",
  INAPTO_REQUISITO: "reprovado",
  INAPTO_NOTA: "pendente",
};

export function Previa({ regra, notaMinima }) {
  const [aberta, setAberta] = useState(false);
  const [c, setC] = useState(CANDIDATO_INICIAL);
  const [minimaDigitada, setMinimaDigitada] = useState(null);
  const minimaDaRegra = notaMinima?.nota_minima ?? null;
  const resultado = useMemo(
    () =>
      aberta
        ? calcularAvaliacao(regra, c, {
            notaMinima:
              minimaDaRegra ??
              (typeof minimaDigitada === "number" ? minimaDigitada : null),
            notaMinimaPorNivel: notaMinima?.nota_minima_por_nivel ?? {},
          })
        : null,
    [aberta, regra, c, minimaDaRegra, minimaDigitada, notaMinima],
  );
  const mudar = (caminho, valor) => setC(comValor(c, caminho, valor));
  const vinculos = regra.blocos.find((b) => b.tipo === "VINCULOS");

  return (
    <section className="ui-card avd-previa" aria-labelledby="avdPrevia">
      <div className="avd-bloco-topo">
        <h2 className="ui-titulo" id="avdPrevia">
          Testar com um candidato fictício
        </h2>
        <button
          type="button"
          className="btn secondary small"
          aria-expanded={aberta}
          onClick={() => setAberta(!aberta)}
        >
          {aberta ? "Fechar" : "Abrir"}
        </button>
      </div>
      {aberta ? (
        <div className="avd-previa-corpo">
          <div className="avd-previa-entrada">
            <div className="ui-grade-de-campos">
              <Escolha
                rotulo="Nível da vaga"
                valor={c.nivel}
                opcoes={NIVEIS}
                aoMudar={(v) => mudar(["nivel"], v)}
              />
              <Campo rotulo="Modalidade">
                <input
                  value={c.modalidade}
                  maxLength={12}
                  onChange={(ev) =>
                    mudar(["modalidade"], ev.target.value.toUpperCase())
                  }
                />
              </Campo>
              {minimaDaRegra === null ? (
                <CampoNumero
                  rotulo="Nota mínima (só na prévia)"
                  valor={minimaDigitada}
                  aoMudar={setMinimaDigitada}
                />
              ) : null}
            </div>
            <div className="avd-caixas">
              <Caixa
                rotulo="Indígena"
                marcado={c.indigena}
                aoMudar={(v) => mudar(["indigena"], v)}
              />
              <Caixa
                rotulo="Mora em aldeia"
                marcado={c.mora_aldeia}
                aoMudar={(v) => mudar(["mora_aldeia"], v)}
              />
              <Caixa
                rotulo="Aldeia na lista do DSEI"
                marcado={c.aldeia_na_lista}
                aoMudar={(v) => mudar(["aldeia_na_lista"], v)}
              />
            </div>
            <table className="avd-tabela">
              <caption>Situação de cada bloco</caption>
              <tbody>
                {regra.blocos.map((b) => {
                  const lancado = c.blocos[b.codigo] ?? {};
                  return (
                    <tr key={b.codigo}>
                      <th scope="row">{b.titulo || b.codigo}</th>
                      <td>
                        <select
                          aria-label={`Situação de ${b.titulo || b.codigo}`}
                          value={lancado.situacao ?? "CONFORME"}
                          onChange={(ev) =>
                            mudar(["blocos", b.codigo], {
                              ...lancado,
                              situacao: ev.target.value,
                            })
                          }
                        >
                          {SITUACOES_DO_BLOCO.map(([s, r]) => (
                            <option key={s} value={s}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {(b.motivos ?? []).length ? (
                          <select
                            aria-label={`Motivo de ${b.titulo || b.codigo}`}
                            value={lancado.motivos?.[0] ?? ""}
                            onChange={(ev) =>
                              mudar(["blocos", b.codigo], {
                                ...lancado,
                                motivos: ev.target.value
                                  ? [ev.target.value]
                                  : [],
                              })
                            }
                          >
                            <option value="">Sem motivo</option>
                            {b.motivos.map((m) => (
                              <option key={m.codigo} value={m.codigo}>
                                {m.texto || m.codigo}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="avd-subgrupo">
              <h4>Títulos</h4>
              {c.titulos.map((t, i) => (
                <div className="avd-linha" key={i}>
                  <Escolha
                    rotulo="Título"
                    valor={t.titulo}
                    opcoes={TITULOS_ACADEMICOS}
                    aoMudar={(v) => mudar(["titulos", i, "titulo"], v)}
                  />
                  <Caixa
                    rotulo="Aceito"
                    marcado={t.aceito !== false}
                    aoMudar={(v) => mudar(["titulos", i, "aceito"], v)}
                  />
                  <BotaoTirar
                    rotulo="Tirar o título"
                    aoClicar={() =>
                      mudar(
                        ["titulos"],
                        c.titulos.filter((_, j) => j !== i),
                      )
                    }
                  />
                </div>
              ))}
              <BotaoMais
                aoClicar={() =>
                  mudar(
                    ["titulos"],
                    [...c.titulos, { titulo: "ESPECIALIZACAO", aceito: true }],
                  )
                }
              >
                Título
              </BotaoMais>
              <h4>Cursos</h4>
              {c.cursos.map((curso, i) => (
                <div className="avd-linha" key={i}>
                  <CampoNumero
                    rotulo="Horas"
                    valor={curso.horas}
                    aoMudar={(v) => mudar(["cursos", i, "horas"], v)}
                  />
                  <Caixa
                    rotulo="Aceito"
                    marcado={curso.aceito !== false}
                    aoMudar={(v) => mudar(["cursos", i, "aceito"], v)}
                  />
                  <BotaoTirar
                    rotulo="Tirar o curso"
                    aoClicar={() =>
                      mudar(
                        ["cursos"],
                        c.cursos.filter((_, j) => j !== i),
                      )
                    }
                  />
                </div>
              ))}
              <BotaoMais
                aoClicar={() =>
                  mudar(["cursos"], [...c.cursos, { horas: 40, aceito: true }])
                }
              >
                Curso
              </BotaoMais>
              {vinculos ? (
                <>
                  <h4>Vínculos</h4>
                  {c.vinculos.map((v, i) => (
                    <div className="avd-linha" key={i}>
                      <Escolha
                        rotulo="Categoria"
                        valor={v.categoria}
                        opcoes={(vinculos.categorias ?? []).map((x) => [
                          x.codigo,
                          x.rotulo || x.codigo,
                        ])}
                        aoMudar={(x) => mudar(["vinculos", i, "categoria"], x)}
                      />
                      <Campo rotulo="Início">
                        <input
                          type="date"
                          value={v.inicio}
                          onChange={(ev) =>
                            mudar(["vinculos", i, "inicio"], ev.target.value)
                          }
                        />
                      </Campo>
                      <Campo rotulo="Fim">
                        <input
                          type="date"
                          value={v.fim}
                          onChange={(ev) =>
                            mudar(["vinculos", i, "fim"], ev.target.value)
                          }
                        />
                      </Campo>
                      <Caixa
                        rotulo="Aceito"
                        marcado={v.aceito !== false}
                        aoMudar={(x) => mudar(["vinculos", i, "aceito"], x)}
                      />
                      <BotaoTirar
                        rotulo="Tirar o vínculo"
                        aoClicar={() =>
                          mudar(
                            ["vinculos"],
                            c.vinculos.filter((_, j) => j !== i),
                          )
                        }
                      />
                    </div>
                  ))}
                  <BotaoMais
                    aoClicar={() =>
                      mudar(
                        ["vinculos"],
                        [
                          ...c.vinculos,
                          {
                            categoria: vinculos.categorias?.[0]?.codigo ?? "",
                            inicio: "2024-01-01",
                            fim: "2024-12-31",
                            aceito: true,
                          },
                        ],
                      )
                    }
                  >
                    Vínculo
                  </BotaoMais>
                  {vinculos.estagio_indigena?.ativo ? (
                    <div className="ui-grade-de-campos">
                      <CampoNumero
                        rotulo="Horas de estágio"
                        valor={c.estagio_horas}
                        aoMudar={(v) => mudar(["estagio_horas"], v)}
                      />
                    </div>
                  ) : null}
                </>
              ) : null}
              {regra.observacoes_prontas.length ? (
                <>
                  <h4>Observações prontas</h4>
                  <div className="avd-caixas">
                    {regra.observacoes_prontas.map((o) => (
                      <Caixa
                        key={o.codigo}
                        rotulo={o.rotulo || o.codigo}
                        marcado={c.observacoes_prontas.includes(o.codigo)}
                        aoMudar={(v) =>
                          mudar(
                            ["observacoes_prontas"],
                            v
                              ? [...c.observacoes_prontas, o.codigo]
                              : c.observacoes_prontas.filter(
                                  (x) => x !== o.codigo,
                                ),
                          )
                        }
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
          {resultado ? (
            <div
              className="avd-previa-resultado"
              aria-live="polite"
              data-resultado={resultado.resultado}
            >
              <div className="avd-nota">
                <span className="avd-nota-valor">
                  {numeroDoParecer(
                    resultado.nota_final,
                    regra.casas_parecer ?? 1,
                  )}
                </span>
                <Selo tom={TOM_DO_RESULTADO[resultado.resultado]}>
                  {rotuloDe(RESULTADOS, resultado.resultado)}
                </Selo>
              </div>
              <dl className="avd-parciais">
                {regra.blocos
                  .map((b) => PARCIAL_DO_TIPO[b.tipo])
                  .filter(Boolean)
                  .map((p) => (
                    <div key={p}>
                      <dt>{rotuloDe(PARCIAIS, p)}</dt>
                      <dd>
                        {numeroDoParecer(
                          resultado.parciais[p] ?? 0,
                          regra.casas_parecer ?? 1,
                        )}
                      </dd>
                    </div>
                  ))}
                {resultado.nota_minima !== null ? (
                  <div>
                    <dt>Nota mínima</dt>
                    <dd>{numeroDoParecer(resultado.nota_minima, 2)}</dd>
                  </div>
                ) : null}
              </dl>
              <pre className="avd-parecer">{resultado.parecer}</pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
