export function syncToCloud(data: object): Promise<void> {
    return new Promise((resolve, reject) => {
        // Simulate cloud sync operation
        setTimeout(() => {
            console.log("Data synced to cloud:", data);
            resolve();
        }, 1000);
    });
}

export function loadFromCloud(userId: string): Promise<object> {
    return new Promise((resolve, reject) => {
        // Simulate cloud load operation
        setTimeout(() => {
            const mockData = { userId, progress: "Sample progress data" };
            console.log("Data loaded from cloud for user:", userId);
            resolve(mockData);
        }, 1000);
    });
}