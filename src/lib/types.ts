export type Message = {
  id: string;
  sender: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  name?: string; // Optional: display name for sender
};

export type AppointmentStatus = 'booked' | 'cancelled' | 'completed' | 'pending_confirmation' | 'rescheduled';

export type AppointmentDetails = {
  appointmentId: string;
  userId: string; // Corresponds to UserSession.id
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
  content: string;
  createdBy: string; // userId or staffId
  createdAt: Date;
  isInternal: boolean; // True if it's an internal note not visible to the customer
};

export type UserSession = {
  id: string;
  phoneNumber: string;
  name?: string; // Optional: user's name if known
  chatHistory?: Message[];
  appointments?: AppointmentDetails[]; // List of appointments associated with the user
  products?: Product[]; // List of products/services purchased by the user
  notes?: Note[]; // Internal notes about the user
  tags?: string[]; // e.g., "VIP", "Needs Follow-up"
};
