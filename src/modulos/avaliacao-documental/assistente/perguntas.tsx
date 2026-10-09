import { useEffect, useRef, useState } from "react";
import {
  alternarDeclarada,
  comItemDaDeclarada,
  comPergunta,
  itensDaDeclarada,
  ligacoesDaRegra,
  ligarAutomaticamente,
  opcoesDePerguntas,
  parciaisDaRegra,
  perguntaComDadoPessoal,
  respostasDaPergunta,
  situacaoDaPergunta,
  type Ligacao,
  type OpcaoDePergunta,
  type ResultadoDaPergunta,
  type SituacaoDaPergunta,
} from "../../../lib/avaliacao-documental/assistente-da-regra.ts";
import {
  NIVEIS,
  TIPOS_DA_NOTA_DECLARADA,
} from "../../../lib/avaliacao-documental/catalogo.js";
import { chaveDaOpcao } from "../../../lib/avaliacao-documental/nota-declarada.js";
import type {
  ColunasDaVaga,
  ItemDaNotaDeclarada,
  MapaDeRespostas,
  Nivel,
  Parcial,
  Pergunta,
  PerguntaDaCarga,
  RegraAnalise,
} from "../../../lib/avaliacao-documental/tipos-da-regra.ts";
import { Aviso } from "../../../ui/index.js";
import {
  BotaoTirar,
  Caixa,
  CampoNumero,
  CampoPergunta,
  Escolha,
} from "../campos.jsx";

/*
  Passo 3: as perguntas da Empregare. O sistema lê as colunas "Pergunta N -"
  da última carga de cada vaga do edital e liga sozinho, pelo enunciado, o
  bloco que ainda não tem pergunta. Cada pergunta da regra aparece com a cor
  do que acha nas vagas (verde: uma coluna; amarelo: ambígua; vermelho: não
  achou) e se escolhe numa lista. A nota declarada (as respostas que valem
  pontos na inscrição) fica aqui também.
*/

type Props = {
  regra: RegraAnalise;
  vagas: ReadonlyArray<ColunasDaVaga>;
  perguntasDaCarga: ReadonlyArray<PerguntaDaCarga>;
  carregando: boolean;
  aoMudar: (regra: RegraAnalise) => void;
};

const SITUACOES: Record<
  SituacaoDaPergunta,
  { rotulo: string; tom: string; icone: string }
> = {
  achou: { rotulo: "Achou", tom: "sucesso", icone: "fa-circle-check" },
  ambigua: {
    rotulo: "Ambígua",
    tom: "alerta",
    icone: "fa-triangle-exclamation",
  },
  nao_achou: { rotulo: "Não achou", tom: "perigo", icone: "fa-circle-xmark" },
  vazia: { rotulo: "Sem pergunta", tom: "perigo", icone: "fa-circle-xmark" },
  sem_carga: {
    rotulo: "Sem carga",
    tom: "neutro",
    icone: "fa-circle-question",
  },
};

function Situacao({ resultado }: { resultado: ResultadoDaPergunta }) {
  const s = SITUACOES[resultado.situacao];
  const detalhe =
    resultado.situacao === "achou" && resultado.vagas
      ? `em ${resultado.comUma} de ${resultado.vagas} vagas`
      : resultado.situacao === "ambigua"
        ? `${resultado.ambiguas.length} vaga(s) com mais de uma coluna`
        : "";
  return (
    <span
      className="avd-ast-situacao"
      data-tom={s.tom}
      data-situacao={resultado.situacao}
    >
      <i className={`fa-solid ${s.icone}`} aria-hidden="true" />
      {s.rotulo}
      {detalhe ? (
        <span className="avd-ast-situacao-detalhe"> · {detalhe}</span>
      ) : null}
    </span>
  );
}

function EscolherDaLista({
  opcoes,
  total,
  rotulo,
  aoEscolher,
}: {
  opcoes: ReadonlyArray<OpcaoDePergunta>;
  total: number;
  rotulo: string;
  aoEscolher: (texto: string) => void;
}) {
  if (!opcoes.length) return null;
  return (
    <label className="avd-ast-lista-de-perguntas">
      <span className="avd-ast-visualmente-oculto">{rotulo}</span>
      <select
        value=""
        aria-label={rotulo}
        onChange={(ev) => {
          if (ev.target.value) aoEscolher(ev.target.value);
        }}
      >
        <option value="">Escolher da lista…</option>
        {opcoes.map((o) => (
          <option key={o.texto} value={o.texto} title={o.coluna}>
            {o.texto} ({o.vagas} de {total})
          </option>
        ))}
      </select>
    </label>
  );
}

function LinhaDaPergunta({
  ligacao,
  regra,
  vagas,
  opcoes,
  aoMudar,
}: {
  ligacao: Ligacao;
  regra: RegraAnalise;
  vagas: ReadonlyArray<ColunasDaVaga>;
  opcoes: ReadonlyArray<OpcaoDePergunta>;
  aoMudar: (r: RegraAnalise) => void;
}) {
  const resultado = situacaoDaPergunta(ligacao.pergunta, vagas);
  const trocar = (texto: Pergunta | null) =>
    aoMudar(comPergunta(regra, ligacao, texto));
  return (
    <li
      className="avd-ast-pergunta"
      data-ligacao={ligacao.id}
      data-situacao={resultado.situacao}
    >
      <Situacao resultado={resultado} />
      <div className="avd-ast-pergunta-campos">
        <CampoPergunta
          key={`${ligacao.id}:${JSON.stringify(ligacao.pergunta)}`}
          rotulo={
            ligacao.grupo === "bloco" ? "Começo do enunciado" : ligacao.rotulo
          }
          largo
          valor={ligacao.pergunta}
          aoMudar={(v) => trocar(v)}
        />
        <EscolherDaLista
          opcoes={opcoes}
          total={vagas.length}
          rotulo={`Escolher a pergunta de ${ligacao.rotulo}`}
          aoEscolher={(texto) => trocar(texto)}
        />
        {ligacao.grupo === "bloco" && ligacao.indice !== undefined ? (
          <BotaoTirar rotulo="Tirar a pergunta" aoClicar={() => trocar(null)} />
        ) : null}
      </div>
      {resultado.situacao === "ambigua" ? (
        <ul className="avd-ast-colunas">
          {resultado.ambiguas[0]?.colunas.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/* ---------- Nota declarada ---------- */

const NIVEIS_DA_DECLARADA: ReadonlyArray<Nivel> = [
  "superior",
  "tecnico",
  "medio",
];
const ROTULO_DO_NIVEL = Object.fromEntries(
  NIVEIS as unknown as ReadonlyArray<readonly [string, string]>,
);
const ROTULO_DA_PARCIAL: Record<Parcial, string> = {
  ETNICO: "Critério étnico",
  FORMACAO: "Titulação",
  CURSOS: "Cursos",
  EXPERIENCIA: "Experiência",
};
const TIPOS = TIPOS_DA_NOTA_DECLARADA as unknown as ReadonlyArray<
  readonly [ItemDaNotaDeclarada["tipo"], string]
>;

function comPontosPorNivel(
  item: ItemDaNotaDeclarada,
  ligar: boolean,
): ItemDaNotaDeclarada {
  const novo = { ...item };
  if (ligar) {
    const base = item.pontos ?? {};
    novo.pontos_por_nivel = Object.fromEntries(
      NIVEIS_DA_DECLARADA.map((n) => [n, { ...base }]),
    );
    delete novo.pontos;
  } else {
    const primeiro = Object.values(item.pontos_por_nivel ?? {})[0];
    novo.pontos = { ...(primeiro ?? {}) };
    delete novo.pontos_por_nivel;
  }
  return novo;
}

function ItemDeclarado({
  item,
  indice,
  regra,
  vagas,
  opcoes,
  perguntasDaCarga,
  aoMudar,
}: {
  item: ItemDaNotaDeclarada;
  indice: number;
  regra: RegraAnalise;
  vagas: ReadonlyArray<ColunasDaVaga>;
  opcoes: ReadonlyArray<OpcaoDePergunta>;
  perguntasDaCarga: ReadonlyArray<PerguntaDaCarga>;
  aoMudar: (r: RegraAnalise) => void;
}) {
  const mudar = (novo: ItemDaNotaDeclarada) =>
    aoMudar(comItemDaDeclarada(regra, indice, novo));
  const porNivel =
    item.tipo !== "FAIXA_EM_MESES" && Boolean(item.pontos_por_nivel);
  const chave: "pontos" | "meses" =
    item.tipo === "FAIXA_EM_MESES" ? "meses" : "pontos";
  const niveis = porNivel
    ? NIVEIS_DA_DECLARADA.filter((n) => item.pontos_por_nivel?.[n])
    : [];
  const mapas: MapaDeRespostas[] = porNivel
    ? niveis.map((n) => item.pontos_por_nivel?.[n] ?? {})
    : [item[chave] ?? {}];
  const naCarga = respostasDaPergunta(item.pergunta, perguntasDaCarga);
  const dadoPessoal = perguntaComDadoPessoal(item.pergunta, perguntasDaCarga);
  const respostas = [
    ...new Map(
      [
        ...mapas.flatMap((m) => Object.keys(m)),
        ...naCarga.map((r) => r.valor),
      ].map((v) => [chaveDaOpcao(v), v]),
    ).values(),
  ];
  const quantas = new Map(
    naCarga.map((r) => [chaveDaOpcao(r.valor), r.quantidade]),
  );
  const valorNo = (mapa: MapaDeRespostas, resposta: string) => {
    const k = Object.keys(mapa).find(
      (x) => chaveDaOpcao(x) === chaveDaOpcao(resposta),
    );
    return k === undefined ? null : mapa[k];
  };
  const comValor = (
    mapa: MapaDeRespostas,
    resposta: string,
    valor: number | string | null,
  ) => {
    const novo = { ...mapa };
    const k =
      Object.keys(novo).find(
        (x) => chaveDaOpcao(x) === chaveDaOpcao(resposta),
      ) ?? resposta;
    if (valor === null || valor === "") delete novo[k];
    else novo[k] = valor as number;
    return novo;
  };
  const definir = (
    resposta: string,
    valor: number | string | null,
    nivel?: Nivel,
  ) => {
    if (porNivel && nivel)
      mudar({
        ...item,
        pontos_por_nivel: {
          ...item.pontos_por_nivel,
          [nivel]: comValor(
            item.pontos_por_nivel?.[nivel] ?? {},
            resposta,
            valor,
          ),
        },
      });
    else
      mudar({ ...item, [chave]: comValor(item[chave] ?? {}, resposta, valor) });
  };
  const ligacao: Ligacao = {
    id: `declarada:${indice}`,
    grupo: "declarada",
    rotulo: `Nota declarada · ${ROTULO_DA_PARCIAL[item.parcial]}`,
    pergunta: item.pergunta,
    indice,
  };
  const [novaResposta, setNovaResposta] = useState("");
  return (
    <div className="avd-ast-declarada" data-parcial={item.parcial}>
      <ul className="avd-ast-lista-de-ligacoes">
        <LinhaDaPergunta
          ligacao={ligacao}
          regra={regra}
          vagas={vagas}
          opcoes={opcoes}
          aoMudar={aoMudar}
        />
      </ul>
      <div className="avd-linha">
        <Escolha
          rotulo="Como pontua"
          valor={item.tipo}
          opcoes={TIPOS}
          aoMudar={(v) => {
            const tipo = (v ?? "OPCAO") as ItemDaNotaDeclarada["tipo"];
            const base =
              tipo === "FAIXA_EM_MESES" && porNivel
                ? comPontosPorNivel(item, false)
                : { ...item };
            if (tipo === "FAIXA_EM_MESES") {
              base.meses = base.meses ?? base.pontos ?? {};
              delete base.pontos;
              base.pontos_por_mes = item.pontos_por_mes ?? 0;
            } else if (!base.pontos_por_nivel) {
              base.pontos = base.pontos ?? base.meses ?? {};
              delete base.meses;
              delete base.pontos_por_mes;
            }
            mudar({ ...base, tipo });
          }}
        />
        {item.tipo === "FAIXA_EM_MESES" ? (
          <CampoNumero
            rotulo="Pontos por mês"
            valor={item.pontos_por_mes}
            aoMudar={(v) => mudar({ ...item, pontos_por_mes: v as number })}
          />
        ) : (
          <Caixa
            rotulo="Pontos por nível"
            marcado={porNivel}
            aoMudar={(v) => mudar(comPontosPorNivel(item, v))}
          />
        )}
        <CampoNumero
          rotulo="Teto"
          valor={item.teto ?? null}
          aoMudar={(v) => {
            const novo: ItemDaNotaDeclarada = { ...item };
            if (v === null) delete novo.teto;
            else novo.teto = v as number;
            mudar(novo);
          }}
        />
      </div>
      {dadoPessoal ? (
        <p className="ui-texto-secundario" data-dado-pessoal="sim">
          Dado pessoal — não resumido
        </p>
      ) : null}
      <div className="avd-ast-tabela-rolagem">
        <table className="avd-ast-tabela">
          <thead>
            <tr>
              <th scope="col">Resposta</th>
              <th scope="col">Na carga</th>
              {porNivel ? (
                niveis.map((n) => (
                  <th scope="col" key={n}>
                    {ROTULO_DO_NIVEL[n]}
                  </th>
                ))
              ) : (
                <th scope="col">{chave === "meses" ? "Meses" : "Pontos"}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {respostas.map((resposta) => {
              const semPontos = mapas.some(
                (m) => valorNo(m, resposta) === null,
              );
              return (
                <tr
                  key={resposta}
                  data-sem-pontos={semPontos ? "sim" : undefined}
                >
                  <th scope="row">
                    {resposta}
                    {semPontos ? (
                      <span className="avd-ast-alerta"> · sem pontos</span>
                    ) : null}
                  </th>
                  <td>{quantas.get(chaveDaOpcao(resposta)) ?? "—"}</td>
                  {(porNivel ? niveis : [undefined]).map((n, j) => (
                    <td key={n ?? "geral"}>
                      <input
                        inputMode="decimal"
                        aria-label={`${resposta}${n ? `, ${ROTULO_DO_NIVEL[n]}` : ""}`}
                        placeholder="—"
                        value={(() => {
                          const v = valorNo(mapas[j] ?? {}, resposta);
                          return v === null ? "" : String(v).replace(".", ",");
                        })()}
                        onChange={(ev) => {
                          const texto = ev.target.value
                            .trim()
                            .replace(",", ".");
                          definir(
                            resposta,
                            texto === ""
                              ? null
                              : Number.isFinite(Number(texto))
                                ? Number(texto)
                                : texto,
                            n,
                          );
                        }}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <label className="avd-inline">
        Outra resposta{" "}
        <input
          value={novaResposta}
          placeholder="Texto exato da resposta"
          onChange={(ev) => setNovaResposta(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key !== "Enter") return;
            ev.preventDefault();
            const texto = novaResposta.trim();
            if (!texto) return;
            if (porNivel)
              mudar({
                ...item,
                pontos_por_nivel: Object.fromEntries(
                  niveis.map((n) => [
                    n,
                    { ...(item.pontos_por_nivel?.[n] ?? {}), [texto]: 0 },
                  ]),
                ),
              });
            else
              mudar({
                ...item,
                [chave]: { ...(item[chave] ?? {}), [texto]: 0 },
              });
            setNovaResposta("");
          }}
        />
      </label>
    </div>
  );
}

export function PassoPerguntas({
  regra,
  vagas,
  perguntasDaCarga,
  carregando,
  aoMudar,
}: Props) {
  const opcoes = opcoesDePerguntas(vagas);
  const [aviso, setAviso] = useState("");
  const ligouSozinho = useRef(false);
  useEffect(() => {
    if (ligouSozinho.current || !vagas.length) return;
    ligouSozinho.current = true;
    const { regra: ligada, ligadas } = ligarAutomaticamente(regra, vagas);
    if (ligadas) {
      aoMudar(ligada);
      setAviso(
        `${ligadas} pergunta(s) ligada(s) pelo enunciado. Confira as cores.`,
      );
    }
  }, [regra, vagas, aoMudar]);

  const ligacoes = ligacoesDaRegra(regra);
  const situacoes = ligacoes.map(
    (l) => situacaoDaPergunta(l.pergunta, vagas).situacao,
  );
  const contar = (s: SituacaoDaPergunta[]) =>
    situacoes.filter((x) => s.includes(x)).length;
  const blocos = regra.blocos;
  const outras = ligacoes.filter(
    (l) => l.grupo === "experiencia" || l.grupo === "eliminacao",
  );

  return (
    <div className="avd-ast-passo" data-tour="avd-assistente-perguntas">
      <div className="avd-ast-legenda" aria-live="polite">
        <span className="avd-ast-situacao" data-tom="sucesso">
          <i className="fa-solid fa-circle-check" aria-hidden="true" />{" "}
          {contar(["achou"])} achadas
        </span>
        <span className="avd-ast-situacao" data-tom="alerta">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{" "}
          {contar(["ambigua"])} ambíguas
        </span>
        <span className="avd-ast-situacao" data-tom="perigo">
          <i className="fa-solid fa-circle-xmark" aria-hidden="true" />{" "}
          {contar(["nao_achou", "vazia"])} sem coluna
        </span>
        <span className="ui-texto-secundario">
          {vagas.length} vaga(s) com carga
        </span>
        <button
          type="button"
          className="btn secondary small"
          data-acao="ligar-automaticamente"
          disabled={!vagas.length}
          onClick={() => {
            const { regra: ligada, ligadas } = ligarAutomaticamente(
              regra,
              vagas,
            );
            if (ligadas) aoMudar(ligada);
            setAviso(
              ligadas
                ? `${ligadas} pergunta(s) ligada(s) pelo enunciado.`
                : "Nada novo para ligar.",
            );
          }}
        >
          <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />{" "}
          Ligar automaticamente
        </button>
      </div>
      {aviso ? (
        <Aviso tom="info" papel="status">
          {aviso}
        </Aviso>
      ) : null}
      {!vagas.length && !carregando ? (
        <Aviso tom="warning">
          Sem carga da Empregare neste edital: as perguntas ficam sem
          conferência.
        </Aviso>
      ) : null}

      <section className="avd-ast-grupo" aria-label="Perguntas dos blocos">
        <h3 className="avd-ast-grupo-titulo">Blocos da ficha</h3>
        {blocos.map((b) => {
          const doBloco = ligacoes.filter(
            (l) => l.grupo === "bloco" && l.codigo === b.codigo,
          );
          const vazio = doBloco.find((l) => l.pergunta === null);
          return (
            <div
              key={b.codigo}
              className="avd-ast-bloco-de-perguntas"
              data-bloco={b.codigo}
            >
              <h4>{b.titulo || b.codigo}</h4>
              <ul className="avd-ast-lista-de-ligacoes">
                {doBloco
                  .filter((l) => l.pergunta !== null)
                  .map((l) => (
                    <LinhaDaPergunta
                      key={l.id}
                      ligacao={l}
                      regra={regra}
                      vagas={vagas}
                      opcoes={opcoes}
                      aoMudar={aoMudar}
                    />
                  ))}
              </ul>
              <div className="avd-inline">
                {vazio ? (
                  <span className="avd-ast-situacao" data-tom="neutro">
                    <i
                      className="fa-solid fa-circle-minus"
                      aria-hidden="true"
                    />{" "}
                    Sem pergunta
                  </span>
                ) : null}
                <EscolherDaLista
                  opcoes={opcoes}
                  total={vagas.length}
                  rotulo={`Acrescentar pergunta a ${b.titulo || b.codigo}`}
                  aoEscolher={(texto) =>
                    aoMudar(
                      comPergunta(
                        regra,
                        {
                          id: `bloco:${b.codigo}:novo`,
                          grupo: "bloco",
                          rotulo: b.titulo,
                          pergunta: null,
                          codigo: b.codigo,
                        },
                        texto,
                        {
                          adicionar: true,
                        },
                      ),
                    )
                  }
                />
              </div>
            </div>
          );
        })}
      </section>

      <section
        className="avd-ast-grupo"
        aria-label="Nota declarada na inscrição"
        data-tour="avd-assistente-declarada"
      >
        <h3 className="avd-ast-grupo-titulo">Nota declarada na inscrição</h3>
        {parciaisDaRegra(regra).map((parcial) => {
          const indices = itensDaDeclarada(regra, parcial);
          return (
            <div
              key={parcial}
              className="avd-ast-cartao"
              data-marcado={indices.length ? "sim" : "nao"}
            >
              <header className="avd-ast-cartao-topo">
                <label className="avd-ast-cartao-marca">
                  <input
                    type="checkbox"
                    checked={indices.length > 0}
                    onChange={(ev) =>
                      aoMudar(
                        alternarDeclarada(regra, parcial, ev.target.checked, {
                          perguntasDaCarga,
                        }),
                      )
                    }
                  />
                  <span className="avd-ast-cartao-rotulo">
                    {ROTULO_DA_PARCIAL[parcial]} conta na nota declarada
                  </span>
                </label>
              </header>
              {indices.map((i) => {
                const item = regra.provisoria.nota_declarada[i];
                return item ? (
                  <div className="avd-ast-cartao-corpo" key={i}>
                    <ItemDeclarado
                      item={item}
                      indice={i}
                      regra={regra}
                      vagas={vagas}
                      opcoes={opcoes}
                      perguntasDaCarga={perguntasDaCarga}
                      aoMudar={aoMudar}
                    />
                  </div>
                ) : null;
              })}
            </div>
          );
        })}
      </section>

      {outras.length ? (
        <section className="avd-ast-grupo" aria-label="Outras perguntas">
          <h3 className="avd-ast-grupo-titulo">Desempate e eliminação</h3>
          <ul className="avd-ast-lista-de-ligacoes">
            {outras.map((l) => (
              <LinhaDaPergunta
                key={l.id}
                ligacao={l}
                regra={regra}
                vagas={vagas}
                opcoes={opcoes}
                aoMudar={aoMudar}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
