import { useState } from "react";
import {
  acoesDoParecer,
  aguardandoParecer,
  erroDoTextoDoParecer,
  LIMITES_DO_PARECER,
} from "../../lib/parecer-do-recurso.js";
import { Aviso, Kv, Secao } from "../../ui/index.js";
import { dataHora } from "./partes.jsx";
import { SeloDaSituacao } from "./tabela.jsx";

/*
  "Parecer jurídico", na gaveta do recurso: a situação no fluxo, quem enviou
  para parecer, a devolução (com o que pedir para ajustar), a decisão (quem,
  quando e o texto do parecer) e os botões — só os que a pessoa pode usar
  (parecer-do-recurso.js). Quem edita envia; quem tem o parecer jurídico
  defere, defere parcialmente, indefere, devolve ou reabre. Os demais veem
  "Aguardando parecer jurídico". O banco decide
  (transicionar_recurso_candidato); tudo é texto, nunca HTML.
*/

const ROTULO_DO_TEXTO = {
  parecer: "Parecer jurídico",
  obrigatorio: "Motivo",
  opcional: "Observação para o jurídico (opcional)",
};

const quemQuando = (em, por) => [dataHora(em), por].filter(Boolean).join(" · ");

function ConfirmarParecer({ escolhida, emCurso, aoConfirmar, aoCancelar }) {
  const [texto, setTexto] = useState("");
  const erro = erroDoTextoDoParecer(escolhida.acao, texto);
  const rotulo =
    escolhida.acao === "devolver"
      ? "O que precisa ser ajustado"
      : ROTULO_DO_TEXTO[escolhida.texto];
  const perigo = ["indeferir", "devolver", "reabrir"].includes(escolhida.acao);
  return (
    <form
      className="recursos-bloco recursos-confirmacao"
      data-parecer={escolhida.acao}
      onSubmit={(evento) => {
        evento.preventDefault();
        if (!erro) aoConfirmar(texto.trim());
      }}
    >
      <div className="ui-campo">
        <label htmlFor="recursosTextoDoParecer">{rotulo}</label>
        <textarea
          id="recursosTextoDoParecer"
          name="texto"
          rows={escolhida.texto === "parecer" ? 6 : 3}
          maxLength={LIMITES_DO_PARECER[escolhida.texto].maximo}
          value={texto}
          data-foco-inicial
          onChange={(evento) => setTexto(evento.target.value)}
        />
      </div>
      <div className="ui-acoes">
        <button
          type="button"
          className="btn secondary small"
          onClick={aoCancelar}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className={`btn small${perigo ? " danger" : ""}`}
          disabled={Boolean(erro) || emCurso}
        >
          {emCurso ? "Salvando…" : escolhida.rotulo}
        </button>
      </div>
    </form>
  );
}

export function SecaoDoParecer({
  estado,
  recurso: r,
  detalhe,
  podeEditar,
  podeDecidir,
  acao,
}) {
  const [escolhida, setEscolhida] = useState(null);
  const respostaEnviada =
    Boolean(r.etapas?.resposta_candidato) ||
    detalhe?.resposta?.estado === "enviada";
  const acoes = acoesDoParecer({
    situacao: r.situacao,
    podeEditar,
    podeDecidir,
    respostaEnviada,
  });
  const esperando = aguardandoParecer(r.situacao, podeDecidir);

  return (
    <Secao icone="fa-scale-balanced" titulo="Parecer jurídico" secao="parecer">
      <div className="recursos-parecer" data-tour="recursos-parecer">
        <div className="ui-kv-grade">
          <Kv rotulo="Situação">
            <SeloDaSituacao situacao={r.situacao} />
          </Kv>
          {r.parecer_enviado_em ? (
            <Kv rotulo="Enviado para parecer">
              {quemQuando(r.parecer_enviado_em, detalhe?.parecer_enviado_por)}
            </Kv>
          ) : null}
          {r.decidido && r.decisao_em ? (
            <Kv rotulo="Decidido">
              {quemQuando(r.decisao_em, detalhe?.decisao_por)}
            </Kv>
          ) : null}
        </div>

        {r.devolvido && detalhe?.comentario_devolucao ? (
          <Aviso como="p" className="recursos-aviso" tom="danger">
            <strong>Devolvido para ajuste: </strong>
            {detalhe.comentario_devolucao}{" "}
            <small>{quemQuando(r.devolvido_em, detalhe.devolvido_por)}</small>
          </Aviso>
        ) : null}

        {r.decidido && detalhe?.parecer ? (
          <div className="recursos-texto-final" aria-label="Texto do parecer">
            {detalhe.parecer}
          </div>
        ) : null}

        {esperando ? (
          <p className="recursos-aguardando" data-aguardando-parecer="">
            <i className="fa-solid fa-clock" aria-hidden="true" /> Aguardando
            parecer jurídico
          </p>
        ) : null}

        {escolhida ? (
          <ConfirmarParecer
            escolhida={escolhida}
            emCurso={acao?.tipo === `parecer:${escolhida.acao}`}
            aoCancelar={() => setEscolhida(null)}
            aoConfirmar={async (texto) => {
              const ok = await estado.transicionarRecurso(
                r,
                escolhida.acao,
                texto,
              );
              if (ok) setEscolhida(null);
            }}
          />
        ) : acoes.length ? (
          <div className="ui-acoes recursos-acoes-do-parecer">
            {acoes.map((a) => (
              <button
                key={a.acao}
                type="button"
                className={`btn small${["devolver", "reabrir"].includes(a.acao) ? " secondary" : ""}`}
                data-acao-parecer={a.acao}
                disabled={!a.permitida || Boolean(acao)}
                title={a.permitida ? a.rotulo : a.motivo}
                onClick={() => setEscolhida(a)}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Secao>
  );
}
