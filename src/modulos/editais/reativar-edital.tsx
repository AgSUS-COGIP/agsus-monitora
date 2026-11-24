import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { hojeEmBrasilia } from "../../lib/cronograma/cronograma-do-edital.ts";
import type { CronogramaNoBanco } from "../../lib/cronograma/cronograma-do-edital.ts";
import {
  ATIVIDADE_MAXIMA,
  ETAPA_PADRAO_DA_REATIVACAO,
  MOTIVO_MAXIMO,
  acaoDeReativarNaLinha,
  avisoDaValidadeNaReativacao,
  bloqueioDaReativacao,
  cronogramaDaReativacao,
  errosDaReativacao,
  semErros,
  textoDaReativacao,
} from "../../lib/editais/reativar-edital.ts";
import type {
  CronogramaDaReativacao,
  DadosDaReativacao,
  LinhaParaReativar,
} from "../../lib/editais/reativar-edital.ts";
import {
  Aviso,
  Campo,
  CarregandoConteudo,
  FecharModal,
  Modal,
} from "../../ui/index.ts";
import type { DadosParaReativarEdital } from "./estado.ts";

/*
  Reativar edital (o "⋯" da linha, no Histórico de Editais): o modal pede o
  motivo, a nova data de fim e o nome da etapa, e diz o que vai acontecer. A
  regra é `src/lib/editais/reativar-edital.ts`; a gravação,
  `estado.reativarEdital` (a mesma RPC do formulário do edital).

  Abre lendo o cronograma gravado: com status excepcional, cálculo manual ou
  sem cronograma, mostra o porquê e leva ao formulário. O cancelado nem lê:
  cancelamento é status excepcional, e o caminho é o formulário.
*/

/** O que o modal usa do estado da página (`estado.ts`). */
export interface EstadoDaReativacao {
  assinar(ouvinte: () => void): () => unknown;
  obter(): { salvando: boolean };
  lerCronograma(id: unknown): Promise<unknown>;
  reativarEdital(dados: DadosParaReativarEdital): Promise<boolean>;
  abrirEdital(id?: unknown): void;
  fecharModal(): unknown;
}

export interface PropriedadesDaReativacao {
  estado: EstadoDaReativacao;
  /** A linha do edital (a da tabela); `null` se sumiu da lista. */
  linha: LinhaParaReativar | null;
  /** A área do edital (`co_area` do payload). */
  area: string;
  agora?: () => Date;
  /** Depois de reativar: a tabela volta para Ativos. */
  aoReativar?: () => void;
}

type Carga =
  | { tipo: "carregando" }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "pronto"; cronograma: CronogramaDaReativacao };

const relogio = () => new Date();

/* O dia seguinte a hoje em Brasília: o mínimo do campo de data. */
function amanha(agora: Date): string {
  const [ano, mes, dia] = hojeEmBrasilia(agora).split("-").map(Number);
  const data = new Date(Date.UTC(ano!, mes! - 1, dia! + 1));
  return data.toISOString().slice(0, 10);
}

export function ReativarEdital({
  estado,
  linha,
  area,
  agora = relogio,
  aoReativar,
}: PropriedadesDaReativacao) {
  const idDoTitulo = useId();
  const salvando = useSyncExternalStore(
    estado.assinar,
    () => estado.obter().salvando,
  );
  const acao = acaoDeReativarNaLinha(linha);
  const [carga, setCarga] = useState<Carga>({ tipo: "carregando" });
  const [dados, setDados] = useState<DadosDaReativacao>({
    motivo: "",
    dataFim: "",
    atividade: ETAPA_PADRAO_DA_REATIVACAO,
  });
  const [tentou, setTentou] = useState(false);

  const id = linha?.id;
  useEffect(() => {
    if (acao !== "reativar") return undefined;
    let vivo = true;
    estado
      .lerCronograma(id)
      .then((lido) => {
        if (vivo)
          setCarga({
            tipo: "pronto",
            cronograma: cronogramaDaReativacao(lido as CronogramaNoBanco),
          });
      })
      .catch((erro: unknown) => {
        console.error("Erro ao carregar o cronograma para reativar:", erro);
        if (vivo)
          setCarga({
            tipo: "erro",
            mensagem: "Não foi possível ler o cronograma do edital.",
          });
      });
    return () => {
      vivo = false;
    };
  }, [estado, id, acao]);

  const fechar = () => estado.fecharModal();
  const nome = String(linha?.edital ?? "").trim() || "edital";
  const unidade = String(linha?.unidade ?? "").trim();
  const alterado =
    Boolean(dados.motivo.trim() || dados.dataFim) ||
    dados.atividade !== ETAPA_PADRAO_DA_REATIVACAO;

  const cabecalho = (
    <>
      <h3 id={idDoTitulo}>Reativar edital {nome}</h3>
      {unidade ? <p className="ui-texto-secundario">{unidade}</p> : null}
    </>
  );

  const irAoFormulario = (
    <div className="ui-acoes">
      <FecharModal className="btn secondary">Fechar</FecharModal>
      <button
        type="button"
        className="btn"
        data-acao="abrir-formulario"
        onClick={() => estado.abrirEdital(id)}
      >
        Abrir o formulário
      </button>
    </div>
  );

  if (!linha || !acao)
    return (
      <Modal
        id="reativarEdital"
        tamanho="pequeno"
        rotuloId={idDoTitulo}
        aoFechar={fechar}
      >
        {cabecalho}
        <Aviso tom="warning">Este edital não está no Histórico.</Aviso>
        <div className="ui-acoes">
          <FecharModal className="btn secondary">Fechar</FecharModal>
        </div>
      </Modal>
    );

  if (acao === "cancelado")
    return (
      <Modal
        id="reativarEdital"
        tamanho="pequeno"
        rotuloId={idDoTitulo}
        aoFechar={fechar}
      >
        {cabecalho}
        <Aviso tom="warning">
          Edital cancelado não se reativa por aqui. O cancelamento é um status
          excepcional: para reativar, tire o status excepcional no formulário do
          edital.
        </Aviso>
        {irAoFormulario}
      </Modal>
    );

  if (carga.tipo !== "pronto")
    return (
      <Modal
        id="reativarEdital"
        tamanho="pequeno"
        rotuloId={idDoTitulo}
        aoFechar={fechar}
      >
        {cabecalho}
        {carga.tipo === "carregando" ? (
          <CarregandoConteudo
            semMoldura
            rotulo={`Carregando o cronograma do ${nome}…`}
          />
        ) : (
          <Aviso tom="danger" papel="alert">
            {carga.mensagem}
          </Aviso>
        )}
        <div className="ui-acoes">
          <FecharModal className="btn secondary">Fechar</FecharModal>
        </div>
      </Modal>
    );

  const { cronograma } = carga;
  const bloqueio = bloqueioDaReativacao(cronograma, agora());
  if (bloqueio)
    return (
      <Modal
        id="reativarEdital"
        tamanho="pequeno"
        rotuloId={idDoTitulo}
        aoFechar={fechar}
      >
        {cabecalho}
        <Aviso tom="warning">{bloqueio.texto}</Aviso>
        {bloqueio.peloFormulario ? (
          irAoFormulario
        ) : (
          <div className="ui-acoes">
            <FecharModal className="btn secondary">Fechar</FecharModal>
          </div>
        )}
      </Modal>
    );

  const erros = errosDaReativacao(dados, cronograma.etapas, agora());
  const visiveis = tentou ? erros : {};
  const validade = avisoDaValidadeNaReativacao(cronograma, agora());
  const mudar = (campo: keyof DadosDaReativacao) => (valor: string) =>
    setDados((atual) => ({ ...atual, [campo]: valor }));

  async function reativar() {
    setTentou(true);
    if (!semErros(erros)) return;
    const reativou = await estado.reativarEdital({
      linha: linha!,
      area,
      ...dados,
      agora: agora(),
    });
    if (reativou) aoReativar?.();
  }

  return (
    <Modal
      id="reativarEdital"
      tamanho="medio"
      rotuloId={idDoTitulo}
      aoFechar={fechar}
      alterado={alterado}
    >
      {cabecalho}
      <div className="ui-grade-de-campos">
        <Campo rotulo="Motivo" obrigatorio largo erro={visiveis.motivo}>
          <textarea
            id="reativarMotivo"
            maxLength={MOTIVO_MAXIMO}
            data-foco-inicial
            value={dados.motivo}
            onChange={(evento) => mudar("motivo")(evento.target.value)}
          />
        </Campo>
        <Campo rotulo="Nova data de fim" obrigatorio erro={visiveis.dataFim}>
          <input
            id="reativarDataFim"
            type="date"
            min={amanha(agora())}
            value={dados.dataFim}
            onChange={(evento) => mudar("dataFim")(evento.target.value)}
          />
        </Campo>
        <Campo rotulo="Nome da etapa" obrigatorio erro={visiveis.atividade}>
          <input
            id="reativarEtapa"
            type="text"
            maxLength={ATIVIDADE_MAXIMA}
            autoComplete="off"
            value={dados.atividade}
            onChange={(evento) => mudar("atividade")(evento.target.value)}
          />
        </Campo>
      </div>
      <Aviso>{textoDaReativacao(dados, agora())}</Aviso>
      {validade ? <Aviso tom="warning">{validade}</Aviso> : null}
      <div className="ui-acoes">
        <FecharModal className="btn secondary" disabled={salvando}>
          Cancelar
        </FecharModal>
        <button
          type="button"
          className="btn green"
          data-acao="confirmar-reativacao"
          disabled={salvando}
          onClick={() => void reativar()}
        >
          Reativar edital
        </button>
      </div>
    </Modal>
  );
}
