class APIService {
    constructor() {
        // 从本地存储加载OpenAI配置
        this.loadOpenAIConfig();
        this.availableVoices = null;
        this.debugInfo = []; // 添加调试信息日志
        this.fetchRetryCount = 3; // 请求重试次数
        this.fetchRetryDelay = 1000; // 初始重试延迟（毫秒）
    }
    
    // 加载OpenAI配置
    loadOpenAIConfig() {
        const savedConfig = localStorage.getItem(CONFIG.openai.storageKey);
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            this.openaiApiUrl = config.url || CONFIG.openai.defaultUrl;
            this.openaiApiKey = config.key || CONFIG.openai.defaultKey;
            this.openaiModel = config.model || CONFIG.openai.defaultModel;
        } else {
            this.openaiApiUrl = CONFIG.openai.defaultUrl;
            this.openaiApiKey = CONFIG.openai.defaultKey;
            this.openaiModel = CONFIG.openai.defaultModel;
        }
    }
    
    // 保存OpenAI配置到本地存储
    saveOpenAIConfig(url, key, model) {
        this.openaiApiUrl = url || CONFIG.openai.defaultUrl;
        this.openaiApiKey = key || '';
        this.openaiModel = model || CONFIG.openai.defaultModel;
        localStorage.setItem(CONFIG.openai.storageKey, JSON.stringify({
            url: this.openaiApiUrl,
            key: this.openaiApiKey,
            model: this.openaiModel
        }));
    }
    
    // 检查OpenAI配置是否有效
    isOpenAIConfigValid() {
        return this.openaiApiUrl && this.openaiApiKey;
    }
    
    // 记录调试信息
    logDebug(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.debugInfo.push(`[${timestamp}] ${message}`);
        // 保持日志不超过20条
        if (this.debugInfo.length > 20) {
            this.debugInfo.shift();
        }
        // 更新UI中的调试信息
        const debugInfoElement = document.getElementById('debug-info');
        if (debugInfoElement) {
            debugInfoElement.textContent = this.debugInfo.join('\n');
        }
    }
    
    // 发送请求到OpenAI API，带重试机制
    async sendToOpenAI(messages) {
        if (!this.isOpenAIConfigValid()) {
            this.logDebug('错误: OpenAI配置不完整');
            throw new Error('OpenAI配置不完整，请在设置中配置API URL和Key');
        }
        // 只用默认配置
        const model = this.openaiModel;
        const requestBody = {
            model: model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000
        };
        // 直接使用完整API地址
        const apiUrl = this.openaiApiUrl;
        this.logDebug(`API URL: ${apiUrl}`);
        
        // 实现带指数退避的重试机制
        let attempt = 0;
        let lastError = null;
        
        while (attempt < this.fetchRetryCount) {
            try {
                this.logDebug(`正在发送请求到API (模型: ${this.openaiModel})，尝试 ${attempt + 1}/${this.fetchRetryCount}`);
                
                // 尝试使用fetch API发送请求
                const response = await this._fetchWithTimeout(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.openaiApiKey}`
                    },
                    body: JSON.stringify(requestBody)
                }, 30000); // 30秒超时
                
                if (!response.ok) {
                    let errorMessage = `API错误: ${response.status} ${response.statusText}`;
                    try {
                        const errorData = await response.json();
                        errorMessage = `API错误: ${errorData.error?.message || errorData.error || response.statusText}`;
                    } catch (e) {
                        // 如果无法解析JSON，使用默认错误消息
                    }
                    this.logDebug(errorMessage);
                    throw new Error(errorMessage);
                }
                
                const data = await response.json();
                this.logDebug('成功从API获取响应');
                
                // 处理OpenAI格式的响应
                if (data.choices && data.choices.length > 0) {
                    if (data.choices[0].message && data.choices[0].message.content) {
                        return data.choices[0].message.content;
                    } else if (data.choices[0].text) {
                        return data.choices[0].text;
                    }
                }
                
                // 如果没有找到预期的响应格式，记录响应数据并抛出错误
                this.logDebug(`意外的响应格式: ${JSON.stringify(data).substring(0, 200)}...`);
                return `未能获取标准格式响应，但服务器返回了数据。这里是原始回复: ${JSON.stringify(data).substring(0, 100)}...`;
                
            } catch (error) {
                lastError = error;
                attempt++;
                
                // 如果是网络错误（如Failed to fetch），记录并进行重试
                const isNetworkError = error.message.includes('Failed to fetch') || 
                                      error.message.includes('NetworkError') ||
                                      error.message.includes('Network request failed') ||
                                      error.message.includes('timeout');
                
                if (isNetworkError && attempt < this.fetchRetryCount) {
                    // 计算指数退避延迟
                    const delay = this.fetchRetryDelay * Math.pow(2, attempt - 1);
                    this.logDebug(`网络请求失败，将在 ${delay}ms 后重试 (${attempt}/${this.fetchRetryCount}): ${error.message}`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                this.logDebug(`API调用失败: ${error.message}`);
                break;
            }
        }
        
        // 如果所有重试都失败，尝试使用备用方法请求API
        try {
            this.logDebug(`尝试使用备用方法请求API...`);
            const result = await this._fetchWithXMLHttpRequest(apiUrl, requestBody);
            return result;
        } catch (xhrError) {
            // 如果备用方法也失败，抛出最初的错误
            console.error('API调用失败:', lastError);
            throw lastError;
        }
    }
    
    // 带超时的fetch
    async _fetchWithTimeout(url, options, timeout) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('请求超时')), timeout)
            )
        ]);
    }
    
    // 使用XMLHttpRequest作为备用方法
    _fetchWithXMLHttpRequest(url, requestBody) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('Authorization', `Bearer ${this.openaiApiKey}`);
            xhr.timeout = 30000; // 30秒超时
            
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (data.choices && data.choices.length > 0) {
                            if (data.choices[0].message && data.choices[0].message.content) {
                                resolve(data.choices[0].message.content);
                            } else if (data.choices[0].text) {
                                resolve(data.choices[0].text);
                            } else {
                                resolve(`收到响应但格式不标准: ${JSON.stringify(data).substring(0, 100)}...`);
                            }
                        } else {
                            resolve(`收到响应但没有choices: ${JSON.stringify(data).substring(0, 100)}...`);
                        }
                    } catch (e) {
                        reject(new Error(`解析响应失败: ${e.message}`));
                    }
                } else {
                    reject(new Error(`HTTP错误: ${xhr.status}`));
                }
            };
            
            xhr.onerror = function() {
                reject(new Error('网络请求失败'));
            };
            
            xhr.ontimeout = function() {
                reject(new Error('请求超时'));
            };
            
            xhr.send(JSON.stringify(requestBody));
        });
    }
    
    // 获取可用的TTS声音列表
    async getAvailableVoices() {
        if (this.availableVoices) {
            return this.availableVoices;
        }
        
        try {
            const response = await fetch(`${CONFIG.tts.voicesUrl}?l=zh&f=1`);
            if (!response.ok) {
                throw new Error(`获取声音列表失败: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.availableVoices = data;
            return data;
        } catch (error) {
            console.error('获取TTS声音列表失败:', error);
            throw error;
        }
    }
    
    // 将文本转换为语音，带重试机制
    async textToSpeech(text, voice, rate = 0, pitch = 0) {
        if (!text || text.trim() === '') {
            this.logDebug('文本为空，不进行TTS转换');
            throw new Error('文本为空，不进行TTS转换');
        }
        
        try {
            this.logDebug(`转换文本为语音 (声音: ${voice}, 长度: ${text.length}字符)`);
            
            // 对长文本进行分割处理
            if (text.length > 300) {
                this.logDebug('文本过长，进行分段处理');
                return await this.processLongTextTTS(text, voice, rate, pitch);
            }
            
            // 实现重试机制
            let attempt = 0;
            let lastError = null;
            
            while (attempt < this.fetchRetryCount) {
                try {
                    // 使用POST方法发送请求
                    const response = await this._fetchWithTimeout(CONFIG.tts.apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            text: text,
                            voice: voice,
                            rate: rate,
                            pitch: pitch
                        })
                    }, 30000);
                    
                    if (!response.ok) {
                        const errorMessage = `TTS API错误: ${response.statusText}`;
                        this.logDebug(errorMessage);
                        throw new Error(errorMessage);
                    }
                    
                    // 返回音频Blob对象
                    const audioBlob = await response.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    this.logDebug('成功获取TTS音频');
                    return audioUrl;
                    
                } catch (error) {
                    lastError = error;
                    attempt++;
                    
                    // 如果是网络错误，进行重试
                    const isNetworkError = error.message.includes('Failed to fetch') || 
                                        error.message.includes('NetworkError') ||
                                        error.message.includes('Network request failed') ||
                                        error.message.includes('timeout');
                                        
                    if (isNetworkError && attempt < this.fetchRetryCount) {
                        const delay = this.fetchRetryDelay * Math.pow(2, attempt - 1);
                        this.logDebug(`TTS请求失败，将在 ${delay}ms 后重试 (${attempt}/${this.fetchRetryCount}): ${error.message}`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    
                    this.logDebug(`TTS API调用失败: ${error.message}`);
                    break;
                }
            }
            
            // 如果重试失败，尝试使用备用TTS服务
            return await this._fallbackTextToSpeech(text, voice);
            
        } catch (error) {
            this.logDebug(`TTS API调用失败: ${error.message}`);
            console.error('TTS API调用失败:', error);
            throw error;
        }
    }
    
    // 备用TTS服务
    async _fallbackTextToSpeech(text, voice) {
        this.logDebug(`尝试使用备用TTS服务...`);
        
        // 使用浏览器内置的语音合成（如果可用）
        if ('speechSynthesis' in window) {
            return new Promise((resolve, reject) => {
                try {
                    // 创建AudioContext用于录制
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const mediaStreamDestination = audioContext.createMediaStreamDestination();
                    const mediaRecorder = new MediaRecorder(mediaStreamDestination.stream);
                    const audioChunks = [];
                    
                    mediaRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            audioChunks.push(event.data);
                        }
                    };
                    
                    mediaRecorder.onstop = () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                        const audioUrl = URL.createObjectURL(audioBlob);
                        resolve(audioUrl);
                    };
                    
                    // 使用浏览器的语音合成API
                    const utterance = new SpeechSynthesisUtterance(text);
                    
                    // 尝试匹配类似的声音
                    const voices = speechSynthesis.getVoices();
                    if (voice.includes('zh-CN')) {
                        // 寻找中文声音
                        const zhVoice = voices.find(v => v.lang.includes('zh'));
                        if (zhVoice) utterance.voice = zhVoice;
                    } else if (voice.includes('en-US')) {
                        // 寻找英文声音
                        const enVoice = voices.find(v => v.lang.includes('en'));
                        if (enVoice) utterance.voice = enVoice;
                    }
                    
                    mediaRecorder.start();
                    speechSynthesis.speak(utterance);
                    
                    utterance.onend = () => {
                        mediaRecorder.stop();
                    };
                    
                    utterance.onerror = (error) => {
                        mediaRecorder.stop();
                        reject(new Error(`语音合成错误: ${error.message || '未知错误'}`));
                    };
                    
                } catch (error) {
                    this.logDebug(`浏览器语音合成失败: ${error.message}`);
                    reject(error);
                }
            });
        }
        
        // 如果浏览器不支持语音合成，创建一个简单的音频提示
        return this._createSimpleAudioPrompt();
    }
    
    // 创建简单的音频提示
    _createSimpleAudioPrompt() {
        return new Promise((resolve) => {
            // 创建AudioContext
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // 设置频率和增益
            oscillator.type = 'sine';
            oscillator.frequency.value = 440; // A4音符
            gainNode.gain.value = 0.5;
            
            // 播放短暂的提示音
            oscillator.start();
            
            // 在0.3秒后停止
            setTimeout(() => {
                oscillator.stop();
                
                // 创建一个模拟的音频URL
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, 1, 1);
                const fakeAudioUrl = canvas.toDataURL();
                
                resolve(fakeAudioUrl);
            }, 300);
        });
    }
    
    // 分段处理长文本TTS (避免API限制)
    async processLongTextTTS(text, voice, rate = 0, pitch = 0) {
        // 将文本按句子分割
        const sentences = text.split(/(?<=[.!?。！？])\s+/);
        const chunks = [];
        let currentChunk = '';
        
        // 将句子组合成适当大小的块
        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length < 500) {
                currentChunk += sentence + ' ';
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = sentence + ' ';
            }
        }
        
        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }
        
        // 依次处理每个块
        const audioUrls = [];
        for (const chunk of chunks) {
            const audioUrl = await this.textToSpeech(chunk, voice, rate, pitch);
            audioUrls.push(audioUrl);
        }
        
        return {
            text: text,
            audioUrls: audioUrls
        };
    }
}

// 创建API服务实例
const apiService = new APIService();
