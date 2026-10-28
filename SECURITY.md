# Security and trust model

## Reporting

Please open a private GitHub Security Advisory for vulnerabilities. Do not include private documents, credentials, personal data or sensitive customer URLs in public issues.

## Data boundaries

- Desktop model inference runs locally through Ollama on `127.0.0.1` or embedded `node-llama-cpp`.
- Public company research makes outbound requests to the entered website and Bing RSS.
- Optional local documents are parsed on the user's computer and included only in the local model context.
- The web version sends the entered public URL to the site's own PHP research endpoint. It does not accept internal documents.

## Implemented safeguards

- Electron uses context isolation, sandboxing and no renderer Node integration.
- Public fetching rejects credentials, non-HTTP protocols, non-standard ports and private/reserved network addresses, including redirects.
- Responses, page counts, local file counts and local file sizes are bounded.
- The public research endpoint has a basic per-IP limit of 30 requests per 10 minutes, with `429` and `Retry-After` on exhaustion.
- External search is hostname-first and unrelated snippets are filtered.
- Model output is structured and citations must be exact substrings of the retrieved source.
- Unsupported numbers are rejected in titles, rationale, actions, metrics and unknowns.
- Recommendations remain low-confidence hypotheses; rationale shown to users does not turn public claims into facts about the company.

## Important limitations

- No citation checker can guarantee truth, completeness, relevance or commercial value. A company's own public claims may themselves be wrong.
- Public snippets and pages are untrusted data. Prompt-injection resistance is defence in depth, not a guarantee.
- The built-in per-IP limit is basic application-level protection. Add edge quotas, abuse monitoring and alerting before a large traffic campaign.
- Windows artifacts are not code-signed in the local build. macOS artifacts are not notarized by the default workflow.
- Review third-party licenses, model licenses and dependencies before redistribution.

Please report concrete reproduction steps and affected versions. Do not publicly claim a vulnerability is exploitable before validating it against the current source.
