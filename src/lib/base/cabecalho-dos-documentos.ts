/*
  O cabeçalho da agência nos documentos oficiais (timbrado do Word e prévia
  "Como fica no SEI" da Classificação): uma linha por linha do timbrado.
  Configurável em Configurações › Marca (chave `documento_cabecalho` da
  TB_CONFIGURACAO); o padrão é o das publicações da AgSUS no SEI.
*/
export const CHAVE_DO_CABECALHO = "documento_cabecalho";

export const CABECALHO_PADRAO = [
  "AGÊNCIA BRASILEIRA DE APOIO À GESTÃO DO SISTEMA ÚNICO DE SAÚDE",
  "SEPN CRN 514, Bloco D, - Bairro Asa Norte, Brasília/DF, CEP 70760-544",
  "http://www.agenciasus.org.br",
].join("\n");
