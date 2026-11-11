import type {
  CandidatoDaTabelaDeAprovados,
  FiltrosDaTabelaDeAprovados,
} from "./tipos-da-aba-de-aprovados.ts";
import type {
  ConfiguracoesDaConvocacao,
  ModelosDaConvocacao,
} from "../../lib/tipos-da-configuracao-de-convocacao.ts";
import type { OpcaoDosAprovados } from "../../lib/tipos-das-regras-de-aprovados.ts";
import type {
  ColunaDoResumo,
  ContagemDoResumo,
  ResumoPorCargoEStatus,
} from "../../lib/resumo-por-cargo-e-status.ts";
import { Fragment, useMemo, useState } from "react";
import {
  CATEGORIAS_DO_RESUMO,
  MOTIVOS_DE_OUTRAS,
  montarResumoPorCargoEStatus,
  ROTULO_DA_COLUNA,
  ROTULO_DO_MOTIVO,
  situacoesNaFila,
} from "../../lib/resumo-por-cargo-e-status.ts";
import { configuracaoDaVaga } from "../../lib/configuracao-de-convocacao.ts";
import {
  OPCOES_DO_FILTRO_DE_STATUS,
  statusEfetivo,
} from "../../lib/lista-aprovados-rules.ts";
import { MultiSelectBusca } from "../../componentes/multi-select-busca.tsx";
import { formatNumberBR } from "../../lib/formatters";
import {
  Campo,
  EstadoVazio,
  Gaveta,
  LinhasEsqueleto,
  PainelDeFiltros,
  classes,
} from "../../ui/index.ts";
import { plural } from "./partes.tsx";

/*
  A aba "Resumo por cargo" da Lista de aprovados (pedido da CORES): por
  edital, cargo + regime + jornada, uma linha por vaga e modalidade, subtotal
  e total geral. Fica aqui, ao lado de Aprovados, porque é a MESMA lista
  vigente com os MESMOS filtros (edital, cargo, modalidade, situação), contada
  — e não um painel novo com outra base e outra permissão.

  A conta é de src/lib/resumo-por-cargo-e-status.ts; o cadastro de reserva sai
  da fila de convocação (a mesma conta da aba Convocação), calculada sobre a
  lista inteira das vagas no recorte de edital e cargo: modalidade e situação
  só escolhem quem é contado, não mudam a fila. Clicar num número abre os
  vínculos daquele número (o mesmo recorte).
*/

export interface PropsDaAbaDoResumo {
  ativa: boolean;
  candidatos: readonly CandidatoDaTabelaDeAprovados[];
  /** Os que passaram pelos filtros (a busca da tabela não entra). */
  filtrados: readonly CandidatoDaTabelaDeAprovados[];
  configs: ConfiguracoesDaConvocacao;
  modelos: ModelosDaConvocacao;
  carregado: boolean;
  erroAoCarregar: string | boolean;
  opcoes: {
    editais: readonly OpcaoDosAprovados[];
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
  semSubtipo,
  aoAbrir,
}: {
  contagem: ContagemDoResumo;
  ids: Record<ColunaDoResumo, string[]>;
  coluna: ColunaDoResumo;
  onde: string;
  semSubtipo: boolean;
  aoAbrir: (detalhe: Detalhe) => void;
}) {
  if (
    semSubtipo &&
    (coluna === "desistenciaVoluntaria" || coluna === "desistenciaTacita")
  )
    return (
      <span
        className="approved-resumo-valor"
        title="Subtipo não registrado"
        aria-label="não registrado"
      >
        —
      </span>
    );
  const valor = contagem[coluna];
  if (!valor)
    return <span className="approved-resumo-valor">{formatNumberBR(0)}</span>;
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
      className="approved-resumo-numero"
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
  semSubtipo,
  aoAbrir,
}: {
  contagem: ContagemDoResumo;
  ids: Record<ColunaDoResumo, string[]>;
  onde: string;
  semSubtipo: boolean;
  aoAbrir: (detalhe: Detalhe) => void;
}) {
  return (
    <>
      {(["aprovados", ...CATEGORIAS_DO_RESUMO] as const).map((coluna) => (
        <td key={coluna} className="approved-resumo-num">
          <Numero
            contagem={contagem}
            ids={ids}
            coluna={coluna}
            onde={onde}
            semSubtipo={semSubtipo}
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
      id="approvedResumoDetalhe"
      tituloId="approvedResumoDetalheTitulo"
      aoFechar={aoFechar}
      sobretitulo="Resumo por cargo e status"
      titulo={detalhe.titulo}
      resumo={plural(linhas.length, "vínculo", "vínculos")}
    >
      <div className="ui-tabela-rolagem approved-resumo-detalhe">
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

export function AbaResumo({
  ativa,
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
}: PropsDaAbaDoResumo) {
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const chaveDaFila = `${filtros.editalId.join("\u0000")}\u0001${filtros.cargo.join("\u0000")}`;

  /*
    A fila: a lista inteira de cada vaga no recorte de edital e cargo, como a
    aba Convocação. Só recalcula quando a base, a configuração ou esse recorte
    mudam; modalidade e situação não mexem nela.
  */
  const situacoes = useMemo(() => {
    if (!ativa) return new Map<string, string>();
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
  }, [ativa, candidatos, configs, modelos, chaveDaFila]);

  const rotulos = useMemo(
    () => new Map(opcoes.editais.map((o) => [String(o.value), o.label])),
    [opcoes.editais],
  );
  const resumo = useMemo(
    () =>
      ativa
        ? montarResumoPorCargoEStatus({
            candidatos: filtrados,
            situacoes,
            rotulosDosEditais: rotulos,
          })
        : null,
    [ativa, filtrados, situacoes, rotulos],
  );

  const quantos = Object.values(filtros).filter((lista) => lista.length).length;
  const semPermissao =
    typeof erroAoCarregar === "string" && /permiss/i.test(erroAoCarregar);
  const semSubtipo = !resumo?.subtipoRegistrado;
  const faltas = resumo?.faltas;
  const avisos: string[] = [];
  if (resumo) {
    if (filtros.status.length)
      avisos.push(
        "O filtro Situação restringe a base: só os vínculos com as situações escolhidas entram nas contagens.",
      );
    if (semSubtipo && resumo.total.desistenciaSemSubtipo)
      avisos.push(
        "O subtipo da desistência (voluntária ou tácita) não é registrado no sistema: os desistentes estão em Desistência sem subtipo.",
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
        className="ui-tabela-rolagem approved-resumo-rolagem"
        aria-busy="true"
      >
        <table className="approved-resumo-tabela">
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
      <div className="ui-tabela-rolagem approved-resumo-rolagem">
        <table
          className="approved-resumo-tabela"
          aria-describedby="approvedResumoBase"
        >
          <caption className="sr-only">
            Contagem de candidatos por cargo e status
          </caption>
          <thead>
            <tr>
              <th scope="col">Cargo / vaga</th>
              <th scope="col" className="approved-resumo-num">
                {ROTULO_DA_COLUNA.aprovados}
              </th>
              {CATEGORIAS_DO_RESUMO.map((c) => (
                <th key={c} scope="col" className="approved-resumo-num">
                  {ROTULO_DA_COLUNA[c]}
                </th>
              ))}
            </tr>
          </thead>
          {resumo.editais.map((edital) => (
            <Fragment key={edital.editalId}>
              {variosEditais ? (
                <tbody>
                  <tr className="approved-resumo-edital">
                    <th scope="rowgroup" colSpan={colunas}>
                      {edital.rotulo}
                    </th>
                  </tr>
                </tbody>
              ) : null}
              {edital.grupos.map((grupo) => (
                <tbody key={grupo.chave}>
                  <tr className="approved-resumo-grupo">
                    <th scope="rowgroup" colSpan={colunas}>
                      {grupo.rotulo}
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
                        <th scope="row" className="approved-resumo-vaga">
                          <span>{linha.modalidade}</span>
                          <span className="approved-resumo-meta">
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
                          semSubtipo={semSubtipo}
                          aoAbrir={setDetalhe}
                        />
                      </tr>
                    );
                  })}
                  <tr className="approved-resumo-subtotal">
                    <th scope="row">Total · {grupo.rotulo}</th>
                    <Celulas
                      contagem={grupo.subtotal}
                      ids={grupo.ids}
                      onde={`total de ${grupo.rotulo}`}
                      semSubtipo={semSubtipo}
                      aoAbrir={setDetalhe}
                    />
                  </tr>
                </tbody>
              ))}
              {variosEditais ? (
                <tbody>
                  <tr className="approved-resumo-subtotal">
                    <th scope="row">Total do edital · {edital.rotulo}</th>
                    <Celulas
                      contagem={edital.subtotal}
                      ids={edital.ids}
                      onde={`total do edital ${edital.rotulo}`}
                      semSubtipo={semSubtipo}
                      aoAbrir={setDetalhe}
                    />
                  </tr>
                </tbody>
              ) : null}
            </Fragment>
          ))}
          <tfoot>
            <tr className="approved-resumo-total">
              <th scope="row">Total geral</th>
              <Celulas
                contagem={resumo.total}
                ids={resumo.ids}
                onde="total geral"
                semSubtipo={semSubtipo}
                aoAbrir={setDetalhe}
              />
            </tr>
          </tfoot>
        </table>
      </div>
    );

  return (
    <div
      id="approvedPanelResumo"
      className={classes(
        "approved-tabpanel approved-resumo",
        !ativa && "hidden",
      )}
      role="tabpanel"
      aria-labelledby="approvedTabResumo"
    >
      {ativa ? (
        <>
          <PainelDeFiltros
            idDoTitulo="approvedResumoFiltrosTitulo"
            className="approved-filters"
            quantos={quantos}
            podeLimpar={quantos > 0}
            aoLimpar={aoLimparFiltros}
          >
            {/* Os mesmos filtros da aba Aprovados (o mesmo estado). */}
            <div className="ui-grade-de-campos">
              <Campo rotulo="Edital" idDoControle="approvedResumoFiltroEdital">
                <MultiSelectBusca
                  id="approvedResumoFiltroEdital"
                  placeholder="Todos os editais"
                  opcoes={opcoes.editais}
                  selecionados={filtros.editalId}
                  aoMudar={(valores) => aoMudarFiltro("editalId", valores)}
                />
              </Campo>
              <Campo rotulo="Cargo" idDoControle="approvedResumoFiltroCargo">
                <MultiSelectBusca
                  id="approvedResumoFiltroCargo"
                  placeholder="Todos os cargos"
                  opcoes={opcoes.cargos}
                  selecionados={filtros.cargo}
                  aoMudar={(valores) => aoMudarFiltro("cargo", valores)}
                />
              </Campo>
              <Campo
                rotulo="Modalidade"
                idDoControle="approvedResumoFiltroModalidade"
              >
                <MultiSelectBusca
                  id="approvedResumoFiltroModalidade"
                  placeholder="Todas as modalidades"
                  opcoes={opcoes.modalidades}
                  selecionados={filtros.modalidade}
                  aoMudar={(valores) => aoMudarFiltro("modalidade", valores)}
                />
              </Campo>
              <Campo
                rotulo="Situação"
                idDoControle="approvedResumoFiltroStatus"
              >
                <MultiSelectBusca
                  id="approvedResumoFiltroStatus"
                  placeholder="Todas as situações"
                  opcoes={OPCOES_DO_FILTRO_DE_STATUS}
                  selecionados={filtros.status}
                  aoMudar={(valores) => aoMudarFiltro("status", valores)}
                />
              </Campo>
            </div>
          </PainelDeFiltros>

          <section
            className="ui-card approved-resumo-card"
            aria-labelledby="approvedResumoTitulo"
          >
            <div className="ui-tabela-topo">
              <h3 id="approvedResumoTitulo">Contagem por cargo e status</h3>
              <span
                className="ui-tabela-meta"
                id="approvedResumoBase"
                aria-live="polite"
              >
                {resumo && carregado
                  ? `${plural(resumo.total.aprovados, "vínculo", "vínculos")} · ${plural(resumo.editais.length, "edital", "editais")}`
                  : ""}
              </span>
              <button
                id="approvedResumoExportar"
                className="btn secondary"
                type="button"
                disabled={
                  exportarDesativado || !resumo || !resumo.total.aprovados
                }
                onClick={() => resumo && aoExportar(resumo)}
              >
                <i className="fa-solid fa-download" aria-hidden="true" />{" "}
                Exportar
              </button>
            </div>
            {avisos.length ? (
              <ul className="approved-resumo-avisos status-discreto">
                {avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            ) : null}
            {conteudo}
          </section>
        </>
      ) : null}
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
