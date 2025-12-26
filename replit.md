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
-   **Role-Based Access Control**: Granular permissions at organization, team, and individual levels (Operator Admin, Team Head Coach, Player, Parent, etc.).
-   **Team Management**: Profile management, player roster, invitation system for onboarding staff and players.
-   **Evaluation System**: Hierarchical evaluation items, distinct evaluation rounds, coach and self-evaluations with historical data preservation, and comprehensive visualization using Recharts (progress charts, heatmaps).
-   **Player Management**: Detailed player profiles with personal information, JFA Passport photo upload, role model/play style fields, and coach notes.
-   **Goal Management**: Customizable goal categories for teams, player-settable goals, and goal tracking.
-   **Communication Tools**:
    -   **Calendar System**: Monthly view for practices, matches, meetings, and events, with color-coding and role-based access. Supports team-scoped and organization-scoped events.
    -   **Announcements System**: Priority levels, publish/draft status, expiration dates, and category-based targeting for team-scoped and organization-scoped announcements.
-   **Public Appeal URL**: Player/coach-generated public profiles for showcasing skills, with random URLs, expiration dates, issuer type display (player/club), and comprehensive player info including evaluation categories with coach/self scores. Expired appeals return 410 status.
-   **Invitation URL System**: Team-based invitation system for players, parents, and staff with role-specific flows. Parent invitations require player selection and auto-create PlayerParent relationships upon registration. Security validation ensures players belong to the target team.
-   **System Administration**: Dedicated operator dashboard with system-wide statistics, team management, user management, and team impersonation capabilities.
-   **Data Visibility**: Evaluation data and other records are filtered based on player-team membership periods, ensuring coaches only see relevant historical data.
-   **Parent Team Inheritance**: Evaluation items and rounds can be inherited from parent teams for sub-teams.

### UI/UX Decisions
-   **Sidebar Navigation**: Clevio-style left-fixed sidebar, dynamic based on user role.
-   **Player Profile**: Rich card-based design with gradient headers, photos, and tabbed navigation for evaluations, videos, notes, progress, and appeals.
-   **Data Visualization**: Extensive use of Recharts for evaluation progress, category trends, and gap analysis with intuitive coloring (e.g., heatmap cells, blue/red bars for positive/negative gaps).
-   **Admin Interface**: Separate, dedicated interface for operators with distinct navigation and management tools.

## External Dependencies
-   **Prisma ORM**: For database interactions with PostgreSQL.
-   **JWT (JSON Web Tokens)**: For authentication.
-   **Recharts**: For data visualization and charting in the UI.