import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import RegrasDoEdital from "../../src/modulos/regras-do-edital/regras-do-edital.tsx";
import type {
  ClienteDasRegras,
  PropriedadesDasRegras,
} from "../../src/modulos/regras-do-edital/regras-do-edital.tsx";
import type { EtapaDasRegras } from "../../src/lib/regras-do-edital.ts";
import { lojasDasRegras } from "../../src/modulos/regras-do-edital/lojas.ts";
import { esperar } from "./interacoes.ts";

/*
  Monta a página Regras do edital (Editais › Regras do edital) numa etapa,
  com o banco falso do teste: os editores da Avaliação documental e da
  Classificação moram lá desde 03/11/2026; os da Entrevista e da Chamada
  para contratação, desde a parte 2. `aprovados` devolve a loja da Lista
  de aprovados (a Chamada). Devolve a seção, a raiz (para desmontar) e as
  lojas (as mesmas que a página usa).
*/
interface OpcoesDaMontagem {
  supabase: ClienteDasRegras;
  editalId: string;
  etapa: EtapaDasRegras;
  toast?: PropriedadesDasRegras["toast"];
  titulo?: string;
  aprovados?: PropriedadesDasRegras["aprovados"];
}

export async function montarRegrasDoEdital({
  supabase,
  editalId,
  etapa,
  toast,
  titulo = "",
  aprovados = async () => null,
}: OpcoesDaMontagem) {
  const secao = document.createElement("section");
  secao.id = "page-nucleo";
  secao.className = "page active";
  document.body.append(secao);
  const raiz = createRoot(secao);
  let etapaAtual = etapa;
  const desenhar = () =>
    raiz.render(
      createElement(RegrasDoEdital, {
        editalId,
        titulo,
        etapa: etapaAtual,
        supabase,
        toast,
        aoMudarEtapa: (nova: EtapaDasRegras) => {
          etapaAtual = nova;
          desenhar();
        },
        aoVoltar: () => {},
        aprovados,
      }),
    );
  await act(async () => desenhar());
  await esperar();
  return { secao, raiz, lojas: lojasDasRegras(supabase, toast) };
}
