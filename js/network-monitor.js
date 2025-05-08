class NetworkMonitor {
    constructor() {
        this.isOnline = navigator.onLine;
        this.lastPingSuccess = null;
        this.pingInterval = null;
        this.pingUrl = 'https://www.google.com/favicon.ico'; // 用于检测网络连接的URL
        this.pingTimeout = 5000; // 5秒超时
        this.callbacks = {
            onStatusChange: null,
            onPingSuccess: null,
            onPingFailure: null
        };
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        // 监听在线/离线事件
        window.addEventListener('online', () => this.handleOnlineStatus(true));
        window.addEventListener('offline', () => this.handleOnlineStatus(false));
    }
    
    handleOnlineStatus(isOnline) {
        this.isOnline = isOnline;
        
        if (this.callbacks.onStatusChange) {
            this.callbacks.onStatusChange(isOnline);
        }
        
        // 如果回到在线状态，立即进行一次ping测试
        if (isOnline) {
            this.pingServer();
        }
    }
    
    // 开始监控网络状态
    startMonitoring(pingFrequency = 30000) {
        // 清除现有的interval
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        
        // 立即执行一次ping
        this.pingServer();
        
        // 设置定期ping
        this.pingInterval = setInterval(() => {
            this.pingServer();
        }, pingFrequency);
    }
    
    // 停止监控
    stopMonitoring() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    
    // 执行ping测试
    async pingServer() {
        if (!this.isOnline) {
            this.lastPingSuccess = false;
            if (this.callbacks.onPingFailure) {
                this.callbacks.onPingFailure('设备离线');
            }
            return;
        }
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.pingTimeout);
            
            const startTime = Date.now();
            const response = await fetch(this.pingUrl, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-store',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            const pingTime = Date.now() - startTime;
            this.lastPingSuccess = true;
            
            if (this.callbacks.onPingSuccess) {
                this.callbacks.onPingSuccess(pingTime);
            }
        } catch (error) {
            this.lastPingSuccess = false;
            
            let reason = '未知错误';
            if (error.name === 'AbortError') {
                reason = '请求超时';
            } else if (error.message.includes('Failed to fetch')) {
                reason = '网络连接失败';
            } else {
                reason = error.message;
            }
            
            if (this.callbacks.onPingFailure) {
                this.callbacks.onPingFailure(reason);
            }
        }
    }
    
    // 设置状态变化回调
    onStatusChange(callback) {
        this.callbacks.onStatusChange = callback;
    }
    
    // 设置ping成功回调
    onPingSuccess(callback) {
        this.callbacks.onPingSuccess = callback;
    }
    
    // 设置ping失败回调
    onPingFailure(callback) {
        this.callbacks.onPingFailure = callback;
    }
    
    // 获取当前网络状态
    getStatus() {
        return {
            isOnline: this.isOnline,
            lastPingSuccess: this.lastPingSuccess
        };
    }
}

// 创建网络监视器实例
const networkMonitor = new NetworkMonitor();
