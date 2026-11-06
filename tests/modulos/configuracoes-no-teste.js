import { criarNavegacao } from "../../src/app/navegacao.ts";
import { criarConfiguracoes } from "../../src/modulos/configuracoes/configuracoes.tsx";
import { montarTelasNoTeste } from "../app/telas-no-teste.ts";

/*
  Configurações como no app: a página (src/app/telas.tsx) com a moldura
  (`criarConfiguracoes`), aberta pela navegação de verdade
  (`/administracao/configuracoes/<seção>`) para um administrador global.
  `secoes` troca as telas próprias (Acessos…) por falsas, se o teste quiser.
*/

const ADMIN = { id: "a", ativo: true, perfil: "admin", admin_global: true };

let navegacaoAtual = null;

export function montarConfiguracoesNoTeste({
  estado,
  imagens,
  secao = "marca",
  secoes = {},
} = {}) {
  if (!document.getElementById("conteudoPrincipal")) {
    const principal = document.createElement("main");
    principal.id = "conteudoPrincipal";
    document.body.append(principal);
  }
  const controlador = criarConfiguracoes({
    estado,
    ...(imagens ? { imagens } : {}),
  });
  const montado = montarTelasNoTeste(
    criarNavegacao({
      janela: { location: { reload() {} } },
      obterPerfil: () => ADMIN,
      confirmarSaida: () => true,
      aplicarAtualizacao: () => false,
    }),
    { config: controlador, ...secoes },
  );
  montado.navegacao.montarMenu();
  montado.navegacao.irPara("config", { secao });
  navegacaoAtual = montado.navegacao;
  return {
    ...controlador,
    navegacao: montado.navegacao,
    raiz: {
      unmount() {
        montado.desmontar();
        navegacaoAtual = null;
      },
    },
  };
}

/** Abre a seção pela navegação (o menu lateral faz o mesmo). */
export function abrirSecaoNoTeste(secao) {
  return navegacaoAtual?.abrirSecao(secao);
}
