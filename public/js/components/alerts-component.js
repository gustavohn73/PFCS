// js/components/alerts-component.js
import { verificarAlertasAvancados, marcarAlertaComoLido } from '../firestore-service.js';

export class AlertsComponent {
  static alertasAtivos = [];
  static container = null;
  
  static init() {
    this.criarContainer();
    this.verificarAlertas();
    
    // Verificar alertas a cada 5 minutos
    setInterval(() => {
      this.verificarAlertas();
    }, 5 * 60 * 1000);
  }
  
  static criarContainer() {
    // Criar container de alertas se não existir
    let container = document.getElementById('alerts-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'alerts-container';
      container.className = 'alerts-container position-fixed top-0 end-0 p-3';
      container.style.zIndex = '9999';
      document.body.appendChild(container);
    }
    this.container = container;
  }
  
  static async verificarAlertas() {
    if (!window.App.state.usuarioLogado) return;
    
    try {
      const userId = window.App.state.usuarioLogado.uid;
      const alertas = await verificarAlertasAvancados(userId);
      
      // Filtrar alertas novos
      const alertasNovos = alertas.filter(alerta => 
        !this.alertasAtivos.some(ativo => 
          ativo.categoria === alerta.categoria && ativo.titulo === alerta.titulo
        )
      );
      
      // Mostrar novos alertas
      alertasNovos.forEach(alerta => {
        this.mostrarAlerta(alerta);
      });
      
      this.alertasAtivos = alertas;
      this.atualizarIndicadorAlertas();
      
    } catch (error) {
      console.error('Erro ao verificar alertas:', error);
    }
  }
  
  static mostrarAlerta(alerta) {
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${alerta.tipo} alert-dismissible fade show shadow-sm`;
    alertElement.style.minWidth = '300px';
    alertElement.style.marginBottom = '10px';
    
    const urgenciaIcon = {
      'alta': 'fas fa-exclamation-triangle',
      'media': 'fas fa-exclamation-circle',
      'baixa': 'fas fa-info-circle'
    };
    
    alertElement.innerHTML = `
      <div class="d-flex align-items-start">
        <i class="${urgenciaIcon[alerta.urgencia]} me-2 mt-1"></i>
        <div class="flex-grow-1">
          <strong>${alerta.titulo}</strong>
          <div class="small">${alerta.mensagem}</div>
          ${alerta.valor ? `<div class="small mt-1"><strong>Valor: ${window.App.formatarMoeda(alerta.valor)}</strong></div>` : ''}
          ${alerta.acao ? `<button class="btn btn-sm btn-outline-${alerta.tipo} mt-2" onclick="AlertsComponent.executarAcao('${alerta.categoria}')">${alerta.acao}</button>` : ''}
        </div>
        <button type="button" class="btn-close btn-close-sm" onclick="AlertsComponent.fecharAlerta(this, '${alerta.categoria}')"></button>
      </div>
    `;
    
    this.container.appendChild(alertElement);
    
    // Auto-remover após 10 segundos (exceto alertas de alta urgência)
    if (alerta.urgencia !== 'alta') {
      setTimeout(() => {
        if (alertElement.parentNode) {
          alertElement.remove();
        }
      }, 10000);
    }
  }
  
  static fecharAlerta(buttonElement, categoria) {
    const alertElement = buttonElement.closest('.alert');
    if (alertElement) {
      alertElement.remove();
    }
    
    // Marcar como lido no banco
    if (window.App.state.usuarioLogado) {
      marcarAlertaComoLido(window.App.state.usuarioLogado.uid, categoria);
    }
  }
  
  static executarAcao(categoria) {
    switch (categoria) {
      case 'vencimentos':
        window.Navigation.navigate('transacoes', { filtro: 'vencendo' });
        break;
      case 'atraso':
        window.Navigation.navigate('transacoes', { filtro: 'atrasados' });
        break;
      case 'orcamento':
        window.Navigation.navigate('analytics');
        break;
      default:
        window.Navigation.navigate('inicio');
    }
  }
  
  static atualizarIndicadorAlertas() {
    // Atualizar badge de alertas na sidebar
    const badge = document.getElementById('alerts-badge');
    const count = this.alertasAtivos.filter(a => a.urgencia === 'alta').length;
    
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline';
        badge.className = 'badge bg-danger rounded-pill';
      } else {
        badge.style.display = 'none';
      }
    }
  }
}

// Inicializar quando o app estiver pronto
window.AlertsComponent = AlertsComponent;
