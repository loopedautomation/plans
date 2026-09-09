/// <reference types="vite/client" />

declare const __PLANS_BUILD_TARGET__: "desktop" | "mobile" | "runtime";

interface ImportMetaEnv {
  /** The workspace server. Unset means the build has no workspaces. */
  readonly VITE_WORKSPACE_URL?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
}
