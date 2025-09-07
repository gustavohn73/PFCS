import { getDadosDashboard, getLancamentos } from '../firestore-service.js';

export class OverviewController {
    static async inicializar() {
        await this.carregarDadosUsuario();
        await this.carregarResumoFinanceiro();
        await this.carregarTransacoesRecentes();
        this.atualizarDataAtual();
        this.configurarEventos();
    }

    static async carregarDadosUsuario() {
        const user = window.App.state.usuarioLogado;
        if (user) {
            const nomeElement = document.getElementById('user-greeting-name');
            if (nomeElement) {
                nomeElement.textContent = user.displayName || user.email.split('@')[0];
            }
        }
    }

    static atualizarDataAtual() {
        const dataElement = document.getElementById('current-date-display');
        if (dataElement) {
            const hoje = new Date();
            dataElement.textContent = hoje.toLocaleDateString('pt-BR', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
            });
        }
    }

    static async carregarResumoFinanceiro() {
        try {
            const userId = window.App.state.usuarioLogado.uid;
            const dados = await getDadosDashboard(userId, window.App.state.filtroAtual);
            
            const totalBalanceEl = document.getElementById('total-balance');
            const primaryAccountBalanceEl = document.getElementById('primary-account-balance');
            
            if (totalBalanceEl) {
                const saldoTotal = dados.resumo.receitasRecebidas - dados.resumo.despesasPagas;
                totalBalanceEl.textContent = window.App.formatarMoeda(saldoTotal);
            }
            
            if (primaryAccountBalanceEl) {
                primaryAccountBalanceEl.textContent = window.App.formatarMoeda(25000);
            }
            
        } catch (error) {
            console.error('Erro ao carregar resumo financeiro:', error);
        }
    }

    static async carregarTransacoesRecentes() {
        try {
            const container = document.getElementById('recent-transactions-list');
            if (!container) return;

            const userId = window.App.state.usuarioLogado.uid;
            const lancamentos = await getLancamentos(userId, { 
                ...window.App.state.filtroAtual, 
                limit: 5 
            });
            
            this.renderizarTransacoes(lancamentos);
            
        } catch (error) {
            console.error('Erro ao carregar transações:', error);
        }
    }

    static renderizarTransacoes(lancamentos) {
        const container = document.getElementById('recent-transactions-list');
        if (!container) return;

        container.innerHTML = '';
        
        if (lancamentos.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Nenhuma transação encontrada</p></div>';
            return;
        }
        
        lancamentos.slice(0, 5).forEach(lanc => {
            const transactionEl = document.createElement('div');
            transactionEl.className = 'transaction-item';
            transactionEl.innerHTML = `
                <div class="transaction-icon">
                    <i class="fas fa-${this.getIconForCategory(lanc.categoria)}"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-name">${lanc.descricao}</div>
                    <div class="transaction-category">${lanc.categoria}</div>
                    <div class="transaction-date">${lanc.dataVencimento.toLocaleDateString('pt-BR')}</div>
                </div>
                <div class="transaction-amount ${lanc.tipo.toLowerCase()}">
                    ${window.App.formatarMoeda(lanc.valorNaMoedaPrincipal)}
                </div>
            `;
            container.appendChild(transactionEl);
        });
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
            'Lazer': 'gamepad',
            'default': 'receipt'
        };
        return icons[categoria] || icons.default;
    }

    static configurarEventos() {
        const tabBtns = document.querySelectorAll('.transactions-tabs .tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                tabBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const filter = e.target.dataset.filter;
                this.filtrarTransacoes(filter);
            });
        });

        const notificationToggle = document.getElementById('notifications-toggle');
        const notificationDropdown = document.getElementById('notifications-dropdown');
        
        if (notificationToggle && notificationDropdown) {
            notificationToggle.addEventListener('click', () => {
                notificationDropdown.classList.toggle('show');
            });
        }
    }

    static filtrarTransacoes(filter) {
        console.log('Filtrar transações por:', filter);
    }
}

window.OverviewController = OverviewController;