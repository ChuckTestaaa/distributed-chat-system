# Transferring the Project to Another Computer

This guide details two methods for moving your Distributed Chat System code from your main PC to your laptop.

## Option 1: Using a Git Repository (Recommended)

This is the standard engineering practice. It creates a backup of your work and makes future updates easy.

### On your main PC (where the code is currently):
1. Create a free account on [GitHub](https://github.com/) and create a new **Private** repository.
2. Open a terminal in the project root folder (`f:\projects\javascript-projects\distributed-chat-system`).
3. Run the following commands to initialize Git and upload your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of chat system"
   git branch -M main
   # Replace the URL below with the one GitHub provides for your new repo:
   git remote add origin https://github.com/YourUsername/your-repo-name.git
   git push -u origin main
   ```

### On your laptop:
1. Install [Git](https://git-scm.com/downloads) if you don't have it.
2. Open a terminal where you want to store the project.
3. Download the code by running:
   ```bash
   git clone https://github.com/YourUsername/your-repo-name.git
   ```

---

## Option 2: Using a ZIP File (Quick USB Transfer)

If you just want to manually copy the files via a USB stick, Google Drive, or email, use this method. **Critical:** You must exclude the `node_modules` folders, or the ZIP file will be massive and take forever to transfer.

### On your main PC:
1. Delete the heavily populated `node_modules` folders to save space:
   - Delete `f:\projects\javascript-projects\distributed-chat-system\node_modules`
   - Delete `f:\projects\javascript-projects\distributed-chat-system\client\node_modules`
2. Right-click the entire `distributed-chat-system` folder and select **Compress to ZIP file**.
3. Transfer that ZIP file to your laptop.

### On your laptop:
1. Extract the ZIP file into a folder.
2. Open a terminal inside the extracted project folder.
3. Re-install all dependencies by running:
   ```bash
   # Install backend dependencies
   npm install

   # Navigate to frontend and install dependencies
   cd client
   npm install
   ```

---

## Running the Project on Your Laptop

Regardless of which method you chose, once the files are on your laptop, you start the project exactly the same way as on your main PC:

1. Open a terminal in the project root and start the backend/database:
   ```bash
   docker-compose up
   ```
2. Open a second terminal, navigate to the `client` folder, and start the frontend:
   ```bash
   cd client
   npm run dev
   ```
