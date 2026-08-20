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

  document:
    'So it starts from the document the client signed, rather than from the code. ' +
    'Sixteen promises: which can be proven in a browser, which cannot, ' +
    'and what the contract never actually settled.',

  terminal:
    'This is a real session. Signed Off reads the sealed pack from the run that caught the bug, ' +
    "and hands the coding agent the promise, the contract, and what the browser saw. " +
    'The fix was one line — getDay returns zero for Sunday, never seven. ' +
    'Kane then replays the same test against the fixed build, six steps, straight from cache. ' +
    'The milestone is published, and the pack validates.',

  browser:
    "This is what the client opens. No account, no install, no test names. " +
    'She expands one row and sees the delivery field reading Sunday the twenty-third, ' +
    "directly above the page's own promise that Sundays are unavailable.",

  green:
    'Re-proving the milestone cost eleven credits, against roughly a hundred and eighty ' +
    "to author the suite, because passed steps replay from cache. That's what makes " +
    'proving it again after every fix affordable.',

  accept:
    'She accepts, and her signature binds to the exact evidence she saw. ' +
    'Anyone can validate that record without trusting us.',
} as const;
