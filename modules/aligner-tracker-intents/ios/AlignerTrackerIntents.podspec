Pod::Spec.new do |s|
  s.name           = 'AlignerTrackerIntents'
  s.version        = '1.0.0'
  s.summary        = 'Native Siri and App Shortcuts bridge for Aligner Tracker'
  s.description    = 'Runs local wear-state mutations and notification reconciliation from iOS App Intents.'
  s.author         = 'AlecBytes'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.library = 'sqlite3'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "*.{h,m,mm,swift,hpp,cpp}"

  s.test_spec 'Tests' do |test_spec|
    test_spec.source_files = 'Tests/**/*.swift'
  end
end
