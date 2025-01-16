export default interface IExpense {
    expense_id: number;
    amount: number;
    description: string;
    date: Date;
    whopaid: number;
    whoparticipated: number[];
    resolve: boolean;
    tip: number | null;
    requiredtippercentage: number | null;
}
