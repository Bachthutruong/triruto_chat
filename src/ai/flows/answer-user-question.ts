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
  name: 'answerUserQuestionPromptVietnamese', // Changed name to reflect language
  input: {schema: AnswerUserQuestionInputSchema},
  output: {schema: AnswerUserQuestionOutputSchema},
  prompt: `Bạn là một trợ lý AI hữu ích. Vui lòng trả lời câu hỏi của người dùng bằng tiếng Việt.
{{#if chatHistory}}Đây là lịch sử trò chuyện: {{{chatHistory}}}{{/if}}

Câu hỏi: {{{question}}}

Trả lời: `,
});

const answerUserQuestionFlow = ai.defineFlow(
  {
    name: 'answerUserQuestionFlowVietnamese', // Changed name
    inputSchema: AnswerUserQuestionInputSchema,
    outputSchema: AnswerUserQuestionOutputSchema,
  },
  async input => {
    const {output} = await answerUserQuestionPrompt(input);
    if (!output) {
      return { answer: "Xin lỗi, tôi đang gặp sự cố. Vui lòng thử lại sau." };
    }
    return output;
  }
);

