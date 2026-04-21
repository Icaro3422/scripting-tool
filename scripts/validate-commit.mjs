import { readFileSync } from 'fs';

/**
 * Validates the commit message structure.
 * Expected sections:
 * - Summary
 * - Changes
 * - Security & Quality
 * - Related Tickets
 */

const commitMsgFile = process.argv[2];
if (!commitMsgFile) {
  console.error('\x1b[31mError: No commit message file provided.\x1b[0m');
  process.exit(1);
}

try {
  const commitMsg = readFileSync(commitMsgFile, 'utf8');

  // Skip validation for merge commits or empty messages
  if (commitMsg.startsWith('Merge branch') || commitMsg.trim() === '') {
    process.exit(0);
  }

  const requiredHeaders = [
    'Summary',
    'Changes',
    'Security & Quality',
    'Related Tickets'
  ];

  const missingHeaders = requiredHeaders.filter(header => {
    // Check if the header exists at the start of a line (case insensitive)
    const regex = new RegExp(`^${header}`, 'im');
    return !regex.test(commitMsg);
  });

  if (missingHeaders.length > 0) {
    console.error('\n\x1b[41m\x1b[37m COMMIT REJECTED \x1b[0m');
    console.error('\x1b[31mInvalid commit message structure.\x1b[0m');
    console.error('\x1b[33mMissing required sections: \x1b[1m' + missingHeaders.join(', ') + '\x1b[0m');
    console.error('\n\x1b[1mRequired Format:\x1b[0m');
    console.error('-------------------------------------------');
    console.error('\x1b[32mSummary\x1b[0m\n[Brief description of the work]\n');
    console.error('\x1b[32mChanges\x1b[0m\n- [Detailed list of changes]\n');
    console.error('\x1b[32mSecurity & Quality\x1b[0m\n[Security impacts and quality measures]\n');
    console.error('\x1b[32mRelated Tickets\x1b[0m\n[Ticket references or "None"]');
    console.error('-------------------------------------------\n');
    process.exit(1);
  }

  process.exit(0);
} catch (error) {
  console.error('\x1b[31mError reading commit message file:\x1b[0m', error.message);
  process.exit(1);
}
