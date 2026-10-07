import { useState, type ReactNode } from "react";
import {
  GRUPOS_DO_CARDAPIO,
  blocoDoCartao,
  cartoesDaRegra,
  comBloco,
  comDocumentoNovo,
  comEliminacao,
  eliminacaoDoCartao,
  motivoNovo,
  type Cartao,
  type Guardados,
} from "../../../lib/avaliacao-documental/assistente-da-regra.ts";
import {
  BASES_DA_NOTA_DO_LOTE,
  NIVEIS,
  TITULOS_ACADEMICOS,
} from "../../../lib/avaliacao-documental/catalogo.js";
import type {
  Bloco,
  EliminacaoAutomatica,
  Efeito,
  Faixa,
  FaixasDeCursos,
  Nivel,
  PontosDeExperiencia,
  RegraAnalise,
  TituloAcademico,
} from "../../../lib/avaliacao-documental/tipos-da-regra.ts";
import { Segmentado } from "../../../ui/index.js";
import {
  BotaoMais,
  BotaoTirar,
  Caixa,
  CampoNumero,
  CampoTexto,
  Escolha,
} from "../campos.jsx";

/*
  Passo 2: "O que vale ponto e o que elimina", um cardápio de cartões. O
  cartão marcado traz o pedaço da regra (com valores sugeridos das fontes) e
  abre só os seus campos; desmarcado, some da regra. Os campos mexem no mesmo
  JSON da regra (regra.js); o modo avançado continua com tudo.
*/

type Numero = number | string | null;
const numero = (v: Numero) => v as number;

type Props = {
  regra: RegraAnalise;
  area: string;
  guardados: Guardados;
  notaMinima: number | null;
  aoMudar: (regra: RegraAnalise) => void;
  aoAlternar: (cartao: Cartao, marcar: boolean) => void;
};

/* ---------- Resumo de uma linha no cabeçalho do cartão ---------- */

function resumoDoCartao(regra: RegraAnalise, cartao: Cartao): string {
  if (!cartao.marcado) return "";
  const bloco = blocoDoCartao(regra, cartao);
  if (bloco) {
    if (bloco.tipo === "DOCUMENTO") {
      const e = bloco.efeitos ?? {};
      return e.NAO_ENVIADO === "ELIMINA" || e.NAO_CONFORME === "ELIMINA"
        ? "elimina"
        : "só registra";
    }
    if (bloco.teto !== null && bloco.teto !== undefined)
      return `até ${String(bloco.teto).replace(".", ",")} pts`;
    if (bloco.tipo === "PONTUACAO")
      return `+${bloco.indigena ?? 0} / +${bloco.aldeia ?? 0}`;
    if (bloco.tipo === "COTA") return bloco.condicao?.split("=")[1] ?? "";
    return "";
  }
  if (cartao.corte)
    return `${String(regra.lote.nota_minima ?? "—").replace(".", ",")} pts`;
  return cartao.eliminacao ? "elimina" : "";
}

/* ---------- Editores de cada tipo ---------- */

const ELIMINA_OU_REGISTRA: ReadonlyArray<readonly [Efeito, string]> = [
  ["ELIMINA", "Elimina"],
  ["SO_REGISTRO", "Só registra"],
];

function EditorDeMotivos({
  bloco,
  aoMudar,
}: {
  bloco: Bloco;
  aoMudar: (b: Bloco) => void;
}) {
  const motivos = bloco.motivos ?? [];
  return (
    <div className="avd-ast-motivos">
      <span className="avd-ast-subtitulo">Motivos (vão ao parecer)</span>
      {motivos.map((m, i) => (
        <div className="avd-linha" key={m.codigo}>
          <CampoTexto
            rotulo="Texto"
            largo
            maximo={1000}
            valor={m.texto}
            aoMudar={(texto) =>
              aoMudar({
                ...bloco,
                motivos: motivos.map((x, j) => (j === i ? { ...x, texto } : x)),
              })
            }
          />
          <CampoTexto
            rotulo="Item"
            maximo={40}
            valor={m.item_edital ?? ""}
            aoMudar={(item_edital) =>
              aoMudar({
                ...bloco,
                motivos: motivos.map((x, j) =>
                  j === i ? { ...x, item_edital } : x,
                ),
              })
            }
          />
          <BotaoTirar
            rotulo="Tirar o motivo"
            aoClicar={() =>
              aoMudar({ ...bloco, motivos: motivos.filter((_, j) => j !== i) })
            }
          />
        </div>
      ))}
      <BotaoMais
        aoClicar={() =>
          aoMudar({ ...bloco, motivos: [...motivos, motivoNovo(bloco)] })
        }
      >
        Motivo
      </BotaoMais>
    </div>
  );
}

function EditorDocumento({
  bloco,
  aoMudar,
}: {
  bloco: Bloco;
  aoMudar: (b: Bloco) => void;
}) {
  const efeitos = bloco.efeitos ?? {};
  const efeito = (chave: "NAO_ENVIADO" | "NAO_CONFORME") => (
    <Escolha
      rotulo={chave === "NAO_ENVIADO" ? "Não enviado" : "Não conforme"}
      valor={efeitos[chave] ?? "SO_REGISTRO"}
      opcoes={ELIMINA_OU_REGISTRA}
      aoMudar={(v) =>
        aoMudar({
          ...bloco,
          efeitos: { ...efeitos, [chave]: (v ?? "SO_REGISTRO") as Efeito },
        })
      }
    />
  );
  return (
    <>
      <div className="avd-linha">
        <CampoTexto
          rotulo="Título"
          largo
          valor={bloco.titulo}
          aoMudar={(titulo) => aoMudar({ ...bloco, titulo })}
        />
        <CampoTexto
          rotulo="Item do edital"
          maximo={40}
          valor={bloco.item_edital ?? ""}
          aoMudar={(item_edital) => aoMudar({ ...bloco, item_edital })}
        />
      </div>
      {bloco.tipo === "DOCUMENTO" ? (
        <>
          <div className="avd-linha">
            {efeito("NAO_ENVIADO")}
            {efeito("NAO_CONFORME")}
          </div>
          <EditorDeMotivos bloco={bloco} aoMudar={aoMudar} />
        </>
      ) : null}
    </>
  );
}

const EFEITOS_DA_COTA: ReadonlyArray<readonly [Efeito, string]> = [
  ["ENCAMINHA_HETEROIDENTIFICACAO", "Encaminha à heteroidentificação"],
  ["ENCAMINHA_PERICIA", "Encaminha à perícia"],
  ["SO_REGISTRO", "Só registra"],
];
const FALHA_DA_COTA: ReadonlyArray<readonly [Efeito, string]> = [
  ["SEGUE_AMPLA", "Segue na ampla concorrência"],
  ["SO_REGISTRO", "Só registra"],
];

function EditorCota({
  bloco,
  aoMudar,
}: {
  bloco: Bloco;
  aoMudar: (b: Bloco) => void;
}) {
  const e = bloco.efeitos ?? {};
  return (
    <>
      <div className="avd-linha">
        <CampoTexto
          rotulo="Título"
          largo
          valor={bloco.titulo}
          aoMudar={(titulo) => aoMudar({ ...bloco, titulo })}
        />
        <CampoTexto
          rotulo="Item do edital"
          maximo={40}
          valor={bloco.item_edital ?? ""}
          aoMudar={(item_edital) => aoMudar({ ...bloco, item_edital })}
        />
      </div>
      <div className="avd-linha">
        <Escolha
          rotulo="Conforme"
          valor={e.CONFORME ?? "SO_REGISTRO"}
          opcoes={EFEITOS_DA_COTA}
          aoMudar={(v) =>
            aoMudar({
              ...bloco,
              efeitos: { ...e, CONFORME: (v ?? "SO_REGISTRO") as Efeito },
            })
          }
        />
        <Escolha
          rotulo="Não conforme ou não enviado"
          valor={e.NAO_CONFORME ?? "SEGUE_AMPLA"}
          opcoes={FALHA_DA_COTA}
          aoMudar={(v) =>
            aoMudar({
              ...bloco,
              efeitos: {
                ...e,
                NAO_CONFORME: (v ?? "SEGUE_AMPLA") as Efeito,
                NAO_ENVIADO: (v ?? "SEGUE_AMPLA") as Efeito,
              },
            })
          }
        />
      </div>
    </>
  );
}

function EditorEtnico({
  bloco,
  aoMudar,
}: {
  bloco: Bloco;
  aoMudar: (b: Bloco) => void;
}) {
  return (
    <>
      <div className="avd-linha">
        <CampoNumero
          rotulo="Indígena (pontos)"
          valor={bloco.indigena}
          aoMudar={(v) => aoMudar({ ...bloco, indigena: numero(v) })}
        />
        <CampoNumero
          rotulo="Mora em aldeia (pontos)"
          valor={bloco.aldeia}
          aoMudar={(v) => aoMudar({ ...bloco, aldeia: numero(v) })}
        />
        <CampoNumero
          rotulo="Teto"
          valor={bloco.teto}
          aoMudar={(v) => aoMudar({ ...bloco, teto: v as number | null })}
        />
        <CampoTexto
          rotulo="Item do edital"
          maximo={40}
          valor={bloco.item_edital ?? ""}
          aoMudar={(item_edital) => aoMudar({ ...bloco, item_edital })}
        />
      </div>
      <Caixa
        rotulo="Aldeia só da lista do DSEI do edital"
        marcado={bloco.lista_aldeias === "DSEI_DO_EDITAL"}
        aoMudar={(v) =>
          aoMudar({ ...bloco, lista_aldeias: v ? "DSEI_DO_EDITAL" : null })
        }
      />
    </>
  );
}

const NIVEIS_DA_REGRA = NIVEIS as unknown as ReadonlyArray<
  readonly [Nivel, string]
>;
const TITULOS = TITULOS_ACADEMICOS as unknown as ReadonlyArray<
  readonly [TituloAcademico, string]
>;

function EditorTitulos({
  bloco,
  aoMudar,
}: {
  bloco: Bloco;
  aoMudar: (b: Bloco) => void;
}) {
  const porNivel = bloco.pontos_por_nivel ?? {};
  const niveis = NIVEIS_DA_REGRA.filter(([n]) => porNivel[n]);
  const pontosDe = (n: Nivel, t: TituloAcademico) =>
    porNivel[n]?.find((x) => x.titulo === t)?.pontos ?? null;
  const definir = (n: Nivel, t: TituloAcademico, v: Numero) => {
    const lista = (porNivel[n] ?? []).filter((x) => x.titulo !== t);
    const novo =
      v === null || v === ""
        ? lista
        : [...lista, { titulo: t, pontos: numero(v) }];
    const ordem = TITULOS.map(([c]) => c);
    novo.sort((a, b) => ordem.indexOf(a.titulo) - ordem.indexOf(b.titulo));
    aoMudar({ ...bloco, pontos_por_nivel: { ...porNivel, [n]: novo } });
  };
  return (
    <>
      <div className="avd-linha">
        <CampoTexto
          rotulo="Título"
          largo
          valor={bloco.titulo}
          aoMudar={(titulo) => aoMudar({ ...bloco, titulo })}
        />
        <CampoNumero
          rotulo="Teto"
          valor={bloco.teto}
          aoMudar={(v) => aoMudar({ ...bloco, teto: v as number | null })}
        />
      </div>
      <Segmentado
        rotulo="Como contam os títulos"
        opcoes={[
          { valor: "maior", rotulo: "Vale o maior" },
          { valor: "soma", rotulo: "Os títulos somam" },
        ]}
        valor={bloco.cumulativa ? "soma" : "maior"}
        aoMudar={(v) => aoMudar({ ...bloco, cumulativa: v === "soma" })}
      />
      <div
        className="avd-ast-niveis"
        role="group"
        aria-label="Níveis com pontos"
      >
        {NIVEIS_DA_REGRA.map(([n, rotulo]) => (
          <Caixa
            key={n}
            rotulo={rotulo}
            marcado={Boolean(porNivel[n])}
            aoMudar={(v) => {
              const novo = { ...porNivel };
              if (v) novo[n] = [];
              else delete novo[n];
              aoMudar({ ...bloco, pontos_por_nivel: novo });
            }}
          />
        ))}
      </div>
      {niveis.length ? (
        <div className="avd-ast-tabela-rolagem">
          <table className="avd-ast-tabela">
            <thead>
              <tr>
                <th scope="col">Título</th>
                {niveis.map(([n, rotulo]) => (
                  <th scope="col" key={n}>
                    {rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TITULOS.map(([t, rotulo]) => (
                <tr key={t}>
                  <th scope="row">{rotulo}</th>
                  {niveis.map(([n, rotuloDoNivel]) => (
                    <td key={n}>
                      <input
                        inputMode="decimal"
                        aria-label={`${rotulo}, ${rotuloDoNivel}`}
                        value={
                          pontosDe(n, t) === null
                            ? ""
                            : String(pontosDe(n, t)).replace(".", ",")
                        }
                        placeholder="—"
                        onChange={(ev) => {
                          const texto = ev.target.value
                            .trim()
                            .replace(",", ".");
                          const valor =
                            texto === ""
                              ? null
                              : Number.isFinite(Number(texto))
                                ? Number(texto)
                                : texto;
                          definir(n, t, valor);
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

function EditorFaixas({
  alvo,
  aoMudar,
  rotulo,
}: {
  alvo: FaixasDeCursos;
  aoMudar: (a: FaixasDeCursos) => void;
  rotulo: string;
}) {
  const faixas = alvo.faixas ?? [];
  const mudar = (i: number, f: Faixa) =>
    aoMudar({ ...alvo, faixas: faixas.map((x, j) => (j === i ? f : x)) });
  return (
    <div className="avd-ast-faixas" aria-label={rotulo} role="group">
      <span className="avd-ast-subtitulo">{rotulo}</span>
      {faixas.map((f, i) => (
        <div className="avd-linha" key={i}>
          <CampoNumero
            rotulo="De (h)"
            valor={f.min_horas}
            aoMudar={(v) => mudar(i, { ...f, min_horas: numero(v) })}
          />
          <CampoNumero
            rotulo="Até (h)"
            dica={f.max_horas === null ? "sem limite" : undefined}
            valor={f.max_horas}
            aoMudar={(v) => mudar(i, { ...f, max_horas: v as number | null })}
          />
          <CampoNumero
            rotulo="Pontos"
            valor={f.pontos}
            aoMudar={(v) => mudar(i, { ...f, pontos: numero(v) })}
          />
          <BotaoTirar
            rotulo="Tirar a faixa"
            aoClicar={() =>
              aoMudar({ ...alvo, faixas: faixas.filter((_, j) => j !== i) })
            }
          />
        </div>
      ))}
      <div className="avd-linha">
        <CampoNumero
          rotulo="Teto"
          valor={alvo.teto ?? null}
          aoMudar={(v) => aoMudar({ ...alvo, teto: v as number | null })}
        />
        <BotaoMais
          aoClicar={() => {
            const ultima = faixas.at(-1);
            const inicio = ultima
              ? (ultima.max_horas ?? ultima.min_horas) + 1
              : 0;
            aoMudar({
              ...alvo,
              faixas: [
                ...faixas,
                { min_horas: inicio, max_horas: null, pontos: 0 },
              ],
            });
          }}
        >
          Faixa
        </BotaoMais>
      </div>
    </div>
  );
}

/* Pontos diferentes por nível (cursos e experiência): marcar copia os pontos gerais para o nível. */
function NiveisDiferentes<T extends object>({
  bloco,
  base,
  aoMudar,
  editor,
}: {
  bloco: Bloco;
  base: T;
  aoMudar: (b: Bloco) => void;
  editor: (alvo: T, mudar: (a: T) => void, rotulo: string) => ReactNode;
}) {
  const porNivel = (bloco.por_nivel ?? {}) as Partial<Record<Nivel, T>>;
  return (
    <>
      <div
        className="avd-ast-niveis"
        role="group"
        aria-label="Pontos diferentes por nível"
      >
        <span className="avd-ast-subtitulo">Pontos diferentes para</span>
        {NIVEIS_DA_REGRA.map(([n, rotulo]) => (
          <Caixa
            key={n}
            rotulo={rotulo}
            marcado={Boolean(porNivel[n])}
            aoMudar={(v) => {
              const novo = { ...porNivel } as Record<string, T>;
              if (v) novo[n] = structuredClone(base);
              else delete novo[n];
              const proximo = {
                ...bloco,
                por_nivel: novo as Bloco["por_nivel"],
              };
              if (!Object.keys(novo).length) delete proximo.por_nivel;
              aoMudar(proximo);
            }}
          />
        ))}
      </div>
      {NIVEIS_DA_REGRA.filter(([n]) => porNivel[n]).map(([n, rotulo]) => (
        <div key={n} className="avd-ast-nivel">
          {editor(
            porNivel[n] as T,
            (a) =>
              aoMudar({
                ...bloco,
                por_nivel: {
                  ...(bloco.por_nivel ?? {}),
                  [n]: a,
                } as Bloco["por_nivel"],
              }),
            `Nível ${rotulo.toLowerCase()}`,
          )}
        </div>
      ))}
    </>
  );
}

function EditorCursos({
  bloco,
  aoMudar,
}: {
  bloco: Bloco;
  aoMudar: (b: Bloco) => void;
}) {
  const geral: FaixasDeCursos = {
    faixas: bloco.faixas ?? [],
    teto: bloco.teto ?? null,
  };
  return (
    <>
      <CampoTexto
        rotulo="Título"
        largo
        valor={bloco.titulo}
        aoMudar={(titulo) => aoMudar({ ...bloco, titulo })}
      />
      <EditorFaixas
        alvo={geral}
        rotulo={
          bloco.por_nivel ? "Os demais níveis" : "Faixas de carga horária"
        }
        aoMudar={(a) =>
          aoMudar({ ...bloco, faixas: a.faixas, teto: a.teto ?? null })
        }
      />
      <NiveisDiferentes<FaixasDeCursos>
        bloco={bloco}
        base={geral}
        aoMudar={aoMudar}
        editor={(alvo, mudar, rotulo) => (
          <EditorFaixas alvo={alvo} aoMudar={mudar} rotulo={rotulo} />
        )}
      />
    </>
  );
}

function EditorPontosDaExperiencia({
  alvo,
  porPeriodo,
  aoMudar,
  rotulo,
}: {
  alvo: PontosDeExperiencia;
  porPeriodo: boolean;
  aoMudar: (a: PontosDeExperiencia) => void;
  rotulo: string;
}) {
  return (
    <div className="avd-linha" role="group" aria-label={rotulo}>
      <span className="avd-ast-subtitulo avd-ast-rotulo-da-linha">
        {rotulo}
      </span>
      {porPeriodo ? (
        <CampoNumero
          rotulo="Pontos por período"
          valor={alvo.pontos_por_periodo}
          aoMudar={(v) => aoMudar({ ...alvo, pontos_por_periodo: numero(v) })}
        />
      ) : (
        <CampoNumero
          rotulo="Pontos por mês"
          valor={alvo.pontos_por_mes}
          aoMudar={(v) => aoMudar({ ...alvo, pontos_por_mes: numero(v) })}
        />
      )}
      <CampoNumero
        rotulo="Teto"
        valor={alvo.teto ?? null}
        aoMudar={(v) => aoMudar({ ...alvo, teto: v as number | null })}
      />
    </div>
  );
}

function EditorExperiencia({
  bloco,
  aoMudar,
  area,
}: {
  bloco: Bloco;
  aoMudar: (b: Bloco) => void;
  area: string;
}) {
  const porPeriodo = bloco.pontuacao === "POR_PERIODO";
  const geral: PontosDeExperiencia = porPeriodo
    ? {
        pontos_por_periodo: bloco.pontos_por_periodo ?? 0,
        teto: bloco.teto ?? null,
      }
    : { pontos_por_mes: bloco.pontos_por_mes ?? 0, teto: bloco.teto ?? null };
  return (
    <>
      <CampoTexto
        rotulo="Título"
        largo
        valor={bloco.titulo}
        aoMudar={(titulo) => aoMudar({ ...bloco, titulo })}
      />
      <div className="avd-linha">
        <CampoNumero
          rotulo="Mínimo exigido (meses)"
          valor={bloco.minimo_meses ?? 0}
          aoMudar={(v) => aoMudar({ ...bloco, minimo_meses: numero(v) })}
        />
        <Escolha
          rotulo="Abaixo do mínimo"
          valor={bloco.efeito_minimo ?? "ELIMINA"}
          opcoes={ELIMINA_OU_REGISTRA}
          aoMudar={(v) =>
            aoMudar({
              ...bloco,
              efeito_minimo: (v ?? "ELIMINA") as "ELIMINA" | "SO_REGISTRO",
            })
          }
        />
        <CampoTexto
          rotulo="Item do mínimo"
          maximo={40}
          valor={bloco.item_minimo ?? ""}
          aoMudar={(item_minimo) => aoMudar({ ...bloco, item_minimo })}
        />
      </div>
      <Segmentado
        rotulo="Como pontua"
        opcoes={[
          { valor: "POR_MES", rotulo: "Por mês" },
          { valor: "POR_PERIODO", rotulo: "Por período" },
        ]}
        valor={porPeriodo ? "POR_PERIODO" : "POR_MES"}
        aoMudar={(v) =>
          aoMudar({ ...bloco, pontuacao: v as "POR_MES" | "POR_PERIODO" })
        }
      />
      <div className="avd-linha">
        {porPeriodo ? (
          <CampoNumero
            rotulo="A cada (meses)"
            valor={bloco.periodo_meses ?? 6}
            aoMudar={(v) => aoMudar({ ...bloco, periodo_meses: numero(v) })}
          />
        ) : null}
        <Caixa
          rotulo="Só conta além do mínimo"
          marcado={bloco.desconta_minimo}
          aoMudar={(desconta_minimo) => aoMudar({ ...bloco, desconta_minimo })}
        />
      </div>
      <EditorPontosDaExperiencia
        alvo={geral}
        porPeriodo={porPeriodo}
        rotulo={bloco.por_nivel ? "Os demais níveis" : "Pontos"}
        aoMudar={(a) =>
          aoMudar(
            porPeriodo
              ? {
                  ...bloco,
                  pontos_por_periodo: a.pontos_por_periodo ?? 0,
                  teto: a.teto ?? null,
                }
              : {
                  ...bloco,
                  pontos_por_mes: a.pontos_por_mes ?? 0,
                  teto: a.teto ?? null,
                },
          )
        }
      />
      <NiveisDiferentes<PontosDeExperiencia>
        bloco={bloco}
        base={geral}
        aoMudar={aoMudar}
        editor={(alvo, mudar, rotulo) => (
          <EditorPontosDaExperiencia
            alvo={alvo}
            porPeriodo={porPeriodo}
            aoMudar={mudar}
            rotulo={rotulo}
          />
        )}
      />
      {area === "saude-indigena" || bloco.estagio_indigena?.ativo ? (
        <Caixa
          rotulo="Estágio de indígena conta quando não há experiência"
          marcado={bloco.estagio_indigena?.ativo}
          aoMudar={(ativo) =>
            aoMudar({
              ...bloco,
              estagio_indigena: {
                horas_por_dia: 8,
                dias_por_mes: 22,
                so_sem_experiencia: true,
                ...(bloco.estagio_indigena ?? {}),
                ativo,
              },
            })
          }
        />
      ) : null}
    </>
  );
}

function EditorEliminacao({
  eliminacao,
  aoMudar,
}: {
  eliminacao: EliminacaoAutomatica;
  aoMudar: (e: EliminacaoAutomatica) => void;
}) {
  const onde = eliminacao.coluna
    ? `Coluna ${eliminacao.coluna}`
    : eliminacao.coluna_prefixo
      ? `Colunas ${eliminacao.coluna_prefixo.trim()}…`
      : "Pergunta da Empregare (passo 3)";
  const regra = (eliminacao.quando ?? []).length
    ? `= ${(eliminacao.quando ?? []).join(" ou ")}`
    : `diferente de ${(eliminacao.exceto ?? []).join(" ou ")}`;
  return (
    <>
      <p className="avd-ast-regrinha">
        <i className="fa-solid fa-filter" aria-hidden="true" /> {onde} {regra}
      </p>
      <CampoTexto
        rotulo="Motivo (aparece em Eliminados)"
        largo
        valor={eliminacao.motivo}
        aoMudar={(motivo) => aoMudar({ ...eliminacao, motivo })}
      />
    </>
  );
}

function EditorCorte({
  regra,
  notaMinima,
  aoMudar,
}: {
  regra: RegraAnalise;
  notaMinima: number | null;
  aoMudar: (r: RegraAnalise) => void;
}) {
  const lote = regra.lote;
  const declarada = regra.provisoria.nota_declarada.length > 0;
  return (
    <>
      <div className="avd-linha">
        <CampoNumero
          rotulo="Pontos mínimos"
          valor={lote.nota_minima ?? null}
          aoMudar={(v) =>
            aoMudar({
              ...regra,
              lote: { ...lote, nota_minima: v as number | null },
            })
          }
        />
        <CampoTexto
          rotulo="Item do edital"
          maximo={40}
          valor={lote.item_edital ?? ""}
          aoMudar={(v) =>
            aoMudar({ ...regra, lote: { ...lote, item_edital: v || null } })
          }
        />
        {notaMinima !== null && notaMinima !== lote.nota_minima ? (
          <button
            type="button"
            className="btn ghost small"
            onClick={() =>
              aoMudar({ ...regra, lote: { ...lote, nota_minima: notaMinima } })
            }
          >
            Usar a nota mínima da classificação (
            {String(notaMinima).replace(".", ",")})
          </button>
        ) : null}
      </div>
      <Segmentado
        rotulo="Nota do corte e da ordem do lote"
        opcoes={(
          BASES_DA_NOTA_DO_LOTE as unknown as ReadonlyArray<
            readonly ["DECLARADA" | "ART", string]
          >
        ).map(([valor, rotulo]) => ({
          valor,
          rotulo,
        }))}
        valor={regra.provisoria.base_da_nota}
        aoMudar={(v) =>
          aoMudar({
            ...regra,
            provisoria: { ...regra.provisoria, base_da_nota: v },
          })
        }
      />
      {regra.provisoria.base_da_nota === "DECLARADA" && !declarada ? (
        <p className="avd-ast-alerta">Ligue a nota declarada no passo 3.</p>
      ) : null}
    </>
  );
}

/* ---------- O cartão ---------- */

function CartaoDoCardapio({
  cartao,
  regra,
  area,
  notaMinima,
  aoMudar,
  aoAlternar,
}: {
  cartao: Cartao;
  regra: RegraAnalise;
  area: string;
  notaMinima: number | null;
  aoMudar: (r: RegraAnalise) => void;
  aoAlternar: (c: Cartao, marcar: boolean) => void;
}) {
  const [recolhido, setRecolhido] = useState(false);
  const bloco = blocoDoCartao(regra, cartao);
  const eliminacao = eliminacaoDoCartao(regra, cartao);
  const mudarBloco = (b: Bloco) => aoMudar(comBloco(regra, cartao, b));
  const resumo = resumoDoCartao(regra, cartao);
  let campos: ReactNode = null;
  if (bloco) {
    if (bloco.tipo === "DOCUMENTO" || bloco.tipo === "REGISTRO")
      campos = <EditorDocumento bloco={bloco} aoMudar={mudarBloco} />;
    else if (bloco.tipo === "COTA")
      campos = <EditorCota bloco={bloco} aoMudar={mudarBloco} />;
    else if (bloco.tipo === "PONTUACAO")
      campos = <EditorEtnico bloco={bloco} aoMudar={mudarBloco} />;
    else if (bloco.tipo === "TITULOS")
      campos = <EditorTitulos bloco={bloco} aoMudar={mudarBloco} />;
    else if (bloco.tipo === "CURSOS")
      campos = <EditorCursos bloco={bloco} aoMudar={mudarBloco} />;
    else if (bloco.tipo === "VINCULOS")
      campos = (
        <EditorExperiencia bloco={bloco} aoMudar={mudarBloco} area={area} />
      );
  } else if (eliminacao)
    campos = (
      <EditorEliminacao
        eliminacao={eliminacao}
        aoMudar={(e) => aoMudar(comEliminacao(regra, cartao, e))}
      />
    );
  else if (cartao.corte && cartao.marcado)
    campos = (
      <EditorCorte regra={regra} notaMinima={notaMinima} aoMudar={aoMudar} />
    );
  const idDoCorpo = `avd-ast-cartao-${cartao.id.replace(/[^a-zA-Z0-9]+/g, "-")}`;
  return (
    <article
      className="avd-ast-cartao"
      data-marcado={cartao.marcado ? "sim" : "nao"}
      data-cartao={cartao.id}
    >
      <header className="avd-ast-cartao-topo">
        <label className="avd-ast-cartao-marca">
          <input
            type="checkbox"
            checked={cartao.marcado}
            onChange={(ev) => aoAlternar(cartao, ev.target.checked)}
          />
          <span className="avd-ast-cartao-rotulo">{cartao.rotulo}</span>
        </label>
        {resumo ? <span className="avd-ast-chip">{resumo}</span> : null}
        {cartao.marcado && campos ? (
          <button
            type="button"
            className="btn ghost small avd-ast-recolher"
            aria-expanded={!recolhido}
            aria-controls={idDoCorpo}
            aria-label={
              recolhido ? `Abrir ${cartao.rotulo}` : `Recolher ${cartao.rotulo}`
            }
            onClick={() => setRecolhido(!recolhido)}
          >
            <i
              className={`fa-solid ${recolhido ? "fa-chevron-down" : "fa-chevron-up"}`}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </header>
      {cartao.marcado && campos && !recolhido ? (
        <div className="avd-ast-cartao-corpo" id={idDoCorpo}>
          {campos}
        </div>
      ) : null}
    </article>
  );
}

export function PassoCardapio({
  regra,
  area,
  guardados,
  notaMinima,
  aoMudar,
  aoAlternar,
}: Props) {
  const cartoes = cartoesDaRegra(regra, { area, guardados });
  return (
    <div className="avd-ast-passo" data-tour="avd-assistente-cardapio">
      {GRUPOS_DO_CARDAPIO.map(([grupo, titulo]) => {
        const doGrupo = cartoes.filter((c) => c.grupo === grupo);
        if (!doGrupo.length && grupo !== "eliminatorios") return null;
        return (
          <section key={grupo} className="avd-ast-grupo" aria-label={titulo}>
            <h3 className="avd-ast-grupo-titulo">
              {titulo}
              <span className="avd-ast-contagem">
                {doGrupo.filter((c) => c.marcado).length}/{doGrupo.length}
              </span>
            </h3>
            <div className="avd-ast-cartoes">
              {doGrupo.map((c) => (
                <CartaoDoCardapio
                  key={c.id}
                  cartao={c}
                  regra={regra}
                  area={area}
                  notaMinima={notaMinima}
                  aoMudar={aoMudar}
                  aoAlternar={aoAlternar}
                />
              ))}
            </div>
            {grupo === "eliminatorios" ? (
              <BotaoMais aoClicar={() => aoMudar(comDocumentoNovo(regra))}>
                Outro documento eliminatório
              </BotaoMais>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
