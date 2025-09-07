import { DashboardController } from '../pages/transacoes-controller.js';
import { LancamentoController } from '../pages/lancamento.js';
import { SetupController } from '../pages/setup.js';
import { ConfiguracoesController } from '../pages/configuracoes.js';
import { ContasController } from '../pages/contas-controller.js';
import { ContaDetalhesController } from '../pages/conta-detalhes-controller.js';

export class Navigation {
    static configurarNavegacao() {
        const navItems = [
            { id: 'nav-logo', page: 'inicio' },
            { id: 'nav-inicio', page: 'inicio' },
            { id: 'nav-contas', page: 'contas' },
            { id: 'nav-transacoes', page: 'transacoes' },
            { id: 'nav-lancamento', page: 'lancamento' },
            { id: 'nav-despesas', page: 'despesas' },
            { id: 'nav-metas', page: 'metas' },
            { id: 'nav-configuracoes', page: 'configuracoes' }
        ];
    
        navItems.forEach(item => {
            const element = document.getElementById(item.id);
            if (element) {
                element.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.navigate(item.page);
                    this.updateActiveNav(item.id);
                });
            }
        });
    }

    static updateActiveNav(activeId) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
    
        const activeElement = document.getElementById(activeId);
        if (activeElement) {
            activeElement.classList.add('active');
        }
    }

    static async navigate(pageName, state = {}) {
        const appContent = document.getElementById('app-content');
        if (!appContent) return;

        if (!window.App.state.usuarioLogado && pageName !== 'setup') {
            console.log("Usuário não logado, redirecionando para login");
            return;
        }

        if (window.App.state.lancamentosListener) {
            window.App.state.lancamentosListener();
            window.App.state.lancamentosListener = null;
        }

        window.App.mostrarLoading(true);
        
        try {
            let response;
            if (pageName === 'setup') {
                response = await fetch(`./pages/setup.html`);
            } else {
                response = await fetch(`./pages/${pageName}.html`);
            }
            
            if (!response.ok) throw new Error(`Página ${pageName}.html não encontrada`);
            
            appContent.innerHTML = await response.text();
            appContent.querySelector('.page')?.classList.add('active');

            const navbar = document.querySelector('.navbar-collapse');
            if (navbar && navbar.classList.contains('show')) {
                const bsCollapse = new bootstrap.Collapse(navbar, { toggle: false });
                bsCollapse.hide();
            }
            
            setTimeout(() => this.inicializarPagina(pageName, state), 100);
            
        } catch (error) {
            console.error('Erro ao carregar página:', error);
            appContent.innerHTML = `
                <div class="alert alert-danger">
                    <h4>Erro ao carregar conteúdo</h4>
                    <p>${error.message}</p>
                    <button class="btn btn-primary" onclick="Navigation.navigate('inicio')">Voltar ao Início</button>
                </div>
            `;
        } finally {
            window.App.mostrarLoading(false);
        }
    }

    static inicializarPagina(pageName, params = {}) {
        console.log(`Inicializando página: ${pageName}`);
    
        switch (pageName) {
            case 'setup':
                SetupController.inicializar(params.step);
                break;
            case 'transacoes':
                DashboardController.inicializar();
                break;
            case 'inicio':
                import('../pages/overview-controller.js').then(module => {
                    if (module.OverviewController) {
                        module.OverviewController.inicializar();
                    }
                }).catch(error => {
                    console.error('Erro ao carregar OverviewController:', error);
                });
                break;
            case 'contas':
                ContasController.inicializar();
                break;
            case 'conta-detalhes':
                ContaDetalhesController.inicializar(params);
                break;
            case 'lancamento':
                LancamentoController.inicializar(params);
                break;
            case 'configuracoes':
                ConfiguracoesController.inicializar();
                if (typeof SettingsTabsController !== 'undefined') {
                    SettingsTabsController.inicializar();
                }
                break;
            default:
                console.log(`Página ${pageName} não possui inicialização específica`);
        }
    }

    static inicializarRelatorios() {
        console.log("Inicializando relatórios...");
    }

    static inicializarFluxoCaixa() {
        console.log("Inicializando fluxo de caixa...");
    }
}

// Mobile Navigation
document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuBtn = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
    const fab = document.querySelector('.fab');

    // Toggle sidebar mobile
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
            overlay.classList.toggle('active');
        });
    }

    // Fechar sidebar ao clicar no overlay
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('active');
        });
    }

    // Bottom navigation
    bottomNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            
            // Remove active de todos
            bottomNavItems.forEach(nav => nav.classList.remove('active'));
            // Adiciona active no clicado
            item.classList.add('active');
            
            // Navegar
            if (window.Navigation) {
                window.Navigation.navigate(page);
            }
        });
    });

    // FAB navigation
    if (fab) {
        fab.addEventListener('click', () => {
            if (window.Navigation) {
                window.Navigation.navigate('lancamento');
            }
        });
    }
});

window.Navigation = Navigation;