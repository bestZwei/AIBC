/**
 * 播放统计模块
 * 记录用户在各频道的收听时间
 * 提供统计数据的可视化
 */

class StatsManager {
  constructor() {
    this.statsKey = 'aibc_playback_stats';
    this.stats = {
      totalPlayTime: 0,         // 总播放时间(秒)
      lastSessionDate: null,    // 最后一次会话日期
      stationStats: {},         // 各频道的统计数据
      sessionCount: 0,          // 会话次数
      interactionCount: 0       // 互动次数
    };
    
    this.currentStation = null;
    this.sessionStartTime = null;
    this.isTracking = false;
    this.trackingInterval = null;
  }
  
  /**
   * 初始化统计管理器
   */
  initialize() {
    // 从本地存储加载统计数据
    const savedStats = utils.getLocalStorage(this.statsKey, null);
    if (savedStats) {
      this.stats = savedStats;
    }
    
    // 更新会话计数
    this.stats.sessionCount += 1;
    this.stats.lastSessionDate = new Date().toISOString();
    
    // 保存初始数据
    this.saveStats();
    
    return true;
  }
  
  /**
   * 开始追踪播放时间
   * @param {string} stationId 当前频道ID
   */
  startTracking(stationId) {
    if (this.isTracking) {
      this.stopTracking();
    }
    
    this.currentStation = stationId;
    this.sessionStartTime = Date.now();
    this.isTracking = true;
    
    // 每30秒更新一次统计数据
    this.trackingInterval = setInterval(() => {
      this.updatePlayTime();
    }, 30000);
    
    // 确保频道在统计中存在
    if (!this.stats.stationStats[stationId]) {
      this.stats.stationStats[stationId] = {
        playTime: 0,
        lastPlayed: new Date().toISOString(),
        interactionCount: 0
      };
    } else {
      this.stats.stationStats[stationId].lastPlayed = new Date().toISOString();
    }
  }
  
  /**
   * 停止追踪播放时间
   */
  stopTracking() {
    if (!this.isTracking) return;
    
    // 更新最后一次播放时间
    this.updatePlayTime();
    
    // 清除定时器
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
    
    this.isTracking = false;
    this.currentStation = null;
    this.sessionStartTime = null;
  }
  
  /**
   * 更新播放时间统计
   */
  updatePlayTime() {
    if (!this.isTracking || !this.currentStation || !this.sessionStartTime) return;
    
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - this.sessionStartTime) / 1000);
    
    // 更新总播放时间
    this.stats.totalPlayTime += elapsedSeconds;
    
    // 更新频道播放时间
    if (this.stats.stationStats[this.currentStation]) {
      this.stats.stationStats[this.currentStation].playTime += elapsedSeconds;
    }
    
    // 重置会话开始时间
    this.sessionStartTime = now;
    
    // 保存统计数据
    this.saveStats();
  }
  
  /**
   * 记录用户互动
   * @param {string} stationId 频道ID
   */
  recordInteraction(stationId) {
    // 更新总互动次数
    this.stats.interactionCount += 1;
    
    // 更新频道互动次数
    if (this.stats.stationStats[stationId]) {
      if (!this.stats.stationStats[stationId].interactionCount) {
        this.stats.stationStats[stationId].interactionCount = 0;
      }
      this.stats.stationStats[stationId].interactionCount += 1;
    }
    
    // 保存统计数据
    this.saveStats();
  }
  
  /**
   * 保存统计数据到本地存储
   */
  saveStats() {
    utils.setLocalStorage(this.statsKey, this.stats);
  }
  
  /**
   * 清除统计数据
   */
  clearStats() {
    this.stats = {
      totalPlayTime: 0,
      lastSessionDate: new Date().toISOString(),
      stationStats: {},
      sessionCount: 1,
      interactionCount: 0
    };
    
    this.saveStats();
  }
  
  /**
   * 获取格式化的统计数据
   * @returns {Object} 可读性更好的统计数据
   */
  getFormattedStats() {
    const formattedStats = {
      totalPlayTime: this.formatTime(this.stats.totalPlayTime),
      sessionCount: this.stats.sessionCount,
      interactionCount: this.stats.interactionCount,
      lastSession: this.formatDate(this.stats.lastSessionDate),
      stations: []
    };
    
    // 格式化各频道数据
    for (const [stationId, data] of Object.entries(this.stats.stationStats)) {
      // 获取频道名称
      const station = stationManager.getStation(stationId);
      const stationName = station ? station.name : stationId;
      
      formattedStats.stations.push({
        id: stationId,
        name: stationName,
        playTime: this.formatTime(data.playTime),
        lastPlayed: this.formatDate(data.lastPlayed),
        interactionCount: data.interactionCount || 0,
        playTimeSeconds: data.playTime || 0
      });
    }
    
    // 按播放时间排序
    formattedStats.stations.sort((a, b) => b.playTimeSeconds - a.playTimeSeconds);
    
    return formattedStats;
  }
  
  /**
   * 格式化时间（秒）为可读形式
   * @param {number} seconds 秒数
   * @returns {string} 格式化后的时间
   */
  formatTime(seconds) {
    if (!seconds) return '0分钟';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  }
  
  /**
   * 格式化日期字符串
   * @param {string} dateString ISO日期字符串
   * @returns {string} 格式化后的日期
   */
  formatDate(dateString) {
    if (!dateString) return '未知';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '日期格式错误';
    }
  }
  
  /**
   * 记录频道切换
   * @param {string} stationId 新频道ID
   */
  switchStation(stationId) {
    // 如果正在追踪时间，先停止对前一个频道的追踪
    if (this.isTracking && this.currentStation) {
      this.updatePlayTime();
    }
    
    // 确保频道在统计中存在
    if (!this.stats.stationStats[stationId]) {
      this.stats.stationStats[stationId] = {
        playTime: 0,
        lastPlayed: new Date().toISOString(),
        interactionCount: 0
      };
    } else {
      this.stats.stationStats[stationId].lastPlayed = new Date().toISOString();
    }
    
    // 设置当前频道并开始追踪
    this.currentStation = stationId;
    
    // 如果音频管理器处于播放状态，开始追踪新频道
    if (audioManager.isPlaying) {
      this.startTracking(stationId);
    }
    
    utils.log('info', `频道统计切换到: ${stationId}`);
  }
}

// 创建全局单例
const statsManager = new StatsManager();