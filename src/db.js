import { DB_NAME, DB_VERSION, MEDICATIONS_STORE } from "./config.js";

export function openDatabase() {
    return new Promise((resolve, reject) => {
        const dbRequest = indexedDB.open(DB_NAME, DB_VERSION);

        dbRequest.onupgradeneeded = event => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(MEDICATIONS_STORE)) {
                db.createObjectStore(MEDICATIONS_STORE, {
                    keyPath: "id",
                    autoIncrement: true
                });
            }
        };

        dbRequest.onsuccess = event => {
            console.log("IndexedDB opened");
            resolve(event.target.result);
        };

        dbRequest.onerror = event => {
            console.error("IndexedDB error:", event.target.error);
            reject(event.target.error);
        };
    });
}

export function getAllMedications(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(MEDICATIONS_STORE, "readonly");
        const store = transaction.objectStore(MEDICATIONS_STORE);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function addMedication(db, medication) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(MEDICATIONS_STORE, "readwrite");
        const store = transaction.objectStore(MEDICATIONS_STORE);
        const request = store.add(medication);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function updateMedicationInDB(db, medication) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(MEDICATIONS_STORE, "readwrite");
        const store = transaction.objectStore(MEDICATIONS_STORE);
        const request = store.put(medication);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export function deleteMedicationFromDB(db, medicationId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(MEDICATIONS_STORE, "readwrite");
        const store = transaction.objectStore(MEDICATIONS_STORE);
        const request = store.delete(medicationId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
