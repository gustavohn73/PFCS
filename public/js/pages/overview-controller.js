// public/js/pages/overview-controller.js
import {
    getConfiguracoes,
    getLancamentos,
    calcularSaldosContas
} from '../firestore-service.js';

export class OverviewController {
    static dados = {
        config: null,
        lancamentos: [],
        saldos: {}
    };

    static async inicializar() {
        console.log('🏠 Inicializando Overview...');

        try {
            window.App.mostrarLoading(true);

            const userId = window.App.state.usuarioLogado.uid;

            // Carregar dados
            this.dados.config = await getConfiguracoes(userId);
            this.dados.lancamentos = await getLancamentos(userId, { limite: 10 });
            this.dados.saldos = await calcularSaldosContas(userId);

            // Verificar se tem dados
            const temDados = this.dados.lancamentos.length > 0 ||
                (this.dados.config.fontes && this.dados.config.fontes.length > 0);

            if (!temDados) {
                this.mostrarEstadoVazio();
            } else {
                this.mostrarConteudoPrincipal();
                this.renderizarContas();
                this.renderizarEstatisticas();
                this.renderizarTransacoesRecentes();
            }

            // Atualizar data no header mobile
            this.atualizarDataMobile();

        } catch (error) {
            console.error('❌ Erro ao carregar overview:', error);
            window.App.mostrarToast('Erro ao carregar dados', 'error');
        } finally {
            window.App.mostrarLoading(false);
        }
    }

    static mostrarEstadoVazio() {
        document.getElementById('empty-state').style.display = 'flex';
        document.getElementById('main-content').style.display = 'none';
        document.getElementById('recent-transactions-card').style.display = 'none';
    }

    static mostrarConteudoPrincipal() {
        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('main-content').style.display = 'grid';
        document.getElementById('recent-transactions-card').style.display = 'block';
    }

    static renderizarContas() {
        const slider = document.getElementById('accounts-slider');
        const controls = document.getElementById('slider-controls');
        const dots = document.getElementById('slider-dots');

        if (!slider) return;

        const fontes = this.dados.config.fontes || [];

        if (fontes.length === 0) {
            slider.innerHTML = `
                <div class="account-card">
                    <div class="account-type">Nenhuma Conta</div>
                    <div class="account-balance">€0,00</div>
                    <button class="btn btn-sm btn-primary mt-3" onclick="Navigation.navigate('contas')">
                        Adicionar Conta
                    </button>
                </div>
            `;
            return;
        }

        // Calcular saldo total
        let saldoTotal = 0;
        fontes.forEach(fonte => {
            const saldo = this.dados.saldos[fonte.nome] || 0;
            saldoTotal += saldo;
        });

        document.getElementById('total-balance').textContent =
            window.App.formatarMoeda(saldoTotal);

        // Renderizar cards de contas
        slider.innerHTML = fontes.map((fonte, index) => {
            const saldo = this.dados.saldos[fonte.nome] || 0;
            const activeClass = index === 0 ? 'active' : '';

            return `
                <div class="account-card ${activeClass}" data-index="${index}">
                    <div class="account-type">${fonte.tipo}</div>
                    <div class="account-name">${fonte.nome}</div>
                    <div class="account-balance">${window.App.formatarMoeda(saldo, fonte.moeda)}</div>
                </div>
            `;
        }).join('');

        // Mostrar controles se houver mais de 1 conta
        if (fontes.length > 1) {
            controls.style.display = 'flex';

            // Criar dots
            dots.innerHTML = fontes.map((_, index) =>
                `<span class="dot ${index === 0 ? 'active' : ''}" data-index="${index}"></span>`
            ).join('');

            this.configurarSlider(fontes.length);
        }
    }

    static configurarSlider(totalContas) {
        let currentIndex = 0;

        const updateSlider = (newIndex) => {
            if (newIndex < 0) newIndex = totalContas - 1;
            if (newIndex >= totalContas) newIndex = 0;

            currentIndex = newIndex;

            // Atualizar cards
            document.querySelectorAll('.account-card').forEach((card, index) => {
                card.classList.toggle('active', index === currentIndex);
            });

            // Atualizar dots
            document.querySelectorAll('.dot').forEach((dot, index) => {
                dot.classList.toggle('active', index === currentIndex);
            });
        };

        // Botões prev/next
        document.getElementById('slider-prev')?.addEventListener('click', () => {
            updateSlider(currentIndex - 1);
        });

        document.getElementById('slider-next')?.addEventListener('click', () => {
            updateSlider(currentIndex + 1);
        });

        // Dots
        document.querySelectorAll('.dot').forEach(dot => {
            dot.addEventListener('click', () => {
                updateSlider(parseInt(dot.dataset.index));
            });
        });
    }

    static renderizarEstatisticas() {
        const hoje = new Date();
        const mesAtual = hoje.getMonth();
        const anoAtual = hoje.getFullYear();

        const lancamentosMes = this.dados.lancamentos.filter(lanc => {
            const data = lanc.dataLancamento.toDate();
            return data.getMonth() === mesAtual && data.getFullYear() === anoAtual;
        });

        let receitas = 0;
        let despesas = 0;
        let pendentes = 0;

        lancamentosMes.forEach(lanc => {
            const valor = lanc.valorNaMoedaPrincipal || 0;

            if (lanc.tipo === 'Receita') {
                receitas += valor;
            } else {
                despesas += valor;
            }

            if (lanc.status === 'Pendente') {
                pendentes += valor;
            }
        });

        const saldo = receitas - despesas;

        document.getElementById('stat-receitas').textContent =
            window.App.formatarMoeda(receitas);
        document.getElementById('stat-despesas').textContent =
            window.App.formatarMoeda(despesas);
        document.getElementById('stat-pendentes').textContent =
            window.App.formatarMoeda(pendentes);
        document.getElementById('stat-saldo').textContent =
            window.App.formatarMoeda(saldo);
    }

    static renderizarTransacoesRecentes() {
        const lista = document.getElementById('recent-transactions-list');
        const emptyState = document.getElementById('no-transactions');

        if (!lista) return;

        if (this.dados.lancamentos.length === 0) {
            lista.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        lista.style.display = 'block';
        emptyState.style.display = 'none';

        lista.innerHTML = this.dados.lancamentos.slice(0, 5).map(lanc => {
            const icon = lanc.tipo === 'Receita' ? 'arrow-up' : 'arrow-down';
            const colorClass = lanc.tipo === 'Receita' ? 'text-success' : 'text-danger';
            const data = lanc.dataLancamento.toDate().toLocaleDateString('pt-BR');

            return `
                <div class="transaction-item">
                    <div class="transaction-icon ${colorClass}">
                        <i class="fas fa-${icon}"></i>
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-name">${lanc.descricao}</div>
                        <div class="transaction-category">${lanc.categoria}</div>
                        <div class="transaction-date">${data}</div>
                    </div>
                    <div class="transaction-amount ${colorClass}">
                        ${window.App.formatarMoeda(lanc.valorNaMoedaPrincipal)}
                    </div>
                </div>
            `;
        }).join('');
    }

    static atualizarDataMobile() {
        const mobileDate = document.getElementById('mobile-current-date');
        const mobileTitle = document.getElementById('mobile-page-title');
        const desktopDate = document.getElementById('current-date-display');

        const hoje = new Date();
        const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dataFormatada = hoje.toLocaleDateString('pt-BR', opcoes);

        if (mobileDate) {
            mobileDate.textContent = dataFormatada;
        }

        if (desktopDate) {
            desktopDate.textContent = dataFormatada; // ✅ Atualiza desktop também
        }

        if (mobileTitle) {
            mobileTitle.textContent = 'Início';
        }
    }
}

window.OverviewController = OverviewController;