import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SyncErrorProvider } from '@/contexts/SyncErrorContext';
import { ActiveWorldProvider, useActiveWorld } from '@/contexts/ActiveWorldContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { BreadcrumbProvider } from '@/contexts/BreadcrumbContext';
import { AgentPanelProvider } from '@/contexts/AgentPanelContext';

import { NavbarContainer } from './NavbarContainer';
import { AppBar } from '../primitives/AppBar';
import { DUBreadcrumbBar } from '../primitives/DUBreadcrumbBar';
import { DUCommandPalette } from '../primitives/DUCommandPalette';
import { DUMobileBottomNav } from '../primitives/DUMobileBottomNav';
import { ToastViewport } from '../primitives/ToastViewport';
import { AgentPropertiesPanel } from '../views/AgentPropertiesPanel';
import { useUserOrganizations } from '@/hooks/useUserOrganizations';
import { useOrganizationProjects } from '@/hooks/useOrganizationProjects';
import { useOrganizationStore } from '@/stores/useOrganizationStore';
import { useAuth } from '@/hooks/auth/useAuth';
import {
  CreateOrganizationDialog,
  type CreateOrganizationResult,
  CreateRemoteProjectDialog,
  type CreateRemoteProjectResult,
} from '@/components/dialogs';
// Note: CommandBarDialog kept for vibe-kanban routes; DUCommandPalette handles world routes

export function SharedAppLayout() {
  return (
    <ActiveWorldProvider>
      <ToastProvider>
        <BreadcrumbProvider>
          <AgentPanelProvider>
            <SharedAppLayoutInner />
          </AgentPanelProvider>
        </BreadcrumbProvider>
      </ToastProvider>
    </ActiveWorldProvider>
  );
}

function SharedAppLayoutInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSignedIn } = useAuth();
  const { worldName } = useActiveWorld();

  // DUCommandPalette handles its own CMD+K shortcut registration

  // AppBar state - organizations and projects
  const { data: orgsData } = useUserOrganizations();
  const organizations = useMemo(
    () => orgsData?.organizations ?? [],
    [orgsData?.organizations]
  );

  const selectedOrgId = useOrganizationStore((s) => s.selectedOrgId);
  const setSelectedOrgId = useOrganizationStore((s) => s.setSelectedOrgId);
  const prevOrgIdRef = useRef<string | null>(null);

  // Auto-select first org if none selected or selection is invalid
  useEffect(() => {
    if (organizations.length === 0) return;

    const hasValidSelection = selectedOrgId
      ? organizations.some((org) => org.id === selectedOrgId)
      : false;

    if (!selectedOrgId || !hasValidSelection) {
      const firstNonPersonal = organizations.find((org) => !org.is_personal);
      setSelectedOrgId((firstNonPersonal ?? organizations[0]).id);
    }
  }, [organizations, selectedOrgId, setSelectedOrgId]);

  const { data: orgProjects = [], isLoading } = useOrganizationProjects(
    selectedOrgId || null
  );

  // Navigate to latest project when org changes
  useEffect(() => {
    if (location.pathname.startsWith('/migrate')) {
      prevOrgIdRef.current = selectedOrgId;
      return;
    }

    if (
      prevOrgIdRef.current !== null &&
      prevOrgIdRef.current !== selectedOrgId &&
      selectedOrgId &&
      !isLoading
    ) {
      if (orgProjects.length > 0) {
        const sortedProjects = [...orgProjects].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        navigate(`/projects/${sortedProjects[0].id}`);
      } else {
        navigate('/workspaces');
      }
      prevOrgIdRef.current = selectedOrgId;
    } else if (prevOrgIdRef.current === null && selectedOrgId) {
      prevOrgIdRef.current = selectedOrgId;
    }
  }, [selectedOrgId, orgProjects, isLoading, navigate, location.pathname]);

  // Navigation state for AppBar active indicators
  const isWorkspacesActive = location.pathname.startsWith('/workspaces');
  const isWorldActive = location.pathname === '/world'
    || location.pathname === '/world/dashboard';
  const isChatActive = location.pathname === '/world/chat';
  const isKanbanActive = location.pathname.startsWith('/world/residents');
  const isOrgActive = location.pathname.endsWith('/org');
  const isApprovalsActive = location.pathname.endsWith('/approvals');
  const isActivityActive = location.pathname.endsWith('/activity');
  const isFilesActive = location.pathname.startsWith('/world/files');
  const isInboxActive = location.pathname.startsWith('/world/inbox');
  const isHomeActive = location.pathname === '/worlds';
  const activeProjectId = location.pathname.startsWith('/projects/')
    ? location.pathname.split('/')[2]
    : null;

  const handleHomeClick = useCallback(() => { navigate('/worlds'); }, [navigate]);
  const handleWorkspacesClick = useCallback(() => { navigate('/workspaces'); }, [navigate]);
  const handleWorldClick = useCallback(() => { navigate('/world'); }, [navigate]);
  const handleChatClick = useCallback(() => { navigate('/world/chat'); }, [navigate]);
  const handleKanbanClick = useCallback(() => { navigate('/world/residents'); }, [navigate]);
  const handleOrgClick = useCallback(() => { navigate('/world/org'); }, [navigate]);
  const handleApprovalsClick = useCallback(() => { navigate('/world/approvals'); }, [navigate]);
  const handleActivityClick = useCallback(() => { navigate('/world/activity'); }, [navigate]);
  const handleFilesClick = useCallback(() => { navigate('/world/files'); }, [navigate]);
  const handleInboxClick = useCallback(() => { navigate('/world/inbox'); }, [navigate]);
  const handleProjectClick = useCallback((id: string) => { navigate(`/projects/${id}`); }, [navigate]);

  const handleCreateOrg = useCallback(async () => {
    try {
      const result: CreateOrganizationResult =
        await CreateOrganizationDialog.show();
      if (result.action === 'created' && result.organizationId) {
        setSelectedOrgId(result.organizationId);
      }
    } catch { /* cancelled */ }
  }, [setSelectedOrgId]);

  const handleCreateProject = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const result: CreateRemoteProjectResult =
        await CreateRemoteProjectDialog.show({ organizationId: selectedOrgId });
      if (result.action === 'created' && result.project) {
        navigate(`/projects/${result.project.id}`);
      }
    } catch { /* cancelled */ }
  }, [navigate, selectedOrgId]);

  return (
    <SyncErrorProvider>
      {/* DU CMD+K palette — handles its own shortcut */}
      <DUCommandPalette />
      {/* Global toast notifications */}
      <ToastViewport />
      {/* Mobile bottom nav (md:hidden) */}
      <DUMobileBottomNav />

      <div className="flex h-screen bg-primary">
        {/* AppBar + collapsible text sidebar — hidden on mobile */}
        <div className="hidden md:flex h-full">
          <AppBar
            projects={orgProjects}
            organizations={organizations}
            selectedOrgId={selectedOrgId ?? ''}
            onOrgSelect={setSelectedOrgId}
            onCreateOrg={handleCreateOrg}
            onCreateProject={handleCreateProject}
            onHomeClick={handleHomeClick}
            isHomeActive={isHomeActive}
            onWorkspacesClick={handleWorkspacesClick}
            onWorldClick={handleWorldClick}
            onChatClick={handleChatClick}
            onResidentsClick={handleKanbanClick}
            onOrgClick={handleOrgClick}
            onApprovalsClick={handleApprovalsClick}
            onActivityClick={handleActivityClick}
            onFilesClick={handleFilesClick}
            onInboxClick={handleInboxClick}
            onProjectClick={handleProjectClick}
            onProjectsDragEnd={() => {}}
            isWorkspacesActive={isWorkspacesActive}
            isWorldActive={isWorldActive}
            isChatActive={isChatActive}
            isResidentsActive={isKanbanActive}
            isOrgActive={isOrgActive}
            isApprovalsActive={isApprovalsActive}
            isActivityActive={isActivityActive}
            isFilesActive={isFilesActive}
            isInboxActive={isInboxActive}
            activeProjectId={activeProjectId}
            isSignedIn={isSignedIn}
            isLoadingProjects={isLoading}
            worldName={worldName}
          />
        </div>

        <div className="flex flex-col flex-1 min-w-0">
          <NavbarContainer />
          <DUBreadcrumbBar />
          {/* Content + properties panel side-by-side */}
          <div className="flex flex-1 min-h-0">
            {/* Key by worldName → forces remount of all world-specific hooks on switch */}
            <div className="flex-1 min-w-0 overflow-auto" key={worldName || '_'}>
              <Outlet />
            </div>
            <AgentPropertiesPanel />
          </div>
        </div>
      </div>
    </SyncErrorProvider>
  );
}
