# Player Development Support System

## Overview
SaaS for sports teams: player development, evaluation, scheduling, video sharing, team communication. Team-centric model keyed by `player_id`, role-based access across operators, team staff, and end users (players/parents).

## User Preferences
- Brand "PDS." (dot in primary color) at top-left of mobile header, current team/player as secondary context. Desktop uses the left sidebar for branding.
- Views are organized around teams.
- Database/API paths are generic; display names are team/player specific.
- Menus are role-driven.
- Clevio-style left-fixed sidebar on desktop; on mobile it slides in from the **left** via a top-left hamburger (with backdrop overlay and in-drawer X close). Mobile header layout: left=hamburger, center=logo, right=notification bell.

## Tech Stack
React 19 + Vite + Tailwind • Express (Node) • PostgreSQL via Prisma • JWT in cookies • Recharts • Helmet.

## Core Principles
Team-centric display, comprehensive RBAC, internal IDs separate from display names, intuitive nav with clear data viz.

---

## Identity & Access
- **RBAC**: 9 roles across 3 categories (Operations / Team / User) with a numeric hierarchy.
- **User code** (`userCode`): operator-supplied (e.g. `COACH-TARO`) or auto `U-NNNNNN`. Resolved via `server/services/userCode.js#resolveUserCode`. Searchable + editable in admin.
- **Team code** (`teamCode`): unique per team, operator-supplied (`FCV-U15`) or auto `T-NNNNNN`. Optional CSV column.
- **Account management**: operators edit accounts; users manage own email/password.
- **Unified `/users` page**: merges ユーザー管理 / スタッフ管理 / 招待URL管理 into one screen with two tabs (`?tab=invitations` deep-link). Columns include 役割 (inline select), 最終ログイン (relative, native tooltip), 状態, 操作. `User.lastLoginAt` is fire-and-forget updated by `/api/auth/login`. Header actions: 既存ユーザーを追加 + 招待URL発行.
- **退団 (soft-leave)**: `POST /api/users/:id/leave-team { teamId, leftAt }` runs a `$transaction` setting `UserTeam.isActive=false` + `leftAt`, `Player.deletedAt=leftAt`, and clearing `Team.headCoachId` if needed. `authenticate` and login filter `teams: { isActive: true }`, so the user loses `hasTeamAccess` while data (evaluations, videos, tasks) is preserved. `POST /api/users/:id/restore-team` reverses it. TEAM_MANAGER or operator only; cannot leave self.

## Teams & Membership
- **Team management**: profiles, rosters, league/region tags, sub-team hierarchy, per-team invite links.
- **Status (PENDING/ACTIVE)**: manual creates default ACTIVE; CSV imports start PENDING. SUPER_ADMIN issues a `/invite/team/:token` link; the representative completes registration as TEAM_MANAGER and atomically activates the team. Player creation is blocked while a team's effective status (own or parent's) is PENDING.
- **Same-team detection**: `server/services/teamNameMatcher.js` matches names sharing a base but differing only in category tokens (U-XX, ジュニア/ジュニアユース/ユース/シニア/レディース, トップ/セカンド, 1st/2nd/3rd) and surfaces them as merge suggestions for sub-team registration. Manual: `GET /api/teams/suggestions?name=`. CSV is 2-phase: `POST /api/admin/teams/import-csv/analyze` → `…/import-csv` with `mergeDecisions` keyed by row.
- **Duplicate consolidation**: admin team list "重複候補を統合" uses `GET /api/admin/teams/duplicate-groups` and `POST /api/admin/teams/merge-as-children` (transactional, 409 on TOCTOU).
- **Invitations**: role-specific URLs. TEAM_MANAGER invites are restricted to TEAM_MANAGER/operator (no escalation by COACH). Staff invites also issuable from the team `/users` page.
- **Self-service join requests**: registration page lets users search teams and request to join as 選手 or スタッフ, with an optional `phone` stored only on `TeamJoinRequest`. PLAYER requests: TEAM_MANAGER/COACH/operator can approve. STAFF requests: TEAM_MANAGER/operator only. **When the team has zero active TEAM_MANAGER**, only operators can approve (server-enforced 403); requests appear in `/join-requests` with an 「管理者なし」 badge and on the operator-wide `/admin/join-requests` (管理者不在のみ filter). GET responses include `hasTeamManager`. Approval is concurrency-safe (`updateMany` + 409 on TOCTOU; idempotent if Player already exists). Reject flow uses an in-app confirm modal (not native `confirm()`).
- **Team registration requests** (public, no auth): `POST /api/team-registration-requests` accepts `{ requesterName, requesterEmail, requesterPhone, password, desiredTeamName, league?, region?, description?, message? }`. Password is bcrypt-hashed on the request. Team names are normalized (NFKC + lowercase + strip whitespace/punct); collisions return 409 `{ error, existingTeam }` so the client can switch to a join-request. Per-IP and per IP+email+name in-memory throttle (429). Approval (operator only) re-checks the normalized name inside a `$transaction`; on success creates User + Team(ACTIVE) + UserTeam(TEAM_MANAGER) atomically. If the email matches an existing User, returns 409 `EXISTING_USER_CONFIRMATION_REQUIRED`; admin UI prompts and re-calls with `{ confirmReuseExistingUser: true }`. GET enriches each pending row with `existingUser` (⚠ badge). Sysadmins notified via `TEAM_REGISTRATION_REQUEST` (always-on, not in `typeToSettingMap`). Approved requester gets a confirmation notification.
- **Registration page split**: `/register` shows two entry cards — 「ユーザー登録（既存チームに参加）」 and 「チーム新規登録」. The team flow on 409 auto-switches into the user-join flow with the matched team pre-selected.

## Players
- **Profiles**: personal info, JFA Passport photo, role-model / play-style fields, coach notes.
- **在籍期間 (`joinedAt` / `graduationDate`)**: editable from the profile and from the team `/users` page (`PUT /api/players/:id`). `GET /api/users?teamId=` returns these on each user's `players[]`. `GET /api/evaluations/history/:playerId` filters returned `rounds` to months overlapping `[joinedAt, graduationDate]` and only auto-creates the current month's round when today falls inside that window.
- **Soft delete + restore**: `deletedAt` field; `DELETE /api/players/:id` and `POST /api/players/:id/restore` (TEAM_MANAGER/COACH/operator). List filters: 在籍中 (default) / 卒業済み (graduationDate ≤ today) / 削除済み (`?includeDeleted=true`).
- **Category assignment**: `/team-categories` "選手の振り分け" modal lists all team players (sub-teams included) with inline category dropdowns; pending diffs commit in batch via `PUT /api/players/:id { teamCategoryId }`.
- **Transfer**: data ownership (evaluations, goals, videos) follows the player; transfer history is snapshot-tracked.

## Evaluations
- **3-level hierarchy** 大項目→中項目→小項目 (`description` = キーファクター on each leaf). Distinct rounds, coach + self-evaluations, history preserved, Recharts viz.
- **Per-team item management** (`/evaluation-items`, `canManage = isOperator || isTeamAdmin || isCoach`): add/edit/toggle/delete own-team items. Items inherited from a parent team show a `親チーム継承` badge (read-only); parent-picker dropdowns exclude inherited items.
- **Position targeting**: `EvaluationItem.targetPositions` (string[]) restricts who an item applies to (`GK / DF / MF / FW`). Inheritance: a leaf is "allowed" for a position iff itself and all ancestors are allowed (`isPositionAllowed`). The item modal exposes quick presets 「全選手共通」「フィールド (DF/MF/FW)」「GK専用」. The page has **view tabs 全て／全選手共通／FP／GK** (top categories classified empty=common, GK-only=gk, field-only=fp, mixed=other); switching pre-fills the new 大項目 modal's `targetPositions` accordingly. The 全選手共通 tab also surfaces a synthesized **「FPとGKで共通している項目」** section: leaves whose full path (`top::sub::leaf`, trimmed) exists in BOTH an FP and a GK top are listed read-only with FP×n / GK×n / 共通 badges.
- **CSV bulk import**: `POST /api/evaluations/items/import-csv?teamId=&mode=append|replace&position=all|gk|fp` (multer + papaparse, columns `category,subCategory,name,description`). **Position-bucket scoped**: the import's `position` maps to a target bucket (`all`→common, `gk`, `fp`).
  - `replace` only deletes items inside the target bucket (other buckets are untouched — e.g. an FP replace never wipes GK items). Refuses if any `Evaluation` rows still reference items in that bucket. Deletion runs in dependency order (leaves → subs → tops) to satisfy FK constraints.
  - `append` only reuses same-named top categories within the same bucket; a same-named top in a different bucket is left alone and a new top is created.
  - Newly-created tops get `targetPositions` from the preset (`all`→`[]`, `gk`→`['GK']`, `fp`→`['DF','MF','FW']`); children inherit via `isPositionAllowed`.
  - Modal UI: 「対象ポジション（一式として登録）」 with 全選手共通／FP一式／GK一式 buttons. Long-running tx uses `{ timeout: 60000, maxWait: 10000 }`. Auth: TEAM_MANAGER/COACH/operator.
- **Entry UI**: matrix table with sticky left columns, past-round comparison, current-round input. 中分類 column uses `writing-mode: vertical-rl`. ℹ icons reveal キーファクター via a React portal popover. Score input is a 1〜5 button row on desktop; mobile taps open a portal vertical picker. Each 大項目 row shows 完了/X/Y 入力.
- **Auto-save**: 700ms debounced POST persists the entire round; in-flight saves are versioned so context switches discard stale responses. Only "この期間の評価を削除" remains a manual button.
- **Selectors**: 評価期間 + 選手 are flanked by ChevronLeft/Right; player arrows step through evaluable players sorted by jersey number (nulls last). Current month round is auto-created lazily by `GET /api/evaluations/history/:playerId`. Last selection persisted in `localStorage` per `userId.evaluatorType`.
- **Templates**: VEDIALO CF can be bulk-applied via `node scripts/apply-vedialo-to-all.js` (refuses to wipe teams with existing `Evaluation` rows unless `--force`). VEDIALO is **GK-only** (`targetPositions=['GK']` on each top, inherited). Existing teams can be retro-tagged via `node scripts/mark-vedialo-as-gk.js` (sets `['GK']` only on tops with empty `targetPositions`).
- **Evaluation Matrix** (`/api/evaluation-matrix/:teamId` and `…/player/:playerId`): heatmap of cumulative scores. Items are filtered per-player by `Player.position` using `isPositionAllowed`, so a GK sees only GK + common categories, an FP only FP + common. Players with no `position` fall back to all items. `maxScore` aggregates use the filtered set so % stays accurate.

## Ranking
- `GET /api/evaluations/ranking?teamId=` returns **総合** and **GK** views via `buildPlayerEntry(player, itemSet)`.
- 総合 uses items allowed for **every** position in `['GK','DF','MF','FW']` — a position-independent definition of "共通項目" so all players share the same denominator. GK-only and field-only items contribute to per-position views (`filterItemsForPosition('GK')`, etc.) but not to 総合.
- Frontend `/ranking` has 総合/GK tabs. Sort dropdown grouped by 大項目 via `<optgroup>`; `sortBy` accepts `'total' | 'top:<topId>' | '<midId>'` and `getSortRate(item, sortBy)` drives both the row bar and the sort. Auto-falls back to `'total'` when the selected key disappears. Endpoint requires `hasTeamAccess || isOperator`.

## Communication
- **Calendar**: monthly view with color-coded events, role-based access, category targeting, per-event custom colors (8 presets + native picker, server-validated `#RRGGBB`), and recurring schedules (daily/weekly/monthly until an end date, capped at 366 occurrences). Recurring events share a `seriesId`; edit/delete prompts "this only" vs "シリーズ全体" (`?scope=series`). Each event has `location` + optional `locationAddress`; when address is set, the detail modal and list item render a Google Maps deep link (`https://www.google.com/maps/search/?api=1&query=…`, `noopener noreferrer`). Month grid shows up to 5 events/day (1 on mobile) with "+N件" overflow.
- **Saved locations**: per-team `EventLocation { id, teamId, name, address?, createdBy }` unique on `[teamId, name]`. CRUD via `/api/event-locations` (GET = team membership; POST/PUT/DELETE = TEAM_MANAGER/COACH/operator; POST is idempotent — duplicate name returns the existing row, optionally updating address). Calendar header has a 「場所を管理」 button (managers/coaches/operator only). The event modal only shows the 「登録済みの場所から選択」 dropdown (auto-fills name+address). **Auto-history**: `POST /api/calendar` and `PUT /api/calendar/:id` call a best-effort `rememberEventLocation` after persistence; idempotent on `[teamId, name]`, updates address if changed, swallows `P2002` races. Personal events (no teamId) are skipped. Frontend refetches `savedLocations` after save so new entries appear immediately.
- **Announcements**: priority levels, draft/publish, expiration, category targeting.
- **Notifications**: in-app bell, email, and Web Push (VAPID). Endpoints: `GET /api/push/vapid-public-key`, `POST /api/push/{subscribe,unsubscribe,test}`. Subscribe enforces an allowlist of known push services (FCM, Mozilla autopush, Apple, WNS) to prevent SSRF; stale 404/410 subscriptions are auto-pruned. Users opt in via `通知設定`.

## Tasks
- **Schema**: `Task` supports both player and staff assignees — `playerId? / assigneeUserId? / teamId?` with DB-level XOR check `task_assignee_xor`. Optional `targetType` (EVALUATION/VIDEO/MEETING/GOAL/MENTORING/OTHER, allowlisted) + `targetUrl` (must start with `/`) deep-link from a task to its source.
- **Permissions**: player-tasks use `canEvaluatePlayer` (operator/TEAM_MANAGER/head-coach/assigned coach). Staff-tasks require `teamId`; the requester must hold TEAM_MANAGER/COACH in that team and the assignee a staff role in the same team. Edit/delete authority derives from `task.player.teamId || task.teamId` (no cross-team leakage). Status changes are also allowed for the assignee.
- **Endpoints**: `GET /api/tasks?teamId` (player + team-scoped staff tasks), `GET /api/tasks/my-tasks` (own/child players + `assigneeUserId=me`).
- **Self-memo**: when `assigneeUserId === req.user.id`, create skips the staff-role check and skips notifications; rendered with a "メモ" badge.
- **Completion notify**: assignee → COMPLETED fires a notification to `assignedBy` (skipped for self-memos).
- **Bulk by category**: `POST /api/tasks/bulk-by-category { teamCategoryId, title, ... }` fans out one Task per active player (deletedAt null + not graduated) in the category in a single `$transaction`. Permission: TEAM_MANAGER/COACH of the category's team or operator.
- **Recurring**: optional `recurrence: { freq: 'weekly'|'monthly', until: ISO }` on `POST /api/tasks` and `…/bulk-by-category`. `validateRecurrence()` rejects missing/invalid `until` or `until < dueDate` with 400. Server expands into one Task per occurrence sharing `Task.seriesId` (capped at 24 occurrences; bulk capped at 1000 player×occurrences). The bulk endpoint assigns a **distinct seriesId per player** so series ops never cross assignees. dueDate steps +7d weekly or +1 month monthly. Notifications fire once per assignee summarizing series count. `PUT /api/tasks/:id?scope=series` updates meta (title/description/targetType/targetUrl) on open siblings; status/dueDate stay per-occurrence. `DELETE …?scope=series` deletes all siblings.
- **Dashboard widget** (`TaskListWidget`): reads `/api/tasks/my-tasks`. Open tasks sorted by dueDate with overdue/urgent coloring, type badge, click-to-navigate `targetUrl`, inline complete checkbox; series tasks render a 🔁 「繰り返し」 badge. "+作成" modal picks assignee (自分用メモ／スタッフ／選手／カテゴリー) and offers a 繰り返し section (なし／毎週／毎月 + 終了日, gated on dueDate).

## Videos
- **Sharing & tagging**: tag videos with players and team categories for targeted sharing, with filtering and visual tags.
- **Comments**: notifications fire to uploader and tagged players.
- **Thumbnails**: client extracts ~1s frame as 480px JPEG via `<video>` + `<canvas>` and uploads via `POST /api/videos/:id/thumbnail` (multer **memoryStorage**, 2MB, image/jpeg|png|webp, auth-before-disk-write — uploader / TEAM_MANAGER|COACH / operator). Persisted as `Video.thumbnailKey`, served by `GET /api/videos/:id/thumbnail` (cookie auth + same visibility checks as `/stream`). Grid uses `<img object-cover>` + Play overlay; missing thumbnails fall back to a Play icon. Lazy backfill: on first play of a thumbnail-less video, the client re-extracts and uploads. Same endpoint serves R2 and local uploads.

## Public-Facing
- **Public Appeal URL**: players/coaches generate token-secured public profiles showing player info + evaluation data.

## Coaching & Mentoring
- Head coach designations and individual coach-player assignments gate evaluation permissions.
- Mentoring records: monthly 1-on-1 feedback (goals, staff comments, scores) with role-based editing.

## Player Experience
- **Player Dashboard**: tabs — summary, career achievement (XP-style cumulative), evaluation analysis (radar, gap), progress trends. For players and parents.
- **Goal management**: customizable goal categories; players set and track their own goals.

## Operations
- **System administration**: operator dashboard with system stats, team/user management, team impersonation, system settings (maintenance mode, upload limits, session timeout, registration controls), notification management (broadcasts, defaults, history), CSV bulk team import (template, drag-and-drop, duplicate detection, detailed result reporting).
- **Data visibility**: time-series filtering by player-team membership periods governs evaluations, videos, goals, notes.
- **Parent team inheritance**: sub-teams inherit evaluation items and rounds from parent teams.

## UI/UX
- **Sidebar**: dark navy fixed sidebar with dynamic menu by role; responsive desktop + mobile.
- **Mobile**: top header + fixed 5-tab `MobileBottomNav` with role-specific items + iPhone safe-area.
- **Player profile**: card-based, gradient headers, photos, tabbed nav.
- **Data viz**: Recharts for progress, radar, gap analysis, heatmaps.
- **Confirm modals**: destructive actions use in-app modals (not native `confirm()`) for reliable iframe behavior.
- **Admin interface**: dedicated operator navigation.

## Infrastructure
- Indexes on frequently queried columns.
- Helmet security headers with environment-aware CSP.
- PostgreSQL backup script with retention.
