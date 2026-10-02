/**
 * 工具函数集
 * 提供各种辅助函数
 * 处理文本格式化、时间格式化等通用功能
 * 实现缓存机制和本地存储管理
 * 提供调试和日志功能
 */

const utils = {
  /**
   * 生成唯一ID
   */
  generateId: () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  },

  /**
   * 格式化当前时间为 HH:MM:SS 格式
   */
  formatTime: () => {
    const now = new Date();
    return now.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  },

  /**
   * 截断文本到指定长度，添加省略号
   * @param {string} text 要截断的文本
   * @param {number} maxLength 最大长度
   * @returns {string} 截断后的文本
   */
  truncateText: (text, maxLength) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  /**
   * 安全获取本地存储数据
   * @param {string} key 存储键
   * @param {any} defaultValue 默认值
   * @returns {any} 存储的值或默认值
   */
  getLocalStorage: (key, defaultValue) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (error) {
      console.warn(`Error retrieving ${key} from localStorage:`, error);
      return defaultValue;
    }
  },

  /**
   * 安全设置本地存储数据
   * @param {string} key 存储键
   * @param {any} value 要存储的值
   */
  setLocalStorage: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Error saving ${key} to localStorage:`, error);
    }
  },

  /**
   * 从数组中随机获取一个元素
   * @param {Array} array 源数组
   * @returns {any} 随机元素
   */
  getRandomItem: (array) => {
    if (!array || array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
  },

  /**
   * 根据权重随机选择一个项目
   * @param {Array} items 包含{item, weight}对象的数组
   * @returns {any} 选中的项目
   */
  weightedRandom: (items) => {
    if (!items || items.length === 0) return null;
    
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (const item of items) {
      random -= (item.weight || 1);
      if (random <= 0) {
        return item;
      }
    }
    
    return items[0];
  },

  /**
   * 休眠函数，用于异步延迟
   * @param {number} ms 毫秒数
   * @returns {Promise} 延迟Promise
   */
  sleep: (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * 检测设备类型
   * @returns {string} 'mobile', 'tablet', 或 'desktop'
   */
  getDeviceType: () => {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  },

  /**
   * 日志函数，带时间戳和类型
   * @param {string} type 日志类型
   * @param {string} message 日志消息
   * @param {any} data 额外数据
   */
  log: (type, message, data) => {
    const timestamp = utils.formatTime();
    const logTypes = {
      info: {prefix: '🔵 INFO', style: 'color: #4361ee'},
      warn: {prefix: '🟠 WARN', style: 'color: #ff9100'},
      error: {prefix: '🔴 ERROR', style: 'color: #f72585'},
      success: {prefix: '🟢 SUCCESS', style: 'color: #06d6a0'},
      api: {prefix: '🟣 API', style: 'color: #7209b7'}
    };

    const logType = logTypes[type] || logTypes.info;
    
    console.log(
      `%c${logType.prefix} [${timestamp}] ${message}`, 
      logType.style,
      data || ''
    );
  },

  /**
   * 分析文本内容类型，用于优化TTS处理
   * @param {string} text 文本内容
   * @returns {string} 内容类型 ('news', 'conversation', 'story', 'science', 'general')
   */
  analyzeContentType: (text) => {
    if (!text) return 'general';
    
    text = text.toLowerCase();
    
    if (text.includes('新闻') || text.includes('报道') || text.includes('消息') || 
        text.includes('news') || text.includes('报告') || text.includes('宣布')) {
      return 'news';
    }
    
    if (text.includes('问：') || text.includes('答：') || text.includes('主持人：') || 
        text.includes('嘉宾：') || text.includes('：') && (text.match(/：/g) || []).length >= 2) {
      return 'conversation';
    }
    
    if (text.includes('从前') || text.includes('故事') || text.includes('传说') || 
        text.includes('很久以前') || text.includes('有一个') || text.includes('结局')) {
      return 'story';
    }
    
    if (text.includes('科学') || text.includes('研究') || text.includes('发现') || 
        text.includes('技术') || text.includes('原理') || text.includes('现象')) {
      return 'science';
    }
    
    return 'general';
  },

  /**
   * 将文本内容分成适合TTS请求的块
   * @param {string} text 完整文本
   * @param {number} maxChunkSize 最大块大小（字符数）
   * @returns {Array} 文本块数组
   */
  chunkText: (text, maxChunkSize = 1000) => {
    if (!text) return [];
    if (text.length <= maxChunkSize) return [text];
    
    // 查找合适的分割点（句子结束）
    const chunks = [];
    let start = 0;
    
    while (start < text.length) {
      let end = start + maxChunkSize;
      
      if (end >= text.length) {
        chunks.push(text.substring(start));
        break;
      }
      
      // 向后查找最近的句子结束标记
      const sentenceEnd = text.substring(end - 20, end + 20).search(/[.!?。！？]/);
      
      if (sentenceEnd !== -1) {
        end = end - 20 + sentenceEnd + 1;
      } else {
        // 如果没有找到句子结束，则在最近的逗号或空格处分割
        const commaPos = text.substring(end - 20, end + 20).search(/[,，、]/);
        if (commaPos !== -1) {
          end = end - 20 + commaPos + 1;
        }
      }
      
      chunks.push(text.substring(start, end).trim());
      start = end;
    }
    
    return chunks;
  },

  /**
   * 根据内容自动调整TTS语速
   * @param {string} text 文本内容
   * @param {string} contentType 内容类型
   * @returns {number} 建议的语速调整值
   */
  suggestTTSRate: (text, contentType) => {
    const type = contentType || utils.analyzeContentType(text);
    
    switch (type) {
      case 'news':
        return 0.1; // 新闻稍快
      case 'conversation':
        return 0; // 对话正常速度
      case 'story':
        return -0.1; // 故事稍慢
      case 'science':
        return -0.05; // 科普稍慢
      default:
        return 0;
    }
  },
  
  /**
   * 为指定元素添加临时CSS类并在一定时间后移除
   * @param {HTMLElement} element DOM元素
   * @param {string} className 要添加的类名
   * @param {number} durationMs 持续时间（毫秒）
   */
  addTemporaryClass: (element, className, durationMs = 1000) => {
    if (!element) return;
    
    element.classList.add(className);
    setTimeout(() => {
      element.classList.remove(className);
    }, durationMs);
  },
  
  /**
   * 对长时间运行的API调用进行超时处理
   * @param {Promise} promise 原始Promise
   * @param {number} timeoutMs 超时时间（毫秒）
   * @returns {Promise} 带超时的Promise
   */
  withTimeout: (promise, timeoutMs = 10000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('操作超时')), timeoutMs)
      )
    ]);
  }
};

// 防止工具函数被修改
Object.freeze(utils);
