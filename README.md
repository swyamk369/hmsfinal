# HMS SaaS Platform

A production-ready Hospital Management System SaaS supporting multi-tenant isolation, role-based workflows, automated billing, and integrated AI capabilities.

## Tech Stack
- **Frontend:** Next.js App Router, React, TypeScript, Tailwind CSS
- **Backend:** NestJS REST API, TypeScript
- **Database:** PostgreSQL + Prisma + Row Level Security (RLS)
- **Auth:** Firebase Auth
- **AI Integration:** Vercel AI SDK + Google Gemini 1.5 Pro

## Key Features
- **Strict Tenant Isolation:** PostgreSQL RLS ensures that no hospital can access another hospital's data.
- **Role-Based Access Control:** Highly configurable permission models enforcing limits dynamically.
- **Integrated AI Chatbot & Support:** A globally accessible AI Assistant that can answer system-related queries and autonomously file support tickets on behalf of the user directly into the platform ticketing system.
- **Comprehensive Modules:** IPD, OPD, Billing, Pharmacy, Inventory, Lab, and Patient Portals.
- **Financial Integrity:** Zero-leakage revenue reconciliation, package billing, auto-accrual.

## Running Locally

1. **Install dependencies:** `pnpm install`
2. **Build database package:** `pnpm --filter @hms/db build`
3. **Database setup:**
   - Ensure PostgreSQL is running.
   - Deploy migrations: `pnpm --filter @hms/db migrate:deploy`
   - Apply RLS: `pnpm --filter @hms/db rls`
   - Seed database: `pnpm --filter @hms/db seed`
4. **Start Dev Servers:** `pnpm dev`
