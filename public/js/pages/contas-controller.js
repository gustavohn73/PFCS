// js/pages/contas-controller.js
import { getConfiguracoes, atualizarConfiguracoes } from '../firestore-service.js';

export class ContasController {
    static modalInstance = null;
    static deleteModalInstance = null;
    static editingIndex = null;
    static contas = [];

    static inicializar() {
        console.log('Inicializando ContasController...');
        this.configurarEventos();
        this.carregarContas();
    }

    static configurarEventos() {
        const addBtn = document.getElementById('add-account-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.adicionarConta());
        }

        const modalEl = document.getElementById('accountModal');
        if (modalEl) {
            this.modalInstance = new bootstrap.Modal(modalEl);
        }

        const deleteModalEl = document.getElementById('deleteAccountModal');
        if (deleteModalEl) {
            this.deleteModalInstance = new bootstrap.Modal(deleteModalEl);
        }

        const saveBtn = document.getElementById('saveAccountBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.salvarConta());
        }

        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => this.confirmarExclusao());
        }

        const groupableCheckbox = document.getElementById('accountGroupable');
        if (groupableCheckbox) {
            groupableCheckbox.addEventListener('change', (e) => {
                const options = document.getElementById('groupingOptions');
                options.style.display = e.target.checked ? 'block' : 'none';
            });
        }
    }

    static async carregarContas() {
        try {
            window.App.mostrarLoading(true);
            const userId = window.App.state.usuarioLogado.uid;
            const config = await getConfiguracoes(userId);
            
            this.contas = config.fontes || [];
            this.renderizarContas();
            this.carregarMoedasNoModal(config.moedas || []);
            
        } catch (error) {
            console.error('Erro ao carregar contas:', error);
            window.App.mostrarToast('Erro ao carregar contas', 'error');
        } finally {
            window.App.mostrarLoading(false);
        }
    }

    static renderizarContas() {
        const grid = document.getElementById('accounts-grid');
        const emptyState = document.getElementById('empty-state');
        
        if (!grid) return;

        if (this.contas.length === 0) {
            grid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        if (emptyState) emptyState.style.display = 'none';
        
        grid.innerHTML = this.contas.map((conta, index) => this.criarCardConta(conta, index)).join('');
    }

    static criarCardConta(conta, index) {
        const tipoIcons = {
            'Banco': 'fas fa-university',
            'Cartão': 'fas fa-credit-card', 
            'Dinheiro': 'fas fa-wallet'
        };

        const badgeAgrupavel = conta.agrupavel ? 
            `<div class="conta-agrupavel-badge">
                <i class="fas fa-layer-group"></i>
                Fatura (${conta.diaFechamento}→${conta.diaVencimento})
            </div>` : '';

        return `
            <div class="conta-card" ${conta.agrupavel ? 'data-agrupavel="true"' : ''}>
                <div class="conta-header">
                    <div class="conta-info">
                        <h5 class="conta-nome">${conta.nome}</h5>
                        <div class="conta-tipo">
                            <i class="${tipoIcons[conta.tipo]} me-2"></i>
                            ${conta.tipo}
                        </div>
                    </div>
                    ${badgeAgrupavel}
                </div>
                
                <div class="conta-moeda">
                    Moeda: ${conta.moeda}
                </div>
                
                <div class="conta-saldo">
                    <div class="saldo-principal">Saldo disponível em breve</div>
                    <small class="text-muted">Calculado com base nas transações</small>
                </div>
                
                <div class="conta-actions">
                    <button class="btn btn-outline-danger btn-sm" onclick="ContasController.removerConta(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="ContasController.verDetalhes(${index})">
                        <i class="fas fa-eye me-1"></i>Detalhes
                    </button>
                </div>
            </div>
        `;
    }

    static carregarMoedasNoModal(moedas) {
        const select = document.getElementById('accountCurrency');
        if (select) {
            select.innerHTML = moedas.map(moeda => 
                `<option value="${moeda.codigo}">${moeda.codigo}</option>`
            ).join('');
        }
    }

    static adicionarConta() {
        this.editingIndex = null;
        this.limparFormulario();
        document.getElementById('accountModalTitle').textContent = 'Adicionar Conta';
        this.modalInstance?.show();
    }

    static async salvarConta() {
        try {
            const form = document.getElementById('accountForm');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            window.App.mostrarLoading(true, '#saveAccountBtn');

            const dadosConta = {
                nome: document.getElementById('accountName').value.trim(),
                tipo: document.getElementById('accountType').value,
                moeda: document.getElementById('accountCurrency').value,
                agrupavel: document.getElementById('accountGroupable').checked,
                diaFechamento: document.getElementById('accountGroupable').checked ? 
                    parseInt(document.getElementById('closingDay').value) || null : null,
                diaVencimento: document.getElementById('accountGroupable').checked ? 
                    parseInt(document.getElementById('dueDay').value) || null : null
            };

            const userId = window.App.state.usuarioLogado.uid;
            const config = await getConfiguracoes(userId);
            
            if (this.editingIndex !== null) {
                config.fontes[this.editingIndex] = dadosConta;
            } else {
                config.fontes = config.fontes || [];
                config.fontes.push(dadosConta);
            }

            await atualizarConfiguracoes(userId, { fontes: config.fontes });
            
            this.contas = config.fontes;
            this.renderizarContas();
            this.modalInstance?.hide();
            
            const acao = this.editingIndex !== null ? 'atualizada' : 'adicionada';
            window.App.mostrarToast(`Conta ${acao} com sucesso!`, 'success');

        } catch (error) {
            console.error('Erro ao salvar conta:', error);
            window.App.mostrarToast('Erro ao salvar conta', 'error');
        } finally {
            window.App.mostrarLoading(false);
        }
    }

    static removerConta(index) {
        this.editingIndex = index;
        this.deleteModalInstance?.show();
    }

    static async confirmarExclusao() {
        try {
            window.App.mostrarLoading(true, '#confirmDeleteBtn');
            
            const userId = window.App.state.usuarioLogado.uid;
            const config = await getConfiguracoes(userId);
            
            config.fontes.splice(this.editingIndex, 1);
            await atualizarConfiguracoes(userId, { fontes: config.fontes });
            
            this.contas = config.fontes;
            this.renderizarContas();
            this.deleteModalInstance?.hide();
            
            window.App.mostrarToast('Conta removida com sucesso!', 'success');

        } catch (error) {
            console.error('Erro ao remover conta:', error);
            window.App.mostrarToast('Erro ao remover conta', 'error');
        } finally {
            window.App.mostrarLoading(false);
        }
    }

    static verDetalhes(index) {
        const conta = this.contas[index];
        window.Navigation.navigate('conta-detalhes', { contaIndex: index, conta });
    }

    static limparFormulario() {
        document.getElementById('accountForm').reset();
        document.getElementById('groupingOptions').style.display = 'none';
    }
}

window.ContasController = ContasController;