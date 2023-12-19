const mongoose = require('mongoose');
const User = require('./User')

// Define the schema
const campaignSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Campaign title is required'],
    trim: true,
    maxlength: [80, 'Campaign title cannot exceed 80 characters']
  },
  description: {
    overview: {
      type: String,
      required: [true, 'Overview is required'],
    },
    platform: {
      type: String,
      required: [true, 'Platform is required'],
    },
    responsibilities: {
      type: String,
      required: [true, 'Responsibilities are required'],
    },
    qualification: {
      type: String,
      required: [true, 'Qualification is required'],
    },
    applicationMethod: {
      type: String,
      required: [true, 'Application method is required'],
    }
  },

  price:{
    min:Number,
    max:Number
  },

  exampleContent:{
    content1:String,
    content2:String,
    content3:String
  },

  contactInfo:{
    type:String,
  },

  isVerified:{
    type:Boolean,
    default:false
  },

  createdBy:{
    type:mongoose.Schema.Types.ObjectId,
    ref:'User',
    required:true
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
  // Add more fields here as needed
});

// Create the model
const Campaign = mongoose.model('Campaign', campaignSchema);

module.exports = Campaign;
