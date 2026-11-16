import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import {
  Abas,
  Aviso,
  CabecalhosDaTabela,
  CardDaLista,
  LinhasEsqueleto,
  TopoDoPainel,
} from "../../ui/index.ts";
import type { ColunaDaTabela } from "../../ui/index.ts";
import { Icone } from "../../componentes/icone.tsx";
import { formatNumberBR } from "../../lib/formatters";
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { getSupabaseClient } from "../../lib/supabaseClient";
import {
  LINHAS_POR_PAGINA,
  RELATORIOS_DOS_PAINEIS,
  definicaoDoRelatorio,
  paginaDaTabela,
  textoDaCelula,
} from "../../lib/relatorios-dos-paineis.ts";
import type {
  IdDoRelatorio,
  LinhaDoRelatorio,
} from "../../lib/relatorios-dos-paineis.ts";
import { criarEstadoDosPaineis } from "./estado.ts";
import { GavetaDeFontes } from "./fontes-dos-dados.tsx";
import type {
  ClienteDosPaineis,
  EstadoDaTelaDePaineis,
  LeituraDoRelatorio,
  OpcoesDoEstadoDosPaineis,
} from "./estado.ts";

/*
  Painéis (bloco Dados do menu, em cada área): os relatórios de conferência
  da área escolhida — Resumo dos editais, Editais por cargo e Aprovados —, um
  por aba, em tabela, com o download em CSV e XLSX do que está na tabela.
  Recurso de permissão `paineis_dados`; aba `paineis-de-dados` no catálogo
  (`src/lib/menu-lateral.ts`). As colunas e os arquivos são de
  `src/lib/relatorios-dos-paineis.ts`; o estado, de `./estado.ts`. Título e
  área ficam no cabeçalho da casca.
*/

const ABAS = RELATORIOS_DOS_PAINEIS.map((r) => ({
  id: r.id,
  rotulo: r.rotulo,
  idDaAba: `paineis-aba-${r.id}`,
  idDoPainel: `paineis-painel-${r.id}`,
}));

const HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

interface PropriedadesDaTabelaPaginada {
  rotulo: string;
  colunas: ReadonlyArray<ColunaDaTabela>;
  linhas: readonly LinhaDoRelatorio[];
  linha: (item: LinhaDoRelatorio, indice: number) => ReactNode;
  carregado: boolean;
  porPagina: number;
  aoMudarPorPagina: (porPagina: number) => void;
}

/*
  A tabela do relatório, uma página por vez (o mesmo visual da lista de
  src/ui/: caixa que rola e cabeçalho fixo), com a paginação numa barra
  acima da tabela (`data-paginacao`). A página volta à 1
  quando o relatório, a área ou a leitura mudam (quem usa troca a `key`) e
  quando muda o tamanho da página.
*/
function TabelaPaginada({
  rotulo,
  colunas,
  linhas,
  linha,
  carregado,
  porPagina,
  aoMudarPorPagina,
}: PropriedadesDaTabelaPaginada) {
  const [pedida, setPedida] = useState(1);
  const idDoTamanho = useId();
  const { pagina, paginas, inicio, fim, total } = paginaDaTabela(
    carregado ? linhas.length : 0,
    pedida,
    porPagina,
  );
  const ir = (destino: number) => setPedida(destino);

  return (
    <>
      <div className="ui-barra-da-lista" data-paginacao="">
        <span className="ui-lista-contagem" aria-live="polite">
          {!carregado
            ? "Carregando…"
            : total
              ? `Mostrando ${formatNumberBR(inicio + 1)}–${formatNumberBR(fim)} de ${formatNumberBR(total)}`
              : "Nenhum registro"}
        </span>
        <label htmlFor={idDoTamanho}>Linhas por página</label>
        <select
          id={idDoTamanho}
          value={porPagina}
          disabled={!carregado}
          onChange={(evento) => {
            setPedida(1);
            aoMudarPorPagina(Number(evento.target.value));
          }}
        >
          {[...LINHAS_POR_PAGINA]
            .sort((a, b) => a - b)
            .map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
        </select>
        <span className="ui-acoes">
          <button
            type="button"
            className="btn icon outline"
            aria-label="Página anterior"
            disabled={!carregado || pagina <= 1}
            onClick={() => ir(pagina - 1)}
          >
            <Icone nome="chevron-left" tamanho={16} />
          </button>
          <span aria-live="polite">
            Página {formatNumberBR(pagina)} de {formatNumberBR(paginas)}
          </span>
          <button
            type="button"
            className="btn icon outline"
            aria-label="Próxima página"
            disabled={!carregado || pagina >= paginas}
            onClick={() => ir(pagina + 1)}
          >
            <Icone nome="chevron-right" tamanho={16} />
          </button>
        </span>
      </div>
      <div className="ui-tabela-rolagem ui-lista-rolagem">
        <table aria-label={rotulo} data-mobile-table="scroll">
          <CabecalhosDaTabela colunas={colunas} />
          <tbody aria-busy={carregado ? undefined : true}>
            {carregado ? (
              linhas
                .slice(inicio, fim)
                .map((item, i) => linha(item, inicio + i))
            ) : (
              <LinhasEsqueleto colunas={colunas.length} />
            )}
          </tbody>
        </table>
        {carregado && !total ? (
          <div className="ui-lista-vazia" role="status">
            <strong>Ninguém por aqui</strong>
            <span>Nenhum registro nesta área.</span>
          </div>
        ) : null}
      </div>
    </>
  );
}

/* A data da última leitura do relatório aberto, discreta, no topo da página. */
function textoDaSincronizacao(leitura: LeituraDoRelatorio) {
  if (leitura.situacao === "carregando") return "Sincronizando…";
  if (leitura.situacao === "erro") return "Sem dados";
  if (leitura.situacao === "pronto" && leitura.geradoEm)
    return `Sincronizado em ${HORA.format(new Date(leitura.geradoEm))}`;
  return "";
}

function Relatorio({ estado }: { estado: EstadoDaTelaDePaineis }) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const definicao = definicaoDoRelatorio(e.ativo);
  const leitura = e.relatorios[definicao.id];
  const carregado = leitura.situacao === "pronto";
  const [porPagina, setPorPagina] = useState(LINHAS_POR_PAGINA[0] as number);

  const fontes = leitura.fontes;
  const colunas = useMemo<ColunaDaTabela[]>(
    () =>
      definicao.colunas.map((c) => {
        // Coluna com fonte diferente do padrão: marcador discreto, com a fonte na dica.
        const fonte = fontes[c.campo];
        const diferente = fonte && !fonte.padrao;
        return {
          rotulo: c.rotulo,
          chave: c.campo,
          numero: c.tipo === "inteiro" || c.tipo === "decimal",
          ...(diferente
            ? {
                dica: `Fonte: ${fonte.rotulo}`,
                cabecalho: (
                  <>
                    {c.rotulo}{" "}
                    <span
                      data-fonte-diferente=""
                      aria-label="fonte diferente do padrão"
                    >
                      *
                    </span>
                  </>
                ),
              }
            : {}),
        };
      }),
    [definicao, fontes],
  );
  const linha = useCallback(
    (item: LinhaDoRelatorio, indice: number) => (
      <tr key={indice}>
        {definicao.colunas.map((c) => (
          <td
            key={c.campo}
            data-label={c.rotulo}
            className={
              c.tipo === "inteiro" || c.tipo === "decimal" ? "num" : undefined
            }
          >
            {textoDaCelula(c, item[c.campo])}
          </td>
        ))}
      </tr>
    ),
    [definicao],
  );

  return (
    <div
      role="tabpanel"
      id={`paineis-painel-${definicao.id}`}
      aria-labelledby={`paineis-aba-${definicao.id}`}
    >
      <CardDaLista rotulo={definicao.rotulo}>
        <div className="ui-barra-da-lista">
          <button
            type="button"
            className="btn secondary small"
            onClick={() => void estado.baixar("CSV")}
            disabled={!carregado || e.baixando !== null}
          >
            {e.baixando === "CSV" ? "Gerando CSV…" : "Baixar CSV"}
          </button>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => void estado.baixar("XLSX")}
            disabled={!carregado || e.baixando !== null}
          >
            {e.baixando === "XLSX" ? "Gerando XLSX…" : "Baixar XLSX"}
          </button>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => void estado.abrirFontes()}
            disabled={!e.area}
          >
            Fontes dos dados
          </button>
        </div>
        {carregado
          ? leitura.avisos.map((aviso) => (
              <Aviso key={aviso} tom="warning" papel="status">
                {aviso}
              </Aviso>
            ))
          : null}
        {leitura.situacao === "erro" ? (
          <Aviso tom="danger" papel="alert">
            {leitura.erro}
          </Aviso>
        ) : (
          <TabelaPaginada
            key={`${definicao.id}:${leitura.area}:${leitura.geradoEm}`}
            rotulo={definicao.rotulo}
            colunas={colunas}
            linhas={leitura.linhas}
            linha={linha}
            carregado={carregado}
            porPagina={porPagina}
            aoMudarPorPagina={setPorPagina}
          />
        )}
      </CardDaLista>
      {e.erroNoDownload ? (
        <Aviso tom="danger" papel="alert">
          {e.erroNoDownload}
        </Aviso>
      ) : null}
    </div>
  );
}

export function TelaDePaineisDeDados({
  estado,
}: {
  estado: EstadoDaTelaDePaineis;
}) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const { area: areaDoApp } = usarAreaAtual();

  /*
    A área do app mudou com a tela já aberta: lê a nova. Quem abre a tela é o
    `render()` do controlador — antes dele (`e.area` vazio), nada é pedido.
  */
  useEffect(() => {
    const { area } = estado.obter();
    if (area && areaDoApp && area !== areaDoApp)
      void estado.carregar(areaDoApp);
  }, [estado, areaDoApp]);

  const leitura = e.relatorios[e.ativo];
  return (
    <div className="ui-tela paineis-tela">
      <TopoDoPainel
        status={textoDaSincronizacao(leitura)}
        aoAtualizar={() => void estado.sincronizar()}
        atualizarDesativado={!e.area || leitura.situacao === "carregando"}
        rotuloDaAtualizacao="Sincronizar"
      />
      <Abas
        rotulo="Relatórios dos Painéis"
        abas={ABAS}
        ativa={e.ativo}
        aoEscolher={(id) => void estado.escolher(id as IdDoRelatorio)}
      />
      <Relatorio estado={estado} />
      <GavetaDeFontes estado={estado} />
    </div>
  );
}

export interface OpcoesDaTelaDePaineis extends OpcoesDoEstadoDosPaineis {
  areaAtual?: () => string | null | undefined;
}

/**
 * Cria a tela (rota `paineis-de-dados`, src/app/telas.tsx): o conteúdo React,
 * o estado e `render()` a cada abertura (lê a área atual do app).
 */
export function criarPaineisDeDados({
  supabase = getSupabaseClient() as ClienteDosPaineis | null,
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
  ...opcoes
}: OpcoesDaTelaDePaineis = {}) {
  const estado = criarEstadoDosPaineis({ supabase, ...opcoes });
  return {
    estado,
    nome: "a tela de Painéis",
    conteudo: <TelaDePaineisDeDados estado={estado} />,
    render() {
      return estado.carregar(String(areaAtual() ?? "").trim());
    },
  };
}
