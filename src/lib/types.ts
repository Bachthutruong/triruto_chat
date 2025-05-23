
// src/lib/types.ts

export type Message = {
  id: string;
  sender: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  name?: string;
  userId?: string;
  updatedAt?: Date;
  conversationId: string;
};

export type AppointmentStatus = 'booked' | 'cancelled' | 'completed' | 'pending_confirmation' | 'rescheduled';

export type AppointmentDetails = {
  appointmentId: string;
  userId: string;
  service: string;
  productId?: string;
  time: string;
  date: string;
  branch?: string;
  branchId?: string;
  packageType?: string;
  priority?: string;
  status: AppointmentStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  staffId?: string;
  staffName?: string;
  customerName?: string;
  customerPhoneNumber?: string;
  recurrenceType?: 'none' | 'daily' | 'weekly' | 'monthly';
  recurrenceCount?: number;
};

export type Product = {
  id: string;
  name: string;
  type: 'session-based' | 'time-based';
  totalSessions?: number;
  usedSessions?: number;
  expiryDate?: Date;
  assignedDate: Date;
};

export type Note = {
  id: string;
  customerId: string;
  staffId: string;
  staffName?: string;
  content: string;
  imageDataUri?: string;
  imageFileName?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UserRole = 'customer' | 'admin' | 'staff';
export type CustomerInteractionStatus = 'unread' | 'read' | 'replied_by_staff';

export type CustomerProfile = {
  id: string;
  phoneNumber: string;
  name?: string;
  internalName?: string;
  conversationIds: string[];
  appointmentIds: string[];
  productIds: string[];
  noteIds: string[];
  tags?: string[];
  assignedStaffId?: string;
  assignedStaffName?: string;
  lastInteractionAt: Date;
  createdAt: Date;
  interactionStatus?: CustomerInteractionStatus;
  lastMessagePreview?: string;
  lastMessageTimestamp?: Date;
  timezone?: string;
  pinnedConversationIds?: string[];
};

export type UserSession = {
  id: string;
  phoneNumber: string;
  role: UserRole;
  name?: string;
  currentConversationId?: string;
  pinnedConversationIds?: string[];
};

export type StaffDetails = {
  userId: string;
  assignedCustomerIds?: string[];
};

export type AdminDetails = {
  userId: string;
};

export type KeywordMapping = {
  id: string;
  keywords: string[];
  response: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TrainingDataStatus = 'pending_review' | 'approved' | 'rejected';
export type TrainingData = {
  id: string;
  userInput: string;
  idealResponse?: string;
  label: string;
  status: TrainingDataStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

export type AppointmentRule = {
  id: string;
  name: string;
  keywords: string[];
  conditions: string;
  aiPromptInstructions: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type SpecificDayRule = {
  id?: string;
  date: string;
  isOff?: boolean;
  workingHours?: string[];
  numberOfStaff?: number;
  serviceDurationMinutes?: number;
};

export type AppSettings = {
  id: string;
  greetingMessage?: string;
  greetingMessageNewCustomer?: string;
  greetingMessageReturningCustomer?: string;
  suggestedQuestions?: string[];
  successfulBookingMessageTemplate?: string;

  brandName?: string;
  logoUrl?: string;
  logoDataUri?: string;
  footerText?: string;

  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  openGraphImageUrl?: string;
  robotsTxtContent?: string;
  sitemapXmlContent?: string;

  numberOfStaff?: number;
  defaultServiceDurationMinutes?: number;
  workingHours?: string[];
  weeklyOffDays?: number[];
  oneTimeOffDates?: string[];
  specificDayRules?: SpecificDayRule[];

  outOfOfficeResponseEnabled?: boolean;
  outOfOfficeMessage?: string;
  officeHoursStart?: string;
  officeHoursEnd?: string;
  officeDays?: number[];

  updatedAt?: Date;
};

export type BranchSpecificDayRule = {
  id?: string;
  date: string;
  isOff?: boolean;
  workingHours?: string[];
  numberOfStaff?: number;
};

export type Branch = {
  id: string;
  name: string;
  address?: string;
  contactInfo?: string;
  isActive: boolean;
  workingHours?: string[];
  offDays?: number[];
  numberOfStaff?: number;
  specificDayOverrides?: BranchSpecificDayRule[];
  createdAt?: Date;
  updatedAt?: Date;
};


export type GetAppointmentsFilters = {
  date?: string;
  dates?: string[];
  customerId?: string;
  staffId?: string;
  status?: string[];
  serviceName?: string;
};

export type AdminDashboardStats = {
  activeUserCount: number;
  chatsTodayCount: number;
  openIssuesCount: number;
  recentAppointments: AppointmentDetails[];
  recentCustomers: Pick<CustomerProfile, 'id' | 'name' | 'phoneNumber' | 'createdAt'>[];
  systemStatus: 'Optimal' | 'Degraded' | 'Error';
};

export type StaffDashboardStats = {
  activeChatsAssignedToMeCount: number;
  myAppointmentsTodayCount: number;
  totalAssignedToMeCount: number;
};

export type ProductSchedulingRules = {
  numberOfStaff?: number;
  serviceDurationMinutes?: number;
  workingHours?: string[];
  weeklyOffDays?: number[];
  oneTimeOffDates?: string[];
  specificDayRules?: SpecificDayRule[];
};

export type ProductItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  isActive: boolean;
  isSchedulable?: boolean;
  schedulingRules?: ProductSchedulingRules;
  createdAt: Date;
  updatedAt: Date;
};

export type ReminderStatus = 'pending' | 'completed' | 'cancelled';
export type ReminderPriority = 'low' | 'medium' | 'high';

export type Reminder = {
  id: string;
  customerId: string;
  staffId: string;
  customerName?: string;
  staffName?: string;
  title: string;
  description: string;
  dueDate: Date;
  status: ReminderStatus;
  priority: ReminderPriority;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type MessageViewerRole = UserRole | 'customer_view';

export type MessageEditState = {
  messageId: string;
  currentContent: string;
} | null;

export type Conversation = {
  id: string;
  customerId: string;
  staffId?: string;
  title?: string;
  participants: Array<{
    userId: string;
    role: UserRole;
    name?: string;
    phoneNumber?: string;
  }>;
  messageIds: string[];
  pinnedMessageIds?: string[];
  isPinned?: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastMessageTimestamp?: Date;
  lastMessagePreview?: string;
};

export type AppointmentBookingFormData = {
  service: string;
  productId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  customerId: string;
  branch?: string;
  branchId?: string;
  notes?: string;
  recurrenceType?: 'none' | 'daily' | 'weekly' | 'monthly';
  recurrenceCount?: number;
};

export type QuickReplyType = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

export type EffectiveSchedulingRules = {
  numberOfStaff: number;
  workingHours: string[];
  weeklyOffDays: number[];
  oneTimeOffDates: string[];
  specificDayRules: SpecificDayRule[];
};
