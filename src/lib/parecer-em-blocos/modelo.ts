/* Parecer em blocos: o modelo padrão (textos do simulador) (API pública em ../parecer-em-blocos.ts). */

// ── Modelo de parecer (os textos do simulador) ───────────────────────────

/*
  Cada texto aceita marcadores {nome} (preenchidos como texto puro, uma vez) e
  negrito entre ** **. As referências entram como {ref_<chave>}. Os textos são
  os do simulador, na ordem dele, com as correções de CORRECOES_DO_SIMULADOR.
*/
export const TEXTOS_PADRAO = Object.freeze({
  cabecalho_processo: "PROCESSO DE REFERÊNCIA: {processo}",
  cabecalho_certame:
    "CERTAME: Edital de Processo Seletivo Simplificado nº {edital} – {unidade}",
  cabecalho_candidato: "CANDIDATO(A): {candidato}",
  cabecalho_codigo: "CÓDIGO DO(A) CANDIDATO(A) (EMPREGARE): {codigo}",
  cabecalho_vaga: "VAGA: {vaga}",

  titulo_objeto: "1. OBJETO",
  objeto:
    "**1.1.** O presente parecer tem por objeto a análise do recurso administrativo interposto pelo(a) candidato(a) **{candidato}**, em face do Resultado Preliminar da Etapa de {titulo_etapa} do Processo Seletivo Simplificado regido pelo Edital nº **{edital}** – **{unidade}**.",

  titulo_relatorio: "2. RELATÓRIO",
  relatorio_pedido:
    "**2.1.** O(A) candidato(a) interpôs recurso administrativo solicitando a revisão do resultado preliminar da Etapa de {titulo_etapa}.",
  relatorio_alegacoes:
    "**2.2.** Em suas razões recursais, o(a) recorrente alega, em síntese, que : {alegacoes}.",

  titulo_admissibilidade: "3. ADMISSIBILIDADE",
  admissibilidade_prazo:
    "O recurso foi interposto no período regulamentar previsto de {prazo_de} a {prazo_ate}, tendo sido enviado em {envio_data} às {envio_hora}, interposto {tempestividade}, {atendimento} ao período.",
  admissibilidade_forma:
    "Quanto à forma, o recurso {forma_admissao} por {forma_atendimento} aos requisitos formais de apresentação. Quanto à fundamentação preliminar, {fundamentacao}.",

  titulo_merito: "4. ANÁLISE DE MÉRITO",
  requisitos_atendeu:
    "O(a) candidato(a) **ATENDEU** a todos os requisitos eliminatórios previstos no Edital.",
  requisitos_nao_atendeu:
    "O(a) candidato(a) **NÃO ATENDEU** ao(s) seguinte(s) requisito(s) eliminatório(s) listado(s) abaixo, sendo considerado inapto estando automaticamente desclassificado do processo seletivo:",
  requisito_identificacao:
    "O candidato não apresentou documento de identificação oficial com foto, válido e legível, conforme detalhado no item {ref_identificacao}, alínea “{ref_identificacao_alinea}”.",
  requisito_identificacao_desacordo:
    "Em desacordo com o item {ref_identificacao}, alínea '{ref_identificacao_alinea}', do Edital, que exige a apresentação de Documento de Identidade oficial com foto (frente e verso).",
  requisito_diploma:
    "O candidato não apresentou diploma ou certificado de conclusão conforme exigência da vaga.",
  requisito_experiencia_minima:
    "O candidato não comprovou a experiência profissional mínima de {tempo_minimo} na respectiva área.",
  requisito_experiencia_documentacao:
    "O candidato não comprovou de maneira adequada a documentação de experiência profissional (mínimo de {tempo_minimo} na área).",
  requisitos_nenhum: "[Nenhum critério selecionado]",
  merito_introducao:
    "Após reanálise minuciosa da documentação e das informações submetidas pelo(a) candidato(a) no ato da inscrição, constatou-se o que se segue:",

  formacao_comprovada:
    "Quanto à formação acadêmica complementar, conforme item {ref_formacao}. do edital, constatou-se que o(a) candidato(a) apresentou documentação comprobatória válida para o(s) seguinte(s) item(ns): **{titulos}**, perfazendo o total de **{pontos} ponto(s)** neste requisito.",
  formacao_sem_titulo:
    "Quanto à formação acadêmica complementar, o(a) candidato(a) não selecionou nenhum título válido, resultando na pontuação de **0,0 ponto**.",
  formacao_nao_apresentada:
    "Quanto a formação acadêmica complementar, constatou-se que o(a) candidato(a) não apresentou nenhuma documentação para este requisito, passando a fazer jus da pontuação de **0,0 ponto**.",
  formacao_invalidada:
    "Quanto a formação acadêmica complementar, constatou-se que o(a) candidato(a) não apresentou documentação comprobatória válida, conforme item {ref_formacao} e suas subdivisões, passando a fazer jus da pontuação de **0,0 ponto** em razão de: **{motivo}**.",
  formacao_motivo_frente_verso:
    "não ter apresentado documentação em frente e verso, mesmo que o verso esteja em branco ({ref_formacao_frente_verso}.)",
  formacao_motivo_nato_digital:
    "não ter apresentado documentos nato-digitais ou eletrônicos, obrigatoriamente, anexados com as páginas que contenham os elementos de autenticação, tais como código de verificação, QR Code ou outros mecanismos que possibilitem a validação de sua autenticidade ({ref_formacao_nato_digital}.)",
  formacao_motivo_provavel_formando:
    "ter apresentado declaração de provável formando, o que não é aceito ({ref_formacao_provavel_formando}.)",
  formacao_motivo_nivel:
    "documentação apresentada para formação acadêmica complementar não ser compatível com o nível da vaga pleiteada",
  formacao_motivo_area:
    "documentação apresentada para formação acadêmica complementar não ser compatível com a área de atuação da vaga pleiteada",

  experiencia_nenhuma: "Nenhuma experiência cadastrada.",
  experiencia_nao_atende:
    "Quanto ao pedido relativo à experiência profissional na **{empresa}**, constatou-se que a documentação anexada pelo(a) candidato(a) **não atende** às exigências do item {ref_experiencia} do Edital, visto que:",
  experiencia_total:
    "Quanto ao cômputo geral de experiência profissional/estágio validada nesta análise, referente às experiências nas [{empresas}], desconsiderando eventuais sobreposições temporais, consolida-se o tempo efetivo de **{meses} mês(es) completo(s)**, o que perfaz a pontuação total de **{pontos} ponto(s)** neste requisito.",
  criterio_cel_1:
    "CTPS FÍSICA - O documento apresentado não apresenta todos os dados de identificação do candidato.",
  criterio_cel_2:
    "CTPS FÍSICA - O documento apresentado não contempla as folhas de identificação (foto e dados civis).",
  criterio_cel_3:
    "CTPS FÍSICA/DIGITAL - O documento apresentado não permite aferir as datas de admissão e saída e/ou anotações funcionais atualizadas para título de pontuação.",
  criterio_cel_4:
    "CTPS FÍSICA/DIGITAL - O documento apresentado não contempla de forma expressa o cargo ou função desempenhada.",
  criterio_pub_1:
    "O documento apresentado (declaração oficial órgão público) não encontra-se em papel timbrado.",
  criterio_pub_2:
    "O documento apresentado (declaração oficial órgão público) carece da identificação do emissor ou não possui assinatura física/digital verificável.",
  criterio_pub_3:
    "CTPS FÍSICA/DIGITAL ou DECLARAÇÃO - O documento apresentado carece da identificação do cargo exercido.",
  criterio_pub_4:
    "CTPS FÍSICA/DIGITAL ou DECLARAÇÃO - O documento apresentado não permite aferir as datas de admissão e saída a título de pontuação.",
  criterio_pub_5:
    "CTPS FÍSICA/DIGITAL ou DECLARAÇÃO - O documento apresentado não contempla de forma expressa o cargo ou função desempenhada.",
  criterio_pj_1:
    "O Candidato não apresentou a Cópia do contrato de prestação de serviços.",
  criterio_pj_2:
    "O Candidato não apresentou a declaração da empresa contratante que confirme o tempo de execução e a vigência do instrumento contratual.",
  criterio_pj_3:
    "O Candidato não apresentou a declaração da empresa contratante que confirme a categoria profissional exercida.",
  criterio_pj_4:
    "O Candidato apresentou a declaração da empresa contratante sem a devida identificação/assinatura do responsável legal.",
  criterio_aut_1:
    "O Candidato não apresentou a CAT ou CAT com Registro de Atestado exigível para a categoria profissional.",
  criterio_aut_2:
    "O Candidato não apresentou a cópia do Contrato de Prestação de Serviços ou a Declaração do tomador de serviço não especifica o período de atuação do profissional.",
  criterio_aut_3:
    "O Candidato não apresentou a Declaração do tomador de serviço especificando o período de atuação do profissional.",
  criterio_aut_4:
    "O Candidato não apresentou a Certidão emitida pela Prefeitura Municipal que comprove o tempo de cadastro do candidato como autônomo.",
  criterio_res_1:
    "O documento apresentado não indica expressamente as datas de início e término do programa de Residência para aferição da pontuação por tempo de experiência.",
  criterio_res_2:
    "Conforme o item {ref_formacao_frente_verso} do edital, os documentos de comprovação acadêmica deverão ser inseridos obrigatoriamente em frente e verso. A Residência em Saúde apresentada não foi considerada.",
  criterio_vol_1:
    "A Declaração ou Certificado de atuação Voluntária em Emergências de Saúde Indígena não foi emitido pelos órgãos listados no Edital.",
  criterio_vol_2:
    "O documento de atuação voluntária não detalha o período de atuação (datas de início e término).",
  criterio_vol_3:
    "O documento de atuação voluntária não detalha a função desempenhada.",
  criterio_vol_4:
    "O documento de atuação voluntária não indica de maneira explícita a emergência sanitária/ações contempladas.",
  criterio_out_1:
    "Conforme o quadro ({quadro}) do edital, a experiência apresentada não guarda relação direta com na área à qual concorre.",
  criterio_out_2:
    "Conforme o quadro ({quadro}) do edital, a experiência apresentada na(o) {empresa}, no {cargo} não é compatível com o nível de escolaridade/complexidade exigido para a vaga, que é de Nível {nivel}.",
  criterio_out_3:
    "Conforme o item {ref_experiencia_anterior}. do edital, não foram consideradas as experiências profissionais [{experiencias}], exercidas anteriormente à conclusão da escolaridade exigida para a vaga.",
  criterio_out_4:
    "Nos termos do item {ref_ata_de_defesa} do Edital, não foram contabilizadas para fins de pontuação de títulos atas de defesa de tese/dissertação ou declarações de provável formando.",
  criterio_out_5:
    "Nos termos do item {ref_experiencia_indigena}. do edital, a documentação de {documento} do candidato comprovadamente indígena não estava acompanhada de histórico escolar.",
  criterio_out_6:
    "Nos termos do item {ref_experiencia_indigena}. do edital, a documentação de atuação em prol da comunidade local do candidato comprovadamente indígena não constava validada pela liderança indígena local.",

  pcd: "Quanto à Avaliação Biopsicossocial Documental, constatou-se que **{constatacao}**",
  pcd_sem_deficiencia:
    "o laudo médico apresentado pelo candidato(a) não aponta deficiência que se enquadre na legislação vigente, incluindo a Lei nº 13.146/2015, o Decreto nº 3.298/1999 e demais normas aplicáveis.",
  pcd_em_desacordo:
    "o candidato(a) apresentou documentação em desacordo com as regras de inscrição para a opção de concorrer às vagas reservadas para Pessoas com Deficiência (PcD), não apresentando o laudo médico conforme estabelecido no Anexo {ref_anexo_pcd} do Edital.",
  pcd_sem_documento:
    "o candidato(a) informou se reconhecer como PcD, no entanto, não anexou nenhum documento comprobatório conforme especificação editalícias.",

  indigena_sem_documento:
    "Quanto ao pertencimento étnico, conforme o item {ref_indigena}, alínea “{ref_indigena_alinea}”, do Edital (Se Indígena), constatou-se que o(a) candidato(a) não comprovou o pertencimento por meio de documentação válida, sendo remanejado(a) para a lista de ampla concorrência.",
  indigena_no_recurso:
    'Quanto ao pertencimento étnico, excepcionalmente, conforme previsto no item {ref_indigena_no_recurso} do Edital, permitiu-se à candidatura indígena a entrega de documentos pendentes ou incompletos na fase de recurso (item {ref_indigena}, alínea "{ref_indigena_alinea}"). Assim, diante da documentação apresentada nesta fase recursal, **{situacao}** a documentação apresentada pelo(a) candidato(a), que passa a fazer jus à pontuação de **{pontos} ponto(s)**{complemento}',
  indigena_no_recurso_zerado:
    ", sendo remanejado(a) para a lista de ampla concorrência.",
  indigena_no_recurso_com_pontos: ".",
  indigena_aldeia:
    "Quanto ao pertencimento étnico, conforme o item {ref_indigena}, alínea “{ref_aldeia_alinea}”, do Edital (Se Indígena Residente em Aldeia), o(a) candidato(a) não apresentou **{documento}**, sendo remanejado(a) para a lista de ampla concorrência.",
  indigena_condisi:
    "Quanto ao pertencimento étnico, o(a) candidato(a) teve a Declaração de Pertencimento Étnico contestada pelo CONDISI em razão de **{razao}**. Assim, o(a) candidato(a) teve sua pontuação étnica zerada, sendo remanejado(a) para a lista de ampla concorrência.",

  quilombola:
    "Quanto à análise do pertencimento étnico, o(a) candidato(a) não anexou **{documento}** para acessar às vagas reservadas aos quilombolas, conforme modelo estabelecido no Anexo {ref_anexo_quilombola}.",
  quilombola_aviso:
    "Caso o pertencimento étnico declarado não seja confirmado, o candidato não será eliminado do processo seletivo, sendo automaticamente remanejado para a ampla concorrência.",

  heteroidentificacao:
    "Quanto à análise de pertencimento étnico, o(a) candidato(a) **{situacao}** o procedimento de heteroidentificação, conforme estabelecido no item {ref_heteroidentificacao} do Edital, estando pendente(s) a(s) seguinte(s) documentação(ções): **{documentos}** para fins de procedimento de heteroidentificação, observadas as orientações contidas nos Anexos {ref_anexos_heteroidentificacao}.",
  heteroidentificacao_nenhum: "[nenhum documento selecionado]",

  titulo_conclusao: "5. CONCLUSÃO",
  conclusao_decisao:
    "Diante do exposto, e com base na análise realizada, esta Comissão manifesta-se pelo **{decisao}** do recurso.",
  conclusao_resultado:
    "Em decorrência, deve-se **{acao}** o resultado preliminar devido a exposição de motivos supracitada{retificacao}.",
  conclusao_retificacao:
    ", ajustando a pontuação do candidato **{candidato}** de **{nota_antiga}** para **{nota_nova}**, com a devida reclassificação no Resultado Final da {titulo_etapa}",
  conclusao_final:
    "Por fim, conforme item {ref_recurso_decisao_final}, a resposta ao recurso será considerada como decisão final, consistindo em última instância administrativa, razão pela qual não caberão recursos adicionais.",
  conclusao_intempestiva:
    "Diante do exposto, esta Comissão manifesta-se pelo **NÃO CONHECIMENTO** e consequente **INDEFERIMENTO** do recurso, em razão da intempestividade / vício de forma por descumprimento dos itens {ref_recurso_forma} do Edital nº **{edital}**.",
  conclusao_intempestiva_resultado:
    "Em decorrência, permanece inalterado o resultado preliminar publicado.",

  assinatura_comissao: "Comissão de Seleção",
  assinatura_eletronica: "(assinado eletronicamente)",
  assinatura_de_acordo: "De acordo.",
});

export type ChaveDoTexto = keyof typeof TEXTOS_PADRAO;
export type TextosDoModelo = Record<ChaveDoTexto, string>;

/**
 * Os textos do modelo: o padrão com as diferenças gravadas por cima (como o
 * modelo do espelho de nota). Chave desconhecida ou texto vazio é ignorado.
 */
export function textosDoModelo(
  diferencas?: Partial<Record<string, unknown>> | null,
): TextosDoModelo {
  const textos: TextosDoModelo = { ...TEXTOS_PADRAO };
  for (const [chave, valor] of Object.entries(diferencas ?? {})) {
    if (chave in TEXTOS_PADRAO && typeof valor === "string" && valor.trim())
      textos[chave as ChaveDoTexto] = valor;
  }
  return textos;
}

/**
 * O que o modelo padrão muda no texto do simulador: só palavras em inglês que
 * escaparam no original. O teste de paridade aplica esta lista ao texto do
 * simulador antes de comparar.
 */
export const CORRECOES_DO_SIMULADOR: readonly (readonly [string, string])[] =
  Object.freeze([
    ["modelo established no Anexo", "modelo estabelecido no Anexo"],
    [
      "étnico declared não seja confirmed",
      "étnico declarado não seja confirmado",
    ],
  ]);
