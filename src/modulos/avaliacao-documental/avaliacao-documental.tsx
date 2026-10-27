import { useEffect, useState, useSyncExternalStore } from "react";
import { editaisDaEscolha } from "../../lib/avaliacao-documental/editais.ts";
import { montarModulo } from "../../app/montar-modulo.tsx";
import { criarRascunhoDaRegra } from "../../app/rascunho-da-regra.ts";
import type { RascunhoDaRegra } from "../../app/rascunho-da-regra.ts";
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.ts";
import { SeloDeTreinamento } from "../../componentes/selo-de-treinamento.tsx";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import {
  editalEscolhido,
  sufixoDeTreinamento,
} from "../../lib/edital-de-treinamento.ts";
import {
  PAPEIS_DA_EQUIPE,
  rotuloDe,
  SITUACOES_DA_REGRA,
} from "../../lib/avaliacao-documental/catalogo.ts";
import { rotuloDaVersao } from "../../lib/nome-da-versao.ts";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { Aviso, Campo, Segmentado, TopoDoPainel } from "../../ui/index.ts";
import { CHAVE_DO_CABECALHO } from "../../lib/cabecalho-dos-documentos.ts";
import { estadoDasConfiguracoes } from "../configuracoes/estado.ts";
import {
  coordenaOEdital,
  visaoNaTela,
  visoesDaPessoa,
  VISOES,
} from "./abas-e-entrada.ts";
import { EntradaDaAvaliacao } from "./entrada-da-avaliacao.tsx";
import { Equipe } from "./equipe.tsx";
import { criarEstadoDaAvaliacao, MENSAGEM_SEM_ACESSO } from "./estado.ts";
import type { LojaDaAvaliacao } from "./estado.ts";
import { criarEstadoDaFila, lerFichaLembrada } from "./estado-da-fila.ts";
import type { LojaDaFila } from "./estado-da-fila.ts";
import { criarEstadoDaPreClassificacao } from "./estado-da-pre-classificacao.ts";
import type {
  Avisar,
  ClienteDaAvaliacao,
  EstadoDaAvaliacao,
  FichaLembrada,
} from "./tipos-do-estado.ts";
import { Fila } from "./fila.tsx";
import { OrigemDaAnalise } from "./origem-da-analise.tsx";
import { PreClassificacao } from "./pre-classificacao.tsx";
import { Regra } from "./regra.tsx";
import "./avaliacao-documental.css";
import "./ficha/ficha.css";

/*
  A tela Avaliação documental (view `avaliacao-documental`), módulo do app:
  monta direto na `<section id="page-avaliacao-documental">` do index.html. A
  navegação é dona da classe `.active` e chama `render()` ao navegar (tabela
  `TELAS_REACT` de src/app/navegacao.ts).

  Fases F1 a F3 (docs/analises-no-monitora/plano-de-construcao.md): escolha
  do edital (só os vigentes, com "Mostrar todos os editais da área"), a regra
  da avaliação (modelo, versões com motivo, perguntas da Empregare, prévia com
  candidato fictício), a equipe, a pré-classificação (Provisória por ART e
  lote, gravados pelo job Python; listas PROVISORIA e LOTE) e a fila (etapas,
  distribuição e reserva da ficha). O conteúdo da ficha entra na F4. O Painel
  das análises (view `analises`) continua sendo a leitura.
*/

/*
  Abas por papel (abas-e-entrada.ts): quem coordena o edital vê Regra,
  Equipe, Pré-classificação e Fila; os demais, só a Fila, sem o seletor. Sem
  edital escolhido não há abas: a entrada mostra os cartões dos editais.
*/
const FILA = VISOES.find((v) => v.valor === "fila")!;

type LojaDaPreClassificacao = ReturnType<typeof criarEstadoDaPreClassificacao>;
type OpcoesDaPreClassificacao = NonNullable<
  Parameters<typeof criarEstadoDaPreClassificacao>[0]
>;

/** O "Atualizar" da tela (criarAtualizacao): devolve se os editais carregaram. */
type Atualizar = (area?: string) => Promise<unknown>;

interface PropsDaTela {
  estado: LojaDaAvaliacao;
  pre: LojaDaPreClassificacao;
  fila: LojaDaFila;
  rascunho: RascunhoDaRegra;
  atualizar: Atualizar;
  confirmar: (mensagem: string) => boolean;
}

interface PropsDaTelaDaArea extends PropsDaTela {
  e: EstadoDaAvaliacao;
}

function textoDoStatus(e: EstadoDaAvaliacao) {
  if (e.semAcesso) return "Sem acesso";
  if (!e.carregado && e.carregandoEditais) return "Carregando editais...";
  if (e.carregandoEdital) return "Carregando o edital...";
  const regra = e.dados?.regra;
  if (regra)
    return `${rotuloDaVersao(regra)} · ${rotuloDe(SITUACOES_DA_REGRA, regra.situacao)}`;
  return e.dados ? "Sem regra" : "";
}

const AVISO_AO_ATUALIZAR =
  "A regra tem alterações ainda não salvas como versão (o rascunho fica guardado e volta ao abrir a regra). Atualizar agora?";

function TelaDaArea({
  estado,
  pre,
  fila,
  rascunho,
  atualizar,
  confirmar,
  e,
}: PropsDaTelaDaArea) {
  const visao = visaoNaTela(e);
  const visoes = visoesDaPessoa(e);
  const coordena = coordenaOEdital(e) === true;
  const [todos, setTodos] = useState(false);
  const { lista: editais, ocultos } = editaisDaEscolha(e.editais, {
    todos,
    escolhido: e.editalId,
  });
  const recarregar = () => void estado.carregar(e.area);
  const papel = e.dados?.papel;
  const escolhido = editalEscolhido(e.editais, e.editalId);
  // Modo de análise: a ficha aberta ocupa a tela; só a Fila (que a desenha) fica montada.
  const sf = useSyncExternalStore(fila.assinar, fila.obter);
  const emAnalise = visao === "fila" && Boolean(sf.aberta?.ficha || sf.abrindo);
  return (
    <div
      className="ui-tela avd-tela"
      data-modo={emAnalise ? "analise" : undefined}
    >
      {emAnalise ? null : (
        <TopoDoPainel
          visoes={
            !e.editalId || e.semAcesso ? null : visoes.length ? (
              <Segmentado
                rotulo="Visão"
                opcoes={visoes}
                valor={visao}
                aoMudar={estado.mudarVisao}
                tour="avd-visoes"
              />
            ) : coordenaOEdital(e) === false ? (
              <h2 className="avd-visao-unica" data-aba-unica="fila">
                <i className={`fa-solid ${FILA.icone}`} aria-hidden="true" />{" "}
                {FILA.rotulo}
              </h2>
            ) : null
          }
          status={textoDoStatus(e)}
          aoAtualizar={() => {
            if (rascunho.comAlteracoes() && !confirmar(AVISO_AO_ATUALIZAR))
              return;
            void atualizar();
          }}
          atualizarDesativado={
            !e.area || e.carregandoEditais || e.carregandoEdital
          }
        >
          <SeloDeTreinamento edital={escolhido} />
        </TopoDoPainel>
      )}

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
          {emAnalise ? null : (
            <section className="ui-card avd-edital" aria-label="Edital">
              <Campo rotulo="Edital">
                <select
                  value={e.editalId}
                  data-tour="avd-seletor-edital"
                  disabled={!e.carregado}
                  onChange={(ev) => void estado.escolherEdital(ev.target.value)}
                >
                  <option value="">
                    {e.carregado
                      ? editais.length
                        ? "Escolha o edital"
                        : e.editais.length
                          ? "Nenhum edital vigente nesta área"
                          : "Nenhum edital nesta área"
                      : "Carregando…"}
                  </option>
                  {editais.map((ed) => (
                    <option key={ed.id} value={ed.id}>
                      {[ed.edital, ed.unidade].filter(Boolean).join(" - ")}
                      {ed.versao_regra
                        ? ` · ${rotuloDaVersao({ versao: ed.versao_regra, nome: ed.nome_regra })}`
                        : ""}
                      {sufixoDeTreinamento(ed)}
                    </option>
                  ))}
                </select>
              </Campo>
              <SeloDeTreinamento edital={escolhido} />
              {ocultos || todos ? (
                <label className="avd-caixa" data-tour="avd-todos-editais">
                  <input
                    type="checkbox"
                    checked={todos}
                    onChange={(ev) => setTodos(ev.target.checked)}
                  />
                  Mostrar todos os editais da área
                </label>
              ) : null}
              {e.dados ? (
                <OrigemDaAnalise
                  origem={e.dados.origem}
                  rotuloDoPapel={papel ? rotuloDe(PAPEIS_DA_EQUIPE, papel) : ""}
                  podeTrocar={Boolean(e.dados.pode_coordenar)}
                  aoTrocar={estado.definirOrigem}
                />
              ) : null}
            </section>
          )}

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

          {e.editalId && e.dados && !emAnalise ? (
            <section className="ui-card avd-orientacao" aria-label="Organização da avaliação documental">
              <div>
                <strong>Fluxo da avaliação</strong>
                <p className="ui-texto-secundario">Fila para analisar documentos; Regra e Equipe para configurar o edital. Os resultados e os espelhos ficam na fila, nas etapas Concluídas e nas ações da coordenação.</p>
              </div>
              {coordena ? (
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => estado.mudarVisao("pre")}
                >
                  Abrir pré-classificação
                </button>
              ) : null}
            </section>
          ) : null}
          {e.editalId ? (
            e.dados ? (
              visao === "regra" ? (
                <Regra
                  key={`${e.editalId}:${e.dados.regra?.versao ?? 0}`}
                  e={e}
                  estado={estado}
                  rascunhoGuardado={rascunho}
                />
              ) : visao === "fila" ? (
                <Fila key={e.editalId} e={e} fila={fila} />
              ) : visao === "pre" ? (
                <PreClassificacao
                  key={`${e.editalId}:${e.dados.regra?.versao ?? 0}`}
                  e={e}
                  estado={estado}
                  pre={pre}
                />
              ) : (
                <Equipe
                  key={`${e.editalId}:${JSON.stringify(e.equipe?.equipe ?? [])}`}
                  e={e}
                  estado={estado}
                />
              )
            ) : (
              <div className="ui-card" aria-busy="true">
                <div className="ui-esqueleto-linha" />
                <div className="ui-esqueleto-linha" />
              </div>
            )
          ) : e.carregado && !e.erroAoCarregar ? (
            <EntradaDaAvaliacao
              editais={editais}
              aoAbrir={(id) => void estado.escolherEdital(id)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

export function TelaDaAvaliacaoDocumental({
  estado,
  pre,
  fila,
  rascunho,
  atualizar,
  confirmar = (mensagem) => globalThis.confirm?.(mensagem) ?? true,
}: Omit<PropsDaTela, "confirmar"> & {
  confirmar?: PropsDaTela["confirmar"];
}) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const { area: areaDoApp } = usarAreaAtual();
  useEffect(() => {
    const { area } = estado.obter();
    if (!area || !areaDoApp || area === areaDoApp) return undefined;
    let vivo = true;
    // A ficha aberta salva o que falta e libera a reserva; só então a área troca.
    void Promise.resolve(fila?.fechar?.({ reler: false })).then(() => {
      if (vivo) void estado.carregar(areaDoApp);
    });
    return () => {
      vivo = false;
    };
  }, [estado, fila, areaDoApp]);
  return (
    <TelaDaArea
      key={e.area || "sem-area"}
      estado={estado}
      pre={pre}
      fila={fila}
      rascunho={rascunho}
      atualizar={atualizar}
      confirmar={confirmar}
      e={e}
    />
  );
}

/**
 * "Atualizar" e reabertura da tela: os editais da área e o edital aberto
 * (regra e equipe) e, na Pré-classificação ou na Fila, a aba aberta.
 */
export function criarAtualizacao({
  estado,
  pre,
  fila,
  fichaLembrada = lerFichaLembrada,
}: {
  estado: LojaDaAvaliacao;
  pre: Pick<LojaDaPreClassificacao, "carregar">;
  fila: Pick<LojaDaFila, "carregar">;
  fichaLembrada?: () => FichaLembrada | null;
}) {
  return async function atualizar(area = estado.obter().area) {
    const antes = estado.obter();
    const { editalId } = antes;
    const visao = visaoNaTela(antes);
    // Página recarregada no modo de análise: volta ao edital e à Fila (a fila reabre a ficha).
    const lembrada = editalId ? null : fichaLembrada();
    const pedidos: [Promise<boolean>, ...Promise<unknown>[]] = [
      estado.carregar(area, { preferido: lembrada?.edital || "" }),
    ];
    if (area && area === antes.area && editalId) {
      if (visao === "pre") pedidos.push(pre.carregar(editalId));
      if (visao === "fila") pedidos.push(fila.carregar(editalId));
    }
    const [editais] = await Promise.all(pedidos);
    if (lembrada && estado.obter().editalId === lembrada.edital)
      estado.mudarVisao("fila");
    return editais;
  };
}

/**
 * Monta a tela na `<section id="page-avaliacao-documental">` e devolve o
 * controlador do legado: `render()` a cada abertura e no "Atualizar dados"
 * do app (relê a área atual e a aba aberta).
 */
export function montarAvaliacaoDocumental({
  secao = document.getElementById("page-avaliacao-documental"),
  supabase = getSupabaseClient(),
  toast,
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
  agendar,
  getProfile = () => null,
  cabecalho = () =>
    estadoDasConfiguracoes.obter().valores?.get?.(CHAVE_DO_CABECALHO) || "",
  rascunho = criarRascunhoDaRegra({ tipo: "ANALISE", supabase }),
  confirmar,
}: {
  secao?: HTMLElement | null;
  supabase?: ClienteDaAvaliacao | null;
  toast?: Avisar;
  areaAtual?: () => string | null | undefined;
  agendar?: OpcoesDaPreClassificacao["agendar"];
  getProfile?: () => unknown;
  cabecalho?: OpcoesDaPreClassificacao["cabecalho"];
  rascunho?: RascunhoDaRegra;
  confirmar?: (mensagem: string) => boolean;
} = {}) {
  // Versão nova salva: o rascunho guardado acaba antes de a aba Regra remontar.
  const estado = criarEstadoDaAvaliacao({
    supabase,
    toast,
    aoGravarVersao: (editalId) => void rascunho.esquecer(editalId),
  });
  const pre = criarEstadoDaPreClassificacao({
    supabase,
    toast,
    cabecalho,
    ...(agendar ? { agendar } : {}),
  });
  const fila = criarEstadoDaFila({ supabase, toast, getProfile });
  const atualizar = criarAtualizacao({ estado, pre, fila });
  const raiz = secao
    ? montarModulo(
        secao,
        <TelaDaAvaliacaoDocumental
          estado={estado}
          pre={pre}
          fila={fila}
          rascunho={rascunho}
          atualizar={atualizar}
          {...(confirmar ? { confirmar } : {})}
        />,
        { nome: "a tela de avaliação documental" },
      ).raiz
    : null;
  return {
    estado,
    pre,
    fila,
    rascunho,
    raiz,
    atualizar,
    render() {
      return atualizar(String(areaAtual() ?? "").trim());
    },
  };
}
