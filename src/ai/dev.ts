import { config } from 'dotenv';
config();

import '@/ai/flows/generate-suggested-replies.ts';
import '@/ai/flows/answer-user-question.ts';
import '@/ai/flows/schedule-appointment.ts';