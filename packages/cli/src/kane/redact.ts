import AdmZip from 'adm-zip';

/**
 * Strip maker-identifying material from a sealed evidence pack.
 *
 * A pack is built for the maker. Its `result.yaml` carries `external_id`, which
 * includes the maker's TestMuAI account email, their org id, and a
 * `sharable_link` containing a share token that grants unauthenticated read
 * access to the run in TestMuAI's dashboard. None of that is the client's
 * business, and a share token is a credential.
 *
 * The handover page never renders any of it — `projection.ts` allowlists what
 * reaches the client. But `publish --include-pack` offers the pack file itself
 * for download, and that bypassed the allowlist entirely.
 *
 * Redacting these fields leaves the pack valid: `evidence validate --profile L1`
 * checks the test definition hash and that claimed statuses agree with the
 * captured artifacts, none of which depends on who ran it. Verified against a
 * real pack — a redacted copy still reports
 * `{"valid":true,"status":"finalized","diagnostics":[]}`.
 */

/** Fields removed from `result.yaml`. Identity, not evidence. */
const REDACTED_FIELDS = ['user_name', 'user_email', 'org_id', 'sharable_link'] as const;

export interface RedactionReport {
  readonly fieldsRedacted: number;
  readonly filesTouched: number;
}

/**
 * Write a redacted copy of `source` to `destination`.
 * Every other entry is copied byte for byte.
 */
export function redactPack(source: string, destination: string): RedactionReport {
  const input = new AdmZip(source);
  const output = new AdmZip();

  let fieldsRedacted = 0;
  let filesTouched = 0;

  for (const entry of input.getEntries()) {
    if (entry.isDirectory) continue;
    const data = entry.getData();

    if (!entry.entryName.endsWith('result.yaml')) {
      output.addFile(entry.entryName, data);
      continue;
    }

    let text = data.toString('utf8');
    let touched = false;
    for (const field of REDACTED_FIELDS) {
      // Anchored to the line so a value containing the field name is untouched.
      const pattern = new RegExp(`^(\\s*)${field}:[ \\t]*.*$`, 'gm');
      const replaced = text.replace(pattern, `$1${field}: REDACTED`);
      if (replaced !== text) {
        fieldsRedacted += 1;
        touched = true;
        text = replaced;
      }
    }
    if (touched) filesTouched += 1;
    output.addFile(entry.entryName, Buffer.from(text, 'utf8'));
  }

  output.writeZip(destination);
  return { fieldsRedacted, filesTouched };
}
