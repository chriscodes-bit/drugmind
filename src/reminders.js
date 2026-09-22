import { WORKER_URL } from "./config.js";
import { medicationDisplayName, calculateReminderDate } from "./medications.js";
import { getSubscription } from "./notifications.js";

export async function createReminder(medication) {
    const subscription = await getSubscription();

    if (!subscription) {
        throw new Error("Benachrichtigungen müssen aktiviert werden, bevor Erinnerungen hinzugefügt werden können.");
    }

    const { reminderDate } = calculateReminderDate(medication);

    const response = await fetch(`${WORKER_URL}/reminders`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            medicationId: medication.id,
            medicationName: medicationDisplayName(medication),
            notifyAt: reminderDate.toISOString(),
            subscription
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler bei der Erstellung der Erinnerung");
    }

    console.log("Reminder created:", medication.name, reminderDate);
}

export async function updateReminder(medication) {
    const subscription = await getSubscription();

    if (!subscription) {
        throw new Error("Benachrichtigungen müssen aktiviert werden, bevor Erinnerungen hinzugefügt werden können.");
    }

    const { reminderDate } = calculateReminderDate(medication);

    const response = await fetch(`${WORKER_URL}/reminders`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            medicationId: medication.id,
            medicationName: medicationDisplayName(medication),
            notifyAt: reminderDate.toISOString(),
            subscription
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update reminder");
    }

    console.log("Reminder updated:", medication.name, reminderDate);
}

export async function deleteReminder(medication) {
    const subscription = await getSubscription();

    if (!subscription) {
        return;
    }

    const response = await fetch(`${WORKER_URL}/reminders`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            medicationId: medication.id,
            subscription
        })
    });

    if (!response.ok) {
        throw new Error("Erinnerung konnte nicht gelöscht werden");
    }

    console.log("Reminder deleted:", medication.id);
}
