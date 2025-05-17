// src/lib/validator.ts

/**
 * Validates a Vietnamese phone number.
 * - Starts with 0.
 * - Followed by 9 digits (total 10 digits).
 * - Or starts with +84.
 * - Followed by 9 digits (total 12 digits including +84).
 * @param phoneNumber The phone number string to validate.
 * @returns True if the phone number is valid, false otherwise.
 */
export function validatePhoneNumber(phoneNumber: string): boolean {
  if (!phoneNumber) {
    return false;
  }
  // Regular expression for Vietnamese phone numbers
  // Allows:
  // - 0XXXXXXXXX (10 digits, starts with 0)
  // - +84XXXXXXXXX (12 digits, starts with +84)
  const phoneRegex = /^(0\d{9}|(\+84)\d{9})$/;
  return phoneRegex.test(phoneNumber);
}
