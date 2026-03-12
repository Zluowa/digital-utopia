import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BirdIcon,
  CheckIcon,
  CowIcon,
  DeviceMobileIcon,
  MusicNoteIcon,
  MusicNotesIcon,
  SpeakerHighIcon,
  SpeakerXIcon,
  WarningIcon,
  WaveformIcon,
  type Icon,
} from '@phosphor-icons/react';
import { Navigate, useNavigate } from 'react-router-dom';
import { usePostHog } from 'posthog-js/react';
import {
  BaseCodingAgent,
  EditorType,
  SoundFile,
  type EditorConfig,
} from 'shared/types';
import { useTranslation } from 'react-i18next';
import { useUserSystem } from '@/components/ConfigProvider';
import { AgentIcon, getAgentName } from '@/components/agents/AgentIcon';
import { IdeIcon, getIdeName } from '@/components/ide/IdeIcon';
import { cn } from '@/lib/utils';
import { PrimaryButton } from '@/components/ui-new/primitives/PrimaryButton';

type SoundOption = {
  value: SoundFile;
  label: string;
  icon: Icon;
};

const SOUND_OPTIONS: SoundOption[] = [
  {
    value: SoundFile.ABSTRACT_SOUND1,
    label: 'Abstract Sound 1',
    icon: WaveformIcon,
  },
  {
    value: SoundFile.ABSTRACT_SOUND2,
    label: 'Abstract Sound 2',
    icon: MusicNoteIcon,
  },
  {
    value: SoundFile.ABSTRACT_SOUND3,
    label: 'Abstract Sound 3',
    icon: MusicNotesIcon,
  },
  {
    value: SoundFile.ABSTRACT_SOUND4,
    label: 'Abstract Sound 4',
    icon: SpeakerHighIcon,
  },
  {
    value: SoundFile.COW_MOOING,
    label: 'Cow Mooing',
    icon: CowIcon,
  },
  {
    value: SoundFile.PHONE_VIBRATION,
    label: 'Phone Vibration',
    icon: DeviceMobileIcon,
  },
  {
    value: SoundFile.ROOSTER,
    label: 'Rooster',
    icon: BirdIcon,
  },
];

const AGENT_PRIORITY: BaseCodingAgent[] = [
  BaseCodingAgent.CLAUDE_CODE,
  BaseCodingAgent.CODEX,
  BaseCodingAgent.OPENCODE,
  BaseCodingAgent.GEMINI,
];

const REMOTE_ONBOARDING_EVENTS = {
  STAGE_VIEWED: 'remote_onboarding_ui_stage_viewed',
  STAGE_SUBMITTED: 'remote_onboarding_ui_stage_submitted',
  STAGE_COMPLETED: 'remote_onboarding_ui_stage_completed',
  STAGE_FAILED: 'remote_onboarding_ui_stage_failed',
} as const;

function randomDefaultSoundFile(): SoundFile {
  const randomIndex = Math.floor(Math.random() * SOUND_OPTIONS.length);
  return SOUND_OPTIONS[randomIndex]?.value ?? SoundFile.COW_MOOING;
}

export function LandingPage() {
  const navigate = useNavigate();
  const { config, profiles, updateAndSaveConfig, loading } = useUserSystem();
  const posthog = usePostHog();
  const { t } = useTranslation('common');

  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<BaseCodingAgent>(
    BaseCodingAgent.CLAUDE_CODE
  );
  const [editorType, setEditorType] = useState<EditorType>(EditorType.VS_CODE);
  const [customCommand, setCustomCommand] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundFile, setSoundFile] = useState<SoundFile>(randomDefaultSoundFile);
  const hasTrackedStageViewRef = useRef(false);

  const trackRemoteOnboardingEvent = useCallback(
    (eventName: string, properties: Record<string, unknown> = {}) => {
      posthog?.capture(eventName, {
        ...properties,
        flow: 'remote_onboarding_ui',
        source: 'frontend',
      });
    },
    [posthog]
  );

  useEffect(() => {
    if (!config || initialized) return;

    setSelectedAgent(config.executor_profile?.executor ?? BaseCodingAgent.CLAUDE_CODE);
    setEditorType(config.editor?.editor_type ?? EditorType.VS_CODE);
    setCustomCommand(config.editor?.custom_command || '');
    setInitialized(true);
  }, [config, initialized]);

  useEffect(() => {
    if (!config || !initialized || hasTrackedStageViewRef.current) return;

    trackRemoteOnboardingEvent(REMOTE_ONBOARDING_EVENTS.STAGE_VIEWED, {
      stage: 'landing',
    });
    hasTrackedStageViewRef.current = true;
  }, [config, initialized, trackRemoteOnboardingEvent]);

  const executorOptions = useMemo(() => {
    const compareAgents = (a: BaseCodingAgent, b: BaseCodingAgent) => {
      const priorityA = AGENT_PRIORITY.indexOf(a);
      const priorityB = AGENT_PRIORITY.indexOf(b);
      const hasPriorityA = priorityA !== -1;
      const hasPriorityB = priorityB !== -1;

      if (hasPriorityA && hasPriorityB) {
        return priorityA - priorityB;
      }
      if (hasPriorityA) return -1;
      if (hasPriorityB) return 1;

      return getAgentName(a).localeCompare(getAgentName(b));
    };

    if (profiles) {
      return (Object.keys(profiles) as BaseCodingAgent[]).sort(compareAgents);
    }
    return [...Object.values(BaseCodingAgent)].sort(compareAgents);
  }, [profiles]);

  const editorOptions = useMemo(() => Object.values(EditorType), []);

  const playSound = async (value: SoundFile) => {
    const audio = new Audio(`/api/sounds/${value}`);
    try {
      await audio.play();
    } catch (err) {
      console.error('Failed to play sound:', err);
    }
  };

  const handleSoundSelect = (value: SoundFile) => {
    setSoundEnabled(true);
    setSoundFile(value);
    void playSound(value);
  };

  const isCustomEditorValid =
    editorType !== EditorType.CUSTOM || customCommand.trim() !== '';
  const canContinue = !saving && isCustomEditorValid;

  const handleContinue = async () => {
    if (!config || !canContinue) return;

    const editorConfig: EditorConfig = {
      editor_type: editorType,
      custom_command:
        editorType === EditorType.CUSTOM ? customCommand.trim() : null,
      remote_ssh_host: null,
      remote_ssh_user: null,
      auto_install_extension: true,
    };

    trackRemoteOnboardingEvent(REMOTE_ONBOARDING_EVENTS.STAGE_SUBMITTED, {
      stage: 'landing',
      method: 'continue',
      selected_agent: selectedAgent,
      editor_type: editorType,
      custom_editor_command_set:
        editorType === EditorType.CUSTOM && customCommand.trim() !== '',
      sound_enabled: soundEnabled,
      sound_file: soundEnabled ? soundFile : null,
    });

    setSaving(true);
    const success = await updateAndSaveConfig({
      onboarding_acknowledged: true,
      disclaimer_acknowledged: true,
      executor_profile: {
        executor: selectedAgent,
        variant: null,
      },
      editor: editorConfig,
      notifications: {
        ...config.notifications,
        sound_enabled: soundEnabled,
        sound_file: soundFile,
      },
    });
    setSaving(false);

    if (success) {
      trackRemoteOnboardingEvent(REMOTE_ONBOARDING_EVENTS.STAGE_COMPLETED, {
        stage: 'landing',
        destination: '/onboarding/sign-in',
      });
      navigate('/onboarding/sign-in', { replace: true });
      return;
    }

    trackRemoteOnboardingEvent(REMOTE_ONBOARDING_EVENTS.STAGE_FAILED, {
      stage: 'landing',
      reason: 'config_save_failed',
    });
  };

  if (loading || !config || !initialized) {
    return (
      <div className="h-screen bg-primary flex items-center justify-center">
        <p className="text-low">Loading...</p>
      </div>
    );
  }

  if (config.remote_onboarding_acknowledged) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="h-screen overflow-auto bg-primary">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-base py-double">
        <div className="rounded-sm border border-border bg-secondary p-double space-y-double">
          <header className="space-y-double">
            <div className="flex justify-center">
              <h1 className="text-2xl font-bold text-high tracking-wider">
                {t('landing.title', '乌托邦世界')}
              </h1>
            </div>
            <div className="rounded-sm border border-brand bg-brand/20 p-base">
              <div className="flex items-start gap-base">
                <WarningIcon
                  className="size-icon-sm text-brand shrink-0 mt-[2px]"
                  weight="fill"
                />
                <div className="space-y-half text-sm text-normal">
                  <p>{t('landing.warning', '乌托邦世界默认以 --yolo 模式运行 AI Agent。请随时审查 Agent 的行为并备份重要工作。')}</p>
                </div>
              </div>
            </div>
          </header>

          <section className="space-y-half">
            <h2 className="text-base font-medium text-high">
              {t('landing.agentTitle', '选择 AI Agent')}
            </h2>
            <p className="text-sm text-low">
              {t('landing.agentDesc', '选择默认的 AI Agent 配置')}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {executorOptions.map((agent) => {
                const selected = selectedAgent === agent;

                return (
                  <button
                    key={agent}
                    type="button"
                    onClick={() => setSelectedAgent(agent)}
                    className={cn(
                      'flex items-center gap-base rounded-sm border px-base py-half text-left',
                      selected
                        ? 'border-brand bg-brand/10'
                        : 'border-border bg-panel hover:bg-primary'
                    )}
                  >
                    <AgentIcon
                      agent={agent}
                      className="size-icon-xl shrink-0"
                    />
                    <span className="text-sm text-normal flex-1">
                      {getAgentName(agent)}
                    </span>
                    {selected && (
                      <CheckIcon
                        className="size-icon-xs text-brand"
                        weight="bold"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-half">
            <h2 className="text-base font-medium text-high">
              {t('landing.editorTitle', '选择代码编辑器')}
            </h2>
            <p className="text-sm text-low">
              {t('landing.editorDesc', '打开文件和工作空间时使用的编辑器')}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {editorOptions.map((editor) => {
                const selected = editorType === editor;

                return (
                  <button
                    key={editor}
                    type="button"
                    onClick={() => setEditorType(editor)}
                    className={cn(
                      'flex items-center gap-base rounded-sm border px-base py-half text-left',
                      selected
                        ? 'border-brand bg-brand/10'
                        : 'border-border bg-panel hover:bg-primary'
                    )}
                  >
                    <IdeIcon
                      editorType={editor}
                      className="size-icon-sm shrink-0"
                    />
                    <span className="text-sm text-normal flex-1">
                      {getIdeName(editor)}
                    </span>
                    {selected && (
                      <CheckIcon
                        className="size-icon-xs text-brand"
                        weight="bold"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {editorType === EditorType.CUSTOM && (
              <div className="space-y-half">
                <label className="text-sm font-medium text-normal">
                  Custom Command
                </label>
                <input
                  type="text"
                  value={customCommand}
                  onChange={(e) => setCustomCommand(e.target.value)}
                  placeholder="e.g. code --wait"
                  className={cn(
                    'w-full bg-panel border rounded-sm px-base py-half text-sm text-high',
                    'placeholder:text-low placeholder:opacity-80 focus:outline-none',
                    'focus:ring-1 focus:ring-brand',
                    customCommand.trim() === ''
                      ? 'border-warning/60'
                      : 'border-border'
                  )}
                />
              </div>
            )}
          </section>

          <section className="space-y-half">
            <h2 className="text-base font-medium text-high">
              {t('landing.soundTitle', '通知声音')}
            </h2>
            <p className="text-sm text-low">
              {t('landing.soundDesc', '选择通知提示音，或关闭声音')}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SOUND_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = soundEnabled && soundFile === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSoundSelect(option.value)}
                    className={cn(
                      'flex items-center gap-base rounded-sm border px-base py-half text-left',
                      selected
                        ? 'border-brand bg-brand/10'
                        : 'border-border bg-panel hover:bg-primary'
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-icon-sm shrink-0',
                        selected ? 'text-brand' : 'text-normal'
                      )}
                      weight={selected ? 'fill' : 'bold'}
                    />
                    <span className="text-sm text-normal flex-1">
                      {option.label}
                    </span>
                    {selected && (
                      <CheckIcon
                        className="size-icon-xs text-brand"
                        weight="bold"
                      />
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSoundEnabled(false)}
                className={cn(
                  'flex items-center gap-base rounded-sm border px-base py-half text-left',
                  !soundEnabled
                    ? 'border-brand bg-brand/10'
                    : 'border-border bg-panel hover:bg-primary'
                )}
              >
                <SpeakerXIcon
                  className={cn(
                    'size-icon-sm shrink-0',
                    !soundEnabled ? 'text-brand' : 'text-normal'
                  )}
                  weight={!soundEnabled ? 'fill' : 'bold'}
                />
                <span className="text-sm text-normal flex-1">{t('landing.noSound', '静音')}</span>
                {!soundEnabled && (
                  <CheckIcon
                    className="size-icon-xs text-brand"
                    weight="bold"
                  />
                )}
              </button>
            </div>
          </section>

          <div className="pt-base border-t border-border flex items-center justify-end gap-base">
            <PrimaryButton
              value={saving ? t('landing.saving', '保存中...') : t('landing.continue', '继续')}
              onClick={handleContinue}
              disabled={!canContinue}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
