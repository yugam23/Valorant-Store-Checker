/**
 * MSW Request Handlers for E2E Testing
 *
 * This module exports mock HTTP handlers used by the MSW Node server in instrumentation.ts.
 * When ENABLE_MSW=true, instrumentation.ts starts setupServer with these handlers to mock
 * all external API calls (Riot Auth, PD Store, Henrik API, Valorant-API).
 *
 * Handlers are defined in plan 27-02 (handlers implementation).
 * This stub exists to allow instrumentation.ts to compile in plan 27-01.
 */

import { RequestHandler } from "msw";

export const handlers: RequestHandler[] = [];
