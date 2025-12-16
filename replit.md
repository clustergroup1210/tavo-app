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
| Operator Admin | admin@example.com | password123 |
| Head Coach | coach@example.com | password123 |
| Player | player@example.com | password123 |

## Recent Changes
- Initial implementation with full role-based access control
- clevio-style sidebar UI with organization switching for operators
- Complete evaluation system with rounds and duplicate prevention
- Invitation and appeal URL features
- Video upload support with authenticated streaming
- Protected media access (videos require authentication)
- No product name appears in UI or code
