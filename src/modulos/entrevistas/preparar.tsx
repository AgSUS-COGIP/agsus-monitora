import type {
  FonteDaConvocacao as Fonte,
  GrupoDaConvocacao,
} from "../../lib/tipos-da-convocacao-da-entrevista.ts";
import { useMemo, useRef, useState } from "react";
import {
  bancasDoEdital,
  errosDaConfiguracao,
  rascunhoDaConfiguracao,
} from "../../lib/conducao-de-entrevista.ts";
import {
  aConvocar,
  criteriosDeDesempate,
  fonteDaConvocacao,
  gruposDaConvocacao,
  resumoDaConvocacao,
  textoDoEmpateFinal,
} from "../../lib/convocacao-da-entrevista.ts";
import { hojeEmBrasilia } from "../../lib/fila-de-conducao.ts";
import { dataBR } from "../../lib/classificacao/numeros.ts";
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
  resumoDasRegrasDaEntrevista,
  type DestinoDoResumo,
  type EntradaDoResumo,
} from "../../lib/resumo-da-entrevista.ts";
import { EstadoVazio, Selo } from "../../ui/index.ts";
import { usarFiltrosNaUrl } from "../../app/usar-filtros-na-url.ts";
import type { EsquemaDosFiltros } from "../../app/filtros-no-endereco.ts";
import { abrirRegrasDoEdital } from "../regras-do-edital/abrir.ts";
import {
  BotaoIrPara,
  ConvocacaoDaClassificacao,
  ListaDeConvocacao,
} from "./conducao.tsx";
import {
  AvisosDaBanca,
  BancaGravada,
  RoteiroEscolhido,
} from "./editor-da-configuracao.tsx";
import { ResumoDasRegras, TabelaDasVagas } from "./resumo-das-regras.tsx";
import type { PedidoDeRoteiro } from "./tipos-do-editor-de-roteiro.ts";
import { VisaoDeRoteiros } from "./roteiros.tsx";
import type {
  DadosDoEdital,
  EstadoDaConducao,
  EstadoDaConducaoComAcoes,
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
  (src/lib/passos-do-preparar.ts); Preparar abre no primeiro pendente (ou
  no passo da URL, ?passo=). O layout das telas da seleção: no topo, num
  card, "N de 4 passos prontos" com a barra dos quatro, o período das
  entrevistas (da agenda) e as "Regras da entrevista" (o resumo, recolhível);
  embaixo, a trilha dos passos à esquerda (número, nome, Pronto ou Pendente
  e o resumo) e, à direita, o passo escolhido: o que falta em destaque e o
  conteúdo dele. Os passos 1 e 2 mostram o
  roteiro e a banca gravados (editor-da-configuracao.tsx) com "Editar nas
  Regras do edital": a configuração se edita em Editais › Regras do edital,
  etapa Entrevista, com o mesmo componente. Os roteiros da área (editar,
  duplicar, novo) continuam aqui, no passo 1. Quem só lê vê tudo sem os
  botões.
*/

type Dados = DadosDoEdital & {
  convocados: (DadosDoEdital["convocados"][number] & {
    avaliacoes?: unknown[] | null;
  })[];
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
    desempate: criteriosDeDesempate(regra),
    empateFinal: textoDoEmpateFinal(regra),
    convocados: fonte?.tipo === "LISTA" ? resumoDaConvocacao(grupos) : null,
  };
}

/* Conversores da configuração e da convocação com contratos TypeScript. */
const errosDaConfiguracaoDo = errosDaConfiguracao;
const fonteDaConvocacaoDo = fonteDaConvocacao;

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

/* O passo escolhido na URL (?passo=banca); trocar não enche o histórico. */
const ESQUEMA_DO_PASSO: EsquemaDosFiltros<"passo"> = Object.freeze({
  passo: {
    padrao: "",
    aceita: (passo: string) =>
      ["roteiro", "banca", "convocacao", "agenda"].includes(passo),
  },
});

/*
  A trilha dos passos (à esquerda): o número (ou o check, pronto), o nome,
  o selo Pronto / Pendente e uma linha — o resumo do que está pronto ou o
  primeiro que falta. O escolhido fica marcado (`aria-current="step"`).
*/
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
      className="ui-card entrevistas-passos"
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
              <span className="entrevistas-passo-texto">
                <span className="entrevistas-passo-topo">
                  <span className="entrevistas-passo-rotulo">{p.rotulo}</span>
                  <Selo
                    tom={p.estado === "feito" ? "aprovado" : "pendente"}
                    ponto
                  >
                    {p.estado === "feito" ? "Pronto" : "Pendente"}
                  </Selo>
                </span>
                <span className="entrevistas-passo-resumo">
                  {p.estado === "feito" ? p.resumo : (p.falta[0] ?? "")}
                </span>
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
    () => gruposDaConvocacao(fonte.resultado, dados.convocados),
    [fonte, dados],
  );
  const entrada = useMemo(
    () => entradaDoResumo(dados, fonte, grupos),
    [dados, fonte, grupos],
  );

  /* Os passos com o que está gravado. */
  const errosGravados = useMemo(
    () =>
      configurado
        ? errosDaConfiguracaoDo(rascunhoDaConfiguracao(dados), roteiro)
        : {},
    [configurado, dados, roteiro],
  );
  const ativos = (dados.avaliadores || []).filter((a) => a.ativo !== false);
  const resumo = resumoDaConvocacao(grupos);
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
        bancas: bancasDoEdital(ativos).length,
        errosDaBanca: pendenciasDaConfiguracao(
          errosGravados,
          rascunhoDaConfiguracao(dados).avaliadores,
        )
          .filter((p) => p.passo === "banca")
          .map((p) => p.texto),
        convocacao: {
          temLista: fonte.tipo === "LISTA",
          naLista: resumo.naLista,
          naFicha: dados.convocados.length,
          aConvocar: fonte.tipo === "LISTA" ? aConvocar(grupos).length : 0,
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
  // O passo na URL (?passo=convocacao); sem ele, o primeiro pendente.
  const [naUrl, mudarNaUrl] = usarFiltrosNaUrl(ESQUEMA_DO_PASSO);
  const doUrl = passos.findIndex((p) => p.id === naUrl.passo);
  const atual = doUrl >= 0 ? doUrl : passoInicial(passos);
  const setAtual = (i: number) => {
    const id = passos[i]?.id;
    if (id) mudarNaUrl({ passo: id });
  };
  const passo = passos[atual] ?? passos[0]!;
  const periodo = useMemo(() => {
    const dias = agendaPorDia(e.agenda, dados.convocados, "").dias;
    const primeiro = dias[0]?.data;
    const ultimo = dias[dias.length - 1]?.data;
    if (!primeiro || !ultimo) return "";
    return primeiro === ultimo
      ? `Entrevistas em ${dataBR(primeiro)}`
      : `Entrevistas de ${dataBR(primeiro)} a ${dataBR(ultimo)}`;
  }, [e.agenda, dados.convocados]);

  /* O pedido de abrir um roteiro no editor (o "Editar" de "Como a nota é calculada"). */
  const [pedido, setPedido] = useState<PedidoDeRoteiro | null>(null);

  function irAoPasso(id: IdDoPasso) {
    const i = passos.findIndex((p) => p.id === id);
    if (i >= 0) setAtual(i);
    corpo.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }
  const editalId = String(dados.edital?.id ?? "");
  function ir(destino: DestinoDoResumo) {
    // A convocação e o desempate são da regra da Classificação: Regras do edital.
    if (destino === "classificacao")
      abrirRegrasDoEdital(editalId, "classificacao");
    else if (destino === "roteiro" && roteiro) {
      irAoPasso("roteiro");
      setPedido((p) => ({ roteiro, vez: (p?.vez ?? 0) + 1 }));
    } else if (destino === "convocacao") irAoPasso("convocacao");
    // A banca (e a troca do roteiro) se edita nas Regras do edital.
    else abrirRegrasDoEdital(editalId, "entrevista");
  }
  function podeIr(destino: DestinoDoResumo) {
    if (destino === "classificacao") return Boolean(dados.pode_gerar_lista);
    if (destino === "convocacao") return true;
    if (destino === "roteiro") return Boolean(roteiro);
    return podeEditar;
  }

  /* "Editar nas Regras do edital": o roteiro e a banca se editam lá. */
  const botaoEditar = (rotulo: string) =>
    podeEditar ? (
      <button
        type="button"
        className="btn secondary small"
        data-acao="editar-nas-regras-do-edital"
        data-tour="entrevistas-conduzir-editar-configuracao"
        onClick={() => abrirRegrasDoEdital(editalId, "entrevista")}
      >
        <i className="fa-solid fa-pen" aria-hidden="true" /> {rotulo}
      </button>
    ) : null;

  const blocoDaConvocacao = useMemo(
    () =>
      resumoDasRegrasDaEntrevista(entrada).find((b) => b.id === "convocacao"),
    [entrada],
  );

  const prontos = passos.filter((p) => p.estado === "feito").length;
  return (
    <div className="entrevistas-preparar" data-tour="entrevistas-preparar">
      <section
        className="ui-card entrevistas-preparar-topo"
        aria-label="Andamento da preparação"
      >
        <div className="entrevistas-preparar-andamento-bloco">
          <span className="ui-texto-secundario">Preparação</span>
          <strong
            className="entrevistas-preparar-andamento"
            data-completo={prontos === passos.length ? "sim" : undefined}
          >
            {textoDoAndamento(passos)}
          </strong>
        </div>
        <span
          className="entrevistas-preparar-barra"
          role="img"
          aria-label={`Passos: ${passos
            .map(
              (p) =>
                `${p.rotulo} ${p.estado === "feito" ? "pronto" : "pendente"}`,
            )
            .join(", ")}`}
        >
          {passos.map((p) => (
            <span key={p.id} data-estado={p.estado} />
          ))}
        </span>
        {periodo ? (
          <span className="entrevistas-preparar-periodo">{periodo}</span>
        ) : null}
        <details className="entrevistas-preparar-regras">
          <summary>Regras da entrevista</summary>
          <ResumoDasRegras
            entrada={entrada}
            aoIr={ir}
            podeIr={podeIr}
            detalhes={
              <ConvocacaoDaClassificacao dados={dados} grupos={grupos} />
            }
          />
        </details>
      </section>

      <div className="entrevistas-preparar-colunas">
        <NavegacaoDosPassos
          passos={passos}
          atual={atual}
          aoEscolher={setAtual}
        />

        <section
          className="ui-card entrevistas-preparar-corpo"
          ref={corpo}
          aria-labelledby="entrevistasPrepararTitulo"
          data-passo-atual={passo.id}
          key={passo.id}
        >
          <div className="entrevistas-preparar-titulo">
            <h2 className="ui-titulo" id="entrevistasPrepararTitulo">
              {atual + 1}. {passo.rotulo}
            </h2>
            <Selo
              tom={passo.estado === "feito" ? "aprovado" : "pendente"}
              ponto
            >
              {passo.estado === "feito" ? "Pronto" : "Pendente"}
            </Selo>
          </div>
          {passo.falta.length ? (
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
              <RoteiroEscolhido dados={dados} />
              <div className="entrevistas-acoes-esquerda">
                {botaoEditar(
                  roteiro
                    ? "Trocar o roteiro nas Regras do edital"
                    : "Escolher o roteiro nas Regras do edital",
                )}
              </div>
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
              <BancaGravada dados={dados} />
              <AvisosDaBanca dados={dados} />
              <div className="entrevistas-acoes-esquerda">
                {botaoEditar(
                  ativos.length
                    ? "Editar a banca nas Regras do edital"
                    : "Montar a banca nas Regras do edital",
                )}
              </div>
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
        </section>
      </div>
    </div>
  );
}

/**
 * "Preparar" o edital aberto (`e.edital`): o resumo das regras e os quatro
 * passos. Outro edital recomeça os passos. Reler o mesmo edital (voltar à
 * tela, "Atualizar") mantém os passos e o rascunho: o topo mostra
 * "Carregando o edital…" enquanto isso.
 */
export function PrepararEdital({
  conducao,
  e,
}: {
  conducao: EstadoDaConducaoComAcoes;
  e: EstadoDaConducao;
}) {
  const dados = e.edital as Dados | null;
  // Outro edital: abrirEdital tira o anterior (e.edital fica nulo) até chegar.
  if (!dados) return null;
  return (
    <PrepararDoEdital
      key={dados.edital?.id || ""}
      conducao={conducao}
      e={e}
      dados={dados}
    />
  );
}
