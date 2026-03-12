// @input: provider 名称、点击回调、loading 状态
// @output: OAuth 登录按钮（GitHub/Google 等）
// @position: 登录页基础组件

interface OAuthSignInButtonProps {
  provider: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
}

export function OAuthSignInButton({ provider, onClick, disabled, loading, loadingText }: OAuthSignInButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center justify-center gap-base w-full rounded-sm border border-border bg-panel px-base py-half text-sm text-normal hover:bg-primary disabled:opacity-40"
    >
      {loading ? loadingText : `Sign in with ${provider}`}
    </button>
  );
}
