import { getAllMedications, addMedication, updateMedicationInDB, deleteMedicationFromDB } from "./db.js";
import { isValidMedicationInput, calculateReminderDate, escapeHtml, formatDate } from "./medications.js";
import { createReminder, updateReminder, deleteReminder } from "./reminders.js";
import { enableNotifications, updateNotificationButtonState } from "./notifications.js";

export function displayReminders(medications) {
    const container = document.getElementById("reminders");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (medications.length === 0) {
        container.textContent = "Bisher wurden keine Medikamente hinzugefügt.";
        return;
    }

    const reminders = medications
        .map(medication => {
            const { runOutDate, reminderDate } = calculateReminderDate(medication);
            return { medication, runOutDate, reminderDate };
        })
        .sort((a, b) => a.reminderDate - b.reminderDate);

    for (const reminder of reminders) {
        const { medication, runOutDate, reminderDate } = reminder;
        const element = document.createElement("div");

        element.className = "reminder-card";
        element.innerHTML = `
            <div class="reminder-header">
                <h3>
                    ${escapeHtml(medication.name)}
                    (${medication.dose ?? ""}
                    ${escapeHtml(medication.unit ?? "")})
                </h3>
            </div>

            <div class="reminder-info">
                <p>
                    Läuft aus am:
                    <strong>
                        ${formatDate(runOutDate)}
                    </strong>
                </p>
                <p>
                    Benachrichtigung:
                    <strong>
                        ${formatDate(reminderDate)}
                    </strong>
                </p>
            </div>

            <div class="reminder-change">
                <button>Benachrichtige mich früher</button>
            </div>
        `;

        container.appendChild(element);
    }
}

export function displayMedications(db, medications) {
    const container = document.getElementById("medications");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (medications.length === 0) {
        container.textContent = "Noch keine Medikamente vorhanden.";
        return;
    }

    for (const medication of medications) {
        const element = document.createElement("div");
        element.className = "medication-card";

        const { runOutDate, reminderDate } = calculateReminderDate(medication);

        element.innerHTML = `
            <div class="medication-view">
                <div class="medication-header">
                    <h3>
                        ${escapeHtml(medication.name)}
                        (${medication.dose ?? ""}
                        ${escapeHtml(medication.unit ?? "")})
                    </h3>

                    <div class="medication-actions">
                        <button type="button" class="edit-medication">
                            <strong>Edit</strong>
                        </button>

                        <button type="button" class="delete-medication">
                            <strong>Delete</strong>
                        </button>
                    </div>
                </div>

                <div class="medication-info">
                    <p>
                        <strong>
                            ${medication.pillsRemaining}
                        </strong>
                        Stück auf Lager
                    </p>

                    <p>
                        <strong>
                            ${medication.pillsPerDay}
                        </strong>
                        Tabletten/Tag
                    </p>
                </div>
            </div>

            <form class="medication-edit-form" hidden>
                <h3>Edit medication</h3>

                <label>
                    Medication
                    <input type="text" name="name" value="${escapeHtml(medication.name)}" required>
                </label>

                <label>
                    Dose
                    <input type="number" name="dose" value="${medication.dose ?? ""}" required>
                </label>

                <label>
                    Unit
                    <select name="unit" required>
                        <option value="µg" ${medication.unit === "µg" ? "selected" : ""}>µg</option>
                        <option value="mg" ${medication.unit === "mg" ? "selected" : ""}>mg</option>
                        <option value="g" ${medication.unit === "g" ? "selected" : ""}>g</option>
                        <option value="ml" ${medication.unit === "ml" ? "selected" : ""}>ml</option>
                    </select>
                </label>

                <label>
                    Pills remaining
                    <input type="number" name="pillsRemaining" min="0" step="1" value="${medication.pillsRemaining}" required>
                </label>

                <label>
                    Pills per day
                    <input type="number" name="pillsPerDay" min="0.01" step="0.01" value="${medication.pillsPerDay}" required>
                </label>

                <div class="edit-actions">
                    <button type="submit">Save</button>
                    <button type="button" class="cancel-edit">Cancel</button>
                </div>
            </form>
        `;

        const editButton = element.querySelector(".edit-medication");
        const deleteButton = element.querySelector(".delete-medication");
        const view = element.querySelector(".medication-view");
        const editForm = element.querySelector(".medication-edit-form");
        const cancelButton = element.querySelector(".cancel-edit");

        editButton.addEventListener("click", () => {
            view.hidden = true;
            editForm.hidden = false;
        });

        cancelButton.addEventListener("click", () => {
            editForm.hidden = true;
            view.hidden = false;
        });

        editForm.addEventListener("submit", async event => {
            event.preventDefault();

            const formData = new FormData(editForm);
            const name = (formData.get("name") ?? "").toString().trim();
            const dose = Number(formData.get("dose"));
            const unit = (formData.get("unit") ?? "").toString().trim();
            const pillsRemaining = Number(formData.get("pillsRemaining"));
            const pillsPerDay = Number(formData.get("pillsPerDay"));

            if (!isValidMedicationInput({ name, dose, unit, pillsRemaining, pillsPerDay })) {
                alert("Please enter valid medication details.");
                return;
            }

            const updatedMedication = {
                ...medication,
                name,
                dose,
                unit,
                pillsRemaining,
                pillsPerDay
            };

            try {
                await updateMedicationInDB(db, updatedMedication);
                await updateReminder(updatedMedication);
                console.log("Medication updated:", updatedMedication);

                const nextMedications = await getAllMedications(db);
                displayMedications(db, nextMedications);

                const reminders = document.getElementById("reminders");
                if (reminders && !reminders.hidden) {
                    displayReminders(nextMedications);
                }
            } catch (error) {
                console.error("Failed to update medication:", error);
                alert(error.message);
            }
        });

        deleteButton.addEventListener("click", async () => {
            try {
                await deleteReminder(medication);
                await deleteMedicationFromDB(db, medication.id);

                console.log("Medication deleted:", medication.id);

                const nextMedications = await getAllMedications(db);
                displayMedications(db, nextMedications);

                const reminders = document.getElementById("reminders");
                if (reminders && !reminders.hidden) {
                    displayReminders(nextMedications);
                }
            } catch (error) {
                console.error("Failed to delete medication:", error);
                alert(error.message);
            }
        });

        container.appendChild(element);
    }
}

export function initializeTabs(db) {
    const tabs = document.querySelectorAll(".tab");
    const tabContents = document.querySelectorAll(".tab-content");

    tabs.forEach(tab => {
        tab.addEventListener("click", async () => {
            const target = tab.dataset.tab;

            tabs.forEach(item => item.classList.remove("active"));
            tab.classList.add("active");

            tabContents.forEach(content => {
                content.hidden = content.id !== target;
            });

            if (target === "reminders") {
                const medications = await getAllMedications(db);
                displayReminders(medications);
            }
        });
    });
}

export function bindMedicationForm(db) {
    const medicationForm = document.getElementById("medication-form");

    if (!medicationForm) {
        return;
    }

    medicationForm.addEventListener("submit", async event => {
        event.preventDefault();

        const name = document.getElementById("medication-name").value.trim();
        const dose = Number(document.getElementById("medication-mg").value);
        const unit = document.getElementById("medication-unit").value.trim();
        const pillsRemaining = Number(document.getElementById("pills-remaining").value);
        const pillsPerDay = Number(document.getElementById("pills-per-day").value);

        if (!isValidMedicationInput({ name, dose, unit, pillsRemaining, pillsPerDay })) {
            return;
        }

        const medication = {
            name,
            dose,
            unit,
            pillsRemaining,
            pillsPerDay
        };

        try {
            const id = await addMedication(db, medication);
            const savedMedication = { ...medication, id };

            console.log("Medication saved:", savedMedication);

            try {
                await createReminder(savedMedication);
                console.log("Automatic reminder created:", savedMedication);
            } catch (error) {
                console.error("Failed to create reminder:", error);
                alert(error.message);
            }

            medicationForm.reset();

            const nextMedications = await getAllMedications(db);
            displayMedications(db, nextMedications);

            const reminders = document.getElementById("reminders");
            if (reminders && !reminders.hidden) {
                displayReminders(nextMedications);
            }
        } catch (error) {
            console.error("Failed to save medication:", error);
            alert(error.message);
        }
    });
}

export function bindNotificationButton() {
    const notificationButton = document.getElementById("enable-notifications");

    if (!notificationButton) {
        return;
    }

    notificationButton.addEventListener("click", async () => {
        console.log("Enable Notifications clicked");

        try {
            await enableNotifications();
            await updateNotificationButtonState(notificationButton);
            alert("Notifications enabled!");
        } catch (error) {
            console.error("Notification setup failed:", error);
            alert(error.message);
        }
    });
}
