import { useState } from "react";
import type { PendenciaDoSalvar } from "../../../lib/avaliacao-documental/pendencias-do-salvar.ts";
import { Aviso } from "../../../ui/index.js";

/*
  O cartão no topo do passo 5 do assistente: diz em que pé está a regra e o
  que acontece agora, para o passo 5 nunca parecer travado.
  - "sem-mudancas": nada mudou — a versão vigente continua valendo; concluir
    sem mudanças, fechar ou voltar ao passo 2;
  - "concluido": concluiu sem mudanças (o passo 5 ganhou o ✓);
  - "pronto": mudou — "Pronto para salvar como Versão N" e o que falta;
  - "salvo": a versão nova foi salva; com a dupla conferência, "Marcar como
    conferida" ali mesmo (quem salvou não confere; o administrador global
    pode) ou o porquê de não poder.
*/

export type ModoDoPasso5 = "sem-mudancas" | "concluido" | "pronto" | "salvo";

type Props = {
  modo: ModoDoPasso5;
  /** "Versão 1" ou o nome da versão vigente (depois de salvar, a nova). */
  rotuloDaVigente: string;
  conferida: boolean;
  versaoNova: number;
  /** As pendências que impedem salvar (modo "pronto"). */
  faltam: PendenciaDoSalvar[];
  aoIrPara: (p: PendenciaDoSalvar) => void;
  aoConcluir: () => void;
  aoFechar: () => void;
  aoVoltarAoPasso2: () => void;
  /** Modo "salvo": quem salvou não confere (dupla conferência). */
  confereOutraPessoa: boolean;
  aoConferir: () => Promise<{ ok: boolean; erro?: string }>;
  salvando: boolean;
};

export function EstadoDoPasso5({
  modo,
  rotuloDaVigente,
  conferida,
  versaoNova,
  faltam,
  aoIrPara,
  aoConcluir,
  aoFechar,
  aoVoltarAoPasso2,
  confereOutraPessoa,
  aoConferir,
  salvando,
}: Props) {
  const [erro, setErro] = useState("");
  const situacao = conferida ? "Conferida" : "a conferir";
  const fechar = (
    <button
      type="button"
      className="btn secondary small"
      data-acao="fechar-assistente-do-cartao"
      onClick={aoFechar}
    >
      Fechar o assistente
    </button>
  );
  const voltar = (
    <button
      type="button"
      className="btn ghost small"
      data-acao="voltar-ao-passo-2"
      onClick={aoVoltarAoPasso2}
    >
      <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Voltar ao
      passo 2
    </button>
  );
  return (
    <section
      className="ui-card avd-ast-estado"
      data-modo={modo}
      role="status"
      aria-live="polite"
      data-tour="avd-assistente-estado-do-passo-5"
    >
      {modo === "sem-mudancas" ? (
        <>
          <h3 className="avd-ast-estado-titulo">
            <i className="fa-solid fa-circle-check" aria-hidden="true" /> Sem
            mudanças — a {rotuloDaVigente} continua valendo ({situacao})
          </h3>
          <div className="ui-acoes">
            <button
              type="button"
              className="btn small"
              data-acao="concluir-sem-mudancas"
              onClick={aoConcluir}
            >
              Concluir sem mudanças
            </button>
            {fechar}
            {voltar}
          </div>
        </>
      ) : null}
      {modo === "concluido" ? (
        <>
          <h3 className="avd-ast-estado-titulo">
            <i className="fa-solid fa-circle-check" aria-hidden="true" />{" "}
            Concluído sem mudanças — a {rotuloDaVigente} continua valendo (
            {situacao})
          </h3>
          <div className="ui-acoes">
            {fechar}
            {voltar}
          </div>
        </>
      ) : null}
      {modo === "pronto" ? (
        <>
          <h3 className="avd-ast-estado-titulo">
            <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Pronto
            para salvar como Versão {versaoNova}
          </h3>
          {faltam.length ? (
            <ul className="avd-ast-estado-faltam" aria-label="O que falta">
              {faltam.map((p) => (
                <li key={p.texto}>
                  <button
                    type="button"
                    className="avd-ast-falta-item"
                    data-passo-alvo={p.passo}
                    onClick={() => aoIrPara(p)}
                  >
                    <i
                      className="fa-solid fa-circle-exclamation"
                      aria-hidden="true"
                    />
                    <span>{p.texto}</span>
                    <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="avd-ast-estado-texto">
              Tudo certo: confira o nome e o motivo, embaixo, e salve.
            </p>
          )}
        </>
      ) : null}
      {modo === "salvo" ? (
        <>
          <h3 className="avd-ast-estado-titulo">
            <i className="fa-solid fa-circle-check" aria-hidden="true" />{" "}
            {rotuloDaVigente} salva ({situacao})
          </h3>
          {conferida ? null : confereOutraPessoa ? (
            <p className="avd-ast-estado-texto" data-dupla-conferencia="">
              <i className="fa-solid fa-user-check" aria-hidden="true" /> Você
              salvou esta versão: outra pessoa da coordenação do edital marca
              como conferida (dupla conferência; o administrador global também
              pode).
            </p>
          ) : (
            <p className="avd-ast-estado-texto">
              Você pode marcar esta versão como conferida agora.
            </p>
          )}
          {erro ? (
            <Aviso tom="danger" papel="alert">
              {erro}
            </Aviso>
          ) : null}
          <div className="ui-acoes">
            {!conferida && !confereOutraPessoa ? (
              <button
                type="button"
                className="btn small"
                data-acao="conferir-no-assistente"
                disabled={salvando}
                onClick={async () => {
                  const r = await aoConferir();
                  setErro(r.ok ? "" : (r.erro ?? "Não foi possível conferir."));
                }}
              >
                <i className="fa-solid fa-user-check" aria-hidden="true" />{" "}
                Marcar como conferida
              </button>
            ) : null}
            {fechar}
          </div>
        </>
      ) : null}
    </section>
  );
}
