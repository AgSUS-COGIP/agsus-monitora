import {
  ESCOLHAS_DA_FICHA,
  textoDoProgresso,
} from "../../../lib/avaliacao-documental/ficha.js";
import { Popover } from "../../../ui/index.js";
import type { Conferencia, EstadoDoPasso, Passo } from "./tipos.ts";

/*
  O stepper do modo de análise: um passo por item (Identidade · Formação ·
  Conselho · Titulação · Cursos · Experiência) e a Conclusão, com a marca do
  estado (✓ verde, ✕ vermelho, ⊘ cinza, ! âmbar quando falta completar) e a
  barra de progresso que enche ("X de 6 conferidos": conta só o item com
  decisão e sem falta, a mesma regra do "!"; passar o mouse no "!" mostra o
  que falta, a mesma mensagem do item). Clicar vai ao passo. À direita, "Ver todos" /
  "Um por vez" (o modo fica lembrado) e o "?" com os atalhos.
*/

const ICONE: Partial<Record<EstadoDoPasso, string>> = {
  CONFORME: "fa-check",
  NAO_CONFORME: "fa-xmark",
  NAO_ENVIADO: "fa-ban",
  pendencia: "fa-circle-exclamation",
  pronta: "fa-check",
};
const TEXTO: Record<EstadoDoPasso, string> = {
  nao_conferido: "não conferido",
  pendencia: "falta completar",
  opcional: "opcional",
  pronta: "pronta para concluir",
  CONFORME: "conforme",
  NAO_CONFORME: "não conforme",
  NAO_ENVIADO: "não enviado",
};

const ESCOLHAS = ESCOLHAS_DA_FICHA as unknown as ReadonlyArray<
  readonly [string, string, string]
>;

export const ATALHOS: ReadonlyArray<readonly [string, string]> = [
  ...ESCOLHAS.map(([, rotulo, tecla]) => [tecla, rotulo] as const),
  ["J / K", "Próximo / anterior"],
  ["Ctrl+S", "Salvar rascunho"],
  ["Ctrl+Enter", "Concluir e próxima"],
];

export type PropriedadesDoProgresso = {
  passos: Passo[];
  atual: string | null;
  conferencia: Conferencia | null;
  modo: "foco" | "lista";
  aoIr: (codigo: string) => void;
  aoAlternarModo: () => void;
  comAtalhos: boolean;
};

export function ProgressoDaFicha({
  passos,
  atual,
  conferencia,
  modo,
  aoIr,
  aoAlternarModo,
  comAtalhos,
}: PropriedadesDoProgresso) {
  const total = conferencia?.total ?? 0;
  const conferidos = conferencia?.conferidos ?? 0;
  const fracao = total ? conferidos / total : 0;
  return (
    <div className="avd-ficha-etapas" data-tour="avd-ficha-etapas">
      <ol aria-label="Itens da ficha">
        {passos.map((p, i) => {
          const icone = ICONE[p.estado];
          return (
            <li key={p.codigo} data-estado={p.estado}>
              <button
                type="button"
                data-etapa={p.codigo}
                data-estado={p.estado}
                aria-current={p.codigo === atual ? "step" : undefined}
                title={
                  p.estado === "pendencia" && p.motivo ? p.motivo : undefined
                }
                onClick={() => aoIr(p.codigo)}
              >
                <span
                  className="avd-ficha-etapa-marca"
                  aria-hidden="true"
                  data-numero={i + 1}
                >
                  {icone ? <i className={`fa-solid ${icone}`} /> : null}
                </span>
                <span className="avd-ficha-etapa-nome">{p.nome}</span>
                <span className="sr-only">
                  {" "}
                  ({TEXTO[p.estado]}
                  {p.estado === "pendencia" && p.motivo ? `: ${p.motivo}` : ""})
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="avd-ficha-etapas-pe">
        {total ? (
          <div className="avd-ficha-progresso" data-tour="avd-ficha-progresso">
            <span
              className="avd-ficha-progresso-barra"
              role="progressbar"
              aria-label="Itens conferidos"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={conferidos}
              aria-valuetext={textoDoProgresso({ conferidos, total })}
              data-completo={conferidos === total ? "sim" : undefined}
            >
              <span style={{ transform: `scaleX(${fracao})` }} />
            </span>
            <span className="avd-ficha-progresso-texto">
              {textoDoProgresso({ conferidos, total })}
            </span>
          </div>
        ) : null}
        <div className="avd-ficha-etapas-acoes">
          <button
            type="button"
            className="avd-ficha-modo"
            data-acao="alternar-modo"
            aria-pressed={modo === "lista"}
            title={
              modo === "lista"
                ? "Ver um item por vez"
                : "Ver todos os itens numa lista"
            }
            onClick={aoAlternarModo}
          >
            <i
              className={`fa-solid ${modo === "lista" ? "fa-square" : "fa-table-list"}`}
              aria-hidden="true"
            />{" "}
            {modo === "lista" ? "Um por vez" : "Ver todos"}
          </button>
          {comAtalhos ? (
            <Popover
              rotulo="Atalhos do teclado"
              gatilho="?"
              acao="atalhos"
              tour="avd-ficha-atalhos"
            >
              <dl className="avd-ficha-atalhos">
                {ATALHOS.map(([tecla, acao]) => (
                  <div key={tecla}>
                    <dt>
                      <kbd>{tecla}</kbd>
                    </dt>
                    <dd>{acao}</dd>
                  </div>
                ))}
              </dl>
            </Popover>
          ) : null}
        </div>
      </div>
    </div>
  );
}
