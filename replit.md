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
-   **Data Visibility**: Evaluation data and other records are filtered based on player-team membership periods, ensuring coaches only see relevant historical data.
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
-   **Player Dashboard** (`/player-dashboard`):
    -   Three-tab dashboard: Summary, Evaluation Analysis, Progress Tracking
    -   Summary tab: Total score, achievement rate (progress bar), latest round, unread notifications, next actions
    -   Evaluation tab: Radar chart (coach vs self by category), gap analysis bar chart, detailed score table
    -   Progress tab: Line chart for score trends over evaluation rounds with category filter
    -   Uses Recharts for all visualizations with responsive design for mobile
    -   Parent accounts can also access this dashboard to view their child's data
-   **Coach Assignment System**:
    -   Head Coach designation: One head coach per team, can evaluate all players in the team
    -   Coach-Player assignments: COACH and GUEST_COACH roles can only evaluate players they are explicitly assigned to
    -   `CoachAssignment` model manages many-to-many relationship between coaches and players
    -   APIs: `/api/coach-assignments` for managing assignments, `/api/teams/:id/head-coach` for head coach designation
    -   Permission logic: `canEvaluatePlayer` function in auth middleware enforces evaluation permissions

### UI/UX Decisions
-   **Sidebar Navigation**: Clevio-style left-fixed sidebar, dynamic based on user role.
-   **Player Profile**: Rich card-based design with gradient headers, photos, and tabbed navigation for evaluations, videos, notes, progress, and appeals.
-   **Data Visualization**: Extensive use of Recharts for evaluation progress, category trends, and gap analysis with intuitive coloring (e.g., heatmap cells, blue/red bars for positive/negative gaps).
-   **Admin Interface**: Separate, dedicated interface for operators with distinct navigation and management tools.

## External Dependencies
-   **Prisma ORM**: For database interactions with PostgreSQL.
-   **JWT (JSON Web Tokens)**: For authentication.
-   **Recharts**: For data visualization and charting in the UI.