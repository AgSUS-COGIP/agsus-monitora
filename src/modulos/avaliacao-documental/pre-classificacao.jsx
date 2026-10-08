import { useEffect, useState, useSyncExternalStore } from "react";
import { ordinal } from "../../lib/classificacao/numeros.js";
import {
  contadoresDaPreClassificacao,
  declaradasCongeladas,
  DICA_DA_ART,
  DICA_DA_NOTA_DO_LOTE,
  DICA_DA_RECALCULADA,
  loteDaVaga,
  lotesAPublicar,
  nota,
  podeIncluirPorDecisao,
  regraComTamanhos,
  ROTULO_DA_ART,
  ROTULOS_DA_SITUACAO,
  SITUACOES_DO_EDITAL,
  tamanhoDefinido,
  tamanhoSugerido,
  textoDoAviso,
  textoDoLote,
  vagasDaTela,
} from "../../lib/avaliacao-documental/tela-da-pre-classificacao.js";
import { rotuloDaVersaoNaLista } from "../../lib/nome-da-versao.ts";
import { ESPERA_DO_PEDIDO_MIN } from "../../lib/robos-de-carga.js";
import { Aviso, GradeDeKpis, Kpi, Selo } from "../../ui/index.js";
import {
  IncluirPorDecisao,
  RevogarDecisao,
  SeloDaDecisao,
} from "./decisao-do-lote.jsx";
import { chaveDaLista } from "./estado-da-pre-classificacao.js";

/*
  Aba Pré-classificação (fase F2): a Lista Geral de Classificação Provisória
  por ART e o lote de convocação de cada vaga, como o job Python gravou
  (scripts/pre_classificacao/). A tela só lê; "Recalcular" (coordenação) pede
  o job; os tamanhos do lote por vaga viram versão nova da regra; as listas
  PROVISORIA e LOTE são registradas no banco e exportadas pelo gerador da
  Classificação. A coordenação inclui no lote por decisão (ex.: "Critério
  CORES") quem a regra deixa fora, e revoga (decisao-do-lote.jsx); o lote
  mostra "N pela regra + M por decisão". Explicações:
  docs/aya/regras-da-avaliacao-documental.md.
*/

const SITUACAO_DA_EXECUCAO = {
  EM_ANDAMENTO: "rodando",
  CONCLUIDA: "concluída",
  PARCIAL: "parcial",
  FALHOU: "falhou",
};
const TOM_DA_SITUACAO = {
  NO_LOTE: "aprovado",
  ANALISADO: "revisar",
  RANQUEADO: "neutro",
  ELIMINADO: "reprovado",
};
const quando = (valor) =>
  valor
    ? new Date(valor).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";

function cabecalhoDaVaga(v) {
  const vagas =
    v.vagas_imediatas === null || v.vagas_imediatas === undefined
      ? ""
      : `${v.vagas_imediatas} ${v.vagas_imediatas === 1 ? "vaga" : "vagas"}${v.cadastro_reserva ? " + CR" : ""}`;
  return [`VAGA ${v.codigo}`, v.cargo, v.lotacao, vagas]
    .filter(Boolean)
    .join(" - ");
}

function LinhaDoInscrito({ c, podeCoordenar, pre }) {
  return (
    <tr data-candidato={c.codigo} data-situacao={c.situacao}>
      <td>{c.posicao ? ordinal(c.posicao) : "—"}</td>
      <td>{c.codigo}</td>
      <td>{c.nome}</td>
      <td>{c.modalidade}</td>
      <td>
        {c.origem_nota === "ART" ? (
          <strong title={DICA_DA_NOTA_DO_LOTE}>{nota(c.art)}</strong>
        ) : (
          nota(c.art)
        )}
      </td>
      <td>
        {c.origem_nota === "DECLARADA" ? (
          <strong title={DICA_DA_NOTA_DO_LOTE}>{nota(c.declarada)}</strong>
        ) : (
          nota(c.declarada)
        )}
        {c.declarada_congelada !== null &&
        c.declarada_congelada !== undefined ? (
          <span
            className="avd-congelada"
            title={`Congelada em ${quando(c.congelada_em)}`}
          >
            {" "}
            <i className="fa-solid fa-lock" aria-hidden="true" />
            <span className="sr-only">congelada</span>
          </span>
        ) : null}
        {c.divergente ? (
          <span
            className="avd-diverge"
            title="ART diferente da nota declarada recalculada, além da tolerância da regra"
          >
            {" "}
            <i
              className="fa-solid fa-triangle-exclamation"
              aria-hidden="true"
            />{" "}
            diverge
          </span>
        ) : null}
      </td>
      <td>
        <Selo
          tom={TOM_DA_SITUACAO[c.situacao]}
          titulo={c.motivo_entrada || undefined}
        >
          {ROTULOS_DA_SITUACAO[c.situacao]}
          {c.lote ? ` · lote ${c.lote}` : ""}
        </Selo>{" "}
        <SeloDaDecisao c={c} />
        {podeCoordenar ? (
          <RevogarDecisao
            c={c}
            aoRevogar={(motivo) => pre.revogarDecisao([c], motivo)}
          />
        ) : null}
      </td>
    </tr>
  );
}

function VagaDaPre({
  v,
  configuracao,
  podeCoordenar,
  tamanho,
  aoMudarTamanho,
  pre,
}) {
  const [incluindo, setIncluindo] = useState(false);
  const definido = tamanhoDefinido(configuracao, v.codigo);
  const sugerido = tamanhoSugerido(configuracao, v);
  const processada = v.inscritos !== null && v.inscritos !== undefined;
  const lote = loteDaVaga(v, v.lote);
  const foraDoLote = [...v.fora, ...v.eliminados]
    .filter(podeIncluirPorDecisao)
    .map((c) => ({ ...c, nota: c.nota ?? c.art }));
  return (
    <article className="ui-card avd-vaga" data-vaga={v.codigo}>
      <h3 className="ui-titulo">{cabecalhoDaVaga(v)}</h3>
      <div className="avd-inline ui-texto-secundario">
        {processada ? (
          <span data-lote-da-vaga>
            {textoDoLote(lote.pelaRegra, lote.porDecisao, v.tamanho)}
            {v.descricao ? ` (${v.descricao})` : ""}
            {v.art_corte !== null && v.art_corte !== undefined
              ? ` · linha de corte ${nota(v.art_corte)}`
              : ""}
          </span>
        ) : (
          <span>
            {v.candidatos_empregare ?? 0} inscritos na Empregare, ainda sem
            pré-classificação
          </span>
        )}
        {podeCoordenar ? (
          <label className="avd-caixa">
            Tamanho do lote
            <input
              type="number"
              min="1"
              step="1"
              value={tamanho ?? definido ?? ""}
              placeholder={sugerido.tamanho ? String(sugerido.tamanho) : ""}
              aria-label={`Tamanho do lote da vaga ${v.codigo}`}
              onChange={(ev) => aoMudarTamanho(v.codigo, ev.target.value)}
            />
            <span title={sugerido.descricao || undefined}>
              {sugerido.tamanho
                ? `sugerido ${sugerido.descricao}`
                : sugerido.descricao || "sem quadro de vagas"}
            </span>
          </label>
        ) : null}
        {podeCoordenar && processada ? (
          <button
            type="button"
            className="btn secondary small"
            data-acao="incluir-por-decisao"
            disabled={!foraDoLote.length}
            onClick={() => setIncluindo(true)}
          >
            Incluir por decisão da coordenação
          </button>
        ) : null}
      </div>
      {incluindo ? (
        <IncluirPorDecisao
          candidatos={foraDoLote}
          aoIncluir={(escolhidos, motivo) =>
            pre.incluirPorDecisao(escolhidos, motivo)
          }
          aoFechar={() => setIncluindo(false)}
        />
      ) : null}
      {(v.avisos || []).length ? (
        <ul className="avd-lista-simples" aria-label="Avisos da vaga">
          {v.avisos.map((a) => (
            <li key={a}>{textoDoAviso(a)}</li>
          ))}
        </ul>
      ) : null}
      {v.lote.length || v.fora.length ? (
        <div className="ui-tabela-rolagem">
          <table className="avd-tabela">
            <thead>
              <tr>
                <th scope="col">Classificação</th>
                <th scope="col">Código</th>
                <th scope="col">Nome</th>
                <th scope="col">Modalidade</th>
                <th scope="col" title={DICA_DA_ART}>
                  {ROTULO_DA_ART}
                </th>
                <th scope="col" title={DICA_DA_RECALCULADA}>
                  Recalculada
                </th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {v.lote.map((c) => (
                <LinhaDoInscrito
                  key={c.id}
                  c={c}
                  podeCoordenar={podeCoordenar}
                  pre={pre}
                />
              ))}
              {v.lote.length && v.fora.length ? (
                <tr className="avd-linha-de-corte">
                  <td colSpan={7}>Linha de corte</td>
                </tr>
              ) : null}
              {v.fora.map((c) => (
                <LinhaDoInscrito key={c.id} c={c} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {v.eliminados.length ? (
        <details className="avd-eliminados">
          <summary>Eliminados ({v.eliminados.length})</summary>
          <table className="avd-tabela">
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Nome</th>
                <th scope="col">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {v.eliminados.map((c) => (
                <tr
                  key={c.id}
                  data-candidato={c.codigo}
                  data-situacao="ELIMINADO"
                >
                  <td>{c.codigo}</td>
                  <td>{c.nome}</td>
                  <td>{c.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </article>
  );
}

function ExportarLista({ registrado, pre, comEliminados }) {
  if (!registrado) return null;
  return (
    <span className="ui-acoes">
      <button
        type="button"
        className="btn secondary small"
        onClick={() => void pre.copiarParaSei(registrado)}
      >
        Copiar para o SEI
      </button>
      <button
        type="button"
        className="btn secondary small"
        onClick={() => void pre.exportar(registrado, "docx")}
      >
        Baixar DOCX
      </button>
      {comEliminados ? (
        <>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => void pre.copiarParaSei(registrado, "eliminados")}
          >
            Eliminados: copiar para o SEI
          </button>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => void pre.exportar(registrado, "docx", "eliminados")}
          >
            Eliminados: DOCX
          </button>
        </>
      ) : null}
    </span>
  );
}

function ListasOficiais({ d, p, pre }) {
  const lotes = lotesAPublicar(d);
  const semRegraDeClassificacao = !d.regra_classificacao;
  const registrar = (tipo, lote = null) => void pre.registrarLista(tipo, lote);
  return (
    <section className="ui-card avd-listas" aria-labelledby="avdListasPre">
      <h2 className="ui-titulo" id="avdListasPre">
        Listas oficiais
      </h2>
      {semRegraDeClassificacao && d.pode_registrar_lista ? (
        <Aviso tom="warning">
          Cadastre a regra de classificação do edital para registrar as listas.
        </Aviso>
      ) : null}
      <div className="avd-inline">
        <strong>Lista Geral de Classificação Provisória (ART)</strong>
        {d.pode_registrar_lista ? (
          <button
            type="button"
            className="btn primary small"
            disabled={Boolean(p.registrando) || semRegraDeClassificacao}
            onClick={() => registrar("PROVISORIA")}
          >
            {p.registrando === "PROVISORIA" ? "Registrando…" : "Registrar"}
          </button>
        ) : null}
        <ExportarLista
          registrado={p.registradas.PROVISORIA}
          pre={pre}
          comEliminados
        />
      </div>
      <div className="avd-inline">
        <strong>Lote de convocação</strong>
        {d.pode_registrar_lista
          ? lotes.map(({ lote, quantidade }) => (
              <button
                key={lote}
                type="button"
                className="btn primary small"
                data-lote={lote}
                disabled={Boolean(p.registrando) || semRegraDeClassificacao}
                onClick={() => registrar("LOTE", lote)}
              >
                {p.registrando === chaveDaLista("LOTE", lote)
                  ? "Registrando…"
                  : `Registrar ${lote === 1 ? "o lote inicial" : `a reposição ${lote}`} (${quantidade})`}
              </button>
            ))
          : null}
        {Object.entries(p.registradas)
          .filter(([chave]) => chave.startsWith("LOTE"))
          .map(([chave, registrado]) => (
            <span key={chave} className="avd-inline">
              <span className="ui-texto-secundario">
                Lote {registrado.retrato?.lote ?? "completo"}:
              </span>
              <ExportarLista registrado={registrado} pre={pre} />
            </span>
          ))}
      </div>
      {(d.listas || []).length ? (
        <div className="ui-tabela-rolagem">
          <table className="avd-tabela">
            <caption>Registradas</caption>
            <thead>
              <tr>
                <th scope="col">Lista</th>
                <th scope="col">Gerada em</th>
                <th scope="col">Por</th>
                <th scope="col">Publicada</th>
              </tr>
            </thead>
            <tbody>
              {d.listas.map(({ meta, lote }) => (
                <tr key={meta?.id} data-lista={meta?.id}>
                  <td>
                    {meta?.tipo === "LOTE"
                      ? `Lote de convocação${lote ? ` ${lote}` : ""}`
                      : "Provisória (ART)"}
                  </td>
                  <td>{quando(meta?.gerada_em)}</td>
                  <td>{meta?.por || ""}</td>
                  <td>
                    {meta?.publicada ? (
                      quando(meta.publicada_em) || "Sim"
                    ) : d.pode_publicar_lista ? (
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => void pre.publicarLista(meta.id)}
                      >
                        Marcar como publicada
                      </button>
                    ) : (
                      "Não"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export function PreClassificacao({ e, estado, pre }) {
  const p = useSyncExternalStore(pre.assinar, pre.obter);
  const [tamanhos, setTamanhos] = useState({});
  const [motivo, setMotivo] = useState("");
  const [erroAoSalvar, setErroAoSalvar] = useState("");
  const [abrirDescongelar, setAbrirDescongelar] = useState(false);
  const [motivoDescongelar, setMotivoDescongelar] = useState("");
  const [descongelando, setDescongelando] = useState(false);
  const versaoDaRegra = e.dados?.regra?.versao ?? 0;
  useEffect(() => {
    void pre.carregar(e.editalId);
  }, [pre, e.editalId, versaoDaRegra]);

  if (p.erro)
    return (
      <Aviso tom="danger" papel="alert">
        Não foi possível ler a pré-classificação: {p.erro}{" "}
        <button
          type="button"
          className="btn secondary small"
          onClick={() => void pre.carregar()}
        >
          Tentar novamente
        </button>
      </Aviso>
    );
  const d = p.editalId === e.editalId ? p.dados : null;
  if (!d)
    return (
      <div className="ui-card" aria-busy="true">
        <div className="ui-esqueleto-linha" />
        <div className="ui-esqueleto-linha" />
      </div>
    );

  const cont = contadoresDaPreClassificacao(d);
  const vagas = vagasDaTela(d);
  const ultima = d.ultima_execucao;
  const situacaoDoEdital = ultima?.edital?.situacao;
  const conferida = d.regra?.situacao === "CONFERIDA";
  const pedidoRecente =
    p.pedidoEm instanceof Date &&
    (Date.now() - p.pedidoEm.getTime()) / 60000 < ESPERA_DO_PEDIDO_MIN;
  const configuracao =
    e.dados?.regra?.configuracao || d.regra?.configuracao || {};
  const mudou = Object.keys(tamanhos).length > 0;
  const congeladas = declaradasCongeladas(d);

  async function descongelar() {
    setDescongelando(true);
    const ok = await pre.descongelar(motivoDescongelar.trim());
    setDescongelando(false);
    if (ok) {
      setAbrirDescongelar(false);
      setMotivoDescongelar("");
    }
  }

  async function salvarTamanhos() {
    setErroAoSalvar("");
    const r = await estado.salvarRegra(
      regraComTamanhos(configuracao, tamanhos),
      motivo.trim(),
    );
    if (r.ok) {
      setTamanhos({});
      setMotivo("");
    } else setErroAoSalvar(r.erro);
  }

  return (
    <div className="avd-pre">
      <GradeDeKpis rotulo="Pré-classificação">
        <Kpi
          tom="info"
          icone="fa-users"
          rotulo="Inscritos"
          valor={cont.inscritos}
        />
        <Kpi
          tom="perigo"
          icone="fa-user-xmark"
          rotulo="Eliminados"
          valor={cont.eliminados}
        />
        <Kpi
          tom="neutro"
          icone="fa-list-ol"
          rotulo="Ranqueados"
          valor={cont.ranqueados}
        />
        <Kpi
          tom="sucesso"
          icone="fa-user-check"
          rotulo="Lote (aptos para análise)"
          valor={
            cont.noLotePorDecisao
              ? textoDoLote(
                  cont.noLotePelaRegra,
                  cont.noLotePorDecisao,
                  cont.tamanho,
                ).replace(/^Lote: /, "")
              : cont.tamanho === null
                ? cont.noLote
                : `${cont.noLote} de ${cont.tamanho}`
          }
        />
        <Kpi
          tom="alerta"
          icone="fa-scale-balanced"
          rotulo="ART × recalculada"
          valor={cont.divergencias}
        />
      </GradeDeKpis>

      <section className="ui-card avd-inline" aria-label="Execução">
        <span
          className="ui-texto-secundario"
          data-execucao={ultima?.situacao || "nenhuma"}
        >
          {ultima
            ? `Pré-classificação de ${quando(ultima.fim || ultima.inicio)} · ${SITUACAO_DA_EXECUCAO[ultima.situacao] || ultima.situacao}`
            : "Ainda sem pré-classificação"}
          {d.regra
            ? ` · regra: ${rotuloDaVersaoNaLista(e.dados?.regra?.versoes, d.regra.versao)}`
            : ""}
        </span>
        {d.pode_coordenar ? (
          <button
            type="button"
            className="btn primary small"
            data-acao="recalcular"
            disabled={!conferida || d.em_andamento || pedidoRecente}
            onClick={() => void pre.recalcular()}
          >
            {d.em_andamento
              ? "Rodando…"
              : pedidoRecente
                ? "Pedido enviado"
                : "Recalcular"}
          </button>
        ) : null}
        {congeladas.quantidade ? (
          <span className="ui-texto-secundario" data-congeladas>
            <i className="fa-solid fa-lock" aria-hidden="true" /> Notas
            declaradas congeladas em {quando(congeladas.em)}
          </span>
        ) : null}
        {d.pode_coordenar && congeladas.quantidade && !abrirDescongelar ? (
          <button
            type="button"
            className="btn secondary small"
            data-acao="abrir-descongelar"
            onClick={() => setAbrirDescongelar(true)}
          >
            Descongelar
          </button>
        ) : null}
      </section>

      {d.pode_coordenar && congeladas.quantidade && abrirDescongelar ? (
        <section
          className="ui-card avd-inline"
          aria-label="Descongelar as notas declaradas"
        >
          <label className="ui-campo ui-campo-largo">
            <span>Motivo para descongelar</span>
            <input
              type="text"
              maxLength={250}
              value={motivoDescongelar}
              onChange={(ev) => setMotivoDescongelar(ev.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn primary small"
            data-acao="descongelar"
            disabled={
              descongelando ||
              !conferida ||
              d.em_andamento ||
              motivoDescongelar.trim().length < 10
            }
            onClick={() => void descongelar()}
          >
            {descongelando ? "Descongelando…" : "Descongelar e recalcular"}
          </button>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => {
              setAbrirDescongelar(false);
              setMotivoDescongelar("");
            }}
          >
            Cancelar
          </button>
        </section>
      ) : null}

      {p.aviso ? (
        <Aviso
          tom={p.aviso.tom === "info" ? undefined : p.aviso.tom}
          papel={p.aviso.tom === "danger" ? "alert" : "status"}
        >
          {p.aviso.texto}
        </Aviso>
      ) : null}
      {d.pode_coordenar && !conferida ? (
        <Aviso tom="warning">
          {d.regra
            ? "Marque a regra como conferida na aba Regra para recalcular."
            : "Crie a regra na aba Regra para recalcular."}
        </Aviso>
      ) : null}
      {situacaoDoEdital && SITUACOES_DO_EDITAL[situacaoDoEdital] ? (
        <Aviso tom="warning">
          {SITUACOES_DO_EDITAL[situacaoDoEdital]}
          {ultima?.edital?.mensagem ? ` ${ultima.edital.mensagem}` : ""}
        </Aviso>
      ) : null}

      <ListasOficiais d={d} p={p} pre={pre} />

      {vagas.length ? (
        vagas.map((v) => (
          <VagaDaPre
            key={v.codigo}
            v={v}
            configuracao={configuracao}
            podeCoordenar={d.pode_coordenar}
            tamanho={tamanhos[v.codigo]}
            pre={pre}
            aoMudarTamanho={(codigo, valor) =>
              setTamanhos((t) => ({ ...t, [codigo]: valor }))
            }
          />
        ))
      ) : (
        <p className="ui-texto-secundario">
          Nenhuma vaga da Empregare neste edital.
        </p>
      )}

      {d.pode_coordenar && mudou ? (
        <section
          className="ui-card avd-inline"
          aria-label="Salvar os tamanhos do lote"
        >
          <label className="ui-campo ui-campo-largo">
            <span>Motivo da mudança</span>
            <input
              type="text"
              maxLength={2000}
              value={motivo}
              onChange={(ev) => setMotivo(ev.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn primary small"
            data-acao="salvar-tamanhos"
            disabled={e.salvando || motivo.trim().length < 10}
            onClick={() => void salvarTamanhos()}
          >
            Salvar tamanhos
          </button>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => setTamanhos({})}
          >
            Desfazer
          </button>
          {erroAoSalvar ? (
            <Aviso tom="danger" papel="alert">
              {erroAoSalvar}
            </Aviso>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
