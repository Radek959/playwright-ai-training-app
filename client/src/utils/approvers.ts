export const APPROVERS: Record<string, string> = {
  "manager-a": "Manager A",
  "manager-b": "Manager B",
  "manager-c": "Manager C",
};

export function getApproverLabel(id: string): string {
  if (APPROVERS[id]) {
    return `${APPROVERS[id]} (${id})`;
  }
  return id;
}
