import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { BotoesDeExportacao } from "../../ui/botoes-de-exportacao.tsx";
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
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { getSupabaseClient } from "../../lib/sessao/supabaseClient";
import { usarLojaNaUrl } from "../../app/usar-filtros-na-url.ts";
import type { EsquemaDosFiltros } from "../../app/filtros-no-endereco.ts";
import {
  ehIdDoRelatorio,
  gruposDoCatalogo,
} from "../../lib/paineis/catalogo-dos-relatorios.ts";
import type { RelatorioDoCatalogo } from "../../lib/paineis/catalogo-dos-relatorios.ts";
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
import { recorteDaAreaInteira } from "../../lib/visao-geral/relatorio-da-visao-geral.ts";
import type { RecorteDoRelatorio } from "../../lib/visao-geral/relatorio-da-visao-geral.ts";
import { estadoDasConfiguracoes } from "../configuracoes/estado.ts";
import { estadoDaVisaoGeral } from "../visao-geral/estado.ts";
import { MontadorDeRelatorio } from "../visao-geral/montador-de-relatorio.tsx";
import type { ClienteDoRelatorio } from "../visao-geral/dados-da-diretoria.ts";
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
  de `src/lib/paineis/catalogo-dos-relatorios.ts`; as colunas e os arquivos,
  de `src/lib/paineis/relatorios-dos-paineis.ts`; o estado, de `./estado.ts`.
  Título e área ficam no cabeçalho da casca.

  "Montar relatório" (no topo, desde 16/11/2026; antes ficava no menu da
  conta): abre o montador da Visão geral
  (src/modulos/visao-geral/montador-de-relatorio.tsx) com todos os editais da
  área, sem os filtros da Visão geral.
*/

/** A view da tela (rota em src/lib/navegacao/rotas.ts; o caminho é `relatorios`). */
const VIEW_DOS_RELATORIOS = "paineis-de-dados";

/** O relatório aberto no endereço (`?relatorio=<id>`); sem ele, o catálogo. */
const ESQUEMA_DO_RELATORIO: EsquemaDosFiltros<"relatorio"> = Object.freeze({
  relatorio: { padrao: "", empilha: true, aceita: ehIdDoRelatorio },
});

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
        const soltar = () => {
          window.removeEventListener("pointermove", mover);
          window.removeEventListener("pointerup", soltar);
        };
        window.addEventListener("pointermove", mover);
        window.addEventListener("pointerup", soltar);
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

function CartaoDoRelatorio({
  estado,
  item,
  aoAbrir,
}: {
  estado: EstadoDaTelaDePaineis;
  item: RelatorioDoCatalogo;
  aoAbrir: () => void;
}) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const idDoTitulo = useId();
  const leitura = e.relatorios[item.id];
  const pronto = leitura.situacao === "pronto";
  return (
    <article
      className="ui-card relatorios-cartao"
      aria-labelledby={idDoTitulo}
      data-relatorio={item.id}
    >
      <h3 className="ui-titulo" id={idDoTitulo}>
        {item.nome}
      </h3>
      <p className="relatorios-cartao-resumo">{item.resumo}</p>
      <p className="ui-texto-secundario" data-calculo="" aria-live="polite">
        {textoDoCartao(leitura)}
      </p>
      <div className="relatorios-cartao-acoes">
        <button
          type="button"
          className="btn secondary small"
          data-acao="abrir-relatorio"
          aria-label={`Abrir ${item.nome}`}
          onClick={aoAbrir}
        >
          Abrir
        </button>
        <BotoesDeExportacao
          pequenos
          desativado={!pronto || e.baixando !== null}
          excel={() => estado.baixar("XLSX", item.id)}
          pdf={() => estado.baixar("PDF", item.id)}
        />
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
  aoAbrir,
}: {
  estado: EstadoDaTelaDePaineis;
  aoAbrir: (id: RelatorioDoCatalogo["id"]) => void;
}) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const grupos = gruposDoCatalogo();
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
              />
            ))}
          </div>
        </section>
      ))}
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
      <div className="relatorios-voltar">
        <button
          type="button"
          className="btn ghost small"
          data-acao="voltar-ao-catalogo"
          onClick={aoVoltar}
        >
          <Icone nome="chevron-left" tamanho={16} /> Todos os relatórios
        </button>
        <h2 className="ui-titulo">{definicao.rotulo}</h2>
      </div>
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

/* O que o montador de relatório precisa, fora o recorte (vem da criação da tela). */
export interface ApoioDoRelatorio {
  /** Os editais da área, já enriquecidos (os da Visão geral, sem filtro). */
  linhasDaArea: () => readonly LinhaDaVisaoGeral[];
  configuracoes: Configuracoes;
  obterPerfil: () => Perfil | null;
  agora: () => Date;
  supabase: ClienteDoRelatorio | null;
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

function MontadorDosPaineis({
  recorte,
  apoio,
  aoFechar,
}: {
  recorte: RecorteDoRelatorio;
  apoio: ApoioDoRelatorio;
  aoFechar: () => void;
}) {
  const textos = usarTextosDoRelatorio(apoio.configuracoes);
  return (
    <MontadorDeRelatorio
      e={recorte}
      descricao="da área"
      textos={textos}
      configuracoes={apoio.configuracoes}
      obterPerfil={apoio.obterPerfil}
      agora={apoio.agora}
      aoFechar={aoFechar}
      supabase={apoio.supabase}
      podeAprovados={podeBaixarAprovados(apoio.obterPerfil())}
    />
  );
}

export function TelaDePaineisDeDados({
  estado,
  relatorio,
}: {
  estado: EstadoDaTelaDePaineis;
  relatorio: ApoioDoRelatorio;
}) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const { area: areaDoApp } = usarAreaAtual();
  // O recorte é tirado no clique: o montador não muda com uma recarga no meio.
  const [montando, setMontando] = useState<RecorteDoRelatorio | null>(null);

  /*
    A área do app mudou com a tela já aberta: lê a nova. Quem abre a tela é o
    `render()` do controlador — antes dele (`e.area` vazio), nada é pedido.
  */
  useEffect(() => {
    const { area } = estado.obter();
    if (area && areaDoApp && area !== areaDoApp)
      void estado.carregar(areaDoApp);
  }, [estado, areaDoApp]);

  /*
    O relatório aberto mora no endereço: abrir um cartão é entrada nova no
    histórico (o voltar do navegador volta aos cartões); link com
    `?relatorio=<id>` abre direto nele. A tela vai por `tela` (não por
    <TelaNaUrl>): o hook está neste componente, acima de qualquer Provider.
  */
  const mudarNoEndereco = usarLojaNaUrl(
    ESQUEMA_DO_RELATORIO,
    { relatorio: e.noCatalogo ? "" : e.ativo },
    ({ relatorio }) => {
      if (relatorio === undefined) return;
      void (ehIdDoRelatorio(relatorio)
        ? estado.abrir(relatorio)
        : estado.voltarAoCatalogo());
    },
    { tela: VIEW_DOS_RELATORIOS },
  );

  const leitura = e.relatorios[e.ativo];
  const lendo = e.noCatalogo
    ? Object.values(e.relatorios).some((l) => l.situacao === "carregando")
    : leitura.situacao === "carregando";
  return (
    <div className="ui-tela paineis-tela">
      <TopoDoPainel
        status={e.noCatalogo ? "" : textoDaSincronizacao(leitura)}
        aoAtualizar={() => void estado.sincronizar()}
        atualizarDesativado={!e.area || lendo}
        rotuloDaAtualizacao="Sincronizar"
      >
        <button
          type="button"
          className="btn secondary"
          data-acao="montar-relatorio"
          disabled={!e.area}
          onClick={() =>
            setMontando(recorteDaAreaInteira(e.area, relatorio.linhasDaArea()))
          }
        >
          <i className="fa-solid fa-file-lines" aria-hidden="true" /> Montar
          relatório
        </button>
      </TopoDoPainel>
      {e.noCatalogo ? (
        <CatalogoDosRelatorios
          estado={estado}
          aoAbrir={(id) => mudarNoEndereco({ relatorio: id })}
        />
      ) : (
        <>
          <Relatorio
            estado={estado}
            aoVoltar={() => mudarNoEndereco({ relatorio: "" })}
          />
          <GavetaDeFontes estado={estado} />
        </>
      )}
      {montando ? (
        <MontadorDosPaineis
          recorte={montando}
          apoio={relatorio}
          aoFechar={() => setMontando(null)}
        />
      ) : null}
    </div>
  );
}

export interface OpcoesDaTelaDePaineis extends OpcoesDoEstadoDosPaineis {
  areaAtual?: () => string | null | undefined;
  /** O montador de relatório; cada parte tem o padrão do app. */
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
    configuracoes: estadoDasConfiguracoes,
    obterPerfil: () => window.getMonitoraProfile?.() || null,
    agora: () => new Date(),
    supabase: getSupabaseClient() as ClienteDoRelatorio | null,
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
