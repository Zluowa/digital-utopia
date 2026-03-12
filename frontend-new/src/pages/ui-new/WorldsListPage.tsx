// @input: useWorlds hook — world list + CRUD ops
// @output: world lobby — grid of cards with inline edit/delete/activate
// @position: multi-world entry point, the "lobby"

import { useState, useRef, useEffect, forwardRef, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GlobeIcon,
  ArrowRightIcon,
  DotsThreeIcon,
  SpinnerIcon,
  PencilSimpleIcon,
  TrashIcon,
  ChatCircleDotsIcon,
  LightningIcon,
  CompassIcon,
} from '@phosphor-icons/react';
import { useWorlds, type WorldInfo } from '@/hooks/useWorlds';
import { useActiveWorld } from '@/contexts/ActiveWorldContext';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverClose,
} from '@/components/ui-new/primitives/Popover';

// ─── Types ───────────────────────────────────────────────────────────────────

type CardMode = 'normal' | 'renaming' | 'deleting';

// ─── WorldCard ───────────────────────────────────────────────────────────────

function WorldCard({ world, onActivate, onDelete, onRename }: {
  world: WorldInfo;
  onActivate: (name: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
  onRename: (name: string, newName: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<CardMode>('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState(world.displayName);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const renameRef = useRef<HTMLInputElement>(null);
  const deleteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'renaming') renameRef.current?.focus();
    if (mode === 'deleting') deleteRef.current?.focus();
  }, [mode]);

  const reset = () => {
    setMode('normal');
    setDeleteConfirm('');
    setRenameValue(world.displayName);
    setError(null);
  };

  const exec = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); reset(); } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const submitRename = () => {
    const v = renameValue.trim();
    if (!v || v === world.displayName) { reset(); return; }
    void exec(() => onRename(world.name, v));
  };

  const submitDelete = () => {
    if (deleteConfirm !== world.name) return;
    void exec(() => onDelete(world.name));
  };

  return (
    <div className={cn(
      'bg-secondary rounded-md border p-base flex flex-col gap-half min-h-[140px]',
      'transition-all duration-200 hover:-translate-y-0.5 group relative',
      world.isActive && 'border-brand/50 ring-1 ring-brand/20',
      mode === 'deleting' && 'border-error/30 bg-error/5',
    )}>
      {mode === 'normal' && (
        <CardNormal
          world={world}
          busy={busy}
          error={error}
          onActivate={() => exec(() => onActivate(world.name))}
          onStartRename={() => setMode('renaming')}
          onStartDelete={() => setMode('deleting')}
        />
      )}
      {mode === 'renaming' && (
        <CardRenaming
          ref={renameRef}
          value={renameValue}
          busy={busy}
          onChange={setRenameValue}
          onSubmit={submitRename}
          onCancel={reset}
        />
      )}
      {mode === 'deleting' && (
        <CardDeleting
          ref={deleteRef}
          worldName={world.name}
          confirm={deleteConfirm}
          busy={busy}
          onChange={setDeleteConfirm}
          onSubmit={submitDelete}
          onCancel={reset}
        />
      )}
    </div>
  );
}

// ─── CardNormal ──────────────────────────────────────────────────────────────

function CardNormal({ world, busy, error, onActivate, onStartRename, onStartDelete }: {
  world: WorldInfo;
  busy: boolean;
  error: string | null;
  onActivate: () => void;
  onStartRename: () => void;
  onStartDelete: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-half">
        <GlobeIcon className={cn('size-4 shrink-0', world.isActive ? 'text-brand' : 'text-low')} weight="bold" />
        <span className="text-lg font-medium text-high truncate flex-1">{world.displayName}</span>
        <span className={cn('text-xs shrink-0', world.isActive ? 'text-brand' : 'text-low')}>
          {world.isActive ? '● 运行中' : '○ 未运行'}
        </span>
        <CardMenu isActive={world.isActive} onRename={onStartRename} onDelete={onStartDelete} />
      </div>

      {world.theme && <p className="text-sm text-low line-clamp-2">{world.theme}</p>}
      {error && <p className="text-xs text-error">{error}</p>}

      <div className="flex items-center justify-between mt-auto pt-half">
        <span className="text-xs text-low">{world.agentCount} 位居民</span>
        {world.isActive ? (
          <Link to="/world" className="flex items-center gap-0.5 text-xs text-brand hover:text-brand/80 transition-colors">
            进入世界 <ArrowRightIcon className="size-3" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onActivate}
            disabled={busy}
            className="flex items-center gap-half text-xs text-low hover:text-normal border rounded px-half py-0.5 hover:border-brand/30 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {busy
              ? <><SpinnerIcon className="size-3 animate-spin" /> 切换中...</>
              : <>启动 <ArrowRightIcon className="size-3" /></>}
          </button>
        )}
      </div>
    </>
  );
}

// ─── CardMenu ────────────────────────────────────────────────────────────────

function CardMenu({ isActive, onRename, onDelete }: {
  isActive: boolean;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-primary text-low hover:text-normal cursor-pointer"
        >
          <DotsThreeIcon className="size-4" weight="bold" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-32 p-half">
        <PopoverClose asChild>
          <button type="button" onClick={onRename} className={menuItemCn}>
            <PencilSimpleIcon className="size-3.5" /> 重命名
          </button>
        </PopoverClose>
        <PopoverClose asChild>
          <button
            type="button"
            onClick={isActive ? undefined : onDelete}
            disabled={isActive}
            title={isActive ? '运行中的世界无法删除，请先切换到其他世界' : undefined}
            className={cn(menuItemCn, isActive ? 'opacity-40 cursor-not-allowed' : 'text-error hover:bg-error/10')}
          >
            <TrashIcon className="size-3.5" /> 删除
          </button>
        </PopoverClose>
      </PopoverContent>
    </Popover>
  );
}

const menuItemCn = 'w-full flex items-center gap-half text-sm text-normal hover:text-high px-half py-1 rounded hover:bg-primary transition-colors cursor-pointer';

// ─── CardRenaming ────────────────────────────────────────────────────────────

type CardRenamingProps = {
  value: string;
  busy: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

const CardRenaming = forwardRef<HTMLInputElement, CardRenamingProps>(function CardRenaming({
  value, busy, onChange, onSubmit, onCancel,
}, ref) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') onSubmit();
    if (e.key === 'Escape') onCancel();
  };
  return (
    <div className="flex flex-col gap-half flex-1 justify-center">
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        disabled={busy}
        className={cn(
          'bg-primary rounded border px-half py-1 text-sm text-normal',
          'outline-none focus:ring-1 focus:ring-brand disabled:opacity-50',
        )}
      />
      <div className="flex items-center gap-half">
        <button type="button" onClick={onSubmit} disabled={busy} className="text-xs text-brand hover:text-brand/80 cursor-pointer disabled:opacity-50">
          {busy ? '保存中...' : '保存'}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-low hover:text-normal cursor-pointer">取消</button>
        <span className="text-xs text-low ml-auto">Enter / Esc</span>
      </div>
    </div>
  );
});

// ─── CardDeleting ────────────────────────────────────────────────────────────

type CardDeletingProps = {
  worldName: string;
  confirm: string;
  busy: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

const CardDeleting = forwardRef<HTMLInputElement, CardDeletingProps>(function CardDeleting({
  worldName, confirm, busy, onChange, onSubmit, onCancel,
}, ref) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') onSubmit();
    if (e.key === 'Escape') onCancel();
  };
  return (
    <div className="flex flex-col gap-half flex-1">
      <p className="text-xs text-normal">确认删除？所有居民数据将永久丢失。</p>
      <p className="text-xs text-low">
        输入 <code className="font-ibm-plex-mono text-error">{worldName}</code> 确认
      </p>
      <input
        ref={ref}
        value={confirm}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        disabled={busy}
        placeholder={worldName}
        className={cn(
          'bg-primary rounded border px-half py-1 text-sm text-normal font-ibm-plex-mono',
          'outline-none focus:ring-1 focus:ring-error placeholder:text-low disabled:opacity-50',
        )}
      />
      <div className="flex gap-half mt-auto">
        <button
          type="button"
          onClick={onSubmit}
          disabled={confirm !== worldName || busy}
          className="px-half py-0.5 rounded text-xs bg-error text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
        >
          {busy ? '删除中...' : '删除'}
        </button>
        <button type="button" onClick={onCancel} className="px-half py-0.5 text-xs text-low hover:text-normal cursor-pointer">
          取消
        </button>
      </div>
    </div>
  );
});

// ─── CreateCard ──────────────────────────────────────────────────────────────

function CreateCard() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate('/worlds/create')}
      className={cn(
        'bg-secondary rounded-md border border-dashed p-base min-h-[140px]',
        'flex flex-col items-center justify-center gap-half',
        'text-low hover:text-normal hover:border-brand/30',
        'transition-all duration-200 hover:-translate-y-0.5 cursor-pointer',
      )}
    >
      <CompassIcon className="size-5" />
      <span className="text-sm">创建新世界</span>
      <span className="text-xs text-low">与 Architect 对话设计你的文明</span>
    </button>
  );
}

// ─── Guide ───────────────────────────────────────────────────────────────────

const TIPS = [
  { Icon: GlobeIcon, text: '每个世界是独立的 AI 文明，有自己的居民和经济' },
  { Icon: ChatCircleDotsIcon, text: '通过 GM Chat 用自然语言管理世界' },
  { Icon: LightningIcon, text: '居民是真实的 Claude 实例，会自主思考和行动' },
] as const;

function GuideTips() {
  return (
    <div className="flex items-start gap-base mt-double">
      {TIPS.map(({ Icon, text }) => (
        <div key={text} className="flex items-start gap-half flex-1 min-w-0">
          <Icon className="size-4 shrink-0 text-low" />
          <span className="text-xs text-low">{text}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function WorldsListPage() {
  const { worlds, isLoading, error, activateWorld, deleteWorld, updateWorld } = useWorlds();
  const { switchWorld } = useActiveWorld();

  const handleActivate = async (name: string) => {
    await activateWorld(name);
    switchWorld(name);
  };

  const content = isLoading
    ? <div className="text-sm text-low">加载中...</div>
    : error
      ? <ErrorPanel />
      : <WorldGrid worlds={worlds} onActivate={handleActivate} onDelete={deleteWorld} onRename={(n, v) => updateWorld(n, { name: v })} />;

  return (
    <div className="h-full overflow-y-auto p-double">
      <div className="mb-double">
        <h1 className="text-xl font-medium text-high">数字乌托邦</h1>
        <p className="text-sm text-low mt-0.5">选择一个世界开始探索，或创建你自己的文明</p>
      </div>
      {content}
    </div>
  );
}

function ErrorPanel() {
  return (
    <div className="bg-secondary rounded-md border p-base">
      <p className="text-sm text-low">引擎未运行。启动引擎后刷新页面查看世界列表。</p>
      <code className="block mt-half text-xs text-low font-ibm-plex-mono bg-primary rounded p-half">
        cd engine && npx tsx src/start.ts genesis
      </code>
    </div>
  );
}

function WorldGrid({ worlds, onActivate, onDelete, onRename }: {
  worlds: WorldInfo[];
  onActivate: (name: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
  onRename: (name: string, newName: string) => Promise<void>;
}) {
  return (
    <>
      {worlds.length === 0 && (
        <div className="flex flex-col items-center justify-center py-double text-center">
          <GlobeIcon className="size-10 text-low mb-base" weight="thin" />
          <h2 className="text-lg font-medium text-high mb-1">还没有世界</h2>
          <p className="text-sm text-low max-w-sm">创建你的第一个数字文明。每个世界是一个独立的 AI 社会，居民们会自主交流、交易、协作。</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-base mt-base">
        {worlds.map((w) => (
          <WorldCard key={w.name} world={w} onActivate={onActivate} onDelete={onDelete} onRename={onRename} />
        ))}
        <CreateCard />
      </div>
      <GuideTips />
    </>
  );
}
