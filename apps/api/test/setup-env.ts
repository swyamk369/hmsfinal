// Jest runs unit tests with a fully-mocked Prisma client, but @hms/db constructs
// PrismaClient instances at import time and requires these env vars to be present.
// Provide harmless placeholders so module import never connects to a real database.
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test?schema=public';
process.env.APP_DATABASE_URL ||= process.env.DATABASE_URL;
process.env.NODE_ENV ||= 'test';
