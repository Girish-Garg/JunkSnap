# junksnap-server

One TypeScript image, three entry points: `api` (default, `node dist/handlers/web.js`, port 8000), `worker` (`node dist/handlers/worker.js`) and `scores` (`node dist/handlers/scores.js`). Verify: `npm ci; npm run lint; npm run typecheck; npm test; npm run build`. Local: `JUNKSNAP_STAGE=dev npm run dev:web`.

1. Routes: write `src/handlers/<topic>Routes.ts` exporting `build<Topic>Routes(context: RouteContext): FastifyPluginAsync`. It loads its settings, builds adapters, then services, and returns the plugin. Add one import and one line to `ROUTE_BUILDERS` in `src/handlers/routes.ts`. Never add routes to `web.ts`.
2. Settings: write `src/settings/<Topic>Settings.ts`, a class with readonly fields and `static fromEnv(env: Env)` that calls `parseEnv(zodSchema, env)` with the exact variable names from `contracts/README.md`; the builder passes `context.env`. Never add task fields to `CoreSettings`.
3. Errors: throw `JunkSnapError` subclasses; a new contract code is `class XError extends NotFoundError { override readonly code: ErrorCode = "area_not_found"; }` and the status follows. Bad stored, internal or outbound data is `InternalDataError` (500 `server_error`).
4. Contract validators (`validateSite()` and friends in `src/contracts/index.gen.ts`) are for request bodies and inbound messages only, and throw 400 `ValidationError`; call them only from handlers and adapters, never as Fastify route schemas (Fastify's Ajv is draft-07). After a schema change run `npm run gen:contracts` and commit the `.gen.ts` files.
5. Contract types (`import type { Site } from "../contracts/index.gen.js"`) may be imported in any layer.
6. Logs: services take the `Logger` port; inside a route plugin pass `app.log`. Entry points run through `EntryPoint`, which logs failures as one JSON line and exits 1. Never log images, tokens or names.
