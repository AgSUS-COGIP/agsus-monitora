import { useEffect, useRef, useState } from "react";
import { formatDateBR, formatNumberBR } from "../../lib/formatters.js";
import {
  AREA_SAUDE_INDIGENA,
  INDICADORES,
  ORDEM_DOS_STATUS,
  experienciaPorExtenso,
  linkSeguro,
  rotuloCurtoDoDia,
  rotuloDoMunicipio,
  tomDoStatus,
  valorDoIndicador,
} from "../../lib/analises-da-area.js";
import { urlDaPlanilhaGoogle } from "../../lib/planilhas.js";
import { Modal } from "../modal.jsx";

/*
  Peças do painel de Análises por área. Classes `aa-*` de
  `src/styles/analises-da-area.css`; as genéricas (`table-card`, `table-wrap`,
  `btn`, `alert`) são as do app.
*/

export const classes = (...lista) => lista.filter(Boolean).join(" ");

export function Seletor({ id, rotulo, vazio, opcoes, valor, aoMudar }) {
  return (
    <div className="aa-campo">
      <label htmlFor={id}>{rotulo}</label>
      <select
        id={id}
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
      >
        {vazio !== undefined ? <option value="">{vazio}</option> : null}
        {opcoes.map(([valorDaOpcao, rotuloDaOpcao]) => (
          <option key={valorDaOpcao} value={valorDaOpcao}>
            {rotuloDaOpcao}
          </option>
        ))}
      </select>
    </div>
  );
}

/* Os sete indicadores; os que filtram são botões com aria-pressed. */
export function Indicadores({ contagem, carregado, ativo, aoEscolher }) {
  return (
    <div className="aa-kpis" aria-label="Resumo das análises">
      {INDICADORES.map((indicador) => {
        const filtra = indicador.status.length > 0;
        const ligado = filtra && ativo === indicador.chave;
        return (
          <button
            key={indicador.chave}
            type="button"
            className={classes(
              "aa-kpi",
              `aa-tom-${indicador.tom}`,
              ligado && "is-active",
            )}
            data-indicador={indicador.chave}
            aria-pressed={filtra ? ligado : undefined}
            title={
              filtra
                ? `Filtrar: ${indicador.rotulo}`
                : "Mostrar todos os status"
            }
            onClick={() => aoEscolher(indicador.chave)}
          >
            <span className="aa-kpi-icone">
              <i className={`fa-solid ${indicador.icone}`} aria-hidden="true" />
            </span>
            <small>{indicador.rotulo}</small>
            {/* Carregando não é zero. */}
            <strong>
              {carregado ? valorDoIndicador(indicador.chave, contagem) : "—"}
            </strong>
          </button>
        );
      })}
    </div>
  );
}

export function SeloDeStatus({ status }) {
  return (
    <span className={`aa-status aa-tom-${tomDoStatus(status)}`}>
      {status || "Sem status"}
    </span>
  );
}

function LegendaDosStatus() {
  return (
    <div className="aa-legenda" aria-hidden="true">
      {ORDEM_DOS_STATUS.map((status) => (
        <span key={status}>
          <i className={`aa-tom-${tomDoStatus(status)}`} />
          {status}
        </span>
      ))}
    </div>
  );
}

/* Barras horizontais empilhadas por status, uma por responsável. */
export function GraficoPorResponsavel({ grupos }) {
  const maior = Math.max(1, ...grupos.map((grupo) => grupo.total));
  return (
    <div className="table-card card aa-grafico">
      <div className="aa-grafico-cabeca">
        <h3>Por responsável</h3>
        <LegendaDosStatus />
      </div>
      {grupos.length ? (
        <ul className="aa-barras" aria-label="Análises por responsável">
          {grupos.map((grupo) => (
            <li
              key={grupo.responsavel}
              aria-label={`${grupo.responsavel}: ${grupo.total} — ${Object.entries(
                grupo.status,
              )
                .map(([status, total]) => `${status} ${total}`)
                .join(", ")}`}
            >
              <span className="aa-barra-nome" title={grupo.responsavel}>
                {grupo.responsavel}
              </span>
              <span
                className="aa-barra"
                style={{ width: `${(grupo.total / maior) * 100}%` }}
              >
                {[
                  ...ORDEM_DOS_STATUS,
                  ...Object.keys(grupo.status).filter(
                    (status) => !ORDEM_DOS_STATUS.includes(status),
                  ),
                ]
                  .filter((status) => grupo.status[status])
                  .map((status) => (
                    <span
                      key={status}
                      className={`aa-tom-${tomDoStatus(status)}`}
                      style={{
                        flexGrow: grupo.status[status],
                      }}
                      title={`${status}: ${grupo.status[status]}`}
                    />
                  ))}
              </span>
              <span className="aa-barra-total">
                {formatNumberBR(grupo.total)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="aa-vazio-curto">Sem análises no filtro atual.</p>
      )}
    </div>
  );
}

/* Colunas por dia de análise (os 30 dias mais recentes com análise). */
export function GraficoDiario({ dias }) {
  const maior = Math.max(1, ...dias.map((dia) => dia.total));
  // Rótulo a cada N colunas, para não encavalar.
  const passo = Math.max(1, Math.ceil(dias.length / 8));
  return (
    <div className="table-card card aa-grafico">
      <div className="aa-grafico-cabeca">
        <h3>Evolução diária</h3>
        <span className="aa-grafico-nota">Análises por data de análise</span>
      </div>
      {dias.length ? (
        <ol className="aa-colunas" aria-label="Análises por dia">
          {dias.map((dia, indice) => (
            <li
              key={dia.dia}
              aria-label={`${formatDateBR(dia.dia)}: ${dia.total}`}
              title={`${formatDateBR(dia.dia)}: ${formatNumberBR(dia.total)}`}
            >
              <span
                className="aa-coluna"
                style={{ height: `${(dia.total / maior) * 100}%` }}
              />
              <small aria-hidden="true">
                {indice % passo === 0 ? rotuloCurtoDoDia(dia.dia) : ""}
              </small>
            </li>
          ))}
        </ol>
      ) : (
        <p className="aa-vazio-curto">Sem datas de análise no filtro atual.</p>
      )}
    </div>
  );
}

const LOTE = 50;

/*
  A tabela desenha 50 linhas por vez: mais 50 quando o fim da tabela aparece
  na tela (IntersectionObserver) ou no botão "Carregar mais". Com milhares de
  análises, desenhar tudo a cada tecla na busca travava o navegador.
*/
export function TabelaDeAnalises({
  linhas,
  carregado,
  comMunicipio,
  aoAbrir,
  vazio,
}) {
  const [visiveis, setVisiveis] = useState(LOTE);
  const sentinela = useRef(null);

  // Filtro novo: volta ao primeiro lote.
  useEffect(() => setVisiveis(LOTE), [linhas]);

  const mostradas = linhas.slice(0, visiveis);
  const temMais = linhas.length > visiveis;

  useEffect(() => {
    if (!temMais || typeof IntersectionObserver !== "function") return;
    const alvo = sentinela.current;
    if (!alvo) return undefined;
    const observador = new IntersectionObserver((entradas) => {
      if (entradas.some((entrada) => entrada.isIntersecting))
        setVisiveis((atual) => atual + LOTE);
    });
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [temMais, visiveis]);

  // As linhas novas precisam dos rótulos do modo cartão (≤ 900px).
  useEffect(() => {
    document.dispatchEvent(new CustomEvent("agsus:content-updated"));
  }, [mostradas.length, linhas]);

  const colunas = comMunicipio ? 7 : 6;

  return (
    <>
      <div className="table-wrap aa-tabela-wrap">
        <table className="aa-tabela">
          <thead>
            <tr>
              <th>Unidade</th>
              <th>Edital</th>
              <th>Vaga</th>
              {comMunicipio ? <th>Município/UF</th> : null}
              <th>Candidato</th>
              <th>Status</th>
              <th className="aa-acoes">Detalhes</th>
            </tr>
          </thead>
          <tbody id="aaLinhas">
            {!carregado ? (
              <tr>
                <td colSpan={colunas} className="aa-vazio-curto">
                  Carregando análises…
                </td>
              </tr>
            ) : mostradas.length ? (
              mostradas.map((linha) => (
                <tr key={linha.id}>
                  <td>{linha.unidade || "—"}</td>
                  <td>{linha.edital || "—"}</td>
                  <td className="aa-vaga">
                    {linha.nome_vaga || "—"}
                    {linha.codigo_vaga ? (
                      <small>Código {linha.codigo_vaga}</small>
                    ) : null}
                  </td>
                  {comMunicipio ? (
                    <td>{rotuloDoMunicipio(linha) || "—"}</td>
                  ) : null}
                  <td className="aa-candidato">
                    <strong>{linha.candidato || "—"}</strong>
                    <small>
                      {linha.responsavel_analise
                        ? `Responsável: ${linha.responsavel_analise}`
                        : "Sem responsável"}
                    </small>
                  </td>
                  <td>
                    <SeloDeStatus status={linha.status_consolidado} />
                  </td>
                  <td className="aa-acoes">
                    <button
                      type="button"
                      className="btn secondary aa-detalhe-botao"
                      aria-label={`Ver detalhes de ${linha.candidato || "candidato"}`}
                      onClick={() => aoAbrir(linha.id)}
                    >
                      <i className="fa-solid fa-eye" aria-hidden="true" /> Ver
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={colunas} className="aa-vazio-curto">
                  {vazio}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {temMais ? (
        <div className="aa-mais" ref={sentinela}>
          <span>
            Mostrando {formatNumberBR(mostradas.length)} de{" "}
            {formatNumberBR(linhas.length)}
          </span>
          <button
            type="button"
            className="btn secondary"
            onClick={() => setVisiveis((atual) => atual + LOTE)}
          >
            Carregar mais
          </button>
        </div>
      ) : null}
    </>
  );
}

const numero = (valor) =>
  valor === null || valor === undefined || valor === ""
    ? "—"
    : formatNumberBR(valor, { maximumFractionDigits: 2 });

function Campo({ rotulo, children }) {
  return (
    <div className="aa-detalhe-campo">
      <dt>{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/*
  Detalhe de uma análise, numa gaveta à direita (no celular, folha de baixo).
  A linha já tem quase tudo; o texto da análise chega por
  get_analise_detalhe_da_area quando a gaveta abre.
*/
export function GavetaDoDetalhe({
  linha,
  area,
  editalJanela,
  estado,
  aoFechar,
}) {
  const [detalhe, setDetalhe] = useState({ id: "", dados: null, erro: "" });

  useEffect(() => {
    let vivo = true;
    estado
      .detalhe(linha.id)
      .then((dados) => {
        if (vivo) setDetalhe({ id: linha.id, dados, erro: "" });
      })
      .catch((erro) => {
        console.warn("Detalhe da análise indisponível:", erro);
        if (vivo)
          setDetalhe({
            id: linha.id,
            dados: null,
            erro: "Não foi possível carregar o texto da análise.",
          });
      });
    return () => {
      vivo = false;
    };
  }, [estado, linha.id]);

  const carregandoDetalhe = detalhe.id !== linha.id;
  const dados = detalhe.id === linha.id ? detalhe.dados : null;
  const daSaudeIndigena = area === AREA_SAUDE_INDIGENA;
  const inicio =
    dados?.data_inicio_analise ?? editalJanela?.data_inicio_analise;
  const fim = dados?.data_fim_analise ?? editalJanela?.data_fim_analise;
  const origem = urlDaPlanilhaGoogle(linha.origem_arquivo_id);
  const pdf = linkSeguro(linha.link_pdf);

  return (
    <Modal
      id="aaDetalhe"
      rotuloId="aaDetalheTitulo"
      aoFechar={aoFechar}
      className="aa-detalhe-modal"
      cartaoClassName="aa-detalhe"
    >
      <div className="modal-head">
        <div>
          <h3 id="aaDetalheTitulo">{linha.candidato || "Candidato"}</h3>
          <SeloDeStatus status={linha.status_consolidado} />
        </div>
        <button
          type="button"
          className="btn secondary"
          aria-label="Fechar detalhes"
          data-foco-inicial
          onClick={aoFechar}
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>
      <div className="modal-body aa-detalhe-corpo">
        <section>
          <h4>Vaga</h4>
          <dl className="aa-detalhe-grade">
            <Campo rotulo="Unidade">{linha.unidade || "—"}</Campo>
            <Campo rotulo="Edital">{linha.edital || "—"}</Campo>
            <Campo rotulo="Vaga">{linha.nome_vaga || "—"}</Campo>
            <Campo rotulo="Código">{linha.codigo_vaga || "—"}</Campo>
            {linha.municipio ? (
              <Campo rotulo="Município/UF">{rotuloDoMunicipio(linha)}</Campo>
            ) : null}
            <Campo rotulo="Categoria">{linha.categoria || "—"}</Campo>
            <Campo rotulo="Modalidade">
              {linha.modalidade_concorrencia || "—"}
            </Campo>
            {linha.pcd ? <Campo rotulo="PcD">{linha.pcd}</Campo> : null}
            {dados?.regime ? (
              <Campo rotulo="Regime">{dados.regime}</Campo>
            ) : null}
            {dados?.carga_horaria ? (
              <Campo rotulo="Carga horária">{dados.carga_horaria}</Campo>
            ) : null}
          </dl>
        </section>

        <section>
          <h4>Análise</h4>
          <dl className="aa-detalhe-grade">
            <Campo rotulo="Etapa">{linha.etapa || "—"}</Campo>
            <Campo rotulo="Responsável">
              {linha.responsavel_analise || "—"}
            </Campo>
            <Campo rotulo="Data da análise">
              {formatDateBR(linha.data_analise, "—")}
            </Campo>
            <Campo rotulo="Janela do edital">
              {inicio || fim
                ? `${formatDateBR(inicio, "…")} a ${formatDateBR(fim, "…")}`
                : "—"}
            </Campo>
            <Campo rotulo="Situação">
              {linha.ativo === false ? "Inativo" : "Ativo"}
            </Campo>
          </dl>
        </section>

        <section>
          <h4>Pontuação</h4>
          <dl className="aa-detalhe-grade">
            <Campo rotulo="Nota final">
              {numero(linha.nota_final_ajustada)}
            </Campo>
            <Campo rotulo="Escolaridade">
              {numero(linha.pontuacao_escolaridade)}
            </Campo>
            <Campo rotulo="Cursos e aperfeiçoamento">
              {numero(linha.pontuacao_cursos_aperfeicoamento)}
            </Campo>
            <Campo rotulo="Experiência profissional">
              {numero(linha.pontuacao_experiencia_profissional)}
            </Campo>
            {daSaudeIndigena ? (
              <Campo rotulo="Critério étnico">
                {numero(linha.pontuacao_criterio_etnico)}
              </Campo>
            ) : null}
          </dl>
        </section>

        <section>
          <h4>Experiência</h4>
          <dl className="aa-detalhe-grade">
            {daSaudeIndigena ? (
              <>
                <Campo rotulo="Saúde indígena">
                  {numero(linha.experiencia_saude_indigena_total)}
                </Campo>
                <Campo rotulo="Atenção básica">
                  {numero(linha.experiencia_atencao_basica_total)}
                </Campo>
              </>
            ) : (
              <>
                <Campo rotulo="Experiência profissional">
                  {experienciaPorExtenso(
                    linha.experiencia_profissional_anos,
                    linha.experiencia_profissional_meses,
                    linha.experiencia_profissional_dias,
                  ) || "—"}
                </Campo>
                <Campo rotulo="Total">
                  {numero(linha.experiencia_profissional_total)}
                </Campo>
              </>
            )}
          </dl>
        </section>

        <section>
          <h4>Parecer</h4>
          {carregandoDetalhe ? (
            <p className="aa-vazio-curto">Carregando o texto da análise…</p>
          ) : detalhe.erro ? (
            <div className="alert warn">{detalhe.erro}</div>
          ) : (
            <p className="aa-detalhe-texto">
              {dados?.analise || "Sem texto de análise."}
            </p>
          )}
          {dados?.erro_pdf ? (
            <div className="alert warn">PDF: {dados.erro_pdf}</div>
          ) : null}
        </section>

        <div className="aa-detalhe-links">
          {pdf ? (
            <a
              className="btn secondary"
              href={pdf}
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fa-solid fa-file-pdf" aria-hidden="true" /> Abrir
              PDF
            </a>
          ) : (
            <span className="aa-grafico-nota">
              PDF {linha.pdf_status ? `(${linha.pdf_status})` : "indisponível"}
            </span>
          )}
          {origem ? (
            <a
              className="btn secondary"
              href={origem}
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fa-solid fa-file-excel" aria-hidden="true" />{" "}
              Planilha de origem
            </a>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
