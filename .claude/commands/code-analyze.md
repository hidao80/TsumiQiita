---
name: code-analyze
description: Record and update project documentation in a readable state for both humans and AI.
---

# Details

- [Details](#details)
  - [1. Traceability \& Integrity](#1-traceability--integrity)
  - [2. Documentation Hygiene](#2-documentation-hygiene)
  - [3. Quality of Information](#3-quality-of-information)
  - [Target files](#target-files)

## 1. Traceability & Integrity

- **Commit Hash**: Append the current commit hash as the final line of every modified/created file.
- **Source of Truth**: Always prioritize test code (unit/integration) over implementation when detecting discrepancies.
- **Verification**: If a discrepancy is found between layers (e.g., DB vs. API), document it as a "Known Bug" or "Inconsistency".

## 2. Documentation Hygiene

- **Pruning**: Completely delete any entries, notes, or TODOs related to files, components, or features that no longer exist in the codebase.
- **Structure**: Maintain a clean directory structure under `.claude/analyzed/{CATEGORY_NAME}.md`. Organize your knowledge using Markdown files and a directory structure, and create a mind map. You may include linkable files.
- **Front matter**: Every generated `.md` file must include the standard front matter:  

    ```md
    ---
    name: analyzed-{basename}
    description: {State the purpose in one sentence.}
    type: analysis
    commit-hash: {target commit hash}
    ---
    ```

## 3. Quality of Information

- **No Hallucinations**: Clearly state if information is "Unconfirmed", "Speculative", or "Unknown".
- **Speculation Protocol**: When making suggestions/speculations, provide concise options and a recommendation level (1-5) for each.
- **Clarity**: Use Mermaid notation for all diagrams (ER, Flow, Use Case).
- **Simplicity**: Remove descriptive/boilerplate text from configuration files; provide only summaries or references.

## Target files

**Excution Rules**:

- Do not create or update in the following order.
- Update the memory after each step is completed.

| Step No. | Category Name | Target topics |
| --- | --- | --- |
| 1 | dependencies | Library name, version, license, vulnerability, update status. |
| 2 | infrastructures | CD/CI and IaC. |
| 3 | databases | Connection Informations, Architecture, Migration, List of tables by category and their summaries, Summary of domain areas. |
| 4 | screens | Entry Point, Default Route, URL Pattern, Controller inheritance hierarchy, Base class, View File Convention, Basic template files. |
| 5 | configurations |Main configuration files, Environment-specific settings. |
| 6 | components | Application Structure, Custom Vendor Namespace. |
| 7 | utilities | Global helper Classes, functions, Traits. |
| 8 | performance | Performance check, Identify processing time, number of parallel processes, and bottlenecks. |
| 9 | known_bugs | Security issues, Architectural/design issues, Compatibility issues, Notes on analytical limitations. |
| 10 | security | **[Required]**: Injection (SQL/XSS/Command/Path traversal), Secret & Credential leakage (hardcoded keys, .env commits), Authentication & Authorization (unprotected endpoints, bypass), **[Recommended]**: CORS / Security Headers (CSP, HSTS, X-Frame-Options), Data Exposure (sensitive fields in API responses, stack traces in errors), Dependency Vulnerabilities (known CVEs in lockfile), **[Optional]**: Rate Limiting / Brute-force protection,  File Upload validation (MIME type, path restriction), Transport Security (TLS version, cipher suites). |
| 11 | test | The content of the test that will be provided. |
| 12 | development-workflow | Development Workflow. |
| 13 | overview | Project Overview, Technology stack, Repository structure, Request Flow, Domain configuration, scale, Number of steps (approximate number of lines), Main features, Development Workflow. |
| 14 | notes | The content of the test that will be provided. |
| 15 | todo | Security (high priority), Test, Database, Code Quality, Infrastructure, Developer Experience, Performance. |
| 16 | naming_convention | Variable, Table name, Column name, Function name, Class name. |
| 17 | use_cases | Use case diagram (using Mermaid notation). |
