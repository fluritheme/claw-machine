# Security

Report reproducible security issues privately to fluritheme@gmail.com. Do not include personal data or live credentials in public reports.

The standalone runtime contains Three.js and cannon-es. It does not include a server, account credentials, reward issuing or remote code execution. Custom image and destination URLs are validated. Callback events are client-side cosmetic state, not proof of entitlement to valuable rewards.

## Development tool advisory — 18 November 2026

Vite's development-only picomatch dependency is covered by GHSA-fc5q-39xc-vjpf; the advisory currently lists no patched version. This project's build patterns are repository-owned, and its development server binds to 127.0.0.1. Do not expose that server publicly or supply untrusted glob patterns to the tooling. Picomatch and Vite are not dependencies of the installed theme or part of its browser runtime. CI audits production dependencies; the full development audit retains this known finding until an upstream fix is available.
