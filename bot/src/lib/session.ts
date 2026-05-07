// Session data stored per-user conversation
export interface SessionData {
  // The level the user is currently trying to purchase
  pendingLevelId?: number;
  // Step in the payment flow
  step?: "awaiting_receipt" | "idle";
}
