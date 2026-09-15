Pod::Spec.new do |s|
  s.name           = 'TrackerStatusControl'
  s.version        = '1.0.0'
  s.summary        = 'Native pressed styling for the Aligner Tracker status control'
  s.description    = 'Registers the feature-local Expo UI modifier used by the iOS tracker button.'
  s.author         = 'AlecBytes'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'ExpoUI'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "*.{h,m,mm,swift,hpp,cpp}"
end
