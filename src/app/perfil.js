import { permissaoLegada, roleLabel } from "../lib/access-roles.js";
import { profileDisplayName } from "../lib/platform-context.js";
import { sessaoDoApp } from "./sessao.js";

/*
  Quem entrou: o usuário e o perfil, copiados da sessão do app
  (src/app/sessao.js) a cada mudança, e o que o app mostra deles (nome,
  e-mail e perfil no cabeçalho; `#appScreen` aberto ou escondido).

  As telas que ainda pedem o perfil por função recebem `obterPerfil`
  (`window.getMonitoraProfile`, publicado por src/app/sistema.js); o React lê
  `sessaoDoApp.obter()`. O perfil é relido a cada chamada: as permissões mudam
  sem aviso (USER_UPDATED).
*/
export function criarPerfil({
  sessao = sessaoDoApp,
  documento = globalThis.document,
} = {}) {
  let usuario = null;
  let perfil = null;
  const ouvintes = new Set();

  const $ = (id) => documento?.getElementById(id);
  const escrever = (id, texto) => {
    const el = $(id);
    if (el) el.textContent = texto || "";
  };

  /* A sessão mudou: copia o usuário; o perfil, só quando é outro objeto. */
  function receber() {
    const atual = sessao.obter();
    usuario = atual.usuario;
    if (atual.perfil === perfil) return;
    perfil = atual.perfil;
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
    pode: (permissao) => permissaoLegada(perfil, permissao),
    /** `ouvinte(estadoDaSessao)` quando o perfil muda (os painéis liberados vêm junto). */
    aoMudarPerfil(ouvinte) {
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
