import { useEffect, useState, useSyncExternalStore } from "react";
import { montarModulo } from "../montar-modulo.tsx";
import { classes } from "../../ui/index.ts";
import { ACCESS_INSTRUCTION } from "../../lib/access-branding.ts";
import {
  FASES,
  TEXTO_DO_BOTAO,
  TEXTO_DO_BOTAO_OCUPADO,
  sessaoDoApp,
} from "../sessao.ts";
import {
  IconeDeEscudo,
  IconeDoMonitora,
  MarcaDoGoogle,
} from "./icones-da-entrada.tsx";
import {
  atualizarMarcaUmaVez,
  marcaDaEntrada,
  type EstadoDaMarcaDaEntrada,
  type RodapeDaEntrada,
} from "./marca.ts";
import {
  criarPedidoDeAcesso,
  type PedidoDeAcesso,
} from "./pedido-de-acesso.ts";
import type { ModuloMontado } from "../montar-modulo.tsx";
import { PaginaDaSolicitacao } from "./solicitacao-de-acesso.tsx";

/*
  A tela de acesso do MONITORA: marca (logo, slogan, saudação), a linha de
  apoio, mensagens, o botão do Google e o rodapé institucional. Quem entrou
  sem perfil ativo vê, no lugar do cartão, a página "Solicitação de acesso"
  (solicitacao-de-acesso.tsx). Linguagem visual da tela do
  SIGAV (botão branco largo com o "G" colorido, divisória fina, escudo no
  rodapé), com a marca do MONITORA.

  Monta dentro do `#loginScreen` do index.html, que continua sendo do
  documento: o script do <head> pinta nele a arte e a cor guardadas antes do
  primeiro quadro, e `ligarEntradaAPagina` o mostra e esconde pela fase da
  sessão. Ids e classes são os de antes (o CSS da tela de acesso e os testes
  de ponta a ponta leem #loginScreen, #googleLoginBtn, #loginMsg…).

  SEM SALTO AO RECARREGAR. O cartão provisório do index.html tem a mesma
  estrutura e as mesmas medidas deste (tests/app/entrada.test.js compara as
  duas árvores), e nada aqui muda de tamanho quando a configuração chega:
  logo e ícones têm largura e altura fixas, o botão nunca sai do layout
  (Google desligado vira um espaço reservado do mesmo tamanho) e o conteúdo
  do botão só aparece, com fade, quando já se sabe o texto.
*/

export const SLOGAN = "Monitoramento de Processos Seletivos";
export const INSTITUICAO = "Agência Brasileira de Apoio à Gestão do SUS";

/** O valor de `FASES` (sessao.ts). */
type FaseDaSessao = (typeof FASES)[keyof typeof FASES];

/** O que a tela de entrada lê do estado da sessão. */
export type EstadoDaSessaoNaEntrada = {
  fase: FaseDaSessao;
  usuario: { id?: string; email?: string } | null;
  consultarPedido: boolean;
  entrando: boolean;
  erroDeConfiguracao: string;
  mensagem: { texto: string; tom: string };
  configuracao: { googleAtivo: boolean; textoDoBotao: string };
};

/** O que a tela de entrada usa da sessão (`sessaoDoApp`, de sessao.ts). */
export type SessaoDaEntrada = {
  obter: () => EstadoDaSessaoNaEntrada;
  assinar: (ouvinte: () => void) => () => unknown;
  entrarComGoogle: () => unknown;
  tentarDeNovo: () => unknown;
  limparSessao: () => unknown;
};

/** As props de `TelaDeEntrada`. */
export type PropsDaTelaDeEntrada = {
  sessao: SessaoDaEntrada;
  marca: EstadoDaMarcaDaEntrada;
  pedido: PedidoDeAcesso;
};

/** As opções de `ligarEntradaAPagina`. */
export type OpcoesDaLigacaoDaEntrada = {
  sessao: SessaoDaEntrada;
  pedido: PedidoDeAcesso;
  documento?: Document;
  /** A marca pública da tela de acesso (src/app/entrada/marca.ts). */
  atualizarMarca?: () => unknown;
};

/** As opções de `montarEntrada` (todas com padrão). */
export type OpcoesDaEntrada = {
  elemento?: HTMLElement | null;
  sessao?: SessaoDaEntrada;
  marca?: EstadoDaMarcaDaEntrada;
  pedido?: PedidoDeAcesso;
};

/** O que `montarEntrada` devolve quando há onde montar. */
export type EntradaMontada = ModuloMontado & { pedido: PedidoDeAcesso };

/**
 * O logo fica invisível se a imagem falhar (e volta se o endereço mudar),
 * sem sair do lugar: o lockup não muda de tamanho.
 */
function LogoDaInstituicao({ url }: { url: string }) {
  const [falhou, definirFalhou] = useState(false);
  useEffect(() => definirFalhou(false), [url]);
  return (
    <img
      id="loginLogo"
      src={url}
      alt=""
      width="52"
      height="52"
      data-falhou={falhou || undefined}
      onError={() => definirFalhou(true)}
    />
  );
}

function Rodape({ rodape }: { rodape: Readonly<RodapeDaEntrada> }) {
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

export function TelaDeEntrada({ sessao, marca, pedido }: PropsDaTelaDeEntrada) {
  const estado = useSyncExternalStore(sessao.assinar, sessao.obter);
  const identidade = useSyncExternalStore(marca.assinar, marca.obter);
  const { configuracao, mensagem } = estado;
  const semAcesso = estado.fase === FASES.SEM_ACESSO;
  const falhou = estado.fase === FASES.FALHA_NA_ENTRADA;
  const textoDoBotao = estado.entrando
    ? TEXTO_DO_BOTAO_OCUPADO
    : configuracao.textoDoBotao || identidade.textoDoBotao || TEXTO_DO_BOTAO;
  const textoConhecido =
    identidade.resolvida ||
    Boolean(configuracao.textoDoBotao) ||
    estado.entrando;

  if (semAcesso)
    return (
      <PaginaDaSolicitacao
        pedido={pedido}
        sessao={sessao}
        logoUrl={identidade.logoUrl}
        slogan={SLOGAN}
        instituicao={INSTITUICAO}
      />
    );

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
            <IconeDoMonitora />
            <strong id="loginTitle">MONITORA</strong>
          </div>
        </div>
        <p className="login-subtitle" id="loginSubtitle">
          {SLOGAN}
        </p>
        <h1 id="loginGreeting">{identidade.saudacao}</h1>
        <p className="login-apoio" id="loginApoio">
          {ACCESS_INSTRUCTION}
        </p>
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
          {falhou ? (
            /* O perfil não pôde ser lido: tenta de novo com a mesma sessão. */
            <button
              id="tentarDeNovoBtn"
              type="button"
              className="google-login-btn"
              data-texto="pronto"
              onClick={() => void sessao.tentarDeNovo()}
            >
              <span>Tentar de novo</span>
            </button>
          ) : null}
          {configuracao.googleAtivo ? (
            <button
              id="googleLoginBtn"
              type="button"
              className="google-login-btn"
              data-texto={textoConhecido ? "pronto" : "pendente"}
              disabled={estado.entrando}
              aria-busy={estado.entrando || undefined}
              onClick={() => void sessao.entrarComGoogle()}
            >
              <MarcaDoGoogle />
              <span id="googleLoginText">{textoDoBotao}</span>
            </button>
          ) : (
            /* Google desligado: o lugar do botão fica, vazio (sem salto). */
            <div
              className="google-login-btn google-login-btn--reservado"
              aria-hidden="true"
            />
          )}
        </div>
        <p className="login-instituicao" id="loginInstituicao">
          <IconeDeEscudo />
          <span>{INSTITUICAO}</span>
        </p>
        <Rodape rodape={identidade.rodape} />
      </div>
      <div className="login-stripe" aria-hidden="true" />
    </div>
  );
}

/* As fases em que a tela de acesso fica à vista. */
const FASES_COM_A_TELA_DE_ACESSO: ReadonlySet<FaseDaSessao> = new Set([
  FASES.DESLOGADO,
  FASES.SEM_ACESSO,
  FASES.FALHA_NA_ENTRADA,
]);

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
  atualizarMarca = atualizarMarcaUmaVez,
}: OpcoesDaLigacaoDaEntrada): () => unknown {
  let anterior: { fase: FaseDaSessao | null; usuarioId: string } = {
    fase: null,
    usuarioId: "",
  };
  const aplicar = () => {
    const { fase, usuario, consultarPedido } = sessao.obter();
    const usuarioId = usuario?.id || "";
    // A tela de acesso vai aparecer: a marca atual (uma vez por página).
    if (FASES_COM_A_TELA_DE_ACESSO.has(fase)) void atualizarMarca();
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
}: OpcoesDaEntrada = {}): EntradaMontada | null {
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
