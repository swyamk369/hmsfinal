import * as fs from 'fs';
import * as path from 'path';

// The product contract forbids any dev-auth / fake-login mechanism in the web app.
// Firebase is the only authentication path.
const FORBIDDEN: RegExp[] = [/x-dev-user/i, /x-dev-platform/i, /x-dev-tenant/i, /dev-auth/i, /devauth/i, /impersonat/i];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

describe('no dev-auth in the web app', () => {
  it('contains no dev-auth / impersonation strings', () => {
    const srcDir = path.resolve(__dirname, '..', 'src');
    const offenders: string[] = [];
    for (const file of walk(srcDir)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const re of FORBIDDEN) {
        if (re.test(text)) offenders.push(`${path.relative(srcDir, file)} :: ${re}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
