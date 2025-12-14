export class Config {
    private config: Record<string, any>;

    constructor() {
        this.config = {};
    }

    loadConfig(config: Record<string, any>): void {
        this.config = { ...this.config, ...config };
    }

    saveConfig(): Record<string, any> {
        return this.config;
    }

    getConfig(): Record<string, any> {
        return this.config;
    }
}