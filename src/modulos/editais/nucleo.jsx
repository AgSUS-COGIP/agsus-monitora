import { useMemo, useSyncExternalStore } from "react";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { safeHttpUrl } from "../../lib/sanitize.js";
import {
  canImportApprovedList,
  canManageEditais,
} from "../../lib/access-roles.js";
import { formatarDataHora } from "../../lib/cronograma-do-edital.js";
import {
  alertaDoTipo,
  filtrarEditais,
  formatarNumero,
  indexarResumo,
  passaNoFiltroOperacional,
  resumoDasLinhas,
  resumoDoEdital,
  tomDoRisco,
  tomDoStatusDoEdital,
} from "../../lib/editais-do-nucleo.js";
import { formatNumberBR } from "../../lib/formatters.js";
import { usarAreaAtual } from "../../componentes/usar-area-atual.js";
import { Selo, TabelaInfinita, TopoDoPainel } from "../../ui/index.js";
import { abrirConversaDoEdital } from "../chat/ponte.js";
import { usarChatLiberado } from "../chat/usar-chat-liberado.js";
import { criarEstadoDoNucleo } from "./estado.js";
import { PainelOperacional } from "./painel-operacional.jsx";
import { ModalDoEdital } from "./modal-do-edital.jsx";
import { ModalLinhaDoTempo } from "./modal-linha-do-tempo.jsx";

/*
  Editais (view `nucleo`), módulo do app — a página `#page-nucleo` e os seus
  modais: o formulário do edital com o cronograma e a linha do tempo.

  O React é dono de tudo dentro da `<section>`; o legado só troca a classe
  `.active` dela e chama `render()` do controlador
  (`window.nucleoController`) ao abrir a página. As linhas são as mesmas do
  mapa, carregadas pelo legado e publicadas em `dados-do-monitoramento.js`.

  Padrão das telas de src/modulos/: topo com a data do resumo, Atualizar e
  "Novo edital"; os indicadores (KPIs que filtram); a tabela de carregamento
  contínuo (TabelaInfinita) com a busca. Antes da primeira carga, KPIs e
  linhas são skeleton.

  O corpo da tabela mantém o id `nucleoRows`: a AYA lê as linhas dali para
  saber o que está na tela.
*/

/* As cores de antes (`.chip.<tom>`, editais-do-nucleo.js) no tom do Selo. */
const SELO = {
  green: "aprovado",
  red: "reprovado",
  yellow: "pendente",
  blue: "revisar",
  cyan: "revisar",
};

const COLUNAS = [
  { rotulo: "Unidade", largura: "16%" },
  { rotulo: "Edital", largura: "12%" },
  { rotulo: "Status", largura: "11%" },
  { rotulo: "Etapa", largura: "19%" },
  { rotulo: "Vagas", largura: "7%", numero: true },
  { rotulo: "Contratados", largura: "8%", numero: true },
  { rotulo: "Ociosas", largura: "7%", numero: true },
  { rotulo: "Risco", largura: "8%" },
  { rotulo: "Ações", largura: "12%" },
];

/* A busca da tabela: edital, unidade, status, etapa, risco ou processo. */
function pelaBusca(itens, busca) {
  if (!String(busca ?? "").trim()) return itens;
  const achadas = new Set(
    filtrarEditais(
      itens.map(({ linha }) => linha),
      busca,
    ),
  );
  return itens.filter(({ linha }) => achadas.has(linha));
}

function textoDoStatus(nucleo, carregado) {
  if (!nucleo.carregadoEm)
    return carregado && nucleo.statusDoResumo === "error"
      ? "Alertas indisponíveis"
      : "Carregando dados...";
  if (nucleo.atualizandoResumo) return "Atualizando...";
  return `Atualizado em ${formatarDataHora(nucleo.carregadoEm)}`;
}

function LinhaDoEdital({ linha, item, perfil, estado, chat }) {
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
      <td>
        <span className="ui-texto-principal">{linha.unidade}</span>
      </td>
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
        <Selo tom={SELO[tomDoStatusDoEdital(linha.status)]}>
          {linha.status || "-"}
        </Selo>
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
      <td className="num editais-contratados">
        {formatarNumero(linha.contratados)}
      </td>
      <td className="num editais-ociosas">
        {formatarNumero(linha.vagas_ociosas)}
      </td>
      <td>
        <Selo tom={SELO[tomDoRisco(linha.risco)]}>{linha.risco || "-"}</Selo>
      </td>
      <td>
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
          {chat ? (
            <button
              type="button"
              className="btn icon outline nucleo-conversa"
              title="Conversa"
              aria-label={`Conversa do edital ${nome || ""}`}
              onClick={() =>
                abrirConversaDoEdital({
                  id: linha.id,
                  titulo: linha.edital || linha.unidade,
                })
              }
            >
              <i className="fa-solid fa-comments" aria-hidden="true" />
            </button>
          ) : null}
          {!podeEditar && !podeListas && !item && !chat ? (
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
  // Só os editais da área escolhida no menu; os indicadores contam os mesmos.
  const { linhas, carregado } = usarAreaAtual();
  const doResumo = useSyncExternalStore(estado.assinar, estado.obter);
  const resumoDaArea = useMemo(
    () => resumoDasLinhas(doResumo.resumo, linhas),
    [doResumo.resumo, linhas],
  );
  const nucleo = useMemo(
    () => ({ ...doResumo, resumo: resumoDaArea }),
    [doResumo, resumoDaArea],
  );

  const indice = useMemo(() => indexarResumo(nucleo.resumo), [nucleo.resumo]);
  // A ordem é a de sempre (filtrarEditais ordena); a busca recorta depois.
  const editais = useMemo(() => filtrarEditais(linhas, ""), [linhas]);
  const noFiltro = useMemo(
    () =>
      editais
        .map((linha) => ({ linha, item: resumoDoEdital(indice, linha) }))
        .filter(({ item }) => passaNoFiltroOperacional(item, nucleo.filtro)),
    [editais, indice, nucleo.filtro],
  );
  const podeEditar = canManageEditais(nucleo.perfil);
  const chat = usarChatLiberado();

  return (
    <div className="ui-tela editais-tela">
      <TopoDoPainel
        status={textoDoStatus(nucleo, carregado)}
        aoAtualizar={() =>
          void estado.carregarResumo({ force: true }).catch(() => {})
        }
        idDaAtualizacao="nucleoOperationalRefresh"
        atualizarDesativado={nucleo.atualizandoResumo}
      >
        {podeEditar ? (
          <button
            id="newEditalBtn"
            className="btn green"
            type="button"
            onClick={() => estado.abrirEdital()}
          >
            <i className="fa-solid fa-plus" aria-hidden="true" /> Novo edital
          </button>
        ) : null}
      </TopoDoPainel>

      <PainelOperacional estado={estado} nucleo={nucleo} />

      <TabelaInfinita
        idDoTitulo="editaisTabelaTitulo"
        titulo="Controle de editais"
        className="nucleo-page-card"
        idDoCorpo="nucleoRows"
        busca={{
          id: "nucleoSearch",
          placeholder: "Pesquisar edital, unidade, status...",
          rotulo: "Pesquisar edital, unidade, status, etapa ou risco",
        }}
        carregado={carregado}
        itens={noFiltro}
        filtrarPelaBusca={pelaBusca}
        colunas={COLUNAS}
        classeDaTabela="editais-tabela"
        linha={({ linha, item }) => (
          <LinhaDoEdital
            key={linha.id}
            linha={linha}
            item={item}
            perfil={nucleo.perfil}
            estado={estado}
            chat={chat}
          />
        )}
        total={noFiltro.length}
        vazio="Nenhum registro encontrado."
        informacao={(quantos) =>
          quantos === null
            ? "Carregando…"
            : `${formatNumberBR(quantos)} ${quantos === 1 ? "edital" : "editais"}`
        }
      />

      <ModalAberto estado={estado} modal={nucleo.modal} agora={agora} />
    </div>
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
  const raiz = secao
    ? montarModulo(secao, <Nucleo estado={estado} agora={agora} />, {
        nome: "a tela de editais",
      }).raiz
    : null;
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
