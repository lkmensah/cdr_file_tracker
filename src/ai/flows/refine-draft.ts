
'use server';

/**
 * @fileOverview AI flow to refine legal drafts.
 * 
 * - refineDraft - Main entry point for draft refinement.
 * - RefineDraftInput - Schema for refinement instructions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const RefineDraftInputSchema = z.object({
  content: z.string().describe('The legal draft content to refine (may include HTML tags).'),
  instruction: z.string().describe('Instructions like "make more formal", "make concise", etc.'),
});

const RefineDraftOutputSchema = z.object({
  refinedContent: z.string().describe('The improved version of the text, maintaining HTML structure if provided.'),
});

export type RefineDraftInput = z.infer<typeof RefineDraftInputSchema>;
export type RefineDraftOutput = z.infer<typeof RefineDraftOutputSchema>;

export async function refineDraft(input: RefineDraftInput): Promise<RefineDraftOutput> {
  return refineDraftFlow(input);
}

const prompt = ai.definePrompt({
  name: 'refineDraftPrompt',
  input: { schema: RefineDraftInputSchema },
  output: { schema: RefineDraftOutputSchema },
  prompt: `You are a senior legal editor assisting an attorney. 
  
  Refine the following draft content according to this instruction: "{{{instruction}}}"
  
  Original Content:
  """
  {{{content}}}
  """
  
  IMPORTANT: The content may contain HTML tags (like <strong>, <em>, <u>, <ul>, <li>). 
  You MUST preserve this HTML structure in your output while refining the language. 
  Ensure the output remains legally accurate, maintains a professional tone, and adheres to the specific formatting requested. 
  Only return the refined HTML content without any conversational preamble.`,
});

const refineDraftFlow = ai.defineFlow(
  {
    name: 'refineDraftFlow',
    inputSchema: RefineDraftInputSchema,
    outputSchema: RefineDraftOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
