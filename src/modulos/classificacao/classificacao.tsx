import type {
  EstadoDaClassificacao,
  EstadoDaAgenda,
  SnapshotDaClassificacao,
  RegistroDaClassificacao,
  OpcoesDaTela,
} from "./tipos-do-estado.ts";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  TelaNaUrl,
  usarEditalNaUrl,
  usarFiltrosNaUrl,
} from "../../app/usar-filtros-na-url.ts";
import type { EsquemaDosFiltros } from "../../app/filtros-no-endereco.ts";
import { estadoDasConfiguracoes } from "../configuracoes/estado.ts";
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.ts";
import { CHAVE_DO_CABECALHO } from "../../lib/cabecalho-dos-documentos.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { SeloDeTreinamento } from "../../componentes/selo-de-treinamento.tsx";
import { classificarEdital } from "../../lib/classificacao/ajustes.ts";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { Aviso, CabecalhoDaTela, Segmentado } from "../../ui/index.ts";
import { EntradaDaClassificacao } from "./entrada-da-classificacao.tsx";
import { Agenda } from "./agenda.tsx";
import { criarEstadoDaClassificacao, MENSAGEM_SEM_ACESSO } from "./estado.ts";
import { criarEstadoDaAgenda } from "./estado-da-agenda.ts";
import { Listas } from "./listas.tsx";
import { abrirRegrasDoEdital } from "../regras-do-edital/abrir.ts";
import { ResumoDaRegraDaEtapa } from "../regras-do-edital/resumo-da-regra-da-etapa.tsx";
import { SeloDeAvisos } from "../conferencias/avisos-de-conferencia.tsx";
import "./classificacao.css";

/*
  A tela de Classificação (view `classificacao`), módulo do app: monta direto
  na `<section id="page-classificacao">` do index.html, como Seleção e
  Entrevistas. A navegação é dona da classe `.active` da seção e chama `render()`
  do controlador ao navegar (a rota, src/app/telas.tsx).

  - Área: a área atual do app; trocar de área com a tela aberta recarrega.
  - Edital: sem edital escolhido, a entrada (a busca e os cards dos editais:
    entrada-da-classificacao.tsx); escolhido, o cabeçalho mostra o nome e
    "Trocar" volta aos cards. A regra é DESTE edital (decidida pelo gestor).
  - Visões: "Listas" (preliminar, convocação, resultado final), "Agenda"
    (regra e agenda das entrevistas dos convocados; agenda.tsx) e "Regra"
    (resumo; editar é nas Regras do edital, em Editais).
    A agenda fica aqui, junto da lista de convocação de onde saem os
    convocados e do documento que ela preenche (DATA e HORA); quem conduz vê
    a agenda do dia em Entrevistas › Conduzir entrevistas.
  - A conta é do motor puro (src/lib/classificacao/motor.ts), com a data de
    corte do cronograma quando a regra não traz a sua.
  O layout das telas da seleção: o cabeçalho (trilha, título, edital, as
  visões em controle segmentado, os avisos e o Atualizar só com o ícone).
  Sem tela de carregamento: a faixa e as listas em skeleton até a primeira
  carga.
*/

const VISOES = [
  { valor: "listas", rotulo: "Lista" },
  { valor: "agenda", rotulo: "Agenda" },
  { valor: "regra", rotulo: "Regra" },
];

/* A visão na URL (?aba=agenda); trocar é entrada nova no histórico. */
const FILTROS_DA_CLASSIFICACAO: EsquemaDosFiltros<"aba"> = Object.freeze({
  aba: {
    padrao: "listas",
    aceita: (aba: string) => VISOES.some((v) => v.valor === aba),
    empilha: true,
  },
});
/* Na troca de visão, só o edital fica na URL (o recorte das listas sai). */
const FICA_NA_TROCA_DE_ABA = Object.freeze(["edital"]);

/*
  A classificação de um edital numa lista: o motor, com a data de corte do
  cronograma e os ajustes da pontuação aprovados em recurso por cima da nota
  da análise (src/lib/classificacao/ajustes.ts — a mesma conta da prévia do
  recurso).
*/
export function calcularClassificacao(
  dados: RegistroDaClassificacao | null,
  tipo: string,
) {
  return classificarEdital(dados, tipo);
}

type PropsDaTela = {
  estado: EstadoDaClassificacao;
  agenda: EstadoDaAgenda;
  confirmar: (mensagem: string) => boolean;
};

function TelaDaArea({
  estado,
  agenda,
  confirmar,
  e,
}: PropsDaTela & { e: SnapshotDaClassificacao }) {
  const [filtrosDaTela, mudarFiltrosDaTela] = usarFiltrosNaUrl(
    FILTROS_DA_CLASSIFICACAO,
    { manter: FICA_NA_TROCA_DE_ABA },
  );
  const visao = filtrosDaTela.aba;
  /*
    A agenda gerada ou ajustada e ainda não salva só existe na tela da Agenda:
    trocar de aba ou de edital a desmonta. Antes, pergunta.
  */
  const agendaPendente = useRef(false);
  const aoMudarPendencia = useCallback((pendente: boolean) => {
    agendaPendente.current = pendente;
  }, []);
  const podeSairDaAgenda = () =>
    !agendaPendente.current ||
    confirmar(
      "A agenda das entrevistas tem alterações que ainda não foram salvas. Sair mesmo assim?",
    );
  const setVisao = (aba: string) => {
    if (aba !== visao && !podeSairDaAgenda()) return;
    mudarFiltrosDaTela({ aba });
  };
  // O edital na URL (?edital=): o link copiado abre a Classificação nele.
  const escolherEditalNaUrl = usarEditalNaUrl({
    editalId: e.editalId,
    editais: e.editais,
    carregado: e.carregado,
    escolher: (id) => void estado.escolherEdital(id),
  });
  const escolherEdital = (id: string) => {
    if (id !== e.editalId && !podeSairDaAgenda()) return;
    escolherEditalNaUrl(id);
  };
  const recarregar = () => {
    void estado.carregar(e.area);
  };
  const calcular = useCallback(
    (dados: RegistroDaClassificacao, tipo: string) =>
      calcularClassificacao(dados, tipo),
    [],
  );

  const { nome: nomeDaArea } = usarAreaAtual();
  const escolhido = e.editais.find((ed) => ed.id === e.editalId) ?? null;

  /* A agenda das entrevistas acompanha o edital escolhido (também preenche o documento). */
  useEffect(() => {
    void agenda.carregar(e.editalId);
  }, [agenda, e.editalId]);

  return (
    <div
      className="ui-tela classificacao-tela ui-tela-da-selecao"
      data-tour="classificacao-tela"
    >
      <CabecalhoDaTela
        trilha={[nomeDaArea, "Seleção"].filter(Boolean).join(" / ")}
        titulo="Classificação"
        tour="classificacao-cabecalho"
        edital={
          e.editalId && !e.semAcesso ? (
            <div
              className="classificacao-edital"
              data-tour="classificacao-seletor-edital"
            >
              <span className="ui-texto-secundario">Edital</span>
              <span className="classificacao-edital-nome">
                <strong>
                  {escolhido
                    ? [escolhido.edital, escolhido.unidade]
                        .filter(Boolean)
                        .join(" · ")
                    : e.editalId}
                </strong>
                <SeloDeTreinamento edital={escolhido} />
                <button
                  type="button"
                  className="btn ghost small"
                  data-acao="trocar-edital"
                  onClick={() => escolherEdital("")}
                >
                  Trocar
                </button>
              </span>
            </div>
          ) : null
        }
        secoes={
          e.editalId && !e.semAcesso ? (
            <Segmentado
              tour="classificacao-abas"
              rotulo="Seções"
              opcoes={VISOES}
              valor={visao}
              aoMudar={setVisao}
            />
          ) : null
        }
        aoAtualizar={() => {
          // Os editais e o escolhido (uma leitura só) e a configuração de convocação.
          void estado.carregar(e.area, { releitura: true });
          if (e.editalId) void agenda.carregar(e.editalId);
        }}
        atualizarDesativado={
          !e.area || e.carregandoEditais || e.carregandoEdital
        }
      >
        <SeloDeAvisos modulo="classificacao" />
      </CabecalhoDaTela>

      {e.semAcesso ? (
        <Aviso tom="warning" papel="alert">
          <strong>{MENSAGEM_SEM_ACESSO}</strong> <span>{e.erroAoCarregar}</span>
        </Aviso>
      ) : null}
      {e.erroAoCarregar && !e.semAcesso ? (
        <Aviso tom="danger" papel="alert">
          Não foi possível carregar os editais: {e.erroAoCarregar}{" "}
          <button
            type="button"
            className="btn secondary small"
            onClick={recarregar}
          >
            Tentar novamente
          </button>
        </Aviso>
      ) : null}

      {e.semAcesso ? null : (
        <>
          {e.erroDoEdital ? (
            <Aviso tom="danger" papel="alert">
              Não foi possível abrir o edital: {e.erroDoEdital}{" "}
              <button
                type="button"
                className="btn secondary small"
                onClick={() => void estado.escolherEdital(e.editalId)}
              >
                Tentar novamente
              </button>
            </Aviso>
          ) : null}

          {e.editalId ? (
            visao === "listas" && (e.dados || e.carregandoEdital) ? (
              <Listas
                key={e.editalId}
                estado={estado}
                e={e}
                calcular={calcular}
                aoAbrirAgenda={() => setVisao("agenda")}
                confirmar={confirmar}
              />
            ) : visao === "agenda" && e.dados ? (
              <Agenda
                key={e.editalId}
                estado={estado}
                agenda={agenda}
                e={e}
                calcular={calcular}
                aoMudarPendencia={aoMudarPendencia}
              />
            ) : visao === "regra" && e.dados ? (
              <ResumoDaRegraDaEtapa
                id="classificacaoRegraResumoTitulo"
                tour="classificacao-regra"
                titulo="Regra da Classificação"
                versao={e.dados.regra?.versao ?? null}
                nome={e.dados.regra?.nome ?? null}
                linhas={(resumos) =>
                  resumos.resumoDaRegraDaClassificacao(
                    e.dados?.regra?.configuracao,
                  )
                }
                semRegra="O edital ainda não tem regra da Classificação."
                aoEditar={() =>
                  abrirRegrasDoEdital(e.editalId, "classificacao")
                }
              />
            ) : e.carregandoEdital ? (
              <div className="ui-card" aria-busy="true">
                <div className="ui-esqueleto-linha" />
                <div className="ui-esqueleto-linha" />
              </div>
            ) : null
          ) : e.erroAoCarregar ? null : (
            <EntradaDaClassificacao
              editais={e.editais}
              carregado={e.carregado}
              aoAbrir={escolherEdital}
            />
          )}
        </>
      )}
    </div>
  );
}

export function TelaDeClassificacao({
  estado,
  agenda,
  confirmar = (mensagem) => globalThis.confirm?.(mensagem) ?? true,
}: Omit<PropsDaTela, "confirmar"> & {
  confirmar?: PropsDaTela["confirmar"];
}) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const { area: areaDoApp } = usarAreaAtual();

  /* A área do app mudou com a tela aberta: recarrega com a nova. */
  useEffect(() => {
    const { area } = estado.obter();
    if (area && areaDoApp && area !== areaDoApp)
      void estado.carregar(areaDoApp);
  }, [estado, areaDoApp]);

  return (
    <TelaNaUrl.Provider value="classificacao">
      <TelaDaArea
        key={e.area || "sem-area"}
        estado={estado}
        agenda={agenda}
        confirmar={confirmar}
        e={e}
      />
    </TelaNaUrl.Provider>
  );
}

/**
 * Cria a tela (rota `classificacao`, src/app/telas.tsx): o conteúdo React e o
 * controlador: `render()` a cada abertura (carrega a área atual).
 */
export function criarClassificacao({
  supabase = getSupabaseClient(),
  toast,
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
  baixar,
  imprimir,
  copiar,
  carregarLogo,
  cabecalho = () =>
    estadoDasConfiguracoes.obter().valores?.get?.(CHAVE_DO_CABECALHO) || "",
  confirmar,
}: OpcoesDaTela = {}) {
  const agenda = criarEstadoDaAgenda({
    supabase,
    toast,
    ...(baixar ? { baixar } : {}),
  });
  const estado = criarEstadoDaClassificacao({
    supabase,
    toast,
    cabecalho,
    agendaDoEdital: (editalId) => agenda.agendaDoDocumento(editalId),
    ...(baixar ? { baixar } : {}),
    ...(imprimir ? { imprimir } : {}),
    ...(copiar ? { copiar } : {}),
    ...(carregarLogo ? { carregarLogo } : {}),
  });
  return {
    estado,
    agenda,
    nome: "a tela de classificação",
    conteudo: (
      <TelaDeClassificacao
        estado={estado}
        agenda={agenda}
        {...(confirmar ? { confirmar } : {})}
      />
    ),
    render() {
      return estado.carregar(String(areaAtual() ?? "").trim());
    },
    /* O edital do endereço ("Ir para…" com edital), depois da carga. */
    abrirEdital: (edital: string) => estado.escolherEdital(edital),
  };
}
