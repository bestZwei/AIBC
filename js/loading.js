class LoadingManager {
    constructor() {
        this.loadingElement = null;
        this.isLoading = false;
        this.init();
    }
    
    init() {
        // 创建加载指示器元素
        this.loadingElement = document.createElement('div');
        this.loadingElement.className = 'loading-overlay hidden';
        this.loadingElement.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <div class="loading-text">正在生成内容...</div>
                <div class="loading-status"></div>
            </div>
        `;
        
        // 添加到文档
        document.body.appendChild(this.loadingElement);
    }
    
    showLoading(message = '正在生成内容...') {
        if (!this.loadingElement) return;
        
        this.loadingElement.querySelector('.loading-text').textContent = message;
        this.loadingElement.querySelector('.loading-status').textContent = '';
        this.loadingElement.classList.remove('hidden');
        this.isLoading = true;
    }
    
    hideLoading() {
        if (!this.loadingElement) return;
        
        this.loadingElement.classList.add('hidden');
        this.isLoading = false;
    }
    
    setMessage(message) {
        if (!this.loadingElement || !this.isLoading) return;
        
        this.loadingElement.querySelector('.loading-text').textContent = message;
    }
    
    setStatus(status) {
        if (!this.loadingElement || !this.isLoading) return;
        
        this.loadingElement.querySelector('.loading-status').textContent = status;
    }
    
    showApiError(error) {
        if (!this.loadingElement) return;
        
        this.loadingElement.querySelector('.loading-text').textContent = '请求失败';
        this.loadingElement.querySelector('.loading-status').textContent = `错误: ${error.message}`;
        this.loadingElement.querySelector('.loading-status').classList.add('error');
        
        // 3秒后自动隐藏
        setTimeout(() => {
            this.hideLoading();
            this.loadingElement.querySelector('.loading-status').classList.remove('error');
        }, 3000);
    }
}

// 创建加载管理器实例
const loadingManager = new LoadingManager();
