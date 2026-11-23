import { useEffect, useId, useMemo, useState } from "react";
import { getSupabaseClient } from "../../lib/sessao/supabaseClient";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import {
  alcanceDaSelecao,
  marcarPagina,
  textoDaConfirmacao,
} from "../../lib/base/alcance-da-selecao.ts";
import {
  ENCERRADOS_POR_PAGINA,
  NOME_DOS_EDITAIS,
  dataDoFim,
  erroDoMotivoDoLote,
  escolhidosDaLista,
  lerListaDosEncerrados,
  lerResultadoDoLote,
  rotuloDaEntrada,
  rotuloDoEdital,
  semOsQueSairam,
  textoDoResultado,
  type EditalEncerrado,
  type ListaDosEncerrados,
  type ResultadoDoLote,
} from "../../lib/editais/encerrados-do-cronograma.ts";
import {
  TRATAMENTOS,
  tituloDaConferencia,
} from "../../lib/conferencias/avisos-de-conferencia.ts";
import type { Tratamento } from "../conferencias/tipos.ts";
import {
  Aviso,
  BarraDeSelecao,
  Campo,
  FecharModal,
  Gaveta,
  Modal,
  Selo,
  usarAlteradoNoModal,
} from "../../ui/index.ts";
import "./encerrados-do-cronograma.css";

/*
  "Cronograma encerrado (N)" no topo de Editais (migration 20261119120000): os editais cujo
  cronograma terminou pelas datas com o status gravado ainda em andamento (o recorte da
  conferência EDITAL_CRONOGRAMA_ENCERRADO). Baixa sob demanda (lazy em nucleo.tsx): a tela de
  Editais está no pacote de entrada.

  A gaveta lista unidade, edital, fim do cronograma, status gravado e as outras pendências abertas
  do edital. Quem edita editais seleciona ("Selecionar esta página" separado de "Selecionar todos
  os N", a BarraDeSelecao) e marca como concluídos, com motivo; o banco recusa, com o motivo, o que
  não passar na regra. A outra saída, por edital, é dispensar o aviso da central com justificativa
  (`tratar_aviso_conferencia`, só o gestor do módulo). Nada aqui muda status sozinho.
*/

type Resposta = PromiseLike<{ data: unknown; error: unknown }>;
export type ClienteDosEncerrados = {
  rpc: {
    (nome: "listar_editais_com_cronograma_encerrado"): Resposta;
    (
      nome: "concluir_editais_com_cronograma_encerrado",
      argumentos: { p_editais: string[]; p_motivo: string },
    ): Resposta;
    (
      nome: "tratar_aviso_conferencia",
      argumentos: {
        p_id: string;
        p_tratamento: "DISPENSADO";
        p_motivo: string;
      },
    ): Resposta;
  };
};

async function chamar(promessa: Resposta) {
  const resposta = await promessa;
  if (resposta.error) throw resposta.error;
  return resposta.data;
}

const mensagem = (erro: unknown, reserva: string) => {
  const conteudo =
    erro && typeof erro === "object"
      ? (erro as { message?: unknown }).message
      : null;
  return typeof conteudo === "string" && conteudo ? conteudo : reserva;
};

const TOM_DA_GRAVIDADE: Record<string, string> = {
  CRITICA: "reprovado",
  ATENCAO: "pendente",
};

export interface PropriedadesDosEncerrados {
  supabase?: ClienteDosEncerrados | null;
  /** Muda a cada "Atualizar" da tela: relê a lista. */
  versao?: number;
  /** Depois de marcar: a tela relê os editais e o resumo. */
  aoConcluir?: () => void;
  toast?: (mensagem: string, tipo?: string) => void;
}

export function EncerradosDoCronograma({
  supabase = getSupabaseClient() as ClienteDosEncerrados | null,
  versao = 0,
  aoConcluir,
  toast,
}: PropriedadesDosEncerrados) {
  const { area } = usarAreaAtual();
  const [lida, setLida] = useState<ListaDosEncerrados | null>(null);
  const [aberta, setAberta] = useState(false);
  const tituloId = useId();

  useEffect(() => {
    if (!supabase) return;
    let vivo = true;
    chamar(supabase.rpc("listar_editais_com_cronograma_encerrado"))
      .then((dados) => {
        if (vivo) setLida(lerListaDosEncerrados(dados));
      })
      .catch(() => {
        // Banco sem a RPC ou sem acesso: a entrada não aparece.
        if (vivo) setLida(null);
      });
    return () => {
      vivo = false;
    };
  }, [supabase, versao]);

  const daArea = useMemo(
    () =>
      (lida?.editais ?? []).filter((e) => !area || !e.area || e.area === area),
    [lida, area],
  );

  if (!lida || (!daArea.length && !aberta)) return null;

  return (
    <>
      <button
        type="button"
        className="btn secondary editais-encerrados-entrada"
        data-acao="abrir-cronograma-encerrado"
        data-tour="editais-cronograma-encerrado"
        onClick={() => setAberta(true)}
      >
        <i className="fa-solid fa-calendar-check" aria-hidden="true" />
        {rotuloDaEntrada(daArea.length)}
      </button>
      {aberta ? (
        <Gaveta
          tituloId={tituloId}
          sobretitulo="Editais"
          titulo="Cronograma encerrado, status ainda em andamento"
          rotuloDoFechar="Fechar a lista"
          aoFechar={() => setAberta(false)}
          cartaoClassName="editais-encerrados-gaveta"
        >
          <ListaDosEncerrados
            editais={daArea}
            podeConcluir={lida.podeConcluir}
            supabase={supabase}
            aoMudar={(sairam) => {
              setLida((atual) =>
                atual
                  ? {
                      ...atual,
                      editais: semOsQueSairam(atual.editais, new Set(), sairam)
                        .editais,
                    }
                  : atual,
              );
            }}
            aoConcluir={aoConcluir}
            toast={toast}
          />
        </Gaveta>
      ) : null}
    </>
  );
}

function ListaDosEncerrados({
  editais,
  podeConcluir,
  supabase,
  aoMudar,
  aoConcluir,
  toast,
}: {
  editais: readonly EditalEncerrado[];
  podeConcluir: boolean;
  supabase: ClienteDosEncerrados | null;
  /** Saíram da lista (concluídos ou dispensados). */
  aoMudar: (sairam: string[]) => void;
  aoConcluir?: () => void;
  toast?: (mensagem: string, tipo?: string) => void;
}) {
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set());
  const [mostrados, setMostrados] = useState(ENCERRADOS_POR_PAGINA);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDoLote | null>(null);

  const recorte = useMemo(() => editais.map((e) => e.id), [editais]);
  const visiveis = useMemo(
    () => editais.slice(0, mostrados),
    [editais, mostrados],
  );
  const pagina = useMemo(() => visiveis.map((e) => e.id), [visiveis]);
  const alcance = alcanceDaSelecao(marcados, pagina, recorte);
  const escolhidos = escolhidosDaLista(editais, marcados);

  if (!editais.length && !resultado)
    return <p className="editais-encerrados-vazio">Nenhum edital na lista.</p>;

  return (
    <div className="editais-encerrados-corpo">
      {resultado?.recusados.length ? (
        <Aviso tom="warning">
          <div
            className="editais-encerrados-recusados"
            data-recusados-do-lote=""
          >
            <strong>
              {resultado.recusados.length === 1
                ? "1 edital não foi marcado:"
                : `${resultado.recusados.length} editais não foram marcados:`}
            </strong>
            <ul>
              {resultado.recusados.map((r) => (
                <li key={r.id}>
                  {r.edital ? `Edital ${r.edital}` : "Edital"}: {r.motivo}
                </li>
              ))}
            </ul>
          </div>
        </Aviso>
      ) : null}
      {podeConcluir && editais.length ? (
        <BarraDeSelecao
          rotulo="Seleção de editais"
          alcance={alcance}
          nome={NOME_DOS_EDITAIS}
          aoMarcarPagina={(sim) =>
            setMarcados((atual) => marcarPagina(atual, pagina, sim))
          }
          aoMarcarTodos={() => setMarcados(new Set(recorte))}
          aoLimpar={() => setMarcados(new Set())}
        >
          <button
            type="button"
            className="btn small"
            data-acao="marcar-como-concluidos"
            onClick={() => setConfirmando(true)}
          >
            Marcar como concluídos
          </button>
        </BarraDeSelecao>
      ) : null}
      <ul className="editais-encerrados-lista" aria-label="Editais">
        {visiveis.map((edital) => (
          <LinhaDoEncerrado
            key={edital.id}
            edital={edital}
            podeMarcar={podeConcluir}
            marcado={marcados.has(edital.id)}
            aoMarcar={(sim) =>
              setMarcados((atual) => {
                const novo = new Set(atual);
                if (sim) novo.add(edital.id);
                else novo.delete(edital.id);
                return novo;
              })
            }
            supabase={supabase}
            aoDispensar={() => {
              aoMudar([edital.id]);
              setMarcados(
                (atual) => semOsQueSairam([], atual, [edital.id]).marcados,
              );
              toast?.(`Aviso dispensado: ${rotuloDoEdital(edital)}.`);
            }}
          />
        ))}
      </ul>
      {editais.length > mostrados ? (
        <button
          type="button"
          className="btn ghost small editais-encerrados-mais"
          onClick={() => setMostrados((n) => n + ENCERRADOS_POR_PAGINA)}
        >
          Mostrar mais{" "}
          {Math.min(ENCERRADOS_POR_PAGINA, editais.length - mostrados)}
        </button>
      ) : null}
      {confirmando ? (
        <ConfirmacaoDoLote
          escolhidos={escolhidos}
          resumo={textoDaConfirmacao(
            alcance,
            escolhidos.length,
            NOME_DOS_EDITAIS,
          )}
          supabase={supabase}
          aoFechar={() => setConfirmando(false)}
          aoGravar={(feito) => {
            setConfirmando(false);
            setResultado(feito);
            const sairam = feito.concluidos.map((c) => c.id);
            aoMudar(sairam);
            setMarcados(
              (atual) =>
                semOsQueSairam([], atual, [
                  ...sairam,
                  ...feito.recusados.map((r) => r.id),
                ]).marcados,
            );
            toast?.(
              textoDoResultado(feito),
              feito.recusados.length ? "warning" : "success",
            );
            if (feito.concluidos.length) aoConcluir?.();
          }}
        />
      ) : null}
    </div>
  );
}

function LinhaDoEncerrado({
  edital,
  podeMarcar,
  marcado,
  aoMarcar,
  supabase,
  aoDispensar,
}: {
  edital: EditalEncerrado;
  podeMarcar: boolean;
  marcado: boolean;
  aoMarcar: (sim: boolean) => void;
  supabase: ClienteDosEncerrados | null;
  aoDispensar: () => void;
}) {
  const [dispensando, setDispensando] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [tentou, setTentou] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState("");
  const rotulo = rotuloDoEdital(edital);
  const fim = dataDoFim(edital.fim);
  const tratamento = edital.aviso?.tratamento as Tratamento | undefined;
  const erroDaJustificativa = erroDoMotivoDoLote(justificativa);
  usarAlteradoNoModal(dispensando && justificativa.trim() !== "");

  async function dispensar() {
    setTentou(true);
    setErro("");
    if (!supabase || !edital.aviso || erroDaJustificativa) return;
    setGravando(true);
    try {
      await chamar(
        supabase.rpc("tratar_aviso_conferencia", {
          p_id: edital.aviso.id,
          p_tratamento: "DISPENSADO",
          p_motivo: justificativa.trim(),
        }),
      );
      aoDispensar();
    } catch (falha) {
      setErro(mensagem(falha, "Não foi possível dispensar o aviso."));
      setGravando(false);
    }
  }

  return (
    <li className="editais-encerrados-item" data-edital-encerrado={edital.id}>
      <div className="editais-encerrados-linha">
        {podeMarcar ? (
          <input
            type="checkbox"
            aria-label={`Selecionar ${rotulo}`}
            checked={marcado}
            onChange={(ev) => aoMarcar(ev.target.checked)}
          />
        ) : null}
        <div className="editais-encerrados-texto">
          <strong>{rotulo}</strong>
          <span className="editais-encerrados-detalhe">
            {fim ? `Cronograma terminou em ${fim}` : "Cronograma terminou"}
          </span>
          <div className="editais-encerrados-selos">
            <Selo tom="revisar" titulo="Status gravado">
              {edital.status || "Sem status"}
            </Selo>
            {tratamento && tratamento !== "PENDENTE" ? (
              <Selo
                tom={TRATAMENTOS[tratamento]?.tom}
                titulo="Aviso na central"
              >
                {TRATAMENTOS[tratamento]?.rotulo ?? tratamento}
              </Selo>
            ) : null}
            {edital.pendencias.map((p) => (
              <Selo
                key={p.conferencia}
                tom={TOM_DA_GRAVIDADE[p.gravidade] ?? "neutro"}
                dados={{ pendencia: p.conferencia }}
              >
                {tituloDaConferencia(p.conferencia)}
                {p.quantidade > 1 ? ` (${p.quantidade})` : ""}
              </Selo>
            ))}
          </div>
        </div>
        {edital.aviso?.podeDispensar && !dispensando ? (
          <button
            type="button"
            className="btn ghost small"
            data-acao="dispensar-aviso"
            aria-label={`Dispensar o aviso do ${rotulo}`}
            onClick={() => setDispensando(true)}
          >
            Dispensar
          </button>
        ) : null}
      </div>
      {dispensando ? (
        <div className="editais-encerrados-dispensa">
          <Campo
            rotulo="Justificativa para manter o status"
            erro={
              tentou && erroDaJustificativa ? erroDaJustificativa : undefined
            }
            largo
          >
            <textarea
              rows={2}
              maxLength={500}
              data-foco-inicial=""
              value={justificativa}
              onChange={(ev) => {
                setJustificativa(ev.target.value);
                setErro("");
              }}
            />
          </Campo>
          <div className="ui-acoes">
            <button
              type="button"
              className="btn secondary small"
              disabled={gravando}
              onClick={() => {
                setDispensando(false);
                setTentou(false);
                setErro("");
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn small"
              data-acao="confirmar-dispensa"
              disabled={gravando}
              onClick={() => void dispensar()}
            >
              {gravando ? "Gravando…" : "Dispensar"}
            </button>
          </div>
          {erro ? (
            <Aviso tom="danger" papel="alert">
              {erro}
            </Aviso>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ConfirmacaoDoLote({
  escolhidos,
  resumo,
  supabase,
  aoFechar,
  aoGravar,
}: {
  escolhidos: readonly EditalEncerrado[];
  resumo: string;
  supabase: ClienteDosEncerrados | null;
  aoFechar: () => void;
  aoGravar: (resultado: ResultadoDoLote) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState("");
  const tituloId = useId();
  const erroDoMotivo = erroDoMotivoDoLote(motivo);

  async function gravar() {
    setTentou(true);
    setErro("");
    if (!supabase || erroDoMotivo || !escolhidos.length) return;
    setGravando(true);
    try {
      aoGravar(
        lerResultadoDoLote(
          await chamar(
            supabase.rpc("concluir_editais_com_cronograma_encerrado", {
              p_editais: escolhidos.map((e) => e.id),
              p_motivo: motivo.trim(),
            }),
          ),
        ),
      );
    } catch (falha) {
      setErro(mensagem(falha, "Não foi possível marcar os editais."));
      setGravando(false);
    }
  }

  return (
    <Modal
      rotuloId={tituloId}
      aoFechar={() => {
        if (!gravando) aoFechar();
      }}
      alterado={motivo.trim() !== ""}
      tamanho="medio"
      cartaoClassName="editais-encerrados-confirmacao"
    >
      <h2 id={tituloId}>Marcar como concluídos</h2>
      <p data-resumo-da-confirmacao="">{resumo}</p>
      <ul
        className="editais-encerrados-escolhidos"
        aria-label="Editais afetados"
      >
        {escolhidos.map((e) => (
          <li key={e.id}>
            {rotuloDoEdital(e)}
            <span>{e.status || "Sem status"} → Concluído</span>
          </li>
        ))}
      </ul>
      <Campo
        rotulo="Motivo"
        erro={tentou && erroDoMotivo ? erroDoMotivo : undefined}
        obrigatorio
        largo
      >
        <textarea
          rows={2}
          maxLength={500}
          data-foco-inicial=""
          placeholder="Ex.: conferido com a equipe em 19/11"
          value={motivo}
          onChange={(ev) => {
            setMotivo(ev.target.value);
            setErro("");
          }}
        />
      </Campo>
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}
      <div className="ui-acoes">
        <FecharModal className="btn secondary" disabled={gravando}>
          Cancelar
        </FecharModal>
        <button
          type="button"
          className="btn"
          data-acao="confirmar-conclusao"
          disabled={gravando || !escolhidos.length}
          onClick={() => void gravar()}
        >
          {gravando
            ? "Gravando…"
            : escolhidos.length === 1
              ? "Marcar 1 como concluído"
              : `Marcar ${escolhidos.length} como concluídos`}
        </button>
      </div>
    </Modal>
  );
}
