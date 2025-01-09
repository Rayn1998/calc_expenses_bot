export interface IExpense {
    expense_id: number;
    amount: number;
    description: string;
    date: Date;
    whoPaid: number;
    whoParticipated: number[];
    resolve: boolean;
}
