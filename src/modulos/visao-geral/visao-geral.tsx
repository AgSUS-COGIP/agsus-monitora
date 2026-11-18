import type {
  Configuracoes,
  LinhaDaVisaoGeral,
  OpcoesDaTela,
  PropsDaTela,
  PropsDoPainel,
} from "./tipos.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ComponentType } from "react";
import { lazy, Suspense, useMemo, useState, useSyncExternalStore } from "react";
import { importarComRecarga } from "../../lib/carga/importar-com-recarga.ts";
import { estadoDasConfiguracoes } from "../configuracoes/estado.ts";
import { getSupabaseClient } from "../../lib/sessao/supabaseClient";
import {
  temProcessosPorProjeto,
  textosDaVisaoGeral,
} from "../../lib/visao-geral/visao-geral.ts";
import {
  MAPA_DOS_DSEIS,
  MAPA_DOS_MUNICIPIOS,
  mapaDaVisaoGeral,
} from "../../lib/visao-geral/visao-geral-da-area.ts";
import { criarCarregadorDeMunicipios } from "../mapa-de-projetos/carregador.ts";
// O mapa de Projetos (e o Leaflet) baixa quando monta: ./mapas-sob-demanda.tsx.
import { MapaDeProjetos } from "./mapas-sob-demanda.tsx";
import type { PropsDoCartaoDoMapa } from "./cartao-do-mapa.tsx";
import { MarcosDoAno } from "./boas-vindas.tsx";
import {
  buscarAcompanhamentoNoSupabase,
  estadoDaVisaoGeral,
} from "./estado.ts";
import { GavetaDoProcesso } from "./gaveta.tsx";
import {
  Cabecalho,
  EmAndamento,
  Filtros,
  PedeAcao,
  ProcessosPorProjeto,
  Vagas,
} from "./paineis.tsx";
import { TabelaDeProcessos } from "./tabela.tsx";
import {
  podeBaixarAprovados,
  secaoDeConfiguracaoPermitida,
} from "../../lib/acessos/access-roles.ts";
import type { ClienteDosAvisos } from "../conferencias/tipos.ts";
import { telaPermitida } from "../../lib/navegacao/navegacao.ts";
import { pedirFiltro } from "../../app/pedido-de-filtro.ts";
import { irParaTela, type JanelaDoApp } from "../../app/ir-para-tela.ts";
import { ErrorBoundary } from "../../app/ErrorBoundary.tsx";

type PerfilDaNavegacao = Parameters<typeof telaPermitida>[1];

/*
  A Visão geral (view `dashboard`), um módulo do app: monta direto na
  `<section id="page-dashboard">` do index.html. O legado continua dono da
  navegação (classe `.active`, título do cabeçalho por área com
  `cabecalhoDaVisaoGeral`, permissão `ind`) e da carga das linhas
  (`loadData` → dados-do-monitoramento.ts); a tela lê o estado
  (`estado.ts`); do banco, só os marcos do ano, o mapa de Projetos e o
  acompanhamento da área (etapas do cronograma e resumo das listas, pedido
  pelo estado com o cliente da tela). A seção existe desde o início, mas o
  conteúdo só monta na primeira abertura (`visitada`), e o acompanhamento só
  é pedido com a página aberta: quem não abre a Visão geral não paga por ela.

  Ordem (o "painel de decisão", layout A, 17/11/2026): o cabeçalho
  (saudação, editais com etapa na semana, hora da carga, Filtros, Atualizar
  e Exportar), os marcos do ano, os filtros (só abertos pelo botão; os chips
  do recorte sempre à vista), as vagas, "Pede ação" (críticos e
  pós-resultado) ao lado de "Em andamento, por fase", "Processos por
  projeto" (só Projetos), o MAPA DA ÁREA e a tabela de processos, com os
  detalhes numa gaveta.

  O MAPA DA ÁREA (`mapaDaVisaoGeral`):
  - Saúde Indígena: o cartão do Mapa (`cartao-do-mapa.tsx`), três números e
    "Abrir no mapa"; o mapa dos DSEIs é a aba Mapa (src/modulos/mapa/);
  - Projetos: `<MapaDeProjetos>` (src/modulos/mapa-de-projetos/), os
    lugares das vagas de todos os projetos, pedidos pelo carregador da tela
    (um por montagem, com cache) depois da primeira carga da página
    (`carregadoEm`), recortados pelas mesmas linhas filtradas da página;
  - SEDE: sem mapa.

  Textos de Configurações › Página inicial (publicados): filtros e rótulos
  dos indicadores (`textosDaVisaoGeral`).
*/

/*
  O cartão do Mapa (Saúde Indígena) baixa sob demanda: a contagem por DSEI e
  a lista dos 34 DSEIs ficam fora do pacote de entrada (orçamento de 320 KB
  gzip). Falhou o download, o cartão não aparece e o resto da página segue.
*/
const baixarCartaoDoMapa = importarComRecarga(() =>
  import("./cartao-do-mapa.tsx").then((modulo) => ({
    default: modulo.CartaoDoMapa,
  })),
);
const SemCartao = (_props: PropsDoCartaoDoMapa) => null;
const CartaoDoMapa = lazy<ComponentType<PropsDoCartaoDoMapa>>(() =>
  baixarCartaoDoMapa().catch(() => ({ default: SemCartao })),
);

/*
  O montador de relatório (e as regras do relatório e da diretoria) só abre no
  Exportar: chega por import(), fora do pacote de entrada (orçamento de
  bundle, `check:bundle-size`). Os Painéis já o pedem sob demanda.
*/
const MontadorDeRelatorio = lazy(
  importarComRecarga(() =>
    import("./montador-de-relatorio.tsx").then((m) => ({
      default: m.MontadorDeRelatorio,
    })),
  ),
);

function usarTextos(configuracoes: Configuracoes) {
  const { valores } = useSyncExternalStore(
    configuracoes.assinar,
    configuracoes.obter,
  );
  return useMemo(
    () => textosDaVisaoGeral((chave) => valores?.get?.(chave)),
    [valores],
  );
}

export function TelaDaVisaoGeral({
  estado,
  configuracoes,
  carregadorDeMunicipios,
  obterPerfil,
  supabase,
  comemoracoesLigadas,
  agora,
}: PropsDaTela) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const textos = usarTextos(configuracoes);
  const mapa = mapaDaVisaoGeral(e.area);
  const [aberta, setAberta] = useState<string | null>(null);
  // A seção da gaveta à vista: "avisos" quando veio do selo de Atenção.
  const [secaoDaGaveta, setSecaoDaGaveta] = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  // A linha aberta segue os dados: recarga atualiza a gaveta; se sumir, fecha.
  const abrir = (linha: LinhaDaVisaoGeral, secao = "") => {
    setSecaoDaGaveta(secao);
    setAberta(String(linha.id));
  };
  // A central de avisos (Configurações › Status das atualizações) é do administrador global.
  const perfilAtual = obterPerfil?.() || null;
  const abrirCentral = secaoDeConfiguracaoPermitida(perfilAtual, "cargas")
    ? () => {
        setAberta(null);
        (window as JanelaDoApp).navigate?.("config", { secao: "cargas" });
      }
    : null;
  const linhaAberta = aberta
    ? e.linhasDaArea.find((linha) => String(linha.id) === aberta) || null
    : null;
  // Montada escondida desde o início: nada (mapas, marcos) antes da primeira abertura.
  if (!e.visitada) return null;

  return (
    <div className="ui-tela visao-geral-tela">
      <Cabecalho
        e={e}
        perfil={obterPerfil?.() || null}
        agora={agora}
        filtrosAbertos={filtrosAbertos}
        aoAlternarFiltros={() => setFiltrosAbertos((valor) => !valor)}
        aoExportar={estado.abrirMontador}
      />
      <MarcosDoAno
        obterPerfil={obterPerfil}
        supabase={supabase}
        comemoracoesLigadas={comemoracoesLigadas}
      />
      <Filtros e={e} estado={estado} textos={textos} aberto={filtrosAbertos} />
      <Vagas e={e} textos={textos} />
      <div
        className="ui-linha-de-cards visao-geral-decisao"
        data-tour="visao-geral-fases-e-pos-resultado"
      >
        <PedeAcao e={e} estado={estado} textos={textos} />
        <EmAndamento e={e} estado={estado} />
      </div>
      {temProcessosPorProjeto(e.area) ? (
        <ProcessosPorProjeto e={e} estado={estado} />
      ) : null}
      {mapa === MAPA_DOS_DSEIS ? (
        <Suspense fallback={null}>
          <CartaoDoMapa linhas={e.linhasDaArea} carregado={e.carregado} />
        </Suspense>
      ) : null}
      {mapa === MAPA_DOS_MUNICIPIOS ? (
        <div className="visao-geral-mapa" data-tour="visao-geral-mapa-projetos">
          <MapaDeProjetos
            area={e.area}
            carregador={carregadorDeMunicipios}
            carregadoEm={e.carregadoEm}
            linhas={e.filtradas}
            filtroAtivo={e.temRecorte}
            perfil={obterPerfil?.()}
            supabase={supabase}
          />
        </div>
      ) : null}
      <TabelaDeProcessos
        e={e}
        estado={estado}
        textos={textos}
        agora={agora}
        aoAbrir={abrir}
        podeAbrirTela={(view) =>
          telaPermitida(view, (obterPerfil?.() || null) as PerfilDaNavegacao)
        }
        aoAbrirOrigem={(linha, origem) => {
          // A volta destaca a linha; a tela de destino abre já no edital.
          estado.sairPelaLinha(linha.id);
          pedirFiltro(origem.view, origem.pedido);
          irParaTela({ view: origem.view });
        }}
      />
      {e.montador && e.aberta ? (
        <ErrorBoundary nome="o montador de relatório">
          <Suspense fallback={null}>
            <MontadorDeRelatorio
              e={e}
              aoBaixarCsv={estado.exportarCsv}
              textos={textos}
              configuracoes={configuracoes}
              obterPerfil={obterPerfil}
              agora={agora}
              aoFechar={estado.fecharMontador}
              supabase={supabase}
              podeAprovados={podeBaixarAprovados(obterPerfil?.())}
            />
          </Suspense>
        </ErrorBoundary>
      ) : null}
      {linhaAberta ? (
        <GavetaDoProcesso
          linha={linhaAberta}
          area={e.area}
          supabase={supabase as ClienteDosAvisos | null}
          aoAbrirCentral={abrirCentral}
          secaoInicial={secaoDaGaveta}
          aoFechar={() => setAberta(null)}
          aoVoltarALinha={() => {
            setAberta(null);
            estado.destacar(linhaAberta.id);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Cria a Visão geral (rota `dashboard`, src/app/telas.tsx, no pacote
 * principal): o conteúdo React e o estado. Sem `render()` próprio: a página
 * aberta (src/app/pagina-aberta.ts) diz ao estado quando ela está à vista.
 */
export function criarVisaoGeral({
  estado = estadoDaVisaoGeral,
  configuracoes = estadoDasConfiguracoes,
  toast,
  obterPerfil = () => window.getMonitoraProfile?.() || null,
  supabase = getSupabaseClient(),
  comemoracoesLigadas = () => false,
  agora = () => new Date(),
  carregadorDeMunicipios = criarCarregadorDeMunicipios({
    obterSupabase: () => supabase,
  }),
}: OpcoesDaTela = {}) {
  estado.definirAviso(toast);
  estado.definirBuscaDoAcompanhamento(
    supabase ? buscarAcompanhamentoNoSupabase(supabase) : null,
  );
  return {
    estado,
    nome: "a Visão geral",
    conteudo: (
      <TelaDaVisaoGeral
        estado={estado}
        configuracoes={configuracoes}
        carregadorDeMunicipios={carregadorDeMunicipios}
        obterPerfil={obterPerfil}
        supabase={supabase}
        comemoracoesLigadas={comemoracoesLigadas}
        agora={agora}
      />
    ),
    render() {},
  };
}
