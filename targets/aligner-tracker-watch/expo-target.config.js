/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'watch',
  name: 'AlignerTrackerWatch',
  displayName: 'Aligner Tracker',
  bundleIdentifier: '.watchapp',
  deploymentTarget: '9.0',
  icon: '../../assets/images/ios-icon.png',
  colors: {
    $accent: '#2F046F',
  },
  frameworks: ['WatchConnectivity'],
});
