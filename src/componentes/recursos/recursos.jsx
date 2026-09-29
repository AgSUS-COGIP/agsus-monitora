import {
  StrictMode,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
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
import { usarAreaAtual } from "../usar-area-atual.js";
import { criarEstadoDosRecursos } from "./estado.js";
import { FormularioDoRecurso } from "./formulario.jsx";
import { GavetaDoRecurso } from "./gaveta.jsx";
import { Filtros, Graficos, Indicadores } from "./paineis.jsx";
import { TabelaDeRecursos } from "./tabela.jsx";

/*
  Aba Recursos, em React — a página `#page-recursos`, uma por área (Saúde
  Indígena, SEDE, Projetos), a mesma tela recortada pela área atual do menu.

  Substitui o painel de recursos do Apps Script com a cara do painel de
  análises: "Refinar resultados", indicadores em card, recursos por analista,
  pendências prioritárias, situação/impacto/esteira, a tabela e a gaveta de
  detalhe. Admin e gestor de edital (recurso de permissão `recursos` >=
  editor) cadastram e editam; quem é leitor só consulta.

  O legado só troca a classe `.active` da seção e chama `render()` ao abrir a
  página (`window.recursosController`); a carga começa aí, não na entrada.
*/

export function Recursos({ estado }) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const { area, nome } = usarAreaAtual();
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const { ativa } = e;

  // Aberta a página, a área atual manda: trocar de área no menu relê o banco.
  useEffect(() => {
    if (ativa) estado.garantirCarregado(area);
  }, [ativa, area, estado]);

  // Filtros de uma área não fazem sentido na outra.
  useEffect(() => setFiltros(FILTROS_VAZIOS), [area]);

  const dados = e.area === area ? e.dados : null;
  const carregado = e.area === area && e.carregado;
  const origens = dados?.origens?.length ? dados.origens : ORIGENS_PADRAO;
  const podeEditar = Boolean(dados?.pode_editar);
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
    () => calcularIndicadores(filtrados),
    [filtrados],
  );
  const pendencias = useMemo(
    () => pendenciasPrioritarias(filtrados),
    [filtrados],
  );
  const aberto = e.gaveta ? recursos.find((r) => r.id === e.gaveta) : null;
  const emEdicao =
    e.formulario?.modo === "edicao"
      ? recursos.find((r) => r.id === e.formulario.id)
      : null;

  const mudarFiltro = (campo, valor) =>
    setFiltros((atuais) => ({
      ...atuais,
      [campo]: atuais[campo] === valor ? "" : valor,
    }));
  const trocarFiltro = (campo, valor) =>
    setFiltros((atuais) => ({ ...atuais, [campo]: valor }));

  return (
    <div className="recursos-pagina" aria-busy={!carregado || undefined}>
      <div className="recursos-barra">
        <p className="recursos-barra-status" role="status">
          {e.area === area && e.erroAoCarregar && !carregado
            ? "Sem dados"
            : carregado
              ? `${nome} · atualizado às ${new Date(e.carregadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}${e.atualizando ? " · atualizando…" : ""}`
              : "Carregando…"}
          {carregado && !podeEditar ? (
            <span className="chip gray recursos-leitura">
              <i className="fa-solid fa-eye" aria-hidden="true" /> Somente
              consulta
            </span>
          ) : null}
        </p>
        <div className="recursos-barra-acoes">
          <button
            type="button"
            className="btn secondary"
            disabled={!carregado || e.atualizando}
            onClick={() => void estado.carregar(area)}
          >
            <i className="fa-solid fa-rotate" aria-hidden="true" /> Atualizar
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={!carregado || !filtrados.length}
            onClick={() => estado.exportarCsv(filtrados, origens)}
          >
            <i className="fa-solid fa-download" aria-hidden="true" /> Exportar
            CSV
          </button>
          {podeEditar ? (
            <button
              type="button"
              className="btn"
              disabled={Boolean(e.acao)}
              onClick={estado.abrirNovo}
            >
              <i className="fa-solid fa-plus" aria-hidden="true" /> Novo recurso
            </button>
          ) : null}
        </div>
      </div>

      {e.area === area && e.erroAoCarregar && !carregado ? (
        <div className="card recursos-erro" role="alert">
          <p>
            Não foi possível carregar os recursos.{" "}
            <small>{e.erroAoCarregar}</small>
          </p>
          <button
            type="button"
            className="btn secondary"
            onClick={() => void estado.carregar(area)}
          >
            <i className="fa-solid fa-rotate-right" aria-hidden="true" /> Tentar
            de novo
          </button>
        </div>
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
        aoFiltrar={mudarFiltro}
      />
      <Graficos
        recursos={filtrados}
        pendencias={pendencias}
        carregado={carregado}
        filtros={filtros}
        aoFiltrar={mudarFiltro}
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

      {/* Com o formulário aberto, a gaveta sai de cena e volta quando ele fecha. */}
      {aberto && !e.formulario ? (
        <GavetaDoRecurso
          estado={estado}
          recurso={aberto}
          detalhe={e.detalhes.get(aberto.id)}
          origens={origens}
          podeEditar={podeEditar}
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
    </div>
  );
}

/**
 * Monta a página em `#page-recursos` e devolve o controlador que o legado
 * chama (`window.recursosController`).
 */
export function montarRecursos({
  secao = document.getElementById("page-recursos"),
  supabase = getSupabaseClient(),
  toast,
  getProfile,
  baixar,
} = {}) {
  const estado = criarEstadoDosRecursos({
    supabase,
    toast,
    getProfile,
    baixar,
  });
  let raiz = null;
  if (secao) {
    raiz = createRoot(secao);
    raiz.render(
      <StrictMode>
        <Recursos estado={estado} />
      </StrictMode>,
    );
  }
  return {
    estado,
    raiz,
    /* Abrir a página ativa a carga (a primeira vez) e revalida depois. */
    render: () => estado.ativar(),
  };
}
