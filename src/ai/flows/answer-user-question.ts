'use server';
/**
 * @fileOverview An AI agent that answers user questions using GPT.
 *
 * - answerUserQuestion - A function that answers user questions.
 * - AnswerUserQuestionInput - The input type for the answerUserQuestion function.
 * - AnswerUserQuestionOutput - The return type for the answerUserQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnswerUserQuestionInputSchema = z.object({
  question: z.string().describe('The question from the user.'),
  chatHistory: z.string().optional().describe('The chat history of the user.'),
});
export type AnswerUserQuestionInput = z.infer<typeof AnswerUserQuestionInputSchema>;

const AnswerUserQuestionOutputSchema = z.object({
  answer: z.string().describe('The answer to the user question.'),
});
export type AnswerUserQuestionOutput = z.infer<typeof AnswerUserQuestionOutputSchema>;

export async function answerUserQuestion(input: AnswerUserQuestionInput): Promise<AnswerUserQuestionOutput> {
  return answerUserQuestionFlow(input);
}

const answerUserQuestionPrompt = ai.definePrompt({
  name: 'answerUserQuestionPrompt',
  input: {schema: AnswerUserQuestionInputSchema},
  output: {schema: AnswerUserQuestionOutputSchema},
  prompt: `{{#if chatHistory}}Here is the chat history: {{{chatHistory}}}{{/if}}\n\nQuestion: {{{question}}}\n\nAnswer: `,
});

const answerUserQuestionFlow = ai.defineFlow(
  {
    name: 'answerUserQuestionFlow',
    inputSchema: AnswerUserQuestionInputSchema,
    outputSchema: AnswerUserQuestionOutputSchema,
  },
  async input => {
    const {output} = await answerUserQuestionPrompt(input);
    return output!;
  }
);
