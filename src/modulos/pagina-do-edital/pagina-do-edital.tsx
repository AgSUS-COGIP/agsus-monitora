import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  usarEstadoDaNavegacao,
  usarNavegacao,
} from "../../app/contexto-do-app.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { formatNumberBR } from "../../lib/base/formatters";
import {
  formatarDataHora,
  hojeEmBrasilia,
} from "../../lib/cronograma/cronograma-do-edital.ts";
import { telaDaRota } from "../../lib/navegacao/rotas.ts";
import {
  ROTULOS_DAS_MARCAS,
  contagemDasMarcas,
  editalDoEndereco,
  etapasNaLinhaDoTempo,
  retificacoesDoHistorico,
  situacaoDasVagas,
  situacaoDosCandidatos,
  situacaoExcepcional,
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
  Aviso,
  BlocosEsqueleto,
  CabecalhoDaTela,
  ErroAoCarregar,
  EstadoVazio,
  GradeDeKpis,
  Kpi,
  Selo,
} from "../../ui/index.ts";
import { buscarAcompanhamentoNoSupabase } from "../visao-geral/estado.ts";
import type { LinhaDaVisaoGeral } from "../visao-geral/tipos.ts";
import type { CronogramaLido } from "../editais/estado.ts";
import { abrirPaginaDoEdital } from "./abrir.ts";
import { criarEstadoDaPaginaDoEdital } from "./estado.ts";
import type { EstadoDaPaginaDoEdital } from "./estado.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import "./pagina-do-edital.css";

/*
  A página própria do edital (`/<área>/edital/<número-ano>`): cabeçalho com
  a situação, as vagas, os candidatos e a linha do tempo das etapas com as
  retificações. Só leitura. A rota é src/lib/navegacao/rotas.ts; o edital vem
  do endereço (fica nele: é a página) e o "Voltar" volta para onde a pessoa
  estava (src/app/navegacao.ts, `voltarDaPaginaDoEdital`).
*/

const fmt = (valor: unknown) => formatNumberBR(valor);

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

function Vagas({ linha }: { linha: LinhaDaVisaoGeral }) {
  const vagas = situacaoDasVagas(linha);
  return (
    <section className="pagina-do-edital-bloco" aria-labelledby="peVagas">
      <h3 id="peVagas">Situação das vagas</h3>
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
          rotulo="Contratações do cadastro reserva"
          valor={fmt(vagas.cadastroReserva)}
        />
      </GradeDeKpis>
      {(linha.textos_da_reabertura || []).map((texto) => (
        <p key={texto} className="pagina-do-edital-nota">
          {texto}
        </p>
      ))}
    </section>
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
    <section className="pagina-do-edital-bloco" aria-labelledby="peCandidatos">
      <h3 id="peCandidatos">Situação dos candidatos</h3>
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
              ? `${fmt(candidatos.desistentes)} desistente${candidatos.desistentes === 1 ? "" : "s"} à parte`
              : undefined
          }
          carregando={carregando}
        />
      </GradeDeKpis>
      {semLista ? (
        <p className="pagina-do-edital-nota">Sem lista de aprovados vigente.</p>
      ) : null}
    </section>
  );
}

function LinhaDoTempo({
  dados,
  hoje,
}: {
  dados: CronogramaLido;
  hoje: string;
}) {
  const etapas = useMemo(
    () => etapasNaLinhaDoTempo(dados.etapas, hoje),
    [dados.etapas, hoje],
  );
  const sequencia = useSequencia(dados.etapas);
  const contagem = contagemDasMarcas(etapas);
  return (
    <section className="pagina-do-edital-bloco" aria-labelledby="peLinha">
      <div className="pagina-do-edital-titulo-do-bloco">
        <h3 id="peLinha">Linha do tempo</h3>
        {etapas.length ? (
          <span>
            {contagem.concluida} concluída{contagem.concluida === 1 ? "" : "s"}{" "}
            · {contagem.prevista} prevista{contagem.prevista === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      {sequencia.length ? (
        <Aviso tom="warning" papel="status">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{" "}
          <span>{sequencia.join(" ")}</span>
        </Aviso>
      ) : null}
      {etapas.length ? (
        <ol className="pagina-do-edital-etapas">
          {etapas.map((etapa) => (
            <li
              key={etapa.chave}
              className="pagina-do-edital-etapa"
              data-marca={etapa.marca}
              aria-current={etapa.marca === "atual" ? "step" : undefined}
            >
              <span className="pagina-do-edital-ponto" aria-hidden="true" />
              <div>
                <strong>{etapa.atividade}</strong>
                <span className="pagina-do-edital-datas">
                  {dataCurta(etapa.inicio) || "Sem data"}
                  {etapa.fim && etapa.fim !== etapa.inicio
                    ? ` a ${dataCurta(etapa.fim)}`
                    : ""}
                </span>
                {etapa.observacao ? <small>{etapa.observacao}</small> : null}
              </div>
              <Selo
                tom={
                  etapa.marca === "concluida"
                    ? "aprovado"
                    : etapa.marca === "atual"
                      ? "revisar"
                      : "neutro"
                }
              >
                {ROTULOS_DAS_MARCAS[etapa.marca]}
              </Selo>
            </li>
          ))}
        </ol>
      ) : (
        <EstadoVazio>Nenhuma etapa cadastrada para este edital.</EstadoVazio>
      )}
    </section>
  );
}

function Retificacoes({ dados }: { dados: CronogramaLido }) {
  const { retificacoes, outrasAlteracoes } = retificacoesDoHistorico(
    dados.historico,
  );
  return (
    <section className="pagina-do-edital-bloco" aria-labelledby="peRetif">
      <div className="pagina-do-edital-titulo-do-bloco">
        <h3 id="peRetif">Retificações do cronograma</h3>
        {outrasAlteracoes ? (
          <span>
            {outrasAlteracoes} outra{outrasAlteracoes === 1 ? "" : "s"} alteraç
            {outrasAlteracoes === 1 ? "ão" : "ões"} no histórico
          </span>
        ) : null}
      </div>
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
                {item.alteracoes} etapa{item.alteracoes === 1 ? "" : "s"}{" "}
                alterada{item.alteracoes === 1 ? "" : "s"}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVazio>Nenhuma retificação lançada.</EstadoVazio>
      )}
    </section>
  );
}

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
    <section className="pagina-do-edital-bloco" aria-labelledby="peEscolha">
      <h3 id="peEscolha">Há {linhas.length} editais com este número</h3>
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
    </section>
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
  }, [aberta, carregado, area, linhas, estado, snapshot.acompanhamento]);
  useEffect(() => {
    if (aberta && id) void estado.carregarCronograma(id);
  }, [aberta, id, estado, snapshot.cronogramas]);

  if (!carregado && !erro)
    return (
      <div className="pagina-do-edital" aria-busy="true">
        <Voltar />
        <BlocosEsqueleto quantos={4} />
      </div>
    );
  if (erro && !linhas.length)
    return (
      <div className="pagina-do-edital">
        <Voltar />
        <ErroAoCarregar oQue="os editais" mensagem={erro} />
      </div>
    );
  if (achado.tipo === "varios")
    return (
      <div className="pagina-do-edital">
        <Voltar />
        <EscolhaDeEdital linhas={achado.linhas} todas={enriquecidas} />
      </div>
    );
  if (!linha)
    return (
      <div className="pagina-do-edital">
        <Voltar />
        <EstadoVazio>
          Edital {pedido.replace("-", "/")} não encontrado em{" "}
          {nome || "nesta área"}.
        </EstadoVazio>
      </div>
    );

  const cronograma = snapshot.cronogramas[id];
  return (
    <div className="pagina-do-edital" data-edital={id}>
      <Voltar />
      <Cabecalho
        linha={linha}
        nomeDaArea={nome}
        cronograma={cronograma?.status === "pronto" ? cronograma.dados : null}
        aoAtualizar={() => void estado.carregarCronograma(id, { forcar: true })}
      />
      <div className="pagina-do-edital-grade">
        <Vagas linha={linha} />
        <Candidatos
          linha={linha}
          carregando={!acompanhamento || acompanhamento.status === "carregando"}
        />
      </div>
      {!cronograma || cronograma.status === "carregando" ? (
        <BlocosEsqueleto quantos={3} />
      ) : cronograma.status === "erro" ? (
        <ErroAoCarregar
          oQue="o cronograma"
          mensagem={cronograma.mensagem}
          aoTentar={() => void estado.carregarCronograma(id, { forcar: true })}
        />
      ) : (
        <div className="pagina-do-edital-grade">
          <LinhaDoTempo dados={cronograma.dados} hoje={hoje} />
          <Retificacoes dados={cronograma.dados} />
        </div>
      )}
    </div>
  );
}

export function criarPaginaDoEdital({
  supabase = getSupabaseClient(),
  agora,
}: {
  supabase?: SupabaseClient | null;
  agora?: () => Date;
} = {}) {
  const estado = criarEstadoDaPaginaDoEdital({
    supabase,
    buscarAcompanhamento: supabase
      ? buscarAcompanhamentoNoSupabase(supabase)
      : null,
  });
  return {
    estado,
    nome: "a página do edital",
    conteudo: <PaginaDoEdital estado={estado} {...(agora ? { agora } : {})} />,
    /* Cada abertura relê o cronograma e o acompanhamento. */
    render() {
      estado.renovar();
    },
  };
}
