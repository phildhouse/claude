# The Claude Skills Playbook — by Marcin AI

**The proven, done-for-you Claude Skills the best builders are actually using.** Hand-picked from GitHub, X and the community. Curated by **Marcin Teodoru** · Marcin AI · June 2026.

> A **Claude Skill** is a small folder (a `SKILL.md` plus optional scripts/resources) that Claude loads *on demand* to become an instant expert at a job. Install once, and Claude just knows. This is a stash of the **best existing skills** — not a how-to-build-them doc — with full credit to their creators.

### 📦 Deliverables
- **⭐ Social carousel (primary):** [`Marcin-AI-Claude-Skills-Carousel.pdf`](./Marcin-AI-Claude-Skills-Carousel.pdf) — 16 bold, dark, square slides built to be screenshotted and shared on X / TikTok / IG. Big type, one hook per skill, creator @handles, one-line installs.
- **🖼️ Ready-to-post slides:** [`slides/`](./slides) — all 16 slides exported as **1080×1080 PNGs** for an Instagram/X carousel.
- **📄 Editorial PDF (alt / print):** [`Marcin-AI-Claude-Skills-Playbook.pdf`](./Marcin-AI-Claude-Skills-Playbook.pdf) — long-form version in Claude's clay/terracotta theme.
- **🛠️ Source:** `skills-carousel.html`, `skills-guide.html`, `fonts/`.

### How to install any skill
1. Grab the skill folder from its repo (links below).
2. Drop it in `~/.claude/skills/` (global) or `.claude/skills/` (per-project). On Claude.ai: **Settings → Capabilities → Skills** and upload.
3. Restart / refresh Claude — it auto-detects from the description.
4. Trigger it naturally ("make me a video", "grill me on this plan") or via its slash command.

---

## 01 · The Official Foundation — Anthropic
> Anthropic's own open-source skills. If you install nothing else, install these. → https://github.com/anthropics/skills (146k★)

| Skill | What it does | Link |
|---|---|---|
| **pdf · docx · pptx · xlsx** | Create/edit/parse real PDF & Office files (tracked changes, formulas, decks, forms) | [skills/](https://github.com/anthropics/skills/tree/main/skills) |
| **mcp-builder** | Scaffold a full MCP server to wire any API into Claude as native tools | [mcp-builder](https://github.com/anthropics/skills/tree/main/skills/mcp-builder) |
| **webapp-testing** | Drive your running app in a real browser (Playwright) to verify UI & flows | [webapp-testing](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) |
| **frontend-design / web-artifacts-builder** | Non-generic UI design + rich React/shadcn HTML artifacts | [skills](https://github.com/anthropics/skills) |
| **skill-creator** | Interactive builder to package your own workflow as a skill | [skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator) |
| **algorithmic-art · canvas-design · slack-gif-creator · brand-guidelines · internal-comms · claude-api** | Creative + comms quick wins | [skills](https://github.com/anthropics/skills) |

## 02 · The Viral Game-Changers
> Blew up on X / Hacker News because they fix how Claude *thinks and talks*. Highest ROI here.

| Skill | What it does | Creator | Link |
|---|---|---|---|
| **grill-me** ⭐ | Claude interviews *you* (50+ Qs) until the plan is airtight before coding | Matt Pocock | https://github.com/mattpocock/skills |
| **Caveman** 🪨 | Cuts output tokens ~65% (up to 87%) by stripping filler — code kept exact | Julius Brussee | https://github.com/JuliusBrussee/caveman |
| **Karpathy Coding Guidelines** | Four anti-frustration principles: think, simplify, surgical changes, goal-driven | Forrest Chang (from A. Karpathy) | https://github.com/multica-ai/andrej-karpathy-skills |
| **Handoff** | Compress a session into a markdown brief to continue fresh without context rot | Matt Pocock | https://www.aihero.dev/skills-handoff |
| **Superpowers** | 20+ skills: TDD, systematic debugging, planning, worktrees, subagents | Jesse Vincent (obra) | https://github.com/obra/superpowers |

## 03 · Video, Design & Creative
| Skill | What it does | Creator | Link |
|---|---|---|---|
| **Remotion** ⭐ | Prompt programmatic videos (React for video) — explainers, demos, edits → MP4 | Remotion | https://www.remotion.dev/docs/ai/skills · https://github.com/remotion-dev/skills |
| **Figma — implement-design / code-connect** | Faithful Figma → production code; map design ↔ code components | Figma | https://officialskills.sh/figma/skills |
| **frontend-slides** | Animation-rich HTML presentations from a prompt | zarazhangrui | https://github.com/zarazhangrui/frontend-slides |
| **web-asset-generator** | Favicons, app icons, social/OG images in every size | alonw0 | https://github.com/alonw0/web-asset-generator |
| **claude-d3js-skill** | Proper D3.js data visualizations | chrisvoncsefalvay | https://github.com/chrisvoncsefalvay/claude-d3js-skill |
| **shadcn/ui skills** | Real shadcn/ui component context + pattern enforcement | shadcn | https://ui.shadcn.com/docs/skills |

## 04 · Ship Production Web Apps (official vendor skills)
| Skill | What it does | Creator | Link |
|---|---|---|---|
| **Vercel Agent Skills** | react/next best-practices, web-design (100+ a11y rules), composition, vercel-optimize | Vercel | https://github.com/vercel-labs/agent-skills |
| **Stripe best-practices** | Correct Stripe integrations: idempotency, webhooks, edge cases | Stripe | https://officialskills.sh/stripe/skills/stripe-best-practices |
| **Cloudflare Workers + Durable Objects** | Production Workers + stateful RPC/SQLite coordination | Cloudflare | https://officialskills.sh/cloudflare/skills |
| **Netlify Functions + DB** | Serverless endpoints + managed Postgres w/ preview branching | Netlify | https://officialskills.sh/netlify/skills |
| **Sentry setup + fix-issues** | Instrument Sentry anywhere; fix prod issues with trace context | Sentry | https://officialskills.sh/getsentry/skills |
| **Expo native-ui + deploy** | Cross-platform mobile with Expo Router, ship to prod | Expo | https://officialskills.sh/expo/skills |
| **Hugging Face trainer + gradio** | Train models (TRL: SFT/DPO/GRPO), ship Gradio to HF Spaces | Hugging Face | https://officialskills.sh/huggingface/skills |

## 05 · Security & Hardening
| Skill | What it does | Creator | Link |
|---|---|---|---|
| **Trail of Bits Security Skills** | 21+ skills: CodeQL/Semgrep analysis, rule creator, secure smart contracts | Trail of Bits | https://github.com/trailofbits/skills |
| **ffuf Web Fuzzing** | Drive `ffuf` for (authenticated) web fuzzing & endpoint discovery | Jason Haddix (jthack) | https://github.com/jthack/ffuf_claude_skill |

## 06 · Marketing & Growth
| Skill | What it does | Creator | Link |
|---|---|---|---|
| **Corey Haines' Marketing Skills** | 50+ skills: CRO, copywriting, SEO, email, paid ads, retention, strategy | Corey Haines | https://github.com/coreyhaines31/marketingskills |
| **Direct-Response Advertising Skills** | Customer-avatar work + Schwartz-style ad copywriting | Kim Barrett | https://github.com/realkimbarrett/advertising-skills |

## 07 · Data, Science & Mobile
| Skill | What it does | Creator | Link |
|---|---|---|---|
| **claude-scientific-skills** | Scientific libraries + specialized database access for research | K-Dense-AI | https://github.com/K-Dense-AI/claude-scientific-skills |
| **ios-simulator-skill** | Build/boot/test iOS apps in the simulator automatically | conorluddy | https://github.com/conorluddy/ios-simulator-skill |
| **playwright-skill** | Standalone browser automation: scraping, E2E, UI checks | lackeyjb | https://github.com/lackeyjb/playwright-skill |
| **Firecrawl Skill + CLI** | Agent-ready web scraping, search & browser automation | Firecrawl | https://github.com/firecrawl/firecrawl |
| **get-shit-done** | Meta-prompting + spec-driven development system | TÂCHES | https://github.com/gsd-build/get-shit-done |
| **Skill_Seekers** | Convert any docs site into a ready-to-use skill | yusufkaraaslan | https://github.com/yusufkaraaslan/Skill_Seekers |

## 08 · Discovery Hubs (find more)
| Hub | What's there | Link |
|---|---|---|
| **anthropics/skills** | Official source — reference + production skills (146k★) | https://github.com/anthropics/skills |
| **VoltAgent/awesome-agent-skills** | 1000+ official + community skills | https://github.com/VoltAgent/awesome-agent-skills |
| **travisvn/awesome-claude-skills** | Well-curated best-of list | https://github.com/travisvn/awesome-claude-skills |
| **karanb192/awesome-claude-skills** | 50+ hand-verified, categorized | https://github.com/karanb192/awesome-claude-skills |
| **ComposioHQ/awesome-claude-skills** | 1000+ production skills & plugins | https://github.com/ComposioHQ/awesome-claude-skills |
| **officialskills.sh** | Browsable directory of official vendor skills | https://officialskills.sh |
| **hesreallyhim/awesome-claude-code** | Broader: skills, hooks, commands, agents, plugins | https://github.com/hesreallyhim/awesome-claude-code |

---

*Every skill here was shared freely by its creator — star their repos and say thanks. Build faster. Ship smarter. Give credit.*
**— Marcin Teodoru · Marcin AI**

<sub>Curated June 2026. Star counts/links reflect public sources at time of writing and may change — check each repo before installing. All skills belong to their respective creators; Marcin AI claims only curation and gratitude.</sub>
