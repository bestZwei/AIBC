class ContentGenerator {
    constructor() {
        this.currentChannel = 'news'; // 默认频道
        this.userQuestions = []; // 用户提问队列
        this.channelContext = {}; // 各频道的上下文记忆
        this.segmentHistory = []; // 历史段落记录
        this.loadUserPrompts(); // 加载用户自定义提示词
        
        // 初始化各频道上下文
        Object.keys(CONFIG.channels).forEach(channel => {
            this.channelContext[channel] = {
                currentTopic: null,
                recentSegments: [],
                userInteractions: []
            };
        });
    }
    
    // 加载用户自定义提示词
    loadUserPrompts() {
        const savedPrompts = localStorage.getItem('ai-tune-custom-prompts');
        if (savedPrompts) {
            CONFIG.prompts.userCustomPrompts = JSON.parse(savedPrompts);
        }
    }
    
    // 保存用户自定义提示词
    saveUserPrompt(channel, type, prompt) {
        if (!CONFIG.prompts.userCustomPrompts[channel]) {
            CONFIG.prompts.userCustomPrompts[channel] = {};
        }
        CONFIG.prompts.userCustomPrompts[channel][type] = prompt;
        
        // 保存到本地存储
        localStorage.setItem('ai-tune-custom-prompts', JSON.stringify(CONFIG.prompts.userCustomPrompts));
    }
    
    // 重置特定频道和类型的提示词为默认
    resetPrompt(channel, type) {
        if (CONFIG.prompts.userCustomPrompts[channel] && CONFIG.prompts.userCustomPrompts[channel][type]) {
            delete CONFIG.prompts.userCustomPrompts[channel][type];
            // 如果频道下没有自定义提示词，删除整个频道对象
            if (Object.keys(CONFIG.prompts.userCustomPrompts[channel]).length === 0) {
                delete CONFIG.prompts.userCustomPrompts[channel];
            }
            // 保存到本地存储
            localStorage.setItem('ai-tune-custom-prompts', JSON.stringify(CONFIG.prompts.userCustomPrompts));
        }
    }
    
    // 获取提示词模板（优先使用用户自定义的）
    getPromptTemplate(channel, type) {
        // 如果有用户自定义提示词，优先使用
        if (CONFIG.prompts.userCustomPrompts[channel] && CONFIG.prompts.userCustomPrompts[channel][type]) {
            return CONFIG.prompts.userCustomPrompts[channel][type];
        }
        
        // 否则使用默认提示词
        return CONFIG.prompts.templates[channel][type];
    }
    
    // 填充提示词模板中的变量
    fillPromptTemplate(template, data) {
        let filledPrompt = template;
        for (const [key, value] of Object.entries(data)) {
            filledPrompt = filledPrompt.replace(new RegExp(`{${key}}`, 'g'), value);
        }
        return filledPrompt;
    }
    
    // 设置当前频道
    setChannel(channel) {
        if (CONFIG.channels[channel]) {
            this.currentChannel = channel;
            return true;
        }
        return false;
    }
    
    // 添加用户问题到队列
    addUserQuestion(question) {
        this.userQuestions.push({
            question,
            timestamp: new Date().getTime()
        });
        
        // 更新频道上下文
        this.channelContext[this.currentChannel].userInteractions.push({
            question,
            timestamp: new Date().getTime()
        });
        
        // 保持用户互动历史在合理范围内
        if (this.channelContext[this.currentChannel].userInteractions.length > 5) {
            this.channelContext[this.currentChannel].userInteractions.shift();
        }
    }
    
    // 生成下一个内容段落
    async generateNextSegment() {
        const channelConfig = CONFIG.channels[this.currentChannel];
        
        try {
            // 确定下一个段落类型
            let segmentType = this._determineNextSegmentType();
            
            // 如果有用户问题且不是交互段，有50%的机会切换到交互段
            if (this.userQuestions.length > 0 && segmentType !== 'userInteraction' && Math.random() > 0.5) {
                segmentType = 'userInteraction';
            }
            
            // 根据段落类型生成内容
            let content;
            switch (segmentType) {
                case 'intro':
                    content = await this._generateIntro();
                    break;
                case 'userInteraction':
                    content = await this._generateUserInteraction();
                    break;
                case 'transition':
                    content = await this._generateTransition();
                    break;
                default:
                    content = await this._generateSegmentContent(segmentType);
                    break;
            }
            
            // 将生成的段落添加到历史记录
            this.segmentHistory.push({
                type: segmentType,
                content: content.text,
                timestamp: new Date().getTime()
            });
            
            // 更新频道上下文
            this.channelContext[this.currentChannel].recentSegments.push({
                type: segmentType,
                content: content.text,
                timestamp: new Date().getTime()
            });
            
            // 保持最近段落历史在合理范围内
            if (this.channelContext[this.currentChannel].recentSegments.length > 5) {
                this.channelContext[this.currentChannel].recentSegments.shift();
            }
            
            return content;
        } catch (error) {
            apiService.logDebug(`生成下一个段落失败: ${error.message}，使用备用内容`);
            
            // 创建备用内容
            const host1 = channelConfig.hosts.host1;
            const fallbackText = `欢迎继续收听我们的节目，我是${host1.name}。让我们继续欣赏今天的内容。`;
            
            // 尝试获取TTS
            let fallbackAudio = [];
            try {
                const voiceConfig = CONFIG.tts.defaultVoices[this.currentChannel];
                const audioUrl = await apiService.textToSpeech(fallbackText, voiceConfig.host1);
                fallbackAudio.push(audioUrl);
            } catch (e) {
                apiService.logDebug(`备用TTS生成失败: ${e.message}`);
            }
            
            return {
                type: 'fallback',
                text: fallbackText,
                hosts: [{ host: host1.name, text: fallbackText }],
                audioUrls: fallbackAudio
            };
        }
    }
    
    // 确定下一个段落类型
    _determineNextSegmentType() {
        const channelConfig = CONFIG.channels[this.currentChannel];
        const segments = channelConfig.segments;
        
        // 计算权重总和
        const totalWeight = segments.reduce((sum, seg) => sum + seg.weight, 0);
        
        // 生成随机值
        let random = Math.random() * totalWeight;
        
        // 根据权重选择段落类型
        for (const segment of segments) {
            random -= segment.weight;
            if (random <= 0) {
                return segment.type;
            }
        }
        
        // 默认返回第一个段落类型
        return segments[0].type;
    }
    
    // 生成频道介绍内容
    async _generateIntro() {
        const channelConfig = CONFIG.channels[this.currentChannel];
        const host1 = channelConfig.hosts.host1;
        const host2 = channelConfig.hosts.host2;
        
        // 获取提示词模板
        const promptTemplate = this.getPromptTemplate(this.currentChannel, 'intro');
        
        // 填充模板
        const promptData = {
            host1: host1.name,
            host2: host2.name,
            role1: host1.role,
            role2: host2.role
        };
        
        const filledPrompt = this.fillPromptTemplate(promptTemplate, promptData);
        
        apiService.logDebug(`生成频道介绍: ${this.currentChannel}`);
        
        const messages = [
            {
                role: "system",
                content: filledPrompt
            }
        ];
        
        try {
            const response = await apiService.sendToOpenAI(messages);
            
            // 分离两位主播的对话
            const hostSegments = this._separateHostDialogue(response, host1.name, host2.name);
            
            // 如果无法正确分离对话（可能是API返回格式不符合预期），使用备用方案
            if (hostSegments.length === 0) {
                throw new Error("无法解析AI返回的对话格式");
            }
            
            // 将两位主播的对话转换为语音
            const audioResults = await this._hostDialogueToSpeech(hostSegments, host1.name, host2.name);
            
            return {
                type: 'intro',
                text: response,
                hosts: hostSegments,
                audioUrls: audioResults
            };
        } catch (error) {
            console.error('生成频道介绍失败:', error);
            apiService.logDebug(`生成频道介绍失败: ${error.message}`);
            
            // 返回一个简单的错误介绍
            const fallbackText = `欢迎收听${channelConfig.name}，我是${host1.name}，这里是AI广播电台。我们将为您带来精彩内容，敬请收听。`;
            
            // 尝试为备用文本创建语音
            let fallbackAudio = [];
            try {
                const voiceConfig = CONFIG.tts.defaultVoices[this.currentChannel];
                const audioUrl = await apiService.textToSpeech(fallbackText, voiceConfig.host1);
                fallbackAudio.push(audioUrl);
            } catch (ttsError) {
                apiService.logDebug(`生成备用TTS失败: ${ttsError.message}`);
            }
            
            return {
                type: 'intro',
                text: fallbackText,
                hosts: [
                    {host: host1.name, text: fallbackText}
                ],
                audioUrls: fallbackAudio
            };
        }
    }
    
    // 生成用户互动内容
    async _generateUserInteraction() {
        if (this.userQuestions.length === 0) {
            // 如果没有用户问题，生成一个通用的互动提示
            return this._generateGenericUserPrompt();
        }
        
        // 获取最早的用户问题
        const userQuestion = this.userQuestions.shift();
        const channelConfig = CONFIG.channels[this.currentChannel];
        const host1 = channelConfig.hosts.host1;
        const host2 = channelConfig.hosts.host2;
        
        // 获取提示词模板
        const promptTemplate = this.getPromptTemplate(this.currentChannel, 'userInteraction');
        
        // 填充模板
        const promptData = {
            host1: host1.name,
            host2: host2.name,
            role1: host1.role,
            role2: host2.role,
            question: userQuestion.question
        };
        
        const filledPrompt = this.fillPromptTemplate(promptTemplate, promptData);
        
        apiService.logDebug(`生成用户互动内容，问题: "${userQuestion.question.substring(0, 30)}..."`);
        
        const messages = [
            {
                role: "system",
                content: filledPrompt
            }
        ];
        
        try {
            const response = await apiService.sendToOpenAI(messages);
            
            // 分离两位主播的对话
            const hostSegments = this._separateHostDialogue(response, host1.name, host2.name);
            
            // 如果无法正确分离对话，使用备用方案
            if (hostSegments.length === 0) {
                const fallbackResponse = `${host1.name}：感谢您的问题，"${userQuestion.question}"，这是一个很有趣的问题。\n${host2.name}：是的，让我来回答这个问题。${response}`;
                const fallbackSegments = this._separateHostDialogue(fallbackResponse, host1.name, host2.name);
                
                // 将两位主播的对话转换为语音
                const audioResults = await this._hostDialogueToSpeech(fallbackSegments, host1.name, host2.name);
                
                return {
                    type: 'userInteraction',
                    text: fallbackResponse,
                    userQuestion: userQuestion.question,
                    hosts: fallbackSegments,
                    audioUrls: audioResults
                };
            }
            
            // 将两位主播的对话转换为语音
            const audioResults = await this._hostDialogueToSpeech(hostSegments, host1.name, host2.name);
            
            return {
                type: 'userInteraction',
                text: response,
                userQuestion: userQuestion.question,
                hosts: hostSegments,
                audioUrls: audioResults
            };
        } catch (error) {
            console.error('生成用户互动内容失败:', error);
            apiService.logDebug(`生成用户互动内容失败: ${error.message}`);
            
            // 创建基本回复
            const fallbackText = `${host1.name}：感谢您的问题，"${userQuestion.question.substring(0, 30)}..."。\n${host2.name}：我们将在稍后为您解答，请继续收听我们的节目。`;
            const fallbackSegments = this._separateHostDialogue(fallbackText, host1.name, host2.name);
            
            // 尝试为备用文本创建语音
            let fallbackAudio = [];
            try {
                const voiceConfig = CONFIG.tts.defaultVoices[this.currentChannel];
                for (const segment of fallbackSegments) {
                    const voice = segment.host === host1.name ? voiceConfig.host1 : voiceConfig.host2;
                    const audioUrl = await apiService.textToSpeech(segment.text, voice);
                    fallbackAudio.push(audioUrl);
                }
            } catch (ttsError) {
                apiService.logDebug(`生成备用TTS失败: ${ttsError.message}`);
            }
            
            return {
                type: 'userInteraction',
                text: fallbackText,
                userQuestion: userQuestion.question,
                hosts: fallbackSegments,
                audioUrls: fallbackAudio
            };
        }
    }
    
    // 生成通用的用户互动提示
    async _generateGenericUserPrompt() {
        const channelConfig = CONFIG.channels[this.currentChannel];
        const host1 = channelConfig.hosts.host1;
        const host2 = channelConfig.hosts.host2;
        
        const messages = [
            {
                role: "system",
                content: `你是AI广播电台"${channelConfig.name}"的两位主播。请生成一段简短的对话，鼓励听众提出问题或分享观点。由主播${host1.name}(${host1.role})和${host2.name}(${host2.role})进行对话。使用"${host1.name}："和"${host2.name}："来标识不同主播的对话。对话应该友好、邀请性强，总长度控制在150字以内。`
            }
        ];
        
        try {
            const response = await apiService.sendToOpenAI(messages);
            
            // 分离两位主播的对话
            const hostSegments = this._separateHostDialogue(response, host1.name, host2.name);
            
            // 将两位主播的对话转换为语音
            const audioResults = await this._hostDialogueToSpeech(hostSegments, host1.name, host2.name);
            
            return {
                type: 'userInteraction',
                text: response,
                hosts: hostSegments,
                audioUrls: audioResults
            };
        } catch (error) {
            console.error('生成用户互动提示失败:', error);
            return {
                type: 'userInteraction',
                text: `欢迎听众朋友们提问，我们很期待与您互动。`,
                hosts: [
                    {host: host1.name, text: `欢迎听众朋友们提问，我们很期待与您互动。`}
                ],
                audioUrls: []
            };
        }
    }
    
    // 生成过渡内容
    async _generateTransition() {
        const channelConfig = CONFIG.channels[this.currentChannel];
        const host1 = channelConfig.hosts.host1;
        const host2 = channelConfig.hosts.host2;
        
        const messages = [
            {
                role: "system",
                content: `你是AI广播电台"${channelConfig.name}"的两位主播。请生成一段简短的过渡对话，由主播${host1.name}(${host1.role})和${host2.name}(${host2.role})进行对话。这段对话应该自然地将节目引向下一个话题。使用"${host1.name}："和"${host2.name}："来标识不同主播的对话。对话应该简短、流畅，总长度控制在100字以内。`
            }
        ];
        
        try {
            const response = await apiService.sendToOpenAI(messages);
            
            // 分离两位主播的对话
            const hostSegments = this._separateHostDialogue(response, host1.name, host2.name);
            
            // 将两位主播的对话转换为语音
            const audioResults = await this._hostDialogueToSpeech(hostSegments, host1.name, host2.name);
            
            return {
                type: 'transition',
                text: response,
                hosts: hostSegments,
                audioUrls: audioResults
            };
        } catch (error) {
            console.error('生成过渡内容失败:', error);
            return {
                type: 'transition',
                text: `接下来，让我们继续我们的节目。`,
                hosts: [
                    {host: host1.name, text: `接下来，让我们继续我们的节目。`}
                ],
                audioUrls: []
            };
        }
    }
    
    // 生成特定类型的段落内容
    async _generateSegmentContent(segmentType) {
        const channelConfig = CONFIG.channels[this.currentChannel];
        const host1 = channelConfig.hosts.host1;
        const host2 = channelConfig.hosts.host2;
        
        // 获取提示词模板
        const promptTemplate = this.getPromptTemplate(this.currentChannel, 'segment');
        
        // 填充模板
        const promptData = {
            host1: host1.name,
            host2: host2.name,
            role1: host1.role,
            role2: host2.role
        };
        
        const filledPrompt = this.fillPromptTemplate(promptTemplate, promptData);
        
        apiService.logDebug(`生成${segmentType}内容`);
        
        const messages = [
            {
                role: "system",
                content: filledPrompt
            }
        ];
        
        try {
            // 添加重试机制
            let attempts = 0;
            const maxAttempts = 2;
            let response;
            
            while (attempts < maxAttempts) {
                try {
                    response = await apiService.sendToOpenAI(messages);
                    break; // 如果成功，跳出循环
                } catch (err) {
                    attempts++;
                    if (attempts >= maxAttempts) throw err; // 如果达到最大尝试次数，抛出错误
                    apiService.logDebug(`尝试重新请求 (${attempts}/${maxAttempts})`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
                }
            }
            
            // 分离两位主播的对话
            const hostSegments = this._separateHostDialogue(response, host1.name, host2.name);
            
            // 如果无法正确分离对话，使用备用方案
            if (hostSegments.length === 0) {
                const simplifiedResponse = this._createSimplifiedDialogue(response, host1.name, host2.name);
                const hostSegments = this._separateHostDialogue(simplifiedResponse, host1.name, host2.name);
                
                // 将两位主播的对话转换为语音
                const audioResults = await this._hostDialogueToSpeech(hostSegments, host1.name, host2.name);
                
                return {
                    type: segmentType,
                    text: simplifiedResponse,
                    hosts: hostSegments,
                    audioUrls: audioResults
                };
            }
            
            // 将两位主播的对话转换为语音
            const audioResults = await this._hostDialogueToSpeech(hostSegments, host1.name, host2.name);
            
            return {
                type: segmentType,
                text: response,
                hosts: hostSegments,
                audioUrls: audioResults
            };
        } catch (error) {
            console.error(`生成${segmentType}内容失败:`, error);
            apiService.logDebug(`生成${segmentType}内容失败: ${error.message}`);
            
            // 创建基本内容
            const segmentTypeDisplay = this._getDisplayNameForSegmentType(segmentType);
            const fallbackText = `接下来为您带来${segmentTypeDisplay}内容。`;
            const host1Text = `${fallbackText}`;
            
            // 尝试为备用文本创建语音
            let fallbackAudio = [];
            try {
                const voiceConfig = CONFIG.tts.defaultVoices[this.currentChannel];
                const audioUrl = await apiService.textToSpeech(host1Text, voiceConfig.host1);
                fallbackAudio.push(audioUrl);
            } catch (ttsError) {
                apiService.logDebug(`生成备用TTS失败: ${ttsError.message}`);
            }
            
            return {
                type: segmentType,
                text: fallbackText,
                hosts: [
                    {host: host1.name, text: host1Text}
                ],
                audioUrls: fallbackAudio
            };
        }
    }
    
    // 分离主播对话
    _separateHostDialogue(text, host1Name, host2Name) {
        const hostSegments = [];
        const lines = text.split('\n');
        
        let currentHost = '';
        let currentText = '';
        
        for (const line of lines) {
            // 检查这一行是否是主播标识
            if (line.startsWith(`${host1Name}：`) || line.startsWith(`${host1Name}:`)) {
                // 如果已经有未处理的对话，先保存
                if (currentHost && currentText) {
                    hostSegments.push({
                        host: currentHost,
                        text: currentText.trim()
                    });
                }
                // 更新当前主播和文本
                currentHost = host1Name;
                currentText = line.replace(`${host1Name}：`, '').replace(`${host1Name}:`, '');
            } else if (line.startsWith(`${host2Name}：`) || line.startsWith(`${host2Name}:`)) {
                // 如果已经有未处理的对话，先保存
                if (currentHost && currentText) {
                    hostSegments.push({
                        host: currentHost,
                        text: currentText.trim()
                    });
                }
                // 更新当前主播和文本
                currentHost = host2Name;
                currentText = line.replace(`${host2Name}：`, '').replace(`${host2Name}:`, '');
            } else if (currentHost) {
                // 继续当前主播的文本
                currentText += ' ' + line;
            }
        }
        
        // 保存最后一段对话
        if (currentHost && currentText) {
            hostSegments.push({
                host: currentHost,
                text: currentText.trim()
            });
        }
        
        return hostSegments;
    }
    
    // 将主播对话转换为语音
    async _hostDialogueToSpeech(hostSegments, host1Name, host2Name) {
        const audioUrls = [];
        const channelConfig = CONFIG.channels[this.currentChannel];
        const voiceConfig = CONFIG.tts.defaultVoices[this.currentChannel];
        
        // 如果没有主播对话片段，使用默认对话
        if (!hostSegments || hostSegments.length === 0) {
            apiService.logDebug('没有有效的主播对话片段，创建默认对话');
            const defaultText = `欢迎收听我们的节目，这里是${host1Name}。`;
            try {
                const audioUrl = await apiService.textToSpeech(defaultText, voiceConfig.host1);
                audioUrls.push(audioUrl);
                return audioUrls;
            } catch (error) {
                apiService.logDebug(`默认对话TTS失败: ${error.message}`);
                return [];
            }
        }
        
        // 有主播对话片段，正常处理
        for (const segment of hostSegments) {
            try {
                // 确保文本不为空
                if (!segment.text || segment.text.trim() === '') {
                    apiService.logDebug(`跳过空文本: ${segment.host}`);
                    audioUrls.push(null);
                    continue;
                }
                
                let voice;
                if (segment.host === host1Name) {
                    voice = voiceConfig.host1;
                } else if (segment.host === host2Name) {
                    voice = voiceConfig.host2;
                } else {
                    voice = voiceConfig.host1; // 默认使用host1的声音
                }
                
                apiService.logDebug(`转换主播对话为语音: ${segment.host}, 长度: ${segment.text.length}字符`);
                const result = await apiService.textToSpeech(segment.text, voice);
                audioUrls.push(result);
            } catch (error) {
                console.error('文本转语音失败:', error);
                apiService.logDebug(`文本转语音失败: ${error.message}`);
                // 在出错的情况下，添加一个空的URL作为占位符
                audioUrls.push(null);
            }
        }
        
        return audioUrls;
    }
    
    // 辅助函数：创建简化对话
    _createSimplifiedDialogue(content, host1Name, host2Name) {
        // 如果内容不包含主播名称，添加它们
        if (!content.includes(`${host1Name}：`) && !content.includes(`${host1Name}:`)) {
            // 将内容分成两部分
            const sentences = content.split(/[.!?。！？]/).filter(s => s.trim().length > 0);
            const midpoint = Math.ceil(sentences.length / 2);
            
            let host1Content = '';
            let host2Content = '';
            
            for (let i = 0; i < sentences.length; i++) {
                if (i < midpoint) {
                    host1Content += sentences[i] + '。';
                } else {
                    host2Content += sentences[i] + '。';
                }
            }
            
            // 如果一方内容为空，给它一个简单的句子
            if (!host1Content) host1Content = "接下来是我们的内容。";
            if (!host2Content) host2Content = "希望大家喜欢。";
            
            return `${host1Name}：${host1Content}\n${host2Name}：${host2Content}`;
        }
        
        return content;
    }
    
    // 获取段落类型的显示名称
    _getDisplayNameForSegmentType(segmentType) {
        switch (segmentType) {
            case 'news': return '新闻';
            case 'story': return '故事';
            case 'science': return '科普';
            case 'chat': return '闲聊';
            case 'interview': return '访谈';
            case 'discussion': return '讨论';
            case 'transition': return '过渡';
            default: return segmentType;
        }
    }
    
    // 辅助方法：生成预设的回退内容
    _generateFallbackContent(type) {
        const channelConfig = CONFIG.channels[this.currentChannel];
        const host1 = channelConfig.hosts.host1;
        const host2 = channelConfig.hosts.host2;
        
        let text = '';
        switch (type) {
            case 'intro':
                text = `${host1.name}：大家好，欢迎收听AI${channelConfig.name}。我是${host1.name}。\n${host2.name}：我是${host2.name}，我们将为您带来精彩内容。`;
                break;
            case 'news':
                text = `${host1.name}：接下来为您带来今日新闻要点。\n${host2.name}：我们会持续关注热点事件，为您提供最新动态。`;
                break;
            case 'story':
                text = `${host1.name}：让我们来听一个有趣的故事吧。\n${host2.name}：相信这个故事会给大家带来启发和思考。`;
                break;
            case 'science':
                text = `${host1.name}：接下来为大家介绍一个有趣的科学现象。\n${host2.name}：科学总是充满了奇妙与惊喜。`;
                break;
            case 'discussion':
                text = `${host1.name}：让我们来讨论一个有趣的话题。\n${host2.name}：我很期待我们的讨论。`;
                break;
            case 'transition':
                text = `${host1.name}：接下来，让我们切换到下一个话题。\n${host2.name}：好的，我们继续。`;
                break;
            default:
                text = `${host1.name}：感谢您收听我们的节目。\n${host2.name}：我们将继续为您带来精彩内容。`;
        }
        
        return text;
    }
}

// 创建内容生成器实例
const contentGenerator = new ContentGenerator();
