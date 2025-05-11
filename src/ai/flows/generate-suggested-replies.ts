// This is a server-side file.
'use server';

/**
 * @fileOverview Generates suggested replies based on the latest message in the chat.
 *
 * - generateSuggestedReplies - A function that handles the generation of suggested replies.
 * Schemas (GenerateSuggestedRepliesInput, GenerateSuggestedRepliesOutput) are defined in '@/ai/schemas/generate-suggested-replies-schemas.ts'.
 */

import {ai} from '@/ai/genkit';
import {
    GenerateSuggestedRepliesInputSchema,
    type GenerateSuggestedRepliesInput,
    GenerateSuggestedRepliesOutputSchema,
    type GenerateSuggestedRepliesOutput
} from '@/ai/schemas/generate-suggested-replies-schemas';

export async function generateSuggestedReplies(input: GenerateSuggestedRepliesInput): Promise<GenerateSuggestedRepliesOutput> {
  return generateSuggestedRepliesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSuggestedRepliesPrompt',
  input: {schema: GenerateSuggestedRepliesInputSchema},
  output: {schema: GenerateSuggestedRepliesOutputSchema},
  prompt: `You are a chatbot assistant helping users by providing suggested replies to the latest message in the chat.

  Generate three suggested replies to the following message:

  {{latestMessage}}

  The suggested replies should be short and relevant to the message.
  Ensure suggested replies are diverse and cover different aspects of the message.
  Consider the user's intent and generate replies that would help them achieve their goals.
  Do not include greeting or closing remarks in the suggested replies.
  Use a list format for the suggested replies.
  `,
});

const generateSuggestedRepliesFlow = ai.defineFlow(
  {
    name: 'generateSuggestedRepliesFlow',
    inputSchema: GenerateSuggestedRepliesInputSchema,
    outputSchema: GenerateSuggestedRepliesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
