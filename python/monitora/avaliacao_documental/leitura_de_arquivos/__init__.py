"""
LEITURA AUTOMÁTICA DOS ARQUIVOS da Avaliação documental.

O robô (scripts/robo-empregare/leitura_de_arquivos.py, workflow
leitura-de-arquivos.yml) baixa cada anexo do questionário da Empregare para
uma pasta temporária, chama `ler_documento` e grava o resultado pela RPC
gravar_leituras_de_arquivos (migration 20261009220000). O arquivo é apagado em
seguida; nada do texto do documento é guardado — só o que a ficha precisa para
AJUDAR o avaliador (quem decide é ele):

    texto        normalização e datas (biblioteca padrão)
    extracao     o texto de cada página: PDF com texto (pdfplumber, com a
                 posição das palavras), PDF escaneado e imagem (OCR, Tesseract
                 em português, vários modos, a melhor leitura), DOCX e TXT
    imagem       a foto arrumada para o OCR com OpenCV: tamanho, perspectiva,
                 sombra, inclinação, binarização
    layout       a posição das palavras: linhas, células e o valor de cada
                 rótulo (na célula, à direita ou embaixo)
    ctps         a CTPS (digital ou física) pela posição dos campos: um
                 contrato por bloco, CNPJ validado, sem as datas de férias e
                 alterações
    pessoas      o nome do candidato aparece? o CPF do documento é o dele
                 (só o booleano: o CPF chega como hash com sal da execução)?
    certificados cursos: curso, carga horária, instituição e conclusão, um por
                 certificado (um PDF pode ter vários)
    diplomas     titulação: graduação, especialização, mestrado, doutorado…
    experiencia  vínculos: empregador, cargo, início, fim (ou atual), carga
                 semanal e dias (CTPS, declaração, contrato, certidão, holerite)
    declaracoes  declaração/contrato/certidão: o EMISSOR é o empregador (timbre,
                 "A X, inscrita no CNPJ…", rodapé, CNPJ), uma seção por
                 declaração, a data de emissão ("Cidade, dd de mês de aaaa"),
                 o fim ("até a presente data" → atual; sem nada: fim não
                 informado) e a carga só quando ligada a "horas semanais"
    identidade   identidade e registro em conselho: o tipo do documento
    classificacao o tipo do documento sem item (comprovante de residência,
                 título de eleitor, histórico escolar, certidão, registro…)
    leitura      `ler_documento`: junta tudo, gera os alertas e o resumo

Os módulos de interpretação são só biblioteca padrão; pdfplumber, Pillow e
pytesseract entram só em `extracao`, e OpenCV só em `imagem`, importados na hora (o robô instala:
scripts/robo-empregare/requirements.txt). Testes: tests/python/test_leitura_de_arquivos.py e
test_leitura_inteligente.py (PDFs e imagens sintéticos de tests/python/sinteticos_leitura.py, nunca
documento real); medição antes/depois: tests/python/avaliar_leitura_sintetica.py. Tudo local e
gratuito: nenhum documento vai para serviço de fora (nem API de IA, nem consulta de CNPJ).
"""

# Mudou a interpretação → suba a versão: o robô relê o que foi lido com versão anterior.
VERSAO_DO_EXTRATOR = "2026.10.6"
