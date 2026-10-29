/*
  `abrir_lista_aprovados` falsa, montada com as respostas das RPCs de antes
  (como a função do banco: migration 20261029133000). `responder(nome,
  argumentos)` é a resposta de cada RPC antiga no teste, sem passar pelo
  `vi.fn` — o teste vê a chamada única. Pacote sem a função por área
  (PGRST202) é banco antigo: a abertura também não existe.
*/
export async function aberturaPelasChamadasDeAntes(
  responder,
  { p_area: area, p_versao: versao = null, p_com_candidatos = true } = {},
) {
  const erros = {};
  const parte = async (chave, nome, argumentos) => {
    const resposta = await responder(nome, argumentos);
    if (resposta?.error) {
      erros[chave] ??= resposta.error;
      return null;
    }
    return resposta?.data ?? null;
  };
  let pacote = null;
  if (p_com_candidatos) {
    const resposta = await responder("listar_candidatos_aprovados_compacto", {
      p_area: area,
      p_versao: versao,
    });
    if (resposta?.error?.code === "PGRST202")
      return {
        data: null,
        error: { code: "PGRST202", message: "função ausente" },
      };
    if (resposta?.error) erros.pacote = resposta.error;
    else pacote = resposta?.data ?? null;
  }
  const listas = await parte("listas", "listar_listas_aprovados");
  const modelos = await parte("configuracao", "listar_modelos_convocacao");
  const configs = await parte("configuracao", "listar_configuracao_convocacao");
  const anexos = p_com_candidatos
    ? await parte("anexos", "listar_anexos_candidatos_aprovados")
    : null;
  const convocacoes = p_com_candidatos
    ? await parte("convocacoes", "listar_convocacoes_aprovados", {
        p_area: area,
      })
    : null;
  const pendencias = await parte("pendencias", "listar_pendencias_do_edital", {
    p_area: area,
  });
  return {
    data: {
      formato: 1,
      area,
      pacote,
      listas,
      modelos,
      configs,
      anexos,
      convocacoes,
      pendencias,
      erros,
    },
    error: null,
  };
}
