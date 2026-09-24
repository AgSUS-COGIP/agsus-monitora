import {
  StrictMode,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { safeHttpUrl } from "../../lib/sanitize.js";
import {
  canImportApprovedList,
  canManageEditais,
} from "../../lib/access-roles.js";
import {
  alertaDoTipo,
  filtrarEditais,
  formatarNumero,
  indexarResumo,
  passaNoFiltroOperacional,
  resumoDoEdital,
  tomDoRisco,
  tomDoStatusDoEdital,
} from "../../lib/editais-do-nucleo.js";
import {
  assinarDadosDoMonitoramento,
  obterDadosDoMonitoramento,
} from "../dados-do-monitoramento.js";
import { criarEstadoDoNucleo } from "./estado.js";
import { ModalDoEdital } from "./modal-do-edital.jsx";
import { ModalLinhaDoTempo } from "./modal-linha-do-tempo.jsx";
import { PainelOperacional } from "./painel-operacional.jsx";

/*
  "Editais" (Equipe Núcleo), em React — a página `#page-nucleo` e os seus
  modais: o formulário do edital com o cronograma e a linha do tempo.

  O React é dono de tudo dentro da `<section>`; o legado só troca a classe
  `.active` dela e chama `render()` do controlador
  (`window.nucleoController`) ao abrir a página. As linhas são as mesmas do
  mapa, carregadas pelo legado e publicadas em `dados-do-monitoramento.js`.

  O corpo da tabela mantém o id `nucleoRows`: a AYA lê as linhas dali para
  saber o que está na tela.
*/

const COLUNAS = 9;

function Chip({ tom, children }) {
  return <span className={`chip ${tom}`}>{children}</span>;
}

function LinhaDoEdital({ linha, item, perfil, estado }) {
  const url = safeHttpUrl(linha.link_edital);
  const nome = linha.edital || linha.unidade;
  const podeEditar = canManageEditais(perfil);
  const podeListas = canImportApprovedList(perfil);
  const alerta =
    item && item.alerta_tipo !== "ok" ? alertaDoTipo(item.alerta_tipo) : null;

  return (
    <tr
      data-record-id={linha.id}
      data-monitoramento-id={item?.id ?? undefined}
      data-alert-type={item?.alerta_tipo ?? undefined}
    >
      <td>{linha.unidade}</td>
      <td>
        {url ? (
          <a className="link" href={url} target="_blank" rel="noopener">
            {linha.edital || "-"}
          </a>
        ) : (
          linha.edital || "-"
        )}
      </td>
      <td>
        <Chip tom={tomDoStatusDoEdital(linha.status)}>
          {linha.status || "-"}
        </Chip>
      </td>
      <td>
        {linha.etapa}
        {alerta ? (
          <div className={`nucleo-row-alert tone-${alerta.tone}`}>
            <i className={`fa-solid ${alerta.icon}`} aria-hidden="true" />
            <span>{alerta.label}</span>
          </div>
        ) : null}
      </td>
      <td className="num">{formatarNumero(linha.vagas_total)}</td>
      <td className="num green-text">{formatarNumero(linha.contratados)}</td>
      <td className="num red-text">{formatarNumero(linha.vagas_ociosas)}</td>
      <td>
        <Chip tom={tomDoRisco(linha.risco)}>{linha.risco || "-"}</Chip>
      </td>
      <td style={{ textAlign: "center" }}>
        <div className="nucleo-row-actions">
          {podeEditar ? (
            <button
              className="btn icon outline"
              type="button"
              title="Editar registro"
              aria-label={`Editar ${nome}`}
              onClick={() => estado.abrirEdital(linha.id)}
            >
              <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
            </button>
          ) : null}
          {podeListas ? (
            <button
              className="btn icon outline"
              type="button"
              title="Lista de aprovados"
              aria-label={`Lista de aprovados de ${nome}`}
              onClick={() =>
                void window.aprovadosController?.openImportModal(
                  linha.id,
                  [linha.edital, linha.unidade].filter(Boolean).join(" · "),
                )
              }
            >
              <i className="fa-solid fa-file-arrow-up" aria-hidden="true" />
            </button>
          ) : null}
          {item ? (
            <button
              type="button"
              className="btn icon outline nucleo-view-timeline"
              title="Ver cronograma"
              aria-label={`Ver cronograma ${item.edital || ""}`}
              onClick={() => estado.abrirLinhaDoTempo(item.id)}
            >
              <i className="fa-solid fa-timeline" aria-hidden="true" />
            </button>
          ) : null}
          {!podeEditar && !podeListas && !item ? (
            <span className="approved-no-action">—</span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function ModalAberto({ estado, modal, agora }) {
  if (modal?.tipo === "edital")
    return (
      <ModalDoEdital
        key={modal.abertura}
        estado={estado}
        id={modal.id}
        agora={agora}
      />
    );
  if (modal?.tipo === "linha-do-tempo")
    return (
      <ModalLinhaDoTempo
        key={modal.abertura}
        estado={estado}
        id={modal.id}
        agora={agora}
      />
    );
  return null;
}

export function Nucleo({ estado, agora }) {
  const { linhas, carregado } = useSyncExternalStore(
    assinarDadosDoMonitoramento,
    obterDadosDoMonitoramento,
  );
  const nucleo = useSyncExternalStore(estado.assinar, estado.obter);
  const [busca, setBusca] = useState("");

  const indice = useMemo(() => indexarResumo(nucleo.resumo), [nucleo.resumo]);
  const editais = useMemo(() => filtrarEditais(linhas, busca), [linhas, busca]);
  const visiveis = useMemo(
    () =>
      editais
        .map((linha) => ({ linha, item: resumoDoEdital(indice, linha) }))
        .filter(({ item }) => passaNoFiltroOperacional(item, nucleo.filtro)),
    [editais, indice, nucleo.filtro],
  );

  // As linhas novas precisam dos rótulos do modo cartão (≤ 900px).
  useEffect(() => {
    document.dispatchEvent(new CustomEvent("agsus:content-updated"));
  }, [visiveis]);

  return (
    <>
      <div className="table-card card wide-table">
        <div className="table-head">
          <h3>
            <i className="fa-solid fa-pen-to-square" aria-hidden="true" />{" "}
            Controle de editais
          </h3>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              id="nucleoSearch"
              type="search"
              placeholder="Pesquisar edital, unidade, status..."
              aria-label="Pesquisar edital, unidade, status, etapa ou risco"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
            {canManageEditais(nucleo.perfil) ? (
              <button
                id="newEditalBtn"
                className="btn green"
                type="button"
                onClick={() => estado.abrirEdital()}
              >
                + Novo
              </button>
            ) : null}
          </div>
        </div>
        <div className="table-meta">
          Campos calculados automaticamente não podem ser editados.
        </div>
        <PainelOperacional estado={estado} nucleo={nucleo} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Unidade</th>
                <th>Edital</th>
                <th>Status</th>
                <th>Etapa</th>
                <th className="num">Vagas</th>
                <th className="num">Contratados</th>
                <th className="num">Ociosas</th>
                <th>Risco</th>
                <th style={{ textAlign: "center" }}>Ações</th>
              </tr>
            </thead>
            <tbody id="nucleoRows">
              {!carregado ? (
                <tr>
                  <td
                    colSpan={COLUNAS}
                    style={{ textAlign: "center", padding: 22 }}
                  >
                    Carregando editais...
                  </td>
                </tr>
              ) : visiveis.length ? (
                visiveis.map(({ linha, item }) => (
                  <LinhaDoEdital
                    key={linha.id}
                    linha={linha}
                    item={item}
                    perfil={nucleo.perfil}
                    estado={estado}
                  />
                ))
              ) : (
                <tr>
                  <td
                    colSpan={COLUNAS}
                    style={{ textAlign: "center", padding: 22 }}
                  >
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ModalAberto estado={estado} modal={nucleo.modal} agora={agora} />
    </>
  );
}

/**
 * Monta a página em `#page-nucleo` e devolve o controlador que o legado chama
 * (`window.nucleoController`): `render()` ao abrir a página.
 */
export function montarNucleo({
  secao = document.getElementById("page-nucleo"),
  supabase = getSupabaseClient(),
  toast,
  loader,
  getProfile,
  confirmar,
  aoSalvar,
  agora,
} = {}) {
  const estado = criarEstadoDoNucleo({
    supabase,
    toast,
    loader,
    getProfile,
    confirmar,
    aoSalvar,
  });
  let raiz = null;
  if (secao) {
    raiz = createRoot(secao);
    raiz.render(
      <StrictMode>
        <Nucleo estado={estado} agora={agora} />
      </StrictMode>,
    );
  }
  return {
    estado,
    raiz,
    /* Ao abrir a página: relê o perfil e pede o resumo (com cache curto). */
    render() {
      estado.sincronizarPerfil();
      return estado.carregarResumo().catch(() => {});
    },
    abrirEdital: estado.abrirEdital,
  };
}
