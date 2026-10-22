import {
  CAMPOS_POR_TIPO,
  codigoDoTexto,
  diferencaNova,
  resumoDaDiferenca,
  seletorDoCargo,
  type DiferencaDoCargo,
  type ItemExtra,
  type RequisitoDoCargo,
  type SobrescritaDoBloco,
} from "../../../lib/avaliacao-documental/regra-por-cargo.ts";
import type {
  Bloco,
  ColunasDaVaga,
  FaixasDeCursos,
  Nivel,
  RegraAnalise,
} from "../../../lib/avaliacao-documental/tipos-da-regra.ts";
import {
  BotaoMais,
  BotaoTirar,
  Caixa,
  CampoLista,
  CampoNumero,
  CampoTexto,
} from "../campos.jsx";
import { EditorFaixas } from "./cardapio.tsx";

/*
  "Diferenças por cargo" (regra.por_cargo; formato e conta em
  src/lib/avaliacao-documental/regra-por-cargo.ts), no passo 2 do assistente
  e no modo avançado. Cada diferença: o nome, a quem vale (as vagas do
  edital, com o cargo de cada uma, e/ou o começo do nome do cargo pelo quadro
  de vagas) e, por bloco, só o que o tipo aceita mudar: teto e faixas dos
  cursos, itens extras (ex.: UMCQA, +5), a área exigida da experiência e os
  requisitos do cargo (rótulo, motivo da eliminação, termos e onde não
  pontua — item 8.2.7) ou, num bloco de documento, "não se aplica a este
  cargo" (sozinho). Fechado, cada cartão mostra o resumo de uma linha.
*/

type Props = {
  regra: RegraAnalise;
  aoMudar: (regra: RegraAnalise) => void;
  /** As vagas do edital (obter_apoio_regra_analise → perguntas_por_vaga). */
  vagas?: ColunasDaVaga[];
  /** Os cargos do quadro de vagas (obter_apoio_regra_analise → cargos_do_quadro). */
  cargosDoQuadro?: string[];
};

type Numero = number | string | null;
const NIVEIS_DA_FAIXA: Nivel[] = [
  "medio",
  "tecnico",
  "superior",
  "fundamental",
];

const comLista = <T,>(lista: T[], i: number, item: T | null): T[] =>
  item === null
    ? lista.filter((_, j) => j !== i)
    : lista.map((x, j) => (j === i ? item : x));

/** As faixas que o bloco já usa (as do primeiro nível que tiver, senão as gerais). */
function faixasDeBase(bloco: Bloco): FaixasDeCursos {
  const porNivel = bloco.por_nivel ?? {};
  for (const nivel of NIVEIS_DA_FAIXA) {
    const parte = porNivel[nivel] as FaixasDeCursos | undefined;
    if (parte?.faixas?.length)
      return {
        teto: parte.teto ?? null,
        faixas: structuredClone(parte.faixas),
      };
  }
  return {
    teto: bloco.teto ?? null,
    faixas: structuredClone(bloco.faixas ?? []),
  };
}

function SobrescritaDoTipo({
  bloco,
  blocos,
  valor,
  aoMudar,
}: {
  bloco: Bloco;
  blocos: Bloco[];
  valor: SobrescritaDoBloco;
  aoMudar: (s: SobrescritaDoBloco) => void;
}) {
  const campos = CAMPOS_POR_TIPO[bloco.tipo] ?? [];
  const tem = (k: keyof SobrescritaDoBloco) => Object.hasOwn(valor, k);
  const sem = (...chaves: (keyof SobrescritaDoBloco)[]) => {
    const copia = { ...valor };
    for (const k of chaves) delete copia[k];
    aoMudar(copia);
  };
  const extras = valor.extras ?? [];
  const requisitos = valor.requisitos ?? [];
  const motivosDoBloco = (bloco.motivos ?? []).map((m) => m.codigo);
  const pontuam = blocos.filter(
    (b) => b.tipo === "TITULOS" || b.tipo === "CURSOS",
  );
  if (campos.includes("nao_se_aplica") && valor.nao_se_aplica === true)
    return (
      <div className="avd-ast-cargo-bloco">
        <Caixa
          rotulo="Não se aplica a este cargo"
          marcado
          aoMudar={(v: boolean) => (v ? null : sem("nao_se_aplica"))}
        />
      </div>
    );
  return (
    <div className="avd-ast-cargo-bloco">
      {campos.includes("nao_se_aplica") ? (
        <Caixa
          rotulo="Não se aplica a este cargo"
          marcado={false}
          aoMudar={(v: boolean) =>
            v ? aoMudar({ nao_se_aplica: true }) : null
          }
        />
      ) : null}
      {campos.includes("faixas") ? (
        <>
          <Caixa
            rotulo="Faixas e teto próprios do cargo"
            marcado={tem("faixas")}
            aoMudar={(v: boolean) =>
              v
                ? aoMudar({ ...valor, ...faixasDeBase(bloco) })
                : sem("faixas", "teto")
            }
          />
          {tem("faixas") ? (
            <EditorFaixas
              rotulo="Faixas do cargo"
              alvo={{ teto: valor.teto ?? null, faixas: valor.faixas ?? [] }}
              aoMudar={(a: FaixasDeCursos) =>
                aoMudar({ ...valor, teto: a.teto ?? null, faixas: a.faixas })
              }
            />
          ) : null}
        </>
      ) : campos.includes("teto") ? (
        <div className="avd-linha">
          <Caixa
            rotulo="Teto próprio do cargo"
            marcado={tem("teto")}
            aoMudar={(v: boolean) =>
              v ? aoMudar({ ...valor, teto: bloco.teto ?? null }) : sem("teto")
            }
          />
          {tem("teto") ? (
            <CampoNumero
              rotulo="Teto"
              valor={valor.teto ?? null}
              aoMudar={(v: Numero) =>
                aoMudar({ ...valor, teto: v as number | null })
              }
            />
          ) : null}
        </div>
      ) : null}
      {campos.includes("extras") ? (
        <div
          className="avd-ast-cargo-lista"
          role="group"
          aria-label="Itens extras"
        >
          {extras.map((e, i) => (
            <div className="avd-linha" key={e.codigo}>
              <CampoTexto
                rotulo="Item extra"
                largo
                valor={e.rotulo}
                aoMudar={(rotulo: string) =>
                  aoMudar({
                    ...valor,
                    extras: comLista<ItemExtra>(extras, i, { ...e, rotulo }),
                  })
                }
              />
              <CampoNumero
                rotulo="Pontos"
                valor={e.pontos}
                aoMudar={(v: Numero) =>
                  aoMudar({
                    ...valor,
                    extras: comLista<ItemExtra>(extras, i, {
                      ...e,
                      pontos: v as number,
                    }),
                  })
                }
              />
              <CampoTexto
                rotulo="Item do edital"
                maximo={40}
                valor={e.item_edital}
                aoMudar={(item_edital: string) =>
                  aoMudar({
                    ...valor,
                    extras: comLista<ItemExtra>(extras, i, {
                      ...e,
                      item_edital,
                    }),
                  })
                }
              />
              <BotaoTirar
                rotulo="Tirar o item extra"
                aoClicar={() => {
                  const resto = comLista<ItemExtra>(extras, i, null);
                  if (resto.length) aoMudar({ ...valor, extras: resto });
                  else sem("extras");
                }}
              />
            </div>
          ))}
          <BotaoMais
            aoClicar={() =>
              aoMudar({
                ...valor,
                extras: [
                  ...extras,
                  {
                    codigo: codigoDoTexto(
                      `Extra ${extras.length + 1}`,
                      extras.map((x) => x.codigo),
                    ),
                    rotulo: "",
                    pontos: 0,
                  },
                ],
              })
            }
          >
            Item extra que pontua
          </BotaoMais>
        </div>
      ) : null}
      {campos.includes("area") ? (
        <CampoTexto
          rotulo="Área exigida da experiência"
          largo
          maximo={1000}
          valor={valor.area}
          aoMudar={(area: string) =>
            area ? aoMudar({ ...valor, area }) : sem("area")
          }
        />
      ) : null}
      {campos.includes("requisitos") ? (
        <div
          className="avd-ast-cargo-lista"
          role="group"
          aria-label="Requisitos do cargo"
        >
          {requisitos.map((q, i) => {
            const mudar = (novo: Partial<RequisitoDoCargo>) =>
              aoMudar({
                ...valor,
                requisitos: comLista<RequisitoDoCargo>(requisitos, i, {
                  ...q,
                  ...novo,
                }),
              });
            return (
              <fieldset className="avd-ast-cargo-requisito" key={q.codigo}>
                <legend className="sr-only">Requisito {i + 1}</legend>
                <div className="avd-linha">
                  <CampoTexto
                    rotulo="Requisito"
                    largo
                    valor={q.rotulo}
                    aoMudar={(rotulo: string) => mudar({ rotulo })}
                  />
                  <CampoTexto
                    rotulo="Item do edital"
                    maximo={40}
                    valor={q.item_edital}
                    aoMudar={(item_edital: string) => mudar({ item_edital })}
                  />
                  <BotaoTirar
                    rotulo="Tirar o requisito"
                    aoClicar={() => {
                      const resto = comLista<RequisitoDoCargo>(
                        requisitos,
                        i,
                        null,
                      );
                      if (resto.length)
                        aoMudar({ ...valor, requisitos: resto });
                      else sem("requisitos");
                    }}
                  />
                </div>
                <CampoTexto
                  rotulo="Motivo da eliminação"
                  largo
                  maximo={1000}
                  valor={q.motivo}
                  aoMudar={(motivo: string) => mudar({ motivo })}
                />
                {pontuam.length ? (
                  <div className="avd-linha">
                    <CampoLista
                      rotulo="Termos do documento (8.2.7)"
                      largo={false}
                      valor={q.termos ?? []}
                      aoMudar={(termos: string[]) => mudar({ termos })}
                    />
                    {pontuam.map((b) => (
                      <Caixa
                        key={b.codigo}
                        rotulo={`Não pontua em ${b.titulo.split(/ \(|,/)[0]}`}
                        marcado={(q.nao_pontua_em ?? []).includes(b.codigo)}
                        aoMudar={(v: boolean) => {
                          const atual = (q.nao_pontua_em ?? []).filter(
                            (c) => c !== b.codigo,
                          );
                          mudar({
                            nao_pontua_em: v ? [...atual, b.codigo] : atual,
                          });
                        }}
                      />
                    ))}
                  </div>
                ) : null}
              </fieldset>
            );
          })}
          <BotaoMais
            aoClicar={() =>
              aoMudar({
                ...valor,
                requisitos: [
                  ...requisitos,
                  {
                    codigo: codigoDoTexto(
                      `Requisito ${requisitos.length + 1}`,
                      [...motivosDoBloco, ...requisitos.map((x) => x.codigo)],
                    ),
                    rotulo: "",
                    motivo: "",
                    item_edital: "",
                  },
                ],
              })
            }
          >
            Requisito do cargo
          </BotaoMais>
        </div>
      ) : null}
    </div>
  );
}

function CartaoDaDiferenca({
  diferenca,
  blocos,
  vagas,
  cargosDoQuadro,
  usadasPorOutras,
  aoMudar,
  aoTirar,
}: {
  diferenca: DiferencaDoCargo;
  blocos: Bloco[];
  vagas: ColunasDaVaga[];
  cargosDoQuadro: string[];
  usadasPorOutras: Set<string>;
  aoMudar: (d: DiferencaDoCargo) => void;
  aoTirar: () => void;
}) {
  const marcadas = new Set(diferenca.vagas ?? []);
  const cargos = diferenca.cargos ?? [];
  const seletores = [
    ...new Set(cargosDoQuadro.map(seletorDoCargo).filter(Boolean)),
  ];
  const resumo = resumoDaDiferenca(diferenca, blocos);
  const quem = [
    marcadas.size
      ? `${marcadas.size} ${marcadas.size === 1 ? "vaga" : "vagas"}`
      : "",
    cargos.join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
  const comBloco = (codigo: string, s: SobrescritaDoBloco | null) => {
    const outros = { ...diferenca.blocos };
    if (s && Object.keys(s).length) outros[codigo] = s;
    else delete outros[codigo];
    aoMudar({ ...diferenca, blocos: outros });
  };
  return (
    <details className="avd-ast-cargo" data-diferenca={diferenca.codigo}>
      <summary>
        <strong>{diferenca.rotulo || "Diferença sem nome"}</strong>
        {quem ? <span className="avd-ast-cargo-resumo">{quem}</span> : null}
        {resumo ? <span className="avd-ast-cargo-resumo">{resumo}</span> : null}
      </summary>
      <div className="avd-ast-cargo-corpo">
        <div className="avd-linha">
          <CampoTexto
            rotulo="Nome"
            largo
            maximo={120}
            valor={diferenca.rotulo}
            aoMudar={(rotulo: string) => aoMudar({ ...diferenca, rotulo })}
          />
          <BotaoTirar rotulo="Tirar a diferença" aoClicar={aoTirar} />
        </div>
        {vagas.length ? (
          <div
            className="avd-ast-cargo-escolhas"
            role="group"
            aria-label="Vagas"
          >
            <span className="avd-ast-subtitulo">Vagas</span>
            {vagas.map((v) => (
              <Caixa
                key={v.vaga}
                rotulo={`${v.vaga}${v.cargo ? ` · ${v.cargo}` : ""}${usadasPorOutras.has(v.vaga) ? " (em outra diferença)" : ""}`}
                marcado={marcadas.has(v.vaga)}
                aoMudar={(sim: boolean) => {
                  const novas = new Set(marcadas);
                  if (sim) novas.add(v.vaga);
                  else novas.delete(v.vaga);
                  aoMudar({ ...diferenca, vagas: [...novas] });
                }}
              />
            ))}
          </div>
        ) : null}
        {seletores.length ? (
          <div
            className="avd-ast-cargo-escolhas"
            role="group"
            aria-label="Cargos do quadro"
          >
            <span className="avd-ast-subtitulo">Cargos do quadro</span>
            {seletores.map((s) => (
              <Caixa
                key={s}
                rotulo={s}
                marcado={cargos.includes(s)}
                aoMudar={(sim: boolean) =>
                  aoMudar({
                    ...diferenca,
                    cargos: sim
                      ? [...cargos, s]
                      : cargos.filter((c) => c !== s),
                  })
                }
              />
            ))}
          </div>
        ) : null}
        <CampoLista
          rotulo="Cargos (começo do nome)"
          largo
          valor={cargos}
          aoMudar={(lista: string[]) =>
            aoMudar({ ...diferenca, cargos: lista })
          }
        />
        {blocos
          .filter((b) => CAMPOS_POR_TIPO[b.tipo])
          .map((b) => {
            const s = diferenca.blocos?.[b.codigo];
            return (
              <details
                key={b.codigo}
                className="avd-ast-cargo-do-bloco"
                open={Boolean(s)}
              >
                <summary>{b.titulo || b.codigo}</summary>
                <SobrescritaDoTipo
                  bloco={b}
                  blocos={blocos}
                  valor={s ?? {}}
                  aoMudar={(novo) => comBloco(b.codigo, novo)}
                />
              </details>
            );
          })}
      </div>
    </details>
  );
}

export function DiferencasPorCargo({
  regra,
  aoMudar,
  vagas = [],
  cargosDoQuadro = [],
}: Props) {
  const diferencas = regra.por_cargo ?? [];
  const mudarLista = (lista: DiferencaDoCargo[]) => {
    const copia: RegraAnalise = { ...regra, por_cargo: lista };
    if (!lista.length) delete copia.por_cargo;
    aoMudar(copia);
  };
  return (
    <section
      className="avd-ast-grupo"
      aria-label="Diferenças por cargo"
      data-tour="avd-diferencas-por-cargo"
    >
      <h3 className="avd-ast-grupo-titulo">
        Diferenças por cargo
        {diferencas.length ? (
          <span className="avd-ast-contagem">{diferencas.length}</span>
        ) : null}
      </h3>
      {diferencas.map((d, i) => {
        const usadas = new Set(
          diferencas.filter((_, j) => j !== i).flatMap((x) => x.vagas ?? []),
        );
        return (
          <CartaoDaDiferenca
            key={d.codigo}
            diferenca={d}
            blocos={regra.blocos}
            vagas={vagas}
            cargosDoQuadro={cargosDoQuadro}
            usadasPorOutras={usadas}
            aoMudar={(novo) => mudarLista(comLista(diferencas, i, novo))}
            aoTirar={() =>
              mudarLista(comLista<DiferencaDoCargo>(diferencas, i, null))
            }
          />
        );
      })}
      <BotaoMais
        aoClicar={() => mudarLista([...diferencas, diferencaNova(diferencas)])}
      >
        Diferença por cargo
      </BotaoMais>
    </section>
  );
}
