import { useEffect, useState } from "react";
import {
  Aviso,
  BlocosEsqueleto,
  Campo,
  ErroAoCarregar,
  EstadoVazio,
  Selo,
} from "../../ui/index.ts";
import {
  conferirRegraDaTriagem,
  errosDaRegraDaTriagem,
  linhasDoTexto,
  NOME_DO_CRITERIO,
  obterRegraDaTriagem,
  salvarRegraDaTriagem,
} from "../../lib/triagem/regra-da-triagem.ts";
import type {
  ClienteDaRegra,
  ConfiguracaoDaTriagem,
  CriterioDeDesempate,
  EliminacaoAutomatica,
  LoteDaTriagem,
  RespostaDaRegraDaTriagem,
} from "../../lib/triagem/regra-da-triagem.ts";
import "./triagem.css";

/*
  A regra da Triagem do edital: a etapa 1 das Regras do edital (Editais ›
  Regras do edital), aberta também pelo "Editar nas Regras do edital" da tela
  da Triagem. Quem coordena o edital (ou o administrador global) edita e grava
  versão nova com motivo; a versão nova volta a "conferir" e outra pessoa da
  coordenação confere (dupla conferência, no banco). Quem não coordena vê a
  regra só para ler. Salvar não recalcula nada: a Triagem roda no fim do robô
  da Empregare ou no "Recalcular" (o 114/2026, congelado, não recalcula).
  Requisitos, nota, desempate e lote da Triagem moram só aqui (saíram da
  regra da Avaliação documental em 29/10/2026).
*/

const CRITERIOS = Object.keys(NOME_DO_CRITERIO) as CriterioDeDesempate[];
const OPCOES_DO_LOTE: readonly [keyof LoteDaTriagem, string][] = [
  ["inclui_cr", "Conta o cadastro reserva"],
  ["por_modalidade", "Lote por modalidade"],
  ["inclui_empatados", "Empatados no corte entram"],
  ["linha_anda", "A linha anda (repõe quem sai)"],
  ["publica_reposicao", "Publica a reposição"],
];
type CampoDaEliminacao = "coluna" | "coluna_prefixo" | "pergunta";
const CAMPOS_DA_ELIMINACAO: readonly [CampoDaEliminacao, string][] = [
  ["coluna", "Coluna exata"],
  ["coluna_prefixo", "Começo da coluna"],
  ["pergunta", "Pergunta"],
];

const copia = <T,>(valor: T): T => JSON.parse(JSON.stringify(valor)) as T;

function campoDa(e: EliminacaoAutomatica): CampoDaEliminacao {
  if (e.coluna) return "coluna";
  if (e.coluna_prefixo) return "coluna_prefixo";
  return "pergunta";
}

/* O que fica no JSON avançado: o que a tela não edita campo a campo. */
function avancadoDa(config: ConfiguracaoDaTriagem) {
  return JSON.stringify(
    {
      nota_declarada: config.nota?.nota_declarada ?? [],
      modalidade: config.modalidade ?? {},
      nivel: config.nivel ?? {},
    },
    null,
    2,
  );
}

export function EditorDaRegraDaTriagem({
  edital,
  cliente,
}: {
  edital: string;
  cliente: ClienteDaRegra | null | undefined;
}) {
  const [resposta, setResposta] = useState<RespostaDaRegraDaTriagem | null>(
    null,
  );
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [config, setConfig] = useState<ConfiguracaoDaTriagem | null>(null);
  const [avancado, setAvancado] = useState("");
  const [motivo, setMotivo] = useState("");
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [problemas, setProblemas] = useState<string[]>([]);
  const [ok, setOk] = useState("");

  useEffect(() => {
    let vivo = true;
    obterRegraDaTriagem(cliente, edital)
      .then((r) => {
        if (!vivo) return;
        setResposta(r);
        const base: ConfiguracaoDaTriagem = r.regra?.configuracao
          ? copia(r.regra.configuracao)
          : { formato: 1, lote: { base: "MULTIPLO_VAGAS", multiplo: 3 } };
        setConfig(base);
        setAvancado(avancadoDa(base));
      })
      .catch(
        (e: unknown) => vivo && setErro(String((e as Error)?.message || e)),
      );
    return () => {
      vivo = false;
    };
  }, [cliente, edital, tentativa]);

  const regra = resposta?.regra ?? null;
  const editavel = Boolean(resposta?.pode_coordenar);
  const mudar = (transformar: (c: ConfiguracaoDaTriagem) => void) =>
    setConfig((atual) => {
      if (!atual) return atual;
      const nova = copia(atual);
      transformar(nova);
      return nova;
    });
  const lote = config?.lote || {};
  const eliminacoes = config?.requisitos?.eliminacao_automatica || [];
  const criterios = config?.desempate?.criterios ?? ["IDOSO", "CANDIDATURA"];

  function montar(): ConfiguracaoDaTriagem | null {
    if (!config) return null;
    let extra: {
      nota_declarada?: unknown[];
      modalidade?: ConfiguracaoDaTriagem["modalidade"];
      nivel?: ConfiguracaoDaTriagem["nivel"];
    };
    try {
      extra = JSON.parse(avancado || "{}");
    } catch {
      setProblemas(["Avançado: o JSON não está válido."]);
      return null;
    }
    const final = copia(config);
    final.nota = {
      ...(final.nota || {}),
      nota_declarada: extra.nota_declarada ?? [],
    };
    if (extra.modalidade && Object.keys(extra.modalidade).length)
      final.modalidade = extra.modalidade;
    else delete final.modalidade;
    if (extra.nivel && Object.keys(extra.nivel).length)
      final.nivel = extra.nivel;
    else delete final.nivel;
    return final;
  }

  async function salvar() {
    setOk("");
    const final = montar();
    if (!final) return;
    const erros = errosDaRegraDaTriagem(final);
    if (motivo.trim().length < 10)
      erros.push("Informe o motivo da alteração (10 a 2.000 caracteres).");
    setProblemas(erros);
    if (erros.length) return;
    setEnviando(true);
    try {
      const nova = await salvarRegraDaTriagem(cliente, {
        edital,
        configuracao: final,
        versaoAtual: regra?.versao ?? 0,
        motivo: motivo.trim(),
        nome: nome.trim() || null,
      });
      setResposta((r) => (r ? { ...r, regra: nova } : r));
      setMotivo("");
      setNome("");
      setOk(
        `Versão ${nova?.versao ?? ""} salva. Falta outra pessoa da coordenação conferir.`,
      );
    } catch (e) {
      setProblemas([String((e as Error)?.message || e)]);
    } finally {
      setEnviando(false);
    }
  }

  async function conferir() {
    if (!regra) return;
    setOk("");
    setEnviando(true);
    try {
      const conferida = await conferirRegraDaTriagem(
        cliente,
        edital,
        regra.versao,
      );
      setResposta((r) => (r ? { ...r, regra: conferida } : r));
      setOk(`Versão ${regra.versao} conferida.`);
    } catch (e) {
      setProblemas([String((e as Error)?.message || e)]);
    } finally {
      setEnviando(false);
    }
  }

  /* Muda a ordem do desempate (sobe ou desce um critério já escolhido). */
  const moverCriterio = (criterio: CriterioDeDesempate, passo: -1 | 1) =>
    mudar((c) => {
      const atuais = [...(c.desempate?.criterios ?? criterios)];
      const de = atuais.indexOf(criterio);
      const para = de + passo;
      if (de < 0 || para < 0 || para >= atuais.length) return;
      [atuais[de], atuais[para]] = [atuais[para]!, atuais[de]!];
      c.desempate = { ...(c.desempate || {}), criterios: atuais };
    });
  const ligarCriterio = (criterio: CriterioDeDesempate, ligar: boolean) =>
    mudar((c) => {
      const atuais = c.desempate?.criterios ?? ["IDOSO", "CANDIDATURA"];
      c.desempate = {
        ...(c.desempate || {}),
        criterios: ligar
          ? [...atuais, criterio]
          : atuais.filter((x) => x !== criterio),
      };
    });
  // Os escolhidos, na ordem; depois, os que estão fora.
  const ordemDosCriterios = [
    ...criterios.filter((c) => CRITERIOS.includes(c)),
    ...CRITERIOS.filter((c) => !criterios.includes(c)),
  ];
  const mudarRequisito = (
    i: number,
    transformar: (item: EliminacaoAutomatica) => void,
  ) =>
    mudar((c) => {
      transformar(c.requisitos!.eliminacao_automatica![i]!);
    });

  return (
    <section
      className="triagem-regra-editor"
      aria-labelledby="regraDaTriagemTitulo"
      data-tour="regras-do-edital-triagem"
    >
      <header className="ui-card triagem-regra__topo">
        <h2 className="ui-titulo" id="regraDaTriagemTitulo">
          Regra da Triagem
        </h2>
        {regra ? (
          <>
            <span className="triagem-regra__versao">
              versão {regra.versao}
              {regra.nome ? ` · ${regra.nome}` : ""}
            </span>
            <Selo
              tom={regra.situacao === "CONFERIDA" ? "aprovado" : "pendente"}
            >
              {regra.situacao === "CONFERIDA" ? "Conferida" : "A conferir"}
            </Selo>
          </>
        ) : config ? (
          <Selo tom="pendente">Sem regra</Selo>
        ) : null}
      </header>

      {erro ? (
        <ErroAoCarregar
          oQue="a regra da Triagem"
          mensagem={erro}
          aoTentar={() => {
            setErro("");
            setTentativa((t) => t + 1);
          }}
        />
      ) : !config ? (
        <BlocosEsqueleto quantos={4} />
      ) : (
        <div className="triagem-regra-form">
          {!editavel ? (
            <Aviso tom="info">
              Só a coordenação do edital (ou o administrador global) altera a
              regra da Triagem. Aqui ela aparece só para leitura.
            </Aviso>
          ) : null}
          <fieldset
            className="triagem-regra-campos"
            disabled={!editavel || enviando}
          >
            <section
              className="ui-card triagem-regra-secao"
              aria-labelledby="trRequisitos"
            >
              <h3 className="ui-titulo" id="trRequisitos">
                Requisitos e motivos de eliminação
              </h3>
              {eliminacoes.length ? (
                <ol className="triagem-requisitos">
                  {eliminacoes.map((e, i) => {
                    const campo = campoDa(e);
                    return (
                      <li className="triagem-requisito" key={i}>
                        <div className="triagem-requisito__topo">
                          <span className="triagem-requisito__numero">
                            {i + 1}
                          </span>
                          <strong>{e.codigo || "Novo requisito"}</strong>
                          {editavel ? (
                            <button
                              type="button"
                              className="btn outline small triagem-requisito__tirar"
                              aria-label={`Tirar o requisito ${i + 1}`}
                              onClick={() =>
                                mudar((c) => {
                                  c.requisitos!.eliminacao_automatica!.splice(
                                    i,
                                    1,
                                  );
                                })
                              }
                            >
                              <i
                                className="fa-solid fa-trash"
                                aria-hidden="true"
                              />{" "}
                              Tirar
                            </button>
                          ) : null}
                        </div>
                        <div className="ui-grade-de-campos">
                          <Campo rotulo="Código">
                            <input
                              value={e.codigo}
                              onChange={(ev) =>
                                mudarRequisito(i, (item) => {
                                  item.codigo = ev.target.value.toUpperCase();
                                })
                              }
                            />
                          </Campo>
                          <Campo rotulo="Onde olhar">
                            <select
                              value={campo}
                              onChange={(ev) =>
                                mudarRequisito(i, (item) => {
                                  const texto = item[campo] || "";
                                  delete item.coluna;
                                  delete item.coluna_prefixo;
                                  delete item.pergunta;
                                  item[ev.target.value as CampoDaEliminacao] =
                                    texto;
                                })
                              }
                            >
                              {CAMPOS_DA_ELIMINACAO.map(([v, r]) => (
                                <option key={v} value={v}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </Campo>
                          <Campo rotulo="Texto" largo>
                            <input
                              value={e[campo] || ""}
                              onChange={(ev) =>
                                mudarRequisito(i, (item) => {
                                  item[campo] = ev.target.value;
                                })
                              }
                            />
                          </Campo>
                          <Campo rotulo="Elimina quando (um por linha)">
                            <textarea
                              rows={2}
                              value={(e.quando || []).join("\n")}
                              onChange={(ev) =>
                                mudarRequisito(i, (item) => {
                                  const lista = linhasDoTexto(ev.target.value);
                                  if (lista.length) item.quando = lista;
                                  else delete item.quando;
                                })
                              }
                            />
                          </Campo>
                          <Campo rotulo="Passa só se (um por linha)">
                            <textarea
                              rows={2}
                              value={(e.exceto || []).join("\n")}
                              onChange={(ev) =>
                                mudarRequisito(i, (item) => {
                                  const lista = linhasDoTexto(ev.target.value);
                                  if (lista.length) item.exceto = lista;
                                  else delete item.exceto;
                                })
                              }
                            />
                          </Campo>
                          <Campo rotulo="Motivo (vai para o comunicado)" largo>
                            <input
                              value={e.motivo}
                              onChange={(ev) =>
                                mudarRequisito(i, (item) => {
                                  item.motivo = ev.target.value;
                                })
                              }
                            />
                          </Campo>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <EstadoVazio>
                  Sem requisitos: ninguém sai da Triagem por eles.
                </EstadoVazio>
              )}
              {editavel ? (
                <div className="ui-acoes">
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() =>
                      mudar((c) => {
                        c.requisitos = c.requisitos || {};
                        c.requisitos.eliminacao_automatica = [
                          ...(c.requisitos.eliminacao_automatica || []),
                          { codigo: "", pergunta: "", exceto: [], motivo: "" },
                        ];
                      })
                    }
                  >
                    <i className="fa-solid fa-plus" aria-hidden="true" />{" "}
                    Acrescentar requisito
                  </button>
                </div>
              ) : null}
            </section>

            <section
              className="ui-card triagem-regra-secao"
              aria-labelledby="trNota"
            >
              <h3 className="ui-titulo" id="trNota">
                Nota da lista
              </h3>
              <div className="ui-grade-de-campos">
                <Campo rotulo="Nota da lista e do corte">
                  <select
                    value={config.nota?.base_da_nota ?? ""}
                    onChange={(ev) =>
                      mudar((c) => {
                        c.nota = { ...(c.nota || {}) };
                        if (ev.target.value)
                          c.nota.base_da_nota = ev.target.value as
                            "DECLARADA" | "ART";
                        else delete c.nota.base_da_nota;
                      })
                    }
                  >
                    <option value="">Padrão (declarada, se configurada)</option>
                    <option value="DECLARADA">
                      Nota declarada recalculada
                    </option>
                    <option value="ART">ART da Empregare</option>
                  </select>
                </Campo>
                <Campo rotulo="Tolerância ART × declarada (pontos)">
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step="0.5"
                    value={config.nota?.divergencia_tolerancia ?? ""}
                    onChange={(ev) =>
                      mudar((c) => {
                        c.nota = { ...(c.nota || {}) };
                        if (ev.target.value === "")
                          delete c.nota.divergencia_tolerancia;
                        else
                          c.nota.divergencia_tolerancia = Number(
                            ev.target.value,
                          );
                      })
                    }
                  />
                </Campo>
              </div>
            </section>

            <section
              className="ui-card triagem-regra-secao"
              aria-labelledby="trDesempate"
            >
              <h3 className="ui-titulo" id="trDesempate">
                Desempate, na ordem
              </h3>
              <ol className="triagem-desempate" aria-labelledby="trDesempate">
                {ordemDosCriterios.map((criterio) => {
                  const posicao = criterios.indexOf(criterio);
                  const ligado = posicao >= 0;
                  return (
                    <li
                      key={criterio}
                      className="triagem-criterio"
                      data-criterio={criterio}
                      data-ligado={ligado ? "sim" : undefined}
                    >
                      <span className="triagem-criterio__ordem">
                        {ligado ? `${posicao + 1}º` : "—"}
                      </span>
                      <label className="triagem-criterio__nome">
                        <input
                          type="checkbox"
                          role="switch"
                          className="triagem-interruptor"
                          checked={ligado}
                          onChange={(ev) =>
                            ligarCriterio(criterio, ev.target.checked)
                          }
                        />
                        {NOME_DO_CRITERIO[criterio]}
                      </label>
                      {ligado && editavel ? (
                        <span className="triagem-criterio__setas">
                          <button
                            type="button"
                            className="btn outline small"
                            aria-label={`Subir ${NOME_DO_CRITERIO[criterio]}`}
                            disabled={posicao === 0}
                            onClick={() => moverCriterio(criterio, -1)}
                          >
                            <i
                              className="fa-solid fa-arrow-up"
                              aria-hidden="true"
                            />
                          </button>
                          <button
                            type="button"
                            className="btn outline small"
                            aria-label={`Descer ${NOME_DO_CRITERIO[criterio]}`}
                            disabled={posicao === criterios.length - 1}
                            onClick={() => moverCriterio(criterio, 1)}
                          >
                            <i
                              className="fa-solid fa-arrow-down"
                              aria-hidden="true"
                            />
                          </button>
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              {criterios.includes("EXPERIENCIA_DECLARADA") ? (
                <div className="ui-grade-de-campos">
                  <Campo rotulo="Pergunta da experiência declarada" largo>
                    <input
                      value={
                        Array.isArray(config.desempate?.pergunta_experiencia)
                          ? config.desempate?.pergunta_experiencia.join(" | ")
                          : config.desempate?.pergunta_experiencia || ""
                      }
                      onChange={(ev) =>
                        mudar((c) => {
                          const partes = ev.target.value
                            .split("|")
                            .map((p) => p.trim())
                            .filter(Boolean);
                          c.desempate = {
                            ...(c.desempate || {}),
                            pergunta_experiencia:
                              partes.length > 1 ? partes : partes[0] || null,
                          };
                        })
                      }
                    />
                  </Campo>
                </div>
              ) : null}
            </section>

            <section
              className="ui-card triagem-regra-secao"
              aria-labelledby="trLote"
            >
              <h3 className="ui-titulo" id="trLote">
                Formação do lote
              </h3>
              <div className="ui-grade-de-campos">
                <Campo rotulo="Tamanho do lote">
                  <select
                    value={String(lote.base || "MULTIPLO_VAGAS")}
                    onChange={(ev) =>
                      mudar((c) => {
                        c.lote = { ...(c.lote || {}), base: ev.target.value };
                      })
                    }
                  >
                    <option value="MULTIPLO_VAGAS">Múltiplo das vagas</option>
                    <option value="FIXO">Número fixo por vaga</option>
                    <option value="NOTA_MINIMA">
                      Todos acima da nota mínima
                    </option>
                  </select>
                </Campo>
                {(
                  [
                    ["MULTIPLO_VAGAS", "multiplo", "Múltiplo"],
                    ["FIXO", "fixo", "Inscritos por vaga"],
                    ["NOTA_MINIMA", "nota_minima", "Nota mínima"],
                  ] as const
                )
                  .filter(([base]) => (lote.base || "MULTIPLO_VAGAS") === base)
                  .map(([, chave, rotulo]) => (
                    <Campo key={chave} rotulo={rotulo}>
                      <input
                        type="number"
                        min={0}
                        value={(lote[chave] as number | null | undefined) ?? ""}
                        onChange={(ev) =>
                          mudar((c) => {
                            c.lote = {
                              ...(c.lote || {}),
                              [chave]:
                                ev.target.value === ""
                                  ? null
                                  : Number(ev.target.value),
                            };
                          })
                        }
                      />
                    </Campo>
                  ))}
                <Campo rotulo="Item do edital">
                  <input
                    value={lote.item_edital || ""}
                    maxLength={40}
                    onChange={(ev) =>
                      mudar((c) => {
                        c.lote = {
                          ...(c.lote || {}),
                          item_edital: ev.target.value || null,
                        };
                      })
                    }
                  />
                </Campo>
              </div>
              <div
                className="triagem-opcoes"
                role="group"
                aria-label="Opções do lote"
              >
                {OPCOES_DO_LOTE.map(([chave, rotulo]) => (
                  <label key={chave} className="triagem-opcao">
                    <input
                      type="checkbox"
                      role="switch"
                      className="triagem-interruptor"
                      checked={
                        chave === "inclui_empatados" || chave === "linha_anda"
                          ? lote[chave] !== false
                          : Boolean(lote[chave])
                      }
                      onChange={(ev) =>
                        mudar((c) => {
                          c.lote = {
                            ...(c.lote || {}),
                            [chave]: ev.target.checked,
                          };
                        })
                      }
                    />
                    {rotulo}
                  </label>
                ))}
              </div>
            </section>

            <details className="ui-card triagem-regra-secao triagem-avancado">
              <summary>
                <i className="fa-solid fa-sliders" aria-hidden="true" />{" "}
                Avançado: nota declarada, modalidade (cotas) e nível da vaga
              </summary>
              <Campo
                rotulo="JSON"
                dica="nota_declarada (perguntas e pontos), modalidade (perguntas, acúmulo, percentuais) e nivel (níveis por cargo e padrão)."
                largo
              >
                <textarea
                  rows={12}
                  spellCheck={false}
                  value={avancado}
                  onChange={(ev) => setAvancado(ev.target.value)}
                />
              </Campo>
            </details>
          </fieldset>

          {regra?.versoes?.length ? (
            <details className="ui-card triagem-regra-secao triagem-avancado">
              <summary>
                <i
                  className="fa-solid fa-clock-rotate-left"
                  aria-hidden="true"
                />{" "}
                Histórico ({regra.versoes.length})
              </summary>
              <ol className="triagem-historico">
                {regra.versoes.map((v) => (
                  <li key={v.versao}>
                    <strong>v{v.versao}</strong>
                    {v.nome ? ` · ${v.nome}` : ""}
                    {v.criada_em
                      ? ` · ${new Date(v.criada_em).toLocaleString("pt-BR")}`
                      : ""}
                    {v.motivo ? (
                      <div className="ui-texto-suave">{v.motivo}</div>
                    ) : null}
                  </li>
                ))}
              </ol>
            </details>
          ) : null}

          {problemas.length ? (
            <Aviso tom="danger" papel="alert">
              <ul>
                {problemas.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Aviso>
          ) : null}
          {ok ? <Aviso tom="info">{ok}</Aviso> : null}

          {editavel ? (
            <div
              className="ui-card triagem-regra-salvar"
              role="group"
              aria-labelledby="trSalvar"
            >
              <h3 className="ui-titulo" id="trSalvar">
                Salvar versão nova
              </h3>
              <div className="triagem-regra-salvar__campos">
                <Campo rotulo="Motivo da alteração" obrigatorio>
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={motivo}
                    disabled={enviando}
                    onChange={(ev) => setMotivo(ev.target.value)}
                  />
                </Campo>
                <Campo rotulo="Nome da versão (opcional)">
                  <input
                    value={nome}
                    maxLength={80}
                    disabled={enviando}
                    onChange={(ev) => setNome(ev.target.value)}
                  />
                </Campo>
                <div className="ui-acoes triagem-regra-salvar__acoes">
                  {regra && regra.situacao !== "CONFERIDA" ? (
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={enviando}
                      onClick={() => void conferir()}
                    >
                      Conferir versão {regra.versao}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn"
                    disabled={enviando}
                    onClick={() => void salvar()}
                  >
                    {enviando ? "Salvando…" : "Salvar versão nova"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
