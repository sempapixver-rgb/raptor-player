import Foundation

/// Detecta o que o usuário colou (mesma regra do SmartLink.kt do Android).
enum SmartLink {
    static func looksComplete(_ raw: String) -> Bool {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.count < 6 { return false }
        let lower = text.lowercased()
        if lower.contains("/get.php") || lower.contains("/player_api.php") ||
            lower.hasSuffix(".m3u") || lower.hasSuffix(".m3u8") ||
            lower.hasPrefix("file:") {
            return true
        }
        return matches("^[a-zA-Z][a-zA-Z0-9+.-]*://[^/\\s]+/?$", text)
            || matches("^[^\\s/]+\\.[^\\s/]+(:\\d{1,5})?/?$", text)
    }

    static func detect(_ raw: String) -> DetectedLink? {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }

        let lower = text.lowercased()
        let hasScheme = lower.hasPrefix("http://") || lower.hasPrefix("https://") || lower.hasPrefix("file:")
        let parseable = hasScheme ? text : "http://" + text
        guard let comps = URLComponents(string: parseable),
              let host = comps.host, !host.isEmpty else { return nil }

        func base() -> String? {
            guard let scheme = comps.scheme, let host = comps.host, !host.isEmpty else { return nil }
            let port = comps.port.map { ":\($0)" } ?? ""
            return "\(scheme)://\(host)\(port)"
        }

        if lower.contains("/get.php") || lower.contains("/player_api.php") {
            let query = comps.queryItems ?? []
            let user = query.first { $0.name == "username" }?.value ?? ""
            let pass = query.first { $0.name == "password" }?.value ?? ""
            if let base = base(), !user.isEmpty, !pass.isEmpty {
                return DetectedLink(mode: .service, host: base, user: user, pass: pass)
            }
            return DetectedLink(mode: .link, link: text)
        }

        if lower.hasSuffix(".m3u") || lower.hasSuffix(".m3u8") || lower.hasPrefix("file:") {
            return DetectedLink(mode: .link, link: text)
        }

        guard let base = base() else { return nil }
        return DetectedLink(mode: .service, host: base)
    }

    private static func matches(_ pattern: String, _ text: String) -> Bool {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return false }
        let range = NSRange(text.startIndex..., in: text)
        return regex.firstMatch(in: text, range: range) != nil
    }
}
