import { 
    getDadosDashboard, 
    getLancamentos, 
    marcarComoPago, 
    escutarLancamentos, 
    registrarAuditoria, 
    getLancamentoPorId,
    deletarLancamento,
    desmarcarComoPago,
    editarPagamento,
    deletarPagamento
} from '../firestore-service.js';

export class DashboardController {
    static partialPayModalInstance = null;
    static paymentHistoryModalInstance = null;
    static lancamentoEmAcao = null;

    static inicializar() {
        // Inicializa o modal de pagamento parcial
        const partialPayEl = document.getElementById('partialPayModal');
        if (partialPayEl) {
            this.partialPayModalInstance = new bootstrap.Modal(partialPayEl);
            const saveButton = document.getElementById('save-partial-pay-button');
            if (saveButton && !saveButton.dataset.listenerAttached) {
                saveButton.addEventListener('click', this.salvarPagamentoParcial.bind(this));
                saveButton.dataset.listenerAttached = 'true';
            }
        }
        
        // Inicializa o modal de histórico de pagamentos e anexa o ouvinte de clique
        const historyEl = document.getElementById('paymentHistoryModal');
        if (historyEl) {
            this.paymentHistoryModalInstance = new bootstrap.Modal(historyEl);
            const historyBody = document.getElementById('payment-history-body');
            if (historyBody && !historyBody.dataset.listenerAttached) {
                historyBody.addEventListener('click', this.handleDashboardClick.bind(this));
                historyBody.dataset.listenerAttached = 'true';
            }
        }
        
        this.configurarFiltrosDashboard();
        this.configurarEventosDashboard();
        this.carregarDashboard();
        document.getElementById('btn-aplicar-filtros').click();
    }
    
    static configurarFiltrosDashboard() {
        const selectCentro = document.getElementById('filtro-centro-custo');
        if (selectCentro) {
            selectCentro.innerHTML = '<option value="">Todos os centros</option>';
            window.App.state.centrosCustoUsuario.forEach(centro => {
                selectCentro.innerHTML += `<option value="${centro.id}">${centro.nome}</option>`;
            });
            const idPrincipal = window.App.state.appConfig.centroCustoPrincipalId;
            if (idPrincipal) {
                selectCentro.value = idPrincipal;
            }
        }
        
        const filtroMes = document.getElementById('filtro-mes');
        const filtroAno = document.getElementById('filtro-ano');
        
        if (filtroMes && filtroAno) {
            const hoje = new Date();
            // Popula o seletor de Mês
            filtroMes.innerHTML = '';
            for (let i = 0; i < 12; i++) {
                const data = new Date(hoje.getFullYear(), i, 1);
                const nomeMes = data.toLocaleDateString('pt-BR', { month: 'long' });
                filtroMes.innerHTML += `<option value="${i}">${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}</option>`;
            }
            filtroMes.value = hoje.getMonth();
            
            // Popula o seletor de Ano
            filtroAno.innerHTML = '';
            const anoAtual = hoje.getFullYear();
            for (let i = anoAtual - 5; i <= anoAtual + 5; i++) {
                filtroAno.innerHTML += `<option value="${i}">${i}</option>`;
            }
            filtroAno.value = anoAtual;
        }
    }

    static configurarEventosDashboard() {
        const appContent = document.getElementById('app-content');
        if (appContent && !appContent.dataset.dashboardListener) {
            appContent.addEventListener('click', this.handleDashboardClick.bind(this));
            appContent.dataset.dashboardListener = 'true';
        }

        // Configurar filtros de abas
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                tabBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filtrarPorTipo(e.target.dataset.filter);
            });
        });

        // Configurar centros de custo múltiplos
        this.configurarCentrosCusto();
        this.configurarDatePicker();
    
        // Configurar botão de filtrar
        const btnFiltrar = document.getElementById('btn-aplicar-filtros');
        if (btnFiltrar) {
            btnFiltrar.addEventListener('click', () => {
                this.aplicarFiltros();
            });
        }
    }

    static aplicarFiltros() {
        const centrosSelecionados = this.getCentrosSelecionados();

        // Manter as datas já selecionadas no date picker
        if (!window.App.state.filtroAtual) {
            const hoje = new Date();
            window.App.state.filtroAtual = {
                dataInicio: new Date(hoje.getFullYear(), hoje.getMonth(), 1),
                dataFim: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0),
                centrosSelecionados: centrosSelecionados
            };
        } else {
            // Garante que as datas não sejam perdidas ao aplicar o filtro de centro de custo
            window.App.state.filtroAtual.centrosSelecionados = centrosSelecionados;
        }

        this.carregarDashboard(); // <-- ESSA É A LINHA MAIS IMPORTANTE
        window.App.mostrarToast('Filtros aplicados!', 'success');
    }

    static async configurarCentrosCusto() {
        const centrosDisplay = document.getElementById('selected-centros-display');
        const dropdownMenu = document.getElementById('centros-dropdown-menu');

        if (!centrosDisplay || !dropdownMenu) return;

        try {
            const centrosReais = window.App.state.centrosCustoUsuario || [];
            dropdownMenu.innerHTML = '';
            centrosReais.forEach(centro => {
                const li = document.createElement('li');
                li.innerHTML = `<a class="dropdown-item" href="#" data-centro="${centro.id}">${centro.nome}</a>`;
                dropdownMenu.appendChild(li);
            });

            // LÓGICA CORRIGIDA: Adiciona o centro de custo principal por padrão
            if (centrosDisplay.children.length === 0) {
                const idPrincipal = window.App.state.appConfig.centroCustoPrincipalId;
                let centroPadrao = centrosReais.find(c => c.id === idPrincipal);
            
                // Se não encontrar um principal, usa o primeiro da lista como fallback
                if (!centroPadrao && centrosReais.length > 0) {
                    centroPadrao = centrosReais[0];
                }

                if (centroPadrao) {
                    this.adicionarCentroBadge(centroPadrao.id, centroPadrao.nome);
                    // Esconde a opção já selecionada do dropdown
                    const option = dropdownMenu.querySelector(`[data-centro="${centroPadrao.id}"]`);
                    if (option) {
                        option.parentElement.style.display = 'none';
                    }
                }
            }
        } catch (error) {
            console.error('Erro ao carregar centros de custo:', error);
        }

        this.configurarEventosCentros();
    }

    static configurarEventosCentros() {
        const centrosDisplay = document.getElementById('selected-centros-display');
        const dropdownMenu = document.getElementById('centros-dropdown-menu');
    
        // Remover centro de custo
        centrosDisplay.addEventListener('click', (e) => {
            if (e.target.classList.contains('fa-times')) {
                const centroBadge = e.target.closest('.centro-badge');
                const centroId = e.target.dataset.centro;
            
                centroBadge.remove();
            
                // Reativar opção no dropdown
                const option = dropdownMenu.querySelector(`[data-centro="${centroId}"]`);
                if (option) {
                    option.parentElement.style.display = 'block';
                }
            }
        });
    
        // Adicionar centro de custo
        dropdownMenu.addEventListener('click', (e) => {
            if (e.target.classList.contains('dropdown-item')) {
                e.preventDefault();
                const centroId = e.target.dataset.centro;
                const centroNome = e.target.textContent;
            
                // Verificar se já existe
                if (centrosDisplay.querySelector(`[data-centro="${centroId}"]`)) return;
            
                this.adicionarCentroBadge(centroId, centroNome);
            
                // Esconder opção no dropdown
                e.target.parentElement.style.display = 'none';
            }
        });
    }

    static adicionarCentroBadge(centroId, centroNome) {
        const centrosDisplay = document.getElementById('selected-centros-display');
    
        const badge = document.createElement('span');
        badge.className = 'centro-badge';
        badge.innerHTML = `${centroNome} <i class="fas fa-times" data-centro="${centroId}"></i>`;
    
        centrosDisplay.appendChild(badge);
    }

    static filtrarPorTipo(tipo) {
        const linhas = document.querySelectorAll('#container-lancamentos tr');
    
        linhas.forEach(linha => {
            const valor = linha.querySelector('.transaction-amount');
            if (!valor) return;
        
            const isReceita = valor.classList.contains('receita');
            const isDespesa = valor.classList.contains('despesa');
        
            switch(tipo) {
                case 'receita':
                    linha.style.display = isReceita ? '' : 'none';
                    break;
                case 'despesa':
                    linha.style.display = isDespesa ? '' : 'none';
                    break;
                case 'all':
                default:
                    linha.style.display = '';
                    break;
            }
        });
    }

    static async handleDashboardClick(event) {
        const button = event.target.closest('button, a');
        if (!button || !button.dataset.action) return;
        
        event.preventDefault();
        const { action, id, extra } = button.dataset;
        
        // Determina qual função de recarregamento usar, com base na página atual
        const reloadCallback = window.location.hash.includes('conta-detalhes')
            ? () => window.ContaDetalhesController.carregarHistoricoEsaldo()
            : () => window.DashboardController.carregarDashboard();
        
        try {
            switch (action) {
                case 'pay': await DashboardController.handlePagamentoCompleto(id, reloadCallback); break;
                case 'unpay': await DashboardController.handleDesmarcarComoPago(id, reloadCallback); break;
                case 'pay-partial': await DashboardController.handlePagamentoParcial(id); break;
                case 'edit': await DashboardController.handleEditarLancamento(id); break;
                case 'delete': await DashboardController.handleDeletarLancamento(id, reloadCallback); break;
                case 'expand-group': DashboardController.handleExpandirGrupo(id); break;
                case 'pay-group': await DashboardController.handlePagarGrupo(id, reloadCallback); break;
                case 'view-payments': await DashboardController.handleVerHistorico(id); break;
                case 'edit-payment': await DashboardController.handleEditarPagamento(id, extra, reloadCallback); break; // 'id' é lancamentoId, 'extra' é pagamentoId
                case 'delete-payment': await DashboardController.handleDeletarPagamento(id, extra, reloadCallback); break;
            }
        } catch (error) {
            console.error(`Erro ao executar ação ${action}:`, error);
            window.App.mostrarToast("Erro ao executar ação.", "error");
        }
    }

    static async handlePagamentoCompleto(id, callbackOnSuccess) {
        await marcarComoPago(id);
        window.App.mostrarToast("Lançamento marcado como pago!", "success");
        if (callbackOnSuccess) callbackOnSuccess();
    }

    static async handleDeletarLancamento(id, callbackOnSuccess) {
        if (confirm('Tem certeza que deseja excluir este lançamento?')) {
            await deletarLancamento(id);
            window.App.mostrarToast("Lançamento excluído!", "success");
            if (callbackOnSuccess) callbackOnSuccess();
        }
    }

    static async handleEditarLancamento(id) {
        const lancamento = await getLancamentoPorId(id);
        if (lancamento) {
            Navigation.navigate('lancamento', { lancamento: lancamento });
        } else {
            window.App.mostrarToast("Lançamento não encontrado para edição.", "error");
        }
    }

    static async handleDesmarcarComoPago(id, callbackOnSuccess) {
        await desmarcarComoPago(id);
        window.App.mostrarToast("Lançamento desmarcado como pago.", "info");
        if (callbackOnSuccess) callbackOnSuccess();
    }

    static async handleVerHistorico(id) {
        const lancamento = await getLancamentoPorId(id);
        const body = document.getElementById('payment-history-body');
        
        if (!lancamento || !lancamento.pagamentos || lancamento.pagamentos.length === 0) {
            body.innerHTML = '<p>Nenhum pagamento registrado.</p>';
        } else {
            let listHtml = `<ul class="list-group">`;
            lancamento.pagamentos.forEach(p => {
                listHtml += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            Pagamento de <strong>${window.App.formatarMoeda(p.valor, lancamento.moedaOriginal)}</strong>
                            <small class="text-muted d-block">${p.data.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</small>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-outline-secondary me-2" data-action="edit-payment" data-id="${id}" data-extra="${p.id}" title="Editar Pagamento"><i class="fas fa-pencil-alt"></i></button>
                            <button class="btn btn-sm btn-outline-danger" data-action="delete-payment" data-id="${id}" data-extra="${p.id}" title="Excluir Pagamento"><i class="fas fa-trash"></i></button>
                        </div>
                    </li>
                `;
            });
            listHtml += `</ul>`;
            body.innerHTML = listHtml;
        }
        this.paymentHistoryModalInstance.show();
    }

    static async handleEditarPagamento(lancamentoId, pagamentoId) {
        this.paymentHistoryModalInstance.hide(); // Fecha o modal de histórico
        const lancamento = await getLancamentoPorId(lancamentoId);
        const pagamento = lancamento.pagamentos.find(p => p.id === pagamentoId);

        const novoValor = prompt("Digite o novo valor para este pagamento:", pagamento.valor);
        const novaData = prompt("Digite a nova data (AAAA-MM-DD):", pagamento.data.toDate().toISOString().split('T')[0]);

        if (novoValor !== null && novaData !== null) {
            try {
                await editarPagamento(lancamentoId, pagamentoId, {
                    valor: parseFloat(novoValor),
                    data: new Date(novaData + 'T00:00:00Z')
                });
                window.App.mostrarToast("Pagamento atualizado!", "success");
                this.carregarDashboard();
            } catch (error) {
                window.App.mostrarToast("Erro ao editar pagamento.", "error");
            }
        }
    }

    static async handleDeletarPagamento(lancamentoId, pagamentoId) {
        if (confirm("Tem certeza que deseja excluir este pagamento do histórico?")) {
            try {
                await deletarPagamento(lancamentoId, pagamentoId);
                window.App.mostrarToast("Pagamento excluído do histórico!", "success");
                this.paymentHistoryModalInstance.hide();
                this.carregarDashboard();
            } catch (error) {
                window.App.mostrarToast("Erro ao excluir pagamento.", "error");
            }
        }
    }

    static criarElementoGrupo(grupo) {
        const div = document.createElement('div');
        div.className = 'card mb-3 grupo-lancamentos';
        div.dataset.grupoId = grupo.id;

        const isAtrasado = grupo.vencimento < new Date() && grupo.status !== 'Pago';
        const tipoClass = isAtrasado ? 'atrasado' : 'despesa';

        div.innerHTML = `
            <div class="card-body p-2 d-flex align-items-center">
                <div class="status-bar ${tipoClass}"></div>
                <div class="flex-grow-1 mx-3">
                    <div class="d-flex justify-content-between">
                        <h6 class="mb-0">${grupo.nome}</h6>
                        <span class="fw-bold text-danger">${window.App.formatarMoeda(grupo.valorTotal)}</span>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mt-1">
                        <small class="text-muted">${grupo.lancamentos.length} lançamentos nesta fatura</small>
                        ${isAtrasado ? '<span class="badge bg-danger">Atrasado</span>' : ''}
                    </div>
                </div>
                <button class="btn btn-sm btn-light" data-action="expand-group" data-id="${grupo.id}" title="Ver detalhes">
                    <i class="fas fa-chevron-down"></i>
                </button>
            </div>
            <div class="collapse" id="grupo-${grupo.id}">
                <div class="card-body p-0">
                    <ul class="list-group list-group-flush">
                        ${grupo.lancamentos.map(lanc => `
                            <li class="list-group-item d-flex justify-content-between">
                                <span>${lanc.descricao}</span>
                                <span>${window.App.formatarMoeda(lanc.valorNaMoedaPrincipal)}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;
        return div;
    }

    static async handlePagamentoCompleto(id) {
        await marcarComoPago(id, callbackOnSuccess);
        await registrarAuditoria('PAGAMENTO_COMPLETO', window.App.state.usuarioLogado.uid, { lancamentoId: id });
        window.App.mostrarToast("Lançamento marcado como pago!", "success");
        if (callbackOnSuccess) callbackOnSuccess();
        this.carregarDashboard();
    }

    static async handlePagamentoParcial(id) {
        try {
            const lancamento = await getLancamentoPorId(id);
            if (!lancamento) return window.App.mostrarToast('Lançamento não encontrado.', 'error');

            const restante = lancamento.valorOriginal - (lancamento.valorPagoNaMoedaOriginal || 0);
            
            document.getElementById('partial-pay-descricao').textContent = lancamento.descricao;
            document.getElementById('partial-pay-restante').textContent = window.App.formatarMoeda(restante, lancamento.moedaOriginal);
            
            const valorInput = document.getElementById('partial-pay-valor');
            valorInput.value = restante.toFixed(2);
            valorInput.max = restante;

            // Define a data atual como padrão no novo campo de data
            document.getElementById('partial-pay-data').value = new Date().toISOString().split('T')[0];
            
            this.lancamentoEmAcao = id;
            this.partialPayModalInstance.show();

        } catch (error) {
            console.error("Erro ao preparar pagamento parcial:", error);
            window.App.mostrarToast("Erro ao abrir janela de pagamento parcial.", "error");
        }
    }

    static async salvarPagamentoParcial() {
        const valor = parseFloat(document.getElementById('partial-pay-valor').value);
        const dataString = document.getElementById('partial-pay-data').value;

        if (!dataString) return window.App.mostrarToast("A data do pagamento é obrigatória.", "warning");
        if (!valor || valor <= 0) return window.App.mostrarToast("O valor a ser pago deve ser maior que zero.", "warning");

        try {
            // Converte a data do input para um objeto Date correto
            const dataPagamento = new Date(dataString + 'T00:00:00Z');
            await marcarComoPago(this.lancamentoEmAcao, valor, dataPagamento);
            
            window.App.mostrarToast("Pagamento parcial salvo!", "success");
            this.partialPayModalInstance.hide();
            this.carregarDashboard();
        } catch (error) {
            console.error("Erro ao salvar pagamento parcial:", error);
            window.App.mostrarToast("Erro ao salvar pagamento.", "error");
        }
    }

    static async handlePagarGrupo(id) {
        console.log("Pagar grupo:", id);
        window.App.mostrarToast("Função de pagar fatura ainda não implementada.", "info");
    }

    static async carregarDashboard() {
        if (!window.App.state.usuarioLogado || !document.getElementById('dash-receitas')) return;
        try {
            window.App.mostrarLoading(true);
    
            // LÓGICA CORRIGIDA: Define filtros padrão na primeira carga
            if (!window.App.state.filtroAtual) {
                const hoje = new Date();
                const idPrincipal = window.App.state.appConfig.centroCustoPrincipalId;
            
                window.App.state.filtroAtual = {
                    dataInicio: new Date(hoje.getFullYear(), hoje.getMonth(), 1),
                    dataFim: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0),
                    centrosSelecionados: idPrincipal ? [idPrincipal] : []
                };
            }

            const dadosDashboard = await getDadosDashboard(window.App.state.usuarioLogado.uid, window.App.state.filtroAtual);
    
            this.atualizarNovosKPIs(dadosDashboard.resumo);
            this.atualizarListaDetalhada(dadosDashboard.grupos, dadosDashboard.lancamentosSoltos);
    
        } catch (error) {
            console.error("Erro ao carregar dashboard:", error);
            window.App.mostrarToast("Erro ao carregar dados do dashboard", "error");
        } finally {
            window.App.mostrarLoading(false);
        }
    }

    static atualizarNovosKPIs(resumo) {
        document.getElementById('dash-receitas').textContent = window.App.formatarMoeda(resumo.receitasRecebidas || 0);
        document.getElementById('dash-despesas').textContent = window.App.formatarMoeda(resumo.despesasPagas || 0);
        document.getElementById('dash-a-pagar').textContent = window.App.formatarMoeda(resumo.aPagarNoMes || 0);
        document.getElementById('dash-atrasadas').textContent = window.App.formatarMoeda(resumo.atrasadas || 0);
    }

    static async configurarListenerLancamentos(filtros) { 
        window.App.state.lancamentosListener = await escutarLancamentos( 
            window.App.state.usuarioLogado.uid, 
            filtros, 
            (lancamentos) => {
                console.log("Lançamentos atualizados em tempo real:", lancamentos.length);
            }
        );
    }

    static async handlePagamentoCompleto(lancamentoId) {
        try {
            const resultado = await marcarComoPago(lancamentoId);
            window.App.mostrarToast("Lançamento marcado como pago!", "success");
            await this.carregarDashboard();
            
            await registrarAuditoria('PAGAMENTO_COMPLETO', window.App.state.usuarioLogado.uid, 
                { lancamentoId }, resultado);
                
        } catch (error) {
            window.App.mostrarToast("Erro ao marcar como pago", "error");
        }
    }

    static abrirModalPagamentoParcial(lancamento) {
        // Implementação do modal de pagamento parcial
        console.log("Abrir modal de pagamento parcial para:", lancamento.id);
    }

    static async handleEditarPagamento(lancamentoId, pagamentoId) {
        this.paymentHistoryModalInstance.hide();
        const lancamento = await getLancamentoPorId(lancamentoId);
        const pagamento = lancamento.pagamentos.find(p => p.id === pagamentoId);

        const novoValor = prompt("Digite o novo valor para este pagamento:", pagamento.valor);
        const novaData = prompt("Digite a nova data (AAAA-MM-DD):", pagamento.data.toDate().toISOString().split('T')[0]);

        if (novoValor !== null && novaData !== null) {
            try {
                await editarPagamento(lancamentoId, pagamentoId, {
                    valor: parseFloat(novoValor),
                    data: new Date(novaData + 'T00:00:00Z')
                });
                window.App.mostrarToast("Pagamento atualizado!", "success");
                this.carregarDashboard();
            } catch (error) {
                // Adiciona o console.error para vermos o erro técnico
                console.error("Erro técnico ao editar pagamento:", error);
                window.App.mostrarToast("Erro ao editar pagamento.", "error");
            }
        }
    }

    static async handleDeletarPagamento(lancamentoId, pagamentoId) {
        if (confirm("Tem certeza que deseja excluir este pagamento do histórico?")) {
            try {
                await deletarPagamento(lancamentoId, pagamentoId);
                window.App.mostrarToast("Pagamento excluído do histórico!", "success");
                this.paymentHistoryModalInstance.hide();
                this.carregarDashboard();
            } catch (error) {
                // Adiciona o console.error para vermos o erro técnico
                console.error("Erro técnico ao excluir pagamento:", error);
                window.App.mostrarToast("Erro ao excluir pagamento.", "error");
            }
        }
    }

    static handleExpandirGrupo(grupoId) {
        const collapse = document.getElementById(`grupo-${grupoId}`);
        if (collapse) {
            const bsCollapse = new bootstrap.Collapse(collapse, { toggle: false });
            bsCollapse.toggle();
            
            const btn = document.querySelector(`[data-action="expand-group"][data-id="${grupoId}"] i`);
            if (btn) {
                btn.className = btn.className.includes('fa-chevron-down') ? 
                    'fas fa-chevron-up' : 'fas fa-chevron-down';
            }
        }
    }

    static async handlePagarGrupo(id) {
        console.log("Pagar grupo:", id);
    }

    static mostrarAlertas(alertas) {
        const container = document.getElementById('container-alertas');
        if (!container || !alertas || alertas.length === 0) return;
        
        container.innerHTML = '';
        
        alertas.forEach(alerta => {
            const div = document.createElement('div');
            div.className = `alert alert-${alerta.tipo} alert-dismissible fade show`;
            div.innerHTML = `
                <i class="fas fa-${alerta.tipo === 'warning' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
                <strong>${alerta.titulo}:</strong> ${alerta.mensagem}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            container.appendChild(div);
        });
    }

    static atualizarListaDetalhada(grupos, lancamentosSoltos) {
        const tbody = document.querySelector('#container-lancamentos');
        if (!tbody) return;
    
        tbody.innerHTML = '';
    
        // Renderiza lançamentos individuais em formato de tabela
        lancamentosSoltos.forEach(lanc => tbody.appendChild(this.criarLinhaTransacao(lanc)));
    
        if (lancamentosSoltos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-5">
                        <i class="fas fa-receipt fa-2x mb-3"></i>
                        <p>Nenhuma transação encontrada para este período.</p>
                        <button class="btn btn-primary" onclick="Navigation.navigate('lancamento')">
                            Criar Primeira Transação
                        </button>
                    </td>
                </tr>`;
        }
    }

    static criarLinhaTransacao(lancamento) {
        const tr = document.createElement('tr');
    
        const statusConfig = {
            'Pago': { bg: 'success', text: 'Pago' },
            'Parcial': { bg: 'warning', text: 'Parcial' },
            'Pendente': { bg: 'secondary', text: 'Pendente' }
        };
        const statusInfo = statusConfig[lancamento.status] || statusConfig['Pendente'];
    
        tr.innerHTML = `
            <td>
                <div class="transaction-item-details">
                    <div class="transaction-item-icon">
                        <i class="fas fa-${this.getIconForCategory(lancamento.categoria)}"></i>
                    </div>
                    <div class="transaction-item-info">
                        <h6>${lancamento.descricao}</h6>
                        <small>${lancamento.categoria}</small>
                    </div>
                </div>
            </td>
            <td>
                <span class="fw-medium">${lancamento.fonteId}</span>
            </td>
            <td>
                <span class="text-muted">${lancamento.dataVencimento.toLocaleDateString('pt-BR')}</span>
            </td>
            <td>
                <span class="badge bg-${statusInfo.bg}">${statusInfo.text}</span>
            </td>
            <td>
                <span class="transaction-amount ${lancamento.tipo.toLowerCase()}">
                    ${window.App.formatarMoeda(lancamento.valorNaMoedaPrincipal)}
                </span>
            </td>
            <td>
                <div class="dropdown">
                    <button class="btn btn-sm btn-light" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="fas fa-ellipsis-h"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li><a class="dropdown-item" href="#" data-action="edit" data-id="${lancamento.id}">
                            <i class="fas fa-edit me-2"></i>Editar</a></li>
                        <li><a class="dropdown-item" href="#" data-action="pay" data-id="${lancamento.id}">
                            <i class="fas fa-check me-2"></i>Marcar como Pago</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item text-danger" href="#" data-action="delete" data-id="${lancamento.id}">
                            <i class="fas fa-trash me-2"></i>Excluir</a></li>
                    </ul>
                </div>
            </td>
        `;
    
        return tr;
    }

    static getIconForCategory(categoria) {
        const icons = {
            'Alimentação': 'utensils',
            'Transporte': 'car',
            'Moradia': 'home',
            'Entretenimento': 'gamepad',
            'Compras': 'shopping-bag',
            'Serviços': 'cog',
            'Saúde': 'heart',
            'Educação': 'graduation-cap',
            'default': 'receipt'
        };
        return icons[categoria] || icons.default;
    }

    static criarCardLancamento(lancamento) {
        const div = document.createElement('div');
        div.className = 'card lancamento-card mb-2';

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const dataVencimento = lancamento.dataVencimento;
        const isAtrasado = dataVencimento < hoje && lancamento.status !== 'Pago';
        const tipoClass = lancamento.tipo === 'Receita' ? 'receita' : (isAtrasado ? 'atrasado' : 'despesa');
        
        const statusConfig = {
            'Pago': { bg: 'bg-success', text: 'Pago' },
            'Parcial': { bg: 'bg-warning', text: 'Parcial' },
            'Pendente': { bg: 'bg-secondary', text: 'Pendente' }
        };
        let statusInfo = statusConfig[lancamento.status] || statusConfig['Pendente'];
        if (isAtrasado) {
            statusInfo = { bg: 'bg-danger', text: 'Atrasado!' };
        }
        
        const centrosCustoHtml = (lancamento.centroCustoIds || []).map(id => {
            const centro = window.App.state.centrosCustoUsuario.find(c => c.id === id);
            return `<span class="badge bg-light text-dark me-1">${centro?.nome || '...'}</span>`;
        }).join('');

        let pagamentoHtml = '';
        if (lancamento.status === 'Parcial' && lancamento.tipo === 'Despesa') {
            const percentualPago = (lancamento.valorPago / lancamento.valorNaMoedaPrincipal) * 100;
            pagamentoHtml = `
                <div class="progress mt-1" style="height: 5px;">
                    <div class="progress-bar bg-warning" style="width: ${percentualPago.toFixed(0)}%"></div>
                </div>
                <div class="d-flex justify-content-between">
                    <small class="text-muted">Pago: ${window.App.formatarMoeda(lancamento.valorPago)} de ${window.App.formatarMoeda(lancamento.valorNaMoedaPrincipal)}</small>
                    <button class="btn btn-link btn-sm p-0" data-action="view-payments" data-id="${lancamento.id}">Ver histórico</button>
                </div>
            `;
        }
        
        let actionButtonsHtml = '';
        if (lancamento.status === 'Pago') {
            actionButtonsHtml = `<li><a class="dropdown-item" href="#" data-action="unpay" data-id="${lancamento.id}"><i class="fas fa-undo me-2"></i>Desmarcar como Pago</a></li>`;
        } else {
            actionButtonsHtml = `
                <li><a class="dropdown-item" href="#" data-action="pay" data-id="${lancamento.id}"><i class="fas fa-check me-2"></i>Marcar como Pago</a></li>
                <li><a class="dropdown-item" href="#" data-action="pay-partial" data-id="${lancamento.id}"><i class="fas fa-coins me-2"></i>Pagamento Parcial</a></li>
            `;
        }

        div.innerHTML = `
          <div class="card-body p-2 d-flex align-items-center">
            <div class="status-bar ${tipoClass}"></div>
            <div class="flex-grow-1 mx-3">
              <div class="d-flex justify-content-between">
                <h6 class="mb-0 text-truncate">${lancamento.descricao}</h6>
                <span class="fw-bold text-${lancamento.tipo === 'Receita' ? 'success' : 'danger'}">${window.App.formatarMoeda(lancamento.valorNaMoedaPrincipal)}</span>
              </div>
              <div class="d-flex justify-content-between align-items-center mt-1">
                <small class="text-muted">
                  <i class="fas fa-calendar-alt me-1"></i> ${dataVencimento.toLocaleDateString('pt-BR')} | 
                  <i class="fas fa-tag mx-1"></i> ${lancamento.categoria} | 
                  <i class="fas fa-wallet mx-1"></i> ${lancamento.fonteId}
                </small>
                <span class="badge ${statusInfo.bg}">${statusInfo.text}</span>
              </div>
              <div class="mt-2">${centrosCustoHtml}</div>
              ${pagamentoHtml}
            </div>
            <div class="dropdown">
                <button class="btn btn-sm btn-light dropdown-toggle" type="button" data-bs-toggle="dropdown"></button>
                <ul class="dropdown-menu dropdown-menu-end">
                    <li><a class="dropdown-item" href="#" data-action="edit" data-id="${lancamento.id}"><i class="fas fa-edit me-2"></i>Editar</a></li>
                    ${actionButtonsHtml}
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item text-danger" href="#" data-action="delete" data-id="${lancamento.id}"><i class="fas fa-trash me-2"></i>Excluir</a></li>
                </ul>
            </div>
          </div>
        `;
        return div;
    }

    static configurarDatePicker() {
        const dateDisplay = document.getElementById('date-display');
        const dateDropdown = document.getElementById('date-dropdown');
        const datePickerBody = document.getElementById('date-picker-body');
        const prevBtn = document.getElementById('prev-month');
        const nextBtn = document.getElementById('next-month');
        const btnThisMonth = document.getElementById('btn-this-month');
        const btnLastMonth = document.getElementById('btn-last-month');
        const btnApplyRange = document.getElementById('btn-apply-range');

        if (!dateDisplay || !dateDropdown || !datePickerBody) return;

        let currentDate = new Date();
        let startDate = null;
        let endDate = null;
        let selectingEndDate = false;

        // Define o período padrão na primeira vez (mês atual)
        const hoje = new Date();
        startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        endDate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        this.updateDateRangeDisplay(startDate, endDate);
        // Guarda este estado inicial para a primeira carga
        window.App.state.filtroAtual.dataInicio = startDate;
        window.App.state.filtroAtual.dataFim = endDate;


        // === LÓGICA DE EVENTOS CORRIGIDA ===

        // 1. Abre/Fecha o dropdown
        dateDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = dateDropdown.classList.contains('show');
            if (!isVisible) {
                dateDropdown.classList.add('show');
                dateDisplay.classList.add('active');
                this.generateRangeCalendar(currentDate, startDate, endDate);
            } else {
                dateDropdown.classList.remove('show');
                dateDisplay.classList.remove('active');
            }
        });

        // 2. Fecha ao clicar fora
        document.addEventListener('click', (e) => {
            if (!dateDisplay.contains(e.target) && !dateDropdown.contains(e.target)) {
                dateDropdown.classList.remove('show');
                dateDisplay.classList.remove('active');
            }
        });

        // 3. Lógica de seleção de datas (agora no elemento correto)
        datePickerBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('calendar-day') && !e.target.classList.contains('disabled')) {
                e.stopPropagation(); // Impede que o clique feche o menu
                const clickedDate = new Date(e.target.dataset.date);

                if (!selectingEndDate) {
                    startDate = clickedDate;
                    endDate = null;
                    selectingEndDate = true;
                } else {
                    if (clickedDate >= startDate) {
                        endDate = clickedDate;
                        selectingEndDate = false;
                    } else {
                        // Se a segunda data for anterior, começa uma nova seleção
                        startDate = clickedDate;
                        endDate = null;
                    }
                }

                this.generateRangeCalendar(currentDate, startDate, endDate);
            
                // APLICA O FILTRO AUTOMATICAMENTE ao selecionar a segunda data
                if (startDate && endDate) {
                    this.updateDateRangeDisplay(startDate, endDate);
                    this.applyDateFilter(startDate, endDate); // Chama a aplicação do filtro
                
                    // Fecha o dropdown após a seleção bem-sucedida
                    setTimeout(() => {
                        dateDropdown.classList.remove('show');
                        dateDisplay.classList.remove('active');
                    }, 300); // Pequeno delay para o utilizador ver a seleção
                }
            }
        });

        // Navegação e botões rápidos (sem alterações, mas mantidos para contexto)
        prevBtn?.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            this.generateRangeCalendar(currentDate, startDate, endDate);
        });

        nextBtn?.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            this.generateRangeCalendar(currentDate, startDate, endDate);
        });

        btnThisMonth?.addEventListener('click', () => {
            const hoje = new Date();
            startDate = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            endDate = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
            this.updateDateRangeDisplay(startDate, endDate);
            this.applyDateFilter(startDate, endDate);
            dateDropdown.classList.remove('show');
            dateDisplay.classList.remove('active');
        });

        btnLastMonth?.addEventListener('click', () => {
            const hoje = new Date();
            startDate = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
            endDate = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
            this.updateDateRangeDisplay(startDate, endDate);
            this.applyDateFilter(startDate, endDate);
            dateDropdown.classList.remove('show');
            dateDisplay.classList.remove('active');
        });

        btnApplyRange?.addEventListener('click', () => {
            if (startDate && endDate) {
                this.applyDateFilter(startDate, endDate);
                dateDropdown.classList.remove('show');
                dateDisplay.classList.remove('active');
            }
        });
    }

    static generateRangeCalendar(date, startDate, endDate) {
        const currentMonthYear = document.getElementById('current-month-year');
        const datePickerBody = document.getElementById('date-picker-body');
    
        if (!currentMonthYear || !datePickerBody) return;
    
        const meses = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
                      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
        currentMonthYear.textContent = `${meses[date.getMonth()]} ${date.getFullYear()}`;
    
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        const hoje = new Date();
    
        let html = '<div class="calendar-grid">';
    
        // Headers
        const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
        dias.forEach(dia => {
            html += `<div class="calendar-header">${dia}</div>`;
        });
    
        // Dias em branco antes do primeiro dia
        for (let i = 0; i < firstDay.getDay(); i++) {
            html += '<div class="calendar-day disabled"></div>';
        }
    
        // Dias do mês
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dayDate = new Date(date.getFullYear(), date.getMonth(), day);
            const isToday = dayDate.toDateString() === hoje.toDateString();
            const classes = ['calendar-day'];
        
            if (isToday) classes.push('today');
        
            // Verificar se está no range selecionado
            if (startDate && dayDate.toDateString() === startDate.toDateString()) {
                classes.push('selected-start');
            }
            if (endDate && dayDate.toDateString() === endDate.toDateString()) {
                classes.push('selected-end');
            }
            if (startDate && endDate && dayDate > startDate && dayDate < endDate) {
                classes.push('in-range');
            }
        
            html += `<button class="${classes.join(' ')}" data-date="${dayDate.toISOString()}">${day}</button>`;
        }
    
        html += '</div>';
        datePickerBody.innerHTML = html;
    }

    static updateDateRangeDisplay(startDate, endDate) {
        const selectedRange = document.getElementById('selected-range');
    
        if (selectedRange && startDate && endDate) {
            const formatDate = (date) => {
                const day = date.getDate().toString().padStart(2, '0');
                const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                               'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                return `${day} ${months[date.getMonth()]}`;
            };
        
            selectedRange.textContent = `${formatDate(startDate)} - ${formatDate(endDate)} ${endDate.getFullYear()}`;
        }
    }

    static applyDateFilter(startDate, endDate) {
        window.App.state.filtroAtual = {
            dataInicio: startDate,
            dataFim: endDate,
            centrosSelecionados: this.getCentrosSelecionados()
        };
    
        // Adicione a chamada para recarregar os dados
        this.carregarDashboard(); 
    }

    static getCentrosSelecionados() {
        const badges = document.querySelectorAll('.centro-badge i[data-centro]');
        return Array.from(badges).map(badge => badge.dataset.centro);
    }

    static atualizarListaMobile(lancamentos) {
        const container = document.getElementById('container-lancamentos-mobile');
        if (!container) return;
    
        container.innerHTML = '';
    
        lancamentos.forEach(lanc => {
            const card = document.createElement('div');
            card.className = 'transaction-card';
        
            const icon = this.getIconForCategory(lanc.categoria);
            const statusClass = lanc.tipo === 'Receita' ? 'receita' : 'despesa';
        
            card.innerHTML = `
                <div class="transaction-header">
                    <div class="transaction-icon">
                        <i class="fas fa-${icon}"></i>
                    </div>
                    <div class="transaction-info">
                        <h6 class="transaction-title">${lanc.descricao}</h6>
                        <p class="transaction-subtitle">${lanc.categoria}</p>
                    </div>
                    <div class="transaction-amount ${statusClass}">
                        ${window.App.formatarMoeda(lanc.valorNaMoedaPrincipal)}
                    </div>
                </div>
                <div class="transaction-footer">
                    <span class="transaction-date">${lanc.dataLancamento.toLocaleDateString('pt-BR')}</span>
                    <span class="transaction-status bg-${lanc.status.toLowerCase()}">${lanc.status}</span>
                </div>
            `;
        
            container.appendChild(card);
        });
    }

}

window.DashboardController = DashboardController;