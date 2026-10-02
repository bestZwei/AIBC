/**
 * 音频播放管理器
 * 管理音频播放队列
 * 控制音频播放、暂停、音量等
 * 处理音频加载和缓冲
 * 实现无缝播放过渡
 */

class AudioManager {
  constructor() {
    this.audioContext = null;
    this.gainNode = null;
    this.analyserNode = null;
    
    this.currentAudio = null;
    this.audioQueue = [];
    this.isPlaying = false;
    this.volume = config.audio.defaultVolume;
    
    this.onAudioEnd = null;  // 回调函数，当音频播放结束时触发
    this.onVisualizerData = null;  // 回调函数，用于更新可视化效果
    
    this.visualizerDataArray = null;
    this.visualizerRAF = null;
    
    this.loadPromises = [];  // 跟踪正在加载的音频
  }
  
  /**
   * 初始化音频上下文和节点
   */
  initialize() {
    try {
      // 创建音频上下文
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      
      // 创建增益节点用于控制音量
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.volume;
      this.gainNode.connect(this.audioContext.destination);
      
      // 创建分析器节点用于可视化
      this.analyserNode = this.audioContext.createAnalyser();
      const visualSettings = config.audio?.visualizerSettings || {};
      
      // 确保 fftSize 在有效范围内 (32-32768，必须是2的幂)
      const defaultFftSize = 2048; // 常用默认值
      const fftSize = visualSettings.fftSize || defaultFftSize;
      
      // 验证 fftSize 是否有效 (必须是2的幂且在32-32768范围内)
      this.analyserNode.fftSize = (fftSize >= 32 && fftSize <= 32768) ? fftSize : defaultFftSize;
      
      // 设置平滑常数，添加默认值防止出错
      this.analyserNode.smoothingTimeConstant = 
        typeof visualSettings.smoothingTimeConstant === 'number' ? 
        visualSettings.smoothingTimeConstant : 0.8; // 默认值0.8
      
      this.analyserNode.connect(this.gainNode);
      
      // 准备可视化数据数组
      this.visualizerDataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
      
      // 启动连续播放监控
      this.startContinuousPlayMonitor();
      
      // 从localStorage中恢复音量设置
      try {
        const savedVolume = localStorage.getItem('audioVolume');
        if (savedVolume !== null) {
          this.setVolume(parseFloat(savedVolume));
        }
      } catch (e) {
        utils.log('warning', '恢复音量设置失败', e);
      }
      
      utils.log('success', '音频系统初始化成功');
      return true;
    } catch (error) {
      utils.log('error', '音频系统初始化失败', error);
      return false;
    }
  }
  
  /**
   * 从Blob创建音频源
   * @param {Blob} blob 音频Blob数据
   * @returns {Promise<AudioBuffer>} 解码后的音频缓冲区
   */
  async createAudioSource(blob) {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      
      fileReader.onload = async (event) => {
        try {
          const arrayBuffer = event.target.result;
          const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          resolve(audioBuffer);
        } catch (error) {
          reject(error);
        }
      };
      
      fileReader.onerror = () => {
        reject(new Error('读取音频文件失败'));
      };
      
      fileReader.readAsArrayBuffer(blob);
    });
  }
  
  /**
   * 开始播放特定音频缓冲区
   * @param {AudioBuffer} audioBuffer 音频缓冲区
   * @param {boolean} fadeIn 是否淡入
   */
  playAudioBuffer(audioBuffer, fadeIn = true) {
    if (!this.audioContext || !audioBuffer) return;
    
    // 如果音频上下文被暂停，恢复它
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    // 创建音频源节点
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.analyserNode);
    
    // 设置结束回调
    source.onended = () => {
      this.currentAudio = null;
      this.playNext();
      
      if (this.onAudioEnd) {
        this.onAudioEnd();
      }
    };
    
    // 应用淡入效果
    if (fadeIn) {
      const now = this.audioContext.currentTime;
      this.gainNode.gain.setValueAtTime(0, now);
      this.gainNode.gain.linearRampToValueAtTime(
        this.volume, 
        now + config.audio.fadeInDuration
      );
    }
    
    // 开始播放
    source.start();
    this.currentAudio = source;
    this.isPlaying = true;
    
    // 开始可视化
    this.startVisualizer();
    
    utils.log('info', '开始播放音频', { 
      duration: audioBuffer.duration.toFixed(2) + 's', 
      queueLength: this.audioQueue.length 
    });
  }
  
  /**
   * 添加音频到播放队列
   * @param {Blob|Array<Blob>} audioBlob 单个音频Blob或Blob数组
   */
  async addToQueue(audioBlob) {
    if (!audioBlob) return;
    
    // 如果是数组，处理多个Blob
    if (Array.isArray(audioBlob)) {
      for (const blob of audioBlob) {
        await this.addToQueue(blob);
      }
      return;
    }
    
    try {
      // 创建加载Promise并跟踪
      const loadPromise = this.createAudioSource(audioBlob)
        .then(audioBuffer => {
          this.audioQueue.push(audioBuffer);
          
          // 如果当前没有播放音频且应该正在播放，启动播放
          if (!this.currentAudio && this.isPlaying) {
            this.playNext();
          }
          
          // 从加载列表中移除
          const index = this.loadPromises.indexOf(loadPromise);
          if (index > -1) {
            this.loadPromises.splice(index, 1);
          }
          
          return audioBuffer;
        })
        .catch(error => {
          utils.log('error', '音频加载失败', error);
          
          // 从加载列表中移除
          const index = this.loadPromises.indexOf(loadPromise);
          if (index > -1) {
            this.loadPromises.splice(index, 1);
          }
          
          throw error;
        });
      
      this.loadPromises.push(loadPromise);
      
      utils.log('info', '添加音频到队列', { 
        queueLength: this.audioQueue.length,
        loading: this.loadPromises.length
      });
    } catch (error) {
      utils.log('error', '添加音频到队列失败', error);
    }
  }
  
  /**
   * 将音频插入到队列前面（优先播放）
   * @param {Blob|Array<Blob>} audioBlob 音频数据
   * @returns {Promise<void>}
   */
  async insertAtFrontOfQueue(audioBlob) {
    if (!audioBlob) return;
    
    // 如果是数组，处理多个Blob
    if (Array.isArray(audioBlob)) {
      // 反向处理以保持原始顺序
      for (let i = audioBlob.length - 1; i >= 0; i--) {
        await this.insertAtFrontOfQueue(audioBlob[i]);
      }
      return;
    }
    
    try {
      // 创建加载Promise
      const audioBuffer = await this.createAudioSource(audioBlob);
      
      // 插入到队列前面
      this.audioQueue.unshift(audioBuffer);
      
      utils.log('info', '添加优先音频到队列前端', { 
        queueLength: this.audioQueue.length
      });
      
      // 如果当前没有播放中的音频且应处于播放状态，立即播放
      if (!this.currentAudio && this.isPlaying) {
        this.playNext();
      }
    } catch (error) {
      utils.log('error', '添加优先音频到队列失败', error);
    }
  }
  
  /**
   * 播放队列中的下一个音频
   * @param {boolean} useCrossFade 是否使用交叉淡入淡出（默认为false）
   */
  playNext(useCrossFade = false) {
    if (!this.isPlaying || this.audioQueue.length === 0) return;
    
    const nextAudio = this.audioQueue.shift();
    
    // 创建新的音频源节点
    const source = this.audioContext.createBufferSource();
    source.buffer = nextAudio;
    
    // 设置结束回调
    source.onended = () => {
      this.currentAudio = null;
      this.playNext();
      
      if (this.onAudioEnd) {
        this.onAudioEnd();
      }
    };
    
    // 如果支持交叉淡入淡出并且当前有正在播放的音频
    if (useCrossFade && this.currentAudio) {
      this.crossFade(source);
      source.start();
    } else {
      // 常规播放方式
      const fadeIn = !this.currentAudio; // 仅当没有当前音频时才淡入
      
      // 如果有当前音频，先停止它
      if (this.currentAudio) {
        this.currentAudio.stop();
        this.currentAudio = null;
      }
      
      // 连接并播放
      source.connect(this.analyserNode);
      this.currentAudio = source;
      
      if (fadeIn) {
        const now = this.audioContext.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(0, now);
        this.gainNode.gain.linearRampToValueAtTime(
          this.volume, 
          now + config.audio.fadeInDuration
        );
      } else {
        // 确保音量是正确的
        this.gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
      }
      
      source.start();
    }
    
    // 开始可视化
    this.startVisualizer();
    
    utils.log('info', '播放下一个音频', { 
      queueLength: this.audioQueue.length,
      useCrossFade: useCrossFade
    });
  }
  
  /**
   * 播放当前音频或队列中的下一个
   */
  playCurrentAudio() {
    if (this.currentAudio) {
      // 如果当前有音频正在播放，恢复它
      this.resume();
    } else if (this.audioQueue.length > 0) {
      // 否则播放队列中的下一个
      this.playNext();
    } else {
      // 通知系统可能需要生成更多内容
      if (this.onAudioEnd) {
        this.onAudioEnd();
      }
    }
  }
  
  /**
   * 暂停当前播放
   */
  pause() {
    if (!this.isPlaying) return;
    
    this.isPlaying = false;
    this.audioContext.suspend();
    
    // 停止追踪播放时间
    statsManager.stopTracking();
    
    utils.log('info', '音频已暂停');
  }
  
  /**
   * 恢复播放
   */
  resume() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.audioContext.resume();
    
    // 恢复追踪当前频道的播放时间
    const activeStation = stationManager.getActiveStation();
    if (activeStation) {
      statsManager.startTracking(activeStation.id);
    }
    
    utils.log('info', '音频恢复播放');
  }
  
  /**
   * 停止所有播放并清空队列
   */
  stop() {
    if (!this.audioContext) return;
    
    // 淡出当前音频
    if (this.currentAudio) {
      const now = this.audioContext.currentTime;
      this.gainNode.gain.linearRampToValueAtTime(
        0, 
        now + config.audio.fadeOutDuration
      );
      
      // 设置超时以在淡出后停止
      setTimeout(() => {
        if (this.currentAudio) {
          this.currentAudio.stop();
          this.currentAudio = null;
        }
        
        this.audioContext.suspend();
      }, config.audio.fadeOutDuration * 1000);
    }
    
    // 清空队列
    this.audioQueue = [];
    this.isPlaying = false;
    
    // 取消所有加载中的Promise
    this.loadPromises = [];
    
    // 停止可视化
    this.stopVisualizer();
    
    utils.log('info', '音频播放停止，队列已清空');
  }
  
  /**
   * 设置音量
   * @param {number} value 音量值 (0-1)
   */
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    
    if (this.gainNode) {
      // 当前时间
      const now = this.audioContext.currentTime;
      
      // 平滑过渡到新音量
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(this.volume, now + 0.1);
    }
    
    // 保存音量设置到localStorage
    try {
      localStorage.setItem('audioVolume', this.volume.toString());
    } catch (e) {
      utils.log('warning', '保存音量设置失败', e);
    }
    
    utils.log('info', `音量设置为 ${this.volume.toFixed(2)}`);
    
    // 如果处于夜间模式，立即应用夜间音量
    this.applyNightModeVolumeIfNeeded();
  }
  
  /**
   * 开始音频可视化
   */
  startVisualizer() {
    if (!this.analyserNode || this.visualizerRAF) return;
    
    const updateVisualizer = () => {
      this.analyserNode.getByteFrequencyData(this.visualizerDataArray);
      
      if (this.onVisualizerData) {
        this.onVisualizerData(this.visualizerDataArray);
      }
      
      this.visualizerRAF = requestAnimationFrame(updateVisualizer);
    };
    
    this.visualizerRAF = requestAnimationFrame(updateVisualizer);
  }
  
  /**
   * 停止音频可视化
   */
  stopVisualizer() {
    if (this.visualizerRAF) {
      cancelAnimationFrame(this.visualizerRAF);
      this.visualizerRAF = null;
    }
  }
  
  /**
   * 获取队列中剩余的音频数量
   * @returns {number} 队列长度
   */
  getQueueLength() {
    return this.audioQueue.length;
  }
  
  /**
   * 获取当前是否正在加载音频
   * @returns {boolean} 是否正在加载
   */
  isLoading() {
    return this.loadPromises.length > 0;
  }
  
  /**
   * 获取当前队列是否需要更多内容
   * @param {boolean} considerContinuousMode 是否考虑连续播放模式
   * @returns {boolean} 是否需要更多内容
   */
  needsMoreContent(considerContinuousMode = true) {
    // 获取正确的缓冲区阈值
    const threshold = considerContinuousMode && config.app.continuousPlayMode ? 
      config.app.continuousBufferCount || 5 : // 连续播放模式使用更大的缓冲区
      config.audio.bufferThreshold || 3;      // 普通模式使用标准缓冲区
    
    return this.audioQueue.length < threshold;
  }
  
  /**
   * 设置音频结束回调
   * @param {Function} callback 回调函数
   */
  setOnAudioEnd(callback) {
    this.onAudioEnd = callback;
  }
  
  /**
   * 设置可视化数据回调
   * @param {Function} callback 回调函数
   */
  setOnVisualizerData(callback) {
    this.onVisualizerData = callback;
  }

  /**
   * 开始播放
   */
  play() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.playCurrentAudio();
    
    // 开始追踪当前频道的播放时间
    const activeStation = stationManager.getActiveStation();
    if (activeStation) {
      statsManager.startTracking(activeStation.id);
    }
    
    utils.log('info', '音频开始播放');
  }

  /**
   * 温和地淡出并停止当前播放
   * @returns {Promise<void>}
   */
  async fadeOutAndStop() {
    return new Promise((resolve) => {
      if (!this.audioContext || !this.isPlaying || !this.currentAudio) {
        // 如果没有在播放，直接清空队列并返回
        this.audioQueue = [];
        this.isPlaying = false;
        this.stopVisualizer();
        resolve();
        return;
      }
      
      // 淡出当前音频
      const now = this.audioContext.currentTime;
      const fadeOutDuration = config.audio.fadeOutDuration;
      
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
      this.gainNode.gain.linearRampToValueAtTime(0, now + fadeOutDuration);
      
      // 设置定时器等待淡出完成后停止
      setTimeout(() => {
        if (this.currentAudio) {
          this.currentAudio.stop();
          this.currentAudio = null;
        }
        
        // 清空队列
        this.audioQueue = [];
        this.isPlaying = false;
        
        // 停止可视化
        this.stopVisualizer();
        
        // 暂停音频上下文以节省资源
        this.audioContext.suspend();
        
        utils.log('info', '音频已淡出并停止');
        resolve();
      }, fadeOutDuration * 1000);
    });
  }

  /**
   * 淡出并停止当前音频
   * @returns {Promise} 完成淡出并停止的Promise
   */
  async fadeOutAndStop() {
    if (!this.audioContext || !this.currentAudio) {
      this.stop();
      return Promise.resolve();
    }
    
    return new Promise(resolve => {
      // 计算淡出时间
      const fadeOutDuration = config.audio.fadeOutDuration;
      const now = this.audioContext.currentTime;
      
      // 应用平滑淡出效果
      this.gainNode.gain.setValueAtTime(this.volume, now);
      this.gainNode.gain.linearRampToValueAtTime(0, now + fadeOutDuration);
      
      // 设置超时以在淡出后停止
      setTimeout(() => {
        this.stop();
        resolve();
      }, fadeOutDuration * 1000);
    });
  }

  /**
   * 设置交叉淡入淡出
   * @param {AudioBufferSourceNode} nextSource 下一个音频源
   */
  crossFade(nextSource) {
    if (!this.currentAudio || !nextSource || !this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    const fadeOutDuration = config.audio.crossFadeDuration || 0.5;  // 默认0.5秒
    const currentGain = this.audioContext.createGain();
    const nextGain = this.audioContext.createGain();
    
    // 连接当前音频源到单独的增益节点
    this.currentAudio.disconnect();
    this.currentAudio.connect(currentGain);
    currentGain.connect(this.analyserNode);
    
    // 连接下一个音频源到单独的增益节点
    nextSource.connect(nextGain);
    nextGain.connect(this.analyserNode);
    
    // 淡出当前音频
    currentGain.gain.setValueAtTime(this.volume, now);
    currentGain.gain.linearRampToValueAtTime(0, now + fadeOutDuration);
    
    // 淡入下一个音频
    nextGain.gain.setValueAtTime(0, now);
    nextGain.gain.linearRampToValueAtTime(this.volume, now + fadeOutDuration);
    
    // 定时停止当前音频
    setTimeout(() => {
      if (this.currentAudio) {
        this.currentAudio.stop();
      }
    }, fadeOutDuration * 1000);
    
    // 更新当前音频源为下一个
    this.currentAudio = nextSource;
  }

  /**
   * 执行交叉淡入淡出
   * @param {AudioBufferSourceNode} newSource 新的音频源
   */
  crossFade(newSource) {
    if (!this.currentAudio) {
      newSource.connect(this.analyserNode);
      this.currentAudio = newSource;
      return;
    }
    
    // 创建两个增益节点用于交叉淡变
    const gainOld = this.audioContext.createGain();
    const gainNew = this.audioContext.createGain();
    
    // 连接旧源到其增益节点
    this.currentAudio.disconnect();
    this.currentAudio.connect(gainOld);
    gainOld.connect(this.analyserNode);
    
    // 连接新源到其增益节点
    newSource.connect(gainNew);
    gainNew.connect(this.analyserNode);
    
    // 获取当前时间
    const now = this.audioContext.currentTime;
    const fadeDuration = config.audio.crossFadeDuration || 0.5;
    
    // 旧音频淡出
    gainOld.gain.setValueAtTime(this.volume, now);
    gainOld.gain.linearRampToValueAtTime(0, now + fadeDuration);
    
    // 新音频淡入
    gainNew.gain.setValueAtTime(0, now);
    gainNew.gain.linearRampToValueAtTime(this.volume, now + fadeDuration);
    
    // 设定旧音频在淡出后停止
    setTimeout(() => {
      if (this.currentAudio) {
        this.currentAudio.stop();
      }
    }, fadeDuration * 1000);
    
    // 更新当前音频
    this.currentAudio = newSource;
    
    utils.log('info', '执行交叉淡入淡出');
  }

  /**
   * 为24小时连续播放模式优化队列管理
   * @param {number} bufferSize 要保持的缓冲区大小
   */
  optimizeQueueForContinuousPlay(bufferSize = config.app.continuousBufferCount) {
    if (!this.isPlaying) return;
    
    // 检查队列长度，如果低于连续播放所需的缓冲区大小，通知需要更多内容
    if (this.audioQueue.length < bufferSize && !this.isLoading()) {
      utils.log('info', '连续播放模式：队列需要更多内容', {
        current: this.audioQueue.length,
        target: bufferSize
      });
      
      if (this.onAudioEnd) {
        // 触发回调以生成更多内容
        this.onAudioEnd();
      }
    }
  }
  
  /**
   * 根据当前时间自动调整音量（夜间模式）
   */
  applyNightModeVolumeIfNeeded() {
    // 检查是否在夜间时段
    const currentHour = new Date().getHours();
    const isNightTime = currentHour >= config.audio.sleepModeStartHour && 
                       currentHour < config.audio.sleepModeEndHour;
    
    if (isNightTime && config.app.nightMode) {
      // 应用夜间模式音量
      const normalVolume = this.volume;
      const nightVolume = normalVolume * config.audio.nightModeVolume;
      
      if (this.gainNode && this.gainNode.gain.value !== nightVolume) {
        // 平滑过渡到夜间音量
        const now = this.audioContext.currentTime;
        this.gainNode.gain.linearRampToValueAtTime(
          nightVolume, 
          now + 2.0 // 2秒钟内平滑过渡
        );
        utils.log('info', '已应用夜间模式音量', {
          from: normalVolume.toFixed(2), 
          to: nightVolume.toFixed(2)
        });
      }
    } else if (this.gainNode && this.gainNode.gain.value !== this.volume) {
      // 如果不是夜间但音量不是正常值，恢复到正常音量
      const now = this.audioContext.currentTime;
      this.gainNode.gain.linearRampToValueAtTime(
        this.volume, 
        now + 2.0 // 2秒钟内平滑过渡
      );
      utils.log('info', '已恢复正常音量', {
        volume: this.volume.toFixed(2)
      });
    }
  }
  
  /**
   * 修复音频上下文（用于处理一些浏览器自动暂停音频上下文的问题）
   */
  async fixAudioContext() {
    if (!this.audioContext) return;
    
    // 如果上下文被暂停且应该播放，尝试恢复
    if (this.audioContext.state === 'suspended' && this.isPlaying) {
      try {
        await this.audioContext.resume();
        utils.log('info', '已恢复音频上下文');
        
        // 如果当前没有音频播放但队列中有内容，开始播放
        if (!this.currentAudio && this.audioQueue.length > 0) {
          this.playNext();
        }
      } catch (error) {
        utils.log('error', '恢复音频上下文失败', error);
      }
    }
  }
  
  /**
   * 启动24小时连续播放模式的监控定时器
   */
  startContinuousPlayMonitor() {
    // 清除现有定时器
    if (this._continuousPlayTimer) {
      clearInterval(this._continuousPlayTimer);
    }
    
    // 每3秒检查一次队列和音频状态
    this._continuousPlayTimer = setInterval(() => {
      // 仅在连续播放模式下执行
      if (!config.app.continuousPlayMode) return;
      
      // 修复可能的音频上下文问题
      this.fixAudioContext();
      
      // 优化队列
      this.optimizeQueueForContinuousPlay();
      
      // 应用夜间模式音量（如果需要）
      this.applyNightModeVolumeIfNeeded();
      
      // 如果应该播放但没有当前音频，且队列中有内容，则开始播放
      if (this.isPlaying && !this.currentAudio && this.audioQueue.length > 0) {
        utils.log('info', '连续播放模式：检测到播放中断，恢复播放');
        this.playNext();
      }
      
    }, 3000); // 每3秒执行一次
    
    utils.log('info', '已启动连续播放监控');
  }
  
  /**
   * 停止连续播放监控
   */
  stopContinuousPlayMonitor() {
    if (this._continuousPlayTimer) {
      clearInterval(this._continuousPlayTimer);
      this._continuousPlayTimer = null;
      utils.log('info', '已停止连续播放监控');
    }
  }
}

// 创建全局单例
const audioManager = new AudioManager();
