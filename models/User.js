const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

require('dotenv').config(); // Ensure environment variables are properly loaded

// Define Personal Info schema
const PersonalInfoSchema = new mongoose.Schema({
  _id: false,
  name: {
    type: String,
    default: '',
    required: [true, 'Please provide your name'],
    minlength: [2, 'Name too short'],
    maxlength: [50, 'Name too long'],
    lowercase: true,
  },
  password: {
    type: String,
    required: false,
    minlength: [3, 'Password must be at least 3 characters'],
  },
  email: {
    type: String,
    default: '',
    required: [true, 'Please provide your email'],
    match: [
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      'Please provide a valid email',
    ],
    unique: true,
    lowercase: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  brandDetails:{
    webUrl:String,
    brandSocials:{
      facebook:String,
      instagram:String,
      twitter:String,
      tikTok:String
    },
    mission:String,
    whatYouDo:String,
    whatYouSell:String
  }
});

// Define Personal Info schema
const AnalyticSchema = new mongoose.Schema({
  _id: false,

  youtube:{
    lifeTimeTotalViews:Number,
    thirtyDaysViews:Number,
    avgViews:Number,
    subscribers:Number,
    estimatedMinutesWatched:Number,
    averageViewDuration:Number,
    likes:Number,
    shares:Number,
  
    accountOne:{
      lifeTimeTotalViews:Number,
      thirtyDays:Number,
      avgThirtyDays:Number,
      subscribers:Number,
      estimatedMinutesWatched:Number,
      averageViewDuration:Number,
      likes:Number,
      shares:Number,
    },

    accountTwo:{
      lifeTimeTotalViews:Number,
      thirtyDays:Number,
      avgThirtyDays:Number,
      subscribers:Number,
      estimatedMinutesWatched:Number,
      averageViewDuration:Number,
      likes:Number,
      shares:Number,
    },

    accountThree:{
      lifeTimeTotalViews:Number,
      thirtyDays:Number,
      avgThirtyDays:Number,
      subscribers:Number,
      estimatedMinutesWatched:Number,
      averageViewDuration:Number,
      likes:Number,
      shares:Number,
    },
   
  },

  tikTok:{
    lifeTimeTotalViews:Number,
      thirtyDays:Number,
      avgThirtyDays:Number,
  }
});

// Define User schema
const UserSchema = new mongoose.Schema({
  data: {
    type: PersonalInfoSchema,
  },

  analytics:{
     type: AnalyticSchema
  },

  type: {
    type: String,
    enum: ['creator', 'brand'],
    required: true,
  },

  tags: {
    region: {
      type: String,
      lowercase: true, // Convert region to lowercase
    },
    niche: {
      type: [String],
      set: niches => niches.map(niche => niche.toLowerCase()), // Convert each niche to lowercase
    },
    partner: {
      type: [String],
      set: partners => partners.map(partner => partner.toLowerCase()), // Convert each partner to lowercase
    },
    isOnboarded: {
      type: Boolean,
      default: false,
    },
  },

  isVerified: {
    type: Boolean,
    default: false,
  },

  emailVerified:{
    type:Boolean,
    default:false
  },

  isApproved:{
    type:Boolean,
    default:false
  },

  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
  },
  verificationCode:{
    type:String,
  },
  
  verificationCodeExpires:{
    type:Date
  },

  tikTokAccessToken:{
    type:String
  },

  googleTokens:{
    accessToken:String,
    refreshToken:String
  },
});

// Define a method for hashing the password
UserSchema.methods.hashPassword = async function () {
  if (this.data && this.data.password) {
    const saltRounds = 10;
    this.data.password = await bcrypt.hash(this.data.password, saltRounds);
  }
};

UserSchema.pre('save', async function (next) {
  try {
    if (this.isModified('data.password') || this.isNew) {
      if (this.data && this.data.password) {
        await this.hashPassword();
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});


UserSchema.methods.createJWT = function () {
  return jwt.sign(
    {
      _id: this._id,
      name: this.data.name,
      email: this.data.email,
      createdAt: this.data.createdAt,
      isVerified: this.isVerified,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_LIFETIME,
    }
  );
};

UserSchema.methods.comparePassword = async function (loginPassword) {
  const isMatch = await bcrypt.compare(loginPassword, this.data.password);
  return isMatch;
};

module.exports = mongoose.model('User', UserSchema);
