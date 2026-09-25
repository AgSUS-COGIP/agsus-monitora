import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Circle,
  createElement,
  FileText,
  Flame,
  FolderKanban,
  HeartPulse,
  LogOut,
  Map as Mapa,
  Menu,
  Moon,
  Settings,
  SquareArrowOutUpRight,
  Sun,
  UserRoundCheck,
} from "lucide";

/*
  Registro único dos ícones Lucide.

  A migração do Font Awesome para o Lucide começa pela barra lateral e pelo
  que é dela: menu inferior do celular, Sair, tema e o botão de recolher. O
  resto do app continua em Font Awesome até cada componente migrar — nunca os
  dois conjuntos dentro do mesmo componente (DESIGN.md, "Ícones").

  Dois jeitos de desenhar, o mesmo registro: `criarIcone` devolve um SVG do DOM
  (código sem framework) e `<Icone>` (`src/componentes/icone.jsx`) desenha o
  mesmo desenho em React.

  Cada ícone é importado pelo nome, e só os usados entram no bundle. Ícone
  novo: importe aqui e registre em `ICONES`. O SVG sai de `createElement`, sem
  `innerHTML`, sempre decorativo — quem nomeia o controle é o texto dele.
*/
export const ICONES = Object.freeze({
  "building-2": Building2,
  "calendar-days": CalendarDays,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-up": ChevronUp,
  circle: Circle,
  "file-text": FileText,
  flame: Flame,
  "folder-kanban": FolderKanban,
  "heart-pulse": HeartPulse,
  "log-out": LogOut,
  map: Mapa,
  menu: Menu,
  moon: Moon,
  settings: Settings,
  "square-arrow-out-up-right": SquareArrowOutUpRight,
  sun: Sun,
  "user-round-check": UserRoundCheck,
});

export const NOMES_DE_ICONES = Object.freeze(Object.keys(ICONES));

export const ICONE_RESERVA = "circle";

export function criarIcone(
  nome,
  { classe = "", tamanho = 18, traco = 1.75 } = {},
) {
  const conhecido = Object.hasOwn(ICONES, nome) ? nome : ICONE_RESERVA;
  const svg = createElement(ICONES[conhecido], {
    width: tamanho,
    height: tamanho,
    "stroke-width": traco,
    class: ["icone", classe].filter(Boolean).join(" "),
    "aria-hidden": "true",
    focusable: "false",
    "data-icone": conhecido,
  });
  return svg;
}
