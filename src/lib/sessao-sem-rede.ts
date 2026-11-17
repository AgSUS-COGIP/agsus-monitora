/*
  Entrar e seguir no Yeendé sem rede (decisão do produto de 17/11/2026: até
  48 h, para o trabalho de campo).

  ## O problema

  O token de acesso vence em 1 h. Vencido e sem rede, a renovação falha e o
  `getSession()` do auth-js devolve `session: null`, embora a sessão continue
  guardada (ele só a apaga quando o servidor a recusa). Cada tela que pede o
  usuário ao `getSession()` dizia "Sessão não localizada", e abrir o app sem
  rede caía no login. E a entrada sempre consulta o perfil no banco: sem rede,
  "Não foi possível verificar suas permissões".

  ## O que este módulo decide

  - `sessaoSemRede`: quando a leitura da sessão falhou **por falta de rede**, a
    sessão guardada serve, até `LIMITE_SEM_REDE_MS` depois de o token vencer.
    Recusa do servidor, sessão ausente ou erro que não é de rede seguem como
    vieram. Com a rede de volta, o auth-js renova o token e tudo segue igual.
  - `PERFIL_GUARDADO` (src/lib/perfil-sem-rede.ts): o tipo da cópia do perfil,
    gravada a cada leitura do perfil com rede e lida só quando a leitura falha
    por falta de rede. Vale 48 h, como as outras cópias, e sai com elas (Sair,
    "Limpar sessão", acesso perdido, outra pessoa no navegador). Quando a rede
    volta, o perfil é conferido no banco: sem acesso, o app fecha e as cópias
    saem (src/app/sessao.ts).

  O risco aceito: quem teve o acesso revogado ainda vê, sem rede, o que já
  estava no aparelho, por até 48 h.
*/
/*
  Só o classificador da biblioteca (e não src/lib/sessao.ts): este arquivo baixa
  sob demanda, quando a leitura da sessão falha, e não pode puxar outro pedaço
  para a entrada.
*/
import { isAuthRetryableFetchError } from "@supabase/supabase-js";

/* Falha de transporte: a biblioteca diz, ou o fetch rejeitou (TypeError). */
const ehFalhaDeRede = (erro: unknown) =>
  isAuthRetryableFetchError(erro) ||
  (erro as { name?: unknown } | null)?.name === "TypeError";

export const LIMITE_SEM_REDE_MS = 48 * 60 * 60 * 1000;

/** A resposta do `getSession()` do auth-js, na parte que importa aqui. */
export interface LeituraDaSessaoDoAuth<S> {
  data: { session: S | null };
  error: unknown;
}

/** A sessão guardada pelo auth-js (o JSON do armazenamento), lida por partes. */
interface SessaoGuardada {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_at?: unknown;
  user?: { id?: unknown } | null;
}

function lerGuardada(texto: unknown): SessaoGuardada | null {
  if (typeof texto !== "string" || !texto) return null;
  try {
    const lida: unknown = JSON.parse(texto);
    return lida && typeof lida === "object" ? (lida as SessaoGuardada) : null;
  } catch {
    return null;
  }
}

/**
 * A leitura da sessão, ou a sessão guardada quando a leitura falhou por falta
 * de rede (erro transitório ou o navegador sem conexão) e o token venceu há
 * menos de 48 h. `guardada` é o texto que o auth-js gravou no armazenamento.
 */
export function sessaoSemRede<S>(
  resposta: LeituraDaSessaoDoAuth<S>,
  {
    guardada,
    agora,
    online,
  }: { guardada: unknown; agora: number; online: boolean },
): LeituraDaSessaoDoAuth<S> {
  if (resposta?.data?.session) return resposta;
  const erro = resposta?.error;
  // Sem erro, a leitura funcionou: não há sessão (saiu ou nunca entrou).
  if (!erro) return resposta;
  if (online && !ehFalhaDeRede(erro)) return resposta;
  const sessao = lerGuardada(guardada);
  const venceEm = Number(sessao?.expires_at) * 1000;
  if (
    !sessao ||
    typeof sessao.access_token !== "string" ||
    typeof sessao.refresh_token !== "string" ||
    !sessao.user?.id ||
    !Number.isFinite(venceEm) ||
    agora - venceEm > LIMITE_SEM_REDE_MS
  )
    return resposta;
  return { data: { session: sessao as S }, error: null };
}
