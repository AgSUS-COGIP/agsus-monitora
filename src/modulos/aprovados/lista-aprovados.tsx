import { rotuloDaCopia } from "../../lib/carga/rotulo-da-copia.ts";
import type {
  EstadoDosAprovados,
  SnapshotDosAprovados,
  OpcoesDaTelaDosAprovados,
  CandidatoAprovado,
  ListaDeAprovados,
} from "./tipos-do-estado.ts";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  usarPedidoDeFiltro,
  type FiltroDoPedido,
} from "../../app/pedido-de-filtro.ts";
import {
  usarFiltrosNaUrl,
  usarLojaNaUrl,
} from "../../app/usar-filtros-na-url.ts";
import type { EsquemaDosFiltros } from "../../app/filtros-no-endereco.ts";
import { filtrosDosAprovados } from "../../lib/aya/filtro-da-aya.ts";
import { getSupabaseClient } from "../../lib/sessao/supabaseClient";
import {
  canAlterarPorDecisaoJudicial,
  canChangeCandidateStatus,
  canManageSubJudice,
} from "../../lib/acessos/access-roles.ts";
import { CHAVE_DO_CABECALHO } from "../../lib/base/cabecalho-dos-documentos.ts";
import { estadoDasConfiguracoes } from "../configuracoes/estado.ts";
import { PLANILHAS } from "../../lib/base/planilhas.ts";
import { formatarDataHora } from "../../lib/cronograma/cronograma-do-edital.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import {
  AtivosEHistorico,
  classes,
  ContagemDaAba,
  ErroAoCarregar,
  TopoDoPainel,
  usarNavegacaoDaLista,
  type PropriedadesDaNavegacaoDaFicha,
} from "../../ui/index.ts";
import {
  ordenarAprovados,
  proximaOrdemDosAprovados,
  SEM_ORDEM,
  type ChaveDaOrdemDosAprovados,
  type OrdemDosAprovados,
} from "../../lib/aprovados/ordem-dos-aprovados.ts";
import { vistaDoPedido } from "../../lib/aprovados/ativos-e-historico-dos-aprovados.ts";
import type { VistaDaLista } from "../../lib/base/ativos-e-historico.ts";
import { tomDaSituacaoDoEdital } from "../../lib/editais/editais-ativos.ts";
import { FluxoDasEtapas } from "../../componentes/fluxo-das-etapas.tsx";
import { AbaAprovados, pelaBusca } from "./aba-aprovados.tsx";
import { AbaConvocacao } from "./aba-convocacao.tsx";
import type { EditalPedidoDaCentral } from "./central-de-convocacoes.tsx";
import {
  ehAbaDosAprovados,
  ehTipoDaCentral,
  type AbaDosAprovados,
  type TipoDaCentralDeConvocacoes,
} from "../../lib/aprovados/central-de-convocacoes.ts";
import {
  FILTROS_INICIAIS,
  usarRecorteDosAprovados,
} from "./recorte-dos-aprovados.ts";
import { VerEmRelatorios } from "../../componentes/ver-em-relatorios.tsx";
import { criarEstadoDaListaDeAprovados } from "./estado.js";
import { ModalDeAnexos, ModalDeStatus, ModalSubJudice } from "./modais.tsx";
import { ModalListasDoEdital } from "./modal-listas-do-edital.tsx";
import { GavetaDoCandidato } from "./gaveta-do-candidato.tsx";
import { ModalDaCarta } from "./carta-de-convocacao/modal-da-carta.tsx";
import { ModelosDaCarta } from "./carta-de-convocacao/modelos-da-carta.tsx";
import { plural } from "./partes.tsx";
import { SeloDeAvisos } from "../conferencias/avisos-de-conferencia.tsx";
import {
  ResultadosForaDaLista,
  type ClienteDoAvisoDeResultados,
} from "./resultados-fora-da-lista.tsx";
import { AbaPendencias, usarPendencias } from "./pendencias/aba-pendencias.tsx";
import {
  criarEstadoDasPendencias,
  type EstadoDasPendencias,
} from "./pendencias/estado-das-pendencias.ts";
import { contarAbertas } from "../../lib/aprovados/pendencias-do-edital.ts";
import { hojeEmBrasilia } from "../../lib/aprovados/carta-de-convocacao/carta-de-convocacao.ts";
import { montarPedidoDaExportacao } from "../../lib/aprovados/exportacao/exportacao-da-lista-de-aprovados.ts";
import { ModalDaExportacao } from "./exportacao/modal-da-exportacao.tsx";
import "./convocacao.css";
import "./carta-de-convocacao/carta.css";

/*
  Lista de aprovados (view `approved`), módulo do app — a página
  `#page-approved` e os seus modais.

  O React é dono de tudo dentro da `<section>`; a rota (src/app/telas.tsx)
  chama `render()` ao abrir a página, e Editais chama `openImportModal(id,
  rótulo)` pelo registro das telas (botão de listas da tabela).

  Padrão das telas de src/modulos/: topo com as duas visões (abas com o visual
  do controle segmentado), a data da carga e Atualizar; KPIs compactos;
  filtros recolhíveis; skeleton antes da primeira carga e, se ela falha, um
  aviso com "Tentar novamente".

  Os dados (candidatos, listas, configuração de convocação) e as ações vivem em
  `estado.ts`; as duas abas leem os mesmos candidatos, então mudar o status de
  alguém numa redesenha a outra. Os modais são portais no fim do `body`.
*/

const ABAS: {
  nome: AbaDosAprovados;
  id: string;
  painel: string;
  icone: string;
  rotulo: string;
}[] = [
  {
    nome: "aprovados",
    id: "approvedTabAprovados",
    painel: "approvedPanelAprovados",
    icone: "fa-user-check",
    rotulo: "Aprovados",
  },
  {
    nome: "convocacao",
    id: "approvedTabConvocacao",
    painel: "approvedPanelConvocacao",
    icone: "fa-bullhorn",
    rotulo: "Convocação",
  },
  {
    nome: "pendencias",
    id: "approvedTabPendencias",
    painel: "approvedPanelPendencias",
    icone: "fa-list-check",
    rotulo: "Pendências",
  },
];

function textoDoStatus({
  carregado,
  erroAoCarregar,
  carregadoEm,
  copiaDe,
  acao,
}: SnapshotDosAprovados) {
  if (erroAoCarregar && !carregado) return "Sem dados";
  if (!carregado) return "Carregando dados…";
  if (acao) return "Atualizando…";
  if (copiaDe) return rotuloDaCopia(copiaDe);
  return carregadoEm
    ? `Atualizado em ${formatarDataHora(carregadoEm)}`
    : "Base carregada";
}

/*
  As visões: abas (tablist) com o visual do controle segmentado. A contagem
  ao lado do rótulo (ContagemDaAba): os aprovados no recorte e as pendências
  abertas (em alerta); some no zero.
*/
function Visoes({
  aba,
  aoMudar,
  aprovados = 0,
  pendencias = 0,
}: {
  aba: AbaDosAprovados;
  aoMudar: (aba: AbaDosAprovados) => void;
  /** Candidatos no recorte da aba Aprovados. */
  aprovados?: number;
  /** Pendências abertas. */
  pendencias?: number;
}) {
  return (
    <div
      className="ui-segmentado approved-visoes"
      data-tour="aprovados-visoes"
      role="tablist"
      aria-label="Visões da lista do edital"
    >
      {ABAS.map((item) => (
        <button
          key={item.nome}
          id={item.id}
          className={classes(
            "ui-segmentado-opcao",
            aba === item.nome && "is-ativo",
          )}
          type="button"
          role="tab"
          aria-selected={aba === item.nome}
          aria-controls={item.painel}
          data-approved-tab={item.nome}
          data-tour={`aprovados-aba-${item.nome}`}
          onClick={() => aoMudar(item.nome)}
        >
          <i className={`fa-solid ${item.icone}`} aria-hidden="true" />
          {item.rotulo}
          {item.nome === "aprovados" ? (
            <ContagemDaAba valor={aprovados} id="approvedAprovadosContagem" />
          ) : null}
          {item.nome === "pendencias" ? (
            <ContagemDaAba
              valor={pendencias}
              tom="alerta"
              id="approvedPendenciasSelo"
            />
          ) : null}
        </button>
      ))}
    </div>
  );
}

function ModalAberto({
  estado,
  dados,
  daArea,
  navegacao,
}: {
  estado: EstadoDosAprovados;
  dados: SnapshotDosAprovados;
  daArea: { candidatos: CandidatoAprovado[]; listas: ListaDeAprovados[] };
  /** Anterior/Próximo da gaveta do candidato. */
  navegacao?: PropriedadesDaNavegacaoDaFicha;
}) {
  const { modal } = dados;
  if (!modal) return null;
  const candidato = dados.candidatos.find(
    (row) =>
      String(row.candidato_id) ===
      ("candidatoId" in modal ? modal.candidatoId : undefined),
  );
  const anexos =
    dados.anexos.get(
      String("candidatoId" in modal ? modal.candidatoId : undefined),
    ) || [];
  if (modal.tipo === "status")
    return candidato ? (
      <ModalDeStatus
        key={modal.abertura}
        estado={estado}
        perfil={dados.perfil}
        candidato={candidato}
        candidatos={dados.candidatos}
        jaAnexados={anexos.length}
        dataConvocacao={
          dados.convocacoes.get(String(candidato.candidato_id))?.data
        }
      />
    ) : null;
  if (modal.tipo === "candidato")
    return candidato ? (
      // Sem `key`: o Anterior/Próximo troca o candidato com a gaveta aberta.
      <GavetaDoCandidato
        estado={estado}
        navegacao={navegacao}
        perfil={dados.perfil}
        candidato={candidato}
        convocacao={dados.convocacoes.get(String(candidato.candidato_id))}
      />
    ) : null;
  if (modal.tipo === "carta")
    return (
      <ModalDaCarta
        key={modal.abertura}
        estado={estado}
        candidatos={modal.candidatoIds
          .map((id) =>
            dados.candidatos.find((row) => String(row.candidato_id) === id),
          )
          .filter((c): c is CandidatoAprovado => c !== undefined)}
        podeEditarModelos={canChangeCandidateStatus(dados.perfil)}
      />
    );
  if (modal.tipo === "modelos-carta")
    return (
      <ModelosDaCarta
        key={modal.abertura}
        estado={estado}
        listas={daArea.listas}
        candidatos={daArea.candidatos}
      />
    );
  if (modal.tipo === "anexos")
    return candidato ? (
      <ModalDeAnexos
        key={modal.abertura}
        estado={estado}
        perfil={dados.perfil}
        candidato={candidato}
        anexos={anexos}
      />
    ) : null;
  if (modal.tipo === "sub-judice")
    return (
      <ModalSubJudice
        key={modal.abertura}
        estado={estado}
        perfil={dados.perfil}
        aba={modal.aba}
        candidatoId={modal.candidatoId}
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

/* Sem a peça das pendências (testes antigos, uso avulso): uma vazia, sem banco. */
const PENDENCIAS_SEM_BANCO = criarEstadoDasPendencias();

/*
  O recorte das listas no endereço (?listas=inativas, ?listas=todas; sem o
  parâmetro, as ativas): o link copiado abre no mesmo recorte.
*/
const LISTAS_NA_URL: Readonly<Record<VistaDaLista, string>> = Object.freeze({
  ativos: "ativas",
  historico: "inativas",
  todas: "todas",
});
/* Como no painel de Análises (Ativo, Inativo, Todos), com o nome das listas. */
const ROTULOS_DAS_LISTAS = Object.freeze({
  ativos: "Listas ativas",
  historico: "Inativas",
  todas: "Todas",
});
const vistaDaUrl = (valor: string): VistaDaLista =>
  (Object.keys(LISTAS_NA_URL) as VistaDaLista[]).find(
    (vista) => LISTAS_NA_URL[vista] === valor,
  ) ?? "ativos";
const RECORTE_NA_URL: EsquemaDosFiltros<"listas"> = Object.freeze({
  listas: {
    padrao: "ativas",
    aceita: (valor: string) => Object.values(LISTAS_NA_URL).includes(valor),
  },
});
/*
  A aba e o tipo da Central de convocações no endereço
  (?aba=convocacao&tipo=entrevista): o link copiado e o atalho "Ver em
  Convocações" (src/componentes/ver-em-convocacoes.tsx) abrem no bloco certo.
  Trocar de aba ou de tipo é entrada nova no histórico; o recorte das listas
  fica.
*/
const ABA_NA_URL: EsquemaDosFiltros<"aba" | "tipo"> = Object.freeze({
  aba: { padrao: "aprovados", aceita: ehAbaDosAprovados, empilha: true },
  tipo: { padrao: "contratacao", aceita: ehTipoDaCentral, empilha: true },
});
const FICA_NA_TROCA_DE_ABA = Object.freeze(["listas"]);
/* O pedido do "Ver em Convocações" e os demais (constantes: `aceita` é dependência do efeito). */
const DA_CENTRAL = (pedido: FiltroDoPedido) =>
  pedido.convocacao === "entrevista";
const FORA_DA_CENTRAL = (pedido: FiltroDoPedido) => !DA_CENTRAL(pedido);

export function ListaAprovados({
  estado,
  pendencias = PENDENCIAS_SEM_BANCO,
  hoje = hojeEmBrasilia,
  supabase = null,
}: {
  estado: EstadoDosAprovados;
  pendencias?: EstadoDasPendencias;
  hoje?: () => string;
  /** Só para o aviso dos resultados finais fora da lista (listar_editais_classificacao). */
  supabase?: ClienteDoAvisoDeResultados | null;
}) {
  const dados = useSyncExternalStore(estado.assinar, estado.obter);
  const dadosDasPendencias = usarPendencias(pendencias);
  const [editalDaPendencia, setEditalDaPendencia] = useState("");
  const { carregado, erroAoCarregar, perfil } = dados;
  /*
    Só as listas e os candidatos dos editais da área escolhida no menu — o
    seletor de edital, os filtros, as duas abas e o sub judice partem daqui.
    Os candidatos já chegam só da área (o banco recorta); o recorte aqui é o
    mesmo, pelos editais que a tela conhece. O modal de listas aberto pelo
    Núcleo é de um edital certo e vê tudo o que foi carregado — a área atual,
    a mesma do Núcleo.
  */
  const { ids, area, nome, linhas } = usarAreaAtual();
  // O modal do "Exportar" da aba Aprovados (o pedido sai dos filtros da tela).
  const [exportar, setExportar] = useState(false);
  const recorte = usarRecorteDosAprovados(dados, {
    ids,
    linhas,
    chaveDaVista: `yeende:aprovados:vista:${area}`,
  });
  const {
    listas,
    candidatos,
    separados,
    vista,
    setVista,
    listasDaVista,
    candidatosDaVista,
    setFiltros,
    opcoesEditais,
    opcoesDeTodos,
    editais,
    opcoes,
    efetivos,
    filtrosParaExportar,
    filtrados,
    mudarFiltro,
  } = recorte;
  const [naUrl, mudarAbaNaUrl] = usarFiltrosNaUrl(ABA_NA_URL, {
    tela: "approved",
    manter: FICA_NA_TROCA_DE_ABA,
  });
  const aba = naUrl.aba as AbaDosAprovados;
  const tipo = naUrl.tipo as TipoDaCentralDeConvocacoes;
  const setAba = (nova: AbaDosAprovados) => mudarAbaNaUrl({ aba: nova });
  const setTipo = (novo: TipoDaCentralDeConvocacoes) =>
    mudarAbaNaUrl({ tipo: novo });
  // O edital pedido pelo "Ver em Convocações" (vai à central uma vez).
  const [editalDaEntrevista, setEditalDaEntrevista] =
    useState<EditalPedidoDaCentral | null>(null);
  // A busca só da tabela; "Limpar filtros" e o pedido de filtro a limpam.
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<OrdemDosAprovados>(SEM_ORDEM);
  const ordenar = useCallback(
    (chave: ChaveDaOrdemDosAprovados) =>
      setOrdem((atual) => proximaOrdemDosAprovados(atual, chave)),
    [],
  );

  /*
    Anterior/Próximo da gaveta do candidato: a tabela de Aprovados como está
    (filtros, ordem e busca). Aberta da Convocação, a lista é outra: sem
    navegação.
  */
  const naTabela = useMemo(
    () => pelaBusca(ordenarAprovados(filtrados, ordem), busca),
    [filtrados, ordem, busca],
  );
  const navegacao = usarNavegacaoDaLista(
    aba === "aprovados" && dados.modal?.tipo === "candidato" ? naTabela : null,
    dados.modal && "candidatoId" in dados.modal
      ? dados.modal.candidatoId
      : null,
    (candidato) => String(candidato.candidato_id),
    (candidato) => estado.abrirCandidato(String(candidato.candidato_id)),
  );

  const podeSubJudice =
    canManageSubJudice(perfil) || canAlterarPorDecisaoJudicial(perfil);
  const temListaAtiva = listas.some((item) => item.ativo);

  function limparFiltros() {
    recorte.limparFiltros();
    setBusca("");
  }

  // Trocar de vista recomeça os filtros e a busca.
  function aplicarVista(nova: VistaDaLista) {
    if (nova === vista) return;
    recorte.mudarVista(nova);
    setBusca("");
  }
  // A vista no endereço: o link abre no recorte; voltar/avançar o devolve.
  const mudarNaUrl = usarLojaNaUrl(
    RECORTE_NA_URL,
    { listas: LISTAS_NA_URL[vista] },
    (valores) => aplicarVista(vistaDaUrl(valores.listas ?? "")),
    { tela: "approved", pronta: carregado },
  );
  const mudarVista = (nova: VistaDaLista) =>
    mudarNaUrl({ listas: LISTAS_NA_URL[nova] });

  /*
    O "Ver em Convocações" (Classificação, Conduzir) abre a central em "Para
    entrevistas", no edital de lá; a navegação já escreveu o endereço. Não
    espera a lista de aprovados carregar: a central lê a loja de Conduzir.
  */
  usarPedidoDeFiltro(
    "approved",
    true,
    (pedido) => {
      mudarAbaNaUrl(
        { aba: "convocacao", tipo: "entrevista" },
        { substituir: true },
      );
      if (pedido.editalId)
        setEditalDaEntrevista((antes) => ({
          id: String(pedido.editalId),
          vez: (antes?.vez ?? 0) + 1,
        }));
    },
    DA_CENTRAL,
  );
  /*
    Avisos que viraram pendências abrem a aba Pendências no edital;
    demais avisos abrem a aba Aprovados filtrada pela pessoa; um número da
    Visão geral abre a aba Aprovados no edital, com o status do número.
  */
  usarPedidoDeFiltro(
    "approved",
    carregado,
    (pedido) => {
      if (pedido?.pendencias) {
        mudarAbaNaUrl({ aba: "pendencias" }, { substituir: true });
        setEditalDaPendencia(String(pedido.edital || ""));
        return;
      }
      const ids = (pedido?.candidatos || []).map(String).filter(Boolean);
      const doEdital = ids.length
        ? null
        : filtrosDosAprovados(
            pedido,
            opcoesDeTodos.map((o) => ({ valor: o.value, rotulo: o.label })),
          );
      if (!ids.length && !doEdital) return;
      // O edital (ou a pessoa) pedido pode estar no Histórico: abre a vista dele.
      setVista(
        vistaDoPedido(
          separados,
          vista,
          { editalIds: doEdital?.editalId, candidatoIds: ids },
          (c) => String(c.candidato_id),
        ),
      );
      mudarAbaNaUrl({ aba: "aprovados" }, { substituir: true });
      setFiltros({ ...FILTROS_INICIAIS, ...(doEdital || { candidatos: ids }) });
      setBusca("");
    },
    FORA_DA_CENTRAL,
  );

  return (
    <div className="ui-tela aprovados-tela">
      <TopoDoPainel
        tour="aprovados-topo"
        visoes={
          <Visoes
            aba={aba}
            aoMudar={setAba}
            aprovados={filtrados.length}
            pendencias={contarAbertas(dadosDasPendencias.pendencias).total}
          />
        }
        status={textoDoStatus(dados)}
        aoAtualizar={() => void estado.carregar()}
        atualizarDesativado={
          Boolean(dados.acao) || (!carregado && !erroAoCarregar)
        }
        principal={
          /*
            O contador e o sub judice falam da lista de aprovados. Deixá-los
            visíveis na outra aba prometeria uma ação que não pertence àquela
            tabela. No celular, o sub judice é a ação que fica à vista.
          */
          <>
            <span
              id="approvedCount"
              className="approved-contagem"
              hidden={aba !== "aprovados"}
            >
              {carregado
                ? plural(filtrados.length, "candidato", "candidatos")
                : erroAoCarregar
                  ? "Sem dados"
                  : "Carregando…"}
            </span>
            {podeSubJudice ? (
              <button
                id="approvedAddSubJudiceBtn"
                data-tour="aprovados-sub-judice"
                className="btn green"
                type="button"
                hidden={aba !== "aprovados"}
                disabled={!temListaAtiva}
                title={
                  temListaAtiva
                    ? "Incluir candidato sub judice ou registrar decisão sobre candidato já aprovado"
                    : "É necessário ter uma lista ativa"
                }
                onClick={estado.abrirSubJudice}
              >
                <i className="fa-solid fa-gavel" aria-hidden="true" /> Sub
                judice
              </button>
            ) : null}
          </>
        }
      >
        <SeloDeAvisos modulo="aprovados" />
        <div
          className={classes(
            "approved-head-actions",
            aba !== "aprovados" && "hidden",
          )}
          id="approvedHeadActions"
        >
          <button
            id="approvedExportBtn"
            data-tour="aprovados-exportar"
            className="btn secondary"
            type="button"
            disabled={!carregado || Boolean(dados.acao)}
            onClick={() => setExportar(true)}
          >
            <i className="fa-solid fa-download" aria-hidden="true" /> Exportar
          </button>
          <VerEmRelatorios
            relatorio="resumo-por-cargo"
            editais={efetivos.editalId}
            perfil={perfil}
            rotulo="Resumo por cargo e status em Relatórios"
          />
        </div>
      </TopoDoPainel>
      {carregado ? (
        <ResultadosForaDaLista
          supabase={supabase}
          area={String(area || "")}
          listas={dados.listas}
          carregadoEm={dados.carregadoEm}
        />
      ) : null}
      {aba === "aprovados" && editais.length === 1 ? (
        <FluxoDasEtapas
          view="approved"
          edital={{
            id: editais[0],
            numero: opcoesDeTodos.find((o) => o.value === editais[0])?.label,
          }}
        />
      ) : null}
      {carregado && aba === "aprovados" ? (
        <AtivosEHistorico
          vista={vista}
          aoMudar={mudarVista}
          ativos={separados.ativos.listas.length}
          historico={separados.historico.listas.length}
          todas={separados.todas.listas.length}
          rotulos={ROTULOS_DAS_LISTAS}
          situacoes={separados[vista].situacoes}
          rotulo="Listas de aprovados"
          tomDaSituacao={tomDaSituacaoDoEdital}
          className="aprovados-ativos-e-historico"
          tour="aprovados-ativos-e-historico"
        />
      ) : null}

      {erroAoCarregar && !carregado ? (
        <ErroAoCarregar
          id="approvedErro"
          oQue="a lista de aprovados"
          mensagem={erroAoCarregar}
          aoTentar={() => void estado.carregar()}
        />
      ) : null}

      <AbaAprovados
        ativa={aba === "aprovados"}
        estado={estado}
        perfil={perfil}
        candidatos={candidatosDaVista}
        listas={listasDaVista}
        anexos={dados.anexos}
        convocacoes={dados.convocacoes}
        carregado={carregado}
        erroAoCarregar={erroAoCarregar}
        opcoes={opcoes}
        filtros={efetivos}
        aoMudarFiltro={mudarFiltro}
        aoLimparFiltros={limparFiltros}
        linhas={filtrados}
        busca={busca}
        aoBuscar={setBusca}
        ordem={ordem}
        aoOrdenar={ordenar}
      />
      <AbaConvocacao
        ativa={aba === "convocacao"}
        estado={estado}
        perfil={perfil}
        candidatos={candidatos}
        listas={listas}
        configs={dados.configs}
        modelos={dados.modelos}
        convocacoes={dados.convocacoes}
        carregado={carregado}
        erroAoCarregar={erroAoCarregar}
        tipo={tipo}
        aoMudarTipo={setTipo}
        editalPedido={editalDaEntrevista}
      />
      <AbaPendencias
        ativa={aba === "pendencias"}
        estado={pendencias}
        area={String(area || "")}
        editalPedido={editalDaPendencia}
        hoje={hoje()}
      />
      <ModalAberto
        estado={estado}
        dados={dados}
        daArea={{ listas, candidatos }}
        navegacao={navegacao}
      />
      {exportar ? (
        <ModalDaExportacao
          estado={estado}
          pedido={montarPedidoDaExportacao({
            area: String(area || ""),
            rotuloDaArea: nome || String(area || ""),
            candidatosDaArea: candidatosDaVista,
            filtrados,
            filtros: filtrosParaExportar,
            opcoesDeEdital: opcoesEditais,
            convocacoes: dados.convocacoes,
            dadosDe: dados.carregadoEm,
          })}
          aoFechar={() => setExportar(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * Cria a Lista de aprovados (rota `approved`, src/app/telas.tsx): o conteúdo
 * React e o controlador (`render()`, `openImportModal`…).
 */
export function criarListaAprovados({
  supabase = getSupabaseClient(),
  toast,
  getProfile,
  confirmar,
  lerPlanilha,
  novaAba,
  armazenamento,
  areaAtual,
  copiar,
  imprimir,
  carregarLogo,
  baixar,
  hoje,
  esperar,
  cabecalho = () =>
    estadoDasConfiguracoes.obter().valores?.get?.(CHAVE_DO_CABECALHO) || "",
}: OpcoesDaTelaDosAprovados = {}) {
  // Decidir uma pendência muda status, posição ou remove linha: a lista recarrega.
  const pendencias = criarEstadoDasPendencias({
    supabase,
    ...(toast ? { toast } : {}),
    ...(hoje ? { hoje } : {}),
    // `estado` é criado logo abaixo; a decisão só chega depois da montagem.
    aoDecidir: () => void estado.carregar({ emSegundoPlano: true }),
  });
  const estado = criarEstadoDaListaDeAprovados({
    pendencias: () => pendencias,
    supabase,
    toast,
    getProfile,
    confirmar,
    lerPlanilha,
    novaAba,
    armazenamento,
    areaAtual,
    cabecalho,
    ...(copiar ? { copiar } : {}),
    ...(imprimir ? { imprimir } : {}),
    ...(carregarLogo ? { carregarLogo } : {}),
    ...(baixar ? { baixar } : {}),
    ...(hoje ? { hoje } : {}),
    ...(esperar ? { esperar } : {}),
  });
  return {
    estado,
    pendencias,
    nome: "a lista de aprovados",
    conteudo: (
      <ListaAprovados
        estado={estado}
        pendencias={pendencias}
        supabase={supabase}
      />
    ),
    render: () => estado.garantirCarregado(),
    openImportModal: (editalId: string, rotulo = "") =>
      estado.abrirListasDoEdital(editalId, rotulo),
    closeImportModal: estado.fecharModal,
    openStatusModal: estado.abrirStatus,
    openSubJudiceModal: estado.abrirSubJudice,
    modelUrl: PLANILHAS.modeloListaAprovados.url,
  };
}
