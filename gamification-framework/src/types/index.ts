export interface User {
    id: string;
    name: string;
    email: string;
    progress: Progress[];
}

export interface Achievement {
    id: string;
    title: string;
    description: string;
    unlocked: boolean;
}

export interface Reward {
    id: string;
    type: string;
    value: number;
}

export interface Progress {
    userId: string;
    milestone: string;
    timestamp: Date;
}