const express = require('express');
const router = express.Router();

const {
  registerUser,
  login,
  initiateOauth,
  googleCallback,
  forgotPassword,
  resetPassword,
} = require('../controllers/auth');

router.post('/login', login);
router.post('/register', registerUser);
router.patch('/forgotPassword', forgotPassword);
router.patch('/resetPassword', resetPassword);
// router.get('/banks', getBanks)

// OAuth 2.0 Authentication Routes
router.get('/oauth/google', initiateOauth);
router.get('/google/callback', googleCallback);

// Add other OAuth 2.0 routes if needed

module.exports = router;
