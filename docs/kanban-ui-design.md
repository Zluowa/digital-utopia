# Resident Kanban UI/UX Design

> Design spec for the Digital Utopia resident classification kanban.
> Based on vibe-kanban design language + DU's existing style system.

---

## 1. Design Principles

- **Reuse vibe-kanban primitives** — KanbanBoard, KanbanCard, KanbanFilterBar patterns
- **DU styling tokens** — `bg-primary`, `bg-secondary`, `text-high/normal/low`, `brand` orange accent
- **IBM Plex Sans / Mono** — consistent with existing DU typography
- **Stateless views** — container/view split per DU CLAUDE.md convention
- **Minimal new components** — extend AgentCard, adapt KanbanCardContent

---

## 2. Overall Layout

```
+-------------------------------------------------------------------+
| Navbar (existing)                                                  |
+-------------------------------------------------------------------+
| World: Genesis                                          [Awaken All]|
| 12 residents · 5 alive · 3 sleeping                                |
+-------------------------------------------------------------------+
| [Board] [List] [Sleeping] [Dead]    | Search... | Filter | + New   |
+-------------------------------------------------------------------+
|                                                                     |
|  KANBAN VIEW (Board tab)                                           |
|  +-----------+-----------+-----------+-----------+                  |
|  | Alive (5) | Sleeping  | Awakening | Dead (2)  |                 |
|  |           |    (3)    |    (1)    |           |                  |
|  | [Card]    | [Card]    | [Card]    | [Card]    |                  |
|  | [Card]    | [Card]    |           | [Card]    |                  |
|  | [Card]    | [Card]    |           |           |                  |
|  | [Card]    |           |           |           |                  |
|  | [Card]    |           |           |           |                  |
|  +-----------+-----------+-----------+-----------+                  |
|                                                                     |
+-------------------------------------------------------------------+
```

**Resizable right panel** (same as vibe-kanban ProjectKanban):
- Clicking a resident card opens detail panel on the right
- Uses `react-resizable-panels` Group/Panel/Separator
- Default split: 75% / 25%, min panel width 400px

---

## 3. View Navigation Tabs

Adapts `ViewNavTabs` pattern. Two modes: Board (kanban) and List (table).

```
  [Board]  [List]  |  [Sleeping]  [Dead]
  ─────────────────  ──────────────────
   View modes          Status filters (list mode only)
```

- **Board** — Kanban columns grouped by `AgentStatus`
- **List** — Table view of all residents, optionally filtered by status
- **Sleeping / Dead** — Quick filters that activate List mode + status filter

Implementation: `ButtonGroup` + `ButtonGroupItem` from vibe-kanban primitives.

---

## 4. Kanban Board View (Board tab)

### 4.1 Columns

Four columns, one per `AgentStatus`, ordered left to right:

| Column       | Status      | Color (HSL)       | Dot style              |
|-------------|-------------|-------------------|------------------------|
| Alive       | `alive`     | `117 38% 50%`     | green, `animate-pulse` |
| Awakening   | `awakening` | `32 95% 44%`      | yellow, `animate-pulse`|
| Sleeping    | `sleeping`  | `217 91% 60%`     | blue, static           |
| Dead        | `dead`      | `0 59% 57%`       | red, static            |

Each column header follows the vibe-kanban `KanbanHeader` pattern:

```
+------------------------------------------+
|  * Alive (5)                        [+]  |
+------------------------------------------+
```

- Left: colored dot + status name + count badge
- Right: "+" button to create new resident in that status

### 4.2 Resident Card

Adapts `KanbanCardContent` layout for DU's `AgentEntry` data:

```
+------------------------------------------+
| res-03       mastermind           [...]   |  <- ID + type badge + more
|                                           |
| Alice the Architect                       |  <- identity (title)
|                                           |
| Building a marketplace for digital art    |  <- currentGoal (description)
|                                           |
| [!] 2,450 T   marketplace   3 inbox      |  <- priority, balance, niche, inbox
|     ├─ role badge                         |
|     └─ assignee slot → avatar placeholder |
+------------------------------------------+
```

**Row 1: ID + Type + Actions**
```tsx
<div className="flex items-center justify-between gap-half">
  <div className="flex items-center gap-half min-w-0">
    <span className="font-ibm-plex-mono text-sm text-low truncate">{id}</span>
    <ResidentTypeBadge type={agent.type} />
  </div>
  <button className="invisible group-hover:visible ...">
    <DotsThreeIcon />
  </button>
</div>
```

**Row 2: Identity (Name)**
```tsx
<span className="text-base text-normal truncate">
  {agent.identity || agent.id}
</span>
```

**Row 3: Current Goal (truncated)**
```tsx
{agent.currentGoal && (
  <p className="text-sm text-low m-0 line-clamp-2">
    {agent.currentGoal}
  </p>
)}
```

**Row 4: Metadata bar**
```tsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-half flex-wrap">
    <span className="font-ibm-plex-mono text-sm text-normal">
      {agent.tokenBalance.toLocaleString()} T
    </span>
    {agent.economicNiche && (
      <KanbanBadge name={agent.economicNiche} color="hsl(var(--brand))" />
    )}
  </div>
  {agent.inboxCount > 0 && (
    <span className="text-xs text-brand">{agent.inboxCount}</span>
  )}
</div>
```

### 4.3 Card Interactions

- **Click** — opens detail panel (right sidebar)
- **Hover** — shows "..." more actions button
- **Drag** — NOT enabled for status changes (status is engine-managed)
- **Context menu (...)** — Awaken / Stop / Send Message / View Terminal

### 4.4 Empty Column State

```tsx
<div className="flex items-center justify-center h-32 text-low text-sm">
  No {statusName} residents
</div>
```

---

## 5. List View (List tab)

Adapts `IssueListView` + `IssueListSection` + `IssueListRow` patterns.

### 5.1 Section Headers (collapsible)

```
+----------------------------------------------------------+
| v  * Alive (5)                                       [5] |
+----------------------------------------------------------+
```

Uses `IssueListSection` pattern with caret toggle, StatusDot, name, count badge.

### 5.2 Row Layout

```
+----------------------------------------------------------+
| :: | * | res-03 | Alice the Architect | market.. | 2.4K T | 3h |
+----------------------------------------------------------+
  ^    ^    ^         ^                    ^           ^       ^
  drag status ID     name               niche       balance  age
```

Columns:
| Column    | Width    | Content                              |
|-----------|----------|--------------------------------------|
| Drag      | 16px     | `DotsSixVerticalIcon` (grip)         |
| Status    | 8px      | Colored dot                          |
| ID        | auto     | `font-ibm-plex-mono text-sm`         |
| Name      | flex-1   | `text-base text-high truncate`       |
| Type      | auto     | `ResidentTypeBadge`                  |
| Niche     | auto     | `KanbanBadge` (if present)           |
| Balance   | 80px     | `font-ibm-plex-mono text-sm`         |
| Age       | 40px     | Relative time since `lastAwakened`   |

### 5.3 Row Interactions

- **Click** — opens detail panel
- **Hover** — `bg-secondary` highlight
- **Selected** — `bg-secondary` persistent

---

## 6. Filter Bar

Adapts `KanbanFilterBar` pattern:

```
[Team] [Personal]  |  [Search...]  [Filter]  [Clear]  [+ New Resident]
```

**For DU, the filter dimensions are:**

### 6.1 View Selector (ButtonGroup)
- "All" (default) / "Mine" (if user identity concept exists)

### 6.2 Search
- `InputField` with search icon
- Searches across: `id`, `identity`, `economicNiche`, `currentGoal`
- Clear button (X icon) when active

### 6.3 Filter Dialog (adapts KanbanFiltersDialog)
- **Status** — multi-select: alive, sleeping, awakening, dead
- **Type** — multi-select: mastermind, world-keeper, zone-keeper, resident, observer
- **Sort** — dropdown: Manual, Balance (desc), Name (asc), Last Awakened (recent first)
- **Balance range** — min/max input (optional, future)

### 6.4 Create Button
- `PrimaryButton variant="secondary"` with PlusIcon
- Opens create-resident form in right panel

---

## 7. Resident Type Badge

New small component `ResidentTypeBadge`:

```tsx
const TYPE_COLORS: Record<AgentType, string> = {
  mastermind:   'hsl(271 81% 46%)',   // purple (merged color)
  'world-keeper': 'hsl(217 91% 60%)', // blue (info)
  'zone-keeper':  'hsl(32 95% 44%)',  // orange (warning)
  resident:     'hsl(117 38% 50%)',   // green (success)
  observer:     'hsl(0 0% 56%)',      // gray (text-low)
};
```

Renders as a small pill:
```tsx
<span className="text-xs px-1.5 py-0.5 rounded-sm"
  style={{ backgroundColor: `${color}20`, color }}>
  {type}
</span>
```

---

## 8. Detail Panel (Right Sidebar)

Opens when clicking a resident card. Adapts `KanbanIssuePanel` layout:

```
+----------------------------------+
| < Back      Alice the Architect  |
+----------------------------------+
| Status: * Alive                  |
| Type:   mastermind               |
| Balance: 2,450 T                 |
| Niche:   marketplace             |
| Last Awakened: 3h ago            |
| Goal:                            |
|   Building a marketplace for     |
|   digital art and collectibles   |
+----------------------------------+
| Actions                          |
|   [Awaken]  [Stop]  [Message]    |
+----------------------------------+
| Terminal Output                  |
|   > Scanning marketplace...      |
|   > Found 3 listings             |
|   > ...                          |
+----------------------------------+
```

Uses existing `IssuePropertyRow` pattern for each property line.

---

## 9. Color / Status Mapping

### Status Colors (reuse DU CSS variables)
| Status    | CSS Variable       | HSL              | Usage          |
|-----------|--------------------|------------------|----------------|
| alive     | `--success`        | `117 38% 50%`    | Green dot+badge|
| awakening | `--warning`        | `32 95% 44%`     | Yellow dot     |
| sleeping  | `--info`           | `217 91% 60%`    | Blue dot       |
| dead      | `--error`          | `0 59% 57%`      | Red dot        |

### Type Colors (new, harmonize with existing palette)
| Type         | Color                | Reasoning            |
|--------------|----------------------|----------------------|
| mastermind   | `--merged` purple    | Highest authority    |
| world-keeper | `--info` blue        | System-level         |
| zone-keeper  | `--warning` orange   | Mid-level authority  |
| resident     | `--success` green    | Standard citizen     |
| observer     | `text-low` gray      | Passive role         |

---

## 10. Responsive Layout

### Desktop (>= 1024px)
- Full kanban with 4 columns
- Right panel opens as resizable split

### Tablet (768px - 1023px)
- Kanban columns scroll horizontally (overflow-x-auto)
- Right panel overlays as drawer

### Mobile (< 768px)
- Default to List view
- Board view available but single-column scroll
- Detail panel becomes full-screen overlay

---

## 11. Component Hierarchy

```
ResidentKanbanPage (page)
  ResidentKanbanContainer (container - state management)
    ResidentViewNavTabs (view)
    ResidentFilterBar (view)
    ResidentKanbanBoard (view, Board mode)
      ResidentColumn (view, per status)
        ResidentCard (view)
          ResidentTypeBadge (primitive)
    ResidentListView (view, List mode)
      ResidentListSection (view, per status)
        ResidentListRow (view)
    ResidentDetailPanel (view, right sidebar)
```

### File Structure

```
frontend-new/src/
  pages/ui-new/
    ResidentKanban.tsx              <- Page (route entry)
  components/ui-new/
    containers/
      ResidentKanbanContainer.tsx   <- State + data wiring
    views/
      ResidentKanbanBoard.tsx       <- Board layout (columns)
      ResidentColumn.tsx            <- Single status column
      ResidentCard.tsx              <- Card content
      ResidentListView.tsx          <- List layout
      ResidentListSection.tsx       <- Collapsible status section
      ResidentListRow.tsx           <- Table row
      ResidentDetailPanel.tsx       <- Right sidebar detail
      ResidentFilterBar.tsx         <- Search + filters
      ResidentViewNavTabs.tsx       <- Board/List toggle
    primitives/
      ResidentTypeBadge.tsx         <- Type pill badge
      StatusIndicator.tsx           <- Animated status dot
```

---

## 12. Data Flow

```
useWorldData() hook (WebSocket to engine:4000)
  ↓
WorldSnapshot.agents: AgentEntry[]
  ↓
ResidentKanbanContainer
  ├── groups by status → columns (Board)
  ├── filters/search/sort state (Zustand or local)
  ├── selectedAgentId → detail panel
  └── passes filtered data to views
```

No new API needed — reuses existing `useWorldData()` hook.
Sorting and filtering happen client-side on the `agents[]` array.

---

## 13. Key Differences from vibe-kanban

| Aspect            | vibe-kanban              | DU Resident Kanban        |
|-------------------|--------------------------|---------------------------|
| Entity            | Issue (task)             | Agent (resident)          |
| Columns           | Custom statuses          | Fixed 4 statuses          |
| Drag-drop         | Cross-column move        | Disabled (engine-managed) |
| Card content      | ID, title, desc, tags    | ID, name, goal, balance   |
| Data source       | Electric SQL sync        | WebSocket snapshot        |
| Right panel       | Issue detail + workspaces| Agent detail + terminal   |
| Create action     | Insert issue             | Bootstrap agent           |
| Assignees         | Organization members     | N/A (agents are autonomous)|
