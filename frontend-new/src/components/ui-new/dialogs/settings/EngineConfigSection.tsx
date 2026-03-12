// @input: /api/config GET/PUT endpoints
// @output: 引擎配置设置面板（自定义 + 恢复默认）
// @position: SettingsDialog 的 Engine 标签页

import { useState, useEffect, useCallback } from 'react';
import { ArrowCounterClockwiseIcon, FloppyDiskIcon } from '@phosphor-icons/react';

interface DUConfig {
  anthropicBaseUrl: string;
  anthropicApiKey: string;
  agentModel: string;
  gmModel: string;
  verifierTier1Model: string;
  verifierTier2Model: string;
  maxConcurrentAgents: number;
  heartbeatIntervalMs: number;
  maxChatDurationMs: number;
}

type ConfigKey = keyof DUConfig;

interface ConfigData {
  current: DUConfig;
  defaults: DUConfig;
  envMap: Record<ConfigKey, string>;
}

const LABELS: Record<ConfigKey, { label: string; hint: string }> = {
  anthropicBaseUrl: { label: 'API Base URL', hint: 'Anthropic API 代理地址' },
  anthropicApiKey: { label: 'API Key', hint: '留空则使用环境变量' },
  agentModel: { label: 'Agent Model', hint: '居民唤醒使用的模型' },
  gmModel: { label: 'GM Model', hint: '主脑意图识别使用的模型' },
  verifierTier1Model: { label: 'Verifier T1 Model', hint: 'Carlini Tier1 验证器模型' },
  verifierTier2Model: { label: 'Verifier T2 Model', hint: 'Carlini Tier2 验证器模型' },
  maxConcurrentAgents: { label: 'Max Concurrent', hint: '最大同时唤醒数量' },
  heartbeatIntervalMs: { label: 'Heartbeat (ms)', hint: '心跳检测间隔' },
  maxChatDurationMs: { label: 'Chat Timeout (ms)', hint: 'GM 对话超时时间' },
};

const KEY_ORDER: ConfigKey[] = [
  'anthropicBaseUrl', 'anthropicApiKey',
  'agentModel', 'gmModel',
  'verifierTier1Model', 'verifierTier2Model',
  'maxConcurrentAgents', 'heartbeatIntervalMs', 'maxChatDurationMs',
];

export function EngineConfigSectionContent() {
  const [data, setData] = useState<ConfigData | null>(null);
  const [draft, setDraft] = useState<DUConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      const json = await res.json();
      if (json.data) {
        setData(json.data);
        setDraft(json.data.current);
      }
    } catch (e) { setError((e as Error).message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Save failed');
      setData(d => d ? { ...d, current: json.data } : d);
      setDraft(json.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/config/reset', { method: 'POST' });
      const json = await res.json();
      setData(d => d ? { ...d, current: json.data } : d);
      setDraft(json.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  if (!data || !draft) {
    return <div className="p-6 text-sm text-low">Loading config...</div>;
  }

  const isModified = JSON.stringify(draft) !== JSON.stringify(data.current);

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium text-high">引擎配置</h3>
          <p className="text-xs text-low mt-1">
            覆盖优先级: 默认值 → 环境变量 → 自定义配置
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-sm border border-border hover:bg-secondary transition-colors disabled:opacity-40"
          >
            <ArrowCounterClockwiseIcon className="size-3.5" />
            恢复默认
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isModified}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-sm bg-brand text-on-brand hover:bg-brand-hover disabled:opacity-40 transition-colors"
          >
            <FloppyDiskIcon className="size-3.5" />
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {error && (
        <div className="py-2 px-3 bg-error/10 text-error text-xs rounded-sm">{error}</div>
      )}
      {success && (
        <div className="py-2 px-3 bg-success/10 text-success text-xs rounded-sm">配置已保存</div>
      )}

      <div className="space-y-4">
        {KEY_ORDER.map(key => (
          <ConfigField
            key={key}
            configKey={key}
            value={draft[key]}
            defaultValue={data.defaults[key]}
            envVar={data.envMap[key]}
            onChange={val => setDraft(d => d ? { ...d, [key]: val } : d)}
          />
        ))}
      </div>
    </div>
  );
}

function ConfigField({ configKey, value, defaultValue, envVar, onChange }: {
  configKey: ConfigKey;
  value: string | number;
  defaultValue: string | number;
  envVar: string;
  onChange: (v: string | number) => void;
}) {
  const { label, hint } = LABELS[configKey];
  const isSecret = configKey === 'anthropicApiKey';
  const isNumber = typeof defaultValue === 'number';
  const isDefault = String(value) === String(defaultValue);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-normal">{label}</label>
        <span className="text-xs text-low font-mono">{envVar}</span>
      </div>
      <input
        type={isSecret ? 'password' : isNumber ? 'number' : 'text'}
        value={String(value)}
        onChange={e => onChange(isNumber ? Number(e.target.value) : e.target.value)}
        placeholder={String(defaultValue)}
        className="w-full px-3 py-2 text-sm rounded-sm border border-border bg-panel text-normal placeholder:text-low focus:outline-none focus:border-brand transition-colors font-mono"
      />
      <div className="flex items-center justify-between text-xs text-low">
        <span>{hint}</span>
        {!isDefault && (
          <button
            onClick={() => onChange(defaultValue)}
            className="text-brand hover:underline"
          >
            恢复默认: {isSecret ? '***' : String(defaultValue)}
          </button>
        )}
      </div>
    </div>
  );
}
