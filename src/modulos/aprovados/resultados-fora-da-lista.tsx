import { useEffect, useMemo, useRef, useState } from "react";
import { irParaTela } from "../../app/ir-para-tela.ts";
import { pedirFiltro } from "../../app/pedido-de-filtro.ts";
import {
  resultadosFinaisForaDaLista,
  type ResultadoFinalForaDaLista,
} from "../../lib/aprovados/resultado-final-na-lista.ts";
import { numeroDoEdital } from "../../lib/editais/numero-do-edital.ts";
import { Aviso } from "../../ui/index.ts";

/*
  O aviso no topo da Lista de aprovados: os editais da área com o resultado
  final publicado na Classificação e sem lista de aprovados vinda dele
  (publicar não é o mesmo que publicar como lista de aprovados). Cada um leva
  a Classificação › Listas › Resultado final do edital. Os editais vêm de
  listar_editais_classificacao (quem não vê a Classificação não recebe o
  aviso: o atalho não o levaria a lugar nenhum); a regra mora em
  src/lib/aprovados/resultado-final-na-lista.ts.
*/

export interface ClienteDoAvisoDeResultados {
  rpc: (
    nome: "listar_editais_classificacao",
    argumentos: { p_area: string },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
}

function editaisLidos(dados: unknown): unknown[] {
  if (dados === null || typeof dados !== "object" || Array.isArray(dados))
    return [];
  const editais = (dados as { editais?: unknown }).editais;
  return Array.isArray(editais) ? editais : [];
}

/** Abre a Classificação no resultado final do edital. */
export function abrirResultadoFinal(
  edital: Pick<ResultadoFinalForaDaLista, "id" | "edital">,
) {
  pedirFiltro("classificacao", { editalId: edital.id, tipoDeLista: "FINAL" });
  const foi = irParaTela({
    view: "classificacao",
    edital: { id: edital.id, titulo: edital.edital },
  });
  if (!foi) globalThis.window?.navigate?.("classificacao");
}

const rotuloDoEdital = (e: ResultadoFinalForaDaLista) =>
  numeroDoEdital(e.edital) || e.edital;

export function ResultadosForaDaLista({
  supabase,
  area,
  listas,
  carregadoEm,
  abrir = abrirResultadoFinal,
}: {
  supabase: ClienteDoAvisoDeResultados | null | undefined;
  area: string;
  /** As listas de aprovados vigentes da área. */
  listas: readonly unknown[];
  /** Relê a cada carga da Lista de aprovados ("Atualizar", depois de publicar). */
  carregadoEm: string;
  abrir?: (edital: ResultadoFinalForaDaLista) => void;
}) {
  const [lidos, setLidos] = useState<{
    area: string;
    editais: unknown[];
  } | null>(null);
  // Uma leitura por carga, mesmo que o efeito rode de novo (StrictMode).
  const pedidos = useRef(
    new Map<string, Promise<{ data: unknown; error: unknown }>>(),
  );
  useEffect(() => {
    if (!supabase || !area || !carregadoEm) return undefined;
    let vivo = true;
    const chave = `${area}|${carregadoEm}`;
    let pedido = pedidos.current.get(chave);
    if (!pedido) {
      pedido = Promise.resolve(
        supabase.rpc("listar_editais_classificacao", { p_area: area }),
      );
      pedidos.current.clear();
      pedidos.current.set(chave, pedido);
    }
    pedido.then(
      ({ data, error }) => {
        if (!vivo) return;
        // Sem acesso à Classificação ou falha: sem aviso (o resto da tela segue).
        if (error) console.info("Editais da Classificação não lidos:", error);
        setLidos({ area, editais: error ? [] : editaisLidos(data) });
      },
      (erro: unknown) => {
        if (vivo) console.info("Editais da Classificação não lidos:", erro);
      },
    );
    return () => {
      vivo = false;
    };
  }, [supabase, area, carregadoEm]);

  const fora = useMemo(
    () =>
      lidos?.area === area
        ? resultadosFinaisForaDaLista(lidos.editais, listas)
        : [],
    [lidos, area, listas],
  );
  if (!fora.length) return null;
  const [unico] = fora;
  return (
    <Aviso tom="info" papel="status" className="aprovados-resultados-fora">
      {fora.length === 1 && unico ? (
        <p>
          O resultado final do {rotuloDoEdital(unico)} foi publicado na
          Classificação e ainda não está na Lista de aprovados.
        </p>
      ) : (
        <p>
          Resultado final publicado na Classificação e ainda fora da Lista de
          aprovados:
        </p>
      )}
      <div className="ui-acoes">
        {fora.map((e) => (
          <button
            key={e.id}
            type="button"
            className="btn secondary small"
            data-acao="abrir-resultado-final"
            data-edital={e.id}
            title={[e.edital, e.unidade].filter(Boolean).join(" · ")}
            onClick={() => abrir(e)}
          >
            {fora.length === 1 ? "Abrir na Classificação" : rotuloDoEdital(e)}
          </button>
        ))}
      </div>
    </Aviso>
  );
}
