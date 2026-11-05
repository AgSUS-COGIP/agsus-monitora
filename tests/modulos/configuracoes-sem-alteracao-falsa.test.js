import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  abrirSecaoNoTeste,
  montarConfiguracoesNoTeste,
} from "./configuracoes-no-teste.js";
import { criarEstadoDasConfiguracoes } from "../../src/modulos/configuracoes/estado.ts";

/*
  Configurações sem "alterações não salvas" falsas (relato de 03/11/2026: só
  abrir Comemorações e Acessos e sair, e o Sair avisava alteração não salva).
  Com a configuração publicada como está no banco (o JSON das comemorações
  igual ao de produção), abrir as seções, abrir os detalhes de cada marco e
  passar o foco por todos os campos não cria rascunho.
*/
const COMEMORACOES = JSON.stringify({
  marcos: {
    "edital-concluido": { efeito: "combinado", intensidade: "festa" },
    "fila-zerada": { efeito: "estrelas", intensidade: "festa" },
    "vaga-pronta": { efeito: "confete", intensidade: "festa" },
    "acesso-liberado": { efeito: "coracoes", intensidade: "festa" },
    "fim-do-tour": { efeito: "confete" },
    "fim-da-trilha": { efeito: "baloes" },
  },
  personalizados: [
    {
      id: "pessoal-1",
      nome: "Dia produtivo",
      tipo: "analises-no-dia",
      meta: 200,
      intensidade: "festa",
    },
    {
      id: "pessoal-2",
      nome: "Dia produtivo",
      tipo: "analises-no-dia",
      meta: 300,
      efeito: "estrelas",
      intensidade: "festa",
    },
  ],
});
const PUBLICADO = {
  comemoracoes_marcos: COMEMORACOES,
  auth_google_enabled: "true",
  access_heartbeat_minutos: "5",
  password_reset_flow: "admin",
  page_title: "Saúde Indígena",
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Configurações sem alteração falsa", () => {
  it("abrir Comemorações e Acessos, abrir os detalhes e passar o foco não marca alteração", async () => {
    const estado = criarEstadoDasConfiguracoes({ supabase: () => null });
    let controlador;
    await act(async () => {
      controlador = montarConfiguracoesNoTeste({ estado });
    });
    await act(async () => estado.definirValoresCarregados(PUBLICADO));
    for (const secao of ["comemoracoes", "acessos"]) {
      await act(async () => abrirSecaoNoTeste(secao));
      for (const botao of document.querySelectorAll(".comemoracoes-detalhes")) {
        await act(async () => botao.click());
        for (const campo of document.querySelectorAll(
          ".comemoracoes input, .comemoracoes select",
        ))
          await act(async () => {
            campo.focus();
            campo.blur();
          });
      }
    }
    // Sair da página (a seção fica escondida) também não mexe no rascunho.
    await act(async () =>
      document.getElementById("page-config").classList.remove("active"),
    );
    expect(estado.temAlteracoes()).toBe(false);
    expect(estado.confirmarSaida(() => false)).toBe(true);
    controlador.raiz.unmount();
  }, 60_000);
});
