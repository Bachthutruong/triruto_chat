"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
require("../ai/flows/generate-suggested-replies");
require("../ai/flows/answer-user-question");
require("../ai/flows/schedule-appointment"); // Ensure this is imported
