#!/usr/bin/env bash
#
# The session recorded for the demo video.
#
# Everything runs for real against real Kane and the real storefront. Every
# command is chosen to be deterministic, because re-authoring a Kane suite from
# scratch proved unreliable on this machine and a demo take should not gamble:
#
#   * `brief --pack` reads the sealed pack from the run that actually caught the
#     bug. The record is immutable, so it stays readable after the fix landed.
#   * `testmd run` replays the Sunday test from cache — genuine Kane, real
#     Chrome, six steps, about twenty seconds.
#   * `publish` builds the client's page from the sealed pack.
#   * `evidence validate` proves the artifact without trusting us.
#
# Recorded with asciinema, which captures the actual pty.

set -uo pipefail

export PATH="$HOME/.local/node/bin:$PATH"
export KANE_CLI_CHROME_PATH="$HOME/.local/bin/google-chrome"

# No pagers. A pager inside a recorded session stops on (END) and waits for a
# keypress that is never coming — which is exactly how the first take died.
export GIT_PAGER=cat
export PAGER=cat
export LESS=FRX

SIGNEDOFF=/home/kiter/kane/packages/cli/bin/signedoff.mjs
RED_PACK=.testmuai/evidence/39691de6-b770-4388-8467-e94b1ef74004.evidence
SUNDAY_TEST=.testmuai/tests/guest-checkout-does-not-allow-sunday-as-the-selected_test.md
DELIVERY=/home/kiter/kane/fixtures/bloom-vine/lib/delivery.ts

cd /tmp/e2e

say() { printf '\n\033[38;5;108m# %s\033[0m\n\n' "$1"; sleep 1.3; }

# stdin from /dev/null, always. kane-cli finishes `testmd run` with an
# interactive "View evidence in browser? (y/N)" prompt, and inside a recorded
# session the pty IS a real TTY — so an earlier take sat on that prompt until it
# was killed. Non-TTY stdin also switches Kane to structured NDJSON output,
# which is the honest thing to show anyway.
run() { printf '\033[38;5;108m$\033[0m %s\n' "$*"; "$@" < /dev/null; }

clear
say "The client signed a scope. One line said: no Sunday deliveries."
run grep -n -A1 "must not be able to choose a Sunday" ./scope.md
sleep 2.4

say "Kane's suite reported 4 of 5 tests passing and 0 failed."
say "Signed Off read the same evidence and refused to sign it off."
run node "$SIGNEDOFF" brief --pack "$RED_PACK"
sleep 4

say "That brief went to the coding agent. The fix was one line."
run grep -n 'NON_DELIVERY_WEEKDAYS = new Set' "$DELIVERY"
printf '\n\033[38;5;108m# getDay() returns 0 for Sunday, never 7.\033[0m\n'
sleep 2.4

say "Ask Kane the same question again, against the fixed build."
run kane-cli testmd run "$SUNDAY_TEST" --headless
sleep 3

say "Publish the milestone for the client."
run node "$SIGNEDOFF" publish --milestone 2 --web-root /home/kiter/kane/packages/web
sleep 3

say "And the client can check the record without trusting us."
run kane-cli evidence validate "$RED_PACK" --profile L1 --json
sleep 3.5
