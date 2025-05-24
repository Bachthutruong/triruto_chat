import { config } from 'dotenv';
config();
import '@/ai/flows/generate-suggested-replies';
import '@/ai/flows/answer-user-question';
import '@/ai/flows/schedule-appointment'; // Ensure this is imported
