export function calculateReminderDate(medication) {
    const daysRemaining = medication.pillsRemaining / medication.pillsPerDay;
    const runOutDate = new Date();

    runOutDate.setDate(runOutDate.getDate() + daysRemaining);

    const reminderDate = new Date(runOutDate);
    reminderDate.setDate(reminderDate.getDate() - 14);

    return { runOutDate, reminderDate };
}

export function medicationDisplayName(medication) {
    return `${medication.name} ${medication.dose ?? ""} ${medication.unit ?? ""}`.trim();
}

export function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
}

export function formatDate(date) {
    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

export function isValidMedicationInput({ name, dose, unit, pillsRemaining, pillsPerDay }) {
    return Boolean(
        name &&
        Number.isFinite(dose) &&
        dose > 0 &&
        unit &&
        Number.isFinite(pillsRemaining) &&
        pillsRemaining >= 0 &&
        Number.isFinite(pillsPerDay) &&
        pillsPerDay > 0
    );
}
