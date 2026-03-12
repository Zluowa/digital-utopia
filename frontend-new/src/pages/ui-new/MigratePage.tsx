import { useCallback, useEffect, useRef } from 'react';
import { usePostHog } from 'posthog-js/react';
import { MigrateLayout } from '@/components/ui-new/containers/MigrateLayout';

const REMOTE_ONBOARDING_EVENTS = {
  STAGE_VIEWED: 'remote_onboarding_ui_stage_viewed',
} as const;

export function MigratePage() {
  const posthog = usePostHog();
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
    if (hasTrackedStageViewRef.current) {
      return;
    }

    trackRemoteOnboardingEvent(REMOTE_ONBOARDING_EVENTS.STAGE_VIEWED, {
      stage: 'migrate',
    });
    hasTrackedStageViewRef.current = true;
  }, [trackRemoteOnboardingEvent]);

  return (
    <div className="h-full overflow-auto bg-primary">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-base py-double">
        <div className="rounded-sm border border-border bg-secondary p-double space-y-double">
          <header className="space-y-double text-center">
            <h1 className="text-2xl font-bold text-high tracking-wider">
              乌托邦世界
            </h1>
            <p className="text-sm text-low">
              Migrate your local projects to cloud projects.
            </p>
          </header>
          <MigrateLayout />
        </div>
      </div>
    </div>
  );
}
