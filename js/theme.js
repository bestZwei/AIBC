/**
 * 主题管理模块
 * 提供亮/暗主题切换功能
 * 记住用户主题偏好
 */

class ThemeManager {
  constructor() {
    this.currentTheme = 'dark'; // 默认暗色主题
    this.themeKey = 'aibc_theme';
    this.themes = {
      dark: {
        '--primary-color': '#0070f3',
        '--secondary-color': '#5f7fff',
        '--accent-color': '#0070f3',
        '--on-air-color': '#ff2e63',
        '--background-color': '#0a0a0a',
        '--surface-color': '#111111',
        '--text-color': '#ededed',
        '--text-secondary': '#a1a1a1',
      },
      light: {
        '--primary-color': '#0060d8',
        '--secondary-color': '#4356e0',
        '--accent-color': '#0060d8',
        '--on-air-color': '#e5006a',
        '--background-color': '#fafafa',
        '--surface-color': '#ffffff',
        '--text-color': '#171717',
        '--text-secondary': '#555555',
      }
    };
  }

  /**
   * 初始化主题管理器
   */
  initialize() {
    // 加载保存的主题设置
    const savedTheme = utils.getLocalStorage(this.themeKey, this.currentTheme);
    this.setTheme(savedTheme);
    return true;
  }

  /**
   * 切换主题
   */
  toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
    return newTheme;
  }

  /**
   * 设置特定主题
   * @param {string} theme 主题名称（'dark'或'light'）
   */
  setTheme(theme) {
    if (!this.themes[theme]) return false;
    
    this.currentTheme = theme;
    utils.setLocalStorage(this.themeKey, theme);
    
    // 应用主题颜色到CSS变量
    const root = document.documentElement;
    const colors = this.themes[theme];
    
    for (const [property, value] of Object.entries(colors)) {
      root.style.setProperty(property, value);
    }
    
    // 更新body的主题类
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${theme}`);
    
    utils.log('info', `主题已切换为: ${theme}`);
    return true;
  }

  /**
   * 获取当前主题
   * @returns {string} 当前主题名称
   */
  getCurrentTheme() {
    return this.currentTheme;
  }
}

// 创建全局单例
const themeManager = new ThemeManager();