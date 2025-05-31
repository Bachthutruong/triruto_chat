'use server';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.answerUserQuestion = answerUserQuestion;
/**
 * @fileOverview An AI agent that answers user questions using GPT.
 *
 * - answerUserQuestion - A function that answers user questions.
 * Schemas (AnswerUserQuestionInput, AnswerUserQuestionOutput) are defined in '@/ai/schemas/answer-user-question-schemas.ts'.
 */
const genkit_1 = require("../../ai/genkit");
const answer_user_question_schemas_1 = require("../../ai/schemas/answer-user-question-schemas");
async function answerUserQuestion(input) {
    return answerUserQuestionFlow(input);
}
const answerUserQuestionPrompt = genkit_1.ai.definePrompt({
    name: 'answerUserQuestionPromptVietnamese',
    input: { schema: answer_user_question_schemas_1.AnswerUserQuestionInputSchema },
    output: { schema: answer_user_question_schemas_1.AnswerUserQuestionOutputSchema },
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
const answerUserQuestionFlow = genkit_1.ai.defineFlow({
    name: 'answerUserQuestionFlowVietnamese',
    inputSchema: answer_user_question_schemas_1.AnswerUserQuestionInputSchema,
    outputSchema: answer_user_question_schemas_1.AnswerUserQuestionOutputSchema,
}, async (input) => {
    const { output } = await answerUserQuestionPrompt(input);
    if (!output) {
        return { answer: "Xin lỗi, tôi đang gặp sự cố. Vui lòng thử lại sau." };
    }
    return output;
});
