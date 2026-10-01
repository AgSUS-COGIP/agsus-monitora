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
  filtrarAprovadosSemEntrevista,
  filtrarEntrevistas,
  opcoesDosFiltros,
  pendenciasDasEntrevistas,
} from "../../lib/entrevistas-do-painel.js";
import {
  alternarTemaDoPainel,
  temaEscuroDoPainel,
} from "../../lib/tema-do-painel.js";
import { criarAvisoDoPainel } from "../aviso-do-painel.js";
import { VisaoDeConducao } from "./conducao.jsx";
import { criarEstadoDaConducao } from "./estado-da-conducao.js";
import { criarEstadoDasEntrevistas, MENSAGEM_SEM_ACESSO } from "./estado.js";
import { GavetaDaEntrevista, GavetaDosSemEntrevista } from "./gaveta.jsx";
import { VisaoDeRoteiros } from "./roteiros.jsx";
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

  Três visões, no controle segmentado do cabeçalho:
  - "Resultados" (a primeira, só leitura): os dados da planilha de
    entrevistas, carregada no banco pela sincronização
    (`sincronizar_entrevistas`), e os das entrevistas conduzidas no sistema
    (a mesma TB_ENTREVISTA); a última carga, os KPIs, os gráficos, as
    pendências (aprovados sem entrevista, entrevistas sem análise, sem edital
    e com nota divergente), a tabela e a gaveta com o caminho do candidato.
  - "Conduzir entrevistas" (conducao.jsx): configurar, convocar e lançar as
    notas de um edital. Cada gravação que muda o resultado relê "Resultados".
  - "Roteiros" (roteiros.jsx): os modelos de entrevista, com versões.
  Quem não edita as entrevistas vê as duas últimas só para consulta.

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
    ? `Carga ${carga}`
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

export const VISOES = Object.freeze([
  Object.freeze({
    valor: "resultados",
    rotulo: "Resultados",
    icone: "fa-chart-column",
  }),
  Object.freeze({
    valor: "conduzir",
    rotulo: "Conduzir entrevistas",
    icone: "fa-file-circle-check",
  }),
  Object.freeze({
    valor: "roteiros",
    rotulo: "Roteiros",
    icone: "fa-list-check",
  }),
]);

export function PainelDeEntrevistas({ estado, conducao, area, nomeDaArea }) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const [visao, setVisao] = useState("resultados");
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
          subtitulo={nomeDaArea}
          status={textoDoStatus(e)}
          escuro={escuro}
          aoTema={() => setEscuro(alternarTemaDoPainel())}
          aoTelaCheia={alternarTelaCheia}
          aoAtualizar={() => {
            void estado.carregar(area);
            if (visao === "conduzir" && conducao.obter().editalId)
              void conducao.recarregarEdital();
            if (visao === "roteiros") void conducao.carregarRoteiros(area);
          }}
          atualizarDesativado={e.atualizando || e.semSessao}
          aoExportar={() => estado.exportarCsv(filtradas)}
          exportarDesativado={!carregado || !filtradas.length}
          visoes={e.semAcesso || e.semSessao ? null : VISOES}
          visao={visao}
          aoTrocarVisao={setVisao}
        />
        <main className="content">
          {e.semSessao ? (
            <section id="authWarning" className="auth-warning" role="alert">
              {e.erroAoCarregar}
            </section>
          ) : null}
          {e.semAcesso ? <SemAcesso mensagem={e.erroAoCarregar} /> : null}

          {e.semAcesso || e.semSessao || visao !== "conduzir" ? null : (
            <VisaoDeConducao
              conducao={conducao}
              area={area}
              entrevistasDoPainel={entrevistas}
            />
          )}
          {e.semAcesso || e.semSessao || visao !== "roteiros" ? null : (
            <VisaoDeRoteiros conducao={conducao} area={area} />
          )}

          {e.semAcesso || visao !== "resultados" ? null : (
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
              <Recorte ativos={ativos} />
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
        </main>{" "}
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
  const conducao = criarEstadoDaConducao({
    supabase,
    toast,
    // Notas, convocação e desconvocação mudam o que "Resultados" mostra.
    aoMudarResultados: () => void estado.carregar(),
  });
  const raizDoReact = raiz
    ? montarModulo(
        raiz,
        <PainelDeEntrevistas
          estado={estado}
          conducao={conducao}
          area={area}
          nomeDaArea={nomeDaArea}
        />,
        { flushSync: true, nome: "o painel de entrevistas" },
      ).raiz
    : null;
  return { estado, conducao, raiz: raizDoReact };
}
