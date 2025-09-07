// public/js/firebase-schema.js
import { Timestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";


export const getNewUserSchema = (dadosUsuario) => ({
    nome: dadosUsuario.displayName || dadosUsuario.email,
    email: dadosUsuario.email,
    setupCompleto: false,
    setupStep: 'profile',
    dataCriacao: Timestamp.now()
});

export const getUserProfileSchema = (dadosProfile) => ({
    nome: dadosProfile.nome,
    email: dadosProfile.email,
    moedaPrincipal: dadosProfile.moedaPrincipal,
    pais: dadosProfile.pais,
    setupStep: 'accounts',
    atualizadoEm: Timestamp.now()
});

export const getAccountsConfigSchema = (dadosContas) => ({
    fontes: dadosContas.fontes,
    moedas: dadosContas.moedas,
    moedaPrincipal: dadosContas.moedaPrincipal,
    setupStep: 'categories'
});

export const getCategoriesConfigSchema = (dadosCategorias) => ({
    categoriasDespesa: dadosCategorias.despesas,
    categoriasReceita: dadosCategorias.receitas,
    setupStep: 'cost-centers'
});

export const getSetupCompleteSchema = () => ({
    setupCompleto: true,
    setupStep: null,
    setupFinalizadoEm: Timestamp.now()
});


export const getNewConfigSchema = () => {
    const hoje = new Date();
    const mesAtualChave = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const mesAtualLabel = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    return {
        fontes: [
        { nome: "Carteira", moeda: "EUR", tipo: "Dinheiro", agrupavel: false, diaFechamento: null, diaVencimento: null },
            { nome: "Conta Principal", moeda: "EUR", tipo: "Banco", agrupavel: false, diaFechamento: null, diaVencimento: null }
        ],
        categoriasDespesa: ["Alimentação", "Transporte", "Moradia", "Lazer", "Saúde"],
        categoriasReceita: ["Salário", "Freelance", "Investimentos"],
        moedas: [{ codigo: "EUR", taxa: 1.0, dataAtualizacao: Timestamp.now() }],
        mesesDisponiveis: [{ chave: mesAtualChave, label: mesAtualLabel }]
    };
};

export const getNewCentroCustoPessoalSchema = (userId) => ({
    nome: "Pessoal",
    proprietarioId: userId,
    usuariosCompartilhados: [userId],
    ativo: true,
    criadoEm: Timestamp.now()
});

export const getNewGrupoLancamentoSchema = (dadosGrupo) => ({
    nome: dadosGrupo.nome,
    tipo: dadosGrupo.tipo,
    usuarioId: dadosGrupo.usuarioId,
    valorTotal: dadosGrupo.valorTotal,
    status: 'Pendente',
    criadoEm: Timestamp.now(),
    atualizadoEm: Timestamp.now()
});

export const getNewOrcamentoSchema = (dadosOrcamento) => ({
    usuarioId: dadosOrcamento.usuarioId,
    categoria: dadosOrcamento.categoria,
    valorOrcado: dadosOrcamento.valorOrcado,
    mes: dadosOrcamento.mes,
    ano: dadosOrcamento.ano,
    centroCusto: dadosOrcamento.centroCusto,
    ativo: true,
    criadoEm: Timestamp.now(),
    atualizadoEm: Timestamp.now()
});

// firebase-schema.js - Corrigir getNewLancamentoSchema
export const getNewLancamentoSchema = (dadosLancamento) => {
    const dataVencimentoValida = dadosLancamento.dataVencimento && !isNaN(new Date(dadosLancamento.dataVencimento))
        ? new Date(dadosLancamento.dataVencimento)
        : new Date();

    return {
        usuarioId: dadosLancamento.usuarioId,
        descricao: dadosLancamento.descricao,
        
        // Novos campos para conversão de moeda
        valorOriginal: dadosLancamento.valorOriginal,
        moedaOriginal: dadosLancamento.moedaOriginal,
        valorNaMoedaPrincipal: dadosLancamento.valorNaMoedaPrincipal, // Valor convertido no momento da criação

        dataLancamento: dadosLancamento.dataLancamento || Timestamp.now(),
        dataVencimento: Timestamp.fromDate(dataVencimentoValida),
        tipo: dadosLancamento.tipo,
        categoria: dadosLancamento.categoria,
        fonteId: dadosLancamento.fonteId,
        
        centrosCusto: dadosLancamento.centrosCusto || [],
        centroCustoIds: dadosLancamento.centroCustoIds || [],
        usuariosComAcesso: dadosLancamento.usuariosComAcesso || [],
        
        // Novo objeto para recorrência avançada
        recorrencia: dadosLancamento.recorrencia || null, // ex: { tipo: 'parcelado', parcelaAtual: 1, totalParcelas: 12, idGrupo: '...' }

        status: 'Pendente',
        valorPago: 0, // Continuará sendo o valor pago na moeda principal
        valorPagoNaMoedaOriginal: 0, // NOVO: Valor pago na moeda original
        pagamentos: [], // NOVO: Array para o histórico de pagamentos
        dataPagamento: null,
        criadoEm: Timestamp.now(),
        atualizadoEm: Timestamp.now()
    };
};