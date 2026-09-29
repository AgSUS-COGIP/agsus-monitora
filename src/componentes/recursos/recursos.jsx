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
  diaLocal,
  enriquecerRecursos,
  FILTROS_VAZIOS,
  filtrarRecursos,
  opcoesDosFiltros,
  ORIGENS_PADRAO,
  pendenciasPrioritarias,
} from "../../lib/recursos-dos-candidatos.js";
import {
  alternarTemaDoPainel,
  temaEscuroDoPainel,
} from "../../lib/tema-do-painel.js";
import { criarEstadoDosRecursos } from "./estado.js";
import { FormularioDoRecurso } from "./formulario.jsx";
import { GavetaDoRecurso } from "./gaveta.jsx";
import { dataHora } from "./partes.jsx";
import {
  Filtros,
  filtrosAtivos,
  Graficos,
  Indicadores,
  IndicadoresDasRespostas,
  Recorte,
  Topo,
} from "./paineis.jsx";
import { PainelDeModelos } from "./modelos.jsx";
import { TabelaDeRecursos } from "./tabela.jsx";

/*
  Painel de recursos (`recursos.html?area=`), em React, com a cara e as
  classes do painel de análises curriculares: é o mesmo desenho de página
  (src/analises/*.css), não uma imitação dele. Aberto dentro do MONITORA pela
  view `recursos` (src/modules/pagina-do-painel.js), num quadro, como o de
  análises; sozinho numa aba, funciona do mesmo jeito (a sessão do Supabase é a
  do navegador).

  A área vem da URL e não muda: trocar de área no menu refaz o quadro. Admin e
  gestor de edital (recurso de permissão `recursos` >= editor; `pode_editar`
  vem do banco) cadastram, editam, escrevem e revisam a resposta e anexam; quem
  só lê consulta (e baixa os anexos). Quem administra Recursos
  (`pode_administrar_modelos`) mantém os modelos de resposta.

  O carregamento é o skeleton do painel de análises
  (analises-loading-feedback.js + analises-esqueleto.css): liga na primeira
  carga, desliga quando os dados entram — e aí avisa o MONITORA
  (`agsus:painel-pronto`) para tirar o skeleton de lá. Falha na primeira carga
  vira o aviso de erro dele, com "Tentar novamente".
*/

const NUMEROS_ZERADOS = calcularIndicadores([]);

function textoDoStatus(e, recursos) {
  if (e.semSessao) return "Sessão não localizada";
  if (e.erroAoCarregar && !e.carregado) return "Sem dados";
  if (!e.carregado) return "Carregando dados...";
  if (e.atualizando) return "Atualizando...";
  const ultima = recursos
    .map((r) => r.atualizado_em || r.criado_em)
    .filter(Boolean)
    .sort()
    .at(-1);
  return `Atualizado em ${dataHora(ultima || e.carregadoEm)}`;
}

function alternarTelaCheia() {
  if (!document.fullscreenElement)
    document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

export function PainelDeRecursos({ estado, area, nomeDaArea }) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [escuro, setEscuro] = useState(() => temaEscuroDoPainel());
  const { carregado, dados } = e;

  // A área é a do quadro (`?area=`): a primeira carga começa ao montar.
  useEffect(() => {
    void estado.carregar(area);
  }, [estado, area]);

  // O skeleton e o aviso de erro são os do painel de análises.
  useEffect(() => {
    if (carregado || e.semSessao) definirCarregamentoDoPainel(false);
    else if (e.erroAoCarregar)
      mostrarErroDoCarregamento(
        `Não foi possível carregar os recursos: ${e.erroAoCarregar}`,
        () => void estado.carregar(area),
      );
    else definirCarregamentoDoPainel(true);
  }, [carregado, e.semSessao, e.erroAoCarregar, estado, area]);

  const origens = dados?.origens?.length ? dados.origens : ORIGENS_PADRAO;
  const podeEditar = Boolean(carregado && dados?.pode_editar);
  const podeAdministrarModelos = Boolean(
    carregado && dados?.pode_administrar_modelos,
  );
  const hoje = diaLocal();
  const recursos = useMemo(
    () => (dados ? enriquecerRecursos(dados, hoje) : []),
    [dados, hoje],
  );
  const filtrados = useMemo(
    () => filtrarRecursos(recursos, filtros),
    [recursos, filtros],
  );
  const opcoes = useMemo(
    () => opcoesDosFiltros(recursos, origens),
    [recursos, origens],
  );
  const indicadores = useMemo(
    () => (carregado ? calcularIndicadores(filtrados) : NUMEROS_ZERADOS),
    [carregado, filtrados],
  );
  const pendencias = useMemo(
    () => pendenciasPrioritarias(filtrados),
    [filtrados],
  );
  const ativos = filtrosAtivos(filtros, opcoes);
  const aberto = e.gaveta ? recursos.find((r) => r.id === e.gaveta) : null;
  const emEdicao =
    e.formulario?.modo === "edicao"
      ? recursos.find((r) => r.id === e.formulario.id)
      : null;

  // KPI, pendência e barra de gráfico: clicar de novo tira o filtro.
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
          subtitulo={`${nomeDaArea} · Acompanhamento dos recursos dos candidatos`}
          status={textoDoStatus(e, recursos)}
          somenteConsulta={carregado && !podeEditar}
          escuro={escuro}
          aoTema={() => setEscuro(alternarTemaDoPainel())}
          aoTelaCheia={alternarTelaCheia}
          aoAtualizar={() => void estado.carregar(area)}
          atualizarDesativado={e.atualizando || e.semSessao}
          aoExportar={() => estado.exportarCsv(filtrados, origens)}
          exportarDesativado={!carregado || !filtrados.length}
          aoNovo={podeEditar ? estado.abrirNovo : null}
          novoDesativado={Boolean(e.acao)}
          aoModelos={podeAdministrarModelos ? estado.abrirModelos : null}
        />

        <main className="content">
          {e.semSessao ? (
            <section id="authWarning" className="auth-warning" role="alert">
              {e.erroAoCarregar}
            </section>
          ) : null}

          <Filtros
            filtros={filtros}
            opcoes={opcoes}
            carregado={carregado}
            aoMudar={trocarFiltro}
            aoLimpar={() => setFiltros(FILTROS_VAZIOS)}
          />
          <Indicadores
            indicadores={indicadores}
            carregado={carregado}
            filtros={filtros}
            aoFiltrar={alternarFiltro}
          />
          <IndicadoresDasRespostas
            indicadores={indicadores}
            carregado={carregado}
            filtros={filtros}
            aoFiltrar={alternarFiltro}
          />
          <Recorte ativos={ativos} recursos={filtrados} carregado={carregado} />
          <Graficos
            recursos={filtrados}
            pendencias={pendencias}
            carregado={carregado}
            filtros={filtros}
            aoFiltrar={alternarFiltro}
            escuro={escuro}
          />
          <TabelaDeRecursos
            recursos={filtrados}
            total={recursos.length}
            origens={origens}
            carregado={carregado}
            podeEditar={podeEditar}
            aoAbrir={estado.abrirGaveta}
            aoNovo={estado.abrirNovo}
          />
        </main>

        <footer className="footer">
          <span>
            Agência Brasileira de Apoio à Gestão do Sistema Único de Saúde ©
            2026
          </span>
          <span>
            <span id="footerUpdated">{textoDoStatus(e, recursos)}</span>{" "}
            <span className="secure">SECURE</span>
          </span>
        </footer>
      </div>

      {/* Com o formulário aberto, a gaveta sai de cena e volta quando ele fecha. */}
      {aberto && !e.formulario && !e.modelosAbertos ? (
        <GavetaDoRecurso
          estado={estado}
          recurso={aberto}
          detalhe={e.detalhes.get(aberto.id)}
          origens={origens}
          podeEditar={podeEditar}
          modelos={dados?.modelos || []}
          area={area}
        />
      ) : null}
      {e.formulario && (e.formulario.modo === "novo" || emEdicao) ? (
        <FormularioDoRecurso
          key={e.formulario.abertura}
          estado={estado}
          recurso={emEdicao}
          detalhe={emEdicao ? e.detalhes.get(emEdicao.id) : null}
          recursos={recursos}
          editais={dados?.editais || []}
          origens={origens}
        />
      ) : null}
      {e.modelosAbertos ? <PainelDeModelos estado={estado} /> : null}
    </>
  );
}

const ICONE_DO_AVISO = {
  error: "fa-circle-exclamation",
  warn: "fa-triangle-exclamation",
};

/*
  O aviso do painel de análises (`.toast` no `#toastHost`): some sozinho em
  alguns segundos. Montado com elementos, sem HTML: a mensagem pode trazer o
  que o banco respondeu.
*/
export function criarAvisoDoPainel(host, duracaoMs = 5200) {
  return (mensagem, tipo = "info") => {
    if (!host) return;
    const aviso = document.createElement("div");
    aviso.className = `toast${tipo === "warn" ? " warn" : tipo === "error" ? " error" : ""}`;
    aviso.setAttribute("role", tipo === "error" ? "alert" : "status");
    const icone = document.createElement("i");
    icone.className = `fa-solid ${ICONE_DO_AVISO[tipo] || "fa-circle-info"}`;
    icone.setAttribute("aria-hidden", "true");
    const texto = document.createElement("span");
    texto.textContent = String(mensagem ?? "");
    aviso.append(icone, texto);
    host.append(aviso);
    setTimeout(() => aviso.remove(), duracaoMs);
  };
}

/**
 * Monta o painel no `raiz` (o `#recursosPainel` de recursos.html) e devolve o
 * estado e a raiz do React. `flushSync`: a página já sai desenhada (o
 * skeleton) desta chamada.
 */
export function montarPainelDeRecursos({
  raiz = document.getElementById("recursosPainel"),
  supabase,
  area,
  nomeDaArea,
  toast = criarAvisoDoPainel(document.getElementById("toastHost")),
  baixar,
  baixarArquivo,
  abrirUrl,
  imprimir,
  novoId,
} = {}) {
  const estado = criarEstadoDosRecursos({
    supabase,
    toast,
    baixar,
    baixarArquivo,
    abrirUrl,
    imprimir,
    novoId,
  });
  let raizDoReact = null;
  if (raiz) {
    raizDoReact = createRoot(raiz);
    flushSync(() =>
      raizDoReact.render(
        <StrictMode>
          <PainelDeRecursos
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
