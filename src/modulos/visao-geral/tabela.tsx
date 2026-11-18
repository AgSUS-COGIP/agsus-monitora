import type { MouseEvent as EventoReact, ReactElement, ReactNode } from "react";
import type {
  ColunaDaTabela,
  EstadoDaVisaoGeral,
  LinhaDaVisaoGeral,
  PropsComTextos,
  TextosDaVisaoGeral,
} from "./tipos.ts";
import { cloneElement, useEffect, useRef, useState } from "react";
import { formatNumberBR } from "../../lib/base/formatters";
import {
  contratacoesAlemDasVagas,
  contratadasImediatas,
  vagasSemContratacao,
} from "../../lib/visao-geral/indicadores-do-monitoramento.ts";
import {
  COLUNAS_DA_TABELA,
  dataCurta,
  duracaoEmDias,
  linkSeguro,
  observacaoLonga,
  prazoDoEdital,
  seloDoCronograma,
  seloDoMotivo,
  seloDoStatus,
  taxaDeOciosidade,
  urgenciaDoCronograma,
} from "../../lib/visao-geral/visao-geral.ts";
import {
  origemDoNumero,
  TEXTO_DA_ORIGEM_AGREGADA,
  type CampoComOrigem,
  type OrigemDoNumero,
  type TelaDeOrigem,
} from "../../lib/visao-geral/origem-dos-numeros.ts";
import {
  composicaoDaLinha,
  type CampoComComposicao,
} from "../../lib/visao-geral/composicao-dos-numeros.ts";
import { classes, Popover, Selo, TabelaInfinita } from "../../ui/index.ts";
import { ComposicaoDoNumero } from "./composicao.tsx";
import {
  PRESETS_DE_COLUNAS,
  presetDasColunas,
} from "../../lib/visao-geral/presets-de-colunas.ts";

/*
  A tabela de processos seletivos da Visão geral (TabelaInfinita, src/ui/):
  colunas que ordenam (crescente, decrescente, sem ordem), "Colunas" para
  escolher as visíveis (guardadas no navegador), o prazo do edital e o
  cronograma na célula do edital, a taxa de vagas sem contratação, a fase, os
  motivos de atenção (selos) e a observação longa com "Ver mais". Aprovados,
  Contratados, Aguardando chamada e Inscritos levam aos dados que os compõem
  (`NumeroDaLinha`, src/lib/visao-geral/origem-dos-numeros.ts). Sem coluna
  escolhida, os críticos vêm primeiro. A linha abre os detalhes do processo
  (clique, Enter ou espaço). Unidade e Edital ficam presas à esquerda quando
  a tabela rola de lado (`classesFixas`; no celular, em cartões, não).

  A busca do cabeçalho vale para a página toda (KPIs, mapa, blocos): ela vai
  para o estado com uma pausa de 300 ms, e a tabela já recebe as linhas
  recortadas.
*/

const fmt = (valor: unknown) => formatNumberBR(valor);
/* Sem número (nulo ou vazio) é "—", não zero: o dado falta. */
const numeroOuTraco = (valor: unknown) =>
  valor === null || valor === undefined || valor === "" ? "—" : fmt(valor);
const ESPERA_DA_BUSCA_MS = 300;
const DESTAQUE_MS = 2500;
const jaRecortadas = (itens: readonly LinhaDaVisaoGeral[]) => itens;

/*
  As colunas presas à esquerda (13/11/2026): Unidade e Edital, as que estiverem
  visíveis, nessa ordem. A segunda começa onde a primeira termina (a largura
  fixa da Unidade, visao-geral.css); a última leva o fio que separa as presas
  das que rolam.
*/
const COLUNAS_FIXAS: readonly ColunaDaTabela[] = ["unidade", "edital"];
function classesFixas(colunas: readonly ColunaDaTabela[]) {
  const fixas = COLUNAS_FIXAS.filter((campo) => colunas.includes(campo));
  return new Map(
    fixas.map((campo, i): [ColunaDaTabela, string] => [
      campo,
      classes(
        campo === "unidade" && "visao-geral-unidade",
        "visao-geral-fixa",
        i > 0 && "visao-geral-fixa-segunda",
        i === fixas.length - 1 && "visao-geral-fixa-ultima",
      ),
    ]),
  );
}

function MenuDeColunas({
  colunas,
  aoAlternar,
  aoAplicarPreset,
  textos,
}: {
  colunas: readonly ColunaDaTabela[];
  aoAlternar: EstadoDaVisaoGeral["alternarColuna"];
  aoAplicarPreset: EstadoDaVisaoGeral["aplicarPresetDeColunas"];
  textos: TextosDaVisaoGeral;
}) {
  const presetAtual = presetDasColunas(colunas);
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const aoClicar = (evento: MouseEvent) => {
      if (
        !raiz.current?.contains(
          evento.target instanceof Node ? evento.target : null,
        )
      )
        setAberto(false);
    };
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };
    document.addEventListener("click", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("click", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div
      className="visao-geral-colunas"
      ref={raiz}
      data-tour="visao-geral-colunas"
    >
      <button
        type="button"
        className="btn secondary small"
        aria-expanded={aberto}
        aria-controls="visaoGeralColunasMenu"
        onClick={() => setAberto((atual) => !atual)}
      >
        <i className="fa-solid fa-table-columns" aria-hidden="true" />{" "}
        {textos.colunas}
      </button>
      <div
        id="visaoGeralColunasMenu"
        className="visao-geral-colunas-menu"
        role="group"
        aria-label={textos.colunasTitulo}
        hidden={!aberto}
      >
        <div
          className="visao-geral-presets"
          role="group"
          aria-label="Conjuntos de colunas"
        >
          {PRESETS_DE_COLUNAS.map(({ id, rotulo }) => (
            <button
              key={id}
              type="button"
              className="btn secondary small"
              data-preset={id}
              aria-pressed={presetAtual === id}
              onClick={() => aoAplicarPreset(id)}
            >
              {rotulo}
            </button>
          ))}
        </div>
        <strong>{textos.colunasTitulo}</strong>
        {COLUNAS_DA_TABELA.map(({ campo, rotulo }) => (
          <label key={campo}>
            <input
              type="checkbox"
              checked={colunas.includes(campo)}
              disabled={colunas.length === 1 && colunas.includes(campo)}
              onChange={(evento) => aoAlternar(campo, evento.target.checked)}
            />
            {rotulo}
          </label>
        ))}
      </div>
    </div>
  );
}

function CelulaDoEdital({
  linha,
  hoje,
  fixa,
}: {
  linha: LinhaDaVisaoGeral;
  hoje: string | Date;
  fixa?: string;
}) {
  const link = linkSeguro(linha.link_edital);
  const prazo = prazoDoEdital(linha, hoje);
  const cronograma = seloDoCronograma(linha, hoje);
  return (
    <td className={classes("visao-geral-edital", fixa)} data-campo="edital">
      {link ? (
        <a className="link" href={link} target="_blank" rel="noopener">
          {linha.edital || "-"} <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <span className="ui-texto-principal">{linha.edital || "-"}</span>
      )}
      {prazo ? (
        <span
          className="visao-geral-prazo"
          data-tom={prazo.tom}
          title={prazo.rotulo}
        >
          <i className={`fa-solid ${prazo.icone}`} aria-hidden="true" />{" "}
          {prazo.rotulo}
        </span>
      ) : null}
      {cronograma ? (
        <span
          className="visao-geral-cronograma"
          data-urgencia={cronograma.tom}
          title={cronograma.titulo}
        >
          <i className="fa-solid fa-route" aria-hidden="true" />{" "}
          {cronograma.rotulo}
        </span>
      ) : null}
    </td>
  );
}

function CelulaDaObservacao({ texto }: { texto: string }) {
  const [aberta, setAberta] = useState(false);
  const longa = observacaoLonga(texto);
  return (
    <td className="visao-geral-obs">
      <span className={classes("visao-geral-obs-texto", aberta && "is-aberta")}>
        {texto || "-"}
      </span>
      {longa ? (
        <button
          type="button"
          className="visao-geral-ver-mais"
          aria-expanded={aberta}
          onClick={() => setAberta((atual) => !atual)}
        >
          {aberta ? "Ver menos" : "Ver mais"}
        </button>
      ) : null}
    </td>
  );
}

/* O que a célula precisa para levar o número aos dados (TabelaDeProcessos). */
type Origens = {
  comListas: boolean;
  podeAbrir: (view: TelaDeOrigem) => boolean;
  aoAbrir: (
    linha: LinhaDaVisaoGeral,
    origem: Extract<OrigemDoNumero, { tipo: "tela" }>,
  ) => void;
  /** O selo de Atenção: os detalhes, nos avisos do edital. */
  aoAbrirAvisos: (linha: LinhaDaVisaoGeral) => void;
};

const ROTULO_DO_NUMERO: Readonly<
  Record<CampoComOrigem | CampoComComposicao, string>
> = Object.freeze({
  aprovados: "Aprovados",
  contratados: "Contratados",
  cadastro_reserva: "Aguardando chamada",
  inscritos: "Inscritos",
  vagas_total: "Vagas",
  vagas_ociosas: "Sem contratação",
});
const CAMPOS_COM_ORIGEM: readonly string[] = [
  "aprovados",
  "contratados",
  "cadastro_reserva",
  "inscritos",
];
const CAMPOS_COM_COMPOSICAO: readonly string[] = [
  "vagas_total",
  "contratados",
  "vagas_ociosas",
  "aprovados",
];
const ehCampoComOrigem = (campo: string): campo is CampoComOrigem =>
  CAMPOS_COM_ORIGEM.includes(campo);
const ehCampoComComposicao = (campo: string): campo is CampoComComposicao =>
  CAMPOS_COM_COMPOSICAO.includes(campo);

/*
  O número que leva aos dados (revisão de 17/11/2026): clicar abre um painel
  pequeno com a composição, quando os dados permitem (Contratados = dentro
  + além das vagas imediatas; Vagas = publicadas − reabertas), e o caminho
  para a tela do módulo, já no edital, ou "Origem agregada; detalhe
  individual não disponível" quando só há o total. Sem nada disso (sem
  número, zero, sem acesso à tela), é texto como antes.
*/
function NumeroDaLinha({
  linha,
  campo,
  texto,
  extra,
  origens,
}: {
  linha: LinhaDaVisaoGeral;
  campo: CampoComOrigem | CampoComComposicao;
  texto: string;
  extra?: ReactNode;
  origens: Origens;
}) {
  const origem = ehCampoComOrigem(campo)
    ? origemDoNumero(linha, campo, { comListas: origens.comListas })
    : ({ tipo: "nenhuma" } as const);
  const comTela =
    origem.tipo === "tela" && origens.podeAbrir(origem.view) ? origem : null;
  const agregada = origem.tipo === "agregada";
  const passos = ehCampoComComposicao(campo)
    ? composicaoDaLinha(linha, campo)
    : null;
  if (!comTela && !agregada && !passos)
    return (
      <>
        {texto}
        {extra}
      </>
    );
  const rotulo = `${ROTULO_DO_NUMERO[campo]} do ${linha.edital || "edital"}: ${texto}`;
  return (
    <>
      <Popover
        rotulo={rotulo}
        dica={
          passos
            ? "Ver a composição"
            : comTela
              ? comTela.rotulo
              : TEXTO_DA_ORIGEM_AGREGADA
        }
        gatilho={texto}
        classeDoBotao="visao-geral-numero-botao"
        className="visao-geral-numero-origem"
        lado="direita"
        acao={`origem-${campo}`}
      >
        {(fechar) => (
          <div className="visao-geral-origem">
            <strong>{rotulo}</strong>
            {passos ? <ComposicaoDoNumero passos={passos} /> : null}
            {comTela ? (
              <button
                type="button"
                className="btn secondary small"
                data-acao="abrir-origem"
                onClick={() => {
                  fechar();
                  origens.aoAbrir(linha, comTela);
                }}
              >
                <i
                  className="fa-solid fa-arrow-right-to-bracket"
                  aria-hidden="true"
                />{" "}
                {comTela.rotulo}
              </button>
            ) : agregada ? (
              <p className="visao-geral-origem-agregada">
                {TEXTO_DA_ORIGEM_AGREGADA}
              </p>
            ) : null}
          </div>
        )}
      </Popover>
      {extra}
    </>
  );
}

function celula(
  campo: ColunaDaTabela,
  linha: LinhaDaVisaoGeral,
  hoje: string | Date,
  fixas: Map<ColunaDaTabela, string>,
  origens: Origens,
) {
  switch (campo) {
    case "unidade":
      return (
        <td key={campo} className={fixas.get(campo) || "visao-geral-unidade"}>
          {linha.unidade}
        </td>
      );
    case "edital":
      return (
        <CelulaDoEdital
          key={campo}
          linha={linha}
          hoje={hoje}
          fixa={fixas.get(campo)}
        />
      );
    case "ciclo":
      return (
        <td key={campo} className="visao-geral-ciclo">
          {linha.ciclo || "—"}
        </td>
      );
    case "data_inicio":
    case "data_fim":
    case "primeira_admissao":
    case "ultima_admissao":
      return (
        <td key={campo} className="visao-geral-data">
          {dataCurta(linha[campo]) || "—"}
        </td>
      );
    case "vagas_total":
      return (
        <td key={campo} className="num">
          <NumeroDaLinha
            linha={linha}
            campo={campo}
            texto={fmt(linha.vagas_total)}
            origens={origens}
          />
        </td>
      );
    case "duracao":
      return (
        <td key={campo} className="num">
          {numeroOuTraco(duracaoEmDias(linha))}
        </td>
      );
    case "inscritos":
    case "aprovados":
    case "cadastro_reserva":
      return (
        <td key={campo} className="num">
          <NumeroDaLinha
            linha={linha}
            campo={campo}
            texto={numeroOuTraco(linha[campo])}
            origens={origens}
          />
        </td>
      );
    case "contratados": {
      /*
        Como o indicador "Contratadas" e a gaveta: as contratações dentro das
        vagas; as além das vagas imediatas vêm à parte (antes a coluna somava as
        duas e não fechava com o indicador).
      */
      const reserva = contratacoesAlemDasVagas(linha);
      return (
        <td key={campo} className="num">
          <NumeroDaLinha
            linha={linha}
            campo="contratados"
            texto={fmt(contratadasImediatas(linha))}
            origens={origens}
            extra={
              reserva > 0 ? (
                <span
                  className="visao-geral-taxa"
                  title={`${fmt(reserva)} contratado(s) além das vagas imediatas`}
                >
                  +{fmt(reserva)} além
                </span>
              ) : null
            }
          />
        </td>
      );
    }
    case "vagas_ociosas": {
      const taxa = taxaDeOciosidade(linha);
      return (
        <td key={campo} className="num">
          <NumeroDaLinha
            linha={linha}
            campo={campo}
            texto={fmt(vagasSemContratacao(linha))}
            origens={origens}
            extra={
              <span
                className="visao-geral-taxa"
                data-nivel={taxa.nivel}
                title={`${taxa.pct}% das vagas sem contratação`}
              >
                {taxa.pct}%
              </span>
            }
          />
        </td>
      );
    }
    case "status":
      return (
        <td key={campo}>
          <Selo tom={seloDoStatus(linha.status)}>{linha.status || "-"}</Selo>
        </td>
      );
    case "fase":
      return (
        <td
          key={campo}
          className="visao-geral-fase"
          title={linha.etapa || undefined}
        >
          {linha.fase}
        </td>
      );
    case "atencao":
      return (
        <td key={campo} className="visao-geral-motivos">
          {(linha.atencao || []).map((motivo) => (
            // O selo abre os detalhes nos avisos de conferência do edital.
            <button
              key={motivo.codigo}
              type="button"
              className="visao-geral-selo-botao"
              data-acao="avisos-do-edital"
              onClick={() => origens.aoAbrirAvisos(linha)}
            >
              <Selo tom={seloDoMotivo(motivo)} titulo={motivo.rotulo}>
                <span className="visao-geral-motivo-texto">
                  {motivo.rotulo}
                </span>
              </Selo>
            </button>
          ))}
        </td>
      );
    case "observacoes":
      return (
        <CelulaDaObservacao
          key={campo}
          texto={String(linha.observacoes ?? "").trim()}
        />
      );
    default:
      return null;
  }
}

/* Clique na linha abre os detalhes; link, botão e o painel de um número não. */
const cliqueEmControle = (evento: EventoReact) =>
  Boolean(
    evento.target instanceof Element &&
    evento.target.closest("a, button, input, label, .ui-popover"),
  );

export function TabelaDeProcessos({
  e,
  estado,
  textos,
  aoAbrir,
  agora,
  podeAbrirTela = () => false,
  aoAbrirOrigem = () => {},
}: PropsComTextos & {
  aoAbrir: (linha: LinhaDaVisaoGeral, secao?: string) => void;
  agora: () => Date;
  /** A pessoa pode abrir a tela de destino de um número (permissão da página). */
  podeAbrirTela?: Origens["podeAbrir"];
  /** Leva o número à tela do módulo (pedido de filtro e navegação). */
  aoAbrirOrigem?: Origens["aoAbrir"];
}) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [destacada, setDestacada] = useState("");
  const caixa = useRef<HTMLDivElement>(null);
  // O dia de Brasília, o mesmo dos motivos do crítico (não o do navegador).
  const hoje = e.hoje || new Date(agora());

  // A busca digitada vai ao estado depois de uma pausa (o mapa redesenha).
  useEffect(() => {
    if (rascunho === null) return undefined;
    const espera = setTimeout(() => {
      estado.definirBusca(rascunho);
      setRascunho(null);
    }, ESPERA_DA_BUSCA_MS);
    return () => clearTimeout(espera);
  }, [rascunho, estado]);

  // A busca global escolheu esta linha: rola até ela e destaca por um instante.
  const destaque = e.destaque;
  useEffect(() => {
    if (!destaque) return undefined;
    setDestacada(destaque.id);
    const alvo = [
      ...(caixa.current?.querySelectorAll<HTMLTableRowElement>(
        "tr[data-linha]",
      ) || []),
    ].find((tr) => tr.dataset.linha === destaque.id);
    alvo?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    const apagar = setTimeout(() => setDestacada(""), DESTAQUE_MS);
    return () => clearTimeout(apagar);
  }, [destaque]);

  const fixas = classesFixas(e.colunas);
  const origens: Origens = {
    comListas: e.comListas,
    podeAbrir: podeAbrirTela,
    aoAbrir: aoAbrirOrigem,
    aoAbrirAvisos: (linha) => aoAbrir(linha, "avisos"),
  };
  const colunas = COLUNAS_DA_TABELA.filter((c) =>
    e.colunas.includes(c.campo),
  ).map(({ campo, rotulo, numero }) => ({
    rotulo,
    numero,
    classe: fixas.get(campo),
    ordem: e.ordenacao.campo === campo ? e.ordenacao.direcao : "",
    aoOrdenar: () => estado.ordenarPor(campo),
  }));
  const total = e.linhasDaArea.length;

  return (
    <div
      className="visao-geral-tabela-caixa"
      ref={caixa}
      data-tour="visao-geral-tabela"
    >
      <TabelaInfinita
        idDoTitulo="visaoGeralTabelaTitulo"
        titulo={textos.tabela}
        busca={{
          placeholder: textos.busca,
          rotulo: textos.busca,
          valor: rascunho ?? e.busca,
          aoMudar: setRascunho,
        }}
        ferramentas={
          <MenuDeColunas
            colunas={e.colunas}
            aoAlternar={estado.alternarColuna}
            aoAplicarPreset={estado.aplicarPresetDeColunas}
            textos={textos}
          />
        }
        carregado={e.carregado}
        erro={
          e.erro
            ? {
                mensagem: e.erro,
                oQue: "os processos seletivos",
                tentarDeNovo: () => void window.refreshData?.(),
              }
            : null
        }
        itens={e.filtradas}
        filtrarPelaBusca={jaRecortadas}
        colunas={colunas}
        classeDaTabela="visao-geral-tabela"
        total={total}
        vazio="Nenhum processo seletivo nesta área."
        informacao={(quantos) =>
          // "Mostrando 50 de 108 registros" já diz o recorte; o total da área
          // só entra quando um filtro tirou editais (antes, "108 processos"
          // repetia o mesmo número na mesma linha).
          quantos === null || quantos === total
            ? ""
            : `${fmt(total)} ${total === 1 ? "edital" : "editais"} na área`
        }
        linha={(linha) => {
          const id = String(linha.id);
          return (
            <tr
              key={id}
              data-linha={id}
              data-urgencia={urgenciaDoCronograma(linha, hoje).tom}
              className={classes(
                "visao-geral-linha",
                destacada === id && "is-destacada",
              )}
              tabIndex={0}
              title="Ver cronograma e detalhes do edital"
              onClick={(evento) => {
                if (!cliqueEmControle(evento)) aoAbrir(linha);
              }}
              onKeyDown={(evento) => {
                if (evento.target !== evento.currentTarget) return;
                if (evento.key !== "Enter" && evento.key !== " ") return;
                evento.preventDefault();
                aoAbrir(linha);
              }}
            >
              {e.colunas.map((campo) =>
                // `data-campo`: no celular, o cartão mostra só as colunas
                // principais (visao-geral.css); o resto fica na gaveta.
                cloneElement(
                  celula(campo, linha, hoje, fixas, origens) as ReactElement<{
                    "data-campo"?: string;
                  }>,
                  { "data-campo": campo },
                ),
              )}
            </tr>
          );
        }}
      />
    </div>
  );
}
