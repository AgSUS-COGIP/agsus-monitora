import { NIVEIS as LISTA_DE_NIVEIS } from "../../../lib/avaliacao-documental/catalogo.ts";
import { Popover } from "../../../ui/index.ts";
import { copiar, LinkDaEmpregare } from "./empregare.tsx";
import type { ContextoDaEmpregare } from "./tipos.ts";

/*
  O "⋯" da nota: as ações secundárias da ficha — copiar o código do
  candidato, abrir na Empregare e, só para a coordenação, o nível da vaga
  (que muda os pontos declarados).
*/

const NIVEIS = LISTA_DE_NIVEIS as unknown as ReadonlyArray<
  readonly [string, string]
>;

export type PropriedadesDasMaisAcoes = {
  empregare: ContextoDaEmpregare;
  /** Só para quem coordena e pode editar. */
  nivel?: { valor: string; aoMudar: (nivel: string) => void } | null;
};

export function MaisAcoesDaFicha({
  empregare,
  nivel,
}: PropriedadesDasMaisAcoes) {
  const codigo = empregare.codigoDoCandidato;
  return (
    <Popover
      rotulo="Mais ações da ficha"
      gatilho={<i className="fa-solid fa-ellipsis" aria-hidden="true" />}
      acao="mais-acoes"
      tour="avd-ficha-mais-acoes"
      className="avd-ficha-mais"
    >
      {(fechar) => (
        <div className="avd-ficha-mais-lista" data-tour="avd-ficha-empregare">
          <button
            type="button"
            className="avd-ficha-mais-item"
            onClick={async () => {
              const ok = await copiar(codigo);
              empregare.aoAvisar(
                ok ? "Código copiado" : "Não foi possível copiar",
              );
              void empregare.loja.registrarAcesso("COPIAR_CODIGO");
              fechar();
            }}
          >
            <i className="fa-regular fa-copy" aria-hidden="true" /> Copiar
            código {codigo}
          </button>
          <LinkDaEmpregare
            empregare={empregare}
            className="avd-ficha-mais-item"
            aoAbrir={fechar}
          />
          {nivel ? (
            <label className="avd-ficha-campo avd-ficha-mais-nivel">
              <span className="avd-ficha-rotulo">Nível da vaga</span>
              <select
                value={nivel.valor}
                data-acao="nivel-da-vaga"
                onChange={(ev) => nivel.aoMudar(ev.target.value)}
              >
                {NIVEIS.map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
              <small>Mudar o nível muda os pontos declarados.</small>
            </label>
          ) : null}
        </div>
      )}
    </Popover>
  );
}
