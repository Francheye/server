const User = require('../models/User');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, UnauthenticatedError } = require('../errors');
const jwt = require('jsonwebtoken');
const oauth2Client = require('../oauth2Client');
const { google } = require('googleapis');
const youtubeAnalytics = google.youtubeAnalytics('v2');
const youtube = google.youtube('v3');
const axios = require('axios'); 
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../mailer');
const bcrypt = require('bcryptjs');
require('dotenv').config();


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

      const token = user.createJWT();

      res.status(200).json({ token: token, user: user });
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

    res.status(StatusCodes.OK).json({ user: user, token: token });
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
  const state = req.params.id;
  let authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/yt-analytics.readonly',
      'https://www.googleapis.com/auth/userinfo.profile',
      
    ],
    state: state,
  });

  res.redirect(authUrl);
};


const googleCallback = async (req, res) => {
  const { code, state } = req.query;
// Check if the state is undefined
if (!state) {
  // Handle the error scenario
  return res.status(400).send('State parameter is missing');
}
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    
    //const channelId = await fetchYouTubeChannelId(tokens);

   // console.log('ChanneeeeeeelllllIdIs' + channelId)
    // Find or create a user record and update tokens
    let user = await User.findOneAndUpdate(
      { _id: state },
      { googleTokens: { accessToken: tokens.access_token, refreshToken: tokens.refresh_token } },
      { new: true, upsert: false }
    );


    // Redirect to analytics route with user's email or ID
    await fetchYouTubeAnalytics(state)

    //update user object
    res.redirect(`http://localhost:3000/dashboard`);
  } catch (error) {
    console.error('Error during Google OAuth callback:', error);
    res.status(400).send('Analytics Failed');
  }
};

const fetchYouTubeAnalytics = async ( userId) => {
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

    //Data Minining
   await mineYoutubeData(oauth2Client, userId)
    
   
  } catch (error) {
    console.error('Error fetching YouTube Analytics:', error);
    if (error.code === 401) {
      // Handle token expiration and refresh scenario
      // Refresh the token and retry the analytics request
      await refreshToken(oauth2Client, userId);
      await mineYoutubeData(oauth2Client, userId)
    }

  }
};

const initiateTikTokOauth = async (req, res) => {
  const state = req._id
//const nonce = generateNonce(); // Generate a random string for security

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

// Function to get date string 30 days ago from today
function getThirtyDaysAgoDate() {
    const today = new Date();
    today.setDate(today.getDate() - 30);
    return today.toISOString().split('T')[0];
  }


async function fetchYouTubeChannelId(tokens) {
  try {
    // Initialize the YouTube API client
    const youtube = google.youtube({
      version: 'v3',
      auth: tokens.access_token // Set the access token
    });

    // Fetch the channel details
    const response = await youtube.channels.list({
      part: 'id',
      mine: true // Indicates that we want the authenticated user's channel
    });

    // Check if the response contains channel information
    if (response.data.items && response.data.items.length > 0) {
      // Extract the channel ID
      const channelId = response.data.items[0].id;
      return channelId;
    } else {
      throw new Error('No channel found for the authenticated user.');
    }
  } catch (error) {
    console.error('Error in fetchYouTubeChannelId:', error);
    throw error;
  }
}

async function mineYoutubeData(oauth2Client, userId) {
    // Define the parameters for the YouTube Analytics API request
    const analyticsParams = {
        auth: oauth2Client,
        ids: 'channel==MINE', // Use 'channel==MINE' to refer to the authenticated user's channel
        startDate: '2000-01-01', // Adjust dates as needed
        endDate: new Date().toISOString().split('T')[0], // Today's date
        metrics: 'views,subscribersGained,estimatedMinutesWatched,averageViewDuration,likes,shares', // Add metrics as needed
      };
  
      const analyticsParams2 = {
        auth: oauth2Client,
        ids: 'channel==MINE', // Use 'channel==MINE' to refer to the authenticated user's channel
        startDate: getThirtyDaysAgoDate(), // 30 days ago
        endDate: new Date().toISOString().split('T')[0], // Today's date
        metrics: 'views', // Add metrics as needed
      };
  
      // Fetch analytics data
      const response = await youtubeAnalytics.reports.query(analyticsParams);
      const response2 = await youtubeAnalytics.reports.query(analyticsParams2);
      
      // Check if there are any rows in the response
  if (response && response2) {
      // Access the first row
     
      const firstRow = response.data.rows[0];
      const firstRow2 = response2.data.rows[0]
    
     // Convert minutes to hours and round to two decimal places
     const estimatedHoursWatched = (firstRow[2] / 60).toFixed(2);
     const averageHoursDuration = (firstRow[3] / 60).toFixed(2);
     
   
     const updateData = {
       'analytics.youtube.lifeTimeTotalViews': firstRow[0],
       'analytics.youtube.subscribers': firstRow[1],
       'analytics.youtube.thirtyDaysViews': firstRow2[0],
       'analytics.youtube.estimatedMinutesWatched': estimatedHoursWatched, // Now in hours
       'analytics.youtube.averageViewDuration': averageHoursDuration, // Now in hours
       'analytics.youtube.likes': firstRow[4],
       'analytics.youtube.shares': firstRow[5],
       'analytics.youtube.avgViews': firstRow2[0] / 30
     };
    const newUser = await User.findOneAndUpdate({ _id: userId }, { $set: updateData });
   return newUser
     // console.log(`Lifetime Views: ${LifetimeViews}, Total Subscribers: ${TotalSubscribers}, 30 Days Views: ${thirtyDaysViews}, Average 30 Days Views: ${avgViews}`);
    } else {
      console.log('No data available');
    }
  
}

// Define a helper function to refresh the access token
const refreshToken = async () => {
  const newTokens = await oauth2Client.refreshAccessToken();
  oauth2Client.setCredentials(newTokens.credentials);

    user.googleTokens.accessToken = newTokens.credentials.access_token
    
    await user.save()
}


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