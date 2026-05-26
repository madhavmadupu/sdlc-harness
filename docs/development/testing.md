# Testing

## Running tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch
```

## Test structure

Tests live alongside source code in `__tests__` directories:

```
src/
├── adapter/__tests__/opencode.test.ts
└── graph/__tests__/store.test.ts
```

## Test framework

The project uses [Vitest](https://vitest.dev) with the following conventions:

- `describe` / `it` blocks for organization
- `beforeEach` for fresh state per test
- `vi.spyOn` and `vi.mocked` for mocking external dependencies
- In-memory SQLite (`:memory:`) for graph store tests

## Writing tests

### Graph store tests

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { GraphStore } from "../store.ts";

describe("GraphStore", () => {
  let store: GraphStore;

  beforeEach(() => {
    store = new GraphStore(":memory:");
  });

  it("creates and retrieves nodes", () => {
    // ...
  });
});
```

### Backend adapter tests

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpencodeBackend } from "../opencode.ts";
```

Mock `globalThis.fetch` to simulate backend responses.

## Coverage

Coverage reports are output to `coverage/`. To generate:

```bash
npx vitest run --coverage
```
