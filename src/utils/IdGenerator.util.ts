export function IdGenerator(string: string) {
    return string + Date.now().toString().slice(-4);
}