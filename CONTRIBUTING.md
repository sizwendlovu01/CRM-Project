# Contributing

1. Fork and create a branch from `main`.
2. `pnpm install`, then follow "Running without Docker" in the README.
3. Keep changes focused. Shared validation and permissions belong in `packages/shared`.
4. Every tenant-scoped query must filter by `workspaceId`; add a cross-tenant test for new endpoints.
5. Before opening a pull request run:

   ```bash
   pnpm typecheck && pnpm lint && pnpm test:unit && pnpm test:integration
   ```

6. Use clear commit messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
7. Never commit secrets or `.env` files.

CI runs lint, type checks, unit, integration and E2E tests, builds and a dependency audit on every pull request.
