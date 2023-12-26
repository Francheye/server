const nodemailer = require('nodemailer');
require('dotenv').config();


// Create a transporter object using the default SMTP transport
let transporter = nodemailer.createTransport({
  service: 'gmail', // Use your preferred service
  auth: {
    user: 'support@francheye.com', // Your email
    pass: 'wgunfwphwiuvlyum'
    , // Your password
  },
});

//Welcome Email Mailer Function
const sendWelcomeEmail = async (to, verificationCode) => {
  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: to,
    subject: '[Confirm your Email] Welcome to Francheye!',
    html: `
        <div style="font-family: Arial, sans-serif; text-align: left; color: #333; margin: 0 auto; max-width: 600px;">
          <a href='https://postimages.org/' target='_blank'>
            <img src='https://i.postimg.cc/9Fns794n/francheye-logo.png' border='0' alt='francheye-logo' style='width: 100%; max-width: 150px; height: auto;'/>
          </a>
          <p>Welcome to <span style="color: blue;">Francheye</span>, before you dive into our platform and start digital franchising, we need you to confirm your email address.</p>
          <p style="font-size: 18px; color: #00008B;"><strong>${verificationCode}</strong></p>
          <p>Enter this code in the provided field on our website. If you did not sign up for a Francheye account, please disregard this email.</p>
          <p>Thanks for joining the <span style="color: blue;">Francheye</span> Family.</p>
          <p>Best,</p>
          <p>The <span style="color: blue;">Francheye</span> Team</p>
          <footer>
            <p><small>© ${new Date().getFullYear()} <span style="color: blue;">Francheye</span>. All rights reserved.</small></p>
          </footer>
        </div>`
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        reject(error);
      } else {
        console.log('Email sent: ' + info.response);
        resolve(info.response);
      }
    });
  });

}


const sendPasswordResetEmail = async (to, resetCode) => {
  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: to,
    subject: 'Password Reset Request',
    html: `
        <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
          <h2>Password Reset Instructions</h2>
          <p>Hello,</p>
          <p>You recently requested to reset your password for your Francheye account. Your password reset code is:</p>
          <p style="font-size: 18px; color: #4A90E2;"><b>${resetCode}</b></p>
          <p>Enter this code in the provided field to set up a new password. If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
          <footer>
            <p><small>© ${new Date().getFullYear()} Francheye. All rights reserved.</small></p>
          </footer>
        </div>`,
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        reject(error);
      } else {
        console.log('Email sent: ' + info.response);
        resolve(info.response);
      }
    });
  });

}

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail,
};
