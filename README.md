# Signed Off

**Attach proof to the invoice.** Turn the scope your client signed into a page that shows each thing they asked for, working in a real browser — including what couldn't be proven.

Built for the [Kane CLI Online Hackathon](https://luma.com/kanecli-online), 19–21 August 2026.

```
  ✓ proven        A visitor can see the price of every bouquet
  ✓ proven        Basket total updates when a bouquet is added
  ✗ not proven    Sunday is not selectable as a delivery date
                    → The run recorded the calendar state as "Sunday 23 August",
                      but this was promised not to happen.
  ○ can't check   A successful order is sent to Sarah by email
                    → Her inbox is out-of-band. No browser can see it.
```

---

## See it working (15 seconds)

```bash
pnpm install
pnpm demo
```

That prints three links. No TestMu AI account, no Kane credits, no API keys — the evidence was sealed by real Kane runs during the build and is committed to this repo.

| | |
|---|---|
| **The handover, before the bug was fixed** | 9 of 16 proven, 2 not proven — Sarah disputed it |
| **The handover, after the agent fixed it** | 11 of 16 proven, 0 not proven — Sarah accepted it |
| **The storefront being checked** | `localhost:4311` |

Open the first link and expand **Show me** on a red row. That is the whole product.

Measured on a clean checkout: 15s including both builds, 5s on later runs.

---

## The problem

A freelancer submits a milestone. The client says "it doesn't work." The freelancer says "works for me." Neither has proof, and the money sits still.

Upwork alone moved [$4.03B of work in 2025](https://investors.upwork.com), and acceptance criteria are already standard in freelance contracts — as prose that nobody ever executes. Meanwhile 96% of developers [don't fully trust AI-generated code](https://www.sonarsource.com/), 82% of organisations [had a production failure from it in six months](https://newrelic.com/), and the bottleneck has moved from writing software to proving it works.

Every verification tool on the market sells a dashboard to a QA engineer. Nobody sells an artifact to the person holding the money.

## What this does

```bash
signedoff init ./scope.md          # what did we promise, and what can be proven?
signedoff verify --url <url>       # check it against the real build
signedoff brief | claude -p        # hand what failed to a coding agent
signedoff publish --milestone 2    # a link your client can open
```

`init` reads the signed scope and comes back with a promise inventory — plus the questions the document never answered, which is worth as much as the proof:

```
16 promises found in your scope
  · Sunday is not selectable as a delivery date.              provable
  · After a successful checkout, the order is sent to Sarah    not provable in a browser
    by email.
    why: Sarah's inbox is an out-of-band channel with no named observable substitute.

7 things your scope doesn't say
  Send these to your client before you build.
  1. email surface — What observable surface should prove Sarah received the order?
  2. phone oracle  — "Works on a phone" has no defined pass condition.
```

## The part I'd want you to look at

**Kane's own generated suite went green on a real bug, and Signed Off refused to sign it off.**

The scope said: *"the customer must not be able to choose a Sunday."* The storefront offered three. The generated assertion was:

```js
/^Sunday\b/.test(el(21).value)
```

The `<select>` element's **value** is `2026-08-23`. Its **visible text** is `Sunday 23 August`. The string "Sunday" never appears in the value, so the check passed. Green run, broken product, video attached.

Kane had already recorded the truth one step earlier:

```json
{"selectedText":"Sunday 23 August","selectedValue":"2026-08-23",
 "sundayOptions":["Sunday 23 August","Sunday 30 August","Sunday 6 September"]}
```

The evidence disproved the verdict it shipped with. So Signed Off does two things:

1. **It owns the settings that make proof trustworthy** — it forces `assertion-mode visual`, so assertions check what a person can see rather than what an element property says.
2. **It cross-checks the verdict against the evidence.** When a promise forbids something and the run recorded that thing present in the state the promise was about, the promise is reported **not proven**, quoting what was seen. It only ever downgrades a pass, and it ignores page copy — so "Sundays are not available" is never mistaken for a violation.

That pack is committed as [`sunday-false-pass.evidence`](packages/cli/test-fixtures/packs/) and the behaviour is locked in by tests. It is the hardest case this product has to get right.

## The closed loop, run for real

| | |
|---|---|
| `verify` | 9 of 16 proven, 2 not proven |
| `publish` | Sarah: *"The Sunday thing needs fixing before I pay."* |
| `brief` | handed the agent `selectedText: Sunday 23 August` |
| *agent patches* | `Set([7])` never matches — `getDay()` returns **0** for Sunday |
| `verify` | 11 of 16 proven, 0 not proven — **3m09s, 10.9 credits** |
| `publish` | Sarah: *"Sunday is fixed. Happy to release payment."* |

Re-checking cost **10.9 credits** against roughly 180 to author the suite, because passed steps replay from cache. That is what makes re-proving a milestone after every fix affordable rather than something you do once.

## Design decisions worth defending

**Three verdicts, never two.** `proven` · `not proven` · `couldn't check`. A timed-out run and a broken checkout are different facts. Collapsing them would let an expired token look like broken client work — the fastest way to make a handover page worthless.

**It publishes its own limits.** Unmeasurable promises appear on the client's page *with the reason*. Every competitor is structurally incentivised to show green; a tool that only ever shows green is useless as evidence.

**Asserted vs observed.** When Kane warns that a test verifies four criteria but machine-asserts one, the other three are marked *proven by review*, not silently rounded up to proof.

**Asymmetric interfaces.** The maker gets a terminal — they already live there, and a maker dashboard would be the wrong instinct. The client gets one page modelled on a signed delivery note: no test names, no ids, no coverage percentages. It opens on a phone with no account and it prints.

**The client can check it without trusting us.** The page is a rendering; the record is a sealed pack. Anyone can run `kane-cli evidence validate <file> --profile L1` and confirm the definition hash matches and the claimed statuses agree with the captured artifacts. We are not the authority — the artifact is.

## Security

The projection from pack to page is an **allowlist**, not a filter. A pack legitimately contains the maker's email, a live TestMuAI dashboard link, and full HAR traces with request headers. None of that may reach the page. Observations are additionally screened for secret-shaped values (bearer tokens, JWTs, card-shaped numbers).

Handover pages are **unauthenticated by design** — a client will not create an account, and requiring one would destroy the only moment that matters. Protection is an unguessable slug, a short PIN shared out of band, `noindex`, and a hardened header set. `publish` says this out loud rather than burying it. Sign-offs bind to the pack's content id, so a stale tab cannot accept work that has since changed, and records are append-only.

**The repository practises this too.** Building it surfaced a gap in my own product: `publish --include-pack` offered the client the *raw* pack, walking straight around the allowlist. Packs handed to a client are now redacted first, and so are the packs committed here — a pack's `result.yaml` carries the maker's account email, org id, and a dashboard share token, and this repo is public. Redaction leaves them valid:

```bash
node scripts/redact-committed-packs.mjs
kane-cli evidence validate <pack> --profile L1   # {"valid":true,"status":"finalized"}
```

L1 checks the definition hash and that claimed statuses agree with the captured artifacts — none of which depends on who ran it. So the client loses nothing they could have checked.

## How it's built

```
packages/cli/      the maker's entire surface
  kane/            NDJSON adapter, assurance-graph reader, sealed-pack reader
  domain/          promise model, three-state verdicts, corroboration check
  projection.ts    the security boundary
packages/web/      the handover page (Next.js)
fixtures/bloom-vine/  the storefront under test — ships one deliberate bug
```

Kane is driven as a subprocess with `--mode agent`, and automation keys only off the terminal events Kane documents as stable. Arguments are passed as argv arrays, never interpolated into a shell string, so scope-document content cannot inject commands.

TypeScript throughout with `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. 22 tests run against **real committed Kane output** — two assurance graphs and one sealed evidence pack — so a Kane upgrade that changes a shape will fail a test rather than silently corrupt a client's page.

```bash
pnpm test        # 22 tests
pnpm typecheck
```

## The video

`video/` builds the three-minute demo. Two of its eight scenes are **genuine screen
recordings**, not composed cards:

| | |
|---|---|
| `terminal.mp4` | 36s of a real Kane session, captured with asciinema over an actual pty |
| `browser.mp4` | 20s of the real handover page, captured through Chrome DevTools |

Getting there took some doing. This machine has no ffmpeg, no Xvfb and no
compositor, so a visible browser window never reaches the X root and `x11grab`
records nothing but black. DevTools screencast solves it properly — frames come
straight out of the real renderer while the page is driven with real input
events. Three takes died before the fourth worked: `git diff` opened a pager and
sat on `(END)`; `kane-cli testmd run` ends with an interactive *"View evidence in
browser? (y/N)"* prompt that blocks under a recorded pty; and the click target
selector matched the headline bullet "2 are **not proven** yet" instead of a
promise row.

```bash
bash video/scripts/record-session.sh      # the terminal take (real Kane)
node video/scripts/record-browser.mjs <url> /tmp/frames
bash video/scripts/narrate.sh             # narration (needs edge-tts)
pnpm --filter @signedoff/video render     # 1920x1080, 2:33, ~14 min
```

`narrate.sh` measures each narration clip against its scene budget and reports
overruns, which is how two lines got caught running past their cuts. Duration is
read from the MP3 frame headers since there is no ffprobe by default — the first
parser assumed MPEG-1 and under-reported by 2.2×, because edge-tts emits MPEG-2
Layer III at 24 kHz.

## Reproducing the Kane work

Needs a TestMu AI account (`kane-cli login`) and about 250 credits.

```bash
cd demo/bloom-vine-project
signedoff init ./scope.md --client "Sarah Whitmore"     # ~13 min, ~230 credits
signedoff verify --url http://localhost:4311/           # ~15 min first time
signedoff verify --url http://localhost:4311/           # ~3 min, ~11 credits
```

Chrome at a non-standard path needs `KANE_CLI_CHROME_PATH`.

## Honest limitations

- The corroboration check is narrow on purpose: forbidden-presence criteria with a distinctive term in the operand. It is a safety net, not a general theory of wrong assertions.
- Kane anchors a whole use-case to a line range, so the quoted scope text is the *section* a promise came from, not always the exact sentence. Labelled accordingly.
- Sign-offs and bundles are files on disk. Right for a portable artifact and for judging; a hosted deployment would need real storage.
- One of five tests in the demo pack arrived without an `assurance_id`. Handled by a fallback, but it means promise-to-evidence linking is best-effort when Kane omits the id.
- Milestone 2 leaves 5 of 16 promises unchecked: one is genuinely unmeasurable, one test broke, and three criteria had no covering test. The page says so rather than hiding it.

## What I'd build next

Client sign-off rate is the number this thesis lives or dies on — published pages that get accepted, and how fast. Below 30% and the artifact isn't legible to non-technical people. Second-milestone reuse tests the compounding claim; `maintain reconcile` turning scope changes into billable change orders is the retention mechanic worth building next.

---

Licence: MIT. Built with Kiro CLI and Kane CLI.
