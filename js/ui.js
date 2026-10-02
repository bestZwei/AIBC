/**
 * UI管理模块
 * 处理所有DOM操作和事件监听
 * 更新UI元素以反映当前应用状态
 * 管理视觉效果如音频可视化
 */

class UI {
  constructor() {
    // 主要UI元素
    this.elements = {
      playPauseBtn: null,
      volumeSlider: null,
      stationsList: null,
      stationName: null,
      programTitle: null,
      liveText: null,
      userInput: null,
      submitBtn: null,
      interactionHistory: null,
      statusMessage: null,
      onAirIndicator: null,
      visualizerCanvas: null,
      modal: null,
      modalClose: null,
      aboutLink: null,
      themeToggle: null,
      helpButton: null
    };
    
    this.visualizerCtx = null;
    this.isModalOpen = false;
  }
  
  /**
   * 初始化UI
   */
  initialize() {
    this.cacheElements();
    this.setupEventListeners();
    this.setupVisualizer();
    this.setupKeyboardShortcuts();
    this.updatePlayPauseButton(false);
    this.renderStationsList();
    
    utils.log('info', 'UI初始化完成');
    return true;
  }
  
  /**
   * 缓存DOM元素引用
   */
  cacheElements() {
    this.elements.playPauseBtn = document.getElementById('play-pause');
    this.elements.volumeSlider = document.getElementById('volume');
    this.elements.stationsList = document.getElementById('stations-list');
    this.elements.stationName = document.getElementById('station-name');
    this.elements.programTitle = document.getElementById('program-title');
    this.elements.liveText = document.getElementById('live-text');
    this.elements.userInput = document.getElementById('user-input');
    this.elements.submitBtn = document.getElementById('submit-input');
    this.elements.interactionHistory = document.getElementById('interaction-history');
    this.elements.statusMessage = document.getElementById('status-message');
    this.elements.onAirIndicator = document.getElementById('on-air-indicator');
    this.elements.visualizerCanvas = document.getElementById('visualizer');
    this.elements.modal = document.getElementById('modal');
    this.elements.modalClose = this.elements.modal.querySelector('.close');
    this.elements.aboutLink = document.getElementById('about-link');
    this.elements.themeToggle = document.getElementById('theme-toggle');
    this.elements.helpButton = document.getElementById('help-button');
    
    // 可视化类型按钮
    this.elements.visualizerBars = document.getElementById('visualizer-type-bars');
    this.elements.visualizerWave = document.getElementById('visualizer-type-wave');
    this.elements.visualizerCircular = document.getElementById('visualizer-type-circular');
    
    // 统计相关元素
    this.elements.statsButton = document.getElementById('stats-button');
    this.elements.statsModal = document.getElementById('stats-modal');
    this.elements.statsModalClose = this.elements.statsModal.querySelector('.close');
    this.elements.clearStatsBtn = document.getElementById('clear-stats');
    this.elements.closeStatsBtn = document.getElementById('close-stats');
    this.elements.statsTotalTime = document.getElementById('stats-total-time');
    this.elements.statsSessions = document.getElementById('stats-sessions');
    this.elements.statsInteractions = document.getElementById('stats-interactions');
    this.elements.stationsStatsList = document.getElementById('stats-stations-list');
  }
  
  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 播放/暂停按钮
    this.elements.playPauseBtn.addEventListener('click', () => {
      const isPlaying = this.elements.playPauseBtn.classList.contains('pause');
      this.togglePlayPause(!isPlaying);
    });
    
    // 24小时连续播放模式切换按钮
    this.elements.continuousModeToggle = document.getElementById('continuous-mode-toggle');
    this.elements.continuousModeToggle.addEventListener('click', () => {
      const isEnabled = stationManager.isContinuousPlayModeEnabled();
      stationManager.setContinuousPlayMode(!isEnabled);
      this.updateContinuousModeButton(!isEnabled);
      utils.addTemporaryClass(this.elements.continuousModeToggle, 'button-press');
    });
    
    // 主题切换按钮
    this.elements.themeToggle.addEventListener('click', () => {
      this.toggleTheme();
      utils.addTemporaryClass(this.elements.themeToggle, 'button-press');
    });
    
    // 帮助按钮
    this.elements.helpButton.addEventListener('click', () => {
      this.showHelp();
      utils.addTemporaryClass(this.elements.helpButton, 'button-press');
    });
    
    // 可视化效果类型切换按钮
    this.elements.visualizerBars.addEventListener('click', () => {
      this.changeVisualizerType('bars');
    });
    
    this.elements.visualizerWave.addEventListener('click', () => {
      this.changeVisualizerType('wave');
    });
    
    this.elements.visualizerCircular.addEventListener('click', () => {
      this.changeVisualizerType('circular');
    });
    
    // 音量滑块
    this.elements.volumeSlider.addEventListener('input', (e) => {
      const volume = parseFloat(e.target.value);
      audioManager.setVolume(volume);
      utils.addTemporaryClass(e.target.previousElementSibling, 'volume-change');
    });
    
    // 提交用户输入
    this.elements.submitBtn.addEventListener('click', () => {
      this.handleUserSubmit();
      utils.addTemporaryClass(this.elements.submitBtn, 'button-press');
    });
    
    // 用户输入回车键提交
    this.elements.userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleUserSubmit();
      }
    });
    
    // 模态框相关
    this.elements.aboutLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.openModal();
    });
    
    this.elements.modalClose.addEventListener('click', () => {
      this.closeModal();
    });
    
    window.addEventListener('click', (e) => {
      if (e.target === this.elements.modal) {
        this.closeModal();
      }
    });
    
    // 统计相关
    this.elements.statsButton.addEventListener('click', () => {
      this.openStatsModal();
    });
    
    this.elements.statsModalClose.addEventListener('click', () => {
      this.closeStatsModal();
    });
    
    this.elements.closeStatsBtn.addEventListener('click', () => {
      this.closeStatsModal();
    });
    
    this.elements.clearStatsBtn.addEventListener('click', () => {
      if (confirm('确定要清除所有收听统计数据吗？此操作不可恢复。')) {
        statsManager.clearStats();
        this.updateStatsDisplay();
        this.updateStatus('已清除统计数据');
      }
    });
    
    window.addEventListener('click', (e) => {
      if (e.target === this.elements.statsModal) {
        this.closeStatsModal();
      }
    });
    
    // 窗口大小改变时重新调整可视化器
    window.addEventListener('resize', () => {
      this.resizeVisualizer();
    });
  }
  
  /**
   * 显示帮助提示
   */
  showHelp() {
    helpTips.showFeatureHelp('general');
    this.updateStatus('正在显示帮助提示');
  }
  
  /**
   * 切换主题
   */
  toggleTheme() {
    const newTheme = themeManager.toggleTheme();
    this.updateThemeIcon(newTheme);
    this.updateStatus(`已切换至${newTheme === 'dark' ? '暗色' : '亮色'}主题`);
  }
  
  /**
   * 更新主题图标
   * @param {string} theme 当前主题
   */
  updateThemeIcon(theme) {
    const icon = this.elements.themeToggle.querySelector('i');
    if (theme === 'dark') {
      icon.className = 'fas fa-moon';
    } else {
      icon.className = 'fas fa-sun';
    }
  }
  
  /**
   * 设置音频可视化器
   */
  setupVisualizer() {
    const canvas = this.elements.visualizerCanvas;
    this.visualizerCtx = canvas.getContext('2d');
    
    // 设置画布大小
    this.resizeVisualizer();
    
    // 设置音频管理器的可视化数据回调
    audioManager.setOnVisualizerData(this.updateVisualizer.bind(this));
  }
  
  /**
   * 设置键盘快捷键
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // 如果用户正在输入框中输入内容，不触发快捷键
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        return;
      }
      
      // 如果模态框打开，只响应ESC键
      if (this.isModalOpen && e.key === 'Escape') {
        this.closeModal();
        e.preventDefault();
        return;
      }
      
      switch (e.key) {
        case ' ': // 空格键控制播放/暂停
          const isPlaying = this.elements.playPauseBtn.classList.contains('pause');
          this.togglePlayPause(!isPlaying);
          e.preventDefault();
          break;
          
        case 'ArrowUp': // 上箭头增加音量
          const currentVolume = parseFloat(this.elements.volumeSlider.value);
          const newVolume = Math.min(1, currentVolume + 0.1);
          this.elements.volumeSlider.value = newVolume;
          audioManager.setVolume(newVolume);
          this.updateStatus(`音量: ${Math.round(newVolume * 100)}%`);
          e.preventDefault();
          break;
          
        case 'ArrowDown': // 下箭头减小音量
          const curVolume = parseFloat(this.elements.volumeSlider.value);
          const downVolume = Math.max(0, curVolume - 0.1);
          this.elements.volumeSlider.value = downVolume;
          audioManager.setVolume(downVolume);
          this.updateStatus(`音量: ${Math.round(downVolume * 100)}%`);
          e.preventDefault();
          break;
          
        case '1': case '2': case '3': case '4': case '5': // 数字键1-5切换频道
          const stationIndex = parseInt(e.key) - 1;
          const stations = stationManager.getAllStations();
          if (stationIndex >= 0 && stationIndex < stations.length) {
            this.handleStationChange(stations[stationIndex].id);
            this.updateStatus(`切换至: ${stations[stationIndex].name}`);
          }
          break;
          
        case 'v': case 'V': // v键切换可视化效果
          const currentType = config.audio.visualizerSettings.type;
          const types = ['bars', 'wave', 'circular'];
          const currentIndex = types.indexOf(currentType);
          const nextIndex = (currentIndex + 1) % types.length;
          this.changeVisualizerType(types[nextIndex]);
          break;
          
        case 't': case 'T': // t键切换主题
          this.toggleTheme();
          break;
          
        case 'h': case 'H': // h键显示帮助
          this.showHelp();
          break;
          
        case 'i': case 'I': // i键关于信息
          this.openModal();
          break;
      }
    });
    
    // 添加键盘快捷键到帮助提示中
    this.addKeyboardShortcutsToHelp();
  }
  
  /**
   * 将键盘快捷键信息添加到帮助提示
   */
  addKeyboardShortcutsToHelp() {
    if (!helpTips || !helpTips.tips) return;
    
    // 添加键盘快捷键类别
    helpTips.tips.keyboard = [
      '空格键: 播放/暂停',
      '上/下箭头: 调整音量',
      '数字键1-5: 切换频道',
      'V键: 切换音频可视化效果',
      'T键: 切换亮色/暗色主题',
      'H键: 显示帮助信息',
      'I键: 显示关于窗口',
      'ESC键: 关闭弹窗'
    ];
    
    // 更新general类别的信息
    if (helpTips.tips.general) {
      helpTips.tips.general.push('可使用键盘快捷键快速操作，按H键查看所有快捷键。');
    }
  }
  
  /**
   * 调整可视化器大小
   */
  resizeVisualizer() {
    const canvas = this.elements.visualizerCanvas;
    const container = canvas.parentElement;
    
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }
  
  /**
   * 更新音频可视化效果
   * @param {Uint8Array} dataArray 频率数据
   */
  updateVisualizer(dataArray) {
    const canvas = this.elements.visualizerCanvas;
    const ctx = this.visualizerCtx;
    const settings = config.audio.visualizerSettings;
    
    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 确定是使用哪种可视化效果 (bars, wave, circular)
    const visualizerType = settings.type || 'bars';
    
    switch(visualizerType) {
      case 'wave':
        this.drawWaveform(dataArray, canvas, ctx);
        break;
      case 'circular':
        this.drawCircularVisualizer(dataArray, canvas, ctx);
        break;
      case 'bars':
      default:
        this.drawBars(dataArray, canvas, ctx);
        break;
    }
  }
  
  /**
   * 绘制条形可视化效果
   * @param {Uint8Array} dataArray 频率数据
   * @param {HTMLCanvasElement} canvas 画布元素
   * @param {CanvasRenderingContext2D} ctx 画布上下文
   */
  drawBars(dataArray, canvas, ctx) {
    const settings = config.audio.visualizerSettings;
    
    // 设置颜色渐变
    let gradient;
    if (settings.barGradient && settings.barGradient.length >= 2) {
      gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
      gradient.addColorStop(0, settings.barGradient[0]);
      gradient.addColorStop(1, settings.barGradient[1]);
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = settings.barColor;
    }
    
    // 计算条形宽度和间距
    const bufferLength = dataArray.length;
    const barCount = Math.min(bufferLength, settings.barCount);
    const barWidth = canvas.width / barCount * 0.8;
    const barSpacing = canvas.width / barCount * 0.2;
    const barHeightFactor = canvas.height / 255;
    
    // 绘制条形图
    for (let i = 0; i < barCount; i++) {
      const index = Math.floor(i * (bufferLength / barCount));
      const barHeight = dataArray[index] * barHeightFactor;
      
      // 添加动态效果：使用音频数据调整条形样式
      const x = i * (barWidth + barSpacing);
      const y = canvas.height - barHeight;
      
      // 绘制圆角矩形
      if (settings.roundedBars) {
        const radius = Math.min(barWidth / 2, 4);
        this.drawRoundedRect(ctx, x, y, barWidth, barHeight, radius);
      } else {
        ctx.fillRect(x, y, barWidth, barHeight);
      }
      
      // 添加镜面效果
      if (settings.mirror) {
        const mirrorHeight = barHeight * 0.4;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x, 0, barWidth, mirrorHeight);
        ctx.globalAlpha = 1.0;
      }
    }
  }
  
  /**
   * 绘制波形可视化效果
   * @param {Uint8Array} dataArray 频率数据
   * @param {HTMLCanvasElement} canvas 画布元素
   * @param {CanvasRenderingContext2D} ctx 画布上下文
   */
  drawWaveform(dataArray, canvas, ctx) {
    const settings = config.audio.visualizerSettings;
    const bufferLength = dataArray.length;
    const sliceWidth = canvas.width / bufferLength;
    
    // 设置波形样式
    ctx.lineWidth = settings.waveLineWidth || 2;
    ctx.strokeStyle = settings.waveColor || settings.barColor;
    
    // 创建波形渐变
    if (settings.waveGradient && settings.waveGradient.length >= 2) {
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, settings.waveGradient[0]);
      gradient.addColorStop(1, settings.waveGradient[1]);
      ctx.strokeStyle = gradient;
    }
    
    ctx.beginPath();
    
    let x = 0;
    
    // 绘制波形路径
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * canvas.height / 2;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    // 如果要绘制填充区域
    if (settings.waveFill) {
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.lineTo(0, canvas.height / 2);
      ctx.fillStyle = settings.waveFillColor || 'rgba(67, 97, 238, 0.2)';
      ctx.fill();
    }
    
    ctx.stroke();
    
    // 如果要绘制镜像波形
    if (settings.mirrorWave) {
      ctx.beginPath();
      x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = canvas.height - (v * canvas.height / 2);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      ctx.globalAlpha = 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }
  }
  
  /**
   * 绘制环形可视化效果
   * @param {Uint8Array} dataArray 频率数据
   * @param {HTMLCanvasElement} canvas 画布元素
   * @param {CanvasRenderingContext2D} ctx 画布上下文
   */
  drawCircularVisualizer(dataArray, canvas, ctx) {
    const settings = config.audio.visualizerSettings;
    const bufferLength = dataArray.length;
    
    // 计算中心点和半径
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.8;
    
    // 角度间隔
    const angleStep = (2 * Math.PI) / settings.circleSegments;
    
    // 绘制环形可视化
    ctx.lineWidth = settings.circleLineWidth || 2;
    
    for (let i = 0; i < settings.circleSegments; i++) {
      // 计算索引以从数据数组中获取值
      const dataIndex = Math.floor(i * (bufferLength / settings.circleSegments));
      
      // 计算音频数据驱动的线条长度
      const value = dataArray[dataIndex] / 256;
      const innerRadius = radius * 0.4;
      const outerRadius = radius * (0.4 + value * 0.6);
      
      // 计算角度
      const angle = i * angleStep;
      
      // 计算坐标
      const innerX = centerX + innerRadius * Math.cos(angle);
      const innerY = centerY + innerRadius * Math.sin(angle);
      const outerX = centerX + outerRadius * Math.cos(angle);
      const outerY = centerY + outerRadius * Math.sin(angle);
      
      // 设置线条颜色
      if (settings.circleGradient) {
        // 基于值的HSL颜色
        const hue = (i / settings.circleSegments * 360) % 360;
        const saturation = 70 + 30 * value;
        const lightness = 40 + 20 * value;
        ctx.strokeStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      } else {
        ctx.strokeStyle = settings.circleColor || settings.barColor;
      }
      
      // 绘制线条
      ctx.beginPath();
      ctx.moveTo(innerX, innerY);
      ctx.lineTo(outerX, outerY);
      ctx.stroke();
    }
    
    // 绘制中心圆
    if (settings.circleCenterDot) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.1, 0, 2 * Math.PI);
      ctx.fillStyle = settings.circleCenterColor || settings.barColor;
      ctx.fill();
    }
  }
  
  /**
   * 绘制圆角矩形
   * @param {CanvasRenderingContext2D} ctx 画布上下文
   * @param {number} x X坐标
   * @param {number} y Y坐标
   * @param {number} width 宽度
   * @param {number} height 高度
   * @param {number} radius 圆角半径
   */
  drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }
  
  /**
   * 渲染频道列表
   */
  renderStationsList() {
    const stationsList = this.elements.stationsList;
    stationsList.innerHTML = '';
    
    const stations = stationManager.getAllStations();
    const activeStation = stationManager.getActiveStation();
    
    for (const station of stations) {
      const isActive = activeStation && station.id === activeStation.id;
      
      const stationBtn = document.createElement('button');
      stationBtn.className = `station-button station-transition ${isActive ? 'active' : ''}`;
      stationBtn.dataset.stationId = station.id;
      stationBtn.innerHTML = `<i class="fas ${station.icon}"></i> ${station.name}`;
      
      stationBtn.addEventListener('click', () => {
        this.handleStationChange(station.id);
      });
      
      stationsList.appendChild(stationBtn);
    }
  }
  
  /**
   * 更新频道选中状态
   * @param {string} stationId 频道ID
   */
  updateActiveStation(stationId) {
    const buttons = this.elements.stationsList.querySelectorAll('.station-button');
    
    buttons.forEach(btn => {
      if (btn.dataset.stationId === stationId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // 更新频道名称显示
    const station = stationManager.getStation(stationId);
    if (station) {
      this.elements.stationName.textContent = station.name;
    }
  }
  
  /**
   * 处理频道切换
   * @param {string} stationId 频道ID
   */
  async handleStationChange(stationId) {
    this.updateStatus('切换频道中...');
    this.elements.liveText.textContent = '加载中...';
    this.elements.programTitle.textContent = '准备节目中...';
    
    this.updateActiveStation(stationId);
    await stationManager.switchToStation(stationId);
  }
  
  /**
   * 处理用户输入提交
   */
  handleUserSubmit() {
    const userInput = this.elements.userInput.value.trim();
    if (!userInput) return;
    
    try {
      // 添加到交互历史
      this.addToInteractionHistory(userInput);
      
      // 显示提交反馈
      this.updateStatus('已接收您的留言，AI主播将很快回应');
      utils.addTemporaryClass(this.elements.submitBtn, 'button-press');
      
      // 传递给频道管理器处理
      stationManager.handleUserInput(userInput)
        .then(success => {
          if (!success) {
            this.updateStatus('处理您的留言时遇到问题，请稍后再试');
          } else if (!audioManager.isPlaying) {
            // 如果当前没有播放，提示用户可以点击播放
            setTimeout(() => {
              this.updateStatus('内容已准备就绪，点击播放按钮开始收听');
              utils.addTemporaryClass(this.elements.playPauseBtn, 'highlight-button');
            }, 1000);
          }
        })
        .catch(error => {
          utils.log('error', '处理用户输入失败', error);
          this.updateStatus('处理您的留言时出错');
        });
      
      // 清空输入框并聚焦，方便继续输入
      this.elements.userInput.value = '';
      this.elements.userInput.focus();
    } catch (error) {
      utils.log('error', '提交用户输入失败', error);
      this.updateStatus('提交留言失败，请重试');
    }
  }
  
  /**
   * 添加交互到历史记录
   * @param {string} userInput 用户输入
   * @param {string} response 可选的AI响应
   */
  addToInteractionHistory(userInput, response = null) {
    const interactionItem = document.createElement('div');
    interactionItem.className = 'interaction-item interaction-item-new';
    
    // 添加用户问题
    const question = document.createElement('div');
    question.className = 'interaction-question';
    question.textContent = `你: ${userInput}`;
    interactionItem.appendChild(question);
    
    // 如果有响应，添加响应
    if (response) {
      const responseElem = document.createElement('div');
      responseElem.className = 'interaction-response';
      responseElem.textContent = `AI主播: ${response}`;
      interactionItem.appendChild(responseElem);
    }
    
    // 添加到历史区域
    this.elements.interactionHistory.prepend(interactionItem);
    
    // 限制历史数量
    const items = this.elements.interactionHistory.querySelectorAll('.interaction-item');
    const maxItems = config.app.maxInteractionHistory;
    
    if (items.length > maxItems) {
      for (let i = maxItems; i < items.length; i++) {
        items[i].remove();
      }
    }
  }
  
  /**
   * 更新响应到特定用户输入
   * @param {string} userInput 用户输入
   * @param {string} response AI响应
   */
  updateInteractionResponse(userInput, response) {
    const items = this.elements.interactionHistory.querySelectorAll('.interaction-item');
    
    for (const item of items) {
      const question = item.querySelector('.interaction-question');
      if (question && question.textContent === `你: ${userInput}`) {
        // 已存在的问题，添加或更新响应
        let responseElem = item.querySelector('.interaction-response');
        
        if (!responseElem) {
          responseElem = document.createElement('div');
          responseElem.className = 'interaction-response fade-in';
          item.appendChild(responseElem);
        }
        
        responseElem.textContent = `AI主播: ${response}`;
        return;
      }
    }
    
    // 如果没找到，添加新条目
    this.addToInteractionHistory(userInput, response);
  }
  
  /**
   * 切换播放/暂停状态
   * @param {boolean} shouldPlay 是否应该播放
   */
  togglePlayPause(shouldPlay) {
    if (shouldPlay) {
      audioManager.resume();
    } else {
      audioManager.pause();
    }
    
    this.updatePlayPauseButton(shouldPlay);
    this.updateOnAirIndicator(shouldPlay);
  }
  
  /**
   * 更新播放/暂停按钮的状态
   * @param {boolean} isPlaying 是否正在播放
   */
  updatePlayPauseButton(isPlaying) {
    const btn = this.elements.playPauseBtn;
    
    if (isPlaying) {
      btn.classList.remove('play');
      btn.classList.add('pause');
      btn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
      btn.classList.remove('pause');
      btn.classList.add('play');
      btn.innerHTML = '<i class="fas fa-play"></i>';
    }
  }
  
  /**
   * 更新ON AIR指示灯状态
   * @param {boolean} isOn 是否亮起
   */
  updateOnAirIndicator(isOn) {
    const indicator = this.elements.onAirIndicator;
    
    if (isOn) {
      indicator.classList.remove('off');
    } else {
      indicator.classList.add('off');
    }
  }
  
  /**
   * 更新正在播放的内容文本
   * @param {string} text 内容文本
   * @param {string} segmentType 节目段类型
   */
  updateLiveText(text, segmentType) {
    this.elements.liveText.textContent = text;
    
    // 根据节目段类型设置节目标题
    this.updateProgramTitle(segmentType);
    
    // 添加淡入效果
    utils.addTemporaryClass(this.elements.liveText, 'fade-in');
  }
  
  /**
   * 更新节目标题
   * @param {string} segmentType 节目段类型
   */
  updateProgramTitle(segmentType) {
    let title = '正在播出';
    
    switch (segmentType) {
      case 'intro':
        title = '节目开场';
        break;
      case 'news':
        title = '新闻播报';
        break;
      case 'commentary':
        title = '新闻评论';
        break;
      case 'storyBegin':
      case 'storyMiddle':
      case 'storyEnd':
        title = '故事时间';
        break;
      case 'scienceTopic':
      case 'scienceFact':
        title = '科学探索';
        break;
      case 'dailyTopic':
      case 'funFact':
        title = '趣味话题';
        break;
      case 'guestIntro':
      case 'interviewQ1':
      case 'interviewA1':
      case 'interviewQ2':
      case 'interviewA2':
        title = '嘉宾访谈';
        break;
      case 'userInteraction':
        title = '听众互动';
        break;
      case 'transition':
        title = '节目过渡';
        break;
      case 'outro':
        title = '节目尾声';
        break;
      default:
        title = '正在播出';
    }
    
    this.elements.programTitle.textContent = title;
    utils.addTemporaryClass(this.elements.programTitle, 'fade-in');
  }
  
  /**
   * 更新状态消息
   * @param {string} message 状态消息
   */
  updateStatus(message) {
    this.elements.statusMessage.textContent = message;
    utils.addTemporaryClass(this.elements.statusMessage, 'status-update');
  }
  
  /**
   * 打开模态框
   */
  openModal() {
    this.elements.modal.style.display = 'block';
    this.isModalOpen = true;
  }
  
  /**
   * 关闭模态框
   */
  closeModal() {
    this.elements.modal.style.display = 'none';
    this.isModalOpen = false;
  }
  
  /**
   * 打开统计模态框
   */
  openStatsModal() {
    // 更新统计数据显示
    this.updateStatsDisplay();
    
    // 显示模态框
    this.elements.statsModal.style.display = 'block';
  }
  
  /**
   * 关闭统计模态框
   */
  closeStatsModal() {
    this.elements.statsModal.style.display = 'none';
  }
  
  /**
   * 更新统计数据显示
   */
  updateStatsDisplay() {
    // 获取格式化后的统计数据
    const stats = statsManager.getFormattedStats();
    
    // 更新摘要数据
    this.elements.statsTotalTime.textContent = stats.totalPlayTime;
    this.elements.statsSessions.textContent = stats.sessionCount;
    this.elements.statsInteractions.textContent = stats.interactionCount;
    
    // 更新频道统计列表
    this.elements.stationsStatsList.innerHTML = '';
    
    if (stats.stations.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-stats-message';
      emptyMessage.textContent = '暂无收听记录，开始收听广播后将自动记录统计数据。';
      this.elements.stationsStatsList.appendChild(emptyMessage);
      return;
    }
    
    // 为每个频道创建统计项
    stats.stations.forEach(station => {
      const stationItem = document.createElement('div');
      stationItem.className = 'station-stat-item';
      
      // 获取频道图标
      const stationObj = stationManager.getStation(station.id);
      const icon = stationObj ? stationObj.icon : 'fa-broadcast-tower';
      
      stationItem.innerHTML = `
        <div class="station-stat-name">
          <i class="fas ${icon}"></i>
          ${station.name}
        </div>
        <div class="station-stat-details">
          <span class="station-stat-time">${station.playTime}</span>
          <span>${station.interactionCount}次互动</span>
          <span>上次收听: ${station.lastPlayed}</span>
        </div>
      `;
      
      this.elements.stationsStatsList.appendChild(stationItem);
    });
  }
  
  /**
   * 处理应用状态变更
   * @param {Object} state 状态对象
   */
  handleStateChange(state) {
    if (!state) return;
    
    try {
      switch (state.type) {
        case 'stationChange':
          this.updateActiveStation(state.station.id);
          break;
          
        case 'contentGenerationStart':
          this.updateStatus('正在生成内容...');
          utils.addTemporaryClass(this.elements.visualizerCanvas.parentElement, 'active');
          break;
          
        case 'contentGenerated':
          this.updateLiveText(state.text, state.segmentType);
          this.updateStatus('内容已准备就绪');
          break;
          
        case 'contentGenerationError':
          this.updateStatus(`内容生成失败: ${state.error?.message || '未知错误'}`);
          // 显示错误指示并在3秒后隐藏
          utils.addTemporaryClass(this.elements.statusMessage, 'error-status', 3000);
          break;
          
        case 'transitionMessage':
          this.updateStatus(state.message);
          this.elements.liveText.textContent = state.message;
          // 添加过渡动画效果
          utils.addTemporaryClass(this.elements.liveText, 'fade-in');
          break;
          
        case 'contentReady':
          this.updateLiveText(state.text, state.segmentType);
          this.updateStatus('开始播放');
          // 确保播放按钮状态与实际一致
          this.updatePlayPauseButton(audioManager.isPlaying);
          this.updateOnAirIndicator(audioManager.isPlaying);
          break;
          
        case 'playbackError':
          this.updateStatus(`播放错误: ${state.error?.message || '音频播放失败'}`);
          utils.addTemporaryClass(this.elements.statusMessage, 'error-status', 3000);
          // 自动尝试恢复
          setTimeout(() => {
            if (audioManager.getQueueLength() > 0) {
              this.updateStatus('尝试恢复播放...');
              audioManager.playNext();
            }
          }, 1500);
          break;
          
        default:
          utils.log('warn', `未处理的状态类型: ${state.type}`);
      }
    } catch (error) {
      utils.log('error', '处理状态变更失败', error);
      this.updateStatus('系统状态更新失败');
    }
  }
  
  /**
   * 改变可视化效果类型
   * @param {string} type 可视化类型 ('bars', 'wave', 'circular')
   */
  changeVisualizerType(type) {
    // 更新配置
    config.audio.visualizerSettings.type = type;
    
    // 更新按钮状态
    this.elements.visualizerBars.classList.toggle('active', type === 'bars');
    this.elements.visualizerWave.classList.toggle('active', type === 'wave');
    this.elements.visualizerCircular.classList.toggle('active', type === 'circular');
    
    // 更新状态消息
    let typeName = '';
    switch(type) {
      case 'bars': typeName = '条形图'; break;
      case 'wave': typeName = '波形'; break;
      case 'circular': typeName = '环形'; break;
    }
    
    this.updateStatus(`已切换至${typeName}音频视觉效果`);
  }

  /**
   * 更新连续播放模式按钮状态
   * @param {boolean} isEnabled 是否启用连续播放模式
   */
  updateContinuousModeButton(isEnabled) {
    const button = this.elements.continuousModeToggle;
    if (isEnabled) {
      button.classList.add('active');
      this.updateStatus('已启用24小时连续播放模式');
    } else {
      button.classList.remove('active');
      this.updateStatus('已关闭24小时连续播放模式');
    }
  }
}

// 创建全局单例
const ui = new UI();
