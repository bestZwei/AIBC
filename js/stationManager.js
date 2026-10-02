/**
 * 频道管理和节目调度器
 * 管理不同广播频道的配置和状态
 * 决定下一个要播放的内容类型
 * 调度内容生成和播放顺序
 * 处理用户频道切换和节目互动
 */

class StationManager {
  constructor() {
    this.activeStation = null;
    this.stationStates = {};
    this.isGeneratingContent = false;
    this.contentQueue = [];
    this.onStateChange = null;
  }
  
  /**
   * 初始化频道管理器
   * @param {string} defaultStationId 默认频道ID
   */
  initialize(defaultStationId = config.app.defaultStation) {
    // 初始化所有内置频道的状态
    for (const station of config.stations) {
      this.stationStates[station.id] = {
        currentSegmentIndex: 0,
        segmentHistory: [],
        lastGeneratedTime: 0,
        contentBuffer: [],
        isActive: false
      };
    }
    
    // 初始化自定义频道的状态
    const customStations = this.getCustomStations();
    for (const station of customStations) {
      this.stationStates[station.id] = {
        currentSegmentIndex: 0,
        segmentHistory: [],
        lastGeneratedTime: 0,
        contentBuffer: [],
        isActive: false
      };
    }
    
    // 尝试从localStorage恢复连续播放设置
    try {
      const continuousPlayMode = localStorage.getItem('continuousPlayMode');
      if (continuousPlayMode !== null) {
        config.app.continuousPlayMode = JSON.parse(continuousPlayMode);
      }
    } catch (error) {
      utils.log('error', '恢复连续播放模式设置失败', error);
    }
    
    // 设置默认频道
    let targetStation = config.stations.find(s => s.id === defaultStationId);
    
    // 如果找不到默认频道，则尝试查找自定义频道
    if (!targetStation && customStations.length > 0) {
      targetStation = customStations.find(s => s.id === defaultStationId);
    }
    
    // 如果仍找不到，使用第一个可用频道
    if (!targetStation) {
      if (config.stations.length > 0) {
        targetStation = config.stations[0];
      } else if (customStations.length > 0) {
        targetStation = customStations[0];
      }
    }
    
    if (targetStation) {
      this.setActiveStation(targetStation);
    }
    
    utils.log('info', '频道管理器初始化完成', { 
      activeStation: this.activeStation?.name,
      continuousPlay: config.app.continuousPlayMode
    });
    
    return true;
  }
  
  /**
   * 设置活动频道
   * @param {Object} station 频道对象
   */
  setActiveStation(station) {
    if (!station) return;
    
    const previousStation = this.activeStation;
    
    // 更新状态
    if (previousStation && previousStation.id !== station.id) {
      this.stationStates[previousStation.id].isActive = false;
    }
    
    this.activeStation = station;
    this.stationStates[station.id].isActive = true;
    
    // 通知提示生成器更新活动频道
    promptGenerator.setActiveStation(station);
    
    // 触发状态变更回调
    if (this.onStateChange) {
      this.onStateChange({
        type: 'stationChange',
        station: station,
        previousStation: previousStation
      });
    }
    
    utils.log('info', `活动频道切换为: ${station.name}`);
  }
  
  /**
   * 获取指定ID的频道
   * @param {string} stationId 频道ID
   * @returns {Object} 频道对象
   */
  getStation(stationId) {
    return config.stations.find(s => s.id === stationId);
  }
  
  /**
   * 决定频道的下一个节目段类型
   * @param {string} stationId 频道ID
   * @returns {string} 节目段类型
   */
  decideNextSegmentType(stationId) {
    const station = this.getStation(stationId);
    if (!station) return null;
    
    const state = this.stationStates[stationId];
    const segments = station.segments;
    
    // 如果有待处理的用户输入，优先处理
    if (promptGenerator.hasUnusedUserInput(stationId)) {
      return 'userInteraction';
    }
    
    // 根据历史决定是否需要特定段落
    if (state.segmentHistory.length === 0) {
      // 第一段总是介绍
      return 'intro';
    } else if (state.segmentHistory.length > 10 && 
               !state.segmentHistory.slice(-5).includes('outro')) {
      // 播放足够多内容后，偶尔插入结束语
      return 'outro';
    }
    
    // 获取已播放的最后三种段落类型
    const recentTypes = state.segmentHistory.slice(-3);
    
    // 过滤掉最近使用过的段落类型
    const availableSegments = segments.filter(segment => 
      !recentTypes.includes(segment.type)
    );
    
    // 如果所有类型都最近用过，使用全部
    const segmentsToChooseFrom = availableSegments.length > 0 ? availableSegments : segments;
    
    // 使用加权随机选择段落类型
    const selectedSegment = utils.weightedRandom(segmentsToChooseFrom);
    return selectedSegment ? selectedSegment.type : segments[0].type; // 默认返回第一个
  }
  
  /**
   * 生成频道的内容并加入缓冲区
   * @param {string} stationId 频道ID
   * @returns {Promise<boolean>} 是否成功生成
   */
  async generateStationContent(stationId) {
    if (this.isGeneratingContent) return false;
    
    const station = this.getStation(stationId);
    if (!station) return false;
    
    const state = this.stationStates[stationId];
    
    try {
      this.isGeneratingContent = true;
      
      // 发送状态更新
      if (this.onStateChange) {
        this.onStateChange({
          type: 'contentGenerationStart',
          stationId: stationId
        });
      }
      
      // 决定生成什么类型的内容
      const segmentType = this.decideNextSegmentType(stationId);
      
      // 生成提示
      const prompt = promptGenerator.generatePrompt(stationId, segmentType);
      const systemPrompt = promptGenerator.getSystemPrompt(stationId);
      const promptHistory = promptGenerator.getPromptHistory(stationId);
      
      // 记录到历史
      state.segmentHistory.push(segmentType);
      if (state.segmentHistory.length > 20) {
        state.segmentHistory.shift();
      }
      
      // 调用AI生成内容
      utils.log('info', `生成内容: ${stationId} - ${segmentType}`, { prompt: utils.truncateText(prompt, 50) });
      const generatedText = await apiService.generateAIResponse(prompt, systemPrompt, promptHistory);
      
      // 将生成的内容添加到提示历史
      promptGenerator.addToHistory(prompt, generatedText, segmentType);
      
      // 转换为语音
      const voice = station.voice;
      const audioBlobs = await apiService.longTextToSpeech(generatedText, voice);
      
      // 添加到内容缓冲区
      state.contentBuffer.push({
        text: generatedText,
        audio: audioBlobs,
        segmentType: segmentType,
        timestamp: Date.now()
      });
      
      // 更新最后生成时间
      state.lastGeneratedTime = Date.now();
      
      // 如果是活动频道，添加到音频队列
      if (state.isActive) {
        await audioManager.addToQueue(audioBlobs);
      }
      
      // 发送状态更新
      if (this.onStateChange) {
        this.onStateChange({
          type: 'contentGenerated',
          stationId: stationId,
          text: generatedText,
          segmentType: segmentType
        });
      }
      
      utils.log('success', `内容生成成功: ${stationId} - ${segmentType}`);
      return true;
    } catch (error) {
      utils.log('error', `内容生成失败: ${stationId}`, error);
      
      // 发送错误状态
      if (this.onStateChange) {
        this.onStateChange({
          type: 'contentGenerationError',
          stationId: stationId,
          error: error
        });
      }
      
      return false;
    } finally {
      this.isGeneratingContent = false;
    }
  }
  
  /**
   * 检查并填充活动频道的内容缓冲区
   * @param {boolean} prioritizeUserInput 是否优先处理用户输入
   */
  async ensureActiveStationContent(prioritizeUserInput = false) {
    if (!this.activeStation || this.isGeneratingContent) return;
    
    const stationId = this.activeStation.id;
    const state = this.stationStates[stationId];
    
    // 检查是否需要生成更多内容
    const bufferThreshold = this.isContinuousPlayModeEnabled() ? 
      config.app.continuousBufferCount : config.app.prefetchCount;
    
    if (audioManager.needsMoreContent() && state.contentBuffer.length < bufferThreshold) {
      // 如果是连续播放模式，确保音频队列始终保持不为空
      if (this.isContinuousPlayModeEnabled() && !audioManager.isLoading() && audioManager.getQueueLength() < 1) {
        utils.log('info', '连续播放模式: 主动生成内容以保持播放');
        
        // 如果队列已空，必须立即生成内容
        await this.generateStationContent(stationId);
        
        // 如果音频正在播放，可能需要立即播放
        if (audioManager.isPlaying && !audioManager.currentAudio) {
          audioManager.playNext();
        }
      } else {
        // 常规内容生成
        await this.generateStationContent(stationId);
      }
    }
  }
  
  /**
   * 切换到指定频道
   * @param {string} stationId 频道ID
   * @returns {Promise<boolean>} 切换是否成功
   */
  async switchToStation(stationId) {
    try {
      const station = this.getStation(stationId);
      if (!station) {
        utils.log('error', `尝试切换到不存在的频道: ${stationId}`);
        return false;
      }
      
      // 如果是同一个频道，不做任何操作
      if (this.activeStation && this.activeStation.id === stationId) {
        return true;
      }
      
      // 保存当前播放状态，以便切换后恢复
      const wasPlaying = audioManager.isPlaying;
      
      // 温和地淡出并停止当前音频播放
      await audioManager.fadeOutAndStop();
      
      // 更新活动频道
      this.setActiveStation(station);
      const state = this.stationStates[stationId];
      
      // 生成过渡消息
      const transitionMessage = utils.getRandomItem(config.app.transitionMessages);
      if (this.onStateChange) {
        this.onStateChange({
          type: 'transitionMessage',
          message: transitionMessage,
          stationId: stationId
        });
      }
      
      // 更新统计数据
      statsManager.switchStation(stationId);
      
      // 检查是否有缓冲的内容
      let contentReady = false;
      if (state.contentBuffer.length > 0) {
        // 使用已缓冲的内容
        const content = state.contentBuffer.shift();
        await audioManager.addToQueue(content.audio);
        
        // 更新UI
        if (this.onStateChange) {
          this.onStateChange({
            type: 'contentReady',
            stationId: stationId,
            text: content.text,
            segmentType: content.segmentType
          });
        }
        contentReady = true;
      } else {
        // 生成新内容
        contentReady = await this.generateStationContent(stationId);
      }
      
      // 如果之前在播放，而且已经准备好了内容，恢复播放
      if (wasPlaying && contentReady) {
        setTimeout(() => {
          audioManager.resume();
        }, 500); // 给UI一点时间来响应
      }
      
      // 确保队列中有足够的内容
      this.ensureActiveStationContent();
      
      return true;
    } catch (error) {
      utils.log('error', '切换频道失败', error);
      return false;
    }
  }
  
  /**
   * 处理用户输入
   * @param {string} userInput 用户输入文本
   * @returns {Promise<boolean>} 处理是否成功
   */
  async handleUserInput(userInput) {
    if (!userInput || !userInput.trim() || !this.activeStation) {
      return false;
    }
    
    const userInputTrimmed = userInput.trim();
    const stationId = this.activeStation.id;
    
    try {
      // 记录用户互动统计
      statsManager.recordInteraction(stationId);
      
      utils.log('info', `处理用户输入: ${userInputTrimmed}`, { stationId });
      
      // 添加到提示生成器缓冲区
      promptGenerator.addUserInput(userInputTrimmed, stationId);
      
      // 检查是否应该立即处理用户输入
      const state = this.stationStates[stationId];
      const currentlyPlaying = audioManager.currentAudio !== null;
      const queueLength = audioManager.getQueueLength();
      
      // 如果当前没有播放内容或队列为空，优先生成用户互动内容
      if (!currentlyPlaying || queueLength < 1) {
        // 立即生成用户互动内容
        await this.generateUserInteractionContent(stationId, userInputTrimmed);
        return true;
      } else if (queueLength === 1) {
        // 仅有一个音频在队列中，添加到下一个生成任务
        this.ensureActiveStationContent(true); // 传递true表示优先生成用户互动内容
        return true;
      }
      
      // 用户互动内容将在后续内容中自动处理
      return true;
    } catch (error) {
      utils.log('error', '处理用户输入失败', { error, userInput: userInputTrimmed });
      return false;
    }
  }
  
  /**
   * 生成用户互动内容
   * @param {string} stationId 频道ID
   * @param {string} userInput 用户输入
   * @returns {Promise<boolean>} 是否成功生成
   */
  async generateUserInteractionContent(stationId, userInput) {
    if (this.isGeneratingContent) {
      utils.log('info', '正在生成其他内容，用户互动将稍后处理');
      return false;
    }
    
    try {
      this.isGeneratingContent = true;
      
      // 发送状态更新
      if (this.onStateChange) {
        this.onStateChange({
          type: 'contentGenerationStart',
          stationId: stationId,
          isUserInteraction: true
        });
      }
      
      // 生成用户互动类型的内容
      const systemPrompt = promptGenerator.getSystemPrompt(stationId);
      const prompt = promptGenerator.prepareUserInputPrompt(userInput);
      const promptHistory = promptGenerator.getPromptHistory(stationId);
      
      utils.log('info', `生成用户互动内容: ${stationId}`, { userInput });
      
      // 调用AI生成内容
      const generatedText = await apiService.generateAIResponse(prompt, systemPrompt, promptHistory);
      
      // 将生成的内容添加到提示历史
      promptGenerator.addToHistory(prompt, generatedText, 'userInteraction');
      
      // 转换为语音
      const station = this.getStation(stationId);
      const voice = station.voice;
      const audioBlobs = await apiService.longTextToSpeech(generatedText, voice);
      
      // 添加到音频队列，优先播放
      if (audioManager.isPlaying) {
        // 如果正在播放，插入到队列前面
        await audioManager.insertAtFrontOfQueue(audioBlobs);
      } else {
        // 如果没有播放，直接添加到队列
        await audioManager.addToQueue(audioBlobs);
      }
      
      // 发送状态更新
      if (this.onStateChange) {
        this.onStateChange({
          type: 'userInteractionReady',
          stationId: stationId,
          text: generatedText,
          userInput: userInput
        });
      }
      
      return true;
    } catch (error) {
      utils.log('error', '用户互动内容生成失败', { error, userInput });
      
      if (this.onStateChange) {
        this.onStateChange({
          type: 'contentGenerationError',
          stationId: stationId,
          error: error,
          isUserInteraction: true
        });
      }
      
      return false;
    } finally {
      this.isGeneratingContent = false;
    }
  }
  
  /**
   * 设置状态变更回调
   * @param {Function} callback 回调函数
   */
  setOnStateChange(callback) {
    this.onStateChange = callback;
  }
  
  /**
   * 获取所有频道列表
   * @returns {Array} 包含默认频道和自定义频道的列表
   */
  getAllStations() {
    // 合并默认频道和自定义频道
    const customStations = this.getCustomStations();
    return [...config.stations, ...customStations];
  }

  /**
   * 获取用户自定义频道
   * @returns {Array} 自定义频道列表
   */
  getCustomStations() {
    try {
      const customStationsJson = localStorage.getItem('customStations');
      return customStationsJson ? JSON.parse(customStationsJson) : [];
    } catch (error) {
      utils.log('error', '获取自定义频道失败', error);
      return [];
    }
  }

  /**
   * 保存自定义频道
   * @param {Array} stations 自定义频道列表
   */
  saveCustomStations(stations) {
    try {
      localStorage.setItem('customStations', JSON.stringify(stations));
      utils.log('success', '自定义频道已保存', { count: stations.length });
      
      // 通知状态变更
      if (this.onStateChange) {
        this.onStateChange({
          type: 'customStationsUpdated',
          stations: stations
        });
      }
    } catch (error) {
      utils.log('error', '保存自定义频道失败', error);
    }
  }

  /**
   * 添加或更新自定义频道
   * @param {Object} station 频道对象
   * @returns {boolean} 操作是否成功
   */
  addOrUpdateCustomStation(station) {
    if (!station || !station.id || !station.name) {
      utils.log('error', '无效的频道配置');
      return false;
    }

    try {
      // 获取现有自定义频道
      const customStations = this.getCustomStations();
      
      // 检查是否已存在同ID频道
      const existingIndex = customStations.findIndex(s => s.id === station.id);
      
      if (existingIndex >= 0) {
        // 更新现有频道
        customStations[existingIndex] = station;
        utils.log('info', `更新自定义频道: ${station.name}`);
      } else {
        // 添加新频道
        customStations.push(station);
        utils.log('info', `添加新自定义频道: ${station.name}`);
      }
      
      // 保存更新后的列表
      this.saveCustomStations(customStations);

      // 初始化频道状态
      if (!this.stationStates[station.id]) {
        this.stationStates[station.id] = {
          currentSegmentIndex: 0,
          segmentHistory: [],
          lastGeneratedTime: 0,
          contentBuffer: [],
          isActive: false
        };
      }
      
      return true;
    } catch (error) {
      utils.log('error', '添加/更新自定义频道失败', error);
      return false;
    }
  }

  /**
   * 删除自定义频道
   * @param {string} stationId 频道ID
   * @returns {boolean} 操作是否成功
   */
  deleteCustomStation(stationId) {
    if (!stationId) return false;

    try {
      // 获取现有自定义频道
      const customStations = this.getCustomStations();
      
      // 找到要删除的频道索引
      const stationIndex = customStations.findIndex(s => s.id === stationId);
      
      if (stationIndex < 0) {
        utils.log('warning', `未找到要删除的频道: ${stationId}`);
        return false;
      }
      
      // 如果正在播放该频道，先切换到默认频道
      if (this.activeStation && this.activeStation.id === stationId) {
        this.switchToStation(config.app.defaultStation);
      }
      
      // 从列表中删除
      customStations.splice(stationIndex, 1);
      
      // 保存更新后的列表
      this.saveCustomStations(customStations);
      
      // 清理频道状态
      if (this.stationStates[stationId]) {
        delete this.stationStates[stationId];
      }
      
      utils.log('info', `已删除自定义频道: ${stationId}`);
      return true;
    } catch (error) {
      utils.log('error', '删除自定义频道失败', error);
      return false;
    }
  }

  /**
   * 创建新的自定义频道
   * @param {Object} stationData 频道数据
   * @returns {string} 新创建频道的ID
   */
  createCustomStation(stationData) {
    try {
      // 生成唯一ID
      const stationId = 'custom_' + Date.now();
      
      // 创建新频道对象
      const newStation = {
        id: stationId,
        name: stationData.name || '自定义频道',
        description: stationData.description || '用户自定义频道',
        icon: stationData.icon || 'fa-broadcast-tower',
        voice: stationData.voice || config.tts.defaultVoice,
        segments: stationData.segments || [
          { type: 'news', weight: 2 },
          { type: 'story', weight: 1 },
          { type: 'music', weight: 1 }
        ],
        prompts: stationData.prompts || {},
        isCustom: true
      };
      
      // 添加到自定义频道列表
      this.addOrUpdateCustomStation(newStation);
      
      utils.log('success', `创建新自定义频道: ${newStation.name}`, { id: stationId });
      return stationId;
    } catch (error) {
      utils.log('error', '创建自定义频道失败', error);
      return null;
    }
  }

  /**
   * 设置24小时连续播放模式
   * @param {boolean} enabled 是否启用
   */
  setContinuousPlayMode(enabled) {
    if (enabled === config.app.continuousPlayMode) return;
    
    config.app.continuousPlayMode = enabled;
    
    // 存储设置到localStorage
    try {
      localStorage.setItem('continuousPlayMode', JSON.stringify(enabled));
    } catch (error) {
      utils.log('error', '保存连续播放模式失败', error);
    }
    
    // 通知状态变更
    if (this.onStateChange) {
      this.onStateChange({
        type: 'continuousModeChanged',
        enabled: enabled
      });
    }
    
    utils.log('info', `24小时连续播放模式: ${enabled ? '已启用' : '已禁用'}`);

    // 如果启用连续模式且正在播放，确保有足够的内容
    if (enabled && audioManager.isPlaying && this.activeStation) {
      this.ensureActiveStationContent();
    }
  }

  /**
   * 获取当前是否为24小时连续播放模式
   * @returns {boolean} 是否为连续播放模式
   */
  isContinuousPlayModeEnabled() {
    return config.app.continuousPlayMode === true;
  }

  /**
   * 启用/禁用夜间播放模式
   * @param {boolean} enabled 是否启用
   */
  setNightMode(enabled) {
    if (enabled === config.app.nightMode) return;
    
    config.app.nightMode = enabled;
    
    // 存储设置到localStorage
    try {
      localStorage.setItem('nightMode', JSON.stringify(enabled));
    } catch (error) {
      utils.log('error', '保存夜间模式失败', error);
    }
    
    // 通知状态变更
    if (this.onStateChange) {
      this.onStateChange({
        type: 'nightModeChanged',
        enabled: enabled
      });
    }
    
    utils.log('info', `夜间播放模式: ${enabled ? '已启用' : '已禁用'}`);
  }
  
  /**
   * 获取当前活动频道
   * @returns {Object} 活动频道
   */
  getActiveStation() {
    return this.activeStation;
  }
  
  /**
   * 获取频道状态
   * @param {string} stationId 频道ID
   * @returns {Object} 频道状态
   */
  getStationState(stationId) {
    return this.stationStates[stationId];
  }
}

// 创建全局单例
const stationManager = new StationManager();
