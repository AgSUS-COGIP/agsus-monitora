import type { FormEvent } from "react";
import type {
  ExplicacaoDoCandidato,
  PendenciaDeEmpate,
  RecorteDasListas,
  ResultadoDoMotor,
  TipoDeLista,
  VagaDoResultado,
  VagaRecortada,
} from "../../lib/classificacao/tipos-do-resultado.ts";
import type {
  DadosDaClassificacao,
  DesempateRegistrado,
  EstadoDaClassificacao,
  ListaRegistrada,
  SnapshotDaClassificacao,
} from "./tipos-do-estado.ts";

import type { RespostaDoDesempate } from "../../lib/classificacao/relatorio-de-desempate.ts";
import {
  estadoDoRelatorio,
  RELEITURA_DO_PREPARO_MS,
} from "../../lib/classificacao/relatorio-de-desempate.ts";
import { useEffect, useId, useMemo, useState } from "react";
import {
  MOTIVOS_DE_ELIMINACAO,
  TIPOS_DE_LISTA,
} from "../../lib/classificacao/catalogo.ts";
import {
  avisosAgrupados,
  filtrosAtivosDoRecorte,
  geracaoDesatualizada,
  listaDaFase,
  listaDesatualizada,
  recortarResultado,
  RECORTE_VAZIO,
} from "../../lib/classificacao/dados.ts";
import {
  dataBR,
  formatarNota,
  ordinal,
} from "../../lib/classificacao/numeros.ts";
import { normalizarRegra } from "../../lib/classificacao/regra.ts";
import { rotuloDaVersaoNaLista } from "../../lib/nome-da-versao.ts";
import { conferirSorteio } from "../../lib/classificacao/sorteio.ts";
import { DocumentoDoSei } from "./documento.tsx";
import { HoraDeNascimento } from "./hora-de-nascimento.tsx";
import { ModalDePublicacaoDeAprovados } from "./publicar-aprovados.tsx";
import {
  Aviso,
  Campo,
  ErroAoCarregar,
  EstadoVazio,
  Gaveta,
  GradeDeKpis,
  Kpi,
  Modal,
  PainelDeFiltros,
  Secao,
  Segmentado,
  Selo,
} from "../../ui/index.js";

/*
  A aba "Listas" da Classificação: preliminar (documental), convocação para
  entrevista e resultado final, cada uma com a geral e as de cada modalidade,
  os eliminados com motivo, a explicação da posição (gaveta do candidato) e os
  avisos no topo. "Gerar" registra a lista (versão da regra, quem, quando,
  hash); "Exportar" sai de uma lista registrada (PDF pela impressão, DOCX,
  XLSX). O empate que espera sorteio ou decisão abre o registro aqui.
  No resultado final, "Publicar como lista de aprovados" faz dele a lista de
  aprovados vigente do edital (publicar-aprovados.tsx).
  Nota alterada por ajuste aprovado em recurso: selo "Recurso nº X" na linha
  e a frase na explicação; lista gerada antes de um ajuste aprovado (ou do
  cancelamento de um aprovado): aviso para gerar de novo.
*/

/* "Recurso nº 12" ao lado do nome: a nota veio de um ajuste aprovado em recurso. */
export function MarcaDoRecurso({ recursos }: { recursos?: number[] }) {
  if (!recursos?.length) return null;
  const numeros = recursos.map((n) => `nº ${n}`).join(", ");
  return (
    <Selo
      tom="revisar"
      className="classificacao-marca-recurso"
      titulo={`Nota alterada pelo recurso ${numeros}`}
    >
      Recurso {numeros}
    </Selo>
  );
}

const SITUACOES: Record<string, [string, string]> = {
  VAGA: ["aprovado", "Vaga"],
  CR: ["neutro", "CR"],
  CONVOCADO: ["revisar", "Convocado"],
  APTO: ["aprovado", "Apto"],
};
const VAGAS_POR_VEZ = 30;
const motivosDaEliminacao: Readonly<Record<string, string>> =
  MOTIVOS_DE_ELIMINACAO;

function dataHora(valor: unknown) {
  if (typeof valor !== "string" && typeof valor !== "number") return "";
  const d = new Date(valor);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      });
}

export function Indicadores({
  resultado,
  carregando,
}: {
  resultado: ResultadoDoMotor | null;
  carregando: boolean;
}) {
  const t: Partial<ResultadoDoMotor["totais"]> = resultado?.totais || {};
  const n = (v: number | undefined) =>
    v !== undefined && Number.isFinite(v) ? v.toLocaleString("pt-BR") : "0";
  return (
    <GradeDeKpis
      tour="classificacao-kpis"
      rotulo="Indicadores da lista"
      className="classificacao-kpis"
    >
      <Kpi
        chave="candidatos"
        icone="fa-users"
        rotulo="Candidatos"
        valor={n(t.candidatos)}
        carregando={carregando}
      />
      <Kpi
        chave="elegiveis"
        tom="sucesso"
        icone="fa-list-ol"
        rotulo="Nas listas"
        valor={n(t.elegiveis)}
        carregando={carregando}
      />
      <Kpi
        chave="eliminados"
        tom="perigo"
        icone="fa-user-xmark"
        rotulo="Eliminados"
        valor={n(t.eliminados)}
        carregando={carregando}
      />
      {t.aguardando ? (
        <Kpi
          chave="aguardando"
          tom="alerta"
          icone="fa-hourglass-half"
          rotulo="Aguardando análise"
          valor={n(t.aguardando)}
          carregando={carregando}
        />
      ) : null}
      <Kpi
        chave="vagas"
        tom="neutro"
        icone="fa-briefcase"
        rotulo="Vagas"
        valor={n(t.vagas)}
        carregando={carregando}
      />
      <Kpi
        chave="avisos"
        tom={t.pendencias ? "perigo" : "alerta"}
        icone="fa-triangle-exclamation"
        rotulo="Avisos"
        valor={n(t.avisos)}
        carregando={carregando}
      />
    </GradeDeKpis>
  );
}

function Avisos({
  resultado,
  podeEditar,
  aoResolver,
}: {
  resultado: ResultadoDoMotor;
  podeEditar: boolean;
  aoResolver: (p: PendenciaDeEmpate) => void;
}) {
  const grupos = avisosAgrupados(resultado.avisos);
  if (!grupos.length && !resultado.pendencias.length) return null;
  const tom = grupos.some((g) => g.tom === "danger") ? "danger" : "warning";
  return (
    <Aviso tom={tom} papel="status" className="classificacao-avisos">
      {resultado.pendencias.length ? (
        <ul
          className="classificacao-pendencias"
          data-tour="classificacao-empates"
        >
          {resultado.pendencias.map((p) => (
            <li key={p.chave}>
              <span>
                Vaga {p.vagaTexto}: {p.candidatos.map((c) => c.nome).join(", ")}{" "}
                — {formatarNota(p.nota, resultado.casas)}
              </span>
              {podeEditar ? (
                <button
                  type="button"
                  className="btn small"
                  data-acao="resolver-empate"
                  onClick={() => aoResolver(p)}
                >
                  {p.metodo === "SORTEIO"
                    ? "Registrar sorteio"
                    : "Registrar decisão"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {grupos.map((g) => (
        <details key={g.codigo} data-aviso={g.codigo}>
          <summary>
            {g.rotulo} ({g.itens.length})
          </summary>
          <ul>
            {g.itens.slice(0, 50).map((a, i) => (
              <li key={`${a.analiseId || ""}-${i}`}>{a.texto}</li>
            ))}
            {g.itens.length > 50 ? (
              <li>… e mais {g.itens.length - 50}.</li>
            ) : null}
          </ul>
        </details>
      ))}
    </Aviso>
  );
}

function Filtros({
  resultado,
  regra,
  recorte,
  aoMudar,
}: {
  resultado: ResultadoDoMotor;
  regra: Record<string, unknown> | null;
  recorte: RecorteDasListas;
  aoMudar: (r: RecorteDasListas) => void;
}) {
  const ids = { vaga: useId(), lista: useId(), busca: useId() };
  const modalidades = normalizarRegra(regra).modalidades.filter(
    (m) => m.lista_propria,
  );
  return (
    <PainelDeFiltros
      tour="classificacao-filtros-painel"
      idDoTitulo="classificacaoFiltrosTitulo"
      className="classificacao-filtros"
      quantos={filtrosAtivosDoRecorte(recorte)}
      aoLimpar={() => aoMudar(RECORTE_VAZIO)}
    >
      <div className="ui-grade-de-campos" data-tour="classificacao-filtros">
        <Campo rotulo="Vaga">
          <select
            id={ids.vaga}
            value={recorte.vaga}
            onChange={(e) => aoMudar({ ...recorte, vaga: e.target.value })}
          >
            <option value="">Todas as vagas</option>
            {resultado.vagas.map((v) => (
              <option key={v.chave} value={v.chave}>
                {[v.codigo, v.cargo, v.lotacao].filter(Boolean).join(" - ")}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Lista">
          <select
            id={ids.lista}
            value={recorte.lista}
            onChange={(e) => aoMudar({ ...recorte, lista: e.target.value })}
          >
            <option value="geral">Classificação geral</option>
            {modalidades.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Candidato">
          <input
            id={ids.busca}
            type="search"
            value={recorte.busca}
            placeholder="Nome"
            onChange={(e) => aoMudar({ ...recorte, busca: e.target.value })}
          />
        </Campo>
      </div>
    </PainelDeFiltros>
  );
}

const ORIGEM_DAS_VAGAS: Readonly<Record<string, string>> = Object.freeze({
  CONVOCACAO:
    "Vagas por modalidade: configuração de convocação do edital (Lista de aprovados).",
  REGRA: "Vagas por modalidade: percentuais da regra de classificação.",
});

function TabelaDaVaga({
  vaga,
  casas,
  rotulosDasModalidades,
  aoAbrir,
}: {
  vaga: VagaRecortada;
  casas: number;
  rotulosDasModalidades: Record<string, string>;
  aoAbrir: (id: string) => void;
}) {
  return (
    <article className="ui-card classificacao-vaga" data-vaga={vaga.chave}>
      <h3 className="ui-titulo">{vaga.cabecalho}</h3>
      {vaga.limiteConvocacao ? (
        <p className="ui-texto-secundario">
          Limite da convocação: {vaga.limiteConvocacao.origem}
        </p>
      ) : null}
      {vaga.origemDasVagas && vaga.origemDasVagas !== "QUADRO" ? (
        <p
          className="ui-texto-secundario"
          data-origem-vagas={vaga.origemDasVagas}
        >
          {ORIGEM_DAS_VAGAS[vaga.origemDasVagas]}
        </p>
      ) : null}
      {vaga.linhas.length ? (
        <div className="ui-tabela-rolagem">
          <table>
            <thead>
              <tr>
                <th scope="col">Classificação</th>
                <th scope="col">Nome</th>
                <th scope="col">Nota</th>
                <th scope="col">Modalidade</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {vaga.linhas.map((l) => (
                <tr key={l.analiseId} data-candidato={l.analiseId}>
                  <td>
                    {ordinal(l.posicao)}
                    {l.empatados > 1 ? (
                      <span
                        className="classificacao-empate"
                        title="Empatados na mesma posição"
                      >
                        {" "}
                        =
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="classificacao-nome"
                      onClick={() => aoAbrir(l.analiseId)}
                    >
                      {l.nome}
                    </button>{" "}
                    <MarcaDoRecurso recursos={l.recursos} />
                  </td>
                  <td>{formatarNota(l.nota, casas)}</td>
                  <td>
                    {l.modalidades
                      .map((m) => rotulosDasModalidades[m] || m)
                      .join(" / ")}
                  </td>
                  <td>
                    {l.situacao && SITUACOES[l.situacao] ? (
                      <Selo tom={SITUACOES[l.situacao]?.[0]}>
                        {SITUACOES[l.situacao]?.[1]}
                        {l.situacao === "VAGA" &&
                        l.vagaPor &&
                        l.vagaPor !== "AC"
                          ? ` (${rotulosDasModalidades[l.vagaPor] || l.vagaPor})`
                          : ""}
                      </Selo>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EstadoVazio>Não houve candidatos aptos.</EstadoVazio>
      )}
      {vaga.eliminadosFiltrados.length ? (
        <details className="classificacao-eliminados">
          <summary>Eliminados ({vaga.eliminadosFiltrados.length})</summary>
          <div className="ui-tabela-rolagem">
            <table>
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Motivo</th>
                  <th scope="col">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {vaga.eliminadosFiltrados.map((e) => (
                  <tr key={e.analiseId} data-eliminado={e.analiseId}>
                    <td>
                      <button
                        type="button"
                        className="classificacao-nome"
                        onClick={() => aoAbrir(e.analiseId)}
                      >
                        {e.nome}
                      </button>{" "}
                      <MarcaDoRecurso recursos={e.recursos} />
                    </td>
                    <td>{motivosDaEliminacao[e.motivo] || e.motivo}</td>
                    <td>{e.detalhe || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
      {vaga.aguardandoFiltrados.length ? (
        <details className="classificacao-eliminados classificacao-aguardando">
          <summary>
            Aguardando análise ({vaga.aguardandoFiltrados.length})
          </summary>
          <div className="ui-tabela-rolagem">
            <table>
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Situação na análise</th>
                </tr>
              </thead>
              <tbody>
                {vaga.aguardandoFiltrados.map((a) => (
                  <tr key={a.analiseId} data-aguardando={a.analiseId}>
                    <td>
                      <button
                        type="button"
                        className="classificacao-nome"
                        onClick={() => aoAbrir(a.analiseId)}
                      >
                        {a.nome}
                      </button>
                    </td>
                    <td>{a.situacao || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </article>
  );
}

function GavetaDoCandidato({
  explicacao,
  vaga,
  rotulosDasModalidades,
  casas,
  podeEditar,
  aoSalvarHora,
  aoFechar,
}: {
  explicacao: ExplicacaoDoCandidato;
  vaga?: VagaDoResultado;
  rotulosDasModalidades: Record<string, string>;
  casas: number;
  podeEditar: boolean;
  aoSalvarHora: EstadoDaClassificacao["salvarHoraDeNascimento"];
  aoFechar: () => void;
}) {
  const posicoes = Object.entries(explicacao.posicoes || {});
  return (
    <Gaveta
      id="classificacaoCandidato"
      tituloId="classificacaoCandidatoTitulo"
      sobretitulo={vaga?.cabecalho || ""}
      titulo={explicacao.nome}
      resumo={
        explicacao.recursos?.length ? (
          <MarcaDoRecurso recursos={explicacao.recursos} />
        ) : undefined
      }
      rotuloDoFechar="Fechar a explicação"
      aoFechar={aoFechar}
    >
      <div className="ui-gaveta-corpo">
        {explicacao.elegivel ? (
          <Secao icone="fa-list-ol" titulo="Posição" secao="posicao">
            <ul className="classificacao-posicoes">
              <li>
                Geral:{" "}
                <b>
                  {explicacao.posicaoGeral
                    ? ordinal(explicacao.posicaoGeral)
                    : "fora da geral"}
                </b>{" "}
                · nota {formatarNota(explicacao.nota, casas)}
              </li>
              {posicoes.map(([codigo, posicao]) => (
                <li key={codigo}>
                  {rotulosDasModalidades[codigo] || codigo}:{" "}
                  <b>{ordinal(posicao)}</b>
                </li>
              ))}
              {explicacao.situacao ? (
                <li>
                  Situação:{" "}
                  {SITUACOES[explicacao.situacao]?.[1] || explicacao.situacao}
                </li>
              ) : null}
            </ul>
          </Secao>
        ) : null}
        <Secao
          icone="fa-circle-info"
          titulo={
            explicacao.elegivel
              ? "Por que nesta posição"
              : explicacao.aguardando
                ? "Aguardando análise"
                : "Por que fora da lista"
          }
          secao="explicacao"
        >
          <div className="ui-secao-texto classificacao-explicacao">
            {explicacao.explicacao.map((frase, i) => (
              <p key={i}>{frase}</p>
            ))}
          </div>
        </Secao>
        {explicacao.elegivel ? (
          <HoraDeNascimento
            key={explicacao.analiseId}
            horaNascimento={explicacao.horaNascimento ?? null}
            horaDecide={Boolean(explicacao.horaDecide)}
            podeEditar={podeEditar}
            aoSalvar={(hora) => aoSalvarHora(explicacao.analiseId, hora)}
          />
        ) : null}
      </div>
    </Gaveta>
  );
}

/* Registro do empate final: sorteio (semente do servidor ou informada) ou decisão manual. */
function ModalDeDesempate({
  pendencia,
  estado,
  aoFechar,
}: {
  pendencia: PendenciaDeEmpate;
  estado: EstadoDaClassificacao;
  aoFechar: () => void;
}) {
  const sorteio = pendencia.metodo === "SORTEIO";
  const [origem, setOrigem] = useState("SERVIDOR");
  const [semente, setSemente] = useState("");
  const [ordem, setOrdem] = useState(pendencia.candidatos);
  const [justificativa, setJustificativa] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [registro, setRegistro] = useState<DesempateRegistrado | null>(null);
  const ids = { semente: useId(), justificativa: useId() };
  const nomes = Object.fromEntries(
    pendencia.candidatos.map((c) => [c.analiseId, c.nome]),
  );

  const mover = (i: number, passo: number) =>
    setOrdem((atual) => {
      const nova = [...atual];
      const j = i + passo;
      if (j < 0 || j >= nova.length) return atual;
      const atualNaPosicao = nova[i],
        destino = nova[j];
      if (!atualNaPosicao || !destino) return atual;
      nova[i] = destino;
      nova[j] = atualNaPosicao;
      return nova;
    });

  const podeEnviar = sorteio
    ? origem === "SERVIDOR" || semente.trim().length >= 4
    : justificativa.trim().length >= 10;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!podeEnviar || enviando) return;
    setEnviando(true);
    const dados = {
      tipo_lista: pendencia.tipoLista,
      vaga: pendencia.vaga,
      chave: pendencia.chave,
      metodo: sorteio ? "SORTEIO" : "MANUAL",
      candidatos: pendencia.candidatos.map((c) => c.analiseId),
      ...(sorteio
        ? origem === "INFORMADA"
          ? { semente: semente.trim() }
          : {}
        : {
            ordem: ordem.map((c) => c.analiseId),
            justificativa: justificativa.trim(),
          }),
    };
    const novo = await estado.registrarDesempate(dados);
    setEnviando(false);
    if (novo && sorteio) setRegistro(novo);
    else if (novo) aoFechar();
  }

  return (
    <Modal
      id="classificacaoDesempate"
      rotuloId="classificacaoDesempateTitulo"
      aoFechar={aoFechar}
      cartaoClassName="classificacao-desempate"
    >
      <form onSubmit={enviar}>
        <h2 id="classificacaoDesempateTitulo">
          {sorteio ? "Sorteio do empate" : "Decisão do empate"}
        </h2>
        <p className="ui-texto-secundario">
          Vaga {pendencia.vagaTexto} · nota {formatarNota(pendencia.nota, 2)}
        </p>
        {registro ? (
          <>
            <ol className="classificacao-ordem">
              {(registro.ordem || []).map((id) => (
                <li key={id}>{nomes[id] || id}</li>
              ))}
            </ol>
            <p className="classificacao-semente">
              Semente: <code>{registro.semente}</code> (
              {registro.origem_semente === "SERVIDOR"
                ? "gerada no servidor"
                : "informada"}
              )
            </p>
            <Aviso
              tom={
                conferirSorteio(registro.semente, registro.ordem)
                  ? "info"
                  : "danger"
              }
              papel="status"
            >
              {conferirSorteio(registro.semente, registro.ordem)
                ? "Conferido: a ordem é a que a semente produz."
                : "A ordem gravada não confere com a semente."}
            </Aviso>
            <div className="ui-acoes">
              <button type="button" className="btn" onClick={aoFechar}>
                Fechar
              </button>
            </div>
          </>
        ) : (
          <>
            {sorteio ? (
              <>
                <Segmentado
                  rotulo="Semente"
                  opcoes={[
                    { valor: "SERVIDOR", rotulo: "Gerar no servidor" },
                    { valor: "INFORMADA", rotulo: "Informar" },
                  ]}
                  valor={origem}
                  aoMudar={setOrigem}
                />
                {origem === "INFORMADA" ? (
                  <Campo rotulo="Semente" obrigatorio>
                    <input
                      id={ids.semente}
                      value={semente}
                      maxLength={200}
                      onChange={(e) => setSemente(e.target.value)}
                    />
                  </Campo>
                ) : null}
                <ul className="classificacao-ordem">
                  {pendencia.candidatos.map((c) => (
                    <li key={c.analiseId}>{c.nome}</li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <ol className="classificacao-ordem">
                  {ordem.map((c, i) => (
                    <li key={c.analiseId}>
                      <span>{c.nome}</span>
                      <button
                        type="button"
                        className="btn secondary small"
                        aria-label={`Subir ${c.nome}`}
                        disabled={i === 0}
                        onClick={() => mover(i, -1)}
                      >
                        <i
                          className="fa-solid fa-arrow-up"
                          aria-hidden="true"
                        />
                      </button>
                      <button
                        type="button"
                        className="btn secondary small"
                        aria-label={`Descer ${c.nome}`}
                        disabled={i === ordem.length - 1}
                        onClick={() => mover(i, 1)}
                      >
                        <i
                          className="fa-solid fa-arrow-down"
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  ))}
                </ol>
                <Campo rotulo="Justificativa" obrigatorio>
                  <textarea
                    id={ids.justificativa}
                    rows={3}
                    maxLength={2000}
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                  />
                </Campo>
              </>
            )}
            <div className="ui-acoes">
              <button
                type="button"
                className="btn secondary"
                onClick={aoFechar}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn"
                data-acao="registrar-desempate"
                disabled={!podeEnviar || enviando}
              >
                {sorteio ? "Sortear e registrar" : "Registrar decisão"}
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}

function Acoes({
  tipo,
  e,
  resultado,
  registro,
  estado,
  aoGerado,
  aoCarregarRegistro,
  aoAbrirAgenda,
  confirmar,
}: {
  tipo: TipoDeLista;
  e: SnapshotDaClassificacao;
  resultado: ResultadoDoMotor;
  registro: ListaRegistrada | null;
  estado: EstadoDaClassificacao;
  aoGerado: (l: ListaRegistrada) => void;
  aoCarregarRegistro: (l: ListaRegistrada) => void;
  aoAbrirAgenda?: () => void;
  confirmar: (mensagem: string) => boolean;
}) {
  const [lista, setLista] = useState("todas");
  const [fase, setFase] = useState<"" | "PRELIMINAR" | "FINAL">("");
  const idLista = useId();
  const idFase = useId();
  const dados = e.dados;
  const geracoes = (dados?.listas || []).filter((l) => l.tipo === tipo);
  const ultima = registro || geracoes[0] || null;
  const desatualizada = listaDesatualizada(ultima, dados?.ajustes_mudaram_em);
  /*
    O relatório de desempate da lista gerada (do Python): gerar pede o
    relatório; enquanto ele é preparado, relê a cada RELEITURA_DO_PREPARO_MS.
  */
  const [respostaDoDesempate, setRespostaDoDesempate] =
    useState<RespostaDoDesempate | null>(null);
  const idDaUltima = ultima?.id || "";
  useEffect(() => {
    let vigente = true;
    let espera: ReturnType<typeof setTimeout> | undefined;
    setRespostaDoDesempate(null);
    const ler = () => {
      if (!idDaUltima) return;
      void estado.obterDesempate(idDaUltima).then((resposta) => {
        if (!vigente) return;
        setRespostaDoDesempate(resposta);
        if (estadoDoRelatorio(resposta) === "preparando")
          espera = setTimeout(ler, RELEITURA_DO_PREPARO_MS);
      });
    };
    ler();
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [estado, idDaUltima]);
  const desempate = respostaDoDesempate?.desempate ?? null;
  const relatorio = estadoDoRelatorio(respostaDoDesempate);
  // A geração guardada não bate com os dados de agora (fichas, notas, regra…).
  const defasada = geracaoDesatualizada(
    ultima,
    resultado,
    dados?.regra?.versao ?? null,
  );
  const textoDaDefasagem = (motivo: string, l: ListaRegistrada | null) =>
    `Esta geração é de ${dataHora(l?.gerada_em) || "antes"}; ${motivo} desde então — gere de novo.`;
  const modalidades = normalizarRegra(
    dados?.regra?.configuracao,
  ).modalidades.filter((m) => m.lista_propria);

  const [documento, setDocumento] = useState<ListaRegistrada | null>(null);
  const [publicando, setPublicando] = useState<ListaRegistrada | null>(null);
  const [marcando, setMarcando] = useState(false);
  const analises = useMemo(
    () =>
      new Map(
        (dados?.candidatos || []).map((c) => [
          String(c.analise_id),
          { vaga: c.vaga, cargo: c.cargo },
        ]),
      ),
    [dados?.candidatos],
  );

  /* A lista registrada (a desta sessão ou a última gerada, lida do banco). */
  async function alvoRegistrado() {
    let alvo = registro;
    if (!alvo?.retrato && geracoes[0])
      alvo = await estado.obterLista(geracoes[0].id);
    if (alvo) aoCarregarRegistro(alvo);
    if (!alvo?.retrato) return null;
    // Com o retrato em mãos, confere o conteúdo inteiro antes de exportar.
    const motivo = geracaoDesatualizada(
      alvo,
      resultado,
      dados?.regra?.versao ?? null,
    );
    if (
      motivo &&
      !confirmar(
        `${textoDaDefasagem(motivo, alvo)}

Usar esta geração assim mesmo?`,
      )
    )
      return null;
    return alvo;
  }
  async function exportar(formato: string) {
    const alvo = await alvoRegistrado();
    if (alvo) await estado.exportar(alvo, formato, lista, fase || null);
  }
  async function exportarDesempate(formato: string) {
    const alvo = await alvoRegistrado();
    if (alvo) estado.exportarDesempate(desempate, alvo, formato);
  }
  async function copiarParaSei() {
    const alvo = await alvoRegistrado();
    if (alvo) await estado.copiarParaSei(alvo, { lista, fase: fase || null });
  }
  async function abrirDocumento() {
    const alvo = await alvoRegistrado();
    if (alvo) setDocumento(alvo);
  }
  async function marcarComoPublicada() {
    if (!ultima || marcando) return;
    setMarcando(true);
    const publicado = await estado.publicarLista(ultima, resultado);
    setMarcando(false);
    if (publicado) aoCarregarRegistro({ ...ultima, ...publicado });
  }
  function abrirPublicacaoDeAprovados() {
    const alvo = registro?.id ? registro : geracoes[0];
    if (alvo) setPublicando(alvo);
  }
  async function gerar() {
    const novo = await estado.gerarLista(resultado);
    if (novo) aoGerado(novo);
  }

  return (
    <section
      className="ui-card classificacao-acoes"
      aria-label="Geração e exportação"
      data-tour="classificacao-acoes"
    >
      <div className="classificacao-acoes-linha">
        {e.podeEditar ? (
          <button
            type="button"
            className="btn"
            data-acao="gerar"
            data-tour="classificacao-gerar"
            disabled={
              !resultado ||
              e.gerando ||
              !dados?.regra ||
              Boolean(e.erroDaConvocacao)
            }
            title={
              e.erroDaConvocacao
                ? "Leia a convocação do edital de novo antes de gerar."
                : undefined
            }
            onClick={gerar}
          >
            <i className="fa-solid fa-file-circle-check" aria-hidden="true" />{" "}
            Gerar
          </button>
        ) : null}
        <Campo rotulo="Exportar">
          <select
            id={idLista}
            data-tour="classificacao-exportar-lista"
            value={lista}
            onChange={(ev) => setLista(ev.target.value)}
          >
            <option value="todas">Geral e modalidades</option>
            <option value="geral">Só a geral</option>
            {modalidades.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                Só {m.nome}
              </option>
            ))}
            {tipo !== "CONVOCACAO" ? (
              <option value="eliminados">Só os eliminados</option>
            ) : null}
          </select>
        </Campo>
        {tipo !== "CONVOCACAO" ? (
          <Campo rotulo="Publicação">
            <select
              id={idFase}
              value={fase}
              data-campo="fase"
              onChange={(ev) => {
                const valor = ev.target.value;
                if (valor === "" || valor === "PRELIMINAR" || valor === "FINAL")
                  setFase(valor);
              }}
            >
              <option value="">
                {tipo === "FINAL" ? "Resultado final" : "Preliminar"}
              </option>
              {tipo === "FINAL" ? (
                <option value="PRELIMINAR">Resultado preliminar</option>
              ) : (
                <option value="FINAL">Final (após recursos)</option>
              )}
            </select>
          </Campo>
        ) : null}
        <button
          type="button"
          className="btn"
          data-acao="copiar-sei"
          data-tour="classificacao-copiar-sei"
          disabled={!ultima}
          onClick={copiarParaSei}
        >
          <i className="fa-solid fa-copy" aria-hidden="true" /> Copiar para o
          SEI
        </button>
        <button
          type="button"
          className="btn secondary"
          data-acao="ver-documento"
          data-tour="classificacao-ver-documento"
          disabled={!ultima}
          onClick={abrirDocumento}
        >
          <i className="fa-solid fa-eye" aria-hidden="true" /> Como fica no SEI
        </button>
        {[
          ["docx", "Baixar DOCX"],
          ["pdf", "PDF"],
          ["xlsx", "XLSX"],
        ].map(([formato = "", rotulo]) => (
          <button
            key={formato}
            type="button"
            className="btn secondary"
            data-exportar={formato}
            disabled={!ultima}
            onClick={() => exportar(formato)}
          >
            {rotulo}
          </button>
        ))}
        {tipo === "CONVOCACAO" && aoAbrirAgenda ? (
          <button
            type="button"
            className="btn secondary"
            data-acao="abrir-agenda"
            data-tour="classificacao-abrir-agenda"
            onClick={aoAbrirAgenda}
          >
            <i className="fa-solid fa-calendar-days" aria-hidden="true" />{" "}
            Agenda das entrevistas
          </button>
        ) : null}
        {e.podeEditar && ultima && !ultima.publicada ? (
          <button
            type="button"
            className="btn secondary"
            data-acao="publicar"
            disabled={
              (ultima.pendencias ?? 0) > 0 || Boolean(defasada) || marcando
            }
            onClick={marcarComoPublicada}
          >
            {marcando ? "Publicando…" : "Marcar como publicada"}
          </button>
        ) : null}
        {tipo === "FINAL" && e.podeEditar && ultima ? (
          <button
            type="button"
            className="btn secondary"
            data-acao="publicar-aprovados"
            data-tour="classificacao-publicar-aprovados"
            disabled={
              (ultima.pendencias ?? 0) > 0 ||
              Boolean(defasada) ||
              Boolean(publicando)
            }
            onClick={abrirPublicacaoDeAprovados}
          >
            <i className="fa-solid fa-user-check" aria-hidden="true" /> Publicar
            como lista de aprovados
          </button>
        ) : null}
        {desempate
          ? [
              ["xlsx", "Relatório de desempate (XLSX)"],
              ["pdf", "Relatório de desempate (PDF)"],
            ].map(([formato = "", rotulo]) => (
              <button
                key={formato}
                type="button"
                className="btn secondary"
                data-desempate={formato}
                onClick={() => void exportarDesempate(formato)}
              >
                {rotulo}
              </button>
            ))
          : null}
      </div>
      {e.erroDaConvocacao ? (
        <ErroAoCarregar
          className="classificacao-erro-convocacao"
          oQue="a convocação do edital"
          mensagem={e.erroDaConvocacao}
          aoTentar={() => void estado.recarregarConvocacao()}
        />
      ) : null}
      {ultima ? (
        <p className="status-discreto" data-geracao={ultima.id}>
          Gerada em {dataHora(ultima.gerada_em)}
          {ultima.por ? ` por ${ultima.por}` : ""} · regra:{" "}
          {rotuloDaVersaoNaLista(dados?.regra?.versoes, ultima.versao_regra)} ·
          SHA-256 {String(ultima.hash || "").slice(0, 12)}…
          {ultima.publicada ? " · publicada" : ""}
        </p>
      ) : null}
      {defasada && !ultima?.publicada ? (
        <Aviso tom="warning" papel="status" className="classificacao-defasada">
          {textoDaDefasagem(defasada, ultima)}
        </Aviso>
      ) : null}
      {desatualizada ? (
        <Aviso
          tom="warning"
          papel="status"
          className="classificacao-desatualizada"
        >
          Há recursos aprovados depois desta lista — gere de novo.
        </Aviso>
      ) : null}
      {relatorio === "preparando" ? (
        <p
          className="status-discreto"
          role="status"
          data-desempate-preparo="preparando"
        >
          Relatório de desempate sendo preparado…
        </p>
      ) : null}
      {relatorio === "nao_confere" ? (
        <Aviso
          tom="warning"
          papel="status"
          className="classificacao-desempate-nao-confere"
        >
          {defasada
            ? "O relatório de desempate não saiu: os dados mudaram desde esta geração — gere de novo."
            : "O cálculo em Python não confere com esta lista e o relatório de desempate não saiu — avise o suporte."}
        </Aviso>
      ) : null}
      {relatorio === "falhou" ? (
        <Aviso
          tom="warning"
          papel="status"
          className="classificacao-desempate-falhou"
        >
          O relatório de desempate não pôde ser preparado — gere de novo ou
          avise o suporte.
        </Aviso>
      ) : null}
      {publicando ? (
        <ModalDePublicacaoDeAprovados
          estado={estado}
          registro={publicando}
          resultado={resultado}
          analises={analises}
          aoFechar={() => setPublicando(null)}
        />
      ) : null}
      {documento?.retrato ? (
        <DocumentoDoSei
          estado={estado}
          podeEditar={e.podeEditar}
          registrado={{ ...documento, retrato: documento.retrato }}
          lista={
            tipo === "CONVOCACAO" && lista === "eliminados" ? "todas" : lista
          }
          fase={fase || null}
          aoFechar={() => setDocumento(null)}
        />
      ) : null}
    </section>
  );
}

export function Listas({
  estado,
  e,
  calcular,
  aoAbrirAgenda,
  confirmar = (mensagem) => globalThis.confirm?.(mensagem) ?? true,
}: {
  estado: EstadoDaClassificacao;
  e: SnapshotDaClassificacao;
  calcular: (
    dados: DadosDaClassificacao,
    tipo: TipoDeLista,
  ) => ResultadoDoMotor;
  aoAbrirAgenda?: () => void;
  confirmar?: (mensagem: string) => boolean;
}) {
  // Até a pessoa escolher, a lista acompanha a fase do edital.
  const [escolhido, setEscolhido] = useState<TipoDeLista | null>(null);
  const [recorte, setRecorte] = useState(RECORTE_VAZIO);
  const [aberto, setAberto] = useState("");
  const [pendencia, setPendencia] = useState<PendenciaDeEmpate | null>(null);
  const [registros, setRegistros] = useState<
    Partial<Record<TipoDeLista, ListaRegistrada>>
  >({});
  const [quantasVagas, setQuantasVagas] = useState(VAGAS_POR_VEZ);
  const dados = e.dados;
  const regra = dados?.regra?.configuracao || null;
  const tipo = escolhido || listaDaFase(dados);

  const resultado = useMemo(
    () => (dados && regra ? calcular(dados, tipo) : null),
    [dados, regra, tipo, calcular],
  );
  const vagas = useMemo(
    () => recortarResultado(resultado, recorte),
    [resultado, recorte],
  );
  const rotulosDasModalidades = useMemo(
    () =>
      Object.fromEntries(
        normalizarRegra(regra).modalidades.map((m) => [
          m.codigo,
          m.codigo === "AC" ? "AC" : m.nome,
        ]),
      ),
    [regra],
  );
  const explicacao = aberto && resultado ? resultado.explicacoes[aberto] : null;

  const trocarTipo = (novo: string) => {
    if (
      novo !== "PRELIMINAR" &&
      novo !== "CONVOCACAO" &&
      novo !== "ENTREVISTA" &&
      novo !== "FINAL"
    )
      return;
    setEscolhido(novo);
    setAberto("");
    setQuantasVagas(VAGAS_POR_VEZ);
  };

  return (
    <div className="classificacao-listas" data-tour="classificacao-listas">
      <Segmentado
        rotulo="Lista"
        className="classificacao-tipos"
        opcoes={TIPOS_DE_LISTA.flatMap(([valor, rotulo]) =>
          valor && rotulo ? [{ valor, rotulo }] : [],
        )}
        valor={tipo}
        aoMudar={trocarTipo}
      />
      <Indicadores
        resultado={resultado}
        carregando={e.carregandoEdital || !dados}
      />
      {dados && !regra ? (
        <Aviso tom="warning" papel="status">
          Este edital ainda não tem regra de classificação.
        </Aviso>
      ) : null}
      {resultado ? (
        <>
          <Avisos
            resultado={resultado}
            podeEditar={e.podeEditar}
            aoResolver={setPendencia}
          />
          {resultado.dataCorte ? (
            <p className="status-discreto">
              Data de corte da idade: {dataBR(resultado.dataCorte)}
            </p>
          ) : null}
          <Acoes
            key={tipo}
            tipo={tipo}
            e={e}
            resultado={resultado}
            registro={registros[tipo] || null}
            estado={estado}
            aoGerado={(novo) => setRegistros((r) => ({ ...r, [tipo]: novo }))}
            aoCarregarRegistro={(novo) =>
              setRegistros((r) => ({ ...r, [tipo]: { ...r[tipo], ...novo } }))
            }
            aoAbrirAgenda={aoAbrirAgenda}
            confirmar={confirmar}
          />
          <Filtros
            resultado={resultado}
            regra={regra}
            recorte={recorte}
            aoMudar={setRecorte}
          />
          {vagas.length ? (
            vagas
              .slice(0, quantasVagas)
              .map((v) => (
                <TabelaDaVaga
                  key={v.chave}
                  vaga={v}
                  casas={resultado.casas}
                  rotulosDasModalidades={rotulosDasModalidades}
                  aoAbrir={setAberto}
                />
              ))
          ) : (
            <EstadoVazio>Nenhuma vaga no recorte.</EstadoVazio>
          )}
          {vagas.length > quantasVagas ? (
            <button
              type="button"
              className="btn secondary ui-tabela-mais"
              onClick={() => setQuantasVagas((n) => n + VAGAS_POR_VEZ)}
            >
              Mostrar mais vagas ({vagas.length - quantasVagas})
            </button>
          ) : null}
        </>
      ) : e.carregandoEdital ? (
        <div className="ui-card" aria-busy="true">
          <div className="ui-esqueleto-linha" />
          <div className="ui-esqueleto-linha" />
          <div className="ui-esqueleto-linha" />
        </div>
      ) : null}
      {explicacao && resultado ? (
        <GavetaDoCandidato
          explicacao={explicacao}
          vaga={resultado.vagas.find((v) => v.chave === explicacao.vaga)}
          rotulosDasModalidades={rotulosDasModalidades}
          casas={resultado.casas}
          podeEditar={e.podeEditar}
          aoSalvarHora={estado.salvarHoraDeNascimento}
          aoFechar={() => setAberto("")}
        />
      ) : null}
      {pendencia ? (
        <ModalDeDesempate
          pendencia={pendencia}
          estado={estado}
          aoFechar={() => setPendencia(null)}
        />
      ) : null}
    </div>
  );
}
