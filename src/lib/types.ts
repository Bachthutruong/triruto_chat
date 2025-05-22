
export type Message = {
  id: string;
  sender: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  name?: string; // Optional: display name for sender
  userId?: string; // ID of the actual user who sent (if staff/admin sent as 'ai')
  isPinned?: boolean;
  updatedAt?: Date; // For edited messages
  conversationId?: string; // To associate message with a conversation for Socket.IO
};

export type AppointmentStatus = 'booked' | 'cancelled' | 'completed' | 'pending_confirmation' | 'rescheduled';

export type AppointmentDetails = {
  appointmentId: string;
  userId: string; // Corresponds to UserSession.id or Customer.id
  service: string; // Service name
  productId?: string; // Optional: ID of the product/service if selected from list
  time: string; // e.g., "3:00 PM" or ISO time part
  date: string; // e.g., "2024-07-15" or ISO date part
  branch?: string; // Branch name
  branchId?: string; // Optional: ID of the branch
  packageType?: string; // Optional: e.g., "Standard", "Premium"
  priority?: string; // Optional: e.g., "High", "Normal"
  status: AppointmentStatus;
  notes?: string; // Optional notes for the appointment
  createdAt: Date;
  updatedAt: Date;
  staffId?: string; // Staff member who handled/created the appointment
  staffName?: string;
  customerName?: string;
  customerPhoneNumber?: string;
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
  staffName?: string; // Name of the staff who created/last edited
  content: string;
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
  pinnedMessageIds?: string[];
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
  messagePinningAllowedConversationIds?: string[];
};

export type UserSession = {
  id: string;
  phoneNumber: string;
  role: UserRole;
  name?: string;
  currentConversationId?: string;
  pinnedConversationIds?: string[];
  messagePinningAllowedConversationIds?: string[];
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
  id?: string; // Optional for client-side temporary ID before saving
  date: string; // "YYYY-MM-DD"
  isOff?: boolean;
  workingHours?: string[]; // ["HH:MM", "HH:MM"]
  numberOfStaff?: number;
  serviceDurationMinutes?: number;
};

export type AppSettings = {
  id: string;
  greetingMessage?: string; // General greeting
  greetingMessageNewCustomer?: string; // Greeting for new customers
  greetingMessageReturningCustomer?: string; // Greeting for returning customers
  suggestedQuestions?: string[];

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

  // Scheduling Rules
  numberOfStaff?: number;
  defaultServiceDurationMinutes?: number;
  workingHours?: string[]; // General working hours
  weeklyOffDays?: number[]; // General weekly off days
  oneTimeOffDates?: string[]; // General one-time off dates
  specificDayRules?: SpecificDayRule[]; // General specific day rules

  // Out-of-Office Settings
  outOfOfficeResponseEnabled?: boolean;
  outOfOfficeMessage?: string;
  officeHoursStart?: string; // e.g., "09:00"
  officeHoursEnd?: string; // e.g., "17:00"
  officeDays?: number[]; // [1,2,3,4,5] for Mon-Fri

  updatedAt?: Date;
};

export type BranchSpecificDayRule = {
  id?: string; // Optional for client-side temporary ID
  date: string; // "YYYY-MM-DD"
  isOff?: boolean;
  workingHours?: string[]; // If different from branch's main workingHours
  numberOfStaff?: number; // If different from branch's main staff count
};

export type Branch = {
  id: string;
  name: string;
  address?: string;
  contactInfo?: string; // e.g., phone number, email for the branch
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

export type ProductItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Removed isSchedulable and schedulingRules
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
  productId?: string; 
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  customerId: string;
  branch?: string; 
  branchId?: string; 
  notes?: string;
};

export type QuickReplyType = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};
