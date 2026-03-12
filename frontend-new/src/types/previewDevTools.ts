// @input: 无
// @output: Preview/DevTools 相关类型定义
// @position: 类型层，供 PreviewBrowser 和 hooks 使用

export interface NavigationState {
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
}
