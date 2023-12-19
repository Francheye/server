const User = require('../models/User');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, UnauthenticatedError } = require('../errors');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const oauth2Client = require('../oauth2Client');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../mailer');
const bcrypt = require('bcryptjs');

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

    // Send mail
    sendWelcomeEmail(email, name);

    console.log(user);

    // Prepare user data for response, excluding the password
    const userData = {
      _id: user._id,
      name: user.data.name,
      email: user.data.email,
      type: user.type, // Include 'type' in the response if needed
    };

    // Respond with user information (excluding password) and token
    res.status(StatusCodes.CREATED).json({
      user: userData,
      token,
    });
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

    res.status(StatusCodes.OK).json({ _id: user._id, token });
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

    sendPasswordResetEmail(user.data.email, resetCode);

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
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/plus.login',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/calendar',
    ],
  });
  res.redirect(authUrl);
};

const googleCallback = async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user information from Google API
    const user = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { given_name, family_name, email } = user.payload;

    // Check if the user is already registered
    const existingUser = await User.findOne({ 'data.email': email });

    if (!existingUser) {
      // Register the user if not already registered
      const newUser = await User.create({
        data: { firstName: given_name, lastName: family_name, email: email },
      });

      // Create a JWT token for authentication
      const jwtToken = jwt.sign({ email: email }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_LIFETIME, // Token expiration time
      });

      res.status(200).json({ user: newUser, token: jwtToken });
    } else {
      // User is already registered
      console.log('User is already registered');
      // Create a JWT token for authentication
      const jwtToken = jwt.sign({ email: email }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_LIFETIME, // Token expiration time
      });

      res.status(200).json({ user: existingUser, token: jwtToken });
    }
  } catch (error) {
    // Check for the "invalid_grant" error and handle it appropriately
    if (error.response && error.response.data && error.response.data.error === 'invalid_grant') {
      res.status(400).json({ error: 'Invalid authorization code or token.' });
    } else {
      res.status(500).send('Internal Server Error');
    }
  }
};

module.exports = {
  login,
  registerUser,
  forgotPassword,
  resetPassword,
  initiateOauth,
  googleCallback,
};
