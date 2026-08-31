// Stub for the `server-only` package under Vitest.
// The real package throws when imported outside a server context, which is a
// build-time guard we want in the app but not in a node test runner.
export {};
