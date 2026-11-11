import { translate } from '../../i18n';

export const PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH'];

export const priorityOptions = () =>
    PRIORITY_VALUES.map((value) => ({ value, label: translate(`common.status.${value}`) }));

export const assigneeOptions = (contract) =>
    [contract.client, contract.freelancer].filter(Boolean).map((u) => ({ value: u.id, label: u.fullName }));
