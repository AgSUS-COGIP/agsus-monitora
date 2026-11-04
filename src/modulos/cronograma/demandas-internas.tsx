import { useEffect, useId, useMemo, useState } from "react";
import type { ClienteDoCalendario, EstadoDoCalendario } from "./tipos.ts";
import type {
  DemandaInterna,
  FormularioDaDemanda,
  PessoaDaDemanda,
} from "../../lib/demandas-internas.ts";
import {
  demandaAtrasada,
  formularioDaDemanda,
  lerDemanda,
  lerPessoas,
  payloadDaDemanda,
  periodoDaDemanda,
  problemaDoFormulario,
  situacaoDaDemanda,
} from "../../lib/demandas-internas.ts";
import { registroDoCalendario } from "../../lib/calendario-editais.ts";
import { formatarDataHora } from "../../lib/cronograma-do-edital.ts";
import { MultiSelectBusca } from "../../componentes/multi-select-busca.tsx";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { Aviso, Campo, Modal, classes } from "../../ui/index.ts";
import "./demandas-internas.css";

/*
  Demandas internas no Cronograma: o card com as da área, o detalhe (com os
  responsáveis), o formulário de criar/editar e a confirmação de excluir.
  As demandas chegam no carregamento do calendário (estado.ts) e aparecem
  nas vistas como o tipo "Demanda interna"; aqui ficam só as escritas. Quem
  pode o quê vem do banco: `pode_editar` por demanda e `podeCriar` (a área
  está em `pode_criar_em`). Quem só lê não vê os botões.
*/

type Resposta = { data: unknown; error: unknown };

async function chamar(promessa: PromiseLike<Resposta>) {
  const resposta = await promessa;
  if (resposta.error) throw resposta.error;
  return resposta.data;
}

function mensagemDoErro(erro: unknown, reserva: string) {
  const mensagem = registroDoCalendario(erro).message;
  return typeof mensagem === "string" && mensagem ? mensagem : reserva;
}

const dataHora = (valor: string) => (valor ? formatarDataHora(valor) : "");

export type PropriedadesDasDemandas = {
  estado: EstadoDoCalendario;
  supabase: ClienteDoCalendario | null;
  /** As demandas da área aberta. */
  demandas: readonly DemandaInterna[];
  area: string;
  podeCriar: boolean;
  hojeChave: string;
  /** Id da demanda com o detalhe aberto ("" = nenhuma). */
  aberta: string;
  aoAbrir: (id: string) => void;
};

export function DemandasDoCronograma({
  estado,
  supabase,
  demandas,
  area,
  podeCriar,
  hojeChave,
  aberta,
  aoAbrir,
}: PropriedadesDasDemandas) {
  const [editando, setEditando] = useState<DemandaInterna | "nova" | null>(
    null,
  );
  const [excluindo, setExcluindo] = useState<DemandaInterna | null>(null);
  const [verConcluidas, setVerConcluidas] = useState(false);
  const abertas = demandas.filter((demanda) => !demanda.concluida);
  const concluidas = demandas.filter((demanda) => demanda.concluida);
  const detalhe = demandas.find((demanda) => demanda.id === aberta) || null;

  // Sem demandas e sem poder criar: o card não tem o que mostrar.
  if (!demandas.length && !podeCriar && !editando) return null;

  return (
    <>
      <section
        className="ui-card ui-pilha demandas-card"
        data-tour="cronograma-demandas"
        aria-labelledby="demandasTitulo"
      >
        <div className="cal-cabecalho">
          <h2 className="ui-titulo" id="demandasTitulo">
            Demandas internas
          </h2>
          {podeCriar ? (
            <button
              id="demandaNova"
              type="button"
              className="btn small"
              onClick={() => setEditando("nova")}
            >
              <i className="fa-solid fa-plus" aria-hidden="true" /> Nova demanda
            </button>
          ) : null}
        </div>
        {abertas.length ? (
          <ListaDeDemandas
            demandas={abertas}
            hojeChave={hojeChave}
            aoAbrir={aoAbrir}
          />
        ) : (
          <p className="demandas-vazio">Nenhuma demanda em aberto.</p>
        )}
        {concluidas.length ? (
          <>
            <button
              id="demandasVerConcluidas"
              type="button"
              className="btn secondary small demandas-ver-concluidas"
              aria-expanded={verConcluidas}
              onClick={() => setVerConcluidas((atual) => !atual)}
            >
              {verConcluidas ? "Esconder concluídas" : "Concluídas"} (
              {concluidas.length})
            </button>
            {verConcluidas ? (
              <ListaDeDemandas
                demandas={concluidas}
                hojeChave={hojeChave}
                aoAbrir={aoAbrir}
              />
            ) : null}
          </>
        ) : null}
      </section>

      {detalhe && !editando && !excluindo ? (
        <DetalheDaDemanda
          demanda={detalhe}
          hojeChave={hojeChave}
          supabase={supabase}
          aoFechar={() => aoAbrir("")}
          aoEditar={() => setEditando(detalhe)}
          aoExcluir={() => setExcluindo(detalhe)}
          aoMudar={estado.guardarDemanda}
        />
      ) : null}

      {editando ? (
        <FormularioDeDemanda
          demanda={editando === "nova" ? null : editando}
          area={editando === "nova" ? area : editando.area}
          supabase={supabase}
          aoFechar={() => setEditando(null)}
          aoSalvar={(demanda) => {
            estado.guardarDemanda(demanda);
            setEditando(null);
            aoAbrir(demanda.id);
          }}
        />
      ) : null}

      {excluindo ? (
        <ConfirmarExclusao
          demanda={excluindo}
          supabase={supabase}
          aoFechar={() => setExcluindo(null)}
          aoExcluir={() => {
            estado.tirarDemanda(excluindo.id);
            setExcluindo(null);
            aoAbrir("");
          }}
        />
      ) : null}
    </>
  );
}

function ListaDeDemandas({
  demandas,
  hojeChave,
  aoAbrir,
}: {
  demandas: readonly DemandaInterna[];
  hojeChave: string;
  aoAbrir: (id: string) => void;
}) {
  return (
    <ul className="demandas-lista">
      {demandas.map((demanda) => {
        const atrasada = demandaAtrasada(demanda, hojeChave);
        return (
          <li key={demanda.id}>
            <button
              type="button"
              className={classes(
                "demandas-item",
                demanda.concluida && "concluida",
              )}
              data-cor="demanda"
              data-demanda={demanda.id}
              onClick={() => aoAbrir(demanda.id)}
            >
              <i className="demandas-ponto" aria-hidden="true" />
              <span className="demandas-titulo">{demanda.titulo}</span>
              <span className="demandas-meta">
                {periodoDaDemanda(demanda)}
                {demanda.edital ? ` · ${demanda.edital}` : ""}
              </span>
              {atrasada ? (
                <span className="demandas-atrasada">Atrasada</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DetalheDaDemanda({
  demanda,
  hojeChave,
  supabase,
  aoFechar,
  aoEditar,
  aoExcluir,
  aoMudar,
}: {
  demanda: DemandaInterna;
  hojeChave: string;
  supabase: ClienteDoCalendario | null;
  aoFechar: () => void;
  aoEditar: () => void;
  aoExcluir: () => void;
  aoMudar: (demanda: DemandaInterna) => void;
}) {
  const idDoTitulo = useId();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const situacao = situacaoDaDemanda(demanda, hojeChave);

  async function concluir(concluida: boolean) {
    if (!supabase) return;
    setOcupado(true);
    setErro("");
    try {
      const salva = lerDemanda(
        await chamar(
          supabase.rpc("concluir_demanda_interna", {
            p_id: demanda.id,
            p_concluida: concluida,
          }),
        ),
      );
      if (salva) aoMudar(salva);
    } catch (falha) {
      setErro(mensagemDoErro(falha, "Não foi possível salvar."));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Modal
      id="demandaDetalhe"
      tamanho="medio"
      rotuloId={idDoTitulo}
      aoFechar={aoFechar}
    >
      <h3 id={idDoTitulo}>{demanda.titulo}</h3>
      <dl className="demandas-detalhe">
        <dt>Período</dt>
        <dd>{periodoDaDemanda(demanda)}</dd>
        <dt>Situação</dt>
        <dd>
          <span
            className={classes(situacao === "Atrasada" && "demandas-atrasada")}
          >
            {situacao}
          </span>
          {demanda.concluida && (demanda.concluidaPor || demanda.concluidaEm)
            ? ` · ${[demanda.concluidaPor, dataHora(demanda.concluidaEm)]
                .filter(Boolean)
                .join(", ")}`
            : ""}
        </dd>
        {demanda.edital ? (
          <>
            <dt>Edital</dt>
            <dd>
              {[demanda.edital, demanda.unidade].filter(Boolean).join(" · ")}
            </dd>
          </>
        ) : null}
        <dt>Responsáveis</dt>
        <dd id="demandaResponsaveisDetalhe">
          {demanda.responsaveis.length
            ? demanda.responsaveis.map((pessoa) => pessoa.nome).join(", ")
            : "Sem responsáveis"}
        </dd>
        {demanda.descricao ? (
          <>
            <dt>Descrição</dt>
            <dd className="demandas-descricao">{demanda.descricao}</dd>
          </>
        ) : null}
        {demanda.criadaPor || demanda.criadaEm ? (
          <>
            <dt>Criada</dt>
            <dd>
              {[demanda.criadaPor, dataHora(demanda.criadaEm)]
                .filter(Boolean)
                .join(", ")}
            </dd>
          </>
        ) : null}
      </dl>
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}
      <div className="ui-acoes">
        {demanda.podeEditar ? (
          <>
            <button
              id="demandaExcluir"
              type="button"
              className="btn secondary"
              disabled={ocupado}
              onClick={aoExcluir}
            >
              Excluir
            </button>
            <button
              id="demandaEditar"
              type="button"
              className="btn secondary"
              disabled={ocupado}
              onClick={aoEditar}
            >
              Editar
            </button>
            <button
              id="demandaConcluir"
              type="button"
              className={classes("btn", !demanda.concluida && "green")}
              disabled={ocupado}
              onClick={() => void concluir(!demanda.concluida)}
            >
              {demanda.concluida ? "Reabrir" : "Concluir"}
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="btn secondary"
          data-foco-inicial
          onClick={aoFechar}
        >
          Fechar
        </button>
      </div>
    </Modal>
  );
}

function FormularioDeDemanda({
  demanda,
  area,
  supabase,
  aoFechar,
  aoSalvar,
}: {
  demanda: DemandaInterna | null;
  area: string;
  supabase: ClienteDoCalendario | null;
  aoFechar: () => void;
  aoSalvar: (demanda: DemandaInterna) => void;
}) {
  const idDoTitulo = useId();
  const [formulario, setFormulario] = useState<FormularioDaDemanda>(() =>
    formularioDaDemanda(demanda, area),
  );
  const [pessoas, setPessoas] = useState<PessoaDaDemanda[]>(
    () => demanda?.responsaveis || [],
  );
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { area: areaAberta, linhas } = usarAreaAtual();

  /* Os editais da área da demanda (a do menu, onde ela aparece). */
  const editais = useMemo(
    () =>
      formulario.area === areaAberta
        ? linhas
            .filter((linha) => linha.id !== undefined && linha.id !== null)
            .map((linha) => ({
              id: String(linha.id),
              rotulo:
                [linha.edital, linha.unidade].filter(Boolean).join(" · ") ||
                String(linha.id),
            }))
            .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"))
        : [],
    [formulario.area, areaAberta, linhas],
  );

  /* As opções de responsável: quem vê a área (e o edital, se escolhido). */
  const { area: areaDoFormulario, editalId } = formulario;
  useEffect(() => {
    if (!supabase || !areaDoFormulario) return;
    let vivo = true;
    chamar(
      supabase.rpc("listar_pessoas_da_area", {
        p_area: areaDoFormulario,
        p_edital: editalId || null,
      }),
    )
      .then((dados) => {
        if (vivo) setPessoas(lerPessoas(dados));
      })
      .catch(() => {
        // Sem a lista, ficam as opções que já havia (os responsáveis atuais).
      });
    return () => {
      vivo = false;
    };
  }, [supabase, areaDoFormulario, editalId]);

  const opcoes = useMemo(() => {
    const porId = new Map(pessoas.map((pessoa) => [pessoa.id, pessoa.nome]));
    for (const pessoa of demanda?.responsaveis || [])
      if (!porId.has(pessoa.id)) porId.set(pessoa.id, pessoa.nome);
    return [...porId].map(([value, label]) => ({ value, label }));
  }, [pessoas, demanda]);

  const mudar = <C extends keyof FormularioDaDemanda>(
    campo: C,
    valor: FormularioDaDemanda[C],
  ) => setFormulario((atual) => ({ ...atual, [campo]: valor }));

  async function salvar() {
    const problema = problemaDoFormulario(formulario);
    if (problema) {
      setErro(problema);
      return;
    }
    if (!supabase) return;
    setSalvando(true);
    setErro("");
    try {
      const salva = lerDemanda(
        await chamar(
          supabase.rpc("salvar_demanda_interna", {
            p_demanda: payloadDaDemanda(formulario),
          }),
        ),
      );
      if (!salva) throw new Error("O banco não devolveu a demanda salva.");
      aoSalvar(salva);
    } catch (falha) {
      setErro(mensagemDoErro(falha, "Não foi possível salvar a demanda."));
      setSalvando(false);
    }
  }

  return (
    <Modal
      id="demandaFormulario"
      tamanho="medio"
      rotuloId={idDoTitulo}
      fecharAoClicarFora={false}
      aoFechar={aoFechar}
    >
      <h3 id={idDoTitulo}>{demanda ? "Editar demanda" : "Nova demanda"}</h3>
      <div className="ui-grade-de-campos">
        <Campo rotulo="Título" obrigatorio largo>
          <input
            id="demandaTitulo"
            type="text"
            maxLength={200}
            autoComplete="off"
            data-foco-inicial
            value={formulario.titulo}
            onChange={(evento) => mudar("titulo", evento.target.value)}
          />
        </Campo>
        <Campo rotulo="Descrição" largo>
          <textarea
            id="demandaDescricao"
            maxLength={2000}
            value={formulario.descricao}
            onChange={(evento) => mudar("descricao", evento.target.value)}
          />
        </Campo>
        <label className="cal-caixa demandas-periodo">
          <input
            id="demandaPeriodo"
            type="checkbox"
            checked={formulario.periodo}
            onChange={(evento) => mudar("periodo", evento.target.checked)}
          />
          Período (início e fim)
        </label>
        <Campo rotulo={formulario.periodo ? "Início" : "Data"} obrigatorio>
          <input
            id="demandaInicio"
            type="date"
            value={formulario.dataInicio}
            onChange={(evento) => mudar("dataInicio", evento.target.value)}
          />
        </Campo>
        {formulario.periodo ? (
          <Campo rotulo="Fim" obrigatorio>
            <input
              id="demandaFim"
              type="date"
              min={formulario.dataInicio || undefined}
              value={formulario.dataFim}
              onChange={(evento) => mudar("dataFim", evento.target.value)}
            />
          </Campo>
        ) : null}
        <Campo rotulo="Edital">
          <select
            id="demandaEdital"
            value={formulario.editalId}
            onChange={(evento) => mudar("editalId", evento.target.value)}
          >
            <option value="">Sem edital</option>
            {formulario.editalId &&
            !editais.some((edital) => edital.id === formulario.editalId) ? (
              <option value={formulario.editalId}>
                {[demanda?.edital, demanda?.unidade]
                  .filter(Boolean)
                  .join(" · ") || "Edital atual"}
              </option>
            ) : null}
            {editais.map((edital) => (
              <option key={edital.id} value={edital.id}>
                {edital.rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Responsáveis" idDoControle="demandaResponsaveis" largo>
          <MultiSelectBusca
            id="demandaResponsaveis"
            opcoes={opcoes}
            selecionados={formulario.responsaveis}
            placeholder="Ninguém"
            aoMudar={(valores) => mudar("responsaveis", valores)}
          />
        </Campo>
      </div>
      {erro ? (
        <Aviso tom="danger" papel="alert">
          <span id="demandaErro">{erro}</span>
        </Aviso>
      ) : null}
      <div className="ui-acoes">
        <button type="button" className="btn secondary" onClick={aoFechar}>
          Cancelar
        </button>
        <button
          id="demandaSalvar"
          type="button"
          className="btn green"
          disabled={salvando}
          onClick={() => void salvar()}
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

function ConfirmarExclusao({
  demanda,
  supabase,
  aoFechar,
  aoExcluir,
}: {
  demanda: DemandaInterna;
  supabase: ClienteDoCalendario | null;
  aoFechar: () => void;
  aoExcluir: () => void;
}) {
  const idDoTitulo = useId();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function excluir() {
    if (!supabase) return;
    setOcupado(true);
    setErro("");
    try {
      await chamar(
        supabase.rpc("excluir_demanda_interna", { p_id: demanda.id }),
      );
      aoExcluir();
    } catch (falha) {
      setErro(mensagemDoErro(falha, "Não foi possível excluir."));
      setOcupado(false);
    }
  }

  return (
    <Modal
      id="demandaExcluirConfirmar"
      tamanho="pequeno"
      rotuloId={idDoTitulo}
      aoFechar={aoFechar}
    >
      <h3 id={idDoTitulo}>Excluir “{demanda.titulo}”?</h3>
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}
      <div className="ui-acoes">
        <button
          type="button"
          className="btn secondary"
          data-foco-inicial
          onClick={aoFechar}
        >
          Cancelar
        </button>
        <button
          id="demandaExcluirSim"
          type="button"
          className="btn red"
          disabled={ocupado}
          onClick={() => void excluir()}
        >
          Excluir
        </button>
      </div>
    </Modal>
  );
}
