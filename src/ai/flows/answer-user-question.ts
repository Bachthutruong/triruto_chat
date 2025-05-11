'use server';
/**
 * @fileOverview An AI agent that answers user questions using GPT.
 *
 * - answerUserQuestion - A function that answers user questions.
 * Schemas (AnswerUserQuestionInput, AnswerUserQuestionOutput) are defined in '@/ai/schemas/answer-user-question-schemas.ts'.
 */

import {ai} from '@/ai/genkit';
import {
    AnswerUserQuestionInputSchema,
    type AnswerUserQuestionInput,
    AnswerUserQuestionOutputSchema,
    type AnswerUserQuestionOutput
} from '@/ai/schemas/answer-user-question-schemas';

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
