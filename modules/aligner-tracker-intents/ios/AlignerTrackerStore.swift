import Foundation
import SQLite3

enum AlignerWearStatus: String, Sendable {
  case inTrays = "IN"
  case outTrays = "OUT"
}

struct AlignerWearPunch: Sendable {
  let id: Int64
  let status: AlignerWearStatus
  let timestamp: Int64
}

enum AlignerWearMutation: Sendable {
  case changed(AlignerWearPunch)
  case already(AlignerWearStatus)
  case noActiveTreatment
}

enum AlignerTrackerStoreError: Error {
  case databaseNeedsMigration
  case databaseUnavailable
  case invalidTrackerState
  case sqlite(String)
  case timestampConflict
}

struct AlignerNotificationSettings: Sendable {
  let outReminderEnabled: Bool
  let outReminderMinutes: Int
  let outPersistentReminderIntervalMinutes: Int
  let trayChangeReminderEnabled: Bool
  let trayChangeReminderHour: Int
  let trayChangeReminderMinute: Int
}

struct AlignerNotificationSnapshot: Sendable {
  let currentTrayNumber: Int
  let daysPerTray: Int
  let latestPunch: AlignerWearPunch
  let settings: AlignerNotificationSettings
  let totalTrays: Int
  let trayPeriodId: Int64
  let trayStartedAt: Int64
}

struct AlignerWatchTrackerSnapshot: Equatable, Sendable {
  let currentTrayNumber: Int
  let generatedAt: Int64
  let inTodayMinutes: Int
  let outTodayMinutes: Int
  let status: AlignerWearStatus
  let totalTrays: Int
  let trayDay: Int

  var dictionary: [String: Any] {
    [
      "version": 1,
      "kind": "ready",
      "currentTrayNumber": currentTrayNumber,
      "totalTrays": totalTrays,
      "trayDay": trayDay,
      "status": status.rawValue,
      "inTodayMinutes": inTodayMinutes,
      "outTodayMinutes": outTodayMinutes,
      "generatedAtMs": generatedAt,
    ]
  }
}

private final class AlignerSQLiteConnection {
  private(set) var handle: OpaquePointer?

  init(databaseURL providedDatabaseURL: URL? = nil) throws {
    let fileManager = FileManager.default
    let databaseURL: URL
    if let providedDatabaseURL {
      databaseURL = providedDatabaseURL
    } else {
      guard let documentsDirectory = fileManager.urls(
        for: .documentDirectory,
        in: .userDomainMask
      ).first else {
        throw AlignerTrackerStoreError.databaseUnavailable
      }
      databaseURL = documentsDirectory
        .appendingPathComponent("SQLite", isDirectory: true)
        .appendingPathComponent("aligner-tracker.db", isDirectory: false)
    }

    guard fileManager.fileExists(atPath: databaseURL.path) else {
      throw AlignerTrackerStoreError.databaseUnavailable
    }

    let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX
    guard sqlite3_open_v2(databaseURL.path, &handle, flags, nil) == SQLITE_OK else {
      let message = errorMessage
      sqlite3_close(handle)
      handle = nil
      throw AlignerTrackerStoreError.sqlite(message)
    }

    sqlite3_busy_timeout(handle, 5_000)
    try execute("PRAGMA foreign_keys = ON")
  }

  deinit {
    sqlite3_close(handle)
  }

  var errorMessage: String {
    guard let handle, let message = sqlite3_errmsg(handle) else {
      return "Unknown SQLite error."
    }
    return String(cString: message)
  }

  func execute(_ sql: String) throws {
    var errorPointer: UnsafeMutablePointer<CChar>?
    guard sqlite3_exec(handle, sql, nil, nil, &errorPointer) == SQLITE_OK else {
      let message = errorPointer.map { String(cString: $0) } ?? errorMessage
      sqlite3_free(errorPointer)
      throw AlignerTrackerStoreError.sqlite(message)
    }
  }

  func prepare(_ sql: String) throws -> OpaquePointer {
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK,
          let statement else {
      throw AlignerTrackerStoreError.sqlite(errorMessage)
    }
    return statement
  }

  func expectDone(_ statement: OpaquePointer) throws {
    guard sqlite3_step(statement) == SQLITE_DONE else {
      throw AlignerTrackerStoreError.sqlite(errorMessage)
    }
  }
}

enum AlignerTrackerStore {
  private static let minimumSupportedDatabaseVersion = 4
  private static let maximumSupportedDatabaseVersion = 5

  static func ensureWearStatus(
    _ desiredStatus: AlignerWearStatus,
    timestamp: Int64,
    databaseURL: URL? = nil
  ) throws -> AlignerWearMutation {
    let connection = try AlignerSQLiteConnection(databaseURL: databaseURL)

    try requireSupportedSchema(connection)
    try connection.execute("BEGIN IMMEDIATE TRANSACTION")
    var transactionFinished = false
    defer {
      if !transactionFinished {
        try? connection.execute("ROLLBACK")
      }
    }

    let activeTrayPeriodIds = try loadActiveTrayPeriodIds(connection)
    guard !activeTrayPeriodIds.isEmpty else {
      try connection.execute("ROLLBACK")
      transactionFinished = true
      return .noActiveTreatment
    }
    guard activeTrayPeriodIds.count == 1 else {
      throw AlignerTrackerStoreError.invalidTrackerState
    }

    let trayPeriodId = activeTrayPeriodIds[0]
    guard try activeTrayHasValidTreatment(connection, trayPeriodId: trayPeriodId),
          let latestPunch = try loadLatestPunch(connection, trayPeriodId: trayPeriodId) else {
      throw AlignerTrackerStoreError.invalidTrackerState
    }

    if latestPunch.status == desiredStatus {
      try connection.execute("COMMIT")
      transactionFinished = true
      return .already(desiredStatus)
    }

    guard timestamp > latestPunch.timestamp else {
      throw AlignerTrackerStoreError.timestampConflict
    }

    let insert = try connection.prepare(
      """
      INSERT INTO wear_punches (tray_period_id, status, timestamp)
      SELECT ?, ?, ?
      WHERE EXISTS (
        SELECT 1
        FROM tray_periods
        WHERE id = ? AND ended_at IS NULL
      )
        AND EXISTS (
          SELECT 1
          FROM wear_punches
          WHERE id = ?
            AND tray_period_id = ?
            AND status = ?
            AND timestamp = ?
            AND id = (
              SELECT id
              FROM wear_punches
              WHERE tray_period_id = ?
              ORDER BY timestamp DESC, id DESC
              LIMIT 1
            )
        )
      """
    )
    defer { sqlite3_finalize(insert) }

    sqlite3_bind_int64(insert, 1, trayPeriodId)
    _ = desiredStatus.rawValue.withCString {
      sqlite3_bind_text(insert, 2, $0, -1, SQLITE_TRANSIENT)
    }
    sqlite3_bind_int64(insert, 3, timestamp)
    sqlite3_bind_int64(insert, 4, trayPeriodId)
    sqlite3_bind_int64(insert, 5, latestPunch.id)
    sqlite3_bind_int64(insert, 6, trayPeriodId)
    _ = latestPunch.status.rawValue.withCString {
      sqlite3_bind_text(insert, 7, $0, -1, SQLITE_TRANSIENT)
    }
    sqlite3_bind_int64(insert, 8, latestPunch.timestamp)
    sqlite3_bind_int64(insert, 9, trayPeriodId)
    try connection.expectDone(insert)

    guard sqlite3_changes(connection.handle) == 1 else {
      throw AlignerTrackerStoreError.invalidTrackerState
    }

    let punch = AlignerWearPunch(
      id: sqlite3_last_insert_rowid(connection.handle),
      status: desiredStatus,
      timestamp: timestamp
    )
    try connection.execute("COMMIT")
    transactionFinished = true
    return .changed(punch)
  }

  static func loadNotificationSnapshot(
    databaseURL: URL? = nil
  ) throws -> AlignerNotificationSnapshot? {
    let connection: AlignerSQLiteConnection
    do {
      connection = try AlignerSQLiteConnection(databaseURL: databaseURL)
    } catch AlignerTrackerStoreError.databaseUnavailable {
      return nil
    }

    try requireSupportedSchema(connection)
    try connection.execute("BEGIN DEFERRED TRANSACTION")
    var transactionFinished = false
    defer {
      if !transactionFinished {
        try? connection.execute("ROLLBACK")
      }
    }
    let activeTrayPeriodIds = try loadActiveTrayPeriodIds(connection)
    guard !activeTrayPeriodIds.isEmpty else {
      try connection.execute("COMMIT")
      transactionFinished = true
      return nil
    }
    guard activeTrayPeriodIds.count == 1 else {
      throw AlignerTrackerStoreError.invalidTrackerState
    }

    let trayPeriodId = activeTrayPeriodIds[0]
    let trackerStatement = try connection.prepare(
      """
      SELECT
        tray_periods.treatment_id,
        tray_periods.tray_number,
        tray_periods.started_at,
        treatment_plan_versions.total_trays,
        treatment_plan_versions.days_per_tray
      FROM tray_periods
      JOIN treatments ON treatments.id = tray_periods.treatment_id
      JOIN treatment_plan_versions
        ON treatment_plan_versions.id = (
          SELECT plan.id
          FROM treatment_plan_versions AS plan
          WHERE plan.treatment_id = tray_periods.treatment_id
          ORDER BY plan.effective_at DESC, plan.id DESC
          LIMIT 1
        )
      WHERE tray_periods.id = ? AND tray_periods.ended_at IS NULL
      """
    )
    defer { sqlite3_finalize(trackerStatement) }
    sqlite3_bind_int64(trackerStatement, 1, trayPeriodId)
    guard sqlite3_step(trackerStatement) == SQLITE_ROW else {
      throw AlignerTrackerStoreError.invalidTrackerState
    }

    let treatmentId = sqlite3_column_int64(trackerStatement, 0)
    let currentTrayNumber = Int(sqlite3_column_int64(trackerStatement, 1))
    let trayStartedAt = sqlite3_column_int64(trackerStatement, 2)
    let totalTrays = Int(sqlite3_column_int64(trackerStatement, 3))
    let daysPerTray = Int(sqlite3_column_int64(trackerStatement, 4))

    guard let latestPunch = try loadLatestPunch(
      connection,
      treatmentId: treatmentId
    ) else {
      throw AlignerTrackerStoreError.invalidTrackerState
    }

    let settings = try loadNotificationSettings(connection)
    let snapshot = AlignerNotificationSnapshot(
      currentTrayNumber: currentTrayNumber,
      daysPerTray: daysPerTray,
      latestPunch: latestPunch,
      settings: settings,
      totalTrays: totalTrays,
      trayPeriodId: trayPeriodId,
      trayStartedAt: trayStartedAt
    )
    try connection.execute("COMMIT")
    transactionFinished = true
    return snapshot
  }

  static func loadWatchTrackerSnapshot(
    now: Date = Date(),
    calendar: Calendar = .current,
    databaseURL: URL? = nil
  ) throws -> AlignerWatchTrackerSnapshot? {
    let connection: AlignerSQLiteConnection
    do {
      connection = try AlignerSQLiteConnection(databaseURL: databaseURL)
    } catch AlignerTrackerStoreError.databaseUnavailable {
      return nil
    }

    try requireSupportedSchema(connection)
    try connection.execute("BEGIN DEFERRED TRANSACTION")
    var transactionFinished = false
    defer {
      if !transactionFinished {
        try? connection.execute("ROLLBACK")
      }
    }

    let activeTrayPeriodIds = try loadActiveTrayPeriodIds(connection)
    guard !activeTrayPeriodIds.isEmpty else {
      try connection.execute("COMMIT")
      transactionFinished = true
      return nil
    }
    guard activeTrayPeriodIds.count == 1 else {
      throw AlignerTrackerStoreError.invalidTrackerState
    }

    let trackerStatement = try connection.prepare(
      """
      SELECT
        tray_periods.treatment_id,
        tray_periods.tray_number,
        tray_periods.started_at,
        treatment_plan_versions.total_trays
      FROM tray_periods
      JOIN treatments ON treatments.id = tray_periods.treatment_id
      JOIN treatment_plan_versions
        ON treatment_plan_versions.id = (
          SELECT plan.id
          FROM treatment_plan_versions AS plan
          WHERE plan.treatment_id = tray_periods.treatment_id
          ORDER BY plan.effective_at DESC, plan.id DESC
          LIMIT 1
        )
      WHERE tray_periods.id = ? AND tray_periods.ended_at IS NULL
      """
    )
    defer { sqlite3_finalize(trackerStatement) }
    sqlite3_bind_int64(trackerStatement, 1, activeTrayPeriodIds[0])
    guard sqlite3_step(trackerStatement) == SQLITE_ROW else {
      throw AlignerTrackerStoreError.invalidTrackerState
    }

    let treatmentId = sqlite3_column_int64(trackerStatement, 0)
    let currentTrayNumber = Int(sqlite3_column_int64(trackerStatement, 1))
    let trayStartedAt = sqlite3_column_int64(trackerStatement, 2)
    let totalTrays = Int(sqlite3_column_int64(trackerStatement, 3))
    let generatedAt = Int64((now.timeIntervalSince1970 * 1_000).rounded(.down))
    let dayStart = calendar.startOfDay(for: now)
    let dayStartTimestamp = Int64((dayStart.timeIntervalSince1970 * 1_000).rounded(.down))
    let punches = try loadWatchPunches(
      connection,
      treatmentId: treatmentId,
      dayStart: dayStartTimestamp,
      now: generatedAt
    )
    guard let status = punches.last?.status else {
      throw AlignerTrackerStoreError.invalidTrackerState
    }

    let totals = calculateWatchDailyTotals(
      punches: punches,
      dayStart: dayStartTimestamp,
      now: generatedAt
    )
    let trayStartedDate = Date(timeIntervalSince1970: Double(trayStartedAt) / 1_000)
    let trayStartDay = calendar.startOfDay(for: trayStartedDate)
    let elapsedDays = calendar.dateComponents([.day], from: trayStartDay, to: dayStart).day ?? 0
    let snapshot = AlignerWatchTrackerSnapshot(
      currentTrayNumber: currentTrayNumber,
      generatedAt: generatedAt,
      inTodayMinutes: totals.inMinutes,
      outTodayMinutes: totals.outMinutes,
      status: status,
      totalTrays: totalTrays,
      trayDay: max(1, elapsedDays + 1)
    )
    try connection.execute("COMMIT")
    transactionFinished = true
    return snapshot
  }

  private static func requireSupportedSchema(_ connection: AlignerSQLiteConnection) throws {
    let statement = try connection.prepare("PRAGMA user_version")
    defer { sqlite3_finalize(statement) }
    guard sqlite3_step(statement) == SQLITE_ROW else {
      throw AlignerTrackerStoreError.invalidTrackerState
    }
    let version = Int(sqlite3_column_int64(statement, 0))
    guard version >= minimumSupportedDatabaseVersion else {
      throw AlignerTrackerStoreError.databaseNeedsMigration
    }
    guard version <= maximumSupportedDatabaseVersion else {
      throw AlignerTrackerStoreError.invalidTrackerState
    }
  }

  private static func loadActiveTrayPeriodIds(
    _ connection: AlignerSQLiteConnection
  ) throws -> [Int64] {
    let statement = try connection.prepare(
      """
      SELECT id
      FROM tray_periods
      WHERE ended_at IS NULL
      ORDER BY started_at DESC, id DESC
      LIMIT 2
      """
    )
    defer { sqlite3_finalize(statement) }

    var ids: [Int64] = []
    while sqlite3_step(statement) == SQLITE_ROW {
      ids.append(sqlite3_column_int64(statement, 0))
    }
    return ids
  }

  private static func activeTrayHasValidTreatment(
    _ connection: AlignerSQLiteConnection,
    trayPeriodId: Int64
  ) throws -> Bool {
    let statement = try connection.prepare(
      """
      SELECT 1
      FROM tray_periods
      JOIN treatments ON treatments.id = tray_periods.treatment_id
      WHERE tray_periods.id = ?
        AND tray_periods.ended_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM treatment_plan_versions
          WHERE treatment_id = tray_periods.treatment_id
        )
      """
    )
    defer { sqlite3_finalize(statement) }
    sqlite3_bind_int64(statement, 1, trayPeriodId)
    return sqlite3_step(statement) == SQLITE_ROW
  }

  private static func loadLatestPunch(
    _ connection: AlignerSQLiteConnection,
    trayPeriodId: Int64
  ) throws -> AlignerWearPunch? {
    let statement = try connection.prepare(
      """
      SELECT id, status, timestamp
      FROM wear_punches
      WHERE tray_period_id = ?
      ORDER BY timestamp DESC, id DESC
      LIMIT 1
      """
    )
    defer { sqlite3_finalize(statement) }
    sqlite3_bind_int64(statement, 1, trayPeriodId)
    return try readPunch(statement)
  }

  private static func loadWatchPunches(
    _ connection: AlignerSQLiteConnection,
    treatmentId: Int64,
    dayStart: Int64,
    now: Int64
  ) throws -> [AlignerWearPunch] {
    let statement = try connection.prepare(
      """
      SELECT id, status, timestamp
      FROM (
        SELECT wear_punches.id, wear_punches.status, wear_punches.timestamp
        FROM wear_punches
        JOIN tray_periods ON tray_periods.id = wear_punches.tray_period_id
        WHERE tray_periods.treatment_id = ? AND wear_punches.timestamp < ?
        ORDER BY wear_punches.timestamp DESC, wear_punches.id DESC
        LIMIT 1
      )
      UNION ALL
      SELECT wear_punches.id, wear_punches.status, wear_punches.timestamp
      FROM wear_punches
      JOIN tray_periods ON tray_periods.id = wear_punches.tray_period_id
      WHERE tray_periods.treatment_id = ?
        AND wear_punches.timestamp >= ?
        AND wear_punches.timestamp <= ?
      ORDER BY timestamp, id
      """
    )
    defer { sqlite3_finalize(statement) }
    sqlite3_bind_int64(statement, 1, treatmentId)
    sqlite3_bind_int64(statement, 2, dayStart)
    sqlite3_bind_int64(statement, 3, treatmentId)
    sqlite3_bind_int64(statement, 4, dayStart)
    sqlite3_bind_int64(statement, 5, now)

    var punches: [AlignerWearPunch] = []
    while true {
      let stepResult = sqlite3_step(statement)
      if stepResult == SQLITE_DONE {
        return punches
      }
      guard stepResult == SQLITE_ROW,
            let statusPointer = sqlite3_column_text(statement, 1),
            let status = AlignerWearStatus(rawValue: String(cString: statusPointer)) else {
        throw AlignerTrackerStoreError.invalidTrackerState
      }
      punches.append(
        AlignerWearPunch(
          id: sqlite3_column_int64(statement, 0),
          status: status,
          timestamp: sqlite3_column_int64(statement, 2)
        )
      )
    }
  }

  private static func calculateWatchDailyTotals(
    punches: [AlignerWearPunch],
    dayStart: Int64,
    now: Int64
  ) -> (inMinutes: Int, outMinutes: Int) {
    var totals: [AlignerWearStatus: Int64] = [.inTrays: 0, .outTrays: 0]
    var currentStatus: AlignerWearStatus?
    var intervalStartedAt = dayStart
    var index = 0

    while index < punches.count {
      var punch = punches[index]
      while index + 1 < punches.count && punches[index + 1].timestamp == punch.timestamp {
        index += 1
        punch = punches[index]
      }

      if punch.timestamp > now {
        break
      }
      if punch.timestamp <= dayStart {
        currentStatus = punch.status
        index += 1
        continue
      }
      guard let activeStatus = currentStatus else {
        currentStatus = punch.status
        intervalStartedAt = punch.timestamp
        index += 1
        continue
      }
      if punch.status != activeStatus && punch.timestamp > intervalStartedAt {
        totals[activeStatus, default: 0] += punch.timestamp - intervalStartedAt
        currentStatus = punch.status
        intervalStartedAt = punch.timestamp
      }
      index += 1
    }

    if let currentStatus, now > intervalStartedAt {
      totals[currentStatus, default: 0] += now - intervalStartedAt
    }
    return (
      inMinutes: Int(totals[.inTrays, default: 0] / 60_000),
      outMinutes: Int(totals[.outTrays, default: 0] / 60_000)
    )
  }

  private static func loadLatestPunch(
    _ connection: AlignerSQLiteConnection,
    treatmentId: Int64
  ) throws -> AlignerWearPunch? {
    let statement = try connection.prepare(
      """
      SELECT wear_punches.id, wear_punches.status, wear_punches.timestamp
      FROM wear_punches
      JOIN tray_periods ON tray_periods.id = wear_punches.tray_period_id
      WHERE tray_periods.treatment_id = ?
      ORDER BY wear_punches.timestamp DESC, wear_punches.id DESC
      LIMIT 1
      """
    )
    defer { sqlite3_finalize(statement) }
    sqlite3_bind_int64(statement, 1, treatmentId)
    return try readPunch(statement)
  }

  private static func readPunch(_ statement: OpaquePointer) throws -> AlignerWearPunch? {
    let stepResult = sqlite3_step(statement)
    guard stepResult == SQLITE_ROW else {
      if stepResult == SQLITE_DONE {
        return nil
      }
      throw AlignerTrackerStoreError.invalidTrackerState
    }
    guard let statusPointer = sqlite3_column_text(statement, 1),
          let status = AlignerWearStatus(rawValue: String(cString: statusPointer)) else {
      throw AlignerTrackerStoreError.invalidTrackerState
    }
    return AlignerWearPunch(
      id: sqlite3_column_int64(statement, 0),
      status: status,
      timestamp: sqlite3_column_int64(statement, 2)
    )
  }

  private static func loadNotificationSettings(
    _ connection: AlignerSQLiteConnection
  ) throws -> AlignerNotificationSettings {
    let statement = try connection.prepare(
      """
      SELECT
        out_reminder_enabled,
        out_reminder_minutes,
        out_persistent_reminder_interval_minutes,
        tray_change_reminder_enabled,
        tray_change_reminder_hour,
        tray_change_reminder_minute
      FROM settings
      WHERE id = 1
      """
    )
    defer { sqlite3_finalize(statement) }
    guard sqlite3_step(statement) == SQLITE_ROW else {
      throw AlignerTrackerStoreError.invalidTrackerState
    }
    return AlignerNotificationSettings(
      outReminderEnabled: sqlite3_column_int(statement, 0) == 1,
      outReminderMinutes: Int(sqlite3_column_int64(statement, 1)),
      outPersistentReminderIntervalMinutes: Int(sqlite3_column_int64(statement, 2)),
      trayChangeReminderEnabled: sqlite3_column_int(statement, 3) == 1,
      trayChangeReminderHour: Int(sqlite3_column_int64(statement, 4)),
      trayChangeReminderMinute: Int(sqlite3_column_int64(statement, 5))
    )
  }
}

private let SQLITE_TRANSIENT = unsafeBitCast(
  -1,
  to: sqlite3_destructor_type.self
)
