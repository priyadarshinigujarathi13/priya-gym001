
const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Rakshitha",
    database: "gym_db"
});

db.connect((err) => {
    if (err) {
        console.log("Database Connection Failed:", err.message);
    } else {
        console.log("GYM_DB Connected Successfully!");
    }
});

module.exports = db;
