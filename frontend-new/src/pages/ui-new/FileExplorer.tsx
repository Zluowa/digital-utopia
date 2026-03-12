// @input: useWorldData (agent list) + useFileTree (file browsing)
// @output: Agent file browser with hierarchical tree + diff/raw viewer
// @position: Page at /world/files

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWorldData } from '@/hooks/useWorldData';
import { useFileTree, type FileEntry } from '@/hooks/useFileTree';
import { FileTree } from '@/components/ui-new/views/FileTree';
import type { TreeNode } from '@/components/ui-new/types/fileTree';
import {
  filterFileTree,
  getAllFolderPaths,
  getExpandedPathsForSearch,
} from '@/utils/fileTreeUtils';
import { DiffViewCard } from '@/components/ui-new/primitives/conversation/PierreConversationDiff';
import { ChatMarkdown } from '@/components/ui-new/primitives/conversation/ChatMarkdown';

type AgentSummary = { id: string; identity?: string; status: string };

type ViewerMode = 'diff' | 'raw' | 'preview';

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdx']);
const HTML_EXTENSIONS = new Set(['html', 'htm', 'svg']);

function getFileExtension(path: string): string {
  const name = path.split('/').pop() ?? path;
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(dotIndex + 1).toLowerCase() : '';
}

function isLikelyBinary(content: string): boolean {
  return content.includes('\u0000');
}

function childPath(basePath: string, name: string): string {
  return basePath === '.' ? name : `${basePath}/${name}`;
}

function sortEntries(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function sameEntries(a: FileEntry[] | undefined, b: FileEntry[]): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].name !== b[i].name || a[i].type !== b[i].type) return false;
  }
  return true;
}

function buildNodesFromCache(
  cache: Record<string, FileEntry[]>,
  basePath = '.'
): TreeNode[] {
  const entries = cache[basePath] ?? [];
  return entries.map((entry) => {
    const fullPath = childPath(basePath, entry.name);
    if (entry.type === 'dir') {
      return {
        id: fullPath,
        name: entry.name,
        path: fullPath,
        type: 'folder',
        children: buildNodesFromCache(cache, fullPath),
      } satisfies TreeNode;
    }
    return {
      id: fullPath,
      name: entry.name,
      path: fullPath,
      type: 'file',
    } satisfies TreeNode;
  });
}

function AgentList({
  agents,
  selected,
  onSelect,
}: {
  agents: AgentSummary[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-half">
      {agents.map((agent) => (
        <button
          key={agent.id}
          onClick={() => onSelect(agent.id)}
          className={`w-full text-left px-base py-half rounded text-sm transition-colors ${
            selected === agent.id
              ? 'bg-brand/15 text-brand'
              : 'text-low hover:text-normal hover:bg-secondary'
          }`}
        >
          {agent.identity || agent.id}
        </button>
      ))}
    </div>
  );
}

function FileViewer({
  file,
  workspaceId,
  mode,
  onModeChange,
}: {
  file: { path: string; content: string };
  workspaceId: string | null;
  mode: ViewerMode;
  onModeChange: (mode: ViewerMode) => void;
}) {
  const ext = getFileExtension(file.path);
  const isMarkdown = MARKDOWN_EXTENSIONS.has(ext);
  const isHtml = HTML_EXTENSIONS.has(ext);

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="shrink-0 px-base py-half border-b bg-secondary flex items-center gap-base">
        <div className="text-xs text-low font-ibm-plex-mono truncate flex-1 min-w-0">
          {file.path}
        </div>
        <div className="inline-flex rounded-sm border border-border overflow-hidden shrink-0">
          <button
            className={`text-xs px-base py-half ${
              mode === 'diff' ? 'bg-panel text-normal' : 'text-low hover:text-normal'
            }`}
            onClick={() => onModeChange('diff')}
            type="button"
          >
            Diff
          </button>
          <button
            className={`text-xs px-base py-half border-l border-border ${
              mode === 'raw' ? 'bg-panel text-normal' : 'text-low hover:text-normal'
            }`}
            onClick={() => onModeChange('raw')}
            type="button"
          >
            Raw
          </button>
          <button
            className={`text-xs px-base py-half border-l border-border ${
              mode === 'preview'
                ? 'bg-panel text-normal'
                : 'text-low hover:text-normal'
            }`}
            onClick={() => onModeChange('preview')}
            type="button"
          >
            Preview
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-base">
        {mode === 'diff' ? (
          <DiffViewCard
            input={{
              type: 'content',
              oldContent: '',
              newContent: file.content,
              newPath: file.path,
            }}
            expanded
            className="border-border"
          />
        ) : mode === 'raw' ? (
          <pre className="text-sm text-normal font-ibm-plex-mono whitespace-pre-wrap">
            {file.content}
          </pre>
        ) : isLikelyBinary(file.content) ? (
          <div className="text-sm text-low">
            Binary preview is not available in this panel. Open in your IDE for full preview.
          </div>
        ) : isMarkdown ? (
          <div className="text-normal">
            <ChatMarkdown
              content={file.content}
              workspaceId={workspaceId ?? undefined}
              maxWidth="100%"
            />
          </div>
        ) : isHtml ? (
          <iframe
            title={`preview-${file.path}`}
            srcDoc={file.content}
            className="w-full h-full min-h-[320px] rounded border border-border bg-white"
            sandbox="allow-same-origin allow-scripts"
          />
        ) : (
          <div className="text-sm text-low">
            No rich preview for this file type yet. Switch to Raw or Diff.
          </div>
        )}
      </div>
    </div>
  );
}

export function FileExplorer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { snapshot, isLoading: worldLoading, error: worldError } = useWorldData();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [viewerMode, setViewerMode] = useState<ViewerMode>('raw');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [directoryCache, setDirectoryCache] = useState<Record<string, FileEntry[]>>({});
  const tree = useFileTree(selectedAgent);
  const requestedAgent = searchParams.get('agent');
  const agents = useMemo(() => snapshot?.agents ?? [], [snapshot?.agents]);
  const validAgentIds = useMemo(() => new Set(agents.map((a) => a.id)), [agents]);
  const { browse, readFile } = tree;

  const updateAgentSearchParam = useCallback(
    (id: string) => {
      const nextParams = new URLSearchParams(searchParams);
      if (nextParams.get('agent') === id) return;
      nextParams.set('agent', id);
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleSelectAgent = useCallback(
    (id: string) => {
      if (selectedAgent === id) return;
      setSelectedAgent(id);
      updateAgentSearchParam(id);
    },
    [selectedAgent, updateAgentSearchParam]
  );

  useEffect(() => {
    if (agents.length === 0) {
      if (selectedAgent !== null) setSelectedAgent(null);
      return;
    }

    if (requestedAgent && validAgentIds.has(requestedAgent)) {
      if (selectedAgent !== requestedAgent) setSelectedAgent(requestedAgent);
      return;
    }

    if (selectedAgent && validAgentIds.has(selectedAgent)) return;

    const fallback = agents[0]?.id;
    if (!fallback) return;
    setSelectedAgent(fallback);
    updateAgentSearchParam(fallback);
  }, [
    agents,
    requestedAgent,
    selectedAgent,
    updateAgentSearchParam,
    validAgentIds,
  ]);

  useEffect(() => {
    if (!selectedAgent) {
      setDirectoryCache({});
      setCollapsedPaths(new Set());
      setSearchQuery('');
      setSelectedPath(null);
      return;
    }
    setDirectoryCache({});
    setCollapsedPaths(new Set());
    setSearchQuery('');
    setSelectedPath(null);
    void browse('.');
  }, [selectedAgent, browse]);

  useEffect(() => {
    if (!selectedAgent) return;
    const normalized = sortEntries(tree.entries);
    setDirectoryCache((previous) => {
      const existing = previous[tree.currentPath];
      if (sameEntries(existing, normalized)) return previous;
      return { ...previous, [tree.currentPath]: normalized };
    });
  }, [selectedAgent, tree.currentPath, tree.entries]);

  const fullTree = useMemo(
    () => buildNodesFromCache(directoryCache),
    [directoryCache]
  );

  const effectiveCollapsedPaths = useMemo(() => {
    const next = new Set(collapsedPaths);

    const markUnloadedFolders = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        if (node.type !== 'folder') return;
        if (!Object.prototype.hasOwnProperty.call(directoryCache, node.path)) {
          next.add(node.path);
        }
        if (node.children) markUnloadedFolders(node.children);
      });
    };

    markUnloadedFolders(fullTree);
    return next;
  }, [collapsedPaths, directoryCache, fullTree]);

  const filteredTree = useMemo(
    () => filterFileTree(fullTree, searchQuery),
    [fullTree, searchQuery]
  );
  const allFolderPaths = useMemo(() => getAllFolderPaths(fullTree), [fullTree]);
  const isAllExpanded = effectiveCollapsedPaths.size === 0;

  useEffect(() => {
    if (!searchQuery) return;
    const pathsToExpand = getExpandedPathsForSearch(fullTree, searchQuery);
    setCollapsedPaths((previous) => {
      const next = new Set(previous);
      pathsToExpand.forEach((path) => next.delete(path));
      return next;
    });
  }, [fullTree, searchQuery]);

  const handleToggleExpand = useCallback(
    (path: string) => {
      const hasLoadedChildren = Object.prototype.hasOwnProperty.call(
        directoryCache,
        path
      );

      if (!hasLoadedChildren) {
        setCollapsedPaths((previous) => {
          if (!previous.has(path)) return previous;
          const next = new Set(previous);
          next.delete(path);
          return next;
        });
        void browse(path);
        return;
      }

      setCollapsedPaths((previous) => {
        const next = new Set(previous);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
    },
    [browse, directoryCache]
  );

  const handleSelectFile = useCallback(
    (path: string) => {
      setSelectedPath(path);
      if (tree.file?.path === path) return;
      void readFile(path);
    },
    [readFile, tree.file?.path]
  );

  const handleToggleExpandAll = useCallback(() => {
    if (isAllExpanded) {
      setCollapsedPaths(new Set(allFolderPaths));
      return;
    }
    setCollapsedPaths(new Set());
  }, [allFolderPaths, isAllExpanded]);

  if (worldLoading) {
    return (
      <div className="flex items-center justify-center h-full text-low">
        Connecting to world engine...
      </div>
    );
  }

  if (worldError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div className="text-error">Engine offline</div>
        <div className="text-sm text-low">{worldError}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="w-52 border-r overflow-y-auto p-half shrink-0">
        <div className="px-base py-half text-sm font-medium text-high mb-half">
          Agents
        </div>
        <AgentList
          agents={agents}
          selected={selectedAgent}
          onSelect={handleSelectAgent}
        />
      </div>

      <div className="w-80 border-r shrink-0 min-h-0 flex">
        {selectedAgent ? (
          tree.isLoading && fullTree.length === 0 ? (
            <div className="flex items-center justify-center h-full w-full text-sm text-low">
              Loading files...
            </div>
          ) : (
            <FileTree
              nodes={filteredTree}
              collapsedPaths={effectiveCollapsedPaths}
              onToggleExpand={handleToggleExpand}
              selectedPath={selectedPath}
              onSelectFile={handleSelectFile}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              isAllExpanded={isAllExpanded}
              onToggleExpandAll={handleToggleExpandAll}
              className="h-full"
            />
          )
        ) : (
          <div className="flex items-center justify-center h-full w-full text-sm text-low">
            Select an agent
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 min-h-0 bg-primary">
        {tree.file ? (
          <FileViewer
            file={tree.file}
            workspaceId={selectedAgent}
            mode={viewerMode}
            onModeChange={setViewerMode}
          />
        ) : tree.isLoading ? (
          <div className="flex items-center justify-center h-full text-low text-sm">
            Loading...
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-low text-sm">
            {selectedAgent ? 'Select a file to view' : 'Select an agent, then browse files'}
          </div>
        )}
        {tree.error && (
          <div className="px-base py-half text-xs text-error border-t border-error/30">
            {tree.error}
          </div>
        )}
      </div>
    </div>
  );
}
