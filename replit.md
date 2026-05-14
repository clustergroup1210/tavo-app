# Player Development Support System

## Overview
SaaS platform for sports teams covering player development, evaluation, scheduling, video sharing, and team communication. Team-centric data model keyed by `player_id`, with role-based access control across operators, team staff, and end users (players/parents).

## User Preferences
- Brand "PDS." (dot in primary color) appears top-left of the mobile header, followed by the current team/player as secondary context. Desktop uses the left sidebar for branding.
- All views are organized around teams.
- Database/API paths use generic names; display names are team/player specific.
- Menus are role-driven.
- Clevio-style left-fixed sidebar; on mobile it slides in from the **left** via a hamburger button at the top-left of the header.

## System Architecture

### Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS
- **Backend**: Express.js (Node.js)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: JWT in cookies

### Core Design Principles
Team-centric display, comprehensive RBAC, separation of internal IDs from display names, intuitive navigation with clear data visualization.

### Key Features

#### Identity & Access
- **RBAC**: 9 roles across 3 categories (Operations / Team / User) with a numeric hierarchy.
- **User code**: each user has a human-readable `userCode` (operator-supplied like `COACH-TARO` or auto-generated `U-NNNNNN`). Resolved via `server/services/userCode.js#resolveUserCode`. Searchable in the admin user list and editable in user create/edit modals.
- **Team code**: each team has a unique `teamCode` (operator-supplied like `FCV-U15` or auto `T-NNNNNN`); editable on the admin team list and supported as an optional CSV column.
- **Account management**: operators can edit user accounts; users manage their own email/password.

#### Team & Membership
- **Team management**: profiles, rosters, league/region tags, sub-team hierarchy, and per-team invitation links.
- **Team status (PENDING/ACTIVE)**: manual creates default to ACTIVE; CSV imports start PENDING. SUPER_ADMIN issues a per-team invite link (`/invite/team/:token`); the team representative completes registration as TEAM_MANAGER and atomically activates the team. Player creation is blocked while a team's effective status (own or parent's) is PENDING.
- **Same-team detection**: when adding teams (manual or CSV), `server/services/teamNameMatcher.js` matches names sharing a base but differing only in category tokens (U-XX, ジュニア/ジュニアユース/ユース/シニア/レディース, トップ/セカンド, 1st/2nd/3rd) and surfaces them as merge suggestions so the new entry can be registered as a sub-team. Manual flow uses `GET /api/teams/suggestions?name=`; CSV flow is 2-phase: `POST /api/admin/teams/import-csv/analyze` → `POST /api/admin/teams/import-csv` with `mergeDecisions` keyed by row number.
- **Duplicate consolidation**: admin team list "重複候補を統合" modal uses `GET /api/admin/teams/duplicate-groups` and `POST /api/admin/teams/merge-as-children` to demote sibling top-level teams under a chosen parent (transactional, 409 on TOCTOU).
- **Invitations**: role-specific invite URLs for players/parents/staff. TEAM_MANAGER invitations are restricted to TEAM_MANAGER/operator (a COACH cannot escalate). Staff invites can also be issued from the team manager's `ユーザー管理` page.
- **Self-service join requests**: registration page lets users search teams and request to join as 選手 or スタッフ. PLAYER requests can be approved by TEAM_MANAGER/COACH/operator; STAFF requests require TEAM_MANAGER/operator. Approval is concurrency-safe (`updateMany` + 409 on TOCTOU; idempotent re-check for existing Player).

#### Players
- **Profiles**: personal info, JFA Passport photo, role model / play style fields, coach notes.
- **Soft delete + restore**: `deletedAt` field with `DELETE /api/players/:id` and `POST /api/players/:id/restore` (TEAM_MANAGER/COACH/operator). List filters by membership status: 在籍中 (default) / 卒業済み (graduationDate ≤ today, hidden by default) / 削除済み (`?includeDeleted=true`).
- **Category assignment**: `/team-categories` "選手の振り分け" modal lists all team players (sub-teams included) with inline category dropdowns. Pending diffs commit in batch via `PUT /api/players/:id { teamCategoryId }`. Filter chips, name/番号 search, and bulk-apply buttons let staff re-categorize an entire group quickly.
- **Player transfer**: data ownership (evaluations, goals, videos) follows the player; transfer history is snapshot-tracked.

#### Evaluations
- **3-level hierarchy** (大項目→中項目→小項目, `description` = キーファクター on each leaf), distinct rounds, coach + self-evaluations, history preserved, Recharts visualization.
- **Per-team item management** (`/evaluation-items`, `canManage = isOperator || isTeamAdmin || isCoach`): add/edit/toggle/delete own-team items. Items inherited from a parent team show a `親チーム継承` badge (read-only); the parent-picker dropdowns exclude inherited items so sub-teams can't extend the parent's tree.
- **CSV bulk import** of items via `POST /api/evaluations/items/import-csv?teamId=&mode=append|replace` (multer + papaparse, columns `category,subCategory,name,description`). `replace` refuses if any `Evaluation` rows still reference existing items. Long-running transactions use `{ timeout: 60000, maxWait: 10000 }`. Auth: TEAM_MANAGER/COACH/operator.
- **Entry UI**: matrix-style table with sticky left columns, past round comparison, current round input. 中分類 column uses `writing-mode: vertical-rl`. ℹ icons reveal キーファクター via React portal popover. Score input is a 1〜5 button row on desktop; on mobile a tap opens a portal-rendered vertical picker. Each 大項目 row shows 完了/X/Y 入力.
- **Auto-save**: 700ms debounced POST persists the entire round; in-flight saves are versioned so context switches discard stale responses. Status: 入力すると自動保存されます / 保存中… / 保存しました / 保存に失敗しました. Only "この期間の評価を削除" remains as a manual button.
- **Selectors**: 評価期間 + 選手 are flanked by ChevronLeft/Right; player arrows step through evaluable players sorted by jersey number (nulls last). Current month round is auto-created lazily by `GET /api/evaluations/history/:playerId`. Last selected playerId/roundId persisted in `localStorage` per `userId.evaluatorType`.
- **Templates**: VEDIALO CF template can be bulk-applied via `node scripts/apply-vedialo-to-all.js` (refuses to wipe teams with existing `Evaluation` rows unless `--force`).
- **Evaluation Matrix**: heatmap of player scores over time.

#### Ranking
- `GET /api/evaluations/ranking?teamId=` returns **総合** (all players, scored only on **共通項目** so everyone shares the same denominator) and **GK** (GK-only, `filterItemsForPosition('GK')`) views. `isPositionAllowed` inherits parent→child `targetPositions`. `buildPlayerEntry(player, itemSet)` powers both views via the same code path.
- Frontend `/ranking` has 総合/GK tabs. Sort dropdown is grouped by 大項目 via `<optgroup>`; `sortBy` accepts `'total' | 'top:<topId>' | '<midId>'` and `getSortRate(item, sortBy)` drives both the row bar and the sort. Auto-falls back to `'total'` when the selected key disappears. Endpoint requires `hasTeamAccess || isOperator` (any role).

#### Communication
- **Calendar**: monthly view with color-coded events, role-based access, category-based targeting, per-event custom colors (8 presets + native picker, `#RRGGBB` validated server-side), and recurring schedules (daily/weekly/monthly until a chosen end date, capped at 366 occurrences). Recurring events share a `seriesId`; edit/delete prompts "this only" vs "シリーズ全体" (`?scope=series`). Each event has `location` (place name) + optional `locationAddress`; when address is set, both the detail modal and list item render a Google Maps deep link (`https://www.google.com/maps/search/?api=1&query=…`, `noopener noreferrer`). Month grid shows up to 5 events/day on desktop (1 on mobile) with "+N件" overflow.
- **Saved locations**: per-team `EventLocation { id, teamId, name, address?, createdBy }` (unique on `[teamId, name]`). CRUD via `/api/event-locations` (GET = team membership; POST/PUT/DELETE = TEAM_MANAGER/COACH/operator; POST is idempotent — duplicate name returns the existing row, optionally updating address). Registration is a dedicated step on the Calendar page: a 「場所を管理」 button (header, managers/coaches/operator only) opens a modal for add/edit/delete. The event create/edit modal only shows the 「登録済みの場所から選択」 dropdown (auto-fills name+address) — no inline create/delete there.
- **Announcements**: priority levels, draft/publish, expiration, category targeting.
- **Notifications**: in-app bell, email, and Web Push (VAPID). Endpoints: `GET /api/push/vapid-public-key`, `POST /api/push/{subscribe,unsubscribe,test}`. Subscribe endpoint enforces an allowlist of known push services (FCM, Mozilla autopush, Apple, WNS) to prevent SSRF; stale 404/410 subscriptions are auto-pruned. Users opt in via `通知設定`.

#### Tasks
- **Schema**: `Task` supports both player and staff assignees — `playerId? / assigneeUserId? / teamId?` with DB-level XOR check `task_assignee_xor`. Optional `targetType` (EVALUATION/VIDEO/MEETING/GOAL/MENTORING/OTHER, server allowlisted) + `targetUrl` (server-validated leading `/`) deep-link from a task to its source.
- **Permissions**: player-tasks use `canEvaluatePlayer` (operator/TEAM_MANAGER/head-coach/assigned coach). Staff-tasks require `teamId`; the requester must hold TEAM_MANAGER/COACH in that team and the assignee a staff role in the same team. Edit/delete authority derives from `task.player.teamId || task.teamId` (no cross-team leakage). Status changes are also allowed for the assignee.
- **Endpoints**: `GET /api/tasks?teamId` (player + team-scoped staff tasks), `GET /api/tasks/my-tasks` (own/child players + `assigneeUserId=me`).
- **Self-memo path**: when `assigneeUserId === req.user.id`, the create branch skips the staff-role check and skips notifications; rendered with a "メモ" badge.
- **Completion notify**: when an assignee transitions a task to COMPLETED, a notification fires to `task.assignedBy` (skipped for self-memos).
- **Dashboard widget** (`TaskListWidget`): always reads `/api/tasks/my-tasks`. Open tasks sorted by dueDate with overdue/urgent coloring, type badge, click-to-navigate `targetUrl`, inline complete checkbox; "+作成" modal picks assignee kind (自分用メモ／選手／スタッフ).

#### Videos
- **Sharing & tagging**: tag videos with players and team categories for targeted sharing, with filtering and visual tags.
- **Video comments**: notifications fire to uploader and tagged players.
- **Thumbnails**: client extracts ~1s frame as 480px JPEG via `<video>` + `<canvas>` and uploads via `POST /api/videos/:id/thumbnail` (multer **memoryStorage**, 2MB, image/jpeg|png|webp, auth-before-disk-write — uploader / TEAM_MANAGER|COACH / operator). Persisted as `Video.thumbnailKey` and served by `GET /api/videos/:id/thumbnail` (cookie auth + visibility checks identical to `/stream`). Grid uses `<img object-cover>` + Play overlay; missing thumbnails fall back to a Play icon. Lazy backfill: on first play of a thumbnail-less video, the client re-extracts a frame from the playback URL and uploads it. Same endpoint serves R2 and local upload paths.

#### Public-Facing
- **Public Appeal URL**: players/coaches generate token-secured public profiles showing player info + evaluation data.

#### Coaching & Mentoring
- **Coach assignments**: head coach designations and individual coach-player assignments gate evaluation permissions.
- **Mentoring records**: monthly 1-on-1 feedback (goals, staff comments, scores) with role-based editing.

#### Player Experience
- **Player Dashboard**: multi-tab — summary, career achievement (XP-style cumulative), evaluation analysis (radar, gap), progress trends. For players and parents.
- **Goal management**: customizable goal categories; players set and track their own goals.

#### Operations
- **System Administration**: operator dashboard with system-wide statistics, team/user management, team impersonation, system settings (maintenance mode, upload limits, session timeout, registration controls), notification management (broadcasts, defaults, history), and CSV bulk team import (template download, drag-and-drop, duplicate detection, detailed result reporting).
- **Data visibility**: time-series filtering by player-team membership periods governs evaluations, videos, goals, and notes.
- **Parent team inheritance**: sub-teams inherit evaluation items and rounds from parent teams.

### UI/UX Decisions
- **Sidebar**: dark navy fixed sidebar with dynamic menu by role; responsive desktop + mobile.
- **Mobile**: top header + fixed 5-tab `MobileBottomNav` with role-specific items + iPhone safe-area support.
- **Player profile**: card-based with gradient headers, photos, tabbed navigation.
- **Data viz**: Recharts for progress, radar, gap analysis, heatmaps; responsive with intuitive coloring.
- **Admin interface**: dedicated operator navigation.

### Infrastructure & Non-Functional
- **Indexing** on frequently queried columns.
- **Security headers** via Helmet with environment-aware CSP.
- **Backup**: PostgreSQL backup script with retention.

## External Dependencies
- **Prisma ORM** — PostgreSQL access.
- **JWT** — authentication.
- **Recharts** — charts.
- **Helmet** — security headers.
