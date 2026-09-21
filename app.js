console.log("app.js loaded");

// --------------------------------------------------
// Configuration
// --------------------------------------------------

const WORKER_URL =
    "https://medication-worker.drugmind.workers.dev";

// --------------------------------------------------
// Service Worker
// --------------------------------------------------

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js")
        .then(registration => {
            console.log(
                "Service worker registered:",
                registration
            );
        })
        .catch(error => {
            console.error(
                "Service worker registration FAILED:",
                error
            );
        });
}

// --------------------------------------------------
// IndexedDB
// --------------------------------------------------

const dbRequest =
    indexedDB.open("MedicationDB", 1);

dbRequest.onupgradeneeded = event => {
    const db = event.target.result;

    if (!db.objectStoreNames.contains("medications")) {
        db.createObjectStore("medications", {
            keyPath: "id",
            autoIncrement: true
        });
    }
};

dbRequest.onsuccess = event => {
    console.log("IndexedDB opened");

    const db = event.target.result;

    loadMedications(db);
};

dbRequest.onerror = event => {
    console.error(
        "IndexedDB error:",
        event.target.error
    );
};

// --------------------------------------------------
// Calculate Reminder Date
// --------------------------------------------------

function calculateReminderDate(medication) {
    const daysRemaining =
        medication.pillsRemaining /
        medication.pillsPerDay;

    const runOutDate =
        new Date();

    runOutDate.setDate(
        runOutDate.getDate() +
        daysRemaining
    );

    const reminderDate =
        new Date(runOutDate);

    reminderDate.setDate(
        reminderDate.getDate() -
        14
    );

    return {
        runOutDate,
        reminderDate
    };
}

// --------------------------------------------------
// Get Push Subscription
// --------------------------------------------------

async function getSubscription() {
    const registration =
        await navigator.serviceWorker.ready;

    return registration.pushManager
        .getSubscription();
}

// --------------------------------------------------
// Create Reminder
// --------------------------------------------------

async function createReminder(medication) {
    const subscription =
        await getSubscription();

    if (!subscription) {
        throw new Error(
            "Notifications must be enabled before creating reminders."
        );
    }

    const {
        reminderDate
    } = calculateReminderDate(
        medication
    );

    const response =
        await fetch(
            `${WORKER_URL}/reminders`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    medicationId:
                        medication.id,

                    medicationName:
                        `${medication.name} ${medication.dose ?? ""} ${medication.unit ?? ""}`.trim(),

                    notifyAt:
                        reminderDate.toISOString(),

                    subscription
                })
            }
        );

    if (!response.ok) {
        const error =
            await response.json();

        throw new Error(
            error.error ||
            "Failed to create reminder"
        );
    }

    console.log(
        "Reminder created:",
        medication.name,
        reminderDate
    );
}

// --------------------------------------------------
// Update Reminder
// --------------------------------------------------

async function updateReminder(medication) {
    const subscription =
        await getSubscription();

    if (!subscription) {
        throw new Error(
            "Notifications must be enabled before updating reminders."
        );
    }

    const {
        reminderDate
    } = calculateReminderDate(
        medication
    );

    const response =
        await fetch(
            `${WORKER_URL}/reminders`,
            {
                method: "PUT",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    medicationId:
                        medication.id,

                    medicationName:
                        `${medication.name} ${medication.dose ?? ""} ${medication.unit ?? ""}`.trim(),

                    notifyAt:
                        reminderDate.toISOString(),

                    subscription
                })
            }
        );

    if (!response.ok) {
        const error =
            await response.json();

        throw new Error(
            error.error ||
            "Failed to update reminder"
        );
    }

    console.log(
        "Reminder updated:",
        medication.name,
        reminderDate
    );
}

// --------------------------------------------------
// Add Medication
// --------------------------------------------------

const medicationForm =
    document.getElementById(
        "medication-form"
    );

medicationForm.addEventListener(
    "submit",
    event => {
        event.preventDefault();

        const name =
            document
                .getElementById(
                    "medication-name"
                )
                .value
                .trim();

        const dose = Number(document.getElementById("medication-mg").value);
        const unit = document.getElementById("medication-unit").value.trim();

        const pillsRemaining =
            Number(
                document
                    .getElementById(
                        "pills-remaining"
                    )
                    .value
            );

        const pillsPerDay =
            Number(
                document
                    .getElementById(
                        "pills-per-day"
                    )
                    .value
            );

        if (
            !name ||
            !Number.isFinite(dose) ||
            dose <= 0 ||
            !unit ||
            pillsRemaining < 0 ||
            pillsPerDay <= 0
        ) {
            return;
        }

        const medication = {
            name,
            dose,
            unit,
            pillsRemaining,
            pillsPerDay
        };

        const request =
            indexedDB.open(
                "MedicationDB",
                1
            );

        request.onsuccess =
            event => {
                const db =
                    event.target.result;

                const transaction =
                    db.transaction(
                        "medications",
                        "readwrite"
                    );

                const store =
                    transaction.objectStore(
                        "medications"
                    );

                const addRequest =
                    store.add(
                        medication
                    );

                addRequest.onsuccess =
                    async event => {
                        medication.id =
                            event.target.result;

                        console.log(
                            "Medication saved:",
                            medication
                        );

                        try {
                            await createReminder(
                                medication
                            );

                            console.log(
                                "Automatic reminder created:",
                                medication
                            );
                        } catch (error) {
                            console.error(
                                "Failed to create reminder:",
                                error
                            );

                            alert(
                                error.message
                            );
                        }

                        medicationForm.reset();

                        loadMedications(db);
                    };
            };

        request.onerror =
            event => {
                console.error(
                    "Failed to open database:",
                    event.target.error
                );
            };
    }
);

// --------------------------------------------------
// Load Medications
// --------------------------------------------------

function loadMedications(db) {
    const transaction =
        db.transaction(
            "medications",
            "readonly"
        );

    const store =
        transaction.objectStore(
            "medications"
        );

    const request =
        store.getAll();

    request.onsuccess = () => {
        displayMedications(
            db,
            request.result
        );
    };
}

// --------------------------------------------------
// Display Medications
// --------------------------------------------------

function displayMedications(
    db,
    medications
) {
    const container =
        document.getElementById(
            "medications"
        );

    container.innerHTML = "";

    if (medications.length === 0) {
        container.textContent =
            "No medications added yet.";

        return;
    }

    for (const medication of medications) {
        const element =
            document.createElement("div");

        element.className =
            "medication-card";

        const {
            runOutDate,
            reminderDate
        } = calculateReminderDate(
            medication
        );

        element.innerHTML = `
            <div class="medication-view">

                <div class="medication-header">

                    <h3>
                        ${escapeHtml(medication.name)}
                        (${medication.dose ?? ""}
                        ${escapeHtml(medication.unit ?? "")})
                    </h3>

                    <div class="medication-actions">

                        <button
                            type="button"
                            class="edit-medication"
                        >
                            Edit
                        </button>

                        <button
                            type="button"
                            class="delete-medication"
                        >
                            Delete
                        </button>

                    </div>

                </div>

                <div class="medication-info">

                    <p>
                        <strong>
                            ${medication.pillsRemaining}
                        </strong>
                        pills remaining
                    </p>

                    <p>
                        <strong>
                            ${medication.pillsPerDay}
                        </strong>
                        pills/day
                    </p>

                </div>

                <div class="medication-dates">

                    <p>
                        Runs out:
                        <strong>
                            ${formatDate(runOutDate)}
                        </strong>
                    </p>

                    <p>
                        Reminder:
                        <strong>
                            ${formatDate(reminderDate)}
                        </strong>
                    </p>

                </div>

            </div>

            <form
                class="medication-edit-form"
                hidden
            >

                <h3>
                    Edit medication
                </h3>

                <label>
                    Medication

                    <input
                        type="text"
                        name="name"
                        value="${escapeHtml(medication.name)}"
                        required
                    >
                </label>

                <label>
                    Dose
                    <input
                        type="number"
                        name="dose"
                        value="${medication.dose ?? ""}"
                        required
                    >
                </label>

                <label>
                    Unit
                    <select id="medication-unit" name="unit" required>
                        <option value="µg">µg</option>
                        <option value="mg" selected>mg</option>
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                    </select>
                </label>

                <label>
                    Pills remaining

                    <input
                        type="number"
                        name="pillsRemaining"
                        min="0"
                        step="1"
                        value="${medication.pillsRemaining}"
                        required
                    >
                </label>

                <label>
                    Pills per day

                    <input
                        type="number"
                        name="pillsPerDay"
                        min="0.01"
                        step="0.01"
                        value="${medication.pillsPerDay}"
                        required
                    >
                </label>

                <div class="edit-actions">

                    <button
                        type="submit"
                    >
                        Save
                    </button>

                    <button
                        type="button"
                        class="cancel-edit"
                    >
                        Cancel
                    </button>

                </div>

            </form>
        `;

        const editButton =
            element.querySelector(
                ".edit-medication"
            );

        const deleteButton =
            element.querySelector(
                ".delete-medication"
            );

        const view =
            element.querySelector(
                ".medication-view"
            );

        const editForm =
            element.querySelector(
                ".medication-edit-form"
            );

        const cancelButton =
            element.querySelector(
                ".cancel-edit"
            );

        // ------------------------------------------
        // Open edit form
        // ------------------------------------------

        editButton.addEventListener(
            "click",
            () => {
                view.hidden = true;
                editForm.hidden = false;
            }
        );

        // ------------------------------------------
        // Cancel edit
        // ------------------------------------------

        cancelButton.addEventListener(
            "click",
            () => {
                editForm.hidden = true;
                view.hidden = false;
            }
        );

        // ------------------------------------------
        // Save edit
        // ------------------------------------------

        editForm.addEventListener(
            "submit",
            async event => {
                event.preventDefault();

                const formData =
                    new FormData(editForm);

                const name =
                    formData
                        .get("name")
                        .trim();

                const dose =
                    Number(
                        formData.get("dose")
                    );

                const unit =
                    formData
                        .get("unit")

                const pillsRemaining =
                    Number(
                        formData.get(
                            "pillsRemaining"
                        )
                    );

                const pillsPerDay =
                    Number(
                        formData.get(
                            "pillsPerDay"
                        )
                    );

                if (
                    !name ||
                    !Number.isFinite(dose) ||
                    dose <= 0 ||
                    !unit ||
                    !Number.isFinite(pillsRemaining) ||
                    pillsRemaining < 0 ||
                    !Number.isFinite(pillsPerDay) ||
                    pillsPerDay <= 0
                ) {
                    alert(
                        "Please enter valid medication details."
                    );
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
                    await updateMedicationInDB(
                        db,
                        updatedMedication
                    );

                    await updateReminder(
                        updatedMedication
                    );

                    console.log(
                        "Medication updated:",
                        updatedMedication
                    );

                    loadMedications(db);
                } catch (error) {
                    console.error(
                        "Failed to update medication:",
                        error
                    );

                    alert(
                        error.message
                    );
                }
            }
        );

        // ------------------------------------------
        // Delete
        // ------------------------------------------

        deleteButton.addEventListener(
            "click",
            () => {
                deleteMedication(
                    db,
                    medication
                );
            }
        );

        container.appendChild(
            element
        );
    }
}

// --------------------------------------------------
// Escape HTML
// --------------------------------------------------

function escapeHtml(value) {
    const div =
        document.createElement("div");

    div.textContent = value;

    return div.innerHTML;
}

// --------------------------------------------------
// Update IndexedDB
// --------------------------------------------------

function updateMedicationInDB(
    db,
    medication
) {
    return new Promise(
        (resolve, reject) => {
            const transaction =
                db.transaction(
                    "medications",
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    "medications"
                );

            const request =
                store.put(
                    medication
                );

            request.onsuccess =
                () => {
                    resolve();
                };

            request.onerror =
                () => {
                    reject(
                        request.error
                    );
                };
        }
    );
}

// --------------------------------------------------
// Delete Medication
// --------------------------------------------------

async function deleteMedication(
    db,
    medication
) {
    try {
        const subscription =
            await getSubscription();

        if (subscription) {
            const response =
                await fetch(
                    `${WORKER_URL}/reminders`,
                    {
                        method: "DELETE",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            medicationId:
                                medication.id,

                            subscription
                        })
                    }
                );

            if (!response.ok) {
                throw new Error(
                    "Failed to delete reminder"
                );
            }

            console.log(
                "Reminder deleted:",
                medication.id
            );
        }

        const transaction =
            db.transaction(
                "medications",
                "readwrite"
            );

        const store =
            transaction.objectStore(
                "medications"
            );

        store.delete(
            medication.id
        );

        transaction.oncomplete =
            () => {
                console.log(
                    "Medication deleted:",
                    medication.id
                );

                loadMedications(db);
            };

    } catch (error) {
        console.error(
            "Failed to delete medication:",
            error
        );
    }
}

// --------------------------------------------------
// Date Formatting
// --------------------------------------------------

function formatDate(date) {
    return date.toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "long",
            day: "numeric"
        }
    );
}

// --------------------------------------------------
// Notifications
// --------------------------------------------------

const notificationButton =
    document.getElementById(
        "enable-notifications"
    );

async function updateNotificationButton() {
    if (!notificationButton) {
        return;
    }

    try {
        const subscription =
            await getSubscription();

        if (subscription) {
            notificationButton.hidden = true;
        } else {
            notificationButton.textContent =
                "Enable Notifications";

            notificationButton.disabled =
                false;
        }

    } catch (error) {
        console.error(
            "Failed to check notification subscription:",
            error
        );
    }
}

async function enableNotifications() {
    if (
        !("serviceWorker" in navigator)
    ) {
        throw new Error(
            "Service workers are not supported"
        );
    }

    if (
        !("PushManager" in window)
    ) {
        throw new Error(
            "Push notifications are not supported"
        );
    }

    const permission =
        await Notification.requestPermission();

    if (permission !== "granted") {
        throw new Error(
            "Notification permission was denied"
        );
    }

    console.log(
        "Waiting for service worker..."
    );

    const registration =
        await navigator.serviceWorker.ready;

    console.log(
        "Service worker ready:",
        registration
    );

    console.log(
        "Fetching VAPID public key..."
    );

    const response =
        await fetch(
            `${WORKER_URL}/vapid-public-key`
        );

    if (!response.ok) {
        throw new Error(
            "Could not fetch VAPID public key"
        );
    }

    const {
        publicKey
    } = await response.json();

    console.log(
        "VAPID public key received"
    );

    const applicationServerKey =
        urlBase64ToUint8Array(
            publicKey
        );

    let subscription =
        await registration.pushManager
            .getSubscription();

    if (!subscription) {
        subscription =
            await registration.pushManager
                .subscribe({
                    userVisibleOnly: true,
                    applicationServerKey
                });
    }

    const subscribeResponse =
        await fetch(
            `${WORKER_URL}/subscribe`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(
                        subscription
                    )
            }
        );

    if (!subscribeResponse.ok) {
        throw new Error(
            "Failed to save push subscription"
        );
    }

    console.log(
        "Push subscription created:",
        subscription
    );

    await updateNotificationButton();
}

// --------------------------------------------------
// VAPID Helper
// --------------------------------------------------

function urlBase64ToUint8Array(
    base64String
) {
    const padding =
        "=".repeat(
            (
                4 -
                base64String.length % 4
            ) % 4
        );

    const base64 =
        (
            base64String +
            padding
        )
            .replace(
                /-/g,
                "+"
            )
            .replace(
                /_/g,
                "/"
            );

    const rawData =
        atob(base64);

    return Uint8Array.from(
        [...rawData].map(
            char =>
                char.charCodeAt(0)
        )
    );
}

// --------------------------------------------------
// Notification Button
// --------------------------------------------------

if (notificationButton) {
    notificationButton.addEventListener(
        "click",
        async () => {
            console.log(
                "Enable Notifications clicked"
            );

            try {
                await enableNotifications();

                alert(
                    "Notifications enabled!"
                );

            } catch (error) {
                console.error(
                    "Notification setup failed:",
                    error
                );

                alert(
                    error.message
                );
            }
        }
    );
}

// Check existing subscription when app starts
updateNotificationButton();