// @input: 路径字符串
// @output: 规范化后的绝对路径（或 null）
// @position: 路由层，路径合法性校验工具

export function resolveAppPath(path: string): string | null {
  if (path.startsWith('/')) return path;
  return null;
}
