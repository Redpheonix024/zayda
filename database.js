const sqlite3 = require('sqlite3').verbose();

// Connect to the SQLite database
const db = new sqlite3.Database('./chat.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the database.');
        // Create tables if they don't exist
        createTables();
    }
});

// Create tables if they don't exist
function createTables() {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user TEXT NOT NULL,
        to_user TEXT NOT NULL,
        message TEXT,
        type TEXT NOT NULL,
        filename TEXT,           -- For audio
        image_filename TEXT,     -- For images
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
}

module.exports = db;
