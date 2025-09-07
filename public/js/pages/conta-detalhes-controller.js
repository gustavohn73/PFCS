// js/pages/conta-detalhes-controller.js
import { getConfiguracoes, atualizarConfiguracoes } from '../firestore-service.js';

export class ContaDetalhesController {
    static conta = null;
    static contaIndex = null;
    static modalInstance = null;

    static inicializar(params = {}) {
        console.log('Inicializando ContaDetalhesController...', params);
        
        this.conta = params.conta;
        this.contaIndex = params.contaIndex;
        
        if (!this.conta) {
            console.error('Conta não encontrada');
            window.Navigation.navigate('contas');
            return;
        }

        this.configurarEventos();
        this.carregarInformacoesConta();
        this.definirPeriodoAtual();
    }

    static configurarEventos() {
        const editBtn = document.getElementById('edit-account-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.editarConta());
        }

        const modalEl = document.getElementById('editAccountModal');
        if (modalEl) {
            this.modalInstance = new bootstrap.Modal(modalEl);
        }

        const saveBtn = document.getElementById('saveEditAccountBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.salvarEdicao());
        }

        const groupableCheckbox = document.getElementById('editAccountGroupable');
        if (groupableCheckbox) {
            groupableCheckbox.addEventListener('change', (e) => {
                const options = document.getElementById('editGroupingOptions');
                options.style.display = e.target.checked ? 'block' : 'none';
            });
        }
    }

    static carregarInformacoesConta() {
        const infoCard = document.getElementById('account-info-card');
        if (!infoCard) return;

        const agrupamentoInfo = this.conta.agrupavel ? 
            `<div class="info-item">
                <label><i class="fas fa-layer-group text-primary me-1"></i>Agrupamento</label>
                <span class="info-value">
                    Fecha dia ${this.conta.diaFechamento}, Vence dia ${this.conta.diaVencimento}
                </span>
            </div>` : '';

        infoCard.innerHTML = `
            <div class="row g-3">
                <div class="col-md-4">
                    <div class="info-item">
                        <label>Nome da Conta</label>
                        <span class="info-value">${this.conta.nome}</span>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="info-item">
                        <label>Tipo</label>
                        <span class="info-value">${this.conta.tipo}</span>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="info-item">
                        <label>Moeda</label>
                        <span class="info-value">${this.conta.moeda}</span>
                    </div>
                </div>
                ${agrupamentoInfo ? `<div class="col-12">${agrupamentoInfo}</div>` : ''}
            </div>
            
            <div class="account-actions mt-3">
                <button class="btn btn-primary" id="edit-account-btn">
                    <i class="fas fa-edit me-1"></i>Editar Detalhes
                </button>
                <button class="btn btn-outline-danger" onclick="ContaDetalhesController.removerConta()">
                    <i class="fas fa-trash me-1"></i>Remover Conta
                </button>
            </div>
        `;

        // Reconfigurar eventos
        this.configurarEventos();
    }

    static definirPeriodoAtual() {
        const hoje = new Date();
        let periodo = '';
        
        if (this.conta.agrupavel && this.conta.diaFechamento) {
            const diaFechamento = this.conta.diaFechamento;
            
            let inicioFatura, fimFatura;
            
            if (hoje.getDate() >= diaFechamento) {
                inicioFatura = new Date(hoje.getFullYear(), hoje.getMonth(), diaFechamento);
                fimFatura = new Date(hoje.getFullYear(), hoje.getMonth() + 1, diaFechamento - 1);
            } else {
                inicioFatura = new Date(hoje.getFullYear(), hoje.getMonth() - 1, diaFechamento);
                fimFatura = new Date(hoje.getFullYear(), hoje.getMonth(), diaFechamento - 1);
            }
            
            periodo = `Fatura atual: ${inicioFatura.toLocaleDateString('pt-BR')} - ${fimFatura.toLocaleDateString('pt-BR')}`;
        } else {
            const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
            periodo = `Mês atual: ${inicioMes.toLocaleDateString('pt-BR')} - ${fimMes.toLocaleDateString('pt-BR')}`;
        }

        const periodoLabel = document.getElementById('periodo-label');
        if (periodoLabel) {
            periodoLabel.textContent = periodo;
        }

        // Mostrar empty state por enquanto
        const emptyState = document.getElementById('transactions-empty');
        if (emptyState) {
            emptyState.style.display = 'block';
        }
    }

    static editarConta() {
        this.carregarModalEdicao();
        this.modalInstance?.show();
    }

    static async carregarModalEdicao() {
        try {
            const config = await getConfiguracoes(window.App.state.usuarioLogado.uid);
            
            document.getElementById('editAccountName').value = this.conta.nome;
            document.getElementById('editAccountType').value = this.conta.tipo;
            
            const currencySelect = document.getElementById('editAccountCurrency');
            currencySelect.innerHTML = config.moedas.map(moeda => 
                `<option value="${moeda.codigo}" ${moeda.codigo === this.conta.moeda ? 'selected' : ''}>${moeda.codigo}</option>`
            ).join('');
            
            const groupableCheckbox = document.getElementById('editAccountGroupable');
            groupableCheckbox.checked = this.conta.agrupavel || false;
            
            const groupingOptions = document.getElementById('editGroupingOptions');
            groupingOptions.style.display = this.conta.agrupavel ? 'block' : 'none';
            
            if (this.conta.agrupavel) {
                document.getElementById('editClosingDay').value = this.conta.diaFechamento || '';
                document.getElementById('editDueDay').value = this.conta.diaVencimento || '';
            }
        } catch (error) {
            console.error('Erro ao carregar modal:', error);
        }
    }

    static async salvarEdicao() {
        try {
            window.App.mostrarLoading(true, '#saveEditAccountBtn');

            const dadosAtualizados = {
                nome: document.getElementById('editAccountName').value.trim(),
                tipo: document.getElementById('editAccountType').value,
                moeda: document.getElementById('editAccountCurrency').value,
                agrupavel: document.getElementById('editAccountGroupable').checked,
                diaFechamento: document.getElementById('editAccountGroupable').checked ? 
                    parseInt(document.getElementById('editClosingDay').value) || null : null,
                diaVencimento: document.getElementById('editAccountGroupable').checked ? 
                    parseInt(document.getElementById('editDueDay').value) || null : null
            };

            const userId = window.App.state.usuarioLogado.uid;
            const config = await getConfiguracoes(userId);
            
            config.fontes[this.contaIndex] = dadosAtualizados;
            await atualizarConfiguracoes(userId, { fontes: config.fontes });
            
            this.conta = dadosAtualizados;
            this.carregarInformacoesConta();
            this.definirPeriodoAtual();
            
            this.modalInstance?.hide();
            window.App.mostrarToast('Conta atualizada com sucesso!', 'success');

        } catch (error) {
            console.error('Erro ao salvar conta:', error);
            window.App.mostrarToast('Erro ao salvar conta', 'error');
        } finally {
            window.App.mostrarLoading(false);
        }
    }

    static async removerConta() {
        if (!confirm('Tem certeza que deseja remover esta conta? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            window.App.mostrarLoading(true);
            
            const userId = window.App.state.usuarioLogado.uid;
            const config = await getConfiguracoes(userId);
            
            config.fontes.splice(this.contaIndex, 1);
            await atualizarConfiguracoes(userId, { fontes: config.fontes });
            
            window.App.mostrarToast('Conta removida com sucesso!', 'success');
            window.Navigation.navigate('contas');

        } catch (error) {
            console.error('Erro ao remover conta:', error);
            window.App.mostrarToast('Erro ao remover conta', 'error');
        } finally {
            window.App.mostrarLoading(false);
        }
    }
}

window.ContaDetalhesController = ContaDetalhesController;