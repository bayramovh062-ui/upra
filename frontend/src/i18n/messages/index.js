import apiErrors from './apiErrors.js';
import auth from './auth.js';
import chat from './chat.js';
import common from './common.js';
import contracts from './contracts.js';
import dashboard from './dashboard.js';
import disputes from './disputes.js';
import errors from './errors.js';
import escrow from './escrow.js';
import home from './home.js';
import issues from './issues.js';
import jobs from './jobs.js';
import labels from './labels.js';
import nav from './nav.js';
import notifications from './notifications.js';
import proposals from './proposals.js';
import reviews from './reviews.js';
import settings from './settings.js';
import shell from './shell.js';
import validation from './validation.js';
import admin from './admin.js';
import attachments from './attachments.js';
import profile from './profile.js';
import wallet from './wallet.js';

// Each domain file exports { en, az, tr }. Building the dictionary per locale keeps
// one concept in one file while still giving the app a single flat namespace.
const domains = {
    common,
    nav,
    labels,
    validation,
    errors,
    apiErrors,
    shell,
    auth,
    home,
    dashboard,
    jobs,
    proposals,
    contracts,
    escrow,
    issues,
    chat,
    notifications,
    settings,
    reviews,
    disputes,
    admin,
    wallet,
    attachments,
    profile,
};

const build = (locale) =>
    Object.fromEntries(
        Object.entries(domains).map(([name, messages]) => [name, messages[locale] ?? messages.en ?? {}])
    );

export const DICTIONARIES = {
    en: build('en'),
    az: build('az'),
    tr: build('tr'),
};
