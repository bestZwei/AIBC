/**
 * API通信服务
 * 处理与AI对话接口和TTS接口的通信
 * 发送请求和处理响应
 * 实现错误处理和重试机制
 * 管理API调用的状态和限率
 */

class ApiService {
  constructor() {
    this.aiUrl = config.api.ai.url;
    this.aiKey = config.api.ai.key;
    this.aiModel = config.api.ai.model;
    
    this.ttsUrl = config.api.tts.url;
    this.ttsVoicesUrl = config.api.tts.voicesUrl;
    
    this.lastAiCallTime = 0;
    this.lastTtsCallTime = 0;
    
    this.aiRateLimit = 1000; // 1秒间隔
    this.ttsRateLimit = 500; // 0.5秒间隔
    
    this.availableVoices = null;
    
    // 错误计数和退避策略
    this.errorCounts = {
      ai: 0,
      tts: 0
    };
    
    this.maxRetries = 3;
    this.retryDelays = [1000, 3000, 5000]; // 退避时间（毫秒）
  }
  
  /**
   * 初始化服务，加载可用语音
   */
  async initialize() {
    try {
      await this.loadAvailableVoices();
      utils.log('info', '语音列表加载成功', this.availableVoices?.length);
      return true;
    } catch (error) {
      utils.log('error', '初始化API服务失败', error);
      return false;
    }
  }
  
  /**
   * 加载可用的TTS语音列表
   */
  async loadAvailableVoices() {
    try {
      const response = await fetch(`${this.ttsVoicesUrl}?l=zh`);
      if (!response.ok) {
        throw new Error(`获取语音列表失败: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.availableVoices = data;
      return data;
    } catch (error) {
      utils.log('error', '加载语音列表失败', error);
      this.availableVoices = [];
      throw error;
    }
  }
  
  /**
   * 获取中文语音列表
   */
  getChineseVoices() {
    if (!this.availableVoices) return [];
    return this.availableVoices.filter(voice => 
      voice.Locale.startsWith('zh-') || 
      voice.ShortName.toLowerCase().includes('chinese')
    );
  }
  
  /**
   * 检查语音是否可用
   * @param {string} voiceName 语音名称
   * @returns {boolean} 是否可用
   */
  isVoiceAvailable(voiceName) {
    if (!this.availableVoices) return true; // 默认假设可用
    return this.availableVoices.some(voice => 
      voice.ShortName === voiceName || 
      voice.FriendlyName === voiceName
    );
  }
  
  /**
   * 处理API速率限制
   * @param {string} apiType 'ai' 或 'tts'
   * @returns {Promise} 延迟Promise
   */
  async handleRateLimit(apiType) {
    const now = Date.now();
    let lastCallTime = this[`last${apiType.charAt(0).toUpperCase() + apiType.slice(1)}CallTime`];
    const rateLimit = this[`${apiType}RateLimit`];
    
    const elapsed = now - lastCallTime;
    
    if (elapsed < rateLimit) {
      const delay = rateLimit - elapsed;
      await utils.sleep(delay);
    }
    
    this[`last${apiType.charAt(0).toUpperCase() + apiType.slice(1)}CallTime`] = Date.now();
  }
  
  /**
   * 处理API错误和重试
   * @param {string} apiType 'ai' 或 'tts'
   * @param {Function} apiCall 要调用的API函数
   * @returns {Promise} API调用结果
   */
  async withRetry(apiType, apiCall) {
    const maxRetries = this.maxRetries;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        this.errorCounts[apiType]++;
        
        if (attempt === maxRetries) {
          utils.log('error', `${apiType.toUpperCase()} API调用失败，已达到最大重试次数`, error);
          throw error;
        }
        
        const delay = this.retryDelays[attempt] || this.retryDelays[this.retryDelays.length - 1];
        utils.log('warn', `${apiType.toUpperCase()} API调用失败，${delay/1000}秒后重试 (${attempt + 1}/${maxRetries})`, error);
        
        await utils.sleep(delay);
      }
    }
  }
  
  /**
   * 调用AI对话API
   * @param {Array} messages 消息数组
   * @param {Object} options 选项参数
   * @returns {Promise<Object>} API响应
   */
  async callAI(messages, options = {}) {
    await this.handleRateLimit('ai');
    
    const defaultOptions = {
      temperature: config.api.ai.temperature,
      max_tokens: config.api.ai.maxTokens,
      model: this.aiModel
    };
    
    const requestOptions = { ...defaultOptions, ...options };
    
    return this.withRetry('ai', async () => {
      const startTime = Date.now();
      
      const response = await fetch(this.aiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.aiKey}`
        },
        body: JSON.stringify({
          messages,
          ...requestOptions
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API错误 (${response.status}): ${errorText}`);
      }
      
      const data = await response.json();
      const elapsedTime = (Date.now() - startTime) / 1000;
      
      utils.log('api', `AI请求成功 (${elapsedTime.toFixed(2)}s)`, {
        model: requestOptions.model,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens
      });
      
      return data;
    });
  }
  
  /**
   * 生成AI回复文本
   * @param {string} prompt 提示内容
   * @param {string} systemPrompt 系统提示
   * @param {Array} history 历史消息
   * @returns {Promise<string>} 生成的文本
   */
  async generateAIResponse(prompt, systemPrompt = null, history = []) {
    const messages = [];
    
    // 添加系统消息
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    } else {
      messages.push({
        role: 'system',
        content: config.systemPrompts.default
      });
    }
    
    // 添加历史消息
    for (const msg of history) {
      messages.push({
        role: msg.role || 'user',
        content: msg.content
      });
    }
    
    // 添加当前提示
    messages.push({
      role: 'user',
      content: prompt
    });
    
    try {
      const response = await this.callAI(messages);
      
      if (response.choices && response.choices.length > 0) {
        return response.choices[0].message.content.trim();
      } else {
        throw new Error('AI响应格式错误');
      }
    } catch (error) {
      utils.log('error', '生成AI响应失败', error);
      return config.systemPrompts.error;
    }
  }
  
  /**
   * 调用TTS API
   * @param {string} text 要转换为语音的文本
   * @param {string} voice 语音名称
   * @param {number} rate 语速调整
   * @param {number} pitch 音调调整
   * @returns {Promise<Blob>} 音频Blob
   */
  async textToSpeech(text, voice = null, rate = null, pitch = null) {
    if (!text || text.trim() === '') {
      throw new Error('TTS文本不能为空');
    }
    
    await this.handleRateLimit('tts');
    
    const actualVoice = voice || config.api.tts.defaultVoice;
    const actualRate = rate !== null ? rate : config.api.tts.defaultRate;
    const actualPitch = pitch !== null ? pitch : config.api.tts.defaultPitch;
    
    return this.withRetry('tts', async () => {
      const startTime = Date.now();
      
      const params = new URLSearchParams({
        t: text,
        v: actualVoice,
        r: actualRate,
        p: actualPitch
      });
      
      const response = await fetch(`${this.ttsUrl}?${params.toString()}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TTS API错误 (${response.status}): ${errorText}`);
      }
      
      const blob = await response.blob();
      const elapsedTime = (Date.now() - startTime) / 1000;
      
      utils.log('api', `TTS请求成功 (${elapsedTime.toFixed(2)}s)`, {
        voice: actualVoice,
        textLength: text.length,
        audioSize: `${(blob.size / 1024).toFixed(2)} KB`
      });
      
      return blob;
    });
  }
  
  /**
   * 将长文本转换为多个TTS语音片段
   * @param {string} text 完整文本
   * @param {string} voice 语音名称
   * @param {number} rate 语速调整
   * @param {number} pitch 音调调整
   * @returns {Promise<Array<Blob>>} 音频Blob数组
   */
  async longTextToSpeech(text, voice = null, rate = null, pitch = null) {
    const contentType = utils.analyzeContentType(text);
    const suggestedRate = utils.suggestTTSRate(text, contentType);
    
    const actualRate = rate !== null ? rate : (config.api.tts.defaultRate + suggestedRate);
    
    const chunks = utils.chunkText(text);
    const audioBlobs = [];
    
    for (const chunk of chunks) {
      try {
        const blob = await this.textToSpeech(chunk, voice, actualRate, pitch);
        audioBlobs.push(blob);
      } catch (error) {
        utils.log('error', '处理TTS文本块失败', error);
        // 继续处理其他块
        continue;
      }
    }
    
    return audioBlobs;
  }
}

// 创建全局单例
const apiService = new ApiService();
