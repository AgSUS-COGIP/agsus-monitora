import { useEffect, useState, useSyncExternalStore } from "react";
import { montarModulo } from "../montar-modulo.jsx";
import { classes } from "../../ui/index.js";
import {
  FASES,
  TEXTO_DO_BOTAO,
  TEXTO_DO_BOTAO_OCUPADO,
  sessaoDoApp,
} from "../sessao.js";
import { marcaDaEntrada } from "./marca.js";
import { CartaoDoPedido } from "./pedido-de-acesso.jsx";
import { criarPedidoDeAcesso } from "./pedido-de-acesso.js";

/*
  A tela de acesso do MONITORA: marca (logo, saudação, slogan), mensagens,
  o botão do Google e, para quem entrou sem perfil ativo, o pedido de acesso.
  Monta dentro do `#loginScreen` do index.html, que continua sendo do
  documento: o script do <head> pinta nele a arte e a cor guardadas antes do
  primeiro quadro, e `ligarEntradaAPagina` o mostra e esconde pela fase da
  sessão. Ids e classes são os de antes (o CSS da tela de acesso e os testes
  de ponta a ponta leem #loginScreen, #googleLoginBtn, #loginMsg…).
*/

export const SLOGAN = "Monitoramento de Processos Seletivos";

/** O logo some se a imagem falhar (e volta se o endereço mudar). */
function LogoDaInstituicao({ url }) {
  const [falhou, definirFalhou] = useState(false);
  useEffect(() => definirFalhou(false), [url]);
  return (
    <img
      id="loginLogo"
      src={url}
      alt=""
      hidden={falhou || undefined}
      onError={() => definirFalhou(true)}
    />
  );
}

function Rodape({ rodape }) {
  const papel = [rodape.funcao, rodape.versao].filter(Boolean).join(" · ");
  const visivel = [
    rodape.nome,
    rodape.funcao,
    rodape.versao,
    rodape.departamento,
    rodape.logoUrl,
  ].some(Boolean);
  if (!visivel) return null;
  return (
    <div className="login-cogip">
      {rodape.logoUrl ? (
        <img
          className="login-cogip-logo"
          id="loginCogipLogo"
          src={rodape.logoUrl}
          alt={rodape.nome}
        />
      ) : null}
      <div className="login-cogip-info">
        <div className="login-cogip-name" id="loginCogipName">
          {rodape.nome}
        </div>
        <div className="login-cogip-role" id="loginCogipRole">
          {papel}
        </div>
        <div className="login-cogip-dept" id="loginFoot">
          {rodape.departamento}
        </div>
      </div>
    </div>
  );
}

export function TelaDeEntrada({ sessao, marca, pedido }) {
  const estado = useSyncExternalStore(sessao.assinar, sessao.obter);
  const identidade = useSyncExternalStore(marca.assinar, marca.obter);
  const { configuracao, mensagem } = estado;
  const semAcesso = estado.fase === FASES.SEM_ACESSO;
  const textoDoBotao = estado.entrando
    ? TEXTO_DO_BOTAO_OCUPADO
    : configuracao.textoDoBotao || identidade.textoDoBotao || TEXTO_DO_BOTAO;

  return (
    <div className="login-outer">
      <div className="login-card">
        <div className="login-brand-lockup" aria-label="MONITORA">
          <div className="login-organization-mark">
            <LogoDaInstituicao url={identidade.logoUrl} />
            <strong>AgSUS</strong>
          </div>
          <span className="login-brand-divider" aria-hidden="true" />
          <div className="login-product-mark">
            <i className="fa-solid fa-chart-line" aria-hidden="true" />
            <strong id="loginTitle">MONITORA</strong>
          </div>
        </div>
        <p className="login-subtitle" id="loginSubtitle">
          {SLOGAN}
        </p>
        <h1 id="loginGreeting">{identidade.saudacao}</h1>
        {estado.erroDeConfiguracao ? (
          <div id="configMsg" className="alert error" role="alert">
            {estado.erroDeConfiguracao}
          </div>
        ) : null}
        <div
          id="loginMsg"
          className={classes(
            "alert",
            mensagem.tom,
            !mensagem.texto && "hidden",
          )}
          role="status"
          aria-live="polite"
        >
          {mensagem.texto}
        </div>
        <div className="login-form google-only-login">
          {configuracao.googleAtivo ? (
            <button
              id="googleLoginBtn"
              type="button"
              className="google-login-btn"
              disabled={estado.entrando}
              aria-busy={estado.entrando || undefined}
              onClick={() => void sessao.entrarComGoogle()}
            >
              <span className="gmark">G</span>
              <span id="googleLoginText">{textoDoBotao}</span>
            </button>
          ) : null}
          {semAcesso ? (
            <CartaoDoPedido pedido={pedido} sessao={sessao} />
          ) : null}
        </div>
        <Rodape rodape={identidade.rodape} />
      </div>
      <div className="login-stripe" aria-hidden="true" />
    </div>
  );
}

/**
 * O que a fase da sessão muda fora da tela: `#loginScreen` some com o
 * sistema aberto, o `body` ganha `access-request-mode` no pedido de acesso e
 * o pedido é carregado (ou limpo) ao entrar e sair dessa fase.
 * Devolve a função que desliga.
 */
export function ligarEntradaAPagina({
  sessao,
  pedido,
  documento = globalThis.document,
}) {
  let anterior = { fase: null, usuarioId: "" };
  const aplicar = () => {
    const { fase, usuario, consultarPedido } = sessao.obter();
    const usuarioId = usuario?.id || "";
    documento
      .getElementById("loginScreen")
      ?.classList.toggle("hidden", fase === FASES.CONECTADO);
    documento.body?.classList.toggle(
      "access-request-mode",
      fase === FASES.SEM_ACESSO,
    );
    if (
      fase === FASES.SEM_ACESSO &&
      (anterior.fase !== FASES.SEM_ACESSO || anterior.usuarioId !== usuarioId)
    )
      void pedido.carregar({ usuario, consultar: consultarPedido });
    else if (fase !== FASES.SEM_ACESSO && anterior.fase === FASES.SEM_ACESSO)
      pedido.limpar();
    anterior = { fase, usuarioId };
  };
  aplicar();
  return sessao.assinar(aplicar);
}

/**
 * Monta a tela de acesso no `#telaDeEntrada` (dentro do `#loginScreen`).
 * Desenha na hora (`flushSync`): o cartão vazio do index.html dá lugar ao
 * de verdade sem um quadro em branco no meio.
 */
export function montarEntrada({
  elemento = document.getElementById("telaDeEntrada"),
  sessao = sessaoDoApp,
  marca = marcaDaEntrada,
  pedido = criarPedidoDeAcesso(),
} = {}) {
  if (!elemento) return null;
  const desligar = ligarEntradaAPagina({ sessao, pedido });
  const { raiz, desmontar } = montarModulo(
    elemento,
    <TelaDeEntrada sessao={sessao} marca={marca} pedido={pedido} />,
    { nome: "a tela de acesso", flushSync: true },
  );
  return {
    raiz,
    pedido,
    desmontar: () => {
      desligar();
      desmontar();
    },
  };
}
