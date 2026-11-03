import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import RegrasDoEdital from "../../src/modulos/regras-do-edital/regras-do-edital.tsx";
import { lojasDasRegras } from "../../src/modulos/regras-do-edital/lojas.ts";
import { esperar } from "./interacoes.js";

/*
  Monta a página Regras do edital (Editais › Regras do edital) numa etapa,
  com o banco falso do teste: os editores da Avaliação documental e da
  Classificação moram lá desde 03/11/2026. Devolve a seção, a raiz (para
  desmontar) e as lojas (as mesmas que a página usa).
*/
export async function montarRegrasDoEdital({
  supabase,
  editalId,
  etapa,
  toast,
  perfil = { ativo: true, admin_global: true },
  titulo = "",
}) {
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
        perfil,
        toast,
        aoMudarEtapa: (nova) => {
          etapaAtual = nova;
          desenhar();
        },
        aoVoltar: () => {},
        aoEditarChamada: () => {},
      }),
    );
  await act(async () => desenhar());
  await esperar();
  return { secao, raiz, lojas: lojasDasRegras(supabase, toast) };
}
