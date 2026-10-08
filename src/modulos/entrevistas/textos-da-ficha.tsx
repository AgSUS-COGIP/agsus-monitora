import { useId, useLayoutEffect, useRef } from "react";
import type { Ref, RefObject } from "react";

/*
  Os textos da ficha de notas (ficha.jsx), gravados por lancar_notas_entrevista
  (migration 20261008220000):

  - ObservacaoDoAvaliador: opcional, uma por avaliador na entrevista (nunca
    por competência), até 1.000 caracteres — embaixo da matriz do avaliador
    (por avaliador) ou junto do nome dele (por competência);
  - JustificativaDaBanca: por entrevista, opcional para APTO e obrigatória
    para INAPTO e para Faltou (o banco recusa sem ela); entra no parecer
    pronto.

  Os dois são uma linha que cresce com o texto (CampoQueCresce), com a
  contagem perto do limite.
*/

export const LIMITE_DA_OBSERVACAO = 1000;
export const LIMITE_DA_JUSTIFICATIVA = 4000;

function CampoQueCresce({
  id,
  valor,
  limite,
  placeholder,
  desabilitado,
  invalido,
  descricao,
  campoRef,
  aoMudar,
}: {
  id: string;
  valor: string;
  limite: number;
  placeholder?: string;
  desabilitado?: boolean;
  invalido?: boolean;
  descricao?: string;
  campoRef?: Ref<HTMLTextAreaElement>;
  aoMudar: (valor: string) => void;
}) {
  const interno = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const el = interno.current;
    if (!el) return;
    el.style.height = "auto";
    if (el.scrollHeight) el.style.height = `${el.scrollHeight}px`;
  }, [valor]);
  return (
    <textarea
      id={id}
      ref={(el) => {
        interno.current = el;
        if (typeof campoRef === "function") campoRef(el);
        else if (campoRef)
          (campoRef as RefObject<HTMLTextAreaElement | null>).current = el;
      }}
      className="entrevistas-texto-da-ficha"
      rows={1}
      maxLength={limite}
      value={valor}
      placeholder={placeholder}
      disabled={desabilitado}
      aria-invalid={invalido || undefined}
      aria-describedby={descricao}
      onChange={(ev) => aoMudar(ev.target.value)}
    />
  );
}

function Contagem({
  valor,
  limite,
  id,
}: {
  valor: string;
  limite: number;
  id: string;
}) {
  const perto = valor.length >= limite * 0.8;
  return (
    <small className="entrevistas-contagem-do-texto" id={id} aria-live="polite">
      {perto ? `${valor.length} de ${limite.toLocaleString("pt-BR")}` : ""}
    </small>
  );
}

export function ObservacaoDoAvaliador({
  nome,
  valor,
  editavel,
  comNome = false,
  aoMudar,
}: {
  nome: string;
  valor: string;
  editavel: boolean;
  /** Por competência: o nome do avaliador vai no rótulo. */
  comNome?: boolean;
  aoMudar: (valor: string) => void;
}) {
  const id = useId();
  if (!editavel && !valor.trim()) return null;
  return (
    <div className="entrevistas-observacao" data-observacao={nome}>
      <label htmlFor={id} className="entrevistas-rotulo-do-texto">
        {comNome ? <strong>{nome}</strong> : "Observação do avaliador"}
        {comNome ? null : <span> (opcional)</span>}
      </label>
      <CampoQueCresce
        id={id}
        valor={valor}
        limite={LIMITE_DA_OBSERVACAO}
        placeholder={`Observação de ${nome} sobre a entrevista (opcional)`}
        desabilitado={!editavel}
        descricao={`${id}-contagem`}
        aoMudar={aoMudar}
      />
      <Contagem
        valor={valor}
        limite={LIMITE_DA_OBSERVACAO}
        id={`${id}-contagem`}
      />
    </div>
  );
}

export function JustificativaDaBanca({
  valor,
  obrigatoria,
  motivo,
  editavel,
  mostrarErro,
  campoRef,
  aoMudar,
}: {
  valor: string;
  obrigatoria: boolean;
  /** "Inapto" ou "Faltou": por que é obrigatória. */
  motivo: string;
  editavel: boolean;
  mostrarErro: boolean;
  campoRef?: Ref<HTMLTextAreaElement>;
  aoMudar: (valor: string) => void;
}) {
  const id = useId();
  const falta = obrigatoria && !valor.trim();
  if (!editavel && !valor.trim()) return null;
  return (
    <section
      className="ui-card entrevistas-justificativa"
      data-obrigatoria={obrigatoria ? "sim" : undefined}
      data-falta={falta && mostrarErro ? "sim" : undefined}
      data-tour="entrevistas-ficha-justificativa"
    >
      <label htmlFor={id} className="entrevistas-rotulo-do-texto">
        <strong>Justificativa da banca</strong>
        <span>
          {obrigatoria ? ` (obrigatória: ${motivo})` : " (opcional para Apto)"}
        </span>
      </label>
      <CampoQueCresce
        id={id}
        valor={valor}
        limite={LIMITE_DA_JUSTIFICATIVA}
        placeholder="Por que a banca chegou a este parecer"
        desabilitado={!editavel}
        invalido={falta && mostrarErro}
        descricao={`${id}-ajuda`}
        campoRef={campoRef}
        aoMudar={aoMudar}
      />
      <small className="entrevistas-contagem-do-texto" id={`${id}-ajuda`}>
        {falta && mostrarErro
          ? "Escreva a justificativa para salvar."
          : valor.length >= LIMITE_DA_JUSTIFICATIVA * 0.8
            ? `${valor.length} de ${LIMITE_DA_JUSTIFICATIVA.toLocaleString("pt-BR")}`
            : ""}
      </small>
    </section>
  );
}
