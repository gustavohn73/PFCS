import { criarPerfilUsuario, configurarContasIniciais, configurarCategoriasIniciais, finalizarSetupUsuario } from '../firestore-service.js';

export class SetupController {
    static currentStep = 'profile';

    static inicializar(step = 'profile') {
        this.currentStep = step;
        this.configurarEventosSetup();
        this.mostrarEtapaSetup(step);
    }

    static configurarEventosSetup() {
        const btnNext = document.getElementById('btn-next');
        const btnPrevious = document.getElementById('btn-previous');
        const btnFinish = document.getElementById('btn-finish');
        const btnAddAccount = document.getElementById('add-account');

        if (btnNext) btnNext.addEventListener('click', () => this.proximaEtapaSetup());
        if (btnPrevious) btnPrevious.addEventListener('click', () => this.etapaAnteriorSetup());
        if (btnFinish) btnFinish.addEventListener('click', () => this.finalizarSetup());
        if (btnAddAccount) btnAddAccount.addEventListener('click', () => this.adicionarConta());

        document.querySelectorAll('.add-category').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.adicionarCategoria(e.target.dataset.type);
            });
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-account')) {
                e.target.closest('.account-item').remove();
            }
            if (e.target.classList.contains('remove-category')) {
                e.target.closest('.category-item').remove();
            }
        });
    }

    static mostrarEtapaSetup(step) {
        const steps = ['profile', 'accounts', 'categories', 'finish'];
        const currentIndex = steps.indexOf(step);
        
        document.querySelectorAll('.progress-step').forEach((el, index) => {
            el.classList.remove('active', 'completed');
            if (index < currentIndex) el.classList.add('completed');
            else if (index === currentIndex) el.classList.add('active');
        });
        
        document.querySelectorAll('.setup-step').forEach(el => {
            el.classList.remove('active');
        });
        document.querySelector(`.setup-step[data-step="${step}"]`).classList.add('active');
        
        const btnPrevious = document.getElementById('btn-previous');
        const btnNext = document.getElementById('btn-next');
        const btnFinish = document.getElementById('btn-finish');
        
        btnPrevious.style.display = currentIndex > 0 ? 'block' : 'none';
        btnNext.style.display = currentIndex < steps.length - 1 ? 'block' : 'none';
        btnFinish.style.display = currentIndex === steps.length - 1 ? 'block' : 'none';
    }

    static async proximaEtapaSetup() {
        const stepAtual = document.querySelector('.setup-step.active').dataset.step;
        
        try {
            switch (stepAtual) {
                case 'profile':
                    await this.salvarPerfilSetup();
                    this.mostrarEtapaSetup('accounts');
                    break;
                case 'accounts':
                    await this.salvarContasSetup();
                    this.mostrarEtapaSetup('categories');
                    break;
                case 'categories':
                    await this.salvarCategoriasSetup();
                    this.mostrarEtapaSetup('finish');
                    this.gerarResumoSetup();
                    break;
            }
        } catch (error) {
            window.App.mostrarToast("Erro ao avançar. Verifique os dados.", "error");
        }
    }

    static etapaAnteriorSetup() {
        const stepAtual = document.querySelector('.setup-step.active').dataset.step;
        const steps = ['profile', 'accounts', 'categories', 'finish'];
        const currentIndex = steps.indexOf(stepAtual);
        
        if (currentIndex > 0) {
            this.mostrarEtapaSetup(steps[currentIndex - 1]);
        }
    }

    static async salvarPerfilSetup() {
        const nome = document.getElementById('profile-nome').value;
        const moeda = document.getElementById('profile-moeda').value;
        const pais = document.getElementById('profile-pais').value;
        
        if (!nome || !moeda) {
            throw new Error("Preencha todos os campos obrigatórios");
        }
        
        await criarPerfilUsuario(window.App.state.usuarioLogado.uid, {
            nome, moedaPrincipal: moeda, pais,
            email: window.App.state.usuarioLogado.email
        });
    }

    static async salvarContasSetup() {
        const accounts = [];
        document.querySelectorAll('.account-item').forEach(item => {
            const nome = item.querySelector('input').value;
            const tipo = item.querySelector('.account-type').value;
            if (nome) {
                accounts.push({ nome, tipo, moeda: 'EUR' });
            }
        });
        
        if (accounts.length === 0) {
            throw new Error("Adicione pelo menos uma conta");
        }
        
        await configurarContasIniciais(window.App.state.usuarioLogado.uid, {
            fontes: accounts,
            moedas: [{ codigo: 'EUR', taxa: 1.0 }],
            moedaPrincipal: 'EUR'
        });
    }

    static async salvarCategoriasSetup() {
        const despesas = [];
        const receitas = [];
        
        document.querySelectorAll('#expense-categories .category-item input').forEach(input => {
            if (input.value) despesas.push(input.value);
        });
        
        document.querySelectorAll('#income-categories .category-item input').forEach(input => {
            if (input.value) receitas.push(input.value);
        });
        
        // Verifique se a chamada abaixo inclui tanto 'despesas' quanto 'receitas'
        await configurarCategoriasIniciais(window.App.state.usuarioLogado.uid, {
            despesas, receitas
        });
    }

    static adicionarConta() {
        const container = document.getElementById('accounts-list');
        const item = document.createElement('div');
        item.className = 'account-item';
        item.innerHTML = `
            <input type="text" placeholder="Nome da conta" required>
            <select class="account-type">
                <option value="Banco">Banco</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Cartão">Cartão</option>
            </select>
            <button type="button" class="btn btn-sm btn-danger remove-account">
                <i class="fas fa-trash"></i>
            </button>
        `;
        container.appendChild(item);
    }

    static adicionarCategoria(tipo) {
        const container = tipo === 'expense' ? 
            document.getElementById('expense-categories') : 
            document.getElementById('income-categories');
        
        const item = document.createElement('div');
        item.className = 'category-item';
        item.innerHTML = `
            <input type="text" placeholder="Nome da categoria">
            <button type="button" class="btn btn-sm btn-danger remove-category">
                <i class="fas fa-trash"></i>
            </button>
        `;
        container.appendChild(item);
    }

    static gerarResumoSetup() {
        const summary = document.getElementById('setup-summary');
        summary.innerHTML = `
            <h5>Resumo das Configurações</h5>
            <p><strong>Perfil:</strong> Configurado</p>
            <p><strong>Contas:</strong> ${document.querySelectorAll('.account-item').length} conta(s) adicionada(s)</p>
            <p><strong>Categorias:</strong> ${document.querySelectorAll('#expense-categories .category-item').length} despesas, ${document.querySelectorAll('#income-categories .category-item').length} receitas</p>
        `;
    }

    static async finalizarSetup() {
        try {
            window.App.mostrarLoading(true, '#btn-finish');
            await finalizarSetupUsuario(window.App.state.usuarioLogado.uid);
            window.App.mostrarToast("Configuração concluída com sucesso!", "success");
            await window.App.inicializarAplicacao(window.App.state.usuarioLogado);
        } catch (error) {
            window.App.mostrarToast("Erro ao finalizar configuração", "error");
        } finally {
            window.App.mostrarLoading(false, '#btn-finish');
        }
    }
}

window.SetupController = SetupController;