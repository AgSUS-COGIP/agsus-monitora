import type {
  EstadoDasPendencias,
  SnapshotDasPendencias,
} from "./estado-das-pendencias.ts";
import type {
  LinhaDaPendencia,
  PendenciaDoEdital,
  RascunhoDaDecisao,
  SituacaoDaPendencia,
  TipoDePendencia,
} from "../../../lib/pendencias-do-edital.ts";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  contarAbertas,
  DECISOES,
  DESFECHOS_DAS_OUTRAS,
  DESFECHOS_DO_CONVOCADO,
  diaBr,
  editaisDasPendencias,
  filtrarPendencias,
  linhasEscolhiveis,
  MOTIVO_MAXIMO,
  ORDEM_DOS_TIPOS,
  textoDaAlteracao,
  textoDoDetalhe,
  TIPOS_DE_PENDENCIA,
} from "../../../lib/pendencias-do-edital.ts";
import { formatarDataHora } from "../../../lib/cronograma-do-edital.ts";
import {
  Campo,
  classes,
  EstadoVazio,
  ErroAoCarregar,
  GradeDeKpis,
  Kpi,
  LinhasEsqueleto,
  Modal,
  Segmentado,
  Selo,
} from "../../../ui/index.ts";
import "./pendencias.css";

/*
  Aba "Pendências" da Lista de aprovados (migration 20261026190000): o que o
  gestor do edital decide dentro do sistema — Contratado com duas matrículas,
  Contratado em duas listas que a regra não decide, pessoa repetida, posição
  repetida e Convocado sem desfecho. Indicadores por tipo (clicar filtra),
  edital e situação (abertas ou resolvidas nos últimos 30 dias), um cartão por
  pendência com as linhas e, para quem pode decidir (o banco diz em cada uma),
  o botão Decidir: o modal pede a escolha do tipo e o motivo. O histórico de
  cada pendência fica no cartão.

  `editalFixo` prende a aba num edital (a jornada por edital usa a mesma peça).
*/

export function usarPendencias(
  estado: EstadoDasPendencias,
): SnapshotDasPendencias {
  return useSyncExternalStore(estado.assinar, estado.obter);
}

const SITUACOES = [
  { valor: "ABERTA" as const, rotulo: "Abertas" },
  { valor: "RESOLVIDA" as const, rotulo: "Resolvidas (30 dias)" },
];

function valorDaLinha(l: LinhaDaPendencia) {
  return [
    l.posicao !== null ? `${l.posicao}º` : "",
    l.vaga ? `vaga ${l.vaga}` : "",
    l.modalidade,
  ]
    .filter(Boolean)
    .join(" · ");
}

function TabelaDasLinhas({ pendencia }: { pendencia: PendenciaDoEdital }) {
  const comMatricula =
    pendencia.tipo === "CONTRATADO_DUAS_MATRICULAS" ||
    pendencia.tipo === "CONTRATADO_EM_DUAS_LISTAS" ||
    pendencia.linhas.some((l) => l.matricula);
  return (
    <div className="ui-tabela-rolagem">
      <table className="pendencia-linhas">
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">Vaga</th>
            <th scope="col">Modalidade</th>
            <th scope="col" className="num">
              Posição
            </th>
            <th scope="col">Status</th>
            {comMatricula ? <th scope="col">Matrícula</th> : null}
            {pendencia.tipo === "CONVOCADO_SEM_DESFECHO" ? (
              <th scope="col">Convocado em</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {pendencia.linhas.map((l) => (
            <tr key={l.id} className={classes(l.removida && "is-removida")}>
              <td>
                {l.nome}
                {l.removida ? <small> (saiu da lista)</small> : null}
                {!l.listaAtiva ? <small> (lista inativa)</small> : null}
              </td>
              <td>{l.vaga}</td>
              <td>{l.modalidade}</td>
              <td className="num">{l.posicao ?? ""}</td>
              <td>{l.status || "Sem status"}</td>
              {comMatricula ? <td>{l.matricula}</td> : null}
              {pendencia.tipo === "CONVOCADO_SEM_DESFECHO" ? (
                <td>{diaBr(l.convocadoEm)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Historico({ pendencia }: { pendencia: PendenciaDoEdital }) {
  const eventos = pendencia.historico.filter((e) =>
    ["DECISAO", "CORRECAO"].includes(e.evento),
  );
  if (!eventos.length) return null;
  const nomeDe = (id: string) =>
    pendencia.linhas.find((l) => l.id === id)?.nome || "Linha";
  return (
    <details className="pendencia-historico">
      <summary>Histórico ({eventos.length})</summary>
      <ul>
        {eventos.map((e, i) => (
          <li key={`${e.em}-${i}`}>
            <b>{DECISOES[e.decisao] || e.decisao}</b>
            {e.evento === "CORRECAO" ? " (sem resolver)" : ""} ·{" "}
            {formatarDataHora(e.em)}
            {e.por ? ` · ${e.por}` : ""}
            <div>Motivo: {e.motivo}</div>
            {e.alteracoes.length ? (
              <div>
                {e.alteracoes
                  .map((a) => `${nomeDe(a.candidato)}: ${textoDaAlteracao(a)}`)
                  .join("; ")}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function CartaoDaPendencia({
  pendencia,
  aoDecidir,
}: {
  pendencia: PendenciaDoEdital;
  aoDecidir: (id: string) => void;
}) {
  const tipo = TIPOS_DE_PENDENCIA[pendencia.tipo];
  const aberta = pendencia.situacao === "ABERTA";
  return (
    <article
      className="ui-card pendencia-cartao"
      data-tom={tipo.tom}
      data-pendencia={pendencia.id}
      data-tipo={pendencia.tipo}
    >
      <header className="pendencia-topo">
        <div>
          <h3>
            <i className={`fa-solid ${tipo.icone}`} aria-hidden="true" />{" "}
            {tipo.titulo}
          </h3>
          <p className="pendencia-onde">
            Edital {pendencia.edital}
            {pendencia.unidade ? ` · ${pendencia.unidade}` : ""} ·{" "}
            {textoDoDetalhe(pendencia)}
          </p>
        </div>
        {aberta ? (
          pendencia.podeDecidir ? (
            <button
              type="button"
              className="btn green"
              data-acao="decidir"
              onClick={() => aoDecidir(pendencia.id)}
            >
              <i className="fa-solid fa-gavel" aria-hidden="true" /> Decidir
            </button>
          ) : null
        ) : (
          <Selo tom={pendencia.decisao === "SANEADA" ? "neutro" : "aprovado"}>
            {DECISOES[pendencia.decisao] || "Resolvida"}
          </Selo>
        )}
      </header>
      <TabelaDasLinhas pendencia={pendencia} />
      {!aberta && pendencia.decisao !== "SANEADA" ? (
        <p className="pendencia-decisao">
          {pendencia.decididaPor ? `${pendencia.decididaPor} · ` : ""}
          {formatarDataHora(pendencia.decididaEm)} · Motivo: {pendencia.motivo}
        </p>
      ) : null}
      <Historico pendencia={pendencia} />
    </article>
  );
}

function EscolhaDaLinha({
  nome,
  linhas,
  valor,
  aoMudar,
  extra,
}: {
  nome: string;
  linhas: readonly LinhaDaPendencia[];
  valor: string;
  aoMudar: (id: string) => void;
  extra?: ReactNode;
}) {
  return (
    <fieldset className="pendencia-escolha">
      <legend>{nome}</legend>
      {linhas.map((l) => (
        <label key={l.id}>
          <input
            type="radio"
            name="pendencia-linha"
            value={l.id}
            checked={valor === l.id}
            onChange={() => aoMudar(l.id)}
          />
          <span>
            <b>{l.nome}</b> · {valorDaLinha(l)}
            {l.status ? ` · ${l.status}` : ""}
            {l.matricula ? ` · matrícula ${l.matricula}` : ""}
          </span>
        </label>
      ))}
      {extra}
    </fieldset>
  );
}

function CamposDaDecisao({
  pendencia,
  rascunho,
  mudar,
  hoje,
}: {
  pendencia: PendenciaDoEdital;
  rascunho: RascunhoDaDecisao;
  mudar: (m: Partial<RascunhoDaDecisao>) => void;
  hoje: string;
}) {
  const linhas = linhasEscolhiveis(pendencia);
  switch (pendencia.tipo) {
    case "CONTRATADO_DUAS_MATRICULAS":
      return (
        <>
          <EscolhaDaLinha
            nome="Qual vínculo vale"
            linhas={linhas}
            valor={rascunho.linha || ""}
            aoMudar={(linha) => mudar({ linha })}
          />
          <Campo rotulo="As linhas com outra matrícula ficam">
            <select
              value={rascunho.outras || DESFECHOS_DAS_OUTRAS[0]}
              onChange={(e) => mudar({ outras: e.target.value })}
            >
              {DESFECHOS_DAS_OUTRAS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Campo>
        </>
      );
    case "CONTRATADO_EM_DUAS_LISTAS":
      return (
        <EscolhaDaLinha
          nome="Por qual lista a pessoa foi contratada"
          linhas={linhas}
          valor={rascunho.linha || ""}
          aoMudar={(linha) => mudar({ linha })}
        />
      );
    case "PESSOA_REPETIDA":
      return (
        <EscolhaDaLinha
          nome="Qual linha fica"
          linhas={linhas}
          valor={rascunho.pessoasDiferentes ? "" : rascunho.linha || ""}
          aoMudar={(linha) => mudar({ linha, pessoasDiferentes: false })}
          extra={
            <label>
              <input
                type="radio"
                name="pendencia-linha"
                value="diferentes"
                checked={Boolean(rascunho.pessoasDiferentes)}
                onChange={() => mudar({ pessoasDiferentes: true, linha: "" })}
              />
              <span>São pessoas diferentes: ficam todas</span>
            </label>
          }
        />
      );
    case "POSICAO_REPETIDA":
      return (
        <>
          <Segmentado
            rotulo="O que fazer"
            opcoes={[
              { valor: "empate", rotulo: "Empate previsto no edital" },
              { valor: "corrigir", rotulo: "Corrigir a posição" },
            ]}
            valor={rascunho.acao || ""}
            aoMudar={(acao) => mudar({ acao: acao as "empate" | "corrigir" })}
          />
          {rascunho.acao === "corrigir" ? (
            <>
              <EscolhaDaLinha
                nome="Linha a corrigir"
                linhas={linhas}
                valor={rascunho.linha || ""}
                aoMudar={(linha) => mudar({ linha })}
              />
              <Campo rotulo="Posição nova" obrigatorio>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  inputMode="numeric"
                  value={rascunho.posicao || ""}
                  onChange={(e) => mudar({ posicao: e.target.value })}
                />
              </Campo>
            </>
          ) : null}
        </>
      );
    case "CONVOCADO_SEM_DESFECHO":
      return (
        <>
          <Campo rotulo="Desfecho" obrigatorio>
            <select
              value={rascunho.status || ""}
              onChange={(e) => mudar({ status: e.target.value })}
            >
              <option value="" disabled>
                Escolha
              </option>
              {DESFECHOS_DO_CONVOCADO.map((d) => (
                <option key={d} value={d}>
                  {d === "Convocado" ? "Nova data da convocação" : d}
                </option>
              ))}
            </select>
          </Campo>
          {rascunho.status === "Contratado" ||
          rascunho.status === "Migração" ? (
            <Campo rotulo="Matrícula" obrigatorio>
              <input
                value={rascunho.matricula || ""}
                onChange={(e) => mudar({ matricula: e.target.value })}
              />
            </Campo>
          ) : null}
          {rascunho.status === "Convocado" ? (
            <Campo rotulo="Nova data da convocação" obrigatorio>
              <input
                type="date"
                max={hoje}
                value={rascunho.data || ""}
                onChange={(e) => mudar({ data: e.target.value })}
              />
            </Campo>
          ) : null}
        </>
      );
  }
}

function ModalDaDecisao({
  estado,
  pendencia,
  dados,
  hoje,
}: {
  estado: EstadoDasPendencias;
  pendencia: PendenciaDoEdital;
  dados: SnapshotDasPendencias;
  hoje: string;
}) {
  const [rascunho, setRascunho] = useState<RascunhoDaDecisao>({});
  const mudar = (m: Partial<RascunhoDaDecisao>) =>
    setRascunho((atual) => ({ ...atual, ...m }));
  const tipo = TIPOS_DE_PENDENCIA[pendencia.tipo];
  return (
    <Modal
      id="pendenciaModal"
      className="approved-modal"
      cartaoClassName="approved-modal-card pendencia-modal"
      rotuloId="pendenciaModalTitulo"
      aoFechar={estado.fechar}
      fecharAoClicarFora={false}
    >
      <div className="modal-head">
        <div>
          <h3 id="pendenciaModalTitulo">{tipo.titulo}</h3>
          <p className="approved-modal-subtitle">
            Edital {pendencia.edital} · {textoDoDetalhe(pendencia)}
          </p>
        </div>
        <button className="btn secondary" type="button" onClick={estado.fechar}>
          Fechar
        </button>
      </div>
      <div className="modal-body">
        <div className="pendencia-campos">
          {pendencia.tipo === "CONVOCADO_SEM_DESFECHO" ? (
            <TabelaDasLinhas pendencia={pendencia} />
          ) : null}
          <CamposDaDecisao
            pendencia={pendencia}
            rascunho={rascunho}
            mudar={mudar}
            hoje={hoje}
          />
          <Campo rotulo="Motivo" obrigatorio largo>
            <textarea
              rows={3}
              maxLength={MOTIVO_MAXIMO}
              data-foco-inicial
              value={rascunho.motivo || ""}
              onChange={(e) => mudar({ motivo: e.target.value })}
            />
          </Campo>
        </div>
        {dados.erroDaDecisao ? (
          <p className="pendencia-erro" role="alert">
            {dados.erroDaDecisao}
          </p>
        ) : null}
        <div className="approved-modal-actions">
          <button
            className="btn secondary"
            type="button"
            onClick={estado.fechar}
            disabled={dados.decidindo}
          >
            Cancelar
          </button>
          <button
            className="btn green"
            type="button"
            data-acao="gravar-decisao"
            disabled={dados.decidindo}
            onClick={() => void estado.decidir(pendencia, rascunho)}
          >
            <i className="fa-solid fa-floppy-disk" aria-hidden="true" />{" "}
            {dados.decidindo ? "Gravando…" : "Gravar decisão"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export interface PropsDaAbaDePendencias {
  ativa: boolean;
  estado: EstadoDasPendencias;
  area: string;
  /** O edital escolhido de fora (o caso de um aviso); a tela continua podendo trocar. */
  editalPedido?: string;
  /** Prende a aba num edital (a jornada por edital). */
  editalFixo?: string;
  hoje: string;
}

export function AbaPendencias({
  ativa,
  estado,
  area,
  editalPedido = "",
  editalFixo = "",
  hoje,
}: PropsDaAbaDePendencias) {
  const dados = usarPendencias(estado);
  const [edital, setEdital] = useState(editalFixo || editalPedido);
  const [situacao, setSituacao] = useState<SituacaoDaPendencia>("ABERTA");
  const [tipo, setTipo] = useState<TipoDePendencia | "">("");
  /*
    As pendências da área chegam com a abertura da Lista de aprovados (o selo
    da aba). Aberta a aba sem elas — outra área, ou a abertura não as trouxe —,
    lê aqui; com erro, "Tentar de novo" relê (sem laço).
  */
  const temAsDaArea =
    dados.area === area &&
    (dados.carregado || dados.carregando || Boolean(dados.erro));
  useEffect(() => {
    if (area && ativa && !temAsDaArea) void estado.carregar(area);
  }, [estado, area, ativa, temAsDaArea]);
  useEffect(() => {
    if (editalPedido && !editalFixo) setEdital(editalPedido);
  }, [editalPedido, editalFixo]);

  const editais = useMemo(
    () => editaisDasPendencias(dados.pendencias),
    [dados.pendencias],
  );
  const editalEfetivo = editalFixo || edital;
  const contagem = contarAbertas(dados.pendencias, editalEfetivo);
  const visiveis = filtrarPendencias(dados.pendencias, {
    editalId: editalEfetivo,
    situacao,
    tipo,
  });
  const naModal = dados.modal
    ? dados.pendencias.find((p) => p.id === dados.modal?.pendenciaId)
    : undefined;
  const carregando = !dados.carregado && !dados.erro;

  return (
    <div
      id="approvedPanelPendencias"
      className={classes("approved-tabpanel", !ativa && "hidden")}
      role="tabpanel"
      aria-labelledby="approvedTabPendencias"
    >
      <GradeDeKpis
        rotulo="Pendências abertas por tipo"
        className="pendencias-kpis"
      >
        {ORDEM_DOS_TIPOS.map((t) => (
          <Kpi
            key={t}
            chave={t}
            tom={TIPOS_DE_PENDENCIA[t].tom}
            icone={TIPOS_DE_PENDENCIA[t].icone}
            rotulo={TIPOS_DE_PENDENCIA[t].curto}
            valor={contagem.porTipo[t]}
            carregando={carregando}
            ativo={tipo === t}
            aoClicar={() => setTipo((atual) => (atual === t ? "" : t))}
          />
        ))}
      </GradeDeKpis>

      <div className="pendencias-filtros">
        {editalFixo ? null : (
          <Campo rotulo="Edital">
            <select value={edital} onChange={(e) => setEdital(e.target.value)}>
              <option value="">Todos os editais</option>
              {editais.map((e) => (
                <option key={e.valor} value={e.valor}>
                  {e.rotulo}
                  {e.abertas ? ` (${e.abertas})` : ""}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Segmentado
          rotulo="Situação"
          opcoes={SITUACOES}
          valor={situacao}
          aoMudar={setSituacao}
        />
      </div>

      {dados.erro && !dados.carregado ? (
        <ErroAoCarregar
          id="pendenciasErro"
          oQue="as pendências"
          mensagem={dados.erro}
          aoTentar={() => void estado.carregar(area)}
        />
      ) : carregando ? (
        <LinhasEsqueleto colunas={5} linhas={4} />
      ) : visiveis.length ? (
        <div className="pendencias-lista">
          {visiveis.map((p) => (
            <CartaoDaPendencia
              key={p.id}
              pendencia={p}
              aoDecidir={estado.abrir}
            />
          ))}
        </div>
      ) : (
        <EstadoVazio>
          {situacao === "ABERTA"
            ? "Nenhuma pendência aberta."
            : "Nenhuma pendência resolvida nos últimos 30 dias."}
        </EstadoVazio>
      )}

      {naModal ? (
        <ModalDaDecisao
          key={dados.modal?.abertura}
          estado={estado}
          pendencia={naModal}
          dados={dados}
          hoje={hoje}
        />
      ) : null}
    </div>
  );
}
