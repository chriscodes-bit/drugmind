import { openDatabase, getAllMedications } from "./src/db.js";
import { displayMedications, initializeTabs, bindMedicationForm, bindNotificationButton } from "./src/ui.js";
import { updateNotificationButtonState } from "./src/notifications.js";

console.log("app.js loaded");

if ("serviceWorker" in navigator) {
    navigator.serviceWorker
        .register("./sw.js")
        .then(registration => {
            console.log("Service worker registered:", registration);
        })
        .catch(error => {
            console.error("Service worker registration FAILED:", error);
        });
}

const notificationButton = document.getElementById("enable-notifications");

bindNotificationButton();

if (notificationButton) {
    updateNotificationButtonState(notificationButton);
}

openDatabase()
    .then(db => {
        bindMedicationForm(db);
        initializeTabs(db);

        getAllMedications(db)
            .then(medications => {
                displayMedications(db, medications);
            })
            .catch(error => {
                console.error("Failed to load medications:", error);
            });
    })
    .catch(error => {
        console.error("Failed to open database:", error);
    });
