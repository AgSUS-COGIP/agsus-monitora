/*
  O que obter_catalogo_dos_robos devolve logo depois da migration 20261109180000.
  tests/catalogo-dos-robos-migration.test.ts confere que é igual às linhas que a
  migration grava: se o catálogo mudar no banco, este arquivo tem de mudar junto.
*/
const w = (
  workflow: string,
  nome: string,
  chave: string | null,
  disparavel = true,
) => ({
  workflow,
  nome,
  chave,
  disparavel,
});
const t = (
  tarefa: string,
  rotulo: string,
  chave: string | null,
  workflow: string | null = null,
  prefixo = false,
) => ({ tarefa, prefixo, rotulo, chave, workflow });

export const CATALOGO_DOS_ROBOS = {
  schema_version: 1,
  workflows: [
    w("casamento-da-lista.yml", "Casamento da lista de aprovados", null),
    w("classificacao.yml", "Classificação em Python", "classificacao"),
    w("conferencias.yml", "Conferências", "conferencias"),
    w(
      "contratacao-dos-aprovados.yml",
      "Contratado em outra lista",
      "conferencias",
    ),
    w(
      "expurgo-anexos-chat.yml",
      "Expurgo dos anexos do chat (saiu com o chat)",
      null,
      false,
    ),
    w("leitura-de-arquivos.yml", "Leitura dos arquivos", null, false),
    w("pacotes-dos-paineis.yml", "Pacotes dos painéis", "paineis"),
    w("pre-classificacao.yml", "Triagem", "pre_classificacao"),
    w("robo-empregare.yml", "Robô da Empregare", "robo_de_inscricoes"),
    w("sincronizar-entrevistas.yml", "Entrevistas", "entrevistas"),
    w("sincronizar-selecao.yml", "Seleção", "selecao"),
  ],
  tarefas: [
    t(
      "agsus_alinhar_chaves_da_automacao",
      "Alinhar as tarefas com as chaves da automação",
      null,
    ),
    t(
      "agsus_analises_analyze_diario",
      "Estatísticas das tabelas de análises",
      "manutencao",
    ),
    t(
      "agsus_analises_cache_do_painel",
      "Painel de análises (pacote pronto)",
      "paineis",
    ),
    t(
      "agsus_analises_encerrar_inativas",
      "Encerrar cargas de análises paradas",
      "manutencao",
    ),
    t(
      "agsus_analises_limpar_manifesto",
      "Limpeza do manifesto das cargas de análises",
      null,
    ),
    t(
      "agsus_aprovados_cache_por_area",
      "Lista de aprovados (pacote por área)",
      "paineis",
    ),
    t("agsus_cron_limpar_historico", "Limpeza do histórico do pg_cron", null),
    t(
      "agsus_entrevistas_cache_do_painel",
      "Painel de entrevistas (pacote pronto)",
      "paineis",
    ),
    t(
      "agsus_eventos_acesso_limpeza_mensal",
      "Limpeza do registro de acessos",
      "manutencao",
    ),
    t(
      "agsus_fila_estatisticas",
      "Estatísticas da fila da Avaliação documental",
      "manutencao",
    ),
    t(
      "agsus_inativar_listas_vencidas",
      "Inativar as listas de aprovados vencidas",
      null,
    ),
    t(
      "agsus_kpis_do_edital_pela_selecao",
      "KPIs do edital pela Seleção",
      "kpis_do_edital",
    ),
    t(
      "agsus_robo_conferencias",
      "Agenda: pedir as conferências",
      "conferencias",
      "conferencias.yml",
    ),
    t(
      "agsus_robo_conferir_disparos",
      "Agenda: conferir as respostas do GitHub",
      null,
    ),
    t(
      "agsus_robo_inscricoes_",
      "Agenda das inscrições: pedir o robô da Empregare",
      "robo_de_inscricoes",
      "robo-empregare.yml",
      true,
    ),
    t(
      "agsus_robo_sincronizar_entrevistas",
      "Agenda: pedir a carga das Entrevistas",
      "entrevistas",
      "sincronizar-entrevistas.yml",
    ),
    t(
      "agsus_robo_sincronizar_selecao",
      "Agenda: pedir a carga da Seleção",
      "selecao",
      "sincronizar-selecao.yml",
    ),
  ],
};
