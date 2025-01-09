export interface IExpense {
    step: number;
    id?: number;
    amount?: number;
    description?: string;
    date?: Date;
    whoPaid?: number;
    whoParticipated?: string[];
}
