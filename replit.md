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
- **Unified team user page** (`/users`): merges former ユーザー管理 / スタッフ管理 / 招待URL管理 into one screen with two tabs (`?tab=invitations` deep-link). Columns: ユーザー / メール / 役割 (inline select) / 最終ログイン (relative + native title tooltip) / 状態 / 操作. `User.lastLoginAt` is fire-and-forget updated by `POST /api/auth/login`. Header actions: 「既存ユーザーを追加」 (POST `/api/teams/:id/members`) and 「招待URL発行」 (existing invitation flow inline).
- **退団 (soft-leave)**: 削除の代わりに `POST /api/users/:id/leave-team { teamId, leftAt }` が `UserTeam.isActive=false` + `UserTeam.leftAt` を設定し、同チームの `Player.deletedAt=leftAt`、必要なら `Team.headCoachId` をクリア（全て `$transaction`）。`authenticate` ミドルウェアと `/api/auth/login` は `teams: { where: { isActive: true } }` でフィルタするため、退団者はそのチームの `hasTeamAccess` を失う一方で、過去の評価・動画・タスクなどのデータは保持される。`POST /api/users/:id/restore-team` で復帰（`isActive=true`、`leftAt=null`、`Player.deletedAt=null`）。退団操作は TEAM_MANAGER または operator のみ、自分自身は退団不可。

#### Team & Membership
- **Team management**: profiles, rosters, league/region tags, sub-team hierarchy, and per-team invitation links.
- **Team status (PENDING/ACTIVE)**: manual creates default to ACTIVE; CSV imports start PENDING. SUPER_ADMIN issues a per-team invite link (`/invite/team/:token`); the team representative completes registration as TEAM_MANAGER and atomically activates the team. Player creation is blocked while a team's effective status (own or parent's) is PENDING.
- **Same-team detection**: when adding teams (manual or CSV), `server/services/teamNameMatcher.js` matches names sharing a base but differing only in category tokens (U-XX, ジュニア/ジュニアユース/ユース/シニア/レディース, トップ/セカンド, 1st/2nd/3rd) and surfaces them as merge suggestions so the new entry can be registered as a sub-team. Manual flow uses `GET /api/teams/suggestions?name=`; CSV flow is 2-phase: `POST /api/admin/teams/import-csv/analyze` → `POST /api/admin/teams/import-csv` with `mergeDecisions` keyed by row number.
- **Duplicate consolidation**: admin team list "重複候補を統合" modal uses `GET /api/admin/teams/duplicate-groups` and `POST /api/admin/teams/merge-as-children` to demote sibling top-level teams under a chosen parent (transactional, 409 on TOCTOU).
- **Invitations**: role-specific invite URLs for players/parents/staff. TEAM_MANAGER invitations are restricted to TEAM_MANAGER/operator (a COACH cannot escalate). Staff invites can also be issued from the team manager's `ユーザー管理` page.
- **Self-service join requests**: registration page lets users search teams and request to join as 選手 or スタッフ. Request now carries an optional `phone` stored only on `TeamJoinRequest` (User unchanged). PLAYER requests can be approved by TEAM_MANAGER/COACH/operator; STAFF requests require TEAM_MANAGER/operator. **When the target team has zero active TEAM_MANAGER**, only operators can approve (server-enforced 403) — the request appears in the normal `/join-requests` screen with an 「管理者なし」 badge plus a dedicated operator-wide `/admin/join-requests` page (with 管理者不在のみ filter). GET responses enrich each row with `hasTeamManager`. Approval is concurrency-safe (`updateMany` + 409 on TOCTOU; idempotent re-check for existing Player).
- **Team registration requests** (public, no auth): `POST /api/team-registration-requests` accepts `{ requesterName, requesterEmail, requesterPhone, password, desiredTeamName, league?, region?, description?, message? }`. Password is bcrypt-hashed and stored on `TeamRegistrationRequest`. Server normalizes team names with NFKC + lowercase + strip whitespace + strip common punctuation; on collision returns 409 `{ error, existingTeam }` so the client can switch to a join-request. Public POST is protected by an in-memory throttle (per-IP/hour and per IP+email+team-name/hour) returning 429 on abuse. Approval (operator only) **re-checks the normalized name inside the `$transaction`** and 409s if a duplicate appeared since submission; on success it atomically creates User + Team(ACTIVE) + UserTeam(TEAM_MANAGER) and stamps `createdUserId/createdTeamId`. If the requester's email matches an existing User, approval returns 409 `EXISTING_USER_CONFIRMATION_REQUIRED` and the admin UI prompts a second confirm; the second call with `{ confirmReuseExistingUser: true }` reuses the existing account. GET enriches each pending row with `existingUser` so a ⚠ badge surfaces the reuse candidate before approval. Sysadmins (SUPER_ADMIN/ADMIN/OPERATOR) are notified with full contact info via `TEAM_REGISTRATION_REQUEST` (always-on; not in `typeToSettingMap`) linking to `/admin/team-registration-requests`. Approved requesters get a confirmation notification.
- **Registration page split**: `/register` now shows an entry with two cards — 「ユーザー登録（既存チームに参加）」 and 「チーム新規登録」. The user flow adds an optional phone field that flows to the join-request payload. The team flow on 409 surfaces "既にあります、申請してください" and auto-switches into the user-join flow with the matched team pre-selected.

#### Players
- **Profiles**: personal info, JFA Passport photo, role model / play style fields, coach notes.
- **在籍期間 (joinedAt / graduationDate)**: editable from both the player profile and the team `/users` page (在籍期間 column with 編集 modal posting `PUT /api/players/:id { joinedAt, graduationDate }`). `GET /api/users?teamId=` returns these fields on each user's `players[]`. `GET /api/evaluations/history/:playerId` filters returned `rounds` to those whose month overlaps `[joinedAt, graduationDate]` (inclusive at the month level) and only auto-creates the current month round when today falls inside that window — so the 評価期間 selector is automatically scoped to a player's tenure.
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
- **Templates**: VEDIALO CF template can be bulk-applied via `node scripts/apply-vedialo-to-all.js` (refuses to wipe teams with existing `Evaluation` rows unless `--force`). The VEDIALO CF template is **GK-only** (`targetPositions=['GK']` on each top category, inherited by all children). Existing teams can be retro-tagged with `node scripts/mark-vedialo-as-gk.js` which sets `targetPositions=['GK']` on any top category whose `originalItemId` traces back to the VEDIALO template (only when currently empty — does not overwrite explicit tags).
- **Position targeting on items**: `EvaluationItem.targetPositions` (string[]) restricts who an item applies to (`GK / DF / MF / FW`). Inheritance: a leaf is "allowed" for a position iff itself and all ancestors are allowed (`isPositionAllowed`). The `/evaluation-items` modal exposes quick presets 「全選手共通」「フィールド (DF/MF/FW)」「GK専用」 above the per-position toggles so staff can register field-only or GK-only item trees without manual checkbox combos.
- **Ranking 共通項目 (総合)**: `GET /api/evaluations/ranking?teamId=` 総合 view uses items that are allowed for **every** position in `['GK','DF','MF','FW']` (i.e., applies to all) — a position-independent definition, no longer dependent on the cohort's actual `Player.position` mix. This is the "GKとフィールドで被っている項目" the spec calls for. GK-only and field-only items contribute to per-position views (`filterItemsForPosition('GK')`, etc.) but not to 総合.
- **Evaluation Matrix**: heatmap of player scores over time.

#### Ranking
- `GET /api/evaluations/ranking?teamId=` returns **総合** (all players, scored only on **共通項目** so everyone shares the same denominator) and **GK** (GK-only, `filterItemsForPosition('GK')`) views. `isPositionAllowed` inherits parent→child `targetPositions`. `buildPlayerEntry(player, itemSet)` powers both views via the same code path.
- Frontend `/ranking` has 総合/GK tabs. Sort dropdown is grouped by 大項目 via `<optgroup>`; `sortBy` accepts `'total' | 'top:<topId>' | '<midId>'` and `getSortRate(item, sortBy)` drives both the row bar and the sort. Auto-falls back to `'total'` when the selected key disappears. Endpoint requires `hasTeamAccess || isOperator` (any role).

#### Communication
- **Calendar**: monthly view with color-coded events, role-based access, category-based targeting, per-event custom colors (8 presets + native picker, `#RRGGBB` validated server-side), and recurring schedules (daily/weekly/monthly until a chosen end date, capped at 366 occurrences). Recurring events share a `seriesId`; edit/delete prompts "this only" vs "シリーズ全体" (`?scope=series`). Each event has `location` (place name) + optional `locationAddress`; when address is set, both the detail modal and list item render a Google Maps deep link (`https://www.google.com/maps/search/?api=1&query=…`, `noopener noreferrer`). Month grid shows up to 5 events/day on desktop (1 on mobile) with "+N件" overflow.
- **Saved locations**: per-team `EventLocation { id, teamId, name, address?, createdBy }` (unique on `[teamId, name]`). CRUD via `/api/event-locations` (GET = team membership; POST/PUT/DELETE = TEAM_MANAGER/COACH/operator; POST is idempotent — duplicate name returns the existing row, optionally updating address). Registration is a dedicated step on the Calendar page: a 「場所を管理」 button (header, managers/coaches/operator only) opens a modal for add/edit/delete. The event create/edit modal only shows the 「登録済みの場所から選択」 dropdown (auto-fills name+address) — no inline create/delete there. **Auto-history**: `POST /api/calendar` and `PUT /api/calendar/:id` call a best-effort `rememberEventLocation(teamId, name, address, userId)` after the event is persisted; it upserts `EventLocation` (idempotent on `[teamId, name]`, updates address if changed, swallows `P2002` races). Personal events (no teamId) are skipped. The frontend refetches `savedLocations` after a save when `form.location` was set, so the new entry appears in the dropdown immediately on the next event.
- **Announcements**: priority levels, draft/publish, expiration, category targeting.
- **Notifications**: in-app bell, email, and Web Push (VAPID). Endpoints: `GET /api/push/vapid-public-key`, `POST /api/push/{subscribe,unsubscribe,test}`. Subscribe endpoint enforces an allowlist of known push services (FCM, Mozilla autopush, Apple, WNS) to prevent SSRF; stale 404/410 subscriptions are auto-pruned. Users opt in via `通知設定`.

#### Tasks
- **Schema**: `Task` supports both player and staff assignees — `playerId? / assigneeUserId? / teamId?` with DB-level XOR check `task_assignee_xor`. Optional `targetType` (EVALUATION/VIDEO/MEETING/GOAL/MENTORING/OTHER, server allowlisted) + `targetUrl` (server-validated leading `/`) deep-link from a task to its source.
- **Permissions**: player-tasks use `canEvaluatePlayer` (operator/TEAM_MANAGER/head-coach/assigned coach). Staff-tasks require `teamId`; the requester must hold TEAM_MANAGER/COACH in that team and the assignee a staff role in the same team. Edit/delete authority derives from `task.player.teamId || task.teamId` (no cross-team leakage). Status changes are also allowed for the assignee.
- **Endpoints**: `GET /api/tasks?teamId` (player + team-scoped staff tasks), `GET /api/tasks/my-tasks` (own/child players + `assigneeUserId=me`).
- **Self-memo path**: when `assigneeUserId === req.user.id`, the create branch skips the staff-role check and skips notifications; rendered with a "メモ" badge.
- **Completion notify**: when an assignee transitions a task to COMPLETED, a notification fires to `task.assignedBy` (skipped for self-memos).
- **Bulk by category**: `POST /api/tasks/bulk-by-category { teamCategoryId, title, ... }` fans out into one Task per active player (deletedAt null + not graduated) in the chosen category, in a single `$transaction`. Permission: TEAM_MANAGER/COACH of the category's team or operator. Each player's linked user receives a TASK notification including the category name; per-player completion is independent.
- **Recurring tasks**: optional `recurrence: { freq: 'weekly'|'monthly', until: ISO }` on `POST /api/tasks` and `POST /api/tasks/bulk-by-category`. `validateRecurrence()` rejects missing/invalid `until` or `until < dueDate` with 400. Server expands into one Task per occurrence sharing a `Task.seriesId` (capped at 24 occurrences; bulk endpoint additionally caps player×occurrence at 1000). The bulk endpoint assigns a **distinct seriesId per player** so series-scoped edits/deletes never cross assignees. dueDate steps weekly (+7d) or monthly (+1 month from JS `setMonth`). Notifications fire once per assignee summarizing the series count. `PUT /api/tasks/:id?scope=series` updates meta (title/description/targetType/targetUrl) on all open siblings of that series; status/dueDate stay single-occurrence. `DELETE /api/tasks/:id?scope=series` deletes all siblings of that series. Per-occurrence completion remains independent.
- **Dashboard widget** (`TaskListWidget`): always reads `/api/tasks/my-tasks`. Open tasks sorted by dueDate with overdue/urgent coloring, type badge, click-to-navigate `targetUrl`, inline complete checkbox; series tasks render a 🔁 「繰り返し」 badge. "+作成" modal picks assignee kind (自分用メモ／スタッフ／選手／カテゴリー — order kept identical between the picker buttons; カテゴリー uses the bulk endpoint above) and offers a 繰り返し section (なし／毎週／毎月 + 終了日, gated on dueDate being set).

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
