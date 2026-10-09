import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  pendenciasDoSalvar,
  type PendenciaDoSalvar,
} from "../../../lib/avaliacao-documental/pendencias-do-salvar.ts";
import type { RegraAnalise } from "../../../lib/avaliacao-documental/tipos-da-regra.ts";
import {
  normalizarRegra,
  validarRegra,
} from "../../../lib/classificacao/regra.js";
import { CATALOGO_DE_CRITERIOS } from "../../../lib/classificacao/catalogo.js";
import {
  erroDoNomeDaVersao,
  rotuloDaVersao,
  nomeParaGravar,
  sugerirNomeDaVersao,
} from "../../../lib/nome-da-versao.ts";
import { Aviso } from "../../../ui/index.js";
import { nomeDoCampo } from "../../../ui/nome-da-versao.tsx";
import { Previa } from "../previa.tsx";
import { PassoCardapio } from "./cardapio.tsx";
import { EstadoDoPasso5, type ModoDoPasso5 } from "./estado-do-passo-5.tsx";
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
  (salvar_regra_classificacao, com a permissão dela). O passo 5 segue a ordem
  Resumo → Comparar versões → Testar (recolhido) → Nome, motivo e Salvar, com
  a lista do que falta ao lado do botão (cada item leva ao passo e ao campo).
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
  /** "Fechar o assistente": a aba Regra mostra o resumo, com "Abrir o assistente". */
  aoFechar?: () => void;
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
  aoFechar,
  copiar,
  imprimir,
}: Props) {
  const dados = e.dados;
  const regraSalva = dados?.regra ?? null;
  const area = dados?.edital?.area ?? e.area;
  const apoio = e.apoio;
  // A aba remonta a cada versão: a que acabou de ser salva reabre no passo 5.
  const salvaAgora = Boolean(
    regraSalva &&
    e.regraSalvaAgora?.editalId === e.editalId &&
    e.regraSalvaAgora?.versao === regraSalva.versao,
  );
  const [passo, setPasso] = useState(salvaAgora ? PASSOS.length - 1 : 0);
  const [concluido, setConcluido] = useState(false);
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
  const [nome, setNome] = useState<string | null>(null);
  const [erroDoBanco, setErroDoBanco] = useState("");
  const [alvo, setAlvo] = useState<string | null>(null);
  const corpo = useRef<HTMLDivElement>(null);

  // Depois de "ir para" uma pendência: rola até o campo e foca.
  useEffect(() => {
    if (!alvo) return;
    const quadro = requestAnimationFrame(() => {
      const el = corpo.current?.querySelector<HTMLElement>(alvo);
      setAlvo(null);
      if (!el) return;
      el.scrollIntoView?.({ block: "center", behavior: "smooth" });
      const campo = el.matches("input, select, textarea, button")
        ? el
        : el.querySelector<HTMLElement>("input, select, textarea, button");
      campo?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(quadro);
  }, [alvo, passo]);

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

  const sugestao = sugerirNomeDaVersao({
    tipo: "regra",
    edital: dados?.edital?.numero,
    motivo:
      motivo.trim() ||
      (regraSalva ? "" : motivoDoPontoDePartida(ponto ?? { tipo: "zero" })),
  });

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
      const r = await estado.salvarRegra(
        rascunho,
        texto,
        nomeParaGravar(nomeDoCampo(nome, sugestao)),
      );
      if (r.ok) setNome(null);
      if (!r.ok)
        setErroDoBanco(
          mudouClassificacao
            ? `A nota mínima e o desempate foram salvos; a regra não: ${r.erro}`
            : (r.erro ?? ""),
        );
    }
  }

  const motivoObrigatorio = Boolean(regraSalva) || mudouClassificacao;
  const pendencias = pendenciasDoSalvar({
    regra: rascunho,
    erros,
    mudou: mudouRegra || mudouClassificacao,
    temVigente: Boolean(regraSalva),
    motivo,
    motivoObrigatorio,
    erroDoNome: mudouRegra
      ? erroDoNomeDaVersao(nomeDoCampo(nome, sugestao))
      : "",
    vagas: apoio?.perguntas_por_vaga ?? [],
  });
  const irPara = (p: PendenciaDoSalvar) => {
    const i = PASSOS.findIndex((x) => x.id === p.passo);
    if (i >= 0) setPasso(i);
    if (p.alvo) setAlvo(p.alvo);
  };

  const mudou = mudouRegra || mudouClassificacao;
  const versaoNova = (regraSalva?.versao ?? 0) + 1;
  const impedem = pendencias.filter((p) => p.impede);
  const modoDoPasso5: ModoDoPasso5 = mudou
    ? "pronto"
    : salvaAgora
      ? "salvo"
      : concluido
        ? "concluido"
        : "sem-mudancas";
  // O passo 5 ganha o ✓ ao salvar ou ao concluir sem mudanças.
  const passo5Feito = modoDoPasso5 === "salvo" || modoDoPasso5 === "concluido";
  const fechar = () => {
    estado.esquecerRegraSalvaAgora?.();
    setConcluido(false);
    if (aoFechar) aoFechar();
    else setPasso(0);
  };
  const voltarAoPasso2 = () => {
    estado.esquecerRegraSalvaAgora?.();
    setConcluido(false);
    setPasso(1);
  };
  const ultimo = PASSOS.length - 1;

  const passoAtual = PASSOS[passo] ?? PASSOS[0];
  const contexto = {
    edital: editalRotulo,
    versao: regraSalva && !mudouRegra ? regraSalva.versao : null,
    nome: regraSalva && !mudouRegra ? (regraSalva.nome ?? null) : null,
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
                i < passo || (i === ultimo && passo5Feito)
                  ? "feito"
                  : i === passo
                    ? "atual"
                    : "depois"
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
                  {i < passo || (i === ultimo && passo5Feito) ? (
                    <i className="fa-solid fa-check" />
                  ) : (
                    i + 1
                  )}
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

      <div
        className="avd-ast-corpo"
        data-passo-atual={passoAtual.id}
        ref={corpo}
      >
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
            <EstadoDoPasso5
              modo={modoDoPasso5}
              rotuloDaVigente={
                regraSalva ? rotuloDaVersao(regraSalva) : "regra nova"
              }
              conferida={regraSalva?.situacao === "CONFERIDA"}
              versaoNova={versaoNova}
              faltam={impedem}
              aoIrPara={irPara}
              aoConcluir={() => setConcluido(true)}
              aoFechar={fechar}
              aoVoltarAoPasso2={voltarAoPasso2}
              confereOutraPessoa={Boolean(
                regraSalva?.conferir_pede_outra_pessoa,
              )}
              aoConferir={estado.conferirRegra}
              salvando={e.salvando}
            />
            <ResumoDaRegra
              regra={rascunho}
              contexto={contexto}
              copiar={copiar}
              imprimir={imprimir}
            />
            <ComparacaoDeVersoes regraSalva={regraSalva} rascunho={rascunho} />
            <Previa
              regra={rascunho}
              notaMinima={{
                nota_minima: notaMinima,
                nota_minima_por_nivel: notaMinimaPorNivel,
              }}
            />
            {mudou || erroDoBanco ? (
              <BarraDeSalvar
                pendencias={pendencias.filter((p) => !p.impede)}
                aoIrPara={irPara}
                motivo={motivo}
                aoMudarMotivo={setMotivo}
                pedeNome={mudouRegra}
                nome={nome}
                sugestaoDoNome={sugestao}
                aoMudarNome={setNome}
                motivoObrigatorio={motivoObrigatorio}
                salvaClassificacao={mudouClassificacao}
                podeDescartar={mudouRegra || mudouClassificacao}
                salvando={e.salvando}
                erroDoBanco={erroDoBanco}
                aoDescartar={() => {
                  aoMudarRascunho(inicial);
                  setClassificacao(classificacaoOriginal);
                  setGuardados({});
                  setMotivo("");
                  setNome(null);
                  setErroDoBanco("");
                  setPasso(0);
                }}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {rascunho && passo > 0 && passo < 4 && erros.length ? (
        <p className="avd-ast-pendencias" role="status">
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />{" "}
          {erros.length} ponto(s) a acertar: {erros[0]}
        </p>
      ) : null}

      <div
        className="avd-ast-navegacao"
        data-fixa={passo === ultimo ? "sim" : undefined}
      >
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
        {passo === ultimo && rascunho ? (
          modoDoPasso5 === "pronto" ? (
            <button
              type="button"
              className="btn"
              data-acao="salvar-assistente"
              disabled={e.salvando || impedem.length > 0}
              title={impedem[0]?.texto}
              onClick={() => void salvar()}
            >
              <i className="fa-solid fa-floppy-disk" aria-hidden="true" />{" "}
              Salvar como Versão {versaoNova}
            </button>
          ) : modoDoPasso5 === "sem-mudancas" ? (
            <button
              type="button"
              className="btn"
              data-acao="concluir-assistente"
              onClick={() => setConcluido(true)}
            >
              <i className="fa-solid fa-check" aria-hidden="true" /> Concluir
              sem mudanças
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              data-acao="fechar-assistente"
              onClick={fechar}
            >
              Fechar o assistente
            </button>
          )
        ) : null}
      </div>
    </section>
  );
}
