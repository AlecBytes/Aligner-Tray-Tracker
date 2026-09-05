const appTargetIntents = `import AppIntents
internal import AlignerTrackerIntents
import Foundation

@available(iOS 16.4, *)
private enum AlignerTrackerAppIntentError: Error, CustomLocalizedStringResourceConvertible {
  case appOpenRequired
  case noActiveTreatment
  case updateFailed

  var localizedStringResource: LocalizedStringResource {
    switch self {
    case .appOpenRequired:
      return "Open Aligner Tracker once, then try again."
    case .noActiveTreatment:
      return "Open Aligner Tracker to set up your treatment first."
    case .updateFailed:
      return "I couldn't update Aligner Tracker."
    }
  }
}

@available(iOS 16.4, *)
struct MarkTraysOutIntent: AppIntent {
  static let title: LocalizedStringResource = "Mark Trays OUT"
  static let description = IntentDescription(
    "Records that you removed your aligner trays."
  )
  static let authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed
  static let openAppWhenRun = false

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let invocationTimestamp = Int64(
      (Date().timeIntervalSince1970 * 1_000).rounded(.down)
    )
    let result: AlignerTrackerIntentResult
    do {
      result = try await AlignerTrackerIntentBridge.ensureWearStatus(
        "OUT",
        timestamp: invocationTimestamp
      )
    } catch {
      throw AlignerTrackerAppIntentError.updateFailed
    }

    switch result.outcome {
    case .changed:
      if result.notificationFailed {
        return .result(dialog: "Trays marked out, but reminders couldn't be refreshed.")
      }
      return .result(dialog: "Trays marked out.")
    case .alreadyInState:
      return .result(dialog: "Your trays are already out.")
    case .appOpenRequired:
      throw AlignerTrackerAppIntentError.appOpenRequired
    case .noActiveTreatment:
      throw AlignerTrackerAppIntentError.noActiveTreatment
    }
  }
}

@available(iOS 16.4, *)
struct MarkTraysInIntent: AppIntent {
  static let title: LocalizedStringResource = "Mark Trays IN"
  static let description = IntentDescription(
    "Records that you inserted your aligner trays."
  )
  static let authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed
  static let openAppWhenRun = false

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let invocationTimestamp = Int64(
      (Date().timeIntervalSince1970 * 1_000).rounded(.down)
    )
    let result: AlignerTrackerIntentResult
    do {
      result = try await AlignerTrackerIntentBridge.ensureWearStatus(
        "IN",
        timestamp: invocationTimestamp
      )
    } catch {
      throw AlignerTrackerAppIntentError.updateFailed
    }

    switch result.outcome {
    case .changed:
      if result.notificationFailed {
        return .result(dialog: "Trays marked in, but reminders couldn't be refreshed.")
      }
      return .result(dialog: "Trays marked in.")
    case .alreadyInState:
      return .result(dialog: "Your trays are already in.")
    case .appOpenRequired:
      throw AlignerTrackerAppIntentError.appOpenRequired
    case .noActiveTreatment:
      throw AlignerTrackerAppIntentError.noActiveTreatment
    }
  }
}

@available(iOS 16.4, *)
struct AlignerTrackerAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: MarkTraysOutIntent(),
      phrases: [
        "Mark my trays out in \\(.applicationName)",
        "Trays out in \\(.applicationName)",
      ],
      shortTitle: "Mark Trays OUT",
      systemImageName: "arrow.up.circle"
    )
    AppShortcut(
      intent: MarkTraysInIntent(),
      phrases: [
        "Mark my trays in with \\(.applicationName)",
        "Trays in with \\(.applicationName)",
      ],
      shortTitle: "Mark Trays IN",
      systemImageName: "arrow.down.circle"
    )
  }
}

@objc(AlignerTrackerAppShortcutsUpdater)
final class AlignerTrackerAppShortcutsUpdater: NSObject {
  @objc static func updateAppShortcutParameters() {
    if #available(iOS 16.4, *) {
      AlignerTrackerAppShortcuts.updateAppShortcutParameters()
    }
  }
}
`;

module.exports = { appTargetIntents };
