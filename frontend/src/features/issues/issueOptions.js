export const PRIORITY_OPTIONS = [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
];

export const assigneeOptions = (contract) =>
    [contract.client, contract.freelancer].filter(Boolean).map((u) => ({ value: u.id, label: u.fullName }));
