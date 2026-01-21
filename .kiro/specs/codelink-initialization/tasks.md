# Implementation Plan: CodeLink Project Initialization

## Overview

This plan establishes the foundational structure for CodeLink by creating a TypeScript monorepo with four packages: protocol, vscode-extension, relay-server, and mobile-client. Each task builds incrementally, starting with the shared protocol, then individual components, and finally integration verification.

## Tasks

- [x] 1. Set up root workspace configuration and tooling
  - Create root package.json with npm workspaces configuration
  - Create tsconfig.base.json with strict TypeScript settings
  - Create .eslintrc.json with TypeScript ESLint configuration
  - Create .prettierrc.json with code formatting rules
  - Create .gitignore for node_modules and build outputs
  - _Requirements: 1.3, 2.1, 2.2, 2.5, 3.1, 4.1, 4.2, 10.2, 10.3_

- [x] 1.1 Write property test for root configuration files
  - **Property 1: Required project structure exists**
  - **Property 4: Configuration files contain no placeholder content**
  - **Validates: Requirements 1.1, 1.2, 1.3, 3.1, 4.1, 4.2, 9.1, 12.1**

- [x] 2. Create protocol package with shared types
  - Create packages/protocol directory structure
  - Create package.json with TypeScript build configuration
  - Create tsconfig.json extending base configuration
  - Create src/index.ts with Message base interface
  - Define PingMessage and PongMessage types
  - Export ProtocolMessage union type
  - _Requirements: 1.2, 1.4, 8.1, 8.2, 8.4_

- [x] 2.1 Write property test for protocol package
  - **Property 2: All package.json files contain required fields**
  - **Property 3: All TypeScript configurations extend base configuration**
  - **Property 5: All packages have appropriate entry points**
  - **Validates: Requirements 2.1, 2.2, 3.2, 8.1, 8.2, 12.2, 12.3**

- [x] 2.2 Write unit tests for protocol types
  - Test PingMessage creation with valid fields
  - Test PongMessage creation with valid fields
  - Test type discrimination in union type
  - _Requirements: 8.4_

- [ ] 3. Build and verify protocol package
  - Run npm install in protocol package
  - Run build script to compile TypeScript
  - Verify dist/ directory contains compiled JavaScript and type definitions
  - _Requirements: 8.3, 8.5, 11.4_

- [ ] 3.1 Write property test for protocol compilation
  - **Property 6: All packages compile successfully**
  - **Validates: Requirements 5.4, 7.5, 11.4, 11.5**

- [ ] 4. Create VS Code extension package
  - Create packages/vscode-extension directory structure
  - Create package.json with VS Code extension metadata (engines, activationEvents, contributes)
  - Create tsconfig.json extending base configuration with Node.js settings
  - Add dependency on @codelink/protocol package
  - Create src/extension.ts with activate and deactivate functions
  - Implement "codelink.hello" command that creates a PingMessage
  - Register command and show information message with message ID
  - _Requirements: 1.2, 1.4, 5.1, 5.2, 5.5_

- [ ] 4.1 Write unit tests for extension command
  - Test command creates valid PingMessage with correct fields
  - Test message ID is a valid UUID
  - Test message source is "extension"
  - _Requirements: 5.5_

- [ ] 5. Create relay server package
  - Create packages/relay-server directory structure
  - Create package.json with ws dependency
  - Create tsconfig.json extending base configuration with Node.js settings
  - Add dependency on @codelink/protocol package
  - Create src/index.ts with WebSocketServer setup
  - Implement connection handler with logging
  - Implement message handler that parses ProtocolMessage
  - Implement ping/pong response logic
  - Configure server to use PORT environment variable with default 8080
  - _Requirements: 1.2, 1.4, 6.1, 6.4, 6.5_

- [ ] 5.1 Write unit tests for message parsing
  - Test valid PingMessage JSON parses correctly
  - Test invalid JSON is caught and logged
  - Test PongMessage creation from PingMessage
  - _Requirements: 6.4_

- [ ] 6. Create mobile client package structure
  - Create packages/mobile-client directory structure
  - Create package.json with Vite, React, and React DOM dependencies
  - Create tsconfig.json extending base configuration with DOM and ESNext settings
  - Add dependency on @codelink/protocol package
  - Create vite.config.ts with React plugin and port 3000
  - Create index.html with root div and module script
  - Create public/manifest.json with PWA configuration
  - _Requirements: 1.2, 1.4, 7.1, 7.2, 7.4_

- [ ] 7. Implement mobile client React application
  - Create src/main.tsx with React root rendering
  - Create src/App.tsx with WebSocket connection logic
  - Implement connection status display
  - Implement PingMessage sending on connection
  - Implement PongMessage receiving and display
  - Add basic styling for readability
  - _Requirements: 7.2, 7.5_

- [ ] 7.1 Write unit tests for App component
  - Test component renders without crashing
  - Test status display shows "Disconnected" initially
  - Test PingMessage creation has correct source "mobile"
  - _Requirements: 7.2_

- [ ] 8. Create project documentation
  - Create root README.md with architecture overview
  - Document the three main components and their purposes
  - Add setup instructions with npm install command
  - Add development instructions with npm run dev command
  - Add instructions for running each component individually
  - Explain core principles: no cloud IDE, no repo sync, human approval required
  - Add section on unified diff as primary UI artifact
  - Document code quality scripts (lint, format)
  - _Requirements: 9.1, 9.3, 9.4, 9.5_

- [ ] 8.1 Write property test for README documentation
  - **Property 8: README contains required documentation sections**
  - **Validates: Requirements 9.3, 9.4, 9.5**

- [ ] 9. Checkpoint - Build all packages and verify structure
  - Run npm install at root to install all dependencies
  - Run npm run build to compile all packages
  - Verify each package's dist/ directory contains output files
  - Verify no TypeScript compilation errors
  - Run npm run lint to check code quality
  - Run npm run format:check to verify formatting
  - Ensure all tests pass, ask the user if questions arise
  - _Requirements: 10.2, 11.5_

- [ ] 9.1 Write integration test for protocol imports
  - **Property 7: Protocol package exports are importable**
  - Test vscode-extension can import PingMessage from @codelink/protocol
  - Test relay-server can import ProtocolMessage from @codelink/protocol
  - Test mobile-client can import PongMessage from @codelink/protocol
  - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

- [ ] 10. Manual verification and documentation updates
  - Test VS Code extension loads in Extension Development Host
  - Test relay server starts and listens on port 8080
  - Test mobile client renders in browser at localhost:3000
  - Test WebSocket connection between mobile client and relay server
  - Test ping/pong message exchange works end-to-end
  - Update README.md with any additional setup notes discovered during testing
  - _Requirements: 11.1, 11.2, 11.3_

- [ ] 11. Final checkpoint - Complete verification
  - Verify all configuration files are complete with no TODOs or placeholders
  - Verify all package.json files have required fields
  - Verify all packages have appropriate entry points
  - Verify workspace structure matches design document
  - Run full build and test suite one final time
  - Ensure all tests pass, ask the user if questions arise
  - _Requirements: 12.1, 12.2, 12.3, 12.5_

## Notes

- Each task references specific requirements for traceability
- The protocol package must be built before other packages can import it
- Property tests should use fast-check library with minimum 100 iterations
- Each property test must include a comment tag referencing the design property
- Manual verification (task 10) ensures runtime behavior works correctly
- Build order: protocol → vscode-extension, relay-server, mobile-client (parallel)
- All tasks are required for comprehensive project initialization
