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
  name: 'answerUserQuestionPromptVietnamese', 
  input: {schema: AnswerUserQuestionInputSchema},
  output: {schema: AnswerUserQuestionOutputSchema},
  prompt: `Bạn là một trợ lý AI hữu ích. Vui lòng trả lời câu hỏi của người dùng bằng tiếng Việt.

{{#if chatHistory}}Đây là lịch sử trò chuyện (tin nhắn mới nhất ở cuối):
{{{chatHistory}}}
{{/if}}

{{#if relevantTrainingData}}
Dưới đây là một số ví dụ về các câu hỏi và câu trả lời tốt có thể liên quan. Hãy xem xét chúng khi bạn trả lời:
{{#each relevantTrainingData}}
Câu hỏi mẫu: {{{userInput}}}
Trả lời mẫu: {{{idealResponse}}}
---
{{/each}}
{{/if}}

{{#if mediaDataUri}}
Người dùng đã gửi một tệp đính kèm.
{{media url=mediaDataUri}}
Hãy xem xét tệp này trong câu trả lời của bạn nếu nó có liên quan đến câu hỏi. Nếu câu hỏi là về tệp, hãy mô tả hoặc phân tích nó.
{{/if}}

Câu hỏi của người dùng: {{{question}}}

Trả lời của bạn (bằng tiếng Việt):`,
});

const answerUserQuestionFlow = ai.defineFlow(
  {
    name: 'answerUserQuestionFlowVietnamese', 
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

