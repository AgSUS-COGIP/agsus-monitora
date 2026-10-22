import type { MunicipioDoMapa } from "./tipos.ts";
/*
  O conteúdo da dica e do popup de um lugar do mapa de Projetos, montado com
  a API do DOM (`textContent`), sem HTML em string: título, uma linha por
  edital (bolinha na cor do projeto, projeto em negrito, edital, vagas,
  lotações) e as contagens das análises. O texto vem de `resumoDoLugar`
  (src/lib/visao-geral-da-area.ts); a caixa é a mesma dos balões da Saúde
  Indígena (`.mapa-si-balao`).
*/
import { resumoDoLugar } from "../../lib/visao-geral-da-area.ts";

function no(documento: Document, tag: string, classe: string, texto?: string) {
  const elemento = documento.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto) elemento.textContent = texto;
  return elemento;
}

/* A bolinha com a cor do projeto (série do design system), decorativa. */
export function corDoProjetoEmElemento(documento: Document, serie: number) {
  const cor = no(
    documento,
    "span",
    `mapa-projeto__cor mapa-projeto__cor--${serie || 0}`,
  );
  cor.setAttribute("aria-hidden", "true");
  return cor;
}

export function balaoDoLugar(documento: Document, ponto: MunicipioDoMapa) {
  const resumo = resumoDoLugar(ponto);
  const caixa = no(documento, "div", "mapa-si-balao mapa-projetos__balao");
  caixa.append(no(documento, "strong", "mapa-si-balao__titulo", resumo.titulo));
  for (const edital of resumo.editais) {
    const linha = no(documento, "span", "mapa-projetos__balao-edital");
    linha.append(
      corDoProjetoEmElemento(documento, edital.serie),
      no(documento, "b", "", edital.projeto),
    );
    if (edital.texto) linha.append(` · ${edital.texto}`);
    caixa.append(linha);
  }
  for (const linha of resumo.linhas)
    caixa.append(no(documento, "span", "", linha));
  return caixa;
}
