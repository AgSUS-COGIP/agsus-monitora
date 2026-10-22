import {
  BarraLateral,
  montarBarraLateral,
} from "../../src/componentes/barra-lateral/barra-lateral.tsx";
import {
  atualizarMenuLateral,
  obterEstadoDaBarraLateral,
  marcarItemAtivoNoMenu,
} from "../../src/componentes/barra-lateral/estado.ts";
import {
  montarArvoreDoMenu,
  proximoFlutuante,
  FLUTUANTE_FECHADO,
} from "../../src/lib/menu-lateral.ts";

const arvore = montarArvoreDoMenu({
  permitidas: { nucleo: true },
  areas: ["sede"],
});
atualizarMenuLateral(arvore, {
  navegar: (view) => view,
  paginaAtiva: () => true,
});
marcarItemAtivoNoMenu("nucleo");
const barra = <BarraLateral />;
void barra;
montarBarraLateral(document.createElement("aside"));
proximoFlutuante(FLUTUANTE_FECHADO, { tipo: "focar", area: "sede" });

// @ts-expect-error A árvore publicada é somente para leitura.
obterEstadoDaBarraLateral().arvore.push(arvore[0]);
// @ts-expect-error O snapshot só muda por publicação.
obterEstadoDaBarraLateral().ativo = { view: null, secao: null };
const grupoSemView = {
  id: "sede",
  rotulo: "SEDE",
  icone: "building-2",
  itens: [{ rotulo: "Editais", icone: "file-text" }],
};
// @ts-expect-error Os itens do menu precisam de uma view.
atualizarMenuLateral([grupoSemView]);
// @ts-expect-error A guarda de página ativa devolve booleano.
atualizarMenuLateral(arvore, { paginaAtiva: () => "sim" });
// @ts-expect-error Uma ação de foco precisa identificar o grupo.
proximoFlutuante(FLUTUANTE_FECHADO, { tipo: "focar" });
// @ts-expect-error Eventos inexistentes não mudam o painel.
proximoFlutuante(FLUTUANTE_FECHADO, { tipo: "abrir", area: "sede" });
// @ts-expect-error A permissão de uma página é booleana.
montarArvoreDoMenu({ permitidas: { nucleo: "admin" } });
