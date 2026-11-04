import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  CATALOGO_DE_BLOCOS,
  DECISOES,
  ETAPAS_DO_PARECER,
  REFERENCIAS_DO_EDITAL,
  blocoVazio,
  blocosDaEtapa,
  comporParecer,
  rascunhoInicial,
  textoDoParecer,
  textosDoModelo,
  type BlocoDoParecer,
  type CodigoDoBloco,
  type Decisao,
  type EtapaDoParecer,
  type FonteDoCampo,
  type FonteDoParecer,
  type RascunhoDoParecer,
  type TextosDoModelo,
} from "../../../lib/parecer-em-blocos.ts";
import {
  Campo,
  Carregando,
  ErroAoCarregar,
  EstadoVazio,
  Modal,
  Segmentado,
  Selo,
  classes,
} from "../../../ui/index.ts";
import { dadosFicticios } from "./dados-ficticios.ts";
import { FormularioDoBloco, SeloDaFonte, type Mudar } from "./blocos.tsx";
import { DocumentoDoParecerVisto, imprimirDocumento } from "./documento.tsx";
import "./parecer-em-blocos.css";

/*
  "Montar parecer" (PROTÓTIPO, docs/recursos/parecer-em-blocos.md): o
  formulário do simulador da Saúde Indígena à esquerda, em cartões, e a prévia
  do parecer à direita, refeita a cada mudança (comporParecer). O que o
  MONITORA já sabe vem preenchido, com o selo de onde veio ("da ficha", "do
  cronograma"…). Cada bloco é de uma etapa: hoje só a Avaliação documental.

  No protótipo a fonte é fictícia e nada grava: "Salvar versão" fica
  desligado. Copiar e Imprimir funcionam.
*/

type Fontes = Partial<Record<string, FonteDoCampo>>;

interface Estado {
  rascunho: RascunhoDoParecer;
  fontes: Fontes;
  avisos: string[];
  textos: TextosDoModelo;
}

function Cartao({
  titulo,
  fonte,
  acoes,
  children,
  tour,
}: {
  titulo: string;
  fonte?: FonteDoCampo | undefined;
  acoes?: ReactNode;
  children: ReactNode;
  tour?: string;
}) {
  return (
    <section
      className="ui-card parecer-cartao"
      aria-label={titulo}
      data-tour={tour}
    >
      <header className="parecer-cartao__topo">
        <h3>{titulo}</h3>
        <SeloDaFonte fonte={fonte} />
        {acoes ? <span className="parecer-cartao__acoes">{acoes}</span> : null}
      </header>
      {children}
    </section>
  );
}

const Rotulo = ({
  texto,
  fonte,
}: {
  texto: string;
  fonte?: FonteDoCampo | undefined;
}) => (
  <>
    {texto} <SeloDaFonte fonte={fonte} />
  </>
);

export interface PropriedadesDoEditorDoParecer {
  fonte: FonteDoParecer;
  recursoId: string | number;
  /** Fecha a montagem (o "x" do topo); sem ele, não há botão de fechar. */
  aoFechar?: () => void;
  /** Dados fictícios: o selo "Protótipo" e o salvar desligado. */
  prototipo?: boolean;
  tituloId?: string;
  /** Avisa cada mudança do rascunho (a comparação da página do protótipo). */
  aoMudarRascunho?: (rascunho: RascunhoDoParecer) => void;
}

export function EditorDoParecer({
  fonte,
  recursoId,
  aoFechar,
  prototipo = true,
  tituloId = "parecerMontagemTitulo",
  aoMudarRascunho,
}: PropriedadesDoEditorDoParecer) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [visao, setVisao] = useState<"formulario" | "previa">("formulario");
  const [copiado, setCopiado] = useState(false);
  const previa = useRef<HTMLElement>(null);

  useEffect(() => {
    let vivo = true;
    fonte
      .carregar(recursoId)
      .then((dados) => {
        if (!vivo) return;
        const inicial = rascunhoInicial(dados);
        setEstado({ ...inicial, textos: textosDoModelo(dados.textos) });
        setErro("");
      })
      .catch(
        (e: unknown) => vivo && setErro(String((e as Error)?.message || e)),
      );
    return () => {
      vivo = false;
    };
  }, [fonte, recursoId, tentativa]);

  const documento = useMemo(
    () => (estado ? comporParecer(estado.rascunho, estado.textos) : null),
    [estado],
  );
  useEffect(() => {
    if (estado) aoMudarRascunho?.(estado.rascunho);
  }, [estado, aoMudarRascunho]);

  if (erro)
    return (
      <ErroAoCarregar
        oQue="os dados do parecer"
        mensagem={erro}
        aoTentar={() => setTentativa((n) => n + 1)}
      />
    );
  if (!estado || !documento) return <Carregando className="ui-secao-texto" />;

  const { rascunho: r, fontes, avisos } = estado;
  const mudar = (alterar: (rascunho: RascunhoDoParecer) => void) =>
    setEstado((atual) => {
      if (!atual) return atual;
      const rascunho = structuredClone(atual.rascunho);
      alterar(rascunho);
      return { ...atual, rascunho };
    });
  const mudarBloco =
    (codigo: CodigoDoBloco): Mudar<BlocoDoParecer> =>
    (alterar) =>
      mudar((x) => {
        const bloco = x.blocos.find((b) => b.codigo === codigo);
        if (bloco) alterar(bloco);
      });
  const a = r.admissibilidade;
  const c = r.conclusao;
  const etapa = ETAPAS_DO_PARECER.find((e) => e.valor === r.etapa)!;
  const doCatalogo = blocosDaEtapa(r.etapa);
  const fora = doCatalogo.filter(
    (d) => !r.blocos.some((b) => b.codigo === d.codigo),
  );
  const titulo = `Parecer — ${r.cabecalho.candidato || "recurso"}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoDoParecer(documento!));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div
      className="parecer-montagem"
      data-visao={visao}
      data-tour="parecer-montagem"
    >
      <header className="parecer-montagem__topo">
        <div className="parecer-montagem__titulo">
          <span className="ui-gaveta-sobretitulo">
            Recurso · {r.cabecalho.edital || "edital"} ·{" "}
            {r.cabecalho.vaga || "vaga"}
          </span>
          <h2 id={tituloId}>
            Montar parecer{" "}
            {prototipo ? (
              <Selo tom="pendente" titulo="Dados fictícios; nada é gravado">
                Protótipo
              </Selo>
            ) : null}
          </h2>
        </div>
        <Segmentado<EtapaDoParecer>
          rotulo="Etapa do recurso"
          className="parecer-montagem__etapa"
          opcoes={ETAPAS_DO_PARECER.map((e) => ({
            valor: e.valor,
            rotulo: e.rotulo,
          }))}
          valor={r.etapa}
          aoMudar={(v) => mudar((x) => void (x.etapa = v))}
        />
        <Segmentado
          rotulo="Mostrar"
          className="parecer-montagem__visao"
          opcoes={[
            { valor: "formulario", rotulo: "Formulário" },
            { valor: "previa", rotulo: "Prévia" },
          ]}
          valor={visao}
          aoMudar={(v) => setVisao(v as typeof visao)}
        />
        {aoFechar ? (
          <button
            type="button"
            className="ui-gaveta-fechar"
            aria-label="Fechar a montagem do parecer"
            title="Fechar"
            onClick={aoFechar}
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        ) : null}
      </header>

      <div className="parecer-montagem__corpo">
        <div className="parecer-montagem__formulario">
          {!etapa.disponivel ? (
            <EstadoVazio>
              Os blocos da Entrevista entram na próxima etapa.
            </EstadoVazio>
          ) : (
            <>
              <Cartao titulo="Cabeçalho" fonte={fontes["cabecalho.candidato"]}>
                <div className="ui-grade-de-campos">
                  {(
                    [
                      ["processo", "Processo de referência"],
                      ["edital", "Nº do edital"],
                      ["unidade", "DSEI / CASAI"],
                      ["candidato", "Candidato(a)"],
                      ["codigo", "Código Empregare"],
                      ["vaga", "Vaga"],
                    ] as const
                  ).map(([campo, rotulo]) => (
                    <Campo
                      key={campo}
                      rotulo={
                        <Rotulo
                          texto={rotulo}
                          fonte={fontes[`cabecalho.${campo}`]}
                        />
                      }
                    >
                      <input
                        value={r.cabecalho[campo]}
                        onChange={(e) =>
                          mudar(
                            (x) => void (x.cabecalho[campo] = e.target.value),
                          )
                        }
                      />
                    </Campo>
                  ))}
                </div>
              </Cartao>

              <Cartao titulo="2. Relatório" fonte={fontes.alegacoes}>
                <Campo rotulo="Resumo das alegações do candidato" largo>
                  <textarea
                    rows={3}
                    maxLength={4000}
                    value={r.alegacoes}
                    onChange={(e) =>
                      mudar((x) => void (x.alegacoes = e.target.value))
                    }
                  />
                </Campo>
              </Cartao>

              <Cartao
                titulo="3. Admissibilidade"
                fonte={fontes["admissibilidade.prazo"]}
              >
                <div className="ui-grade-de-campos">
                  <Campo
                    rotulo={
                      <Rotulo
                        texto="Prazo: de"
                        fonte={fontes["admissibilidade.prazo"]}
                      />
                    }
                  >
                    <input
                      type="date"
                      value={a.prazo_de}
                      onChange={(e) =>
                        mudar(
                          (x) =>
                            void (x.admissibilidade.prazo_de = e.target.value),
                        )
                      }
                    />
                  </Campo>
                  <Campo rotulo="até">
                    <input
                      type="date"
                      value={a.prazo_ate}
                      onChange={(e) =>
                        mudar(
                          (x) =>
                            void (x.admissibilidade.prazo_ate = e.target.value),
                        )
                      }
                    />
                  </Campo>
                  <Campo
                    rotulo={
                      <Rotulo
                        texto="Enviado em"
                        fonte={fontes["admissibilidade.envio"]}
                      />
                    }
                  >
                    <input
                      type="date"
                      value={a.envio_data}
                      onChange={(e) =>
                        mudar(
                          (x) =>
                            void (x.admissibilidade.envio_data =
                              e.target.value),
                        )
                      }
                    />
                  </Campo>
                  <Campo rotulo="às">
                    <input
                      type="time"
                      value={a.envio_hora}
                      onChange={(e) =>
                        mudar(
                          (x) =>
                            void (x.admissibilidade.envio_hora =
                              e.target.value),
                        )
                      }
                    />
                  </Campo>
                </div>
                <div className="parecer-escolhas">
                  <span className="parecer-escolhas__rotulo">
                    Tempestividade{" "}
                    <SeloDaFonte fonte={fontes["admissibilidade.tempestivo"]} />
                  </span>
                  <Segmentado
                    rotulo="Tempestividade"
                    opcoes={[
                      { valor: "sim", rotulo: "Tempestivo" },
                      { valor: "nao", rotulo: "Intempestivo" },
                    ]}
                    valor={a.tempestivo ? "sim" : "nao"}
                    aoMudar={(v) =>
                      mudar((x) => {
                        x.admissibilidade.tempestivo = v === "sim";
                        if (v === "nao") {
                          x.admissibilidade.atende_periodo = false;
                          x.conclusao.decisao = "INDEFERIMENTO";
                        }
                      })
                    }
                  />
                  {a.tempestivo ? (
                    <>
                      <span className="parecer-escolhas__rotulo">Período</span>
                      <Segmentado
                        rotulo="Atendimento ao período"
                        opcoes={[
                          { valor: "sim", rotulo: "Atendendo" },
                          { valor: "nao", rotulo: "Não atendendo" },
                        ]}
                        valor={a.atende_periodo ? "sim" : "nao"}
                        aoMudar={(v) =>
                          mudar(
                            (x) =>
                              void (x.admissibilidade.atende_periodo =
                                v === "sim"),
                          )
                        }
                      />
                      <span className="parecer-escolhas__rotulo">Forma</span>
                      <Segmentado
                        rotulo="Admissão quanto à forma"
                        opcoes={[
                          { valor: "sim", rotulo: "Admitido" },
                          { valor: "nao", rotulo: "Não admitido" },
                        ]}
                        valor={a.admitido ? "sim" : "nao"}
                        aoMudar={(v) =>
                          mudar(
                            (x) =>
                              void (x.admissibilidade.admitido = v === "sim"),
                          )
                        }
                      />
                      <span className="parecer-escolhas__rotulo">
                        Requisitos formais
                      </span>
                      <Segmentado
                        rotulo="Requisitos formais"
                        opcoes={[
                          { valor: "sim", rotulo: "Atende" },
                          { valor: "nao", rotulo: "Não atende" },
                        ]}
                        valor={a.atende_forma ? "sim" : "nao"}
                        aoMudar={(v) =>
                          mudar(
                            (x) =>
                              void (x.admissibilidade.atende_forma =
                                v === "sim"),
                          )
                        }
                      />
                      <span className="parecer-escolhas__rotulo">
                        Fundamentação
                      </span>
                      <Segmentado
                        rotulo="Fundamentação preliminar"
                        opcoes={[
                          { valor: "sim", rotulo: "Adequada" },
                          { valor: "nao", rotulo: "Ausente" },
                        ]}
                        valor={a.fundamentacao_adequada ? "sim" : "nao"}
                        aoMudar={(v) =>
                          mudar(
                            (x) =>
                              void (x.admissibilidade.fundamentacao_adequada =
                                v === "sim"),
                          )
                        }
                      />
                    </>
                  ) : null}
                </div>
              </Cartao>

              {a.tempestivo ? (
                <>
                  {doCatalogo.map((def) => {
                    const bloco = r.blocos.find((b) => b.codigo === def.codigo);
                    if (!bloco) return null;
                    const requisitos = r.blocos.find(
                      (b) => b.codigo === "requisitos",
                    );
                    if (
                      def.codigo !== "requisitos" &&
                      requisitos?.codigo === "requisitos" &&
                      !requisitos.atendeu
                    )
                      return null;
                    return (
                      <Cartao
                        key={def.codigo}
                        titulo={
                          def.codigo === "requisitos"
                            ? `4. Análise de mérito · ${def.rotulo}`
                            : def.rotulo
                        }
                        fonte={fontes[`bloco.${def.codigo}`]}
                        tour={`parecer-bloco-${def.codigo}`}
                        acoes={
                          def.removivel ? (
                            <button
                              type="button"
                              className="btn secondary small"
                              onClick={() =>
                                mudar(
                                  (x) =>
                                    void (x.blocos = x.blocos.filter(
                                      (b) => b.codigo !== def.codigo,
                                    )),
                                )
                              }
                            >
                              <i
                                className="fa-solid fa-trash"
                                aria-hidden="true"
                              />{" "}
                              Tirar
                            </button>
                          ) : null
                        }
                      >
                        <FormularioDoBloco
                          bloco={bloco}
                          mudar={mudarBloco(def.codigo)}
                          referencias={r.referencias}
                          pontosPorMes={r.pontos_por_mes}
                        />
                      </Cartao>
                    );
                  })}
                  {fora.length ? (
                    <div
                      className="parecer-fora"
                      role="group"
                      aria-label="Blocos fora do parecer"
                    >
                      <span>Fora do parecer:</span>
                      {fora.map((d) => (
                        <button
                          key={d.codigo}
                          type="button"
                          className="ui-chip"
                          onClick={() =>
                            mudar(
                              (x) => void x.blocos.push(blocoVazio(d.codigo)),
                            )
                          }
                        >
                          <i className="fa-solid fa-plus" aria-hidden="true" />{" "}
                          {d.rotulo}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}

              <Cartao titulo="5. Conclusão" fonte={fontes["conclusao.decisao"]}>
                <div className="ui-grade-de-campos">
                  <Campo
                    rotulo={
                      <Rotulo
                        texto="Resultado do recurso"
                        fonte={fontes["conclusao.decisao"]}
                      />
                    }
                  >
                    <select
                      value={a.tempestivo ? c.decisao : "INDEFERIMENTO"}
                      disabled={!a.tempestivo}
                      onChange={(e) =>
                        mudar(
                          (x) =>
                            void (x.conclusao.decisao = e.target
                              .value as Decisao),
                        )
                      }
                    >
                      {DECISOES.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </Campo>
                  {a.tempestivo ? (
                    <Campo rotulo="Resultado preliminar">
                      <select
                        value={c.retificar ? "retificar" : "manter"}
                        onChange={(e) =>
                          mudar(
                            (x) =>
                              void (x.conclusao.retificar =
                                e.target.value === "retificar"),
                          )
                        }
                      >
                        <option value="manter">Manter</option>
                        <option value="retificar">Retificar</option>
                      </select>
                    </Campo>
                  ) : null}
                  {a.tempestivo && c.retificar ? (
                    <>
                      <Campo
                        rotulo={
                          <Rotulo
                            texto="Nota antiga"
                            fonte={fontes["conclusao.notas"]}
                          />
                        }
                      >
                        <input
                          inputMode="decimal"
                          value={c.nota_antiga}
                          onChange={(e) =>
                            mudar(
                              (x) =>
                                void (x.conclusao.nota_antiga = e.target.value),
                            )
                          }
                        />
                      </Campo>
                      <Campo
                        rotulo={
                          <Rotulo
                            texto="Nota nova"
                            fonte={fontes["conclusao.notas"]}
                          />
                        }
                      >
                        <input
                          inputMode="decimal"
                          value={c.nota_nova}
                          onChange={(e) =>
                            mudar(
                              (x) =>
                                void (x.conclusao.nota_nova = e.target.value),
                            )
                          }
                        />
                      </Campo>
                    </>
                  ) : null}
                </div>
              </Cartao>

              <Cartao titulo="Assinaturas">
                <div className="ui-grade-de-campos">
                  {r.assinaturas.map((g, i) => (
                    <div key={i} className="parecer-assinatura-campos">
                      <Campo
                        rotulo={
                          i === 0
                            ? "Primeiro gestor(a)"
                            : "Segundo gestor(a) · De acordo"
                        }
                      >
                        <input
                          value={g.nome}
                          onChange={(e) =>
                            mudar(
                              (x) =>
                                void (x.assinaturas[i]!.nome = e.target.value),
                            )
                          }
                        />
                      </Campo>
                      <Campo rotulo="Cargo">
                        <textarea
                          rows={2}
                          value={g.cargo}
                          onChange={(e) =>
                            mudar(
                              (x) =>
                                void (x.assinaturas[i]!.cargo = e.target.value),
                            )
                          }
                        />
                      </Campo>
                    </div>
                  ))}
                </div>
              </Cartao>

              <details
                className="ui-card parecer-cartao parecer-referencias"
                data-tour="parecer-referencias"
              >
                <summary>
                  <h3>Itens do edital citados</h3>
                  <span className="parecer-fonte" data-fonte="regras">
                    das Regras do edital
                  </span>
                </summary>
                <div className="ui-grade-de-campos">
                  {REFERENCIAS_DO_EDITAL.map((ref) => (
                    <Campo
                      key={ref.chave}
                      rotulo={
                        <Rotulo
                          texto={ref.rotulo}
                          fonte={fontes[`referencias.${ref.chave}`]}
                        />
                      }
                      dica={
                        r.referencias[ref.chave] === ref.padrao
                          ? "padrão do simulador"
                          : `padrão: ${ref.padrao}`
                      }
                    >
                      <input
                        value={r.referencias[ref.chave]}
                        onChange={(e) =>
                          mudar(
                            (x) =>
                              void (x.referencias[ref.chave] = e.target.value),
                          )
                        }
                      />
                    </Campo>
                  ))}
                </div>
              </details>
            </>
          )}
        </div>

        <div className="parecer-montagem__previa" aria-live="off">
          <DocumentoDoParecerVisto ref={previa} documento={documento} />
        </div>
      </div>

      <footer className="ui-barra-de-salvar parecer-montagem__rodape">
        {avisos.length ? (
          <details>
            <summary>
              <i className="fa-solid fa-circle-info" aria-hidden="true" />{" "}
              {avisos.length === 1 ? "1 aviso" : `${avisos.length} avisos`}
            </summary>
            <ul>
              {avisos.map((aviso) => (
                <li key={aviso}>
                  <span>{aviso}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <span className="parecer-montagem__resumo">
            {CATALOGO_DE_BLOCOS.filter((d) => d.etapa === r.etapa).length}{" "}
            blocos da {etapa.rotulo}
          </span>
        )}
        <div className="ui-acoes">
          <button
            type="button"
            className="btn secondary small"
            onClick={() => void copiar()}
          >
            <i
              className={classes("fa-solid", copiado ? "fa-check" : "fa-copy")}
              aria-hidden="true"
            />{" "}
            {copiado ? "Copiado" : "Copiar texto"}
          </button>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => imprimirDocumento(previa.current, titulo)}
          >
            <i className="fa-solid fa-print" aria-hidden="true" /> Imprimir /
            PDF
          </button>
          <button
            type="button"
            className="btn small"
            disabled={prototipo}
            title={prototipo ? "Protótipo: nada é gravado" : undefined}
          >
            <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Salvar
            versão
          </button>
        </div>
      </footer>
    </div>
  );
}

/** A montagem num modal de tela quase inteira, aberto da gaveta do recurso. */
export function MontarParecer(
  props: PropriedadesDoEditorDoParecer & { aoFechar: () => void },
) {
  return (
    <Modal
      rotuloId="parecerMontagemTitulo"
      aoFechar={props.aoFechar}
      fecharAoClicarFora={false}
      className="parecer-montagem-fundo"
      cartaoClassName="parecer-montagem-cartao"
    >
      <EditorDoParecer {...props} />
    </Modal>
  );
}

/** O protótipo aberto da gaveta: a montagem com a fonte fictícia (carregado sob demanda). */
export default function MontagemDoPrototipo({
  recursoId,
  aoFechar,
}: {
  recursoId: string | number;
  aoFechar: () => void;
}) {
  return (
    <MontarParecer
      fonte={dadosFicticios}
      recursoId={recursoId}
      aoFechar={aoFechar}
      prototipo
    />
  );
}
