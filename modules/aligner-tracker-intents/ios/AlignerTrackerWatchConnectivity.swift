import Foundation
import WatchConnectivity

private enum AlignerWatchProtocol {
  static let version = 1

  static func noTreatmentSnapshot(generatedAt: Int64) -> [String: Any] {
    [
      "version": version,
      "kind": "no-treatment",
      "generatedAtMs": generatedAt,
    ]
  }

  static func response(
    requestId: String,
    outcome: String,
    snapshot: [String: Any]? = nil,
    notificationWarning: Bool? = nil
  ) -> [String: Any] {
    var response: [String: Any] = [
      "version": version,
      "requestId": requestId,
      "outcome": outcome,
    ]
    if let snapshot {
      response["snapshot"] = snapshot
    }
    if let notificationWarning {
      response["notificationWarning"] = notificationWarning
    }
    return response
  }
}

enum AlignerTrackerWatchBridge {
  static func currentSnapshotPayload(
    now: Date = Date(),
    databaseURL: URL? = nil
  ) throws -> [String: Any] {
    if let snapshot = try AlignerTrackerStore.loadWatchTrackerSnapshot(
      now: now,
      databaseURL: databaseURL
    ) {
      return snapshot.dictionary
    }
    let generatedAt = Int64((now.timeIntervalSince1970 * 1_000).rounded(.down))
    return AlignerWatchProtocol.noTreatmentSnapshot(generatedAt: generatedAt)
  }

  static func handle(
    _ message: [String: Any],
    now: Date = Date(),
    databaseURL: URL? = nil,
    notificationReconciler: @escaping AlignerNotificationReconciler = {
      try await AlignerTrackerNotificationCoordinator.shared.reconcile()
    }
  ) async -> [String: Any] {
    let requestId = message["requestId"] as? String ?? ""
    guard (message["version"] as? NSNumber)?.intValue == AlignerWatchProtocol.version,
          !requestId.isEmpty,
          let operation = message["operation"] as? String else {
      return AlignerWatchProtocol.response(requestId: requestId, outcome: "failed")
    }

    do {
      switch operation {
      case "getSnapshot":
        let snapshot = try currentSnapshotPayload(now: now, databaseURL: databaseURL)
        let outcome = snapshot["kind"] as? String == "no-treatment"
          ? "no-treatment"
          : "state-conflict"
        return AlignerWatchProtocol.response(
          requestId: requestId,
          outcome: outcome,
          snapshot: snapshot
        )

      case "setWearStatus":
        guard let expectedValue = message["expectedStatus"] as? String,
              let desiredValue = message["desiredStatus"] as? String,
              let expectedStatus = AlignerWearStatus(rawValue: expectedValue),
              let desiredStatus = AlignerWearStatus(rawValue: desiredValue),
              expectedStatus != desiredStatus else {
          return AlignerWatchProtocol.response(requestId: requestId, outcome: "failed")
        }

        let timestamp = Int64((now.timeIntervalSince1970 * 1_000).rounded(.down))
        let result = try await AlignerTrackerWearStatusService.shared.ensureWearStatus(
          desiredStatus,
          timestamp: timestamp,
          emitChangeEvent: true,
          databaseURL: databaseURL,
          notificationReconciler: notificationReconciler
        )
        let snapshot = try currentSnapshotPayload(now: now, databaseURL: databaseURL)
        switch result.mutation {
        case .changed:
          return AlignerWatchProtocol.response(
            requestId: requestId,
            outcome: "changed",
            snapshot: snapshot,
            notificationWarning: result.notificationStatus == .failed ? true : nil
          )
        case .already:
          return AlignerWatchProtocol.response(
            requestId: requestId,
            outcome: "state-conflict",
            snapshot: snapshot
          )
        case .noActiveTreatment:
          return AlignerWatchProtocol.response(
            requestId: requestId,
            outcome: "no-treatment",
            snapshot: snapshot
          )
        }

      default:
        return AlignerWatchProtocol.response(requestId: requestId, outcome: "failed")
      }
    } catch {
      return AlignerWatchProtocol.response(requestId: requestId, outcome: "failed")
    }
  }
}

final class AlignerTrackerWatchConnectivityCoordinator: NSObject, WCSessionDelegate {
  static let shared = AlignerTrackerWatchConnectivityCoordinator()

  private var dataChangeObserver: NSObjectProtocol?
  private var session: WCSession?

  private override init() {
    super.init()
    dataChangeObserver = NotificationCenter.default.addObserver(
      forName: alignerTrackerSnapshotNeedsRefreshNotification,
      object: nil,
      queue: nil
    ) { [weak self] _ in
      DispatchQueue.global(qos: .utility).async {
        _ = self?.publishLatestSnapshot()
      }
    }
  }

  deinit {
    if let dataChangeObserver {
      NotificationCenter.default.removeObserver(dataChangeObserver)
    }
  }

  func activate() {
    guard WCSession.isSupported() else {
      return
    }
    let session = WCSession.default
    self.session = session
    session.delegate = self
    session.activate()
  }

  @discardableResult
  func publishLatestSnapshot() -> Bool {
    guard let session,
          session.activationState == .activated,
          session.isPaired,
          session.isWatchAppInstalled else {
      return false
    }
    do {
      try session.updateApplicationContext(
        AlignerTrackerWatchBridge.currentSnapshotPayload()
      )
      return true
    } catch {
      return false
    }
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if activationState == .activated && error == nil {
      _ = publishLatestSnapshot()
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func sessionWatchStateDidChange(_ session: WCSession) {
    _ = publishLatestSnapshot()
  }

  func session(
    _ session: WCSession,
    didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    Task {
      replyHandler(await AlignerTrackerWatchBridge.handle(message))
    }
  }
}
