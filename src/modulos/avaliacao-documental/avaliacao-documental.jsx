import { useEffect, useState, useSyncExternalStore } from "react";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.js";
import { usarAreaAtual } from "../../componentes/usar-area-atual.js";
import {
  PAPEIS_DA_EQUIPE,
  rotuloDe,
  SITUACOES_DA_REGRA,
} from "../../lib/avaliacao-documental/catalogo.js";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { Aviso, Campo, Segmentado, TopoDoPainel } from "../../ui/index.js";
import { Equipe } from "./equipe.jsx";
import { criarEstadoDaAvaliacao, MENSAGEM_SEM_ACESSO } from "./estado.js";
import { Regra } from "./regra.jsx";

/*
  A tela Avaliação documental (view `avaliacao-documental`), módulo do app:
  monta direto na `<section id="page-avaliacao-documental">` do index.html. A
  navegação é dona da classe `.active` e chama `render()` ao navegar (tabela
  `TELAS_REACT` de src/app/navegacao.js).

  Fase F1 (docs/analises-no-monitora/plano-de-construcao.md): escolha do
  edital, a regra da avaliação (modelo, versões com motivo, perguntas da
  Empregare, prévia com candidato fictício) e a equipe. A Provisória, o lote, a
  fila e a ficha entram nas fases seguintes. O Painel das análises (view
  `analises`) continua sendo a leitura.
*/

const VISOES = [
  { valor: "regra", rotulo: "Regra", icone: "fa-sliders" },
  { valor: "equipe", rotulo: "Equipe", icone: "fa-users" },
];
const ORIGENS = {
  PLANILHA: "Planilha",
  COMPARACAO: "Comparação",
  MONITORA: "MONITORA",
};

function textoDoStatus(e) {
  if (e.semAcesso) return "Sem acesso";
  if (!e.carregado && e.carregandoEditais) return "Carregando editais...";
  if (e.carregandoEdital) return "Carregando o edital...";
  const regra = e.dados?.regra;
  if (regra)
    return `Regra v${regra.versao} · ${rotuloDe(SITUACOES_DA_REGRA, regra.situacao)}`;
  return e.dados ? "Sem regra" : "";
}

function TelaDaArea({ estado, e }) {
  const [visao, setVisao] = useState("regra");
  const recarregar = () => void estado.carregar(e.area);
  const papel = e.dados?.papel;
  return (
    <div className="ui-tela avd-tela">
      <TopoDoPainel
        visoes={
          <Segmentado
            rotulo="Visão"
            opcoes={VISOES}
            valor={visao}
            aoMudar={setVisao}
          />
        }
        status={textoDoStatus(e)}
        aoAtualizar={() => {
          recarregar();
          if (e.editalId) void estado.escolherEdital(e.editalId);
        }}
        atualizarDesativado={
          !e.area || e.carregandoEditais || e.carregandoEdital
        }
      />

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
          <section className="ui-card avd-edital" aria-label="Edital">
            <Campo rotulo="Edital">
              <select
                value={e.editalId}
                disabled={!e.carregado}
                onChange={(ev) => void estado.escolherEdital(ev.target.value)}
              >
                <option value="">
                  {e.carregado
                    ? e.editais.length
                      ? "Escolha o edital"
                      : "Nenhum edital nesta área"
                    : "Carregando…"}
                </option>
                {e.editais.map((ed) => (
                  <option key={ed.id} value={ed.id}>
                    {[ed.edital, ed.unidade].filter(Boolean).join(" - ")}
                    {ed.versao_regra ? ` · regra v${ed.versao_regra}` : ""}
                  </option>
                ))}
              </select>
            </Campo>
            {e.dados ? (
              <span
                className="ui-texto-secundario"
                data-origem={e.dados.origem}
              >
                Avaliação: {ORIGENS[e.dados.origem] ?? e.dados.origem}
                {papel ? ` · ${rotuloDe(PAPEIS_DA_EQUIPE, papel)}` : ""}
              </span>
            ) : null}
          </section>

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
            e.dados ? (
              visao === "regra" ? (
                <Regra
                  key={`${e.editalId}:${e.dados.regra?.versao ?? 0}`}
                  e={e}
                  estado={estado}
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
          ) : null}
        </>
      )}
    </div>
  );
}

export function TelaDaAvaliacaoDocumental({ estado }) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const { area: areaDoApp } = usarAreaAtual();
  useEffect(() => {
    const { area } = estado.obter();
    if (area && areaDoApp && area !== areaDoApp)
      void estado.carregar(areaDoApp);
  }, [estado, areaDoApp]);
  return <TelaDaArea key={e.area || "sem-area"} estado={estado} e={e} />;
}

/**
 * Monta a tela na `<section id="page-avaliacao-documental">` e devolve o
 * controlador do legado: `render()` a cada abertura (carrega a área atual).
 */
export function montarAvaliacaoDocumental({
  secao = document.getElementById("page-avaliacao-documental"),
  supabase = getSupabaseClient(),
  toast,
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
} = {}) {
  const estado = criarEstadoDaAvaliacao({ supabase, toast });
  const raiz = secao
    ? montarModulo(secao, <TelaDaAvaliacaoDocumental estado={estado} />, {
        nome: "a tela de avaliação documental",
      }).raiz
    : null;
  return {
    estado,
    raiz,
    render() {
      return estado.carregar(String(areaAtual() ?? "").trim());
    },
  };
}
