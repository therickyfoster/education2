export class CustomizationManager {
    private customizations: Record<string, any> = {};

    applyCustomization(userId: string, customizationData: object): void {
        this.customizations[userId] = customizationData;
    }

    getCustomizations(userId: string): object | undefined {
        return this.customizations[userId];
    }
}