# Project: ChoreReward

## Identity
**What:** A parent-controlled chore management and reward system that gamifies household responsibilities for children with customizable themes, progress tracking, and verification workflows.
**Type:** SaaS (subscription-based web/mobile application)
**Theme/Brand:** Gamified, family-friendly, customizable with royalty-free themes for child engagement

## Target Audience
Parents seeking to organize household chores, teach responsibility, and incentivize task completion for their children. Solves the problem of scattered chore assignments, unclear expectations, and lack of visible progress tracking in family households.

## Key Goals
- Enable parents to create, assign, and manage chores with flexible frequency options (daily, weekly, monthly)
- Provide children with an engaging, theme-customizable interface to view and complete assigned tasks
- Implement a comprehensive reward system tied to chore completion with parent-set prizes and goals
- Deliver multi-timeframe progress tracking (daily, weekly, monthly) to visualize completion rates
- Establish a sustainable subscription model for parent users

## Active Plan
1. Map existing routes and household flows — done.
2. Build parent side navigation and management sections — done.
3. Simplify chore completion and PIN entry interactions — done.
4. Add child-facing dashboard and support request flow — done.
5. Build parent dashboard today overview with pending, approval, and completed chores — done.
6. Verify routing, data wiring, and preview readiness — in progress.
7. Reorganize parent navigation into Household and Chores subsections — done.

## Design Direction
- **Style:** Fun, modern, and approachable with gamification elements (progress bars, achievement badges, theme customization)
- **Colors:** Bright, engaging palette suitable for children; customizable per selected theme
- **Tone:** Encouraging and positive; empowering both parents (control/management) and children (achievement/progress)

## Core Features
- Chore creation with frequency, assignee(s), subtasks, and time limits
- Parent verification requirement toggle for task completion
- Customizable reward/prize system with completion goals
- Royalty-free theme selection for child-facing interface
- Multi-level progress tracking dashboard
- Parent admin panel for full CRUD operations on chores, rewards, and system settings
- Monthly subscription billing for parent accounts
- Child PIN code protection with profile login screen showing all users and theme image reference tiles
- Parent sign-in via Overskill account credentials

## Architecture Decisions
- Subscription pricing set at $10/month for parent accounts
- Coupon code system implemented for test users to receive first month free
- Child authentication via PIN code with visual profile selection interface
- Parent authentication integrated with existing Overskill account system
- Sign-in accessible at dedicated login route separate from marketing landing page
- Chore editor supports frequency selection (daily, weekly, monthly), multi-profile assignment, subtasks, rewards, time limits, and optional parent approval
- Optional random assignment feature allows parents to select eligible children and configure automatic rotation cadence (daily, weekly, or monthly)
- Parent dashboard accessible at `/dashboard` after sign-in; parent profile selection required to access chore management
- 27 daily/weekly chore presets available per household profile alongside custom chore creation
- Multi-parent household support: initial parent can invite additional parent/adult accounts via email with shared household data and role-based permissions
- Child profiles remain PIN-protected within parent-signed accounts; separate adult accounts enable household collaboration
- Source code and asset files hosted in public GitHub repository (`tjleafty/Responsibilities-App`) under `chore-rewards/` directory for collaborative development and file sharing

## Recent Work
*Last updated: 2026-10-02 12:47 UTC*
- Fixed DOM nesting validation warning: resolved `<p>` tag nesting conflict in preview (v1.4.4); production deployment pending
- Established public GitHub repository (`tjleafty/Responsibilities-App`) as centralized source for all project files, including reward preview, animation/sound libraries, theme files, and audio assets
- Verified repository structure contains `chore-rewards/` directory with `preview.html`, `RewardOverlay.jsx`, animation and sound code, and supporting libraries
- Parent Settings management fully functional with list/add/edit/PIN-reset/deactivate/reactivate for household profiles; one active parent safeguard maintained
- Chore editor, child checklist interface, theme customization, progress tracking, and random assignment feature all operational and ready for production promotion
