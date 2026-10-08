import { useEffect, useMemo, useRef, useState } from "react";
import {
  aplicarRoteiroNaConfiguracao,
  bancasDoEdital,
  completarMembrosPelaComposicao,
  dadosDaConfiguracaoParaSalvar,
  errosDaConfiguracao,
  MODOS_DE_LANCAMENTO,
  novoAvaliador,
  rascunhoDaConfiguracao,
  rotuloDoLancamento,
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
  criteriosDeDesempate,
  textoDoEmpateFinal,
} from "../../lib/convocacao-da-entrevista.js";
import { SeloDeTreinamento } from "../../componentes/selo-de-treinamento.jsx";
import {
  editalEscolhido,
  sufixoDeTreinamento,
} from "../../lib/edital-de-treinamento.js";
import { rotuloDaVersao } from "../../lib/nome-da-versao.ts";
import { textoDaPontuacao } from "../../lib/roteiro-de-entrevista.js";
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
import { CompetenciasDoMembro } from "./competencias-do-membro.tsx";
import {
  BotaoDeLinha,
  ComposicaoDaBanca,
  numeroBR,
  trocarNaLista,
} from "./partes.jsx";
import { ResumoDasRegras } from "./resumo-das-regras.tsx";

/*
  As partes de "Conduzir entrevistas" (conduzir.tsx) que preparam o edital:

  - SeletorDoEdital: o edital da área atual do app (na janela da entrevista,
    liberado ou com convocado sem parecer), com o selo Treinamento, a
    liberação fora da janela e "Mostrar todos os editais da área"
    (administrador global) e os avisos de carga.
  - PrepararEdital ("Preparar"), em cartões (`.ui-card`):
    0. Regras da entrevista (resumo-das-regras.tsx): quem é chamado, como a
       nota é calculada, quem avalia e o desempate em linguagem simples, cada
       bloco com o "Editar" que leva aonde se muda (Classificação, roteiro,
       configuração, convocação). Os detalhes técnicos (a regra de convocação
       em uma linha, de onde vêm as vagas, os critérios de desempate) ficam
       em "Ver detalhes".
    1. Configuração: o roteiro (a versão exata; pré-preenche a banca com o
       padrão dele), a composição da banca, o modo de lançamento e os membros
       da banca, com as competências que cada um avalia (todas, por padrão,
       ou só algumas — avaliador por competência).
    2. Convocação: a lista de convocação da Classificação (a última gerada;
       sem ela, o cálculo atual, sem convocar), por vaga, na ordem dela;
       "Convocar selecionados" registra os da lista para a ficha e
       "Desconvocar" (com motivo, só sem notas). Uma convocação só — nada de
       ranking, regra ou vagas próprios (src/lib/convocacao-da-entrevista.js).
  - DesempateDaClassificacao: os critérios de desempate da regra de
    classificação do edital, só leitura, com "Editar na Classificação" (o
    mesmo bloco aparece no editor do roteiro).

  A ficha de notas abre pela fila (fila-do-dia.tsx). Quem não edita as
  entrevistas (`pode_editar` falso) vê tudo sem os botões (sem selo "Somente
  consulta").
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
      <DesempateDaClassificacao
        regra={regra}
        edital={dados.edital}
        comBotao={false}
      />
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

/**
 * Os critérios de desempate da regra de classificação do edital (catálogo),
 * só leitura: o desempate da entrevista é o da Classificação. Sem a regra
 * (ou sem o edital), diz de onde vem e leva à Classificação.
 */
export function DesempateDaClassificacao({ regra, edital, comBotao = true }) {
  const criterios = criteriosDeDesempate(regra);
  const empateFinal = textoDoEmpateFinal(regra);
  return (
    <div
      className="entrevistas-desempate-da-regra"
      data-bloco="desempate-da-classificacao"
      data-tour="entrevistas-desempate"
    >
      <span className="entrevistas-rotulo">Desempate (Classificação)</span>
      {criterios?.length ? (
        <ol className="entrevistas-criterios-de-desempate">
          {criterios.map((c) => (
            <li key={c.codigo} title={c.direcao}>
              {c.nome}
            </li>
          ))}
          {empateFinal ? (
            <li className="entrevistas-empate-final">{empateFinal}</li>
          ) : null}
        </ol>
      ) : (
        <span className="ui-texto-secundario">
          {regra
            ? "A regra de classificação ainda não tem critérios de desempate."
            : edital?.id
              ? "O edital ainda não tem regra de classificação."
              : "O da regra de classificação de cada edital."}
        </span>
      )}
      {comBotao ? (
        <BotaoIrPara view="classificacao" edital={edital}>
          Editar na Classificação
        </BotaoIrPara>
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
          {cfg.roteiro?.nome}{" "}
          <small>
            {rotuloDaVersao({
              versao: cfg.roteiro?.versao,
              nome: cfg.roteiro?.nome_versao,
            })}
          </small>
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
  const mudar = (mudancas) => setR((atual) => ({ ...atual, ...mudancas }));

  /* O roteiro atual do edital pode ser uma versão que já saiu da lista. */
  const opcoes = useMemo(() => {
    const lista = roteiros.slice();
    const atual = dados.configuracao?.roteiro;
    if (atual && !lista.some((x) => x.id === atual.id)) lista.unshift(atual);
    return lista;
  }, [roteiros, dados.configuracao]);
  const escolhido = opcoes.find((x) => x.id === r.roteiro) || null;
  const competencias = useMemo(
    () =>
      (escolhido?.competencias || [])
        .slice()
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
        .map((c) => ({ id: c.id, nome: c.nome })),
    [escolhido],
  );
  const erros = useMemo(
    () => errosDaConfiguracao(r, escolhido),
    [r, escolhido],
  );
  const visiveis = tentou ? erros : {};
  const quantos = Object.keys(erros).length;
  const temNotas = dados.convocados.some((c) => c.avaliacoes?.length);

  async function salvar(evento) {
    evento.preventDefault();
    setTentou(true);
    if (quantos) return;
    setErroDoBanco("");
    const resultado = await aoSalvar(
      dadosDaConfiguracaoParaSalvar(r, escolhido),
    );
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
                {x.nome} (
                {rotuloDaVersao({ versao: x.versao, nome: x.nome_versao })})
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
                  {competencias.length ? (
                    <CompetenciasDoMembro
                      nome={a.nome}
                      competencias={competencias}
                      valor={a.competencias ?? null}
                      erro={visiveis[`${p}.competencias`]}
                      aoMudar={(valor) => trocar("competencias", valor)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="entrevistas-vazio-linha">Nenhum membro cadastrado.</p>
        )}
        {erros.cobertura ? (
          <Aviso tom="warning" papel="alert">
            {erros.cobertura}
          </Aviso>
        ) : null}
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

function PassoDeConfiguracao({
  dados,
  roteiros,
  salvando,
  aoSalvar,
  editando,
  setEditando,
  refDaSecao,
}) {
  const configurado = Boolean(dados.configuracao);
  useEffect(() => {
    if (!configurado && dados.pode_editar) setEditando(true);
  }, [configurado, dados.pode_editar, setEditando]);
  return (
    <section
      ref={refDaSecao}
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
          aoSalvar={aoSalvar}
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
  refDaSecao,
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
      ref={refDaSecao}
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

/* ── O edital ──────────────────────────────────────────────────────── */

/**
 * O edital da condução: o seletor (com o selo Treinamento), Recarregar, a
 * liberação fora da janela e "Mostrar todos" (administrador global) e os
 * avisos. `e` é o estado da condução (estado-da-conducao.js); `doPainel`, as
 * entrevistas do painel (marcam "com entrevistas"), quando já lidas.
 * @param {{ conducao: object, e: object, area: string, doPainel?: unknown[] }} props
 */
export function SeletorDoEdital({ conducao, e, area, doPainel = [] }) {
  const { editais, roteiros } = e;
  const escolhido = editalEscolhido(editais.lista, e.editalId);
  return (
    <section
      className="ui-card entrevistas-passo entrevistas-seletor-do-edital"
      aria-label="Edital"
      data-tour="entrevistas-conduzir-edital"
    >
      <div className="entrevistas-filtros">
        <Campo rotulo="Edital da área">
          <select
            id="entrevistasEdital"
            data-tour="entrevistas-conduzir-seletor-edital"
            value={e.editalId}
            disabled={editais.carregando}
            onChange={(ev) => {
              conducao.abrirFicha(null);
              void conducao.abrirEdital(ev.target.value);
            }}
          >
            <option value="">
              {editais.carregando ? "Carregando editais…" : "Escolha o edital…"}
            </option>
            {editais.lista.map((m) => (
              <option key={m.id} value={m.id}>
                {m.edital}
                {m.unidade ? ` · ${m.unidade}` : ""}
                {m.comEntrevistas ? " · com entrevistas" : ""}
                {marcaDoEdital(m) ? ` · ${marcaDoEdital(m)}` : ""}
                {sufixoDeTreinamento(m)}
              </option>
            ))}
          </select>
        </Campo>
        <span className="entrevistas-seletor-acoes">
          <SeloDeTreinamento edital={escolhido} />
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
        </span>
      </div>
      {editais.admin ? (
        <label className="entrevistas-todos">
          <input
            type="checkbox"
            checked={editais.todos}
            disabled={editais.carregando}
            onChange={(ev) =>
              void conducao.carregarEditais(area, doPainel, {
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
          doPainel={doPainel}
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
  );
}

/* ── Preparar ──────────────────────────────────────────────────────── */

/* O que o resumo das regras mostra, a partir do payload do edital e da convocação. */
function entradaDoResumo(dados, fonte, grupos) {
  const regra = dados.regra_classificacao || null;
  return {
    temRegra: Boolean(regra),
    convocacao: regra?.convocacao || null,
    vagas: grupos.filter((g) => g.candidatos.length || g.total !== null),
    roteiro: dados.configuracao?.roteiro || null,
    avaliadores: dados.avaliadores || [],
    lancamento: dados.configuracao?.lancamento || null,
    desempate: criteriosDeDesempate(regra),
    empateFinal: textoDoEmpateFinal(regra),
    convocados: fonte?.tipo === "LISTA" ? resumoDaConvocacao(grupos) : null,
  };
}

const rolarAte = (el) =>
  el?.scrollIntoView?.({ behavior: "smooth", block: "start" });

/**
 * "Preparar" o edital aberto: o resumo das regras, a configuração (passo 1) e
 * a convocação (passo 2). `e` é o estado da condução; o edital aberto é
 * `e.edital`. `aoEditarRoteiro(roteiro)`: o "Editar" de "Como a nota é
 * calculada" abre o roteiro do edital no editor (roteiros.jsx).
 * @param {{ conducao: object, e: object, aoEditarRoteiro?: (roteiro: object) => void }} props
 */
export function PrepararEdital({ conducao, e, aoEditarRoteiro }) {
  const dados = e.edital;
  const [editando, setEditando] = useState(() =>
    Boolean(dados && !dados.configuracao && dados.pode_editar),
  );
  const refConfiguracao = useRef(null);
  const refConvocacao = useRef(null);
  /* A convocação é a lista da Classificação (sem ela, o cálculo atual, só para ver). */
  const fonte = useMemo(
    () => (dados ? fonteDaConvocacao(dados, e.calculo?.resultado) : null),
    [dados, e.calculo],
  );
  const grupos = useMemo(
    () => (fonte ? gruposDaConvocacao(fonte.resultado, dados.convocados) : []),
    [fonte, dados],
  );
  const entrada = useMemo(
    () => (dados ? entradaDoResumo(dados, fonte, grupos) : null),
    [dados, fonte, grupos],
  );
  const editalId = dados?.edital?.id;
  /* Outro edital: o formulário fecha (abre sozinho se o edital não está configurado). */
  useEffect(() => setEditando(false), [editalId]);
  const acao = e.acao?.tipo || "";
  if (!dados || e.carregandoEdital) return null;
  const roteiro = dados.configuracao?.roteiro || null;

  function ir(destino) {
    if (destino === "classificacao")
      irParaLink({
        view: "classificacao",
        edital: { id: dados.edital?.id, titulo: dados.edital?.edital || "" },
      });
    else if (destino === "roteiro" && roteiro) aoEditarRoteiro?.(roteiro);
    else if (destino === "convocacao") rolarAte(refConvocacao.current);
    else {
      setEditando(true);
      rolarAte(refConfiguracao.current);
    }
  }
  function podeIr(destino) {
    if (destino === "classificacao") return Boolean(dados.pode_gerar_lista);
    if (destino === "convocacao") return true;
    if (destino === "roteiro") return Boolean(aoEditarRoteiro && roteiro);
    return Boolean(dados.pode_editar);
  }

  return (
    <>
      <ResumoDasRegras
        key={`regras-${dados.edital?.id}`}
        entrada={entrada}
        aoIr={ir}
        podeIr={podeIr}
        detalhes={<ConvocacaoDaClassificacao dados={dados} grupos={grupos} />}
      />
      <PassoDeConfiguracao
        key={`cfg-${dados.edital?.id}`}
        refDaSecao={refConfiguracao}
        dados={dados}
        roteiros={e.roteiros.lista}
        salvando={acao === "configurar"}
        aoSalvar={async (p) => {
          const resultado = await conducao.configurar(p);
          if (resultado?.ok) setEditando(false);
          return resultado;
        }}
        editando={editando}
        setEditando={setEditando}
      />
      <PassoDeConvocacao
        key={`conv-${dados.edital?.id}`}
        refDaSecao={refConvocacao}
        dados={dados}
        fonte={fonte}
        grupos={grupos}
        calculo={e.calculo}
        salvando={acao === "convocar" || acao === "desconvocar"}
        ocupado={Boolean(e.acao)}
        aoConvocar={conducao.convocar}
        aoDesconvocar={conducao.desconvocar}
      />
    </>
  );
}
