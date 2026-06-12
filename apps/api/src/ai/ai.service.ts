// @ts-nocheck

import { Injectable, BadRequestException } from '@nestjs/common';
import { google } from '@ai-sdk/google';
import { streamText, tool, CoreMessage } from 'ai';
import { z } from 'zod';
import { SupportService } from '../support/support.service';
import type { RequestContext } from '../common/types';

export interface ChatRequestDto {
  messages: CoreMessage[];
}

@Injectable()
export class AiService {
  constructor(private readonly supportService: SupportService) {}

  async handleChatStream(ctx: RequestContext, messages: CoreMessage[]) {
    if (!messages || messages.length === 0) {
      throw new BadRequestException('Messages cannot be empty');
    }

    try {
      const result = await streamText({
        model: google('gemini-1.5-pro-latest'),
        system: `You are the HMS (Hospital Management System) intelligent assistant.
You help both hospital staff and patients. You have tools available to perform actions.
When a user wants to report an issue, find a bug, or requests support, use the 'createSupportTicket' tool.
Be concise, professional, and helpful.`,
        messages,
        tools: {
          // @ts-ignore
          createSupportTicket: tool({
            description: 'Create a support ticket when the user reports an issue, bug, or requests support.',
            parameters: z.object({
              title: z.string().describe('A short summary of the issue'),
              description: z.string().describe('Detailed description of the issue'),
              priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().describe('Estimated priority'),
            }),
            execute: async ({ title, description, priority }) => {
              if (!ctx.userId) {
                return { success: false, error: 'User must be logged in to create a ticket.' };
              }
              const ticket = await this.supportService.createTicket(ctx, { title, description, priority });
              return { success: true, ticketId: ticket.id, message: 'Support ticket successfully created.' };
            },
          }),
        },
      });

      return result.toTextStreamResponse();
    } catch (error: any) {
      console.error('AI Stream Error:', error);
      throw new BadRequestException(error.message || 'Failed to process AI request');
    }
  }
}
