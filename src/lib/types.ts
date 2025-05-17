
export type Message = {
  id: string;
  sender: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  name?: string; // Optional: display name for sender
  userId?: string; // ID of the actual user who sent (if staff/admin sent as 'ai')
  isPinned?: boolean;
  updatedAt?: Date; // For edited messages
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
  id: string;
  date: string; // "YYYY-MM-DD"
  isOff?: boolean;
  workingHours?: string[]; // ["HH:MM", "HH:MM"]
  numberOfStaff?: number;
  serviceDurationMinutes?: number;
};

export type AppSettings = {
  id: string;
  greetingMessage?: string;
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

  numberOfStaff?: number;
  defaultServiceDurationMinutes?: number;
  workingHours?: string[];
  weeklyOffDays?: number[];
  oneTimeOffDates?: string[];
  specificDayRules?: SpecificDayRule[];

  updatedAt?: Date;
};

export type BranchSpecificDayRule = { // Simplified for now, can be expanded
  id: string;
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
  // Optional: Branch-specific overrides. If not set, global AppSettings are used.
  workingHours?: string[]; // Branch specific working hours ["HH:MM", "HH:MM"]
  offDays?: number[]; // Branch specific weekly off days [0-6]
  numberOfStaff?: number; // Branch specific staff count
  specificDayOverrides?: BranchSpecificDayRule[]; // For holidays or special days for this branch
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
  service: string; // This will be the product name
  productId?: string; // The ID of the selected product
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  customerId: string;
  branch?: string; // Branch name
  branchId?: string; // Branch ID
  notes?: string;
};
