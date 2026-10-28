import { useEffect, useState, useSyncExternalStore } from "react";
import { montarModulo } from "../../app/montar-modulo.tsx";
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.ts";
import { SeloDeTreinamento } from "../../componentes/selo-de-treinamento.tsx";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { editaisDaEscolha } from "../../lib/avaliacao-documental/editais.ts";
import {
  editalEscolhido,
  sufixoDeTreinamento,
} from "../../lib/edital-de-treinamento.ts";
import { CHAVE_DO_CABECALHO } from "../../lib/cabecalho-dos-documentos.ts";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { Aviso, Campo, TopoDoPainel } from "../../ui/index.ts";
import { estadoDasConfiguracoes } from "../configuracoes/estado.ts";
import { coordenaOEdital } from "./abas-e-entrada.ts";
import { criarEstadoDaAvaliacao, MENSAGEM_SEM_ACESSO } from "./estado.ts";
import { criarEstadoDaPreClassificacao } from "./estado-da-pre-classificacao.ts";
import { PreClassificacao } from "./pre-classificacao.tsx";
import type { LojaDaAvaliacao } from "./estado.ts";
import type {
  Avisar,
  ClienteDaAvaliacao,
} from "./tipos-do-estado.ts";
import "./avaliacao-documental.css";

/*
  Página independente "Pré-classificação" do Processo Seletivo.
  Reutiliza os stores, a RPC e a tela da Avaliação Documental, sem copiar
  cálculos, estados de lote, regras do edital ou funções de persistência.
  O backend (FC_EXIGIR_COORD_AVALIACAO) é a autoridade final: navegar até
  esta view não concede qualquer permissão de coordenação.
*/

type LojaDaPre = ReturnType<typeof criarEstadoDaPreClassificacao>;
type OpcoesDaPre = NonNullable<
  Parameters<typeof criarEstadoDaPreClassificacao>[0]
>;

function TelaDaPreClassificacao({
  estado,
  pre,
  atualizar,
}: {
  estado: LojaDaAvaliacao;
  pre: LojaDaPre;
  atualizar: () => Promise<unknown>;
}) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const { area: areaDoApp } = usarAreaAtual();
  const [todos, setTodos] = useState(false);

  useEffect(() => {
    if (!areaDoApp || e.area === areaDoApp) return;
    void estado.carregar(areaDoApp);
  }, [estado, areaDoApp, e.area]);

  const { lista: editais, ocultos } = editaisDaEscolha(e.editais, {
    todos,
    escolhido: e.editalId,
  });
  const escolhido = editalEscolhido(e.editais, e.editalId);
  // Não montar PreClassificacao sem a confirmação do papel do edital.
  const coordena = Boolean(e.editalId && e.dados && coordenaOEdital(e) === true);

  return (
    <div className="ui-tela avd-tela">
      <TopoDoPainel
        status={e.carregandoEdital ? "Carregando o edital…" : ""}
        aoAtualizar={() => void atualizar()}
        atualizarDesativado={!e.area || e.carregandoEditais || e.carregandoEdital}
      >
        <SeloDeTreinamento edital={escolhido} />
      </TopoDoPainel>

      {e.semAcesso ? (
        <Aviso tom="warning" papel="alert">
          <strong>{MENSAGEM_SEM_ACESSO}</strong>{" "}
          <span>{e.erroAoCarregar}</span>
        </Aviso>
      ) : null}
      {e.erroAoCarregar && !e.semAcesso ? (
        <Aviso tom="danger" papel="alert">
          Não foi possível carregar os editais: {e.erroAoCarregar}
          <button
            type="button"
            className="btn secondary small"
            onClick={() => void estado.carregar(e.area)}
          >
            Tentar novamente
          </button>
        </Aviso>
      ) : null}
      {!e.semAcesso ? (
        <section className="ui-card avd-edital" aria-label="Edital da pré-classificação">
          <Campo rotulo="Edital">
            <select
              value={e.editalId}
              disabled={!e.carregado}
              data-tour="pre-seletor-edital"
              onChange={(ev) => void estado.escolherEdital(ev.target.value)}
            >
              <option value="">
                {!e.carregado ? "Carregando…" : "Escolha o edital"}
              </option>
              {editais.map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {[ed.edital, ed.unidade].filter(Boolean).join(" - ")}
                  {sufixoDeTreinamento(ed)}
                </option>
              ))}
            </select>
          </Campo>
          {ocultos || todos ? (
            <label className="avd-caixa">
              <input
                type="checkbox"
                checked={todos}
                onChange={(ev) => setTodos(ev.target.checked)}
              />
              Mostrar todos os editais da área
            </label>
          ) : null}
        </section>
      ) : null}

      {e.erroDoEdital && !e.semAcesso ? (
        <Aviso tom="danger" papel="alert">
          Não foi possível abrir o edital: {e.erroDoEdital}
        </Aviso>
      ) : null}
      {e.editalId && e.dados && !e.semAcesso ? (
        coordena ? (
          <PreClassificacao
            key={e.editalId}
            e={e}
            estado={estado}
            pre={pre}
          />
        ) : (
          <Aviso tom="warning" papel="alert">
            A Pré-classificação é restrita à coordenação do edital e ao
            administrador global autorizado. A permissão de acesso ao Painel da
            Seleção não libera essa operação.
          </Aviso>
        )
      ) : null}
    </div>
  );
}

export function montarPreClassificacao({
  secao = document.getElementById("page-pre-classificacao"),
  supabase = getSupabaseClient(),
  toast,
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
  agendar,
  cabecalho = () =>
    estadoDasConfiguracoes.obter().valores?.get?.(CHAVE_DO_CABECALHO) || "",
}: {
  secao?: HTMLElement | null;
  supabase?: ClienteDaAvaliacao | null;
  toast?: Avisar;
  areaAtual?: () => string | null | undefined;
  agendar?: OpcoesDaPre["agendar"];
  cabecalho?: OpcoesDaPre["cabecalho"];
} = {}) {
  const estado = criarEstadoDaAvaliacao({ supabase, toast });
  const pre = criarEstadoDaPreClassificacao({
    supabase,
    toast,
    cabecalho,
    ...(agendar ? { agendar } : {}),
  });
  const atualizar = async () => {
    const area = String(areaAtual() ?? "").trim();
    const editais = await estado.carregar(area);
    const e = estado.obter();
    if (e.editalId && e.dados?.pode_coordenar)
      await pre.carregar(e.editalId);
    return editais;
  };
  const raiz = secao
    ? montarModulo(
        secao,
        <TelaDaPreClassificacao estado={estado} pre={pre} atualizar={atualizar} />,
        { nome: "a Pré-classificação" },
      ).raiz
    : null;
  return {
    estado,
    pre,
    raiz,
    atualizar,
    render: atualizar,
  };
}
