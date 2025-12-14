export class ProgressTracker {
    private progressData: { [userId: string]: object } = {};

    trackProgress(userId: string, progressData: object): void {
        if (!this.progressData[userId]) {
            this.progressData[userId] = {};
        }
        this.progressData[userId] = { ...this.progressData[userId], ...progressData };
    }

    getProgress(userId: string): object {
        return this.progressData[userId] || {};
    }
}