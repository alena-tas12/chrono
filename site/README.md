# Chrono OS — Landing Page & Documentation Website

This directory contains the production-ready static landing page and interactive documentation/tutorials for **Chrono OS**.

## 🌐 Deploy on Free Hosting Platforms

You can deploy this site in 1 click for free on any static hosting platform:

### 1. Deploy on Vercel (Recommended)
- Go to [Vercel](https://vercel.com/new).
- Import your repository: `https://github.com/alena10-05/chrono`.
- Set the **Root Directory** to `site`.
- Click **Deploy**.

### 2. Deploy on GitHub Pages
- Go to your repository settings on GitHub.
- Under **Pages**, select branch `landing-page` and folder `/site` (or root if deployed from a dedicated repo/branch).
- Click **Save**.

### 3. Deploy on Netlify
- Go to [Netlify](https://app.netlify.com).
- Drag and drop the `site/` folder directly, or connect your GitHub repository and set publish directory to `site`.

### 4. Deploy on Render
- Create a **Static Site** on [Render.com](https://render.com).
- Set publish directory to `site`.

---

## 📄 Site Structure
- `index.html` — Comprehensive product showcase explaining the 15-Layer Cognitive Pipeline, 8 Subsystems, Observability, and Local SQLite + Supabase architecture.
- `tutorials.html` — Step-by-step documentation covering Quickstart, Chrono Spaces (Calendar PRs), Communication OS (WebRTC, Google Meet, WhatsApp), AI Multi-Provider failovers, and Data Export.
- `index.css` — High-performance responsive styling with dark-mode HSL aesthetics and fluid typography.
- `vercel.json` — Pre-configured routing rules for instant Vercel zero-config deployments.
