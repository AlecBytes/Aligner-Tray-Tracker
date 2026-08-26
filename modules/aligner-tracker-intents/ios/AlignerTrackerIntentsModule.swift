import ExpoModulesCore
import Foundation

public class AlignerTrackerIntentsModule: Module {
  private var wearStatusObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("AlignerTrackerIntents")

    Events("onWearStatusChanged")

    OnCreate { [weak self] in
      self?.wearStatusObserver = NotificationCenter.default.addObserver(
        forName: alignerWearStatusChangedNotification,
        object: nil,
        queue: .main
      ) { [weak self] notification in
        guard let status = notification.userInfo?["status"] as? String,
              let timestamp = notification.userInfo?["timestamp"] as? Int64 else {
          return
        }
        self?.sendEvent(
          "onWearStatusChanged",
          ["status": status, "timestamp": timestamp]
        )
      }
    }

    OnDestroy { [weak self] in
      if let observer = self?.wearStatusObserver {
        NotificationCenter.default.removeObserver(observer)
      }
      self?.wearStatusObserver = nil
    }

    AsyncFunction("ensureWearStatus") {
      (statusValue: String, timestampValue: Double) async throws -> [String: Any] in
      guard let status = AlignerWearStatus(rawValue: statusValue),
            timestampValue.isFinite,
            timestampValue > 0,
            timestampValue <= Double(Int64.max) else {
        throw AlignerTrackerStoreError.invalidTrackerState
      }

      let result = try await AlignerTrackerWearStatusService.shared.ensureWearStatus(
        status,
        timestamp: Int64(timestampValue.rounded(.down)),
        emitChangeEvent: false
      )
      return Self.bridgeResult(result)
    }

    AsyncFunction("reconcileNotifications") { () async -> Bool in
      do {
        try await AlignerTrackerNotificationCoordinator.shared.reconcile()
        return true
      } catch {
        return false
      }
    }
  }

  private static func bridgeResult(
    _ result: AlignerWearStatusServiceResult
  ) -> [String: Any] {
    switch result.mutation {
    case let .changed(punch):
      return [
        "notificationStatus": result.notificationStatus.rawValue,
        "outcome": "changed",
        "punch": [
          "id": punch.id,
          "status": punch.status.rawValue,
          "timestamp": punch.timestamp,
        ],
      ]
    case let .already(status):
      return [
        "notificationStatus": AlignerNotificationReconciliationResult.notNeeded.rawValue,
        "outcome": "already-in-state",
        "status": status.rawValue,
      ]
    case .noActiveTreatment:
      return [
        "notificationStatus": AlignerNotificationReconciliationResult.notNeeded.rawValue,
        "outcome": "no-active-treatment",
      ]
    }
  }
}
