import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  BotoesDeExportacao,
  baixarArquivo,
} from "../../ui/botoes-de-exportacao.tsx";
import type { ReactNode } from "react";
import {
  Aviso,
  CabecalhosDaTabela,
  CardDaLista,
  LinhasEsqueleto,
  Popover,
  TopoDoPainel,
} from "../../ui/index.ts";
import type { ColunaDaTabela } from "../../ui/index.ts";
import { Icone } from "../../componentes/icone.tsx";
import { formatNumberBR } from "../../lib/base/formatters";
import {
  assinarDadosDoMonitoramento,
  obterDadosDoMonitoramento,
  pedirLinhasDoMonitoramento,
} from "../../componentes/dados-do-monitoramento.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { getSupabaseClient } from "../../lib/sessao/supabaseClient";
import { usarLojaNaUrl } from "../../app/usar-filtros-na-url.ts";
import { usarPedidoDeFiltro } from "../../app/pedido-de-filtro.ts";
import { carregarTela } from "../../app/registro-das-telas.ts";
import type { EsquemaDosFiltros } from "../../app/filtros-no-endereco.ts";
import {
  catalogoPermitido,
  ehIdDoRelatorio,
  ehRelatorioDoEndereco,
  gruposDoCatalogo,
} from "../../lib/paineis/catalogo-dos-relatorios.ts";
import type { RelatorioDoCatalogo } from "../../lib/paineis/catalogo-dos-relatorios.ts";
import {
  editaisDoEndereco,
  editaisParaOEndereco,
  ehOrigemDoRecorte,
} from "../../lib/paineis/endereco-dos-relatorios.ts";
import type { OrigemDoRecorte } from "../../lib/paineis/endereco-dos-relatorios.ts";
import {
  LINHAS_POR_PAGINA,
  definicaoDoRelatorio,
  larguraArrastada,
  linhasDaOrigem,
  paginaDaTabela,
  textoDaCelula,
} from "../../lib/paineis/relatorios-dos-paineis.ts";
import type {
  IdDoRelatorio,
  LinhaDoRelatorio,
} from "../../lib/paineis/relatorios-dos-paineis.ts";
import { podeBaixarAprovados } from "../../lib/acessos/access-roles.ts";
import { textosDaVisaoGeral } from "../../lib/visao-geral/visao-geral.ts";
import { recorteDaAreaInteira } from "../../lib/paineis/relatorio-da-visao-geral.ts";
import type { RecorteDoRelatorio } from "../../lib/paineis/relatorio-da-visao-geral.ts";
import { estadoDasConfiguracoes } from "../configuracoes/estado.ts";
import { estadoDaVisaoGeral } from "../visao-geral/estado.ts";
import { CHAVE_DO_CABECALHO } from "../../lib/base/cabecalho-dos-documentos.ts";
import { MontadorDeRelatorio } from "./montador-de-relatorio.tsx";
import type { ClienteDoRelatorio } from "./dados-da-diretoria.ts";
import {
  escolhaDaDiretoria,
  gerarRelatorio,
  mensagemDaFalha,
} from "./gerar-relatorio.ts";
import { RelatorioResumoPorCargo } from "./resumo-por-cargo.tsx";
import type { EstadoDosAprovados } from "../aprovados/tipos-do-estado.ts";
import type {
  Configuracoes,
  LinhaDaVisaoGeral,
  Perfil,
} from "../visao-geral/tipos.ts";
import { criarEstadoDosPaineis } from "./estado.ts";
import { GavetaDeFontes } from "./fontes-dos-dados.tsx";
import "./paineis-de-dados.css";
import type {
  ClienteDosPaineis,
  EstadoDaTelaDePaineis,
  LeituraDoRelatorio,
  OpcoesDoEstadoDosPaineis,
} from "./estado.ts";

/*
  Relatórios (bloco Dados do menu, em cada área; antes "Painéis"): os
  relatórios de acompanhamento e gestão da área escolhida, que cruzam
  editais. A entrada é o catálogo — um cartão por relatório, em grupos
  (Editais, Aprovados, Produtividade), com o que ele mostra, quando foi
  calculado e os botões de exportar —; abrir um cartão mostra a tabela
  paginada dele, com "Todos os relatórios" para voltar. O relatório aberto
  fica no endereço (`/<área>/relatorios?relatorio=<id>`): link copiado,
  voltar do navegador e atalho de outra tela abrem direto nele.

  Recurso de permissão `paineis_dados`; aba e view `paineis-de-dados` no
  catálogo (`src/lib/navegacao/menu-lateral.ts`). Os cartões e os grupos são
  de `src/lib/paineis/catalogo-dos-relatorios.ts`; as colunas e os arquivos
  dos relatórios calculados, de `src/lib/paineis/relatorios-dos-paineis.ts`;
  o estado deles, de `./estado.ts`. Título e área ficam no cabeçalho da casca.

  Os outros cartões (23/11/2026, vindos da Visão geral e da Lista de
  aprovados, que ficaram com o atalho "Ver em Relatórios"):
  - "Montar relatório" abre o montador (./montador-de-relatorio.tsx) com os
    editais da área — ou, com `origem=visao-geral` no endereço, com a Visão
    geral como estava (filtros, busca e atalho);
  - "Relatório da diretoria" gera direto do cartão o modelo Diretoria
    (./gerar-relatorio.ts);
  - "Resumo por cargo e status" (só com o recurso `aprovados`) abre a
    contagem sobre a Lista de aprovados (./resumo-por-cargo.tsx; o estado é
    o da tela `approved`, pedido sob demanda), com os editais no endereço
    (`edital=7,8`).
  O atalho de outra tela chega pelo endereço (a tela ainda não montada) e
  pelo pedido de filtro (já montada).
*/

/** A view da tela (rota em src/lib/navegacao/rotas.ts; o caminho é `relatorios`). */
const VIEW_DOS_RELATORIOS = "paineis-de-dados";

/*
  O relatório aberto no endereço (`?relatorio=<id>`; sem ele, o catálogo), o
  recorte do montador (`origem=visao-geral`) e os editais do Resumo por cargo
  (`edital=7,8`).
*/
type CampoDoEndereco = "relatorio" | "origem" | "edital";
const ESQUEMA_DO_RELATORIO: EsquemaDosFiltros<CampoDoEndereco> = Object.freeze({
  relatorio: { padrao: "", empilha: true, aceita: ehRelatorioDoEndereco },
  origem: { padrao: "", aceita: (v: string) => ehOrigemDoRecorte(v) },
  edital: { padrao: "" },
});

/** O que abre por cima do catálogo e não é relatório calculado. */
type Extra = "" | "montar-relatorio" | "resumo-por-cargo";

const EM_BRANCO = "Gerado na hora, com os editais da área";

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
  /** As linhas da página à vista (o banco já recortou). */
  linhas: readonly LinhaDoRelatorio[];
  linha: (item: LinhaDoRelatorio, indice: number) => ReactNode;
  carregado: boolean;
  pagina: number;
  porPagina: number;
  total: number;
  aoIrPara: (pagina: number) => void;
  aoMudarPorPagina: (porPagina: number) => void;
  /** A soma das larguras escolhidas (px): a tabela vai a layout fixo. */
  larguraDaTabela: number | null;
}

/** Quanto ←/→ na alça muda a largura da coluna (px). */
const PASSO_DO_TECLADO = 16;

/*
  A alça na borda direita do cabeçalho: arrastar (ou ←/→ com o foco nela)
  muda a largura da coluna. `aoComecar` devolve a largura de partida (e
  congela as das outras colunas); `aoMudar` grava a nova.
*/
function AlcaDaColuna({
  rotulo,
  aoComecar,
  aoMudar,
}: {
  rotulo: string;
  aoComecar: (th: HTMLElement) => number;
  aoMudar: (largura: number) => void;
}) {
  // O arraste em curso: soltar também quando a tabela sai da tela no meio dele.
  const soltarArraste = useRef<(() => void) | null>(null);
  useEffect(() => () => soltarArraste.current?.(), []);
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Largura — ${rotulo}`}
      tabIndex={0}
      className="paineis-alca-da-coluna"
      data-alca-da-coluna=""
      onClick={(evento) => evento.stopPropagation()}
      onPointerDown={(evento) => {
        const th = evento.currentTarget.closest("th");
        if (!th) return;
        evento.preventDefault();
        evento.stopPropagation();
        const base = aoComecar(th);
        const inicio = evento.clientX;
        const mover = (m: MouseEvent) =>
          aoMudar(larguraArrastada(base, m.clientX - inicio));
        // No toque, o navegador que assume a rolagem manda `pointercancel`,
        // não `pointerup`: os dois encerram o arraste.
        const soltar = () => {
          window.removeEventListener("pointermove", mover);
          window.removeEventListener("pointerup", soltar);
          window.removeEventListener("pointercancel", soltar);
          soltarArraste.current = null;
        };
        soltarArraste.current?.();
        soltarArraste.current = soltar;
        window.addEventListener("pointermove", mover);
        window.addEventListener("pointerup", soltar);
        window.addEventListener("pointercancel", soltar);
      }}
      onKeyDown={(evento) => {
        if (evento.key !== "ArrowLeft" && evento.key !== "ArrowRight") return;
        const th = evento.currentTarget.closest("th");
        if (!th) return;
        evento.preventDefault();
        const base = aoComecar(th);
        aoMudar(
          larguraArrastada(
            base,
            evento.key === "ArrowLeft" ? -PASSO_DO_TECLADO : PASSO_DO_TECLADO,
          ),
        );
      }}
    />
  );
}

/*
  A tabela do relatório, uma página por vez (o mesmo visual da lista de
  src/ui/: caixa que rola e cabeçalho fixo), com a paginação numa barra
  acima da tabela (`data-paginacao`). A página, o tamanho e o total vêm do
  banco (ler_relatorio_do_painel); enquanto a página carrega, as setas e o
  tamanho ficam travados.
*/
function TabelaPaginada({
  rotulo,
  colunas,
  linhas,
  linha,
  carregado,
  pagina: pedida,
  porPagina,
  total: totalDoBanco,
  aoIrPara,
  aoMudarPorPagina,
  larguraDaTabela,
}: PropriedadesDaTabelaPaginada) {
  const idDoTamanho = useId();
  const { pagina, paginas, inicio, fim, total } = paginaDaTabela(
    carregado ? totalDoBanco : 0,
    pedida,
    porPagina,
  );
  const ir = (destino: number) => aoIrPara(destino);

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
          onChange={(evento) => aoMudarPorPagina(Number(evento.target.value))}
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
        <table
          aria-label={rotulo}
          data-mobile-table="scroll"
          data-larguras-escolhidas={larguraDaTabela ? "" : undefined}
          style={
            larguraDaTabela ? { width: `${larguraDaTabela}px` } : undefined
          }
        >
          <CabecalhosDaTabela colunas={colunas} />
          <tbody aria-busy={carregado ? undefined : true}>
            {carregado ? (
              linhas.map((item, i) => linha(item, inicio + i))
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

/* A data do cálculo do relatório aberto (no banco), discreta, no topo da página. */
function textoDaSincronizacao(leitura: LeituraDoRelatorio) {
  if (leitura.situacao === "carregando") return "Sincronizando…";
  if (leitura.situacao === "erro") return "Sem dados";
  if (leitura.situacao === "pronto" && leitura.calculadoEm)
    return `Sincronizado em ${HORA.format(new Date(leitura.calculadoEm))}`;
  return "";
}

/* A linha do cartão: quando foi calculado e quantas linhas tem. */
function textoDoCartao(leitura: LeituraDoRelatorio) {
  if (leitura.situacao === "erro") return "Sem dados";
  if (leitura.situacao !== "pronto") return "Carregando…";
  const linhas = `${formatNumberBR(leitura.total)} ${leitura.total === 1 ? "linha" : "linhas"}`;
  return leitura.calculadoEm
    ? `Calculado em ${HORA.format(new Date(leitura.calculadoEm))} · ${linhas}`
    : linhas;
}

/* A linha de cada cartão que não é calculado no banco. */
const LINHA_DO_TIPO: Readonly<Record<string, string>> = Object.freeze({
  montador: EM_BRANCO,
  diretoria: EM_BRANCO,
  "resumo-por-cargo": "Contado na hora, da lista de aprovados vigente",
});

function CartaoDoRelatorio({
  estado,
  item,
  aoAbrir,
  aoGerarDiretoria,
}: {
  estado: EstadoDaTelaDePaineis;
  item: RelatorioDoCatalogo;
  aoAbrir: () => void;
  aoGerarDiretoria: (formato: "PDF" | "XLSX") => Promise<void>;
}) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const idDoTitulo = useId();
  const id = item.id;
  const leitura = ehIdDoRelatorio(id) ? e.relatorios[id] : null;
  const pronto = leitura?.situacao === "pronto";
  return (
    <article
      className="ui-card relatorios-cartao"
      aria-labelledby={idDoTitulo}
      data-relatorio={id}
    >
      <h3 className="ui-titulo" id={idDoTitulo}>
        {item.nome}
      </h3>
      <p className="relatorios-cartao-resumo">{item.resumo}</p>
      {item.regra ? (
        <p className="relatorios-cartao-regra" data-regra="">
          {item.regra}
        </p>
      ) : null}
      <p className="ui-texto-secundario" data-calculo="" aria-live="polite">
        {leitura ? textoDoCartao(leitura) : LINHA_DO_TIPO[item.tipo]}
      </p>
      <div className="relatorios-cartao-acoes">
        {item.tipo === "diretoria" ? null : (
          <button
            type="button"
            className="btn secondary small"
            data-acao="abrir-relatorio"
            aria-label={`Abrir ${item.nome}`}
            disabled={!e.area}
            onClick={aoAbrir}
          >
            {item.tipo === "montador" ? "Montar" : "Abrir"}
          </button>
        )}
        {ehIdDoRelatorio(id) ? (
          <BotoesDeExportacao
            pequenos
            desativado={!pronto || e.baixando !== null}
            excel={() => estado.baixar("XLSX", id)}
            pdf={() => estado.baixar("PDF", id)}
          />
        ) : null}
        {item.tipo === "diretoria" ? (
          <BotoesDeExportacao
            pequenos
            desativado={!e.area}
            excel={() => aoGerarDiretoria("XLSX")}
            pdf={() => aoGerarDiretoria("PDF")}
          />
        ) : null}
      </div>
    </article>
  );
}

/*
  A entrada: os grupos com os cartões. A falha da leitura (sem permissão,
  sem a migration) aparece uma vez em cima, não em cada cartão.
*/
function CatalogoDosRelatorios({
  estado,
  relatorios,
  aoAbrir,
  aoGerarDiretoria,
  erroNaGeracao,
}: {
  estado: EstadoDaTelaDePaineis;
  relatorios: readonly RelatorioDoCatalogo[];
  aoAbrir: (id: RelatorioDoCatalogo["id"]) => void;
  aoGerarDiretoria: (formato: "PDF" | "XLSX") => Promise<void>;
  erroNaGeracao: string;
}) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const grupos = gruposDoCatalogo(relatorios);
  const erros = [
    ...new Set(
      Object.values(e.relatorios)
        .filter((l) => l.situacao === "erro" && l.erro)
        .map((l) => l.erro),
    ),
  ];
  return (
    <div className="relatorios-catalogo" data-catalogo-dos-relatorios="">
      {erros.map((erro) => (
        <Aviso key={erro} tom="danger" papel="alert">
          {erro}
        </Aviso>
      ))}
      {e.erroNoDownload ? (
        <Aviso tom="danger" papel="alert">
          {e.erroNoDownload}
        </Aviso>
      ) : null}
      {erroNaGeracao ? (
        <Aviso tom="danger" papel="alert">
          {erroNaGeracao}
        </Aviso>
      ) : null}
      {grupos.map((grupo) => (
        <section
          key={grupo.id}
          className="relatorios-grupo"
          aria-labelledby={`relatorios-grupo-${grupo.id}`}
        >
          <h2
            className="relatorios-grupo-titulo"
            id={`relatorios-grupo-${grupo.id}`}
          >
            {grupo.rotulo}
          </h2>
          <div className="relatorios-cartoes">
            {grupo.relatorios.map((item) => (
              <CartaoDoRelatorio
                key={item.id}
                estado={estado}
                item={item}
                aoAbrir={() => aoAbrir(item.id)}
                aoGerarDiretoria={aoGerarDiretoria}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* "Todos os relatórios" e o nome do relatório aberto. */
function BarraDeVoltar({
  titulo,
  aoVoltar,
}: {
  titulo: string;
  aoVoltar: () => void;
}) {
  return (
    <div className="relatorios-voltar">
      <button
        type="button"
        className="btn ghost small"
        data-acao="voltar-ao-catalogo"
        onClick={aoVoltar}
      >
        <Icone nome="chevron-left" tamanho={16} /> Todos os relatórios
      </button>
      <h2 className="ui-titulo">{titulo}</h2>
    </div>
  );
}

function Relatorio({
  estado,
  aoVoltar,
}: {
  estado: EstadoDaTelaDePaineis;
  aoVoltar: () => void;
}) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const definicao = definicaoDoRelatorio(e.ativo);
  const leitura = e.relatorios[definicao.id];
  const carregado = leitura.situacao === "pronto";
  const larguras = e.larguras[definicao.id];
  const origem = useMemo(
    () => linhasDaOrigem(definicao, leitura.fontes),
    [definicao, leitura.fontes],
  );

  /*
    A largura de partida de uma coluna. Na primeira vez, congela a largura
    medida de todas as colunas (para a tabela ir a layout fixo sem pular).
  */
  const comecar = useCallback(
    (campo: string, th: HTMLElement) => {
      const atuais = estado.obter().larguras[definicao.id];
      if (definicao.colunas.every((c) => atuais[c.campo] !== undefined))
        return atuais[campo] ?? 0;
      const cabecalhos = [...(th.parentElement?.children ?? [])];
      const medidas = Object.fromEntries(
        definicao.colunas.map((c, i) => [
          c.campo,
          atuais[c.campo] ??
            larguraArrastada(
              cabecalhos[i]?.getBoundingClientRect().width ?? 0,
              0,
            ),
        ]),
      );
      estado.mudarLarguras(medidas);
      return medidas[campo] ?? 0;
    },
    [estado, definicao],
  );
  const larguraDaTabela = definicao.colunas.every(
    (c) => larguras[c.campo] !== undefined,
  )
    ? definicao.colunas.reduce((soma, c) => soma + (larguras[c.campo] ?? 0), 0)
    : null;

  const fontes = leitura.fontes;
  const colunas = useMemo<ColunaDaTabela[]>(
    () =>
      definicao.colunas.map((c) => {
        // Coluna com fonte diferente do padrão: marcador discreto, com a fonte na dica.
        const fonte = fontes[c.campo];
        const diferente = fonte && !fonte.padrao;
        const largura = larguras[c.campo];
        return {
          rotulo: c.rotulo,
          chave: c.campo,
          numero: c.tipo === "inteiro" || c.tipo === "decimal",
          ...(largura !== undefined ? { largura: `${largura}px` } : {}),
          ...(diferente ? { dica: `Fonte: ${fonte.rotulo}` } : {}),
          cabecalho: (
            <>
              {c.rotulo}
              {diferente ? (
                <>
                  {" "}
                  <span
                    data-fonte-diferente=""
                    aria-label="fonte diferente do padrão"
                  >
                    *
                  </span>
                </>
              ) : null}
              <AlcaDaColuna
                rotulo={c.rotulo}
                aoComecar={(th) => comecar(c.campo, th)}
                aoMudar={(px) => estado.mudarLarguras({ [c.campo]: px })}
              />
            </>
          ),
        };
      }),
    [definicao, fontes, larguras, comecar, estado],
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
    <div className="relatorios-aberto" data-relatorio={definicao.id}>
      <BarraDeVoltar titulo={definicao.rotulo} aoVoltar={aoVoltar} />
      <CardDaLista rotulo={definicao.rotulo}>
        <div className="ui-barra-da-lista">
          <BotoesDeExportacao
            pequenos
            desativado={!carregado || e.baixando !== null}
            excel={() => estado.baixar("XLSX")}
            pdf={() => estado.baixar("PDF")}
          />
          <button
            type="button"
            className="btn secondary small"
            onClick={() => void estado.abrirFontes()}
            disabled={!e.area}
          >
            Fontes dos dados
          </button>
          <Popover
            rotulo="De onde vêm os dados"
            dica={origem.join(" ")}
            gatilho={<Icone nome="info" tamanho={16} />}
            lado="esquerda"
            acao="origem-dos-dados"
          >
            <div className="paineis-origem-dos-dados" data-origem-dos-dados="">
              {origem.map((texto) => (
                <p key={texto}>{texto}</p>
              ))}
            </div>
          </Popover>
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
            rotulo={definicao.rotulo}
            colunas={colunas}
            linhas={leitura.linhas}
            linha={linha}
            carregado={carregado}
            pagina={leitura.pagina}
            porPagina={leitura.porPagina}
            total={leitura.total}
            aoIrPara={(p) => void estado.irParaPagina(p)}
            aoMudarPorPagina={(n) => void estado.mudarPorPagina(n)}
            larguraDaTabela={larguraDaTabela}
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

/* O que os relatórios gerados no navegador precisam (vem da criação da tela). */
export interface ApoioDoRelatorio {
  /** Os editais da área, já enriquecidos (os da Visão geral, sem filtro). */
  linhasDaArea: () => readonly LinhaDaVisaoGeral[];
  /** A Visão geral como está (o recorte do "Ver em Relatórios"). */
  visaoGeral: () => RecorteDoRelatorio & { carregado: boolean };
  configuracoes: Configuracoes;
  obterPerfil: () => Perfil | null;
  agora: () => Date;
  supabase: ClienteDoRelatorio | null;
  /** O estado da Lista de aprovados (o Resumo por cargo e status). */
  aprovados: () => Promise<{ estado: EstadoDosAprovados }>;
  /**
   * Pede as linhas do monitoramento (os editais da área), que só são lidas
   * sob demanda (src/componentes/dados-do-monitoramento.ts); devolve a
   * devolução do pedido.
   */
  pedirLinhas: () => () => void;
  /** Pede as linhas e espera que cheguem (a diretoria, gerada no clique). */
  esperarLinhas: () => Promise<void>;
}

/* As linhas do monitoramento já lidas, ou o pedido até chegarem (ou falharem). */
function esperarLinhasDoMonitoramento(): Promise<void> {
  if (obterDadosDoMonitoramento().carregado) return Promise.resolve();
  const devolver = pedirLinhasDoMonitoramento();
  return new Promise((pronto, falhou) => {
    const parar = assinarDadosDoMonitoramento(() => {
      const { carregado, erro } = obterDadosDoMonitoramento();
      if (!carregado && !erro) return;
      parar();
      devolver();
      if (carregado) pronto();
      else falhou(new Error(erro));
    });
  });
}

function usarTextosDoRelatorio(configuracoes: Configuracoes) {
  const { valores } = useSyncExternalStore(
    configuracoes.assinar,
    configuracoes.obter,
  );
  return useMemo(
    () => textosDaVisaoGeral((chave) => valores?.get?.(chave)),
    [valores],
  );
}

/* O montador: a área inteira ou a Visão geral como estava (mesma área). */
function recorteDoMontador(
  apoio: ApoioDoRelatorio,
  area: string,
  origem: OrigemDoRecorte,
): { recorte: RecorteDoRelatorio; descricao: string } {
  if (origem === "visao-geral") {
    const visao = apoio.visaoGeral();
    if (visao.carregado && visao.area === area)
      return { recorte: visao, descricao: "do recorte da Visão geral" };
  }
  return {
    recorte: recorteDaAreaInteira(area, apoio.linhasDaArea()),
    descricao: "da área",
  };
}

/*
  O estado da Lista de aprovados, pedido quando o Resumo por cargo abre (a
  tela `approved` baixa sob demanda): o mesmo controlador da Lista, então a
  carga é uma só para as duas telas.
*/
function usarAprovados(ligado: boolean, apoio: ApoioDoRelatorio) {
  const [aprovados, setAprovados] = useState<{
    estado: EstadoDosAprovados;
  } | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!ligado || aprovados) return;
    let vivo = true;
    apoio
      .aprovados()
      .then((controlador) => {
        if (!vivo) return;
        setAprovados(controlador);
        void controlador.estado.garantirCarregado();
      })
      .catch((falha: unknown) => {
        if (vivo)
          setErro(
            falha instanceof Error && falha.message
              ? falha.message
              : "Não foi possível abrir a lista de aprovados.",
          );
      });
    return () => {
      vivo = false;
    };
  }, [ligado, aprovados, apoio]);
  return { aprovados, erro };
}

export function TelaDePaineisDeDados({
  estado,
  relatorio: apoio,
}: {
  estado: EstadoDaTelaDePaineis;
  relatorio: ApoioDoRelatorio;
}) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const { area: areaDoApp, carregado: linhasProntas } = usarAreaAtual();
  const textos = usarTextosDoRelatorio(apoio.configuracoes);
  const podeAprovados = podeBaixarAprovados(apoio.obterPerfil());
  const relatorios = catalogoPermitido({ aprovados: podeAprovados });
  // O montador e o Resumo por cargo abrem por cima do catálogo.
  const [extra, setExtra] = useState<Extra>("");
  /*
    O montador aberto e de onde vem o recorte. O recorte é tirado quando as
    linhas da área chegam e não muda com uma recarga no meio.
  */
  const [montando, setMontando] = useState<{
    origem: OrigemDoRecorte;
  } | null>(null);
  /*
    Os editais do Resumo no endereço; `vez` remonta o relatório quando eles
    chegam de fora (atalho, voltar do navegador), não quando a pessoa troca
    o filtro nele.
  */
  const [resumo, setResumo] = useState({ editais: "", vez: 0 });
  const [erroNaGeracao, setErroNaGeracao] = useState("");
  const { aprovados, erro: erroDosAprovados } = usarAprovados(
    extra === "resumo-por-cargo",
    apoio,
  );

  /*
    O montador e o Resumo precisam dos editais da área (as linhas do
    monitoramento, lidas só sob demanda): pedidas enquanto um deles está
    aberto.
  */
  useEffect(() => (extra ? apoio.pedirLinhas() : undefined), [extra, apoio]);
  const recorteMontado = useMemo(
    () =>
      montando && linhasProntas && e.area
        ? recorteDoMontador(apoio, e.area, montando.origem)
        : null,
    // Só ao abrir e quando as linhas chegam: uma recarga no meio não muda o montador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [montando, linhasProntas, e.area],
  );

  /*
    A área do app mudou com a tela já aberta: lê a nova. Quem abre a tela é o
    `render()` do controlador — antes dele (`e.area` vazio), nada é pedido.
  */
  useEffect(() => {
    const { area } = estado.obter();
    if (area && areaDoApp && area !== areaDoApp)
      void estado.carregar(areaDoApp);
  }, [estado, areaDoApp]);

  const aplicar = useRef<
    (parte: Partial<Record<CampoDoEndereco, string>>) => void
  >(() => {});
  aplicar.current = (parte) => {
    if (parte.edital !== undefined) {
      const editais = editaisParaOEndereco(editaisDoEndereco(parte.edital));
      setResumo((atual) =>
        atual.editais === editais ? atual : { editais, vez: atual.vez + 1 },
      );
    }
    const relatorio = parte.relatorio;
    if (relatorio === undefined) return;
    setErroNaGeracao("");
    if (ehIdDoRelatorio(relatorio)) {
      setExtra("");
      setMontando(null);
      void estado.abrir(relatorio);
      return;
    }
    if (
      relatorio === "montar-relatorio" ||
      (relatorio === "resumo-por-cargo" && podeAprovados)
    ) {
      setExtra(relatorio);
      const origem =
        relatorio === "montar-relatorio" && ehOrigemDoRecorte(parte.origem)
          ? parte.origem
          : "";
      setMontando(relatorio === "montar-relatorio" ? { origem } : null);
      void estado.voltarAoCatalogo();
      return;
    }
    setExtra("");
    setMontando(null);
    void estado.voltarAoCatalogo();
  };

  /*
    O relatório aberto mora no endereço: abrir um cartão é entrada nova no
    histórico (o voltar do navegador volta aos cartões); link com
    `?relatorio=<id>` abre direto nele. A tela vai por `tela` (não por
    <TelaNaUrl>): o hook está neste componente, acima de qualquer Provider.
    Só depois da área (o montador tira o recorte dela).
  */
  const mudarNoEndereco = usarLojaNaUrl(
    ESQUEMA_DO_RELATORIO,
    {
      relatorio: extra || (e.noCatalogo ? "" : e.ativo),
      origem: extra === "montar-relatorio" ? (montando?.origem ?? "") : "",
      edital: extra === "resumo-por-cargo" ? resumo.editais : "",
    },
    (parte) => aplicar.current(parte),
    { tela: VIEW_DOS_RELATORIOS, pronta: Boolean(e.area) },
  );

  // O atalho de outra tela com esta já montada (src/componentes/ver-em-relatorios.tsx).
  usarPedidoDeFiltro(VIEW_DOS_RELATORIOS, Boolean(e.area), (pedido) => {
    if (!ehRelatorioDoEndereco(pedido.relatorio)) return;
    mudarNoEndereco({
      relatorio: pedido.relatorio,
      origem: ehOrigemDoRecorte(pedido.origem) ? pedido.origem : "",
      edital: editaisParaOEndereco(pedido.editais ?? []),
    });
  });

  const voltar = () =>
    mudarNoEndereco({ relatorio: "", origem: "", edital: "" });

  async function gerarDiretoria(formato: "PDF" | "XLSX") {
    setErroNaGeracao("");
    try {
      await apoio.esperarLinhas();
      const { arquivo, nome } = await gerarRelatorio({
        escolha: escolhaDaDiretoria(formato),
        recorte: recorteDaAreaInteira(e.area, apoio.linhasDaArea()),
        textos,
        cabecalho: String(
          apoio.configuracoes.obter().valores?.get?.(CHAVE_DO_CABECALHO) || "",
        ),
        quem: String(apoio.obterPerfil()?.nome || ""),
        agora: apoio.agora(),
        supabase: apoio.supabase,
        podeAprovados,
      });
      baixarArquivo(arquivo, nome);
    } catch (falha) {
      setErroNaGeracao(mensagemDaFalha(falha));
    }
  }

  const noResumo = extra === "resumo-por-cargo";
  const leitura = e.relatorios[e.ativo];
  const lendo = e.noCatalogo
    ? Object.values(e.relatorios).some((l) => l.situacao === "carregando")
    : leitura.situacao === "carregando";
  return (
    <div className="ui-tela paineis-tela">
      <TopoDoPainel
        status={e.noCatalogo ? "" : textoDaSincronizacao(leitura)}
        aoAtualizar={() =>
          void (noResumo ? aprovados?.estado.carregar() : estado.sincronizar())
        }
        atualizarDesativado={!e.area || (noResumo ? !aprovados : lendo)}
        rotuloDaAtualizacao={noResumo ? "Atualizar" : "Sincronizar"}
      />
      {noResumo ? (
        <div className="relatorios-aberto" data-relatorio="resumo-por-cargo">
          <BarraDeVoltar titulo="Resumo por cargo e status" aoVoltar={voltar} />
          {erroDosAprovados ? (
            <Aviso tom="danger" papel="alert">
              {erroDosAprovados}
            </Aviso>
          ) : aprovados ? (
            <RelatorioResumoPorCargo
              key={resumo.vez}
              estado={aprovados.estado}
              editais={editaisDoEndereco(resumo.editais)}
              aoMudarEditais={(editais) => {
                const texto = editaisParaOEndereco(editais);
                setResumo((atual) => ({ ...atual, editais: texto }));
                mudarNoEndereco({ edital: texto }, { substituir: true });
              }}
            />
          ) : (
            <p className="ui-texto-secundario" role="status">
              Carregando…
            </p>
          )}
        </div>
      ) : e.noCatalogo ? (
        <CatalogoDosRelatorios
          estado={estado}
          relatorios={relatorios}
          aoAbrir={(id) =>
            mudarNoEndereco({ relatorio: id, origem: "", edital: "" })
          }
          aoGerarDiretoria={gerarDiretoria}
          erroNaGeracao={erroNaGeracao}
        />
      ) : (
        <>
          <Relatorio estado={estado} aoVoltar={voltar} />
          <GavetaDeFontes estado={estado} />
        </>
      )}
      {montando && extra === "montar-relatorio" && !recorteMontado ? (
        <p className="ui-texto-secundario" role="status">
          Carregando os editais da área…
        </p>
      ) : null}
      {recorteMontado && extra === "montar-relatorio" ? (
        <MontadorDeRelatorio
          e={recorteMontado.recorte}
          descricao={recorteMontado.descricao}
          textos={textos}
          configuracoes={apoio.configuracoes}
          obterPerfil={apoio.obterPerfil}
          agora={apoio.agora}
          aoFechar={voltar}
          supabase={apoio.supabase}
          podeAprovados={podeAprovados}
        />
      ) : null}
    </div>
  );
}

export interface OpcoesDaTelaDePaineis extends OpcoesDoEstadoDosPaineis {
  areaAtual?: () => string | null | undefined;
  /** Os relatórios gerados no navegador; cada parte tem o padrão do app. */
  relatorio?: Partial<ApoioDoRelatorio>;
}

/**
 * Cria a tela (view `paineis-de-dados`, caminho `relatorios`, src/app/telas.tsx): o conteúdo React,
 * o estado e `render()` a cada abertura (lê a área atual do app).
 */
export function criarPaineisDeDados({
  supabase = getSupabaseClient() as ClienteDosPaineis | null,
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
  relatorio = {},
  ...opcoes
}: OpcoesDaTelaDePaineis = {}) {
  const estado = criarEstadoDosPaineis({ supabase, ...opcoes });
  const apoio: ApoioDoRelatorio = {
    linhasDaArea: () => estadoDaVisaoGeral.obter().linhasDaArea,
    visaoGeral: () => estadoDaVisaoGeral.obter(),
    configuracoes: estadoDasConfiguracoes,
    obterPerfil: () => window.getMonitoraProfile?.() || null,
    agora: () => new Date(),
    supabase: getSupabaseClient() as ClienteDoRelatorio | null,
    aprovados: () => carregarTela("approved"),
    pedirLinhas: pedirLinhasDoMonitoramento,
    esperarLinhas: esperarLinhasDoMonitoramento,
    ...relatorio,
  };
  return {
    estado,
    nome: "a tela de Relatórios",
    conteudo: <TelaDePaineisDeDados estado={estado} relatorio={apoio} />,
    render() {
      return estado.carregar(String(areaAtual() ?? "").trim());
    },
  };
}
