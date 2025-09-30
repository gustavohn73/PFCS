// public/js/main.js
import { App } from './core/app.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOM Carregado - Iniciando App');
    App.init();
});

// Exportar App globalmente
window.App = App;

// ✅ NOVO: Exportar funções para Configurações
window.adicionarCentroCusto = async () => {
    const { ConfiguracoesController } = await import('./pages/configuracoes.js');
    ConfiguracoesController.abrirAdicao('centro');
};

window.adicionarMoeda = async () => {
    const { ConfiguracoesController } = await import('./pages/configuracoes.js');
    ConfiguracoesController.abrirAdicao('moeda');
};

window.adicionarCategoria = async (tipo) => {
    const { ConfiguracoesController } = await import('./pages/configuracoes.js');
    ConfiguracoesController.abrirAdicao('categoria', tipo);
};

window.adicionarFonte = async () => {
    const { ConfiguracoesController } = await import('./pages/configuracoes.js');
    ConfiguracoesController.abrirAdicao('fonte');
};