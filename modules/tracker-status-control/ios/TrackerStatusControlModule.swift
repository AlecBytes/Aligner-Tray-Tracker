import ExpoModulesCore
import ExpoUI
import SwiftUI

private let trackerStatusControlModifierName = "trackerStatusControlStyle"

public class TrackerStatusControlModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TrackerStatusControl")

    OnCreate {
      ViewModifierRegistry.register(trackerStatusControlModifierName) { params, appContext, _ in
        try TrackerStatusControlModifier(from: params, appContext: appContext)
      }
    }

    OnDestroy {
      ViewModifierRegistry.unregister(trackerStatusControlModifierName)
    }
  }
}

private struct TrackerStatusControlModifier: ViewModifier, Record {
  @Field var faceColor: Color = .accentColor
  @Field var baseColor: Color = .secondary
  @Field var foregroundColor: Color = .primary

  func body(content: Content) -> some View {
    content.buttonStyle(TrackerStatusButtonStyle(
      faceColor: faceColor,
      baseColor: baseColor,
      foregroundColor: foregroundColor
    ))
  }
}

private struct TrackerStatusButtonStyle: ButtonStyle {
  let faceColor: Color
  let baseColor: Color
  let foregroundColor: Color

  @Environment(\.colorSchemeContrast) private var colorSchemeContrast
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

  func makeBody(configuration: Configuration) -> some View {
    let isPressed = configuration.isPressed
    let faceOffset: CGFloat = isPressed ? 3 : 0
    let baseOffset: CGFloat = isPressed ? 1 : 5
    let shadowRadius: CGFloat = isPressed ? 2 : 8
    let shadowY: CGFloat = isPressed ? 1 : 5
    let shadowOpacity = colorSchemeContrast == .increased ? 0.34 : 0.22
    let highlightOpacity = colorSchemeContrast == .increased
      ? 0.42
      : (reduceTransparency ? 0.30 : 0.22)

    ZStack {
      RoundedRectangle(cornerRadius: 18, style: .continuous)
        .fill(baseColor)
        .offset(y: baseOffset)
        .accessibilityHidden(true)

      configuration.label
        .foregroundStyle(foregroundColor)
        .background(
          RoundedRectangle(cornerRadius: 18, style: .continuous)
            .fill(faceColor)
        )
        .overlay(alignment: .top) {
          RoundedRectangle(cornerRadius: 18, style: .continuous)
            .stroke(Color.white.opacity(highlightOpacity), lineWidth: 1)
            .padding(1)
            .mask(alignment: .top) {
              Rectangle().frame(height: 18)
            }
            .accessibilityHidden(true)
        }
        .offset(y: faceOffset)
    }
    .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    .shadow(
      color: Color.black.opacity(shadowOpacity),
      radius: shadowRadius,
      x: 0,
      y: shadowY
    )
    .animation(
      reduceMotion ? nil : .easeOut(duration: 0.175),
      value: isPressed
    )
  }
}
