const User = require('../models/User');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, UnauthenticatedError } = require('../errors');
const jwt = require('jsonwebtoken');
const oauth2Client = require('../oauth2Client');
const { google } = require('googleapis');
const youtubeAnalytics = google.youtubeAnalytics('v2');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../mailer');
const bcrypt = require('bcryptjs');
require('dotenv').config();
//const crypto = require('crypto')

// EMAIL AND PASSWORD REGISTER AND LOGIN
const registerUser = async (req, res) => {
  try {
    // Extract necessary fields from the request body
    const { name, email, password } = req.body.data;
    const type = req.body.type;

    // Create instances of embedded schemas
    const personalInfo = { name, email, password, type };

    // Use the create method to create a new user
    const user = await User.create({
      data: { ...personalInfo },
      type: type,
    });

    // Generate and send a JWT token for authentication
    const token = user.createJWT();

    // Prepare user data for response, excluding the password
    const userData = {
      _id: user._id,
      name: user.data.name,
      email: user.data.email,
      type: user.type, // Include 'type' in the response if needed
    };

    const verificationCode = generateVerificationCode(); // Implement this function
    
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = Date.now() + 3600000; // Code expires in 1 hour
    
   await user.save();
   await sendWelcomeEmail(email, verificationCode);
    
    res.status(201).json({ msg: 'Verification code sent to email.', email: userData.email });
    
  } catch (error) {
    // Handle different types of errors
    if (error.name === 'ValidationError') {
      // Validation error
      res.status(StatusCodes.BAD_REQUEST).json({ msg: error.message });
    } else if (error.name === 'MongoError' && error.code === 11000) {
      // Duplicate key error (e.g., email already exists)
      res.status(StatusCodes.BAD_REQUEST).json({ msg: 'Email Already Exists' });
    } else {
      // Other errors
      console.error(error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ msg: 'Something went wrong, please try again later' });
    }
  }
};

//aux function for generating the verification code
function generateVerificationCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

const axios = require('axios'); // Ensure axios is required at the top of your file

const verifyEmail = async (req, res) => {
  const { email, verificationCode } = req.body;
  const user = await User.findOne({ 'data.email': email, verificationCode, verificationCodeExpires: { $gt: Date.now() } });

  if (!user) {
    return res.status(400).json({ msg: 'Invalid or expired verification code.' });
  }

  user.emailVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpires = undefined;
  await user.save();

  // Add User to SendFox mailing list
  const apiEndpoint = 'https://api.sendfox.com/contacts';
  const apiKey = process.env.SEND_FOX; // Replace with your actual API key
  console.log(apiKey)

  const userData = {
      email: user.data.email, // Use the user's email
      first_name: user.data.name, // Use the user's first name
      lists: [468931] // Replace with your actual list ID
  };

  try {
      const response = await axios.post(apiEndpoint, userData, {
          headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
          }
      });

      res.status(200).json({ msg: 'Account verified successfully.', user: user });
  } catch (error) {
  }
      console.error(error);
      res.status(500).json({ msg: 'Error adding user to SendFox.' });
};
//route to send the verification code again incase it expires
const resendVerificationCode = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ 'data.email':email });

  if (!user) {
    return res.status(404).json({msg:'User not found.'});
  }

  const newVerificationCode = generateVerificationCode();
  user.verificationCode = newVerificationCode;
  user.verificationCodeExpires = Date.now() + 3600000; // 1 hour
  await user.save();

 await sendWelcomeEmail(email, newVerificationCode);
  res.status(200).json({msg:'New verification code sent.'});
};


const login = async (req, res) => {
  try {
    const { password, email } = req.body;

    if (!email || !password) {
      throw new BadRequestError('Please provide your email and password');
    }

    const user = await User.findOne({ 'data.email': email });

    if (!user) {
      throw new UnauthenticatedError('User does not exist');
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      throw new UnauthenticatedError('Invalid email or password');
    }

    const token = user.createJWT();

    res.status(StatusCodes.OK).json({ user: user, token });
  } catch (error) {
    console.log(error);
    res.status(StatusCodes.BAD_REQUEST).json({ msg: error.message });
  }
};

// Forgot password to get reset code
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new Error('Please provide your email');
    }

    const user = await User.findOne({ 'data.email': email });

    if (!user) {
      throw new Error('Invalid Email');
    }

    // Generate a random 5-digit code
    const resetCode = Math.floor(10000 + Math.random() * 90000).toString();

    // Set expiry for 30 minutes
    const resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 minutes

    const newUser = await User.updateOne(
      { _id: user._id },
      {
        $set: {
          resetPasswordToken: resetCode,
          resetPasswordExpires: resetPasswordExpires,
        },
      }
    );

    if (newUser.nModified === 0) {
      throw new Error('Forgot Password Failed.');
    }

    await sendPasswordResetEmail(user.data.email, resetCode);

    res.status(200).json({
      msg: 'Password reset code sent to your email',
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({
      msg: error.message,
    });
  }
};

// Reset password action
// Revised hashPassword method

// Revised reset password controller
const resetPassword = async (req, res) => {
  try {
    const { resetCode, newPassword } = req.body;

    if (!resetCode) {
      throw new Error('Reset code is required');
    }

    // Find the user with the given reset code and within the expiration time
    const user = await User.findOne({
      resetPasswordToken: resetCode,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new Error('Invalid reset code or code expired');
    }

    user.data.password = newPassword;

    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    // Save the updated user document
    await user.save();

    res.status(200).json({ msg: 'Password reset successfully' });
  } catch (error) {
    res.status(400).json({ msg: error.message });
  }
};

const initiateOauth = async (req, res) => {
  const id = req.query.id;
  const state = id;
  let authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Ensures a refresh token is provided
    scope: [
      'https://www.googleapis.com/auth/yt-analytics.readonly',
      //'https://www.googleapis.com/auth/youtube.readonly', // Added to access YouTube channel data
      //'https://www.googleapis.com/auth/userinfo.email'
    ],
    state: state, // Optional: state parameter for CSRF protection
  });
  res.redirect(authUrl);
};


const googleCallback = async (req, res) => {
  const { code, state } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    console.log(tokens)

    // Find or create a user record and update tokens
    let user = await User.findOneAndUpdate(
      { _id: state },
      { googleTokens: { accessToken: tokens.access_token, refreshToken: tokens.refresh_token } },
      { new: true, upsert: false }
    );

    // Redirect to analytics route with user's email or ID
    res.redirect(`/analytics?user=${user._id}`);
  } catch (error) {
    console.error('Error during Google OAuth callback:', error);
    res.status(500).send('Internal Server Error');
  }
};

const fetchYouTubeAnalytics = async (req, res) => {
  const userId = req.query.user;

  try {
    // Fetch user from the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Set credentials using the stored tokens
    oauth2Client.setCredentials({
      access_token: user.googleTokens.accessToken,
      refresh_token: user.googleTokens.refreshToken,
    });

    // Define the parameters for the YouTube Analytics API request
    const analyticsParams = {
      auth: oauth2Client,
      ids: 'channel==MINE', // Use 'channel==MINE' to refer to the authenticated user's channel
      startDate: '2022-01-01', // Adjust dates as needed
      endDate: new Date().toISOString().split('T')[0], // Today's date
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained', // Add metrics as needed
    };

    // Fetch analytics data
    const response = await youtubeAnalytics.reports.query(analyticsParams);
    const analyticsData = response.data;

    res.status(200).json({ analyticsData: analyticsData });
  } catch (error) {
    console.error('Error fetching YouTube Analytics:', error);
    if (error.code === 401) {
      // Handle token expiration and refresh scenario
      // Refresh the token and retry the analytics request
    }
    res.status(500).send('Internal Server Error');
  }
};


const initiateTikTokOauth = async (req, res) => {
  const userId = req._id
//const nonce = generateNonce(); // Generate a random string for security
  const state = userId; // Implement encryption/encoding

  const tikTokAuthUrl = `https://open-api.tiktok.com/platform/oauth/connect/?client_key=${process.env.TIKTOK_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.TIKTOK_REDIRECT_URI)}&state=${state}&scope=user.info.basic,video.list`;res.redirect(tikTokAuthUrl);
  res.redirect(tikTokAuthUrl);
}

const tikTokCallback = async (req, res) => {
  try {
    const code = req.query.code;
    const userId = req.query.state;

      // Decrypt or decode the state parameter to get the userId
      //const [userId, nonce] = decryptOrDecode(state).split(':'); // Implement decryption/decoding

    const tokenResponse = await axios.post('https://open-api.tiktok.com/oauth/access_token/', {
      client_key: process.env.TIKTOK_CLIENT_ID,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code'
    });

    const accessToken = tokenResponse.data.data.access_token;
    // Store accessToken in your database associated with the user
    updateUser(userId, accessToken)

    res.send('TikTok authentication successful!');
  } catch (error) {
    console.error('Error during TikTok callback:', error);
    res.status(500).send('Authentication failed');
  }
}


//Aux functions
;

// function generateNonce(length = 32) {
//   return crypto.randomBytes(length).toString('hex');
// }

// async function updateUser(userId, accessToken) {
//   try {
//     const result = await User.updateOne(
//       { _id: userId }, // Find user by ID
//       { $set: { accessToken: accessToken } } // Set new values
//     );

//     if(result.matchedCount === 0) {
//       console.log('No user found with the given ID.');
//     } else {
//       console.log('User updated successfully.');
//     }
//   } catch (error) {
//     console.error('Error updating user:', error);
//   }
// }


// function encryptOrEncode(text) {
//   const iv = crypto.randomBytes(16); // generate a random initialization vector
//   const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(process.env.JWT_SECRET, 'hex'), iv);
  
//   let encrypted = cipher.update(text, 'utf8', 'hex');
//   encrypted += cipher.final('hex');

//   return iv.toString('hex') + ':' + encrypted;
// }

// function decryptOrDecode(encryptedText) {
//   try {
//     const textParts = encryptedText.split(':');
//     const iv = Buffer.from(textParts.shift(), 'hex'); // Extract the IV from the encrypted text
//     const encrypted = textParts.join(':');
//     const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(process.env.JWT_SECRET, 'hex'), iv);

//     let decrypted = decipher.update(Buffer.from(encrypted, 'hex'));
//     decrypted += decipher.final('utf8');

//     return decrypted;
//   } catch (error) {
//     console.error('Decryption failed:', error);
//     throw new Error('Failed to decrypt data');
//   }
// }


module.exports = {
  login,
  registerUser,
  forgotPassword,
  resetPassword,
  initiateOauth,
  googleCallback,
  verifyEmail,
  resendVerificationCode,
  tikTokCallback,
  initiateTikTokOauth,
  fetchYouTubeAnalytics
};
