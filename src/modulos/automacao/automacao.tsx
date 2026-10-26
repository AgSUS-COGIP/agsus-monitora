import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { isAdminGlobal } from "../../lib/access-roles.ts";
import {
  MOTIVO_MAXIMO,
  avisoSemEfeito,
  motivoValido,
  proximaDaChave,
  semProxima,
  tarefasForaDaChave,
  ultimaExecucao,
  type ChaveDaAutomacao,
  type ChavesDaAutomacao,
} from "../../lib/chaves-da-automacao.ts";
import { dataHora } from "../../lib/saude-das-cargas.ts";
import { getSupabaseClient } from "../../lib/supabaseClient";
import {
  Aviso,
  BlocosEsqueleto,
  Campo,
  EstadoVazio,
  ErroAoCarregar,
  Selo,
} from "../../ui/index.ts";
import {
  criarEstadoDaAutomacao,
  type ClienteDaAutomacao,
  type DependenciasDaAutomacao,
  type EstadoDaAutomacao,
} from "./estado.ts";

/*
  Configurações › Automação (só administrador global): uma chave por aba liga
  ou desliga o que roda sozinho — as tarefas do pg_cron da chave e a agenda
  dos robôs. Cada linha mostra o estado, a última e a próxima execução e
  quem mudou, quando e por quê. Ligar ou desligar pede motivo; o banco grava
  o histórico (20261022190000_chaves_da_automacao.sql). O "Rodar agora" fica
  no Status das atualizações.
*/

const SITUACAO_DA_EXECUCAO: Readonly<Record<string, string>> = Object.freeze({
  succeeded: "concluída",
  failed: "falhou",
  running: "rodando",
  starting: "começando",
  CONCLUIDA: "concluída",
  FALHOU: "falhou",
  PARCIAL: "parcial",
  ACEITO: "pedido aceito",
  SEM_TOKEN: "sem chave",
});
const situacaoDaExecucao = (situacao: string) =>
  Object.hasOwn(SITUACAO_DA_EXECUCAO, situacao)
    ? SITUACAO_DA_EXECUCAO[situacao]
    : situacao.toLowerCase();

function FormularioDoMotivo({
  chave,
  estado,
  mudando,
  aoFechar,
}: {
  chave: ChaveDaAutomacao;
  estado: EstadoDaAutomacao;
  mudando: boolean;
  aoFechar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const ligar = !chave.ligada;
  const id = `automacaoMotivo-${chave.chave}`;

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    setTentou(true);
    if (!motivoValido(motivo)) return;
    void estado
      .alterar(chave.chave, ligar, motivo)
      .then((ok) => ok && aoFechar());
  }

  return (
    <form className="automacao-motivo" onSubmit={enviar} noValidate>
      <Campo
        rotulo={ligar ? "Motivo para ligar" : "Motivo para desligar"}
        erro={
          tentou && !motivoValido(motivo)
            ? "Informe o motivo (de 10 a 500 caracteres)."
            : undefined
        }
      >
        <input
          id={id}
          data-foco-inicial
          value={motivo}
          maxLength={MOTIVO_MAXIMO}
          onChange={(evento) => setMotivo(evento.target.value)}
        />
      </Campo>
      <div className="ui-acoes">
        <button type="button" className="btn ghost" onClick={aoFechar}>
          Cancelar
        </button>
        <button
          type="submit"
          className={ligar ? "btn primary" : "btn red"}
          disabled={mudando}
        >
          {ligar ? "Ligar" : "Desligar"}
        </button>
      </div>
    </form>
  );
}

function LinhaDaChave({
  chave,
  estado,
  mudando,
  ocupado,
  semEfeito,
}: {
  chave: ChaveDaAutomacao;
  estado: EstadoDaAutomacao;
  mudando: boolean;
  ocupado: boolean;
  semEfeito: string | null;
}) {
  const [aberta, setAberta] = useState(false);
  const ultima = ultimaExecucao(chave);
  const proxima = proximaDaChave(chave);
  const fora = tarefasForaDaChave(chave);
  return (
    <li
      className={`automacao-linha automacao-linha--${chave.ligada ? "ligada" : "desligada"}`}
      data-chave={chave.chave}
    >
      <div className="automacao-linha__topo">
        <strong className="automacao-linha__nome">{chave.nome}</strong>
        <Selo tom={chave.ligada ? "aprovado" : "neutro"}>
          {chave.ligada ? "Ligada" : "Desligada pelo administrador"}
        </Selo>
        {aberta ? null : (
          <button
            type="button"
            className={chave.ligada ? "btn secondary" : "btn primary"}
            disabled={ocupado}
            onClick={() => setAberta(true)}
          >
            {chave.ligada ? "Desligar" : "Ligar"}
          </button>
        )}
      </div>
      <dl className="automacao-linha__dados">
        <div>
          <dt>Última</dt>
          <dd>
            {ultima
              ? `${dataHora(ultima.inicio)}${ultima.situacao ? ` · ${situacaoDaExecucao(ultima.situacao)}` : ""}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Próxima</dt>
          <dd>{proxima ? dataHora(proxima) : semProxima(chave)}</dd>
        </div>
        <div>
          <dt>Mudou</dt>
          <dd>
            {[dataHora(chave.em), chave.por].filter(Boolean).join(" · ")}
            {chave.motivo ? <small>{chave.motivo}</small> : null}
          </dd>
        </div>
      </dl>
      {chave.tarefas.length ? (
        <small className="automacao-linha__tarefas">
          {chave.tarefas.map((t) => `${t.nome} (${t.agenda})`).join(" · ")}
        </small>
      ) : null}
      {semEfeito ? (
        <Aviso tom="warning" como="p">
          {semEfeito}
        </Aviso>
      ) : null}
      {fora.length ? (
        <Aviso tom="warning" como="p">
          {chave.ligada
            ? `Parada direto no banco: ${fora.map((t) => t.nome).join(", ")}.`
            : `Ligada direto no banco: ${fora.map((t) => t.nome).join(", ")}. A agenda dos robôs não pede enquanto a chave estiver desligada.`}
        </Aviso>
      ) : null}
      {aberta ? (
        <FormularioDoMotivo
          chave={chave}
          estado={estado}
          mudando={mudando}
          aoFechar={() => setAberta(false)}
        />
      ) : null}
    </li>
  );
}

function Historico({ dados }: { dados: ChavesDaAutomacao }) {
  const nomes = new Map(dados.chaves.map((c) => [c.chave, c.nome]));
  return (
    <section className="ui-card automacao-cartao">
      <h4>Histórico</h4>
      {dados.historico.length ? (
        <ul className="automacao-historico">
          {dados.historico.map((h, i) => (
            <li key={`${h.chave}-${h.em?.getTime() ?? i}-${i}`}>
              <div>
                <strong>{nomes.get(h.chave) || h.chave}</strong> ·{" "}
                {h.ligada ? "ligada" : "desligada"}
              </div>
              <small className="ui-texto-secundario">
                {[dataHora(h.em), h.por, h.motivo].filter(Boolean).join(" · ")}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <EstadoVazio>Nenhuma mudança registrada ainda.</EstadoVazio>
      )}
    </section>
  );
}

export function Automacao({ estado }: { estado: EstadoDaAutomacao }) {
  const atual = useSyncExternalStore(estado.assinar, estado.obter);

  useEffect(() => {
    document.dispatchEvent(new CustomEvent("agsus:content-updated"));
  });

  if (atual.perfil && !isAdminGlobal(atual.perfil))
    return (
      <p className="ui-vazio" role="status">
        Só o administrador global liga e desliga a automação.
      </p>
    );

  if (atual.status === "error" && !atual.dados)
    return (
      <ErroAoCarregar
        oQue="a automação"
        mensagem={
          atual.erro + (atual.erroCodigo ? ` (código ${atual.erroCodigo})` : "")
        }
        aoTentar={() => void estado.carregar()}
      />
    );

  const dados = atual.dados;
  if (!dados)
    return (
      <div className="automacao-tela" aria-busy="true">
        <BlocosEsqueleto quantos={3} className="automacao-esqueleto" />
      </div>
    );

  return (
    <div className="automacao-tela">
      {atual.aviso ? (
        <Aviso
          tom={atual.aviso.tom === "danger" ? "danger" : "info"}
          papel={atual.aviso.tom === "danger" ? "alert" : "status"}
        >
          {atual.aviso.texto}
        </Aviso>
      ) : null}
      {!dados.cronDisponivel ? (
        <Aviso tom="warning">
          O banco não deixou ler as tarefas agendadas.
        </Aviso>
      ) : null}
      <section className="ui-card automacao-cartao">
        <ul className="automacao-lista" aria-label="Automação de cada aba">
          {dados.chaves.map((chave) => (
            <LinhaDaChave
              key={chave.chave}
              chave={chave}
              estado={estado}
              mudando={atual.mudando === chave.chave}
              ocupado={atual.mudando !== null}
              semEfeito={avisoSemEfeito(dados, chave)}
            />
          ))}
        </ul>
      </section>
      {dados.semChave.length ? (
        <section className="ui-card automacao-cartao">
          <h4>Sempre ligadas</h4>
          <small className="automacao-linha__tarefas">
            {dados.semChave.map((t) => `${t.nome} (${t.agenda})`).join(" · ")}
          </small>
        </section>
      ) : null}
      <Historico dados={dados} />
    </div>
  );
}

/**
 * Monta a seção no `#automacaoApp` e devolve o controlador que
 * src/modulos/configuracoes/secoes.ts chama ao abrir a seção.
 */
export function montarAutomacao({
  raizDaTela = document.getElementById("automacaoApp"),
  supabase = getSupabaseClient() as ClienteDaAutomacao | null,
  getProfile,
  toast,
}: DependenciasDaAutomacao & { raizDaTela?: HTMLElement | null } = {}) {
  const estado = criarEstadoDaAutomacao({
    supabase,
    ...(getProfile ? { getProfile } : {}),
    ...(toast ? { toast } : {}),
  });
  const raiz = raizDaTela
    ? montarModulo(raizDaTela, <Automacao estado={estado} />, {
        nome: "Automação",
      }).raiz
    : null;
  return {
    estado,
    raiz,
    /* Ao abrir a seção: relê (a última execução muda a cada poucos minutos). */
    render: () => estado.carregar(),
    temAlteracoesPendentes: () => false,
    confirmarSaida: () => true,
  };
}
