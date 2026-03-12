import { useCallback, useEffect, useState } from 'react';

interface EngineConfig {
  anthropicBaseUrl: string;
  anthropicApiKey: string;
  agentModel: string;
  gmModel: string;
  verifierTier1Model: string;
  verifierTier2Model: string;
}

interface EngineConfigPayload {
  current: EngineConfig;
  defaults: EngineConfig;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

const OFFICIAL_ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

async function parseApiResponse<T>(response: Response): Promise<T> {
  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    throw new Error('Invalid API response');
  }

  if (!response.ok || !payload?.success || payload.data === undefined) {
    const fallback = response.ok
      ? 'Request failed'
      : `Request failed with status ${response.status}`;
    throw new Error(payload?.message ?? fallback);
  }

  return payload.data;
}

function hasDivergentModels(cfg: EngineConfig): boolean {
  const models = [
    cfg.agentModel,
    cfg.gmModel,
    cfg.verifierTier1Model,
    cfg.verifierTier2Model,
  ].filter(Boolean);
  return new Set(models).size > 1;
}

export function useEngineModelConfig() {
  const [defaults, setDefaults] = useState<EngineConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [hasExistingApiKey, setHasExistingApiKey] = useState(false);
  const [hasMixedModels, setHasMixedModels] = useState(false);

  const syncFromConfig = useCallback(
    (current: EngineConfig, fallbackDefaults?: EngineConfig) => {
      setBaseUrl(current.anthropicBaseUrl || fallbackDefaults?.anthropicBaseUrl || '');
      setModel(current.agentModel || fallbackDefaults?.agentModel || '');
      setHasExistingApiKey(Boolean(current.anthropicApiKey));
      setHasMixedModels(hasDivergentModels(current));
      // Never keep secrets in client state longer than necessary.
      setApiKey('');
    },
    []
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/config', { cache: 'no-store' });
      const data = await parseApiResponse<EngineConfigPayload>(res);
      setDefaults(data.defaults);
      syncFromConfig(data.current, data.defaults);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [syncFromConfig]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const applyPatch = useCallback(
    async (patch: Partial<EngineConfig>, successMessage: string) => {
      setSaving(true);
      setError(null);
      setSuccess(null);
      try {
        const res = await fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const saved = await parseApiResponse<EngineConfig>(res);
        syncFromConfig(saved, defaults ?? undefined);
        setSuccess(successMessage);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [defaults, syncFromConfig]
  );

  const saveCustomConfig = useCallback(async () => {
    const normalizedBaseUrl = baseUrl.trim();
    const normalizedModel = model.trim();
    const normalizedApiKey = apiKey.trim();

    if (!normalizedBaseUrl) {
      setError('请填写 API 地址。');
      return;
    }
    if (!normalizedModel) {
      setError('请填写模型名称。');
      return;
    }

    const patch: Partial<EngineConfig> = {
      anthropicBaseUrl: normalizedBaseUrl,
      agentModel: normalizedModel,
      gmModel: normalizedModel,
      verifierTier1Model: normalizedModel,
      verifierTier2Model: normalizedModel,
    };
    if (normalizedApiKey) {
      patch.anthropicApiKey = normalizedApiKey;
    }

    await applyPatch(patch, '自定义模型配置已保存。');
  }, [apiKey, applyPatch, baseUrl, model]);

  const restoreDefaultClaude = useCallback(async () => {
    if (!defaults) {
      setError('默认配置尚未加载完成。');
      return;
    }
    await applyPatch(
      {
        anthropicBaseUrl: defaults.anthropicBaseUrl,
        anthropicApiKey: defaults.anthropicApiKey,
        agentModel: defaults.agentModel,
        gmModel: defaults.gmModel,
        verifierTier1Model: defaults.verifierTier1Model,
        verifierTier2Model: defaults.verifierTier2Model,
      },
      '已恢复默认 Claude 配置。'
    );
  }, [applyPatch, defaults]);

  const useClaudeCodeMembership = useCallback(async () => {
    const normalizedModel =
      model.trim() || defaults?.agentModel || 'claude-sonnet-4-6';
    await applyPatch(
      {
        anthropicBaseUrl: OFFICIAL_ANTHROPIC_BASE_URL,
        anthropicApiKey: '',
        agentModel: normalizedModel,
        gmModel: normalizedModel,
        verifierTier1Model: normalizedModel,
        verifierTier2Model: normalizedModel,
      },
      '已切换为 Claude Code 会员登录模式。'
    );
  }, [applyPatch, defaults?.agentModel, model]);

  return {
    loading,
    saving,
    error,
    success,
    baseUrl,
    apiKey,
    model,
    hasExistingApiKey,
    hasMixedModels,
    setBaseUrl,
    setApiKey,
    setModel,
    saveCustomConfig,
    restoreDefaultClaude,
    useClaudeCodeMembership,
    reload,
  };
}
