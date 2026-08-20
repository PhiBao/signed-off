# Submission — Kane CLI Online Hackathon

Copy-paste answers for [the form](https://www.surveymonkey.com/r/kane-cli-hackathon-submission).

## GitHub repo

https://github.com/PhiBao/signed-off

Public. Initialized 19 August 2026; all commits dated within the event.

## Live URL / runnable command

```bash
git clone https://github.com/PhiBao/signed-off && cd signed-off
pnpm install
pnpm demo
```

Prints three links. Measured at 15 seconds from a clean checkout, 5 seconds on
repeat runs. **Needs no TestMu AI account and no Kane credits** — the evidence was
sealed by real Kane runs during the build and is committed to the repo, so the
handover pages render from sealed packs.

The first link is the milestone before the bug was fixed (9 of 16 proven, 2 not
proven). The second is after the coding agent fixed it (11 of 16, 0 not proven).

## Demo video

**2:33.** YouTube — **unlisted**, link tested in a private window.

Two of the eight scenes are genuine screen recordings rather than composed cards:
36s of a real Kane session captured with asciinema over an actual pty, and 20s of
the real handover page captured through Chrome DevTools screencast. Every number
and every line of output on screen came from a real run.

## One paragraph

> **Signed Off** turns the scope a client signed into a page that client can read,
> showing each thing they asked for demonstrated in a real browser — including
> what couldn't be proven and why. It's for freelance web developers and small
> studios who submit fixed-price milestones and then argue with a non-technical
> client about whether the work is done; the buyer is the developer, but the
> artifact is built for the person holding the money. I built it with Kiro CLI.
> Kane does three jobs: `context ingest` and `design tests` turn the signed scope
> document into acceptance criteria and one test per scenario, with every criterion
> cited back to the line of the contract it came from; `testrun` executes them in
> real Chrome and seals a single evidence pack; and `evidence validate --profile L1`
> lets the client — or an arbitrator — confirm the record independently, without
> trusting me. The part worth watching: Kane's own generated suite went **green** on
> a genuine bug (the assertion compared a `<select>`'s value, `2026-08-23`, when
> what a person sees is `Sunday 23 August`), while Kane's own evidence had already
> recorded `selectedText: "Sunday 23 August"`. So Signed Off cross-checks every
> passing promise against what the browser actually observed and reported it **not
> proven**. The loop then closes for real: `signedoff brief` hands the failure to
> the coding agent, the agent fixes one line, and re-verifying costs 10.9 credits
> because passed steps replay from cache.

## Which agent

Kiro CLI — used for the whole build, and it is also the agent on the receiving end
of `signedoff brief` in the closed-loop demo.

## What Kane is doing in the flow

| Kane command | Role in the product |
|---|---|
| `context ingest` / `context review` | snapshot the signed scope, extract use-cases with claims cited to source lines |
| `design tests` | acceptance criteria, scenarios, one `_test.md` per scenario — and the gaps the document never settled |
| `testrun run --from-context` | run the suite as one execution, seal one evidence pack |
| `evidence validate --profile L1` | gate before publishing; also how the client checks the record themselves |
| `config set-assertion-mode visual` | forced by Signed Off, so assertions check what a person can see |

## Eligibility

- TestMu AI account: `kiter2509`
- Kane CLI has been run extensively — roughly 600 credits consumed across
  extraction, design, and eight suite executions.
- Repo initialized 19 August 2026.

## For the judges

- `pnpm test` — 22 tests, run against real committed Kane output (two assurance
  graphs and one sealed evidence pack).
- `pnpm typecheck` — TypeScript `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`.
- The false-pass evidence pack is committed at
  `packages/cli/test-fixtures/packs/sunday-false-pass.evidence` if you want to
  validate it yourself.
- Reproducing the Kane work needs `kane-cli login` and ~250 credits; see the
  README section "Reproducing the Kane work".

## Which lane

**Requirements that test themselves.**

It matches that lane's description almost line by line: start from the document
rather than the app, cite every claim back to the source, design acceptance
criteria then scenarios then one test each as committable `_test.md` files, and
measure coverage against acceptance criteria instead of test counts. Signed Off
adds the part the lane does not mention — turning that coverage into an artifact
the person paying can read and sign.
