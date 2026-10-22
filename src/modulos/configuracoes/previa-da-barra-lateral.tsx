import { useSyncExternalStore } from "react";
import { usarTemaEscuro } from "../../app/tema.js";
import { PecasDaBarraLateral } from "../../componentes/barra-lateral/barra-lateral.tsx";
import {
  assinarBarraLateral,
  obterEstadoDaBarraLateral,
} from "../../componentes/barra-lateral/estado.ts";
import type { ArvoreDoMenu } from "../../componentes/barra-lateral/tipos.ts";
import { needsLightForeground } from "../../lib/access-branding.js";
import {
  corDaBarraSegura,
  logoDaBarraSegura,
} from "../../lib/marca-da-barra-lateral.js";
import {
  ABAS_DO_MENU,
  AREAS_DO_SISTEMA,
  montarArvoreDoMenu,
} from "../../lib/menu-lateral.ts";
import { MolduraDaPrevia } from "./moldura-da-previa.tsx";
import { SECOES } from "./secoes.js";

/*
  A prévia da barra lateral em Configurações › Marca: a barra de verdade
  (`PecasDaBarraLateral`, com o CSS dela), em miniatura e sem interação,
  dentro de um quadro (`moldura-da-previa.tsx`).

  - Logo e cor: as do rascunho (seção Aparência), antes de salvar, com a
    mesma normalização e o mesmo contraste da barra de verdade
    (`sidebar-branding.js`: `--sidebar-custom-bg` e `sidebar-theme-dark`).
  - Menu, área e página aberta: os da pessoa (o estado da barra). Antes do
    primeiro menu (ou sem nenhum), um conjunto do catálogo de abas, com os
    selos BETA.
  - Tema: o do app (claro ou escuro), que a pessoa escolhe no rodapé da barra.
  - Sempre expandida e no desktop, que é onde a marca aparece inteira.
*/

type Versao = { rotulo: string; valor: string };

const ATIVO_REPRESENTATIVO = Object.freeze({ view: "config", secao: "marca" });
const OPCOES = Object.freeze({ navegar: () => {} });

let arvoreRepresentativa: ArvoreDoMenu | null = null;
/* Todas as abas do catálogo nas três áreas, com Administração. */
function menuRepresentativo(): ArvoreDoMenu {
  arvoreRepresentativa ||= montarArvoreDoMenu({
    permitidas: Object.fromEntries([
      ...ABAS_DO_MENU.map((aba) => [aba.view, true]),
      ["config", true],
    ]),
    areas: AREAS_DO_SISTEMA.map((area) => area.id),
    secoesDeConfiguracao: SECOES,
  });
  return arvoreRepresentativa;
}

export function PreviaDaBarraLateral({
  logo,
  cor,
  versao,
}: {
  logo: string;
  cor: string;
  versao: Versao;
}) {
  const { arvore, ativo } = useSyncExternalStore(
    assinarBarraLateral,
    obterEstadoDaBarraLateral,
  );
  const escuro = usarTemaEscuro();
  const corDaBarra = corDaBarraSegura(cor);
  const temMenu = arvore.length > 0;

  return (
    <div className="previa-barra">
      <MolduraDaPrevia
        titulo="Prévia da barra lateral"
        className="previa-barra__quadro"
        escuro={escuro}
        classesDoCorpo={
          needsLightForeground(corDaBarra) ? ["sidebar-theme-dark"] : []
        }
        variaveis={{ "--sidebar-custom-bg": corDaBarra }}
      >
        <div className="app">
          <aside className="sidebar" aria-label="Navegação principal" inert>
            <PecasDaBarraLateral
              arvore={temMenu ? arvore : menuRepresentativo()}
              ativo={temMenu ? ativo : ATIVO_REPRESENTATIVO}
              opcoes={OPCOES}
              trilho={false}
              recolhida={false}
              gaveta={false}
              previa={{ logo: logoDaBarraSegura(logo), escuro, versao }}
            />
          </aside>
        </div>
      </MolduraDaPrevia>
    </div>
  );
}
