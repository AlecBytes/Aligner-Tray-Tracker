import Foundation

let alignerWearStatusChangedNotification = Notification.Name(
  "AlignerTrackerWearStatusChanged"
)
let alignerTrackerSnapshotNeedsRefreshNotification = Notification.Name(
  "AlignerTrackerSnapshotNeedsRefresh"
)

enum AlignerNotificationReconciliationResult: String, Sendable {
  case failed
  case notNeeded = "not-needed"
  case reconciled
}

struct AlignerWearStatusServiceResult: Sendable {
  let mutation: AlignerWearMutation
  let notificationStatus: AlignerNotificationReconciliationResult
}

typealias AlignerNotificationReconciler = @Sendable () async throws -> Void

actor AlignerTrackerWearStatusService {
  static let shared = AlignerTrackerWearStatusService()

  func ensureWearStatus(
    _ desiredStatus: AlignerWearStatus,
    timestamp: Int64,
    emitChangeEvent: Bool,
    databaseURL: URL? = nil,
    notificationReconciler: @escaping AlignerNotificationReconciler = {
      try await AlignerTrackerNotificationCoordinator.shared.reconcile()
    }
  ) async throws -> AlignerWearStatusServiceResult {
    let mutation = try AlignerTrackerStore.ensureWearStatus(
      desiredStatus,
      timestamp: timestamp,
      databaseURL: databaseURL
    )

    guard case let .changed(punch) = mutation else {
      return AlignerWearStatusServiceResult(
        mutation: mutation,
        notificationStatus: .notNeeded
      )
    }

    if emitChangeEvent {
      NotificationCenter.default.post(
        name: alignerWearStatusChangedNotification,
        object: nil,
        userInfo: [
          "status": punch.status.rawValue,
          "timestamp": punch.timestamp,
        ]
      )
    }

    NotificationCenter.default.post(
      name: alignerTrackerSnapshotNeedsRefreshNotification,
      object: nil
    )

    let notificationStatus: AlignerNotificationReconciliationResult
    do {
      try await notificationReconciler()
      notificationStatus = .reconciled
    } catch {
      notificationStatus = .failed
    }

    return AlignerWearStatusServiceResult(
      mutation: mutation,
      notificationStatus: notificationStatus
    )
  }
}
