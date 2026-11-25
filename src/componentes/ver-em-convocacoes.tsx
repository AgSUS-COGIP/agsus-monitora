import {
  filtrosGuardadosDaTela,
  guardarFiltrosDaTela,
} from "../app/filtros-no-endereco.ts";
import { pedirFiltro } from "../app/pedido-de-filtro.ts";
import type { JanelaDoApp } from "../app/ir-para-tela.ts";
import { usarPerfilDoApp } from "../app/casca/meus-acessos.tsx";
import { canViewEntrevistas } from "../lib/acessos/access-roles.ts";
import {
  buscaDaCentralDasEntrevistas,
  podeAbrirCentralDasEntrevistas,
} from "../lib/aprovados/central-de-convocacoes.ts";
import { telaPermitida } from "../lib/navegacao/navegacao.ts";
import { usarPaginaLigada } from "./usar-pagina-ligada.ts";

/*
  "Ver em Convocações" (#581): o atalho das telas de origem da convocação
  para entrevista (Classificação › Listas, na lista de convocação, e
  Conduzir entrevistas › Preparar › Convocação) para a Central de
  convocações (Lista de aprovados › Convocação › Para entrevistas), já no
  mesmo edital. Só leva: gerar continua na Classificação, convocar em
  Conduzir.

  Como o "Ver em Relatórios": deixa guardada a busca da Lista de aprovados
  (`?aba=convocacao&tipo=entrevista`, a da primeira abertura), pede o
  filtro (a tela já montada e o edital, que vai para a loja de Conduzir) e
  navega. Não aparece para quem não veria a central em "Para entrevistas":
  sem a Lista de aprovados, sem as Entrevistas ou com uma das duas páginas
  desligada na área.
*/

type PerfilDaNavegacao = Parameters<typeof telaPermitida>[1];

const VIEW_DA_CENTRAL = "approved";

export function abrirEmConvocacoes(
  edital: string,
  irPara: (view: string) => unknown = (view) =>
    (globalThis.window as JanelaDoApp | undefined)?.navigate?.(view),
) {
  guardarFiltrosDaTela(
    VIEW_DA_CENTRAL,
    buscaDaCentralDasEntrevistas(filtrosGuardadosDaTela(VIEW_DA_CENTRAL)),
  );
  pedirFiltro(VIEW_DA_CENTRAL, {
    convocacao: "entrevista",
    ...(edital ? { editalId: edital } : {}),
  });
  irPara(VIEW_DA_CENTRAL);
}

export function VerEmConvocacoes({
  edital,
  perfil,
  irPara,
  pequeno = false,
}: {
  /** O id do edital aberto na tela de origem. */
  edital: string;
  /** O perfil (nos testes); sem ele, o de quem entrou. */
  perfil?: unknown;
  /** Abre a tela (nos testes, um falso). */
  irPara?: (view: string) => unknown;
  /** `.btn.small`, como os botões ao lado (Preparar). */
  pequeno?: boolean;
}) {
  const doApp = usarPerfilDoApp();
  const quem = perfil === undefined ? doApp : perfil;
  const aprovadosLigada = usarPaginaLigada(VIEW_DA_CENTRAL);
  const conducaoLigada = usarPaginaLigada("conduzir-entrevistas");
  if (
    !podeAbrirCentralDasEntrevistas({
      verAprovados: telaPermitida(VIEW_DA_CENTRAL, quem as PerfilDaNavegacao),
      aprovadosLigada,
      verEntrevistas: canViewEntrevistas(quem),
      conducaoLigada,
    })
  )
    return null;
  return (
    <button
      type="button"
      className={pequeno ? "btn secondary small" : "btn secondary"}
      data-acao="ver-em-convocacoes"
      onClick={() => abrirEmConvocacoes(edital, irPara)}
    >
      <i className="fa-solid fa-bullhorn" aria-hidden="true" /> Ver em
      Convocações
    </button>
  );
}
