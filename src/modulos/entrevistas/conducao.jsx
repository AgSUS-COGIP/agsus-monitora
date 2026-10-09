import { useEffect, useMemo, useState } from "react";
import {
  nomeDoCargo,
  textoDaJanela,
} from "../../lib/conducao-de-entrevista.ts";
import {
  aConvocar,
  avisosDaConvocacao,
  origemDasVagas,
  resumoDaConvocacao,
  textoDaRegraDaClassificacao,
  textoDasVagas,
  textoDoLimite,
  criteriosDeDesempate,
  textoDoEmpateFinal,
} from "../../lib/convocacao-da-entrevista.js";
import { Aviso, Campo, classes, Gaveta, Selo } from "../../ui/index.js";
import { irParaLink } from "../chat/ponte.js";
import { numeroBR } from "./partes.tsx";

/*
  Peças de "Conduzir entrevistas" que Preparar (preparar.tsx) e o seletor do
  edital (seletor-do-edital.tsx) usam:

  - BotaoIrPara: vai a outra tela do app (na Classificação, com o edital).
  - ConvocacaoDaClassificacao: a regra de convocação e as vagas da
    Classificação, só leitura, com de onde vêm as vagas ("Ver detalhes" do
    resumo das regras).
  - DesempateDaClassificacao: os critérios de desempate da regra de
    classificação do edital, só leitura, com "Editar na Classificação" (o
    mesmo bloco aparece no editor do roteiro).
  - ListaDeConvocacao (passo 3 de Preparar): a lista de convocação da
    Classificação (a última gerada; sem ela, o cálculo atual, sem convocar),
    por vaga, na ordem dela; "Convocar selecionados" registra os da lista
    para a ficha e "Desconvocar" (com motivo, só sem notas). Uma convocação
    só — nada de ranking, regra ou vagas próprios
    (src/lib/convocacao-da-entrevista.js).
  - LiberacaoDoEdital: liberar fora da janela (administrador global).

  Quem não edita as entrevistas (`pode_editar` falso) vê tudo sem os botões
  (sem selo "Somente consulta").
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
export function BotaoIrPara({ view, edital, children }) {
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
export function ConvocacaoDaClassificacao({ dados, grupos }) {
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

/* ── Convocação (passo 3 de Preparar) ───────────────────────────────────────────── */

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

export function ListaDeConvocacao({
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
    <div
      className="entrevistas-convocacao"
      data-bloco="convocacao"
      data-tour="entrevistas-conduzir-convocacao"
      data-fonte={fonte.tipo}
    >
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
          Escolha o roteiro e a banca (passos 1 e 2) antes de convocar.
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
    </div>
  );
}

/* ── Liberação fora da janela (administrador global) ──────────────── */

export function LiberacaoDoEdital({ conducao, item, ocupado, doPainel }) {
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
