// src/ai/schemas/answer-user-question-schemas.ts
/**
 * @fileOverview Schema definitions for the answerUserQuestion flow.
 *
 * - AnswerUserQuestionInputSchema - Zod schema for input.
 * - AnswerUserQuestionInput - TypeScript type for input.
 * - AnswerUserQuestionOutputSchema - Zod schema for output.
 * - AnswerUserQuestionOutput - TypeScript type for output.
 */
import { z } from 'genkit';

export const AnswerUserQuestionInputSchema = z.object({
  question: z.string().describe('The question from the user.'),
  chatHistory: z.string().optional().describe('The chat history of the user.'),
});
export type AnswerUserQuestionInput = z.infer<typeof AnswerUserQuestionInputSchema>;

export const AnswerUserQuestionOutputSchema = z.object({
  answer: z.string().describe('The answer to the user question.'),
});
export type AnswerUserQuestionOutput = z.infer<typeof AnswerUserQuestionOutputSchema>;
