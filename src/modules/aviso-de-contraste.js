/*
  A prévia e o aviso de contraste que acompanham cada seletor de cor em
  Configurações.

  Antes havia só um `<input type="color">` cru: escolhia-se um tom, salvava-se, e
  só então se descobria se dava para ler. Agora o número aparece enquanto a
  pessoa mexe, com uma prévia do que a cor produz.

  Um componente para os dois campos — painel de acesso e barra lateral — para
  não existirem duas noções de contraste no mesmo formulário.
*/
import { avaliarCor } from "../lib/contraste.js";

const escapar = (valor) =>
  String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/*
  A prévia mostra o que a cor produz de fato: fundo na cor escolhida, texto no
  primeiro plano derivado, e o botão que a tela de acesso usa. Sem isso o aviso
  seria um número solto.
*/
export function htmlDaPrevia(avaliacao, { comBotao = true } = {}) {
  if (!avaliacao) return "";
  const { cor, corDoTexto } = avaliacao;
  const botao = comBotao
    ? `<span class="contraste-previa__botao">Entrar com Google institucional</span>`
    : "";
  return (
    `<div class="contraste-previa" style="background:${escapar(cor)};color:${escapar(corDoTexto)}">` +
    `<strong>Seja bem-vindo(a) à AgSUS</strong>${botao}` +
    `</div>`
  );
}

export function aplicarAviso(container, cor, opcoes = {}) {
  if (!container) return null;
  const avaliacao = avaliarCor(cor, opcoes.modo);

  if (!avaliacao) {
    container.innerHTML = "";
    container.hidden = true;
    return null;
  }

  container.hidden = false;
  container.innerHTML =
    htmlDaPrevia(avaliacao, opcoes) +
    `<p class="contraste-aviso" data-nivel="${avaliacao.passa ? "ok" : "alerta"}">` +
    `${escapar(avaliacao.mensagem)}</p>`;
  return avaliacao;
}

/*
  `input` e não `change`: o seletor nativo dispara `input` enquanto a pessoa
  arrasta, e é justamente aí que o número precisa acompanhar.
*/
export function ligarAvisoDeContraste(entrada, container, opcoes = {}) {
  if (!entrada || !container) return false;
  if (entrada.dataset.avisoDeContraste === "1") return true;
  entrada.dataset.avisoDeContraste = "1";

  /*
    Quando há seletor de modo, o aviso precisa reagir aos dois campos: trocar de
    "automático" para "sempre claro" muda o número sem a cor ter mudado.
  */
  const seletorDeModo = opcoes.seletorDeModo || null;
  const atualizar = () =>
    aplicarAviso(container, entrada.value, {
      ...opcoes,
      modo: seletorDeModo ? seletorDeModo.value : opcoes.modo,
    });

  entrada.addEventListener("input", atualizar);
  entrada.addEventListener("change", atualizar);
  seletorDeModo?.addEventListener("change", atualizar);
  atualizar();
  return true;
}

/*
  O campo do painel de acesso vive no HTML estático; o da barra lateral é
  injetado por `sidebar-branding.js`, que chama esta função depois de montar.
*/
export function instalarAvisoDoPainelDeAcesso(documento = globalThis.document) {
  const entrada = documento?.getElementById?.("cfgAccessPanelColor");
  if (!entrada) return false;

  let container = documento.getElementById("cfgAccessPanelColorAviso");
  if (!container) {
    container = documento.createElement("div");
    container.id = "cfgAccessPanelColorAviso";
    container.className = "contraste-bloco";
    /*
      No fim da linha do formulário, e não logo depois do `<input>`: o aviso
      descreve o resultado da cor **e** do modo, então precisa vir depois dos
      dois campos. Colado ao input, ele aparecia acima do seletor de modo e
      parecia falar só da cor.
    */
    (entrada.closest(".form-row") || entrada.parentElement).appendChild(
      container,
    );
  }
  return ligarAvisoDeContraste(entrada, container, {
    comBotao: true,
    seletorDeModo: documento.getElementById("cfgAccessTextoModo"),
  });
}
