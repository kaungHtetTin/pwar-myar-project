import React from "react";
import { TransactionsScreen } from "./TransactionsScreen";

export function SalesHistoryScreen(props) {
  return <TransactionsScreen {...props} view="sales" />;
}
