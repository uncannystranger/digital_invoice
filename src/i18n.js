import { createContext, useContext } from "react";
export const LanguageContext = createContext("so");
export function useText() {
  const l = useContext(LanguageContext);
  return (so, en) => (l === "en" && en ? en : so);
}
export const labels = {
  draft: ["Qabyo", "Draft"],
  sent: ["La diray", "Sent"],
  paid: ["La bixiyey", "Paid"],
  partial: ["Qayb laga bixiyey", "Partially paid"],
  overdue: ["Daahay", "Overdue"],
  cancelled: ["La kansalay", "Cancelled"],
};
