import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
export function parseTimeString(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return { hours, minutes };
}
