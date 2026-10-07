import { useCallback, useEffect, useMemo, useState } from "react";
import {
  alternarCartao,
  motivoDoPontoDePartida,
  regraDoPontoDePartida,
  type Cartao,
  type Guardados,
  type PontoDePartida,
} from "../../../lib/avaliacao-documental/assistente-da-regra.ts";
import {
  regrasIguais,
  validarRegraAnalise,
} from "../../../lib/avaliacao-documental/regra.js";
import type { RegraAnalise } from "../../../lib/avaliacao-documental/tipos-da-regra.ts";
import {
  normalizarRegra,
  validarRegra,
} from "../../../lib/classificacao/regra.js";
import { CATALOGO_DE_CRITERIOS } from "../../../lib/classificacao/catalogo.js";
import { Aviso } from "../../../ui/index.js";
import { Previa } from "../previa.jsx";
import { PassoCardapio } from "./cardapio.tsx";
import {
  BarraDeSalvar,
  ComparacaoDeVersoes,
  ResumoDaRegra,
  type FerramentasDoDocumento,
} from "./conferir.tsx";
import {
  PassoNotaEDesempate,
  type RegraDeClassificacao,
} from "./nota-e-desempate.tsx";
import { PassoPartida } from "./partida.tsx";
import { PassoPerguntas } from "./perguntas.tsx";
import type { EstadoDaRegra, SnapshotDaAvaliacao } from "./tipos.ts";

/*
  O assistente "Nova regra" / "Editar regra" da aba Regra: cinco passos sobre o
  mesmo rascunho que o modo avançado edita (o JSON de regra.js). Salvar cria a
  versão nova com motivo (salvar_regra_analise) e, se a nota mínima ou o
  desempate da classificação mudaram, grava a regra de classificação antes
  (salvar_regra_classificacao, com a permissão dela).
*/

const PASSOS = [
  { id: "partida", rotulo: "Ponto de partida", icone: "fa-flag" },
  {
    id: "cardapio",
    rotulo: "O que vale e o que elimina",
    icone: "fa-list-check",
  },
  { id: "perguntas", rotulo: "Perguntas da Empregare", icone: "fa-link" },
  { id: "nota", rotulo: "Nota mínima e desempate", icone: "fa-ranking-star" },
  { id: "conferir", rotulo: "Testar e salvar", icone: "fa-clipboard-check" },
] as const;

type Props = {
  e: SnapshotDaAvaliacao;
  estado: EstadoDaRegra;
  rascunho: RegraAnalise | null;
  /** A versão vigente normalizada (null sem regra). */
  inicial: RegraAnalise | null;
  aoMudarRascunho: (regra: RegraAnalise | null) => void;
} & FerramentasDoDocumento;

const NOME_DO_CRITERIO = new Map(
  (
    CATALOGO_DE_CRITERIOS as unknown as ReadonlyArray<{
      codigo: string;
      nome: string;
    }>
  ).map((c) => [c.codigo, c.nome]),
);

export function AssistenteDaRegra({
  e,
  estado,
  rascunho,
  inicial,
  aoMudarRascunho,
  copiar,
  imprimir,
}: Props) {
  const dados = e.dados;
  const regraSalva = dados?.regra ?? null;
  const area = dados?.edital?.area ?? e.area;
  const apoio = e.apoio;
  const [passo, setPasso] = useState(0);
  const [ponto, setPonto] = useState<PontoDePartida | null>(
    regraSalva
      ? {
          tipo: "vigente",
          versao: regraSalva.versao,
          configuracao: regraSalva.configuracao,
        }
      : null,
  );
  const [guardados, setGuardados] = useState<Guardados>({});
  const [motivo, setMotivo] = useState("");
  const [erroDoBanco, setErroDoBanco] = useState("");

  useEffect(() => {
    void estado.carregarApoio();
  }, [estado, e.editalId]);

  const regraDaClassificacao = apoio?.classificacao?.regra ?? null;
  const classificacaoOriginal = useMemo(
    () =>
      regraDaClassificacao
        ? (normalizarRegra(
            regraDaClassificacao.configuracao,
          ) as unknown as RegraDeClassificacao)
        : null,
    [regraDaClassificacao],
  );
  const [classificacao, setClassificacao] =
    useState<RegraDeClassificacao | null>(classificacaoOriginal);
  useEffect(
    () => setClassificacao(classificacaoOriginal),
    [classificacaoOriginal],
  );

  const editalRotulo = dados?.edital?.numero
    ? `Edital ${dados.edital.numero}`
    : "";
  const fontes = useMemo(() => {
    const lista: RegraAnalise[] = [];
    if (ponto && ponto.tipo !== "zero") lista.push(ponto.configuracao);
    for (const m of dados?.modelos ?? []) lista.push(m.configuracao);
    for (const r of apoio?.regras_da_area ?? []) lista.push(r.configuracao);
    return lista;
  }, [ponto, dados?.modelos, apoio?.regras_da_area]);

  const doPonto = useMemo(
    () => (ponto ? regraDoPontoDePartida(ponto, { editalRotulo }) : null),
    [ponto, editalRotulo],
  );
  const temEscolhas = Boolean(
    rascunho && doPonto && !regrasIguais(rascunho, doPonto),
  );
  const mudouRegra = Boolean(
    rascunho && (!regraSalva || !inicial || !regrasIguais(rascunho, inicial)),
  );
  const podeEditarClassificacao = Boolean(
    apoio?.classificacao?.pode_editar && regraDaClassificacao,
  );
  const mudouClassificacao = Boolean(
    podeEditarClassificacao &&
    classificacao &&
    classificacaoOriginal &&
    !regrasIguais(classificacao, classificacaoOriginal),
  );
  const erros = [
    ...(rascunho ? (validarRegraAnalise(rascunho) as string[]) : []),
    ...(mudouClassificacao && classificacao
      ? (validarRegra(classificacao) as Array<{ mensagem: string }>).map(
          (x) => `Classificação: ${x.mensagem}`,
        )
      : []),
  ];
  const notaMinima =
    classificacao?.documental?.nota_minima ??
    dados?.nota_minima?.nota_minima ??
    null;
  const notaMinimaPorNivel =
    classificacao?.documental?.nota_minima_por_nivel ??
    dados?.nota_minima?.nota_minima_por_nivel ??
    {};

  const alternar = useCallback(
    (cartao: Cartao, marcar: boolean) => {
      if (!rascunho) return;
      const r = alternarCartao(rascunho, cartao, marcar, {
        fontes,
        guardados,
        notaMinima,
      });
      setGuardados(r.guardados);
      aoMudarRascunho(r.regra);
    },
    [rascunho, fontes, guardados, notaMinima, aoMudarRascunho],
  );
  const mudar = useCallback(
    (regra: RegraAnalise) => aoMudarRascunho(regra),
    [aoMudarRascunho],
  );

  async function salvar() {
    setErroDoBanco("");
    if (!rascunho) return;
    const texto =
      motivo.trim() ||
      (regraSalva ? "" : motivoDoPontoDePartida(ponto ?? { tipo: "zero" }));
    if (mudouClassificacao && classificacao && regraDaClassificacao) {
      const r = await estado.salvarRegraClassificacao(
        classificacao,
        regraDaClassificacao.versao,
        texto.slice(0, 500),
      );
      if (!r.ok) {
        setErroDoBanco(
          `Nada foi salvo: a regra de classificação recusou (${r.erro}).`,
        );
        return;
      }
    }
    if (mudouRegra) {
      const r = await estado.salvarRegra(rascunho, texto);
      if (!r.ok)
        setErroDoBanco(
          mudouClassificacao
            ? `A nota mínima e o desempate foram salvos; a regra não: ${r.erro}`
            : (r.erro ?? ""),
        );
    }
  }

  const passoAtual = PASSOS[passo] ?? PASSOS[0];
  const contexto = {
    edital: editalRotulo,
    versao: regraSalva && !mudouRegra ? regraSalva.versao : null,
    notaMinima,
    notaMinimaPorNivel,
    desempateDaClassificacao: (classificacao?.desempate ?? []).map(
      (d) => NOME_DO_CRITERIO.get(d.criterio) ?? d.criterio,
    ),
  };

  return (
    <section
      className="ui-card avd-ast"
      aria-labelledby="avdAstTitulo"
      data-tour="avd-assistente"
    >
      <header className="avd-ast-topo">
        <h2 className="ui-titulo" id="avdAstTitulo">
          <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />{" "}
          {regraSalva ? "Editar regra" : "Nova regra"}
        </h2>
        {mudouRegra || mudouClassificacao ? (
          <span className="avd-ast-chip" data-tom="alerta">
            Alterações não salvas
          </span>
        ) : null}
      </header>

      <nav
        className="avd-ast-passos"
        aria-label="Passos do assistente"
        data-tour="avd-assistente-passos"
      >
        <ol>
          {PASSOS.map((p, i) => (
            <li
              key={p.id}
              data-estado={
                i < passo ? "feito" : i === passo ? "atual" : "depois"
              }
            >
              <button
                type="button"
                data-passo={p.id}
                aria-current={i === passo ? "step" : undefined}
                disabled={!rascunho && i > 0}
                onClick={() => setPasso(i)}
              >
                <span className="avd-ast-passo-numero" aria-hidden="true">
                  {i < passo ? <i className="fa-solid fa-check" /> : i + 1}
                </span>
                <span className="avd-ast-passo-rotulo">{p.rotulo}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {e.erroDoApoio ? (
        <Aviso tom="warning" papel="alert">
          Não foi possível ler as perguntas e as regras da área: {e.erroDoApoio}{" "}
          <button
            type="button"
            className="btn secondary small"
            onClick={() => void estado.carregarApoio({ recarregar: true })}
          >
            Tentar novamente
          </button>
        </Aviso>
      ) : null}

      <div className="avd-ast-corpo" data-passo-atual={passoAtual.id}>
        <h3 className="avd-ast-titulo-do-passo">
          <i className={`fa-solid ${passoAtual.icone}`} aria-hidden="true" />{" "}
          {passo + 1}. {passoAtual.rotulo}
        </h3>
        {passo === 0 ? (
          <PassoPartida
            regraSalva={regraSalva}
            regrasDaArea={apoio?.regras_da_area ?? []}
            modelos={dados?.modelos ?? []}
            area={area}
            carregandoApoio={e.carregandoApoio}
            temEscolhas={temEscolhas}
            pontoAtual={ponto}
            aoUsar={(novo) => {
              setPonto(novo);
              setGuardados({});
              aoMudarRascunho(regraDoPontoDePartida(novo, { editalRotulo }));
              setPasso(1);
            }}
          />
        ) : null}
        {passo === 1 && rascunho ? (
          <PassoCardapio
            regra={rascunho}
            area={area}
            guardados={guardados}
            notaMinima={notaMinima}
            aoMudar={mudar}
            aoAlternar={alternar}
          />
        ) : null}
        {passo === 2 && rascunho ? (
          <PassoPerguntas
            regra={rascunho}
            vagas={apoio?.perguntas_por_vaga ?? []}
            perguntasDaCarga={dados?.perguntas ?? []}
            carregando={e.carregandoApoio}
            aoMudar={mudar}
          />
        ) : null}
        {passo === 3 && rascunho ? (
          <PassoNotaEDesempate
            regra={rascunho}
            aoMudar={mudar}
            classificacao={apoio?.classificacao ?? null}
            rascunhoDaClassificacao={classificacao}
            aoMudarClassificacao={setClassificacao}
            notaMinimaAtual={dados?.nota_minima ?? null}
          />
        ) : null}
        {passo === 4 && rascunho ? (
          <div className="avd-ast-passo">
            <Previa
              regra={rascunho}
              notaMinima={{
                nota_minima: notaMinima,
                nota_minima_por_nivel: notaMinimaPorNivel,
              }}
            />
            <ResumoDaRegra
              regra={rascunho}
              contexto={contexto}
              copiar={copiar}
              imprimir={imprimir}
            />
            <ComparacaoDeVersoes regraSalva={regraSalva} rascunho={rascunho} />
            <BarraDeSalvar
              versaoNova={(regraSalva?.versao ?? 0) + 1}
              erros={erros}
              motivo={motivo}
              aoMudarMotivo={setMotivo}
              motivoObrigatorio={Boolean(regraSalva) || mudouClassificacao}
              salvaClassificacao={mudouClassificacao}
              podeSalvar={mudouRegra || mudouClassificacao}
              salvando={e.salvando}
              erroDoBanco={erroDoBanco}
              aoSalvar={() => void salvar()}
              aoDescartar={() => {
                aoMudarRascunho(inicial);
                setClassificacao(classificacaoOriginal);
                setGuardados({});
                setMotivo("");
                setErroDoBanco("");
                setPasso(0);
              }}
            />
          </div>
        ) : null}
      </div>

      {rascunho && passo > 0 && passo < 4 && erros.length ? (
        <p className="avd-ast-pendencias" role="status">
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />{" "}
          {erros.length} ponto(s) a acertar: {erros[0]}
        </p>
      ) : null}

      <div className="avd-ast-navegacao">
        <button
          type="button"
          className="btn secondary"
          disabled={passo === 0}
          onClick={() => setPasso(passo - 1)}
        >
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Voltar
        </button>
        {passo > 0 && passo < PASSOS.length - 1 ? (
          <button
            type="button"
            className="btn"
            data-acao="proximo-passo"
            onClick={() => setPasso(passo + 1)}
          >
            Próximo <i className="fa-solid fa-arrow-right" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  );
}
