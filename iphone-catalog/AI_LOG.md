# AI_LOG.md

> Running log of AI usage across the project, per the brief's §7 requirement. Entries are added as
> the work happens, not reconstructed at the end.

---

### Entry 1 — Drafting the Chaos Engine spec
- **Trying to do:** Turn a rough idea for the chaos engine into a proper implementation spec before
  writing any code.
- **Tool/prompt:** Claude (chat). Pasted the internship brief plus a first-draft
  `CHAOS_ENGINE_SPEC.md`, asked it to rate the spec, find weaknesses, and produce a polished version.
- **What it got right:** Caught a real, non-obvious bug risk — the spec's "deterministic, same seed →
  same sequence" claim could silently break if a fresh `Random(seed)` instance got created on every
  check instead of one shared instance advancing over the run. Also flagged that the cookie-banner/
  popup HTML-injection mechanism was never actually specified, just assumed.
- **What it got wrong / had to change:** Nothing factually wrong, but it initially over-specified some
  non-functional targets (e.g. exact overhead numbers) that were kept as guidance rather than hard
  requirements.
- **What I learned:** A spec that *asserts* a property ("this is deterministic") isn't the same as one
  that *mechanically guarantees* it — worth checking my own specs for that gap before handing them to
  a coding agent.

### Entry 2 — Building the site + chaos engine with opencode
- **Trying to do:** Implement the sandbox listing site (iPhone catalog theme) and wire in the Chaos
  Engine.
- **Tool/prompt:** opencode (CLI coding agent), fed the polished spec files directly rather than
  re-explaining the design in the prompt each time.
- **What it got right:** Followed the spec's phase-by-phase structure well when told to stop after
  each step for review, instead of generating everything in one pass.
- **What it got wrong / had to change:** The initial Slow Response implementation had no upper bound
  on delay and ended up taking far longer than intended in testing — removed the scenario entirely to
  unblock other work, then re-added it with a hard 2–5 second clamp enforced at config-validation time,
  not just as a default.
- **What I learned:** "The delay range is configurable" isn't safe by itself — always ask for a hard
  cap enforced at validation, not just a suggested default, especially for anything time-based that a
  bot will be timed against later.

### Entry 3 — Model/session switch mid-project
- **Trying to do:** Keep getting reliable output as the project grew.
- **What happened:** On the free tier, chat sessions that ran long (many back-and-forth debugging
  turns in one thread) started producing less reliable answers — confidently wrong fixes, references
  to code that didn't match what was actually in the repo (hallucinated state).
- **What I changed:** Switched to a different model/fresh chat for the affected work instead of
  continuing to push the same long thread, and started giving a short current-state summary at the
  start of new sessions rather than relying on the model to remember the whole history accurately.
- **What I learned:** This matches the brief's own advice almost exactly ("restart stale chats; when
  quality drops, start fresh with a clean summary of the current state") — worth taking seriously
  earlier next time rather than after hitting it.

### Entry 4 — Home page images
- **Trying to do:** Fix the Home page's featured-models cards, which were rendering with no image.
- **Tool/prompt:** opencode, asked to generate device images and confirm the data (not just the
  template) had a valid image reference per model.
- **What it got right:** Root-caused it as a data issue (missing/empty `heroImage` field for those 3
  models), not just a template bug, and generated placeholder device images to fill the gap — no
  scraped Apple product photography used, per the asset rules.
- **What I learned:** When something "isn't showing up," check the data layer before assuming it's a
  rendering bug — cheaper to rule out first.

---

*(Add 2–3 entries per week going forward, per the brief's cadence.)*
