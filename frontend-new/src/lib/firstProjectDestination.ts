// @input: setSelectedOrgId 回调
// @output: 用户第一个项目的目标路径（或 null）
// @position: 登录后路由决策工具函数

export async function getFirstProjectDestination(
  _setSelectedOrgId: (id: string) => void
): Promise<string | null> {
  return null;
}
