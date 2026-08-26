import Foundation
import UserNotifications

private let alignerReminderFingerprintKey = "alignerReminderFingerprint"
private let alignerReminderKindKey = "alignerReminderKind"
private let alignerMaximumPendingReminders = 64

enum AlignerReminderKind: String, Sendable {
  case outTooLong = "out-too-long"
  case trayChange = "tray-change"
}

struct AlignerReminder: Sendable {
  let body: String
  let fingerprint: String
  let kind: AlignerReminderKind
  let scheduledAt: Date
}

struct AlignerScheduledReminder: Sendable {
  let fingerprint: String?
  let identifier: String
  let kind: String?
}

struct AlignerReminderReconciliation: Sendable {
  let cancelIdentifiers: [String]
  let schedule: [AlignerReminder]
}

actor AlignerTrackerNotificationCoordinator {
  static let shared = AlignerTrackerNotificationCoordinator()

  func reconcile(now: Date = Date()) async throws {
    let center = UNUserNotificationCenter.current()
    let authorization = await center.notificationSettings().authorizationStatus
    let canSchedule = authorization == .authorized
      || authorization == .provisional
      || authorization == .ephemeral
    let snapshot = try AlignerTrackerStore.loadNotificationSnapshot()
    let desired = canSchedule
      ? AlignerTrackerReminderPolicy.build(snapshot: snapshot, now: now)
      : []
    let pending = await center.pendingNotificationRequests()

    let reconciliation = AlignerTrackerReminderPolicy.plan(
      desired: desired,
      scheduled: pending.map {
        AlignerScheduledReminder(
          fingerprint: $0.content.userInfo[alignerReminderFingerprintKey] as? String,
          identifier: $0.identifier,
          kind: $0.content.userInfo[alignerReminderKindKey] as? String
        )
      }
    )

    if !reconciliation.cancelIdentifiers.isEmpty {
      center.removePendingNotificationRequests(
        withIdentifiers: reconciliation.cancelIdentifiers
      )
    }

    for reminder in reconciliation.schedule {
      let content = UNMutableNotificationContent()
      content.title = "Aligner Tracker"
      content.body = reminder.body
      content.sound = .default
      content.userInfo = [
        alignerReminderFingerprintKey: reminder.fingerprint,
        alignerReminderKindKey: reminder.kind.rawValue,
      ]

      let triggerComponents = Calendar.current.dateComponents(
        [.year, .month, .day, .hour, .minute, .second],
        from: reminder.scheduledAt
      )
      let request = UNNotificationRequest(
        identifier: identifier(for: reminder),
        content: content,
        trigger: UNCalendarNotificationTrigger(
          dateMatching: triggerComponents,
          repeats: false
        )
      )
      try await center.add(request)
    }
  }

  private func identifier(for reminder: AlignerReminder) -> String {
    switch reminder.kind {
    case .trayChange:
      return "aligner-tracker-tray-change"
    case .outTooLong:
      return "aligner-tracker-out-too-long-\(reminder.fingerprint)"
    }
  }
}

enum AlignerTrackerReminderPolicy {
  static func build(
    snapshot: AlignerNotificationSnapshot?,
    now: Date
  ) -> [AlignerReminder] {
    guard let snapshot else {
      return []
    }

    var reminders: [AlignerReminder] = []
    let calendar = Calendar.current
    let trayStart = Date(timeIntervalSince1970: Double(snapshot.trayStartedAt) / 1_000)
    let nextTrayNumber = snapshot.currentTrayNumber + 1

    if snapshot.settings.trayChangeReminderEnabled,
       nextTrayNumber <= snapshot.totalTrays,
       let trayChangeDay = calendar.date(
         byAdding: .day,
         value: snapshot.daysPerTray,
         to: trayStart
       ),
       let trayChangeAt = calendar.date(
         bySettingHour: snapshot.settings.trayChangeReminderHour,
         minute: snapshot.settings.trayChangeReminderMinute,
         second: 0,
         of: trayChangeDay
       ),
       trayChangeAt > now {
      reminders.append(
        AlignerReminder(
          body: "You are scheduled to change to Tray \(nextTrayNumber) today.",
          fingerprint: fingerprint(
            kind: .trayChange,
            scheduledAt: trayChangeAt,
            subject: Int64(nextTrayNumber)
          ),
          kind: .trayChange,
          scheduledAt: trayChangeAt
        )
      )
    }

    if snapshot.settings.outReminderEnabled,
       snapshot.latestPunch.status == .outTrays {
      let latestPunchAt = Date(
        timeIntervalSince1970: Double(snapshot.latestPunch.timestamp) / 1_000
      )
      let initialInterval = TimeInterval(snapshot.settings.outReminderMinutes * 60)
      let persistentInterval = TimeInterval(
        snapshot.settings.outPersistentReminderIntervalMinutes * 60
      )
      let initialReminderAt = latestPunchAt.addingTimeInterval(initialInterval)
      let firstReminderAt: Date
      if initialReminderAt > now {
        firstReminderAt = initialReminderAt
      } else {
        let elapsed = now.timeIntervalSince(initialReminderAt)
        let intervalsElapsed = floor(elapsed / persistentInterval) + 1
        firstReminderAt = initialReminderAt.addingTimeInterval(
          intervalsElapsed * persistentInterval
        )
      }

      let availableSlots = alignerMaximumPendingReminders - reminders.count
      for index in 0..<availableSlots {
        let scheduledAt = firstReminderAt.addingTimeInterval(
          TimeInterval(index) * persistentInterval
        )
        let isInitialReminder = scheduledAt == initialReminderAt
        reminders.append(
          AlignerReminder(
            body: isInitialReminder
              ? "Your trays have been out for \(snapshot.settings.outReminderMinutes) minutes."
              : "Your trays are still out. Put them back in.",
            fingerprint: fingerprint(
              kind: .outTooLong,
              scheduledAt: scheduledAt,
              subject: snapshot.trayPeriodId
            ),
            kind: .outTooLong,
            scheduledAt: scheduledAt
          )
        )
      }
    }

    return reminders
  }

  static func plan(
    desired: [AlignerReminder],
    scheduled: [AlignerScheduledReminder]
  ) -> AlignerReminderReconciliation {
    let desiredByFingerprint = Dictionary(
      uniqueKeysWithValues: desired.map { ($0.fingerprint, $0) }
    )
    var keptFingerprints = Set<String>()
    var cancelIdentifiers: [String] = []

    for reminder in scheduled {
      guard let kind = reminder.kind,
            AlignerReminderKind(rawValue: kind) != nil else {
        continue
      }

      if let fingerprint = reminder.fingerprint,
         desiredByFingerprint[fingerprint] != nil,
         !keptFingerprints.contains(fingerprint) {
        keptFingerprints.insert(fingerprint)
      } else {
        cancelIdentifiers.append(reminder.identifier)
      }
    }

    return AlignerReminderReconciliation(
      cancelIdentifiers: cancelIdentifiers,
      schedule: desired.filter { !keptFingerprints.contains($0.fingerprint) }
    )
  }

  private static func fingerprint(
    kind: AlignerReminderKind,
    scheduledAt: Date,
    subject: Int64
  ) -> String {
    let timestamp = Int64((scheduledAt.timeIntervalSince1970 * 1_000).rounded())
    return "\(kind.rawValue):\(timestamp):\(subject)"
  }
}
