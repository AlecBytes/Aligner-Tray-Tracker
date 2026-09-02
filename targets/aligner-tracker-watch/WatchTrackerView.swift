import SwiftUI

struct WatchTrackerView: View {
  @ObservedObject var model: WatchTrackerModel

  var body: some View {
    Group {
      if model.isLoading && model.snapshot == nil {
        VStack(spacing: 8) {
          ProgressView()
          Text("Loading tracker…")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      } else if let snapshot = model.snapshot, snapshot.kind == .noTreatment {
        VStack(spacing: 6) {
          Image(systemName: "iphone")
            .font(.title2)
          Text("Set up treatment")
            .font(.headline)
          Text("on your iPhone")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .multilineTextAlignment(.center)
      } else if let snapshot = model.snapshot, snapshot.isReady {
        tracker(snapshot)
      } else {
        VStack(spacing: 8) {
          Image(systemName: "iphone.slash")
            .font(.title2)
          Text("iPhone unavailable")
            .font(.headline)
            .multilineTextAlignment(.center)
        }
      }
    }
    .padding(.horizontal, 8)
    .onAppear {
      model.start()
    }
  }

  private func tracker(_ snapshot: WatchTrackerSnapshot) -> some View {
    VStack(spacing: 6) {
      Text("TRAY \(snapshot.currentTrayNumber ?? 0) / \(snapshot.totalTrays ?? 0) • DAY \(snapshot.trayDay ?? 1)")
        .font(.caption2.weight(.semibold))
        .foregroundStyle(.secondary)
        .lineLimit(1)
        .minimumScaleFactor(0.75)

      Button {
        model.toggleWearStatus()
      } label: {
        VStack(spacing: 3) {
          if model.isPending {
            ProgressView()
              .controlSize(.small)
          }
          Text(model.isPending ? "SAVING…" : "TRAYS \(snapshot.status ?? "IN")")
            .font(.headline.weight(.bold))
            .lineLimit(1)
            .minimumScaleFactor(0.75)
          Text(snapshot.status == "IN" ? "Tap when removed" : "Tap when inserted")
            .font(.caption2)
        }
        .frame(maxWidth: .infinity, minHeight: 62)
      }
      .buttonStyle(.borderedProminent)
      .tint(snapshot.status == "IN" ? Color.accentColor : .orange)
      .disabled(model.isPending || !model.isReachable)
      .accessibilityLabel(
        snapshot.status == "IN"
          ? "Trays are in. Tap when removed."
          : "Trays are out. Tap when inserted."
      )
      .accessibilityHint("Updates the saved state on your iPhone.")

      HStack(spacing: 8) {
        metric(label: "IN TODAY", minutes: snapshot.inTodayMinutes ?? 0)
        metric(label: "OUT TODAY", minutes: snapshot.outTodayMinutes ?? 0)
      }

      if let errorMessage = model.errorMessage {
        Text(errorMessage)
          .font(.caption2)
          .foregroundStyle(.red)
          .lineLimit(2)
          .multilineTextAlignment(.center)
      } else if !model.isReachable {
        Text("iPhone unavailable • Updated \(updatedTime(snapshot.generatedAtMs))")
          .font(.caption2)
          .foregroundStyle(.secondary)
          .lineLimit(2)
          .multilineTextAlignment(.center)
      }
    }
  }

  private func metric(label: String, minutes: Int) -> some View {
    VStack(spacing: 1) {
      Text(label)
        .font(.system(size: 9, weight: .semibold))
        .foregroundStyle(.secondary)
      Text(duration(minutes))
        .font(.caption.monospacedDigit().weight(.semibold))
        .lineLimit(1)
        .minimumScaleFactor(0.75)
    }
    .frame(maxWidth: .infinity)
  }

  private func duration(_ minutes: Int) -> String {
    let hours = minutes / 60
    let remainingMinutes = minutes % 60
    return hours > 0 ? "\(hours)h \(remainingMinutes)m" : "\(remainingMinutes)m"
  }

  private func updatedTime(_ timestamp: Int64) -> String {
    Date(timeIntervalSince1970: Double(timestamp) / 1_000).formatted(
      date: .omitted,
      time: .shortened
    )
  }
}
