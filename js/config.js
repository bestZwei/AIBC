/**
 * 配置文件
 * 包含所有API端点信息
 * 定义默认设置和常量
 * 存储频道配置和预设提示模板
 */

const config = {
  // API配置
  api: {
    ai: {
      url: 'https://gemini-balance.neko.is-cool.dev/v1/chat/completions',
      key: 'sk-411zwei5202',
      model: 'gemini-2.0-flash',
      maxTokens: 1000,
      temperature: 0.7
    },
    tts: {
      url: 'https://tts.ciallo.de/api/tts',
      voicesUrl: 'https://tts.ciallo.de/api/voices',
      defaultVoice: 'zh-CN-XiaoxiaoNeural',
      defaultRate: 0,
      defaultPitch: 0
    }
  },
  
  // 音频配置
  audio: {
    defaultVolume: 0.7,
    fadeInDuration: 0.5,  // 秒
    fadeOutDuration: 0.8,  // 秒
    crossFadeDuration: 0.5,  // 秒
    bufferThreshold: 3,   // 低于此值时生成更多内容
    continuousPlayback: true, // 24小时连续播放支持
    sleepModeStartHour: 0, // 深夜模式开始时间（0-23）
    sleepModeEndHour: 6,   // 深夜模式结束时间（0-23）
    nightModeVolume: 0.5,  // 深夜模式音量缩减比例
    visualizerSettings: {
      barCount: 64,
      barWidth: 4,
      barSpacing: 2,
      barColor: '#0070f3',
      barGradient: true,
      circleSegments: 80,
      circleLineWidth: 2,
      circleColor: '#5f7fff',
      circleGradient: true,
      circleCenterDot: true,
      circleCenterColor: '#ff2e63'
    }
  },
  
  // 预定义频道配置
  stations: [
    {
      id: 'news',
      name: 'AI新闻频道',
      description: '最新热点新闻和时事评论',
      icon: 'fa-newspaper',
      voice: 'zh-CN-YunjianNeural',
      segments: [
        { type: 'intro', weight: 1 },
        { type: 'news', weight: 5 },
        { type: 'transition', weight: 1 },
        { type: 'commentary', weight: 3 },
        { type: 'userInteraction', weight: 2 },
        { type: 'outro', weight: 1 }
      ],
      defaultPrompts: {
        intro: '你是一位专业的广播电台新闻主播，请用简短的开场白介绍今天的新闻频道，语气专业而富有活力。不要超过50字。',
        news: '你是一位专业的广播电台新闻主播，请生成3条当前最热门的新闻简讯，每条100字左右，语气客观专业。包含新闻标题和简要内容。',
        commentary: '选择一条当前热门新闻，以广播评论员的身份进行简短的分析和评论，语气要客观但有见解，不要超过500字。',
        transition: '作为新闻主播，用一句简短的过渡语来引出下一个话题。不要超过20字。',
        userInteraction: '有听众提问："{userInput}"。请作为新闻主播，专业、简洁地回答这个问题，不要超过250字。',
        outro: '作为新闻主播，用简短的结束语来结束本次新闻播报，提醒听众稍后会有更多新闻更新。不要超过40字。'
      }
    },
    {
      id: 'story',
      name: 'AI故事频道',
      description: '原创短篇故事和文学作品',
      icon: 'fa-book',
      voice: 'zh-CN-YunyangNeural',
      segments: [
        { type: 'intro', weight: 1 },
        { type: 'storyBegin', weight: 4 },
        { type: 'storyMiddle', weight: 4 },
        { type: 'storyEnd', weight: 3 },
        { type: 'userInteraction', weight: 2 },
        { type: 'outro', weight: 1 }
      ],
      defaultPrompts: {
        intro: '你是一位温柔的故事广播主播，请用富有感染力的开场白介绍今天的故事频道，暗示故事的主题或风格，语气温暖而神秘。不要超过50字。',
        storyBegin: '作为一位富有创造力的故事讲述者，请开始讲述一个引人入胜的短篇故事开头。故事类型可以是奇幻、悬疑、温情或科幻。开头要吸引人，不要超过1200字。',
        storyMiddle: '请继续刚才的故事，讲述故事情节的发展，增加一些冲突或转折，使故事更加吸引人。不要超过1000字。',
        storyEnd: '请为这个故事创作一个令人满意的结局，可以是温馨的、开放性的、出人意料的或发人深省的。结局要与整个故事风格一致，不要超过1000字。',
        userInteraction: '听众对故事提出了问题或评论："{userInput}"。请以故事主播的身份回应，可以分享创作灵感、补充故事细节或解释故事背景。不要超过200字。',
        outro: '作为故事主播，用优美的语言结束今天的故事时间，暗示下次还会有新故事，并感谢听众的收听。不要超过40字。'
      }
    },
    {
      id: 'science',
      name: 'AI科普频道',
      description: '有趣的科学知识和前沿发现',
      icon: 'fa-flask',
      voice: 'zh-CN-YunxiNeural',
      segments: [
        { type: 'intro', weight: 1 },
        { type: 'scienceTopic', weight: 4 },
        { type: 'transition', weight: 1 },
        { type: 'scienceFact', weight: 3 },
        { type: 'userInteraction', weight: 2 },
        { type: 'outro', weight: 1 }
      ],
      defaultPrompts: {
        intro: '作为科普频道的主持人，用充满好奇心的语气欢迎听众收听今天的科学探索节目，简单概述今天可能探讨的领域。不要超过50字。',
        scienceTopic: '选择一个当前热门或有趣的科学话题，作为科普主持人进行深入浅出的讲解，语气要既专业又通俗易懂，内容要准确。不要超过800字。',
        transition: '用一个有趣的科学问题或事实作为过渡，引出下一个话题。不要超过30字。',
        scienceFact: '请分享3个关于自然、宇宙或人类的令人惊讶的科学事实，每个事实要简短但引人入胜。总共不要超过200字。',
        userInteraction: '有听众提出了科学问题："{userInput}"。请作为科普主持人，用通俗易懂、有趣的方式回答这个问题，可以加入一些小故事或比喻来帮助理解。不要超过200字。',
        outro: '作为科普主持人，用充满启发性的语言结束今天的科普时间，鼓励听众保持好奇心和探索精神。不要超过40字。'
      }
    },
    {
      id: 'chat',
      name: 'AI闲聊频道',
      description: '轻松话题与日常生活讨论',
      icon: 'fa-comments',
      voice: 'zh-CN-XiaoxiaoNeural',
      segments: [
        { type: 'intro', weight: 1 },
        { type: 'dailyTopic', weight: 4 },
        { type: 'transition', weight: 1 },
        { type: 'funFact', weight: 3 },
        { type: 'userInteraction', weight: 3 },
        { type: 'outro', weight: 1 }
      ],
      defaultPrompts: {
        intro: '你是一位亲切友好的闲聊节目主播，请用轻松愉快的开场白欢迎听众收听今天的闲聊频道，语气要随意自然。不要超过50字。',
        dailyTopic: '作为闲聊节目主播，请选择一个日常生活中的有趣话题（如美食、旅行、兴趣爱好、生活小窍门等），分享你的看法和经验。语气要轻松随意，就像和朋友聊天一样。不要超过200字。',
        transition: '用一个有趣的问题或思考点，轻松地过渡到下一个话题。不要超过20字。',
        funFact: '分享一些有趣但不太为人所知的日常生活小知识或趣闻，让听众感到惊奇或会心一笑。不要超过150字。',
        userInteraction: '听众发来留言说："{userInput}"。请以闲聊主播的身份，亲切自然地回应这条留言，可以分享相关的个人看法或故事。不要超过150字。',
        outro: '用轻松愉快的语气结束今天的闲聊时间，邀请听众继续收听下次节目并参与互动。不要超过40字。'
      }
    },
    {
      id: 'interview',
      name: 'AI访谈频道',
      description: '模拟不同人物的深度对话',
      icon: 'fa-microphone',
      voice: 'zh-CN-YunyeNeural',
      segments: [
        { type: 'intro', weight: 1 },
        { type: 'guestIntro', weight: 2 },
        { type: 'interviewQ1', weight: 3 },
        { type: 'interviewA1', weight: 3 },
        { type: 'interviewQ2', weight: 3 },
        { type: 'interviewA2', weight: 3 },
        { type: 'userInteraction', weight: 2 },
        { type: 'outro', weight: 1 }
      ],
      defaultPrompts: {
        intro: '作为访谈节目的主持人，请用专业而热情的语气欢迎观众收看今天的访谈节目，简单暗示今天访谈的主题或嘉宾类型。不要超过50字。',
        guestIntro: '介绍今天的嘉宾，可以是一位虚构的专家、名人或有趣的角色。描述他们的背景、成就和今天将讨论的话题。语气要充满敬意和好奇。不要超过200字。',
        interviewQ1: '作为访谈主持人，提出一个深思熟虑的问题，探讨嘉宾的专业领域、经历或观点。问题要有深度但不咄咄逼人。不要超过60字。',
        interviewA1: '以嘉宾的身份回答上一个问题，表达专业见解、分享经验或讲述相关故事。回答要有深度和个人特色，符合嘉宾的背景设定。不要超过300字。',
        interviewQ2: '基于嘉宾的上一个回答，提出一个后续问题，进一步探讨话题或转向相关的新方向。问题要显示出主持人的倾听能力和敏锐度。不要超过60字。',
        interviewA2: '以嘉宾身份回答第二个问题，可以展示不同角度的观点，或深入解释先前提到的概念。保持一致的人物形象和专业深度。不要超过300字。',
        userInteraction: '一位听众想向嘉宾提问："{userInput}"。请先以主持人的身份介绍这个来自听众的问题，然后以嘉宾的身份回答。整体不要超过200字。',
        outro: '作为访谈主持人，礼貌地感谢嘉宾的参与，简要总结今天的访谈要点，并预告下期节目。不要超过50字。'
      }
    }
  ],
  
  // 系统提示和模板
  systemPrompts: {
    default: '你是一位专业的AI广播电台主播，需要生成简洁、有吸引力的广播内容。内容要富有广播风格，语言生动，适合朗读。',
    error: '由于技术原因，我们的节目暂时中断。请稍后再尝试收听，我们的工作人员正在努力恢复正常广播。感谢您的耐心等待。'
  },
  
  // 应用设置
  app: {
    maxInteractionHistory: 5,
    autoPlayNext: true,
    defaultStation: 'news',
    prefetchCount: 3,  // 预加载的内容数量
    loadingDelay: 300,  // 毫秒，用于UI反馈
    transitionMessages: [
      '请稍候，正在为您切换频道...',
      '频道切换中，马上为您带来新内容...',
      '正在连接到新频道，请稍等...',
      '切换中，稍安勿躁...'
    ],
    // 连续播放模式设置
    continuousPlayMode: false, // 默认关闭24小时连续播放
    continuousBufferCount: 5,  // 连续播放模式下的缓冲区大小
    nightMode: true,          // 夜间自动降低音量
    // 自定义频道支持
    customStations: {
      enabled: true,
      maxCustomStations: 10,
      storageKey: 'aibc_custom_stations',
      defaultSegments: [
        { type: 'intro', weight: 1 },
        { type: 'mainContent', weight: 4 },
        { type: 'transition', weight: 1 },
        { type: 'secondaryContent', weight: 3 },
        { type: 'userInteraction', weight: 2 },
        { type: 'outro', weight: 1 }
      ],
      defaultVoice: 'zh-CN-XiaoxiaoNeural',
      defaultPrompts: {
        intro: '作为[频道名称]的主播，请用符合频道风格的开场白欢迎听众收听，语气要专业且吸引人。不要超过50字。',
        mainContent: '根据[频道名称]的主题，创作一段引人入胜的主要内容，内容要丰富、专业且有趣，适合广播播出。不要超过800字。',
        transition: '用一个巧妙的过渡语句，将话题引向另一个相关方向。不要超过30字。',
        secondaryContent: '提供一些与[频道名称]主题相关的补充内容，可以是趣闻、知识点或相关讨论。内容要新颖且有价值。不要超过400字。',
        userInteraction: '听众发来留言说："{userInput}"。请以符合[频道名称]风格的方式回应这条留言，回应要专业、亲切且有见地。不要超过200字。',
        outro: '符合[频道名称]风格地结束本次播出，感谢听众收听并简单预告后续内容。不要超过40字。'
      }
    },
    // 主题配色
    themes: {
      dark: {
        primary: '#0070f3',
        secondary: '#5f7fff',
        background: '#0a0a0a',
        surface: '#111111',
        text: '#ededed',
        accent: '#0070f3',
        error: '#ff2e63',
        success: '#00d97e',
        warning: '#f5a623'
      },
      light: {
        primary: '#0060d8',
        secondary: '#4356e0',
        background: '#fafafa',
        surface: '#ffffff',
        text: '#171717',
        accent: '#0060d8',
        error: '#e5006a',
        success: '#00a86b',
        warning: '#f5a623'
      },
      neon: {
        primary: '#4cc9f0',
        secondary: '#3a86ff', 
        background: '#03071e',
        surface: '#10002b',
        text: '#f8f9fa',
        accent: '#f72585',
        error: '#e63946',
        success: '#06d6a0',
        warning: '#ffb703'
      },
      retro: {
        primary: '#8338ec',
        secondary: '#3a86ff',
        background: '#6a040f',
        surface: '#9d0208',
        text: '#ffba08',
        accent: '#ffba08',
        error: '#d00000',
        success: '#52b788',
        warning: '#ffb703'
      }
    }
  }
};

// 自定义频道的操作函数
config.loadCustomStations = function() {
  if (!this.app.customStations.enabled) return;
  
  const customStationsStr = localStorage.getItem(this.app.customStations.storageKey);
  if (customStationsStr) {
    try {
      const customStations = JSON.parse(customStationsStr);
      // 添加自定义频道到stations数组，但保留原始预设频道
      const presetStationIds = this.stations.map(s => s.id);
      
      // 只添加不在预设频道中的自定义频道
      customStations.forEach(station => {
        if (!presetStationIds.includes(station.id)) {
          this.stations.push(station);
        }
      });
      
      utils.log('info', `已加载 ${customStations.length} 个自定义频道`);
    } catch (error) {
      utils.log('error', '加载自定义频道失败', error);
    }
  }
};

config.saveCustomStation = function(station) {
  if (!this.app.customStations.enabled) return false;
  
  try {
    let customStations = [];
    const customStationsStr = localStorage.getItem(this.app.customStations.storageKey);
    
    if (customStationsStr) {
      customStations = JSON.parse(customStationsStr);
    }
    
    // 检查是否超过最大限制
    const presetStationIds = this.stations.filter(s => 
      !s.hasOwnProperty('isCustom') || !s.isCustom
    ).map(s => s.id);
    
    const existingCustomCount = customStations.length;
    
    if (!station.id) {
      // 新频道，生成唯一ID
      station.id = 'custom_' + Date.now();
      station.isCustom = true;
      
      if (existingCustomCount >= this.app.customStations.maxCustomStations) {
        utils.log('error', '已达到自定义频道数量上限');
        return false;
      }
      
      // 添加到自定义频道列表
      customStations.push(station);
      
      // 添加到活动频道列表
      this.stations.push(station);
    } else {
      // 更新现有频道
      const index = customStations.findIndex(s => s.id === station.id);
      
      if (index !== -1) {
        customStations[index] = station;
        
        // 更新活动频道列表中的频道
        const stationIndex = this.stations.findIndex(s => s.id === station.id);
        if (stationIndex !== -1) {
          this.stations[stationIndex] = station;
        }
      } else {
        // 这是一个新的自定义频道，ID由用户指定
        station.isCustom = true;
        
        if (existingCustomCount >= this.app.customStations.maxCustomStations) {
          utils.log('error', '已达到自定义频道数量上限');
          return false;
        }
        
        customStations.push(station);
        this.stations.push(station);
      }
    }
    
    // 保存到本地存储
    localStorage.setItem(this.app.customStations.storageKey, JSON.stringify(customStations));
    utils.log('success', `自定义频道 "${station.name}" 已保存`);
    return true;
  } catch (error) {
    utils.log('error', '保存自定义频道失败', error);
    return false;
  }
};

config.deleteCustomStation = function(stationId) {
  if (!this.app.customStations.enabled) return false;
  
  try {
    const customStationsStr = localStorage.getItem(this.app.customStations.storageKey);
    if (!customStationsStr) return false;
    
    let customStations = JSON.parse(customStationsStr);
    
    // 从自定义频道列表中移除
    const newCustomStations = customStations.filter(station => station.id !== stationId);
    
    if (newCustomStations.length === customStations.length) {
      // 没有找到要删除的频道
      return false;
    }
    
    // 从活动频道列表中移除
    const stationIndex = this.stations.findIndex(s => s.id === stationId);
    if (stationIndex !== -1) {
      this.stations.splice(stationIndex, 1);
    }
    
    // 保存新的自定义频道列表
    localStorage.setItem(this.app.customStations.storageKey, JSON.stringify(newCustomStations));
    utils.log('info', `自定义频道 ID: ${stationId} 已删除`);
    return true;
  } catch (error) {
    utils.log('error', '删除自定义频道失败', error);
    return false;
  }
};

// 在初始化时加载自定义频道
try {
  config.loadCustomStations();
} catch (error) {
  console.error('加载自定义频道失败:', error);
}

// 确保配置不被外部修改
Object.freeze(config);
