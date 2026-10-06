"""
Catálogo das conferências de consistência: código → módulo, gravidade e título.

O código é a chave do aviso no banco (TB_AVISO_CONFERENCIA.CO_CONFERENCIA) e
o título é o mesmo que a tela mostra (src/lib/avisos-de-conferencia.js). A
lista é conferida contra tests/fixtures/conferencias/catalogo.json pelos dois
lados (pytest e vitest): mudou aqui, mude lá e na tela.
"""

CRITICA = "CRITICA"
ATENCAO = "ATENCAO"
INFORMATIVO = "INFORMATIVO"

CATALOGO = {
    # Análises curriculares
    "ANALISE_APROVADA_ABAIXO_DO_CORTE": ("analises", CRITICA, "Aprovada com nota abaixo da mínima"),
    "ANALISE_NOTA_DIFERENTE_DA_SOMA": ("analises", ATENCAO, "Nota final diferente da soma das parciais"),
    "ANALISE_EXPERIENCIA_ACIMA_DO_TETO": ("analises", ATENCAO, "Experiência acima do teto da regra"),
    "ANALISE_DATA_INVALIDA": ("analises", ATENCAO, "Data da análise no futuro ou antes da inscrição"),
    "ANALISE_EM_DOIS_EDITAIS": ("analises", INFORMATIVO, "Candidato analisado em dois editais ativos"),
    # Entrevistas
    "ENTREVISTA_SEM_NOTA_APOS_DATA": ("entrevistas", ATENCAO, "Convocado sem nota depois da data da entrevista"),
    "ENTREVISTA_NOTA_FORA_DA_ESCALA": ("entrevistas", CRITICA, "Nota fora da escala do roteiro"),
    "ENTREVISTA_FORA_DA_CONVOCACAO": ("entrevistas", CRITICA, "Convocado fora da lista de convocação vigente"),
    "ENTREVISTA_HORARIO_DUPLICADO": ("entrevistas", ATENCAO, "Dois horários para o mesmo candidato"),
    # Classificação
    "CLASSIFICACAO_LISTA_FINAL_DESATUALIZADA": (
        "classificacao",
        CRITICA,
        "Lista final gerada antes da última mudança nas análises",
    ),
    "CLASSIFICACAO_EMPATE_PENDENTE": ("classificacao", ATENCAO, "Empate sem desempate registrado"),
    "CLASSIFICACAO_VAGA_SEM_QUADRO": ("classificacao", ATENCAO, "Vaga sem linha no quadro de vagas"),
    "CLASSIFICACAO_AJUSTE_APOS_LISTA": ("classificacao", ATENCAO, "Ajuste de recurso aprovado depois da última lista"),
    # Lista de aprovados
    "APROVADOS_CONTRATADO_DUPLICADO": ("aprovados", CRITICA, "Contratado em duas vagas"),
    "APROVADOS_CONVOCADO_SEM_DESFECHO": ("aprovados", ATENCAO, "Convocado há muitos dias sem desfecho"),
    "APROVADOS_PENDENCIA_DA_PUBLICACAO": ("aprovados", ATENCAO, "Pendência da publicação sem revisão"),
    # Cargas
    "CARGA_VARIACAO_BRUSCA": ("cargas", ATENCAO, "Variação brusca de candidatos na Empregare"),
}

MODULOS = ("analises", "entrevistas", "classificacao", "aprovados", "cargas")


def do_modulo(modulo):
    """Códigos das conferências de um módulo (todas rodam juntas)."""
    return [codigo for codigo, (m, _g, _t) in CATALOGO.items() if m == modulo]
