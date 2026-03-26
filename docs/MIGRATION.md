# Project Migration Guide: Moving to Local Development

Firebase Studio is being sunset on March 22, 2027. Since this application is built on standard web technologies (Next.js, Tailwind, Firebase SDK), migrating is a straightforward process.

## 1. Exporting Your Code
1. Use the **Export Project** feature in the Studio sidebar to download your entire codebase as a `.zip` file.
2. Unzip the files into a new folder on your computer (e.g., `Documents/moj-file-tracker`).

## 2. Local Development Setup
1. **Install Node.js**: Ensure you have Node.js (Version 20 or higher) installed from [nodejs.org](https://nodejs.org).
2. **Install an IDE**: Download **Visual Studio Code** (VS Code).
3. **Install Dependencies**: Open a terminal in your project folder and run:
   ```bash
   npm install
   ```
4. **Environment Variables**: Create a file named `.env.local` in the root directory. Copy the contents of your Studio `.env` file into it.
   - *Note: Ensure your `APP_PRIVATE_KEY` handles newlines correctly (`\n`).*

## 3. Running the App Locally
Start the development server:
```bash
npm run dev
```
The app will be available at `http://localhost:9002`.

## 4. Continuing with AI (Genkit)
To continue using Genkit tools locally:
1. Ensure your `GOOGLE_GENAI_API_KEY` is in your `.env.local`.
2. Run the Genkit developer UI:
   ```bash
   npm run genkit:dev
   ```

## 5. Firebase Console Management
The "Sunset" only affects this coding interface. Your **Database (Firestore)**, **Authentication**, and **Storage** will remain active and untouched. You can always manage them at:
[https://console.firebase.google.com/](https://console.firebase.google.com/)

## 6. Next-Gen Alternatives
- **Google AI Studio**: Excellent for testing new prompts and model configurations.
- **Project IDX**: A browser-based IDE by Google that supports Next.js and Firebase natively.
