# Third-Party Notices

This file records third-party attribution for architecture and implementation
patterns used by `apps/research`.

## Local Deep Research

- Project: Local Deep Research
- Repository: https://github.com/LearningCircuit/local-deep-research
- License: MIT License
- Reference version in SINKRA bench: v1.6.11
- Reference clone used by analysis: `/Users/alan/Code/bench/local-deep-research`
- Attribution required by bench:

```text
Inspired by Local Deep Research (LearningCircuit/local-deep-research) - MIT License
Original: https://github.com/LearningCircuit/local-deep-research
```

### Scope of Use

`apps/research` does not import, vendor, execute, or fork Local Deep Research
Python or Flask code. The current `research-core` implementation ports selected
architectural patterns into SINKRA-native TypeScript:

- bounded agent loop with explicit stop reasons;
- source collector with stable citation indices;
- citation validation using `[N]` source references;
- SSRF-guarded fetch tool;
- runtime metrics, redacted traces, and Gold artifact emission.

Any future implementation that copies source code from Local Deep Research must
preserve the upstream MIT notice and update this file before merge.
