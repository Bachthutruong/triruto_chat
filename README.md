# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Setup

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Set up MongoDB:**
    This application requires a MongoDB database. You can:
    *   Install MongoDB locally (e.g., from [MongoDB Community Server](https://www.mongodb.com/try/download/community)).
    *   Use a cloud-hosted MongoDB service like [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) (which offers a free tier).

    Once your MongoDB instance is set up and running, you will need its connection string (URI).

3.  **Set up Environment Variables:**
    Create a `.env` file in the root of your project (if it doesn't already exist). Add the following environment variables:

    ```env
    # For Google AI (Genkit)
    GOOGLE_API_KEY=YOUR_GOOGLE_AI_API_KEY_HERE

    # For MongoDB connection
    # Replace with your actual MongoDB connection string.
    #
    # Example for a local MongoDB instance running on the default port 27017,
    # connecting to a database named 'aetherchat':
    # MONGODB_URI=mongodb://127.0.0.1:27017/aetherchat
    #
    # Example for a MongoDB Atlas cluster:
    # MONGODB_URI=mongodb+srv://<your_username>:<your_password>@<your_cluster_address>/aetherchat?retryWrites=true&w=majority
    # (Replace <your_username>, <your_password>, and <your_cluster_address> with your actual Atlas credentials and cluster URI parts.
    #  'aetherchat' can be your desired database name.)
    MONGODB_URI=YOUR_MONGODB_CONNECTION_STRING_HERE
    ```
    *   You can obtain a Google AI API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
    *   For `MONGODB_URI`:
        *   If using a local MongoDB, `mongodb://127.0.0.1:27017/aetherchat` is a common format. Ensure your MongoDB server is running.
        *   If using MongoDB Atlas, copy the connection string provided by Atlas for your application. Make sure to replace placeholders like `<username>`, `<password>`, and ensure your IP address is whitelisted in Atlas network access settings if necessary.

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

5.  **Run the Genkit development server (in a separate terminal):**
    ```bash
    npm run genkit:dev
    ```
    Or, if you want Genkit to watch for changes:
    ```bash
    npm run genkit:watch
    ```

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.
The Genkit developer UI will be available at [http://localhost:4000](http://localhost:4000).

**Important:**
*   Ensure your MongoDB server is running and accessible from your application environment before starting the Next.js application.
*   If the `MONGODB_URI` is not set correctly, or if the MongoDB server is not reachable, the application will fail to connect to the database and will not function properly. You might see errors like `ECONNREFUSED` in the console.

## Features

The application includes the following features as per the requirements:

### I. GIAO TIẾP TRỰC TUYẾN & NHẬN DIỆN KHÁCH (Online Communication & Customer Identification)
1.  **Phone Number Input:**
    *   New number: Creates a new customer profile.
    *   Existing number: Retrieves and displays chat history, assigned products, appointments, and notes.
2.  **Chat Interface:**
    *   Initial greeting + suggested questions.
    *   Customer interaction:
        *   If a suggestion is chosen → provides a corresponding pre-defined answer.
        *   If a question is typed:
            *   If keywords match → displays a pre-defined answer.
            *   If no match → sends to GPT for processing.
            *   If untrained keywords are present → tags as "Needs Assistance" and escalates to staff.

### II. ĐẶT LỊCH HẸN (Appointment Scheduling)
1.  **Chat → GPT for Booking:**
    *   Identifies: service, time, package type, branch, priority, etc.
    *   Response:
        *   If slot available → Confirms and creates the appointment.
        *   If slot busy → Suggests alternative times.
    *   Saves appointment: Records in the database and displays on staff/admin interface.
2.  **Cancel / Reschedule:**
    *   Customer types "Cancel" or "Reschedule" → GPT recognizes → Suggests actions → Saves changes.
    *   Staff can manually create/delete appointments.
3.  **View Appointments:**
    *   Filter by date/customer name/phone number.
    *   Defaults to displaying today's appointments.

### III. QUẢN TRỊ CÂU HỎI – TRẢ LỜI (Question-Answer Management)
1.  **Automated Responses:**
    *   Question → Matches against keyword table → pre-defined response.
    *   No match → GPT answers → Saves content → Assigns training label.
2.  **Training (Admin Interface):**
    *   Review poorly answered questions.
    *   Assign training labels / Add to sample dataset.

### IV. PHÂN QUYỀN NHÂN SỰ (Staff Authorization & Assignment)
1.  **Customer Assignment:**
    *   Unassigned customer → visible to all staff.
    *   Staff clicks to open tab → customer assigned to that staff member.
    *   Other staff no longer see this customer.
    *   Staff can open multiple tabs for concurrent chats; tabs auto-close after 5 minutes of inactivity.
2.  **Change Responsible Person:**
    *   Staff offline or closes tab → customer returns to the general queue.
    *   Admin can assign customers to specific staff.
3.  **Tracking Labels:**
    *   Assign labels like "follow-up", "VIP", "premium package" → aids in list filtering.

### V. LIVE CHAT & GHI CHÚ (Live Chat & Notes)
1.  **Message Handling:**
    *   See what the customer is typing in real-time (if feasible).
    *   Send/recall/edit messages.
    *   Pin up to 3 messages.
    *   Send images + drag & drop files.
2.  **Internal Notes:**
    *   Text + image notes.
    *   Timestamped with creator's ID.
    *   Other staff can view/edit.
3.  **Find Chat Segments:**
    *   Search by customer name/phone number.
    *   Chat history (contact list).
4.  **File/Image History:**
    *   Centralized list of sent images and files, viewable (similar to Zalo).

### VI. QUẢN LÝ SẢN PHẨM / DỊCH VỤ (Product/Service Management)
1.  **Assign Products:**
    *   Select from product list.
    *   Enter number of sessions or usage duration.
    *   Can auto-recognize product from an image of a receipt → confirm → assign.
2.  **Display Progress:**
    *   Session-based service → "3/10 sessions remaining".
    *   Time-based → "12 days remaining".
3.  **Record Session Usage:**
    *   End of day: if appointment not cancelled → automatically marked as used.
    *   Manual editing possible.

### VII. TẦN SUẤT & NHẮC CHĂM SÓC (Visit Frequency & Care Reminders)
1.  **Visit Frequency:**
    *   Automatically calculates last visit date.
    *   Displays status: "Weekly", "2 weeks no visit", "1 month no return".
2.  **Care Reminders:**
    *   Interface to set reminder: after X days.
    *   Can note reason (e.g., "pitch new package").
    *   On due date → shows popup → mark "cared for" / "remind later".

### VIII. GIAO DIỆN & TỐI ƯU HÓA (UI & Optimization)
1.  **Real-time Notifications:**
    *   Customer sends message, returns, or new appointment → notify staff.
    *   Staff replies but customer offline → send push/web notification.
    *   _Note: True push notifications for web often require a service worker and additional setup beyond the scope of basic Next.js/Genkit functionality._
2.  **Responsive Design:**
    *   Entire interface adapted for mobile/tablet.
    *   Chat window is flexible and resizable.
3.  **AI Training (Admin):**
    *   Admin assigns sample responses as GPT training data.
    *   Interface to review new data: filter by label, interaction count.
