import { useMemo } from "react";
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
import type { RegraAnalise } from "../../lib/avaliacao-documental/tipos-da-regra.ts";
import type { Candidato, NotaMinima } from "./previa.tsx";
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
  O corpo de "Testar com um candidato fictício" (previa.tsx), carregado só
  ao abrir. Duas colunas que não se sobrepõem: à esquerda, as entradas do
  candidato em seções; à direita, o resultado preso (nota grande, situação,
  parciais e parecer). Em largura estreita (container), uma coluna com o
  resultado em cima.
*/

type Resultado = {
  resultado: string;
  nota_final: number;
  nota_minima: number | null;
  parciais: Record<string, number | undefined>;
  parecer: string;
};

const TOM_DO_RESULTADO: Record<string, string> = {
  APTO: "aprovado",
  INAPTO_REQUISITO: "reprovado",
  INAPTO_NOTA: "pendente",
};
const OPCOES_DE_NIVEL = NIVEIS as unknown as ReadonlyArray<
  readonly [string, string]
>;
const OPCOES_DE_SITUACAO = SITUACOES_DO_BLOCO as unknown as ReadonlyArray<
  readonly [string, string]
>;
const OPCOES_DE_TITULO = TITULOS_ACADEMICOS as unknown as ReadonlyArray<
  readonly [string, string]
>;
const PARCIAL = PARCIAL_DO_TIPO as Readonly<Record<string, string | undefined>>;

export default function CorpoDaPrevia({
  regra,
  notaMinima,
  candidato: c,
  aoMudarCandidato: setC,
  minimaDigitada,
  aoMudarMinima: setMinimaDigitada,
}: {
  regra: RegraAnalise;
  notaMinima: NotaMinima;
  candidato: Candidato;
  aoMudarCandidato: (c: Candidato) => void;
  minimaDigitada: number | null;
  aoMudarMinima: (v: number | null) => void;
}) {
  const minimaDaRegra = notaMinima?.nota_minima ?? null;
  const resultado = useMemo(
    () =>
      calcularAvaliacao(regra, c, {
        notaMinima: minimaDaRegra ?? minimaDigitada,
        notaMinimaPorNivel: (notaMinima?.nota_minima_por_nivel ?? {}) as Record<
          string,
          number
        >,
      }) as unknown as Resultado,
    [regra, c, minimaDaRegra, minimaDigitada, notaMinima],
  );
  const mudar = (caminho: Array<string | number>, valor: unknown) =>
    setC(comValor(c, caminho, valor) as Candidato);
  const vinculos = regra.blocos.find((b) => b.tipo === "VINCULOS");
  const casas = regra.casas_parecer ?? 1;
  const parciais = regra.blocos
    .map((b) => PARCIAL[b.tipo])
    .filter((p): p is string => Boolean(p));

  return (
    <div className="avd-previa-corpo">
      <div className="avd-previa-entrada">
        <fieldset className="avd-previa-secao">
          <legend>Vaga e candidato</legend>
          <div className="avd-previa-campos">
            <Escolha
              rotulo="Nível da vaga"
              valor={c.nivel}
              opcoes={OPCOES_DE_NIVEL}
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
                aoMudar={(v) =>
                  setMinimaDigitada(typeof v === "number" ? v : null)
                }
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
        </fieldset>

        <fieldset className="avd-previa-secao">
          <legend>Situação de cada bloco</legend>
          <ul className="avd-previa-blocos">
            {regra.blocos.map((b) => {
              const lancado = c.blocos[b.codigo] ?? {};
              const titulo = b.titulo || b.codigo;
              return (
                <li key={b.codigo} className="avd-previa-bloco">
                  <span className="avd-previa-bloco-titulo">{titulo}</span>
                  <select
                    aria-label={`Situação de ${titulo}`}
                    value={lancado.situacao ?? "CONFORME"}
                    onChange={(ev) =>
                      mudar(["blocos", b.codigo], {
                        ...lancado,
                        situacao: ev.target.value,
                      })
                    }
                  >
                    {OPCOES_DE_SITUACAO.map(([s, r]) => (
                      <option key={s} value={s}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {(b.motivos ?? []).length ? (
                    <select
                      aria-label={`Motivo de ${titulo}`}
                      value={lancado.motivos?.[0] ?? ""}
                      onChange={(ev) =>
                        mudar(["blocos", b.codigo], {
                          ...lancado,
                          motivos: ev.target.value ? [ev.target.value] : [],
                        })
                      }
                    >
                      <option value="">Sem motivo</option>
                      {(b.motivos ?? []).map((m) => (
                        <option key={m.codigo} value={m.codigo}>
                          {m.texto || m.codigo}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>

        <fieldset className="avd-previa-secao">
          <legend>Títulos e cursos</legend>
          {c.titulos.map((t, i) => (
            <div className="avd-previa-linha" key={`t${i}`}>
              <Escolha
                rotulo="Título"
                valor={t.titulo}
                opcoes={OPCOES_DE_TITULO}
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
          {c.cursos.map((curso, i) => (
            <div className="avd-previa-linha" key={`c${i}`}>
              <CampoNumero
                rotulo="Horas do curso"
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
          <div className="ui-acoes">
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
            <BotaoMais
              aoClicar={() =>
                mudar(["cursos"], [...c.cursos, { horas: 40, aceito: true }])
              }
            >
              Curso
            </BotaoMais>
          </div>
        </fieldset>

        {vinculos ? (
          <fieldset className="avd-previa-secao">
            <legend>Vínculos</legend>
            {c.vinculos.map((v, i) => (
              <div className="avd-previa-linha" key={i}>
                <Escolha
                  rotulo="Categoria"
                  valor={v.categoria}
                  opcoes={(vinculos.categorias ?? []).map(
                    (x) => [x.codigo, x.rotulo || x.codigo] as const,
                  )}
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
            <div className="ui-acoes">
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
            </div>
            {vinculos.estagio_indigena?.ativo ? (
              <div className="avd-previa-campos">
                <CampoNumero
                  rotulo="Horas de estágio"
                  valor={c.estagio_horas}
                  aoMudar={(v) => mudar(["estagio_horas"], v)}
                />
              </div>
            ) : null}
          </fieldset>
        ) : null}

        {regra.observacoes_prontas.length ? (
          <fieldset className="avd-previa-secao">
            <legend>Observações prontas</legend>
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
                        : c.observacoes_prontas.filter((x) => x !== o.codigo),
                    )
                  }
                />
              ))}
            </div>
          </fieldset>
        ) : null}
      </div>

      {resultado ? (
        <aside
          className="avd-previa-resultado"
          aria-live="polite"
          aria-label="Resultado do candidato fictício"
          data-resultado={resultado.resultado}
        >
          <p className="avd-previa-rotulo">Nota final</p>
          <div className="avd-nota">
            <span className="avd-nota-valor">
              {numeroDoParecer(resultado.nota_final, casas)}
            </span>
            <Selo tom={TOM_DO_RESULTADO[resultado.resultado]}>
              {rotuloDe(RESULTADOS, resultado.resultado)}
            </Selo>
          </div>
          <dl className="avd-parciais">
            {parciais.map((p) => (
              <div key={p}>
                <dt>{rotuloDe(PARCIAIS, p)}</dt>
                <dd>{numeroDoParecer(resultado.parciais[p] ?? 0, casas)}</dd>
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
        </aside>
      ) : null}
    </div>
  );
}
