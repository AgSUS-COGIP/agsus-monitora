import { useState } from "react";
import { horaBR, lerHora } from "../../lib/classificacao/numeros.js";
import { Campo, Secao } from "../../ui/index.js";

/*
  A hora de nascimento pela certidão, na explicação do candidato
  (listas.jsx › gaveta). Só aparece quando decide: o empate chegou à "maior
  idade" com a mesma data de nascimento (o motor marca `horaDecide`), ou a
  hora já foi informada (para trocar ou tirar). Sem hora, vale 23h59min59s
  (itens 6.11.5 e 6.11.6 do 93/2026). A planilha e a Empregare não trazem a
  hora: quem informa é o analista, pela certidão enviada na inscrição.
  Grava por salvar_hora_nascimento_candidato (estado.js); quem só lê vê a hora.
*/

export type PropriedadesDaHora = {
  horaNascimento: string | null;
  horaDecide: boolean;
  podeEditar: boolean;
  aoSalvar: (hora: string) => Promise<boolean>;
};

export function HoraDeNascimento({
  horaNascimento,
  horaDecide,
  podeEditar,
  aoSalvar,
}: PropriedadesDaHora) {
  const salva = horaNascimento || "";
  const [rascunho, setRascunho] = useState(salva);
  const [salvando, setSalvando] = useState(false);
  if (!horaDecide && !salva) return null;

  const valida = !rascunho.trim() || lerHora(rascunho) !== null;
  const mudou = (lerHora(rascunho) || "") !== salva;

  async function salvar(hora: string) {
    setSalvando(true);
    const ok = await aoSalvar(hora);
    setSalvando(false);
    if (ok) setRascunho(hora);
  }

  return (
    <Secao
      icone="fa-clock"
      titulo="Hora de nascimento (certidão)"
      secao="hora-de-nascimento"
    >
      {podeEditar ? (
        <form
          className="classificacao-hora"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (valida && mudou) void salvar(lerHora(rascunho) || "");
          }}
        >
          <Campo
            rotulo="Hora"
            erro={valida ? undefined : "Use HH:MM ou HH:MM:SS."}
            dica={salva ? undefined : "Sem certidão: 23h59min59s."}
          >
            <input
              type="time"
              step={1}
              data-campo="hora-de-nascimento"
              value={rascunho}
              onChange={(evento) => setRascunho(evento.target.value)}
            />
          </Campo>
          <div className="ui-acoes">
            <button
              type="submit"
              className="btn small"
              data-acao="salvar-hora"
              disabled={!valida || !mudou || salvando}
            >
              Salvar
            </button>
            {salva ? (
              <button
                type="button"
                className="btn secondary small"
                data-acao="tirar-hora"
                disabled={salvando}
                onClick={() => void salvar("")}
              >
                Sem certidão
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="ui-secao-texto">
          {salva ? horaBR(salva) : "Sem certidão: 23h59min59s."}
        </p>
      )}
    </Secao>
  );
}
