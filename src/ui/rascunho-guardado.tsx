import { Aviso } from "./aviso.tsx";

/*
  O rascunho guardado de uma regra (src/app/rascunho-da-regra.ts), em dois
  pedaços: o aviso de recuperação ao abrir ("Continuar de onde parei" /
  "Descartar", com a versão de onde ele partiu quando outra pessoa salvou no
  meio) e o indicador discreto da gravação ("Rascunho guardado às 14:05").
*/

type PropriedadesDoAviso = {
  /** "13/10 14:05". */
  quando: string;
  versaoBase: number;
  versaoVigente: number;
  /** Guardado só neste computador (o banco ainda não recebeu). */
  local?: boolean;
  aoContinuar: () => void;
  aoDescartar: () => void;
  confirmar?: (mensagem: string) => boolean;
};

export function AvisoDeRascunho({
  quando,
  versaoBase,
  versaoVigente,
  local = false,
  aoContinuar,
  aoDescartar,
  confirmar = (mensagem) => globalThis.confirm?.(mensagem) ?? true,
}: PropriedadesDoAviso) {
  const versaoMudou = versaoBase !== versaoVigente;
  return (
    <Aviso tom="warning" papel="alert" className="ui-aviso-de-rascunho">
      <p>
        <strong>Você tem um rascunho não salvo de {quando}.</strong>
        {local ? " Guardado só neste computador." : ""}
      </p>
      {versaoMudou ? (
        <p data-rascunho-versao-mudou="">
          {versaoBase
            ? `Ele partiu da versão ${versaoBase}`
            : "Ele começou quando o edital ainda não tinha regra"}
          ; a vigente agora é a versão {versaoVigente}, salva depois por outra
          pessoa. Ao continuar, confira a comparação de versões antes de salvar.
        </p>
      ) : null}
      <div className="ui-acoes">
        <button
          type="button"
          className="btn"
          data-acao="continuar-rascunho"
          onClick={aoContinuar}
        >
          Continuar de onde parei
        </button>
        <button
          type="button"
          className="btn secondary"
          data-acao="descartar-rascunho"
          onClick={() => {
            if (
              confirmar(
                `Descartar o rascunho de ${quando}? Não dá para recuperar depois.`,
              )
            )
              aoDescartar();
          }}
        >
          Descartar
        </button>
      </div>
    </Aviso>
  );
}

/** O indicador discreto ("" = nada). */
export function SituacaoDoRascunho({
  texto,
  gravacao,
}: {
  texto: string;
  gravacao: string;
}) {
  if (!texto) return null;
  return (
    <span
      className="status-discreto"
      data-rascunho={gravacao}
      role="status"
      aria-live="polite"
    >
      {texto}
    </span>
  );
}
