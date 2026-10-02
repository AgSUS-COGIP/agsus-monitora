import { useEffect, useRef, useSyncExternalStore } from "react";
import { Campo, classes } from "../../ui/index.js";
import { TEXTO_DO_CONVITE } from "../../lib/solicitacao-de-acesso.js";
import { visaoDoPedido } from "./pedido-de-acesso.js";

/*
  O cartão "Solicitar acesso" / "Acesso desativado", dentro da tela de
  acesso. Lê o estado do pedido (pedido-de-acesso.js) e a sessão (e-mail,
  trocar de conta, voltar ao login). Ids e classes são os de antes
  (#accessRequestCard, .access-status…): o CSS e os testes de ponta a ponta
  continuam valendo.
*/

/** As coordenações ativas, agrupadas por área (como no select antigo). */
function OpcoesDeCoordenacao({ coordenacoes }) {
  const grupos = new Map();
  for (const c of coordenacoes) {
    if (!grupos.has(c.area))
      grupos.set(c.area, { rotulo: c.area_nome || c.area, itens: [] });
    grupos.get(c.area).itens.push(c);
  }
  return [...grupos.entries()].map(([area, grupo]) => (
    <optgroup key={area} label={grupo.rotulo}>
      {grupo.itens.map((c) => (
        <option key={c.codigo} value={c.codigo}>
          {c.nome}
        </option>
      ))}
    </optgroup>
  ));
}

function Situacao({ status, pedido }) {
  return (
    <div
      id="accessRequestStatus"
      className={classes("access-status", status.tom)}
      role="status"
      aria-live="polite"
    >
      {status.triste ? (
        <span
          id="accessRequestIlustracao"
          className="access-status-ilustracao"
          aria-hidden="true"
        >
          😢
        </span>
      ) : null}
      {status.titulo ? (
        <strong id="accessRequestStatusTitulo">{status.titulo}</strong>
      ) : null}
      <span id="accessRequestStatusTexto">{status.texto}</span>
      {status.entrar ? (
        <button
          id="accessRequestEnterBtn"
          type="button"
          className="btn green access-enter-btn"
          onClick={() => pedido.entrarAgora()}
        >
          <i className="fa-solid fa-arrow-right" aria-hidden="true" /> Entrar
          agora
        </button>
      ) : null}
      {status.oferecerReativacao ? (
        <div id="accessRequestReativar" className="access-reativar">
          <span>Precisa do acesso de novo?</span>
          <button
            id="accessRequestReativarBtn"
            type="button"
            className="btn secondary"
            onClick={() => pedido.abrirReativacao()}
          >
            <i className="fa-solid fa-rotate-left" aria-hidden="true" /> Pedir
            reativação
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CartaoDoPedido({ pedido, sessao }) {
  const estado = useSyncExternalStore(pedido.assinar, pedido.obter);
  const visao = visaoDoPedido(estado);
  const justificativa = useRef(null);
  const leitura = visao.formulario === "leitura";
  const { campos, erros } = estado;

  useEffect(() => {
    if (estado.focoNaJustificativa) justificativa.current?.focus();
  }, [estado.focoNaJustificativa]);

  const campo = (chave) => ({
    value: campos[chave],
    onChange: (evento) => pedido.atualizarCampo(chave, evento.target.value),
  });

  return (
    <div
      id="accessRequestCard"
      className="access-request-card"
      aria-busy={visao.verificando || undefined}
    >
      <div className="access-request-head compact">
        <div>
          <h2 id="accessRequestTitulo">{visao.titulo}</h2>
          {visao.textosDoPedido && !visao.verificando ? (
            <>
              <p className="access-request-subtitle">
                Sua conta Google entrou, mas ainda não tem acesso ao MONITORA.
                Envie o pedido e um administrador avalia.
              </p>
              <p className="access-request-invite">{TEXTO_DO_CONVITE}</p>
            </>
          ) : null}
        </div>
      </div>

      {visao.verificando ? (
        <div
          id="accessRequestCarregando"
          className="access-request-carregando"
          aria-hidden="true"
        >
          <span className="esqueleto" />
          <span className="esqueleto" />
        </div>
      ) : null}

      <div className="access-authenticated-user">
        <span>E-mail autenticado</span>
        <strong id="accessReqEmail">{estado.email || "-"}</strong>
      </div>

      {visao.status ? <Situacao status={visao.status} pedido={pedido} /> : null}

      {visao.formulario !== "oculto" ? (
        <form
          id="accessRequestForm"
          className="access-request-grid"
          noValidate
          onSubmit={(evento) => {
            evento.preventDefault();
            if (visao.mostrarBotao) void pedido.enviar();
          }}
        >
          <Campo rotulo="Nome" obrigatorio erro={erros.nome}>
            <input
              id="accessReqNome"
              type="text"
              autoComplete="name"
              maxLength={120}
              readOnly={leitura}
              {...campo("nome")}
            />
          </Campo>
          {visao.semSetor ? null : (
            <Campo
              rotulo="Área / setor"
              dica="Obrigatório se você não escolher a coordenação."
              erro={erros.setor}
            >
              <input
                id="accessReqSetor"
                type="text"
                maxLength={200}
                placeholder="Ex.: COGIP, DSEI Yanomami"
                readOnly={leitura}
                {...campo("setor")}
              />
            </Campo>
          )}
          <Campo rotulo="Coordenação" largo erro={erros.coordenacao}>
            <select
              id="accessReqCoordenacao"
              disabled={leitura}
              {...campo("coordenacao")}
            >
              <option value="">Não sei — o administrador define</option>
              <OpcoesDeCoordenacao coordenacoes={estado.coordenacoes} />
            </select>
          </Campo>
          <Campo
            rotulo="Justificativa"
            obrigatorio
            largo
            dica="Mínimo de 20 caracteres."
            erro={erros.justificativa}
          >
            <textarea
              id="accessReqJustificativa"
              ref={justificativa}
              rows={3}
              maxLength={2000}
              placeholder="Para que você vai usar o MONITORA?"
              readOnly={leitura}
              {...campo("justificativa")}
            />
          </Campo>
        </form>
      ) : null}

      {visao.mostrarBotao ? (
        <button
          id="accessRequestBtn"
          type="submit"
          form="accessRequestForm"
          className="btn green access-submit-btn"
          disabled={estado.enviando}
        >
          <i className="fa-solid fa-paper-plane" aria-hidden="true" />
          <span id="accessRequestBtnTexto">{visao.rotuloDoBotao}</span>
        </button>
      ) : null}

      <div className="access-account-actions">
        <button
          id="accessSwitchAccountBtn"
          type="button"
          className="google-login-btn"
          onClick={() => void sessao.entrarComGoogle()}
        >
          <span className="gmark">G</span>
          <span>Usar outra conta Google</span>
        </button>
        <button
          id="accessReturnLoginBtn"
          type="button"
          className="btn secondary"
          onClick={() => void sessao.limparSessao()}
        >
          <i
            className="fa-solid fa-arrow-right-from-bracket"
            aria-hidden="true"
          />{" "}
          Voltar ao login
        </button>
      </div>
    </div>
  );
}
