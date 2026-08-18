ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_balance_nonnegative_check" CHECK ("balance" >= 0);

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_nonzero_amount_check" CHECK ("amount" <> 0),
  ADD CONSTRAINT "wallet_transactions_balances_nonnegative_check" CHECK ("balance_before" >= 0 AND "balance_after" >= 0),
  ADD CONSTRAINT "wallet_transactions_balance_equation_check" CHECK ("balance_after" = "balance_before" + "amount");

CREATE OR REPLACE FUNCTION prevent_wallet_ledger_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'wallet transaction ledger is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "wallet_transactions_prevent_update"
BEFORE UPDATE ON "wallet_transactions"
FOR EACH ROW EXECUTE FUNCTION prevent_wallet_ledger_mutation();

CREATE TRIGGER "wallet_transactions_prevent_delete"
BEFORE DELETE ON "wallet_transactions"
FOR EACH ROW EXECUTE FUNCTION prevent_wallet_ledger_mutation();
