/*
  As seções de Configurações, como no SIGAV: a ordem, o ícone e o grupo de
  cada uma no menu. Cada seção é uma rota (`/administracao/configuracoes/<id>`):
  a navegação (src/app/navegacao.ts) escolhe a aberta pelas permissões do
  perfil (`secaoDeConfiguracaoPermitida`), e a página (src/app/telas.tsx)
  desenha o `<article class="config-secao">` de cada uma.

  As seções que publicam pela barra fixa (Marca, Página inicial, Tela de
  acesso, Aparência, Painéis externos, Operação e Comemorações) são da
  moldura (configuracoes.tsx); Acessos, Módulos e abas, Status das
  atualizações e Automação são telas próprias, baixadas na primeira abertura.
*/

import type { SecaoDeConfiguracao } from "./tipos.ts";

/*
  Na ordem do menu, em três grupos (`grupo`, desenhados por
  `blocosDaAdministracao` em src/lib/menu-lateral.ts): Aparência, Pessoas e
  acessos, Sistema. Cada seção tem ícone próprio no menu.
*/
export const SECOES: readonly SecaoDeConfiguracao[] = Object.freeze([
  {
    id: "marca",
    rotulo: "Marca",
    icone: "fa-font",
    iconeDoMenu: "type",
    grupo: "aparencia",
    descricao: "Nomes, versão e identidade que aparecem em todo o sistema.",
  },
  {
    id: "inicio",
    rotulo: "Página inicial",
    icone: "fa-bullhorn",
    iconeDoMenu: "house",
    grupo: "aparencia",
    descricao: "Comunicado, títulos e rótulos do painel de monitoramento.",
  },
  {
    id: "acesso",
    rotulo: "Tela de acesso",
    icone: "fa-right-to-bracket",
    iconeDoMenu: "door-open",
    grupo: "aparencia",
    descricao: "Textos do login e regras de autenticação institucional.",
  },
  {
    id: "aparencia",
    rotulo: "Aparência",
    icone: "fa-image",
    iconeDoMenu: "image",
    grupo: "aparencia",
    descricao: "Arte de fundo, cores e logotipos. Cada cor mostra o contraste.",
  },
  {
    id: "comemoracoes",
    rotulo: "Comemorações",
    icone: "fa-star",
    iconeDoMenu: "party-popper",
    grupo: "aparencia",
    descricao:
      "Os marcos comemorados, o efeito de cada um e o palco para testar.",
  },
  {
    id: "acessos",
    rotulo: "Acessos",
    icone: "fa-user-group",
    iconeDoMenu: "users",
    grupo: "pessoas",
    descricao: "Pessoas, grupos de permissões e coordenações.",
  },
  {
    id: "recursos",
    rotulo: "Painéis externos",
    icone: "fa-tower-broadcast",
    iconeDoMenu: "monitor",
    grupo: "pessoas",
    descricao: "Os painéis externos do menu: título, endereço e situação.",
  },
  {
    id: "modulos",
    rotulo: "Módulos e abas",
    icone: "fa-layer-group",
    iconeDoMenu: "layers",
    grupo: "sistema",
    descricao:
      "Ativar, desativar e pôr em manutenção o sistema, as áreas, as abas e os painéis; selo BETA.",
  },
  {
    id: "operacao",
    rotulo: "Operação",
    icone: "fa-sliders",
    iconeDoMenu: "sliders-horizontal",
    grupo: "sistema",
    descricao: "Versão, atualização em tempo real e histórico de publicações.",
  },
  {
    id: "cargas",
    rotulo: "Status das atualizações",
    icone: "fa-clock",
    iconeDoMenu: "activity",
    grupo: "sistema",
    descricao:
      "Se os dados de cada aba estão atualizados: quando rodou cada atualização, o que atrasou e o que falhou.",
  },
  {
    id: "automacao",
    rotulo: "Automação",
    icone: "fa-power-off",
    iconeDoMenu: "play",
    grupo: "sistema",
    descricao:
      "Ligar e desligar o que roda sozinho em cada aba, com motivo e histórico.",
  },
]);
