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

  func commitWearStatus(
    _ desiredStatus: AlignerWearStatus,
    timestamp: Int64,
    emitChangeEvent: Bool,
    databaseURL: URL? = nil
  ) throws -> AlignerWearMutation {
    let mutation = try AlignerTrackerStore.ensureWearStatus(
      desiredStatus,
      timestamp: timestamp,
      databaseURL: databaseURL
    )

    guard case let .changed(change) = mutation else {
      return mutation
    }

    if emitChangeEvent {
      NotificationCenter.default.post(
        name: alignerWearStatusChangedNotification,
        object: nil,
        userInfo: [
          "status": change.punch.status.rawValue,
          "timestamp": change.punch.timestamp,
        ]
      )
    }

    NotificationCenter.default.post(
      name: alignerTrackerSnapshotNeedsRefreshNotification,
      object: nil
    )
    return mutation
  }

  func ensureWearStatus(
    _ desiredStatus: AlignerWearStatus,
    timestamp: Int64,
    emitChangeEvent: Bool,
    databaseURL: URL? = nil,
    notificationReconciler: @escaping AlignerNotificationReconciler = {
      try await AlignerTrackerNotificationCoordinator.shared.reconcile()
    }
  ) async throws -> AlignerWearStatusServiceResult {
    let mutation = try commitWearStatus(
      desiredStatus,
      timestamp: timestamp,
      emitChangeEvent: emitChangeEvent,
      databaseURL: databaseURL
    )

    guard case .changed = mutation else {
      return AlignerWearStatusServiceResult(
        mutation: mutation,
        notificationStatus: .notNeeded
      )
    }

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
