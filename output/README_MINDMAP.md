This folder is produced by `tools/analyze_repo.js`.

Files:
- `mindmap.mmd` — Mermaid graph file (generated).
- `repo_graph.json` — Detailed JSON graph with nodes and edges.

To convert `mindmap.mmd` to a landscape PDF using `mermaid-cli` (`mmdc`):

1. Install `mermaid-cli` (requires Node.js and npm):

```powershell
npm install -g @mermaid-js/mermaid-cli
```

2. Generate a PDF in landscape:

```powershell
mmdc -i output/mindmap.mmd -o output/mindmap.pdf -w 2048 -H 1536 --paperType A3 --backgroundColor '#ffffff' --theme default --pdf
```

If `mmdc` isn't available, you can open `output/mindmap.mmd` in any Mermaid live editor (like https://mermaid.live) and export PDF from the browser.

If you want, I can run `node tools/analyze_repo.js` and attempt to run `mmdc` here (requires installing the CLI). Reply to allow that operation.
