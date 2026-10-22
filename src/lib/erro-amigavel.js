import { ehFalhaTransitoria, ehSessaoEncerrada } from "./sessao.js";

/*
  Traduz o erro numa frase útil — e, acima de tudo, não inventa expiração.

  A linha `msg.includes("JWT") || msg.includes("session")` era a maior fonte de
  "Sessão expirada" falsa do sistema: qualquer resposta com essas letras
  mandava a pessoa entrar de novo — inclusive função ausente no banco. A
  classificação vem do objeto de erro (código, status, tipo), não do texto
  (ver `sessao.js`). As regras por mensagem que sobraram tratam de erros que as
  nossas próprias RPCs emitem com texto que nós mesmos escrevemos.
*/
export function erroAmigavel(error) {
  const msg = error?.message || String(error || "Erro desconhecido");

  if (error?.sessaoEncerrada || ehSessaoEncerrada(error))
    return "Sessão expirada. Faça login novamente.";
  if (error?.falhaTransitoria || ehFalhaTransitoria(error))
    return "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.";

  if (msg.includes("vagas_ociosas"))
    return "Campo calculado protegido pelo banco. Atualize a página e tente novamente.";
  if (msg.includes("Sem permissão para salvar monitoramento indígena"))
    return "Seu usuário não tem permissão para salvar registros de Editais.";
  if (msg.includes("Sem permissão para salvar configurações"))
    return "Seu usuário não tem permissão para alterar configurações do sistema.";
  if (
    msg.includes("permission denied") ||
    msg.includes("violates row-level security")
  )
    return "Permissão insuficiente para esta ação. Verifique o perfil do usuário e as políticas RLS.";
  // PGRST202: função ausente no schema. Não é permissão nem sessão.
  if (error?.code === "PGRST202")
    return "Esta operação depende de uma função que ainda não está publicada no banco. Avise a equipe técnica.";
  return msg;
}
