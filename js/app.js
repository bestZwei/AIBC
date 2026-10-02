/**
 * 应用主入口
 * 初始化应用的各个模块
 * 协调不同模块之间的交互
 * 管理应用的整体状态
 */

class App {
  constructor() {
    this.isInitialized = false;
    this.contentCheckInterval = null;
  }
  
  /**
   * 初始化应用
   */
  async initialize() {
    try {
      // 显示初始化消息
      console.log('%c AIBC - AI广播电台 ', 'background: #3a0ca3; color: white; padding: 8px; font-size: 16px; border-radius: 4px;');
      console.log('%c 正在初始化... ', 'color: #f72585; font-size: 14px;');
      
      // 初始化顺序很重要
      // 0. 首先初始化主题管理器
      themeManager.initialize();
      
      // 1. 接着初始化UI
      if (!ui.initialize()) {
        throw new Error('UI初始化失败');
      }
      
      // 设置初始主题图标
      ui.updateThemeIcon(themeManager.getCurrentTheme());
      ui.updateStatus('正在初始化系统...');
      
      // 1.5 初始化帮助提示系统
      helpTips.initialize();
      
      // 1.8 初始化统计系统
      statsManager.initialize();
      
      // 2. 初始化API服务
      const apiInitResult = await apiService.initialize();
      if (!apiInitResult) {
        ui.updateStatus('API服务初始化失败，部分功能可能不可用');
        console.warn('API服务初始化失败，继续初始化其他模块');
      }
      
      // 3. 初始化音频管理器
      if (!audioManager.initialize()) {
        throw new Error('音频系统初始化失败');
      }
      
      // 4. 初始化频道管理器
      const defaultStationId = utils.getLocalStorage('activeStation', config.app.defaultStation);
      if (!stationManager.initialize(defaultStationId)) {
        throw new Error('频道管理器初始化失败');
      }
      
      // 5. 初始化提示生成器
      promptGenerator.initialize(stationManager.getActiveStation());
      
      // 设置各模块间的通信
      this.setupModuleCommunication();
      
      // 生成初始内容
      await stationManager.ensureActiveStationContent();
      
      // 设置内容检查定时器
      this.startContentChecker();
      
      // 如果设置了自动播放，开始播放
      if (config.app.autoPlayNext) {
        // 给用户一些视觉反馈的时间
        setTimeout(() => {
          ui.togglePlayPause(true);
        }, 1000);
      }
      
      this.isInitialized = true;
      ui.updateStatus('系统已准备就绪');
      
      utils.log('success', 'AIBC应用初始化完成');
      return true;
    } catch (error) {
      ui.updateStatus('初始化失败: ' + error.message);
      utils.log('error', '应用初始化失败', error);
      return false;
    }
  }
  
  /**
   * 设置模块间的通信
   */
  setupModuleCommunication() {
    // 音频管理器的音频结束事件
    audioManager.setOnAudioEnd(() => {
      // 当一个音频播放完毕，检查是否需要生成更多内容
      try {
        // 如果音频队列已空，确保有新内容生成
        if (audioManager.getQueueLength() === 0) {
          utils.log('info', '音频队列为空，生成新内容');
          this.ensureContentGeneration();
        } else {
          // 队列中还有内容，但检查是否需要补充
          stationManager.ensureActiveStationContent();
        }
        
        ui.updateStatus('继续播放...');
      } catch (error) {
        utils.log('error', '处理音频结束事件失败', error);
        ui.updateStatus('播放中断，正在恢复...');
        
        // 尝试恢复播放
        setTimeout(() => {
          this.ensureContentGeneration();
        }, 1000);
      }
    });
    
    // 频道管理器的状态变更事件
    stationManager.setOnStateChange((state) => {
      // 将状态变更传递给UI
      ui.handleStateChange(state);
      
      // 保存活动频道到本地存储
      if (state.type === 'stationChange' && state.station) {
        utils.setLocalStorage('activeStation', state.station.id);
      }
    });
  }
  
  /**
   * 确保内容生成
   * 当遇到内容中断时尝试恢复播放流
   */
  async ensureContentGeneration() {
    if (!this.isInitialized) return;
    
    const activeStation = stationManager.getActiveStation();
    if (!activeStation) return;
    
    try {
      // 首先检查是否有足够的内容
      await stationManager.ensureActiveStationContent();
      
      // 如果队列仍然为空，尝试强制生成新内容
      if (audioManager.getQueueLength() === 0 && !stationManager.isGeneratingContent) {
        utils.log('info', '强制生成新内容');
        await stationManager.generateStationContent(activeStation.id);
      }
    } catch (error) {
      utils.log('error', '确保内容生成失败', error);
      
      // 如果生成失败，显示错误信息
      ui.updateStatus('内容生成失败，稍后将重试...');
      
      // 延迟后再次尝试
      setTimeout(() => {
        this.ensureContentGeneration();
      }, 3000);
    }
  }
  
  /**
   * 启动内容检查定时器
   */
  startContentChecker() {
    // 清除可能存在的旧定时器
    if (this.contentCheckInterval) {
      clearInterval(this.contentCheckInterval);
    }
    
    // 每5秒检查一次是否需要生成更多内容
    this.contentCheckInterval = setInterval(() => {
      if (this.isInitialized && audioManager.isPlaying) {
        stationManager.ensureActiveStationContent();
      }
    }, 5000);
  }
  
  /**
   * 停止内容检查定时器
   */
  stopContentChecker() {
    if (this.contentCheckInterval) {
      clearInterval(this.contentCheckInterval);
      this.contentCheckInterval = null;
    }
  }
  
  /**
   * 清理资源
   */
  cleanup() {
    this.stopContentChecker();
    audioManager.stop();
    this.isInitialized = false;
    utils.log('info', '应用资源已清理');
  }
}

// 创建应用实例并在页面加载完成后初始化
const app = new App();

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', async () => {
  await app.initialize();
});

// Initialize UI and other modules
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize core modules
    themeManager.initialize();
    ui.initialize();
    helpTips.initialize();
    audioManager.initialize();
    statsManager.initialize();
    await stationManager.initialize(); 

    // Initialize continuous play mode button state
    ui.updateContinuousModeButton(stationManager.isContinuousPlayModeEnabled());

    // Show welcome messages
    ui.updateStatus('欢迎使用AIBC - AI广播电台');
    
    // Show first-time help if needed
    const isFirstTime = localStorage.getItem('aibc-first-visit') !== 'false';
    if (isFirstTime) {
      setTimeout(() => {
        helpTips.showFeatureHelp('welcome');
        localStorage.setItem('aibc-first-visit', 'false');
      }, 1000);
    }
    
    utils.log('info', 'AIBC应用已成功初始化');
  } catch (error) {
    utils.log('error', '应用初始化失败', error);
    ui.updateStatus('应用加载失败，请刷新页面重试');
  }
});

// 页面关闭前清理资源
window.addEventListener('beforeunload', () => {
  app.cleanup();
});
