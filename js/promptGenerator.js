/**
 * AI提示生成器
 * 根据频道类型和当前上下文生成AI提示
 * 处理用户输入融入提示模板
 * 管理提示历史记录保持对话连贯性
 * 为不同节目类型定制优化提示策略
 */

class PromptGenerator {
  constructor() {
    this.activeStation = null;
    this.promptHistory = {};
    this.contextMemory = {};
    this.maxHistoryPerStation = 10;
    this.userInputBuffer = {};
  }
  
  /**
   * 初始化提示生成器
   * @param {Object} station 初始频道
   */
  initialize(station) {
    this.setActiveStation(station);
    
    // 为每个频道初始化历史记录和上下文
    for (const station of config.stations) {
      this.promptHistory[station.id] = [];
      this.contextMemory[station.id] = {
        currentTopic: null,
        recentTopics: [],
        continuityHints: [],
        pendingUserInputs: []
      };
      this.userInputBuffer[station.id] = [];
    }
  }
  
  /**
   * 设置当前活动频道
   * @param {Object} station 频道对象
   */
  setActiveStation(station) {
    this.activeStation = station;
    
    // 确保该频道的上下文存在
    if (!this.contextMemory[station.id]) {
      this.contextMemory[station.id] = {
        currentTopic: null,
        recentTopics: [],
        continuityHints: [],
        pendingUserInputs: []
      };
    }
    
    if (!this.promptHistory[station.id]) {
      this.promptHistory[station.id] = [];
    }
    
    if (!this.userInputBuffer[station.id]) {
      this.userInputBuffer[station.id] = [];
    }
  }
  
  /**
   * 添加用户输入到缓冲区
   * @param {string} userInput 用户输入内容
   * @param {string} stationId 频道ID，默认为当前频道
   */
  addUserInput(userInput, stationId = null) {
    const targetStationId = stationId || this.activeStation.id;
    
    if (userInput && userInput.trim()) {
      this.userInputBuffer[targetStationId].push({
        input: userInput.trim(),
        timestamp: Date.now(),
        used: false
      });
      
      // 在上下文中也标记有待处理的用户输入
      this.contextMemory[targetStationId].pendingUserInputs.push(userInput.trim());
      
      utils.log('info', `已添加用户输入到频道 ${targetStationId}`, userInput);
    }
  }
  
  /**
   * 获取下一个未使用的用户输入
   * @param {string} stationId 频道ID
   * @returns {string|null} 用户输入或null
   */
  getNextUserInput(stationId) {
    const inputs = this.userInputBuffer[stationId];
    if (!inputs || inputs.length === 0) return null;
    
    // 找到第一个未使用的输入
    const unusedInput = inputs.find(item => !item.used);
    
    if (unusedInput) {
      unusedInput.used = true;
      
      // 从待处理列表中移除
      const index = this.contextMemory[stationId].pendingUserInputs.indexOf(unusedInput.input);
      if (index > -1) {
        this.contextMemory[stationId].pendingUserInputs.splice(index, 1);
      }
      
      return unusedInput.input;
    }
    
    return null;
  }
  
  /**
   * 检查频道是否有待处理的用户输入
   * @param {string} stationId 频道ID
   * @returns {boolean} 是否有待处理输入
   */
  hasUnusedUserInput(stationId) {
    return this.userInputBuffer[stationId] && 
           this.userInputBuffer[stationId].some(item => !item.used);
  }
  
  /**
   * 添加提示到历史记录
   * @param {string} prompt 提示内容
   * @param {string} response AI回复
   * @param {string} segmentType 节目段类型
   */
  addToHistory(prompt, response, segmentType) {
    const stationId = this.activeStation.id;
    
    // 创建历史记录项
    const historyItem = {
      prompt,
      response,
      segmentType,
      timestamp: Date.now()
    };
    
    // 添加到历史
    this.promptHistory[stationId].push(historyItem);
    
    // 如果超过最大数量，移除最旧的
    if (this.promptHistory[stationId].length > this.maxHistoryPerStation) {
      this.promptHistory[stationId].shift();
    }
    
    // 更新上下文记忆
    this.updateContextMemory(stationId, response, segmentType);
  }
  
  /**
   * 更新频道的上下文记忆
   * @param {string} stationId 频道ID
   * @param {string} content 内容
   * @param {string} segmentType 节目段类型
   */
  updateContextMemory(stationId, content, segmentType) {
    const memory = this.contextMemory[stationId];
    
    // 更新当前主题
    if (['news', 'storyBegin', 'scienceTopic', 'dailyTopic', 'guestIntro'].includes(segmentType)) {
      // 提取主题或关键词
      const topic = this.extractTopic(content, segmentType);
      
      if (topic && memory.currentTopic !== topic) {
        if (memory.currentTopic) {
          memory.recentTopics.push(memory.currentTopic);
          
          // 限制最近主题数量
          if (memory.recentTopics.length > 5) {
            memory.recentTopics.shift();
          }
        }
        
        memory.currentTopic = topic;
      }
    }
    
    // 添加连续性提示
    if (['storyMiddle', 'storyEnd', 'commentary', 'interviewQ2', 'interviewA2'].includes(segmentType)) {
      memory.continuityHints.push(this.generateContinuityHint(content, segmentType));
      
      // 限制提示数量
      if (memory.continuityHints.length > 3) {
        memory.continuityHints.shift();
      }
    }
  }
  
  /**
   * 从内容中提取主题或关键词
   * @param {string} content 内容文本
   * @param {string} segmentType 节目段类型
   * @returns {string} 提取的主题
   */
  extractTopic(content, segmentType) {
    // 简单实现：取第一句话或前30个字符作为主题
    let topic = content.split(/[.。!！?？]/)[0];
    if (topic.length > 30) {
      topic = topic.substring(0, 30);
    }
    return topic;
  }
  
  /**
   * 生成用于保持内容连续性的提示
   * @param {string} content 内容文本
   * @param {string} segmentType 节目段类型
   * @returns {string} 连续性提示
   */
  generateContinuityHint(content, segmentType) {
    // 根据不同类型提供不同的连续性提示方式
    if (segmentType.includes('story')) {
      return `请在上次故事情节的基础上继续，上次的故事讲到: ${this.truncateForHint(content)}`;
    } else if (segmentType.includes('interview')) {
      return `上次访谈中，嘉宾提到: ${this.truncateForHint(content)}`;
    } else {
      return `上次谈到: ${this.truncateForHint(content)}`;
    }
  }
  
  /**
   * 截断文本用于提示
   * @param {string} text 文本
   * @returns {string} 截断后的文本
   */
  truncateForHint(text) {
    return utils.truncateText(text, 100);
  }
  
  /**
   * 为用户输入准备提示模板
   * @param {string} userInput 用户输入
   * @returns {string} 处理后的提示
   */
  prepareUserInputPrompt(userInput) {
    const station = this.activeStation;
    if (!station || !userInput) return null;
    
    // 获取用户互动提示模板
    let template = station.defaultPrompts.userInteraction || '{userInput}';
    
    // 替换用户输入标记
    return template.replace('{userInput}', userInput);
  }
  
  /**
   * 获取系统提示
   * @param {string} stationId 频道ID
   * @returns {string} 系统提示
   */
  getSystemPrompt(stationId) {
    const basePrompt = config.systemPrompts.default;
    const station = config.stations.find(s => s.id === stationId);
    
    if (!station) return basePrompt;
    
    // 根据频道类型定制系统提示
    let customization = '';
    
    switch (stationId) {
      case 'news':
        customization = '你是新闻广播频道的主播，语气专业客观，内容要简明扼要，符合新闻报道风格。';
        break;
      case 'story':
        customization = '你是故事频道的讲述者，语言要优美生动，富有画面感和感染力，能够吸引听众想象故事场景。';
        break;
      case 'science':
        customization = '你是科普频道的主持人，要用通俗易懂的语言解释复杂概念，语气热情而有教育意义。';
        break;
      case 'chat':
        customization = '你是闲聊频道的主播，语气要轻松自然，像朋友间的对话，亲切而不做作。';
        break;
      case 'interview':
        customization = '你是访谈类节目的主持人，需要扮演主持人和嘉宾双重角色，语言风格要有区分，主持人专业客观，嘉宾回答有个性和深度。';
        break;
      default:
        customization = '';
    }
    
    return `${basePrompt} ${customization}`;
  }
  
  /**
   * 生成下一个内容提示
   * @param {string} stationId 频道ID
   * @param {string} segmentType 节目段类型
   * @returns {string} 生成的提示
   */
  generatePrompt(stationId, segmentType) {
    const station = config.stations.find(s => s.id === stationId);
    if (!station) return null;
    
    const memory = this.contextMemory[stationId];
    
    // 如果是用户互动段，并且有未处理的用户输入，优先处理
    if (segmentType === 'userInteraction' || this.hasUnusedUserInput(stationId)) {
      const userInput = this.getNextUserInput(stationId);
      if (userInput) {
        return this.prepareUserInputPrompt(userInput);
      }
    }
    
    // 获取该段类型的默认提示
    let prompt = station.defaultPrompts[segmentType];
    if (!prompt) {
      // 回退到通用提示
      prompt = `作为${station.name}的主播，请生成一段适合${segmentType}类型的内容。`;
    }
    
    // 增强提示的连续性和上下文感知
    if (memory.currentTopic && 
        ['commentary', 'storyMiddle', 'storyEnd', 'scienceTopic', 'transition'].includes(segmentType)) {
      prompt += ` 请考虑我们正在讨论的主题: "${memory.currentTopic}"。`;
    }
    
    // 添加连续性提示
    if (memory.continuityHints.length > 0 && 
        ['storyMiddle', 'storyEnd', 'interviewQ2', 'interviewA2'].includes(segmentType)) {
      prompt += ` ${memory.continuityHints[memory.continuityHints.length - 1]}`;
    }
    
    return prompt;
  }
  
  /**
   * 获取历史提示用于AI生成
   * @param {string} stationId 频道ID
   * @param {number} count 需要的历史数量
   * @returns {Array} 历史消息数组
   */
  getPromptHistory(stationId, count = 2) {
    const history = this.promptHistory[stationId] || [];
    const result = [];
    
    // 获取最近的几条历史记录
    const recentHistory = history.slice(-count);
    
    for (const item of recentHistory) {
      result.push({
        role: 'user',
        content: item.prompt
      });
      
      result.push({
        role: 'assistant',
        content: item.response
      });
    }
    
    return result;
  }
}

// 创建全局单例
const promptGenerator = new PromptGenerator();
