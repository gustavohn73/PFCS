// js/main.js
import { App } from './core/app.js';

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Funções globais para compatibilidade com HTML
window.App = App;
window.navegar = (page, params) => window.Navigation.navigate(page, params);
window.carregarDashboard = () => window.DashboardController?.carregarDashboard();
window.editarItem = (tipo, index) => console.log(`Editar ${tipo} no índice ${index}`);
window.removerItem = (tipo, index) => console.log(`Remover ${tipo} no índice ${index}`);
window.compartilharCentro = async (centroCustoId) => {
    const email = prompt("Digite o email do usuário para compartilhar:");
    if (email) {
        try {
            const { compartilharCentroCusto } = await import('./firestore-service.js');
            await compartilharCentroCusto(centroCustoId, email);
            window.App.mostrarToast("Centro de custo compartilhado com sucesso!", "success");
        } catch (error) {
            window.App.mostrarToast("Erro ao compartilhar centro de custo", "error");
        }
    }
};
window.editarCentro = (centroCustoId) => console.log(`Editar centro de custo ${centroCustoId}`);