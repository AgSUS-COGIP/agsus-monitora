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
  filtrarVagas,
  opcoesDosFiltros,
  pendenciasDaSelecao,
  textoDaUltimaCarga,
} from "../../lib/selecao-do-painel.js";
import {
  alternarTemaDoPainel,
  temaEscuroDoPainel,
} from "../../lib/tema-do-painel.js";
import { criarAvisoDoPainel } from "../aviso-do-painel.js";
import { criarEstadoDaSelecao, MENSAGEM_SEM_ACESSO } from "./estado.js";
import {
  Filtros,
  filtrosAtivos,
  Graficos,
  Indicadores,
  Recorte,
  Topo,
} from "./paineis.jsx";
import { GavetaDaVaga, MENSAGEM_SEM_VAGAS, TabelaDeVagas } from "./tabela.jsx";

/*
  Painel de seleção (`selecao.html?area=`), em React, com a cara e as classes
  do painel de análises — o mesmo desenho dos painéis de entrevistas e de
  recursos. Aberto dentro do MONITORA pela view `selecao`
  (src/modules/pagina-do-painel.js), num quadro; sozinho numa aba, funciona do
  mesmo jeito (a sessão do Supabase é a do navegador).

  Substitui o painel externo "Seleção": o funil de cada vaga vem da aba
  Resultado da planilha "Auditoria" (carga diária, scripts/sincronizar-selecao.mjs);
  convocados, aprovados e contratados, do próprio MONITORA
  (get_selecao_da_area). Só leitura.
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
      className="auth-warning selecao-sem-acesso"
      role="alert"
    >
      <strong>{MENSAGEM_SEM_ACESSO}</strong>
      <p>
        {mensagem} Peça a liberação do módulo Seleção a quem administra os
        acessos da sua coordenação.
      </p>
    </section>
  );
}

export function PainelDeSelecao({ estado, area, nomeDaArea }) {
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
        `Não foi possível carregar a seleção: ${e.erroAoCarregar}`,
        () => void estado.carregar(area),
      );
    else definirCarregamentoDoPainel(true);
  }, [carregado, e.semSessao, e.semAcesso, e.erroAoCarregar, estado, area]);

  const vagas = dados?.vagas || [];
  const filtradas = useMemo(
    () => filtrarVagas(vagas, filtros),
    [vagas, filtros],
  );
  const opcoes = useMemo(() => opcoesDosFiltros(vagas), [vagas]);
  const indicadores = useMemo(
    () => (carregado ? calcularIndicadores(filtradas) : NUMEROS_ZERADOS),
    [carregado, filtradas],
  );
  const pendencias = useMemo(() => pendenciasDaSelecao(filtradas), [filtradas]);
  const ativos = filtrosAtivos(filtros, opcoes);
  const aberta = e.gaveta ? vagas.find((v) => v.id === e.gaveta) : null;
  const textoDaCarga = textoDaUltimaCarga(dados?.ultimaCarga);
  const vazio = carregado && !vagas.length;

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
          subtitulo={`${nomeDaArea} · Funil da seleção por vaga`}
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
                  className="panel panel-pad selecao-vazio"
                  role="status"
                >
                  <div className="empty">{MENSAGEM_SEM_VAGAS}</div>
                </section>
              ) : null}
              <Filtros
                filtros={filtros}
                opcoes={opcoes}
                carregado={carregado && !vazio}
                aoMudar={trocarFiltro}
                aoLimpar={() => setFiltros(FILTROS_VAZIOS)}
              />
              <Indicadores indicadores={indicadores} />
              <Recorte
                ativos={ativos}
                textoDaCarga={textoDaCarga}
                carregado={carregado}
              />
              <Graficos
                vagas={filtradas}
                pendencias={pendencias}
                carregado={carregado}
                filtros={filtros}
                aoFiltrar={alternarFiltro}
                escuro={escuro}
              />
              <TabelaDeVagas
                vagas={filtradas}
                total={vagas.length}
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
        <GavetaDaVaga vaga={aberta} aoFechar={estado.fecharGaveta} />
      ) : null}
    </>
  );
}

/**
 * Monta o painel no `raiz` (o `#selecaoPainel` de selecao.html) e devolve o
 * estado e a raiz do React.
 */
export function montarPainelDeSelecao({
  raiz = document.getElementById("selecaoPainel"),
  supabase,
  area,
  nomeDaArea,
  toast = criarAvisoDoPainel(document.getElementById("toastHost")),
  baixar,
  armazenamento,
} = {}) {
  const estado = criarEstadoDaSelecao({
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
          <PainelDeSelecao
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
