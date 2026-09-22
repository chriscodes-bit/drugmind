import { WORKER_URL } from "./config.js";

export async function getSubscription() {
    if (!("serviceWorker" in navigator)) {
        return null;
    }

    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
}

export async function updateNotificationButtonState(button) {
    if (!button) {
        return;
    }

    try {
        const subscription = await getSubscription();

        if (subscription) {
            button.hidden = true;
            return;
        }

        button.textContent = "Benachrichtigungen aktivieren";
        button.disabled = false;
    } catch (error) {
        console.error("Failed to check notification subscription:", error);
    }
}

export function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = atob(base64);

    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export async function enableNotifications() {
    if (!("serviceWorker" in navigator)) {
        throw new Error("Service workers are not supported");
    }

    if (!("PushManager" in window)) {
        throw new Error("Push notifications are not supported");
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
        throw new Error("Notification permission was denied");
    }

    console.log("Waiting for service worker...");
    const registration = await navigator.serviceWorker.ready;

    console.log("Service worker ready:", registration);
    console.log("Fetching VAPID public key...");

    const response = await fetch(`${WORKER_URL}/vapid-public-key`);

    if (!response.ok) {
        throw new Error("Could not fetch VAPID public key");
    }

    const { publicKey } = await response.json();
    console.log("VAPID public key received");

    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey
        });
    }

    const subscribeResponse = await fetch(`${WORKER_URL}/subscribe`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(subscription)
    });

    if (!subscribeResponse.ok) {
        throw new Error("Failed to save push subscription");
    }

    console.log("Push subscription created:", subscription);

    return subscription;
}
