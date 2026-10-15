import { useMemo, useRef, useState } from "react";
import type { Espelho } from "../../lib/avaliacao-documental/espelho-de-nota.ts";
import {
  argumentosDaPagina,
  avisoDoTamanho,
  codigosSemEspelho,
  estimativaDosEspelhos,
  FILTROS_DOS_ESPELHOS,
  lerCodigos,
  MAXIMO_DE_CODIGOS,
  ordenarParaOsEspelhos,
  type EscolhaDosEspelhos,
  type FichaDaFila,
  type FichaDoEspelho,
  type FiltroDosEspelhos,
  type PaginaDosEspelhos,
} from "../../lib/avaliacao-documental/espelhos-em-massa.ts";
import { Aviso, Campo, Gaveta, Segmentado } from "../../ui/index.js";
import {
  abrirEspelhosEmMassa,
  espelhoDaFichaGravada,
} from "./ficha/espelho-de-nota.ts";

/*
  "Espelhos de nota em massa" (Avaliação documental › Fila › Ações da
  coordenação; só quem coordena o edital vê o menu, e o banco confere de novo):
  escolhe a vaga (ou todas) e o filtro, ou cola a lista de códigos do
  candidato na Empregare; busca as fichas concluídas em páginas de 200
  (obter_espelhos_de_nota, migration 20261015180000: ~1 KB por ficha, nada da
  ficha inteira), com progresso e cancelar; monta cada espelho pela MESMA
  montagem do botão da ficha (espelhoDaFichaGravada) e abre a impressão de um
  documento só, um espelho por página. Nada é guardado (nem banco, nem Storage).
  Regras puras: src/lib/avaliacao-documental/espelhos-em-massa.ts.
*/

export const RPC_ESPELHOS_DE_NOTA = "obter_espelhos_de_nota";

type Rpc = (
  nome: string,
  argumentos: Record<string, unknown>,
) => Promise<unknown>;

type Lidas = {
  fichas: FichaDoEspelho[];
  regras: Record<string, unknown>;
  documental: unknown;
  edital: { rotulo?: string | null; area?: string | null } | null;
  naoConcluidos: { codigo: string | number; situacao: string }[];
};

/**
 * Lê todas as páginas da escolha. `aoProgredir(lidas)` a cada página;
 * `cancelado()` verdadeiro para no fim da página em curso (devolve null).
 */
export async function lerFichasDosEspelhos({
  rpc,
  editalId,
  escolha,
  aoProgredir = () => {},
  cancelado = () => false,
}: {
  rpc: Rpc;
  editalId: string;
  escolha: EscolhaDosEspelhos;
  aoProgredir?: (lidas: number) => void;
  cancelado?: () => boolean;
}): Promise<Lidas | null> {
  const lidas: Lidas = {
    fichas: [],
    regras: {},
    documental: null,
    edital: null,
    naoConcluidos: [],
  };
  let apos: string | null = null;
  for (let pagina = 0; pagina < 1000; pagina += 1) {
    const r = ((await rpc(
      RPC_ESPELHOS_DE_NOTA,
      argumentosDaPagina(editalId, escolha, apos, Object.keys(lidas.regras)),
    )) ?? {}) as PaginaDosEspelhos;
    if (cancelado()) return null;
    lidas.fichas.push(...(r.fichas ?? []));
    Object.assign(lidas.regras, r.regras ?? {});
    lidas.documental ??= r.documental ?? null;
    lidas.edital ??= r.edital ?? null;
    if (pagina === 0) lidas.naoConcluidos = r.nao_concluidos ?? [];
    aoProgredir(lidas.fichas.length);
    apos = r.proximo ?? null;
    if (!apos) break;
  }
  return lidas;
}

/** Os espelhos das fichas lidas, na ordem do documento. */
export function montarEspelhosLidos(
  lidas: Lidas,
  codigos: string[] | null,
): Espelho[] {
  return ordenarParaOsEspelhos(lidas.fichas, codigos).map((f) =>
    espelhoDaFichaGravada(
      f,
      lidas.regras[f.regra],
      lidas.documental,
      lidas.edital,
    ),
  );
}

type Vaga = { codigo: string | number; cargo?: string | null };
type Resultado = {
  espelhos: Espelho[];
  naoEncontrados: string[];
  naoConcluidos: { codigo: string; situacao: string }[];
};

const MODOS = [
  { valor: "filtro", rotulo: "Por vaga e filtro" },
  { valor: "codigos", rotulo: "Colar lista de códigos" },
] as const;

export function EspelhosEmMassa({
  editalId,
  vagas,
  fila,
  rpc,
  aoFechar,
  abrir = abrirEspelhosEmMassa,
}: {
  editalId: string;
  vagas: Vaga[];
  /** A fila carregada (núcleo): só para estimar quantos espelhos sairão. */
  fila: FichaDaFila[];
  rpc: Rpc;
  aoFechar: () => void;
  abrir?: (espelhos: Espelho[], opcoes?: { titulo?: string }) => void;
}) {
  const [modo, setModo] = useState<"filtro" | "codigos">("filtro");
  const [vaga, setVaga] = useState("");
  const [filtro, setFiltro] = useState<FiltroDosEspelhos>("TODOS");
  const [texto, setTexto] = useState("");
  const [lidos, setLidos] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const cancelar = useRef(false);

  const codigos = useMemo(() => lerCodigos(texto), [texto]);
  const escolha: EscolhaDosEspelhos =
    modo === "codigos" ? { modo, codigos } : { modo, vaga, filtro };
  const estimativa = estimativaDosEspelhos(fila, escolha);
  const aviso = avisoDoTamanho(estimativa);
  const buscando = lidos !== null;
  const codigosDemais =
    modo === "codigos" && codigos.length > MAXIMO_DE_CODIGOS;
  const vazio = modo === "codigos" ? !codigos.length : !estimativa;

  async function gerar() {
    setErro("");
    setResultado(null);
    cancelar.current = false;
    setLidos(0);
    try {
      const lidas = await lerFichasDosEspelhos({
        rpc,
        editalId,
        escolha,
        aoProgredir: setLidos,
        cancelado: () => cancelar.current,
      });
      if (!lidas) return;
      const lista = escolha.modo === "codigos" ? escolha.codigos : null;
      const espelhos = montarEspelhosLidos(lidas, lista);
      const faltam = lista
        ? codigosSemEspelho(lista, lidas.fichas, lidas.naoConcluidos)
        : { naoEncontrados: [], naoConcluidos: [] };
      setResultado({ espelhos, ...faltam });
      if (espelhos.length)
        abrir(espelhos, {
          titulo:
            escolha.modo === "filtro" && escolha.vaga
              ? `Espelhos de nota - vaga ${escolha.vaga}`
              : "Espelhos de nota",
        });
    } catch (e) {
      setErro(
        `Não foi possível gerar os espelhos: ${(e as { message?: string })?.message || String(e)}`,
      );
    } finally {
      setLidos(null);
    }
  }

  return (
    <Gaveta
      tituloId="avdEspelhosTitulo"
      titulo="Espelhos de nota em massa"
      resumo="Um documento para imprimir ou salvar como PDF, um espelho por página"
      aoFechar={aoFechar}
      fecharAoClicarFora={false}
      tour="avd-espelhos-em-massa"
    >
      <div className="avd-gaveta-corpo avd-espelhos-massa">
        <Segmentado
          rotulo="Como escolher"
          opcoes={MODOS}
          valor={modo}
          aoMudar={(v: "filtro" | "codigos") => setModo(v)}
          desabilitado={buscando}
        />
        {modo === "filtro" ? (
          <>
            <Campo rotulo="Vaga">
              <select
                value={vaga}
                disabled={buscando}
                onChange={(ev) => setVaga(ev.target.value)}
              >
                <option value="">Todas as vagas</option>
                {vagas.map((v) => (
                  <option key={String(v.codigo)} value={String(v.codigo)}>
                    {v.cargo ? `${v.codigo} - ${v.cargo}` : String(v.codigo)}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Quais fichas concluídas">
              <select
                value={filtro}
                disabled={buscando}
                onChange={(ev) =>
                  setFiltro(ev.target.value as FiltroDosEspelhos)
                }
              >
                {FILTROS_DOS_ESPELHOS.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
            <p className="ui-texto-secundario">
              Ordem: por vaga; os aptos pela nota final, depois os inaptos pela
              nota e os eliminados pelo nome.
            </p>
          </>
        ) : (
          <>
            <Campo
              rotulo="Códigos do candidato na Empregare"
              dica="Separados por vírgula ou um por linha. Sai na ordem colada."
              erro={
                codigosDemais
                  ? `No máximo ${MAXIMO_DE_CODIGOS.toLocaleString("pt-BR")} códigos por vez.`
                  : undefined
              }
            >
              <textarea
                rows={6}
                value={texto}
                disabled={buscando}
                data-acao="espelhos-codigos"
                onChange={(ev) => setTexto(ev.target.value)}
              />
            </Campo>
          </>
        )}
        <p data-acao="espelhos-estimativa">
          <strong>
            {estimativa.toLocaleString("pt-BR")}{" "}
            {modo === "codigos"
              ? estimativa === 1
                ? "código"
                : "códigos"
              : estimativa === 1
                ? "espelho"
                : "espelhos"}
          </strong>
          {modo === "codigos"
            ? " para procurar entre as fichas concluídas."
            : " (fichas concluídas na fila)."}
        </p>
        {aviso ? <Aviso tom="warning">{aviso}</Aviso> : null}
        {buscando ? (
          <div className="avd-espelhos-progresso" role="status">
            <progress
              max={Math.max(estimativa, lidos ?? 0, 1)}
              value={lidos ?? 0}
              aria-label="Fichas lidas"
            />
            <span>
              {(lidos ?? 0).toLocaleString("pt-BR")} ficha(s) lida(s)…
            </span>
          </div>
        ) : null}
        {resultado ? (
          <Aviso tom={resultado.espelhos.length ? "info" : "warning"}>
            {resultado.espelhos.length
              ? `${resultado.espelhos.length.toLocaleString("pt-BR")} espelho(s) no documento. Se a impressão não abriu, use "Abrir de novo".`
              : "Nenhuma ficha concluída na escolha: nada para imprimir."}
            {resultado.naoEncontrados.length ? (
              <span
                className="avd-espelhos-faltam"
                data-acao="espelhos-nao-encontrados"
              >
                <br />
                Sem ficha neste edital ({resultado.naoEncontrados.length}):{" "}
                {resultado.naoEncontrados.join(", ")}
              </span>
            ) : null}
            {resultado.naoConcluidos.length ? (
              <span
                className="avd-espelhos-faltam"
                data-acao="espelhos-nao-concluidos"
              >
                <br />
                Ficha ainda não concluída ({
                  resultado.naoConcluidos.length
                }):{" "}
                {resultado.naoConcluidos
                  .map((n) => `${n.codigo} (${n.situacao})`)
                  .join(", ")}
              </span>
            ) : null}
          </Aviso>
        ) : null}
        {erro ? (
          <Aviso tom="danger" papel="alert">
            {erro}
          </Aviso>
        ) : null}
        <div className="ui-acoes">
          {buscando ? (
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                cancelar.current = true;
              }}
            >
              Cancelar
            </button>
          ) : (
            <button type="button" className="btn secondary" onClick={aoFechar}>
              Fechar
            </button>
          )}
          {resultado?.espelhos.length && !buscando ? (
            <button
              type="button"
              className="btn secondary"
              onClick={() => abrir(resultado.espelhos)}
            >
              Abrir de novo
            </button>
          ) : null}
          <button
            type="button"
            className="btn"
            data-acao="gerar-espelhos"
            disabled={buscando || vazio || codigosDemais}
            onClick={() => void gerar()}
          >
            <i className="fa-solid fa-print" aria-hidden="true" />{" "}
            {aviso ? "Gerar mesmo assim" : "Gerar espelhos"}
          </button>
        </div>
      </div>
    </Gaveta>
  );
}
