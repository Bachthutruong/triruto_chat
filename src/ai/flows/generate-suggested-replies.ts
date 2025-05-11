// This is a server-side file.
'use server';

/**
 * @fileOverview Generates suggested replies based on the latest message in the chat.
 *
 * - generateSuggestedReplies - A function that handles the generation of suggested replies.
 * - GenerateSuggestedRepliesInput - The input type for the generateSuggestedReplies function.
 * - GenerateSuggestedRepliesOutput - The return type for the generateSuggestedReplies function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSuggestedRepliesInputSchema = z.object({
  latestMessage: z.string().describe('The latest message in the chat.'),
});
export type GenerateSuggestedRepliesInput = z.infer<typeof GenerateSuggestedRepliesInputSchema>;

const GenerateSuggestedRepliesOutputSchema = z.object({
  suggestedReplies: z.array(z.string()).describe('An array of suggested replies.'),
});
export type GenerateSuggestedRepliesOutput = z.infer<typeof GenerateSuggestedRepliesOutputSchema>;

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
