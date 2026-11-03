import type { ReactNode } from "react";
import {
  CRITERIOS_DA_EXPERIENCIA,
  DOCUMENTOS_DA_ALDEIA,
  DOCUMENTOS_DO_QUILOMBOLA,
  MOTIVOS_DA_FORMACAO,
  NIVEIS_DA_VAGA,
  OPCOES_DO_PCD,
  QUADROS_DA_EXPERIENCIA,
  ROTULO_DA_FONTE,
  TEMPOS_MINIMOS,
  TITULOS_POR_NIVEL,
  mesesDaExperiencia,
  novaExperiencia,
  pontosDoParecer,
  preencher,
  totalSemSobreposicao,
  type BlocoDeExperiencia,
  type BlocoDeFormacao,
  type BlocoDeHeteroidentificacao,
  type BlocoDePcd,
  type BlocoDeRequisitos,
  type BlocoDoParecer,
  type BlocoIndigena,
  type BlocoQuilombola,
  type ExperienciaDoParecer,
  type FonteDoCampo,
  type ReferenciasDoEdital,
} from "../../../lib/parecer-em-blocos.ts";
import { Campo, Segmentado } from "../../../ui/index.ts";

/*
  Os formulários de cada bloco do parecer, um cartão por bloco, com os
  controles do simulador (as mesmas opções, os mesmos textos). Cada bloco
  muda só o próprio pedaço do rascunho (`mudar`).
*/

export type Mudar<B> = (alterar: (bloco: B) => void) => void;

export function SeloDaFonte({ fonte }: { fonte?: FonteDoCampo | undefined }) {
  if (!fonte) return null;
  return (
    <span className="parecer-fonte" data-fonte={fonte}>
      {ROTULO_DA_FONTE[fonte]}
    </span>
  );
}

export function Marca({
  marcado,
  aoMudar,
  children,
}: {
  marcado: boolean;
  aoMudar: (marcado: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="parecer-marca">
      <input
        type="checkbox"
        checked={marcado}
        onChange={(evento) => aoMudar(evento.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

function Adicional({
  valor,
  aoMudar,
}: {
  valor: string;
  aoMudar: (v: string) => void;
}) {
  return (
    <Campo rotulo="Texto adicional ao parecer" largo>
      <textarea
        rows={2}
        value={valor}
        maxLength={4000}
        onChange={(evento) => aoMudar(evento.target.value)}
      />
    </Campo>
  );
}

const comRefs = (texto: string, referencias: ReferenciasDoEdital) =>
  preencher(
    texto,
    Object.fromEntries(
      Object.entries(referencias).map(([k, v]) => [`ref_${k}`, v]),
    ),
  )
    .map((t) => t.texto)
    .join("");

/* ── Requisitos eliminatórios ─────────────────────────────────────────── */
function Requisitos({
  bloco: b,
  mudar,
  referencias,
}: {
  bloco: BlocoDeRequisitos;
  mudar: Mudar<BlocoDeRequisitos>;
  referencias: ReferenciasDoEdital;
}) {
  const ref = `item ${referencias.identificacao}, alínea “${referencias.identificacao_alinea}”`;
  return (
    <div className="parecer-bloco-corpo">
      <Segmentado
        rotulo="Requisitos eliminatórios"
        opcoes={[
          { valor: "sim", rotulo: "Atendeu" },
          { valor: "nao", rotulo: "Não atendeu" },
        ]}
        valor={b.atendeu ? "sim" : "nao"}
        aoMudar={(v) => mudar((x) => void (x.atendeu = v === "sim"))}
      />
      {b.atendeu ? null : (
        <div className="parecer-marcas">
          <Marca
            marcado={b.identificacao}
            aoMudar={(v) => mudar((x) => void (x.identificacao = v))}
          >
            Não apresentou documento de identificação oficial com foto, válido e
            legível ({ref})
          </Marca>
          <Marca
            marcado={b.identificacao_desacordo}
            aoMudar={(v) => mudar((x) => void (x.identificacao_desacordo = v))}
          >
            Em desacordo com o {ref}: identidade oficial com foto (frente e
            verso)
          </Marca>
          <Marca
            marcado={b.diploma}
            aoMudar={(v) => mudar((x) => void (x.diploma = v))}
          >
            Não apresentou diploma ou certificado de conclusão exigido pela vaga
          </Marca>
          <div className="parecer-marca-com-campo">
            <Marca
              marcado={b.experiencia_minima}
              aoMudar={(v) => mudar((x) => void (x.experiencia_minima = v))}
            >
              Não comprovou a experiência mínima na área
            </Marca>
            <select
              aria-label="Experiência mínima"
              value={b.tempo_minimo}
              onChange={(e) =>
                mudar((x) => void (x.tempo_minimo = e.target.value))
              }
            >
              {TEMPOS_MINIMOS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="parecer-marca-com-campo">
            <Marca
              marcado={b.experiencia_documentacao}
              aoMudar={(v) =>
                mudar((x) => void (x.experiencia_documentacao = v))
              }
            >
              Não comprovou de maneira adequada a documentação da experiência
              mínima
            </Marca>
            <select
              aria-label="Experiência mínima da documentação"
              value={b.tempo_minimo_documentacao}
              onChange={(e) =>
                mudar(
                  (x) => void (x.tempo_minimo_documentacao = e.target.value),
                )
              }
            >
              {TEMPOS_MINIMOS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Formação acadêmica complementar ──────────────────────────────────── */
function Formacao({
  bloco: b,
  mudar,
}: {
  bloco: BlocoDeFormacao;
  mudar: Mudar<BlocoDeFormacao>;
}) {
  const titulos = TITULOS_POR_NIVEL[b.nivel] ?? [];
  const total = titulos
    .filter((t) => b.titulos.includes(t.id))
    .reduce((s, t) => s + t.pontos, 0);
  return (
    <div className="parecer-bloco-corpo">
      <div className="ui-grade-de-campos">
        <Campo rotulo="Situação">
          <select
            value={b.situacao}
            onChange={(e) =>
              mudar(
                (x) =>
                  void (x.situacao = e.target
                    .value as BlocoDeFormacao["situacao"]),
              )
            }
          >
            <option value="comprovada">Formação comprovada</option>
            <option value="nao_apresentada">Formação não apresentada</option>
            <option value="invalidada">Formação invalidada</option>
          </select>
        </Campo>
        {b.situacao === "comprovada" ? (
          <Campo rotulo="Nível da vaga">
            <select
              value={b.nivel}
              onChange={(e) =>
                mudar((x) => {
                  x.nivel = e.target.value as BlocoDeFormacao["nivel"];
                  x.titulos = [];
                })
              }
            >
              {NIVEIS_DA_VAGA.map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </Campo>
        ) : null}
        {b.situacao === "invalidada" ? (
          <Campo rotulo="Motivo" largo>
            <select
              value={b.motivo}
              onChange={(e) =>
                mudar(
                  (x) =>
                    void (x.motivo = e.target
                      .value as BlocoDeFormacao["motivo"]),
                )
              }
            >
              {MOTIVOS_DA_FORMACAO.map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </select>
          </Campo>
        ) : null}
      </div>
      {b.situacao === "comprovada" ? (
        <fieldset className="parecer-marcas">
          <legend>Títulos válidos (cumulativos)</legend>
          {titulos.map((t) => (
            <Marca
              key={t.id}
              marcado={b.titulos.includes(t.id)}
              aoMudar={(v) =>
                mudar((x) => {
                  x.titulos = v
                    ? [...x.titulos, t.id]
                    : x.titulos.filter((id) => id !== t.id);
                })
              }
            >
              <strong>+{pontosDoParecer(t.pontos)}</strong> {t.descricao}
            </Marca>
          ))}
          <p className="parecer-total">
            Total: {pontosDoParecer(total)} ponto(s)
          </p>
        </fieldset>
      ) : null}
      <Adicional
        valor={b.adicional}
        aoMudar={(v) => mudar((x) => void (x.adicional = v))}
      />
    </div>
  );
}

/* ── Experiência profissional ─────────────────────────────────────────── */
function ItemDaExperiencia({
  item: e,
  numero,
  mudar,
  remover,
  referencias,
  pontosPorMes,
}: {
  item: ExperienciaDoParecer;
  numero: number;
  mudar: Mudar<ExperienciaDoParecer>;
  remover: () => void;
  referencias: ReferenciasDoEdital;
  pontosPorMes: number;
}) {
  const meses = mesesDaExperiencia(e.inicio, e.fim);
  const marcado = (codigo: string) => e.criterios.includes(codigo);
  const alternar = (codigo: string, v: boolean) =>
    mudar((x) => {
      x.criterios = v
        ? [...x.criterios, codigo]
        : x.criterios.filter((c) => c !== codigo);
    });
  return (
    <li className="parecer-experiencia" data-atende={e.atende || undefined}>
      <div className="parecer-experiencia__topo">
        <strong>Experiência {numero}</strong>
        <Segmentado
          rotulo={`Resultado da experiência ${numero}`}
          opcoes={[
            { valor: "nao", rotulo: "Não atende" },
            { valor: "sim", rotulo: "Atende" },
          ]}
          valor={e.atende ? "sim" : "nao"}
          aoMudar={(v) => mudar((x) => void (x.atende = v === "sim"))}
        />
        <button
          type="button"
          className="btn secondary small"
          aria-label={`Remover a experiência ${numero}`}
          title="Remover"
          onClick={remover}
        >
          <i className="fa-solid fa-trash" aria-hidden="true" />
        </button>
      </div>
      <div className="ui-grade-de-campos">
        <Campo rotulo="Empresa ou instituição" largo>
          <input
            value={e.empresa}
            onChange={(ev) => mudar((x) => void (x.empresa = ev.target.value))}
          />
        </Campo>
        <Campo rotulo="Início">
          <input
            type="date"
            value={e.inicio}
            onChange={(ev) => mudar((x) => void (x.inicio = ev.target.value))}
          />
        </Campo>
        <Campo rotulo="Saída">
          <input
            type="date"
            value={e.fim}
            onChange={(ev) => mudar((x) => void (x.fim = ev.target.value))}
          />
        </Campo>
        <div className="parecer-meses" aria-live="polite">
          <span>{meses}</span>{" "}
          {meses === 1 ? "mês completo" : "meses completos"} ·{" "}
          {pontosDoParecer(meses * pontosPorMes)} pt
        </div>
      </div>
      {e.motivo_da_ficha ? (
        <p className="parecer-da-ficha">
          <SeloDaFonte fonte="ficha" /> Recusada na ficha: {e.motivo_da_ficha}
        </p>
      ) : null}
      {e.atende ? null : (
        <div className="parecer-criterios">
          {CRITERIOS_DA_EXPERIENCIA.map((g) => {
            const quantos = g.criterios.filter((c) => marcado(c.codigo)).length;
            return (
              <details key={g.grupo} open={quantos > 0 || undefined}>
                <summary>
                  {g.grupo}
                  {quantos ? (
                    <span className="ui-contagem">{quantos}</span>
                  ) : null}
                </summary>
                <div className="parecer-marcas">
                  {g.criterios.map((c) => (
                    <div key={c.codigo} className="parecer-marca-com-campo">
                      <Marca
                        marcado={marcado(c.codigo)}
                        aoMudar={(v) => alternar(c.codigo, v)}
                      >
                        {c.rotulo}
                      </Marca>
                      {c.codigo === "out_1" ? (
                        <select
                          aria-label="Quadro do edital"
                          value={e.quadro_relacao}
                          onChange={(ev) =>
                            mudar(
                              (x) => void (x.quadro_relacao = ev.target.value),
                            )
                          }
                        >
                          {QUADROS_DA_EXPERIENCIA.map(([nivel, n]) => (
                            <option key={nivel} value={nivel}>
                              Quadro {n} (nível {nivel.toLowerCase()}, item{" "}
                              {referencias.experiencia_quadro})
                            </option>
                          ))}
                        </select>
                      ) : null}
                      {c.codigo === "out_2" && marcado("out_2") ? (
                        <div className="parecer-subcampos">
                          <select
                            aria-label="Quadro do edital"
                            value={e.quadro_nivel}
                            onChange={(ev) =>
                              mudar(
                                (x) => void (x.quadro_nivel = ev.target.value),
                              )
                            }
                          >
                            {QUADROS_DA_EXPERIENCIA.slice(0, 2).map(
                              ([nivel, n]) => (
                                <option key={nivel} value={nivel}>
                                  Quadro {n} (nível {nivel.toLowerCase()})
                                </option>
                              ),
                            )}
                          </select>
                          <input
                            aria-label="Empresa"
                            placeholder="empresa"
                            value={e.empresa_nivel}
                            onChange={(ev) =>
                              mudar(
                                (x) => void (x.empresa_nivel = ev.target.value),
                              )
                            }
                          />
                          <input
                            aria-label="Cargo"
                            placeholder="cargo"
                            value={e.cargo_nivel}
                            onChange={(ev) =>
                              mudar(
                                (x) => void (x.cargo_nivel = ev.target.value),
                              )
                            }
                          />
                          <select
                            aria-label="Nível exigido"
                            value={e.nivel_exigido}
                            onChange={(ev) =>
                              mudar(
                                (x) => void (x.nivel_exigido = ev.target.value),
                              )
                            }
                          >
                            {["Superior", "Técnico", "Médio"].map((n) => (
                              <option key={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                      {c.codigo === "out_3" && marcado("out_3") ? (
                        <input
                          aria-label="Experiências não consideradas"
                          placeholder="quais experiências"
                          value={e.experiencias_anteriores}
                          onChange={(ev) =>
                            mudar(
                              (x) =>
                                void (x.experiencias_anteriores =
                                  ev.target.value),
                            )
                          }
                        />
                      ) : null}
                      {c.codigo === "out_5" ? (
                        <select
                          aria-label="Documentação"
                          value={e.documento_indigena}
                          onChange={(ev) =>
                            mudar(
                              (x) =>
                                void (x.documento_indigena = ev.target
                                  .value as ExperienciaDoParecer["documento_indigena"]),
                            )
                          }
                        >
                          <option>estágios</option>
                          <option>atividades de extensão</option>
                        </select>
                      ) : null}
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </li>
  );
}

function Experiencia({
  bloco: b,
  mudar,
  referencias,
  pontosPorMes,
}: {
  bloco: BlocoDeExperiencia;
  mudar: Mudar<BlocoDeExperiencia>;
  referencias: ReferenciasDoEdital;
  pontosPorMes: number;
}) {
  const total = totalSemSobreposicao(b.itens, pontosPorMes);
  return (
    <div className="parecer-bloco-corpo">
      <ol className="parecer-experiencias">
        {b.itens.map((item, i) => (
          <ItemDaExperiencia
            key={item.id}
            item={item}
            numero={i + 1}
            referencias={referencias}
            pontosPorMes={pontosPorMes}
            remover={() =>
              mudar(
                (x) => void (x.itens = x.itens.filter((y) => y.id !== item.id)),
              )
            }
            mudar={(alterar) =>
              mudar((x) => {
                const alvo = x.itens.find((y) => y.id === item.id);
                if (alvo) alterar(alvo);
              })
            }
          />
        ))}
      </ol>
      <div className="parecer-linha-de-acao">
        <button
          type="button"
          className="btn secondary small"
          onClick={() => mudar((x) => void x.itens.push(novaExperiencia()))}
        >
          <i className="fa-solid fa-plus" aria-hidden="true" /> Experiência
        </button>
        <span className="parecer-total">
          Sem sobreposição: {total.meses} {total.meses === 1 ? "mês" : "meses"}{" "}
          · {pontosDoParecer(total.pontos)} ponto(s)
        </span>
      </div>
      <Adicional
        valor={b.adicional}
        aoMudar={(v) => mudar((x) => void (x.adicional = v))}
      />
    </div>
  );
}

/* ── PcD, indígena, quilombola, heteroidentificação ───────────────────── */
function Pcd({
  bloco: b,
  mudar,
}: {
  bloco: BlocoDePcd;
  mudar: Mudar<BlocoDePcd>;
}) {
  return (
    <div className="parecer-bloco-corpo">
      <div className="parecer-marca-com-campo">
        <Marca
          marcado={b.marcado}
          aoMudar={(v) => mudar((x) => void (x.marcado = v))}
        >
          Avaliação biopsicossocial documental: constatou-se que
        </Marca>
        <select
          aria-label="Constatação do laudo"
          value={b.opcao}
          onChange={(e) =>
            mudar((x) => void (x.opcao = e.target.value as BlocoDePcd["opcao"]))
          }
        >
          {OPCOES_DO_PCD.map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
      </div>
      <Adicional
        valor={b.adicional}
        aoMudar={(v) => mudar((x) => void (x.adicional = v))}
      />
    </div>
  );
}

function Indigena({
  bloco: b,
  mudar,
  referencias,
}: {
  bloco: BlocoIndigena;
  mudar: Mudar<BlocoIndigena>;
  referencias: ReferenciasDoEdital;
}) {
  const r = referencias;
  return (
    <div className="parecer-bloco-corpo parecer-marcas">
      <Marca
        marcado={b.sem_documento}
        aoMudar={(v) => mudar((x) => void (x.sem_documento = v))}
      >
        Item {r.indigena}, “{r.indigena_alinea}”: não comprovou o pertencimento
        (vai para a ampla)
      </Marca>
      <div className="parecer-marca-com-campo">
        <Marca
          marcado={b.no_recurso}
          aoMudar={(v) => mudar((x) => void (x.no_recurso = v))}
        >
          Item {r.indigena_no_recurso}: documentos entregues no recurso
        </Marca>
        {b.no_recurso ? (
          <div className="parecer-subcampos">
            <select
              aria-label="Documentação no recurso"
              value={b.no_recurso_acatada ? "sim" : "nao"}
              onChange={(e) =>
                mudar(
                  (x) => void (x.no_recurso_acatada = e.target.value === "sim"),
                )
              }
            >
              <option value="sim">foi acatada e validada</option>
              <option value="nao">não foi acatada</option>
            </select>
            <select
              aria-label="Pontuação"
              value={b.no_recurso_pontos}
              onChange={(e) =>
                mudar((x) => void (x.no_recurso_pontos = e.target.value))
              }
            >
              {[...new Set([b.no_recurso_pontos, "16", "8", "0"])].map((p) => (
                <option key={p} value={p}>
                  {p} ponto(s)
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div className="parecer-marca-com-campo">
        <Marca
          marcado={b.aldeia}
          aoMudar={(v) => mudar((x) => void (x.aldeia = v))}
        >
          Item {r.indigena}, “{r.aldeia_alinea}”: não apresentou o documento de
          residência em aldeia
        </Marca>
        <select
          aria-label="Documento de residência"
          value={b.documento_aldeia}
          onChange={(e) =>
            mudar((x) => void (x.documento_aldeia = Number(e.target.value)))
          }
        >
          {DOCUMENTOS_DA_ALDEIA.map((d, i) => (
            <option key={d} value={i}>
              {comRefs(d, referencias)}
            </option>
          ))}
        </select>
      </div>
      <div className="parecer-marca-com-campo">
        <Marca
          marcado={b.condisi}
          aoMudar={(v) => mudar((x) => void (x.condisi = v))}
        >
          Declaração contestada pelo CONDISI
        </Marca>
        {b.condisi ? (
          <input
            aria-label="Razão da contestação"
            placeholder="razão da contestação"
            value={b.razao_condisi}
            onChange={(e) =>
              mudar((x) => void (x.razao_condisi = e.target.value))
            }
          />
        ) : null}
      </div>
      <Adicional
        valor={b.adicional}
        aoMudar={(v) => mudar((x) => void (x.adicional = v))}
      />
    </div>
  );
}

function Quilombola({
  bloco: b,
  mudar,
}: {
  bloco: BlocoQuilombola;
  mudar: Mudar<BlocoQuilombola>;
}) {
  return (
    <div className="parecer-bloco-corpo">
      <div className="parecer-marca-com-campo">
        <Marca
          marcado={b.marcado}
          aoMudar={(v) => mudar((x) => void (x.marcado = v))}
        >
          Não anexou o documento do pertencimento quilombola
        </Marca>
        <select
          aria-label="Documento do quilombola"
          value={b.documento}
          onChange={(e) =>
            mudar((x) => void (x.documento = Number(e.target.value)))
          }
        >
          {DOCUMENTOS_DO_QUILOMBOLA.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <Adicional
        valor={b.adicional}
        aoMudar={(v) => mudar((x) => void (x.adicional = v))}
      />
    </div>
  );
}

function Heteroidentificacao({
  bloco: b,
  mudar,
}: {
  bloco: BlocoDeHeteroidentificacao;
  mudar: Mudar<BlocoDeHeteroidentificacao>;
}) {
  return (
    <div className="parecer-bloco-corpo">
      <div className="parecer-marca-com-campo">
        <Marca
          marcado={b.marcado}
          aoMudar={(v) => mudar((x) => void (x.marcado = v))}
        >
          Heteroidentificação pendente
        </Marca>
        <select
          aria-label="Situação da heteroidentificação"
          value={b.parcial ? "parcial" : "nao"}
          onChange={(e) =>
            mudar((x) => void (x.parcial = e.target.value === "parcial"))
          }
        >
          <option value="nao">não comprovou</option>
          <option value="parcial">comprovou parcialmente</option>
        </select>
      </div>
      <fieldset className="parecer-marcas parecer-em-linha">
        <legend>Documentos pendentes</legend>
        <Marca
          marcado={b.autodeclaracao}
          aoMudar={(v) => mudar((x) => void (x.autodeclaracao = v))}
        >
          autodeclaração
        </Marca>
        <Marca
          marcado={b.foto}
          aoMudar={(v) => mudar((x) => void (x.foto = v))}
        >
          foto
        </Marca>
        <Marca
          marcado={b.video}
          aoMudar={(v) => mudar((x) => void (x.video = v))}
        >
          vídeo
        </Marca>
      </fieldset>
      <Adicional
        valor={b.adicional}
        aoMudar={(v) => mudar((x) => void (x.adicional = v))}
      />
    </div>
  );
}

/** O formulário do bloco, pelo código. */
export function FormularioDoBloco({
  bloco,
  mudar,
  referencias,
  pontosPorMes,
}: {
  bloco: BlocoDoParecer;
  mudar: Mudar<BlocoDoParecer>;
  referencias: ReferenciasDoEdital;
  pontosPorMes: number;
}) {
  const m = mudar as Mudar<never>;
  switch (bloco.codigo) {
    case "requisitos":
      return <Requisitos bloco={bloco} mudar={m} referencias={referencias} />;
    case "formacao":
      return <Formacao bloco={bloco} mudar={m} />;
    case "experiencia":
      return (
        <Experiencia
          bloco={bloco}
          mudar={m}
          referencias={referencias}
          pontosPorMes={pontosPorMes}
        />
      );
    case "pcd":
      return <Pcd bloco={bloco} mudar={m} />;
    case "indigena":
      return <Indigena bloco={bloco} mudar={m} referencias={referencias} />;
    case "quilombola":
      return <Quilombola bloco={bloco} mudar={m} />;
    case "heteroidentificacao":
      return <Heteroidentificacao bloco={bloco} mudar={m} />;
  }
}
