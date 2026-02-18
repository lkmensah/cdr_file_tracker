'use server';

/**
 * @fileOverview A flow to suggest existing files based on provided metadata.
 *
 * - suggestExistingFiles - A function that takes correspondence metadata and suggests existing files.
 * - SuggestExistingFilesInput - The input type for the suggestExistingFiles function.
 * - SuggestExistingFilesOutput - The return type for the suggestExistingFiles function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestExistingFilesInputSchema = z.object({
  date: z.string().describe('The date of the correspondence.'),
  fileNumber: z.string().describe('The file number of the correspondence.'),
  suitNumber: z.string().describe('The suit number of the correspondence.'),
  subject: z.string().describe('The subject of the correspondence.'),
  movementLog: z.string().describe('The movement log of the correspondence.'),
  documentNo: z.string().describe('The document number of the correspondence.'),
  remarks: z.string().describe('Any remarks about the correspondence.'),
});
export type SuggestExistingFilesInput = z.infer<typeof SuggestExistingFilesInputSchema>;

const SuggestExistingFilesOutputSchema = z.array(
  z.object({
    fileNumber: z.string().describe('The file number of the suggested file.'),
    suitNumber: z.string().describe('The suit number of the suggested file.'),
    subject: z.string().describe('The subject of the suggested file.'),
  })
).describe('A list of suggested files based on the provided metadata.');
export type SuggestExistingFilesOutput = z.infer<typeof SuggestExistingFilesOutputSchema>;

export async function suggestExistingFiles(input: SuggestExistingFilesInput): Promise<SuggestExistingFilesOutput> {
  return suggestExistingFilesFlow(input);
}

const suggestExistingFilesPrompt = ai.definePrompt({
  name: 'suggestExistingFilesPrompt',
  input: {schema: SuggestExistingFilesInputSchema},
  output: {schema: SuggestExistingFilesOutputSchema},
  prompt: `Suggest existing files based on the following correspondence metadata, returning an array of file suggestions:

Date: {{{date}}}
File Number: {{{fileNumber}}}
Suit Number: {{{suitNumber}}}
Subject: {{{subject}}}
Movement Log: {{{movementLog}}}
Document No: {{{documentNo}}}
Remarks: {{{remarks}}}

Consider the relevance of each metadata field when suggesting files.  Focus on files with matching suit numbers or subjects.

Return an array of JSON objects, each with fileNumber, suitNumber, and subject fields.
`,
});

const suggestExistingFilesFlow = ai.defineFlow(
  {
    name: 'suggestExistingFilesFlow',
    inputSchema: SuggestExistingFilesInputSchema,
    outputSchema: SuggestExistingFilesOutputSchema,
  },
  async input => {
    const {output} = await suggestExistingFilesPrompt(input);
    return output!;
  }
);
