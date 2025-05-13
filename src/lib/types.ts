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
  service: string;
  time: string; // e.g., "3:00 PM" or ISO time part
  date: string; // e.g., "2024-07-15" or ISO date part
  branch?: string;
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

// Represents a customer profile, managed by staff/admin
export type CustomerProfile = {
  id: string; // Unique customer ID (can be same as UserSession.id if they are a direct user)
  phoneNumber: string;
  name?: string; // Name given by customer or set by staff
  internalName?: string; // Name used internally by staff
  chatHistoryIds: string[]; // IDs of messages
  appointmentIds: string[]; // IDs of appointments
  productIds: string[]; // IDs of products
  noteIds: string[]; // IDs of notes
  pinnedMessageIds?: string[]; // IDs of pinned messages
  tags?: string[]; // e.g., "VIP", "Needs Follow-up"
  assignedStaffId?: string; // ID of staff member assigned to this customer
  assignedStaffName?: string; // Name of the assigned staff member
  lastInteractionAt: Date;
  createdAt: Date;
  interactionStatus?: CustomerInteractionStatus;
  lastMessagePreview?: string;
  lastMessageTimestamp?: Date;
};


export type UserSession = {
  id: string; // Unique ID for the session/user
  phoneNumber: string;
  role: UserRole;
  name?: string; // User's display name or staff/admin name
  // Customer-specific data, only populated if role is 'customer'
  chatHistory?: Message[];
  appointments?: AppointmentDetails[];
  products?: Product[];
  notes?: Note[]; // Notes related to this customer if they are the user
  tags?: string[];
};

// For staff-specific data beyond UserSession
export type StaffDetails = {
  userId: string; // links to UserSession.id
  assignedCustomerIds?: string[];
  // other staff specific attributes
};

// For admin-specific data beyond UserSession
export type AdminDetails = {
  userId: string; // links to UserSession.id
  // other admin specific attributes
};

export type KeywordMapping = {
  id: string; // Corresponds to MongoDB _id
  keywords: string[];
  response: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TrainingDataStatus = 'pending_review' | 'approved' | 'rejected';
export type TrainingData = {
  id: string; // Corresponds to MongoDB _id
  userInput: string;
  idealResponse?: string; // Could be AI generated then corrected
  label: string; // e.g., "Needs Assistance", "Service Inquiry"
  status: TrainingDataStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

export type AppointmentRule = {
  id: string; // MongoDB _id
  name: string;
  keywords: string[];
  conditions: string; 
  aiPromptInstructions: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type SpecificDayRule = {
  id: string; // Unique ID for the rule, can be ObjectId string
  date: string; // "YYYY-MM-DD"
  isOff?: boolean;
  workingHours?: string[]; // ["HH:MM", "HH:MM"]
  numberOfStaff?: number;
  serviceDurationMinutes?: number;
};

export type AppSettings = {
  id: string; // For the single document in MongoDB, will be _id
  // Q&A settings
  greetingMessage?: string;
  suggestedQuestions?: string[]; // Stored as an array of strings

  // Interface settings (from AdminSettingsPage)
  brandName?: string;
  logoUrl?: string; // URL for an externally hosted logo
  logoDataUri?: string; // Base64 encoded logo data URI
  footerText?: string;

  // SEO settings (from AdminSettingsPage)
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  openGraphImageUrl?: string;
  robotsTxtContent?: string; 
  sitemapXmlContent?: string; 
  
  // Scheduling Rules
  numberOfStaff?: number;
  defaultServiceDurationMinutes?: number;
  workingHours?: string[]; // Array of "HH:MM" e.g. ["09:00", "10:00", "13:00"]
  weeklyOffDays?: number[]; // Array of numbers [0-6], 0 for Sunday
  oneTimeOffDates?: string[]; // Array of "YYYY-MM-DD"
  specificDayRules?: SpecificDayRule[]; // Array of specific rules for dates

  updatedAt?: Date; 
};

// Type for appointment filters used in getAppointments action
export type GetAppointmentsFilters = {
  date?: string; // YYYY-MM-DD for single date filter
  dates?: string[]; // Array of YYYY-MM-DD for multiple date filter
  customerId?: string;
  staffId?: string;
  status?: string[]; // Array of AppointmentStatus
};


export type AdminDashboardStats = {
  activeUserCount: number;
  chatsTodayCount: number;
  openIssuesCount: number;
  recentAppointments: AppointmentDetails[];
  recentCustomers: Pick<CustomerProfile, 'id' | 'name' | 'phoneNumber' | 'createdAt'>[];
  systemStatus: 'Optimal' | 'Degraded' | 'Error'; // Example system status
};

export type StaffDashboardStats = {
  activeChatsAssignedToMeCount: number;
  myAppointmentsTodayCount: number;
  totalAssignedToMeCount: number;
};

// New types for Products
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

// New types for Reminders
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

// For MessageBubble component to differentiate views
export type MessageViewerRole = UserRole | 'customer_view';

export type MessageEditState = {
  messageId: string;
  currentContent: string;
} | null;
