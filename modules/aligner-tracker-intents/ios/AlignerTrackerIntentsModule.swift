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

    AsyncFunction("commitWearStatus") {
      (statusValue: String, timestampValue: Double) async throws -> [String: Any] in
      guard let status = AlignerWearStatus(rawValue: statusValue),
            timestampValue.isFinite,
            timestampValue > 0,
            timestampValue <= Double(Int64.max) else {
        throw AlignerTrackerStoreError.invalidTrackerState
      }

      let startedAt = ProcessInfo.processInfo.systemUptime
      let mutation = try await AlignerTrackerWearStatusService.shared.commitWearStatus(
        status,
        timestamp: Int64(timestampValue.rounded(.down)),
        emitChangeEvent: false
      )
      var bridged = Self.bridgeMutation(mutation)
      bridged["nativeCommitDurationMs"] =
        (ProcessInfo.processInfo.systemUptime - startedAt) * 1_000
      return bridged
    }

    AsyncFunction("reconcileNotifications") { () async -> Bool in
      do {
        try await AlignerTrackerNotificationCoordinator.shared.reconcile()
        return true
      } catch {
        return false
      }
    }

    AsyncFunction("refreshWatchTrackerSnapshot") { () -> Bool in
      AlignerTrackerWatchConnectivityCoordinator.shared.publishLatestSnapshot()
    }
  }

  private static func bridgeResult(
    _ result: AlignerWearStatusServiceResult
  ) -> [String: Any] {
    var bridged = bridgeMutation(result.mutation)
    bridged["notificationStatus"] = result.notificationStatus.rawValue
    return bridged
  }

  private static func bridgeMutation(_ mutation: AlignerWearMutation) -> [String: Any] {
    switch mutation {
    case let .changed(change):
      return [
        "outcome": "changed",
        "trayPeriodId": change.trayPeriodId,
        "predecessor": [
          "id": change.predecessor.id,
          "status": change.predecessor.status.rawValue,
          "timestamp": change.predecessor.timestamp,
        ],
        "punch": [
          "id": change.punch.id,
          "status": change.punch.status.rawValue,
          "timestamp": change.punch.timestamp,
        ],
      ]
    case let .already(status):
      return [
        "outcome": "already-in-state",
        "status": status.rawValue,
      ]
    case .retainerMode:
      return ["outcome": "no-active-treatment"]
    case .noActiveTreatment:
      return [
        "outcome": "no-active-treatment",
      ]
    }
  }
}
