export class Logger {
    private logs: Array<{ event: string; timestamp: Date; progress?: object }> = [];

    logEvent(event: string): void {
        this.logs.push({ event, timestamp: new Date() });
    }

    logProgress(progress: object): void {
        this.logs.push({ event: 'Progress logged', timestamp: new Date(), progress });
    }

    getLogs(): Array<{ event: string; timestamp: Date; progress?: object }> {
        return this.logs;
    }
}