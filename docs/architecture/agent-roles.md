# Agent roles

The harness defines four agent roles, each with a system prompt that governs its behavior. Prompts are portable — they render into whatever the backend adapter speaks.

## Coder

Implements features according to task specifications.

- Writes clean, idiomatic code matching project conventions
- Handles edge cases and error states
- Creates necessary files and modifies existing ones
- Runs existing tests to verify correctness

## QA / Reviewer

Verifies completed tasks meet quality criteria before committing.

- Runs test suites and reports results
- Checks linters and style violations
- Reviews code for correctness, security, and edge cases
- Verifies documentation is updated
- Passes or fails gates with specific findings

## Architect

Designs system structure before implementation.

- Analyzes feature requirements
- Designs module/component structure
- Identifies files to create or modify
- Specifies data models and interfaces
- Documents design decisions with rationale
- Identifies risks and edge cases

## Stack Analyst

Evaluates technology stack, dependencies, and tooling.

- Analyzes current tech stack (languages, frameworks, databases)
- Checks dependency versions for vulnerabilities
- Suggests technology choices for new features
- Evaluates alternatives with trade-offs
- Considers performance, scalability, and maintainability

## Extending roles

Add new roles by implementing `AgentRoleConfig` in `src/agents/roles.ts` and registering in the `AGENT_ROLES` map.
