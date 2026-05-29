/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as corperAudit from "../corperAudit.js";
import type * as corpers from "../corpers.js";
import type * as corpers_auth from "../corpers/auth.js";
import type * as corpers_clearance from "../corpers/clearance.js";
import type * as corpers_mutations from "../corpers/mutations.js";
import type * as corpers_normalize from "../corpers/normalize.js";
import type * as corpers_registryQueries from "../corpers/registryQueries.js";
import type * as http from "../http.js";
import type * as letterRegistry from "../letterRegistry.js";
import type * as letters from "../letters.js";
import type * as pgApplicantAudit from "../pgApplicantAudit.js";
import type * as pgApplicants from "../pgApplicants.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  corperAudit: typeof corperAudit;
  corpers: typeof corpers;
  "corpers/auth": typeof corpers_auth;
  "corpers/clearance": typeof corpers_clearance;
  "corpers/mutations": typeof corpers_mutations;
  "corpers/normalize": typeof corpers_normalize;
  "corpers/registryQueries": typeof corpers_registryQueries;
  http: typeof http;
  letterRegistry: typeof letterRegistry;
  letters: typeof letters;
  pgApplicantAudit: typeof pgApplicantAudit;
  pgApplicants: typeof pgApplicants;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
