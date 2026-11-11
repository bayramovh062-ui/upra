// The backend stores notifications with English title/body templates. Rebuilding them on the
// frontend from the notification type keeps the stored message as the source of dynamic values
// (names, job titles, amounts) while showing the reader's current language.
//
// Every builder returns only the strings it could parse. Anything that does not match the known
// templates falls back to the original server text, so unexpected notifications stay readable.

const TITLE_KEYS = {
    PROPOSAL_RECEIVED: 'proposalReceived',
    CONTRACT_OFFERED: 'contractOffered',
    CONTRACT_ACCEPTED: 'contractAccepted',
    CONTRACT_DECLINED: 'contractDeclined',
    CONTRACT_COMPLETED: 'contractCompleted',
    CONTRACT_CANCELLED: 'contractCancelled',
    CANCEL_REQUESTED: 'cancellationRequested',
    CANCEL_DECLINED: 'cancellationDeclined',
    CANCEL_WITHDRAWN: 'cancellationWithdrawn',
    MILESTONE_FUNDED: 'milestoneFunded',
    MILESTONE_SUBMITTED: 'milestoneSubmitted',
    CHANGES_REQUESTED: 'changesRequested',
    MILESTONE_PAID: 'milestonePaid',
    MILESTONE_AUTO_APPROVED: 'milestoneAutoApproved',
    ISSUE_ASSIGNED: 'issueAssigned',
    COMMENT_ADDED: 'commentAdded',
    DISPUTE_OPENED: 'disputeOpened',
    DISPUTE_RESOLVED: 'disputeResolved',
    REVIEW_RECEIVED: 'reviewReceived',
    REPORT_REVIEWED: 'reportReviewed',
    REPORT_CLOSED: 'reportClosed',
    ACCOUNT_SUSPENDED: 'accountSuspended',
    ACCOUNT_REINSTATED: 'accountReinstated',
};

const parse = (pattern, value) => {
    const found = typeof value === 'string' ? value.match(pattern) : null;
    return found ? found.slice(1) : null;
};

const MILESTONE = '(milestone (\\d+) "([^"]+)" of "([^"]+)")';
const milestoneKey = (match) =>
    match && { label: match[0], number: match[1], title: match[2], job: match[3] };

const localizeMilestone = (match, t) => {
    const parsed = milestoneKey(match);
    if (!parsed) return null;
    return t('notifications.milestoneLabel', {
        number: parsed.number,
        title: parsed.title,
        job: parsed.job,
    });
};

// Returns { title?, body? }. Missing values mean "use the stored server text".
const notificationText = (notification, t) => {
    if (!notification) return {};

    const { type, title: rawTitle, body: rawBody } = notification;
    const titleKey = TITLE_KEYS[type];
    const result = {};

    // The admin copy of a dispute uses a different title than the copy sent to the contract parties.
    if (type === 'DISPUTE_OPENED') {
        const isAdminCopy = / is disputed: /.test(rawBody ?? '');
        result.title = t(
            isAdminCopy ? 'notifications.title.disputeNeedsReview' : 'notifications.title.disputeOpened'
        );
    } else if (titleKey) {
        result.title = t(`notifications.title.${titleKey}`);
    }

    switch (type) {
        case 'PROPOSAL_RECEIVED': {
            const m = parse(/^(.+?) sent a proposal for "(.+)"\.$/s, rawBody);
            if (m) result.body = t('notifications.body.proposalReceived', { name: m[0], job: m[1] });
            break;
        }
        case 'CONTRACT_OFFERED': {
            const m = parse(/^(.+?) offered you a contract for "(.+)"\. Review and accept it to start\.$/s, rawBody);
            if (m) result.body = t('notifications.body.contractOffered', { name: m[0], job: m[1] });
            break;
        }
        case 'CONTRACT_ACCEPTED': {
            const m = parse(
                /^(.+?) accepted your offer for "(.+)"\. Fund the first milestone to start the work\.$/s,
                rawBody
            );
            if (m) result.body = t('notifications.body.contractAccepted', { name: m[0], job: m[1] });
            break;
        }
        case 'CONTRACT_DECLINED': {
            const m = parse(/^(.+?) declined your offer for "(.+)"\. The job is open again\.$/s, rawBody);
            if (m) result.body = t('notifications.body.contractDeclined', { name: m[0], job: m[1] });
            break;
        }
        case 'CONTRACT_COMPLETED': {
            let m = parse(/^All milestones for "(.+)" are paid\. The contract was completed automatically\.$/s, rawBody);
            if (m) {
                result.body = t('notifications.body.contractCompletedAuto', { job: m[0] });
                break;
            }
            m = parse(/^(.+?) marked "(.+)" as completed\. All milestones are paid\.$/s, rawBody);
            if (m) {
                result.body = t('notifications.body.contractCompletedActor', { name: m[0], job: m[1] });
                break;
            }
            m = parse(/^"(.+)" was marked as completed\. All milestones are paid\.$/s, rawBody);
            if (m) result.body = t('notifications.body.contractCompleted', { job: m[0] });
            break;
        }
        case 'CONTRACT_CANCELLED': {
            let m = parse(/^(.+?) cancelled "(.+)" before the work started\. Any escrowed money was refunded\.$/s, rawBody);
            if (m) {
                result.body = t('notifications.body.contractCancelled', { name: m[0], job: m[1] });
                break;
            }
            m = parse(/^(.+?) agreed to cancel "(.+)"\. Escrowed money was refunded to the client\.$/s, rawBody);
            if (m) result.body = t('notifications.body.cancellationAccepted', { name: m[0], job: m[1] });
            break;
        }
        case 'CANCEL_REQUESTED': {
            const m = parse(
                /^(.+?) asked to cancel "(.+)"\.(?: Reason: ([\s\S]+?))? Your answer is needed\.$/s,
                rawBody
            );
            if (m) {
                result.body = t('notifications.body.cancellationRequested', {
                    name: m[0],
                    job: m[1],
                    reason: m[2] ? t('notifications.body.cancellationRequestedReason', { reason: m[2] }) : '',
                });
            }
            break;
        }
        case 'CANCEL_DECLINED': {
            const m = parse(/^(.+?) declined to cancel "(.+)"\. The contract continues\.$/s, rawBody);
            if (m) result.body = t('notifications.body.cancellationDeclined', { name: m[0], job: m[1] });
            break;
        }
        case 'CANCEL_WITHDRAWN': {
            const m = parse(
                /^(.+?) withdrew the cancellation request for "(.+)"\. The contract continues\.$/s,
                rawBody
            );
            if (m) result.body = t('notifications.body.cancellationWithdrawn', { name: m[0], job: m[1] });
            break;
        }
        case 'MILESTONE_FUNDED': {
            const pattern = new RegExp(
                `^(.+?) is now in escrow for ${MILESTONE}\\. You can start working\\.$`,
                's'
            );
            const m = parse(pattern, rawBody);
            if (m) {
                result.body = t('notifications.body.milestoneFunded', {
                    amount: m[0],
                    milestone: localizeMilestone(m.slice(1, 5), t),
                });
            }
            break;
        }
        case 'MILESTONE_SUBMITTED': {
            const pattern = new RegExp(
                `^The freelancer submitted ${MILESTONE}\\. Approve it, or request changes\\. It is approved automatically after (\\d+) days\\.$`,
                's'
            );
            const m = parse(pattern, rawBody);
            if (m) {
                result.body = t('notifications.body.milestoneSubmitted', {
                    milestone: localizeMilestone(m, t),
                    days: m[4],
                });
            }
            break;
        }
        case 'CHANGES_REQUESTED': {
            const pattern = new RegExp(
                `^The client asked for changes on ${MILESTONE}\\. The money stays in escrow; submit again when ready\\.(?: Reason: ([\\s\\S]+))?$`,
                's'
            );
            const m = parse(pattern, rawBody);
            if (m) {
                result.body = t('notifications.body.changesRequested', {
                    milestone: localizeMilestone(m.slice(0, 4), t),
                    reason: m[4] ? t('notifications.body.changesRequestedReason', { reason: m[4] }) : '',
                });
            }
            break;
        }
        case 'MILESTONE_PAID': {
            const pattern = new RegExp(
                `^(.+?) was added to your wallet for ${MILESTONE} \\((.+?) minus (.+?) platform fee\\)\\.$`,
                's'
            );
            const m = parse(pattern, rawBody);
            if (m) {
                result.body = t('notifications.body.milestonePaid', {
                    net: m[0],
                    milestone: localizeMilestone(m.slice(1, 5), t),
                    gross: m[5],
                    fee: m[6],
                });
            }
            break;
        }
        case 'MILESTONE_AUTO_APPROVED': {
            const paidPattern = new RegExp(
                `^(.+?) was added to your wallet for ${MILESTONE} \\((.+?) minus (.+?) platform fee\\)\\.$`,
                's'
            );
            const paid = parse(paidPattern, rawBody);
            if (paid) {
                result.body = t('notifications.body.milestonePaid', {
                    net: paid[0],
                    milestone: localizeMilestone(paid.slice(1, 5), t),
                    gross: paid[5],
                    fee: paid[6],
                });
                break;
            }
            const clientPattern = new RegExp(
                `^${MILESTONE} was in review for (\\d+) days and was approved automatically\\. (.+?) was released from escrow\\.$`,
                's'
            );
            const client = parse(clientPattern, rawBody);
            if (client) {
                result.body = t('notifications.body.milestoneAutoApprovedClient', {
                    milestone: localizeMilestone(client.slice(0, 4), t),
                    days: client[4],
                    gross: client[5],
                });
            }
            break;
        }
        case 'ISSUE_ASSIGNED': {
            const m = parse(/^(.+?) assigned you "(.+)"\.$/s, rawBody);
            if (m) result.body = t('notifications.body.issueAssigned', { name: m[0], title: m[1] });
            break;
        }
        case 'COMMENT_ADDED': {
            const m = parse(/^(.+?) commented on "(.+?)": ([\s\S]+)$/s, rawBody);
            if (m) result.body = t('notifications.body.commentAdded', { name: m[0], title: m[1], excerpt: m[2] });
            break;
        }
        case 'DISPUTE_OPENED': {
            const admin = parse(new RegExp(`^${MILESTONE} is disputed: ([\\s\\S]+)$`, 's'), rawBody);
            if (admin) {
                result.body = t('notifications.body.disputeNeedsReview', {
                    milestone: localizeMilestone(admin.slice(0, 4), t),
                    reason: admin[4],
                });
                break;
            }
            const party = parse(
                new RegExp(
                    `^A dispute was opened on ${MILESTONE}\\. Escrowed money is frozen until an admin resolves it\\.$`,
                    's'
                ),
                rawBody
            );
            if (party) {
                result.body = t('notifications.body.disputeOpened', {
                    milestone: localizeMilestone(party, t),
                });
            }
            break;
        }
        case 'DISPUTE_RESOLVED': {
            const m = parse(
                /^An admin resolved the dispute on milestone (\d+) "([^"]+)": (.+?) released to the freelancer and (.+?) refunded to the client\.$/s,
                rawBody
            );
            if (m) {
                result.body = t('notifications.body.disputeResolved', {
                    number: m[0],
                    title: m[1],
                    release: m[2],
                    refund: m[3],
                });
            }
            break;
        }
        case 'REVIEW_RECEIVED': {
            const m = parse(/^(.+?) left you a (\d+)-star review for "(.+)"\.$/s, rawBody);
            if (m) result.body = t('notifications.body.reviewReceived', { name: m[0], rating: m[1], job: m[2] });
            break;
        }
        case 'REPORT_REVIEWED': {
            result.body = t('notifications.body.reportReviewed');
            break;
        }
        case 'REPORT_CLOSED': {
            result.body = t('notifications.body.reportClosed');
            break;
        }
        case 'ACCOUNT_SUSPENDED': {
            const withReason = parse(
                /^An administrator suspended your account: ([\s\S]+?) Contact support if you believe this is a mistake\.$/s,
                rawBody
            );
            if (withReason) {
                result.body = t('notifications.body.accountSuspendedReason', { reason: withReason[0] });
            } else {
                result.body = t('notifications.body.accountSuspended');
            }
            break;
        }
        case 'ACCOUNT_REINSTATED': {
            result.body = t('notifications.body.accountReinstated');
            break;
        }
        default:
            break;
    }

    if (!result.title) result.title = rawTitle || t('notifications.title.default');
    if (!result.body) result.body = rawBody || '';

    return result;
};

export default notificationText;
