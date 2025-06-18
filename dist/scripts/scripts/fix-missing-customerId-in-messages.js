"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var mongoose_1 = require("mongoose");
var Message_model_1 = require("../models/Message.model");
var Conversation_model_1 = require("../models/Conversation.model");
var MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://vuduybachvp:TJ4obGsJleYENZzV@livechat.jcxnz9h.mongodb.net/aetherchat'; // Sửa lại URI nếu cần
function fixMessagesMissingCustomerId() {
    return __awaiter(this, void 0, void 0, function () {
        var messages, updated, _i, messages_1, msgDoc, msg, convDoc, conv;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, mongoose_1.default.connect(MONGODB_URI)];
                case 1:
                    _a.sent();
                    console.log('Connected to MongoDB');
                    return [4 /*yield*/, Message_model_1.default.find({ $or: [{ customerId: null }, { customerId: { $exists: false } }] })];
                case 2:
                    messages = _a.sent();
                    console.log("Found ".concat(messages.length, " messages missing customerId"));
                    updated = 0;
                    _i = 0, messages_1 = messages;
                    _a.label = 3;
                case 3:
                    if (!(_i < messages_1.length)) return [3 /*break*/, 7];
                    msgDoc = messages_1[_i];
                    msg = msgDoc;
                    if (!msg.conversationId) return [3 /*break*/, 6];
                    return [4 /*yield*/, Conversation_model_1.default.findById(msg.conversationId)];
                case 4:
                    convDoc = _a.sent();
                    conv = convDoc;
                    if (!(conv && conv.customerId)) return [3 /*break*/, 6];
                    msg.customerId = conv.customerId;
                    return [4 /*yield*/, msg.save()];
                case 5:
                    _a.sent();
                    updated++;
                    console.log("Updated message ".concat(msg._id, " with customerId ").concat(conv.customerId));
                    _a.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 3];
                case 7:
                    console.log("Done! Updated ".concat(updated, " messages."));
                    process.exit();
                    return [2 /*return*/];
            }
        });
    });
}
fixMessagesMissingCustomerId().catch(function (err) {
    console.error('Error:', err);
    process.exit(1);
});
