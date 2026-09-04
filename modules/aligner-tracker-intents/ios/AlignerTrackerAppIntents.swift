import ExpoModulesCore
import Foundation
import UIKit

public enum AlignerTrackerIntentOutcome: String, Sendable {
  case alreadyInState = "already-in-state"
  case changed
  case noActiveTreatment = "no-active-treatment"
}

public struct AlignerTrackerIntentResult: Sendable {
  public let notificationFailed: Bool
  public let outcome: AlignerTrackerIntentOutcome
}

public enum AlignerTrackerIntentBridge {
  public static func ensureWearStatus(
    _ desiredStatusValue: String,
    timestamp: Int64
  ) async throws -> AlignerTrackerIntentResult {
    guard let desiredStatus = AlignerWearStatus(rawValue: desiredStatusValue) else {
      throw AlignerTrackerStoreError.invalidTrackerState
    }

    let result = try await AlignerTrackerWearStatusService.shared.ensureWearStatus(
      desiredStatus,
      timestamp: timestamp,
      emitChangeEvent: true
    )

    switch result.mutation {
    case .changed:
      return AlignerTrackerIntentResult(
        notificationFailed: result.notificationStatus == .failed,
        outcome: .changed
      )
    case .already:
      return AlignerTrackerIntentResult(
        notificationFailed: false,
        outcome: .alreadyInState
      )
    case .noActiveTreatment:
      return AlignerTrackerIntentResult(
        notificationFailed: false,
        outcome: .noActiveTreatment
      )
    }
  }
}

public final class AlignerTrackerIntentsAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    AlignerTrackerWatchConnectivityCoordinator.shared.activate()
    let updaterClass = NSClassFromString("AlignerTrackerAppShortcutsUpdater") as? NSObject.Type
    let updateSelector = NSSelectorFromString("updateAppShortcutParameters")
    if updaterClass?.responds(to: updateSelector) == true {
      _ = updaterClass?.perform(updateSelector)
    }
    return false
  }

  public func applicationDidBecomeActive(_ application: UIApplication) {
    _ = AlignerTrackerWatchConnectivityCoordinator.shared.publishLatestSnapshot()
  }
}
