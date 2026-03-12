// @input: status string (agent, issue, run, approval, goal)
// @output: Tailwind class strings for badge, icon, dot rendering
// @position: Canonical color source; all status-colored components import from here

/**
 * Badge background+text classes for semantic status values.
 * Uses Tailwind color utilities compatible with our .new-design scope.
 */
export const statusBadgeClasses: Record<string, string> = {
  // Agent statuses
  active:   'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  running:  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
  paused:   'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  idle:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
  archived: 'bg-secondary text-low',

  // Goal / project statuses
  planned:   'bg-secondary text-low',
  achieved:  'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',

  // Run statuses
  pending:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
  succeeded:  'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  failed:     'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  timed_out:  'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  error:      'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  terminated: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',

  // Approval statuses
  pending_approval:   'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  revision_requested: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  approved:  'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  rejected:  'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',

  // Resident / citizen statuses
  backlog:     'bg-secondary text-low',
  todo:        'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
  in_review:   'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
  done:        'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  cancelled:   'bg-secondary text-low',
  blocked:     'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
};

export const statusBadgeDefault = 'bg-secondary text-low';

/**
 * Animated dot indicator classes for agent status (small circle).
 */
export const agentStatusDotClasses: Record<string, string> = {
  running:          'bg-cyan-400 animate-pulse',
  active:           'bg-green-400',
  paused:           'bg-yellow-400',
  idle:             'bg-yellow-400',
  pending_approval: 'bg-amber-400',
  error:            'bg-red-400',
  archived:         'bg-neutral-400',
};

export const agentStatusDotDefault = 'bg-neutral-400';

/**
 * Icon border+text classes for issue status circle icons.
 */
export const issueStatusIconClasses: Record<string, string> = {
  backlog:     'text-low border-low',
  todo:        'text-blue-600 border-blue-600 dark:text-blue-400 dark:border-blue-400',
  in_progress: 'text-yellow-600 border-yellow-600 dark:text-yellow-400 dark:border-yellow-400',
  in_review:   'text-violet-600 border-violet-600 dark:text-violet-400 dark:border-violet-400',
  done:        'text-green-600 border-green-600 dark:text-green-400 dark:border-green-400',
  cancelled:   'text-neutral-500 border-neutral-500',
  blocked:     'text-red-600 border-red-600 dark:text-red-400 dark:border-red-400',
};

export const issueStatusIconDefault = 'text-low border-low';

/**
 * Priority text color classes.
 */
export const priorityTextClasses: Record<string, string> = {
  critical: 'text-red-600 dark:text-red-400',
  high:     'text-orange-600 dark:text-orange-400',
  medium:   'text-yellow-600 dark:text-yellow-400',
  low:      'text-blue-600 dark:text-blue-400',
};

export const priorityTextDefault = 'text-yellow-600 dark:text-yellow-400';
