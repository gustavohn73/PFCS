// js/mobile-gestures.js
export class MobileGestures {
  static init() {
    this.initPullToRefresh();
    this.initSwipeGestures();
    this.initTouchFeedback();
    this.initSidebarToggle();
  }
  
  static initPullToRefresh() {
    let startY = 0;
    let currentY = 0;
    let pulling = false;
    
    const mainContent = document.querySelector('.main-content');
    const refreshIndicator = this.createRefreshIndicator();
    
    if (!mainContent) return;
    
    mainContent.addEventListener('touchstart', (e) => {
      if (mainContent.scrollTop === 0) {
        startY = e.touches[0].pageY;
        pulling = true;
      }
    }, { passive: true });
    
    mainContent.addEventListener('touchmove', (e) => {
      if (!pulling) return;
      
      currentY = e.touches[0].pageY;
      const pullDistance = currentY - startY;
      
      if (pullDistance > 0 && pullDistance < 100) {
        refreshIndicator.style.transform = `translateY(${pullDistance - 60}px)`;
        refreshIndicator.style.opacity = pullDistance / 100;
      }
      
      if (pullDistance >= 100) {
        refreshIndicator.textContent = 'Solte para atualizar';
        refreshIndicator.classList.add('ready');
      }
    }, { passive: true });
    
    mainContent.addEventListener('touchend', (e) => {
      if (!pulling) return;
      
      const pullDistance = currentY - startY;
      pulling = false;
      
      if (pullDistance >= 100) {
        this.performRefresh();
      }
      
      refreshIndicator.style.transform = 'translateY(-60px)';
      refreshIndicator.style.opacity = '0';
      refreshIndicator.textContent = 'Puxe para atualizar';
      refreshIndicator.classList.remove('ready');
    }, { passive: true });
  }
  
  static createRefreshIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'pull-to-refresh';
    indicator.textContent = 'Puxe para atualizar';
    indicator.innerHTML = `
      <div class="d-flex align-items-center justify-content-center">
        <i class="fas fa-arrow-down me-2"></i>
        <span>Puxe para atualizar</span>
      </div>
    `;
    
    document.body.insertBefore(indicator, document.body.firstChild);
    return indicator;
  }
  
  static async performRefresh() {
    const indicator = document.querySelector('.pull-to-refresh');
    indicator.innerHTML = `
      <div class="d-flex align-items-center justify-content-center">
        <div class="spinner-border spinner-border-sm me-2" role="status"></div>
        <span>Atualizando...</span>
      </div>
    `;
    
    try {
      // Atualizar dados da página atual
      const currentController = window.App.currentController;
      if (currentController && currentController.carregarDados) {
        await currentController.carregarDados();
      } else if (window.DashboardController && window.DashboardController.carregarDashboard) {
        await window.DashboardController.carregarDashboard();
      }
      
      window.App.mostrarToast('Dados atualizados!', 'success');
      
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      window.App.mostrarToast('Erro ao atualizar dados', 'error');
    }
    
    setTimeout(() => {
      indicator.innerHTML = `
        <div class="d-flex align-items-center justify-content-center">
          <i class="fas fa-arrow-down me-2"></i>
          <span>Puxe para atualizar</span>
        </div>
      `;
    }, 1000);
  }
  
  static initSwipeGestures() {
    let startX = 0;
    let startY = 0;
    
    document.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
      if (!startX || !startY) return;
      
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      
      const diffX = startX - endX;
      const diffY = startY - endY;
      
      // Verificar se é um swipe horizontal
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        if (diffX > 0) {
          // Swipe left - abrir sidebar
          this.openSidebar();
        } else {
          // Swipe right - fechar sidebar
          this.closeSidebar();
        }
      }
      
      startX = 0;
      startY = 0;
    }, { passive: true });
  }
  
  static initTouchFeedback() {
    // Adicionar feedback tátil para botões importantes
    const buttons = document.querySelectorAll('.btn, .card, .transaction-item');
    
    buttons.forEach(button => {
      button.addEventListener('touchstart', () => {
        if (navigator.vibrate) {
          navigator.vibrate(50); // Vibração sutil
        }
      }, { passive: true });
    });
  }
  
  static initSidebarToggle() {
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = this.createSidebarOverlay();
    
    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', () => {
        this.toggleSidebar();
      });
    }
    
    // Fechar sidebar ao clicar no overlay
    overlay.addEventListener('click', () => {
      this.closeSidebar();
    });
  }
  
  static createSidebarOverlay() {
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
    }
    return overlay;
  }
  
  static toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar.classList.contains('show')) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  }
  
  static openSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar && overlay) {
      sidebar.classList.add('show');
      overlay.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  }
  
  static closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar && overlay) {
      sidebar.classList.remove('show');
      overlay.classList.remove('show');
      document.body.style.overflow = '';
    }
  }
}

// Auto-inicializar em dispositivos móveis
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
  document.addEventListener('DOMContentLoaded', () => {
    MobileGestures.init();
  });
}

window.MobileGestures = MobileGestures;
