import { useEffect, useMemo, useRef, useState } from "react";
import {
  aspectosDoRoteiro,
  aspectosIncompletos,
  avaliacoesDoMapa,
  avaliadoresDaFicha,
  bancasDoEdital,
  calcularEntrevista,
  chaveDaNota,
  mapaDasAvaliacoes,
  mediaDosAspectos,
  motivosDoParecer,
  nomeDoCargo,
  notasAlteradas,
  podeLancarPor,
  rotuloDoLancamento,
} from "../../lib/conducao-de-entrevista.js";
import {
  notaNaEscala,
  opcoesDaEscala,
  pontuacaoMaxima,
  rotuloDoPeso,
} from "../../lib/roteiro-de-entrevista.js";
import { Aviso, classes } from "../../ui/index.js";
import { BotoesDeNota, CampoDeNota } from "./campo-de-nota.tsx";
import { numeroBR } from "./partes.jsx";
import { SeloDoParecer } from "./tabela.jsx";

/*
  Ficha de notas de um convocado, em MODO DE ANÁLISE: ocupa a área de conteúdo
  (só o menu lateral do sistema fica), no padrão da ficha da Avaliação
  documental — topo preso (voltar, candidato, dados, anterior/próximo),
  competências à esquerda, a prévia do parecer numa lateral fixa e a barra de
  ações presa embaixo (acima do menu inferior no celular).

  Componente independente: recebe o payload do edital (`dados`: roteiro,
  banca, permissões), o convocado, a lista para anterior/próximo
  (`convocados`) e as ações (`aoSalvar`, `aoAbrir`, `aoFechar`); não depende
  da tela em volta.

  Por competência, os avaliadores lado a lado, cada um com o campo da nota (ou
  um por aspecto, quando o roteiro tem aspectos, e a média dele ao lado). Os
  botões da escala preenchem o campo em foco da competência e passam ao
  próximo. A prévia (calcularEntrevista, as mesmas regras do banco) muda de
  cor na hora; depois de salvar vale o que o banco devolveu. Cores das
  situações: as da Avaliação documental (verde, vermelho, amarelo, cinza).

  Lançamento "Cada avaliador lança a sua": só a coluna do membro ligado ao
  perfil fica aberta (o administrador global lança por todos).

  Teclado: Enter passa ao próximo campo; Ctrl+Enter salva; Esc volta à lista.
  Celular: uma competência por vez (abas numeradas).
*/

const COMPARECIMENTO = [
  { valor: "S", rotulo: "Compareceu", icone: "fa-user-check" },
  { valor: "N", rotulo: "Faltou", icone: "fa-user-xmark" },
];

const TOM_DO_PARECER = { APTO: "ok", INAPTO: "reprova" };

function estadoInicial(dados, convocado, aspectos) {
  const bancas = bancasDoEdital(dados.avaliadores);
  const mapa = mapaDasAvaliacoes(convocado.avaliacoes, aspectos);
  return {
    compareceu: convocado.compareceu || null,
    banca: convocado.banca ?? (bancas.length === 1 ? bancas[0] : null),
    original: mapa,
    mapa,
  };
}

/* A situação da competência para a cor do cartão (as da Avaliação documental). */
function situacaoDaCompetencia(linha, incompleta) {
  if (!linha || linha.quantidade === 0)
    return incompleta ? "parcial" : "pendente";
  if (linha.abaixoDoMinimo || linha.eliminatoria) return "reprova";
  return incompleta ? "parcial" : "ok";
}

/* Média dos aspectos de um avaliador numa competência, com o que está digitado. */
function mediaDoAvaliador(mapa, aspectos, competencia, avaliador) {
  return mediaDosAspectos(
    aspectos,
    Object.fromEntries(
      aspectos.map((x) => [
        x.id,
        mapa[chaveDaNota(competencia, avaliador, x.id)],
      ]),
    ),
  );
}

/* "Conceitua" → "Conc." (o nome inteiro fica no título e na legenda da competência). */
const abreviar = (nome) => (nome.length <= 5 ? nome : `${nome.slice(0, 4)}.`);

function Comparecimento({ valor, desabilitado, aoMudar }) {
  return (
    <div
      className="entrevistas-comparecimento"
      role="radiogroup"
      aria-label="Comparecimento"
      data-tour="entrevistas-ficha-comparecimento"
    >
      {COMPARECIMENTO.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          data-valor={o.valor}
          className={classes(
            "entrevistas-comparecimento-opcao",
            valor === o.valor && "is-escolhida",
          )}
          disabled={desabilitado}
          onClick={() => aoMudar(o.valor)}
        >
          <i className={`fa-solid ${o.icone}`} aria-hidden="true" /> {o.rotulo}
        </button>
      ))}
    </div>
  );
}

function LegendaDosNiveis({ roteiro }) {
  if (roteiro?.escala !== "NIVEIS" || !roteiro.niveis?.length) return null;
  return (
    <details className="ui-card entrevistas-legenda" open>
      <summary>Níveis da escala</summary>
      <ul>
        {roteiro.niveis.map((n) => (
          <li key={n.nota} title={n.descricao || undefined}>
            <b>{numeroBR(n.nota)}</b> {n.nome}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Lateral({
  resultado,
  motivos,
  maxima,
  competencias,
  roteiro,
  progresso,
}) {
  const tom = TOM_DO_PARECER[resultado.parecer] || "neutro";
  return (
    <aside
      className="entrevistas-analise-lateral"
      aria-label="Prévia do resultado"
      data-tour="entrevistas-ficha-previa"
    >
      <div
        className="ui-card entrevistas-previa"
        data-tom={tom}
        aria-live="polite"
      >
        <span className="entrevistas-previa-rotulo">Prévia do parecer</span>
        <span
          id="entrevistasFichaParecer"
          className="entrevistas-previa-parecer"
        >
          <SeloDoParecer parecer={resultado.parecer} />
        </span>
        <div className="entrevistas-previa-total">
          <strong id="entrevistasFichaTotal">
            {numeroBR(resultado.total)}
            <small> / {numeroBR(maxima)}</small>
          </strong>
          {resultado.minimoTotal !== null ? (
            <span
              className={classes(
                "entrevistas-previa-minimo",
                resultado.abaixoDoMinimoTotal && "is-abaixo",
              )}
            >
              mínimo {numeroBR(resultado.minimoTotal)}
            </span>
          ) : null}
        </div>
        <ul className="entrevistas-previa-competencias">
          {competencias.map((c, i) => {
            const linha = resultado.competencias.find((x) => x.id === c.id);
            return (
              <li
                key={c.id}
                data-situacao={situacaoDaCompetencia(linha, false)}
              >
                <span>
                  {i + 1}. {c.nome}
                </span>
                <b>{numeroBR(linha?.nota)}</b>
              </li>
            );
          })}
        </ul>
        {motivos.length ? (
          <ul className="entrevistas-previa-motivos">
            {motivos.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : null}
        <small className="ui-texto-secundario">
          {progresso.lancadas} de {progresso.esperadas} notas de avaliador
        </small>
      </div>
      <LegendaDosNiveis roteiro={roteiro} />
    </aside>
  );
}

export function FichaDoCandidato({
  dados,
  convocado,
  convocados,
  salvando,
  aoSalvar,
  aoAbrir,
  aoFechar,
}) {
  const roteiro = dados.configuracao?.roteiro || null;
  const aspectos = useMemo(() => aspectosDoRoteiro(roteiro), [roteiro]);
  const [f, setF] = useState(() => estadoInicial(dados, convocado, aspectos));
  const [erro, setErro] = useState("");
  const [ativo, setAtivo] = useState(null);
  const [aba, setAba] = useState(0);
  const raiz = useRef(null);

  /* O payload novo (depois de salvar ou recarregar) é a verdade: a ficha recomeça dele. */
  useEffect(() => {
    setF(estadoInicial(dados, convocado, aspectos));
  }, [dados, convocado, aspectos]);
  useEffect(() => {
    globalThis.scrollTo?.({ top: 0 });
  }, [convocado.id]);

  const competencias = useMemo(
    () =>
      (roteiro?.competencias || [])
        .slice()
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    [roteiro],
  );
  const bancas = bancasDoEdital(dados.avaliadores);
  const avaliadores = avaliadoresDaFicha(dados.avaliadores, convocado, f.banca);
  const resultado = useMemo(
    () =>
      calcularEntrevista({
        roteiro,
        compareceu: f.compareceu,
        avaliacoes: avaliacoesDoMapa(f.mapa, aspectos),
      }),
    [roteiro, f.compareceu, f.mapa, aspectos],
  );
  const motivos = motivosDoParecer(resultado, f.compareceu, roteiro);
  const alteradas = notasAlteradas(f.original, f.mapa, aspectos);
  const incompletas = aspectosIncompletos(f.mapa, aspectos);
  const mudouComparecimento =
    f.compareceu && f.compareceu !== (convocado.compareceu || null);
  const mudouBanca =
    f.banca !== null && Number(f.banca) !== Number(convocado.banca ?? NaN);
  const invalidas = Object.entries(f.mapa).filter(([chave, valor]) => {
    if (valor === "" || valor === undefined) return false;
    const competencia = competencias.find((c) => c.id === chave.split("|")[0]);
    return competencia && !notaNaEscala(roteiro, competencia, valor);
  }).length;
  const algumEditavel = avaliadores.some((a) => podeLancarPor(dados, a));
  const lista = convocados?.length ? convocados : dados.convocados || [];
  const posicao = lista.findIndex((c) => c.id === convocado.id);
  const anterior = posicao > 0 ? lista[posicao - 1] : null;
  const proximo = posicao >= 0 ? lista[posicao + 1] || null : null;
  const maxima = pontuacaoMaxima(competencias);
  const modoAvaliador = dados.configuracao?.lancamento === "AVALIADOR";
  const sujo = alteradas.length > 0 || mudouComparecimento || mudouBanca;
  const progresso = {
    lancadas: competencias.reduce(
      (soma, c) =>
        soma +
        avaliadores.filter((a) =>
          aspectos.length
            ? mediaDoAvaliador(f.mapa, aspectos, c.id, a.id) !== null
            : (f.mapa[chaveDaNota(c.id, a.id)] ?? "") !== "",
        ).length,
      0,
    ),
    esperadas: competencias.length * avaliadores.length,
  };

  const mudarNota = (chave, valor) =>
    setF((atual) => ({ ...atual, mapa: { ...atual.mapa, [chave]: valor } }));

  function podeSair() {
    if (!sujo) return true;
    return (
      globalThis.confirm?.("Sair sem salvar as notas desta ficha?") === true
    );
  }
  const voltar = () => {
    if (podeSair()) aoFechar();
  };
  const ir = (alvo) => {
    if (alvo && podeSair()) aoAbrir(alvo.id);
  };
  const voltarRef = useRef(voltar);
  voltarRef.current = voltar;
  useEffect(() => {
    const aoTeclar = (ev) => {
      if (ev.key !== "Escape" || ev.defaultPrevented) return;
      if (document.querySelector(".modal.show, .ui-gaveta")) return;
      ev.preventDefault();
      voltarRef.current();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  async function salvar({ abrirProximo = false } = {}) {
    setErro("");
    if (invalidas) {
      setErro("Há notas fora da escala do roteiro; corrija antes de salvar.");
      return;
    }
    if (incompletas.length) {
      const c = competencias.find((x) => x.id === incompletas[0].competencia);
      const a = avaliadores.find((x) => x.id === incompletas[0].avaliador);
      setErro(
        `Complete os ${aspectos.length} aspectos de ${a?.nome || "um avaliador"} em “${c?.nome || ""}” (ou apague todos).`,
      );
      return;
    }
    if (!sujo) {
      if (abrirProximo && proximo) aoAbrir(proximo.id);
      else setErro("Nada mudou nesta ficha.");
      return;
    }
    const p = { notas: alteradas };
    if (mudouComparecimento || mudouBanca) {
      if (f.compareceu) p.compareceu = f.compareceu;
      if (f.banca !== null) p.banca = Number(f.banca);
    }
    const resposta = await aoSalvar(p);
    if (resposta?.erro) {
      setErro(resposta.erro);
      return;
    }
    if (abrirProximo && proximo) aoAbrir(proximo.id);
  }

  const celulas = () => [
    ...(raiz.current?.querySelectorAll("[data-celula]") || []),
  ];
  function focarDepois(atual) {
    const todas = celulas();
    const seguinte = todas[todas.indexOf(atual) + 1];
    if (!seguinte) return;
    const indice = Number(seguinte.dataset.competenciaIndice);
    if (Number.isInteger(indice) && indice !== aba) {
      setAba(indice);
      setTimeout(() => seguinte.focus(), 0);
    } else seguinte.focus();
  }

  /* Enter: próximo campo; Ctrl+Enter: salva. */
  function aoTeclar(evento) {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    if (evento.ctrlKey || evento.metaKey) {
      void salvar();
      return;
    }
    focarDepois(evento.currentTarget);
  }

  /* Botão de nota: preenche o campo em foco da competência (ou o primeiro vazio) e passa ao próximo. */
  function escolherNota(competencia, valor) {
    const daCompetencia = celulas().filter(
      (c) => c.dataset.competencia === competencia,
    );
    const campo =
      (ativo?.competencia === competencia &&
        daCompetencia.find((c) => c.dataset.chave === ativo.chave)) ||
      daCompetencia.find((c) => (f.mapa[c.dataset.chave] ?? "") === "") ||
      daCompetencia[0];
    if (!campo) return;
    mudarNota(campo.dataset.chave, String(valor));
    focarDepois(campo);
  }

  let indiceDaCelula = 0;

  return (
    <section
      className="entrevistas-analise"
      id="entrevistasFichaDoCandidato"
      ref={raiz}
      aria-labelledby="entrevistasFichaTitulo"
      data-tour="entrevistas-ficha"
    >
      <header
        className="entrevistas-analise-topo"
        data-tour="entrevistas-ficha-topo"
      >
        <button
          type="button"
          className="btn secondary small"
          data-acao="voltar-a-lista"
          onClick={voltar}
        >
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Voltar à
          lista
        </button>
        <div className="entrevistas-analise-identidade">
          <span className="ui-texto-secundario">
            {[
              convocado.vaga && `Vaga ${convocado.vaga}`,
              nomeDoCargo(convocado.cargo),
            ]
              .filter(Boolean)
              .join(" · ") || "Ficha de notas"}
          </span>
          <h2 id="entrevistasFichaTitulo">
            {convocado.candidato}
            {convocado.codigo ? <span> · cód. {convocado.codigo}</span> : null}
          </h2>
        </div>
        <dl
          className="entrevistas-analise-dados"
          aria-label="Dados do convocado"
        >
          <div>
            <dt>Modalidade</dt>
            <dd>{convocado.modalidade || "—"}</dd>
          </div>
          <div>
            <dt>Nota da análise</dt>
            <dd>{numeroBR(convocado.nota_analise)}</dd>
          </div>
          <div>
            <dt>Gravado</dt>
            <dd>
              {numeroBR(convocado.nota)}{" "}
              <SeloDoParecer parecer={convocado.parecer} />
            </dd>
          </div>
          <div>
            <dt>Roteiro</dt>
            <dd title={roteiro?.nome || undefined}>
              {roteiro ? `v${roteiro.versao}` : "—"}
              {aspectos.length ? ` · ${aspectos.length} aspectos` : ""}
            </dd>
          </div>
          <div>
            <dt>Lançamento</dt>
            <dd>{rotuloDoLancamento(dados.configuracao?.lancamento)}</dd>
          </div>
        </dl>
        <nav className="entrevistas-analise-navegacao" aria-label="Convocados">
          <button
            type="button"
            className="btn secondary small"
            data-acao="ficha-anterior"
            disabled={!anterior || salvando}
            title={anterior?.candidato}
            onClick={() => ir(anterior)}
          >
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />{" "}
            Anterior
          </button>
          {posicao >= 0 ? (
            <span className="ui-texto-secundario">
              {posicao + 1} de {lista.length}
            </span>
          ) : null}
          <button
            type="button"
            className="btn secondary small"
            data-acao="ficha-proxima"
            disabled={!proximo || salvando}
            title={proximo?.candidato}
            onClick={() => ir(proximo)}
          >
            Próximo{" "}
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </button>
        </nav>
      </header>

      <form
        className="entrevistas-analise-formulario"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <div className="entrevistas-analise-grade">
          <div className="entrevistas-analise-principal">
            {!roteiro ? (
              <Aviso tom="warning">
                Configure a entrevista do edital antes de lançar notas.
              </Aviso>
            ) : null}
            <div className="ui-card entrevistas-ficha-topo">
              <Comparecimento
                valor={f.compareceu}
                desabilitado={!dados.pode_editar || salvando}
                aoMudar={(compareceu) =>
                  setF((atual) => ({ ...atual, compareceu }))
                }
              />
              {bancas.length > 1 ||
              (convocado.banca !== null && convocado.banca !== undefined) ? (
                <label className="entrevistas-ficha-banca">
                  <span>Banca</span>
                  <select
                    id="entrevistasFichaBanca"
                    value={f.banca ?? ""}
                    disabled={!dados.pode_editar || salvando}
                    onChange={(e) =>
                      setF((atual) => ({
                        ...atual,
                        banca:
                          e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  >
                    <option value="">Todas</option>
                    {bancas.map((b) => (
                      <option key={b} value={b}>
                        Banca {b}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            {modoAvaliador && dados.pode_editar && !dados.admin_global ? (
              <Aviso tom="info">
                Você só edita a sua coluna.
                {algumEditavel
                  ? ""
                  : " Nenhum membro desta banca está ligado ao seu perfil."}
              </Aviso>
            ) : null}

            {roteiro && avaliadores.length ? (
              <>
                <nav
                  className="entrevistas-competencias-abas"
                  aria-label="Competências"
                >
                  {competencias.map((c, i) => {
                    const linha = resultado.competencias.find(
                      (x) => x.id === c.id,
                    );
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={aba === i}
                        aria-label={`Competência ${i + 1}: ${c.nome}`}
                        data-situacao={situacaoDaCompetencia(linha, false)}
                        onClick={() => setAba(i)}
                      >
                        {i + 1}
                        <small>{numeroBR(linha?.nota)}</small>
                      </button>
                    );
                  })}
                </nav>
                {competencias.map((c, indiceDaCompetencia) => {
                  const linha = resultado.competencias.find(
                    (x) => x.id === c.id,
                  );
                  const peso = rotuloDoPeso(c.peso);
                  const opcoes = opcoesDaEscala(roteiro, c.nota_maxima);
                  const incompleta = incompletas.some(
                    (x) => x.competencia === c.id,
                  );
                  const valorAtivo =
                    ativo?.competencia === c.id
                      ? (f.mapa[ativo.chave] ?? "")
                      : null;
                  return (
                    <section
                      key={c.id}
                      className="ui-card entrevistas-ficha-competencia"
                      data-competencia={c.ordem}
                      data-situacao={situacaoDaCompetencia(linha, incompleta)}
                      data-aba={
                        aba === indiceDaCompetencia ? "ativa" : undefined
                      }
                      aria-labelledby={`entrevistasCompetencia-${c.id}`}
                    >
                      <header className="entrevistas-ficha-competencia-topo">
                        <div>
                          <h3
                            id={`entrevistasCompetencia-${c.id}`}
                            title={c.descricao || undefined}
                          >
                            {indiceDaCompetencia + 1}. {c.nome}
                          </h3>
                          <small>
                            0 a {numeroBR(c.nota_maxima)}
                            {peso ? ` · peso ${peso}` : ""}
                            {c.avaliacao === "GRUPO" ? " · em grupo" : ""}
                            {linha?.minimo !== null &&
                            linha?.minimo !== undefined
                              ? ` · mín. ${numeroBR(linha.minimo)}`
                              : ""}
                          </small>
                          {aspectos.length ? (
                            <small className="entrevistas-ficha-aspectos">
                              Por avaliador:{" "}
                              {aspectos.map((x) => x.nome).join(" · ")} (média)
                            </small>
                          ) : null}
                        </div>
                        <div className="entrevistas-ficha-competencia-nota">
                          <span>
                            Média da banca <b>{numeroBR(linha?.media)}</b>
                          </span>
                          <strong>{numeroBR(linha?.nota)}</strong>
                          {linha?.abaixoDoMinimo ? (
                            <small>abaixo do mínimo</small>
                          ) : null}
                          {linha?.eliminatoria ? (
                            <small>eliminatória</small>
                          ) : null}
                        </div>
                      </header>
                      {algumEditavel && opcoes.length && opcoes.length <= 11 ? (
                        <BotoesDeNota
                          opcoes={opcoes}
                          atual={valorAtivo}
                          desabilitado={salvando}
                          rotulo={`Notas de ${c.nome}`}
                          aoEscolher={(valor) => escolherNota(c.id, valor)}
                        />
                      ) : null}
                      <div
                        className="entrevistas-ficha-avaliadores"
                        data-aspectos={aspectos.length || undefined}
                      >
                        {avaliadores.map((a) => {
                          const editavel = podeLancarPor(dados, a);
                          const campos = aspectos.length
                            ? aspectos.map((x) => ({
                                chave: chaveDaNota(c.id, a.id, x.id),
                                nome: x.nome,
                              }))
                            : [{ chave: chaveDaNota(c.id, a.id), nome: "" }];
                          const media = aspectos.length
                            ? mediaDoAvaliador(f.mapa, aspectos, c.id, a.id)
                            : null;
                          const faltando = incompletas.some(
                            (x) =>
                              x.competencia === c.id && x.avaliador === a.id,
                          );
                          return (
                            <div
                              key={a.id}
                              className={classes(
                                "entrevistas-ficha-avaliador",
                                editavel && "is-editavel",
                                faltando && "is-incompleto",
                              )}
                            >
                              <div className="entrevistas-ficha-avaliador-nome">
                                <b>{a.nome}</b>
                                <small>
                                  {a.origem}
                                  {a.ativo === false ? " · saiu da banca" : ""}
                                </small>
                                {aspectos.length ? (
                                  <span
                                    className="entrevistas-ficha-media"
                                    title="Média dos aspectos: a nota do avaliador"
                                  >
                                    ={" "}
                                    {media === null
                                      ? "—"
                                      : numeroBR(Math.round(media * 100) / 100)}
                                  </span>
                                ) : null}
                              </div>
                              <div className="entrevistas-ficha-campos">
                                {campos.map((campo) => {
                                  const valor = f.mapa[campo.chave] ?? "";
                                  const invalida =
                                    valor !== "" &&
                                    !notaNaEscala(roteiro, c, valor);
                                  const escolhida = opcoes.find(
                                    (o) =>
                                      String(o.valor) ===
                                      String(valor).replace(",", "."),
                                  );
                                  const indice = editavel
                                    ? indiceDaCelula++
                                    : undefined;
                                  return (
                                    <label
                                      key={campo.chave}
                                      className="entrevistas-ficha-campo"
                                    >
                                      {campo.nome ? (
                                        <span title={campo.nome}>
                                          {abreviar(campo.nome)}
                                        </span>
                                      ) : null}
                                      <CampoDeNota
                                        valor={valor}
                                        rotulo={`Nota de ${a.nome} em ${c.nome}${campo.nome ? ` · ${campo.nome}` : ""}`}
                                        editavel={editavel}
                                        desabilitado={salvando}
                                        invalida={invalida}
                                        indice={indice}
                                        ativo={ativo?.chave === campo.chave}
                                        titulo={escolhida?.rotulo || undefined}
                                        chave={campo.chave}
                                        competencia={c.id}
                                        competenciaIndice={indiceDaCompetencia}
                                        aoMudar={(v) =>
                                          mudarNota(campo.chave, v)
                                        }
                                        aoTeclar={aoTeclar}
                                        aoFocar={() => {
                                          setAtivo({
                                            competencia: c.id,
                                            chave: campo.chave,
                                          });
                                          setAba(indiceDaCompetencia);
                                        }}
                                      />
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </>
            ) : roteiro ? (
              <Aviso tom="warning">
                Nenhum membro na banca {f.banca ?? ""}. Cadastre a banca na
                configuração.
              </Aviso>
            ) : null}
          </div>
          {roteiro ? (
            <Lateral
              resultado={resultado}
              motivos={motivos}
              maxima={maxima}
              competencias={competencias}
              roteiro={roteiro}
              progresso={progresso}
            />
          ) : null}
        </div>

        <div className="ui-gaveta-rodape entrevistas-analise-barra">
          <span className="entrevistas-rodape-resumo">
            {alteradas.length
              ? `${alteradas.length} ${alteradas.length === 1 ? "nota alterada" : "notas alteradas"}`
              : "Sem alterações nas notas"}
            {dados.pode_editar ? " · Enter avança, Ctrl+Enter salva" : ""}
          </span>
          {erro ? (
            <span className="entrevistas-analise-erro" role="alert">
              {erro}
            </span>
          ) : null}
          <button
            type="button"
            className="btn secondary"
            data-acao="fechar-ficha"
            onClick={voltar}
          >
            Voltar
          </button>
          {dados.pode_editar && roteiro ? (
            <>
              {proximo ? (
                <button
                  type="button"
                  className="btn secondary"
                  disabled={salvando}
                  onClick={() => void salvar({ abrirProximo: true })}
                >
                  Salvar e abrir o próximo
                </button>
              ) : null}
              <button type="submit" className="btn" disabled={salvando}>
                <i className="fa-solid fa-floppy-disk" aria-hidden="true" />{" "}
                {salvando ? "Salvando…" : "Salvar notas"}
              </button>
            </>
          ) : null}
        </div>
      </form>
    </section>
  );
}
