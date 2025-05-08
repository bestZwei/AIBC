class AudioManager {
    constructor() {
        this.audioQueue = [];
        this.currentAudio = null;
        this.isPlaying = false;
        this.volume = CONFIG.playback.defaultVolume;
        this.onPlaybackStatusChange = null; // 播放状态变化回调
        this.onQueueEmpty = null; // 队列清空回调
        this.onSegmentStart = null; // 音频段开始播放回调
        
        // 绑定方法到实例
        this.playNext = this.playNext.bind(this);
        this.handleAudioEnd = this.handleAudioEnd.bind(this);
    }
    
    // 设置音量
    setVolume(volume) {
        this.volume = volume;
        if (this.currentAudio) {
            this.currentAudio.volume = this.volume;
        }
    }
    
    // 添加音频到队列
    addToQueue(segment) {
        this.audioQueue.push(segment);
        
        // 如果当前没有播放，则开始播放
        if (!this.isPlaying && this.audioQueue.length === 1) {
            this.playNext();
        }
    }
    
    // 清空队列
    clearQueue() {
        this.audioQueue = [];
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        this.isPlaying = false;
        if (this.onPlaybackStatusChange) {
            this.onPlaybackStatusChange(false);
        }
    }
    
    // 播放或暂停
    togglePlayPause() {
        if (!this.currentAudio) {
            if (this.audioQueue.length > 0) {
                this.playNext();
            }
            return;
        }
        
        if (this.isPlaying) {
            this.currentAudio.pause();
            this.isPlaying = false;
        } else {
            this.currentAudio.play();
            this.isPlaying = true;
        }
        
        if (this.onPlaybackStatusChange) {
            this.onPlaybackStatusChange(this.isPlaying);
        }
    }
    
    // 跳到下一段
    skipToNext() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.handleAudioEnd();
        }
    }
    
    // 播放队列中的下一个音频
    playNext() {
        if (this.audioQueue.length === 0) {
            this.isPlaying = false;
            if (this.onPlaybackStatusChange) {
                this.onPlaybackStatusChange(false);
            }
            if (this.onQueueEmpty) {
                this.onQueueEmpty();
            }
            return;
        }
        
        const segment = this.audioQueue.shift();
        
        // 处理可能有多个音频URL的情况
        if (Array.isArray(segment.audioUrls)) {
            this.playAudioSequence(segment);
        } else {
            this.playSingleAudio(segment);
        }
    }
    
    // 播放单个音频
    playSingleAudio(segment) {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        
        const audio = new Audio(segment.audioUrl);
        audio.volume = this.volume;
        
        audio.addEventListener('ended', this.handleAudioEnd);
        audio.addEventListener('error', (e) => {
            console.error('音频播放错误:', e);
            this.handleAudioEnd();
        });
        
        this.currentAudio = audio;
        audio.play()
            .then(() => {
                this.isPlaying = true;
                if (this.onPlaybackStatusChange) {
                    this.onPlaybackStatusChange(true);
                }
                if (this.onSegmentStart) {
                    this.onSegmentStart(segment);
                }
            })
            .catch(error => {
                console.error('音频播放失败:', error);
                this.handleAudioEnd();
            });
    }
    
    // 播放一系列音频
    playAudioSequence(segment) {
        // 创建一个新的段落对象，使用序列中的第一个音频
        const firstSegment = {
            ...segment,
            audioUrl: segment.audioUrls[0]
        };
        
        // 将剩余音频添加回队列前面
        if (segment.audioUrls.length > 1) {
            const remainingUrls = segment.audioUrls.slice(1);
            this.audioQueue.unshift({
                ...segment,
                audioUrls: remainingUrls
            });
        }
        
        // 播放第一个音频
        this.playSingleAudio(firstSegment);
    }
    
    // 处理音频结束事件
    handleAudioEnd() {
        if (this.currentAudio) {
            this.currentAudio.removeEventListener('ended', this.handleAudioEnd);
            this.currentAudio = null;
        }
        
        // 播放下一个
        setTimeout(() => this.playNext(), 500); // 添加短暂延迟作为段落间隔
    }
}

// 创建音频管理器实例
const audioManager = new AudioManager();
