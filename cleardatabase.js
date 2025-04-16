const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const audioUploadPath = path.join(__dirname, "chats", "upload", "voicenotes");
const imageUploadPath = path.join(__dirname, "chats", "upload", "images");
const dbFilePath = path.join(__dirname, "chat.db");

// Function to delete all files in a directory
function deleteFilesInDirectory(directoryPath) {
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      console.error(`Failed to list contents of directory: ${err}`);
      return;
    }

    files.forEach((file) => {
      const filePath = path.join(directoryPath, file);

      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Failed to delete file: ${err}`);
        } else {
          console.log(`Deleted file: ${filePath}`);
        }
      });
    });
  });
}

// Function to clear database tables
function clearDatabase(db) {
  // Clear users table
  db.run("DELETE FROM users", (err) => {
    if (err) {
      console.error(`Failed to clear users table: ${err}`);
    } else {
      console.log("Users table cleared");
    }
  });

  // Clear messages table
  db.run("DELETE FROM messages", (err) => {
    if (err) {
      console.error(`Failed to clear messages table: ${err}`);
    } else {
      console.log("Messages table cleared");
    }
  });
}

// Function to delete the database file
function deleteDatabaseFile() {
  fs.unlink(dbFilePath, (err) => {
    if (err) {
      console.error(`Failed to delete database file: ${err}`);
    } else {
      console.log("Database file deleted");
    }
  });
}

// Function to initialize and clear the database
function initializeAndClearDatabase() {
  const db = new sqlite3.Database(dbFilePath, (err) => {
    if (err) {
      console.error(`Failed to connect to database: ${err}`);
      return;
    }

    console.log("Connected to the database");

    // Clear the database
    clearDatabase(db);

    // Close the database connection
    db.close((err) => {
      if (err) {
        console.error(`Failed to close database: ${err}`);
      } else {
        console.log("Database connection closed");

        // Delete the database file after closing the connection
        deleteDatabaseFile();
      }
    });
  });
}

// Clear the directories
deleteFilesInDirectory(audioUploadPath);
deleteFilesInDirectory(imageUploadPath);

// Initialize and clear the database, then delete the database file
initializeAndClearDatabase();
