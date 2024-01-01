const cron = require('node-cron');
const {fetchYouTubeAnalytics} = require('../controllers/auth')


const scheduledTask = () => {
cron.schedule('0 0 * * *', async () => {
  console.log('Running a task every 24 hours');
  const creators = await User.find({ 
    type: 'creator', 
    'googleTokens.accessToken': { $exists: true, $ne: null } 
  });

  for (const creator of creators) {
    await fetchYouTubeAnalytics(creator._id);
  }
});

}

module.exports = scheduledTask;
