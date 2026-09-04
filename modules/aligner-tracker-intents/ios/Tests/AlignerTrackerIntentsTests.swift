import SQLite3
import XCTest
@testable import AlignerTrackerIntents

private enum WatchBridgeTestError: Error {
  case notificationFailure
}

final class AlignerTrackerStoreTests: XCTestCase {
  func testChangesInToOutAndOutToIn() throws {
    let inDatabase = try makeDatabase(initialStatus: "IN")
    let outResult = try AlignerTrackerStore.ensureWearStatus(
      .outTrays,
      timestamp: 2_000,
      databaseURL: inDatabase
    )
    assertChanged(outResult, status: .outTrays, timestamp: 2_000)

    let outDatabase = try makeDatabase(initialStatus: "OUT")
    let inResult = try AlignerTrackerStore.ensureWearStatus(
      .inTrays,
      timestamp: 2_000,
      databaseURL: outDatabase
    )
    assertChanged(inResult, status: .inTrays, timestamp: 2_000)
  }

  func testMatchingDesiredStatesCreateNoPunch() throws {
    for status in [AlignerWearStatus.inTrays, .outTrays] {
      let database = try makeDatabase(initialStatus: status.rawValue)
      let result = try AlignerTrackerStore.ensureWearStatus(
        status,
        timestamp: 2_000,
        databaseURL: database
      )
      guard case let .already(actualStatus) = result else {
        return XCTFail("Expected an already-\(status.rawValue) result.")
      }
      XCTAssertEqual(actualStatus, status)
      XCTAssertEqual(try punchCount(database), 1)
    }
  }

  func testDatabaseSchemaCompatibilityIsBounded() throws {
    for version in [4, 5] {
      let database = try makeDatabase(
        databaseVersion: version,
        initialStatus: "IN"
      )
      let result = try AlignerTrackerStore.ensureWearStatus(
        .outTrays,
        timestamp: 2_000,
        databaseURL: database
      )
      assertChanged(result, status: .outTrays, timestamp: 2_000)
      XCTAssertEqual(try punchCount(database), 2)
    }

    for version in [3, 6] {
      let database = try makeDatabase(
        databaseVersion: version,
        initialStatus: "IN"
      )
      XCTAssertThrowsError(
        try AlignerTrackerStore.ensureWearStatus(
          .outTrays,
          timestamp: 2_000,
          databaseURL: database
        )
      )
      XCTAssertEqual(try punchCount(database), 1)
    }
  }

  func testMissingActiveTreatmentReturnsWithoutWriting() throws {
    let database = try makeDatabase(activePeriodCount: 0, initialStatus: nil)
    let result = try AlignerTrackerStore.ensureWearStatus(
      .outTrays,
      timestamp: 2_000,
      databaseURL: database
    )
    guard case .noActiveTreatment = result else {
      return XCTFail("Expected no active treatment.")
    }
    XCTAssertEqual(try punchCount(database), 0)
  }

  func testMultipleActivePeriodsFailWithoutWriting() throws {
    let database = try makeDatabase(
      activePeriodCount: 2,
      databaseVersion: 4,
      initialStatus: "IN"
    )
    XCTAssertThrowsError(
      try AlignerTrackerStore.ensureWearStatus(
        .outTrays,
        timestamp: 2_000,
        databaseURL: database
      )
    )
    XCTAssertEqual(try punchCount(database), 2)
  }

  func testMissingLatestPunchAndStaleTimestampFail() throws {
    let missingPunchDatabase = try makeDatabase(initialStatus: nil)
    XCTAssertThrowsError(
      try AlignerTrackerStore.ensureWearStatus(
        .outTrays,
        timestamp: 2_000,
        databaseURL: missingPunchDatabase
      )
    )

    let staleDatabase = try makeDatabase(initialStatus: "IN")
    XCTAssertThrowsError(
      try AlignerTrackerStore.ensureWearStatus(
        .outTrays,
        timestamp: 1_000,
        databaseURL: staleDatabase
      )
    )
    XCTAssertEqual(try punchCount(staleDatabase), 1)
  }

  func testMissingTreatmentPlanAndCorruptDatabaseFailWithoutWriting() throws {
    let missingPlanDatabase = try makeDatabase(
      initialStatus: "IN",
      includePlan: false
    )
    XCTAssertThrowsError(
      try AlignerTrackerStore.ensureWearStatus(
        .outTrays,
        timestamp: 2_000,
        databaseURL: missingPlanDatabase
      )
    )
    XCTAssertEqual(try punchCount(missingPlanDatabase), 1)

    let corruptDatabase = FileManager.default.temporaryDirectory
      .appendingPathComponent("aligner-intents-corrupt-\(UUID().uuidString).db")
    try Data("not a sqlite database".utf8).write(to: corruptDatabase)
    addTeardownBlock {
      try? FileManager.default.removeItem(at: corruptDatabase)
    }
    XCTAssertThrowsError(
      try AlignerTrackerStore.ensureWearStatus(
        .outTrays,
        timestamp: 2_000,
        databaseURL: corruptDatabase
      )
    )
  }

  func testConcurrentDuplicateCommandsCreateOnePunch() throws {
    let database = try makeDatabase(initialStatus: "IN")
    let lock = NSLock()
    var results: [AlignerWearMutation] = []
    var errors: [Error] = []

    DispatchQueue.concurrentPerform(iterations: 2) { index in
      do {
        let result = try AlignerTrackerStore.ensureWearStatus(
          .outTrays,
          timestamp: Int64(2_000 + index),
          databaseURL: database
        )
        lock.lock()
        results.append(result)
        lock.unlock()
      } catch {
        lock.lock()
        errors.append(error)
        lock.unlock()
      }
    }

    XCTAssertTrue(errors.isEmpty)
    XCTAssertEqual(results.count, 2)
    XCTAssertEqual(try punchCount(database), 2)
    XCTAssertEqual(
      results.filter {
        if case .changed = $0 { return true }
        return false
      }.count,
      1
    )
  }

  func testWatchSnapshotMatchesDailyTrackerStateToTheMinute() throws {
    let database = try makeDatabase(initialStatus: "IN")
    try execute(
      "INSERT INTO wear_punches VALUES (2, 1, 'OUT', 3601000);",
      databaseURL: database
    )
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: 0)!

    let snapshot = try XCTUnwrap(
      AlignerTrackerStore.loadWatchTrackerSnapshot(
        now: Date(timeIntervalSince1970: 7_201),
        calendar: calendar,
        databaseURL: database
      )
    )

    XCTAssertEqual(snapshot.currentTrayNumber, 1)
    XCTAssertEqual(snapshot.totalTrays, 48)
    XCTAssertEqual(snapshot.trayDay, 1)
    XCTAssertEqual(snapshot.status, .outTrays)
    XCTAssertEqual(snapshot.inTodayMinutes, 60)
    XCTAssertEqual(snapshot.outTodayMinutes, 60)
    XCTAssertEqual(snapshot.generatedAt, 7_201_000)
  }

  func testWatchSnapshotReturnsNoTreatmentWithoutCreatingState() throws {
    let database = try makeDatabase(activePeriodCount: 0, initialStatus: nil)
    XCTAssertNil(
      try AlignerTrackerStore.loadWatchTrackerSnapshot(
        now: Date(timeIntervalSince1970: 2),
        databaseURL: database
      )
    )
    XCTAssertEqual(try punchCount(database), 0)
  }

  func testWatchProtocolRejectsMalformedAndUnknownRequests() async {
    let malformed = await AlignerTrackerWatchBridge.handle(["operation": "getSnapshot"])
    XCTAssertEqual(malformed["outcome"] as? String, "failed")

    let unknown = await AlignerTrackerWatchBridge.handle([
      "version": 1,
      "requestId": "request-1",
      "operation": "unknown",
    ])
    XCTAssertEqual(unknown["requestId"] as? String, "request-1")
    XCTAssertEqual(unknown["outcome"] as? String, "failed")
  }

  func testWatchBridgeCommitsExactlyOnePhoneTimestampedPunch() async throws {
    let database = try makeDatabase(initialStatus: "IN")
    let now = Date(timeIntervalSince1970: 2)
    let request: [String: Any] = [
      "version": 1,
      "requestId": "request-1",
      "operation": "setWearStatus",
      "expectedStatus": "IN",
      "desiredStatus": "OUT",
    ]

    let changed = await AlignerTrackerWatchBridge.handle(
      request,
      now: now,
      databaseURL: database,
      notificationReconciler: {}
    )
    XCTAssertEqual(changed["outcome"] as? String, "changed")
    XCTAssertEqual(changed["requestId"] as? String, "request-1")
    XCTAssertEqual(try punchCount(database), 2)
    XCTAssertEqual(try latestPunch(database).status, "OUT")
    XCTAssertEqual(try latestPunch(database).timestamp, 2_000)
    let snapshot = try XCTUnwrap(changed["snapshot"] as? [String: Any])
    XCTAssertEqual(snapshot["status"] as? String, "OUT")
    XCTAssertEqual((snapshot["generatedAtMs"] as? NSNumber)?.int64Value, 2_000)

    let repeated = await AlignerTrackerWatchBridge.handle(
      request.merging(["requestId": "request-2"], uniquingKeysWith: { _, replacement in
        replacement
      }),
      now: Date(timeIntervalSince1970: 3),
      databaseURL: database,
      notificationReconciler: {}
    )
    XCTAssertEqual(repeated["outcome"] as? String, "state-conflict")
    XCTAssertEqual(try punchCount(database), 2)
  }

  func testWatchBridgeReturnsNoTreatmentAndDatabaseFailuresWithoutWriting() async throws {
    let noTreatmentDatabase = try makeDatabase(activePeriodCount: 0, initialStatus: nil)
    let noTreatment = await AlignerTrackerWatchBridge.handle(
      [
        "version": 1,
        "requestId": "request-no-treatment",
        "operation": "setWearStatus",
        "expectedStatus": "IN",
        "desiredStatus": "OUT",
      ],
      now: Date(timeIntervalSince1970: 2),
      databaseURL: noTreatmentDatabase,
      notificationReconciler: {}
    )
    XCTAssertEqual(noTreatment["outcome"] as? String, "no-treatment")
    XCTAssertEqual(try punchCount(noTreatmentDatabase), 0)

    let corruptDatabase = FileManager.default.temporaryDirectory
      .appendingPathComponent("aligner-watch-corrupt-\(UUID().uuidString).db")
    try Data("not a sqlite database".utf8).write(to: corruptDatabase)
    addTeardownBlock {
      try? FileManager.default.removeItem(at: corruptDatabase)
    }
    let failed = await AlignerTrackerWatchBridge.handle(
      [
        "version": 1,
        "requestId": "request-failed",
        "operation": "setWearStatus",
        "expectedStatus": "IN",
        "desiredStatus": "OUT",
      ],
      now: Date(timeIntervalSince1970: 2),
      databaseURL: corruptDatabase,
      notificationReconciler: {}
    )
    XCTAssertEqual(failed["outcome"] as? String, "failed")
  }

  func testWatchBridgeReportsPostWriteNotificationWarning() async throws {
    let database = try makeDatabase(initialStatus: "IN")
    let response = await AlignerTrackerWatchBridge.handle(
      [
        "version": 1,
        "requestId": "request-warning",
        "operation": "setWearStatus",
        "expectedStatus": "IN",
        "desiredStatus": "OUT",
      ],
      now: Date(timeIntervalSince1970: 2),
      databaseURL: database,
      notificationReconciler: {
        throw WatchBridgeTestError.notificationFailure
      }
    )
    XCTAssertEqual(response["outcome"] as? String, "changed")
    XCTAssertEqual(response["notificationWarning"] as? Bool, true)
    XCTAssertEqual(try punchCount(database), 2)
  }

  func testWatchSnapshotUsesCalendarDaysAcrossDST() throws {
    let database = try makeDatabase(initialStatus: "IN")
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
    let trayStartedAt = try XCTUnwrap(
      calendar.date(from: DateComponents(
        year: 2026,
        month: 3,
        day: 7,
        hour: 23,
        minute: 30
      ))
    )
    let now = try XCTUnwrap(
      calendar.date(from: DateComponents(
        year: 2026,
        month: 3,
        day: 9,
        hour: 0,
        minute: 30
      ))
    )
    try execute(
      "UPDATE tray_periods SET started_at = \(Int64(trayStartedAt.timeIntervalSince1970 * 1_000));",
      databaseURL: database
    )

    let snapshot = try XCTUnwrap(
      AlignerTrackerStore.loadWatchTrackerSnapshot(
        now: now,
        calendar: calendar,
        databaseURL: database
      )
    )
    XCTAssertEqual(snapshot.trayDay, 3)
  }

  private func assertChanged(
    _ mutation: AlignerWearMutation,
    status: AlignerWearStatus,
    timestamp: Int64
  ) {
    guard case let .changed(punch) = mutation else {
      return XCTFail("Expected a changed result.")
    }
    XCTAssertEqual(punch.status, status)
    XCTAssertEqual(punch.timestamp, timestamp)
  }

  private func makeDatabase(
    activePeriodCount: Int = 1,
    databaseVersion: Int = 5,
    initialStatus: String?,
    includePlan: Bool = true
  ) throws -> URL {
    let url = FileManager.default.temporaryDirectory
      .appendingPathComponent("aligner-intents-\(UUID().uuidString).db")
    addTeardownBlock {
      try? FileManager.default.removeItem(at: url)
    }

    var database: OpaquePointer?
    XCTAssertEqual(sqlite3_open(url.path, &database), SQLITE_OK)
    defer { sqlite3_close(database) }

    try execute(
      """
      PRAGMA user_version = \(databaseVersion);
      PRAGMA journal_mode = WAL;
      CREATE TABLE treatments (id INTEGER PRIMARY KEY, created_at INTEGER NOT NULL);
      CREATE TABLE treatment_plan_versions (
        id INTEGER PRIMARY KEY,
        treatment_id INTEGER NOT NULL,
        total_trays INTEGER NOT NULL,
        days_per_tray INTEGER NOT NULL,
        daily_wear_goal_minutes INTEGER NOT NULL,
        effective_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE tray_periods (
        id INTEGER PRIMARY KEY,
        treatment_id INTEGER NOT NULL,
        tray_number INTEGER NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER
      );
      CREATE TABLE wear_punches (
        id INTEGER PRIMARY KEY,
        tray_period_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE TABLE settings (
        id INTEGER PRIMARY KEY,
        out_reminder_enabled INTEGER NOT NULL,
        out_reminder_minutes INTEGER NOT NULL,
        out_persistent_reminder_interval_minutes INTEGER NOT NULL,
        tray_change_reminder_enabled INTEGER NOT NULL,
        tray_change_reminder_hour INTEGER NOT NULL,
        tray_change_reminder_minute INTEGER NOT NULL
      );
      INSERT INTO treatments VALUES (1, 0);
      INSERT INTO settings VALUES (1, 1, 45, 5, 1, 9, 0);
      """,
      database: database
    )

    if databaseVersion >= 5 {
      try execute(
        """
        CREATE UNIQUE INDEX tray_periods_one_active_per_treatment_idx
          ON tray_periods (treatment_id)
          WHERE ended_at IS NULL;
        """,
        database: database
      )
    }

    if includePlan {
      try execute(
        "INSERT INTO treatment_plan_versions VALUES (1, 1, 48, 7, 1320, 0, 0);",
        database: database
      )
    }

    for index in 0..<activePeriodCount {
      let trayPeriodId = index + 1
      try execute(
        "INSERT INTO tray_periods VALUES (\(trayPeriodId), 1, \(trayPeriodId), \(index), NULL);",
        database: database
      )
      if let initialStatus {
        try execute(
          "INSERT INTO wear_punches VALUES (\(trayPeriodId), \(trayPeriodId), '\(initialStatus)', 1000);",
          database: database
        )
      }
    }
    return url
  }

  private func punchCount(_ url: URL) throws -> Int {
    var database: OpaquePointer?
    guard sqlite3_open(url.path, &database) == SQLITE_OK else {
      throw NSError(
        domain: "AlignerTrackerIntentsTests",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "Could not reopen temporary SQLite database."]
      )
    }
    defer { sqlite3_close(database) }
    var statement: OpaquePointer?
    sqlite3_prepare_v2(database, "SELECT COUNT(*) FROM wear_punches", -1, &statement, nil)
    defer { sqlite3_finalize(statement) }
    XCTAssertEqual(sqlite3_step(statement), SQLITE_ROW)
    return Int(sqlite3_column_int64(statement, 0))
  }

  private func latestPunch(_ url: URL) throws -> (status: String, timestamp: Int64) {
    var database: OpaquePointer?
    guard sqlite3_open(url.path, &database) == SQLITE_OK else {
      throw NSError(domain: "AlignerTrackerIntentsTests", code: 4)
    }
    defer { sqlite3_close(database) }
    var statement: OpaquePointer?
    sqlite3_prepare_v2(
      database,
      "SELECT status, timestamp FROM wear_punches ORDER BY timestamp DESC, id DESC LIMIT 1",
      -1,
      &statement,
      nil
    )
    defer { sqlite3_finalize(statement) }
    guard sqlite3_step(statement) == SQLITE_ROW,
          let statusPointer = sqlite3_column_text(statement, 0) else {
      throw NSError(domain: "AlignerTrackerIntentsTests", code: 5)
    }
    return (String(cString: statusPointer), sqlite3_column_int64(statement, 1))
  }

  private func execute(_ sql: String, database: OpaquePointer?) throws {
    var errorPointer: UnsafeMutablePointer<CChar>?
    guard sqlite3_exec(database, sql, nil, nil, &errorPointer) == SQLITE_OK else {
      let message = errorPointer.map { String(cString: $0) } ?? "SQLite test setup failed."
      sqlite3_free(errorPointer)
      throw NSError(domain: "AlignerTrackerIntentsTests", code: 1, userInfo: [
        NSLocalizedDescriptionKey: message,
      ])
    }
  }

  private func execute(_ sql: String, databaseURL: URL) throws {
    var database: OpaquePointer?
    guard sqlite3_open(databaseURL.path, &database) == SQLITE_OK else {
      throw NSError(domain: "AlignerTrackerIntentsTests", code: 3)
    }
    defer { sqlite3_close(database) }
    try execute(sql, database: database)
  }
}

final class AlignerTrackerReminderPolicyTests: XCTestCase {
  func testOutReminderUsesInitialAndPersistentSchedule() {
    let now = Date(timeIntervalSince1970: 1_000)
    let snapshot = makeSnapshot(
      latestStatus: .outTrays,
      latestTimestamp: 1_000_000,
      trayChangeEnabled: false
    )
    let reminders = AlignerTrackerReminderPolicy.build(snapshot: snapshot, now: now)

    XCTAssertEqual(reminders.count, 64)
    XCTAssertEqual(reminders.first?.kind, .outTooLong)
    XCTAssertEqual(
      reminders.first?.scheduledAt,
      Date(timeIntervalSince1970: 1_000 + 45 * 60)
    )
    XCTAssertEqual(
      reminders.dropFirst().first?.scheduledAt,
      Date(timeIntervalSince1970: 1_000 + 50 * 60)
    )
  }

  func testTrayChangeReservesOneOfTheSixtyFourSlots() {
    let now = Date(timeIntervalSince1970: 1_000)
    let snapshot = makeSnapshot(
      latestStatus: .outTrays,
      latestTimestamp: 1_000_000,
      trayChangeEnabled: true
    )
    let reminders = AlignerTrackerReminderPolicy.build(snapshot: snapshot, now: now)

    XCTAssertEqual(reminders.count, 64)
    XCTAssertEqual(reminders.filter { $0.kind == .trayChange }.count, 1)
    XCTAssertEqual(reminders.filter { $0.kind == .outTooLong }.count, 63)
  }

  func testInStateAndDisabledTrayChangeCreateNoReminders() {
    let snapshot = makeSnapshot(
      latestStatus: .inTrays,
      latestTimestamp: 1_000_000,
      trayChangeEnabled: false
    )
    XCTAssertTrue(
      AlignerTrackerReminderPolicy.build(
        snapshot: snapshot,
        now: Date(timeIntervalSince1970: 1_000)
      ).isEmpty
    )
  }

  func testDisabledSettingsCreateNoReminders() {
    let snapshot = makeSnapshot(
      latestStatus: .outTrays,
      latestTimestamp: 1_000_000,
      outReminderEnabled: false,
      trayChangeEnabled: false
    )
    XCTAssertTrue(
      AlignerTrackerReminderPolicy.build(
        snapshot: snapshot,
        now: Date(timeIntervalSince1970: 1_000)
      ).isEmpty
    )
  }

  func testOverdueReminderAdvancesToTheNextPersistentInterval() {
    let snapshot = makeSnapshot(
      latestStatus: .outTrays,
      latestTimestamp: 1_000_000,
      trayChangeEnabled: false
    )
    let initialReminder = Date(timeIntervalSince1970: 1_000 + 45 * 60)
    let reminders = AlignerTrackerReminderPolicy.build(
      snapshot: snapshot,
      now: initialReminder
    )

    XCTAssertEqual(
      reminders.first?.scheduledAt,
      initialReminder.addingTimeInterval(5 * 60)
    )
    XCTAssertEqual(
      reminders.first?.body,
      "Your trays are still out. Put them back in."
    )
  }

  func testTrayChangeReminderUsesConfiguredLocalTime() {
    let snapshot = makeSnapshot(
      latestStatus: .inTrays,
      latestTimestamp: 1_000_000,
      trayChangeEnabled: true
    )
    let now = Date(timeIntervalSince1970: 1_000)
    let reminder = AlignerTrackerReminderPolicy.build(
      snapshot: snapshot,
      now: now
    ).first { $0.kind == .trayChange }
    let trayStart = Date(timeIntervalSince1970: 1_000)
    let dueDay = Calendar.current.date(byAdding: .day, value: 7, to: trayStart)
    let expected = dueDay.flatMap {
      Calendar.current.date(bySettingHour: 9, minute: 0, second: 0, of: $0)
    }

    XCTAssertEqual(reminder?.scheduledAt, expected)
    XCTAssertEqual(reminder?.body, "You are scheduled to change to Tray 10 today.")
  }

  func testReconciliationDeduplicatesAndPreservesUnrelatedRequests() {
    let first = AlignerReminder(
      body: "First",
      fingerprint: "out-too-long:1000:1",
      kind: .outTooLong,
      scheduledAt: Date(timeIntervalSince1970: 1)
    )
    let second = AlignerReminder(
      body: "Second",
      fingerprint: "tray-change:2000:2",
      kind: .trayChange,
      scheduledAt: Date(timeIntervalSince1970: 2)
    )
    let result = AlignerTrackerReminderPolicy.plan(
      desired: [first, second],
      scheduled: [
        AlignerScheduledReminder(
          fingerprint: first.fingerprint,
          identifier: "keep-first",
          kind: first.kind.rawValue
        ),
        AlignerScheduledReminder(
          fingerprint: first.fingerprint,
          identifier: "duplicate-first",
          kind: first.kind.rawValue
        ),
        AlignerScheduledReminder(
          fingerprint: "out-too-long:old:1",
          identifier: "stale",
          kind: AlignerReminderKind.outTooLong.rawValue
        ),
        AlignerScheduledReminder(
          fingerprint: nil,
          identifier: "unrelated",
          kind: "some-other-feature"
        ),
      ]
    )

    XCTAssertEqual(result.cancelIdentifiers, ["duplicate-first", "stale"])
    XCTAssertEqual(result.schedule.map(\.fingerprint), [second.fingerprint])
  }

  private func makeSnapshot(
    latestStatus: AlignerWearStatus,
    latestTimestamp: Int64,
    outReminderEnabled: Bool = true,
    trayChangeEnabled: Bool
  ) -> AlignerNotificationSnapshot {
    AlignerNotificationSnapshot(
      currentTrayNumber: 9,
      daysPerTray: 7,
      latestPunch: AlignerWearPunch(
        id: 1,
        status: latestStatus,
        timestamp: latestTimestamp
      ),
      settings: AlignerNotificationSettings(
        outReminderEnabled: outReminderEnabled,
        outReminderMinutes: 45,
        outPersistentReminderIntervalMinutes: 5,
        trayChangeReminderEnabled: trayChangeEnabled,
        trayChangeReminderHour: 9,
        trayChangeReminderMinute: 0
      ),
      totalTrays: 48,
      trayPeriodId: 1,
      trayStartedAt: 1_000_000
    )
  }
}
