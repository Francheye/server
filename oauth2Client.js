const express = require('express');
const session = require('express-session');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

// Google OAuth 2.0 configuration
const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
const redirectUri = process.env.GOOGLE_CALLBACK_URI

const oauth2Client = new OAuth2Client({
  clientId: googleClientId,
  clientSecret: googleClientSecret,
  redirectUri: redirectUri,
});


module.exports = oauth2Client