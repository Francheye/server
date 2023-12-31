const express = require('express');
const router = express.Router();

const {
  registerUser,
  login,
  initiateOauth,
  googleCallback,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationCode,
  tikTokCallback,
  initiateTikTokOauth,
  fetchYouTubeAnalytics
} = require('../controllers/auth');

router.post('/login', login);
router.post('/register', registerUser);
router.patch('/forgotPassword', forgotPassword);
router.patch('/resetPassword', resetPassword);
router.post("/verify", verifyEmail);
router.post("/verify/resend", resendVerificationCode);

// router.get('/banks', getBanks)

// Google OAuth 2.0 Authentication Routes
router.get('/oauth/google/:id', initiateOauth);
router.get('/google/callback', googleCallback);
router.get('/youtube/analytics', fetchYouTubeAnalytics);

//TikTok OAuth 2.0 Authentication Routes
router.get('/tiktok/:id', initiateTikTokOauth);
router.get('/tiktok/callback', tikTokCallback);

// Add other OAuth 2.0 routes if needed

module.exports = router;
