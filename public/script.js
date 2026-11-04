
// COMMON API FUNCTION

async function api(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text();

    let data;

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(
            "Server returned HTML instead of JSON. Check server.js API route."
        );
    }

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
    }

    return data;
}

// MESSAGE FUNCTION

function showMessage(id, message, success = true) {
    const element = document.getElementById(id);

    if (!element) return;

    element.textContent = message;
    element.style.color = success ? "#8ee6a0" : "#ff7777";
}

// SAFE TEXT

function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "-";
    row.appendChild(cell);
}

// LOAD MEMBERSHIP PLANS

async function loadPlans(selectId) {
    const select = document.getElementById(selectId);

    if (!select) return;

    select.innerHTML = '<option value="">Loading Plans...</option>';

    try {
        const plans = await api("/api/plans");

        select.innerHTML = '<option value="">Select Membership Plan</option>';

        if (!Array.isArray(plans) || plans.length === 0) {
            select.innerHTML = '<option value="">No Plans Available</option>';
            return;
        }

        plans.forEach(plan => {
            const option = document.createElement("option");

            option.value = plan.plan_id;
            option.textContent =
                `${plan.plan_name} - ${plan.duration_months} Months - ₹${plan.price}`;

            select.appendChild(option);
        });

    } catch (error) {
        console.error("Plan Loading Error:", error);

        select.innerHTML =
            '<option value="">Unable to Load Plans</option>';

        const message = document.getElementById("insertMessage");
        if (message) showMessage("insertMessage", error.message, false);
    }
}


// ==================================
// INSERT MEMBER
// ==================================

const insertForm = document.getElementById("insertForm");

if (insertForm) {
    loadPlans("insertPlan");

    insertForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const formData = new FormData(insertForm);
        const member = Object.fromEntries(formData.entries());

        try {
            const result = await api("/api/members", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(member)
            });

            showMessage("insertMessage", result.message, true);
            insertForm.reset();

        } catch (error) {
            showMessage("insertMessage", error.message, false);
        }
    });
}


// ==================================
// DISPLAY ALL MEMBERS
// ==================================

async function loadMembers() {
    const table = document.getElementById("membersTable");

    if (!table) return;

    table.innerHTML = "";

    try {
        const members = await api("/api/members");

        if (!members.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 10;
            cell.textContent = "No Members Found";

            row.appendChild(cell);
            table.appendChild(row);
            return;
        }

        members.forEach(member => {
            const row = document.createElement("tr");

            addCell(row, member.member_id);
            addCell(row, member.name);
            addCell(row, member.email);
            addCell(row, member.phone);
            addCell(row, member.gender);
            addCell(row, member.age);
            addCell(row, member.plan_name);
            addCell(row, member.start_date);
            addCell(row, member.end_date);
            addCell(row, member.status);

            table.appendChild(row);
        });

        showMessage("listMessage", "Members loaded successfully", true);

    } catch (error) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 10;
        cell.textContent = error.message;

        row.appendChild(cell);
        table.appendChild(row);

        showMessage("listMessage", error.message, false);
    }
}

loadMembers();

const refreshButton = document.getElementById("refreshMembers");

if (refreshButton) {
    refreshButton.addEventListener("click", loadMembers);
}


// ==================================
// FIND ONE MEMBER
// ==================================

const findForm = document.getElementById("findForm");

if (findForm) {
    findForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const id = document.getElementById("findId").value;
        const resultBox = document.getElementById("memberResult");

        resultBox.innerHTML = "";

        try {
            const member = await api(`/api/members/${encodeURIComponent(id)}`);

            const fields = [
                ["Member ID", member.member_id],
                ["Name", member.name],
                ["Email", member.email],
                ["Phone", member.phone],
                ["Gender", member.gender],
                ["Age", member.age],
                ["Membership Plan", member.plan_name],
                ["Start Date", member.start_date],
                ["End Date", member.end_date],
                ["Status", member.status]
            ];

            fields.forEach(([label, value]) => {
                const item = document.createElement("div");
                item.className = "result-item";

                const strong = document.createElement("strong");
                strong.textContent = label + ":";

                const span = document.createElement("span");
                span.textContent = value ?? "-";

                item.append(strong, span);
                resultBox.appendChild(item);
            });

            showMessage("findMessage", "Member found successfully", true);

        } catch (error) {
            showMessage("findMessage", error.message, false);
        }
    });
}


// ==================================
// DELETE MEMBER
// ==================================

const deleteForm = document.getElementById("deleteForm");

if (deleteForm) {
    deleteForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const id = deleteForm.elements.member_id.value;

        if (!confirm("Are you sure you want to delete this member?")) {
            return;
        }

        try {
            const result = await api(`/api/members/${encodeURIComponent(id)}`, {
                method: "DELETE"
            });

            showMessage("deleteMessage", result.message, true);
            deleteForm.reset();

        } catch (error) {
            showMessage("deleteMessage", error.message, false);
        }
    });
}


// ==================================
// UPDATE MEMBER - SEARCH
// ==================================

const updateSearchForm = document.getElementById("updateSearchForm");

if (updateSearchForm) {
    loadPlans("updatePlan");

    updateSearchForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const id = document.getElementById("updateSearchId").value;

        try {
            const member = await api(`/api/members/${encodeURIComponent(id)}`);

            const form = document.getElementById("updateForm");

            form.hidden = false;

            document.getElementById("updateId").value = member.member_id;

            form.elements.name.value = member.name || "";
            form.elements.email.value = member.email || "";
            form.elements.phone.value = member.phone || "";
            form.elements.gender.value = member.gender || "";
            form.elements.age.value = member.age || "";
            form.elements.plan_id.value = member.plan_id || "";
            form.elements.status.value = member.status || "Active";

            showMessage(
                "updateSearchMessage",
                "Member found. You can now update the details.",
                true
            );

        } catch (error) {
            document.getElementById("updateForm").hidden = true;
            showMessage("updateSearchMessage", error.message, false);
        }
    });
}


// ==================================
// UPDATE MEMBER - SAVE
// ==================================

const updateForm = document.getElementById("updateForm");

if (updateForm) {
    updateForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const id = document.getElementById("updateId").value;

        const formData = new FormData(updateForm);
        const member = Object.fromEntries(formData.entries());

        try {
            const result = await api(`/api/members/${encodeURIComponent(id)}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(member)
            });

            showMessage("updateMessage", result.message, true);

        } catch (error) {
            showMessage("updateMessage", error.message, false);
        }
    });
}
