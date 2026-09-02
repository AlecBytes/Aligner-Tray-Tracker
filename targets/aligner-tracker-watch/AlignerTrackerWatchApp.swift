import SwiftUI

@main
struct AlignerTrackerWatchApp: App {
  @StateObject private var tracker = WatchTrackerModel()

  var body: some Scene {
    WindowGroup {
      WatchTrackerView(model: tracker)
    }
  }
}
