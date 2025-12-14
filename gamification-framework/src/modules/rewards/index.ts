export class RewardsManager {
    private rewards: Map<string, string[]>;

    constructor() {
        this.rewards = new Map();
    }

    grantReward(userId: string, rewardId: string): void {
        if (!this.rewards.has(userId)) {
            this.rewards.set(userId, []);
        }
        this.rewards.get(userId)?.push(rewardId);
    }

    getRewards(userId: string): string[] {
        return this.rewards.get(userId) || [];
    }
}