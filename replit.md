# Player Development Support System

## Overview
The Player Development Support System is a SaaS platform designed for sports teams to streamline player development, evaluation, and communication. It offers tools for team management, performance tracking, goal setting, and communication, aiming to enhance athletic performance and team cohesion. The system uses `player_id` as a central identifier and focuses on a team-centric approach.

## User Preferences
- No product name should be displayed in the UI.
- All views should be organized around teams.
- Database and API paths should use generic names, while display names should be team/player specific.
- Different menu structures should be displayed based on user roles.
- The UI should feature a clevio-style left-fixed sidebar.

## System Architecture

### Tech Stack
-   **Frontend**: React 19, Vite, Tailwind CSS
-   **Backend**: Express.js (Node.js)
-   **Database**: PostgreSQL with Prisma ORM
-   **Authentication**: JWT-based with cookie storage

### Core Design Principles
The system is built on a team-centric display and robust role-based access control (RBAC). It separates internal IDs from display names for data integrity and user-friendliness. The UI/UX emphasizes intuitive navigation and clear data visualization.

### Key Features
-   **Role-Based Access Control (RBAC)**: A comprehensive 9-role system across 3 categories (Operations, Team, User) with granular permissions and a numeric hierarchy for inheritance.
-   **Team Management**: Includes profile management, player rosters, league/region classification for filtering, and an invitation system for onboarding. CSV bulk import supports league and region columns. Teams have a `status` field (PENDING/ACTIVE): manually created teams default to ACTIVE; CSV-imported teams are created as PENDING. SUPER_ADMIN issues a per-team invitation link from the admin team list (`/invite/team/:token`); the team representative completes account creation on that page (creating a TEAM_MANAGER user) which atomically activates the team. Player creation is blocked while the team's effective status (own status, or parent team status for sub-teams) is PENDING. **Same-team detection**: when adding teams (manually or via CSV), names with shared base but different category tokens (U-XX, ジュニア/ジュニアユース/ユース/シニア/レディース, トップ/セカンド, 1st/2nd/3rd) are matched via `server/services/teamNameMatcher.js` and surfaced as merge suggestions so the user can register the new entry as a sub-team (parentId set) of the existing parent instead of creating a separate top-level team. Manual flow uses `GET /api/teams/suggestions?name=`; CSV flow uses 2-phase `POST /api/admin/teams/import-csv/analyze` followed by `POST /api/admin/teams/import-csv` with a `mergeDecisions` map keyed by row number (`parentId | "new" | "skip"`).
-   **Evaluation System**: Supports 3-level hierarchical evaluation items (大分類→中分類→評価項目), distinct rounds, coach and self-evaluations, historical data preservation, and visualization using Recharts. Evaluation entry page uses a matrix-style table showing the 3-level hierarchy with sticky left columns, past round scores for comparison, and current round input. API: `/api/evaluations/history/:playerId` returns items hierarchy, rounds, and full scoreMap. A template system (VEDIALO CF) is provided for standardized evaluations. The Evaluation Matrix provides a heatmap view of player scores over time.
-   **Player Management**: Detailed player profiles with personal information, JFA Passport photo upload, role model/play style fields, and coach notes. Players support soft-delete via a `deletedAt` field (data is preserved and can be restored). The player list filters by membership status: 在籍中 (default), 卒業済み (graduationDate ≤ today, hidden by default), and 削除済み (hidden by default; only shown to coaches/operators via `?includeDeleted=true`). Endpoints: `DELETE /api/players/:id` (soft delete) and `POST /api/players/:id/restore` (TEAM_MANAGER/COACH/Operator only).
-   **Goal Management**: Customizable goal categories and player-settable, trackable goals.
-   **Communication Tools**:
    -   **Calendar System**: Monthly view for events with color-coding, role-based access, and category-based targeting.
    -   **Announcements System**: Supports priority levels, publish/draft status, expiration dates, and category-based targeting.
-   **Public Appeal URL**: Allows players/coaches to generate public profiles with secure tokens, displaying player info and evaluation data.
-   **Invitation URL System**: Team-based invitation system for players, parents, and staff with role-specific flows.
-   **System Administration**: Dedicated operator dashboard with system-wide statistics, team/user management, team impersonation, system settings (maintenance mode, upload limits, session timeout, registration controls), notification management (broadcast notifications, default notification settings, notification history), and CSV bulk team import with template download, drag-and-drop upload, duplicate detection, and detailed result reporting.
-   **Data Visibility**: Implements comprehensive time-series filtering based on player-team membership periods for evaluations, videos, goals, and player notes, ensuring data access aligns with tenure.
-   **Parent Team Inheritance**: Enables sub-teams to inherit evaluation items and rounds from parent teams.
-   **Player Transfer System**: Manages player transfers while preserving data ownership (evaluations, goals, videos follow the player) and tracking transfer history with snapshots.
-   **Notification System**: Provides in-app web notifications (bell icon), configurable email notifications, and browser push notifications (Web Push API + service worker) for key events like evaluations, tasks, and video comments. Push uses VAPID (env vars `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) and stores per-device subscriptions in `PushSubscription`. Endpoints: `GET /api/push/vapid-public-key`, `POST /api/push/{subscribe,unsubscribe,test}`. Subscribe-side enforces an allowlist of known push services (Google FCM, Mozilla autopush, Apple, Microsoft WNS) to prevent SSRF. Stale subscriptions returning 404/410 are auto-pruned. Users opt in from `通知設定` (NotificationSettings) page.
-   **Account Management**: Allows operators to edit user accounts and users to manage their own email and password.
-   **Mentoring Record System**: Supports monthly 1-on-1 feedback records between players and coaches, including goal setting, staff comments, and scores, with role-based editing.
-   **Task Management System**: Coaches can assign tasks to players with due dates and statuses, and players can update task progress.
-   **Video Sharing & Tag System**: Allows tagging videos with specific players and team categories for targeted sharing, with filtering and visual tag display.
-   **Video Comment System**: Enables users to comment on videos, with notifications for uploaders and players.
-   **Player Dashboard**: A multi-tab dashboard offering a summary, career achievement tracking (XP-style cumulative rate), evaluation analysis (radar charts, gap analysis), and progress tracking (score trends). Accessible by players and parents.
-   **Coach Assignment System**: Manages head coach designations and individual coach-player assignments to control evaluation permissions.

### UI/UX Decisions
-   **Sidebar Navigation**: Dark navy fixed sidebar with dynamic menu based on user role, responsive for desktop and mobile.
-   **Mobile Layout**: Features a top header, a fixed 5-tab bottom navigation bar (`MobileBottomNav`) with role-specific items, and support for iPhone safe-area.
-   **Player Profile**: Rich card-based design with gradient headers, photos, and tabbed navigation.
-   **Data Visualization**: Utilizes Recharts for various charts (progress, radar, gap analysis, heatmaps) with responsive design and intuitive coloring.
-   **Admin Interface**: Dedicated interface for operators with distinct navigation.

### Infrastructure & Non-Functional Features
-   **Database Indexing**: Comprehensive indexing on frequently queried columns for performance optimization.
-   **Security Headers**: Helmet middleware for HTTP security headers with environment-aware CSP.
-   **Backup System**: PostgreSQL backup script with automatic retention.

## External Dependencies
-   **Prisma ORM**: For database interactions with PostgreSQL.
-   **JWT (JSON Web Tokens)**: For authentication.
-   **Recharts**: For data visualization and charting in the UI.
-   **Helmet**: For HTTP security headers.