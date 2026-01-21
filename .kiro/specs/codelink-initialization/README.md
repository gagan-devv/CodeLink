# CodeLink Project Initialization Spec

This specification covers the initial setup of the CodeLink project, a human-in-the-loop AI tele-operation system for software development.

## Documents

- **requirements.md**: Detailed requirements using EARS patterns
- **design.md**: Technical design with architecture, components, and correctness properties
- **tasks.md**: Implementation plan with actionable tasks (to be created)

## Architecture Overview

CodeLink consists of three main components:

1. **VS Code Extension** (local): Runs on developer's laptop
2. **Relay Server** (cloud): Stateless WebSocket pass-through
3. **Mobile PWA** (mobile): Diff viewer and prompt controller

All components communicate using a shared protocol package with TypeScript types.

## Core Principles

- No cloud IDE
- No repo sync to mobile
- No automatic code writes without human approval
- Unified diff is the primary UI artifact

## Next Steps

After reviewing and approving the design document, the next step is to create the tasks.md file with an actionable implementation plan.
