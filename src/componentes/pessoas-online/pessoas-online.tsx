import { useEffect, useReducer, useSyncExternalStore } from "react";
import { montarModulo } from "../../app/montar-modulo.tsx";
import { situacaoDaPresenca } from "../../lib/online-presence";

/*
  "Pessoas online" no cabeçalho (moldura do app): o botão com a contagem e a
  lista de quem está com o MONITORA aberto, com o lugar de cada um. O estado é
  de src/app/presenca.ts; aqui só se desenha.

  Os ids (`#onlinePresence`, `#onlinePresenceBtn`,
  `#onlinePresenceList`…) são os de antes: o CSS e os testes de ponta a ponta
  continuam valendo.
*/

/** Uma pessoa da lista (`normalizeOnlinePresenceList`, src/lib/online-presence.ts). */
export interface PessoaOnline {
  userId: string;
  fullName: string;
  initials: string;
  avatarUrl: string | null;
  profileLabel: string;
  currentView: string;
}

/** O estado assinável de src/app/presenca.ts. */
export interface EstadoDaPresenca {
  visivel: boolean;
  aberto: boolean;
  sincronizado: boolean;
  /** Desde quando está sincronizando (ms). */
  desde: number;
  pessoas: readonly PessoaOnline[];
}

/** O que o componente usa do controlador de `criarPresenca`. */
export interface PresencaDoCabecalho {
  assinar: (ouvinte: () => void) => () => void;
  obter: () => EstadoDaPresenca;
  alternar: () => void;
  fechar: () => void;
}

function assinarConexao(avisar: () => void) {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
}
const conectado = () => globalThis.navigator?.onLine !== false;

function Avatar({ pessoa }: { pessoa: PessoaOnline }) {
  return (
    <span className="online-presence-avatar">
      {pessoa.avatarUrl ? (
        <img
          src={pessoa.avatarUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span aria-hidden="true">{pessoa.initials}</span>
      )}
      <i aria-hidden="true" />
    </span>
  );
}

function Pessoa({ pessoa }: { pessoa: PessoaOnline }) {
  return (
    <div className="online-presence-person">
      <Avatar pessoa={pessoa} />
      <span className="online-presence-texto">
        <strong title={pessoa.fullName}>{pessoa.fullName}</strong>
        <small>
          {pessoa.profileLabel}
          {pessoa.currentView ? ` · ${pessoa.currentView}` : ""}
        </small>
      </span>
    </div>
  );
}

export interface PropriedadesDePessoasOnline {
  presenca: PresencaDoCabecalho;
  /** Relógio (ms); os testes trocam. */
  agora?: () => number;
}

export function PessoasOnline({
  presenca,
  agora = () => Date.now(),
}: PropriedadesDePessoasOnline) {
  const estado = useSyncExternalStore(presenca.assinar, presenca.obter);
  const online = useSyncExternalStore(assinarConexao, conectado);
  const [, redesenhar] = useReducer((n: number) => n + 1, 0);
  const esperaMs = Math.max(0, agora() - estado.desde);
  const situacao = situacaoDaPresenca({
    sincronizado: estado.sincronizado,
    quantos: estado.pessoas.length,
    online,
    esperaMs,
  });

  // "Sincronizando" vira "Presença indisponível" se a espera passar do limite.
  useEffect(() => {
    if (situacao.estado !== "loading" || !estado.visivel) return undefined;
    const relogio = setTimeout(redesenhar, 1_000);
    return () => clearTimeout(relogio);
  });

  // Esc fecha a lista aberta.
  useEffect(() => {
    if (!estado.aberto) return undefined;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") presenca.fechar();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [estado.aberto, presenca]);

  const semPessoas =
    situacao.estado === "error" || situacao.estado === "offline"
      ? situacao.detalhe
      : estado.sincronizado
        ? "Ninguém mais com a plataforma aberta agora."
        : "Sincronizando presença…";

  return (
    <div
      id="onlinePresence"
      className={estado.visivel ? "online-presence" : "online-presence hidden"}
      data-presence-state={situacao.estado}
      aria-busy={situacao.estado === "loading" ? "true" : "false"}
    >
      <button
        id="onlinePresenceBtn"
        className="online-presence-button"
        type="button"
        onClick={() => presenca.alternar()}
        aria-expanded={estado.aberto ? "true" : "false"}
        aria-controls="onlinePresencePopover"
        aria-label={`${situacao.detalhe} Ver lista.`}
        title={situacao.detalhe}
      >
        <span
          id="onlinePresenceDot"
          className={
            estado.sincronizado
              ? "online-presence-dot is-online"
              : "online-presence-dot"
          }
        />
        <i className="fa-solid fa-user-group" aria-hidden="true" />
        <span id="onlinePresenceLabel" aria-live="polite">
          {situacao.rotulo}
        </span>
      </button>
      <div
        id="onlinePresencePopover"
        className="online-presence-popover"
        hidden={!estado.aberto}
      >
        <div className="online-presence-heading">
          <strong>Pessoas online</strong>
        </div>
        <div id="onlinePresenceList" className="online-presence-list">
          {estado.pessoas.length && situacao.estado === "ready" ? (
            estado.pessoas.map((pessoa) => (
              <Pessoa key={pessoa.userId} pessoa={pessoa} />
            ))
          ) : (
            <p>{semPessoas}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export interface OpcoesDePessoasOnline {
  elemento?: HTMLElement | null;
  presenca?: PresencaDoCabecalho | null;
}

/** Monta "Pessoas online" no cabeçalho (`#pessoasOnlineApp`). */
export function montarPessoasOnline({
  elemento = document.getElementById("pessoasOnlineApp"),
  presenca,
}: OpcoesDePessoasOnline = {}) {
  if (!elemento || !presenca) return null;
  return montarModulo(elemento, <PessoasOnline presenca={presenca} />, {
    nome: "Pessoas online",
  });
}
