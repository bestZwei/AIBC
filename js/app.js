document.addEventListener('DOMContentLoaded', () => {
    // 网络状态UI元素
    const connectionStatusElement = document.getElementById('connection-status');
    const connectionTextElement = document.getElementById('connection-text');
    
    // UI元素
    const channelList = document.getElementById('channel-list');
    const currentChannelElement = document.getElementById('current-channel');
    const channelIconElement = document.getElementById('channel-icon');
    const nowPlayingTextElement = document.getElementById('now-playing-text');
    const playPauseButton = document.getElementById('play-pause');
    const nextSegmentButton = document.getElementById('next-segment');
    const volumeSlider = document.getElementById('volume-slider');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const interactionHistory = document.getElementById('interaction-history');
    const host1Element = document.getElementById('host1');
    const host2Element = document.getElementById('host2');
    const radioAnimation = document.getElementById('radio-animation');
    const onAirElement = document.getElementById('on-air');
    
    // 设置元素
    const openaiApiUrlInput = document.getElementById('openai-api-url');
    const openaiApiKeyInput = document.getElementById('openai-api-key');
    const openaiModelSelect = document.getElementById('openai-model');
    const saveSettingsButton = document.getElementById('save-settings');
    
    // 提示词设置相关元素
    const promptChannelSelect = document.getElementById('prompt-channel');
    const promptTypeSelect = document.getElementById('prompt-type');
    const customPromptTextarea = document.getElementById('custom-prompt');
    const savePromptButton = document.getElementById('save-prompt');
    const resetPromptButton = document.getElementById('reset-prompt');
    const debugInfoElement = document.getElementById('debug-info');
    
    // 应用状态
    let isRadioPlaying = false;
    let isGeneratingContent = false;
    let currentHost = null;
    
    // 初始化设置字段
    initializeSettings();
    
    // 初始化主机信息
    updateHostInfo();
    
    // 设置音频管理器回调
    audioManager.onPlaybackStatusChange = updatePlaybackStatus;
    audioManager.onQueueEmpty = handleQueueEmpty;
    audioManager.onSegmentStart = handleSegmentStart;
    
    // 为音量滑块设置事件监听器
    volumeSlider.addEventListener('input', (e) => {
        audioManager.setVolume(parseFloat(e.target.value));
    });
    
    // 为播放/暂停按钮设置事件监听器
    playPauseButton.addEventListener('click', togglePlayback);
    
    // 为下一段按钮设置事件监听器
    nextSegmentButton.addEventListener('click', skipToNextSegment);
    
    // 为频道列表项设置事件监听器
    Array.from(channelList.children).forEach(item => {
        item.addEventListener('click', handleChannelChange);
    });
    
    // 为用户输入设置事件监听器
    sendButton.addEventListener('click', handleUserInput);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleUserInput();
        }
    });
    
    // 为保存设置按钮设置事件监听器
    saveSettingsButton.addEventListener('click', saveSettings);
    
    // 为提示词选择器设置事件监听器
    promptChannelSelect.addEventListener('change', updatePromptTextarea);
    promptTypeSelect.addEventListener('change', updatePromptTextarea);
    
    // 为保存提示词按钮设置事件监听器
    savePromptButton.addEventListener('click', saveCustomPrompt);
    
    // 为重置提示词按钮设置事件监听器
    resetPromptButton.addEventListener('click', resetCustomPrompt);
    
    // 初始化提示词文本框
    updatePromptTextarea();
    
    // 启动应用
    startRadio();
    
    // 设置网络监视器回调
    networkMonitor.onStatusChange(updateConnectionStatus);
    networkMonitor.onPingSuccess(handlePingSuccess);
    networkMonitor.onPingFailure(handlePingFailure);
    
    // 启动网络监控
    networkMonitor.startMonitoring();
    
    // 初始化设置字段
    function initializeSettings() {
        // 从apiService获取当前设置
        openaiApiUrlInput.value = apiService.openaiApiUrl;
        openaiApiKeyInput.value = apiService.openaiApiKey;
        openaiModelSelect.value = apiService.openaiModel;
        
        // 如果使用的是默认设置，显示提示
        const isUsingDefaults = apiService.openaiApiUrl === CONFIG.openai.defaultUrl && 
                               apiService.openaiApiKey === CONFIG.openai.defaultKey;
        
        if (isUsingDefaults) {
            apiService.logDebug('使用默认API配置');
        }
    }
    
    // 保存设置
    function saveSettings() {
        const url = openaiApiUrlInput.value.trim();
        const key = openaiApiKeyInput.value.trim();
        const model = openaiModelSelect.value;
        
        apiService.saveOpenAIConfig(url, key, model);
        
        // 显示成功消息
        alert('设置已保存');
        
        // 如果正在播放，重新启动广播以应用新设置
        if (isRadioPlaying) {
            restartRadio();
        }
    }
    
    // 更新主播信息
    function updateHostInfo() {
        const channelConfig = CONFIG.channels[contentGenerator.currentChannel];
        const host1 = channelConfig.hosts.host1;
        const host2 = channelConfig.hosts.host2;
        
        host1Element.querySelector('.host-name').textContent = host1.name;
        host2Element.querySelector('.host-name').textContent = host2.name;
    }
    
    // 处理频道变更
    function handleChannelChange(e) {
        const channelItem = e.currentTarget;
        const channel = channelItem.dataset.channel;
        
        // 如果点击的是当前激活的频道，则不做任何操作
        if (channelItem.classList.contains('active')) {
            return;
        }
        
        // 更新UI
        document.querySelector('#channel-list li.active').classList.remove('active');
        channelItem.classList.add('active');
        
        // 更新频道图标和名称
        const channelConfig = CONFIG.channels[channel];
        currentChannelElement.textContent = `AI${channelConfig.name}`;
        channelIconElement.innerHTML = `<i class="fas fa-${channelConfig.icon}"></i>`;
        
        // 设置内容生成器的当前频道
        contentGenerator.setChannel(channel);
        
        // 更新主播信息
        updateHostInfo();
        
        // 重新启动广播
        restartRadio();
    }
    
    // 启动广播
    async function startRadio() {
        // 显示加载状态
        nowPlayingTextElement.textContent = '正在连接...';
        onAirElement.classList.add('pulse');
        onAirElement.textContent = 'CONNECTING';
        onAirElement.style.backgroundColor = 'var(--warning)';
        loadingManager.showLoading('正在启动广播...');
        
        // 检查API配置
        if (!apiService.isOpenAIConfigValid()) {
            nowPlayingTextElement.textContent = '请在设置中配置API信息以开始广播';
            apiService.logDebug('错误: API配置未完成');
            onAirElement.textContent = 'OFFLINE';
            onAirElement.style.backgroundColor = 'var(--error)';
            loadingManager.hideLoading();
            return;
        }
        
        // 如果正在生成内容，则不重复启动
        if (isGeneratingContent) {
            loadingManager.hideLoading();
            return;
        }
        
        isGeneratingContent = true;
        apiService.logDebug('开始生成广播内容');
        
        try {
            // 先测试API连接
            loadingManager.setMessage('正在测试API连接...');
            await testApiConnection();
            
            // 生成并播放第一个内容段落(频道介绍)
            loadingManager.setMessage('正在生成频道介绍...');
            await generateAndPlaySegment('intro');
            
            // 设置广播状态为播放中
            isRadioPlaying = true;
            updatePlaybackStatus(true);
            
            // 预加载下一个内容段落
            generateNextSegment();
        } catch (error) {
            console.error('启动广播失败:', error);
            nowPlayingTextElement.textContent = '启动广播失败: ' + error.message;
            apiService.logDebug(`启动广播失败: ${error.message}`);
            isGeneratingContent = false;
            onAirElement.textContent = 'ERROR';
            onAirElement.style.backgroundColor = 'var(--error)';
            loadingManager.showApiError(error);
            
            // 尝试启动备用内容
            tryPlayFallbackContent();
        } finally {
            loadingManager.hideLoading();
        }
    }
    
    // 测试API连接
    async function testApiConnection() {
        try {
            const testMessage = [
                { role: "system", content: "Please respond with the word 'connected' if you can read this message." }
            ];
            
            const response = await apiService.sendToOpenAI(testMessage);
            apiService.logDebug(`API连接测试响应: ${response}`);
            return true;
        } catch (error) {
            apiService.logDebug(`API连接测试失败: ${error.message}`);
            throw new Error(`无法连接到API: ${error.message}`);
        }
    }
    
    // 尝试播放备用内容
    async function tryPlayFallbackContent() {
        apiService.logDebug('尝试播放备用内容');
        try {
            const channelConfig = CONFIG.channels[contentGenerator.currentChannel];
            const host1 = channelConfig.hosts.host1;
            
            // 创建一个简单的介绍
            const fallbackText = `欢迎收听AI${channelConfig.name}，因为暂时无法连接AI服务，我们将为您播放预设内容。我是${host1.name}，谢谢您的收听。`;
            
            // 尝试创建TTS
            try {
                const voiceConfig = CONFIG.tts.defaultVoices[contentGenerator.currentChannel];
                const audioUrl = await apiService.textToSpeech(fallbackText, voiceConfig.host1);
                
                // 添加到播放队列
                audioManager.addToQueue({
                    type: 'fallback',
                    text: fallbackText,
                    audioUrl: audioUrl,
                    host: host1.name
                });
                
                // 更新UI
                nowPlayingTextElement.textContent = fallbackText;
                isRadioPlaying = true;
                updatePlaybackStatus(true);
            } catch (ttsError) {
                apiService.logDebug(`备用TTS生成失败: ${ttsError.message}`);
                // 即使没有音频，也更新UI文本
                nowPlayingTextElement.textContent = fallbackText;
            }
        } catch (error) {
            apiService.logDebug(`播放备用内容失败: ${error.message}`);
        }
    }
    
    // 重启广播
    function restartRadio() {
        // 清空当前播放队列
        audioManager.clearQueue();
        
        // 重置状态
        isRadioPlaying = false;
        isGeneratingContent = false;
        
        // 重新启动
        startRadio();
    }
    
    // 生成并播放特定类型的段落
    async function generateAndPlaySegment(segmentType) {
        // 显示生成状态
        nowPlayingTextElement.textContent = `正在生成${segmentType === 'intro' ? '频道介绍' : segmentType === 'userInteraction' ? '回复' : '内容'}...`;
        loadingManager.showLoading(`正在生成${segmentType === 'intro' ? '频道介绍' : segmentType === 'userInteraction' ? '回复' : '内容'}...`);
        
        try {
            let content;
            if (segmentType) {
                // 如果指定了段落类型，则生成该类型的内容
                switch (segmentType) {
                    case 'intro':
                        apiService.logDebug('生成频道介绍');
                        loadingManager.setStatus('请求AI模型中...');
                        content = await contentGenerator._generateIntro();
                        break;
                    case 'userInteraction':
                        apiService.logDebug('生成用户互动内容');
                        loadingManager.setStatus('处理用户问题中...');
                        content = await contentGenerator._generateUserInteraction();
                        break;
                    default:
                        apiService.logDebug(`生成${segmentType}内容`);
                        loadingManager.setStatus('请求内容中...');
                        content = await contentGenerator._generateSegmentContent(segmentType);
                        break;
                }
            } else {
                // 否则生成下一个内容段落
                apiService.logDebug('生成下一个内容段落');
                loadingManager.setStatus('准备下一段内容...');
                content = await contentGenerator.generateNextSegment();
            }
            
            loadingManager.setStatus('处理音频...');
            
            // 如果内容包含多个音频URL
            if (content.audioUrls && content.audioUrls.length > 0) {
                // 创建多个段落对象，每个对应一个音频
                for (let i = 0; i < content.audioUrls.length; i++) {
                    const audioUrl = content.audioUrls[i];
                    if (!audioUrl) continue; // 跳过无效的URL
                    
                    const host = content.hosts && content.hosts[i] ? content.hosts[i].host : null;
                    
                    // 创建段落对象
                    const segment = {
                        type: content.type,
                        text: content.hosts && content.hosts[i] ? content.hosts[i].text : '',
                        audioUrl: audioUrl,
                        host: host
                    };
                    
                    // 添加到播放队列
                    audioManager.addToQueue(segment);
                }
            } else {
                // 如果没有音频URL，尝试创建TTS音频
                apiService.logDebug('没有音频URL，尝试创建TTS音频');
                loadingManager.setStatus('生成语音...');
                await fallbackTTS(content);
            }
            
            return content;
        } catch (error) {
            console.error('生成内容失败:', error);
            apiService.logDebug(`生成内容失败: ${error.message}`);
            loadingManager.showApiError(error);
            
            // 创建一个错误提示的段落
            const channelConfig = CONFIG.channels[contentGenerator.currentChannel];
            const errorText = `遇到了问题: ${error.message}。我们将继续节目。`;
            
            // 尝试为错误消息创建TTS
            let errorAudioUrl = null;
            try {
                const voiceConfig = CONFIG.tts.defaultVoices[contentGenerator.currentChannel];
                errorAudioUrl = await apiService.textToSpeech(errorText, voiceConfig.host1);
            } catch (ttsError) {
                console.error('无法为错误消息创建TTS:', ttsError);
            }
            
            // 添加错误消息到播放队列
            if (errorAudioUrl) {
                audioManager.addToQueue({
                    type: 'error',
                    text: errorText,
                    audioUrl: errorAudioUrl,
                    host: channelConfig.hosts.host1.name
                });
            }
            
            throw error;
        } finally {
            isGeneratingContent = false;
            loadingManager.hideLoading();
        }
    }
    
    // 生成下一个内容段落
    async function generateNextSegment() {
        // 如果已经在生成内容，则不重复生成
        if (isGeneratingContent) {
            return;
        }
        
        isGeneratingContent = true;
        
        try {
            await generateAndPlaySegment();
        } catch (error) {
            console.error('生成下一段内容失败:', error);
            
            // 创建一个错误提示的段落
            const errorSegment = {
                type: 'error',
                text: '很抱歉，生成内容时出现了问题，我们会尽快恢复。',
                audioUrl: null
            };
            
            // 尝试为错误消息创建TTS
            try {
                const channelConfig = CONFIG.channels[contentGenerator.currentChannel];
                const voiceConfig = CONFIG.tts.defaultVoices[contentGenerator.currentChannel];
                const errorAudioUrl = await apiService.textToSpeech(
                    errorSegment.text, 
                    voiceConfig.host1
                );
                errorSegment.audioUrl = errorAudioUrl;
            } catch (ttsError) {
                console.error('无法为错误消息创建TTS:', ttsError);
            }
            
            if (errorSegment.audioUrl) {
                audioManager.addToQueue(errorSegment);
            }
        } finally {
            isGeneratingContent = false;
        }
    }
    
    // 备用TTS处理
    async function fallbackTTS(content) {
        try {
            const channelConfig = CONFIG.channels[contentGenerator.currentChannel];
            const voiceConfig = CONFIG.tts.defaultVoices[contentGenerator.currentChannel];
            
            // 如果文本为空，使用默认文本
            const textToConvert = content.text && content.text.trim() ? 
                                 content.text : 
                                 `欢迎收听AI${channelConfig.name}`;
            
            // 创建TTS
            const audioUrl = await apiService.textToSpeech(
                textToConvert,
                voiceConfig.host1
            );
            
            // 添加到播放队列
            const segment = {
                ...content,
                audioUrl: audioUrl
            };
            
            audioManager.addToQueue(segment);
        } catch (error) {
            console.error('备用TTS处理失败:', error);
            apiService.logDebug(`备用TTS处理失败: ${error.message}`);
            
            // 即使没有音频，也添加文本内容到队列
            audioManager.addToQueue({
                ...content,
                audioUrl: null
            });
        }
    }
    
    // 处理队列清空事件
    function handleQueueEmpty() {
        // 如果广播正在播放且没有正在生成内容，则生成新内容
        if (isRadioPlaying && !isGeneratingContent) {
            generateNextSegment();
        }
    }
    
    // 处理段落开始播放事件
    function handleSegmentStart(segment) {
        // 更新当前播放文本
        if (segment.text) {
            nowPlayingTextElement.textContent = segment.text;
        }
        
        // 更新当前主播高亮
        updateCurrentHost(segment.host);
    }
    
    // 更新当前主播高亮
    function updateCurrentHost(hostName) {
        // 如果没有主播信息，则取消所有高亮
        if (!hostName) {
            host1Element.classList.remove('active');
            host2Element.classList.remove('active');
            currentHost = null;
            return;
        }
        
        const channelConfig = CONFIG.channels[contentGenerator.currentChannel];
        const host1 = channelConfig.hosts.host1;
        const host2 = channelConfig.hosts.host2;
        
        if (hostName === host1.name) {
            host1Element.classList.add('active');
            host2Element.classList.remove('active');
            currentHost = 'host1';
        } else if (hostName === host2.name) {
            host1Element.classList.remove('active');
            host2Element.classList.add('active');
            currentHost = 'host2';
        } else {
            host1Element.classList.remove('active');
            host2Element.classList.remove('active');
            currentHost = null;
        }
    }
    
    // 更新播放状态
    function updatePlaybackStatus(isPlaying) {
        isRadioPlaying = isPlaying;
        
        // 更新播放/暂停按钮图标
        if (isPlaying) {
            playPauseButton.innerHTML = '<i class="fas fa-pause"></i>';
            radioAnimation.style.display = 'flex';
            onAirElement.style.backgroundColor = 'var(--success)';
            onAirElement.classList.add('pulse');
        } else {
            playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
            radioAnimation.style.display = 'none';
            onAirElement.style.backgroundColor = 'var(--warning)';
            onAirElement.classList.remove('pulse');
            onAirElement.textContent = 'PAUSED';
        }
    }
    
    // 切换播放/暂停状态
    function togglePlayback() {
        // 如果尚未开始广播，则启动
        if (!isRadioPlaying && audioManager.audioQueue.length === 0 && !audioManager.currentAudio) {
            startRadio();
            return;
        }
        
        // 切换音频播放状态
        audioManager.togglePlayPause();
    }
    
    // 跳到下一段
    function skipToNextSegment() {
        audioManager.skipToNext();
    }
    
    // 处理用户输入
    function handleUserInput() {
        const text = userInput.value.trim();
        
        if (!text) {
            return;
        }
        
        // 清空输入框
        userInput.value = '';
        
        // 添加到互动历史记录
        addToInteractionHistory(text, 'user');
        
        // 添加到内容生成器的问题队列
        contentGenerator.addUserQuestion(text);
        
        // 如果当前没有内容在播放，立即生成并播放用户互动内容
        if (!isRadioPlaying && !isGeneratingContent) {
            generateAndPlaySegment('userInteraction');
        }
    }
    
    // 添加到互动历史记录
    function addToInteractionHistory(text, type) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        
        const contentElement = document.createElement('div');
        contentElement.className = 'message-content';
        contentElement.textContent = text;
        
        const infoElement = document.createElement('div');
        infoElement.className = 'message-info';
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        infoElement.textContent = timeStr;
        
        messageElement.appendChild(contentElement);
        messageElement.appendChild(infoElement);
        
        interactionHistory.appendChild(messageElement);
        
        // 滚动到底部
        interactionHistory.scrollTop = interactionHistory.scrollHeight;
    }
    
    // 保存自定义提示词
    function saveCustomPrompt() {
        const channel = promptChannelSelect.value;
        const type = promptTypeSelect.value;
        const promptText = customPromptTextarea.value.trim();
        
        if (!promptText) {
            alert('提示词不能为空');
            return;
        }
        
        // 保存到内容生成器
        contentGenerator.saveUserPrompt(channel, type, promptText);
        
        // 显示成功消息
        alert(`已保存${CONFIG.channels[channel].name}的${type === 'intro' ? '频道介绍' : type === 'segment' ? '内容段落' : '用户互动'}提示词`);
    }
    
    // 重置提示词为默认
    function resetCustomPrompt() {
        const channel = promptChannelSelect.value;
        const type = promptTypeSelect.value;
        
        // 重置到内容生成器
        contentGenerator.resetPrompt(channel, type);
        
        // 更新文本框
        updatePromptTextarea();
        
        // 显示成功消息
        alert(`已重置${CONFIG.channels[channel].name}的${type === 'intro' ? '频道介绍' : type === 'segment' ? '内容段落' : '用户互动'}提示词为默认`);
    }
    
    // 更新提示词文本框
    function updatePromptTextarea() {
        const channel = promptChannelSelect.value;
        const type = promptTypeSelect.value;
        
        // 获取该频道和类型的提示词（优先用户自定义的）
        let promptText = '';
        if (CONFIG.prompts.userCustomPrompts[channel] && CONFIG.prompts.userCustomPrompts[channel][type]) {
            promptText = CONFIG.prompts.userCustomPrompts[channel][type];
        } else {
            promptText = CONFIG.prompts.templates[channel][type];
        }
        
        customPromptTextarea.value = promptText;
    }
    
    // 添加回调响应
    audioManager.onSegmentStart = (segment) => {
        // 如果是机器人的响应，添加到互动历史
        if (segment.type === 'userInteraction' && segment.text) {
            // 只添加第一段回答，避免重复
            if (!segment.alreadyAdded) {
                segment.alreadyAdded = true;
                addToInteractionHistory(segment.text, 'bot');
            }
        }
    };
    
    // 更新连接状态UI
    function updateConnectionStatus(isOnline) {
        if (isOnline) {
            connectionStatusElement.className = 'connection-status connecting';
            connectionTextElement.textContent = '正在检查连接...';
        } else {
            connectionStatusElement.className = 'connection-status offline';
            connectionTextElement.textContent = '离线';
            
            // 如果正在播放，显示离线提示
            if (isRadioPlaying) {
                apiService.logDebug('网络连接断开，可能影响内容生成');
                nowPlayingTextElement.textContent += ' (网络已断开，部分功能可能受限)';
            }
        }
    }
    
    // 处理ping成功
    function handlePingSuccess(pingTime) {
        connectionStatusElement.className = 'connection-status online';
        connectionTextElement.textContent = `在线 (${pingTime}ms)`;
        
        // 如果之前离线并且现在恢复在线，可能需要重新初始化一些内容
        if (isRadioPlaying && audioManager.audioQueue.length === 0 && !audioManager.currentAudio) {
            apiService.logDebug('网络恢复，重新加载内容');
            restartRadio();
        }
    }
    
    // 处理ping失败
    function handlePingFailure(reason) {
        connectionStatusElement.className = 'connection-status offline';
        connectionTextElement.textContent = `连接问题: ${reason}`;
        apiService.logDebug(`网络连接问题: ${reason}`);
    }
    
    // 在页面加载时，清理之前的音频资源
    window.addEventListener('beforeunload', function() {
        // 停止所有正在播放的音频
        if (audioManager && audioManager.currentAudio) {
            audioManager.currentAudio.pause();
        }
        
        // 取消所有待处理的fetch请求
        // (这里只是一个提示，实际上浏览器可能不会执行)
    });
});

// 添加CSS类以支持主播高亮
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
        .host.active {
            background-color: var(--primary-color);
            animation: pulse 2s infinite;
        }
    `;
    document.head.appendChild(style);
});
