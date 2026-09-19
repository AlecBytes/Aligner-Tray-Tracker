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
  @Environment(\.isEnabled) private var isEnabled

  func makeBody(configuration: Configuration) -> some View {
    let isPressed = isEnabled && configuration.isPressed
    let faceOffset: CGFloat = isPressed ? 5 : 0
    let baseOffset: CGFloat = 7
    let shadowRadius: CGFloat = isEnabled && !isPressed ? 8 : 2
    let shadowY: CGFloat = isEnabled && !isPressed ? 6 : 1
    let highlightOpacity = colorSchemeContrast == .increased
      ? 0.52
      : (reduceTransparency ? 0.34 : 0.24)
    let bevelOpacity = colorSchemeContrast == .increased ? 0.30 : 0.16
    let edgeWidth: CGFloat = colorSchemeContrast == .increased ? 2 : 1
    let insets = EdgeInsets(top: 6, leading: 12, bottom: 22, trailing: 12)
    let pressAnimation: Animation? = reduceMotion
      ? nil
      : (isPressed
          ? .easeOut(duration: 0.075)
          : .spring(response: 0.34, dampingFraction: 0.58))

    configuration.label
      .foregroundStyle(foregroundColor)
      // Stop the press transaction before it reaches status text or content transitions.
      .transaction { $0.animation = nil }
      .offset(y: faceOffset)
      .animation(pressAnimation, value: isPressed)
      .padding(insets)
      .background {
        // Only decoration is clipped. The label establishes layout and remains unclipped.
        ZStack {
          RoundedRectangle(cornerRadius: 18, style: .continuous)
            .fill(baseColor)
            .offset(y: baseOffset)
            .shadow(color: .black.opacity(isEnabled ? 0.18 : 0.08), radius: 2, x: 0, y: 2)

          RoundedRectangle(cornerRadius: 18, style: .continuous)
            .fill(faceColor)
            .overlay(alignment: .top) {
              RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(
                  Color.white.opacity(highlightOpacity * (isEnabled ? (isPressed ? 0.55 : 1) : 0.35)),
                  lineWidth: edgeWidth
                )
                .padding(1)
                .mask(alignment: .top) {
                  Rectangle().frame(height: 18)
                }
            }
            .overlay(alignment: .bottom) {
              RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.black.opacity(bevelOpacity), lineWidth: edgeWidth)
                .padding(1)
                .mask(alignment: .bottom) {
                  Rectangle().frame(height: 18)
                }
            }
            .overlay {
              RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(
                  foregroundColor.opacity(colorSchemeContrast == .increased ? 0.65 : 0),
                  lineWidth: edgeWidth
                )
            }
            // Colors and bevels update immediately; only elevation and travel spring.
            .transaction { $0.animation = nil }
            .shadow(
              color: .black.opacity(isEnabled ? 0.24 : 0.08),
              radius: shadowRadius,
              x: 0,
              y: shadowY
            )
            .offset(y: faceOffset)
            .animation(pressAnimation, value: isPressed)
        }
        .padding(insets)
        .clipped()
        .accessibilityHidden(true)
        .allowsHitTesting(false)
      }
      .contentShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
  }
}
