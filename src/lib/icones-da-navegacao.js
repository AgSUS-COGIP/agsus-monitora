import {
  CalendarDays,
  ChartColumn,
  ChartLine,
  ChartPie,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  FileText,
  House,
  LogOut,
  MessagesSquare,
  Scale,
  SlidersHorizontal,
  UserCheck,
  Users,
} from "lucide";

/*
  Ícones da barra lateral: Lucide, traço fino, sem quadrado de fundo.

  O resto do sistema continua em Font Awesome (DESIGN.md, "Ícones"). A barra
  lateral é o primeiro lugar migrado porque é onde o peso dos ícones sólidos
  dentro de quadrados mais pesava. Só os ícones importados aqui entram no
  pacote (o Lucide é importado por nome).

  As telas internas têm ícone próprio. Os painéis externos guardam no banco um
  nome do Font Awesome (`TB_PAINEL_EXTERNO.icone`); ele é traduzido pela tabela
  abaixo, e o que não estiver nela vira gráfico de colunas.
*/

const POR_TELA = {
  dashboard: House,
  nucleo: ClipboardCheck,
  calendario: CalendarDays,
  approved: UserCheck,
  config: SlidersHorizontal,
};

const POR_FONT_AWESOME = {
  "fa-chart-pie": ChartPie,
  "fa-chart-line": ChartLine,
  "fa-chart-column": ChartColumn,
  "fa-chart-bar": ChartColumn,
  "fa-chart-simple": ChartColumn,
  "fa-scale-balanced": Scale,
  "fa-gavel": Scale,
  "fa-comments": MessagesSquare,
  "fa-microphone": MessagesSquare,
  "fa-users": Users,
  "fa-user-group": Users,
  "fa-user-check": UserCheck,
  "fa-file-lines": FileText,
  "fa-file-signature": ClipboardCheck,
  "fa-calendar-days": CalendarDays,
  "fa-arrow-up-right-from-square": ExternalLink,
  "fa-gear": SlidersHorizontal,
};

const PADRAO = ChartColumn;

const escaparAtributo = (valor) =>
  String(valor).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

export function svgDoIcone(no, { tamanho = 20, classe = "" } = {}) {
  const filhos = no
    .map(
      ([tag, atributos]) =>
        `<${tag} ${Object.entries(atributos)
          .map(([k, v]) => `${k}="${escaparAtributo(v)}"`)
          .join(" ")}/>`,
    )
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" ` +
    `fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true" focusable="false"${classe ? ` class="${escaparAtributo(classe)}"` : ""}>${filhos}</svg>`
  );
}

export function noDoIconeDaTela(view, iconeFontAwesome = "") {
  if (Object.hasOwn(POR_TELA, view)) return POR_TELA[view];
  const nome = String(iconeFontAwesome || "")
    .split(/\s+/)
    .find((parte) => parte.startsWith("fa-") && parte !== "fa-solid");
  return (nome && POR_FONT_AWESOME[nome]) || PADRAO;
}

export function iconeDaNavegacao(view, iconeFontAwesome = "") {
  return svgDoIcone(noDoIconeDaTela(view, iconeFontAwesome), {
    classe: "nav-svg",
  });
}

export function iconeDeSair() {
  return svgDoIcone(LogOut, { classe: "nav-svg" });
}

export function setaDoGrupo() {
  return svgDoIcone(ChevronDown, { tamanho: 16, classe: "nav-grupo__seta" });
}
