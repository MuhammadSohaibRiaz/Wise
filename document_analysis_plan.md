# Document Analysis - Implementation Roadmap
**How to make "Module 10: Document Analysis" functional end-to-end.**

This feature will allow users to upload legal documents (PDF/Word), have them automatically scanned by AI, and receive a summary + risk assessment.

---

## 1. Prerequisites (Already in place)
*   **Database**: Tables `documents` and `document_analysis` are already created (`scripts/005` & `006`).
*   **Storage**: Supabase Storage bucket `documents` exists (`scripts/018`).

---

## 2. Step-by-Step Implementation Plan

### Step 1: File Upload Component (Frontend)
We need a UI for users to upload files inside a Case.
*   **Action**: Create `components/documents/upload-zone.tsx`.
*   **Functionality**:
    *   Drag & Drop area.
    *   Accepts `.pdf`, `.docx`, `.txt`.
    *   Uploads directly to Supabase Storage bucket `documents/{case_id}/{file_name}`.
    *   Inserts row into `documents` table with `status = 'pending'`.

### Step 2: The Logic (Backend / Edge Function)
Since we can't run heavy AI processing in the browser, we use a **Supabase Edge Function**.
*   **Action**: Create a new Edge Function `analyze-document`.
*   **Triggers**:
    *   **Option A (Automatic)**: Database Webhook triggers function when a row is inserted into `documents`.
    *   **Option B (Manual)**: Client calls the function after upload. (Option A is better).

### Step 3: AI Processing (The "Brain")
Inside the Edge Function:
1.  **Download**: Fetch the file from Supabase Storage.
2.  **Extract Text**:
    *   Use a library like `pdf-parse` (for Node) to get raw text.
3.  **Analyze (OpenAI API)**:
    *   Send text to GPT-4o with prompt: *"Analyze this legal document. Provide a summary, identify key risks, and list key terms."*
4.  **Save Results**:
    *   Insert result into `document_analysis` table.
    *   Update `documents` table status to `'completed'`.

### Step 4: Display Results (Frontend)
UPDATE the Case Detail page (`app/client/cases/[id]/page.tsx`).
*   Add a "Documents" tab.
*   List uploaded files.
*   Clicking a file opens a drawer/modal showing the **AI Analysis** (Summary, Risks) stored in `document_analysis`.

---

## 3. Data Flow Diagram

1.  **User** uploads PDF ➔ **Supabase Storage**
2.  **Frontend** inserts row ➔ **`documents` table** (`status='pending'`)
3.  **Database Trigger** ➔ Calls **Edge Function**
4.  **Edge Function**:
    *   Reads File ➔ Extracts Text
    *   Sends to **OpenAI** ➔ Gets JSON Response
    *   Writes to **`document_analysis` table**
    *   Updates **`documents` table** (`status='completed'`)
5.  **Frontend** (Real-time) ➔ Sees status change ➔ Displays "View Analysis" button.

---

## 4. Required Tech
*   **OpenAI API Key**: Need to add to Supabase Secrets.
*   **Supabase Edge Functions**: To run the backend logic.
*   **LangChain (Optional)**: If documents are very large (over 50 pages), we need to split them into chunks.
