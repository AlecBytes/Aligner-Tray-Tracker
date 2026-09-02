import Combine
import Foundation
import WatchConnectivity
import WatchKit

struct WatchTrackerSnapshot: Codable, Equatable {
  enum Kind: String, Codable {
    case noTreatment = "no-treatment"
    case ready
  }

  let version: Int
  let kind: Kind
  let currentTrayNumber: Int?
  let totalTrays: Int?
  let trayDay: Int?
  let status: String?
  let inTodayMinutes: Int?
  let outTodayMinutes: Int?
  let generatedAtMs: Int64

  var isReady: Bool {
    kind == .ready
      && currentTrayNumber != nil
      && totalTrays != nil
      && trayDay != nil
      && (status == "IN" || status == "OUT")
      && inTodayMinutes != nil
      && outTodayMinutes != nil
  }

  init?(dictionary: [String: Any]) {
    guard (dictionary["version"] as? NSNumber)?.intValue == 1,
          let kindValue = dictionary["kind"] as? String,
          let kind = Kind(rawValue: kindValue),
          let generatedAt = dictionary["generatedAtMs"] as? NSNumber else {
      return nil
    }
    version = 1
    self.kind = kind
    generatedAtMs = generatedAt.int64Value

    if kind == .noTreatment {
      currentTrayNumber = nil
      totalTrays = nil
      trayDay = nil
      status = nil
      inTodayMinutes = nil
      outTodayMinutes = nil
      return
    }

    guard let currentTrayNumber = dictionary["currentTrayNumber"] as? NSNumber,
          let totalTrays = dictionary["totalTrays"] as? NSNumber,
          let trayDay = dictionary["trayDay"] as? NSNumber,
          let status = dictionary["status"] as? String,
          status == "IN" || status == "OUT",
          let inTodayMinutes = dictionary["inTodayMinutes"] as? NSNumber,
          let outTodayMinutes = dictionary["outTodayMinutes"] as? NSNumber else {
      return nil
    }
    self.currentTrayNumber = currentTrayNumber.intValue
    self.totalTrays = totalTrays.intValue
    self.trayDay = trayDay.intValue
    self.status = status
    self.inTodayMinutes = max(0, inTodayMinutes.intValue)
    self.outTodayMinutes = max(0, outTodayMinutes.intValue)
  }
}

final class WatchTrackerModel: NSObject, ObservableObject, WCSessionDelegate {
  private enum Operation {
    case refresh
    case toggle(desiredStatus: String)
  }

  private static let cacheKey = "watchTrackerSnapshotV1"
  private static let protocolVersion = 1
  private static let requestTimeout: TimeInterval = 10

  @Published private(set) var errorMessage: String?
  @Published private(set) var isLoading: Bool
  @Published private(set) var isPending = false
  @Published private(set) var isReachable = false
  @Published private(set) var snapshot: WatchTrackerSnapshot?

  private var activeOperation: Operation?
  private var activeRequestId: String?
  private var hasStarted = false
  private var session: WCSession?
  private var timeoutWorkItem: DispatchWorkItem?

  override init() {
    let cachedSnapshot = Self.loadCachedSnapshot()
    snapshot = cachedSnapshot
    isLoading = cachedSnapshot == nil
    super.init()
  }

  func start() {
    guard !hasStarted else {
      return
    }
    hasStarted = true
    guard WCSession.isSupported() else {
      isLoading = false
      errorMessage = "iPhone unavailable"
      return
    }
    let session = WCSession.default
    self.session = session
    session.delegate = self
    session.activate()
  }

  func toggleWearStatus() {
    guard isReachable,
          !isPending,
          let snapshot,
          snapshot.isReady,
          let expectedStatus = snapshot.status else {
      return
    }
    let desiredStatus = expectedStatus == "IN" ? "OUT" : "IN"
    send(
      operation: .toggle(desiredStatus: desiredStatus),
      message: [
        "version": Self.protocolVersion,
        "requestId": UUID().uuidString,
        "operation": "setWearStatus",
        "expectedStatus": expectedStatus,
        "desiredStatus": desiredStatus,
      ]
    )
  }

  func refresh() {
    guard isReachable, !isPending else {
      if snapshot == nil {
        isLoading = false
      }
      return
    }
    send(
      operation: .refresh,
      message: [
        "version": Self.protocolVersion,
        "requestId": UUID().uuidString,
        "operation": "getSnapshot",
      ]
    )
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    DispatchQueue.main.async {
      self.isReachable = activationState == .activated && session.isReachable
      if activationState == .activated,
         let received = self.snapshot(from: session.receivedApplicationContext) {
        self.accept(received)
      }
      if error != nil {
        self.isLoading = false
        self.errorMessage = "iPhone unavailable"
      } else if self.isReachable {
        self.refresh()
      } else if self.snapshot == nil {
        self.isLoading = false
      }
    }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    DispatchQueue.main.async {
      self.isReachable = session.isReachable
      if session.isReachable {
        self.refresh()
      } else if self.isPending {
        self.failActiveRequest(message: "iPhone unavailable")
      }
    }
  }

  func session(
    _ session: WCSession,
    didReceiveApplicationContext applicationContext: [String: Any]
  ) {
    guard let snapshot = snapshot(from: applicationContext) else {
      return
    }
    DispatchQueue.main.async {
      self.accept(snapshot)
    }
  }

  private func send(operation: Operation, message: [String: Any]) {
    guard let session,
          session.activationState == .activated,
          session.isReachable,
          let requestId = message["requestId"] as? String else {
      errorMessage = "iPhone unavailable"
      isLoading = false
      return
    }

    timeoutWorkItem?.cancel()
    activeRequestId = requestId
    activeOperation = operation
    errorMessage = nil
    if case .toggle = operation {
      isPending = true
    } else if snapshot == nil {
      isLoading = true
    }

    let timeout = DispatchWorkItem { [weak self] in
      guard self?.activeRequestId == requestId else {
        return
      }
      self?.failActiveRequest(message: "Couldn't update")
    }
    timeoutWorkItem = timeout
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.requestTimeout, execute: timeout)

    session.sendMessage(
      message,
      replyHandler: { [weak self] response in
        DispatchQueue.main.async {
          self?.handle(response: response, requestId: requestId)
        }
      },
      errorHandler: { [weak self] _ in
        DispatchQueue.main.async {
          guard self?.activeRequestId == requestId else {
            return
          }
          self?.failActiveRequest(message: "Couldn't update")
        }
      }
    )
  }

  private func handle(response: [String: Any], requestId: String) {
    guard activeRequestId == requestId else {
      return
    }
    guard (response["version"] as? NSNumber)?.intValue == Self.protocolVersion,
          response["requestId"] as? String == requestId,
          let outcome = response["outcome"] as? String else {
      failActiveRequest(message: "Couldn't update")
      return
    }
    let operation = activeOperation
    finishActiveRequest()

    if let snapshotDictionary = response["snapshot"] as? [String: Any],
       let returnedSnapshot = snapshot(from: snapshotDictionary) {
      accept(returnedSnapshot)
    }

    switch operation {
    case .some(.refresh):
      if outcome == "failed" {
        errorMessage = "Couldn't refresh"
      }
    case let .some(.toggle(desiredStatus)):
      if outcome == "changed", snapshot?.status == desiredStatus {
        errorMessage = (response["notificationWarning"] as? Bool) == true
          ? "Saved; check reminders on iPhone"
          : nil
        WKInterfaceDevice.current().play(.success)
      } else {
        errorMessage = outcome == "no-treatment" ? nil : "State changed on iPhone"
        WKInterfaceDevice.current().play(.failure)
      }
    case .none:
      break
    }
  }

  private func failActiveRequest(message: String) {
    let wasToggle: Bool
    if case .some(.toggle) = activeOperation {
      wasToggle = true
    } else {
      wasToggle = false
    }
    finishActiveRequest()
    errorMessage = message
    if wasToggle {
      WKInterfaceDevice.current().play(.failure)
    }
  }

  private func finishActiveRequest() {
    timeoutWorkItem?.cancel()
    timeoutWorkItem = nil
    activeRequestId = nil
    activeOperation = nil
    isPending = false
    isLoading = false
  }

  private func accept(_ snapshot: WatchTrackerSnapshot) {
    self.snapshot = snapshot
    isLoading = false
    Self.cache(snapshot)
  }

  private func snapshot(from dictionary: [String: Any]) -> WatchTrackerSnapshot? {
    WatchTrackerSnapshot(dictionary: dictionary)
  }

  private static func cache(_ snapshot: WatchTrackerSnapshot) {
    guard let data = try? JSONEncoder().encode(snapshot) else {
      return
    }
    UserDefaults.standard.set(data, forKey: cacheKey)
  }

  private static func loadCachedSnapshot() -> WatchTrackerSnapshot? {
    guard let data = UserDefaults.standard.data(forKey: cacheKey),
          let snapshot = try? JSONDecoder().decode(WatchTrackerSnapshot.self, from: data),
          snapshot.version == protocolVersion else {
      return nil
    }
    return snapshot
  }
}
