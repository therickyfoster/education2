export class AchievementsManager {
    private achievements: Map<string, boolean>;

    constructor() {
        this.achievements = new Map();
    }

    unlockAchievement(achievementId: string): void {
        this.achievements.set(achievementId, true);
    }

    getAchievements(): Array<{ id: string; unlocked: boolean }> {
        return Array.from(this.achievements.entries()).map(([id, unlocked]) => ({ id, unlocked }));
    }
}