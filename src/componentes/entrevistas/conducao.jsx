import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  aplicarRoteiroNaConfiguracao,
  bancasDoEdital,
  completarMembrosPelaComposicao,
  dadosDaConfiguracaoParaSalvar,
  errosDaConfiguracao,
  FILTROS_DA_FICHA,
  filtrarConvocados,
  gruposDeConvocacao,
  MODOS_DE_LANCAMENTO,
  novoAvaliador,
  progressoDasNotas,
  rascunhoDaConfiguracao,
  rotuloDoLancamento,
  selecaoSugerida,
  textoDaRegra,
  avaliadoresDaFicha,
  nomeDoCargo,
  ehPcd,
  marcaDoEdital,
  textoDaJanela,
} from "../../lib/conducao-de-entrevista.js";
import { rotuloDoComparecimento } from "../../lib/entrevistas-do-painel.js";
import {
  pontuacaoMaxima,
  textoDaPontuacao,
} from "../../lib/roteiro-de-entrevista.js";
import { Modal } from "../modal.jsx";
import { TopoDaGaveta } from "../recursos/partes.jsx";
import { FichaDoCandidato } from "./ficha.jsx";
import {
  Aviso,
  BotaoDeLinha,
  Campo,
  classes,
  ComposicaoDaBanca,
  numeroBR,
  RegraDeConvocacao,
  Segmentado,
  trocarNaLista,
} from "./partes.jsx";
import { SeloDoParecer } from "./tabela.jsx";

/*
  Visão "Conduzir entrevistas" do painel: escolhido o edital (da área do
  painel), três passos em cartões —

  1. Configuração: o roteiro (a versão exata; pré-preenche a convocação e a
     banca com o padrão dele), a regra de convocação, a composição da banca,
     o modo de lançamento, as vagas imediatas de cada vaga e os membros da
     banca.
  2. Convocação: os aprovados na análise de cada vaga, na ordem, com a
     sugestão da regra marcada; "Convocar selecionados" e "Desconvocar" (com
     motivo, só sem notas).
  3. Ficha de notas: os convocados; cada um abre a ficha (ficha.jsx).

  Quem não edita as entrevistas (`pode_editar` falso) vê tudo sem os botões.
*/

/* ── Passo 1: configuração ─────────────────────────────────────────── */

function ResumoDaConfiguracao({ dados }) {
  const cfg = dados.configuracao;
  const ativos = dados.avaliadores.filter((a) => a.ativo !== false);
  return (
    <dl className="entrevistas-resumo">
      <div>
        <dt>Roteiro</dt>
        <dd>
          {cfg.roteiro?.nome} <small>v{cfg.roteiro?.versao}</small>
          <small>{textoDaPontuacao(cfg.roteiro)}</small>
        </dd>
      </div>
      <div>
        <dt>Lançamento</dt>
        <dd>{rotuloDoLancamento(cfg.lancamento)}</dd>
      </div>
      <div>
        <dt>Banca</dt>
        <dd>
          {ativos.length
            ? `${ativos.length} ${ativos.length === 1 ? "membro" : "membros"} em ${bancasDoEdital(ativos).length} ${bancasDoEdital(ativos).length === 1 ? "banca" : "bancas"}`
            : "Sem membros"}
          {cfg.banca?.length ? (
            <small>
              {cfg.banca.map((b) => `${b.quantidade}× ${b.origem}`).join(" · ")}
            </small>
          ) : null}
        </dd>
      </div>
      <div>
        <dt>Convocação</dt>
        <dd>
          {cfg.convocacao?.multiplo_imediatas ?? "—"}× as vagas imediatas · até
          a {cfg.convocacao?.posicao_cadastro_reserva ?? "—"}ª do CR
          {cfg.convocacao?.excecoes?.length ? (
            <small>
              Exceções:{" "}
              {cfg.convocacao.excecoes
                .map(
                  (e) =>
                    `${e.termo_cargo} (${e.multiplo_imediatas ?? "—"}× / ${e.posicao_cadastro_reserva ?? "—"}ª)`,
                )
                .join(" · ")}
            </small>
          ) : null}
        </dd>
      </div>
    </dl>
  );
}

function FormularioDeConfiguracao({
  dados,
  roteiros,
  salvando,
  aoSalvar,
  aoCancelar,
}) {
  const [r, setR] = useState(() => rascunhoDaConfiguracao(dados));
  const [tentou, setTentou] = useState(false);
  const [erroDoBanco, setErroDoBanco] = useState("");
  const erros = useMemo(() => errosDaConfiguracao(r), [r]);
  const visiveis = tentou ? erros : {};
  const quantos = Object.keys(erros).length;
  const mudar = (mudancas) => setR((atual) => ({ ...atual, ...mudancas }));

  /* O roteiro atual do edital pode ser uma versão que já saiu da lista. */
  const opcoes = useMemo(() => {
    const lista = roteiros.slice();
    const atual = dados.configuracao?.roteiro;
    if (atual && !lista.some((x) => x.id === atual.id)) lista.unshift(atual);
    return lista;
  }, [roteiros, dados.configuracao]);
  const escolhido = opcoes.find((x) => x.id === r.roteiro) || null;
  const temNotas = dados.convocados.some((c) => c.avaliacoes?.length);

  async function salvar(evento) {
    evento.preventDefault();
    setTentou(true);
    if (quantos) return;
    setErroDoBanco("");
    const resultado = await aoSalvar(dadosDaConfiguracaoParaSalvar(r));
    if (resultado?.erro) setErroDoBanco(resultado.erro);
  }

  return (
    <form className="entrevistas-formulario" onSubmit={salvar} noValidate>
      <div className="entrevistas-grade">
        <Campo
          rotulo="Roteiro"
          obrigatorio
          erro={visiveis.roteiro}
          largo
          dica={
            temNotas
              ? "Já há notas lançadas: o roteiro não pode mais ser trocado."
              : escolhido
                ? `${textoDaPontuacao(escolhido)} · ${escolhido.competencias?.length ?? 0} competências`
                : "Escolher o roteiro preenche a convocação e a banca com o padrão dele."
          }
        >
          <select
            value={r.roteiro}
            disabled={temNotas}
            onChange={(e) =>
              setR((atual) =>
                aplicarRoteiroNaConfiguracao(
                  atual,
                  opcoes.find((x) => x.id === e.target.value) || null,
                ),
              )
            }
          >
            <option value="">Escolha…</option>
            {opcoes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome} (v{x.versao})
                {x.ativo === false ? " — versão anterior" : ""}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <h4 className="entrevistas-subtitulo">Modo de lançamento das notas</h4>
      <Segmentado
        rotulo="Modo de lançamento das notas"
        opcoes={MODOS_DE_LANCAMENTO}
        valor={r.lancamento}
        aoMudar={(lancamento) => mudar({ lancamento })}
      />

      <h4 className="entrevistas-subtitulo">Regra de convocação</h4>
      <RegraDeConvocacao
        valor={r.convocacao}
        erros={visiveis}
        aoMudar={(convocacao) => mudar({ convocacao })}
      />

      <h4 className="entrevistas-subtitulo">Vagas imediatas por vaga</h4>
      {r.vagas.length ? (
        <div className="entrevistas-tabela-rolagem">
          <table className="entrevistas-tabela">
            <thead>
              <tr>
                <th scope="col">Vaga</th>
                <th scope="col">Cargo</th>
                <th scope="col">Aprovados</th>
                <th scope="col">Vagas imediatas</th>
              </tr>
            </thead>
            <tbody>
              {r.vagas.map((v) => (
                <tr key={v.vaga}>
                  <td>{v.vaga}</td>
                  <td>{nomeDoCargo(v.cargo)}</td>
                  <td>{v.aprovados}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max="999"
                      step="1"
                      aria-label={`Vagas imediatas da vaga ${v.vaga}`}
                      value={v.vagas_imediatas}
                      aria-invalid={
                        visiveis[`vaga.${v.vaga}`] ? true : undefined
                      }
                      onChange={(e) =>
                        mudar({
                          vagas: r.vagas.map((x) =>
                            x.vaga === v.vaga
                              ? { ...x, vagas_imediatas: e.target.value }
                              : x,
                          ),
                        })
                      }
                    />
                    {visiveis[`vaga.${v.vaga}`] ? (
                      <small className="entrevistas-erro-campo" role="alert">
                        {visiveis[`vaga.${v.vaga}`]}
                      </small>
                    ) : v.origem === "quadro" &&
                      v.vagas_imediatas === v.sugerido ? (
                      <small
                        className="entrevistas-origem-vaga"
                        title={v.lotacao_quadro}
                      >
                        do quadro do edital
                      </small>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="entrevistas-vazio-linha">
          Nenhuma vaga com análise curricular neste edital.
        </p>
      )}

      <h4 className="entrevistas-subtitulo">Composição da banca</h4>
      <ComposicaoDaBanca
        valor={r.banca}
        erros={visiveis}
        aoMudar={(banca) => mudar({ banca })}
      />

      <h4 className="entrevistas-subtitulo">Membros da banca</h4>
      <div className="entrevistas-sublista" aria-label="Membros da banca">
        {r.avaliadores.length ? (
          <ul className="entrevistas-linhas">
            {r.avaliadores.map((a) => {
              const p = `avaliador.${a.chave}`;
              const trocar = (campo, valor) =>
                mudar({
                  avaliadores: trocarNaLista(
                    r.avaliadores,
                    a.chave,
                    campo,
                    valor,
                  ),
                });
              return (
                <li key={a.chave} className="entrevistas-linha-membro">
                  <Campo rotulo="Nome" erro={visiveis[`${p}.nome`]}>
                    <input
                      type="text"
                      value={a.nome}
                      onChange={(e) => trocar("nome", e.target.value)}
                    />
                  </Campo>
                  <Campo rotulo="Origem" erro={visiveis[`${p}.origem`]}>
                    <input
                      type="text"
                      value={a.origem}
                      list="entrevistasOrigens"
                      onChange={(e) => trocar("origem", e.target.value)}
                    />
                  </Campo>
                  <Campo rotulo="Banca nº" erro={visiveis[`${p}.banca`]}>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      step="1"
                      value={a.banca}
                      onChange={(e) => trocar("banca", e.target.value)}
                    />
                  </Campo>
                  <Campo
                    rotulo="Perfil no MONITORA (opcional)"
                    erro={visiveis[`${p}.perfil`]}
                    dica={
                      a.perfil && a.perfil === dados.meu_perfil
                        ? "Ligado ao seu perfil"
                        : "Para o próprio avaliador lançar as notas"
                    }
                  >
                    <input
                      type="text"
                      value={a.perfil}
                      placeholder="Identificador do perfil"
                      onChange={(e) => trocar("perfil", e.target.value.trim())}
                    />
                  </Campo>
                  <span className="entrevistas-competencia-acoes">
                    {dados.meu_perfil && a.perfil !== dados.meu_perfil ? (
                      <button
                        type="button"
                        className="btn secondary small"
                        title="Ligar este membro ao seu perfil"
                        onClick={() => trocar("perfil", dados.meu_perfil)}
                      >
                        Sou eu
                      </button>
                    ) : null}
                    <BotaoDeLinha
                      icone="fa-trash"
                      rotulo={`Tirar ${a.nome || "o membro"} da banca`}
                      aoClicar={() =>
                        mudar({
                          avaliadores: r.avaliadores.filter(
                            (x) => x.chave !== a.chave,
                          ),
                        })
                      }
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="entrevistas-vazio-linha">Nenhum membro cadastrado.</p>
        )}
        <datalist id="entrevistasOrigens">
          {[...new Set(r.banca.map((b) => b.origem).filter(Boolean))].map(
            (o) => (
              <option key={o} value={o} />
            ),
          )}
        </datalist>
        <div className="entrevistas-em-linha">
          <button
            type="button"
            className="btn secondary small"
            onClick={() =>
              mudar({ avaliadores: [...r.avaliadores, novoAvaliador()] })
            }
          >
            <i className="fa-solid fa-user-plus" aria-hidden="true" /> Membro
          </button>
          {r.banca.length ? (
            <button
              type="button"
              className="btn secondary small"
              title="Acrescenta as linhas que faltam para a composição da banca"
              onClick={() =>
                mudar({
                  avaliadores: completarMembrosPelaComposicao(
                    r.avaliadores,
                    r.banca,
                  ),
                })
              }
            >
              <i className="fa-solid fa-users" aria-hidden="true" /> Completar
              pela composição
            </button>
          ) : null}
        </div>
        <small className="entrevistas-dica">
          Quem sai da lista deixa a banca (as notas que já deu ficam no
          histórico).
        </small>
      </div>

      {tentou && quantos ? (
        <Aviso tom="danger" papel="alert">
          Confira{" "}
          {quantos === 1 ? "o campo marcado" : `os ${quantos} campos marcados`}{" "}
          antes de salvar.
        </Aviso>
      ) : null}
      {erroDoBanco ? (
        <Aviso tom="danger" papel="alert">
          {erroDoBanco}
        </Aviso>
      ) : null}
      <div className="entrevistas-acoes">
        {aoCancelar ? (
          <button type="button" className="btn secondary" onClick={aoCancelar}>
            Cancelar
          </button>
        ) : null}
        <button type="submit" className="btn" disabled={salvando}>
          <i className="fa-solid fa-floppy-disk" aria-hidden="true" />{" "}
          {salvando ? "Salvando…" : "Salvar configuração"}
        </button>
      </div>
    </form>
  );
}

function PassoDeConfiguracao({ dados, roteiros, salvando, aoSalvar }) {
  const configurado = Boolean(dados.configuracao);
  const [editando, setEditando] = useState(!configurado && dados.pode_editar);
  useEffect(() => {
    if (!configurado && dados.pode_editar) setEditando(true);
  }, [configurado, dados.pode_editar]);
  return (
    <section
      className="panel panel-pad entrevistas-passo"
      data-passo="configuracao"
      aria-labelledby="entrevistasPasso1"
    >
      <div className="entrevistas-passo-topo">
        <div>
          <span className="eyebrow">Passo 1</span>
          <h2 className="title" id="entrevistasPasso1">
            Configuração
          </h2>
        </div>
        <span
          className={classes("badge", configurado ? "aprovado" : "pendente")}
        >
          {configurado ? "Configurada" : "A configurar"}
        </span>
      </div>
      {editando ? (
        <FormularioDeConfiguracao
          dados={dados}
          roteiros={roteiros}
          salvando={salvando}
          aoSalvar={async (p) => {
            const resultado = await aoSalvar(p);
            if (resultado?.ok) setEditando(false);
            return resultado;
          }}
          aoCancelar={configurado ? () => setEditando(false) : null}
        />
      ) : configurado ? (
        <>
          <ResumoDaConfiguracao dados={dados} />
          {dados.pode_editar ? (
            <div className="entrevistas-acoes">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setEditando(true)}
              >
                <i className="fa-solid fa-pen" aria-hidden="true" /> Editar
                configuração
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="entrevistas-vazio-linha">
          A entrevista deste edital ainda não foi configurada.
        </p>
      )}
    </section>
  );
}

/* ── Passo 2: convocação ───────────────────────────────────────────── */

function ModalDeDesconvocar({ convocado, salvando, aoConfirmar, aoFechar }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const valido = motivo.trim().length >= 3 && motivo.trim().length <= 500;
  return (
    <Modal
      id="entrevistasDesconvocar"
      rotuloId="entrevistasDesconvocarTitulo"
      aoFechar={aoFechar}
      className="analises-drawer-backdrop entrevistas-gaveta"
      cartaoClassName="analises-drawer entrevistas-gaveta-estreita"
    >
      <TopoDaGaveta
        sobretitulo="Retirar da entrevista"
        titulo={convocado.candidato}
        tituloId="entrevistasDesconvocarTitulo"
        rotuloDoFechar="Fechar"
        aoFechar={aoFechar}
      />
      <form
        className="entrevistas-formulario entrevistas-formulario-curto"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valido) return;
          const resultado = await aoConfirmar(motivo.trim());
          if (resultado?.erro) setErro(resultado.erro);
        }}
      >
        <Campo
          rotulo="Motivo"
          obrigatorio
          dica="Fica no histórico da convocação (3 a 500 caracteres)."
          erro={erro}
          largo
        >
          <textarea
            rows={3}
            value={motivo}
            data-foco-inicial
            onChange={(e) => setMotivo(e.target.value)}
          />
        </Campo>
        <div className="entrevistas-acoes">
          <button type="button" className="btn secondary" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn danger"
            disabled={!valido || salvando}
          >
            {salvando ? "Desconvocando…" : "Desconvocar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PassoDeConvocacao({ dados, salvando, aoConvocar, aoDesconvocar }) {
  const grupos = useMemo(() => gruposDeConvocacao(dados), [dados]);
  const [selecao, setSelecao] = useState(() => selecaoSugerida(grupos));
  const [desconvocando, setDesconvocando] = useState(null);
  const configurado = Boolean(dados.configuracao);
  const podeEditar = dados.pode_editar && configurado;

  /* A cada payload novo (convocou, configurou), a sugestão é refeita. */
  useEffect(() => setSelecao(selecaoSugerida(grupos)), [grupos]);

  const alternar = (id) =>
    setSelecao((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });
  const totalConvocados = dados.convocados.length;

  return (
    <section
      className="panel panel-pad entrevistas-passo"
      data-passo="convocacao"
      aria-labelledby="entrevistasPasso2"
    >
      <div className="entrevistas-passo-topo">
        <div>
          <span className="eyebrow">Passo 2</span>
          <h2 className="title" id="entrevistasPasso2">
            Convocação
          </h2>
          <p className="hint">
            Aprovados na análise curricular, na ordem de cada vaga. A regra da
            configuração marca a sugestão; ajuste e convoque.
          </p>
        </div>
        <span className="badge neutro">
          {totalConvocados} {totalConvocados === 1 ? "convocado" : "convocados"}
        </span>
      </div>
      {!configurado ? (
        <Aviso tom="warning">
          Configure a entrevista (passo 1) antes de convocar.
        </Aviso>
      ) : null}
      {grupos.length ? (
        grupos.map((g) => (
          <div className="entrevistas-vaga" key={g.vaga} data-vaga={g.vaga}>
            <div className="entrevistas-vaga-topo">
              <strong>
                Vaga {g.vaga} · {nomeDoCargo(g.cargo) || "—"}
              </strong>
              {configurado ? (
                <small>
                  {textoDaRegra(g.regra, g.vagasImediatas, g.limite)}
                </small>
              ) : null}
            </div>
            {g.candidatos.length || g.fora.length ? (
              <div className="entrevistas-tabela-rolagem">
                <table className="entrevistas-tabela">
                  <thead>
                    <tr>
                      <th scope="col" className="entrevistas-col-marca">
                        <span className="sr-only">Convocar</span>
                      </th>
                      <th scope="col">Posição</th>
                      <th scope="col">Candidato</th>
                      <th scope="col">Modalidade</th>
                      <th scope="col">Nota da análise</th>
                      <th scope="col">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.candidatos.map((c) => {
                      const convocado = c.convocado;
                      const marcado = convocado
                        ? true
                        : selecao.has(c.analise_id);
                      return (
                        <tr
                          key={c.analise_id}
                          className={classes(
                            c.sugerido && "entrevistas-sugerido",
                            convocado && "entrevistas-convocado",
                          )}
                        >
                          <td className="entrevistas-col-marca">
                            <input
                              type="checkbox"
                              checked={marcado}
                              disabled={!podeEditar || Boolean(convocado)}
                              aria-label={`Convocar ${c.candidato}`}
                              onChange={() => alternar(c.analise_id)}
                            />
                          </td>
                          <td>{c.posicao}ª</td>
                          <td>
                            <div className="primary-text">{c.candidato}</div>
                            <span className="secondary-text">
                              {c.codigo ? `Cód. ${c.codigo}` : "Sem código"}
                            </span>
                          </td>
                          <td>
                            {c.modalidade || "—"}
                            {ehPcd(c.pcd) ? (
                              <span className="badge neutro">PcD</span>
                            ) : null}
                          </td>
                          <td>{numeroBR(c.nota_analise)}</td>
                          <td>
                            {convocado ? (
                              <span className="entrevistas-situacao">
                                <span className="badge aprovado">
                                  Convocado
                                </span>
                                {podeEditar && !convocado.avaliacoes?.length ? (
                                  <button
                                    type="button"
                                    className="btn secondary small"
                                    onClick={() => setDesconvocando(convocado)}
                                  >
                                    Desconvocar
                                  </button>
                                ) : null}
                              </span>
                            ) : c.sugerido ? (
                              <span className="badge revisar">Sugerido</span>
                            ) : (
                              <span className="secondary-text">
                                Além da regra
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {g.fora.map((c) => (
                      <tr key={c.id} className="entrevistas-convocado">
                        <td className="entrevistas-col-marca">
                          <input
                            type="checkbox"
                            checked
                            disabled
                            aria-label={`${c.candidato} já convocado`}
                          />
                        </td>
                        <td>—</td>
                        <td>
                          <div className="primary-text">{c.candidato}</div>
                          <span className="secondary-text">
                            Fora dos aprovados atuais
                          </span>
                        </td>
                        <td>{c.modalidade || "—"}</td>
                        <td>{numeroBR(c.nota_analise)}</td>
                        <td>
                          <span className="entrevistas-situacao">
                            <span className="badge aprovado">Convocado</span>
                            {podeEditar && !c.avaliacoes?.length ? (
                              <button
                                type="button"
                                className="btn secondary small"
                                onClick={() => setDesconvocando(c)}
                              >
                                Desconvocar
                              </button>
                            ) : null}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="entrevistas-vazio-linha">
                Nenhum aprovado nesta vaga.
              </p>
            )}
          </div>
        ))
      ) : (
        <p className="entrevistas-vazio-linha">
          Nenhum aprovado na análise curricular deste edital.
        </p>
      )}
      {podeEditar ? (
        <div className="entrevistas-acoes">
          <button
            type="button"
            className="btn secondary"
            onClick={() => setSelecao(selecaoSugerida(grupos))}
          >
            Voltar à sugestão
          </button>
          <button
            type="button"
            className="btn"
            id="entrevistasConvocar"
            disabled={!selecao.size || salvando}
            onClick={() => void aoConvocar([...selecao])}
          >
            <i className="fa-solid fa-bullhorn" aria-hidden="true" />{" "}
            {salvando
              ? "Convocando…"
              : `Convocar selecionados (${selecao.size})`}
          </button>
        </div>
      ) : null}
      {desconvocando ? (
        <ModalDeDesconvocar
          convocado={desconvocando}
          salvando={salvando}
          aoFechar={() => setDesconvocando(null)}
          aoConfirmar={async (motivo) => {
            const resultado = await aoDesconvocar(desconvocando.id, motivo);
            if (resultado?.ok) setDesconvocando(null);
            return resultado;
          }}
        />
      ) : null}
    </section>
  );
}

/* ── Passo 3: ficha de notas ───────────────────────────────────────── */

function PassoDaFicha({ dados, aoAbrir }) {
  const [filtros, setFiltros] = useState(FILTROS_DA_FICHA);
  const roteiro = dados.configuracao?.roteiro || null;
  const visiveis = useMemo(
    () => filtrarConvocados(dados.convocados, filtros),
    [dados.convocados, filtros],
  );
  const vagas = [...new Set(dados.convocados.map((c) => c.vaga))].sort();
  const bancas = bancasDoEdital(dados.avaliadores);
  const mudar = (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor }));
  const maxima = roteiro ? pontuacaoMaxima(roteiro.competencias) : null;

  return (
    <section
      className="panel panel-pad entrevistas-passo"
      data-passo="ficha"
      aria-labelledby="entrevistasPasso3"
    >
      <div className="entrevistas-passo-topo">
        <div>
          <span className="eyebrow">Passo 3</span>
          <h2 className="title" id="entrevistasPasso3">
            Ficha de notas
          </h2>
          <p className="hint">
            Abra um convocado para lançar o comparecimento e as notas. O
            resultado é recalculado pelo banco a cada gravação e aparece em
            “Resultados”.
          </p>
        </div>
      </div>
      {dados.convocados.length ? (
        <>
          <div className="entrevistas-filtros">
            <Campo rotulo="Vaga">
              <select
                value={filtros.vaga}
                onChange={(e) => mudar("vaga", e.target.value)}
              >
                <option value="">Todas as vagas</option>
                {vagas.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Banca">
              <select
                value={filtros.banca}
                onChange={(e) => mudar("banca", e.target.value)}
              >
                <option value="">Todas as bancas</option>
                {bancas.map((b) => (
                  <option key={b} value={String(b)}>
                    Banca {b}
                  </option>
                ))}
                <option value="sem">Sem banca definida</option>
              </select>
            </Campo>
            <Campo rotulo="Buscar candidato">
              <input
                type="search"
                value={filtros.busca}
                placeholder="Nome ou código"
                onChange={(e) => mudar("busca", e.target.value)}
              />
            </Campo>
          </div>
          <div className="entrevistas-tabela-rolagem">
            <table className="entrevistas-tabela" id="entrevistasFicha">
              <thead>
                <tr>
                  <th scope="col">Candidato</th>
                  <th scope="col">Vaga / Cargo</th>
                  <th scope="col">Banca</th>
                  <th scope="col">Compareceu</th>
                  <th scope="col">Notas</th>
                  <th scope="col">Nota</th>
                  <th scope="col">Parecer</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((c) => {
                  const avaliadores = avaliadoresDaFicha(
                    dados.avaliadores,
                    c,
                    c.banca,
                  );
                  const p = progressoDasNotas(
                    c,
                    avaliadores,
                    roteiro?.competencias,
                  );
                  return (
                    <tr
                      key={c.id}
                      className="entrevistas-linha"
                      tabIndex={0}
                      aria-label={`Ficha de ${c.candidato}`}
                      onClick={() => aoAbrir(c.id)}
                      onKeyDown={(e) => {
                        if (
                          e.target === e.currentTarget &&
                          (e.key === "Enter" || e.key === " ")
                        ) {
                          e.preventDefault();
                          aoAbrir(c.id);
                        }
                      }}
                    >
                      <td>
                        <div className="primary-text">{c.candidato}</div>
                        <span className="secondary-text">
                          {c.codigo ? `Cód. ${c.codigo}` : "Sem código"}
                        </span>
                      </td>
                      <td>
                        <div className="primary-text">{c.vaga}</div>
                        <span className="secondary-text">
                          {nomeDoCargo(c.cargo)}
                        </span>
                      </td>
                      <td>{c.banca ?? "—"}</td>
                      <td>{rotuloDoComparecimento(c.compareceu)}</td>
                      <td>
                        {p.esperadas ? `${p.lancadas}/${p.esperadas}` : "—"}
                      </td>
                      <td>
                        {numeroBR(c.nota)}
                        {c.nota !== null && c.nota !== undefined && maxima ? (
                          <span className="secondary-text">
                            {" "}
                            / {numeroBR(maxima)}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <SeloDoParecer parecer={c.parecer} />
                      </td>
                    </tr>
                  );
                })}
                {!visiveis.length ? (
                  <tr>
                    <td colSpan={7} className="empty">
                      Nenhum convocado no filtro.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="entrevistas-vazio-linha">
          Nenhum candidato convocado ainda.
        </p>
      )}
    </section>
  );
}

/* ── Liberação fora da janela (administrador global) ──────────────── */

function LiberacaoDoEdital({ conducao, item, ocupado, doPainel }) {
  const [ate, setAte] = useState("");
  const [motivo, setMotivo] = useState("");
  if (!item || item.naJanela) return null;
  const liberado = item.visivelPor === "liberado" && item.liberadoAte;
  const motivoValido = motivo.trim().length >= 3;
  return (
    <div className="entrevistas-liberacao" id="entrevistasLiberacao">
      <p>
        <strong>Fora da janela</strong> — {textoDaJanela(item)}.{" "}
        {liberado
          ? `Liberado para a equipe até ${item.liberadoAte.split("-").reverse().join("/")} (${item.motivoLiberacao}).`
          : "Só você (administrador global) vê este edital."}
      </p>
      <div className="entrevistas-liberacao-campos">
        {!liberado ? (
          <label>
            Liberar até
            <input
              type="date"
              value={ate}
              onChange={(ev) => setAte(ev.target.value)}
            />
          </label>
        ) : null}
        <label className="entrevistas-liberacao-motivo">
          Motivo
          <input
            type="text"
            maxLength={500}
            placeholder={
              liberado ? "Por que encerrar" : "Por que liberar fora da janela"
            }
            value={motivo}
            onChange={(ev) => setMotivo(ev.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn secondary"
          disabled={ocupado || !motivoValido || (!liberado && !ate)}
          onClick={async () => {
            const r = await conducao.liberarEdital(
              item.id,
              liberado ? null : ate,
              motivo.trim(),
              doPainel,
            );
            if (r?.ok) {
              setAte("");
              setMotivo("");
            }
          }}
        >
          {liberado ? "Encerrar liberação" : "Liberar"}
        </button>
      </div>
    </div>
  );
}

/* ── A visão ───────────────────────────────────────────────────────── */

export function VisaoDeConducao({ conducao, area, entrevistasDoPainel }) {
  const e = useSyncExternalStore(conducao.assinar, conducao.obter);
  const [aberta, setAberta] = useState(null);
  const { editais, edital: dados, roteiros } = e;

  useEffect(() => {
    const atual = conducao.obter();
    if (!atual.editais.carregado && !atual.editais.carregando)
      void conducao.carregarEditais(area, entrevistasDoPainel);
    if (!atual.roteiros.carregado && !atual.roteiros.carregando)
      void conducao.carregarRoteiros(area);
  }, [conducao, area, entrevistasDoPainel]);

  const convocado = aberta
    ? dados?.convocados.find((c) => c.id === aberta)
    : null;
  const acao = e.acao?.tipo || "";

  return (
    <div className="entrevistas-visao entrevistas-conducao">
      <section
        className="panel panel-pad"
        aria-labelledby="entrevistasEditalTitulo"
      >
        <div className="entrevistas-passo-topo">
          <div>
            <span className="eyebrow">Conduzir entrevistas</span>
            <h2 className="title" id="entrevistasEditalTitulo">
              Edital
            </h2>
          </div>
          {dados ? (
            <span
              className={classes(
                "badge",
                dados.pode_editar ? "aprovado" : "neutro",
              )}
            >
              {dados.pode_editar ? "Você edita" : "Somente consulta"}
            </span>
          ) : null}
        </div>
        <div className="entrevistas-filtros">
          <Campo rotulo="Edital da área" largo>
            <select
              id="entrevistasEdital"
              value={e.editalId}
              disabled={editais.carregando}
              onChange={(ev) => {
                setAberta(null);
                void conducao.abrirEdital(ev.target.value);
              }}
            >
              <option value="">
                {editais.carregando
                  ? "Carregando editais…"
                  : "Escolha o edital…"}
              </option>
              {editais.lista.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.edital}
                  {m.unidade ? ` · ${m.unidade}` : ""}
                  {m.comEntrevistas ? " · com entrevistas" : ""}
                  {marcaDoEdital(m) ? ` · ${marcaDoEdital(m)}` : ""}
                </option>
              ))}
            </select>
          </Campo>
          {e.editalId ? (
            <button
              type="button"
              className="btn secondary entrevistas-botao-alinhado"
              disabled={e.carregandoEdital}
              onClick={() => void conducao.recarregarEdital()}
            >
              <i className="fa-solid fa-rotate" aria-hidden="true" /> Recarregar
            </button>
          ) : null}
        </div>
        {editais.admin ? (
          <label className="entrevistas-todos">
            <input
              type="checkbox"
              checked={editais.todos}
              disabled={editais.carregando}
              onChange={(ev) =>
                void conducao.carregarEditais(area, entrevistasDoPainel, {
                  todos: ev.target.checked,
                })
              }
            />{" "}
            Mostrar todos os editais da área (só administrador global)
          </label>
        ) : null}
        {editais.admin ? (
          <LiberacaoDoEdital
            key={e.editalId}
            conducao={conducao}
            item={editais.lista.find((m) => m.id === e.editalId)}
            ocupado={Boolean(e.acao)}
            doPainel={entrevistasDoPainel}
          />
        ) : null}
        {editais.carregado && !editais.lista.length ? (
          <Aviso tom="warning">{editais.erro}</Aviso>
        ) : null}
        {e.erroDoEdital ? (
          <Aviso tom="danger" papel="alert">
            Não foi possível abrir o edital: {e.erroDoEdital}
          </Aviso>
        ) : null}
        {roteiros.erro ? (
          <Aviso tom="warning">Roteiros indisponíveis: {roteiros.erro}</Aviso>
        ) : null}
        {e.carregandoEdital ? (
          <div className="empty">Carregando o edital…</div>
        ) : null}
      </section>

      {dados && !e.carregandoEdital ? (
        <>
          <PassoDeConfiguracao
            key={`cfg-${dados.edital?.id}`}
            dados={dados}
            roteiros={roteiros.lista}
            salvando={acao === "configurar"}
            aoSalvar={conducao.configurar}
          />
          <PassoDeConvocacao
            key={`conv-${dados.edital?.id}`}
            dados={dados}
            salvando={acao === "convocar" || acao === "desconvocar"}
            aoConvocar={conducao.convocar}
            aoDesconvocar={conducao.desconvocar}
          />
          <PassoDaFicha
            key={`ficha-${dados.edital?.id}`}
            dados={dados}
            aoAbrir={setAberta}
          />
        </>
      ) : null}

      {convocado ? (
        <FichaDoCandidato
          key={convocado.id}
          dados={dados}
          convocado={convocado}
          salvando={acao === "notas"}
          aoSalvar={(p) => conducao.lancarNotas(convocado.id, p)}
          aoAbrirProximo={(id) => setAberta(id)}
          aoFechar={() => setAberta(null)}
        />
      ) : null}
    </div>
  );
}
