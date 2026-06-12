import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  tool,
  type UIMessage,
} from 'ai';
import { z } from 'zod';
import { platformDb } from '@hms/db';
import { SupportService } from '../support/support.service';
import { FirebaseService } from '../common/firebase.service';
import type { RequestContext } from '../common/types';
import { registerPatientAuthUser } from '../patient-public/patient-auth';

export interface ChatRequestDto {
  messages: UIMessage[];
}

interface AiRequestMeta {
  authorization?: string;
  tenantId?: string;
  currentPath?: string;
}

type AiActor =
  | {
      kind: 'STAFF';
      userId: string;
      tenantId: string | null;
      isPlatform: boolean;
      isSupport: boolean;
      roles: string[];
      modules: string[];
    }
  | {
      kind: 'PATIENT';
      patientAuthUserId: string;
      uid: string;
      email: string | null;
      tenantId: string | null;
    };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HMS_ASSISTANT_SYSTEM_PROMPT = `You are the HMS Assistant for a multi-tenant Hospital Management System SaaS.

Core behavior:
- Help hospital staff, platform support staff, and patients navigate the app and complete work safely.
- Be concise, practical, and calm. Give step-by-step guidance when the user is trying to do a task.
- Never reveal secrets, API keys, internal tokens, database credentials, or protected records.
- Do not diagnose or prescribe. For clinical questions, provide app guidance and tell patients to contact their care team or emergency services when appropriate.
- Respect tenant boundaries. Only discuss the hospital/tenant, role, and module context available to the current user.

HMS staff workflow knowledge:
- Platform: tenant onboarding, tenant status, platform support queue, global health, support operations.
- Admin: dashboard, staff/users, roles, permissions, departments, settings, tenant modules, audit-aware operations.
- Clinical: patient registration, appointments, OPD visits, IPD admissions, vitals, doctor notes, care plans, discharge.
- Diagnostics: lab orders, sample collection, results, published reports, patient documents.
- Pharmacy and inventory: prescriptions, dispensing, stock, purchase/receipt flows, reorder and expiry checks.
- Finance: estimates, invoices, payments, refunds, insurance claims, accounting summaries, reports.
- Operations: queues, notifications, tasks, and cross-module coordination.

Patient experience knowledge:
- Patients can sign in to the patient portal, link hospitals, view dashboard data, book appointments, see bills, prescriptions, documents, lab reports, care team, family members, notifications, settings, and help.
- Patient data belongs to the patient and the selected linked hospital. Do not expose other hospitals, staff-only data, or another patient's details.
- When a patient reports a bug, payment issue, document issue, appointment issue, portal access issue, or confusing workflow, offer to raise a support ticket.

Support ticket behavior:
- If the user reports a bug, internal server error, broken login, stale data, broken workflow, missing record, payment failure, permission problem, or asks for help from support, use createSupportTicket.
- Collect enough detail when possible: affected module, current page, steps to reproduce, expected result, actual result, urgency, screenshots/log snippets if the user mentions them.
- Do not block ticket creation just because some details are missing. Create the ticket with the best available context and ask support to follow up.
- Explain the ticket ID after creation and tell the user that platform support staff will see it in their support queue.

Support Staff Permission Model I Recommend:
- Platform support staff should not have default access to clinical PHI, financial records, prescriptions, lab results, or patient documents.
- By default they can view support tickets, ticket comments, tenant metadata, app health, error context, module names, role/permission summaries, and non-PHI diagnostics.
- For a fix that requires tenant data, support staff should request temporary scoped access from the hospital admin for one tenant, one module or workflow, and a short time window.
- Temporary access must be least-privilege, reason-bound, audit logged, visible to the hospital admin, and automatically revoked after the fix or expiry.
- Emergency break-glass access should be rare, time-limited, audited, require a reason, and notify the hospital admin immediately.
- After support finishes, they should document the fix in the ticket and confirm access revocation.`;

@Injectable()
export class AiService {
  constructor(
    private readonly supportService: SupportService,
    private readonly firebase: FirebaseService,
  ) {}

  async handleChatStream(ctx: RequestContext, messages: UIMessage[], meta: AiRequestMeta = {}) {
    if (!messages || messages.length === 0) {
      throw new BadRequestException('Messages cannot be empty');
    }

    let actor: AiActor;
    try {
      actor = await this.resolveActor(ctx, meta);
    } catch (error: any) {
      console.warn('AI actor resolution failed:', error?.message ?? error);
      return this.staticAssistantResponse(
        'I could not verify your session for the HMS Assistant. Please refresh the page or sign in again, then try your question one more time.',
      );
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return this.staticAssistantResponse(
        'The HMS Assistant needs a Google AI API key before it can answer. Add GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY to apps/api/.env and restart the API.',
      );
    }

    try {
      const modelMessages = await convertToModelMessages(messages);
      const google = createGoogleGenerativeAI({ apiKey });
      const result = await streamText({
        model: google(process.env.GOOGLE_GENERATIVE_AI_MODEL || 'gemini-2.5-flash'),
        system: this.buildSystemPrompt(actor, meta),
        messages: modelMessages,
        timeout: 30_000,
        onError: ({ error }) => {
          console.error('AI provider stream error:', error);
        },
        tools: {
          createSupportTicket: tool({
            description: 'Create a support ticket when the user reports an issue, bug, or requests support.',
            inputSchema: z.object({
              title: z.string().describe('A short summary of the issue'),
              description: z.string().describe('Detailed description of the issue'),
              priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().describe('Estimated priority'),
              affectedModule: z.string().optional().describe('The HMS module or workflow affected'),
              currentPage: z.string().optional().describe('The app page or URL where the issue happened'),
              stepsToReproduce: z.string().optional().describe('Steps that reproduce the issue'),
              expectedResult: z.string().optional().describe('What the user expected to happen'),
              actualResult: z.string().optional().describe('What actually happened'),
              tenantId: z.string().optional().describe('Hospital or tenant ID when known'),
            }),
            execute: async (input) => {
              try {
                const description = this.formatTicketDescription(input, actor, meta);
                const priority = input.priority ?? 'LOW';

                if (actor.kind === 'STAFF') {
                  const ticket = await this.supportService.createTicket(ctx, {
                    title: input.title,
                    description,
                    priority,
                  });
                  return { success: true, ticketId: ticket.id, message: 'Support ticket successfully created.' };
                }

                const tenantId =
                  this.normalizeTenantId(input.tenantId) ?? actor.tenantId ?? this.normalizeTenantId(meta.tenantId);
                const ticket = await platformDb.supportTicket.create({
                  data: {
                    title: input.title,
                    description,
                    priority,
                    tenantId,
                    reporterId: actor.patientAuthUserId,
                    reporterType: 'PATIENT',
                    status: 'OPEN',
                  },
                });

                return { success: true, ticketId: ticket.id, message: 'Support ticket successfully created.' };
              } catch (error: any) {
                console.error('AI support ticket creation failed:', error);
                return {
                  success: false,
                  error: 'The assistant could not create the support ticket. Please try the manual support form.',
                };
              }
            },
          }),
        },
      });

      return result.toUIMessageStreamResponse({
        onError: (error) => {
          console.error('AI UI stream error:', error);
          return 'The HMS Assistant could not reach the AI provider right now. Please try again in a moment. If this is urgent, raise a support ticket from the Support page.';
        },
      });
    } catch (error: any) {
      console.error('AI Stream Error:', error);
      return this.staticAssistantResponse(
        'The HMS Assistant could not process that request right now. Please try again in a moment. If this keeps happening, raise a support ticket from the Support page.',
      );
    }
  }

  private staticAssistantResponse(text: string) {
    const stream = createUIMessageStream({
      execute({ writer }) {
        const id = 'assistant-fallback';
        writer.write({ type: 'text-start', id });
        writer.write({ type: 'text-delta', id, delta: text });
        writer.write({ type: 'text-end', id });
      },
    });

    return createUIMessageStreamResponse({ stream });
  }

  private async resolveActor(ctx: RequestContext, meta: AiRequestMeta): Promise<AiActor> {
    if (ctx?.userId) {
      return {
        kind: 'STAFF',
        userId: ctx.userId,
        tenantId: ctx.tenantId ?? this.normalizeTenantId(meta.tenantId),
        isPlatform: ctx.isPlatform,
        isSupport: ctx.isSupport,
        roles: ctx.roles ?? [],
        modules: Array.from(ctx.modules ?? []),
      };
    }

    if (!meta.authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }

    const verified = await this.firebase.verifyIdToken(meta.authorization.slice(7));
    if (!verified?.uid) {
      throw new UnauthorizedException('Authentication required');
    }

    const patient = await registerPatientAuthUser(verified);
    return {
      kind: 'PATIENT',
      patientAuthUserId: patient.id,
      uid: verified.uid,
      email: patient.email ?? verified.email ?? null,
      tenantId: this.normalizeTenantId(meta.tenantId),
    };
  }

  private buildSystemPrompt(actor: AiActor, meta: AiRequestMeta): string {
    const actorLines =
      actor.kind === 'STAFF'
        ? [
            `Audience: ${actor.isSupport ? 'platform support staff' : actor.isPlatform ? 'platform admin/staff' : 'hospital staff'}`,
            `Tenant context: ${actor.tenantId ?? 'none selected'}`,
            `Roles: ${actor.roles.length ? actor.roles.join(', ') : 'none loaded'}`,
            `Enabled modules: ${actor.modules.length ? actor.modules.join(', ') : 'none loaded'}`,
          ]
        : [
            'Audience: patient portal user',
            `Tenant context: ${actor.tenantId ?? 'none selected'}`,
            `Patient identity: verified Firebase patient session${actor.email ? ' with email on file' : ''}`,
          ];

    return `${HMS_ASSISTANT_SYSTEM_PROMPT}

Current request context:
- ${actorLines.join('\n- ')}
- Current app path: ${meta.currentPath || 'unknown'}

Use this context to tailor answers. If the user needs support, create a ticket in the platform support queue.`;
  }

  private formatTicketDescription(
    input: {
      description: string;
      affectedModule?: string;
      currentPage?: string;
      stepsToReproduce?: string;
      expectedResult?: string;
      actualResult?: string;
    },
    actor: AiActor,
    meta: AiRequestMeta,
  ): string {
    const details = [
      ['Reporter type', actor.kind === 'STAFF' ? 'Hospital/platform staff' : 'Patient portal user'],
      ['Affected module', input.affectedModule],
      ['Current page', input.currentPage || meta.currentPath],
      ['Steps to reproduce', input.stepsToReproduce],
      ['Expected result', input.expectedResult],
      ['Actual result', input.actualResult],
    ].filter(([, value]) => value && String(value).trim().length > 0);

    if (!details.length) return input.description;

    return [
      input.description.trim(),
      '',
      'Support context:',
      ...details.map(([label, value]) => `- ${label}: ${String(value).trim()}`),
    ].join('\n');
  }

  private normalizeTenantId(tenantId?: string | null): string | null {
    const trimmed = tenantId?.trim();
    if (!trimmed || !UUID_RE.test(trimmed)) return null;
    return trimmed;
  }
}
