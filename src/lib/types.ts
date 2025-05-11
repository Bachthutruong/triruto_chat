export type Message = {
  id: string;
  sender: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  name?: string; // Optional: display name for sender
};

export type UserSession = {
  id: string;
  phoneNumber: string;
  name?: string; // Optional: user's name if known
  chatHistory?: Message[];
};

export type AppointmentDetails = {
  service: string;
  time: string;
  date: string;
};
