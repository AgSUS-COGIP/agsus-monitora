import { useEffect, useMemo, useRef, useState } from "react";
import {
  avaliacoesDoMapa,
  avaliadoresDaFicha,
  bancasDoEdital,
  calcularEntrevista,
  chaveDaNota,
  mapaDasAvaliacoes,
  motivosDoParecer,
  notasAlteradas,
  podeLancarPor,
  rotuloDoLancamento,
  nomeDoCargo,
} from "../../lib/conducao-de-entrevista.js";
import {
  notaNaEscala,
  opcoesDaEscala,
  pontuacaoMaxima,
  rotuloDoPeso,
} from "../../lib/roteiro-de-entrevista.js";
import { Modal } from "../modal.jsx";
import { TopoDaGaveta } from "../recursos/partes.jsx";
import { Aviso, classes, numeroBR, Segmentado } from "./partes.jsx";
import { SeloDoParecer } from "./tabela.jsx";

/*
  Ficha de notas de um convocado, na gaveta do painel: comparecimento, banca
  e, para cada competência do roteiro, uma coluna por avaliador com as notas
  que a escala aceita (níveis e lista: caixa de escolha com o nome do nível;
  faixa: número de passo em passo). Ao lado, média × peso de cada
  competência, o total e o parecer — prévia calculada aqui pelas mesmas
  regras do banco (calcularEntrevista); depois de salvar, vale o que o banco
  devolveu.

  Lançamento "Cada avaliador lança a sua": só a coluna do membro ligado ao
  perfil de quem está logado fica aberta (o administrador global lança por
  todos). Secretaria: todas.

  Teclado: Enter passa para a próxima nota (avaliador seguinte, depois a
  competência seguinte); Ctrl+Enter salva.
*/

const COMPARECIMENTO = [
  { valor: "S", rotulo: "Compareceu" },
  { valor: "N", rotulo: "Faltou" },
];

function CelulaDaNota({
  roteiro,
  competencia,
  avaliador,
  valor,
  editavel,
  indice,
  aoMudar,
  aoTeclar,
}) {
  const opcoes = useMemo(
    () => opcoesDaEscala(roteiro, competencia.nota_maxima),
    [roteiro, competencia.nota_maxima],
  );
  const rotulo = `Nota de ${avaliador.nome} em ${competencia.nome}`;
  const invalida =
    valor !== "" &&
    valor !== undefined &&
    !notaNaEscala(roteiro, competencia, valor);
  const escolhida = opcoes.find((o) => String(o.valor) === String(valor));
  if (!editavel)
    return (
      <span
        className="entrevistas-nota-fixa"
        title={escolhida?.descricao || undefined}
        aria-label={rotulo}
      >
        {valor === "" || valor === undefined ? "—" : numeroBR(valor)}
        {escolhida?.rotulo ? <small>{escolhida.rotulo}</small> : null}
      </span>
    );
  if (roteiro.escala === "FAIXA")
    return (
      <input
        type="number"
        className={classes("entrevistas-nota", invalida && "is-invalida")}
        min="0"
        max={competencia.nota_maxima}
        step={roteiro.passo || 0.5}
        inputMode="decimal"
        value={valor ?? ""}
        aria-label={rotulo}
        aria-invalid={invalida || undefined}
        data-celula={indice}
        onChange={(e) => aoMudar(e.target.value)}
        onKeyDown={aoTeclar}
      />
    );
  return (
    <select
      className={classes("entrevistas-nota", invalida && "is-invalida")}
      value={valor ?? ""}
      aria-label={rotulo}
      title={escolhida?.descricao || undefined}
      data-celula={indice}
      onChange={(e) => aoMudar(e.target.value)}
      onKeyDown={aoTeclar}
    >
      <option value="">—</option>
      {opcoes.map((o) => (
        <option
          key={o.valor}
          value={String(o.valor)}
          title={o.descricao || undefined}
        >
          {numeroBR(o.valor)}
          {o.rotulo ? ` — ${o.rotulo}` : ""}
        </option>
      ))}
      {invalida ? (
        <option value={valor}>{valor} (fora da escala)</option>
      ) : null}
    </select>
  );
}

function estadoInicial(dados, convocado) {
  const bancas = bancasDoEdital(dados.avaliadores);
  const mapa = mapaDasAvaliacoes(convocado.avaliacoes);
  return {
    compareceu: convocado.compareceu || null,
    banca: convocado.banca ?? (bancas.length === 1 ? bancas[0] : null),
    original: mapa,
    mapa,
  };
}

export function FichaDoCandidato({
  dados,
  convocado,
  salvando,
  aoSalvar,
  aoAbrirProximo,
  aoFechar,
}) {
  const roteiro = dados.configuracao?.roteiro || null;
  const [f, setF] = useState(() => estadoInicial(dados, convocado));
  const [erro, setErro] = useState("");
  const corpo = useRef(null);

  /* O payload novo (depois de salvar ou recarregar) é a verdade: a ficha recomeça dele. */
  useEffect(() => {
    setF(estadoInicial(dados, convocado));
  }, [dados, convocado]);

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
        avaliacoes: avaliacoesDoMapa(f.mapa),
      }),
    [roteiro, f.compareceu, f.mapa],
  );
  const motivos = motivosDoParecer(resultado, f.compareceu, roteiro);
  const alteradas = notasAlteradas(f.original, f.mapa);
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
  const indiceAtual = dados.convocados.findIndex((c) => c.id === convocado.id);
  const proximo = dados.convocados[indiceAtual + 1] || null;
  const maxima = pontuacaoMaxima(competencias);
  const modoAvaliador = dados.configuracao?.lancamento === "AVALIADOR";

  const mudarNota = (competencia, avaliador, valor) =>
    setF((atual) => ({
      ...atual,
      mapa: { ...atual.mapa, [chaveDaNota(competencia, avaliador)]: valor },
    }));

  async function salvar({ abrirProximo = false } = {}) {
    setErro("");
    if (invalidas) {
      setErro("Há notas fora da escala do roteiro; corrija antes de salvar.");
      return;
    }
    if (!alteradas.length && !mudouComparecimento && !mudouBanca) {
      if (abrirProximo && proximo) aoAbrirProximo(proximo.id);
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
    if (abrirProximo && proximo) aoAbrirProximo(proximo.id);
  }

  /* Enter: próxima nota; Ctrl+Enter: salva. */
  function aoTeclar(evento) {
    if (evento.key !== "Enter") return;
    evento.preventDefault();
    if (evento.ctrlKey || evento.metaKey) {
      void salvar();
      return;
    }
    const celulas = [
      ...(corpo.current?.querySelectorAll("[data-celula]") || []),
    ];
    const posicao = celulas.indexOf(evento.currentTarget);
    celulas[posicao + 1]?.focus();
  }

  let indiceDaCelula = 0;

  return (
    <Modal
      id="entrevistasFichaDoCandidato"
      rotuloId="entrevistasFichaTitulo"
      aoFechar={aoFechar}
      fecharAoClicarFora={false}
      className="analises-drawer-backdrop entrevistas-gaveta"
      cartaoClassName="analises-drawer entrevistas-gaveta-larga"
    >
      <TopoDaGaveta
        sobretitulo={
          convocado.codigo
            ? `Ficha de notas · cód. ${convocado.codigo}`
            : "Ficha de notas"
        }
        titulo={convocado.candidato}
        tituloId="entrevistasFichaTitulo"
        rotuloDoFechar="Fechar a ficha"
        aoFechar={aoFechar}
        resumo={
          <>
            <span className="status">
              <i className="fa-solid fa-database" aria-hidden="true" />
              Gravado: {numeroBR(convocado.nota)} ·{" "}
              <SeloDoParecer parecer={convocado.parecer} />
            </span>
            <span>
              <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
              {rotuloDoLancamento(dados.configuracao?.lancamento)}
            </span>
          </>
        }
      />
      <div className="analises-drawer-context">
        <div>
          <small>Vaga</small>
          <strong>
            {[convocado.vaga, nomeDoCargo(convocado.cargo)]
              .filter(Boolean)
              .join(" · ") || "—"}
          </strong>
        </div>
        <div>
          <small>Modalidade</small>
          <strong>{convocado.modalidade || "—"}</strong>
        </div>
        <div>
          <small>Nota da análise</small>
          <strong>{numeroBR(convocado.nota_analise)}</strong>
        </div>
        <div>
          <small>Roteiro</small>
          <strong>
            {roteiro ? `${roteiro.nome} (v${roteiro.versao})` : "—"}
          </strong>
        </div>
      </div>

      <form
        className="entrevistas-formulario"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <div id="analisesDrawerBody" ref={corpo}>
          <div className="detail-shell">
            {!roteiro ? (
              <Aviso tom="warning">
                Configure a entrevista do edital antes de lançar notas.
              </Aviso>
            ) : null}
            <div className="entrevistas-ficha-topo">
              <div className="field">
                <span className="entrevistas-rotulo">Comparecimento</span>
                <Segmentado
                  rotulo="Comparecimento"
                  opcoes={COMPARECIMENTO}
                  valor={f.compareceu}
                  desabilitado={!dados.pode_editar}
                  aoMudar={(compareceu) =>
                    setF((atual) => ({ ...atual, compareceu }))
                  }
                />
                {!f.compareceu ? (
                  <small className="entrevistas-dica">Não informado.</small>
                ) : null}
              </div>
              {bancas.length > 1 ||
              (convocado.banca !== null && convocado.banca !== undefined) ? (
                <div className="field">
                  <label htmlFor="entrevistasFichaBanca">Banca</label>
                  <select
                    id="entrevistasFichaBanca"
                    value={f.banca ?? ""}
                    disabled={!dados.pode_editar}
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
                </div>
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
            {!dados.pode_editar ? (
              <Aviso tom="info">Somente consulta.</Aviso>
            ) : null}

            {roteiro && avaliadores.length ? (
              <div className="entrevistas-tabela-rolagem">
                <table className="entrevistas-tabela entrevistas-ficha">
                  <thead>
                    <tr>
                      <th scope="col">Competência</th>
                      {avaliadores.map((a) => (
                        <th
                          scope="col"
                          key={a.id}
                          className={classes(
                            podeLancarPor(dados, a) && "is-editavel",
                          )}
                        >
                          {a.nome}
                          <small>
                            {a.origem}
                            {a.ativo === false ? " · saiu da banca" : ""}
                          </small>
                        </th>
                      ))}
                      <th scope="col">Média</th>
                      <th scope="col">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competencias.map((c) => {
                      const linha = resultado.competencias.find(
                        (x) => x.id === c.id,
                      );
                      const peso = rotuloDoPeso(c.peso);
                      return (
                        <tr key={c.id} data-competencia={c.ordem}>
                          <th scope="row" title={c.descricao || undefined}>
                            {c.nome}
                            <small>
                              0 a {numeroBR(c.nota_maxima)}
                              {peso ? ` · peso ${peso}` : ""}
                              {c.avaliacao === "GRUPO" ? " · em grupo" : ""}
                              {linha?.minimo !== null &&
                              linha?.minimo !== undefined
                                ? ` · mín. ${numeroBR(linha.minimo)}`
                                : ""}
                            </small>
                          </th>
                          {avaliadores.map((a) => {
                            const editavel = podeLancarPor(dados, a);
                            const indice = editavel
                              ? indiceDaCelula++
                              : undefined;
                            return (
                              <td key={a.id}>
                                <CelulaDaNota
                                  roteiro={roteiro}
                                  competencia={c}
                                  avaliador={a}
                                  valor={f.mapa[chaveDaNota(c.id, a.id)] ?? ""}
                                  editavel={editavel}
                                  indice={indice}
                                  aoMudar={(valor) =>
                                    mudarNota(c.id, a.id, valor)
                                  }
                                  aoTeclar={aoTeclar}
                                />
                              </td>
                            );
                          })}
                          <td>{numeroBR(linha?.media)}</td>
                          <td
                            className={classes(
                              (linha?.abaixoDoMinimo || linha?.eliminatoria) &&
                                "entrevistas-reprova",
                            )}
                          >
                            <strong>{numeroBR(linha?.nota)}</strong>
                            {linha?.eliminatoria ? (
                              <small>eliminatória</small>
                            ) : null}
                            {linha?.abaixoDoMinimo ? (
                              <small>abaixo do mínimo</small>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" colSpan={avaliadores.length + 2}>
                        Total
                        {resultado.minimoTotal !== null
                          ? ` (mínimo ${numeroBR(resultado.minimoTotal)})`
                          : ""}
                      </th>
                      <td id="entrevistasFichaTotal">
                        <strong>{numeroBR(resultado.total)}</strong>
                        <small> / {numeroBR(maxima)}</small>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : roteiro ? (
              <Aviso tom="warning">
                Nenhum membro na banca {f.banca ?? ""}. Cadastre a banca na
                configuração.
              </Aviso>
            ) : null}

            {roteiro ? (
              <div className="entrevistas-previa" aria-live="polite">
                <span>Prévia do parecer:</span>
                <span id="entrevistasFichaParecer">
                  <SeloDoParecer parecer={resultado.parecer} />
                </span>
                {motivos.length ? (
                  <ul>
                    {motivos.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {roteiro?.escala === "NIVEIS" && roteiro.niveis?.length ? (
              <details className="entrevistas-niveis">
                <summary>Níveis da escala</summary>
                <dl>
                  {roteiro.niveis.map((n) => (
                    <div key={n.nota}>
                      <dt>
                        {numeroBR(n.nota)} — {n.nome}
                      </dt>
                      <dd>{n.descricao}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            ) : null}

            {erro ? (
              <Aviso tom="danger" papel="alert">
                {erro}
              </Aviso>
            ) : null}
          </div>
        </div>
        <div className="entrevistas-gaveta-rodape">
          <span className="entrevistas-rodape-resumo">
            {alteradas.length
              ? `${alteradas.length} ${alteradas.length === 1 ? "nota alterada" : "notas alteradas"}`
              : "Sem alterações nas notas"}
            {dados.pode_editar ? " · Enter avança, Ctrl+Enter salva" : ""}
          </span>
          <button type="button" className="btn secondary" onClick={aoFechar}>
            Fechar
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
    </Modal>
  );
}
