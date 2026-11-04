
const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HOME PAGE
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// GET MEMBERSHIP PLANS
app.get("/api/plans", (req, res) => {
    const sql = `
        SELECT plan_id, plan_name, duration_months, price
        FROM membership_plans
        ORDER BY plan_id
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.log("Plans Error:", err.message);
            return res.status(500).json({ message: err.message });
        }
        res.json(results);
    });
});

// GET ALL MEMBERS
app.get("/api/members", (req, res) => {
    const sql = `
        SELECT m.member_id, m.name, m.email, m.phone,
               m.gender, m.age, p.plan_id, p.plan_name,
               s.start_date, s.end_date, s.status
        FROM members m
        LEFT JOIN subscriptions s
          ON s.subscription_id = (
              SELECT MAX(s2.subscription_id)
              FROM subscriptions s2
              WHERE s2.member_id = m.member_id
          )
        LEFT JOIN membership_plans p ON s.plan_id = p.plan_id
        ORDER BY m.member_id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.log("Members Error:", err.message);
            return res.status(500).json({ message: err.message });
        }
        res.json(results);
    });
});

// GET ONE MEMBER
app.get("/api/members/:id", (req, res) => {
    const sql = `
        SELECT m.member_id, m.name, m.email, m.phone,
               m.gender, m.age, p.plan_id, p.plan_name,
               s.start_date, s.end_date, s.status
        FROM members m
        LEFT JOIN subscriptions s
          ON s.subscription_id = (
              SELECT MAX(s2.subscription_id)
              FROM subscriptions s2
              WHERE s2.member_id = m.member_id
          )
        LEFT JOIN membership_plans p ON s.plan_id = p.plan_id
        WHERE m.member_id = ?
    `;

    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ message: err.message });
        if (results.length === 0) {
            return res.status(404).json({ message: "Member not found" });
        }
        res.json(results[0]);
    });
});

// GET SUBSCRIPTIONS
app.get("/api/subscriptions", (req, res) => {
    const sql = `
        SELECT s.subscription_id, m.name AS member_name,
               p.plan_name, s.start_date, s.end_date, s.status
        FROM subscriptions s
        LEFT JOIN members m ON s.member_id = m.member_id
        LEFT JOIN membership_plans p ON s.plan_id = p.plan_id
        ORDER BY s.subscription_id DESC
    `;

    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json(results);
    });
});

// ADD MEMBER
app.post("/api/members", (req, res) => {
    const { name, email, phone, gender, age, plan_id } = req.body;

    if (!name || !email || !phone || !gender || !age || !plan_id) {
        return res.status(400).json({ message: "Please fill all fields" });
    }

    const memberSql = `
        INSERT INTO members (name, email, phone, gender, age)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(memberSql, [name, email, phone, gender, age], (err, result) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }

        const memberId = result.insertId;

        const planSql = `
            SELECT duration_months
            FROM membership_plans
            WHERE plan_id = ?
        `;

        db.query(planSql, [plan_id], (err, plans) => {
            if (err || plans.length === 0) {
                return db.query(
                    "DELETE FROM members WHERE member_id = ?",
                    [memberId],
                    () => res.status(400).json({
                        message: err ? err.message : "Membership plan not found"
                    })
                );
            }

            const subscriptionSql = `
                INSERT INTO subscriptions
                (member_id, plan_id, start_date, end_date, status)
                VALUES (
                    ?, ?, CURDATE(),
                    DATE_ADD(CURDATE(), INTERVAL ? MONTH),
                    'Active'
                )
            `;

            db.query(
                subscriptionSql,
                [memberId, plan_id, plans[0].duration_months],
                (err) => {
                    if (err) {
                        console.log("Subscription Error:", err.message);
                        return res.status(500).json({ message: err.message });
                    }

                    res.json({
                        success: true,
                        message: "Member added successfully"
                    });
                }
            );
        });
    });
});

// UPDATE MEMBER
app.put("/api/members/:id", (req, res) => {
    const id = req.params.id;
    const { name, email, phone, gender, age, plan_id, status } = req.body;

    if (!name || !email || !phone || !gender || !age || !plan_id) {
        return res.status(400).json({ message: "Please fill all fields" });
    }

    const memberSql = `
        UPDATE members
        SET name = ?, email = ?, phone = ?, gender = ?, age = ?
        WHERE member_id = ?
    `;

    db.query(memberSql, [name, email, phone, gender, age, id], (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Member not found" });
        }

        const checkSql = `
            SELECT subscription_id
            FROM subscriptions
            WHERE member_id = ?
            ORDER BY subscription_id DESC
            LIMIT 1
        `;

        db.query(checkSql, [id], (err, rows) => {
            if (err) return res.status(500).json({ message: err.message });

            const saveSubscription = (duration) => {
                if (rows.length > 0) {
                    const updateSql = `
                        UPDATE subscriptions
                        SET plan_id = ?, status = ?,
                            end_date = DATE_ADD(start_date, INTERVAL ? MONTH)
                        WHERE subscription_id = ?
                    `;

                    db.query(
                        updateSql,
                        [plan_id, status || "Active", duration, rows[0].subscription_id],
                        (err) => {
                            if (err) return res.status(500).json({ message: err.message });
                            res.json({ success: true, message: "Member updated successfully" });
                        }
                    );
                } else {
                    const insertSql = `
                        INSERT INTO subscriptions
                        (member_id, plan_id, start_date, end_date, status)
                        VALUES (?, ?, CURDATE(),
                                DATE_ADD(CURDATE(), INTERVAL ? MONTH), ?)
                    `;

                    db.query(
                        insertSql,
                        [id, plan_id, duration, status || "Active"],
                        (err) => {
                            if (err) return res.status(500).json({ message: err.message });
                            res.json({ success: true, message: "Member updated successfully" });
                        }
                    );
                }
            };

            db.query(
                "SELECT duration_months FROM membership_plans WHERE plan_id = ?",
                [plan_id],
                (err, plans) => {
                    if (err) return res.status(500).json({ message: err.message });
                    if (plans.length === 0) {
                        return res.status(400).json({ message: "Membership plan not found" });
                    }
                    saveSubscription(plans[0].duration_months);
                }
            );
        });
    });
});

// DELETE MEMBER
app.delete("/api/members/:id", (req, res) => {
    const id = req.params.id;

    db.query("DELETE FROM subscriptions WHERE member_id = ?", [id], (err) => {
        if (err) return res.status(500).json({ message: err.message });

        db.query("DELETE FROM members WHERE member_id = ?", [id], (err, result) => {
            if (err) return res.status(500).json({ message: err.message });

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "Member not found" });
            }

            res.json({ success: true, message: "Member deleted successfully" });
        });
    });
});

// STATIC FILES - Keep after API routes
app.use(express.static(path.join(__dirname, "public")));

// START SERVER
app.listen(PORT, () => {
    console.log("RAKSHITHA GYM SERVER STARTED");
    console.log("http://localhost:" + PORT);
});
