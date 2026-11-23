import type {
  CandidatoDaTabelaDeAprovados,
  FiltrosDaTabelaDeAprovados,
} from "../aprovados/tipos-da-aba-de-aprovados.ts";
import type { EstadoDosAprovados } from "../aprovados/tipos-do-estado.ts";
import type {
  ConfiguracoesDaConvocacao,
  ModelosDaConvocacao,
} from "../../lib/aprovados/carta-de-convocacao/tipos-da-configuracao-de-convocacao.ts";
import type { OpcaoDosAprovados } from "../../lib/aprovados/tipos-das-regras-de-aprovados.ts";
import type {
  ColunaDoResumo,
  ContagemDoResumo,
  ResumoPorCargoEStatus,
} from "../../lib/paineis/resumo-por-cargo-e-status.ts";
import type { UIEvent } from "react";
import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  CATEGORIAS_DO_RESUMO,
  DICA_DA_COLUNA,
  LINHAS_DO_RESUMO_POR_VEZ,
  MOTIVOS_DE_OUTRAS,
  montarResumoPorCargoEStatus,
  resumoAteOLimite,
  ROTULO_DA_COLUNA,
  ROTULO_DO_MOTIVO,
  situacoesNaFila,
} from "../../lib/paineis/resumo-por-cargo-e-status.ts";
import { configuracaoDaVaga } from "../../lib/aprovados/carta-de-convocacao/configuracao-de-convocacao.ts";
import {
  OPCOES_DO_FILTRO_DE_STATUS,
  statusEfetivo,
} from "../../lib/aprovados/lista-aprovados-rules.ts";
import { MultiSelectBusca } from "../../componentes/multi-select-busca.tsx";
import { formatNumberBR } from "../../lib/base/formatters";
import {
  AtivosEHistorico,
  Campo,
  EstadoVazio,
  Gaveta,
  LinhasEsqueleto,
  PainelDeFiltros,
} from "../../ui/index.ts";
import { plural } from "../aprovados/partes.tsx";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { usarRecorteDosAprovados } from "../aprovados/recorte-dos-aprovados.ts";
import { vistaDoPedido } from "../../lib/aprovados/ativos-e-historico-dos-aprovados.ts";
import { tomDaSituacaoDoEdital } from "../../lib/editais/editais-ativos.ts";
import { montarPedidoDaExportacao } from "../../lib/aprovados/exportacao/exportacao-da-lista-de-aprovados.ts";
import { ModalDaExportacao } from "../aprovados/exportacao/modal-da-exportacao.tsx";

/*
  O RESUMO POR CARGO E STATUS (cartão de Relatórios, grupo Aprovados; até
  23/11/2026 era a aba "Resumo por cargo" da Lista de aprovados, que ficou só
  com o atalho "Ver em Relatórios"; pedido da CORES): por edital, cargo +
  regime + jornada, uma linha por vaga e modalidade, subtotal e total geral.
  É a MESMA lista vigente da Lista de aprovados, com os MESMOS filtros
  (edital, localidade, cargo, modalidade, situação) e a mesma vista Ativos ×
  Histórico (src/modulos/aprovados/recorte-dos-aprovados.ts), e pede o mesmo
  recurso (`aprovados`). Os dados vêm do estado da Lista de aprovados (o
  controlador da tela `approved`, carregado sob demanda pela tela de
  Relatórios): mudar um status lá muda a conta aqui.

  A conta é de src/lib/paineis/resumo-por-cargo-e-status.ts; o cadastro de
  reserva sai da fila de convocação (a mesma conta da aba Convocação),
  calculada sobre a lista inteira das vagas no recorte de edital e cargo:
  modalidade e situação só escolhem quem é contado, não mudam a fila. Clicar
  num número abre os vínculos daquele número (o mesmo recorte). Os editais
  escolhidos ficam no endereço (`?relatorio=resumo-por-cargo&edital=7`).

  A tabela desenha 50 linhas de vaga por vez (em grupos inteiros) e mais 50 ao
  rolar perto do fim ou em "Carregar mais", como a aba Aprovados: desenhar
  tudo travava a tela. O total geral e a exportação são sempre do recorte todo.
*/

/* Perto do fim da caixa que rola, carrega mais (o mesmo da TabelaInfinita). */
const PERTO_DO_FIM_PX = 240;

interface PropsDaTabelaDoResumo {
  candidatos: readonly CandidatoDaTabelaDeAprovados[];
  /** Os que passaram pelos filtros (a busca da tabela não entra). */
  filtrados: readonly CandidatoDaTabelaDeAprovados[];
  configs: ConfiguracoesDaConvocacao;
  modelos: ModelosDaConvocacao;
  carregado: boolean;
  erroAoCarregar: string | boolean;
  opcoes: {
    editais: readonly OpcaoDosAprovados[];
    localidades: readonly string[];
    cargos: readonly string[];
    modalidades: readonly string[];
  };
  filtros: FiltrosDaTabelaDeAprovados;
  aoMudarFiltro: (
    campo: keyof FiltrosDaTabelaDeAprovados,
    valores: string[],
  ) => void;
  aoLimparFiltros: () => void;
  /** Abre o modal de exportação do resumo; desligado sem carga ou durante outra ação. */
  aoExportar: (resumo: ResumoPorCargoEStatus) => void;
  exportarDesativado: boolean;
}

interface Detalhe {
  titulo: string;
  ids: readonly string[];
}

const texto = (valor: unknown) => String(valor ?? "").trim();

function Numero({
  contagem,
  ids,
  coluna,
  onde,
  aoAbrir,
}: {
  contagem: ContagemDoResumo;
  ids: Record<ColunaDoResumo, string[]>;
  coluna: ColunaDoResumo;
  onde: string;
  aoAbrir: (detalhe: Detalhe) => void;
}) {
  const valor = contagem[coluna];
  if (!valor)
    return <span className="relatorios-resumo-valor">{formatNumberBR(0)}</span>;
  const titulo = `${ROTULO_DA_COLUNA[coluna]} · ${onde}`;
  const motivos =
    coluna === "outras"
      ? MOTIVOS_DE_OUTRAS.filter((m) => contagem.motivos[m])
          .map(
            (m) =>
              `${ROTULO_DO_MOTIVO[m]}: ${formatNumberBR(contagem.motivos[m])}`,
          )
          .join("; ")
      : coluna === "contratado" && contagem.migracao
        ? `Dos quais por migração: ${formatNumberBR(contagem.migracao)}`
        : "";
  return (
    <button
      type="button"
      className="relatorios-resumo-numero"
      aria-label={`Ver os ${formatNumberBR(valor)} de ${titulo}`}
      title={motivos || undefined}
      onClick={() => aoAbrir({ titulo, ids: ids[coluna] })}
    >
      {formatNumberBR(valor)}
    </button>
  );
}

function Celulas({
  contagem,
  ids,
  onde,
  aoAbrir,
}: {
  contagem: ContagemDoResumo;
  ids: Record<ColunaDoResumo, string[]>;
  onde: string;
  aoAbrir: (detalhe: Detalhe) => void;
}) {
  return (
    <>
      {(["aprovados", ...CATEGORIAS_DO_RESUMO] as const).map((coluna) => (
        <td key={coluna} className="relatorios-resumo-num">
          <Numero
            contagem={contagem}
            ids={ids}
            coluna={coluna}
            onde={onde}
            aoAbrir={aoAbrir}
          />
        </td>
      ))}
    </>
  );
}

function GavetaDoDetalhe({
  detalhe,
  candidatos,
  aoFechar,
}: {
  detalhe: Detalhe;
  candidatos: readonly CandidatoDaTabelaDeAprovados[];
  aoFechar: () => void;
}) {
  const porId = useMemo(
    () => new Map(candidatos.map((c) => [texto(c.candidato_id), c])),
    [candidatos],
  );
  const linhas = detalhe.ids
    .map((id) => porId.get(id))
    .filter((c): c is CandidatoDaTabelaDeAprovados => Boolean(c));
  return (
    <Gaveta
      id="relatoriosResumoDetalhe"
      tituloId="relatoriosResumoDetalheTitulo"
      aoFechar={aoFechar}
      sobretitulo="Resumo por cargo e status"
      titulo={detalhe.titulo}
      resumo={plural(linhas.length, "vínculo", "vínculos")}
    >
      <div className="ui-tabela-rolagem relatorios-resumo-detalhe">
        <table>
          <caption className="sr-only">{detalhe.titulo}</caption>
          <thead>
            <tr>
              <th scope="col">Classificação</th>
              <th scope="col">Nome</th>
              <th scope="col">Modalidade</th>
              <th scope="col">Situação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((c) => (
              <tr key={texto(c.candidato_id)}>
                <td>{texto(c.classificacao) || "—"}</td>
                <td>{texto(c.nome)}</td>
                <td>{texto(c.modalidade) || "—"}</td>
                <td>{statusEfetivo(c) || "Sem status"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Gaveta>
  );
}

function TabelaDoResumo({
  candidatos,
  filtrados,
  configs,
  modelos,
  carregado,
  erroAoCarregar,
  opcoes,
  filtros,
  aoMudarFiltro,
  aoLimparFiltros,
  aoExportar,
  exportarDesativado,
}: PropsDaTabelaDoResumo) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const chaveDaFila = `${filtros.editalId.join("\u0000")}\u0001${filtros.cargo.join("\u0000")}`;

  /*
    A fila: a lista inteira de cada vaga no recorte de edital e cargo, como a
    aba Convocação. Só recalcula quando a base, a configuração ou esse recorte
    mudam; modalidade e situação não mexem nela.
  */
  const situacoes = useMemo(() => {
    const noRecorte = candidatos.filter(
      (c) =>
        (!filtros.editalId.length ||
          filtros.editalId.includes(texto(c.edital_id))) &&
        (!filtros.cargo.length || filtros.cargo.includes(texto(c.cargo))),
    );
    return situacoesNaFila(noRecorte, (editalId, codigoVaga) =>
      configuracaoDaVaga(configs, modelos, editalId, codigoVaga),
    );
    // A chave do recorte é o conteúdo dos filtros (arrays novos a cada desenho).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatos, configs, modelos, chaveDaFila]);

  const rotulos = useMemo(
    () => new Map(opcoes.editais.map((o) => [String(o.value), o.label])),
    [opcoes.editais],
  );
  const resumo = useMemo(
    () =>
      montarResumoPorCargoEStatus({
        candidatos: filtrados,
        situacoes,
        rotulosDosEditais: rotulos,
      }),
    [filtrados, situacoes, rotulos],
  );

  const quantos = Object.values(filtros).filter((lista) => lista.length).length;
  const semPermissao =
    typeof erroAoCarregar === "string" && /permiss/i.test(erroAoCarregar);
  const faltas = resumo?.faltas;
  const avisos: string[] = [];
  if (resumo) {
    if (filtros.status.length)
      avisos.push(
        "O filtro Situação restringe a base: só os vínculos com as situações escolhidas entram nas contagens.",
      );
    if (resumo.foraDaListaAtiva)
      avisos.push(
        `${plural(resumo.foraDaListaAtiva, "vínculo de lista inativa ficou", "vínculos de listas inativas ficaram")} fora do resumo.`,
      );
    const semTexto = [
      faltas?.semRegime ? `regime em ${formatNumberBR(faltas.semRegime)}` : "",
      faltas?.semJornada
        ? `jornada em ${formatNumberBR(faltas.semJornada)}`
        : "",
      faltas?.semCodigoDaVaga
        ? `código da vaga em ${formatNumberBR(faltas.semCodigoDaVaga)}`
        : "",
      faltas?.semModalidade
        ? `modalidade em ${formatNumberBR(faltas.semModalidade)}`
        : "",
    ].filter(Boolean);
    if (semTexto.length)
      avisos.push(
        `Não informado no cargo ou na lista: ${semTexto.join(", ")} vínculos.`,
      );
  }

  const colunas = 1 + 1 + CATEGORIAS_DO_RESUMO.length;
  const variosEditais = (resumo?.editais.length ?? 0) > 1;

  /*
    Quantas linhas de vaga estão desenhadas, guardado junto do resumo a que se
    refere: filtro novo (resumo novo) volta às primeiras 50 no mesmo desenho.
  */
  const [carga, setCarga] = useState<{
    resumo: ResumoPorCargoEStatus | null;
    limite: number;
  }>({ resumo: null, limite: LINHAS_DO_RESUMO_POR_VEZ });
  const limite =
    carga.resumo === resumo ? carga.limite : LINHAS_DO_RESUMO_POR_VEZ;
  const visivel = useMemo(
    () => (resumo ? resumoAteOLimite(resumo, limite) : null),
    [resumo, limite],
  );
  const faltam = visivel ? visivel.total - visivel.mostradas : 0;
  const carregarMais = () =>
    setCarga((atual) => ({
      resumo,
      limite:
        (atual.resumo === resumo ? atual.limite : LINHAS_DO_RESUMO_POR_VEZ) +
        LINHAS_DO_RESUMO_POR_VEZ,
    }));
  function aoRolar(evento: UIEvent<HTMLDivElement>) {
    const caixa = evento.currentTarget;
    if (
      faltam > 0 &&
      caixa.scrollTop + caixa.clientHeight >=
        caixa.scrollHeight - PERTO_DO_FIM_PX
    )
      carregarMais();
  }
  // O modo cartão do celular relê os cabeçalhos a cada desenho.
  const desenhadas = visivel?.mostradas ?? -1;
  useEffect(() => {
    document.dispatchEvent(new CustomEvent("agsus:content-updated"));
  }, [desenhadas]);

  let conteudo;
  if (semPermissao)
    conteudo = (
      <EstadoVazio>
        Sem permissão para ver a lista de aprovados desta área.
      </EstadoVazio>
    );
  else if (erroAoCarregar && !carregado)
    conteudo = (
      <EstadoVazio>
        O resumo depende da lista de aprovados, que não carregou.
      </EstadoVazio>
    );
  else if (!carregado || !resumo)
    conteudo = (
      <div
        className="ui-tabela-rolagem relatorios-resumo-rolagem"
        aria-busy="true"
      >
        <table className="relatorios-resumo-tabela">
          <tbody>
            <LinhasEsqueleto linhas={6} colunas={colunas} />
          </tbody>
        </table>
      </div>
    );
  else if (!candidatos.length)
    conteudo = (
      <EstadoVazio>Nenhuma lista de aprovados vigente nesta área.</EstadoVazio>
    );
  else if (!resumo.total.aprovados)
    conteudo = (
      <EstadoVazio>Nenhum vínculo para os filtros escolhidos.</EstadoVazio>
    );
  else
    conteudo = (
      <>
        <div
          className="ui-tabela-rolagem relatorios-resumo-rolagem"
          onScroll={aoRolar}
        >
          <table
            className="relatorios-resumo-tabela"
            aria-describedby="relatoriosResumoBase"
          >
            <caption className="sr-only">
              Contagem de candidatos por cargo e status
            </caption>
            <thead>
              <tr>
                <th scope="col">Cargo e vaga</th>
                <th
                  scope="col"
                  className="relatorios-resumo-num"
                  title={DICA_DA_COLUNA.aprovados}
                >
                  {ROTULO_DA_COLUNA.aprovados}
                </th>
                {CATEGORIAS_DO_RESUMO.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="relatorios-resumo-num"
                    title={DICA_DA_COLUNA[c]}
                  >
                    {ROTULO_DA_COLUNA[c]}
                  </th>
                ))}
              </tr>
            </thead>
            {(visivel?.editais ?? []).map((edital) => (
              <Fragment key={edital.editalId}>
                {variosEditais ? (
                  <tbody>
                    <tr className="relatorios-resumo-edital">
                      <th scope="rowgroup" colSpan={colunas}>
                        <span className="relatorios-resumo-rotulo-preso">
                          {edital.rotulo}
                        </span>
                      </th>
                    </tr>
                  </tbody>
                ) : null}
                {edital.grupos.map((grupo) => (
                  <tbody key={grupo.chave}>
                    <tr className="relatorios-resumo-grupo">
                      <th scope="rowgroup" colSpan={colunas}>
                        <span className="relatorios-resumo-rotulo-preso">
                          {grupo.rotulo}
                        </span>
                      </th>
                    </tr>
                    {grupo.linhas.map((linha) => {
                      const onde = [
                        grupo.rotulo,
                        linha.modalidade,
                        linha.codigoVaga && `vaga ${linha.codigoVaga}`,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <tr key={linha.chave}>
                          <th scope="row" className="relatorios-resumo-vaga">
                            <span>{linha.modalidade}</span>
                            <span className="relatorios-resumo-meta">
                              {[
                                linha.codigoVaga
                                  ? `Vaga ${linha.codigoVaga}`
                                  : "Vaga sem código",
                                linha.unidade,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </th>
                          <Celulas
                            contagem={linha.contagem}
                            ids={linha.ids}
                            onde={onde}
                            aoAbrir={setDetalhe}
                          />
                        </tr>
                      );
                    })}
                    <tr className="relatorios-resumo-subtotal">
                      <th scope="row">Total · {grupo.rotulo}</th>
                      <Celulas
                        contagem={grupo.subtotal}
                        ids={grupo.ids}
                        onde={`total de ${grupo.rotulo}`}
                        aoAbrir={setDetalhe}
                      />
                    </tr>
                  </tbody>
                ))}
                {variosEditais && edital.completo ? (
                  <tbody>
                    <tr className="relatorios-resumo-subtotal">
                      <th scope="row">Total do edital · {edital.rotulo}</th>
                      <Celulas
                        contagem={edital.subtotal}
                        ids={edital.ids}
                        onde={`total do edital ${edital.rotulo}`}
                        aoAbrir={setDetalhe}
                      />
                    </tr>
                  </tbody>
                ) : null}
              </Fragment>
            ))}
            <tfoot>
              <tr className="relatorios-resumo-total">
                <th scope="row">Total geral</th>
                <Celulas
                  contagem={resumo.total}
                  ids={resumo.ids}
                  onde="total geral"
                  aoAbrir={setDetalhe}
                />
              </tr>
            </tfoot>
          </table>
        </div>
        {visivel ? (
          <div className="ui-tabela-status" role="status" aria-live="polite">
            {faltam > 0
              ? `${formatNumberBR(visivel.mostradas)} de ${formatNumberBR(visivel.total)} linhas de vaga`
              : `Todas as ${formatNumberBR(visivel.total)} linhas de vaga do recorte foram carregadas`}
          </div>
        ) : null}
        {faltam > 0 ? (
          <button
            id="relatoriosResumoCarregarMais"
            type="button"
            className="btn secondary small ui-tabela-mais"
            data-acao="carregar-mais"
            onClick={carregarMais}
          >
            <i className="fa-solid fa-plus" aria-hidden="true" /> Carregar mais{" "}
            {formatNumberBR(Math.min(LINHAS_DO_RESUMO_POR_VEZ, faltam))}
          </button>
        ) : null}
      </>
    );

  return (
    <div id="relatoriosResumoPorCargo" className="relatorios-resumo">
      <PainelDeFiltros
        idDoTitulo="relatoriosResumoFiltrosTitulo"
        quantos={quantos}
        podeLimpar={quantos > 0}
        aoLimpar={aoLimparFiltros}
      >
        {/* Os mesmos filtros da aba Aprovados da Lista de aprovados. */}
        <div className="ui-grade-de-campos">
          <Campo rotulo="Edital" idDoControle="relatoriosResumoFiltroEdital">
            <MultiSelectBusca
              id="relatoriosResumoFiltroEdital"
              placeholder="Todos os editais"
              opcoes={opcoes.editais}
              selecionados={filtros.editalId}
              aoMudar={(valores) => aoMudarFiltro("editalId", valores)}
            />
          </Campo>
          {opcoes.localidades.length ? (
            <Campo
              rotulo="Localidade"
              idDoControle="relatoriosResumoFiltroLocalidade"
            >
              <MultiSelectBusca
                id="relatoriosResumoFiltroLocalidade"
                placeholder="Todas as localidades"
                opcoes={opcoes.localidades}
                selecionados={filtros.localidade}
                aoMudar={(valores) => aoMudarFiltro("localidade", valores)}
              />
            </Campo>
          ) : null}
          <Campo rotulo="Cargo" idDoControle="relatoriosResumoFiltroCargo">
            <MultiSelectBusca
              id="relatoriosResumoFiltroCargo"
              placeholder="Todos os cargos"
              opcoes={opcoes.cargos}
              selecionados={filtros.cargo}
              aoMudar={(valores) => aoMudarFiltro("cargo", valores)}
            />
          </Campo>
          <Campo
            rotulo="Modalidade"
            idDoControle="relatoriosResumoFiltroModalidade"
          >
            <MultiSelectBusca
              id="relatoriosResumoFiltroModalidade"
              placeholder="Todas as modalidades"
              opcoes={opcoes.modalidades}
              selecionados={filtros.modalidade}
              aoMudar={(valores) => aoMudarFiltro("modalidade", valores)}
            />
          </Campo>
          <Campo rotulo="Situação" idDoControle="relatoriosResumoFiltroStatus">
            <MultiSelectBusca
              id="relatoriosResumoFiltroStatus"
              placeholder="Todas as situações"
              opcoes={OPCOES_DO_FILTRO_DE_STATUS}
              selecionados={filtros.status}
              aoMudar={(valores) => aoMudarFiltro("status", valores)}
            />
          </Campo>
        </div>
      </PainelDeFiltros>

      <section
        className="ui-card relatorios-resumo-card"
        aria-labelledby="relatoriosResumoTitulo"
      >
        <div className="ui-tabela-topo">
          <h3 id="relatoriosResumoTitulo">Contagem por cargo e status</h3>
          <span
            className="ui-tabela-meta"
            id="relatoriosResumoBase"
            aria-live="polite"
          >
            {resumo && carregado
              ? `${plural(resumo.total.aprovados, "vínculo", "vínculos")} · ${plural(resumo.editais.length, "edital", "editais")}`
              : ""}
          </span>
          <button
            id="relatoriosResumoExportar"
            className="btn secondary"
            type="button"
            disabled={exportarDesativado || !resumo || !resumo.total.aprovados}
            onClick={() => resumo && aoExportar(resumo)}
          >
            <i className="fa-solid fa-download" aria-hidden="true" /> Exportar
          </button>
        </div>
        {avisos.length ? (
          <ul className="relatorios-resumo-avisos status-discreto">
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        ) : null}
        {conteudo}
      </section>
      {detalhe ? (
        <GavetaDoDetalhe
          detalhe={detalhe}
          candidatos={filtrados}
          aoFechar={() => setDetalhe(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * O relatório na tela de Relatórios: a vista (Ativos × Histórico), os
 * filtros e a contagem, sobre o estado da Lista de aprovados. `editais` são
 * os do endereço ao abrir (o atalho "Ver em Relatórios"); cada troca de
 * edital volta por `aoMudarEditais`.
 */
export function RelatorioResumoPorCargo({
  estado,
  editais,
  aoMudarEditais,
}: {
  estado: EstadoDosAprovados;
  editais: readonly string[];
  aoMudarEditais: (editais: readonly string[]) => void;
}) {
  const dados = useSyncExternalStore(estado.assinar, estado.obter);
  const { ids, area, nome, linhas } = usarAreaAtual();
  const [iniciais] = useState(() => [...editais]);
  const recorte = usarRecorteDosAprovados(dados, {
    ids,
    linhas,
    chaveDaVista: `yeende:relatorios:resumo-por-cargo:vista:${area}`,
    filtrosIniciais: { editalId: iniciais },
  });
  const { separados, vista, setVista, efetivos } = recorte;
  const [resumoParaExportar, setResumoParaExportar] =
    useState<ResumoPorCargoEStatus | null>(null);

  /*
    O edital do atalho pode estar no Histórico: com a lista carregada, abre a
    vista dele (uma vez). Só depois disso a escolha volta ao endereço — antes,
    o edital ainda não é opção e sairia dele.
  */
  const [ajustada, setAjustada] = useState(!iniciais.length);
  useEffect(() => {
    if (ajustada || !dados.carregado) return;
    setVista(
      vistaDoPedido(separados, vista, { editalIds: iniciais }, (c) =>
        String(c.candidato_id),
      ),
    );
    setAjustada(true);
  }, [ajustada, dados.carregado, separados, vista, setVista, iniciais]);

  const chaveDosEditais = efetivos.editalId.join(",");
  useEffect(() => {
    if (ajustada && dados.carregado) aoMudarEditais(efetivos.editalId);
    // A chave é o conteúdo da lista (uma nova a cada desenho).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ajustada, dados.carregado, chaveDosEditais]);

  return (
    <>
      {dados.carregado ? (
        <AtivosEHistorico
          vista={vista}
          aoMudar={recorte.mudarVista}
          ativos={separados.ativos.editais}
          historico={separados.historico.editais}
          situacoes={separados[vista].situacoes}
          rotulo="Editais da lista de aprovados"
          tomDaSituacao={tomDaSituacaoDoEdital}
          className="relatorios-resumo-ativos-e-historico"
        />
      ) : null}
      <TabelaDoResumo
        candidatos={recorte.candidatosDaVista}
        filtrados={recorte.filtrados}
        configs={dados.configs}
        modelos={dados.modelos}
        carregado={dados.carregado}
        erroAoCarregar={dados.erroAoCarregar}
        opcoes={recorte.opcoes}
        filtros={efetivos}
        aoMudarFiltro={recorte.mudarFiltro}
        aoLimparFiltros={recorte.limparFiltros}
        aoExportar={setResumoParaExportar}
        exportarDesativado={!dados.carregado || Boolean(dados.acao)}
      />
      {resumoParaExportar ? (
        <ModalDaExportacao
          estado={estado}
          titulo="Exportar o resumo por cargo e status"
          aoExportar={(pedido, formato, seguir) =>
            estado.exportarResumo(pedido, resumoParaExportar, formato, seguir)
          }
          pedido={montarPedidoDaExportacao({
            area: String(area || ""),
            rotuloDaArea: nome || String(area || ""),
            candidatosDaArea: recorte.candidatosDaVista,
            filtrados: recorte.filtrados,
            filtros: recorte.filtrosParaExportar,
            opcoesDeEdital: recorte.opcoesEditais,
            dadosDe: dados.carregadoEm,
          })}
          aoFechar={() => setResumoParaExportar(null)}
        />
      ) : null}
    </>
  );
}
