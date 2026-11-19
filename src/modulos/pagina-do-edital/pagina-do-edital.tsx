import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import {
  usarEstadoDaNavegacao,
  usarNavegacao,
} from "../../app/contexto-do-app.ts";
import { abrirTelaDoEdital } from "../../app/abrir-tela-do-edital.ts";
import { TelaNaUrl, usarFiltrosNaUrl } from "../../app/usar-filtros-na-url.ts";
import type { EsquemaDosFiltros } from "../../app/filtros-no-endereco.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { formatNumberBR } from "../../lib/base/formatters";
import {
  formatarDataHora,
  hojeEmBrasilia,
} from "../../lib/cronograma/cronograma-do-edital.ts";
import { textoDaFonteDoFunil } from "../../lib/editais/funil-do-edital.ts";
import {
  TEXTO_DAS_VAGAS_DO_EDITAL,
  rotuloDaLinha,
  separarFila,
} from "../../lib/editais/vinculos-do-quadro.ts";
import type { VinculoDaVaga } from "../../lib/editais/vinculos-do-quadro.ts";
import { telaPermitida } from "../../lib/navegacao/navegacao";
import { telaDaRota } from "../../lib/navegacao/rotas.ts";
import {
  ABAS_DA_PAGINA,
  ROTULOS_DAS_MARCAS,
  andamentoDasEtapas,
  contagemDasMarcas,
  editalDoEndereco,
  ehAbaDaPagina,
  etapasNaLinhaDoTempo,
  historicoDoCronograma,
  origemDoCronograma,
  quadroDaPagina,
  retificacoesDoHistorico,
  situacaoDasVagas,
  situacaoDosCandidatos,
  situacaoExcepcional,
  somenteCadastroReserva,
  telasDoEdital,
} from "../../lib/pagina-do-edital/pagina-do-edital.ts";
import type {
  AbaDaPagina,
  EtapaNaLinhaDoTempo,
} from "../../lib/pagina-do-edital/pagina-do-edital.ts";
import {
  dataCurta,
  enriquecerLinhas,
  linhasDaResposta,
  linkSeguro,
  statusCanonico,
} from "../../lib/visao-geral/visao-geral.ts";
import { getSupabaseClient } from "../../lib/sessao/supabaseClient";
import {
  Abas,
  Aviso,
  BlocosEsqueleto,
  CabecalhoDaTela,
  ErroAoCarregar,
  EstadoVazio,
  GradeDeKpis,
  Kpi,
  Selo,
} from "../../ui/index.ts";
import { criarEstadoDosAvisos } from "../conferencias/estado.ts";
import { buscarAcompanhamentoNoSupabase } from "../visao-geral/estado.ts";
import type { LinhaDaVisaoGeral } from "../visao-geral/tipos.ts";
import type { CronogramaLido } from "../editais/estado.ts";
import { abrirPaginaDoEdital } from "./abrir.ts";
import { criarEstadoDaPaginaDoEdital } from "./estado.ts";
import type {
  Carga,
  ClienteDaPaginaDoEdital,
  EstadoDaPaginaDoEdital,
} from "./estado.ts";
import type { ClienteDoAcompanhamento } from "../visao-geral/tipos.ts";
import type { ClienteDosAvisos } from "../conferencias/tipos.ts";
import "./pagina-do-edital.css";

/*
  A página própria do edital (`/<área>/edital/<número-ano>`), só leitura: o
  cabeçalho com a situação e as abas Resumo, Vagas e cargos, Etapas,
  Candidatos e Fontes e histórico. A rota é src/lib/navegacao/rotas.ts; o
  edital vem do endereço (fica nele: é a página) e o "Voltar" volta para onde
  a pessoa estava (src/app/navegacao.ts, `voltarDaPaginaDoEdital`). A aba vai
  na URL (`?aba=etapas`) sem empilhar: o "Voltar" não passeia pelas abas.
*/

const fmt = (valor: unknown) => formatNumberBR(valor);
const plural = (n: number, um: string, varios: string) =>
  `${fmt(n)} ${n === 1 ? um : varios}`;

const FILTROS_DA_PAGINA: EsquemaDosFiltros<"aba"> = Object.freeze({
  aba: { padrao: "resumo", aceita: ehAbaDaPagina },
});

/* Os avisos de sequência (recurso depois do preliminar…) baixam sob demanda, como em Editais. */
function useSequencia(etapas: CronogramaLido["etapas"]): string[] {
  const [avisos, setAvisos] = useState<string[]>([]);
  useEffect(() => {
    let vivo = true;
    const lista = Array.isArray(etapas) ? etapas : [];
    void import("../../lib/cronograma/sequencia-do-cronograma.ts").then(
      (modulo) => {
        if (vivo) setAvisos(modulo.avisosDeSequencia(lista));
      },
    );
    return () => {
      vivo = false;
    };
  }, [etapas]);
  return avisos;
}

function tomDoStatus(status: string): string {
  if (status === "Cancelado") return "reprovado";
  if (status === "Suspenso" || status === "Paralisado") return "pendente";
  if (status === "Concluído" || status === "Cronograma encerrado")
    return "aprovado";
  if (status === "Em andamento") return "revisar";
  return "neutro";
}

function tomDaMarca(marca: EtapaNaLinhaDoTempo["marca"]): string {
  if (marca === "concluida") return "aprovado";
  return marca === "atual" ? "revisar" : "neutro";
}

const periodoDaEtapa = (etapa: EtapaNaLinhaDoTempo) =>
  `${dataCurta(etapa.inicio) || "Sem data"}${
    etapa.fim && etapa.fim !== etapa.inicio ? ` a ${dataCurta(etapa.fim)}` : ""
  }`;

function Bloco({
  id,
  titulo,
  extra,
  children,
}: {
  id: string;
  titulo: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="pagina-do-edital-bloco" aria-labelledby={id}>
      <div className="pagina-do-edital-titulo-do-bloco">
        <h3 id={id}>{titulo}</h3>
        {extra ? <span>{extra}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Voltar() {
  const navegacao = usarNavegacao();
  const { retorno, edital } = usarEstadoDaNavegacao();
  const destino =
    retorno && retorno.edital === edital
      ? telaDaRota(retorno.view)?.titulo || retorno.titulo
      : "";
  return (
    <button
      type="button"
      className="btn contorno small pagina-do-edital-voltar"
      onClick={() => navegacao.voltarDaPaginaDoEdital()}
    >
      <i className="fa-solid fa-arrow-left" aria-hidden="true" />{" "}
      {destino ? `Voltar para ${destino}` : "Voltar"}
    </button>
  );
}

// ── Vagas e candidatos ───────────────────────────────────────────────────

function Vagas({
  linha,
  quadro,
}: {
  linha: LinhaDaVisaoGeral;
  quadro: Carga<unknown> | undefined;
}) {
  const vagas = situacaoDasVagas(linha);
  const soReserva =
    vagas.imediatas === 0 &&
    quadro?.status === "pronto" &&
    somenteCadastroReserva(quadro.dados);
  if (soReserva)
    return (
      <Bloco
        id="peVagas"
        titulo="Situação das vagas"
        extra={<Selo tom="neutro">Somente cadastro reserva</Selo>}
      >
        <GradeDeKpis rotulo="Situação das vagas">
          <Kpi
            icone="fa-briefcase"
            rotulo="Vagas imediatas"
            valor="0"
            detalhe="Sem vagas imediatas"
          />
          <Kpi
            icone="fa-layer-group"
            rotulo="Contratações do cadastro reserva"
            valor={fmt(vagas.cadastroReserva)}
          />
        </GradeDeKpis>
      </Bloco>
    );
  return (
    <Bloco id="peVagas" titulo="Situação das vagas" extra={vagas.texto}>
      <GradeDeKpis rotulo="Situação das vagas">
        <Kpi
          icone="fa-briefcase"
          rotulo="Preenchidas"
          valor={fmt(vagas.preenchidas)}
          detalhe={`de ${fmt(vagas.imediatas)}`}
          titulo={vagas.texto}
        />
        <Kpi
          icone="fa-user-plus"
          rotulo="Imediatas sem contratação"
          valor={fmt(vagas.abertas)}
        />
        <Kpi
          icone="fa-rotate"
          rotulo="Reabertas em outro edital"
          valor={fmt(vagas.reabertas)}
        />
        <Kpi
          icone="fa-layer-group"
          rotulo="Contratações além das vagas imediatas"
          valor={fmt(vagas.cadastroReserva)}
        />
      </GradeDeKpis>
      {(linha.textos_da_reabertura || []).map((texto) => (
        <p key={texto} className="pagina-do-edital-nota">
          {texto}
        </p>
      ))}
    </Bloco>
  );
}

function Candidatos({
  linha,
  carregando,
}: {
  linha: LinhaDaVisaoGeral;
  carregando: boolean;
}) {
  const candidatos = situacaoDosCandidatos(linha);
  const semLista = !carregando && !candidatos.temLista;
  const valor = (numero: number) => (semLista ? "—" : fmt(numero));
  return (
    <Bloco id="peCandidatos" titulo="Situação dos candidatos">
      <GradeDeKpis rotulo="Situação dos candidatos">
        <Kpi
          icone="fa-list-check"
          rotulo="Aprovados"
          valor={valor(candidatos.aprovados)}
          carregando={carregando}
        />
        <Kpi
          icone="fa-user-check"
          rotulo="Contratados"
          valor={fmt(candidatos.contratados)}
        />
        <Kpi
          icone="fa-hourglass-half"
          rotulo="Aguardando chamada"
          valor={valor(candidatos.aguardando)}
          carregando={carregando}
        />
        <Kpi
          icone="fa-users"
          rotulo="Demais situações"
          valor={valor(candidatos.demais)}
          detalhe={
            !semLista && candidatos.desistentes
              ? `${plural(candidatos.desistentes, "desistente", "desistentes")} à parte`
              : undefined
          }
          carregando={carregando}
        />
      </GradeDeKpis>
      {semLista ? (
        <p className="pagina-do-edital-nota">Sem lista de aprovados vigente.</p>
      ) : null}
    </Bloco>
  );
}

// ── Etapas ───────────────────────────────────────────────────────────────

function Etapa({ etapa }: { etapa: EtapaNaLinhaDoTempo }) {
  return (
    <li
      className="pagina-do-edital-etapa"
      data-marca={etapa.marca}
      aria-current={etapa.marca === "atual" ? "step" : undefined}
    >
      <span className="pagina-do-edital-ponto" aria-hidden="true" />
      <div>
        <strong>{etapa.atividade}</strong>
        <span className="pagina-do-edital-datas">{periodoDaEtapa(etapa)}</span>
        {etapa.observacao ? <small>{etapa.observacao}</small> : null}
      </div>
      <Selo tom={tomDaMarca(etapa.marca)}>
        {ROTULOS_DAS_MARCAS[etapa.marca]}
      </Selo>
    </li>
  );
}

function LinhaDoTempo({
  dados,
  etapas,
}: {
  dados: CronogramaLido;
  etapas: readonly EtapaNaLinhaDoTempo[];
}) {
  const sequencia = useSequencia(dados.etapas);
  const contagem = contagemDasMarcas(etapas);
  return (
    <Bloco
      id="peLinha"
      titulo="Linha do tempo"
      extra={
        etapas.length
          ? `${plural(contagem.concluida, "concluída", "concluídas")} · ${plural(contagem.prevista, "prevista", "previstas")}`
          : null
      }
    >
      {sequencia.length ? (
        <Aviso tom="warning" papel="status">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{" "}
          <span>{sequencia.join(" ")}</span>
        </Aviso>
      ) : null}
      {etapas.length ? (
        <ol className="pagina-do-edital-etapas">
          {etapas.map((etapa) => (
            <Etapa key={etapa.chave} etapa={etapa} />
          ))}
        </ol>
      ) : (
        <EstadoVazio>Nenhuma etapa cadastrada para este edital.</EstadoVazio>
      )}
    </Bloco>
  );
}

function Retificacoes({ dados }: { dados: CronogramaLido }) {
  const { retificacoes, outrasAlteracoes } = retificacoesDoHistorico(
    dados.historico,
  );
  return (
    <Bloco
      id="peRetif"
      titulo="Retificações do cronograma"
      extra={
        outrasAlteracoes
          ? `${plural(outrasAlteracoes, "outra alteração", "outras alterações")} no histórico`
          : null
      }
    >
      {retificacoes.length ? (
        <ul className="pagina-do-edital-retificacoes">
          {retificacoes.map((item) => (
            <li key={item.chave}>
              <div>
                <strong>{item.titulo}</strong>
                <span>{formatarDataHora(item.quando)}</span>
              </div>
              {item.motivo ? <p>{item.motivo}</p> : null}
              <small>
                {plural(item.alteracoes, "etapa alterada", "etapas alteradas")}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVazio>Nenhuma retificação lançada.</EstadoVazio>
      )}
    </Bloco>
  );
}

/* O andamento no Resumo: a etapa atual e a próxima prevista. */
function Andamento({
  etapas,
  aoVerEtapas,
}: {
  etapas: readonly EtapaNaLinhaDoTempo[];
  aoVerEtapas: () => void;
}) {
  const { atuais, proxima } = andamentoDasEtapas(etapas);
  const mostrar = [...atuais, ...(proxima ? [proxima] : [])];
  return (
    <Bloco id="peAndamento" titulo="Andamento">
      {mostrar.length ? (
        <ol className="pagina-do-edital-etapas">
          {mostrar.map((etapa) => (
            <Etapa key={etapa.chave} etapa={etapa} />
          ))}
        </ol>
      ) : (
        <EstadoVazio>
          {etapas.length
            ? "Todas as etapas do cronograma já passaram."
            : "Nenhuma etapa cadastrada para este edital."}
        </EstadoVazio>
      )}
      {etapas.length ? (
        <button
          type="button"
          className="btn contorno small pagina-do-edital-mais"
          onClick={aoVerEtapas}
        >
          Ver as {fmt(etapas.length)} etapas
        </button>
      ) : null}
    </Bloco>
  );
}

// ── Avisos de conferência ────────────────────────────────────────────────

function AvisosDoEdital({
  estado,
  area,
  id,
}: {
  estado: EstadoDaPaginaDoEdital;
  area: string;
  id: string;
}) {
  const avisos = estado.avisos;
  const vazio = useMemo(
    () => ({
      assinar: () => () => {},
      obter: () => null,
    }),
    [],
  );
  const snapshot = useSyncExternalStore(
    avisos?.assinar ?? vazio.assinar,
    avisos?.obter ?? vazio.obter,
  );
  useEffect(() => {
    if (avisos && area) void avisos.carregar({ area });
  }, [avisos, area]);
  if (!avisos || !snapshot) return null;
  if (snapshot.status === "error" && snapshot.erroCodigo === "42501")
    return null;
  const doEdital = (snapshot.lista?.abertos || []).filter(
    (aviso) => aviso.editalId === id,
  );
  return (
    <Bloco
      id="peAvisos"
      titulo="Avisos de conferência"
      extra={
        doEdital.length ? plural(doEdital.length, "aberto", "abertos") : null
      }
    >
      {!snapshot.lista && snapshot.status !== "error" ? (
        <BlocosEsqueleto quantos={1} />
      ) : snapshot.status === "error" && !snapshot.lista ? (
        <ErroAoCarregar
          oQue="os avisos de conferência"
          mensagem={snapshot.erro}
          aoTentar={() => void avisos.carregar({ area })}
        />
      ) : doEdital.length ? (
        <ul className="pagina-do-edital-avisos">
          {doEdital.map((aviso) => (
            <li key={aviso.id} data-tom={aviso.tom}>
              <div>
                <strong>{aviso.titulo}</strong>
                <Selo
                  tom={
                    aviso.tom === "perigo"
                      ? "reprovado"
                      : aviso.tom === "aviso"
                        ? "pendente"
                        : "revisar"
                  }
                >
                  {aviso.rotuloDaGravidade}
                </Selo>
              </div>
              <span>
                {plural(aviso.quantidade, "caso", "casos")}
                {aviso.onde ? ` · ${aviso.onde}` : ""}
                {aviso.responsavel ? ` · ${aviso.responsavel}` : ""}
                {aviso.prazo ? ` · prazo ${dataCurta(aviso.prazo)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVazio>Nenhum aviso aberto para este edital.</EstadoVazio>
      )}
    </Bloco>
  );
}

// ── Vagas e cargos ───────────────────────────────────────────────────────

function ListaDeVinculos({
  titulo,
  vinculos,
  mostrarLinha,
}: {
  titulo: string;
  vinculos: readonly VinculoDaVaga[];
  mostrarLinha: boolean;
}) {
  if (!vinculos.length) return null;
  return (
    <details className="pagina-do-edital-vinculos">
      <summary>
        {titulo} ({fmt(vinculos.length)})
      </summary>
      <ul>
        {vinculos.map((vinculo) => (
          <li key={vinculo.vaga}>
            <strong>{vinculo.nome}</strong>
            {mostrarLinha && vinculo.cargoDoQuadro ? (
              <span>
                {rotuloDaLinha({
                  cargo: vinculo.cargoDoQuadro,
                  lotacao: vinculo.lotacaoDoQuadro,
                })}
              </span>
            ) : null}
            {vinculo.pendencia ? <span>{vinculo.pendencia}</span> : null}
            {!mostrarLinha && vinculo.candidatas.length ? (
              <span>
                {plural(
                  vinculo.candidatas.length,
                  "linha possível",
                  "linhas possíveis",
                )}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function QuadroDeVagas({
  carga,
  aoTentar,
}: {
  carga: Carga<unknown> | undefined;
  aoTentar: () => void;
}) {
  const quadro = useMemo(
    () => (carga?.status === "pronto" ? quadroDaPagina(carga.dados) : null),
    [carga],
  );
  if (!carga || carga.status === "carregando")
    return <BlocosEsqueleto quantos={2} />;
  if (carga.status === "erro")
    return carga.semPermissao ? (
      <Aviso tom="info" papel="status">
        O quadro de vagas é de Editais, Cronograma ou Entrevistas.
      </Aviso>
    ) : (
      <ErroAoCarregar
        oQue="o quadro de vagas"
        mensagem={carga.mensagem}
        aoTentar={aoTentar}
      />
    );
  if (!quadro) return null;
  return <QuadroLido quadro={quadro} />;
}

function QuadroLido({ quadro }: { quadro: ReturnType<typeof quadroDaPagina> }) {
  // A tabela nova avisa: o modo cartão (≤ 900px) põe os rótulos nas células.
  useEffect(() => {
    document.dispatchEvent(new CustomEvent("agsus:content-updated"));
  }, [quadro]);
  const fila = separarFila(quadro.fila.vinculos);
  const vagasDoEdital = quadro.fila.vagasDoEdital;
  return (
    <>
      <Bloco
        id="peQuadro"
        titulo="Quadro de vagas"
        extra={
          quadro.linhas.length
            ? `${plural(quadro.linhas.length, "linha", "linhas")} · ${plural(
                quadro.linhas.reduce((soma, l) => soma + l.imediatas, 0),
                "vaga imediata",
                "vagas imediatas",
              )}`
            : null
        }
      >
        {quadro.linhas.length ? (
          <div className="ui-tabela-rolagem pagina-do-edital-tabela">
            <table aria-label="Quadro de vagas">
              <thead>
                <tr>
                  <th scope="col">Cargo</th>
                  <th scope="col">Lotação</th>
                  <th scope="col">Imediatas</th>
                  <th scope="col">Cadastro reserva</th>
                  <th scope="col">Por modalidade</th>
                </tr>
              </thead>
              <tbody>
                {quadro.linhas.map((linha) => (
                  <tr key={linha.id}>
                    <td>{linha.cargo}</td>
                    <td>{linha.lotacao || "—"}</td>
                    <td>{fmt(linha.imediatas)}</td>
                    <td>{linha.cadastroReserva ? "Sim" : "Não"}</td>
                    <td>
                      {linha.modalidades.length
                        ? linha.modalidades
                            .map(({ nome, valor }) => `${nome}: ${valor}`)
                            .join(" · ")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EstadoVazio>Quadro de vagas ainda não importado.</EstadoVazio>
        )}
      </Bloco>
      <Bloco
        id="peVinculos"
        titulo="Vagas ligadas ao quadro"
        extra={
          vagasDoEdital === "COM_CODIGO"
            ? `${plural(fila.confirmadas.length, "confirmada", "confirmadas")} · ${plural(fila.ambiguas.length, "ambígua", "ambíguas")} · ${plural(fila.ausentes.length, "ausente", "ausentes")}`
            : null
        }
      >
        {vagasDoEdital && vagasDoEdital !== "COM_CODIGO" ? (
          <p className="pagina-do-edital-nota">
            {TEXTO_DAS_VAGAS_DO_EDITAL[vagasDoEdital]}
          </p>
        ) : vagasDoEdital === null ? (
          <p className="pagina-do-edital-nota">Vínculo ainda não calculado.</p>
        ) : (
          <>
            <ListaDeVinculos
              titulo="Ambíguas"
              vinculos={fila.ambiguas}
              mostrarLinha={false}
            />
            <ListaDeVinculos
              titulo="Ausentes"
              vinculos={fila.ausentes}
              mostrarLinha={false}
            />
            <ListaDeVinculos
              titulo="Confirmadas"
              vinculos={fila.confirmadas}
              mostrarLinha
            />
          </>
        )}
      </Bloco>
    </>
  );
}

// ── Candidatos ───────────────────────────────────────────────────────────

function TelasDaSelecao({ linha }: { linha: LinhaDaVisaoGeral }) {
  const telas = telasDoEdital((view) =>
    telaPermitida(view, window.getMonitoraProfile?.() ?? null),
  );
  if (!telas.length) return null;
  return (
    <Bloco id="peTelas" titulo="Abrir nas telas da seleção">
      <ul className="pagina-do-edital-telas">
        {telas.map((tela) => (
          <li key={tela.view}>
            <button
              type="button"
              className="btn contorno"
              data-tela={tela.view}
              onClick={() =>
                abrirTelaDoEdital(tela, {
                  id: String(linha.id ?? ""),
                  numero: linha.edital,
                })
              }
            >
              <i className={`fa-solid ${tela.icone}`} aria-hidden="true" />{" "}
              {tela.rotulo}
            </button>
          </li>
        ))}
      </ul>
    </Bloco>
  );
}

// ── Fontes e histórico ───────────────────────────────────────────────────

function Fontes({
  linha,
  cronograma,
  quadro,
}: {
  linha: LinhaDaVisaoGeral;
  cronograma: CronogramaLido | null;
  quadro: Carga<unknown> | undefined;
}) {
  const monitor = cronograma?.monitoramento as
    | (NonNullable<CronogramaLido["monitoramento"]> & {
        cronograma_origem?: string | null;
        cronograma_revisado_at?: string | null;
        cronograma_ultima_errata?: string | null;
      })
    | null
    | undefined;
  const origemDoQuadro =
    quadro?.status === "pronto" ? quadroDaPagina(quadro.dados).origem : null;
  const funil = textoDaFonteDoFunil(linha);
  const link = linkSeguro(linha.link_edital);
  const itens: { rotulo: string; valor: ReactNode }[] = [
    {
      rotulo: "Cadastro do edital",
      valor: "Editais (monitoramento do edital)",
    },
    {
      rotulo: "Cronograma",
      valor: monitor
        ? [
            origemDoCronograma(monitor.cronograma_origem) ||
              "origem não informada",
            monitor.cronograma_automatico === false
              ? "cálculo manual"
              : "cálculo automático",
            monitor.cronograma_revisado_at
              ? `revisado em ${formatarDataHora(monitor.cronograma_revisado_at)}`
              : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : "—",
    },
    {
      rotulo: "Quadro de vagas",
      valor: origemDoQuadro
        ? [
            origemDoQuadro.tipo === "PDF"
              ? "PDF de anexos"
              : origemDoQuadro.tipo === "MANUAL"
                ? "digitado"
                : origemDoQuadro.tipo,
            origemDoQuadro.arquivo,
            origemDoQuadro.gravadoEm
              ? `gravado em ${formatarDataHora(origemDoQuadro.gravadoEm)}`
              : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : quadro?.status === "pronto"
          ? "não importado"
          : "abra a aba Vagas e cargos",
    },
    {
      rotulo: "Inscritos e aptos",
      valor: funil ? funil.replace(/^Fonte: /, "") : "—",
    },
    {
      rotulo: "Contratações",
      valor: linha.admissoes
        ? `${plural(linha.admissoes, "admissão conciliada", "admissões conciliadas")} com o RH, de ${dataCurta(linha.primeira_admissao)} a ${dataCurta(linha.ultima_admissao)}`
        : "sem admissão conciliada com o RH",
    },
    {
      rotulo: "Edital publicado",
      valor: link ? (
        <a href={link} target="_blank" rel="noopener">
          {link}
        </a>
      ) : (
        "sem link cadastrado"
      ),
    },
  ];
  return (
    <Bloco id="peFontes" titulo="De onde vêm os dados">
      <dl className="pagina-do-edital-fontes">
        {itens.map((item) => (
          <div key={item.rotulo}>
            <dt>{item.rotulo}</dt>
            <dd>{item.valor}</dd>
          </div>
        ))}
      </dl>
    </Bloco>
  );
}

function Historico({ dados }: { dados: CronogramaLido }) {
  const registros = historicoDoCronograma(dados.historico);
  return (
    <Bloco
      id="peHistorico"
      titulo="Histórico do cronograma"
      extra={plural(registros.length, "registro", "registros")}
    >
      {registros.length ? (
        <ul className="pagina-do-edital-retificacoes">
          {registros.map((item) => (
            <li key={item.chave} data-tipo={item.tipo}>
              <div>
                <strong>{item.titulo}</strong>
                <span>{formatarDataHora(item.quando)}</span>
              </div>
              {item.motivo ? <p>{item.motivo}</p> : null}
              <small>
                {[
                  item.quem,
                  item.tipo === "status"
                    ? ""
                    : plural(
                        item.alteracoes,
                        "etapa alterada",
                        "etapas alteradas",
                      ),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVazio>Nenhuma alteração registrada.</EstadoVazio>
      )}
    </Bloco>
  );
}

// ── Cabeçalho ────────────────────────────────────────────────────────────

function Cabecalho({
  linha,
  nomeDaArea,
  cronograma,
  aoAtualizar,
}: {
  linha: LinhaDaVisaoGeral;
  nomeDaArea: string;
  cronograma: CronogramaLido | null;
  aoAtualizar: () => void;
}) {
  const status = statusCanonico(linha.status);
  const excepcional = situacaoExcepcional(
    cronograma?.monitoramento,
    linha.status,
  );
  const etapa =
    cronograma?.estado?.etapa ||
    linha.cronograma_atividade_atual ||
    linha.etapa ||
    "";
  const link = linkSeguro(linha.link_edital);
  return (
    <>
      <CabecalhoDaTela
        trilha={`${nomeDaArea} / Edital`}
        titulo={linha.edital || "Edital"}
        aoAtualizar={aoAtualizar}
        className="pagina-do-edital-cabecalho"
      >
        {link ? (
          <a
            className="btn contorno small"
            href={link}
            target="_blank"
            rel="noopener"
          >
            <i
              className="fa-solid fa-arrow-up-right-from-square"
              aria-hidden="true"
            />{" "}
            Edital publicado
          </a>
        ) : null}
      </CabecalhoDaTela>
      <dl className="pagina-do-edital-situacao">
        <div>
          <dt>Unidade</dt>
          <dd>{linha.unidade || "—"}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <Selo tom={tomDoStatus(status)}>{status}</Selo>
          </dd>
        </div>
        <div>
          <dt>Etapa atual</dt>
          <dd>{etapa || "—"}</dd>
        </div>
        <div>
          <dt>Período</dt>
          <dd>
            {dataCurta(linha.data_inicio) || "—"} a{" "}
            {dataCurta(linha.data_fim) || "—"}
          </dd>
        </div>
      </dl>
      {excepcional ? (
        <Aviso
          tom={excepcional.status === "Cancelado" ? "danger" : "warning"}
          papel="status"
          className="pagina-do-edital-excepcional"
        >
          <strong>Edital {excepcional.status.toLowerCase()}</strong>
          {excepcional.data ? ` desde ${dataCurta(excepcional.data)}` : ""}
          {excepcional.motivo ? `: ${excepcional.motivo}` : ""}
          {excepcional.retomada
            ? ` · Retomada prevista em ${dataCurta(excepcional.retomada)}`
            : ""}
        </Aviso>
      ) : null}
    </>
  );
}

function EscolhaDeEdital({
  linhas,
  todas,
}: {
  linhas: readonly LinhaDaVisaoGeral[];
  todas: readonly LinhaDaVisaoGeral[];
}) {
  return (
    <Bloco
      id="peEscolha"
      titulo={`Há ${fmt(linhas.length)} editais com este número`}
    >
      <ul className="pagina-do-edital-escolha">
        {linhas.map((linha) => (
          <li key={String(linha.id)}>
            <button
              type="button"
              className="btn contorno"
              onClick={() => abrirPaginaDoEdital(linha, todas)}
            >
              {linha.edital || "Edital"} · {linha.unidade || "sem unidade"}
            </button>
          </li>
        ))}
      </ul>
    </Bloco>
  );
}

// ── A página ─────────────────────────────────────────────────────────────

function CargaDoCronograma({
  carga,
  aoTentar,
  children,
}: {
  carga: Carga<CronogramaLido> | undefined;
  aoTentar: () => void;
  children: (dados: CronogramaLido) => ReactNode;
}) {
  if (!carga || carga.status === "carregando")
    return <BlocosEsqueleto quantos={3} />;
  if (carga.status === "erro")
    return (
      <ErroAoCarregar
        oQue="o cronograma"
        mensagem={carga.mensagem}
        aoTentar={aoTentar}
      />
    );
  return <>{children(carga.dados)}</>;
}

function Conteudo({
  estado,
  linha,
  area,
  nome,
  hoje,
  candidatosCarregando,
}: {
  estado: EstadoDaPaginaDoEdital;
  linha: LinhaDaVisaoGeral;
  area: string;
  nome: string;
  hoje: string;
  candidatosCarregando: boolean;
}) {
  const id = String(linha.id ?? "");
  const snapshot = useSyncExternalStore(estado.assinar, estado.obter);
  const [filtros, mudarFiltros] = usarFiltrosNaUrl(FILTROS_DA_PAGINA, {
    sessao: id,
  });
  const aba: AbaDaPagina = ehAbaDaPagina(filtros.aba) ? filtros.aba : "resumo";
  const escolher = (nova: string) => mudarFiltros({ aba: nova });
  const cronograma = snapshot.cronogramas[id];
  const dados = cronograma?.status === "pronto" ? cronograma.dados : null;
  const etapas = useMemo(
    () => etapasNaLinhaDoTempo(dados?.etapas, hoje),
    [dados, hoje],
  );
  const quadro = snapshot.quadros[id];
  const precisaDoQuadro =
    aba === "vagas" || aba === "fontes" || Number(linha.vagas_total) === 0;
  useEffect(() => {
    if (precisaDoQuadro) void estado.carregarQuadro(id);
  }, [precisaDoQuadro, id, estado, snapshot.quadros, snapshot.abertura]);
  const relerCronograma = () =>
    void estado.carregarCronograma(id, { forcar: true });

  return (
    <div className="pagina-do-edital" data-edital={id}>
      <Voltar />
      <Cabecalho
        linha={linha}
        nomeDaArea={nome}
        cronograma={dados}
        aoAtualizar={() => {
          relerCronograma();
          if (quadro) void estado.carregarQuadro(id, { forcar: true });
        }}
      />
      <Abas
        rotulo="Partes do edital"
        abas={ABAS_DA_PAGINA.map((item) => ({
          ...item,
          idDaAba: `peAba-${item.id}`,
          idDoPainel: `pePainel-${item.id}`,
        }))}
        ativa={aba}
        aoEscolher={escolher}
      />
      <div
        className="pagina-do-edital-painel"
        role="tabpanel"
        id={`pePainel-${aba}`}
        aria-labelledby={`peAba-${aba}`}
      >
        {aba === "resumo" ? (
          <>
            <div className="pagina-do-edital-grade">
              <Vagas linha={linha} quadro={quadro} />
              <Candidatos linha={linha} carregando={candidatosCarregando} />
            </div>
            <div className="pagina-do-edital-grade">
              <CargaDoCronograma carga={cronograma} aoTentar={relerCronograma}>
                {() => (
                  <Andamento
                    etapas={etapas}
                    aoVerEtapas={() => escolher("etapas")}
                  />
                )}
              </CargaDoCronograma>
              <AvisosDoEdital estado={estado} area={area} id={id} />
            </div>
          </>
        ) : null}
        {aba === "vagas" ? (
          <>
            <Vagas linha={linha} quadro={quadro} />
            <QuadroDeVagas
              carga={quadro}
              aoTentar={() => void estado.carregarQuadro(id, { forcar: true })}
            />
          </>
        ) : null}
        {aba === "etapas" ? (
          <CargaDoCronograma carga={cronograma} aoTentar={relerCronograma}>
            {(lido) => (
              <div className="pagina-do-edital-grade">
                <LinhaDoTempo dados={lido} etapas={etapas} />
                <Retificacoes dados={lido} />
              </div>
            )}
          </CargaDoCronograma>
        ) : null}
        {aba === "candidatos" ? (
          <>
            <Candidatos linha={linha} carregando={candidatosCarregando} />
            <TelasDaSelecao linha={linha} />
          </>
        ) : null}
        {aba === "fontes" ? (
          <div className="pagina-do-edital-grade">
            <Fontes linha={linha} cronograma={dados} quadro={quadro} />
            <CargaDoCronograma carga={cronograma} aoTentar={relerCronograma}>
              {(lido) => <Historico dados={lido} />}
            </CargaDoCronograma>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PaginaDoEdital({
  estado,
  agora = () => new Date(),
}: {
  estado: EstadoDaPaginaDoEdital;
  agora?: () => Date;
}) {
  const navegacao = usarEstadoDaNavegacao();
  const { area, nome, linhas, carregado, erro } = usarAreaAtual();
  const snapshot = useSyncExternalStore(estado.assinar, estado.obter);
  /* Escondida (outra tela aberta), a página guarda o último edital. */
  const ultimo = useRef("");
  if (navegacao.view === "edital" && navegacao.edital)
    ultimo.current = navegacao.edital;
  const pedido = ultimo.current;
  const hoje = hojeEmBrasilia(agora());

  const acompanhamento =
    snapshot.acompanhamento?.area === area &&
    snapshot.acompanhamento.linhas === linhas
      ? snapshot.acompanhamento.carga
      : null;
  const enriquecidas = useMemo(
    () =>
      enriquecerLinhas(linhasDaResposta(linhas), {
        hoje,
        acompanhamento:
          acompanhamento?.status === "pronto" ? acompanhamento.dados : null,
      }),
    [linhas, hoje, acompanhamento],
  );
  const achado = useMemo(
    () => editalDoEndereco(pedido, enriquecidas),
    [pedido, enriquecidas],
  );
  const linha = achado.tipo === "um" ? achado.linha : null;
  const id = linha ? String(linha.id ?? "") : "";

  const aberta = navegacao.view === "edital" && !navegacao.aviso;
  useEffect(() => {
    if (!aberta || !carregado) return;
    void estado.carregarAcompanhamento(
      area,
      linhas,
      linhas.map((item) => String(item.id ?? "")).filter(Boolean),
    );
  }, [
    aberta,
    carregado,
    area,
    linhas,
    estado,
    snapshot.acompanhamento,
    snapshot.abertura,
  ]);
  useEffect(() => {
    if (aberta && id) void estado.carregarCronograma(id);
  }, [aberta, id, estado, snapshot.cronogramas, snapshot.abertura]);

  let corpo: ReactNode;
  if (!carregado && !erro)
    corpo = (
      <div className="pagina-do-edital" aria-busy="true">
        <Voltar />
        <BlocosEsqueleto quantos={4} />
      </div>
    );
  else if (erro && !linhas.length)
    corpo = (
      <div className="pagina-do-edital">
        <Voltar />
        <ErroAoCarregar oQue="os editais" mensagem={erro} />
      </div>
    );
  else if (achado.tipo === "varios")
    corpo = (
      <div className="pagina-do-edital">
        <Voltar />
        <EscolhaDeEdital linhas={achado.linhas} todas={enriquecidas} />
      </div>
    );
  else if (!linha)
    corpo = (
      <div className="pagina-do-edital">
        <Voltar />
        <EstadoVazio>
          Edital {pedido.replace("-", "/")} não encontrado em{" "}
          {nome || "nesta área"}.
        </EstadoVazio>
      </div>
    );
  else
    corpo = (
      <Conteudo
        key={id}
        estado={estado}
        linha={linha}
        area={area}
        nome={nome}
        hoje={hoje}
        candidatosCarregando={
          !acompanhamento || acompanhamento.status === "carregando"
        }
      />
    );
  return <TelaNaUrl.Provider value="edital">{corpo}</TelaNaUrl.Provider>;
}

/** O cliente do app no que a página usa (o cronograma, o acompanhamento da Visão geral e os avisos). */
type ClienteDaPagina = ClienteDaPaginaDoEdital &
  ClienteDoAcompanhamento &
  ClienteDosAvisos;

export function criarPaginaDoEdital({
  supabase = getSupabaseClient(),
  agora,
}: {
  supabase?: ClienteDaPagina | null;
  agora?: () => Date;
} = {}) {
  const estado = criarEstadoDaPaginaDoEdital({
    supabase,
    buscarAcompanhamento: supabase
      ? buscarAcompanhamentoNoSupabase(supabase)
      : null,
    avisos: supabase ? criarEstadoDosAvisos({ supabase }) : null,
  });
  return {
    estado,
    nome: "a página do edital",
    conteudo: <PaginaDoEdital estado={estado} {...(agora ? { agora } : {})} />,
    /* Cada abertura relê o cronograma, o acompanhamento e o quadro. */
    render() {
      estado.renovar();
    },
  };
}
