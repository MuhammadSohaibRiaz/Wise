# WiseCase Legal Knowledge Sources

Place converted legal sources into the folder that matches the corpus.

| Folder | Put these Markdown files here |
| --- | --- |
| `criminal/` | `Pakistan Penal Code.md`, `Code of Criminal Procedure, 1898.md`, `Qanun-e-Shahadat Order, 1984.md` |
| `family/` | `Muslim Family Laws Ordinance, 1961.md`, `West Pakistan Family Courts Act, 1964.md`, `Dissolution of Muslim Marriages Act, 1939.md` |
| `tax/` | `Income Tax Ordinance, 2001.md`, `Sales Tax Act, 1990.md` |
| `labour/` | `Industrial Relations Act, 2012.md` |
| `immigration/` | `Emigration Rules, 1979 updated 2023.md` |
| `civil/` | `Contract Act, 1872.md` |

## Image-only PDFs

Put image-only PDFs that still need OCR in a folder starting with `_`, for example:

```text
data/legal-knowledge/family/_ocr-needed/Guardians and Wards Act, 1890.pdf
```

Folders starting with `_` are skipped by ingestion. After OCR conversion, place the generated `.md` file directly in `family/`.

## Commands

Clean rebuild of the full RAG index:

```bash
npm run rag:ingest:recreate
```

Upsert only:

```bash
npm run rag:ingest
```
