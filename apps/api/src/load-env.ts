// Loads environment variables BEFORE any module that constructs a Prisma client
// is evaluated. Imported as the very first line of main.ts. apps/api/.env wins;
// the repo-root .env is a fallback (dotenv never overrides already-set vars).
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
