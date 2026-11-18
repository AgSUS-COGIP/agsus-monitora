import { AuthRetryableFetchError, AuthApiError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  LIMITE_SEM_REDE_MS,
  sessaoSemRede,
} from "../src/lib/sessao/sessao-sem-rede.ts";
import {
  PERFIL_GUARDADO,
  perfilParaGuardar,
} from "../src/lib/sessao/perfil-sem-rede.ts";

/*
  Sem rede e com o token vencido, o auth-js devolve `session: null` embora a
  sessão continue guardada. Até 48 h depois de vencer, a guardada serve; erro
  que não é de rede, ou leitura sem erro (não há sessão), seguem como vieram.
*/

const VENCE_EM = 1_800_000_000; // segundos, como o auth-js grava
const GUARDADA = JSON.stringify({
  access_token: "token-vencido",
  refresh_token: "renovacao",
  expires_at: VENCE_EM,
  user: { id: "u1" },
});
const SEM_SESSAO = (error: unknown) => ({ data: { session: null }, error });
const SEM_REDE = new AuthRetryableFetchError("Failed to fetch", 0);
const depoisDeVencer = (ms: number) => VENCE_EM * 1000 + ms;

describe("a sessão guardada sem rede", () => {
  it("serve quando a renovação falhou por falta de rede, até 48 h depois de vencer", () => {
    const lida = sessaoSemRede(SEM_SESSAO(SEM_REDE), {
      guardada: GUARDADA,
      agora: depoisDeVencer(LIMITE_SEM_REDE_MS),
      online: true,
    });
    expect(lida.error).toBeNull();
    expect(lida.data.session).toMatchObject({ user: { id: "u1" } });

    expect(
      sessaoSemRede(SEM_SESSAO(SEM_REDE), {
        guardada: GUARDADA,
        agora: depoisDeVencer(LIMITE_SEM_REDE_MS + 1),
        online: true,
      }).data.session,
    ).toBeNull();
  });

  it("serve com o navegador sem conexão, qualquer que seja o erro", () => {
    expect(
      sessaoSemRede(SEM_SESSAO(new Error("qualquer")), {
        guardada: GUARDADA,
        agora: depoisDeVencer(1),
        online: false,
      }).data.session,
    ).not.toBeNull();
  });

  it("não serve quando o servidor recusou, quando não há erro ou sem sessão guardada", () => {
    const recusa = new AuthApiError(
      "Invalid Refresh Token",
      400,
      "refresh_token_not_found",
    );
    const opcoes = {
      guardada: GUARDADA,
      agora: depoisDeVencer(1),
      online: true,
    };
    expect(sessaoSemRede(SEM_SESSAO(recusa), opcoes).data.session).toBeNull();
    expect(sessaoSemRede(SEM_SESSAO(null), opcoes).data.session).toBeNull();
    expect(
      sessaoSemRede(SEM_SESSAO(SEM_REDE), { ...opcoes, guardada: null }).data
        .session,
    ).toBeNull();
    expect(
      sessaoSemRede(SEM_SESSAO(SEM_REDE), { ...opcoes, guardada: "{lixo" }).data
        .session,
    ).toBeNull();
    expect(
      sessaoSemRede(SEM_SESSAO(SEM_REDE), {
        ...opcoes,
        guardada: JSON.stringify({ access_token: "t", expires_at: VENCE_EM }),
      }).data.session,
    ).toBeNull();
  });

  it("a leitura que já trouxe a sessão fica como veio", () => {
    const resposta = { data: { session: { user: { id: "u9" } } }, error: null };
    expect(
      sessaoSemRede(resposta, { guardada: GUARDADA, agora: 0, online: false }),
    ).toBe(resposta);
  });
});

describe("o perfil guardado para entrar sem rede", () => {
  const contexto = {
    perfil: { id: "p1", nome: "Ana", ativo: true, permissoes: {} },
    painelIds: ["painel-1"],
    contextoCarregado: true,
  };

  it("guarda o perfil, os painéis e o formato", () => {
    const guardado = perfilParaGuardar(contexto);
    expect(guardado).toEqual({ formato: 1, ...contexto });
    expect(PERFIL_GUARDADO.valido(guardado)).toBe(true);
    expect(PERFIL_GUARDADO.esquema(guardado)).toBe(1);
  });

  it("perfil desativado ou sem id não serve", () => {
    expect(
      PERFIL_GUARDADO.valido(
        perfilParaGuardar({ ...contexto, perfil: { id: "p1", ativo: false } }),
      ),
    ).toBe(false);
    expect(
      PERFIL_GUARDADO.valido(perfilParaGuardar({ ...contexto, perfil: {} })),
    ).toBe(false);
  });
});
