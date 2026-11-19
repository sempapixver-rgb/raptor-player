import SwiftUI

// Paleta idêntica à do app Android (app/src/common/.../Theme.kt).
enum RaptorColor {
    static let green = Color(red: 0x00 / 255, green: 0xE6 / 255, blue: 0x76 / 255)
    static let greenSoft = Color(red: 0x69 / 255, green: 0xF0 / 255, blue: 0xAE / 255)
    static let background = Color(red: 0x0B / 255, green: 0x0F / 255, blue: 0x0C / 255)
    static let black = Color(red: 0x05 / 255, green: 0x08 / 255, blue: 0x06 / 255)
    static let surface = Color(red: 0x12 / 255, green: 0x1A / 255, blue: 0x14 / 255)
    static let surfaceHigh = Color(red: 0x1B / 255, green: 0x26 / 255, blue: 0x1E / 255)
    static let text = Color(red: 0xE6 / 255, green: 0xF2 / 255, blue: 0xE9 / 255)
    static let dim = Color(red: 0xA8 / 255, green: 0xC2 / 255, blue: 0xB0 / 255)
    static let outline = Color(red: 0x2E / 255, green: 0x4A / 255, blue: 0x36 / 255)
    static let error = Color(red: 1, green: 0x42 / 255, blue: 0x42 / 255)
}

extension Color {
    static var raptorGreen: Color { RaptorColor.green }
    static var raptorBackground: Color { RaptorColor.background }
    static var raptorSurface: Color { RaptorColor.surface }
    static var raptorSurfaceHigh: Color { RaptorColor.surfaceHigh }
    static var raptorText: Color { RaptorColor.text }
    static var raptorDim: Color { RaptorColor.dim }
    static var raptorOutline: Color { RaptorColor.outline }
}

struct RaptorBackgroundModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(RaptorColor.background.ignoresSafeArea())
            .foregroundStyle(RaptorColor.text)
    }
}

extension View {
    func raptorScreen() -> some View {
        modifier(RaptorBackgroundModifier())
    }
}

struct PrimaryButton: View {
    let title: String
    var enabled = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.headline.weight(.bold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(enabled ? RaptorColor.green : RaptorColor.surfaceHigh)
                .foregroundStyle(enabled ? RaptorColor.black : RaptorColor.dim)
                .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .disabled(!enabled)
    }
}

struct SecondaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(RaptorColor.surfaceHigh)
                .foregroundStyle(RaptorColor.text)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(RaptorColor.outline, lineWidth: 1)
                )
        }
    }
}

struct SectionLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption.weight(.bold))
            .foregroundStyle(RaptorColor.green)
            .tracking(1)
    }
}

struct RaptorField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    var secure = false
    var keyboard: UIKeyboardType = .default

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.caption)
                .foregroundStyle(RaptorColor.dim)
            Group {
                if secure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                }
            }
            .keyboardType(keyboard)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .padding(12)
            .background(RaptorColor.black.opacity(0.7))
            .foregroundStyle(RaptorColor.text)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(RaptorColor.outline, lineWidth: 1)
            )
        }
    }
}

struct SearchField: View {
    @Binding var text: String
    let placeholder: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(RaptorColor.dim)
            TextField(placeholder, text: $text)
                .foregroundStyle(RaptorColor.text)
                .autocorrectionDisabled()
            if !text.isEmpty {
                Button { text = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(RaptorColor.dim)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(10)
        .background(RaptorColor.surfaceHigh)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(RaptorColor.outline, lineWidth: 1)
        )
    }
}

struct BrandHeader: View {
    var subtitle: String? = nil

    var body: some View {
        VStack(spacing: 2) {
            Text("RAPTOR")
                .font(.system(size: 30, weight: .black))
                .foregroundStyle(RaptorColor.green)
                .kerning(6)
            if let subtitle {
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(RaptorColor.dim)
                    .kerning(3)
            }
        }
    }
}

struct StateView: View {
    enum Kind {
        case loading(String)
        case error(String)
        case empty(String)

        var title: String {
            switch self {
            case .loading(let t), .error(let t), .empty(let t): return t
            }
        }

        var icon: String {
            switch self {
            case .loading: return "ellipsis"
            case .error: return "exclamationmark.triangle"
            case .empty: return "tray"
            }
        }
    }

    let kind: Kind
    let retry: (() -> Void)?

    init(_ kind: Kind, retry: (() -> Void)? = nil) {
        self.kind = kind
        self.retry = retry
    }

    var body: some View {
        VStack(spacing: 12) {
            if case .loading = kind {
                ProgressView()
                    .tint(RaptorColor.green)
            } else {
                Image(systemName: kind.icon)
                    .font(.system(size: 34))
                    .foregroundStyle(RaptorColor.dim)
            }
            Text(kind.title)
                .font(.subheadline)
                .foregroundStyle(RaptorColor.dim)
                .multilineTextAlignment(.center)
            if let retry {
                SecondaryButton(title: "Tentar novamente", action: retry)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 180)
    }
}
