/*
  Parecer de recurso montado em blocos (protótipo, docs/recursos/parecer-em-blocos.md).

  Espelha o "Sistema automatizado de elaboração de pareceres" que a equipe da
  Saúde Indígena usa (um HTML avulso): o cabeçalho, 1 Objeto, 2 Relatório,
  3 Admissibilidade, 4 Análise de mérito (requisitos eliminatórios e os blocos)
  e 5 Conclusão, com os gestores que assinam. A ordem das seções e os textos
  são os do simulador e viram o MODELO PADRÃO do parecer (TEXTOS_PADRAO), que
  o administrador poderá editar depois, como os modelos de resposta.

  Diferenças de propósito (todas listadas no doc):
  - cada bloco pertence a uma ETAPA (hoje só a Avaliação documental; a
    Entrevista entra depois, com blocos próprios, sem refazer a tela);
  - os números de item e anexo do edital ("6.4, alínea c", "8.12.2"…) não
    ficam no texto: vêm das referências do edital (Regras do edital), com os
    do simulador como padrão (REFERENCIAS_DO_EDITAL);
  - três palavras em inglês que escaparam no simulador (established,
    declared, confirmed) saem corrigidas (CORRECOES_DO_SIMULADOR).

  Sem DOM e sem estado: rascunho (JSON que o banco guardaria por versão) →
  documento (seções, parágrafos e listas, com trechos em negrito) → texto.
  A conta dos meses é a do simulador (calcularMesesCompletos), portada sem
  mudança: meses de calendário completos, sem somar o dia final.
*/

// ── Etapas ───────────────────────────────────────────────────────────────

export type EtapaDoParecer = "avaliacao" | "entrevista";

export interface DefinicaoDaEtapa {
  valor: EtapaDoParecer;
  rotulo: string;
  /** Como o texto chama a etapa ("Etapa de Avaliação Documental e de Títulos"). */
  titulo: string;
  /** A etapa já tem blocos no catálogo. */
  disponivel: boolean;
}

export const ETAPAS_DO_PARECER: readonly DefinicaoDaEtapa[] = Object.freeze([
  {
    valor: "avaliacao",
    rotulo: "Avaliação documental",
    titulo: "Avaliação Documental e de Títulos",
    disponivel: true,
  },
  {
    valor: "entrevista",
    rotulo: "Entrevista",
    titulo: "Entrevista",
    disponivel: false,
  },
]);

export const etapaDoParecer = (valor: unknown): DefinicaoDaEtapa =>
  ETAPAS_DO_PARECER.find((e) => e.valor === valor) ?? ETAPAS_DO_PARECER[0]!;

// ── Referências do edital ────────────────────────────────────────────────

export type ChaveDaReferencia =
  | "identificacao"
  | "identificacao_alinea"
  | "formacao"
  | "formacao_frente_verso"
  | "formacao_nato_digital"
  | "formacao_provavel_formando"
  | "experiencia"
  | "experiencia_quadro"
  | "experiencia_anterior"
  | "experiencia_indigena"
  | "ata_de_defesa"
  | "indigena"
  | "indigena_alinea"
  | "aldeia_alinea"
  | "indigena_no_recurso"
  | "anexo_aldeia"
  | "anexo_pcd"
  | "anexo_quilombola"
  | "heteroidentificacao"
  | "anexos_heteroidentificacao"
  | "recurso_forma"
  | "recurso_decisao_final";

export interface DefinicaoDaReferencia {
  chave: ChaveDaReferencia;
  rotulo: string;
  /** O valor que o simulador escreve no texto. */
  padrao: string;
  /** O tipo de bloco da regra da Avaliação documental cujo item_edital vale aqui. */
  tipoDoBloco?: "TITULOS" | "VINCULOS";
}

export const REFERENCIAS_DO_EDITAL: readonly DefinicaoDaReferencia[] =
  Object.freeze([
    {
      chave: "identificacao",
      rotulo: "Documento de identificação",
      padrao: "6.4",
    },
    {
      chave: "identificacao_alinea",
      rotulo: "Alínea do documento de identificação",
      padrao: "c",
    },
    {
      chave: "formacao",
      rotulo: "Formação acadêmica",
      padrao: "8.12",
      tipoDoBloco: "TITULOS",
    },
    {
      chave: "formacao_frente_verso",
      rotulo: "Frente e verso",
      padrao: "8.12.2",
    },
    {
      chave: "formacao_nato_digital",
      rotulo: "Documento nato-digital",
      padrao: "8.12.2.1",
    },
    {
      chave: "formacao_provavel_formando",
      rotulo: "Declaração de provável formando",
      padrao: "8.12.2.2",
    },
    {
      chave: "experiencia",
      rotulo: "Experiência profissional",
      padrao: "8.15",
      tipoDoBloco: "VINCULOS",
    },
    {
      chave: "experiencia_quadro",
      rotulo: "Quadro de experiência por nível",
      padrao: "8.8",
    },
    {
      chave: "experiencia_anterior",
      rotulo: "Experiência anterior à escolaridade",
      padrao: "8.15.1",
    },
    {
      chave: "experiencia_indigena",
      rotulo: "Estágio e atuação do candidato indígena",
      padrao: "8.15.2.1",
    },
    {
      chave: "ata_de_defesa",
      rotulo: "Ata de defesa e provável formando",
      padrao: "8.14.5.2",
    },
    { chave: "indigena", rotulo: "Pertencimento indígena", padrao: "6.4" },
    {
      chave: "indigena_alinea",
      rotulo: "Alínea do pertencimento indígena",
      padrao: "h",
    },
    {
      chave: "aldeia_alinea",
      rotulo: "Alínea do residente em aldeia",
      padrao: "i",
    },
    {
      chave: "indigena_no_recurso",
      rotulo: "Documento indígena no recurso",
      padrao: "6.5.1",
    },
    {
      chave: "anexo_aldeia",
      rotulo: "Anexo da residência em aldeia",
      padrao: "VI",
    },
    { chave: "anexo_pcd", rotulo: "Anexo do laudo PcD", padrao: "VIII" },
    { chave: "anexo_quilombola", rotulo: "Anexo do quilombola", padrao: "XI" },
    {
      chave: "heteroidentificacao",
      rotulo: "Heteroidentificação",
      padrao: "5.5.1",
    },
    {
      chave: "anexos_heteroidentificacao",
      rotulo: "Anexos da heteroidentificação",
      padrao: "IX e X",
    },
    {
      chave: "recurso_forma",
      rotulo: "Prazo e forma do recurso",
      padrao: "11.1, 11.4, 11.6 e 11.8",
    },
    {
      chave: "recurso_decisao_final",
      rotulo: "Decisão final do recurso",
      padrao: "11.8",
    },
  ]);

export type ReferenciasDoEdital = Record<ChaveDaReferencia, string>;

export const REFERENCIAS_PADRAO: Readonly<ReferenciasDoEdital> = Object.freeze(
  Object.fromEntries(
    REFERENCIAS_DO_EDITAL.map((r) => [r.chave, r.padrao]),
  ) as ReferenciasDoEdital,
);

/** O recorte da regra da Avaliação documental que as referências leem. */
export interface RegraParaOParecer {
  blocos?: readonly {
    codigo: string;
    tipo: string;
    item_edital?: string | null;
    indigena?: number;
    aldeia?: number;
    pontos_por_mes?: number;
    por_nivel?: unknown;
  }[];
  /**
   * PROPOSTA (não existe no banco): as referências do parecer de recurso
   * gravadas nas Regras do edital, só as que diferem do padrão.
   */
  referencias_do_parecer?: Partial<Record<string, string>> | null;
}

export type FonteDaReferencia = "regra" | "bloco" | "padrao";

/**
 * As referências do edital: a gravada nas Regras do edital
 * (referencias_do_parecer), o item_edital do bloco da regra (formação e
 * experiência) ou o padrão do simulador. Devolve também de onde veio cada uma.
 */
export function referenciasDoEdital(
  regra: RegraParaOParecer | null | undefined,
): {
  referencias: ReferenciasDoEdital;
  fontes: Record<ChaveDaReferencia, FonteDaReferencia>;
} {
  const referencias = { ...REFERENCIAS_PADRAO };
  const fontes = Object.fromEntries(
    REFERENCIAS_DO_EDITAL.map((r) => [r.chave, "padrao"]),
  ) as Record<ChaveDaReferencia, FonteDaReferencia>;
  for (const def of REFERENCIAS_DO_EDITAL) {
    const gravada = texto(regra?.referencias_do_parecer?.[def.chave]);
    if (gravada) {
      referencias[def.chave] = gravada;
      fontes[def.chave] = "regra";
      continue;
    }
    if (!def.tipoDoBloco) continue;
    const doBloco = texto(
      regra?.blocos?.find((b) => b.tipo === def.tipoDoBloco)?.item_edital,
    );
    if (doBloco) {
      referencias[def.chave] = doBloco;
      fontes[def.chave] = "bloco";
    }
  }
  return { referencias, fontes };
}

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

// ── Catálogos dos blocos (os do simulador) ───────────────────────────────

export type NivelDaVaga = "superior" | "tecnico" | "medio" | "fundamental";

export const NIVEIS_DA_VAGA: readonly (readonly [NivelDaVaga, string])[] =
  Object.freeze([
    ["superior", "Nível Superior"],
    ["tecnico", "Nível Técnico"],
    ["medio", "Nível Médio"],
    ["fundamental", "Nível Fundamental"],
  ]);

export interface TituloDaFormacao {
  id: string;
  pontos: number;
  descricao: string;
  /** Os títulos da ficha (TituloAcademico) que contam como este. */
  daFicha: readonly string[];
}

/** facDatabase do simulador (pontos cumulativos), com a ligação aos títulos da ficha. */
export const TITULOS_POR_NIVEL: Readonly<
  Record<NivelDaVaga, readonly TituloDaFormacao[]>
> = Object.freeze({
  superior: [
    {
      id: "fac_sup_1",
      pontos: 1.0,
      descricao: "Especialização na área à qual concorre",
      daFicha: ["ESPECIALIZACAO"],
    },
    {
      id: "fac_sup_2",
      pontos: 2.0,
      descricao: "Mestrado/Residência em Saúde",
      daFicha: ["MESTRADO", "RESIDENCIA"],
    },
    {
      id: "fac_sup_3",
      pontos: 3.0,
      descricao: "Doutorado na área à qual concorre",
      daFicha: ["DOUTORADO"],
    },
  ],
  tecnico: [
    {
      id: "fac_tec_1",
      pontos: 2.0,
      descricao: "Especialização Técnica na área à qual concorre",
      daFicha: ["TECNICO"],
    },
    {
      id: "fac_tec_2",
      pontos: 4.0,
      descricao:
        "Formação Acadêmica (graduação/pós-graduação) na área à qual concorre",
      daFicha: [
        "GRADUACAO",
        "ESPECIALIZACAO",
        "RESIDENCIA",
        "MESTRADO",
        "DOUTORADO",
      ],
    },
  ],
  medio: [
    {
      id: "fac_med_1",
      pontos: 1.0,
      descricao: "Formação técnica na área à qual concorre",
      daFicha: ["TECNICO"],
    },
    {
      id: "fac_med_2",
      pontos: 2.0,
      descricao: "Graduação na área a qual concorre",
      daFicha: ["GRADUACAO"],
    },
    {
      id: "fac_med_3",
      pontos: 3.0,
      descricao: "Pós-graduação na área a qual concorre",
      daFicha: ["ESPECIALIZACAO", "RESIDENCIA", "MESTRADO", "DOUTORADO"],
    },
  ],
  fundamental: [
    {
      id: "fac_fun_1",
      pontos: 6.0,
      descricao:
        "Formação Acadêmica (Ensino médio completo/Graduação/Pós-Graduação)",
      daFicha: [
        "ENSINO_MEDIO",
        "GRADUACAO",
        "ESPECIALIZACAO",
        "RESIDENCIA",
        "MESTRADO",
        "DOUTORADO",
      ],
    },
  ],
});

export type MotivoDaFormacao =
  "frente_verso" | "nato_digital" | "provavel_formando" | "nivel" | "area";

/** Motivos da formação invalidada: [código, rótulo curto do simulador]. */
export const MOTIVOS_DA_FORMACAO: readonly (readonly [
  MotivoDaFormacao,
  string,
])[] = Object.freeze([
  [
    "frente_verso",
    "não ter apresentado documentação em frente e verso, mesmo que o verso esteja em branco",
  ],
  [
    "nato_digital",
    "não ter apresentado documentos nato-digitais/eletrônicos anexados com autenticação/QR Code",
  ],
  [
    "provavel_formando",
    "ter apresentado declaração de provável formando, o que não é aceito",
  ],
  [
    "nivel",
    "documentação apresentada não ser compatível com o nível da vaga pleiteada",
  ],
  [
    "area",
    "documentação apresentada não ser compatível com a área de atuação da vaga pleiteada",
  ],
]);

export interface CriterioDaExperiencia {
  codigo: string;
  /** O rótulo da caixa no simulador. */
  rotulo: string;
}

/** Os critérios de indeferimento da experiência, nos grupos do simulador. */
export const CRITERIOS_DA_EXPERIENCIA: readonly {
  grupo: string;
  criterios: readonly CriterioDaExperiencia[];
}[] = Object.freeze([
  {
    grupo: "Empregado celetista",
    criterios: [
      {
        codigo: "cel_1",
        rotulo:
          "CTPS física: não apresenta todos os dados de identificação do candidato",
      },
      {
        codigo: "cel_2",
        rotulo:
          "CTPS física: não contempla as folhas de identificação (foto e dados civis)",
      },
      {
        codigo: "cel_3",
        rotulo:
          "CTPS física/digital: não permite aferir as datas de admissão e saída",
      },
      {
        codigo: "cel_4",
        rotulo:
          "CTPS física/digital: não contempla de forma expressa o cargo ou função",
      },
    ],
  },
  {
    grupo: "Servidor ou empregado de órgão público",
    criterios: [
      { codigo: "pub_1", rotulo: "Declaração não está em papel timbrado" },
      {
        codigo: "pub_2",
        rotulo:
          "Declaração sem identificação do emissor ou assinatura verificável",
      },
      {
        codigo: "pub_3",
        rotulo: "CTPS ou declaração sem identificação do cargo exercido",
      },
      {
        codigo: "pub_4",
        rotulo:
          "CTPS ou declaração não permite aferir as datas de admissão e saída",
      },
      {
        codigo: "pub_5",
        rotulo:
          "CTPS ou declaração não contempla de forma expressa o cargo ou função",
      },
    ],
  },
  {
    grupo: "Prestador de serviços (PJ ou contratado)",
    criterios: [
      {
        codigo: "pj_1",
        rotulo: "Não apresentou a cópia do contrato de prestação de serviços",
      },
      {
        codigo: "pj_2",
        rotulo:
          "Sem declaração da contratante com o tempo de execução e a vigência",
      },
      {
        codigo: "pj_3",
        rotulo: "Sem declaração da contratante com a categoria profissional",
      },
      {
        codigo: "pj_4",
        rotulo:
          "Declaração da contratante sem identificação/assinatura do responsável",
      },
    ],
  },
  {
    grupo: "Profissional autônomo",
    criterios: [
      {
        codigo: "aut_1",
        rotulo: "Não apresentou a CAT ou CAT com Registro de Atestado",
      },
      {
        codigo: "aut_2",
        rotulo:
          "Sem contrato, ou declaração do tomador sem o período de atuação",
      },
      {
        codigo: "aut_3",
        rotulo: "Sem declaração do tomador especificando o período de atuação",
      },
      {
        codigo: "aut_4",
        rotulo:
          "Sem certidão da Prefeitura com o tempo de cadastro como autônomo",
      },
    ],
  },
  {
    grupo: "Residência em saúde",
    criterios: [
      {
        codigo: "res_1",
        rotulo: "Documento sem as datas de início e término da Residência",
      },
      {
        codigo: "res_2",
        rotulo:
          "Documento acadêmico sem frente e verso: Residência não considerada",
      },
    ],
  },
  {
    grupo: "Atuação voluntária em emergências de saúde indígena",
    criterios: [
      {
        codigo: "vol_1",
        rotulo: "Declaração ou certificado não emitido pelos órgãos do edital",
      },
      {
        codigo: "vol_2",
        rotulo: "Não detalha o período de atuação (início e término)",
      },
      { codigo: "vol_3", rotulo: "Não detalha a função desempenhada" },
      {
        codigo: "vol_4",
        rotulo: "Não indica a emergência sanitária/ações contempladas",
      },
    ],
  },
  {
    grupo: "Outros",
    criterios: [
      {
        codigo: "out_1",
        rotulo:
          "A experiência não guarda relação direta com a área (quadro do edital)",
      },
      {
        codigo: "out_2",
        rotulo: "Experiência incompatível com o nível de escolaridade da vaga",
      },
      {
        codigo: "out_3",
        rotulo: "Experiência anterior à conclusão da escolaridade exigida",
      },
      {
        codigo: "out_4",
        rotulo: "Atas de defesa ou declarações de provável formando não contam",
      },
      {
        codigo: "out_5",
        rotulo:
          "Estágio ou extensão do candidato indígena sem histórico escolar",
      },
      {
        codigo: "out_6",
        rotulo:
          "Atuação comunitária do candidato indígena sem validação da liderança",
      },
    ],
  },
]);

const ORDEM_DOS_CRITERIOS = CRITERIOS_DA_EXPERIENCIA.flatMap((g) =>
  g.criterios.map((c) => c.codigo),
);

/** Os quadros do critério "Outros" 1 e 2: [nível, número do quadro]. */
export const QUADROS_DA_EXPERIENCIA: readonly (readonly [string, string])[] =
  Object.freeze([
    ["Superior", "2"],
    ["Técnico", "1"],
    ["Médio", "3"],
  ]);

export const rotuloDoQuadro = (
  nivel: string,
  referencias: ReferenciasDoEdital,
) => {
  const numero = QUADROS_DA_EXPERIENCIA.find(([n]) => n === nivel)?.[1] ?? "2";
  return `${numero} - Nível ${nivel}, do item ${referencias.experiencia_quadro}`;
};

export const TEMPOS_MINIMOS = Object.freeze([
  "3 (três) meses",
  "6 (seis) meses",
]);

export type OpcaoDoPcd = "sem_deficiencia" | "em_desacordo" | "sem_documento";
export const OPCOES_DO_PCD: readonly (readonly [OpcaoDoPcd, string])[] =
  Object.freeze([
    [
      "sem_deficiencia",
      "O laudo médico não aponta deficiência enquadrada na legislação vigente",
    ],
    [
      "em_desacordo",
      "Apresentou documentação em desacordo com o anexo do edital",
    ],
    [
      "sem_documento",
      "Informou se reconhecer como PcD, mas não anexou documento comprobatório",
    ],
  ]);

export const DOCUMENTOS_DA_ALDEIA = Object.freeze([
  "Declaração de Residência em Aldeia",
  "Declaração de Residência em Aldeia assinada pelo candidato indígena",
  "Declaração conforme modelo estabelecido no Anexo {ref_anexo_aldeia}",
]);

export const DOCUMENTOS_DO_QUILOMBOLA = Object.freeze([
  "Declaração emitida e assinada por liderança/associação local",
  "certificado de reconhecimento do território de pertencimento emitido pela Fundação Cultural Palmares (FCP)",
  "Declaração emitida e assinada por liderança/associação local ou certificado de reconhecimento do território de pertencimento emitido pela Fundação Cultural Palmares (FCP)",
]);

// ── O rascunho (o que o banco guardaria em cada versão) ──────────────────

export type CodigoDoBloco =
  | "requisitos"
  | "formacao"
  | "experiencia"
  | "pcd"
  | "indigena"
  | "quilombola"
  | "heteroidentificacao";

export interface DefinicaoDoBloco {
  codigo: CodigoDoBloco;
  etapa: EtapaDoParecer;
  rotulo: string;
  /** O simulador deixa excluir (os requisitos eliminatórios ficam sempre). */
  removivel: boolean;
}

/** O catálogo de blocos por etapa, na ordem em que entram no texto. */
export const CATALOGO_DE_BLOCOS: readonly DefinicaoDoBloco[] = Object.freeze([
  {
    codigo: "requisitos",
    etapa: "avaliacao",
    rotulo: "Requisitos eliminatórios",
    removivel: false,
  },
  {
    codigo: "formacao",
    etapa: "avaliacao",
    rotulo: "Formação acadêmica complementar",
    removivel: true,
  },
  {
    codigo: "experiencia",
    etapa: "avaliacao",
    rotulo: "Experiência profissional, estágio e atuação comunitária",
    removivel: true,
  },
  {
    codigo: "pcd",
    etapa: "avaliacao",
    rotulo: "Avaliação documental de laudo médico (PcD)",
    removivel: true,
  },
  {
    codigo: "indigena",
    etapa: "avaliacao",
    rotulo: "Pertencimento étnico indígena",
    removivel: true,
  },
  {
    codigo: "quilombola",
    etapa: "avaliacao",
    rotulo: "Pertencimento étnico quilombola",
    removivel: true,
  },
  {
    codigo: "heteroidentificacao",
    etapa: "avaliacao",
    rotulo: "Heteroidentificação (pretos e pardos)",
    removivel: true,
  },
]);

export const blocosDaEtapa = (etapa: EtapaDoParecer) =>
  CATALOGO_DE_BLOCOS.filter((b) => b.etapa === etapa);

export interface BlocoDeRequisitos {
  codigo: "requisitos";
  atendeu: boolean;
  identificacao: boolean;
  identificacao_desacordo: boolean;
  diploma: boolean;
  experiencia_minima: boolean;
  experiencia_documentacao: boolean;
  tempo_minimo: string;
  tempo_minimo_documentacao: string;
}

export interface BlocoDeFormacao {
  codigo: "formacao";
  situacao: "comprovada" | "nao_apresentada" | "invalidada";
  nivel: NivelDaVaga;
  titulos: string[];
  motivo: MotivoDaFormacao;
  adicional: string;
}

export interface ExperienciaDoParecer {
  id: string;
  atende: boolean;
  empresa: string;
  inicio: string;
  fim: string;
  criterios: string[];
  quadro_relacao: string;
  quadro_nivel: string;
  empresa_nivel: string;
  cargo_nivel: string;
  nivel_exigido: string;
  experiencias_anteriores: string;
  documento_indigena: "estágios" | "atividades de extensão";
  /** O motivo da ficha, só para quem escreve (não entra no texto). */
  motivo_da_ficha?: string;
}

export interface BlocoDeExperiencia {
  codigo: "experiencia";
  itens: ExperienciaDoParecer[];
  adicional: string;
}

export interface BlocoDePcd {
  codigo: "pcd";
  marcado: boolean;
  opcao: OpcaoDoPcd;
  adicional: string;
}

export interface BlocoIndigena {
  codigo: "indigena";
  sem_documento: boolean;
  no_recurso: boolean;
  no_recurso_acatada: boolean;
  no_recurso_pontos: string;
  aldeia: boolean;
  documento_aldeia: number;
  condisi: boolean;
  razao_condisi: string;
  adicional: string;
}

export interface BlocoQuilombola {
  codigo: "quilombola";
  marcado: boolean;
  documento: number;
  adicional: string;
}

export interface BlocoDeHeteroidentificacao {
  codigo: "heteroidentificacao";
  marcado: boolean;
  parcial: boolean;
  autodeclaracao: boolean;
  foto: boolean;
  video: boolean;
  adicional: string;
}

export type BlocoDoParecer =
  | BlocoDeRequisitos
  | BlocoDeFormacao
  | BlocoDeExperiencia
  | BlocoDePcd
  | BlocoIndigena
  | BlocoQuilombola
  | BlocoDeHeteroidentificacao;

export type Decisao = "INDEFERIMENTO" | "DEFERIMENTO" | "DEFERIMENTO PARCIAL";

export interface Assinatura {
  nome: string;
  cargo: string;
  /** As linhas da lotação embaixo do cargo. */
  lotacao: string[];
  /** "De acordo." antes da assinatura (o segundo gestor). */
  de_acordo: boolean;
}

export interface RascunhoDoParecer {
  etapa: EtapaDoParecer;
  cabecalho: {
    processo: string;
    edital: string;
    unidade: string;
    candidato: string;
    codigo: string;
    vaga: string;
  };
  alegacoes: string;
  admissibilidade: {
    prazo_de: string;
    prazo_ate: string;
    envio_data: string;
    envio_hora: string;
    tempestivo: boolean;
    atende_periodo: boolean;
    admitido: boolean;
    atende_forma: boolean;
    fundamentacao_adequada: boolean;
  };
  blocos: BlocoDoParecer[];
  conclusao: {
    decisao: Decisao;
    retificar: boolean;
    nota_antiga: string;
    nota_nova: string;
  };
  assinaturas: Assinatura[];
  referencias: ReferenciasDoEdital;
  /** Pontos por mês de experiência (o simulador usa 0,2). */
  pontos_por_mes: number;
}

export const DECISOES: readonly Decisao[] = Object.freeze([
  "INDEFERIMENTO",
  "DEFERIMENTO",
  "DEFERIMENTO PARCIAL",
]);

/** Os cargos e lotações que o simulador traz; os nomes ficam para preencher (vêm da configuração da área em produção). */
export const ASSINATURAS_PADRAO: readonly Assinatura[] = Object.freeze([
  {
    nome: "[Nome do(a) primeiro(a) gestor(a)]",
    cargo:
      "Coordenadora de Conformidade dos Processos Seletivos Simplificados da Saúde Indígena",
    lotacao: [
      "Núcleo Especializado de Recrutamento e Seleção para a Saúde Indígena",
      "Unidade de Saúde Indígena",
      "Diretoria de Atenção Integral à Saúde",
    ],
    de_acordo: false,
  },
  {
    nome: "[Nome do(a) segundo(a) gestor(a)]",
    cargo:
      "Gestora do Núcleo Especializado de Recrutamento e Seleção para a Saúde Indígena",
    lotacao: [
      "Unidade de Saúde Indígena",
      "Diretoria de Atenção Integral à Saúde",
    ],
    de_acordo: true,
  },
]);

let sequencia = 0;
export const novoIdDeExperiencia = () =>
  `exp-${Date.now().toString(36)}-${++sequencia}`;

export function novaExperiencia(
  parcial: Partial<ExperienciaDoParecer> = {},
): ExperienciaDoParecer {
  return {
    id: novoIdDeExperiencia(),
    atende: false,
    empresa: "",
    inicio: "",
    fim: "",
    criterios: [],
    quadro_relacao: "Superior",
    quadro_nivel: "Superior",
    empresa_nivel: "",
    cargo_nivel: "",
    nivel_exigido: "Superior",
    experiencias_anteriores: "",
    documento_indigena: "estágios",
    ...parcial,
  };
}

/** Um bloco no estado inicial do simulador (tudo desmarcado). */
export function blocoVazio(codigo: CodigoDoBloco): BlocoDoParecer {
  switch (codigo) {
    case "requisitos":
      return {
        codigo,
        atendeu: true,
        identificacao: false,
        identificacao_desacordo: false,
        diploma: false,
        experiencia_minima: false,
        experiencia_documentacao: false,
        tempo_minimo: TEMPOS_MINIMOS[0]!,
        tempo_minimo_documentacao: TEMPOS_MINIMOS[0]!,
      };
    case "formacao":
      return {
        codigo,
        situacao: "comprovada",
        nivel: "superior",
        titulos: [],
        motivo: "frente_verso",
        adicional: "",
      };
    case "experiencia":
      return { codigo, itens: [novaExperiencia()], adicional: "" };
    case "pcd":
      return {
        codigo,
        marcado: false,
        opcao: "sem_deficiencia",
        adicional: "",
      };
    case "indigena":
      return {
        codigo,
        sem_documento: false,
        no_recurso: false,
        no_recurso_acatada: true,
        no_recurso_pontos: "16",
        aldeia: false,
        documento_aldeia: 0,
        condisi: false,
        razao_condisi: "",
        adicional: "",
      };
    case "quilombola":
      return { codigo, marcado: false, documento: 0, adicional: "" };
    case "heteroidentificacao":
      return {
        codigo,
        marcado: false,
        parcial: false,
        autodeclaracao: true,
        foto: false,
        video: false,
        adicional: "",
      };
  }
}

/** O rascunho em branco, como o simulador abre. */
export function rascunhoVazio(
  etapa: EtapaDoParecer = "avaliacao",
): RascunhoDoParecer {
  return {
    etapa,
    cabecalho: {
      processo: "",
      edital: "",
      unidade: "",
      candidato: "",
      codigo: "",
      vaga: "",
    },
    alegacoes: "",
    admissibilidade: {
      prazo_de: "",
      prazo_ate: "",
      envio_data: "",
      envio_hora: "",
      tempestivo: true,
      atende_periodo: true,
      admitido: true,
      atende_forma: true,
      fundamentacao_adequada: true,
    },
    blocos: blocosDaEtapa(etapa).map((b) => blocoVazio(b.codigo)),
    conclusao: {
      decisao: "INDEFERIMENTO",
      retificar: false,
      nota_antiga: "",
      nota_nova: "",
    },
    assinaturas: ASSINATURAS_PADRAO.map((a) => ({
      ...a,
      lotacao: [...a.lotacao],
    })),
    referencias: { ...REFERENCIAS_PADRAO },
    pontos_por_mes: 0.2,
  };
}

export function blocoDo<C extends CodigoDoBloco>(
  rascunho: RascunhoDoParecer,
  codigo: C,
): Extract<BlocoDoParecer, { codigo: C }> | undefined {
  return rascunho.blocos.find((b) => b.codigo === codigo) as
    Extract<BlocoDoParecer, { codigo: C }> | undefined;
}

// ── Meses de experiência (portado do simulador, sem mudança) ─────────────

/** parseUTCDate do simulador: "AAAA-MM-DD" → Date em UTC (ou null). */
export function dataUtc(texto: string | null | undefined): Date | null {
  if (!texto) return null;
  const partes = texto.split("-");
  if (partes.length !== 3) return null;
  return new Date(
    Date.UTC(
      parseInt(partes[0]!, 10),
      parseInt(partes[1]!, 10) - 1,
      parseInt(partes[2]!, 10),
    ),
  );
}

/**
 * calcularMesesCompletos do simulador: meses de calendário completos de d1 a
 * d2 (o mesmo dia do mês seguinte fecha um mês; no fim do mês, o último dia).
 * O dia final não soma: de 01/01 a 31/01 dá 0 mês.
 */
export function calcularMesesCompletos(
  d1: Date | null,
  d2: Date | null,
): number {
  if (!d1 || !d2 || d2 < d1) return 0;

  let meses =
    (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12 +
    (d2.getUTCMonth() - d1.getUTCMonth());
  const diaOriginal = d1.getUTCDate();

  let tempDate = new Date(
    Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth() + meses, diaOriginal),
  );
  if (
    tempDate.getUTCMonth() !==
    (((d1.getUTCMonth() + meses) % 12) + 12) % 12
  ) {
    tempDate = new Date(
      Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth() + meses + 1, 0),
    );
  }

  if (d2 < tempDate) {
    meses--;
  }

  return meses < 0 ? 0 : meses;
}

/** Os meses de uma experiência (calcularExperienciaIndividual do simulador). */
export function mesesDaExperiencia(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  const d1 = dataUtc(inicio);
  const d2 = dataUtc(fim);
  return d1 && d2 && d2 >= d1 ? calcularMesesCompletos(d1, d2) : 0;
}

/**
 * O total das experiências que atendem, sem as sobreposições
 * (calcularExperienciasEGlobal do simulador): ordena pelo início, une quando
 * o próximo começa até o fim do atual (o dia seguinte NÃO emenda) e soma os
 * meses completos de cada intervalo unido.
 */
export function totalSemSobreposicao(
  itens: readonly { atende: boolean; inicio: string; fim: string }[],
  pontosPorMes = 0.2,
): { meses: number; pontos: number } {
  const intervalos: { start: Date; end: Date }[] = [];
  for (const item of itens) {
    if (!item.atende || !item.inicio || !item.fim) continue;
    const d1 = dataUtc(item.inicio);
    const d2 = dataUtc(item.fim);
    if (d1 && d2 && d2 >= d1) intervalos.push({ start: d1, end: d2 });
  }
  if (intervalos.length === 0) return { meses: 0, pontos: 0 };

  intervalos.sort((a, b) => a.start.getTime() - b.start.getTime());
  const mesclados: { start: Date; end: Date }[] = [];
  let atual = intervalos[0]!;
  for (let i = 1; i < intervalos.length; i++) {
    const proximo = intervalos[i]!;
    if (proximo.start <= atual.end) {
      if (proximo.end > atual.end)
        atual = { start: atual.start, end: proximo.end };
    } else {
      mesclados.push(atual);
      atual = proximo;
    }
  }
  mesclados.push(atual);

  const meses = mesclados.reduce(
    (soma, inter) => soma + calcularMesesCompletos(inter.start, inter.end),
    0,
  );
  return { meses, pontos: meses * pontosPorMes };
}

// ── Formatação (a do simulador) ──────────────────────────────────────────

/** formatDate do simulador: "AAAA-MM-DD" → "DD/MM/AAAA"; vazio → "__/__/____". */
export function dataDoParecer(texto: string | null | undefined): string {
  if (!texto) return "__/__/____";
  const partes = texto.split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : texto;
}

/** Um decimal com vírgula ("toFixed(1).replace('.', ',')"). */
export const pontosDoParecer = (valor: number) =>
  valor.toFixed(1).replace(".", ",");

// ── Composição do documento ──────────────────────────────────────────────

export interface Trecho {
  texto: string;
  negrito?: boolean;
}

export type LinhaDoDocumento =
  | { tipo: "titulo"; trechos: Trecho[] }
  | {
      tipo: "paragrafo";
      trechos: Trecho[];
      estilo?: "adicional" | "aviso" | "cabecalho";
    }
  | { tipo: "lista"; itens: Trecho[][] }
  | {
      tipo: "assinatura";
      linhas: { texto: string; estilo?: "nota" | "nome" | "destaque" }[];
    };

export interface DocumentoDoParecer {
  linhas: LinhaDoDocumento[];
}

type Valores = Record<string, string>;

/**
 * Um texto do modelo em trechos: separa o negrito (** **) ANTES de preencher,
 * para que um valor digitado com ** não vire negrito; marcador sem valor fica
 * como está.
 */
export function preencher(modelo: string, valores: Valores): Trecho[] {
  return modelo
    .split("**")
    .map((parte, indice) => ({
      texto: parte.replace(/\{([a-z0-9_]+)\}/g, (inteiro, nome: string) =>
        Object.prototype.hasOwnProperty.call(valores, nome)
          ? valores[nome]!
          : inteiro,
      ),
      ...(indice % 2 === 1 ? { negrito: true } : {}),
    }))
    .filter((t) => t.texto !== "");
}

const sim = (valor: string, padrao: string) => (valor.trim() ? valor : padrao);

/** Os marcadores comuns: as referências ({ref_…}) e o cabeçalho. */
function valoresBase(rascunho: RascunhoDoParecer): Valores {
  const c = rascunho.cabecalho;
  const refs = Object.fromEntries(
    Object.entries(rascunho.referencias).map(([k, v]) => [`ref_${k}`, v]),
  );
  return {
    ...refs,
    processo: sim(c.processo, "____"),
    edital: sim(c.edital, "____"),
    unidade: sim(c.unidade, "[Selecione o DSEI/CASAI]"),
    candidato: sim(c.candidato, "____"),
    codigo: sim(c.codigo, "____"),
    vaga: sim(c.vaga, "[Selecione a Vaga]"),
    titulo_etapa: etapaDoParecer(rascunho.etapa).titulo,
  };
}

/** Um texto do modelo já preenchido como texto puro (para os valores que entram em outro texto). */
const textoPuro = (modelo: string, valores: Valores) =>
  preencher(modelo, valores)
    .map((t) => t.texto)
    .join("");

function adicional(linhas: LinhaDoDocumento[], texto: string) {
  const limpo = texto.trim();
  if (limpo)
    linhas.push({
      tipo: "paragrafo",
      trechos: [{ texto: limpo }],
      estilo: "adicional",
    });
}

const paragrafo = (modelo: string, valores: Valores): LinhaDoDocumento => ({
  tipo: "paragrafo",
  trechos: preencher(modelo, valores),
});

function linhasDaFormacao(b: BlocoDeFormacao, t: TextosDoModelo, v: Valores) {
  const linhas: LinhaDoDocumento[] = [];
  if (b.situacao === "comprovada") {
    const escolhidos = (TITULOS_POR_NIVEL[b.nivel] ?? []).filter((x) =>
      b.titulos.includes(x.id),
    );
    const total = escolhidos.reduce((s, x) => s + x.pontos, 0);
    linhas.push(
      escolhidos.length
        ? paragrafo(t.formacao_comprovada, {
            ...v,
            titulos: escolhidos
              .map((x) => `${x.descricao} (${pontosDoParecer(x.pontos)} pt)`)
              .join("; "),
            pontos: pontosDoParecer(total),
          })
        : paragrafo(t.formacao_sem_titulo, v),
    );
  } else if (b.situacao === "nao_apresentada") {
    linhas.push(paragrafo(t.formacao_nao_apresentada, v));
  } else {
    const chave = `formacao_motivo_${b.motivo}` as ChaveDoTexto;
    linhas.push(
      paragrafo(t.formacao_invalidada, {
        ...v,
        motivo: textoPuro(t[chave] ?? "", v),
      }),
    );
  }
  adicional(linhas, b.adicional);
  return linhas;
}

function criterioPreenchido(
  codigo: string,
  e: ExperienciaDoParecer,
  t: TextosDoModelo,
  v: Valores,
): Trecho[] {
  const valores: Valores = { ...v };
  if (codigo === "out_1")
    valores.quadro = rotuloDoQuadro(e.quadro_relacao, rascunhoRefs(v));
  if (codigo === "out_2") {
    valores.quadro = rotuloDoQuadro(e.quadro_nivel, rascunhoRefs(v));
    valores.empresa = sim(e.empresa_nivel, "[empresa]");
    valores.cargo = sim(e.cargo_nivel, "[cargo]");
    valores.nivel = e.nivel_exigido;
  }
  if (codigo === "out_3")
    valores.experiencias = sim(e.experiencias_anteriores, "____");
  if (codigo === "out_5") valores.documento = e.documento_indigena;
  return preencher(t[`criterio_${codigo}` as ChaveDoTexto] ?? "", valores);
}

/** As referências de volta dos marcadores {ref_…}. */
function rascunhoRefs(v: Valores): ReferenciasDoEdital {
  return Object.fromEntries(
    REFERENCIAS_DO_EDITAL.map((r) => [
      r.chave,
      v[`ref_${r.chave}`] ?? r.padrao,
    ]),
  ) as ReferenciasDoEdital;
}

function linhasDaExperiencia(
  b: BlocoDeExperiencia,
  t: TextosDoModelo,
  v: Valores,
  pontosPorMes: number,
) {
  const linhas: LinhaDoDocumento[] = [];
  if (!b.itens.length) linhas.push(paragrafo(t.experiencia_nenhuma, v));
  const empresas: string[] = [];
  for (const e of b.itens) {
    const empresa = sim(e.empresa, "[empresa]");
    if (e.atende) {
      empresas.push(empresa);
      continue;
    }
    linhas.push(paragrafo(t.experiencia_nao_atende, { ...v, empresa }));
    const criterios = ORDEM_DOS_CRITERIOS.filter((c) =>
      e.criterios.includes(c),
    );
    if (criterios.length)
      linhas.push({
        tipo: "lista",
        itens: criterios.map((c) => criterioPreenchido(c, e, t, v)),
      });
  }
  if (empresas.length) {
    const total = totalSemSobreposicao(b.itens, pontosPorMes);
    linhas.push(
      paragrafo(t.experiencia_total, {
        ...v,
        empresas: empresas.join(", "),
        meses: String(total.meses),
        pontos: pontosDoParecer(total.pontos),
      }),
    );
  }
  adicional(linhas, b.adicional);
  return linhas;
}

function linhasDoBloco(
  bloco: BlocoDoParecer,
  t: TextosDoModelo,
  v: Valores,
  rascunho: RascunhoDoParecer,
): LinhaDoDocumento[] {
  switch (bloco.codigo) {
    case "requisitos":
      return [];
    case "formacao":
      return linhasDaFormacao(bloco, t, v);
    case "experiencia":
      return linhasDaExperiencia(bloco, t, v, rascunho.pontos_por_mes);
    case "pcd": {
      const linhas: LinhaDoDocumento[] = [];
      if (bloco.marcado)
        linhas.push(
          paragrafo(t.pcd, {
            ...v,
            constatacao: textoPuro(
              t[`pcd_${bloco.opcao}` as ChaveDoTexto] ?? "",
              v,
            ),
          }),
        );
      adicional(linhas, bloco.adicional);
      return linhas;
    }
    case "indigena": {
      const linhas: LinhaDoDocumento[] = [];
      if (bloco.sem_documento)
        linhas.push(paragrafo(t.indigena_sem_documento, v));
      if (bloco.no_recurso)
        linhas.push(
          paragrafo(t.indigena_no_recurso, {
            ...v,
            situacao: bloco.no_recurso_acatada
              ? "foi acatada e validada"
              : "não foi acatada",
            pontos: bloco.no_recurso_pontos,
            complemento:
              bloco.no_recurso_pontos === "0"
                ? t.indigena_no_recurso_zerado
                : t.indigena_no_recurso_com_pontos,
          }),
        );
      if (bloco.aldeia)
        linhas.push(
          paragrafo(t.indigena_aldeia, {
            ...v,
            documento: textoPuro(
              DOCUMENTOS_DA_ALDEIA[bloco.documento_aldeia] ?? "",
              v,
            ),
          }),
        );
      if (bloco.condisi)
        linhas.push(
          paragrafo(t.indigena_condisi, {
            ...v,
            razao: sim(bloco.razao_condisi, "____"),
          }),
        );
      adicional(linhas, bloco.adicional);
      return linhas;
    }
    case "quilombola": {
      const linhas: LinhaDoDocumento[] = [];
      if (bloco.marcado) {
        linhas.push(
          paragrafo(t.quilombola, {
            ...v,
            documento: DOCUMENTOS_DO_QUILOMBOLA[bloco.documento] ?? "",
          }),
        );
        linhas.push({
          tipo: "paragrafo",
          trechos: preencher(`**${t.quilombola_aviso}**`, v),
          estilo: "aviso",
        });
      }
      adicional(linhas, bloco.adicional);
      return linhas;
    }
    case "heteroidentificacao": {
      const linhas: LinhaDoDocumento[] = [];
      if (bloco.marcado) {
        const docs = [
          bloco.autodeclaracao && "autodeclaração",
          bloco.foto && "foto",
          bloco.video && "vídeo",
        ].filter(Boolean) as string[];
        linhas.push(
          paragrafo(t.heteroidentificacao, {
            ...v,
            situacao: bloco.parcial
              ? "comprovou parcialmente"
              : "não comprovou",
            documentos: docs.length
              ? docs.join(", ")
              : t.heteroidentificacao_nenhum,
          }),
        );
      }
      adicional(linhas, bloco.adicional);
      return linhas;
    }
  }
}

function linhasDasAssinaturas(
  rascunho: RascunhoDoParecer,
  t: TextosDoModelo,
): LinhaDoDocumento[] {
  const linhas: LinhaDoDocumento[] = [
    {
      tipo: "assinatura",
      linhas: [{ texto: t.assinatura_comissao, estilo: "destaque" }],
    },
  ];
  for (const a of rascunho.assinaturas) {
    linhas.push({
      tipo: "assinatura",
      linhas: [
        ...(a.de_acordo
          ? [{ texto: t.assinatura_de_acordo, estilo: "destaque" as const }]
          : []),
        { texto: t.assinatura_eletronica, estilo: "nota" as const },
        { texto: a.nome, estilo: "nome" as const },
        { texto: a.cargo },
        ...a.lotacao.map((texto) => ({ texto })),
      ],
    });
  }
  return linhas;
}

/**
 * O documento do parecer, na ordem do simulador: cabeçalho, 1 Objeto,
 * 2 Relatório, 3 Admissibilidade, 4 Análise de mérito (só tempestivo),
 * 5 Conclusão e as assinaturas. Os blocos de mérito entram na ordem do
 * catálogo, só os que estão no rascunho.
 */
export function comporParecer(
  rascunho: RascunhoDoParecer,
  textos: TextosDoModelo = TEXTOS_PADRAO,
): DocumentoDoParecer {
  const t = textos;
  const v = valoresBase(rascunho);
  const a = rascunho.admissibilidade;
  const linhas: LinhaDoDocumento[] = [];
  const titulo = (modelo: string) =>
    linhas.push({ tipo: "titulo", trechos: preencher(modelo, v) });
  const p = (modelo: string, extra: Valores = {}) =>
    linhas.push(paragrafo(modelo, { ...v, ...extra }));

  for (const chave of [
    "cabecalho_processo",
    "cabecalho_certame",
    "cabecalho_candidato",
    "cabecalho_codigo",
    "cabecalho_vaga",
  ] as const)
    linhas.push({
      ...paragrafo(t[chave], v),
      estilo: "cabecalho",
    } as LinhaDoDocumento);

  titulo(t.titulo_objeto);
  p(t.objeto);
  titulo(t.titulo_relatorio);
  p(t.relatorio_pedido);
  p(t.relatorio_alegacoes, {
    alegacoes: sim(
      rascunho.alegacoes,
      "[inserir breve resumo das alegações do candidato]",
    ),
  });

  const tempestivo = a.tempestivo;
  titulo(t.titulo_admissibilidade);
  const valoresDaAdmissibilidade: Valores = {
    prazo_de: dataDoParecer(a.prazo_de),
    prazo_ate: dataDoParecer(a.prazo_ate),
    envio_data: dataDoParecer(a.envio_data),
    envio_hora: a.envio_hora || "--:--",
    tempestividade: tempestivo ? "tempestivamente" : "intempestivamente",
    atendimento: tempestivo && a.atende_periodo ? "atendendo" : "não atendendo",
    forma_admissao: a.admitido ? "foi admitido" : "não foi admitido",
    forma_atendimento: a.atende_forma ? "atender" : "não atender",
    fundamentacao: a.fundamentacao_adequada
      ? "foi admitido por apresentar fundamentação adequada"
      : "não foi admitido por ausência de fundamentação adequada",
  };
  const prazo = preencher(t.admissibilidade_prazo, {
    ...v,
    ...valoresDaAdmissibilidade,
  });
  linhas.push({
    tipo: "paragrafo",
    trechos: tempestivo
      ? [
          ...prazo,
          { texto: " " },
          ...preencher(t.admissibilidade_forma, {
            ...v,
            ...valoresDaAdmissibilidade,
          }),
        ]
      : prazo,
  });

  if (tempestivo) {
    titulo(t.titulo_merito);
    const requisitos = blocoDo(rascunho, "requisitos");
    const atendeu = requisitos?.atendeu !== false;
    if (atendeu) p(t.requisitos_atendeu);
    else {
      p(t.requisitos_nao_atendeu);
      const r = requisitos!;
      const itens: Trecho[][] = [];
      if (r.identificacao) itens.push(preencher(t.requisito_identificacao, v));
      if (r.identificacao_desacordo)
        itens.push(preencher(t.requisito_identificacao_desacordo, v));
      if (r.diploma) itens.push(preencher(t.requisito_diploma, v));
      if (r.experiencia_minima)
        itens.push(
          preencher(t.requisito_experiencia_minima, {
            ...v,
            tempo_minimo: r.tempo_minimo,
          }),
        );
      if (r.experiencia_documentacao)
        itens.push(
          preencher(t.requisito_experiencia_documentacao, {
            ...v,
            tempo_minimo: r.tempo_minimo_documentacao,
          }),
        );
      if (!itens.length) itens.push(preencher(t.requisitos_nenhum, v));
      linhas.push({ tipo: "lista", itens });
    }
    if (atendeu) {
      p(t.merito_introducao);
      for (const def of blocosDaEtapa(rascunho.etapa)) {
        const bloco = rascunho.blocos.find((b) => b.codigo === def.codigo);
        if (bloco) linhas.push(...linhasDoBloco(bloco, t, v, rascunho));
      }
    }
  }

  titulo(t.titulo_conclusao);
  if (!tempestivo) {
    p(t.conclusao_intempestiva);
    p(t.conclusao_intempestiva_resultado);
  } else {
    const c = rascunho.conclusao;
    p(t.conclusao_decisao, { decisao: c.decisao });
    const retificacao = c.retificar
      ? preencher(t.conclusao_retificacao, {
          ...v,
          nota_antiga: sim(c.nota_antiga, "____"),
          nota_nova: sim(c.nota_nova, "____"),
        })
      : [];
    const [antes, depois] = t.conclusao_resultado.split("{retificacao}");
    linhas.push({
      tipo: "paragrafo",
      trechos: [
        ...preencher(antes ?? "", {
          ...v,
          acao: c.retificar ? "retificar" : "manter",
        }),
        ...retificacao,
        ...preencher(depois ?? "", v),
      ],
    });
  }
  p(t.conclusao_final);
  linhas.push(...linhasDasAssinaturas(rascunho, t));
  return { linhas };
}

/** As linhas do documento como texto (uma por parágrafo, item de lista, título ou linha de assinatura). */
export function linhasDeTexto(documento: DocumentoDoParecer): string[] {
  const juntar = (trechos: Trecho[]) => trechos.map((t) => t.texto).join("");
  return documento.linhas.flatMap((l) => {
    if (l.tipo === "lista") return l.itens.map(juntar);
    if (l.tipo === "assinatura") return l.linhas.map((x) => x.texto);
    return [juntar(l.trechos)];
  });
}

/** O texto do parecer (o que vai para o "Parecer jurídico" e para o SEI). */
export function textoDoParecer(documento: DocumentoDoParecer): string {
  return linhasDeTexto(documento).join("\n");
}

// ── Pré-preenchimento com o que o MONITORA sabe ──────────────────────────

export type FonteDoCampo =
  "recurso" | "cronograma" | "ficha" | "ajuste" | "regras" | "calculado";

export const ROTULO_DA_FONTE: Readonly<Record<FonteDoCampo, string>> =
  Object.freeze({
    recurso: "do recurso",
    cronograma: "do cronograma",
    ficha: "da ficha",
    ajuste: "do ajuste",
    regras: "das Regras do edital",
    calculado: "calculado",
  });

/** O recorte da ficha concluída que o parecer lê (obter_ficha_analise). */
export interface FichaParaOParecer {
  nivel?: string | null;
  modalidades?: readonly string[];
  indigena?: boolean;
  mora_aldeia?: boolean;
  blocos: readonly {
    codigo: string;
    tipo: string;
    titulo?: string;
    situacao: string;
    efeito?: string | null;
    motivos?: readonly string[];
  }[];
  titulos?: readonly {
    titulo?: string;
    aceito?: boolean;
    motivo?: string | null;
  }[];
  vinculos?: readonly {
    empregador?: string;
    categoria?: string;
    inicio?: string;
    fim?: string;
    aceito?: boolean;
    motivo?: string | null;
  }[];
  /** Os meses que a ficha apurou (apurarExperiencia: dias ÷ 30, une o dia seguinte). */
  meses_apurados?: number | null;
}

/** Tudo o que o MONITORA tem para o parecer de um recurso (a interface da fonte de dados). */
export interface DadosParaOParecer {
  recurso: {
    id: string | number;
    candidato: string;
    codigo: string | number | null;
    edital: string;
    unidade: string;
    vaga: string;
    cargo?: string;
    processo_sei?: string | null;
    situacao?: string | null;
    /** Data e hora do envio do recurso pelo candidato (PROPOSTA: não existe; hoje só criado_em). */
    enviado_em?: string | null;
    criado_em?: string | null;
    /** A observação do recurso (get_recurso_candidato_detalhe): ponto de partida do resumo das alegações. */
    observacao?: string | null;
  };
  /** O período de interposição (a atividade de abertura do recurso no cronograma). */
  periodo?: {
    inicio: string | null;
    fim: string | null;
    atividade: string;
  } | null;
  ficha?: FichaParaOParecer | null;
  regra?: RegraParaOParecer | null;
  /** A última versão do ajuste da pontuação (proposta ou aprovada). */
  ajuste?: {
    situacao: string;
    nota_antiga: number | null;
    nota_nova: number | null;
  } | null;
  /** Diferenças do modelo de parecer da área/edital (PROPOSTA). */
  textos?: Partial<Record<string, string>> | null;
  assinaturas?: Assinatura[] | null;
}

/** Interface da fonte de dados: no protótipo, dados fictícios; depois, as RPCs. */
export interface FonteDoParecer {
  carregar(recursoId: string | number): Promise<DadosParaOParecer>;
}

const DECISAO_DA_SITUACAO: Readonly<Record<string, Decisao>> = Object.freeze({
  DEFERIDO: "DEFERIMENTO",
  PARCIALMENTE_INDEFERIDO: "DEFERIMENTO PARCIAL",
  INDEFERIDO: "INDEFERIMENTO",
});

const NIVEL_DA_FICHA: Readonly<Record<string, NivelDaVaga>> = Object.freeze({
  superior: "superior",
  tecnico: "tecnico",
  medio: "medio",
  fundamental: "fundamental",
});

/** "2026-10-21T18:40:00-03:00" → ["2026-10-21", "18:40"] no horário de Brasília. */
export function dataEHoraDeBrasilia(
  valor: string | null | undefined,
): [string, string] {
  if (!valor) return ["", ""];
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return ["", ""];
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return [
    `${partes.year}-${partes.month}-${partes.day}`,
    `${partes.hour}:${partes.minute}`,
  ];
}

const notaDoParecer = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n)
    ? ""
    : n.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      });

const cotaDaFicha = (ficha: FichaParaOParecer, sigla: RegExp) =>
  ficha.blocos.find(
    (b) => b.tipo === "COTA" && sigla.test(`${b.codigo} ${b.titulo ?? ""}`),
  );

const negado = (situacao: string | undefined) =>
  situacao === "NAO_CONFORME" || situacao === "NAO_ENVIADO";

/**
 * O rascunho com o que o MONITORA já sabe, e de onde veio cada campo (para a
 * tela marcar "da ficha", "do cronograma"…). O que não se sabe fica como no
 * simulador.
 */
export function rascunhoInicial(dados: DadosParaOParecer): {
  rascunho: RascunhoDoParecer;
  fontes: Partial<Record<string, FonteDoCampo>>;
  avisos: string[];
} {
  const r = rascunhoVazio("avaliacao");
  const fontes: Partial<Record<string, FonteDoCampo>> = {};
  const avisos: string[] = [];
  const marcar = (campo: string, fonte: FonteDoCampo) =>
    (fontes[campo] = fonte);
  const rec = dados.recurso;

  r.cabecalho = {
    processo: texto(rec.processo_sei),
    edital: texto(rec.edital),
    unidade: texto(rec.unidade),
    candidato: texto(rec.candidato),
    codigo: texto(rec.codigo),
    vaga: texto(rec.vaga),
  };
  if (texto(rec.observacao)) {
    r.alegacoes = texto(rec.observacao);
    marcar("alegacoes", "recurso");
  }
  for (const campo of Object.keys(r.cabecalho))
    if ((r.cabecalho as Record<string, string>)[campo])
      marcar(`cabecalho.${campo}`, "recurso");

  const { referencias, fontes: fontesDasRefs } = referenciasDoEdital(
    dados.regra,
  );
  r.referencias = referencias;
  for (const [chave, fonte] of Object.entries(fontesDasRefs))
    if (fonte !== "padrao") marcar(`referencias.${chave}`, "regras");

  const vinculos = dados.regra?.blocos?.find((b) => b.tipo === "VINCULOS");
  if (typeof vinculos?.pontos_por_mes === "number") {
    r.pontos_por_mes = vinculos.pontos_por_mes;
    marcar("pontos_por_mes", "regras");
  }

  if (dados.periodo?.inicio || dados.periodo?.fim) {
    r.admissibilidade.prazo_de = texto(dados.periodo.inicio);
    r.admissibilidade.prazo_ate = texto(
      dados.periodo.fim ?? dados.periodo.inicio,
    );
    marcar("admissibilidade.prazo", "cronograma");
  } else avisos.push("O período de recurso não foi encontrado no cronograma.");

  const envio = rec.enviado_em || rec.criado_em || "";
  const [dia, hora] = dataEHoraDeBrasilia(envio);
  if (dia) {
    r.admissibilidade.envio_data = dia;
    r.admissibilidade.envio_hora = hora;
    marcar("admissibilidade.envio", "recurso");
    if (!rec.enviado_em)
      avisos.push(
        "Sem a data de envio do candidato: usada a data do cadastro do recurso.",
      );
  }
  const { prazo_de, prazo_ate } = r.admissibilidade;
  if (dia && prazo_ate) {
    const tempestivo = (!prazo_de || dia >= prazo_de) && dia <= prazo_ate;
    r.admissibilidade.tempestivo = tempestivo;
    r.admissibilidade.atende_periodo = tempestivo;
    marcar("admissibilidade.tempestivo", "calculado");
    if (!tempestivo) r.conclusao.decisao = "INDEFERIMENTO";
  }

  const decisao = DECISAO_DA_SITUACAO[texto(rec.situacao)];
  if (decisao) {
    r.conclusao.decisao = decisao;
    marcar("conclusao.decisao", "recurso");
  }
  if (dados.ajuste && dados.ajuste.situacao !== "CANCELADO") {
    r.conclusao.retificar = true;
    r.conclusao.nota_antiga = notaDoParecer(dados.ajuste.nota_antiga);
    r.conclusao.nota_nova = notaDoParecer(dados.ajuste.nota_nova);
    marcar("conclusao.notas", "ajuste");
  }
  if (dados.assinaturas?.length)
    r.assinaturas = dados.assinaturas.map((a) => ({
      ...a,
      lotacao: [...a.lotacao],
    }));

  const ficha = dados.ficha;
  if (!ficha) {
    avisos.push(
      "A ficha da Avaliação documental não foi encontrada: os blocos vêm em branco.",
    );
    return { rascunho: r, fontes, avisos };
  }

  // Requisitos eliminatórios: algum bloco da ficha com efeito ELIMINA.
  const requisitos = blocoDo(r, "requisitos")!;
  const eliminou = ficha.blocos.filter((b) => b.efeito === "ELIMINA");
  if (eliminou.length) {
    requisitos.atendeu = false;
    for (const b of eliminou) {
      if (/IDENT|DOC_ID|RG/i.test(b.codigo)) requisitos.identificacao = true;
      else if (b.tipo === "VINCULOS") requisitos.experiencia_minima = true;
      else if (/DIPLOMA|ESCOLAR|GRADUACAO|FORMACAO/i.test(b.codigo))
        requisitos.diploma = true;
    }
  }
  marcar("bloco.requisitos", "ficha");

  // Formação: o nível da vaga e os títulos aceitos.
  const formacao = blocoDo(r, "formacao")!;
  const nivel = NIVEL_DA_FICHA[texto(ficha.nivel).toLowerCase()];
  if (nivel) formacao.nivel = nivel;
  const blocoTitulos = ficha.blocos.find((b) => b.tipo === "TITULOS");
  const aceitos = (ficha.titulos ?? [])
    .filter((x) => x.aceito !== false)
    .map((x) => texto(x.titulo));
  if (
    blocoTitulos?.situacao === "NAO_ENVIADO" ||
    (!aceitos.length && !(ficha.titulos ?? []).length)
  )
    formacao.situacao = "nao_apresentada";
  else if (blocoTitulos?.situacao === "NAO_CONFORME" && !aceitos.length)
    formacao.situacao = "invalidada";
  else {
    formacao.situacao = "comprovada";
    formacao.titulos = (TITULOS_POR_NIVEL[formacao.nivel] ?? [])
      .filter((x) => x.daFicha.some((t) => aceitos.includes(t)))
      .map((x) => x.id);
  }
  marcar("bloco.formacao", "ficha");

  // Experiência: um item por vínculo, com as datas; recusado = Não atende.
  const experiencia = blocoDo(r, "experiencia")!;
  const vinculosDaFicha = ficha.vinculos ?? [];
  if (vinculosDaFicha.length) {
    experiencia.itens = vinculosDaFicha.map((x) =>
      novaExperiencia({
        atende: x.aceito !== false,
        empresa: texto(x.empregador),
        inicio: texto(x.inicio),
        fim: texto(x.fim),
        ...(x.aceito === false && x.motivo
          ? { motivo_da_ficha: texto(x.motivo) }
          : {}),
      }),
    );
    marcar("bloco.experiencia", "ficha");
    const meses = totalSemSobreposicao(
      experiencia.itens,
      r.pontos_por_mes,
    ).meses;
    if (
      typeof ficha.meses_apurados === "number" &&
      ficha.meses_apurados !== meses
    )
      avisos.push(
        `A ficha apurou ${ficha.meses_apurados} ${ficha.meses_apurados === 1 ? "mês" : "meses"} (dias ÷ 30); o parecer conta ${meses} ${meses === 1 ? "mês completo" : "meses completos"}, como o simulador.`,
      );
  }

  // Cotas e pertencimento: só os blocos que a ficha negou ficam marcados.
  const modalidades = (ficha.modalidades ?? []).map((m) => m.toUpperCase());
  const pcd = blocoDo(r, "pcd")!;
  const cotaPcd = cotaDaFicha(ficha, /PCD|DEFICI/i);
  if (negado(cotaPcd?.situacao)) {
    pcd.marcado = true;
    pcd.opcao =
      cotaPcd!.situacao === "NAO_ENVIADO" ? "sem_documento" : "em_desacordo";
    marcar("bloco.pcd", "ficha");
  }
  const indigena = blocoDo(r, "indigena")!;
  const etnico = ficha.blocos.find((b) => b.tipo === "PONTUACAO");
  const pontosEtnicos = dados.regra?.blocos?.find(
    (b) => b.tipo === "PONTUACAO",
  );
  if (pontosEtnicos && typeof pontosEtnicos.indigena === "number") {
    indigena.no_recurso_pontos = String(
      pontosEtnicos.indigena + (pontosEtnicos.aldeia ?? 0),
    );
  }
  if (ficha.indigena && etnico) {
    if (negado(etnico.situacao)) indigena.sem_documento = true;
    if (ficha.mora_aldeia && etnico.efeito === "SEM_PONTOS_ALDEIA")
      indigena.aldeia = true;
    marcar("bloco.indigena", "ficha");
  }
  const quilombola = blocoDo(r, "quilombola")!;
  const cotaQuilombola = cotaDaFicha(ficha, /QUILOMB/i);
  if (negado(cotaQuilombola?.situacao)) {
    quilombola.marcado = true;
    marcar("bloco.quilombola", "ficha");
  }
  const hetero = blocoDo(r, "heteroidentificacao")!;
  const cotaNegros = cotaDaFicha(ficha, /NEGR|PRET|PARD|PPP|HETERO/i);
  if (negado(cotaNegros?.situacao)) {
    hetero.marcado = true;
    marcar("bloco.heteroidentificacao", "ficha");
  }

  // Bloco de cota sem a cota na inscrição sai do parecer (o analista pode pôr de volta).
  const optou = (re: RegExp) => modalidades.some((m) => re.test(m));
  r.blocos = r.blocos.filter((b) => {
    if (b.codigo === "pcd") return optou(/PCD|DEFIC/) || pcd.marcado;
    if (b.codigo === "quilombola")
      return optou(/QUILOMB/) || quilombola.marcado;
    if (b.codigo === "heteroidentificacao")
      return optou(/NEGR|PRET|PARD|PPP/) || hetero.marcado;
    if (b.codigo === "indigena")
      return Boolean(ficha.indigena) || optou(/INDIG/);
    return true;
  });
  return { rascunho: r, fontes, avisos };
}

/**
 * O período de interposição do recurso no cronograma: a atividade de
 * ABERTURA (prazo de recurso) da origem, a de fim mais tardio. É a mesma
 * classificação de prazo-do-recurso.ts.
 */
export function periodoDeInterposicao(
  etapas: readonly {
    atividade: string;
    inicio: string | null;
    fim: string | null;
    origem: string | null;
    papel: string | null;
  }[],
  origem: string,
): { inicio: string | null; fim: string | null; atividade: string } | null {
  const daOrigem = etapas
    .filter(
      (e) =>
        e.papel === "abertura" && e.origem === origem && (e.fim || e.inicio),
    )
    .sort((a, b) =>
      String(a.fim ?? a.inicio).localeCompare(String(b.fim ?? b.inicio)),
    );
  const ultima = daOrigem.at(-1);
  return ultima
    ? { inicio: ultima.inicio, fim: ultima.fim, atividade: ultima.atividade }
    : null;
}

function texto(valor: unknown): string {
  return valor === null || valor === undefined ? "" : String(valor).trim();
}
