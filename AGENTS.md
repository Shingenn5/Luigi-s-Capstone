# Repository instructions

These instructions apply to all work in this repository. Follow explicit user instructions first, and preserve unrelated user changes.

## Required technology stack

- Use Node.js for the application server and backend logic. Use a supported LTS release and document the required version when setting up the application.
- Use a relational SQL database for persistent application data. Choose and document the database engine before implementing persistence; do not silently substitute a NoSQL database.
- Use Bootstrap for the frontend layout, components, responsive behavior, and styling. Keep the Bootstrap version consistent across its CSS and JavaScript dependencies.
- Do not introduce another UI framework, CSS framework, or CSS-in-JS library without an explicit user request.

## Minimal CSS policy

- Use as little custom CSS as physically possible. Start with Bootstrap components, its grid, and utility classes for spacing, sizing, alignment, typography, colors, and responsive layouts.
- Prefer semantic HTML and Bootstrap's existing component patterns before creating custom presentation rules.
- Add custom CSS only when a required design or behavior cannot reasonably be achieved with Bootstrap. Keep each exception small, scoped, and explain why it is needed in the change summary.
- Keep necessary custom rules in one clearly named stylesheet initially. Avoid inline styles, duplicated rules, broad global overrides, and unnecessary `!important` declarations.
- Do not recreate Bootstrap components or build a parallel design system. Reuse shared markup or templates instead of repeating layouts.
- Maintain accessible contrast, keyboard navigation, visible focus states, labels, and responsive layouts even when minimizing CSS.

## Naming and formatting

- Use `camelCase` for JavaScript variables, functions, parameters, object properties, and application-owned JSON fields.
- Use `PascalCase` for classes and `UPPER_SNAKE_CASE` for true module-level constants and environment variables.
- Use descriptive names that communicate purpose. Avoid unexplained abbreviations, single-letter names outside short conventional loops, and magic numbers.
- Use lowercase `kebab-case` for file and directory names unless a tool requires a specific name such as `AGENTS.md`.
- Use lowercase `snake_case` for SQL tables and columns, uppercase SQL keywords, and explicit mappings to camelCase application fields. Avoid quoted, case-sensitive database identifiers.
- Use two-space indentation, semicolons, and single quotes in JavaScript. Configure ESLint and Prettier when application tooling is introduced; let the tools enforce consistent formatting.
- Prefer `const`; use `let` only when reassignment is necessary. Do not use `var`.

## Implementation practices

- Use JavaScript ES modules for new Node.js code and declare the module type when creating `package.json`.
- Keep functions focused and modules cohesive. Separate request handling, business logic, and database access as the application grows, without adding unnecessary abstraction.
- Prefer `async`/`await` for asynchronous operations. Handle rejected promises and propagate errors deliberately; do not swallow exceptions.
- Validate and normalize untrusted input on the server. Client-side validation improves usability but does not replace server-side validation.
- Return consistent responses and appropriate HTTP status codes. Show useful user-facing errors without exposing stack traces, credentials, or internal database details.
- Keep secrets and environment-specific configuration out of source control. Use environment variables and provide a `.env.example` containing placeholders when configuration is added.
- Use parameterized SQL queries or safely bound ORM queries. Never concatenate user input into SQL statements.
- Manage schema changes through versioned migrations. Use appropriate constraints, foreign keys, transactions, and indexes based on actual query needs.
- Enforce authentication and authorization on the server for protected actions. If passwords are needed, store secure password hashes rather than plaintext passwords.
- Prefer maintained dependencies and built-in capabilities. Commit the package lockfile and use reproducible installs with `npm ci` once it exists.
- Write comments explaining intent or non-obvious constraints. Keep setup instructions and documentation aligned with the implementation.

## Verification

- Run relevant lint, formatting, test, and build checks that exist for the change. Do not claim a check passed if it was not run.
- Add meaningful tests for business logic, validation, database behavior, and bug fixes when applicable. Avoid tests that merely mirror implementation details.
- For interface changes, inspect the rendered result at desktop and mobile widths and verify relevant keyboard interactions. Build success alone does not prove the UI works.
- Describe what changed, how it was verified, and any remaining limitations. If a required check is unavailable, report that explicitly.

## Git workflow and communication

- Before editing, inspect the current branch and working tree. Preserve unrelated staged and unstaged changes; stage only files belonging to the requested work.
- After making a change in this GitHub repository, always commit and push to the branch currently being worked on. Use a concise, descriptive commit message.
- Never force-push, discard user changes, or switch branches unless explicitly authorized. If committing or pushing is blocked, preserve the changes and report the exact blocker.
- Keep responses direct and practical. A little sarcasm is welcome; clarity and accuracy take priority.
- Always include a small **TL;DR** at the bottom of responses.
