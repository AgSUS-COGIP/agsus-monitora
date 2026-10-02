import {
  ArrowRight,
  ArrowUp,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  CloudUpload,
  Compass,
  Copy,
  createElement,
  DoorOpen,
  Eye,
  FileSearch,
  FileText,
  Flame,
  FolderKanban,
  Funnel,
  Gauge,
  Globe,
  GraduationCap,
  HeartPulse,
  History,
  House,
  Image as Imagem,
  Info,
  Layers,
  LayoutDashboard,
  ListFilter,
  ListOrdered,
  LogIn,
  LogOut,
  Mail,
  Map as Mapa,
  Megaphone,
  Menu,
  MessagesSquare,
  Monitor,
  Moon,
  PanelLeft,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  SquareArrowOutUpRight,
  Sun,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  Type,
  UserRound,
  UserRoundCheck,
  Users,
  UserX,
  Wrench,
  X,
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
/*
  O Lucide não tem ícone de PDF. Este é o `file-type-pdf` do Tabler Icons
  (MIT, tabler.io/icons): mesma grade de 24, traço e pontas redondas, então
  desenha igual aos outros. Mesmo formato de nó do Lucide.
*/
const ArquivoPdf = [
  ["path", { d: "M14 3v4a1 1 0 0 0 1 1h4" }],
  ["path", { d: "M5 12v-7a2 2 0 0 1 2 -2h7l5 5v4" }],
  ["path", { d: "M5 18h1.5a1.5 1.5 0 0 0 0 -3h-1.5v6" }],
  ["path", { d: "M17 18h2" }],
  ["path", { d: "M20 15h-3v6" }],
  ["path", { d: "M11 15v6h1a2 2 0 0 0 2 -2v-2a2 2 0 0 0 -2 -2h-1z" }],
];

export const ICONES = Object.freeze({
  "arrow-right": ArrowRight,
  "arrow-up": ArrowUp,
  "building-2": Building2,
  "calendar-days": CalendarDays,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  circle: Circle,
  "circle-alert": CircleAlert,
  "circle-check": CircleCheck,
  "circle-help": CircleHelp,
  "cloud-upload": CloudUpload,
  compass: Compass,
  copy: Copy,
  "door-open": DoorOpen,
  eye: Eye,
  "file-search": FileSearch,
  "file-text": FileText,
  "file-type-pdf": ArquivoPdf,
  flame: Flame,
  "folder-kanban": FolderKanban,
  funnel: Funnel,
  gauge: Gauge,
  globe: Globe,
  "graduation-cap": GraduationCap,
  "heart-pulse": HeartPulse,
  history: History,
  house: House,
  image: Imagem,
  info: Info,
  layers: Layers,
  "layout-dashboard": LayoutDashboard,
  "list-filter": ListFilter,
  "list-ordered": ListOrdered,
  "log-in": LogIn,
  "log-out": LogOut,
  mail: Mail,
  map: Mapa,
  megaphone: Megaphone,
  menu: Menu,
  "messages-square": MessagesSquare,
  monitor: Monitor,
  moon: Moon,
  "panel-left": PanelLeft,
  pencil: Pencil,
  plus: Plus,
  radio: Radio,
  "refresh-cw": RefreshCw,
  "rotate-ccw": RotateCcw,
  save: Save,
  scale: Scale,
  search: Search,
  settings: Settings,
  "shield-check": ShieldCheck,
  "sliders-horizontal": SlidersHorizontal,
  "square-arrow-out-up-right": SquareArrowOutUpRight,
  sun: Sun,
  "thumbs-down": ThumbsDown,
  "thumbs-up": ThumbsUp,
  "triangle-alert": TriangleAlert,
  type: Type,
  "user-round": UserRound,
  "user-round-check": UserRoundCheck,
  "user-x": UserX,
  users: Users,
  wrench: Wrench,
  x: X,
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
