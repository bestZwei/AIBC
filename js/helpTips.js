/**
 * 帮助提示模块
 * 提供针对不同功能的使用提示
 * 实现新功能引导和用户帮助
 */

class HelpTips {
  constructor() {
    this.tipsKey = 'aibc_tips_shown';
    this.tips = {
      general: [
        '欢迎使用AIBC AI广播电台！点击播放按钮开始收听。',
        '通过左侧的频道选择器切换不同的AI主播节目。',
        '您可以通过底部的输入框与AI主播互动，提问或建议话题。',
        '右上角的月亮/太阳图标可以切换暗色/亮色主题。'
      ],
      stations: [
        '新闻频道：提供AI生成的最新热点新闻和评论。',
        '故事频道：享受AI讲述的原创短篇故事。',
        '科普频道：了解有趣的科学知识和前沿发现。',
        '闲聊频道：轻松话题与日常生活讨论。',
        '访谈频道：模拟与各类人物的深度对话。'
      ],
      interaction: [
        '输入问题并发送，AI主播会在下一段内容中回应您。',
        '您可以建议话题，AI主播会尝试围绕您的建议制作内容。',
        '互动历史会保留您最近的几次互动记录。'
      ]
    };
    this.currentTip = null;
    this.tipElement = null;
    this.closeButton = null;
    this.tipContainer = null;
  }

  /**
   * 初始化帮助提示
   */
  initialize() {
    // 创建提示容器
    this.createTipContainer();
    
    // 检查是否已经显示过提示
    const tipsShown = utils.getLocalStorage(this.tipsKey, false);
    
    // 如果是新用户，显示入门提示
    if (!tipsShown) {
      setTimeout(() => {
        this.showTip('general', 0);
      }, 3000);
      
      // 标记已显示提示
      utils.setLocalStorage(this.tipsKey, true);
    }
    
    return true;
  }
  
  /**
   * 创建提示容器
   */
  createTipContainer() {
    // 创建提示容器
    this.tipContainer = document.createElement('div');
    this.tipContainer.className = 'tip-container';
    
    // 创建提示元素
    this.tipElement = document.createElement('div');
    this.tipElement.className = 'tip-content';
    
    // 创建关闭按钮
    this.closeButton = document.createElement('button');
    this.closeButton.className = 'tip-close';
    this.closeButton.innerHTML = '<i class="fas fa-times"></i>';
    this.closeButton.addEventListener('click', () => this.hideTip());
    
    // 创建下一步按钮
    this.nextButton = document.createElement('button');
    this.nextButton.className = 'tip-next';
    this.nextButton.textContent = '下一提示';
    this.nextButton.addEventListener('click', () => this.showNextTip());
    
    // 组装提示容器
    this.tipContainer.appendChild(this.tipElement);
    this.tipContainer.appendChild(this.closeButton);
    this.tipContainer.appendChild(this.nextButton);
    
    // 添加到文档
    document.body.appendChild(this.tipContainer);
    
    // 初始隐藏
    this.tipContainer.style.display = 'none';
  }
  
  /**
   * 显示特定分类和索引的提示
   * @param {string} category 提示分类
   * @param {number} index 提示索引
   */
  showTip(category, index) {
    if (!this.tips[category] || index >= this.tips[category].length) {
      return false;
    }
    
    this.currentTip = { category, index };
    const tipText = this.tips[category][index];
    
    this.tipElement.textContent = tipText;
    this.tipContainer.style.display = 'flex';
    
    // 更新下一步按钮状态
    const hasNext = (index < this.tips[category].length - 1) || 
                    (category !== 'interaction');
    
    this.nextButton.style.display = hasNext ? 'block' : 'none';
    
    return true;
  }
  
  /**
   * 显示下一个提示
   */
  showNextTip() {
    if (!this.currentTip) return;
    
    const { category, index } = this.currentTip;
    
    // 检查同类别中是否还有下一个提示
    if (index < this.tips[category].length - 1) {
      this.showTip(category, index + 1);
      return;
    }
    
    // 切换到下一个类别
    switch (category) {
      case 'general':
        this.showTip('stations', 0);
        break;
      case 'stations':
        this.showTip('interaction', 0);
        break;
      default:
        this.hideTip();
    }
  }
  
  /**
   * 隐藏当前提示
   */
  hideTip() {
    this.tipContainer.style.display = 'none';
    this.currentTip = null;
  }
  
  /**
   * 显示特定功能区的帮助提示
   * @param {string} feature 功能名称
   */
  showFeatureHelp(feature) {
    switch (feature) {
      case 'station':
        this.showTip('stations', 0);
        break;
      case 'interaction':
        this.showTip('interaction', 0);
        break;
      default:
        this.showTip('general', 0);
    }
  }
}

// 创建全局单例
const helpTips = new HelpTips();