import { StrictMode, useMemo, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { canManageSubJudice } from "../../lib/access-roles.js";
import {
  candidateCargosForEdital,
  candidateModalidadesForEdital,
  filterApprovedCandidates,
  manterSoAsOpcoes,
  opcoesDeEdital,
  paginateApprovedCandidates,
} from "../../lib/lista-aprovados-rules.js";
import { PLANILHAS } from "../../lib/planilhas.js";
import { soDosEditais } from "../dados-do-monitoramento.js";
import { usarAreaAtual } from "../usar-area-atual.js";
import { AbaAprovados } from "./aba-aprovados.jsx";
import { AbaConvocacao } from "./aba-convocacao.jsx";
import { criarEstadoDaListaDeAprovados } from "./estado.js";
import { ModalDeStatus, ModalSubJudice } from "./modais.jsx";
import { ModalListasDoEdital } from "./modal-listas-do-edital.jsx";
import { classes, plural } from "./partes.jsx";

/*
  Lista de Aprovados, em React — a página `#page-approved` e os seus modais.

  O React é dono de tudo dentro da `<section>`; o legado só troca a classe
  `.active` dela e fala com o controlador (`window.aprovadosController`):
  `render()` ao abrir a página e `openImportModal(id, rótulo)` pelo botão de
  listas da tabela do Núcleo.

  Os dados (candidatos, listas, configuração de convocação) e as ações vivem em
  `estado.js`; as duas abas leem os mesmos candidatos, então mudar o status de
  alguém numa redesenha a outra. Os modais são portais no fim do `body`.
*/

/** Linhas por página da tabela; tem de ser um dos tamanhos de `Paginacao`. */
const TAMANHO_PADRAO = 50;
const FILTROS_INICIAIS = Object.freeze({
  editalId: [],
  cargo: [],
  modalidade: [],
  status: [],
});

const ABAS = [
  {
    nome: "aprovados",
    id: "approvedTabAprovados",
    painel: "approvedPanelAprovados",
    icone: "fa-user-check",
    rotulo: "aprovados",
  },
  {
    nome: "convocacao",
    id: "approvedTabConvocacao",
    painel: "approvedPanelConvocacao",
    icone: "fa-bullhorn",
    rotulo: "convocação",
  },
];

function ModalAberto({ estado, dados, daArea }) {
  const { modal } = dados;
  if (!modal) return null;
  if (modal.tipo === "status") {
    const candidato = dados.candidatos.find(
      (row) => String(row.candidato_id) === modal.candidatoId,
    );
    return candidato ? (
      <ModalDeStatus
        key={modal.abertura}
        estado={estado}
        candidato={candidato}
      />
    ) : null;
  }
  if (modal.tipo === "sub-judice")
    return (
      <ModalSubJudice
        key={modal.abertura}
        estado={estado}
        listas={daArea.listas}
        candidatos={daArea.candidatos}
      />
    );
  if (modal.tipo === "listas")
    return (
      <ModalListasDoEdital
        key={modal.abertura}
        estado={estado}
        dados={dados}
        editalId={modal.editalId}
        rotulo={modal.rotulo}
      />
    );
  return null;
}

export function ListaAprovados({ estado }) {
  const dados = useSyncExternalStore(estado.assinar, estado.obter);
  const { carregado, perfil } = dados;
  /*
    Só as listas e os candidatos dos editais da área escolhida no menu — o
    seletor de edital, os filtros, as duas abas e o sub judice partem daqui. O
    modal de listas aberto pelo Núcleo é de um edital certo e continua a ver
    tudo.
  */
  const { ids } = usarAreaAtual();
  const listas = useMemo(
    () => soDosEditais(dados.listas, ids),
    [dados.listas, ids],
  );
  const candidatos = useMemo(
    () => soDosEditais(dados.candidatos, ids),
    [dados.candidatos, ids],
  );
  const [aba, setAba] = useState("aprovados");
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  /*
    Página da tabela, começando em 1. Filtrar volta sempre à primeira: filtrar
    estando na página 7 e continuar na 7 mostra uma tabela vazia, ou um pedaço
    do meio do resultado — nos dois casos parece que a busca não encontrou nada.
  */
  const [pagina, setPagina] = useState(1);
  const [tamanho, setTamanho] = useState(TAMANHO_PADRAO);

  /*
    Cargo e modalidade só oferecem o que existe nos editais escolhidos, e o que
    deixou de ser opção deixa de filtrar — estaria a esconder linhas sem
    aparecer na tela.
  */
  const opcoesEditais = useMemo(() => opcoesDeEdital(listas), [listas]);
  const editais = manterSoAsOpcoes(filtros.editalId, opcoesEditais);
  const chaveDosEditais = editais.join("\u0000");
  const opcoes = useMemo(
    () => ({
      editais: opcoesEditais,
      cargos: candidateCargosForEdital(candidatos, editais),
      modalidades: candidateModalidadesForEdital(candidatos, editais),
    }),
    [candidatos, opcoesEditais, chaveDosEditais],
  );
  const efetivos = {
    editalId: editais,
    cargo: manterSoAsOpcoes(filtros.cargo, opcoes.cargos),
    modalidade: manterSoAsOpcoes(filtros.modalidade, opcoes.modalidades),
    status: filtros.status,
  };
  const chaveDosFiltros = JSON.stringify(efetivos);
  const filtrados = useMemo(
    () => filterApprovedCandidates(candidatos, efetivos),
    [candidatos, chaveDosFiltros],
  );
  // `paginate` corrige a página: filtrar pode ter encurtado a lista para aquém da aberta.
  const paginaAtual = useMemo(
    () => paginateApprovedCandidates(filtrados, pagina, tamanho),
    [filtrados, pagina, tamanho],
  );

  function mudarFiltro(campo, valores) {
    setFiltros((atuais) => {
      const proximos = { ...atuais, [campo]: valores };
      if (campo === "editalId") {
        proximos.cargo = manterSoAsOpcoes(
          atuais.cargo,
          candidateCargosForEdital(candidatos, valores),
        );
        proximos.modalidade = manterSoAsOpcoes(
          atuais.modalidade,
          candidateModalidadesForEdital(candidatos, valores),
        );
      }
      return proximos;
    });
    setPagina(1);
  }

  function irPara(destino) {
    const alvo = paginateApprovedCandidates(filtrados, destino, tamanho).page;
    if (alvo === paginaAtual.page) return false;
    setPagina(alvo);
    return true;
  }

  const podeSubJudice = canManageSubJudice(perfil);
  const temListaAtiva = listas.some((item) => item.ativo);

  return (
    <>
      <div className="table-card card approved-page-card">
        <div className="table-head approved-page-head">
          <div>
            <h3>
              <i className="fa-solid fa-user-check" aria-hidden="true" /> Lista
              de Aprovados
            </h3>
          </div>
          {/*
            O contador e o botão de sub judice falam da lista de aprovados.
            Deixá-los visíveis na outra aba prometeria uma ação que não
            pertence àquela tabela.
          */}
          <div
            className={classes(
              "approved-head-actions",
              aba !== "aprovados" && "hidden",
            )}
            id="approvedHeadActions"
          >
            <span id="approvedCount" className="chip blue">
              {carregado
                ? plural(filtrados.length, "candidato", "candidatos")
                : "Carregando…"}
            </span>
            {podeSubJudice ? (
              <button
                id="approvedAddSubJudiceBtn"
                className="btn green"
                type="button"
                disabled={!temListaAtiva}
                title={
                  temListaAtiva
                    ? "Incluir candidato sub judice"
                    : "É necessário ter uma lista ativa"
                }
                onClick={estado.abrirSubJudice}
              >
                <i className="fa-solid fa-user-plus" aria-hidden="true" />{" "}
                Incluir sub judice
              </button>
            ) : null}
          </div>
        </div>
        <div
          className="approved-tabs"
          role="tablist"
          aria-label="Visões da lista do edital"
        >
          {ABAS.map((item) => (
            <button
              key={item.nome}
              id={item.id}
              className={classes("approved-tab", aba === item.nome && "active")}
              type="button"
              role="tab"
              aria-selected={aba === item.nome}
              aria-controls={item.painel}
              data-approved-tab={item.nome}
              onClick={() => setAba(item.nome)}
            >
              <i className={`fa-solid ${item.icone}`} aria-hidden="true" />{" "}
              <span className="approved-tab-prefixo">Lista de </span>
              {item.rotulo}
            </button>
          ))}
        </div>
        <AbaAprovados
          ativa={aba === "aprovados"}
          estado={estado}
          perfil={perfil}
          candidatos={candidatos}
          carregado={carregado}
          opcoes={opcoes}
          filtros={efetivos}
          aoMudarFiltro={mudarFiltro}
          pagina={paginaAtual}
          tamanho={tamanho}
          aoIrPara={irPara}
          aoMudarTamanho={(valor) => {
            setTamanho(valor);
            setPagina(1);
          }}
        />
        <AbaConvocacao
          ativa={aba === "convocacao"}
          estado={estado}
          perfil={perfil}
          candidatos={candidatos}
          listas={listas}
          configs={dados.configs}
          modelos={dados.modelos}
          carregado={carregado}
        />
      </div>
      <ModalAberto
        estado={estado}
        dados={dados}
        daArea={{ listas, candidatos }}
      />
    </>
  );
}

/**
 * Monta a página em `#page-approved` e devolve o controlador que o legado
 * chama (`window.aprovadosController`).
 */
export function montarListaAprovados({
  secao = document.getElementById("page-approved"),
  supabase = getSupabaseClient(),
  toast,
  loader,
  getProfile,
  confirmar,
  lerPlanilha,
} = {}) {
  const estado = criarEstadoDaListaDeAprovados({
    supabase,
    toast,
    loader,
    getProfile,
    confirmar,
    lerPlanilha,
  });
  let raiz = null;
  if (secao) {
    raiz = createRoot(secao);
    raiz.render(
      <StrictMode>
        <ListaAprovados estado={estado} />
      </StrictMode>,
    );
  }
  return {
    estado,
    raiz,
    render: () => estado.garantirCarregado(),
    refresh: (opcoes = {}) =>
      estado.carregar({ comLoader: opcoes.loader !== false }),
    openImportModal: (editalId, rotulo = "") =>
      estado.abrirListasDoEdital(editalId, rotulo),
    closeImportModal: estado.fecharModal,
    openStatusModal: estado.abrirStatus,
    openSubJudiceModal: estado.abrirSubJudice,
    modelUrl: PLANILHAS.modeloListaAprovados.url,
  };
}
