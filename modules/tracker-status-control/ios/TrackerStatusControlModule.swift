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
  @Field var liquidGlass: Bool = false

  @ViewBuilder
  func body(content: Content) -> some View {
    if liquidGlass {
      content.buttonStyle(DeepGlassTrackerStatusButtonStyle(
        faceColor: faceColor,
        baseColor: baseColor,
        foregroundColor: foregroundColor
      ))
    } else {
      content.buttonStyle(TrackerStatusButtonStyle(
        faceColor: faceColor,
        baseColor: baseColor,
        foregroundColor: foregroundColor
      ))
    }
  }
}

private struct DeepGlassTrackerStatusButtonStyle: ButtonStyle {
  let faceColor: Color
  let baseColor: Color
  let foregroundColor: Color

  @Environment(\.colorSchemeContrast) private var colorSchemeContrast
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
  @Environment(\.isEnabled) private var isEnabled

  private let depth: CGFloat = 24
  private let gutter: CGFloat = 8
  private let pressTravel: CGFloat = 18
  private let visualHorizontalInset: CGFloat = 24
  private let visualVerticalInset: CGFloat = 16
  private let cornerRadius: CGFloat = 24
  private let housingCornerRadius: CGFloat = 32

  private var capShape: RoundedRectangle {
    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
  }

  private var housingShape: RoundedRectangle {
    RoundedRectangle(cornerRadius: housingCornerRadius, style: .continuous)
  }

  @ViewBuilder
  private func capSurface() -> some View {
    if reduceTransparency {
      capShape.fill(faceColor)
    } else if #available(iOS 26.0, *) {
#if compiler(>=6.2) // Xcode 26
      capShape
        .fill(Color.clear)
        .glassEffect(.regular.tint(faceColor), in: capShape)
#else
      capShape.fill(faceColor)
#endif
    } else {
      capShape.fill(faceColor)
    }
  }

  private func face(isPressed: Bool) -> some View {
    let increasedContrast = colorSchemeContrast == .increased
    let highlight = increasedContrast ? 0.88 : (reduceTransparency ? 0.58 : 0.74)
    let enabledFactor = isEnabled ? 1.0 : 0.45

    return capSurface()
      .overlay {
        capShape.fill(LinearGradient(
          colors: [
            Color.white.opacity((isPressed ? 0.08 : 0.32) * enabledFactor),
            Color.white.opacity((isPressed ? 0.02 : 0.12) * enabledFactor),
            .clear,
            Color.black.opacity((isPressed ? 0.28 : 0.20) * enabledFactor),
          ],
          startPoint: .top,
          endPoint: .bottom
        ))
      }
      .overlay {
        capShape.fill(LinearGradient(
          colors: [
            Color.white.opacity((isPressed ? 0.02 : 0.10) * enabledFactor),
            .clear,
            Color.black.opacity((isPressed ? 0.08 : 0.04) * enabledFactor),
          ],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        ))
      }
      .overlay {
        capShape.strokeBorder(LinearGradient(
          colors: [
            Color.white.opacity((isPressed ? highlight * 0.55 : highlight) * enabledFactor),
            Color.white.opacity((isPressed ? 0.04 : 0.14) * enabledFactor),
            Color.black.opacity((increasedContrast ? 0.62 : 0.42) * enabledFactor),
          ],
          startPoint: .top,
          endPoint: .bottom
        ), lineWidth: 8)
      }
      .overlay {
        capShape.inset(by: 8).stroke(
          LinearGradient(
            colors: [
              Color.white.opacity((isPressed ? 0.04 : 0.18) * enabledFactor),
              .clear,
              Color.black.opacity((increasedContrast ? 0.30 : 0.16) * enabledFactor),
            ],
            startPoint: .top,
            endPoint: .bottom
          ),
          lineWidth: 1
        )
      }
      .accessibilityHidden(true)
      .allowsHitTesting(false)
  }

  private func base(isPressed: Bool) -> some View {
    let enabledFactor = isEnabled ? 1.0 : 0.45

    return capShape
      .fill(baseColor)
      .overlay {
        capShape.fill(LinearGradient(
          colors: [
            Color.black.opacity(0.22 * enabledFactor),
            Color.black.opacity(0.62 * enabledFactor),
          ],
          startPoint: .top,
          endPoint: .bottom
        ))
      }
      .overlay {
        capShape.strokeBorder(
          Color.black.opacity((colorSchemeContrast == .increased ? 0.64 : 0.38) * enabledFactor),
          lineWidth: 1
        )
      }
      .shadow(
        color: .black.opacity(isEnabled ? 0.26 : 0.08),
        radius: isPressed ? 1 : 2,
        x: 0,
        y: 1
      )
      .shadow(
        color: .black.opacity(isEnabled ? (colorSchemeContrast == .increased ? 0.48 : 0.36) : 0.10),
        radius: isPressed ? 3 : 18,
        x: 0,
        y: isPressed ? 2 : 12
      )
      .accessibilityHidden(true)
      .allowsHitTesting(false)
  }

  private func housing(isPressed: Bool) -> some View {
    let increasedContrast = colorSchemeContrast == .increased
    let enabledFactor = isEnabled ? 1.0 : 0.55

    return housingShape
      .fill(baseColor)
      .overlay {
        housingShape.fill(LinearGradient(
          colors: [
            Color.black.opacity(0.58 * enabledFactor),
            Color.black.opacity(0.84 * enabledFactor),
          ],
          startPoint: .top,
          endPoint: .bottom
        ))
      }
      .overlay {
        housingShape.inset(by: 3).stroke(
          Color.black.opacity((increasedContrast ? 0.88 : 0.72) * enabledFactor),
          lineWidth: 8
        )
      }
      .overlay {
        housingShape.strokeBorder(
          Color.white.opacity((increasedContrast ? 0.30 : 0.16) * enabledFactor),
          lineWidth: 1
        )
      }
      .shadow(
        color: .black.opacity(isEnabled ? (isPressed ? 0.18 : 0.38) : 0.10),
        radius: isPressed ? 2 : 6,
        x: 0,
        y: isPressed ? 1 : 4
      )
      .shadow(
        color: .black.opacity(isEnabled ? (isPressed ? 0.16 : 0.56) : 0.12),
        radius: isPressed ? 4 : 32,
        x: 0,
        y: isPressed ? 2 : 24
      )
      .accessibilityHidden(true)
      .allowsHitTesting(false)
  }

  func makeBody(configuration: Configuration) -> some View {
    let isPressed = configuration.isPressed && isEnabled

    configuration.label
      .foregroundStyle(foregroundColor)
      .transaction { $0.animation = nil }
      .background { face(isPressed: isPressed) }
      .offset(y: isPressed ? pressTravel : 0)
      .padding(.bottom, depth)
      .background { base(isPressed: isPressed).padding(.top, depth) }
      .padding(gutter)
      .background { housing(isPressed: isPressed) }
      .scaleEffect(isPressed ? 0.975 : 1)
      .padding(.horizontal, visualHorizontalInset)
      .padding(.vertical, visualVerticalInset)
      .contentShape(Rectangle())
      .animation(
        reduceMotion || isPressed ? nil : .easeOut(duration: 0.180),
        value: isPressed
      )
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
