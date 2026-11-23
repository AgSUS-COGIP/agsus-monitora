import type {
  IdQueAbre,
  OrigemDoRecorte,
} from "../lib/paineis/endereco-dos-relatorios.ts";
import { buscaDoRelatorio } from "../lib/paineis/endereco-dos-relatorios.ts";
import { guardarFiltrosDaTela } from "../app/filtros-no-endereco.ts";
import { pedirFiltro } from "../app/pedido-de-filtro.ts";
import { telaPermitida } from "../lib/navegacao/navegacao.ts";
import type { JanelaDoApp } from "../app/ir-para-tela.ts";

/*
  "Ver em Relatórios": o atalho das telas de origem (Visão geral, Lista de
  aprovados) para o relatório que saiu delas, já no recorte — o montador com
  a Visão geral como está, o Resumo por cargo e status nos editais
  escolhidos. Deixa a busca de Relatórios guardada
  (`/<área>/relatorios?relatorio=…`, src/app/filtros-no-endereco.ts) e
  navega; a tela de Relatórios lê o endereço ao abrir pela primeira vez e,
  já montada, o pedido de filtro (src/app/pedido-de-filtro.ts). Sem o recurso da tela
  (`paineis_dados`), o botão não aparece.
*/

type PerfilDaNavegacao = Parameters<typeof telaPermitida>[1];

const VIEW_DOS_RELATORIOS = "paineis-de-dados";

export function abrirEmRelatorios(
  relatorio: IdQueAbre,
  extras: { origem?: OrigemDoRecorte; editais?: readonly string[] } = {},
  irPara: (view: string) => unknown = (view) =>
    (globalThis.window as JanelaDoApp | undefined)?.navigate?.(view),
) {
  // O endereço com que a tela abre (primeira vez) e o pedido (tela já montada).
  guardarFiltrosDaTela(
    VIEW_DOS_RELATORIOS,
    buscaDoRelatorio(relatorio, extras),
  );
  pedirFiltro(VIEW_DOS_RELATORIOS, {
    relatorio,
    origem: extras.origem ?? "",
    editais: [...(extras.editais ?? [])],
  });
  irPara(VIEW_DOS_RELATORIOS);
}

export function VerEmRelatorios({
  relatorio,
  origem,
  editais,
  perfil,
  rotulo,
  desativado = false,
  irPara,
}: {
  relatorio: IdQueAbre;
  origem?: OrigemDoRecorte;
  editais?: readonly string[];
  perfil: unknown;
  /** O nome acessível (o texto à vista é sempre "Ver em Relatórios"). */
  rotulo?: string;
  desativado?: boolean;
  /** Abre a tela (nos testes, um falso). */
  irPara?: (view: string) => unknown;
}) {
  if (!telaPermitida(VIEW_DOS_RELATORIOS, perfil as PerfilDaNavegacao))
    return null;
  return (
    <button
      type="button"
      className="btn secondary"
      data-acao="ver-em-relatorios"
      aria-label={rotulo}
      disabled={desativado}
      onClick={() =>
        abrirEmRelatorios(
          relatorio,
          {
            ...(origem ? { origem } : {}),
            ...(editais ? { editais } : {}),
          },
          irPara,
        )
      }
    >
      <i className="fa-solid fa-file-lines" aria-hidden="true" /> Ver em
      Relatórios
    </button>
  );
}
