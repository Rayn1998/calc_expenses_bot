DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS debts;

CREATE TABLE members (
    member_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE expenses (
    expense_id SERIAL PRIMARY KEY,
    amount INT NOT NULL,
    description VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    whopaid INT NOT NULL REFERENCES members(member_id),
    whoparticipated INT[] NOT NULL,
    resolve BOOLEAN NOT NULL,
    tip INT,
    requiredtippercentage INT NOT NULL
);

CREATE TABLE debts (
    debt_id SERIAL PRIMARY KEY,
    debt INT NOT NULL,
    towhom INT NOT NULL REFERENCES members(member_id),
    resolve BOOLEAN,
    whosedebt INT NOT NULL REFERENCES members(member_id),
    fromexpense INT NOT NULL REFERENCES expenses(expense_id)
);
