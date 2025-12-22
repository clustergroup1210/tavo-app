# Player Development Support System

## Overview
A SaaS-type player development support system designed for sports teams. The system follows team-centric design principles and uses player_id as the central identifier.

## Architecture

### Tech Stack
- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend**: Express.js (Node.js)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT-based with cookie storage

### Project Structure
```
/
├── client/             # React frontend
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Page components
│   │   ├── contexts/   # React contexts (auth)
│   │   └── lib/        # Utility functions
│   └── index.html
├── server/             # Express backend
│   ├── routes/         # API routes
│   ├── middleware/     # Auth middleware
│   └── index.js        # Server entry
├── prisma/
│   └── schema.prisma   # Database schema
├── uploads/            # File uploads (logos, videos)
└── package.json
```

## Key Design Principles

1. **No Product Name in UI**: The UI displays only team names and player names, never a product name
2. **Team-Centric Display**: All views are organized around teams
3. **Internal ID Separation**: Database/API paths use generic names, display names are team/player specific
4. **Role-Based Access**: Different menu structures based on user roles

## Roles & Permissions

### Organization Level (Operators)
- OPERATOR_ADMIN: Full system access
- OPERATOR_MANAGER: Management access
- OPERATOR_STAFF: Staff access
- OPERATOR_EXTERNAL: External partner access

### Team Level
- TEAM_ADMIN: Team administrator
- TEAM_HEAD_COACH: Head coach / representative
- TEAM_COACH: Coach
- TEAM_EXTERNAL_COACH: External coach

### Individual Level
- PLAYER: Player account
- PARENT: Parent/guardian account

## Features

### Sidebar Navigation (clevio-style)
- Left-fixed sidebar with team logo and name
- Role-based menu items
- Organization switcher (operators only)

### Team Management
- Team profile with logo upload
- Player roster management
- Invitation URL system for onboarding

### Evaluation System
- Hierarchical evaluation items (category > subcategory > item)
- Evaluation rounds (monthly, seasonal)
- Coach evaluation + self-evaluation
- Historical data preservation (no overwrites)

### Appeal URL
- Simple version: Player-generated, default items only
- Recommended version: Coach-generated with comments
- Random URL, no login required, can be deactivated

## Database Schema

Key tables:
- `Organization`: Operating companies/clubs
- `Team`: Individual teams
- `User`: All user accounts
- `UserOrganization`: Organization-level role assignments
- `UserTeam`: Team-level role assignments
- `Player`: Player profiles (linked to users)
- `EvaluationItem`: Evaluation criteria
- `EvaluationRound`: Evaluation periods
- `Evaluation`: Evaluation records
- `Invitation`: Team invitation tokens
- `AppealLink`: Public appeal page tokens
- `Video`: Video metadata

## Running the Application

### Development
```bash
npm run dev  # Runs both server (port 3001) and client (port 5000)
```

### Database
```bash
npm run db:push     # Push schema changes to database
npm run db:generate # Regenerate Prisma client
node prisma/seed.js # Seed test data
```

## Test Accounts

After running the seed script, the following accounts are available:

| Role | Email | Password |
|------|-------|----------|
| Operator Admin | admin@example.com | admin123 |
| Head Coach | coach@example.com | password123 |
| Player | player@example.com | password123 |

## System Administration

### Operator Dashboard (/admin)
Operators (OPERATOR_ADMIN, OPERATOR_MANAGER, OPERATOR_STAFF) are redirected to /admin upon login.

**Features:**
- System-wide statistics (total teams, players, users)
- Team list with search, showing: team name, representative, player count, category count, creation date
- "管理画面を開く" button to view team details
- "チームとしてログイン" button for team impersonation

### Team Impersonation
Operators can impersonate any team:
1. Click "管理画面を開く" on team list
2. View team overview (players, categories, staff)
3. Click "チームとしてログイン" to access team dashboard
4. Use "管理画面に戻る" link in sidebar to return to admin

### Admin Navigation
Separate sidebar for operators:
- ダッシュボード, チーム管理, ユーザー管理
- 組織管理, マスタ設定, 通知管理, システム設定

### Player Profile Enhancement
Rich card-based player detail page:
- Gradient header with photo, number, name (kanji + romaji), position badge
- Basic info grid: birthdate, height, weight, dominant foot, hometown, school, previous team
- Tabbed navigation: 評価データ, 動画, コメント/ノート, 上達状況, アピール
- Coach notes with add/delete functionality

### Evaluation Visualization (Recharts)
- **評価データタブ**: Coach vs self-evaluation comparison table with heatmap coloring
  - Gap badges: blue (+) = coach higher, red (-) = self higher, gray (0) = match
  - Score cells use gradient blue based on value (1-5)
- **上達状況タブ**: Progress charts using Recharts library
  - Total score progression chart (coach vs self over time)
  - Category-based trend chart
  - Gap trend bar chart with reference line
- **評価サマリー**: Block-based heatmap grouped by category

### Evaluation API Endpoints
- `GET /api/evaluations/comparison/:playerId` - Coach vs self comparison for latest round
- `GET /api/evaluations/progress/:playerId` - Historical progress data (totals + averages)
- `GET /api/evaluations/heatmap/:playerId` - Achievement percentage heatmap
- `GET /api/evaluations/ranking` - Team ranking with filters (teamId, roundId, category, position)
- `POST /api/evaluations/rounds/:id/copy-previous` - Copy evaluations from previous round

### Team Ranking Feature (/ranking)
- **総合ランキング**: All players ranked by total evaluation score
- **カテゴリー別**: Filter ranking by evaluation category (心・技・体・戦術 etc.)
- **ポジション別**: Filter by player position (GK, DF, MF, FW)
- Visual rank badges (gold trophy for 1st, silver/bronze medals for 2nd/3rd)
- Score bar visualization with percentage fill

### Period Management
- Add new evaluation periods (year/month selection)
- Copy previous round's evaluation data to new period
- Period selector in evaluation entry page

### Goal Management System
- **Custom Goal Categories**: Teams can create their own goal categories (短期目標, 長期目標, 技術目標, etc.)
- **GoalCategoryManagement**: Admin page for managing categories (/goal-categories)
- **Player Goals**: Players can set and edit goals by category on their MyPage
- **Goal API Endpoints**:
  - `GET /api/goals/categories?teamId=` - Get categories for a team
  - `POST /api/goals/categories` - Create category
  - `GET /api/goals/player/:playerId` - Get player's goals
  - `POST /api/goals` - Create goal
  - `PUT /api/goals/:id` - Update goal
  - `DELETE /api/goals/:id` - Delete goal

### Player Profile Fields
- `roleModel`: Player's role model/aspiring player
- `playStyle`: Player's play style description
- `passportUrl`: JFA Passport photo URL

### JFA Passport Photo
- Players can upload their JFA Passport photo on MyPage
- Photo displayed as thumbnail with camera hover overlay
- Coaches and admins can also upload player passport photos

### Staff Management (/staff)
- Dedicated page for managing team coaches and administrators
- Add staff by email with role selection
- Change roles (admin, head coach, coach, external coach)
- Remove staff members from team

### Transfer Data Visibility
- PlayerTeamHistory tracks joinedAt and leftAt dates
- When a player transfers, previous team record is closed (leftAt set)
- Evaluation data filtered by team membership period
- Coaches only see evaluations from when player was on their team
- Players and operators see full history

## Recent Changes
- Staff management UI with role assignment and dedicated /staff page
- Transfer data visibility filtering with multi-period support
- Security hardening: Evaluation endpoints require shared team membership and matching PlayerTeamHistory records
- getPlayerTeamMembershipPeriods helper aggregates intervals across team, parent, and child teams
- Goal management system with custom categories
- Player profile fields: roleModel, playStyle
- JFA Passport photo upload on MyPage
- System admin dashboard with team impersonation feature
- Separate admin routing (/admin/*) for operators
- AdminSidebar and AdminLayout for system management views
- AdminUserManagement for system-wide user management
- Player notes feature with hierarchical access control
- Enhanced player profile with rich card-based UI
- Initial implementation with full role-based access control
- clevio-style sidebar UI with organization switching for operators
- Complete evaluation system with rounds and duplicate prevention
- Invitation and appeal URL features
- Video upload support with authenticated streaming
- Protected media access (videos require authentication)
- No product name appears in UI or code
