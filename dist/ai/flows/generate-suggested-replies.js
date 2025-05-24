// This is a server-side file.
'use server';
/**
 * @fileOverview Generates suggested replies based on the latest message in the chat.
 *
 * - generateSuggestedReplies - A function that handles the generation of suggested replies.
 * Schemas (GenerateSuggestedRepliesInput, GenerateSuggestedRepliesOutput) are defined in '@/ai/schemas/generate-suggested-replies-schemas.ts'.
 */
import { ai } from '@/ai/genkit';
import { GenerateSuggestedRepliesInputSchema, GenerateSuggestedRepliesOutputSchema } from '@/ai/schemas/generate-suggested-replies-schemas';
export async function generateSuggestedReplies(input) {
    return generateSuggestedRepliesFlow(input);
}
const prompt = ai.definePrompt({
    name: 'generateSuggestedRepliesPromptVietnamese', // Changed name
    input: { schema: GenerateSuggestedRepliesInputSchema },
    output: { schema: GenerateSuggestedRepliesOutputSchema },
    prompt: `Bạn là một trợ lý chatbot giúp người dùng bằng cách cung cấp các câu trả lời gợi ý cho tin nhắn mới nhất trong cuộc trò chuyện.

  Tạo ba câu trả lời gợi ý bằng tiếng Việt cho tin nhắn sau:

  {{latestMessage}}

  Các câu trả lời gợi ý nên ngắn gọn và liên quan đến tin nhắn.
  Đảm bảo các câu trả lời gợi ý đa dạng và bao gồm các khía cạnh khác nhau của tin nhắn.
  Xem xét ý định của người dùng và tạo ra các câu trả lời giúp họ đạt được mục tiêu.
  Không bao gồm lời chào hoặc lời kết trong các câu trả lời gợi ý.
  Sử dụng định dạng danh sách cho các câu trả lời gợi ý.
  `,
});
const generateSuggestedRepliesFlow = ai.defineFlow({
    name: 'generateSuggestedRepliesFlowVietnamese', // Changed name
    inputSchema: GenerateSuggestedRepliesInputSchema,
    outputSchema: GenerateSuggestedRepliesOutputSchema,
}, async (input) => {
    const { output } = await prompt(input);
    if (!output || !output.suggestedReplies) {
        return { suggestedReplies: ["Tôi có thể giúp gì khác?", "Cảm ơn bạn!", "Bạn muốn biết thêm về điều gì?"] };
    }
    return output;
});
