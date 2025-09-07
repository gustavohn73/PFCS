import { db } from './firebase-config.js';
import {
    doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
    collection, query, where, getDocs, writeBatch,
    Timestamp, orderBy, onSnapshot, runTransaction, arrayRemove,
    limit, startAfter
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { 
    getNewUserSchema, getNewConfigSchema, getNewCentroCustoPessoalSchema,
    getNewLancamentoSchema, getUserProfileSchema, getAccountsConfigSchema, 
    getCategoriesConfigSchema, getSetupCompleteSchema
} from './firebase-schema.js';

// ===============================================================
// SETUP E GESTÃO DE USUÁRIO
// ===============================================================

export async function verificarStatusSetup(userId) {
    const userRef = doc(db, "usuarios", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return { exists: false, needsSetup: true, step: 'profile' };
    const userData = userSnap.data();
    return { exists: true, needsSetup: !userData.setupCompleto, step: userData.setupStep || 'profile' };
}

export async function criarPerfilUsuario(userId, dadosProfile) {
    const userRef = doc(db, "usuarios", userId);
    const profileData = getUserProfileSchema(dadosProfile);
    const dadosParaSalvar = { ...profileData, nome: dadosProfile.nome };
    await setDoc(userRef, dadosParaSalvar, { merge: true });
}

export async function getUsuario(userId) {
    const userRef = doc(db, "usuarios", userId);
    const userSnap = await getDoc(userRef);
    return userSnap.exists() ? userSnap.data() : null;
}

export async function configurarContasIniciais(userId, dadosContas) {
    await setDoc(doc(db, "configuracoes", userId), getAccountsConfigSchema(dadosContas));
    await updateDoc(doc(db, "usuarios", userId), { setupStep: 'categories' });
}

export async function configurarCategoriasIniciais(userId, dadosCategorias) {
    await updateDoc(doc(db, "configuracoes", userId), getCategoriesConfigSchema(dadosCategorias));
    await updateDoc(doc(db, "usuarios", userId), { setupStep: 'cost-centers' });
}

export async function finalizarSetupUsuario(userId) {
    const batch = writeBatch(db);
    batch.update(doc(db, "usuarios", userId), getSetupCompleteSchema());
    batch.set(doc(collection(db, "centrosCusto")), getNewCentroCustoPessoalSchema(userId));
    await batch.commit();
}

// ===============================================================
// CONFIGURAÇÕES GERAIS
// ===============================================================

export async function getConfiguracoes(userId) {
    const docRef = doc(db, "configuracoes", userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : getNewConfigSchema();
}

export async function atualizarConfiguracoes(userId, novasConfiguracoes) {
    const configRef = doc(db, "configuracoes", userId);
    await updateDoc(configRef, { ...novasConfiguracoes, atualizadoEm: Timestamp.now() });
}

// ===============================================================
// CENTROS DE CUSTO E COMPARTILHAMENTO
// ===============================================================

export async function getCentrosCustoUsuario(userId) {
    const q = query(collection(db, "centrosCusto"), where("usuariosCompartilhados", "array-contains", userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function criarNovoCentroCusto(userId, nomeCentro) {
    const novoCentro = { nome: nomeCentro, proprietarioId: userId, usuariosCompartilhados: [userId], ativo: true, criadoEm: Timestamp.now() };
    const docRef = await addDoc(collection(db, "centrosCusto"), novoCentro);
    return docRef.id;
}

export async function removerCentroCusto(centroId) {
    await deleteDoc(doc(db, "centrosCusto", centroId));
}

export async function atualizarNomeCentroCusto(centroId, novoNome) {
    await updateDoc(doc(db, "centrosCusto", centroId), { nome: novoNome });
}

export async function compartilharCentroCusto(centroCustoId, emailUsuario) {
    const usuariosQuery = query(collection(db, "usuarios"), where("email", "==", emailUsuario));
    const usuariosSnapshot = await getDocs(usuariosQuery);
    if (usuariosSnapshot.empty) throw new Error("Usuário não encontrado");
    
    const targetUserId = usuariosSnapshot.docs[0].id;
    const centroCustoRef = doc(db, "centrosCusto", centroCustoId);
    const centroCustoSnap = await getDoc(centroCustoRef);
    if (!centroCustoSnap.exists()) throw new Error("Centro de custo não encontrado");

    const dadosAtuais = centroCustoSnap.data();
    if (!dadosAtuais.usuariosCompartilhados.includes(targetUserId)) {
        const usuariosCompartilhados = [...dadosAtuais.usuariosCompartilhados, targetUserId];
        await updateDoc(centroCustoRef, { usuariosCompartilhados, atualizadoEm: Timestamp.now() });
    }
}

export async function removerCompartilhamento(centroId, emailParaRemover) {
    const q = query(collection(db, "usuarios"), where("email", "==", emailParaRemover));
    const userSnapshot = await getDocs(q);
    if (userSnapshot.empty) throw new Error("Usuário não encontrado para remoção.");
    
    const userIdParaRemover = userSnapshot.docs[0].id;
    await updateDoc(doc(db, "centrosCusto", centroId), { usuariosCompartilhados: arrayRemove(userIdParaRemover) });
}

export async function getEmailsFromUserIds(userIds) {
    if (!userIds || userIds.length === 0) return [];
    const q = query(collection(db, "usuarios"), where("__name__", "in", userIds));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data().email);
}

// ===============================================================
// CRIAÇÃO DE LANÇAMENTOS
// ===============================================================

export async function criarLancamento(dadosLancamento) {
    const centroCustoId = dadosLancamento.centrosCusto[0].id;
    const centroCustoRef = doc(db, "centrosCusto", centroCustoId);
    const centroCustoSnap = await getDoc(centroCustoRef);
    if (centroCustoSnap.exists()) {
        dadosLancamento.usuariosComAcesso = centroCustoSnap.data().usuariosCompartilhados;
    }
    const novoLancamento = getNewLancamentoSchema(dadosLancamento);
    await addDoc(collection(db, "lancamentos"), novoLancamento);
}

export async function criarLancamentoComDivisaoCentros(dadosBase, divisoesCentros) {
    const batch = writeBatch(db);
    for (const divisao of divisoesCentros) {
        const dadosLancamento = {
            ...dadosBase,
            valorOriginal: divisao.valor,
            valorNaMoedaPrincipal: divisao.valorNaMoedaPrincipal,
            centrosCusto: [{ id: divisao.centroCustoId, valor: divisao.valor }],
            centroCustoIds: [divisao.centroCustoId],
            descricao: `${dadosBase.descricao} - ${divisao.centroCustoNome}`
        };
        const centroCustoRef = doc(db, "centrosCusto", divisao.centroCustoId);
        const centroCustoSnap = await getDoc(centroCustoRef);
        if (centroCustoSnap.exists()) {
            dadosLancamento.usuariosComAcesso = centroCustoSnap.data().usuariosCompartilhados;
        }
        const lancamentoRef = doc(collection(db, "lancamentos"));
        const novoLancamento = getNewLancamentoSchema(dadosLancamento);
        batch.set(lancamentoRef, novoLancamento);
    }
    await batch.commit();
}

export async function criarLancamentos(lancamentosParaCriar) {
    const batch = writeBatch(db);
    
    // Usamos um loop for...of, que funciona corretamente com await
    for (const dadosLancamento of lancamentosParaCriar) {
        const lancamentoRef = doc(collection(db, "lancamentos"));

        // Esta lógica agora vai esperar a busca ser concluída corretamente
        const centroCustoRef = doc(db, "centrosCusto", dadosLancamento.centroCustoIds[0]);
        const centroCustoSnap = await getDoc(centroCustoRef);
        
        if (centroCustoSnap.exists()) {
            dadosLancamento.usuariosComAcesso = centroCustoSnap.data().usuariosCompartilhados;
        } else {
            // Garante que pelo menos o criador tenha acesso
            dadosLancamento.usuariosComAcesso = [dadosLancamento.usuarioId];
        }

        const novoLancamento = getNewLancamentoSchema(dadosLancamento);
        batch.set(lancamentoRef, novoLancamento);
    }
    
    await batch.commit();
}

// ===============================================================
// LEITURA DE LANÇAMENTOS E DASHBOARD
// ===============================================================

export async function getLancamentos(userId, filtros = {}) {
    try {
        let q = query(
            collection(db, "lancamentos"),
            where("usuariosComAcesso", "array-contains", userId)
        );

        if (filtros.dataInicio && filtros.dataFim) {
            const dataInicio = filtros.dataInicio;
            
            // A CORREÇÃO ESTÁ AQUI: Criamos uma CÓPIA da dataFim antes de modificá-la.
            const dataFim = new Date(filtros.dataFim); 
            
            // Agora, esta modificação afeta apenas a cópia local.
            dataFim.setHours(23, 59, 59, 999);
            
            q = query(q,
                where("dataVencimento", ">=", dataInicio),
                where("dataVencimento", "<=", dataFim)
            );
        }

        q = query(q, orderBy("dataVencimento", "desc"));
        const querySnapshot = await getDocs(q);
        
        let lancamentos = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            dataVencimento: doc.data().dataVencimento.toDate()
        }));
        
        if (filtros.centrosSelecionados && filtros.centrosSelecionados.length > 0) {
            lancamentos = lancamentos.filter(lanc => 
                lanc.centroCustoIds.some(id => filtros.centrosSelecionados.includes(id))
            );
        }

        return lancamentos;
    } catch (error) {
        console.error("Erro ao buscar lançamentos:", error);
        throw error;
    }
}


export async function escutarLancamentos(userId, filtros, callback) {
    try {
        // Mesma lógica para o listener: busca ampla e segura
        let q = query(
            collection(db, "lancamentos"),
            where("usuariosComAcesso", "array-contains", userId)
        );
        
        if (filtros.ano && typeof filtros.mes === 'number') {
            const startDate = new Date(filtros.ano, filtros.mes, 1);
            const endDate = new Date(filtros.ano, filtros.mes + 1, 1);
            q = query(q,
                where("dataVencimento", ">=", startDate),
                where("dataVencimento", "<", endDate)
            );
        }
        
        q = query(q, orderBy("dataVencimento", "desc"));
        
        return onSnapshot(q, (querySnapshot) => {
            let lancamentos = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                dataVencimento: doc.data().dataVencimento.toDate()
            }));

            // Filtro final no JavaScript
            if (filtros.centroCustoId) {
                lancamentos = lancamentos.filter(l => l.centroCustoIds.includes(filtros.centroCustoId));
            }

            callback(lancamentos);
        });
    } catch (error) {
        console.error("Erro ao configurar listener:", error);
        throw error;
    }
}


export async function getDadosDashboard(userId, filtros = {}) {
    // Chama a nova função getLancamentos que agora filtra corretamente
    const lancamentosDoPeriodo = await getLancamentos(userId, filtros);
    const config = await getConfiguracoes(userId);
    const { grupos, lancamentosSoltos } = agruparLancamentos(lancamentosDoPeriodo, config);

    // Lógica de cálculo dos novos KPIs
    let receitasRecebidas = 0;
    let despesasPagas = 0;
    let aPagarNoMes = 0;

    // Usa as datas do filtro se existirem, senão cria um intervalo padrão
    const primeiroDiaDoPeriodo = filtros.dataInicio || new Date();
    const ultimoDiaDoPeriodo = filtros.dataFim || new Date();

    // Ajusta para o início e fim do dia para garantir a inclusão correta
    primeiroDiaDoPeriodo.setHours(0, 0, 0, 0);
    ultimoDiaDoPeriodo.setHours(23, 59, 59, 999);

    const todosLancamentosDoPeriodo = [...lancamentosSoltos, ...grupos.flatMap(g => g.lancamentos)];

    todosLancamentosDoPeriodo.forEach(lanc => {
        (lanc.pagamentos || []).forEach(pagamento => {
            const dataPagamento = pagamento.data.toDate();
            // Verifica se a data do pagamento está dentro do período do filtro
            if (dataPagamento >= primeiroDiaDoPeriodo && dataPagamento <= ultimoDiaDoPeriodo) {
                if (lanc.tipo === 'Receita') receitasRecebidas += pagamento.valorNaMoedaPrincipal;
                else despesasPagas += pagamento.valorNaMoedaPrincipal;
            }
        });

        if (lanc.tipo === 'Despesa' && lanc.status !== 'Pago') {
            aPagarNoMes += (lanc.valorNaMoedaPrincipal - (lanc.valorPago || 0));
        }
    });

    // Busca contas atrasadas (vencidas antes do início do período do filtro)
    const qAtrasadas = query(collection(db, "lancamentos"),
        where("usuariosComAcesso", "array-contains", userId),
        where("dataVencimento", "<", primeiroDiaDoPeriodo)
    );
    const atrasadasSnapshot = await getDocs(qAtrasadas);
    let atrasadasValor = 0;
    const lancamentosAtrasados = [];
    
    atrasadasSnapshot.forEach(doc => {
        const lanc = doc.data();
        // Filtra em memória para pegar apenas as não pagas
        if (lanc.status !== 'Pago') {
            // Se houver filtro de centro de custo, aplica aqui também para as atrasadas
            if (filtros.centrosSelecionados && filtros.centrosSelecionados.length > 0) {
                if (lanc.centroCustoIds.some(id => filtros.centrosSelecionados.includes(id))) {
                    atrasadasValor += (lanc.valorNaMoedaPrincipal - (lanc.valorPago || 0));
                    lancamentosAtrasados.push({id: doc.id, ...lanc, dataVencimento: lanc.dataVencimento.toDate()});
                }
            } else {
                atrasadasValor += (lanc.valorNaMoedaPrincipal - (lanc.valorPago || 0));
                lancamentosAtrasados.push({id: doc.id, ...lanc, dataVencimento: lanc.dataVencimento.toDate()});
            }
        }
    });

    const resumo = { receitasRecebidas, despesasPagas, aPagarNoMes, atrasadas: atrasadasValor };
    
    return { resumo, grupos, lancamentosSoltos: [...lancamentosAtrasados, ...lancamentosSoltos], alertas: [] };
}

function agruparLancamentos(lancamentos, config) {
    const grupos = new Map();
    const lancamentosSoltos = [];
    const fontesAgrupaveis = config.fontes.filter(f => f.agrupavel);

    lancamentos.forEach(lanc => {
        const fonte = fontesAgrupaveis.find(f => f.nome === lanc.fonteId);
        if (fonte) {
            const dataVenc = lanc.dataVencimento;
            const dataFechamento = new Date(dataVenc.getFullYear(), dataVenc.getMonth(), fonte.diaFechamento);
            
            let mesFatura = dataVenc.getMonth();
            let anoFatura = dataVenc.getFullYear();
            if (dataVenc.getDate() > fonte.diaFechamento) {
                mesFatura += 1;
                if (mesFatura > 11) {
                    mesFatura = 0;
                    anoFatura += 1;
                }
            }

            const chaveGrupo = `${fonte.nome}-${anoFatura}-${mesFatura}`;
            
            if (!grupos.has(chaveGrupo)) {
                const dataVencimentoFatura = new Date(anoFatura, mesFatura, fonte.diaVencimento);
                grupos.set(chaveGrupo, { 
                    id: chaveGrupo,
                    nome: `Fatura ${fonte.nome} - Venc. ${dataVencimentoFatura.toLocaleDateString()}`,
                    vencimento: dataVencimentoFatura,
                    valorTotal: 0,
                    lancamentos: []
                });
            }
            const grupo = grupos.get(chaveGrupo);
            grupo.valorTotal += lanc.valorNaMoedaPrincipal;
            grupo.lancamentos.push(lanc);
        } else {
            lancamentosSoltos.push(lanc);
        }
    });

    return { grupos: Array.from(grupos.values()), lancamentosSoltos };
}

export async function verificarAlertas(userId) {
    try {
        const hoje = new Date();
        const seteDias = new Date(hoje.getTime() + (7 * 24 * 60 * 60 * 1000));
        const q = query(collection(db, "lancamentos"),
            where("usuariosComAcesso", "array-contains", userId),
            where("dataVencimento", ">=", hoje),
            where("dataVencimento", "<=", seteDias),
            where("status", "in", ["Pendente", "Parcial"])
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return [{ tipo: 'warning', titulo: 'Vencimentos Próximos', mensagem: `${snapshot.size} lançamentos vencem nos próximos 7 dias` }];
        }
        return [];
    } catch (error) {
        console.error("Erro ao verificar alertas:", error);
        return [];
    }
}


export async function marcarComoPago(lancamentoId, valorPago = null, dataPagamento = new Date()) {
    const lancamentoRef = doc(db, "lancamentos", lancamentoId);
    
    await runTransaction(db, async (transaction) => {
        const lancamentoSnap = await transaction.get(lancamentoRef);
        if (!lancamentoSnap.exists()) throw new Error("Lançamento não encontrado");

        const dados = lancamentoSnap.data();
        const config = await getConfiguracoes(dados.usuarioId);
        
        // Se valorPago é null, significa "pagar o valor total restante"
        const valorOriginalAPagar = valorPago !== null ? valorPago : (dados.valorOriginal - (dados.valorPagoNaMoedaOriginal || 0));
        
        // Converte o valor do pagamento para a moeda principal para os cálculos internos
        let valorPagoNaMoedaPrincipal = valorOriginalAPagar;
        if (dados.moedaOriginal !== config.moedaPrincipal) {
            const taxa = config.moedas.find(m => m.codigo === dados.moedaOriginal)?.taxa || 1;
            if (taxa !== 0) valorPagoNaMoedaPrincipal = valorOriginalAPagar / taxa;
        }
        
        const novoPagamento = {
            valor: valorOriginalAPagar,
            valorNaMoedaPrincipal: valorPagoNaMoedaPrincipal,
            data: Timestamp.fromDate(dataPagamento),
            id: `pay_${Date.now()}` // ID único para cada pagamento
        };

        const pagamentosAtuais = dados.pagamentos || [];
        const novosPagamentos = [...pagamentosAtuais, novoPagamento];
        
        const totalPagoOriginal = novosPagamentos.reduce((acc, p) => acc + p.valor, 0);
        const totalPagoPrincipal = novosPagamentos.reduce((acc, p) => acc + p.valorNaMoedaPrincipal, 0);
        
        const novoStatus = totalPagoPrincipal >= dados.valorNaMoedaPrincipal - 0.01 ? 'Pago' : 'Parcial';

        transaction.update(lancamentoRef, {
            status: novoStatus,
            valorPago: totalPagoPrincipal,
            valorPagoNaMoedaOriginal: totalPagoOriginal,
            pagamentos: novosPagamentos,
            dataPagamento: novoStatus === 'Pago' ? Timestamp.now() : null,
            atualizadoEm: Timestamp.now()
        });
    });
}

export async function getLancamentoPorId(lancamentoId) {
    try {
        const docRef = doc(db, "lancamentos", lancamentoId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                // Converte Timestamps para objetos Date do JS
                dataLancamento: data.dataLancamento.toDate(),
                dataVencimento: data.dataVencimento.toDate()
            };
        }
        return null;
    } catch (error) {
        console.error("Erro ao buscar lançamento por ID:", error);
        throw error;
    }
}

export async function atualizarLancamento(lancamentoId, dadosAtualizados) {
    try {
        const lancamentoRef = doc(db, "lancamentos", lancamentoId);
        
        // Prepara os dados com os campos do schema para garantir consistência
        const dadosParaSalvar = {
            ...dadosAtualizados,
            atualizadoEm: Timestamp.now()
        };
        
        await updateDoc(lancamentoRef, dadosParaSalvar);
        return true;
    } catch (error) {
        console.error("Erro ao atualizar lançamento:", error);
        throw error;
    }
}

export async function deletarLancamento(lancamentoId) {
    try {
        await deleteDoc(doc(db, "lancamentos", lancamentoId));
        return true;
    } catch (error) {
        console.error("Erro ao deletar lançamento:", error);
        throw error;
    }
}

export async function desmarcarComoPago(lancamentoId) {
    try {
        const lancamentoRef = doc(db, "lancamentos", lancamentoId);
        await updateDoc(lancamentoRef, {
            status: 'Pendente',
            valorPago: 0,
            dataPagamento: null,
            atualizadoEm: Timestamp.now()
        });
        return true;
    } catch (error) {
        console.error("Erro ao desmarcar como pago:", error);
        throw error;
    }
}

export async function registrarAuditoria(acao, userId, dados) {
    try {
        await addDoc(collection(db, "auditoria"), {
            acao,
            userId,
            dados,
            timestamp: Timestamp.now()
        });
    } catch (error) {
        // Não falhar a operação principal por erro de auditoria
        console.error("Erro ao registrar auditoria:", error);
    }
}

export async function editarPagamento(lancamentoId, pagamentoId, novosDados) {
    const lancamentoRef = doc(db, "lancamentos", lancamentoId);
    await runTransaction(db, async (transaction) => {
        const lancamentoSnap = await transaction.get(lancamentoRef);
        if (!lancamentoSnap.exists()) throw new Error("Lançamento não encontrado");

        const dados = lancamentoSnap.data();
        const pagamentos = dados.pagamentos || [];
        const index = pagamentos.findIndex(p => p.id === pagamentoId);
        if (index === -1) throw new Error("Pagamento não encontrado no histórico");

        // Atualiza o pagamento específico
        pagamentos[index].valor = novosDados.valor;
        pagamentos[index].data = Timestamp.fromDate(novosDados.data);
        // Recalcula conversão se necessário (lógica simplificada)
        pagamentos[index].valorNaMoedaPrincipal = novosDados.valor / (dados.valorOriginal / dados.valorNaMoedaPrincipal);
        
        // Recalcula totais
        const totalPagoOriginal = pagamentos.reduce((acc, p) => acc + p.valor, 0);
        const totalPagoPrincipal = pagamentos.reduce((acc, p) => acc + p.valorNaMoedaPrincipal, 0);
        const novoStatus = totalPagoPrincipal >= dados.valorNaMoedaPrincipal - 0.01 ? 'Pago' : 'Parcial';

        transaction.update(lancamentoRef, {
            pagamentos,
            valorPago: totalPagoPrincipal,
            valorPagoNaMoedaOriginal: totalPagoOriginal,
            status: novoStatus
        });
    });
}

export async function deletarPagamento(lancamentoId, pagamentoId) {
    const lancamentoRef = doc(db, "lancamentos", lancamentoId);
    
    await runTransaction(db, async (transaction) => {
        const lancamentoSnap = await transaction.get(lancamentoRef);
        if (!lancamentoSnap.exists()) throw new Error("Lançamento não encontrado");
        
        const dados = lancamentoSnap.data();
        // Filtra o array de pagamentos, removendo o que tem o ID correspondente
        const novosPagamentos = (dados.pagamentos || []).filter(p => p.id !== pagamentoId);

        // Recalcula os totais
        const totalPagoOriginal = novosPagamentos.reduce((acc, p) => acc + p.valor, 0);
        const totalPagoPrincipal = novosPagamentos.reduce((acc, p) => acc + p.valorNaMoedaPrincipal, 0);
        const novoStatus = totalPagoPrincipal > 0 ? 'Parcial' : 'Pendente';
        
        transaction.update(lancamentoRef, {
            pagamentos: novosPagamentos,
            valorPago: totalPagoPrincipal,
            valorPagoNaMoedaOriginal: totalPagoOriginal,
            status: novoStatus,
            dataPagamento: null, // Remove a data de pagamento total
            atualizadoEm: Timestamp.now()
        });
    });
}

export async function getLancamentosDaConta(userId, nomeFonte, ultimoVisivel = null, itensPorPagina = 20) {
    try {
        let q = query(
            collection(db, "lancamentos"),
            where("usuariosComAcesso", "array-contains", userId),
            where("fonteId", "==", nomeFonte),
            orderBy("dataVencimento", "desc")
        );

        if (ultimoVisivel) {
            q = query(q, startAfter(ultimoVisivel));
        }

        q = query(q, limit(itensPorPagina));

        const querySnapshot = await getDocs(q);
        
        const lancamentos = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const ultimoDoc = querySnapshot.docs[querySnapshot.docs.length - 1];

        return { lancamentos, ultimoDoc };

    } catch (error) {
        console.error("Erro ao buscar lançamentos da conta:", error);
        throw error;
    }
}