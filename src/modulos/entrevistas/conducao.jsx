import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  aplicarRoteiroNaConfiguracao,
  bancasDoEdital,
  completarMembrosPelaComposicao,
  dadosDaConfiguracaoParaSalvar,
  errosDaConfiguracao,
  FILTROS_DA_FICHA,
  filtrarConvocados,
  MODOS_DE_LANCAMENTO,
  novoAvaliador,
  progressoDasNotas,
  rascunhoDaConfiguracao,
  rotuloDoLancamento,
  avaliadoresDaFicha,
  nomeDoCargo,
  marcaDoEdital,
  textoDaJanela,
} from "../../lib/conducao-de-entrevista.js";
import {
  aConvocar,
  avisosDaConvocacao,
  fonteDaConvocacao,
  gruposDaConvocacao,
  origemDasVagas,
  resumoDaConvocacao,
  textoDaRegraDaClassificacao,
  textoDasVagas,
  textoDoLimite,
} from "../../lib/convocacao-da-entrevista.js";
import { rotuloDoComparecimento } from "../../lib/entrevistas-do-painel.js";
import {
  pontuacaoMaxima,
  textoDaPontuacao,
} from "../../lib/roteiro-de-entrevista.js";
import {
  Aviso,
  Campo,
  Carregando,
  classes,
  Gaveta,
  Segmentado,
  Selo,
} from "../../ui/index.js";
import { irParaLink } from "../chat/ponte.js";
import { AgendaDoDia } from "./agenda-do-dia.jsx";
import { FichaDoCandidato } from "./ficha.jsx";
import {
  BotaoDeLinha,
  ComposicaoDaBanca,
  numeroBR,
  trocarNaLista,
} from "./partes.jsx";
import { SeloDoParecer } from "./tabela.jsx";

/*
  Visão "Conduzir entrevistas" da tela de Entrevistas: escolhido o edital (da
  área atual do app), três passos em cartões (`.ui-card`) —

  1. Configuração: o roteiro (a versão exata; pré-preenche a banca com o
     padrão dele), a composição da banca, o modo de lançamento e os membros
     da banca. Abaixo, só leitura, a regra de convocação e as vagas da
     Classificação, com o caminho de onde se mudam.
  2. Convocação: a lista de convocação da Classificação (a última gerada; sem
     ela, o cálculo atual, sem convocar), por vaga, na ordem dela;
     "Convocar selecionados" registra os da lista para a ficha e
     "Desconvocar" (com motivo, só sem notas). Uma convocação só — nada de
     ranking, regra ou vagas próprios (src/lib/convocacao-da-entrevista.js).
  3. Ficha de notas: os convocados; cada um abre a ficha (ficha.jsx).

  Entre a convocação e a ficha, a "Agenda do dia" (agenda-do-dia.jsx), quando
  o edital tem agenda salva (Classificação › Agenda): por horário e banca; a
  linha do convocado abre a mesma ficha.

  Quem não edita as entrevistas (`pode_editar` falso) vê tudo sem os botões
  (sem selo "Somente consulta"). O administrador global vê "Mostrar todos os
  editais da área" e libera um edital fora da janela.
*/

/* ── Convocação e vagas da Classificação (só leitura) ─────────────── */

const dataEHora = (iso) => {
  const data = iso ? new Date(iso) : null;
  return data && !Number.isNaN(data.getTime())
    ? data.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
};

/* Vai para outra tela do app; na Classificação, já com o edital aberto. */
function BotaoIrPara({ view, edital, children }) {
  return (
    <button
      type="button"
      className="btn secondary small"
      data-ir-para={view}
      onClick={() =>
        irParaLink({
          view,
          ...(view === "classificacao" && edital?.id
            ? { edital: { id: edital.id, titulo: edital.edital || "" } }
            : {}),
        })
      }
    >
      {children}
    </button>
  );
}

/**
 * A regra de convocação e as vagas são as da Classificação: aqui só se veem,
 * com o caminho de onde se mudam (quadro de vagas no Editais, configuração da
 * convocação na Lista de aprovados, regra na Classificação).
 */
function ConvocacaoDaClassificacao({ dados, grupos }) {
  const regra = dados.regra_classificacao;
  const texto = textoDaRegraDaClassificacao(regra?.convocacao);
  const vagas = grupos.filter((g) => g.candidatos.length || g.total !== null);
  return (
    <div
      className="entrevistas-bloco"
      data-bloco="convocacao-da-classificacao"
      data-tour="entrevistas-conduzir-vagas"
    >
      <h4 className="entrevistas-subtitulo">Regra de convocação e vagas</h4>
      <div className="entrevistas-em-linha">
        <span>
          {regra
            ? `Classificação, regra v${regra.versao}: ${texto}`
            : "O edital ainda não tem regra de classificação."}
        </span>
        <BotaoIrPara view="classificacao" edital={dados.edital}>
          Regra na Classificação
        </BotaoIrPara>
      </div>
      {vagas.length ? (
        <div className="entrevistas-tabela-rolagem">
          <table className="entrevistas-tabela" id="entrevistasVagas">
            <thead>
              <tr>
                <th scope="col">Vaga</th>
                <th scope="col">Cargo</th>
                <th scope="col">Vagas</th>
                <th scope="col">Convocar até</th>
                <th scope="col">De onde vêm as vagas</th>
              </tr>
            </thead>
            <tbody>
              {vagas.map((g) => {
                const origem = origemDasVagas(g);
                return (
                  <tr key={g.vaga} data-vaga={g.vaga}>
                    <td>{g.vaga}</td>
                    <td>
                      {nomeDoCargo(g.cargo) || "—"}
                      {g.lotacao ? (
                        <span className="entrevistas-origem-vaga">
                          {g.lotacao}
                        </span>
                      ) : null}
                    </td>
                    <td>{textoDasVagas(g) || "—"}</td>
                    <td>{textoDoLimite(g) || "—"}</td>
                    <td>
                      <span className="entrevistas-situacao">
                        <span>{origem.rotulo}</span>
                        <BotaoIrPara view={origem.view} edital={dados.edital}>
                          {origem.onde}
                        </BotaoIrPara>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

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
                : undefined
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
                        : undefined
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
              title="Completar banca"
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

function PassoDeConfiguracao({ dados, grupos, roteiros, salvando, aoSalvar }) {
  const configurado = Boolean(dados.configuracao);
  const [editando, setEditando] = useState(!configurado && dados.pode_editar);
  useEffect(() => {
    if (!configurado && dados.pode_editar) setEditando(true);
  }, [configurado, dados.pode_editar]);
  return (
    <section
      className="ui-card entrevistas-passo"
      data-passo="configuracao"
      data-tour="entrevistas-conduzir-configuracao"
      aria-labelledby="entrevistasPasso1"
    >
      <div className="entrevistas-passo-topo">
        <div>
          <span className="entrevistas-sobretitulo">Passo 1</span>
          <h2 className="ui-titulo" id="entrevistasPasso1">
            Configuração
          </h2>
        </div>
        <Selo tom={configurado ? "aprovado" : "pendente"}>
          {configurado ? "Configurada" : "A configurar"}
        </Selo>
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
                data-tour="entrevistas-conduzir-editar-configuracao"
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
      <ConvocacaoDaClassificacao dados={dados} grupos={grupos} />
    </section>
  );
}

/* ── Passo 2: convocação ───────────────────────────────────────────── */

function ModalDeDesconvocar({ convocado, salvando, aoConfirmar, aoFechar }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const valido = motivo.trim().length >= 3 && motivo.trim().length <= 500;
  return (
    <Gaveta
      id="entrevistasDesconvocar"
      tituloId="entrevistasDesconvocarTitulo"
      aoFechar={aoFechar}
      className="entrevistas-gaveta"
      cartaoClassName="entrevistas-gaveta-estreita"
      sobretitulo="Retirar da entrevista"
      titulo={convocado.candidato}
      rotuloDoFechar="Fechar"
    >
      <form
        className="entrevistas-formulario-da-gaveta"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valido) return;
          const resultado = await aoConfirmar(motivo.trim());
          if (resultado?.erro) setErro(resultado.erro);
        }}
      >
        <div className="ui-gaveta-corpo">
          <Campo
            rotulo="Motivo"
            obrigatorio
            dica="3 a 500 caracteres"
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
        </div>
        <div className="ui-gaveta-rodape">
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
    </Gaveta>
  );
}

function PassoDeConvocacao({
  dados,
  fonte,
  grupos,
  calculo,
  salvando,
  ocupado,
  aoConvocar,
  aoDesconvocar,
}) {
  const pendentes = useMemo(() => aConvocar(grupos), [grupos]);
  const [selecao, setSelecao] = useState(() => new Set(pendentes));
  const [desconvocando, setDesconvocando] = useState(null);
  const configurado = Boolean(dados.configuracao);
  const daLista = fonte.tipo === "LISTA";
  const podeEditar = dados.pode_editar && configurado;
  const podeConvocar = podeEditar && daLista;
  const avisos = avisosDaConvocacao(dados, fonte, grupos);
  const resumo = resumoDaConvocacao(grupos);
  const lista = fonte.lista;

  /* A cada payload novo (convocou, outra lista), todos os da lista a convocar ficam marcados. */
  useEffect(() => setSelecao(new Set(pendentes)), [pendentes]);

  const alternar = (id) =>
    setSelecao((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });
  const totalConvocados = dados.convocados.length;
  const desconvocar = (c) =>
    podeEditar && !c.avaliacoes?.length ? (
      <button
        type="button"
        className="btn secondary small"
        onClick={() => setDesconvocando(c)}
      >
        Desconvocar
      </button>
    ) : null;

  return (
    <section
      className="ui-card entrevistas-passo"
      data-passo="convocacao"
      data-tour="entrevistas-conduzir-convocacao"
      data-fonte={fonte.tipo}
      aria-labelledby="entrevistasPasso2"
    >
      <div className="entrevistas-passo-topo">
        <div>
          <span className="entrevistas-sobretitulo">Passo 2</span>
          <h2 className="ui-titulo" id="entrevistasPasso2">
            Convocação
          </h2>
        </div>
        <Selo>
          {totalConvocados} {totalConvocados === 1 ? "convocado" : "convocados"}
        </Selo>
      </div>
      {daLista ? (
        <p className="entrevistas-fonte-da-lista">
          Lista de convocação da Classificação · gerada em{" "}
          {dataEHora(lista.gerada_em)}
          {lista.por ? ` por ${lista.por}` : ""} · regra v{lista.versao_regra}
          {lista.publicada ? " · publicada" : ""} · {resumo.naLista} na lista
        </p>
      ) : null}
      {avisos.map((a) => (
        <Aviso key={a.codigo} tom={a.tom}>
          <span className="entrevistas-em-linha">
            <span>{a.texto}</span>
            {a.codigo === "SEM_LISTA" || a.codigo === "REGRA_MUDOU" ? (
              dados.pode_gerar_lista ? (
                <BotaoIrPara view="classificacao" edital={dados.edital}>
                  Gerar na Classificação
                </BotaoIrPara>
              ) : null
            ) : null}
          </span>
        </Aviso>
      ))}
      {calculo?.erro && fonte.tipo === "NENHUMA" ? (
        <Aviso tom="info">{calculo.erro}</Aviso>
      ) : null}
      {daLista && !configurado ? (
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
              <small>
                {[textoDasVagas(g), textoDoLimite(g)]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
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
                      <th scope="col">Nota</th>
                      <th scope="col">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.candidatos.map((c) => {
                      const convocado = c.convocado;
                      return (
                        <tr
                          key={c.analiseId}
                          className={classes(
                            convocado && "entrevistas-convocado",
                          )}
                        >
                          <td className="entrevistas-col-marca">
                            <input
                              type="checkbox"
                              checked={
                                convocado ? true : selecao.has(c.analiseId)
                              }
                              disabled={!podeConvocar || Boolean(convocado)}
                              aria-label={`Convocar ${c.nome}`}
                              onChange={() => alternar(c.analiseId)}
                            />
                          </td>
                          <td>{c.posicao ? `${c.posicao}ª` : "—"}</td>
                          <td>
                            <div className="ui-texto-principal">{c.nome}</div>
                          </td>
                          <td>
                            {c.modalidades.join(" · ") || "—"}
                            {c.lista ? (
                              <Selo className="entrevistas-selo-lista">
                                Lista {c.lista}
                              </Selo>
                            ) : null}
                          </td>
                          <td>{numeroBR(c.nota)}</td>
                          <td>
                            {convocado ? (
                              <span className="entrevistas-situacao">
                                <Selo tom="aprovado">Convocado</Selo>
                                {desconvocar(convocado)}
                              </span>
                            ) : (
                              <span className="ui-texto-secundario">
                                {daLista ? "A convocar" : "Cálculo atual"}
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
                          <div className="ui-texto-principal">
                            {c.candidato}
                          </div>
                          <span className="ui-texto-secundario">
                            Fora da lista vigente
                          </span>
                        </td>
                        <td>{c.modalidade || "—"}</td>
                        <td>{numeroBR(c.nota_analise)}</td>
                        <td>
                          <span className="entrevistas-situacao">
                            <Selo tom="aprovado">Convocado</Selo>
                            {desconvocar(c)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="entrevistas-vazio-linha">
                Ninguém desta vaga na lista.
              </p>
            )}
          </div>
        ))
      ) : fonte.tipo !== "NENHUMA" ? (
        <p className="entrevistas-vazio-linha">
          A lista de convocação não tem candidatos.
        </p>
      ) : null}
      {podeConvocar ? (
        <div className="entrevistas-acoes">
          <button
            type="button"
            className="btn secondary"
            disabled={!pendentes.length}
            onClick={() => setSelecao(new Set(pendentes))}
          >
            Marcar todos da lista
          </button>
          <button
            type="button"
            className="btn"
            id="entrevistasConvocar"
            data-tour="entrevistas-conduzir-convocar"
            disabled={!selecao.size || ocupado}
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
      className="ui-card entrevistas-passo"
      data-passo="ficha"
      data-tour="entrevistas-conduzir-ficha"
      aria-labelledby="entrevistasPasso3"
    >
      <div className="entrevistas-passo-topo">
        <div>
          <span className="entrevistas-sobretitulo">Passo 3</span>
          <h2 className="ui-titulo" id="entrevistasPasso3">
            Ficha de notas
          </h2>
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
                        <div className="ui-texto-principal">{c.candidato}</div>
                        <span className="ui-texto-secundario">
                          {c.codigo ? `Cód. ${c.codigo}` : "Sem código"}
                        </span>
                      </td>
                      <td>
                        <div className="ui-texto-principal">{c.vaga}</div>
                        <span className="ui-texto-secundario">
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
                          <span className="ui-texto-secundario">
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
                    <td colSpan={7} className="ui-vazio">
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
    <div
      className="entrevistas-liberacao"
      id="entrevistasLiberacao"
      data-tour="entrevistas-conduzir-liberacao"
    >
      <p className="entrevistas-liberacao-texto">
        <strong>Fora da janela</strong> — {textoDaJanela(item)}.{" "}
        {liberado
          ? `Liberado para a equipe até ${item.liberadoAte.split("-").reverse().join("/")} (${item.motivoLiberacao}).`
          : "Só você (administrador global) vê este edital."}
      </p>
      <div className="entrevistas-liberacao-campos">
        {!liberado ? (
          <Campo rotulo="Liberar até">
            <input
              type="date"
              value={ate}
              onChange={(ev) => setAte(ev.target.value)}
            />
          </Campo>
        ) : null}
        <Campo rotulo="Motivo">
          <input
            type="text"
            maxLength={500}
            placeholder={
              liberado ? "Por que encerrar" : "Por que liberar fora da janela"
            }
            value={motivo}
            onChange={(ev) => setMotivo(ev.target.value)}
          />
        </Campo>
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
  /* A convocação é a lista da Classificação (sem ela, o cálculo atual, só para ver). */
  const fonte = useMemo(
    () => (dados ? fonteDaConvocacao(dados, e.calculo?.resultado) : null),
    [dados, e.calculo],
  );
  const grupos = useMemo(
    () => (fonte ? gruposDaConvocacao(fonte.resultado, dados.convocados) : []),
    [fonte, dados],
  );
  const acao = e.acao?.tipo || "";

  return (
    <div className="entrevistas-visao entrevistas-conducao">
      <section
        className="ui-card entrevistas-passo"
        aria-labelledby="entrevistasEditalTitulo"
        data-tour="entrevistas-conduzir-edital"
      >
        <div className="entrevistas-passo-topo">
          <div>
            <h2 className="ui-titulo" id="entrevistasEditalTitulo">
              Edital
            </h2>
          </div>
        </div>
        <div className="entrevistas-filtros">
          <Campo rotulo="Edital da área" largo>
            <select
              id="entrevistasEdital"
              data-tour="entrevistas-conduzir-seletor-edital"
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
              disabled={e.carregandoEdital || Boolean(e.acao)}
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
            Mostrar todos os editais da área
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
          <Carregando>Carregando o edital…</Carregando>
        ) : null}
      </section>

      {dados && !e.carregandoEdital ? (
        <>
          <PassoDeConfiguracao
            key={`cfg-${dados.edital?.id}`}
            dados={dados}
            grupos={grupos}
            roteiros={roteiros.lista}
            salvando={acao === "configurar"}
            aoSalvar={conducao.configurar}
          />
          <PassoDeConvocacao
            key={`conv-${dados.edital?.id}`}
            dados={dados}
            fonte={fonte}
            grupos={grupos}
            calculo={e.calculo}
            salvando={acao === "convocar" || acao === "desconvocar"}
            ocupado={Boolean(e.acao)}
            aoConvocar={conducao.convocar}
            aoDesconvocar={conducao.desconvocar}
          />
          <AgendaDoDia
            key={`agenda-${dados.edital?.id}`}
            dados={dados}
            agenda={e.agenda}
            aoAbrir={setAberta}
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
