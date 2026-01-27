#!/usr/bin/env node

const { google } = require('googleapis');
const readline = require('readline');

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

if (!clientId || !clientSecret) {
  console.error('Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in environment.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.send'],
  prompt: 'consent',
});

console.log('Open this URL in your browser and authorize the app:');
console.log(authUrl);
console.log('');
console.log('After approving, copy the "code" parameter from the redirect URL.');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Paste code here: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    if (!tokens.refresh_token) {
      console.error('No refresh_token returned. Try again with prompt=consent.');
      process.exit(1);
    }
    console.log('\nAdd this to /opt/dockbrain/.env:');
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
  } catch (err) {
    console.error('Error exchanging code for token:', err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
});
