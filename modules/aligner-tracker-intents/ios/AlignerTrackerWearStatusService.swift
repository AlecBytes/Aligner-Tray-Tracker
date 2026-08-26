import Foundation

let alignerWearStatusChangedNotification = Notification.Name(
  "AlignerTrackerWearStatusChanged"
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

actor AlignerTrackerWearStatusService {
  static let shared = AlignerTrackerWearStatusService()

  func ensureWearStatus(
    _ desiredStatus: AlignerWearStatus,
    timestamp: Int64,
    emitChangeEvent: Bool
  ) async throws -> AlignerWearStatusServiceResult {
    let mutation = try AlignerTrackerStore.ensureWearStatus(
      desiredStatus,
      timestamp: timestamp
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

    let notificationStatus: AlignerNotificationReconciliationResult
    do {
      try await AlignerTrackerNotificationCoordinator.shared.reconcile()
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
