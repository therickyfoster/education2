export function saveToLocalStorage(key: string, value: any): void {
    localStorage.setItem(key, JSON.stringify(value));
}

export function loadFromLocalStorage(key: string): any | null {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
}