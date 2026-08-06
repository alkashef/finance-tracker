import { when } from './helpers.js';
import { esc } from '../format.js';

export function viewSettings(v) {
  return '<div class="settings">'
    + '<h2 class="page-title page-title--tight">Connect to Google Sheets</h2>'
    + '<p class="settings-p">This page talks to Google Sheets directly with your Google sign-in — no deployed script to maintain. One-time setup in <a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console</a>:</p>'
    + '<ol class="settings-ol">'
    + '<li>Create a project (or pick one), then enable the <strong>Google Sheets API</strong>.</li>'
    + '<li>Credentials → Create Credentials → <strong>OAuth client ID</strong>, type <strong>Web application</strong>.</li>'
    + '<li>Under <strong>Authorized JavaScript origins</strong>, add this page\'s origin (the URL up to the domain, no path).</li>'
    + '<li>Copy the generated <strong>Client ID</strong> and paste it below, along with your spreadsheet\'s ID (from its URL).</li>'
    + '</ol>'
    + '<label class="lbl">Google OAuth Client ID</label>'
    + '<input class="input mb-14" data-f="clientId" value="' + esc(v.clientIdInput) + '" placeholder="xxxxxxxxxxxx.apps.googleusercontent.com">'
    + '<label class="lbl">Spreadsheet ID</label>'
    + '<input class="input mb-18" data-f="spreadsheetId" value="' + esc(v.spreadsheetIdInput) + '">'
    + when(v.fromLocalEnv, '<p class="settings-hint">Prefilled from your local <code>config/.env</code>. Nothing is saved or connected until you press the button below.</p>')
    + '<div class="settings-actions">'
    + '<button class="btn-connect" data-act="saveAndConnect">' + esc(v.connectLabel) + '</button>'
    + when(v.hasSavedConfig, '<button class="btn-connect-ghost" data-act="closeSettings">Cancel</button>')
    + '</div>'
    + '</div>';
}
