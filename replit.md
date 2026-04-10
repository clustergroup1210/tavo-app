# Player Development Support System

## Overview
A SaaS-type player development support system for sports teams, designed with a team-centric approach and using `player_id` as the central identifier. The system aims to streamline player development, evaluation, and communication within sports organizations. It provides tools for team management, performance evaluation, goal setting, and communication, aspiring to be a comprehensive platform for enhancing athletic performance and team cohesion.

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
-   **Typography**: Noto Sans JP + Inter (Google Fonts), Clevio-style clean design

### Core Design Principles
The system emphasizes a team-centric display and robust role-based access control. Internal IDs are separated from display names to maintain data integrity while providing user-friendly interfaces. The UI/UX prioritizes clear, intuitive navigation and data visualization, particularly for player progress and evaluations.

### Key Features
-   **Role-Based Access Control (RBAC)**: Comprehensive 9-role system across 3 categories with granular permissions:
    -   **Operations (Global Scope)**:
        -   `SUPER_ADMIN`: Full system access including settings and audit logs
        -   `ADMIN`: Team and user management capabilities
        -   `OPERATOR`: Most operations allowed, but no dangerous operations (hard delete)
        -   `EXTERNAL`: Read-only access to designated areas, limited evaluation
    -   **Team (Team Scope)**:
        -   `TEAM_MANAGER`: Full team authority (create players, invite staff, evaluate)
        -   `COACH`: Evaluate assigned players, manage tasks/videos
        -   `GUEST_COACH`: Evaluate only explicitly assigned players
    -   **User (Self Scope)**:
        -   `PLAYER`: View/edit own data only
        -   `PARENT`: View child's data only (no edit)
    -   **Permission System**: 40+ granular permissions defined in `server/middleware/permissions.js`
    -   **Role Hierarchy**: Numeric levels for permission inheritance (SUPER_ADMIN: 100 → PARENT: 15)
-   **Team Management**: Profile management, player roster, invitation system for onboarding staff and players.
-   **Evaluation System**: Hierarchical evaluation items, distinct evaluation rounds, coach and self-evaluations with historical data preservation, and comprehensive visualization using Recharts (progress charts, heatmaps).
-   **Evaluation Template System**: VEDIALO CF serves as a template club with 41 standard evaluation items (6 categories: 個人技術, 戦術理解, フィジカル, メンタル, 守備, GK技術). Teams can import templates via `/api/evaluation-templates/apply`, toggle items active/inactive via `/api/evaluation-templates/items/:id/toggle`. UI at `/evaluations/items`. `originalItemId` field tracks template origin.
-   **Evaluation Matrix** (`/evaluations/matrix`): Player-by-time heatmap table showing all players' evaluation scores across rounds/months. Horizontal scrollable table with sticky left columns (number, name, category). Heatmap coloring based on achievement rate. API: `/api/evaluation-matrix/:teamId`. Parent teams automatically include players from all child teams.
-   **Player Management**: Detailed player profiles with personal information, JFA Passport photo upload, role model/play style fields, and coach notes.
-   **Goal Management**: Customizable goal categories for teams, player-settable goals, and goal tracking.
-   **Communication Tools**:
    -   **Calendar System**: Monthly view for practices, matches, meetings, and events, with color-coding, role-based access, and category-based targeting. Supports team-scoped and organization-scoped events. Events can target specific team categories (e.g., U-12, U-15), and players only see events matching their category.
    -   **Announcements System**: Priority levels, publish/draft status, expiration dates, and category-based targeting for team-scoped and organization-scoped announcements. Announcements can target specific team categories, and players only see announcements matching their category.
    -   **Category-Based Targeting**: Both calendar events and announcements support category targeting. Events/announcements without category targets are visible to all team members. Category-targeted content is filtered so players only see content for their assigned category, while coaches/operators see all content. Validation ensures categories belong to the same team, preventing cross-team data leakage.
-   **Public Appeal URL**: Player/coach-generated public profiles for showcasing skills, with secure random tokens (crypto.randomBytes), expiration dates, issuer type display (player/club), and comprehensive player info including evaluation categories with coach/self scores. Features include:
    -   Self-PR text (editable by player)
    -   Coach recommendation text (editable by team coaches/admins)
    -   Display configuration (controls visibility of personal info fields)
    -   Appeal management page for players (/appeal-management)
    -   Coach-facing appeal editing in PlayerDetail
    -   Expired appeals return 410 status
    -   Authorization: Players can view/manage their own appeals; coaches can view/manage team player appeals
-   **Invitation URL System**: Team-based invitation system for players, parents, and staff with role-specific flows. Parent invitations require player selection and auto-create PlayerParent relationships upon registration. Security validation ensures players belong to the target team.
-   **System Administration**: Dedicated operator dashboard with system-wide statistics, team management, user management, and team impersonation capabilities.
-   **Data Visibility**: Comprehensive time-series filtering based on player-team membership periods (bidirectional isolation):
    -   Player themselves: Full access to all historical data
    -   Parent accounts: Full access to child's historical data
    -   Operators: Full access to all data
    -   Current team coaches: Can only see data from when the player joined their team (joinedAt to now)
    -   Former team coaches: Can only see data from their tenure period (joinedAt to leftAt)
    -   Applied to: Evaluations, Videos, Goals, Player Notes
    -   Service: `dataVisibilityService.js` provides centralized filtering logic
-   **Parent Team Inheritance**: Evaluation items and rounds can be inherited from parent teams for sub-teams.
-   **Player Transfer System**: 
    -   Data ownership: All evaluations, goals, videos are tied to player ID (not team), following the player across transfers
    -   Transfer API (`/api/transfers`) with transactional safety
    -   Snapshot preservation: Full player state (scores, achievement rate, profile data) captured as JSON at transfer time
    -   Authorization: Requires operator privileges OR admin access to both source and destination teams
    -   Transfer history tracking with snapshot access for former teams
-   **Notification System**: 
    -   Web notifications via header bell icon with unread count badge
    -   Notification triggers: Coach evaluation, Self-evaluation, Task assignment, Video comments
    -   Per-user notification settings (enable/disable each type)
    -   Email notification option (mock implementation, console output)
    -   Notification settings page at /notification-settings
-   **Account Management**:
    -   Admin user editing: Operators can edit any user's name, email, and password from the user management page
    -   Self-service account settings: Players and parents can edit their own email and password at /account-settings
    -   Password change requires current password verification for self-service updates
-   **Mentoring Record System**:
    -   Monthly mentoring records for player-coach 1on1 feedback
    -   Data per month: Goal (player-editable), Staff Comment (coach-editable), Score 1-5 (coach-editable)
    -   Auto-generates month rows from player's joinedAt to current/graduation date
    -   Average score displayed in header
    -   Role-based editing: Players edit goals only, coaches edit comments/scores, parents view-only
    -   Inline editing with auto-save per cell
    -   Available in PlayerDetail (メンタリング tab) and MyPage (section)
    -   API: `/api/mentoring/:playerId` (GET/PUT)
    -   Model: `MentoringRecord` with unique constraint on playerId+targetMonth
-   **Task Management System**:
    -   Coaches can assign tasks to players with title, description, and due date
    -   Task statuses: PENDING, IN_PROGRESS, COMPLETED, CANCELLED
    -   Players receive notifications when new tasks are assigned
    -   Task list visible on player detail page (課題 tab)
    -   Players can mark tasks as in-progress or completed
-   **Video Sharing & Tag System**:
    -   Videos can be tagged with specific players and team categories for targeted sharing
    -   `VideoPlayerTag` and `VideoCategoryTag` models (many-to-many) link videos to players and categories
    -   Tag selection during upload and post-upload editing via tag edit modal
    -   Player search with number/name filtering in tag picker
    -   Video list filterable by category and player tags
    -   Tags displayed as colored badges on video cards (purple for categories, blue for players)
    -   Validation ensures tags belong to the same team as the video (prevents cross-team data leakage)
    -   API: Tags sent as `playerTagIds` and `categoryTagIds` arrays on create/update
-   **Video Comment System**:
    -   Users can comment on uploaded videos
    -   Comments support create, edit, and delete operations
    -   Video uploader and player receive notifications when comments are added
    -   Comment section accessible via video modal with playback
-   **Player Dashboard** (`/player-dashboard`):
    -   Four-tab dashboard: Summary, Career Achievement, Evaluation Analysis, Progress Tracking
    -   Summary tab: Total score, cumulative achievement rate (progress bar), latest round, unread notifications, next actions
    -   Career Achievement tab: XP-style cumulative achievement rate system
        -   Formula: Numerator = sum of all evaluation scores since join; Denominator = totalMonths (joinDate→graduationDate) × monthlyMaxScore
        -   Table showing: Category / Elements MAX+Current / Steps MAX+Current / Achievement Rate%
        -   Color-coded achievement cells: Red (<40%), Orange (40-59%), Blue (60%+)
        -   Period info display: join date, graduation date, total months, elapsed months
        -   Career progress area chart (cumulative rate over time)
        -   Category-specific line chart
    -   Evaluation tab: Radar chart (coach vs self by category), gap analysis bar chart, detailed score table
    -   Progress tab: Line chart for score trends over evaluation rounds with category filter
    -   Uses Recharts for all visualizations with responsive design for mobile
    -   Parent accounts can also access this dashboard to view their child's data
    -   Player model includes `joinedAt` and `graduationDate` fields for career period definition (default 36 months if not set)
-   **Coach Assignment System**:
    -   Head Coach designation: One head coach per team, can evaluate all players in the team
    -   Coach-Player assignments: COACH and GUEST_COACH roles can only evaluate players they are explicitly assigned to
    -   `CoachAssignment` model manages many-to-many relationship between coaches and players
    -   APIs: `/api/coach-assignments` for managing assignments, `/api/teams/:id/head-coach` for head coach designation
    -   Permission logic: `canEvaluatePlayer` function in auth middleware enforces evaluation permissions

### UI/UX Decisions
-   **Sidebar Navigation**: Dark navy sidebar (`bg-sidebar: #1e293b`) with white text, active item highlighted with `bg-white/15`, admin section separated with border. User profile at bottom with logout button. Dynamic menu based on user role.
-   **Player Profile**: Rich card-based design with gradient headers, photos, and tabbed navigation for evaluations, videos, notes, progress, and appeals.
-   **Data Visualization**: Extensive use of Recharts for evaluation progress, category trends, and gap analysis with intuitive coloring (e.g., heatmap cells, blue/red bars for positive/negative gaps).
-   **Admin Interface**: Separate, dedicated interface for operators with distinct navigation and management tools.

## Infrastructure & Non-Functional Features
-   **Database Indexing**: Comprehensive indexes on frequently queried columns (teamId, userId, playerId, roundId, etc.) for optimized query performance.
-   **Security Headers**: Helmet middleware with environment-aware CSP (strict in production, relaxed in development).
-   **Backup System**: PostgreSQL backup script (`scripts/backup-db.sh`) with automatic retention (7 days) and cron setup instructions.

## External Dependencies
-   **Prisma ORM**: For database interactions with PostgreSQL.
-   **JWT (JSON Web Tokens)**: For authentication.
-   **Recharts**: For data visualization and charting in the UI.
-   **Helmet**: For HTTP security headers.