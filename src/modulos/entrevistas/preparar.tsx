import { useEffect, useMemo, useRef, useState } from "react";
import {
  bancasDoEdital,
  dadosDaConfiguracaoParaSalvar,
  errosDaConfiguracao,
  rascunhoDaConfiguracao,
  rotuloDoLancamento,
} from "../../lib/conducao-de-entrevista.js";
import {
  aConvocar,
  criteriosDeDesempate,
  fonteDaConvocacao,
  gruposDaConvocacao,
  resumoDaConvocacao,
  textoDoEmpateFinal,
} from "../../lib/convocacao-da-entrevista.js";
import { hojeEmBrasilia } from "../../lib/fila-de-conducao.ts";
import { rotuloDaVersao } from "../../lib/nome-da-versao.ts";
import {
  agendaPorDia,
  passoInicial,
  passosDoPreparar,
  pendenciasDaConfiguracao,
  textoDoAndamento,
  type IdDoPasso,
  type PassoDoPreparar,
} from "../../lib/passos-do-preparar.ts";
import {
  frasesDaBanca,
  resumoDasRegrasDaEntrevista,
  type DestinoDoResumo,
  type EntradaDoResumo,
} from "../../lib/resumo-da-entrevista.ts";
import { textoDaPontuacao } from "../../lib/roteiro-de-entrevista.js";
import { Aviso, EstadoVazio, Selo } from "../../ui/index.js";
import { irParaLink } from "../chat/ponte.js";
import {
  BotaoIrPara,
  ConvocacaoDaClassificacao,
  ListaDeConvocacao,
} from "./conducao.jsx";
import {
  BarraDaConfiguracao,
  CampoDoRoteiro,
  CamposDaBanca,
  type RascunhoDaConfiguracao,
  type RoteiroDaLista,
} from "./configuracao-do-edital.tsx";
import { ResumoDasRegras, TabelaDasVagas } from "./resumo-das-regras.tsx";
import type { PedidoDeRoteiro } from "./tipos-do-editor-de-roteiro.ts";
import { VisaoDeRoteiros } from "./roteiros.tsx";
import type {
  DadosDoEdital,
  EstadoDaConducao,
  EstadoDaConducaoComAcoes,
  Resultado,
} from "./tipos.ts";

/*
  "Preparar" o edital aberto em Conduzir entrevistas, em PASSOS guiados como
  o assistente da regra da Avaliação documental:

    1 Roteiro     qual roteiro (a versão com nome) e como a nota sai; os
                  roteiros da área ficam aqui (editar, duplicar, novo);
    2 Banca       membros, origem, banca nº e as competências que cada um
                  avalia; o modo de lançamento;
    3 Convocação  quem é chamado (a frase simples e a tabela de vagas da
                  Classificação) e a lista para convocar;
    4 Agenda      dia, horário e banca de cada convocado (montada na
                  Classificação › Agenda; aqui só se lê).

  Cada passo tem o estado (feito / pendente) e a lista do que falta
  (src/lib/passos-do-preparar.ts); Preparar abre no primeiro pendente. O
  resumo "Regras da entrevista" fica no topo. Os passos 1 e 2 editam o mesmo
  rascunho da configuração (configuracao-do-edital.tsx) e o "Salvar
  configuração" grava os dois de uma vez, com a lista do que falta ao lado.
  Quem só lê vê tudo sem os botões.
*/

type Dados = DadosDoEdital & {
  convocados: (DadosDoEdital["convocados"][number] & {
    avaliacoes?: unknown[] | null;
  })[];
};
type Fonte = { tipo: string; resultado: unknown; lista?: unknown };
type GrupoDaConvocacao = {
  vaga: string;
  cargo?: string | null;
  total: number | null;
  candidatos: unknown[];
};

/* O que o resumo das regras mostra, a partir do payload e da convocação. */
function entradaDoResumo(
  dados: Dados,
  fonte: Fonte | null,
  grupos: GrupoDaConvocacao[],
): EntradaDoResumo {
  const regra = dados.regra_classificacao || null;
  return {
    temRegra: Boolean(regra),
    convocacao: (regra?.convocacao ?? null) as EntradaDoResumo["convocacao"],
    vagas: grupos.filter(
      (g) => g.candidatos.length || g.total !== null,
    ) as EntradaDoResumo["vagas"],
    roteiro: (dados.configuracao?.roteiro ??
      null) as EntradaDoResumo["roteiro"],
    avaliadores: (dados.avaliadores || []) as EntradaDoResumo["avaliadores"],
    lancamento: dados.configuracao?.lancamento || null,
    desempate: criteriosDeDesempate(regra) as EntradaDoResumo["desempate"],
    empateFinal: textoDoEmpateFinal(regra) as string,
    convocados:
      fonte?.tipo === "LISTA"
        ? (resumoDaConvocacao(grupos) as EntradaDoResumo["convocados"])
        : null,
  };
}

/* As regras em JavaScript, com os contratos que esta tela usa. */
const errosDaConfiguracaoDo = errosDaConfiguracao as unknown as (
  rascunho: unknown,
  roteiro?: unknown,
) => Record<string, string>;
const paraSalvar = dadosDaConfiguracaoParaSalvar;
const fonteDaConvocacaoDo = fonteDaConvocacao as unknown as (
  dados: unknown,
  resultado?: unknown,
) => Fonte;

const ordem = (a: { ordem?: number | null }, b: { ordem?: number | null }) =>
  (a.ordem ?? 0) - (b.ordem ?? 0);

/* ── Passo 1: roteiro ──────────────────────────────────────────────── */

function RoteiroEscolhido({ dados }: { dados: Dados }) {
  const roteiro = dados.configuracao?.roteiro;
  if (!roteiro) return null;
  const competencias = [...(roteiro.competencias || [])].sort(ordem);
  const aspectos = [...(roteiro.aspectos || [])].sort(ordem);
  return (
    <div
      className="entrevistas-roteiro-escolhido"
      data-bloco="roteiro-do-edital"
    >
      <div className="entrevistas-roteiro-escolhido-topo">
        <i className="fa-solid fa-clipboard-check" aria-hidden="true" />
        <div>
          <strong>{roteiro.nome}</strong>
          <span>
            {rotuloDaVersao({
              versao: roteiro.versao,
              nome: roteiro.nome_versao,
            })}{" "}
            · {textoDaPontuacao(roteiro)}
          </span>
        </div>
      </div>
      <dl className="entrevistas-roteiro-escolhido-itens">
        <div>
          <dt>Competências</dt>
          <dd>
            <ol>
              {competencias.map((c) => (
                <li key={c.id}>{c.nome}</li>
              ))}
            </ol>
          </dd>
        </div>
        {aspectos.length ? (
          <div>
            <dt>Cada competência em</dt>
            <dd>{aspectos.map((a) => a.nome).join(" · ")}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

/* ── Passo 2: banca ────────────────────────────────────────────────── */

function BancaGravada({ dados }: { dados: Dados }) {
  const roteiro = dados.configuracao?.roteiro || null;
  const competencias = [...(roteiro?.competencias || [])].sort(ordem);
  const ativos = (dados.avaliadores || []).filter((a) => a.ativo !== false);
  if (!ativos.length) return null;
  const bancas = bancasDoEdital(ativos) as number[];
  const nomeDa = (id: string) =>
    competencias.find((c) => c.id === id)?.nome || id;
  return (
    <div className="entrevistas-banca-gravada" data-bloco="banca-do-edital">
      <p className="entrevistas-banca-lancamento">
        <i className="fa-solid fa-keyboard" aria-hidden="true" />{" "}
        {rotuloDoLancamento(dados.configuracao?.lancamento)}
      </p>
      <div className="entrevistas-bancas">
        {bancas.map((b) => (
          <article key={b} className="entrevistas-banca" data-banca={b}>
            <h4>Banca {b}</h4>
            <ul>
              {ativos
                .filter((a) => Number(a.banca) === Number(b))
                .map((a) => {
                  const membro = a as typeof a & {
                    nome?: string;
                    origem?: string;
                  };
                  const so = Array.isArray(a.competencias)
                    ? a.competencias
                    : null;
                  return (
                    <li key={a.id}>
                      <strong>{membro.nome}</strong>
                      {membro.origem ? <span> · {membro.origem}</span> : null}
                      <small>
                        {so && so.length < competencias.length
                          ? `Avalia só ${so.map(nomeDa).join(", ")}`
                          : "Avalia todas as competências"}
                      </small>
                    </li>
                  );
                })}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ── Passo 4: agenda ───────────────────────────────────────────────── */

function AgendaDoEdital({ e, dados }: { e: EstadoDaConducao; dados: Dados }) {
  const { dias, semHorario } = useMemo(
    () => agendaPorDia(e.agenda, dados.convocados, hojeEmBrasilia()),
    [e.agenda, dados.convocados],
  );
  return (
    <div className="entrevistas-agenda-do-edital" data-bloco="agenda">
      {dias.length ? (
        dias.map((d) => (
          <section key={d.data} className="entrevistas-agenda-dia-bloco">
            <h4>
              {d.rotulo} <small>{d.linhas.length}</small>
            </h4>
            <div className="entrevistas-tabela-rolagem">
              <table className="entrevistas-tabela entrevistas-tabela-curta">
                <thead>
                  <tr>
                    <th scope="col">Horário</th>
                    <th scope="col">Candidato</th>
                    <th scope="col">Vaga</th>
                    <th scope="col">Banca</th>
                  </tr>
                </thead>
                <tbody>
                  {d.linhas.map((l) => (
                    <tr key={l.id}>
                      <td>
                        {l.inicio}
                        {l.fim ? `–${l.fim}` : ""}
                      </td>
                      <td>
                        <span className="ui-texto-principal">{l.nome}</span>
                        {l.codigo ? (
                          <span className="ui-texto-secundario">
                            Cód. {l.codigo}
                          </span>
                        ) : null}
                      </td>
                      <td>{l.vaga || "—"}</td>
                      <td>{l.banca ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      ) : (
        <EstadoVazio>Nenhum horário salvo para este edital.</EstadoVazio>
      )}
      {dias.length && semHorario.length ? (
        <p className="entrevistas-vazio-linha">
          Sem horário: {semHorario.map((c) => c.candidato).join(", ")}.
        </p>
      ) : null}
      <div className="entrevistas-acoes">
        <BotaoIrPara view="classificacao" edital={dados.edital}>
          <i className="fa-solid fa-calendar-days" aria-hidden="true" />{" "}
          {dias.length
            ? "Editar a agenda na Classificação"
            : "Montar a agenda na Classificação"}
        </BotaoIrPara>
      </div>
    </div>
  );
}

/* ── Os passos ─────────────────────────────────────────────────────── */

function NavegacaoDosPassos({
  passos,
  atual,
  aoEscolher,
}: {
  passos: PassoDoPreparar[];
  atual: number;
  aoEscolher: (i: number) => void;
}) {
  return (
    <nav
      className="entrevistas-passos"
      aria-label="Passos da preparação"
      data-tour="entrevistas-preparar-passos"
    >
      <ol>
        {passos.map((p, i) => (
          <li
            key={p.id}
            data-estado={i === atual ? "atual" : p.estado}
            data-passo={p.id}
          >
            <button
              type="button"
              data-passo={p.id}
              aria-current={i === atual ? "step" : undefined}
              aria-label={`${i + 1}. ${p.rotulo}: ${p.estado === "feito" ? "pronto" : "pendente"}`}
              onClick={() => aoEscolher(i)}
            >
              <span className="entrevistas-passo-numero" aria-hidden="true">
                {p.estado === "feito" ? (
                  <i className="fa-solid fa-check" />
                ) : (
                  i + 1
                )}
              </span>
              <span className="entrevistas-passo-rotulo">{p.rotulo}</span>
              <span className="entrevistas-passo-resumo">
                {p.estado === "feito" ? p.resumo : "Pendente"}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function PrepararDoEdital({
  conducao,
  e,
  dados,
}: {
  conducao: EstadoDaConducaoComAcoes;
  e: EstadoDaConducao;
  dados: Dados;
}) {
  const podeEditar = Boolean(dados.pode_editar);
  const configurado = Boolean(dados.configuracao);
  const roteiro = dados.configuracao?.roteiro || null;
  const acao = e.acao?.tipo || "";
  const corpo = useRef<HTMLDivElement>(null);

  /* A convocação é a lista da Classificação (sem ela, o cálculo atual, só para ver). */
  const calculo = e.calculo;
  const fonte = useMemo(
    () => fonteDaConvocacaoDo(dados, calculo?.resultado),
    [dados, calculo],
  );
  const grupos = useMemo(
    () =>
      gruposDaConvocacao(
        fonte.resultado,
        dados.convocados,
      ) as GrupoDaConvocacao[],
    [fonte, dados],
  );
  const entrada = useMemo(
    () => entradaDoResumo(dados, fonte, grupos),
    [dados, fonte, grupos],
  );

  /* O rascunho da configuração (passos 1 e 2). */
  const [editando, setEditando] = useState(!configurado && podeEditar);
  const [r, setR] = useState(
    () => rascunhoDaConfiguracao(dados) as RascunhoDaConfiguracao,
  );
  const [tentou, setTentou] = useState(false);
  const [erroDoBanco, setErroDoBanco] = useState("");
  useEffect(() => {
    if (!editando)
      setR(rascunhoDaConfiguracao(dados) as RascunhoDaConfiguracao);
  }, [dados, editando]);

  const opcoes = useMemo(() => {
    const lista = e.roteiros.lista.slice();
    if (roteiro && !lista.some((x) => x.id === roteiro.id))
      lista.unshift(roteiro);
    return lista;
  }, [e.roteiros.lista, roteiro]);
  const escolhido = opcoes.find((x) => x.id === r.roteiro) || null;
  const competencias = useMemo(
    () =>
      [...(escolhido?.competencias || [])]
        .sort(ordem)
        .map((c) => ({ id: c.id, nome: c.nome })),
    [escolhido],
  );
  const erros = useMemo(
    () => errosDaConfiguracaoDo(r, escolhido),
    [r, escolhido],
  );
  const pendencias = useMemo(
    () => pendenciasDaConfiguracao(erros, r.avaliadores),
    [erros, r.avaliadores],
  );
  const errosVisiveis = tentou ? erros : {};

  /* Os passos com o que está gravado. */
  const errosGravados = useMemo(
    () =>
      configurado
        ? errosDaConfiguracaoDo(rascunhoDaConfiguracao(dados), roteiro)
        : {},
    [configurado, dados, roteiro],
  );
  const ativos = (dados.avaliadores || []).filter((a) => a.ativo !== false);
  const resumo = resumoDaConvocacao(grupos) as {
    naFicha: number;
    naLista: number;
  };
  const passos = useMemo(
    () =>
      passosDoPreparar({
        roteiro: roteiro
          ? {
              nome: roteiro.nome,
              rotuloDaVersao: rotuloDaVersao({
                versao: roteiro.versao,
                nome: roteiro.nome_versao,
              }),
            }
          : null,
        membros: configurado ? ativos.length : 0,
        bancas: (bancasDoEdital(ativos) as number[]).length,
        errosDaBanca: pendenciasDaConfiguracao(
          errosGravados,
          (rascunhoDaConfiguracao(dados) as RascunhoDaConfiguracao).avaliadores,
        )
          .filter((p) => p.passo === "banca")
          .map((p) => p.texto),
        convocacao: {
          temLista: fonte.tipo === "LISTA",
          naLista: resumo.naLista,
          naFicha: dados.convocados.length,
          aConvocar:
            fonte.tipo === "LISTA" ? (aConvocar(grupos) as string[]).length : 0,
        },
        agenda: {
          comHorario: agendaPorDia(e.agenda, dados.convocados, "").dias.reduce(
            (n, d) => n + d.linhas.length,
            0,
          ),
          convocados: dados.convocados.length,
        },
      }),
    [
      roteiro,
      configurado,
      ativos,
      errosGravados,
      fonte,
      resumo.naLista,
      dados.convocados,
      grupos,
      e.agenda,
    ],
  );
  const [atual, setAtual] = useState(() => passoInicial(passos));
  const passo = passos[atual] ?? passos[0]!;

  /* O pedido de abrir um roteiro no editor (o "Editar" de "Como a nota é calculada"). */
  const [pedido, setPedido] = useState<PedidoDeRoteiro | null>(null);

  function irAoPasso(id: IdDoPasso) {
    const i = passos.findIndex((p) => p.id === id);
    if (i >= 0) setAtual(i);
    corpo.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }
  function ir(destino: DestinoDoResumo) {
    if (destino === "classificacao")
      irParaLink({
        view: "classificacao",
        edital: { id: dados.edital?.id, titulo: dados.edital?.edital || "" },
      });
    else if (destino === "roteiro" && roteiro) {
      irAoPasso("roteiro");
      setPedido((p) => ({ roteiro, vez: (p?.vez ?? 0) + 1 }));
    } else if (destino === "convocacao") irAoPasso("convocacao");
    else {
      setEditando(true);
      irAoPasso("banca");
    }
  }
  function podeIr(destino: DestinoDoResumo) {
    if (destino === "classificacao") return Boolean(dados.pode_gerar_lista);
    if (destino === "convocacao") return true;
    if (destino === "roteiro") return Boolean(roteiro);
    return podeEditar;
  }

  async function salvar() {
    setTentou(true);
    if (pendencias.length) return;
    setErroDoBanco("");
    const resultado: Resultado = await conducao.configurar(
      paraSalvar(r, escolhido),
    );
    if (resultado?.erro) setErroDoBanco(resultado.erro);
    else if (resultado?.ok) {
      setEditando(false);
      setTentou(false);
    }
  }
  const cancelar = configurado
    ? () => {
        setEditando(false);
        setTentou(false);
        setErroDoBanco("");
        setR(rascunhoDaConfiguracao(dados) as RascunhoDaConfiguracao);
      }
    : null;
  const temNotas = dados.convocados.some((c) => c.avaliacoes?.length);
  const barra =
    editando && podeEditar ? (
      <BarraDaConfiguracao
        pendencias={pendencias}
        mostrarPendencias={tentou}
        erroDoBanco={erroDoBanco}
        salvando={acao === "configurar"}
        aoIrAoPasso={irAoPasso}
        aoCancelar={cancelar}
        aoSalvar={() => void salvar()}
      />
    ) : null;
  const botaoEditar = (rotulo: string) =>
    podeEditar && !editando ? (
      <button
        type="button"
        className="btn secondary small"
        data-acao="editar-configuracao"
        data-tour="entrevistas-conduzir-editar-configuracao"
        onClick={() => setEditando(true)}
      >
        <i className="fa-solid fa-pen" aria-hidden="true" /> {rotulo}
      </button>
    ) : null;

  const blocoDaConvocacao = useMemo(
    () =>
      resumoDasRegrasDaEntrevista(entrada).find((b) => b.id === "convocacao"),
    [entrada],
  );
  const avisosDaBanca = useMemo(
    () =>
      frasesDaBanca(entrada.avaliadores, entrada.roteiro, entrada.lancamento)
        .avisos,
    [entrada],
  );

  return (
    <>
      <ResumoDasRegras
        entrada={entrada}
        aoIr={ir}
        podeIr={podeIr}
        detalhes={<ConvocacaoDaClassificacao dados={dados} grupos={grupos} />}
      />
      <section
        className="ui-card entrevistas-preparar"
        aria-labelledby="entrevistasPrepararTitulo"
        data-tour="entrevistas-preparar"
      >
        <header className="entrevistas-preparar-topo">
          <h2 className="ui-titulo" id="entrevistasPrepararTitulo">
            Preparar a entrevista
          </h2>
          <span
            className="entrevistas-preparar-andamento"
            data-completo={
              passos.every((p) => p.estado === "feito") ? "sim" : undefined
            }
          >
            {textoDoAndamento(passos)}
          </span>
          {editando && configurado ? (
            <span className="entrevistas-chip-alerta">
              Editando a configuração
            </span>
          ) : null}
        </header>

        <NavegacaoDosPassos
          passos={passos}
          atual={atual}
          aoEscolher={setAtual}
        />

        <div
          className="entrevistas-preparar-corpo"
          ref={corpo}
          data-passo-atual={passo.id}
          key={passo.id}
        >
          <div className="entrevistas-preparar-titulo">
            <h3>
              <i className={`fa-solid ${passo.icone}`} aria-hidden="true" />{" "}
              {atual + 1}. {passo.rotulo}
            </h3>
            <Selo tom={passo.estado === "feito" ? "aprovado" : "pendente"}>
              {passo.estado === "feito" ? "Pronto" : "Pendente"}
            </Selo>
          </div>
          {passo.falta.length &&
          !(barra && (passo.id === "roteiro" || passo.id === "banca")) ? (
            <div className="entrevistas-o-que-falta" role="status">
              <strong>O que falta</strong>
              <ul>
                {passo.falta.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {passo.id === "roteiro" ? (
            <>
              {editando && podeEditar ? (
                <CampoDoRoteiro
                  r={r}
                  opcoes={opcoes}
                  temNotas={temNotas}
                  erro={errosVisiveis.roteiro}
                  aoTrocar={setR}
                />
              ) : (
                <RoteiroEscolhido dados={dados} />
              )}
              <div className="entrevistas-acoes-esquerda">
                {botaoEditar(
                  roteiro ? "Trocar o roteiro" : "Escolher o roteiro",
                )}
              </div>
              {barra}
              <VisaoDeRoteiros
                conducao={conducao}
                area={e.area}
                pedido={pedido}
                embutido
              />
            </>
          ) : null}

          {passo.id === "banca" ? (
            <>
              {editando && podeEditar ? (
                <CamposDaBanca
                  r={r}
                  competencias={competencias}
                  erros={errosVisiveis}
                  meuPerfil={dados.meu_perfil}
                  mudar={(m) => setR((atual) => ({ ...atual, ...m }))}
                />
              ) : (
                <>
                  <BancaGravada dados={dados} />
                  {avisosDaBanca.map((a) => (
                    <Aviso key={a} tom="warning">
                      {a}
                    </Aviso>
                  ))}
                </>
              )}
              <div className="entrevistas-acoes-esquerda">
                {botaoEditar(
                  ativos.length ? "Editar a banca" : "Montar a banca",
                )}
              </div>
              {barra}
            </>
          ) : null}

          {passo.id === "convocacao" ? (
            <>
              {blocoDaConvocacao ? (
                <div className="entrevistas-quem-e-chamado">
                  {blocoDaConvocacao.frases.map((f) => (
                    <p key={f} className="entrevistas-regra-frase">
                      {f}
                    </p>
                  ))}
                  <TabelaDasVagas bloco={blocoDaConvocacao} />
                </div>
              ) : null}
              <ListaDeConvocacao
                key={`conv-${dados.edital?.id}`}
                dados={dados}
                fonte={fonte}
                grupos={grupos}
                calculo={calculo}
                salvando={acao === "convocar" || acao === "desconvocar"}
                ocupado={Boolean(e.acao)}
                aoConvocar={conducao.convocar}
                aoDesconvocar={conducao.desconvocar}
              />
            </>
          ) : null}

          {passo.id === "agenda" ? (
            <AgendaDoEdital e={e} dados={dados} />
          ) : null}
        </div>

        <div className="entrevistas-preparar-navegacao">
          <button
            type="button"
            className="btn secondary"
            disabled={atual === 0}
            onClick={() => setAtual(atual - 1)}
          >
            <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Voltar
          </button>
          {atual < passos.length - 1 ? (
            <button
              type="button"
              className="btn secondary"
              data-acao="proximo-passo"
              onClick={() => setAtual(atual + 1)}
            >
              {passos[atual + 1]?.rotulo}{" "}
              <i className="fa-solid fa-arrow-right" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </section>
    </>
  );
}

/**
 * "Preparar" o edital aberto (`e.edital`): o resumo das regras e os quatro
 * passos. Outro edital recomeça os passos.
 */
export function PrepararEdital({
  conducao,
  e,
}: {
  conducao: EstadoDaConducaoComAcoes;
  e: EstadoDaConducao;
}) {
  const dados = e.edital as Dados | null;
  if (!dados || e.carregandoEdital) return null;
  return (
    <PrepararDoEdital
      key={dados.edital?.id || ""}
      conducao={conducao}
      e={e}
      dados={dados}
    />
  );
}
