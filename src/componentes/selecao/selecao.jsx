import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { montarModulo } from "../../app/montar-modulo.jsx";
import {
  definirCarregamentoDoPainel,
  mostrarErroDoCarregamento,
} from "../../analises/analises-loading-feedback.js";
import {
  calcularIndicadores,
  dataHoraBR,
  FILTROS_VAZIOS,
  filtrarVagas,
  observacoesDoRecorte,
  opcoesDosFiltros,
  textoDoRecorte,
} from "../../lib/selecao-do-painel.js";
import {
  alternarTemaDoPainel,
  temaEscuroDoPainel,
} from "../../lib/tema-do-painel.js";
import { EstadoVazio, PainelNoQuadro } from "../../ui/index.js";
import { criarAvisoDoPainel } from "../aviso-do-painel.js";
import { criarEstadoDaSelecao, MENSAGEM_SEM_ACESSO } from "./estado.js";
import {
  Filtros,
  Graficos,
  Indicadores,
  Observacoes,
  Recorte,
  Topo,
} from "./paineis.jsx";
import { MENSAGEM_SEM_VAGAS, TabelaDeVagas } from "./tabela.jsx";

/*
  Painel de seleção (`selecao.html?area=`), em React: a mesma tela do antigo
  painel externo "AgSUS Monitora Recrutamento e Seleção" (Apps Script), agora
  com os dados do banco (get_selecao_da_area). Aberto dentro do MONITORA pela
  view `selecao` (src/modules/pagina-do-painel.js), num quadro; sozinho numa
  aba, funciona do mesmo jeito (a sessão do Supabase é a do navegador).

  Ordem da tela, a do painel antigo: filtros (DSEI, edital, cargo, vaga),
  sete KPIs, o recorte, cinco gráficos, os alertas da coluna Observação e a
  base operacional. Só leitura.
*/

const NUMEROS_ZERADOS = calcularIndicadores([]);

function textoDoStatus(e) {
  if (e.semSessao) return "Sessão não localizada";
  if (e.semAcesso) return "Sem acesso";
  if (e.erroAoCarregar && !e.carregado) return "Sem dados";
  if (!e.carregado) return "Carregando painel...";
  if (e.atualizando) return "Atualizando...";
  const carga = dataHoraBR(e.dados?.ultimaCarga?.em);
  return carga
    ? `Atualizado em ${carga}`
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
  const opcoes = useMemo(
    () => opcoesDosFiltros(vagas, filtros),
    [vagas, filtros],
  );
  const indicadores = useMemo(
    () => (carregado ? calcularIndicadores(filtradas) : NUMEROS_ZERADOS),
    [carregado, filtradas],
  );
  const observacoes = useMemo(
    () => observacoesDoRecorte(filtradas),
    [filtradas],
  );
  const vazio = carregado && !vagas.length;

  const trocarFiltro = (campo, valores) =>
    setFiltros((atuais) => ({ ...atuais, [campo]: valores }));
  const alternarUnidade = (unidade) =>
    setFiltros((atuais) => ({
      ...atuais,
      unidades:
        atuais.unidades.length === 1 && atuais.unidades[0] === unidade
          ? []
          : [unidade],
    }));

  return (
    <>
      <div className="shell">
        <Topo
          subtitulo={nomeDaArea}
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
                  <EstadoVazio>{MENSAGEM_SEM_VAGAS}</EstadoVazio>
                </section>
              ) : null}
              <Filtros
                filtros={filtros}
                opcoes={opcoes}
                area={area}
                carregado={carregado && !vazio}
                aoMudar={trocarFiltro}
              />
              <Indicadores indicadores={indicadores} />
              <Recorte texto={textoDoRecorte(filtros, area)} />
              <Graficos
                vagas={filtradas}
                indicadores={indicadores}
                area={area}
                escuro={escuro}
                aoFiltrarUnidade={alternarUnidade}
              />
              <Observacoes observacoes={observacoes} />
              <TabelaDeVagas
                vagas={filtradas}
                total={vagas.length}
                carregado={carregado}
                area={area}
              />
            </>
          )}
        </main>{" "}
      </div>
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
  const raizDoReact = raiz
    ? montarModulo(
        raiz,
        // Ainda no quadro (iframe): src/ui/ desenha a marcação do painel de análises.
        <PainelNoQuadro>
          <PainelDeSelecao
            estado={estado}
            area={area}
            nomeDaArea={nomeDaArea}
          />
        </PainelNoQuadro>,
        { flushSync: true, nome: "o painel de seleção" },
      ).raiz
    : null;
  return { estado, raiz: raizDoReact };
}
