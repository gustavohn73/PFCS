// public/js/core/navigation.js

export class Navigation {
    static currentPage = null;

    static configurarNavegacao() {
        console.log('⚙️ Configurando navegação...');

        const navItems = [
            { id: 'nav-inicio', page: 'inicio' },
            { id: 'nav-contas', page: 'contas' },
            { id: 'nav-transacoes', page: 'transacoes' },
            { id: 'nav-configuracoes', page: 'configuracoes' }
            // ❌ Removido: nav-despesas e nav-metas (páginas não existem)
        ];

        navItems.forEach(item => {
            const element = document.getElementById(item.id);
            if (element) {
                // Remove listeners antigos
                element.replaceWith(element.cloneNode(true));
                const newElement = document.getElementById(item.id);

                newElement.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.navigate(item.page);
                    this.updateActiveNav(item.id);
                });
            }
        });

        // Configurar navegação mobile
        this.configurarMobileNav();
        this.configurarFAB();
    }

    static configurarMobileNav() {
        const mobileMenuBtn = document.getElementById('mobile-menu-toggle');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        if (mobileMenuBtn && sidebar && overlay) {
            // Remove listeners antigos
            mobileMenuBtn.replaceWith(mobileMenuBtn.cloneNode(true));
            const newBtn = document.getElementById('mobile-menu-toggle');

            newBtn.addEventListener('click', () => {
                sidebar.classList.toggle('mobile-open');
                overlay.classList.toggle('active');
            });

            overlay.addEventListener('click', () => {
                sidebar.classList.remove('mobile-open');
                overlay.classList.remove('active');
            });
        }

        // Bottom Navigation
        const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
        bottomNavItems.forEach(item => {
            item.replaceWith(item.cloneNode(true));
        });

        document.querySelectorAll('.bottom-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;

                document.querySelectorAll('.bottom-nav-item').forEach(nav =>
                    nav.classList.remove('active')
                );
                item.classList.add('active');

                this.navigate(page);

                // Fecha sidebar se estiver aberto
                if (sidebar && sidebar.classList.contains('mobile-open')) {
                    sidebar.classList.remove('mobile-open');
                    overlay.classList.remove('active');
                }
            });
        });
    }

    static configurarFAB() {
        const fab = document.querySelector('.fab');
        if (fab) {
            fab.replaceWith(fab.cloneNode(true));
            const newFab = document.querySelector('.fab');

            newFab.addEventListener('click', async () => {
                // Import dinâmico do controller
                const { LancamentoController } = await import('../pages/lancamento.js');
                await this.navigate('lancamento');
            });
        }
    }

    static updateActiveNav(activeId) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        const activeElement = document.getElementById(activeId);
        if (activeElement) {
            activeElement.classList.add('active');
        }

        // Atualizar bottom nav também
        const pageMap = {
            'nav-inicio': 'inicio',
            'nav-contas': 'contas',
            'nav-transacoes': 'transacoes',
            'nav-configuracoes': 'configuracoes'
        };

        const page = pageMap[activeId];
        if (page) {
            document.querySelectorAll('.bottom-nav-item').forEach(item => {
                item.classList.toggle('active', item.dataset.page === page);
            });
        }
    }

    static async navigate(pageName, state = {}) {
        const appContent = document.getElementById('app-content');
        if (!appContent) return;

        if (!window.App.state.usuarioLogado && pageName !== 'setup') {
            console.log("⚠️ Usuário não logado, redirecionando para login");
            return;
        }

        // Limpar listeners antigos
        if (window.App.state.lancamentosListener) {
            window.App.state.lancamentosListener();
            window.App.state.lancamentosListener = null;
        }

        window.App.mostrarLoading(true);

        try {
            const response = await fetch(`./pages/${pageName}.html`);

            if (!response.ok) {
                throw new Error(`Página ${pageName}.html não encontrada`);
            }

            appContent.innerHTML = await response.text();
            this.currentPage = pageName;

            // Fecha sidebar mobile se estiver aberto
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (sidebar && sidebar.classList.contains('mobile-open')) {
                sidebar.classList.remove('mobile-open');
                overlay.classList.remove('active');
            }

            // Aguarda o DOM estar pronto
            setTimeout(() => this.inicializarPagina(pageName, state), 100);

        } catch (error) {
            console.error('❌ Erro ao carregar página:', error);
            appContent.innerHTML = `
                <div class="alert alert-danger m-4">
                    <h4><i class="fas fa-exclamation-triangle"></i> Erro ao carregar conteúdo</h4>
                    <p>${error.message}</p>
                    <button class="btn btn-primary" onclick="Navigation.navigate('inicio')">
                        <i class="fas fa-home"></i> Voltar ao Início
                    </button>
                </div>
            `;
        } finally {
            window.App.mostrarLoading(false);
        }
    }

    static async inicializarPagina(pageName, params = {}) {
        console.log(`🔄 Inicializando página: ${pageName}`);

        try {
            switch (pageName) {
                case 'setup':
                    const { SetupController } = await import('../pages/setup.js');
                    SetupController.inicializar(params.step);
                    break;

                case 'transacoes':
                    const { DashboardController } = await import('../pages/transacoes-controller.js');
                    DashboardController.inicializar();
                    break;

                case 'inicio':
                    const { OverviewController } = await import('../pages/overview-controller.js');
                    OverviewController.inicializar();
                    break;

                case 'contas':
                    const { ContasController } = await import('../pages/contas-controller.js');
                    ContasController.inicializar();
                    break;

                case 'conta-detalhes':
                    const { ContaDetalhesController } = await import('../pages/conta-detalhes-controller.js');
                    ContaDetalhesController.inicializar(params);
                    break;

                case 'lancamento':
                    const { LancamentoController } = await import('../pages/lancamento.js');
                    LancamentoController.inicializar(params);
                    break;

                case 'configuracoes':
                    const { ConfiguracoesController } = await import('../pages/configuracoes.js');
                    ConfiguracoesController.inicializar();
                    break;

                default:
                    console.log(`ℹ️ Página ${pageName} não possui inicialização específica`);
            }
        } catch (error) {
            console.error(`❌ Erro ao inicializar ${pageName}:`, error);
            window.App.mostrarToast(`Erro ao carregar ${pageName}`, 'error');
        }
    }
}

window.Navigation = Navigation;