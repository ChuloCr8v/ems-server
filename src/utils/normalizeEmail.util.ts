export function normalizeEmail(email: string) {
    return email
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^\w@.+-]/g, '')
}