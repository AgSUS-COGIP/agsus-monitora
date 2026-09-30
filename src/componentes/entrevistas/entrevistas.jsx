import {
  StrictMode,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  definirCarregamentoDoPainel,
  mostrarErroDoCarregamento,
} from "../../analises/analises-loading-feedback.js";
import {
  calcularIndicadores,
  dataHoraBR,
  FILTROS_VAZIOS,
  filtrarAprovadosSemEntrevista,
  filtrarEntrevistas,
  opcoesDosFiltros,
  pendenciasDasEntrevistas,
  textoDaUltimaCarga,
} from "../../lib/entrevistas-do-painel.js";
import {
  alternarTemaDoPainel,
  temaEscuroDoPainel,
} from "../../lib/tema-do-painel.js";
import { criarAvisoDoPainel } from "../aviso-do-painel.js";
import { criarEstadoDasEntrevistas, MENSAGEM_SEM_ACESSO } from "./estado.js";
import { GavetaDaEntrevista, GavetaDosSemEntrevista } from "./gaveta.jsx";
import {
  Filtros,
  filtrosAtivos,
  Graficos,
  Indicadores,
  Recorte,
  Topo,
} from "./paineis.jsx";
import { MENSAGEM_SEM_ENTREVISTAS, TabelaDeEntrevistas } from "./tabela.jsx";

/*
  Painel de entrevistas (`entrevistas.html?area=`), em React, com a cara e as
  classes do painel de análises curriculares — o mesmo desenho do painel de
  recursos. Aberto dentro do MONITORA pela view `entrevistas`
  (src/modules/pagina-do-painel.js), num quadro; sozinho numa aba, funciona do
  mesmo jeito (a sessão do Supabase é a do navegador).

  Fase 1: só leitura. Os dados vêm da planilha de entrevistas, carregada no
  banco pela sincronização (`sincronizar_entrevistas`); a tela mostra a última
  carga, os KPIs, os gráficos, as pendências (aprovados sem entrevista,
  entrevistas sem análise, sem edital e com nota divergente), a tabela e a
  gaveta com o caminho do candidato.

  O carregamento é o skeleton do painel de análises; falha na primeira carga
  vira o aviso de erro dele, com "Tentar novamente". Sem permissão, a tela diz
  "Sem acesso às Entrevistas".
*/

const NUMEROS_ZERADOS = calcularIndicadores([]);

function textoDoStatus(e) {
  if (e.semSessao) return "Sessão não localizada";
  if (e.semAcesso) return "Sem acesso";
  if (e.erroAoCarregar && !e.carregado) return "Sem dados";
  if (!e.carregado) return "Carregando dados...";
  if (e.atualizando) return "Atualizando...";
  const carga = dataHoraBR(e.dados?.ultimaCarga?.em);
  return carga
    ? `Última carga em ${carga}`
    : `Atualizado em ${dataHoraBR(e.carregadoEm)}`;
}

function alternarTelaCheia() {
  if (!document.fullscreenElement)
    document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

function SemAcesso({ mensagem }) {
  return (
    <section
      id="authWarning"
      className="auth-warning entrevistas-sem-acesso"
      role="alert"
    >
      <strong>{MENSAGEM_SEM_ACESSO}</strong>
      <p>
        {mensagem} Peça a liberação do módulo Entrevistas a quem administra os
        acessos da sua coordenação.
      </p>
    </section>
  );
}

export function PainelDeEntrevistas({ estado, area, nomeDaArea }) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [escuro, setEscuro] = useState(() => temaEscuroDoPainel());
  const { carregado, dados } = e;

  useEffect(() => {
    void estado.carregar(area);
  }, [estado, area]);

  useEffect(() => {
    if (carregado || e.semSessao || e.semAcesso)
      definirCarregamentoDoPainel(false);
    else if (e.erroAoCarregar)
      mostrarErroDoCarregamento(
        `Não foi possível carregar as entrevistas: ${e.erroAoCarregar}`,
        () => void estado.carregar(area),
      );
    else definirCarregamentoDoPainel(true);
  }, [carregado, e.semSessao, e.semAcesso, e.erroAoCarregar, estado, area]);

  const entrevistas = dados?.entrevistas || [];
  const criterios = dados?.criterios || [];
  const aprovados = dados?.aprovadosSemEntrevista || [];
  const filtradas = useMemo(
    () => filtrarEntrevistas(entrevistas, filtros),
    [entrevistas, filtros],
  );
  const aprovadosFiltrados = useMemo(
    () => filtrarAprovadosSemEntrevista(aprovados, filtros),
    [aprovados, filtros],
  );
  const opcoes = useMemo(() => opcoesDosFiltros(entrevistas), [entrevistas]);
  const indicadores = useMemo(
    () =>
      carregado
        ? calcularIndicadores(filtradas, aprovadosFiltrados)
        : NUMEROS_ZERADOS,
    [carregado, filtradas, aprovadosFiltrados],
  );
  const pendencias = useMemo(
    () => pendenciasDasEntrevistas(filtradas, aprovadosFiltrados),
    [filtradas, aprovadosFiltrados],
  );
  const ativos = filtrosAtivos(filtros, opcoes);
  const aberta = e.gaveta ? entrevistas.find((x) => x.id === e.gaveta) : null;
  const textoDaCarga = textoDaUltimaCarga(dados?.ultimaCarga);
  const vazio = carregado && !entrevistas.length;

  const alternarFiltro = (campo, valor) =>
    setFiltros((atuais) => ({
      ...atuais,
      [campo]: atuais[campo] === valor ? "" : valor,
    }));
  const trocarFiltro = (campo, valor) =>
    setFiltros((atuais) => ({ ...atuais, [campo]: valor }));

  return (
    <>
      <div className="shell">
        <Topo
          subtitulo={`${nomeDaArea} · Resultado das entrevistas dos candidatos`}
          status={textoDoStatus(e)}
          escuro={escuro}
          aoTema={() => setEscuro(alternarTemaDoPainel())}
          aoTelaCheia={alternarTelaCheia}
          aoAtualizar={() => void estado.carregar(area)}
          atualizarDesativado={e.atualizando || e.semSessao}
          aoExportar={() => estado.exportarCsv(filtradas)}
          exportarDesativado={!carregado || !filtradas.length}
        />

        <main className="content">
          {e.semSessao ? (
            <section id="authWarning" className="auth-warning" role="alert">
              {e.erroAoCarregar}
            </section>
          ) : null}
          {e.semAcesso ? <SemAcesso mensagem={e.erroAoCarregar} /> : null}

          {e.semAcesso ? null : (
            <>
              {vazio ? (
                <section
                  className="panel panel-pad entrevistas-vazio"
                  role="status"
                >
                  <div className="empty">{MENSAGEM_SEM_ENTREVISTAS}</div>
                </section>
              ) : null}
              <Filtros
                filtros={filtros}
                opcoes={opcoes}
                carregado={carregado && !vazio}
                aoMudar={trocarFiltro}
                aoLimpar={() => setFiltros(FILTROS_VAZIOS)}
              />
              <Indicadores
                indicadores={indicadores}
                carregado={carregado}
                filtros={filtros}
                aoFiltrar={alternarFiltro}
                aoAbrirSemEntrevista={estado.abrirSemEntrevista}
              />
              <Recorte
                ativos={ativos}
                textoDaCarga={textoDaCarga}
                carregado={carregado}
              />
              <Graficos
                entrevistas={filtradas}
                criterios={criterios}
                pendencias={pendencias}
                carregado={carregado}
                filtros={filtros}
                aoFiltrar={alternarFiltro}
                aoAbrirSemEntrevista={estado.abrirSemEntrevista}
                escuro={escuro}
              />
              <TabelaDeEntrevistas
                entrevistas={filtradas}
                total={entrevistas.length}
                carregado={carregado}
                aoAbrir={estado.abrirGaveta}
              />
            </>
          )}
        </main>

        <footer className="footer">
          <span>
            Agência Brasileira de Apoio à Gestão do Sistema Único de Saúde ©
            2026
          </span>
          <span>
            <span id="footerUpdated">
              {carregado ? textoDaCarga : textoDoStatus(e)}
            </span>{" "}
            <span className="secure">SECURE</span>
          </span>
        </footer>
      </div>

      {aberta ? (
        <GavetaDaEntrevista
          entrevista={aberta}
          aoFechar={estado.fecharGaveta}
        />
      ) : null}
      {e.semEntrevistaAberta ? (
        <GavetaDosSemEntrevista
          aprovados={aprovadosFiltrados}
          aoFechar={estado.fecharSemEntrevista}
        />
      ) : null}
    </>
  );
}

/**
 * Monta o painel no `raiz` (o `#entrevistasPainel` de entrevistas.html) e
 * devolve o estado e a raiz do React.
 */
export function montarPainelDeEntrevistas({
  raiz = document.getElementById("entrevistasPainel"),
  supabase,
  area,
  nomeDaArea,
  toast = criarAvisoDoPainel(document.getElementById("toastHost")),
  baixar,
  armazenamento,
} = {}) {
  const estado = criarEstadoDasEntrevistas({
    supabase,
    toast,
    baixar,
    ...(armazenamento ? { armazenamento } : {}),
  });
  let raizDoReact = null;
  if (raiz) {
    raizDoReact = createRoot(raiz);
    flushSync(() =>
      raizDoReact.render(
        <StrictMode>
          <PainelDeEntrevistas
            estado={estado}
            area={area}
            nomeDaArea={nomeDaArea}
          />
        </StrictMode>,
      ),
    );
  }
  return { estado, raiz: raizDoReact };
}
