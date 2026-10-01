/*
  LOCAIS DAS VAGAS DOS EDITAIS DE PROJETOS, LIDOS DOS PDFs

  Dados de TB_LOCAL_VAGA_EDITAL (migration 20261001180000). Cada linha diz onde
  ficam as vagas de um edital e traz a prova: o PDF público (agenciasus.org.br)
  e a página/item de onde foi lida, também no comentário acima dela. O código
  e o nome do município são os do IBGE (API de localidades).

  O edital é procurado em TB_MONITORAMENTO_INDIGENA pelo número
  (private.FC_NUMERO_EDITAL), na área 'projetos' e pela unidade (palavra no nome
  normalizado: caminhoneiro, fronteira, escritorio, mfc, rio doce, cce). Edital
  que não estiver cadastrado não recebe linha — nada falha. Rodar de novo não
  duplica (não insere linha ativa igual: edital, UF, município, cargo e lotação).

  Leitura:
  - Caminhoneiros 96/2025 e 30/2026: quadro do item 4.1 e item 4.2 (UBS móvel
    de cada Ponto de Parada e Descanso). Só a 96/2025 tem vagas imediatas
    (Pindamonhangaba/SP, 4); o resto é cadastro reserva.
  - Saúde nas Fronteiras 23/2025: Anexos 1 a 19 (um posto de trabalho por
    página, com "Local de Atuação"), arquivo de anexos à parte. 29/2025 e
    63/2025 (também da unidade) entram se estiverem cadastrados.
  - Escritório Distrital e Regional 62/2025: quadro do item 1.6, 42 unidades
    de gestão, 179 vagas. Escritório Distrital Yanomami e Leste de Roraima ficam
    em Boa Vista (sede do DSEI, docs/sedes-dos-dsei.md); "Regional do
    Centro-Oeste/MT" e "Regional do Pará/PA" só dizem a UF. 93/2026: SESMT do
    Escritório Distrital de Boa Vista (item 4).
  - MFC 05/2026: só a vaga presencial tem lugar (sede, Brasília/DF); as de
    teletrabalho não têm local e ficam de fora.
  - Rio Doce 04/2026: item 4.2 — Projeto e Interfederativo em Brasília/DF;
    Território em Governador Valadares/MG. Todas cadastro reserva.
  - CCE 97/2025: quadro do item 4.1, por UF (Comissão de Coordenação Estadual);
    o Distrito Federal vira Brasília (um só município).

  Fica para depois: o edital da FCC (MFC) — o lugar sai da escolha de vagas no
  SGP, não do edital — e os editais de Projetos sem PDF neste levantamento.
*/
begin;

with dado (numero, palavra, ibge, municipio, uf, cargo, lotacao, qt, cr, arquivo, pagina, observacao) as (values
  -- Caminhoneiros · edital 30/2026 · https://agenciasus.org.br/shared-files/30904/?Edital-de-Processo-Seletivo-Simplificado-no-30.2026-Atuacao-no-Projeto-Agora-Tem-Especialistas-Caminhoneiros.pdf
  -- Seropédica/RJ: p. 3-5 (quadro do item 4.1) e 5 (item 4.2)
  ('30/2026', 'caminhoneiro', 3305554, 'Seropédica', 'RJ', null, 'UBS móvel Seropédica/RJ', null::integer, 'S', 'https://agenciasus.org.br/shared-files/30904/?Edital-de-Processo-Seletivo-Simplificado-no-30.2026-Atuacao-no-Projeto-Agora-Tem-Especialistas-Caminhoneiros.pdf', '3-5 (quadro do item 4.1) e 5 (item 4.2)', null),
  -- Talismã/TO: p. 3-5 (quadro do item 4.1) e 5 (item 4.2)
  ('30/2026', 'caminhoneiro', 1720978, 'Talismã', 'TO', null, 'UBS móvel Talismã/TO', null, 'S', 'https://agenciasus.org.br/shared-files/30904/?Edital-de-Processo-Seletivo-Simplificado-no-30.2026-Atuacao-no-Projeto-Agora-Tem-Especialistas-Caminhoneiros.pdf', '3-5 (quadro do item 4.1) e 5 (item 4.2)', null),
  -- Palhoça/SC: p. 3-5 (quadro do item 4.1) e 5 (item 4.2)
  ('30/2026', 'caminhoneiro', 4211900, 'Palhoça', 'SC', null, 'UBS móvel Palhoça/SC', null, 'S', 'https://agenciasus.org.br/shared-files/30904/?Edital-de-Processo-Seletivo-Simplificado-no-30.2026-Atuacao-no-Projeto-Agora-Tem-Especialistas-Caminhoneiros.pdf', '3-5 (quadro do item 4.1) e 5 (item 4.2)', null),
  -- Irati/PR: p. 3-5 (quadro do item 4.1) e 5 (item 4.2)
  ('30/2026', 'caminhoneiro', 4110706, 'Irati', 'PR', null, 'UBS móvel Irati/PR', null, 'S', 'https://agenciasus.org.br/shared-files/30904/?Edital-de-Processo-Seletivo-Simplificado-no-30.2026-Atuacao-no-Projeto-Agora-Tem-Especialistas-Caminhoneiros.pdf', '3-5 (quadro do item 4.1) e 5 (item 4.2)', null),
  -- Cubatão/SP: p. 3-5 (quadro do item 4.1) e 5 (item 4.2)
  ('30/2026', 'caminhoneiro', 3513504, 'Cubatão', 'SP', null, 'UBS móvel Cubatão/SP', null, 'S', 'https://agenciasus.org.br/shared-files/30904/?Edital-de-Processo-Seletivo-Simplificado-no-30.2026-Atuacao-no-Projeto-Agora-Tem-Especialistas-Caminhoneiros.pdf', '3-5 (quadro do item 4.1) e 5 (item 4.2)', null),
  -- Caminhoneiros · edital 96/2025 · https://agenciasus.org.br/shared-files/24481/?Edital-de-Processo-Seletivo-Simplificado-no-96-2025-Edital-no-1-%E2%80%93-Abertura.pdf
  -- Pindamonhangaba/SP: p. 4-6 (quadro do item 4.1) e 6 (item 4.2)
  ('96/2025', 'caminhoneiro', 3538006, 'Pindamonhangaba', 'SP', null, 'UBS móvel Pindamonhangaba/SP', 4, 'S', 'https://agenciasus.org.br/shared-files/24481/?Edital-de-Processo-Seletivo-Simplificado-no-96-2025-Edital-no-1-%E2%80%93-Abertura.pdf', '4-6 (quadro do item 4.1) e 6 (item 4.2)', null),
  -- Uruaçu/GO: p. 5-6 (quadro do item 4.1) e 6 (item 4.2)
  ('96/2025', 'caminhoneiro', 5221601, 'Uruaçu', 'GO', null, 'UBS móvel Uruaçu/GO', null, 'S', 'https://agenciasus.org.br/shared-files/24481/?Edital-de-Processo-Seletivo-Simplificado-no-96-2025-Edital-no-1-%E2%80%93-Abertura.pdf', '5-6 (quadro do item 4.1) e 6 (item 4.2)', null),
  -- Ubaporanga/MG: p. 5-6 (quadro do item 4.1) e 6 (item 4.2)
  ('96/2025', 'caminhoneiro', 3170057, 'Ubaporanga', 'MG', null, 'UBS móvel Ubaporanga/MG', null, 'S', 'https://agenciasus.org.br/shared-files/24481/?Edital-de-Processo-Seletivo-Simplificado-no-96-2025-Edital-no-1-%E2%80%93-Abertura.pdf', '5-6 (quadro do item 4.1) e 6 (item 4.2)', null),
  -- Novo Progresso/PA: p. 5-6 (quadro do item 4.1) e 6 (item 4.2)
  ('96/2025', 'caminhoneiro', 1505031, 'Novo Progresso', 'PA', null, 'UBS móvel Novo Progresso/PA', null, 'S', 'https://agenciasus.org.br/shared-files/24481/?Edital-de-Processo-Seletivo-Simplificado-no-96-2025-Edital-no-1-%E2%80%93-Abertura.pdf', '5-6 (quadro do item 4.1) e 6 (item 4.2)', null),
  -- Itatiaia/RJ: p. 5-6 (quadro do item 4.1) e 6 (item 4.2)
  ('96/2025', 'caminhoneiro', 3302254, 'Itatiaia', 'RJ', null, 'UBS móvel Itatiaia/RJ', null, 'S', 'https://agenciasus.org.br/shared-files/24481/?Edital-de-Processo-Seletivo-Simplificado-no-96-2025-Edital-no-1-%E2%80%93-Abertura.pdf', '5-6 (quadro do item 4.1) e 6 (item 4.2)', null),
  -- Saúde nas Fronteiras · edital 23/2025 · https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf
  -- Pacaraima/RR: p. 1 (Anexo 1)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Auxiliar Administrativo', 'Pacaraima/RR', 3, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '1 (Anexo 1)', null),
  -- Boa Vista/RR: p. 2 (Anexo 2)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Assistente de Gestão', 'Boa Vista/RR', 1, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '2 (Anexo 2)', null),
  -- Boa Vista/RR: p. 3 (Anexo 3)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Assistente Social', 'Boa Vista/RR', 4, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '3 (Anexo 3)', null),
  -- Pacaraima/RR: p. 4 (Anexo 4)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Assistente Social', 'Pacaraima/RR', 2, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '4 (Anexo 4)', null),
  -- Boa Vista/RR: p. 5 (Anexo 5)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Enfermeiro', 'Boa Vista/RR', 2, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '5 (Anexo 5)', null),
  -- Pacaraima/RR: p. 6 (Anexo 6)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Enfermeiro', 'Pacaraima/RR', 1, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '6 (Anexo 6)', null),
  -- Pacaraima/RR: p. 7 (Anexo 7)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Enfermeiro - Responsável Técnico', 'Pacaraima/RR', 1, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '7 (Anexo 7)', null),
  -- Boa Vista/RR: p. 8 (Anexo 8)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Gerente de Saúde', 'Boa Vista/RR', 1, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '8 (Anexo 8)', null),
  -- Pacaraima/RR: p. 9 (Anexo 9)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Gerente de Saúde', 'Pacaraima/RR', 1, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '9 (Anexo 9)', null),
  -- Boa Vista/RR: p. 10 (Anexo 10)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Mediador Intercultural', 'Boa Vista/RR', 6, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '10 (Anexo 10)', null),
  -- Pacaraima/RR: p. 11 (Anexo 11)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Mediador Intercultural', 'Pacaraima/RR', 5, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '11 (Anexo 11)', null),
  -- Boa Vista/RR: p. 12 (Anexo 12)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Médico', 'Boa Vista/RR', 2, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '12 (Anexo 12)', null),
  -- Pacaraima/RR: p. 13 (Anexo 13)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Médico', 'Pacaraima/RR', 1, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '13 (Anexo 13)', null),
  -- Boa Vista/RR: p. 14 (Anexo 14)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Nutricionista', 'Boa Vista/RR', 2, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '14 (Anexo 14)', null),
  -- Pacaraima/RR: p. 15 (Anexo 15)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Nutricionista', 'Pacaraima/RR', 1, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '15 (Anexo 15)', null),
  -- Boa Vista/RR: p. 16 (Anexo 16)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Psicólogo', 'Boa Vista/RR', 2, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '16 (Anexo 16)', null),
  -- Pacaraima/RR: p. 17 (Anexo 17)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Psicólogo', 'Pacaraima/RR', 1, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '17 (Anexo 17)', null),
  -- Boa Vista/RR: p. 18 (Anexo 18)
  ('23/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', 'Técnico de enfermagem', 'Boa Vista/RR', 2, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '18 (Anexo 18)', null),
  -- Pacaraima/RR: p. 19 (Anexo 19)
  ('23/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', 'Técnico de enfermagem', 'Pacaraima/RR', 3, 'N', 'https://agenciasus.org.br/wp-content/uploads/2025/06/Anexo_Projeto_Saude_nas_Fronteiras_Anexos_do_Edital_Edital_23_2025.pdf', '19 (Anexo 19)', null),
  -- Saúde nas Fronteiras · edital 63/2025 · https://agenciasus.org.br/shared-files/18695/?Edital-de-Processo-Seletivo-Simplificado-no-632025.pdf
  -- Boa Vista/RR: p. 1-2 (quadro do item 1.4) e 2 (item 1.5)
  ('63/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', null, 'Boa Vista/RR', 8, 'S', 'https://agenciasus.org.br/shared-files/18695/?Edital-de-Processo-Seletivo-Simplificado-no-632025.pdf', '1-2 (quadro do item 1.4) e 2 (item 1.5)', null),
  -- Pacaraima/RR: p. 2 (quadro do item 1.4 e item 1.5)
  ('63/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', null, 'Pacaraima/RR', 8, 'S', 'https://agenciasus.org.br/shared-files/18695/?Edital-de-Processo-Seletivo-Simplificado-no-632025.pdf', '2 (quadro do item 1.4 e item 1.5)', null),
  -- Saúde nas Fronteiras · edital 29/2025 · https://agenciasus.org.br/shared-files/15017/?SEI_0065374_Edital_de_Processo_Seletivo_Simplificado_29-2025.pdf
  -- Boa Vista/RR: p. 2 (quadro do item 1.4 e item 1.5)
  ('29/2025', 'fronteira', 1400100, 'Boa Vista', 'RR', null, 'Boa Vista/RR', 4, 'N', 'https://agenciasus.org.br/shared-files/15017/?SEI_0065374_Edital_de_Processo_Seletivo_Simplificado_29-2025.pdf', '2 (quadro do item 1.4 e item 1.5)', null),
  -- Pacaraima/RR: p. 1-2 (quadro do item 1.4) e 2 (item 1.5)
  ('29/2025', 'fronteira', 1400456, 'Pacaraima', 'RR', null, 'Pacaraima/RR', 8, 'N', 'https://agenciasus.org.br/shared-files/15017/?SEI_0065374_Edital_de_Processo_Seletivo_Simplificado_29-2025.pdf', '1-2 (quadro do item 1.4) e 2 (item 1.5)', null),
  -- Escritório Distrital e Regional · edital 62/2025 · https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf
  -- São Gabriel da Cachoeira/AM: p. 1 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1303809, 'São Gabriel da Cachoeira', 'AM', null, 'Escritório Distrital de São Gabriel da Cachoeira/AM', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '1 (quadro do item 1.6)', null),
  -- Boa Vista/RR: p. 2 (quadro do item 1.6) · sede do DSEI Leste de Roraima (docs/sedes-dos-dsei.md)
  ('62/2025', 'escritorio', 1400100, 'Boa Vista', 'RR', null, 'Escritório Distrital Leste de Roraima/RR', 5, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '2 (quadro do item 1.6)', 'sede do DSEI Leste de Roraima (docs/sedes-dos-dsei.md)'),
  -- Boa Vista/RR: p. 2 (quadro do item 1.6) · sede do DSEI Yanomami (docs/sedes-dos-dsei.md)
  ('62/2025', 'escritorio', 1400100, 'Boa Vista', 'RR', null, 'Escritório Distrital Yanomami', 8, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '2 (quadro do item 1.6)', 'sede do DSEI Yanomami (docs/sedes-dos-dsei.md)'),
  -- Boa Vista/RR: p. 2 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1400100, 'Boa Vista', 'RR', null, 'Escritório Regional de Boa Vista/RR', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '2 (quadro do item 1.6)', null),
  -- Barra do Garças/MT: p. 2-3 (quadro do item 1.6)
  ('62/2025', 'escritorio', 5101803, 'Barra do Garças', 'MT', null, 'Escritório Distrital de Barra do Garças/MT', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '2-3 (quadro do item 1.6)', null),
  -- Campo Grande/MS: p. 3 (quadro do item 1.6)
  ('62/2025', 'escritorio', 5002704, 'Campo Grande', 'MS', null, 'Escritório Distrital de Campo Grande/MS', 5, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '3 (quadro do item 1.6)', null),
  -- Canarana/MT: p. 3 (quadro do item 1.6)
  ('62/2025', 'escritorio', 5102702, 'Canarana', 'MT', null, 'Escritório Distrital de Canarana/MT', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '3 (quadro do item 1.6)', null),
  -- Colíder/MT: p. 3-4 (quadro do item 1.6)
  ('62/2025', 'escritorio', 5103205, 'Colíder', 'MT', null, 'Escritório Distrital de Colíder/MT', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '3-4 (quadro do item 1.6)', null),
  -- São Félix do Araguaia/MT: p. 4 (quadro do item 1.6)
  ('62/2025', 'escritorio', 5107859, 'São Félix do Araguaia', 'MT', null, 'Escritório Distrital de São Félix do Araguaia/MT', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '4 (quadro do item 1.6)', null),
  -- Cuiabá/MT: p. 4 (quadro do item 1.6)
  ('62/2025', 'escritorio', 5103403, 'Cuiabá', 'MT', null, 'Escritório Distrital de Cuiabá/MT', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '4 (quadro do item 1.6)', null),
  -- UF MT: p. 4 (quadro do item 1.6) · o edital só diz a UF
  ('62/2025', 'escritorio', null, null, 'MT', null, 'Escritório Regional do Centro-Oeste/MT', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '4 (quadro do item 1.6)', 'o edital só diz a UF'),
  -- Florianópolis/SC: p. 5 (quadro do item 1.6)
  ('62/2025', 'escritorio', 4205407, 'Florianópolis', 'SC', null, 'Escritório Distrital de Florianópolis/SC', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '5 (quadro do item 1.6)', null),
  -- Curitiba/PR: p. 5 (quadro do item 1.6)
  ('62/2025', 'escritorio', 4106902, 'Curitiba', 'PR', null, 'Escritório Distrital de Curitiba/PR', 5, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '5 (quadro do item 1.6)', null),
  -- Curitiba/PR: p. 5 (quadro do item 1.6)
  ('62/2025', 'escritorio', 4106902, 'Curitiba', 'PR', null, 'Escritório Regional de Curitiba/PR', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '5 (quadro do item 1.6)', null),
  -- Governador Valadares/MG: p. 5-6 (quadro do item 1.6)
  ('62/2025', 'escritorio', 3127701, 'Governador Valadares', 'MG', null, 'Escritório Distrital de Governador Valadares/MG', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '5-6 (quadro do item 1.6)', null),
  -- Atalaia do Norte/AM: p. 6 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1300201, 'Atalaia do Norte', 'AM', null, 'Escritório Distrital de Atalaia do Norte/AM', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '6 (quadro do item 1.6)', null),
  -- Cacoal/RO: p. 6 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1100049, 'Cacoal', 'RO', null, 'Escritório Distrital de Cacoal/RO', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '6 (quadro do item 1.6)', null),
  -- Cruzeiro do Sul/AC: p. 6-7 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1200203, 'Cruzeiro do Sul', 'AC', null, 'Escritório Distrital de Cruzeiro do Sul/AC', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '6-7 (quadro do item 1.6)', null),
  -- Lábrea/AM: p. 7 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1302405, 'Lábrea', 'AM', null, 'Escritório Distrital de Lábrea/AM', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '7 (quadro do item 1.6)', null),
  -- Parintins/AM: p. 7 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1303403, 'Parintins', 'AM', null, 'Escritório Distrital de Parintins/AM', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '7 (quadro do item 1.6)', null),
  -- Porto Velho/RO: p. 7 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1100205, 'Porto Velho', 'RO', null, 'Escritório Distrital de Porto Velho/RO', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '7 (quadro do item 1.6)', null),
  -- Rio Branco/AC: p. 8 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1200401, 'Rio Branco', 'AC', null, 'Escritório Distrital de Rio Branco/AC', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '8 (quadro do item 1.6)', null),
  -- Tabatinga/AM: p. 8 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1304062, 'Tabatinga', 'AM', null, 'Escritório Distrital de Tabatinga/AM', 5, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '8 (quadro do item 1.6)', null),
  -- Tefé/AM: p. 8 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1304203, 'Tefé', 'AM', null, 'Escritório Distrital de Tefé/AM', 5, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '8 (quadro do item 1.6)', null),
  -- Manaus/AM: p. 8-9 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1302603, 'Manaus', 'AM', null, 'Escritório Distrital de Manaus/AM', 5, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '8-9 (quadro do item 1.6)', null),
  -- Manaus/AM: p. 9 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1302603, 'Manaus', 'AM', null, 'Escritório Regional de Manaus/AM', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '9 (quadro do item 1.6)', null),
  -- São Luís/MA: p. 9 (quadro do item 1.6) · o edital escreve "São Luiz"
  ('62/2025', 'escritorio', 2111300, 'São Luís', 'MA', null, 'Escritório Distrital de São Luiz/MA', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '9 (quadro do item 1.6)', 'o edital escreve "São Luiz"'),
  -- Salvador/BA: p. 9 (quadro do item 1.6)
  ('62/2025', 'escritorio', 2927408, 'Salvador', 'BA', null, 'Escritório Distrital de Salvador/BA', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '9 (quadro do item 1.6)', null),
  -- Salvador/BA: p. 10 (quadro do item 1.6)
  ('62/2025', 'escritorio', 2927408, 'Salvador', 'BA', null, 'Escritório Regional de Salvador/BA', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '10 (quadro do item 1.6)', null),
  -- São Paulo/SP: p. 10 (quadro do item 1.6)
  ('62/2025', 'escritorio', 3550308, 'São Paulo', 'SP', null, 'Escritório Regional de São Paulo/SP', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '10 (quadro do item 1.6)', null),
  -- Altamira/PA: p. 10 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1500602, 'Altamira', 'PA', null, 'Escritório Distrital de Altamira/PA', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '10 (quadro do item 1.6)', null),
  -- Macapá/AP: p. 10-11 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1600303, 'Macapá', 'AP', null, 'Escritório Distrital de Macapá/AP', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '10-11 (quadro do item 1.6)', null),
  -- Itaituba/PA: p. 11 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1503606, 'Itaituba', 'PA', null, 'Escritório Distrital de Itaituba/PA', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '11 (quadro do item 1.6)', null),
  -- Palmas/TO: p. 11 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1721000, 'Palmas', 'TO', null, 'Escritório Distrital de Palmas/TO', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '11 (quadro do item 1.6)', null),
  -- Redenção/PA: p. 11-12 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1506138, 'Redenção', 'PA', null, 'Escritório Distrital de Redenção/PA', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '11-12 (quadro do item 1.6)', null),
  -- Belém/PA: p. 12 (quadro do item 1.6)
  ('62/2025', 'escritorio', 1501402, 'Belém', 'PA', null, 'Escritório Distrital de Belém/PA', 5, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '12 (quadro do item 1.6)', null),
  -- UF PA: p. 12 (quadro do item 1.6) · o edital só diz a UF
  ('62/2025', 'escritorio', null, null, 'PA', null, 'Escritório Regional do Pará/PA', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '12 (quadro do item 1.6)', 'o edital só diz a UF'),
  -- Fortaleza/CE: p. 12 (quadro do item 1.6)
  ('62/2025', 'escritorio', 2304400, 'Fortaleza', 'CE', null, 'Escritório Distrital de Fortaleza/CE', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '12 (quadro do item 1.6)', null),
  -- João Pessoa/PB: p. 13 (quadro do item 1.6)
  ('62/2025', 'escritorio', 2507507, 'João Pessoa', 'PB', null, 'Escritório Distrital de João Pessoa/PB', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '13 (quadro do item 1.6)', null),
  -- Maceió/AL: p. 13 (quadro do item 1.6)
  ('62/2025', 'escritorio', 2704302, 'Maceió', 'AL', null, 'Escritório Distrital de Maceió/AL', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '13 (quadro do item 1.6)', null),
  -- Recife/PE: p. 13 (quadro do item 1.6)
  ('62/2025', 'escritorio', 2611606, 'Recife', 'PE', null, 'Escritório Distrital de Recife/PE', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '13 (quadro do item 1.6)', null),
  -- Recife/PE: p. 13-14 (quadro do item 1.6)
  ('62/2025', 'escritorio', 2611606, 'Recife', 'PE', null, 'Escritório Regional do Recife/PE', 4, 'N', 'https://agenciasus.org.br/shared-files/17528/?Edital-no-62-2025.pdf', '13-14 (quadro do item 1.6)', null),
  -- Escritório Distrital e Regional · edital 93/2026 · https://agenciasus.org.br/shared-files/42901/?Edital-Processo-Seletivo-Simplificado-no-932026.pdf
  -- Boa Vista/RR: p. 6 (quadro do item 4)
  ('93/2026', 'escritorio', 1400100, 'Boa Vista', 'RR', 'Analista de Gestão - Médico do Trabalho', 'Escritório Distrital de Boa Vista ERD-YY', 2, 'S', 'https://agenciasus.org.br/shared-files/42901/?Edital-Processo-Seletivo-Simplificado-no-932026.pdf', '6 (quadro do item 4)', null),
  -- Boa Vista/RR: p. 6 (quadro do item 4)
  ('93/2026', 'escritorio', 1400100, 'Boa Vista', 'RR', 'Analista de Gestão - Enfermeiro do Trabalho', 'Escritório Distrital de Boa Vista ERD-YY', 1, 'S', 'https://agenciasus.org.br/shared-files/42901/?Edital-Processo-Seletivo-Simplificado-no-932026.pdf', '6 (quadro do item 4)', null),
  -- Boa Vista/RR: p. 6 (quadro do item 4)
  ('93/2026', 'escritorio', 1400100, 'Boa Vista', 'RR', 'Analista de Gestão - Engenharia do Trabalho', 'Escritório Distrital de Boa Vista ERD-YY', 1, 'S', 'https://agenciasus.org.br/shared-files/42901/?Edital-Processo-Seletivo-Simplificado-no-932026.pdf', '6 (quadro do item 4)', null),
  -- Boa Vista/RR: p. 6 (quadro do item 4)
  ('93/2026', 'escritorio', 1400100, 'Boa Vista', 'RR', 'Técnico de Enfermagem do Trabalho', 'Escritório Distrital de Boa Vista ERD-YY', 1, 'S', 'https://agenciasus.org.br/shared-files/42901/?Edital-Processo-Seletivo-Simplificado-no-932026.pdf', '6 (quadro do item 4)', null),
  -- Boa Vista/RR: p. 6 (quadro do item 4)
  ('93/2026', 'escritorio', 1400100, 'Boa Vista', 'RR', 'Técnico de Segurança do Trabalho', 'Escritório Distrital de Boa Vista ERD-YY', 6, 'S', 'https://agenciasus.org.br/shared-files/42901/?Edital-Processo-Seletivo-Simplificado-no-932026.pdf', '6 (quadro do item 4)', null),
  -- MFC · edital 5/2026 · https://agenciasus.org.br/shared-files/24616/?Edital-N%C2%B0-05-2026-%E2%80%93-Vagas-para-MFC.pdf
  -- Brasília/DF: p. 1 (quadro de vagas do item 1.4) e 2 (item 1.5)
  ('5/2026', 'mfc', 5300108, 'Brasília', 'DF', 'Médico de Família e Comunidade - presencial 40h', 'Sede da AgSUS', 5, 'S', 'https://agenciasus.org.br/shared-files/24616/?Edital-N%C2%B0-05-2026-%E2%80%93-Vagas-para-MFC.pdf', '1 (quadro de vagas do item 1.4) e 2 (item 1.5)', null),
  -- Rio Doce · edital 4/2026 · https://agenciasus.org.br/shared-files/24464/?Edital-de-Processo-Seletivo-Simplificado-no-04-2026-%E2%80%93-Abertura.pdf
  -- Brasília/DF: p. 31-33 (quadro do item 4.1) e 34 (item 4.2)
  ('4/2026', 'rio doce', 5300108, 'Brasília', 'DF', 'Assistentes e Agentes de Projeto e Interfederativos', 'Sede AgSUS', null, 'S', 'https://agenciasus.org.br/shared-files/24464/?Edital-de-Processo-Seletivo-Simplificado-no-04-2026-%E2%80%93-Abertura.pdf', '31-33 (quadro do item 4.1) e 34 (item 4.2)', null),
  -- Governador Valadares/MG: p. 32-33 (quadro do item 4.1, cargos 43, 44 e 65) e 34 (item 4.2)
  ('4/2026', 'rio doce', 3127701, 'Governador Valadares', 'MG', 'Assistentes e Agentes de Território', 'NAAGE/PES-RD - Territórios', null, 'S', 'https://agenciasus.org.br/shared-files/24464/?Edital-de-Processo-Seletivo-Simplificado-no-04-2026-%E2%80%93-Abertura.pdf', '32-33 (quadro do item 4.1, cargos 43, 44 e 65) e 34 (item 4.2)', null),
  -- CCE · edital 97/2025 · https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf
  -- Brasília/DF: p. 4-5 (quadro do item 4.1) · o DF tem um só município
  ('97/2025', 'cce', 5300108, 'Brasília', 'DF', null, 'Comissão de Coordenação Distrital', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '4-5 (quadro do item 4.1)', 'o DF tem um só município'),
  -- UF AC: p. 4-5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'AC', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '4-5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF AL: p. 4-5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'AL', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '4-5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF AP: p. 4-5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'AP', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '4-5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF AM: p. 4-5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'AM', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '4-5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF BA: p. 4-5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'BA', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '4-5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF CE: p. 4-5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'CE', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '4-5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF ES: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'ES', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF GO: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'GO', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF MA: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'MA', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF MT: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'MT', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF MS: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'MS', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF MG: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'MG', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF PA: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'PA', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF PB: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'PB', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF PR: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'PR', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF PE: p. 5 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'PE', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF PI: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'PI', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF RJ: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'RJ', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF RN: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'RN', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF RS: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'RS', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF RO: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'RO', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF RR: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'RR', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF SC: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'SC', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF SP: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'SP', null, 'Comissão de Coordenação Estadual', 2, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF SE: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'SE', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF'),
  -- UF TO: p. 5-6 (quadro do item 4.1) · o edital só diz a UF
  ('97/2025', 'cce', null, null, 'TO', null, 'Comissão de Coordenação Estadual', 1, 'S', 'https://agenciasus.org.br/shared-files/24471/?Edital-de-Processo-Seletivo-Simplificado-no-97-2025-Abertura-conforme-retificacoes.pdf', '5-6 (quadro do item 4.1)', 'o edital só diz a UF')
),
edital as (
  select distinct on (d.numero, d.palavra) d.numero, d.palavra, m.id
    from (select distinct numero, palavra from dado) d
    join public."TB_MONITORAMENTO_INDIGENA" m
      on private."FC_NUMERO_EDITAL"(m.edital) = d.numero
     and m."CO_AREA" = 'projetos'
     and private."FC_TEXTO_BUSCA_RECURSO"(m.unidade) like '%' || d.palavra || '%'
   order by d.numero, d.palavra, m.ativo desc nulls last, m.id
)
insert into public."TB_LOCAL_VAGA_EDITAL" (
  "CO_MONITORAMENTO", "CO_MUNICIPIO_IBGE", "NO_MUNICIPIO", "SG_UF", "NO_CARGO", "NO_LOTACAO", "QT_VAGA",
  "ST_CADASTRO_RESERVA", "TP_ORIGEM", "DS_ARQUIVO_ORIGEM", "DS_PAGINA_ORIGEM", "DS_OBSERVACAO"
)
select e.id, d.ibge, d.municipio, d.uf, d.cargo, d.lotacao, d.qt, d.cr, 'PDF', d.arquivo, d.pagina, d.observacao
  from dado d
  join edital e on e.numero = d.numero and e.palavra = d.palavra
 where not exists (
   select 1
     from public."TB_LOCAL_VAGA_EDITAL" l
    where l."CO_MONITORAMENTO" = e.id
      and l."ST_REGISTRO_ATIVO" = 'S'
      and l."SG_UF" = d.uf
      and coalesce(l."CO_MUNICIPIO_IBGE", 0) = coalesce(d.ibge, 0)
      and coalesce(l."NO_CARGO", '') = coalesce(d.cargo, '')
      and coalesce(l."NO_LOTACAO", '') = coalesce(d.lotacao, '')
 );

commit;
