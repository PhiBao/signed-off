/**
 * Narration script, one entry per scene.
 *
 * Each line is written to fit inside its scene with breathing room — roughly
 * 2.5 words per second, targeted at about 80% of the scene length so nothing
 * runs over the cut. `scripts/narrate.sh` renders these to MP3 and reports any
 * clip that overruns its budget.
 */
export const NARRATION = {
  hook:
    "A florist's website. The signed scope said the customer must not be able to choose a Sunday. " +
    'Kane generated a test, and it passed. The storefront was offering three Sundays.',

  falsePass:
    "Here's why. The generated assertion read the select element's value. That value is a date code. " +
    'What a person actually sees is Sunday the twenty-third of August. ' +
    'The word Sunday never appears in the value, so the check went green. ' +
    'But Kane had already recorded the truth, one step earlier. ' +
    'The evidence disproved the verdict it shipped with.',

  problem:
    'This is the moment Signed Off is built for. A freelancer submits a milestone, ' +
    "the client says it doesn't work, and neither of them has proof.",

  init:
    'So it starts from the document the client signed, not the code. Sixteen promises. ' +
    "Which can be proven in a browser, which cannot — Sarah's inbox is out of band, so it says so — " +
    'and seven things the contract never actually settled.',

  verify:
    'Then it checks them against the real build. Real Chrome, real checkout, one sealed evidence pack. ' +
    "Three verdicts, never two: proven, not proven, and couldn't check. " +
    'A timed-out run and a broken checkout are different facts.',

  handover:
    'Sarah opens one link. No account, no install, no test names. Just each thing she asked for. ' +
    "She expands one row and sees the browser's own reading — Sunday the twenty-third, selected — " +
    "sitting next to the page's own promise that Sundays are unavailable. She sends it back.",

  brief:
    'What failed goes to the coding agent. Not a stack trace — the promise, ' +
    'the contract it came from, and what the browser saw. ' +
    'The agent finds it in one line: the code excluded weekday seven, but Sunday is zero.',

  green:
    'Re-check. Passed steps replay from cache, so proving the milestone again cost eleven credits, ' +
    'against roughly a hundred and eighty to author the suite. ' +
    "That's what makes re-proving it after every fix affordable.",

  accept:
    'Sarah accepts, and her signature binds to the exact evidence she saw. ' +
    'Anyone can validate that record without trusting us.',
} as const;
