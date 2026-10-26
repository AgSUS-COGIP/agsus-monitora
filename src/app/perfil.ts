import { permissaoLegada, roleLabel } from "../lib/access-roles.ts";
import { profileDisplayName } from "../lib/platform-context";
import type { PerfilDaPlataforma } from "../lib/platform-context";
import type {
  PerfilDeAcesso,
  PermissaoLegada,
} from "../lib/tipos-dos-acessos.ts";
import { sessaoDoApp } from "./sessao.ts";
import type { EstadoDaSessaoDoApp } from "./sessao.ts";

/*
  Quem entrou: o usuário e o perfil, copiados da sessão do app
  (src/app/sessao.ts) a cada mudança, e o que o app mostra deles (nome,
  e-mail e perfil no cabeçalho; `#appScreen` aberto ou escondido).

  As telas que ainda pedem o perfil por função recebem `obterPerfil`
  (`window.getMonitoraProfile`, publicado por src/app/sistema.ts); o React lê
  `sessaoDoApp.obter()`. O perfil é relido a cada chamada: as permissões mudam
  sem aviso (USER_UPDATED).
*/

/** O que o perfil lê do estado da sessão (src/app/sessao.ts). */
export type EstadoDaSessaoDoPerfil = Pick<
  EstadoDaSessaoDoApp,
  "usuario" | "perfil" | "painelIds"
>;
export type UsuarioDoPerfil = EstadoDaSessaoDoPerfil["usuario"];
/** O perfil do contexto (sem tipo no banco), lido na forma de `PerfilDeAcesso`. */
export type PerfilDoApp = PerfilDaPlataforma & PerfilDeAcesso;

/** A sessão que o perfil acompanha (`sessaoDoApp` ou uma falsa nos testes). */
export type SessaoDoPerfil = {
  obter(): EstadoDaSessaoDoPerfil;
  assinar(ouvinte: () => void): () => unknown;
};

export type OuvinteDoPerfil = (estado: EstadoDaSessaoDoPerfil) => void;

export type OpcoesDoPerfil = {
  sessao?: SessaoDoPerfil;
  documento?: Document;
};

export type Perfil = ReturnType<typeof criarPerfil>;

export function criarPerfil({
  sessao = sessaoDoApp,
  documento = globalThis.document,
}: OpcoesDoPerfil = {}) {
  let usuario: UsuarioDoPerfil = null;
  let perfil: PerfilDoApp | null = null;
  const ouvintes = new Set<OuvinteDoPerfil>();

  const $ = (id: string) => documento?.getElementById(id);
  const escrever = (id: string, texto: string | null | undefined) => {
    const el = $(id);
    if (el) el.textContent = texto || "";
  };

  /* A sessão mudou: copia o usuário; o perfil, só quando é outro objeto. */
  function receber() {
    const atual = sessao.obter();
    usuario = atual.usuario;
    if (atual.perfil === perfil) return;
    perfil = atual.perfil as PerfilDoApp | null;
    ouvintes.forEach((ouvinte) => ouvinte(atual));
  }

  /** Nome, e-mail e perfil de quem entrou, no topo e na barra. */
  function mostrarNaBarra() {
    const nome = profileDisplayName(perfil, usuario);
    escrever("userName", nome);
    escrever("topUserPopoverName", nome);
    escrever("userEmail", usuario?.email || perfil?.email || "-");
    const selo = $("userProfileBadge");
    if (selo && perfil?.perfil) {
      const rotulo = roleLabel(perfil);
      selo.textContent = rotulo;
      selo.style.display = "inline-block";
      escrever("topUserPopoverProfile", rotulo);
    }
  }

  /** Mostra o app (a tela de acesso é da entrada, que segue a fase da sessão). */
  function mostrarApp() {
    documento.body.classList.remove("access-request-mode");
    $("appScreen")?.classList.remove("hidden");
    const nome = profileDisplayName(perfil, usuario);
    escrever("userName", nome);
    escrever("topUserPopoverName", nome);
    escrever("userEmail", usuario?.email || "-");
  }

  function esconderApp() {
    $("appScreen")?.classList.add("hidden");
  }

  return {
    obterUsuario: () => usuario,
    obterPerfil: () => perfil,
    pode: (permissao: PermissaoLegada | (string & {})) =>
      permissaoLegada(perfil, permissao),
    /** `ouvinte(estadoDaSessao)` quando o perfil muda (os painéis liberados vêm junto). */
    aoMudarPerfil(ouvinte: OuvinteDoPerfil) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    /** Passa a seguir a sessão; devolve o cancelamento. */
    acompanharSessao() {
      receber();
      return sessao.assinar(receber);
    },
    mostrarNaBarra,
    mostrarApp,
    esconderApp,
  };
}
