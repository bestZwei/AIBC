const CONFIG = {
    // TTS API配置
    tts: {
        apiUrl: 'https://tts.ciallo.de/api/tts',
        voicesUrl: 'https://tts.ciallo.de/api/voices',
        defaultVoices: {
            // 每个频道的默认主播声音
            news: {
                host1: 'zh-CN-XiaoxiaoNeural',
                host2: 'zh-CN-YunxiNeural'
            },
            story: {
                host1: 'zh-CN-XiaoyiNeural',
                host2: 'zh-CN-YunyangNeural'
            },
            science: {
                host1: 'zh-CN-XiaohanNeural',
                host2: 'zh-CN-YunjianNeural'
            },
            chat: {
                host1: 'zh-CN-XiaomoNeural',
                host2: 'zh-CN-YunxiNeural'
            },
            interview: {
                host1: 'zh-CN-XiaoruiNeural',
                host2: 'zh-CN-YunyeNeural'
            }
        }
    },
    
    // OpenAI API默认配置
    openai: {
        defaultUrl: 'https://gemini-balance.neko.is-cool.dev/',
        defaultKey: 'sk-411zwei5202',
        defaultModel: 'gemini-2.5-flash-preview-04-17',
        storageKey: 'ai-tune-openai-config'
    },
    
    // 频道配置
    channels: {
        news: {
            name: '新闻台',
            icon: 'newspaper',
            description: '最新热点资讯，由AI记者为您实时播报',
            hosts: {
                host1: {name: '小晓', role: '新闻主播'},
                host2: {name: '云熙', role: '新闻评论员'}
            },
            segments: [
                {type: 'intro', weight: 1},
                {type: 'news', weight: 3},
                {type: 'discussion', weight: 2},
                {type: 'userInteraction', weight: 2},
                {type: 'transition', weight: 1}
            ]
        },
        story: {
            name: '故事台',
            icon: 'book',
            description: '精彩故事与文学作品，由AI讲述者为您娓娓道来',
            hosts: {
                host1: {name: '小怡', role: '故事讲述者'},
                host2: {name: '云扬', role: '文学评论家'}
            },
            segments: [
                {type: 'intro', weight: 1},
                {type: 'story', weight: 4},
                {type: 'discussion', weight: 2},
                {type: 'userInteraction', weight: 2},
                {type: 'transition', weight: 1}
            ]
        },
        science: {
            name: '科普台',
            icon: 'atom',
            description: '探索科学奥秘，由AI科普专家带您了解前沿科技',
            hosts: {
                host1: {name: '小涵', role: '科学记者'},
                host2: {name: '云健', role: '科学顾问'}
            },
            segments: [
                {type: 'intro', weight: 1},
                {type: 'science', weight: 3},
                {type: 'discussion', weight: 2},
                {type: 'userInteraction', weight: 2},
                {type: 'transition', weight: 1}
            ]
        },
        chat: {
            name: '闲聊台',
            icon: 'comments',
            description: '轻松愉快的话题讨论，由AI主播带您畅聊生活百态',
            hosts: {
                host1: {name: '小默', role: '主持人'},
                host2: {name: '云熙', role: '嘉宾'}
            },
            segments: [
                {type: 'intro', weight: 1},
                {type: 'chat', weight: 3},
                {type: 'discussion', weight: 3},
                {type: 'userInteraction', weight: 2},
                {type: 'transition', weight: 1}
            ]
        },
        interview: {
            name: '访谈台',
            icon: 'microphone',
            description: '深度访谈与对话，由AI主持人带来思想的碰撞',
            hosts: {
                host1: {name: '小蕊', role: '访谈主持人'},
                host2: {name: '云烨', role: '特邀嘉宾'}
            },
            segments: [
                {type: 'intro', weight: 1},
                {type: 'interview', weight: 4},
                {type: 'discussion', weight: 2},
                {type: 'userInteraction', weight: 2},
                {type: 'transition', weight: 1}
            ]
        }
    },
    
    // 播放设置
    playback: {
        defaultVolume: 0.7,
        fadeDuration: 500, // 音频淡入淡出时间(毫秒)
    },
    
    // 应用状态
    appState: {
        storageKey: 'ai-tune-app-state'
    },

    // 提示词模板配置
    prompts: {
        customizable: true, // 是否允许用户自定义提示词
        templates: {
            news: {
                intro: "你是AI广播电台\"新闻台\"的两位主播。请生成一段简短的频道介绍对话，由主播{host1}({role1})和{host2}({role2})进行对话。介绍应该包含新闻台的特色、今日重点新闻预告。使用\"{host1}：\"和\"{host2}：\"来标识不同主播的对话。对话应该自然、生动，总长度控制在300字以内。",
                segment: "请为新闻广播节目生成一段新闻报道对话。对话应该包含2-3条当前热点新闻（可以基于真实新闻创造），由主播{host1}({role1})介绍新闻标题和主要内容，然后{host2}({role2})提供简短的评论或补充信息。使用\"{host1}：\"和\"{host2}：\"来标识不同主播的对话。",
                userInteraction: "听众提出了以下问题：\"{question}\"。请生成一段自然的对话，由主播{host1}({role1})和{host2}({role2})来回答这个问题，尽可能提供准确的信息。使用\"{host1}：\"和\"{host2}：\"来标识不同主播的对话。"
            },
            story: {
                intro: "你是AI广播电台\"故事台\"的两位主播。请生成一段简短的频道介绍对话，由主播{host1}({role1})和{host2}({role2})进行对话。介绍应该包含故事台的特色、今日将会讲述的故事类型。使用\"{host1}：\"和\"{host2}：\"来标识不同主播的对话。对话应该温馨、有吸引力，总长度控制在300字以内。",
                segment: "请为故事广播节目生成一段简短的故事讲述对话。由主播{host1}({role1})讲述一个有趣的短篇故事开头，然后{host2}({role2})继续发展情节，最后由{host1}为故事收尾。故事主题应该积极向上、富有启发性。使用\"{host1}：\"和\"{host2}：\"来标识不同主播的对话。",
                userInteraction: "听众提出了以下问题或建议：\"{question}\"。请生成一段对话，由主播{host1}({role1})和{host2}({role2})回应这个问题，可以讲述一个与问题相关的小故事或分享见解。使用\"{host1}：\"和\"{host2}：\"来标识不同主播的对话。"
            },
            science: {
                intro: "你是AI广播电台\"科普台\"的两位主播。请生成一段简短的频道介绍对话，由主播{host1}({role1})和{host2}({role2})进行对话。介绍应该包含科普台的特色、今日将会探讨的科学领域。使用\"{host1}：\"和\"{host2}：\"来标识不同主播的对话。对话应该专业但易懂，总长度控制在300字以内。",
                segment: "请为科普广播节目生成一段关于科学知识的对话。由主播{host1}({role1})介绍一个有趣的科学现象或最新的科技进展，然后{host2}({role2})提供更深入的解释和背景信息。内容应该准确、通俗易懂。使用\"{host1}：\"和\"{host2}：\"来标识不同主播的对话。",
                userInteraction: "听众提出了以下科学问题：\"{question}\"。请生成一段对话，由主播{host1}({role1})和{host2}({role2})用科学但通俗的语言来回答这个问题。使用\"{host1}：\"和\"{host2}：\"来标识不同主播的对话。"
            },
            chat: {
                intro: "你是AI广播电台\"闲聊台\"的两位主播。请生成一段简短的频道介绍对话，由主播{host1}({role1})和{host2}({role2})进行对话。介绍应该包含闲聊台的轻松氛围和今日可能讨论的话题范围。使用\"{host1}：\"和\"{host2}：\"来标识不同主播的对话。对话应该轻松幽默，总长度控制在300字以内。",
                segment: "请为闲聊广播节目生成一段轻松愉快的对话。由主播{host1}({role1})和{host2}({role2})讨论一个日常生活中的有趣话题，如时下流行、生活小技巧、季节变化等。对话应该轻松、幽默，像两个朋友在聊天。使用\"{host1}：\"和\"{host2}：\"来标识不同主播的对话。",
                userInteraction: "听众分享了这样的想法：\"{question}\"。请生成一段轻松的对话，由主播{host1}({role1})和{host2}({role2})对这个想法进行响应和讨论。使用\"{host1}：\"和\"{host2}：\"来标识不同主播的对话。"
            },
            interview: {
                intro: "你是AI广播电台\"访谈台\"的两位主播。请生成一段简短的频道介绍对话，由主播{host1}({role1})和{host2}({role2})进行对话。介绍应该包含访谈台的特色、今日访谈的主题或嘉宾。使用\"{host1}：\"和\"{host2}：\"来标识不同主播的对话。对话应该正式但富有吸引力，总长度控制在300字以内。",
                segment: "请为访谈广播节目生成一段模拟采访对话。由主播{host1}({role1})扮演访谈主持人，向{host2}({role2})扮演的某领域专家或名人提问。{host2}应该提供有见解的回答。请选择一个有趣且适合广播的话题。使用\"{host1}：\"和\"{host2}：\"来标识不同主播的对话。",
                userInteraction: "听众提出了这样的问题：\"{question}\"。请生成一段访谈式对话，由主播{host1}({role1})向嘉宾{host2}({role2})提出这个问题，然后{host2}给出专业的回答。使用\"{host1}：\"和\"{host2}：\"来标识不同主播的对话。"
            }
        },
        // 用户自定义提示词（初始为空，会被用户设置填充）
        userCustomPrompts: {}
    }
};
