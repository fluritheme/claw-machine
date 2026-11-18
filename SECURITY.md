# Security

Report reproducible security issues privately to fluritheme@gmail.com. Do not include personal data or live credentials in public reports.

The standalone runtime contains Three.js and cannon-es. It does not include a server, account credentials, reward issuing or remote code execution. Custom image and destination URLs are validated. Callback events are client-side cosmetic state, not proof of entitlement to valuable rewards.

## Reviewed tooling advisory — 18 November 2026

CVE-2026-112366 / [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) affects picomatch through 4.0.7. Upstream currently lists no patched release. It requires attacker-controlled repeated extglob patterns. This project uses repository-owned build/test patterns and localhost development servers; it does not accept glob expressions from visitors. Picomatch is absent from the browser theme runtime and deployed Worker entrypoints.

CI scans both development and production dependencies, with a specific exception for this CVE. Every other high/critical advisory still fails CI. This exception is a reviewed exposure assessment, not a fix or a claim that the full dependency tree is vulnerability-free. Check for an upstream patch on each release and remove the exception as soon as one is available. Do not expose development servers or accept untrusted build globs.
